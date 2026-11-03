// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ApiClientModule from '@ihui/api-client'

const apiMocks = vi.hoisted(() => ({
  refreshAccessTokenOnce: vi.fn(async () => true),
  getToken: vi.fn((): string | null => 'access-token'),
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>()
  return {
    ...actual,
    getToken: apiMocks.getToken,
    refreshAccessTokenOnce: apiMocks.refreshAccessTokenOnce,
    resolveFileUrl: (path: string) =>
      `https://api.example.com${path.startsWith('/') ? '' : '/'}${path}`,
  }
})

import {
  uploadFileWithProgress,
  uploadPercent,
  type UploadTaskFactory,
} from '../src/screens/AigcPublishUpload'

const FILE = { uri: 'file:///tmp/photo.jpg', type: 'image/jpeg', name: 'photo.jpg' }

const SUCCESS_BODY = JSON.stringify({
  code: 0,
  data: {
    file: {
      id: 'file-1',
      name: 'photo.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      path: '/uploads/photo.jpg',
      uploadedBy: 'u-1',
    },
  },
})

/** 假上传任务端口:按脚本逐帧上报传输层字节数,证明百分比由 bytesSent 推出 */
function factoryFromSamples(
  samples: Array<[number, number]>,
  responses: Array<{ status: number; body: string }> = [{ status: 200, body: SUCCESS_BODY }],
): { factory: UploadTaskFactory; calls: Array<Parameters<UploadTaskFactory>[2]> } {
  const calls: Array<Parameters<UploadTaskFactory>[2]> = []
  let attempt = 0
  const factory: UploadTaskFactory = (_uri, _url, options) => {
    calls.push(options)
    return {
      async uploadAsync() {
        for (const [sent, total] of samples) options.onBytes(sent, total)
        const response = responses[Math.min(attempt, responses.length - 1)]!
        attempt += 1
        return response
      },
    }
  }
  return { factory, calls }
}

describe('AigcPublish 上传进度端口', () => {
  beforeEach(() => {
    apiMocks.refreshAccessTokenOnce.mockClear()
    apiMocks.getToken.mockClear()
    apiMocks.getToken.mockReturnValue('access-token')
  })

  it('进度事件来自传输层字节回调,不是定时器伪造', async () => {
    const { factory } = factoryFromSamples([
      [0, 1000],
      [500, 1000],
      [990, 1000],
    ])
    const events: Array<{ percent: number; loaded: number; total: number }> = []
    const res = await uploadFileWithProgress(FILE, {
      taskFactory: factory,
      onUploadProgress: (percent, sample) =>
        events.push({ percent, loaded: sample.loaded, total: sample.total }),
    })

    expect(res.success).toBe(true)
    expect(events).toEqual([
      { percent: 0, loaded: 0, total: 1000 },
      { percent: 50, loaded: 500, total: 1000 },
      { percent: 99, loaded: 990, total: 1000 },
    ])
  })

  it('上传完成前封顶 99,非法字节数归零', () => {
    expect(uploadPercent(0, 1000)).toBe(0)
    expect(uploadPercent(500, 1000)).toBe(50)
    expect(uploadPercent(1000, 1000)).toBe(99)
    expect(uploadPercent(1200, 1000)).toBe(99)
    expect(uploadPercent(10, 0)).toBe(0)
    expect(uploadPercent(Number.NaN, 100)).toBe(0)
  })

  it('成功响应解析出文件,并把 Bearer token 与文件 MIME 交给任务端口', async () => {
    const { factory, calls } = factoryFromSamples([[100, 100]])
    const res = await uploadFileWithProgress(FILE, { taskFactory: factory })

    expect(res.success).toBe(true)
    expect(res.success && res.data.id).toBe('file-1')
    const firstCall = calls[0]!
    expect(firstCall.headers).toEqual({ Authorization: 'Bearer access-token' })
    expect(firstCall.mimeType).toBe('image/jpeg')
  })

  it('401 ⇒ 续期一次后重放,不重复续期', async () => {
    const { factory } = factoryFromSamples(
      [[100, 100]],
      [
        { status: 401, body: '{"code":401,"message":"expired"}' },
        { status: 200, body: SUCCESS_BODY },
      ],
    )
    const res = await uploadFileWithProgress(FILE, { taskFactory: factory })

    expect(res.success).toBe(true)
    expect(apiMocks.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(apiMocks.getToken).toHaveBeenCalledTimes(2)
  })

  it('失败响应不外泄进度,返回错误文本', async () => {
    const { factory } = factoryFromSamples(
      [[100, 100]],
      [{ status: 500, body: '{"code":500,"message":"boom"}' }],
    )
    const res = await uploadFileWithProgress(FILE, { taskFactory: factory })
    expect(res.success).toBe(false)
    expect(!res.success && res.error).toBe('boom')
  })
})
