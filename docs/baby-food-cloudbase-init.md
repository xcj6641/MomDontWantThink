# 宝宝辅食 MVP 数据初始化与联调说明（腾讯云开发 CloudBase）

微信云开发 CloudBase 提供两种数据库方式：

- **文档型**（本文）：使用 `cloud.database()` 的集合，通过 `bf_*` 集合 + 云函数插入与查询，适合快速联调。
- **MySQL 型**（基于 MySQL 8.0）：在 CloudBase 控制台安装 MySQL 扩展或使用云托管 MySQL 后，可直接执行项目中的 `baby-food-database-schema.sql` 与 `baby-food-database-seed.sql`，云函数用 `mysql2` 连接后执行 SQL、返回与 mock 一致的结构。详见 **`baby-food-cloudbase-mysql.md`**。

若你使用**独立腾讯云 MySQL（TencentDB）**（非 CloudBase 内的 MySQL），请执行上述两个 SQL 文件并参考 `run-mysql-tencent.md`。宝宝辅食「菜谱详情 / 周末备菜 / 前一天提醒」三个页面使用独立集合（`bf_*`），与现有周计划、模板等集合互不覆盖。数据与 `baby-food-database-seed.sql`、`baby-food-mock-api.json`、`baby-food-database-query-results.md` 一致。

---

## 1. 集合一览（自动创建）

首次插入时 CloudBase 会自动创建以下集合，无需在控制台预先建表：

| 集合名 | 说明 | 测试数据量 |
|--------|------|------------|
| bf_prep_definitions | 预处理类型定义（周末/每日） | 12 条 |
| bf_ingredients | 食材 | 5 条 |
| bf_recipes | 菜谱 | 2 条 |
| bf_recipe_steps | 菜谱步骤 | 6 条 |
| bf_recipe_ingredients | 菜谱-食材关联 | 5 条 |
| bf_menu_plans | 菜单计划（周） | 1 条 |
| bf_menu_plan_items | 计划明细（某天某餐某菜） | 3 条 |

字段命名均为 **camelCase**（如 `weekStartDate`、`amountValue`），与 mock JSON 一致。

---

## 2. 插入最小测试集（执行一次）

### 方式一：云函数调用（推荐）

1. **部署云函数**  
   在微信开发者工具或 CloudBase 控制台中，对以下云函数右键「上传并部署：云端安装依赖」：
   - `seedBabyFoodMvp`

2. **执行一次**  
   - 开发者工具：云开发 → 云函数 → `seedBabyFoodMvp` → 测试，传入 `{}`。  
   - 或在小程序代码中调用：
     ```js
     wx.cloud.callFunction({ name: 'seedBabyFoodMvp', data: {} })
       .then(res => console.log(res.result))  // { success: true, seeded: true, counts: {...} }
       .catch(err => console.error(err));
     ```

3. **防重复**  
   若 `bf_recipes` 中已有数据，再次调用不会重复插入，返回 `seeded: false`。需要清空后重插时，在控制台删空上述 7 个集合，再传入 `{ force: true }` 调用（注意：当前实现未做清空，需手动在控制台删除文档后再执行一次）。

### 方式二：控制台导入（可选）

若希望用 JSON 导入，可在 CloudBase 控制台「数据库」中新建上述 7 个集合，再按云函数 `seedBabyFoodMvp/index.js` 中的常量结构整理为文档后逐条或批量导入。通常推荐直接使用云函数执行一次即可。

---

## 3. 验证方法

### 3.1 控制台查看

