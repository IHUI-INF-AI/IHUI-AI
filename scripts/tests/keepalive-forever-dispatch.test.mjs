// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 永久保活派发腿接线锁(2026-11-01 立,§22c:判据 import 生产端,测试内零复制)。
 *
 * 钉的是这一族的失效形态 —— 它们全是安静的:
 *  T1 未到窗口 ⇒ 一次都不派生(多派 = 多打一轮上游,而机主把「别把号打爆」当成硬约束);
 *  T2 器物不在位 ⇒ 只报「未探测」,不得写成跑过(§0.3);
 *  T3/T4 ok 与 alert ⇒ 都不 notify —— 邮件已由器物经唯一出口发过,守护再发就是同一故障两封信(§5e-3);
 *  T5 结论行取不到 ⇒ 必须 notify(这条腿是 api 进程外唯一的续期承载体,它哑了没人兜);
 *  T6 state=undetermined ⇒ 同上,且身份与 T5 不同(两件事两种修法);
 *  T7 上一轮未判定 ⇒ 冷却缩短到 1 小时(一次 Redis 抖动不能把保活停摆六小时);
 *  T8 节流台账必须先写后跑(自愈配额写在阻塞调用之后 ⇒ 计数恒 0、每周期重犯)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as guardian } from '../git-guardian.mjs'

const { sweepKeepAliveForever } = guardian

const HOUR = 60 * 60 * 1000
const NOW = Date.parse('2026-11-01T00:00:00Z')

function harness(t, out = 'KEEPALIVE-RESULT state=ok registered=1 refreshed=0 refreshFailed=0 keepalive=1 heartbeat=1 alerts=0 mailed=0') {
  const dir = mkScratch('keepalive-dispatch')
  t.after(() => rmScratch(dir))
  const calls = []
  const logs = []
  const mails = []
  const opts = {
    now: NOW,
    tickFile: join(dir, 'tick.json'),
    logger: (m) => logs.push(String(m)),
    notify: (title, body, o) => mails.push({ title, body, dedupKey: o?.dedupKey ?? '' }),
    runner: () => {
      calls.push({ tickWritten: existsSync(join(dir, 'tick.json')) })
      return { ok: true, out, status: 0 }
    },
  }
  return { dir, calls, logs, mails, opts }
}

test('T1 未到节流窗口 ⇒ 一次都不派生', (t) => {
  const h = harness(t)
  sweepKeepAliveForever(h.opts)
  assert.equal(h.calls.length, 1, '首次应派发')
  h.opts.now = NOW + HOUR // 1 小时 < 6 小时窗口
  const r = sweepKeepAliveForever(h.opts)
  assert.equal(r.ran, false)
  assert.equal(h.calls.length, 1, '未到窗口不得再派生')
})

test('T2 器物在位 ⇒ 不会静默落在「不在位」档(派生路径按脚本自身位置推,没写歪)', (t) => {
  // 器物不在位那一档要真把 scripts/relay-account-keepalive.mjs 移走才走得到,
  // 而实现按 import.meta.url 定位 ⇒ 没有注入面。这里反向锁:文件在 ⇒ 必须真派发一次,
  // 若哪天路径写歪(比如误指向仓根),就会落进「不在位」返回 ran:false,本用例当场红。
  const h = harness(t)
  const r = sweepKeepAliveForever(h.opts)
  assert.equal(r.ran, true, 'scripts/relay-account-keepalive.mjs 在位 ⇒ 不该报「器物不在位」')
  assert.equal(h.calls.length, 1, '首次必派发')
  assert.equal(h.mails.length, 0)
  assert.ok(existsSync(join(h.dir, 'tick.json')))
})

test('T3 ok ⇒ 静默,既不 notify 也不冒红', (t) => {
  const h = harness(t)
  const r = sweepKeepAliveForever(h.opts)
  assert.equal(r.ok, true)
  assert.equal(r.state, 'ok')
  assert.equal(h.mails.length, 0, 'ok 不该喊人')
})

test('T4 alert ⇒ 邮件已由器物发过,守护不得重复投递(§5e-3)', (t) => {
  const h = harness(
    t,
    'KEEPALIVE-RESULT state=alert registered=1 refreshed=0 refreshFailed=1 keepalive=1 heartbeat=0 alerts=1 mailed=1',
  )
  const r = sweepKeepAliveForever(h.opts)
  assert.equal(r.ok, false)
  assert.equal(r.state, 'alert')
  assert.equal(h.mails.length, 0, '守护侧再发就是同一故障两封信')
  assert.ok(h.logs.some((l) => l.includes('不重复投递')), '日志要写明为什么不喊人')
})

test('T5 结论行取不到 ⇒ 必须到人(这条腿哑了没人兜)', (t) => {
  const h = harness(t, '{"ok":true,"sweep":{"refreshed":0}}\n没有结论行\n')
  const r = sweepKeepAliveForever(h.opts)
  assert.equal(r.state, 'no-result-line')
  assert.equal(h.mails.length, 1)
  assert.equal(h.mails[0].dedupKey, 'keepalive-forever;no-result-line')
})

test('T6 state=undetermined ⇒ 到人,且身份与「取不到结论行」不同', (t) => {
  const h = harness(
    t,
    'KEEPALIVE-RESULT state=undetermined registered=? refreshed=? refreshFailed=? keepalive=? heartbeat=? alerts=? mailed=?',
  )
  const r = sweepKeepAliveForever(h.opts)
  assert.equal(r.state, 'undetermined')
  assert.equal(h.mails.length, 1)
  assert.equal(h.mails[0].dedupKey, 'keepalive-forever;undetermined')
})

test('T7 上一轮未判定 ⇒ 冷却压到 1 小时(一次抖动不停摆六小时)', (t) => {
  const h = harness(
    t,
    'KEEPALIVE-RESULT state=undetermined registered=1 refreshed=? refreshFailed=? keepalive=? heartbeat=? alerts=0 mailed=0',
  )
  sweepKeepAliveForever(h.opts)
  assert.equal(h.calls.length, 1)
  h.mails.length = 0
  h.opts.now = NOW + 2 * HOUR
  const r = sweepKeepAliveForever(h.opts)
  assert.equal(r.ran, true, '未判定后 2 小时应当重试,而不是等满 6 小时')
  assert.equal(h.calls.length, 2)
})

test('T8 节流台账先写后跑(写在阻塞调用之后 = 计数恒 0)', (t) => {
  const h = harness(t)
  sweepKeepAliveForever(h.opts)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].tickWritten, true, '派生那一刻台账必须已经落笔')
  const rec = JSON.parse(readFileSync(join(h.dir, 'tick.json'), 'utf8'))
  assert.equal(rec.attemptAt, new Date(NOW).toISOString())
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
