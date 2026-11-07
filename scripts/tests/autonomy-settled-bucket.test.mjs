// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 空转阶梯**按行分档**的镜像锁(2026-11-05 立;§22c:判据 import 源 lib,本文件零复制判据)。
 *
 * 钉两件当场量出来的事:
 *  ① `dispatch-settled` 的动作名会说谎 —— 结算器把"推进了"和"零推进"发成同一个名字,
 *     真判据在行字段 `settled` 上。旧实现按动作名分档 ⇒ 每轮结算把该票空转**归零**:
 *     票 eb2ab5be4ad486ee 累计 dispatched 15 次 / valve-allow 17 次,而 `--status` 现读
 *     "当前封票:无"、本轮"空转扣住 0 行"。
 *  ② `runner-budget-exhausted` 曾被三档漏掉(覆盖面锁 C1 现读抓到:计数器会静默跳过它)。
 *
 * 每档都有成对夹具与反向牙:摘掉新逻辑(退回按动作名分档)必须翻红,不许只验新不验旧。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bucketOfRow,
  actionBucketOf,
  attemptsSinceProgress,
  breakdownNonProgress,
  ACTION_EXEMPTIONS,
} from '../lib/autonomy-nonprogress.mjs'

const T0 = Date.parse('2026-11-05T00:00:00Z')
const row = (i, extra = {}) => ({
  ticketKey: 'k1',
  ts: new Date(T0 + i * 1000).toISOString(),
  action: 'session-failed',
  ...extra,
})

test('N1 bucketOfRow 四态:零推进结算计入、真推进结算归零、缺字段未判定、其余走动作名档', () => {
  assert.equal(bucketOfRow({ action: 'dispatch-settled', settled: 'no-progress' }), 'non-progress')
  assert.equal(bucketOfRow({ action: 'dispatch-settled', settled: 'line-changed' }), 'progress')
  // 缺字段 / 不认识的新形态 ⇒ 未判定:既不归零也不累加,更不许悄悄选边
  assert.equal(bucketOfRow({ action: 'dispatch-settled' }), 'undetermined')
  assert.equal(bucketOfRow({ action: 'dispatch-settled', settled: 'row-gone' }), 'undetermined')
  // 非结算行动作名档原样成立(反向:新逻辑不许顺手改掉别的动作)
  assert.equal(bucketOfRow({ action: 'session-no-write' }), 'non-progress')
  assert.equal(bucketOfRow({ action: 'artifact-committed' }), 'progress')
  assert.equal(bucketOfRow({ action: 'quarantined' }), 'exempt')
  assert.equal(bucketOfRow({ action: 'totally-unknown-xyz' }), 'unclassified')
  // 动作名档本身保持旧语义(结算那一枚只是"默认档",由 bucketOfRow 覆盖)
  assert.equal(actionBucketOf('dispatch-settled'), 'progress')
})

test('N2 阶梯:零推进的结算必须**继续累加**,真推进的结算才归零(旧实现两者都归零)', () => {
  const ledger = [
    row(1),
    row(2, { action: 'session-failed' }),
    row(3, { action: 'dispatch-settled', settled: 'no-progress' }),
  ]
  assert.equal(
    attemptsSinceProgress(ledger, 'k1'),
    3,
    '三条都占班次 ⇒ 空转 3 次(旧实现读到结算行会归零)',
  )
  // 真推进 ⇒ 归零(这一档必须仍然成立,否则就是把"轮转"改成了"封死")
  const advanced = [...ledger, row(4, { action: 'dispatch-settled', settled: 'line-changed' })]
  assert.equal(attemptsSinceProgress(advanced, 'k1'), 0, '票行真被改写 ⇒ 空转归零')
  // 缺字段的结算 ⇒ 不增不减(反向对照:它前面的 non-progress 仍按原样计)
  const noField = [...ledger, row(5, { action: 'dispatch-settled' })]
  assert.equal(
    attemptsSinceProgress(noField, 'k1'),
    3,
    '认不出的一枚不许冒充"归零",也不许冒充"扣减"',
  )
})

test('N3 归口:runner-budget-exhausted 必须落进 exempt,且理由与挂点逐枚写清', () => {
  assert.equal(actionBucketOf('runner-budget-exhausted'), 'exempt')
  const e = ACTION_EXEMPTIONS['runner-budget-exhausted']
  assert.ok(e && e.reason.length >= 10, '豁免理由必须 ≥10 字')
  assert.match(e.reason, /没占|班次/, '理由必须落在允许的四种口径之一(这里是"没占班次")')
  assert.match(e.site, /auto-evolve\.mjs/, '挂点必须点到发射它的器物,不能只写"某处"')
})

test('N4 明细堆:零推进结算要出现在给到人的分档堆里(旧实现当场 break,邮件会说"没几次")', () => {
  const ledger = [
    row(1, { action: 'session-no-write' }),
    row(2, { action: 'dispatch-settled', settled: 'no-progress' }),
    row(3, { action: 'session-failed' }),
  ]
  const t = breakdownNonProgress(ledger, 'k1')
  const byName = Object.fromEntries(t.map((x) => [x.action, x.count]))
  assert.equal(byName['dispatch-settled'], 1, '零推进的结算必须被计入分档堆')
  assert.equal(byName['session-no-write'], 1)
  assert.equal(byName['session-failed'], 1)
  // 反向牙:遇到真推进的结算必须**停堆**(不得把更早的失败继续算进本轮空转)
  const stopped = [
    row(1, { action: 'session-failed' }),
    row(2, { action: 'dispatch-settled', settled: 'line-changed' }),
    row(3, { action: 'session-failed' }),
  ]
  const byName2 = Object.fromEntries(
    breakdownNonProgress(stopped, 'k1').map((x) => [x.action, x.count]),
  )
  assert.equal(byName2['session-failed'], 1, '只算真推进之前那一枚 ⇒ 第 3 条不该进来')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
