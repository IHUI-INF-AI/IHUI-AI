// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-159(P3,越权改删域):`/api/drama` 的 PUT / DELETE / batch-delete 此前只校验
 * 记录存在性与状态机,没有属主判断 —— 任意登录用户都能改、删他人剧本(含草稿)。
 *
 * 属主字段复用创建入口已写入的 `createdBy`(POST /drama 经 withAuditBoth 注入
 * `request.userId`),不新造字段。历史记录 `createdBy === null` 时仅管理员可操作。
 *
 * 本文件钉住:
 *  ① 未登录 → 401(鉴权由 other/index.ts 插件级 preHandler 提供,这里按同拓扑复刻);
 *  ② B 改 A 的记录 → 403 且 store 内容不变;
 *  ③ B 删 A 的记录 → 403 且记录仍在;
 *  ④ B 批量删含 A 的 id → 403 且整批零删除(连 B 自己的 id 也不删);
 *  ⑤ A 本人 PUT/DELETE → 成功;
 *  ⑥ 管理员 PUT/DELETE 他人 → 成功;
 *  ⑦ 历史无 createdBy 记录:普通用户 403、管理员可操作;
 *  ⑧ 不存在 id → 404 不退化(批量删仍按 skipped 汇报)。
 *
 * 隔离:dramaStore 是模块级 Map,故每个用例都新建独立 id/标题;历史无主记录由
 * 一个不带鉴权 hook 的裸实例写入(模拟字段缺失前落库的旧数据),同一模块实例共享 store。
 * db / auth / require-permission 全部桩掉,零数据库、零网络。
 */
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/plugins/auth.js', () => {
  interface MockRequest {
    headers: Record<string, string | string[] | undefined>
    userId?: string
    jwtPayload?: { userId?: string; roleId?: number }
  }
  const authenticate = async (request: MockRequest): Promise<void> => {
    const role = request.headers['x-test-role']
    if (role === undefined) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = String(request.headers['x-test-user'] ?? '')
    request.jwtPayload = { userId: request.userId, roleId: Number(role) }
  }
  return { authenticate, requireActiveUser: async () => undefined, default: vi.fn() }
})

vi.mock('../src/plugins/require-permission.js', () => ({
  // 与真实 isSystemAdmin 同语义:只认人用 JWT 的 roleId >= 1。
  isSystemAdmin: (request: { jwtPayload?: { roleId?: number } }) =>
    (request.jwtPayload?.roleId ?? 0) >= 1,
}))

vi.mock('@ihui/database', () => ({
  users: { id: 'users.id', nickname: 'users.nickname', avatar: 'users.avatar' },
}))

vi.mock('../src/db/index.js', () => ({
  dbRead: {
    select: () => ({
      from: () => ({
        where: async () => [],
      }),
    }),
  },
  db: {},
  dbClient: {},
}))

import { authenticate } from '../src/plugins/auth.js'
import { dramaRoutes } from '../src/routes/other/drama-routes.js'

const PREFIX = '/api'
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER_ADMIN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function asUser(userId: string, roleId = 0): Record<string, string> {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

/** 复刻 other/index.ts:46-53 的插件级 authenticate —— 被测插件本体不自带该 hook。 */
async function buildAuthedApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  const withAuth = async (server: FastifyInstance): Promise<void> => {
    server.addHook('preHandler', async (request, reply) => {
      try {
        await authenticate(request)
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        return reply.status(statusCode).send({ code: statusCode, message: '操作失败,请稍后重试' })
      }
    })
    await server.register(dramaRoutes)
  }
  await app.register(withAuth, { prefix: PREFIX })
  await app.ready()
  return app
}

/** 不带鉴权 hook:用于写入 `createdBy === null` 的历史记录(真实历史数据形态)。 */
async function buildBareApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(dramaRoutes, { prefix: PREFIX })
  await app.ready()
  return app
}

let app: FastifyInstance
let bare: FastifyInstance

beforeAll(async () => {
  app = await buildAuthedApp()
  bare = await buildBareApp()
})

afterAll(async () => {
  await app.close()
  await bare.close()
})

