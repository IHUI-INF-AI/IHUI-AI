// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `check-downloads-live-health.mjs` 的镜像测试(§22c:判据 import 源脚本本体,本文件零复制判据)。
 *
 * 分工:三态与两轮确认的**判据夹具**在尺子自己的 `--self-test`(现读 13 例)里;本文件钉的是
 * ① 判据出口可被 import 且行为与头注一致(成对:正常 vs 少一格),② 调度器真的装车(两处执行体 +
 * 派生三件套),③ 反向锁:它刻意**不**注册进提交链(挂上去就是把上一席落下的漂移定责给下一席)。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { __test__ as H } from '../check-downloads-live-health.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARDIAN = path.join(ROOT, 'scripts', 'git-guardian.mjs')
const RUNNER = path.join(ROOT, 'scripts', 'guardian-runner.mjs')
const RULER = path.join(ROOT, 'scripts', 'check-downloads-live-health.mjs')

const now = Date.parse('2026-11-03T09:30:00.000Z')
const mk = (over = {}) => {
  const end = (o) => ({ source: 'live', version: '9.9.9', resolvedAt: new Date(now - 60_000).toISOString(), assets: [{ sizeBytes: 1234 }], ...o })
  const d = {
    desktop: end({}),
    'android-apk': end({}),
    mobile: end({ assets: undefined }),
    ios: end({}),
    cli: end({ assets: undefined }),
    extension: end({}),
    'wechat-miniapp': end({ version: undefined }),
    web: { source: 'unavailable', reason: H.WEB_REASON, resolvedAt: new Date(now - 60_000).toISOString() },
  }
  for (const [k, v] of Object.entries(over)) {
    if (v === null) delete d[k]
    else d[k] = v
  }
  return { generatedAt: new Date(now - 90_000).toISOString(), downloads: d }
}

test('H1 成对锁:八端齐备且新鲜 ⇒ ok;把任一必备端打成 unavailable ⇒ 立即红(摘掉判据即翻绿)', () => {
  const ok = H.judge({ doc: mk(), now, prev: null })
  assert.equal(ok.state, 'ok', `正常读数不该报任何东西:${JSON.stringify(ok.findings)}`)
  assert.equal(ok.readings.length, 7, `应逐端留 7 行读数(web 属设计如此,不进必备集):${ok.readings.length}`)
  const bad = H.judge({
    doc: mk({ 'android-apk': { source: 'unavailable', reason: 'no-latest-row' } }),
    now,
    prev: null,
  })
  assert.equal(bad.state, 'red', '必备端掉到 unavailable ⇒ 当轮就红,不等第二轮')
  assert.ok(bad.findings.some((f) => f.id === 'android-apk:end-unavailable' && f.immediate === true))
})

test('H2 抖动不许喊人:snapshot 第一轮只 pending,同判据第二轮才升级', () => {
  const snap = { ios: { source: 'snapshot', reason: 'fetch-timeout' } }
  const first = H.judge({ doc: mk(snap), now, prev: null })
  assert.equal(first.state, 'ok', '一次网络抖动不得喊人(§5e:重复告警是缺陷)')
  assert.deepEqual(first.pending, ['ios:end-snapshot'])
  const second = H.judge({
    doc: mk(snap),
    now,
    prev: { findings: [{ id: 'ios:end-snapshot' }], states: { ios: 'live' } },
  })
  assert.equal(second.state, 'red', '同一条判据连续两轮 ⇒ 必须升级到人')
})

test('H3 未判定不并桶:两臂都无响应 ⇒ unjudged,既不记绿也不冒红', async () => {
  const r = await H.runCheck({ now, prev: null, readImpl: async () => ({ doc: null, tried: ['source:AbortError', 'public:AbortError'] }) })
  assert.equal(r.state, 'unjudged')
  assert.match(r.reason, /取不到/)
  assert.deepEqual(r.tried, ['source:AbortError', 'public:AbortError'], '未判定必须点名是哪两臂')
})