1. 打开 [CloudBase 控制台](https://console.cloud.tencent.com/tcb) → 当前环境 → 数据库。  
2. 确认存在 7 个 `bf_*` 集合，且文档数量与上表一致。  
3. 抽查：`bf_recipes` 中有 `_id: "recipe_1"`（胡萝卜鸡肉粥）、`recipe_2`（西兰花土豆泥）；`bf_menu_plan_items` 中有 3 条，含 `date: "2025-03-04"`, `mealType: "lunch"`, `recipeId: "recipe_1"`。

### 3.2 云函数返回校验（三页联调）

部署并调用以下三个云函数，与 mock 结构对比即可验证数据与接口一致：

| 页面 | 云函数 | 入参 | 校验要点 |
|------|--------|------|----------|
| **菜谱详情页** | getBabyFoodRecipeDetail | `{ recipeId: "recipe_1" }` | `data.basic.name` 为「胡萝卜鸡肉粥」，`data.steps` 3 条，`data.ingredients` 3 条（大米/胡萝卜/鸡胸肉），`data.prepSummary.weekend` / `dayBefore` 非空 |
| **周末备菜页** | getBabyFoodWeekendPrep | `{ planId: "plan_1" }` | `data.groupByPrepType` 含「打成泥冷冻」「剁碎冷冻」两组；胡萝卜 40g、鸡胸肉 50g、西兰花 20g、土豆 50g，且含 `amountDisplay`、`planItemCount` |
| **前一天提醒页** | getBabyFoodDayBeforeReminder | `{ planId: "plan_1", date: "2025-03-04", mealType: "lunch" }` | `data.recipeName` 为「胡萝卜鸡肉粥」，`data.items` 3 条（大米 30g 提前煮粥，胡萝卜 20g、鸡胸肉 25g 解冻），`data.userFriendlyCopy.grouped` 按「提前煮粥」「解冻」分组 |

小程序内调用示例：

```js
// 菜谱详情
wx.cloud.callFunction({ name: 'getBabyFoodRecipeDetail', data: { recipeId: 'recipe_1' } })
  .then(res => { const d = res.result.data; /* 渲染 d.basic, d.steps, d.ingredients, d.prepSummary */ });

// 周末备菜
wx.cloud.callFunction({ name: 'getBabyFoodWeekendPrep', data: { planId: 'plan_1' } })
  .then(res => { const d = res.result.data; /* 渲染 d.groupByPrepType */ });

// 前一天提醒
wx.cloud.callFunction({ name: 'getBabyFoodDayBeforeReminder', data: { planId: 'plan_1', date: '2025-03-04', mealType: 'lunch' } })
  .then(res => { const d = res.result.data; /* 渲染 d.items 或 d.userFriendlyCopy.grouped */ });
```

---

## 4. 三页联调对接方式

- **菜谱详情页**：调用 `getBabyFoodRecipeDetail`，入参 `recipeId`（如从列表点进传 `recipe_1`）。返回结构与 `baby-food-mock-api.json` 的 `recipeDetail` 一致（含 `basic`、`steps`、`ingredients`、`prepSummary`）。  
- **周末备菜页**：调用 `getBabyFoodWeekendPrep`，入参 `planId`（当前测试为 `plan_1`）。返回结构与 mock 的 `weekendPrep` 一致（`groupByPrepType` 按处理方式分组，每项含 `amountDisplay`、`distinctRecipeCount`、`planItemCount`）。  
- **前一天提醒页**：调用 `getBabyFoodDayBeforeReminder`，入参 `planId`、`date`、`mealType`。返回结构与 mock 的 `dayBeforeReminder` 一致（含 `items`、`userFriendlyCopy.short` / `list` / `grouped`）。

前端可先接 mock JSON 开发，再改为上述 `wx.cloud.callFunction`，无需改页面数据结构。

---

## 5. SQL seed 与 CloudBase 的对应关系

| SQL 表 | CloudBase 集合 | 说明 |
|--------|----------------|------|
| prep_type_definitions | bf_prep_definitions | 主键 (phase, code) → _id 如 "weekend_none" |
| ingredients | bf_ingredients | _id: ingredient_1～5 |
| recipes | bf_recipes | _id: recipe_1, recipe_2 |
| recipe_steps | bf_recipe_steps | 无 _id，由 CloudBase 自动生成；recipeId 关联 recipe |
| recipe_ingredients | bf_recipe_ingredients | recipeId + ingredientId 关联 |
| menu_plans | bf_menu_plans | _id: plan_1 |
| menu_plan_items | bf_menu_plan_items | planId, recipeId 为字符串引用 |

当前仅插入最小测试集（2 个菜谱、5 个食材、1 个计划与 3 条计划项），不导入大量菜谱。
