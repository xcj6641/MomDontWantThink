// pages/allergyMode/allergyMode.ts
const { callCloud } = require('../../utils/cloud.js')

const STATUS_LABELS: Record<string, string> = {
  testing: '排敏中',
  passed: '已通过',
  paused: '暂停添加',
  untested: '未添加',
}

interface IngredientItem {
  ingredient: string
  status: string
  statusLabel: string
  currentDay: number
  totalDays: number
  startDate: string
  progressText: string
}

Page({
  data: {
    loading: true as boolean,
    testing: [] as IngredientItem[],
    paused: [] as IngredientItem[],
    passed: [] as IngredientItem[],
    hasAny: false as boolean,
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    const result = await callCloud('getIngredientStatus', {}, { showLoading: false })
    if (!result.success) {
      this.setData({ loading: false })
      return
    }
    const items: IngredientItem[] = (result.items || []).map((d: any) => ({
      ingredient: d.ingredient,
      status: d.status,
      statusLabel: STATUS_LABELS[d.status] || d.status,
      currentDay: d.currentDay || 1,
      totalDays: d.totalDays || 3,
      startDate: d.startDate || '',
      progressText: d.status === 'testing' ? `Day ${d.currentDay || 1} / ${d.totalDays || 3}` : '',
    }))

    const testing = items.filter((i) => i.status === 'testing')
    const paused = items.filter((i) => i.status === 'paused')
    const passed = items.filter((i) => i.status === 'passed')

    this.setData({
      loading: false,
      testing,
      paused,
      passed,
      hasAny: items.length > 0,
    })
  },
})
