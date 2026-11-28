// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 桥体检与群写审计两条 HTTP 边界的契约测试。
 *
 * 只验证路由层做对了什么：路径对不对、时间戳有没有转成 ISO、剩余额度算得对不对、
 * 桥不可达时是否照样 200（而不是把「桥没起来」当 500 抛出去）。
 * 归属校验与真实探活由 service 层单测覆盖。
 */

import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'user-1'
    return true
  }),
}))

vi.mock('../../services/wechat-hub/bridge-probe.js', () => ({
  probeBridgeForAccount: vi.fn(),
}))

// 只替换读库那一步，审计视图的拼装保持真实实现——字段错了必须被测出来。
vi.mock('../../services/wechat-hub/group-writes.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '../../services/wechat-hub/group-writes.js',
  )
  return { ...actual, getGroupWriteRuntimeView: vi.fn() }
})

import { probeBridgeForAccount } from '../../services/wechat-hub/bridge-probe.js'
import { getGroupWriteRuntimeView } from '../../services/wechat-hub/group-writes.js'
import { wechatHubOperationsRoutes } from '../wechat-hub-operations.js'

async function buildApp() {
  const app = Fastify()
  await app.register(wechatHubOperationsRoutes)
  await app.ready()
  return app
}

describe('桥体检路由', () => {
  beforeEach(() => vi.mocked(probeBridgeForAccount).mockReset())

  it('桥在线时原样回传驱动与耗时', async () => {
    vi.mocked(probeBridgeForAccount).mockResolvedValue({
      baseUrl: 'http://127.0.0.1:8849',
      reachable: true,
      httpStatus: 200,
      latencyMs: 263,
      driver: 'db',
      online: true,
      status: 'db-sidecar-ready',
      mode: null,
      account: null,
      queued: 448,
      momentSeq: 0,
      error: null,
    })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/wechat-hub/accounts/acc-1/bridge-status' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { code: number; data: { reachable: boolean; driver: string; queued: number } }
    expect(body.code).toBe(0)
    expect(body.data).toMatchObject({ reachable: true, driver: 'db', queued: 448 })
    await app.close()
  })

  it('桥不可达也返 200，把原因放在 error 里，不抛 500', async () => {
    vi.mocked(probeBridgeForAccount).mockResolvedValue({
      baseUrl: 'http://127.0.0.1:8849',
      reachable: false,
      httpStatus: null,
      latencyMs: 0,
      driver: null,
      online: null,
      status: null,
      mode: null,
      account: null,
      queued: null,
      momentSeq: null,
      error: '3 秒内没有响应（桥可能没启动或端口不通）',
    })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/wechat-hub/accounts/acc-1/bridge-status' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { reachable: boolean; error: string } }
    expect(body.data.reachable).toBe(false)
    expect(body.data.error).toContain('3 秒内没有响应')
    await app.close()
  })
})

describe('群写审计路由', () => {
  beforeEach(() => vi.mocked(getGroupWriteRuntimeView).mockReset())

  it('时间戳转 ISO，剩余额度按窗口内次数算', async () => {
    const now = Date.now()
    vi.mocked(getGroupWriteRuntimeView).mockResolvedValue({
      policy: { enabled: true, maxTargetsPerAction: 5, maxActionsPerHour: 3 },
      runtime: {
        stamps: [now - 60_000],
        audit: [
          {
            at: now - 60_000,
            action: 'kick',
            conversationId: 'conv-1',
            chatTitle: '项目组',
            memberIds: ['a', 'b'],
            ok: true,
            status: null,
          },
        ],
      },
    })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/wechat-hub/accounts/acc-1/groups/audit' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: {
        entries: Array<{ at: string; action: string; chatTitle: string; ok: boolean }>
        windowCount: number
        windowLimit: number
        remaining: number
      }
    }
    expect(body.data.entries[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(body.data.entries[0]).toMatchObject({ action: 'kick', chatTitle: '项目组', ok: true })
    expect(body.data).toMatchObject({ windowCount: 1, windowLimit: 3, remaining: 2 })
    await app.close()
  })

  it('窗口用满时 remaining 是 0，不会出现负数', async () => {
    const now = Date.now()
    vi.mocked(getGroupWriteRuntimeView).mockResolvedValue({
      policy: { enabled: true, maxTargetsPerAction: 5, maxActionsPerHour: 3 },
      runtime: { stamps: [now, now - 1, now - 2, now - 3], audit: [] },
    })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/wechat-hub/accounts/acc-1/groups/audit' })
    const body = res.json() as { data: { remaining: number; entries: unknown[] } }
    expect(body.data.remaining).toBe(0)
    expect(body.data.entries).toEqual([])
    await app.close()
  })
})
