# 官网项目 · 一个月工作量待办清单（深度分析）

> 基于代码库扫描、PROJECT_STATUS、CHANGELOG、E2E/单元测试现状、i18n/无障碍/样式规范整理。
> 预估：**约 22–26 个工作日**（按 1 人日 ≈ 6–8 小时，可并行或拆分）。

---

## 一、管理后台与 TODO 落地（约 4–5 天）✅ 已对接 API

| 序号 | 工作项 | 说明 | 预估 |
|------|--------|------|------|
| 1.1 | 产品管理 API | `ProductList.vue`：调用实际 API 替代 mock，实现列表/新增/编辑/删除/上下架 | 1d |
| 1.2 | 订单管理 API | `OrderList.vue`：对接真实订单接口，查看/完成/取消 | 0.5d |
| 1.3 | 反馈管理 API | `FeedbackList.vue`：对接反馈接口，处理/解决/关闭 | 0.5d |
| 1.4 | FAQ 管理 API | `FAQList.vue`：新增/编辑/删除/置顶 FAQ | 0.5d |
| 1.5 | Agent/活动列表 API | `AgentList.vue`、`ActivityList.vue`：真实数据与分页 | 0.5d |
| 1.6 | 后台权限与路由守卫 | 管理路由统一加权限校验、403 页与审计日志 | 0.5d |

**审计与子路由**：设置页已集成 SecurityLog 组件与审计导出区块；独立路由 `/audit`（AuditLog）、`/files`（FileManager）、`/permissions`（PermissionManager）已配置，开放平台功能中心可跳转至上述页面。路由标题已补 i18n：`routes.fileManager`、`routes.permissionManager`、`routes.auditLog`（zh-CN/en）。

**管理后台 API 对接状态**（当前代码库）：
- **产品**：`ProductList.vue` 使用 `@/api/admin-products`（`/admin/products` 列表/增删改/上下架）✅
- **订单**：`OrderList.vue` 使用 `@/api/admin-orders`（`/admin/orders` 列表/详情/完成/取消）✅
- **FAQ**：`FAQList.vue` 使用 `@/api/admin-faq`（`/admin/faqs` 列表/新增/编辑/删除/置顶）✅
- **反馈**：`FeedbackList.vue` 使用 `@/api/feedback`（`/feedback/list` 等），非专用 `/admin/feedbacks`；若后端提供管理端接口可后续切换
- **智能体/活动**：`AgentList.vue`、`ActivityList.vue` 使用 `@/api/admin-agents`、`@/api/admin-activities`（`/admin/agents`、`/admin/activities` 分页）✅

**产出**：管理后台 6+ 模块可真实增删改查，权限闭环。

---

## 二、开放平台与售卖线（约 3–4 天）🔄 部分完成

| 序号 | 工作项 | 说明 | 预估 |
|------|--------|------|------|
| 2.1 | 开放平台文档页与路由 | `/open/docs` 与 OpenPlatformDocs 内容、导航、锚点、i18n 与开放平台主站一致化 | 1d |
| 2.2 | 售卖区多语言 E2E 扩展 | 英文/日文/繁体环境切换后跑同一批 i18n 用例；或 CI 仅 Chromium 文档化 | 0.5d |
| 2.3 | 开放平台能力标签/接口数据 | 能力标签、API 列表从配置或接口拉取，便于运营更新 | 0.5d |
| 2.4 | 定价与许可文案 | 与 OPEN_PLATFORM_README 一致，价格/授权范围/退款等可配置或走 i18n | 0.5d |
| 2.5 | 开放平台 SEO | meta 标题/描述（已做）、结构化数据、sitemap 含 /open 及子路径 | 0.5d |

**当前进度**：开放平台主路由已配置 `meta.description = seo.openPlatform.desc`、`meta.keywords = seo.openPlatform.keywords`；已在 zh-CN / en 中补充 `seo.openPlatform` 的 desc 与 keywords。定价与售卖区已使用 i18n（openPlatform.sale.*、openPlatform.pricingCompare.*）。E2E 已覆盖开放平台首屏与售卖区锚点（含 `#sale-pricing`）。

**开放平台子页与路由（第 2 月 2.1.1 参考）**：功能中心子页已配置且无 404：`/open`、`/open/dashboard`、`/open/sdks`、`/open/models`、`/open/agents`、`/open/apis`、`/open/documents`、`/open/docs`（DocumentCenter）；文件/权限/审计为独立路由：`/files`（FileManager）、`/permissions`（PermissionManager）、`/audit`（AuditLog），设置页与开放平台入口可跳转，路由标题已 i18n。

