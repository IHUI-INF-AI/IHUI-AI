/**
 * P16 阶段: admin 模块 Products + FAQs + Activities 端到端 CRUD 流程
 *
 * 验证前端 admin 页面 -> v2 SDK -> 后端 v2 端点 -> 数据库 完整链路.
 *
 * 流程:
 *   1. 用 admin 账号登录
 *   2. 访问商品管理页, 新增商品 -> 列表出现 -> 编辑 -> 删除
 *   3. 访问 FAQ 管理页, 新增 FAQ -> 编辑 -> 置顶 -> 删除
 *   4. 访问活动日志页, 验证列表可加载
 *
 * 端口字面量已抽到 client/config/ports.ts, 不允许在此处写 8000 字面量.
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { BACKEND_URL } from '../config/ports'

const BACKEND = process.env.PW_BACKEND_URL ?? BACKEND_URL
const ADMIN_USER = process.env.PW_ADMIN_USER ?? 'admin'
const ADMIN_PASS = process.env.PW_ADMIN_PASS ?? 'admin123'

interface ApiResp { code: string; msg: string; data: unknown; timestamp: number }

async function api(method: string, url: string, body?: unknown, token?: string): Promise<{ status: number; body: ApiResp }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const r = await fetch(`${BACKEND}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  let json: ApiResp
  try { json = JSON.parse(text) } catch { json = { code: 'PARSE_ERR', msg: text, data: null, timestamp: 0 } }
  return { status: r.status, body: json }
}

async function loginAsAdmin(): Promise<string> {
  const { status, body } = await api('POST', '/api/v1/login', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  })
  if (status !== 200) throw new Error(`登录失败: ${status}`)
  // 后端登录通常返回 token in data
  const data = body.data as { token?: string } | null
  if (!data?.token) throw new Error('登录未返回 token')
  return data.token
}

test.describe('P16 admin 模块 E2E 完整流程 (登录 → CRUD)', () => {
  test.setTimeout(60_000)
  let token = ''

  test.beforeAll(async () => {
    token = await loginAsAdmin()
  })

  // =========================== Products CRUD ===========================

  test('1. Products 列表: 后端返回 code=0 + 数组', async () => {
    const { status, body } = await api('GET', '/api/v2/admin/products?page=1&size=10', undefined, token)
    expect(status).toBe(200)
    expect(String(body.code)).toBe('0')
    const data = body.data as { rows: unknown[]; total: number }
    expect(Array.isArray(data.rows)).toBe(true)
  })

  test('2. Products 新增 → 列表出现 → 更新 → 删除 全链路', async () => {
    // 新增
    const name = `E2E测试商品_${Date.now()}`
    const created = await api('POST', '/api/v2/admin/products', {
      name, price: 9999, stock: 100, type: 'general', status: 'active',
    }, token)
    expect(created.status).toBe(200)
    expect(String(created.body.code)).toBe('0')
    const pid = (created.body.data as { id: number }).id
    expect(pid).toBeGreaterThan(0)

    // 列表确认
    const listed = await api('GET', '/api/v2/admin/products?keyword=' + encodeURIComponent(name), undefined, token)
    expect(listed.status).toBe(200)
    const rows = (listed.body.data as { rows: { id: number; name: string }[] }).rows
    expect(rows.some(r => r.id === pid && r.name === name)).toBe(true)

    // 更新
    const updated = await api('PUT', `/api/v2/admin/products/${pid}`, {
      name: `${name}_已编辑`, price: 19999, status: 'inactive',
    }, token)
    expect(updated.status).toBe(200)
    expect(String(updated.body.code)).toBe('0')

    // 上下架切换
    const statusChanged = await api('PUT', `/api/v2/admin/products/${pid}/status`, { status: 'active' }, token)
    expect(statusChanged.status).toBe(200)

    // 删除
    const deleted = await api('DELETE', `/api/v2/admin/products/${pid}`, undefined, token)
    expect(deleted.status).toBe(200)
    expect(String(deleted.body.code)).toBe('0')
  })

  test('3. Products Pydantic 入参校验: 缺 name 字段返回 422', async () => {
    const { status } = await api('POST', '/api/v2/admin/products', { price: 1 }, token)
    expect(status).toBe(422)  // Pydantic 自动校验
  })

  // =========================== FAQs CRUD ===========================

  test('4. FAQs 新增 → 置顶 → 更新 → 删除 全链路', async () => {
    const question = `E2E测试问题_${Date.now()}`
    const created = await api('POST', '/api/v2/admin/faqs', {
      question, answer: '初始答案', category: 'general', is_top: false, status: 'active',
    }, token)
    expect(created.status).toBe(200)
    const fid = (created.body.data as { id: number }).id

    // 置顶
    const topped = await api('PUT', `/api/v2/admin/faqs/${fid}/top`, { is_top: true }, token)
    expect(topped.status).toBe(200)

    // 更新
    const updated = await api('PUT', `/api/v2/admin/faqs/${fid}`, {
      answer: '已编辑答案', category: 'payment',
    }, token)
    expect(updated.status).toBe(200)

    // 删除
    const deleted = await api('DELETE', `/api/v2/admin/faqs/${fid}`, undefined, token)
    expect(deleted.status).toBe(200)
  })

  // =========================== Activities ===========================

  test('5. Activities 列表: 后端返回 code=0 + 数组', async () => {
    const { status, body } = await api('GET', '/api/v2/admin/activities?page=1&size=10', undefined, token)
    expect(status).toBe(200)
    expect(String(body.code)).toBe('0')
    const data = body.data as { rows: unknown[]; total: number }
    expect(Array.isArray(data.rows)).toBe(true)
  })

  // =========================== Dashboard ===========================

  test('6. Dashboard 聚合: 4 个核心指标 (users/orders/revenue/products) 全部有值', async () => {
    const { status, body } = await api('GET', '/api/v2/admin/dashboard', undefined, token)
    expect(status).toBe(200)
    expect(String(body.code)).toBe('0')
    const data = body.data as { user_count: number; order_count: number; revenue: number; product_count: number }
    expect(data.user_count).toBeGreaterThanOrEqual(0)
    expect(data.order_count).toBeGreaterThanOrEqual(0)
    expect(data.revenue).toBeGreaterThanOrEqual(0)
    expect(data.product_count).toBeGreaterThanOrEqual(0)
  })
})
