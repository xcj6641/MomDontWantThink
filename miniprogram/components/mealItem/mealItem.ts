Component({
  properties: {
    meal: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onView() {
      const meal = this.data.meal as any
      this.triggerEvent('view', { meal })
    },
    onShuffle() {
      const meal = this.data.meal as any
      this.triggerEvent('shuffle', { meal })
    },
    onDone() {
      const meal = this.data.meal as any
      this.triggerEvent('done', { meal })
    }
  }
})
