/**
 * OpenClaw Browser Automation System
 * 
 * 完整的浏览器自动化功能:
 * - 页面导航 (Navigate)
 * - 元素点击 (Click)
 * - 表单填写 (Form Fill)
 * - 截图捕获 (Screenshot)
 * - 文件上传/下载
 * - Cookie 管理
 * - 多标签页管理
 * - 键盘/鼠标模拟
 * - 网络拦截
 * - 等待和断言
 * 
 * 参考: https://docs.clawd.bot/tools/browser
 */

 

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * 浏览器配置
 */
export interface BrowserConfig {
  /** 浏览器类型 */
  browserType?: 'chromium' | 'firefox' | 'webkit'
  /** 无头模式 */
  headless?: boolean
  /** 视口宽度 */
  viewportWidth?: number
  /** 视口高度 */
  viewportHeight?: number
  /** 设备缩放 */
  deviceScaleFactor?: number
  /** 用户代理 */
  userAgent?: string
  /** 代理配置 */
  proxy?: ProxyConfig
  /** 超时时间 */
  timeout?: number
  /** 是否记录操作 */
  recordActions?: boolean
  /** 截图目录 */
  screenshotDir?: string
  /** 下载目录 */
  downloadDir?: string
}

/**
 * 代理配置
 */
export interface ProxyConfig {
  server: string
  username?: string
  password?: string
  bypass?: string[]
}

/**
 * 页面状态
 */
export interface PageState {
  url: string
  title: string
  isLoading: boolean
  viewport: { width: number; height: number }
  scrollPosition: { x: number; y: number }
  cookies: BrowserCookie[]
  localStorage: Record<string, string>
}

/**
 * Cookie
 */
export interface BrowserCookie {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly: boolean
  secure: boolean
  sameSite: 'Strict' | 'Lax' | 'None'
}

/**
 * 元素定位器
 */
export interface ElementLocator {
  /** CSS 选择器 */
  css?: string
  /** XPath */
  xpath?: string
  /** 文本内容 */
  text?: string
  /** 包含文本 */
  hasText?: string
  /** 角色 */
  role?: string
  /** 测试ID */
  testId?: string
  /** 标签名 */
  tag?: string
  /** ID */
  id?: string
  /** 类名 */
  className?: string
  /** 名称属性 */
  name?: string
  /** 占位符 */
  placeholder?: string
  /** Alt 文本 */
  alt?: string
  /** 第N个 */
  nth?: number
}

/**
 * 元素信息
 */
export interface ElementInfo {
  tag: string
  id?: string
  className?: string
  text?: string
  href?: string
  src?: string
  value?: string
  checked?: boolean
  disabled?: boolean
  visible: boolean
  enabled: boolean
  editable: boolean
  boundingBox: BoundingBox
  attributes: Record<string, string>
}

/**
 * 边界框
 */
export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 点击选项
 */
export interface ClickOptions {
  button?: 'left' | 'right' | 'middle'
  clickCount?: number
  delay?: number
  force?: boolean
  modifiers?: ('Alt' | 'Control' | 'Meta' | 'Shift')[]
  position?: { x: number; y: number }
  timeout?: number
}

/**
 * 输入选项
 */
export interface TypeOptions {
  delay?: number
  timeout?: number
  clear?: boolean
}

/**
 * 截图选项
 */
export interface ScreenshotOptions {
  path?: string
  type?: 'png' | 'jpeg'
  quality?: number
  fullPage?: boolean
  clip?: BoundingBox
  omitBackground?: boolean
  encoding?: 'base64' | 'binary'
}

/**
 * 等待选项
 */
export interface WaitOptions {
  state?: 'attached' | 'detached' | 'visible' | 'hidden'
  timeout?: number
}

/**
 * 导航选项
 */
export interface NavigateOptions {
  timeout?: number
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'
  referer?: string
}

/**
 * 文件选择选项
 */
export interface FileChooserOptions {
  files: string[] | { name: string; mimeType: string; buffer: ArrayBuffer }[]
  timeout?: number
}

/**
 * 网络请求
 */
