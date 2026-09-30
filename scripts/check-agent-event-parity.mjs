#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-agent-event-parity.mjs
 *
 * 守门脚本: PROJECT_PLAN.md H11 指标「跨端一致:Agent 事件、API 契约、样式 token
 * parity 守门全绿」缺失的一环 —— Agent SSE 事件契约 parity 守门。
 *
 * 校验目标:
 *   1. 扫描后端 Agent SSE 事件生产者, 提取写出的事件名清单:
 *      - apps/api/src 下全部 .ts: Fastify `event: <名>` 模板字面量写出
 *        (agent-runtime.ts execute/stream) + broadcastSSEEvent 广播 type
 *        (agents-kanban.ts / agent-task-routes.ts / subagent-dispatch-service.ts /
 *        workspace-lock-heartbeat.ts) + @ihui/types AgentSSEEvent 声明契约
 *        (packages/types/src/agent-runtime.ts, 兜底三元动态广播如
 *        subagent-dispatch-service.ts:1240 的 task_completed : task_failed)
 *      - apps/ai-service/app/routers/agents.py: /agents/tasks/stream 与
 *        /agents/execute/stream 的 SSE 生产者。注意 /api/agents/tasks/stream 经
 *        apps/web/next.config.ts:459 rewrite 直连 8803 (FastAPI), 不经 apps/api
 *        代理 —— 前端 self-heal / tool-approval 命名事件的真实生产者在本文件,
 *        故必须纳入扫描, 否则会把合法事件误判为「前端监听但后端不发」。
 *      - apps/ai-service/app/routers/agent_runtime.py: /agent-runtime/execute/stream
 *        命名事件 (经 apps/api/src/routes/agent-runtime.ts 透传给前端)
 *      - apps/ai-service/app/services/langgraph_service.py: execute/stream 事件
 *        payload type (经 agents.py _format_sse 序列化后到达前端)
 *      - apps/ai-service/app/routers/llm.py: AI 对话流 SSE 生产者(#25 纳入),
   *        事件以 dict "type" 字面量写出(chunk/reasoning/tool 系列/
   *        plan_updated/terminal 系列); anthropic wire 协议桩消息
   *        (type: message_start/content_block_delta 等)与工具 JSON Schema
   *        (type: function)经排除表剔除
 *      - packages/shared/src/sse/contract.ts 与 apps/ai-service/app/core/
 *        sse_contract.py 的 SSE_EVENTS(#25 契约单一事实源): 断言两端集合一致,
 *        且 llm.py 全部对话流事件 ⊆ 契约; TS 侧契约同时作为前端监听对账的
 *        「声明契约」兜底来源
 *   2. 扫描前端消费点:
 *      - apps/web/src 含 new EventSource 的文件: es.addEventListener('<名>')
 *        命名事件监听 + (data|evt).type === '<名>' 匿名 data 事件分支;
 *        t4(2026-09-19) 后 Agent 任务流消费点改用 AGENT_TASK_EVENTS.* 常量
 *        形态, 由 1j 提取的常量映射解析回事件名后并列对账
 *      - packages/api-client/src/endpoints/agent-runtime.ts: SSE 客户端库统一分发
 *        (dispatchSSEEvent / parseAgentRuntimeSSEBlock 的 case 分支)
 *   3. 对账规则:
 *      - 前端监听但后端无生产 → 报错阻断 (FRONTEND_LEGACY_EVENTS 中的历史遗留
 *        分支除外, 见常量注释)
 *      - 后端生产但前端完全无人消费 → 警告不阻断 (部分事件由 SSE 客户端库
 *        onEvent 兜底/onmessage 泛型统一分发, 见 WHITELIST 注释)
 *   4. 扫描器自失效防护: 任一扫描器产出清单为空或低于已知最小规模 → 报错退出,
 *      防止正则腐化后脚本空转变绿
 *
 * 已知不在静态扫描范围的动态事件 (设计如此):
 *   - agent_runtime.py:517 f"event: {name}" 容器运行流 (stdout/stderr/exit,
 *     消费方为 IDE 终端视图, 不属于 Agent 事件契约)
 *   - LLM provider 内部流 chunk/tool_call_delta 等 (不直达前端 SSE 契约)
 *   - anthropic-adapter.ts 注释中的示例 `event: type` (已通过剥注释防误报)
 *
 * 退出码:
 *   0 = Agent SSE 事件契约 parity 通过 (允许含白名单内警告)
 *   1 = 发现契约断裂 (前端监听无生产) 或扫描器失效, 阻断
 *
 * 集成: 根 package.json check:all 链尾追加; 亦可单独运行
 *   node scripts/check-agent-event-parity.mjs
 */

import { readdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catBatch, gitRaw } from './lib/face-reader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// R74 v3 tee: 同时把守门结果写到磁盘(sandbox 不返回 stdout 时也能 Read)
const RESULT_FILE = path.join(ROOT, '__gate_result.txt');
try { writeFileSync(RESULT_FILE, ''); } catch {} // 清空
function tee(line) {
  try { appendFileSync(RESULT_FILE, line.replace(/\x1b\[[0-9;]*m/g, '') + '\n'); } catch {}
}
const _origLog = console.log.bind(console);
const _origErr = console.error.bind(console);
console.log = (...args) => { _origLog(...args); tee(args.join(' ')); };
console.error = (...args) => { _origErr(...args); tee('[ERR] ' + args.join(' ')); };

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

const errors = [];
const warnings = [];
const passed = [];

// ============================================================================
// 白名单(SCRIPT 顶部常量, 按任务约定)
// ============================================================================

/**
 * 后端生产但前端无需逐名消费的已知合法事件(警告豁免)。
 * 每项必须写清理由; 新增白名单项须在 PR 描述中给出同等证据。
 */
const WHITELIST = []
// D44(2026-09-23 收口):原 10 条兜底事件已全部处置,白名单归零(长度只减不增,
// H15 要求 D44 收口时归零)。其中 task_progress / worker_status / dag_level_advanced /
// log 为死声明(无生产点),已从 packages/types AgentSSEEvent 与 dag_scheduler.AgentSSEEvent
// 回收(case b);status / memory_context / step_start / step_done / trace / trace_summary 为
// langgraph 引擎退役后的内部可观测信号,AgentPane onEvent 兜底静默忽略,显式声明不渲染上屏
// (case c,结论见 PROJECT_PLAN.md D44 处置行)。后续新增事件必须同时进 sse_contract.py 与
// contract.ts,并经对账强制,禁止再以白名单静默豁免。

/**
 * 前端存在监听/分支但后端已无对应 SSE 生产的**历史遗留分支**(阻断豁免)。
 * 2026-09-19:最后两条历史遗留分支已清理 —— use-agent-runtime onmessage 的
 * content 死分支与 api-client dispatchSSEEvent 的 permission_request 兼容
 * 分支均已删除,本数组清空;后续如再现前端孤儿监听,在此登记并写明理由。
 */
const FRONTEND_LEGACY_EVENTS = [];

const WHITELIST_SET = new Set(WHITELIST.map((w) => w.name));
const FRONTEND_LEGACY_SET = new Set(FRONTEND_LEGACY_EVENTS.map((w) => w.name));

// ============================================================================
// 扫描基础设施
// ============================================================================

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '__tests__', '.turbo', 'coverage']);
const isTestFile = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);

/** 递归收集指定扩展名文件(跳过构建产物/测试) */
function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), exts, out);
    } else if (
      exts.some((e) => entry.name.endsWith(e)) &&
      !isTestFile(entry.name)
    ) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

/** 剥 TS 注释(块注释置空白保换行 + 纯行注释行清空), 防注释示例误报 */
function stripTsComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => (l.trim().startsWith('//') ? '' : l))
    .join('\n');
}

/** 事件名 → 来源文件集合 */
const backendEvents = new Map();
const frontendEvents = new Map();

function addEvent(map, name, source) {
  if (!map.has(name)) map.set(name, new Set());
  map.get(name).add(source);
}

const forMatch = (map, re, text, source, group = 1) => {
  let count = 0;
  for (const m of text.matchAll(re)) {
    const name = m[group];
    if (name) {
      addEvent(map, name, source);
      count++;
    }
  }
  return count;
};

// ============================================================================
// [1/4] 后端 SSE 事件扫描
// ============================================================================

console.log(`\n${C.cyan}[1/4] 后端 Agent SSE 事件生产者扫描${C.reset}`);

const scanStats = {};

