// pages/prepEdit/prepEdit.ts
Page({
  data: {
    prep: null as { id: string; recipeName: string; assignedDateText: string } | null,
  },

  onLoad(opt: { id?: string }) {
    const id = opt?.id || ''
    if (!id) {
      this.setData({ prep: null })
      return
    }
    try {
      const raw = wx.getStorageSync('mockWeekPlan')
      if (!raw || typeof raw !== 'string') {
        this.setData({ prep: null })
        return
      }
      const data = JSON.parse(raw) as { weekPlan?: { items?: Array<{ id: string; recipeName: string; assignedDateText: string }> } }
      const item = data?.weekPlan?.items?.find((i) => i.id === id) || null
      this.setData({ prep: item })
    } catch {
      this.setData({ prep: null })
    }
  },
})
