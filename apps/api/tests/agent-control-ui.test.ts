// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import type { AgentActionRequest, AgentActionResponse, AgentControlCapability } from '@ihui/types'

// /capability 与 /result 走 checkAuth(JWT → 会查用户状态打 DB);/status 走
// checkAuthOrInternalService(JWT 或内部服务凭据都收,ai-service 要靠它查在线端);
// /execute 走 AGENT_CONTROL_INTERNAL_SECRET。整模块 mock 鉴权,测试不触达生产 PG/Redis。
const { mockAuthenticate, mockCheckAuth, mockCheckAuthOrInternal } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn<(request: { userId?: string }) => Promise<unknown>>(),
  mockCheckAuth: vi.fn<(request: { userId?: string }, reply: unknown) => Promise<boolean>>(),
  mockCheckAuthOrInternal:
    vi.fn<(request: { userId?: string }, reply: unknown) => Promise<boolean>>(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: mockCheckAuth,
  checkAuthOrInternalService: mockCheckAuthOrInternal,
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

/**
 * 移动两端动词清单(2026-09-21 由 4 项扩为 7 项,commit aea6ef9f92 / 7504dc5e11)。
 *
 * 逐项、逐序对齐端内的**入站过滤器**(桥层丢弃"不属于本族协议"动作的那道闸):
 *  - apps/mobile-rn/src/hooks/use-ui-control-bridge.ts → APP_UI_ACTIONS
 *  - apps/miniapp-taro/src/hooks/use-ui-control-bridge.ts → TARO_UI_ACTIONS
 * 顺序照端内清单原样(非字母序),这样这份 fixture 就是"改动词必须同动的五处"里
 * 端侧那一处的可核对快照:端内扩了而这里没扩 → ⑮ 的 toHaveLength(7) 直接红。
 */
const APP_UI_ACTIONS = [
  'describe',
  'navigate',
  'read',
  'invoke',
  'click',
  'fill',
  'submit',
] as const
const TARO_UI_ACTIONS = [...APP_UI_ACTIONS] as const

interface CapabilityBody {
  /** 放宽为 string:需要构造非法枚举值(如 'phone')验证 schema 拒绝 */
  endpoint: string
  instanceId: string
  browserActions?: string[]
  computerActions?: string[]
  uiActions?: string[]
  appUiActions?: string[]
  taroUiActions?: string[]
  /** 第五族 ext_ui(2026-09-21 立)。㉒/㉓/㉔ 都在传这个字段,此前接口漏声明 ——
   *  apps/api/tsconfig.json 的 exclude 含 `tests`,所以它从不显形,补回以免新用例照抄错形态 */
  extUiActions?: string[]
  version?: string
  /** reportCapability 已在 payload 里兜底填了这个字段;个别用例显式覆盖,故声明为可选 */
  reportedAt?: string
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
  /** /status 对第五族同样只回计数(路由里 `?.length ?? 0`),㉓/㉔ 按此断言 */
  extUiActions: number
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
    // /status 默认按"JWT 认到 USER_A"处理;个别用例会改写成内部服务凭据认到别的用户,
    // 用来证明端点清单是**按用户过滤**的(不得把别人的端点泄漏给当前调用方)
    mockCheckAuthOrInternal.mockReset()
    mockCheckAuthOrInternal.mockImplementation(async (request) => {
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

  it('⑰ /status 认内部服务凭据,且端点清单按用户过滤(不泄漏别人的端点)', async () => {
    await reportCapability(
      {
        endpoint: 'web',
        instanceId: 'web-a',
        uiActions: [...ALL_UI_ACTIONS],
        reportedAt: new Date().toISOString(),
      },
      USER_A,
    )
    await reportCapability(
      {
        endpoint: 'rn',
        instanceId: 'rn-b',
        appUiActions: [...APP_UI_ACTIONS],
        reportedAt: new Date().toISOString(),
      },
      USER_B,
    )

    // ① 内部凭据路径必须可用:ai-service 只带机器凭据(JWT 这条走不通),
    //    若 /status 仍只认 checkAuth,这里就是 401 —— 那正是它此前读不到在线端的原因。
    mockCheckAuth.mockResolvedValue(false)
    mockCheckAuthOrInternal.mockImplementation(async (request) => {
      request.userId = USER_A
      return true
    })
    const asOwner = await app.inject({ method: 'GET', url: `${PREFIX}/status` })
    expect(asOwner.statusCode).toBe(200)
    const own = (asOwner.json().data.endpoints as StatusEndpoint[]).map((e) => e.instanceId)
    expect(own).toEqual(['web-a'])
    // ② USER_B 的 rn 端不得出现在 USER_A 的回执里(改前是全表返回 = 跨租户泄漏)
    expect(own).not.toContain('rn-b')

    mockCheckAuthOrInternal.mockImplementation(async (request) => {
      request.userId = USER_B
      return true
    })
    const asOther = await app.inject({ method: 'GET', url: `${PREFIX}/status` })
    expect((asOther.json().data.endpoints as StatusEndpoint[]).map((e) => e.instanceId)).toEqual([
      'rn-b',
    ])
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
        appUiActions: [...APP_UI_ACTIONS],
        reportedAt: iso(),
      },
      USER_A,
    )
    await reportCapability(
      {
        endpoint: 'miniapp',
        instanceId: 'mp-1',
        taroUiActions: [...TARO_UI_ACTIONS],
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
        appUiActions: [...APP_UI_ACTIONS],
        reportedAt: new Date().toISOString(),
      },
      USER_A,
    )
    expect(res.statusCode).toBe(200)
    // 硬编码 7:api 侧只做 max(10) 长度闸、不校验动词名,所以"收全 7 个"必须由这里钉住。
    // 若有人把这份 fixture 缩回四动词,存进注册表的就只有 4 项 → 本断言立即红。
    expect(__test__.endpoints.get('rn-s')?.capability.appUiActions).toHaveLength(7)
    expect(__test__.endpoints.get('rn-s')?.capability.appUiActions).toEqual([...APP_UI_ACTIONS])
    const st = await app.inject({ method: 'GET', url: PREFIX + '/status' })
    const rows = (st.json() as { data?: { endpoints?: StatusEndpoint[] } }).data?.endpoints ?? []
    const me = rows.find((r) => r.instanceId === 'rn-s')
    expect(me?.appUiActions).toBe(7)
    // 同名清单在 rn 端只计入 appUiActions,不得串到 web 家族的 uiActions 计数上
    expect(me?.uiActions).toBe(0)
    expect(me?.taroUiActions).toBe(0)
    const bad = await reportCapability(
      { endpoint: 'watch', instanceId: 'bad-1', reportedAt: new Date().toISOString() },
      USER_A,
    )
    expect(bad.statusCode).toBe(400)
  })

  it('⑱ app_ui + action=fill(移动两端新动词)被 /execute 接受并原样投递到 rn 端', async () => {
    const iso = () => new Date().toISOString()
    // 择端证据的构造法:web 端挂到 USER_A,带新动词的 rn 端挂到 USER_B。
    // 若 app_ui 被误配成 endpoint='web'(CATEGORY_ENDPOINT 写错),USER_B 这条必然
    // TARGET_NOT_CONNECTED 且一次都不推 —— 所以下面"推送发生 + 回执 executedBy=rn"
    // 本身就是"投递到了 rn 端而非 web 端"的证据,不只是对映射函数的复述。
    await reportCapability(
      { endpoint: 'web', instanceId: 'web-1', uiActions: [...ALL_UI_ACTIONS], reportedAt: iso() },
      USER_A,
    )
    await reportCapability(
      { endpoint: 'rn', instanceId: 'rn-1', appUiActions: [...APP_UI_ACTIONS], reportedAt: iso() },
      USER_B,
    )

    const executePromise = executeCommand({
      requestId: 'req-rn-fill',
      category: 'app_ui',
      // 'fill' 不在旧的四个动词里:协议层(action: z.string().min(1).max(100))不拦,
      // 这条用例就是"能力面已放开"的投递实证。
      action: 'fill',
      params: { target: 'fld:input#3', value: '100', clear: true },
      userId: USER_B,
    })
    await waitPending('req-rn-fill')

    // 只推一次:不得向同一用户的其他端扩散(一次 fan-out 就等于三端串指令)
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush.mock.calls[0]?.[0]).toBe(USER_B)
    const payload = mockPush.mock.calls[0]?.[1] as { type: string; request: AgentActionRequest }
    expect(payload.type).toBe('agent.action')
    expect(payload.request.category).toBe('app_ui')
    expect(payload.request.action).toBe('fill')
    // params 必须原样到达(api 侧 z.record(z.string(), z.unknown()) 不得吞字段/改类型)
    expect(payload.request.params).toEqual({ target: 'fld:input#3', value: '100', clear: true })
    // 新动词必须已在能力面上(端侧扩清单 → api 注册表收全,否则闸门读不到 fill)
    expect(__test__.endpoints.get('rn-1')?.capability.appUiActions).toContain('fill')
    expect(__test__.findEndpointByCategory('app_ui', USER_B)?.capability.instanceId).toBe('rn-1')
    expect(__test__.findEndpointByCategory('ui', USER_B)).toBeNull()

    await reportResult({
      requestId: 'req-rn-fill',
      success: true,
      durationMs: 8,
      executedBy: 'rn',
    })
    const body = (await executePromise).json<{ data: AgentActionResponse }>().data
    expect(body.success).toBe(true)
    expect(body.executedBy).toBe('rn')
    expect(body.durationMs).toBe(8)
    expect(__test__.pending.size).toBe(0)
  })

  it('⑲ miniapp_ui + action=click 落到 miniapp 端,web 端抢不走', async () => {
    const iso = () => new Date().toISOString()
    // 同上:USER_B 只有 rn/miniapp 两端,任何一条被错配到 'web' 的指令都会当场失败。
    await reportCapability(
      { endpoint: 'web', instanceId: 'web-1', uiActions: [...ALL_UI_ACTIONS], reportedAt: iso() },
      USER_A,
    )
    await reportCapability(
      { endpoint: 'rn', instanceId: 'rn-1', appUiActions: [...APP_UI_ACTIONS], reportedAt: iso() },
      USER_B,
    )
    await reportCapability(
      {
        endpoint: 'miniapp',
        instanceId: 'mp-1',
        taroUiActions: [...TARO_UI_ACTIONS],
        reportedAt: iso(),
      },
      USER_B,
    )

    const executePromise = executeCommand({
      requestId: 'req-mp-click',
      category: 'miniapp_ui',
      action: 'click',
      params: { target: 'btn:search#1' },
      userId: USER_B,
    })
    await waitPending('req-mp-click')

    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush.mock.calls[0]?.[0]).toBe(USER_B)
    const payload = mockPush.mock.calls[0]?.[1] as { type: string; request: AgentActionRequest }
    expect(payload.request.category).toBe('miniapp_ui')
    expect(payload.request.action).toBe('click')
    expect(payload.request.params).toEqual({ target: 'btn:search#1' })
    expect(__test__.endpoints.get('mp-1')?.capability.taroUiActions).toContain('click')
    // 同类同用户下 rn 与 miniapp 也必须各投各的(click 在两端都是新动词,更易串)
    expect(__test__.findEndpointByCategory('miniapp_ui', USER_B)?.capability.instanceId).toBe(
      'mp-1',
    )
    expect(__test__.findEndpointByCategory('app_ui', USER_B)?.capability.instanceId).toBe('rn-1')

    await reportResult({
      requestId: 'req-mp-click',
      success: true,
      durationMs: 15,
      executedBy: 'miniapp',
    })
    expect((await executePromise).json<{ data: AgentActionResponse }>().data.executedBy).toBe(
      'miniapp',
    )

    // 反向证据:USER_B 无 web 端 → 走 'ui' 通道必须快速 TARGET_NOT_CONNECTED,
    // 且这条不会把指令偷偷送到他人在 USER_A 的 web-1 上(mockPush 仍为 1 次)。
    const viaWeb = await executeCommand({
      requestId: 'req-mp-no-web',
      category: 'ui',
      action: 'click',
      userId: USER_B,
    })
    expect(viaWeb.json<{ data: AgentActionResponse }>().data.errorCode).toBe('TARGET_NOT_CONNECTED')
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('⑳ appUiActions/taroUiActions 长度闸现测口径:7 项收得下,第 11 项整条 400', async () => {
    // capabilitySchema 对两族只设 max(10)(不校验动词名)。扩到 7 后只剩 3 个余量,
    // 下一次再扩动词时必须先确认这个上限,否则端侧能力上报会整条被拒(注册表里查无此端)。
    const iso = () => new Date().toISOString()
    const ok = await reportCapability(
      {
        endpoint: 'miniapp',
        instanceId: 'mp-cap',
        taroUiActions: [...TARO_UI_ACTIONS],
        reportedAt: iso(),
      },
      USER_A,
    )
    expect(ok.statusCode).toBe(200)
    expect(__test__.endpoints.get('mp-cap')?.capability.taroUiActions).toHaveLength(7)

    const eleven = await reportCapability(
      {
        endpoint: 'rn',
        instanceId: 'rn-cap',
        appUiActions: Array.from({ length: 11 }, (_, i) => `a${i}`),
        reportedAt: iso(),
      },
      USER_A,
    )
    expect(eleven.statusCode).toBe(400)
    expect(__test__.endpoints.has('rn-cap')).toBe(false)
  })

  it('㉑ /status 两族回执必须由全 7 动词清单得出(app_ui 与 miniapp_ui 各自成对,不串族)', async () => {
    const iso = () => new Date().toISOString()
    await reportCapability(
      { endpoint: 'rn', instanceId: 'rn-7', appUiActions: [...APP_UI_ACTIONS], reportedAt: iso() },
      USER_A,
    )
    await reportCapability(
      {
        endpoint: 'miniapp',
        instanceId: 'mp-7',
        taroUiActions: [...TARO_UI_ACTIONS],
        reportedAt: iso(),
      },
      USER_A,
    )

    /**
     * 协议真相的**第二处字面量**:上面 APP_UI_ACTIONS / TARO_UI_ACTIONS 是"端内入站过滤器"的
     * 镜像(改端侧清单时要跟着改),这里刻意再写一遍裸字面量 —— 两处必须同时动,
     * 任何一处偷偷缩回四动词都会红掉一条。
     */
    const SEVEN = ['describe', 'navigate', 'read', 'invoke', 'click', 'fill', 'submit']
    expect(__test__.endpoints.get('rn-7')?.capability.appUiActions).toEqual(SEVEN)
    expect(__test__.endpoints.get('mp-7')?.capability.taroUiActions).toEqual(SEVEN)

    const st = await app.inject({ method: 'GET', url: `${PREFIX}/status` })
    const rows = (st.json() as { data?: { endpoints?: StatusEndpoint[] } }).data?.endpoints ?? []
    const rn = rows.find((r) => r.instanceId === 'rn-7')
    const mp = rows.find((r) => r.instanceId === 'mp-7')
    // 现测口径:/status 对两族只回**计数**(路由里是 `?.length ?? 0`),数组本身不外泄
    // (⑰ 的按用户过滤同理,避免把别人的动作面暴露出去)。所以"数组含全 7 动词"的证据
    // 只能取上面那份注册表,这里钉的是"回执计数 = 该数组长度且等于 7"。
    expect(rn?.appUiActions).toBe(7)
    expect(mp?.taroUiActions).toBe(7)
    // 族不得互串:rn 端报的清单只计入 appUiActions,miniapp 端只计入 taroUiActions
    expect(rn?.taroUiActions).toBe(0)
    expect(mp?.appUiActions).toBe(0)
    // 计数与数组同源(注册表被截断/重排也会在这里暴露)
    expect(rn?.appUiActions).toBe(__test__.endpoints.get('rn-7')?.capability.appUiActions?.length)
    expect(mp?.taroUiActions).toBe(__test__.endpoints.get('mp-7')?.capability.taroUiActions?.length)
  })

  it('㉒ category=ext_ui 命中 extension 端,且与 browser 同端不互抢(1:1 择端按 category)', async () => {
    // 同一个扩展实例同时承载两类执行面:browser(外部网页)与 ext_ui(自有面板)
    await reportCapability(
      {
        endpoint: 'extension',
        instanceId: 'ext-dual',
        browserActions: ['click_element'],
        extUiActions: ['describe', 'navigate', 'read', 'invoke', 'click', 'fill', 'submit'],
      },
      USER_A,
    )
    expect(__test__.findEndpointByCategory('ext_ui', USER_A)?.capability.instanceId).toBe(
      'ext-dual',
    )
    expect(__test__.findEndpointByCategory('browser', USER_A)?.capability.instanceId).toBe(
      'ext-dual',
    )
    // 但指令按 category 精确投递:ext_ui 的 request.category 是 'ext_ui',不会被改写成 browser
    const executed = executeCommand({
      requestId: 'req-ext-ui',
      category: 'ext_ui',
      action: 'fill',
      params: { target: 'el:input#3', value: 'AI 写入' },
      __user_id: USER_A,
    })
    await executed
    expect(mockPush).toHaveBeenCalledTimes(1)
    const frame = mockPush.mock.calls[0]?.[1] as { request?: { category?: string } }
    expect(frame?.request?.category).toBe('ext_ui')
  })

  it('㉓ /status 对 ext_ui 族回计数,且浏览器/桌面族不串计', async () => {
    await reportCapability(
      {
        endpoint: 'extension',
        instanceId: 'ext-s',
        browserActions: ['click_element'],
        extUiActions: ['describe', 'read'],
      },
      USER_A,
    )
    const st = await app.inject({ method: 'GET', url: `${PREFIX}/status` })
    expect(st.statusCode).toBe(200)
    const rows = (st.json() as { data?: { endpoints?: StatusEndpoint[] } }).data?.endpoints ?? []
    const ext = rows.find((r) => r.instanceId === 'ext-s')
    expect(ext?.extUiActions).toBe(2)
    expect(ext?.browserActions).toBe(1)
  })

  it('㉔ 反向断言:每个 category 的候选端恰好一个(1:1 择端,判据覆盖第五族自身形态)', async () => {
    // 本用例钉的是**反向**那一侧。㉒/⑭ 证明的是"这一族投到了正确的端"(正向命中),
    // 而正向取证对 1:N 改造同样绿灯:表若被写成 `Record<category, endpoint[]>`,
    // 命中结果照样落在正确那一端,测试全绿,而"同一 category 有两个候选端"已经成立 ——
    // 那正是本票刻意不复用 browser 所要防的形态(择端一旦可多选,ext_ui 指令可能被
    // 当作 browser 执行,表现为回执 ok 而面板没动)。所以必须让判据能看见**表自己的形状**。
    const iso = () => new Date().toISOString()
    // 注册表刻意含**两个 extension 实例**(browser 与 ext_ui 共用的那一个端上双页面并存
    // 是真实形态)。若哪天有人按 endpoint 而非 category 择端,这两个 category 就会各自
    // 出现两个候选端 —— 只在此时 kinds 基数才会从 1 变成 2,正向用例抓不到这一型。
    const seeds: ReadonlyArray<{
      endpoint: AgentControlCapability['endpoint']
      instanceId: string
    }> = [
      { endpoint: 'extension', instanceId: 'seed-ext-a' },
      { endpoint: 'extension', instanceId: 'seed-ext-b' },
      { endpoint: 'desktop', instanceId: 'seed-desktop' },
      { endpoint: 'web', instanceId: 'seed-web' },
      { endpoint: 'rn', instanceId: 'seed-rn' },
      { endpoint: 'miniapp', instanceId: 'seed-miniapp' },
    ]
    for (const seed of seeds) {
      await reportCapability({ ...seed, reportedAt: iso() }, USER_A)
    }

    const table = __test__.categoryEndpoint

    // (1) 键集与 executeSchema 的 category 值域双向等值:少一项 ⇒ 该族无端可投;
    //     多一项 ⇒ 冒出 schema 不收却会被择端的幽灵族。改 z.enum 必须同改这份字面量。
    expect(Object.keys(table).sort()).toEqual(
      ['app_ui', 'browser', 'computer', 'ext_ui', 'miniapp_ui', 'ui'].sort(),
    )

    // (2) 全表取值逐位钉死(可读的回归哨兵,优于"值落在端点值域里"的弱判据)
    expect({ ...table }).toEqual({
      browser: 'extension',
      computer: 'desktop',
      ui: 'web',
      app_ui: 'rn',
      miniapp_ui: 'miniapp',
      ext_ui: 'extension',
    })

    for (const category of Object.keys(table) as AgentActionRequest['category'][]) {
      const mapped = table[category]

      // (3) 反向断言本体:候选端必须是**单个字符串**,不是数组/集合。
      expect(typeof mapped, `category=${category} 应映射到单一端点`).toBe('string')
      expect(Array.isArray(mapped), `category=${category} 不得映射到端点数组`).toBe(false)

      // (4) 投递面自证:走生产择端的同一函数,该 category 可达的**端点种类数**恒为 1。
      const kinds = new Set<AgentControlCapability['endpoint']>()
      for (let i = 0; i < seeds.length; i += 1) {
        // 反复取同一 category:候选端唯一时结果必须恒定,不随调用次序漂移
        const hit = __test__.findEndpointByCategory(category, USER_A)
        if (hit) kinds.add(hit.capability.endpoint)
      }
      expect(
        kinds.size,
        `category=${category} 出现 ${kinds.size} 个候选端: ${[...kinds].join(', ')}`,
      ).toBe(1)
      expect([...kinds][0]).toBe(mapped)
    }

    // (5) 那一处**刻意的**多对一:6 个 category 落在 5 个端上,且"共用 extension 的
    //     category 恰好两个"。复用只发生在 endpoint 层,绝不发生在 category 层 ——
    //     钉住"第五族是靠新增 category 落地的",而不是把 browser 改指过去或反过来。
    //     (若有人图省事复用 browser,键集会缩成 5、extension 只挂 1 族,这里必红。)
    const endpointsUsed = new Set(Object.values(table))
    expect(endpointsUsed.size).toBe(5)
    const categoriesOnExtension = (Object.keys(table) as AgentActionRequest['category'][])
      .filter((c) => table[c] === 'extension')
      .sort()
    expect(categoriesOnExtension).toEqual(['browser', 'ext_ui'])
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
