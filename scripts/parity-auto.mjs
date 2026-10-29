#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * parity-auto.mjs —— 跨端对齐「全自动管线」的唯一入口(默认只读驾驶舱,分三档授权才写盘)。
 *
 * 为什么要有它(2026-10-28 现读):web→RN→小程序的每一节链轮子都已单独造好 ——
 * 派生态写回 4 件(sync-rn-tokens / sync-rn-global-css / sync-miniapp-tokens / sync-miniapp-chrome)、
 * 声明链修复 1 件(repair-cross-end-mirror)、造页 2 件(gen-miniapp-mirror / gen-rn-shell-page)、
 * 壳落地 1 件(land-cross-end-shell-pages)、手写转壳规划 1 件(plan-hand-mirror-conversion)、
 * 判据门 4 件(93 tokens / 128 观感 / 237 覆盖 / 257 web↔RN 对账)。
 * 但**没有任何一处把它们串起来**:要回答"今天三端还差多少、哪几件该跑、哪些已能机器自修",
 * 只能靠人记 13 条命令名。轮子齐全而没有驾驶舱,结果就是轮子停着 —— 本器就是那个驾驶舱。
 *
 * 本器**零判据**(§0.6):一个判定都不自己算,只按依赖序调用既有器物、收集其退出码与结论行,
 * 再把「红灯里有多少带写回腿(机器可自修)」这一个比例算出来。任何一件器物报未判定(exit 2),
 * 整轮结论就记未判定,**绝不折成通过**(§0.3)。
 *
 * 三档授权(失效方向 = 多要一次定向说明,§0.10):
 *   默认(无旗)      全只读预演。任何写盘动作都不发生。
 *   `--apply`        只跑**派生态同步器**写回(tokens / chrome 四件:源头改了就派生,幂等,零裁量)。
 *   `--apply-decl`   额外修**声明链断点**(repair-cross-end-mirror:台账说镜像了、代码侧标记/路由掉了)。
 *   `--apply-gen`    额外放行**造页/壳落地**(gen-miniapp-mirror / land-cross-end-shell-pages)。
 *                    最重的一档:会新增页面文件与四处接缝,必须单独点名授权。
 *
 * 取材面:一律交给被调器物自己的默认面(HEAD blob),本器不另开第二个面(§0.4);
 * 需要看工作树时用 `--worktree`,只透传给**支持该旗的**器物,不支持的不给(给了会 exit 2)。
 *
 * Usage:
 *   node scripts/parity-auto.mjs                    # 驾驶舱:13 阶段全跑,只读
 *   node scripts/parity-auto.mjs --fast             # 跳过慢门(128 / 237),日常高频用
 *   node scripts/parity-auto.mjs --stage=tokens     # 只跑某组(sync / decl / gen / gate / all)
 *   node scripts/parity-auto.mjs --apply            # 派生态写回(安全档)
 *   node scripts/parity-auto.mjs --apply --apply-decl --apply-gen
 *   node scripts/parity-auto.mjs --json             # 机读(供定时任务/看板消费)
 *   node scripts/parity-auto.mjs --self-test        # 编排判据自检(不碰真仓)
 *
 * 退出码(§0.3):0 = 全绿;1 = 有红灯(带写回腿的会点明"可自修");2 = 至少一件未判定(不得记绿)。
 */
/* eslint-disable no-console -- CLI 驾驶舱,必须打印结论表 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// 门 193:显式 stdio 是本机 Windows EBUSY 的唯一防线,三通道一律给(简写键位形态亦被守门认)。
const STDIO = ['ignore', 'pipe', 'pipe']
// 单件器物的默认上限。门 128 在 8MB 台账 + 全仓 grep 下实测 40~90s,给 5 分钟。
const STAGE_TIMEOUT_MS = 300_000
/**
 * 造页/壳落地两件的上限必须高于默认值 —— 它们要逐屏读源码、判三腿、算分包预算,
 * 实测 107s 起步、机器一忙就到 300s(2026-10-28 19:5x 那轮 `land-shells` 恰好撞 300s 线,
 * 被记成"未判定"而它本身是能跑完的)。超时误判会把可用阶段说成未判定,与 §0.3 同性质。
 */
