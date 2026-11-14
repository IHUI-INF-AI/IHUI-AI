<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 【过期快照警告 · 执行前必读】本报告基线 `895027a9d6` 远早于当前 `origin/main`（`e2b004b74940af915320eefa22c8c12093009e7e`）。
> 文中行号与「当场可修」结论大概率已失效，曾被误当作当前真相并误导后续 agent（已因此浪费一轮验证）。
> 凡 `PROJECT_PLAN.md` 引用本报告的任一条目，动手前**必须先对照当前代码复核**（强制纪律见 `RECONCILE-findings-staleness.md` 第四节）。
> 已确认在当前代码修复的条目，见文内 `【已修复@当前代码】` 标注。

# apps/ai-service 深度缺陷普查报告

- 基线：`origin/main` = `895027a9d6`（已 `git fetch origin`，主工作树有未提交改动，**未读取主工作树作为依据**）
- 审计快照：`git archive origin/main apps/ai-service` 解包至 `C:\Users\Administrator\Documents\Trae-CN\default\.audit-aisvc`
- 纪律：全程只读。未改仓库、未提交、未 push、未启动服务、未跑 pytest；本报告是唯一写盘产物。
- 去重源：`PROJECT_PLAN.md`（尤其 2026-11-05 全仓缺陷普查段与 2026-09-19 批 65–70）、`scripts/data/plan-fields.jsonl`。
- 规模：`apps/ai-service` 在基线共 1778 个 `.py`（app 实码 + 971 个测试文件）。本报告聚焦 6 个指定扫描面，逐条给可达路径与源码证据。

## 汇总

| 严重度 | 条数 |
|---|---|
| P0 | 2 |
| P1 | 30 |
| P2 | 73 |
| P3 | 10 |
| 合计 | 115 |

另有「未判定」18 条（证据不足以定性，见文末；其中 3 条已在第 3/5 轮升级为已证实条目）。

> 读法：每条 `file:line` 为基线快照行号；「当场可修」指改动局限、无需迁移/契约变更。

---

## 一、流式与协议

### AIS-001 主对话流把 provider 中途 error 事件当成功收尾
- 严重度：P1
- 位置：`app/routers/llm.py:6868-6964`、`app/routers/llm.py:7009-7027`、`app/routers/llm.py:7251`
- 触发路径：`POST /llm/complete/stream` → `gen()` → `llm_gateway.astream()` 原生适配器（带 tools、或 stepfun/gemini 等）→ 上游在已输出 chunk 后 `yield {"type":"error"}` → `gen()` 的 if 链只处理 chunk/reasoning/tool_calls/done，error 落入兜底 `yield _sse(event_type, event)` 后继续循环 → provider 生成器耗尽 → 循环自然结束 → `finally` 中的成功回调落库。
- 根因：`gen()` 没有 `event_type == "error"` 分支，既不写 `accumulated["error"]` 也不 `return`；`_interrupted_callback_flush` 判据只认 `stream_exiting`，不含"已收到 error"。
- 证据：`elif event_type == "done":`（6911）；`yield _sse(event_type, event)`（6964）；`error=accumulated.get("error")`（7011，但全文件无赋值点）；`if has_association and not accumulated.get("error") and not await request.is_disconnected():`（7251）。
- 影响面：客户端收到 error 帧后 EOF（无 done 终帧）；后端把半截回复按成功落库、无 errorCode/中断标记，重开会话内容比用户实际见过的更短且状态失真。
- 建议修法：新增 `event_type == "error"` 分支：写 `accumulated["error"]`、透传 errorCode 后 `return`；循环外统一校验"必须见过 done 或 error 之一"。
- 当场可修：是。
- 去重：plan 无同源条目。

### AIS-002 原生流式分支"内容后出错"仍记 status=ok 且不补 done
- 严重度：P1
- 位置：`app/core/llm_gateway.py:3526-3605`
- 触发路径：`astream()` 原生分支 → provider 先发 chunk、再 `yield {"type":"error"}` 并正常耗尽 → `finally` 只 aclose → 3552 起的"正常耗尽"记账无条件执行。
- 根因：错误事件只置 `native_sent_content`（3538-3539），没有置错误状态；3552-3598 的成功记账与 `record_llm_outcome(status='ok')` 对"已发内容后的 error"同样生效；3605 `return` 前也无 done 合成。
- 证据：`if isinstance(evt, dict) and evt.get("type") in ("chunk", "reasoning"): native_sent_content = True`（3538-3539）；`yield evt`（3545）；`record_llm_outcome(..., status='ok', ...)`（3567-3575）；`return`（3605）。
- 影响面：ihui_llm_* 指标与 llm_call_logs 将失败请求计为成功、计入可用性与健康度；客户端无 done 终帧；额度/成本口径被污染。
- 建议修法：在循环内遇 `type=="error"` 置 `_native_error=True`；记账分支改为 `status='error'` 并跳过 success 流水；未发 done 时按 provider 能力补一条 done（usage 可为空）。
- 当场可修：是。
- 去重：plan 无同源条目。

### AIS-003 多数原生 provider 无 done 兜底，流可"无终帧"结束
- 严重度：P2
- 位置：`app/providers/openrouter_provider.py:82-108`、`app/providers/anthropic_provider.py:240-300`、`app/core/llm_gateway.py:3599-3605`
- 触发路径：带 tools 的原生请求 → provider 上游正常结束但未返回 usage chunk（OpenRouter 路由到不支持 `include_usage` 的上游；Anthropic 代理少发 `message_stop`）→ 生成器耗尽 → 网关只补 tool_calls 后 `return`，llm.py 永远等不到 done。
- 根因：仅 `openai_provider.py:173-187`/`ollama_provider.py:176-182` 实现 `_done_yielded` 兜底；网关把"done 由 provider 保证"当作契约，实际未保证。
- 证据：`if chunk.get("usage")` → 仅在有 usage 时 `yield {"type":"done",...}`（openrouter 98-104）；`if not _done_yielded and not _errored:`（openai_provider 174）；网关 3599-3605 只 flush tool_calls 后 return。
- 影响面：依赖 done 的收尾 UI、配额记账、中断判定失效；客户端无法区分"正常结束"与"被截断"。
- 建议修法：在网关原生分支统一记录 `_saw_done`，循环结束未见 done 且未 error 时合成 `{"type":"done","usage":...}`（usage 可取估算）。
- 当场可修：是。

### AIS-004 主聊天流等待首 token 期间无 keepalive
- 严重度：P2
- 位置：`app/routers/llm.py:6854`（原生流消费）、`app/routers/llm.py:834`（仅审批等待有心跳常量）、`app/routers/llm.py:6042`（注释承认前端 30s 读超时）
- 触发路径：推理模型/冷启动/重试退避期间上游迟迟无首 chunk，服务端零字节输出，前端 30s 读超时断开 → 服务端取消本可成功的回复。
- 根因：keepalive 只存在于审批/表单/引导等待循环；主上游读取是 `async for` 单循环，没有独立 ticker 注出 `: ping`。
- 证据：`async for event in _native_fc_stream:`（6854）；`_APPROVAL_KEEPALIVE_INTERVAL = 15  # 秒...防前端 30s 读超时掐流`（834）；`前端 streamChat 有 30s 读超时`（6042）。
- 影响面：慢 TTFT 的正常请求被客户端丢弃；用户侧表现为空回复，额度可能照扣。
- 建议修法：起独立 ticker 任务每 15s 产 `: ping`，与上游读取 `asyncio.wait` 竞争；上游首包后停止。
- 当场可修：否（需处理与现有帧水位/取消作用域的交互）。

### AIS-005 Agent 流断线不取消 run，重连即双跑
- 严重度：P1
- 位置：`app/routers/agents.py:1748`、`app/routers/agents.py:1994-2012`、`app/services/agent_run_control.py:221-260`
- 触发路径：`POST /agents/execute/stream` → `run_task = asyncio.create_task(loop.run(...))` → 客户端断开 → `_closing_event_stream` aclose 生成器 → `event_generator` 的外层 `finally` 只做 `sse_buffer.clear(task_id)` / `detach_run` / `release_ownership`，**不 cancel `run_task`** → 后台 run 继续跑；用户重连带旧 Last-Event-ID 时因原缓冲已被 clear 判 `UNKNOWN_TASK`，随后按新 task_id 再起一轮；`register_run` 对同 session 无冲突校验且是覆盖写。
- 根因：后台 run 生命周期与 SSE 生成器解耦，清理路径未收敛任务；缓冲区"任务结束后仍可重放"的 TTL 语义与"收尾立即 clear"互斥。
- 证据：`run_task = asyncio.create_task(`（1748）；`finally:` 中 `sse_buffer.clear(task_id)`（2002-2004）；`for sid in registered_sessions: await detach_run(...)`（2008-2009）；`if not entries: return ReplayOutcome(REPLAY_UNKNOWN_TASK, ...)`（sse_buffer 317-323）。
- 影响面：断线后 LLM/工具继续执行（可能改文件、发消息）、耗额度；同 session 双跑双写，ownership 被覆盖；断线重放窗口实际不可达，前端拿不到 done/usage/error 终态。
- 建议修法：`finally` 中 `if not run_task.done(): run_task.cancel()` 并 `await asyncio.shield(gather(...))`；收尾不立刻 clear，交给 TTL/存活上限；`register_run` 对同 session 增加在途冲突判定。
- 当场可修：是（局部，需回归断线/重连）。
- 去重：plan 未收录。

### AIS-006 客户端断开时仍在 finally 里 yield usage 帧
- 严重度：P3
- 位置：`app/routers/llm.py:7117-7240`
- 触发路径：客户端断开 → `gen()` 在 yield 处收到 GeneratorExit → `_stream_exiting=True` → 外层 `finally` 执行 → 7236 `yield _sse(SSE_USAGE, ...)` 仍无条件执行。
- 根因：hook 失败补发有 `if _stream_exiting` 守卫（7104-7109），usage 帧没有；注释（7118）宣称"覆盖客户端断开"，与实现相反。
- 证据：`if _stream_exiting:`（7105，仅 hook 分支）；`else: for _tail_frame in ...: yield`（7110-7112）；`yield _sse(SSE_USAGE, _usage_frame)`（7236）；`except GeneratorExit: raise`（7237-7239）。
- 影响面：关闭期再 yield 触发 `RuntimeError: async generator ignored GeneratorExit`（被 7240 `except Exception` 吞成 warning），计量帧永远送不出；日志噪声掩盖真实收尾异常。
- 建议修法：7236 前加 `if not _stream_exiting:`，与 hook 分支一致；`end_stream_watermark` 已在 finally（7242-7246），无需调整。
- 当场可修：是。

### AIS-007 中断回调早于用量计算，断线落库用量恒 None
- 严重度：P2
- 位置：`app/routers/llm.py:7015-7027`、`app/routers/llm.py:7208-7235`
- 触发路径：客户端停止/断线 → `finally` 顶部构造 `_interrupted_cb_task`，实参 `usage_detail=_usage_detail`（此时仍是 4406 初始化的 None）→ 同段 finally 后部才计算并赋值 `_usage_detail`。
- 根因：同一次 finally 内"先 fire 后算"，参数在 create_task 时即被求值。
- 证据：`usage_detail=_usage_detail,`（7022）；`_usage_detail: dict[str, Any] | None = None`（4406）；`_usage_detail = {`（7222）。
- 影响面：用户中断的回复落库 usage/costUsd/firstTokenMs 全空；成本与中断统计缺失（正常 done 路径不受影响）。
- 建议修法：把 usage 计算块整体前移到 7009 之前，或中断回调延后到计算完成后 fire。
- 当场可修：是。

### AIS-008 命令流与进度流使用无界队列
- 严重度：P3
- 位置：`app/services/command_streamer.py:450-452`、`app/routers/llm.py:6420/6456`
- 触发路径：工具执行长命令（构建日志/base64/递归 find）→ `stream_command` 建无 maxsize Queue，两个 reader 协程 `await queue.put(...)` 永不阻塞 → 慢客户端反压只能停消费端，内存无界增长。
- 根因：队列未设 maxsize，背压无法传回子进程 pipe。
- 证据：`queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()`（450）；`stdout_task = asyncio.create_task(_read_stream(proc.stdout, "stdout", queue))`（451）。
- 影响面：慢客户端 + 大输出时单流内存增长直至 OOM；子进程继续写 pipe。
- 建议修法：`Queue(maxsize=...)` 并让 reader `await put`（背压到 pipe）；超限丢最旧并显式标记 truncated。
- 当场可修：是。

---

## 二、模型调用 / provider / 计量

### AIS-009 Gemini 原生 usage 键名未归一，token/成本恒为 0
- 严重度：P1
- 位置：`app/providers/gemini_provider.py:211`、`app/core/llm_gateway.py:3542-3544`、`app/core/llm_gateway.py:3892-3905`
- 触发路径：带 tools 的 Gemini 请求走原生分支 → provider 把 `usageMetadata`（camelCase：`promptTokenCount/candidatesTokenCount`）原样作为 usage → 网关 `_native_final_usage = evt["usage"]` 后直接 `int(final_usage.get("prompt_tokens") or 0)`。
- 根因：原生流式路径未调用 `normalize_usage`（该函数只在非流式 2673 与 agent_loop 调用）；计量/成本只认 snake_case。
- 证据：`"usage": data.get("usageMetadata", {})`（gemini 211）；`_native_final_usage = evt["usage"]`（3543）；`int(final_usage.get("prompt_tokens") or 0)`（3896）。
- 影响面：Gemini 调用的 token/cost 全 0；rollout/预算不扣；前端 usage 帧取不到。
- 建议修法：原生分支出口统一 `normalize_usage`（补 `promptTokenCount/candidatesTokenCount/cachedContentTokenCount/totalTokenCount` 别名）后再记账/下发。
- 当场可修：是。

### AIS-010 Gemini 原生工具历史被降级成纯文本
- 严重度：P2
- 位置：`app/providers/gemini_provider.py:90-101`
- 触发路径：agent loop 第二轮把 `assistant.tool_calls` + `role=tool` 结果回传；`tools` 存在 ⇒ 网关 3410-3420 强制走 Gemini 原生 → `_convert_messages` 把所有非 user/system 角色映射为 `role=model` + `{"text": json.dumps(content)}`。
- 根因：未生成 `functionCall` / `functionResponse` 配对；工具结果被当成模型文本。
- 证据：`gemini_role = "user" if role == "user" else "model"`（99）；`parts = [{"text": content}] if isinstance(content, str) else [{"text": json.dumps(content, ensure_ascii=False)}]`（100）。
- 影响面：Gemini 原生多轮工具调用语义错乱（模型看不到调用/结果配对），可能 400 或凭空重复调用；并行同名 id 还会撞车。
- 建议修法：按语义映射：assistant.tool_calls→`functionCall` parts、tool→user turn 的 `functionResponse`（name+id 配对），并保证 id 唯一。
- 当场可修：是（局部映射改造）。

### AIS-011 Gemini 安全拦截（promptFeedback）被当成功空回复
- 严重度：P2
- 位置：`app/providers/gemini_provider.py:156-207`
- 触发路径：Gemini 返回 HTTP 200 但 `candidates=[]`、`promptFeedback.blockReason=SAFETY/OTHER` → `_parse_candidates` 得 `finish_reason=None` → 196-207 的拦截分支只在 `finish_reason in ("SAFETY","RECITATION","BLOCKLIST")` 时生效 → 返回成功空文本。
- 根因：从未读取 `promptFeedback.blockReason`；candidates 为空时无任何失败判定。
- 证据：`for candidate in data.get("candidates", []):`（164）；`if not text and finish_reason in ("SAFETY", "RECITATION", "BLOCKLIST"):`（200）。
- 影响面：用户收到空回复且被记为成功，不触发 fallback/重试。
- 建议修法：complete 读取 `promptFeedback.blockReason` 返回 `error=True`；astream 对应 yield error 并 return。
- 当场可修：是。

### AIS-012 Ollama 流内 error 帧被吞，随后补空 done
- 严重度：P2
- 位置：`app/providers/ollama_provider.py:145-182`
- 触发路径：流建立后上游报错（OOM/模型加载失败），Ollama 输出一行 `{"error": "..."}` → astream 只读 `message`/`done`，该行被当普通 chunk 跳过 → 生成器耗尽 → 兜底 `yield done, usage={}`。
- 根因：无 `chunk.get("error")` 分支。
- 证据：`msg = chunk.get("message", {})`（145）；无 error 判定；`if not _done_yielded and not _errored: yield {"type":"done",...}`（176-182）。
- 影响面：失败被网关/前端判成功，无 fallback/重试，错误信息丢失，usage 为 0。
- 建议修法：解析后先判 `chunk.get("error")` → yield error 并 return（不再补 done）。
- 当场可修：是。

