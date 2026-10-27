// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 三条新腿的调度器镜像测试(2026-10-27 立):
 *   A `healI18nBundleLeg`  —— 守门 105 G5(离线语言包自述钉)的写回出口调度器
 *   B `auditPushDivergenceLeg` —— 本地↔origin 分叉的到人腿(此前全仓零报警覆盖)
 *   C `healMirrorPurgeLeg` —— 守门 238 `--fix` 的调度器
 *
 * 钉死的是本仓那一型:**「造好没装车 = 没有」**(§0.9)。判据、器物、文档都在而没人调度,
 * 失效形态永远是安静。所以每一格都双向锁:①行为三态(动/喊/未判定)不许互相冒充;②挂点与出口
 * 真在派发链上(摘掉即翻红)。
 *
 * 夹具契约(§22c):结论体一律由**生产方自己的出口**现造(lib 的 classifyDivergence / buildAlertIdentity、
 * 门 238 的结论行),测试不手抄 state 字面量之外的任何键义。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import {
  auditPushDivergenceLeg,
  healI18nBundleLeg,
  healMirrorPurgeLeg,
  __test__ as G,
} from '../git-guardian.mjs'
import { __test__ as WATCH } from '../lib/push-divergence-watch.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

const collector = () => {
  const lines = []
  return [(s) => lines.push(String(s)), lines]
}

/** 一把只给节流用的临时落点(生产默认台账文件不碰,免得测试污染真节拍) */
function tick() {
  const dir = mkScratch('legs-tick-')
  return { dir, file: join(dir, 'tick.json') }
}

/* ───────────────────────── A:离线包自走重生成 ───────────────────────── */

test('L1 landed ⇒ 写一行 ✅ 并把器物自述的 changed/paths 带上(不静默)', () => {
  const t = tick()
  try {
    const [logger, lines] = collector()
    const r = healI18nBundleLeg({
      tickFile: t.file,
      logger,
      runner: () => ({
        status: 0,
        stdout: JSON.stringify({
          state: 'landed',
          changed: 955000,
          paths: ['a', 'b', 'c'],
          detail: '已落 HEAD',
        }),
        stderr: '',
      }),
    })
    assert.equal(r.state, 'landed')
    assert.equal(lines.length, 1, `landed 必须留一行,实得 ${lines.length} 行`)
    assert.match(lines[0], /离线包自走重生成 state=landed/)
    assert.match(lines[0], /changed=955000/)
  } finally {
    rmScratch(t.dir)
  }
})

test('L2 clean ⇒ 一行都不写(30 分钟一轮的常态若写日志就是噪声),且真的派生了一次', () => {
  const t = tick()
  try {
    let runs = 0
    const [logger, lines] = collector()
    const r = healI18nBundleLeg({
      tickFile: t.file,
      logger,
      runner: () => {
        runs += 1
        return {
          status: 0,
          stdout: JSON.stringify({ state: 'clean', detail: '钉与现算同值' }),
          stderr: '',
        }
      },
    })
    assert.equal(r.state, 'clean')
    assert.equal(runs, 1, 'clean 也要真跑过器物,否则"clean"是猜的')
    assert.equal(lines.length, 0, `clean 不该写日志,实得:${lines.join(' / ')}`)
  } finally {
    rmScratch(t.dir)
  }
})

test('L3 器物没回结论 ⇒ 判"未判定"并 ⚠️ 点名,既不记绿也不冒红(§0.3)', () => {
  const t = tick()
  try {
    const [logger, lines] = collector()
    const r = healI18nBundleLeg({
      tickFile: t.file,
      logger,
      runner: () => ({ status: null, stdout: '', stderr: 'boom' }),
    })
    assert.equal(r.state, 'undetermined')
    assert.equal(lines.length, 1)
    assert.match(lines[0], /未判定/)
    assert.match(lines[0], /boom/)
  } finally {
    rmScratch(t.dir)
  }
})

test('L4 refused 也留痕:拒落属常态但不能看不见(与"clean 即静默"分档)', () => {
  const t = tick()
  try {
    const [logger, lines] = collector()
    const r = healI18nBundleLeg({
      tickFile: t.file,
      logger,
      runner: () => ({
        status: 3,
        stdout: JSON.stringify({ state: 'refused', detail: '在飞副本闸:3 份', paths: [] }),
        stderr: '',
      }),
    })
    assert.equal(r.state, 'refused')
    assert.match(lines.join('\n'), /在飞副本闸/)
  } finally {
    rmScratch(t.dir)
  }
})

