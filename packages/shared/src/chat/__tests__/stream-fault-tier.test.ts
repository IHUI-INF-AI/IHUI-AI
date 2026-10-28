// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816009 成对测试:内容失败与传输失败分档。
 *
 * 票面三条判据:
 * ① 内容故障 ⇒ 不走 resume 阶梯、直接 snapshot 且终态标 content;
 * ② 同一 flight 内先内容失败后瞬态失败 ⇒ 终态仍归内容失败(洗白那条就是本票存在的理由);
 * ③ 纯瞬态超时 ⇒ contentEligible:false 不置、重试仍被允许(反向锁,防把该重试的也取消)。
 */
import { describe, it, expect } from 'vitest'
import {
  createStreamFaultTracker,
  isDeterministicContentFault,
  resolveStreamRecoveryDecision,
} from '../stream-fault-tier'

describe('G-816009 内容/传输失败分档', () => {
  it('isDeterministicContentFault:typed fault 与确定性 4xx 判 content,网络/超时/未知判 transient', () => {
    // 字段级 typed fault(b76-05)= 内容故障
    expect(isDeterministicContentFault({ code: 'fault.sse.fieldRejected' })).toBe(true)
    expect(isDeterministicContentFault({ errorCode: 'fault.content.rejected' })).toBe(true)
    expect(isDeterministicContentFault({ status: 422 })).toBe(true)
    // 瞬态形状:超时/网络/未知码/非对象
    expect(isDeterministicContentFault({ code: 'stream.timeout' })).toBe(false)
    expect(isDeterministicContentFault({ code: 'network.error' })).toBe(false)
    expect(isDeterministicContentFault({ status: 503 })).toBe(false)
    expect(isDeterministicContentFault({ status: 429 })).toBe(false)
    expect(isDeterministicContentFault(new Error('boom'))).toBe(false)
    expect(isDeterministicContentFault('timeout')).toBe(false)
    expect(isDeterministicContentFault(null)).toBe(false)
  })

  it('① 内容故障 ⇒ 不走 resume 阶梯(force-snapshot)且 contentEligible 显式 false、终态标 content', () => {
    const tracker = createStreamFaultTracker()
    expect(tracker.record({ code: 'fault.sse.fieldRejected' })).toBe('content')
    const decision = resolveStreamRecoveryDecision(tracker)
    expect(decision).not.toBeNull()
    expect(decision!.strategy).toBe('force-snapshot')
    expect(decision!.tier).toBe('content')
    expect(decision!.contentEligible).toBe(false)
  })

  it('② 同一 flight 先内容失败后瞬态失败 ⇒ 终态仍归内容失败(不得被洗白)', () => {
    const tracker = createStreamFaultTracker()
    tracker.record({ code: 'fault.content.rejected' })
    // 后续瞬态失败(网络抖动/超时)不得把终态洗成 transient
    expect(tracker.record({ code: 'stream.timeout' })).toBe('transient')
    expect(tracker.record({ status: 503 })).toBe('transient')
    expect(tracker.terminalTier).toBe('content')
    const decision = resolveStreamRecoveryDecision(tracker)
    expect(decision!.strategy).toBe('force-snapshot')
    expect(decision!.contentEligible).toBe(false)
  })

  it('③ 纯瞬态超时 ⇒ strategy 仍允许 resume,且 contentEligible 不置(反向锁)', () => {
    const tracker = createStreamFaultTracker()
    tracker.record({ code: 'stream.timeout' })
    tracker.record({ status: 503 })
    expect(tracker.terminalTier).toBe('transient')
    const decision = resolveStreamRecoveryDecision(tracker)
    expect(decision).not.toBeNull()
    expect(decision!.strategy).toBe('resume')
    expect(decision!.tier).toBe('transient')
    // contentEligible:false 必须不置 —— 置了会把仍有意义的重试也取消掉
    expect('contentEligible' in decision!).toBe(false)
    expect(decision!.contentEligible).toBeUndefined()
  })

  it('无失败 ⇒ 决策为 null(正常流继续,不得凭空给恢复决策)', () => {
    const tracker = createStreamFaultTracker()
    expect(tracker.terminalTier).toBeNull()
    expect(resolveStreamRecoveryDecision(tracker)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
