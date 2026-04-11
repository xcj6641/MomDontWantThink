/**
 * 云函数 getWeekData：获取某一周的 week_settings、templates、week_plans
 * 集合：week_settings, week_plans, templates（只读）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MEAL_KEYS = ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner'];

function parseMonday(str) {
  const d = new Date(str + 'T00:00:00.000Z');
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

  let { weekStartDate } = event || {};
  if (weekStartDate) {
    const normalized = parseMonday(weekStartDate);
    if (normalized !== weekStartDate) {
      return res({ code: 'INVALID_WEEK_START', message: 'weekStartDate 须为周一日期 YYYY-MM-DD' });
    }
  } else {
    return res({ code: 'INVALID_WEEK_START', message: '缺少 weekStartDate' });
  }

  try {
    const [prefRes, settingsRes, planRes] = await Promise.all([
      db.collection('preferences').where({ openid }).get(),
      db.collection('week_settings').where({ openid, weekStartDate }).get(),
      db.collection('week_plans').where({ openid, weekStartDate }).get()
    ]);
    const pref = prefRes.data && prefRes.data[0] ? prefRes.data[0] : null;
    const settings = settingsRes.data && settingsRes.data[0] ? settingsRes.data[0] : null;
    const plan = planRes.data && planRes.data[0] ? planRes.data[0] : null;
    const babyAgeMonths = pref && (pref.babyAgeMonths != null || pref.babyBirthday) ? (pref.babyAgeMonths != null ? Number(pref.babyAgeMonths) : null) : null;

    const templateIds = settings && settings.dateAssignments && settings.dateAssignments.length
      ? [...new Set(settings.dateAssignments.map((a) => a.templateId).filter(Boolean))]
      : settings && settings.templateId ? [settings.templateId] : [];
    const templates = [];
    for (const tid of templateIds) {
      try {
        const tRes = await db.collection('templates').doc(tid).get();
        if (tRes.data) templates.push(tRes.data);
      } catch (_) {}
    }
    if (templates.length === 0) {
      const defaultTpl = await db.collection('templates').where({ openid: 'system' }).limit(1).get();
      if (defaultTpl.data && defaultTpl.data[0]) templates.push(defaultTpl.data[0]);
    }
    const template = templates[0] || null;

    let babyAge = babyAgeMonths;
    if (babyAge == null && pref && pref.babyBirthday && /^\d{4}-\d{2}-\d{2}$/.test(pref.babyBirthday)) {
      const b = new Date(pref.babyBirthday + 'T12:00:00.000Z');
      const t = new Date();
      babyAge = Math.max(0, (t.getUTCFullYear() - b.getUTCFullYear()) * 12 + (t.getUTCMonth() - b.getUTCMonth()) + (t.getUTCDate() < b.getUTCDate() ? -1 : 0));
    }
    const dateAssignments = settings && Array.isArray(settings.dateAssignments)
      ? settings.dateAssignments.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      : (settings && settings.dateAssignments) || null;
    return res(null, {
      weekStartDate,
      babyAgeMonths: babyAge != null ? babyAge : null,
      allergyIngredientNames: pref ? (pref.allergyIngredientNames || []) : [],
      settings: settings ? {
        _id: settings._id,
        templateId: settings.templateId,
        dateAssignments: dateAssignments || settings.dateAssignments,
        blwByMeal: settings.blwByMeal,
        confirmed: settings.confirmed === true
      } : null,
      template,
      templates,
      plan: plan ? { _id: plan._id, days: plan.days } : null
    });
  } catch (e) {
    return res({ code: 'DB_ERROR', message: e.message });
  }
};