test('H4 新鲜度先重试一次:第一次 stale、第二把新鲜 ⇒ 不误报(SWR 返回旧副本不是故障)', async () => {
  let calls = 0
  const staleDoc = (() => {
    const d = mk()
    const old = new Date(now - 4 * 60 * 60 * 1000).toISOString()
    d.generatedAt = old
    for (const v of Object.values(d.downloads)) if (v.resolvedAt) v.resolvedAt = old
    return d
  })()
  const r = await H.runCheck({
    now,
    prev: null,
    wait: async () => {},
    readImpl: async () => {
      calls += 1
      return { doc: calls === 1 ? staleDoc : mk(), tried: [`mock${calls}`] }
    },
  })
  assert.equal(calls, 2, 'stale 必须先重试一次再判')
  assert.ok(!r.findings.some((f) => f.kind === 'stale-payload'), '第二把新鲜了还报 stale ⇒ 假阳')
})

test('H5 取数臂:本机源站必须在公网臂之前,且两臂都问得到同一出口', () => {
  const a = H.arms()
  assert.equal(a[0].label, 'source')
  assert.match(a[0].url, /^http:\/\/127\.0\.0\.1:8801\/downloads\.json$/)
  assert.equal(a[1].label, 'public')
  assert.ok(a[0].timeoutMs < a[1].timeoutMs, '本机臂超时必须更短(同机答不上来就别再等)')
  assert.ok(a.every((x) => /\/downloads\.json$/.test(x.url)), '两臂必须问同一个出口,否则判的不是用户看到的那份')
})

