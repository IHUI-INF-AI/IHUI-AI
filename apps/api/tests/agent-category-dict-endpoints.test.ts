// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1058623③ 公开双键分类字典端点的离线契约回归(不连库)。
 *
 * 立因:api-client getAgentCategories() 调 GET /api/cache/agent-category-dict/categories,
 * 此前后端零命中,4 个 RN 调用方(HomeScreen/PlazaScreen/AgentScreen/AiAssistantScreen)
 * 全靠静态 fallback 降级。机主拍板新建公开 {agentCategory, agentMainCategory} 双键端点。
 *
 * 本文件钉四件事:
 * ① 未登录(无任何凭据)必须 200 —— 这是"公开"的机器证据(404→200 翻转);
 * ② 响应形状与 packages/api-client/src/endpoints/agent.ts 的 AgentCategories 逐一对齐
 *    (data 键集合恰为双键,每项恰为 {id,name}—— RN 四屏就读这两个键,缺一个就静默回退);
 * ③ field2 源端语义('0'=种类→agentMainCategory,'1'=赛道→agentCategory)不得漂移;
 * ④ admin 面(agent-categories-cache.ts)行为零改动 —— 非 admin 仍 401,公开端只读。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { adminState } = vi.hoisted(() => ({ adminState: { isAdmin: false } }))

// 与真实 requireAdmin 的对外契约同形:preHandler 钩子,非 admin 抛 statusCode=401
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => {
    if (!adminState.isAdmin) {
      throw Object.assign(new Error('需要管理员权限'), { statusCode: 401 })
    }
  },
}))

async function buildApp(): Promise<FastifyInstance> {
  const { agentCategoriesCacheRoutes } = await import('../src/routes/agent-categories-cache.js')
  const { agentCategoryDictRoutes } = await import('../src/routes/agent-category-dict.js')
  const app = Fastify()
  // 两者都是绝对路径字面量注册(与 routes/index.ts 的 server.register(x) 无 prefix 同形)
  void app.register(agentCategoriesCacheRoutes)
  void app.register(agentCategoryDictRoutes)
  await app.ready()
  return app
}

/** admin 通道灌数据:走既有 sync 端点(公开端点没有也不该有写入口)。
 *  注:该端点既有 schema 把 value 判为 nonoptional(z.unknown() 在仓内 zod 下非可选),种子必须带 value。 */
async function seed(
  app: FastifyInstance,
  upsert: Array<{ key: string; value?: unknown; field2?: string; name?: string; sort?: number }>,
): Promise<void> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/agent-categories/cache/sync',
    payload: { upsert: upsert.map((e) => ({ value: null, ...e })), deleteKeys: [] },
  })
  expect(res.statusCode).toBe(200)
}

describe('GET /api/cache/agent-category-dict/categories(公开双键分类字典)', () => {
  beforeEach(async () => {
    adminState.isAdmin = true
    const app = await buildApp()
    // 模块级单例 store,用例间清场(走既有 DELETE 端点,不触碰内部实现)
    const res = await app.inject({ method: 'DELETE', url: '/api/agent-categories/cache' })
    expect(res.statusCode).toBe(200)
    adminState.isAdmin = false
  })

  it('未登录(无任何凭据)⇒ 200 + code:0 —— "公开"的机器证据', async () => {
    const app = await buildApp()
    adminState.isAdmin = true
    await seed(app, [
      { key: 'tech', field2: '1', name: '技术' },
      { key: 'writing', field2: '0', name: '写作' },
    ])
    adminState.isAdmin = false
    const res = await app.inject({
      method: 'GET',
      url: '/api/cache/agent-category-dict/categories',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // 本仓统一信封的成功码是 code: 0(见 apps/api/src/utils/response.ts:22)
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
  })

  it('data 形状与 api-client AgentCategories 契约逐一对齐(双键齐全,每项恰为 {id,name})', async () => {
    const app = await buildApp()
    adminState.isAdmin = true
    await seed(app, [
      { key: 'tech', field2: '1', name: '技术' },
      { key: 'writing', field2: '0', name: '写作' },
    ])
    adminState.isAdmin = false
    const res = await app.inject({
      method: 'GET',
      url: '/api/cache/agent-category-dict/categories',
    })
    const body = res.json()
    // RN 四屏只读 data.agentCategory / data.agentMainCategory,多键少键都是契约漂移
    expect(Object.keys(body.data).sort()).toEqual(['agentCategory', 'agentMainCategory'])
    for (const group of [body.data.agentCategory, body.data.agentMainCategory]) {
      expect(Array.isArray(group)).toBe(true)
      for (const item of group) {
        expect(Object.keys(item).sort()).toEqual(['id', 'name'])
        expect(typeof item.id).toBe('string')
        expect(typeof item.name).toBe('string')
      }
    }
  })

  it("field2 语义:'1'→agentCategory(赛道) '0'→agentMainCategory(主分类),无 field2 不落组;排序 sort 升序", async () => {
    const app = await buildApp()
    adminState.isAdmin = true
    await seed(app, [
      { key: 'tech', field2: '1', name: '技术', sort: 2 },
      { key: 'design', field2: '1', name: '设计', sort: 1 },
      { key: 'writing', field2: '0', name: '写作', sort: 2 },
      { key: 'coding', field2: '0', name: '编程', sort: 1 },
      { key: 'odd' }, // 无 field2:无法诚实归类,两组都不得出现
    ])
    adminState.isAdmin = false
    const res = await app.inject({
      method: 'GET',
      url: '/api/cache/agent-category-dict/categories',
    })
    expect(res.json().data).toEqual({
      agentCategory: [
        { id: 'design', name: '设计' },
        { id: 'tech', name: '技术' },
      ],
      agentMainCategory: [
        { id: 'coding', name: '编程' },
        { id: 'writing', name: '写作' },
      ],
    })
  })

  it('name 缺省回退 key(不产生 undefined 塞进 JSON)', async () => {
    const app = await buildApp()
    adminState.isAdmin = true
    await seed(app, [{ key: 'market', field2: '1' }])
    adminState.isAdmin = false
    const res = await app.inject({
      method: 'GET',
      url: '/api/cache/agent-category-dict/categories',
    })
    expect(res.json().data.agentCategory).toEqual([{ id: 'market', name: 'market' }])
  })

  it('空缓存 ⇒ 200 + 两组空数组(不 500 不 fail,RN 侧自行回退静态 fallback)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/cache/agent-category-dict/categories',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ agentCategory: [], agentMainCategory: [] })
  })

  it('admin 面零改动:非 admin 调 sync 仍 401;公开路径只读(POST/DELETE ⇒ 404)', async () => {
    const app = await buildApp()
    const deny = await app.inject({
      method: 'POST',
      url: '/api/agent-categories/cache/sync',
      payload: { upsert: [{ key: 'x' }], deleteKeys: [] },
    })
    expect(deny.statusCode).toBe(401)

    const post = await app.inject({
      method: 'POST',
      url: '/api/cache/agent-category-dict/categories',
    })
    expect(post.statusCode).toBe(404)
    const del = await app.inject({
      method: 'DELETE',
      url: '/api/cache/agent-category-dict/categories',
    })
    expect(del.statusCode).toBe(404)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
