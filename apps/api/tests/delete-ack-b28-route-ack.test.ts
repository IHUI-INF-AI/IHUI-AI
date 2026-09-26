// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 第二十八批(泳道 2/5)路由侧:换键名的布尔写 ack 必须由**存储侧答复**派生。
//
// 钉的两个站点(改前都写死 `true`,与"这次写命中 0 行"完全同形):
//  - `POST /api/workspace/files/:id/restore` → `restored: true`
//    前面的存在性 / 归属 / "在回收站里" 三道闸只防住"根本没执行写",防不住
//    "UPDATE 命中 0 行"(并发永久删除即此) ⇒ ack 改由 restoreFile 回报的集合派生。
//  - `DELETE /api/tasks/devices/:deviceId` → `removed: true`
//    这里的唯一状态源是 Redis HDEL(其回复本身就是删除计数),降级档是进程内 Map#delete()
//    (真布尔) —— 旧实现把答复丢掉,谁下线都回 true。
//
// 两件事刻意保持不变,免得测试替改动背书:
//  - 响应键名与状态码逐字不变(逐条断言 `Object.keys(body.data)`),本票不新增任何键;
//  - 鉴权前置只把身份喂进 request(checkAuth/authenticate 注 userId),闸门本身走真实现。
//
// 委托函数被 mock ⇒ 这里判的是"路由有没有真去消费存储侧答复";
// "答复本身是否来自 RETURNING"由 delete-ack-b28-restore-returning.test.ts 量。

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const ROW_ID = '11111111-1111-4111-8111-111111111111'
const PROJECT_ID = '22222222-2222-4222-8222-222222222222'
const DEVICE_ID = 'desktop-win-01'

const { ov, mockAuthenticate, mockCheckAuth } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockCheckAuth: vi.fn(),
  // 只覆写这两个端点用到的出口;其余用 importOriginal 原样带过 ——
  // 手抄整张清单必然腐烂(路由后续新增一个 import 就会抛 "No X export is defined on the mock")。
  ov: {
    findProjectById: vi.fn(),
    findFileByIdIncludeTrashed: vi.fn(),
    restoreFile: vi.fn(),
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  checkAuth: (...args: unknown[]) => mockCheckAuth(...args),
  requireActiveUser: vi.fn(),
}))

vi.mock('../src/db/workspace-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...ov }
})

import { workspaceRoutes } from '../src/routes/workspace.js'
import { tasksRoutes } from '../src/routes/tasks.js'

/**
 * 与真 ioredis 同形的最小 fake:`hdel` 的回复就是"真正删掉的 field 数"。
 * 队列交出的是被处理的那一个(空 = 没删掉),而不是 undefined —— 旧夹具喂 undefined
 * 恰好等于替"removed: true"打掩护(常量永远对,因为它不读物体)。
 */
function makeRedis(opts: { hdel?: number; throws?: boolean } = {}) {
  const store = new Map<string, Map<string, string>>()
  const ensure = (k: string) => {
    let inner = store.get(k)
    if (!inner) {
      inner = new Map<string, string>()
      store.set(k, inner)
    }
    return inner
  }
  const boom = () => {
    throw new Error('redis unavailable(降级档)')
  }
  return {
    get: async () => null,
    set: async () => 'OK',
    hgetall: async (k: string) => Object.fromEntries(ensure(k)),
    hset: async (k: string, field: string, value: string) => {
      if (opts.throws) boom()
      ensure(k).set(field, value)
      return 1
    },
    expire: async () => 1,
    publish: async () => 0,
    hdel: async (k: string, ...fields: string[]) => {
      if (opts.throws) boom()
      // opts.hdel 未给 ⇒ 按真实语义自己算(删得着给 1,删不着给 0)
      const inner = store.get(k)
      let n = 0
      for (const f of fields) if (inner?.delete(f)) n += 1
      return opts.hdel ?? n
    },
  }
}

