/**
 * 云函数 initUser：确保当前用户在 users 集合中存在
 * 集合：users（读+写）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function res(err, data = null) {
  if (err) return { success: false, code: err.code || 'ERROR', message: err.message };
  return { success: true, ...data };
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return res({ code: 'NO_OPENID', message: '无法获取用户标识' });
  }

  const { nickName, avatarUrl } = event || {};
  const now = new Date().toISOString();

  try {
    const users = db.collection('users');
    const exist = await users.where({ openid }).get();
    if (exist.data && exist.data.length > 0) {
      const user = exist.data[0];
      const updateData = { updatedAt: now };
      if (nickName !== undefined) updateData.nickName = nickName;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
      await users.doc(user._id).update({ data: updateData });
      const updated = await users.doc(user._id).get();
      return res(null, { user: updated.data });
    }

    const newUser = {
      openid,
      nickName: nickName || '',
      avatarUrl: avatarUrl || '',
      createdAt: now,
      updatedAt: now
    };
    const addRes = await users.add({ data: newUser });
    const inserted = await users.doc(addRes._id).get();
    return res(null, { user: inserted.data });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
