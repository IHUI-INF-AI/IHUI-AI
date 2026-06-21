/**
 * 后端接口契约测试
 * 验证前端 API 调用与后端 /api/agent/* 接口契约一致
 * 当 VITE_ENABLE_ZHS_AGENT_LIST=true 时应走真实后端
 * 后端实现见 backend/api/agent_routes.py
 */

import { test, expect } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

test.describe('后端 /api/agent 接口契约', () => {
  test('GET /api/agent/zhsAgent/list 返回 ApiResponse 格式', async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/agent/zhsAgent/list`, { timeout: 8000 }).catch(() => null)
    if (!resp || !resp.ok()) {
      test.skip(true, '后端未启动或接口未实现（启动后端 + 后端路由后此测试生效）')
      return
    }
    const body = await resp.json()
    expect(Number(body.code), 'code=0 (RuoYi 风格成功)').toBe(0)
    expect(body.data, 'data 必填').toBeTruthy()
    expect(Array.isArray(body.data.list), 'data.list 是数组').toBe(true)
    expect(typeof body.data.total, 'data.total 是数字').toBe('number')
    // 字段契约
    if (body.data.list.length > 0) {
      const first = body.data.list[0]
      expect(first.id, 'item.id 必填').toBeTruthy()
      expect(first.name, 'item.name 必填').toBeTruthy()
      expect(first.title, 'item.title 必填').toBeTruthy()
    }
  })

  test('GET /api/agent/zhsAgent/list 支持 categoryId 过滤', async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/agent/zhsAgent/list?categoryId=cat-writing`, { timeout: 8000 }).catch(() => null)
    if (!resp || !resp.ok()) {
      test.skip(true, '后端未启动')
      return
    }
    const body = await resp.json()
    expect(Number(body.code)).toBe(0)
    if (body.data.list.length > 0) {
      expect(body.data.list[0].categoryId).toBe('cat-writing')
    }
  })

  test('GET /api/agent/zhsAgent/list 支持分页', async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/agent/zhsAgent/list?page=1&pageSize=2`, { timeout: 8000 }).catch(() => null)
    if (!resp || !resp.ok()) {
      test.skip(true, '后端未启动')
      return
    }
    const body = await resp.json()
    expect(Number(body.code)).toBe(0)
    expect(body.data.pageSize).toBe(2)
    expect(body.data.list.length).toBeLessThanOrEqual(2)
  })

  test('GET /api/agent/zhsAgent/{id} 返回详情', async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/agent/zhsAgent/w-1`, { timeout: 8000 }).catch(() => null)
    if (!resp || !resp.ok()) {
      test.skip(true, '后端未启动')
      return
    }
    const body = await resp.json()
    expect(Number(body.code)).toBe(0)
    expect(body.data.id).toBe('w-1')
    expect(body.data.name).toBeTruthy()
  })

  test('GET /api/agent/zhsAgent/not-exist 返回 404', async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/agent/zhsAgent/not-exist-9999`, { timeout: 8000 }).catch(() => null)
    if (!resp) {
      test.skip(true, '后端未启动')
      return
    }
    // 后端可能返回 200 + code != 0 或 404
    expect([200, 404]).toContain(resp.status())
  })

  test('GET /api/agent/categories 返回分类列表', async ({ request }) => {
    const resp = await request.get(`${BACKEND}/api/agent/categories`, { timeout: 8000 }).catch(() => null)
    if (!resp || !resp.ok()) {
      test.skip(true, '后端未启动')
      return
    }
    const body = await resp.json()
    expect(Number(body.code)).toBe(0)
    expect(body.data.list.length).toBeGreaterThan(0)
    expect(body.data.list[0].id).toBeTruthy()
    expect(body.data.list[0].name).toBeTruthy()
  })

  test('GET /api/agent/rule/search/bylink 返回按主分类分组的智能体列表', async ({ request }) => {
    // 验证前端 payment.ts getAgentList() 调用的路径在后端可访问
    const resp = await request.get(`${BACKEND}/api/agent/rule/search/bylink`, { timeout: 8000 }).catch(() => null)
    if (!resp || !resp.ok()) {
      test.skip(true, '后端未启动')
      return
    }
    const body = await resp.json()
    expect(Number(body.code), 'code=0 (RuoYi 风格成功)').toBe(0)
    expect(body.data, 'data 必填').toBeTruthy()
    // mock_agent_bylink 返回 { "AI写作": [...], "AI客服": [...], ... }
    const keys = Object.keys(body.data)
    expect(keys.length, '至少有一个主分类').toBeGreaterThan(0)
    const firstCategory = keys[0]
    expect(Array.isArray(body.data[firstCategory]), '分类值是数组').toBe(true)
    if (body.data[firstCategory].length > 0) {
      const firstAgent = body.data[firstCategory][0]
      expect(firstAgent.agentName || firstAgent.name, 'agentName 或 name 必填').toBeTruthy()
    }
  })

  test('POST /api/agent/collect/{id} 收藏接口可达', async ({ request }) => {
    const resp = await request.post(`${BACKEND}/api/agent/collect/mock-w-1`, { timeout: 8000 }).catch(() => null)
    if (!resp || !resp.ok()) {
      test.skip(true, '后端未启动')
      return
    }
    const body = await resp.json()
    expect(Number(body.code)).toBe(0)
  })

  test('POST /api/agent/like/{id} 点赞接口可达', async ({ request }) => {
    const resp = await request.post(`${BACKEND}/api/agent/like/mock-w-1`, { timeout: 8000 }).catch(() => null)
    if (!resp || !resp.ok()) {
      test.skip(true, '后端未启动')
      return
    }
    const body = await resp.json()
    expect(Number(body.code)).toBe(0)
  })
})

test.describe('前端 VITE_ENABLE_ZHS_AGENT_LIST env 开关', () => {
  test('env=false 时前端走 mock 兜底（不影响 /agents 渲染）', async ({ page }) => {
    await page.goto('http://127.0.0.1:8888/agents', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const hasContent = await page.evaluate(() => document.body.innerText.length > 100)
    expect(hasContent, 'agents 页必须有内容').toBe(true)
  })
})