### AIS-013 Anthropic 缓存 token 口径低估，缓存命中近乎免计
- 严重度：P2
- 位置：`app/core/usage_cache.py:47/78-118`、`app/services/cost_ledger.py:317-320`
- 触发路径：Anthropic 原生返回 `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`；`normalize_usage` 的输入别名只取 `prompt_tokens/input_tokens`（不含缓存）→ ledger 再把 cached/cache_write 从 tokens_in 里"钳掉"。
- 根因：Anthropic 的 `input_tokens` 不含缓存读写，但契约要求 `prompt_tokens` 为输入总量；两处口径叠加导致重复扣减。
- 证据：`_INPUT_ALIASES = ("prompt_tokens", "input_tokens")`（usage_cache 附近）；`cached = min(max(int(...), 0), tokens_in)` / `cache_write = min(..., tokens_in - cached)`（cost_ledger 317-320）。
- 影响面：缓存重的请求 tokens_in 被低估甚至钳到 0，成本/预算/账单同步偏低；极端全命中时整单免计。
- 建议修法：Anthropic 分支先归一 `prompt_tokens = input_tokens + cache_read + cache_creation`，再进 ledger；或让 ledger 显式支持"缓存不计入 tokens_in"口径。
- 当场可修：是。

### AIS-014 成本账本所有查询端点可越权查他人/全站
- 严重度：P2
- 位置：`app/routers/cost_ledger.py:36-46`、`:129-148`、`:151-169`、`:171-190`、`:203-...`
- 触发路径：任意登录用户 `GET /api/cost-ledger/summary?user_id=<他人>`；省略 user_id 即全站聚合。`uid = Depends(get_current_user_id)` 只用于日志，`user_id` 查询参数原样进 `_collect`。
- 根因：缺少 `use.py:_scope_user_id` 同款"非管理员强制本人"判定；同仓 usage.py 已实现（`ADMIN_ROLE_ID=1`）。
- 证据：`if user_id: filt["user_id"] = user_id`（45-46）；`uid: str = Depends(get_current_user_id)`（138）；`_collect(user_id, ...)`（142）。
- 影响面：跨用户成本/session/run/tool 明细泄露，省略参数拿到全站。
- 建议修法：复用 `usage._scope_user_id`（非管理员 403/强制 caller）。
- 当场可修：是。

---

## 三、上下文与记忆

### AIS-015 压缩只认第一条 system，其余 system 被静默丢弃
- 严重度：P2
- 位置：`app/core/context_compaction.py:345-361`、`:882-900`、
- 触发路径：请求含多条 system（客户端多段 system；或多模态 system.content 为 list 时 `llm.py:2695-2696` 在 index 1 插入第二条 system）且触发压缩 → `has_system = messages and messages[0].get("role")=="system"` 只保留 messages[0]；摘要循环遇 `role=="system"` 直接 `continue`。
- 根因：把"system 只允许一条"当作不变量；实际入口会造出第二条。
- 证据：`has_system = messages and messages[0].get("role") == "system"`；`system_msgs = [messages[0]] if has_system else []`；`if msg.get("role") == "system": continue`（345-361）。
- 影响面：压缩后注入的记忆图谱/客户端附加系统指令消失，模型行为漂移且无日志。
- 建议修法：所有 system 作为固定前导保留或合并进首条；摘要循环不再跳过 system。
- 当场可修：是。

### AIS-016 图像 part 不计 token，压缩阈值持续低估
- 严重度：P2
- 位置：`app/core/context_compaction.py:240-260`、`:731-779`
- 触发路径：多模态请求 `content=[{type:"image_url",...}]`（data URI 或远程 URL），图片占窗口显著比例；估算只取 `part.text` / `part.content`，`image_url` 两者皆空 → 单图仅计 1 个 overhead；truncate fallback 也只处理字符串 content。
- 根因：token 估算未覆盖 image_url；multimodal 降级缺失。
- 证据：`for part in content: if isinstance(part, dict): text = part.get("text") or str(part.get("content", "")); total += estimate_tokens(text) + MESSAGE_OVERHEAD_TOKENS`（约 250-258）。
- 影响面：压缩不触发或压缩后仍超窗，上游返回 context_length_exceeded；回退路径救不了。
- 建议修法：按 detail 注入固定图片 token 占位（与前端/TS 口径一致）或按字节估算；超限启用多模态专用降级。
- 当场可修：是。

### AIS-017 行为偏好内存降级丢失 user 维度，跨用户串读
- 严重度：P2
- 位置：`app/services/context_engine.py:1541-1567`、`:1640-1643`
- 触发路径：Redis 不可用或 `hincrby` 抛异常 → 写内存 OrderedDict，key 只有 `file_path:symbol`（无 user_id）；随后 `GET /api/context/memory` / enrich 读同一字典返回偏好。
- 根因：Redis 路径 key 为 `context:behavior:{userId}`，内存降级路径未带 user_id；进程内所有用户共用一个字典。
- 证据：`await redis.hincrby(f"{_REDIS_KEY_BEHAVIOR}:{user_id}", key, 1)`（1558）；`self._user_behavior[key] = self._user_behavior.get(key, 0) + 1`（1564）；`for k, v in self._user_behavior.items()`（1642）。
- 影响面：降级窗口内任一用户可读到他人的 workspace 文件/符号偏好键（元数据泄漏）并被他人行为影响排序。
- 建议修法：内存降级改用 `dict[user_id][key]` 或 `OrderedDict[(user_id,key)]`；查询只取当前用户子表。
- 当场可修：是。

### AIS-018 hash 伪向量 128 维与远端 1536 维混存
- 严重度：P2
- 位置：`app/services/vector_memory.py:38`、`:129`、`:449-470`
- 触发路径：embed 远端失败/超时 → 写入 `_HASH_DIM=128` 伪向量；之后正常查询 1536 维；`_cosine_similarity` 用 `n=min(len(a),len(b))` 只比较前 128 维；集合名不含模型/dim 版本。
- 根因：add_entry 无维度校验，混合维度共用同一集合；相似度截断比较。
- 证据：`_HASH_DIM = 128  # hash 伪向量维度`（38）；`n = min(len(a), len(b))`（449）；`return _hash_embedding(text)`（129）。
- 影响面：hash 条目在 1536 查询下基本不可命中；pgvector 维度过滤会把另一维度整批排除；模型升级后旧库失配。
- 建议修法：hash 维度对齐远端或统一 1536；add_entry 校验维度并拒绝/重算；集合名带 embedding model+dim 版本。
- 当场可修：是。

### AIS-019 语义召回先取全局 top_k 再按属主过滤
- 严重度：P2
- 位置：`app/services/context_recall.py:145-159`
- 触发路径：多用户同时有 compacted 记忆且查询嵌入相似 → `store.search(query_embedding, top_k=..., threshold=...)` 未传 user_id → 全局 top_k → 之后才 `continue` 掉他人。
- 根因：属主过滤在应用层后置，没有下推到 SQL/metadata。
- 证据：`hits = await self._store.search(query_embedding, top_k=top_k, threshold=_RECALL_THRESHOLD)`（145）；`if entry.get("user_id") != user_id: continue`（156）；`if session_id and entry.get("session_id") != session_id: continue`（159）。
- 影响面：本人确有匹配记忆却召回为空/变少（非泄漏但功能失效），top_k 越大越易被他人占满。
- 建议修法：user_id 下推到 `search`（pgvector `namespace/metadata` 过滤）；或 over-fetch 后保证过滤后仍满足 top_k。
- 当场可修：否（需改查询接口）。

### AIS-020 thread.export 的 turn 截断把目标回合切成首条
- 严重度：P2
- 位置：`app/services/agent_engine.py:4470-4540`、`app/core/rollout_truncation.py:135-160`
- 触发路径：`ENGINE_ROLLOUT_TRUNCATION_ENABLED=on` 且导出参数带 `truncateAfterTurnId` → 导出记录按 `item.model_dump(mode="json")` 生成，**每条 item 都带 `turn_id`** → `truncate_after_turn_id` 找到目标回合首项后，下一项（同回合第二项）因 `turn_id` 非空被判为下一个 TurnStarted，`cut=idx`。
- 根因：边界判据用"turn_id 是否非空"，而不是"是否是规范 TurnStarted 记录"。
- 证据：`cut = truncate_after_turn_id(records, cut_at.strip(), lambda r: r.get("turn_id") if isinstance(r, dict) else None)`（4530）；`for idx in range(start_idx + 1, len(items)): if turn_started_index(items[idx]) is not None: cut = idx`（rollout_truncation 152-154）。
- 影响面：导出只剩目标回合首项并丢掉后续回合；tool_call/tool_result 可能被拆散；开关默认 off，开启即触发。
- 建议修法：回调改为"type/id 双判"的规范 TurnStarted；store 失败时显式报错而不是静默导出全量。
- 当场可修：是。

---

## 四、并发与资源

### AIS-021 发布核验两处漏 `await conn.close()`，连接泄漏
- 严重度：P1
- 位置：`app/services/publish/metrics_collector.py:299`、`:327`
- 触发路径：每次 `persist_style_check`（写）与 `latest_style_check`（读）各泄漏 1 条 asyncpg 连接；同文件 84 行已修复过同型缺陷。
- 根因：`conn.close()` 返回协程却未 await，`finally` 中的协程从未执行，连接不归还池。
- 证据：299 `finally:` / `conn.close()`；327 `finally:` / `conn.close()`；84 行注释"原句漏 await,close 协程从未执行(连接泄漏)"。
- 影响面：共享池 max_size=30（db_pool.py:109），约 30 次核验后全站 DB acquire 阻塞/超时。
- 建议修法：两处补 `await conn.close()`；顺手全仓 grep `conn.close()` 排查同型。
- 当场可修：是。

### AIS-022 resume 并发闸非原子，同一暂停可续跑两遍
- 严重度：P1
- 位置：`app/services/agent_run_control.py:570-600`、`:650-695`
- 触发路径：用户双击/两个客户端同时 `POST /agents/{sid}/resume` → 两次都在 589 读到 `rec.paused=True` → 各自 `await loader(session_id)` → 加载后才置 running → 两次都通过 → 各调一次 `runner`。
- 根因：检查与置 running 不在同一临界区，中间夹慢 I/O；`live.paused` 在加载后才置 False。
- 证据：`if rec is not None and not rec.paused: return ...NOT_PAUSED`（589-594）；`run_result = await runner(checkpoint, requester)`（689）。
- 影响面：同一消息历史执行两次，工具真实副作用（写文件/发消息/扣费）重复。
- 建议修法：同一把锁内"检查+占位 running"原子完成，失败回滚；rec 缺失退回持久 CAS。
- 当场可修：是。

### AIS-023 发布立即提交绕过每用户并发上限与 task_id 去重
- 严重度：P2
- 位置：`app/services/publish/scheduler.py:245-246`、`:318-340`
- 触发路径：`submit_task(..., scheduled_at=None)` 即时发布；同一 task_id 客户端重放/双击 → 立即分支直接 `_spawn_task`，不看 `_running/_user_running`，计数在任务体内才加。
- 根因：限流/去重只在轮询分支 `_poll_once` 实现，立即分支另起路径。
- 证据：`if self._user_running.get(user_id, 0) >= _MAX_CONCURRENT_PER_USER: continue`（245-246，位于轮询）；`self._spawn_task(self._run_task(...))`（322）；`self._user_running[user_key] = ... + 1`（336）。
- 影响面：单用户可无限并发发布；同 task_id 并发两次发布到外部平台，第二个覆盖 `_running[task_id]`，第一个 finally 又 pop 掉第二个条目。
- 建议修法：立即分支同用 `task_id in self._running` 去重 + 先占位后 spawn；上限检查与占位同锁。
- 当场可修：是。

### AIS-024 定时发布抢占无 CAS，running 行崩溃后永久悬挂
- 严重度：P2
- 位置：`app/services/publish/scheduler.py:230-264`
- 触发路径：两个调度进程（滚动重启/多实例）同时 `_poll_once`；或进程在 UPDATE 后、任务完成前被 kill。
- 根因：SELECT `status='scheduled'` 后按 task_id 无条件 UPDATE；无 `AND status='scheduled'`、无 rowcount 校验、无租约回收；启动只捞 scheduled。
- 证据：`WHERE status = 'scheduled' AND scheduled_at <= $1`（234）；`UPDATE publish_tasks SET status='running', ... WHERE task_id=$2`（260）。
- 影响面：同一任务被两实例重复发布；kill -9 后行永远 running，重启不回收。
- 建议修法：`UPDATE ... WHERE task_id=$1 AND status='scheduled'` 检查 rowcount，或 `FOR UPDATE SKIP LOCKED`；启动扫 stale-running。
- 当场可修：是。

### AIS-025 DAG 队列持久化只写不读，重启即丢
- 严重度：P2
- 位置：`app/services/dag_scheduler.py:660`、`:711-727`、`:1156-1163`
- 触发路径：ai-service 正常发布/重启时，已 submit 的 todo/running 任务只存在于进程内 `asyncio.PriorityQueue`。
- 根因：`_persist` 写 `kanban:task:{id}`，全仓无读取/恢复侧；`start()` 只起 worker。
- 证据：`持久化:REDIS_URL 可用时持久化任务状态到 Redis`（660）；`await self._redis.set(f"kanban:task:{task.id}", ...)`（1161）；`start()` 内仅 `asyncio.create_task(self._worker_loop(wid))`（711-727）。
- 影响面：重启后未执行任务静默消失；Redis 留永久 stale 记录。
- 建议修法：`start()` 前扫描 `kanban:task:*`：todo 重新入队、running 置 blocked 并 emit。
- 当场可修：是。

### AIS-026 sandbox 本地执行不处理取消，取消后子进程继续跑
- 严重度：P2
- 位置：`app/services/sandbox.py:515-555`
- 触发路径：dag worker 超时 `executor_task.cancel()` 或服务关停取消执行任务，命令正卡在 `communicate()`。
- 根因：只有 `TimeoutError` 分支 `proc.kill()`；`CancelledError` 是 BaseException，不被 `except Exception` 捕获；该函数无 finally 兜底。
- 证据：`stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=timeout)`（516）；`except TimeoutError:`（520）；`proc.kill()`（522）；`except Exception as e:`（549）。
- 影响面：宿主上用户命令在超时/关闭后继续运行（写文件、占 CPU）；超时 kill 后也未 `await proc.wait()`，留未回收句柄。
- 建议修法：包 `try/finally`：`proc.returncode is None → kill + await wait`；`except asyncio.CancelledError` 走同一回收后 raise。
- 当场可修：是。

### AIS-027 增量索引写/删失败仍落快照，索引永久陈旧
- 严重度：P1
- 位置：`app/services/codebase_incremental_index.py:205-230`、`app/services/codebase_indexer.py:1119-1123`
- 触发路径：文件监听/增量索引开启；写库批次抛错、删除 API 4xx/超时、或全部切片失败；失败仅 `result.errors.append`，`new_hashes` 不回滚/不标 dirty，随后仍 `_save_snapshot(new_hashes)`；删除失败时幽灵条目已从快照 files 移除。
- 根因：失败与"已索引"状态未分离；下一轮按 hash 判 unchanged 永不重试。
- 证据：`except Exception as e:  # noqa: BLE001 - 与全量同形:批次失败点名,快照照常收敛`（约 224）；`result.errors.append(f"写入批次 {i}-{i + len(batch)} 失败: {e}")`；`indexer._save_snapshot(...)`；删除侧 `if resp.status_code >= 400: ... return 0`（1119-1123）。
- 影响面：新增/修改代码检索不到、已删文件仍被召回；助手基于旧代码作答且状态显示"已索引"。
- 建议修法：失败批次从 `new_hashes` 剔除并写持久 dirty 集合；删除失败保留在快照 files；全量/增量共用提交语义。
- 当场可修：是。

### AIS-028 sandbox 任务队列记录与句柄永不回收
- 严重度：P2
- 位置：`app/services/sandbox_task_queue.py:95-97`、`:122`、`:230-231`
- 触发路径：`/agent-runtime/queue/*` 持续入队/重放，任务结束后记录仍驻留。
- 根因：`_tasks/_handles/_lanes` 只增不减；无终态 TTL 淘汰、无 done_callback 摘句柄。
- 证据：`self._tasks: dict[str, SandboxTask] = {}`（95）；`self._handles[...] = asyncio.create_task(self._run_one(record, lane))`（230-231）。
- 影响面：长跑后内存/句柄单调增长，`stats/list_tasks` 变慢；`record.result` 含完整日志，驻留成本高。
- 建议修法：`add_done_callback` 摘 `_handles`；终态记录按 TTL/条数 LRU 淘汰；lane 空置回收。
- 当场可修：是。