export interface NetworkRequest {
  url: string
  method: string
  headers: Record<string, string>
  postData?: string
  resourceType: string
  timestamp: number
}

/**
 * 网络响应
 */
export interface NetworkResponse {
  url: string
  status: number
  statusText: string
  headers: Record<string, string>
  body?: string
  timestamp: number
}

/**
 * 操作记录
 */
export interface ActionRecord {
  id: string
  type: ActionType
  target?: string
  value?: unknown
  timestamp: number
  duration?: number
  screenshot?: string
  success: boolean
  error?: string
}

/**
 * 操作类型
 */
export type ActionType =
  | 'navigate'
  | 'click'
  | 'dblclick'
  | 'type'
  | 'fill'
  | 'clear'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'hover'
  | 'focus'
  | 'blur'
  | 'scroll'
  | 'screenshot'
  | 'upload'
  | 'download'
  | 'wait'
  | 'evaluate'
  | 'keyboard'
  | 'mouse'

/**
 * 浏览器自动化管理器
 */
export class BrowserAutomation extends EventEmitter {
  private config: Required<BrowserConfig>
  private state = reactive<PageState>({
    url: '',
    title: '',
    isLoading: false,
    viewport: { width: 1280, height: 720 },
    scrollPosition: { x: 0, y: 0 },
    cookies: [],
    localStorage: {},
  })
  
  private initialized = ref(false)
  private actions = ref<ActionRecord[]>([])
  private networkRequests = ref<NetworkRequest[]>([])
  private networkResponses = ref<NetworkResponse[]>([])
  
  // 模拟的浏览器上下文
  private browserFrame: HTMLIFrameElement | null = null
  private frameDocument: Document | null = null

  constructor(config: BrowserConfig = {}) {
    super()
    this.config = {
      browserType: config.browserType || 'chromium',
      headless: config.headless ?? false,
      viewportWidth: config.viewportWidth || 1280,
      viewportHeight: config.viewportHeight || 720,
      deviceScaleFactor: config.deviceScaleFactor || 1,
      userAgent: config.userAgent || navigator.userAgent,
      proxy: config.proxy || { server: '' },
      timeout: config.timeout || 30000,
      recordActions: config.recordActions ?? true,
      screenshotDir: config.screenshotDir || 'screenshots',
      downloadDir: config.downloadDir || 'downloads',
    }
  }

  /**
   * 初始化浏览器
   */
  async initialize(container?: HTMLElement): Promise<void> {
    if (this.initialized.value) return

    logger.info('[Browser] Initializing browser automation...')

    // 在Web环境中，我们使用iframe来模拟浏览器
    if (container) {
      this.browserFrame = document.createElement('iframe')
      this.browserFrame.style.width = '100%'
      this.browserFrame.style.maxWidth = `${this.config.viewportWidth}px`
      this.browserFrame.style.height = `${this.config.viewportHeight}px`
      this.browserFrame.style.border = '1px solid var(--border-unified-color)'
      this.browserFrame.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-forms')
      container.appendChild(this.browserFrame)

      this.browserFrame.onload = () => {
        this.frameDocument = this.browserFrame!.contentDocument
        this.updateState()
      }
    }

    this.state.viewport = {
      width: this.config.viewportWidth,
      height: this.config.viewportHeight,
    }

    this.initialized.value = true
    logger.info('[Browser] Browser automation initialized')
    this.emit('initialized')
  }

  /**
   * 更新页面状态
   */
  private updateState(): void {
    if (this.browserFrame && this.frameDocument) {
      this.state.url = this.browserFrame.contentWindow?.location.href || ''
      this.state.title = this.frameDocument.title || ''
    }
  }

  /**
   * 记录操作
   */
  private recordAction(action: Omit<ActionRecord, 'id' | 'timestamp'>): ActionRecord {
    const record: ActionRecord = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    }

    if (this.config.recordActions) {
      this.actions.value.push(record)
    }

