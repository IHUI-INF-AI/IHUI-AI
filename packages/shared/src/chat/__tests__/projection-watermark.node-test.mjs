// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 G-816006 的验收入口:`node --test packages/shared/src/chat/__tests__/projection-watermark.node-test.mjs`
 *
 * 文件名刻意是 `-node-test.mjs`(连字符,不是 `.test.`):本文件跑在 **node:test** 上,不是 vitest 用例。
 * 而 vitest 的收集 glob(见 `packages/shared/vitest.config.ts` 的 COLLECT_INCLUDE)与
 * `tests/chat/waiting-keys-collection.test.ts` 的 TEST_FILE_RE,都要求 `.test.` / `.spec.` 中间那个
 * **点**;旧名 `projection-watermark.test.mjs` 两侧同时命中,后果是 vitest 把它收进运行面却在本框架里
 * 报 `No test suite found in file` ⇒ 整包 `vitest run` 与 CI 的 `pnpm turbo run test` 一起红,
 * 而那把装载尺子又把它算进"磁盘全集"。往 exclude 里加一条不是出路(那会让尺子的 dropped 非空,
 * 等于把本包自己的装载证明改瞎);这里走的是配置注释点名的另一条 —— 让它既不被 vitest 收集,
 * 也不被磁盘全集判据当用例。改动这两处判据之前,先读上面那段。
 *
 * 判据只住在 `../projection-watermark.ts` 一份(§22c:测试不得抄第二份判据)——
 * 本文件不重算序号规则,只把帧喂给生产入口并断言它给出的判决。
 *
 * 成对是硬要求:每条"必拒"都配一条"不得误拒"。只留前者,这道协议就可能只是把功能改坏了。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  acknowledge,
  applyFrame,
  createWatermarkState,
  isApplyReason,
  isBaselineUsable,
  isDropReason,
  isRejectReason,
  isWatermarkReason,
  judgeFrame,
  noteBaselineReceived,
  PROJECTION_WATERMARK_APPLY_REASONS,
  PROJECTION_WATERMARK_DROP_REASONS,
  PROJECTION_WATERMARK_REASONS,
  PROJECTION_WATERMARK_REJECT_REASONS,
  requestResync,
} from '../projection-watermark.ts'

/** 建立一份可用基线:代次 A,水位 10。 */
function seeded() {
  const start = createWatermarkState()
  const t = applyFrame(start, { kind: 'initial', baseId: 'A', seq: 10 })
  assert.equal(t.verdict.action, 'apply')
  return t.state
}

// ── 验收 ①:initial 丢失 + fromSeq 恰好等于本地 seq ⇒ 必拒并请求 resync ──────────────
test('① initial 从未落地:fromSeq 恰好对上本地水位也必拒,且产出 resync', () => {
  const start = createWatermarkState()
  // 手上那份"旧投影"是上一次会话留下的,协议眼里从未应用过基线 ⇒ 水位是 null。
  // 诱惑面:delta 声称从 11 开始,数值上与"旧投影的下一条"完全对得上。
  const t = applyFrame(start, { kind: 'delta', fromSeq: 11, toSeq: 12 })
  assert.equal(t.verdict.action, 'resync')
  assert.equal(t.verdict.reason, 'no-baseline')
  assert.ok(PROJECTION_WATERMARK_REJECT_REASONS.includes(t.verdict.reason))
  assert.equal(t.state.awaitingBase, true, '拒绝必须同时把"在等重订阅"记进状态')
  assert.equal(t.state.baselineApplied, false)
})

test('① 全量帧被 ACK 但没应用(ACK 不构成可用基线):同代次数值连续的 delta 仍必拒', () => {
  const base = seeded() // 旧基线 A,水位 10
  // 新代次 B 的 snapshot 收到了、也 ACK 了,但 payload 丢了没进投影。
  const received = acknowledge(base, { kind: 'snapshot', baseId: 'B', seq: 10 }, false)
  assert.equal(received.acked, false)
  assert.equal(received.state.baselineApplied, true, 'ACK 不得抹掉旧基线,但也不得兑现新基线')
  assert.notEqual(received.state.pendingBaseId, null)
  // 新 epoch 的第一条 delta:fromSeq 恰好等于本地 seq(10+1 的上一种写法 = 10 本身,两种都对不上)
  const asNext = applyFrame(received.state, { kind: 'delta', baseId: 'B', fromSeq: 11, toSeq: 11 })
  assert.equal(asNext.verdict.action, 'resync')
  assert.equal(asNext.verdict.reason, 'awaiting-base')
  const asEqual = applyFrame(received.state, { kind: 'delta', baseId: 'B', fromSeq: 10, toSeq: 10 })
  assert.equal(asEqual.verdict.action, 'resync', 'fromSeq 恰好等于本地 seq 时同样不得拼')
  assert.equal(asEqual.verdict.reason, 'awaiting-base')
})

