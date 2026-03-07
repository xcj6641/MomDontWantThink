// pages/dayEdit/dayEdit.ts
const { callCloud: invokeCloud } = require('../../utils/cloud.js')
const { getOrderedSlotsForAge: getSlotsForAge, MEAL_LABELS: DAYEDIT_MEAL_LABELS, SLOT_ORDER: DAYEDIT_SLOT_ORDER } = require('../../utils/ageMealConfig.js')
const DAYEDIT_WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00.000Z')
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

Page({
  data: {
    weekStartDate: '' as string,
    date: '' as string,
    weekdayLabel: '' as string,
    templateName: '' as string,
    babyAgeMonths: null as number | null,
    meals: [] as Array<{ mealKey: string; mealLabel: string; recipeName: string; recipeId?: string; blw: boolean }>,
    originalMeals: [] as Array<{ mealKey: string; recipeId: string; recipeName: string }>,
  },

  onLoad(opt: { weekStartDate?: string; date?: string }) {
    const date = opt?.date || ''
    const weekStartDate = opt?.weekStartDate ? (opt.weekStartDate.slice(0, 10)) : (date ? getMonday(date) : '')
    this.setData({ date, weekStartDate })
    if (date && weekStartDate) this.loadDay()
  },

  async loadDay() {
    const { weekStartDate, date } = this.data
    const result = await invokeCloud('getWeekData', { weekStartDate }, { showLoading: true, loadingTitle: '加载中...' })
    if (!result.success || !result.plan || !result.plan.days) return
    const planDays = result.plan.days as any[]
    const dayIndex = planDays.findIndex((d: any) => d.date === date)
    const day = dayIndex >= 0 ? planDays[dayIndex] : null
    if (!day) return

    const weekdayLabel = DAYEDIT_WEEKDAYS[dayIndex] || ''
    const dateAssignments = (result.settings && result.settings.dateAssignments) || [] as Array<{ date: string; templateId: string }>
    const templates = (result.templates || []) as Array<{ _id: string; name: string }>
    const assign = dateAssignments.find((a: any) => a.date === date)
    const tpl = assign ? templates.find((t: any) => t._id === assign.templateId) : null
    const templateName = tpl ? tpl.name : ''

    const babyAgeMonths = result.babyAgeMonths != null ? Number(result.babyAgeMonths) : null
    const mealSlots = babyAgeMonths != null ? getSlotsForAge(babyAgeMonths) : (day.meals || []).map((m: any) => m.mealKey).filter(Boolean) || DAYEDIT_SLOT_ORDER as string[]
    const mealsRaw = day.meals || []
    const overrides = day.overrides || {}
    const mealByKey: Record<string, any> = {}
    mealsRaw.forEach((m: any) => { mealByKey[m.mealKey] = m })
    const originalMeals = mealSlots.map((mealKey: string) => {
      const m = mealByKey[mealKey]
      return { mealKey, recipeId: m ? (m.recipeId || '') : '', recipeName: m ? (m.recipeName || '未安排') : '未安排' }
    })
    const meals = mealSlots.map((mealKey: string) => {
      const ov = overrides[mealKey]
      const base = mealByKey[mealKey]
      const effective = ov && (ov.recipeId || ov.recipeName) ? ov : base
      return {
        mealKey,
        mealLabel: DAYEDIT_MEAL_LABELS[mealKey] || mealKey,
        recipeName: effective ? (effective.recipeName || '未安排') : '未安排',
        recipeId: effective ? (effective.recipeId || '') : '',
        blw: base ? !!base.blw : mealKey === 'dinner',
      }
    })
    this.setData({ weekdayLabel, templateName, babyAgeMonths, meals, originalMeals })
  },

  async onShuffleMeal(e: WechatMiniprogram.TouchEvent) {
    const mealKey = e.currentTarget.dataset.mealkey as string
    const { meals, babyAgeMonths } = this.data
    if (!mealKey) return
    const meal = (meals || []).find((m: any) => m.mealKey === mealKey)
    const isBlw = meal ? !!meal.blw : false
    const excludeIds = (meals || []).map((m: any) => m.recipeId).filter(Boolean)
    const res = await invokeCloud('getRecipeSuggestion', {
      mealKey,
      babyAgeMonths: babyAgeMonths != null ? babyAgeMonths : undefined,
      isBlw,
      excludeRecipeIds: excludeIds,
    }, { showLoading: true, loadingTitle: '换一个…' })
    if (res.success && res.recipe) {
      const next = (this.data.meals || []).map((m: any) =>
        m.mealKey === mealKey ? { ...m, recipeId: res.recipe._id, recipeName: res.recipe.name || '' } : m
      )
      this.setData({ meals: next })
      wx.showToast({ title: '已换一道', icon: 'none' })
    } else {
      wx.showToast({ title: res.message || '暂无可替换的', icon: 'none' })
    }
  },

  async onSave() {
    const { weekStartDate, date, meals, originalMeals } = this.data
    const overrides: Record<string, { recipeId: string; recipeName: string }> = {}
    ;(meals || []).forEach((m: any, i: number) => {
      const orig = (originalMeals || [])[i]
      if (!orig) return
      if ((m.recipeId || m.recipeName) && (m.recipeId !== orig.recipeId || m.recipeName !== orig.recipeName)) {
        overrides[m.mealKey] = { recipeId: m.recipeId || '', recipeName: m.recipeName || '' }
      }
    })
    const res = await invokeCloud('updateDayOverride', {
      weekStartDate,
      date,
      overrides,
    }, { showLoading: true, loadingTitle: '保存中...' })
    if (res.success) {
      wx.showToast({ title: '已帮你更新当日菜单', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    }
  },
})