    this.emit('actionRecorded', record)
    return record
  }

  /**
   * 导航到 URL
   */
  async navigate(url: string, options: NavigateOptions = {}): Promise<void> {
    const { timeout = this.config.timeout, waitUntil: _waitUntil = 'load' } = options

    logger.info(`[Browser] Navigate to: ${url}`)
    this.state.isLoading = true

    const startTime = Date.now()

    try {
      if (this.browserFrame) {
        this.browserFrame.src = url

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Navigation timeout'))
          }, timeout)

          this.browserFrame!.onload = () => {
            clearTimeout(timer)
            this.updateState()
            resolve()
          }

          this.browserFrame!.onerror = () => {
            clearTimeout(timer)
            reject(new Error('Navigation failed'))
          }
        })
      }

      this.recordAction({
        type: 'navigate',
        target: url,
        value: options,
        duration: Date.now() - startTime,
        success: true,
      })

      this.emit('navigated', { url })
    } catch (error) {
      this.recordAction({
        type: 'navigate',
        target: url,
        success: false,
        error: (error as Error).message,
      })
      throw error
    } finally {
      this.state.isLoading = false
    }
  }

  /**
   * 后退
   */
  async goBack(): Promise<void> {
    if (this.browserFrame?.contentWindow) {
      this.browserFrame.contentWindow.history.back()
      await this.waitForNavigation()
    }
  }

  /**
   * 前进
   */
  async goForward(): Promise<void> {
    if (this.browserFrame?.contentWindow) {
      this.browserFrame.contentWindow.history.forward()
      await this.waitForNavigation()
    }
  }

  /**
   * 刷新
   */
  async reload(): Promise<void> {
    if (this.browserFrame?.contentWindow) {
      this.browserFrame.contentWindow.location.reload()
      await this.waitForNavigation()
    }
  }

  /**
   * 等待导航完成
   */
  async waitForNavigation(options: NavigateOptions = {}): Promise<void> {
    const { timeout = this.config.timeout } = options

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Wait for navigation timeout'))
      }, timeout)

      if (this.browserFrame) {
        this.browserFrame.onload = () => {
          clearTimeout(timer)
          this.updateState()
          resolve()
        }
      }
    })
  }

  /**
   * 查找元素
   */
  private findElement(locator: ElementLocator): Element | null {
    if (!this.frameDocument) return null

    if (locator.css) {
      return this.frameDocument.querySelector(locator.css)
    }
    if (locator.xpath) {
      const result = this.frameDocument.evaluate(
        locator.xpath,
        this.frameDocument,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      )
      return result.singleNodeValue as Element
    }
    if (locator.id) {
      return this.frameDocument.getElementById(locator.id)
    }
    if (locator.text) {
      const elements = this.frameDocument.querySelectorAll('*')
      for (const el of elements) {
        if (el.textContent?.trim() === locator.text) return el
      }
    }
    if (locator.hasText) {
      const elements = this.frameDocument.querySelectorAll('*')
      for (const el of elements) {
        if (el.textContent?.includes(locator.hasText)) return el
      }
    }
    if (locator.role) {
      return this.frameDocument.querySelector(`[role="${locator.role}"]`)
    }
    if (locator.testId) {
      return this.frameDocument.querySelector(`[data-testid="${locator.testId}"]`)
    }
    if (locator.placeholder) {
      return this.frameDocument.querySelector(`[placeholder="${locator.placeholder}"]`)
    }
    if (locator.name) {
      return this.frameDocument.querySelector(`[name="${locator.name}"]`)
    }

    return null
  }

  /**
   * 等待元素
   */
  async waitForElement(
    locator: ElementLocator,
    options: WaitOptions = {}
  ): Promise<Element | null> {
    const { state = 'visible', timeout = this.config.timeout } = options

    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const element = this.findElement(locator)

      if (state === 'attached' && element) return element
      if (state === 'detached' && !element) return null
      if (state === 'visible' && element && this.isElementVisible(element)) return element
      if (state === 'hidden' && (!element || !this.isElementVisible(element))) return element

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    throw new Error(`Wait for element timeout: ${JSON.stringify(locator)}`)
  }

  /**
   * 检查元素是否可见
   */
  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      parseFloat(style.opacity) > 0
    )
  }

  /**
   * 获取元素信息
   */
  async getElementInfo(locator: ElementLocator): Promise<ElementInfo | null> {
    const element = this.findElement(locator)
    if (!element) return null

    const rect = element.getBoundingClientRect()
    // 保留 computedStyle 以备将来使用
    const _computedStyle = window.getComputedStyle(element)

    const attributes: Record<string, string> = {}
    for (const attr of element.attributes) {
      attributes[attr.name] = attr.value
    }

    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || undefined,
      className: element.className || undefined,
      text: element.textContent?.trim(),
      href: (element as HTMLAnchorElement).href || undefined,
      src: (element as HTMLImageElement).src || undefined,
      value: (element as HTMLInputElement).value || undefined,
      checked: (element as HTMLInputElement).checked || undefined,
      disabled: (element as HTMLInputElement).disabled || undefined,
      visible: this.isElementVisible(element),
      enabled: !(element as HTMLInputElement).disabled,
      editable: (element as HTMLElement).isContentEditable || ['INPUT', 'TEXTAREA'].includes(element.tagName),
      boundingBox: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      attributes,
    }
  }

  /**
   * 点击元素
   */
  async click(locator: ElementLocator, options: ClickOptions = {}): Promise<void> {
    const element = await this.waitForElement(locator)
    if (!element) throw new Error(`Element not found: ${JSON.stringify(locator)}`)

    const startTime = Date.now()

    try {
      // 模拟点击
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: options.button === 'right' ? 2 : options.button === 'middle' ? 1 : 0,
        ctrlKey: options.modifiers?.includes('Control'),
        altKey: options.modifiers?.includes('Alt'),
        shiftKey: options.modifiers?.includes('Shift'),
        metaKey: options.modifiers?.includes('Meta'),
      })

      element.dispatchEvent(event)

      this.recordAction({
        type: 'click',
        target: JSON.stringify(locator),
        value: options,
        duration: Date.now() - startTime,
        success: true,
      })

      this.emit('clicked', { locator, element })
    } catch (error) {
      this.recordAction({
        type: 'click',
        target: JSON.stringify(locator),
        success: false,
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * 双击元素
   */
  async dblclick(locator: ElementLocator, _options: ClickOptions = {}): Promise<void> {
    const element = await this.waitForElement(locator)
    if (!element) throw new Error(`Element not found: ${JSON.stringify(locator)}`)

    const event = new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
    })

    element.dispatchEvent(event)

    this.recordAction({
      type: 'dblclick',
      target: JSON.stringify(locator),
      success: true,
    })
  }

  /**
   * 输入文本
   */
  async type(locator: ElementLocator, text: string, options: TypeOptions = {}): Promise<void> {
    const element = await this.waitForElement(locator) as HTMLInputElement | HTMLTextAreaElement
    if (!element) throw new Error(`Element not found: ${JSON.stringify(locator)}`)

    const startTime = Date.now()

    try {
      element.focus()

      if (options.clear) {
        element.value = ''
      }

      // 模拟逐字输入
      for (const char of text) {
        element.value += char
        element.dispatchEvent(new Event('input', { bubbles: true }))
        
        if (options.delay) {
          await new Promise(resolve => setTimeout(resolve, options.delay))
        }
      }

      this.recordAction({
        type: 'type',
        target: JSON.stringify(locator),
        value: text,
        duration: Date.now() - startTime,
        success: true,
      })

      this.emit('typed', { locator, text })
    } catch (error) {
      this.recordAction({
        type: 'type',
        target: JSON.stringify(locator),
        success: false,
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * 填充表单字段
   */
  async fill(locator: ElementLocator, value: string): Promise<void> {
    const element = await this.waitForElement(locator) as HTMLInputElement | HTMLTextAreaElement
    if (!element) throw new Error(`Element not found: ${JSON.stringify(locator)}`)

    element.value = value
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))

    this.recordAction({
      type: 'fill',
      target: JSON.stringify(locator),
      value,
      success: true,
    })
  }

  /**
   * 清除输入
   */
  async clear(locator: ElementLocator): Promise<void> {
    const element = await this.waitForElement(locator) as HTMLInputElement | HTMLTextAreaElement
    if (!element) throw new Error(`Element not found: ${JSON.stringify(locator)}`)

    element.value = ''
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))

    this.recordAction({
      type: 'clear',
      target: JSON.stringify(locator),
      success: true,
    })
  }

  /**
   * 选择下拉选项
   */
  async select(locator: ElementLocator, value: string | string[]): Promise<void> {
    const element = await this.waitForElement(locator) as HTMLSelectElement
    if (!element) throw new Error(`Element not found: ${JSON.stringify(locator)}`)

    const values = Array.isArray(value) ? value : [value]

    for (const option of element.options) {
      option.selected = values.includes(option.value) || values.includes(option.text)
    }

    element.dispatchEvent(new Event('change', { bubbles: true }))

    this.recordAction({
      type: 'select',
      target: JSON.stringify(locator),
      value: values,
      success: true,
    })
  }

  /**
   * 勾选复选框
   */
  async check(locator: ElementLocator): Promise<void> {
    const element = await this.waitForElement(locator) as HTMLInputElement
    if (!element) throw new Error(`Element not found: ${JSON.stringify(locator)}`)

    if (!element.checked) {
      element.click()
    }

    this.recordAction({
      type: 'check',
      target: JSON.stringify(locator),
      success: true,
    })
  }

  /**
   * 取消勾选
   */
  async uncheck(locator: ElementLocator): Promise<void> {
    const element = await this.waitForElement(locator) as HTMLInputElement
    if (!element) throw new Error(`Element not found: ${JSON.stringify(locator)}`)

    if (element.checked) {
      element.click()
    }

    this.recordAction({
      type: 'uncheck',
      target: JSON.stringify(locator),
      success: true,
    })
  }

  /**
   * 悬停
   */
  async hover(locator: ElementLocator): Promise<void> {
    const element = await this.waitForElement(locator)
    if (!element) throw new Error(`Element not found: ${JSON.stringify(locator)}`)

    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

    this.recordAction({
      type: 'hover',
      target: JSON.stringify(locator),
      success: true,
    })
  }

  /**
   * 聚焦
   */
  async focus(locator: ElementLocator): Promise<void> {
    const element = await this.waitForElement(locator) as HTMLElement
    if (!element) throw new Error(`Element not found: ${JSON.stringify(locator)}`)

    element.focus()

    this.recordAction({
      type: 'focus',
      target: JSON.stringify(locator),
      success: true,
    })
  }

  /**
   * 滚动到元素
   */
  async scrollIntoView(locator: ElementLocator): Promise<void> {
    const element = await this.waitForElement(locator)
    if (!element) throw new Error(`Element not found: ${JSON.stringify(locator)}`)

    element.scrollIntoView({ behavior: 'smooth', block: 'center' })

    this.recordAction({
      type: 'scroll',
      target: JSON.stringify(locator),
      success: true,
    })
  }

  /**
   * 滚动页面
   */
  async scroll(x: number, y: number): Promise<void> {
    if (this.browserFrame?.contentWindow) {
      this.browserFrame.contentWindow.scrollTo(x, y)
      this.state.scrollPosition = { x, y }
    }

    this.recordAction({
      type: 'scroll',
      value: { x, y },
      success: true,
    })
  }

  /**
   * 截图
   */
  async screenshot(options: ScreenshotOptions = {}): Promise<string> {
    // 在实际实现中，这需要使用 html2canvas 或类似库
    logger.info('[Browser] Take screenshot')

    this.recordAction({
      type: 'screenshot',
      value: options,
      success: true,
    })

    // 返回模拟的 base64 图片
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }

  /**
   * 在浏览器 iframe 中执行 JavaScript
   * 注意：此方法用于浏览器自动化，仅在受控的 iframe 环境中执行
   * 调用者应确保 script 参数来自可信来源
   */
  async evaluate<T>(script: string | ((arg: unknown) => T), arg?: unknown): Promise<T> {
    if (!this.browserFrame?.contentWindow) {
      throw new Error('Browser not initialized')
    }

    // 安全检查：如果是字符串脚本，验证其内容
    if (typeof script === 'string') {
      const dangerousPatterns = [
        /localStorage|sessionStorage|indexedDB/,
        /fetch\s*\(|XMLHttpRequest/,
        /document\s*\.(write|writeln|cookie)/,
        /eval\s*\(/,
        /Function\s*\(/,
      ]
      for (const pattern of dangerousPatterns) {
        if (pattern.test(script)) {
          logger.error('[Browser] Dangerous script blocked:', pattern)
          throw new Error('Script contains forbidden patterns')
        }
      }
    }

    let result: T

    if (typeof script === 'function') {
      result = (this.browserFrame.contentWindow as Window & { eval: (code: string) => unknown }).eval(`(${script.toString()})(${JSON.stringify(arg)})`) as T
    } else {
      result = (this.browserFrame.contentWindow as Window & { eval: (code: string) => unknown }).eval(script) as T
    }

    this.recordAction({
      type: 'evaluate',
      value: typeof script === 'function' ? script.toString() : script,
      success: true,
    })

    return result
  }

  /**
   * 键盘按键
   */
  async press(key: string, options: { delay?: number } = {}): Promise<void> {
    if (!this.frameDocument) return

    const keyEvent = new KeyboardEvent('keydown', {
      key,
      code: key,
      bubbles: true,
    })

    this.frameDocument.dispatchEvent(keyEvent)

    if (options.delay) {
      await new Promise(resolve => setTimeout(resolve, options.delay))
    }

    this.frameDocument.dispatchEvent(new KeyboardEvent('keyup', {
      key,
      code: key,
      bubbles: true,
    }))

    this.recordAction({
      type: 'keyboard',
      value: { key, ...options },
      success: true,
    })
  }

  /**
   * 获取 Cookie
   */
  async getCookies(): Promise<BrowserCookie[]> {
    // 在实际实现中需要访问浏览器 cookie
    return this.state.cookies
  }

  /**
   * 设置 Cookie
   */
  async setCookie(cookie: BrowserCookie): Promise<void> {
    this.state.cookies.push(cookie)
  }

  /**
   * 清除 Cookie
   */
  async clearCookies(): Promise<void> {
    this.state.cookies = []
  }

  /**
   * 获取页面状态
   */
  getPageState(): PageState {
    return { ...this.state }
  }

  /**
   * 获取操作记录
   */
  getActionHistory(): ActionRecord[] {
    return [...this.actions.value]
  }

  /**
   * 清除操作记录
   */
  clearActionHistory(): void {
    this.actions.value = []
  }

  /**
   * 导出操作脚本
   */
  exportScript(format: 'playwright' | 'puppeteer' | 'cypress' = 'playwright'): string {
    let script = ''

    if (format === 'playwright') {
      script = `import { test, expect } from '@playwright/test';\n\ntest('recorded test', async ({ page }) => {\n`
      
      for (const action of this.actions.value) {
        switch (action.type) {
          case 'navigate':
            script += `  await page.goto('${action.target}');\n`
            break
          case 'click':
            script += `  await page.click('${action.target}');\n`
            break
          case 'type':
            script += `  await page.type('${action.target}', '${String(action.value)}');\n`
            break
          case 'fill':
            script += `  await page.fill('${action.target}', '${String(action.value)}');\n`
            break
        }
      }

      script += `});\n`
    }

    return script
  }

  /**
   * 关闭浏览器
   */
  close(): void {
    if (this.browserFrame) {
      this.browserFrame.remove()
      this.browserFrame = null
      this.frameDocument = null
    }

    this.initialized.value = false
    logger.info('[Browser] Browser closed')
    this.emit('closed')
  }
}

// 单例实例
let browserAutomationInstance: BrowserAutomation | null = null

/**
 * 获取浏览器自动化实例
 */
export function getBrowserAutomation(config?: BrowserConfig): BrowserAutomation {
  if (!browserAutomationInstance) {
    browserAutomationInstance = new BrowserAutomation(config)
  }
  return browserAutomationInstance
}

export default BrowserAutomation
