# ROUND19 - P11 阶段总结报告

> 日期: 2026-06-19
> 阶段: P11 国际化深化 (TM + MT + RTL + 懒加载 + V1 退役)
> 状态: ✅ 全部完成

## 一、P11 交付物清单

### P11-1: V1 API 退役中间件 ✅
- 文件: [server/app/middleware/v1_retirement.py](file:///g:/1/server/app/middleware/v1_retirement.py)
- 测试: [server/tests/test_v1_retirement.py](file:///g:/1/server/tests/test_v1_retirement.py) — 18 个测试
- 功能:
  - `V1_RETIRED_PATHS` 环境变量控制渐进式退役 (逗号分隔路径前缀)
  - `V1_FULL_RETIREMENT=true` 全量下线 (返回 410 Gone)
  - `/docs` 和 `/openapi.json` 始终放行
  - 410 响应包含 `Deprecation`、`Sunset`、`Link` header

### P11-2: Tailwind CSS PostCSS 修复 ✅
- 文件: [client/postcss.config.js](file:///g:/1/client/postcss.config.js)
- 问题: 项目安装 Tailwind v4 (`@tailwindcss/vite`)，但 `postcss.config.js` 仍用 v3 写法 `tailwindcss: {}`
- 修复: 移除 `tailwindcss: {}` 插件，仅保留 `autoprefixer`

### P11-3: 翻译记忆库 (TM) ✅
- 后端: [server/app/i18n_v2/__init__.py](file:///g:/1/server/app/i18n_v2/__init__.py)
  - `_levenshtein()` — 编辑距离算法
  - `_similarity()` — 相似度计算 (0.0~1.0)
  - `search_tm()` — 跨 key 相似度搜索 (支持语言过滤、阈值、limit)
  - `tm_stats()` — TM 统计
- 路由: [server/app/api/i18n_v2_router.py](file:///g:/1/server/app/api/i18n_v2_router.py)
  - `POST /api/v1/i18n-v2/tm/search`
  - `GET /api/v1/i18n-v2/tm/stats`
- 测试: 13 个 (10 单元 + 3 HTTP)

### P11-4: 机器翻译集成 (MT) ✅
- 后端: [server/app/i18n_v2/__init__.py](file:///g:/1/server/app/i18n_v2/__init__.py)
  - `MTRequest` / `MTResult` 数据类
  - `machine_translate()` — 内置词典命中 (confidence=0.95) / 同语言 (1.0) / 未命中 (0.3)
  - `review_mt()` — 人工审核 (approve/reject/edit)
  - `list_mt_queue()` — 审核队列
  - `_MT_QUEUE` 存储待审核结果
- 路由: 3 个端点 (`/mt/translate`, `/mt/review`, `/mt/queue`)
- 测试: 12 个 (8 单元 + 4 HTTP)

### P11-5: 前端 TM + MT UI ✅
- Composable: [client/src/composables/useI18nV2.ts](file:///g:/1/client/src/composables/useI18nV2.ts)
  - `searchTm()`, `fetchTmStats()`, `machineTranslate()`, `reviewMt()`, `fetchMtQueue()`
- 视图: [client/src/views/I18nDashboard.vue](file:///g:/1/client/src/views/I18nDashboard.vue)
  - TM 搜索区域 (输入框 + 结果列表 + 相似度标签)
  - MT 翻译区域 (源文本 + 目标语言选择 + 翻译结果 + 审核按钮)
- 样式: 全部使用项目全局 CSS 变量，无 `!important`，无高特异性选择器

### P11-6: i18n 资源懒加载 ✅
- Composable: [client/src/composables/useI18nV2.ts](file:///g:/1/client/src/composables/useI18nV2.ts)
  - `loadLangPack(lang)` — 按需加载语言包，`_loadedLangs` Set 缓存
  - `clearLangCache()` — 清除缓存

### P11-7: Playwright 测试 + 修复 ✅
- 测试文件: [client/e2e/p10-i18n.spec.ts](file:///g:/1/client/e2e/p10-i18n.spec.ts) — 28 个测试
  - P10: 22 个 (跨视口渲染、9 语言表、RTL 切换、复数、格式化、差异对比、axe-core、键盘交互)
  - P11: 6 个 (TM 搜索、TM RTL axe-core、MT 区域、MT 翻译+审核、MT RTL axe-core)

## 二、关键问题修复

### 1. p10-i18n.spec.ts 在 archive 目录被 testIgnore 排除
- **原因**: 测试文件被误放到 `e2e/archive/` 目录，被 `testIgnore: ['**/archive/**']` 排除
- **修复**: 将文件恢复到 `e2e/` 根目录

### 2. Service Worker 拦截 GET 请求导致 page.route 失效
- **原因**: PWA 注册的 Service Worker 拦截了 GET 请求，导致 Playwright 的 `page.route` 无法拦截 GET 请求 (POST 请求不受影响)
- **症状**: GET `/api/v1/i18n-v2/languages` 返回 500 (Vite proxy 转发到未运行的后端)，POST `/api/v1/i18n-v2/format` 被 mock 正常拦截
- **修复**: 在 `playwright.config.ts` 的 chromium launchOptions 中添加 `--disable-features=ServiceWorker`

### 3. Token 键名不匹配
- **原因**: `getUserToken()` 优先从 `user_token` 键读取，但测试只设置了 `token` 键
- **修复**: 在 `bootstrapAuth()` 中同时设置 `token`、`user_token`、`user_data` (含 `thirdPartyAccounts.accessToken`)

### 4. axe-core `scrollable-region-focusable` 违规
- **原因**: `.i18n-log-list` 有 `overflow-y: auto` 但不可聚焦
- **修复**: 添加 `tabindex="0"` 和 `role="list"` 属性

### 5. axe-core `listitem` 违规
- **原因**: 初次修复用了 `role="log"`，导致 `<li>` 父元素不再是 `role="list"`
- **修复**: 改为 `role="list"`

### 6. `.i18n-tm-input` 选择器匹配多个元素
- **原因**: TM 搜索框、MT 源文本框、MT 目标语言 select 都使用了 `.i18n-tm-input` 类
- **修复**: 测试中使用 `.first()` 精确定位

## 三、测试结果汇总

| 测试类型 | 数量 | 结果 |
|---------|------|------|
| 后端 pytest (i18n_v2 + v1_retirement) | 112 | ✅ 全通过 |
| 前端 vitest (useI18nV2 + I18nDashboard + LanguageSwitcher) | 32 | ✅ 全通过 |
| Playwright (P10+P11 i18n) | 28 | ✅ 全通过 |
| **合计** | **172** | **✅ 全通过** |

## 四、修改文件清单

### 后端
- [server/app/i18n_v2/__init__.py](file:///g:/1/server/app/i18n_v2/__init__.py) — TM + MT 模块
- [server/app/api/i18n_v2_router.py](file:///g:/1/server/app/api/i18n_v2_router.py) — TM + MT 端点
- [server/tests/test_i18n_v2.py](file:///g:/1/server/tests/test_i18n_v2.py) — TM + MT 测试
- [server/tests/test_v1_retirement.py](file:///g:/1/server/tests/test_v1_retirement.py) — V1 退役测试 (新建)

### 前端
- [client/src/composables/useI18nV2.ts](file:///g:/1/client/src/composables/useI18nV2.ts) — TM + MT + 懒加载方法
- [client/src/views/I18nDashboard.vue](file:///g:/1/client/src/views/I18nDashboard.vue) — TM + MT UI + axe-core 修复
- [client/src/components/i18n/LanguageSwitcher.vue](file:///g:/1/client/src/components/i18n/LanguageSwitcher.vue) — RTL 对比度修复
- [client/e2e/p10-i18n.spec.ts](file:///g:/1/client/e2e/p10-i18n.spec.ts) — P10+P11 测试 (从 archive 恢复 + 修复)
- [client/playwright.config.ts](file:///g:/1/client/playwright.config.ts) — SW 禁用 + testIgnore 修复
- [client/postcss.config.js](file:///g:/1/client/postcss.config.js) — Tailwind v4 修复
- [client/src/composables/__tests__/useI18nV2.test.ts](file:///g:/1/client/src/composables/__tests__/useI18nV2.test.ts) — mock 数据结构修复
- [client/src/views/__tests__/I18nDashboard.test.ts](file:///g:/1/client/src/views/__tests__/I18nDashboard.test.ts) — mock 数据结构修复
- [client/src/components/i18n/__tests__/LanguageSwitcher.test.ts](file:///g:/1/client/src/components/i18n/__tests__/LanguageSwitcher.test.ts) — mock 数据结构修复
