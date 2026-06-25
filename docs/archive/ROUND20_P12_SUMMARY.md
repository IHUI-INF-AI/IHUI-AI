# ROUND20 - P12 阶段总结报告

> ⚠️ **历史记录 / 已下线（2026-06-24）**
> 本报告所记录的 i18n v2 整套体系（导出导入/版本历史/批量操作/MT Provider/健康度/V1 退役监控）已下线。
> 当前项目 i18n 由 V1 前端静态 JSON（`client/src/locales`）+ `i18nLanguages.ts` 静态元数据统一承担。
> 本文档仅作为 P12 阶段的历史存档保留。

## 阶段概述

P12 阶段聚焦于 i18n 国际化体系的深化运营能力，覆盖翻译生命周期管理、批量运营工具、健康度监控、第三方 MT 集成与 V1 API 退役监控。本阶段在前端 I18nDashboard 中新增 6 个功能 section，后端新增 10 个 HTTP 端点，全链路测试通过。

## 任务清单

| 任务 | 状态 | 说明 |
|------|------|------|
| P12-1 i18n 翻译导出/导入 (XLIFF/CSV) | ✅ 完成 | 后端 export/import + 前端导出导入 UI |
| P12-2 i18n 翻译版本历史 | ✅ 完成 | push 自动记录版本 + 回滚能力 |
| P12-3 i18n 批量操作 | ✅ 完成 | 批量删除/状态/推送 |
| P12-4 MT 第三方翻译服务集成 | ✅ 完成 | Provider 抽象层 + 列表查询 |
| P12-5 i18n 健康度仪表盘 | ✅ 完成 | 覆盖率/MT 待审核/过期 key/健康分 |
| P12-6 RTL 深度布局审计 | ✅ 完成 | LanguageSwitcher 物理属性迁移到逻辑属性 |
| P12-7 V1 API 退役监控 | ✅ 完成 | 中间件命中计数 + 统计端点 |

## 后端实现

### 新增功能函数 ([server/app/i18n_v2/__init__.py](file:///g:/1/server/app/i18n_v2/__init__.py))

- **P12-1 导出/导入**: `export_translations()`, `import_translations()`, `_xml_escape()`, `_parse_csv()`, `_parse_xliff()`, `_xml_unescape()`
- **P12-2 版本历史**: `TranslationVersion` 数据类, `_VERSIONS` 字典, `_record_version()`, `get_translation_history()`, `rollback_translation()`
- **P12-3 批量操作**: `batch_delete_keys()`, `batch_set_status()`, `batch_push()`
- **P12-4 MT Provider**: `MTProvider` 枚举, `_MT_PROVIDER_CONFIG` 字典, `list_mt_providers()`, `get_current_mt_provider()`
- **P12-5 健康度**: `get_health()` — 覆盖率 70% + MT 队列惩罚 + 过期惩罚
- **P12-7 V1 退役监控**: `_V1_RETIREMENT_HITS` 字典, `record_v1_retirement_hit()`, `get_v1_retirement_stats()`

