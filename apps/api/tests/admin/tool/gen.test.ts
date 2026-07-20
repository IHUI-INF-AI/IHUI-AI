/**
 * /api/admin/tool/gen 路由 + 代码生成器服务单元测试。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../../../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { roleId?: number }) => {
    if (!request.roleId || request.roleId < 1) {
      const err = new Error('admin required') as Error & { statusCode?: number }
      err.statusCode = 401
      throw err
    }
  },
}))

import genRoutes from '../../../src/routes/admin/tool/gen.js'
import genPostRoutes from '../../../src/routes/admin/tool/gen-post.js'
import { generate, describeTypes, GEN_TYPES } from '../../../src/services/code-generator.js'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.decorateRequest('roleId', undefined)
  app.addHook('preHandler', async (request) => {
    const header = request.headers['x-test-role']
    if (typeof header === 'string' && header) {
      ;(request as { roleId?: number }).roleId = Number.parseInt(header, 10)
    }
  })
  await app.register(genRoutes, { prefix: '/api/admin' })
  await app.register(genPostRoutes, { prefix: '/api/admin' })
  await app.ready()
  return app
}

describe('code-generator service', () => {
  it('describeTypes returns 4 entries with type/label/defaultFields', () => {
    const list = describeTypes()
    expect(list).toHaveLength(4)
    for (const m of list) {
      expect(m).toHaveProperty('type')
      expect(m).toHaveProperty('label')
      expect(m).toHaveProperty('description')
      expect(m).toHaveProperty('fieldTypes')
      expect(m).toHaveProperty('defaultFields')
      expect(m.defaultFields.length).toBeGreaterThan(0)
    }
  })

  it('GEN_TYPES matches the four types', () => {
    expect(GEN_TYPES).toEqual(['list', 'page', 'detail', 'dialog'])
  })

  it('generate list:输出含 Table 标签 + 默认字段名', () => {
    const r = generate({
      type: 'list',
      name: 'user',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'email', type: 'string', label: '邮箱' },
      ],
    })
    expect(r.type).toBe('list')
    expect(r.moduleName).toBe('user')
    expect(r.files).toHaveLength(1)
    expect(r.files[0]?.path).toContain('user')
    expect(r.files[0]?.content).toContain('User')
    expect(r.files[0]?.content).toContain('Table')
    expect(r.files[0]?.content).toContain('email')
    expect(r.files[0]?.content).toContain('邮箱')
  })

  it('generate page:输出含 Dialog 组件 + 增删改按钮', () => {
    const r = generate({
      type: 'page',
      name: 'order',
      fields: [{ name: 'total', type: 'number' }],
    })
    expect(r.type).toBe('page')
    expect(r.files[0]?.content).toContain('Dialog')
    expect(r.files[0]?.content).toContain('onAdd')
    expect(r.files[0]?.content).toContain('onEdit')
    expect(r.files[0]?.content).toContain('onDelete')
  })

  it('generate detail:输出只读字段展示', () => {
    const r = generate({
      type: 'detail',
      name: 'product',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'price', type: 'number' },
      ],
    })
    expect(r.type).toBe('detail')
    expect(r.files[0]?.content).toContain('Product 详情')
    expect(r.files[0]?.content).toContain('id')
    expect(r.files[0]?.content).toContain('price')
  })

  it('generate dialog:额外生成 form-schemas 下的 Zod schema', () => {
    const r = generate({
      type: 'dialog',
      name: 'tag',
      fields: [{ name: 'name', type: 'string', required: true }],
    })
    expect(r.files).toHaveLength(2)
    const formSchemaFile = r.files.find((f) => f.path.includes('form-schemas'))
    expect(formSchemaFile).toBeDefined()
    expect(formSchemaFile?.content).toContain('z.object')
    expect(formSchemaFile?.content).toContain('name')
  })

  it('generate combined:包含所有文件 + 路径分隔', () => {
    const r = generate({
      type: 'list',
      name: 'role',
      fields: [{ name: 'id', type: 'string' }],
    })
    expect(r.combined).toContain('// ===')
    expect(r.combined).toContain('Role')
  })

  it('generate throws on unsupported type', () => {
    expect(() =>
      generate({ type: 'foo' as 'list', name: 'x', fields: [{ name: 'a', type: 'string' }] }),
    ).toThrow()
  })

  it('generate 多种字段类型:string/number/boolean/date', () => {
    const r = generate({
      type: 'page',
      name: 'mix',
      fields: [
        { name: 's', type: 'string' },
        { name: 'n', type: 'number' },
        { name: 'b', type: 'boolean' },
        { name: 'd', type: 'date' },
      ],
    })
    const c = r.files[0]?.content ?? ''
    expect(c).toContain('s: string')
    expect(c).toContain('n: number')
    expect(c).toContain('b: boolean')
    expect(c).toContain('d: string')
  })
})

describe('/api/admin/tool/gen', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET 401 without admin', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/tool/gen' })
    expect(res.statusCode).toBe(401)
  })

  it('GET returns types metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.types).toHaveLength(4)
    expect(body.data.typeNames).toEqual(['list', 'page', 'detail', 'dialog'])
  })

  it('POST 401 without admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      payload: { type: 'list', name: 'x', fields: [{ name: 'a', type: 'string' }] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST list template with admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
      payload: {
        type: 'list',
        name: 'user',
        fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }],
      },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.files).toHaveLength(1)
    expect(body.data.combined).toContain('User')
  })

  it('POST page template with admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
      payload: {
        type: 'page',
        name: 'order',
        fields: [{ name: 'total', type: 'number' }],
      },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.files[0].content).toContain('Dialog')
  })

  it('POST detail template with admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
      payload: {
        type: 'detail',
        name: 'product',
        fields: [{ name: 'id', type: 'string' }],
      },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.files[0].content).toContain('Product 详情')
  })

  it('POST dialog template with admin:额外生成 zod schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
      payload: {
        type: 'dialog',
        name: 'tag',
        fields: [{ name: 'name', type: 'string', required: true }],
      },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.files).toHaveLength(2)
    expect(body.data.files.some((f: { path: string }) => f.path.includes('form-schemas'))).toBe(true)
  })

  it('POST 400 missing type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
      payload: { name: 'x', fields: [{ name: 'a', type: 'string' }] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST 400 missing name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
      payload: { type: 'list', fields: [{ name: 'a', type: 'string' }] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST 400 missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
      payload: { type: 'list', name: 'x' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST 400 fields with invalid name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
      payload: { type: 'list', name: 'x', fields: [{ name: '1bad', type: 'string' }] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST 400 fields with invalid type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
      payload: { type: 'list', name: 'x', fields: [{ name: 'a', type: 'unknown' }] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST 400 invalid type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
      payload: { type: 'foo', name: 'x', fields: [{ name: 'a', type: 'string' }] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST 400 name with special chars', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
      payload: { type: 'list', name: '1bad', fields: [{ name: 'a', type: 'string' }] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST with options respected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/tool/gen',
      headers: { 'x-test-role': '1' },
      payload: {
        type: 'list',
        name: 'thing',
        fields: [{ name: 'id', type: 'string' }],
        options: { withSearch: false, withPagination: false },
      },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.files[0].content).not.toContain('搜索')
  })
})
