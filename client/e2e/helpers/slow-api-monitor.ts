/**
 * 慢接口监控器 (P2-1)
 *
 * 用途: 在 E2E 测试中, 监听页面请求, 记录所有 API 调用耗时.
 * 当请求耗时 > SLOW_THRESHOLD_MS 时, 打印 [SLOW] 日志并累加计数.
 * 测试结束后, 生成报告 (按 path 分组的 P50/P95/max 耗时).
 *
 * 用法 (在 test.beforeEach 中安装, afterEach 中输出):
 *   const monitor = new SlowApiMonitor(page, SLOW_THRESHOLD_MS)
 *   monitor.install()
 *   // ... 测试主体 ...
 *   monitor.report()  // 打印慢接口 + 汇总
 */

import type { Page, Request, Response } from '@playwright/test'

export interface ApiTiming {
  url: string
  method: string
  status: number
  durationMs: number
  isSlow: boolean
}

export const SLOW_THRESHOLD_MS = 1000

export class SlowApiMonitor {
  private readonly page: Page
  private readonly threshold: number
  private readonly records: ApiTiming[] = []
  private startTimes: Map<string, number> = new Map()
  private installed = false

  constructor(page: Page, threshold: number = SLOW_THRESHOLD_MS) {
    this.page = page
    this.threshold = threshold
  }

  install(): void {
    if (this.installed) return
    this.installed = true

    this.page.on('request', (req: Request) => {
      const url = req.url()
      if (!this.isApiRequest(url)) return
      this.startTimes.set(this.keyOf(req), Date.now())
    })

    this.page.on('response', async (resp: Response) => {
      const url = resp.url()
      if (!this.isApiRequest(url)) return
      const req = resp.request()
      const key = this.keyOf(req)
      const start = this.startTimes.get(key)
      if (!start) return
      this.startTimes.delete(key)
      const durationMs = Date.now() - start
      const isSlow = durationMs > this.threshold
      const timing: ApiTiming = {
        url,
        method: req.method(),
        status: resp.status(),
        durationMs,
        isSlow,
      }
      this.records.push(timing)
      if (isSlow) {
        console.log(
          `[SLOW API] ${req.method()} ${this.shorten(url)} ${resp.status()} ${durationMs}ms`
        )
      }
    })
  }

  /**
   * 汇总打印: 慢接口列表 + 按 path 分组的 P50/P95/max
   */
  report(): void {
    if (this.records.length === 0) {
      console.log('[SlowApiMonitor] 暂无 API 调用记录')
      return
    }

    const slowList = this.records.filter((r) => r.isSlow)
    console.log(
      `[SlowApiMonitor] 总请求: ${this.records.length}, 慢接口 (>${this.threshold}ms): ${slowList.length}`
    )

    if (slowList.length > 0) {
      console.log('[SlowApiMonitor] --- 慢接口列表 ---')
      slowList
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 10)
        .forEach((r) => {
          console.log(
            `  ${r.method} ${this.shorten(r.url)} ${r.status} ${r.durationMs}ms`
          )
        })
    }

    // 按 path 前缀分组统计
    const groups: Map<string, number[]> = new Map()
    for (const r of this.records) {
      const path = this.normalizePath(r.url)
      if (!groups.has(path)) groups.set(path, [])
      groups.get(path)!.push(r.durationMs)
    }

    const summary: Array<{ path: string; count: number; max: number; p50: number; p95: number }> = []
    for (const [path, durations] of groups) {
      if (durations.length < 2) continue
      const sorted = [...durations].sort((a, b) => a - b)
      summary.push({
        path,
        count: sorted.length,
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
      })
    }

    if (summary.length > 0) {
      console.log('[SlowApiMonitor] --- path 汇总 (count>=2) ---')
      summary
        .sort((a, b) => b.p95 - a.p95)
        .slice(0, 10)
        .forEach((s) => {
          console.log(
            `  ${s.path} | n=${s.count} p50=${s.p50}ms p95=${s.p95}ms max=${s.max}ms`
          )
        })
    }
  }

  /** 测试结束后获取慢接口计数 (供 test() 内断言) */
  getSlowCount(): number {
    return this.records.filter((r) => r.isSlow).length
  }

  getTotalCount(): number {
    return this.records.length
  }

  private keyOf(req: Request): string {
    return `${req.method()} ${req.url()}`
  }

  private isApiRequest(url: string): boolean {
    return (
      url.includes('/api/') ||
      url.includes('/api-v1/') ||
      url.includes('/api-v2/') ||
      url.includes('/cozeZhsApi/') ||
      url.includes('/prod-api/') ||
      url.includes('/customer-service/') ||
      url.includes('/ai-bot-sites/') ||
      url.includes('/ihui-ai-api/')
    )
  }

  private shorten(url: string): string {
    try {
      const u = new URL(url)
      return u.pathname + (u.search ? `?${u.search.slice(0, 30)}` : '')
    } catch {
      return url
    }
  }

  /** 去掉 query 参数, 只保留 path 前 2 段 (用于分组) */
  private normalizePath(url: string): string {
    try {
      const u = new URL(url)
      const parts = u.pathname.split('/').filter(Boolean)
      return '/' + parts.slice(0, 2).join('/')
    } catch {
      return url
    }
  }
}
