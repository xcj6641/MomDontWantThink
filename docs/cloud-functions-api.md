# 辅食周节奏助理 - 云函数清单与接口契约

> **约定**：所有云函数由云端根据调用上下文注入 `openid`，除特别说明外入参均不需传 openid。  
> **强调**：不做医疗推断、不做营养统计；异常标记仅做记录与提醒，不推断过敏原。

---

## 1. initUser

**purpose**  
确保当前用户在 `users` 集合中存在；若不存在则创建一条记录。用于登录/首次进入时调用。

**input**
```json
{
  "nickName": "宝妈",
  "avatarUrl": "https://..."
}
```
- `nickName`、`avatarUrl` 可选；不传则只创建 openid 记录。

**output**
```json
{
  "success": true,
  "user": {
    "_id": "user_xxx",
    "openid": "oABC123xxxx",
    "nickName": "宝妈",
    "avatarUrl": "https://...",
    "createdAt": "2025-03-02T08:00:00.000Z",
    "updatedAt": "2025-03-02T08:00:00.000Z"
  }
}
```
- 若用户已存在，可顺带更新 `nickName`/`avatarUrl` 和 `updatedAt` 后返回。

**collections touched**
- **读**：users（按 openid 查）
- **写**：users（无则 insert，有则可选 update）

**error cases**
- 无 openid（云环境未注入）：返回 `success: false`，code: `NO_OPENID`。

---

## 2. getHomeData

**purpose**  
首页数据：返回今日菜单、明日准备提示、下周是否已生成等状态。

**input**
```json
{
  "today": "2025-03-03"
}
```
- `today` 可选；不传则服务端按当前日期（或云函数所在时区）计算。

**output**
```json
{
  "success": true,
  "today": "2025-03-03",
  "todayMeals": [
    { "mealKey": "breakfast", "recipeId": "recipe_001", "recipeName": "南瓜粥", "blw": false },
    { "mealKey": "dinner", "recipeId": "recipe_004", "recipeName": "手指胡萝卜", "blw": true }
  ],
  "tomorrowTip": "明日午餐：碎菜肉末面，记得备好食材哦",
  "nextWeekStatus": "generated",
  "nextWeekStartDate": "2025-03-10"
}
```
- `todayMeals`：当日 5 餐（来自 week_plans 中该日，含 override）。
- `tomorrowTip`：助理型文案，基于明日菜单生成，如「记得…」「已帮你…」。
- `nextWeekStatus`：`"none"` | `"generated"`；下周是否有 week_plans。
- `nextWeekStartDate`：下周周一 YYYY-MM-DD。

**collections touched**
- **读**：week_plans（当前周 + 下周）、week_settings（可选，用于文案）

**error cases**
- 本周无计划：`todayMeals` 可为空数组，`tomorrowTip` 可为默认提示（如「去生成下周计划吧」）。

---

## 3. generateNextWeek

**purpose**  
生成下周计划：沿用上周的 week_settings（模板、blwByMeal）与偏好，按模板重新分配菜谱生成菜单；首次使用默认晚餐 BLW。写入 week_plans、week_settings、shopping_list（重置勾选状态）。

**input**
```json
{
  "nextWeekStartDate": "2025-03-10"
}
```
- `nextWeekStartDate` 可选；不传则服务端计算「下周周一」。

**output**
```json
{
  "success": true,
  "weekStartDate": "2025-03-10",
  "message": "已帮你生成下周计划，晚餐已默认设为 BLW，记得查看购物清单哦"
}
```

**collections touched**
- **读**：users、week_settings（上周）、templates、recipes、preferences
- **写**：week_settings（下周）、week_plans（下周 7 天内容）、shopping_list（按最终菜单汇总食材，prepared 全 false）

**逻辑要点**
- 上周无 week_settings 时：用默认模板 + 晚餐 defaultBlw=true，其余按模板 defaultBlw。
- 从模板的 recipeIds 池中随机/轮询选菜谱，排除 preferences.allergyIngredientNames 涉及食材的菜谱。
- 生成 7 天 × 5 餐；再根据 week_settings.blwByMeal 写每餐 blw。

