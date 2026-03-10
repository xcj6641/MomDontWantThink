# 使用腾讯云 MySQL 执行宝宝辅食库

当前 schema / seed / query 均为标准 MySQL 语法，可直接在**腾讯云数据库 MySQL**（TencentDB for MySQL）上执行。

---

## 小程序如何访问腾讯云 MySQL？（必读）

**小程序不能、也不应该直连数据库。** 你当前遇到的「白名单、命令行、密码」是**开发阶段**在你自己电脑上执行建表、灌数、调试用的；**线上运行时，用户通过小程序访问的是「接口」，不是数据库本身**。

推荐架构：

```
小程序（前端）
    ↓ 只调 HTTPS 接口，不碰数据库
云函数 / 自建 API 服务（后端）
    ↓ 内网或受控环境连接 MySQL，密码只存在服务端
腾讯云 MySQL
```

- **小程序**：只调用 `wx.request()` 或 `wx.cloud.callFunction()`，传参数、拿 JSON 结果。
- **云函数或自建 API**：在服务端连接 MySQL（用环境变量存主机/账号/密码），执行 SQL，把结果返回给小程序。
- **数据库**：只允许云函数或 API 所在环境的 IP 访问（白名单里只配服务器/云函数出口 IP），不对外开放，账号密码不会出现在小程序代码里。

因此：

- 你现在用命令行/脚本连 MySQL：是**一次性或偶尔**的运维操作（建库、导数据、查问题）。
- 用户打开小程序：请求发到云函数或你的 API，由后端去查 MySQL 再返回，**对用户完全无感，也不存在「访问麻烦」**。

若你使用**微信云开发 CloudBase**：在云函数里用 `mysql2` 等驱动连接腾讯云 MySQL（云函数与 MySQL 同地域时可走内网），把现有 `baby-food-database-queries.sql` 里的逻辑拆成多个云函数（如：菜谱详情、周末备菜汇总、前一天提醒），小程序端只需 `wx.cloud.callFunction` 即可，无需关心数据库连接细节。

---

## 1. 连接前准备（开发/运维用）

1. **腾讯云控制台**：在 [云数据库 MySQL](https://console.cloud.tencent.com/cdb) 中创建实例（若尚未创建），记下：
   - **内网/外网地址**（主机）
   - **端口**（默认 3306）
   - **用户名**（如 root 或 控制台创建的子账号）
   - **密码**

2. **网络与白名单**：
   - 若从本机连接：在实例的「安全组」或「数据库代理」中放行你的出口 IP，并在「数据库管理」里将本机 IP 加入 **DBN 白名单**（若有）。
   - 外网访问需在控制台开启「外网地址」并同样配置白名单。

3. **字符集**：实例建议使用 `utf8mb4`；建库时脚本会指定 `CHARACTER SET utf8mb4`。

## 2. 用 MySQL 客户端连接

在已安装 MySQL 客户端的本机执行（将 `主机:端口`、用户名、密码替换为实际值）：

```bash
mysql -h <主机> -P <端口> -u <用户名> -p
# 提示输入密码后进入 mysql>
```

示例（外网地址为 `sh-cdb-xxx.sql.tencentcdb.com`，端口 3306）：

```bash
mysql -h sh-cdb-xxx.sql.tencentcdb.com -P 3306 -u root -p
```

## 3. 执行顺序（在 mysql 客户端内或管道）

建议先建库，再按顺序执行三个 SQL 文件：

```sql
CREATE DATABASE IF NOT EXISTS baby_food_verify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE baby_food_verify;
```

然后依次执行（路径按你本机实际位置调整）：

```bash
# 在项目 docs 目录下执行（或改为绝对路径）
mysql -h <主机> -P <端口> -u <用户名> -p baby_food_verify < baby-food-database-schema.sql
mysql -h <主机> -P <端口> -u <用户名> -p baby_food_verify < baby-food-database-seed.sql
mysql -h <主机> -P <端口> -u <用户名> -p baby_food_verify < baby-food-database-queries.sql
```

若希望**在交互式 mysql 里执行**：

```bash
mysql -h <主机> -P <端口> -u <用户名> -p baby_food_verify
```

进入后：

```sql
source D:/WorkSpace/MiniPrograms/MomDontWantThink/docs/baby-food-database-schema.sql
source D:/WorkSpace/MiniPrograms/MomDontWantThink/docs/baby-food-database-seed.sql
source D:/WorkSpace/MiniPrograms/MomDontWantThink/docs/baby-food-database-queries.sql
```

（Windows 路径可用 `/` 或 `\\`，按 mysql 客户端要求来。）

## 4. 使用项目自带脚本（推荐，不写死密码）

在项目根目录或 `docs` 下已提供脚本模板，通过**环境变量**传入连接信息，避免在命令行里写密码：

- **PowerShell**：`scripts/run-baby-food-mysql.ps1`
- 使用前在终端设置：

  ```powershell
  $env:MYSQL_HOST = "sh-cdb-xxx.sql.tencentcdb.com"
  $env:MYSQL_PORT = "3306"
  $env:MYSQL_USER = "root"
  $env:MYSQL_PASSWORD = "你的密码"
  $env:MYSQL_DATABASE = "baby_food_verify"
  .\scripts\run-baby-food-mysql.ps1
  ```

脚本会依次执行 schema → seed → queries，并将查询结果输出到终端（或可选写入文件），便于与 `baby-food-database-query-results.md` 中的预期结果对照。

## 5. 验证结果

执行完 `baby-food-database-queries.sql` 后，将终端或导出的结果与文档 **`baby-food-database-query-results.md`** 中的预期输出逐项对照，一致即表示连接腾讯云 MySQL 并执行成功。

## 6. 安全提醒

- 不要将密码提交到 Git；用环境变量或本地配置文件（且已加入 .gitignore）。
- 生产环境建议使用子账号、最小权限，并只开放必要 IP 白名单。
