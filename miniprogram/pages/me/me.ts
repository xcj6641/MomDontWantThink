// pages/me/me.ts
Page({
  data: {
    userInfo: {
      avatarUrl: '',
      nickName: '',
    } as WechatMiniprogram.UserInfo,
  },

  onLoad() {
    this.loadUser()
  },

  onShow() {
    this.loadUser()
  },

  loadUser() {
    // 预留：云函数 initUser / 或从 globalData 取
    // wx.cloud.callFunction({ name: 'initUser' }).then(res => { ... })
    const app = getApp<IAppOption>()
    const userInfo = (app.globalData as any).userInfo
    if (userInfo) this.setData({ userInfo })
  },
})

interface IAppOption {
  globalData: { userInfo?: WechatMiniprogram.UserInfo }
}
