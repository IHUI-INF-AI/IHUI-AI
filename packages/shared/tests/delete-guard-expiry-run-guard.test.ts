// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回收站「到期清理」器**自身死亡机制**的行为钉(goal-b49 W7 / AGENTS 附加强制条款「工作队列必须有死亡机制」)。
 * 与 delete-guard-expiry.test.ts 共用同一判据源:全部 import 源文件,本文件不复制任何算式(§22c)。
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPIRY_MAX_STRIKES } from '../src/delete-guard/constants.js'
import {
  decideExpiryRun,
  initialExpiryLedger,
  isExpiryRunLedgerShape,
  nextExpiryLedger,
  summarizeExpiryGate,
} from '../src/delete-guard/expiry-run-guard.js'

const NOW = '2026-11-05T00:00:00.000Z'
const nowMs = Date.parse(NOW)

describe('死亡机制:连败封票 / 永久退休', () => {
  const empty = initialExpiryLedger()
  it('空账目首轮可跑', () => {
    expect(decideExpiryRun(empty, { nowIso: NOW }).gate).toBe('run')
  })
  it('账目坏/取不到 ⇒ undetermined(不当成空账目放行)', () => {
    for (const bad of [null, undefined, {}, { streak: -1 }, 'x']) {
      expect(isExpiryRunLedgerShape(bad)).toBe(false)
      expect(decideExpiryRun(bad, { nowIso: NOW }).gate).toBe('undetermined')
    }
  })
  it('最小间隔未到 ⇒ backoff 带 retryAfterMs', () => {
    const ledger = nextExpiryLedger(empty, 'ok', { nowIso: NOW })
    const soon = new Date(nowMs + 60_000).toISOString()
    const d = decideExpiryRun(ledger, { nowIso: soon, minIntervalMs: 3_600_000 })
    expect(d.gate).toBe('backoff')
    expect(d.retryAfterMs).toBe(3_540_000)
  })
  it('失败累加连败并封票;undetermined 同权计入', () => {
    const l1 = nextExpiryLedger(empty, 'failure', { nowIso: NOW, quarantineMs: 1000 })
    expect(l1.streak).toBe(1)
    expect(l1.quarantinedUntilIso).toBe(new Date(nowMs + 1000).toISOString())
    const l2 = nextExpiryLedger(l1, 'undetermined', { nowIso: NOW, quarantineMs: 1000 })
    expect(l2.streak).toBe(2)
    expect(l2.quarantinedUntilIso).toBe(new Date(nowMs + 2000).toISOString())
    expect(decideExpiryRun(l2, { nowIso: new Date(nowMs + 1000).toISOString() }).gate).toBe(
      'quarantined',
    )
  })
  it('连败达上限 ⇒ retired,此后 decide 恒 retired 且账目不再自变', () => {
    let ledger = empty
    for (let i = 0; i < DEFAULT_EXPIRY_MAX_STRIKES; i++) {
      ledger = nextExpiryLedger(ledger, 'failure', { nowIso: NOW, quarantineMs: 1000 })
    }
    expect(ledger.retiredAtIso).not.toBeNull()
    const d = decideExpiryRun(ledger, { nowIso: new Date(nowMs + 10_000_000_000).toISOString() })
    expect(d.gate).toBe('retired')
    expect(nextExpiryLedger(ledger, 'failure', { nowIso: NOW })).toEqual(ledger)
  })
  it('成功 ⇒ 连败归零并解除封票', () => {
    const hot = nextExpiryLedger(empty, 'failure', { nowIso: NOW, quarantineMs: 1000 })
    const ok = nextExpiryLedger(hot, 'ok', { nowIso: NOW })
    expect(ok.streak).toBe(0)
    expect(ok.quarantinedUntilIso).toBeNull()
    expect(decideExpiryRun(ok, { nowIso: new Date(nowMs + 10 ** 12).toISOString() }).gate).toBe(
      'run',
    )
  })
  it('封票时刻解析不出 ⇒ undetermined(不当成"已出封票")', () => {
    const broken = { ...empty, quarantinedUntilIso: 'someday' }
    expect(decideExpiryRun(broken, { nowIso: NOW }).gate).toBe('undetermined')
  })
  it('nowIso 不可解析时写回账目 ⇒ 沿用旧封票窗(fail 方向是少删不是多删)', () => {
    const hot = nextExpiryLedger(empty, 'failure', { nowIso: NOW, quarantineMs: 1000 })
    const again = nextExpiryLedger(hot, 'failure', { nowIso: '昨天', quarantineMs: 1000 })
    expect(again.quarantinedUntilIso).toBe(hot.quarantinedUntilIso)
    expect(again.streak).toBe(2)
  })
  it('闸门结论行单行 ASCII', () => {
    const line = summarizeExpiryGate(decideExpiryRun(empty, { nowIso: NOW }))
    expect(line).not.toContain('\n')
    expect(line.startsWith('TRASH-EXPIRY-GATE ')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
