// pages/me/me.ts
const { getUseMockWeekPlan, setUseMockWeekPlan } = require('../../utils/weekPlanMock.js')

Page({
  data: {
    userInfo: {
      avatarUrl: '',
      nickName: '',
    } as WechatMiniprogram.UserInfo,
    useMockWeekPlan: true as boolean,
  },

  onLoad() {
    this.loadUser()
    this.setData({ useMockWeekPlan: getUseMockWeekPlan() })
  },

  onShow() {
    this.loadUser()
    this.setData({ useMockWeekPlan: getUseMockWeekPlan() })
  },

  onMockModeChange(e: WechatMiniprogram.SwitchChange) {
    const value = !!e.detail.value
    setUseMockWeekPlan(value)
    this.setData({ useMockWeekPlan: value })
    wx.showToast({ title: value ? '已切换为 Mock 模式' : '已切换为云端模式', icon: 'none' })
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
