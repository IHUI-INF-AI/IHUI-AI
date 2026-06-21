import { t } from '@/utils/i18n'

/**
 * OpenClaw Canvas System (A2UI)
 * 
 * 交互式画布系统:
 * - 动态视觉工作区
 * - A2UI (AI to UI) 框架
 * - JavaScript 执行环境
 * - 状态捕获和恢复
 * - 实时协作
 * 
 * 参考: https://docs.clawd.bot/canvas
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * 画布配置
 */
export interface CanvasConfig {
  /** 画布宽度 */
  width?: number
  /** 画布高度 */
  height?: number
  /** 背景颜色 */
  backgroundColor?: string
  /** 是否启用沙箱 */
  sandboxed?: boolean
  /** 最大历史记录 */
  maxHistory?: number
  /** 自动保存间隔 */
  autoSaveInterval?: number
  /** 是否启用协作 */
  collaborative?: boolean
}

/**
 * 画布元素
 */
export interface CanvasElement {
  id: string
  type: CanvasElementType
  x: number
  y: number
  width?: number
  height?: number
  rotation?: number
  opacity?: number
  zIndex: number
  locked?: boolean
  visible?: boolean
  data: CanvasElementData
  style?: Record<string, string | number>
  events?: Record<string, string>
  children?: CanvasElement[]
}

/**
 * 元素类型
 */
export type CanvasElementType =
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'image'
  | 'line'
  | 'path'
  | 'group'
  | 'iframe'
  | 'html'
  | 'chart'
  | 'video'
  | 'audio'
  | 'code'
  | 'markdown'
  | 'widget'
  | 'custom'

/**
 * 元素数据
 */
export interface CanvasElementData {
  // 通用
  content?: string
  src?: string
  alt?: string
  
  // 形状
  fill?: string
  stroke?: string
  strokeWidth?: number
  radius?: number
  
  // 文本
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  
  // 路径
  points?: Array<{ x: number; y: number }>
  d?: string
  
  // 代码
  code?: string
  language?: string
  
  // 图表
  chartType?: string
  chartData?: Record<string, unknown>
  chartOptions?: Record<string, unknown>

  // HTML/Widget
  html?: string
  component?: string
  props?: Record<string, unknown>

  // 自定义
  [key: string]: unknown
}

/**
 * 画布状态
 */
export interface CanvasState {
  version: string
  elements: CanvasElement[]
  viewport: {
    x: number
    y: number
    zoom: number
  }
  selection: string[]
  metadata: Record<string, unknown>
}

/**
 * 画布动作
 */
export interface CanvasAction {
  id: string
  type: CanvasActionType
  timestamp: number
  data: unknown
  undoData?: unknown
}

/**
 * 动作类型
 */
export type CanvasActionType =
  | 'add'
  | 'remove'
  | 'update'
  | 'move'
  | 'resize'
  | 'rotate'
  | 'group'
  | 'ungroup'
  | 'reorder'
  | 'style'
  | 'viewport'
  | 'clear'
  | 'import'
  | 'execute'

/**
 * A2UI 指令
 */
export interface A2UICommand {
  action: 'push' | 'reset' | 'update' | 'execute' | 'capture' | 'animate'
  target?: string
  payload: unknown
}

/**
 * 禁止的代码模式（用于安全验证）
 */
