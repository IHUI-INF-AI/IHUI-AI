// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check:all 的串行编排器 —— 跑完全部子步骤再汇总(台账票 G-816501,原名 G-815996)。
 *
 * 为什么在仓里(不是把 `&&` 换成 `;` 就完事):根 package.json 的 `check:all` 此前是 26 条子步骤的
 * `&&` 串链。`&&` 的语义是"前一条非零即终止整条链",于是链条中间任何一步判红之后,**它后面的所有步骤
 * 当天等于从没跑过**,而调用方只看到那一条红 —— 这正是本仓最高频的失效型:"判据没跑"与"跑完全绿"
 * 在账面上长得一模一样(参见同名族:守门 70/76/81/115、AGENTS §12f)。低透明度告警形(如
 * `check:api-routes:warn`)红不起作用,但真判红的那一步会把其后 8 条 blocking 判据一起抹掉。
 *
 * 三条不可漂的写法:
 *  ① **任一子步骤失败不短路后续步骤** —— 每条都真的派生一次,逐条打印 `▶ [n/N] <命令>` 与
 *     `■ [n/N] rc=…`,所以"后面那几条到底跑没跑"可从输出里逐条读出来,不必相信汇总行。
 *  ② **末尾汇总失败清单并以非零退出码结束** —— 三条结论分开算:失败(rc != 0)/ 未跑完(超时或派生失败)/
 *     通过。"未跑完"绝不并入"通过",也绝不并入"失败"(那是两件不同的事:一条是判据判红,一条是判据
 *     根本没给出结论),但两者都参与退出码。
 *  ③ 子步骤清单是本器唯一的真相源,`--print-steps` 把它按 JSON 吐出来,便于与改前的 `&&` 串链逐条对账
 *     (证明"没有为了变绿删掉任何一步"是量出来的,不是声称的)。
 *
 * 取证通道 `--step <序号>=<命令>`:把某一步换成别的命令再跑整条链,用来构造"链条中间某步失败"的现场
 * (阳性对照不得依赖某道门真的在红 —— 那是把仓库现状当成判据的一部分)。它只用于取证:命中即打印
 * `[取证覆盖]` 行,且汇总行末尾追加"本次有 N 步被取证覆盖 ⇒ 结论不代表仓库状态",无从静默。
 * 本器**不**提供跳过某步的通道 —— 跳过与短路是同一个毛病。
 *
 * 退出码:0 = 全部通过且无未跑完;1 = 有失败;2 = 编排器自身用法/环境错(含"一条子步骤都没枚举到",
 * 空扫不记绿)。
 */

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** 直接执行时的入口(为空则说明本文件被当作断言目标跑,不进 CLI 主流程)。 */
const entryArg = process.argv[1] || ''

/** 子步骤清单:逐字取自改前 `check:all` 的 `&&` 串链(26 条),顺序与集合都不得增删。 */
export const CHECK_ALL_STEPS = Object.freeze([
  'pnpm check:conflict-markers',
  'pnpm check:api-key-leak',
  'pnpm check:i18n-keys',
  'pnpm check:i18n-locale-content-language',
  'pnpm check:stale-dist',
  'pnpm check:db-schema-drift',
  'pnpm check:sanitizer-bypass',
  'pnpm check:api-routes:warn',
  'pnpm check:safe-parse',
  'pnpm check:nav-dead-links',
  'pnpm check:popover-trigger-data-state',
  'pnpm check:miniapp-parity',
  'pnpm check:miniapp-generated',
  'pnpm check:rn-parity',
  'pnpm check:cross-end-tokens',
  'pnpm check:adapter-parity',
  'pnpm check:killer-parity-ends',
  'node scripts/scan-dead-i18n-keys.mjs --target all --exit 1',
  'pnpm check:auth-refresh-singleton',
  'node scripts/check-agent-event-parity.mjs',
  'pnpm check:desktop-event-wiring',
  'pnpm check:dep-links:strict',
  'pnpm check:merge-loss',
  'node scripts/check-prod-bundle-shadow.mjs',
  'pnpm check:sdk-publish',
  'pnpm check:artifact-budget',
])

/** 单步子上限:默认 25 分钟(全量档里最慢的是逐 blob 取材的那几道门)。 */
const STEP_TIMEOUT_MS = Number(process.env.IHUI_CHECK_ALL_STEP_TIMEOUT_MS || 25 * 60 * 1000)

/**
 * @typedef {{ index:number, command:string, state:'pass'|'fail'|'incomplete', rc:number|null,
 *   reason:string, overridden:boolean, ms:number }} StepResult
 */

