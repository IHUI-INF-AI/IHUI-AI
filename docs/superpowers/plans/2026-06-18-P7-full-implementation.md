# P7 全量实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完美细致完整毫无遗漏地完成 P7 全部 8 个方向的实现、测试与验证

**Architecture:** 8 个方向并行实施，每个方向包含后端 API + 前端组件/页面 + 测试，覆盖全部交付物

**Tech Stack:** 
- 后端: FastAPI (Python 3.11+), OpenTelemetry, Alembic/SQLAlchemy
- 前端: Vue 3, TypeScript, Element Plus, Canvas/SVG, IndexedDB, ARIA
- 测试: Vitest, Pytest, Playwright
- CI/CD: GitHub Actions, Blue-Green Deploy, Canary

---

## 方向总览

| # | 方向 | 后端文件 | 前端组件/页面 | 测试 |
|---|------|---------|-------------|------|
| 1 | AI 能力可视化 | 3 API | 2 Vue + 1 组件 | 12 vitest + 8 pytest |
| 2 | 国际化深化 | 1 API | 9 语言包 + RTL | 6 vitest + 4 pytest |
| 3 | 离线优先 | 2 API | 3 composable + 页面 | 10 vitest + 6 pytest |
| 4 | 可观测性 v2 | 4 API + Otel | 2 页面 + dashboard | 8 pytest |
| 5 | 安全审计 | 3 API | 2 页面 + 组件 | 10 pytest |
| 6 | CI/CD 增强 | Workflows | 前端 e2e | 4 e2e |
| 7 | A11y 增强 | - | 4 组件 + 页面 | 8 vitest + 6 Playwright |
| 8 | 业务侧 BI | 3 API | 3 页面 + 图表 | 8 pytest + 6 vitest |

**总测试目标**: vitest 44+, pytest 34+, Playwright 38+ = 116+ 测试用例全部通过

---

## 方向 1: AI 能力可视化

### 1.1 后端 API

**Files:**
- Create: `server/app/api/v1/ai/agent_graph.py` - 智能体关系图谱 API
- Create: `server/app/api/v1/ai/decision_tree.py` - 决策树可拖拽编辑 API
- Create: `server/app/services/ai_visualization_service.py` - 图谱/决策树服务

**Endpoints:**
```
GET  /api/v1/ai/agent-graph/{user_id}          获取智能体关系图谱
POST /api/v1/ai/agent-graph                    创建/更新图谱节点
POST /api/v1/ai/agent-graph/edges              添加/删除边
GET  /api/v1/ai/decision-tree/{tree_id}        获取决策树
POST /api/v1/ai/decision-tree                  创建决策树
PUT  /api/v1/ai/decision-tree/{tree_id}/nodes  更新节点位置(拖拽)
POST /api/v1/ai/decision-tree/{tree_id}/execute 执行决策树
```

### 1.2 前端组件

**Files:**
- Create: `client/src/views/ai/AgentGraph.vue` - 智能体关系图谱页面
- Create: `client/src/components/ai/DecisionTreeCanvas.vue` - 决策树可拖拽画布
- Create: `client/src/components/ai/AgentNodeCard.vue` - 图谱节点卡片
- Modify: `client/src/router/modules/ai.ts` - 添加路由

**Features:**
- D3.js 或 Cytoscape.js 渲染力导向图
- 节点: 智能体名称/类型/状态, 边: 调用关系/依赖关系
- 拖拽编辑决策树节点
- 缩放/平移/筛选
- 节点点击查看详情

### 1.3 测试

- Vitest: `client/src/components/ai/__tests__/AgentNodeCard.test.ts` × 12
- Pytest: `server/tests/test_ai_visualization.py` × 8

---

## 方向 2: 国际化深化

### 2.1 后端 API

**Files:**
- Create: `server/app/api/v1/i18n/sync.py` - 多语言同步 API

**Endpoints:**
```
GET  /api/v1/i18n/locales                     获取支持的语言列表
POST /api/v1/i18n/sync                       同步翻译(调用 LLM)
GET  /api/v1/i18n/{locale}/{module}          获取指定语言模块
PUT  /api/v1/i18n/{locale}/{module}/{key}   更新翻译 key
```

