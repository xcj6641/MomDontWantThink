/**
 * 云函数 buildShoppingList：按最终菜单（含 override）汇总食材，返回分类 + 已备 X/共 Y
 * 每周重置时 prepared 全 false。分类：蛋白/蔬菜/水果/主食/其他
 * 集合：读 week_plans,recipes；写 shopping_list
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const CATEGORY_MAP = {
  '肉蛋': '蛋白',
  '蛋': '蛋白',
  '肉': '蛋白',
  '鱼': '蛋白',
  '豆': '蛋白',
  '蛋白': '蛋白',
  '蔬菜': '蔬菜',
  '水果': '水果',
  '主食': '主食'
};

function getCategory(recipeCategory) {
  if (!recipeCategory) return '其他';
  const s = (recipeCategory || '').trim();
  return CATEGORY_MAP[s] || CATEGORY_MAP[s.replace(/\s/g, '')] || '其他';
}

function res(err, data = null) {
  if (err) return { success: false, code: err.code || 'ERROR', message: err.message };
  return { success: true, ...data };
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  const { weekStartDate: rawWeek, resetPrepared } = event || {};
  if (!rawWeek) return res({ code: 'INVALID_INPUT', message: '缺少 weekStartDate' });

  const d = new Date(rawWeek + 'T12:00:00.000Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  const weekStartDate = d.toISOString().slice(0, 10);
  const now = new Date().toISOString();

  try {
    const planRes = await db.collection('week_plans').where({ openid, weekStartDate }).get();
    const plan = planRes.data && planRes.data[0] ? planRes.data[0] : null;
    if (!plan || !plan.days) {
      return res({ code: 'NO_WEEK_PLAN', message: '该周暂无计划', summary: { preparedCount: 0, totalCount: 0 }, itemsByCategory: {}, flatItems: [] });
    }

    const recipeIds = new Set();
    (plan.days || []).forEach(day => {
      (day.meals || []).forEach(m => { if (m.recipeId) recipeIds.add(m.recipeId); });
    });
    const recipesById = {};
    for (const rid of recipeIds) {
      try {
        const r = await db.collection('recipes').doc(rid).get();
        if (r.data) recipesById[rid] = r.data;
      } catch (_) {}
    }

    const agg = {};
    (plan.days || []).forEach(day => {
      (day.meals || []).forEach(m => {
        if (!m.recipeId) return;
        const recipe = recipesById[m.recipeId];
        if (!recipe || !recipe.ingredients) return;
        recipe.ingredients.forEach(ing => {
          const name = (ing.name || '').trim();
          if (!name) return;
          const cat = getCategory(recipe.category);
          if (!agg[name]) agg[name] = { amount: '', category: cat, prepared: false };
          else if (ing.amount) agg[name].amount = agg[name].amount ? agg[name].amount + '；' + ing.amount : ing.amount;
        });
      });
    });

    let shopRes = await db.collection('shopping_list').where({ openid, weekStartDate }).get();
    let shop = shopRes.data && shopRes.data[0] ? shopRes.data[0] : null;
    const existingPrepared = {};
    if (shop && shop.items && !resetPrepared) {
      shop.items.forEach(it => { existingPrepared[it.ingredientName] = it.prepared === true; });
    }
    if (resetPrepared && shop) {
      const items = (shop.items || []).map(it => ({ ...it, prepared: false }));
      await db.collection('shopping_list').doc(shop._id).update({
        data: { items, updatedAt: now }
      });
      shop = { ...shop, items };
    }

    const flatItems = Object.entries(agg).map(([ingredientName, v]) => ({
      ingredientName,
      amount: v.amount || '',
      prepared: resetPrepared ? false : (existingPrepared[ingredientName] === true),
      category: v.category
    }));

    if (!shop && Object.keys(agg).length > 0) {
      const items = flatItems.map(it => ({ ingredientName: it.ingredientName, amount: it.amount, prepared: false }));
      await db.collection('shopping_list').add({
        data: { openid, weekStartDate, items, createdAt: now, updatedAt: now }
      });
    } else if (shop) {
      const items = flatItems.map(it => ({
        ingredientName: it.ingredientName,
        amount: it.amount,
        prepared: resetPrepared ? false : (existingPrepared[it.ingredientName] === true)
      }));
      await db.collection('shopping_list').doc(shop._id).update({
        data: { items, updatedAt: now }
      });
      flatItems.forEach((it, i) => { it.prepared = items[i].prepared; });
    }

    const itemsByCategory = {};
    flatItems.forEach(it => {
      const cat = it.category || '其他';
      if (!itemsByCategory[cat]) itemsByCategory[cat] = [];
      itemsByCategory[cat].push({ ingredientName: it.ingredientName, amount: it.amount, prepared: it.prepared });
    });
    const preparedCount = flatItems.filter(it => it.prepared).length;
    const totalCount = flatItems.length;

    return res(null, {
      weekStartDate,
      summary: { preparedCount, totalCount },
      itemsByCategory,
      flatItems
    });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