/**
 * 派生一条子步骤。三态在这里就分岔:`error` 与 SIGTERM/SIGKILL 都是"没给出结论",不是"判绿"。
 * @param {number} index 1 起的序号
 * @param {string} command 交给 shell 的整条命令
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {StepResult}
 */
export function runStep(index, command, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? STEP_TIMEOUT_MS
  const started = Date.now()
  console.log(`\n▶ [${index}] ${command}`)
  const res = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    timeout: timeoutMs,
    // AGENTS §5b:shell:true 的派生必须显式 windowsHide,否则为每条子步骤拉起可见控制台窗口。
    windowsHide: true,
    env: process.env,
  })
  const ms = Date.now() - started
  /** @type {StepResult} */
  let out
  if (res.error && res.status === null && res.signal === null) {
    out = {
      index,
      command,
      state: 'incomplete',
      rc: null,
      reason: `派生失败:${res.error.message}`,
      overridden: false,
      ms,
    }
  } else if (res.signal) {
    out = {
      index,
      command,
      state: 'incomplete',
      rc: null,
      reason: `被 ${res.signal} 终止(未给出结论;超时上限 ${timeoutMs}ms 时按此形态呈现)`,
      overridden: false,
      ms,
    }
  } else {
    const rc = typeof res.status === 'number' ? res.status : null
    out = {
      index,
      command,
      state: rc === 0 ? 'pass' : 'fail',
      rc,
      reason: rc === 0 ? 'ok' : `rc=${rc}`,
      overridden: false,
      ms,
    }
  }
  console.log(`■ [${index}] ${out.state} ${out.reason}(${(ms / 1000).toFixed(1)}s)`)
  return out
}

/**
 * 把 `--step <n>=<cmd>` 的覆盖落到子步骤清单上,返回"实际要跑的那份清单 + 被覆盖的序号"。
 * 序号越界 ⇒ 抛错(静默忽略一个写错的序号,等于取证跑了一场没跑过的现场)。
 * @param {string[]} overrides
 * @param {readonly string[]} base
 * @returns {{ plan: {index:number, command:string, overridden:boolean}[], overridden: number[] }}
 */
export function applyOverrides(overrides, base = CHECK_ALL_STEPS) {
  /** @type {Map<number, string>} */
  const byIndex = new Map()
  for (const spec of overrides) {
    const eq = spec.indexOf('=')
    if (eq <= 0) throw new Error(`--step 需写成 --step <序号>=<命令>,实得:${spec}`)
    const rawIdx = spec.slice(0, eq).trim()
    const idx = Number(rawIdx)
    if (!Number.isInteger(idx) || idx < 1 || idx > base.length) {
      throw new Error(`--step 的序号越界或不是整数:${rawIdx}(合法范围 1..${base.length})`)
    }
    const cmd = spec.slice(eq + 1).trim()
    if (!cmd) throw new Error(`--step ${rawIdx} 的覆盖命令为空`)
    byIndex.set(idx, cmd)
  }
  const plan = base.map((command, i) => {
    const idx = i + 1
    const hit = byIndex.get(idx)
    if (hit === undefined) return { index: idx, command, overridden: false }
    console.log(`[取证覆盖] 第 ${idx} 步的 "${command}" 被换成了 "${hit}"`)
    return { index: idx, command: hit, overridden: true }
  })
  return { plan, overridden: [...byIndex.keys()].sort((a, b) => a - b) }
}

/**
 * 汇总三态并给出退出码。纯函数,便于构造面证明"中间失败 ⇒ 后续仍计为已跑"。
 * @param {StepResult[]} results
 * @returns {{ passed:number, failed:StepResult[], incomplete:StepResult[], exitCode:number }}
 */
export function aggregate(results) {
  const failed = results.filter((r) => r.state === 'fail')
  const incomplete = results.filter((r) => r.state === 'incomplete')
  const passed = results.length - failed.length - incomplete.length
  return {
    passed,
    failed,
    incomplete,
    exitCode: failed.length > 0 || incomplete.length > 0 ? 1 : 0,
  }
}

/**
 * @param {StepResult[]} results
 * @param {number[]} overriddenIndices
 * @returns {string[]} 汇总行(不含退出码语义,只把人该看见的东西逐条报名)
 */
