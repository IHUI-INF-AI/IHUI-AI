#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:推送分叉探测器(scripts/lib/push-divergence-watch.mjs)
 *
 * 纪律(§0.6 / §22c):本文件**不复制任何判据** —— 三态、分档、身份、阈值全部 import 源脚本
 * 的 `__test__` 直接用生产实现;测的是"这套判据在这几组输入上落到哪一档",不是另算一遍。
 * 全程零副作用:git 执行器与 push-state 一律注入假件,不碰真仓库、不碰真状态件、不寄信。
 *
 * 跑法:node --test scripts/tests/push-divergence-watch.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as watch } from '../lib/push-divergence-watch.mjs'
import { CONVERGE_COMMAND } from '../lib/push-attempt-triage.mjs'

const SRC = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'lib',
  'push-divergence-watch.mjs',
)
const HEAD_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const HEAD_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const HEAD_C = 'cccccccccccccccccccccccccccccccccccccccc'
const NOW = 1_800_000_000_000

/** 健康的 push-state:当下量的、已成功、pid 已退出(done 无 worker)。 */
const doneState = (headSha = HEAD_A, ts = NOW) => ({ status: 'done', headSha, ts, pid: 4242 })

// ─── ①阳性对照:真分叉必须命中 breach,且自带可执行出路(§5e-1)─────────────────
test('P1 真分叉(两侧同时非零)⇒ breach,出路指向收敛器', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_B,
    localAhead: 121,
    remoteAhead: 326,
    pushState: { status: 'diverged', headSha: HEAD_A, ts: NOW, pid: 1, kind: 'non-fast-forward' },
    now: NOW,
  })
  assert.equal(v.state, 'breach')
  assert.equal(v.band, 'true-divergence')
  assert.equal(v.severity, 'critical')
  assert.equal(v.nextCommand, CONVERGE_COMMAND)
  assert.match(v.text, /真分叉/)
})

test('P1b 真分叉 1/1 也判 breach(分叉不因"只有一枚"而变安全)', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_B,
    localAhead: 1,
    remoteAhead: 1,
    pushState: doneState(),
    now: NOW,
  })
  assert.equal(v.state, 'breach')
  assert.equal(v.band, 'true-divergence')
})

test('P1c push-state 自带 nextCommand 时照用它(出路唯一面在状态件里)', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_B,
    localAhead: 3,
    remoteAhead: 9,
    pushState: {
      status: 'diverged',
      headSha: HEAD_A,
      ts: NOW,
      pid: 1,
      nextCommand: 'node scripts/git-sync-converge.mjs --dry-run',
    },
    now: NOW,
  })
  assert.equal(v.nextCommand, 'node scripts/git-sync-converge.mjs --dry-run')
})

test('P2 本地积压过门槛 ⇒ breach,且出路先复现真因', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_A,
    localAhead: 5,
    remoteAhead: 0,
    pushState: {
      status: 'failed',
      headSha: HEAD_A,
      ts: NOW - 60_000,
      pid: 4242,
      kind: 'credentials-unavailable',
    },
    now: NOW,
  })
  assert.equal(v.state, 'breach')
  assert.equal(v.band, 'local-backlog')
  assert.match(v.nextCommand, /git-push-guard\.mjs/)
})

test('P3 长期落后(只有远端有)过门槛 ⇒ breach,出路是 fetch + ff-only(禁 pull --rebase,§16)', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_B,
    localAhead: 0,
    remoteAhead: 50,
    pushState: doneState(HEAD_A, NOW - 60_000),
    now: NOW,
  })
  assert.equal(v.state, 'breach')
  assert.equal(v.band, 'remote-ahead-stale')
  assert.match(v.nextCommand, /--ff-only/)
  assert.doesNotMatch(v.nextCommand, /pull --rebase/)
})

