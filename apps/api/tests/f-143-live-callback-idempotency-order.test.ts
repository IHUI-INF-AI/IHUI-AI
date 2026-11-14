// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-143 回归:直播回调的去重标记必须在**副作用成功之后**才落。
 *
 * 修前是"先写去重缓存、再落库":
 *   processedEventIds.set(eventId, now)
 *   await updateLiveChannelStatusByStreamName(...)
 *
 * DB 一抛错,路由回 500,腾讯云按约定重发同一 eventId —— 此时缓存里已经有它,
 * 重试被判 `duplicated` 直接回 ok,于是那次状态更新永远不会被补上:
 * 频道状态与真实直播状态**永久不一致**,且日志显示"已处理"。
 *
 * 本文件钉住四条:
 * ① 成功才留痕:成功后同 eventId 再投递 ⇒ duplicated(幂等成立);
 * ② 失败必须可重试:第一次抛错后,**同 eventId 重发要真正再执行一次副作用**;
 * ③ 并发互斥:处理中(null 占位)时同 eventId 再来 ⇒ 按重复返回,不重复执行副作用;
 * ④ 失败不会污染去重表:抛错后表里不留已完成时间戳(否则后续重试仍被判重复)。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateStatus = vi.fn()

vi.mock('../src/db/live-queries.js', () => ({
  updateLiveChannelStatusByStreamName: (...args: unknown[]) => updateStatus(...args),
}))

const { handleCallbackEvent, __resetProcessedEventIdsForTest } = await import(
  '../src/services/tencent-live-service.js'
)

beforeEach(() => {
  __resetProcessedEventIdsForTest()
  updateStatus.mockReset()
})

describe('F-143 直播回调幂等标记时序', () => {
  it('① 成功后才留痕:同 eventId 再投递按重复返回', async () => {
    updateStatus.mockResolvedValue(undefined)
    const first = await handleCallbackEvent('stream_begin', { eventId: 'evt-1', stream_id: 's1' })
    const second = await handleCallbackEvent('stream_begin', { eventId: 'evt-1', stream_id: 's1' })

    expect(first.duplicated).toBeFalsy()
    expect(second.duplicated).toBe(true)
    expect(updateStatus).toHaveBeenCalledTimes(1)
  })

  it('② 失败必须可重试:同 eventId 重发要真正再执行一次', async () => {
    updateStatus.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce(undefined)

    await expect(
      handleCallbackEvent('stream_end', { eventId: 'evt-2', stream_id: 's2' }),
    ).rejects.toThrow('db down')

    const retry = await handleCallbackEvent('stream_end', { eventId: 'evt-2', stream_id: 's2' })

    expect(retry.duplicated).toBeFalsy()
    expect(updateStatus).toHaveBeenCalledTimes(2)
    expect(updateStatus).toHaveBeenLastCalledWith('s2', false)
  })

  it('③ 处理中并发同一事件:按重复返回,不重复执行副作用', async () => {
    let release: (() => void) | undefined
    updateStatus.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )

    const inflight = handleCallbackEvent('stream_begin', { eventId: 'evt-3', stream_id: 's3' })
    // 让第一次调用真正进入 await(占位已写入)
    await Promise.resolve()
    const concurrent = await handleCallbackEvent('stream_begin', {
      eventId: 'evt-3',
      stream_id: 's3',
    })

    expect(concurrent.duplicated).toBe(true)
    release?.()
    await inflight
    expect(updateStatus).toHaveBeenCalledTimes(1)
  })

  it('④ 失败后不污染去重表:连续两次失败都能各自重试', async () => {
    updateStatus
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValueOnce(undefined)

    await expect(
      handleCallbackEvent('stream_end', { eventId: 'evt-4', stream_id: 's4' }),
    ).rejects.toThrow('fail-1')
    await expect(
      handleCallbackEvent('stream_end', { eventId: 'evt-4', stream_id: 's4' }),
    ).rejects.toThrow('fail-2')
    const third = await handleCallbackEvent('stream_end', { eventId: 'evt-4', stream_id: 's4' })

    expect(third.duplicated).toBeFalsy()
    expect(updateStatus).toHaveBeenCalledTimes(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
