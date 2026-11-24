// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 落地通道独占停滞判定的镜像锁(2026-11-06 立,判据 import 源模块,零复算 §22c)。
 *
 * 六格各有成对反例。核心是别把"未判定"喊成事故,也别把"活着但挂死"当成正常持有:
 * 本机现读两型(ETIMEDOUT 探针失败 / pid=5552 活着且 meta 无心跳、锁龄 1901s)后果一样 ——
 * 整条旁路落地通道无限期独占,而**没有任何一档替它喊人**。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  judgeLandingLock,
  shouldAnnounceLockStall,
  LOCK_STALL_DEFAULT_MS,
} from '../lib/landing-lock-stall.mjs'

const NOW = Date.parse('2026-11-06T05:00:00.000Z')
const meta = (o) => JSON.stringify(o)
const aliveTrue = () => true
const aliveFalse = () => false

test('① 锁不在场 = free;在场但 meta 读不到 = unjudged(两态不得并桶)', () => {
  const free = judgeLandingLock({ lockExists: false, nowMs: NOW })
  assert.equal(free.state, 'free')
  assert.equal(shouldAnnounceLockStall(free), false)
  for (const bad of [null, undefined, '', '   ']) {
    const u = judgeLandingLock({ lockExists: true, metaText: bad, nowMs: NOW })
    assert.equal(u.state, 'unjudged', `meta 取不到(${String(bad)})不能读成空闲或停滞`)
    assert.equal(shouldAnnounceLockStall(u), false, '未判定不喊成告警')
  }
  assert.equal(judgeLandingLock({ lockExists: true, metaText: '{坏', nowMs: NOW }).state, 'unjudged')
})

test('② 未到门限 = held(不喊);到门限且持有者活着 = stall(必须喊)', () => {
  const held = judgeLandingLock({
    lockExists: true,
    metaText: meta({ unitId: 'object-space-land', pid: 111, ts: NOW - 60_000, pidStart: 's' }),
    nowMs: NOW,
    pidAlive: aliveTrue,
  })
  assert.equal(held.state, 'held')
  assert.equal(shouldAnnounceLockStall(held), false)
  const stall = judgeLandingLock({
    lockExists: true,
    metaText: meta({ unitId: 'object-space-land', pid: 5552, ts: NOW - 1901_000, host: '服务器' }),
    nowMs: NOW,
    pidAlive: aliveTrue,
    metaMtimeMs: NOW - 1885_000, // 本机现读形态:mtime ≈ 锁龄 ⇒ 没有心跳续期
  })
  assert.equal(stall.state, 'stall', stall.why)
  assert.equal(shouldAnnounceLockStall(stall), true)
  assert.equal(stall.ageMs, 1901_000)
  assert.equal(stall.identityVerifiable, false, 'meta 缺 pidStart 必须显式报出来(等待方连唯一例外都走不到)')
  assert.match(stall.why, /无心跳续期/)
})

test('③ 有心跳的长活 = stall-heartbeat(仍喊,但成因句不同)', () => {
  const r = judgeLandingLock({
    lockExists: true,
    metaText: meta({ pid: 777, ts: NOW - 30 * 60_000, pidStart: 'x' }),
    metaMtimeMs: NOW - 5_000,
    nowMs: NOW,
    pidAlive: aliveTrue,
  })
  assert.equal(r.state, 'stall-heartbeat')
  assert.equal(shouldAnnounceLockStall(r), true)
  assert.match(r.why, /心跳续期/)
  assert.equal(r.identityVerifiable, true, 'pidStart 在场时不得误报"身份不可核"')
})

test('④ 持有者已退出 = residual:点名但不冒充回收决定', () => {
  const r = judgeLandingLock({
    lockExists: true,
    metaText: meta({ pid: 4242, ts: NOW - 40 * 60_000, pidStart: 'y' }),
    nowMs: NOW,
    pidAlive: aliveFalse,
  })
  assert.equal(r.state, 'residual')
  assert.equal(shouldAnnounceLockStall(r), true)
  assert.match(r.why, /git-lock 原语/, '回收归原语,本档只喊 —— 不在这里开后门')
})

