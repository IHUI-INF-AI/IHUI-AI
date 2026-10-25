// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-816031:api-client 侧恢复闸门 + 流级路由的三轴验收,以及与判据源的同形对账。
//
// 判据源 = packages/shared/src/sse/recovery-gate.ts(本包零依赖,不能 import;
// 同形移植件 = src/recovery-gate.ts)。本测试**不复制判据实现**,只跑生产出口:
//  · 解门只认 deliveryKind === 'recovery'(RPC 先到不得解);
//  · reasonCode 只认封闭集;未知码只记未判定,不默认任何一档;
//  · 迟到片丢弃不得重置 assembler 既有序号。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { createStreamAuthorityRouter } from '../src/stream-authority'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../..')

const content = (text = 'delta'): Record<string, unknown> => ({ type: 'delta', content: text })

describe('G-816031 流级权威路由:解门只认 recovery,不认时序', () => {
  it('旧生产端(从不带权威信封)逐帧放行,零行为变化', () => {
    const router = createStreamAuthorityRouter()
    for (let i = 0; i < 5; i += 1) {
      expect(router.observeFrame(content())).toEqual({
        drop: false,
        resubscribe: false,
        authority: false,
        reason: null,
      })
    }
    expect(router.ledger().released).toBe(0)
    expect(router.ledger().held).toBe(0)
  })

  it('RPC 响应先到不解门;门关着时普通帧不投递;只有 recovery 重新开门', () => {
    const router = createStreamAuthorityRouter()
    const rpcFirst = router.observeFrame({ deliveryKind: 'rpc-response' })
    expect(rpcFirst.drop).toBe(true)
    expect(rpcFirst.resubscribe).toBe(false)
    expect(router.snapshot().open).toBe(false)

    // 时序先到不构成授权:普通帧仍被 fail-closed 挡住
    expect(router.observeFrame(content()).drop).toBe(true)

    const recovery = router.observeFrame({ deliveryKind: 'recovery' })
    expect(recovery.drop).toBe(false)
    expect(router.snapshot().open).toBe(true)
    expect(router.observeFrame(content()).drop).toBe(false)
  })

  it('rpc-response / stream / page / resume 都不能解门(release 只属于 recovery)', () => {
    for (const deliveryKind of ['rpc-response', 'stream', 'page', 'resume']) {
      const router = createStreamAuthorityRouter()
      const verdict = router.observeFrame({ deliveryKind })
      expect(verdict.drop, deliveryKind).toBe(true)
      expect(router.snapshot().open, deliveryKind).toBe(false)
      expect(router.ledger().held, deliveryKind).toBe(1)
      expect(router.ledger().released, deliveryKind).toBe(0)
    }
  })
})

describe('G-816031 重订阅:只认封闭 reason-code 集', () => {
  it('封闭集内三枚 stale-* ⇒ resubscribe', () => {
    for (const reasonCode of ['stale-subscription-generation', 'stale-epoch', 'stale-sequence']) {
      const router = createStreamAuthorityRouter()
      const verdict = router.observeFrame({ deliveryKind: 'stream', reasonCode })
      expect(verdict.resubscribe, reasonCode).toBe(true)
      expect(router.ledger().resubscribe, reasonCode).toBe(1)
    }
  })

  it('明确不用重订阅的两码:不发起重连,也不解门', () => {
    for (const reasonCode of ['authority-current', 'recovery-in-flight']) {
      const router = createStreamAuthorityRouter()
      const verdict = router.observeFrame({ reasonCode })
      expect(verdict.resubscribe, reasonCode).toBe(false)
      expect(verdict.drop, reasonCode).toBe(false) // 控制帧本身放行
      expect(router.snapshot().open, reasonCode).toBe(false) // 但没有授予权威
      expect(router.ledger().keepSubscription, reasonCode).toBe(1)
    }
  })

  it('未知码 ⇒ 未判定 + 逐条报名;不默认重订阅、不默认不用、不解门', () => {
    const router = createStreamAuthorityRouter()
    const verdict = router.observeFrame({ reasonCode: 'brand-new-code' })
    expect(verdict.resubscribe).toBe(false)
    expect(verdict.drop).toBe(false)
    expect(router.snapshot().open).toBe(false)

    const ledger = router.ledger()
    expect(ledger.resubscribe).toBe(0)
    expect(ledger.keepSubscription).toBe(0)
    expect(ledger.subscriptionUndetermined).toBe(1)
    expect(ledger.undeterminedItems).toContainEqual({
      axis: 'subscription',
      reason: 'reason-code-unknown',
      raw: "'brand-new-code'",
    })

    // 未判定没有打开任何默认档:普通帧仍按 fail-closed 不投递
    expect(router.observeFrame(content()).drop).toBe(true)
  })

  it('两轴互不顶替:recovery 解门与未知 reasonCode 的未判定同时成立', () => {
    const router = createStreamAuthorityRouter()
    const verdict = router.observeFrame({
      deliveryKind: 'recovery',
      reasonCode: 'not-in-the-set',
    })
    expect(verdict.drop).toBe(false)
    expect(verdict.resubscribe).toBe(false)
    expect(router.snapshot().open).toBe(true)
    expect(router.ledger().subscriptionUndetermined).toBe(1)
  })
})