// —— 1a. TS 字面量命名事件(apps/api/src)——
// 形如 reply.raw.write(`event: error\ndata: ...`) —— 源码中 \n 是字面反斜杠+n
const TS_SSE_RE = /`event:\s*([A-Za-z][\w-]*)\\n/g;
{
  const files = walk(path.join(ROOT, 'apps/api/src'), ['.ts']);
  let hits = 0;
  for (const f of files) {
    const text = stripTsComments(readFileSync(f, 'utf-8'));
    hits += forMatch(backendEvents, TS_SSE_RE, text, rel(f));
  }
  scanStats.tsLiteral = hits;
}

// —— 1b. TS broadcastSSEEvent 广播 type(实时广播的事实事件)——
const TS_BROADCAST_RE = /broadcastSSEEvent\(\s*\{[\s\S]{0,300}?type:\s*'([a-z_]+)'/g;
{
  const files = walk(path.join(ROOT, 'apps/api/src'), ['.ts']);
  let hits = 0;
  for (const f of files) {
    const text = readFileSync(f, 'utf-8');
    hits += forMatch(backendEvents, TS_BROADCAST_RE, text, rel(f));
  }
  scanStats.tsBroadcast = hits;
}

// —— 1c. TS AgentSSEEvent 声明契约(packages/types, 兜底三元动态广播)——
const TS_CONTRACT_RE = /'([a-z_]+)'/g;
{
  const contractFile = path.join(ROOT, 'packages/types/src/agent-runtime.ts');
  const text = readFileSync(contractFile, 'utf-8');
  const start = text.indexOf('export interface AgentSSEEvent');
  if (start === -1) {
    errors.push('packages/types/src/agent-runtime.ts 未找到 AgentSSEEvent 声明(契约类型被移动/改名,请同步本守门)');
  } else {
    const end = text.indexOf('\n}', start);
    const body = end === -1 ? text.slice(start, start + 2500) : text.slice(start, end);
    let hits = 0;
    for (const m of body.matchAll(TS_CONTRACT_RE)) {
      addEvent(backendEvents, m[1], rel(contractFile) + ' (声明契约)');
      hits++;
    }
    scanStats.tsContract = hits;
  }
}

// —— 1d. Python hook 事件 → SSE 映射表(agent_events.py, /agents/tasks/stream 命名事件)——
// 映射表已迁移到 services/agent_events.py;值侧即 SSE event 名。
// 只扫描真实映射表,避免把路由器中的普通字典误识别为 SSE 事件。
const PY_MAPPING_RE = "(?:^|\\n)\\s*[A-Za-z_][\\w.]*\\s*:\\s*['\\\"]([a-z_.-]+)['\\\"]";
{
  const mappingFile = path.join(ROOT, 'apps/ai-service/app/services/agent_events.py');
  const agentsPy = path.join(ROOT, 'apps/ai-service/app/routers/agents.py');
  const text = readFileSync(mappingFile, 'utf-8');
  const start = text.indexOf('HOOK_EVENT_TO_SSE: dict');
  const end = text.indexOf('\n}', start);
  if (start === -1 || end === -1) {
    errors.push('apps/ai-service/app/services/agent_events.py 未找到 HOOK_EVENT_TO_SSE 映射表(SSE 命名映射被移动/改名,请同步本守门)');
    scanStats.pyMapping = 0;
  } else {
    const body = text.slice(start, end);
    scanStats.pyMapping = forMatch(
      backendEvents,
      new RegExp(PY_MAPPING_RE, 'gm'),
      body,
      rel(mappingFile),
    );
  }
  // 保留对旧兼容别名的存在性校验,防止迁移时破坏既有调用方。
  const agentsText = readFileSync(agentsPy, 'utf-8');
  if (!agentsText.includes('_map_hook_event_to_sse = map_hook_event_to_sse')) {
    warnings.push('apps/ai-service/app/routers/agents.py 未找到 _map_hook_event_to_sse 兼容别名');
  }
}

// —— 1e. Python 字面量 f-string 事件(agent_runtime.py execute/stream)——
const PY_FSTRING_RE = /f"event:\s*([a-z_-]+)\\n/g;
{
  const files = [
    'apps/ai-service/app/routers/agents.py',
    'apps/ai-service/app/routers/agent_runtime.py',
    'apps/ai-service/app/services/langgraph_service.py',
  ];
  let hits = 0;
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!existsSync(p)) continue;
    hits += forMatch(backendEvents, PY_FSTRING_RE, readFileSync(p, 'utf-8'), f);
  }
  scanStats.pyLiteral = hits;
}

// —— 1f. Python 事件 dict 字面量(经 _format_sse 序列化的 payload type)——
// 排除项均为该文件中**非 SSE** 的同名结构, 逐项注释防误报
const PY_EVENT_DICT_EXCLUDE = new Set([
  'object',      // agents.py 工具 JSON Schema: parameters={"type": "object"}
  'tool_error',  // agents.py GET /agents/{id}/errors REST 响应数组, 非 SSE
  'step_error',  // 同上(trace 降级 REST 响应)
]);
const PY_DICT_RE = /\{\s*"type":\s*"([a-z_-]+)"/g;
{
  const files = [
    'apps/ai-service/app/routers/agents.py',
    'apps/ai-service/app/services/langgraph_service.py',
  ];
  let hits = 0;
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf-8');
    for (const m of text.matchAll(PY_DICT_RE)) {
      const name = m[1];
      if (PY_EVENT_DICT_EXCLUDE.has(name)) continue;
      addEvent(backendEvents, name, f);
      hits++;
    }
  }
  scanStats.pyDict = hits;
}

// —— 1g. 共享 SSE 契约 TS 侧(#25 单一事实源)——
// 提取 contract.ts 的 SSE_EVENTS 事件名集合; 同时作为「声明契约」兜底来源
// 参与前端监听对账(与 1c AgentSSEEvent 声明契约同语义)
const TS_SHARED_CONTRACT_RE = /([A-Z][A-Z_0-9]+):\s*'([a-z_-]+)'/g;
const declaredSharedEvents = new Map(); // 事件名 → 声明来源(仅兜底, 不计入生产警告)
{
  const contractFile = path.join(ROOT, 'packages/shared/src/sse/contract.ts');
  if (!existsSync(contractFile)) {
    errors.push('packages/shared/src/sse/contract.ts 缺失: #25 SSE 契约单一事实源被移动/删除, 请同步本守门');
  } else {
    const text = readFileSync(contractFile, 'utf-8');
    const start = text.indexOf('export const SSE_EVENTS');
    if (start === -1) {
      errors.push('packages/shared/src/sse/contract.ts 未找到 export const SSE_EVENTS(契约被改名, 请同步本守门)');
    } else {
      const end = text.indexOf('} as const', start);
      const body = end === -1 ? text.slice(start, start + 3000) : text.slice(start, end);
      for (const m of body.matchAll(TS_SHARED_CONTRACT_RE)) {
        declaredSharedEvents.set(m[2], rel(contractFile) + ' (声明契约)');
      }
    }
  }
  scanStats.tsSharedContract = declaredSharedEvents.size;
}

// —— 1h. 共享 SSE 契约 Python 侧(#25 单一事实源)——
// V3 #48(2026-09-26)补注释剥离: 契约集合的注释里会出现带引号的字段名/事件名
// (terminal_delta 条目注释写着 {"type": SSE_START, "task_id", ...}), 不剥会把注释
// 里的词吸进集合造成假漂移 —— 与 check-tool-registry-integrity 的取材铁律同型。
function stripPyLineComments(src) {
  const out = [];
  for (const line of src.split('\n')) {
    let buf = '';
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quote) {
        if (ch === '\\') {
          buf += ch + (line[i + 1] ?? '');
          i++;
          continue;
        }
        if (ch === quote) quote = null;
        buf += ch;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        buf += ch;
        continue;
      }
      if (ch === '#') break;
      buf += ch;
    }
    out.push(buf);
  }
  return out.join('\n');
}
const PY_SHARED_CONTRACT_RE = /"([a-z_-]+)"/g;
const pySharedContract = new Set();
{
  const contractFile = path.join(ROOT, 'apps/ai-service/app/core/sse_contract.py');
  if (!existsSync(contractFile)) {
    errors.push('apps/ai-service/app/core/sse_contract.py 缺失: #25 SSE 契约单一事实源被移动/删除, 请同步本守门');
  } else {
    const text = stripPyLineComments(readFileSync(contractFile, 'utf-8'));
    // 兼容 typing.FrozenSet[str] 与内置 frozenset[str] 两种注解写法(2026-09-19 同步)
    const contractHead = text.match(/SSE_EVENTS:\s*(?:FrozenSet|frozenset)\[str\]\s*=\s*frozenset\(/);
    const start = contractHead === null ? -1 : contractHead.index;
    if (start === -1) {
      errors.push('apps/ai-service/app/core/sse_contract.py 未找到 SSE_EVENTS frozenset(契约被改名, 请同步本守门)');
    } else {
      // 不能用 indexOf(')'):frozenset 内部的**注释**里出现半角括号就会把 body 截断,
      // 导致尾部事件名被静默漏读 → 契约漂移检不出(假绿)。改为切到"独占一行的 )"。
      const closeLine = /\n\s*\)/.exec(text.slice(start));
      const end = closeLine === null ? -1 : start + closeLine.index;
      const body = end === -1 ? text.slice(start, start + 4000) : text.slice(start, end);
      for (const m of body.matchAll(PY_SHARED_CONTRACT_RE)) pySharedContract.add(m[1]);
    }
  }
  scanStats.pySharedContract = pySharedContract.size;
}

// —— 1i. llm.py 对话流事件 dict(#25: 对话流生产者纳入全事件对账)——
// 排除项: anthropic wire 协议适配器桩消息与工具 JSON Schema 的 "type" 字段(非 SSE 契约事件)
const LLM_EVENT_DICT_EXCLUDE = new Set([
  'function',             // 工具 JSON Schema: parameters={"type": "function"}
  'message_start',        // anthropic wire 桩(协议适配器调试端点)
  'message',
  'content_block_start',
  'text',
  'content_block_delta',
  'text_delta',
  'content_block_stop',
  'message_delta',
  'message_stop',
  'api_error',            // wire 桩 error 内嵌 error.type
  'service_unavailable',
  'invalid_request',
]);
const llmDialogEvents = new Set();
{
  const llmPy = path.join(ROOT, 'apps/ai-service/app/routers/llm.py');
  if (!existsSync(llmPy)) {
    errors.push('apps/ai-service/app/routers/llm.py 不存在: 对话流生产者被移动/删除, 请同步本守门');
  } else {
    const text = readFileSync(llmPy, 'utf-8');
    for (const m of text.matchAll(PY_DICT_RE)) {
      const name = m[1];
      if (LLM_EVENT_DICT_EXCLUDE.has(name)) continue;
      llmDialogEvents.add(name);
      addEvent(backendEvents, name, rel(llmPy));
    }
  }
  scanStats.llmDialog = llmDialogEvents.size;
}

// —— 1j. Agent 任务流单源常量(agent-events.ts, t4 收敛单一事实源)——
// 提取 AGENT_TASK_EVENTS 常量名→wire 事件值映射, 供 2a 常量形态监听解析回
// 事件名; 值集合同时参与对账 0c(单源声明值 ⊆ 后端生产面)。
const TS_AGENT_EVENTS_RE = /([A-Z][A-Z_0-9]+):\s*'([a-z_-]+)'/g;
const agentTaskEventConstants = new Map(); // 常量名 → wire 事件值
const agentTaskEventValues = new Set();    // wire 事件值集合(对账 0c 用)
{
  const srcFile = path.join(ROOT, 'packages/shared/src/sse/agent-events.ts');
  if (!existsSync(srcFile)) {
    errors.push('packages/shared/src/sse/agent-events.ts 缺失: t4 Agent 任务流单源被移动/删除, 请同步本守门');
  } else {
    const text = readFileSync(srcFile, 'utf-8');
    const start = text.indexOf('export const AGENT_TASK_EVENTS');
    if (start === -1) {
      errors.push('packages/shared/src/sse/agent-events.ts 未找到 export const AGENT_TASK_EVENTS(单源被改名, 请同步本守门)');
    } else {
      const end = text.indexOf('} as const', start);
      const body = end === -1 ? text.slice(start, start + 3000) : text.slice(start, end);
      for (const m of body.matchAll(TS_AGENT_EVENTS_RE)) {
        agentTaskEventConstants.set(m[1], m[2]);
        agentTaskEventValues.add(m[2]);
      }
    }
  }
  scanStats.agentEventConstants = agentTaskEventConstants.size;
}

// —— 1k. 共享 SSE 兼容面契约(V3 #48): Anthropic Messages API 兼容端点事件 ——
// 单列不入对话流 SSE_EVENTS(llm.py Anthropic 兼容端点产出, 非对话流 UI 事件);
// 双端一致由对账 0b-2 看护。
const tsCompatEvents = new Set();
{
  const contractFile = path.join(ROOT, 'packages/shared/src/sse/contract.ts');
  if (existsSync(contractFile)) {
    const text = readFileSync(contractFile, 'utf-8');
    const start = text.indexOf('export const SSE_COMPAT_EVENTS');
    if (start === -1) {
      errors.push('packages/shared/src/sse/contract.ts 未找到 export const SSE_COMPAT_EVENTS(V3 #48 兼容面契约被移动/删除, 请同步本守门)');
    } else {
      const end = text.indexOf('} as const', start);
      const body = end === -1 ? text.slice(start, start + 2000) : text.slice(start, end);
      for (const m of body.matchAll(TS_SHARED_CONTRACT_RE)) tsCompatEvents.add(m[2]);
    }
  }
  scanStats.tsCompatContract = tsCompatEvents.size;
}

// —— 1l. PY 兼容面契约 + agent_events.py 常量值域(V3 #48)——
// agent 侧事件 wire 名集中在 agent_events.py 的 SSE_* 常量;dict 形态生产点
// ({"type": SSE_XXX})引用常量, 字符串扫描天然漏网 —— 对账常量事实源即可全覆盖。
const pyCompatEvents = new Set();
const pyAgentEventConstants = new Map(); // SSE_XXX(去前缀) → wire 事件值
{
  const contractFile = path.join(ROOT, 'apps/ai-service/app/core/sse_contract.py');
  if (existsSync(contractFile)) {
    const text = stripPyLineComments(readFileSync(contractFile, 'utf-8'));
    const head = text.match(/SSE_COMPAT_EVENTS:\s*(?:FrozenSet|frozenset)\[str\]\s*=\s*frozenset\(/);
    if (!head) {
      errors.push('apps/ai-service/app/core/sse_contract.py 未找到 SSE_COMPAT_EVENTS frozenset(V3 #48 兼容面契约被移动/删除, 请同步本守门)');
    } else {
      const start = head.index;
      const closeLine = /\n\s*\)/.exec(text.slice(start));
      const end = closeLine === null ? -1 : start + closeLine.index;
      const body = end === -1 ? text.slice(start, start + 2000) : text.slice(start, end);
      for (const m of body.matchAll(PY_SHARED_CONTRACT_RE)) pyCompatEvents.add(m[1]);
    }
  }
  const evFile = path.join(ROOT, 'apps/ai-service/app/services/agent_events.py');
  if (existsSync(evFile)) {
    const evText = readFileSync(evFile, 'utf-8');
    for (const m of evText.matchAll(/^SSE_([A-Z_0-9]+)\s*=\s*"([a-z_-]+)"/gm)) {
      pyAgentEventConstants.set(m[1], m[2]);
    }
  } else {
    errors.push('apps/ai-service/app/services/agent_events.py 缺失: agent 侧事件常量事实源被移动/删除');
  }
  scanStats.pyCompatContract = pyCompatEvents.size;
  scanStats.pyAgentEventConstants = pyAgentEventConstants.size;
}

console.log(
  `  TS 字面量命名事件命中 ${scanStats.tsLiteral} 处, broadcastSSEEvent 广播 ${scanStats.tsBroadcast} 处, AgentSSEEvent 契约声明 ${scanStats.tsContract ?? 0} 个`,
);
console.log(
  `  PY hook→SSE 映射 ${scanStats.pyMapping} 条, f-string 事件 ${scanStats.pyLiteral} 处, 事件 dict 字面量 ${scanStats.pyDict} 处`,
);
console.log(
  `  共享契约(#25): TS 侧 ${scanStats.tsSharedContract ?? 0} 个 / PY 侧 ${scanStats.pySharedContract ?? 0} 个, llm.py 对话流事件 ${scanStats.llmDialog ?? 0} 个`,
);
console.log(
  `  Agent 任务流单源(t4): AGENT_TASK_EVENTS 常量 ${scanStats.agentEventConstants ?? 0} 个`,
);