test('⑤ 死活取不到 = unjudged(不喊事故也不喊正常);门限坏值一律 unjudged 且点名', () => {
  const u = judgeLandingLock({
    lockExists: true,
    metaText: meta({ pid: 999, ts: NOW - 60 * 60_000, pidStart: 'z' }),
    nowMs: NOW,
    pidAlive: null,
  })
  assert.equal(u.state, 'unjudged')
  assert.equal(shouldAnnounceLockStall(u), false)
  for (const badCap of [0, -1, '20m', null, NaN]) {
    const r = judgeLandingLock({
      lockExists: true,
      metaText: meta({ pid: 1, ts: NOW - 24 * 3600_000, pidStart: 'z' }),
      nowMs: NOW,
      pidAlive: aliveTrue,
      stallMs: badCap,
    })
    assert.equal(r.state, 'unjudged', `门限 ${String(badCap)} 不是正毫秒数时不得判停滞`)
  }
})

test('⑥ 缺省门限必须有出处,且 ts 取不到时算不出龄(不把 NaN 当"很旧"或"很新")', () => {
  assert.equal(LOCK_STALL_DEFAULT_MS, 20 * 60 * 1000)
  const r = judgeLandingLock({
    lockExists: true,
    metaText: meta({ pid: 1, pidStart: 'z' }),
    nowMs: NOW,
    pidAlive: aliveTrue,
  })
  assert.equal(r.state, 'unjudged')
  assert.equal(r.ageMs, null, '锁龄算不出 ⇒ 必须是 null,不能是 NaN 也不是 0')
})

test('⑦ 挂死(wedged)按 CPU 增量判,这一维不依赖 pidStart(本机 05:07Z 现读形态)', () => {
  const base = {
    lockExists: true,
    // 真实现场:meta 没有 pidStart ⇒ 身份三元组那条路永远走不到
    metaText: meta({ unitId: 'object-space-land', pid: 5552, ts: NOW - 46 * 60_000, host: '服务器' }),
    metaMtimeMs: NOW - 46 * 60_000 + 16_000,
    nowMs: NOW,
    pidAlive: aliveTrue,
  }
  const w = judgeLandingLock({ ...base, cpuDeltaMs: 0, cpuSampleGapMs: 45_000 })
  assert.equal(w.state, 'wedged', w.why)
  assert.equal(shouldAnnounceLockStall(w), true)
  assert.equal(w.identityVerifiable, false)
  assert.match(w.why, /CPU 增量仅 0ms/, '读数必须把"多少秒里多少毫秒"原样说出来')
  assert.match(w.why, /只有这一维还能判/, '必须点明"pidStart 不可核时唯一可得的证据是 CPU 增量"')
  assert.match(w.why, /回收决定仍归 git-lock 原语/, '本档只喊人,不在这里开后门')
})

test('⑧ 成对反向:同样超龄但在耗 CPU 的是合法长活,不得被判成 wedged', () => {
  const busy = judgeLandingLock({
    lockExists: true,
    metaText: meta({ pid: 1234, ts: NOW - 46 * 60_000, pidStart: 'p' }),
    metaMtimeMs: NOW - 46 * 60_000 + 16_000,
    nowMs: NOW,
    pidAlive: aliveTrue,
    cpuDeltaMs: 41_000,
    cpuSampleGapMs: 45_000,
  })
  assert.notEqual(busy.state, 'wedged', '45s 里烧掉 41s CPU 就是在做事,不能喊挂死')
  assert.equal(busy.state, 'stall', busy.why)
  // 采样间隔不足 ⇒ 不算证据(单次读数什么也证明不了)
  const thin = judgeLandingLock({
    lockExists: true,
    metaText: meta({ pid: 1235, ts: NOW - 46 * 60_000, pidStart: 'p' }),
    nowMs: NOW,
    pidAlive: aliveTrue,
    cpuDeltaMs: 0,
    cpuSampleGapMs: 5_000,
  })
  assert.notEqual(thin.state, 'wedged', '5 秒间隔不足以判挂死:门限 CPU_MIN_GAP_MS 必须生效')
  // cpu 取不到 ⇒ 退回原判定,不猜
  const noCpu = judgeLandingLock({
    lockExists: true,
    metaText: meta({ pid: 1236, ts: NOW - 46 * 60_000, pidStart: 'p' }),
    nowMs: NOW,
    pidAlive: aliveTrue,
    cpuDeltaMs: null,
    cpuSampleGapMs: 45_000,
  })
  assert.notEqual(noCpu.state, 'wedged', 'CPU 增量取不到 ⇒ 不得凭缺省判挂死,也不得凭缺省放行')
})