test('① 反向对照:基线真落地后,noteBaselineReceived 不再拦合法 delta', () => {
  const base = seeded()
  const pending = noteBaselineReceived(base, { kind: 'snapshot', baseId: 'B' })
  assert.equal(applyFrame(pending, { kind: 'delta', baseId: 'B', fromSeq: 11 }).verdict.action, 'resync')
  // B 的全量帧真的应用了 ⇒ pending 清空,后续按 B 代次正常判定
  const applied = applyFrame(pending, { kind: 'snapshot', baseId: 'B', seq: 20 })
  assert.equal(applied.verdict.action, 'apply')
  assert.equal(applied.state.pendingBaseId, null)
  assert.equal(applied.state.awaitingBase, false)
  assert.equal(applyFrame(applied.state, { kind: 'delta', baseId: 'B', fromSeq: 21 }).verdict.action, 'apply')
})

// ── 验收 ②:resume 正常衔接 ⇒ 不得误判断档(误判会把每条 delta 变成全量重拉)──────────
test('② resume 同代次序号衔接:必须 apply,不得误判为断档', () => {
  const base = seeded()
  const t = applyFrame(base, { kind: 'delta', baseId: 'A', fromSeq: 11, toSeq: 13 })
  assert.equal(t.verdict.action, 'apply', '误判会把每条正常 delta 变成全量重拉 = 性能事故')
  assert.equal(t.verdict.reason, 'contiguous')
  assert.equal(t.verdict.dedupHead, false)
  assert.equal(t.state.appliedSeq, 13)
  assert.equal(isBaselineUsable(t.state), true)
})

test('② resume 重发最后一条(fromSeq === 本地 seq):放行其余部分并要求去重首条', () => {
  const base = seeded()
  const t = applyFrame(base, { kind: 'delta', baseId: 'A', fromSeq: 10, toSeq: 12 })
  assert.equal(t.verdict.action, 'apply', '这是 resume 的正常形态,不得误判为断档')
  assert.equal(t.verdict.reason, 'resume-overlap')
  assert.equal(t.verdict.dedupHead, true, '首条与已应用水位重合,必须回报去重义务')
  assert.equal(t.state.appliedSeq, 12)
})

// ── 跨代次 ────────────────────────────────────────────────────────────────
test('跨代次 delta:自带身份不符 ⇒ 拒(同代次 ⇒ 放行,成对)', () => {
  const base = seeded()
  const bad = applyFrame(base, { kind: 'delta', baseId: 'Z', fromSeq: 11, toSeq: 11 })
  assert.equal(bad.verdict.action, 'resync')
  assert.equal(bad.verdict.reason, 'base-mismatch')
  assert.equal(bad.state.appliedSeq, 10, '拒绝不得推进水位')
  const good = applyFrame(base, { kind: 'delta', baseId: 'A', fromSeq: 11, toSeq: 11 })
  assert.equal(good.verdict.action, 'apply')
})

test('上游无 epoch 通道:delta 不带身份 ⇒ 放行但如实回报 epochUnchecked(不静默、不编字段)', () => {
  const base = seeded()
  const untagged = applyFrame(base, { kind: 'delta', fromSeq: 11, toSeq: 11 })
  assert.equal(untagged.verdict.action, 'apply')
  assert.equal(untagged.verdict.epochUnchecked, true, '跨代次这一维没判到,必须被读出来')
  const tagged = applyFrame(base, { kind: 'delta', baseId: 'A', fromSeq: 11, toSeq: 11 })
  assert.equal(tagged.verdict.epochUnchecked, false, '带身份且相符 ⇒ 已判,不得谎报未判')
})