test('P4 策略挡住的积压 ⇒ 独立分档,真解点名机主侧(§5e-1 白名单档)', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_A,
    localAhead: 30,
    remoteAhead: 0,
    pushState: {
      status: 'failed',
      headSha: HEAD_A,
      ts: NOW - 60_000,
      pid: 1,
      kind: 'protected-branch',
    },
    remoteIsAncestorOfHead: true,
    now: NOW,
  })
  assert.equal(v.state, 'breach')
  assert.equal(v.band, 'local-backlog-policy')
  // nextCommand 必须是**可照抄执行**的一条(不带说明性后缀,否则出路本身跑不通 = §0.8)
  assert.equal(v.nextCommand, 'node scripts/git-push-guard.mjs')
  assert.match(v.remedyNote, /Settings→Branches/, '真解在机主侧必须写进正文')
  assert.match(v.text, /机主侧/)
  assert.match(watch.buildAlertIdentity(v, { now: NOW }).detail, /第二步\/真解/)
})

test('P4b 祖先关系取不到 ⇒ 不认领"策略档"(宁可多要一次说明,绝不冒判,§0.10)', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_A,
    localAhead: 30,
    remoteAhead: 0,
    pushState: {
      status: 'failed',
      headSha: HEAD_A,
      ts: NOW - 60_000,
      pid: 1,
      kind: 'protected-branch',
    },
    remoteIsAncestorOfHead: null,
    now: NOW,
  })
  assert.equal(v.band, 'local-backlog')
})

// ─── ②反向对照:健康形态必须 ok(造恒红 = §12e 禁的那型)──────────────────────
test('N1 已同步(两侧零且 sha 相同)⇒ ok', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_A,
    localAhead: 0,
    remoteAhead: 0,
    pushState: doneState(),
    now: NOW,
  })
  assert.equal(v.state, 'ok')
  assert.equal(v.band, 'synced')
  assert.equal(v.nextCommand, null)
})

test('N2 小积压(低于门槛)⇒ ok;门槛边界按源脚本常量走', () => {
  const base = {
    localHead: HEAD_A,
    remoteSha: HEAD_A,
    remoteAhead: 0,
    pushState: doneState(HEAD_A, NOW - 60_000),
    now: NOW,
  }
  const lo = watch.classifyDivergence({ ...base, localAhead: 4 })
  assert.equal(lo.state, 'ok')
  assert.equal(lo.band, 'within-backlog-budget')
  const hi = watch.classifyDivergence({ ...base, localAhead: 5 })
  assert.equal(hi.state, 'breach')
  assert.equal(hi.band, 'local-backlog')
})

test('N3 后台推送在途(running + 新鲜 + pid 活)⇒ ok,不喊正在干活的腿', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_A,
    localAhead: 7,
    remoteAhead: 0,
    pushState: { status: 'running', headSha: HEAD_A, ts: NOW - 1000, pid: 4242 },
    pidAliveFn: () => true,
    now: NOW,
  })
  assert.equal(v.state, 'ok')
  assert.equal(v.band, 'push-in-flight')
})

test('N3b running 但持有者已死 ⇒ 不算在途(猝死残留照旧按积压判)', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_A,
    localAhead: 7,
    remoteAhead: 0,
    pushState: { status: 'running', headSha: HEAD_A, ts: NOW - 1000, pid: 4242 },
    pidAliveFn: () => false,
    now: NOW,
  })
  assert.equal(v.state, 'breach')
  assert.equal(v.band, 'local-backlog')
})

test('N4 少量落后 ⇒ ok(多会话并发是常态)', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_B,
    localAhead: 0,
    remoteAhead: 3,
    pushState: doneState(),
    now: NOW,
  })
  assert.equal(v.state, 'ok')
  assert.equal(v.band, 'behind-normal')
})

// ─── ③未判定档:取不到输入既不记绿也不冒红(§0.3)──────────────────────────
test('U1 没有 origin 远端 ⇒ unjudged 并点名来源', () => {
  const v = watch.classifyDivergence({
    originRemotePresent: false,
    localHead: HEAD_A,
    remoteSha: '',
    localAhead: null,
    remoteAhead: null,
    pushState: null,
    now: NOW,
  })
  assert.equal(v.state, 'unjudged')
  assert.equal(v.band, 'input-missing')
  assert.ok(
    v.missing.some((m) => m.key === 'originRemote'),
    '未判定必须点名缺了哪一路',
  )
  assert.ok(v.severity === 'none')
})

