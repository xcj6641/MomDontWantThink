Component({
  properties: {
    tabs: {
      type: Array,
      value: []
    },
    activeId: {
      type: String,
      value: ''
    }
  },

  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string
      const index = e.currentTarget.dataset.index as number
      const tabs = this.data.tabs as any[]
      const tab = tabs[index]
      this.triggerEvent('tabchange', { id, tab })
    }
  }
})
