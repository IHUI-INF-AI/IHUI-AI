// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * workspace-ai computer-use 整族的管理员闸(F-400,P1)。
 *
 * 缺陷:6 个宿主机级端点(status/screenshot/mouse.click/keyboard.type/keyboard.key/
 * screen-size)此前只过 `requireAuth`,任意登录用户都能驱动宿主机键鼠/截屏。
 *
 * 本文件钉住三件事:
 *  ① 普通登录用户 → 每个端点 403,且宿主机控制服务(computerUse)一次都不被调用;
 *  ② 管理员 → 每个端点 200,且对应服务方法恰好被调用一次;
 *  ③ 未登录 → 401,同样零调用。
 *
 * 隔离:auth 桩只替换 authenticate(按请求头给 userId/roleId);computerUse 用 spy 计数
 * 并替换为纯内存实现(绝不真跑 pwsh);不连 PG/Redis、零网络。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (request: unknown) => request),
}))

vi.mock('../src/plugins/auth.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/plugins/auth.js')
  return { ...actual, authenticate: mockAuthenticate }
})

import { computerUse } from '../src/services/workspace-ai-service.js'
import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'

const PREFIX = '/api/workspace'
const REGULAR_USER = 'user-regular'
const ADMIN_USER = 'user-admin'

type HostMethod =
  'isEnabled' | 'takeScreenshot' | 'mouseClick' | 'keyboardType' | 'keyboardKey' | 'getScreenSize'

interface EndpointCase {
  label: string
  method: 'GET' | 'POST'
  path: string
  payload?: Record<string, unknown>
  hostMethod: HostMethod
}

const ENDPOINTS: EndpointCase[] = [
  { label: 'status', method: 'GET', path: '/computer-use/status', hostMethod: 'isEnabled' },
  {
    label: 'screenshot',
    method: 'POST',
    path: '/computer-use/screenshot',
    hostMethod: 'takeScreenshot',
  },
  {
    label: 'mouse/click',
    method: 'POST',
    path: '/computer-use/mouse/click',
    payload: { x: 10, y: 10 },
    hostMethod: 'mouseClick',
  },
  {
    label: 'keyboard/type',
    method: 'POST',
    path: '/computer-use/keyboard/type',
    payload: { text: 'hello' },
    hostMethod: 'keyboardType',
  },
  {
    label: 'keyboard/key',
    method: 'POST',
    path: '/computer-use/keyboard/key',
    payload: { key: 'ENTER' },
    hostMethod: 'keyboardKey',
  },
  {
    label: 'screen-size',
    method: 'GET',
    path: '/computer-use/screen-size',
    hostMethod: 'getScreenSize',
  },
]

let app: FastifyInstance
let spies: Record<HostMethod, ReturnType<typeof vi.spyOn>>

function resetHostSpies(): void {
  spies = {
    isEnabled: vi.spyOn(computerUse, 'isEnabled').mockReturnValue(true),
    takeScreenshot: vi
      .spyOn(computerUse, 'takeScreenshot')
      .mockResolvedValue({ image: '', width: 1920, height: 1080, raw: '' }),
    mouseClick: vi.spyOn(computerUse, 'mouseClick').mockResolvedValue(undefined),
    keyboardType: vi.spyOn(computerUse, 'keyboardType').mockResolvedValue(undefined),
    keyboardKey: vi.spyOn(computerUse, 'keyboardKey').mockResolvedValue(undefined),
    getScreenSize: vi
      .spyOn(computerUse, 'getScreenSize')
      .mockResolvedValue({ width: 1920, height: 1080 }),
  }
}

function totalHostCalls(): number {
  return Object.values(spies).reduce((sum, spy) => sum + spy.mock.calls.length, 0)
}

/** 按请求头构造调用者;x-probe-user 缺省即未登录 */
function actorHeaders(userId?: string, roleId = 0): Record<string, string> {
  if (!userId) return {}
  return { 'x-probe-user': userId, 'x-probe-role': String(roleId) }
}

async function callEndpoint(endpoint: EndpointCase, headers: Record<string, string>) {
  return app.inject({
    method: endpoint.method,
    url: `${PREFIX}${endpoint.path}`,
    headers,
    ...(endpoint.payload ? { payload: endpoint.payload } : {}),
  })
}

describe('workspace-ai computer-use 整族管理员闸(F-400)', () => {
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(workspaceAiRoutes, { prefix: PREFIX })
    await app.ready()
  }, 180_000)

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(() => {
    resetHostSpies()
    mockAuthenticate.mockImplementation(async (request: unknown) => {
      const req = request as {
        headers: Record<string, unknown>
        userId?: string
        jwtPayload?: { userId?: string; roleId?: number }
      }
      const raw = req.headers['x-probe-user']
      if (typeof raw !== 'string' || raw.length === 0) {
        const err = new Error('Authentication required') as Error & { statusCode: number }
        err.statusCode = 401
        throw err
      }
      const roleId = Number(req.headers['x-probe-role'] ?? 0)
      req.userId = raw
      req.jwtPayload = { userId: raw, roleId }
      return req
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockAuthenticate.mockReset()
  })

  it.each(ENDPOINTS)('普通登录用户 → $label 必须 403,且宿主机控制服务零调用', async (endpoint) => {
    const res = await callEndpoint(endpoint, actorHeaders(REGULAR_USER, 0))

    expect(res.statusCode).toBe(403)
    expect(totalHostCalls()).toBe(0)
  })

  it.each(ENDPOINTS)('管理员 → $label 必须 200,且对应宿主机方法恰好调用一次', async (endpoint) => {
    const res = await callEndpoint(endpoint, actorHeaders(ADMIN_USER, 1))

    expect(res.statusCode).toBe(200)
    expect(spies[endpoint.hostMethod]).toHaveBeenCalledTimes(1)
    expect(totalHostCalls()).toBe(1)
  })

  it.each(ENDPOINTS)('未登录 → $label 必须 401,且宿主机控制服务零调用', async (endpoint) => {
    const res = await callEndpoint(endpoint, actorHeaders())

    expect(res.statusCode).toBe(401)
    expect(totalHostCalls()).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
