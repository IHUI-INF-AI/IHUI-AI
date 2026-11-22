// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-143 回归锁(2026-11-13)。
 *
 * 病灶:腾讯云直播回调(stream_begin/stream_end)先把 eventId 写进去重缓存再落库;
 * DB 抛错 ⇒ 路由 500 ⇒ 平台重发同一 eventId,却被缓存判 duplicated 直接回 ok,
 * 那次直播状态更新永远补不上,频道状态与真实直播永久不一致。
 *
 * 本文件锁三条:
 *   ① 首次回调成功落库后,去重标记才写入(同事件再投递按 duplicated 返回);
 *   ② 落库抛错时不残留去重标记,同事件重试能再次进入处理(不被误判重复);
 *   ③ 成功之后的同事件并发/重复投递仍被去重(修失败重试不牺牲幂等)。
 *
 * 只 mock 服务层 live-queries,不触达真实 PG / Redis。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateStatus = vi.fn()

vi.mock('../src/db/live-queries.js', () => ({
  updateLiveChannelStatusByStreamName: (...args: unknown[]) => updateStatus(...args),
}))

const { handleCallbackEvent, __resetProcessedEventIdsForTest } =
  await import('../src/services/tencent-live-service.js')

beforeEach(() => {
  __resetProcessedEventIdsForTest()
  updateStatus.mockReset()
})

describe('F-143 直播回调去重标记必须在落库成功之后写入', () => {
  it('① 首次回调成功落库才写标记:同事件再投递被去重', async () => {
    updateStatus.mockResolvedValue(undefined)

    const first = await handleCallbackEvent('stream_begin', { eventId: 'evt-a', stream_id: 's-a' })
    const repeat = await handleCallbackEvent('stream_begin', {
      eventId: 'evt-a',
      stream_id: 's-a',
    })

    expect(first.event).toBe('stream_begin')
    expect(first.streamName).toBe('s-a')
    expect(first.duplicated).toBeFalsy()
    expect(repeat.duplicated).toBe(true)
    expect(updateStatus).toHaveBeenCalledTimes(1)
    expect(updateStatus).toHaveBeenCalledWith('s-a', true)
  })

  it('② 落库抛错不残留标记:同事件重试能再次进入处理', async () => {
    updateStatus.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce(undefined)

    await expect(
      handleCallbackEvent('stream_end', { eventId: 'evt-b', stream_id: 's-b' }),
    ).rejects.toThrow('db down')

    const retry = await handleCallbackEvent('stream_end', { eventId: 'evt-b', stream_id: 's-b' })

    expect(retry.duplicated).toBeFalsy()
    expect(retry.event).toBe('stream_end')
    expect(updateStatus).toHaveBeenCalledTimes(2)
    expect(updateStatus).toHaveBeenLastCalledWith('s-b', false)

    // 重试成功后标记才落:第三次投递按重复返回,不再落库
    const third = await handleCallbackEvent('stream_end', { eventId: 'evt-b', stream_id: 's-b' })
    expect(third.duplicated).toBe(true)
    expect(updateStatus).toHaveBeenCalledTimes(2)
  })

  it('③ 处理中并发与成功后的重复投递都被去重', async () => {
    let release: (() => void) | undefined
    updateStatus.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )

    const inflight = handleCallbackEvent('stream_begin', { eventId: 'evt-c', stream_id: 's-c' })
    // 让第一次调用真正进入 await(占位已写入)
    await Promise.resolve()
    const during = await handleCallbackEvent('stream_begin', { eventId: 'evt-c', stream_id: 's-c' })

    expect(during.duplicated).toBe(true)
    expect(updateStatus).toHaveBeenCalledTimes(1)

    release?.()
    await inflight

    const afterFirst = await handleCallbackEvent('stream_begin', {
      eventId: 'evt-c',
      stream_id: 's-c',
    })
    const afterSecond = await handleCallbackEvent('stream_begin', {
      eventId: 'evt-c',
      stream_id: 's-c',
    })

    expect(afterFirst.duplicated).toBe(true)
    expect(afterSecond.duplicated).toBe(true)
    expect(updateStatus).toHaveBeenCalledTimes(1)
  })
})
