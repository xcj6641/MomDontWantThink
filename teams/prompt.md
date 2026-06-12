Users
1. Should babys' allergy info saved in User collection? `baby.allergies`
2. Remove BLW. 

recipes:
1. Use the old schema. But add these two:
| `tags` | string[] | 否 | 标签（如 "高铁", "高蛋白"） |
| `imageUrl` | string | 否 | 菜品图片 |

weekplan: 
1. weekplan - MealPrep - MealSlot - RecipeRef
Will this data structure have too much layer? 
2. We will offer 添加备餐 function, how to update the data entry if a user adds or deletes a 备餐?

Other:
1. we need saved week plan to support save week plan function.
2. We should have meal_logs function. When users click 已做 button, record and the historical data can be displayed in profile page. 
3. We need allergy collection.
4. We need shopping list.
5. We need baby likes, saved recipies.
6. We need saved week plans.