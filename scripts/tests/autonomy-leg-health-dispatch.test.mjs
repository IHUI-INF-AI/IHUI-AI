// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发起腿健康派发接线锁(2026-11-01 立)。
 *
 * 钉两件事,缺一即红:
 *  D 组 三态分桶不并桶:ok ⇒ 不发信;drift ⇒ 按尺子给的稳定 identity 去重发信;
 *     unjudged ⇒ 只写日志且不记绿;结论取不到 ⇒ judged:false,绝不冒充"已探测到健康"。
 *  W 组 调度器真的挂在守护执行体里(§0.9:判据"造好没装车"= 没有)。
 *     多会话并发常把热文件按旧基线写回 ⇒ 读**当次 HEAD 面**的 git-guardian.mjs,不读工作树副本。
 * 判据一律 import 被测实现,本文件零复算(§22c)。夹具每例独立 tick 文件(共用会被节律误判成"没跑")。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { sweepAutonomyLegHealth } from '../git-guardian.mjs'
// L 组直接 import 被测判据(§22c:镜像测试不复制判据)
import { __test__ as HEALTH } from '../check-autonomy-leg-health.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMP = join(ROOT, '.ihui-agent', 'tmp', 'goal-autonomy')
let pass = 0
let fail = 0
const ok = (n, c) => {
  if (c) pass++
  else {
    fail++
    console.log(`  ❌ ${n}`)
  }
}

let seq = 0
// tick 文件名必须每次运行都唯一:上一轮留下的 tick 会被节律窗拦住,
// 把"实现没发信"和"这轮压根没派生"读成同一件事(实测踩过一次)。
const RUN = Date.now()
const mkOpts = (stdout, extra = {}) => {
  seq++
  const mails = []
  const logs = []
  const res = sweepAutonomyLegHealth({
    now: Date.parse('2026-11-01T05:00:00.000Z') + seq,
    tickFile: join(TMP, `tick-${RUN}-${seq}.ts`),
    lastFile: join(TMP, `last-${RUN}-${seq}.json`),
    logger: (m) => logs.push(String(m)),
    notify: (title, body, opts) => mails.push({ title, body, opts }),
    runner: () => ({ status: 0, stdout, stderr: '' }),
    ...extra,
  })
  return { res, mails, logs }
}

const driftJson = JSON.stringify({
  verdict: 'drift',
  summary: 'OK=3 DRIFT=2 UNJUDGED=0',
  identity: 'autonomy-leg:drift:A2-attribution+A3-range:2',
  dims: [
    { dim: 'A1-preflight', state: 'ok', readout: '在位核验 2 枚全通过' },
    {
      dim: 'A2-attribution',
      state: 'drift',
      readout: '此刻仍被冤封的票 1 枚',
      next: '摘对应 quarantined 行',
    },
    {
      dim: 'A3-range',
      state: 'drift',
      readout: '封禁中 2 行',
      next: '逐行确认封禁是否源自调度器自身故障',
    },
  ],
})

