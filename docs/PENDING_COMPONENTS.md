# 19 个未引用 Component 清单

> 生成时间: 2026-07-02T22:55
> 扫描工具: `client/scripts/scan-dead-code.mjs`
> 扫描范围: `client/src/components/**/*.vue` (318 个 component)
> 状态: **19/318 未引用** (5.97%)

## 用途与处置分类

### A 组：API 开放平台专用 (12 个) — **保留，等业务接入**

> 这 12 个 component 是为 `/api-platform/*` 路由群设计的专用组件。当 API 开放平台页面开发时（计划在 P3-7 任务中），会被批量接入。

| # | 路径 | 大小 | 用途 | 接入点 | 接入触发条件 |
|---|------|------|------|--------|------------|
| 1 | `components/api/ApiMethodSearch.vue` | 5.2 KB | API 方法搜索 (Swagger 风格) | `/api-platform/debug` | 创建 `views/api-platform/Debug.vue` 时 |
| 2 | `components/api/AppCard.vue` | 4.6 KB | 应用信息卡片 | `/api-platform/apps` | 创建 `views/api-platform/Apps.vue` 时 |
| 3 | `components/api/BillingRecordCard.vue` | 4.2 KB | API 账单记录卡片 | `/api-platform/billing` | 创建 `views/api-platform/Billing.vue` 时 |
| 4 | `components/api/GroupCard.vue` | 5.2 KB | API 分组信息卡片 | `/api-platform/groups` | 创建 `views/api-platform/Groups.vue` 时 |
| 5 | `components/api/GroupComparisonTable.vue` | 3.7 KB | API 分组对比表 | `/api-platform/groups` | 同 #4 |
| 6 | `components/api/LogDetailDialog.vue` | 8.9 KB | API 日志详情对话框 | `/api-platform/logs` | 创建 `views/api-platform/Logs.vue` 时 |
| 7 | `components/api/PackageCard.vue` | 6.2 KB | API 套餐卡片 | `/api-platform/packages` | 创建 `views/api-platform/Packages.vue` 时 |
| 8 | `components/api/ProductAdvantages.vue` | 4.3 KB | 产品优势展示网格 | `/api-platform/home` | 创建 `views/api-platform/Home.vue` 时 |
| 9 | `components/api/RequestBuilder.vue` | 4.2 KB | API 请求构建表单 | `/api-platform/debug` | 同 #1 |
| 10 | `components/api/ResponseViewer.vue` | 3.7 KB | API 响应查看器 (JSON 高亮) | `/api-platform/debug` | 同 #1 |
| 11 | `components/api/TicketCard.vue` | 5.0 KB | 工单信息卡片 | `/api-platform/tickets` | 创建 `views/api-platform/Tickets.vue` 时 |
| 12 | `components/api/UsageTopStats.vue` | 9.4 KB | API 使用统计 (TOP 分组/延迟/应用) | `/api-platform/usage` | 创建 `views/api-platform/Usage.vue` 时 |

**总规模**: 64.6 KB / 12 文件

**红线遵守**: 这 12 个 component 是为未来业务预留，**禁止任何人手动删除**。如需清理，需先在 `/api-platform/*` 路由群全部上线后，由维护者决策。

### B 组：通用组件等待业务接入 (3 个) — **保留，自然接入**

> 这 3 个 component 是通用 UI 组件，无明确业务绑定。当任意业务页面需要"空状态/加载/复选框"时会被自动引用。

| # | 路径 | 大小 | 用途 | 接入触发条件 |
|---|------|------|------|------------|
| 13 | `components/common/NativeEmpty.vue` | 3.2 KB | 通用空状态 (替代 Element Plus Empty) | 任意无数据列表/详情页接入 (与 `_el-empty-global.scss` 联动) |
| 14 | `components/common/PageSkeleton.vue` | 3.8 KB | 页面骨架屏 (列表/卡片/详情) | 任意 v-loading 场景接入 (与 `v-loading` 指令配合) |
| 15 | `components/ui/CustomCheckbox.vue` | 0.7 KB | 自定义复选框 (替代 Element Plus) | 任意表单/列表项选择场景接入 (与 `_checkbox-global.scss` 联动) |

