<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# block1 · DeepSeek Harness 未吸收可复现设计

## 取证面与覆盖

- 对照程序：DeepSeek Harness 0.2.2-rc.5，安装面 `C:\Apps\DeepSeekHarness`；主包 `resources\app.asar`（约 199MB），解包残余 `resources\app.asar.unpacked`。
- 取证工具（本机实测）：
  - 只读解包器 `C:\IHUI-AI\scripts\benchmark-asar-read.mjs`：`--list "<正则>"` 列路径，`--get <asar内路径>` 取单文件内容；未把整包拉进上下文。
  - `craft-anything-cli --version` 现读 0.5.0；`--deep js-app-map --input-path "C:\Apps\DeepSeekHarness\resources\app.asar" --source-paths "C:\Apps\DeepSeekHarness\resources\app.asar.unpacked"`；`--deep commands` 列工具（321 条）。
  - 本轮未注册 Ghidra/IDA（CLI capabilities 中 ghidra found=false），未做原生反编译；未运行 DSH 程序本体。
- 包清单复用基线只读件：`docs/benchmark-evidence/2026-11/five-apps-2026-11-23/dsh-packages.txt`（336 包）与 `dsh-packages-grouped.md`（91 前缀组），未重做。
- 抽读范围：tool-* / jobs / schedule / goal-round-driver / spill / output-retention / fs-* / sandbox-policy / subagent-* / agent-team / typert-* / sdk-* / acp-app / plugin-* / launch-environment / atomic-write / chunked-list / token-meter / permission-* / user-* / repeat-tool-reminder / computer-use / deliverable / otel / headless / subprocess / shell-env / http-proxy / deque / timeout / workflow / scope / error / storage-domain / launch-environment 等 20 余组；解包落盘于本目录 `_scratch\dsh\out\@deepseek-ai\`。
- 已吸收基线（不重复计数）：dsh-session 族、dsh-compaction 族（tool-result-pruner / image-offload / compaction-retention）、dsh-mcp-*、dsh-persona、dsh-experimental-auto-review；另本轮实证发现 IHUI 已等价覆盖 atomic-write（`app/utils/atomic_io.py`）、fs-observation-policy（`app/core/file_read_state.py` 四档 + changed_by 归因）、ACP/JSON-RPC stdio（`app/services/acp_bridge.py`），这三组不计入新落点。
- 未碰及的组：ui/host 渲染、computer-use/cua-bundle、acp-app 宿主、plugin-market-index/package-inventory、typert 类型反射族、headless runner、desktop/小程序/web 端侧；原因见「未做 / 未判定」。

## 候选条目

| ID | 设计名 | 价值档 | 复现代价 | 超越轴 | 一句话 |
|----|--------|--------|----------|--------|--------|
| B1-01 | 工具超时结果结构化分类 + 嵌套 deadline 隔离 | B | S | 可测性 | per-tool 预算解析已有，缺超时结构化错误码供下游路由与外层 deadline 不误判 |
| B1-02 | 后台任务输出环：双游标读取 + 控制器准入 | A | M | fail-closed 边界 | 任务生命周期/通知/并发已有，缺输出环模型游标与观察者偏移双读、无控制器拒绝接单 |
| B1-03 | 重复工具调用连续链分级 advisory 守卫 | B | S | 零缺省行为变化 | 窗口哈希状态机已有，缺连续同参链计数、分级提醒与插话重置 |
| B1-04 | 审批决策结局封闭集 + 拒绝档 + turn 闭合审计 | A | M | fail-closed 边界 | 审批流/CAS/owner/超时已有，缺结局归一、确定性拒绝档、缺答者 fail-closed 与审计对闭合 |
| B1-05 | 沙箱三级策略解析 + 会话级动态额外可写根注册 | B | M | 可测性 | profile 静态根判定已有，缺显式>会话事件>部署默认三级与随会话销毁的额外根注册 |
| B1-06 | 目标自动续轮并发竞争裁决（race fence） | A | L | fail-closed 边界 | 跨轮账本与固定迭代已有，缺预留校验、竞争 stale、子树空闲等待与双次复核 |
| B1-07 | LLM 重试策略路由 + 重试状态持久化续用 | B | M | PostgreSQL 统一数据层替代 sqlite | 次数/退避/抖动/Retry-After 已有，缺 provider 策略白名单、retryId 跨续用与取消抑制 |
| B1-08 | 工作区变更盘上快照兜底 + 按需对比服务 | B | M | 可测性 | 补丁内存净 diff 已有，缺 turn 起止盘上快照、整文件捕获与按需 before/after 服务 |
| B1-09 | 子代理 fork/spawn 双上下文播种后端 | B | M | 零缺省行为变化 | 工具面隔离与回传预算已有，缺继承父前缀 / 零父上下文两种可注册后端 |
| B1-10 | 通用输出留存原语（retainer + UTF-8 边界 + omit 三态） | B | S | 可测性 | 块级预算保留已有，缺逻辑单元/字节窗 retainer、UTF-8 续接裁剪与省略计数三态 |
| B1-11 | OTel 事件 / 会话日志双通道导出 | C | M | 可测性 | 仅 trace 一条 OTLP 通道，缺计数批事件通道与字节有界会话日志通道 |

## 逐条五要素

### B1-01 工具超时结果结构化分类 + 嵌套 deadline 隔离

- **证据**：asar 内 `/dsh/node_modules/@deepseek-ai/dsh-tool-call-timeout-policy/src/index.ts`。可复核命令：`node C:\IHUI-AI\scripts\benchmark-asar-read.mjs "C:\Apps\DeepSeekHarness\resources\app.asar" --list "@deepseek-ai/dsh-tool-call-timeout-policy/"`，再 `--get /dsh/node_modules/@deepseek-ai/dsh-tool-call-timeout-policy/src/index.ts`。符号/字符串：plugin `timeoutPolicy`；`resolveToolTimeout(tool, deadline, signal)`；错误码 `TOOL_TIMEOUT`；事件 `tools/execute`、`exec.signal`；工具声明字段 `timeoutMs`。
- **三档**：观察——源码可见按工具声明 `timeoutMs` 派生 deadline，超时后把工具返回替换为带 `TOOL_TIMEOUT` 码的结构化结果；signal 派发后还原上游 signal。推断——外层调用方的 deadline 若先到，按既有错误码区分，不会被误判成本插件超时；该码供重试/沙箱/replay 下游路由。未知——超时结果在各下游（重试队列、审计、回放）的实际消费形态未运行验证。
- **IHUI 现状**：`Grep "TOOL_TIMEOUT|tool_timeout|ToolTimeout" apps\ai-service\app` → 命中 `app\core\tool_timeout_policy.py`（`resolve_tool_timeout_budget`、`ToolTimeoutBudget.tool_budget_s/loop_timeout_s/mcp_guard_s/source`）、`app\services\agent_engine.py:221` `DEFAULT_HOST_TOOL_TIMEOUT_MS = 30_000`、`app\services\agent_loop_v2.py:245` import。`Grep "TOOL_TIMEOUT" apps\ai-service\app\tools` → 无命中。结论=**部分覆盖**：per-tool 预算解析、外层宽限、硬上限、来源标注已有；缺结构化超时错误码、嵌套 deadline 按码隔离、signal 还原。
- **落点建议**：改造 `apps/ai-service/app/core/tool_timeout_policy.py`（增超时结果分类码与隔离判定）；消费方 `apps/ai-service/app/services/agent_loop_v2.py` 超时结果分支按码路由。
- **超越轴**：可测性。补两组纯函数单测：内层工具超时（出 `TOOL_TIMEOUT`）与外层 deadline 先到（保留原码不误判）；signal 还原断言。
- **最小复现范围**：工具级预算到期产出带稳定码的结构化超时结果；外层 deadline 与本插件超时互不串码；派发过的 signal 在 post-execute 还原。

### B1-02 后台任务输出环：双游标读取 + 控制器准入

- **证据**：`/dsh/node_modules/@deepseek-ai/dsh-jobs/src/index.ts`、`/dsh/node_modules/@deepseek-ai/dsh-api-job-controller/src/index.ts`。复核命令：解包器 `--list "@deepseek-ai/dsh-jobs/"` 与 `"@deepseek-ai/dsh-api-job-controller/"`。符号：`JobRegistry` 方法 `start/list/get/read/readAt/kill/wait/remove/attachController`；`JobId` 形态 `<kind>-<short-uuid>`；输出环区分模型推进游标与观察者绝对偏移；窗口外读取标记 lossy 不报错；结算 first-wins 后投递一轮事件；控制器准入拒绝无控制器服务的 owner 接单；job-output 引用计数。
- **三档**：观察——注册表按 owner 隔离，输出按有界环留存，两类读取位置语义不同；start 存在准入检查。推断——观察者（宿主/工具）读绝对偏移不受模型游标推进影响；任务终态只结算一次，迟到读取拿到 lossy 标记。未知——环容量、积压与重启恢复的持久化形态在该包内未见落地代码，未知。
- **IHUI 现状**：`Grep "offset|cursor|ring|readAt|lossy|observer|controller|attach" apps\ai-service\app\services\background_tasks.py` → 仅 540 行「任务结果规整为可 JSON 化摘要」一处；无游标/偏移/输出环/控制器准入。命中 `app\services\background_tasks.py`（状态机 pending/running/succeeded/failed/timeout/cancelled、journal 重建、幂等键、断点续跑、完成通知、`MAX_CONCURRENT`）、`app\services\subagent_jobs.py`（父子 job 树、wait/send/cancel）。结论=**部分覆盖**：生命周期/通知/并发/幂等已有；缺输出环双读、lossy 读、first-wins 一轮投递、控制器准入与引用计数输出。
- **落点建议**：新增 `apps/ai-service/app/services/background_job_registry.py`（输出环 + 双游标 + 控制器准入）；改造 `app\services\background_tasks.py` 接入输出读取面。
- **超越轴**：fail-closed 边界。单测：无控制器服务的 owner 调 start 被拒；模型游标推进不改变观察者偏移；终态后迟到读取为 lossy；无控制器身份不得挂输出引用。
- **最小复现范围**：每任务持有界输出环，模型侧游标与观察者绝对偏移分读；窗口外读返回 lossy 标记；结算只投递一轮；未注册控制器的 owner 不能起任务。

### B1-03 重复工具调用连续链分级 advisory 守卫

- **证据**：`/dsh/node_modules/@deepseek-ai/dsh-repeat-tool-reminder/src/index.ts`。复核命令：解包器 `--list "@deepseek-ai/dsh-repeat-tool-reminder/"`。符号：`WeakMap<Agent, Chain>`；阈值 `[3, 5, 8]` 分级 gentle/detailed；`canonicalize`/`sortJsonValue` 深键排序规范化；`agent/pre-step` 插话重置链；`tools/post-execute` 入链；include/exclude 通配；参数预览截断；纯 advisory 不否决执行。
- **三档**：观察——按「同名同参连续链」计数，达分级阈值注入提醒；用户新消息在 pre-step 把链清零；规范化对对象键递归排序。推断——连续链比窗口哈希更贴近「卡住反复试同一招」；提醒只是建议，终止权仍在主循环。未知——分级提醒的实际措辞与模型遵从率未运行量到。
- **IHUI 现状**：`Grep "repeat|loop.*guard|consecutive|identical|repeated" apps\ai-service\app -i` → 命中 `app\core\doom_loop.py`（窗口哈希、observing/reflecting/terminating 状态机、inject_reflection/skip/terminate 动作）。结论=**部分覆盖**：窗口化重复检测 + 反思注入/跳过/终止已有；缺连续同参链计数、三级分级 advisory、插话重置链、通配排除与参数预览截断。
- **落点建议**：新增 `apps/ai-service/app/core/repeat_call_reminder.py`（连续链 + 分级提醒）；与 `app\core\doom_loop.py` 并行注册，互不替代。
- **超越轴**：零缺省行为变化。默认阈值与现有状态机并行，提醒只注入文本不否决；单测：同参连续 N 次分级触发、插话后链清零、不同参不入链、通配排除生效。
- **最小复现范围**：维护每 agent 连续同名同参链，达 3/5/8 分别注入轻/详提醒；用户消息到来重置；可配 include/exclude；不阻断工具执行。

### B1-04 审批决策结局封闭集 + 拒绝档 + turn 闭合审计

- **证据**：`/dsh/node_modules/@deepseek-ai/dsh-user-approval/src/index.ts`。复核命令：解包器 `--list "@deepseek-ai/dsh-user-approval/"`。符号：`ApprovalPolicy` 取值 `ask`/`never`；决策结局 `allowed-once`/`rejected`/`cancelled`/`unavailable`；事件 `approval/asked`、`approval/decided`；请求瀑布 `approval/request`；缺 answerer 或 answerer 抛错归 unavailable；rogue 返回值归一；asked/decided 审计对必须在 open turn 内闭合；`allowed-once` 仅对本次请求动作一次性授予。
- **三档**：观察——结局是封闭枚举，越界返回归一到 unavailable；策略 `never` 下每个 ask 确定性拒绝；审计事件成对且受 open turn 约束。推断——headless/CI 姿态下无答者不会被当作放行；授予不跨动作累积。未知——审计对跨 turn 的实际拒发路径与前端展示未运行验证。
- **IHUI 现状**：`Grep "approval/asked|approval/decided|allowed-once|unavailable|ApprovalOutcome" apps\ai-service\app` → 命中 `app\services\agent_loop_v2.py:858` `ApprovalOutcome`（applied/not_found/forbidden/already_settled/superseded/snapshot_mismatch，端点回执态）、`_VALID_APPROVAL_POLICIES = ("never","on-request","always")`（8687-8692：`never`=免审放行）、`app\routers\agents.py:1494` 结算回执、`app\services\approval_persistence.py` 授权缓存、`app\services\tool_invocation_ledger.py` 审计台账。`Grep "allowed-once" apps\ai-service\app` → 无命中。结论=**部分覆盖**：审批流/CAS/owner 隔离/超时/fail-closed 守卫已有；缺决策结局四态封闭集与 rogue 归一、确定性拒绝档（现有 `never` 语义相反=放行）、缺答者 unavailable fail-closed、asked/decided 审计对 turn 闭合、一次性授予语义。
- **落点建议**：改造 `app\services\agent_loop_v2.py` 审批结局归一与策略档；新增决策结局枚举与 turn 闭合审计挂点；`app\services\approval_persistence.py` 补一次性授予语义。
- **超越轴**：fail-closed 边界。单测：answerer 缺失/抛错 → unavailable；rogue 返回归一；`never` 拒绝档下需批动作确定性拒绝；asked 未在同 turn 闭合不发 decided；现有 ask 链路行为不变。
- **最小复现范围**：审批结局收敛为四态封闭集；无答者/异常归 unavailable 不放行；新增确定性拒绝策略档；审计事件成对且受当前 turn 约束；授予只对请求动作一次有效。

### B1-05 沙箱三级策略解析 + 会话级动态额外可写根注册

- **证据**：`/dsh/node_modules/@deepseek-ai/dsh-sandbox-policy/src/index.ts`。复核命令：解包器 `--list "@deepseek-ai/dsh-sandbox-policy/"`。符号：`SandboxMode` `read-only`/`workspace-write`/`danger-full-access`；`resolve`；`registerWritableRoot`；`additionalWritableRoots`；事件 `sandbox/mode`；解析优先级 显式 mode > 会话事件覆盖 > 部署默认；额外根随 effect 销毁；Windows 上额外根只对文件工具生效，不进入进程 confinement。
- **三档**：观察——策略在逐调用点解析，额外根是会话级可注册集合，随生命周期销毁；平台差异在策略层显式声明。推断——resume/fork 后额外根需重新注册，不跨会话残留；进程隔离边界不因文件工具放宽而松动。未知——各平台 confinement 的实际系统调用面未取证。
- **IHUI 现状**：`Grep "registerWritableRoot|additionalWritable|extra_writable|writable_root.*register" apps\ai-service\app -i` → 无命中。`Grep "writable_roots|WritableRoot" apps\ai-service\app` → 命中 `app\core\patch_safety.py`（writable_roots 路径判定、cwd 隐式根）、`app\services\agent_engine.py:6508` `writable_roots=[str(base)]`、`app\services\sandbox.py:173` `resolve_execution_profile(raw)`。结论=**部分覆盖**：profile 解析 + 静态根路径判定已有；缺三级优先级解析、会话级动态额外根注册与销毁、Windows 文件/进程差异声明。
- **落点建议**：改造 `app\services\sandbox.py` 解析层级；新增会话级额外根注册表（复用现有 Redis/PG 通道，禁 sqlite），随会话销毁。
- **超越轴**：可测性。单测：三级优先级覆盖顺序；额外根注册/销毁/重注册生命周期；Windows 进程 confinement 不因额外根放宽；cwd 隐式根行为不变。
- **最小复现范围**：逐调用按显式>会话事件>部署默认解析模式；额外可写根可在会话内注册、随会话销毁、续跑需重注册；平台差异在策略层标注。

### B1-06 目标自动续轮并发竞争裁决（race fence）

- **证据**：`/dsh/node_modules/@deepseek-ai/dsh-goal-round-driver/src/index.ts`。复核命令：解包器 `--list "@deepseek-ai/dsh-goal-round-driver/"`。符号：`RoundIdentity` `goalId/revision/round`；phase `queued/claimed/admitted`；`validReservation`；`competingQueued`；`needsCheckpoint`；`waitForTreeWork`；`maxGoalRounds`；`agent/pre-step` 前后双次校验；竞争入队标记 stale；checkpoint 后复核预留。
- **三档**：观察——驱动为下一轮预留轮次身份，预留带 revision+round 双校验；检测到竞争 queued 或人类插话则置 stale；pre-step 前后各校验一次，过期预留拒绝；checkpoint 完成后再复核。推断——自动续轮不会在会话已被新输入/竞争轮次占用时抢跑；子树未空闲时等待，避免并发写同会话。未知——跨进程/多会话竞争的真实交错未运行验证。
- **IHUI 现状**：`Grep "reserve|stale|competing|quiescen|waitForTree|pre-step|revision.*round" apps\ai-service\app\services\goal_round_state.py -i` → 无命中。命中 `app\services\goal_round_state.py`（跨轮账本：连续未过/无进展/预算计数）、`app\services\goal_completion_gate.py`、`app\services\agent_orchestrator.py:525` `max_rounds`（批判-改进固定迭代）。结论=**部分覆盖**：跨轮计数账本与固定迭代轮次已有；缺自动续轮预留调度、revision+round 双校验、竞争/插话置 stale、子树空闲等待、checkpoint 后复核、pre-step 双次校验拒绝过期预留、竞争入队的轮次上限阻断。
- **落点建议**：新增 `apps/ai-service/app/services/goal_round_driver.py`（预留调度 + 竞争裁决）；对接 `app\services\goal_round_state.py` 账本，不改其计数语义。
- **超越轴**：fail-closed 边界。单测：竞争 prompt/人类插话使预留 stale；过期预留 pre-step 双次校验拒绝；子树繁忙等待后复核；超 maxGoalRounds 不再入队；无预留身份不得 admit。
- **最小复现范围**：自动续轮先预留 goalId/revision/round；入队与执行前双次校验；竞争或插话标记 stale；子树空闲后再 admit；checkpoint 后复核预留仍有效。

### B1-07 LLM 重试策略路由 + 重试状态持久化续用

- **证据**：`/dsh/node_modules/@deepseek-ai/dsh-llm-retry/src/index.ts`。复核命令：解包器 `--list "@deepseek-ai/dsh-llm-retry/"`。符号：`ResolvedRetryPolicy` `mode` `normal`/`always`；`retryableCodes`；`initialDelayMs/maxDelayMs/jitterRatio`；`providerRetryAfterMs`；事件 `llm/retry`；retryId 随会话投影持久化，重启后续用同一 retryId；取消/disposal 抑制在飞重试。
- **三档**：观察——重试策略挂在 provider 路由面，可按错误码白名单判可重试；退避有初始/上限/抖动比；provider 给的 Retry-After 参与上限计算；重试身份持久化。推断——续跑后不会重置已用重试名额；会话取消后在飞重试被抑制而非继续打模型。未知——各 provider 错误码映射表未在本包内列全。
- **IHUI 现状**：`Grep "retryableCodes|retryable_codes|retry_id|retryId|retry.*projection|policy.*always" apps\ai-service\app -i` → 无命中。命中 `app\services\agent_loop_v2.py:2656` `llm_retry_max=3`、`2657` `llm_retry_backoff=1.5`、`5222` 重试循环、`5349` 退避 `base*2^attempt*抖动`、`236` `hint_from_error/resolve_retry_delay_s`；`app\core\retry_after.py`；`app\services\scheduler.py` fixed/linear/exponential 退避。结论=**部分覆盖**：重试次数/指数退避/抖动/Retry-After 提取已有；缺 provider 路由 retryPolicy（normal/always、retryableCodes 白名单）、attempt/retryId 会话投影持久化跨续用、always 不设上限、取消/disposal 抑制在飞重试。
- **落点建议**：改造 `app\providers\base_provider.py` 与 `app\core\retry_after.py`；重试状态落 PostgreSQL 会话投影（复用现有会话投影通道，禁 sqlite）。
- **超越轴**：PostgreSQL 统一数据层替代 sqlite。单测：retryableCodes 白名单内/外分类；续跑复用同一 retryId 与已用名额；取消后在飞重试被抑制；Retry-After 夹到上限；不引入任何本地 sqlite 存储。
- **最小复现范围**：provider 带可重试码白名单与策略模式；退避按初始/上限/抖动；重试身份持久化跨续用；会话取消抑制在飞重试。

### B1-08 工作区变更盘上快照兜底 + 按需对比服务

- **证据**：`/dsh/node_modules/@deepseek-ai/dsh-workspace-changes/src/index.ts`。复核命令：解包器 `--list "@deepseek-ai/dsh-workspace-changes/"`。符号：事件 `workspace/changes`（只带 turn 号）；服务名 `workspaceChanges`；`TurnRecorder`/`GitRunner`；turn start/end 两次 git 工作树快照；git 不覆盖路径在文件工具编辑周围整文件捕获；按需给逐文件 before/after；配置 `timeoutMs/outputMaxBytes/maxFiles/maxFileBytes`；非 git 仓只列文件工具编辑。
- **三档**：观察——摘要事件只带 turn 号，文本与对比延迟由服务按需取；快照回读盘上真实状态，整文件捕获覆盖 git 不管的路径。推断——补丁丢失或外部改动时，盘上快照仍能兜出净变更；超大文件/超大 diff 按配置放弃记录而不是硬渲染。未知——快照存储成本与多会话共写树下的归属归因未运行量到。
- **IHUI 现状**：`Grep "turn.*snapshot|before.*after|whole.?file.*capture|workspace.*changes" apps\ai-service\app\services -i` → 命中 `app\core\turn_diff_tracker.py`（补丁内存累计净 diff、不回读文件系统、非精确变更整体失效）、`app\services\agent_deliverables.py`（before/after diff 聚合 filesChanged）、`app\services\ai_code_attribution_git.py`。结论=**部分覆盖**：补丁净 diff 跟踪与交付物变更聚合已有；缺 turn 起止两次盘上快照兜底、git 未覆盖路径整文件捕获、按需逐文件对比服务、事件只带 turn 号的延迟取面。
- **落点建议**：新增 `apps/ai-service/app/services/workspace_changes_service.py`（盘上快照 + 按需对比）；对接 `app\core\turn_diff_tracker.py` 现有补丁 diff 作为一路输入。
- **超越轴**：可测性。单测：补丁丢失时盘上快照兜出变更；整文件捕获覆盖非 git 路径；超 maxFileBytes 不给对比；非 git 仓降级只列文件工具编辑；事件只含 turn 号。
- **最小复现范围**：每 turn 起止取工作树快照，文件工具编辑周围整文件捕获；事件只报 turn 号；对比与摘要按需从服务取；超限按配置放弃记录。

### B1-09 子代理 fork/spawn 双上下文播种后端

- **证据**：`/dsh/node_modules/@deepseek-ai/dsh-subagent-fork-in-process/src/index.ts`、`/dsh/node_modules/@deepseek-ai/dsh-subagent-spawn-in-process/src/index.ts`。复核命令：解包器分别 `--list "@deepseek-ai/dsh-subagent-fork-in-process/"`、`"@deepseek-ai/dsh-subagent-spawn-in-process/"`。符号：`SubagentProvider`；注册名 `fork`/`spawn`；fork 播种父会话日志前缀，截止最后 `turn/end`，在飞 turn 排除；spawn 独立 session、独立 system prompt、零父上下文；capabilities `agentOptions/agentPreset/outputSchema/depthLimit`。
- **三档**：观察——两种后端在同一 provider 注册面下区分；fork 的种子是平衡完成轮前缀，无完成轮时子代理全新起步。推断——继承父上下文用于接力，零上下文用于隔离探索；深度上限由构造方子代理强制。未知——两种后端的成本/质量差未运行对照。
- **IHUI 现状**：`Grep "fork|parent|seed|prefix|history|fresh|spawn" apps\ai-service\app\services\subagent_jobs.py -i` → 仅 busy/steering 语义两处。命中 `app\services\subagent_spawn_policy.py`（工具面白名单并集、回传摘要预算 transcript keep 32）、`app\services\subagent_jobs.py`（父子 job 树、wait/send/cancel）。结论=**部分覆盖**：工具面隔离、回传预算、父子 job 树已有；缺两种上下文播种后端（继承父前缀 / 零父上下文）作为可注册 provider 区分。
- **落点建议**：新增 `apps/ai-service/app/services/subagent_backends.py`（fork/spawn 双 provider 注册）；对接 `app\services\subagent_jobs.py` 任务树。
- **超越轴**：零缺省行为变化。现有子代理链路默认后端不变；fork/spawn 为可选注册。单测：fork 种子截止最后平衡轮、在飞轮不入；spawn 零父上下文；深度上限生效；工具面并集规则不回退。
- **最小复现范围**：注册两种子代理后端：fork 继承父会话已平衡前缀，spawn 全新零上下文；按名选用；各自强制深度上限与工具面边界。

### B1-10 通用输出留存原语（retainer + UTF-8 边界 + omit 三态）

- **证据**：`/dsh/node_modules/@deepseek-ai/dsh-output-retention/src/index.ts`。复核命令：解包器 `--list "@deepseek-ai/dsh-output-retention/"`。符号：`ItemRetainer`/`TextRetainer`；窗型 `head`/`tail`/`headTail`；`trimTrailingPartialUtf8`/`trimLeadingContinuationUtf8`；`Omitted` `none`/`exact`/`unknown`；`describeOmitted`/`formatRetentionNotice`；`truncateWithoutSplittingSurrogatePair`；中立 notice 与恢复措辞分离。
- **三档**：观察——留存按逻辑单元或字节窗裁剪；UTF-8 续接字节被扫掉，不引入替换符；省略计数分精确/未知；通知文案与「如何恢复原文」分开格式化。推断——截断不会毁编码、不会把上游不完整语义混进留存结果；计数未知时不谎报精确省略量。未知——各消费方对 omit 元数据的展示形态未取证。
- **IHUI 现状**：`Grep "ItemRetainer|TextRetainer|headTail|trimTrailingPartial|omit.*exact|describeOmitted|RetentionNotice" apps\ai-service\app` → 无命中。命中 `app\services\spill_retention.py`（`retain_content` 头尾预算、图片不可分割、`fit_text` 二分、代理对保护、omittedBytes/omittedImages）、`app\services\tool_result_pruner.py`（已吸收 compaction 族）。结论=**部分覆盖**：块级预算保留 + 图片不可分割 + 代理对保护已有；缺通用机械留存库：逻辑单元 retainer、字节 head/tail/headTail 窗、UTF-8 续接字节边界裁剪、omit 三态精确计数、中立 notice 与恢复措辞分离格式化。
- **落点建议**：新增 `apps/ai-service/app/core/output_retention.py`（通用 retainer + UTF-8 边界 + omit 三态）；`app\services\spill_retention.py` 复用其裁剪与计数原语。
- **超越轴**：可测性。纯函数单测：字节窗头尾各半；UTF-8 多字节字符不被劈开；代理对不截断；omit none/exact/unknown 三态；未知计数不冒充精确；notice 与恢复文案分离。
- **最小复现范围**：提供逻辑单元与文本两种 retainer，支持 head/tail/headTail 字节窗；裁剪落在 UTF-8 字符边界；省略计数分三态；输出中立提示与恢复路径两段文案。

### B1-11 OTel 事件 / 会话日志双通道导出

- **证据**：`/dsh/node_modules/@deepseek-ai/dsh-otel/src/index.ts`。复核命令：解包器 `--list "@deepseek-ai/dsh-otel/"`。符号：`createEventReporter`（计数批普通事件通道）、`createSessionLogReporter`（字节有界会话日志通道）；两条通道状态互不共享；consumer 拥有关闭与外层 deadline；授权/脱敏先于上报；fiber disposal 时排空事件通道。
- **三档**：观察——事件按计数批、会话日志按字节上限分别建通道；通道创建不自带队列/身份/网络连接，由注入消费方持有。推断——普通事件洪峰不会挤爆会话日志通道；脱敏与授权在进入导出前完成。未知——两条通道的 OTLP 端点、采样与重传策略未在本包内列全。
- **IHUI 现状**：`Grep "v1/logs|logs_exporter|LogExporter|event.*channel|byte.*bounded" apps\ai-service\app -i` → 无命中。命中 `app\telemetry.py`（OTLP/HTTP trace：`OTLPSpanExporter` `/v1/traces`、`BatchSpanProcessor`、未配置 endpoint 降级 no-op）。结论=**完全没有**：仅 trace 一条通道；无普通事件计数批通道、无字节有界会话日志通道。
- **落点建议**：新增 `apps/ai-service/app/services/otel_log_channels.py`（事件计数批 + 会话日志字节有界两条独立通道）；`app\telemetry.py` trace 通道保持不动。
- **超越轴**：可测性。单测：两通道队列互不影响；会话日志超字节上限保留完整已接受事件；disposal 排空事件通道；脱敏先于入队；trace 通道行为零变化。
- **最小复现范围**：建两条独立 OTLP 上报通道：事件按计数批、会话日志按字节有界；授权脱敏前置；消费方负责关闭与排空。

## 未做 / 未判定

- 未做原生反编译：Ghidra/IDA 未在本机 CLI 注册（capabilities ghidra found=false），本轮结论全部来自 asar 内文本与符号；PE/原生二进制面未逆向。
- 未运行 DSH 程序本体：事件实际时序、并发竞争真实交错、通道洪峰行为均为源码推断，未做运行时观测。
- `dsh-sdk-protocol` / `dsh-sdk-jsonrpc-server`：IHUI 已有 `app\services\acp_bridge.py` JSON-RPC 2.0 面，本轮未逐帧对照协议字段，暂判已有等价面，不下细粒度缺口结论。
- `dsh-schedule`（跨现有/新会话持久提醒）：IHUI `automation_thread.py`/`checkin_scheduler.py` 面未逐函数对照，本轮未下结论。
- `dsh-spill-policy`（超预算内容可恢复文本/图像地址定位器）：与已吸收 pruner / `spill_retention.py` 的边界未逐字对照，单列未判定。
- 判为 C 档或与现有层重叠、本轮未展开取证：`dsh-chunked-list`、`dsh-deque`、`dsh-scope`、`dsh-error`、`dsh-launch-environment`、`dsh-http-proxy`、`dsh-shell-env`、`dsh-deliverable-file-references`、`dsh-token-meter`、`dsh-permission-presets`、`dsh-headless`。
- 未碰及组：ui/host 渲染、computer-use/cua-bundle、acp-app 宿主、plugin-market-index/package-inventory、typert 类型反射族、terminal/pwsh/win32-process 进程族、agent-team 变更等待。
- 端侧对照缺口：本文件 IHUI 现状结论仅基于 `apps/ai-service` Python 侧 grep；`apps/api`、`apps/web`、`apps/desktop`、`apps/miniapp-taro`、`packages/*` 未逐文件核验。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
