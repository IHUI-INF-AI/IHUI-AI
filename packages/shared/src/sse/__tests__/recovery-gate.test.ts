// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-816031 权威信封闸门成对测试(判据源 packages/shared/src/sse/recovery-gate.ts)
//
// 台账三条验收逐条对齐,不是平行自证:
//  ① 只有 `deliveryKind == recovery` 能解门 —— **RPC 响应先到的反例必须红**;
//  ② reason-code 用封闭集,未知码 ⇒ 未判定并报名,**不得默认「重订阅」也不得默认「不用」**;
//  ③ 迟到旧片被丢弃时 assembler 的既有序号不得被重置。
//
// 本文件**不重写任何判据**:结论全部来自生产出口(createRecoveryGate /
// readDeliveryKind / decideSubscriptionFromEnvelope / readChunkOrdinal),
// 封闭集也是从同一张表遍历取得(守门 191「测试判据复制对账」禁止在此抄第二份名单;
// 守门 120「名单类判据必须正向证明」要求每条成员都被拿当输入)。

import { describe, expect, it } from 'vitest'

import {
  RECOVERY_DELIVERY_KINDS,
  RECOVERY_DELIVERY_KIND_LIST,
  RECOVERY_REASON_CODE_DECISIONS,
  RECOVERY_REASON_CODES,
  createRecoveryGate,
  decideSubscriptionFromEnvelope,
  formatRecoveryGateLedger,
  readChunkOrdinal,
  readDeliveryKind,
  type RecoveryGateLedger,
} from '../recovery-gate'

const recoveryEnvelope = (): Record<string, unknown> => ({
  deliveryKind: RECOVERY_DELIVERY_KINDS.RECOVERY,
})

/** 三轴都跑一遍的混合账目(D1 用),顺序即真实到达序:RPC 先到 → 迟到片 → 恢复帧。 */
function runMixedScenario(): RecoveryGateLedger {
  const gate = createRecoveryGate()
  gate.applyAuthority({ deliveryKind: RECOVERY_DELIVERY_KINDS.RPC_RESPONSE })
  gate.applyAuthority(recoveryEnvelope())
  gate.applyAuthority({ deliveryKind: RECOVERY_DELIVERY_KINDS.PAGE })
  gate.applyAuthority({ deliveryKind: 'recovery-fork' })
  gate.applyAuthority({ reasonCode: 'authority-current' })
  gate.acceptChunk({ ordinal: 4 })
  gate.acceptChunk({ ordinal: 2 })
  gate.acceptChunk({ ordinal: 'x' })
  gate.decideSubscription({ reasonCode: 'authority-current' })
  gate.decideSubscription({ reasonCode: 'stale-epoch' })
  gate.decideSubscription({ reasonCode: 'not-in-the-closed-set' })
  return gate.ledger()
}

// ============================================================================
// 验收①:解 fail-closed 闸门只认权威信封字段,不认 RPC 时序
// ============================================================================