### 2.2 前端

**Files:**
- Create: `client/src/locales/ar.json` - 阿拉伯语(完整 RTL)
- Create: `client/src/locales/fr.json` - 法语
- Create: `client/src/locales/de.json` - 德语
- Create: `client/src/locales/es.json` - 西班牙语
- Create: `client/src/locales/pt.json` - 葡萄牙语
- Create: `client/src/locales/it.json` - 意大利语
- Create: `client/src/locales/ru.json` - 俄语
- Create: `client/src/locales/hi.json` - 印地语
- Modify: `client/src/locales/modules/index.ts` - 支持 9 种语言
- Create: `client/src/composables/useRtl.ts` - RTL 适配 composable
- Create: `client/src/styles/rtl.scss` - RTL 全局样式
- Create: `client/src/components/common/LanguageSelector.vue` - 语言选择器

**RTL 适配:**
- `<html dir="rtl">` 动态切换
- 图标水平翻转(mdiflip-horizontal)
- 列表顺序反转
- 表单对齐方向翻转

### 2.3 测试

- Vitest: `client/src/composables/__tests__/useRtl.test.ts` × 6
- Pytest: `server/tests/test_i18n_sync.py` × 4

---

## 方向 3: 离线优先

### 3.1 后端 API

**Files:**
- Create: `server/app/api/v1/offline/sync.py` - 离线数据同步 API
- Create: `server/app/services/offline_sync_service.py` - 同步服务

**Endpoints:**
```
POST /api/v1/offline/sync                     批量同步离线数据
GET  /api/v1/offline/changes/{since}         获取变更(增量同步)
POST /api/v1/offline/crdt/merge               CRDT 合并冲突解决
GET  /api/v1/offline/status                  同步状态查询
```

### 3.2 前端

**Files:**
- Create: `client/src/composables/useOfflineDB.ts` - IndexedDB composable
- Create: `client/src/composables/useSyncEngine.ts` - 同步引擎 composable
- Create: `client/src/composables/useCRDT.ts` - CRDT 冲突解决 composable
- Create: `client/src/views/OfflineManager.vue` - 离线管理页面
- Create: `client/src/stores/offline.ts` - 离线状态 store

**IndexedDB 表设计:**
- `wallets`: 钱包余额/交易
- `refunds`: 退款申请/状态
- `agents`: 智能体配置
- `messages`: 聊天消息
- `sync_log`: 同步日志(CRDT vector clock)

**CRDT 实现:**
- LWW(Last-Writer-Wins) 注册表
- OR-Set 用于标签/收藏
- 冲突自动合并, 无法合并则标记人工审核

### 3.3 测试

- Vitest: `client/src/composables/__tests__/useOfflineDB.test.ts` × 10
- Pytest: `server/tests/test_offline_sync.py` × 6

---

## 方向 4: 可观测性 v2

### 4.1 后端 API + OpenTelemetry

**Files:**
- Create: `server/app/core/telemetry.py` - OpenTelemetry 初始化
- Create: `server/app/api/v1/observability/traces.py` - Trace 查询 API
- Create: `server/app/api/v1/observability/metrics.py` - Metrics API
- Create: `server/app/api/v1/observability/spans.py` - 业务 span API
- Modify: `server/app/main.py` - 集成 OpenTelemetry

**Endpoints:**
```
GET  /api/v1/observability/traces             查询链路 traces
GET  /api/v1/observability/traces/{trace_id} 获取单个 trace
GET  /api/v1/observability/metrics            时序 metrics
GET  /api/v1/observability/spans              业务 spans
POST /api/v1/observability/spans             上报业务 span
```

**Span 语义约定:**
- `http.request`: HTTP 请求
- `db.query`: 数据库查询
- `ai.inference`: AI 推理
- `business.refund`: 退款业务
- `business.reconcile`: 对账业务
- `user.action`: 用户行为

### 4.2 前端

**Files:**
- Create: `client/src/views/admin/ObservabilityDashboard.vue` - 可观测性大盘
- Create: `client/src/components/observability/TraceList.vue` - Trace 列表
- Create: `client/src/components/observability/SpanDetail.vue` - Span 详情
- Modify: `client/src/router/modules/admin.ts` - 添加路由

