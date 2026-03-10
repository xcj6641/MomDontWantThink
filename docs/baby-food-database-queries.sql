-- ============================================================
-- 宝宝辅食小程序 示例查询（验证结构）
-- 执行顺序：先执行 schema → seed，再执行本文件中的查询
-- ============================================================

-- ------------------------------------------------------------
-- 1. 菜谱详情（推荐分步查询，避免步骤×食材的笛卡尔积）
-- ------------------------------------------------------------
-- 1.1 基本信息
SELECT id, name, stage, age_month_min, age_month_max, type, texture, description
FROM recipes WHERE id = 1 AND is_active = 1;

-- 1.2 步骤（按序号）
SELECT step_no, content FROM recipe_steps WHERE recipe_id = 1 ORDER BY step_no;

-- 1.3 食材（含用量与预处理类型）
SELECT i.name, ri.amount_value, ri.amount_text, ri.unit,
       COALESCE(ri.amount_text, CONCAT(IFNULL(ri.amount_value, ''), ri.unit)) AS amount_display,
       ri.ingredient_role, ri.weekend_prep_type, ri.daily_prep_type
FROM recipe_ingredients ri
JOIN ingredients i ON i.id = ri.ingredient_id
WHERE ri.recipe_id = 1 AND i.is_active = 1
ORDER BY ri.sort_order;


-- ------------------------------------------------------------
-- 2. 根据一周菜单汇总周末备菜任务
-- ------------------------------------------------------------
-- 2.1 明细版：按预处理类型列出本周需周末处理的食材及对应菜谱
SELECT
  pt.code AS weekend_prep_code,
  pt.label AS weekend_prep_label,
  pt.action_text,
  pt.storage,
  i.name AS ingredient_name,
  ri.amount_value,
  ri.amount_text,
  ri.unit,
  r.name AS recipe_name
FROM menu_plan_items mpi
JOIN recipes r ON r.id = mpi.recipe_id AND r.is_active = 1
JOIN recipe_ingredients ri ON ri.recipe_id = r.id
JOIN ingredients i ON i.id = ri.ingredient_id AND i.is_active = 1
LEFT JOIN prep_type_definitions pt ON pt.phase = 'weekend' AND pt.code = ri.weekend_prep_type
WHERE mpi.plan_id = 1
  AND mpi.status = 'planned'
  AND ri.weekend_prep_type != 'none'
ORDER BY pt.sort_order, ri.weekend_prep_type, i.category, i.name;

-- 2.2 真正汇总版：按 ingredient_id + weekend_prep_type + unit 分组，对 amount_value 求和，用于生成周末备菜清单
SELECT
  i.id AS ingredient_id,
  i.name AS ingredient_name,
  i.category,
  ri.weekend_prep_type,
  pt.label AS weekend_prep_label,
  pt.action_text,
  pt.storage,
  ri.unit,
  SUM(ri.amount_value) AS total_amount_value,
  COUNT(DISTINCT mpi.recipe_id) AS recipe_count
FROM menu_plan_items mpi
JOIN recipes r ON r.id = mpi.recipe_id AND r.is_active = 1
JOIN recipe_ingredients ri ON ri.recipe_id = r.id
JOIN ingredients i ON i.id = ri.ingredient_id AND i.is_active = 1
LEFT JOIN prep_type_definitions pt ON pt.phase = 'weekend' AND pt.code = ri.weekend_prep_type
WHERE mpi.plan_id = 1
  AND mpi.status = 'planned'
  AND ri.weekend_prep_type != 'none'
GROUP BY i.id, i.name, i.category, ri.weekend_prep_type, ri.unit, pt.label, pt.action_text, pt.storage, pt.sort_order
ORDER BY pt.sort_order, i.category, i.name;


-- ------------------------------------------------------------
-- 3. 根据某一天某一餐生成前一天提醒
-- ------------------------------------------------------------
-- 指定日期与餐次，查出该餐菜谱下需“前一天/当日”预处理的食材及操作提示；含 amount_display 便于前端展示
SELECT
  mpi.date,
  mpi.meal_type,
  r.name AS recipe_name,
  i.name AS ingredient_name,
  ri.amount_value,
  ri.amount_text,
  ri.unit,
  COALESCE(ri.amount_text, CONCAT(IFNULL(ri.amount_value, ''), ri.unit)) AS amount_display,
  ri.daily_prep_type,
  pt.label AS daily_prep_label,
  pt.action_text AS daily_action_text
FROM menu_plan_items mpi
JOIN recipes r ON r.id = mpi.recipe_id AND r.is_active = 1
JOIN recipe_ingredients ri ON ri.recipe_id = r.id
JOIN ingredients i ON i.id = ri.ingredient_id AND i.is_active = 1
LEFT JOIN prep_type_definitions pt ON pt.phase = 'daily' AND pt.code = ri.daily_prep_type
WHERE mpi.plan_id = 1
  AND mpi.date = '2025-03-04'
  AND mpi.meal_type = 'lunch'
  AND mpi.status = 'planned'
  AND ri.daily_prep_type != 'none'
ORDER BY pt.sort_order, r.name;
