<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 【过期快照警告 · 执行前必读】本报告基线 `895027a9d6` 远早于当前 `origin/main`（`e2b004b74940af915320eefa22c8c12093009e7e`）。
> 文中行号与「当场可修」结论大概率已失效，曾被误当作当前真相并误导后续 agent（已因此浪费一轮验证）。
> 凡 `PROJECT_PLAN.md` 引用本报告的任一条目，动手前**必须先对照当前代码复核**（强制纪律见 `RECONCILE-findings-staleness.md` 第四节）。
> 已确认在当前代码修复的条目，见文内 `【已修复@当前代码】` 标注。

# apps/web 前端面深度缺陷普查报告

- 仓库：`D:\IHUI-AI`
- 分析基线：`origin/main` = `895027a9d644ce0688bb0d533281cf097db69578`（已 `git fetch origin`）
- 工作树与基线差异：`apps/web` 仅 5 个文件不同（`edu/attendance/SelfAttendanceTable.tsx`、`public/verify-code.htm`、`chat/voice-companion.tsx`、`docs/manual-figure.tsx`、`lib/ui-routes.generated.ts`），均不在本报告结论涉及范围内；涉及文件已逐行按 origin/main 语义复核。
- 纪律：全程只读，未修改仓库任何文件、未提交、未 push。
- 去重：已逐条比对 `origin/main` 的 `PROJECT_PLAN.md`（8.2MB）与 `scripts/data/plan-fields.jsonl`（251 行）。已存在条目不再重复上报，例如：
  - `payment/checkout` 的 `startPolling` 定时器叠加（PROJECT_PLAN 已有）；
  - `use-agent-runtime` 的 401 续期账本（PROJECT_PLAN 已有）；
  - `miniapp-taro` 考试倒计时递减（PROJECT_PLAN 已有，**但本次发现 web 端同型缺陷尚未登记**，见 W-01/W-02）；
  - `question-dialog` / `conversation-org-dialog` / `recharge/success` / `refund/[id]` / `learn/payment/confirm` / `PLAN_PRICES` 在 PROJECT_PLAN 与 plan-fields 中均无命中。

---

## 子面一：状态与数据流

### W-01 考试倒计时用「每秒自减」而非截止时间戳，后台/锁屏可无限延长考试时间

- **严重度**：P1
- **文件与行号**：
  - `apps/web/app/(main)/exam/[id]/PageClient.tsx` L44、L55-L57、L90-L93、L95-L105
- **触发路径**：进入任一有时长的考试 → 答题过程中切到其它标签页 / 锁屏 / 最小化超过数分钟 → 回到页面继续答题。倒计时只减少了浏览器实际触发的 tick 数，而不是真实流逝时间；到达 0 分时的自动交卷（L95-L105）同样被推迟。
- **根因**：
  - 剩余时间以「状态自减」建模：`const tm = setInterval(() => setLeftSec((s) => s - 1), 1000)`，没有保存「截止时间戳」，也没有在 `visibilitychange` / `focus` 时对表。
  - effect 依赖写成 `[phase, leftSec]`，每减 1 秒就销毁并重建一次 interval，每次重建都叠加一次渲染与调度开销，前台也会稳定地「越走越慢」。
  - 浏览器标准行为：后台标签页定时器会被节流（Chrome 隐藏 5 分钟后约 1 次/分钟，移动端可整体挂起），因此后台时间基本不计入。
- **证据**（关键代码）：

```tsx
// L90-L93
React.useEffect(() => {
  if (phase !== 'answering' || !hasTimerRef.current || leftSec <= 0) return
  const tm = setInterval(() => setLeftSec((s) => s - 1), 1000)
  return () => clearInterval(tm)
}, [phase, leftSec])
```

- **影响面**：所有参加限时考试的学生；时间限制形同虚设，自动交卷延迟，考试公平性与成绩有效性受损。
- **建议修法**：进入答题时记录 `deadlineRef = Date.now() + duration * 60_000`；用 250ms/1s tick 仅做重算触发，剩余时间由 `Math.max(0, deadline - Date.now())` 派生；在 `visibilitychange`（变为 visible）与 `focus` 时强制重算；effect 依赖改为 `[]`（或仅 `phase`）。自动交卷以派生剩余时间 `=== 0` 为准，并加一次性提交锁。
- **是否当场可修**：可（单文件，无需改接口）。

