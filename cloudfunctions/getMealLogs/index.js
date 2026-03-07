/**
 * 云函数 getMealLogs：按周或近期获取当前用户进食记录
 * 集合：meal_logs（只读）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function res(err, data = null) {
  if (err) return { success: false, code: err.code || 'ERROR', message: err.message };
  return { success: true, ...data };
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  const { weekStartDate, limit = 50 } = event || {};

  try {
    const where = weekStartDate && /^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)
      ? { openid, weekStartDate }
      : { openid };
    const res_ = await db.collection('meal_logs').where(where).orderBy('date', 'desc').orderBy('loggedAt', 'desc').limit(limit).get();
    const list = (res_.data || []).map((doc) => ({
      _id: doc._id,
      date: doc.date,
      mealKey: doc.mealKey,
      recipeName: doc.recipeName,
      reaction: doc.reaction,
      anomalyType: doc.anomalyType,
      anomalyNote: doc.anomalyNote
    }));
    const byDate = {};
    list.forEach((log) => {
      if (!byDate[log.date]) byDate[log.date] = [];
      byDate[log.date].push(log);
    });
    const logs = Object.keys(byDate)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({ date, entries: byDate[date] }));
    return res(null, { logs });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
