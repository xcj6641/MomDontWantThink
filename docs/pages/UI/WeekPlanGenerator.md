# 周计划生成页 — 设计文档

## 页面定位

- **入口**：今日辅食页宝宝栏「生成本周计划」/「生成下周计划」
- **代码路径**：`miniprogram/pages/week/`
- **核心功能**：查看、调整并确认本周/下周备餐计划；配置备餐套数与日期分配方式
- **关联云函数**：`getWeekData`、`updateWeekSettings`、`confirmWeek`

---

## 信息架构（从上到下）

1. 顶部状态提示卡（welcome-card）
2. 日期分配控制区（date-district-card）
3. 分组标题「备餐安排」
4. 备餐卡片列表（weekPlanListForRender）
5. 底部确认区（confirm-area）
6. 备餐套数弹框（menu-count-modal，浮层）

---

## 模块规格

### 1. 顶部状态提示卡

- **样式**：flex 横排，左图标 🌱（44rpx）+ 右文本体；浅绿渐变背景 `linear-gradient(165deg, #fbfdf9, #eef6f1)`，2rpx 浅绿边框，32rpx 圆角，32rpx padding，底部 margin 32rpx
- **标题**（34rpx / 600 / `#2F5E3B`）三态：
  - 宝宝 < 5 个月：`宝宝未满5个月，当前不推荐生成辅食备餐计划`
  - 下周视图：`下周辅食准备好啦`
  - 本周视图（默认）：`本周辅食准备好啦`
- **副标题**（26rpx / `var(--text-secondary)`）：
  - 宝宝 < 5 个月：`宝宝X月龄，可以先了解备餐计划的使用方式`
  - 其余：`根据宝宝X月龄生成，可以随时调整`

### 2. 加载态

- 触发条件：`weekDebugShowLoading === true`（数据正在生成时）
- 文案：`正在帮你生成本周/下周计划…`（26rpx，`var(--text-secondary)`）
- 骨架屏：3 张白底圆角卡（高 200rpx，列方向排列，间距 24rpx）

### 3. 日期分配控制区

白底卡片（32rpx 圆角，2rpx 浅绿边框，轻阴影，内边距 24rpx 28rpx，底部 margin 32rpx）。内部四行：

| 行 | 内容 | 说明 |
|---|---|---|
| 标题行 | 左：`本周备 N 套备餐`（28rpx / 600 / `#2F3A35`）；右：「调整」文字按钮（26rpx，浅绿背景，边框）| 点击「调整」打开备餐套数弹框 |
| 备餐选择行 | 水平排列的备餐1/2/…N 按钮，每个含色点 + 标签 | 选中态：浅绿背景 + 品牌绿文字 + 600；未选：`var(--fill-warm)` + 次要色文字 |
| 星期分配行 | 7 个日期格子（一行等宽分布），显示「一」—「日」缩写 | 点击格子将该天分配给当前选中备餐；颜色继承当前备餐色系；未分配：`var(--fill-warm)` + muted 文字；当前选中备餐的格子：品牌主色背景 + 白字 |

**色系**（代码中的 `TEMPLATE_COLORS` / `TEMPLATE_BG_COLORS`）：备餐1 绿、备餐2 蓝、备餐3 橙，依此类推，最多 7 套。

### 4. 备餐安排标题

```
🥣 备餐安排
```
emoji（32rpx）+ 标题文字（30rpx / 600 / `#2F3A35`），底部 margin 20rpx。

### 5. 备餐卡片

每套备餐一张卡片，纵向排列，间距 32rpx。

```
┌───────────────────────────────┐
│ ▌（8rpx 品牌色竖条）           │
│ ● 备餐1              ⋯        │ ← 头部（卡片 bgColor）
│ 周一  周二  周三               │ ← 日期 chips（白底圆角标签）
├───────────────────────────────┤
│ 早餐                 菜谱名    │
│ 加餐  BLW            菜谱名    │ ← 餐次列表
│ 午餐                 菜谱名    │
└───────────────────────────────┘
```

**卡片外层**：白底，32rpx 圆角，2rpx 浅绿边框，轻阴影，`overflow: hidden`

**顶部色条**（`template-card-accent`）：8rpx 高，背景为当前备餐主色（`TEMPLATE_COLORS[i]`）

**头部区域**（`template-card-header`）：背景为当前备餐淡色（`TEMPLATE_BG_COLORS[i]`），padding 16rpx 28rpx 14rpx
- 第一行：色点（12rpx 圆形）+ 备餐名（32rpx / 600）+ 三点菜单「⋯」
- 第二行：日期 chips（`template-dates-chips`）
  - 每个 chip：24rpx 文字，白底，浅灰边框，20rpx 圆角，padding 8rpx 20rpx
  - 显示星期缩写（「周一」等）
  - 点击 chip 可跳转到该日的编辑页

**分隔线**：0 高度，2rpx 顶边框 `#EEF2F0`，左右 margin 28rpx

**餐次区**（`template-card-meals`）：padding 20rpx 28rpx 28rpx，每行：
- 左列（固定 144rpx）：餐次名（24rpx / `#7B8794`）+ 可选 BLW 标签（22rpx，品牌色 / 淡色背景，随备餐色系）
- 右列（flex-grow）：菜谱名（28rpx / `#3C4A45`）；如有手动改写前缀 `✎ `；未安排时显示「未安排」（次要色）

**占位卡**（`isPlaceholder: true`）：菜谱名变灰，底部显示「保存后生成菜单」提示

**三点菜单**（`⋯`）：ActionSheet，选项为「编辑备餐」「换一组」，若 N > 1 追加「删除备餐」

### 6. 底部确认区

跟随备餐卡片列表，卡片存在时始终显示。分三种场景：

