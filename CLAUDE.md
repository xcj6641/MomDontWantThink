# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**妈妈不想想 (MomDontWantThink)** — a WeChat Mini Program (辅食周节奏助理) that helps parents plan weekly baby food menus. Built with native WeChat Mini Program + CloudBase (cloud functions + cloud database). No Taro/UniApp.

Cloud environment ID: `cloudbase-0gvft8jua95a94fa`

## Development Environment

This project is developed and tested entirely within **WeChat DevTools** (微信开发者工具). There are no npm build commands — the TypeScript compilation is handled by the DevTools itself.

- Open the project root in WeChat DevTools to build/run/debug
- Upload and deploy cloud functions individually via DevTools → Cloud Development panel
- Preview on device via DevTools → Preview

## Project Structure

```
miniprogram/          # Mini Program frontend (TypeScript + WXML + WXSS)
  app.ts              # App entry; initializes wx.cloud with env ID
  pages/              # Each page: .ts + .wxml + .wxss + .json
  components/         # Reusable components (assistToast, dateRow, mealItem, templateTabs)
  utils/
    cloud.js          # callCloud() — unified cloud function caller with loading/toast
    ageMealConfig.js  # Age band → meal slots config; MEAL_LABELS; getOrderedSlotsForAge()
    weekPlanMock.ts   # Mock data utilities for offline development
cloudfunctions/       # CloudBase cloud functions (Node.js), one folder per function
docs/                 # Schema design and seed data docs
instruction/          # Product requirement docs and step-by-step build instructions
```

## Architecture

### Frontend → Cloud Communication
All cloud calls go through `miniprogram/utils/cloud.js:callCloud(name, data, opts)`. It wraps `wx.cloud.callFunction`, handles loading indicators, and normalizes error responses to `{ success: false, code, message }`. Pages never call `wx.cloud.callFunction` directly.

### Age-Based Meal Slots
Baby meal structure is age-driven. `miniprogram/utils/ageMealConfig.js` defines:
- `AGE_BANDS`: maps age in months to active meal slots (e.g., 9–12 months → breakfast/lunch/dinner)
- `getOrderedSlotsForAge(months)`: returns the ordered slot list for a given age
- `MEAL_LABELS`: display names for all mealKey variants (breakfast/lunch/dinner/snack1/snack2/snack_am/snack_pm)

### Week Plan Data Model (key concepts)
- **weekStartDate**: always the Monday of that week, format `YYYY-MM-DD` — used as the primary key across all week-related collections
- **week_plans**: one document per user per week; contains 7 days, each with a `meals` array; individual days can be `isOverridden: true` for manual edits
- **templates**: define meal structure (which slots, BLW defaults) but not specific recipes; system templates keyed by `ageBand`
- **week_settings**: stores which templates are assigned to which days; `confirmed: boolean` tracks whether user confirmed the week
- Full schema in `docs/cloud-database-schema.md`

### Cloud Functions
Each cloud function in `cloudfunctions/` is independently deployed. Key functions:
- `initUser` — creates user record on first launch
- `getHomeData` — returns today's meals, tomorrow tip, next week status
- `generateNextWeek` — generates a week plan from templates + recipes, respecting age/allergy filters
- `confirmWeek` — marks `week_settings.confirmed = true`
- `getWeekData` — fetches week plan for the week page
- `updateDayOverride` — saves single-day manual edits
- `savePreferences` / `getPreferences` — baby birthday, allergies, BLW prefs
- `buildShoppingList` / `toggleShoppingItem` — shopping list management
- `logMealDone` / `markReaction` — meal log and reaction tracking

### Page Navigation Flow
Home (`/pages/home`) → generates plan → Week (`/pages/week`) → Day edit (`/pages/dayEdit`) / Week settings (`/pages/weekSettings`) → Next week (`/pages/nextWeek`)

The `week` page is the most complex: it handles both "this week" and "next week" views, inline template settings, day assignment bindings, and a debug panel (toggled via `DEBUG_WEEK_VIEW_MODE_KEY` in storage).

## TypeScript Notes
- `tsconfig.json` enables `strict`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`
- Cloud functions use plain JavaScript (CommonJS); only the miniprogram uses TypeScript
- Utility files in `miniprogram/utils/` are `.js` (not `.ts`) except `util.ts` and mock files — import them with `require()`
- WeChat types come from `typings/` (not `node_modules`)

## Key Conventions
- `weekStartDate` is always Monday `YYYY-MM-DD` — compute with `day === 0 ? -6 : 1 - day` offset
- mealKey values: `breakfast`, `lunch`, `dinner`, `snack1`/`snack_am`, `snack2`/`snack_pm` (legacy keys exist in DB, normalize via `MEAL_LABELS`)
- BLW default: dinner is BLW by default (`DEFAULT_BLW_PREFERENCE` in ageMealConfig.js)
- User identity: always `openid` from cloud (never wx.getUserInfo)
- All timestamps: ISO 8601 strings (`new Date().toISOString()`)
- Toast copy uses friendly 助理-style language: "已帮你…" / "记得…" / "我这边有点忙，稍后再试一次～"
