# 云数据库 Schema 设计

> 命名规范：**camelCase**；周标识：**weekStartDate = YYYY-MM-DD（当周周一）**。
> 基于 `teams/data_structure_description.md` 和 `teams/prompt.md` 设计。

---

## 核心概念

```
用户 (User)
  └── 周计划 (WeekPlan) — 每周一份，最多保留 6 个月
        └── 备餐 (MealPrep) — 每周 1-7 个，每个可分配给多天
              └── 餐次 (MealSlot) — 由宝宝月龄决定数量（如 6 月龄=1 餐，≥12 月龄=3 餐）
                    └── 菜品引用 (RecipeRef) — 每个餐次包含多个菜品
```

**关键设计决策：**

1. **备餐内嵌于周计划** — `week_plans` 文档内嵌 `mealPreps` 数组，避免跨集合 join，读写原子。4 层嵌套（WeekPlan > MealPrep > MealSlot > RecipeRef）是合理的：最大文档体积约 7×3×5=105 个 RecipeRef，远低于 CloudBase 单文档限制，且查询时无需 join。
2. **菜品引用去规范化** — `recipeName` 在引用处冗余存储，读取无需二次查询。
3. **单日调整 = 新备餐** — 用户调整某天时，新建一个 `isOverride: true` 的备餐仅分配给该天，同时从原备餐的 `assignedDays` 移除该天。
4. **周计划自包含** — 不引用外部"已保存周计划"ID，避免删除后数据断链；`saved_week_plans` 中的数据在复制进 `week_plans` 时完整拷贝。
5. **月龄快照** — `babyAgeMonths` 在创建周计划时记录，历史计划不随宝宝成长变动。

---

## 多用户权限模型

- 所有用户私有集合查询必须带 `openid` 过滤
- 云函数通过 `event.userInfo.openId` 获取 openid，客户端不可传入
- `recipes`、`allergies` 中 `openid = "system"` 的记录全局可读

---

## 集合一览

| 集合名 | 说明 | 归属 |
|--------|------|------|
| `users` | 用户基础信息 + 宝宝档案 | 私有 |
| `allergies` | 过敏原列表（系统预置 + 用户扩展） | 共享/私有 |
| `recipes` | 系统 + 用户自定义菜谱 | 共享/私有 |
| `age_meal_config` | 月龄 → 餐次配置（系统） | 全局只读 |
| `week_plans` | 周计划（内嵌备餐） | 私有 |
| `saved_week_plans` | 用户保存的周计划快照 | 私有 |
| `meal_logs` | 已做记录 | 私有 |
| `shopping_list` | 购物清单（每用户一份） | 私有 |
| `saved_recipes` | 宝宝喜欢 / 用户收藏的菜谱 | 私有 |

---

## 1. users（用户 + 宝宝档案）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 是 | 系统默认 |
| `openid` | string | 是 | 微信 openid，用户唯一标识 |
| `nickName` | string | 否 | 用户昵称 |
| `avatarUrl` | string | 否 | 头像 URL |
| `baby.name` | string | 否 | 宝宝昵称 |
| `baby.birthDate` | string | 是 | 出生日期 YYYY-MM-DD |
| `baby.allergies` | string[] | 是 | 过敏原名称列表（对应 `allergies.name`），空数组=无过敏 |
| `createdAt` | string | 是 | ISO 8601 |
| `updatedAt` | string | 是 | ISO 8601 |

**示例：**
```json
{
  "_id": "auto",
  "openid": "oABC123",
  "nickName": "宝妈",
  "avatarUrl": "https://...",
  "baby": {
    "name": "小花",
    "birthDate": "2024-10-01",
    "allergies": ["鸡蛋", "花生"]
  },
  "createdAt": "2025-03-01T08:00:00.000Z",
  "updatedAt": "2025-03-01T08:00:00.000Z"
}
```

**索引：**
| 字段 | 类型 |
|------|------|
| `openid` | 唯一 |

---

## 2. allergies（过敏原）

系统维护常见过敏原列表，用作 UI 选择器数据源和菜谱过滤依据。用户也可添加自定义过敏原。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 是 | 系统默认 |
| `name` | string | 是 | 过敏原名称，如 "鸡蛋"、"花生" |
| `isSystem` | boolean | 是 | `true` = 系统预置，全局可读 |
| `openid` | string | 否 | 用户自定义时填写，系统预置为 null |

