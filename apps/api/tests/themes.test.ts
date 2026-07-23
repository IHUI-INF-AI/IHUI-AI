import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const {
  mockAuthenticate,
  mockSelectResult,
  mockInsertReturning,
  mockUpdateReturning,
  mockDeleteReturning,
  mockTransaction,
  mockTxUpdate,
  mockTxInsert,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
  mockInsertReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
  mockUpdateReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
  mockDeleteReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
  mockTransaction: vi.fn(),
  mockTxUpdate: vi.fn(),
  mockTxInsert: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: vi.fn().mockResolvedValue(false),
}))

function createChainableMock() {
  const thenFn = (resolve: (v: unknown) => void) => mockSelectResult().then(resolve)
  const make = (): Record<string, unknown> => {
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }
  return make()
}

function txChainable(returning: () => Promise<unknown[]>) {
  const make = (): Record<string, unknown> => {
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(returning())
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }
  return make()
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => createChainableMock()),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: mockInsertReturning })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })) })),
    delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockDeleteReturning })) })),
    transaction: mockTransaction,
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {
    select: vi.fn(() => createChainableMock()),
  },
  dbClient: {},
}))

import { frontendAdminRoutes as frontendStubAdminRoutes } from '../src/routes/admin-extended/index.js'
import { db } from '../src/db/index.js'

const PREFIX = '/api'
const ADMIN_USER = '00000000-0000-0000-0000-000000000001'
const REGULAR_USER = '00000000-0000-0000-0000-000000000002'
const THEME_ID = '11111111-1111-1111-1111-111111111111'
const COLOR_ID = '22222222-2222-2222-2222-222222222222'

function mockAdmin() {
  mockAuthenticate.mockImplementation(async (request: any) => {
    request.userId = ADMIN_USER
    request.jwtPayload = { userId: ADMIN_USER, roleId: 1 }
  })
}

function mockRegularUser() {
  mockAuthenticate.mockImplementation(async (request: any) => {
    request.userId = REGULAR_USER
    request.jwtPayload = { userId: REGULAR_USER, roleId: 0 }
  })
}

