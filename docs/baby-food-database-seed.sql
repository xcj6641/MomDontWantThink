-- ============================================================
-- 宝宝辅食小程序 测试数据（MVP 验证）
-- 执行顺序：先执行 baby-food-database-schema.sql
-- ============================================================

SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- 1. 预处理类型定义
-- ------------------------------------------------------------
INSERT INTO prep_type_definitions (phase, code, label, action_text, storage, is_default, sort_order) VALUES
('weekend', 'none', '无需周末备菜', NULL, NULL, 1, 0),
('weekend', 'shopping_only', '仅采购', '周末采购即可', '常温/冷藏', 0, 1),
('weekend', 'refrigerated_cut', '切好冷藏', '洗净切好密封冷藏', '冷藏 1–2 天', 0, 2),
('weekend', 'frozen_chopped', '切块冷冻', '切块分装冷冻', '冷冻', 0, 3),
('weekend', 'frozen_puree', '打成泥冷冻', '蒸熟打泥分格冷冻', '冷冻', 0, 4),
('weekend', 'frozen_minced', '剁碎冷冻', '剁碎分装冷冻', '冷冻', 0, 5),
('daily', 'none', '无需提前处理', NULL, NULL, 1, 0),
('daily', 'thaw', '解冻', '前一晚放入冷藏解冻', NULL, 0, 1),
('daily', 'blanch_chop_refrigerate', '焯熟剁碎冷藏', '焯水后剁碎密封冷藏', '冷藏', 0, 2),
('daily', 'cook_refrigerate', '煮熟冷藏', '提前煮熟密封冷藏', '冷藏', 0, 3),
('daily', 'porridge_night_before', '提前煮粥', '前一晚煮好保温/冷藏', NULL, 0, 4),
('daily', 'porridge_timer', '预约煮粥', '预约第二天早上煮好', NULL, 0, 5);

-- ------------------------------------------------------------
-- 2. 食材（5 个：菜谱1 用大米/胡萝卜/鸡胸肉，菜谱2 用西兰花/土豆；单位统一便于汇总）
-- ------------------------------------------------------------
INSERT INTO ingredients (name, category, default_unit, is_active) VALUES
('大米', 'grain', 'g', 1),
('胡萝卜', 'vegetable', 'g', 1),
('鸡胸肉', 'meat', 'g', 1),
('西兰花', 'vegetable', 'g', 1),
('土豆', 'vegetable', 'g', 1);

-- ------------------------------------------------------------
-- 3. 菜谱（至少 2 个）
-- ------------------------------------------------------------
-- stage 与月龄一致：stage 1=4-5月 2=6-7月 3=8-9月 4=10-11月 5=12-14月 6=15-18月
INSERT INTO recipes (name, stage, age_month_min, age_month_max, type, texture, description, is_active) VALUES
('胡萝卜鸡肉粥', 2, 6, 7, 'porridge', 'porridge', '适合 6–7 月龄的软烂粥品', 1),
('西兰花土豆泥', 1, 4, 5, 'puree', 'puree', '适合 4–5 月龄的细腻菜泥', 1);

-- ------------------------------------------------------------
-- 4. 菜谱步骤
-- ------------------------------------------------------------
INSERT INTO recipe_steps (recipe_id, step_no, content) VALUES
(1, 1, '大米淘净，加约 6 倍水浸泡 30 分钟。'),
(1, 2, '胡萝卜去皮切小丁，鸡胸肉剁成泥。'),
(1, 3, '将米、胡萝卜丁、鸡肉泥一起放入锅中，大火煮开后转小火熬至软烂。'),
(2, 1, '西兰花取花朵部分，土豆去皮切块。'),
(2, 2, '上锅蒸约 15 分钟至软烂。'),
(2, 3, '放入料理机打成细腻泥状，可加少量温水调节稠度。');

-- ------------------------------------------------------------
-- 5. 菜谱-食材关联（胡萝卜/西兰花/土豆均为 frozen_puree+thaw，便于周末备菜汇总）
-- ------------------------------------------------------------
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount_value, amount_text, unit, ingredient_role, weekend_prep_type, daily_prep_type, sort_order) VALUES
(1, 1, 30.00, NULL, 'g', 'base', 'none', 'porridge_night_before', 1),
(1, 2, 20.00, NULL, 'g', 'vegetable', 'frozen_puree', 'thaw', 2),
(1, 3, 25.00, NULL, 'g', 'protein', 'frozen_minced', 'thaw', 3),
(2, 4, 20.00, NULL, 'g', 'vegetable', 'frozen_puree', 'thaw', 1),
(2, 5, 50.00, NULL, 'g', 'vegetable', 'frozen_puree', 'thaw', 2);

-- ------------------------------------------------------------
-- 6. 菜单计划 + 明细（示例：某用户某一周）
-- ------------------------------------------------------------
INSERT INTO menu_plans (user_id, week_start_date) VALUES
('test_openid_001', '2025-03-03');

INSERT INTO menu_plan_items (plan_id, date, meal_type, recipe_id, status) VALUES
(1, '2025-03-03', 'lunch', 1, 'planned'),
(1, '2025-03-03', 'dinner', 2, 'planned'),
(1, '2025-03-04', 'lunch', 1, 'planned');