**error cases**
- 下周已有 week_plans：可返回 `success: false`，code: `WEEK_ALREADY_EXISTS`，或询问是否覆盖。
- 无可用模板/菜谱：返回 `success: false`，code: `NO_TEMPLATE_OR_RECIPES`。

---

## 4. getWeekData

**purpose**  
获取某一周的完整数据：week_settings、templates、week_plans，用于周视图/编辑页。

**input**
```json
{
  "weekStartDate": "2025-03-03"
}
```
- `weekStartDate` 必填，当周周一 YYYY-MM-DD。

**output**
```json
{
  "success": true,
  "weekStartDate": "2025-03-03",
  "settings": {
    "_id": "week_settings_xxx",
    "templateId": "tpl_default_7day",
    "blwByMeal": { "breakfast": false, "dinner": true }
  },
  "template": {
    "_id": "tpl_default_7day",
    "name": "默认一周模板",
    "meals": []
  },
  "plan": {
    "_id": "week_plan_xxx",
    "days": [
      { "date": "2025-03-03", "isOverridden": false, "meals": [] }
    ]
  }
}
```
- 若某周无 plan，`plan` 可为 null；无 settings 时 `settings` 可为 null，`template` 可为默认模板。

**collections touched**
- **读**：week_settings、week_plans、templates

**error cases**
- weekStartDate 格式错误或非周一：返回 `success: false`，code: `INVALID_WEEK_START`。

---

## 5. updateWeekSettings

**purpose**  
更新本周/指定周的设置：N 套菜单（模板）+ 日期分配。确认时校验是否有空白天（未分配模板的日期）；支持自动均匀分配空白天；当 N 变小时，将被删除模板占用的日期均匀分配给剩余模板。

**input**
```json
{
  "weekStartDate": "2025-03-03",
  "templateId": "tpl_default_7day",
  "dateAssignments": [
    { "date": "2025-03-03", "templateId": "tpl_default_7day" },
    { "date": "2025-03-04", "templateId": "tpl_default_7day" }
  ],
  "blwByMeal": { "breakfast": false, "dinner": true },
  "autoFillEmptyDays": true
}
```
- `dateAssignments`：每日绑定到哪套模板（templateId）；长度可为 7。
- `autoFillEmptyDays`：为 true 时，对未分配日均匀分配现有模板。
- N 变少：例如原 3 套模板现改为 2 套，则原用第 3 套的日期按规则重新分配到 1 或 2。

**output**
```json
{
  "success": true,
  "weekStartDate": "2025-03-03",
  "message": "已帮你更新本周设置"
}
```

**collections touched**
- **读**：week_settings、week_plans、templates
- **写**：week_settings、week_plans（按新模板与日期重算当日餐次，保留已有 override 的日不改动或按产品约定处理）

**error cases**
- 存在空白天且未传 `autoFillEmptyDays: true` 或未补齐：返回 `success: false`，code: `EMPTY_DAYS`，列出空白天日期。
- templateId 不存在：返回 `success: false`，code: `TEMPLATE_NOT_FOUND`。

---

## 6. updateTemplate

**purpose**  
编辑模板（名称、每餐 defaultBlw、recipeIds 等）。影响所有绑定该模板的日期：仅影响“未 override”的日期，已 override 的当日不改动。

**input**
```json
{
  "templateId": "tpl_default_7day",
  "name": "默认一周模板",
  "meals": [
    { "mealKey": "breakfast", "label": "早餐", "defaultBlw": false, "recipeIds": ["recipe_001", "recipe_008"] },
    { "mealKey": "dinner", "label": "晚餐", "defaultBlw": true, "recipeIds": ["recipe_004", "recipe_007"] }
  ]
}
```
- 只传需要更新的字段即可；未传的保持原样。

