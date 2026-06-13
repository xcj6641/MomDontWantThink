/**
 * 云函数 generateNextWeek：生成下周计划
 * 默认模板按月龄确定顿数+每餐 BLW，不写死菜单；生成时从 recipes 动态选菜。
 * 集合：读 week_settings,templates,recipes,preferences；写 week_settings,week_plans,shopping_list
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/** 月龄餐数规则：instruction/月龄餐数规则.md；slot: breakfast, lunch, dinner, snack_am, snack_pm */
const SLOT_ORDER = ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner'];
const SLOT_LABELS = { breakfast: '早餐', snack_am: '加餐', lunch: '午餐', snack_pm: '下午加餐', dinner: '晚餐' };
const AGE_BANDS = [
  { min: 0, max: 5, key: '0-5', slots: [] },
  { min: 5, max: 6, key: '5-6', slots: ['lunch'] },
  { min: 6, max: 9, key: '6-9', slots: ['breakfast', 'lunch'] },
  { min: 9, max: 12, key: '9-12', slots: ['breakfast', 'lunch', 'dinner'] },
  { min: 12, max: 999, key: '12+', slots: ['breakfast', 'lunch', 'dinner', 'snack_pm'] },
];
const DEFAULT_BLW = { breakfast: false, snack_am: false, lunch: false, snack_pm: false, dinner: true };

function getAgeBand(months) {
  if (months == null || months < 0) return AGE_BANDS[0];
  for (let i = AGE_BANDS.length - 1; i >= 0; i--) {
    if (months >= AGE_BANDS[i].min && months < AGE_BANDS[i].max) return AGE_BANDS[i];
  }
  return AGE_BANDS[AGE_BANDS.length - 1];
}

function getOrderedSlotsForAge(months) {
  const band = getAgeBand(months);
  const slots = band.slots || [];
  return SLOT_ORDER.filter(s => slots.includes(s));
}

/** mealCountOverride: 1→[lunch] 2→[breakfast,lunch] 3→[breakfast,lunch,dinner] 4→[breakfast,lunch,dinner,snack_pm] */
function getSlotsFromMealCount(n) {
  const map = {
    1: ['lunch'],
    2: ['breakfast', 'lunch'],
    3: ['breakfast', 'lunch', 'dinner'],
    4: ['breakfast', 'lunch', 'dinner', 'snack_pm'],
  };
  return map[n] ? SLOT_ORDER.filter(s => map[n].includes(s)) : null;
}

function getDefaultTemplateForAge(months, now, setIndex) {
  const band = getAgeBand(months);
  const slots = getOrderedSlotsForAge(months);
  const meals = slots.map(mealKey => ({
    mealKey,
    label: SLOT_LABELS[mealKey] || mealKey,
    defaultBlw: DEFAULT_BLW[mealKey] !== false,
    recipeIds: []
  }));
  const name = setIndex != null ? `备餐${setIndex}` : `备餐`;
  return { ageBand: band.key, name, meals };
}