function makeTheme(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: THEME_ID,
    name: '默认主题',
    description: null,
    isDark: false,
    isActive: true,
    isCurrent: false,
    preset: null,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeColor(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: COLOR_ID,
    themeId: THEME_ID,
    key: '--color-primary',
    value: '#22c55e',
    label: '主色',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('themes admin routes — /api/admin/themes/*', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(frontendStubAdminRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResult.mockReset()
    mockSelectResult.mockResolvedValue([])
    mockInsertReturning.mockReset()
    mockInsertReturning.mockResolvedValue([{ id: 'mock-id' }])
    mockUpdateReturning.mockReset()
    mockUpdateReturning.mockResolvedValue([{ id: 'mock-id' }])
    mockDeleteReturning.mockReset()
    mockDeleteReturning.mockResolvedValue([{ id: 'mock-id' }])
    mockAuthenticate.mockReset()
    mockTransaction.mockReset()
    mockTxUpdate.mockReset()
    mockTxInsert.mockReset()
  })

  it('非 admin 用户 POST /admin/themes 返回 403', async () => {
    mockRegularUser()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/themes`,
      payload: { name: '新主题' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('POST /admin/themes 创建成功 201', async () => {
    mockAdmin()
    mockInsertReturning.mockResolvedValueOnce([makeTheme({ name: '新主题' })])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/themes`,
      payload: { name: '新主题' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.name).toBe('新主题')
    expect(db.insert).toHaveBeenCalled()
  })

  it('GET /admin/themes/:id 返回主题详情(含聚合)', async () => {
    mockAdmin()
    mockSelectResult
      .mockResolvedValueOnce([makeTheme()]) // theme
      .mockResolvedValueOnce([makeColor()]) // colors
      .mockResolvedValueOnce([]) // fonts
      .mockResolvedValueOnce([]) // assets
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/themes/${THEME_ID}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.id).toBe(THEME_ID)
    expect(body.data.colors).toHaveLength(1)
    expect(body.data.fonts).toHaveLength(0)
    expect(body.data.assets).toHaveLength(0)
  })

  it('GET /admin/themes/:id 不存在返回 404', async () => {
    mockAdmin()
    mockSelectResult.mockResolvedValueOnce([]) // theme not found
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/themes/${THEME_ID}`,
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
  })

  it('PUT /admin/themes/:id 更新成功 200', async () => {
    mockAdmin()
    mockUpdateReturning.mockResolvedValueOnce([makeTheme({ name: '更新后' })])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/themes/${THEME_ID}`,
      payload: { name: '更新后' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.name).toBe('更新后')
    expect(db.update).toHaveBeenCalled()
  })

  it('PUT /admin/themes/:id 不存在返回 404', async () => {
    mockAdmin()
    mockUpdateReturning.mockResolvedValueOnce([])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/themes/${THEME_ID}`,
      payload: { name: '更新后' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /admin/themes/:id 删除成功 200', async () => {
    mockAdmin()
    mockDeleteReturning.mockResolvedValueOnce([makeTheme()])
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/admin/themes/${THEME_ID}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
    expect(db.delete).toHaveBeenCalled()
  })

  it('POST /admin/themes (isCurrent=true) 创建成功 201 且事务内取消其他当前', async () => {
    mockAdmin()
    mockTxUpdate.mockReturnValue(txChainable(async () => []))
    mockTxInsert.mockReturnValue(txChainable(async () => [makeTheme({ isCurrent: true })]))
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({ update: mockTxUpdate, insert: mockTxInsert })
    })
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/themes`,
      payload: { name: '当前主题', isCurrent: true },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.isCurrent).toBe(true)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockTxUpdate).toHaveBeenCalledTimes(1)
  })

  it('GET /admin/themes/current 返回当前主题 200', async () => {
    mockAdmin()
    mockSelectResult.mockResolvedValueOnce([makeTheme({ isCurrent: true })])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/themes/current`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.isCurrent).toBe(true)
  })

  it('GET /admin/themes/current 未设置当前主题返回 404', async () => {
    mockAdmin()
    mockSelectResult.mockResolvedValueOnce([])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/themes/current`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /admin/themes/dark-mode 返回暗色模式状态 200', async () => {
    mockAdmin()
    mockSelectResult.mockResolvedValueOnce([makeTheme({ isCurrent: true, isDark: true })])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/themes/dark-mode`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.isDark).toBe(true)
  })

  it('PUT /admin/themes/dark-mode 切换暗色模式 200', async () => {
    mockAdmin()
    mockSelectResult.mockResolvedValueOnce([makeTheme({ isCurrent: true })])
    mockUpdateReturning.mockResolvedValueOnce([makeTheme({ isCurrent: true, isDark: true })])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/themes/dark-mode`,
      payload: { isDark: true },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.isDark).toBe(true)
    expect(db.update).toHaveBeenCalled()
  })

  it('POST /admin/themes/colors 创建颜色 201', async () => {
    mockAdmin()
    mockInsertReturning.mockResolvedValueOnce([makeColor()])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/themes/colors`,
      payload: {
        themeId: THEME_ID,
        key: '--color-primary',
        value: '#22c55e',
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().code).toBe(0)
    expect(db.insert).toHaveBeenCalled()
  })

  it('GET /admin/themes/colors 返回颜色列表 200', async () => {
    mockAdmin()
    mockSelectResult
      .mockResolvedValueOnce([makeColor()]) // items
      .mockResolvedValueOnce([{ count: 1 }]) // total
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/themes/colors`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(1)
    expect(body.data.total).toBe(1)
  })

  it('PUT /admin/themes/colors/:id 更新颜色 200', async () => {
    mockAdmin()
    mockUpdateReturning.mockResolvedValueOnce([makeColor({ value: '#ef4444' })])
    const res = await server.inject({
      method: 'PUT',
      url: `${PREFIX}/admin/themes/colors/${COLOR_ID}`,
      payload: { value: '#ef4444' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.value).toBe('#ef4444')
  })

  it('DELETE /admin/themes/colors/:id 删除颜色 200', async () => {
    mockAdmin()
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/admin/themes/colors/${COLOR_ID}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe(0)
    expect(db.delete).toHaveBeenCalled()
  })

  it('GET /admin/themes/fonts 返回字体列表 200', async () => {
    mockAdmin()
    mockSelectResult
      .mockResolvedValueOnce([{ id: 'f1', name: '默认字体', family: 'sans-serif' }])
      .mockResolvedValueOnce([{ count: 1 }])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/themes/fonts`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.total).toBe(1)
  })

  it('POST /admin/themes/fonts 创建字体 201', async () => {
    mockAdmin()
    mockInsertReturning.mockResolvedValueOnce([{ id: 'f1', name: 'Inter', family: 'Inter, sans-serif' }])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/themes/fonts`,
      payload: {
        themeId: THEME_ID,
        name: 'Inter',
        family: 'Inter, sans-serif',
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().code).toBe(0)
  })

  it('PATCH /admin/themes/fonts/:id 更新字体 200', async () => {
    mockAdmin()
    mockUpdateReturning.mockResolvedValueOnce([{ id: 'f1', name: '更新字体', family: 'serif' }])
    const res = await server.inject({
      method: 'PATCH',
      url: `${PREFIX}/admin/themes/fonts/f1`,
      payload: { name: '更新字体' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.name).toBe('更新字体')
  })

  it('DELETE /admin/themes/fonts/:id 删除字体 200', async () => {
    mockAdmin()
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/admin/themes/fonts/f1`,
    })
    expect(res.statusCode).toBe(200)
    expect(db.delete).toHaveBeenCalled()
  })

  it('GET /admin/themes/assets 返回资源列表 200', async () => {
    mockAdmin()
    mockSelectResult
      .mockResolvedValueOnce([{ id: 'a1', type: 'logo', url: 'https://example.com/logo.png' }])
      .mockResolvedValueOnce([{ count: 1 }])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/themes/assets`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.list).toHaveLength(1)
  })

  it('POST /admin/themes/assets 创建资源 201', async () => {
    mockAdmin()
    mockInsertReturning.mockResolvedValueOnce([{ id: 'a1', type: 'logo', url: 'https://example.com/logo.png' }])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/themes/assets`,
      payload: {
        themeId: THEME_ID,
        type: 'logo',
        url: 'https://example.com/logo.png',
      },
    })
    expect(res.statusCode).toBe(201)
  })

  it('DELETE /admin/themes/assets/:id 删除资源 200', async () => {
    mockAdmin()
    const res = await server.inject({
      method: 'DELETE',
      url: `${PREFIX}/admin/themes/assets/a1`,
    })
    expect(res.statusCode).toBe(200)
    expect(db.delete).toHaveBeenCalled()
  })

  it('GET /admin/themes/presets 返回预设列表 200', async () => {
    mockAdmin()
    mockSelectResult
      .mockResolvedValueOnce([{ id: 'p1', name: '绿色主题', preset: 'green' }])
      .mockResolvedValueOnce([{ count: 1 }])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/admin/themes/presets`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.list).toHaveLength(1)
  })

  it('POST /admin/themes/import 导入主题 201', async () => {
    mockAdmin()
    mockInsertReturning.mockResolvedValueOnce([makeTheme({ name: '导入主题' })])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/themes/import`,
      payload: {
        name: '导入主题',
        colors: [{ key: '--color-primary', value: '#22c55e' }],
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().code).toBe(0)
    expect(db.insert).toHaveBeenCalledTimes(2) // themes + themeColors
  })

  it('POST /admin/themes/apply-preset 应用预设 201', async () => {
    mockAdmin()
    mockSelectResult.mockResolvedValueOnce([
      { id: 'p1', name: '蓝色主题', preset: 'blue', config: { primary: '#3b82f6' } },
    ])
    mockInsertReturning.mockResolvedValueOnce([makeTheme({ name: '蓝色主题', preset: 'blue' })])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/themes/apply-preset`,
      payload: { preset: 'blue' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().code).toBe(0)
  })

  it('POST /admin/themes/apply-preset 预设不存在返回 404', async () => {
    mockAdmin()
    mockSelectResult.mockResolvedValueOnce([])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/themes/apply-preset`,
      payload: { preset: 'nonexistent' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /admin/themes 参数校验失败返回 400', async () => {
    mockAdmin()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/admin/themes`,
      payload: { name: '' },
    })
    expect(res.statusCode).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })
})
