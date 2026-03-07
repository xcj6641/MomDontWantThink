/**
 * 云函数 updateTemplate：编辑模板，并同步所有绑定该模板且未 override 的日期
 * 集合：读 templates,week_plans,week_settings；写 templates,week_plans
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MEAL_KEYS = ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner'];

function res(err, data = null) {
  if (err) return { success: false, code: err.code || 'ERROR', message: err.message };
  return { success: true, ...data };
}

function buildDayMealsFromTemplate(tpl, blwByMeal, recipesById) {
  const mealDefByKey = {};
  (tpl.meals || []).forEach(m => { mealDefByKey[m.mealKey] = m; });
  return MEAL_KEYS.map(mealKey => {
    const def = mealDefByKey[mealKey];
    const pool = (def && def.recipeIds) ? def.recipeIds : [];
    const chosenId = pool[0] || '';
    const recipe = chosenId ? recipesById[chosenId] : null;
    return {
      mealKey,
      recipeId: chosenId,
      recipeName: recipe ? recipe.name : '未安排',
      blw: (blwByMeal && blwByMeal[mealKey]) !== false
    };
  });
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  const { templateId, name, meals } = event || {};
  if (!templateId) return res({ code: 'INVALID_INPUT', message: '缺少 templateId' });

  const now = new Date().toISOString();

  try {
    const tRes = await db.collection('templates').doc(templateId).get();
    const template = tRes.data;
    if (!template) return res({ code: 'TEMPLATE_NOT_FOUND', message: '模板不存在' });
    if (template.openid && template.openid !== 'system' && template.openid !== openid) {
      return res({ code: 'FORBIDDEN', message: '无权限修改该模板' });
    }
    if (template.openid === 'system') {
      return res({ code: 'SYSTEM_TEMPLATE_READONLY', message: '系统模板不可编辑' });
    }

    const updateData = { updatedAt: now };
    if (name !== undefined) updateData.name = name;
    if (Array.isArray(meals) && meals.length > 0) updateData.meals = meals;
    await db.collection('templates').doc(templateId).update({ data: updateData });

    const updatedTpl = (await db.collection('templates').doc(templateId).get()).data;
    const recipesById = {};
    (updatedTpl.meals || []).forEach(m => {
      (m.recipeIds || []).forEach(rid => { if (rid) recipesById[rid] = true; });
    });
    const recipeIds = Object.keys(recipesById);
    for (const rid of recipeIds) {
      try {
        const r = await db.collection('recipes').doc(rid).get();
        if (r.data) recipesById[rid] = r.data;
      } catch (_) {}
    }

    const settingsList = await db.collection('week_settings').where({ openid }).get();
    const weekStarts = (settingsList.data || []).map(s => s.weekStartDate).filter(Boolean);
    for (const weekStartDate of weekStarts) {
      const planRes = await db.collection('week_plans').where({ openid, weekStartDate }).get();
      const plan = planRes.data && planRes.data[0] ? planRes.data[0] : null;
      if (!plan || !plan.days) continue;

      const settingsRes = await db.collection('week_settings').where({ openid, weekStartDate }).get();
      const settings = settingsRes.data && settingsRes.data[0] ? settingsRes.data[0] : null;
      const blwByMeal = (settings && settings.blwByMeal) || {};
      const dateAssignments = (settings && settings.dateAssignments) || [];
      const dateToTpl = {};
      dateAssignments.forEach(a => { dateToTpl[a.date] = a.templateId; });
      if (!dateToTpl[plan.days[0].date] && settings && settings.templateId) {
        plan.days.forEach((d, i) => { dateToTpl[d.date] = settings.templateId; });
      }

      let changed = false;
      const newDays = plan.days.map(day => {
        if (day.isOverridden) return day;
        const tplId = dateToTpl[day.date];
        if (tplId !== templateId) return day;
        changed = true;
        return {
          ...day,
          meals: buildDayMealsFromTemplate(updatedTpl, blwByMeal, recipesById)
        };
      });
      if (changed) {
        await db.collection('week_plans').doc(plan._id).update({
          data: { days: newDays, updatedAt: now }
        });
      }
    }

    return res(null, { templateId, message: '已帮你更新模板，绑定该模板的日期已同步' });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