**系统预置示例：**
```json
[
  { "_id": "allergy_egg", "name": "鸡蛋", "isSystem": true, "openid": null },
  { "_id": "allergy_peanut", "name": "花生", "isSystem": true, "openid": null },
  { "_id": "allergy_milk", "name": "牛奶", "isSystem": true, "openid": null },
  { "_id": "allergy_wheat", "name": "小麦", "isSystem": true, "openid": null },
  { "_id": "allergy_soy", "name": "大豆", "isSystem": true, "openid": null },
  { "_id": "allergy_fish", "name": "鱼类", "isSystem": true, "openid": null },
  { "_id": "allergy_shellfish", "name": "贝壳类", "isSystem": true, "openid": null }
]
```

**索引：**
| 字段 | 类型 |
|------|------|
| `isSystem` | 普通 |
| `openid` | 普通 |

---

## 3. recipes（菜谱）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 是 | 系统默认 |
| `openid` | string | 是 | `"system"` = 系统预置；真实 openid = 用户创建 |
| `isSystem` | boolean | 是 | `true` 时全局可读 |
| `name` | string | 是 | 菜品名称 |
| `ageMinMonths` | number | 是 | 最低适用月龄 |
| `ingredients` | string[] | 是 | 食材列表（用于过敏筛查） |
| `tags` | string[] | 否 | 标签，如 "高铁"、"高蛋白" |
| `steps` | string[] | 否 | 制作步骤 |
| `imageUrl` | string | 否 | 菜品图片 URL |
| `createdAt` | string | 是 | ISO 8601 |

**示例：**
```json
{
  "_id": "recipe_001",
  "openid": "system",
  "isSystem": true,
  "name": "南瓜泥",
  "ageMinMonths": 6,
  "ingredients": ["南瓜"],
  "tags": ["高纤维", "易消化"],
  "steps": ["南瓜去皮切块", "蒸15分钟", "压泥"],
  "imageUrl": "https://...",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**索引：**
| 字段 | 类型 |
|------|------|
| `openid` | 普通 |
| `isSystem` | 普通 |
| `ageMinMonths` | 普通 |

---

## 4. age_meal_config（月龄餐次配置，系统集合）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 是 | 系统默认 |
| `minMonths` | number | 是 | 适用起始月龄（含） |
| `maxMonths` | number | 是 | 适用结束月龄（含），999 = 无上限 |
| `slots` | string[] | 是 | 餐次 key 列表，顺序即显示顺序 |
| `description` | string | 否 | 人类可读说明 |

**预置记录：**
```json
[
  { "_id": "age_6_8",   "minMonths": 6,  "maxMonths": 8,   "slots": ["lunch"],                         "description": "6-8 月龄，每天 1 餐辅食" },
  { "_id": "age_9_11",  "minMonths": 9,  "maxMonths": 11,  "slots": ["breakfast", "lunch"],             "description": "9-11 月龄，每天 2 餐辅食" },
  { "_id": "age_12_up", "minMonths": 12, "maxMonths": 999, "slots": ["breakfast", "lunch", "dinner"],   "description": "12 月龄+，每天 3 餐辅食" }
]
```

**餐次 key 说明：**
| key | 显示名 |
|-----|--------|
| `breakfast` | 早餐 |
| `lunch` | 午餐 |
| `dinner` | 晚餐 |
| `snack_am` | 上午加餐 |
| `snack_pm` | 下午加餐 |

---

## 5. week_plans（周计划，核心集合）

每用户每周一份文档，内嵌 1-7 个备餐。

### 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 是 | 系统默认 |
| `openid` | string | 是 | 所属用户 |
| `weekStartDate` | string | 是 | 当周周一，YYYY-MM-DD |
| `babyAgeMonths` | number | 是 | 创建时宝宝月龄快照 |
| `status` | string | 是 | `"draft"` \| `"confirmed"` |
| `mealPreps` | MealPrep[] | 是 | 本周备餐列表，1-7 项 |
| `createdAt` | string | 是 | ISO 8601 |
| `updatedAt` | string | 是 | ISO 8601 |
| `expiresAt` | string | 是 | createdAt + 6 个月，用于定期清理 |

### MealPrep（备餐）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mealPrepId` | string | 是 | 本文档内唯一 ID（nanoid/uuid） |
| `name` | string | 是 | 备餐名，如 "备餐A"、"周一单日调整" |
| `assignedDays` | number[] | 是 | 分配的星期，0=周一…6=周日；空数组=未分配 |
| `isOverride` | boolean | 是 | `true` = 单日调整备餐 |
| `mealSlots` | MealSlot[] | 是 | 餐次列表，由 `babyAgeMonths` 决定数量 |