**output**
```json
{
  "success": true,
  "templateId": "tpl_default_7day",
  "message": "已帮你更新模板，绑定该模板的日期已同步"
}
```

**collections touched**
- **读**：templates、week_plans、week_settings
- **写**：templates（更新该条）、week_plans（对使用该 template 且未 override 的日期，按新模板重新生成当日 meals）

**error cases**
- templateId 不存在或无权限：返回 `success: false`，code: `TEMPLATE_NOT_FOUND`。
- 系统模板（openid 为 system）仅允许部分字段可编辑（如 name），或禁止用户改：返回 `success: false`，code: `SYSTEM_TEMPLATE_READONLY`。

---

## 7. updateDayOverride

**purpose**  
修改单日某餐或整日 override：只影响当天的 overrides（当日 meals 与 isOverridden）。

**input**
```json
{
  "weekStartDate": "2025-03-03",
  "date": "2025-03-04",
  "isOverridden": true,
  "meals": [
    { "mealKey": "breakfast", "recipeId": "recipe_005", "recipeName": "红薯泥", "blw": false },
    { "mealKey": "dinner", "recipeId": "recipe_007", "recipeName": "西兰花", "blw": true }
  ]
}
```
- 传某日的完整 `meals`（5 餐）与 `isOverridden`；只更新该日，其他 6 日不动。

**output**
```json
{
  "success": true,
  "date": "2025-03-04",
  "message": "已帮你更新当日菜单"
}
```

**collections touched**
- **读**：week_plans
- **写**：week_plans（更新对应 week 文档中 days[].date === date 的那一项）

**error cases**
- 该周无 plan：返回 `success: false`，code: `NO_WEEK_PLAN`。
- date 不在 weekStartDate 当周：返回 `success: false`，code: `DATE_NOT_IN_WEEK`。

---

## 8. buildShoppingList

**purpose**  
按「最终菜单（含 override）」汇总本周食材，返回分类列表 + 已备 X/共 Y；每周重置时新建或覆盖 shopping_list，勾选状态（prepared）重置为 false。

**input**
```json
{
  "weekStartDate": "2025-03-03",
  "resetPrepared": false
}
```
- `resetPrepared`：为 true 时将该周 shopping_list 所有 item.prepared 置为 false（每周重置勾选状态）。

**output**
```json
{
  "success": true,
  "weekStartDate": "2025-03-03",
  "summary": { "preparedCount": 2, "totalCount": 5 },
  "itemsByCategory": {
    "蔬菜": [
      { "ingredientName": "南瓜", "amount": "约200g", "prepared": true },
      { "ingredientName": "西兰花", "amount": "1朵", "prepared": false }
    ],
    "主食": [
      { "ingredientName": "大米", "amount": "约100g", "prepared": true }
    ]
  },
  "flatItems": [
    { "ingredientName": "南瓜", "amount": "约200g", "prepared": true, "category": "蔬菜" }
  ]
}
```
- 食材从 week_plans 当周 7 天最终菜单涉及的 recipe 聚合；去重、合并 amount 文案。
- 若该周尚无 shopping_list，先根据 week_plans 生成并写入 DB，再返回；prepared 初始全 false。

**collections touched**
- **读**：week_plans、recipes
- **写**：shopping_list（无则创建或覆盖；resetPrepared 时只更新 prepared）

**error cases**
- 该周无 week_plans：返回空列表或 `success: false`，code: `NO_WEEK_PLAN`。

---

## 9. toggleShoppingItem

**purpose**  
勾选/取消勾选某条购物项（已备状态）。

**input**
```json
{
  "weekStartDate": "2025-03-03",
  "ingredientName": "南瓜",
  "prepared": true
}
```
- 若同一周同食材有多条（不同 amount），需约定用 ingredientName+amount 或服务端生成 itemId 区分；此处简化为 ingredientName 唯一。

**output**
```json
{
  "success": true,
  "ingredientName": "南瓜",
  "prepared": true,
  "summary": { "preparedCount": 3, "totalCount": 5 }
}
```

