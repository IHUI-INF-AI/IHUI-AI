# ROUND15 P7 阶段总结

**主题**：A11y 增强（样式基线） + 可观测性 v2（业务 span 工厂）
**日期**：2026-06-18
**目录基线**：`g:\1\`

---

## 一、目标与收益

| 维度 | 阶段目标 | 关键收益 |
| --- | --- | --- |
| A11y | 钱包/退款核心页面达到 WCAG 2.1 AA | 屏读器、键盘、高对比度、强制色彩 4 套用户偏好全支持 |
| 可观测性 | 退款/Push/对账/预测 4 个核心业务全链路 trace | span 名规范 `biz.<domain>.<action>`，失败有 ERROR status + 内存事件 |
| 样式合规 | 0 `!important`、0 高特异性选择器 | 全部使用 `:where()` 包裹，仅使用项目全局变量 |

---

## 二、A11y 阶段交付

### 1. 全局样式基线 [_a11y.scss](file:///g:/1/client/src/styles/_a11y.scss)

- 焦点环（`:focus-visible`）：键盘聚焦时显示 2px 主色描边，鼠标点击不显示
- Skip-link：键盘用户可跳过导航直达主内容
- `.sr-only`：屏读器专用，视觉隐藏但保留可访问性
- 媒体查询响应：
  - `prefers-reduced-motion: reduce` → 全局动画/过渡压制到 0.01ms
  - `prefers-contrast: more` → 焦点环加粗到 3px + 颜色加亮
  - `forced-colors: active`（Windows 高对比度）→ 系统色 + 强制边框
- 引入到 [index.scss](file:///g:/1/client/src/styles/index.scss#L62-L64)

### 2. useA11y composable [useA11y.ts](file:///g:/1/client/src/composables/useA11y.ts)

- `announce(message, { politeness })`：写入 `aria-live` 区域，支持 polite / assertive
- `focusFirst` / `focusLast`：容器内焦点定位
- `trapFocus(root, onEscape)`：焦点陷阱（弹窗用），支持 ESC 回调
- `isReducedMotion` / `isHighContrast` / `isForcedColors`：媒体查询响应式 ref
- 同步初始化 + onMounted 双重保险，SSR/测试环境均安全

### 3. LiveRegion 组件 [LiveRegion.vue](file:///g:/1/client/src/components/a11y/LiveRegion.vue)

- 全局挂载 `aria-live="polite"` + `aria-live="assertive"` 两个区域
- `polite` 区用 `role="status"`，`assertive` 区用 `role="alert"`
- 在 [App.vue](file:///g:/1/client/src/App.vue) 中 defineAsyncComponent 加载

### 4. 核心页面接入

| 页面/组件 | 关键改动 | 文件 |
| --- | --- | --- |
| [Wallet.vue](file:///g:/1/client/src/views/Wallet.vue) | section/region/tablist/tab/aria-live/aria-busy/label 关联、键盘左右箭头 Tab 导航、SR-only label、`type="button"` 显式声明 | [Wallet.vue](file:///g:/1/client/src/views/Wallet.vue) |
| [BalanceAlert.vue](file:///g:/1/client/src/components/BalanceAlert.vue) | warning → `role="status"`，critical → `role="alert"`，`aria-label`，`<h3>` 语义化标题，关闭按钮 `aria-label` | [BalanceAlert.vue](file:///g:/1/client/src/components/BalanceAlert.vue) |
| [RechargeDialog.vue](file:///g:/1/client/src/components/RechargeDialog.vue) | `aria-modal="true"`、`aria-labelledby`、`aria-describedby`、`aria-pressed` 预设按钮、`aria-invalid` 输入校验、`role="radiogroup"` 支付方式、弹窗打开后焦点 + 屏幕阅读器播报 | [RechargeDialog.vue](file:///g:/1/client/src/components/RechargeDialog.vue) |

### 5. 测试覆盖

| 测试类型 | 文件 | 通过 |
| --- | --- | --- |
| vitest 单测 | [useA11y.test.ts](file:///g:/1/client/src/composables/__tests__/useA11y.test.ts) | 12/12 |
| vitest 单测 | [LiveRegion.test.ts](file:///g:/1/client/src/components/a11y/__tests__/LiveRegion.test.ts) | 4/4 |
| vitest 单测 | [BalanceAlert.a11y.test.ts](file:///g:/1/client/src/components/__tests__/BalanceAlert.a11y.test.ts) | 8/8 |
| vitest 单测 | [Wallet.a11y.test.ts](file:///g:/1/client/src/views/__tests__/Wallet.a11y.test.ts) | 10/10 |
| Playwright + axe-core | [p7-a11y.spec.ts](file:///g:/1/client/e2e/p7-a11y.spec.ts) | 15/15 + 2 skipped（数据为空优雅降级） |

axe-core 跑全 WCAG 2.1 A/AA 规则：钱包页 3 视口（mobile/tablet/desktop）均 0 critical/serious 违规。

---

## 三、可观测性 v2 交付

### 1. 业务 span 工厂 [observability_v2.py](file:///g:/1/server/app/observability_v2.py)

- **域名白名单** `_VALID_DOMAINS = ("refund", "push", "reconcile", "forecast")`：避免任意字符串污染 span 名
- **4 个装饰器** `trace_refund` / `trace_push` / `trace_reconcile` / `trace_forecast`：自动构造 `biz.<domain>.<action>` span
- **`record_business_event`**：在当前 span 上记业务事件（退款通过/拒绝/重试等），并写内存环形缓冲
- **`business_span_context`**：with-context 形式，用于局部子块
- **`get_business_metrics_snapshot(limit)`**：返回最近业务事件快照（供 `/health` 端点）
- **降级行为**：telemetry 未启用时，装饰器仍记录内存事件，业务不阻塞

### 2. 业务模块接入

| 模块 | 接入点 | 装饰器 |
| --- | --- | --- |
| 退款 [refund.py](file:///g:/1/server/app/api/v1/refund.py) | `create_refund` / `review_refund` / `batch_review_refunds` | `@trace_refund` |
| Push [push.py](file:///g:/1/server/app/api/v1/push.py) | `send_push` | `@trace_push` |
| 对账 [reconciliation_service.py](file:///g:/1/server/app/services/reconciliation_service.py) | `reconcile_alipay_for` / `reconcile_wechat_for` / `reconcile_all_for` / `auto_reconcile_yesterday` / `auto_close_expired_orders` | `@trace_reconcile` |
| 预测 [business_dashboard.py](file:///g:/1/server/app/api/v1/monitor/business_dashboard.py) | `get_forecast` | `@trace_forecast` |

### 3. 测试覆盖

- [test_observability_v2.py](file:///g:/1/server/tests/test_observability_v2.py)：20/20 通过
  - 域名白名单
  - 装饰器降级（同步/异步）
  - 业务事件环形缓冲（1000 条上限）
  - 上下文管理器（含异常传播）
  - OTel 启用时 span 名格式校验
  - 4 个业务模块装饰器接入验证

兼容性：现有 35 个 telemetry / logging / P6 测试全部通过，无回归。

---

## 四、样式合规审计

| 指标 | 目标 | 实际 |
| --- | --- | --- |
| `!important` 使用 | 0 | 0 ✅ |
| 高特异性选择器（> 2 类/id 组合） | 0 | 0 ✅ |
| 全局变量复用 | 100% | 100% ✅ |
| 代码风格 | 最小/精简/直接 | 符合 |

P7 阶段新增样式均使用 `:where()` 包裹降低特异性，仅用 `--global-border-radius` / `--el-color-primary` / `--el-bg-color` / `--el-text-color-primary` / `inherit` 等项目全局变量。

---

## 五、产物汇总

### 新增文件
- `client/src/styles/_a11y.scss` — A11y 全局样式基线
- `client/src/composables/useA11y.ts` — A11y 工具 composable
- `client/src/components/a11y/LiveRegion.vue` — 全局 aria-live 区域
- `client/src/composables/__tests__/useA11y.test.ts` — 12 个单测
- `client/src/components/a11y/__tests__/LiveRegion.test.ts` — 4 个单测
- `client/src/components/__tests__/BalanceAlert.a11y.test.ts` — 8 个单测
- `client/src/views/__tests__/Wallet.a11y.test.ts` — 10 个单测
- `client/e2e/p7-a11y.spec.ts` — 17 个 Playwright + axe-core 测试
- `server/app/observability_v2.py` — 业务 span 工厂
- `server/tests/test_observability_v2.py` — 20 个 pytest

### 修改文件
- `client/src/styles/index.scss` — 引入 `_a11y`
- `client/src/App.vue` — 挂载 LiveRegion
- `client/src/views/Wallet.vue` — section/region/tablist/aria-busy/键盘导航/useA11y
- `client/src/components/BalanceAlert.vue` — role/aria-label/语义化标题
- `client/src/components/RechargeDialog.vue` — aria-modal/aria-labelledby/aria-pressed/radiogroup/焦点管理
- `server/app/api/v1/refund.py` — 3 个端点接入 `@trace_refund` + 3 个 `record_business_event`
- `server/app/api/v1/push.py` — send_push 接入 `@trace_push` + 投递结果事件
- `server/app/services/reconciliation_service.py` — 5 个函数从 `@trace_business` 升级为 `@trace_reconcile`
- `server/app/api/v1/monitor/business_dashboard.py` — get_forecast 接入 `@trace_forecast`

---

## 六、接下来的开发建议（P8 候选）

1. **国际化深化**：9 种语言 + RTL 适配，复用 P6 i18n 基础设施
2. **业务侧 BI**：自助报表 + 维度下钻 + 异常归因，紧接 P7 观测性做纵深
3. **安全审计**：越权检测 + 敏感操作二次验证 + 行为分析，给钱包/退款加护栏
4. **离线优先**：IndexedDB + CRDT 协作，重前端、轻后端
5. **CI/CD 增强**：蓝绿 + canary 切分 + 自动回滚，运维侧
6. **AI 能力可视化**：智能体关系图谱 + 决策树，依赖现有的 Agents.vue / AiWorld.vue

推荐按 **业务侧 BI** → **安全审计** → **国际化** 顺序推进，每阶段遵循 P6/P7 节奏：代码 + 单测 + Playwright + 阶段报告，保持 0 `!important`、0 高特异性选择器、仅使用项目全局变量。

---

**P7 全部完成**
- A11y：34 单测 + 15 Playwright + axe-core 0 critical
- 可观测性 v2：20 pytest + 4 业务模块接入
- 样式合规：0 `!important` / 0 高特异性 / 仅全局变量
