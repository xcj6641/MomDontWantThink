/**
 * 月龄 → 每日餐次结构（见 instruction/月龄餐数规则.md）
 * slot 枚举：breakfast, lunch, dinner, snack_am, snack_pm
 */
const AGE_BANDS = [
  { min: 0, max: 4, slots: [] },
  { min: 5, max: 6, slots: ['lunch'] },
  { min: 6, max: 9, slots: ['breakfast', 'lunch'] },
  { min: 9, max: 12, slots: ['breakfast', 'lunch', 'dinner'] },
  { min: 12, max: 999, slots: ['breakfast', 'lunch', 'dinner', 'snack_pm'] },
]

const SLOT_ORDER = ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner']

const MEAL_LABELS = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack_am: '上午加餐',
  snack_pm: '下午加餐',
  snack1: '上午加餐',
  snack2: '下午加餐',
  morningSnack: '上午加餐',
  afternoonSnack: '下午加餐',
}

const DEFAULT_BLW_PREFERENCE = {
  breakfast: false,
  snack_am: false,
  lunch: false,
  snack_pm: false,
  dinner: true,
}

/** 根据月龄(整数)返回该月龄的 slot 有序列表（按 SLOT_ORDER 排序） */
function getOrderedSlotsForAge(months) {
  const band = getAgeBand(months)
  if (!band || !band.slots.length) return []
  return SLOT_ORDER.filter(s => band.slots.includes(s))
}

/** 根据月龄返回月龄段配置 { slots } */
function getAgeBand(months) {
  if (months == null || months < 0) return AGE_BANDS[0]
  for (let i = AGE_BANDS.length - 1; i >= 0; i--) {
    if (months >= AGE_BANDS[i].min && months < AGE_BANDS[i].max) return AGE_BANDS[i]
    if (months >= AGE_BANDS[i].min && AGE_BANDS[i].max === 999) return AGE_BANDS[i]
  }
  return AGE_BANDS[0]
}

/** 首次使用默认日期分配（2-3-2） */
function getDefaultDateAssignments(weekStartDate, addDays) {
  const days = []
  for (let i = 0; i < 7; i++) days.push(addDays(weekStartDate, i))
  return [
    { date: days[0], templateIndex: 0 },
    { date: days[1], templateIndex: 0 },
    { date: days[2], templateIndex: 1 },
    { date: days[3], templateIndex: 1 },
    { date: days[4], templateIndex: 1 },
    { date: days[5], templateIndex: 2 },
    { date: days[6], templateIndex: 2 },
  ]
}

module.exports = {
  AGE_BANDS,
  SLOT_ORDER,
  MEAL_LABELS,
  DEFAULT_BLW_PREFERENCE,
  getOrderedSlotsForAge,
  getAgeBand,
  getDefaultDateAssignments,
}
