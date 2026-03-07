主题色系统：
主色 #7FB77E
active icon #5C9D6B
inactive icon #9FB8A5
背景 #F3F7F4

模块色：
首页 #6EBF85
辅食 #F6A65A
成长 #8ECF9A
记录 #7FC7A2
我的 #A0BFB3

图标列表（核心10个）

这是辅食系统最常用的一套。

1️⃣ 备餐计划

含义：生成周备餐计划

图标建议：

🍽

AI生成描述：

rounded plate with spoon and fork, simple baby food icon, soft line style, minimal

icon name

meal_plan
2️⃣ 食材

含义：食材列表

图标建议

🥕

AI描述

simple carrot vegetable icon, rounded minimal style, baby food theme

icon name

ingredients
3️⃣ 今日备餐

含义：当天计划

图标建议

📅

AI描述

calendar with small food bowl icon, minimal baby food planning style

icon name

today_plan
4️⃣ 添加餐次

含义：新增辅食

图标建议

➕

AI描述

plus sign with baby bowl icon, rounded minimal style

icon name

add_meal
5️⃣ 宝宝

含义：宝宝信息

图标建议

👶

AI描述

cute baby face icon, rounded minimal style, simple line

icon name

baby_profile
6️⃣ 月龄提示

含义：系统提示

图标建议

🌿

AI描述

simple leaf icon, natural baby food theme, rounded minimal

icon name

hint
7️⃣ 早餐

图标建议

🌞 + bowl

AI描述

baby food bowl with small sun icon, minimal outline style

icon name

breakfast
8️⃣ 午餐

图标建议

🍚

AI描述

baby food bowl icon minimal style

icon name

lunch
9️⃣ 晚餐

图标建议

🌙 + bowl

AI描述

baby food bowl with moon icon minimal line style

icon name

dinner
🔟 加餐

图标建议

🍎

AI描述

simple apple snack icon minimal rounded style

icon name

snack
图标尺寸规范

统一：

24 × 24 px

tab bar：

48 × 48 px

卡片小icon：

16 × 16 px
icon状态

默认：

outline
stroke: 2px
color: #9FB8A5

active：

filled
color: #5C9D6B


辅食备餐小程序 UI 设计规范
一、整体设计风格

产品定位：

母婴 / 辅食 / 成长记录

设计风格：

清新自然
圆角卡片
简洁柔和
低对比度

关键词：

natural
baby-friendly
rounded
minimal
soft color

避免：

高对比
深色背景
复杂渐变
强阴影
二、颜色系统
1 全局主题色

主色（品牌色）

#7FB77E

active icon

#5C9D6B

inactive icon

#9FB8A5

页面背景

#F3F7F4

卡片背景

#FFFFFF

分割线

#E8F0EA

主要文字

#2F3A34

次级文字

#6B7C73
2 模块颜色

用于 tab 和页面 accent。

模块	颜色
首页	#6EBF85
辅食	#F6A65A
成长	#8ECF9A
记录	#7FC7A2
我的	#A0BFB3

规则：
tab选中使用 active icon
未选中使用 inactive icon
三、图标体系
图标风格
rounded
2px stroke
minimal

默认

outline

选中

filled

尺寸

24px

小程序使用

48rpx
核心图标（必须实现）
1 备餐计划

icon name

meal_plan

含义

周备餐计划

图标建议

plate + spoon

AI描述

minimal baby food plate icon with spoon, rounded line style
2 食材

icon name

ingredients

图标建议

carrot

AI描述

simple carrot vegetable icon, rounded minimal style
3 今日计划

icon name

today_plan

图标建议

calendar + bowl

AI描述

calendar icon with small baby food bowl
4 添加餐次

icon name

add_meal

图标建议

plus + bowl

AI描述

plus icon with baby bowl minimal line style
5 宝宝信息

icon name

baby_profile

图标建议

baby face

AI描述

cute baby face icon minimal rounded style
6 提示

icon name

hint

图标建议

leaf

用途

系统提示
月龄提示

AI描述

simple leaf icon natural baby food theme
7 早餐

icon name

breakfast

图标建议

sun + bowl

AI描述

baby food bowl with small sun icon minimal style
8 午餐

icon name

lunch

图标建议

bowl

AI描述

baby food bowl minimal rounded icon
9 晚餐

icon name

dinner

图标建议

moon + bowl

AI描述

baby food bowl with moon icon minimal line style
10 加餐

icon name

snack

图标建议

apple

AI描述

simple apple snack icon minimal rounded style
四、UI尺寸系统

小程序统一单位：

rpx

规则：

750rpx = 屏幕宽度
页面布局

页面左右边距

32rpx

模块间距

32rpx

卡片间距

24rpx
卡片组件

卡片圆角

24rpx

卡片内边距

24rpx

卡片阴影

0 8rpx 20rpx rgba(0,0,0,0.04)

卡片背景

#FFFFFF
五、图标尺寸
类型	尺寸
tab icon	48rpx
普通 icon	40rpx
小 icon	32rpx
六、字体系统
类型	大小
页面标题	36rpx
卡片标题	32rpx
正文	28rpx
辅助文字	24rpx
七、按钮系统

主按钮

高度

88rpx

圆角

44rpx

颜色

#7FB77E

字体

30rpx
八、tab bar 规范

高度

120rpx

icon

48rpx

文字

22rpx

未选中颜色

#9FB8A5

选中颜色

模块色
九、备餐卡片布局

结构：

日期
餐次按钮
添加餐次

卡片高度

200rpx

餐次按钮

64rpx

餐次间距

16rpx
十、间距系统

统一使用 8 的倍数：

类型	rpx
xs	8
sm	16
md	24
lg	32
xl	48
十一、提示组件

月龄 <5个月：

标题

宝宝未满5个月，当前不推荐生成辅食备餐计划

副标题

宝宝X月龄，可以先了解备餐计划的使用方式

提示图标

leaf icon