describe('G-816031 迟到片:丢弃但不得重置既有序号', () => {
  it('ordinal 5 接受 ⇒ 3 与重复 5 都 drop-late,settledOrdinal 恒为 5', () => {
    const router = createStreamAuthorityRouter()
    router.observeFrame({ deliveryKind: 'recovery' })

    const first = router.observeFrame({ ordinal: 5, type: 'chunk' })
    expect(first.drop).toBe(false)
    expect(router.snapshot().settledOrdinal).toBe(5)

    const late = router.observeFrame({ ordinal: 3, type: 'chunk' })
    expect(late.drop).toBe(true)
    expect(router.snapshot().settledOrdinal).toBe(5)

    const replay = router.observeFrame({ ordinal: 5, type: 'chunk' })
    expect(replay.drop).toBe(true)
    expect(router.snapshot().settledOrdinal).toBe(5)
    expect(router.ledger().chunksDroppedLate).toBe(2)
  })

  it('门关着时被丢弃的片不推进水位(没被接受过的 ordinal 不算既有序号)', () => {
    const router = createStreamAuthorityRouter()
    router.observeFrame({ deliveryKind: 'rpc-response' })
    const dropped = router.observeFrame({ ordinal: 9, type: 'chunk' })
    expect(dropped.drop).toBe(true)
    expect(router.snapshot().settledOrdinal).toBeNull()
  })
})

describe('G-816031 gap / 重连:关闸后必须等 recovery,不能静默沿用旧权威', () => {
  it('generation-change 后关闸并记换代;普通帧不投递;recovery 才能重开', () => {
    const router = createStreamAuthorityRouter()
    router.observeFrame({ deliveryKind: 'recovery' })
    expect(router.snapshot().open).toBe(true)

    router.observeGap('generation-change')
    expect(router.snapshot().open).toBe(false)
    expect(router.ledger().generationResets).toBe(1)
    expect(router.observeFrame(content()).drop).toBe(true)

    router.observeFrame({ deliveryKind: 'recovery' })
    expect(router.observeFrame(content()).drop).toBe(false)
  })

  it('重连 = 新订阅代际:关闸;legacy 流不受影响', () => {
    const legacy = createStreamAuthorityRouter()
    legacy.observeReconnect()
    expect(legacy.observeFrame(content()).drop).toBe(false)

    const aware = createStreamAuthorityRouter()
    aware.observeFrame({ deliveryKind: 'recovery' })
    aware.observeReconnect()
    expect(aware.snapshot().open).toBe(false)
    expect(aware.observeFrame(content()).drop).toBe(true)
  })
})

describe('G-816031 两侧同形与装车锁', () => {
  it('移植件与判据源的关键判据标记逐字同族(漂移即红)', () => {
    const local = readFileSync(resolve(REPO, 'packages/api-client/src/recovery-gate.ts'), 'utf8')
    const shared = readFileSync(resolve(REPO, 'packages/shared/src/sse/recovery-gate.ts'), 'utf8')
    for (const marker of [
      'export const RECOVERY_DELIVERY_KINDS',
      "RECOVERY: 'recovery'",
      'export const RECOVERY_REASON_CODE_DECISIONS',
      "'stale-subscription-generation': 'resubscribe'",
      'export function createRecoveryGate()',
      'settledOrdinal = read.ordinal',
      "kind: 'drop-late'",
      'resetForNewGeneration(reason)',
    ]) {
      expect(local.includes(marker), `local 缺 ${marker}`).toBe(true)
      expect(shared.includes(marker), `shared 缺 ${marker}`).toBe(true)
    }
  })

  it('判据源已进 shared barrel(包外可达)', () => {
    const barrel = readFileSync(resolve(REPO, 'packages/shared/src/sse/index.ts'), 'utf8')
    expect(barrel).toContain("export * from './recovery-gate'")
  })

  it('通路锁:streamChat 真消费路由(逐帧/ gap / 重连 / 账目四路都在)', () => {
    const src = readFileSync(resolve(REPO, 'packages/api-client/src/client.ts'), 'utf8')
    expect(src).toContain("from './stream-authority.js'")
    expect(src).toContain('streamAuthority.observeFrame(parsed)')
    expect(src).toContain('streamAuthority.observeGap(gap)')
    expect(src).toContain('streamAuthority.observeReconnect()')
    expect(src).toContain('reportRecoveryGateLedger()')
    expect(src).toContain('onRecoveryGateLedger?.(streamAuthority.ledger())')
  })
})

