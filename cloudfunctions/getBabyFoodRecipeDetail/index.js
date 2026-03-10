/**
 * 云函数 getBabyFoodRecipeDetail：菜谱详情页数据，与 docs/baby-food-mock-api.json recipeDetail 结构一致
 * 入参：recipeId（如 recipe_1）
 * 集合：bf_recipes, bf_recipe_steps, bf_recipe_ingredients, bf_ingredients
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function amountDisplay(amountValue, amountText, unit) {
  if (amountText) return amountText;
  return (amountValue != null ? amountValue : '') + (unit || '');
}

exports.main = async (event, context) => {
  const { recipeId } = event || {};
  if (!recipeId) return { success: false, message: '缺少 recipeId' };

  try {
    const recipeRes = await db.collection('bf_recipes').doc(recipeId).get();
    if (!recipeRes.data) return { success: false, message: '菜谱不存在' };
    const recipe = recipeRes.data;

    const [stepsRes, riRes] = await Promise.all([
      db.collection('bf_recipe_steps').where({ recipeId }).orderBy('stepNo', 'asc').get(),
      db.collection('bf_recipe_ingredients').where({ recipeId }).orderBy('sortOrder', 'asc').get()
    ]);

    const steps = (stepsRes.data || []).map(s => ({ stepNo: s.stepNo, content: s.content }));
    const riList = riRes.data || [];
    const ingIds = [...new Set(riList.map(r => r.ingredientId))];
    const ingMap = {};
    if (ingIds.length > 0) {
      const ingRes = await db.collection('bf_ingredients').where({ _id: db.command.in(ingIds) }).get();
      (ingRes.data || []).forEach(i => { ingMap[i._id] = i; });
    }

    const ingredients = riList.map(ri => {
      const ing = ingMap[ri.ingredientId] || {};
      const display = amountDisplay(ri.amountValue, ri.amountText, ri.unit);
      return {
        name: ing.name,
        amountValue: ri.amountValue,
        amountText: ri.amountText,
        unit: ri.unit,
        amountDisplay: display,
        ingredientRole: ri.ingredientRole,
        weekendPrepType: ri.weekendPrepType,
        dailyPrepType: ri.dailyPrepType
      };
    });

    const weekend = [];
    const dayBefore = [];
    riList.forEach(ri => {
      const ing = ingMap[ri.ingredientId] || {};
      const display = amountDisplay(ri.amountValue, ri.amountText, ri.unit);
      if (ri.weekendPrepType && ri.weekendPrepType !== 'none') {
        weekend.push(`${ing.name} ${display} ${ri.weekendPrepType === 'frozen_puree' ? '打成泥冷冻' : ri.weekendPrepType === 'frozen_minced' ? '剁碎冷冻' : ri.weekendPrepType}`);
      }
      if (ri.dailyPrepType && ri.dailyPrepType !== 'none') {
        dayBefore.push(`${ing.name} ${display} ${ri.dailyPrepType === 'porridge_night_before' ? '提前煮粥' : ri.dailyPrepType === 'thaw' ? '解冻' : ri.dailyPrepType}`);
      }
    });

    return {
      success: true,
      data: {
        basic: {
          id: recipe._id,
          name: recipe.name,
          stage: recipe.stage,
          ageMonthMin: recipe.ageMonthMin,
          ageMonthMax: recipe.ageMonthMax,
          type: recipe.type,
          texture: recipe.texture,
          description: recipe.description
        },
        steps,
        ingredients,
        prepSummary: { weekend, dayBefore }
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
};