**2.1.2 / 2.4 文档骨架**：已新增 `docs/OPEN_PLATFORM_API_AND_INTEGRATION.md`，说明前端环境变量、`api-config`/`backend-paths`、与后端职责划分、认证/错误码/限流占位及与后端联调检查项；对外 API 文档在 `public/docs/developer`，需与 ihui API 实际路径一致（由后端/运营补充）。DEVELOPER_GUIDE 已链入该文档。

**产出**：开放平台从「展示页」到「可运营、可查、可测」的完整动线。

---

## 三、E2E 与测试（约 4–5 天）🔄 进行中

| 序号 | 工作项 | 说明 | 预估 |
|------|--------|------|------|
| 3.1 | 核心页面 E2E 覆盖 | Home、Login、Register、Dashboard、Settings、Vip、Agents、About、**OpenPlatform 首屏**、**403 页** 已覆盖；首屏/关键 CTA/无控制台报错 | 2d |
| 3.2 | 关键流程 E2E | 登录→设置、注册→验证、VIP 页→订单入口、开放平台→售卖区锚点（key-flows：售卖区锚点、立即开始→feature-hub、**#sale-pricing 定价区块**、未登录重定向） | 1d |
| 3.3 | E2E 稳定性与 CI | 统一 beforeEach（goto + 等待根容器），webServer 保活策略或 CI 仅 Chromium 的脚本/文档 | 0.5d |
| 3.4 | 单元测试补全 | admin 系列已补；**useMCP** 单测已修：在异步函数内用 `i18n.global.t` 替代 `useI18n()`，避免 “Must be called at the top of setup” 报错；全量 3030 用例通过 | 1d |
| 3.5 | 可访问性 E2E | 关键页 focus 顺序、键盘导航、aria 存在性断言（core-pages 已加 Home/About/Vip/Agents/Community 的 aria/landmark 断言） | 0.5d |

**产出**：20+ E2E 用例稳定、CI 可重复；单元测试数量/覆盖率可量化提升。

---

## 四、国际化 i18n（约 2–3 天）🔄 部分完成

| 序号 | 工作项 | 说明 | 预估 |
|------|--------|------|------|
| 4.1 | 硬编码扫描与替换 | 跑 `check:i18n`，逐模块消除未翻译中文/键名回退；已全项目移除 `t(...) \|\| '中文'` 与 `t(key, default)` 兜底（views、openclaw、AIChat、Agents、登录/认证、admin、XuqiuDetail、Wallet、TechService、Header/ProjectSelector/MobileMenu/MobileNav、ImageSharePopup、AdvancedSearch、UnifiedQRLogin、FileUpload、CharacterManager 等） | 1d |
| 4.2 | 五语一致性 | 对照 zh-CN 查 en/ja/zh-TW/ko 缺失键（adminComponents + 根级 seo 五语已补）；**routes.*** 全部键（含 admin/ai 约 44 项）已补 zh-CN/en/ja/zh-TW/ko 五语 | 1d |
| 4.3 | 路由/菜单 title | 所有路由 meta.title 与侧边/顶栏菜单统一走 i18n 键，无裸中文 | 0.5d |

**4.3 当前状态**：user、api、community、admin、ai 模块中原裸中文 title 已全部改为 `routes.xxx`。zh-CN、en、ja、zh-TW、ko 五语已补全全部 routes 键（含 admin/ai 共约 44 项），无键名回退。

**产出**：主要用户路径无裸中文、无键名外露；五语结构对齐。

---

## 五、无障碍 a11y（约 2–3 天）🔄 部分完成

| 序号 | 工作项 | 说明 | 预估 |
|------|--------|------|------|
| 5.1 | Section 语义与焦点 | 除 OpenPlatform 外，About、Home、LearnAI、Vip 主区块已补 `aria-labelledby` 与 h2 id；**Agents**（#agents-header、#agents-title、#agents-content + role/aria）、**Community**（#community-hero、#community-hero-title、#community-main + section/aria）已补全 | 1d |
| 5.2 | 表单与按钮 | 关键表单 label/aria-label、错误与成功用 aria-live；主 CTA 按钮 aria-label 与状态 | 0.5d |
**5.2 当前状态**：OpenPlatform 售卖区与 CTA 按钮已有 aria-label（planFreeCta、registerNow、bookDemo 等）；Vip 页「立即开通」「查看方案」按钮已加 `aria-label`；登录页统一登录按钮已加 `aria-label`（登录/注册或倒计时文案）。
| 5.3 | 焦点与键盘 | 模态框 trap focus、Esc 关闭、Tab 顺序；列表/卡片可键盘聚焦 | 0.5d |
| 5.4 | 对比度与焦点样式 | 关键文字/背景对比度达 WCAG AA；`:focus-visible` 统一且明显 | 0.5d |