const STAGE_TIMEOUT_LONG_MS = 900_000

/**
 * 红灯能否被写回抹平 —— 只有「漂移态」可以。
 * 造页/造壳那两件的 exit 1 是判据拒绝(缺腿、撞面、端内私有能力),`--apply` 跑一百遍也还是 1;
 * `tokens-miniapp` 的写回实测会把它块外的多行选择器压成一行(破坏 prettier 格式),在写回器改好之前
 * 不能计入可自修档 —— 否则驾驶舱会一路指着一条"越修越脏"的路。
 */
const SELF_HEALABLE = new Set(['tokens-rn', 'tokens-rn-css', 'tokens-chrome', 'repair-mirror'])
const HEAL_BLOCKERS = {
  'tokens-miniapp': '写回会压平块外格式,待修写回器',
  'gen-mirror': '判据拒绝:缺腿/撞面/端内私有能力',
  'land-shells': '判据拒绝:壳三腿不齐或分包容量到顶',
}

/**
 * 阶段清单(按依赖序:先派生态、再声明链、再生成腿、最后判据门)。
 *  write  = 该件有写回腿(红灯可机器自修),也是 `--apply*` 三档的作用面。
 *  tier   = 写入授权档:token(默认 --apply 即放行) / decl / gen / null(只读)。
 *  slow   = `--fast` 时跳过。
 *  wt     = 支持 --worktree 透传。不支持的器物给了该旗会按"未判定"退出,不能乱给。
 */
export const STAGES = [
  {
    id: 'tokens-rn',
    group: 'sync',
    title: 'RN JS 令牌表 ← tokens.css',
    script: 'sync-rn-tokens.mjs',
    args: ['--check'],
    applyArgs: [],
    tier: 'token',
    wt: false,
  },
  {
    id: 'tokens-rn-css',
    group: 'sync',
    title: 'RN global.css ← tokens.css',
    script: 'sync-rn-global-css.mjs',
    args: ['--check'],
    applyArgs: [],
    tier: 'token',
    wt: false,
  },
  {
    id: 'tokens-miniapp',
    group: 'sync',
    title: '小程序 app.css/style.ts ← tokens.css',
    script: 'sync-miniapp-tokens.mjs',
    args: ['--check'],
    applyArgs: [],
    tier: 'token',
    wt: false,
  },
  {
    id: 'tokens-chrome',
    group: 'sync',
    title: '小程序原生 chrome(theme.json)',
    script: 'sync-miniapp-chrome.mjs',
    args: ['--check'],
    applyArgs: [],
    tier: 'token',
    wt: false,
  },
  {
    id: 'repair-mirror',
    group: 'decl',
    title: '镜像声明链断点(台账↔代码)',
    script: 'repair-cross-end-mirror.mjs',
    args: [],
    applyArgs: ['--apply'],
    tier: 'decl',
    wt: false,
  },
  {
    id: 'plan-hand',
    group: 'decl',
    title: '手写镜像页 → 壳承载(可转面)',
    script: 'plan-hand-mirror-conversion.mjs',
    args: [],
    applyArgs: [],
    tier: null,
    wt: false,
  },
  {
    id: 'gen-rn-shell',
    group: 'gen',
    title: '共享屏 → RN 宿主薄壳',
    script: 'gen-rn-host-shell.mjs',
    // --all 只取「seedable 且目标壳不存在」的屏;needs-manual 逐条点名缺哪条腿,不产半成品。
    args: ['--all'],
    applyArgs: ['--all', '--write', '--cap=2'],
    tier: 'gen',
    wt: false,
  },
  {
    id: 'gen-mirror',
    group: 'gen',
    title: '缺页 → 造镜像页 + 四处接缝(只读预演)',
    script: 'gen-miniapp-mirror.mjs',
    // 形制必须显式给 shell(端内不写布局与数据,复用 RN 壳);缺省档是旧文案骨架,只作对照、
    // 不是收口形制 —— 驾驶舱曾按缺省档跑,造出的页与"壳承载"方向相反。
    args: ['--all', '--form=shell'],
    applyArgs: [],
    // 刻意不设写回档:同一批 planned 已有唯一落地通道 = land-cross-end-shell-pages
    // (HEAD blob ⊕ 本批行 + 分包容量闸 + cap,走对象空间),由守护每轮派发;本器的 --apply
    // 会往工作树直写同一批接缝 = 第二条落地通道(§0.6「同类清单/取值实现全仓只许一份,第二份必然漂移」)。
    // 所以这一档在驾驶舱里永远只读,落地交给下面的 land-shells。
    tier: null,
    timeout: STAGE_TIMEOUT_LONG_MS,
    wt: false,
  },
  {
    id: 'land-shells',
    group: 'gen',
    title: '缺壳承载页 → 落 HEAD',
    script: 'land-cross-end-shell-pages.mjs',
    args: [],
    applyArgs: ['--apply'],
    tier: 'gen',
    timeout: STAGE_TIMEOUT_LONG_MS,
    wt: false,
  },
  {
    id: 'gate-tokens',
    group: 'gate',
    title: '门 93 三端颜色令牌',
    script: 'check-cross-end-tokens.mjs',
    args: [],
    applyArgs: [],
    tier: null,
    wt: false,
  },
  {
    id: 'gate-ui',
    group: 'gate',
    title: '门 128 跨端组件观感',
    script: 'check-cross-end-ui-parity.mjs',
    args: [],
    applyArgs: [],
    tier: null,
    wt: false,
    slow: true,
  },
  {
    id: 'gate-coverage',
    group: 'gate',
    title: '门 237 小程序屏覆盖',
    script: 'check-cross-end-screen-coverage.mjs',
    args: [],
    applyArgs: [],
    tier: null,
    wt: true,
    slow: true,
  },
  {
    id: 'gate-web-rn',
    group: 'gate',
    title: '门 257 web↔RN 对账',
    script: 'check-web-rn-parity.mjs',
    args: [],
    applyArgs: [],
    tier: null,
    wt: true,
    slow: true,
  },
]