**Features:**
- 瀑布图展示 trace 时序
- Span 详情(耗时/标签/事件)
- 错误高亮(红色)
- 慢查询统计

### 4.3 测试

- Pytest: `server/tests/test_observability.py` × 8

---

## 方向 5: 安全审计

### 5.1 后端 API

**Files:**
- Create: `server/app/api/v1/security/privilege_check.py` - 越权检测 API
- Create: `server/app/api/v1/security/two_factor.py` - 二次验证 API
- Create: `server/app/api/v1/security/behavior_analysis.py` - 行为分析 API
- Create: `server/app/services/security_audit_service.py` - 安全审计服务

**Endpoints:**
```
POST /api/v1/security/privilege-check         越权检测(资源级权限校验)
POST /api/v1/security/2fa/send               发送二次验证码
POST /api/v1/security/2fa/verify             验证二次验证码
GET  /api/v1/security/behavior/{user_id}     获取用户行为画像
POST /api/v1/security/behavior/analyze        分析行为异常
GET  /api/v1/security/audit-log              查询审计日志
```

**越权检测逻辑:**
- 资源 owner 校验(user_id vs resource.owner_id)
- 角色权限矩阵校验
- 接口级权限校验
- 字段级数据脱敏

**行为分析:**
- 正常行为基线(时间/频率/操作类型)
- 异常分数(0-100)
- 风险等级: normal/suspicious/dangerous
- 告警阈值可配置

### 5.2 前端

**Files:**
- Create: `client/src/views/admin/SecurityAudit.vue` - 安全审计后台
- Create: `client/src/components/security/PrivilegeTree.vue` - 权限树
- Create: `client/src/components/security/TwoFactorDialog.vue` - 二次验证弹窗
- Create: `client/src/components/security/BehaviorChart.vue` - 行为分析图表
- Modify: `client/src/router/modules/admin.ts` - 添加路由

### 5.3 测试

- Pytest: `server/tests/test_security_audit.py` × 10

---

## 方向 6: CI/CD 增强

### 6.1 GitHub Actions Workflows

**Files:**
- Modify: `server/.github/workflows/blue-green-deploy.yml` - 蓝绿部署增强
- Create: `server/.github/workflows/canary-auto-rollout.yml` - Canary 自动 rollout
- Create: `server/.github/workflows/auto-rollback.yml` - 自动回滚 workflow
- Modify: `client/.github/workflows/e2e.yml` - 端到端测试增强

**Blue-Green 流程:**
1. 部署到 green 环境
2. 健康检查(3 次重试)
3. 切换流量(nginx/ingress)
4. 监控 5 分钟
5. 若异常则回滚

**Canary 流程:**
1. 灰度 5% → 15% → 30% → 50% → 100%
2. 每阶段等待 5 分钟, 检查错误率
3. 错误率超标则自动回滚

**自动回滚:**
- 触发条件: 错误率 > 1% 或 P99 延迟 > 2s
- 保留最近 3 个版本
- 一键回滚到上一个稳定版本

### 6.2 前端

**Files:**
- Modify: `client/e2e/canary-deploy.spec.ts` - Canary 部署验证

### 6.3 测试

- Playwright: `client/e2e/canary-deploy.spec.ts` × 4

---

## 方向 7: A11y 增强

### 7.1 后端

无需后端改动(前端主导)

### 7.2 前端

**Files:**
- Create: `client/src/composables/useScreenReader.ts` - 屏幕阅读器 composable
- Create: `client/src/components/common/AccessibilityMenu.vue` - 键盘导航菜单
- Create: `client/src/components/common/HighContrastToggle.vue` - 高对比度切换
- Create: `client/src/styles/a11y-high-contrast.scss` - 高对比度样式
- Modify: `client/src/App.vue` - 全局 A11y 注入
- Modify: `client/src/views/Wallet.vue` - 钱包页面无障碍
- Modify: `client/src/views/RefundDetail.vue` - 退款详情无障碍
- Modify: `client/src/views/MobileDashboard.vue` - 移动端大盘无障碍

