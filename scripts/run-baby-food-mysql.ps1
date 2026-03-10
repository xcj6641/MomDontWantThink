# 使用腾讯云 MySQL 执行宝宝辅食库 schema + seed + queries
# 用法：先设置环境变量，再执行本脚本
#   $env:MYSQL_HOST = "你的主机"
#   $env:MYSQL_PORT = "3306"
#   $env:MYSQL_USER = "root"
#   $env:MYSQL_PASSWORD = "你的密码"
#   $env:MYSQL_DATABASE = "baby_food_verify"
#   .\scripts\run-baby-food-mysql.ps1

$ErrorActionPreference = "Stop"
$docsDir = Join-Path $PSScriptRoot ".." "docs"
$schemaPath = Join-Path $docsDir "baby-food-database-schema.sql"
$seedPath = Join-Path $docsDir "baby-food-database-seed.sql"
$queriesPath = Join-Path $docsDir "baby-food-database-queries.sql"

$host = $env:MYSQL_HOST
$port = $env:MYSQL_PORT
if (-not $port) { $port = "3306" }
$user = $env:MYSQL_USER
$password = $env:MYSQL_PASSWORD
$database = $env:MYSQL_DATABASE
if (-not $database) { $database = "baby_food_verify" }

if (-not $host -or -not $user -or -not $password) {
    Write-Host "请设置环境变量: MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD（可选: MYSQL_PORT, MYSQL_DATABASE）"
    exit 1
}

# 检查 mysql 是否可用
$mysqlCmd = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysqlCmd) {
    Write-Host "未找到 mysql 客户端，请安装 MySQL Client 并加入 PATH，或使用腾讯云 DMC 等工具执行 SQL 文件。"
    exit 1
}

$mysqlArgs = @("-h", $host, "-P", $port, "-u", $user, "--default-character-set=utf8mb4")

# 建库
Write-Host "创建/选择数据库: $database"
$createDb = "CREATE DATABASE IF NOT EXISTS ``$database`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
$createDb | & mysql $mysqlArgs -p$password 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "建库失败，请检查连接与权限。"
    exit 1
}

$mysqlArgs += $database

# 执行 schema
Write-Host "执行 schema..."
Get-Content $schemaPath -Raw -Encoding UTF8 | & mysql $mysqlArgs -p$password 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "schema 执行失败"; exit 1 }

# 执行 seed
Write-Host "执行 seed..."
Get-Content $seedPath -Raw -Encoding UTF8 | & mysql $mysqlArgs -p$password 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host "seed 执行失败"; exit 1 }

# 执行 queries 并输出结果
Write-Host "执行 queries 并输出结果..."
Write-Host "----------------------------------------"
Get-Content $queriesPath -Raw -Encoding UTF8 | & mysql $mysqlArgs -p$password 2>&1
Write-Host "----------------------------------------"
Write-Host "完成。请与 docs/baby-food-database-query-results.md 中的预期结果对照验证。"
