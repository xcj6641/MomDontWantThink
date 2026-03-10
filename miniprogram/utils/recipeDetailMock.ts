/**
 * 菜谱详情页 Mock 数据，与 docs/baby-food-mock-api.json recipeDetail 结构一致
 */

const TYPE_LABELS: Record<string, string> = {
  puree: '泥糊',
  porridge: '粥类',
  noodles: '面类',
  rice: '软饭',
  finger_food: '手指食物',
}
const TEXTURE_LABELS: Record<string, string> = {
  puree: '泥糊',
  mashed: '碾碎',
  porridge: '软烂',
  soft_chunks: '软块',
  finger_food: '手指食物',
}

function ageLabel(min: number, max: number): string {
  if (min == null || max == null) return ''
  return `${min}–${max}个月`
}

export function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] || type || ''
}
export function getTextureLabel(texture: string): string {
  return TEXTURE_LABELS[texture] || texture || ''
}
export function getAgeLabel(ageMonthMin: number, ageMonthMax: number): string {
  return ageLabel(ageMonthMin, ageMonthMax)
}

/** 完整菜谱详情 Mock（id 1、2 有完整数据，其余用简版） */
export function getMockRecipeDetail(id: number): {
  basic: { name: string; ageLabel: string; typeLabel: string; textureLabel: string; description: string }
  prepSummary: { weekend: string[]; dayBefore: string[] }
  ingredients: Array<{ name: string; amountDisplay: string }>
  steps: Array<{ stepNo: number; content: string }>
  tips: string[]
} | null {
  const map: Record<number, any> = {
    1: {
      basic: {
        name: '胡萝卜鸡肉粥',
        ageMonthMin: 6,
        ageMonthMax: 7,
        type: 'porridge',
        texture: 'porridge',
        description: '适合 6–7 月龄的软烂粥品',
      },
      steps: [
        { stepNo: 1, content: '大米淘净，加约6倍水煮成粥' },
        { stepNo: 2, content: '胡萝卜去皮切丁蒸熟压泥' },
        { stepNo: 3, content: '鸡胸肉剁成泥煮熟' },
        { stepNo: 4, content: '将胡萝卜泥和鸡肉泥加入粥中煮至软烂即可' },
      ],
      ingredients: [
        { name: '大米', amountDisplay: '30g' },
        { name: '胡萝卜', amountDisplay: '20g' },
        { name: '鸡胸肉', amountDisplay: '25g' },
      ],
      prepSummary: {
        weekend: ['胡萝卜 20g 打成泥冷冻', '鸡胸肉 25g 剁碎冷冻'],
        dayBefore: ['大米 30g 提前煮粥', '胡萝卜 20g 解冻', '鸡胸肉 25g 解冻'],
      },
      tips: [
        '首次添加鸡肉时建议少量尝试并观察宝宝反应',
        '解冻后的食材建议当天使用完',
      ],
    },
    2: {
      basic: {
        name: '南瓜小米粥',
        ageMonthMin: 6,
        ageMonthMax: 7,
        type: 'porridge',
        texture: 'porridge',
        description: '适合 6–7 月龄的软烂粥品',
      },
      steps: [
        { stepNo: 1, content: '小米淘净，南瓜去皮切小块' },
        { stepNo: 2, content: '小米与南瓜一同加水煮至软烂' },
        { stepNo: 3, content: '用勺背将南瓜压泥，与粥拌匀即可' },
      ],
      ingredients: [
        { name: '小米', amountDisplay: '25g' },
        { name: '南瓜', amountDisplay: '30g' },
      ],
      prepSummary: {
        weekend: ['南瓜 30g 蒸熟压泥冷冻'],
        dayBefore: ['小米 25g 提前煮粥', '南瓜 30g 解冻'],
      },
      tips: ['南瓜富含胡萝卜素，建议与油脂同食更易吸收'],
    },
  }
  const raw = map[id]
  if (!raw) return null
  const basic = {
    ...raw.basic,
    ageLabel: ageLabel(raw.basic.ageMonthMin, raw.basic.ageMonthMax),
    typeLabel: getTypeLabel(raw.basic.type),
    textureLabel: getTextureLabel(raw.basic.texture),
  }
  return {
    basic: {
      name: basic.name,
      ageLabel: basic.ageLabel,
      typeLabel: basic.typeLabel,
      textureLabel: basic.textureLabel,
      description: basic.description,
    },
    prepSummary: raw.prepSummary,
    ingredients: raw.ingredients,
    steps: raw.steps,
    tips: raw.tips || [],
  }
}
