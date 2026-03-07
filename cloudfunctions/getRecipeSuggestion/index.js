/**
 * 云函数 getRecipeSuggestion：为单餐“换一个”返回一条候选菜谱
 * 入参：mealKey, babyAgeMonths, isBlw?, excludeRecipeIds?, allergyIngredientNames?, blwDislikes?, blwLikes?
 * 集合：读 preferences, recipes
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SLOT_ALIAS = { snack_am: 'morningSnack', snack_pm: 'afternoonSnack' };

function inAgeRange(recipe, babyAgeMonths) {
  const age = recipe.ageRangeMonths;
  if (!age || babyAgeMonths == null) return true;
  const min = age.min != null ? age.min : 0;
  const max = age.max != null ? age.max : 99;
  return babyAgeMonths >= min && babyAgeMonths <= max;
}

function supportsMeal(recipe, mealKey) {
  const types = recipe.mealTypes;
  if (!types || !Array.isArray(types) || types.length === 0) return true;
  if (types.includes(mealKey)) return true;
  const alias = SLOT_ALIAS[mealKey];
  return alias ? types.includes(alias) : false;
}

function isBlwOk(recipe, isBlw) {
  if (!isBlw) return true;
  return recipe.isBlwFriendly !== false;
}

function hasAllergy(recipe, allergyNames) {
  if (!allergyNames || !Array.isArray(allergyNames) || allergyNames.length === 0) return false;
  const names = (recipe.ingredients || []).map(i => (i.name || '').trim()).filter(Boolean);
  return allergyNames.some(a => names.some(n => n.includes(a) || a.includes(n)));
}

function hasBlwDislike(recipe, blwDislikes) {
  if (!blwDislikes || !Array.isArray(blwDislikes) || blwDislikes.length === 0) return false;
  const names = (recipe.ingredients || []).map(i => (i.name || '').trim()).filter(Boolean);
  const name = (recipe.name || '').trim();
  return blwDislikes.some(d => names.some(n => n.includes(d) || (typeof d === 'string' && d.includes(n))) || name.includes(d));
}

function scoreRecipe(recipe, blwLikes) {
  if (!blwLikes || !Array.isArray(blwLikes) || blwLikes.length === 0) return 0;
  const names = (recipe.ingredients || []).map(i => (i.name || '').trim()).filter(Boolean);
  const name = (recipe.name || '').trim();
  let s = 0;
  blwLikes.forEach(l => {
    if (names.some(n => n.includes(l) || (typeof l === 'string' && l.includes(n)))) s += 2;
    if (name.includes(l)) s += 1;
  });
  return s;
}

function res(err, data = null) {
  if (err) return { success: false, code: err.code || 'ERROR', message: err.message };
  return { success: true, ...data };
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  const { mealKey, babyAgeMonths, isBlw, excludeRecipeIds, allergyIngredientNames, blwDislikes, blwLikes } = event || {};
  if (!mealKey) return res({ code: 'INVALID_INPUT', message: '缺少 mealKey' });

  const exclude = Array.isArray(excludeRecipeIds) ? excludeRecipeIds : [];
  const isBlwMeal = !!isBlw;

  try {
    const [prefRes, sysRes, userRes] = await Promise.all([
      db.collection('preferences').where({ openid }).get(),
      db.collection('recipes').where({ openid: 'system' }).limit(200).get(),
      db.collection('recipes').where({ openid }).limit(100).get()
    ]);
    const pref = prefRes.data && prefRes.data[0] ? prefRes.data[0] : {};
    const allergyNames = allergyIngredientNames || pref.allergyIngredientNames || [];
    const dislikes = blwDislikes || pref.blwDislikes || [];
    const likes = blwLikes || pref.blwLikes || [];
    const age = babyAgeMonths != null ? Number(babyAgeMonths) : (pref.babyAgeMonths != null ? Number(pref.babyAgeMonths) : null);

    const recipeList = [...(sysRes.data || []), ...(userRes.data || [])];
    let pool = recipeList.filter(r => r && r._id && !exclude.includes(r._id));
    if (age != null) pool = pool.filter(r => inAgeRange(r, age));
    pool = pool.filter(r => supportsMeal(r, mealKey) && isBlwOk(r, isBlwMeal));
    if (allergyNames.length) pool = pool.filter(r => !hasAllergy(r, allergyNames));
    if (isBlwMeal && dislikes.length) pool = pool.filter(r => !hasBlwDislike(r, dislikes));
    if (pool.length === 0) return res(null, { recipe: null, message: '暂无可替换的菜谱' });
    pool.sort((a, b) => scoreRecipe(b, likes) - scoreRecipe(a, likes));
    const recipe = pool[0];
    return res(null, {
      recipe: { _id: recipe._id, name: recipe.name || '' },
      message: '已为你选好一道'
    });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