describe('换键名的布尔写 ack:必须由存储侧答复派生', () => {
  let workspaceApp: FastifyInstance

  beforeAll(async () => {
    workspaceApp = Fastify({ logger: false })
    await workspaceApp.register(workspaceRoutes, { prefix: '/api/workspace' })
    await workspaceApp.ready()
  })

  afterAll(async () => {
    await workspaceApp.close()
  })

  beforeEach(() => {
    for (const m of Object.values(ov)) m.mockReset()
    mockAuthenticate.mockReset()
    mockCheckAuth.mockReset()
    const inject = (request: { userId?: string; jwtPayload?: Record<string, unknown> }) => {
      request.userId = USER_ID
      request.jwtPayload = { userId: USER_ID, roleId: 1 }
    }
    mockAuthenticate.mockImplementation(async (request: Parameters<typeof inject>[0]) => {
      inject(request)
    })
    mockCheckAuth.mockImplementation(async (request: Parameters<typeof inject>[0]) => {
      inject(request)
      return true
    })
  })

  describe('POST /api/workspace/files/:id/restore → restoreFile', () => {
    /** 三道前置闸本票逐字保留,必须让它们放行到写那一步。 */
    const passGates = () => {
      ov.findFileByIdIncludeTrashed.mockResolvedValue({
        id: ROW_ID,
        projectId: PROJECT_ID,
        deletedAt: new Date('2026-09-27T00:00:00.000Z'),
      })
      ov.findProjectById.mockResolvedValue({ id: PROJECT_ID, userId: USER_ID })
    }

    it('委托回报命中集合非空 → 200 + restored:true,键集逐字不变', async () => {
      passGates()
      ov.restoreFile.mockResolvedValue([ROW_ID])
      const res = await workspaceApp.inject({
        method: 'POST',
        url: `/api/workspace/files/${ROW_ID}/restore`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.restored).toBe(true)
      expect(Object.keys(res.json().data)).toEqual(['restored'])
    })

    it('委托回报空集合(UPDATE 命中 0 行)→ 200 + restored:false —— 旧实现到这里仍回 true', async () => {
      passGates()
      ov.restoreFile.mockResolvedValue([])
      const res = await workspaceApp.inject({
        method: 'POST',
        url: `/api/workspace/files/${ROW_ID}/restore`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.restored).toBe(false)
      expect(Object.keys(res.json().data)).toEqual(['restored'])
    })
  })

  describe('DELETE /api/tasks/devices/:deviceId → Redis HDEL 的删除计数', () => {
    it('HDEL 回复 1(真删掉一个)→ 200 + removed:true,键集逐字不变', async () => {
      const app = Fastify({ logger: false })
      app.decorate('redis', makeRedis())
      await app.register(tasksRoutes, { prefix: '/api' })
      await app.ready()
      try {
        const register = await app.inject({
          method: 'POST',
          url: '/api/tasks/register-device',
          payload: { deviceId: DEVICE_ID, name: 'dev', type: 'desktop' },
        })
        expect(register.statusCode).toBe(201)

        const res = await app.inject({
          method: 'DELETE',
          url: `/api/tasks/devices/${DEVICE_ID}`,
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.removed).toBe(true)
        expect(Object.keys(res.json().data)).toEqual(['removed'])
      } finally {
        await app.close()
      }
    })

    it('HDEL 回复 0(设备根本不在表里)→ 200 + removed:false —— 旧实现到这里仍回 true', async () => {
      const app = Fastify({ logger: false })
      app.decorate('redis', makeRedis({ hdel: 0 }))
      await app.register(tasksRoutes, { prefix: '/api' })
      await app.ready()
      try {
        const res = await app.inject({
          method: 'DELETE',
          url: `/api/tasks/devices/${DEVICE_ID}`,
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.removed).toBe(false)
        expect(Object.keys(res.json().data)).toEqual(['removed'])
      } finally {
        await app.close()
      }
    })

    it('降级档:进程内 Map 的 delete() 答复同样被消费(命中→true,再删同一台→false)', async () => {
      const app = Fastify({ logger: false })
      // throws ⇒ 注册与删除都落进进程内 Map 降级存储(唯一状态源换人,答复仍是真布尔)
      app.decorate('redis', makeRedis({ throws: true }))
      await app.register(tasksRoutes, { prefix: '/api' })
      await app.ready()
      try {
        const register = await app.inject({
          method: 'POST',
          url: '/api/tasks/register-device',
          payload: { deviceId: DEVICE_ID, name: 'dev', type: 'desktop' },
        })
        expect(register.statusCode).toBe(201)

        const first = await app.inject({ method: 'DELETE', url: `/api/tasks/devices/${DEVICE_ID}` })
        expect(first.statusCode).toBe(200)
        expect(first.json().data.removed).toBe(true)

        const again = await app.inject({ method: 'DELETE', url: `/api/tasks/devices/${DEVICE_ID}` })
        expect(again.statusCode).toBe(200)
        expect(again.json().data.removed).toBe(false)
      } finally {
        await app.close()
      }
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