### AIS-029 browser_hub 会话无上限，失败路径只 close 不摘账
- 严重度：P2
- 位置：`app/services/browser_hub.py:1183`、`app/routers/browser_hub.py:158-163`
- 触发路径：已登录用户反复 `POST /api/browser-hub/sessions`；或创建成功但页面随即被平台关闭。
- 根因：`_sessions` 无上限/无 idle TTL；router 的 502 兜底只 `session.close()`（关 context），不调用 `hub._close_session_internal`，`_sessions/_tab_registry` 保留死会话。
- 证据：`self._sessions[session_id] = session`（1183）；`await session.close()` / `raise HTTPException(status_code=502, ...)`（routers/browser_hub.py 162-163）。
- 影响面：单用户可无限创建 Chromium BrowserContext（内存/句柄耗尽）；死会话使 `list_sessions` 虚高且 `require_tab` 返回不可用 tab。
- 建议修法：失败分支改 `await hub.close_session(...)`；hub 加 per-owner 上限 + idle TTL 回收。
- 当场可修：是。

### AIS-030 self_media 调度 stop 不取消在途任务
- 严重度：P3
- 位置：`app/services/self_media_scheduler.py:97-104`、`:139-145`
- 触发路径：应用关闭（main lifespan 调 `self_media_scheduler.stop()`）时 `_run_koubo/_run_wechat` 正在执行。
- 根因：`stop()` 只取消主循环 `self._task`，`_pending_tasks` 未 cancel/await。
- 证据：`self._pending_tasks: set[asyncio.Task[None]] = set()`（97）；`self._task.cancel()`（143）；`await self._task`（144-145）。
- 影响面：关停后后台任务继续出网/写文件，孤儿输出。
- 建议修法：`stop()` 遍历 `_pending_tasks` cancel 并 `gather(return_exceptions=True)`，随后清集合。
- 当场可修：是。

---

## 五、安全

### AIS-031 `run_in_background` 非管理员可执行任意 argv，等价 RCE
- 严重度：P0
- 位置：`app/services/mcp_server.py:10468-10473`（设计注释）、`:13054`（工具注册）、`app/services/task_executors.py:580-602`
- 触发路径：任意登录用户在会话/工作流中调用工具 `run_in_background`，参数 `{"task":"long_running_command","command":["python","-c","..."]}` → `_tool_run_in_background` 原样转发 → `_exec_long_running_command` 用 `create_subprocess_exec` 执行任意 argv，仅过 `dangerous_command_match`（只判 rm 强制删除等破坏性命令，`python -c` 判"安全"）。
- 根因：`run_in_background` 被设计注释当作"只读/低危"排除在 `_ADMIN_ONLY_TOOLS` 之外，但其 `long_running_command` 执行器可任意起进程；与 admin-only `run_command` 的前缀白名单形成管控落差。
- 证据：`run_in_background` 不在 `_ADMIN_ONLY_TOOLS`（10468-10473 注释明写"只读/低危,不进 _ADMIN_ONLY_TOOLS"）；`_assert_command_not_dangerous(argv)`（591）；`run = await run_command(argv, task_id=ctx.task_id, cwd=cwd, ...)`（596）；`argv = [str(x) for x in raw_command]`（582-583）。
- 影响面：任何已登录用户（含被网页/工具结果注入的模型）获得服务进程任意代码执行；可持久化、可读密钥、可写工作区外（取决于 cwd 约束）。
- 建议修法：`run_in_background` 加入 `_ADMIN_ONLY_TOOLS`；`long_running_command` 复用 `exec_policy` 前缀白名单并拒绝 `-c/-e/--eval` 类代码参数；或在 `task_executors` 入口校验 `__user_role`。
- 当场可修：是。
- 去重：plan 第 51 项只记录了该工具的真实任务类型，未记录此提权面。

### AIS-032 `/api/v1/ai/chat` 用客户端 session_id 反推身份
- 严重度：P1
- 位置：`app/services/conversation.py:456-468`、`:699`、`:773`、`:807`、`:952-953`；`app/api/v1/chat.py:40-62`
- 触发路径：任意登录用户 `POST /api/v1/ai/chat`，`session_id="<受害者uuid>:x"` → `_resolve_user_id(sid)` 取冒号首段作为 user_id → 历史读取/记忆写入/工具执行都用该 id。
- 根因：v1 端点不取 JWT 主体，身份来自 body 中可控的会话键；`memory_store.add/get(sid)` 不带 user_id 时 key 为 `memory:{sid}`，`"victim:session"` 恰好等于受害者的 `memory:victim:session`。
- 证据：`def _resolve_user_id(sid: str) -> str:` / `if sid and ":" in sid: head = sid.split(":", 1)[0].strip()`（456-464）；`await memory_store.add(sid, "user", user_input)`（699）；`history = await memory_store.get(sid, limit=20)`（773）；`_execute_tool_call(name, args, user_id=user_id, session_id=sid)`（952-953）。
- 影响面：读他人对话历史/画像/长期记忆；以受害者身份调用 app-control 等工具（写操作、审批）；会话被污染。
- 建议修法：路由取 `Request` + `get_current_user_id`，session_id 只作会话键并与主体绑定校验；删除 `_resolve_user_id` 的身份语义。
- 当场可修：否（需改 API 契约/调用链签名）。

### AIS-033 `/api/v1/ai/rag` 检索不传属主，跨用户返回文档内容
- 严重度：P1
- 位置：`app/api/v1/rag.py:59-70`、`app/services/rag.py:562-577`、`app/services/vector_memory.py:494-509`
- 触发路径：任意登录用户 `POST /api/v1/ai/rag`（session_id 留空或填他人 sid）→ `_vector_retrieve` 调 `vector_memory.search(query_embedding, top_k, threshold)` 未传 user_id → 全量检索；关键字路按全量 `list_sessions()` 聚合。
- 根因：检索端点完全不解析主体；`vector_memory.search` 文档明确"user_id=None 仅限进程内可信调用方，HTTP 端点必须传认证身份"，此处违反。
- 证据：`async def rag_query(req: RAGQueryRequest)`（无 Request/身份）；`results = await vector_memory.search(query_embedding=..., top_k=..., threshold=0.0)`（562-567）；`if session_id is not None and entry.get("session_id") != session_id: continue`（577）。
- 影响面：`sources.content` 原样回给调用方 → 他人上传文档/对话片段跨租户泄露。
- 建议修法：rag_query 取主体并透传到 `_retrieve`，给 `search(user_id=...)`；同时校验 sid 归属。
- 当场可修：是（两处签名小改）。

### AIS-034 知识图谱属主取客户端 `X-Owner-Uuid`，可读/写/删他人图谱
- 严重度：P1
- 位置：`app/api/v1/knowledge_graph.py:49`、`:74-79`、`:126-130`、`:151-156`
- 触发路径：任意登录用户 `GET/DELETE /api/v1/ai/knowledge-graph/data` 带 `X-Owner-Uuid: <受害者uuid>`；`POST /build` 同理。
- 根因：owner 只来自可整写请求头，未与 JWT 主体比对，无归属校验；无 header 时全站共用 `anonymous` 命名空间。
- 证据：`x_owner_uuid: str | None = Header(default=None, alias="X-Owner-Uuid")`；`owner = x_owner_uuid or "anonymous"`；`graph = await graph_store.get_graph(owner)`；`await graph_store.clear(owner)`。
- 影响面：读/覆盖/清空他人知识图谱（文件快照 json.dump 持久化，删除不可逆）。
- 建议修法：改为 `Depends(get_current_user_id)` 取 owner，忽略/覆盖该头。
- 当场可修：是（4 个端点换身份来源）。

### AIS-035 computer-use `open` 无 URL 校验，`file://`/内网经 extract-text 回读
- 严重度：P2
- 位置：`app/routers/computer_use.py:567`、`:749-759`
- 触发路径：已登录用户 `POST /api/computer-use/open` 打开 `file:///C:/...` 或 `http://127.0.0.1:xxxx/`，再 `POST /api/computer-use/extract-text` 取 `document.body.innerText`。
- 根因：`page.goto(body.url)` 无 scheme/host 白名单、无 SSRF 校验、无请求拦截；Chromium 在服务端运行。
- 证据：`await page.goto(body.url, timeout=body.timeout_ms, wait_until="domcontentloaded")`（567）；`text = await page.evaluate("() => document.body ? document.body.innerText : ''")`（749-751）；`"text": text[:50000]`（759）。`OpenRequest.url` 为普通 `str`。
- 影响面：登录用户越权读取服务器本地文本文件（日志/配置/密钥文件若为文本）及内网/云元数据页面。
- 建议修法：`open` 只允许 http/https，每跳做 SSRF 校验（禁私有网段/回环/链路本地/非 http(s)）；显式禁 `file:`/`javascript:`/`data:`。
- 当场可修：是。

### AIS-036 `notify` 动作以 `channel="webhook"` 绕过高危白名单并盲 SSRF
- 严重度：P2
- 位置：`app/services/hook_engine.py:1304-1317`、`:1127-1160`、`app/routers/hooks.py:156`
- 触发路径：任意登录用户创建 Hook：`action.type="notify"`、`config={"channel":"webhook","url":"http://127.0.0.1:... 或 http://169.254.169.254/...","method":"GET/POST","headers":{...}}`，再 `POST /hooks/emit` 触发。
- 根因：`_validate_action` 只按 `action.type` 判高危（`notify` 不在 `HIGH_RISK_ACTIONS`），但 `_run_notify` 见到 `channel=="webhook"` 直接复用 `_run_webhook`；后者对 url 无协议/内网校验。
- 证据：`if channel == "webhook":`（1308）；`result, err = await self._run_webhook(webhook_config, event, context)`（1317）；`url = config.get("url")`（1130）；`await client.request(method, url, headers=headers, content=body_text ...)`（约 1155）。
- 影响面：非管理员获得任意地址、任意方法的盲 SSRF（内网端口探测、对无鉴权内部服务写请求、云元数据 GET），响应状态码回显。
- 建议修法：`notify` 的 webhook 渠道同样过 SSRF 校验；`channel=webhook` 视同 `type=webhook` 受 `HOOK_ALLOWED_ACTIONS` 管控。
- 当场可修：是。

### AIS-037 `/api/spec/generate` 的 workspacePath / scope.path 无工作区白名单
- 严重度：P2
- 位置：`app/services/spec_generator.py:218`、`:231`、`:599-608`；`app/routers/spec.py:37/48/101/148`
- 触发路径：已登录用户 `POST /api/spec/generate`，`workspacePath="C:\\"`、`scope={"type":"dir","path":"Users\\Administrator"}` → 返回全盘/跨用户工作区结构与符号；`_persist_spec` 以未校验根 `mkdir` + `write_text`。
- 根因：`_collect_files_report` 对绝对路径直接 `Path(scope_path)`；同模块未调用 `assert_workspace_root`（LSP/knowledge/patch 均已调用）。
- 证据：`target = (root / scope_path).resolve() if not Path(scope_path).is_absolute() else Path(scope_path)`（218）；`base = ... else Path(scope_path)`（231）；`root = Path(workspace_path).resolve()` … `specs_dir.mkdir(parents=True, exist_ok=True)` … `latest_path.write_text(spec_md, ...)`（599-608）；`def generate` 全文件无 `assert_workspace_root`。
- 影响面：跨工作区/跨用户文件枚举与符号级侦察；任意可写目录创建 `.ihui-agent/specs` 落盘。
- 建议修法：路由入口 `workspace_path = assert_workspace_root(req.workspacePath)`；`scope.path` 必须相对且 `resolve().is_relative_to(root)`。
- 当场可修：是。

### AIS-038 Hook PATCH 可绕过管理员校验改建 script 动作
- 严重度：P1
- 位置：`app/routers/hooks.py:316-318`（update）对照 `:202-208`（create）
- 触发路径：任意登录用户把自有 hook `PATCH /api/hooks/{hook_id}`，body 的 `action.type="script"` → `update_hook` 只调 `_validate_action`（白名单）→ 触发时 `hook_engine.py:1216-1233` 用 `create_subprocess_exec("sh -c"/"cmd /c")` 以服务账号执行。
- 根因：归属/角色校验只在 create 与 instantiate 实现，update 漏挂；`_validate_action` 不含 `_is_admin`。
- 证据：`if req.action is not None: _validate_action(req.action); patch["action"] = _to_hook_dict(req.action)`（316-318）；对照 create：`if req.action.type == "script" and not _is_admin(request): raise HTTPException(status_code=403, ...)`（206-207）。
- 影响面：任意登录用户以服务身份执行任意命令；审计只记 `PATCH /api/hooks/...` 无主体。
- 建议修法：update 分支补 script 管理员校验；在 `hook_engine.update_hook` 再兜一层。
- 当场可修：是。

### AIS-039 全局预算配置可被任意登录用户改写
- 严重度：P1
- 位置：`app/routers/orchestration.py:443-452`（router 声明 `:52`，整个 router 无 `Depends`）
- 触发路径：`PATCH /api/orchestration/budget/config` → `update_budget_config` → `llm_budget_governor.update_config`；`/budget/pillar/{p}/reset` 同理。
- 根因：orchestration router 无任何 `Depends(require_user/permission)`，JWT 中间件只保证"登录"；全局运维配置未做角色校验，仅靠前端隐藏。
- 证据：`@router.patch("/orchestration/budget/config")`；`config = await llm_budget_governor.update_config(config_update)`；`daily_token_limit … hard_stop_at`（188-195 全可写）。
- 影响面：任意成员可把 `hard_stop_at/auto_degrade_at/daily_cost_limit_usd` 调高或重置降级 → 全站预算保护失效、成本失控。
- 建议修法：挂 `require_permission(ADMIN_*)` 或 `_is_admin` 403；变更写审计带主体。
- 当场可修：是。

### AIS-040 自助媒体全局发布任务管理端点无鉴权/归属
- 严重度：P2
- 位置：`app/routers/self_media.py:752-760`、`:784-792`
- 触发路径：任意登录用户 `POST /api/self-media/automation/tasks/{task_id}/trigger|toggle|config`；`list_tasks` 固定返回两条全局任务。
- 根因：端点无 `require_user`/角色依赖；`self_media_scheduler` 是进程级单例、任务无 owner。
- 证据：`async def automation_trigger_task(task_id: str) -> dict[str, Any]:`；`result = await self_media_scheduler.trigger_task(task_id)`（无任何身份入参）。
- 影响面：普通用户可立即触发/停用/改定时对外发布任务，无主体可追溯。
- 建议修法：写端点加 admin 门；审计记录 actor。
- 当场可修：是。

### AIS-041 流会话 steer / tool-result 端点缺属主校验
- 严重度：P2
- 位置：`app/routers/llm.py:7291-7305`、`:7876-7903`；注册处 `:4431`、`:6253`
- 触发路径：`POST /api/llm/complete/stream/{session_id}/tool-result`、`.../steer`、`.../steer/withdraw` → 只按 session_id 取全局 dict，无 JWT 主体入参。
- 根因：同族审批端点走 `_resolve_owner_uuid` 并精确比对（7313-7331），这两个端点未接；注册时 `_steer_sessions[session_id]=[]` 不存 owner。
- 证据：`session = _delegate_sessions.get(session_id)`；`session["result_" + tool_call_id] = {"result": result, "error": error}`；`queue = _steer_sessions.get(session_id)`。
- 影响面：知道/猜到 session_id 的登录用户可伪造工具结果、注入引导文本、撤回他人消息。
- 建议修法：注册时落 owner_user_id；端点加 `Depends(get_current_user_id)` 比对，不匹配统一 404。
- 当场可修：是。

### AIS-042 `/api/publish/running` 无主体，回全站发布历史
- 严重度：P2
- 位置：`app/routers/publish.py:1291-1294`；`app/services/publish/scheduler.py:409-418`
- 触发路径：任意登录用户 `GET /api/publish/running`。
- 根因：端点无 `Request`/`_get_user_id`，直接返回调度器全局内存表。
- 证据：`async def list_running_tasks() -> dict[str, Any]:`；`return _wrap_ok({"running": publish_scheduler.list_running(), "history": publish_scheduler.list_history(limit=20)})`；`self._append_history({"task_id":..., "user_id": user_id, ...})`（409-418）。
- 影响面：泄露他人 task_id、user_id、发布摘要与各平台 results（含 published_url）。
- 建议修法：加 `Request` 取 user_id，按 user_id 过滤（admin 可全局）。
- 当场可修：是。