test('W1 装车锁:调度器在 git-guardian 两处执行体都挂上,派生三件套齐备', () => {
  const g = readFileSync(GUARDIAN, 'utf8')
  assert.match(g, /export function sweepDownloadsLiveHealth\(/, '调度器函数不在位')
  const calls = [...g.matchAll(/^[ \t]*(?:if \(!CHECK_ONLY\) )?sweepDownloadsLiveHealth\(\)/gm)].length
  assert.ok(calls >= 2, `挂点只有 ${calls} 处,应 ≥2(main 单轮 + daemon tick)`)
  assert.match(g, /'check-downloads-live-health\.mjs'/, '调度器没引用本尺子')
  const body = g.slice(g.indexOf('export function sweepDownloadsLiveHealth'))
  const seg = body.slice(0, body.indexOf('\nexport ', 10) > 0 ? body.indexOf('\nexport ', 10) : 7000)
  assert.match(seg, /'--json'/, '必须走 --json 档(形状由本文件钉住,派发侧不复写判据)')
  assert.match(seg, /stdio:\s*\['ignore',\s*'pipe',\s*'pipe'\]/, '§12g 派生必须显式接管 stdio')
  assert.match(seg, /timeout:/, '守门 80:热路径派生一律带上限')
  assert.match(seg, /windowsHide:\s*true/)
  assert.match(g, /^ {2}sweepDownloadsLiveHealth,$/m, '未导出给镜像测试(测试只能自造判据 = §22c 禁止)')
})

test('W2 行为锁:red 一封信且身份只取「类别+计数档」;unjudged 绝不写台账;ok 零投递', async () => {
  const Gd = await import('../git-guardian.mjs')
  const dir = mkScratch('dlbar-')
  const mails = []
  const logs = []
  const tickFile = path.join(dir, 'tick.ts')
  const stateFile = path.join(dir, 'state.json')
  const writeFile = (p, s) => writeFileSync(p, s, 'utf8')
  let round = 0
  const runWith = (doc) => ({
    now,
    // 每轮各自一把节流戳:否则第 2 次调用会被"未到节流窗口"短路,断言读到的是一台没跑过的机器
    tickFile: path.join(dir, `tick-${(round += 1)}.ts`),
    stateFile,
    logger: (m) => logs.push(String(m)),
    notify: (s, b, meta) => mails.push({ s, b, meta }),
    writeFile,
    runner: () => ({ out: JSON.stringify(doc), status: doc.state === 'red' ? 1 : 0 }),
  })
  try {
    const red = Gd.sweepDownloadsLiveHealth(
      runWith({
        state: 'red',
        findings: [{ id: 'cli:no-version', kind: 'no-version', detail: 'live 但版本号为空', immediate: true }],
        readings: [{ platform: 'cli', source: 'live' }],
        tried: ['source:200'],
        agesMs: {},
      }),
    )
    assert.equal(red.state, 'red')
    assert.equal(mails.length, 1)
    assert.equal(mails[0].meta.dedupKey, 'downloads-health;red=2', '身份不得含时刻/sha/原始计数(§5e-3)')
    assert.match(mails[0].b, /node scripts\/check-downloads-live-health\.mjs --json/, '到人必须给可执行下一步(§5e-1)')
    assert.ok(existsSync(stateFile), '判出结论的一轮必须落台账,供下一轮做两轮确认')
    mails.length = 0
    const un = Gd.sweepDownloadsLiveHealth(
      runWith({ state: 'unjudged', reason: '两臂都无响应', findings: [], readings: [], tried: ['source:E', 'public:E'] }),
    )
    assert.equal(un.state, 'undetermined')
    assert.equal(mails.length, 0, '未判定不得喊人')
    assert.ok(logs.some((l) => /不记绿/.test(l)), '未判定要在日志里写明不记绿')
    rmSync(stateFile, { force: true })
    const never = path.join(dir, 'never.json')
    const un2 = Gd.sweepDownloadsLiveHealth({ ...runWith({ state: 'unjudged', reason: 'x', findings: [], readings: [] }), stateFile: never })
    assert.equal(un2.state, 'undetermined')
    assert.equal(existsSync(never), false, '没判成的一轮不许写台账(把"没判"洗成"没问题")')
    mails.length = 0
    const ok = Gd.sweepDownloadsLiveHealth(
      runWith({ state: 'ok', findings: [], pending: ['ios:end-snapshot'], readings: [{ platform: 'cli', source: 'live' }], tried: ['source:200'] }),
    )
    assert.equal(ok.state, 'ok')
    assert.equal(mails.length, 0, 'ok 不得投递')
    assert.ok(logs.some((l) => /待第二轮确认/.test(l)), 'pending 要在日志里报出来,不许静默吞掉')
  } finally {
    rmScratch(dir)
  }
})

test('W4 节流锁:同一把节流戳的第二次调用必须短路,不得每 10 秒 tick 就重判一次(§5e 噪声)', async () => {
  const Gd = await import('../git-guardian.mjs')
  const dir = mkScratch('dlbar-tq-')
  try {
    const shared = path.join(dir, 'tick.ts')
    let runs = 0
    // 节流戳是**真实文件系统 mtime**,所以这一档必须用墙上时钟当基准;
    // 用固定历史时刻会让"now - mtime"是负数 ⇒ 第一次调用就被读成未到窗口。
    const t0 = Date.now()
    const mk = (nowMs) => ({
      now: nowMs,
      tickFile: shared,
      stateFile: path.join(dir, 'st.json'),
      logger: () => {},
      notify: () => {},
      writeFile: (p, s) => writeFileSync(p, s, 'utf8'),
      runner: () => {
        runs += 1
        return { out: JSON.stringify({ state: 'ok', findings: [], readings: [], tried: ['source:200'] }), status: 0 }
      },
    })
    const first = Gd.sweepDownloadsLiveHealth(mk(t0))
    assert.equal(first.state, 'ok')
    const second = Gd.sweepDownloadsLiveHealth(mk(t0 + 60_000))
    assert.equal(second.ran, false, '1 分钟后就重判 ⇒ 节流没生效')
    assert.equal(second.why, '未到节流窗口')
    assert.equal(runs, 1, `尺子被派生了 ${runs} 次`)
    const later = Gd.sweepDownloadsLiveHealth(mk(t0 + Gd.DOWNLOADS_HEALTH_INTERVAL_MS + 1000))
    assert.equal(later.state, 'ok', '超过窗口必须又能跑')
    assert.equal(runs, 2)
  } finally {
    rmScratch(dir)
  }
})

test('W3 反向锁:本尺子刻意不注册进 guardian-runner(挂提交链即 §12e 恒红门)', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  assert.equal(
    (runner.match(/script:\s*'check-downloads-live-health\.mjs'/g) ?? []).length,
    0,
    '它判的是"站点当下有没有在刷新/某端此刻拿不拿得到数",提交者结构上补不动 ⇒ 挂成提交门就是恒红逼人跳门',
  )
  const ruler = readFileSync(RULER, 'utf8')
  assert.match(ruler, /不进提交链/, '头注必须写明档位(守护巡检)')
  assert.doesNotMatch(ruler, /已接线.*提交链|blocking,stagedTriggers/, '头注不得自称已接提交链')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
