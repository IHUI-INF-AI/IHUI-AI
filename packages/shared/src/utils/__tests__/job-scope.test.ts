// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  createJobScope,
  summarizeDroppedCallbacks,
  type JobScope,
  type JobToken,
} from '../job-scope'

/**
 * G-815967:迟到回调必须复核"我等的还是不是原来那个作业"。
 *
 * 成对是本票的全部意义:
 *  - 换人的那一臂证明守卫**有牙**(否则做出一个"永不落态"的恒哑实现也算过);
 *  - 同一作业的那一臂证明守卫**没有把正当回调一起吞掉**(只判前者就会做出那种实现)。
 * 另加一臂"只判 mounted 不够":宿主仍活着、身份已换 ⇒ 仍须拒。
 */

function begun(scope: JobScope, jobId?: string): JobToken {
  return scope.begin(jobId)
}

describe('换了作业 ⇒ 旧回调不得落新作业状态', () => {
  it('in-flight 期间 begin 了新作业 ⇒ 旧凭证判 stale 并记账', () => {
    const scope = createJobScope()
    const oldToken = begun(scope, 'batch-A')
    begun(scope, 'batch-B')

    expect(scope.isCurrent(oldToken)).toBe(false)
    const drops = scope.dropped()
    expect(drops).toHaveLength(1)
    expect(drops[0]?.verdict).toBe('stale')
    expect(drops[0]?.reason).toContain('generation-changed')
    // 点名要能说出"旧的是谁、当前的是谁",否则报了数也查不到站点
    expect(drops[0]?.reason).toContain('batch-A')
    expect(drops[0]?.token.jobId).toBe('batch-A')
  })

  it('同一代次但作业 id 换了 ⇒ 仍判 stale(只数代次会漏掉"换了对象")', () => {
    const scope = createJobScope()
    scope.begin('note-9')
    // 凭证从别处带回(序列化/缓存)的那一型:代次没变、作业 id 已不是当前这个
    const carried: JobToken = { generation: scope.current()?.generation ?? -1, jobId: 'note-7' }
    expect(scope.isCurrent(carried)).toBe(false)
    expect(scope.dropped()[0]?.reason).toContain('job-changed')
  })

  it('显式作废(点停止 / 卸载)之后到达 ⇒ stale:invalidated', () => {
    const scope = createJobScope()
    const token = begun(scope, 'submit-1')
    scope.invalidate('user-stopped')
    expect(scope.isCurrent(token)).toBe(false)
    const reasons = scope.dropped().map((d) => d.reason)
    expect(reasons.some((r) => r.includes('invalidated-by:user-stopped'))).toBe(true)
    expect(reasons.some((r) => r.includes('invalidated('))).toBe(true)
  })

  it('宿主仍活着而身份已换 ⇒ 拒(这一臂证的就是"只判 mounted 是半个守卫")', () => {
    const alive = true
    const scope = createJobScope({ isAlive: () => alive })
    const token = begun(scope, 'draft-1')
    begun(scope, 'draft-2')
    expect(alive).toBe(true)
    expect(scope.isCurrent(token)).toBe(false)
    expect(scope.dropped()[0]?.reason).toContain('generation-changed')
  })

  it('宿主不在了 ⇒ 一律拒,并记成 unmounted 而不是"没有迟到回调"', () => {
    let alive = true
    const scope = createJobScope({ isAlive: () => alive, deadReason: 'unmounted' })
    const token = begun(scope, 'draft-1')
    alive = false
    expect(scope.isCurrent(token)).toBe(false)
    expect(scope.dropped()[0]?.reason).toContain('unmounted')
    expect(summarizeDroppedCallbacks(scope.dropped())).toContain('stale=1')
  })
})

describe('同一作业 ⇒ 迟到回调照旧生效(反向对照)', () => {
  it('唯一的作业过了很久才回来 ⇒ current 且不记账(只判上一组会做出恒哑实现)', () => {
    const scope = createJobScope()
    const token = begun(scope, 'batch-A')
    expect(scope.isCurrent(token)).toBe(true)
    // 幂等复核两次都放行,且不该产生任何"被拒"记录
    expect(scope.isCurrent(token)).toBe(true)
    expect(scope.dropped()).toHaveLength(0)
    expect(summarizeDroppedCallbacks(scope.dropped())).toBeNull()
  })

  it('未命名批次(只带代次)⇒ 同代次仍放行,但换了代次照样拦', () => {
    const scope = createJobScope()
    const token = begun(scope)
    expect(scope.isCurrent(token)).toBe(true)
    begun(scope)
    expect(scope.isCurrent(token)).toBe(false)
  })
})

describe('三态不并桶:unknown ≠ stale ≠ current', () => {
  it('从未 begin 就问凭证 ⇒ unknown(判不出),不得写成"作业已作废"', () => {
    const scope = createJobScope()
    const foreign: JobToken = { generation: 99, jobId: 'never-registered' }
    expect(scope.verdict(foreign)).toBe('unknown')
    expect(scope.isCurrent(foreign)).toBe(false)
    expect(scope.dropped()[0]?.verdict).toBe('unknown')
    expect(scope.dropped()[0]?.reason).toContain('no-job-ever')
  })

  it('形状不对的凭证 ⇒ unknown,绝不冒判 current', () => {
    const scope = createJobScope()
    begun(scope, 'ok')
    const broken = { generation: Number.NaN, jobId: null } as JobToken
    expect(scope.verdict(broken)).toBe('unknown')
    const nonInteger = { generation: 1.5, jobId: 'x' } as JobToken
    expect(scope.verdict(nonInteger)).toBe('unknown')
  })

  it('摘要分列两态计数:unknown 不得被折进 stale 一起报"已拦截"', () => {
    const scope = createJobScope()
    const staleToken = begun(scope, 'a')
    begun(scope, 'b')
    scope.isCurrent(staleToken)
    scope.isCurrent({ generation: 42, jobId: null })
    const summary = summarizeDroppedCallbacks(scope.dropped())
    expect(summary).toContain('stale=1')
    expect(summary).toContain('unknown=1')
  })
})

describe('current() 的两型:从未 begin(null)与已作废(null 但有账)', () => {
  it('从未 begin ⇒ current() 为 null 且 dropped() 空 —— "没登记"不等于"被取消"', () => {
    const scope = createJobScope()
    expect(scope.current()).toBeNull()
    expect(scope.dropped()).toHaveLength(0)
  })

  it('begin 后 current() 拿得到的正是那张凭证(身份可被调用方复核)', () => {
    const scope = createJobScope()
    const token = begun(scope, 'x-1')
    expect(scope.current()).toEqual(token)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