export function summaryLines(results, overriddenIndices = []) {
  const agg = aggregate(results)
  const lines = [
    '',
    '==== check:all 汇总 ====',
    `子步骤总数 ${results.length} / 通过 ${agg.passed} / 失败 ${agg.failed.length} / 未跑完 ${agg.incomplete.length}`,
  ]
  if (agg.failed.length > 0) {
    lines.push('失败清单(判据给出非零结论):')
    for (const f of agg.failed) lines.push(`  ✗ 第 ${f.index} 步 ${f.command} → ${f.reason}`)
  }
  if (agg.incomplete.length > 0) {
    lines.push('未跑完清单(判据没给出结论 —— 与"通过"不是一回事):')
    for (const f of agg.incomplete) lines.push(`  ? 第 ${f.index} 步 ${f.command} → ${f.reason}`)
  }
  if (overriddenIndices.length > 0) {
    lines.push(
      `[取证覆盖] 本次有 ${overriddenIndices.length} 步被替换(序号 ${overriddenIndices.join(', ')})⇒ 以上结论不代表仓库状态`,
    )
  }
  return lines
}

/** 阳性对照的构造面:三步链,中间那步真失败;走的是与正式跑同一条 runStep/aggregate 路径。 */
const SYNTHETIC_BASE = [
  'node -e "process.stdout.write(\'step-1 ran\\n\'); process.exit(0)"',
  'node -e "process.stdout.write(\'step-2 ran-and-failed\\n\'); process.exit(7)"',
  'node -e "process.stdout.write(\'step-3 ran\\n\'); process.exit(0)"',
]

/**
 * @returns {number} 0 = 三条判据都成立;1 = 有一条形不成立(编排器短路了后续步骤)
 */
function runSynthetic() {
  const { plan, overridden } = applyOverrides([], SYNTHETIC_BASE)
  const results = plan.map((p) => runStep(p.index, p.command))
  const agg = aggregate(results)
  const ranAll = results.length === SYNTHETIC_BASE.length && results.every((r) => r.rc !== null)
  const thirdRan = results[2] !== undefined && results[2].rc === 0
  const nonzero = agg.exitCode !== 0
  const named = agg.failed.length === 1 && agg.failed[0].index === 2
  const checks = [
    ['(a) 后续步骤确实跑了(第 3 步 rc=0)', thirdRan && ranAll],
    ['(b) 最终退出码非 0', nonzero],
    ['(c) 失败步骤被点名(且只点名它)', named],
    ['(d) 三条合成步骤都不被记为未跑完', agg.incomplete.length === 0 && overridden.length === 0],
  ]
  console.log('')
  console.log('==== 阳性对照(构造面:三步链,中间那步 exit 7)====')
  let bad = 0
  for (const [name, ok] of checks) {
    if (!ok) bad += 1
    console.log(`${ok ? '✅' : '❌'} ${name}`)
  }
  return bad === 0 ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  /** @type {string[]} */
  const overrides = []
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--print-steps') {
      console.log(JSON.stringify(CHECK_ALL_STEPS, null, 2))
      return 0
    }
    if (a === '--synthetic') return runSynthetic()
    if (a === '--self-test') return runSelfTest()
    if (a === '--step') {
      const next = argv[i + 1]
      if (!next) {
        console.error('❌ --step 后面要跟 <序号>=<命令>')
        return 2
      }
      overrides.push(next)
      i += 1
      continue
    }
    if (a.startsWith('--step=')) {
      overrides.push(a.slice('--step='.length))
      continue
    }
    console.error(`❌ 未知参数:${a}(可用:--print-steps / --synthetic / --self-test / --step <n>=<cmd>)`)
    return 2
  }

  if (CHECK_ALL_STEPS.length === 0) {
    console.error('❌ 子步骤清单为空 ⇒ 判死不记绿(空扫就是本器要防的同一型故障)')
    return 2
  }
  const { plan, overridden } = applyOverrides(overrides, CHECK_ALL_STEPS)
  const results = plan.map((p) => {
    const r = runStep(p.index, p.command)
    r.overridden = p.overridden
    return r
  })
  for (const line of summaryLines(results, overridden)) console.log(line)
  const agg = aggregate(results)
  return agg.exitCode
}

/**
 * 自检:判据的断言一律**立即求值**(AGENTS「自检 harness 的 cond 必须是已求值的布尔」那一条 ——
 * 把箭头函数当 cond 传进 `!!cond` 型登记器,得到的是"这个函数对象存在"而不是"这条断言成立")。
 * @returns {number}
 */
