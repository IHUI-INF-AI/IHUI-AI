// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-382 回归锁(2026-11-13):OSS 分片上传会话不得跨用户命中、Redis 写入必须带 TTL、
 * 过期清理必须先 AbortMultipartUpload 再删会话、Redis 故障时进程内兜底并标注降级。
 *
 * 零真实依赖:ioredis 走 tests/helpers/fake-redis.ts 的内存替身,OSS 走 fetch mock。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

const fakeState = vi.hoisted(() => ({
  store: new Map<string, { value: string; expiresAt: number }>(),
  calls: [] as Array<{ cmd: string; args: unknown[] }>,
  failures: new Set<string>(),
}))

vi.mock('ioredis', async () => {
  const { makeFakeRedisClass } = await import('./helpers/fake-redis.js')
  return { default: makeFakeRedisClass(fakeState as never) }
})

import {
  initiateMultipartUpload,
  uploadMultipartPart,
  completeMultipartUpload,
  cleanupExpiredMultipartSessions,
  isMultipartSessionStoreDegraded,
  _resetMultipartSessionStateForTests,
  MULTIPART_SESSION_TTL_MS,
} from '../src/services/storage-service.js'
import { logger } from '../src/utils/logger.js'

const OSS_UPLOAD_ID = 'oss-upload-1'
const fetchMock = vi.fn()

interface FetchCall {
  url: string
  method: string
}

function fetchCalls(): FetchCall[] {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: String((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase(),
  }))
}

function callsOf(method: string): FetchCall[] {
  return fetchCalls().filter((c) => c.method === method)
}

/** OSS REST 的最小响应替身:Initiate 返回 UploadId,Complete 返回 Location,其余为空。 */
function installOssFetch(): void {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method === 'POST' && url.includes('?uploads=')) {
      return Promise.resolve(
        new Response(
          `<InitiateMultipartUploadResult><UploadId>${OSS_UPLOAD_ID}</UploadId></InitiateMultipartUploadResult>`,
          { status: 200, headers: { 'content-type': 'application/xml' } },
        ),
      )
    }
    if (method === 'PUT') {
      return Promise.resolve(new Response('', { status: 200, headers: { etag: '"abc123"' } }))
    }
    if (method === 'POST') {
      return Promise.resolve(
        new Response(
          '<CompleteMultipartUploadResult><Location>loc</Location></CompleteMultipartUploadResult>',
          { status: 200, headers: { 'content-type': 'application/xml' } },
        ),
      )
    }
    return Promise.resolve(new Response(null, { status: 204 }))
  })
}

beforeAll(() => {
  vi.stubEnv('OSS_ACCESS_KEY_ID', 'test-ak')
  vi.stubEnv('OSS_ACCESS_KEY_SECRET', 'test-sk')
  vi.stubEnv('OSS_ROLE_ARN', 'acs:ram::1:role/test')
  vi.stubEnv('OSS_BUCKET', 'test-bucket')
  vi.stubEnv('OSS_REGION', 'oss-cn-hangzhou')
  vi.stubGlobal('fetch', fetchMock)
})

afterAll(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

beforeEach(() => {
  _resetMultipartSessionStateForTests()
  fakeState.store.clear()
  fakeState.calls.length = 0
  fakeState.failures.clear()
  fetchMock.mockReset()
  installOssFetch()
})

describe('F-382 分片会话隔离与清理', () => {
  it('用户 B 不能读取/续传用户 A 的会话(按 userId+uploadId 精确命中)', async () => {
    const a = await initiateMultipartUpload('user-a', { filename: 'a.bin' })

    // 正向对照:A 本人可用,说明会话确实存在。
    const own = await uploadMultipartPart(a.uploadId, 1, Buffer.from('x'), 'user-a')
    expect(own.etag).toBe('abc123')
    expect(callsOf('PUT')).toHaveLength(1)

    // B 持同一 uploadId 也无法命中(不会走到 OSS)。
    await expect(uploadMultipartPart(a.uploadId, 1, Buffer.from('x'), 'user-b')).rejects.toThrow(
      /不存在|过期|无权/,
    )
    await expect(
      completeMultipartUpload(a.uploadId, [{ partNumber: 1, etag: 'abc123' }], 'user-b'),
    ).rejects.toThrow(/不存在|过期|无权/)
    expect(callsOf('PUT')).toHaveLength(1)
    expect(callsOf('POST').filter((c) => c.url.includes('uploadId='))).toHaveLength(0)
  })

  it('写会话时 Redis set 必须带 TTL,且 key 含实例前缀与 userId', async () => {
    const a = await initiateMultipartUpload('user-a', { filename: 'a.bin' })

    const setCall = fakeState.calls.find((c) => c.cmd === 'set')
    expect(setCall).toBeDefined()
    const [key, value, mode, ttl] = setCall!.args as [string, string, string, number]

    expect(key).toContain('oss:multipart:') // 实例前缀
    expect(key).toContain('user-a') // 属主隔离
    expect(key).toContain(a.uploadId)
    expect(mode).toBe('PX')
    expect(Number(ttl)).toBeGreaterThanOrEqual(MULTIPART_SESSION_TTL_MS)
    expect(JSON.parse(value)).toMatchObject({ userId: 'user-a', sessionId: a.uploadId })
  })

  it('清理过期会话前先调用 OSS AbortMultipartUpload', async () => {
    const a = await initiateMultipartUpload('user-a', { filename: 'a.bin' })
    expect(callsOf('DELETE')).toHaveLength(0)

    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() + MULTIPART_SESSION_TTL_MS + 60_000)
    try {
      const cleaned = await cleanupExpiredMultipartSessions()
      expect(cleaned).toBe(1)

      const deletes = callsOf('DELETE')
      expect(deletes).toHaveLength(1)
      expect(deletes[0]!.url).toContain(`uploadId=${OSS_UPLOAD_ID}`)
    } finally {
      nowSpy.mockRestore()
    }

    // 清理后会话不可再用。
    await expect(uploadMultipartPart(a.uploadId, 1, Buffer.from('x'), 'user-a')).rejects.toThrow(
      /不存在|过期/,
    )
  })

  it('Redis 抛错时回退进程内存储,标注降级且仍按 userId 隔离', async () => {
    fakeState.failures.add('set')
    fakeState.failures.add('get')
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})

    try {
      const c = await initiateMultipartUpload('user-c', { filename: 'c.bin' })
      expect(isMultipartSessionStoreDegraded()).toBe(true)
      expect(warnSpy).toHaveBeenCalled()

      // 兜底可用:
      const own = await uploadMultipartPart(c.uploadId, 1, Buffer.from('x'), 'user-c')
      expect(own.etag).toBe('abc123')

      // 降级路径同样不允许跨用户命中:
      await expect(uploadMultipartPart(c.uploadId, 1, Buffer.from('x'), 'user-d')).rejects.toThrow(
        /不存在|过期|无权/,
      )
    } finally {
      warnSpy.mockRestore()
    }
  })
})
