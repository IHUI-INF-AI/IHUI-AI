// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守护巡检「迁移账本中间缺口」的镜像测试(§22c:直接 import 生产函数,不复制判据)。
 *
 * 钉四态:
 *  ① 无缺口 ⇒ 不寄信、记绿;
 *  ② 有 lateGap ⇒ 必须到人(标题点名“中间缺口”,dedupKey 含缺口集合);
 *  ③ 尺子读数不可解析 ⇒ 未判定,既不记绿也不寄信;
 *  ④ 节流窗口内重跑 ⇒ 不重复派发(节流先于派生)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import { auditMigrationGaps } from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

function harness({ payload, status = 0, intervalMs = 0 }) {
  const dir = mkScratch('guard-mig-gaps')
  const tickFile = join(dir, 'tick.ts')
  const notes = []
  const logs = []
  const call = (now) =>
    auditMigrationGaps({
      now: now ?? Date.now(),
      intervalMs,
      tickFile,
      logger: (m) => logs.push(String(m)),
      notify: (...a) => {
        notes.push(a)
        return { sent: true }
      },
      runner: () => ({ status, stdout: typeof payload === 'string' ? payload : JSON.stringify(payload), stderr: '' }),
    })
  return { dir, tickFile, notes, logs, call }
}

test('无中间缺口 ⇒ 不寄信并记绿', () => {
  const h = harness({ payload: { applied: 324, lateGap: [], pending: [], hashDrift: ['x'] } })
  try {
    const r = h.call()
    assert.equal(r.ran, true)
    assert.equal(r.ok, true)
    assert.equal(h.notes.length, 0)
    assert.match(h.logs.join('\n'), /无中间缺口/)
  } finally {
    rmScratch(h.dir)
  }
})

test('有 lateGap ⇒ 必须到人,dedupKey 带上缺口集合(新缺口=新事实)', () => {
  const payload = { applied: 320, lateGap: [{ tag: 'b_late', when: 1 }, { tag: 'a_late', when: 2 }], pending: [], hashDrift: [] }
  const h = harness({ payload, status: 1 })
  try {
    const r = h.call()
    assert.equal(r.ok, false)
    assert.equal(h.notes.length, 1)
    const [title, body, opts] = h.notes[0]
    assert.match(title, /中间缺口/)
    assert.match(body, /a_late/)
    assert.match(body, /b_late/)
    assert.equal(opts.severity, 'critical')
    assert.match(opts.dedupKey, /^migration-gap;set=/)
    assert.ok(opts.dedupKey.includes('a_late') && opts.dedupKey.includes('b_late'), '缺口集合必须进身份')
    assert.match(h.logs.join('\n'), /已派发到邮件通道/)
  } finally {
    rmScratch(h.dir)
  }
})

test('尺子读数不可解析 ⇒ 未判定(不记绿、不寄信)', () => {
  const h = harness({ payload: 'not json', status: 2 })
  try {
    const r = h.call()
    assert.equal(r.judged, false)
    assert.equal(h.notes.length, 0)
    assert.match(h.logs.join('\n'), /未判定/)
  } finally {
    rmScratch(h.dir)
  }
})

test('节流窗口内重跑 ⇒ 不重复派发', () => {
  const payload = { applied: 320, lateGap: [{ tag: 'x', when: 1 }], pending: [], hashDrift: [] }
  const h = harness({ payload, status: 1, intervalMs: 60 * 60 * 1000 })
  try {
    const now = Date.now()
    h.call(now)
    const second = h.call(now + 1000)
    assert.equal(second.ran, false)
    assert.match(String(second.why), /节流/)
    assert.equal(h.notes.length, 1, '窗口内不得再寄')
  } finally {
    rmScratch(h.dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