**collections touched**
- **读**：shopping_list
- **写**：shopping_list（更新对应 item.prepared）

**error cases**
- 找不到该周清单或该 ingredientName：返回 `success: false`，code: `ITEM_NOT_FOUND`。

---

## 10. logMealDone

**purpose**  
标记某餐已做，写入 meal_logs（一条/日/餐唯一，可先查后增或 upsert）。

**input**
```json
{
  "date": "2025-03-03",
  "mealKey": "dinner",
  "recipeId": "recipe_004",
  "recipeName": "手指胡萝卜",
  "reaction": "good"
}
```
- `reaction` 可选：`good` | `bad` | `skip`；不传则不填。
- recipeId/recipeName 可从当前周计划带过去，便于展示与统计（不做营养统计，仅记录）。

**output**
```json
{
  "success": true,
  "logId": "meal_log_xxx",
  "message": "已帮你记下这餐啦"
}
```

**collections touched**
- **写**：meal_logs（openid + date + mealKey 唯一，存在则 update 否则 insert；写入 weekStartDate、loggedAt）

**error cases**
- date/mealKey 格式错误：返回 `success: false`，code: `INVALID_INPUT`。

---

## 11. markReaction

**purpose**  
异常标记：对某次进食记录标记身体反应类型（如皮疹/呕吐/腹泻/其他），仅做记录与提醒，不做医疗推断、不推断过敏原。

**input**
```json
{
  "date": "2025-03-03",
  "mealKey": "dinner",
  "reactionType": "rash",
  "note": "嘴角有一点红"
}
```
- `reactionType`：`rash` | `vomit` | `diarrhea` | `other`。
- `note` 可选，纯文本备注。

**output**
```json
{
  "success": true,
  "logId": "meal_log_xxx",
  "message": "已帮你记下这次反应，记得观察宝宝状态哦（本产品不推断过敏原）"
}
```

**collections touched**
- **读**：meal_logs（按 openid+date+mealKey 查）
- **写**：meal_logs（更新该条：增加 anomalyType、anomalyNote；若尚无记录则先创建一条再更新）

**schema 扩展建议**  
在 meal_logs 中增加字段（若尚未有）：
- `anomalyType`: string，取值 `rash` | `vomit` | `diarrhea` | `other`
- `anomalyNote`: string

**error cases**
- 无对应 meal_log：可先创建一条再写 reaction，或返回 `success: false`，code: `LOG_NOT_FOUND`。

---

## 12. recipes CRUD

### 12.1 createRecipe

**purpose**  
创建用户自定义菜谱。

**input**
```json
{
  "name": "南瓜粥",
  "ingredients": [
    { "name": "南瓜", "amount": "50g" },
    { "name": "大米", "amount": "30g" }
  ],
  "category": "主食",
  "steps": ["南瓜蒸熟压泥", "大米煮粥后拌入南瓜泥"]
}
```

**output**
```json
{
  "success": true,
  "recipeId": "recipe_user_xxx",
  "message": "已帮你添加菜谱"
}
```

**collections touched**  
- **写**：recipes（openid 为当前用户）

**error cases**  
- name 为空：返回 `success: false`，code: `INVALID_INPUT`。

---

### 12.2 updateRecipe

**purpose**  
更新用户自定义菜谱（仅本人）。

**input**
```json
{
  "recipeId": "recipe_user_xxx",
  "name": "南瓜小米粥",
  "ingredients": [],
  "category": "主食",
  "steps": []
}
```
- 只传要更新的字段。

**output**
```json
{
  "success": true,
  "recipeId": "recipe_user_xxx",
  "message": "已帮你更新菜谱"
}
```

**collections touched**  
- **读**：recipes  
- **写**：recipes  

**error cases**  
- recipeId 不存在或非当前用户：返回 `success: false`，code: `RECIPE_NOT_FOUND` 或 `FORBIDDEN`。  
- 系统菜谱不可改：`FORBIDDEN`。

---

### 12.3 deleteRecipe

