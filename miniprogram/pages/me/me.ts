// pages/me/me.ts
const { callCloud } = require('../../utils/cloud.js')
const { getOrderedSlotsForAge } = require('../../utils/ageMealConfig.js')
const { getUseMockWeekPlan, setUseMockWeekPlan } = require('../../utils/weekPlanMock.js')

const TEETH_STAGE_LABELS: Record<string, string> = { none: '未出牙', incisors: '上下门牙', molars: '上下后槽牙' }

Page({
  data: {
    hasPrefs: false,
    babyAgeMonths: 0,
    teethStage: '' as string,
    teethStageLine: '' as string,
    allergyText: '',
    allergyModeLine: '' as string,
    mealCount: 0,
    likedCount: 0,
    myRecipeCount: 0,
    savedRecipeCount: 0,
    savedPlanCount: 0,
    useMockWeekPlan: true as boolean,
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    this.setData({ useMockWeekPlan: getUseMockWeekPlan() })

    // Load preferences and counts in parallel
    const [prefsResult, countsResult] = await Promise.all([
      callCloud('getPreferences', {}, { showLoading: false }),
      // TODO: implement getMeCounts cloud function that returns likedCount, myRecipeCount, savedRecipeCount, savedPlanCount
      // It should query liked_recipes.count, recipes.count (openid=current user, isSystem!=true),
      // saved_recipes.count, saved_week_plans.count for the current user
      callCloud('getMeCounts', {}, { showLoading: false }),
    ])

    if (prefsResult.success && prefsResult.babyAgeMonths != null) {
      const months = prefsResult.babyAgeMonths as number
      const slots = getOrderedSlotsForAge(months) as string[]
      const allergies = (prefsResult.allergyIngredientNames || []) as string[]
      const allergyText = allergies.length > 0 ? '过敏：' + allergies.slice(0, 2).join('、') + (allergies.length > 2 ? '…' : '') : ''
      const teethStage = (prefsResult.teethStage as string) || ''
      const teethStageLine = teethStage && TEETH_STAGE_LABELS[teethStage] ? `出牙：${TEETH_STAGE_LABELS[teethStage]}` : ''
      const allergyModeLine = prefsResult.allergyMode ? '排敏模式：已开启' : ''
      this.setData({
        hasPrefs: true,
        babyAgeMonths: months,
        mealCount: slots.length,
        teethStage,
        teethStageLine,
        allergyText,
        allergyModeLine,
      })
    }

    if (countsResult.success) {
      this.setData({
        likedCount: countsResult.likedCount || 0,
        myRecipeCount: countsResult.myRecipeCount || 0,
        savedRecipeCount: countsResult.savedRecipeCount || 0,
        savedPlanCount: countsResult.savedPlanCount || 0,
      })
    }
  },

  onEditProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  onNavLiked() {
    wx.showToast({ title: '即将上线，敬请期待', icon: 'none' })
  },

  onNavMyRecipes() {
    wx.navigateTo({ url: '/pages/recipes/recipes' })
  },

  onNavSavedRecipes() {
    wx.showToast({ title: '即将上线，敬请期待', icon: 'none' })
  },

  onNavSavedPlans() {
    wx.showToast({ title: '即将上线，敬请期待', icon: 'none' })
  },

  onNavLogs() {
    wx.navigateTo({ url: '/pages/logs/logs' })
  },

  onNavAllergy() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  onGoToFoodSettings() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  onNavReminder() {
    wx.showToast({ title: '即将上线，敬请期待', icon: 'none' })
  },

  onNavAbout() {
    wx.showToast({ title: '妈妈不想想 v1.0', icon: 'none' })
  },

  onMockModeChange(e: WechatMiniprogram.SwitchChange) {
    const value = !!e.detail.value
    setUseMockWeekPlan(value)
    this.setData({ useMockWeekPlan: value })
    wx.showToast({ title: value ? '已切换为 Mock 模式' : '已切换为云端模式', icon: 'none' })
  },
})