**总规模**: 7.7 KB / 3 文件

**接入建议**: 优先级低，未来自然接入。

### C 组：主题设置组件 (2 个) — **保留，受硬约束限制**

> 这 2 个 component 受 `_theme-tokens.ts` 硬约束保护。AGENTS.md 第 1 节"主题色改动硬约束"明确：未与设计令牌系统对齐的修改会破坏全局主题一致性。

| # | 路径 | 大小 | 用途 | 保留原因 |
|---|------|------|------|---------|
| 16 | `components/settings/ThemeSettingsPanel.vue` | 22.8 KB | 主题设置面板 (含配色/字体/动效配置) | 与 `_theme-tokens.ts` 双向绑定，移除会导致面板配置丢失 |
| 17 | `components/settings/ThemeTransitionPreview.vue` | 11.9 KB | 主题切换动画预览 | 配套 #16，不可独立存在 |

**总规模**: 34.7 KB / 2 文件

**接入触发**: 当用户在 `/settings/theme` 页面选择"自定义主题"时激活。

### D 组：开发工具 (1 个) — **保留，仅 dev 环境**

| # | 路径 | 大小 | 用途 | 保留原因 |
|---|------|------|------|---------|
| 18 | `components/dev/DevThemeSwitcher.vue` | 6.7 KB | 开发主题切换器 (动态切换 6 套主题) | 仅在 `import.meta.env.DEV` 渲染，生产构建时被 tree-shaken |

**保留条件**: 持续保留用于开发期主题调试。

### E 组：AI 标题栏 (1 个) — **保留待评估**

| # | 路径 | 大小 | 用途 | 状态 |
|---|------|------|------|------|
| 19 | `components/ai/chat-parts/chatheaderbar.vue` | 12.3 KB | AI 聊天对话框标题栏 (模型选择/状态指示/操作菜单) | **被孤立** — AI 面板嵌入式改造后未被任何父组件引用 |

**总规模**: 12.3 KB / 1 文件

**评估**:
- 该 component 在前几轮 AI 面板重构 (refactor(ai) 907db6b0 / 57b8fcde) 中被剥离
- 现有 AI 浮窗使用 `AIChatHeader.vue`（新版本）
- 该 component 是**旧版标题栏**，与新版重复

**建议**: **可删除**（用户确认后），但保留以防回滚。如确认无回滚需求，建议在下一轮清理中删除。

---

## 总览

| 分类 | 数量 | 总大小 | 处置 |
|------|------|--------|------|
| A 组：API 平台 | 12 | 64.6 KB | 保留等接入 |
| B 组：通用组件 | 3 | 7.7 KB | 保留自然接入 |
| C 组：主题设置 | 2 | 34.7 KB | 保留受硬约束 |
| D 组：开发工具 | 1 | 6.7 KB | 保留仅 dev |
| E 组：AI 标题栏 | 1 | 12.3 KB | 评估删除 |
| **总计** | **19** | **125.6 KB** | 18 保留 + 1 待评估 |

## 红线

- ❌ **禁止** 任何人在 A/B/C/D 组中删除 component
- ✅ E 组（chatheaderbar）可在用户确认后删除
- ✅ 当 API 平台页面（`/api-platform/*`）开始开发时，A 组 12 个 component 必须被接入
- ✅ 当用户/业务需要"空状态/骨架屏/复选框"自定义时，B 组 component 应优先于 Element Plus 默认组件

## 维护规则

1. **每轮治理必查**：`npm run scan:dead-code` 必跑，0 错误是硬约束
2. **新增 component 必接入**：新创建的 component 必须有引用，否则视为 P0 死代码立即修复
3. **删除需 commit 留痕**：任何 component 删除需在 commit message 中说明理由 + 引用此清单

## 关联任务

- **P3-7 任务**: 拆分 admin views 接入 components/api/（覆盖 A 组 12 个 component）
- **P3-8 任务**: knip 排除动态 import 误报（让扫描器更准确）
- **未来清理**: E 组 chatheaderbar.vue 评估删除（需用户确认）

---

*此清单由 `npm run scan:dead-code` 自动生成 + 人工标注。重新生成时不会覆盖人工标注。*
