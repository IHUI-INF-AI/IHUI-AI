/**
 * API 数据录制器 (P2-2)
 *
 * 用途: 在 E2E 测试中录制真实 API 响应, 保存为 JSON fixture,
 * 后续可作为离线 mock 数据回放 (后端宕机 / 离线开发时使用).
 *
 * 用法:
 *   const recorder = new ApiRecorder(page, './fixtures/2026-06-18.json')
 *   recorder.install()
 *   // ... 测试主体 ...
 *   await recorder.save()  // 持久化
 *
 * 回放 (后端不可用时):
 *   const replay = new ApiReplayer(jsonPath)
 *   await page.route(pattern, route => replay.handle(route))
 */

import type { Page, Request, Response, Route } from '@playwright/test'
import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import * as path from 'node:path'

export interface RecordedCall {
  method: string
  url: string
  status: number
  requestBody?: string
  responseBody?: string
  responseHeaders?: Record<string, string>
  timestamp: number
  durationMs: number
}

export class ApiRecorder {
  private readonly page: Page
  private readonly outputPath: string
  private readonly records: RecordedCall[] = []
  private startTimes: Map<string, number> = new Map()
  private installed = false

  constructor(page: Page, outputPath: string) {
    this.page = page
    this.outputPath = outputPath
  }

  install(): void {
    if (this.installed) return
    this.installed = true

    this.page.on('request', (req: Request) => {
      const url = req.url()
      if (!this.isApiRequest(url)) return
      const key = this.keyOf(req)
      this.startTimes.set(key, Date.now())
    })

    this.page.on('response', async (resp: Response) => {
      const url = resp.url()
      if (!this.isApiRequest(url)) return
      const req = resp.request()
      const key = this.keyOf(req)
      const start = this.startTimes.get(key)
      this.startTimes.delete(key)

      let responseBody: string | undefined
      try {
        // 仅记录非二进制响应, 避免录像过大
        const ct = resp.headers()['content-type'] || ''
        if (ct.includes('json') || ct.includes('text') || ct === '') {
          responseBody = await resp.text().catch(() => undefined)
          // 限制单条 body 大小
          if (responseBody && responseBody.length > 50_000) {
            responseBody = responseBody.slice(0, 50_000) + '...[truncated]'
          }
        }
      } catch {
        // ignore
      }

      let requestBody: string | undefined
      try {
        const data = req.postData()
        if (data) {
          requestBody = data.length > 10_000 ? data.slice(0, 10_000) + '...[truncated]' : data
        }
      } catch {
        // ignore
      }

      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(resp.headers())) {
        headers[k] = v
      }

      this.records.push({
        method: req.method(),
        url,
        status: resp.status(),
        requestBody,
        responseBody,
        responseHeaders: headers,
        timestamp: Date.now(),
        durationMs: start ? Date.now() - start : 0,
      })
    })
  }

  /** 保存为 JSON 文件. 返回保存的记录数. */
  async save(): Promise<number> {
    const dir = path.dirname(this.outputPath)
    await fs.mkdir(dir, { recursive: true })
    // 追加模式: 如果文件已存在, 合并旧记录 (去重: 同 method+url 取最新)
    let existing: RecordedCall[] = []
    try {
      const raw = await fs.readFile(this.outputPath, 'utf-8')
      const old = JSON.parse(raw)
      if (Array.isArray(old.calls)) existing = old.calls
    } catch {
      // 文件不存在或解析失败, 忽略
    }
    const merged = new Map<string, RecordedCall>()
    for (const r of existing) {
      merged.set(`${r.method} ${r.url}`, r)
    }
    for (const r of this.records) {
      merged.set(`${r.method} ${r.url}`, r)
    }
    const data = {
      version: '1.0',
      recordedAt: new Date().toISOString(),
      count: merged.size,
      calls: Array.from(merged.values()),
    }
    await fs.writeFile(this.outputPath, JSON.stringify(data, null, 2), 'utf-8')
    console.log(
      `[ApiRecorder] 已保存 ${merged.size} 条记录 (新增 ${this.records.length}) 到 ${this.outputPath}`
    )
    return merged.size
  }

  getRecords(): RecordedCall[] {
    return [...this.records]
  }

  private keyOf(req: Request): string {
    return `${req.method()} ${req.url()}`
  }

  private isApiRequest(url: string): boolean {
    // 排除前端源码静态文件 (Vite dev server 加载的 /src/**/*.ts/.js)
    if (url.includes('/src/') && (url.endsWith('.ts') || url.endsWith('.js'))) return false
    if (url.includes('/node_modules/')) return false
    if (url.includes('/@vite/') || url.includes('/@id/') || url.includes('/@fs/')) return false
    return (
      url.includes('/api/') ||
      url.includes('/cozeZhsApi/') ||
      url.includes('/prod-api/') ||
      url.includes('/customer-service/') ||
      url.includes('/ai-bot-sites/') ||
      url.includes('/ihui-ai-api/')
    )
  }
}

/**
 * API 回放器: 用录制的 JSON 数据 mock 后端响应
 */
export class ApiReplayer {
  private readonly records: RecordedCall[]
  private readonly lookup: Map<string, RecordedCall>

  constructor(jsonPath: string) {
    const data = JSON.parse(fsSync.readFileSync(jsonPath, 'utf-8'))
    this.records = data.calls || []
    this.lookup = new Map()
    for (const r of this.records) {
      // 用 (method + url.pathname) 作为 key, 适配同源不同端口/不同域名的回放
      let pathKey = r.url
      try {
        pathKey = new URL(r.url).pathname
      } catch {
        // ignore
      }
      // 取最后一次 (录制的最后一次成功)
      this.lookup.set(`${r.method} ${pathKey}`, r)
    }
  }

  /** 用作 page.route 的 handler, 返回 mock 响应 */
  handle(route: Route): void {
    const req = route.request()
    const u = new URL(req.url())
    const key = `${req.method()} ${u.pathname}`
    const rec = this.lookup.get(key)
    if (!rec) {
      // 未录制过的请求: 透传 (或返回 404)
      route.continue().catch((err) => console.log(`[ApiReplayer] 透传失败: ${err.message}`))
      return
    }
    // 过滤掉 hop-by-hop 头, 避免 Playwright 报错
    const safeHeaders: Record<string, string> = {}
    for (const [k, v] of Object.entries(rec.responseHeaders || {})) {
      const lk = k.toLowerCase()
      if (
        lk.startsWith('content-') ||
        lk.startsWith('x-') ||
        lk.startsWith('access-control-')
      ) {
        safeHeaders[k] = v
      }
    }
    route
      .fulfill({
        status: rec.status,
        headers: safeHeaders,
        body: rec.responseBody || '',
      })
      .catch((err) => {
        console.log(`[ApiReplayer] fulfill 失败: ${err.message}, key=${key}`)
        route.continue().catch(() => {})
      })
  }

  count(): number {
    return this.records.length
  }
}