test('本地代次盖章:基线自带身份用上游值,不自带则按应用次数盖章(每换一次基线换一代)', () => {
  const fromUpstream = applyFrame(createWatermarkState(), { kind: 'initial', baseId: 'srv-42', seq: 1 })
  assert.equal(fromUpstream.state.baseId, 'srv-42')
  const g1 = applyFrame(createWatermarkState(), { kind: 'snapshot', seq: 5 })
  assert.equal(g1.state.baseId, 'local-gen-1')
  const g2 = applyFrame(g1.state, { kind: 'snapshot', seq: 9 })
  assert.equal(g2.state.baseId, 'local-gen-2', '换基线必须换代次,否则跨代次判据形同虚设')
  assert.notEqual(g2.state.baseId, g1.state.baseId)
})

// ── 重复帧 / 迟到帧静默丢弃 ─────────────────────────────────────────────────
test('重复帧:整段恰在水位上的重投 ⇒ drop,既不推进也不误判为断档', () => {
  const base = seeded()
  const t = applyFrame(base, { kind: 'delta', baseId: 'A', fromSeq: 10, toSeq: 10 })
  assert.equal(t.verdict.action, 'drop')
  assert.equal(t.verdict.reason, 'duplicate')
  assert.equal(t.state.appliedSeq, 10)
  assert.equal(isBaselineUsable(t.state), true, '丢弃重复帧不得把基线打成不可用')
})

test('迟到帧:整段都在水位之前 ⇒ drop(正反对照:正常下一帧不被误丢)', () => {
  const base = seeded()
  const late = applyFrame(base, { kind: 'delta', baseId: 'A', fromSeq: 3, toSeq: 7 })
  assert.equal(late.verdict.action, 'drop')
  assert.equal(late.verdict.reason, 'late')
  assert.equal(late.state.appliedSeq, 10)
  const fresh = applyFrame(base, { kind: 'delta', baseId: 'A', fromSeq: 11, toSeq: 11 })
  assert.equal(fresh.verdict.action, 'apply', '把正常帧误判成迟到 = 丢消息')
})

// ── 断档:只重订阅,不做本地补偿 ────────────────────────────────────────────
test('断档:跳号 ⇒ resync,且此后连"数值上接得上"的 delta 也一律拒,直到新基线落地', () => {
  const base = seeded()
  const gap = applyFrame(base, { kind: 'delta', baseId: 'A', fromSeq: 15, toSeq: 16 })
  assert.equal(gap.verdict.action, 'resync')
  assert.equal(gap.verdict.reason, 'gap')
  assert.equal(gap.state.awaitingBase, true)
  assert.equal(gap.state.appliedSeq, 10, '断档不得被本地补偿成 16')
  // 关键:不做本地补偿 ⇒ 断档之后即便来了一条"看起来接得上"的帧,也只能重订阅。
  const later = applyFrame(gap.state, { kind: 'delta', baseId: 'A', fromSeq: 11, toSeq: 11 })
  assert.equal(later.verdict.action, 'resync')
  assert.equal(later.verdict.reason, 'awaiting-base')
  // 全量重拉落地 ⇒ 恢复正常
  const resnap = applyFrame(later.state, { kind: 'initial', baseId: 'A', seq: 16 })
  assert.equal(resnap.verdict.action, 'apply')
  assert.equal(applyFrame(resnap.state, { kind: 'delta', baseId: 'A', fromSeq: 17 }).verdict.action, 'apply')
})

test('部分重叠(跨越水位)⇒ 判断档,不裁头补洞', () => {
  const base = seeded()
  const t = applyFrame(base, { kind: 'delta', baseId: 'A', fromSeq: 8, toSeq: 12 })
  assert.equal(t.verdict.action, 'resync')
  assert.equal(t.verdict.reason, 'gap', '裁掉 8..10 再拼 11..12 就是本地补偿,协议明令禁止')
})

test('requestResync 显式重订阅:置位后任何 delta 都拒,新基线才能解锁', () => {
  const armed = requestResync(seeded())
  assert.equal(armed.awaitingBase, true)
  assert.equal(applyFrame(armed, { kind: 'delta', baseId: 'A', fromSeq: 11 }).verdict.reason, 'awaiting-base')
  const fixed = applyFrame(armed, { kind: 'snapshot', baseId: 'A', seq: 11 })
  assert.equal(fixed.verdict.action, 'apply')
  assert.equal(isBaselineUsable(fixed.state), true)
})

