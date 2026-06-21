import { t } from '@/utils/i18n'

/**
 * Clawdbot Tool System
 * 
 * 工具执行系统，支持:
 * - 浏览器自动化 (Puppeteer/Playwright)
 * - 文件系统操作
 * - Shell 命令执行
 * - API 调用
 * - 数据处理
 * - 邮件操作
 * - 日历管理
 * - 代码执行
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * 工具定义
 */
export interface ToolDefinition {
  /** 工具名称 */
  name: string
  /** 工具描述 */
  description: string
  /** 工具类别 */
  category: 'browser' | 'filesystem' | 'shell' | 'api' | 'data' | 'email' | 'calendar' | 'code' | 'custom'
  /** 参数定义 */
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
      default?: any
      required?: boolean
    }>
    required?: string[]
  }
  /** 是否危险操作 */
  dangerous?: boolean
  /** 需要确认 */
  requiresConfirmation?: boolean
  /** 超时时间 (ms) */
  timeout?: number
  /** 执行器函数 */
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolExecutionResult>
}

/**
 * 工具执行上下文
 */
export interface ToolContext {
  /** 用户 ID */
  userId: string
  /** 会话 ID */
  conversationId: string
  /** 消息 ID */
  messageId?: string
  /** 环境变量 */
  env: Record<string, string>
  /** 工作目录 */
  workingDirectory: string
  /** 取消信号 */
  signal?: AbortSignal
  /** 进度回调 */
  onProgress?: (progress: number, message?: string) => void
  /** 日志函数 */
  log: (level: 'info' | 'warn' | 'error', message: string) => void
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  /** 是否成功 */
  success: boolean
  /** 结果数据 */
  data?: any
  /** 错误信息 */
  error?: string
  /** 执行时间 (ms) */
  executionTime: number
  /** 输出内容 */
  output?: string
  /** 附件 */
  attachments?: Array<{
    type: 'file' | 'image' | 'screenshot' | 'data'
    name: string
    content: string | Blob
    mimeType?: string
  }>
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 浏览器工具接口
 */
export interface BrowserTool {
  /** 导航到 URL */
  navigate(url: string): Promise<void>
  /** 点击元素 */
  click(selector: string): Promise<void>
  /** 输入文本 */
  type(selector: string, text: string): Promise<void>
  /** 获取页面内容 */
  getContent(): Promise<string>
  /** 截图 */
  screenshot(options?: { fullPage?: boolean; selector?: string }): Promise<string>
  /** 等待元素 */
  waitForSelector(selector: string, timeout?: number): Promise<void>
  /** 执行 JavaScript */
  evaluate<T>(fn: string | (() => T)): Promise<T>
  /** 获取元素属性 */
  getAttribute(selector: string, attribute: string): Promise<string | null>
  /** 滚动页面 */
  scroll(direction: 'up' | 'down' | 'top' | 'bottom', amount?: number): Promise<void>
  /** 关闭浏览器 */
  close(): Promise<void>
}

/**
 * 文件系统工具接口
 */
export interface FileSystemTool {
  /** 读取文件 */
  readFile(path: string, encoding?: string): Promise<string>
  /** 写入文件 */
  writeFile(path: string, content: string): Promise<void>
  /** 追加文件 */
  appendFile(path: string, content: string): Promise<void>
  /** 删除文件 */
  deleteFile(path: string): Promise<void>
  /** 列出目录 */
  listDir(path: string): Promise<string[]>
  /** 创建目录 */
  createDir(path: string): Promise<void>
  /** 复制文件 */
  copyFile(src: string, dest: string): Promise<void>
  /** 移动文件 */
  moveFile(src: string, dest: string): Promise<void>
  /** 文件信息 */
  stat(path: string): Promise<{ size: number; isFile: boolean; isDirectory: boolean; mtime: Date }>
  /** 搜索文件 */
  search(pattern: string, directory?: string): Promise<string[]>
}

/**
 * Shell 工具接口
 */
export interface ShellTool {
  /** 执行命令 */
  exec(command: string, options?: { cwd?: string; timeout?: number; env?: Record<string, string> }): Promise<{ stdout: string; stderr: string; exitCode: number }>
  /** 执行脚本 */
  execScript(script: string, interpreter?: string): Promise<{ stdout: string; stderr: string; exitCode: number }>
}

/**
 * 内置浏览器工具实现
 */
class BrowserToolImpl implements BrowserTool {
  private iframe: HTMLIFrameElement | null = null
  private currentUrl = ''