describe('G-816031 验收①:只有 deliveryKind == recovery 能解门', () => {
  it('A1 recovery 信封解门:verdict=release、闸门转开、账目计 release 而不计 hold', () => {
    const gate = createRecoveryGate()
    expect(gate.snapshot().open).toBe(false) // fail-closed 是缺省,不是要调用方设的
    const decision = gate.applyAuthority(recoveryEnvelope())
    expect(decision.verdict).toBe('release')
    expect(decision.reason).toBe('recovery-delivery')
    expect(decision.changed).toBe(true)
    expect(gate.snapshot().open).toBe(true)
    const ledger = gate.ledger()
    expect(ledger.released).toBe(1)
    expect(ledger.held).toBe(0)
    expect(ledger.undetermined).toBe(0)
  })

  it('A2(票面①的反例,必须红)RPC 响应先到 ⇒ 不得解门;随后 recovery 才解', () => {
    const gate = createRecoveryGate()
    const rpc = gate.applyAuthority({ deliveryKind: RECOVERY_DELIVERY_KINDS.RPC_RESPONSE })
    expect(rpc.verdict).toBe('hold')
    expect(gate.snapshot().open).toBe(false)
    expect(gate.ledger().released).toBe(0)
    // 时序在这里唯一的意义是"它先来了" —— 它来了也没解门,解门的仍是那一条 recovery
    expect(gate.applyAuthority(recoveryEnvelope()).verdict).toBe('release')
    expect(gate.snapshot().open).toBe(true)
  })

  it('A3 封闭集逐条正向证明:除 recovery 外的每个通道都只得到 hold', () => {
    expect(RECOVERY_DELIVERY_KIND_LIST.length).toBeGreaterThan(1)
    const nonRecovery = RECOVERY_DELIVERY_KIND_LIST.filter(
      (kind) => kind !== RECOVERY_DELIVERY_KINDS.RECOVERY,
    )
    expect(nonRecovery.length).toBeGreaterThan(0)
    for (const kind of nonRecovery) {
      const gate = createRecoveryGate()
      const decision = gate.applyAuthority({ deliveryKind: kind })
      // 逐条正向证明:名单里每一条都必须只得到 hold,且门仍是闭的
      expect({ kind, decision }).toEqual({
        kind,
        decision: {
          verdict: 'hold',
          reason: 'non-recovery-delivery',
          deliveryKind: `'${kind}'`,
          changed: false,
        },
      })
      expect(gate.snapshot().open).toBe(false)
    }
    // recovery 自身必须可判(名单里唯一能给 release 的那一条,漏了它整张表都在假绿)
    const gate = createRecoveryGate()
    expect(gate.applyAuthority({ deliveryKind: RECOVERY_DELIVERY_KINDS.RECOVERY }).verdict).toBe(
      'release',
    )
  })

  it('A4 正常翻页 / 续流 / 常规流不得被误判成解门(票面验证清单第 2 条)', () => {
    const gate = createRecoveryGate()
    expect(gate.applyAuthority({ deliveryKind: RECOVERY_DELIVERY_KINDS.PAGE }).verdict).toBe('hold')
    expect(gate.applyAuthority({ deliveryKind: RECOVERY_DELIVERY_KINDS.RESUME }).verdict).toBe(
      'hold',
    )
    expect(gate.applyAuthority({ deliveryKind: RECOVERY_DELIVERY_KINDS.STREAM }).verdict).toBe(
      'hold',
    )
    expect(gate.snapshot().open).toBe(false)
    expect(gate.ledger()).toMatchObject({ released: 0, held: 3, undetermined: 0 })
  })

  it('A5 时序字段结构上不被读:带/不带时序键的信封给出逐字同结论', () => {
    const withoutTiming = { deliveryKind: RECOVERY_DELIVERY_KINDS.RPC_RESPONSE }
    const withTiming = {
      deliveryKind: RECOVERY_DELIVERY_KINDS.RPC_RESPONSE,
      arrivedFirst: true,
      rpcResponseFirst: true,
      arrivedBeforeAck: true,
      arrivalIndex: 0,
      ackPending: false,
    }
    const strip = (gate: ReturnType<typeof createRecoveryGate>, envelope: unknown) => {
      const d = gate.applyAuthority(envelope)
      return {
        verdict: d.verdict,
        reason: d.reason,
        deliveryKind: d.deliveryKind,
        open: gate.snapshot().open,
      }
    }
    expect(strip(createRecoveryGate(), withTiming)).toEqual(
      strip(createRecoveryGate(), withoutTiming),
    )
    // 反向:即便时序键声称"recovery 之后才到",解门与否仍只由通道决定
    const late = createRecoveryGate()
    expect(
      strip(late, { deliveryKind: RECOVERY_DELIVERY_KINDS.RECOVERY, arrivedFirst: false }),
    ).toEqual({
      verdict: 'release',
      reason: 'recovery-delivery',
      deliveryKind: `'${RECOVERY_DELIVERY_KINDS.RECOVERY}'`,
      open: true,
    })
  })

  it('A6 通道缺席 / 异形 / 集外 ⇒ 未判定:不解门、不记 hold、逐条报名点名原值', () => {
    const gate = createRecoveryGate()
    const cases: readonly { input: unknown; reason: string }[] = [
      { input: {}, reason: 'delivery-kind-absent' },
      { input: { deliveryKind: 42 }, reason: 'delivery-kind-malformed' },
      { input: { deliveryKind: '' }, reason: 'delivery-kind-malformed' },
      { input: { deliveryKind: '   ' }, reason: 'delivery-kind-malformed' },
      { input: { deliveryKind: ['recovery'] }, reason: 'delivery-kind-malformed' },
      { input: { deliveryKind: 'recovery-fork' }, reason: 'delivery-kind-unknown' },
      { input: { deliveryKind: 'Recovery' }, reason: 'delivery-kind-unknown' },
      { input: null, reason: 'envelope-unreadable' },
    ]
    for (const { input, reason } of cases) {
      const single = createRecoveryGate()
      const decision = single.applyAuthority(input)
      // 三态不并桶:未判定既不是 hold(那是"确信不用"),也不是 release
      expect(decision.verdict).toBe('undetermined')
      expect(decision.reason).toBe(reason)
      expect(single.snapshot().open).toBe(false)
      const ledger = single.ledger()
      expect(ledger).toMatchObject({ released: 0, held: 0, undetermined: 1 })
      expect(ledger.undeterminedItems).toHaveLength(1)
      expect(ledger.undeterminedItems[0]).toMatchObject({ axis: 'gate-release', reason })
    }
    for (const item of cases) gate.applyAuthority(item.input)
    const items = gate.ledger().undeterminedItems
    expect(items).toHaveLength(cases.length)
    expect(items.every((entry) => entry.axis === 'gate-release')).toBe(true)
    // 报名顺序 = 到达顺序,且原因逐条对得上(合计对不上就是并桶了)
    expect(items.map((entry) => entry.reason)).toEqual(cases.map((entry) => entry.reason))
    // 集外通道必须被**报名到具体原值**,只报计数就等于"这一格没人看过"
    expect(items.map((entry) => entry.raw)).toContain("'recovery-fork'")
  })

  it('A7 snake_case 线格式同视(与 readFrameWatermark 的两族键取向一致)', () => {
    const gate = createRecoveryGate()
    expect(gate.applyAuthority({ delivery_kind: RECOVERY_DELIVERY_KINDS.RECOVERY }).verdict).toBe(
      'release',
    )
    expect(readDeliveryKind({ delivery_kind: RECOVERY_DELIVERY_KINDS.PAGE })).toMatchObject({
      verdict: 'known',
      kind: RECOVERY_DELIVERY_KINDS.PAGE,
    })
  })

  it('A8 recovery 幂等重放:照计 release,但 changed=false 且不动既有序号', () => {
    const gate = createRecoveryGate()
    gate.acceptChunk({ ordinal: 9 })
    expect(gate.applyAuthority(recoveryEnvelope()).changed).toBe(true)
    const again = gate.applyAuthority(recoveryEnvelope())
    expect(again.changed).toBe(false)
    expect(gate.ledger().released).toBe(2)
    expect(gate.snapshot().settledOrdinal).toBe(9)
  })
})

