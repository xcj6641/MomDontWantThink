// pages/week/week.ts
const { callCloud } = require('../../utils/cloud.js')
const { getOrderedSlotsForAge, SLOT_ORDER, MEAL_LABELS: CONFIG_MEAL_LABELS } = require('../../utils/ageMealConfig.js')
const { generateMockWeekPlan, getWeekDates, getWeekdayLabel, mockRecipes } = require('../../utils/weekPlanMock.js')

const MEAL_LABELS: Record<string, string> = { ...CONFIG_MEAL_LABELS }

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日']
/** 母婴感配色：绿 / 蓝 / 橙 + 扩展 */
const TEMPLATE_COLORS = ['#7FB77E', '#7EA9D6', '#E8A87C', '#A88BC0', '#7EC8C8', '#E8A8B8', '#9E9E9E']
/** 对应浅色背景（日期块/卡片头） */
const TEMPLATE_BG_COLORS = ['#EAF7EF', '#EEF5FF', '#FFF3EB', '#F3EFF8', '#E8F7F7', '#FFEEF3', '#F2F2F2']

/** 根据生日字符串 YYYY-MM-DD 计算当前月龄（整数月） */
function getAgeMonthsFromBirthday(birthday: string): number | null {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null
  const birth = new Date(birthday + 'T12:00:00')
  const now = new Date()
  if (birth.getTime() > now.getTime()) return null
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  return Math.max(0, months)
}

/** full_reset 固定方案表（与产品一致）：1套7 / 2套4-3 / 3套2-3-2 / 4套2-2-2-1 / 5套2-1-2-1-1 / 6套1-1-2-1-1-1 / 7套1-1-1-1-1-1-1 */
function getDefaultDayAssignments(menuCount: number): number[] {
  const table: Record<number, number[]> = {
    1: [1, 1, 1, 1, 1, 1, 1],
    2: [1, 1, 1, 1, 2, 2, 2],
    3: [1, 1, 2, 2, 2, 3, 3],
    4: [1, 1, 2, 2, 3, 3, 4],
    5: [1, 1, 2, 3, 3, 4, 5],
    6: [1, 2, 3, 3, 4, 5, 6],
    7: [1, 2, 3, 4, 5, 6, 7],
  }
  const n = Math.min(7, Math.max(1, Math.floor(menuCount) || 1))
  return (table[n] || table[3]).slice(0, 7)
}