### AIS-043 SSO 回调不校验 state，且默认启用 mock provider
- 严重度：P2
- 位置：`app/routers/sso.py:74-90`、`:166-183`；`app/core/sso.py:134-159`、`:414`
- 触发路径：任意可达 `/api/sso/callback` 的请求 `POST {provider:"mock", code:"x"}`，或重放/伪造 OIDC code。
- 根因：`new_state()` 生成后无存储校验，回调 `code, _state = parse_callback_params(q)` 丢弃 state；`SSO_PROVIDERS` 缺省 `["mock"]`，mock 对任意非空 code 返回固定 `mock-user-1`。
- 证据：`"""跳转到 IdP 授权页(CSRF state 生成后随 query 传出,存储留 P2)。"""`；`state = new_state()`；`code, _state = parse_callback_params(q)`；`return UserIdentity(subject="mock-user-1", ...)`；`未设置时默认提供 mock(开发便利)`。
- 影响面：登录 CSRF/授权码重放；生产若未配 SSO_PROVIDERS，任何人可换到同一 mock 账户 token（身份混池）。
- 建议修法：服务端存 state/Cookie 并在回调比对；OIDC 校验 nonce/PKCE；生产默认禁用 mock。
- 当场可修：是（加 state 存储 + 关闭 mock 缺省）。

### AIS-044 timeline 会话归属 fail-open
- 严重度：P3
- 位置：`app/routers/timeline.py:28-49`
- 触发路径：任意登录用户 `GET /api/timeline?session_id=<他人sid>`。
- 根因：`_find_session` 仅内存→Redis 回填；为 None 时跳过全部校验；owner 为空也放行。
- 证据：`session = agent_runtime._find_session(session_id)`；`if session is not None:`；`if owner and owner != user_id and not is_admin:`（35-36）。
- 影响面：Redis 关闭/进程重启/旧无属主会话时可读他人 step/tool/cost/checkpoint 事件流。
- 建议修法：会话取不到即 404；owner 为空视为不可读；与 `_require_session` 单源。
- 当场可修：是。

### AIS-045 WorkBuddy task-run 无在途锁/幂等键
- 严重度：P2
- 位置：`app/routers/checkin.py:499-527`、`:1566-1569`
- 触发路径：同一账号双击/重试 `POST /api/checkin/accounts/{id}/task-run`，或手动触发与定时巡检同时命中同一账号。
- 根因：手动链路与调度链路都直接 `workbuddy_tasks.run_family`，无 per-account 在途锁/幂等键；`_outbound_risk_precheck` 只查全局暂停与冷却。
- 证据：`return await workbuddy_tasks.run_family(body.kind, account["jwt"], device_map, dry_run=body.dry_run)`（526-527）；`result = await workbuddy_tasks.run_family(kind, acc["jwt"], device_map, dry_run=dry_run)`（1568-1569）。
- 影响面：同账号同族并发 claim/上报，重复领取或重复计分（上游非全幂等），放大限流/封号风险。
- 建议修法：以 `(account_id, kind, 轮次/自然日)` 为幂等键，手动与 scheduler 共用 per-account 锁。
- 当场可修：是。

---

## 六、错误码与可观测性

### AIS-046 审计双数据源 + 成功码不一致
- 严重度：P2
- 位置：`app/routers/audit.py:40`、`app/main.py:1433-1446`
- 触发路径：`GET /api/audit/logs`（`AUDIT_READ`）读 `audit_log_store`；`GET /api/audit/recent` 读 `audit_service._buffer`。
- 根因：两套存储互不相通：`audit_log_store` 仅 cloud_runs 写入；中间件把所有写请求写入 `audit_service`/`audit_logs`；且一个 `code:0`、另一个 `code:200`。
- 证据：`data = audit_log_store.query(...)`（40）；`return {"code": 200, "message": "ok", "data": audit_service.get_recent(limit=limit)}`（1442-1446）。
- 影响面：管理端审计日志只能看到 cloud_run 两条动作，hooks/预算/用量等写操作全部不可见；前端按 `code===0` 判成功时 `/audit/recent` 被误判失败。
- 建议修法：统一数据源（以 DB/audit_service 为准）；`/audit/recent` 改 `code:0`；两接口明确分工。
- 当场可修：部分（成功码可当场改；数据源合并需决策）。

### AIS-047 HTTP 写审计无操作主体，落库列也丢 user_id
- 严重度：P2
- 位置：`app/middleware/audit.py:49-59`、`app/services/audit_service.py:232-241`
- 触发路径：`main.py:1141` 注册 AuditMiddleware → 所有 POST/PATCH/PUT/DELETE 调 `log_agent_action(agent_id="system", ...)`；`AuditEntry` 支持 `user_id` 但从不传；`_persist_entry` 的 INSERT 列无 user_id。
- 根因：中间件未从 `request.state.user_id` 取值；落库 SQL 也不持久化。
- 证据：`audit_service.log_agent_action(agent_id="system", action=f"{request.method} {request.url.path}", ...)`（49-59）；`INSERT INTO audit_logs (action, resource_type, resource_id, details, created_at) VALUES ($1,$2,$3,$4::jsonb,$5::timestamptz)`（232-235）。
- 影响面：事后无法定位"谁改了 hook/预算/发布任务"，合规与追责断链。
- 建议修法：中间件取 `request.state.user_id` 传入；INSERT 增加 user_id 列（配迁移）；action 同时记 method+path。
- 当场可修：部分（传参可当场改，落库需迁移）。

### AIS-048 路由异常被转成 HTTP 200 + body code:500，并回吐 str(e)
- 严重度：P2
- 位置：`app/routers/hooks.py:230-231`（同型 248-249/265-266/278-279；`orchestration.py:429-430/451-452` 等约 30 处）
- 触发路径：`POST /api/hooks/auto-orchestrate`、`/hooks/ab-test`、`PATCH /api/orchestration/budget/config` 等 → `except Exception` 直接 return dict → FastAPI 返回 200。
- 根因：路由自捕获异常且不 raise/不定 HTTP 状态；成功语义 `code:0`，错误用 `code:500`，与 `/api/llm/*` 的 `_error_json`（4xx/5xx + code:1）不一致；`str(e)` 直接外泄。
- 证据：`try: … return {"code": 0, "message": "success", "data": data} except Exception as e: return {"code": 500, "message": str(e), "data": None}`（hooks.py 227-231）。
- 影响面：监控/网关按状态码统计看不到故障；客户端按 200 成功处理；内部异常细节回吐给任意登录用户。
- 建议修法：统一 raise `HTTPException(500)` 或 `JSONResponse(500, {"code":1,...})`，message 用固定文案、细节仅进日志。
- 当场可修：是。

### AIS-049 自助媒体历史查询吞 DB 异常返回空列表
- 严重度：P3
- 位置：`app/routers/self_media.py:250-279`
- 触发路径：`GET /api/self-media/wechat/history`、`/koubo/history` → `_fetch_history` 查询失败（表缺失/列不匹配/权限/DB 故障）。
- 根因：一律 `return []`，HTTP 200 呈现"无历史"；warning 只带异常，不带 category/limit。
- 证据：`except Exception as e: logger.warning("self_media._fetch_history query 失败: %s", e, exc_info=True) # 表不存在 / 列不匹配 → 降级返回空 ... return []`。
- 影响面：把 DB 故障当成"没有发布记录"；日志无法定位 category/limit。
- 建议修法：仅对 `UndefinedTableError` 精确降级，其余 raise 500；日志补 `category/limit`。
- 当场可修：是。

---

## 第 3 轮补扫结果（新增 30 条：AIS-050 ～ AIS-079）

扫描面：`mcp_server.py` 工具实现层、`task_executors.py`、`workflow_runner.py`、`agent_loop_v2.py`/`agent_engine.py` 深层、`app/providers/*` 全量、未审路由族（publish/recap/meta_learning/ai_skills/knowledge/agent_runtime/usage）。以下每条均回源核对过行号与原文。

### AIS-050 媒体工具按本地路径读任意文件并外传
- 严重度：P1
- 位置：`app/services/mcp_server.py:8918-8999`（同型 `:9336-9417`、`:9500-9623`）
- 触发路径：任意登录用户（role=0）→ `call_tool("token6688_upload_file", {"path": "<任意路径>"})` → `os.path.isfile` 通过 → `open(path,"rb").read()` → `inst.upload_file(...)` 出站到 token6688，返回公网 URL。`token6688_voice_clone`、`audio_transcription` 的本地 path 分支同型。
- 根因：三个工具都不在 `_ADMIN_ONLY_TOOLS`（名单见 `:781-822`），path 分支只做存在性/大小检查，未过 `_validate_path_in_workspace` 的敏感文件判据。
- 证据：`if not os.path.isfile(path): ...`（8942）；`with open(path, "rb") as _f: data = _f.read()`（8955-8956）；`file_url = await inst.upload_file(data, filename, purpose=purpose)`（8995）。
- 影响面：`data/sessions.db`、`.env`、私钥等被读出并上传到第三方（等同密钥泄露 + 外部计费）；另两个 ASR/声纹工具把任意音频/视频内容送第三方。
- 建议修法：本地 path 分支统一走 workspace/敏感文件校验（与 `read_file` 同一判据）；token6688 系列整体收进 admin 档。
- 当场可修：是。

### AIS-051 截图自检工具是 `screenshot_url` 的旁路（SSRF + 越权）
- 严重度：P1
- 位置：`app/services/mcp_server.py:5836-5910`、`app/tools/browser_selfcheck.py:224`
- 触发路径：role=0 → `browser_selfcheck_screenshot` / `browser_selfcheck`，`url=http://127.0.0.1:<port>` 或 `http://169.254.169.254/...` → `capture_screenshot` 仅 `_validate_scheme` 后 `page.goto`，返回截图 base64/title。
- 根因：`screenshot_url` 因 SSRF 被限 admin（`:793-795`），但同能力的两个自检工具未入名单，且 capture 层不做私网/回环拦截与逐跳复检。
- 证据：`ok, reason = _validate_scheme(url)`（browser_selfcheck.py:224）；`_ADMIN_ONLY_TOOLS` 中只有 `"screenshot_url"`（795）。
- 影响面：内网端口/云元数据盲探测；管理档的 SSRF 限制可被同能力工具完整绕过。
- 建议修法：两工具加入 admin 档；capture 前置 `_validate_url_ssrf` + 钉 IP + 禁重定向/逐跳复检。
- 当场可修：是。

### AIS-052 run_workflow 节点可直达任意命令执行（绕过 run_command 档位）
- 严重度：P0
- 位置：`app/services/mcp_server.py:11233-11255`、`app/services/workflow_runner.py:120-124`、`app/services/task_executors.py:580-610`、`:1471-1509`
- 触发路径：role=0 → `call_tool("run_workflow", {"nodes":[{"id":"n1","agent":"long_running_command","arguments":{"command":["python","-c","<任意代码>"]}}]})` → `run_workflow` → `_dispatch_agent` → `execute_task("long_running_command")` → `_exec_long_running_command` → `run_command(argv)`。
- 根因：`run_workflow` 未入 `_ADMIN_ONLY_TOOLS`（`:781-822`），节点 `agent` 是用户完全可控的 task_type；`execute_task` 无角色参数、无审批闸；`_exec_long_running_command` 只调用 `_assert_command_not_dangerous`（denylist），而 `run_command` 工具本身的 admin 档 + exec_policy 审批在这里全不生效。
- 证据：`result = await run_workflow(arguments.get("nodes"), principal=_uid, ...)`（11250）；`return await execute_task(agent, arguments, user_id=principal)`（workflow_runner:124）；`_assert_command_not_dangerous(argv)`（task_executors:591）；`async def execute_task(... user_id: str | None = None ...)`（1471-1477，无 role）。
- 影响面：任意登录用户获得任意 argv 执行（起进程、读文件、外联），等同 RCE；denylist 无法覆盖解释器/脚本执行。
- 建议修法：`run_workflow` 收进 admin 档；`execute_task` 增加 role/审批上下文，`long_running_command` 走与 `run_command` 同一白名单+审批；节点 agent 限定只读子集。
- 当场可修：是（需同时改 mcp_server 入参与 executor 签名）。

### AIS-053 外部 MCP server 注册按设计跳过 SSRF 校验
- 严重度：P2
- 位置：`app/services/mcp_client.py:683-687`、`:780-790`、`app/routers/mcp.py:555-578`
- 触发路径：登录用户 `POST /api/mcp/external/servers`（transport=sse，url=`http://127.0.0.1:6379` 等）→ 服务端发起 SSE 连接；SSE 首帧 `endpoint` 被直接记为后续 POST 落点。
- 根因：注册侧只校验 scheme；客户端注释明示"刻意不套 `_validate_url_ssrf`"；`endpoint` 与注册 host 无同源约束。
- 证据：`刻意不在这里套 _validate_url_ssrf`（mcp_client.py:683）；`self._sse_post_url = data_lines[0]`（约 785）；`普通用户仍能注册远程 MCP`（routers/mcp.py:561）。
- 影响面：内网端口盲探测；远端可指定 POST 落点，把本地配置/凭据发往任意地址。
- 建议修法：注册/连接按部署落点策略（禁私网/回环/链路本地）；`endpoint` 必须与注册 host 同源并逐跳过 SSRF 尺。
- 当场可修：否（需落点策略配置，属部署/配置面）。

### AIS-054 web_search 失败被包装成成功 + 空结果
- 严重度：P2
- 位置：`app/services/mcp_server.py:4296-4329`
- 触发路径：网络失败/解析失败 → `_tool_search_web` 返回 `ok:false` → `web_search` 仍返回 `ok:true, results:[]`。
- 根因：包装层只取 `results/total/message`，丢弃 `ok/error/errorCode`；query 为空也返回 `ok:true`。
- 证据：`sub_result = await _tool_search_web(...)`；`"ok": True, ... "results": sub_result.get("results", [])`（4321-4329）。
- 影响面：模型把检索故障当"无结果"，重复检索或据此编造；前端无法按 errorCode 提示。
- 建议修法：`"ok": sub_result.get("ok", True)`，透传 `error/errorCode`；空 query 返回 `ok:false/MISSING_PARAMS`。
- 当场可修：是。

### AIS-055 后台任务注册表只增不减
- 严重度：P2
- 位置：`app/services/background_tasks.py:241-249`、`:789-812`
- 触发路径：每次 `run_in_background`/typed 提交写入 `_tasks`、`_idempotency`、`_cancel_events`；任务终态后不淘汰。
- 根因：注释明示"已完成记录保留"，全文件无终态 TTL/容量上限（仅 journal 失败回滚时 pop）。
- 证据：`self._tasks: dict[str, TaskRecord] = {}`（243）；仅在 journal 失败时 `self._tasks.pop(...)`（约 810）。
- 影响面：进程内存随任务数线性增长，`arguments/result` 明文长期驻留，每任务一个 `Event`。
- 建议修法：终态记录按 TTL + LRU 上限淘汰三张表；journal 轮转。
- 当场可修：是。

### AIS-056 Windows 命令进程树不回收
- 严重度：P2
- 位置：`app/services/mcp_server.py:4126-4136`、`:4194-4205`
- 触发路径：`cmd` 内建命令 / `cmd /c <command>` 超时或取消 → 只 `proc.kill()` 终止 cmd.exe，其子进程继续跑。
- 根因：未使用 Job Object / `taskkill /T`，也未杀进程组；`finally` 只回收 killer/watcher 任务。
- 证据：`proc = await asyncio.create_subprocess_exec("cmd", "/c", command, ...)`（4127-4136）；`with contextlib.suppress(ProcessLookupError): proc.kill()`（4196-4197）。
- 影响面：取消后编译/测试/服务进程残留，占端口与 CPU，取消语义失效。
- 建议修法：Windows 走 Job Object 或 `taskkill /F /T /PID`；POSIX 用进程组并 killpg。
- 当场可修：是。

### AIS-057 工具兜底回执缺 errorCode 且回吐异常原文
- 严重度：P3
- 位置：`app/services/mcp_server.py:14784-14787`
- 触发路径：任一 handler 抛异常/超时 → `call_tool` 外层兜底统一返回。
- 根因：兜底回执未对齐 handler 契约（各 handler 均带 `errorCode`），且 `str(e)` 直接回灌模型/前端。
- 证据：`return {"ok": False, "error": f"工具 {name} 执行失败: {e}"}`（14787）。
- 影响面：前端按 errorCode 分支失效；异常文本可能携带内部路径/配置。
- 建议修法：补 `errorCode`（TIMEOUT/TOOL_FAILED），原始异常仅入日志，回执脱敏。
- 当场可修：是。

