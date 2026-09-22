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
]
const CONSUMER_WHITELIST_SET = new Set(CONSUMER_WHITELIST.map((w) => w.name))

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')

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
console.log(`${C.yellow}白名单豁免(不阻断): ${ruleCWhitelisted}${C.reset}`)
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