function getMonday(str) {
  const d = new Date(str + 'T12:00:00.000Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** full_reset 固定方案表（与产品一致）：6套为1-1-2-1-1-1 */
function getDefaultDayAssignments(menuCount) {
  const table = {
    1: [1, 1, 1, 1, 1, 1, 1],
    2: [1, 1, 1, 1, 2, 2, 2],
    3: [1, 1, 2, 2, 2, 3, 3],
    4: [1, 1, 2, 2, 3, 3, 4],
    5: [1, 1, 2, 3, 3, 4, 5],
    6: [1, 2, 3, 3, 4, 5, 6],
    7: [1, 2, 3, 4, 5, 6, 7],
  };
  const n = Math.min(7, Math.max(1, Math.floor(Number(menuCount)) || 1));
  return table[n] || table[3];
}

function res(err, data = null) {
  if (err) return { success: false, code: err.code || 'ERROR', message: err.message };
  return { success: true, ...data };
}

/** 检查菜谱是否含过敏食材 */
function hasAllergy(recipe, allergyNames) {
  if (!allergyNames || !Array.isArray(allergyNames) || allergyNames.length === 0) return false;
  const names = (recipe.ingredients || []).map(i => (i.name || '').trim()).filter(Boolean);
  return allergyNames.some(a => names.some(n => n.includes(a) || a.includes(n)));
}

/** 检查菜谱是否含 BLW 不喜欢（用于 BLW 餐） */
function hasBlwDislike(recipe, blwDislikes) {
  if (!blwDislikes || !Array.isArray(blwDislikes) || blwDislikes.length === 0) return false;
  const names = (recipe.ingredients || []).map(i => (i.name || '').trim()).filter(Boolean);
  const name = (recipe.name || '').trim();
  return blwDislikes.some(d => names.some(n => n.includes(d) || (typeof d === 'string' && d.includes(n))) || name.includes(d));
}

/** BLW 喜欢加权：在候选里优先选含 blwLikes 的 */
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

/** 按月龄过滤：只选 ageRangeMonths.min <= babyAgeMonths <= ageRangeMonths.max 的菜谱，无 ageRangeMonths 的视为适用 */
function inAgeRange(recipe, babyAgeMonths) {
  const age = recipe.ageRangeMonths;
  if (!age || babyAgeMonths == null) return true;
  const min = age.min != null ? age.min : 0;
  const max = age.max != null ? age.max : 99;
  return babyAgeMonths >= min && babyAgeMonths <= max;
}

const SLOT_ALIAS = { snack_am: 'morningSnack', snack_pm: 'afternoonSnack' };

/** 菜谱是否支持该餐别：mealTypes 含该 key（或旧字段 morningSnack/afternoonSnack）或无 mealTypes 则通过 */
function supportsMeal(recipe, mealKey) {
  const types = recipe.mealTypes;
  if (!types || !Array.isArray(types) || types.length === 0) return true;
  if (types.includes(mealKey)) return true;
  const alias = SLOT_ALIAS[mealKey];
  return alias ? types.includes(alias) : false;
}

/** BLW 餐只选 isBlwFriendly 为 true 的（无字段视为 true） */
function isBlwOk(recipe, isBlw) {
  if (!isBlw) return true;
  return recipe.isBlwFriendly !== false;
}

/** 从候选池中选一个（排除过敏/BLW 不喜欢、尽量不重复已用 id、BLW 喜欢加权） */
function pickRecipe(candidates, options) {
  const { usedRecipeIds = [], allergyNames = [], blwDislikes = [], blwLikes = [], isBlw = false, babyAgeMonths } = options || {};
  let filtered = candidates.filter(r => r && r._id && !usedRecipeIds.includes(r._id));
  if (babyAgeMonths != null) filtered = filtered.filter(r => inAgeRange(r, babyAgeMonths));
  if (allergyNames.length) filtered = filtered.filter(r => !hasAllergy(r, allergyNames));
  if (isBlw && blwDislikes.length) filtered = filtered.filter(r => !hasBlwDislike(r, blwDislikes));
  if (filtered.length === 0) return null;
  filtered.sort((a, b) => scoreRecipe(b, blwLikes) - scoreRecipe(a, blwLikes));
  return filtered[0] || null;
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  let nextWeekStart = event && event.nextWeekStartDate ? event.nextWeekStartDate : null;
  if (!nextWeekStart) {
    const today = new Date().toISOString().slice(0, 10);
    const thisMon = getMonday(today);
    nextWeekStart = addDays(thisMon, 7);
  } else {
    nextWeekStart = getMonday(nextWeekStart);
  }

  const now = new Date().toISOString();

  try {
    const prefRes = await db.collection('preferences').where({ openid }).get();
    const pref = prefRes.data && prefRes.data[0] ? prefRes.data[0] : {};
    const babyAgeMonths = pref.babyAgeMonths != null ? Number(pref.babyAgeMonths) : null;
    if (babyAgeMonths == null || isNaN(babyAgeMonths) || babyAgeMonths < 0) {
      return res({ code: 'MISSING_BABY_AGE', message: '请先填写宝宝月龄' });
    }

    const planExist = await db.collection('week_plans').where({ openid, weekStartDate: nextWeekStart }).get();
    if (planExist.data && planExist.data.length > 0) {
      return res({ code: 'WEEK_ALREADY_EXISTS', message: '下周计划已存在' });
    }

    const thisMon = addDays(nextWeekStart, -7);
    const lastSettingsRes = await db.collection('week_settings').where({ openid, weekStartDate: thisMon }).get();
    const lastSettings = lastSettingsRes.data && lastSettingsRes.data[0] ? lastSettingsRes.data[0] : null;

    const overrideSlots = pref.mealCountOverride != null ? getSlotsFromMealCount(pref.mealCountOverride) : null;
    const mealSlots = overrideSlots || getOrderedSlotsForAge(babyAgeMonths);
    const band = getAgeBand(babyAgeMonths);
    let dateAssignments = [];
    let blwByMeal = { ...DEFAULT_BLW };
    let defaultTemplateIds = [];

    if (lastSettings) {
      if (lastSettings.dateAssignments && lastSettings.dateAssignments.length === 7) {
        dateAssignments = lastSettings.dateAssignments.map((a, i) => ({
          date: addDays(nextWeekStart, i),
          templateId: a.templateId
        }));
      } else if (lastSettings.templateId) {
        for (let i = 0; i < 7; i++) dateAssignments.push({ date: addDays(nextWeekStart, i), templateId: lastSettings.templateId });
      }
      if (lastSettings.blwByMeal && typeof lastSettings.blwByMeal === 'object') {
        SLOT_ORDER.forEach(k => { if (lastSettings.blwByMeal[k] !== undefined) blwByMeal[k] = lastSettings.blwByMeal[k]; });
        if (lastSettings.blwByMeal.snack1 !== undefined) blwByMeal.snack_am = lastSettings.blwByMeal.snack1;
        if (lastSettings.blwByMeal.snack2 !== undefined) blwByMeal.snack_pm = lastSettings.blwByMeal.snack2;
      }
    }

    if (dateAssignments.length !== 7) {
      const existingTpls = await db.collection('templates').where({ openid: 'system', ageBand: band.key }).get();
      const byIndex = {};
      (existingTpls.data || []).forEach(t => {
        const name = t.name || '';
        const m = name.match(/(\d+)$/) || name.match(/-(\d+)$/);
        if (m) byIndex[m[1]] = t._id;
      });
      const N = 3;
      for (let setIndex = 1; setIndex <= N; setIndex++) {
        if (byIndex[String(setIndex)]) {
          defaultTemplateIds.push(byIndex[String(setIndex)]);
        } else {
          const virtualTpl = getDefaultTemplateForAge(babyAgeMonths, now, setIndex);
          const addRes = await db.collection('templates').add({
            data: {
              openid: 'system',
              ageBand: band.key,
              name: virtualTpl.name,
              meals: virtualTpl.meals,
              createdAt: now,
              updatedAt: now
            }
          });
          defaultTemplateIds.push(addRes._id);
        }
      }
      const defaultAssignments = getDefaultDayAssignments(N);
      for (let i = 0; i < 7; i++) {
        const menuIndex = defaultAssignments[i];
        const tplId = defaultTemplateIds[menuIndex - 1];
        dateAssignments.push({ date: addDays(nextWeekStart, i), templateId: tplId });
      }
    }

    const allergyNames = pref.allergyIngredientNames || [];
    const blwLikes = pref.blwLikes || [];
    const blwDislikes = pref.blwDislikes || [];
    const allergyMode = pref.allergyMode === true;
    const allergyTestingPeriod = Math.max(2, Math.min(3, parseInt(pref.allergyTestingPeriod, 10) || 3));

    const sysRecipes = await db.collection('recipes').where({ openid: 'system' }).limit(300).get();
    const userRecipes = await db.collection('recipes').where({ openid }).limit(200).get();
    const recipeList = [...(sysRecipes.data || []), ...(userRecipes.data || [])];
    const recipesById = {};
    recipeList.forEach(r => { recipesById[r._id] = r; });

    const days = [];
    const usedInWeek = [];

    if (allergyMode) {
      // AllergyMode: block-based scheduling — one new ingredient per block (breakfast slot)
      const statusRes = await db.collection('ingredient_status').where({ openid }).limit(200).get();
      const statusDocs = statusRes.data || [];
      const passedNames = new Set(statusDocs.filter(d => d.status === 'passed').map(d => d.ingredient));
      const pausedNames = new Set(statusDocs.filter(d => d.status === 'paused').map(d => d.ingredient));
      const testingNames = new Set(statusDocs.filter(d => d.status === 'testing').map(d => d.ingredient));

      // Combine paused with allergyNames for filtering
      const allExcludedNames = allergyNames.concat(Array.from(pausedNames));

      // Divide 7 days into blocks
      const blocks = [];
      for (let i = 0; i < 7; i += allergyTestingPeriod) {
        blocks.push({ start: i, end: Math.min(i + allergyTestingPeriod - 1, 6) });
      }

      // For each block, find a recipe whose first ingredient is untested
      const blockBreakfastRecipes = {};
      const assignedTestingIngredients = [];
      for (let bi = 0; bi < blocks.length; bi++) {
        const pool = recipeList.filter(r => supportsMeal(r, 'breakfast') && !hasAllergy(r, allExcludedNames));
        const chosen = pool.find(r => {
          const firstIng = (r.ingredients && r.ingredients[0]) ? (r.ingredients[0].name || '').trim() : '';
          if (!firstIng) return false;
          return !passedNames.has(firstIng) && !pausedNames.has(firstIng) && !testingNames.has(firstIng)
            && !assignedTestingIngredients.includes(firstIng);
        }) || null;
        if (chosen) {
          blockBreakfastRecipes[bi] = chosen;
          const firstIng = (chosen.ingredients[0].name || '').trim();
          assignedTestingIngredients.push(firstIng);
          if (!usedInWeek.includes(chosen._id)) usedInWeek.push(chosen._id);
        }
      }

      // Generate days
      for (let i = 0; i < 7; i++) {
        const date = addDays(nextWeekStart, i);
        const meals = [];
        const blockIndex = blocks.findIndex(b => i >= b.start && i <= b.end);

        for (const mealKey of mealSlots) {
          const isBlw = blwByMeal[mealKey] !== false;
          if (mealKey === 'breakfast' && blockIndex >= 0 && blockBreakfastRecipes[blockIndex]) {
            const chosen = blockBreakfastRecipes[blockIndex];
            const testingDay = i - blocks[blockIndex].start + 1;
            const totalTestingDays = blocks[blockIndex].end - blocks[blockIndex].start + 1;
            meals.push({
              mealKey,
              recipeId: chosen._id,
              recipeName: chosen.name,
              blw: isBlw,
              ingredient: (chosen.ingredients[0] && chosen.ingredients[0].name) ? chosen.ingredients[0].name.trim() : '',
              testingDay,
              totalTestingDays,
            });
          } else {
            const pool = recipeList.filter(r =>
              supportsMeal(r, mealKey) && isBlwOk(r, isBlw) && !hasAllergy(r, allExcludedNames)
            );
            const chosen = pickRecipe(pool, {
              usedRecipeIds: usedInWeek,
              allergyNames: allExcludedNames,
              blwDislikes: isBlw ? blwDislikes : [],
              blwLikes: isBlw ? blwLikes : [],
              babyAgeMonths,
              isBlw
            });
            if (chosen) usedInWeek.push(chosen._id);
            meals.push({
              mealKey,
              recipeId: chosen ? chosen._id : '',
              recipeName: chosen ? chosen.name : '未安排',
              blw: isBlw
            });
          }
        }
        days.push({ date, isOverridden: false, meals });
      }

      // Upsert ingredient_status for newly assigned testing ingredients
      for (let bi = 0; bi < blocks.length; bi++) {
        const recipe = blockBreakfastRecipes[bi];
        if (!recipe) continue;
        const ingredient = (recipe.ingredients[0] && recipe.ingredients[0].name) ? recipe.ingredients[0].name.trim() : '';
        if (!ingredient) continue;
        const totalDays = blocks[bi].end - blocks[bi].start + 1;
        const blockStartDate = addDays(nextWeekStart, blocks[bi].start);
        const existCheck = await db.collection('ingredient_status').where({ openid, ingredient }).get();
        if (existCheck.data && existCheck.data.length > 0) {
          await db.collection('ingredient_status').doc(existCheck.data[0]._id).update({
            data: { status: 'testing', currentDay: 1, totalDays, weekStartDate: nextWeekStart, startDate: blockStartDate, updatedAt: now }
          });
        } else {
          await db.collection('ingredient_status').add({
            data: { openid, ingredient, status: 'testing', currentDay: 1, totalDays, weekStartDate: nextWeekStart, startDate: blockStartDate, observations: [], firstAddedAt: now, updatedAt: now }
          });
        }
      }
    } else {
      // Normal mode generation
      for (let i = 0; i < 7; i++) {
        const date = addDays(nextWeekStart, i);
        const meals = [];
        for (const mealKey of mealSlots) {
          const isBlw = blwByMeal[mealKey] !== false;
          const pool = recipeList.filter(r =>
            supportsMeal(r, mealKey) && isBlwOk(r, isBlw)
          );
          const chosen = pickRecipe(pool, {
            usedRecipeIds: usedInWeek,
            allergyNames,
            blwDislikes: isBlw ? blwDislikes : [],
            blwLikes: isBlw ? blwLikes : [],
            babyAgeMonths,
            isBlw
          });
          if (chosen) usedInWeek.push(chosen._id);
          meals.push({
            mealKey,
            recipeId: chosen ? chosen._id : '',
            recipeName: chosen ? chosen.name : '未安排',
            blw: isBlw
          });
        }
        days.push({ date, isOverridden: false, meals });
      }
    }

    await db.collection('week_settings').add({
      data: {
        openid,
        weekStartDate: nextWeekStart,
        templateId: dateAssignments[0] ? dateAssignments[0].templateId : null,
        dateAssignments,
        blwByMeal,
        confirmed: false,
        createdAt: now,
        updatedAt: now
      }
    });

    const planAdd = await db.collection('week_plans').add({
      data: {
        openid,
        weekStartDate: nextWeekStart,
        days,
        createdAt: now,
        updatedAt: now
      }
    });

    const ingredientMap = {};
    const recipeIdsInPlan = new Set();
    days.forEach(day => {
      (day.meals || []).forEach(m => {
        if (m.recipeId && !recipeIdsInPlan.has(m.recipeId)) recipeIdsInPlan.add(m.recipeId);
      });
    });
    for (const rid of recipeIdsInPlan) {
      const r = recipesById[rid] || (await db.collection('recipes').doc(rid).get()).data;
      if (r && r.ingredients) {
        r.ingredients.forEach(ing => {
          const key = (ing.name || '').trim();
          if (!key) return;
          if (!ingredientMap[key]) ingredientMap[key] = { amount: ing.amount || '', category: r.category || '其他' };
          else if (ing.amount) ingredientMap[key].amount = ingredientMap[key].amount ? ingredientMap[key].amount + '；' + ing.amount : ing.amount;
        });
      }
    }
    const shoppingItems = Object.entries(ingredientMap).map(([name, v]) => ({
      ingredientName: name,
      amount: v.amount || '',
      prepared: false
    }));

    await db.collection('shopping_list').add({
      data: {
        openid,
        weekStartDate: nextWeekStart,
        items: shoppingItems,
        createdAt: now,
        updatedAt: now
      }
    });

    return res(null, {
      weekStartDate: nextWeekStart,
      message: '已帮你生成下周计划，晚餐已默认设为 BLW，记得查看购物清单哦'
    });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
