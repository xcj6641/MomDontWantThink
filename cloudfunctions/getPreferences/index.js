/**
 * 云函数 getPreferences：获取当前用户偏好（月龄、过敏、BLW）
 * 集合：读 preferences
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
    const r = await db.collection('preferences').where({ openid }).get();
    const pref = r.data && r.data[0] ? r.data[0] : null;
    return res(null, {
      babyBirthday: pref && pref.babyBirthday ? pref.babyBirthday : '',
      babyAgeMonths: pref ? pref.babyAgeMonths : null,
      allergyIngredientNames: pref ? (pref.allergyIngredientNames || []) : [],
      blwLikes: pref ? (pref.blwLikes || []) : [],
      blwDislikes: pref ? (pref.blwDislikes || []) : [],
    });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
