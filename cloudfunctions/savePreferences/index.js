/**
 * 云函数 savePreferences：保存用户偏好（月龄、过敏、BLW 喜欢/不喜欢）
 * 集合：读+写 preferences
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function res(err, data = null) {
  if (err) return { success: false, code: err.code || 'ERROR', message: err.message };
  return { success: true, ...data };
}

function monthsFromBirthday(birthdayStr) {
  if (!birthdayStr || !/^\d{4}-\d{2}-\d{2}$/.test(birthdayStr)) return null;
  const b = new Date(birthdayStr + 'T12:00:00.000Z');
  const t = new Date();
  let months = (t.getUTCFullYear() - b.getUTCFullYear()) * 12 + (t.getUTCMonth() - b.getUTCMonth());
  if (t.getUTCDate() < b.getUTCDate()) months--;
  return Math.max(0, months);
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  const { babyBirthday, babyAgeMonths, allergyIngredientNames, blwLikes, blwDislikes } = event || {};
  const now = new Date().toISOString();

  try {
    const exist = await db.collection('preferences').where({ openid }).get();
    const doc = exist.data && exist.data[0] ? exist.data[0] : null;
    const updateData = { updatedAt: now };
    if (babyBirthday !== undefined) {
      updateData.babyBirthday = typeof babyBirthday === 'string' ? babyBirthday.trim() : '';
      const computed = monthsFromBirthday(updateData.babyBirthday);
      if (computed != null) updateData.babyAgeMonths = computed;
    }
    if (babyAgeMonths !== undefined && updateData.babyAgeMonths === undefined) updateData.babyAgeMonths = Math.max(0, parseInt(babyAgeMonths, 10) || 0);
    if (Array.isArray(allergyIngredientNames)) updateData.allergyIngredientNames = allergyIngredientNames;
    if (Array.isArray(blwLikes)) updateData.blwLikes = blwLikes;
    if (Array.isArray(blwDislikes)) updateData.blwDislikes = blwDislikes;

    if (doc) {
      await db.collection('preferences').doc(doc._id).update({
        data: updateData
      });
      return res(null, { message: '已帮你保存偏好' });
    }
    await db.collection('preferences').add({
      data: {
        openid,
        babyBirthday: updateData.babyBirthday != null ? updateData.babyBirthday : '',
        babyAgeMonths: updateData.babyAgeMonths != null ? updateData.babyAgeMonths : null,
        allergyIngredientNames: updateData.allergyIngredientNames || [],
        blwLikes: updateData.blwLikes || [],
        blwDislikes: updateData.blwDislikes || [],
        createdAt: now,
        updatedAt: now
      }
    });
    return res(null, { message: '已帮你保存偏好' });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
