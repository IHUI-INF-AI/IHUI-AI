/**
 * 独立 smoke 测试: 后端 health 端点 + 端口约定
 *
 * 目的:
 *   - 不依赖 Vite / 前端, 不启动 webServer, 3 秒内跑完
 *   - 适合 pre-commit / CI 第一道闸口, 失败立即阻止后续步骤
 *   - 防止后端 8000 不可达 / 端口漂移 / health 端点契约变更
 *
 * 与 infra-vite-proxy.spec.ts 的区别:
 *   - infra-vite-proxy 依赖 Vite 8888, 验证代理链路
 *   - 本测试只验证后端 8000 + 关键 ApiResponse 契约 + 端口约定
 *
 * 端口字面量已抽到 client/config/ports.ts, 不允许在此处写 8000 字面量
 */
import { test, expect } from '@playwright/test'
import { BACKEND_URL, DEPRECATED_PORTS } from '../../config/ports'

const BACKEND = process.env.PW_BACKEND_URL ?? BACKEND_URL
const SMOKE_TIMEOUT = 3000

interface ApiResp {
  code: string | number
  msg: string
  data: unknown
  timestamp: number
}

async function fetchJson(url: string, timeoutMs = SMOKE_TIMEOUT): Promise<{ status: number; body: ApiResp; latencyMs: number }> {
  const start = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    const text = await r.text()
    const latencyMs = Date.now() - start
    let body: ApiResp
    try {
      body = JSON.parse(text)
    } catch {
      body = { code: 'PARSE_ERR', msg: text.slice(0, 200), data: null, timestamp: 0 }
    }
    return { status: r.status, body, latencyMs }
  } finally {
    clearTimeout(timer)
  }
}

test.describe('smoke: 后端 health + 端口约定 (pre-commit fast path)', () => {
  test.setTimeout(SMOKE_TIMEOUT * 2)

  test('后端 health 端点可达, 响应时间 < 1s', async () => {
    const { status, body, latencyMs } = await fetchJson(`${BACKEND}/api/health`)
    expect(status).toBe(200)
    // code 字段后端约定为 200 (数字), 测试兼容字符串 '0' 和数字 200
    expect(['0', 0, '200', 200]).toContain(String(body.code))
    expect(body.msg).toBe('success')
    expect(typeof body.timestamp).toBe('number')
    expect(latencyMs).toBeLessThan(1000)
  })

  test('后端 health ApiResponse 契约: code/msg/timestamp 三字段必在', async () => {
    const { body } = await fetchJson(`${BACKEND}/api/health`)
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('msg')
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('data')
  })

  test('历史废弃端口未复活 (防端口漂移)', async () => {
    for (const port of DEPRECATED_PORTS) {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(500),
      }).catch(() => null)
      expect(r, `端口 ${port} (历史废弃) 不应监听`).toBeNull()
    }
  })
})