// ============================================================================
// 验收②:判「要不要重订阅」只认封闭 reason-code 集
// ============================================================================

describe('G-816031 验收②:reason-code 封闭集 + 未知码未判定', () => {
  it('B1 封闭集逐条正向证明:每条成员的输入取自名单本身,结论取自同一张表', () => {
    expect(RECOVERY_REASON_CODES.length).toBeGreaterThan(0)
    for (const code of RECOVERY_REASON_CODES) {
      expect(decideSubscriptionFromEnvelope({ reasonCode: code })).toEqual({
        verdict: RECOVERY_REASON_CODE_DECISIONS[code],
        reasonCode: code,
        detail: 'reason-code-listed',
        raw: null,
      })
    }
  })

  it('B2 两档都必须在集内代表(否则"封闭集"就退化成一味催重订阅)', () => {
    const resubscribe = RECOVERY_REASON_CODES.filter(
      (code) => RECOVERY_REASON_CODE_DECISIONS[code] === 'resubscribe',
    )
    const keep = RECOVERY_REASON_CODES.filter(
      (code) => RECOVERY_REASON_CODE_DECISIONS[code] === 'keep-subscription',
    )
    expect(resubscribe.length).toBeGreaterThan(0)
    expect(keep.length).toBeGreaterThan(0)
    // 未知档形状锁:表里不得出现第三种结论(第三态是"未判定",不住在表里)
    const decisions = new Set<string>(
      RECOVERY_REASON_CODES.map((code) => RECOVERY_REASON_CODE_DECISIONS[code]),
    )
    expect([...decisions].sort()).toEqual(['keep-subscription', 'resubscribe'])
  })

  it('B3 未知码 ⇒ 未判定 + 报名点名原值,且状态一字不变(既不默认重订阅也不默认不用)', () => {
    const gate = createRecoveryGate()
    gate.applyAuthority(recoveryEnvelope())
    gate.acceptChunk({ ordinal: 6 })
    const before = gate.snapshot()
    const outcome = gate.decideSubscription({ reasonCode: 'stale-something-not-listed' })
    expect(outcome).toMatchObject({
      verdict: 'undetermined',
      reasonCode: null,
      detail: 'reason-code-unknown',
    })
    expect(outcome.raw).toBe("'stale-something-not-listed'")
    expect(gate.snapshot()).toEqual(before)
    const ledger = gate.ledger()
    expect(ledger).toMatchObject({
      resubscribe: 0,
      keepSubscription: 0,
      subscriptionUndetermined: 1,
    })
    expect(ledger.undeterminedItems).toContainEqual({
      axis: 'subscription',
      reason: 'reason-code-unknown',
      raw: "'stale-something-not-listed'",
    })
  })

  it('B4 reason-code 缺席 ⇒ 未判定(缺席不是"没有码所以不用重订阅")', () => {
    expect(decideSubscriptionFromEnvelope({})).toMatchObject({
      verdict: 'undetermined',
      detail: 'reason-code-absent',
    })
    expect(decideSubscriptionFromEnvelope({ deliveryKind: 'recovery' })).toMatchObject({
      verdict: 'undetermined',
      detail: 'reason-code-absent',
    })
  })

  it('B5 异形码(数字/空串/空白/数组/对象/null)一律未判定,不得就近取整', () => {
    const malformed: readonly unknown[] = [
      42,
      '',
      '   ',
      ['stale-epoch'],
      { code: 'stale-epoch' },
      true,
    ]
    for (const value of malformed) {
      expect(decideSubscriptionFromEnvelope({ reasonCode: value }).verdict).toBe('undetermined')
    }
    expect(decideSubscriptionFromEnvelope(null).verdict).toBe('undetermined')
    expect(decideSubscriptionFromEnvelope('stale-epoch').verdict).toBe('undetermined')
  })

  it('B6 判据是精确等值,不是字符串模糊匹配(上游 staleAuthorityRecovery 同一条纪律)', () => {
    for (const near of [
      'stale',
      'stale-',
      'stale-epoch-x',
      'stale-epoch2',
      'STALE-EPOCH',
      ' stale-epoch ',
      'stale-revision',
      'stale-target',
    ]) {
      expect(decideSubscriptionFromEnvelope({ reasonCode: near }).verdict).toBe('undetermined')
    }
    // 上游那两个我方没有的码不得被我顺手加进封闭集(照抄上游名单 = 第二份真相)
    expect(RECOVERY_REASON_CODES).not.toContain('stale-revision')
    expect(RECOVERY_REASON_CODES).not.toContain('stale-target')
  })

  it('B7 两条判据不得互推:通道不定码、码不解门', () => {
    // stream 通道 + 集内 stale 码 ⇒ 码判重订阅,门仍闭(用码解门 = ①的反例)
    const streamGate = createRecoveryGate()
    streamGate.applyAuthority({ deliveryKind: RECOVERY_DELIVERY_KINDS.STREAM })
    for (const code of RECOVERY_REASON_CODES.filter(
      (c) => RECOVERY_REASON_CODE_DECISIONS[c] === 'resubscribe',
    )) {
      expect(streamGate.decideSubscription({ reasonCode: code }).verdict).toBe('resubscribe')
    }
    expect(streamGate.snapshot().open).toBe(false)

    // recovery 通道 + 集外码 ⇒ 解门(①)但订阅判定仍未判定(②,不得默认重订阅)
    const forked = createRecoveryGate()
    expect(forked.applyAuthority({ deliveryKind: RECOVERY_DELIVERY_KINDS.RECOVERY }).verdict).toBe(
      'release',
    )
    expect(forked.decideSubscription({ reasonCode: 'stale-log-epoch-ish' }).verdict).toBe(
      'undetermined',
    )
    expect(forked.ledger()).toMatchObject({ released: 1, resubscribe: 0, keepSubscription: 0 })
    // 反向:未知码不得反过来把已经解开的门顶回去
    expect(forked.snapshot().open).toBe(true)
  })

  it('B8 snake_case 码同视 + 码在 payload 内也认(信封形状由调用方决定,判据只认键名)', () => {
    expect(decideSubscriptionFromEnvelope({ reason_code: 'stale-epoch' }).verdict).toBe(
      'resubscribe',
    )
    expect(decideSubscriptionFromEnvelope({ reason_code: 'authority-current' }).verdict).toBe(
      'keep-subscription',
    )
  })
})

