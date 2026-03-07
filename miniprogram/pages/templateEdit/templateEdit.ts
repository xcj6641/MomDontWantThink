// pages/templateEdit/templateEdit.ts
const { callCloud } = require('../../utils/cloud.js')
const { MEAL_LABELS, SLOT_ORDER } = require('../../utils/ageMealConfig.js')

Page({
  data: {
    templateId: '',
    name: '',
    meals: [] as Array<{ mealKey: string; label: string; defaultBlw: boolean; recipeIds?: string[] }>,
  },

  onLoad(opt: { templateId?: string }) {
    const templateId = opt?.templateId || ''
    this.setData({
      templateId,
      name: '默认模板',
      meals: SLOT_ORDER.map((mealKey: string) => ({
        mealKey,
        label: MEAL_LABELS[mealKey] || mealKey,
        defaultBlw: mealKey === 'dinner',
        recipeIds: [],
      })),
    })
    if (templateId) this.loadTemplate()
  },

  async loadTemplate() {
    const templateId = this.data.templateId
    const result = await callCloud('getTemplate', { templateId }, { showLoading: true, loadingTitle: '加载中...' })
    if (result.success && result.template) {
      const t = result.template
      const meals = (t.meals || []).length
        ? (t.meals as any[]).map((m) => ({
            mealKey: m.mealKey,
            label: m.label || MEAL_LABELS[m.mealKey] || m.mealKey,
            defaultBlw: m.defaultBlw !== false,
            recipeIds: m.recipeIds || [],
          }))
        : SLOT_ORDER.map((mealKey: string) => ({
            mealKey,
            label: MEAL_LABELS[mealKey] || mealKey,
            defaultBlw: mealKey === 'dinner',
            recipeIds: [],
          }))
      this.setData({ name: t.name || '', meals })
    }
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ name: e.detail.value })
  },

  onBlwChange(e: WechatMiniprogram.SwitchChange) {
    const index = e.currentTarget.dataset.index as number
    const meals = this.data.meals
    if (meals[index]) meals[index].defaultBlw = e.detail.value
    this.setData({ meals })
  },

  async onSave() {
    const { templateId, name, meals } = this.data
    const res = await callCloud('updateTemplate', { templateId, name, meals }, { showLoading: true, loadingTitle: '保存中...' })
    if (res.success) {
      wx.showToast({ title: '已帮你更新模板', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },
})