function runSelfTest() {
  /** @type {[string, boolean][]} */
  const cases = [
    [
      'A1 中间失败不吞掉后续结果(三态计数各归各)',
      (() => {
        /** @type {StepResult[]} */
        const rs = [
          { index: 1, command: 'a', state: 'pass', rc: 0, reason: 'ok', overridden: false, ms: 1 },
          { index: 2, command: 'b', state: 'fail', rc: 1, reason: 'rc=1', overridden: false, ms: 1 },
          { index: 3, command: 'c', state: 'pass', rc: 0, reason: 'ok', overridden: false, ms: 1 },
        ]
        const a = aggregate(rs)
        return a.passed === 2 && a.failed.length === 1 && a.incomplete.length === 0 && a.exitCode === 1
      })(),
    ],
    [
      'A2 未跑完(超时)既不记绿也不记成判据红,但参与退出码',
      (() => {
        /** @type {StepResult[]} */
        const rs = [
          { index: 1, command: 'a', state: 'pass', rc: 0, reason: 'ok', overridden: false, ms: 1 },
          {
            index: 2,
            command: 'b',
            state: 'incomplete',
            rc: null,
            reason: '被 SIGTERM 终止',
            overridden: false,
            ms: 1,
          },
        ]
        const a = aggregate(rs)
        return (
          a.passed === 1 && a.failed.length === 0 && a.incomplete.length === 1 && a.exitCode === 1
        )
      })(),
    ],
    [
      'A3 全通过 ⇒ 退出码 0',
      (() => {
        /** @type {StepResult[]} */
        const rs = [
          { index: 1, command: 'a', state: 'pass', rc: 0, reason: 'ok', overridden: false, ms: 1 },
        ]
        return aggregate(rs).exitCode === 0
      })(),
    ],
    [
      'A4 汇总行点名失败步骤的序号与命令',
      (() => {
        /** @type {StepResult[]} */
        const rs = [
          {
            index: 18,
            command: 'node x.mjs',
            state: 'fail',
            rc: 1,
            reason: 'rc=1',
            overridden: false,
            ms: 1,
          },
        ]
        const joined = summaryLines(rs).join('\n')
        return joined.includes('第 18 步') && joined.includes('node x.mjs')
      })(),
    ],
    [
      'A5 取证覆盖必须被打印且不静默',
      (() => {
        const { plan, overridden } = applyOverrides(['3=echo hi'], ['a', 'b', 'c'])
        const lines = summaryLines([
          { index: 1, command: 'a', state: 'pass', rc: 0, reason: 'ok', overridden: false, ms: 1 },
        ], overridden).join('\n')
        return (
          plan[2].command === 'echo hi' &&
          plan[2].overridden === true &&
          plan[0].command === 'a' &&
          lines.includes('取证覆盖')
        )
      })(),
    ],
    [
      'A6 越界序号拒绝而不是忽略',
      (() => {
        try {
          applyOverrides(['99=echo hi'], ['a', 'b'])
          return false
        } catch {
          return true
        }
      })(),
    ],
    [
      'A7 子步骤清单是 26 条且含那条死链上的第 18 步',
      (() =>
        CHECK_ALL_STEPS.length === 26 &&
        CHECK_ALL_STEPS[17] === 'node scripts/scan-dead-i18n-keys.mjs --target all --exit 1')(),
    ],
    [
      'A8 空清单判死而不是记绿(main 侧的判据面)',
      (() => {
        const a = aggregate([])
        return a.passed === 0 && a.exitCode === 0 && a.failed.length === 0
      })(),
    ],
  ]
  let bad = 0
  for (const [name, ok] of cases) {
    if (typeof ok !== 'boolean') {
      console.log(`❌ ${name} —— cond 不是布尔,断言从未求值`)
      bad += 1
      continue
    }
    if (!ok) bad += 1
    console.log(`${ok ? '✅' : '❌'} ${name}`)
  }
  console.log(`\nself-test: ${cases.length - bad}/${cases.length} 通过`)
  return bad === 0 ? 0 : 1
}

export const __test__ = { runStep, aggregate, summaryLines, applyOverrides, CHECK_ALL_STEPS }

// AGENTS §22d:CLI 直跑与被 import 双形态必须隔离副作用,且 Windows 反斜杠路径要经 pathToFileURL 归一。
const isDirectRun =
  !!entryArg && import.meta.url === pathToFileURL(process.argv[1] ? resolve(entryArg) : '').href

if (isDirectRun) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`❌ 编排器自身异常(不是判据结论):${e && e.message ? e.message : String(e)}`)
    process.exitCode = 2
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
