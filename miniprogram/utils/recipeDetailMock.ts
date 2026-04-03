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
    3: {
      basic: {
        name: '西兰花鸡肉泥',
        ageMonthMin: 6,
        ageMonthMax: 8,
        type: 'puree',
        texture: 'mashed',
        description: '适合 6–8 月龄的泥糊，西兰花与鸡肉搭配',
      },
      steps: [
        { stepNo: 1, content: '西兰花焯水至软，取花蕾部分' },
        { stepNo: 2, content: '鸡胸肉煮熟后剁碎' },
        { stepNo: 3, content: '西兰花与鸡肉一同打成泥即可' },
      ],
      ingredients: [
        { name: '西兰花', amountDisplay: '20g' },
        { name: '鸡胸肉', amountDisplay: '25g' },
      ],
      prepSummary: {
        weekend: ['西兰花 20g 焯熟冷冻', '鸡胸肉 25g 剁碎冷冻'],
        dayBefore: ['西兰花 20g 解冻', '鸡胸肉 25g 解冻'],
      },
      tips: ['西兰花可先焯水去农残，再打泥更细腻'],
    },
    4: {
      basic: {
        name: '苹果燕麦粥',
        ageMonthMin: 6,
        ageMonthMax: 8,
        type: 'porridge',
        texture: 'porridge',
        description: '适合 6–8 月龄的燕麦粥，苹果增加风味',
      },
      steps: [
        { stepNo: 1, content: '燕麦片加水煮软' },
        { stepNo: 2, content: '苹果去皮去核切小块，蒸熟压泥' },
        { stepNo: 3, content: '将苹果泥加入燕麦粥中拌匀即可' },
      ],
      ingredients: [
        { name: '燕麦片', amountDisplay: '20g' },
        { name: '苹果', amountDisplay: '30g' },
      ],
      prepSummary: {
        weekend: ['苹果 30g 蒸熟压泥冷冻'],
        dayBefore: ['燕麦 20g 提前煮粥', '苹果泥 30g 解冻'],
      },
      tips: ['苹果可选用口感偏面的品种，煮后更易压泥'],
    },
    5: {
      basic: {
        name: '土豆牛肉泥',
        ageMonthMin: 7,
        ageMonthMax: 9,
        type: 'puree',
        texture: 'mashed',
        description: '适合 7–9 月龄的泥糊，补铁好选择',
      },
      steps: [
        { stepNo: 1, content: '土豆去皮切块蒸熟压泥' },
        { stepNo: 2, content: '牛肉焯水后煮熟，剁碎或打泥' },
        { stepNo: 3, content: '土豆泥与牛肉泥混合拌匀即可' },
      ],
      ingredients: [
        { name: '土豆', amountDisplay: '40g' },
        { name: '牛肉', amountDisplay: '25g' },
      ],
      prepSummary: {
        weekend: ['土豆 40g 蒸熟压泥冷冻', '牛肉 25g 煮熟剁碎冷冻'],
        dayBefore: ['土豆泥 40g 解冻', '牛肉泥 25g 解冻'],
      },
      tips: ['牛肉可选用里脊或嫩肩，煮熟后更易打泥'],
    },
    6: {
      basic: {
        name: '胡萝卜土豆泥',
        ageMonthMin: 6,
        ageMonthMax: 8,
        type: 'puree',
        texture: 'mashed',
        description: '适合 6–8 月龄的根茎泥，口感绵软',
      },
      steps: [
        { stepNo: 1, content: '胡萝卜、土豆去皮切块蒸熟' },
        { stepNo: 2, content: '用勺背或料理机压成泥' },
        { stepNo: 3, content: '可加少量温水调至合适稠度' },
      ],
      ingredients: [
        { name: '胡萝卜', amountDisplay: '20g' },
        { name: '土豆', amountDisplay: '40g' },
      ],
      prepSummary: {
        weekend: ['胡萝卜 20g 蒸熟压泥冷冻', '土豆 40g 蒸熟压泥冷冻'],
        dayBefore: ['胡萝卜泥 20g 解冻', '土豆泥 40g 解冻'],
      },
      tips: ['根茎类易氧化，现做现吃或冷冻保存'],
    },
    7: {
      basic: {
        name: '山药鸡肉粥',
        ageMonthMin: 6,
        ageMonthMax: 8,
        type: 'porridge',
        texture: 'porridge',
        description: '适合 6–8 月龄的软烂粥，山药健脾',
      },
      steps: [
        { stepNo: 1, content: '大米淘净，山药去皮切小块' },
        { stepNo: 2, content: '大米与山药一同加水煮成粥' },
        { stepNo: 3, content: '鸡胸肉煮熟剁碎，加入粥中煮片刻即可' },
      ],
      ingredients: [
        { name: '大米', amountDisplay: '25g' },
        { name: '山药', amountDisplay: '30g' },
        { name: '鸡胸肉', amountDisplay: '20g' },
      ],
      prepSummary: {
        weekend: ['山药 30g 蒸熟压泥冷冻', '鸡胸肉 20g 剁碎冷冻'],
        dayBefore: ['大米 25g 提前煮粥', '山药泥 30g 解冻', '鸡肉泥 20g 解冻'],
      },
      tips: ['山药处理时可戴手套，避免黏液刺激手部'],
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
