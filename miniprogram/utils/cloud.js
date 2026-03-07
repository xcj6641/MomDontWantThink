/**
 * 统一云函数调用：loading、错误 toast、返回数据解析
 * 若未开通云开发或调用失败，返回 { success: false, code: 'CALL_FAIL' }，不抛错
 * @param {string} name 云函数名
 * @param {object} [data] 入参
 * @param {object} [opts] { showLoading?: boolean, loadingTitle?: string }
 * @returns {Promise<{ success: boolean, data?: any, code?: string, message?: string }>}
 */
function callCloud(name, data = {}, opts = {}) {
  const { showLoading = true, loadingTitle = '加载中...' } = opts
  if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    if (showLoading) wx.hideLoading()
    wx.showToast({ title: '未开通云开发', icon: 'none' })
    return Promise.resolve({ success: false, code: 'NO_CLOUD', message: '未开通云开发' })
  }
  if (showLoading) wx.showLoading({ title: loadingTitle, mask: true })
  return wx.cloud
    .callFunction({ name, data })
    .then((res) => {
      if (showLoading) wx.hideLoading()
      const result = (res.result && res.result) || {}
      if (result.success === false) {
        if (result.code === 'MISSING_BABY_AGE') {
          wx.showToast({ title: '先填写宝宝月龄哦', icon: 'none', duration: 2500 })
        } else {
          const msg = (result.message || result.code || '请求失败').slice(0, 20)
          wx.showToast({ title: msg, icon: 'none' })
        }
        return result
      }
      return result
    })
    .catch((err) => {
      if (showLoading) wx.hideLoading()
      const errMsg = err.errMsg || err.message || ''
      console.error('[云函数]', name, '失败:', errMsg, err)
      const isCloudFail = /cloud\.callFunction|cloud\.init|fail/i.test(errMsg)
      const msg = isCloudFail ? '云开发未就绪，请检查环境' : errMsg.slice(0, 20) || '网络错误'
      wx.showToast({ title: msg, icon: 'none' })
      return { success: false, code: 'CALL_FAIL', message: errMsg }
    })
}

module.exports = { callCloud }
