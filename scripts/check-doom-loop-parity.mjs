// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

//
// Doom-loop parity 对账(V3 #54,2026-09-28 立)
//
// 钉的是本仓反复出事的同一型:一份算法被复制到两种语言后各自漂移。
// TS 唯一算法源 = packages/shared/src/agent/doom-loop-detector.ts;
// Python 等价实现 = apps/ai-service/app/core/doom_loop.py(ai-service 主链路
// agent_loop_v2.py 消费)。两侧必须逐项等值:
//   P1 阈值/窗口/冷却/签名截断长度/摘要算法名/状态清单/换策略动作清单
//   P2 装车性:CLI 必须经共享层取判据(薄适配器 + 桥在位);agent.ts 不得
//      再本地抄死循环阈值数字;agent_loop_v2.py 必须真的调用哨兵(摘线即红)
//   P3 动作集合逐项被两条主链路消费(声明了没人执行 = 装饰品,判红)
//
// 三态纪律(口径同守门 70/77/83/98/101/103/118):
//   全量判 **HEAD blob**、--staged 判**索引 blob**、--worktree 仅人工/夹具逃生舱,
//   两面旗同给 ⇒ exit 2;任一被审文件在该面上取不到 ⇒ exit 2「无法判定」
//   (本门立项当枚提交里六文件与接线同笔落地,面缺文件不是"没有违规"而是"还没上车")。
// 判红只针对**结构事实**(等值被打破 / 接线被摘 / 数字被二次抄写),
// 无存量基线 —— 立门实测两侧逐项等值,不存在"与任何提交都无关的恒红面"。
//
// 行内豁免:无(不允许)。P1/P2/P3 都是"两份实现是否同形"的硬事实,豁免即失明。
//
// ⚠️ 接线状态:本文件**尚未**接进 scripts/guardian-runner.mjs / package.json / CI
//    (注册由主会话单写完成)。镜像测试 scripts/tests/check-doom-loop-parity.test.mjs
//    的 T1 钉住"未注册时不得被判定为已装车"。应急跳过环境变量预留为
//    HUSKY_SKIP_DOOM_LOOP_PARITY(注册时由主会话写进 runner 条目的 skipEnv)。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { maskComments } from './lib/outbound-route-facts.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 六份被审面(全部必须在场;少一份 = 无法判定,不是通过)。 */
export const FILES = {
  tsShared: 'packages/shared/src/agent/doom-loop-detector.ts',
  tsBridge: 'packages/shared/src/utils/doom-loop-detector.ts',
  cliAdapter: 'apps/cli/src/doom-loop-detector.ts',
  cliLoop: 'apps/cli/src/commands/agent.ts',
  pyModule: 'apps/ai-service/app/core/doom_loop.py',
  pyLoop: 'apps/ai-service/app/services/agent_loop_v2.py',
}

/** 必须逐项等值的标量(数值/字符串)。 */
export const POLICY_NUMBERS = [
  'DOOM_LOOP_WINDOW_SIZE',
  'DOOM_LOOP_REPEAT_THRESHOLD',
  'DOOM_LOOP_COOLDOWN_MS',
  'DOOM_ALERT_ROUNDS_TO_TERMINATE',
  'STUCK_CONSECUTIVE_THRESHOLD',
  'FAILURE_STREAK_STRATEGY_THRESHOLD',
  'ERROR_SIGNATURE_MAX_LEN',
]
export const POLICY_STRINGS = ['DOOM_LOOP_HASH_ALGORITHM']
/** 必须逐项等值(含长度 = "状态数/动作数")的清单。 */
export const POLICY_LISTS = ['DOOM_LOOP_STATES', 'DOOM_LOOP_STRATEGY_ACTIONS']

// ---------------------------------------------------------------------------
// 两侧策略面解析(输入必须是**剥注释、保留字符串**的掩码面)
// ---------------------------------------------------------------------------

/**
 * TS 侧:`export const NAME = 42` / `= 'sha256'` / `= [...] as const`。
 * 解析不到某键不在此处判红 —— decide 统一按"缺失 ⇒ 红"处理(判据与解析分层)。
 */
