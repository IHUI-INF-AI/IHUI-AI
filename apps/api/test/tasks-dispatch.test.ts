import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ---------- 鉴权 mock ----------
const { mockCheckAuth } = vi.hoisted(() => ({
  mockCheckAuth: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: mockCheckAuth,
  authenticate: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-for-vitest-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn() },
}))

import { tasksRoutes } from '../src/routes/tasks.js'

/** 进程内 Redis mock:store(字符串 KV)+ hashes(Hash 结构,设备注册表用) */
function createMockRedis() {
  const store = new Map<string, string>()
  const hashes = new Map<string, Map<string, string>>()
  return {
    store,
    hashes,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
      return 'OK'
    }),
    hset: vi.fn(async (k: string, f: string, v: string) => {
      if (!hashes.has(k)) hashes.set(k, new Map())
      hashes.get(k)!.set(f, v)
      return 1
    }),
    hgetall: vi.fn(async (k: string) => {
      const h = hashes.get(k)
      if (!h) return {} as Record<string, string>
      const o: Record<string, string> = {}
      for (const [f, v] of h) o[f] = v
      return o
    }),
    hdel: vi.fn(async (k: string, ...fs: string[]) => {
      const h = hashes.get(k)
      if (!h) return 0
      let n = 0
      for (const f of fs) if (h.delete(f)) n++
      return n
    }),
    expire: vi.fn(async () => 1),
    publish: vi.fn(async () => 1),
  }
}

const mockRedis = createMockRedis()
const mockPushNotification = vi.fn()