### W-02 管理端在线答题页存在同型倒计时缺陷

- **严重度**：P2
- **文件与行号**：`apps/web/app/(main)/admin/edu/answer/online/page.tsx` L36、L77、L105-L108、L111-L115
- **触发路径**：进入在线答题 → 切后台或锁屏一段时间 → 返回；倒计时与自动交卷同样被顺延。
- **根因**：与 W-01 完全同型——`setRemaining((s) => Math.max(0, s - 1))` 自减建模，effect 依赖 `[recordId, remaining]` 每秒重建，无截止时间戳、无可见性对表。
- **证据**：

```tsx
// L105-L108
React.useEffect(() => {
  if (!recordId || remaining <= 0) return
  const tc = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000)
  return () => clearInterval(tc)
}, [recordId, remaining])
```

- **影响面**：管理端/教师端在线答题的限时统计与自动提交。
- **建议修法**：同 W-01，改为 deadline 派生；建议抽一个 `useDeadlineCountdown` 供两处共用，避免再复制第三份。
- **是否当场可修**：可。

### W-03 退款详情失败时降级为「列表前 100 条匹配」，且静默丢失订单与审核记录

- **严重度**：P3
- **文件与行号**：`apps/web/app/(main)/refund/[id]/PageClient.tsx` L91-L104（降级在 L97-L101）
- **触发路径**：
  1. 用户退款记录超过 100 条；
  2. 打开一条较早的退款详情，此时详情接口出现 5xx/网关错误/瞬时网络失败；
  3. 前端降级请求 `/api/refunds/me?page=1&pageSize=100`，该记录不在第一页 → 抛 `notFound`，用户看到「未找到」；即使命中，也只能拿到 `{ order: null, auditRecords: [] }` 的残缺数据。
- **根因**：`queryFn` 把「详情接口非成功」一律当作可降级场景，且列表查询硬编码只取第一页 100 条，没有翻页/游标遍历；降级数据缺少订单与审核记录。
- **证据**：

```tsx
const detailRes = await fetchApi<RefundFullData>(`/api/refunds/${params.id}`)
if (detailRes.success) return detailRes.data
const listRes = await fetchApi<RefundListData>(`/api/refunds/me?page=1&pageSize=100`)
...
if (found) return { refund: found, order: null, auditRecords: [] }
```

- **影响面**：老用户（退款单 >100）在详情接口抖动时误判「退款不存在」；命中时页面缺少订单信息与审核进度，形成误导性展示。
- **建议修法**：区分错误类型——仅当详情返回 404 时降级；降级查询按游标/翻页定位，或直接去掉降级并展示真实错误；降级命中时同步拉订单与审核记录，或明确提示「信息不完整」。
- **是否当场可修**：可（去除降级或改为 404-only + 翻页）。

---

## 子面二：渲染与交互

### W-04 提问弹窗未处理输入法组合态，中文按 Enter 选词会提前提交半截答案

- **严重度**：P2
- **文件与行号**：`apps/web/src/components/chat/question-dialog.tsx` L84-L91、L145
- **触发路径**：Agent 通过 SSE 发起 `question` 事件并允许自定义回答 → 用户在「自定义输入」框用中文输入法打字 → 按 Enter 上屏候选词 → `keydown` 的 Enter 被当成提交，弹窗关闭并把尚未组成的文本作为答案提交给 Agent。
- **根因**：Enter 提交判断只检查了 `!e.shiftKey`，未检查 `e.nativeEvent.isComposing`（或 `keyCode === 229`），无法区分「上屏」与「提交」。
- **证据**：

```tsx
// L84 起
if (e.key === 'Enter' && !e.shiftKey) {
  // 直接执行提交
}
```

- **影响面**：所有使用中日韩输入法的用户；错误答案一旦提交，Agent 会按错误答案继续执行，且弹窗已关闭，用户难以纠正。
- **建议修法**：`if (e.nativeEvent.isComposing || e.keyCode === 229) return`；同时保留 Shift+Enter 换行语义。
- **是否当场可修**：可。

### W-05 会话组织弹窗的标签输入同样缺少输入法组合态判断

- **严重度**：P3
- **文件与行号**：`apps/web/src/components/chat/conversation-org-dialog.tsx` L77、L142
- **触发路径**：在会话组织弹窗输入中文标签，按 Enter（或逗号）上屏候选词 → 命中 `e.key === 'Enter' || e.key === ','` 分支，把半截标签加入列表并清空输入框。
- **根因**：与 W-04 同型，未判断 `isComposing`；且逗号在部分中文输入法中也是候选上屏键。
- **证据**：

