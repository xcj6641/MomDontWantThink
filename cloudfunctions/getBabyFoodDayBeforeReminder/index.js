/**
 * 云函数 getBabyFoodDayBeforeReminder：前一天提醒页数据，与 docs/baby-food-mock-api.json dayBeforeReminder 结构一致
 * 入参：planId, date, mealType（如 plan_1, 2025-03-04, lunch）
 * 集合：bf_menu_plan_items, bf_recipes, bf_recipe_ingredients, bf_ingredients, bf_prep_definitions
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MEAL_LABELS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack_am: '加餐', snack_pm: '下午加餐' };

function amountDisplay(amountValue, amountText, unit) {
  if (amountText) return amountText;
  return (amountValue != null ? amountValue : '') + (unit || '');
}

exports.main = async (event, context) => {
  const { planId, date, mealType } = event || {};
  if (!planId || !date || !mealType) return { success: false, message: '缺少 planId / date / mealType' };

  try {
    const mpiRes = await db.collection('bf_menu_plan_items').where({ planId, date, mealType, status: 'planned' }).get();
    const mpiList = mpiRes.data || [];
    if (mpiList.length === 0) {
      return { success: true, data: { planId, date, mealType, mealTypeLabel: MEAL_LABELS[mealType] || mealType, recipeName: null, items: [], userFriendlyCopy: { short: '', list: [], grouped: [] } } };
    }

    const mpi = mpiList[0];
    const recipeRes = await db.collection('bf_recipes').doc(mpi.recipeId).get();
    const recipe = recipeRes.data || {};
    const riRes = await db.collection('bf_recipe_ingredients').where({ recipeId: mpi.recipeId, dailyPrepType: db.command.neq('none') }).orderBy('sortOrder', 'asc').get();
    const riList = riRes.data || [];
    const ingIds = [...new Set(riList.map(r => r.ingredientId))];
    let ingMap = {};
    if (ingIds.length > 0) {
      const ingRes = await db.collection('bf_ingredients').where({ _id: db.command.in(ingIds) }).get();
      (ingRes.data || []).forEach(i => { ingMap[i._id] = i; });
    }
    const prepRes = await db.collection('bf_prep_definitions').where({ phase: 'daily' }).get();
    const prepMap = {};
    (prepRes.data || []).forEach(p => { prepMap[p.code] = p; });

    const items = riList.map(ri => {
      const ing = ingMap[ri.ingredientId] || {};
      const prep = prepMap[ri.dailyPrepType] || {};
      return {
        ingredientName: ing.name,
        amountDisplay: amountDisplay(ri.amountValue, ri.amountText, ri.unit),
        dailyPrepType: ri.dailyPrepType,
        dailyPrepLabel: prep.label || ri.dailyPrepType,
        dailyActionText: prep.actionText || ''
      };
    });

    const list = [];
    list.push(`明天${MEAL_LABELS[mealType] || mealType}做「${recipe.name}」`);
    items.forEach(it => {
      list.push(`前一晚：${it.ingredientName} ${it.amountDisplay} ${it.dailyActionText || it.dailyPrepLabel}`);
    });
    const short = `明天${MEAL_LABELS[mealType] || mealType}：${recipe.name}。前一晚需：` + items.map(it => `${it.ingredientName} ${it.amountDisplay} ${it.dailyPrepLabel}`).join('；') + '。';

    const grouped = [];
    const labelSet = new Set();
    items.forEach(it => {
      if (labelSet.has(it.dailyPrepLabel)) return;
      labelSet.add(it.dailyPrepLabel);
      const same = items.filter(i => i.dailyPrepLabel === it.dailyPrepLabel);
      const first = same[0];
      const prep = first && first.dailyPrepType ? prepMap[first.dailyPrepType] : {};
      grouped.push({
        dailyPrepLabel: it.dailyPrepLabel,
        dailyActionText: (prep && prep.actionText) || '',
        items: same.map(i => ({ ingredientName: i.ingredientName, amountDisplay: i.amountDisplay }))
      });
    });

    return {
      success: true,
      data: {
        planId,
        date,
        mealType,
        mealTypeLabel: MEAL_LABELS[mealType] || mealType,
        recipeName: recipe.name,
        items,
        userFriendlyCopy: { short, list, grouped }
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
};