| 场景 | 显示内容 |
|---|---|
| 情况1：来自收藏，未修改（`from-saved`）| 灰色文案「来自「X月X日-X月X日周计划」」 |
| 情况2：基于收藏，已修改（`modified-saved`）| 灰色文案「已基于「X月X日-X月X日周计划」做调整」+ 复选框「收藏新的周计划」 |
| 情况3：自动生成（默认）| 复选框「收藏当前周计划，方便以后直接复用」 |

复选框行（情况2/3）：居中水平排列，checkbox（品牌绿）+ 文案（26rpx / `#6e7b70`），底部 margin 20rpx

**确认按钮**：全宽，高 96rpx，绿色渐变背景，白字「开始下周计划」，24rpx 圆角

### 7. 异常/空态重试区

备餐数据为空时（`weekPlanListForRender.length === 0`）替代卡片列表显示：

白底卡，居中显示「数据异常 点击重试」，点击链接触发 `onRetryFetchPlanData`；加载中显示旋转动画 + 「加载中…」

---

## 备餐套数弹框（底部 Sheet）

触发：点击「调整」按钮。遮罩 + 底部白底面板（32rpx 顶圆角，padding 含 safe-area-bottom）。

### 内部结构

1. **标题**：「本周/下周准备几套备餐？」（32rpx / 600，居中）

2. **套数选择**：7 个格子（4 列换行），每格「N 套」
   - 选中：浅绿背景 `#EAF7EF`，品牌绿文字，600
   - 未选中：`var(--fill-warm)`，深色文字

3. **安排方式**（`arrangement-section`）：
   - 标题「怎么安排更合适？」（26rpx / 次要色）
   - 两个单选项，每项：
     - 左：自定义 radio 圆圈（36rpx，选中时绿色 border + 内填圆）
     - 右：说明文字 + 色块示意
   
   | 选项 | 说明 | 示意 |
   |---|---|---|
   | 连续安排（默认） | 同一备餐连续几天 | 🟩🟩🟩 🟦🟦 🟧🟧 |
   | 交替安排 | 不同备餐交替 | 🟩🟦🟧 🟩🟦🟧 🟩 |

   选中态：浅绿背景 + 绿色边框；未选：`var(--fill-warm)` + 透明边框

   **逻辑**：
   - 连续安排：按固定分配表（1套全7天；2套4-3；3套2-3-2；依此类推）
   - 交替安排：循环轮转（`(dayIndex % N) + 1`），备餐1在周一/周四/周日，备餐2在周二/周五，依此类推

4. **保存按钮**：全宽，绿色渐变，88rpx 高，「保存」

---

## 页面状态

| 状态 | 触发条件 | 表现 |
|---|---|---|
| 加载中 | `weekDebugShowLoading === true` | 骨架屏（文案 + 3张卡）；控制区和卡片列表隐藏 |
| 常规 | 有备餐数据 | 控制区 + 卡片列表 + 确认区 |
| 异常 | 无备餐数据（加载失败） | 控制区 + 空态重试块 |

---

## 数据与逻辑

| 数据字段 | 说明 |
|---|---|
| `weekStartDate` | 当前周的周一日期（`YYYY-MM-DD`） |
| `isNextWeek` | 是否为下周视图 |
| `settingsNVal` | 当前备餐套数（1–7） |
| `settingsDayBindings` | 长度 7 的数组，值 1–N 表示每天归属的备餐编号，0 为未分配 |
| `arrangementMode` | `'consecutive'`（连续）\| `'alternating'`（交替） |
| `settingsSelectedIndex` | 当前选中的备餐编号（1–N），用于日期格子点击分配 |
| `weekPlanListForRender` | 最终渲染的卡片列表（含 dateChips、meals） |
| `savePlan` | 是否收藏当前周计划（checkbox 状态） |
| `effectiveConfirmScenario` | 确认区场景：`'from-saved'` \| `'modified-saved'` \| 其他（自动生成） |
| `planSourceLabel` | 来源周计划的「X月X日-X月X日」标签 |

**关键逻辑**：`settingsDayBindings` 改变后，`computeDisplayTemplateCardsFrom` 重新计算每张卡的 `dateChips`（根据绑定关系找出对应日期并转为星期标签），结果直接写入 `weekPlanListForRender`（一次 setData，不分两步）。

---

## 颜色规范

### 页面通用色

| 角色 | 值 |
|---|---|
| 页面背景 | `var(--bg-warm)` |
| 卡片背景 | `#FFFFFF` |
| 卡片边框 | `var(--border-warm)` = `rgba(160, 216, 192, 0.4)` |
| 主绿 | `#7FB77E` |
| 深绿 | `#6BA86A` |
| 标题文字 | `#2F3A35` |
| 次要文字 | `var(--text-secondary)` |
| 浅绿填充 | `var(--fill-warm)` |
| 弱化文字 | `var(--text-muted)` |

### 备餐色系（`TEMPLATE_COLORS` / `TEMPLATE_BG_COLORS`）

用于备餐按钮、卡片顶部色条、色点、BLW 标签、日期格子高亮。

| 备餐 | 主色 | 背景淡色 |
|---|---|---|
| 备餐1 | `#7FB77E`（母婴绿） | `#EAF7EF` |
| 备餐2 | `#7EA9D6`（天蓝） | `#EEF5FF` |
| 备餐3 | `#E8A87C`（暖橙） | `#FFF3EB` |
| 备餐4 | `#A88BC0`（薰衣草紫） | `#F3EFF8` |
| 备餐5 | `#7EC8C8`（青蓝） | `#E8F7F7` |
| 备餐6 | `#E8A8B8`（玫瑰粉） | `#FFEEF3` |
| 备餐7 | `#9E9E9E`（中性灰） | `#F2F2F2` |

---

*文档版本：2026-04*
