/**
 * 云函数 updateDayOverride：修改单日某餐或整日 override
 * 集合：读 week_plans；写 week_plans
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MEAL_KEYS = ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner'];

function getMonday(str) {
  const d = new Date(str + 'T12:00:00.000Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function res(err, data = null) {
  if (err) return { success: false, code: err.code || 'ERROR', message: err.message };
  return { success: true, ...data };
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  const { weekStartDate: rawWeek, date, isOverridden, meals, overrides: incomingOverrides } = event || {};
  if (!date) return res({ code: 'INVALID_INPUT', message: '缺少 date' });
  const weekStartDate = rawWeek ? getMonday(rawWeek) : getMonday(date);
  const weekMon = weekStartDate;
  const weekDates = [];
  for (let i = 0; i < 7; i++) weekDates.push(addDays(weekMon, i));
  if (!weekDates.includes(date)) {
    return res({ code: 'DATE_NOT_IN_WEEK', message: 'date 不在该周内' });
  }

  const now = new Date().toISOString();

  try {
    const planRes = await db.collection('week_plans').where({ openid, weekStartDate }).get();
    const plan = planRes.data && planRes.data[0] ? planRes.data[0] : null;
    if (!plan || !plan.days) return res({ code: 'NO_WEEK_PLAN', message: '该周暂无计划' });

    const newDays = plan.days.map(day => {
      if (day.date !== date) return day;
      if (incomingOverrides != null && typeof incomingOverrides === 'object') {
        const merged = { ...(day.overrides || {}) };
        Object.keys(incomingOverrides).forEach(slot => {
          const v = incomingOverrides[slot];
          if (v && (v.recipeId || v.recipeName)) merged[slot] = { recipeId: v.recipeId || '', recipeName: v.recipeName || '' };
          else delete merged[slot];
        });
        return {
          date: day.date,
          isOverridden: Object.keys(merged).length > 0 || (typeof isOverridden === 'boolean' ? isOverridden : day.isOverridden),
          meals: day.meals || [],
          overrides: Object.keys(merged).length ? merged : undefined
        };
      }
      let newMeals = Array.isArray(meals) && meals.length > 0 ? meals : null;
      if (newMeals && newMeals.length < 5) {
        const byKey = {};
        newMeals.forEach(m => { byKey[m.mealKey] = m; });
        newMeals = MEAL_KEYS.map(mk => byKey[mk] || { mealKey: mk, recipeId: '', recipeName: '未安排', blw: true });
      }
      return {
        date: day.date,
        isOverridden: typeof isOverridden === 'boolean' ? isOverridden : true,
        meals: newMeals || day.meals || []
      };
    });

    await db.collection('week_plans').doc(plan._id).update({
      data: { days: newDays, updatedAt: now }
    });

    return res(null, { date, message: '已帮你更新当日菜单' });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
