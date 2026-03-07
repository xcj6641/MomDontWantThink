/**
 * 云函数 confirmWeek：将本周计划标记为已确认（week_settings.confirmed = true）
 * 集合：写 week_settings
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

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  let { weekStartDate } = event || {};
  if (!weekStartDate) return res({ code: 'INVALID_WEEK_START', message: '缺少 weekStartDate' });
  weekStartDate = parseMonday(weekStartDate);

  const now = new Date().toISOString();
  try {
    const r = await db.collection('week_settings').where({ openid, weekStartDate }).get();
    const doc = r.data && r.data[0] ? r.data[0] : null;
    if (!doc) {
      return res({ code: 'NOT_FOUND', message: '未找到该周设置' });
    }
    await db.collection('week_settings').doc(doc._id).update({
      data: { confirmed: true, updatedAt: now }
    });
    return res(null, { message: '已确认本周计划' });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
