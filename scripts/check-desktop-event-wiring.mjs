#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-desktop-event-wiring.mjs
 *
 * 守门脚本: 桌面端(Tauri)事件链路接线守门(2026-09-22 立)
 *
 * 立门动机(真实事故):
 *   用户反馈"桌面端托盘右键菜单的『切换主题』和『打开设置』点击后没任何反应"。
 *   根因是三层事件链的第 3 层断裂 ——
 *     Rust emit → use-desktop.ts 转 CustomEvent → ??? 无 addEventListener 消费方
 *   useDesktopEvents() 把 `desktop-tray-action` 的 5 个 action 转发成 CustomEvent,
 *   其中 new_chat / check_update / quit 三个有正式消费方,而 desktop-theme-toggle
 *   与 desktop-open-settings **全仓零监听** —— dispatch 成功但无副作用,
 *   用户侧表现为"完全没反应";Rust 侧 `let _ = window.emit(...)` 又吞掉了返回值,
 *   连日志都查不到,只能靠肉眼 diff 三层源码定位。
 *   同一模式的问题还有一处:系统级快捷键 Ctrl+Shift+S 派发的
 *   `desktop-quick-screenshot` 同样无任何消费方。
 *
 * 校验目标(三层闭环,任一断裂即阻断):
 *   [层 1] 生产端:apps/desktop/src-tauri/src/**\/*.rs 的 `.emit("事件名", payload)`
 *          payload 为字符串字面量时即 action(payload 为 () 表示无 action)。
 *   [层 2] 桥接端:apps/web/src/hooks/use-desktop.ts 的 `listen('事件名')` +
 *          块内 `case 'action':` + `new CustomEvent('自定义事件名')`。
 *          (责任文件唯一:use-desktop.ts)
 *   [层 3] 消费端:apps/web/src/**\/*.{ts,tsx} 的 `addEventListener('自定义事件名')`
 *          + 事件注册表常量块(如 SHORTCUT_ROUTES / MODE_SHORTCUT_EVENTS,
 *            这类表以 addEventListener(event, handler) 变量形态注册,
 *            静态字面量扫不到,必须显式纳入)。
 *
 * 对账规则:
 *   规则 A(阻断):Rust emit 的事件名必须在 use-desktop.ts 有对应 listen()
 *   规则 B(阻断):Rust emit 的 (事件名, action) 必须在桥接端对应块内有 case 分支
 *   规则 C(阻断):桥接端 dispatch 出的每个 CustomEvent 必须在层 3 有消费方
 *                (本次事故的核心规则:缺消费方 = 点击/快捷键"没反应")
 *   规则 D(阻断):扫描器自失效防护 —— 各层命中数低于阈值即报错,防正则腐化空转变绿
 *   规则 E(阻断,2026-09-25 立):桌面两条链的**语义分层** ——
 *     chain: continuous(实时链,Rust 事件总线,无 id 无队列)与
 *     chain: replayable(重放链,api `agent.action` + WS 投递,至少一次故必须按 id 幂等)。
 *     E1 实时链不得混入重放载体;E2 重放链不得摘掉幂等键;E3 两条链的链名标记必须在源码里。
 *     实测分层结论:两条链本就分属不同通道,故这里只钉"不得混用/不得摘标记",不改生产链路。
 *   规则 F(阻断,2026-09-25 立):Rust 主进程不得持有 task/session 业务状态 ——
 *     进程级状态声明里出现业务名词即红,零容忍不设清单豁免(清单会腐烂),
 *     唯一出口是行内 `rust-state-exempt: <原因>`;扫到 0 处声明先判"扫描器失效"。
 *
 * 退出码:
 *   0 = 三层接线闭环通过
 *   1 = 发现链路断裂或扫描器失效,阻断
 *
 * 用法:
 *   node scripts/check-desktop-event-wiring.mjs
 * 紧急跳过(需 PR 说明):
 *   HUSKY_SKIP_DESKTOP_EVENT_WIRING=1 git commit ...
 */

import { readdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// R74 v3 tee: 同时把守门结果写到磁盘(sandbox 不返回 stdout 时也能 Read)
const RESULT_FILE = path.join(ROOT, '__gate_result.txt')
try {
  writeFileSync(RESULT_FILE, '')
} catch {} // 清空
function tee(line) {
  try {
    appendFileSync(RESULT_FILE, line.replace(/\x1b\[[0-9;]*m/g, '') + '\n')
  } catch {}
}
const _origLog = console.log.bind(console)
const _origErr = console.error.bind(console)
console.log = (...args) => {
  _origLog(...args)
  tee(args.join(' '))
}
console.error = (...args) => {
  _origErr(...args)
  tee('[ERR] ' + args.join(' '))
}

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const errors = []
const passed = []
const warnings = []

/**
 * 规则 C 豁免:桥接端派发但**不要求**前端消费方的 CustomEvent(警告不阻断)。
 * 每项必须写清理由;新增条目须在 PR 描述给出同等证据(与 check-agent-event-parity.mjs
 * 的 WHITELIST 同治理标准)。
 */
const CONSUMER_WHITELIST = [
  {
    name: 'desktop-sso-success',
    reason:
      'SSO 登录闭环在 lib/sso-desktop-bridge.ts 内已自洽(exchange token → 写入 auth store),' +
      '本事件仅为可选的 UI 通知(如 toast),无监听不影响登录功能成立',
  },
  {
    name: 'desktop-before-close',
    reason:
      'Rust 侧 emit 本意是"关主窗口前让前端保存草稿",但 main 窗口 CloseRequested 实际是' +
      'hide 到托盘(webview 存活,React 状态不丢),真正退出走 tray.quit → desktop-quit-request' +
      '(已有 use-quit-update-guard 消费)。属设计意图已过时的通知事件,非功能断裂',
  },
  {
    name: 'desktop-updater-pending',
    reason:
      '更新倒计时启动时的可选广播;主消费方(UpdatePrompt)直接消费 useUpdater 的返回值而非监听本事件' +
      '(见 use-updater.ts startRestartCountdown 注释)。属冗余通知,删除不影响既有行为',
  },
]
const CONSUMER_WHITELIST_SET = new Set(CONSUMER_WHITELIST.map((w) => w.name))

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')

// ============================================================================
// 规则 E/F 的判据(纯函数)—— 两条链的语义分层 + Rust 进程的状态归属
//
// 为什么要在这里分命名(2026-09-25 立):本 gate 此前只核**实时链**的三层接线
// (Rust `.emit` → use-desktop.ts `listen` → 前端 `addEventListener`),而桌面端还有
// 第二条语义完全不同的链:api 的 `agent.action` 指令链 —— 它按 requestId 幂等去重,
// 断线重连后同一条指令可能再送达一次。前者是 **continuous**(掉线即丢,无 id 无队列),
// 后者是 **replayable**(至少一次,必须幂等)。两条链共用一个词"事件"却没有任何标记,
// 于是"改了 stream/snapshot/queue/重连"只需实时链绿就算验过 —— 本规则把这条空档钉住。
// 口径:**两条链本就分属不同通道**(Tauri 原生事件总线 vs WS + `_pending` 会合),
// 所以这里只补防回退断言,不改生产链路;但链名必须落进源码,否则下一个接手者仍会混用。
// ============================================================================

/** 链名的规范拼写(文档、注释、本判据一律用这两个词,不再写"实时事件/推送指令"等口径) */
const CHAIN_CONTINUOUS = 'continuous'
const CHAIN_REPLAYABLE = 'replayable'

/**
 * E1: 实时链必须保持"无 id、无队列"的本性。
 * 判据 = 桥接端文件(use-desktop.ts)里出现 requestId 形态的重放语义载体即红:
 * 一旦有人把去重/补发塞进这条链,它就悄悄变成了第二条 replayable 链,而它的投递面
 * (`webview.eval`/Tauri 事件总线)没有任何持久队列可为补发兜底 —— 那种"看起来更可靠"
 * 的实现恰恰是最危险的形态(失败不可见)。
 */
function findContinuousChainDrift(bridgeSource) {
  const hits = []
  const lines = bridgeSource.split('\n')
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    if (/\brequestId\b|processedIds|Set<string>\(\s*\)\s*;?\s*\/\/?\s*queue/i.test(line)) {
      hits.push(`L${i + 1}: ${trimmed.slice(0, 120)}`)
    }
  })
  return hits
}

/**
 * E2: 重放链必须保住幂等标记。
 * 判据 = 该端消费 `agent.action` 的文件里,既要有 requestId 去重集,也要真的查它。
 * 少任何一半即红:去掉重连后的重复指令会被执行两次(表单重复提交、剪贴板被覆写),
 * 而症状只在断网/重连时出现,日常测试完全看不到。
 */