### 新增 HTTP 端点 ([server/app/api/i18n_v2_router.py](file:///g:/1/server/app/api/i18n_v2_router.py))

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/v1/i18n-v2/export` | 导出翻译 (CSV/XLIFF) |
| POST | `/api/v1/i18n-v2/import` | 导入翻译 |
| GET | `/api/v1/i18n-v2/entry/{key}/history` | 版本历史 |
| POST | `/api/v1/i18n-v2/rollback` | 回滚版本 |
| POST | `/api/v1/i18n-v2/batch/delete` | 批量删除 |
| POST | `/api/v1/i18n-v2/batch/status` | 批量设置状态 |
| POST | `/api/v1/i18n-v2/batch/push` | 批量推送 |
| GET | `/api/v1/i18n-v2/mt/providers` | MT provider 列表 |
| GET | `/api/v1/i18n-v2/health` | 健康度统计 |
| GET | `/api/v1/i18n-v2/v1-retirement-stats` | V1 退役监控 |

### 中间件集成 ([server/app/middleware/v1_retirement.py](file:///g:/1/server/app/middleware/v1_retirement.py))

在 `dispatch` 方法返回 410 响应前调用 `record_v1_retirement_hit(path)` 记录退役命中。

## 前端实现

### Composable 扩展 ([client/src/composables/useI18nV2.ts](file:///g:/1/client/src/composables/useI18nV2.ts))

新增 4 个接口类型: `MTProvider`, `TranslationVersion`, `HealthStat`, `V1RetirementStats`

新增 10 个方法:
- `exportTranslations(lang, fmt)` — 导出翻译
- `importTranslations(content, fmt, conflict, actor)` — 导入翻译
- `fetchHistory(key, lang)` — 获取版本历史
- `rollbackTranslation(key, lang, version, actor)` — 回滚版本
- `batchDelete(keys, actor)` — 批量删除
- `batchSetStatus(keys, lang, status, actor)` — 批量设置状态
- `batchPush(items, actor)` — 批量推送
- `listMtProviders()` — MT provider 列表
- `fetchHealth()` — 健康度统计
- `fetchV1RetirementStats()` — V1 退役监控

### UI 扩展 ([client/src/views/I18nDashboard.vue](file:///g:/1/client/src/views/I18nDashboard.vue))

新增 6 个 section:
1. **i18n 健康度仪表盘** — 健康分 + 5 个统计卡片 (总 key/语言数/覆盖率/MT 待审核/过期 key)
2. **翻译导出 / 导入** — 双栏布局, 支持 CSV/XLIFF 格式选择, 冲突策略 (覆盖/跳过)
3. **翻译版本历史** — key + 语言查询, 版本列表 + 回滚按钮
4. **批量操作** — 批量删除/状态/推送, tab 分隔输入
5. **MT 服务 & V1 退役监控** — MT provider 列表 + V1 退役命中统计

### RTL 深度布局审计 ([client/src/components/i18n/LanguageSwitcher.vue](file:///g:/1/client/src/components/i18n/LanguageSwitcher.vue))

- `text-align: right` → `text-align: start` (逻辑属性, 自动适配 LTR/RTL)
- I18nDashboard.vue 已使用逻辑属性, 无需迁移

## 测试验证

### 后端测试 (pytest)

```
cd g:\1\server ; python -m pytest tests/test_i18n_v2.py tests/test_v1_retirement.py --tb=short -q
```

**结果**: 161 passed (新增 49 个 P12 测试)

新增测试类:
- `TestExportImport` — 10 个测试 (CSV/XLIFF 导出、导入、覆盖/跳过、特殊字符、roundtrip)
- `TestExportImportHTTP` — 3 个 HTTP 端点测试
- `TestVersionHistory` — 7 个测试 (版本创建、多版本、noop、空、回滚、不存在、按语言)
- `TestVersionHistoryHTTP` — 3 个 HTTP 端点测试
- `TestBatchOperations` — 5 个测试 (删除、状态、推送、无效项)
- `TestBatchHTTP` — 3 个 HTTP 端点测试
- `TestMTProviders` — 4 个测试 (列表、可用性、默认 provider)
- `TestMTProvidersHTTP` — 1 个 HTTP 端点测试
- `TestHealth` — 7 个测试 (结构、语言数、覆盖率、MT 待审核、分数范围)
- `TestHealthHTTP` — 1 个 HTTP 端点测试
- `TestV1RetirementStats` — 4 个测试 (记录、清除、结构、ENV)
- `TestV1RetirementStatsHTTP` — 1 个 HTTP 端点测试

### 前端单元测试 (vitest)

```
cd g:\1\client ; npx vitest run src/views/__tests__/I18nDashboard.test.ts
```

**结果**: 8 passed (更新 mock 支持 P12 新 API)

### Playwright E2E 测试

```
cd g:\1\client ; npx playwright test e2e/p12-i18n.spec.ts --reporter=line
```

**结果**: 24 passed (chromium + Mobile Chrome 各 12 个)

测试覆盖:
- 健康度仪表盘渲染 (2)
- 导出 / 导入 (2)
- 版本历史 (1)
- 批量操作 (2)
- MT Provider & V1 退役监控 (2)
- axe-core 严重违规检测 LTR/RTL/mobile (3)

### P10 回归测试

```
cd g:\1\client ; npx playwright test e2e/p10-i18n.spec.ts --reporter=line --workers=2
```

**结果**: 7 passed + 2 flaky (axe-core RTL 偶发, 重试通过)

## 样式规范遵循

- ✅ 未使用 `!important`
- ✅ 未使用高特异性选择器, 仅使用项目全局 CSS 变量 (`var(--el-*)`, `var(--border-unified-color)`, `var(--global-border-radius)`)
- ✅ 每种容器类型样式唯一 (`.i18n-health-card`, `.i18n-io-block`, `.i18n-batch-block` 等)
- ✅ 代码精简直接, 无复杂嵌套

## 后续开发建议

### P13 阶段候选任务

1. **i18n 翻译工作流审批** — 多级审核流 (草稿 → 待审 → 已审 → 发布), 支持审核人指派与通知
2. **i18n 翻译质量评分** — 基于 TM 相似度、MT 置信度、历史回滚率计算质量分, 低质量自动标记
3. **i18n 翻译上下文管理** — 为每个 key 关联截图/上下文描述, 帮助译者理解使用场景
4. **MT Provider 动态切换** — 支持运行时切换 MT provider (DeepL/Google/Azure), 配置 API key
5. **i18n A/B 测试** — 同一 key 多版本翻译在线 A/B 测试, 基于用户反馈选择最优译文
6. **V1 API 退役告警** — 命中数超过阈值时自动告警 (邮件/飞书), 生成退役进度报告
7. **i18n 翻译 CDN 分发** — 翻译包打包后上传 CDN, 客户端按需拉取, 减少首屏加载时间
8. **i18n 翻译差异可视化** — 版本历史间差异高亮显示 (新增/删除/修改), 类似 Git diff
