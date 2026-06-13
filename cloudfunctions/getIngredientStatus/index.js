/**
 * 云函数 getIngredientStatus：获取当前用户所有食材的排敏状态
 * 集合：读 ingredient_status
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

  try {
    const r = await db.collection('ingredient_status')
      .where({ openid })
      .orderBy('updatedAt', 'desc')
      .limit(200)
      .get();
    const items = (r.data || []).map(d => ({
      ingredient: d.ingredient,
      status: d.status,
      currentDay: d.currentDay || 1,
      totalDays: d.totalDays || 3,
      startDate: d.startDate || '',
      updatedAt: d.updatedAt || '',
    }));
    return res(null, { items });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
