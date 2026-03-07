Component({
  methods: {
    show(payload: string | { title: string; icon?: 'none' | 'success'; duration?: number }) {
      let title = ''
      let icon: 'none' | 'success' = 'none'
      let duration = 1500
      if (typeof payload === 'string') {
        title = payload
      } else {
        title = payload.title
        if (payload.icon) icon = payload.icon
        if (typeof payload.duration === 'number') duration = payload.duration
      }
      if (!title) return
      wx.showToast({ title, icon, duration })
    }
  }
})