```tsx
// L77
if (e.key !== 'Enter' && e.key !== ',') return
```

- **影响面**：中文标签被截断/误加，需要手动删除重输。
- **建议修法**：同一处加 `isComposing` 守卫；逗号分支建议仅在全角/半角逗号且非组合态时生效。
- **是否当场可修**：可。

---

## 子面三：网络层

### W-06 学习支付确认页对长期 pending 订单无上限、无退避轮询，且存在请求重叠

- **严重度**：P3
- **文件与行号**：`apps/web/app/(main)/learn/payment/confirm/PageClient.tsx` L72-L97
- **触发路径**：打开确认页但一直不支付（例如二维码已失效、用户离开又回来）→ 页面保持打开期间每 3 秒请求一次 `/api/payments/wechat/status/{orderNo}`，永不停止；网络慢时单次请求 >3 秒，`setInterval` 会继续发起下一次，形成并发重叠。
- **根因**：`setInterval(poll, 3000)` + 异步 `poll` 无 in-flight 守卫、无最大次数、无指数退避；仅在 `paid/failed/cancelled` 时停止。
- **证据**：

```tsx
poll()
const tm = setInterval(poll, 3000)   // 无上限、无重叠保护
```

- **影响面**：长时间挂页产生持续请求（移动端耗电/流量、服务端无效 QPS）；弱网下叠加请求。
- **建议修法**：改为 `setTimeout` 链式轮询 + in-flight 标记 + 最大次数/总时长 + 退避；`document.visibilityState !== 'visible'` 时暂停，恢复可见时立即补一次。
- **是否当场可修**：可。

---

## 子面四：安全

### W-07 充值成功页把「支付二维码」和「金额」直接取自 URL 参数，可被构造链接用于支付钓鱼

- **严重度**：P2
- **文件与行号**：
  - 消费端：`apps/web/app/(main)/wallet/recharge/success/PageClient.tsx` L29-L34、L77、L89-L100、L121、L155-L161、L161-L173
  - 生产端（同一设计）：`apps/web/app/(main)/wallet/recharge/page.tsx` L94-L99；`apps/web/app/(main)/purchase/TopupTab.tsx` L102-L107
- **触发路径**：
  1. 攻击者构造 `https://<站点>/wallet/recharge/success?orderNo=任意值&amount=0.01&method=wechat&codeUrl=<攻击者收款码内容/任意 URL>`；
  2. 诱导用户打开；页面渲染攻击者指定的二维码，并把 `amount` 原样显示为「¥0.01」；
  3. 用户扫码付款，资金进入攻击者账户，而页面文案仍是平台充值成功页。
  另：`orderNo` 仅在 L121 做非空判断，不校验归属/存在性，因此任意字符串即可让二维码分支渲染。
- **根因**：页面把 `codeUrl` / `payUrl` / `amount` 当作可信输入，直接用于 `QRCodeCanvas value=` 与金额展示；权威支付信息应由服务端按 `orderNo` 返回，而不是走 URL。
- **证据**：

```tsx
const amount = searchParams.get('amount')
const codeUrl = searchParams.get('codeUrl') ?? ''
const payUrl = searchParams.get('payUrl') ?? ''
// ...
if (!orderNo || (!codeUrl && !payUrl)) { /* 兜底 */ }
<QRCodeCanvas value={isAlipay ? payUrl : codeUrl} size={240} level="M" />
金额：<span>¥{amount}</span>
```

- **影响面**：支付钓鱼/收款码劫持；用户对平台域名的信任被利用。需要用户打开构造链接并扫码，但一旦发生即为真实资金损失。
- **建议修法**：成功页只接受 `orderNo`；二维码与金额一律通过服务端接口（绑定当前登录用户与订单）获取；对 `method` 仅做展示白名单；不再从 URL 读取 `codeUrl/payUrl/amount`，生产端同步改为只传 `orderNo`。
- **是否当场可修**：可，但需与生产端（`wallet/recharge`、`purchase/TopupTab`）成对改动并回归支付链路。

---

## 子面五：性能陷阱

本轮针对以下判据做了全量脚本扫描，**未发现可证实的新增缺陷**（详见「第二轮复扫」）：