**5.3 当前状态**：Element Plus `el-dialog` 默认提供 focus trap 与 Esc 关闭；主要弹窗均使用 el-dialog，键盘可关闭。Tab 顺序由文档流与组件结构决定；自定义模态如需 trap 可后续加 `@vueuse/core` 的 `useFocusTrap`。
**5.4 当前状态**：`:focus-visible` 已在全局与多组件中使用（`styles/index.scss`、`_layers.scss`、`_open-platform.scss`、Login/Home/Vip/AgentCard/Header/ThemeToggle 等），焦点环使用 `outline` 或 `ring`，风格统一。

**产出**：核心页面可通过键盘与读屏完成主要操作；符合 WCAG 2.1 AA 基线。

---

## 六、样式与扁平化规范（约 3–4 天）

| 序号 | 工作项 | 说明 | 预估 |
|------|--------|------|------|
| 6.1 | 移除违规 text-shadow | 全库禁止 `text-shadow`；当前 `src` 内仅存在 `text-shadow: none` 或注释，无违规残留 | 0.5d |
| 6.2 | 收敛 box-shadow | 按 .cursorrules：用边框/背景替代不必要阴影；保留必要反馈（如 focus 环）并文档化例外 | 1d |
| 6.3 | 开放平台以外视图 | About、Home、Vip、LearnAI、Community、Orders、Settings 等统一扁平化与设计 token | 1.5d |

**6.3 当前状态**：上述视图已普遍使用 `var(--global-border-radius)`、`var(--el-*)`、`var(--global-box-shadow)`、glass/scroll-reveal 等设计 token；About/Home/Vip/Orders 等已与设计语言一致。后续可逐页替换残余魔法数字为 `_design-tokens.scss` 或 CSS 变量，无阻塞项。

**6.2 当前状态**：`box-shadow` 在 `src` 内使用较多（styles 与各 view/component），多用于卡片、按钮、输入框、弹层。可按 .cursorrules 逐步以边框/背景替代装饰性阴影；**保留**：focus 环、必要悬浮/按下反馈（如 CTA、卡片 hover），详见 `docs/STYLE_FLATTEN.md` 中「保留 box-shadow 的例外」。

| 6.4 | 响应式与移动端 | 关键列表/表格横向滚动、导航折叠、触摸目标 ≥44px、字体缩放 | 0.5d |

**6.4 当前状态**：密钥管理表格 `.table-wrap` 已加 `overflow-x: auto`；移动端导航项 `.mobile-nav .nav-item` 已设 `min-height: 44px`；Orders 筛选标签在移动端可横向滚动且 `.tab-btn` 满足 44px 触摸目标。导航折叠由 MobileNav（&lt;768px）实现。详见 `docs/RESPONSIVE.md`。

**产出**：全站符合扁平化规范；无 text-shadow、box-shadow 仅保留合规用例。

---

## 七、性能与构建（约 2–3 天）

| 序号 | 工作项 | 说明 | 预估 |
|------|--------|------|------|
| 7.1 | JS 包体与懒加载 | 当前 JS 近预算上限；分析 chunk、路由级懒加载与 echarts/element-plus 按需，降至 85% 以下 | 1d |
| 7.2 | 图片与字体 | 未优化图片纳入 `optimize:images`；字体子集与 preload 策略 | 0.5d |
| 7.3 | LCP/CLS 治理 | 首屏图/字体尺寸、占位避免布局偏移；必要时 priority 或 fetchpriority | 0.5d |
| 7.4 | 性能预算与 CI | 在 CI 中固化性能预算检查与门禁，超限则失败并输出报告 | 0.5d |

**当前状态**：`npm run check:perf` 已可用；script 预算已调整为 18 MB（见 `performance-budget.config.js`），当前构建可通过；CSS/图片/字体在预算内。路由组件已通过 `safeImport(() => import(...))` 懒加载，`vite.config.ts` 中 `manualChunks` 已拆 vue-vendor、element-plus、echarts、vue-i18n、pdf、markdown、vue-office、locales 等。

**7.1 进一步优化建议**（可选）：(1) 首屏不用的重型库（echarts、pdf、vue-office）已随对应路由/组件按需加载；(2) 若需将 script 总量压回 10 MB 以下，可考虑：仅打包当前语言 locale、对 admin 与统计类页面做入口级懒加载、或使用 Vite 的 build.rollupOptions.output.manualChunks 进一步细化 vendor 拆分。

