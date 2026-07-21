/**
 * Clawdbot Browser Automation - 浏览器自动化
 *
 * 页面操作、表单填写、数据抓取。
 * 注：puppeteer 未安装时降级为 fetch API 调用。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'
import { generateCompactId } from '../../utils/crypto-random.js'

export interface BrowserPage {
  id: string
  url: string
  title?: string
  content?: string
  statusCode?: number
}

export interface FormFillOptions {
  url: string
  fields: Record<string, string>
  submitSelector?: string
  waitFor?: string
  timeout?: number
}

export interface ScrapeOptions {
  url: string
  selector?: string
  extract?: Array<{ name: string; selector: string; attribute?: string }>
  headers?: Record<string, string>
}

export interface ScrapeResult {
  url: string
  statusCode: number
  title?: string
  data: Record<string, unknown>
  raw?: string
}

export class BrowserAutomation extends EventEmitter {
  private pages = new Map<string, BrowserPage>()

  async navigate(
    url: string,
    options?: { headers?: Record<string, string>; timeout?: number },
  ): Promise<BrowserPage> {
    const start = Date.now()
    logger.info({ url }, '[Browser] Navigating')
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Clawdbot/1.0', ...options?.headers },
        signal: options?.timeout ? AbortSignal.timeout(options.timeout) : undefined,
      })
      const content = await response.text()
      const title = content.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
      const page: BrowserPage = {
        // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成页面 ID
        id: generateCompactId('page'),
        url,
        title,
        content,
        statusCode: response.status,
      }
      this.pages.set(page.id, page)
      this.emit('navigated', { page, duration: Date.now() - start })
      return page
    } catch (err) {
      logger.error({ url, err: err as Error }, '[Browser] Navigation failed')
      throw err
    }
  }

  async scrape(options: ScrapeOptions): Promise<ScrapeResult> {
    const page = await this.navigate(options.url, { headers: options.headers })
    if (!page.content) {
      return { url: options.url, statusCode: page.statusCode ?? 0, data: {} }
    }

    const data: Record<string, unknown> = {}
    if (options.extract) {
      for (const field of options.extract) {
        data[field.name] = this.extractBySelector(page.content, field.selector, field.attribute)
      }
    } else if (options.selector) {
      data['default'] = this.extractBySelector(page.content, options.selector)
    } else {
      data['html'] = page.content
    }

    const result: ScrapeResult = {
      url: options.url,
      statusCode: page.statusCode ?? 0,
      title: page.title,
      data,
    }
    this.emit('scraped', result)
    return result
  }

  async fillForm(
    options: FormFillOptions,
  ): Promise<{ success: boolean; submitted: boolean; result?: string; error?: string }> {
    logger.info(
      { url: options.url, fieldCount: Object.keys(options.fields).length },
      '[Browser] Form fill',
    )
    try {
      // 降级模式：使用 fetch 发送表单数据
      const response = await fetch(options.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(options.fields).toString(),
      })
      const result = await response.text()
      this.emit('formFilled', { url: options.url, statusCode: response.status })
      return { success: true, submitted: response.ok, result }
    } catch (err) {
      return { success: false, submitted: false, error: (err as Error).message }
    }
  }

  getPage(id: string): BrowserPage | undefined {
    return this.pages.get(id)
  }

  listPages(): BrowserPage[] {
    return Array.from(this.pages.values())
  }

  closePage(id: string): boolean {
    return this.pages.delete(id)
  }

  private extractBySelector(
    html: string,
    selector: string,
    _attribute?: string,
  ): string | string[] {
    // 简化的选择器解析：支持标签名和 class/id 基础匹配
    if (selector.startsWith('#')) {
      const id = selector.slice(1)
      const regex = new RegExp(`id=["']${id}["'][^>]*>([\\s\\S]*?)<`, 'i')
      return html.match(regex)?.[1]?.trim() ?? ''
    }
    if (selector.startsWith('.')) {
      const cls = selector.slice(1)
      const regex = new RegExp(`class=["'][^"']*${cls}[^"']*["'][^>]*>([\\s\\S]*?)<`, 'gi')
      const matches = html.match(regex)
      return matches?.map((m) => m.trim()) ?? []
    }
    const tagRegex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)</${selector}>`, 'gi')
    const matches = html.match(tagRegex)
    return matches?.map((m) => m.replace(/<[^>]+>/g, '').trim()) ?? []
  }

  getStats() {
    return { openPages: this.pages.size }
  }
}

let instance: BrowserAutomation | null = null

export function getBrowserAutomation(): BrowserAutomation {
  if (!instance) instance = new BrowserAutomation()
  return instance
}
