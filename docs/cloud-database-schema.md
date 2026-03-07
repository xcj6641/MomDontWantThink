# 辅食周节奏助理 - 云数据库 Schema 设计

> 命名规范：**camelCase**；周标识：**weekStartDate = YYYY-MM-DD**（当周周一日期）。

---

## 1. users（用户）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 是 | 系统默认 |
| openid | string | 是 | 微信 openid，用户唯一标识 |
| nickName | string | 否 | 昵称（来自头像昵称） |
| avatarUrl | string | 否 | 头像 URL |
| createdAt | string | 是 | ISO 8601，如 2025-03-02T08:00:00.000Z |
| updatedAt | string | 是 | 同上 |

**示例文档：**
```json
{
  "_id": "user_xxx_openid_abc123",
  "openid": "oABC123xxxx",
  "nickName": "宝妈",
  "avatarUrl": "https://...",
  "createdAt": "2025-03-02T08:00:00.000Z",
  "updatedAt": "2025-03-02T08:00:00.000Z"
}
```

**索引建议：**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| openid_1 | openid | 唯一 | 按 openid 查用户 |

---

## 2. week_settings（周设置）

每用户每周一份：选用哪套模板、是否沿用上周等；用于「生成下周沿用上周设置」。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 是 | 系统默认 |
| openid | string | 是 | 用户标识 |
| weekStartDate | string | 是 | 当周周一 YYYY-MM-DD |
| templateId | string | 否 | 本周使用的模板 _id，空则用默认 |
| blwByMeal | object | 否 | 各餐 BLW 开关，key 为 mealKey，value 为 boolean |
| confirmed | boolean | 否 | 用户是否已确认本周计划（初始生成后需在计划页点击「确认并开始本周计划」才为 true） |
| createdAt | string | 是 | 创建时间 |
| updatedAt | string | 是 | 更新时间 |

**示例文档：**
```json
{
  "_id": "week_settings_xxx",
  "openid": "oABC123xxxx",
  "weekStartDate": "2025-03-03",
  "templateId": "tpl_default_7day",
  "blwByMeal": {
    "breakfast": false,
    "snack1": false,
    "lunch": false,
    "snack2": false,
    "dinner": true
  },
  "createdAt": "2025-03-02T08:00:00.000Z",
  "updatedAt": "2025-03-02T08:00:00.000Z"
}
```

**索引建议：**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| openid_weekStartDate | openid, weekStartDate | 唯一 | 按用户+周查设置 |

---

## 3. week_plans（周计划：日期绑定 + 单日 override）

按周存储：一周一条文档，内含 7 天的每日菜单；单日可 override 覆盖当日餐次。

**餐次 key（mealKey）**：`breakfast` | `snack1` | `lunch` | `snack2` | `dinner`（顿数由宝宝月龄决定，见 templates）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 是 | 系统默认 |
| openid | string | 是 | 用户标识 |
| weekStartDate | string | 是 | 当周周一 YYYY-MM-DD |
| days | array | 是 | 长度 7，按周一～周日 |
| days[].date | string | 是 | 当日 YYYY-MM-DD |
| days[].isOverridden | boolean | 是 | 当日是否被手动覆盖 |
| days[].meals | array | 是 | 当日餐次（数量按月龄：4-5 月 1 餐，6-8 月 2 餐，9-11 月 4 餐，12-18 月 5 餐），结构见下 |
| days[].meals[].mealKey | string | 是 | 餐次 key |
| days[].meals[].recipeId | string | 否 | 菜谱 _id，空为占位/未选 |
| days[].meals[].recipeName | string | 否 | 展示用名称 |
| days[].meals[].blw | boolean | 是 | 该餐是否 BLW |
| createdAt | string | 是 | 创建时间 |
| updatedAt | string | 是 | 更新时间 |

**示例文档：**
```json
{
  "_id": "week_plan_xxx",
  "openid": "oABC123xxxx",
  "weekStartDate": "2025-03-03",
  "days": [
    {
      "date": "2025-03-03",
      "isOverridden": false,
      "meals": [
        { "mealKey": "breakfast", "recipeId": "recipe_001", "recipeName": "南瓜粥", "blw": false },
        { "mealKey": "snack1", "recipeId": "recipe_002", "recipeName": "香蕉", "blw": true },
        { "mealKey": "lunch", "recipeId": "recipe_003", "recipeName": "碎菜肉末面", "blw": false },
        { "mealKey": "snack2", "recipeId": "", "recipeName": "未安排", "blw": false },
        { "mealKey": "dinner", "recipeId": "recipe_004", "recipeName": "手指胡萝卜", "blw": true }
      ]
    },
    {
      "date": "2025-03-04",
      "isOverridden": true,
      "meals": [
        { "mealKey": "breakfast", "recipeId": "recipe_005", "recipeName": "红薯泥", "blw": false },
        { "mealKey": "morningSnack", "recipeId": "", "recipeName": "未安排", "blw": false },
        { "mealKey": "lunch", "recipeId": "recipe_003", "recipeName": "碎菜肉末面", "blw": false },
        { "mealKey": "snack2", "recipeId": "recipe_006", "recipeName": "苹果条", "blw": true },
        { "mealKey": "dinner", "recipeId": "recipe_007", "recipeName": "西兰花", "blw": true }
      ]
    }
  ],
  "createdAt": "2025-03-02T08:00:00.000Z",
  "updatedAt": "2025-03-02T10:00:00.000Z"
}
```