const FORBIDDEN_PATTERNS = [
  /import\s*\(/,                    // 动态 import
  /eval\s*\(/,                       // eval 调用
  /Function\s*\(/,                    // Function 构造函数
  /\brequire\s*\(/,                  // require 调用
  /document\s*\./,                   // DOM 操作
  /window\s*\.(?!addEventListener|removeEventListener|postMessage|atob|btoa)/,  // 危险的 window 方法
  /\.\s*__/,                         // 私有属性访问
  /<\/?[a-z]+[^>]*>/i,               // HTML 标签
  /javascript\s*:/i,                  // JavaScript 协议
  /data\s*:/,                        // Data URI
  /expression\s*\(/,                 // CSS expression
  /url\s*\(/,                        // CSS url()
  /\breturn\b/,                      // return 语句（可能导致注入）
  /\bawait\b/,                       // await（异步注入）
  /\byield\b/,                       // yield（生成器注入）
]

/**
 * 验证代码安全性
 * @param code 需要验证的代码
 * @param allowGlobals 是否允许使用全局变量
 * @returns 是否安全
 */
function validateCodeSecurity(code: string, allowGlobals = true): { safe: boolean; reason?: string } {
  // 基础长度检查
  if (!code || code.trim().length === 0) {
    return { safe: false, reason: 'Code is empty' }
  }
  
  if (code.length > 10000) {
    return { safe: false, reason: 'Code is too long (max 10000 characters)' }
  }
  
  // 检查禁止的模式
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      return { safe: false, reason: `Code contains forbidden pattern: ${pattern.toString()}` }
    }
  }
  
  // 检查可疑的字符序列
  const suspiciousSequences = [
    /\}\s*\{/,                        // 对象后紧跟对象（可能注入）
    /\)\s*\(/,                        // 函数调用链
    /;\s*;/,                          // 双分号
    /\\x/,                           // 十六进制转义
    /\\u\{/,                         // Unicode 转义
  ]
  
  for (const seq of suspiciousSequences) {
    if (seq.test(code)) {
      return { safe: false, reason: 'Code contains suspicious sequences' }
    }
  }
  
  // 如果不允许全局变量，检查危险全局变量
  if (!allowGlobals) {
    const dangerousGlobals = [
      'localStorage', 'sessionStorage', 'indexedDB',
      'fetch', 'XMLHttpRequest', 'WebSocket',
      'eval', 'Function', 'setTimeout', 'setInterval',
      'open', 'opener', 'parent', 'top',
    ]
    
    for (const global of dangerousGlobals) {
      const pattern = new RegExp(`\\b${global}\\b`)
      if (pattern.test(code)) {
        return { safe: false, reason: `Code references dangerous global: ${global}` }
      }
    }
  }
  
  return { safe: true }
}

/**
 * 创建安全的函数执行上下文
 * 使用 Proxy 限制可以访问的属性
 */
function createSafeExecutionContext(context: Record<string, unknown> = {}): Record<string, unknown> {
  const allowedGlobals = {
    console: {
      log: (...args: unknown[]) => logger.debug('[Canvas Safe]', ...args),
      warn: (...args: unknown[]) => logger.warn('[Canvas Safe]', ...args),
      error: (...args: unknown[]) => logger.error('[Canvas Safe]', ...args),
      info: (...args: unknown[]) => logger.info('[Canvas Safe]', ...args),
    },
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    ...context,
  }
  
  return new Proxy(allowedGlobals as Record<string, unknown>, {
    get(target, prop) {
      if (prop in target) {
        return (target as Record<string | symbol, unknown>)[prop]
      }
      return undefined
    },
    set() {
      console.warn('[Canvas Safe] Cannot modify context')
      return false
    },
    has() {
      return true
    },
  })
}

/**
 * 画布管理器
 */
export class CanvasManager extends EventEmitter {
  private config: Required<CanvasConfig>
  private state = reactive<CanvasState>({
    version: '1.0.0',
    elements: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selection: [],
    metadata: {},
  })
  
  private history = ref<CanvasAction[]>([])
  private historyIndex = ref(-1)
  private initialized = ref(false)
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null
  
  // 沙箱环境
  private sandboxFrame: HTMLIFrameElement | null = null
  private sandboxOrigin = ''

  constructor(config: CanvasConfig = {}) {
    super()
    this.config = {
      width: config.width || 1920,
      height: config.height || 1080,
      backgroundColor: config.backgroundColor || 'var(--el-bg-color)',
      sandboxed: config.sandboxed ?? true,
      maxHistory: config.maxHistory || 100,
      autoSaveInterval: config.autoSaveInterval || 30000,
      collaborative: config.collaborative ?? false,
    }
  }

  /**
   * 初始化画布
   */
  async initialize(container?: HTMLElement): Promise<void> {
    if (this.initialized.value) return

    logger.info('[Canvas] Initializing canvas system...')

    // 创建沙箱环境
    if (this.config.sandboxed && container) {
      await this.createSandbox(container)
    }

    // 加载保存的状态
    await this.loadState()

    // 启动自动保存
    if (this.config.autoSaveInterval > 0) {
      this.startAutoSave()
    }

    this.initialized.value = true
    logger.info('[Canvas] Canvas system initialized')
    this.emit('initialized')
  }

  /**
   * 创建沙箱环境
   */
  private async createSandbox(container: HTMLElement): Promise<void> {
    this.sandboxFrame = document.createElement('iframe')
    this.sandboxFrame.sandbox.add('allow-scripts')
    this.sandboxFrame.style.width = '100%'
    this.sandboxFrame.style.height = '100%'
    this.sandboxFrame.style.border = 'none'
    
    const sandboxHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { overflow: hidden; }
          #canvas-root { 
            width: 100%; 
            height: 100vh; 
            background: ${this.config.backgroundColor};
            position: relative;
          }
          .canvas-element {
            position: absolute;
            pointer-events: auto;
          }
        </style>
      </head>
      <body>
        <div id="canvas-root"></div>
        <script>
          window.addEventListener('message', (event) => {
            try {
              const { type, payload } = event.data
              if (type === 'render') renderElements(payload)
              if (type === 'execute') executeCode(payload)
              if (type === 'capture') captureState()
            } catch (e) {
              parent.postMessage({ type: 'error', error: e.message }, '*')
            }
          })
          
          function renderElements(elements) {
            const root = document.getElementById('canvas-root')
            root.innerHTML = ''
            elements.forEach(el => {
              const dom = createElementDOM(el)
              if (dom) root.appendChild(dom)
            })
            parent.postMessage({ type: 'rendered' }, '*')
          }
          
          function createElementDOM(el) {
            const div = document.createElement('div')
            div.id = el.id
            div.className = 'canvas-element'
            div.style.left = el.x + 'px'
            div.style.top = el.y + 'px'
            if (el.width) div.style.width = el.width + 'px'
            if (el.height) div.style.height = el.height + 'px'
            if (el.rotation) div.style.transform = 'rotate(' + el.rotation + 'deg)'
            if (el.opacity !== undefined) div.style.opacity = el.opacity
            div.style.zIndex = el.zIndex || 0
            
            // 沙箱内简单 HTML 清理
            function _sanitize(html) {
              if (typeof html !== 'string') return ''
              const dangerousTags = /<(script|iframe|object|embed|form|input|button|style|link|meta|base|applet|frameset|frame)\\b[^>]*>([\\s\\S]*?)<\\/\\1>/gi
              const dangerousSelfClose = /<(script|iframe|object|embed|form|input|button|style|link|meta|base|applet|frameset|frame)\\b[^>]*\\/?>/gi
              const eventAttrs = /\\s+on[a-z]+\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)/gi
              const jsProtocol = /(?:href|src|action|formaction)\\s*=\\s*("javascript:[^"]*"|'javascript:[^']*')/gi
              return html.replace(dangerousTags, '').replace(dangerousSelfClose, '').replace(eventAttrs, '').replace(jsProtocol, '')
            }

            // 根据类型渲染内容
            switch (el.type) {
              case 'text':
                div.textContent = el.data.text || ''
                Object.assign(div.style, {
                  fontSize: (el.data.fontSize || 16) + 'px',
                  fontFamily: el.data.fontFamily || 'sans-serif',
                  color: el.data.fill || 'var(--el-text-color-primary)',
                  textAlign: el.data.textAlign || 'left',
                })
                break
              case 'rectangle':
                Object.assign(div.style, {
                  backgroundColor: el.data.fill || 'transparent',
                  border: (el.data.strokeWidth || 1) + 'px solid ' + (el.data.stroke || 'var(--el-text-color-primary)'),
                  borderRadius: (el.data.radius || 0) + 'px',
                })
                break
              case 'image':
                const img = document.createElement('img')
                img.src = el.data.src || ''
                img.alt = el.data.alt || ''
                img.style.width = '100%'
                img.style.height = '100%'
                img.style.objectFit = 'contain'
                div.appendChild(img)
                break
              case 'html':
                div.innerHTML = _sanitize(el.data.html || '')
                break
              case 'code':
                const pre = document.createElement('pre')
                const code = document.createElement('code')
                code.textContent = el.data.code || ''
                pre.appendChild(code)
                div.appendChild(pre)
                break
              case 'markdown':
                div.innerHTML = _sanitize(el.data.content || '')
                break
            }
            
            // 应用自定义样式
            if (el.style) {
              Object.entries(el.style).forEach(([key, value]) => {
                div.style[key] = value
              })
            }
            
            return div
          }
          
          function executeCode(code) {
            try {
              // 安全验证
              const forbiddenPatterns = [
                /import\\s*\\(/, /eval\\s*\\(/, /Function\\s*\\(/, /\\brequire\\s*\\(/,
                /document\\s*\\./, /window\\s*\\./, /localStorage\\s*\\./, /sessionStorage\\s*\\./,
                /fetch\\s*\\(/, /XMLHttpRequest/, /setTimeout\\s*\\(/, /setInterval\\s*\\(/,
                /<\\/?[a-z]+[^>]*>/i, /javascript\\s*:/i, /data\\s*:/i,
              ]
              for (const pattern of forbiddenPatterns) {
                if (pattern.test(code)) {
                  parent.postMessage({ type: 'executeError', error: 'Code contains forbidden pattern' }, '*')
                  return
                }
              }
              const result = (new Function('"use strict"; return (function() { ' + code + ' })()'))()
              parent.postMessage({ type: 'executeResult', result }, '*')
            } catch (e) {
              parent.postMessage({ type: 'executeError', error: e.message }, '*')
            }
          }
          
          function captureState() {
            const root = document.getElementById('canvas-root')
            parent.postMessage({ 
              type: 'captured', 
              html: root.innerHTML,
              screenshot: null // 实际实现需要 html2canvas
            }, '*')
          }
        </script>
      </body>
      </html>
    `

    this.sandboxFrame.srcdoc = sandboxHtml
    container.appendChild(this.sandboxFrame)

    // 等待沙箱加载
    await new Promise<void>((resolve) => {
      this.sandboxFrame!.onload = () => resolve()
    })

    // 监听沙箱消息
    window.addEventListener('message', this.handleSandboxMessage.bind(this))
  }

  /**
   * 处理沙箱消息
   */
  private handleSandboxMessage(event: MessageEvent): void {
    const { type, ...data } = event.data

    switch (type) {
      case 'rendered':
        this.emit('rendered')
        break
      case 'executeResult':
        this.emit('executeResult', data.result)
        break
      case 'executeError':
        this.emit('executeError', data.error)
        break
      case 'captured':
        this.emit('captured', data)
        break
      case 'error':
        logger.error('[Canvas] Sandbox error:', data.error)
        this.emit('error', data.error)
        break
    }
  }

  /**
   * 发送消息到沙箱
   */
  private postToSandbox(type: string, payload: unknown): void {
    if (this.sandboxFrame?.contentWindow) {
      this.sandboxFrame.contentWindow.postMessage({ type, payload }, '*')
    }
  }

  /**
   * 加载状态
   */
  private async loadState(): Promise<void> {
    const savedState = localStorage.getItem('openclaw_canvas_state')
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        Object.assign(this.state, parsed)
        logger.info(`[Canvas] Loaded ${this.state.elements.length} elements`)
      } catch (error) {
        logger.error('[Canvas] Failed to load state:', error)
      }
    }
  }

  /**
   * 保存状态
   */
  private saveState(): void {
    localStorage.setItem('openclaw_canvas_state', JSON.stringify(this.state))
  }

  /**
   * 启动自动保存
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      this.saveState()
    }, this.config.autoSaveInterval)
  }

  /**
   * 记录动作（用于撤销/重做）
   */
  private recordAction(action: Omit<CanvasAction, 'id' | 'timestamp'>): void {
    const fullAction: CanvasAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    }

    // 如果在历史中间，删除后面的记录
    if (this.historyIndex.value < this.history.value.length - 1) {
      this.history.value = this.history.value.slice(0, this.historyIndex.value + 1)
    }

    this.history.value.push(fullAction)

    // 限制历史记录数量
    if (this.history.value.length > this.config.maxHistory) {
      this.history.value.shift()
    } else {
      this.historyIndex.value++
    }
  }

  /**
   * 添加元素
   */
  addElement(element: Partial<CanvasElement> & { type: CanvasElementType }): CanvasElement {
    const newElement: CanvasElement = {
      id: element.id || `el_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: element.type,
      x: element.x || 0,
      y: element.y || 0,
      width: element.width,
      height: element.height,
      rotation: element.rotation || 0,
      opacity: element.opacity ?? 1,
      zIndex: element.zIndex || this.state.elements.length,
      locked: element.locked || false,
      visible: element.visible ?? true,
      data: element.data || {},
      style: element.style,
      events: element.events,
      children: element.children,
    }

    this.state.elements.push(newElement)

    this.recordAction({
      type: 'add',
      data: newElement,
      undoData: newElement.id,
    })

    this.render()
    this.emit('elementAdded', newElement)

    return newElement
  }

  /**
   * 删除元素
   */
  removeElement(id: string): boolean {
    const index = this.state.elements.findIndex(el => el.id === id)
    if (index === -1) return false

    const removed = this.state.elements.splice(index, 1)[0]

    this.recordAction({
      type: 'remove',
      data: id,
      undoData: removed,
    })

    this.render()
    this.emit('elementRemoved', id)

    return true
  }

  /**
   * 更新元素
   */
  updateElement(id: string, updates: Partial<CanvasElement>): CanvasElement | null {
    const element = this.state.elements.find(el => el.id === id)
    if (!element) return null

    const oldData = { ...element }

    Object.assign(element, updates, { id }) // 保持 ID 不变

    this.recordAction({
      type: 'update',
      data: { id, updates },
      undoData: oldData,
    })

    this.render()
    this.emit('elementUpdated', element)

    return element
  }

  /**
   * 获取元素
   */
  getElement(id: string): CanvasElement | undefined {
    return this.state.elements.find(el => el.id === id)
  }

  /**
   * 获取所有元素
   */
  getAllElements(): CanvasElement[] {
    return [...this.state.elements]
  }

  /**
   * 选择元素
   */
  selectElements(ids: string[]): void {
    this.state.selection = ids
    this.emit('selectionChanged', ids)
  }

  /**
   * 清除选择
   */
  clearSelection(): void {
    this.state.selection = []
    this.emit('selectionChanged', [])
  }

  /**
   * 移动元素
   */
  moveElement(id: string, x: number, y: number): void {
    this.updateElement(id, { x, y })
  }

  /**
   * 调整元素大小
   */
  resizeElement(id: string, width: number, height: number): void {
    this.updateElement(id, { width, height })
  }

  /**
   * 旋转元素
   */
  rotateElement(id: string, rotation: number): void {
    this.updateElement(id, { rotation })
  }

  /**
   * 分组元素
   */
  groupElements(ids: string[]): CanvasElement {
    const elements = this.state.elements.filter(el => ids.includes(el.id))
    if (elements.length === 0) throw new Error(t('error.index.没有找到要分组的'))

    // 计算边界框
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    for (const el of elements) {
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + (el.width || 0))
      maxY = Math.max(maxY, el.y + (el.height || 0))
    }

    // 移除原元素
    for (const id of ids) {
      const index = this.state.elements.findIndex(el => el.id === id)
      if (index !== -1) this.state.elements.splice(index, 1)
    }

    // 创建分组
    const group = this.addElement({
      type: 'group',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      children: elements.map(el => ({
        ...el,
        x: el.x - minX,
        y: el.y - minY,
      })),
      data: {},
    })

    this.emit('elementsGrouped', { groupId: group.id, elementIds: ids })

    return group
  }

  /**
   * 取消分组
   */
  ungroupElement(groupId: string): CanvasElement[] {
    const group = this.getElement(groupId)
    if (!group || group.type !== 'group' || !group.children) {
      throw new Error(t('error.index.无效的分组元素1'))
    }

    // 移除分组
    this.removeElement(groupId)

    // 恢复子元素
    const restored: CanvasElement[] = []
    for (const child of group.children) {
      const element = this.addElement({
        ...child,
        x: child.x + group.x,
        y: child.y + group.y,
      })
      restored.push(element)
    }

    this.emit('elementsUngrouped', { groupId, elements: restored })

    return restored
  }

  /**
   * 渲染画布
   */
  render(): void {
    if (this.config.sandboxed) {
      this.postToSandbox('render', this.state.elements.filter(el => el.visible))
    }
    this.emit('render', this.state.elements)
  }

  /**
   * 执行 JavaScript 代码
   * @param code 要执行的代码
   * @param context 执行上下文（可选）
   * @param allowGlobals 是否允许访问危险全局变量
   */
  async executeCode(
    code: string,
    context: Record<string, unknown> = {},
    allowGlobals = false
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // 安全验证
      const validation = validateCodeSecurity(code, allowGlobals)
      if (!validation.safe) {
        logger.warn('[Canvas] Code execution blocked:', validation.reason)
        reject(new Error(`Code execution blocked: ${validation.reason}`))
        return
      }
      
      if (this.config.sandboxed) {
        const handleResult = (event: MessageEvent) => {
          if (event.data.type === 'executeResult') {
            window.removeEventListener('message', handleResult)
            resolve(event.data.result)
          } else if (event.data.type === 'executeError') {
            window.removeEventListener('message', handleResult)
            reject(new Error(event.data.error))
          }
        }
        window.addEventListener('message', handleResult)
        this.postToSandbox('execute', code)
      } else {
        // 非沙箱模式：使用受限制的上下文执行
        try {
          const safeContext = createSafeExecutionContext(context)
          const _contextKeys = Object.keys(safeContext)
          const _contextValues = Object.values(safeContext)
          
          // 使用安全的函数包装
          const wrappedCode = `
            "use strict";
            with (arguments[0]) {
              return (function() { ${code} })();
            }
          `
          const fn = new Function(wrappedCode)
          const result = fn(safeContext)
          resolve(result)
        } catch (error) {
          logger.error('[Canvas] Code execution error:', error)
          reject(error)
        }
      }
    })
  }

  /**
   * 捕获画布状态/截图
   */
  async capture(): Promise<{ html: string; screenshot: string | null }> {
    return new Promise((resolve) => {
      if (this.config.sandboxed) {
        const handleCapture = (event: MessageEvent) => {
          if (event.data.type === 'captured') {
            window.removeEventListener('message', handleCapture)
            resolve(event.data)
          }
        }
        window.addEventListener('message', handleCapture)
        this.postToSandbox('capture', null)
      } else {
        resolve({ html: '', screenshot: null })
      }
    })
  }

  /**
   * A2UI 命令执行
   */
  async executeA2UICommand(command: A2UICommand): Promise<unknown> {
    logger.debug('[Canvas] A2UI command:', command)

    switch (command.action) {
      case 'push':
        // 添加或更新元素
        if (command.target) {
          return this.updateElement(command.target, command.payload as Partial<CanvasElement>)
        }
        return this.addElement(command.payload as CanvasElement)

      case 'reset':
        // 重置画布
        this.clear()
        if (command.payload) {
          const elements = command.payload as CanvasElement[]
          elements.forEach(el => this.addElement(el))
        }
        return true

      case 'update': {
        // 批量更新
        const updates = command.payload as Array<{ id: string; updates: Partial<CanvasElement> }>
        return updates.map(u => this.updateElement(u.id, u.updates))
      }

      case 'execute':
        // 执行代码
        return this.executeCode(command.payload as string)

      case 'capture':
        // 捕获状态
        return this.capture()

      case 'animate':
        // 动画（需要实现动画系统）
        this.emit('animate', command.payload)
        return true

      default:
        throw new Error(`未知的 A2UI 命令: ${command.action}`)
    }
  }

  /**
   * 撤销
   */
  undo(): boolean {
    if (this.historyIndex.value < 0) return false

    const action = this.history.value[this.historyIndex.value]
    this.historyIndex.value--

    // 执行撤销
    switch (action.type) {
      case 'add':
        this.state.elements = this.state.elements.filter(el => el.id !== action.undoData)
        break
      case 'remove':
        this.state.elements.push(action.undoData as CanvasElement)
        break
      case 'update': {
        const oldEl = this.state.elements.find(el => el.id === (action.undoData as CanvasElement).id)
        if (oldEl) Object.assign(oldEl, action.undoData)
        break
      }
    }

    this.render()
    this.emit('undo', action)

    return true
  }

  /**
   * 重做
   */
  redo(): boolean {
    if (this.historyIndex.value >= this.history.value.length - 1) return false

    this.historyIndex.value++
    const action = this.history.value[this.historyIndex.value]

    // 执行重做
    switch (action.type) {
      case 'add':
        this.state.elements.push(action.data as CanvasElement)
        break
      case 'remove':
        this.state.elements = this.state.elements.filter(el => el.id !== action.data)
        break
      case 'update': {
        const { id, updates } = action.data as { id: string; updates: Partial<CanvasElement> }
        const el = this.state.elements.find(e => e.id === id)
        if (el) Object.assign(el, updates)
        break
      }
    }

    this.render()
    this.emit('redo', action)

    return true
  }

  /**
   * 清空画布
   */
  clear(): void {
    const oldElements = [...this.state.elements]
    this.state.elements = []

    this.recordAction({
      type: 'clear',
      data: null,
      undoData: oldElements,
    })

    this.render()
    this.emit('cleared')
  }

  /**
   * 设置视口
   */
  setViewport(x: number, y: number, zoom?: number): void {
    this.state.viewport.x = x
    this.state.viewport.y = y
    if (zoom !== undefined) this.state.viewport.zoom = zoom

    this.emit('viewportChanged', this.state.viewport)
  }

  /**
   * 缩放
   */
  zoom(factor: number): void {
    this.state.viewport.zoom = Math.max(0.1, Math.min(5, this.state.viewport.zoom * factor))
    this.emit('viewportChanged', this.state.viewport)
  }

  /**
   * 导出为 JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.state, null, 2)
  }

  /**
   * 导入 JSON
   */
  importJSON(json: string): void {
    try {
      const imported = JSON.parse(json)
      Object.assign(this.state, imported)
      this.render()
      this.emit('imported')
    } catch (error) {
      logger.error('[Canvas] Failed to import JSON:', error)
      throw error
    }
  }

  /**
   * 导出为 SVG
   */
  exportSVG(): string {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.config.width}" height="${this.config.height}">\n`
    svg += `  <rect width="100%" height="100%" fill="${this.config.backgroundColor}"/>\n`

    for (const el of this.state.elements.filter(e => e.visible)) {
      svg += this.elementToSVG(el)
    }

    svg += '</svg>'
    return svg
  }

  /**
   * 元素转 SVG
   */
  private elementToSVG(el: CanvasElement): string {
    const transform = el.rotation ? ` transform="rotate(${el.rotation} ${el.x + (el.width || 0) / 2} ${el.y + (el.height || 0) / 2})"` : ''
    const opacity = el.opacity !== 1 ? ` opacity="${el.opacity}"` : ''

    switch (el.type) {
      case 'rectangle':
        return `  <rect x="${el.x}" y="${el.y}" width="${el.width || 100}" height="${el.height || 100}" fill="${el.data.fill || 'none'}" stroke="${el.data.stroke || 'black'}" stroke-width="${el.data.strokeWidth || 1}" rx="${el.data.radius || 0}"${transform}${opacity}/>\n`
      
      case 'circle': {
        const r = (el.width || 100) / 2
        return `  <circle cx="${el.x + r}" cy="${el.y + r}" r="${r}" fill="${el.data.fill || 'none'}" stroke="${el.data.stroke || 'black'}" stroke-width="${el.data.strokeWidth || 1}"${transform}${opacity}/>\n`
      }
      
      case 'text':
        return `  <text x="${el.x}" y="${el.y}" font-size="${el.data.fontSize || 16}" font-family="${el.data.fontFamily || 'sans-serif'}" fill="${el.data.fill || 'black'}"${transform}${opacity}>${el.data.text || ''}</text>\n`
      
      case 'line': {
        const points = el.data.points || []
        if (points.length < 2) return ''
        return `  <line x1="${points[0].x}" y1="${points[0].y}" x2="${points[1].x}" y2="${points[1].y}" stroke="${el.data.stroke || 'black'}" stroke-width="${el.data.strokeWidth || 1}"${opacity}/>\n`
      }
      
      case 'path':
        return `  <path d="${el.data.d || ''}" fill="${el.data.fill || 'none'}" stroke="${el.data.stroke || 'black'}" stroke-width="${el.data.strokeWidth || 1}"${transform}${opacity}/>\n`
      
      case 'image':
        return `  <image x="${el.x}" y="${el.y}" width="${el.width || 100}" height="${el.height || 100}" href="${el.data.src || ''}"${transform}${opacity}/>\n`
      
      default:
        return ''
    }
  }

  /**
   * 获取状态
   */
  getState(): CanvasState {
    return { ...this.state }
  }

  /**
   * 关闭画布
   */
  shutdown(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
    }

    this.saveState()

    if (this.sandboxFrame) {
      this.sandboxFrame.remove()
    }

    window.removeEventListener('message', this.handleSandboxMessage.bind(this))

    this.initialized.value = false
    logger.info('[Canvas] Canvas system shut down')
    this.emit('shutdown')
  }
}

// 单例实例
let canvasManagerInstance: CanvasManager | null = null

/**
 * 获取画布管理器实例
 */
export function getCanvasManager(config?: CanvasConfig): CanvasManager {
  if (!canvasManagerInstance) {
    canvasManagerInstance = new CanvasManager(config)
  }
  return canvasManagerInstance
}

export default CanvasManager