test('U2 rev-list 解不出两列 ⇒ unjudged(不补 0 冒充同步)', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_B,
    localAhead: null,
    remoteAhead: null,
    pushState: doneState(),
    now: NOW,
  })
  assert.equal(v.state, 'unjudged')
  assert.ok(v.missing.some((m) => m.key === 'rev-list'))
})

test('U3 左右计数为 0 但两侧 sha 不同 ⇒ unjudged(读数自相矛盾,不猜哪句真)', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_B,
    localAhead: 0,
    remoteAhead: 0,
    pushState: doneState(),
    now: NOW,
  })
  assert.equal(v.state, 'unjudged')
  assert.equal(v.band, 'ref-anomaly')
})

test('U4 parseRevListCount:正常/坏形态两态', () => {
  assert.deepEqual(watch.parseRevListCount('121\t326'), {
    ok: true,
    localAhead: 121,
    remoteAhead: 326,
  })
  assert.equal(watch.parseRevListCount('7').ok, false)
  assert.equal(watch.parseRevListCount('').ok, false)
  assert.equal(watch.parseRevListCount('a b').ok, false)
  assert.equal(watch.parseRevListCount('-1 3').ok, false)
})

test('U5 readDivergenceInput:git 全挂 ⇒ 结论必落 unjudged(取材失败不回落)', () => {
  const boom = () => {
    const e = new Error('git 不可达')
    e.status = 128
    throw e
  }
  const { input, verdict } = watch.watchPushDivergence({ run: boom, pushState: null, now: NOW })
  assert.equal(verdict.state, 'unjudged')
  assert.ok(input.unresolved.length > 0, '取材层要把取不到的那一路留下痕迹')
})

// ─── ④去重身份稳定:同一场分叉换 sha/计数不得产生新身份(§5e-1 / 守门 224)──
test('D1 同分档换 sha 换计数 ⇒ 身份逐字相同', () => {
  const a = watch.buildAlertIdentity(
    watch.classifyDivergence({
      localHead: HEAD_A,
      remoteSha: HEAD_B,
      localAhead: 121,
      remoteAhead: 326,
      pushState: doneState(),
      now: NOW,
    }),
    { now: NOW },
  )
  const b = watch.buildAlertIdentity(
    watch.classifyDivergence({
      localHead: HEAD_C,
      remoteSha: HEAD_A,
      localAhead: 122,
      remoteAhead: 461,
      pushState: doneState(HEAD_C, NOW + 1000),
      now: NOW,
    }),
    { now: NOW },
  )
  assert.equal(a.dedupKey, b.dedupKey)
  assert.equal(a.fingerprint, b.fingerprint)
  assert.doesNotMatch(a.dedupKey, /[0-9a-f]{7,}/, '身份里不得混入 sha')
  assert.doesNotMatch(a.dedupKey, /\d{2,}/, '身份里不得混入原始计数/时刻')
})

test('D2 不同分档 ⇒ 不同身份(策略档不能吃掉真分叉档)', () => {
  const div = watch.buildAlertIdentity(
    watch.classifyDivergence({
      localHead: HEAD_A,
      remoteSha: HEAD_B,
      localAhead: 2,
      remoteAhead: 2,
      pushState: doneState(),
      now: NOW,
    }),
    { now: NOW },
  )
  const backlog = watch.buildAlertIdentity(
    watch.classifyDivergence({
      localHead: HEAD_A,
      remoteSha: HEAD_A,
      localAhead: 9,
      remoteAhead: 0,
      pushState: doneState(HEAD_A, NOW - 1000),
      now: NOW,
    }),
    { now: NOW },
  )
  assert.notEqual(div.fingerprint, backlog.fingerprint)
})