const D1 = mkOpts(driftJson)
ok(
  'D1a drift ⇒ 发信且 dedupKey 用尺子的稳定 identity(不掺时刻/明细,§5e-3)',
  D1.res.judged === true &&
    D1.mails.length === 1 &&
    D1.mails[0].opts.dedupKey === 'autonomy-leg:drift:A2-attribution+A3-range:2',
)
ok(
  'D1b 信体带逐维点名 + 可执行出路(§5e-1 收信人读完知道能做什么)',
  String(D1.mails[0]?.body ?? '').includes('A2-attribution') &&
    String(D1.mails[0]?.body ?? '').includes('摘对应 quarantined 行'),
)
ok('D1c breaches 只数 drift 维,不掺 ok 维', D1.res.breaches === 2)
const D2 = mkOpts(
  JSON.stringify({
    verdict: 'ok',
    summary: 'OK=5 DRIFT=0 UNJUDGED=0',
    identity: 'autonomy-leg:ok:none:0',
    dims: [{ dim: 'A1-preflight', state: 'ok' }],
  }),
)
ok('D2 ok ⇒ 零发信', D2.res.judged === true && D2.mails.length === 0 && D2.res.breaches === 0)
const D3 = mkOpts(
  JSON.stringify({ verdict: 'unjudged', summary: 'OK=0 DRIFT=0 UNJUDGED=3', dims: [] }),
)
ok('D3 unjudged ⇒ 不发信也不记绿(judged:false)', D3.res.judged === false && D3.mails.length === 0)
const D4 = mkOpts('not json at all')
ok(
  'D4 结论不可解析 ⇒ judged:false,绝不冒充已探测(§0.3)',
  D4.res.judged === false && D4.mails.length === 0,
)
const D5 = mkOpts(driftJson, {
  runner: () => {
    throw new Error('spawn blew up')
  },
})
ok(
  'D5 变异:派生抛异常不得冒充健康(ran:false 且无 judged:true)',
  D5.res.ran === false && D5.res.judged !== true && D5.mails.length === 0,
)
const ticked = join(TMP, `tick-shared-${RUN}.ts`)
mkOpts(driftJson, { tickFile: ticked, now: Date.parse('2026-11-01T05:00:00.000Z') })
const D6 = sweepAutonomyLegHealth({
  now: Date.parse('2026-11-01T05:10:00.000Z'),
  intervalMs: 30 * 60 * 1000,
  tickFile: ticked,
  lastFile: join(TMP, 'last-shared.json'),
  logger: () => {},
  notify: () => {},
  runner: () => ({ status: 0, stdout: driftJson, stderr: '' }),
})
ok(
  'D6 节律:窗口内二次调用 ⇒ ran:false 不派生(空转零成本)',
  D6.ran === false && D6.why === '未到节流窗口',
)
const D7 = sweepAutonomyLegHealth({
  now: Date.parse('2026-11-01T05:40:00.000Z'),
  intervalMs: 30 * 60 * 1000,
  tickFile: ticked,
  lastFile: join(TMP, 'last-shared2.json'),
  logger: () => {},
  notify: () => {},
  runner: () => ({ status: 0, stdout: driftJson, stderr: '' }),
})
ok('D7 变异:超窗必须真派(节律判反了就是永不复查)', D7.ran === true && D7.judged === true)

// ---- W 组:接线面(§0.4 取材面纪律:索引 blob 优先 = 即将入库的那一面,回落 HEAD,再回落工作树) ----
const showFrom = (ref) => {
  try {
    return execFileSync('git', ['show', `${ref}:scripts/git-guardian.mjs`], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 26,
    })
  } catch {
    return ''
  }
}
let headFace = ''
let face = ''
const idx = showFrom('')
if (idx) {
  headFace = idx
  face = '索引'
} else {
  const h = showFrom('HEAD')
  if (h) {
    headFace = h
    face = 'HEAD'
  } else {
    headFace = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
    face = '工作树(索引与 HEAD 都取不到)'
  }
}
ok(
  `W1 派发函数已在 git-guardian 内定义(${face} 面现读)`,
  headFace.includes('export function sweepAutonomyLegHealth'),
)
ok(
  'W2 调用点已挂进守护执行体且有 !CHECK_ONLY 档(有定义无调用=判据没装车)',
  /if \(!CHECK_ONLY\) sweepAutonomyLegHealth\(\)/.test(headFace),
)
ok(
  'W3 尺子不在位档由代码路径自证:缺脚本即 ran:false 且不派生(该档不可从外部注入,故只做形状断言)',
  (() => {
    const src = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
    const fn = src.slice(src.indexOf('export function sweepAutonomyLegHealth'))
    const body = fn.slice(0, fn.indexOf('\nexport '))
    return (
      body.includes('if (!existsSync(script))') &&
      body.indexOf('return { ran: false, why:') < body.indexOf('publicProbeDue')
    )
  })(),
)
ok(
  'W4 头注自称的调度器关系必须与代码一致(§0.9 文档≠代码即红)',
  headFace.includes('check-autonomy-leg-health.mjs'),
)

