# 宝宝辅食 MVP 使用 CloudBase MySQL（SQL 型）接入说明

微信云开发 CloudBase 提供**基于 MySQL 8.0 的云数据库**（通过 [MySQL 扩展](https://docs.cloudbase.net/extension/mysql) 或云托管 MySQL 使用）。若你使用该 SQL 型数据库，可以直接用项目里已有的 **MySQL 建表与种子数据**，无需再维护文档型 `bf_*` 集合。

---

## 1. CloudBase 里的两种数据库

| 类型 | 说明 | 本项目宝宝辅食 MVP 用法 |
|------|------|--------------------------|
| **文档型** | `cloud.database()`，集合/文档，MongoDB 风格 | 使用 `bf_*` 集合 + 云函数 `seedBabyFoodMvp`、`getBabyFoodRecipeDetail` 等（见 `baby-food-cloudbase-init.md`） |
| **MySQL 型** | 控制台安装 MySQL 扩展或使用云托管 MySQL，基于 MySQL 8.0 | 执行 `baby-food-database-schema.sql` + `baby-food-database-seed.sql`，云函数用 `mysql2`/`serverless-mysql` 连接后执行 SQL 查询，返回与 mock 一致的结构 |

选用 **MySQL 型** 时，数据模型、索引、校验与现有 SQL 设计完全一致，便于后续做汇总、统计和复杂查询。

---

## 2. 使用 CloudBase MySQL 的步骤概览

1. **开通 / 创建 MySQL 实例**  
   在 [CloudBase 控制台](https://console.cloud.tencent.com/tcb/extensions) 安装「MySQL」扩展（当前支持地域以控制台为准），或使用云托管提供的 MySQL。创建后记下：**主机、端口、数据库名、用户名、密码**。

2. **执行建表与种子数据（只做一次）**  
   - 在控制台提供的「数据库管理」或 DMC 等工具中连接该 MySQL，或在本机用 `mysql` 客户端连接（若已开放公网或你在同 VPC）。  
   - 建库（若尚未有）：  
     `CREATE DATABASE IF NOT EXISTS baby_food_verify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`  
   - 按顺序执行项目中的 SQL：  
     - `docs/baby-food-database-schema.sql`  
     - `docs/baby-food-database-seed.sql`  
   - 不导入大量菜谱，仅保留当前 seed 中的最小测试集即可。

3. **云函数连接 MySQL 并对外提供接口**  
   - 在云函数中通过**环境变量**配置连接信息（如 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`），使用 `mysql2` 或 `serverless-mysql` 连接。  
   - 将 `docs/baby-food-database-queries.sql` 中的三类查询（菜谱详情、周末备菜汇总、前一天提醒）拆成三个云函数，在云函数内执行对应 SQL，把查询结果组装成与 `docs/baby-food-mock-api.json` 一致的结构返回给小程序。

4. **三页联调**  
   - 菜谱详情页：调用「菜谱详情」云函数，传入 `recipeId`（对应主键或业务 ID）。  
   - 周末备菜页：调用「周末备菜」云函数，传入 `planId`。  
   - 前一天提醒页：调用「前一天提醒」云函数，传入 `planId`、`date`、`mealType`。  
   - 前端可直接复用 mock 的数据结构，仅把数据源从本地 mock 改为云函数返回。

---

## 3. 云函数连接 MySQL 的注意点（官方建议）

- 每个云函数实例会单独建一条 MySQL 连接，**连接数 ≈ 云函数实例数**。建议把访问同一 MySQL 的读写尽量集中到少量云函数（例如本 MVP 的三个接口可以合并到一个云函数内按 `type` 分发，或保持三个云函数但注意总并发）。  
- 在 CloudBase 控制台为云函数配置**环境变量**存放数据库连接信息，不要写死在代码里。  
- 若 MySQL 与云函数在同一 VPC，使用内网地址可降低延迟并提高安全性。

---

## 4. 与现有文档的对应关系

- **建表与种子**：与 `baby-food-database-schema.sql`、`baby-food-database-seed.sql` 完全一致，执行后数据与 `baby-food-database-query-results.md` 预期一致。  
- **查询逻辑**：与 `baby-food-database-queries.sql` 中的分步查询、周末备菜汇总、前一天提醒一致。  
- **返回结构**：与 `baby-food-mock-api.json` 中 `recipeDetail`、`weekendPrep`、`dayBeforeReminder` 一致，便于三页联调。

若你确定使用 **CloudBase MySQL**，可以只保留「SQL 建表 + seed + 云函数查 MySQL」这一条链路，不再使用文档型的 `bf_*` 集合与 `seedBabyFoodMvp`；若暂时只用文档型，则继续按 `baby-food-cloudbase-init.md` 使用 `bf_*` 与现有云函数即可。