test('D3 跨持续档即新身份(越拖越响,不会被压成静音)', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_B,
    localAhead: 3,
    remoteAhead: 3,
    pushState: doneState(),
    now: NOW,
  })
  const fresh = watch.buildAlertIdentity(v, { heldFirstMs: NOW - 60_000, now: NOW })
  const held = watch.buildAlertIdentity(v, { heldFirstMs: NOW - 25 * 3600_000, now: NOW })
  assert.match(fresh.dedupKey, /held=lt6h/)
  assert.match(held.dedupKey, /held=24-72h/)
  assert.notEqual(fresh.fingerprint, held.fingerprint)
})

test('D4 shouldReportBreach:同身份窗口内压住 / 新身份放行 / 非 breach 永不派', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_B,
    localAhead: 121,
    remoteAhead: 326,
    pushState: doneState(),
    now: NOW,
  })
  const id = watch.buildAlertIdentity(v, { now: NOW })
  const first = watch.shouldReportBreach({ notifyState: {}, verdict: v, now: NOW })
  assert.equal(first.report, true)
  const suppressed = watch.shouldReportBreach({
    notifyState: { [id.dedupKey]: { fp: id.fingerprint, ts: NOW - 60_000, delivered: true } },
    verdict: v,
    now: NOW,
  })
  assert.equal(suppressed.report, false)
  const redeliver = watch.shouldReportBreach({
    notifyState: { [id.dedupKey]: { fp: id.fingerprint, ts: NOW - 60_000, delivered: false } },
    verdict: v,
    now: NOW - 60_000 + 31 * 60_000,
  })
  assert.equal(redeliver.report, true, '没送达 ⇒ 按失败退避重投,不是封死')
  const okVerdict = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_A,
    localAhead: 0,
    remoteAhead: 0,
    pushState: doneState(),
    now: NOW,
  })
  assert.equal(
    watch.shouldReportBreach({ notifyState: {}, verdict: okVerdict, now: NOW }).report,
    false,
  )
  const undet = watch.classifyDivergence({
    localHead: '',
    remoteSha: '',
    pushState: null,
    now: NOW,
  })
  assert.equal(
    watch.shouldReportBreach({ notifyState: {}, verdict: undet, now: NOW }).report,
    false,
    'unjudged 不报警(也不记绿)',
  )
})

// ─── ⑤push-state 陈旧的归档:不作 breach 理由,也不把确定读数降成 unjudged ──
test('S1 陈旧读数(headSha 非当前)⇒ 结论照几何判,notes 点名"历史残留"', () => {
  const v = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_A,
    localAhead: 40,
    remoteAhead: 0,
    pushState: { status: 'done', headSha: HEAD_B, ts: NOW - 4 * 3600_000, pid: 1 },
    now: NOW,
  })
  assert.equal(v.state, 'breach')
  assert.equal(v.provenance.state, 'stale-record')
  assert.match(v.provenance.text, /历史残留/)
  assert.match(v.text, /历史残留|不得读成当下故障|距今/, '正文必须把这枚读数的出处说清')
})

test('S2 无 push-state / 形状坏 ⇒ 仍按计数判定(缺的是通道证据,不是分叉本身)', () => {
  const absent = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_B,
    localAhead: 8,
    remoteAhead: 0,
    pushState: null,
    now: NOW,
  })
  assert.equal(absent.state, 'breach')
  assert.ok(
    absent.notes.some((n) => /证据缺位/.test(n)),
    '缺通道证据必须如实写进 notes',
  )
  const malformed = watch.classifyDivergence({
    localHead: HEAD_A,
    remoteSha: HEAD_B,
    localAhead: 0,
    remoteAhead: 0,
    pushState: { status: 'done', headSha: HEAD_A },
    now: NOW,
  })
  assert.equal(malformed.provenance.state, 'malformed')
})