test('L5 节流:窗口内第二次不得再派生器物(每 30 分钟一轮,不是每 2 分钟)', () => {
  const t = tick()
  try {
    let runs = 0
    const runner = () => {
      runs += 1
      return { status: 0, stdout: JSON.stringify({ state: 'clean' }), stderr: '' }
    }
    const first = healI18nBundleLeg({
      tickFile: t.file,
      now: 1_700_000_000_000,
      logger: () => {},
      runner,
    })
    const second = healI18nBundleLeg({
      tickFile: t.file,
      now: 1_700_000_000_000 + 60_000,
      logger: () => {},
      runner,
    })
    assert.equal(first.ran, true)
    assert.equal(second.ran, false, `未到窗口还派生 = 每 2 分钟跑一次重生成,守护会被自己拖死`)
    assert.equal(runs, 1)
  } finally {
    rmScratch(t.dir)
  }
})

/* ───────────────────────── B:推送分叉到人 ───────────────────────── */

/** 用生产方自己的分类器造结论(测试不手写 band/state) */
function breachVerdict(counts) {
  return WATCH.classifyDivergence({
    originPresent: true,
    localHead: 'aaaaaaa1111111111',
    remoteSha: 'bbbbbbb2222222222',
    localAhead: counts.localAhead,
    remoteAhead: counts.remoteAhead,
    remoteIsAncestorOfHead: false,
    pushState: null,
    unresolved: [],
  })
}

test('L6 breach ⇒ 到人,且正文自带可照抄的下一步(§5e-1 可整改性准入)', () => {
  const t = tick()
  try {
    const notified = []
    const v = breachVerdict({ localAhead: 121, remoteAhead: 331 })
    assert.equal(v.state, 'breach', `夹具本身要先成立:实得 ${v.state}`)
    const r = auditPushDivergenceLeg({
      tickFile: t.file,
      logger: () => {},
      watcher: () => ({ verdict: v }),
      notify: (name, detail, opts) => {
        notified.push({ name, detail, opts })
        return { sent: true }
      },
    })
    assert.equal(r.state, 'breach')
    assert.equal(notified.length, 1, 'breach 必须到人')
    assert.ok(
      String(notified[0].opts.dedupKey ?? '').length > 0,
      '必须按稳定身份去重(不传等于按明细抖)',
    )
    assert.match(
      notified[0].detail,
      /出路|下一步/,
      `信里必须给能动手的一条,实际:${notified[0].detail}`,
    )
  } finally {
    rmScratch(t.dir)
  }
})

test('L7 同一场分叉计数怎么抖都不换身份;换了分档才算新故障(守门 224 同型)', () => {
  const a = WATCH.buildAlertIdentity(breachVerdict({ localAhead: 121, remoteAhead: 331 }), {
    now: 1,
  })
  const b = WATCH.buildAlertIdentity(breachVerdict({ localAhead: 122, remoteAhead: 335 }), {
    now: 2,
  })
  assert.equal(a.dedupKey, b.dedupKey, `计数抖动换了身份:${a.dedupKey} → ${b.dedupKey}`)
  assert.notEqual(
    breachVerdict({ localAhead: 3, remoteAhead: 0 }).state,
    'breach',
    '反向对照:单纯小积压不该响',
  )
})

test('L8 ok / unjudged / 尺子抛 ⇒ 一律不寄信(失效方向是"少喊一次",不是"多放一次")', () => {
  const mk = (watcher) => {
    const notified = []
    const t = tick()
    return [
      () => {
        const r = auditPushDivergenceLeg({
          tickFile: t.file,
          logger: () => {},
          watcher,
          notify: () => {
            notified.push(1)
            return { sent: true }
          },
        })
        return { r, mailed: notified.length }
      },
      t,
    ]
  }
  const cases = [
    [
      'ok',
      () => ({
        verdict: WATCH.classifyDivergence({
          originPresent: true,
          localHead: 'x',
          remoteSha: 'x',
          localAhead: 0,
          remoteAhead: 0,
          remoteIsAncestorOfHead: true,
          pushState: null,
          unresolved: [],
        }),
      }),
    ],
    [
      'unjudged',
      () => ({
        verdict: WATCH.classifyDivergence({
          originPresent: false,
          localHead: '',
          remoteSha: '',
          localAhead: null,
          remoteAhead: null,
          remoteIsAncestorOfHead: null,
          pushState: null,
          unresolved: [{ key: 'originRemote', why: '没有 origin' }],
        }),
      }),
    ],
    [
      'throw',
      () => {
        throw new Error('尺子炸了')
      },
    ],
  ]
  for (const [name, watcher] of cases) {
    const [run, t] = mk(watcher)
    try {
      const { r, mailed } = run()
      assert.notEqual(r.state, 'breach', `${name} 不该被判成 breach`)
      assert.equal(mailed, 0, `${name} 寄了信 = 与内容无关的恒响(§12e)`)
      if (name !== 'ok')
        assert.match(
          String(r.state),
          /undetermined|unjudged/,
          `${name} 必须落未判定档,实得 ${r.state}`,
        )
    } finally {
      rmScratch(t.dir)
    }
  }
})

