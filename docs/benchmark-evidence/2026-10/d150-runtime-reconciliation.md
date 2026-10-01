<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D150 运行时对账取证(S15 环境对账,2026-10-01)

> 取证人:S15 环境对账会话。方法:全栈五端口起活 → 真实注册/登录 → POST /api/ai/chat/stream
> 逐帧抓 SSE → 与 [packages/shared/src/sse/contract.ts](../../../packages/shared/src/sse/contract.ts)
> 对账。探针脚本 `.ihui-agent/tmp/s15-d150/probe.mjs`(临时面,可复现)。凭据不落正文,只留 sha256 前 8 位指纹。

## 一、结论

| 项 | 三态 | 证据 |
| --- | --- | --- |
| AI 对话流端到端(注册→登录→SSE 流→done) | **已验证**(此前禁止下的"端渲染已验证"结论,本次起才算数) | §四 两轨帧序列 |
| gemini provider `stream_usage` 400 | **已修复**(真缺陷实锤+修复+回归三段齐全) | §三 错误演化链 |
| 帧级 traceId(D174:小写 32 hex、全轮恒定) | **已验证** | §五 契约对账 |
| usage `estimated:true` 兜底(stream_usage 关闭时 token_counter 估算) | **已验证** | §五 契约对账 |
| `reasoning` 事件( thinking 链增量) | **已验证**(gemini 轨未触发,CF 轨 246 帧) | §四 CF 轨 |
| 默认模型链对普通用户 | **断裂**(stepfun/step-router-v1 → auto-route → llm7/gpt-oss:20b 上游 InternalServerError) | §六 发现① |
| 模型目录 `gemini/gemini-2.5-flash` | **上游退役**(Google 404:no longer available to new users,建议 gemini-3.8-flash) | §六 发现② |

## 二、环境对账(S15①)

五端口:PG 5432 / Redis 6379(常驻)+ web 8801 / api 8802 / ai-service 8803
(`scripts/start-dev.ps1` 非沙箱启动,沙箱拒写 D:\pnpm-home 与 D:\caches\uv)。
健康检查:web `200`、api `{"status":"ok"}`、ai-service `{"status":"ok","service":"ihui-ai-service"}`。

排障记录(对后续会话有用):uvicorn `--reload` 的 multiprocessing 子进程会**继承监听
socket**,kill 父进程后端口仍被死 PID 占着 —— 要把 `spawn_main(parent_pid=…)` 的子进程
一并杀掉端口才真正释放。api 也出现过后台任务终止后 8802 掉线,重启即恢复。

## 三、错误演化链(gemini provider,同账号同探针)

1. **修复前** `gemini/gemini-2.5-flash` → HTTP 400(traceId `335d4d0a2c811919dde17612ce83d54c`):

```json
{"i":0,"event":"error","data":{"type":"error","message":"litellm.BadRequestError: OpenAIException - Error code: 400 - [{'error': {'code': 400, 'message': 'Invalid JSON payload received. Unknown name \"stream_usage\": Cannot find field.', 'status': 'INVALID_ARGUMENT'}}]","errorCode":"LLM_ERROR"}}
```

   实锤路径:litellm 日志 provider=openai → 本仓对 gemini 走 **Google OpenAI 兼容端**,
   该端拒绝 `stream_usage` 字段。
2. **修复**:[provider_caps.py](../../../apps/ai-service/app/core/provider_caps.py) 的
   `gemini`/`google` 两条 cap 置 `supports_stream_usage=False`(与 NVIDIA/StepFun 同型,
   usage 走 token_counter 兜底)。
3. **修复后** 同模型复跑 → 400 消失,错误变为 Google 404
   "models/gemini-2.5-flash is no longer available to new users… update to models/gemini-3.8-flash"
   (traceId `0a1ff9a8c98cab9d32d61e80a7e164c1`)。**400→404 的演化本身就是修复生效的差分证明**。
4. **回归通过** `gemini/gemini-3.8-flash`(目录内既有条目)→ 完整成功轨,见 §四。

## 四、SSE 帧序列(逐帧,原文)

### 轨 A:gemini/gemini-3.8-flash(4 chunk + 1 done,duration 14383ms)

完整文件:[d150-sse-frames-gemini38-flash.jsonl](./d150-sse-frames-gemini38-flash.jsonl)。