export function parseTsPolicy(maskedSrc) {
  /** @type {Record<string, number|string|Array<string>>} */
  const out = {}
  for (const name of POLICY_NUMBERS) {
    const m = new RegExp(`^export const ${name} = (-?\\d+)\\s*;?\\s*$`, 'm').exec(maskedSrc)
    if (m) out[name] = Number(m[1])
  }
  for (const name of POLICY_STRINGS) {
    const m = new RegExp(`^export const ${name} = '([^']*)'\\s*;?\\s*$`, 'm').exec(maskedSrc)
    if (m) out[name] = m[1]
  }
  for (const name of POLICY_LISTS) {
    const m = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`, 'm').exec(maskedSrc)
    if (m) {
      out[name] = [...m[1].matchAll(/'([^']*)'/g)].map((s) => s[1])
    }
  }
  return out
}

/** Python 侧:`NAME = 42` / `NAME = 'x'` / `NAME = ['a', 'b']`(单行清单)。 */
export function parsePyPolicy(maskedSrc) {
  /** @type {Record<string, number|string|Array<string>>} */
  const out = {}
  for (const name of POLICY_NUMBERS) {
    const m = new RegExp(`^${name} = (-?\\d+)\\s*$`, 'm').exec(maskedSrc)
    if (m) out[name] = Number(m[1])
  }
  for (const name of POLICY_STRINGS) {
    const m = new RegExp(`^${name} = '([^']*)'\\s*$`, 'm').exec(maskedSrc)
    if (m) out[name] = m[1]
  }
  for (const name of POLICY_LISTS) {
    const m = new RegExp(`^${name} = \\[([^\\]]*)\\]\\s*$`, 'm').exec(maskedSrc)
    if (m) out[name] = [...m[1].matchAll(/'([^']*)'/g)].map((s) => s[1])
  }
  return out
}

// ---------------------------------------------------------------------------
// 判据(纯函数,构造面即可证明;取材在 runAudit)
// ---------------------------------------------------------------------------

/**
 * @param {{[k in keyof typeof FILES]: string|null}} contents 被审面内容(null=取不到)
 * @returns {{problems:string[], notes:string[], undetermined:string[], policy:Record<string, [unknown, unknown]>|null}}
 */
