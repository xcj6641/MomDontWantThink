/**
 * 云函数 getBabyFoodWeekendPrep：周末备菜页数据，按处理方式分组，与 docs/baby-food-mock-api.json weekendPrep 结构一致
 * 入参：planId（如 plan_1）
 * 集合：bf_menu_plan_items, bf_recipes, bf_recipe_ingredients, bf_ingredients, bf_prep_definitions
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const _ = db.command;

exports.main = async (event, context) => {
  const { planId } = event || {};
  if (!planId) return { success: false, message: '缺少 planId' };

  try {
    const itemsRes = await db.collection('bf_menu_plan_items').where({ planId, status: 'planned' }).get();
    const items = itemsRes.data || [];
    if (items.length === 0) {
      return { success: true, data: { planId, groupByPrepType: [] } };
    }

    const recipeIds = [...new Set(items.map(i => i.recipeId))];
    const riRes = await db.collection('bf_recipe_ingredients').where({ recipeId: _.in(recipeIds), weekendPrepType: _.neq('none') }).get();
    const riList = riRes.data || [];
    const ingIds = [...new Set(riList.map(r => r.ingredientId))];
    let ingMap = {};
    if (ingIds.length > 0) {
      const ingRes = await db.collection('bf_ingredients').where({ _id: _.in(ingIds) }).get();
      (ingRes.data || []).forEach(i => { ingMap[i._id] = i; });
    }

    const prepRes = await db.collection('bf_prep_definitions').where({ phase: 'weekend' }).orderBy('sortOrder', 'asc').get();
    const prepList = prepRes.data || [];

    const byKey = {};
    items.forEach(mpi => {
      riList.filter(ri => ri.recipeId === mpi.recipeId).forEach(ri => {
        const key = `${ri.ingredientId}_${ri.weekendPrepType}_${ri.unit}`;
        if (!byKey[key]) {
          byKey[key] = { ingredientId: ri.ingredientId, weekendPrepType: ri.weekendPrepType, unit: ri.unit, totalAmountValue: 0, planItemCount: 0, recipeIds: new Set() };
        }
        byKey[key].totalAmountValue += ri.amountValue || 0;
        byKey[key].planItemCount += 1;
        byKey[key].recipeIds.add(mpi.recipeId);
      });
    });

    const byPrep = {};
    Object.values(byKey).forEach(agg => {
      const code = agg.weekendPrepType;
      if (!byPrep[code]) byPrep[code] = [];
      const ing = ingMap[agg.ingredientId] || {};
      byPrep[code].push({
        ingredientName: ing.name,
        totalAmountValue: agg.totalAmountValue,
        unit: agg.unit,
        amountDisplay: (agg.totalAmountValue || '') + (agg.unit || ''),
        distinctRecipeCount: agg.recipeIds.size,
        planItemCount: agg.planItemCount
      });
    });

    const groupByPrepType = prepList
      .filter(p => byPrep[p.code] && byPrep[p.code].length > 0)
      .map(p => ({
        weekendPrepCode: p.code,
        weekendPrepLabel: p.label,
        actionText: p.actionText,
        storage: p.storage,
        items: byPrep[p.code]
      }));

    return { success: true, data: { planId, groupByPrepType } };
  } catch (e) {
    return { success: false, message: e.message };
  }
};
