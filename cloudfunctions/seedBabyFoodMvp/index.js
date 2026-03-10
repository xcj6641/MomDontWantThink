/**
 * 云函数 seedBabyFoodMvp：向腾讯云开发数据库插入宝宝辅食 MVP 最小测试集
 * 集合：bf_prep_definitions, bf_ingredients, bf_recipes, bf_recipe_steps, bf_recipe_ingredients, bf_menu_plans, bf_menu_plan_items
 * 与 docs/baby-food-database-seed.sql、baby-food-mock-api.json、baby-food-database-query-results.md 一致
 * 用法：云端部署后，在控制台或小程序内调用一次即可；已插入过则跳过（根据 bf_recipes 是否有数据判断）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const now = new Date().toISOString();

const PREP_DEFINITIONS = [
  { _id: 'weekend_none', phase: 'weekend', code: 'none', label: '无需周末备菜', actionText: null, storage: null, isDefault: true, sortOrder: 0, createdAt: now },
  { _id: 'weekend_shopping_only', phase: 'weekend', code: 'shopping_only', label: '仅采购', actionText: '周末采购即可', storage: '常温/冷藏', isDefault: false, sortOrder: 1, createdAt: now },
  { _id: 'weekend_refrigerated_cut', phase: 'weekend', code: 'refrigerated_cut', label: '切好冷藏', actionText: '洗净切好密封冷藏', storage: '冷藏 1–2 天', isDefault: false, sortOrder: 2, createdAt: now },
  { _id: 'weekend_frozen_chopped', phase: 'weekend', code: 'frozen_chopped', label: '切块冷冻', actionText: '切块分装冷冻', storage: '冷冻', isDefault: false, sortOrder: 3, createdAt: now },
  { _id: 'weekend_frozen_puree', phase: 'weekend', code: 'frozen_puree', label: '打成泥冷冻', actionText: '蒸熟打泥分格冷冻', storage: '冷冻', isDefault: false, sortOrder: 4, createdAt: now },
  { _id: 'weekend_frozen_minced', phase: 'weekend', code: 'frozen_minced', label: '剁碎冷冻', actionText: '剁碎分装冷冻', storage: '冷冻', isDefault: false, sortOrder: 5, createdAt: now },
  { _id: 'daily_none', phase: 'daily', code: 'none', label: '无需提前处理', actionText: null, storage: null, isDefault: true, sortOrder: 0, createdAt: now },
  { _id: 'daily_thaw', phase: 'daily', code: 'thaw', label: '解冻', actionText: '前一晚放入冷藏解冻', storage: null, isDefault: false, sortOrder: 1, createdAt: now },
  { _id: 'daily_blanch_chop_refrigerate', phase: 'daily', code: 'blanch_chop_refrigerate', label: '焯熟剁碎冷藏', actionText: '焯水后剁碎密封冷藏', storage: '冷藏', isDefault: false, sortOrder: 2, createdAt: now },
  { _id: 'daily_cook_refrigerate', phase: 'daily', code: 'cook_refrigerate', label: '煮熟冷藏', actionText: '提前煮熟密封冷藏', storage: '冷藏', isDefault: false, sortOrder: 3, createdAt: now },
  { _id: 'daily_porridge_night_before', phase: 'daily', code: 'porridge_night_before', label: '提前煮粥', actionText: '前一晚煮好保温/冷藏', storage: null, isDefault: false, sortOrder: 4, createdAt: now },
  { _id: 'daily_porridge_timer', phase: 'daily', code: 'porridge_timer', label: '预约煮粥', actionText: '预约第二天早上煮好', storage: null, isDefault: false, sortOrder: 5, createdAt: now }
];

const INGREDIENTS = [
  { _id: 'ingredient_1', name: '大米', category: 'grain', defaultUnit: 'g', isActive: true, createdAt: now, updatedAt: now },
  { _id: 'ingredient_2', name: '胡萝卜', category: 'vegetable', defaultUnit: 'g', isActive: true, createdAt: now, updatedAt: now },
  { _id: 'ingredient_3', name: '鸡胸肉', category: 'meat', defaultUnit: 'g', isActive: true, createdAt: now, updatedAt: now },
  { _id: 'ingredient_4', name: '西兰花', category: 'vegetable', defaultUnit: 'g', isActive: true, createdAt: now, updatedAt: now },
  { _id: 'ingredient_5', name: '土豆', category: 'vegetable', defaultUnit: 'g', isActive: true, createdAt: now, updatedAt: now }
];

const RECIPES = [
  { _id: 'recipe_1', name: '胡萝卜鸡肉粥', stage: 2, ageMonthMin: 6, ageMonthMax: 7, type: 'porridge', texture: 'porridge', description: '适合 6–7 月龄的软烂粥品', isActive: true, createdAt: now, updatedAt: now },
  { _id: 'recipe_2', name: '西兰花土豆泥', stage: 1, ageMonthMin: 4, ageMonthMax: 5, type: 'puree', texture: 'puree', description: '适合 4–5 月龄的细腻菜泥', isActive: true, createdAt: now, updatedAt: now }
];

const RECIPE_STEPS = [
  { recipeId: 'recipe_1', stepNo: 1, content: '大米淘净，加约 6 倍水浸泡 30 分钟。', createdAt: now },
  { recipeId: 'recipe_1', stepNo: 2, content: '胡萝卜去皮切小丁，鸡胸肉剁成泥。', createdAt: now },
  { recipeId: 'recipe_1', stepNo: 3, content: '将米、胡萝卜丁、鸡肉泥一起放入锅中，大火煮开后转小火熬至软烂。', createdAt: now },
  { recipeId: 'recipe_2', stepNo: 1, content: '西兰花取花朵部分，土豆去皮切块。', createdAt: now },
  { recipeId: 'recipe_2', stepNo: 2, content: '上锅蒸约 15 分钟至软烂。', createdAt: now },
  { recipeId: 'recipe_2', stepNo: 3, content: '放入料理机打成细腻泥状，可加少量温水调节稠度。', createdAt: now }
];

const RECIPE_INGREDIENTS = [
  { recipeId: 'recipe_1', ingredientId: 'ingredient_1', amountValue: 30, amountText: null, unit: 'g', ingredientRole: 'base', weekendPrepType: 'none', dailyPrepType: 'porridge_night_before', sortOrder: 1, createdAt: now, updatedAt: now },
  { recipeId: 'recipe_1', ingredientId: 'ingredient_2', amountValue: 20, amountText: null, unit: 'g', ingredientRole: 'vegetable', weekendPrepType: 'frozen_puree', dailyPrepType: 'thaw', sortOrder: 2, createdAt: now, updatedAt: now },
  { recipeId: 'recipe_1', ingredientId: 'ingredient_3', amountValue: 25, amountText: null, unit: 'g', ingredientRole: 'protein', weekendPrepType: 'frozen_minced', dailyPrepType: 'thaw', sortOrder: 3, createdAt: now, updatedAt: now },
  { recipeId: 'recipe_2', ingredientId: 'ingredient_4', amountValue: 20, amountText: null, unit: 'g', ingredientRole: 'vegetable', weekendPrepType: 'frozen_puree', dailyPrepType: 'thaw', sortOrder: 1, createdAt: now, updatedAt: now },
  { recipeId: 'recipe_2', ingredientId: 'ingredient_5', amountValue: 50, amountText: null, unit: 'g', ingredientRole: 'vegetable', weekendPrepType: 'frozen_puree', dailyPrepType: 'thaw', sortOrder: 2, createdAt: now, updatedAt: now }
];

const MENU_PLANS = [
  { _id: 'plan_1', userId: 'test_openid_001', weekStartDate: '2025-03-03', createdAt: now, updatedAt: now }
];

const MENU_PLAN_ITEMS = [
  { planId: 'plan_1', date: '2025-03-03', mealType: 'lunch', recipeId: 'recipe_1', status: 'planned', createdAt: now, updatedAt: now },
  { planId: 'plan_1', date: '2025-03-03', mealType: 'dinner', recipeId: 'recipe_2', status: 'planned', createdAt: now, updatedAt: now },
  { planId: 'plan_1', date: '2025-03-04', mealType: 'lunch', recipeId: 'recipe_1', status: 'planned', createdAt: now, updatedAt: now }
];

async function seedCollection(name, docs, options = {}) {
  const col = db.collection(name);
  if (options.checkExists && options.checkExists.length > 0) {
    const exist = await col.limit(1).get();
    if (exist.data && exist.data.length > 0) return { skipped: true, name };
  }
  for (const doc of docs) {
    if (doc._id) {
      await col.add({ data: doc });
    } else {
      await col.add({ data: doc });
    }
  }
  return { skipped: false, name, count: docs.length };
}

exports.main = async (event, context) => {
  const force = event && event.force === true;
  try {
    const recipesExist = await db.collection('bf_recipes').limit(1).get();
    if (!force && recipesExist.data && recipesExist.data.length > 0) {
      return { success: true, message: '已存在 MVP 数据，跳过插入。传入 { force: true } 可清空后重新插入（需自行清空集合）。', seeded: false };
    }

    const prepCol = db.collection('bf_prep_definitions');
    for (const doc of PREP_DEFINITIONS) {
      await prepCol.add({ data: doc });
    }

    const ingCol = db.collection('bf_ingredients');
    for (const doc of INGREDIENTS) {
      await ingCol.add({ data: doc });
    }

    const recCol = db.collection('bf_recipes');
    for (const doc of RECIPES) {
      await recCol.add({ data: doc });
    }

    const stepCol = db.collection('bf_recipe_steps');
    for (const doc of RECIPE_STEPS) {
      await stepCol.add({ data: doc });
    }

    const riCol = db.collection('bf_recipe_ingredients');
    for (const doc of RECIPE_INGREDIENTS) {
      await riCol.add({ data: doc });
    }

    const planCol = db.collection('bf_menu_plans');
    for (const doc of MENU_PLANS) {
      await planCol.add({ data: doc });
    }

    const itemCol = db.collection('bf_menu_plan_items');
    for (const doc of MENU_PLAN_ITEMS) {
      await itemCol.add({ data: doc });
    }

    return {
      success: true,
      message: 'MVP 测试数据插入完成',
      seeded: true,
      counts: {
        bf_prep_definitions: PREP_DEFINITIONS.length,
        bf_ingredients: INGREDIENTS.length,
        bf_recipes: RECIPES.length,
        bf_recipe_steps: RECIPE_STEPS.length,
        bf_recipe_ingredients: RECIPE_INGREDIENTS.length,
        bf_menu_plans: MENU_PLANS.length,
        bf_menu_plan_items: MENU_PLAN_ITEMS.length
      }
    };
  } catch (e) {
    return { success: false, message: e.message, error: e.toString() };
  }
};