// ── 基线从未建立(首帧就是 delta)────────────────────────────────────────────
test('首帧就是 delta:拒;同一条 delta 在基线之后放行(成对)', () => {
  const first = applyFrame(createWatermarkState(), { kind: 'delta', fromSeq: 1, toSeq: 2 })
  assert.equal(first.verdict.action, 'resync')
  assert.equal(first.verdict.reason, 'no-baseline')
  const ready = applyFrame(createWatermarkState(), { kind: 'snapshot', baseId: 'A', seq: 0 })
  assert.equal(ready.verdict.action, 'apply')
  const after = applyFrame(ready.state, { kind: 'delta', baseId: 'A', fromSeq: 1, toSeq: 2 })
  assert.equal(after.verdict.action, 'apply')
  assert.equal(after.state.appliedSeq, 2)
})

test('基线没带序号 ⇒ 水位未知:拒绝拼接并请求 resync(不做推断),带序号则放行', () => {
  const unknown = applyFrame(createWatermarkState(), { kind: 'snapshot', baseId: 'A' })
  assert.equal(unknown.verdict.action, 'apply', '全量帧本身可应用')
  assert.equal(unknown.state.appliedSeq, null)
  const t = applyFrame(unknown.state, { kind: 'delta', baseId: 'A', fromSeq: 1 })
  assert.equal(t.verdict.action, 'resync')
  assert.equal(t.verdict.reason, 'watermark-unknown')
  const known = applyFrame(createWatermarkState(), { kind: 'snapshot', baseId: 'A', seq: 0 })
  assert.equal(applyFrame(known.state, { kind: 'delta', baseId: 'A', fromSeq: 1 }).verdict.action, 'apply')
})

// ── ACK 的三条边界(它只是回执,不是基线)────────────────────────────────────
test('ACK 不推进水位、不建基线;未应用的帧不得被 ACK 成已应用', () => {
  const start = createWatermarkState()
  const ackBaseline = acknowledge(start, { kind: 'initial', baseId: 'A', seq: 10 }, false)
  assert.equal(ackBaseline.acked, false)
  assert.equal(ackBaseline.state.baselineApplied, false, 'ACK 兑现不了基线')
  assert.notEqual(ackBaseline.state.pendingBaseId, null)
  const ackDelta = acknowledge(seeded(), { kind: 'delta', fromSeq: 11, toSeq: 11 }, false)
  assert.equal(ackDelta.acked, false)
  assert.equal(ackDelta.state.appliedSeq, 10, 'ACK 绝不推进水位')
  assert.equal(ackDelta.state.awaitingBase, true, '承接到没拼上的帧 ⇒ 必须转成重订阅')
  const ackOk = acknowledge(seeded(), { kind: 'delta', fromSeq: 11, toSeq: 11 }, true)
  assert.equal(ackOk.acked, true)
  assert.equal(ackOk.state.appliedSeq, 10, '即便 ACK 成功,推进水位也只归 applyFrame 管')
})

// ── 纯度与只读视角 ─────────────────────────────────────────────────────────
test('judgeFrame 只读不改状态;applyFrame 不可变(纯函数,能安全放进 store reducer)', () => {
  const base = seeded()
  const frozen = { ...base }
  const v = judgeFrame(base, { kind: 'delta', baseId: 'A', fromSeq: 99, toSeq: 100 })
  assert.equal(v.action, 'resync')
  assert.deepEqual(base, frozen, '只读视角不得改动状态')
  const t = applyFrame(base, { kind: 'delta', baseId: 'A', fromSeq: 11, toSeq: 11 })
  assert.equal(t.state.appliedSeq, 11)
  assert.deepEqual(base, frozen, 'applyFrame 不得原地改动入参')
})

test('判决的 reason 全部落在登记的枚举里(防止判据长出未登记的第三种结论)', () => {
  const all = [
    judgeFrame(createWatermarkState(), { kind: 'delta', fromSeq: 1 }),
    judgeFrame(noteBaselineReceived(seeded(), { kind: 'snapshot', baseId: 'B' }), { kind: 'delta', fromSeq: 11 }),
    judgeFrame(seeded(), { kind: 'delta', baseId: 'B', fromSeq: 11 }),
    judgeFrame(seeded(), { kind: 'delta', baseId: 'A', fromSeq: 20 }),
    judgeFrame(seeded(), { kind: 'delta', baseId: 'A', fromSeq: 10, toSeq: 10 }),
    judgeFrame(seeded(), { kind: 'delta', baseId: 'A', fromSeq: 1, toSeq: 3 }),
    judgeFrame(seeded(), { kind: 'delta', baseId: 'A', fromSeq: 11, toSeq: 11 }),
  ]
  for (const v of all) {
    if (v.action === 'resync') assert.ok(PROJECTION_WATERMARK_REJECT_REASONS.includes(v.reason), v.reason)
    else assert.ok(true, `${v.action}:${v.reason}`)
  }
  assert.equal(all.length, 7)
})

