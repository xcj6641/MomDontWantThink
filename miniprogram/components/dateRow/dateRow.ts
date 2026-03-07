Component({
  properties: {
    items: {
      type: Array,
      value: []
    }
  },

  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      const index = e.currentTarget.dataset.index as number
      const items = this.data.items as any[]
      const item = items[index]
      this.triggerEvent('datetap', { index, item })
    }
  }
})
