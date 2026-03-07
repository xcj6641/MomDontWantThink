/**
 * 云函数 markReaction：异常标记（rash/vomit/diarrhea/other），仅记录不推断过敏原
 * 集合：读+写 meal_logs（anomalyType、anomalyNote）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function res(err, data = null) {
  if (err) return { success: false, code: err.code || 'ERROR', message: err.message };
  return { success: true, ...data };
}

const VALID_REACTION_TYPES = ['rash', 'vomit', 'diarrhea', 'other'];
const VALID_MEAL_KEYS = ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner'];

function getMonday(str) {
  const d = new Date(str + 'T12:00:00.000Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  const { date, mealKey, reactionType, note } = event || {};
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res({ code: 'INVALID_INPUT', message: 'date 须为 YYYY-MM-DD' });
  }
  if (!mealKey || !VALID_MEAL_KEYS.includes(mealKey)) {
    return res({ code: 'INVALID_INPUT', message: 'mealKey 无效' });
  }
  if (!reactionType || !VALID_REACTION_TYPES.includes(reactionType)) {
    return res({ code: 'INVALID_INPUT', message: 'reactionType 须为 rash|vomit|diarrhea|other' });
  }

  const now = new Date().toISOString();

  try {
    const exist = await db.collection('meal_logs')
      .where({ openid, date, mealKey })
      .get();

    if (exist.data && exist.data.length > 0) {
      const doc = exist.data[0];
      await db.collection('meal_logs').doc(doc._id).update({
        data: {
          anomalyType: reactionType,
          anomalyNote: typeof note === 'string' ? note : (doc.anomalyNote || ''),
          updatedAt: now
        }
      });
      return res(null, {
        logId: doc._id,
        message: '已帮你记下这次反应，记得观察宝宝状态哦（本产品不推断过敏原）'
      });
    }

    const weekStartDate = getMonday(date);
    const addRes = await db.collection('meal_logs').add({
      data: {
        openid,
        date,
        mealKey,
        recipeId: '',
        recipeName: '',
        reaction: null,
        note: '',
        anomalyType: reactionType,
        anomalyNote: typeof note === 'string' ? note : '',
        weekStartDate,
        loggedAt: now
      }
    });
    return res(null, {
      logId: addRes._id,
      message: '已帮你记下这次反应，记得观察宝宝状态哦（本产品不推断过敏原）'
    });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
