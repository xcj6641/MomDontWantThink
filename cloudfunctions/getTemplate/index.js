/**
 * 云函数 getTemplate：按 id 获取单条模板
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

  const { templateId } = event || {};
  if (!templateId) return res({ code: 'INVALID_INPUT', message: '缺少 templateId' });

  try {
    const tRes = await db.collection('templates').doc(templateId).get();
    if (!tRes.data) return res({ code: 'TEMPLATE_NOT_FOUND', message: '模板不存在' });
    return res(null, { template: tRes.data });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