**索引建议：**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| openid_weekStartDate | openid, weekStartDate | 唯一 | 按用户+周查计划 |

---

## 4. templates（模板 = 顿数 + 每餐 BLW，不写死菜单）

模板只确定**有几顿、每顿是否 BLW**；具体菜谱在**生成计划时**从 `recipes` 集合按月龄、餐别、过敏等动态筛选。系统默认模板按月龄段（ageBand）区分，不同月龄顿数不同（4-5 月 1 餐、6-8 月 2 餐、9-11 月 4 餐、12-18 月 5 餐）。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 是 | 系统默认 |
| openid | string | 否 | 空或 "system" 表示系统模板 |
| ageBand | string | 否 | 月龄段标识，如 "4-5"、"6-8"、"9-11"、"12-18"，系统默认模板必填 |
| name | string | 是 | 模板名称 |
| meals | array | 是 | 餐次配置（数量按月龄），仅含顿数 + 每餐 BLW |
| meals[].mealKey | string | 是 | breakfast / snack1 / lunch / snack2 / dinner |
| meals[].label | string | 是 | 展示名，如「早餐」「早点」 |
| meals[].defaultBlw | boolean | 是 | 该餐默认是否 BLW |
| meals[].recipeIds | array | 否 | 可选；默认模板为空，生成时从 recipes 动态选菜 |
| createdAt | string | 是 | 创建时间 |
| updatedAt | string | 是 | 更新时间 |

**示例文档（系统默认 9-11 月）：**
```json
{
  "_id": "tpl_system_9-11",
  "openid": "system",
  "ageBand": "9-11",
  "name": "默认(9-11月)",
  "meals": [
    { "mealKey": "breakfast", "label": "早餐", "defaultBlw": false, "recipeIds": [] },
    { "mealKey": "snack1", "label": "早点", "defaultBlw": false, "recipeIds": [] },
    { "mealKey": "lunch", "label": "午餐", "defaultBlw": false, "recipeIds": [] },
    { "mealKey": "dinner", "label": "晚餐", "defaultBlw": true, "recipeIds": [] }
  ],
  "createdAt": "2025-03-02T08:00:00.000Z",
  "updatedAt": "2025-03-02T08:00:00.000Z"
}
```

**索引建议：**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| openid_ageBand | openid, ageBand | 普通 | 按用户/系统 + 月龄段查默认模板 |
| openid_1 | openid | 普通 | 查某用户的模板 / 系统模板 |
| _id | _id | 唯一 | 按 templateId 查 |

---

## 5. recipes（系统菜谱 + 用户自定义菜谱）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 是 | 系统默认 |
| openid | string | 否 | 空或 "system" 为系统菜谱 |
| name | string | 是 | 菜谱名称 |
| ingredients | array | 是 | 食材列表，用于购物清单与过敏排除 |
| ingredients[].name | string | 是 | 食材名 |
| ingredients[].amount | string | 否 | 用量描述，如 "适量" "1个" |
| category | string | 否 | 分类：主食/蔬菜/肉蛋/水果等 |
| ageRangeMonths | object | 否 | 适龄月龄：{ min: number, max: number }，生成时只选 min <= babyAgeMonths <= max 的菜谱 |
| mealTypes | array | 否 | 适用餐别，如 ["breakfast","lunch"]，用于按 mealSlots 过滤 |
| isBlwFriendly | boolean | 否 | 是否适合 BLW，BLW 餐只选为 true 的 |
| steps | array | 否 | 步骤文案，非必 |
| createdAt | string | 是 | 创建时间 |
| updatedAt | string | 是 | 更新时间 |

**示例文档：**
```json
{
  "_id": "recipe_001",
  "openid": "system",
  "name": "南瓜粥",
  "ageRangeMonths": { "min": 6, "max": 18 },
  "ingredients": [
    { "name": "南瓜", "amount": "50g" },
    { "name": "大米", "amount": "30g" }
  ],
  "category": "主食",
  "steps": ["南瓜蒸熟压泥", "大米煮粥后拌入南瓜泥"],
  "createdAt": "2025-03-02T08:00:00.000Z",
  "updatedAt": "2025-03-02T08:00:00.000Z"
}
```

**索引建议：**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| openid_1 | openid | 普通 | 查用户/系统菜谱 |
| openid_name | openid, name | 普通 | 按名称查 |

---

## 6. meal_logs（进食记录，支持 reaction）

