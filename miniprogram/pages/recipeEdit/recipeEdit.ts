// pages/recipeEdit/recipeEdit.ts
const CATEGORIES = ['主食', '蔬菜', '水果', '蛋白', '其他']

Page({
  data: {
    recipeId: '',
    name: '',
    categoryIndex: 0,
    categoryText: '',
    categories: CATEGORIES,
    ingredients: [] as Array<{ name: string; amount: string }>,
  },

  onLoad(opt: { recipeId?: string }) {
    const recipeId = opt?.recipeId || ''
    this.setData({
      recipeId,
      name: '',
      categoryText: CATEGORIES[0],
      ingredients: [{ name: '', amount: '' }],
    })
    if (recipeId) this.loadRecipe()
  },

  loadRecipe() {
    // 预留：读单条 recipe
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ name: e.detail.value })
  },

  onCategoryChange(e: WechatMiniprogram.PickerChange) {
    const i = Number(e.detail.value)
    this.setData({ categoryIndex: i, categoryText: CATEGORIES[i] })
  },

  onIngredientInput(e: WechatMiniprogram.Input) {
    const index = e.currentTarget.dataset.index as number
    const field = e.currentTarget.dataset.field as 'name' | 'amount'
    const ingredients = this.data.ingredients
    if (ingredients[index]) (ingredients[index] as any)[field] = e.detail.value
    this.setData({ ingredients })
  },

  onAddIngredient() {
    this.setData({ ingredients: [...this.data.ingredients, { name: '', amount: '' }] })
  },

  onSave() {
    // 预留：云函数 createRecipe / updateRecipe
    wx.showToast({ title: '已帮你保存菜谱', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1500)
  },
})
