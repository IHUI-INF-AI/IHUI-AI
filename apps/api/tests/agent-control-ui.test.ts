// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import type { AgentActionRequest, AgentActionResponse, AgentControlCapability } from '@ihui/types'

// /capability 与 /result 与 /status 走 checkAuth(JWT → 会查用户状态打 DB),
// /execute 走 AGENT_CONTROL_INTERNAL_SECRET。整模块 mock 鉴权,测试不触达生产 PG/Redis。
const { mockAuthenticate, mockCheckAuth } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn<(request: { userId?: string }) => Promise<unknown>>(),
  mockCheckAuth: vi.fn<(request: { userId?: string }, reply: unknown) => Promise<boolean>>(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: mockCheckAuth,
}))

// 路由仅用到 toUserFriendlyMessage;mock 掉避免 @ihui/shared 的 React hooks 被 node 测试环境加载
vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: (err: unknown) => String(err),
}))

import { agentControlRoutes, __test__ } from '../src/routes/agent-control.js'

const PREFIX = '/api/agent-control'
const INTERNAL_SECRET = 'agent-control-ui-test-secret'
const USER_A = '00000000-0000-4000-8000-00000000000a'
const USER_B = '00000000-0000-4000-8000-00000000000b'

const ALL_UI_ACTIONS = [
  'describe',
  'navigate',
  'click',
  'fill',
  'submit',
  'read',
  'invoke',
] as const

interface CapabilityBody {
  /** 放宽为 string:需要构造非法枚举值(如 'phone')验证 schema 拒绝 */
  endpoint: string
  instanceId: string
  browserActions?: string[]
  computerActions?: string[]
  uiActions?: string[]
  appUiActions?: string[]
  taroUiActions?: string[]
  version?: string
}

interface ExecuteBody {
  requestId: string
  category: AgentActionRequest['category']
  action: string
  params?: Record<string, unknown>
  userId?: string
  timeout?: number
}

interface StatusEndpoint {
  endpoint: AgentControlCapability['endpoint']
  instanceId: string
  version?: string
  lastSeen: string
  browserActions: number
  computerActions: number
  uiActions: number
  appUiActions: number
  taroUiActions: number
}

const INTERNAL_HEADERS = { authorization: `Bearer ${INTERNAL_SECRET}` }

let app: FastifyInstance
const mockPush = vi.fn<(userId: string, payload: unknown) => void>()

/** 以指定用户身份上报能力(等价于端启动时注册自己属于哪个用户) */
async function reportCapability(body: CapabilityBody, userId: string) {
  mockCheckAuth.mockImplementation(async (request) => {
    request.userId = userId
    return true
  })
  const res = await app.inject({
    method: 'POST',
    url: `${PREFIX}/capability`,
    payload: { reportedAt: new Date().toISOString(), ...body },
  })
  mockCheckAuth.mockReset()
  mockCheckAuth.mockImplementation(async (request) => {
    request.userId = USER_A
    return true
  })
  return res
}

async function executeCommand(body: ExecuteBody, withSecret = true) {
  return app.inject({
    method: 'POST',
    url: `${PREFIX}/execute`,
    payload: { params: {}, timeout: 1000, ...body },
    ...(withSecret ? { headers: INTERNAL_HEADERS } : {}),
  })
}

/** /execute 先 push 再登记 pending,微任务落地后才能回传结果 */
async function waitPending(requestId: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (__test__.pending.has(requestId)) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`pending 未登记 requestId=${requestId}(push 后应立即注册)`)
}

async function reportResult(body: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: `${PREFIX}/result`, payload: body })
}

