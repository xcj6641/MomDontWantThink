/**
 * 云函数 recordAllergyObservation：记录排敏观察结果
 * 集合：读写 ingredient_status
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

  const { ingredient, day, result, symptoms } = event || {};
  if (!ingredient) return res({ code: 'MISSING_INGREDIENT', message: '缺少食材名称' });
  if (!day || !result) return res({ code: 'MISSING_PARAMS', message: '缺少 day 或 result' });

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  try {
    const existRes = await db.collection('ingredient_status')
      .where({ openid, ingredient })
      .get();
    const doc = existRes.data && existRes.data[0] ? existRes.data[0] : null;
    if (!doc) {
      return res({ code: 'NOT_FOUND', message: '未找到该食材的排敏记录' });
    }

    const observation = { date: today, day: Number(day), result };
    if (result === 'anomaly' && Array.isArray(symptoms) && symptoms.length > 0) {
      observation.symptoms = symptoms;
    }

    const observations = Array.isArray(doc.observations) ? [...doc.observations] : [];
    observations.push(observation);

    let newStatus = doc.status;
    let newCurrentDay = doc.currentDay || Number(day);

    if (result === 'anomaly') {
      newStatus = 'paused';
    } else if (result === 'ok') {
      if (Number(day) >= (doc.totalDays || 3)) {
        newStatus = 'passed';
      } else {
        newStatus = 'testing';
        newCurrentDay = Number(day) + 1;
      }
    }

    await db.collection('ingredient_status').doc(doc._id).update({
      data: {
        status: newStatus,
        currentDay: newCurrentDay,
        observations,
        updatedAt: now,
      }
    });

    const updated = { ...doc, status: newStatus, currentDay: newCurrentDay, observations };
    return res(null, {
      ingredient,
      status: newStatus,
      currentDay: newCurrentDay,
      totalDays: doc.totalDays || 3,
      message: newStatus === 'passed' ? '排敏通过！该食材已标记为安全' :
               newStatus === 'paused' ? '已记录异常，该食材已暂停添加' :
               `Day ${newCurrentDay} 开始，继续观察`,
    });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
