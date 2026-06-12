// pages/profile/profile.ts
const { callCloud } = require('../../utils/cloud.js')

function splitText(s: string): string[] {
  return (s || '').split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean)
}

Page({
  data: {
    babyName: '',
    babyAgeMonths: '' as string,
    teethStage: '' as string,
    allergyText: '',
    blwLikesText: '',
    blwDislikesText: '',
  },

  onLoad() {
    this.loadPreferences()
  },

  async loadPreferences() {
    const result = await callCloud('getPreferences', {}, { showLoading: false })
    if (result.success) {
      this.setData({
        babyName: result.babyName || '',
        babyAgeMonths: result.babyAgeMonths != null ? String(result.babyAgeMonths) : '',
        teethStage: result.teethStage || '',
        allergyText: (result.allergyIngredientNames || []).join(','),
        blwLikesText: (result.blwLikes || []).join(','),
        blwDislikesText: (result.blwDislikes || []).join(','),
      })
    }
  },

  onBabyNameInput(e: WechatMiniprogram.Input) {
    this.setData({ babyName: e.detail.value })
  },

  onBabyAgeInput(e: WechatMiniprogram.Input) {
    this.setData({ babyAgeMonths: e.detail.value })
  },

  onTeethStageTap(e: WechatMiniprogram.TouchEvent) {
    const stage = (e.currentTarget.dataset as Record<string, string>).stage || ''
    this.setData({ teethStage: stage === this.data.teethStage ? '' : stage })
  },

  onAllergyInput(e: WechatMiniprogram.Input) {
    this.setData({ allergyText: e.detail.value })
  },

  onBlwLikesInput(e: WechatMiniprogram.Input) {
    this.setData({ blwLikesText: e.detail.value })
  },

  onBlwDislikesInput(e: WechatMiniprogram.Input) {
    this.setData({ blwDislikesText: e.detail.value })
  },

  async onSave() {
    const babyAgeMonths = parseInt(this.data.babyAgeMonths, 10)
    if (isNaN(babyAgeMonths) || babyAgeMonths < 0) {
      wx.showToast({ title: '请填写有效宝宝月龄', icon: 'none' })
      return
    }
    const babyName = this.data.babyName.trim()
    const allergyIngredientNames = splitText(this.data.allergyText)
    const blwLikes = splitText(this.data.blwLikesText)
    const blwDislikes = splitText(this.data.blwDislikesText)
    const res = await callCloud(
      'savePreferences',
      { babyName, babyAgeMonths, allergyIngredientNames, teethStage: this.data.teethStage, blwLikes, blwDislikes },
      { showLoading: true, loadingTitle: '保存中...' }
    )
    if (res.success) wx.showToast({ title: '已帮你保存偏好', icon: 'success' })
  },
})