Page({
  data: {
    weekStartDate: '',
    isNextWeek: false as boolean,
    needConfirm: false as boolean,
    weekConfirmed: false as boolean,
    loading: true as boolean,
    babyAgeMonths: null as number | null,
    mealSlots: [] as string[],
    settingsSummary: '' as string,
    settingsN: 0 as number,
    /** 顶部内联备餐设置 */
    settingsNVal: 3 as number,
    settingsSelectedIndex: 1 as number,
    settingsDayBindings: [1, 1, 2, 2, 2, 3, 3] as number[],
    settingsTemplateIds: [] as string[],
    settingsTabList: [0, 1, 2] as number[],
    settingsDayCellList: [] as Array<{ day: number; weekday: string; shortLabel: string; binding: number; isCurrent: boolean; isUnassigned: boolean; bgStyle: string }>,
    /** 日期分配分布文案，如 "2-3-2"、"4-3-0" */
    settingsDistributionText: '' as string,
    settingsSaving: false as boolean,
    showMenuCountModal: false as boolean,
    /** 弹框打开时的当前套数 */
    menuCountModalOpenN: 3 as number,
    /** 弹框打开时的日期分配快照 */
    menuCountModalOpenDayBindings: [] as number[],
    settingsTemplateColors: TEMPLATE_COLORS as string[],
    settingsTemplateBgColors: TEMPLATE_BG_COLORS as string[],
    /** 实际渲染的卡片列表（随 settingsNVal 增减，可能含占位卡） */
    displayTemplateCards: [] as Array<{
      templateId: string
      templateName: string
      weekdaysLabel: string
      datesCompactLabel: string
      dateChips: Array<{ date: string; weekdayLabel: string }>
      meals: Array<{ mealKey: string; mealLabel: string; mealLabelDisplay: string; recipeName: string; blw: boolean; overrideSuffix: string; hasOverride: boolean }>
      isPlaceholder?: boolean
    }>,
    templateCards: [] as Array<{
      templateId: string
      templateName: string
      weekdaysLabel: string
      dateChips: Array<{ date: string; weekdayLabel: string }>
      meals: Array<{ mealKey: string; mealLabel: string; recipeName: string; blw: boolean; overrideSuffix: string; hasOverride: boolean }>
    }>,
    firstTemplateId: '' as string,
    days: [] as Array<{
      date: string
      weekday: string
      templateName?: string
      meals: Array<{ mealKey: string; mealLabel?: string; recipeName: string; blw: boolean }>
    }>,
    /** Mock 周计划（用于分配日期弹框、prep 编辑页） */
    useMockPlan: false as boolean,
    mockWeekPlan: null as { weekStart: string; prepCount: number; items: Array<{ id: string; recipeId: number; recipeName: string; assignedDates: string[]; assignedDateText: string; status: string }> } | null,
    /** 分配日期弹框 */
    showAssignDateModal: false as boolean,
    assignDatePrepId: '' as string,
    assignDateLabels: '' as string,
  },

  onLoad(opt: { weekStartDate?: string; needConfirm?: string; useMock?: string; babyBirthday?: string; babyAgeMonths?: string }) {
    const weekStartDate = opt?.weekStartDate || this.getThisMonday()
    const isNextWeek = weekStartDate === this.getNextMonday()
    const ageFromParam = opt?.babyAgeMonths != null && opt.babyAgeMonths !== '' ? parseInt(opt.babyAgeMonths, 10) : null
    const ageFromBirthday = opt?.babyBirthday ? getAgeMonthsFromBirthday(opt.babyBirthday) : null
    const babyAgeMonths = (ageFromParam != null && !isNaN(ageFromParam))
      ? ageFromParam
      : (ageFromBirthday != null ? ageFromBirthday : null)
    wx.setNavigationBarTitle({ title: isNextWeek ? '下周计划' : '本周计划' })
    this.setData({
      weekStartDate,
      isNextWeek,
      needConfirm: opt?.needConfirm === '1',
      babyAgeMonths: babyAgeMonths ?? this.data.babyAgeMonths,
    })
    if (opt?.useMock === '1') {
      try {
        const raw = wx.getStorageSync('mockWeekPlan')
        const result = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { weekPlan?: { weekStart?: string; prepCount?: number; items?: any[] } } | null
        if (result?.weekPlan?.items?.length) {
          (this as any)._skipNextLoadWeekData = true
          this.applyMockWeekPlan(result as any, weekStartDate)
          this.setData({ loading: false, useMockPlan: true })
          return
        }
      } catch (_) {}
    }
    this.loadWeekData()
  },

  onShow() {
    if ((this as any)._skipNextLoadWeekData) {
      (this as any)._skipNextLoadWeekData = false
      return
    }
    if (this.data.useMockPlan) return
    if (this.data.weekStartDate) this.loadWeekData()
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

  formatDate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  },

  addDays(dateStr: string, n: number): string {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() + n)
    return this.formatDate(d)
  },

  /**
   * 应用 Mock 周计划到页面状态（驱动卡片、日期分配、菜谱名展示与跳转）
   */
  applyMockWeekPlan(
    result: { weekPlan: { weekStart: string; prepCount: number; items: Array<{ id: string; recipeId: number; recipeName: string; assignedDates: string[]; assignedDateText: string; status: string }> } },
    weekStartDate: string
  ) {
    const { weekPlan } = result
    const age = this.data.babyAgeMonths != null ? this.data.babyAgeMonths : 8
    const slotsFromAge = getOrderedSlotsForAge(age) as string[]
    const mealSlots = slotsFromAge.length > 0 ? slotsFromAge : (SLOT_ORDER as string[])
    const settingsDayBindings: number[] = []
    for (let d = 0; d < 7; d++) {
      const date = this.addDays(weekStartDate, d)
      const idx = weekPlan.items.findIndex((it) => it.assignedDates && it.assignedDates.indexOf(date) >= 0)
      settingsDayBindings.push(idx >= 0 ? idx + 1 : 0)
    }
    const templateCards = weekPlan.items.map((item, idx) => {
      const recipesPerMeal = idx === 0 ? (item as any).recipesPerMeal : null
      return {
        templateId: item.id,
        templateName: `备餐${idx + 1}`,
        weekdaysLabel: item.assignedDates.map((d) => getWeekdayLabel(d)).join(' '),
        dateChips: item.assignedDates.map((date) => ({ date, weekdayLabel: getWeekdayLabel(date) })),
        meals: mealSlots.map((mealKey) => {
          let recipeName = item.recipeName
          if (recipesPerMeal) {
            const slotIndex = (SLOT_ORDER as string[]).indexOf(mealKey)
            const ids = slotIndex >= 0 && recipesPerMeal[slotIndex] ? recipesPerMeal[slotIndex] : [item.recipeId]
            const names = ids.map((id: number) => (mockRecipes || []).find((r: { id: number; name: string }) => r.id === id)?.name).filter(Boolean)
            if (names.length) recipeName = names.join(' · ')
          }
          return {
            mealKey,
            mealLabel: MEAL_LABELS[mealKey] || mealKey,
            recipeName,
            blw: mealKey === 'lunch',
            overrideSuffix: '',
            hasOverride: false,
          }
        }),
        recipeId: item.recipeId,
      }
    })
    const settingsNVal = weekPlan.prepCount
    const settingsTemplateIds = weekPlan.items.map((i) => i.id)
    const settingsTabList = Array.from({ length: settingsNVal }, (_, i) => i)
    wx.setStorageSync('mockWeekPlan', JSON.stringify(result))
    this.setData({
      templateCards,
      settingsNVal,
      settingsDayBindings,
      settingsTemplateIds,
      settingsTabList,
      settingsSelectedIndex: 1,
      mealSlots,
      mockWeekPlan: weekPlan,
      babyAgeMonths: this.data.babyAgeMonths != null ? this.data.babyAgeMonths : age,
    }, () => {
      this.refreshSettingsDayCellList()
      this.refreshDisplayTemplateCards()
    })
  },

  /** 空态下点击「生成本周计划」：按当前选择的备餐数生成 Mock 并应用 */
  onGenerateMockPlan() {
    const weekStartDate = this.data.weekStartDate
    const prepCount = this.data.settingsNVal || 3
    const weekDates = getWeekDates(weekStartDate)
    const result = generateMockWeekPlan(prepCount, weekDates)
    this.applyMockWeekPlan(result, weekStartDate)
    this.setData({ useMockPlan: true })
    wx.showToast({ title: '已生成 Mock 周计划', icon: 'none' })
  },

  /** 分配日期弹框：打开 */
  onOpenAssignDateModal(e: WechatMiniprogram.TouchEvent) {
    const prepId = (e.currentTarget.dataset.prepId as string) || ''
    const mock = this.data.mockWeekPlan
    const item = mock && mock.items ? mock.items.find((i) => i.id === prepId) : null
    const assignDateLabels = item ? item.assignedDateText : ''
    this.setData({
      showAssignDateModal: true,
      assignDatePrepId: prepId,
      assignDateLabels,
    })
  },

  /** 分配日期弹框：关闭 */
  onCloseAssignDateModal() {
    this.setData({ showAssignDateModal: false, assignDatePrepId: '', assignDateLabels: '' })
  },

  /** 点击菜谱名 -> 菜谱详情页 */
  onRecipeNameTap(e: WechatMiniprogram.TouchEvent) {
    const recipeId = e.currentTarget.dataset.recipeId
    if (recipeId != null && recipeId !== '') {
      wx.navigateTo({ url: `/pages/recipeDetail/recipeDetail?id=${recipeId}` })
    }
  },

  /** 点击卡片空白区域 -> Mock 下进 prepEdit，否则进 templateEdit（餐次名点击见 onMealSlotTap，统一进备餐编辑） */
  onCardTap(e: WechatMiniprogram.TouchEvent) {
    const prepId = (e.currentTarget.dataset.prepId as string) || ''
    if (!prepId) return
    if (this.data.useMockPlan) {
      wx.navigateTo({ url: `/pages/prepEdit/prepEdit?id=${prepId}` })
    } else {
      const age = this.data.babyAgeMonths
      const ageParam = age != null && age !== '' ? `&babyAgeMonths=${age}` : ''
      wx.navigateTo({ url: `/pages/templateEdit/templateEdit?templateId=${prepId}${ageParam}` })
    }
  },

  /** 点击餐次名（早餐/午餐等）-> 与三点菜单「编辑备餐」一致，进入 templateEdit */
  onMealSlotTap(e: WechatMiniprogram.TouchEvent) {
    const templateId = (e.currentTarget.dataset.templateId as string) || ''
    const cardIndex = Number(e.currentTarget.dataset.cardIndex)
    const isPlaceholder = e.currentTarget.dataset.isPlaceholder === true
    if (isPlaceholder || !templateId) return
    const cards = this.data.displayTemplateCards || []
    const templateName =
      cards[cardIndex] && cards[cardIndex].templateName ? cards[cardIndex].templateName : `备餐${cardIndex + 1}`
    const nameParam = templateName ? `&templateName=${encodeURIComponent(templateName)}` : ''
    const mockParam = this.data.useMockPlan ? '&useMock=1' : ''
    const age = this.data.babyAgeMonths
    const ageParam = age != null && age !== '' ? `&babyAgeMonths=${age}` : ''
    wx.navigateTo({
      url: `/pages/templateEdit/templateEdit?templateId=${templateId}${nameParam}${mockParam}${ageParam}`,
    })
  },

  /** §12.2 压缩日期显示：连续 "周一–周三"，不连续 "周二、周四"，空 "暂未使用" */
  compressDateLabels(weekdayLabels: string[]): string {
    if (weekdayLabels.length === 0) return '暂未使用'
    const order = WEEKDAYS
    const indices = weekdayLabels.map((l) => order.indexOf(l)).filter((i) => i >= 0).sort((a, b) => a - b)
    if (indices.length === 0) return '暂未使用'
    const runs: number[][] = []
    let run: number[] = [indices[0]]
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] === run[run.length - 1] + 1) run.push(indices[i])
      else {
        runs.push(run)
        run = [indices[i]]
      }
    }
    runs.push(run)
    const parts = runs.map((r) => {
      if (r.length >= 2) return `${order[r[0]]}–${order[r[r.length - 1]]}`
      return order[r[0]]
    })
    return parts.join('、')
  },

  /** 根据 settingsNVal 与 templateCards 生成要展示的卡片列表（数量与 N 一致） */
  refreshDisplayTemplateCards() {
    const N = this.data.settingsNVal || 0
    const templateCards = this.data.templateCards || []
    const mealSlots = this.data.mealSlots || []
    const weekStartDate = this.data.weekStartDate
    const dayBindings = this.data.settingsDayBindings || []
    const displayTemplateCards: Array<{
      templateId: string
      templateName: string
      weekdaysLabel: string
      datesCompactLabel: string
      dateChips: Array<{ date: string; weekdayLabel: string }>
      meals: Array<{ mealKey: string; mealLabel: string; mealLabelDisplay: string; recipeName: string; blw: boolean; overrideSuffix: string; hasOverride: boolean }>
      isPlaceholder?: boolean
      recipeId?: number
    }> = []
    const MEAL_LABELS_LOCAL: Record<string, string> = { ...CONFIG_MEAL_LABELS }
    for (let i = 0; i < N; i++) {
      const idx = i + 1
      const datesForThis: string[] = []
      for (let d = 0; d < 7; d++) {
        if ((dayBindings[d] || 0) === idx) datesForThis.push(this.addDays(weekStartDate, d))
      }
      const dateChipsFromBindings = datesForThis.map((date) => {
        const d = new Date(date + 'T12:00:00')
        const dayNum = d.getDay()
        const iDay = dayNum === 0 ? 6 : dayNum - 1
        return { date, weekdayLabel: WEEKDAYS[iDay] || '' }
      })
      const datesCompactLabel = this.compressDateLabels(dateChipsFromBindings.map((c) => c.weekdayLabel))
      if (i < templateCards.length) {
        const card = templateCards[i]
        const meals = (card.meals || []).map((m) => ({
          ...m,
          mealLabelDisplay: (m.mealLabel || '') + (m.blw ? '[BLW]' : ''),
        }))
        displayTemplateCards.push({
          ...card,
          dateChips: dateChipsFromBindings,
          weekdaysLabel: dateChipsFromBindings.map((c) => c.weekdayLabel).join(' '),
          datesCompactLabel,
          meals,
          isPlaceholder: false,
          recipeId: (card as any).recipeId,
        })
      } else {
        const meals = mealSlots.map((mealKey) => ({
          mealKey,
          mealLabel: MEAL_LABELS_LOCAL[mealKey] || mealKey,
          mealLabelDisplay: MEAL_LABELS_LOCAL[mealKey] || mealKey,
          recipeName: '—',
          blw: false,
          overrideSuffix: '',
          hasOverride: false,
        }))
        displayTemplateCards.push({
          templateId: '',
          templateName: `备餐${idx}`,
          weekdaysLabel: dateChipsFromBindings.map((c) => c.weekdayLabel).join(' '),
          datesCompactLabel,
          dateChips: dateChipsFromBindings,
          meals,
          isPlaceholder: true,
        })
      }
    }
    this.setData({ displayTemplateCards })
  },

  /** 计算每组备餐天数分布，如 "2-3-2"、"4-3-0" */
  computeDistributionText(): string {
    const N = this.data.settingsNVal || 0
    const dayBindings = this.data.settingsDayBindings || []
    const counts: number[] = []
    for (let i = 0; i < N; i++) counts[i] = 0
    for (let d = 0; d < 7; d++) {
      const v = dayBindings[d] || 0
      if (v >= 1 && v <= N) counts[v - 1]++
    }
    return counts.join('-')
  },

  /** 刷新顶部 7 天格子展示（归属颜色/当前，母婴感浅色底） */
  refreshSettingsDayCellList() {
    const dayBindings = this.data.settingsDayBindings || []
    const selected = this.data.settingsSelectedIndex
    const N = this.data.settingsNVal || 0
    const mainColors = TEMPLATE_COLORS
    const bgColors = TEMPLATE_BG_COLORS
    const dayCellList = WEEKDAYS.map((weekday, i) => {
      const day = i + 1
      const binding = dayBindings[i] || 0
      const isUnassigned = !binding || binding < 1 || binding > N
      const isCurrent = binding === selected
      let bgStyle = ''
      if (!isUnassigned) {
        const idx = (binding - 1) % mainColors.length
        const bgHex = bgColors[idx] || '#f5f5f5'
        const mainHex = mainColors[idx] || '#333'
        bgStyle = isCurrent
          ? `background: ${mainHex}; color: #fff;`
          : `background: ${bgHex}; color: ${mainHex};`
      }
      return {
        day,
        weekday,
        shortLabel: WEEKDAY_SHORT[i] || '',
        binding,
        isCurrent,
        isUnassigned,
        bgStyle,
      }
    })
    const settingsDistributionText = this.computeDistributionText()
    this.setData({ settingsDayCellList: dayCellList, settingsDistributionText })
  },

  /**
   * 自动日期分配（最终确认版，见 instruction/自动日期分配规则.md）
   * full_reset：使用固定默认方案表
   * fill_empty / redistribute_removed：优先天数最少，其次连续性，最后编号最小
   */
  autoAssignDays(bindings: number[], menuCount: number, mode: 'full_reset' | 'fill_empty' | 'redistribute_removed'): number[] {
    if (mode === 'full_reset') return getDefaultDayAssignments(menuCount)
    const result = [...bindings]
    if (mode === 'redistribute_removed') {
      for (let i = 0; i < 7; i++) {
        if (result[i] > menuCount || result[i] < 1) result[i] = 0
      }
      return this.fillEmptyBalanceFirst(result, menuCount)
    }
    return this.fillEmptyBalanceFirst(result, menuCount)
  },

  /**
   * fill_empty：优先当前绑定天数最少的备餐；天数相同则优先前一天、后一天连续性；再同则编号最小。
   */
  fillEmptyBalanceFirst(bindings: number[], N: number): number[] {
    const result = [...bindings]
    const counts: number[] = Array.from({ length: N }, () => 0)
    for (let i = 0; i < 7; i++) {
      if (result[i] >= 1 && result[i] <= N) counts[result[i] - 1]++
    }
    for (let i = 0; i < 7; i++) {
      if (result[i] >= 1 && result[i] <= N) continue
      result[i] = 0
      let minC = counts[0]
      for (let j = 1; j < N; j++) if (counts[j] < minC) minC = counts[j]
      const candidateMenus: number[] = []
      for (let j = 0; j < N; j++) if (counts[j] === minC) candidateMenus.push(j + 1)
      const prevMenu = i > 0 && result[i - 1] >= 1 && result[i - 1] <= N ? result[i - 1] : null
      const nextMenu = i < 6 && result[i + 1] >= 1 && result[i + 1] <= N ? result[i + 1] : null
      let target: number
      if (prevMenu != null && candidateMenus.indexOf(prevMenu) >= 0) {
        target = prevMenu
      } else if (nextMenu != null && candidateMenus.indexOf(nextMenu) >= 0) {
        target = nextMenu
      } else {
        target = Math.min(...candidateMenus)
      }
      result[i] = target
      counts[target - 1]++
    }
    return result
  },

  /** 均匀分配未分配或越界的日期（仅当无连续优先逻辑时使用） */
  evenDistributeSettings(bindings: number[], N: number): number[] {
    const count: number[] = []
    for (let i = 0; i < N; i++) count[i] = 0
    const result = [...bindings]
    for (let i = 0; i < 7; i++) {
      if (result[i] >= 1 && result[i] <= N) count[result[i] - 1]++
    }
    for (let i = 0; i < 7; i++) {
      if (result[i] === 0 || result[i] > N) result[i] = 0
    }
    const unassigned: number[] = []
    for (let i = 0; i < 7; i++) {
      if (result[i] === 0) unassigned.push(i)
    }
    for (const idx of unassigned) {
      let minC = count[0]
      let minJ = 0
      for (let j = 1; j < N; j++) {
        if (count[j] < minC) {
          minC = count[j]
          minJ = j
        }
      }
      result[idx] = minJ + 1
      count[minJ]++
    }
    return result
  },

  /** 打开备餐套数弹框（整行点击触发），保存当前 N 与日期分配快照 */
  onOpenMenuCountModal() {
    const openN = this.data.settingsNVal || 3
    const openDayBindings = [...(this.data.settingsDayBindings || [0, 0, 0, 0, 0, 0, 0])]
    this.setData({
      showMenuCountModal: true,
      menuCountModalOpenN: openN,
      menuCountModalOpenDayBindings: openDayBindings,
    })
  },

  onCloseMenuCountModal() {
    this.setData({ showMenuCountModal: false })
  },

  /** 弹框内选择 N 套：一律按固定方案表分配 */
  onSelectMenuCountInModal(e: WechatMiniprogram.TouchEvent) {
    const newN = Number(e.currentTarget.dataset.n) || 3
    this.applyMenuCountChange(newN)
  },

  /** 弹框内点击保存（无计划时仅关闭弹框；Mock 模式不调云端，只关弹框并提示） */
  onSaveSettingsInModal() {
    if (!this.data.templateCards || this.data.templateCards.length === 0) {
      this.setData({ showMenuCountModal: false })
      return
    }
    if (this.data.useMockPlan) {
      this.setData({ showMenuCountModal: false })
      wx.showToast({ title: '备餐数已更新', icon: 'none' })
      return
    }
    this.onSaveSettings()
  },

  /** 弹框内改套数：Mock 模式按 newN 重新生成完整 Mock 计划（含新备餐的菜谱与日期）；非 Mock 按固定方案表分配 */
  applyMenuCountChange(newN: number) {
    if (this.data.useMockPlan && this.data.weekStartDate) {
      const weekDates = getWeekDates(this.data.weekStartDate)
      const result = generateMockWeekPlan(newN, weekDates)
      this.applyMockWeekPlan(result, this.data.weekStartDate)
      return
    }
    const dayBindings = getDefaultDayAssignments(newN)
    const tabList = Array.from({ length: newN }, (_, i) => i)
    const templateIds = (this.data.settingsTemplateIds || []).slice(0, newN)
    this.setData({
      settingsNVal: newN,
      settingsDayBindings: dayBindings,
      settingsTabList: tabList,
      settingsTemplateIds: templateIds,
    }, () => {
      this.refreshSettingsDayCellList()
      this.refreshDisplayTemplateCards()
    })
  },

  onSettingsTabTap(e: WechatMiniprogram.TouchEvent) {
    const index = (e.currentTarget.dataset.index as number) + 1
    this.setData({ settingsSelectedIndex: index }, () => this.refreshSettingsDayCellList())
  },

  onSettingsDayTap(e: WechatMiniprogram.TouchEvent) {
    const day = e.currentTarget.dataset.day as number
    const selected = this.data.settingsSelectedIndex
    const dayBindings = [...(this.data.settingsDayBindings || [])]
    dayBindings[day - 1] = selected
    this.setData({ settingsDayBindings: dayBindings }, () => {
      this.refreshSettingsDayCellList()
      this.refreshDisplayTemplateCards()
    })
    wx.showToast({ title: `周${WEEKDAY_SHORT[day - 1]}已调整为备餐${selected}`, icon: 'none' })
  },

  /** §13 §14 卡片右上角三点菜单：编辑备餐 / 换一组 / 删除备餐 */
  onCardMenuTap(e: WechatMiniprogram.TouchEvent) {
    const index = e.currentTarget.dataset.index as number
    const templateId = e.currentTarget.dataset.templateId as string
    const isPlaceholder = e.currentTarget.dataset.isPlaceholder === true
    const N = this.data.settingsNVal || 1
    const items = ['编辑备餐', '换一组']
    if (N > 1) items.push('删除备餐')
    const cards = this.data.displayTemplateCards || []
    const templateName = (cards[index] && cards[index].templateName) ? cards[index].templateName : `备餐${index + 1}`
    const nameParam = templateName ? `&templateName=${encodeURIComponent(templateName)}` : ''
    const mockParam = this.data.useMockPlan ? '&useMock=1' : ''
    const age = this.data.babyAgeMonths
    const ageParam = age != null && age !== '' ? `&babyAgeMonths=${age}` : ''
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        if (res.tapIndex === 0) {
          if (!isPlaceholder && templateId) {
            wx.navigateTo({ url: `/pages/templateEdit/templateEdit?templateId=${templateId}${nameParam}${mockParam}${ageParam}` })
          }
        } else if (res.tapIndex === 1) {
          this.onRegenerateCard(index, templateId, isPlaceholder)
        } else if (res.tapIndex === 2 && N > 1) {
          this.onDeleteCard(index)
        }
      },
    })
  },

  onRegenerateCard(_index: number, templateId: string, isPlaceholder: boolean) {
    if (isPlaceholder || !templateId) return
    wx.showModal({
      title: '换一组',
      content: '换一组后，这组备餐的单日调整会被清除',
      confirmText: '继续',
      success: (res) => {
        if (res.confirm) {
          callCloud('regenerateTemplate', { weekStartDate: this.data.weekStartDate, templateId }, { showLoading: true })
            .then((r) => {
              if (r.success) {
                wx.showToast({ title: '已为你换了一组新的备餐', icon: 'none' })
                this.loadWeekData()
              }
            })
            .catch(() => {
              wx.showToast({ title: '换一组功能暂未开放', icon: 'none' })
            })
        }
      },
    })
  },

  onDeleteCard(index: number) {
    const name = `备餐${index + 1}`
    wx.showModal({
      title: `删除${name}？`,
      confirmText: '删除',
      confirmColor: '#ee0a24',
      success: (res) => {
        if (!res.confirm) return
        const N = (this.data.settingsNVal || 3) - 1
        const templateIds = (this.data.settingsTemplateIds || []).filter((_, i) => i !== index)
        const dayBindings = getDefaultDayAssignments(N)
        const tabList = Array.from({ length: N }, (_, i) => i)
        this.setData({
          settingsNVal: N,
          settingsDayBindings: dayBindings,
          settingsTemplateIds: templateIds,
          settingsTabList: tabList,
        }, () => {
          this.refreshSettingsDayCellList()
          this.refreshDisplayTemplateCards()
        })
        callCloud('updateWeekSettings', {
          weekStartDate: this.data.weekStartDate,
          N,
          dayBindings,
          templateIds,
        }, { showLoading: true }).then((r) => {
          if (r.success) {
            wx.showToast({ title: `已删除${name}`, icon: 'none' })
            this.loadWeekData()
          }
        })
      },
    })
  },

  async onSaveSettings() {
    const N = Math.max(1, Number(this.data.settingsNVal) || 3)
    const raw = this.data.settingsDayBindings || []
    const bindings = Array.isArray(raw) && raw.length >= 7 ? raw.slice(0, 7) : [0, 0, 0, 0, 0, 0, 0]
    const unassignedDays = [1, 2, 3, 4, 5, 6, 7].filter(d => {
      const v = Number(bindings[d - 1])
      return !Number.isFinite(v) || v < 1 || v > N
    })
    if (unassignedDays.length > 0) {
      const dayLabels = unassignedDays.map(d => WEEKDAYS[d - 1])
      wx.showModal({
        title: '还有日期未选择备餐',
        content: `${dayLabels.join('、')}还没有选备餐`,
        confirmText: '自动分配',
        cancelText: '返回修改',
        success: (res) => {
          if (res.confirm) {
            const fixed = this.autoAssignDays(bindings, N, 'fill_empty')
            this.setData({ settingsDayBindings: fixed }, () => {
              this.refreshSettingsDayCellList()
              this.doSaveSettings()
            })
          }
        },
      })
      return
    }
    this.doSaveSettings()
  },

  async doSaveSettings() {
    const { weekStartDate, settingsNVal: N, settingsTemplateIds: templateIds } = this.data
    const raw = this.data.settingsDayBindings || []
    const dayBindings = Array.from({ length: 7 }, (_, i) => {
      const v = Array.isArray(raw) && raw[i] != null ? raw[i] : 0
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    })
    if (this.data.settingsSaving) return
    this.setData({ settingsSaving: true })
    const NVal = Math.max(1, Number(N) || 3)
    const res = await callCloud('updateWeekSettings', {
      weekStartDate,
      N: NVal,
      dayBindings,
      templateIds: Array.isArray(templateIds) ? templateIds.slice(0, NVal) : [],
    }, { showLoading: true, loadingTitle: '保存中...' })
    this.setData({ settingsSaving: false })
    if (res.success) {
      wx.showToast({ title: '✔️ 已保存本周分配', icon: 'success' })
      this.setData({ showMenuCountModal: false })
      this.loadWeekData()
    }
  },

  async loadWeekData() {
    const weekStartDate = this.data.weekStartDate
    this.setData({ loading: true })
    const result = await callCloud('getWeekData', { weekStartDate }, { showLoading: true, loadingTitle: '加载中...' })
    this.setData({ loading: false })
    const weekConfirmed = !!(result.settings && result.settings.confirmed)
    if (result.success === false || !result.plan || !result.plan.days) {
      const fallbackAge = result.babyAgeMonths != null ? result.babyAgeMonths : this.data.babyAgeMonths
      const mealSlotsEmpty = fallbackAge != null ? getOrderedSlotsForAge(fallbackAge) : (SLOT_ORDER as string[])
      this.setData({
        days: [],
        templateCards: [],
        settingsSummary: '',
        settingsN: 0,
        mealSlots: mealSlotsEmpty,
        babyAgeMonths: result.babyAgeMonths != null ? result.babyAgeMonths : this.data.babyAgeMonths,
        weekConfirmed,
        settingsNVal: 3,
        settingsDayBindings: [1, 1, 2, 2, 2, 3, 3],
        settingsTabList: [0, 1, 2],
        settingsTemplateIds: [],
        settingsSelectedIndex: 1,
      }, () => {
        this.refreshSettingsDayCellList()
      })
      return
    }
    let dateAssignments = (result.settings && result.settings.dateAssignments) || [] as Array<{ date: string; templateId: string }>
    dateAssignments = dateAssignments.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    const templates = (result.templates || (result.template ? [result.template] : [])) as Array<{ _id: string; name: string }>
    const tplMap: Record<string, string> = {}
    templates.forEach((t) => { if (t && t._id) tplMap[t._id] = t.name || '' })
    const assignMap: Record<string, string> = {}
    dateAssignments.forEach((a: { date: string; templateId: string }) => { if (a.date) assignMap[a.date] = tplMap[a.templateId] || '' })
    const babyAgeMonths = result.babyAgeMonths != null ? Number(result.babyAgeMonths) : this.data.babyAgeMonths
    const planDays = result.plan.days || []
    const firstDayMeals = (planDays[0] && planDays[0].meals) ? planDays[0].meals : []
    const firstDayKeys = firstDayMeals.map((m: any) => m.mealKey)
    const mealSlots = (babyAgeMonths != null
      ? getOrderedSlotsForAge(babyAgeMonths)
      : firstDayKeys.length > 0 ? SLOT_ORDER.filter((s) => firstDayKeys.includes(s)) : SLOT_ORDER) as string[]

    const dateToDay = {} as Record<string, any>
    planDays.forEach((d: any) => { dateToDay[d.date] = d })
    const dateToTpl: Record<string, string> = {}
    dateAssignments.forEach((a: { date: string; templateId: string }) => { if (a.date && a.templateId) dateToTpl[a.date] = a.templateId })

    const overrideSummaryByTemplate: Record<string, Record<string, Array<{ dayLabel: string; newName: string }>>> = {}
    planDays.forEach((day: any, i: number) => {
      const overrides = day.overrides
      if (!overrides || typeof overrides !== 'object') return
      const tid = dateToTpl[day.date]
      if (!tid) return
      if (!overrideSummaryByTemplate[tid]) overrideSummaryByTemplate[tid] = {}
      Object.keys(overrides).forEach((slot: string) => {
        const v = overrides[slot]
        if (!v || !v.recipeName) return
        if (!overrideSummaryByTemplate[tid][slot]) overrideSummaryByTemplate[tid][slot] = []
        overrideSummaryByTemplate[tid][slot].push({ dayLabel: WEEKDAYS[i] || '', newName: v.recipeName })
      })
    })

    const orderTplIds: string[] = []
    const tplToDates: Record<string, string[]> = {}
    dateAssignments.forEach((a: { date: string; templateId: string }, i: number) => {
      if (!a.templateId) return
      if (!tplToDates[a.templateId]) {
        orderTplIds.push(a.templateId)
        tplToDates[a.templateId] = []
      }
      tplToDates[a.templateId].push(a.date)
    })

    const settingsN = orderTplIds.length
    const parts: string[] = []
    orderTplIds.forEach((tid, idx) => {
      const dates = (tplToDates[tid] || []).sort()
      const labels = dates.map((d: string) => {
        const dayIdx = planDays.findIndex((x: any) => x.date === d)
        return WEEKDAYS[dayIdx >= 0 ? dayIdx : 0]
      })
      parts.push(`备餐${idx + 1}(${labels.join(' ')})`)
    })
    const settingsSummary = parts.length ? `分配：${parts.join(' · ')}` : ''

    const templateCards = orderTplIds.map((tid, idx) => {
      const dates = (tplToDates[tid] || []).sort()
      const firstDate = dates[0]
      const dayData = firstDate ? dateToDay[firstDate] : null
      const mealsRaw = (dayData && dayData.meals) || []
      const mealByKey: Record<string, any> = {}
      mealsRaw.forEach((m: any) => { mealByKey[m.mealKey] = m })
      const overrideBySlot = overrideSummaryByTemplate[tid] || {}
      const meals = mealSlots.map((mealKey) => {
        const m = mealByKey[mealKey]
        const arr = overrideBySlot[mealKey] || []
        const overrideSuffix = arr.length ? arr.map((x: { dayLabel: string; newName: string }) => `${x.dayLabel}：${x.newName}`).join('；') : ''
        return {
          mealKey,
          mealLabel: MEAL_LABELS[mealKey] || mealKey,
          recipeName: m ? (m.recipeName || '未安排') : '未安排',
          blw: m ? !!m.blw : false,
          overrideSuffix,
          hasOverride: arr.length > 0,
        }
      })
      const dateChips = dates.map((d: string) => {
        const dayIdx = planDays.findIndex((x: any) => x.date === d)
        return { date: d, weekdayLabel: WEEKDAYS[dayIdx >= 0 ? dayIdx : 0] }
      })
      const dateLabels = dateChips.map((c: { weekdayLabel: string }) => c.weekdayLabel)
      return {
        templateId: tid,
        templateName: tplMap[tid] || `备餐${idx + 1}`,
        weekdaysLabel: dateLabels.join(' '),
        dateChips,
        meals,
      }
    })

    const firstTemplateId = orderTplIds[0] || (result.settings && result.settings.templateId) || ''
    const days = planDays.map((day: any, i: number) => ({
      date: day.date,
      weekday: WEEKDAYS[i] || '',
      templateName: assignMap[day.date] || '',
      meals: (day.meals || []).map((m: any) => ({
        ...m,
        mealLabel: MEAL_LABELS[m.mealKey] || m.mealKey,
      })),
    }))

    const settingsNVal = orderTplIds.length
    const settingsTemplateIds = orderTplIds
    const settingsDayBindings: number[] = []
    for (let day = 1; day <= 7; day++) {
      const date = this.addDays(weekStartDate, day - 1)
      const assign = dateAssignments.find((a: { date: string; templateId: string }) => a.date === date)
      if (!assign || !assign.templateId) {
        settingsDayBindings.push(0)
        continue
      }
      const idx = orderTplIds.indexOf(assign.templateId)
      settingsDayBindings.push(idx >= 0 ? idx + 1 : 0)
    }
    const settingsTabList = Array.from({ length: settingsNVal }, (_, i) => i)
    this.setData({
      babyAgeMonths,
      mealSlots,
      settingsSummary,
      settingsN,
      templateCards,
      firstTemplateId,
      days,
      weekConfirmed,
      settingsNVal,
      settingsDayBindings,
      settingsTemplateIds,
      settingsTabList,
      settingsSelectedIndex: 1,
    }, () => {
      this.refreshSettingsDayCellList()
      this.refreshDisplayTemplateCards()
    })
  },

  onTapDate(e: WechatMiniprogram.TouchEvent) {
    const date = e.currentTarget.dataset.date as string
    const prepId = e.currentTarget.dataset.prepId as string
    const weekStartDate = this.data.weekStartDate
    if (this.data.useMockPlan && prepId) {
      this.onOpenAssignDateModal(e)
      return
    }
    if (!date) return
    wx.navigateTo({
      url: `/pages/dayEdit/dayEdit?weekStartDate=${weekStartDate}&date=${date}`,
    })
  },

  async onConfirmWeek() {
    const { weekStartDate, isNextWeek, useMockPlan } = this.data
    if (useMockPlan) {
      wx.showToast({ title: isNextWeek ? '✔️ 好的，下周计划已准备好' : '✔️ 好的，本周计划开始啦', icon: 'none', duration: 2000 })
      wx.switchTab({ url: '/pages/todayFood/todayFood' })
      return
    }
    const res = await callCloud('confirmWeek', { weekStartDate }, { showLoading: true, loadingTitle: '确认中...' })
    if (res.success) {
      wx.showToast({ title: isNextWeek ? '✔️ 好的，下周计划已准备好' : '✔️ 好的，本周计划开始啦', icon: 'none', duration: 2000 })
      wx.switchTab({ url: '/pages/todayFood/todayFood' })
    }
  },
})
