# D-aiservice · ai-service 流式产出层审计

审计范围：`apps/ai-service/app/core/llm_gateway.py` 的 `async def astream(...)`，静态只读，未跑 Python，未读 `.venv`。证据 = 实际读到的 `astream` 全段（约 L3531–L4517）。前端显示层 D1–D6 已知，不重复报。

## 确凿缺陷

### D-AI-1 · 客户端断开依赖 `GeneratorExit`，但递归重试腿无显式关闭（资源/取消传播，P1）
`apps/ai-service/app/core/llm_gateway.py:4371-4383`（key-pool 重试）、`4414-4425`（openrouter failover）
```python
async for evt in self.astream(
    messages, model=model, ..., _pool_retry=_pool_retry + 1, **kwargs,
):
    yield evt
return
```
- 复现：外层生成器在 `yield evt` 处被消费者 `aclose()`，`GeneratorExit` 抛入外层；被 `async for` 委托的内层 `self.astream(...)` 是**另一个独立异步生成器**，不自动随外层关闭。
- 影响：换 key / openrouter→agnes failover 路径下，断开可能遗留一条仍在跑的上游流，白烧 token；与同文件 native 分支专门用 `aclose_async_gen`（L3638-3646 注释 + L3787）解决的是同一类问题，但递归转发腿没套同一纪律。
- 注：`aclose_async_gen` 内部实现（`app/services/async_gen_close.py`）本轮未读，"是否幂等 + 会向子 gen athrow"标**存疑**（Q1）。

### D-AI-2 · 中间帧 / 首 token 均无独立超时闸（可用性，P1）
`llm_gateway.py:3973`、`4016`
```python
call_kwargs["timeout"] = cap.default_timeout   # 注释：NVIDIA 120s / CF 60s / 其他 30s
...
async for chunk in response:
```
- 复现：`call_kwargs["timeout"]` 是 LiteLLM 请求级超时；进入 `async for chunk` 后，两个 chunk 之间的间隔没有任何 watchdog。上游建流后慢速滴流或半开连接时，客户端在 SSE 通道上只会看到静默，网关侧不主动切。
- 影响：首 token 超时、中间帧超时在产出层均缺独立设置。`routers/llm.py:1777 _astream_first_event_keepalive` 只做首事件保活（本轮只读 grep 命中 + L1850 的 `aclose_async_gen` 调用行，函数体未读），不覆盖中间帧。
- 定位：整体超时 = `cap.default_timeout`（L3973）；首 token / 中间帧 = **产出层无**，仅在 45s 上游 `timeout-guard` 占位帧检测（L186-195 `_is_stream_timeout_guard` + L4017-4030）这一个点兜一次，且只在极速 API 这类"真的发占位帧"的上游生效。

### D-AI-3 · 已发内容后上游异常，错误原因不透出（错误透传，P1）
`llm_gateway.py:4327-4341`
```python
if accumulated_content or accumulated_reasoning:
    ...
    yield {"type": "partial_done", "fallback_applied": False,
           "reason": "stream_interrupted", "model": used_model}
    return
```
- 复现：上游发若干 chunk 后 raise `APIConnectionError` / `RateLimitError` / 内容过滤类异常 → 走到此分支。`safe_msg` / `err_code` 在 L4291-4301 已算好（含脱敏与 `MODEL_NOT_CONFIGURED` / `PROVIDER_NOT_IMPLEMENTED` 分类），但**不 yield**。
- 影响：已发内容的失败，客户端拿不到 `errorCode` / `message` / 上游 http 状态，只能推断"被截断"。与任务问的"超时/限流/内容过滤如何映射为流错误帧"直接相关——LiteLLM 腿在这条路径上映射是空缺的。
- 对照：native 腿（L3835-3843）在异常收口时会补一条 `{"type":"error","message":...}`，两腿不对称。

## 不完整实现

