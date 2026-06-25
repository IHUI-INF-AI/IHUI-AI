# ROUND18 — P10 国际化深化 阶段报告

> 生成时间: 2026-06-18
> 阶段: P10 国际化深化 (i18n v2)
> 状态: ✅ 全部完成

> ⚠️ **历史记录 / 已下线（2026-06-24）**
> 本报告所记录的 i18n v2 整套体系（`useI18nV2` composable + 后端 `/api/v1/i18n-v2/*` 19 个端点）已下线。
> 当前项目 i18n 由 V1 前端静态 JSON（`client/src/locales`）+ `i18nLanguages.ts` 静态元数据统一承担。
> 本文档仅作为 P10 阶段的历史存档保留。

---

## 一、阶段目标

1. **9 种语言 RTL 适配** (阿拉伯语 ar / 希伯来语 he)
2. **多语言同步** (i18n 协作平台 — pull/push/diff/sync-log)
3. **复数形式 / 日期数字本地化扩展** (CLDR plural rules + number/currency/date/relative format)

---

## 二、交付清单

### 2.1 后端 (FastAPI)

| 文件 | 说明 |
|------|------|
| [server/app/api/i18n_v2_router.py](file:///g:/1/server/app/api/i18n_v2_router.py) | 独立 router, 12 个端点, 绝对路径 `/api/v1/i18n-v2/*` |
| [server/app/main.py](file:///g:/1/server/app/main.py#L425-L433) | 单独挂载 i18n_v2_router (不依赖 v1 router) |

**12 个 HTTP 端点:**

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/v1/i18n-v2/languages` | 9 语言 CLDR 元数据 |
| GET | `/api/v1/i18n-v2/languages/{code}` | 单语言详情 |
| GET | `/api/v1/i18n-v2/keys` | 全量 key 列表 |
| GET | `/api/v1/i18n-v2/pull` | 拉取翻译 (scope=lang) |
| POST | `/api/v1/i18n-v2/push` | 推送单条翻译 |
| POST | `/api/v1/i18n-v2/push-plural` | 推送复数形式 |
| GET | `/api/v1/i18n-v2/diff` | 双语言差异对比 |
| GET | `/api/v1/i18n-v2/sync-log` | 同步事件日志 |
| GET | `/api/v1/i18n-v2/stats` | 仓库统计 |
| POST | `/api/v1/i18n-v2/format` | 数字/货币/日期格式化 |
| POST | `/api/v1/i18n-v2/translate` | 即时翻译 |
| GET | `/api/v1/i18n-v2/plural/{key}` | 复数示例 |

### 2.2 前端 (Vue 3)

| 文件 | 说明 |
|------|------|
| [client/src/composables/useI18nV2.ts](file:///g:/1/client/src/composables/useI18nV2.ts) | 核心 composable, 响应式 state + 12 个方法 |
| [client/src/views/I18nDashboard.vue](file:///g:/1/client/src/views/I18nDashboard.vue) | 开发者面板 (9 语言表 + 复数 + 格式化 + diff + 日志) |
| [client/src/components/i18n/LanguageSwitcher.vue](file:///g:/1/client/src/components/i18n/LanguageSwitcher.vue) | 语言切换组件 (含 RTL 标记 + 复数规则标签) |

### 2.3 测试

| 文件 | 说明 |
|------|------|
| [server/tests/test_i18n_v2.py](file:///g:/1/server/tests/test_i18n_v2.py) | 后端 69 个 pytest |
| [client/src/composables/__tests__/useI18nV2.test.ts](file:///g:/1/client/src/composables/__tests__/useI18nV2.test.ts) | 前端 19 个 vitest |
| [client/e2e/p10-i18n.spec.ts](file:///g:/1/client/e2e/p10-i18n.spec.ts) | 44 个 Playwright E2E + axe-core |

---

## 三、CLDR 9 语言元数据

| 代码 | 本地名 | 方向 | 复数规则 | 小数/千分位 | 货币位置 |
|------|--------|------|----------|-------------|----------|
| zh-CN | 简体中文 | LTR | other_only | . / , | 前缀 |
| zh-TW | 繁體中文 | LTR | other_only | . / , | 前缀 |
| en-US | English | LTR | one_other | . / , | 前缀 |
| ja | 日本語 | LTR | other_only | . / , | 前缀 |
| ko | 한국어 | LTR | other_only | . / , | 前缀 |
| ar | العربية | **RTL** | **arabic** (6 级) | ٫ / ٬ | 后缀 |
| he | עברית | **RTL** | **hebrew** (4 级) | . / , | 后缀 |
| fr | Français | LTR | french (3 级) | , / (空格) | 后缀 |
| es | Español | LTR | one_other | , / . | 前缀 |

---

## 四、关键技术决策

### 4.1 独立 router 文件
- v1 router 已下线, i18n_v2_router 不放在 v1 目录下
- 端点使用完整绝对路径 `@router.get("/api/v1/i18n-v2/languages")`, 避免 prefix 重复

### 4.2 axios 拦截器不拆包
- 后端统一返回 `{code, msg, data: {...}}`
- axios 拦截器不自动拆包, 前端手动取 `res.data.data.X`
- 测试 mock 需匹配: `{ data: { code: 0, msg: 'ok', data: {...} } }`

### 4.3 WCAG AA 颜色对比度
- `.i18n-tag.rtl` 和 `.lang-switcher-tag.rtl` 使用 `var(--el-text-color-primary)` (#303133) 背景 + `var(--el-color-white)` 白字
- 对比度 ≈ 12:1, 远超 WCAG AA 4.5:1 要求
- 仅使用项目全局 CSS 变量, 无 `!important`, 无高特异性选择器

### 4.4 Vue 3 reactive
- `state` 必须用 `reactive()` 而非普通对象, 确保模板响应式

---

## 五、测试结果

### 5.1 后端 pytest
```
tests/test_i18n_v2.py: 69 passed, 47 warnings in 3.42s
```

### 5.2 前端 vitest (P10 相关)
```
src/composables/__tests__/useI18nV2.test.ts: 19 passed (19)
```
> 其他 vitest 失败均为预存的 Tailwind CSS PostCSS 环境问题, 与 P10 无关

### 5.3 Playwright E2E
```
e2e/p10-i18n.spec.ts: 44 passed (2.2m)
```

**测试覆盖:**
- 跨视口渲染 (mobile 375x667 / tablet 768x1024 / desktop 1280x800) × (chromium + Mobile Chrome)
- 9 语言元数据表 (至少 9 行, 含 zh-CN/en-US/ar/he)
- RTL 标记仅出现在 ar/he 行
- 切换 RTL 语言后 `dir="rtl"` (ar, he)
- 切换 LTR 语言后 `dir="ltr"` (zh-CN, fr, en-US)
- 复数卡片至少 5 张
- 格式化预览 4 个卡片 (number/currency/date/relative)
- 差异对比 3 个统计
- 同步日志区域存在
- axe-core 无 critical/serious 违规 (LTR 3 视口 + RTL 2 语言)
- 无障碍: select 有 aria-label, h1 可被屏幕阅读器朗读
- 键盘交互: 切换语言后焦点仍可达 select

---

## 六、本轮修复记录

### 6.1 `.lang-switcher-tag.rtl` 颜色对比度 (2.05:1 → 12:1)
- **问题**: `--el-color-warning` (#e6a23c) 背景 + `--el-bg-color` (#f7f8fa) 文字, 对比度仅 2.05:1
- **修复**: 改用 `var(--el-text-color-primary)` 背景 + `var(--el-color-white)` 文字
- **文件**: [LanguageSwitcher.vue#L168-L173](file:///g:/1/client/src/components/i18n/LanguageSwitcher.vue#L168-L173)

### 6.2 `.i18n-tag.rtl` 颜色对比度 (2.05:1 → 12:1)
- **问题**: 同上, `--el-color-warning` 背景 + `--el-bg-color` 文字
- **修复**: 同上方案
- **文件**: [I18nDashboard.vue#L382-L387](file:///g:/1/client/src/views/I18nDashboard.vue#L382-L387)

### 6.3 useI18nV2.test.ts mock 数据结构
- **问题**: 测试 mock 返回 `{ code: 0, data: {...} }`, 但代码访问 `res.data.data.X`
- **修复**: 所有 mock 改为 `{ data: { code: 0, msg: 'ok', data: {...} } }`
- **文件**: [useI18nV2.test.ts](file:///g:/1/client/src/composables/__tests__/useI18nV2.test.ts)

### 6.4 I18nDashboard.vue 模板崩溃
- **问题**: `diffResult.a_missing.length` 当 a_missing undefined 时 TypeError
- **修复**: `(diffResult.a_missing || []).length`

---

## 七、约束合规

| 约束 | 状态 |
|------|------|
| 不使用 `!important` | ✅ |
| 不使用高特异性选择器 | ✅ |
| 仅使用项目全局 CSS 变量 | ✅ |
| 每种容器类型样式唯一 | ✅ |
| Playwright 验证后交付 | ✅ 44/44 通过 |
| 全中文回复 | ✅ |

---

## 八、后续开发建议

### P11 候选方向

1. **V1 API 退役中间件** — `V1RetirementMiddleware`, ENV `V1_RETIRED_PATHS` 控制 410 Gone
2. **i18n 翻译记忆库 (TM)** — 跨 key 相似度匹配, 减少重复翻译
3. **i18n 机器翻译集成** — 接入外部 MT API (DeepL / Google Translate), 人工审核流程
4. **RTL 布局深度测试** — 扩展到其他页面 (Dashboard, Wallet 等), 确保全局 RTL 支持
5. **Tailwind CSS PostCSS 环境修复** — 安装 `@tailwindcss/postcss`, 修复预存的 vitest 失败
6. **性能监控** — i18n 资源懒加载, 按需加载语言包, 减少首屏体积