// ============================================================================
// G-60 票面验证第 3 条:时序乱序不得误关 / 真丢信封仍 fail-closed
// ============================================================================
// 上游锚点(topicWireDecoder.ts:80-92)的判据是"deliveryKind 是 publisher 权威信封事实,
// 只有 exact recovery 可原子解 gate,绝不按 RPC 时序猜测"。本块只把闸门当黑盒喂到达序,
// 不复制任何判据:乱序键(arrivedFirst / arrivalIndex)是**干扰项**,不是更高优先级的证据。
describe('G-60 时序乱序不得影响解门(信封权威优先)', () => {
  it('乱序正例:内容片自称先到、RPC 响应后到,recovery 最后到仍解门(时序键不改变结论)', () => {
    const router = createStreamAuthorityRouter()
    // 1) 权威字段首次出现即进入权威感知;rpc-response 自称"后到"仍是 hold,不解门
    const lateRpc = router.observeFrame({
      deliveryKind: 'rpc-response',
      arrivedFirst: false,
      arrivalIndex: 9,
    })
    expect(lateRpc.drop).toBe(true)
    expect(router.snapshot().open).toBe(false)
    // 2) 内容片自称"最先到"(arrivalIndex 更小)也不得穿过仍闭的门 —— 时序不构成证据
    const earlyContent = router.observeFrame({
      type: 'delta',
      content: 'a',
      arrivedFirst: true,
      arrivalIndex: 0,
    })
    expect(earlyContent.drop).toBe(true)
    expect(earlyContent.reason).toBe('authority-closed')
    expect(router.snapshot().open).toBe(false)
    // 3) 唯一解门的是权威信封自己 —— 即便时序键声称它最后到,也不得被误关
    const recovery = router.observeFrame({
      deliveryKind: 'recovery',
      arrivedFirst: false,
      arrivalIndex: 10,
    })
    expect(recovery.drop).toBe(false)
    expect(router.snapshot().open).toBe(true)
    // 4) 解门后内容片恢复投递(门开不是"一次性放行")
    expect(router.observeFrame({ type: 'delta', content: 'b' }).drop).toBe(false)
    // 5) 迟到的非权威帧不得把门关回去(乱序的另一向:不误关)
    const staleRpc = router.observeFrame({
      deliveryKind: 'rpc-response',
      arrivedFirst: true,
      arrivalIndex: 0,
    })
    expect(staleRpc.drop).toBe(false)
    expect(router.snapshot().open).toBe(true)
    expect(router.observeFrame({ type: 'delta', content: 'c' }).drop).toBe(false)
    expect(router.ledger()).toMatchObject({ released: 1, held: 2 })
  })

  it('阴性对照:recovery 曾解门后换代关门,此后真丢信封 ⇒ 恒 drop、门不得自己重开', () => {
    const router = createStreamAuthorityRouter()
    expect(router.observeFrame({ deliveryKind: 'recovery' }).drop).toBe(false)
    expect(router.snapshot().open).toBe(true)
    router.observeGap('generation-change')
    expect(router.snapshot().open).toBe(false)
    // 服务端此后只发普通帧(恢复信封丢了)⇒ 一律不投递,且门保持闭
    for (let i = 0; i < 3; i += 1) {
      const verdict = router.observeFrame({ type: 'delta', content: `lost-${i}` })
      expect(verdict.drop).toBe(true)
      expect(verdict.reason).toBe('authority-closed')
    }
    expect(router.snapshot().open).toBe(false)
    expect(router.ledger()).toMatchObject({ released: 1, held: 0 })
  })

  it('阴性对照:门关着时非对象帧也不得投递(fail-closed 不得被顶层数组/字符串/数字绕过)', () => {
    const router = createStreamAuthorityRouter()
    router.observeFrame({ deliveryKind: 'recovery' })
    router.observeGap('generation-change')
    expect(router.snapshot().open).toBe(false)
    for (const frame of [['array-frame'], 'raw-string', 42, null]) {
      expect(router.observeFrame(frame).drop, String(frame)).toBe(true)
    }
    // legacy(从未见过权威字段)流零行为变化:非对象帧照旧放行
    const legacy = createStreamAuthorityRouter()
    expect(legacy.observeFrame(['array-frame']).drop).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