### AIS-058 工具超时重试复用已置位 cancel_event，重试必被立即杀死
- 严重度：P1
- 位置：`app/services/agent_loop_v2.py:7849-7862`、`:7923-7955`、`:4670-4704`；`app/services/mcp_server.py:4147-4155`
- 触发路径：`run_command` 等 cancel-aware 工具超时（`tool_timeout`）→ `asyncio.wait_for` 取消 `_wait_interruptible` → 其 finally 置位 `cancel_event` → 重试分支用**同一个**已置位 event 再跑 → `_kill_on_cancel` 立即 kill 新进程。
- 根因：`cancel_event` 在工具调用级创建一次（7849），重试循环内未重置；`_wait_interruptible` 在取消时把 event 置位（4693-4704）。
- 证据：`cancel_event = asyncio.Event()`（7849）在 `while True` 之外；`except TimeoutError:`（7923）后 `retry_count += 1` 回到 7854；`await cancel_event.wait(); ... proc.kill()`（mcp_server 4150-4153）。
- 影响面：一次超时后所有重试秒失败，超时永不恢复；对非 cancel-aware 工具有重复副作用风险。
- 建议修法：每次 attempt 新建 event（或重试前 clear）；`finally` 中 `await task`；`run_command` 的 finally 兜底 kill。
- 当场可修：是。

### AIS-059 空响应/输出截断被上报为 completed
- 严重度：P2
- 位置：`app/services/agent_loop_v2.py:5457-5475`、`:5494-5539`
- 触发路径：上游返回无 tool_calls 且 `content=""`（content_filter/空回包），或 `finish_reason=length` 且 3 次续写用尽 → break 后进入"无 tool_calls → 完成"分支。
- 根因：完成判据只看 `not tool_calls_raw`，不校验 content 是否为空、finish_reason 是否仍为长度截断；续写预算耗尽后没有降级为失败/OUTPUT_LIMIT。
- 证据：续写条件 `and _recovery_continuations < MAX_OUTPUT_TOKEN_CONTINUATIONS`（5457-5463）；`if not tool_calls_raw:`（5495）；`success=True ... stop_reason=TurnStopReason.COMPLETED`（5528-5537）。
- 影响面：空回复/被截断的回复记成功并落 completed checkpoint；客户端不重试，用户看到"空完成"。
- 建议修法：`content` 为空 → success=False/ERROR；`is_output_token_limit_finish_reason` 且续写耗尽 → stop_reason=OUTPUT_LIMIT。
- 当场可修：是。

### AIS-060 max_iterations 用裸字符串，与枚举判据不一致
- 严重度：P2
- 位置：`app/services/agent_loop_v2.py:5836-5847`、`:4197-4201`；`app/services/goal_completion_gate.py:577-582`
- 触发路径：达到迭代上限返回结果 → 上层用 `TurnStopReason` 成员做集合/相等判定。
- 根因：`stop_reason="max_iterations"` 未使用 `TurnStopReason.MAX_ITERATIONS`；返回也未带 `checkpoint_id`。
- 证据：`stop_reason="max_iterations"`（5845）；`result.stop_reason in {TurnStopReason...}`（4197-4201）。
- 影响面：门禁/自进化把"到上限"误判为其他状态或漏判；客户端缺续跑锚点。
- 建议修法：统一枚举值并回传 `checkpoint_id`。
- 当场可修：是。

### AIS-061 续跑轮绕过 receipts_durable 探测
- 严重度：P2
- 位置：`app/services/agent_loop_v2.py:5984-5985` vs `:3633-3641`
- 触发路径：同进程 pause→resume，且 Redis/PG 不可用（checkpoint 仅内存）。
- 根因：正常轮用 `receipts_durable()` 探测耐久性，续跑轮直接把 env 开关赋给 `_resume_receipts_active`。
- 证据：`self._resume_receipts_active = self._resume_receipts_enabled`（5985）；`durable = await ...receipts_durable()`（3636）。
- 影响面：续跑轮写副作用工具 intent 失败后 fail-closed，恢复后无法执行任何写/改工具。
- 建议修法：续跑轮同样以 `receipts_durable()` 门控。
- 当场可修：是。

### AIS-062 只读工具并行批无并发上限
- 严重度：P2
- 位置：`app/services/agent_loop_v2.py:6842-6882`（对照 `app/services/agent_loop.py:31` 的旧上限）
- 触发路径：单轮模型返回大量只读 tool_calls（`parallel_tool_calls` 默认 True）。
- 根因：`can_start` 只按只读性放行，每个 call 直接 `spawn`，无信号量/批上限；旧实现有 `MAX_PARALLEL_TOOL_CALLS = 5`。
- 证据：`return all(is_readonly_tool(running.name) ...)`（6857）；`spawn(self._execute_single(tc))`（6881）。
- 影响面：文件句柄/内存/事件循环抖动，超时 ×N 放大；对向量库等共享资源形成尖峰。
- 建议修法：加可配置信号量（建议 5）分批 gather。
- 当场可修：是。

### AIS-063 thread.resume 不回写消息历史
- 严重度：P2
- 位置：`app/services/agent_engine.py:3223-3231`
- 触发路径：JSON-RPC `thread.resume` 走 `from_checkpoint` 分支。
- 根因：只有 else 分支执行 `_absorb_messages(thread, working)`，resume 分支直接返回结果。
- 证据：`if from_checkpoint: result = await loop.resume_from_checkpoint(from_checkpoint)`（3223-3224）；`self._absorb_messages(thread, working)`（3230，位于 else）。
- 影响面：线程历史停在崩溃前，续跑产出丢失；下一轮 prompt 与 checkpoint/前端不一致。
- 建议修法：resume 后用 checkpoint 消息回写 thread（与正常轮同一 `_absorb_messages`）。
- 当场可修：是。

### AIS-064 审批等待不响应 cancel/pause
- 严重度：P2
- 位置：`app/services/agent_loop_v2.py:6538-6542`、`:6978-6983`
- 触发路径：工具等待用户审批期间用户点取消/暂停。
- 根因：`_request_approval` 只 `wait_for(ev.wait(), timeout=_approval_timeout)`；串行分支 `_execute_single` 未包 `_wait_interruptible`。
- 证据：`await asyncio.wait_for(ev.wait(), timeout=self._approval_timeout)`（6541）；`result = await self._execute_single(tc)`（6981）。
- 影响面：取消延迟可达 N×60s；取消后审批弹窗仍可被批准并执行。
- 建议修法：审批等待并入 `cancel_event`（wait 两事件竞争）；串行执行同样包中断器。
- 当场可修：是。

### AIS-065 原生 complete 非 ProviderError 异常绕过 fallback；空 choices 当成功
- 严重度：P1
- 位置：`app/core/llm_gateway.py:2580-2600`；`app/providers/openai_provider.py:76`（同型 dashscope:52、doubao:46、openrouter:46、stepfun:66、volcengine:47、zhipu:45）
- 触发路径：带 tools 走原生适配器 → 上游 200 但 `choices:[]`（IndexError）或适配器内部抛 `HTTPException` → 原生分支只 catch `ProviderError` → 直穿 500，不 fallback、不落 llm_call_log。
- 根因：原生分支异常捕获面窄；provider 用 `data.get("choices", [{}])[0]` 缺键时返回空 content 成功，空数组时 IndexError。
- 证据：`except ProviderError as e:`（2595）；`choice = data.get("choices", [{}])[0]`（openai:76）。
- 影响面：上游已计费却空回复；单 provider 故障失去兜底，用户见 500。
- 建议修法：原生分支捕获 Exception 转 `ProviderError`；complete 校验 `error` 字段与 `choices` 非空，空即抛。
- 当场可修：是。

### AIS-066 200 + `{"error":...}` 被当成功（多 provider）
- 严重度：P2
- 位置：`app/providers/base_provider.py:120-140`、`app/providers/openai_provider.py:76-91`
- 触发路径：OpenAI 兼容上游以 HTTP 200 返回错误体（部分代理/自建网关行为）。
- 根因：`_request` 只按 HTTP 状态判错（<400 原样返回），complete 不读 `error` 字段。
- 证据：`if resp.status_code >= 400:`（base:约 127）；`choice = data.get("choices", [{}])[0]`（openai:76）。
- 影响面：错误被当成空回复，计费照走、上层无法重试/切换。
- 建议修法：`data.get("error")` 存在即抛 ProviderError（带 status/type）。
- 当场可修：是。

### AIS-067 原生 complete 业务错误先记 ok 再判定
- 严重度：P2
- 位置：`app/core/llm_gateway.py:2565-2594`、`app/providers/gemini_provider.py:197-206`
- 触发路径：Gemini 安全拦截返回 `{"error": True}`。
- 根因：成功埋点与 llm_call_log 在结果判错之前执行。
- 证据：`"error": True`（gemini:205）；`status='ok'`（gateway:2569）。
- 影响面：拦截被记为成功并计成本，无 fallback/告警。
- 建议修法：先判 error/空 content，再记 ok。
- 当场可修：是。

### AIS-068 流式 error 帧不被识别
- 严重度：P2
- 位置：`app/providers/openai_provider.py:136-165`、`app/providers/anthropic_provider.py:247-298`
- 触发路径：SSE 返回 `{"error":...}`（OpenAI 兼容）或 Anthropic `type:"error"`（overloaded_error 等）。
- 根因：帧分支只处理 choices/usage 与 `message_*`，无 error 分支。
- 证据：`etype = event.get("type")`（anthropic:251）后续无 error 分支；`if chunk.get("usage"):`（openai:150）。
- 影响面：不产 error 事件，静默空 done，网关按成功记账。
- 建议修法：识别 error 帧并 `yield {"type":"error",...}`/抛 ProviderError。
- 当场可修：是。

### AIS-069 混元原生流丢弃 tool_calls 与 finish_reason
- 严重度：P2
- 位置：`app/providers/tencent_hunyuan_provider.py:243-269`
- 触发路径：`hunyuan-*` 带 tools（原生分支仅在带 tools 时启用）→ 模型返回 tool_calls。
- 根因：流循环只取 `delta.content`，忽略 `delta.tool_calls` 与 `finish_reason`。
- 证据：`token = getattr(delta, "content", None)`（250）；末帧只 `{"type":"done","usage":...}`（264-269）。
- 影响面：工具调用静默丢失，agent 空转并返回成功；用户看到"什么都没做"。
- 建议修法：累积 `delta.tool_calls` 增量并在 done 前发 tool_calls 帧，透传 finish_reason。
- 当场可修：是。

### AIS-070 号池重试无错误类型过滤、无退避
- 严重度：P2
- 位置：`app/core/llm_gateway.py:2827-2845`
- 触发路径：号池 key 下发生任意异常（400 参数错误/401/403/上下文超限/超时）。
- 根因：只判 `_pool_retry < 3`，无状态白名单、无 sleep，未消费 `ProviderError.retry_after_s`。
- 证据：`if current_key_pool_id is not None and _pool_retry < 3:`（2827）；递归调用前无退避（2833-2845）。
- 影响面：坏参数烧 3 个 key 并把好 key 标记 failed；429 连打放大封禁；超时重发可能重复计费。
- 建议修法：仅 429/5xx/网络错误换 key，按 hint 退避；400/401 不重试。
- 当场可修：是。

### AIS-071 视频/媒体轮询无总超时
- 严重度：P2
- 位置：`app/providers/alibaba_dashscope_provider.py:157-180`、`app/providers/tencent_hunyuan_provider.py:347-388`
- 触发路径：上游任务长期 PENDING/丢单。
- 根因：`while True` 只按成功/失败退出，无 deadline/最大轮询次数。
- 证据：`while True:`（dashscope:157、hunyuan:347）。
- 影响面：协程与并发槽永久占用，请求永不返回，无法取消。
- 建议修法：加总 deadline + 最大轮询数，超时抛 ProviderError。
- 当场可修：是。

### AIS-072 embedding 静默丢向量
- 严重度：P3
- 位置：`app/providers/token6688_provider.py:697-701`
- 触发路径：`/embeddings` 返回部分 item 无 embedding 或 `data` 缺失。
- 根因：逐项过滤后 append，未校验数量与输入相等、未校验维度。
- 证据：`if isinstance(item, dict) and item.get("embedding"):`（699）。
- 影响面：向量数少于输入且错位，检索结果与文档对不上；空 data 被当成功。
- 建议修法：校验 `len == len(input)` 与维度一致，否则抛错。
- 当场可修：是。

### AIS-073 发布任务 target 的 account_id 可指向他人账号
- 严重度：P1
- 位置：`app/routers/publish.py:759-820`、`app/services/publish/scheduler.py:1010-1035`
- 触发路径：登录用户 `POST /api/publish/tasks`，`targets[].account_id` 填他人整型 id（同平台）→ 调度器按 `id+platform` 取凭证并代发。
- 根因：`create_task` 只从 JWT 取任务归属 `user_id`，但 targets 里的账号未做归属校验；`_load_credentials` 查询无 user_id 条件。
- 证据：`targets_dicts = [t.model_dump() for t in body.targets]`（812）；`SELECT credentials_enc FROM publish_accounts WHERE id=$1 AND platform=$2`（1019）。
- 影响面：用受害者社交账号凭证发布任意内容（冒名发布/账号滥用），跨租户。
- 建议修法：提交时按 `(account_id, user_id)` 校验归属；取凭证 SQL 加 user_id 条件（防二次越权）。
- 当场可修：是。

### AIS-074 交接回顾 IDOR：任意 thread_id 可被摘要
- 严重度：P1
- 位置：`app/routers/recap.py:43-56`、`app/services/session_store.py:1605-1609`
- 触发路径：登录用户 `POST /api/agent/recap/handoff`，`thread_id` 指向他人线程。
- 根因：端点取到 `user_id` 但从未用于归属校验；`store.resume(thread_id)` 只判存在性。
- 证据：`messages = store.resume(req.thread_id)`（51）；`thread = self.get_thread(thread_id)`（1607）。
- 影响面：他人整段会话（含工具输出/代码片段）经 LLM 摘要回传，跨用户数据泄露 + 消耗受害者额度（若按其配置）。
- 建议修法：resume 前复用 thread 属主闸（与 `sessions.py` 同源），取不到/不属主即 404。
- 当场可修：是。

### AIS-075 `/api/admin/meta-learner` 全族无角色校验
- 严重度：P2
- 位置：`app/routers/meta_learning.py:28`、`:63-74`、`:77-102`、`:105-170`；`app/main.py:1297`
- 触发路径：任意登录用户 `POST /api/admin/meta-learner/trigger`、`POST /refresh`、`GET /agent-failures`。
- 根因：router 无 `Depends`，三个端点也不带身份/角色参数；JWT 中间件只验登录。
- 证据：`router = APIRouter(prefix="/api/admin/meta-learner", tags=["meta-learner"])`（28）；`async def trigger_now() -> dict[str, Any]:`（64）；`async def get_agent_failures(limit: int = 50)`（106）。
- 影响面：越权触发昂贵聚类/记忆重扫；全站 agent 错误与工具失败明细（含错误原文）跨租户泄露。
- 建议修法：整 router 加 `require_request_role_id >= 1` 依赖。
- 当场可修：是。

### AIS-076 AI Skill 调用信任客户端 ownerUuid（借用他人模型配置）
- 严重度：P2
- 位置：`app/routers/ai_skills.py:83-88`、`:405`、`:459-462`；`app/core/llm_gateway.py:1566-1576`
- 触发路径：`POST /api/ai-skills/{id}/invoke`，body 里 `ownerUuid` 填受害者 UUID。
- 根因：`invoke_ai_skill` 无身份依赖；`ownerUuid` 原样传给 `llm_gateway.complete(owner_uuid=...)`，网关按该 UUID 选取用户私有 `ai_model_config`（含 api_key）。
- 证据：`ownerUuid: str | None`（88）；`owner_uuid=req.ownerUuid`（462）；`WHERE ... AND (owner_uuid IS NULL OR owner_uuid = $2)`（1571）。
- 影响面：用他人 BYOK 密钥/额度发起调用，且不计费到调用者；可批量消耗受害者配额。
- 建议修法：`owner_uuid` 一律取 JWT 主体；补 `billing_user_id` 与限流。
- 当场可修：是。

### AIS-077 知识卡片文件无用户命名空间（跨租户读/覆盖）
- 严重度：P2
- 位置：`app/routers/knowledge.py:51-82`、`app/services/knowledge_compiler.py:302-333`、`app/routers/llm.py:2733`
- 触发路径：`GET /api/knowledge/cards?project_id=<他人项目>&workspace_path=<共享根>`；`POST /api/knowledge/compile` 覆盖写。
- 根因：卡片落盘路径只由 `workspace_root + slug(project_id)` 决定；GET 端拿到 `user_id` 但未参与路径/校验。
- 证据：`cards_path = cards_dir / f"{slug}.json"`（compiler:303）；`cards = load_active_cards(workspace_root, slugify(project_id))`（knowledge:81）。
- 影响面：跨用户读取/覆盖知识卡；投毒内容可被注入他人 LLM 上下文（prompt 注入面）。
- 建议修法：路径加用户命名空间，或在卡片元数据写 owner 并在读写前校验。
- 当场可修：是。