- `setInterval` 与 `clearInterval` 平衡：apps/web 全量扫描，所有计时器均有清理路径；
- `addEventListener` 与 `removeEventListener` 平衡：重点核对 keydown/scroll/resize/storage/online 等全局监听，未发现挂载后不摘除的实例（`PwaUpdateWatcher` 的 listener 挂在随 registration 回收的对象上，不构成泄漏）；
- `IntersectionObserver` / `ResizeObserver` / `requestAnimationFrame` 清理：rAF 均为一次性回调，未发现持续循环未取消；observer 均有 disconnect；
- 对象 URL：`createObjectURL` 均有 `revokeObjectURL`；
- 订阅：zustand 订阅均在 effect cleanup 中退订。

**未判定**（不放结论）：聊天消息列表未发现虚拟滚动实现（无 `Virtualizer`/`virtuoso`/`react-window`），但现有历史折叠与分页投影可能已限制渲染量，缺少长会话实测阈值，暂不报为缺陷。

---

## 未判定清单（推测，未混入结论）

1. **结算页价格双源**：`apps/web/app/(main)/payment/checkout/PageClient.tsx` L28（`PLAN_PRICES` 硬编码）、L67-L68（`subtotal = plan.price`）、L171（展示）忽略了 L118 `createOrder()` 返回的 `order.amount`；而同文件 `ExistingOrderCheckout` L279/L386 使用的是服务端金额（分）。**未判定**：需服务端价目表对照，无法从前端证明当前存在真实价差；建议改为展示下单接口返回金额。
2. **`useAgentRuntime` 切换 `agentId` 残留事件**：`apps/web/src/hooks/use-agent-runtime.ts` L200-L216 与 L393-L405 的清理未重置 `tokenStream/toolCallChain/healEvents/streamError`，且 `toolCallChain` 为追加写（L268/L288）。但唯一消费方 `agent-task-progress-pane.tsx` L851-L862 只取 thinking/plan/sessionEnd/permission/terminal/agentStatus/lastMessage/deliverables，不展示这三个字段。**未判定为无用户可见影响**，故不计缺陷。
3. **`web-work-panel` 的 `message` 监听无来源校验**：`apps/web/src/components/work-panel/web-work-panel.tsx` L589 附近。**未判定**：需确认攻击窗口能否取得对本窗口的 `postMessage` 句柄；同源代理 iframe 本就拥有同源权限，风险增量不明确。
4. **服务端时间戳时区**：多处 `new Date(v)` / `Date.parse(v)` 直接解析接口返回值（如 `refund/[id]` L116、`agent-task-progress-pane` L876）。**未判定**：缺少接口返回格式（是否带 `Z`/偏移）证据，不能断言存在 8 小时偏差。
5. **支付金额单位**：微信接口按「分」、支付宝按「元」（`wallet/recharge/page.tsx` L77/L81）。前端按注释分别传参，**未判定**为缺陷，需后端契约确认。

### 复核结论（2026-11-08）