```json
{"i":0,"t_ms":10131,"event":"chunk","data":{"type":"chunk","content":"我是由 Google 训练","traceId":"b326769a4a47b38467d919e0d1a25c00"}}
{"i":1,"t_ms":13946,"event":"chunk","data":{"type":"chunk","content":"的大型语言模型 Gemini。我","traceId":"b326769a4a47b38467d919e0d1a25c00"}}
{"i":2,"t_ms":14114,"event":"chunk","data":{"type":"chunk","content":"擅长处理自然语言，能够协助你进行编程、写作、回答问题以及","traceId":"b326769a4a47b38467d919e0d1a25c00"}}
{"i":3,"t_ms":14307,"event":"chunk","data":{"type":"chunk","content":"分析复杂信息。\n\n这是一个示例代码块：\n\n```python\nprint(\"hi\")\n```","traceId":"b326769a4a47b38467d919e0d1a25c00"}}
{"i":4,"t_ms":14383,"event":"done","data":{"type":"done","model":"gemini-3.8-flash","usage":{"prompt_tokens":43,"completion_tokens":73,"total_tokens":116,"estimated":true},"stub":false,"metadata":{"userId":"f4f40c02-49be-4b93-bb52-d32aa5a16352"},"traceId":"b326769a4a47b38467d919e0d1a25c00"}}
```

### 轨 B:@cf/zai-org/glm-4.7-flash(246 reasoning + 33 chunk + 1 done,duration 13387ms)

完整 280 帧落盘:[d150-sse-frames-cf-glm47-flash.jsonl](./d150-sse-frames-cf-glm47-flash.jsonl),
run 元数据 [d150-run-meta-cf-glm47-flash.json](./d150-run-meta-cf-glm47-flash.json)。此处贴特征帧:

```json
{"i":0,"t_ms":2650,"event":"reasoning","data":{"type":"reasoning","content":"1","traceId":"9a8c003fd79884c3fd28bd898ef513cf"}}
{"i":1,"t_ms":2651,"event":"reasoning","data":{"type":"reasoning","content":".","traceId":"9a8c003fd79884c3fd28bd898ef513cf"}}
{"i":246,"t_ms":12056,"event":"chunk","data":{"type":"chunk","content":"我是Z","traceId":"9a8c003fd79884c3fd28bd898ef513cf"}}
{"i":279,"t_ms":13387,"event":"done","data":{"type":"done","model":"@cf/zai-org/glm-4.7-flash","usage":{"prompt_tokens":43,"completion_tokens":637,"total_tokens":680,"estimated":true},"stub":false,"metadata":{"userId":"f4f40c02-49be-4b93-bb52-d32aa5a16352"},"traceId":"9a8c003fd79884c3fd28bd898ef513cf"}}
```

要点:reasoning 帧先于 chunk 帧且密集到单字符粒度(246 帧/约 9.4s),前端思维链面板
按增量渲染的假设在真流上成立。

## 五、契约对账(contract.ts SSE_EVENTS 32 名 vs 运行实证)

- 纯聊天轨(无工具、无审批、无子 agent)实证 `chunk` / `reasoning` / `done` /
  `error`(§三失败帧)四类 —— 其余 28 名属工具循环/终端/表单/预算等分支,本轮探针
  不触发,**不据此判缺**,分支帧取证留给 D131(断线审批)与后续 agent 流对账票。
- **D174 帧级 traceId 规则全过**:两轨所有帧 traceId 均为小写 32 hex;同一轨内恒定
  (A 轨 `b326769a…`,B 轨 `9a8c003f…`);不同轨不同值。
- **done 载荷契约**:`model`/`usage{prompt,completion,total,estimated}`/`stub:false`/
  `metadata.userId` 与 contract.ts 的 DonePayload 同形;`estimated:true` 正是
  stream_usage 关闭后 token_counter 兜底的设计行为(两轨一致)。
- `usage` 独立帧未出现:与 provider cap 一致(gemini/cf 均 `supports_stream_usage=false`,
  usage 并入 done),非契约违背。

## 六、发现清单(待开票/待修)

1. **默认模型链对普通用户断裂**:不显式传 model 时走 stepfun/step-router-v1 →
   auto-route → llm7/gpt-oss:20b,上游 InternalServerError(llm7 不可用)。新注册用户
   首条消息直接报错,属**首启体验级**问题,建议开票(修法候选:默认链兜底改健康模型)。
2. **模型目录含上游已退役模型**:`gemini/gemini-2.5-flash` 对新账号 404。目录
   (default_models.json)建议按上游可用性清理或标记。
3. **stepfun 显式模型仅系统管理员可用**:普通用户显式指名 stepfun 模型被拒(权限层
   行为,记录备查,不算缺陷)。
4. **ihui/glm-5.3-flash 90s 超时**(ihui_relay 上游无响应,记录备查,与本票无关)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
