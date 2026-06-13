// pages/profile/profile.ts
const { callCloud } = require('../../utils/cloud.js')

function calcAgeMonths(birthday: string): number | null {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null
  const birth = new Date(birthday + 'T12:00:00')
  const now = new Date()
  if (birth.getTime() > now.getTime()) return null
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (now.getDate() < birth.getDate()) months -= 1
  return Math.max(0, months)
}

function ageMealCount(months: number | null): number {
  if (months === null || months < 5) return 0
  if (months < 6) return 1
  if (months < 9) return 2
  if (months < 12) return 3
  return 4
}

const SYSTEM_INGREDIENTS = [
  '三文鱼', '冬瓜', '南瓜', '土豆', '大米', '嫩豆腐', '小米', '山药', '意面', '排骨',
  '梨', '牛油果', '牛肉末', '猪瘦肉末', '猪肝', '甜玉米', '番茄', '白萝卜', '碎面', '紫薯',
  '红薯', '胡萝卜', '芒果', '苹果', '茄子', '草莓', '莲藕', '菠菜', '蓝莓', '蛋黄',
  '西兰花', '西葫芦', '青菜', '青豆', '面粉', '香蕉', '鳕鱼', '鸡胸肉', '鸡蛋', '黄瓜',
]

const MEAL_COUNT_OPTIONS = [
  { label: '1餐', value: 1 },
  { label: '2餐', value: 2 },
  { label: '3餐', value: 3 },
  { label: '3餐+1加餐', value: 4 },
]

Page({
  data: {
    babyName: '',
    babyBirthday: '' as string,
    babyAgeMonths: null as number | null,
    babyAgeLabel: '' as string,
    todayDateStr: '' as string,
    teethStage: '' as string,
    mealCountOverride: null as number | null,
    autoMealCount: 0 as number,
    mealCountOptions: MEAL_COUNT_OPTIONS,
    allergenSelected: {} as Record<string, boolean>,
    ingredientSearchText: '' as string,
    filteredIngredients: SYSTEM_INGREDIENTS as string[],
    allergyMode: false as boolean,
    allergyTestingPeriod: 3 as number,
  },

  onLoad() {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    this.setData({ todayDateStr: `${y}-${m}-${d}` })
    this.loadPreferences()
  },

  async loadPreferences() {
    const result = await callCloud('getPreferences', {}, { showLoading: false })
    if (result.success) {
      const birthday = result.babyBirthday || ''
      const ageMonths = calcAgeMonths(birthday)
      const autoMealCount = ageMealCount(ageMonths)
      const babyAgeLabel = ageMonths !== null ? `当前月龄：${ageMonths}个月` : ''
      // Auto-enable allergyMode for 5~8 month new users who haven't set it explicitly
      const serverAllergyMode = result.allergyMode === true
      const shouldAutoEnable = !serverAllergyMode && ageMonths !== null && ageMonths >= 5 && ageMonths < 9 && !birthday
      const allergyMode = serverAllergyMode || shouldAutoEnable
      this.setData({
        babyName: result.babyName || '',
        babyBirthday: birthday,
        babyAgeMonths: ageMonths,
        babyAgeLabel,
        teethStage: result.teethStage || '',
        allergenSelected: Object.fromEntries((result.allergyIngredientNames || []).map((n: string) => [n, true])),
        allergyMode,
        allergyTestingPeriod: result.allergyTestingPeriod || 3,
        mealCountOverride: result.mealCountOverride != null ? result.mealCountOverride : null,
        autoMealCount,
      })
    }
  },

  onBabyNameInput(e: WechatMiniprogram.Input) {
    this.setData({ babyName: e.detail.value })
  },

  onBirthdayChange(e: WechatMiniprogram.PickerChange) {
    const birthday = (e.detail && e.detail.value) || ''
    const ageMonths = calcAgeMonths(birthday)
    const autoMealCount = ageMealCount(ageMonths)
    const babyAgeLabel = ageMonths !== null ? `当前月龄：${ageMonths}个月` : ''
    // Auto-enable allergyMode when first setting birthday for 5~8 month babies
    const isFirstBirthday = !this.data.babyBirthday
    const allergyMode = (isFirstBirthday && ageMonths !== null && ageMonths >= 5 && ageMonths < 9)
      ? true
      : this.data.allergyMode
    this.setData({ babyBirthday: birthday, babyAgeMonths: ageMonths, babyAgeLabel, autoMealCount, allergyMode })
  },

  onSelectMealCount(e: WechatMiniprogram.TouchEvent) {
    const val = parseInt((e.currentTarget.dataset as Record<string, string>).value || '0', 10)
    if (!val) return
    // Tapping the already-selected option clears the override (revert to auto)
    const current = this.data.mealCountOverride !== null ? this.data.mealCountOverride : this.data.autoMealCount
    this.setData({ mealCountOverride: val === current && this.data.mealCountOverride !== null ? null : val })
  },

  onTeethStageTap(e: WechatMiniprogram.TouchEvent) {
    const stage = (e.currentTarget.dataset as Record<string, string>).stage || ''
    this.setData({ teethStage: stage === this.data.teethStage ? '' : stage })
  },

  async onToggleAllergyMode() {
    const next = !this.data.allergyMode
    this.setData({ allergyMode: next })
    await callCloud('savePreferences', { allergyMode: next }, { showLoading: false })
    wx.showToast({ title: next ? '排敏模式已开启' : '常规模式已开启', icon: 'none' })
  },

  async onSelectAllergyPeriod(e: WechatMiniprogram.TouchEvent) {
    const period = parseInt((e.currentTarget.dataset as Record<string, string>).period || '3', 10)
    if (period === this.data.allergyTestingPeriod) return
    this.setData({ allergyTestingPeriod: period })
    await callCloud('savePreferences', { allergyTestingPeriod: period }, { showLoading: false })
  },

  onGoToAllergyIngredients() {
    wx.navigateTo({ url: '/pages/allergyMode/allergyMode' })
  },

  onToggleAllergen(e: WechatMiniprogram.TouchEvent) {
    const name = (e.currentTarget.dataset as Record<string, string>).name
    const allergenSelected = { ...this.data.allergenSelected }
    allergenSelected[name] = !allergenSelected[name]
    this.setData({ allergenSelected })
  },

  onIngredientSearch(e: WechatMiniprogram.Input) {
    const q = (e.detail.value || '').trim()
    const filteredIngredients = q
      ? SYSTEM_INGREDIENTS.filter((n) => n.includes(q))
      : SYSTEM_INGREDIENTS
    this.setData({ ingredientSearchText: e.detail.value, filteredIngredients })
  },

  async onSave() {
    if (!this.data.babyBirthday) {
      wx.showToast({ title: '请选择宝宝生日', icon: 'none' })
      return
    }
    const babyName = this.data.babyName.trim()
    const allergyIngredientNames = SYSTEM_INGREDIENTS.filter((n) => this.data.allergenSelected[n])
    const res = await callCloud(
      'savePreferences',
      {
        babyName,
        babyBirthday: this.data.babyBirthday,
        allergyIngredientNames,
        teethStage: this.data.teethStage,
        allergyMode: this.data.allergyMode,
        allergyTestingPeriod: this.data.allergyTestingPeriod,
        mealCountOverride: this.data.mealCountOverride,
      },
      { showLoading: true, loadingTitle: '保存中...' }
    )
    if (res.success) {
      wx.showToast({ title: '保存成功', icon: 'success', duration: 2000 })
    }
  },
})