### MealSlot（餐次）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slotKey` | string | 是 | 餐次 key，参见 age_meal_config.slots |
| `recipes` | RecipeRef[] | 是 | 该餐包含的菜品，支持多个 |

### RecipeRef（菜品引用）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `recipeId` | string | 是 | 引用 `recipes._id` |
| `recipeName` | string | 是 | 冗余存储名称，读取时无需查 recipes 集合 |
| `note` | string | 否 | 本次备注，如 "蒸软一点" |

### 完整示例

```json
{
  "_id": "auto",
  "openid": "oABC123",
  "weekStartDate": "2026-04-13",
  "babyAgeMonths": 14,
  "status": "confirmed",
  "mealPreps": [
    {
      "mealPrepId": "mp_001",
      "name": "备餐A",
      "assignedDays": [0, 1, 2],
      "isOverride": false,
      "mealSlots": [
        {
          "slotKey": "breakfast",
          "recipes": [
            { "recipeId": "recipe_001", "recipeName": "南瓜泥", "note": "" },
            { "recipeId": "recipe_002", "recipeName": "米粥", "note": "" }
          ]
        },
        {
          "slotKey": "lunch",
          "recipes": [
            { "recipeId": "recipe_003", "recipeName": "番茄蛋羹", "note": "" }
          ]
        },
        {
          "slotKey": "dinner",
          "recipes": [
            { "recipeId": "recipe_004", "recipeName": "西兰花软烂", "note": "" }
          ]
        }
      ]
    },
    {
      "mealPrepId": "mp_002",
      "name": "周六单日调整",
      "assignedDays": [5],
      "isOverride": true,
      "mealSlots": [
        {
          "slotKey": "breakfast",
          "recipes": [
            { "recipeId": "recipe_005", "recipeName": "燕麦粥", "note": "" }
          ]
        },
        {
          "slotKey": "lunch",
          "recipes": [
            { "recipeId": "recipe_006", "recipeName": "鸡肉泥", "note": "" }
          ]
        },
        {
          "slotKey": "dinner",
          "recipes": [
            { "recipeId": "recipe_007", "recipeName": "香蕉块", "note": "" }
          ]
        }
      ]
    }
  ],
  "createdAt": "2026-04-13T08:00:00.000Z",
  "updatedAt": "2026-04-14T10:30:00.000Z",
  "expiresAt": "2026-10-13T08:00:00.000Z"
}
```

**索引：**
| 字段组合 | 类型 | 说明 |
|----------|------|------|
| `openid + weekStartDate` | 唯一复合 | 每用户每周唯一 |
| `expiresAt` | 普通 | 定期清理过期计划 |

---

## 6. saved_week_plans（已保存的周计划快照）

用户手动保存周计划，供下次生成新周计划时复用。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 是 | 系统默认 |
| `openid` | string | 是 | 所属用户 |
| `name` | string | 是 | 用户自定义名称，如 "14个月常规周" |
| `babyAgeMonths` | number | 是 | 保存时的月龄 |
| `mealPreps` | MealPrep[] | 是 | 同 `week_plans.mealPreps` 结构，完整拷贝 |
| `savedAt` | string | 是 | ISO 8601 |

> 加载到新周计划时完整**复制**数据，不保留对此文档的引用。删除此记录不影响任何已生成的周计划。

**索引：**
| 字段 | 类型 |
|------|------|
| `openid` | 普通 |

---

## 7. meal_logs（已做记录）

用户点击"已做"时写入，供个人主页展示历史辅食记录。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 是 | 系统默认 |
| `openid` | string | 是 | 所属用户 |
| `weekPlanId` | string | 是 | 来源 `week_plans._id` |
| `weekStartDate` | string | 是 | 所属周，YYYY-MM-DD |
| `date` | string | 是 | 实际做餐日期，YYYY-MM-DD |
| `slotKey` | string | 是 | 餐次 key |
| `recipeId` | string | 是 | `recipes._id` |
| `recipeName` | string | 是 | 冗余存储名称 |
| `loggedAt` | string | 是 | 记录时间，ISO 8601 |

