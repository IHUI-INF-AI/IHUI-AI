// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GitHub App 落库行为测试(D15①②③):
 * - installation 事件(created/deleted/new_permission_accepted)→ 安装映射表 upsert;
 * - 投递幂等二级表:重启后(新 deduper + 有数据的 store)不再重复处理;
 * - admin GET /installations:闸门 + 行数据 + 配置布尔(绝不回 secret 值)。
 * 持久层全部注入假实现(接口见 services/github-app/store.ts),不触真实 db。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'

import githubAppRoutes, {
  INSTALLATIONS_PATH,
  WEBHOOK_PATH,
  type GithubAppRouteOptions,
} from '../src/routes/github-app'
import { createDeliveryDeduper } from '../src/services/github-app/events'
import {
  createNullGithubAppStore,
  type GithubAppStore,
  type InstallationEventInput,
} from '../src/services/github-app/store'

const { mockRequireAdmin } = vi.hoisted(() => ({ mockRequireAdmin: vi.fn() }))

// require-permission 的静态链拖 auth/rbac/db,与生产路由一样走懒加载;测试里钉住行为
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: mockRequireAdmin,
  requireAuth: vi.fn().mockResolvedValue(undefined),
  requirePermission: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
  requireAdminRouteGuard: vi.fn().mockResolvedValue(undefined),
}))

const SECRET = 'whsec_unit_test'
const BASE = '/api/github-app'

function makeStore(overrides: Partial<GithubAppStore> = {}): GithubAppStore {
  return {
    hasDelivery: vi.fn(async () => false),
    recordDelivery: vi.fn(async () => {}),
    applyInstallationEvent: vi.fn(async () => {}),
    listInstallations: vi.fn(async () => []),
    ...overrides,
  }
}

function buildApp({
  store,
  adminGuard,
}: { store?: GithubAppStore | null; adminGuard?: GithubAppRouteOptions['adminGuard'] } = {}): {
  server: FastifyInstance
} {
  const server = Fastify({ logger: false })
  void server.register(githubAppRoutes, {
    prefix: BASE,
    webhookSecret: SECRET,
    deduper: createDeliveryDeduper(),
    store,
    adminGuard,
  })
  return { server }
}

