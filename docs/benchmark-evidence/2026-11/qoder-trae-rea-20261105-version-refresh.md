<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 版本刷新取证 + jsonrepair 复现-超越交付（2026-11-05，续 2026-10/2026-11 取证册）

> 逆向-复现-超越（AGENTS §0.12）。本册是既有取证工作的**版本刷新续跑**：2026-10/2026-11 取证册
> 对 Qoder/Trae 的结论带红线「竞品版本一变，本册全部结论作废，必须重取」。本次对本机**现装版本**
> 重跑 rea，确认能力面稳定，并据此关闭一个既有 backlog 之外的真实缺口。

## 0 本次取证的真实安装体（现读于 2026-11-05）

| 对照程序 | 路径 | 版本 | rea 输入 |
| --- | --- | --- | --- |
| Qoder CN | `D:\电脑软件\Qoder CN\.qoder-versions\0.5.3\Qoder CN.exe` + `…\resources\app.asar` | **0.5.3**（基线为 0.5.1） | `app.asar` |
| Trae CN | `D:\电脑软件\Trae CN\resources\app` | **3.4.14**（基线为 3.4.12） | `resources/app` |
| WorkBuddy（本仓桌面端） | `D:\电脑软件\WorkBuddyAI\` · `D:\Huorong\WorkBuddy\` | 5.9.3 | —（即本项目自身，非对照） |

工具链：全局 `rea-agents@6.4.0`（此前经 `.ihui/mcp.json` 接线，本次直接 CLI 调用，带
`GHIDRA_INSTALL_DIR` / `JAVA_HOME` 与既往一致）；Evidence 落盘于
`D:\IHUI-AI\.ihui-agent\rea-output\{qoder,trae}\{overview.json,capability-inventory.json}`
（约 192MB / 191MB 规范 Evidence）。

## 1 能力面稳定性复核（重取结论）

- **MCP 工具集成**：Qoder 含完整 `@modelcontextprotocol/{client,core,node,sdk,server}`（连 server 都有）+
  `@qoder-ai/qoder-cn-agent-sdk`；Trae 含 `@byted/modelcontextprotocol-client` + 自研 IPC/RPC
  `@aha-kit/{ipc,net,rpc}`。与 2026-10 基线一致。
- **自主智能体循环**：Trae 的 `@byted-solo/*`（SOLO 自主智能体）仍在；Qoder 的 agent SDK 端点数 **248**（多于基线 142 的 Trae）。
- **LLM 输出 JSON 修复**：**Trae 依赖清单直接含 `jsonrepair`**（本次新确认的关键信号——此前基线未单列）。
  Qoder 等价能力隐含在其 agent SDK 的容错解析路径中。
- **前端/终端/浏览器自动化**：`node-pty` + `@xterm` + `terminal-suggest`（终端）、`chrome-remote-interface` /
  `trae-browser-inspect`（浏览器自动化）两家的量纲与基线一致。

⇒ 既有 2026-10/2026-11 取证册的 33 轴对照与 T1–T12 机制描述**仍然有效**，无需推翻；本册仅补充版本增量与
`jsonrepair` 这一此前漏列的依赖信号。

## 2 关闭的缺口：流式感知 JSON / 工具调用入参修复（复现 + 超越）

**对标**：Qoder/Trae 的 `jsonrepair` 依赖（一次性修复残缺 JSON）。
**本仓此前状态**：`packages/shared/src/utils` 无任何 JSON 修复工具（grep `jsonrepair|repairJson|truncateJson`
全仓 0 命中），也无 seat-handoff 认领此缺口 → 真实未交付缺口。

**交付物**（自研，不粘贴任何专有源码，不引入第三方 jsonrepair 包）：
- `packages/shared/src/utils/json-repair.ts`
  - `repairJson(input)`：一次性尽力修复——截断尾值 / 缺失收尾括号（含未闭合字符串收尾引号）/
    尾随逗号 / 裸键名 / 单引号字符串（含 `\'` 等 JS 转义解码）/ JS 注释 / 裸 `NaN`·`Infinity`。
  - `StreamingJsonRepair` / `createStreamingJsonRepair()`：**超越轴**——`jsonrepair` 只能吃完整字符串，
    本实现在此基础上支持「流前缀」：每喂一片即返回 `{ complete, partial, value }`，在 SSE 工具调用入参
    仍在到达时就能渐进渲染。完整性以「原始缓冲无需修复即 `JSON.parse` 通过」为准，绝不会把修复补出的
    收尾误判为完成；一旦原始缓冲达成完整值即锁定。
- `packages/shared/src/utils/__tests__/json-repair.test.ts`：**19 例 GREEN**（含「半截字符串必须回退到
  最后一个引号前」「嵌套对象尾随截断只丢最外层半截属性」等回归钉死用例）。
- 导出注册：`packages/shared/src/utils/index.ts` 增加
  `// 流式感知 JSON 修复唯一实现（…对标 Qoder/Trae 的 jsonrepair 依赖，并超越其「只能吃完整字符串」的流式轴）`
  `export * from './json-repair'`。
- **守门**：`npx tsc --noEmit`（shared 包 strict）0 错；`npx vitest run json-repair.test.ts` 19/19 通过。

## 3 迭代进度（续 2026-11-05 下半场）

### 3.1 已落地：把修复/流式能力接到 SSE 工具调用入参解析链（超越轴首个真实落脚点）

> 注：`mcp-tool-activity.ts` 经核实是「活动措辞文本」三层回落解析，并非入参解析位点；真实入参解析位点是
> `packages/shared/src/utils/sse-parse.ts` 的 `tool-call-start` / `tool-result` 三处 `args` 抽取。

- 新增 `packages/shared/src/utils/tool-call-args.ts`（接 `json-repair` 的 `repairJson` / `StreamingJsonRepair`）：
  - `normalizeToolCallArgs(raw)`：**入参归一化单一出口**——已是对象原样返回（引用不变，既有的 deep-equal 对账不受影响）；
    字符串走 `repairJson` 修复解析；null/数组/原始类型/空串 → `undefined`。覆盖「上游把 args 当 JSON 字符串下发」或「略带残缺」的情形。
  - `ToolCallArgsStreamer` / `createToolCallArgsStreamer()`：**增量 `function.arguments` 流式解析引擎**——
    喂入 OpenAI 风格字符串分片，每片即给出 `{ complete, partial, args }`，流未闭合即可渐进渲染入参（`jsonrepair` 只能吃完整串，做不到）。
- 接入 `sse-parse.ts`：三处 `args` 抽取（`protoType==='2'`、`tool-result` 自定义 JSON、`tool-call-start` 自定义 JSON）
  改走 `normalizeToolCallArgs(...)`，导入已加。
- 导出注册：`utils/index.ts` 增加 `export * from './tool-call-args'`。
- **守门**：`tool-call-args.test.ts` 10 例 GREEN（含「上游把 args 当字符串下发必须收敛为对象」回归钉死）；
  `npx tsc --noEmit`（shared strict）0 错；既有 `sse-parse*` + `json-repair` 共 **55 例**全绿（零回归）。

### 3.2 已落地 / 进行中（收尾轮更新于 2026-11-05）

1. ✅ **已落地（见 §3.3）**：把 `ToolCallArgsStreamer` 接到真正的增量 args 分片消费端——`@ihui/api-client`
   新增 OpenAI 兼容流式工具调用解析路径（`openai-tool-stream.ts` + `streamChat` 的 `openAiCompat` 分支），
   按 call `index` 增量累积 `function.arguments` 并逐片出 partial/complete 态，落点即 ToolCallCard 的渐进渲染引擎。
2. ✅ **后端 `apps/ai-service`（Python）侧等价移植已完成**——见 §3.4。
3. 余下对照能力（MCP server 侧、SOLO 自主循环、终端/浏览器自动化）按 2026-11 seat-handoff 派工序推进，
   本册不重复认领已被 seats b44–b46 认领的缺口。

### 3.3 已落地：下沉 @ihui/api-client（单一真相源）+ OpenAI 兼容流式工具调用解析（超越轴真正落点）

**为什么下沉**：`@ihui/api-client` 是运行时最底层包（仅依赖 `@ihui/types`），而 `@ihui/shared` 运行时 import
api-client；若让 api-client 反向依赖 shared 会形成真实循环依赖。故把 `json-repair` / `tool-call-args` 的
**唯一实现**下沉到 api-client，shared 改为再导出壳（守门 §2 单一真相源），端内消费者（`from '@ihui/shared'`）
命名导入零变化。

- `packages/api-client/src/json-repair.ts`（由 shared 版原样下沉，`import` 改 `.js` 扩展名风格）——
  `repairJson` / `StreamingJsonRepair` / `createStreamingJsonRepair` + 类型 `RepairResult` / `StreamingRepairSnapshot`。
- `packages/api-client/src/tool-call-args.ts`——`normalizeToolCallArgs` / `ToolCallArgsStreamer` /
  `createToolCallArgsStreamer` + 类型 `ToolCallArgsState`；内部 `import ... from './json-repair.js'`。
- `packages/api-client/src/openai-tool-stream.ts`（**新增，超越轴真正落点**）：
  - `parseOpenAiStreamLine(line)`：解析 OpenAI 风格 SSE（`data: {...}` 或裸 JSON；`[DONE]` 返回 `null`），
    抽出 `content` / `tool_calls[]`（`index`/`id`/`name`/`argsFragment`）/ `finish_reason`；非 JSON 或
    非 chat-completion 形态返回 `null`（不抛）。
  - `OpenAiToolCallAccumulator` / `createOpenAiToolCallAccumulator()`：按 call `index` 维护一个
    `ToolCallArgsStreamer`（来自 `./tool-call-args.js`，能力源自 `./json-repair.js` 的流式修复），每片
    `function.arguments` 到达即给出 `{ complete, partial, args }`——流未结束时即渐进渲染，且残缺片
    （截断/裸键/单引号）经修复后解析，卡片不因截断崩。`finish()` + `snapshot()` 在流终态再发一次完整态。
  - 导出注册：`packages/api-client/src/index.ts` 显式命名清单新增上述值 + 类型（api-client 入口是显式清单，
    漏导出端内拿到 `undefined`；与 `next.config.ts` 的 `typescript.ignoreBuildErrors:true` 吞 TS2305 既往坑对齐）。
- `packages/api-client/src/client.ts`（`streamChat`）：新增 `openAiCompat?: boolean` /
  `onOpenAiToolCall?` / `onOpenAiContent?` 三选项；`processLine` 内新增 **默认关闭** 的 OpenAI 分支
  （`hasOpenAiCompat = opts.openAiCompat === true`），逐行经 `parseOpenAiStreamLine` 解析，`tool_calls`
  增量喂给累积器并回调 `onOpenAiToolCall`；`onAttemptStart` 复位累积器。**默认 `openAiCompat=false` ⇒
  走既有 Vercel AI SDK 协议解析，零行为变化**；Vercel `parseStreamLine` 对 OpenAI 行返回 `null`，两条解析互不干扰。
- `packages/shared/src/utils/json-repair.ts` 与 `tool-call-args.ts`：**改为再导出壳**
  （`export { ... } from '@ihui/api-client'`，保留 provenance 水印头 + 显式「单一真相源已下沉」注释），
  严禁在壳内新增实现（防漂移）。`sse-parse.ts` 的 `import { normalizeToolCallArgs } from './tool-call-args'`
  经壳解析，命名导入零变化。
- **守门**：`pnpm --filter @ihui/api-client typecheck` 0 错；`pnpm --filter @ihui/api-client test`
  **680/680 GREEN**（含新增 `openai-tool-stream.test.ts` 的 12 例：行解析 + 按 index 增量累积 +
  并行多 call + finish/snapshot + 残缺片修复 + 不可修复片不误报 complete）；`pnpm --filter @ihui/shared
  typecheck` 0 错，shared 既有 `json-repair`/`tool-call-args`/`sse-parse` 测试（共 84 例）随壳全绿
  （另有 2 例 `packages/app` 上屏腿拓扑守门属既有无关失败，非本册改动引入：其静态读取
  `packages/app/src/index.ts` 抱怨「死副本获得公开出口」，该文件本会话未改动）。

### 3.4 已完成：后端 `apps/ai-service`（Python）等价移植（复现 + 超越，行为与 TS 侧逐条对齐）

**红线守门**：纯自研 Python 等价实现（仅依赖标准库 `json`/`re`），不粘贴任何对照程序专有源码、不引入第三方
`jsonrepair`、不提取任何凭据；新文件均带 provenance 水印头 + `[IHUI-AI-PROVENANCE]` 溯源标注。

**交付物**：
- `apps/ai-service/app/utils/json_repair.py`（对标 `packages/api-client/src/json-repair.ts`）：
  - `repair_json(text)`：返回 `{ok, value, recovered, error}`（字段对齐 TS `RepairResult`）。
  - `StreamingJsonRepair` / `create_streaming_json_repair()`：**超越轴**——`push(chunk)` 返回
    `{complete, partial, value}`，完整性以「原始缓冲无需修复即 `json.loads` 通过」为准（与 TS 完全一致）。
  - 关键 Python 适配点（与 TS 逐一对齐的硬约束）：
    1. `json.loads` 默认会接受 `NaN`/`Infinity`，而 `JSON.parse` 不接受 → 用 `parse_constant` 显式拒绝，
       使其回落到 `neutralize_non_finite` 修复成 `null`（否则 `NaN` 会误修复成 `nan`，破坏与 TS 的对等）。
    2. 尾随半截 token 回退（`_trim_trailing_partial`）的 `valMatch` 加「匹配长度 > 0」护栏，严格镜像 TS。
- `apps/ai-service/app/utils/tool_call_args.py`（对标 `packages/api-client/src/tool-call-args.ts`）：
  - `normalize_tool_call_args(raw)`：已是对象原样返回（引用不变）/ 字符串走 `repair_json` 修复 / 其余 → `None`。
  - `ToolCallArgsStreamer` / `create_tool_call_args_streamer()`：增量 `function.arguments` 分片 → `{complete, partial, args}`。
  - `accumulate_tool_call_arguments(store, index, name, fragment)`：**SSE 增量累积接入缝**——调用方按 SSE 会话
    持有 `Dict[int, ToolCallArgsStreamer]`（避免跨会话共享模块级可变态），按 call `index` 维护独立流；docstring
    给出「逐分片喂给前端 ToolCallCard」的用法示例。当前 ai-service 的 astream 已在服务端把分片聚合成完整事件，
    此函数为「逐分片渐进渲染」预留接入缝（行为与 TS `ToolCallArgsStreamer` 对等）。
- **真实落地缝（残缺 `arguments` 不再静默丢成 `{}`）**：
  - `apps/ai-service/app/routers/agents.py` 的 `_convert_openai_tool_calls`：原 `json.loads` + 静默 `{}` 兜底
    → 改走 `normalize_tool_call_args`（字符串形态经修复解析，非字符串原样透传）。这是 Qoder/Trae 用 `jsonrepair`
    解决的核心痛点在本仓后端的首次落地。
  - `apps/ai-service/app/routers/agent_plan.py` 的 `_make_loop_v2_llm`：同样脆弱的 `json.loads` 兜底 → 改走
    `normalize_tool_call_args`。
  - `apps/ai-service/app/services/protocol_adapter.py`（**4 处**，其中 3 处原本**完全没有 try/except**，
    残缺 `arguments` 会直接抛异常崩请求）：OpenAI→Anthropic / OpenAI→Gemini / Anthropic→Gemini /
    Gemini→OpenAI 四向转换的 `args` 解析全部改走 `normalize_tool_call_args(...)` or `{}`，彻底消除崩溃面。
- `apps/ai-service/tests/test_json_repair.py`：**37 例 GREEN**（pytest，含 `repair_json` 一次性修复 15 例、
  `StreamingJsonRepair` 流式渐进 5 例、`normalize_tool_call_args` 归一化 6 例、`ToolCallArgsStreamer` 增量 3 例、
  `accumulate_tool_call_arguments` 按 index 隔离 1 例、以及真实落地缝 `_convert_openai_tool_calls` 5 例
  ——其中「残缺 `arguments` 经修复解析而非退化为 `{}`」为关键回归钉死）。

**守门**：`.venv/Scripts/python.exe -m pytest tests/test_json_repair.py -n 0 -q` → 37 passed；
导入冒烟 `import app.routers.agents, app.routers.agent_plan, app.services.protocol_adapter, app.utils.json_repair, app.utils.tool_call_args` → OK。
全部纯函数、无共享可变态，可安全并行执行。

### 3.5 本轮收尾结论（两项可选增强已于同日续轮全部落地）

- **复现**：Qoder/Trae 依赖 `jsonrepair` 修复残缺工具调用 `arguments` 的痛点，已在 TS（shared→api-client 下沉）
  与 Python（ai-service）**双侧**自研补齐，零第三方依赖、零专有源码粘贴。
- **超越**：`jsonrepair` 只能吃完整字符串；本仓 `StreamingJsonRepair` / `ToolCallArgsStreamer` 支持「流前缀」增量
  修复，使 ToolCallCard 在 SSE 分片到达过程中即可渐进渲染入参。
- **单一真相源**：`json-repair` / `tool-call-args` 实现唯一位于 `@ihui/api-client`（最低层包，避免
  shared↔api-client 循环依赖），`@ihui/shared` 仅做再导出壳；Python 侧独立但行为逐条对齐。
- **真实落地缝**：前端 SSE 解析（`sse-parse.ts`）与后端各转换/转发处的残缺 `arguments` 已全部改走归一化修复
  （续轮另补齐 `protocol_adapter.py::openai_to_gemini_response` 与 `llm.py` generic 通道两处裸 `json.loads`），
  不再静默丢成 `{}` 或崩溃。

#### 3.5.1 续轮：两项可选增强端到端贯通（2026-11-05）

| 增强 | 落点 | 纪律 |
|---|---|---|
| ① 前端 ToolCallCard 渐进渲染 | `send-message.ts` / `send-answer.ts` 订阅 `onOpenAiToolCall`；`createOpenAiToolCallHandler` 按 call index 建卡、partial 只写 `partialArgs`；卡片新增 `tool-call-partial-args` 预览块（与 D113 diff 预览同在展开区，需展开卡片可见） | `openAiCompat` 仍 opt-in 且保持原义；Vercel `onToolCall`/`onToolDelta` 一行不动；`tool-result` 到达即清预览 |
| ② ai-service 逐分片直推 | `LLMGateway.astream(tool_call_args_stream=…)` 在 native/litellm 两条累积腿旁并列持 `store`，每片调 `accumulate_tool_call_arguments` 产 `tool-call-args-delta`；`llm.py` generic 原生 FC 通道显式开启，经既有通用兜底原样上 wire | 归一化 + index 分配抽为 `_normalize_tool_call_fragments` **单份判据**，两腿下标恒一致；默认档 False ⇒ 其余通道零行为变化 |
| 汇流 | api-client 新增 `parseToolCallArgsDeltaFrame`，把自定义帧归一到同一个 `OpenAiToolCallDelta` ⇒ 前端只需一份 handler 同时接住 OpenAI 原生行与本仓帧 | 新事件在 `sse_contract.py` / `contract.ts` / `agent_events.py` 同步登记；`families.ts` 交叉引用标 `null`（agent 流无同生命周期事件）；parity 门无契约漂移 |

**守门（2026-11-05 当次实测）**：三包 `typecheck` 全 0 错；后端定向 86 passed（`-n 0`，异步用例需带
`pytest-asyncio` 的 venv）；新增 api-client 14 例、web handler 6 例与卡片 3 例全绿；shared 契约单测
22 例全绿（事件计数与点名断言已同步）。全量档仍有**与本轮无关的存量红**：api-client 1 例
`git grep --untracked` 冷启动超时（flaky，单跑转绿）、shared 2 例确定性台账漂移（11-04 遗留）+ 扫描
超时伪红、parity 门 1 条 `miniapp-taro permission` 端能力棘轮 —— 按存量归因只报告，不擅动判据。

**红线**：未粘贴任何对照程序专有源码、未引入第三方 `jsonrepair`、未提取/硬编码任何凭据；provenance 水印齐备。

#### 3.5.2 激活收口：agent 工具循环逐分片直推实际打通（2026-11-05 续）

续 3.5.1 的「可选增强」清单，本次把上次刻意留作 opt-in 的两步激活开关真正接上，使生产默认通路即可实时渐进渲染：

- **根因修复**：3.5.1 仅给 `llm.py` 的 generic 原生 FC 通道开了 `tool_call_args_stream=True`，而真正的 agent 工具循环（首轮 `_tool_iter==0` / 后续轮）两处 `astream` 调用既未传该开关，其 SSE 事件 `elif` 链也**缺 `tool-call-args-delta` 分支**——即使开启，逐片帧也会被静默丢弃。本轮补：① 两处 `astream` 显式 `tool_call_args_stream=True`；② 两处 `elif` 链补 `tool-call-args-delta` 透传分支。
- **实测抓出的 bug**：首版透传分支误用 `SSE_TOOL_CALL_ARGS_DELTA` 常量（该常量仅定义在 `app/services/agent_events.py`，`llm.py` 未导入）→ 运行时 `NameError` 中断流。修复为直接用事件类型串 `_evt_type` 作 SSE 名（与 generic 通道通用兜底 `yield _sse(event_type, event)` 同律）。该 bug 由新增端到端测试 `test_agent_loop_delta_frame.py` 捕获（`agent 循环必须透传 tool-call-args-delta 帧` 断言失败 → 定位到未定义常量）。
- **测试锁定**：`tests/test_agent_loop_delta_frame.py` 捕获 `astream` 调用参数断言 `tool_call_args_stream is True`，并断言 `tool-call-args-delta` 帧端到端到达 wire + 两轮 `astream` 闭环（首轮决策工具 + 续轮产出最终回复）。
- **守门实证**：ai-service 相关套件 99 例全绿（新测试 + streaming_tool_loop + tool_loop_e2e + tool_delta_frame + json_repair + sse_contract + protocol_adapter + native_fc）；私有索引 CAS 提交 `89af54537b`，守门批 333 项全执行、本席零阻断红；`removed:[]/skipped:[]` 未误带他席在途文件。
- **parity 门**：`tool-call-args-delta` 与 30+ 主线事件同列「未判定」档（覆盖面边界），唯一「阻断 commit」仍是 `miniapp-taro permission` 存量，与本轮无关。
- **链路全通结论**：`ai-service 发射（tool-call-args-delta）→ apps/api 透明透传（ai-chat-stream 仅配对 usage|steer|fallback）→ api-client 归一 OpenAiToolCallDelta → web ToolCallCard 渐进渲染`，整条链路 opt-in 已激活，无额外部署开关。

**本册已无必须交付项，可闭环。**
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