test('S3 breach 必带非空出路(§5e-1 可整改性:没有出路的分档不许存在)', () => {
  const scans = [
    {
      localAhead: 121,
      remoteAhead: 326,
      pushState: { status: 'diverged', headSha: HEAD_A, ts: NOW, pid: 1 },
    },
    { localAhead: 40, remoteAhead: 0, pushState: doneState() },
    { localAhead: 0, remoteAhead: 99, pushState: doneState() },
  ]
  for (const s of scans) {
    const v = watch.classifyDivergence({ localHead: HEAD_A, remoteSha: HEAD_B, ...s, now: NOW })
    assert.equal(v.state, 'breach', `这组输入本该 breach:${JSON.stringify(s)}`)
    assert.ok(
      typeof v.nextCommand === 'string' && v.nextCommand.length > 0,
      `breach 没给出路:${v.band}`,
    )
  }
})

// ─── ⑥取材层与机器纪律形状锁 ─────────────────────────────────────────────
test('R1 readDivergenceInput:注入假 git ⇒ 三态取材齐备', () => {
  const seen = []
  const run = (args) => {
    assert.ok(Array.isArray(args), '执行器收到的必须是参数数组')
    seen.push(args.join(' '))
    const head = args.slice(0, 2).join(' ')
    if (head === 'remote get-url') return 'ssh://git@ssh.github.com:443/x/y.git\n'
    if (head === 'rev-parse HEAD') return `${HEAD_A}\n`
    if (head === 'rev-parse --verify') return `${HEAD_B}\n`
    if (head === 'rev-list --left-right') return '121 326\n'
    if (head === 'merge-base --is-ancestor') {
      const e = new Error('not ancestor')
      e.status = 1
      throw e
    }
    throw new Error(`假 git 没登记这条:${args.join(' ')}`)
  }
  const input = watch.readDivergenceInput({ run, pushState: doneState(), now: NOW })
  assert.equal(input.localAhead, 121)
  assert.equal(input.remoteAhead, 326)
  assert.equal(input.originRemotePresent, true)
  assert.equal(input.remoteIsAncestorOfHead, false, 'exit 1 是"不是祖先",不是"取不到"')
  assert.ok(seen.some((c) => c.startsWith('rev-list --left-right --count')))
  const verdict = watch.classifyDivergence(input)
  assert.equal(verdict.band, 'true-divergence')
})

test('R2 只读取材不写盘:源码里不得出现任何写文件或直执行 git 网络命令的出口', () => {
  const src = readFileSync(SRC, 'utf8')
  for (const banned of [
    'writeFileSync',
    'appendFileSync',
    'mkdirSync',
    'rmSync',
    'unlinkSync',
    'renameSync',
    'execSync',
    'spawn(',
    'spawnSync(',
  ]) {
    assert.ok(!src.includes(banned), `探测器源码不得出现 ${banned}(只读纪律)`)
  }
  assert.match(
    src,
    /from '\.\/face-reader\.mjs'/,
    '派生 git 必须走 face-reader 的 gitRaw(显式 stdio,§12g)',
  )
  assert.match(src, /pathToFileURL/, '§22d:直执行守卫必须用 pathToFileURL 归一')
})

test('R3 readPushState:读不到/形态坏一律 null,不冒充状态', () => {
  assert.equal(
    watch.readPushState({ file: resolve(dirname(SRC), '__no_such_push_state__.json') }),
    null,
  )
  assert.equal(watch.readPushState({ file: SRC }), null, 'JSON 解析不过 ⇒ null')
})

// ─── ⑦真仓烟测:只锁形状,不断言本机计数(不断言机器状态 = 不造恒红)──────
test('L1 真仓只读一趟:结论必落在三态之内且 breach 自带出路', () => {
  const { verdict } = watch.watchPushDivergence()
  assert.ok(['ok', 'breach', 'unjudged'].includes(verdict.state), `三态之外:${verdict.state}`)
  assert.ok(typeof verdict.text === 'string' && verdict.text.length > 0)
  if (verdict.state === 'unjudged') {
    assert.ok(Array.isArray(verdict.missing) && verdict.missing.length > 0, '未判定必须点名')
  }
  if (verdict.state === 'breach') {
    assert.ok(typeof verdict.nextCommand === 'string' && verdict.nextCommand.length > 0)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