// ============================================================================
// 验收③:迟到旧片被丢弃时,assembler 的既有序号不得被重置
// ============================================================================

describe('G-816031 验收③:丢弃迟到旧片不重置既有序号', () => {
  it('C1 升序进片:水位逐片推进,accept 计数与 snapshot 同源', () => {
    const gate = createRecoveryGate()
    for (const ordinal of [1, 2, 3, 4, 5, 6, 7]) {
      expect(gate.acceptChunk({ ordinal }).kind).toBe('accept')
    }
    expect(gate.snapshot().settledOrdinal).toBe(7)
    expect(gate.ledger()).toMatchObject({ chunksAccepted: 7, chunksDroppedLate: 0 })
  })

  it('C2 迟到旧片(序号低于水位)⇒ drop-late,既有序号**逐字未动**', () => {
    const gate = createRecoveryGate()
    for (const ordinal of [1, 2, 3, 4, 5, 6, 7]) gate.acceptChunk({ ordinal })
    const before = gate.snapshot()
    const disposition = gate.acceptChunk({ ordinal: 3 })
    expect(disposition.kind).toBe('drop-late')
    expect(disposition.reason).toBe('at-or-behind-watermark')
    expect(disposition.ordinal).toBe(3)
    // 票面③的机器证据:判定后水位 == 判定前水位
    expect(disposition.settledOrdinalAfter).toBe(before.settledOrdinal)
    expect(gate.snapshot()).toEqual(before)
    expect(gate.ledger()).toMatchObject({ chunksAccepted: 7, chunksDroppedLate: 1 })
  })

  it('C3 同序号重放也按迟到处理(幂等,不重复推进水位)', () => {
    const gate = createRecoveryGate()
    expect(gate.acceptChunk({ ordinal: 5 }).kind).toBe('accept')
    const replay = gate.acceptChunk({ ordinal: 5 })
    expect(replay.kind).toBe('drop-late')
    expect(replay.settledOrdinalAfter).toBe(5)
    expect(gate.ledger()).toMatchObject({ chunksAccepted: 1, chunksDroppedLate: 1 })
  })

  it('C4(上游 recover() 的同一格)解门只解门:既有序号保住,迟到片此后仍静默丢', () => {
    const gate = createRecoveryGate()
    for (const ordinal of [1, 2, 3, 4, 5, 6, 7]) gate.acceptChunk({ ordinal })
    const settledBefore = gate.snapshot().settledOrdinal
    expect(gate.applyAuthority(recoveryEnvelope()).verdict).toBe('release')
    expect(gate.snapshot().settledOrdinal).toBe(settledBefore)
    // 门开了以后,迟到片仍被丢 —— "解了门"不等于"把水位倒回起点重放一遍"
    expect(gate.acceptChunk({ ordinal: 4 }).kind).toBe('drop-late')
    expect(gate.acceptChunk({ ordinal: 0 }).kind).toBe('drop-late')
    expect(gate.snapshot().settledOrdinal).toBe(settledBefore)
    expect(gate.acceptChunk({ ordinal: 8 }).kind).toBe('accept')
  })

  it('C5 序号缺席 / 异形 ⇒ 未判定:既不 accept 也不 drop-late,状态零变化', () => {
    const gate = createRecoveryGate()
    gate.acceptChunk({ ordinal: 11 })
    const before = gate.snapshot()
    const cases: readonly { input: unknown; reason: string }[] = [
      { input: {}, reason: 'ordinal-absent' },
      { input: { ordinal: '12' }, reason: 'ordinal-malformed' },
      { input: { ordinal: 12.5 }, reason: 'ordinal-malformed' },
      { input: { ordinal: -1 }, reason: 'ordinal-malformed' },
      { input: { ordinal: Number.NaN }, reason: 'ordinal-malformed' },
      { input: { ordinal: Number.POSITIVE_INFINITY }, reason: 'ordinal-malformed' },
      { input: null, reason: 'input-unreadable' },
    ]
    for (const { input, reason } of cases) {
      const disposition = gate.acceptChunk(input)
      expect(disposition.kind).toBe('undetermined')
      expect(disposition.reason).toBe(reason)
      expect(disposition.settledOrdinalAfter).toBe(before.settledOrdinal)
      expect(gate.snapshot()).toEqual(before)
    }
    const ledger = gate.ledger()
    expect(ledger).toMatchObject({
      chunksAccepted: 1,
      chunksDroppedLate: 0,
      chunksUndetermined: cases.length,
    })
    expect(ledger.undeterminedItems.filter((item) => item.axis === 'chunk')).toHaveLength(
      cases.length,
    )
  })

  it('C6 本层不读 tool-delta 的 seq(contract.ts 现行口径的形状锁:seq 不参与收敛)', () => {
    const gate = createRecoveryGate()
    expect(gate.acceptChunk({ seq: 99 }).kind).toBe('undetermined')
    expect(gate.acceptChunk({ seq: 99 }).reason).toBe('ordinal-absent')
    expect(readChunkOrdinal({ seq: 3, ordinal: 4 })).toMatchObject({ verdict: 'known', ordinal: 4 })
    // 没确认过任何一片 ⇒ null,而不是被折成 0(0 会被下一片当成"已经见到第 0 片")
    expect(gate.snapshot()).toEqual({ open: false, settledOrdinal: null })
  })

  it('C7 清零只有换代这一条路,且必须带理由;计数入账不静默', () => {
    const gate = createRecoveryGate()
    gate.acceptChunk({ ordinal: 12 })
    gate.applyAuthority(recoveryEnvelope())
    expect(() => gate.resetForNewGeneration('')).toThrow(TypeError)
    expect(() => gate.resetForNewGeneration('   ')).toThrow(TypeError)
    // 拒绝理由不合格的换代之后,状态必须与拒绝前逐字相同(否则 throw 只是装饰)
    expect(gate.snapshot()).toEqual({ open: true, settledOrdinal: 12 })
    gate.resetForNewGeneration('订阅换代:server 侧重新分配 subscriptionId')
    // 换代把既有序号退回"没确认过任何一片"(null),而不是"已确认第 0 片"(0)
    expect(gate.snapshot()).toEqual({ open: false, settledOrdinal: null })
    const ledger = gate.ledger()
    expect(ledger.generationResets).toBe(1)
    // 换代不丢账:它是观测台账,不是状态本身(丢了就没有人知道水位曾被清零)
    expect(ledger).toMatchObject({ released: 1, chunksAccepted: 1 })
    // 换代后的新代际可以从 0 重新起算 —— 这正是它与"迟到片被丢"的分界
    expect(gate.acceptChunk({ ordinal: 0 }).kind).toBe('accept')
    expect(gate.snapshot().settledOrdinal).toBe(0)
  })

  it('C8 序号 0 是合法值(不是缺席),首片即 0 也照收', () => {
    const gate = createRecoveryGate()
    expect(gate.acceptChunk({ ordinal: 0 }).kind).toBe('accept')
    expect(gate.snapshot().settledOrdinal).toBe(0)
    expect(gate.ledger().chunksAccepted).toBe(1)
    expect(gate.acceptChunk({ ordinal: 0 }).kind).toBe('drop-late')
  })
})