| # | 结论 | 证据 | 处置 |
|---|---|---|---|
| 1 | **坐实，升 P1** | 前端 `PLAN_PRICES`（`payment/checkout/PageClient.tsx:28-34`）展示价；下单 `createOrder(planId)`（`:118`）把 `'pro'/'enterprise'` 当 `vipLevelId` 传给 `POST /vip/order`（`use-vip-payment.ts:59-62`）。服务端 `findVipLevel` 按 `vip_levels.id` 查（`vip.ts:329`），id 为 `uuid defaultRandom()`（`packages/database/src/schema/vip.ts:25`）→ 默认 schema 下必 404「VIP 等级不存在」。入口真实：`payment/page.tsx:23-26,105`。价目本身与 DB 种子等价（2900/9900/49900 分，`scripts/seed-vip-levels.ts:53,69,85`），但档位语义错位（pro=¥99 对应 `levelValue=2`）。 | S-07（`lib/checkout-plan-levels.ts` + 服务端档位下单） |
| 2 | **坐实（潜在）P3** | cleanup（`use-agent-runtime.ts:391-403`）未重置 `tokenStream/toolCallChain/healEvents/streamError`；`toolCallChain` 追加写（`:268-279`）。当前消费方 `components/ai/agent-task-progress-pane.tsx:851-862` 不读三项，`agent-workbench/page.tsx:75` 整对象消费未见读取 → 无现网可见影响，但残留状态是后续接线隐患。 | S-08（cleanup 补齐四项重置） |
| 3 | **坐实（安全）P3** | 监听 `web-work-panel.tsx:559-592` 只校验 `e.data`，未用 `e.source`。opaque origin 下 `e.origin='null'` 不可用，但 `e.source` 可精确比对 iframe。副作用大于注释所述：`ihui-embed-newtab` → `newTab(d.url)` 开任意 http(s) 内部标签；nav/loaded 改写地址栏与历史栈、置 `status=loading` 触发 20s 降级。 | S-09（`lib/embed-message-trust.ts` + `e.source` 闸） |
| 4 | **证伪** | 退款接口返回 Drizzle `Date`，JSON 序列化为 ISO8601 带 Z（`refund-audit.ts:209-240`、`order-queries.ts:391-394/518-530`、`order.ts:669-694`）；kanban 流时间显式 `.toISOString()`（`agents-kanban.ts:97-109`）；agent-runtime 透传上游帧不改写。前端 `new Date(v)` 正确，无 8 小时偏差。**原判定为何误判**：把「前端未做格式防御」（仅防御缺口）与「服务端返回无时区字符串」（才是缺陷）捆成一条；又把退款接口时间与 SSE 时间当成同一数据源（后者由 `toKanbanTask` 显式 `toISOString()`）。 | 不修，避免伪修复 |
| 5 | **证伪（契约一致）** | wechat native 入参分（`payment-gateway.ts:521-563`）；alipay 入参元、服务端 `Math.round(amountYuan*100)`（`:990`），回写 `(amountCents/100).toFixed(2)`（`:1020`）；前端 wechat `values.amount*100`、alipay 原值（`wallet/recharge/page.tsx:75-84`）。**原判定为何误判**：把「两渠道前端传参形态不同」（设计差异）与「同渠道前后端单位错配」（才是缺陷）捆成一条；实际各渠道契约闭合。 | 不修 |

### 注释与事实不符（2026-11-08）

- `web-work-panel.tsx:554-558` 原注释称 postMessage 影响面「仅地址栏显示/降级触发」，实际还含 `newTab()` 打开任意 http(s) 内部标签；已在 S-09 改注释。
- 本清单第 3 条「需确认攻击窗口能否取得 postMessage 句柄」的未判定前提不成立：`e.source` 可直接校验。

---

## 覆盖清单

### 已扫（含方式）

| 区域 | 覆盖内容 | 方式 |
|---|---|---|
| 路由盘点 | `apps/web/app` 922 个 `page.tsx`、`(main)` 全部一级目录；`app/api` 下全部 `route.ts` 清单 | 脚本枚举 |
| 核心网络层 | `src/lib/api.ts`、`refresh-lock.ts`、`sso-redirect-guard.ts`、`api-base-url.ts`、`src/api/*`、`proxy.ts` | 逐行读 + 子代理 |
| 认证与存储 | `src/stores/auth.ts` L71-L226、`auth-store.ts` L30-L48、`chat.ts` L2547-L2633、`work-panel.ts` L239-L279/L1131-L1148、`ai-panel.ts` L201-L236 | 子代理走查 |
| Hooks | `use-agent-runtime`、`use-message-send`（发送/审批段）、`use-conversation-pane-cache`、`use-vip-payment`、`use-agent-progress`、`use-task-receiver`、`use-websocket`、`use-countdown`、`use-agent-stream`、`create-websocket-hook`、`use-chat-history-projection`、`use-conversation-broadcast-sync`、`use-permission-auto-revert` | 逐行读 + 子代理 |
| 交易域 | `payment/checkout`、`payment/qr`、`wallet/recharge`、`wallet/recharge/success`、`purchase/TopupTab`、`orders`、`orders/[id]`、`refund/[id]`、`invoices`、`learn/payment/confirm` | 逐行读 |
| 教育域 | `exam/[id]`、`admin/edu/answer/online`、`edu/parent`、`edu/parent/children/[childId]/grades`、`checkin`（轮询与按钮守卫） | 逐行读 |
| 管理域 | `admin/relay/account-pool`（重登轮询段）、`admin/sms-receive`（轮询段） | 定点读 |
| 安全面 | 全部 `dangerouslySetInnerHTML`（40+ 站点）、`SafeHtml`、`rich-anchor-text`、`MermaidDiagram`（securityLevel=strict + DOMPurify）、`PlatformPreview`（DOMPurify）、`FeishuQrPanel`（origin 校验）、`sso/*`、`postMessage` 监听、`window.open`、token 存储 | 逐点核对 |
| 性能面 | 全量 `setInterval`/`addEventListener`/`Observer`/`rAF`/`createObjectURL`/`.subscribe(` 平衡扫描；`useSearchParams` + Suspense；`JSON.parse` 站点 | 全量脚本 |