**purpose**  
删除用户自定义菜谱（仅本人）。

**input**
```json
{
  "recipeId": "recipe_user_xxx"
}
```

**output**
```json
{
  "success": true,
  "message": "已删除该菜谱"
}
```

**collections touched**  
- **读**：recipes  
- **写**：recipes（删除）

**error cases**  
- recipeId 不存在或非当前用户或为系统菜谱：返回 `success: false`，code: `RECIPE_NOT_FOUND` 或 `FORBIDDEN`。

---

### 12.4 listMyRecipes

**purpose**  
列出当前用户可用的菜谱：系统菜谱 + 用户自定义菜谱（用于选菜、模板编辑等）。

**input**
```json
{
  "category": "主食",
  "page": 1,
  "pageSize": 20
}
```
- `category`、`page`、`pageSize` 均可选。

**output**
```json
{
  "success": true,
  "list": [
    {
      "_id": "recipe_001",
      "openid": "system",
      "name": "南瓜粥",
      "ingredients": [{ "name": "南瓜", "amount": "50g" }],
      "category": "主食",
      "steps": []
    }
  ],
  "total": 10
}
```

**collections touched**  
- **读**：recipes（openid 为 system 或当前用户）

**error cases**  
- 无。

---

## 统一错误响应格式

所有云函数在业务错误时建议统一返回：

```json
{
  "success": false,
  "code": "EMPTY_DAYS",
  "message": "存在未分配模板的日期，请分配或开启自动填充"
}
```

---

## 云函数与集合读写总览

| 云函数 | 读集合 | 写集合 |
|--------|--------|--------|
| initUser | users | users |
| getHomeData | week_plans, week_settings | - |
| generateNextWeek | week_settings, templates, recipes, preferences | week_settings, week_plans, shopping_list |
| getWeekData | week_settings, week_plans, templates | - |
| updateWeekSettings | week_settings, week_plans, templates | week_settings, week_plans |
| updateTemplate | templates, week_plans, week_settings | templates, week_plans |
| updateDayOverride | week_plans | week_plans |
| buildShoppingList | week_plans, recipes | shopping_list |
| toggleShoppingItem | shopping_list | shopping_list |
| logMealDone | - | meal_logs |
| markReaction | meal_logs | meal_logs |
| createRecipe | - | recipes |
| updateRecipe | recipes | recipes |
| deleteRecipe | recipes | recipes |
| listMyRecipes | recipes | - |

文档结束。

---

## 13. 今日辅食页面契约（TodayFood）

> 本章节用于前端页面 `pages/todayFood/todayFood` 的接口约束说明。优先复用既有云函数，减少新增接口成本。

### 13.1 页面初始化与刷新

**接口**：`getHomeData`  
**入参**
```json
{
  "today": "2025-03-03"
}
```
**前端使用字段**
- `todayMeals`：今日餐次列表（mealKey, recipeId, recipeName, blw）
- `thisWeekStartDate`：跳转单日精细编辑时使用
- `babyBirthday`：透传给周计划页（可选）

**联动规则**
- `onLoad` 首次调用；
- `onShow` 返回页面后再次调用，保证与单日编辑页/周计划页数据一致。

### 13.2 标记已做

**接口**：`logMealDone`  
**入参**
```json
{
  "date": "2025-03-03",
  "mealKey": "lunch",
  "recipeId": "recipe_001",
  "recipeName": "南瓜鸡肉粥"
}
```
**行为**
- 成功：toast `已记下这餐啦`
- 失败：toast `记录失败，请稍后再试`

### 13.3 进入单日精细编辑

**页面跳转**：`/pages/templateEdit/templateEdit?mode=day&dayId={today}&weekStartDate={thisWeekStartDate}`  
**保存接口（由单日编辑页调用）**：`updateDayPlan`

**约束**
- 只允许修改当天 `dayId`；
- 保存后返回今日页，由 `onShow` 触发 `getHomeData` 刷新，不直接在今日页本地拼装餐次状态。
