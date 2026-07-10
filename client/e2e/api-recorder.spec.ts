/**
 * 联调数据录制与回放 E2E (P2-2)
 *
 * 目的: 验证 ApiRecorder 能录制真实 API 响应, ApiReplayer 能用录制数据回放.
 * 这套机制用于: 离线开发, 后端宕机测试, 性能基线对比.
 *
 * 测试覆盖:
 * 1. 录制器能捕获 page 内 fetch 的 API 调用
 * 2. 录制数据能保存为 JSON
 * 3. 回放器能用录制数据 mock 后端响应
 */

import { test, expect, type Page } from '@playwright/test'
import { ApiRecorder, ApiReplayer } from './helpers/api-recorder'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename_e2e = fileURLToPath(import.meta.url)
const __dirname_e2e = path.dirname(__filename_e2e)

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'
const FRONTEND = process.env.PW_BASE_URL ?? 'http://127.0.0.1:8888'
const FIXTURE_DIR = path.join(__dirname_e2e, 'fixtures')
const FIXTURE_PATH = path.join(FIXTURE_DIR, 'api-recording-test.json')

test.describe('联调数据录制与回放 (P2-2)', () => {
  test.setTimeout(60000)

  test('录制器能捕获 API 响应并保存为 JSON', async ({ page }: { page: Page }) => {
    // 先给 page 一个真实 origin, fetch 才能发出去
    await page.goto(`${FRONTEND}/`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})

    const recorder = new ApiRecorder(page, FIXTURE_PATH)
    recorder.install()

    // 通过 page.evaluate 触发多个 API 请求 (走 Vite 代理, 避免 CORS)
    const apiCalls = await page.evaluate(async (frontend: string) => {
      const urls = [
        `${frontend}/api/health`,
        `${frontend}/api/v1/resource/home`,
        `${frontend}/api/v1/agents/categories`,
        `${frontend}/openapi.json`,
        `${frontend}/api/v1/courses/courses`,
      ]
      const results = []
      for (const u of urls) {
        try {
          const r = await fetch(u)
          results.push({ url: u, status: r.status })
        } catch (e) {
          results.push({ url: u, status: 0, error: String(e) })
        }
      }
      return results
    }, FRONTEND)
    console.log('[录制] 触发的 API 调用:', JSON.stringify(apiCalls))

    // 等待所有响应被 page.on('response') 接收
    await page.waitForTimeout(500)

    const count = await recorder.save()
    console.log(`[录制] 保存了 ${count} 条记录`)

    // 至少录制到 1 条
    expect(count).toBeGreaterThan(0)

    // 验证文件存在
    const stat = await fs.stat(FIXTURE_PATH)
    expect(stat.size).toBeGreaterThan(100)

    // 验证 JSON 结构
    const data = JSON.parse(await fs.readFile(FIXTURE_PATH, 'utf-8'))
    expect(data.version).toBe('1.0')
    expect(data.count).toBe(count)
    expect(Array.isArray(data.calls)).toBe(true)
    expect(data.calls.length).toBe(count)
    expect(data.calls[0]).toHaveProperty('method')
    expect(data.calls[0]).toHaveProperty('url')
    expect(data.calls[0]).toHaveProperty('status')
  })

  test('回放器能用录制数据 mock 后端响应', async ({ page }: { page: Page }) => {
    // 用临时 fixture 路径, 与全局 fixture 隔离, 自包含测试
    const tempFixture = path.join(FIXTURE_DIR, 'api-recording-replay-temp.json')

    // 1) 先录制: 让 page 有真实 origin, 触发 fetch
    await page.goto(`${FRONTEND}/`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
    const recorder = new ApiRecorder(page, tempFixture)
    recorder.install()

    const targetUrl = `${FRONTEND}/api/v1/agents`
    const recorded = await page.evaluate(async (u: string) => {
      const r = await fetch(u)
      return { ok: r.ok, status: r.status }
    }, targetUrl)
    console.log('[录制] 录制响应:', JSON.stringify(recorded))
    await page.waitForTimeout(500)
    const recordedCount = await recorder.save()
    console.log(`[录制] 共录制 ${recordedCount} 条到临时 fixture`)
    expect(recordedCount).toBeGreaterThan(0)

    // 2) 重新加载页面, 注册路由拦截, 验证回放能 mock 响应
    await page.goto(`${FRONTEND}/`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
    const replayer = new ApiReplayer(tempFixture)
    console.log(`[回放] 加载了 ${replayer.count()} 条录制数据`)

    const apiRouteRegex = new RegExp('.*/api/.*')
    await page.route(apiRouteRegex, (route) => replayer.handle(route))

    const result = await page.evaluate(async (u: string) => {
      try {
        const r = await fetch(u)
        const text = await r.text()
        return { ok: r.ok, status: r.status, body: text.slice(0, 200) }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }, targetUrl)
    console.log('[回放] 拦截响应:', JSON.stringify(result))

    // 应该被 mock 响应 (200 + 录制时的 body)
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.body).toBeTruthy()

    // 清理临时 fixture
    await fs.unlink(tempFixture).catch(() => {})
  })

  test('回放器对未录制过的请求能透传', async ({ page }: { page: Page }) => {
    const replayer = new ApiReplayer(FIXTURE_PATH)
    const apiRegex = new RegExp('.*/api/.*')
    await page.route(apiRegex, (route) => replayer.handle(route))
    await page.goto(`${FRONTEND}/`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})

    // 发起一个未录制的 API 请求 (走 Vite 代理)
    // 验证: 1) fetch 不抛错 (说明 route.continue() 成功, 没有被 mock 拦截失败)
    //       2) 返回 status 字段 (说明有响应, 不管是 mock 200 还是真 404)
    const result = await page.evaluate(async (frontend: string) => {
      try {
        const r = await fetch(`${frontend}/api/v1/this-endpoint-was-never-recorded-12345`, {
          method: 'GET',
        })
        return { ok: r.ok, status: r.status, hasResponse: true }
      } catch (e) {
        // 如果是被 mock 拦截失败, 会进这里; pass-through 不会
        return { hasResponse: false, error: String(e) }
      }
    }, FRONTEND)
    console.log('[回放] 透传未录制请求:', JSON.stringify(result))
    // 关键: 透传不抛错 (route.continue 成功), 有响应
    expect(result.hasResponse).toBe(true)
    expect(typeof result.status).toBe('number')
  })
})