### 未扫（及原因）

- **营销/落地页约 600 页**（`compare/*`、`zh-TW/*`、`use-cases/*`、`en/docs/*` 等）：以静态内容与 JSON-LD 为主，交互面小，且已有生成器/快照测试，未逐页人工阅读。
- **`src/components/chat` 全量**（约 60+ 文件）：仅覆盖输入框、提问/组织弹窗、消息列表搜索与滚动、Markdown 流式渲染；其余消息卡片未逐文件读。
- **admin 大页面全量**：`checkin`（3524 行）、`account-pool`（3184 行）、`wallboard`（3592 行）、`edu-management/finance`（2379 行）仅做定点审计，未逐 action 走完。
- **`packages/*` 与后端/数据库**：超出「apps/web 前端面」范围。
- **e2e/真实浏览器实测**：只读约束下未起服务，所有结论均来自静态代码 + 既有测试/类型契约；W-01/W-02/W-07 已给出可直接复现的操作步骤，未在浏览器中跑通。

---

## 第二轮复扫（零新增确认）

在完成上述五个子面后，又按以下判据做了一轮全量复扫，**新增 0 条**：

1. `dangerouslySetInnerHTML` 全部站点复扫：除 `SafeHtml`（白名单净化）、`PlatformPreview`（DOMPurify）、`MermaidDiagram`（strict + DOMPurify）与静态 JSON-LD 外，无新的用户输入直插点；
2. 全局事件监听清理复扫：无新增未摘除监听；
3. `setInterval` 清理复扫：无新增无清理计时器；
4. `JSON.parse` 复扫：所有 localStorage / URL 解析点均有 `try/catch` 或类型守卫；
5. 直接 `fetch(` 复扫：第三方调用均带 `AbortSignal.timeout`（如 `ai-news-api/feed.ts`），平台内调用统一走 `fetchApi`/`ai-client`；
6. 未编码查询参数复扫：未发现 `?key=${用户输入}` 未编码站点；
7. `useSearchParams` 缺 Suspense 复扫：`app/layout.tsx` L568-L571 已统一包裹。

---

## 汇总

- **新增条数**：7 条（P1×1、P2×3、P3×3）
  - W-01 考试倒计时递减（P1）
  - W-02 管理端在线答题倒计时递减（P2）
  - W-04 提问弹窗输入法 Enter 提前提交（P2）
  - W-07 充值成功页支付二维码/金额取自 URL（P2）
  - W-03 退款详情降级只取前 100 条（P3）
  - W-05 会话组织弹窗输入法 Enter/逗号误加标签（P3）
  - W-06 学习支付确认页无上限轮询（P3）
- **去重后确认**：上述 7 条在 `PROJECT_PLAN.md` 与 `scripts/data/plan-fields.jsonl` 中均无同名/同义条目。
- **未判定**：5 条（见上，不计入新增）。

## 仍可继续深挖的方向

1. **admin 大页面逐 action 审计**：`checkin`（3524 行）、`account-pool`（3184 行）、`wallboard`（3592 行）、`edu-management/finance`（2379 行）只做了定点检查，仍有批量操作、并发写、金额计算的未覆盖面。
2. **考试/答题域完整链路**：交卷幂等、断网重试、答案本地暂存与恢复、切换设备续答，当前只覆盖了计时器与自动交卷。
3. **SSR/CSR 首屏与 hydration**：列表页与带 `persist` 的 store 在首屏 hydration 时的一致性，现有条目之外仍可逐页比对。
4. **work-panel 代理 iframe 的消息边界**：`postMessage` 来源校验、导航控制、跨站页面注入后的行为。
5. **长会话性能实测**：消息列表、`toolCallChain`/事件数组的裁剪策略与渲染量，需要真实长会话数据才有结论。
6. **时区与金额显示一致性**：服务端时间戳格式统一、分/元单位在前后端契约层的系统核对。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