标记「已做」时写入；支持反应（好吃/不爱吃等），不推断过敏原。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 是 | 系统默认 |
| openid | string | 是 | 用户标识 |
| date | string | 是 | 日期 YYYY-MM-DD |
| mealKey | string | 是 | 餐次 |
| recipeId | string | 否 | 菜谱 _id |
| recipeName | string | 否 | 当时菜谱名，便于展示 |
| reaction | string | 否 | 反应：good / bad / skip / null（未填） |
| note | string | 否 | 异常/备注（不推断过敏原） |
| weekStartDate | string | 否 | 所属周，便于按周查 |
| loggedAt | string | 是 | 记录时间 ISO 8601 |

**示例文档：**
```json
{
  "_id": "meal_log_xxx",
  "openid": "oABC123xxxx",
  "date": "2025-03-03",
  "mealKey": "dinner",
  "recipeId": "recipe_004",
  "recipeName": "手指胡萝卜",
  "reaction": "good",
  "note": "",
  "weekStartDate": "2025-03-03",
  "loggedAt": "2025-03-03T18:30:00.000Z"
}
```

**索引建议：**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| openid_date_mealKey | openid, date, mealKey | 唯一 | 防重复、按日查 |
| openid_weekStartDate | openid, weekStartDate | 普通 | 按周查记录 |

---

## 7. preferences（宝宝生日/月龄、过敏食材、BLW 喜欢/不喜欢）

不用于医疗推断，仅用于生成菜单与文案的偏好过滤与提示。首次使用在辅食页初始界面填写宝宝生日后，由 savePreferences 写入并据此计算 babyAgeMonths。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 是 | 系统默认 |
| openid | string | 是 | 用户标识，一用户一条 |
| babyBirthday | string | 否 | 宝宝生日 YYYY-MM-DD，初始界面必填；保存时据此计算 babyAgeMonths |
| babyAgeMonths | number | 否 | 宝宝月龄（整数），由 babyBirthday 计算或手动填写，生成计划前必填 |
| allergyIngredientNames | array | 否 | 过敏/忌口食材名（字符串数组） |
| blwLikes | array | 否 | BLW 喜欢食材或菜谱 id |
| blwDislikes | array | 否 | BLW 不喜欢食材或菜谱 id |
| updatedAt | string | 是 | 更新时间 |

**示例文档：**
```json
{
  "_id": "pref_xxx",
  "openid": "oABC123xxxx",
  "babyBirthday": "2024-04-01",
  "babyAgeMonths": 11,
  "allergyIngredientNames": ["芒果", "虾"],
  "blwLikes": ["胡萝卜", "西兰花", "recipe_004"],
  "blwDislikes": ["苦瓜"],
  "updatedAt": "2025-03-02T08:00:00.000Z"
}
```

**索引建议：**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| openid_1 | openid | 唯一 | 按用户查偏好 |

---

## 8. shopping_list（购物清单：已备 X / 共 Y，每周重置）

用于「本周购物清单」：从 week_plans 聚合食材，已勾选为已备，每周重置。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| _id | string | 是 | 系统默认 |
| openid | string | 是 | 用户标识 |
| weekStartDate | string | 是 | 当周周一 YYYY-MM-DD |
| items | array | 是 | 清单项 |
| items[].ingredientName | string | 是 | 食材名 |
| items[].amount | string | 否 | 用量汇总描述 |
| items[].prepared | boolean | 是 | 是否已备（勾选） |
| createdAt | string | 是 | 创建时间 |
| updatedAt | string | 是 | 更新时间 |

**示例文档：**
```json
{
  "_id": "shop_xxx",
  "openid": "oABC123xxxx",
  "weekStartDate": "2025-03-03",
  "items": [
    { "ingredientName": "南瓜", "amount": "约200g", "prepared": true },
    { "ingredientName": "大米", "amount": "约100g", "prepared": true },
    { "ingredientName": "西兰花", "amount": "1朵", "prepared": false }
  ],
  "createdAt": "2025-03-02T08:00:00.000Z",
  "updatedAt": "2025-03-03T09:00:00.000Z"
}
```

**索引建议：**

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| openid_weekStartDate | openid, weekStartDate | 唯一 | 按用户+周查清单 |

---

## 9. 集合与索引速查表

| 集合 | 建议唯一索引 | 其他索引 |
|------|--------------|----------|
| users | openid | - |
| week_settings | openid + weekStartDate | - |
| week_plans | openid + weekStartDate | - |
| templates | - | openid, _id |
| recipes | - | openid, openid+name |
| meal_logs | openid + date + mealKey | openid + weekStartDate |
| preferences | openid | - |
| shopping_list | openid + weekStartDate | - |

---

## 10. 在云开发控制台创建步骤（简要）

1. 打开微信开发者工具 → 云开发 → 数据库。
2. 新建集合：依次创建 `users`、`week_settings`、`week_plans`、`templates`、`recipes`、`meal_logs`、`preferences`、`shopping_list`。
3. 对每个集合：进入「索引管理」→ 按上表添加对应字段索引（唯一索引勾选「唯一」）。
4. 可选：在 `templates`、`recipes` 中插入一条 `openid: "system"` 的示例文档，便于联调。

文档结束。