/** 结论行抽取:优先取带结论语义的那行,否则取末行 —— 只做展示,不改任何判定。 */
export function summarize(stdout) {
  const lines = String(stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return ''
  const keyed = lines.filter((line) => /结论|通过|失败|判定|缺口|可转|漂移/.test(line))
  const pick = keyed.length > 0 ? keyed[keyed.length - 1] : lines[lines.length - 1]
  return pick.length > 120 ? `${pick.slice(0, 117)}…` : pick
}

/** 退出码 → 状态。null(超时/被杀)与其它非 0/1/2 值都按 error 处理,不冒充任何一档。 */
export function statusOf(code) {
  if (code === 0) return 'ok'
  if (code === 1) return 'red'
  if (code === 2) return 'undetermined'
  return 'error'
}

const ICON = { ok: '✅', red: '🔴', undetermined: '🟡', error: '⚡', skipped: '⏭' }

function parseArgs(argv) {
  const opts = {
    apply: false,
    applyDecl: false,
    applyGen: false,
    fast: false,
    json: false,
    wt: false,
    stage: 'all',
    selfTest: false,
  }
  for (const raw of argv) {
    if (raw === '--apply') opts.apply = true
    else if (raw === '--apply-decl') opts.applyDecl = true
    else if (raw === '--apply-gen') opts.applyGen = true
    else if (raw === '--fast') opts.fast = true
    else if (raw === '--json') opts.json = true
    else if (raw === '--worktree') opts.wt = true
    else if (raw === '--self-test') opts.selfTest = true
    else if (raw.startsWith('--stage=')) opts.stage = raw.slice('--stage='.length)
    else if (raw === '--help' || raw === '-h') opts.help = true
    else throw new Error(`未知参数:${raw}`)
  }
  return opts
}

/** 写入授权:三档只增不减,高档同时包含低档(与「多要一次定向说明」同向)。 */
function tierAllowed(tier, opts) {
  // 返回值必须是布尔:自检传入的部分 opts 只有单个键,`a || b` 在两键皆缺时给出 undefined,
  // 会静默把"未授权"读成"真值未知"(自检首跑就抓到这两格)。
  if (tier === null) return false
  if (tier === 'token') return Boolean(opts.apply || opts.applyDecl || opts.applyGen)
  if (tier === 'decl') return Boolean(opts.applyDecl || opts.applyGen)
  if (tier === 'gen') return Boolean(opts.applyGen)
  return false
}

function runStage(stage, opts) {
  const scriptPath = join(ROOT, 'scripts', stage.script)
  if (!existsSync(scriptPath)) {
    // 器物不在盘上 ⇒ 未判定,不记绿也不冒红(§0.3)。这是分支谱系差异的常见形态。
    return { ...stage, status: 'undetermined', summary: `器物不在盘上: scripts/${stage.script}` }
  }
  const write = tierAllowed(stage.tier, opts)
  const args = write ? [...stage.args, ...stage.applyArgs] : [...stage.args]
  if (opts.wt && stage.wt) args.push('--worktree')
  const startedAt = Date.now()
  const res = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: STDIO,
    timeout: stage.timeout ?? STAGE_TIMEOUT_MS,
    windowsHide: true,
  })
  const status = statusOf(res.status)
  const tail = res.status === 1 || status === 'error' ? res.stderr : res.stdout
  return {
    ...stage,
    status,
    write,
    args,
    elapsedMs: Date.now() - startedAt,
    summary: summarize(tail) || summarize(res.stdout) || summarize(res.stderr),
  }
}