export function decide(contents) {
  const problems = []
  const notes = []
  const undetermined = Object.values(FILES).filter((f) => {
    const v = contents[f]
    return typeof v !== 'string' || v.length === 0
  })
  if (undetermined.length > 0) return { problems, notes, undetermined, policy: null }

  const tsMask = maskComments(contents[FILES.tsShared], 'js')
  const pyMask = maskComments(contents[FILES.pyModule], 'py')
  const bridgeMask = maskComments(contents[FILES.tsBridge], 'js')
  const adapterMask = maskComments(contents[FILES.cliAdapter], 'js')
  const cliLoopMask = maskComments(contents[FILES.cliLoop], 'js')
  const pyLoopMask = maskComments(contents[FILES.pyLoop], 'py')

  // ---- P1 策略面逐项等值 ----
  const tsPolicy = parseTsPolicy(tsMask)
  const pyPolicy = parsePyPolicy(pyMask)
  /** @type {Record<string, [unknown, unknown]>} */
  const policy = {}
  for (const key of [...POLICY_NUMBERS, ...POLICY_STRINGS, ...POLICY_LISTS]) {
    const a = tsPolicy[key]
    const b = pyPolicy[key]
    policy[key] = [a ?? null, b ?? null]
    if (a === undefined || a === null) {
      problems.push(`P1 TS 侧策略键缺失/形态漂移:${key}(应写为 \`export const ${key} = <字面量>\`)`)
      continue
    }
    if (b === undefined || b === null) {
      problems.push(`P1 Python 侧策略键缺失/形态漂移:${key}(应写为 \`${key} = <字面量>\`)`)
      continue
    }
    const same = Array.isArray(a)
      ? Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i])
      : a === b
    if (!same) {
      problems.push(
        `P1 两侧漂开:${key} TS=${JSON.stringify(a)} vs Python=${JSON.stringify(b)}` +
          `(清单还需长度相等 = 状态数/动作数等值;修法是**同枚提交**改齐两侧,不得只改一边)`,
      )
    }
  }

  // ---- P2 装车性 ----
  if (/\bnode:[a-z_]+/.test(adapterMask) === false) {
    // CLI 适配器必须自带真摘要(node:crypto);丢了它 hashInput 无从计算
    problems.push(`P2 CLI 适配器缺 node:crypto 摘要注入:${FILES.cliAdapter}`)
  }
  if (!adapterMask.includes('@ihui/shared/utils/doom-loop-detector')) {
    problems.push(
      `P2 CLI 适配器未从共享层 import(判据第二份回升风险):${FILES.cliAdapter} 必须 import '@ihui/shared/utils/doom-loop-detector'`,
    )
  }
  if (!bridgeMask.includes('../agent/doom-loop-detector')) {
    problems.push(
      `P2 共享层桥断线:${FILES.tsBridge} 必须 \`export * from '../agent/doom-loop-detector.js'\`(唯一算法源所在目录被搬走/摘线)`,
    )
  }
  if (/from\s+['"]node:|require\(\s*['"]node:|createHash\(/.test(tsMask)) {
    problems.push(
      `P2 共享层混入平台依赖:${FILES.tsShared} 禁止 node 内建/摘要实现(§3 跨端工厂:摘要由各端注入)`,
    )
  }
  // agent.ts 不得再抄第二份数字(立门前这些声明存在;删本地声明改 import 是 V3#54 交付本体)
  const bannedCliCopies = [
    [/const\s+SAMPLER_DOOM_LOOP_THRESHOLD\s*=\s*\d+/, 'SAMPLER_DOOM_LOOP_THRESHOLD'],
    [/const\s+FAILURE_REFLECTION_THRESHOLD\s*=\s*\d+/, 'FAILURE_REFLECTION_THRESHOLD'],
    [/consecutiveDoomAlerts\s*>=\s*\d+/, 'consecutiveDoomAlerts >= <数字>'],
  ]
  for (const [re, label] of bannedCliCopies) {
    if (re.test(cliLoopMask)) {
      problems.push(
        `P2 CLI 二次抄写触发条件:${FILES.cliLoop} 仍声明/比较本地数字 "${label}" —— 阈值唯一来源是共享层常量`,
      )
    }
  }
  for (const [sym, where] of [
    ['STUCK_CONSECUTIVE_THRESHOLD', FILES.cliLoop],
    ['planDoomAlertResponse', FILES.cliLoop],
    ['createFailureStreakTracker', FILES.cliLoop],
    ['createDoomLoopWindow', FILES.cliAdapter],
    ['createStuckSignatureDetector', FILES.cliAdapter],
  ]) {
    const mask = where === FILES.cliLoop ? cliLoopMask : adapterMask
    if (!mask.includes(sym)) {
      problems.push(`P2 共享层判据未被主链路使用:${where} 缺 ${sym}(摘线 = 门对该形态全盲)`)
    }
  }
  for (const sym of ['DoomLoopSentinel(', 'observe_calls(', 'observe_results(']) {
    if (!pyLoopMask.includes(sym)) {
      problems.push(
        `P2 Python 主链路未接哨兵:${FILES.pyLoop} 缺 ${sym} —— "等价实现存在但无人调用"等于没有上提`,
      )
    }
  }
  for (const key of [...POLICY_NUMBERS, ...POLICY_STRINGS, ...POLICY_LISTS]) {
    const re = new RegExp(`^\\s*${key}\\s*=\\s*\\d`, 'm')
    const reList = new RegExp(`^\\s*${key}\\s*=\\s*\\[`, 'm')
    if (re.test(pyLoopMask) || reList.test(pyLoopMask)) {
      problems.push(
        `P2 Python 主链路二次抄写策略数字:${FILES.pyLoop} 重新声明了 ${key}(唯一来源 = core/doom_loop.py)`,
      )
    }
  }

  // ---- P3 动作集合逐项被两侧主链路消费 ----
  const actions = Array.isArray(tsPolicy['DOOM_LOOP_STRATEGY_ACTIONS'])
    ? tsPolicy['DOOM_LOOP_STRATEGY_ACTIONS']
    : []
  for (const action of actions) {
    if (!cliLoopMask.includes(`'${action}'`)) {
      problems.push(
        `P3 动作 "${action}" 在 CLI 主链路无消费点:${FILES.cliLoop} 未处理该动作(声明动作=装饰品,判红)`,
      )
    }
    if (!pyLoopMask.includes(`"${action}"`) && !pyLoopMask.includes(`'${action}'`)) {
      problems.push(
        `P3 动作 "${action}" 在 Python 主链路无消费点:${FILES.pyLoop} 未处理该动作(声明动作=装饰品,判红)`,
      )
    }
  }
  if (actions.length === 0) {
    problems.push('P3 动作清单解析为空 ⇒ 判据失明(策略动作集合缺失,不得把"看不见"读成通过)')
  }

  return { problems, notes, undetermined, policy }
}