/* ───────────────────────── C:镜像徽章自愈 ───────────────────────── */

test('L9 门 238 --fix 的结论行按生产方形态解析:clean+0 静默,有改动/有拒落留痕,读不到=未判定', () => {
  const one = (stdout) => {
    const t = tick()
    const [logger, lines] = collector()
    const r = healMirrorPurgeLeg({
      tickFile: t.file,
      logger,
      runner: () => ({ status: 0, stdout, stderr: '' }),
    })
    rmScratch(t.dir)
    return { r, lines }
  }
  const quiet = one('MIRROR-PURGE-FIX-RESULT state=clean fixed=0 refused=0 clean=10\n')
  assert.equal(quiet.r.state, 'clean')
  assert.equal(quiet.lines.length, 0, '健康仓上每 30 分钟写一行等于噪声')
  const acted = one('MIRROR-PURGE-FIX-RESULT state=fixed fixed=2 refused=0 clean=8\n')
  assert.equal(acted.r.state, 'fixed')
  assert.equal(acted.lines.length, 1, '真改了文档必须留痕')
  const refused = one('MIRROR-PURGE-FIX-RESULT state=refused fixed=0 refused=3 clean=7\n')
  assert.match(refused.lines.join('\n'), /refused=3/)
  const none = one('随便一行没有结论后缀\n')
  assert.equal(none.r.state, 'undetermined')
  assert.match(none.lines.join('\n'), /未判定/)
})

/* ───────────────────────── 装车锁(摘掉即翻红) ───────────────────────── */

test('L10 装车锁:三条腿都真挂在 !CHECK_ONLY 派发链上,且都在 __test__ 出口里(§0.9)', () => {
  for (const fn of ['healI18nBundleLeg', 'auditPushDivergenceLeg', 'healMirrorPurgeLeg']) {
    assert.match(SRC, new RegExp(`if \\(!CHECK_ONLY\\) ${fn}\\(\\)`), `${fn} 必须在巡检轮里被调用`)
    assert.equal(typeof G[fn], 'function', `${fn} 必须进 __test__ 出口(镜像测试反查用)`)
    // 反向对照:调用点必须在派发链那一段(而不是只活在定义里)
    const callIdx = SRC.indexOf(`if (!CHECK_ONLY) ${fn}()`)
    const defIdx = SRC.indexOf(`export function ${fn}(`)
    assert.ok(callIdx > 0 && defIdx > 0 && callIdx > defIdx, `${fn} 的调用点应在定义之后且真在链上`)
  }
})

test('L12 selectFace 的返回是 {face,error} 形态:器物必须取 .face 并处理 error(实测踩过"未知判定面 [object Object]")', () => {
  const s = readFileSync(resolve(import.meta.dirname, '..', 'heal-i18n-bundle.mjs'), 'utf8')
  assert.match(
    s,
    /const sel = selectFace\(/,
    '必须接住整个返回体,不能把 selectFace 的返回直接当面名用',
  )
  assert.match(s, /const face = sel\.face/, '面名必须从 sel.face 取')
  assert.match(s, /if \(sel\.error\)/, '两旗同给必须显式退 2,不许带病往下跑')
})

test('L11 三条腿一律不进提交链(判机器状态 ⇒ §12e),节流窗口都能用 env 覆盖', () => {
  const runnerFiles = [
    'scripts/guardian-runner.mjs',
    'scripts/lib/pre-commit-hook.js',
    '.husky/pre-commit',
  ]
  for (const f of runnerFiles) {
    const src = readFileSync(resolve(import.meta.dirname, '..', '..', f), 'utf8')
    assert.doesNotMatch(
      src,
      /heal-i18n-bundle\.mjs/,
      `${f} 不该把离线包重生成挂进提交链(一次要跑分钟级)`,
    )
    assert.doesNotMatch(src, /push-divergence-watch/, `${f} 不该把只读探测挂进提交链`)
  }
  for (const envName of [
    'IHUI_I18N_HEAL_INTERVAL_MS',
    'IHUI_PUSH_WATCH_INTERVAL_MS',
    'IHUI_MIRROR_FIX_INTERVAL_MS',
  ]) {
    assert.ok(SRC.includes(envName), `${envName} 必须可调(现场节律与阈值都要现读)`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
