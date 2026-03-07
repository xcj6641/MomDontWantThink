/**
 * 云函数 toggleShoppingItem：勾选/取消勾选某条购物项
 * 集合：shopping_list（写）
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

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  const { weekStartDate: rawWeek, ingredientName, prepared } = event || {};
  if (!rawWeek || !ingredientName) return res({ code: 'INVALID_INPUT', message: '缺少 weekStartDate 或 ingredientName' });

  const weekStartDate = getMonday(rawWeek);

  try {
    const shopRes = await db.collection('shopping_list').where({ openid, weekStartDate }).get();
    const shop = shopRes.data && shopRes.data[0] ? shopRes.data[0] : null;
    if (!shop || !shop.items || !Array.isArray(shop.items)) {
      return res({ code: 'ITEM_NOT_FOUND', message: '该周暂无购物清单' });
    }
    const idx = shop.items.findIndex((it) => (it.ingredientName || '').trim() === (ingredientName || '').trim());
    if (idx < 0) return res({ code: 'ITEM_NOT_FOUND', message: '未找到该食材' });

    const items = shop.items.map((it, i) => (i === idx ? { ...it, prepared: !!prepared } : it));
    await db.collection('shopping_list').doc(shop._id).update({
      data: { items, updatedAt: new Date().toISOString() }
    });

    const preparedCount = items.filter((it) => it.prepared).length;
    const totalCount = items.length;
    return res(null, {
      ingredientName: shop.items[idx].ingredientName,
      prepared: !!prepared,
      summary: { preparedCount, totalCount }
    });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
