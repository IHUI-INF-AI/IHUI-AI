// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 服务清单快照(service-inventory.json)的**刷新判据**锁(2026-11-04 立)。
 *
 * 背景:mtime 实测 2026-11-03 23:39,采集时已 12.3h 未更新 —— 旧行为只在 drift>0 时重生成,
 * 没有漂移就永远陈旧,下游读到旧读数。新判据 = drift>0 **或** 距上次刷新 ≥ 20h。
 *
 * 本文件只锁纯函数,时钟一律注入(nowMs / refreshedAt 夹具),**不依赖真实时间**,
 * 也不碰注册表、不写任何仓内文件。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SNAPSHOT_REFRESH_MAX_AGE_MS,
  buildInventoryObject,
  shouldRefreshSnapshot,
} from '../check-service-inventory.mjs'

const BASE = Date.parse('2026-11-04T00:00:00.000Z')
const hoursLater = (h) => BASE + h * 3600_000
const iso = (ms) => new Date(ms).toISOString()

test('R1 无 drift 但已 21h 未刷新(≥20h 阈值)⇒ 刷新', () => {
  assert.equal(
    shouldRefreshSnapshot({ drift: 0, refreshedAt: iso(BASE), nowMs: hoursLater(21) }),
    true,
  )
})

test('R2 无 drift 且只过了 1h ⇒ 不刷新(巡检不把入库件写脏)', () => {
  assert.equal(
    shouldRefreshSnapshot({ drift: 0, refreshedAt: iso(BASE), nowMs: hoursLater(1) }),
    false,
  )
})

test('R3 drift>0 ⇒ 即使刚刷新过也刷新(旧读数不能继续当真相源)', () => {
  assert.equal(
    shouldRefreshSnapshot({ drift: 2, refreshedAt: iso(BASE), nowMs: hoursLater(0.5) }),
    true,
  )
})

test('R4 refreshedAt 缺失/不可解析 ⇒ 视为到期(fail-closed,不把未知年龄当新鲜)', () => {
  assert.equal(shouldRefreshSnapshot({ drift: 0, refreshedAt: null, nowMs: BASE }), true)
  assert.equal(shouldRefreshSnapshot({ drift: 0, refreshedAt: 'not-a-date', nowMs: BASE }), true)
})

test('R5 阈值边界只认 >=:恰好 20h 刷新,差 1ms 不刷新', () => {
  assert.equal(
    shouldRefreshSnapshot({
      drift: 0,
      refreshedAt: iso(BASE),
      nowMs: BASE + SNAPSHOT_REFRESH_MAX_AGE_MS,
    }),
    true,
  )
  assert.equal(
    shouldRefreshSnapshot({
      drift: 0,
      refreshedAt: iso(BASE),
      nowMs: BASE + SNAPSHOT_REFRESH_MAX_AGE_MS - 1,
    }),
    false,
  )
})

test('R6 阈值常量 = 20h;快照内部 refreshedAt 与 generatedAt 同源(不靠文件 mtime)', () => {
  assert.equal(SNAPSHOT_REFRESH_MAX_AGE_MS, 20 * 60 * 60 * 1000)
  const at = iso(BASE)
  const doc = buildInventoryObject([], {}, { generatedAt: at, refreshedAt: at })
  assert.equal(doc.generatedAt, at)
  assert.equal(doc.refreshedAt, at)
})
