// pages/recipes/recipes.ts
Page({
  data: {
    list: [] as Array<{ _id: string; name: string; category?: string }>,
  },

  onLoad() {
    this.loadList()
  },

  onShow() {
    this.loadList()
  },

  loadList() {
    // 预留：云函数 listMyRecipes()
    this.setData({
      list: [
        { _id: 'r1', name: '南瓜粥', category: '主食' },
        { _id: 'r2', name: '西兰花', category: '蔬菜' },
      ],
    })
  },

  onItemTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    wx.navigateTo({ url: `/pages/recipeEdit/recipeEdit?recipeId=${id}` })
  },
})
