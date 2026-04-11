// pages/weekSummary/weekSummary.ts
const { callCloud } = require('../../utils/cloud.js')

const CATEGORY_ICONS: Record<string, string> = {
  '蛋白': '🥩',
  '蔬菜': '🥦',
  '水果': '🍎',
  '主食': '🥣',
  '其他': '🧺',
}

const CATEGORY_LABELS: Record<string, string> = {
  '蛋白': '蛋白质类',
  '蔬菜': '蔬菜类',
  '水果': '水果类',
  '主食': '主食类',
  '其他': '其他',
}

const CATEGORY_ORDER = ['蔬菜', '蛋白', '水果', '主食', '其他']

type IngredientItem = { ingredientName: string; amount: string; prepared: boolean }
type CategoryGroup = { key: string; label: string; icon: string; items: IngredientItem[] }
type PrepTask = { id: string; action: string; usedInDishes: string[]; expanded: boolean; done: boolean }
type MealGroup = { mealLabel: string; dishes: string[] }
type BatchDetail = { id: string; name: string; weekdays: string; summary: string; expanded: boolean; mealGroups: MealGroup[] }

const MOCK_RESULT = {
  // ingredients: 7 items (2 per category, 其他 only 1), 3 prepared
  summary: { preparedCount: 3, totalCount: 7 },
  itemsByCategory: {
    '蔬菜': [
      { ingredientName: '西兰花', amount: '200g', prepared: true },
      { ingredientName: '胡萝卜', amount: '150g', prepared: true },
    ],
    '蛋白': [
      { ingredientName: '鸡胸肉', amount: '200g', prepared: true },
      { ingredientName: '牛肉末', amount: '150g', prepared: false },
    ],
    '主食': [
      { ingredientName: '大米', amount: '适量', prepared: false },
      { ingredientName: '小米', amount: '适量', prepared: false },
    ],
    '其他': [
      { ingredientName: '鸡蛋', amount: '3个', prepared: false },
    ],
  } as Record<string, IngredientItem[]>,
  // prep tasks: 3 tasks, 1 done
  prepTasks: [
    { id: 'p1', action: '鸡肉切丁并分装冷冻', usedInDishes: ['西兰花鸡肉泥', '南瓜鸡肉泥'], done: true },
    { id: 'p2', action: '西兰花焯水后切碎', usedInDishes: ['西兰花鸡肉泥'], done: false },
    { id: 'p3', action: '南瓜蒸熟压泥冷藏', usedInDishes: ['南瓜泥', '南瓜鸡肉泥'], done: false },
  ] as Omit<PrepTask, 'expanded'>[],
  mealPlanDetail: [
    {
      id: 'b1',
      name: '备餐一',
      weekdays: '周一、周二',
      summary: '3道菜',
      mealGroups: [
        { mealLabel: '早餐', dishes: ['南瓜米糊 / 小米粥'] },
        { mealLabel: '午餐', dishes: ['西兰花鸡肉泥 / 南瓜鸡肉泥'] },
        { mealLabel: '晚餐', dishes: ['胡萝卜蛋黄泥'] },
      ],
    },
    {
      id: 'b2',
      name: '备餐二',
      weekdays: '周三、周四、周五',
      summary: '3道菜',
      mealGroups: [
        { mealLabel: '早餐', dishes: ['胡萝卜泥 / 南瓜小米粥'] },
        { mealLabel: '午餐', dishes: ['牛肉蔬菜粥'] },
        { mealLabel: '晚餐', dishes: ['三文鱼蛋羹'] },
      ],
    },
    {
      id: 'b3',
      name: '备餐三',
      weekdays: '周六、周日',
      summary: '2道菜',
      mealGroups: [
        { mealLabel: '早餐', dishes: ['西兰花蛋羹 / 三文鱼泥'] },
        { mealLabel: '午餐', dishes: ['三文鱼泥拌粥 / 西兰花蛋羹'] },
      ],
    },
  ] as Omit<BatchDetail, 'expanded'>[],
}

