// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `auto-triage.mjs` 的镜像测试(§22c:判据 import 源脚本 `__test__`,本文件零复制判据)。
 *
 * 钉四环:
 *  ① 分诊配置形状锁(来源白名单闭集 / 配额正整数);
 *  ② mail-failure 来源:24h 窗计数只收 failed(旧窗与 delivered 不计),台账缺 = 未判定;
 *  ③ 去重与配额成对:24h 窗新鲜拦 / 过期放;配额只数当日 registered;
 *  ④ 登记通道:live-doc-edit 子进程形态(env 驱动 + 唯一登记入口)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as tr } from '../auto-triage.mjs'

const LDE_TAIL = 'live-doc-edit.mjs'
const LDE_MSG = '登记必须走 live-doc-edit 唯一入口'

test('① 形状锁:合法过 / 未知源闭集拒 / 配额 0 拒', () => {
  const g = tr.loadConfig(() => JSON.stringify({ enabled: true, dailyRegistrationQuota: 3, sources: ['mail-failure', 'index-unmerged'] }))
  assert.equal(g.enabled, true)
  assert.deepEqual(g.sources, ['mail-failure', 'index-unmerged'])
  assert.throws(() => tr.loadConfig(() => JSON.stringify({ enabled: true, dailyRegistrationQuota: 3, sources: ['everything'] })), tr.TriageShapeError)
  assert.throws(() => tr.loadConfig(() => JSON.stringify({ enabled: true, dailyRegistrationQuota: 0, sources: ['mail-failure'] })), tr.TriageShapeError)
  assert.throws(() => tr.loadConfig(() => 'nope'), tr.TriageShapeError)
})

test('② mail-failure:24h 窗只收 failed;缺台账 = 未判定不记绿', () => {
  const now = Date.now()
  const rows = [
    JSON.stringify({ at: new Date(now - 3600_000).toISOString(), disposition: 'failed', why: 'conn refused' }),
    JSON.stringify({ at: new Date(now - 7200_000).toISOString(), disposition: 'failed' }),
    JSON.stringify({ at: new Date(now - 3600_000).toISOString(), disposition: 'delivered' }),
    JSON.stringify({ at: new Date(now - 25 * 3600_000).toISOString(), disposition: 'failed' }),
    'not-json',
  ]
  const m = tr.readMailFailures(() => rows.join('\n'), now)
  assert.equal(m.status, 'ok')
  assert.equal(m.failed24h, 2)
  assert.equal(m.lastWhy, 'conn refused')
  assert.equal(tr.readMailFailures(() => { throw new Error('missing') }, now).status, 'undetermined')
})

test('③a 去重成对:24h 新鲜拦 / 过期放 / 指纹区分源', () => {
  const now = Date.now()
  const led = [{ action: 'registered', ts: new Date(now - 3600_000).toISOString(), fingerprint: 'fp1' }]
  assert.equal(tr.recentlyRegistered(led, 'fp1', now), true)
  assert.equal(tr.recentlyRegistered(led, 'fp2', now), false)
  assert.equal(tr.recentlyRegistered([{ action: 'registered', ts: new Date(now - 25 * 3600_000).toISOString(), fingerprint: 'fp1' }], 'fp1', now), false)
  assert.notEqual(tr.fingerprintOf('a', 'x'), tr.fingerprintOf('b', 'x'))
  assert.equal(tr.fingerprintOf('a', 'x'), tr.fingerprintOf('a', 'x'))
})

test('③b 配额:只数当日 registered(observed/quota-deferred 不占额)', () => {
  const now = new Date()
  const led = [
    { action: 'registered', ts: now.toISOString() },
    { action: 'registered', ts: new Date(Date.now() - 25 * 3600_000).toISOString() },
    { action: 'quota-deferred', ts: now.toISOString() },
    { action: 'observed', ts: now.toISOString() },
  ]
  assert.equal(tr.registeredToday(led, now), 1)
})

test('④ 登记通道:live-doc-edit 子进程形态(env 驱动 + 唯一入口路径)', () => {
  const calls = []
  const fakeSpawn = (_cmd, argv, opts) => {
    calls.push({ argv, opts })
    return { status: 0, stdout: '✅ 回读:本块每一条非空行都在 HEAD 里', stderr: '' }
  }
  const r = tr.registerToPlan({ source: 'mail-failure', fingerprint: 'fpt', title: '测试票', evidence: 'e' }, fakeSpawn)
  assert.equal(r.ok, true)
  assert.equal(calls.length, 1)
  assert.ok(String(calls[0].argv[0]).endsWith(LDE_TAIL), LDE_MSG)
  assert.equal(calls[0].opts.env.LIVE_DOC, 'PROJECT_PLAN.md')
  assert.match(calls[0].opts.env.LIVE_MSG, /auto-triage/)
})

test('④ 登记通道:live-doc-edit 失败 ⇒ 不冒充已登记', () => {
  const r = tr.registerToPlan({ source: 's', fingerprint: 'fpf', title: 't', evidence: 'e' }, () => ({ status: 2, stdout: '', stderr: 'boom' }))
  assert.equal(r.ok, false)
  assert.match(r.why, /rc=2/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
