// pages/nextWeek/nextWeek.ts
const { callCloud } = require('../../utils/cloud.js')

const { MEAL_LABELS } = require('../../utils/ageMealConfig.js')

Page({
  data: {
    nextWeekStartDate: '',
    thisWeekStartDate: '',
    showGenerateThisWeek: false,
    hasPlan: false,
    days: [] as Array<{ date: string; meals: Array<{ mealKey: string; mealLabel: string; recipeName: string }> }>,
  },

  onLoad(opt: { generateThisWeek?: string }) {
    this.setNextWeekStart()
    this.setThisWeekStart()
    this.setData({ showGenerateThisWeek: opt?.generateThisWeek === '1' })
    this.loadNextWeek()
    if (opt?.generateThisWeek === '1') this.loadThisWeekStatus()
  },

  setNextWeekStart() {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff + 7)
    const nextWeekStartDate = this.formatDate(d)
    this.setData({ nextWeekStartDate })
  },

  setThisWeekStart() {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    const thisWeekStartDate = this.formatDate(d)
    this.setData({ thisWeekStartDate })
  },

  async loadThisWeekStatus() {
    const thisWeekStartDate = this.data.thisWeekStartDate
    const result = await callCloud('getWeekData', { weekStartDate: thisWeekStartDate }, { showLoading: false })
    const hasThisWeekPlan = result.success && result.plan && result.plan.days && result.plan.days.length > 0
    this.setData({ showGenerateThisWeek: !hasThisWeekPlan })
  },

  formatDate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  },

  async loadNextWeek() {
    const nextWeekStartDate = this.data.nextWeekStartDate
    const result = await callCloud('getWeekData', { weekStartDate: nextWeekStartDate }, { showLoading: false })
    if (result.success && result.plan && result.plan.days && result.plan.days.length > 0) {
      const days = (result.plan.days as any[]).map((day: any) => ({
        date: day.date,
        meals: (day.meals || []).map((m: any) => ({
          ...m,
          mealLabel: MEAL_LABELS[m.mealKey] || m.mealKey,
        })),
      }))
      this.setData({ hasPlan: true, days })
    } else {
      this.setData({ hasPlan: false, days: [] })
    }
  },

  async onGenerateThisWeek() {
    const thisWeekStartDate = this.data.thisWeekStartDate
    const res = await callCloud('generateNextWeek', { nextWeekStartDate: thisWeekStartDate }, { showLoading: true, loadingTitle: '正在生成本周计划...' })
    if (res.success) {
      wx.showToast({ title: '已生成本周计划', icon: 'success' })
      this.setData({ showGenerateThisWeek: false })
      wx.navigateBack()
    } else if (res.code === 'MISSING_BABY_AGE') {
      wx.showToast({ title: '👉 先填写宝宝月龄，我就能帮你生成适龄辅食菜单', icon: 'none', duration: 3000 })
      wx.redirectTo({ url: '/pages/profile/profile' })
    }
  },

  async onGenerate() {
    const nextWeekStartDate = this.data.nextWeekStartDate
    const res = await callCloud('generateNextWeek', { nextWeekStartDate }, { showLoading: true, loadingTitle: '正在生成下周计划...' })
    if (res.success) {
      wx.showToast({ title: res.message || '已帮你生成下周计划', icon: 'success' })
      this.loadNextWeek()
    } else if (res.code === 'MISSING_BABY_AGE') {
      wx.showToast({ title: '👉 先填写宝宝月龄，我就能帮你生成适龄辅食菜单', icon: 'none', duration: 3000 })
      wx.redirectTo({ url: '/pages/profile/profile' })
    }
  },
})