Page({
  data: {
    weekStartDate: '' as string,
    isNextWeek: false as boolean,
    babyBirthday: '' as string,
    weekDateRange: '' as string,
    summary: { preparedCount: 0, totalCount: 0 },
    categoryList: [] as CategoryGroup[],
    prepTasks: [] as PrepTask[],
    mealPlanDetail: [] as BatchDetail[],
    progressPercent: 0 as number,
    loading: true as boolean,
    isFavorited: false as boolean,
  },

  onLoad(opt: { weekStartDate?: string; isNextWeek?: string; babyBirthday?: string }) {
    const weekStartDate = opt?.weekStartDate || this.getThisMonday()
    const isNextWeek = opt?.isNextWeek === '1'
    const babyBirthday = opt?.babyBirthday || ''
    wx.setNavigationBarTitle({ title: isNextWeek ? '下周备餐计划' : '本周备餐计划' })
    const weekDateRange = this.computeDateRange(weekStartDate)
    this.setData({ weekStartDate, isNextWeek, babyBirthday, weekDateRange })
    this.loadList()
  },

  onShow() {
    if (this.data.weekStartDate) this.loadList()
  },

  getThisMonday(): string {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return this.formatDate(d)
  },

  formatDate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  },

  computeDateRange(weekStartDate: string): string {
    const start = new Date(weekStartDate + 'T12:00:00')
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`
    return `${fmt(start)} - ${fmt(end)}`
  },

  async loadList() {
    this.setData({ loading: true })
    // TODO: replace with cloud call when data is ready
    // const result = await callCloud('buildShoppingList', { weekStartDate: this.data.weekStartDate }, { showLoading: true, loadingTitle: '加载中...' })
    const result = MOCK_RESULT
    this.setData({ loading: false })
    this.applyResult(result)
  },

  applyResult(result: typeof MOCK_RESULT) {
    const ingPrepared = result.summary.preparedCount
    const ingTotal = result.summary.totalCount

    const categoryList: CategoryGroup[] = []
    CATEGORY_ORDER.forEach((k) => {
      const items = result.itemsByCategory[k]
      if (items && items.length > 0) {
        categoryList.push({ key: k, label: CATEGORY_LABELS[k] || k, icon: CATEGORY_ICONS[k] || '🧺', items })
      }
    })
    Object.keys(result.itemsByCategory).forEach((k) => {
      if (!CATEGORY_ORDER.includes(k) && result.itemsByCategory[k].length > 0) {
        categoryList.push({ key: k, label: CATEGORY_LABELS[k] || k, icon: '🧺', items: result.itemsByCategory[k] })
      }
    })

    const prepTasks: PrepTask[] = (result.prepTasks || []).map((t) => ({ ...t, expanded: false }))
    const tasksDone = prepTasks.filter((t) => t.done).length

    const mealPlanDetail: BatchDetail[] = (result.mealPlanDetail || []).map((b: Omit<BatchDetail, 'expanded'>) => ({ ...b, expanded: false }))

    const preparedCount = ingPrepared + tasksDone
    const totalCount = ingTotal + prepTasks.length
    const progressPercent = totalCount > 0 ? Math.round((preparedCount / totalCount) * 100) : 0

    this.setData({ categoryList, prepTasks, mealPlanDetail, summary: { preparedCount, totalCount }, progressPercent })
  },

  // ── Section 3: ingredient checkboxes ──

  onToggleItem(e: WechatMiniprogram.TouchEvent) {
    const name = e.currentTarget.dataset.name as string
    if (!name) return
    const { categoryList, summary } = this.data
    const entry = categoryList.flatMap((c) => c.items).find((it) => it.ingredientName === name)
    const prepared = entry ? !entry.prepared : true
    const preparedCount = summary.preparedCount + (prepared ? 1 : -1)
    const progressPercent = summary.totalCount > 0 ? Math.round((preparedCount / summary.totalCount) * 100) : 0
    const updatedList = categoryList.map((c) => ({
      ...c,
      items: c.items.map((it) => (it.ingredientName === name ? { ...it, prepared } : it)),
    }))
    this.setData({ categoryList: updatedList, summary: { ...summary, preparedCount }, progressPercent })
    // TODO: callCloud('toggleShoppingItem', { weekStartDate, ingredientName: name, prepared }, { showLoading: false })
  },

  // ── Section 4: prep tasks ──

  onTogglePrepTask(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!id) return
    const { prepTasks, summary } = this.data
    const task = prepTasks.find((t) => t.id === id)
    if (!task) return
    const done = !task.done
    const preparedCount = summary.preparedCount + (done ? 1 : -1)
    const progressPercent = summary.totalCount > 0 ? Math.round((preparedCount / summary.totalCount) * 100) : 0
    const updatedTasks = prepTasks.map((t) => (t.id === id ? { ...t, done } : t))
    this.setData({ prepTasks: updatedTasks, summary: { ...summary, preparedCount }, progressPercent })
  },

  onToggleTaskExpand(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!id) return
    const { prepTasks } = this.data
    const updatedTasks = prepTasks.map((t) => (t.id === id ? { ...t, expanded: !t.expanded } : t))
    this.setData({ prepTasks: updatedTasks })
  },

  // ── Section 5: batch detail accordion ──

  onToggleBatchPanel(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!id) return
    const { mealPlanDetail } = this.data
    const updatedDetail = mealPlanDetail.map((b) => ({
      ...b,
      expanded: b.id === id ? !b.expanded : false,
    }))
    this.setData({ mealPlanDetail: updatedDetail })
  },

  // ── Section actions ──

  onMarkPrepAllDone() {
    const { prepTasks, summary } = this.data
    const undoneCount = prepTasks.filter((t) => !t.done).length
    if (undoneCount === 0) return
    const updatedTasks = prepTasks.map((t) => ({ ...t, done: true }))
    const preparedCount = summary.preparedCount + undoneCount
    const progressPercent = summary.totalCount > 0 ? Math.round((preparedCount / summary.totalCount) * 100) : 0
    this.setData({ prepTasks: updatedTasks, summary: { ...summary, preparedCount }, progressPercent })
  },

  onMarkAllDone() {
    const { categoryList, summary } = this.data
    const undoneCount = categoryList.flatMap((c) => c.items).filter((it) => !it.prepared).length
    if (undoneCount === 0) return
    const updatedList = categoryList.map((c) => ({ ...c, items: c.items.map((it) => ({ ...it, prepared: true })) }))
    const preparedCount = summary.preparedCount + undoneCount
    const progressPercent = summary.totalCount > 0 ? Math.round((preparedCount / summary.totalCount) * 100) : 0
    this.setData({ categoryList: updatedList, summary: { ...summary, preparedCount }, progressPercent })
  },

  onToggleFavorite() {
    const isFavorited = !this.data.isFavorited
    this.setData({ isFavorited })
    wx.showToast({
      title: isFavorited ? '已收藏本周计划' : '已取消收藏',
      icon: 'none',
      duration: 1500,
    })
  },

  onViewWeekPlan() {
    const { weekStartDate, babyBirthday } = this.data
    const age = babyBirthday ? `&babyBirthday=${encodeURIComponent(babyBirthday)}` : ''
    wx.navigateTo({ url: `/pages/week/week?weekStartDate=${weekStartDate}${age}` })
  },
})