// ---------------------------------------------------------------------------
// 取材 + CLI
// ---------------------------------------------------------------------------

/**
 * @param {string} root
 * @param {'head'|'staged'|'worktree'} face
 */
export function readFace(root, face, files) {
  if (face === 'worktree') {
    const m = new Map()
    for (const f of files) m.set(f, readWorktreeFile(root, f))
    return m
  }
  const prefix = face === 'head' ? 'HEAD:' : ':'
  const revs = files.map((f) => `${prefix}${f}`)
  const batch = catBatch(root, revs)
  const m = new Map()
  files.forEach((f, i) => m.set(f, batch.get(revs[i]) ?? null))
  return m
}

/**
 * @param {string} root
 * @param {'head'|'staged'|'worktree'} face
 */
export function runAudit(root, face) {
  assertRepoRoot(root, 'doom-loop parity 对账')
  const files = Object.values(FILES)
  const contents = readFace(root, face, files)
  /** @type {Record<string, string|null>} */
  const map = {}
  for (const f of files) map[f] = contents.get(f) ?? null
  return decide(map)
}

function report(res) {
  if (res.undetermined.length > 0) {
    console.error('⚠️ 无法判定:以下被审文件在该判定面上取不到(缺文件 ≠ 通过,也 ≠ 违规):')
    for (const f of res.undetermined) console.error(`   - ${f}`)
    return 2
  }
  if (res.problems.length > 0) {
    console.error(`❌ doom-loop parity 对账发现 ${res.problems.length} 项漂开:`)
    for (const p of res.problems) console.error(`   ${p}`)
    console.error(
      '   出路:同一枚提交把两侧改齐(P1)/把判据接回主链路(P2/P3)。' +
        '**不得**改数字方向迁就单侧,不得新造豁免通道。应急跳过 HUSKY_SKIP_DOOM_LOOP_PARITY=1。',
    )
    return 1
  }
  const keys = res.policy ? Object.keys(res.policy).length : 0
  console.log(
    `✅ TS 共享层 / CLI 适配器 / agent.ts / Python 等价实现 / agent_loop_v2 五面成套:` +
      `策略键 ${keys} 项逐格等值,主链路两侧均消费(动作集合非装饰品),无第二份数字。`,
  )
  for (const n of res.notes) console.log(`   · ${n}`)
  return 0
}

// ---------------------------------------------------------------------------
// --self-test(构造面证明,零 git、零副作用)
// ---------------------------------------------------------------------------

