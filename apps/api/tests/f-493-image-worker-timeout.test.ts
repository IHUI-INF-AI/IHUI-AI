// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-493 回归锁(2026-11-13)。
 *
 * 病灶:image-task-worker 调 forwardToChannel 无任何超时,上游渠道挂起(建连成功但不回响应)
 * 时整轮 await 永不返回,`running` 卡在 true,后续每 30s 的扫描全被挡掉 —— 一次挂起就把该
 * 实例所有 pending 任务饿死。
 *
 * 本文件钉住三件事:
 *   ① 上游永不 resolve ⇒ 超时后落 failed(带错误摘要)并释放 running,下一轮扫描继续消费;
 *   ② 超时后才到的迟到响应不得再写 succeeded(completeImageTask 零调用);
 *   ③ 正常完成路径不变:成功结果按原样写回并归还租约。
 *
 * 零真实网络 / DB / Redis:上游与任务存储全部替身,超时经 IMAGE_TASK_TIMEOUT_MS 收紧到 20ms。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  mode: 'ok' as 'ok' | 'hang' | 'fail',
  calls: [] as Array<{ signal?: AbortSignal }>,
  /** 挂起模式下由测试手动调用,模拟超时之后才抵达的上游响应。 */
  release: null as null | (() => void),
}))

const store = vi.hoisted(() => ({
  list: vi.fn(),
  claim: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
}))

vi.mock('../src/services/relay-upstream-forwarder.js', () => ({
  forwardToChannel: (req: { signal?: AbortSignal }) => {
    state.calls.push({ signal: req.signal })
    if (state.mode === 'fail') return Promise.resolve({ ok: false, reason: 'upstream down' })
    const response = {
      ok: true,
      response: {
        json: async () => ({
          data: [
            {
              url:
                state.mode === 'hang'
                  ? 'https://img.test/late.png'
                  : 'https://img.test/f493-ok.png',
            },
          ],
        }),
      },
    }
    if (state.mode === 'hang') {
      return new Promise((resolve) => {
        state.release = () => resolve(response)
      })
    }
    return Promise.resolve(response)
  },
}))

vi.mock('../src/routes/v1-multimodal.js', () => ({
  listPendingImageTasks: store.list,
  claimImageTask: store.claim,
  completeImageTask: store.complete,
  failImageTask: store.fail,
}))

import { processImageTasks } from '../src/workers/image-task-worker.js'

const TASK = {
  id: 't-f493',
  status: 'pending' as const,
  model: 'gpt-image-1',
  prompt: 'a cat',
  userId: 'user-1',
  createdAt: new Date().toISOString(),
}

const TIMEOUT_MS = 20

beforeEach(() => {
  process.env.IMAGE_TASK_TIMEOUT_MS = String(TIMEOUT_MS)
  state.mode = 'ok'
  state.calls = []
  state.release = null
  store.list.mockReset().mockResolvedValue([TASK])
  store.claim.mockReset().mockResolvedValue('claim-token-f493')
  store.complete.mockReset().mockResolvedValue(true)
  store.fail.mockReset().mockResolvedValue(true)
})

afterEach(() => {
  delete process.env.IMAGE_TASK_TIMEOUT_MS
  vi.clearAllMocks()
})

describe('F-493 生图 worker 上游超时', () => {
  it('① 上游永不 resolve ⇒ 超时落 failed 并释放槽位,下一轮继续消费', async () => {
    state.mode = 'hang'

    const first = await processImageTasks()

    expect(first).toEqual({ processed: 1, ok: 0, failed: 1 })
    expect(store.complete).not.toHaveBeenCalled()
    expect(store.fail).toHaveBeenCalledTimes(1)
    const [taskId, errMsg, token] = store.fail.mock.calls[0] as [string, string, string]
    expect(taskId).toBe('t-f493')
    expect(errMsg).toContain(`上游生图超时(${TIMEOUT_MS}ms)`)
    expect(token).toBe('claim-token-f493')
    // 超时必须真的把 abort 信号递到上游调用点
    expect(state.calls).toHaveLength(1)
    expect(state.calls[0]?.signal?.aborted).toBe(true)

    // running 已释放:下一轮扫描照常处理,不被上一轮残留占位挡掉
    state.mode = 'ok'
    const second = await processImageTasks()
    expect(second).toEqual({ processed: 1, ok: 1, failed: 0 })
  })

  it('② 超时之后的迟到响应被忽略,不得再写成功结果', async () => {
    state.mode = 'hang'

    const first = await processImageTasks()
    expect(first.failed).toBe(1)
    expect(state.release).toBeTypeOf('function')

    // 上游在超时落库之后才返回:结果没有消费方,不得覆写 failed / 调 complete
    state.release?.()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(store.complete).not.toHaveBeenCalled()
    expect(store.fail).toHaveBeenCalledTimes(1)
  })

  it('③ 正常完成路径不变:成功结果写回并归还租约', async () => {
    const r = await processImageTasks()

    expect(r).toEqual({ processed: 1, ok: 1, failed: 0 })
    expect(store.fail).not.toHaveBeenCalled()
    expect(store.complete).toHaveBeenCalledTimes(1)
    expect(store.complete).toHaveBeenCalledWith(
      't-f493',
      ['https://img.test/f493-ok.png'],
      'claim-token-f493',
    )
    expect(state.calls[0]?.signal?.aborted).toBe(false)
  })
})