### AIS-078 agent_runtime 空属主会话 fail-open
- 严重度：P2
- 位置：`app/routers/agent_runtime.py:126-147`、`:432`
- 触发路径：`GET/POST /api/agent-runtime/sessions/{id}` 指向 `user_id` 为空的历史 Redis 会话。
- 根因：归属判据写成 `if owner and owner != user_id`，空属主即放行；列表也收录空属主。
- 证据：`if owner and owner != user_id and not is_admin:`（129、145）；`if not s.user_id or s.user_id == user_id:`（432）。
- 影响面：重启/旧版遗留会话被任意登录用户读取、续跑、取消。
- 建议修法：改为 `owner != user_id` 即拒（对齐 `owner_scoped_allows`）。
- 当场可修：是。

### AIS-079 用量面缺角色门，自报用量无幂等
- 严重度：P3
- 位置：`app/routers/usage.py:57-62`、`:116-136`、`:139-177`、`:75-105`
- 触发路径：任意登录用户 `GET /api/v1/ai/usage/global|budget-events|agent`；`POST /record` 自填 token。
- 根因：同文件 `_scope_user_id` 已做角色校验，但这三个只读面无 `Request`/`Depends`；`/record` 以 body 的 token 数为真值且无幂等键。
- 证据：`async def get_global_stats(days: int = Query(...))`（58-62）；`async def get_budget_events(limit: int = Query(...))`（117-123）；`input_tokens = int(body.get("input_tokens", 0))`（89）。
- 影响面：全站成本/预算/超支事件泄露；伪造用量污染配额与预算；重放重复入账。
- 建议修法：三面加 admin 依赖；`/record` 限内部回执 + request_id 幂等。
- 当场可修：是。

---

## 第 4 轮补扫结果（新增 12 条：AIS-080 ～ AIS-091）

扫描面：`mcp_server.py` 未审工具族（search/index/read/write/file_edit/fetch/db_query）、`agent_engine.py` 线程生命周期、`agent_runtime.py` 取消/终态、`agent_loop_v2.py` token 计量、全仓动态 SQL 抽查。

### AIS-080 search_codebase / index_codebase 不受工作区白名单约束
- 严重度：P1
- 位置：`app/services/mcp_server.py:2063-2070`、`:1585-1595`；对照 `read_file` 的校验 `:2440`
- 触发路径：role=0 → `search_codebase({"path":"<任意目录>","query":"..."})` → `_keyword_leg` 直接 `Path(path).resolve()` 扫描；`index_codebase` 把该目录送 `index_repository`（含外部 embedding）。
- 根因：两工具只 `resolve()`/`workspace_key()`，未过 `_validate_path_in_workspace`；同文件 `read_file` 有该校验，形成能力旁路。
- 证据：`root = Path(path).resolve()`（2070）；`index_repository(path, ...)`（1592）；`content = f.read()`（2471，同文件 read_file 前置校验）。
- 影响面：任意可读文件的行内容/上下文（`.env`、会话库片段）回灌模型；索引还会把域外源码送第三方 embedding。
- 建议修法：两入口先 `_validate_path_in_workspace(path)`，按解析后路径下传。
- 当场可修：是。

### AIS-081 Windows 内置命令分支可用单个 `&` 拼接任意命令
- 严重度：P1
- 位置：`app/services/mcp_server.py:4073-4096`、`:4126-4136`；`app/data/command_policy.json:4-33`
- 触发路径：`run_command{"command":"echo x & powershell -c \"<任意代码>\""}` → 首 token `echo` 在白名单、`&` 不命中任何 dangerous_pattern（表里只有 `&&`/`|`/`;`）→ `cmd /c` 执行整串。
- 根因：前缀白名单只看首个 token；危险模式表缺单 `&`、`^`、换行；内置命令分支把原始整串交给 `cmd /c`。
- 证据：`"cmd", "/c", command`（4127-4128）；`"&&\\s*\\S"`（policy:6，单 `&` 无对应项）；`first_token = command.split()[0]`（4088）。
- 影响面：即使调用方是 admin，`run_command` 的命令策略（白名单 + exec_policy）被绕过；配合提示注入形成实际 RCE。
- 建议修法：策略表补 `&`、`^`、CR/LF；内置命令改为显式 argv 或先整串拒绝 shell 元字符。
- 当场可修：是。

### AIS-082 read_file 无大小上限，且全文件进 256 份 base 缓存
- 严重度：P2
- 位置：`app/services/mcp_server.py:2470-2473`、`:2744`（写侧 10MB 门）、`:838-839`（`_FILE_BASE_MAX=256`）
- 触发路径：role=0 对超大文件（GB 级）调 `read_file`。
- 根因：读侧整文件 `f.read()` 入内存并全量写入 `_FILE_BASE_CONTENT`；写侧有 10MB 上限，读侧无。
- 证据：`content = f.read()`（2471）；`_FILE_BASE_MAX = 256`（839）。
- 影响面：进程 OOM；256 份全文件缓存放大内存；超限内容还可能被落为工件撑爆磁盘。
- 建议修法：读前 `os.path.getsize` 加上限（建议 10MB），超限返回分页/截断错误码。
- 当场可修：是。

### AIS-083 file_edit 的读-改-写未整体持锁，并发丢更新
- 严重度：P2
- 位置：`app/services/mcp_server.py:2746-2802`
- 触发路径：两个请求并发编辑同一文件，或读取后外部进程改写。
- 根因：`content` 读取、匹配计数、3-way 合并都在 `async with get_path_write_lock(...)` 之外，锁只覆盖写回；base 比对用的是旧快照。
- 证据：`async with get_path_write_lock(resolved_path):`（2802，位于 2796 计算完成之后）。
- 影响面：静默覆盖他人改动；未实际编辑也报成功。
- 建议修法：读+计数+合并+写回整体纳入同一 per-path 锁。
- 当场可修：是。

### AIS-084 fetch_readable / map_site / extract_web 绕过网络审批门
- 严重度：P2
- 位置：`app/services/web_crawl_tools.py:476-500`、`app/services/mcp_server.py:7257`
- 触发路径：用户在 `fetch_url` 上拒绝网络访问（或无审批通道）后，改用同族抓取工具访问同一 URL。
- 根因：`evaluate_network_access_detailed` 只接在 `fetch_url` 与 webhook；新抓取族仅做 SSRF 校验。
- 证据：`ssrf_reason = _validate_ssrf(url)`（web_crawl_tools:492，附近无审批调用）；`evaluate_network_access_detailed`（mcp_server:7257）。
- 影响面：网络访问策略被同能力工具旁路；用户拒绝的出站仍发生。
- 建议修法：在 `_http_get_html` 入口统一走审批门（与 SSRF 硬防线分层）。
- 当场可修：是。

### AIS-085 db_query 可借 `pg_read_file` 读 DB 主机任意文件
- 严重度：P2
- 位置：`app/services/mcp_server.py:5548-5616`
- 触发路径：admin 调 `db_query{"sql":"SELECT pg_read_file('/etc/passwd')"}`。
- 根因：只校验首词 SELECT/WITH + 关键词黑名单；`readonly=True` 只挡写，不挡 `pg_read_file`/`pg_ls_dir`/`lo_import`。
- 证据：`async with conn.transaction(readonly=True):`（5614）；首词校验在 5548 一带。
- 影响面：以 DB 账号身份读取 DB 主机任意文件，绕过 `read_file` 的工作区/敏感文件闸。
- 建议修法：黑名单补这些函数名（词边界），并给 DB 连接角色降权。
- 当场可修：是。

### AIS-086 agent_runtime 取消只改状态，不终止在跑的 graph/SSE
- 严重度：P1
- 位置：`app/routers/agent_runtime.py:411-423`、`:311-388`
- 触发路径：`POST /api/agent-runtime/sessions/{id}/cancel` → 仅 `session.status="cancelled"` + 落 Redis；执行侧 `graph.astream(...)` 与 SSE 循环不轮询状态，继续跑到 summarize 分支再写 `completed`。
- 根因：未保存 session→astream task 的句柄，取消无 `task.cancel()`/关流；执行体无取消检查点。
- 证据：`session.status = "cancelled"`（421，函数内无 task 取消）；`_graph_stream = graph.astream(...)`（311）；`session.status = "completed"`（354）。
- 影响面：取消后副作用工具继续执行并计费，终态被覆盖成 completed；用户以为已停。
- 建议修法：保存 run task 映射，cancel 时取消任务；执行驱动写终态前检查 `cancelled`。
- 当场可修：是。

### AIS-087 thread.close 的 closed 状态被运行中的 finally 覆盖为 idle
- 严重度：P2
- 位置：`app/services/agent_engine.py:3317`、`:4301`
- 触发路径：`thread.prompt` 运行中并发收到 `thread.close`。
- 根因：`_run_thread` finally 无条件 `thread.status="idle"`；close 不从 `_threads` 摘除，`_require_thread` 只看 status。
- 证据：`thread.status = "idle"`（3317）；close 分支写 `closed`（4301）。
- 影响面：已关闭线程可再次 prompt，但 watcher/快照已清理，文件变更不再上报，closed 语义失效。
- 建议修法：finally 先判 `thread.status != "closed"` 再置 idle。
- 当场可修：是。

### AIS-088 Agent 主循环 total_tokens 只估算输出文本
- 严重度：P2
- 位置：`app/services/agent_loop_v2.py:5390`；`app/services/agent_engine.py:2931`
- 触发路径：每轮 LLM 调用后累计用量，并用于 thread.tokenBudget / 引擎 session_tokens_used。
- 根因：`total_tokens += len(_seg_content)//4 + 50` 只计输出字符；prompt、历史、工具结果 token 全不计（预算记账另走 usage，但返回给 engine 的总量失真）。
- 证据：`total_tokens += len(_seg_content) // 4 + 50`（5390）。
- 影响面：tokenBudget 实际放行数倍额度，预算/成本熔断依据失真；对外报告 tokens 偏低。
- 建议修法：优先累加归一化 usage（prompt+completion），缺 usage 时按完整 messages 估算。
- 当场可修：是。

### AIS-089 thread 恢复丢失 approvalPolicies
- 严重度：P2
- 位置：`app/services/agent_engine.py:2270`、`:2434`
- 触发路径：进程重启后 `thread.prompt` 走 `_try_restore_thread`。
- 根因：创建时写入 `metadata["approvalPolicies"]`，恢复侧只还原 modelParams/reasoning/denyTools/tokenBudget，未读回该字段。
- 证据：`if isinstance(md.get("modelParams"), dict):`（2434，其后无 approvalPolicies 分支）。
- 影响面：按工具的审批策略静默丢失，恢复后回落 permissionMode 默认，产生权限漂移（高危工具可能免审批）。
- 建议修法：恢复时读取 `md["approvalPolicies"]` 并经 `_parse_policy_config` 注入。
- 当场可修：是。

### AIS-090 agent_runtime 异常/断连不写终态
- 严重度：P2
- 位置：`app/routers/agent_runtime.py:311-388`、`:354`
- 触发路径：`/execute` 图抛错并返回空 summary；`/execute/stream` 客户端断连在 313 处 break。
- 根因：唯一置 `completed` 的代码只在 summarize 分支；异常/断连均不写终态，`SessionState` 默认 `running`。
- 证据：`session.status = "completed"`（354）；`if await request.is_disconnected():`（313，分支只关流）。
- 影响面：`/status` 与列表长期显示 running，失败不可辨；断连残留污染 resume。
- 建议修法：finally 落 completed/failed；断连分支置 cancelled 并落 Redis。
- 当场可修：是。

### AIS-091 agent.exec(headless) 不复用线程关闭清理，泄漏 watcher/快照
- 严重度：P2
- 位置：`app/services/agent_engine.py:2701-2705`、`:2760-2770`、`:6134-6137`
- 触发路径：每次 `agent.exec(headless)`（`watchWorkspace=true` 更明显）。
- 根因：finally 只 pop、cancel pending、置 closed，未调用 `_stop_workspace_watcher_and_drain` / `_drop_shell_snapshot`；而 start 已无条件预热快照、按需起 watcher。
- 证据：`thread.status = "closed"`（2768，finally 内无清理调用）。
- 影响面：每次 exec 泄漏 shell 快照缓存与临时目录；watcher 字典条目常驻。
- 建议修法：finally 复用 `_handle_thread_close` 的清理序列。
- 当场可修：是。

---

## 第 5 轮补扫结果（新增 8 条：AIS-092 ～ AIS-099）

扫描面：`app/api/v1`、`app/core`（jwt/middleware/permission）、未审路由族（voice/media/chrome_import/cloud_runs 等）、`app/services` 长尾（media_maintenance/media_tasks/publish.image_uploader 等）。

### AIS-092 匿名可达的付费 TTS 端点，且 voice 参数直通声纹库
- 严重度：P1
- 位置：`app/routers/voice_tts.py:138-178`、`:126-135`；`app/core/config.py:147-157`
- 触发路径：未登录 `POST /api/voice/tts`（`jwt_public_paths` 默认精确放行 `/api/voice/tts`），body `{"engine":"token6688","voice":"<任意 voice_id>"}` → `_tts_via_token6688` 用平台 key 合成。
- 根因：端点无任何身份依赖；`engine` 由客户端选择，付费分支不校验 voice 白名单（免费 edge 分支有 `VOICE_WHITELIST`）。
- 证据：`"/api/voice/stt,/api/voice/tts,"`（config:157）；`if req.engine != "token6688": raise ...`（170-171）；`audio, content_type = await _tts_via_token6688(text, req.voice)`（173）；注释"token6688 引擎可为官方音色或声纹库 voice_id"（76-82）。
- 影响面：匿名消耗平台 TOKEN6688 额度（按 IP 限流仍可换 IP）；可借用他人克隆声纹合成语音（音色冒用/诈骗素材）。
- 建议修法：从公开路径移除该端点，或付费 engine 强制 JWT + voice 白名单/属主校验。
- 当场可修：是。

### AIS-093 媒体下载/上传代理全量缓冲，无字节上限
- 严重度：P2
- 位置：`app/routers/media_tasks.py:75-98`、`:650-690`、`:225-245`
- 触发路径：登录用户 `GET /api/media/download|stream|image?url=<大文件>`；`POST /api/media/upload {"url":...}` → 手动逐跳下载（`stream=False` 默认）→ 整包进内存 → `StreamingResponse` 仅回放内存副本。
- 根因：`client.send(client.build_request(...))` 未 `stream=True`；`aiter_bytes` 之前响应已完整读入；`/api/media/upload` 也是先 `resp.content` 后判 50MB；`/api/media/` 无限流规则。
- 证据：`resp = await client.send(client.build_request("GET", pinned_url, ...))`（85-90）；`await asyncio.to_thread(_write_bytes_atomic, local_path, resp.content)`（290，同类）。
- 影响面：单个登录用户即可让 worker 缓冲任意大响应（可并发），OOM 拖垮进程；大视频正常请求同样受害。
- 建议修法：`stream=True` + `aiter_bytes` 累计计数超限即断；上传下载均先校验 `Content-Length` 并硬上限（如 20MB/50MB）。
- 当场可修：是。

### AIS-094 Chrome 导入端口无属主绑定，可导走他人登录态
- 严重度：P2
- 位置：`app/services/chrome_import.py:251-290`、`app/routers/chrome_import.py:55`（`launch` 侧）
- 触发路径：登录用户 `POST /api/publish/browser/import-chrome {"port": <他人已拉起的 CDP 端口>}` → `_wait_for_cdp_ready(port)` → `connect_over_cdp("http://127.0.0.1:{port}")` → 读全量 cookie → `_save_account_to_db(当前 user_id, ...)`。
- 根因：`port` 由请求体任意指定，未与 `launch-chrome` 的调用者绑定/登记；服务端也不校验该端口的属主。
- 证据：`browser = await p.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")`（268）；`account_id = await _save_account_to_db(user_id, platform, all_relevant, ...)`（286）。
- 影响面：连续端口可猜中他人实例，把他人的平台登录 cookie 导入自己账号（账号接管）；同时构成本机端口探测面。
- 建议修法：launch 时登记 `user_id→port`，import 前校验属主；仅接受本会话登记的端口。
- 当场可修：是。

