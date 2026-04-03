// pages/weekSettings/weekSettings.ts - 本周备餐分配 UI v1.0
const { callCloud } = require('../../utils/cloud.js')

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const TEMPLATE_COLORS = ['#7FB77E', '#1989fa', '#F4B860', '#9c27b0', '#00bcd4', '#A0D8C0', '#795548']

Page({
  data: {
    weekStartDate: '' as string,
    N: 3 as number,
    selectedTemplateIndex: 1 as number,
    dayBindings: [0, 0, 0, 0, 0, 0, 0] as number[],
    templateIds: [] as string[],
    templateColors: TEMPLATE_COLORS,
    saving: false as boolean,
    dayCellList: [] as Array<{ day: number; weekday: string; binding: number; isCurrent: boolean; isUnassigned: boolean; bgStyle: string }>,
    tabList: [0, 1, 2] as number[],
  },

  onLoad(opt: { weekStartDate?: string }) {
    const weekStartDate = opt?.weekStartDate || this.getThisMonday()
    this.setData({ weekStartDate })
    this.loadWeekSettings(weekStartDate)
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

  addDays(dateStr: string, n: number): string {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() + n)
    return this.formatDate(d)
  },

  async loadWeekSettings(weekStartDate: string) {
    const result = await callCloud('getWeekData', { weekStartDate }, { showLoading: true, loadingTitle: '加载中...' })
    if (!result.success || !result.settings) {
      const defBindings = [1, 1, 2, 2, 2, 3, 3]
      this.setData({
        N: 3,
        templateIds: [],
        dayBindings: defBindings,
        selectedTemplateIndex: 1,
        tabList: [0, 1, 2],
      }, () => this.refreshDayCellList())
      return
    }
    const templates = (result.templates || []) as Array<{ _id: string; name: string }>
    const dateAssignments = (result.settings.dateAssignments || []) as Array<{ date: string; templateId: string }>
    const N = Math.max(2, Math.min(7, templates.length || 3))
    const templateIds = templates.slice(0, N).map((t: any) => t._id)
    const dayBindings: number[] = []
    for (let day = 1; day <= 7; day++) {
      const date = this.addDays(weekStartDate, day - 1)
      const assign = dateAssignments.find((a: any) => a.date === date)
      if (!assign || !assign.templateId) {
        dayBindings.push(0)
        continue
      }
      const idx = templateIds.indexOf(assign.templateId)
      dayBindings.push(idx >= 0 ? idx + 1 : 0)
    }
    if (dayBindings.length < 7) {
      while (dayBindings.length < 7) dayBindings.push(0)
    }
    const tabList = Array.from({ length: N }, (_, i) => i)
    this.setData({
      N,
      templateIds,
      dayBindings,
      selectedTemplateIndex: 1,
      tabList,
    })
    this.refreshDayCellList()
  },

  onNStepperTap(e: WechatMiniprogram.TouchEvent) {
    const step = Number(e.currentTarget.dataset.value) || 0
    if (step === 0) return
    this.onNChange(step)
  },

  onNChange(step: number) {
    const N = this.data.N + step
    N = Math.max(2, Math.min(7, N))
    const oldN = this.data.N
    let dayBindings = [...(this.data.dayBindings || [0, 0, 0, 0, 0, 0, 0])]
    if (N < oldN) {
      for (let i = 0; i < 7; i++) {
        if (dayBindings[i] > N) dayBindings[i] = 0
      }
      dayBindings = this.evenDistribute(dayBindings, N)
    }
    const tabList = Array.from({ length: N }, (_, i) => i)
    this.setData({ N, dayBindings, tabList }, () => this.refreshDayCellList())
  },

  evenDistribute(bindings: number[], N: number): number[] {
    const count: number[] = []
    for (let i = 0; i < N; i++) count[i] = 0
    const result = [...bindings]
    for (let i = 0; i < 7; i++) {
      if (result[i] >= 1 && result[i] <= N) count[result[i] - 1]++
    }
    const unassigned: number[] = []
    for (let i = 0; i < 7; i++) {
      if (result[i] === 0 || result[i] > N) unassigned.push(i)
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

  onTemplateTabTap(e: WechatMiniprogram.TouchEvent) {
    const index = (e.currentTarget.dataset.index as number) + 1
    this.setData({ selectedTemplateIndex: index }, () => this.refreshDayCellList())
  },

  onDayTap(e: WechatMiniprogram.TouchEvent) {
    const day = e.currentTarget.dataset.day as number
    const selected = this.data.selectedTemplateIndex
    const dayBindings = [...(this.data.dayBindings || [])]
    dayBindings[day - 1] = selected
    this.setData({ dayBindings }, () => this.refreshDayCellList())
    const labels = ['', '一', '二', '三', '四', '五', '六', '日']
    wx.showToast({ title: `周${labels[day]}已调整为备餐${selected}`, icon: 'none' })
  },

  getUnassignedDays(): number[] {
    const dayBindings = this.data.dayBindings || []
    const N = this.data.N
    const out: number[] = []
    for (let i = 0; i < 7; i++) {
      const v = dayBindings[i]
      if (!v || v < 1 || v > N) out.push(i + 1)
    }
    return out
  },

  onConfirm() {
    const unassigned = this.getUnassignedDays()
    if (unassigned.length > 0) {
      const labels = unassigned.map(d => WEEKDAYS[d - 1])
      wx.showModal({
        title: '还有日期未选择备餐',
        content: `${labels.join('、')}还没有选备餐`,
        confirmText: '自动分配',
        cancelText: '返回修改',
        success: (res) => {
          if (res.confirm) this.doAutoAssignAndSave()
        },
      })
      return
    }
    this.doSave()
  },

  doAutoAssignAndSave() {
    let dayBindings = [...(this.data.dayBindings || [])]
    const N = this.data.N
    dayBindings = this.evenDistribute(dayBindings, N)
    this.setData({ dayBindings })
    wx.showToast({ title: '✔️ 已帮你自动分配完成', icon: 'none' })
    this.doSave()
  },

  async doSave() {
    const { weekStartDate, N, dayBindings, templateIds } = this.data
    if (this.data.saving) return
    this.setData({ saving: true })
    const res = await callCloud('updateWeekSettings', {
      weekStartDate,
      N,
      dayBindings: dayBindings || [],
      templateIds: templateIds || [],
    }, { showLoading: true, loadingTitle: '保存中...' })
    this.setData({ saving: false })
    if (res.success) {
      wx.showToast({ title: '✔️ 已保存本周分配', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1000)
    }
  },

  refreshDayCellList() {
    const dayBindings = this.data.dayBindings || []
    const selected = this.data.selectedTemplateIndex
    const colors = this.data.templateColors || TEMPLATE_COLORS
    const dayCellList = WEEKDAYS.map((weekday, i) => {
      const day = i + 1
      const binding = dayBindings[i] || 0
      const isUnassigned = !binding || binding < 1
      const isCurrent = binding === selected
      let bgStyle = ''
      if (!isUnassigned) {
        const hex = colors[(binding - 1) % colors.length]
        bgStyle = isCurrent ? `background: ${hex}; color: #fff;` : `background: ${hex}20; color: #333;`
      }
      return { day, weekday, binding, isCurrent, isUnassigned, bgStyle }
    })
    this.setData({ dayCellList })
  },
})
