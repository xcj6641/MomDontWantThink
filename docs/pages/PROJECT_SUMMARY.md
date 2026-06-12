# 妈妈不想想 — 页面总览

本文档汇总全部 9 个页面的基本信息、实现状态与设计文档索引。

---

## 页面索引

| # | 英文名 | 中文名 | 代码路径 | 设计文档 | UI 状态 | 云函数状态 |
|---|--------|--------|----------|----------|---------|-----------|
| 1 | Onboarding Page | 初始信息页 | `pages/todayFood`（onboarding 分支） | — | ✅ 已实现 | ✅ `initUser` / `savePreferences` |
| 2 | Weekly Plan Generator | 周计划生成页 | `pages/nextWeek` + `pages/week` | `WeekPlanGenerator.md` | ✅ 已实现 | ✅ `generateNextWeek` / `confirmWeek` |
| 3 | Edit Daily Plan | 编辑日计划 | `pages/dayEdit` | — | ✅ 已实现 | ✅ `updateDayOverride` |
| 4 | Add Recipe | 添加菜谱 | `pages/recipeEdit` | — | ✅ 已实现 | 🔜 待对接 |
| 5 | Edit Meal Prep Plan | 备餐计划编辑 | `pages/prepEdit` | `备餐模板卡片页.md` | ✅ 已实现 | 🔜 待对接 |
| 6 | Recipe Details | 菜谱详情 | `pages/recipeDetail` | `菜品详情页.md` | ✅ 已实现 | ✅ `getRecipeDetail` |
| 7 | Today's Meals | 今日辅食 | `pages/todayFood` | `今日辅食常规页面设计.md` | ✅ 已实现 | ✅ `getHomeData` |
| 8 | Weekly Plan Summary | 本周备餐计划 | `pages/weekSummary` | `WeekPlan.md` | ✅ 已实现 | 🔜 `buildShoppingList` 待启用 |
| 9 | Baby Profile | 我的 | `pages/me` + `pages/profile` | `BabyProfile.md` | ✅ 已实现 | ✅ `getPreferences` / `savePreferences` |

---

## 各页面详情

---

### 1. Onboarding Page — 初始信息页

- **入口**：首次启动 / `todayFood` 页无宝宝信息时
- **代码路径**：`pages/todayFood`（`showDebugInitialPage` 分支）
- **核心功能**：填写宝宝生日、过敏食材 → 生成本周辅食计划
- **设计文档**：见 `docs/初始信息页设计风格规范.md`
- **关联云函数**：`initUser`、`savePreferences`、`generateNextWeek`

---

### 2. Weekly Plan Generator — 周计划生成页

- **入口**：`todayFood` 宝宝栏「生成本周计划」/ 「生成下周计划」
- **代码路径**：`pages/nextWeek`（生成流程）；`pages/week`（计划展示与设置）
- **核心功能**：选模板、配置每日餐次分配、生成并确认周计划
- **设计文档**：`docs/pages/周计划页-异常页面设计.md`（异常/生成前状态）
- **关联云函数**：`generateNextWeek`、`confirmWeek`、`getWeekData`

---

### 3. Edit Daily Plan — 编辑日计划

- **入口**：`todayFood` 页「调整今日」/ `week` 页单日卡片
- **代码路径**：`pages/dayEdit`
- **核心功能**：调整某一天的餐次菜品，支持替换、删除、标记 BLW
- **设计文档**：暂无独立文档
- **关联云函数**：`updateDayOverride`

---

### 4. Add Recipe — 添加菜谱

- **入口**：`pages/recipes` 列表页「添加」按钮
- **代码路径**：`pages/recipeEdit`
- **核心功能**：填写菜名、月龄段、食材、做法、标签等信息并保存
- **设计文档**：暂无独立文档
- **关联云函数**：🔜 待对接保存菜谱接口

---

### 5. Edit Meal Prep Plan — 备餐计划编辑

- **入口**：`pages/weekSummary` / `pages/week` 备餐模板区域
- **代码路径**：`pages/prepEdit`
- **核心功能**：编辑备餐轮次、调整食材与准备步骤
- **设计文档**：`docs/pages/备餐模板卡片页.md`
- **关联云函数**：🔜 待对接

---

### 6. Recipe Details — 菜谱详情

- **入口**：今日辅食餐次列表点击菜名 / 菜谱列表点击
- **代码路径**：`pages/recipeDetail`
- **核心功能**：展示菜谱完整信息（食材、做法、提前准备）；支持收藏、喜欢/不喜欢、换一个
- **设计文档**：`docs/pages/菜品详情页.md`
- **关联云函数**：`getRecipeDetail`（或等价接口）

---

### 7. Today's Meals — 今日辅食

- **入口**：底部 Tab 栏「辅食」（有周计划时默认进入）
- **代码路径**：`pages/todayFood`（`showMainPage` 分支）
- **核心功能**：查看今日餐次菜品、勾选完成、查看明日备菜提醒、跳转周计划
- **设计文档**：`docs/pages/今日辅食常规页面设计.md`
- **关联云函数**：`getHomeData`

---

### 8. Weekly Plan Summary — 本周备餐计划

- **入口**：`todayFood` 宝宝栏「本周计划 >」/ 「查看下周计划」
- **代码路径**：`pages/weekSummary`
- **核心功能**：查看并勾选本周食材清单、提前准备事项；折叠查看备餐轮次详情
- **设计文档**：`docs/pages/WeekPlan.md`
- **关联云函数**：`buildShoppingList`（待启用）、`toggleShoppingItem`（待启用）、`getWeekData`

---

### 9. Baby Profile — 我的

- **入口**：底部 Tab 栏「我的」
- **代码路径**：`pages/me`（主页）+ `pages/profile`（编辑表单）
- **核心功能**：
  - 宝宝信息卡（月龄、餐次、过敏）
  - 宝宝卡片：进食记录、过敏信息
  - 我的内容：宝宝喜欢、我的菜谱、收藏菜谱、收藏周计划
  - 设置：备餐提醒、关于我们、Mock 模式
- **设计文档**：`docs/pages/BabyProfile.md` ✅ 已完成
- **关联云函数**：`getPreferences`、`savePreferences`

---

## 图标资源

| 路径 | 用途 |
|------|------|
| `assets/icons/me/` | Baby Profile 页列表彩色 line 图标（9 个 SVG） |
| `assets/icons/recipe-detail/` | 菜谱详情页操作图标（heart / star / thumb / refresh） |
| `assets/tab-*.png` | Tab Bar 图标 |
| `assets/star.png` / `star_active.png` | 收藏按钮图标 |

---

## 全局规范文档索引

| 文档 | 说明 |
|------|------|
| `docs/风格规范.md` | 全局色彩、间距、卡片系统 |
| `docs/头部信息区设计风格规范.md` | 头部信息卡 grid 布局、字体层级、对齐规范 |
| `docs/初始信息页设计风格规范.md` | Onboarding 表单、按钮样式规范 |
| `docs/cloud-database-schema.md` | 数据库 Schema |
| `docs/cloud-functions-api.md` | 云函数接口文档 |
| `CLAUDE.md` | 项目架构、开发约定、命名规范 |

---

*文档版本：2026-04*