describe('Tasks Dispatch API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('redis', mockRedis as never)
    app.decorate('pushNotification', mockPushNotification as never)
    await app.register(tasksRoutes, { prefix: '/api' })
    await app.ready()
    mockCheckAuth.mockImplementation((req: { userId?: string }) => {
      req.userId = '1'
      return Promise.resolve(true)
    })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockRedis.store.clear()
    mockRedis.hashes.clear()
    mockPushNotification.mockReset()
    mockCheckAuth.mockReset()
    mockCheckAuth.mockImplementation((req: { userId?: string }) => {
      req.userId = '1'
      return Promise.resolve(true)
    })
  })

  // ===================== POST /tasks/dispatch =====================
  describe('POST /api/tasks/dispatch', () => {
    it('创建 pending 任务并返回 task', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'desktop-001', command: 'npm test' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.task).toMatchObject({
        toDevice: 'desktop-001',
        command: 'npm test',
        status: 'pending',
        fromDevice: 'api',
        userId: 1,
      })
      expect(body.data.task.id).toBeTruthy()
      expect(body.data.task.createdAt).toBeTruthy()
      // WS 推送被调用
      expect(mockPushNotification).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ type: 'task-dispatch' }),
      )
    })

    it('缺少 toDevice 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { command: 'npm test' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })

    it('缺少 command 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'desktop-001' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ===================== POST /tasks/result =====================
  describe('POST /api/tasks/result', () => {
    it('更新任务状态并返回 task', async () => {
      // 先 dispatch 拿 taskId
      const disp = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'ls' },
      })
      const taskId = disp.json().data.task.id

      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks/result',
        payload: { taskId, status: 'completed', output: 'done' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.task.id).toBe(taskId)
      expect(body.data.task.status).toBe('completed')
      expect(body.data.task.result.output).toBe('done')
      expect(body.data.task.result.finishedAt).toBeTruthy()
      // WS 推送被调用
      expect(mockPushNotification).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ type: 'task-result' }),
      )
    })

    it('任务不存在返回 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks/result',
        payload: { taskId: 'no-such-task', status: 'completed' },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().code).toBe(404)
    })

    it('缺少 status 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks/result',
        payload: { taskId: 'whatever' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('非法 status 枚举返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks/result',
        payload: { taskId: 'whatever', status: 'unknown' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ===================== GET /tasks =====================
  describe('GET /api/tasks', () => {
    it('列出用户任务', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'a' },
      })
      await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd2', command: 'b' },
      })
      const res = await app.inject({ method: 'GET', url: '/api/tasks' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.total).toBe(2)
      expect(body.data.tasks).toHaveLength(2)
    })

    it('无任务时返回空列表', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tasks' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.total).toBe(0)
      expect(body.data.tasks).toHaveLength(0)
    })

    it('不传 since 时返回全量任务', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'a' },
      })
      await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd2', command: 'b' },
      })
      const res = await app.inject({ method: 'GET', url: '/api/tasks' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.total).toBe(2)
    })

    it('传 since 返回 updatedAt > since 的增量任务(补拉断线期间错过的任务)', async () => {
      // 任务 1:旧任务(createdAt 早于 since,应被过滤)
      const oldRes = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'old' },
      })
      const oldTask = oldRes.json().data.task
      // 构造 since 为旧任务 updatedAt + 1ms(确保旧任务被过滤)
      const sinceTs = Date.parse(oldTask.updatedAt) + 1

      // 任务 2:新任务(createdAt 晚于 since,应被返回)
      await new Promise((r) => setTimeout(r, 5))
      const newRes = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd2', command: 'new' },
      })
      const newTask = newRes.json().data.task

      const res = await app.inject({ method: 'GET', url: `/api/tasks?since=${sinceTs}` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.total).toBe(1)
      expect(body.data.tasks[0].id).toBe(newTask.id)
      // 旧任务应被过滤
      expect(body.data.tasks.find((t: { id: string }) => t.id === oldTask.id)).toBeUndefined()
    })

    it('since 过滤后无匹配任务返回空列表', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'a' },
      })
      // since 设为未来时间戳,应无任务返回
      const futureTs = Date.now() + 100_000
      const res = await app.inject({ method: 'GET', url: `/api/tasks?since=${futureTs}` })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.total).toBe(0)
    })

    it('since 为负数返回 400', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tasks?since=-1' })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })
  })

  // ===================== POST /tasks/:id/cancel =====================
  describe('POST /api/tasks/:id/cancel', () => {
    it('取消 pending 任务并返回 cancelled 状态 + WS 推送 task-cancelled', async () => {
      const disp = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'npm test' },
      })
      const taskId = disp.json().data.task.id

      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${taskId}/cancel`,
        payload: {},
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.task.id).toBe(taskId)
      expect(body.data.task.status).toBe('cancelled')
      expect(body.data.task.updatedAt).toBeTruthy()
      // WS 推送 task-cancelled
      expect(mockPushNotification).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          type: 'task-cancelled',
          taskId,
          deviceId: 'api',
        }),
      )
    })

    it('cancel body 为空也允许(可空 body)', async () => {
      const disp = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'ls' },
      })
      const taskId = disp.json().data.task.id
      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${taskId}/cancel`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.task.status).toBe('cancelled')
    })

    it('cancel 携带 reason 字段正常处理', async () => {
      const disp = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'ls' },
      })
      const taskId = disp.json().data.task.id
      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${taskId}/cancel`,
        payload: { reason: '用户主动取消' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.task.status).toBe('cancelled')
    })

    it('取消 running 任务成功', async () => {
      const disp = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'ls' },
      })
      const taskId = disp.json().data.task.id
      // 模拟 desktop 回传 running 状态
      await app.inject({
        method: 'POST',
        url: '/api/tasks/result',
        payload: { taskId, status: 'running' },
      })
      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${taskId}/cancel`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.task.status).toBe('cancelled')
    })

    it('取消已 completed 任务返回 409', async () => {
      const disp = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'ls' },
      })
      const taskId = disp.json().data.task.id
      await app.inject({
        method: 'POST',
        url: '/api/tasks/result',
        payload: { taskId, status: 'completed', output: 'done' },
      })
      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${taskId}/cancel`,
      })
      expect(res.statusCode).toBe(409)
      expect(res.json().code).toBe(409)
    })

    it('取消已 cancelled 任务返回 409(幂等性拒绝)', async () => {
      const disp = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'ls' },
      })
      const taskId = disp.json().data.task.id
      await app.inject({
        method: 'POST',
        url: `/api/tasks/${taskId}/cancel`,
      })
      // 再次取消应 409
      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${taskId}/cancel`,
      })
      expect(res.statusCode).toBe(409)
      expect(res.json().code).toBe(409)
    })

    it('取消 failed 任务返回 409', async () => {
      const disp = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'ls' },
      })
      const taskId = disp.json().data.task.id
      await app.inject({
        method: 'POST',
        url: '/api/tasks/result',
        payload: { taskId, status: 'failed', error: 'boom' },
      })
      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${taskId}/cancel`,
      })
      expect(res.statusCode).toBe(409)
    })

    it('任务不存在返回 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks/no-such-task/cancel',
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().code).toBe(404)
    })

    it('reason 超长返回 400', async () => {
      const disp = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'ls' },
      })
      const taskId = disp.json().data.task.id
      const res = await app.inject({
        method: 'POST',
        url: `/api/tasks/${taskId}/cancel`,
        payload: { reason: 'x'.repeat(1_001) },
      })
      expect(res.statusCode).toBe(400)
    })

    it('cancel 后 GET /tasks 反映 cancelled 状态', async () => {
      const disp = await app.inject({
        method: 'POST',
        url: '/api/tasks/dispatch',
        payload: { toDevice: 'd1', command: 'ls' },
      })
      const taskId = disp.json().data.task.id
      await app.inject({
        method: 'POST',
        url: `/api/tasks/${taskId}/cancel`,
      })
      const list = await app.inject({ method: 'GET', url: '/api/tasks' })
      const found = list.json().data.tasks.find((t: { id: string }) => t.id === taskId)
      expect(found.status).toBe('cancelled')
    })
  })

  // ===================== POST /tasks/register-device =====================
  describe('POST /api/tasks/register-device', () => {
    it('注册设备并返回 device', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks/register-device',
        payload: { deviceId: 'dev-1', name: '我的桌面', type: 'desktop' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.device).toMatchObject({
        deviceId: 'dev-1',
        name: '我的桌面',
        type: 'desktop',
        online: true,
      })
      expect(body.data.device.lastSeen).toBeTruthy()
    })

    it('缺少 type 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks/register-device',
        payload: { deviceId: 'dev-1', name: '桌面' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('非法 type 枚举返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks/register-device',
        payload: { deviceId: 'dev-1', name: '桌面', type: 'watch' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ===================== DELETE /tasks/devices/:deviceId =====================
  describe('DELETE /api/tasks/devices/:deviceId', () => {
    it('删除已注册设备返回 removed=true', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/tasks/register-device',
        payload: { deviceId: 'dev-1', name: '桌面', type: 'desktop' },
      })
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/tasks/devices/dev-1',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.removed).toBe(true)
      // 删除后设备列表为空
      const list = await app.inject({ method: 'GET', url: '/api/tasks/devices' })
      expect(list.json().data.total).toBe(0)
    })

    it('删除不存在设备仍返回 removed=true(幂等)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/tasks/devices/never-existed',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.removed).toBe(true)
    })
  })

  // ===================== GET /tasks/devices =====================
  describe('GET /api/tasks/devices', () => {
    it('注册前返回空列表', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tasks/devices' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.total).toBe(0)
      expect(body.data.devices).toHaveLength(0)
    })

    it('注册后返回设备列表且 online=true', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/tasks/register-device',
        payload: { deviceId: 'dev-1', name: '桌面', type: 'desktop' },
      })
      const res = await app.inject({ method: 'GET', url: '/api/tasks/devices' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.total).toBe(1)
      expect(body.data.devices[0].deviceId).toBe('dev-1')
      expect(body.data.devices[0].online).toBe(true)
    })
  })
})