test('⑨ 未到门限的零 CPU 不喊(保守侧:一次 syscall 静默不等于死锁)', () => {
  const r = judgeLandingLock({
    lockExists: true,
    metaText: meta({ pid: 1237, ts: NOW - 90_000, pidStart: 'p' }),
    nowMs: NOW,
    pidAlive: aliveTrue,
    cpuDeltaMs: 0,
    cpuSampleGapMs: 45_000,
  })
  assert.equal(r.state, 'held')
  assert.equal(shouldAnnounceLockStall(r), false)
})

/**
 * ⑩—⑫ 消费端(落地器等待路径)—— 判据写成一档却没人调用 = 没有(§0.9),所以这三支钉的是
 * **装车本身**:`noteLandLockStall` 必须真读锁面、真按判据分型、真把该喊的那一型落成一行机读账面,
 * 且在不该喊时**一行都不写**。夹具一律走 `mkScratch`(§15b:工作树内不落临时 git/夹具)。
 */
test('⑩ held 不喊也不写账面(消费端:门限未到 ⇒ 只有读数,没有账面,没有放行)', async (t) => {
  const { mkScratch, rmScratch } = await import('../lib/scratch-dir.mjs')
  const { noteLandLockStall } = await import('../object-space-land.mjs')
  const dir = mkScratch('llstall-held')
  try {
    const nowMs = 1_793_900_000_000
    const lockDir = `${dir}/state/object-space-land.lock`
    const { mkdirSync, writeFileSync, existsSync, readFileSync } = await import('node:fs')
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(
      `${lockDir}/meta.json`,
      JSON.stringify({ unitId: 'object-space-land', pid: process.pid, ts: nowMs - 1000, host: 'x' }),
    )
    const ledger = `${dir}/stall.jsonl`
    const logs = []
    const v = noteLandLockStall({
      dir: lockDir,
      landLock: { waitedMs: 90000 },
      env: { IHUI_LAND_LOCK_STALL_MS: '1200000' },
      log: (s) => logs.push(s),
      ledgerPath: ledger,
      now: () => new Date(nowMs),
    })
    assert.equal(v.state, 'held')
    assert.equal(existsSync(ledger), false, '不该喊 ⇒ 账面必须压根不存在(写一行 held 就是把噪声记账)')
    assert.match(logs.join('\n'), /本轮不喊/, '不喊也要留一句可核对的读数,不能静默返回')
  } finally {
    rmScratch('llstall-held')
  }
})