// ============================================================================
// [2/4] 前端消费点扫描
// ============================================================================

console.log(`\n${C.cyan}[2/4] 前端 SSE 事件消费点扫描${C.reset}`);

const feStats = {};

// —— 2a. apps/web EventSource 文件: 命名监听 + 匿名 data 事件分支 ——
// t4(2026-09-19): Agent 任务流消费点改用 AGENT_TASK_EVENTS.* 常量形态, 增加
// ES_NAMED_CONST_RE / ES_UNNAMED_CONST_RE 两种常量形态匹配, 命中后经 1j 的
// agentTaskEventConstants 映射解析回 wire 事件名, 与字符串形态并列对账
const ES_NAMED_RE = /([A-Za-z_$][\w$]*)\.addEventListener\(\s*'([a-z][\w-]*)'/g;
const ES_NAMED_CONST_RE = /([A-Za-z_$][\w$]*)\.addEventListener\(\s*AGENT_TASK_EVENTS\.([A-Z][A-Z_0-9]*)/g;
const ES_UNNAMED_RE = /\b(data|evt|parsed|event)\.type\s*={2,3}\s*'([a-z_-]+)'/g;
const ES_UNNAMED_CONST_RE = /\b(data|evt|parsed|event)\.type\s*={2,3}\s*AGENT_TASK_EVENTS\.([A-Z][A-Z_0-9]*)/g;
{
  const files = walk(path.join(ROOT, 'apps/web/src'), ['.ts', '.tsx']).filter((f) =>
    readFileSync(f, 'utf-8').includes('new EventSource'),
  );
  feStats.eventSourceFiles = files.length;
  let namedHits = 0;
  let namedConstHits = 0;
  let unnamedHits = 0;
  let unnamedConstHits = 0;
  for (const f of files) {
    const text = readFileSync(f, 'utf-8');
    for (const m of text.matchAll(ES_NAMED_RE)) {
      const receiver = m[1];
      const name = m[2];
      // 排除 window/document 等非 EventSource 接收者(仅收 es 变量形态)
      if (receiver === 'window' || receiver === 'document') continue;
      addEvent(frontendEvents, name, `${rel(f)} (addEventListener)`);
      namedHits++;
    }
    for (const m of text.matchAll(ES_NAMED_CONST_RE)) {
      const receiver = m[1];
      if (receiver === 'window' || receiver === 'document') continue;
      const name = agentTaskEventConstants.get(m[2]);
      if (!name) {
        errors.push(`${rel(f)} 引用 AGENT_TASK_EVENTS.${m[2]} 但单源(agent-events.ts)未定义该常量 — 常量拼写漂移或单源缺失`);
        continue;
      }
      addEvent(frontendEvents, name, `${rel(f)} (addEventListener 常量)`);
      namedConstHits++;
    }
    for (const m of text.matchAll(ES_UNNAMED_RE)) {
      addEvent(frontendEvents, m[2], `${rel(f)} (onmessage type 分支)`);
      unnamedHits++;
    }
    for (const m of text.matchAll(ES_UNNAMED_CONST_RE)) {
      const name = agentTaskEventConstants.get(m[2]);
      if (!name) {
        errors.push(`${rel(f)} 引用 AGENT_TASK_EVENTS.${m[2]} 但单源(agent-events.ts)未定义该常量 — 常量拼写漂移或单源缺失`);
        continue;
      }
      addEvent(frontendEvents, name, `${rel(f)} (onmessage type 常量分支)`);
      unnamedConstHits++;
    }
  }
  feStats.namedListeners = namedHits + namedConstHits;
  feStats.unnamedBranches = unnamedHits + unnamedConstHits;
}

// —— 2b. api-client SSE 分发器(executeAgentStream / executeAgentRuntimeStream)——
const CLIENT_CASE_RE = /case\s*'([a-z_-]+)'\s*:/g;
{
  const clientFile = path.join(ROOT, 'packages/api-client/src/endpoints/agent-runtime.ts');
  const text = readFileSync(clientFile, 'utf-8');
  let hits = 0;
  for (const m of text.matchAll(CLIENT_CASE_RE)) {
    addEvent(frontendEvents, m[1], `${rel(clientFile)} (SSE 客户端库 case 分发)`);
    hits++;
  }
  feStats.apiClientCases = hits;
}

console.log(
  `  EventSource 文件 ${feStats.eventSourceFiles} 个: 命名监听 ${feStats.namedListeners} 处, onmessage type 分支 ${feStats.unnamedBranches} 处`,
);
console.log(`  api-client SSE 分发器 case 分支 ${feStats.apiClientCases} 处`);

// —— 2c. 端能力对账(D139,2026-09-28 立):六端消费面 + 档案表放行 ——
// 口径三条,先说清楚再判:
//   ① 取材面 = HEAD(face-reader 的 catBatch),不是磁盘 —— 共享工作树常年滞后,按磁盘判
//      会让同一份代码在"恒红/假绿"之间跳(守门 118 全仓记过的那一型);
//   ② 消费判定 = "提及口径":注释剥除后的源码字符串里出现该事件名。它**宽于**真监听 ——
//      所以本维第一轮只点名(warning),不判红;收口成硬判据前须逐端核成"监听口径"。
//      宁可宽着点名,也不能把"提及"当"没做"——那会把六端一整片打成假缺口。
//   ③ 已声明未做 ≠ 失败:档案表(config/agent-event-end-capability.json)声明过的帧报名放行,
//      没写档案的端**零豁免**逐条点名 —— 留空档案等于默认放行,那正是本维要防的静默。
const END_CAPABILITY_DIRS = {
  'apps/miniapp-taro/src': '小程序',
  'apps/mobile-rn/src': 'App(RN)',
  'packages/app/src': '共享屏层',
  'apps/extension': '浏览器扩展',
  'apps/desktop': '桌面端',
  'apps/cli/src': 'CLI',
};
const PROFILE_PATH = 'config/agent-event-end-capability.json';
// 字段级台账(b76-05 票1):豁免键 → 理由;与端能力档案同一目录的既有台账文件
const FIELD_COVERAGE_PATH = 'scripts/data/sse-dispatch-coverage.json';

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function scanEndConsumption() {
  // backendEvents 是 Map(名→出处),取键集;错拿整个 entry 展开会让交替正则里混进 "[object Object]"
  const nameAlt = [...backendEvents.keys()].sort().map(escapeRe).join('|');
  const mentionRe = new RegExp(`["'\`](${nameAlt})["'\`]`, 'g');
  const out = new Map();
  for (const [dir, label] of Object.entries(END_CAPABILITY_DIRS)) {
    let files = [];
    try {
      files = gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', dir], ROOT)
        .split('\n').map((s) => s.trim()).filter((f) => f && /\.(ts|tsx|js|jsx|mjs)$/.test(f));
    } catch (e) {
      out.set(dir, { label, files: 0, consumed: new Set(), error: String(e?.message ?? e).split('\n')[0] });
      continue;
    }
    const consumed = new Set();
    try {
      const revs = files.map((f) => `HEAD:${f}`);
      const texts = catBatch(ROOT, revs, { maxBuffer: 512e6 });
      for (const t of texts.values()) {
        const s = stripTsComments(t);
        for (const m of s.matchAll(mentionRe)) consumed.add(m[1]);
      }
    } catch (e) {
      out.set(dir, { label, files: files.length, consumed: new Set(), error: String(e?.message ?? e).split('\n')[0] });
      continue;
    }
    out.set(dir, { label, files: files.length, consumed });
  }
  return out;
}

function loadEndProfile() {
  try {
    const t = catBatch(ROOT, [`HEAD:${PROFILE_PATH}`]).get(`HEAD:${PROFILE_PATH}`);
    if (typeof t !== 'string') return null;
    return JSON.parse(t);
  } catch {
    return null;
  }
}

const SELF_TEST = process.argv.includes('--self-test');
const TODAY = new Date().toISOString().slice(0, 10);
console.log(`\n${C.cyan}端能力对账(D139 六端;HEAD 面;提及口径=剥注释后字符串中出现)${C.reset}`);
const endConsumption = scanEndConsumption();
const endProfile = loadEndProfile();
if (!endProfile) {
  errors.push(
    `端能力档案表 ${PROFILE_PATH} 在 HEAD 面取不到或解析失败 —— 取不到必须显式红,` +
      `不得静默当"无档案"放行(表在 config/ 下,登记不等于生效的反面是丢了也不许装看不见)`,
  );
}
let endGapTotal = 0;
for (const [dir, info] of endConsumption) {
  const declared = endProfile?.profiles?.find((p) => p.app === dir || dir.startsWith(p.app + '/')) ?? null;
  if (declared) {
    if (!declared.reason || !declared.until) errors.push(`档案 ${dir} 缺 reason/until —— 半个声明比没有更危险`);
    if (typeof declared.until === 'string' && declared.until < TODAY)
      warnings.push(`档案 ${dir} 已过期(${declared.until})—— 到期要续或删,不得静默续命`);
    for (const n of declared.events ?? []) {
      if (!backendEvents.has(n)) errors.push(`档案 ${dir} 声明了契约不存在的事件 "${n}" —— 台账腐烂`);
    }
  }
  const gaps = [];
  let declaredSkip = 0;
  for (const n of backendEvents.keys()) {
    if (info.consumed.has(n)) continue;
    if (declared?.events?.includes(n)) declaredSkip += 1;
    else gaps.push(n);
  }
  endGapTotal += gaps.length;
  const tag = declared ? `档案声明未做 ${declaredSkip}` : '无档案 ⇒ 零豁免';
  console.log(
    `  ${info.error ? '❓' : '·'} ${dir}(${info.label}): 文件 ${info.files}, 提及 ${info.consumed.size}/${backendEvents.size}, ${tag}, 点名未做 ${gaps.length}` +
      (gaps.length ? ` — ${gaps.slice(0, 8).join(', ')}${gaps.length > 8 ? ' …' : ''}` : ''),
  );
  if (info.error) warnings.push(`端 ${dir} 取材失败:${info.error}(未判定,不是通过)`);
}
console.log(
  `  六端点名合计 ${endGapTotal} 处 —— 本轮按已批口径只点名不判红(第一轮存量),` +
    `收口成硬判据须逐端把"提及"核成"监听"并按该文件 HEAD 自身存量走棘轮`,
);
feStats.endGapTotal = endGapTotal;

if (SELF_TEST) {
  const st = [];
  const totalConsumed = [...endConsumption.values()].reduce((a, v) => a + v.consumed.size, 0);
  const mini = endConsumption.get('apps/miniapp-taro/src');
  st.push([
    'ST1 六端 HEAD 清单非空且判据真吃得到信号(阳性对照,防正则空转)',
    [...endConsumption.values()].every((v) => v.files > 0) && totalConsumed >= 5 && (mini?.consumed.size ?? 0) >= 3,
    `文件数 ${[...endConsumption.values()].map((v) => v.files).join('/')}, 提及合计 ${totalConsumed}, 小程序 ${mini?.consumed.size ?? '?'}`,
  ]);
  st.push([
    'ST2 档案表可解析、事件名全在契约上、reason/until 齐备未过期',
    !!endProfile &&
      Array.isArray(endProfile.profiles) &&
      endProfile.profiles.every(
        (p) => p.reason && typeof p.until === 'string' && p.until >= TODAY && (p.events ?? []).every((n) => backendEvents.has(n)),
      ),
    endProfile ? `条目 ${endProfile.profiles?.length ?? 0}` : '解析失败',
  ]);
  const ownSrc = readFileSync(new URL(import.meta.url), 'utf8');
  st.push([
    'ST3 形状锁:端目录表与 catBatch 取材面都在源码里(被退回只扫 web 必红)',
    Object.keys(END_CAPABILITY_DIRS).every((d) => ownSrc.includes(d)) && ownSrc.includes('catBatch(') && ownSrc.includes(PROFILE_PATH),
    '退回只扫 web 时本条红 —— 这是 T1 镜像测试的牙',
  ]);
  // 字段段自检(b76-05 票1):变异自证 —— 判据有牙才配叫门。
  try {
    const fr = extractFrontendReadKeys();
    const bw = extractBackendWriteKeys();
    const planRead = fr.get('plan-step');
    const planWrite = bw.get('plan-step');
    st.push([
      'ST4 字段抽键器两侧都吃到信号(plan-step 生产侧与解析面键集非空)',
      !!planRead && planRead.size >= 4 && !!planWrite && planWrite.size >= 1,
      `生产侧 ${planWrite?.size ?? 0} 键 / 解析面 ${planRead?.size ?? 0} 键`,
    ]);
    if (planRead && planWrite) {
      // 变异自证(照 D159 推广票的口径):给生产点加一个新键而不改解析面 ⇒ 必红。
      const mutatedWrite = new Map(planWrite);
      mutatedWrite.set('brand_new_field', 'mutation: ST5 synthetic key');
      const mutatedCmp = compareFieldSets(mutatedWrite, planRead, {});
      st.push([
        'ST5 字段闸变异自证:生产点加新键而解析面不读 ⇒ 必点名缺口(防恒绿)',
        mutatedCmp.gaps.includes('brand_new_field'),
        `缺口 ${JSON.stringify(mutatedCmp.gaps)}`,
      ]);
    }
    const fb = loadFieldBaseline();
    st.push([
      'ST6 字段级台账可解析(fieldBaseline 为对象,取不到不得记绿)',
      fb !== null,
      fb === null ? '解析失败' : 'ok',
    ]);
    st.push([
      'ST7 字段段形状锁:取材面(sse-dispatch-coverage/client.ts 投影/api 广播)都在源码里',
      ownSrc.includes(FIELD_COVERAGE_PATH) && ownSrc.includes('projectToolApprovalEnvFacts(p)') && ownSrc.includes('broadcastSSEEvent'),
      '退回只比事件名集合时本条红',
    ]);
  } catch (e) {
    st.push(['ST4-7 字段段自检异常', false, String(e?.message ?? e).split('\n')[0]]);
  }
  for (const [name, ok, got] of st) console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ' —— 实得: ' + got}`);
  const bad = st.filter((x) => !x[1]).length;
  console.log(`# 自检 ${st.length - bad}/${st.length} 通过`);
  process.exit(bad ? 1 : 0);
}


// ============================================================================
// [3/4] 扫描器自失效防护(防空转变绿)
// ============================================================================

console.log(`\n${C.cyan}[3/4] 扫描器自失效防护${C.reset}`);

const SANITY_MIN = [
  { key: 'tsLiteral', min: 1, label: 'TS 字面量命名事件(agent-runtime.ts 至少写出 event: error)' },
  { key: 'tsBroadcast', min: 3, label: 'TS broadcastSSEEvent 广播(看板/锁/任务至少 3 处)' },
  { key: 'tsContract', min: 6, label: 'AgentSSEEvent 契约声明(当前 6 个 type;D44 回收 task_progress/worker_status/dag_level_advanced/log 死声明)' },
  { key: 'pyMapping', min: 5, label: 'PY hook→SSE 映射表(当前 7 条)' },
  { key: 'pyDict', min: 3, label: 'PY 事件 dict 字面量(start/done/error)' },
  { key: 'tsSharedContract', min: 19, label: '共享 SSE 契约 TS 侧事件数(#25, V3 #48 后 25 个)' },
  { key: 'pySharedContract', min: 19, label: '共享 SSE 契约 PY 侧事件数(#25, V3 #48 后 25 个)' },
  { key: 'tsCompatContract', min: 6, label: '兼容面契约 TS 侧(V3 #48 SSE_COMPAT_EVENTS, 6 个)' },
  { key: 'pyCompatContract', min: 6, label: '兼容面契约 PY 侧(V3 #48 SSE_COMPAT_EVENTS, 6 个)' },
  { key: 'pyAgentEventConstants', min: 20, label: 'agent_events.py SSE_* 常量(V3 #48 值域对账)' },
  { key: 'llmDialog', min: 10, label: 'llm.py 对话流事件数(#25 纳入对账, 当前 15 个)' },
  { key: 'agentEventConstants', min: 14, label: 'Agent 任务流单源常量(t4 agent-events.ts, 当前 15 个)' },
  { key: 'eventSourceFiles', min: 2, label: '前端 EventSource 文件(use-agent-runtime/useAgentSSE/tool-approval-dialog)' },
  { key: 'namedListeners', min: 2, label: '前端命名监听(字符串 + AGENT_TASK_EVENTS 常量形态, self-heal/tool-approval)' },
  { key: 'apiClientCases', min: 8, label: 'api-client 分发 case 分支' },
];
for (const { key, min, label } of SANITY_MIN) {
  const actual = scanStats[key] ?? feStats[key] ?? 0;
  if (actual < min) {
    errors.push(`扫描器疑似失效: ${label} 仅命中 ${actual} 处(阈值 ${min})—— 正则/路径需随代码同步更新,禁止空转变绿`);
  } else {
    passed.push(`扫描器健康: ${label} (${actual} ≥ ${min})`);
  }
}
if (backendEvents.size === 0) errors.push('后端事件清单为空: 扫描逻辑失效');
if (frontendEvents.size === 0) errors.push('前端消费点清单为空: 扫描逻辑失效');

if (errors.length === 0) {
  console.log(`  ${C.green}✓ 全部扫描器命中规模正常, 未空转${C.reset}`);
} else {
  for (const e of errors) console.log(`  ${C.red}✗${C.reset} ${e}`);
}

// ============================================================================
// [4/4] 契约 parity 对账
// ============================================================================

console.log(`\n${C.cyan}[4/4] Agent SSE 事件契约 parity 对账${C.reset}`);

console.log(`\n${C.cyan}后端事件生产清单 (${backendEvents.size} 个事件名):${C.reset}`);
for (const [name, sources] of [...backendEvents.entries()].sort()) {
  console.log(`  ${C.dim}event:${C.reset} ${name} ${C.dim}← ${[...sources].join(', ')}${C.reset}`);
}

console.log(`\n${C.cyan}前端消费点清单 (${frontendEvents.size} 个事件名):${C.reset}`);
for (const [name, points] of [...frontendEvents.entries()].sort()) {
  console.log(`  ${C.dim}listen:${C.reset} ${name} ${C.dim}← ${[...points].join(', ')}${C.reset}`);
}

// —— 对账 0: #25 契约单一事实源 —— 两端 SSE_EVENTS 集合一致(阻断)——
console.log(`\n${C.cyan}对账: 共享 SSE 契约两端集合一致(#25 单一事实源)${C.reset}`);
if (declaredSharedEvents.size > 0 && pySharedContract.size > 0) {
  const tsOnly = [...declaredSharedEvents.keys()].filter((n) => !pySharedContract.has(n));
  const pyOnly = [...pySharedContract].filter((n) => !declaredSharedEvents.has(n));
  if (tsOnly.length === 0 && pyOnly.length === 0) {
    console.log(`  ${C.green}✓ TS(${declaredSharedEvents.size}) 与 PY(${pySharedContract.size}) 事件集合完全一致${C.reset}`);
  } else {
    for (const n of tsOnly) {
      errors.push(`契约漂移: 事件 "${n}" 仅存在于 TS 侧契约(packages/shared/src/sse/contract.ts), Python 侧(sse_contract.py)缺失`);
      console.log(`  ${C.red}✗ ${n}: 仅 TS 侧契约有${C.reset}`);
    }
    for (const n of pyOnly) {
      errors.push(`契约漂移: 事件 "${n}" 仅存在于 Python 侧契约(apps/ai-service/app/core/sse_contract.py), TS 侧缺失`);
      console.log(`  ${C.red}✗ ${n}: 仅 PY 侧契约有${C.reset}`);
    }
  }
} else {
  errors.push('共享契约集合为空: contract.ts / sse_contract.py 事件名提取失败, 扫描器需同步');
}

// —— 对账 0b: #25 全事件强制 —— llm.py 对话流生产事件 ⊆ 共享契约(阻断)——
console.log(`\n${C.cyan}对账: llm.py 对话流事件 ⊆ 共享契约(#25 全事件强制)${C.reset}`);
const llmOffContract = [...llmDialogEvents].filter((n) => !declaredSharedEvents.has(n));
if (llmDialogEvents.size === 0) {
  console.log(`  ${C.red}✗ llm.py 对话流事件提取为空, 扫描器失效${C.reset}`);
  errors.push('llm.py 对话流事件提取为空(阈值防护见 [3/4]), 扫描器需同步');
} else if (llmOffContract.length === 0) {
  console.log(`  ${C.green}✓ 全部 ${llmDialogEvents.size} 个对话流事件均在契约内${C.reset}`);
} else {
  for (const n of llmOffContract) {
    errors.push(
      `契约漂移: llm.py 生产 SSE 事件 "${n}" 不在共享契约(SSE_EVENTS)中 — ` +
        `请在 contract.ts + sse_contract.py 补入定义, 或确认非 SSE 契约事件后加入 LLM_EVENT_DICT_EXCLUDE(注释理由)`,
    );
    console.log(`  ${C.red}✗ ${n}: 对话流生产但契约未登记${C.reset}`);
  }
}

// —— 对账 0b-2: V3 #48 兼容面契约 —— SSE_COMPAT_EVENTS 两端一致(阻断)——
console.log(`\n${C.cyan}对账: Anthropic 兼容面契约两端一致(V3 #48 单列)${C.reset}`);
if (tsCompatEvents.size > 0 && pyCompatEvents.size > 0) {
  const tsOnly = [...tsCompatEvents].filter((n) => !pyCompatEvents.has(n));
  const pyOnly = [...pyCompatEvents].filter((n) => !tsCompatEvents.has(n));
  if (tsOnly.length === 0 && pyOnly.length === 0) {
    console.log(`  ${C.green}✓ 兼容面 TS(${tsCompatEvents.size}) 与 PY(${pyCompatEvents.size}) 集合一致${C.reset}`);
  } else {
    for (const n of tsOnly) {
      errors.push(`兼容面契约漂移: 事件 "${n}" 仅存在于 TS 侧 SSE_COMPAT_EVENTS, PY 侧缺失`);
      console.log(`  ${C.red}✗ ${n}: 仅 TS 兼容面有${C.reset}`);
    }
    for (const n of pyOnly) {
      errors.push(`兼容面契约漂移: 事件 "${n}" 仅存在于 PY 侧 SSE_COMPAT_EVENTS, TS 侧缺失`);
      console.log(`  ${C.red}✗ ${n}: 仅 PY 兼容面有${C.reset}`);
    }
  }
} else {
  errors.push('兼容面契约集合为空: SSE_COMPAT_EVENTS 提取失败, 扫描器需同步');
}

// —— 对账 0b-3: V3 #48 agent_events.py 常量值域 ⊆ 契约 ∪ 兼容面(阻断)——
console.log(`\n${C.cyan}对账: agent_events.py SSE_* 常量 ⊆ 契约(V3 #48)${C.reset}`);
{
  const known = new Set([...declaredSharedEvents.keys(), ...tsCompatEvents]);
  // SSE_MESSAGE 是缺省兜底别名(agents.py:959 事件无 type 时取它), 非显式事件名
  const PY_CONSTANT_EXEMPT = new Set(['MESSAGE']);
  let bad = 0;
  for (const [constName, wire] of pyAgentEventConstants) {
    if (PY_CONSTANT_EXEMPT.has(constName)) continue;
    if (!known.has(wire)) {
      bad++;
      errors.push(
        `契约漂移: agent_events.py SSE_${constName} = "${wire}" 不在 SSE_EVENTS ∪ SSE_COMPAT_EVENTS — 补契约或登记豁免(注释理由)`,
      );
      console.log(`  ${C.red}✗ SSE_${constName} = "${wire}": 常量在契约外${C.reset}`);
    }
  }
  if (bad === 0) {
    console.log(
      `  ${C.green}✓ ${pyAgentEventConstants.size} 个常量全部落在契约内(豁免别名 ${PY_CONSTANT_EXEMPT.size} 个)${C.reset}`,
    );
  }
}

// —— 对账 0c: t4 单源声明 —— AGENT_TASK_EVENTS 值集合 ⊆ 后端生产面(阻断)——
// 防止前端单源与 Python 侧 agent_events.py HOOK_EVENT_TO_SSE 映射漂移
// (注意 HOOK_ERROR: SSE_ERROR 为常量引用形态, 不进 1d 扫描, 'error' 依赖
// agent-runtime.ts / llm.py 等其他生产段兜底)
console.log(`\n${C.cyan}对账: Agent 任务流单源值 ⊆ 后端生产面(t4 收敛)${C.reset}`);
if (agentTaskEventValues.size === 0) {
  console.log(`  ${C.red}✗ AGENT_TASK_EVENTS 常量提取为空, 扫描器失效${C.reset}`);
  errors.push('AGENT_TASK_EVENTS 常量提取为空(阈值防护见 [3/4]), 扫描器需同步');
} else {
  const orphanConstants = [...agentTaskEventValues].filter((n) => !backendEvents.has(n));
  if (orphanConstants.length === 0) {
    console.log(`  ${C.green}✓ 全部 ${agentTaskEventValues.size} 个单源事件名均有后端生产点${C.reset}`);
  } else {
    for (const n of orphanConstants) {
      errors.push(
        `契约漂移: AGENT_TASK_EVENTS 声明事件 "${n}" 后端无任何生产点 — ` +
          `单源(agent-events.ts)与 agent_events.py HOOK_EVENT_TO_SSE 映射漂移, 请同步两端`,
      );
      console.log(`  ${C.red}✗ ${n}: 单源声明但后端无生产${C.reset}`);
    }
  }
}

// —— 对账 1: 前端监听但后端不发 → 阻断(白名单外; 共享契约声明兜底)——
const frontendOnly = [...frontendEvents.keys()].filter(
  (n) => !backendEvents.has(n) && !declaredSharedEvents.has(n),
);
const blocked = frontendOnly.filter((n) => !FRONTEND_LEGACY_SET.has(n));
const legacyHit = frontendOnly.filter((n) => FRONTEND_LEGACY_SET.has(n));

console.log(`\n${C.cyan}对账: 前端监听但后端无生产${C.reset}`);
if (frontendOnly.length === 0) {
  console.log(`  ${C.green}✓ 无${C.reset}`);
} else {
  for (const n of blocked) {
    errors.push(
      `契约断裂: 前端监听 SSE 事件 "${n}" 但后端(apps/api + ai-service SSE 生产者)无任何生产点 — ` +
        `若为后端新增/改名事件请补齐生产, 若为前端残留监听请清理或加入 FRONTEND_LEGACY_EVENTS(需注释理由)`,
    );
    console.log(`  ${C.red}✗ ${n}: 前端监听但后端不发${C.reset}`);
  }
  for (const n of legacyHit) {
    const entry = FRONTEND_LEGACY_EVENTS.find((w) => w.name === n);
    warnings.push(`历史遗留分支(已豁免): "${n}" — ${entry?.reason ?? ''}`);
    console.log(`  ${C.yellow}⚠ ${n}: 历史遗留分支已豁免${C.reset}`);
  }
}

// —— 对账 2: 后端发但前端完全无人监听 → 警告不阻断(白名单外)——
// 共享契约(#25)声明的事件豁免: 对话流事件由 chat 客户端 fetch reader 统一
// 分发(非逐名 EventSource 监听, 不在本扫描范围), 契约本身即其声明生产面
const backendOnly = [...backendEvents.keys()].filter(
  (n) => !frontendEvents.has(n) && !declaredSharedEvents.has(n),
);
const unwarned = backendOnly.filter((n) => !WHITELIST_SET.has(n));
const whitelistedHit = backendOnly.filter((n) => WHITELIST_SET.has(n));

console.log(`\n${C.cyan}对账: 后端生产但前端无逐名消费${C.reset}`);
if (backendOnly.length === 0) {
  console.log(`  ${C.green}✓ 无${C.reset}`);
} else {
  for (const n of whitelistedHit) {
    const entry = WHITELIST.find((w) => w.name === n);
    console.log(`  ${C.dim}○ ${n}: 白名单豁免 — ${entry?.reason ?? ''}${C.reset}`);
  }
  for (const n of unwarned) {
    warnings.push(
      `后端生产 SSE 事件 "${n}" 但前端(apps/web + api-client)无人逐名消费 ` +
        `— 若经 onEvent 兜底/onmessage 泛型统一分发请加入 WHITELIST(注释理由), 否则属真实漏消费, 交业务侧接线`,
    );
    console.log(`  ${C.yellow}⚠ ${n}: 后端发但前端无逐名消费(不阻断)${C.reset}`);
  }
}

// —— 对账 3: 白名单/遗留表自洁(条目已不再命中任何一侧 → 提示清理, 不阻断)——
for (const w of WHITELIST) {
  if (!backendEvents.has(w.name)) {
    warnings.push(`WHITELIST 条目 "${w.name}" 已无后端生产点, 条目过期请移除`);
  }
}
for (const w of FRONTEND_LEGACY_EVENTS) {
  if (!frontendEvents.has(w.name)) {
    warnings.push(`FRONTEND_LEGACY_EVENTS 条目 "${w.name}" 已无前端监听点(分支已被清理), 条目过期请移除`);
  }
}

// ============================================================================
// [5/5] 字段级 parity(b76-05 票1,2026-09-30 立):后端写、前端不读 = 静默吞字段
// ============================================================================
//
// 名称面(对账 0~3)只保证"事件名两端都在";本段把判据下钻到 **payload 字段级**:
//   生产点写出的键集合 ⊆ 解析面(agent-events.ts parse*Event 实际读取的 wire 键)
// 否则后端新增/已写的字段会被前端静默吞掉 —— 与"流断了"在消费端同形,而
// typecheck/lint/其余守门全都不响(本仓最高频失效形态)。
//
// 取材面(全部现读,不写死键清单 —— 写死必与代码脱节):
//   生产侧 = apps/ai-service/app/core/sse_contract.py 的 SSE_EVENT_CONTRACTS 声明
//            + apps/ai-service/app/routers/agents.py 直接写出点 {"type": SSE_X, ...}
//            + apps/ai-service/app/core/stream_events.py(票面点名;纯函数切片,命中预期低)
//            + apps/api/src/services/*.ts 的 broadcastSSEEvent({...}) 字面量
//   解析侧 = packages/shared/src/sse/agent-events.ts 各 parseXxxEvent 函数体的
//            p.*/data.* 读取点;tool-approval 并入 client.ts projectToolApprovalEnvFacts
//            的读取点(D159:那份判据只有一份,两条通道都调它)。
//
// 判定口径:
//   生产点键 − 解析面键 − fieldBaseline 台账 ⇒ **错误阻断**(并列名到键)。
//   解析面读而生产侧未声明 ⇒ 警告(前端容忍缺席是合法姿态,但声明缺失要点名)。
//   只有单侧有键集 ⇒ 未判定警告(取不到必须显式说,不得记绿)。
//   台账 = scripts/data/sse-dispatch-coverage.json 的 fieldBaseline(豁免键 → 理由)。

/** 解析侧:agent-events.ts 各 parse*Event 函数体实际读取的 wire 键集合。 */
function extractFrontendReadKeys() {
  const out = new Map(); // wire 事件名 → Set(wire 键)
  const srcFile = path.join(ROOT, 'packages/shared/src/sse/agent-events.ts');
  if (!existsSync(srcFile)) return out;
  const src = readFileSync(srcFile, 'utf-8');
  // 常量键(SCREAMING_SNAKE)→ 解析函数名段(PlanStep):parseXxxEvent 与常量一一对应
  const parseSegment = (constKey) =>
    constKey.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join('');
  for (const [constKey, wire] of agentTaskEventConstants) {
    const seg = parseSegment(constKey);
    const start = src.indexOf(`export function parse${seg}Event(`);
    if (start === -1) continue;
    const next = src.indexOf('\nexport ', start + 1);
    const body = next === -1 ? src.slice(start) : src.slice(start, next);
    const keys = new Set();
    for (const m of body.matchAll(/\bp\?\.([a-z_][a-z_0-9]*)/g)) keys.add(m[1]);
    for (const m of body.matchAll(/\bp\.([a-z_][a-z_0-9]*)/g)) keys.add(m[1]);
    // b76-05 票1 重构后的读取形态:路由闸(gate.data.X)取的是字段表里的 wire 键
    for (const m of body.matchAll(/\bgate\.data\.([a-z_][a-z_0-9]*)/g)) keys.add(m[1]);
    for (const m of body.matchAll(/\bdata\??\.(type|session_id|payload)\b/g)) keys.add(m[1]);
    // D159:tool-approval 的三个环境事实键经 projectToolApprovalEnvFacts(p) 读取,
    // 判据只有 client.ts 那一份 —— 键集从那边的函数体现读并入,不在这里重列。
    if (body.includes('projectToolApprovalEnvFacts(p)')) {
      const clientSrc = readFileSync(path.join(ROOT, 'packages/api-client/src/client.ts'), 'utf-8');
      const pjStart = clientSrc.indexOf('export function projectToolApprovalEnvFacts');
      if (pjStart !== -1) {
        const pjEnd = clientSrc.indexOf('\nfunction ', pjStart);
        const pjBody = pjEnd === -1 ? clientSrc.slice(pjStart) : clientSrc.slice(pjStart, pjEnd);
        for (const m of pjBody.matchAll(/\bjson\??\.([a-z_][a-z_0-9]*)/g)) keys.add(m[1]);
      }
    }
    out.set(wire, keys);
  }
  return out;
}

/** 生产侧扫描(供合并版与两端口径版共用):port='ai'(ai-service 三源) | 'api'(services 广播)。 */
function scanBackendWriteKeys(record) {
  // (a) sse_contract.py SSE_EVENT_CONTRACTS 的 payload_fields 声明(剥注释防吸附)
  {
    const f = path.join(ROOT, 'apps/ai-service/app/core/sse_contract.py');
    if (existsSync(f)) {
      const text = stripPyLineComments(readFileSync(f, 'utf-8'));
      for (const m of text.matchAll(/SSEEventContract\(\s*"([a-z_-]+)"\s*,\s*\(([^)]*)\)/gs)) {
        for (const km of m[2].matchAll(/"([a-z_A-Za-z0-9]+)"/g)) {
          record('ai', m[1], km[1], `${rel(f)} (SSE_EVENT_CONTRACTS 声明)`);
        }
      }
    }
  }
  // (b) agents.py 直接写出点 {"type": SSE_XXX, key: ...}(常量值经 1l 的映射解析)
  {
    const f = path.join(ROOT, 'apps/ai-service/app/routers/agents.py');
    if (existsSync(f)) {
      const text = readFileSync(f, 'utf-8');
      for (const m of text.matchAll(/\{\s*"type":\s*(SSE_[A-Z_0-9]+)\s*,\s*([^{}]*)\}/g)) {
        const wire = pyAgentEventConstants.get(m[1].slice(4));
        if (!wire) continue;
        for (const km of m[2].matchAll(/(?:^|[,{]\s*)([a-z_][a-z_0-9]*)\s*:/g)) {
          if (km[1] === 'type') continue;
          record('ai', wire, km[1], `${rel(f)} (直接写出点)`);
        }
      }
    }
  }
  // (c) stream_events.py(票面点名的生产者源码;纯函数切片,若未来产出 SSE 载荷键即被登记)
  {
    const f = path.join(ROOT, 'apps/ai-service/app/core/stream_events.py');
    if (existsSync(f)) {
      const text = readFileSync(f, 'utf-8');
      for (const m of text.matchAll(/\{\s*"type":\s*(SSE_[A-Z_0-9]+)\s*,\s*([^{}]*)\}/g)) {
        const wire = pyAgentEventConstants.get(m[1].slice(4));
        if (!wire) continue;
        for (const km of m[2].matchAll(/(?:^|[,{]\s*)([a-z_][a-z_0-9]*)\s*:/g)) {
          if (km[1] === 'type') continue;
          record('ai', wire, km[1], `${rel(f)} (直接写出点)`);
        }
      }
    }
  }
  // (d) apps/api/src/services/*.ts 的 broadcastSSEEvent({...}) 字面量(顶层键)
  {
    const dir = path.join(ROOT, 'apps/api/src/services');
    for (const f of walk(dir, ['.ts'])) {
      const text = stripTsComments(readFileSync(f, 'utf-8'));
      const re = /broadcastSSEEvent\(\s*\{/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        let depth = 1;
        let i = re.lastIndex;
        while (i < text.length && depth > 0) {
          const ch = text[i];
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
          i++;
        }
        const body = text.slice(re.lastIndex, i - 1);
        const tm = body.match(/\btype:\s*'([a-z_-]+)'/);
        if (!tm) continue;
        // 摘掉嵌套 {}/[]/() 后再认顶层键,防嵌套字面量的键被误并入
        const flat = body.replace(/\{[^{}]*\}/g, ' ').replace(/\[[^[\]]*\]/g, ' ').replace(/\([^()]*\)/g, ' ');
        for (const km of flat.matchAll(/(?:^|[,{(\s])([a-zA-Z_][\w]*)\s*:/g)) {
          if (km[1] === 'type') continue;
          record('api', tm[1], km[1], `${rel(f)} (broadcastSSEEvent)`);
        }
      }
    }
  }
}

function addToWriteMap(out, ev, key, source) {
  if (!out.has(ev)) out.set(ev, new Map());
  if (!out.get(ev).has(key)) out.get(ev).set(key, source);
}

/** 生产侧:各 SSE 写出点按事件名归并的键集合(键 → 来源)。 */
function extractBackendWriteKeys() {
  const out = new Map(); // wire 事件名 → Map(键 → 来源)
  scanBackendWriteKeys((_, ev, key, source) => addToWriteMap(out, ev, key, source));
  return out;
}

/** 生产侧两端口径:ai-service 三源 与 apps/api services 广播各自归并。 */
function extractBackendWriteKeysByPort() {
  const ai = new Map();
  const api = new Map();
  scanBackendWriteKeys((port, ev, key, source) => addToWriteMap(port === 'ai' ? ai : api, ev, key, source));
  return { ai, api };
}

/** 字段级豁免台账(fieldBaseline):事件 → 键 → 理由。 */
function loadFieldBaseline() {
  try {
    const t = readFileSync(path.join(ROOT, FIELD_COVERAGE_PATH), 'utf-8');
    const parsed = JSON.parse(t);
    return parsed.fieldBaseline && typeof parsed.fieldBaseline === 'object' ? parsed.fieldBaseline : {};
  } catch {
    return null;
  }
}

/** 纯比较器(self-test 变异臂复用):gaps=后端写前端不读;extras=解析面读未声明。 */
function compareFieldSets(writeKeys, readSet, baseline) {
  const base = baseline ?? {};
  const gaps = [...writeKeys.keys()].filter((k) => !readSet.has(k) && !(base[k] ?? base[String(k)]));
  const extras = [...readSet].filter((k) => !writeKeys.has(k));
  return { gaps, extras };
}

console.log(`\n${C.cyan}对账: 字段级 parity(后端写、前端不读 = 静默吞字段)${C.reset}`);
const fieldBaseline = loadFieldBaseline();
if (!fieldBaseline) {
  errors.push(
    `字段级台账 ${FIELD_COVERAGE_PATH} 解析失败或 fieldBaseline 缺失 —— 台账取不到必须显式红,` +
      `不得静默当"无豁免"放行`,
  );
}
const frontendReadKeys = extractFrontendReadKeys();
const backendWriteKeys = extractBackendWriteKeys();
let comparableEvents = 0;
let fieldFactTotal = 0;
let fieldGapTotal = 0;
{
  const allEvents = [...new Set([...backendWriteKeys.keys(), ...frontendReadKeys.keys()])].sort();
  for (const ev of allEvents) {
    const write = backendWriteKeys.get(ev);
    const read = frontendReadKeys.get(ev);
    if (!read) {
      warnings.push(`字段面: 事件 "${ev}" 生产侧声明了键集但解析面(agent-events.ts/client.ts)无读取点 — 未判定,不是通过`);
      continue;
    }
    if (!write) {
      warnings.push(`字段面: 事件 "${ev}" 解析面有读取点但生产侧无键集声明(hook 透传帧声明缺失)— 未判定,不是通过`);
      continue;
    }
    comparableEvents++;
    fieldFactTotal += write.size;
    const { gaps, extras } = compareFieldSets(write, read, fieldBaseline);
    const baseCount = Object.keys(fieldBaseline?.[ev] ?? {}).length;
    console.log(
      `  ${gaps.length === 0 ? C.green + '✓' + C.reset : C.red + '✗' + C.reset} ${ev}: 生产侧键 ${write.size} ⊆ 解析面键 ${read.size}` +
        (baseCount ? `(台账豁免 ${baseCount})` : '') +
        (gaps.length ? ` — 缺口: ${gaps.join(', ')}` : '') +
        (extras.length ? ` | 解析面多读: ${extras.join(', ')}(警告不阻断)` : ''),
    );
    for (const k of gaps) {
      fieldGapTotal++;
      errors.push(
        `字段面断裂: 事件 "${ev}" 生产点写出键 "${k}"(${write.get(k)})但前端解析面不读 — ` +
          `补解析面读取或在 ${FIELD_COVERAGE_PATH} 的 fieldBaseline 登记理由`,
      );
    }
    for (const k of extras) {
      warnings.push(`字段面对账: 事件 "${ev}" 解析面读 "${k}" 但生产侧声明未列(透传键或声明缺失,不阻断)`);
    }
  }
  console.log(`  可比事件 ${comparableEvents},生产侧键事实 ${fieldFactTotal},缺口合计 ${fieldGapTotal}`);
}
if (frontendReadKeys.size < 9) {
  errors.push(`字段抽键器疑似失效: agent-events.ts 解析函数只识别 ${frontendReadKeys.size}/9 个事件`);
}
if (backendWriteKeys.size < 5) {
  errors.push(`字段抽键器疑似失效: 生产侧键集只覆盖 ${backendWriteKeys.size} 个事件(sse_contract.py / agents.py / services 抽取需同步)`);
}
if (comparableEvents === 0 || fieldFactTotal < 10) {
  errors.push('字段抽键器没抽到: 生产↔解析可比事件为 0 或键事实 <10,属门失效');
}
// 两端口径(③):同名事件被 ai-service 与 apps/api 两端都写出时,键集必须一致 ——
// 协议层外部契约变更必须两端同判,不接受只看某一端渲染。
{
  const { ai, api } = extractBackendWriteKeysByPort();
  let portPairs = 0;
  for (const ev of [...new Set([...ai.keys(), ...api.keys()])].sort()) {
    const aiKeys = ai.get(ev);
    const apiKeys = api.get(ev);
    if (!aiKeys || !apiKeys) continue;
    portPairs++;
    const onlyAi = [...aiKeys.keys()].filter((k) => !apiKeys.has(k));
    const onlyApi = [...apiKeys.keys()].filter((k) => !aiKeys.has(k));
    if (onlyAi.length === 0 && onlyApi.length === 0) {
      console.log(`  ${C.green}✓${C.reset} 两端口径 ${ev}: 两端键集一致(${aiKeys.size} 键)`);
    } else {
      console.log(
        `  ${C.red}✗${C.reset} 两端口径 ${ev}: 仅 ai-service 有 ${onlyAi.join(', ') || '(无)'} | 仅 apps/api 有 ${onlyApi.join(', ') || '(无)'}`,
      );
      errors.push(
        `字段面两端口径断裂: 事件 "${ev}" 在 ai-service 与 apps/api 两端写出的键集不一致 ` +
          `(仅 ai-service: [${onlyAi.join(', ')}];仅 apps/api: [${onlyApi.join(', ')}]) — 两端同批改齐`,
      );
    }
  }
  if (portPairs === 0) {
    console.log('  两端口径: 当前两端无同名写出事件,两端同判未激活 — 未判定,不是通过');
    warnings.push('字段面两端口径:当前无同名事件被两端同时写出,③两端同判未激活 — 未判定,不是通过');
  } else {
    console.log(`  两端口径: 同名事件两端都写出的可比对 ${portPairs} 个`);
  }
}

// ============================================================================
// 汇总
// ============================================================================

console.log(`\n${'='.repeat(60)}`);
console.log(`${C.cyan}Agent SSE 事件契约 parity 守门汇总${C.reset}`);
console.log(`${'='.repeat(60)}`);
console.log(`后端事件名: ${backendEvents.size} | 前端消费事件名: ${frontendEvents.size}`);
console.log(`${C.green}通过检查: ${passed.length}${C.reset}`);
console.log(`${C.yellow}警告(不阻断): ${warnings.length}${C.reset}`);
console.log(`${C.red}错误(阻断): ${errors.length}${C.reset}`);

if (warnings.length > 0) {
  console.log(`\n${C.yellow}警告明细(不阻断):${C.reset}`);
  for (const w of warnings) console.log(`  - ${w}`);
}

if (errors.length > 0) {
  console.log(`\n${C.red}阻断 commit:${C.reset}`);
  for (const e of errors) console.log(`  - ${e}`);
  console.log(`\n修复路径: 补齐后端生产/前端消费, 或经代码评审后在脚本顶部 WHITELIST / FRONTEND_LEGACY_EVENTS 登记理由`);
  process.exit(1);
}

console.log(`\n${C.green}✅ Agent SSE 事件契约 parity 守门通过${C.reset}`);
process.exit(0);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