  async navigate(url: string): Promise<void> {
    logger.info(`[BrowserTool] Navigate to: ${url}`)
    this.currentUrl = url
    
    // 在浏览器端，我们通过后端 API 或 MCP 来操作
    // 这里只是接口定义，实际执行通过后端
  }

  async click(selector: string): Promise<void> {
    logger.info(`[BrowserTool] Click: ${selector}`)
  }

  async type(selector: string, text: string): Promise<void> {
    logger.info(`[BrowserTool] Input: ${selector} -> ${text}`)
  }

  async getContent(): Promise<string> {
    return `<html>当前页面: ${this.currentUrl}</html>`
  }

  async screenshot(_options?: { fullPage?: boolean; selector?: string }): Promise<string> {
    logger.info('[BrowserTool] Take screenshot')
    return 'data:image/png;base64,...'
  }

  async waitForSelector(selector: string, timeout?: number): Promise<void> {
    logger.info(`[BrowserTool] Wait: ${timeout}ms`)
  }

  async evaluate<T>(fn: string | (() => T)): Promise<T> {
    logger.info(`[BrowserTool] Execute JS: ${typeof fn === 'string' ? fn : 'function'}`)
    return null as T
  }

  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    logger.info(`[BrowserTool] Get attribute: ${selector}[${attribute}]`)
    return null
  }

  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', amount?: number): Promise<void> {
    logger.info(`[BrowserTool] Scroll: ${direction}, ${amount}`)
  }

  async close(): Promise<void> {
    logger.info('[BrowserTool] Close browser')
    if (this.iframe) {
      this.iframe.remove()
      this.iframe = null
    }
  }
}

/**
 * 内置文件系统工具实现（通过后端 API）
 */
class FileSystemToolImpl implements FileSystemTool {
  private apiBase = '/api/tools/filesystem'

  async readFile(path: string, _encoding?: string): Promise<string> {
    logger.info(`[FileSystemTool] Read file: ${path}`)
    // 实际通过后端 API 调用
    return ''
  }

  async writeFile(path: string, content: string): Promise<void> {
    logger.info(`[FileSystemTool] Write file: ${path}, ${content.length} bytes`)
  }

  async appendFile(path: string, content: string): Promise<void> {
    logger.info(`[FileSystemTool] Append file: ${path}, ${content.length} bytes`)
  }

  async deleteFile(path: string): Promise<void> {
    logger.info(`[FileSystemTool] Delete file: ${path}`)
  }

  async listDir(path: string): Promise<string[]> {
    logger.info(`[FileSystemTool] List directory: ${path}`)
    return []
  }

  async createDir(path: string): Promise<void> {
    logger.info(`[FileSystemTool] Create directory: ${path}`)
  }

  async copyFile(src: string, dest: string): Promise<void> {
    logger.info(`[FileSystemTool] Copy file: ${src} -> ${dest}`)
  }

  async moveFile(src: string, dest: string): Promise<void> {
    logger.info(`[FileSystemTool] Move file: ${src} -> ${dest}`)
  }

  async stat(path: string): Promise<{ size: number; isFile: boolean; isDirectory: boolean; mtime: Date }> {
    logger.info(`[FileSystemTool] File info: ${path}`)
    return { size: 0, isFile: true, isDirectory: false, mtime: new Date() }
  }

  async search(pattern: string, directory?: string): Promise<string[]> {
    logger.info(`[FileSystemTool] Search: ${pattern} in ${directory || '.'}`)
    return []
  }
}

/**
 * 内置 Shell 工具实现（通过后端 API）
 */
class ShellToolImpl implements ShellTool {
  async exec(command: string, options?: { cwd?: string; timeout?: number; env?: Record<string, string> }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    logger.info(`[ShellTool] Execute command: ${command}`, options)
    // 实际通过后端 API 调用
    return { stdout: '', stderr: '', exitCode: 0 }
  }

  async execScript(script: string, interpreter?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    logger.info(`[ShellTool] Execute script: ${interpreter || 'bash'}`)
    return { stdout: '', stderr: '', exitCode: 0 }
  }
}

/**
 * 工具执行器
 */