let titleSeq = 0
/** 全局标题唯一性校验会跨用例(以及 vitest retry 重跑)残留,故每条标题带自增后缀。 */
function uniqueTitle(base: string): string {
  titleSeq += 1
  return `${base}-${titleSeq}`
}

async function createDrama(userId: string, title: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: `${PREFIX}/drama`,
    headers: asUser(userId),
    payload: { title },
  })
  expect(res.statusCode).toBe(201)
  return (res.json() as { data: { id: string } }).data.id
}

async function getDrama(id: string, userId = USER_A) {
  return app.inject({ method: 'GET', url: `${PREFIX}/drama/${id}`, headers: asUser(userId) })
}

describe('F-159 /api/drama 属主闸', () => {
  it('① 未登录 PUT/DELETE/POST → 401', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/drama/drama_not_exist`,
      payload: { title: 'x' },
    })
    expect(put.statusCode).toBe(401)

    const del = await app.inject({ method: 'DELETE', url: `${PREFIX}/drama/drama_not_exist` })
    expect(del.statusCode).toBe(401)

    const create = await app.inject({
      method: 'POST',
      url: `${PREFIX}/drama`,
      payload: { title: 'F159-未登录不可创建' },
    })
    expect(create.statusCode).toBe(401)
  })

  it('② 用户 B 改 A 的记录 → 403 且内容不变', async () => {
    const title = uniqueTitle('F159-A私有剧本')
    const id = await createDrama(USER_A, title)
    const res = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/drama/${id}`,
      headers: asUser(USER_B),
      payload: { title: 'F159-被B篡改', status: 'published' },
    })
    expect(res.statusCode).toBe(403)
    expect((res.json() as { code: number }).code).toBe(403)

    const detail = await getDrama(id)
    expect(detail.statusCode).toBe(200)
    const data = (detail.json() as { data: { title: string; status: string; createdBy: string | null } })
      .data
    expect(data.title).toBe(title)
    expect(data.status).toBe('draft')
    expect(data.createdBy).toBe(USER_A)
  })

  it('③ 用户 B 删 A 的记录 → 403 且记录仍在', async () => {
    const title = uniqueTitle('F159-A不可被删')
    const id = await createDrama(USER_A, title)
    const res = await app.inject({
      method: 'DELETE',
      url: `${PREFIX}/drama/${id}`,
      headers: asUser(USER_B),
    })
    expect(res.statusCode).toBe(403)

    const detail = await getDrama(id)
    expect(detail.statusCode).toBe(200)
    expect((detail.json() as { data: { title: string } }).data.title).toBe(title)
  })

  it('④ B 批量删含 A 的 id → 403 且整批零删除(B 自己的 id 也不删)', async () => {
    const titleA = uniqueTitle('F159-批量A')
    const titleB = uniqueTitle('F159-批量B')
    const idA = await createDrama(USER_A, titleA)
    const idB = await createDrama(USER_B, titleB)

    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/drama/batch-delete`,
      headers: asUser(USER_B),
      payload: { ids: [idA, idB] },
    })
    expect(res.statusCode).toBe(403)
    expect((res.json() as { code: number }).code).toBe(403)

    // "整批拒绝"而非"逐条跳过":两条都必须还在。
    for (const [id, title] of [
      [idA, titleA],
      [idB, titleB],
    ] as const) {
      const detail = await getDrama(id, USER_B)
      expect(detail.statusCode).toBe(200)
      expect((detail.json() as { data: { title: string } }).data.title).toBe(title)
    }
  })

  it('⑤ 属主本人 PUT/DELETE → 成功', async () => {
    const id = await createDrama(USER_A, uniqueTitle('F159-属主自改'))

    const put = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/drama/${id}`,
      headers: asUser(USER_A),
      payload: { title: 'F159-属主已改', status: 'published' },
    })
    expect(put.statusCode).toBe(200)
    expect((put.json() as { data: { updated: boolean } }).data.updated).toBe(true)

    const afterPut = await getDrama(id)
    expect((afterPut.json() as { data: { title: string; status: string; updatedBy: string | null } }).data)
      .toMatchObject({ title: 'F159-属主已改', status: 'published', updatedBy: USER_A })

    const del = await app.inject({
      method: 'DELETE',
      url: `${PREFIX}/drama/${id}`,
      headers: asUser(USER_A),
    })
    expect(del.statusCode).toBe(200)
    expect((del.json() as { data: { deleted: boolean } }).data.deleted).toBe(true)

    const afterDel = await getDrama(id)
    expect(afterDel.statusCode).toBe(404)
  })

  it('⑥ 管理员 PUT/DELETE 他人记录 → 成功', async () => {
    const id = await createDrama(USER_A, uniqueTitle('F159-管理员可管'))

    const put = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/drama/${id}`,
      headers: asUser(USER_ADMIN, 1),
      payload: { title: 'F159-管理员已改' },
    })
    expect(put.statusCode).toBe(200)

    const del = await app.inject({
      method: 'DELETE',
      url: `${PREFIX}/drama/${id}`,
      headers: asUser(USER_ADMIN, 1),
    })
    expect(del.statusCode).toBe(200)

    const afterDel = await getDrama(id)
    expect(afterDel.statusCode).toBe(404)
  })

  it('⑦ 历史无 createdBy 记录:普通用户 403,管理员可操作', async () => {
    const title = uniqueTitle('F159-历史无主记录')
    const seed = await bare.inject({
      method: 'POST',
      url: `${PREFIX}/drama`,
      payload: { title },
    })
    expect(seed.statusCode).toBe(201)
    const id = (seed.json() as { data: { id: string } }).data.id

    // 确认确实是历史形态:createdBy 为空
    const seededDetail = await getDrama(id)
    expect((seededDetail.json() as { data: { createdBy: string | null } }).data.createdBy).toBeNull()

    const putByUser = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/drama/${id}`,
      headers: asUser(USER_A),
      payload: { title: 'F159-普通用户勿动' },
    })
    expect(putByUser.statusCode).toBe(403)

    const delByUser = await app.inject({
      method: 'DELETE',
      url: `${PREFIX}/drama/${id}`,
      headers: asUser(USER_A),
    })
    expect(delByUser.statusCode).toBe(403)

    const still = await getDrama(id)
    expect(still.statusCode).toBe(200)
    expect((still.json() as { data: { title: string } }).data.title).toBe(title)

    const putByAdmin = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/drama/${id}`,
      headers: asUser(USER_ADMIN, 1),
      payload: { title: 'F159-管理员接管历史' },
    })
    expect(putByAdmin.statusCode).toBe(200)

    const delByAdmin = await app.inject({
      method: 'DELETE',
      url: `${PREFIX}/drama/${id}`,
      headers: asUser(USER_ADMIN, 1),
    })
    expect(delByAdmin.statusCode).toBe(200)
  })

  it('⑧ 不存在 id → 404 不退化(批量删仍 skipped)', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/drama/drama_not_exist`,
      headers: asUser(USER_A),
      payload: { title: 'x' },
    })
    expect(put.statusCode).toBe(404)

    const del = await app.inject({
      method: 'DELETE',
      url: `${PREFIX}/drama/drama_not_exist`,
      headers: asUser(USER_A),
    })
    expect(del.statusCode).toBe(404)

    // 管理员对不存在 id 也应是 404(先查存在性再判归属)。
    const putAdmin = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/drama/drama_not_exist`,
      headers: asUser(USER_ADMIN, 1),
      payload: { title: 'x' },
    })
    expect(putAdmin.statusCode).toBe(404)

    const batch = await app.inject({
      method: 'POST',
      url: `${PREFIX}/drama/batch-delete`,
      headers: asUser(USER_A),
      payload: { ids: ['drama_not_exist'] },
    })
    expect(batch.statusCode).toBe(200)
    expect((batch.json() as { data: { deleted: number; skipped: unknown[] } }).data).toMatchObject({
      deleted: 0,
      skipped: [{ id: 'drama_not_exist', reason: '不存在' }],
    })
  })
})