function findReplayableIdempotencyLoss(source, label) {
  const problems = []
  if (!/requestId/.test(source)) problems.push(`${label}: 全文无 requestId —— 幂等键被摘走`)
  if (!/processedIds\s*\.\s*has\s*\(/.test(source))
    problems.push(`${label}: 无 processedIds.has(...) 查重 —— 重连后同一条令会执行两次`)
  return problems
}

/** E3: 链名必须在源码里可 grep 到(命名是制度件,只写在文档里等于没命名)。 */
function findChainNameMarker(source, chainName, label) {
  const re = new RegExp(`chain:\\s*${chainName}\\b`)
  return re.test(source) ? [] : [`${label}: 缺少 \`chain: ${chainName}\` 标记`]
}

/**
 * F: Rust 主进程不得持有 task/session 业务状态(2026-09-25 立)。
 * 判据 = 进程级状态声明(static / static mut,含 LazyLock/OnceLock/Mutex 形态)的标识符或类型里
 * 出现业务状态名词即红,**零容忍、不设清单豁免** —— 豁免清单会腐烂(本仓对 RN_ONLY_BRAND_KEYS 已记过一次),
 * 而界面 chrome 状态(窗口几何、托盘节流)天然不含这些名词,不需要清单也能过。
 * 真要保留一个带业务名词的常量,唯一出口是行内 `rust-state-exempt: <原因>`(须带原因)。
 * 立据:桌面是薄壳,业务状态的唯一所有者是 web 前端 + 服务端;Rust 一旦存下 task/session,
 * 更新/重启即丢,且两条链谁是真相源再也问不出来 —— 正是本规则要防的形态。
 */
const RUST_BUSINESS_STATE_NOUNS =
  /\b(task|session|conversation|chat|message|turn|prompt|thread|goal|agent|todos?)\b/i
/** 标识符按 `_` 切成词元再比名词 —— `\bsession\b` 匹配不到 `SESSION_QUEUE`(下划线是词字符)。 */
const BUSINESS_NOUN_TOKENS = ['task', 'session', 'conversation', 'chat', 'message', 'turn', 'prompt', 'thread', 'goal', 'agent', 'todo', 'todos']

function rustStateNounHit(name, typeText) {
  const tokens = name
    .split(/[_\s]+/)
    .map((t) => t.toLowerCase())
    .filter(Boolean)
  const inName = BUSINESS_NOUN_TOKENS.find((noun) => tokens.includes(noun))
  if (inName) return inName
  const m = RUST_BUSINESS_STATE_NOUNS.exec(typeText)
  return m ? m[1] : null
}

function findRustStateViolations(source, file) {
  const violations = []
  const lines = source.split('\n')
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//')) return
    const decl = /^(?:pub\s+)?static(?:\s+mut)?\s+([A-Z_][A-Z0-9_]*)\s*:\s*(.+)$/.exec(trimmed)
    if (!decl) return
    const name = decl[1]
    const typeText = decl[2]
    if (/rust-state-exempt:/.test(line) || /rust-state-exempt:/.test(lines[i - 1] ?? '')) return
    const noun = rustStateNounHit(name, typeText)
    if (!noun) return
    violations.push(
      `${file}:${i + 1} Rust 进程级状态 \`${name}\`(${typeText.trim().slice(0, 60)})持有业务名词 ` +
        `"${noun}" —— task/session 业务状态的唯一所有者是 web 前端与服务端,Rust 主进程只承载窗口/托盘/IPC`,
    )
  })
  return violations
}

/** F 的自失效防护:Rust 里一个进程级状态都没扫到,先怀疑正则而不是相信世界干净。 */
function countRustStateDecls(source) {
  let n = 0
  for (const line of source.split('\n')) {
    if (/^\s*\/\//.test(line)) continue
    if (/^(?:pub\s+)?static(?:\s+mut)?\s+[A-Z_][A-Z0-9_]*\s*:/.test(line.trim())) n++
  }
  return n
}

// ---------------------------------------------------------------------------
// --self-test:用夹具证明 E/F 四条判据各自有牙(不是恰好绿)
// ---------------------------------------------------------------------------

function runSelfTest() {
  const cases = []
  const check = (label, got, expectEmpty) => {
    const bad = expectEmpty ? got.length !== 0 : got.length === 0
    cases.push(`${bad ? '✗' : '✓'} ${label}${got.length ? ' → ' + got.join(' | ').slice(0, 160) : ''}`)
    return !bad
  }
  let ok = true
  // E1 正/反
  ok =
    check(
      'E1 实时链出现 requestId 去重 ⇒ 判红',
      findContinuousChainDrift("const processedIds = new Set()\nif (req.requestId) processedIds.add(req.requestId)\n"),
      false,
    ) && ok
  ok =
    check(
      'E1 只 listen+dispatch 的实时链 ⇒ 放过',
      findContinuousChainDrift("const unlisten = await listen('desktop-tray-action', () => {})\n"),
      true,
    ) && ok
  // E2 正/反
  ok =
    check(
      'E2 幂等键被摘 ⇒ 判红',
      findReplayableIdempotencyLoss('void executeAction(req)\n', 'demo.ts'),
      false,
    ) && ok
  ok =
    check(
      'E2 保留 requestId + 查重 ⇒ 放过',
      findReplayableIdempotencyLoss(
        'if (processedIds.has(req.requestId)) return\nprocessedIds.add(req.requestId)\n',
        'demo.ts',
      ),
      true,
    ) && ok
  // E3 正/反
  ok =
    check(
      'E3 缺链名标记 ⇒ 判红',
      findChainNameMarker('export function useDesktopEvents() {}\n', CHAIN_CONTINUOUS, 'demo.ts'),
      false,
    ) && ok
  ok =
    check(
      'E3 有链名标记 ⇒ 放过',
      findChainNameMarker('// chain: continuous —— 实时链\n', CHAIN_CONTINUOUS, 'demo.ts'),
      true,
    ) && ok
  // F 正/反
  ok =
    check(
      'F Rust 持有 session 业务状态 ⇒ 判红',
      findRustStateViolations('static SESSION_QUEUE: LazyLock<Mutex<Vec<String>>> = x();\n', 'a.rs'),
      false,
    ) && ok
  ok =
    check(
      'F 注释里的同类标识符 ⇒ 不判(判据只看声明行)',
      findRustStateViolations('// static SESSION_QUEUE: 只是说明文字\n', 'a.rs'),
      true,
    ) && ok
  ok =
    check(
      'F 界面 chrome 状态(不含业务名词)⇒ 放过',
      findRustStateViolations(
        'static WINDOW_STATE_LAST_SAVE: LazyLock<Mutex<HashMap<String, Instant>>> = x();\n',
        'a.rs',
      ),
      true,
    ) && ok
  ok =
    check(
      'F 行内豁免带理由 ⇒ 放过(豁免面只能逐条点名,不能成清单)',
      findRustStateViolations(
        '// rust-state-exempt: 仅缓存托盘提示文案,非业务状态\nstatic AGENT_TRAY_TIP: &str = "x";\n',
        'a.rs',
      ),
      true,
    ) && ok
  ok =
    check(
      'F 声明计数不空转(有状态时必 >0)',
      countRustStateDecls('static WINDOW_STATE_LAST_SAVE: LazyLock<Mutex<u8>> = x();\n') === 1
        ? []
        : ['计数失效'],
      true,
    ) && ok
  console.log(`--self-test 共 ${cases.length} 例:`)
  for (const line of cases) console.log('  ' + line)
  console.log(ok ? '✅ 全部通过' : '❌ 存在失效判据')
  process.exit(ok ? 0 : 1)
}

if (process.argv.includes('--self-test')) runSelfTest()

/** 递归收集指定扩展名文件(跳过构建产物/测试) */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  '__tests__',
  '.turbo',
  'coverage',
  'target',
  'vendor',
])
function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(path.join(dir, entry.name), exts, out)
    } else if (
      exts.some((e) => entry.name.endsWith(e)) &&
      !/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)
    ) {
      out.push(path.join(dir, entry.name))
    }
  }
  return out
}