describe('agent-control ui category — /api/agent-control/*', () => {
  beforeAll(async () => {
    process.env.AGENT_CONTROL_INTERNAL_SECRET = INTERNAL_SECRET
    app = Fastify({ logger: false })
    app.decorate('pushNotification', mockPush)
    await app.register(agentControlRoutes, { prefix: PREFIX })
    await app.ready()
  })

  afterAll(async () => {
    delete process.env.AGENT_CONTROL_INTERNAL_SECRET
    await app.close()
  })

  beforeEach(() => {
    __test__.endpoints.clear()
    __test__.pending.clear()
    mockPush.mockReset()
    mockCheckAuth.mockReset()
    mockCheckAuth.mockImplementation(async (request) => {
      request.userId = USER_A
      return true
    })
    mockAuthenticate.mockReset()
    mockAuthenticate.mockRejectedValue(new Error('Authentication required'))
  })

  it('① category=ui 命中 endpoint=web 端,不误配 desktop', async () => {
    await reportCapability(
      { endpoint: 'desktop', instanceId: 'desk-a', computerActions: ['mouse_click'] },
      USER_A,
    )
    await reportCapability(
      { endpoint: 'web', instanceId: 'web-a', uiActions: [...ALL_UI_ACTIONS] },
      USER_A,
    )
    await reportCapability(
      { endpoint: 'extension', instanceId: 'ext-a', browserActions: ['click_element'] },
      USER_A,
    )

    expect(__test__.findEndpointByCategory('ui', USER_A)?.capability.instanceId).toBe('web-a')
    // 既有两类别语义不得回退
    expect(__test__.findEndpointByCategory('computer', USER_A)?.capability.instanceId).toBe(
      'desk-a',
    )
    expect(__test__.findEndpointByCategory('browser', USER_A)?.capability.instanceId).toBe('ext-a')
  })

  it('② ui 指令推送到 web 端所属用户,而非同实例上的 desktop 用户', async () => {
    await reportCapability(
      { endpoint: 'desktop', instanceId: 'desk-b', computerActions: ['mouse_click'] },
      USER_B,
    )
    await reportCapability(
      { endpoint: 'web', instanceId: 'web-a', uiActions: ['describe'] },
      USER_A,
    )

    const executePromise = executeCommand({
      requestId: 'req-route-1',
      category: 'ui',
      action: 'describe',
      userId: USER_A,
    })
    await waitPending('req-route-1')

    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush.mock.calls[0]?.[0]).toBe(USER_A)
    const payload = mockPush.mock.calls[0]?.[1] as { type: string; request: AgentActionRequest }
    expect(payload.type).toBe('agent.action')
    expect(payload.request.category).toBe('ui')

    await reportResult({
      requestId: 'req-route-1',
      success: true,
      durationMs: 12,
      executedBy: 'web',
    })
    const res = await executePromise
    expect(res.json<{ data: AgentActionResponse }>().data.executedBy).toBe('web')
  })

  it('③ 无 web 端连接时返回 TARGET_NOT_CONNECTED 且文案为「Web 前端未连接」', async () => {
    await reportCapability(
      { endpoint: 'desktop', instanceId: 'desk-a', computerActions: ['mouse_click'] },
      USER_A,
    )
    await reportCapability(
      { endpoint: 'extension', instanceId: 'ext-a', browserActions: ['click_element'] },
      USER_A,
    )

    const res = await executeCommand({
      requestId: 'req-offline',
      category: 'ui',
      action: 'navigate',
      userId: USER_A,
    })
    const body = res.json<{ data: AgentActionResponse }>().data

    expect(res.statusCode).toBe(200)
    expect(body.success).toBe(false)
    expect(body.errorCode).toBe('TARGET_NOT_CONNECTED')
    expect(body.error).toBe('Web 前端未连接')
    expect(body.executedBy).toBe('unknown')
    expect(mockPush).not.toHaveBeenCalled()
    expect(__test__.pending.size).toBe(0)
  })

  it('④ desktop 未连接文案仍为「桌面端」(回归保护)', async () => {
    const res = await executeCommand({
      requestId: 'req-offline-c',
      category: 'computer',
      action: 'mouse_click',
      userId: USER_A,
    })
    expect(res.json<{ data: AgentActionResponse }>().data.error).toBe('桌面端未连接')
  })

  it('⑤ capability 上报 endpoint=web + uiActions 注册成功,/status 计数正确', async () => {
    const res = await reportCapability(
      { endpoint: 'web', instanceId: 'web-a', uiActions: [...ALL_UI_ACTIONS], version: '1.0.0' },
      USER_A,
    )
    expect(res.statusCode).toBe(200)
    expect(res.json<{ data: { registered: boolean; instanceId: string } }>().data).toEqual({
      registered: true,
      instanceId: 'web-a',
    })

    const statusRes = await app.inject({ method: 'GET', url: `${PREFIX}/status` })
    const status = statusRes.json<{
      data: { endpoints: StatusEndpoint[]; pendingRequests: number }
    }>().data

    expect(status.pendingRequests).toBe(0)
    expect(status.endpoints).toHaveLength(1)
    expect(status.endpoints[0]).toMatchObject({
      endpoint: 'web',
      instanceId: 'web-a',
      uiActions: ALL_UI_ACTIONS.length,
      browserActions: 0,
      computerActions: 0,
    })
  })

  it('⑥ uiActions 超过 20 项 / endpoint 非法值均被 capabilitySchema 拒绝', async () => {
    const tooMany = await reportCapability(
      {
        endpoint: 'web',
        instanceId: 'web-x',
        uiActions: Array.from({ length: 21 }, (_, i) => `a${i}`),
      },
      USER_A,
    )
    expect(tooMany.statusCode).toBe(400)
    expect(__test__.endpoints.size).toBe(0)

    const badEndpoint = await reportCapability(
      { endpoint: 'phone' as AgentControlCapability['endpoint'], instanceId: 'web-y' },
      USER_A,
    )
    expect(badEndpoint.statusCode).toBe(400)
    expect(__test__.endpoints.size).toBe(0)
  })

  it('⑦ 多用户隔离:ui 请求带 userId A 不会命中用户 B 的 web 端', async () => {
    await reportCapability(
      { endpoint: 'web', instanceId: 'web-b', uiActions: [...ALL_UI_ACTIONS] },
      USER_B,
    )

    expect(__test__.findEndpointByCategory('ui', USER_A)).toBeNull()

    const res = await executeCommand({
      requestId: 'req-isolation',
      category: 'ui',
      action: 'describe',
      userId: USER_A,
    })
    const body = res.json<{ data: AgentActionResponse }>().data
    expect(body.errorCode).toBe('TARGET_NOT_CONNECTED')
    expect(mockPush).not.toHaveBeenCalled()

    // 不带 userId 的内部调用不做用户过滤(2026-08-16 隔离语义仅限显式 userId)
    expect(__test__.findEndpointByCategory('ui')?.capability.instanceId).toBe('web-b')
  })

  it('⑧ 多标签页:targetInstanceId 钉定指定端,不被"最后心跳"端抢走', async () => {
    await reportCapability(
      {
        endpoint: 'web',
        instanceId: 'web-a',
        uiActions: [...ALL_UI_ACTIONS],
        reportedAt: new Date().toISOString(),
      },
      USER_A,
    )
    // 后注册的 web-b 心跳更新,默认择优会选它
    await new Promise((r) => setTimeout(r, 5))
    await reportCapability(
      {
        endpoint: 'web',
        instanceId: 'web-b',
        uiActions: [...ALL_UI_ACTIONS],
        reportedAt: new Date().toISOString(),
      },
      USER_A,
    )
    expect(__test__.findEndpointByCategory('ui', USER_A)?.capability.instanceId).toBe('web-b')
    // 显式钉定 describe 应答过的那个页(元素 id 是该页私有映射)
    expect(__test__.findEndpointByCategory('ui', USER_A, 'web-a')?.capability.instanceId).toBe(
      'web-a',
    )
    // 钉定他人端点不生效,回落择优(不得越权)
    expect(__test__.findEndpointByCategory('ui', USER_B, 'web-a')).toBeNull()
    // 钉定已断开的实例同样回落,不报错
    expect(__test__.findEndpointByCategory('ui', USER_A, 'web-dead')?.capability.instanceId).toBe(
      'web-b',
    )
  })

  it('⑯ 钉定实例被"页面重载"留下(心跳落后超一个保活周期)时回落最新端,不再走满超时', async () => {
    // 回归 2026-09-21 真实聊天 round-trip:模型 describe 拿到 instance 后页面被重载,旧实例
    // 在 5min TTL 内仍"注册着",于是每一条后续动作都被推到已死的 socket 上 → 20s TIMEOUT。
    __test__.endpoints.clear()
    await reportCapability(
      {
        endpoint: 'web',
        instanceId: 'web-old',
        uiActions: [...ALL_UI_ACTIONS],
        reportedAt: new Date().toISOString(),
      },
      USER_A,
    )
    await reportCapability(
      {
        endpoint: 'web',
        instanceId: 'web-new',
        uiActions: [...ALL_UI_ACTIONS],
        reportedAt: new Date().toISOString(),
      },
      USER_A,
    )
    const stale = __test__.endpoints.get('web-old')
    expect(stale).toBeTruthy()
    // 旧页面不再心跳:把它的心跳推到容差之外(前端保活周期 60s)
    stale!.lastSeen = Date.now() - 90_000
    expect(__test__.findEndpointByCategory('ui', USER_A, 'web-old')?.capability.instanceId).toBe(
      'web-new',
    )
    // 两个标签页都活着(落后在一个保活周期内)时必须仍然钉住 —— 多标签页语义不得退化
    stale!.lastSeen = Date.now() - 30_000
    expect(__test__.findEndpointByCategory('ui', USER_A, 'web-old')?.capability.instanceId).toBe(
      'web-old',
    )
  })

  it('⑨ executedBy=web 的结果回传能与 pending 配对并 resolve', async () => {
    await reportCapability(
      { endpoint: 'web', instanceId: 'web-a', uiActions: [...ALL_UI_ACTIONS] },
      USER_A,
    )

    const executePromise = executeCommand({
      requestId: 'req-pairing',
      category: 'ui',
      action: 'describe',
      userId: USER_A,
      params: {},
    })
    await waitPending('req-pairing')

    const resultRes = await reportResult({
      requestId: 'req-pairing',
      success: true,
      durationMs: 42,
      executedBy: 'web',
      data: {
        registry: {
          version: 1,
          page: {
            path: '/settings/preferences',
            title: '偏好设置',
            url: 'http://localhost:8801/settings/preferences',
          },
        },
      },
    })
    expect(resultRes.json<{ data: { accepted: boolean } }>().data.accepted).toBe(true)

    const body = (await executePromise).json<{ data: AgentActionResponse }>().data
    expect(body.success).toBe(true)
    expect(body.executedBy).toBe('web')
    expect(body.durationMs).toBe(42)
    expect(body.data?.registry).toMatchObject({ version: 1 })
    // 配对完成后 pending 必须清空,否则超时器会泄漏
    expect(__test__.pending.size).toBe(0)
  })

  it('⑩ 未知 requestId 回传不被配对;executedBy 非法值 400', async () => {
    const orphan = await reportResult({
      requestId: 'req-unknown',
      success: true,
      durationMs: 1,
      executedBy: 'web',
    })
    expect(orphan.json<{ data: { accepted: boolean } }>().data.accepted).toBe(false)

    const bad = await reportResult({
      requestId: 'req-unknown',
      success: true,
      durationMs: 1,
      executedBy: 'phone',
    })
    expect(bad.statusCode).toBe(400)
  })

  it('⑪ ui 指令超时返回 TIMEOUT 并清理 pending', async () => {
    await reportCapability(
      { endpoint: 'web', instanceId: 'web-a', uiActions: [...ALL_UI_ACTIONS] },
      USER_A,
    )

    const res = await executeCommand({
      requestId: 'req-timeout',
      category: 'ui',
      action: 'click',
      userId: USER_A,
      timeout: 1000,
    })
    const body = res.json<{ data: AgentActionResponse }>().data

    expect(body.success).toBe(false)
    expect(body.errorCode).toBe('TIMEOUT')
    expect(body.error).toBe('执行超时(1000 毫秒)')
    expect(__test__.pending.size).toBe(0)
  })

  it('⑫ /execute 缺少内部密钥时 fail-closed 返回 401', async () => {
    const res = await executeCommand(
      { requestId: 'req-noauth', category: 'ui', action: 'describe' },
      false,
    )
    expect(res.statusCode).toBe(401)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('⑭ 三类 UI 通道各投各端:ui→web / app_ui→rn / miniapp_ui→miniapp,互不抢指令', async () => {
    const iso = () => new Date().toISOString()
    await reportCapability(
      { endpoint: 'web', instanceId: 'web-1', uiActions: [...ALL_UI_ACTIONS], reportedAt: iso() },
      USER_A,
    )
    await reportCapability(
      {
        endpoint: 'rn',
        instanceId: 'rn-1',
        appUiActions: ['describe', 'navigate', 'read', 'invoke'],
        reportedAt: iso(),
      },
      USER_A,
    )
    await reportCapability(
      {
        endpoint: 'miniapp',
        instanceId: 'mp-1',
        taroUiActions: ['describe', 'navigate', 'read', 'invoke'],
        reportedAt: iso(),
      },
      USER_A,
    )
    // 三个 category 必须落在三个不同端点:1:1 映射若写错,指令会被另一端吃掉
    expect(__test__.findEndpointByCategory('ui', USER_A)?.capability.instanceId).toBe('web-1')
    expect(__test__.findEndpointByCategory('app_ui', USER_A)?.capability.instanceId).toBe('rn-1')
    expect(__test__.findEndpointByCategory('miniapp_ui', USER_A)?.capability.instanceId).toBe(
      'mp-1',
    )
    // 无 rn 端应答时超时,且推送内容确实是 app_ui 请求(证明投递方向正确)
    const res = await executeCommand({
      requestId: 'req-cat-1',
      category: 'app_ui',
      action: 'navigate',
      params: { name: 'Chat' },
      userId: USER_A,
      timeout: 1000,
    })
    const body = res.json() as { data?: { success: boolean; errorCode?: string } }
    expect(body.data?.errorCode).toBe('TIMEOUT')
    const last = mockPush.mock.calls.at(-1)?.[1] as { type: string; request: { category: string } }
    expect(last.type).toBe('agent.action')
    expect(last.request.category).toBe('app_ui')
  })

  it('⑮ endpoint=rn 能力可注册且 /status 分别计数;未知 endpoint 仍被拒', async () => {
    const res = await reportCapability(
      {
        endpoint: 'rn',
        instanceId: 'rn-s',
        appUiActions: ['describe', 'navigate', 'read', 'invoke'],
        reportedAt: new Date().toISOString(),
      },
      USER_A,
    )
    expect(res.statusCode).toBe(200)
    expect(__test__.endpoints.get('rn-s')?.capability.appUiActions).toHaveLength(4)
    const st = await app.inject({ method: 'GET', url: PREFIX + '/status' })
    const rows = (st.json() as { data?: { endpoints?: StatusEndpoint[] } }).data?.endpoints ?? []
    const me = rows.find((r) => r.instanceId === 'rn-s')
    expect(me?.appUiActions).toBe(4)
    expect(me?.uiActions).toBe(0)
    const bad = await reportCapability(
      { endpoint: 'watch', instanceId: 'bad-1', reportedAt: new Date().toISOString() },
      USER_A,
    )
    expect(bad.statusCode).toBe(400)
  })

  it('⑬ category=ui 被 executeSchema 接受(非法 category 仍 400)', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      headers: INTERNAL_HEADERS,
      payload: { requestId: 'req-bad-cat', category: 'mobile', action: 'describe' },
    })
    expect(bad.statusCode).toBe(400)
    expect(mockPush).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