### AIS-095 cloud-runs 以客户端 run_id 覆盖他人运行记录
- 严重度：P2
- 位置：`app/routers/cloud_runs.py:67-73`、`app/services/cloud_run_store.py:195-205`
- 触发路径：登录用户 `POST /api/cloud-runs/run`，body 自带他人 `run_id` → `store.start()` 直接以该 key 写入。
- 根因：`start()` 无存在性/属主校验；`complete/get` 却按属主判定，造成"写入无门、读取有门"的不对称。
- 证据：`self._runs[run.run_id] = run`（cloud_run_store:201）；`run_id=req.run_id`（cloud_runs:67-73）。
- 影响面：持他人 run_id 者可覆盖其运行记录（记录被改归属，受害者查询 404、内容丢失）。
- 建议修法：`start` 对已存在 `run_id` 校验 `user_id` 一致或直接拒绝重复。
- 当场可修：是。

### AIS-096 图表 owner sidecar 每轮被误删，产物归属校验 fail-open
- 严重度：P1
- 位置：`app/services/media_maintenance.py:61-79`、`app/routers/artifacts.py:166-187`；产出侧 `app/services/chart_tools.py:351-359`
- 触发路径：`main.py:444-445` 启动后每小时 `sweep_chart_files()`；图表产物为 `x.html` + `x.html.owner`。
- 根因：`html_stems` 收集 `p.stem`（`x`），`.owner` 分支用 `p.stem`（`x.html`）比对，恒不相等 → 所有 sidecar 命中"孤儿"分支被删；且 sidecar 缺失时 `artifacts` 按注释放行。
- 证据：`html_stems.add(p.stem)`（64）；`if p.stem not in html_stems or ...: p.unlink(...)`（77-78）；`if owner_file.is_file():`（artifacts:172，缺失即不校验）。
- 影响面：每小时/每次重启删光全部归属凭证 → 持有路径者可越权换取他人图表 token（跨用户产物读取）。
- 建议修法：用 `p.name.removesuffix(".owner")` 还原 html 名后再比对；artifacts 对缺 sidecar 的新产物改为 fail-closed 或提供重建。
- 当场可修：是。

### AIS-097 在途媒体任务 30 分钟被强失败，官方视频 p90 55–75 分钟
- 严重度：P1
- 位置：`app/services/media_maintenance.py:41`、`:87-97`；`app/services/media_tasks.py:82-89`、`:327-361`、`:626-682`；`app/services/video_generation.py:228-230`
- 触发路径：对话内 `video_generation` 提交 → 落库 `processing` 且 `updated_at=now()` → 在途期无心跳更新 → maintenance 按 `updated_at < now()-30min` 强置 failed → 上游真实产物回写时被 `only_if_in_flight` 拒绝。
- 根因：`_STUCK_MINUTES="30"` 对所有 kind 一刀切，而视频官方 p90 为 55–75 分钟；在途期间无 `updated_at` 心跳，poller 只在终态 update。
- 证据：`WHERE status = ANY($2) AND updated_at < now() - ($3 || ' minutes')::interval`（95-96）；`updated_at=now()` 仅出现在 INSERT/终态 update（182、359）。
- 影响面：正常长视频任务被静默判死，用户已付费产物丢失；重试放大成本。
- 建议修法：探测到非终态时 bump `updated_at` 作心跳；或按 kind 设阈值（video ≥ 120 分钟）/跳过 video。
- 当场可修：是。

### AIS-098 非图片响应被写成 `.png` 并上传图床
- 严重度：P3
- 位置：`app/services/publish/image_uploader.py:233-238`、`:280-295`
- 触发路径：publish 处理用户 HTML 外链图片 → 外链返回 200 的 HTML/JSON 错误页。
- 根因：`ext` 初值 `".png"` 永不为空，`if "image" not in content_type and not ext:` 恒 False，未做 magic/类型校验。
- 证据：`ext = ".png"`（233）；`if "image" not in content_type and not ext:`（281）。
- 影响面：错误页被当图片上传平台图床 → 裂图且静默；hash 同名复用后不再重下。
- 建议修法：改为 `if "image" not in content_type:`，并加文件头 magic 校验。
- 当场可修：是。

### AIS-099 外链图片下载全量缓冲无上限
- 严重度：P2
- 位置：`app/services/publish/image_uploader.py:259-295`
- 触发路径：publish 对任意用户外链图片 URL 由服务端拉取。
- 根因：`resp.content` 全量缓冲；无 `Content-Length`/累计字节上限；`_IMAGE_TMP_DIR` 无容量上限。
- 证据：`await asyncio.to_thread(_write_bytes_atomic, local_path, resp.content)`（290）；`len(resp.content)`（293）。
- 影响面：单请求可拉入数 GB → worker OOM；临时目录可被填满。
- 建议修法：流式读取并限上限（如 20MB），先校验 `Content-Length`。
- 当场可修：是。

---

## 第 6 轮补扫结果（新增 6 条：AIS-100 ～ AIS-105）

对第 5 轮同范围做独立第二轮扫描（不同执行者、带排除表）。命中 6 条新问题；另一条 `publish account_id` 为 AIS-073 重复，已剔除。

### AIS-100 codebase-index 的出域同意与归属主体取自请求体
- 严重度：P1
- 位置：`app/routers/tools.py:109-119`、`:129-176`
- 触发路径：任意登录用户 `POST /api/tools/codebase-index`，`{"action":"refresh","workspace_path":"<白名单内>","user_id":"<受害者 UUID>"}` → 以受害者身份判定"已同意出域"并触发远端 embedding，索引归属记到受害者。
- 根因：端点无 `Depends(require_request_user_id)`/`Request`，`user_id` 是请求体字段并直接下传。
- 证据：`user_id: str | None = Field(None, description="refresh 用:出域同意与归属主体")`（118）；`user_id=req.user_id`（174）。
- 影响面：显式拒绝出域的用户可被冒名恢复出域（隐私策略失效）；远端调用与索引归属嫁祸他人。
- 建议修法：身份只取 `request.state.user_id`/依赖注入，删除 body 字段。
- 当场可修：是。

### AIS-101 step-recorder 运行记录无属主，任意 run_id 可读
- 严重度：P2
- 位置：`app/routers/step_recorder.py:38-66`、`:68-101`；`app/services/agent_step_recorder.py:380-400`
- 触发路径：登录用户 `GET /api/agent-recorder/runs/{run_id}/steps|replay|metrics`。
- 根因：路由取到 `user_id` 仅用于日志，未参与查询；录制记录创建时只有 `{"steps":[],"started_at":...}`，无 owner 字段。
- 证据：`data = agent_step_recorder.get_run_steps(run_id, page=page, page_size=page_size)`（46）；`user_id: str = Depends(get_current_user_id)`（43）后未使用。
- 影响面：凭 run_id（可枚举/泄露）读取他人 agent 的工具入参、diff、测试输出与 token/成本。
- 建议修法：录制写入 owner，读端与主体比对（与 `cloud_runs` 同款但独立路由）。
- 当场可修：是。

### AIS-102 self-healing 端点仅靠 env 开关，登录用户可让 LLM 改源码
- 严重度：P2
- 位置：`app/routers/self_healing.py:111-139`
- 触发路径：登录用户 `POST /api/v1/self-healing/run`（工作区白名单内）。
- 根因：端点无角色/审批依赖；`PytestSubprocessRunner` + `_make_patch_adapter` → `llm_patch_and_apply` 直接落盘改工作区文件。
- 证据：`runner = PytestSubprocessRunner(info)`（131）；`patch_fn=_make_patch_adapter(info)`（138）。
- 影响面：普通用户可在服务器工作区跑 pytest 并让 LLM 自动改写源码，绕过 Agent 引擎的工具审批；仅 `AGENT_SELF_HEALING_ENABLED` 一个开关兜底。
- 建议修法：加 admin/内部票据门，或复用引擎审批链。
- 当场可修：是。

### AIS-103 screenshot probe 的 Playwright 请求绕过逐跳 SSRF 防护
- 严重度：P2
- 位置：`app/services/screenshot_service.py:267-280`；`app/routers/screenshot.py:70`
- 触发路径：登录用户 `POST /api/screenshot/probe {"url":"<公网 302 → 内网>"}`。
- 根因：首跳有 `_validate_url_ssrf`，但真正请求走 `context.request.get`，未注册 SSRF route、未禁重定向；Playwright 默认跟随最多 20 跳并自行解析 DNS。
- 证据：`response = context.request.get(url, timeout=10000)`（272）；同文件截图路径有逐跳 route 防护，probe 分支没有。
- 影响面：经 302/DNS rebinding 让服务端访问 169.254/内网，逐跳防护被绕过（探测内网、触发内网 GET）。
- 建议修法：`max_redirects=0` 后手动逐跳校验，或复用截图侧的钉 IP httpx 通道。
- 当场可修：是。

### AIS-104 memory.reset 清空全局 lessons 且不重载
- 严重度：P2
- 位置：`app/services/memory_facade.py:99-123`；`app/services/meta_learner.py:118`；`app/services/agent_engine.py:2125`、`:5053-5064`
- 触发路径：任意会话发 `memory.reset {confirm:true}`（无 admin 校验）。
- 根因：`meta_learner._lessons/_title_index` 是非用户维度的全局缓存，facade 直接 `.clear()`；`_loaded` 仍为 True，`_ensure_loaded` 不会重载。
- 证据：`meta_learner._lessons.clear()`（113）；`meta_learner._title_index.clear()`（114）；路由仅校验 `confirm`。
- 影响面：任一用户清空全体租户记忆缓存，`memory.status` 对所有用户谎报 0 直至重启/显式 refresh（跨租户破坏 + 静默错误）。
- 建议修法：reset 按 user_id 过滤或限 admin，并同步置 `_loaded=False` 触发重载。
- 当场可修：是。

### AIS-105 memory_sedimenter 计数表无淘汰
- 严重度：P3
- 位置：`app/services/memory_sedimenter.py:39`、`:147-153`
- 触发路径：`/api/llm` 每次对话带任意 `metadata.conversationId`。
- 根因：`_COUNT` 注释称 LRU，实际只 `counts[session_id]=0`，从不淘汰。
- 证据：`_COUNT: dict[str, int] = {}`（39）；`counts.get(session_id, 0) + 1`（147）。
- 影响面：构造无限 conversationId 可让进程内存持续增长。
- 建议修法：改 `OrderedDict`/加容量与超时清理。
- 当场可修：是。

---

## 第 7 轮补扫结果（新增 10 条：AIS-106 ～ AIS-115）

扫描面：`mcp_server.py` 未审工具族抽查（file_search/investigate_codebase/artifacts/team_task/edu_*）、`agent_loop_v2.py` 上下文装配/checkpoint、`agent_engine.py` 并发与状态机。

### AIS-106 file_search 不校验工作区，任意目录内容回传
- 严重度：P1
- 位置：`app/services/mcp_server.py:5051-5090`、`:5160-5190`
- 触发路径：role=0 → `file_search{"path":"<任意绝对目录>","query":"password"}` → `Path(path).resolve()` → 遍历并 `open()` 命中文件，返回命中行 `preview`。
- 根因：入口未复用 `_validate_path_in_workspace`（同文件 `read_file`/`list_files` 有），也未限单文件大小。
- 证据：`path = arguments.get("path", ".")`（5062）；`root = Path(path).resolve()`（5087）；`preview = "\n".join(...)`（约 5180）。
- 影响面：绕过 `read_file` 的工作区白名单，跨目录读取主机任意文本（配置/密钥/用户数据）并回灌模型。
- 建议修法：入口强制 `_validate_path_in_workspace`，并限单文件大小与 `max_results`。
- 当场可修：是。

### AIS-107 investigate_codebase 以用户路径为仓根
- 严重度：P1
- 位置：`app/services/mcp_server.py:10850-10870`、`app/services/codebase_investigator.py:200-263`
- 触发路径：role=0 → `investigate_codebase{"intent":"x","path":"<任意目录>"}` → 直接 `Path(path).resolve()` 枚举源码，`content_anchor` 写入 findings。
- 根因：`path_raw = str(arguments.get("path") or ".")` 未经仓根/白名单校验即下传。
- 证据：`resolved_deps.enumerate_files(root)`（investigator:200）；`anchors[{...,"content_anchor":...,"line":...}]`（:263）。
- 影响面：任意目录的 `.py/.ts/.js` 源码行被读取并回灌模型。
- 建议修法：与 AIS-106 同一校验，强制仓根或会话附加根。
- 当场可修：是。

### AIS-108 summarize_artifacts 按客户端 conversation_id 读他人产物
- 严重度：P2
- 位置：`app/services/mcp_server.py:9986-10010`
- 触发路径：任意会话 → `summarize_artifacts{"conversation_id":"<他人会话 id>"}`。
- 根因：handler 不读宿主注入的 `__session_id/__user_id`，直接 `_load_artifacts(conversation_id)`；schema 注明"所有用户可用"。
- 证据：`cached = _load_artifacts(conversation_id)`（10006）；键仅 `mcp:artifacts:<conversation_id>`。
- 影响面：跨用户读取他人 plans/sources/artifacts/tool_calls；提示注入可指定受害者 id。
- 建议修法：改用宿主 `__session_id`，或加载后校验 owner。
- 当场可修：是。

### AIS-109 team_task 看板默认全局共享，可枚举/篡改他人任务
- 严重度：P2
- 位置：`app/services/mcp_server.py:6880-6965`
- 触发路径：`team_task{"action":"update","team_id":"default","task_id":"...","agent_id":"<持有者>"}`。
- 根因：看板按模型自报 `team_id` 分键（默认 `default` 全局共享），无 `__user_id` 归属；update 只比对可伪造的 `agent_id == claimed_by`。
- 证据：`team_id` 缺省 `"default"`；`if task.get("claimed_by") != agent_id:`（约 6959）。
- 影响面：role=0 可枚举/篡改全体用户任务标题、detail、note，或任意认领。
- 建议修法：board 键并入 user_id，或强制宿主身份并拒绝跨主体 claim/update。
- 当场可修：是。

### AIS-110 edu_approve_refund / reject 的 refundId 可路径穿越
- 严重度：P2
- 位置：`app/services/mcp_server.py:14157-14176`
- 触发路径：`edu_approve_refund{"refundId":"../../other/endpoint/x"}` → 拼进 `PUT /refund-record/{id}/approve`。
- 根因：`refundId` 只 `strip()`，无格式白名单/URL 编码，`..` 可被同源路径归一化。
- 证据：`f"/refund-record/{refund_id}/approve"`（14164）；`f"/refund-record/{refund_id}/reject"`（14175）。
- 影响面：携带内部服务凭证与 `X-User-Id` 的请求被改写到同源任意 PUT 路径，横向越权。
- 建议修法：`^[A-Za-z0-9-]+$` 白名单，或 `quote(refund_id, safe="")`。
- 当场可修：是。

### AIS-111 上下文压缩后 messages 重新绑定，线程历史丢失本轮
- 严重度：P1
- 位置：`app/services/agent_loop_v2.py:5298-5300`、`app/services/agent_engine.py:3226-3230`、`:3331-3351`
- 触发路径：任一轮触发上下文压缩 → 主循环把局部 `messages` 重绑为压缩后的新列表 → 后续 assistant/tool 追加进新列表；`run()` 返回后引擎仍用旧 `working` 调 `_absorb_messages`。
- 根因：压缩返回新列表后用赋值重绑，违反"就地追加"契约；`self._messages` 也仍指向旧列表。
- 证据：`messages = await self._wait_interruptible(self._maybe_compact_context(messages))`（5298-5300）；`working = [dict(m) for m in thread.messages]`（3228）；`self._absorb_messages(thread, working)`（3230）。
- 影响面：thread 历史丢失本轮全部新消息；下一轮重发旧超长历史并反复压缩；`pre_tool_use` 上下文与 pause/cancel checkpoint 写入旧列表。
- 建议修法：压缩后 `messages[:] = compressed` 并同步 `self._messages`（保持同一列表对象）。
- 当场可修：是。

### AIS-112 正常收尾不把最终 assistant 消息写回 messages
- 严重度：P1
- 位置：`app/services/agent_loop_v2.py:5494-5539`、`:5556-5570`
- 触发路径：每轮无 tool_calls 的正常收尾 → 直接保存 completed checkpoint 并 return。
- 根因：全文唯一的 assistant append 在工具轮分支（5557），无工具分支只返回 `final_response`，不追加 assistant 消息。
- 证据：`if not tool_calls_raw:`（5495）→ `_save_checkpoint_safe(...status="completed")`（5513-5514）→ `return AgentLoopResult(...)`（5528-5539）。
- 影响面：`thread.messages` 缺每个最终回答；多轮对话上下文缺上一轮答案；completed checkpoint 无最终答案，重启恢复与在线行为不一致。
- 建议修法：返回前 `messages.append({"role":"assistant","content":content})`。
- 当场可修：是。