**示例：**
```json
{
  "_id": "auto",
  "openid": "oABC123",
  "weekPlanId": "wp_xxx",
  "weekStartDate": "2026-04-13",
  "date": "2026-04-14",
  "slotKey": "lunch",
  "recipeId": "recipe_003",
  "recipeName": "番茄蛋羹",
  "loggedAt": "2026-04-14T12:05:00.000Z"
}
```

**索引：**
| 字段组合 | 类型 | 说明 |
|----------|------|------|
| `openid` | 普通 | 查用户所有记录 |
| `openid + date` | 普通 | 查某天记录 |

---

## 8. shopping_list（购物清单）

每用户一份文档（upsert 模式），记录待购食材。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 是 | 系统默认 |
| `openid` | string | 是 | 所属用户，唯一 |
| `items` | ShoppingItem[] | 是 | 购物项列表 |
| `updatedAt` | string | 是 | ISO 8601 |

### ShoppingItem

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `itemId` | string | 是 | 本文档内唯一 ID |
| `name` | string | 是 | 食材名称 |
| `isChecked` | boolean | 是 | 是否已购买 |
| `source` | string | 否 | 来源 recipeId，手动添加时为 `"manual"` |

**示例：**
```json
{
  "_id": "auto",
  "openid": "oABC123",
  "items": [
    { "itemId": "item_001", "name": "南瓜", "isChecked": false, "source": "recipe_001" },
    { "itemId": "item_002", "name": "鸡蛋", "isChecked": true,  "source": "manual" }
  ],
  "updatedAt": "2026-04-14T09:00:00.000Z"
}
```

**索引：**
| 字段 | 类型 |
|------|------|
| `openid` | 唯一 |

---

## 9. saved_recipes（宝宝喜欢 / 用户收藏）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 是 | 系统默认 |
| `openid` | string | 是 | 所属用户 |
| `recipeId` | string | 是 | `recipes._id` |
| `recipeName` | string | 是 | 冗余存储名称 |
| `type` | string | 是 | `"liked"` = 宝宝喜欢；`"saved"` = 用户收藏 |
| `savedAt` | string | 是 | ISO 8601 |

**索引：**
| 字段组合 | 类型 | 说明 |
|----------|------|------|
| `openid + type` | 普通 | 查某类收藏 |
| `openid + recipeId + type` | 唯一复合 | 防重复收藏 |

---

## 数据流说明

### 生成周计划
1. 读取 `users` → 计算 `babyAgeMonths`
2. 读取 `age_meal_config` → 获取当前月龄对应 `slots`
3. 可选：读取 `saved_week_plans` 让用户选择复用哪个模板
4. 组装 `week_plans` 文档（`status = "draft"`），写入

### 添加备餐
```js
db.collection('week_plans').doc(weekPlanId).update({
  data: { mealPreps: db.command.push(newMealPrep) }
})
```

### 删除备餐
CloudBase 不支持按嵌套字段 `$pull`，需要 read-modify-write：
```js
const doc = await db.collection('week_plans').doc(weekPlanId).get()
const filtered = doc.data.mealPreps.filter(p => p.mealPrepId !== targetId)
await db.collection('week_plans').doc(weekPlanId).update({
  data: { mealPreps: filtered, updatedAt: new Date().toISOString() }
})
```

### 单日调整
1. 新建 `MealPrep`（`isOverride: true`，`assignedDays: [targetDay]`）
2. 原备餐的 `assignedDays` 移除 `targetDay`
3. 使用 read-modify-write 更新 `mealPreps` 数组 + `updatedAt`

### 确认周计划
```js
db.collection('week_plans').doc(id).update({
  data: { status: 'confirmed', updatedAt: new Date().toISOString() }
})
```

### 记录已做
```js
db.collection('meal_logs').add({ data: { openid, weekPlanId, date, slotKey, recipeId, recipeName, loggedAt } })
```

### 6 个月清理
云函数定期查询 `expiresAt < now` 的 `week_plans` 文档并删除。
