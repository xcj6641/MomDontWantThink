// pages/profile/profile.ts
const { callCloud } = require('../../utils/cloud.js')

function splitText(s: string): string[] {
  return (s || '').split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean)
}

Page({
  data: {
    babyAgeMonths: '' as string,
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
        babyAgeMonths: result.babyAgeMonths != null ? String(result.babyAgeMonths) : '',
        allergyText: (result.allergyIngredientNames || []).join(','),
        blwLikesText: (result.blwLikes || []).join(','),
        blwDislikesText: (result.blwDislikes || []).join(','),
      })
    }
  },

  onBabyAgeInput(e: WechatMiniprogram.Input) {
    this.setData({ babyAgeMonths: e.detail.value })
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
    const allergyIngredientNames = splitText(this.data.allergyText)
    const blwLikes = splitText(this.data.blwLikesText)
    const blwDislikes = splitText(this.data.blwDislikesText)
    const res = await callCloud(
      'savePreferences',
      { babyAgeMonths, allergyIngredientNames, blwLikes, blwDislikes },
      { showLoading: true, loadingTitle: '保存中...' }
    )
    if (res.success) wx.showToast({ title: '已帮你保存偏好', icon: 'success' })
  },
})
