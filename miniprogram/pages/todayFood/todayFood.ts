// pages/todayFood/todayFood.ts
const { callCloud } = require('../../utils/cloud.js')
const { MEAL_LABELS } = require('../../utils/ageMealConfig.js')
const { mockRecipes, getUseMockWeekPlan, generateMockWeekPlan, getWeekDates } = require('../../utils/weekPlanMock.js')

const COMMON_ALLERGENS = ['鸡蛋', '牛奶', '花生', '坚果', '小麦', '大豆', '鱼', '虾', '蟹', '贝类', '芝麻']

const DONE_STORAGE_PREFIX = 'todayFood_done_v1'
const BABY_LIKE_STORAGE_PREFIX = 'todayFood_baby_like_v1'
const FAVORITE_STORAGE_PREFIX = 'todayFood_collect_v1'
const DEBUG_VIEW_MODE_KEY = 'todayFood_debug_view_mode_v1'

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getThisMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return formatDate(d)
}

function getNextMondayFrom(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff + 7)
  return formatDate(d)
}

function getWeekdayShort(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  const map = ['日', '一', '二', '三', '四', '五', '六']
  return map[d.getDay()] || ''
}

function calcAgeMonths(birthday: string): number {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return -1
  const birth = new Date(birthday + 'T12:00:00')
  const now = new Date()
  if (birth > now) return -1
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (now.getDate() < birth.getDate()) months -= 1
  return Math.max(0, months)
}

function getFeedingStage(ageMonths: number): string {
  if (ageMonths < 5) return 'too_young'
  if (ageMonths < 6) return 'stage_1'
  if (ageMonths < 9) return 'stage_2'
  if (ageMonths < 12) return 'stage_3'
  return 'stage_4'
}

function babyAgeLabel(birthday: string): string {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return ''
  const birth = new Date(birthday + 'T12:00:00')
  const now = new Date()
  if (birth.getTime() > now.getTime()) return ''
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  let dayAdj = now.getDate() - birth.getDate()
  if (dayAdj < 0) {
    months -= 1
    const prev = new Date(now.getFullYear(), now.getMonth(), 0)
    dayAdj += prev.getDate()
  }
  return `${months}个月+${dayAdj}天`
}

