# 宝宝辅食库 查询验证结果（预期输出）

按当前 **schema + seed** 执行后，运行 `baby-food-database-queries.sql` 中对应查询，应得到如下结果（便于逐项核对）。

---

## 1. 菜谱详情查询结果（recipe_id = 1，胡萝卜鸡肉粥）

### 1.1 基本信息

| id | name         | stage | age_month_min | age_month_max | type     | texture  | description           |
|----|--------------|-------|---------------|---------------|----------|----------|------------------------|
| 1  | 胡萝卜鸡肉粥 | 2     | 6             | 7             | porridge | porridge | 适合 6–7 月龄的软烂粥品 |

### 1.2 步骤（按 step_no）

| step_no | content                                                                 |
|---------|-------------------------------------------------------------------------|
| 1       | 大米淘净，加约 6 倍水浸泡 30 分钟。                                      |
| 2       | 胡萝卜去皮切小丁，鸡胸肉剁成泥。                                        |
| 3       | 将米、胡萝卜丁、鸡肉泥一起放入锅中，大火煮开后转小火熬至软烂。          |

### 1.3 食材（含用量与预处理类型）

| name   | amount_value | amount_text | unit | amount_display | ingredient_role | weekend_prep_type | daily_prep_type        |
|--------|--------------|-------------|------|----------------|-----------------|-------------------|------------------------|
| 大米   | 30.00        | NULL        | g    | 30g            | base            | none              | porridge_night_before  |
| 胡萝卜 | 20.00        | NULL        | g    | 20g            | vegetable       | frozen_puree      | thaw                  |
| 鸡胸肉 | 25.00        | NULL        | g    | 25g            | protein         | frozen_minced     | thaw                  |

---

## 2. 周末备菜明细版结果（plan_id = 1）

本周计划中需周末预处理的食材（每条为「某计划项 × 某食材」一行）。  
计划含：周一午餐(菜谱1)、周一夜餐(菜谱2)、周二午餐(菜谱1)，故胡萝卜、鸡胸肉各出现 2 次。

| weekend_prep_code | weekend_prep_label | action_text         | storage | ingredient_name | amount_value | amount_text | unit | recipe_name   |
|-------------------|-------------------|---------------------|---------|-----------------|--------------|-------------|------|---------------|
| frozen_puree      | 打成泥冷冻        | 蒸熟打泥分格冷冻    | 冷冻    | 胡萝卜          | 20.00        | NULL        | g    | 胡萝卜鸡肉粥  |
| frozen_puree      | 打成泥冷冻        | 蒸熟打泥分格冷冻    | 冷冻    | 胡萝卜          | 20.00        | NULL        | g    | 胡萝卜鸡肉粥  |
| frozen_minced     | 剁碎冷冻          | 剁碎分装冷冻        | 冷冻    | 鸡胸肉          | 25.00        | NULL        | g    | 胡萝卜鸡肉粥  |
| frozen_minced     | 剁碎冷冻          | 剁碎分装冷冻        | 冷冻    | 鸡胸肉          | 25.00        | NULL        | g    | 胡萝卜鸡肉粥  |
| frozen_puree      | 打成泥冷冻        | 蒸熟打泥分格冷冻    | 冷冻    | 西兰花          | 20.00        | NULL        | g    | 西兰花土豆泥  |
| frozen_puree      | 打成泥冷冻        | 蒸熟打泥分格冷冻    | 冷冻    | 土豆            | 50.00        | NULL        | g    | 西兰花土豆泥  |

---

## 3. 周末备菜汇总版结果（plan_id = 1）

按 **ingredient_id + weekend_prep_type + unit** 分组，对 **amount_value** 求和。  
胡萝卜、鸡胸肉在本周各用 2 次，故 total 为 40、50；西兰花、土豆各用 1 次。

| ingredient_id | ingredient_name | category  | weekend_prep_type | weekend_prep_label | action_text      | storage | unit | total_amount_value | recipe_count |
|---------------|-----------------|-----------|-------------------|-------------------|------------------|---------|------|--------------------|--------------|
| 2             | 胡萝卜          | vegetable | frozen_puree      | 打成泥冷冻        | 蒸熟打泥分格冷冻 | 冷冻    | g    | 40.00              | 1            |
| 4             | 西兰花          | vegetable | frozen_puree      | 打成泥冷冻        | 蒸熟打泥分格冷冻 | 冷冻    | g    | 20.00              | 1            |
| 5             | 土豆            | vegetable | frozen_puree      | 打成泥冷冻        | 蒸熟打泥分格冷冻 | 冷冻    | g    | 50.00              | 1            |
| 3             | 鸡胸肉          | meat      | frozen_minced     | 剁碎冷冻          | 剁碎分装冷冻     | 冷冻    | g    | 50.00              | 1            |

*注：ORDER BY 为 pt.sort_order, i.category, i.name；frozen_puree(sort_order=4) 在前，frozen_minced(5) 在后，同类型内按 category、name。*

---

## 4. 某一天某一餐的前一天提醒结果（2025-03-04 午餐）

当日午餐为菜谱 1（胡萝卜鸡肉粥），需前一天/当日预处理的食材：大米（提前煮粥）、胡萝卜（解冻）、鸡胸肉（解冻）。

| date       | meal_type | recipe_name   | ingredient_name | amount_value | amount_text | unit | amount_display | daily_prep_type        | daily_prep_label | daily_action_text   |
|------------|-----------|---------------|-----------------|--------------|-------------|------|----------------|------------------------|------------------|----------------------|
| 2025-03-04 | lunch     | 胡萝卜鸡肉粥  | 大米            | 30.00         | NULL        | g    | 30g            | porridge_night_before  | 提前煮粥         | 前一晚煮好保温/冷藏  |
| 2025-03-04 | lunch     | 胡萝卜鸡肉粥  | 胡萝卜          | 20.00         | NULL        | g    | 20g            | thaw                   | 解冻             | 前一晚放入冷藏解冻   |
| 2025-03-04 | lunch     | 胡萝卜鸡肉粥  | 鸡胸肉          | 25.00         | NULL        | g    | 25g            | thaw                   | 解冻             | 前一晚放入冷藏解冻   |

---

## 本地执行方式

1. 建库并执行 schema、seed（按顺序）：
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS baby_food_verify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   mysql -u root -p baby_food_verify < baby-food-database-schema.sql
   mysql -u root -p baby_food_verify < baby-food-database-seed.sql
   ```
2. 在 MySQL 客户端或工具中打开 `baby-food-database-queries.sql`，依次执行：
   - 1.1 / 1.2 / 1.3（菜谱详情）
   - 2.1（周末备菜明细）
   - 2.2（周末备菜汇总）
   - 3（前一天提醒）
3. 将实际结果与上表对照，确认一致即可认为验证通过。
