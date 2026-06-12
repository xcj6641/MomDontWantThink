/**
 * 云函数 confirmWeek：将本周计划标记为已确认（week_settings.confirmed = true）
 * 当 savePlan=true 时，快照当前周计划到 saved_week_plans 集合
 * 集合：读 week_settings, week_plans；写 week_settings, saved_week_plans
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function parseMonday(str) {
  const d = new Date(str + 'T00:00:00.000Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function res(err, data = null) {
  if (err) return { success: false, code: err.code || 'ERROR', message: err.message };
  return { success: true, ...data };
}

/** Build a human-readable label like "4月7日-4月13日" from weekStartDate */
function buildWeekLabel(weekStartDate) {
  const start = new Date(weekStartDate + 'T00:00:00.000Z');
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d) => `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  return `${fmt(start)}-${fmt(end)}`;
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  let { weekStartDate, savePlan, arrangementMode, dayBindings } = event || {};
  if (!weekStartDate) return res({ code: 'INVALID_WEEK_START', message: '缺少 weekStartDate' });
  weekStartDate = parseMonday(weekStartDate);

  const now = new Date().toISOString();
  try {
    const settingsRes = await db.collection('week_settings').where({ openid, weekStartDate }).get();
    const settingsDoc = settingsRes.data && settingsRes.data[0] ? settingsRes.data[0] : null;
    if (!settingsDoc) {
      return res({ code: 'NOT_FOUND', message: '未找到该周设置' });
    }

    // Mark week as confirmed
    await db.collection('week_settings').doc(settingsDoc._id).update({
      data: { confirmed: true, updatedAt: now }
    });

    // If savePlan is true, snapshot the week plan into saved_week_plans
    if (savePlan) {
      const planRes = await db.collection('week_plans').where({ openid, weekStartDate }).get();
      const planDoc = planRes.data && planRes.data[0] ? planRes.data[0] : null;

      if (planDoc) {
        // Build snapshot items grouped by template binding
        const days = planDoc.days || [];
        const bindings = Array.isArray(dayBindings) ? dayBindings : (settingsDoc.dayBindings || []);
        const mode = arrangementMode || settingsDoc.arrangementMode || 'consecutive';
        const N = settingsDoc.N || Math.max(...bindings.map(Number).filter(n => Number.isFinite(n)), 1);
        const templateIds = settingsDoc.templateIds || [];

        // Group days by their template binding (1-based index)
        const groups = {};
        for (let i = 0; i < 7; i++) {
          const binding = Number(bindings[i]) || 1;
          if (!groups[binding]) groups[binding] = [];
          const day = days.find(d => {
            if (!d || !d.date) return false;
            const dayDate = new Date(d.date + 'T00:00:00.000Z');
            const weekStart = new Date(weekStartDate + 'T00:00:00.000Z');
            const diff = Math.round((dayDate - weekStart) / (24 * 60 * 60 * 1000));
            return diff === i;
          });
          if (day) groups[binding].push(day);
        }

        // Build items array for the snapshot
        const items = [];
        for (let g = 1; g <= N; g++) {
          const groupDays = groups[g] || [];
          // Use meals from the first day in this group as representative
          const representativeMeals = groupDays.length > 0 ? (groupDays[0].meals || []) : [];
          items.push({
            templateId: templateIds[g - 1] || '',
            templateName: `备餐${g}`,
            meals: representativeMeals.map(m => ({
              mealKey: m.mealKey || '',
              recipeId: m.recipeId || '',
              recipeName: m.recipeName || '',
              blw: !!m.blw,
            })),
          });
        }

        await db.collection('saved_week_plans').add({
          data: {
            openid,
            label: buildWeekLabel(weekStartDate),
            weekStartDate,
            prepCount: N,
            arrangementMode: mode,
            dayBindings: bindings,
            items,
            savedAt: now,
          }
        });
      }
    }

    return res(null, { message: '已确认本周计划' });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
