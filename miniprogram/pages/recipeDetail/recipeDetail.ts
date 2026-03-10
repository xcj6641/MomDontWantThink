// pages/recipeDetail/recipeDetail.ts
const { callCloud } = require('../../utils/cloud.js')
const { getMockRecipeDetail, getAgeLabel, getTypeLabel, getTextureLabel } = require('../../utils/recipeDetailMock.js')

interface Basic {
  name: string
  ageLabel?: string
  typeLabel?: string
  textureLabel?: string
  description?: string
  ageMonthMin?: number
  ageMonthMax?: number
  type?: string
  texture?: string
}

Page({
  data: {
    loading: true,
    basic: null as Basic | null,
    steps: [] as Array<{ stepNo: number; content: string }>,
    ingredients: [] as Array<{ name: string; amountDisplay: string }>,
    prepSummary: { weekend: [] as string[], dayBefore: [] as string[] },
    tips: [] as string[],
    collected: false,
    feedback: '' as '' | 'like' | 'dislike',
    collectAnim: false,
    likeAnim: false,
    replaceAnim: false,
    iconStarOutline: '../../assets/icons/recipe-detail/star-outline.svg',
    iconStarFilled: '../../assets/icons/recipe-detail/star-filled.svg',
    iconHeartOutline: '../../assets/icons/recipe-detail/heart-outline.svg',
    iconHeartFilled: '../../assets/icons/recipe-detail/heart-filled.svg',
    iconThumbDownOutline: '../../assets/icons/recipe-detail/thumb-down-outline.svg',
    iconThumbDownFilled: '../../assets/icons/recipe-detail/thumb-down-filled.svg',
    iconRefresh: '../../assets/icons/recipe-detail/refresh.svg',
  },

  onLoad(opt: { id?: string }) {
    const id = opt?.id ? parseInt(opt.id, 10) : NaN
    if (!Number.isFinite(id)) {
      this.setData({ loading: false })
      return
    }
    this.loadDetail(id)
  },

  async loadDetail(id: number) {
    this.setData({ loading: true })
    const res = await callCloud('getBabyFoodRecipeDetail', { recipeId: `recipe_${id}` }, { showLoading: false })
    if (res.success && res.data) {
      this.normalizeAndSet(res.data)
    } else {
      const mock = getMockRecipeDetail(id)
      if (mock) this.setData({ ...mock, loading: false })
      else this.setData({ loading: false })
    }
  },

  normalizeAndSet(data: any) {
    const basicRaw = data.basic || {}
    const basic: Basic = {
      name: basicRaw.name || '',
      ageLabel: basicRaw.ageLabel || getAgeLabel(basicRaw.ageMonthMin, basicRaw.ageMonthMax),
      typeLabel: basicRaw.typeLabel || getTypeLabel(basicRaw.type),
      textureLabel: basicRaw.textureLabel || getTextureLabel(basicRaw.texture),
      description: basicRaw.description || '',
    }
    const prepSummary = {
      weekend: Array.isArray(data.prepSummary?.weekend) ? data.prepSummary.weekend : [],
      dayBefore: Array.isArray(data.prepSummary?.dayBefore) ? data.prepSummary.dayBefore : [],
    }
    this.setData({
      basic,
      steps: Array.isArray(data.steps) ? data.steps : [],
      ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
      prepSummary,
      tips: Array.isArray(data.tips) ? data.tips : [],
      loading: false,
    })
  },

  onCollect() {
    const next = !this.data.collected
    this.setData({ collectAnim: true, collected: next })
    setTimeout(() => this.setData({ collectAnim: false }), 350)
    wx.showToast({ title: next ? '已收藏' : '已取消收藏', icon: 'none' })
  },

  onLike() {
    const isLike = this.data.feedback === 'like'
    const next = !isLike
    this.setData({ feedback: next ? 'like' : '', likeAnim: next })
    setTimeout(() => this.setData({ likeAnim: false }), 200)
    wx.showToast({ title: next ? '已记录宝宝喜欢' : '已取消宝宝喜欢', icon: 'none' })
  },

  onDislike() {
    const isDislike = this.data.feedback === 'dislike'
    const next = !isDislike
    this.setData({ feedback: next ? 'dislike' : '' })
    wx.showToast({ title: next ? '已记录不爱吃' : '已取消', icon: 'none' })
  },

  onReplace() {
    this.setData({ replaceAnim: true })
    setTimeout(() => this.setData({ replaceAnim: false }), 300)
    wx.showToast({ title: '换一个功能需在计划页操作', icon: 'none' })
  },
})
