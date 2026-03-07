/**
 * 云函数 getHomeData：首页数据（今日菜单、明日提示、下周是否已生成）
 * 集合：week_plans（只读）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function getMonday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00.000Z');
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

  let today = (event && event.today) || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) today = new Date().toISOString().slice(0, 10);

  const thisMonday = getMonday(today);
  const nextMonday = addDays(thisMonday, 7);

  try {
    const [prefRes, thisSettingsRes, thisRes, nextRes] = await Promise.all([
      db.collection('preferences').where({ openid }).get(),
      db.collection('week_settings').where({ openid, weekStartDate: thisMonday }).get(),
      db.collection('week_plans').where({ openid, weekStartDate: thisMonday }).get(),
      db.collection('week_plans').where({ openid, weekStartDate: nextMonday }).get()
    ]);
    const pref = prefRes.data && prefRes.data[0] ? prefRes.data[0] : null;
    const thisSettings = thisSettingsRes.data && thisSettingsRes.data[0] ? thisSettingsRes.data[0] : null;
    const thisPlan = thisRes.data && thisRes.data[0] ? thisRes.data[0] : null;
    const nextPlan = nextRes.data && nextRes.data[0] ? nextRes.data[0] : null;

    const babyBirthday = pref && pref.babyBirthday ? pref.babyBirthday : '';
    const thisWeekConfirmed = thisSettings && thisSettings.confirmed === true;
    const showInitial = !babyBirthday || !thisWeekConfirmed;

    let todayMeals = [];
    if (thisPlan && thisPlan.days && Array.isArray(thisPlan.days)) {
      const day = thisPlan.days.find((d) => d.date === today);
      if (day && day.meals) todayMeals = day.meals;
    }

    const MEAL_LABEL = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack_am: '上午加餐', snack_pm: '下午加餐', snack1: '上午加餐', snack2: '下午加餐' };
    let tomorrowTip = '去生成下周计划吧～';
    const tomorrow = addDays(today, 1);
    if (thisPlan && thisPlan.days) {
      const tomorrowDay = thisPlan.days.find((d) => d.date === tomorrow);
      if (tomorrowDay && tomorrowDay.meals && tomorrowDay.meals.length > 0) {
        const first = tomorrowDay.meals[0];
        const label = MEAL_LABEL[first.mealKey] || '一餐';
        tomorrowTip = `明日${label}：${first.recipeName || '已安排'}，记得备好食材哦`;
      }
    }

    const nextWeekStatus = nextPlan && nextPlan.days && nextPlan.days.length >= 7 ? 'generated' : 'none';

    return res(null, {
      today,
      todayMeals,
      tomorrowTip,
      nextWeekStatus,
      nextWeekStartDate: nextMonday,
      showInitial: !!showInitial,
      babyBirthday: babyBirthday || '',
      allergens: pref && Array.isArray(pref.allergyIngredientNames) ? pref.allergyIngredientNames : [],
      thisWeekStartDate: thisMonday
    });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