// ============================================================================
// 三态账目:不得并桶 + 读数版式
// ============================================================================

describe('G-816031 三态账目', () => {
  it('D1 三轴各自三态,互不顶账(混合场景逐格核)', () => {
    const ledger = runMixedScenario()
    // 解门轴:rpc-response(hold) / recovery(release) / page(hold) / 'recovery-fork'(未判定)
    //        + 一条只有 reasonCode 的信封(未判定)
    expect(ledger).toMatchObject({ released: 1, held: 2, undetermined: 2 })
    // 片轴:4 accept / 2 drop-late / 'x' 未判定
    expect(ledger).toMatchObject({ chunksAccepted: 1, chunksDroppedLate: 1, chunksUndetermined: 1 })
    // 码轴:keep / resubscribe / 未判定
    expect(ledger).toMatchObject({
      resubscribe: 1,
      keepSubscription: 1,
      subscriptionUndetermined: 1,
    })
    // 未判定报名合计 = 三轴未判定之和(并桶的第一种表现就是这里对不上)
    expect(ledger.undeterminedItems).toHaveLength(
      ledger.undetermined + ledger.chunksUndetermined + ledger.subscriptionUndetermined,
    )
    const axes = new Set(ledger.undeterminedItems.map((item) => item.axis))
    expect([...axes].sort()).toEqual(['chunk', 'gate-release', 'subscription'])
    expect(ledger.generationResets).toBe(0)
  })

  it('D2 读数版式喊得出三个"未判定"与逐条报名(接线方靠它把第三态说出口)', () => {
    const line = formatRecoveryGateLedger(runMixedScenario())
    expect(line).toContain('[recovery-gate]')
    expect(line.match(/未判定=/g)).toHaveLength(3)
    expect(line).toContain('报名=4')
    expect(line).toContain('gate-release:delivery-kind-unknown')
    // 断言一条真实报名串必须同时含轴、原因与被拒读的原值 —— 只报计数就是"没看过"
    expect(line).toMatch(/chunk:ordinal-malformed='x'/)
    // 阳性对照:全零账目也得打印出来(空账不等于"这一维不存在")
    expect(formatRecoveryGateLedger(createRecoveryGate().ledger())).toContain(
      '解门 release=0 hold=0 未判定=0',
    )
    // 读数打到 stdout:票面要"未知码逐条报名",而报名只有被打印出来才可被人读到
    console.info(line)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
