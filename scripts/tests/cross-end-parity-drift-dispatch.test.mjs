// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端对齐漂移巡检调度器(`auditCrossEndParityDrift`)的镜像测试。
 *
 * 立因:尺子 `scripts/check-cross-end-parity-drift.mjs` 的头注自述「供 git-guardian 巡检轮
 * 派发」,而全仓此前**零派发** —— 判据、自检、文档全在,却没有任何人调度它。这是本仓对这一型
 * 的名字:「造好没装车」,失效形态是安静(不是报错,是根本不跑)。
 *
 * 测试钉死六件事:
 *   T1 ok ⇒ 只写一行读数(带现读数),不喊人;
 *   T2 regressed ⇒ 到人,且去重身份 = 倒退维名(明细抖动不换身份);
 *   T3 undetermined ⇒ 只写 ⚠️「未判定」,不喊人也不记绿;
 *   T4 结论不可用(非 JSON)⇒ 同上,不喊人;
 *   T5 节流窗口内 ⇒ 不派生第二次;
 *   T6 装车锁:挂点必须在 `!CHECK_ONLY` 分支、函数在 `__test__` 出口里、默认节流可由 env 覆盖。
 *
 * 夹具契约(§22c):runner 返回的 JSON **由尺子自己的 `judge()` 现造**,不在测试里手抄
 * `state` 字面量与 `cur` 键 —— 生产方哪天改名,这里当场红,而不是两边互相圆谎。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { auditCrossEndParityDrift } from '../git-guardian.mjs'
import { __test__ as P } from '../check-cross-end-parity-drift.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

const fixture = () => {
  const dir = mkScratch('cross-end-drift-')
  return { tickFile: join(dir, 'tick.json') }
}

const coverage = (over = {}) => ({
  ok: true,
  json: {
    stats: { mirroredShared: 208, registryEntries: 208, sharedTotal: 218, ...(over.stats ?? {}) },
    red: over.red ?? [],
  },
})
const webParity = (over = {}) => ({
  ok: true,
  json: { rot: over.rot ?? [], aligned: 214, unmapped: 189, ...(over.json ?? {}) },
})

/** 还原度维的夹具(与 check-miniapp-mirror-fidelity --json 同形;2026-10-27 接进漂移尺) */
const fidelity = (over = {}) => ({
  ok: true,
  json: { hosted: 114, hand: 99, totalMissing: 646, broken: 0, other: 0, ...over },
})

/** 生产方现造:同一个 judge() 出口,测试不复制任何 state/键名。 */
const verdict = (opts) =>
  P.judge({
    coverage: coverage(opts?.coverage),
    webParity: webParity(opts?.webParity),
    fidelity: fidelity(opts?.fidelity),
    doc: '',
    prev: opts?.prev,
  })

const runnerOf =
  (verdictObj, status = 0) =>
  () => ({ status, stdout: JSON.stringify(verdictObj), stderr: '' })

