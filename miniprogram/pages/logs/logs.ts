// pages/logs/logs.ts
const { callCloud } = require('../../utils/cloud.js')

const { MEAL_LABELS } = require('../../utils/ageMealConfig.js')
const REACTION_TEXT: Record<string, string> = { good: '好吃', bad: '不爱吃', skip: '跳过' }
const ANOMALY_TEXT: Record<string, string> = { rash: '皮疹', vomit: '呕吐', diarrhea: '腹泻', other: '其他' }

Page({
  data: {
    logs: [] as Array<{
      date: string
      entries: Array<{
        mealKey: string
        mealLabel: string
        recipeName: string
        reaction?: string
        reactionText?: string
        anomalyType?: string
        anomalyText?: string
        anomalyNote?: string
      }>
    }>,
  },

  onLoad() {
    this.loadLogs()
  },

  onShow() {
    this.loadLogs()
  },

  async loadLogs() {
    const result = await callCloud('getMealLogs', {}, { showLoading: true, loadingTitle: '加载中...' })
    if (result.success === false || !result.logs) {
      this.setData({ logs: [] })
      return
    }
    const logs = (result.logs || []).map((day: any) => ({
      date: day.date,
      entries: (day.entries || []).map((entry: any) => ({
        ...entry,
        mealLabel: MEAL_LABELS[entry.mealKey] || entry.mealKey,
        reactionText: entry.reaction ? REACTION_TEXT[entry.reaction] : '',
        anomalyText: entry.anomalyType ? ANOMALY_TEXT[entry.anomalyType] || entry.anomalyType : '',
      })),
    }))
    this.setData({ logs })
  },

  onMarkAnomaly(e: WechatMiniprogram.TouchEvent) {
    const { date, mealkey } = e.currentTarget.dataset
    const mealKey = mealkey
    if (!date || !mealKey) return
    const items = ['皮疹', '呕吐', '腹泻', '其他']
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const reactionType = ['rash', 'vomit', 'diarrhea', 'other'][res.tapIndex]
        wx.showModal({
          title: '备注（选填）',
          editable: true,
          placeholderText: '如：嘴角有一点红',
          success: (modalRes: any) => {
            if (modalRes.confirm) {
              const note = (modalRes.content || '').trim()
              callCloud('markReaction', {
                date,
                mealKey,
                reactionType,
                note,
              }, { showLoading: true, loadingTitle: '记录中...' }).then((r: any) => {
                if (r.success) {
                  wx.showToast({ title: '已记下这次反应', icon: 'success' })
                  this.loadLogs()
                }
              })
            }
          },
        })
      },
    })
  },
})