export class ToolExecutor extends EventEmitter {
  private tools = reactive<Map<string, ToolDefinition>>(new Map())
  private executionHistory = ref<Array<{
    toolName: string
    params: Record<string, unknown>
    result: ToolExecutionResult
    timestamp: number
  }>>([])
  
  // 内置工具实例
  public browser: BrowserTool
  public filesystem: FileSystemTool
  public shell: ShellTool

  constructor() {
    super()
    this.browser = new BrowserToolImpl()
    this.filesystem = new FileSystemToolImpl()
    this.shell = new ShellToolImpl()
    
    // 注册内置工具
    this.registerBuiltinTools()
  }

  /**
   * 注册内置工具
   */
  private registerBuiltinTools(): void {
    // 浏览器导航
    this.registerTool({
      name: 'browser_navigate',
      description: t('text.index.导航到指定URL'),
      category: 'browser',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: t('text.index.要访问的URL1'), required: true },
        },
        required: ['url'],
      },
      execute: async (params) => {
        const startTime = Date.now()
        try {
          await this.browser.navigate(params.url as string)
          return {
            success: true,
            data: { url: params.url },
            executionTime: Date.now() - startTime,
            output: `已导航到 ${params.url}`,
          }
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
            executionTime: Date.now() - startTime,
          }
        }
      },
    })

    // 浏览器点击
    this.registerTool({
      name: 'browser_click',
      description: t('text.index.点击页面元素2'),
      category: 'browser',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: t('text.index.CSS选择器3'), required: true },
        },
        required: ['selector'],
      },
      execute: async (params) => {
        const startTime = Date.now()
        try {
          await this.browser.click(params.selector as string)
          return {
            success: true,
            executionTime: Date.now() - startTime,
            output: `已点击 ${params.selector}`,
          }
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
            executionTime: Date.now() - startTime,
          }
        }
      },
    })

    // 浏览器输入
    this.registerTool({
      name: 'browser_type',
      description: t('text.index.在元素中输入文本4'),
      category: 'browser',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: t('text.index.CSS选择器5'), required: true },
          text: { type: 'string', description: t('text.index.要输入的文本6'), required: true },
        },
        required: ['selector', 'text'],
      },
      execute: async (params) => {
        const startTime = Date.now()
        try {
          await this.browser.type(params.selector as string, params.text as string)
          return {
            success: true,
            executionTime: Date.now() - startTime,
            output: `已在 ${params.selector} 中输入文本`,
          }
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
            executionTime: Date.now() - startTime,
          }
        }
      },
    })

    // 浏览器截图
    this.registerTool({
      name: 'browser_screenshot',
      description: t('text.index.截取页面截图7'),
      category: 'browser',
      parameters: {
        type: 'object',
        properties: {
          fullPage: { type: 'boolean', description: t('text.index.是否截取整个页面8'), default: false },
          selector: { type: 'string', description: t('text.index.要截取的元素选择9') },
        },
      },
      execute: async (params) => {
        const startTime = Date.now()
        try {
          const screenshot = await this.browser.screenshot({
            fullPage: params.fullPage as boolean,
            selector: params.selector as string,
          })
          return {
            success: true,
            data: { screenshot },
            executionTime: Date.now() - startTime,
            attachments: [{
              type: 'screenshot',
              name: 'screenshot.png',
              content: screenshot,
              mimeType: 'image/png',
            }],
          }
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
            executionTime: Date.now() - startTime,
          }
        }
      },
    })

    // 读取文件
    this.registerTool({
      name: 'read_file',
      description: t('text.index.读取文件内容10'),
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: t('text.index.文件路径11'), required: true },
          encoding: { type: 'string', description: t('text.index.编码格式12'), default: 'utf-8' },
        },
        required: ['path'],
      },
      execute: async (params) => {
        const startTime = Date.now()
        try {
          const content = await this.filesystem.readFile(params.path as string, params.encoding as string)
          return {
            success: true,
            data: { content },
            executionTime: Date.now() - startTime,
            output: content,
          }
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
            executionTime: Date.now() - startTime,
          }
        }
      },
    })

    // 写入文件
    this.registerTool({
      name: 'write_file',
      description: t('text.index.写入文件内容13'),
      category: 'filesystem',
      dangerous: true,
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: t('text.index.文件路径14'), required: true },
          content: { type: 'string', description: t('text.index.文件内容15'), required: true },
        },
        required: ['path', 'content'],
      },
      execute: async (params) => {
        const startTime = Date.now()
        try {
          await this.filesystem.writeFile(params.path as string, params.content as string)
          return {
            success: true,
            executionTime: Date.now() - startTime,
            output: `已写入 ${(params.content as string).length} 字节到 ${params.path}`,
          }
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
            executionTime: Date.now() - startTime,
          }
        }
      },
    })

    // 列出目录
    this.registerTool({
      name: 'list_directory',
      description: t('text.index.列出目录内容16'),
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: t('text.index.目录路径17'), required: true },
        },
        required: ['path'],
      },
      execute: async (params) => {
        const startTime = Date.now()
        try {
          const files = await this.filesystem.listDir(params.path as string)
          return {
            success: true,
            data: { files },
            executionTime: Date.now() - startTime,
            output: files.join('\n'),
          }
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
            executionTime: Date.now() - startTime,
          }
        }
      },
    })

    // 执行命令
    this.registerTool({
      name: 'execute_command',
      description: t('text.index.执行Shell命18'),
      category: 'shell',
      dangerous: true,
      requiresConfirmation: true,
      timeout: 30000,
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: t('text.index.要执行的命令19'), required: true },
          cwd: { type: 'string', description: t('text.index.工作目录20') },
          timeout: { type: 'number', description: t('text.index.超时时间ms21'), default: 30000 },
        },
        required: ['command'],
      },
      execute: async (params) => {
        const startTime = Date.now()
        try {
          const result = await this.shell.exec(params.command as string, {
            cwd: params.cwd as string,
            timeout: params.timeout as number,
          })
          return {
            success: result.exitCode === 0,
            data: result,
            executionTime: Date.now() - startTime,
            output: result.stdout || result.stderr,
            metadata: { exitCode: result.exitCode },
          }
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
            executionTime: Date.now() - startTime,
          }
        }
      },
    })

    // 搜索文件
    this.registerTool({
      name: 'search_files',
      description: t('text.index.搜索文件22'),
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: t('text.index.搜索模式glob23'), required: true },
          directory: { type: 'string', description: t('text.index.搜索目录24'), default: '.' },
        },
        required: ['pattern'],
      },
      execute: async (params) => {
        const startTime = Date.now()
        try {
          const files = await this.filesystem.search(params.pattern as string, params.directory as string)
          return {
            success: true,
            data: { files, count: files.length },
            executionTime: Date.now() - startTime,
            output: `找到 ${files.length} 个文件:\n${files.join('\n')}`,
          }
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
            executionTime: Date.now() - startTime,
          }
        }
      },
    })

    // HTTP 请求
    this.registerTool({
      name: 'http_request',
      description: t('text.index.发送HTTP请求25'),
      category: 'api',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: t('text.index.请求URL26'), required: true },
          method: { type: 'string', description: t('text.index.HTTP方法27'), enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
          headers: { type: 'object', description: t('text.index.请求头28') },
          body: { type: 'string', description: t('text.index.请求体29') },
        },
        required: ['url'],
      },
      execute: async (params) => {
        const startTime = Date.now()
        try {
          const response = await fetch(params.url as string, {
            method: (params.method as string) || 'GET',
            headers: params.headers as HeadersInit,
            body: params.body as string,
          })
          const data = await response.text()
          return {
            success: response.ok,
            data: {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              body: data,
            },
            executionTime: Date.now() - startTime,
            output: data,
          }
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
            executionTime: Date.now() - startTime,
          }
        }
      },
    })

    // 等待
    this.registerTool({
      name: 'wait',
      description: t('text.index.等待指定时间30'),
      category: 'custom',
      parameters: {
        type: 'object',
        properties: {
          duration: { type: 'number', description: t('text.index.等待时间ms31'), required: true },
        },
        required: ['duration'],
      },
      execute: async (params) => {
        const startTime = Date.now()
        await new Promise(resolve => setTimeout(resolve, params.duration as number))
        return {
          success: true,
          executionTime: Date.now() - startTime,
          output: `等待了 ${params.duration}ms`,
        }
      },
    })

    // 注册扩展工具
    this.registerExtendedTools()
    
    logger.info(`[ToolExecutor] Registered tools）`)
  }

  /**
   * 注册扩展工具
   */
  private registerExtendedTools(): void {
    try {
      // 动态导入扩展工具以避免循环依赖
      import('./extended-tools').then(({ getExtendedTools }) => {
        const extendedTools = getExtendedTools()
        for (const tool of extendedTools) {
          this.registerTool(tool)
        }
        logger.info(`[ToolExecutor] Registered ${extendedTools.length} extended tools`)
      }).catch(err => {
        logger.warn('[ToolExecutor] Failed to load extended tools:', err)
      })
    } catch (error) {
      logger.warn('[ToolExecutor] Failed to register extended tools:', error)
    }
  }

  /**
   * 注册工具
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
    logger.debug(`[ToolExecutor] Register tool: ${tool.name}`)
  }

  /**
   * 注销工具
   */
  unregisterTool(name: string): void {
    this.tools.delete(name)
    logger.debug(`[ToolExecutor] Unregister tool: ${name}`)
  }

  /**
   * 获取工具
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /**
   * 获取所有工具
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /**
   * 按类别获取工具
   */
  getToolsByCategory(category: ToolDefinition['category']): ToolDefinition[] {
    return this.getAllTools().filter(t => t.category === category)
  }

  /**
   * 执行工具
   */
  async executeTool(
    name: string,
    params: Record<string, unknown>,
    context: Partial<ToolContext> = {}
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        success: false,
        error: `工具 ${name} 不存在`,
        executionTime: 0,
      }
    }

    // 构建完整上下文
    const fullContext: ToolContext = {
      userId: context.userId || 'anonymous',
      conversationId: context.conversationId || 'default',
      messageId: context.messageId,
      env: context.env || {},
      workingDirectory: context.workingDirectory || '.',
      signal: context.signal,
      onProgress: context.onProgress,
      log: context.log || ((level, message) => logger[level](`[Tool:${name}] ${message}`)),
    }

    // 发出执行前事件
    this.emit('beforeExecute', { tool: name, params, context: fullContext })

    const startTime = Date.now()

    try {
      // 检查是否需要确认
      if (tool.requiresConfirmation) {
        this.emit('confirmRequired', { tool: name, params })
      }

      // 设置超时
      let result: ToolExecutionResult
      if (tool.timeout) {
        result = await Promise.race([
          tool.execute(params, fullContext),
          new Promise<ToolExecutionResult>((_, reject) =>
            setTimeout(() => reject(new Error('执行超时')), tool.timeout)
          ),
        ])
      } else {
        result = await tool.execute(params, fullContext)
      }

      // 记录执行历史
      this.executionHistory.value.push({
        toolName: name,
        params,
        result,
        timestamp: Date.now(),
      })

      // 限制历史记录数量
      if (this.executionHistory.value.length > 100) {
        this.executionHistory.value.shift()
      }

      // 发出执行后事件
      this.emit('afterExecute', { tool: name, params, result })

      return result
    } catch (error) {
      const result: ToolExecutionResult = {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      }

      this.emit('error', { tool: name, params, error })
      return result
    }
  }

  /**
   * 批量执行工具
   */
  async executeTools(
    tasks: Array<{ name: string; params: Record<string, unknown> }>,
    context: Partial<ToolContext> = {},
    options: { parallel?: boolean; stopOnError?: boolean } = {}
  ): Promise<ToolExecutionResult[]> {
    const { parallel = false, stopOnError = false } = options
    const results: ToolExecutionResult[] = []

    if (parallel) {
      // 并行执行
      const promises = tasks.map(task => this.executeTool(task.name, task.params, context))
      return Promise.all(promises)
    } else {
      // 串行执行
      for (const task of tasks) {
        const result = await this.executeTool(task.name, task.params, context)
        results.push(result)

        if (stopOnError && !result.success) {
          break
        }
      }
      return results
    }
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory(): typeof this.executionHistory.value {
    return [...this.executionHistory.value]
  }

  /**
   * 清空执行历史
   */
  clearExecutionHistory(): void {
    this.executionHistory.value = []
  }

  /**
   * 获取工具的 JSON Schema（用于 AI 调用）
   */
  getToolsSchema(): Array<{
    name: string
    description: string
    parameters: ToolDefinition['parameters']
  }> {
    return this.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }))
  }
}

// 单例实例
let toolExecutorInstance: ToolExecutor | null = null

/**
 * 获取工具执行器实例
 */
export function getToolExecutor(): ToolExecutor {
  if (!toolExecutorInstance) {
    toolExecutorInstance = new ToolExecutor()
  }
  return toolExecutorInstance
}