function detailNumericId(recipeId: string | number | undefined): number | null {
  if (recipeId == null || recipeId === '') return null
  const s = String(recipeId)
  const m = s.match(/recipe_(\d+)/i)
  if (m) {
    const n = parseInt(m[1], 10)
    return Number.isFinite(n) ? n : null
  }
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

function splitDishNames(recipeName: string): string[] {
  if (!recipeName || !recipeName.trim()) return ['未安排']
  const parts = recipeName.split(/\s*[·、]\s*/).map((x) => x.trim()).filter(Boolean)
  return parts.length ? parts : [recipeName.trim()]
}

function doneStorageKey(date: string, dishKey: string): string {
  return `${DONE_STORAGE_PREFIX}_${date}_${dishKey}`
}

function babyLikeStorageKey(date: string, dishKey: string): string {
  return `${BABY_LIKE_STORAGE_PREFIX}_${date}_${dishKey}`
}

function favoriteStorageKey(date: string, dishKey: string): string {
  return `${FAVORITE_STORAGE_PREFIX}_${date}_${dishKey}`
}

interface DishRow {
  dishKey: string
  dishIndex: number
  name: string
  recipeIdStr: string
  done: boolean
  babyLike: boolean
  favorite: boolean
}

interface MealGroup {
  mealKey: string
  mealLabel: string
  blw: boolean
  dishes: DishRow[]
  ingredient?: string
  testingDay?: number
  totalTestingDays?: number
  isTestingMeal?: boolean
}

type MockMealRow = {
  mealKey: string
  blw: boolean
  recipeName?: string
  recipeId?: string
  dishes?: Array<{ name: string; recipeId?: string }>
}

/** 调试 / Mock 今日餐次固定 4 档：早餐、加餐、午餐、晚餐（与产品展示一致） */
const MOCK_DEBUG_MEAL_KEYS = ['breakfast', 'snack_am', 'lunch', 'dinner'] as const

/** 与 weekPlanMock 中 prep_1.recipesPerMeal 下标一致（breakfast…dinner 共 5 档，此处取其中 4 档） */
const SLOT_INDEX_IN_PREP: Record<string, number> = {
  breakfast: 0,
  snack_am: 1,
  lunch: 2,
  snack_pm: 3,
  dinner: 4,
}

function buildMockTodayMeals(today: string): MockMealRow[] {
  try {
    const raw = wx.getStorageSync('mockWeekPlan')
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const items = parsed?.weekPlan?.items || []
    const itemForDay = items.find((it: any) => Array.isArray(it.assignedDates) && it.assignedDates.indexOf(today) >= 0)
    const hasMultiMenu = (it: any) =>
      Array.isArray(it?.recipesPerMeal) &&
      it.recipesPerMeal.some((row: number[]) => Array.isArray(row) && row.length > 0)
    /** 当天所在备餐套若无 recipesPerMeal（旧缓存），回退到任意一套带多菜的模板 */
    const item =
      itemForDay && hasMultiMenu(itemForDay)
        ? itemForDay
        : items.find((it: any) => hasMultiMenu(it)) || itemForDay

    const list: MockMealRow[] = []
    const recipes = mockRecipes || []

    MOCK_DEBUG_MEAL_KEYS.forEach((mealKey, i) => {
      const prepIdx = SLOT_INDEX_IN_PREP[mealKey]
      if (item && Array.isArray(item.recipesPerMeal) && item.recipesPerMeal[prepIdx]?.length) {
        const ids = item.recipesPerMeal[prepIdx] as number[]
        const dishes = ids.map((rid: number) => {
          const r = recipes.find((x: { id: number; name: string }) => x.id === rid)
          return { name: r?.name || `菜谱${rid}`, recipeId: String(rid) }
        })
        list.push({ mealKey, blw: mealKey === 'lunch', dishes })
        return
      }

      const fallback = recipes[i % Math.max(recipes.length, 1)]
      let recipeName = fallback?.name || '未安排'
      let recipeId = fallback != null ? String(fallback.id) : ''
      if (item && i === 0 && item.recipeName) {
        recipeName = item.recipeName
        recipeId = item.recipeId != null ? String(item.recipeId) : recipeId
      } else if (item && !item.recipeName && item.recipeId != null) {
        const r = recipes.find((x: { id: number; name: string }) => x.id === item.recipeId)
        if (r) {
          recipeName = r.name
          recipeId = String(r.id)
        }
      }

      list.push({
        mealKey,
        recipeName,
        recipeId,
        blw: mealKey === 'lunch',
      })
    })

    return list
  } catch (_) {
    return []
  }
}

Page({
  data: {
    loading: true,
    today: '' as string,
    todayDateStr: '' as string,
    weekStartDate: '' as string,
    weekdayShort: '' as string,
    babyName: '' as string,
    babyBirthday: '' as string,
    teethStage: '' as string,
    ageTooYoung: false as boolean,
    allergens: [] as string[],
    allergenModalVisible: false as boolean,
    commonAllergens: COMMON_ALLERGENS,
    modalCommonSelected: {} as Record<string, boolean>,
    modalCustomList: [] as string[],
    customAllergenInput: '' as string,
    /** 宝宝 · 后的月龄文案，与 👶 分列展示以便过敏行与「宝宝」对齐 */
    babyAgeSummary: '' as string,
    teethStageLine: '' as string,
    allergenLine: '' as string,
    allergyModeLine: '' as string,
    showSetupBanner: false as boolean,
    arrangedMealCount: 0 as number,
    mealGroups: [] as MealGroup[],
    tomorrowTip: '' as string,
    tomorrowLines: [] as string[],
    /** 与 getHomeData：本周是否已有 7 日计划 */
    thisWeekStatus: 'none' as string,
    thisWeekBtnText: '生成本周计划' as string,
    nextWeekBtnText: '生成下周计划' as string,
    nextWeekStatus: 'none' as string,
    nextWeekStartDate: '' as string,
    debugPanelVisible: false as boolean,
    debugViewMode: 'auto' as 'auto' | 'initial' | 'today',
    showDebugInitialPage: false as boolean,
    showMainPage: true as boolean,
    /** 与首页 onboarding 一致：生日校验 + 生成本周 CTA */
    birthdayValid: false as boolean,
    onboardingGenerating: false as boolean,
    allergyMode: false as boolean,
    currentTestingIngredient: null as { ingredient: string; currentDay: number; totalDays: number } | null,
    showAnomalyDialog: false as boolean,
    anomalySymptoms: [] as string[],
    anomalyDishKey: '' as string,
  },

  onLoad() {
    const today = formatDate(new Date())
    const debugViewMode = (wx.getStorageSync(DEBUG_VIEW_MODE_KEY) || 'auto') as 'auto' | 'initial' | 'today'
    this.setData({
      today,
      todayDateStr: today,
      weekStartDate: getThisMonday(),
      weekdayShort: getWeekdayShort(today),
      debugViewMode,
    })
    this.bootstrap()
  },

  onShow() {
    if (this.data.today) this.loadTodayData()
  },

  applyDebugViewMode(showSetupBanner: boolean) {
    const mode = this.data.debugViewMode
    if (mode === 'initial') {
      this.setData({
        showDebugInitialPage: true,
        showMainPage: false,
      })
      return
    }
    if (mode === 'today') {
      this.setData({
        showDebugInitialPage: false,
        showMainPage: true,
        showSetupBanner: false,
      })
      return
    }
    this.setData({
      showDebugInitialPage: !!showSetupBanner,
      showMainPage: !showSetupBanner,
      showSetupBanner: !!showSetupBanner,
    })
  },

  async bootstrap() {
    await callCloud('initUser', {}, { showLoading: false })
    await this.loadTodayData()
  },

  applyDoneFromStorage(date: string, groups: MealGroup[]): MealGroup[] {
    return groups.map((g) => ({
      ...g,
      dishes: g.dishes.map((d) => ({
        ...d,
        done: !!wx.getStorageSync(doneStorageKey(date, d.dishKey)),
        babyLike: !!wx.getStorageSync(babyLikeStorageKey(date, d.dishKey)),
        favorite: !!wx.getStorageSync(favoriteStorageKey(date, d.dishKey)),
      })),
    }))
  },

  dishKeyFor(mealKey: string, idx: number): string {
    return `${mealKey}|${idx}`
  },

  buildMealGroups(
    rows: Array<{
      mealKey: string
      mealLabel?: string
      recipeName?: string
      recipeId?: string
      blw: boolean
      dishes?: Array<{ name: string; recipeId?: string }>
    }>,
    date: string
  ): MealGroup[] {
    const groups: MealGroup[] = rows.map((m) => {
      let dishes: DishRow[]
      if (Array.isArray(m.dishes) && m.dishes.length > 0) {
        dishes = m.dishes.map((d, idx) => ({
          dishKey: this.dishKeyFor(m.mealKey, idx),
          dishIndex: idx,
          name: d.name || '未安排',
          recipeIdStr: d.recipeId != null && d.recipeId !== '' ? String(d.recipeId) : '',
          done: false,
          babyLike: false,
          favorite: false,
        }))
      } else {
        const names = splitDishNames(m.recipeName || '')
        dishes = names.map((name, idx) => ({
          dishKey: this.dishKeyFor(m.mealKey, idx),
          dishIndex: idx,
          name,
          recipeIdStr: idx === 0 && m.recipeId ? String(m.recipeId) : '',
          done: false,
          babyLike: false,
          favorite: false,
        }))
        if (dishes.length === 1 && !dishes[0].recipeIdStr && m.recipeId) {
          dishes[0].recipeIdStr = String(m.recipeId)
        }
      }
      return {
        mealKey: m.mealKey,
        mealLabel: m.mealLabel || MEAL_LABELS[m.mealKey] || m.mealKey,
        blw: !!m.blw,
        dishes,
        ingredient: (m as any).ingredient || '',
        testingDay: (m as any).testingDay || 0,
        totalTestingDays: (m as any).totalTestingDays || 0,
        isTestingMeal: !!(m as any).ingredient && !!(m as any).testingDay,
      }
    })
    return this.applyDoneFromStorage(date, groups)
  },

  countArrangedMeals(groups: MealGroup[]): number {
    return groups.filter((g) => g.dishes.some((d) => d.name && d.name !== '未安排')).length
  },

  parseTomorrowLines(tip: string): string[] {
    const t = (tip || '').trim()
    if (!t) return []
    // 后端在「暂无明日备菜/没有计划」时可能仍返回一段提示文本；
    // 为了统一 UI，视为无备菜，从而走 tomorrow-empty 的文案。
    if (/没有明日备菜工作|没有明日备菜|暂无明日备菜|暂无需要准备的食材/.test(t)) {
      return []
    }
    /** 与「下周计划」无关的引导文案，不应出现在明日备菜区 */
    if (/去生成.*周计划/.test(t) && t.length < 32) return []
    let lines: string[] = []
    if (t.includes('\n')) lines = t.split(/\n/).map((x) => x.trim()).filter(Boolean)
    else if (t.includes('；')) lines = t.split('；').map((x) => x.trim()).filter(Boolean)
    else if (t.includes(';')) lines = t.split(';').map((x) => x.trim()).filter(Boolean)
    else lines = [t]
    return lines.filter((l) => l && !/^去生成.*周计划/.test(l))
  },

  async loadTodayData() {
    const today = this.data.today || formatDate(new Date())
    this.setData({ loading: true })
    const result = await callCloud('getHomeData', { today }, { showLoading: false })

    let todayMeals: Array<{
      mealKey: string
      mealLabel?: string
      recipeName?: string
      recipeId?: string
      blw: boolean
      dishes?: Array<{ name: string; recipeId?: string }>
      ingredient?: string
      testingDay?: number
      totalTestingDays?: number
    }> = []
    let showSetupBanner = false
    let babyBirthday = ''
    let babyName = ''
    let teethStage = ''
    let allergens: string[] = []
    let tomorrowTip = ''
    let thisWeekStatus: 'generated' | 'none' = 'none'
    let nextWeekStatus = 'none'
    let nextWeekStartDate = getNextMondayFrom(getThisMonday())
    let weekStartDate = this.data.weekStartDate || getThisMonday()
    let allergyMode = false
    let currentTestingIngredient: { ingredient: string; currentDay: number; totalDays: number } | null = null

    if (result && result.success !== false) {
      todayMeals = Array.isArray(result.todayMeals)
        ? result.todayMeals.map((m: any) => ({
            ...m,
            mealLabel: MEAL_LABELS[m.mealKey] || m.mealKey,
          }))
        : []
      babyBirthday = result.babyBirthday || ''
      babyName = result.babyName || ''
      teethStage = result.teethStage || ''
      allergens = Array.isArray(result.allergens) ? result.allergens : []
      const showInitial = result.hasOwnProperty('showInitial') ? !!result.showInitial : true
      showSetupBanner = showInitial
      tomorrowTip = result.tomorrowTip || ''
      thisWeekStatus = result.thisWeekStatus === 'generated' ? 'generated' : 'none'
      nextWeekStatus = result.nextWeekStatus || 'none'
      nextWeekStartDate = result.nextWeekStartDate || getNextMondayFrom(weekStartDate)
      weekStartDate = result.thisWeekStartDate || weekStartDate
      allergyMode = result.allergyMode === true
      currentTestingIngredient = result.currentTestingIngredient || null
    }

    /** Mock 联调：只要本地有 mock 周计划解析出餐次，即用其覆盖云端今日列表（保证每餐多菜可测） */
    if (getUseMockWeekPlan()) {
      const mockRows = buildMockTodayMeals(today)
      if (mockRows.length) {
        todayMeals = mockRows
        thisWeekStatus = 'generated'
        showSetupBanner = false
      }
    }

    const thisWeekBtnText = thisWeekStatus === 'generated' ? '本周计划 >' : '生成本周计划'
    const nextWeekBtnText = nextWeekStatus === 'generated' ? '查看下周计划' : '生成下周计划'

    const TEETH_STAGE_LABELS: Record<string, string> = { none: '未出牙', incisors: '上下门牙', molars: '上下后槽牙' }
    const teethStageLine = teethStage && TEETH_STAGE_LABELS[teethStage] ? `出牙：${TEETH_STAGE_LABELS[teethStage]}` : ''
    const babyAgeSummary = babyBirthday ? babyAgeLabel(babyBirthday) : ''
    const allergenLine = allergens.length ? `过敏：${allergens.join('、')}` : ''
    const allergyModeLine = allergyMode ? '排敏模式：已开启' : ''
    let mealGroups = this.buildMealGroups(todayMeals, today)
    const arrangedMealCount = this.countArrangedMeals(mealGroups)
    const tomorrowLines = this.parseTomorrowLines(tomorrowTip)

    this.setData({
      loading: false,
      weekStartDate,
      weekdayShort: getWeekdayShort(today),
      babyName,
      babyBirthday,
      teethStage,
      allergens,
      birthdayValid: !!babyBirthday,
      babyAgeSummary,
      teethStageLine,
      allergenLine,
      allergyModeLine,
      showSetupBanner,
      mealGroups,
      arrangedMealCount,
      tomorrowTip,
      tomorrowLines,
      thisWeekStatus,
      thisWeekBtnText,
      nextWeekBtnText,
      nextWeekStatus,
      nextWeekStartDate,
      allergyMode,
      currentTestingIngredient,
    })
    this.applyDebugViewMode(showSetupBanner)
  },

  onToggleDebugPanel() {
    this.setData({ debugPanelVisible: !this.data.debugPanelVisible })
  },

  onSelectDebugMode(e: WechatMiniprogram.TouchEvent) {
    const mode = (e.currentTarget.dataset.mode || 'auto') as 'auto' | 'initial' | 'today'
    wx.setStorageSync(DEBUG_VIEW_MODE_KEY, mode)
    this.setData({ debugViewMode: mode, debugPanelVisible: false })
    this.applyDebugViewMode(this.data.showSetupBanner)
  },

  onGoSetup() {
    wx.navigateTo({ url: '/pages/home/home' })
  },

  /** 宝宝信息栏：本周计划 / 本周计划总览 */
  onBabyBarThisWeek() {
    const { weekStartDate, babyBirthday, thisWeekStatus } = this.data
    const age = babyBirthday ? `&babyBirthday=${encodeURIComponent(babyBirthday)}` : ''
    if (thisWeekStatus !== 'generated') {
      wx.navigateTo({ url: `/pages/week/week?weekStartDate=${weekStartDate}&needConfirm=1${age}` })
      return
    }
    wx.navigateTo({ url: `/pages/weekSummary/weekSummary?weekStartDate=${weekStartDate}${age}` })
  },

  /** 宝宝信息栏：下周计划 / 下周计划总览 */
  onBabyBarNextWeek() {
    const { nextWeekStartDate, babyBirthday, nextWeekStatus } = this.data
    const age = babyBirthday ? `&babyBirthday=${encodeURIComponent(babyBirthday)}` : ''
    if (nextWeekStatus !== 'generated') {
      wx.navigateTo({ url: `/pages/week/week?weekStartDate=${nextWeekStartDate}&needConfirm=1${age}` })
      return
    }
    wx.navigateTo({ url: `/pages/weekSummary/weekSummary?weekStartDate=${nextWeekStartDate}&isNextWeek=1${age}` })
  },

  onBabyNameInput(e: WechatMiniprogram.Input) {
    this.setData({ babyName: e.detail.value })
  },

  onBirthdayChange(e: WechatMiniprogram.PickerChange) {
    const val = (e.detail && e.detail.value) || ''
    const ageMonths = calcAgeMonths(val)
    const ageTooYoung = !!val && ageMonths < 5
    this.setData({
      babyBirthday: val,
      birthdayValid: !!val,
      ageTooYoung,
    })
  },

  onTeethStageTap(e: WechatMiniprogram.TouchEvent) {
    const stage = (e.currentTarget.dataset as Record<string, string>).stage || ''
    this.setData({ teethStage: stage === this.data.teethStage ? '' : stage })
  },

  onAddAllergen() {
    const { allergens } = this.data
    const modalCommonSelected: Record<string, boolean> = {}
    COMMON_ALLERGENS.forEach((name) => {
      modalCommonSelected[name] = allergens.includes(name)
    })
    const modalCustomList = allergens.filter((a) => !COMMON_ALLERGENS.includes(a))
    this.setData({
      allergenModalVisible: true,
      modalCommonSelected,
      modalCustomList,
      customAllergenInput: '',
    })
  },

  onAllergenModalClose() {
    this.setData({ allergenModalVisible: false })
  },

  onToggleCommonAllergen(e: WechatMiniprogram.TouchEvent) {
    const name = (e.currentTarget.dataset as Record<string, string>).name
    const modalCommonSelected = { ...this.data.modalCommonSelected }
    modalCommonSelected[name] = !modalCommonSelected[name]
    this.setData({ modalCommonSelected })
  },

  onCustomAllergenInput(e: WechatMiniprogram.Input) {
    this.setData({ customAllergenInput: e.detail.value })
  },

  onAddCustomAllergen() {
    const name = (this.data.customAllergenInput || '').trim()
    if (!name) return
    if (this.data.modalCustomList.includes(name) || COMMON_ALLERGENS.includes(name)) {
      wx.showToast({ title: '已添加过该食材', icon: 'none' })
      return
    }
    const modalCustomList = [...this.data.modalCustomList, name]
    this.setData({ modalCustomList, customAllergenInput: '' })
  },

  onRemoveCustomModal(e: WechatMiniprogram.TouchEvent) {
    const idx = e.currentTarget.dataset.index as number
    if (idx == null) return
    const modalCustomList = this.data.modalCustomList.filter((_, i) => i !== idx)
    this.setData({ modalCustomList })
  },

  onAllergenModalConfirm() {
    const { modalCommonSelected, modalCustomList } = this.data
    const selected = COMMON_ALLERGENS.filter((name) => modalCommonSelected[name])
    const allergens = [...selected, ...modalCustomList]
    this.setData({ allergens, allergenModalVisible: false })
  },

  onRemoveAllergen(e: WechatMiniprogram.TouchEvent) {
    const idx = e.currentTarget.dataset.index as number
    if (idx == null) return
    const allergens = (this.data.allergens || []).filter((_, i) => i !== idx)
    this.setData({ allergens })
  },

  async onGenerateThisWeek() {
    const { babyName, babyBirthday, allergens, weekStartDate, onboardingGenerating, todayDateStr } = this.data
    if (!babyBirthday) {
      wx.showToast({ title: '👉 先选择宝宝生日', icon: 'none' })
      return
    }
    if (babyBirthday > todayDateStr) {
      wx.showToast({ title: '宝宝生日不能晚于今天', icon: 'none' })
      return
    }
    const ageMonths = calcAgeMonths(babyBirthday)
    const feedingStage = getFeedingStage(ageMonths)
    if (feedingStage === 'too_young') {
      wx.showToast({ title: '宝宝当前月龄较小，暂不建议生成辅食计划', icon: 'none', duration: 3000 })
      return
    }
    if (onboardingGenerating) return
    this.setData({ onboardingGenerating: true })
    const saveRes = await callCloud(
      'savePreferences',
      {
        babyName: babyName.trim(),
        babyBirthday,
        allergyIngredientNames: allergens || [],
        ageMonths,
        feedingStage,
        teethStage: this.data.teethStage || '',
      },
      { showLoading: false }
    )
    if (!saveRes.success) {
      this.setData({ onboardingGenerating: false })
      wx.showToast({ title: '我这边有点忙，稍后再试一次～', icon: 'none' })
      return
    }
    const weekStart = weekStartDate || getThisMonday()
    if (getUseMockWeekPlan()) {
      const weekDates = getWeekDates(weekStart)
      const result = generateMockWeekPlan(3, weekDates)
      wx.setStorageSync('mockWeekPlan', JSON.stringify(result))
      this.setData({ onboardingGenerating: false })
      const ageParam = babyBirthday ? `&babyBirthday=${encodeURIComponent(babyBirthday)}` : ''
      wx.navigateTo({
        url: `/pages/week/week?weekStartDate=${weekStart}&needConfirm=1&useMock=1${ageParam}`,
      })
      return
    }
    const genRes = await callCloud(
      'generateNextWeek',
      { nextWeekStartDate: weekStart },
      { showLoading: true, loadingTitle: '正在帮你生成…' }
    )
    this.setData({ onboardingGenerating: false })
    if (genRes.success || genRes.code === 'WEEK_ALREADY_EXISTS') {
      const ageParam = babyBirthday ? `&babyBirthday=${encodeURIComponent(babyBirthday)}` : ''
      wx.navigateTo({ url: `/pages/week/week?weekStartDate=${weekStart}&needConfirm=1${ageParam}` })
    } else if (genRes.code === 'MISSING_BABY_AGE') {
      wx.showToast({ title: '👉 先选择宝宝生日', icon: 'none' })
    } else {
      wx.showToast({ title: '我这边有点忙，稍后再试一次～', icon: 'none' })
    }
  },

  onGoDayEdit() {
    const { today, weekStartDate } = this.data
    if (!today || !weekStartDate) return
    wx.navigateTo({
      url: `/pages/templateEdit/templateEdit?mode=day&dayId=${today}&weekStartDate=${weekStartDate}`,
    })
  },

  onGoWeekPlan() {
    const { babyBirthday } = this.data
    const q = babyBirthday ? `?babyBirthday=${encodeURIComponent(babyBirthday)}` : ''
    wx.navigateTo({ url: `/pages/week/week${q}` })
  },

  onDishDetail(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset as Record<string, string>
    const rid = (ds.recipeid || ds.recipeId) as string | undefined
    const num = detailNumericId(rid)
    if (num == null) {
      wx.showToast({ title: '暂无菜谱详情', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/recipeDetail/recipeDetail?id=${num}` })
  },

  onToggleDone(e: WechatMiniprogram.TouchEvent) {
    const { dishkey, mealkey, recipeid, recipename } = e.currentTarget.dataset as Record<string, string>
    const dishKey = dishkey as string
    const mealKey = mealkey as string
    const recipeId = (recipeid as string) || ''
    const recipeName = (recipename as string) || ''
    const date = this.data.today
    if (!dishKey || !mealKey || !date) return

    const groups = this.data.mealGroups || []
    let dish: DishRow | null = null
    for (const g of groups) {
      const d = g.dishes.find((x) => x.dishKey === dishKey)
      if (d) {
        dish = d
        break
      }
    }
    if (!dish) return
    const nextDone = !dish.done

    if (nextDone) {
      callCloud(
        'logMealDone',
        { date, mealKey, recipeId, recipeName: recipeName || dish.name },
        { showLoading: false }
      ).then((res: any) => {
        if (res?.success) {
          wx.setStorageSync(doneStorageKey(date, dishKey), true)
          this.patchDishDone(dishKey, true)
        } else {
          wx.showToast({ title: '记录失败', icon: 'none' })
        }
      })
    } else {
      wx.removeStorageSync(doneStorageKey(date, dishKey))
      this.patchDishDone(dishKey, false)
    }
  },

  patchDishDone(dishKey: string, done: boolean) {
    const mealGroups = (this.data.mealGroups || []).map((g) => ({
      ...g,
      dishes: g.dishes.map((d) => (d.dishKey === dishKey ? { ...d, done } : d)),
    }))
    this.setData({ mealGroups })
  },

  findDish(dishKey: string): DishRow | null {
    for (const g of this.data.mealGroups || []) {
      const d = g.dishes.find((x) => x.dishKey === dishKey)
      if (d) return d
    }
    return null
  },

  /** 长按菜名：可标记宝宝喜欢 / 收藏（与仅展示标签配合） */
  onDishNameLongPress(e: WechatMiniprogram.TouchEvent) {
    const dishKey = (e.currentTarget.dataset as Record<string, string>).dishkey
    if (!dishKey) return
    wx.showActionSheet({
      itemList: ['宝宝喜欢', '收藏'],
      success: (res) => {
        if (res.tapIndex === 0) this.toggleBabyLikeForDishKey(dishKey)
        else if (res.tapIndex === 1) this.toggleFavoriteForDishKey(dishKey)
      },
    })
  },

  toggleBabyLikeForDishKey(dishKey: string) {
    const date = this.data.today
    if (!dishKey || !date) return
    const dish = this.findDish(dishKey)
    if (!dish) return
    const next = !dish.babyLike
    if (next) {
      wx.setStorageSync(babyLikeStorageKey(date, dishKey), true)
    } else {
      wx.removeStorageSync(babyLikeStorageKey(date, dishKey))
    }
    this.patchDishBabyLike(dishKey, next)
    wx.showToast({ title: next ? '已标记宝宝喜欢' : '已取消宝宝喜欢', icon: 'none' })
  },

  toggleFavoriteForDishKey(dishKey: string) {
    const date = this.data.today
    if (!dishKey || !date) return
    const dish = this.findDish(dishKey)
    if (!dish) return
    const next = !dish.favorite
    if (next) {
      wx.setStorageSync(favoriteStorageKey(date, dishKey), true)
    } else {
      wx.removeStorageSync(favoriteStorageKey(date, dishKey))
    }
    this.patchDishFavorite(dishKey, next)
    wx.showToast({ title: next ? '已标记收藏' : '已取消收藏', icon: 'none' })
  },

  onToggleBabyLike(e: WechatMiniprogram.TouchEvent) {
    const dishKey = (e.currentTarget.dataset as Record<string, string>).dishkey
    this.toggleBabyLikeForDishKey(dishKey)
  },

  onToggleFavorite(e: WechatMiniprogram.TouchEvent) {
    const dishKey = (e.currentTarget.dataset as Record<string, string>).dishkey
    this.toggleFavoriteForDishKey(dishKey)
  },

  patchDishBabyLike(dishKey: string, babyLike: boolean) {
    const mealGroups = (this.data.mealGroups || []).map((g) => ({
      ...g,
      dishes: g.dishes.map((d) => (d.dishKey === dishKey ? { ...d, babyLike } : d)),
    }))
    this.setData({ mealGroups })
  },

  patchDishFavorite(dishKey: string, favorite: boolean) {
    const mealGroups = (this.data.mealGroups || []).map((g) => ({
      ...g,
      dishes: g.dishes.map((d) => (d.dishKey === dishKey ? { ...d, favorite } : d)),
    }))
    this.setData({ mealGroups })
  },

  onGoToAllergySettings() {
    wx.navigateTo({ url: '/pages/allergyMode/allergyMode' })
  },

  async onRecordOk(e: WechatMiniprogram.TouchEvent) {
    const { ingredient, day, totaldays } = e.currentTarget.dataset as Record<string, any>
    if (!ingredient || !day) return
    const result = await callCloud(
      'recordAllergyObservation',
      { ingredient, day: Number(day), result: 'ok', weekStartDate: this.data.weekStartDate },
      { showLoading: false }
    )
    if (result.success) {
      wx.showToast({ title: result.message || '已记录', icon: 'none' })
      await this.loadTodayData()
    } else {
      wx.showToast({ title: '记录失败，请重试', icon: 'none' })
    }
  },

  onOpenAnomalyDialog(e: WechatMiniprogram.TouchEvent) {
    const { ingredient, day } = e.currentTarget.dataset as Record<string, any>
    if (!ingredient || !day) return
    this.setData({
      showAnomalyDialog: true,
      anomalySymptoms: [],
      anomalyDishKey: `${ingredient}|${day}`,
    })
  },

  onCloseAnomalyDialog() {
    this.setData({ showAnomalyDialog: false, anomalySymptoms: [], anomalyDishKey: '' })
  },

  onToggleSymptom(e: WechatMiniprogram.TouchEvent) {
    const symptom = (e.currentTarget.dataset as Record<string, string>).symptom
    if (!symptom) return
    const current = this.data.anomalySymptoms || []
    const next = current.includes(symptom)
      ? current.filter((s) => s !== symptom)
      : [...current, symptom]
    this.setData({ anomalySymptoms: next })
  },

  async onConfirmAnomaly() {
    const key = this.data.anomalyDishKey || ''
    const parts = key.split('|')
    const ingredient = parts[0]
    const day = parseInt(parts[1] || '1', 10)
    if (!ingredient || !day) return
    const symptoms = this.data.anomalySymptoms || []
    this.setData({ showAnomalyDialog: false })
    const result = await callCloud(
      'recordAllergyObservation',
      { ingredient, day, result: 'anomaly', symptoms, weekStartDate: this.data.weekStartDate },
      { showLoading: false }
    )
    if (result.success) {
      wx.showToast({ title: '已记录异常，该食材已暂停添加', icon: 'none', duration: 2500 })
      await this.loadTodayData()
    } else {
      wx.showToast({ title: '记录失败，请重试', icon: 'none' })
    }
  },
})