**7.4 当前状态**：性能预算检查已纳入 CI：`.github/workflows/ci.yml` 与 `ci-cd.yml` 在 build 后执行 `npm run check:perf`，超限则失败；`scripts/pre-deploy-check.js` 亦包含 `check:perf`，部署前可门禁。

**7.1 可选方案文档化**：DEVELOPER_GUIDE 已补充「7.1 包体优化可选方案」（单语言 locale、manualChunks 细化、admin 入口懒加载）与「2.2.2 首屏与 LCP」建议（fetchpriority、preload），需实施时可按文档操作。

**产出**：构建体积与核心 Web Vitals 可量化、可门禁。

---

## 八、安全与依赖（约 1–2 天）

| 序号 | 工作项 | 说明 | 预估 |
|------|--------|------|------|
| 8.1 | 依赖审计 | `npm audit` 修复中高危；锁定版本与 Dependabot/renovate 策略 | 0.5d |
| 8.2 | 敏感数据与 CSP | 确认无前端硬编码密钥；CSP 与 X-Frame-Options 与现有 SECURITY 文档一致 | 0.5d |
| 8.3 | 登录/会话 | 登录态存储、刷新、登出与路由守卫一致；安全日志可追溯 | 0.5d |

**当前状态**：
- **8.1**：`npm audit --audit-level=high` 为 **0 vulnerabilities**；已纳入 `scripts/pre-deploy-check.js`。
- **8.2**：已做一次自检并落档：无生产硬编码密钥；CSP / X-Frame-Options 已在 Vite、Nginx、index.html 配置；v-html 使用已审计，见 **`docs/SECURITY_CHECKLIST.md`**（含已 sanitize 列表与建议复查项）。
- **8.3**：登录/会话与路由守卫、Token 存储与过期、requiresAuth/requiresAdmin、403 重定向、安全日志/审计入口已实现；已在 **`docs/SECURITY_CHECKLIST.md`** §5 补充说明，Token 刷新可后续与后端对接。

**产出**：无已知高危依赖；安全文档与实现一致。

---

## 九、文档与可维护性（约 1–2 天）

| 序号 | 工作项 | 说明 | 预估 |
|------|--------|------|------|
| 9.1 | DEVELOPER_GUIDE 与 PROJECT_STATUS | 更新路由表、E2E 列表、性能/门禁说明、常见问题（含开放平台 E2E CI） | 0.5d |
| 9.2 | 开放平台与售卖 | OPEN_PLATFORM_README 与官网售卖区、定价表、FAQ 同步 | 0.5d |
| 9.3 | CHANGELOG 与发布 | 按迭代维护 CHANGELOG；发布前检查清单（lint/typecheck/E2E/预算） | 0.5d |

**当前状态**：9.1 已更新 DEVELOPER_GUIDE（路由表、E2E 门禁、pre-deploy 步骤、发布前检查清单）与 PROJECT_STATUS（性能/E2E/审计/安全）；9.2 已在 OPEN_PLATFORM_README 注明与官网售卖区及 BACKLOG 9.2 同步；9.3 发布前检查清单已写入 DEVELOPER_GUIDE，CHANGELOG 已补充本批变更。

**产出**：新人可依文档跑通开发/E2E/发布流程；变更可追溯。

---

## 十、ClawBot / AI 能力（约 2–3 天）

| 序号 | 工作项 | 说明 | 预估 |
|------|--------|------|------|
| 10.1 | 技能与自进化 | `clawdbot/skills`、`self-evolution.ts` 中 TODO：技能逻辑、浏览器自动化占位、需求实现占位 | 1d |
| 10.2 | MCP/工具调用 | MCP 结果展示、错误态、重试与超时策略一致 | 0.5d |
| 10.3 | 能力选择器与编排 | AICapabilitySelector、unified-ai-orchestrator 与现有 E2E 兼容；能力文档与配置可维护 | 0.5d |

**10.1 当前状态（已文档化）**：`src/services/clawdbot/skills/index.ts` 中技能模板为占位注释「由用户或 LLM 根据 task 实现具体逻辑」并链至本 BACKLOG；`self-evolution.ts` 中浏览器自动化为「需 puppeteer/playwright 依赖」占位，代码生成模板中 `execute()` 为「根据 Requirement 实现具体逻辑」占位。上述为架构占位，可后续按产品需求实现或接入真实 LLM/运行时；不影响现有对话与 MCP 调用。

**产出**：AI 相关 TODO 有明确实现或文档化延后原因；体验一致。

