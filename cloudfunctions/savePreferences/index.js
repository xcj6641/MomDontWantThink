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

  const { babyBirthday, babyName, babyAgeMonths, allergyIngredientNames, teethStage, blwLikes, blwDislikes, allergyMode, allergyTestingPeriod, mealCountOverride } = event || {};
  const now = new Date().toISOString();

  try {
    const exist = await db.collection('preferences').where({ openid }).get();
    const doc = exist.data && exist.data[0] ? exist.data[0] : null;
    const updateData = { updatedAt: now };
    if (babyName !== undefined) updateData.babyName = typeof babyName === 'string' ? babyName.trim() : '';
    if (babyBirthday !== undefined) {
      updateData.babyBirthday = typeof babyBirthday === 'string' ? babyBirthday.trim() : '';
      const computed = monthsFromBirthday(updateData.babyBirthday);
      if (computed != null) updateData.babyAgeMonths = computed;
    }
    if (babyAgeMonths !== undefined && updateData.babyAgeMonths === undefined) updateData.babyAgeMonths = Math.max(0, parseInt(babyAgeMonths, 10) || 0);
    if (Array.isArray(allergyIngredientNames)) updateData.allergyIngredientNames = allergyIngredientNames;
    if (teethStage !== undefined) updateData.teethStage = typeof teethStage === 'string' ? teethStage : '';
    if (Array.isArray(blwLikes)) updateData.blwLikes = blwLikes;
    if (Array.isArray(blwDislikes)) updateData.blwDislikes = blwDislikes;
    if (allergyMode !== undefined) updateData.allergyMode = !!allergyMode;
    if (allergyTestingPeriod !== undefined) updateData.allergyTestingPeriod = Math.max(2, Math.min(3, parseInt(allergyTestingPeriod, 10) || 3));
    if (mealCountOverride !== undefined) updateData.mealCountOverride = mealCountOverride === null ? null : Math.max(1, Math.min(4, parseInt(mealCountOverride, 10) || 0)) || null;

    if (doc) {
      await db.collection('preferences').doc(doc._id).update({
        data: updateData
      });
      return res(null, { message: '已帮你保存偏好' });
    }
    await db.collection('preferences').add({
      data: {
        openid,
        babyName: updateData.babyName != null ? updateData.babyName : '',
        babyBirthday: updateData.babyBirthday != null ? updateData.babyBirthday : '',
        babyAgeMonths: updateData.babyAgeMonths != null ? updateData.babyAgeMonths : null,
        allergyIngredientNames: updateData.allergyIngredientNames || [],
        teethStage: updateData.teethStage || '',
        blwLikes: updateData.blwLikes || [],
        blwDislikes: updateData.blwDislikes || [],
        allergyMode: updateData.allergyMode !== undefined ? updateData.allergyMode : false,
        allergyTestingPeriod: updateData.allergyTestingPeriod !== undefined ? updateData.allergyTestingPeriod : 3,
        mealCountOverride: updateData.mealCountOverride !== undefined ? updateData.mealCountOverride : null,
        createdAt: now,
        updatedAt: now
      }
    });
    return res(null, { message: '已帮你保存偏好' });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