function selectStages(opts) {
  const wanted = opts.stage === 'all' ? null : opts.stage.split(',').map((s) => s.trim())
  return STAGES.filter((stage) => {
    if (wanted && !wanted.includes(stage.group) && !wanted.includes(stage.id)) return false
    if (opts.fast && stage.slow) return false
    return true
  })
}

/** 一条自检:只验编排自身的两处口径(状态映射 / 授权分档),不读仓库。 */
function selfTest() {
  const cases = [
    ['statusOf(0)', statusOf(0), 'ok'],
    ['statusOf(1)', statusOf(1), 'red'],
    ['statusOf(2)', statusOf(2), 'undetermined'],
    ['statusOf(null)', statusOf(null), 'error'],
    ['token 档在 --apply 下放行', tierAllowed('token', { apply: true }), true],
    ['decl 档在 --apply 下不放行', tierAllowed('decl', { apply: true }), false],
    ['gen 档在 --apply-decl 下不放行', tierAllowed('gen', { applyDecl: true }), false],
    ['gen 档在 --apply-gen 下放行', tierAllowed('gen', { applyGen: true }), true],
    ['只读档永不写', tierAllowed(null, { applyGen: true }), false],
    [
      'gen-mirror 预演形制含 --form=shell(缺省档是旧骨架,不许回退)',
      (STAGES.find((s) => s.id === 'gen-mirror')?.args ?? []).includes('--form=shell'),
      true,
    ],
    [
      'gen-mirror 不设写回档(落地通道唯一 = land-shells,走对象空间)',
      STAGES.find((s) => s.id === 'gen-mirror')?.tier === null,
      true,
    ],
    [
      '链条三段齐:RN 薄壳 → 镜像页 → 壳页落地(缺一格则新屏无人产)',
      ['gen-rn-shell', 'gen-mirror', 'land-shells'].every((id) => STAGES.some((s) => s.id === id)),
      true,
    ],
  ]
  let failed = 0
  for (const [name, actual, expected] of cases) {
    if (actual !== expected) {
      failed += 1
      console.error(`✗ ${name}: 期望 ${expected},实得 ${actual}`)
    }
  }
  console.log(
    failed === 0
      ? `✅ 自检 ${cases.length}/${cases.length} 通过`
      : `✗ 自检失败 ${failed}/${cases.length}`,
  )
  return failed === 0 ? 0 : 1
}

