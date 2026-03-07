/**
 * 云函数 updateWeekSettings：更新周设置（N 套模板 + 日期分配）
 * 空白天校验；autoAssign 自动均匀分配；N 变小时被删模板的日期均匀分给剩余；保留单日 overrides
 * 集合：读 week_settings,week_plans,templates；写 week_settings,week_plans
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MEAL_KEYS = ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner'];

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

function res(err, data = null) {
  if (err) return { success: false, code: err.code || 'ERROR', message: err.message };
  return { success: true, ...data };
}

function normalizeDayBindings(dayBindings) {
  if (Array.isArray(dayBindings) && dayBindings.length >= 7) return dayBindings.slice(0, 7);
  if (dayBindings && typeof dayBindings === 'object' && !Array.isArray(dayBindings)) {
    return Array.from({ length: 7 }, (_, i) => {
      const v = dayBindings[i];
      const n = typeof v === 'number' ? v : parseInt(v, 10);
      return Number.isNaN(n) ? 0 : n;
    });
  }
  return [];
}

/** 用模板生成一天的 5 餐结构（仅模板内容，blw 从 blwByMeal 来） */
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
      blw: blwByMeal[mealKey] !== false
    };
  });
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return res({ code: 'NO_OPENID', message: '无法获取用户标识' });

  const payload = event && (event.data != null ? event.data : event) || {};
  const { weekStartDate: rawWeek, dateAssignments, dayBindings, N: reqNRaw, templateIds: reqTemplateIds, blwByMeal, autoAssign } = payload;
  const reqN = Math.min(7, Math.max(1, Number(reqNRaw) || 0));
  if (!rawWeek) return res({ code: 'INVALID_INPUT', message: '缺少 weekStartDate' });

  const weekStartDate = getMonday(rawWeek);
  const now = new Date().toISOString();

  try {
    const planRes = await db.collection('week_plans').where({ openid, weekStartDate }).get();
    const plan = planRes.data && planRes.data[0] ? planRes.data[0] : null;
    if (!plan || !plan.days || plan.days.length !== 7) {
      return res({ code: 'NO_WEEK_PLAN', message: '该周暂无计划，请先生成' });
    }

    const expectDates = [];
    for (let i = 0; i < 7; i++) expectDates.push(addDays(weekStartDate, i));

    const settingsRes = await db.collection('week_settings').where({ openid, weekStartDate }).get();
    const oldSettings = settingsRes.data && settingsRes.data[0] ? settingsRes.data[0] : null;
    const oldAssignments = (oldSettings && oldSettings.dateAssignments) || [];

    let assignments = [];
    let builtFromDayBindings = false;
    const dayBindingsArr = normalizeDayBindings(dayBindings);
    if (dayBindingsArr.length >= 7 && reqN >= 1 && reqN <= 7) {
      let tplIds = Array.isArray(reqTemplateIds) ? reqTemplateIds.filter(Boolean) : [];
      if (tplIds.length === 0 && oldAssignments.length) {
        tplIds = [...new Set(oldAssignments.map(a => a.templateId).filter(Boolean))];
      }
      while (tplIds.length < reqN) {
        const firstId = tplIds[0];
        if (!firstId) break;
        const first = await db.collection('templates').doc(firstId).get();
        if (!first.data) break;
        const clone = { ...first.data };
        delete clone._id;
        clone.name = `备餐${tplIds.length + 1}`;
        clone.openid = clone.openid || 'system';
        clone.createdAt = now;
        clone.updatedAt = now;
        const addRes = await db.collection('templates').add({ data: clone });
        tplIds.push(addRes._id);
      }
      tplIds = tplIds.slice(0, reqN);
      for (let day = 1; day <= 7; day++) {
        const idx = day - 1;
        const v = dayBindingsArr[idx];
        const ti = typeof v === 'number' ? v : parseInt(v, 10);
        if (!Number.isNaN(ti) && ti >= 1 && ti <= tplIds.length) {
          assignments.push({ date: expectDates[idx], templateId: tplIds[ti - 1] });
        }
      }
      if (assignments.length === 7) builtFromDayBindings = true;
    }
    if (assignments.length === 0 && oldAssignments.length >= 7) {
      assignments = oldAssignments.slice(0, 7).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }
    if (assignments.length === 0) {
      assignments = Array.isArray(dateAssignments) ? dateAssignments : [];
    }
    const assignedDates = new Set((assignments || []).map(a => a.date));
    const emptyDates = expectDates.filter(d => !assignedDates.has(d));

    if (emptyDates.length > 0) {
      if (autoAssign !== true) {
        return res({
          code: 'EMPTY_DAYS',
          message: '存在未分配模板的日期，请分配或传 autoAssign: true 自动均匀分配',
          emptyDates
        });
      }
      const usedTplIds = [...new Set(assignments.map(a => a.templateId).filter(Boolean))];
      if (usedTplIds.length === 0 && oldSettings && oldSettings.templateId) {
        usedTplIds.push(oldSettings.templateId);
      }
      if (usedTplIds.length === 0) return res({ code: 'NO_TEMPLATE', message: '无可用模板可分配' });
      let idx = 0;
      emptyDates.forEach(d => {
        assignments.push({ date: d, templateId: usedTplIds[idx % usedTplIds.length] });
        idx++;
      });
      assignments = assignments.sort((a, b) => a.date.localeCompare(b.date));
    }

    const oldTemplateIds = [...new Set(oldAssignments.map(a => a.templateId).filter(Boolean))];
    const newTemplateIds = [...new Set(assignments.map(a => a.templateId).filter(Boolean))];
    const removedTplIds = oldTemplateIds.filter(id => !newTemplateIds.includes(id));

    if (!builtFromDayBindings && removedTplIds.length > 0 && newTemplateIds.length > 0) {
      const toRedistribute = oldAssignments.filter(a => removedTplIds.includes(a.templateId)).map(a => a.date);
      if (toRedistribute.length > 0) {
        let k = 0;
        toRedistribute.forEach(d => {
          const tplId = newTemplateIds[k % newTemplateIds.length];
          const existing = assignments.find(x => x.date === d);
          if (existing) existing.templateId = tplId;
          else assignments.push({ date: d, templateId: tplId });
          k++;
        });
        assignments.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      }
    }

    const templateIds = [...new Set(assignments.map(a => a.templateId).filter(Boolean))];
    const templatesMap = {};
    const recipesById = {};
    for (const tid of templateIds) {
      const t = await db.collection('templates').doc(tid).get();
      if (t.data) templatesMap[tid] = t.data;
      (t.data && t.data.meals || []).forEach(m => {
        (m.recipeIds || []).forEach(rid => { if (rid) recipesById[rid] = true; });
      });
    }
    const recipeIds = Object.keys(recipesById);
    for (const rid of recipeIds) {
      try {
        const r = await db.collection('recipes').doc(rid).get();
        if (r.data) recipesById[rid] = r.data;
      } catch (_) {}
    }

    const blw = blwByMeal && typeof blwByMeal === 'object'
      ? { breakfast: false, snack_am: false, lunch: false, snack_pm: false, dinner: true, ...blwByMeal }
      : (oldSettings && oldSettings.blwByMeal) || { breakfast: false, snack_am: false, lunch: false, snack_pm: false, dinner: true };

    const dateToAssign = {};
    assignments.forEach(a => { if (a.date) dateToAssign[a.date] = a.templateId; });

    const newDays = plan.days.map(day => {
      if (day.isOverridden) return day;
      const tplId = dateToAssign[day.date];
      const tpl = tplId ? templatesMap[tplId] : null;
      if (!tpl) return day;
      return {
        ...day,
        meals: buildDayMealsFromTemplate(tpl, blw, recipesById)
      };
    });

    await db.collection('week_plans').doc(plan._id).update({
      data: { days: newDays, updatedAt: now }
    });

    const settingsPayload = {
      weekStartDate,
      dateAssignments: assignments,
      blwByMeal: blw,
      updatedAt: now
    };
    if (oldSettings) {
      await db.collection('week_settings').doc(oldSettings._id).update({
        data: { ...settingsPayload, templateId: newTemplateIds[0] || oldSettings.templateId }
      });
    } else {
      await db.collection('week_settings').add({
        data: {
          openid,
          ...settingsPayload,
          templateId: newTemplateIds[0] || '',
          createdAt: now
        }
      });
    }

    return res(null, { weekStartDate, message: '已帮你更新本周设置' });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
