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
 *   2. 扫描前端消费点:
 *      - apps/web/src 含 new EventSource 的文件: es.addEventListener('<名>')
 *        命名事件监听 + (data|evt).type === '<名>' 匿名 data 事件分支
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
const WHITELIST = [
  // —— 看板 AgentSSEEvent 流(/agents/kanban/tasks/stream, 匿名 data 事件)——
  // 消费模式: useAgentSSE.onmessage 泛型 JSON 解析 → setLastEvent 统一分发 +
  // 高优 6 type 显式分支(invalidateQueries), 其余 type 天然无逐名分支。
  { name: 'task_progress', reason: '看板进度事件,useAgentSSE.onmessage 泛型接收(setLastEvent)统一分发,无需逐名分支' },
  { name: 'worker_status', reason: 'worker 状态事件,useAgentSSE.onmessage 泛型接收,当前无逐名消费需求' },
  { name: 'dag_level_advanced', reason: 'DAG 层级推进事件,AgentSSEEvent 契约声明+预留,前端经 onmessage 泛型透传' },
  { name: 'log', reason: '日志型事件,经 onmessage 泛型透传/日志视图消费,无需逐名监听' },
  // —— /agents/execute/stream(langgraph_service + hook 映射)——
  // 消费模式: packages/api-client executeAgentStream 的 dispatchSSEEvent
  // onEvent 兜底统一分发(default 分支注释明确列出这些 type),
  // 属任务约定的「SSE 客户端库统一分发」合法场景。
  { name: 'start', reason: 'execute/stream 起始事件(resume_from 重连锚点),api-client onEvent 兜底统一分发' },
  { name: 'status', reason: 'langgraph 状态流转事件,api-client onEvent 兜底统一分发' },
  { name: 'thinking', reason: 'langgraph 思考提示事件,api-client onEvent 兜底统一分发' },
  { name: 'memory_context', reason: 'langgraph 记忆上下文事件,api-client onEvent 兜底统一分发' },
  { name: 'step_start', reason: 'langgraph 步骤开始事件,api-client onEvent 兜底统一分发' },
  { name: 'step_done', reason: 'langgraph 步骤完成事件,api-client onEvent 兜底统一分发' },
  { name: 'trace', reason: 'langgraph 执行轨迹事件,api-client onEvent 兜底统一分发' },
  { name: 'trace_summary', reason: 'langgraph 轨迹汇总事件,api-client onEvent 兜底统一分发' },
];

/**
 * 前端存在监听/分支但后端已无对应 SSE 生产的**历史遗留分支**(阻断豁免)。
 * 这些不是误报, 是真实的历史契约残迹 —— 是否清理或恢复后端生产由业务侧
 * (主会话)决策, 守门只负责让它显式可见、防止无意识扩张。
 */
const FRONTEND_LEGACY_EVENTS = [
  {
    name: 'content',
    reason: 'use-agent-runtime.ts onmessage 的历史契约分支:现 /agents/tasks/stream 仅发命名事件(agents.py 全部带 event: 字段,匿名分支运行时不可达);是否清理分支或补发 content 事件由业务侧决策',
  },
  {
    name: 'permission_request',
    reason: 'api-client dispatchSSEEvent 兼容分支:现行审批契约为 hook tool.approval → SSE tool-approval,后端已无 permission_request 命名事件生产,保留分支仅为旧调用方兼容',
  },
];

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

// —— 1d. Python hook 事件 → SSE 映射表(agents.py, /agents/tasks/stream 命名事件)——
// _map_hook_event_to_sse 的**值侧**即 SSE event: 名(订阅的 7 个 hook 事件全部命中映射)
const PY_MAPPING_RE = /"[a-z_.]+":\s*"([a-z_.-]+)"/g;
{
  const agentsPy = path.join(ROOT, 'apps/ai-service/app/routers/agents.py');
  const text = readFileSync(agentsPy, 'utf-8');
  const start = text.indexOf('def _map_hook_event_to_sse');
  if (start === -1) {
    errors.push('apps/ai-service/app/routers/agents.py 未找到 _map_hook_event_to_sse(SSE 命名映射被移动/改名,请同步本守门)');
    scanStats.pyMapping = 0;
  } else {
    const end = text.indexOf('\ndef ', start);
    const body = end === -1 ? text.slice(start, start + 2000) : text.slice(start, end);
    scanStats.pyMapping = forMatch(backendEvents, PY_MAPPING_RE, body, rel(agentsPy));
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

console.log(
  `  TS 字面量命名事件命中 ${scanStats.tsLiteral} 处, broadcastSSEEvent 广播 ${scanStats.tsBroadcast} 处, AgentSSEEvent 契约声明 ${scanStats.tsContract ?? 0} 个`,
);
console.log(
  `  PY hook→SSE 映射 ${scanStats.pyMapping} 条, f-string 事件 ${scanStats.pyLiteral} 处, 事件 dict 字面量 ${scanStats.pyDict} 处`,
);

// ============================================================================
// [2/4] 前端消费点扫描
// ============================================================================

console.log(`\n${C.cyan}[2/4] 前端 SSE 事件消费点扫描${C.reset}`);

const feStats = {};

// —— 2a. apps/web EventSource 文件: 命名监听 + 匿名 data 事件分支 ——
const ES_NAMED_RE = /([A-Za-z_$][\w$]*)\.addEventListener\(\s*'([a-z][\w-]*)'/g;
const ES_UNNAMED_RE = /\b(data|evt|parsed|event)\.type\s*={2,3}\s*'([a-z_-]+)'/g;
{
  const files = walk(path.join(ROOT, 'apps/web/src'), ['.ts', '.tsx']).filter((f) =>
    readFileSync(f, 'utf-8').includes('new EventSource'),
  );
  feStats.eventSourceFiles = files.length;
  let namedHits = 0;
  let unnamedHits = 0;
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
    for (const m of text.matchAll(ES_UNNAMED_RE)) {
      addEvent(frontendEvents, m[2], `${rel(f)} (onmessage type 分支)`);
      unnamedHits++;
    }
  }
  feStats.namedListeners = namedHits;
  feStats.unnamedBranches = unnamedHits;
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

// ============================================================================
// [3/4] 扫描器自失效防护(防空转变绿)
// ============================================================================

console.log(`\n${C.cyan}[3/4] 扫描器自失效防护${C.reset}`);

const SANITY_MIN = [
  { key: 'tsLiteral', min: 1, label: 'TS 字面量命名事件(agent-runtime.ts 至少写出 event: error)' },
  { key: 'tsBroadcast', min: 3, label: 'TS broadcastSSEEvent 广播(看板/锁/任务至少 3 处)' },
  { key: 'tsContract', min: 8, label: 'AgentSSEEvent 契约声明(当前 10 个 type)' },
  { key: 'pyMapping', min: 5, label: 'PY hook→SSE 映射表(当前 7 条)' },
  { key: 'pyDict', min: 3, label: 'PY 事件 dict 字面量(start/done/error)' },
  { key: 'eventSourceFiles', min: 2, label: '前端 EventSource 文件(use-agent-runtime/useAgentSSE/tool-approval-dialog)' },
  { key: 'namedListeners', min: 2, label: '前端命名监听(self-heal/tool-approval)' },
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

// —— 对账 1: 前端监听但后端不发 → 阻断(白名单外)——
const frontendOnly = [...frontendEvents.keys()].filter((n) => !backendEvents.has(n));
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
const backendOnly = [...backendEvents.keys()].filter((n) => !frontendEvents.has(n));
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