- **D-AI-4**：LiteLLM 腿 `final_usage` 来自 `chunk.usage`（L4079-4087）时不标 `estimated`，也没有 native 腿那套 camelCase 归一（对照 L3754-3766 `_GEMINI_NATIVE_USAGE_KEYS`）。若有 provider 走 LiteLLM 且返回 camelCase usage，`prompt_tokens` 取 0。**触发面未核**（未读各 provider 文件），标存疑（Q4）。
- **D-AI-5**：`_stream_debug = True  # Force enable SSE debug logging`（L4002）是强制开调试，每 token 一条 `logger.debug` + `time.perf_counter()`（L4042-4051）。高并发下噪声/开销，且不像可配置项，像调试残留（P2）。
- **D-AI-6**：成功路径 `record_llm_outcome(...'ok')` + `record_user_request('stream','ok')` 在 `yield done`（L4243）**之前**（L4207-4242）。若客户端恰在 done 这个 yield 上断开，`GeneratorExit` 落在 L4243、不进 L4090 的 try，成功已被记但客户端未收到 done，用户级成功与实际送达之间有窗口（P2）。
- **D-AI-7**：`timeout-guard` 回退（L4115-4138）重发整段非流式内容。若 `break` 前已 yield 过真实 chunk，客户端收到前缀重复。触发条件苛刻（上游要先发占位帧、且此前已发过内容），P2。

## 存疑（未读到实现，不判缺陷）

- **Q1**：`app/services/async_gen_close.py` 的 `aclose_async_gen` 是否在父 gen 被 `aclose()` 时自动向子 gen 传播——未读。
- **Q2**：路由层断开检测如何触达生成器（`routers/agents.py:138 _closing_event_stream`、`routers/llm.py:4357 complete_stream` 的 `request.is_disconnected()` / `DisconnectEvent`）——未读函数体，取消传播链未核。
- **Q3**：`asyncio.task` 泄漏——本文件未见 `create_task`；`app/sio/__init__.py:24` 注释称 socketio 长任务跑独立 task，未读确认取消语义。
- **Q4**：见 D-AI-4，camelCase usage 走 LiteLLM 腿的实际触发 provider 未核。
- **Q5**：`provider_slot` 在 `yield` 挂起期间持续占位——代码形态是 `async with provider_slot(...)` 包住 `async for`，挂起即在闸内；是否符合预期语义未读 `provider_slot` 实现。

## 六问速答

| # | 问题 | 结论（证据行） |
|---|---|---|
| 1 | yield 边界 / delta 格式 | chunk L4052、reasoning L4056、tool-call-args-delta L4073（`tool_call_args_stream=True` 时）、聚合 tool_calls L4162 / L3891、done L4243、error L4517、partial_done L4335、retry_scheduled L4364、fallback L4408。均为 `dict[str, Any]`，SSE 编码在路由层 |
| 2 | 多 provider / tool-call 累积 / usage | 原生分支 L3597-3906 与 LiteLLM 分支 L3950-4517 双路径。tool_calls 按 index 累积（`native_tool_acc` L3615 / `litellm_tool_acc` L4007），逐分片直推腿独立 store（L3617 / L4009）。usage：上游 done/usage chunk 优先，缺则 `litellm.token_counter` 估算并标 `estimated` |
| 3 | 错误透传 | 未发内容：换 key 重试 L4345 → openrouter failover L4388 → fallback_router L4429 → error 帧 L4517。已发内容：只发 partial_done，**丢 errorCode**（D-AI-3） |
| 4 | 取消传播 | LiteLLM 主循环有 `GeneratorExit` 计数 + finally `aclose` response（L4090-4114）；native 腿有 `aclose_async_gen`（L3784-3789）。**递归重试腿无此保护**（D-AI-1） |
| 5 | 超时 | 整体：`cap.default_timeout` L3973（30/60/120s）。首 token / 中间帧：**产出层无独立闸**（D-AI-2）。45s timeout-guard 是上游占位帧检测（L186-195 / L4017），非本地计时 |
| 6 | 资源 | response finally aclose ✓；native iter finally `aclose_async_gen` ✓；递归转发腿存疑（D-AI-1 / Q1）；本文件无 `create_task`；`_stream_debug` 强制开（D-AI-5） |

## 未覆盖

全部 provider `astream` 实现（anthropic / doubao / zhipu / kling / volcengine / token6688 / dashscope / agnes / lmstudio / llama_cpp / openai 等）、`app/services/async_gen_close.py`、`routers/agents.py` / `agent_runtime.py` / `langgraph.py` / `llm.py` 的生成器包装与断开检测函数体、`provider_slot` 实现、`app/sio/handlers.py:449-455` 的 astream 消费、`middleware/audit.py` 与 `middleware/llm_metrics.py` 的收口逻辑——均未读正文，仅由 grep 命中定位。