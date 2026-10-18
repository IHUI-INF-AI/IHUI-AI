// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// G-102 收口:内容失败与传输失败分档**装车**。
//
// 上一轮的否证形态是"判据全绿、生产面消费者为 0 ⇒ 判据挂在半空"
// (isDeterministicContentFault / createStreamFaultTracker / resolveStreamRecoveryDecision
// 三个出口零调用方)。本档把三面一起钉住:
//   ① 判据面 —— shouldSkipResumeLadder 三态 + 洗白锁(跨包 import,证明 index 真导出了);
//   ② 行为面 —— hook 真的按分档放行/拒发重连(renderHook 起真流,不是只读源码);
//   ③ 文案面 —— 终态消息只对内容故障追加"(内容故障,重试无意义)"标记;
//   ④ 反向锁 —— 纯瞬态必须仍放行、仍原样文案(不能把该重试的一起拦死)。
//
// 有牙自证:把 hook 里那行 shouldSkipResumeLadder 闸门删掉,② 必须翻红。

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createStreamFaultTracker,
  describeFaultTier,
  shouldSkipResumeLadder,
} from '@ihui/shared/chat'
import { useAgentStream } from '@/hooks/use-agent-stream'

vi.mock('@/lib/api', () => ({
  getStreamBaseUrl: () => 'http://127.0.0.1:0',
  getToken: () => null,
}))

/** 按给定的状态码序列起流:每次 fetch 取一个,用完复读最后一个。 */
function stubFetchStatuses(statuses: number[]) {
  let i = 0
  const fetchMock = vi.fn(async () => {
    const s = statuses[Math.min(i, statuses.length - 1)]
    i += 1
    return new Response('', { status: s })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/**
 * 起一次流,并真实等到**第一次重连**该触发的那一刻(RECONNECT_BASE_DELAY_MS=3000)。
 *
 * 为什么不用 fake timers:实测踩过两个坑,都记在这里免得下次再试 ——
 *  ① renderHook 前 useFakeTimers ⇒ React 19 的 act 调度挂住,result.current 变 null;
 *  ② 流失败后(真定时器段)才 useFakeTimers ⇒ 已安排的 3s 重连定时器被直接丢弃,
 *     该重连的也没重连,三种用例的读数全部失真。
 * 真实等待 3.6s 只覆盖第一次重连,足以区分不重连/重连一次/重连后被闸门拒发。
 */
async function runWithStatuses(statuses: number[]) {
  const fetchMock = stubFetchStatuses(statuses)
  const { result } = renderHook(() =>
    useAgentStream({ threadId: 't-g102', autoReconnect: true }),
  )
  act(() => result.current.start({ input: 'x' }))
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 3_600))
  })
  return { result, fetchMock }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('G-102 判据面:shouldSkipResumeLadder 三态 + 洗白锁', () => {
  it('内容故障 ⇒ 跳过阶梯(重投只会再被拒)', () => {
    const t = createStreamFaultTracker()
    t.record({ status: 422 })
    expect(shouldSkipResumeLadder(t)).toBe(true)
  })

  it('typed fault(fieldRejected)⇒ 跳过阶梯', () => {
    const t = createStreamFaultTracker()
    t.record({ code: 'fault.sse.fieldRejected' })
    expect(shouldSkipResumeLadder(t)).toBe(true)
  })

  it('纯瞬态 ⇒ 不放行跳过(该重试的重试)', () => {
    const t = createStreamFaultTracker()
    t.record({ status: 500 })
    expect(shouldSkipResumeLadder(t)).toBe(false)
  })

  it('无失败 ⇒ 不放行跳过', () => {
    expect(shouldSkipResumeLadder(createStreamFaultTracker())).toBe(false)
  })

  it('洗白锁:先内容后瞬态 ⇒ 终态仍归内容(瞬态不得洗白)', () => {
    const t = createStreamFaultTracker()
    t.record({ status: 500 })
    expect(shouldSkipResumeLadder(t)).toBe(false)
    t.record({ status: 422 })
    expect(shouldSkipResumeLadder(t)).toBe(true)
  })
})

describe('G-102 文案面:describeFaultTier 只标内容故障', () => {
  it('内容故障 ⇒ 终态消息明标"(内容故障,重试无意义)"', () => {
    const t = createStreamFaultTracker()
    t.record({ status: 422 })
    expect(describeFaultTier('stream failed', t)).toBe('stream failed(内容故障,重试无意义)')
  })

  it('反向锁:纯瞬态 ⇒ 原样返回,不得把网络抖动说成内容故障', () => {
    const t = createStreamFaultTracker()
    t.record({ status: 500 })
    expect(describeFaultTier('stream failed', t)).toBe('stream failed')
  })

  it('无失败 ⇒ 原样返回', () => {
    expect(describeFaultTier('stream failed', createStreamFaultTracker())).toBe('stream failed')
  })
})

describe('G-102 行为面:重连编排按分档放行/拒发', () => {
  it('确定性内容故障(422)⇒ 不重连,只发起一次', async () => {
    const { result, fetchMock } = await runWithStatuses([422])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // 终态(error state)与回调同口径:内容故障的消息必须带分档标记
    expect(result.current.error).toContain('(内容故障,重试无意义)')
  })

  it('反向锁:纯瞬态(500)⇒ 仍放行重连', async () => {
    const { result, fetchMock } = await runWithStatuses([500])
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
    // 瞬态的原消息不得被加标记(不得把"网络抖动再试一次"说成内容故障)
    expect(result.current.error).toBe('HTTP 500')
  })

  it('洗白锁跨重连:先瞬态后内容 ⇒ 内容那次之后不再重连', async () => {
    // 第 1 次 500(瞬态,放行重连)→ 第 2 次 422(内容,记 contentFaultSeen)
    // ⇒ 第 3 次起被闸门拒发:总发起次数停在 2,不会一路退避到 5 次上限
    const { fetchMock } = await runWithStatuses([500, 422])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
