/**
 * Mock 周计划生成：按备餐数 + 本周 7 天日期生成可驱动界面展示与跳转的周计划数据
 * 与 instruction/备餐计划页 等产品逻辑一致，固定分配方案，菜谱循环复用
 */

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 将 assignedDates 转为前端展示文案：单天「周三」，连续「周三-周五」 */
export function formatAssignedDateText(dates: string[]): string {
  if (!dates || dates.length === 0) return ''
  const labels = dates.map((date) => {
    const day = new Date(date + 'T12:00:00').getDay()
    return WEEKDAYS[(day + 6) % 7]
  })
  if (labels.length === 1) return labels[0]
  return `${labels[0]}-${labels[labels.length - 1]}`
}

/** 根据日期字符串取星期文案 */
export function getWeekdayLabel(dateStr: string): string {
  const day = new Date(dateStr + 'T12:00:00').getDay()
  return WEEKDAYS[(day + 6) % 7]
}

/** 固定 Mock 日期分组：覆盖整周、尽量连续、每套至少 1 天；非法 prepCount 按 3 套 */
export function getMockDateGroups(prepCount: number, weekDates: string[]): string[][] {
  const map: Record<number, number[][]> = {
    3: [[0, 1, 2], [3, 4], [5, 6]],
    4: [[0, 1], [2, 3], [4, 5], [6]],
    5: [[0, 1], [2, 3], [4], [5], [6]],
    6: [[0, 1], [2], [3], [4], [5], [6]],
    7: [[0], [1], [2], [3], [4], [5], [6]],
  }
  const indices = map[prepCount] || map[3]
  return indices.map((group) => group.map((i) => weekDates[i]))
}

export const mockRecipes = [
  { id: 1, name: '胡萝卜鸡肉粥', stage: 2, type: 'porridge' },
  { id: 2, name: '南瓜小米粥', stage: 2, type: 'porridge' },
  { id: 3, name: '西兰花鸡肉泥', stage: 2, type: 'puree' },
  { id: 4, name: '苹果燕麦粥', stage: 2, type: 'porridge' },
  { id: 5, name: '土豆牛肉泥', stage: 2, type: 'puree' },
  { id: 6, name: '胡萝卜土豆泥', stage: 2, type: 'puree' },
  { id: 7, name: '山药鸡肉粥', stage: 2, type: 'porridge' },
]

export interface MockWeekPlanItem {
  id: string
  recipeId: number
  recipeName: string
  assignedDates: string[]
  assignedDateText: string
  status: string
}

export interface MockWeekPlanResult {
  weekPlan: {
    weekStart: string
    prepCount: number
    items: MockWeekPlanItem[]
  }
}

/**
 * 按用户选择的备餐数和本周 7 天日期生成 Mock 周计划
 * @param selectedPrepCount 前端选择的备餐数（3–7，非法则按 3）
 * @param weekDates 本周 7 天日期数组 [周一, …, 周日]
 */
export function generateMockWeekPlan(
  selectedPrepCount: number,
  weekDates: string[]
): MockWeekPlanResult {
  const prepCount = Math.min(7, Math.max(1, Math.floor(selectedPrepCount) || 3))
  const groups = getMockDateGroups(prepCount, weekDates)

  const weekPlan = {
    weekStart: weekDates[0],
    prepCount,
    items: groups.map((dates, index) => {
      const recipe = mockRecipes[index % mockRecipes.length]
      return {
        id: `prep_${index + 1}`,
        recipeId: recipe.id,
        recipeName: recipe.name,
        assignedDates: dates,
        assignedDateText: formatAssignedDateText(dates),
        status: 'planned',
      }
    }),
  }

  return { weekPlan }
}

const USE_MOCK_WEEK_PLAN_KEY = 'useMockWeekPlanMode'

/** 是否使用 Mock 周计划（生成本周计划时）：true=Mock 联调，false=调用云端 */
export function getUseMockWeekPlan(): boolean {
  try {
    const v = wx.getStorageSync(USE_MOCK_WEEK_PLAN_KEY)
    if (v === false || v === 'false' || v === 0) return false
    return true
  } catch {
    return true
  }
}

export function setUseMockWeekPlan(value: boolean): void {
  wx.setStorageSync(USE_MOCK_WEEK_PLAN_KEY, value)
}

/** 由本周周一日期得到本周 7 天日期数组 */
export function getWeekDates(weekStart: string): string[] {
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${day}`)
  }
  return dates
}