/** 一套"两侧等值 + 接线成套"的最小夹具(字段形状与 decide 输入一致)。 */
function fixtureContents(overrides = {}) {
  const tsShared = [
    `export const DOOM_LOOP_WINDOW_SIZE = 10;`,
    `export const DOOM_LOOP_REPEAT_THRESHOLD = 3;`,
    `export const DOOM_LOOP_COOLDOWN_MS = 0;`,
    `export const DOOM_ALERT_ROUNDS_TO_TERMINATE = 2;`,
    `export const STUCK_CONSECUTIVE_THRESHOLD = 3;`,
    `export const FAILURE_STREAK_STRATEGY_THRESHOLD = 3;`,
    `export const ERROR_SIGNATURE_MAX_LEN = 120;`,
    `export const DOOM_LOOP_HASH_ALGORITHM = 'sha256';`,
    `export const DOOM_LOOP_STATES = ['observing', 'reflecting', 'terminating'] as const;`,
    `export const DOOM_LOOP_STRATEGY_ACTIONS = ['inject_reflection', 'skip_tool_execution', 'terminate_loop'] as const;`,
    `export function createDoomLoopWindow() { return null }`,
    `export function createStuckSignatureDetector() { return null }`,
    `export function createFailureStreakTracker() { return null }`,
  ].join('\n')
  const tsBridge = `export * from '../agent/doom-loop-detector.js'`
  const cliAdapter = [
    `import { createHash } from 'node:crypto'`,
    `import { createDoomLoopWindow, createStuckSignatureDetector } from '@ihui/shared/utils/doom-loop-detector'`,
    `export { createFailureStreakTracker, planDoomAlertResponse } from '@ihui/shared/utils/doom-loop-detector'`,
  ].join('\n')
  const cliLoop = [
    `import { STUCK_CONSECUTIVE_THRESHOLD, planDoomAlertResponse, createFailureStreakTracker } from '../doom-loop-detector.js'`,
    `if (plan.actions.includes('terminate_loop')) break`,
    `if (plan.actions.includes('inject_reflection')) pushReminder()`,
    `if (plan.actions.includes('skip_tool_execution')) continue`,
  ].join('\n')
  const pyModule = [
    `DOOM_LOOP_WINDOW_SIZE = 10`,
    `DOOM_LOOP_REPEAT_THRESHOLD = 3`,
    `DOOM_LOOP_COOLDOWN_MS = 0`,
    `DOOM_ALERT_ROUNDS_TO_TERMINATE = 2`,
    `STUCK_CONSECUTIVE_THRESHOLD = 3`,
    `FAILURE_STREAK_STRATEGY_THRESHOLD = 3`,
    `ERROR_SIGNATURE_MAX_LEN = 120`,
    `DOOM_LOOP_HASH_ALGORITHM = 'sha256'`,
    `DOOM_LOOP_STATES = ['observing', 'reflecting', 'terminating']`,
    `DOOM_LOOP_STRATEGY_ACTIONS = ['inject_reflection', 'skip_tool_execution', 'terminate_loop']`,
  ].join('\n')
  const pyLoop = [
    `from ..core.doom_loop import DoomLoopSentinel`,
    `self._doom_sentinel = DoomLoopSentinel()`,
    `actions, reminders = self._doom_sentinel.observe_calls(calls)`,
    `reminders2, fatal = self._doom_sentinel.observe_results(results)`,
    `if "terminate_loop" in actions: return`,
    `if "skip_tool_execution" in actions: skip()`,
    `if "inject_reflection" in actions: inject()`,
  ].join('\n')
  return {
    [FILES.tsShared]: tsShared,
    [FILES.tsBridge]: tsBridge,
    [FILES.cliAdapter]: cliAdapter,
    [FILES.cliLoop]: cliLoop,
    [FILES.pyModule]: pyModule,
    [FILES.pyLoop]: pyLoop,
    ...overrides,
  }
}

