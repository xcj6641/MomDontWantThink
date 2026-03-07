// app.ts
App({
  globalData: {
    userInfo: undefined as WechatMiniprogram.UserInfo | undefined,
    openid: '',
  },

  onLaunch() {
    if (wx.cloud) {
      // 使用你的云环境 ID；若仍报「云开发未就绪」，可改为 init({ traceUser: true }) 使用工具当前选中的环境
      wx.cloud.init({
        env: 'cloudbase-0gvft8jua95a94fa',
        traceUser: true,
      })
    }
  },
})