**A11y 实现:**
- ARIA labels/roles Live Regions
- 键盘导航( Tab / Arrow / Enter / Escape)
- 跳过链接(Skip to content)
- 高对比度主题(CSS 变量切换)
- 焦点管理(Focus trap for dialogs)
- 屏幕阅读器公告(aria-live)

**高对比度配色:**
```scss
--hc-bg: #000;
--hc-fg: #fff;
--hc-accent: #ff0;
--hc-error: #f66;
```

### 7.3 测试

- Vitest: `client/src/composables/__tests__/useScreenReader.test.ts` × 8
- Playwright: `client/e2e/a11y.spec.ts` × 6

---

## 方向 8: 业务侧 BI

### 8.1 后端 API

**Files:**
- Create: `server/app/api/v1/bi/reports.py` - 自助报表 API
- Create: `server/app/api/v1/bi/drilldown.py` - 维度下钻 API
- Create: `server/app/api/v1/bi/anomaly.py` - 异常归因 API
- Create: `server/app/services/bi_service.py` - BI 服务

**Endpoints:**
```
GET  /api/v1/bi/reports                      报表列表
POST /api/v1/bi/reports                      创建报表配置
GET  /api/v1/bi/reports/{report_id}          执行报表
GET  /api/v1/bi/drilldown                    下钻数据
     ?dimension=agent&value=123&target=revenue
GET  /api/v1/bi/anomaly/attribution           异常归因分析
     ?metric=revenue&period=2024-W24
GET  /api/v1/bi/dimensions                    支持的维度列表
```

**支持维度:**
- agent_id / agent_name / category
- user_id / user_region
- time: hour / day / week / month
- channel: web / h5 / app
- status: success / failed / pending

**异常归因:**
- 同比/环比变化检测
- 维度贡献度计算
- Top-N 异常因子
- 自然语言归因描述

### 8.2 前端

**Files:**
- Create: `client/src/views/bi/SelfServiceReport.vue` - 自助报表页面
- Create: `client/src/views/bi/DrillDownExplorer.vue` - 下钻浏览器
- Create: `client/src/components/bi/AnomalyCard.vue` - 异常归因卡片
- Create: `client/src/components/bi/ChartRenderer.vue` - 图表渲染器
- Modify: `client/src/router/modules/admin.ts` - 添加路由

**图表类型:**
- 折线图(趋势)
- 柱状图(对比)
- 饼图(占比)
- 热力图(下钻)
- 散点图(关联)

### 8.3 测试

- Pytest: `server/tests/test_bi.py` × 8
- Vitest: `client/src/components/bi/__tests__/ChartRenderer.test.ts` × 6

---

## 测试汇总

| 方向 | Vitest | Pytest | Playwright | 合计 |
|------|--------|--------|-----------|------|
| 1. AI 可视化 | 12 | 8 | - | 20 |
| 2. 国际化 | 6 | 4 | - | 10 |
| 3. 离线优先 | 10 | 6 | - | 16 |
| 4. 可观测性 | - | 8 | - | 8 |
| 5. 安全审计 | - | 10 | - | 10 |
| 6. CI/CD | - | - | 4 | 4 |
| 7. A11y | 8 | - | 6 | 14 |
| 8. 业务 BI | 6 | 8 | - | 14 |
| 现有迁移 | 4 | 4 | 4 | 12 |
| **总计** | **46** | **48** | **14** | **108** |

---

## 执行顺序

### Phase 1: 并行实施 (方向 1-4)
- subagent-1: 方向 1 AI 可视化
- subagent-2: 方向 2 国际化
- subagent-3: 方向 3 离线优先
- subagent-4: 方向 4 可观测性

### Phase 2: 并行实施 (方向 5-8)
- subagent-5: 方向 5 安全审计
- subagent-6: 方向 6 CI/CD
- subagent-7: 方向 7 A11y
- subagent-8: 方向 8 业务 BI

### Phase 3: 整合与测试
- 合并所有变更
- 运行完整测试套件
- 生成 ROUND15_P7_SUMMARY.md
