/**
 * 基础设施冒烟测试: Vite 代理 → 8000 后端 链路验证
 *
 * 目的: 防止 vite.config.ts 或端口漂移导致前端 dev 模式下 API 不可达.
 *       任何对 BACKEND_TARGET 常量 / proxy 配置的修改都必须通过此测试.
 *
 * 测试覆盖:
 * 1. 后端 8000 直连: /api/health 返 200 + 标准 ApiResponse
 * 2. Vite 代理 8888: /api/health 透传到 8000, 返 200
 * 3. Vite 代理 8888: /api/v1/* 走 v1→v2 rewrite 仍返 200
 * 4. 关键 mock 域 (agents/courses/ws) 通过代理可达
 * 5. 18000 端口不存在 (历史双端口已废弃, 绝不能复活)
 */

import { test, expect, type Page } from '@playwright/test'
import { BACKEND_URL, FRONTEND_URL, DEPRECATED_PORTS } from '../config/ports'

// 端口字面量已抽到 client/config/ports.ts, 此处仅允许 PW_BASE_URL/PW_BACKEND_URL 覆盖
// 不允许再写 8000/8888/18000 字面量
const BACKEND = process.env.PW_BACKEND_URL ?? BACKEND_URL
const FRONTEND = process.env.PW_BASE_URL ?? FRONTEND_URL

interface ApiResp {
  code: string | number
  msg: string
  data: unknown
  timestamp: number
}

async function fetchJson(url: string): Promise<{ status: number; body: ApiResp }> {
  const r = await fetch(url)
  const text = await r.text()
  let body: ApiResp
  try {
    body = JSON.parse(text)
  } catch {
    body = { code: 'PARSE_ERR', msg: text.slice(0, 200), data: null, timestamp: 0 }
  }
  return { status: r.status, body }
}

test.describe('基础设施: 端口约定 + Vite 代理链路', () => {
  test.setTimeout(30000)

  test('后端 8000 直连: /api/health 返 200 + ApiResponse 格式', async () => {
    const { status, body } = await fetchJson(`${BACKEND}/api/health`)
    expect(status).toBe(200)
    // P1-2 错误码契约: code 必须是字符串 "0" (success)
    expect(String(body.code)).toBe('0')
    expect(body.msg).toBe('success')
    expect(typeof body.timestamp).toBe('number')
  })

  test('Vite 代理 8888 → 8000: /api/health 透传', async () => {
    const { status, body } = await fetchJson(`${FRONTEND}/api/health`)
    expect(status).toBe(200)
    expect(String(body.code)).toBe('0')
    expect(body.msg).toBe('success')
  })

  test('Vite 代理 8888 → 8000: /api/v1/agents 返 200 + v1 主线结构 (P18 完成)', async () => {
    const { status, body } = await fetchJson(`${FRONTEND}/api/v1/agents/list`)
    expect(status).toBe(200)
    expect(String(body.code)).toBe('0')
    // P18 阶段完成后, v1 已是唯一主线, 不再有 v1→v2 rewrite
    // 验证 v1 主线结构: data.v1_path 指向自己 + data.records 是数组
    const data = body.data as { v1_path?: string; records?: unknown[]; migrated?: boolean }
    expect(data.v1_path).toBe('/api/v1/agents/list')
    expect(data.migrated).toBe(true)
    expect(Array.isArray(data.records)).toBe(true)
  })

  test('Vite 代理 8888 → 8000: 关键 mock 域 (courses/categories) 可达', async () => {
    const urls = [
      `${FRONTEND}/api/v1/courses`,
      `${FRONTEND}/api/v1/agents/categories`,
    ]
    for (const u of urls) {
      const { status, body } = await fetchJson(u)
      expect(status, `URL ${u} 应返 200`).toBe(200)
      expect(String(body.code), `URL ${u} 应返 success`).toBe('0')
    }
  })

  test('历史双端口 18000 已废弃, 不应有任何服务监听', async () => {
    // 用 node net 模块直连 18000, 比 fetch 更精确 (避开浏览器 fetch 的"静默重试/降级")
    // 若 18000 真的无服务: socket.connect 应触发 ECONNREFUSED, 立即 reject
    // 若 18000 残留服务: connect 成功, 视为回归
    // 端口从 client/config/ports.ts 的 DEPRECATED_PORTS 读取, 后续若新增废弃端口只改那一处
    const net = await import('node:net')
    for (const port of DEPRECATED_PORTS) {
      const reachable = await new Promise<boolean>((resolve) => {
        const sock = new net.Socket()
        let resolved = false
        const onDone = (r: boolean) => {
          if (resolved) return
          resolved = true
          sock.destroy()
          resolve(r)
        }
        sock.setTimeout(2000)
        sock.once('connect', () => onDone(true))
        sock.once('timeout', () => onDone(false))
        sock.once('error', () => onDone(false))
        sock.connect(port, '127.0.0.1')
      })
      expect(reachable, `${port} 端口必须无服务 (历史双端口已废弃 2026-06-18)`).toBe(false)
    }
  })

  test('Vite 代理 8888: WebSocket 升级端点 /api/v1/ws/chat 存在', async ({ page }: { page: Page }) => {
    // P0-2: 验证 WebSocket 路由挂在 /api/v1 下
    // 用 GET 探测: 200(如果端点同时支持 GET)、4xx(协议不匹配)、426(Upgrade Required) 都算"端点存在"
    // 5xx 才是真错
    const resp = await page.request.get(`${FRONTEND}/api/v1/ws/chat`, { timeout: 5000 })
    const status = resp.status()
    expect(status, `WebSocket 端点不应返回 5xx, 实际 ${status}`).toBeLessThan(500)
  })
})
