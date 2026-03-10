// pages/nextWeek/nextWeek.ts
// 仅做重定向：生成本周/下周计划统一使用 week 页，通过 weekStartDate 区分

function getThisMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return formatDate(d)
}

function getNextMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff + 7)
  return formatDate(d)
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

Page({
  data: {},

  onLoad(opt: { generateThisWeek?: string }) {
    const weekStart = opt?.generateThisWeek === '1' ? getThisMonday() : getNextMonday()
    wx.redirectTo({
      url: `/pages/week/week?weekStartDate=${weekStart}&needConfirm=1`,
    })
  },
})
