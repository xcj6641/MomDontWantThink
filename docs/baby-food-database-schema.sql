-- ============================================================
-- 宝宝辅食小程序 数据库结构 MVP（4–18 月龄）
-- 支持：菜谱、食材、周末备菜、前一天提醒、一周菜单与购物清单
-- ============================================================

-- 使用 UTF8
SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- 1. 预处理类型定义（周末备菜 / 每日预处理 枚举说明）
-- ------------------------------------------------------------
CREATE TABLE prep_type_definitions (
  phase VARCHAR(16) NOT NULL COMMENT 'weekend | daily',
  code VARCHAR(32) NOT NULL COMMENT '类型代码',
  label VARCHAR(64) NOT NULL COMMENT '展示名称',
  action_text VARCHAR(255) DEFAULT NULL COMMENT '操作提示文案',
  storage VARCHAR(64) DEFAULT NULL COMMENT '储存方式说明',
  is_default TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否该 phase 下默认',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '前端与查询排序',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (phase, code),
  KEY idx_phase_sort (phase, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预处理类型定义';
-- ------------------------------------------------------------
-- 2. 食材
-- ------------------------------------------------------------
CREATE TABLE ingredients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL COMMENT '食材名称',
  category VARCHAR(32) NOT NULL DEFAULT 'other' COMMENT 'grain|vegetable|leafy_vegetable|fruit|meat|fish|egg|tofu|other',
  default_unit VARCHAR(16) NOT NULL DEFAULT 'g' COMMENT '默认单位',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_name (name),
  KEY idx_category (category),
  KEY idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食材';

-- ------------------------------------------------------------
-- 3. 菜谱
-- ------------------------------------------------------------
CREATE TABLE recipes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT '菜谱名称',
  stage TINYINT UNSIGNED NOT NULL COMMENT '1=4-5月 2=6-7月 3=8-9月 4=10-11月 5=12-14月 6=15-18月',
  age_month_min TINYINT UNSIGNED NOT NULL COMMENT '适用月龄下限',
  age_month_max TINYINT UNSIGNED NOT NULL COMMENT '适用月龄上限',
  type VARCHAR(32) NOT NULL DEFAULT 'porridge' COMMENT 'puree|porridge|noodles|rice|finger_food',
  texture VARCHAR(32) NOT NULL DEFAULT 'porridge' COMMENT 'puree|mashed|porridge|soft_chunks|finger_food',
  description TEXT DEFAULT NULL COMMENT '简介',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_stage (stage),
  KEY idx_age (age_month_min, age_month_max),
  KEY idx_type (type),
  KEY idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜谱';

-- ------------------------------------------------------------
-- 4. 菜谱步骤
-- ------------------------------------------------------------
CREATE TABLE recipe_steps (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT UNSIGNED NOT NULL,
  step_no SMALLINT UNSIGNED NOT NULL COMMENT '步骤序号',
  content TEXT NOT NULL COMMENT '步骤内容',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rs_recipe FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
  UNIQUE KEY uk_recipe_step (recipe_id, step_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜谱步骤';

-- ------------------------------------------------------------
-- 5. 菜谱-食材关联（含用量、周末/每日预处理类型）
-- ------------------------------------------------------------
CREATE TABLE recipe_ingredients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT UNSIGNED NOT NULL,
  ingredient_id INT UNSIGNED NOT NULL,
  amount_value DECIMAL(10,2) NULL COMMENT '用量数值，便于汇总购物清单',
  amount_text VARCHAR(32) NULL COMMENT '用量文本，如适量、半根',
  unit VARCHAR(16) NOT NULL DEFAULT 'g' COMMENT '单位',
  ingredient_role VARCHAR(32) NOT NULL DEFAULT 'other' COMMENT 'base|protein|vegetable|fruit|grain|other',
  weekend_prep_type VARCHAR(32) NOT NULL DEFAULT 'none' COMMENT '周末备菜类型',
  daily_prep_type VARCHAR(32) NOT NULL DEFAULT 'none' COMMENT '前一天/当日预处理类型',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ri_recipe FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
  CONSTRAINT fk_ri_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE RESTRICT,
  UNIQUE KEY uk_recipe_ingredient (recipe_id, ingredient_id),
  KEY idx_recipe (recipe_id),
  KEY idx_ingredient (ingredient_id),
  KEY idx_weekend_prep (weekend_prep_type),
  KEY idx_daily_prep (daily_prep_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜谱-食材';
-- ------------------------------------------------------------
-- 6. 菜单计划（周计划主表，供 menu_plan_items 引用）
-- ------------------------------------------------------------
CREATE TABLE menu_plans (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL COMMENT '用户标识，如 openid',
  week_start_date DATE NOT NULL COMMENT '周一起始日期',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_week (user_id, week_start_date),
  KEY idx_week (week_start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜单计划（周）';

-- ------------------------------------------------------------
-- 7. 菜单计划明细（某天某餐某菜）
-- ------------------------------------------------------------
CREATE TABLE menu_plan_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plan_id INT UNSIGNED NOT NULL,
  date DATE NOT NULL COMMENT '日期',
  meal_type VARCHAR(32) NOT NULL COMMENT 'breakfast|lunch|dinner|snack_am|snack_pm',
  recipe_id INT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'planned' COMMENT 'planned|done|cancelled',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_mpi_plan FOREIGN KEY (plan_id) REFERENCES menu_plans (id) ON DELETE CASCADE,
  CONSTRAINT fk_mpi_recipe FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE RESTRICT,
  UNIQUE KEY uk_plan_date_meal (plan_id, date, meal_type),
  KEY idx_plan_date (plan_id, date),
  KEY idx_recipe (recipe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜单计划明细';

-- ============================================================
-- 校验约束（MySQL 8.0.16+ 支持 CHECK）
-- ============================================================
ALTER TABLE recipes ADD CONSTRAINT chk_recipes_age_range CHECK (age_month_min <= age_month_max);
ALTER TABLE recipe_steps ADD CONSTRAINT chk_recipe_steps_step_no CHECK (step_no >= 1);

-- ============================================================
-- 枚举约束说明（应用层校验）
-- ============================================================
-- stage: 1=4-5月 2=6-7月 3=8-9月 4=10-11月 5=12-14月 6=15-18月
-- type: puree, porridge, noodles, rice, finger_food
-- texture: puree, mashed, porridge, soft_chunks, finger_food
-- ingredients.category: grain, vegetable, leafy_vegetable, fruit, meat, fish, egg, tofu, other
-- ingredient_role (recipe_ingredients): base, protein, vegetable, fruit, grain, other
-- weekend_prep_type: none, frozen_minced, frozen_puree, frozen_chopped, refrigerated_cut, shopping_only
-- daily_prep_type: none, thaw, blanch_chop_refrigerate, cook_refrigerate, porridge_night_before, porridge_timer
--
-- 应用层校验建议（无法或不宜用 CHECK 表达的规则）：
-- 1) recipes: stage 与月龄范围一致
--    stage 1 -> age_month_min=4, age_month_max=5
--    stage 2 -> 6,7 | 3 -> 8,9 | 4 -> 10,11 | 5 -> 12,14 | 6 -> 15,18
--    写入/更新时校验：(age_month_min, age_month_max) 落在对应 stage 的区间。
-- 2) recipe_steps: step_no 从 1 开始连续递增（同一 recipe_id 内 1,2,3,...）
--    写入/更新时校验：同一 recipe 下 step_no 不重复且从 1 起连续；删除步骤时重排序号。