function renderTable(results) {
  const head = ['组', '阶段', '结果', '耗时', '摘要']
  const rows = results.map((r) => [
    r.group,
    r.title,
    `${ICON[r.status] ?? '?'}${r.write ? '(写)' : ''}`,
    r.elapsedMs === undefined ? '—' : `${(r.elapsedMs / 1000).toFixed(1)}s`,
    r.summary || '—',
  ])
  const widths = head.map((h, i) =>
    Math.max(h.length * 2, ...rows.map((row) => (row[i] ?? '').length)),
  )
  const line = (cells) =>
    cells.map((cell, i) => cell + ' '.repeat(Math.max(0, widths[i] - cell.length))).join('  ')
  return [line(head), widths.map((w) => '─'.repeat(w)).join('  '), ...rows.map(line)].join('\n')
}

function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`✗ ${error.message}`)
    return 2
  }
  if (opts.help) {
    console.log(
      '用法:node scripts/parity-auto.mjs [--fast] [--stage=sync|decl|gen|gate] [--apply] [--apply-decl] [--apply-gen] [--worktree] [--json] [--self-test]',
    )
    return 0
  }
  if (opts.selfTest) return selfTest()

  const stages = selectStages(opts)
  if (stages.length === 0) {
    console.error('✗ 选定阶段为 0 ⇒ 未判定(检查 --stage 拼写)')
    return 2
  }

  const results = stages.map((stage) => ({
    ...runStage(stage, opts),
    healable: SELF_HEALABLE.has(stage.id),
    healBlockedBy: HEAL_BLOCKERS[stage.id],
  }))
  const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
  const reds = results.filter((r) => r.status === 'red')
  // 「有写回腿」≠「红灯能自修」:造页器的 exit 1 是**判据拒绝**(缺腿/撞面/私有能力),`--apply` 也消不掉;
  // 而漂移态的红灯是真能被写回抹平的。两档混算会把"需人判"报成"可自修",失效方向错误(§0.10)。
  const autoFixable = reds.filter((r) => r.healable === true)
  const needsHuman = reds.filter((r) => r.healable !== true)

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          at: new Date().toISOString(),
          writeTier: { apply: opts.apply, decl: opts.applyDecl, gen: opts.applyGen },
          counts,
          results,
        },
        null,
        2,
      ),
    )
  } else {
    console.log('\n🔗 跨端自动同步管线(web → RN → 小程序)\n' + '─'.repeat(72))
    console.log(renderTable(results))
    console.log('─'.repeat(72))
    console.log(
      `阶段 ${results.length}:✅${counts.ok ?? 0} 🔴${counts.red ?? 0} 🟡${counts.undetermined ?? 0} ⚡${counts.error ?? 0}`,
    )
    console.log(
      ` · 红灯可机器自修(漂移态):${autoFixable.length}${autoFixable.length > 0 ? ` — ${autoFixable.map((r) => r.id).join(', ')}` : ''}`,
    )
    console.log(
      ` · 红灯需人判(判据拒绝/无写回腿):${needsHuman.length}${needsHuman.length > 0 ? ` — ${needsHuman.map((r) => `${r.id}${r.healable === false ? `(${r.healBlockedBy ?? '写回消不掉'})` : ''}`).join(', ')}` : ''}`,
    )
    if (counts.undetermined > 0 || counts.error > 0) {
      console.log('🟡 有阶段未判定:按 §0.3 本轮不得记绿,需看摘要逐件排查。')
    }
    if (autoFixable.length > 0) {
      console.log(
        '💡 可自修的红灯:node scripts/parity-auto.mjs --apply(派生态) / --apply-decl(声明链)',
      )
    }
  }

  if ((counts.undetermined ?? 0) > 0 || (counts.error ?? 0) > 0) return 2
  return (counts.red ?? 0) > 0 ? 1 : 0
}

const invokedDirectly = (() => {
  // Windows 下 process.argv[1] 是盘符路径(`D:\…`),`new URL(…,'file:')` 解不出 file: 协议 ⇒
  // 必须走 pathToFileURL 归一后再比(实测自检首跑静默不执行,就是这个差异)。
  try {
    return pathToFileURL(process.argv[1] ?? '').href === import.meta.url
  } catch {
    return false
  }
})()

if (invokedDirectly) process.exitCode = main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
