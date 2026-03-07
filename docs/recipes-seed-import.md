# 系统菜谱库种子数据：导入说明与分类规则

## 1) 云开发控制台导入（JSON 数组）

### 方式一：控制台单条导入（推荐）

1. 打开 **微信开发者工具 → 云开发 → 数据库**，选中环境。
2. 进入 **recipes** 集合。
3. 点击 **「新增记录」**。
4. 将 `docs/recipes-seed.json` 中的**每一条**复制为一条记录粘贴进「JSON」输入框（一次只贴一条对象，不要带外层 `[]`）。
   - 示例单条：  
     `{"_id":"recipe_01","openid":"system","name":"南瓜粥","ingredients":[{"name":"南瓜","amount":"50g"},{"name":"大米","amount":"30g"}],"category":"主食","mealTypes":["breakfast"],"isBlwFriendly":false,"tags":["蔬菜","主食"]}`
5. 保存后重复步骤 3–4，直到 35 条全部导入。

### 方式二：批量导入（若控制台支持）

1. 在 **云开发 → 数据库 → recipes** 中查找是否有 **「导入」** 或 **「批量导入」**。
2. 若支持 JSON 文件导入，选择 `docs/recipes-seed.json`（若只支持数组格式，该文件已是 JSON 数组，可直接使用）。
3. 若控制台要求「每行一条 JSON」，可先用脚本或编辑器将数组拆成每行一条对象再导入。

### 方式三：云函数一次性写入（开发用）

在云开发控制台「云函数」中新建临时函数，或本地新建 `cloudfunctions/seedRecipes/index.js`，在 `main` 中读取上述 JSON 数组后循环 `db.collection('recipes').add()` 插入（注意避免重复插入）。执行一次后删除或停用该云函数。

---

## 2) 购物清单分类映射规则（蛋白 / 蔬菜 / 水果 / 主食 / 其他）

云函数 **buildShoppingList** 会根据菜谱的 **category** 字段，把食材归到购物清单的 5 类里。映射规则如下（与 `cloudfunctions/buildShoppingList/index.js` 中 `CATEGORY_MAP` 一致）：

| 菜谱 category（或 tags 中主类） | 购物清单分类 |
|--------------------------------|--------------|
| 蛋白、肉蛋、蛋、肉、鱼、豆     | **蛋白**     |
| 蔬菜                           | **蔬菜**     |
| 水果                           | **水果**     |
| 主食                           | **主食**     |
| 未填或其他                     | **其他**     |

- 种子数据里每条菜谱的 **category** 已按上表设为：`主食`、`蔬菜`、`水果`、`蛋白` 之一，无需再改。
- 若后续在控制台或「我的菜谱」中新增菜谱，**category** 填上述四类之一或留空（留空会归入「其他」），购物清单即可正确分类。

---

## 种子数据说明（35 条）

- **覆盖餐型**：早餐(breakfast)、早点(morningSnack)、午餐(lunch)、午点(afternoonSnack)、晚餐(dinner)。
- **字段**：name、ingredients（name+amount）、mealTypes、isBlwFriendly、tags、category；适配 11 月龄（粥/软饭/面/蒸蛋/手指食物），无医疗声明。
- **模板引用**：导入后可在 **templates** 的 `meals[].recipeIds` 中填入上述 `_id`（如 `recipe_01`～`recipe_35`），用于生成周计划。