test('T1 ok ⇒ 一行读数(带现读数),不喊人', () => {
  const logs = []
  const mails = []
  const v = verdict({ prev: { mirrored: 113 } })
  assert.equal(v.state, 'ok', `夹具应造出 ok(实测 ${v.state})`)
  const r = auditCrossEndParityDrift({
    ...fixture(),
    logger: (m) => logs.push(m),
    notify: (...a) => mails.push(a),
    runner: runnerOf(v),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(mails.length, 0, 'ok 档不许到人')
  const line = logs.find((l) => /跨端对齐漂移/.test(l))
  assert.ok(line, 'ok 档也要留一行读数(否则"没跑"和"跑了且没事"长得一样)')
  assert.match(line, /208\/218/, '读数必须带镜像现读,不许写死的旧数')
  assert.match(line, /214/, 'web→RN 已登记数也要现读')
})

test('T2f 还原度维(断链/声明不符/承载退回手写)⇒ 到人,身份带该维', () => {
  const logs = []
  const mails = []
  const v = verdict({
    fidelity: { broken: 1 },
    prev: { mirrored: 114, fidelityHosted: 120, fidelityMissing: 600 },
  })
  assert.equal(v.state, 'regressed', `夹具应造出倒退(实测 ${v.state})`)
  assert.ok(
    v.reasons.some((r) => r.dim === 'mirror-chain-broken'),
    JSON.stringify(v.reasons.map((r) => r.dim)),
  )
  const r = auditCrossEndParityDrift({
    ...fixture(),
    logger: (m) => logs.push(m),
    notify: (...a) => mails.push(a),
    runner: runnerOf(v),
  })
  assert.equal(r.state, 'regressed')
  assert.equal(mails.length, 1, '断链=页面渲染不出,必须到人,不是只写日志')
  assert.match(
    String(mails[0][2]?.dedupKey ?? ''),
    /mirror-chain-broken/,
    '身份要按倒退维,不能与别的维混成一封',
  )
})

test('T2 regressed ⇒ 到人,身份按倒退维(明细抖动不换身份)', () => {
  const logs = []
  const mails = []
  const v1 = verdict({ coverage: { red: [{}] }, prev: { mirrored: 113 } })
  assert.equal(v1.state, 'regressed')
  const r = auditCrossEndParityDrift({
    ...fixture(),
    logger: (m) => logs.push(m),
    notify: (...a) => mails.push(a),
    runner: runnerOf(v1, 1),
  })
  assert.equal(r.state, 'regressed')
  assert.equal(mails.length, 1, '倒退必须到人')
  const [name, detail, opts] = mails[0]
  assert.match(name, /跨端对齐倒退/)
  assert.ok(opts?.dedupKey, '必须给稳定去重身份')
  assert.match(detail, /可执行下一步/, '§5e-1:到人的正文必须自带可执行的下一步')
  assert.ok(
    logs.some((l) => /registry-rot/.test(l)),
    '日志要点名倒退维',
  )

  // 同一维度、明细不同 ⇒ 身份不变(否则明细抖动会把去重窗口绕成虚设)
  const mails2 = []
  const v2 = verdict({ coverage: { red: [{}, {}, {}] }, prev: { mirrored: 113 } })
  auditCrossEndParityDrift({
    tickFile: join(mkScratch('cross-end-drift-'), 'tick.json'),
    logger: () => {},
    notify: (...a) => mails2.push(a),
    runner: runnerOf(v2, 1),
  })
  assert.equal(mails2[0][2].dedupKey, opts.dedupKey, '维名相同 ⇒ 身份必须相同')
})

test('T3 undetermined ⇒ 只写「未判定」,不喊人也不记绿', () => {
  const logs = []
  const mails = []
  const v = P.judge({
    coverage: { ok: false, json: null },
    webParity: webParity(),
    doc: '',
    prev: null,
  })
  assert.equal(v.state, 'undetermined')
  const r = auditCrossEndParityDrift({
    ...fixture(),
    logger: (m) => logs.push(m),
    notify: (...a) => mails.push(a),
    runner: runnerOf(v, 2),
  })
  assert.equal(r.state, 'undetermined')
  assert.equal(r.ok, false, '未判定不许记绿')
  assert.equal(mails.length, 0, '未判定不猜、不喊人')
  assert.ok(logs.some((l) => /未判定/.test(l)))
  assert.ok(!logs.some((l) => /✅/.test(l)), '未判定不许出现绿勾')
})

test('T4 结论不可用 ⇒ 未判定,不喊人', () => {
  const logs = []
  const mails = []
  const r = auditCrossEndParityDrift({
    ...fixture(),
    logger: (m) => logs.push(m),
    notify: (...a) => mails.push(a),
    runner: () => ({ status: 0, stdout: 'not json at all', stderr: '' }),
  })
  assert.equal(r.state, 'unparsed')
  assert.equal(mails.length, 0)
  assert.ok(
    logs.some((l) => /未判定/.test(l)),
    '"没判"必须点名,不许当作"没事"',
  )
})

test('T5 节流窗口内不派生第二次', () => {
  const mails = []
  let calls = 0
  const opts = { ...fixture(), logger: () => {}, notify: (...a) => mails.push(a) }
  const first = auditCrossEndParityDrift({
    ...opts,
    runner: () => (calls++, runnerOf(verdict({ prev: { mirrored: 113 } }))()),
  })
  assert.equal(first.ran, true)
  const second = auditCrossEndParityDrift({
    ...opts,
    runner: () => (calls++, runnerOf(verdict())()),
  })
  assert.equal(second.ran, false)
  assert.equal(second.why, '未到节流窗口')
  assert.equal(calls, 1, '窗口内不许再起子进程')
})

test('T6 装车锁:挂点在 !CHECK_ONLY 分支、函数在 __test__ 出口、节流可由 env 覆盖', () => {
  assert.match(
    SRC,
    /if \(!CHECK_ONLY\) auditCrossEndParityDrift\(\)/,
    '必须挂在健康轮次的 !CHECK_ONLY 分支',
  )
  assert.match(SRC, /export function auditCrossEndParityDrift\(/, '函数必须存在')
  const t = SRC.slice(SRC.indexOf('export const __test__ = {'))
  assert.match(t, /\bauditCrossEndParityDrift,/, '镜像测试要能 import 到(§22c)')
  assert.match(
    SRC,
    /CROSS_END_DRIFT_INTERVAL_MS[\s\S]{0,80}IHUI_CROSS_END_DRIFT_INTERVAL_MS/,
    '默认节流必须可由 env 覆盖(自测/演练用)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
