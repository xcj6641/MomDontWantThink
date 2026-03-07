/**
 * 云函数 logMealDone：标记某餐已做，写入 meal_logs（openid+date+mealKey 唯一则 update 否则 insert）
 * 集合：写 meal_logs
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function getMonday(str) {
  const d = new Date(str + 'T12:00:00.000Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function res(err, data = null) {
  if (err) return { success: false, code: err.code || 'ERROR', message: err.message };
  return { success: true, ...data };
}

const VALID_MEAL_KEYS = ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner'];

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  const { date, mealKey, recipeId, recipeName, reaction } = event || {};
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res({ code: 'INVALID_INPUT', message: 'date 须为 YYYY-MM-DD' });
  }
  if (!mealKey || !VALID_MEAL_KEYS.includes(mealKey)) {
    return res({ code: 'INVALID_INPUT', message: 'mealKey 无效' });
  }

  const weekStartDate = getMonday(date);
  const now = new Date().toISOString();

  try {
    const exist = await db.collection('meal_logs')
      .where({ openid, date, mealKey })
      .get();

    const payload = {
      recipeId: recipeId || '',
      recipeName: recipeName || '',
      reaction: reaction === 'good' || reaction === 'bad' || reaction === 'skip' ? reaction : undefined,
      weekStartDate,
      loggedAt: now
    };

    if (exist.data && exist.data.length > 0) {
      const doc = exist.data[0];
      await db.collection('meal_logs').doc(doc._id).update({
        data: { ...payload, recipeId: recipeId !== undefined ? recipeId : doc.recipeId, recipeName: recipeName !== undefined ? recipeName : doc.recipeName, reaction: payload.reaction !== undefined ? payload.reaction : doc.reaction }
      });
      return res(null, { logId: doc._id, message: '已帮你记下这餐啦' });
    }

    const addRes = await db.collection('meal_logs').add({
      data: {
        openid,
        date,
        mealKey,
        recipeId: recipeId || '',
        recipeName: recipeName || '',
        reaction: reaction === 'good' || reaction === 'bad' || reaction === 'skip' ? reaction : null,
        note: '',
        weekStartDate,
        loggedAt: now
      }
    });
    return res(null, { logId: addRes._id, message: '已帮你记下这餐啦' });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