export function selfTest() {
  let pass = 0
  let fail = 0
  const ok = (name, cond) => {
    if (cond) {
      pass += 1
      console.log(`  ✅ ${name}`)
    } else {
      fail += 1
      console.log(`  ❌ ${name}`)
    }
  }
  // 1 基线夹具 ⇒ 零问题(阳性:判据对成套夹具不闪红)
  let r = decide(fixtureContents())
  ok('01 成套夹具 ⇒ problems=0(实测:' + r.problems[0] + ')', r.problems.length === 0)
  // 2 单侧阈值漂移 ⇒ P1 点名该键(阳性对照:改掉一侧阈值必红)
  const driftPy = fixtureContents()
  driftPy[FILES.pyModule] = driftPy[FILES.pyModule].replace(
    'DOOM_LOOP_REPEAT_THRESHOLD = 3',
    'DOOM_LOOP_REPEAT_THRESHOLD = 4',
  )
  r = decide(driftPy)
  ok('02 Python 侧阈值 3→4 ⇒ P1 点名 DOOM_LOOP_REPEAT_THRESHOLD',
    r.problems.some((p) => p.startsWith('P1') && p.includes('DOOM_LOOP_REPEAT_THRESHOLD')))
  const driftTs = fixtureContents()
  driftTs[FILES.tsShared] = driftTs[FILES.tsShared].replace(
    'export const STUCK_CONSECUTIVE_THRESHOLD = 3;',
    'export const STUCK_CONSECUTIVE_THRESHOLD = 5;',
  )
  r = decide(driftTs)
  ok('03 TS 侧阈值 3→5 ⇒ P1 点名 STUCK_CONSECUTIVE_THRESHOLD(两侧对称)',
    r.problems.some((p) => p.startsWith('P1') && p.includes('STUCK_CONSECUTIVE_THRESHOLD')))
  // 4 状态数漂移(清单长度)+ 动作漂移
  const driftStates = fixtureContents()
  driftStates[FILES.pyModule] = driftStates[FILES.pyModule].replace(
    "DOOM_LOOP_STATES = ['observing', 'reflecting', 'terminating']",
    "DOOM_LOOP_STATES = ['observing', 'reflecting']",
  )
  r = decide(driftStates)
  ok('04 状态数 3→2 ⇒ P1 点名 DOOM_LOOP_STATES',
    r.problems.some((p) => p.startsWith('P1') && p.includes('DOOM_LOOP_STATES')))
  const driftActions = fixtureContents()
  driftActions[FILES.pyModule] = driftActions[FILES.pyModule].replace(
    "DOOM_LOOP_STRATEGY_ACTIONS = ['inject_reflection', 'skip_tool_execution', 'terminate_loop']",
    "DOOM_LOOP_STRATEGY_ACTIONS = ['inject_reflection', 'terminate_loop']",
  )
  r = decide(driftActions)
  ok('05 动作数漂移 ⇒ P1 点名 DOOM_LOOP_STRATEGY_ACTIONS',
    r.problems.some((p) => p.startsWith('P1') && p.includes('DOOM_LOOP_STRATEGY_ACTIONS')))
  // 6 CLI 二次抄数字 ⇒ 红(回归锁:本地阈值声明不得回来)
  const copyCli = fixtureContents()
  copyCli[FILES.cliLoop] += '\nconst SAMPLER_DOOM_LOOP_THRESHOLD = 3;'
  r = decide(copyCli)
  ok('06 CLI 抄回本地阈值 ⇒ P2 点名二次抄写',
    r.problems.some((p) => p.startsWith('P2') && p.includes('二次抄写')))
  // 7 Python 主链路摘线(去掉 observe_results 调用)⇒ 红
  const unwire = fixtureContents()
  unwire[FILES.pyLoop] = unwire[FILES.pyLoop].replace('observe_results(', 'legacy_noop_(')
  r = decide(unwire)
  ok('07 主链路摘掉 observe_results ⇒ P2 点名"等价实现存在但无人调用"',
    r.problems.some((p) => p.startsWith('P2') && p.includes('observe_results(')))
  // 8 动作无消费点 ⇒ P3 红
  const noConsume = fixtureContents()
  noConsume[FILES.cliLoop] = noConsume[FILES.cliLoop].replace(
    `if (plan.actions.includes('skip_tool_execution')) continue`,
    `// consumer removed`,
  )
  r = decide(noConsume)
  ok('08 CLI 不再处理 skip_tool_execution ⇒ P3 点名装饰品动作',
    r.problems.some((p) => p.startsWith('P3') && p.includes('skip_tool_execution')))
  // 9 共享层混入平台依赖 ⇒ 红
  const dirtyShared = fixtureContents()
  dirtyShared[FILES.tsShared] = `import { createHash } from 'node:crypto'\n` + dirtyShared[FILES.tsShared]
  r = decide(dirtyShared)
  ok('09 共享层 import node:crypto ⇒ P2 点名平台依赖',
    r.problems.some((p) => p.startsWith('P2') && p.includes('平台依赖')))
  // 10 面缺文件 ⇒ 未判定(既不红也不绿)
  r = decide({ ...fixtureContents(), [FILES.pyModule]: null })
  ok('10 面缺 Python 文件 ⇒ undetermined 点名,problems=0',
    r.problems.length === 0 && r.undetermined.length === 1)
  // 11 注释里的漂移数字不得判红(掩码:注释不算代码面)
  const commented = fixtureContents()
  commented[FILES.pyModule] = '# DOOM_LOOP_REPEAT_THRESHOLD = 99\n' + commented[FILES.pyModule]
  r = decide(commented)
  ok('11 注释中的旧阈值不得被读成第二份声明', r.problems.length === 0)
  // 12 字符串形态的旧名出现在代码面 ⇒ 掩码保留字符串,二次抄写判据仍咬
  const strCopy = fixtureContents()
  strCopy[FILES.cliLoop] = '\nconst FAILURE_REFLECTION_THRESHOLD = 2;'
  r = decide(strCopy)
  ok('12 FAILURE_REFLECTION_THRESHOLD 回升 ⇒ P2 点名',
    r.problems.some((p) => p.startsWith('P2') && p.includes('FAILURE_REFLECTION_THRESHOLD')))
  // 13 解析器形状锁:等值两侧解析结果一致
  const tp = parseTsPolicy(maskComments(fixtureContents()[FILES.tsShared], 'js'))
  const pp = parsePyPolicy(maskComments(fixtureContents()[FILES.pyModule], 'py'))
  ok('13 TS/Py 解析器对成套夹具解析出的键集合相同',
    JSON.stringify(Object.keys(tp).sort()) === JSON.stringify(Object.keys(pp).sort()))
  // 14 selectFace 两面旗同给 ⇒ 判死
  const both = selectFace({ staged: true, worktree: true })
  ok('14 --staged 与 --worktree 同给 ⇒ error(不取任一面)', both.error !== null)
  console.log(`\ndoom-loop parity 对账 --self-test:${pass} 通过 / ${fail} 失败(共 ${pass + fail} 条)`)
  return fail === 0 ? 0 : 1
}

function main(argv) {
  if (process.env.HUSKY_SKIP_DOOM_LOOP_PARITY === '1') {
    console.log('⏭️ HUSKY_SKIP_DOOM_LOOP_PARITY=1 ⇒ 跳过 doom-loop parity 对账(应急,须在提交说明写明原因)')
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 && argv[rootIdx + 1] ? path.resolve(argv[rootIdx + 1]) : ROOT
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    return 2
  }
  try {
    const res = runAudit(root, picked.face)
    if (argv.includes('--json')) {
      console.log(JSON.stringify({ face: picked.face, ...res }))
      if (res.undetermined.length > 0) return 2
      return res.problems.length > 0 ? 1 : 0
    }
    return report(res)
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定:${e.message}`)
      return 2
    }
    console.error(`❌ 脚本异常(不静默放行):${e?.message ?? e}`)
    return 2
  }
}

export const __test__ = {
  FILES,
  POLICY_NUMBERS,
  POLICY_STRINGS,
  POLICY_LISTS,
  parseTsPolicy,
  parsePyPolicy,
  decide,
  fixtureContents,
  readFace,
  runAudit,
  selfTest,
}

// §22d isDirectRun:被 import(镜像测试)时不得触发 main()。
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
