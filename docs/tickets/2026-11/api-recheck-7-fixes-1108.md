<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-->

# API 复核 7 条缺陷修复台账（2026-11-08）

- 工作树：`D:\IHUI-AI-wt-api-recheck-1108`，分支 `fix/api-recheck-7-1108`
- 基线：`origin/main` @ `da6d178f`
- 口径：复核已坐实的 7 条，按编号顺序逐条一笔提交；**本轮停跑全部门**，夹具（Vitest）是唯一质量信号；每条提交信息已点名编号与改前红/改后绿读数。

## 汇总

| 台账键 | 缺陷 | 严重度 | 修复提交 | 改前红 | 改后绿 |
|---|---|---|---|---|---|
| 346G | F-346 GitHub webhook 先 ACK 后异步、去重仅进程内 | P2 | `5dedc68989` | 新增夹具 5/6 失败 | 6/6；既有 webhook 4 套件 66/66、async-dispatch 18/18 |
| 324G | F-324 连接池指标恒 0（postgres.js 3.4.9 无 `.state`） | P2 | `cc10014367` | 2/5 失败（无 available、in_use 仍报 0） | 5/5（不可用显式 NaN，有 state 时 40/40 真实值） |
| 334G | F-334 积分兑换只看最近 20 条描述、判重与扣分跨两往返 | P3 | `7279e93b01` | 2/4 失败（第 21 次兑换重复第 1 个仍扣 500） | 4/4（精确 409 且零扣分；并发 23505→409） |
| 424G | F-424 任务列表先取全局前 N 再按用户过滤 | P3 | `f26fc249de` | 3/3 失败（前 50 条他人任务时自己为空、total=0） | 3/3（分页扫描，自己 3 条/total=3；他人 120 条时 total=真实 20） |
| 432G | F-432 Workspace ACP 会话不落库、任意 id 假成功 | P3 | `744822836d` | 4/6 失败（create 不落库却 201；随机/他人 id begin/end 均 200） | 6/6（create 真 insert 失败回 500；无主/不存在 404） |
| 449G | F-449 金额列 `real`(float4) 精度失真，多收 1 分 | P3 | `cfb0b7b2da` | payment.test.ts F-449 用例失败：131072.015625→13107202 | 同夹具 13107201；payment.test.ts 35 passed |
| 306G | F-306 Workspace agent/run 伪成功（`/llm/chat` 恒 404 仍 completed） | P3 | `78226aa578` | 2/3 失败（路由 200+completed；服务打 `/llm/chat` 且伪造思考） | 3/3；连带既有 2 套件 12 passed（路由显式 501；服务改 `/api/llm/complete`，失败落 failed） |

## 逐条落点

### F-346（`5dedc68989`）
- 先落持久认领再回 200：新增 `github_app_deliveries.payload`，复用 `ux_github_app_deliveries_delivery` + `onConflictDoNothing` 认领；`claimed / reclaimed / duplicate / unavailable` 四态。
- 迁移 `20261108180000_github_app_deliveries_payload.sql`（含回滚）。
- 持久层不可用 fail-closed 503；失败行或超时 `processing` 可被重投接管；无人值守信源认领先于 4h 风暴窗口。
- 夹具 `tests/github-webhook-persistent-delivery.test.ts`。

### F-324（`cc10014367`）
- 新增 `utils/pool-metrics.ts`：postgres.js 3.x 无 `state` 时返回 `available:false`，size 仍取 `options.max`；不使用 `reserve()` 探测以免短暂耗尽生产池。
- `metrics` 新增 `db_pool_metrics_available` gauge；不可用时 `db_pool_in_use/checkedout/overflow` 落 NaN 并只告警一次，不再静默报 0。
- 夹具 `tests/pool-metrics-f324.test.ts`。

### F-334（`7279e93b01`）
- 判重改为 `user_id + source='redeem' + reference_id` 精确查询（`referenceId = redeem:<商品id>`）；并发由部分唯一索引 `ux_point_transactions_redeem_user_ref` 兜底，`23505` 映射 409。
- 迁移 `20261108181000_point_transactions_redeem_unique.sql`：重复组保留流水，较晚行 `reference_id` 置 NULL 后建索引；含回滚说明。
- `spendPoints` 仍走 `adjustPoints` 单事务。
- 夹具 `tests/points-redeem-dedup-f334.test.ts`。

### F-424（`f26fc249de`）
- `listByUser` 改为每页 100 条扫描到队列尾，先按 `job.data.userId` 判归属再按 limit 截断；返回 `{ jobs, total }`，`total` 为该用户真实总数。
- 路由不再用本页长度冒充 total。
- 夹具 `tests/generation-queue-user-list-f424.test.ts`。

### F-432（`744822836d`）
- 复用 `agent_runtime_sessions(id,user_id,status,metadata)`：create 先 insert（`botId='workspace-acp'`，metadata 记 source/workspaceRoot），失败回 500。
- begin/end-prompt 先按 `(id,user_id)` 查归属；无主/不存在一律 404，不再返回 `prompt_started/prompt_completed`。
- 夹具 `tests/workspace-acp-session-f432.test.ts`。

### F-449（`cfb0b7b2da`）
- `zhs_course_video.amount` / `zhs_agent_developer.price` 改 `numeric(12,2)`；迁移 `20261108182000_money_numeric_precision.sql` 含存量转换说明（float4 已量化值无法反推原始输入，受影响历史价需按业务真相源人工核对）与回滚 SQL。
- `utils/money.ts` 增 `yuanToCents`（十进制逐位换算）/ `toYuanDecimal`（写库固定两位），复用既有 `Money.fromYuan`；`payment-gateway` 不再 `Math.round(amount*100)`；`zhs-legacy`、`admin/task-developer` 写入统一转十进制字符串。
- 夹具：`tests/payment.test.ts` F-449 用例，按列真实类型（real→numeric）模拟「落库→读回」，同一夹具改前红、改后绿。

### F-306（`78226aa578`）
- 端点结论：ai-service 的 llm 路由只在 `/api` 前缀下（`/api/llm/complete`），`/llm/chat` 不存在；本链路工具执行与计费/配额尚未接入，按允许口径取「显式 501」。
- 路由 `POST /workspace-ai/agent/run` 改 501，删除「200 但什么也没做」路径；服务 `run` 改调 `/api/llm/complete`，非 2xx/异常一律 `failed`，不再伪造「Agent 第 N 轮思考」；真实 200 内容原样落 `task.result`（正向对照）。
- 未触碰 `routes/workspace-ai.ts:1539-1580`（Persona 写权限活跃分支）。
- 夹具 `tests/workspace-agent-run-f306.test.ts`；同步调整 `tests/workspace-ai-service-agent-loop-no-simulated-execute.test.ts` 的 LLM mock 为健康 200，使其「只登记不执行」的既有断言继续成立。

## 说明

- 本轮未运行任何门（`gates-full` / husky / typecheck 等全部停跑），仅以夹具读数为准。
- 分支未推送；如需推送/开 PR，先按仓库流程恢复门禁再跑。