// ─────────────────────────────────────────────────────────────────────────────
// L 组 —— A13-artifact-landing(2026-11-05 立):自治环"跑了十天、一枚没落"必须在账面可见。
// 立因:台账 248 行 / 10 天里 session-ok 9 枚、artifact-manifest-missing 9 枚、artifact-committed 0 枚,
// 而 A1-A12 全绿 —— 没有任何一维问"东西进没进 HEAD"。判据一律 import 被测实现(§22c 零复算)。
// ─────────────────────────────────────────────────────────────────────────────
const { judgeArtifactLanding, ARTIFACT_LANDED_ACTIONS, ARTIFACT_REJECT_ACTIONS } = HEALTH
const S13 = ['session-ok', 'session-no-write']
ok(
  'L1 词汇从阶梯那张表派生(落地档与拒绝档都非空,不在本器里拼第二份名单)',
  (() => {
    return (
      ARTIFACT_LANDED_ACTIONS.includes('artifact-committed') &&
      ARTIFACT_REJECT_ACTIONS.includes('artifact-manifest-missing') &&
      ARTIFACT_REJECT_ACTIONS.includes('artifact-manifest-invalid') &&
      !ARTIFACT_REJECT_ACTIONS.includes('session-ok')
    )
  })(),
)
ok(
  'L2 真况回放:9 枚会话结果档而落地档 0 ⇒ drift 且点名拒绝分布',
  (() => {
    const ev = []
    for (let i = 0; i < 9; i++) {
      ev.push({ action: 'session-ok', ticketKey: `k${i}`, ts: `2026-11-04T0${i}:00:00.000Z` })
      ev.push({
        action: 'artifact-manifest-missing',
        ticketKey: `k${i}`,
        ts: `2026-11-04T0${i}:00:05.000Z`,
      })
    }
    const r = judgeArtifactLanding(ev, { sessionResultActions: S13 })
    return (
      r.state === 'drift' &&
      r.readout.includes('artifact-manifest-missing×9') &&
      r.dim === 'A13-artifact-landing'
    )
  })(),
)
ok(
  'L3 有成对正向:同一份输入多一枚 artifact-committed ⇒ ok(判据不是恒拦)',
  (() => {
    const ev = [
      { action: 'session-ok', ticketKey: 'k1', ts: '2026-11-04T07:00:00.000Z' },
      { action: 'artifact-committed', ticketKey: 'k1', ts: '2026-11-04T07:10:00.000Z' },
    ]
    return judgeArtifactLanding(ev, { sessionResultActions: S13 }).state === 'ok'
  })(),
)
ok(
  'L4 三态不并桶:射程取不到 ⇒ unjudged;会话结果档为 0 ⇒ ok 但读数照实报零',
  (() => {
    const u = judgeArtifactLanding([], { sessionResultActions: null })
    const z = judgeArtifactLanding([{ action: 'no-ticket', ts: '2026-11-04T07:00:00.000Z' }], {
      sessionResultActions: S13,
    })
    return u.state === 'unjudged' && z.state === 'ok' && z.readout.includes('会话结果档 0 枚')
  })(),
)
ok(
  'L5 装载证明:尺子自己的 --self-test 由这一层真跑一次(全绿)',
  (() => {
    // 与 object-space-land 同一条纪律:77 例自检此前只住在"人工敲"那一档,红是静默的(§0.9)。
    // 末行例数现读,不硬抄数字(§0.1);不能用管道吞退出码。
    let rc = 0
    let out = ''
    try {
      out = execFileSync(
        process.execPath,
        [join(ROOT, 'scripts', 'check-autonomy-leg-health.mjs'), '--self-test'],
        {
          encoding: 'utf8',
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 600_000,
        },
      )
    } catch (e) {
      rc = typeof e.status === 'number' ? e.status : 1
      out = `${String(e.stdout ?? '')}${String(e.stderr ?? '')}`
    }
    const m = /self-test:\s*(\d+)\s*例全绿|self-test:\s*(\d+)\s*绿\s*\/\s*(\d+)\s*红/.exec(out)
    return rc === 0 && !!m && !!m[1]
  })(),
)

console.log(
  fail === 0
    ? `autonomy-leg dispatch lock: ${pass} 例全绿`
    : `autonomy-leg dispatch lock: ${pass} 绿 / ${fail} 红`,
)
process.exitCode = fail === 0 ? 0 : 1
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