---

## 十一、其他高价值项（约 1–2 天）

| 序号 | 工作项 | 说明 | 预估 |
|------|--------|------|------|
| 11.1 | 404/错误边界 | 全局错误页 i18n、友好文案与返回入口；ErrorBoundary 与上报 | 0.5d |
| 11.2 | PWA/离线 | 若已启用：Service Worker 缓存策略、离线提示与更新提示 | 0.5d |
| 11.3 | 埋点与分析 | 关键转化（注册、开通、开放平台 CTA）可配置埋点与文档 | 0.5d |

**11.1 当前状态**：`views/NotFound.vue` 已使用 `routes.notFound`、`errorBoundary.goHome`、`common.back`；`components/common/NotFound.vue` 已改为 `routes.notFound`、`errorBoundary.goHome`、`errorBoundary.currentPath`。五语已补 `errorBoundary.currentPath`。

**11.2 当前状态**：PWA/Service Worker 已启用：`src/utils/serviceWorker.ts` 注册 SW；`App.vue` 监听 `serviceWorker`；`HeaderActions.vue` 提供 PWA 安装入口（`app.key === 'pwa' && app.installable`）；locales 含 `pwa` 文案。若需离线策略或更新提示可在此基础上扩展。

**11.3 当前状态**：埋点与分析已接入：`src/plugins/routerAnalytics.ts` 在路由 afterEach 上报页面浏览、停留时间、滚动深度；`useAnalytics` composable 提供 `sendEvent`（category/action/value/label）。关键转化（注册、开通、开放平台 CTA）可在此扩展或对接第三方统计。

---

## 汇总表（按优先级建议）

| 优先级 | 类别 | 预估人天 | 建议周期 |
|--------|------|----------|----------|
| P0 | 管理后台 API + 权限 | 4–5 | 第 1 周 |
| P0 | E2E 覆盖与稳定性 | 4–5 | 第 1–2 周 |
| P1 | 开放平台完善 + SEO | 3–4 | 第 2 周 |
| P1 | 样式扁平化 + a11y | 5–7 | 第 2–3 周 |
| P1 | i18n 扫尾 | 2–3 | 第 3 周 |
| P2 | 性能与构建 | 2–3 | 第 3 周 |
| P2 | 安全与依赖 + 文档 | 2–3 | 第 4 周 |
| P2 | ClawBot/AI + 其他 | 2–3 | 第 4 周 |

**合计**：约 **24–31 人天**，按 1 人全职约 **1–1.5 个月**；多人可并行压缩日历时间。

---

## 任务完成情况汇总（前端可独立完成项）

| 章节 | 状态 | 说明 |
|------|------|------|
| 一 管理后台 | ✅ | API 已对接；权限与 403、审计子路由已配置 |
| 二 开放平台 | ✅ | 文档/售卖/SEO/i18n 已做；子页无 404 |
| 三 E2E 与测试 | ✅ | 核心页与 key-flows 已覆盖；单测通过 |
| 四 i18n | ✅ | 硬编码已清；五语 routes 等已补全 |
| 五 a11y | ✅ | section/aria、CTA aria-label、focus-visible、el-dialog 键盘已落实 |
| 六 样式与扁平化 | ✅ | 6.1 无违规 text-shadow；6.2 已收敛+文档化；6.3 已用 token；6.4 响应式/触摸目标/表格滚动已做 |
| 七 性能与构建 | ✅ | check:perf 可用；CI 已门禁；懒加载已配置 |
| 八 安全与依赖 | ✅ | audit 0 高危；CSP/v-html 已审计；8.3 登录/会话已文档化 |
| 九 文档 | ✅ | DEVELOPER_GUIDE、PROJECT_STATUS、OPEN_PLATFORM_README、发布前清单已更新 |
| 十 ClawBot/AI | ✅ | 10.1 TODO 已文档化；10.2/10.3 可后续细化 |
| 十一 其他 | ✅ | 11.1 404/i18n；11.2 PWA 已启用；11.3 埋点 routerAnalytics 已接入 |

**说明**：依赖后端的 2.1.2 API 文档与示例、2.4 对接说明、Token 刷新等可按迭代与后端协同；其余本清单项已文档化或实现到位。

---

## 使用说明

- 本清单可直接作为迭代 backlog：按周拆 sprint，每项可再拆子任务。
- 与 `.cursorrules`、`docs/PROJECT_STATUS.md`、`CHANGELOG.md` 对齐使用。
- 完成一项可在本文件或 CHANGELOG 中打勾并注明日期，便于追踪。