test('⑪ stall 落 1 行账面:ASCII 键 + ISO 时刻 + state 正确,且**不动锁目录**(只喊不放行)', async (t) => {
  const { mkScratch, rmScratch } = await import('../lib/scratch-dir.mjs')
  const { noteLandLockStall } = await import('../object-space-land.mjs')
  const { mkdirSync, writeFileSync, readFileSync, readdirSync } = await import('node:fs')
  const dir = mkScratch('llstall-stall')
  try {
    const nowMs = 1_793_900_000_000
    const lockDir = `${dir}/state/object-space-land.lock`
    mkdirSync(lockDir, { recursive: true })
    // meta 缺 pidStart ⇒ 身份不可核(本机现读形态),ts 距今 40 分钟 ⇒ 超 20 分钟缺省门限
    const metaBody = JSON.stringify({
      unitId: 'object-space-land',
      pid: process.pid,
      ts: nowMs - 40 * 60 * 1000,
      host: 'x',
      leaseToken: 'abc',
    })
    writeFileSync(`${lockDir}/meta.json`, metaBody)
    // mtime 必须摆回"封条当时"那一格:上面 writeFileSync 把 mtime 写成"现在",而判据用
    // `mtime - ts > 60s` 认心跳 ⇒ 不摆回去就是在拿夹具自己造的心跳读数测 stall 那一档(假绿/假红双向都可能)。
    const { utimesSync } = await import('node:fs')
    const beat = new Date(nowMs - 40 * 60 * 1000 + 1000)
    utimesSync(`${lockDir}/meta.json`, beat, beat)
    const ledger = `${dir}/stall.jsonl`
    const logs = []
    const v = noteLandLockStall({
      dir: lockDir,
      landLock: { waitedMs: 90000 },
      env: {},
      log: (s) => logs.push(s),
      ledgerPath: ledger,
      now: () => new Date(nowMs),
    })
    assert.equal(v.state, 'stall', `超门限 + 持有者活着 + 无 CPU 采样 ⇒ stall,不得冒充 wedged,得:${v.state}`)
    assert.equal(v.identityVerifiable, false, 'meta 缺 pidStart 必须被如实报成身份不可核')
    const lines = readFileSync(ledger, 'utf8').split('\n').filter((x) => x !== '')
    assert.equal(lines.length, 1, `该喊的那一型必须恰好落 1 行,实得 ${lines.length}`)
    const row = JSON.parse(lines[0])
    assert.equal(row.source, 'object-space-land')
    assert.equal(row.state, 'stall')
    assert.equal(/^\d{4}-\d{2}-\d{2}T/.test(row.at), true, `时刻必须是 ISO,实得 ${row.at}`)
    assert.equal(Object.keys(row).every((k) => /^[a-zA-Z]+$/.test(k)), true, '键一律 ASCII(§5e-3 同一条)')
    assert.equal(row.waitedMs, 90000, '等待方实际等了多久必须可核算')
    assert.deepEqual(
      readdirSync(lockDir).sort(),
      ['meta.json'],
      '本函数只读不写锁目录:回收决定归 git-lock 原语',
    )
    assert.equal(readFileSync(`${lockDir}/meta.json`, 'utf8'), metaBody, 'meta 逐字节不得被改')
    assert.match(logs.join('\n'), /只喊人,不代裁/)
  } finally {
    rmScratch('llstall-stall')
  }
})

test('⑫ 未知 state 不出行:buildStallRow 拒绝伪造,resolveStallMs 坏值回落而不读成无限', async (t) => {
  const { __test__ } = await import('../lib/landing-lock-stall.mjs')
  assert.equal(__test__.buildStallRow({ nowIso: 'x', verdict: { state: 'wedged-ish' } }), null)
  assert.equal(__test__.buildStallRow({ nowIso: '', verdict: { state: 'stall' } }), null)
  assert.equal(__test__.buildStallRow({ nowIso: '2026-11-06T00:00:00.000Z', verdict: null }), null)
  const ok = __test__.buildStallRow({
    nowIso: '2026-11-06T00:00:00.000Z',
    verdict: { state: 'stall', ageMs: 5, pid: 7, identityVerifiable: false },
  })
  assert.equal(ok.state, 'stall')
  // 门限:缺省 / 合法 env / 坏 env(0、负数、非数字)—— 坏值必须回落且**把为什么带回去**
  assert.equal(__test__.resolveStallMs({}).stallMs, __test__.LOCK_STALL_DEFAULT_MS)
  assert.equal(__test__.resolveStallMs({ IHUI_LAND_LOCK_STALL_MS: '60000' }).stallMs, 60000)
  for (const bad of ['0', '-5', 'abc', '']) {
    const r = __test__.resolveStallMs({ IHUI_LAND_LOCK_STALL_MS: bad })
    assert.equal(r.stallMs, __test__.LOCK_STALL_DEFAULT_MS, `坏值 ${bad} 不得被读成无限或立刻喊`)
    if (bad !== '') assert.ok(r.why !== '', `坏值 ${bad} 必须点名为什么没吃到旗`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