### AIS-113 同一 thread 并发 prompt 的状态竞态（检查与置 running 跨 await）
- 严重度：P2
- 位置：`app/services/agent_engine.py:2787-2790`、`:2862-2871`、`:3207`；`app/routers/engine.py:488-502`
- 触发路径：同一 thread 两帧 `thread/prompt` 并发（WS 每帧独立任务）。
- 根因：入口见 `status == "idle"` 通过，`thread.status = "running"` 要到 `_run_thread` 才设置，中间有多处 await，无 per-thread 锁/同步占位。
- 证据：`if thread.status == "running": raise`（2787）；`before_files = await self._workspace_dirty_files(thread)`（2862）；`thread.status = "running"`（3207）。
- 影响面：双 loop 共用 `thread.loop/emit/checkpoint_id`，历史交错、事件分裂、interrupt 只命中后者、token 重复计。
- 建议修法：入口同步置 busy 或 per-thread Lock。
- 当场可修：是。

### AIS-114 运行中 interrupt 立即保存半批次 checkpoint
- 严重度：P2
- 位置：`app/services/agent_loop_v2.py:6230-6272`
- 触发路径：loop 运行中 `cancel()`/`pause()` → `if self._messages is not None` 恒真 → 立即 `_save_checkpoint_safe(messages=self._messages, status=...)` 并返回 id。
- 根因：与"下一轮边界保存"的文档契约不符；未带 resume 元数据/回执；工具批中途快照（tool_calls 无配对结果）。
- 证据：`if self._messages is not None: return await self._save_checkpoint_safe(...)`（6242-6248）；边界处又保存一份（6266-6272）。
- 影响面：据此恢复丢已完成结果，模型重试可能重复副作用；双 checkpoint 分叉。
- 建议修法：运行中仅置标志，由迭代边界统一保存。
- 当场可修：是。

### AIS-115 溢出恢复后的压缩列表未回写调用方
- 严重度：P2
- 位置：`app/services/agent_loop_v2.py:4807-4822`、`:5355-5361`
- 触发路径：上游 400 上下文溢出 → `_compact_for_overflow_recovery` 返回新列表，但只在方法内局部重绑；重试成功，调用方仍用原超长列表。
- 根因：恢复产物未回传/回写；`_overflow_recovery_left`（MAX=2）耗尽后抛错。
- 证据：`messages = _recovered`（4810 一带）；`self._llm_call_with_retry(_req_messages, ...)`（5355-5361）。
- 影响面：救火后按超长载荷重发，额度空耗并最终回合失败；工具结果继续追加使历史更超限。
- 建议修法：恢复后列表回写 `self._messages` 与调用方局部变量。
- 当场可修：是。

---

## 第 8 轮补扫结果（新增 3 条：AIS-116 ～ AIS-118）

扫描面：mcp_server 媒体/语音/图像/文档工具段、SSE 五件（sse_contract/sse_buffer/sse_frames/async_gen_close/agent_events）、agent_run_control 状态机。SSE 五件无新增；另 2 条候选（register_run 覆盖写、audio_transcription 本地路径）分别与既有条目重复，已剔除。

### AIS-116 image_edit 未过付费闸
- 严重度：P1
- 位置：`app/services/mcp_server.py:8168-8190`（对照 `:7730-7740`）
- 触发路径：任意会话调用 `image_edit`（付费 `images/edits`），宿主注入的 `__credit_balance/__credit_approval` 不生效。
- 根因：仅 `image_generation` 调用了 `gate_image_spend(arguments)`；`image_edit` 直接 `provider.images_edits(...)`。
- 证据：`credit_block = gate_image_spend(arguments)`（7735）；`result = await provider.images_edits(...)`（8183，前无 gate）。
- 影响面：余额不足/未批准仍可无限计费调用图像编辑；额度与审批体系被同能力工具旁路。
- 建议修法：`image_edit` 同样过 `gate_image_spend`，或抽出统一付费闸。
- 【复核 2026-11-13 @ `e2b004b74940af915320eefa22c8c12093009e7e`】**【已修复@当前代码】**。`app/services/mcp_server.py:8643-8647` 已为 `image_edit` 调用 `credit_block = gate_image_spend(arguments)`（带行内注释 `# image_generation 过 gate_image_spend,edits 漏了,宿主盖章余额为 0 也照扣费。`）。原报告 `:8168-8190` 行号在当前代码已偏移数百行。该 P1 不再成立，`PROJECT_PLAN` 中对应任务应摘。
- 当场可修：是。

### AIS-117 video_generation 的 save_path 在专用 provider 路径被静默丢弃
- 严重度：P2
- 位置：`app/services/mcp_server.py:8508-8590`
- 触发路径：`video_generation{"save_path":"...","provider":"agnes"}`（或默认 token6688）→ 两专用分支在落盘块前 return，agnes 载荷硬编码 `"saved_path": None`。
- 根因：落盘与 `_validate_video_save_path` 只在通用链执行；专用 provider 分支提前返回。
- 证据：`"saved_path": None`（约 8520）；通用链落盘与校验在 8578 之后。
- 影响面：返回 `ok:true` 但文件不存在；save_path 连校验都不做，调用方以为已保存。
- 建议修法：抽统一落盘函数（含路径校验），三条分支共用。
- 当场可修：是。

### AIS-118 voice_tts 非法 save_path 被静默跳过仍报成功
- 严重度：P2
- 位置：`app/services/mcp_server.py:9230-9250`
- 触发路径：`voice_tts{"save_path":"<非法/白名单外>"}`。
- 根因：`if ok_path:` 无 else，校验错误码被丢弃；末尾仍返回 `ok: true`、`saved_path: None`。
- 证据：`if ok_path:`（9238）；`"ok": True`（9246）。
- 影响面：调用方无法区分"未要求落盘"与"落盘被拒"，静默失真；与 image/video 的 fail-fast 不一致。
- 建议修法：校验失败显式返回 `errorCode`。
- 当场可修：是。

---

## 未判定（有可疑代码，但证据不足/依赖部署语义）


1. ~~`/api/mcp/external/servers` 注册只校验 scheme~~ → **已升级为 AIS-053**（代码注释自承刻意不校验，盲 SSRF 可成立；仅"读回内网响应"未证实）。
2. Playwright 路径（`screenshot_url`、`browser_hub`）只在入口/每请求校验，无 DNS pinning，理论上可被 DNS rebinding 绕过，无可复现证据（`browser_selfcheck` 的旁路已独立成 AIS-051）。
3. ~~`chrome_import` 允许指定 127.0.0.1 任意端口连接 CDP 并入库账号~~ → **已升级为 AIS-094**（端口无属主绑定已证实；"猜中他人端口"需多用户共享实例前提）。
4. `/api/sso/callback` 是否在 `JWT_PUBLIC_PATHS` 取决于部署 .env（默认注释态），匿名可达性未证实。
5. `memory_service.list_episodic` 读取不过滤 `expires_at`，但仓内无写入方传该字段，暂无触发路径。
6. `model_context_window.resolve_compaction_context_limit` 未知模型默认 128K；真实窗口更小时压缩不触发直到上游 400，需部署模型名确认。
7. `dream_scheduler.trigger_now` 与周期任务无互斥、consolidate 无 CAS；仅手动与周期撞上时发生，未确认上游是否串行化。
8. `agent_checkpoint` redis 回执 CAS 为 get/set（注释自承"仅单写者前提"）；多实例部署是否成立未确认。
9. `durable_resume.tool_ledger` 的 `answered` 为全局集合，注释与实现是否一致取决于同一 tool_call_id 是否会被复用。
10. `sandbox_task_queue._run_one` 在 `await semaphore.acquire()` 阶段被取消会泄漏 `lane.waiting`，仅在 shutdown 路径触发。
11. token6688 异步生图 `count`/`size` 参数疑似错位、`_poll_task` 先判成功再判 failed；受开关与上游字段组合影响，需样本复现。
12. ~~视频轮询 `while True` 无总超时（腾讯混元/阿里 DashScope）~~ → **已升级为 AIS-071**（无 deadline 已证实；上游是否必然终态不再影响"缺兜底"的结论）。
13. `agent_checkpoint.py:336-348` 读取 checkpoint 时直接 `data["messages"]`，无 schema/版本校验；未找到能产生"合法 JSON 但字段类型错"的写入路径，损坏恢复行为未证实。
14. `agent_engine.py:6134-6137` subagent 子线程仅 pop 置 closed，未走 `_handle_thread_close`；但 `sub_params` 未开 `watchWorkspace`，watcher/快照泄漏未证实。
15. `llm_gateway.py:1609` 打印 key 前 16 位占位符（非真实密钥），是否可逆推/是否含真实前缀未证实。
16. 非号池（BYOK/.env）路径原生 429/5xx 直接 fallback、无同 key 重试，是否为预期策略需产品确认。
17. `sandbox._resolve_workdir`（`sandbox.py:215-224`）用 `abspath` 未 `realpath`，symlink 可绕过严档工作区收敛；需实际可达 symlink 落点才能证实。
18. `git_operations` 在用户可控仓库内运行 `git`，未隔离 `core.fsmonitor`/textconv；是否构成执行面取决于仓库来源，证据不足。

---

## 与既有计划去重（本报告不重复计）

- 已收录且未重复上报：外部导入 bundle `mcp_tool` 直调 `_TOOL_HANDLERS` 绕过管理员门禁（PROJECT_PLAN 2026-11-05 P0）；非流式 `/llm/complete` 只做额度校验（BUG-7）；SSE 取帧唯一出口零生产调用（BUG-31）；流式平滑渲染（BUG-63）；事件循环阻塞（BUG-9）；团队记忆越权（BUG-5）；索引/约束缺失族（BUG-29）；`cloud_runs` 与 provider 调用记录缺 trace 列（G-44/G-60）；share 链接（BUG-50）；外部调用健壮性（BUG-25）。
- 已修复、不再计入：`computer_use` 进程级单例跨用户（2026-09-19 批 65–70）；`knowledge_fs` 入口身份（同批）；`hooks`/`hook A/B` 属主（同批）。

---

## 覆盖清单（本轮实际读/检索过的模块）

- 流式：`core/sse_buffer.py`、`sse_frames.py`、`stream_events.py`、`responses_retry.py`；`routers/llm.py`（main gen 收尾/usage/finally/中断回调/原生流）、`routers/agents.py`（event_generator/生命周期）、`services/command_streamer.py`、`async_gen_close.py`、`middleware/response_sanitizer.py`。
- provider/计量：`base_provider.py`、`openai/anthropic/openrouter/gemini/ollama`、`core/llm_gateway.py`（客户端/原生 complete+astream/fallback/记账）、`usage_cache.py`、`model_pricing.py`、`cost_ledger.py`、`routers/usage.py`、`routers/cost_ledger.py`。
- 上下文/记忆：`context_compaction.py`、`context_overflow.py`、`model_context_window.py`、`compaction_retention.py`、`context_engine.py`、`context_recall.py`、`vector_memory.py`、`memory_service.py`、`conversation.py`、`session_store.py`、`agent_engine.py`（export）、`rollout_truncation.py`、`codebase_incremental_index.py`、`codebase_indexer.py`、`knowledge_graph.py`、`rag.py`。
- 并发/资源：`db_pool.py`、`agent_run_control.py`、`publish/scheduler.py`、`publish/metrics_collector.py`、`dag_scheduler.py`、`sandbox.py`、`sandbox_task_queue.py`、`browser_hub.py`、`self_media_scheduler.py`、`checkin.py`。
- 安全：`mcp_server.py`（工具白名单/admin 清单/run_in_background）、`task_executors.py`、`hooks.py`/`hook_engine.py`、`orchestration.py`、`self_media.py`、`computer_use.py`、`spec_generator.py`/`spec.py`、`knowledge_graph.py`、`sso.py`/`core/sso.py`、`timeline.py`、`jwt_auth.py`（PUBLIC_PATHS 判定）、`audit.py`/`audit_service.py`。
- 错误码：上述路由的错误分支、`middleware/audit.py`、`self_media._fetch_history`。

## 轮次记录与仍可深挖方向

- 第 1 轮（流式/provider/上下文/并发/安全/错误码 6 面并行）：产出 35 条候选，回源复核后保留 32 条。
- 第 2 轮（未覆盖 provider、v1 鉴权面、会话/资源面）：新增 17 条，去重合并后并入 14 条；累计 46 条。
- 第 3 轮（mcp_server 工具实现 / task_executors / agent_loop_v2 深层 / 剩余 provider / 未审路由族）：新增 30 条（AIS-050～079），其中 P0×1、P1×6、P2×20、P3×3；累计 76 条。**未达零新增。**
- 第 4 轮（mcp_server 剩余工具族 / agent_engine 线程生命周期 / agent_runtime 取消 / token 计量 / 动态 SQL 抽查）：新增 12 条（AIS-080～091），其中 P1×3、P2×9；累计 88 条。**未达零新增。**
- 第 5 轮（api/v1 + core + 未审路由族 + services 长尾）：新增 8 条（AIS-092～099），其中 P1×3、P2×4、P3×1；累计 96 条。**未达零新增。**
- 第 6 轮（第 5 轮同范围独立复扫，带排除表）：新增 6 条（AIS-100～105，另 1 条为 AIS-073 重复已剔除），其中 P1×1、P2×4、P3×1；累计 102 条。**未达零新增。**
- 第 7 轮（mcp_server 未审工具族抽查 / agent_loop_v2 上下文装配 / agent_engine 并发状态机）：新增 10 条（AIS-106～115），其中 P1×5、P2×5；累计 112 条。**未达零新增。**
- 第 8 轮（mcp_server 媒体/语音/图像工具段 + SSE 五件 + run 控制状态机）：新增 3 条（AIS-116～118，另 2 条为既有条目重复已剔除），其中 P1×1、P2×2；累计 115 条。**未达零新增。**
- 第 9 轮（六面终轮全扫，带 AIS-001～118 完整排除表）：**新增 0 条**。达到用户要求的停止条件。

## 第 9 轮收敛验证（新增 0 条）

按六个扫描面做终轮全扫，排除 AIS-001～118 全部主题。抽查文件：

- SSE/协议：`core/sse_contract.py`、`core/sse_frames.py`、`core/sse_buffer.py`、`services/async_gen_close.py`、`services/agent_events.py`（帧注入判序、水位回滚、三态重放、代次/双上限清理，未越出已知项）。
- 模型调用：`core/retry_after.py`、`core/responses_retry.py`、`core/provider_slots.py`、`core/model_pricing.py`、`core/token_baseline.py`、`core/turn_token_usage.py`（Retry-After 裁决、尝试数换算、槽释放、缓存感知计价自洽）。
- 上下文/记忆：`services/compaction_retention.py`、`services/auto_compact_window.py`、`services/auto_context.py`、`services/file_read_state.py`（分组/截断/窗口账本均有上限）。
- 并发/资源：`core/conn_guard.py`、`core/db_pool.py`、`core/approval_replay.py`；全仓 `create_task`/`ensure_future` 逐一核对持有/豁免。
- 安全：`core/internal_secret_auth.py`、`core/vault.py`、`core/log_redaction.py`、`core/network_policy_decision.py`（票据 fail-closed、脱敏、未知策略不猜放行）。
- 错误码/可观测：`core/bounded_ttl_store.py` 与相关 counter/gauge 出口；无新增静默吞错面。

全局 grep：`verify=False`/`trust_env`、`shell=True`/`os.system`/`eval`、模块级 dict 上限。命中均为既有设计或已记录项。`agent_engine.py:506` 的 `exec(compile(...))` 属既有 code-cell 沙箱家族，不计新增。

结论：**第 9 轮 0 条新增**，在「六面 + 已覆盖切片」范围内收敛。

仍可深挖方向（未穷尽的明确缺口，不属于"零新增"的已扫描面）：
1. `app/services/mcp_server.py`（约 690KB、14000+ 行）：本轮只覆盖白名单/审批/admin 矩阵与 file/search/investigate/artifact/team/edu/media/voice/image 等约 20 个工具族，其余 100+ 工具实现未逐条读（参数校验、路径/命令拼接、外部调用）。
2. `app/services/agent_loop_v2.py`（437KB）与 `agent_engine.py`（389KB）的 subagent 派生回收、事件队列 direct-emit vs poll 的时序、durable resume 账本、workspace watcher 生命周期。
3. `app/core/llm_gateway.py` 的 combo 多级 fallback 选择、key pool 与模型可用性同步、计费腿别矩阵。
4. 长尾 provider（媒体/重排/embedding/语音）的完整错误分支与出站域名白名单；DNS rebinding 残余窗口。
5. 数据库层：动态列名/排序字段拼接、事务边界、迁移与生产 schema 漂移。
6. 前端契约面：SSE 事件名/字段与 web/extension 消费方一致性（需跨仓对读）。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
