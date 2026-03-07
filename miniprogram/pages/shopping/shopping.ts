// pages/shopping/shopping.ts
const { callCloud } = require('../../utils/cloud.js')

Page({
  data: {
    weekStartDate: '',
    summary: { preparedCount: 0, totalCount: 0 },
    itemsByCategory: {} as Record<string, Array<{ ingredientName: string; amount: string; prepared: boolean }>>,
    categoryList: [] as Array<{ name: string; items: Array<{ ingredientName: string; amount: string; prepared: boolean }> }>,
  },

  onLoad(opt: { weekStartDate?: string }) {
    if (opt?.weekStartDate) {
      this.setData({ weekStartDate: opt.weekStartDate })
    } else {
      this.setWeekStart()
    }
    this.loadList()
  },

  onShow() {
    this.loadList()
  },

  setWeekStart() {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    const weekStartDate = this.formatDate(d)
    this.setData({ weekStartDate })
  },

  formatDate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  },

  async loadList() {
    const weekStartDate = this.data.weekStartDate
    const result = await callCloud('buildShoppingList', { weekStartDate }, { showLoading: true, loadingTitle: '加载中...' })
    if (result.success === false) {
      this.setData({ categoryList: [], summary: { preparedCount: 0, totalCount: 0 } })
      return
    }
    const summary = result.summary || { preparedCount: 0, totalCount: 0 }
    const itemsByCategory = result.itemsByCategory || {}
    const categoryList = Object.entries(itemsByCategory).map(([name, items]) => ({ name, items: items || [] }))
    this.setData({ categoryList, summary })
  },

  async onToggleItem(e: WechatMiniprogram.TouchEvent) {
    const name = e.currentTarget.dataset.name as string
    if (!name) return
    const categoryList = this.data.categoryList
    const entry = categoryList.map((c) => c.items.find((it) => it.ingredientName === name)).find(Boolean)
    const prepared = entry ? !entry.prepared : true
    const res = await callCloud('toggleShoppingItem', {
      weekStartDate: this.data.weekStartDate,
      ingredientName: name,
      prepared,
    }, { showLoading: false })
    if (res.success && res.summary) {
      this.setData({ summary: res.summary })
      const list = categoryList.map((c) => ({
        ...c,
        items: c.items.map((it) => (it.ingredientName === name ? { ...it, prepared } : it)),
      }))
      this.setData({ categoryList: list })
    }
  },
})