// ── G-274 票面四臂(表驱动,一处可读)────────────────────────────────────────
test('G-274 四臂:initial 丢失/连续/迟到/重复 各归其位(拒档臂与放行臂成对)', () => {
  // ① initial 丢失,手上留着一份水位 10 的旧投影;新代次首帧 fromSeq 恰好 = 旧水位 + 1。
  // 数值上"完全接得上"正是诱惑面,协议必须只给 resync,不得把新 delta 拼到旧状态。
  const oldProjectionSeq = 10
  const lostBaseline = applyFrame(createWatermarkState(), {
    kind: 'delta',
    fromSeq: oldProjectionSeq + 1,
    toSeq: oldProjectionSeq + 1,
  })
  assert.equal(lostBaseline.verdict.action, 'resync', '① 数值对得上也必须拒')
  assert.equal(lostBaseline.verdict.reason, 'no-baseline')

  // ② 正常连续:同一代次、fromSeq = 水位 + 1 ⇒ apply。
  const contiguous = applyFrame(seeded(), { kind: 'delta', baseId: 'A', fromSeq: 11, toSeq: 11 })
  assert.equal(contiguous.verdict.action, 'apply', '② 正常衔接不得误判成断档')
  assert.equal(contiguous.verdict.reason, 'contiguous')

  // ③ 迟到旧帧:整段落在水位之前 ⇒ 静默丢弃,且不得把基线打成不可用。
  const late = applyFrame(seeded(), { kind: 'delta', baseId: 'A', fromSeq: 4, toSeq: 7 })
  assert.equal(late.verdict.action, 'drop')
  assert.equal(late.verdict.reason, 'late')
  assert.equal(late.state.appliedSeq, 10)
  assert.equal(isBaselineUsable(late.state), true)

  // ④ 重复帧:整段恰在水位上 ⇒ 幂等丢弃(水位不动、不触发重订阅)。
  const duplicate = applyFrame(seeded(), { kind: 'delta', baseId: 'A', fromSeq: 10, toSeq: 10 })
  assert.equal(duplicate.verdict.action, 'drop')
  assert.equal(duplicate.verdict.reason, 'duplicate')
  assert.equal(duplicate.state.appliedSeq, 10)
  assert.equal(duplicate.state.awaitingBase, false, '④ 重复帧不得触发重订阅')
})

// ── reason 封闭集:常量数组 ⇄ 类型守卫同源 ─────────────────────────────────
test('reason-code 封闭集:登记值反查为真,动作外取值与非法入参反查为假', () => {
  for (const reason of PROJECTION_WATERMARK_APPLY_REASONS) {
    assert.equal(isApplyReason(reason), true, `apply:${reason}`)
    assert.equal(isWatermarkReason(reason), true, `all:${reason}`)
    assert.equal(isDropReason(reason), false, '动作外取值不得混进 drop 集')
    assert.equal(isRejectReason(reason), false, '动作外取值不得混进 reject 集')
  }
  for (const reason of PROJECTION_WATERMARK_DROP_REASONS) {
    assert.equal(isDropReason(reason), true, `drop:${reason}`)
    assert.equal(isWatermarkReason(reason), true, `all:${reason}`)
    assert.equal(isApplyReason(reason), false)
    assert.equal(isRejectReason(reason), false)
  }
  for (const reason of PROJECTION_WATERMARK_REJECT_REASONS) {
    assert.equal(isRejectReason(reason), true, `resync:${reason}`)
    assert.equal(isWatermarkReason(reason), true, `all:${reason}`)
    assert.equal(isApplyReason(reason), false)
    assert.equal(isDropReason(reason), false)
  }
  // 合并集必须恰好是三份常量之和:多一个 / 少一个都说明登记表漂移。
  assert.deepEqual(
    [...PROJECTION_WATERMARK_REASONS].sort(),
    [...PROJECTION_WATERMARK_APPLY_REASONS, ...PROJECTION_WATERMARK_DROP_REASONS, ...PROJECTION_WATERMARK_REJECT_REASONS].sort(),
  )
  for (const bogus of ['', 'apply', 'applied', 'no_baseline', 'gap ', 0, null, undefined, {}, []]) {
    assert.equal(isWatermarkReason(bogus), false, `非法值不得被判成 reason:${String(bogus)}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