function sign(body: string, secret: string = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`
}

function post(
  server: FastifyInstance,
  event: string,
  payload: unknown,
  delivery: string,
): ReturnType<FastifyInstance['inject']> {
  const body = JSON.stringify(payload)
  return server.inject({
    method: 'POST',
    url: `${BASE}${WEBHOOK_PATH}`,
    headers: {
      'content-type': 'application/json',
      'x-github-event': event,
      'x-github-delivery': delivery,
      'x-hub-signature-256': sign(body),
    },
    payload: body,
  })
}

function installationPayload(action: string, overrides: Record<string, unknown> = {}) {
  return {
    action,
    installation: {
      id: 9001,
      account: { login: 'octo-org', type: 'Organization' },
      target_type: 'Organization',
    },
    sender: { login: 'admin-dev', id: 42 },
    ...overrides,
  }
}

beforeEach(() => {
  mockRequireAdmin.mockReset()
  mockRequireAdmin.mockResolvedValue(undefined)
})

describe('github-app D15①:installation 事件落表', () => {
  it('created → upsert active,含账号/类型/操作者,投递落表', async () => {
    const store = makeStore()
    const { server } = buildApp({ store })
    await server.ready()
    const response = await post(server, 'installation', installationPayload('created'), 'd-created')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      code: 0,
      data: {
        accepted: true,
        event: 'installation',
        outcome: { status: 'applied', installationId: 9001 },
      },
    })
    expect(store.applyInstallationEvent).toHaveBeenCalledWith({
      installationId: 9001,
      accountLogin: 'octo-org',
      targetType: 'Organization',
      installedByUserId: 42,
      status: 'active',
    } satisfies InstallationEventInput)
    expect(store.recordDelivery).toHaveBeenCalledWith('d-created', 'installation')
  })

  it('deleted → upsert removed', async () => {
    const store = makeStore()
    const { server } = buildApp({ store })
    await server.ready()
    const response = await post(server, 'installation', installationPayload('deleted'), 'd-deleted')
    expect(response.json()).toMatchObject({ code: 0, data: { accepted: true } })
    expect(store.applyInstallationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ installationId: 9001, status: 'removed' }),
    )
  })

  it('new_permission_accepted → 仍 active(权限更新不换状态)', async () => {
    const store = makeStore()
    const { server } = buildApp({ store })
    await server.ready()
    const response = await post(
      server,
      'installation',
      installationPayload('new_permission_accepted'),
      'd-perms',
    )
    expect(response.json()).toMatchObject({ code: 0, data: { accepted: true } })
    expect(store.applyInstallationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
    )
  })

  it('缺 sender/账号 → 落 NULL,不造数', async () => {
    const store = makeStore()
    const { server } = buildApp({ store })
    await server.ready()
    const payload = installationPayload('created')
    delete (payload['installation'] as Record<string, unknown>)['account']
    delete (payload as Record<string, unknown>)['sender']
    await post(server, 'installation', payload, 'd-no-sender')
    expect(store.applyInstallationEvent).toHaveBeenCalledWith({
      installationId: 9001,
      accountLogin: null,
      targetType: 'Organization',
      installedByUserId: null,
      status: 'active',
    } satisfies InstallationEventInput)
  })

  it('白名单外 action(如 suspend)→ skipped:unsupported_action,不落表但投递记 processed', async () => {
    const store = makeStore()
    const { server } = buildApp({ store })
    await server.ready()
    const response = await post(server, 'installation', installationPayload('suspend'), 'd-suspend')
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: false, outcome: { status: 'skipped', reason: 'unsupported_action' } },
    })
    expect(store.applyInstallationEvent).not.toHaveBeenCalled()
    expect(store.recordDelivery).toHaveBeenCalledWith('d-suspend', 'installation')
  })

  it('持久层未接(store=null)→ skipped:store_unavailable,响应仍 2xx', async () => {
    const { server } = buildApp({ store: null })
    await server.ready()
    const response = await post(server, 'installation', installationPayload('created'), 'd-null')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: false, outcome: { status: 'skipped', reason: 'store_unavailable' } },
    })
  })

  it('落表抛错 → 收敛为 skipped:store_error,不 5xx', async () => {
    const store = makeStore({
      applyInstallationEvent: vi.fn(async () => {
        throw new Error('duplicate key value violates unique constraint')
      }),
    })
    const { server } = buildApp({ store })
    await server.ready()
    const response = await post(server, 'installation', installationPayload('created'), 'd-boom')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: false, outcome: { status: 'skipped', reason: 'store_error' } },
    })
  })
})

describe('github-app D15②:投递幂等二级表(重启后防重投)', () => {
  it('新 deduper(重启)+ 表里已处理 → duplicate_delivery,不再执行', async () => {
    const store = makeStore({ hasDelivery: vi.fn(async () => true) })
    const { server } = buildApp({ store })
    await server.ready()
    const response = await post(
      server,
      'installation',
      installationPayload('created'),
      'd-across-restart',
    )
    expect(response.json()).toMatchObject({
      code: 0,
      data: { accepted: false, reason: 'duplicate_delivery' },
    })
    expect(store.hasDelivery).toHaveBeenCalledWith('d-across-restart')
    expect(store.applyInstallationEvent).not.toHaveBeenCalled()
  })

  it('表里未见 → 正常处理并落表(完整闭环)', async () => {
    const store = makeStore()
    const { server } = buildApp({ store })
    await server.ready()
    await post(server, 'installation', installationPayload('created'), 'd-fresh')
    expect(store.hasDelivery).toHaveBeenCalledWith('d-fresh')
    expect(store.applyInstallationEvent).toHaveBeenCalledTimes(1)
    expect(store.recordDelivery).toHaveBeenCalledWith('d-fresh', 'installation')
  })

  it('查表抛错 → fail-open 按未处理继续,不影响主流程', async () => {
    const store = makeStore({
      hasDelivery: vi.fn(async () => {
        throw new Error('connection refused')
      }),
    })
    const { server } = buildApp({ store })
    await server.ready()
    const response = await post(server, 'installation', installationPayload('created'), 'd-db-down')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ code: 0, data: { accepted: true } })
    expect(store.applyInstallationEvent).toHaveBeenCalledTimes(1)
  })

  it('落表抛错 → 响应仍 2xx(幂等表绝不反过来打挂 webhook)', async () => {
    const store = makeStore({
      recordDelivery: vi.fn(async () => {
        throw new Error('write failed')
      }),
    })
    const { server } = buildApp({ store })
    await server.ready()
    const response = await post(server, 'ping', { zen: 'ok' }, 'd-write-fail')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ code: 0, data: { accepted: true, reason: 'pong' } })
  })

  it('null store 的接口语义:查=未见、写=丢弃、列表=空', async () => {
    const store = createNullGithubAppStore()
    await expect(store.hasDelivery('x')).resolves.toBe(false)
    await expect(store.recordDelivery('x', 'ping')).resolves.toBeUndefined()
    await expect(store.listInstallations()).resolves.toEqual([])
  })
})

describe('github-app D15③:GET /installations(admin 面)', () => {
  it('admin 闸门拦截(非管理员)→ 401/403 由闸门给出,store 不被触碰', async () => {
    mockRequireAdmin.mockImplementation(
      async (
        _req: unknown,
        reply: { status: (n: number) => { send: (b: unknown) => unknown } },
      ) => {
        void reply.status(403).send({ code: 403, message: '需要管理员权限', data: null })
      },
    )
    const store = makeStore()
    const { server } = buildApp({ store })
    await server.ready()
    const response = await server.inject({ method: 'GET', url: `${BASE}${INSTALLATIONS_PATH}` })
    expect([401, 403]).toContain(response.statusCode)
    expect(store.listInstallations).not.toHaveBeenCalled()
  })

  it('管理员 → 返回安装列表 + 配置布尔,绝不回 secret 值', async () => {
    const store = makeStore({
      listInstallations: vi.fn(async () => [
        {
          installationId: 9001,
          accountLogin: 'octo-org',
          targetType: 'Organization',
          installedByUserId: 42,
          status: 'active',
          createdAt: '2026-09-26T00:00:00.000Z',
          updatedAt: '2026-09-26T01:00:00.000Z',
        },
      ]),
    })
    const { server } = buildApp({ store })
    await server.ready()
    const response = await server.inject({ method: 'GET', url: `${BASE}${INSTALLATIONS_PATH}` })
    expect(response.statusCode).toBe(200)
    const body = response.json() as {
      data: { installations: unknown[]; config: Record<string, unknown> }
    }
    expect(body.data.installations).toHaveLength(1)
    expect(body.data.config).toEqual({
      webhookSecretConfigured: expect.any(Boolean),
      appCredentialsConfigured: expect.any(Boolean),
    })
    expect(response.body).not.toContain(SECRET)
  })

  it('持久层未就绪(store=null)→ 503,不假装空列表', async () => {
    const { server } = buildApp({ store: null })
    await server.ready()
    const response = await server.inject({ method: 'GET', url: `${BASE}${INSTALLATIONS_PATH}` })
    expect(response.statusCode).toBe(503)
  })

  it('列表查询抛错 → 500(带中文消息,不泄内部细节)', async () => {
    const store = makeStore({
      listInstallations: vi.fn(async () => {
        throw new Error('relation "github_app_installations" does not exist')
      }),
    })
    const { server } = buildApp({ store })
    await server.ready()
    const response = await server.inject({ method: 'GET', url: `${BASE}${INSTALLATIONS_PATH}` })
    expect(response.statusCode).toBe(500)
    expect(response.json()).toMatchObject({ code: 500 })
    expect(response.body).not.toContain('does not exist')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
