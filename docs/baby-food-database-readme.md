# 宝宝辅食小程序 数据库结构说明（MVP）

产品覆盖 **4–18 个月**宝宝辅食，支持菜谱、食材、周末备菜、前一天提醒及一周菜单。

## 文件说明

| 文件 | 说明 |
|------|------|
| `baby-food-database-schema.sql` | 建表 DDL：7 张表、外键、索引 |
| `baby-food-database-seed.sql` | 预处理类型枚举 + 测试数据（2 菜谱、5 食材） |
| `baby-food-database-queries.sql` | 示例查询：菜谱详情、周末备菜、每日提醒 |

执行顺序：**schema → seed → queries**（queries 仅作验证，可按需执行）。

## 表结构一览

| 表名 | 说明 |
|------|------|
| `prep_type_definitions` | 预处理类型定义（周末/每日），主键 (phase, code)，含 sort_order 排序 |
| `ingredients` | 食材 |
| `recipes` | 菜谱 |
| `recipe_steps` | 菜谱步骤 |
| `recipe_ingredients` | 菜谱-食材关联（amount_value/amount_text+unit、角色、周末/每日预处理类型） |
| `menu_plans` | 菜单计划主表（按用户、周） |
| `menu_plan_items` | 计划明细：某天某餐某菜 |

## 外键关系

- `recipe_steps.recipe_id` → `recipes.id`（CASCADE）
- `recipe_ingredients.recipe_id` → `recipes.id`（CASCADE）
- `recipe_ingredients.ingredient_id` → `ingredients.id`（RESTRICT）
- `menu_plan_items.plan_id` → `menu_plans.id`（CASCADE）
- `menu_plan_items.recipe_id` → `recipes.id`（RESTRICT）

`recipe_ingredients.weekend_prep_type` / `daily_prep_type` 与 `prep_type_definitions` 的 (phase, code) 逻辑对应，未建外键以便枚举扩展。

## 唯一约束

- `recipe_ingredients`：`uk_recipe_ingredient (recipe_id, ingredient_id)`，同一菜谱不重复关联同一食材。
- `menu_plan_items`：`uk_plan_date_meal (plan_id, date, meal_type)`，同一计划同一天同一餐仅一条记录。

## 校验约束与应用层建议

- **SQL CHECK（MySQL 8.0.16+）**：`recipes.age_month_min <= age_month_max`；`recipe_steps.step_no >= 1`。
- **应用层校验**：
  - **stage 与月龄一致**：stage 1→4–5 月、2→6–7 月、3→8–9 月、4→10–11 月、5→12–14 月、6→15–18 月；写入/更新 recipes 时校验 (age_month_min, age_month_max) 落在对应 stage 区间。
  - **recipe_steps.step_no**：同一 recipe 内从 1 开始连续递增（1,2,3,…）；删除步骤时重排序号。

## 固定枚举值

### stage（月龄阶段）

| 值 | 说明 |
|----|------|
| 1 | 4-5 个月 |
| 2 | 6-7 个月 |
| 3 | 8-9 个月 |
| 4 | 10-11 个月 |
| 5 | 12-14 个月 |
| 6 | 15-18 个月 |

### type（菜谱类型）

`puree` | `porridge` | `noodles` | `rice` | `finger_food`

### texture（性状）

`puree` | `mashed` | `porridge` | `soft_chunks` | `finger_food`

### ingredients.category（食材分类）

`grain` | `vegetable` | `leafy_vegetable` | `fruit` | `meat` | `fish` | `egg` | `tofu` | `other`

### ingredient_role（recipe_ingredients 中，食材角色）

`base` | `protein` | `vegetable` | `fruit` | `grain` | `other`

### weekend_prep_type（周末备菜）

`none` | `frozen_minced` | `frozen_puree` | `frozen_chopped` | `refrigerated_cut` | `shopping_only`

### daily_prep_type（前一天/当日预处理）

`none` | `thaw` | `blanch_chop_refrigerate` | `cook_refrigerate` | `porridge_night_before` | `porridge_timer`

## 后续扩展

- 根据 `menu_plan_items` 聚合生成购物清单、周末备菜列表、每日提醒（见示例查询）。
- 营养计算、过敏原等可在现有表上增加字段或新表，不影响本 MVP 结构。