// ============================================================================
// [1/3] 层 1: Rust 生产端扫描
// ============================================================================

console.log(`${C.cyan}[1/3] 层1: Rust 事件生产者扫描${C.reset}`)

// 两种 payload 形态分别捕获:
//   "action" → 具名 action;`()` → unit(纯通知,无 payload)
// 注意:`()` 必须整体匹配 —— 早期写成 `([^\n]*?)\)` 时被非贪婪吃掉左括号(payload 变 "("),
//       导致 unit 形态 emit 静默漏抓、自失效阈值误报。
const RUST_EMIT_RE =
  /\.emit(?:_to|_filter)?\((?:\s*[^,\n]*,\s*)?"([a-z][a-z0-9-]*)"\s*,\s*(?:"([a-z_]+)"|\(\))/g
const UNIT_PAYLOAD = '«unit»' // 无 payload 的 emit(())

/** 事件名 → Set<action>(无 payload 时记 UNIT_PAYLOAD) */
const rustEmits = new Map()
/** 事件名 → 来源文件集合 */
const rustSources = new Map()
let rustEmitHits = 0

for (const f of walk(path.join(ROOT, 'apps/desktop/src-tauri/src'), ['.rs'])) {
  const text = readFileSync(f, 'utf-8')
  for (const m of text.matchAll(RUST_EMIT_RE)) {
    const event = m[1]
    // 变量形态 payload(payload 非字符串字面量/unit)不在静态对账范围,正则本就不匹配
    const action = m[2] ?? UNIT_PAYLOAD
    if (!rustEmits.has(event)) {
      rustEmits.set(event, new Set())
      rustSources.set(event, new Set())
    }
    rustEmits.get(event).add(action)
    rustSources.get(event).add(rel(f))
    rustEmitHits++
  }
}

console.log(
  `  命中 emit ${rustEmitHits} 处, 覆盖 ${rustEmits.size} 个事件名 ← apps/desktop/src-tauri/src`,
)
for (const [event, actions] of [...rustEmits.entries()].sort()) {
  console.log(
    `  ${C.dim}emit:${C.reset} ${event} ${C.dim}[${[...actions].filter((a) => a !== UNIT_PAYLOAD).join(', ') || '(无 payload)'}] ← ${[...rustSources.get(event)].join(', ')}${C.reset}`,
  )
}

// ============================================================================
// [2/3] 层 2: 桥接端(use-desktop.ts)扫描
// ============================================================================

console.log(`\n${C.cyan}[2/3] 层2: 桥接端 use-desktop.ts 解析${C.reset}`)

const BRIDGE_FILE = path.join(ROOT, 'apps/web/src/hooks/use-desktop.ts')
if (!existsSync(BRIDGE_FILE)) {
  errors.push('apps/web/src/hooks/use-desktop.ts 不存在(桥接端被移动/改名,请同步本守门)')
}
const bridgeText = existsSync(BRIDGE_FILE) ? readFileSync(BRIDGE_FILE, 'utf-8') : ''

// listen('xxx') 出现位置 → 块 = [当前位置, 下一个 listen 或文件末]
const LISTEN_RE = /listen(?:<[^>]*>)?\(\s*'([a-z][a-z0-9-]*)'/g
const listenPositions = [...bridgeText.matchAll(LISTEN_RE)].map((m) => ({
  event: m[1],
  index: m.index,
}))

/** 事件名 → { cases: Set<action>, dispatches: Set<customEvent>, source: string } */
const bridge = new Map()
let caseHits = 0
let dispatchHits = 0

for (let i = 0; i < listenPositions.length; i++) {
  const cur = listenPositions[i]
  const end = i + 1 < listenPositions.length ? listenPositions[i + 1].index : bridgeText.length
  const block = bridgeText.slice(cur.index, end)
  const entry = bridge.get(cur.event) ?? { cases: new Set(), dispatches: new Set() }
  for (const m of block.matchAll(/case\s*'([a-z_]+)':/g)) {
    entry.cases.add(m[1])
    caseHits++
  }
  for (const m of block.matchAll(/new CustomEvent\(\s*'([a-z][a-z0-9:-]*)'/g)) {
    entry.dispatches.add(m[1])
    dispatchHits++
  }
  bridge.set(cur.event, entry)
}

console.log(
  `  listen() ${listenPositions.length} 处, case 分支 ${caseHits} 个, CustomEvent 派发 ${dispatchHits} 处`,
)
for (const [event, entry] of [...bridge.entries()].sort()) {
  console.log(
    `  ${C.dim}bridge:${C.reset} ${event}${C.reset} → cases[${[...entry.cases].join(', ') || '无'}] → dispatches[${[...entry.dispatches].join(', ')}]`,
  )
}

/** 桥接端派发的所有 CustomEvent 名 */
const allDispatches = new Set()
for (const entry of bridge.values()) {
  for (const d of entry.dispatches) allDispatches.add(d)
}

// ============================================================================
// [3/3] 层 3: 前端消费方扫描
// ============================================================================

console.log(`\n${C.cyan}[3/3] 层3: 前端消费方扫描${C.reset}`)

/** CustomEvent 名 → 消费来源 */
const consumers = new Map()
function addConsumer(name, source) {
  if (!consumers.has(name)) consumers.set(name, new Set())
  consumers.get(name).add(source)
}

/**
 * 规则 D 用:apps/web/src 内部(非桥接文件)的 CustomEvent 派发点。
 * 2026-09-22 立:规则 C 只盯 use-desktop.ts 一条桥接链,结果像 `ihui:retry-message`
 * (消息气泡「重试」按钮)这类组件层派发到空气的缺陷照样溜出去 —— 与本 gate 守护的
 * 托盘「切换主题/打开设置」是**同一个失效模式**(dispatch 成功、零副作用),故一并纳入守护。
 */
const webDispatches = new Map()
function addWebDispatch(name, source) {
  if (!webDispatches.has(name)) webDispatches.set(name, new Set())
  webDispatches.get(name).add(source)
}
/** 正则命中偏移 → 行号 */
const lineOf = (text, index) => text.slice(0, index).split('\n').length

const WEB_SRC = path.join(ROOT, 'apps/web/src')
const webFiles = walk(WEB_SRC, ['.ts', '.tsx']).filter((f) => rel(f) !== rel(BRIDGE_FILE))
let literalListenerHits = 0
let registryKeyHits = 0

/**
 * 事件注册表常量块:`addEventListener(event, handler)` 这种变量形态注册静态扫不到,
 * 故把形如 `const XXX_ROUTES: Record<string, string> = { 'global-shortcut:new-chat': '/chat', ... }`
 * 的映射表 key 一并计入消费方(表名约定以 ROUTES / EVENTS 结尾)。
 */
const REGISTRY_BLOCK_RE =
  /const\s+[A-Z][A-Z0-9_]*_(?:ROUTES|EVENTS)\s*(?::\s*Record<[^>]*>)?\s*=\s*\{([\s\S]*?)\n\}/g

for (const f of webFiles) {
  const text = readFileSync(f, 'utf-8')
  for (const m of text.matchAll(/addEventListener\(\s*'([a-z][a-z0-9:-]*)'/g)) {
    addConsumer(m[1], `${rel(f)} (addEventListener)`)
    literalListenerHits++
  }
  for (const m of text.matchAll(REGISTRY_BLOCK_RE)) {
    for (const k of m[1].matchAll(/'([a-z][a-z0-9:-]*)'/g)) {
      addConsumer(k[1], `${rel(f)} (事件注册表常量)`)
      registryKeyHits++
    }
  }
  // 规则 D:同一文件内的派发点(dispatchEvent(new CustomEvent('xxx')))
  for (const m of text.matchAll(/dispatchEvent\(\s*new CustomEvent\(\s*'([a-z][a-z0-9:-]*)'/g)) {
    addWebDispatch(m[1], `${rel(f)}:${lineOf(text, m.index)}`)
  }
}

console.log(
  `  扫描 ${webFiles.length} 个文件: 字面量监听 ${literalListenerHits} 处, 注册表常量 ${registryKeyHits} 处`,
)

// ============================================================================
// 自失效防护(防空转变绿)
// ============================================================================

console.log(`\n${C.cyan}扫描器自失效防护${C.reset}`)

const SANITY_MIN = [
  {
    label: 'Rust emit 命中数',
    actual: rustEmitHits,
    min: 8,
    hint: '托盘 5 action + before-close + 快捷键 2',
  },
  {
    label: 'Rust emit 事件名数',
    actual: rustEmits.size,
    min: 3,
    hint: 'tray-action / shortcut / before-close',
  },
  {
    label: '桥接端 listen 数',
    actual: listenPositions.length,
    min: 4,
    hint: 'tray / shortcut / before-close / deep-link',
  },
  { label: '桥接端 case 分支数', actual: caseHits, min: 7, hint: 'tray 5 + shortcut 2' },
  {
    label: '桥接端 CustomEvent 派发数',
    actual: dispatchHits,
    min: 9,
    hint: '每个 case 各一处 + deep-link 的 sso-success',
  },
  {
    label: '前端消费点总数',
    actual: literalListenerHits + registryKeyHits,
    min: 50,
    hint: '含 SHORTCUT_ROUTES / MODE_SHORTCUT_EVENTS 注册表',
  },
  {
    label: 'web 组件层 CustomEvent 派发数',
    actual: webDispatches.size,
    min: 12,
    hint: '规则 D 基线: ihui:regenerate/branch/edit/reply/retry/scroll-to 等',
  },
]
for (const { label, actual, min, hint } of SANITY_MIN) {
  if (actual < min) {
    errors.push(
      `扫描器疑似失效: ${label} 仅命中 ${actual} 处(阈值 ${min})— ${hint}。正则/路径需随代码同步更新,禁止空转变绿`,
    )
  } else {
    passed.push(`扫描器健康: ${label} (${actual} ≥ ${min})`)
  }
}

// ============================================================================
// 三层闭环对账
// ============================================================================

console.log(`\n${C.cyan}三层闭环对账${C.reset}`)

// —— 规则 A: Rust emit 的事件名必须有桥接端 listen ——
console.log(`\n${C.cyan}规则 A: Rust emit 事件 ⊆ 桥接端 listen${C.reset}`)
let ruleAHits = 0
for (const event of rustEmits.keys()) {
  if (!bridge.has(event)) {
    errors.push(
      `链路断裂(规则 A): Rust emit 事件 "${event}" 但 use-desktop.ts 无 listen('${event}') — 事件发出后无人接收`,
    )
    console.log(`  ${C.red}✗ ${event}: Rust 有 emit 但桥接端无 listen${C.reset}`)
    ruleAHits++
  }
}
if (ruleAHits === 0) {
  console.log(`  ${C.green}✓ 全部 ${rustEmits.size} 个 Rust 事件均有桥接端监听${C.reset}`)
  passed.push(`规则 A: Rust emit 事件全部有桥接端 listen (${rustEmits.size} 个)`)
}

// —— 规则 B: Rust emit 的 (事件, action) 必须在桥接端有 case ——
console.log(`\n${C.cyan}规则 B: Rust emit (事件, action) ⊆ 桥接端 case 分支${C.reset}`)
let ruleBHits = 0
let ruleBChecked = 0
for (const [event, actions] of rustEmits.entries()) {
  for (const action of actions) {
    if (action === UNIT_PAYLOAD) continue // 无 payload 事件不校验 case
    ruleBChecked++
    const entry = bridge.get(event)
    if (!entry) continue // 规则 A 已报错
    if (!entry.cases.has(action)) {
      errors.push(
        `链路断裂(规则 B): Rust emit "${event}" action "${action}" 但 use-desktop.ts 对应 listen 块内无 case '${action}' 分支 — 该 action 被静默丢弃`,
      )
      console.log(`  ${C.red}✗ ${event}/${action}: 桥接端无对应 case${C.reset}`)
      ruleBHits++
    }
  }
}
if (ruleBHits === 0) {
  console.log(`  ${C.green}✓ ${ruleBChecked} 个 (事件, action) 全部有 case 分支${C.reset}`)
  passed.push(`规则 B: Rust emit action 全部有桥接端 case 分支 (${ruleBChecked} 个)`)
}

// —— 规则 C: 桥接端派发的 CustomEvent 必须有消费方(本次事故核心规则)——
console.log(`\n${C.cyan}规则 C: 桥接端 CustomEvent ⊆ 前端消费方(防"点击没反应")${C.reset}`)
let ruleCHits = 0
let ruleCWhitelisted = 0
for (const name of [...allDispatches].sort()) {
  const points = consumers.get(name)
  if (!points || points.size === 0) {
    if (CONSUMER_WHITELIST_SET.has(name)) {
      const entry = CONSUMER_WHITELIST.find((w) => w.name === name)
      warnings.push(`规则 C 豁免: CustomEvent "${name}" 无前端消费方 — ${entry.reason}`)
      console.log(
        `  ${C.yellow}○ ${name}: 白名单豁免${C.reset} ${C.dim}— ${entry.reason}${C.reset}`,
      )
      ruleCWhitelisted++
      continue
    }
    errors.push(
      `链路断裂(规则 C): use-desktop.ts 派发 CustomEvent "${name}" 但 apps/web/src 全量无任何消费方 — ` +
        `表现为托盘菜单项/快捷键"点击完全没反应"。请在根级 Provider(props 稳定、不依赖深层组件挂载)补齐 addEventListener, ` +
        `或改派发到已存在的等价事件(如 global-shortcut:* 系列)。`,
    )
    console.log(`  ${C.red}✗ ${name}: 无消费方(点击无反应)${C.reset}`)
    ruleCHits++
  } else {
    console.log(`  ${C.green}✓ ${name}${C.reset} ${C.dim}← ${[...points].join(', ')}${C.reset}`)
  }
}
if (ruleCHits === 0) {
  passed.push(`规则 C: 全部 ${allDispatches.size} 个 CustomEvent 均有前端消费方`)
}

// —— 规则 D: apps/web/src 全量 CustomEvent 派发都应有监听方(2026-09-22 增)——
console.log(
  `\n${C.cyan}规则 D: apps/web/src 组件层 CustomEvent ⊆ 消费方(规则 C 的泛化版)${C.reset}`,
)
let ruleDHits = 0
let ruleDWhitelisted = 0
for (const name of [...webDispatches.keys()].sort()) {
  const points = consumers.get(name)
  if (points && points.size > 0) continue // 已有监听方(含同文件自产自销)
  if (CONSUMER_WHITELIST_SET.has(name)) {
    const entry = CONSUMER_WHITELIST.find((w) => w.name === name)
    warnings.push(`规则 D 豁免: CustomEvent "${name}" 无监听方 — ${entry?.reason ?? '见白名单'}`)
    console.log(
      `  ${C.yellow}○ ${name}: 白名单豁免${C.reset} ${C.dim}— ${entry?.reason ?? ''}${C.reset}`,
    )
    ruleDWhitelisted++
    continue
  }
  const sites = [...(webDispatches.get(name) ?? [])].join(', ')
  errors.push(
    `链路断裂(规则 D): ${sites} 派发 CustomEvent "${name}",但 apps/web/src 全量无 addEventListener('${name}') — ` +
      `用户触发该交互后零副作用(按钮点了没反应,与桌面托盘菜单同型)。` +
      `修法二选一:① 在正确的挂载点补监听(MessageList / 根 Provider,别挂在会被卸载的深层组件);` +
      `② 删掉这段死派发,直接调用目标能力(store action / router.push / hook 函数)。`,
  )
  console.log(`  ${C.red}✗ ${name}: 派发到空气${C.reset} ${C.dim}← ${sites}${C.reset}`)
  ruleDHits++
}
if (ruleDHits === 0) {
  console.log(`  ${C.green}✓ ${webDispatches.size} 个组件层 CustomEvent 派发全部有监听方${C.reset}`)
  passed.push(`规则 D: apps/web/src ${webDispatches.size} 个 CustomEvent 派发全部有监听方`)
}

// ============================================================================
// 规则 E: 两条链的语义分层(continuous 实时链 / replayable 重放链)
// ============================================================================

console.log(`\n${C.cyan}规则 E: 链语义分层对账${C.reset}`)

const REPLAY_FILES = [
  { file: 'apps/web/src/hooks/use-agent-control.ts', label: '桌面 agent.action 消费端' },
  { file: 'apps/extension/lib/agent-control-bridge.ts', label: '扩展 agent.action 消费端' },
]

let ruleEErrors = 0
const chainRead = (p) => (existsSync(path.join(ROOT, p)) ? readFileSync(path.join(ROOT, p), 'utf-8') : '')
const bridgeChainText = chainRead('apps/web/src/hooks/use-desktop.ts')

// E1 —— 实时链不得混入重放语义
const e1 = findContinuousChainDrift(bridgeChainText)
for (const hit of e1) {
  errors.push(
    `链语义混用(规则 E1): 实时链桥接端 use-desktop.ts ${hit} —— 这条链的投递面(Tauri 事件总线)没有持久队列,` +
      `按 requestId 去重/补发只会把"投递失败"伪装成"已处理"。重放语义属 replayable 链` +
      `(api \`agent.action\` + \`_pending\` 会合),不得搬进这里。`,
  )
  console.log(`  ${C.red}✗ E1 use-desktop.ts 混入重放语义:${hit}${C.reset}`)
  ruleEErrors++
}
if (e1.length === 0) {
  passed.push('规则 E1: 实时链(use-desktop.ts)无重放语义载体')
  console.log(`  ${C.green}✓ E1 实时链保持 continuous 本性(无 id / 无队列)${C.reset}`)
}

// E2 —— 重放链不得丢掉幂等标记
for (const { file, label } of REPLAY_FILES) {
  const src = chainRead(file)
  if (!src) {
    errors.push(`规则 E2 无法判定: ${file} 取不到内容(被移动/改名?)—— 判据不得静默放过`)
    ruleEErrors++
    continue
  }
  const problems = findReplayableIdempotencyLoss(src, label)
  for (const p of problems) {
    errors.push(
      `链语义断裂(规则 E2): ${p} —— replayable 链的投递保证是"至少一次"(WS 重连/同用户多连接都会重复送达),` +
        `去掉幂等键等于让同一条指令执行两次(重复输入/重复点击),而这只在断线时显形。`,
    )
    console.log(`  ${C.red}✗ E2 ${p}${C.reset}`)
    ruleEErrors++
  }
  if (problems.length === 0) {
    passed.push(`规则 E2: ${file} 保留 requestId 幂等`)
    console.log(`  ${C.green}✓ E2 ${file} 幂等键在位${C.reset}`)
  }
}

// E3 —— 链名必须写进源码(不写进源码的命名等于不存在)
for (const { file, chain } of [
  { file: 'apps/web/src/hooks/use-desktop.ts', chain: CHAIN_CONTINUOUS },
  { file: 'apps/web/src/hooks/use-agent-control.ts', chain: CHAIN_REPLAYABLE },
]) {
  const src = chainRead(file)
  const problems = src ? findChainNameMarker(src, chain, file) : [`未取到 ${file}`]
  for (const p of problems) {
    errors.push(
      `链命名缺失(规则 E3): ${p} —— 本仓把两条桌面链定名为 ${CHAIN_CONTINUOUS} / ${CHAIN_REPLAYABLE},` +
        `标记必须随行,否则改 stream/snapshot/queue 时仍会只验到另一条链。`,
    )
    console.log(`  ${C.red}✗ E3 ${p}${C.reset}`)
    ruleEErrors++
  }
  if (problems.length === 0) {
    passed.push(`规则 E3: ${file} 带 chain: ${chain} 标记`)
    console.log(`  ${C.green}✓ E3 ${file} 标注 chain: ${chain}${C.reset}`)
  }
}
if (ruleEErrors === 0) {
  console.log(
    `  ${C.dim}分层结论:两条链分属不同通道(Tauri 事件总线 ↔ WS agent.action + api _pending),` +
      `故本规则只钉"不得混用、不得摘标记",不引入新的载体${C.reset}`,
  )
}

// ============================================================================
// 规则 F: Rust 主进程不得持有 task/session 业务状态
// ============================================================================

console.log(`\n${C.cyan}规则 F: Rust 进程状态归属对账${C.reset}`)

const rustFiles = walk(path.join(ROOT, 'apps/desktop/src-tauri/src'), ['.rs'])
let rustDeclTotal = 0
let ruleFErrors = 0
for (const f of rustFiles) {
  const text = readFileSync(f, 'utf-8')
  rustDeclTotal += countRustStateDecls(text)
  for (const v of findRustStateViolations(text, rel(f))) {
    errors.push(`状态归属越界(规则 F): ${v}`)
    console.log(`  ${C.red}✗ ${v}${C.reset}`)
    ruleFErrors++
  }
}
if (rustFiles.length > 0 && rustDeclTotal === 0) {
  errors.push(
    `扫描器疑似失效(规则 F): apps/desktop/src-tauri/src 共 ${rustFiles.length} 个 .rs,` +
      `进程级状态声明扫到 0 处 —— HEAD 至少有窗口节流表,判据不得空转变绿`,
  )
  console.log(`  ${C.red}✗ F 声明计数为 0,判据失效${C.reset}`)
  ruleFErrors++
}
if (ruleFErrors === 0) {
  passed.push(`规则 F: Rust ${rustFiles.length} 个 .rs / ${rustDeclTotal} 处进程级状态,无业务状态持有者`)
  console.log(
    `  ${C.green}✓ F Rust 进程级状态 ${rustDeclTotal} 处,逐个标识符/类型都不含业务名词(无清单豁免)${C.reset}`,
  )
}

// ============================================================================
// 汇总
// ============================================================================

console.log(`\n${'='.repeat(60)}`)
console.log(`${C.cyan}桌面端事件链路接线守门汇总${C.reset}`)
console.log(`${'='.repeat(60)}`)
console.log(
  `层1 Rust emit: ${rustEmitHits} 处 / ${rustEmits.size} 事件 | 层2 桥接: ${listenPositions.length} listen | 层3 消费: ${consumers.size} 事件`,
)
console.log(`${C.green}通过检查: ${passed.length}${C.reset}`)
console.log(`${C.yellow}白名单豁免(不阻断): ${ruleCWhitelisted + ruleDWhitelisted}${C.reset}`)
console.log(`${C.red}错误(阻断): ${errors.length}${C.reset}`)

if (errors.length > 0) {
  console.log(`\n${C.red}阻断 commit:${C.reset}`)
  for (const e of errors) console.log(`  - ${e}`)
  console.log(`\n修复路径: 补齐缺失的一层接线(参考 use-desktop.ts 顶部注释的事件/消费方对照表)`)
  console.log(`紧急跳过: HUSKY_SKIP_DESKTOP_EVENT_WIRING=1 git commit ...(需 PR 说明)`)
  process.exit(1)
}

console.log(`\n${C.green}✅ 桌面端事件链路三层接线闭环通过${C.reset}`)
process.exit(0)
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
