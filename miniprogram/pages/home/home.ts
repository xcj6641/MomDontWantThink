// pages/home/home.ts
const { callCloud } = require('../../utils/cloud.js')
const { MEAL_LABELS } = require('../../utils/ageMealConfig.js')
const { generateMockWeekPlan, getWeekDates, getUseMockWeekPlan } = require('../../utils/weekPlanMock.js')

Page({
  data: {
    today: '' as string,
    showInitial: true as boolean,
    babyBirthday: '' as string,
    allergens: [] as string[],
    birthdayValid: false as boolean,
    generating: false as boolean,
    thisWeekStartDate: '' as string,
    todayMeals: [] as Array<{ mealKey: string; mealLabel?: string; recipeName: string; recipeId?: string; blw: boolean }>,
    tomorrowTip: '' as string,
    nextWeekStatus: 'none' as string,
    nextWeekStartDate: '' as string,
  },

  onLoad() {
    const today = this.formatDate(new Date())
    this.setData({ today })
    this.initAndLoadHome()
  },

  onShow() {
    this.loadHomeData()
  },

  formatDate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  },

  getThisMonday(): string {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return this.formatDate(d)
  },

  getNextMonday(): string {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff + 7)
    return this.formatDate(d)
  },

  async initAndLoadHome() {
    const initRes = await callCloud('initUser', {}, { showLoading: true, loadingTitle: '加载中...' })
    if (initRes.success === false && (initRes.code === 'NO_CLOUD' || initRes.code === 'CALL_FAIL')) {
      this.setData({
        todayMeals: [],
        tomorrowTip: '请先在微信开发者工具中开通并部署云开发',
        nextWeekStatus: 'none',
        nextWeekStartDate: this.getNextMonday(),
      })
      return
    }
    await this.loadHomeData()
  },

  async loadHomeData() {
    const today = this.data.today || this.formatDate(new Date())
    const result = await callCloud('getHomeData', { today }, { showLoading: false })
    if (result.success === false) {
      if (result.code === 'NO_OPENID') return
      if (result.code === 'NO_CLOUD' || result.code === 'CALL_FAIL') {
        this.setData({
          todayMeals: [],
          tomorrowTip: '请先开通并部署云开发后重试',
          nextWeekStatus: 'none',
          nextWeekStartDate: this.getNextMonday(),
        })
        return
      }
      this.setData({
        todayMeals: [],
        tomorrowTip: '去生成下周计划吧～',
        nextWeekStatus: 'none',
        nextWeekStartDate: this.getNextMonday(),
      })
      return
    }
    const todayMeals = (result.todayMeals || []).map((m: any) => ({
      ...m,
      mealLabel: MEAL_LABELS[m.mealKey] || m.mealKey,
    }))
    const babyBirthday = result.babyBirthday || ''
    const allergens = Array.isArray(result.allergens) ? result.allergens : []
    // 未返回 showInitial 时默认显示初始页（兼容旧版云函数或首启）
    const showInitial = result.hasOwnProperty('showInitial') ? !!result.showInitial : true
    this.setData({
      showInitial,
      babyBirthday,
      allergens,
      birthdayValid: !!babyBirthday,
      thisWeekStartDate: result.thisWeekStartDate || this.getThisMonday(),
      todayMeals,
      tomorrowTip: result.tomorrowTip || '记得备好食材哦',
      nextWeekStatus: result.nextWeekStatus || 'none',
      nextWeekStartDate: result.nextWeekStartDate || this.getNextMonday(),
    })
  },

  onBirthdayChange(e: WechatMiniprogram.PickerChange) {
    const val = (e.detail && e.detail.value) || ''
    this.setData({
      babyBirthday: val,
      birthdayValid: !!val,
    })
  },

  onAddAllergen() {
    wx.showModal({
      title: '添加过敏食材',
      editable: true,
      placeholderText: '输入食材名称',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          const name = res.content.trim()
          const allergens = [...(this.data.allergens || []), name]
          this.setData({ allergens })
        }
      },
    })
  },

  onRemoveAllergen(e: WechatMiniprogram.TouchEvent) {
    const idx = e.currentTarget.dataset.index as number
    if (idx == null) return
    const allergens = (this.data.allergens || []).filter((_, i) => i !== idx)
    this.setData({ allergens })
  },

  async onGenerateThisWeek() {
    const { babyBirthday, allergens, thisWeekStartDate, generating } = this.data
    if (!babyBirthday) {
      wx.showToast({ title: '👉 先选择宝宝生日', icon: 'none' })
      return
    }
    if (generating) return
    this.setData({ generating: true })
    const saveRes = await callCloud('savePreferences', {
      babyBirthday,
      allergyIngredientNames: allergens || [],
    }, { showLoading: false })
    if (!saveRes.success) {
      this.setData({ generating: false })
      wx.showToast({ title: '我这边有点忙，稍后再试一次～', icon: 'none' })
      return
    }
    const weekStart = thisWeekStartDate || this.getThisMonday()
    if (getUseMockWeekPlan()) {
      const weekDates = getWeekDates(weekStart)
      const result = generateMockWeekPlan(3, weekDates)
      wx.setStorageSync('mockWeekPlan', JSON.stringify(result))
      this.setData({ generating: false })
      wx.navigateTo({
        url: `/pages/week/week?weekStartDate=${weekStart}&needConfirm=1&useMock=1`,
      })
      return
    }
    const genRes = await callCloud('generateNextWeek', { nextWeekStartDate: weekStart }, { showLoading: true, loadingTitle: '正在帮你生成…' })
    this.setData({ generating: false })
    if (genRes.success || genRes.code === 'WEEK_ALREADY_EXISTS') {
      wx.navigateTo({ url: `/pages/week/week?weekStartDate=${weekStart}&needConfirm=1` })
    } else if (genRes.code === 'MISSING_BABY_AGE') {
      wx.showToast({ title: '👉 先选择宝宝生日', icon: 'none' })
    } else {
      wx.showToast({ title: '我这边有点忙，稍后再试一次～', icon: 'none' })
    }
  },

  onMarkDone(e: WechatMiniprogram.TouchEvent) {
    const { mealkey, date, recipeid, recipename } = e.currentTarget.dataset
    const mealKey = mealkey
    const recipeId = recipeid
    const recipeName = recipename || ''
    const dateStr = date || this.data.today
    if (!mealKey || !dateStr) return
    callCloud('logMealDone', {
      date: dateStr,
      mealKey,
      recipeId: recipeId || '',
      recipeName,
    }, { showLoading: true, loadingTitle: '记录中...' }).then((res) => {
      if (res.success) wx.showToast({ title: '已记下这餐啦', icon: 'success' })
    })
  },
})
