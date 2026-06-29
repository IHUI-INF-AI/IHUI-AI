/**
 * OpenClaw MCP (Model Context Protocol) Integration
 * 
 * MCP 协议集成:
 * - MCP Server: 托管和暴露工具给 AI 模型
 * - MCP Client: 连接外部 MCP 服务
 * - 资源管理: 暴露文件、数据库等资源
 * - 工具注册: 将工具暴露给 Claude/GPT 等模型
 * 
 * 参考: https://docs.browser-use.com/customize/mcp-server
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * MCP 消息类型
 */
export type MCPMessageType =
  | 'initialize'
  | 'initialized'
  | 'tools/list'
  | 'tools/call'
  | 'resources/list'
  | 'resources/read'
  | 'prompts/list'
  | 'prompts/get'
  | 'logging/setLevel'
  | 'completion/complete'
  | 'ping'
  | 'error'

/**
 * MCP 请求
 */
export interface MCPRequest {
  jsonrpc: '2.0'
  id: string | number
  method: MCPMessageType
  params?: Record<string, unknown>
}

/**
 * MCP 响应
 */
export interface MCPResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: MCPError
}

/**
 * MCP 错误
 */
export interface MCPError {
  code: number
  message: string
  data?: unknown
}

/**
 * MCP 工具定义
 */
export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, MCPToolProperty>
    required?: string[]
  }
}

/**
 * MCP 工具属性
 */
export interface MCPToolProperty {
  type: string
  description?: string
  enum?: unknown[]
  default?: unknown
  items?: MCPToolProperty
}

/**
 * MCP 工具调用
 */
export interface MCPToolCall {
  name: string
  arguments: Record<string, unknown>
}

/**
 * MCP 工具结果
 */
export interface MCPToolResult {
  content: MCPContent[]
  isError?: boolean
}

/**
 * MCP 内容
 */
export interface MCPContent {
  type: 'text' | 'image' | 'resource'
  text?: string
  data?: string
  mimeType?: string
  uri?: string
}

/**
 * MCP 资源
 */
export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

/**
 * MCP 资源模板
 */
export interface MCPResourceTemplate {
  uriTemplate: string
  name: string
  description?: string
  mimeType?: string
}

/**
 * MCP 提示词
 */
export interface MCPPrompt {
  name: string
  description?: string
  arguments?: MCPPromptArgument[]
}

/**
 * MCP 提示词参数
 */
export interface MCPPromptArgument {
  name: string
  description?: string
  required?: boolean
}

/**
 * MCP 提示词消息
 */
export interface MCPPromptMessage {
  role: 'user' | 'assistant'
  content: MCPContent
}

/**
 * MCP 服务器信息
 */
export interface MCPServerInfo {
  name: string
  version: string
  protocolVersion: string
  capabilities: MCPCapabilities
}

/**
 * MCP 能力
 */
export interface MCPCapabilities {
  tools?: boolean | { listChanged?: boolean }
  resources?: boolean | { subscribe?: boolean; listChanged?: boolean }
  prompts?: boolean | { listChanged?: boolean }
  logging?: boolean
  experimental?: Record<string, unknown>
}

/**
 * MCP 客户端信息
 */
export interface MCPClientInfo {
  name: string
  version: string
}

/**
 * MCP 服务器配置
 */
export interface MCPServerConfig {
  name: string
  version: string
  capabilities?: Partial<MCPCapabilities>
  tools?: MCPTool[]
  resources?: MCPResource[]
  resourceTemplates?: MCPResourceTemplate[]
  prompts?: MCPPrompt[]
}

/**
 * MCP 客户端配置
 */
export interface MCPClientConfig {
  serverUrl: string
  transport: 'stdio' | 'http' | 'websocket'
  apiKey?: string
  timeout?: number
}

/**
 * MCP 连接状态
 */
export type MCPConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * MCP 服务器
 */
export class MCPServer extends EventEmitter {
  private config: MCPServerConfig
  private tools = reactive<Map<string, MCPTool>>(new Map())
  private resources = reactive<Map<string, MCPResource>>(new Map())
  private prompts = reactive<Map<string, MCPPrompt>>(new Map())
  private toolHandlers = new Map<string, (args: Record<string, unknown>) => Promise<MCPToolResult>>()
  private resourceHandlers = new Map<string, (uri: string) => Promise<MCPContent>>()
  private promptHandlers = new Map<string, (args: Record<string, unknown>) => Promise<MCPPromptMessage[]>>()
  private initialized = ref(false)

  constructor(config: MCPServerConfig) {
    super()
    this.config = {
      ...config,
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
        logging: true,
        ...config.capabilities,
      },
    }

    // 注册初始工具
    if (config.tools) {
      for (const tool of config.tools) {
        this.tools.set(tool.name, tool)
      }
    }

    // 注册初始资源
    if (config.resources) {
      for (const resource of config.resources) {
        this.resources.set(resource.uri, resource)
      }
    }

    // 注册初始提示词
    if (config.prompts) {
      for (const prompt of config.prompts) {
        this.prompts.set(prompt.name, prompt)
      }
    }
  }

  /**
   * 获取服务器信息
   */
  getServerInfo(): MCPServerInfo {
    return {
      name: this.config.name,
      version: this.config.version,
      protocolVersion: '2024-11-05',
      capabilities: this.config.capabilities as MCPCapabilities,
    }
  }

  /**
   * 处理请求
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: request.id,
    }

    try {
      switch (request.method) {
        case 'initialize':
          response.result = this.handleInitialize(request.params as { clientInfo: MCPClientInfo })
          break

        case 'tools/list':
          response.result = this.handleToolsList()
          break

        case 'tools/call':
          response.result = await this.handleToolCall(request.params as unknown as MCPToolCall)
          break

        case 'resources/list':
          response.result = this.handleResourcesList()
          break

        case 'resources/read':
          response.result = await this.handleResourceRead(request.params as { uri: string })
          break

        case 'prompts/list':
          response.result = this.handlePromptsList()
          break

        case 'prompts/get':
          response.result = await this.handlePromptGet(request.params as { name: string; arguments?: Record<string, unknown> })
          break

        case 'ping':
          response.result = {}
          break

        default:
          response.error = {
            code: -32601,
            message: `Method not found: ${request.method}`,
          }
      }
    } catch (error) {
      response.error = {
        code: -32603,
        message: (error as Error).message,
      }
    }

    return response
  }

  /**
   * 处理初始化
   */
  private handleInitialize(params: { clientInfo: MCPClientInfo }): MCPServerInfo {
    logger.info(`[MCP Server] Client connected: ${params.clientInfo.name} v${params.clientInfo.version}`)
    this.initialized.value = true
    this.emit('clientConnected', params.clientInfo)
    return this.getServerInfo()
  }

  /**
   * 处理工具列表
   */
  private handleToolsList(): { tools: MCPTool[] } {
    return { tools: Array.from(this.tools.values()) }
  }

  /**
   * 处理工具调用
   */
  private async handleToolCall(params: MCPToolCall): Promise<MCPToolResult> {
    const handler = this.toolHandlers.get(params.name)
    if (!handler) {
      return {
        content: [{ type: 'text', text: `Tool not found: ${params.name}` }],
        isError: true,
      }
    }

    logger.info(`[MCP Server] Calling tool: ${params.name}`)
    this.emit('toolCalled', params)

    try {
      const result = await handler(params.arguments)
      return result
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
        isError: true,
      }
    }
  }

  /**
   * 处理资源列表
   */
  private handleResourcesList(): { resources: MCPResource[] } {
    return { resources: Array.from(this.resources.values()) }
  }

  /**
   * 处理资源读取
   */
  private async handleResourceRead(params: { uri: string }): Promise<{ contents: MCPContent[] }> {
    const handler = this.resourceHandlers.get(params.uri)
    if (!handler) {
      // 尝试匹配模板
      for (const [uri, h] of this.resourceHandlers) {
        if (params.uri.startsWith(uri.replace('*', ''))) {
          const content = await h(params.uri)
          return { contents: [content] }
        }
      }
      throw new Error(`Resource not found: ${params.uri}`)
    }

    const content = await handler(params.uri)
    return { contents: [content] }
  }

  /**
   * 处理提示词列表
   */
  private handlePromptsList(): { prompts: MCPPrompt[] } {
    return { prompts: Array.from(this.prompts.values()) }
  }

  /**
   * 处理提示词获取
   */
  private async handlePromptGet(params: { name: string; arguments?: Record<string, unknown> }): Promise<{ messages: MCPPromptMessage[] }> {
    const handler = this.promptHandlers.get(params.name)
    if (!handler) {
      throw new Error(`Prompt not found: ${params.name}`)
    }

    const messages = await handler(params.arguments || {})
    return { messages }
  }

  /**
   * 注册工具
   */
  registerTool(
    tool: MCPTool,
    handler: (args: Record<string, unknown>) => Promise<MCPToolResult>
  ): void {
    this.tools.set(tool.name, tool)
    this.toolHandlers.set(tool.name, handler)
    logger.debug(`[MCP Server] Registering tool: ${tool.name}`)
    this.emit('toolRegistered', tool)
  }

  /**
   * 注销工具
   */
  unregisterTool(name: string): void {
    this.tools.delete(name)
    this.toolHandlers.delete(name)
    this.emit('toolUnregistered', name)
  }

  /**
   * 注册资源
   */
  registerResource(
    resource: MCPResource,
    handler: (uri: string) => Promise<MCPContent>
  ): void {
    this.resources.set(resource.uri, resource)
    this.resourceHandlers.set(resource.uri, handler)
    logger.debug(`[MCP Server] Registering resource: ${resource.uri}`)
    this.emit('resourceRegistered', resource)
  }

  /**
   * 注册提示词
   */
  registerPrompt(
    prompt: MCPPrompt,
    handler: (args: Record<string, unknown>) => Promise<MCPPromptMessage[]>
  ): void {
    this.prompts.set(prompt.name, prompt)
    this.promptHandlers.set(prompt.name, handler)
    logger.debug(`[MCP Server] Registering prompt: ${prompt.name}`)
    this.emit('promptRegistered', prompt)
  }

  /**
   * 获取所有工具
   */
  getTools(): MCPTool[] {
    return Array.from(this.tools.values())
  }

  /**
   * 获取所有资源
   */
  getResources(): MCPResource[] {
    return Array.from(this.resources.values())
  }

  /**
   * 获取所有提示词
   */
  getPrompts(): MCPPrompt[] {
    return Array.from(this.prompts.values())
  }
}

/**
 * MCP 客户端
 */
export class MCPClient extends EventEmitter {
  private config: MCPClientConfig
  private serverInfo: MCPServerInfo | null = null
  private state = ref<MCPConnectionState>('disconnected')
  private requestId = 0
  private pendingRequests = new Map<string | number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>()
  private ws: WebSocket | null = null

  constructor(config: MCPClientConfig) {
    super()
    this.config = {
      timeout: 30000,
      ...config,
    }
  }

  /**
   * 连接到服务器
   */
  async connect(): Promise<MCPServerInfo> {
    if (this.state.value === 'connected') {
      return this.serverInfo!
    }

    this.state.value = 'connecting'

    try {
      if (this.config.transport === 'websocket') {
        await this.connectWebSocket()
      } else if (this.config.transport === 'http') {
        // HTTP 连接不需要特殊处理
      }

      // 发送初始化请求
      const result = await this.request('initialize', {
        clientInfo: {
          name: 'iHui AI MCP Client',
          version: '1.0.0',
        },
        protocolVersion: '2024-11-05',
        capabilities: {},
      })

      this.serverInfo = result as MCPServerInfo
      this.state.value = 'connected'

      logger.info(`[MCP Client] Connected to: ${this.serverInfo.name} v${this.serverInfo.version}`)
      this.emit('connected', this.serverInfo)

      return this.serverInfo
    } catch (error) {
      this.state.value = 'error'
      throw error
    }
  }

  /**
   * WebSocket 连接
   */
  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.serverUrl)

      this.ws.onopen = () => {
        resolve()
      }

      this.ws.onerror = (error) => {
        reject(error)
      }

      this.ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data) as MCPResponse
          const pending = this.pendingRequests.get(response.id)
          if (pending) {
            if (response.error) {
              pending.reject(new Error(response.error.message))
            } else {
              pending.resolve(response.result)
            }
            this.pendingRequests.delete(response.id)
          }
        } catch (error) {
          logger.error('[MCP Client] Failed to parse response:', error)
        }
      }

      this.ws.onclose = () => {
        this.state.value = 'disconnected'
        this.emit('disconnected')
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.state.value = 'disconnected'
    this.serverInfo = null
  }

  /**
   * 发送请求
   */
  async request(method: MCPMessageType, params?: Record<string, unknown>): Promise<unknown> {
    const id = ++this.requestId
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    if (this.config.transport === 'websocket' && this.ws) {
      return new Promise((resolve, reject) => {
        this.pendingRequests.set(id, { resolve, reject })

        const timeout = setTimeout(() => {
          this.pendingRequests.delete(id)
          reject(new Error('Request timeout'))
        }, this.config.timeout)

        this.ws!.send(JSON.stringify(request))

        // 清理超时
        const originalResolve = this.pendingRequests.get(id)!.resolve
        this.pendingRequests.get(id)!.resolve = (value) => {
          clearTimeout(timeout)
          originalResolve(value)
        }
      })
    } else if (this.config.transport === 'http') {
      const response = await fetch(this.config.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(request),
      })

      const result = await response.json() as MCPResponse
      if (result.error) {
        throw new Error(result.error.message)
      }
      return result.result
    }

    throw new Error('Unsupported transport')
  }

  /**
   * 获取工具列表
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.request('tools/list') as { tools: MCPTool[] }
    return result.tools
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    logger.info(`[MCP Client] Calling tool: ${name}`)
    const result = await this.request('tools/call', { name, arguments: args }) as MCPToolResult
    return result
  }

  /**
   * 获取资源列表
   */
  async listResources(): Promise<MCPResource[]> {
    const result = await this.request('resources/list') as { resources: MCPResource[] }
    return result.resources
  }

  /**
   * 读取资源
   */
  async readResource(uri: string): Promise<MCPContent[]> {
    const result = await this.request('resources/read', { uri }) as { contents: MCPContent[] }
    return result.contents
  }

  /**
   * 获取提示词列表
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    const result = await this.request('prompts/list') as { prompts: MCPPrompt[] }
    return result.prompts
  }

  /**
   * 获取提示词
   */
  async getPrompt(name: string, args?: Record<string, unknown>): Promise<MCPPromptMessage[]> {
    const result = await this.request('prompts/get', { name, arguments: args }) as { messages: MCPPromptMessage[] }
    return result.messages
  }

  /**
   * Ping
   */
  async ping(): Promise<boolean> {
    try {
      await this.request('ping')
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取连接状态
   */
  getState(): MCPConnectionState {
    return this.state.value
  }

  /**
   * 获取服务器信息
   */
  getServerInfo(): MCPServerInfo | null {
    return this.serverInfo
  }
}

/**
 * MCP 管理器
 */
export class MCPManager extends EventEmitter {
  private servers = reactive<Map<string, MCPServer>>(new Map())
  private clients = reactive<Map<string, MCPClient>>(new Map())
  private initialized = ref(false)

  constructor() {
    super()
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized.value) return

    logger.info('[MCP] Initializing MCP manager...')

    // 创建默认的 MCP 服务器
    this.createServer('default', {
      name: 'iHui AI MCP Server',
      version: '1.0.0',
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
        logging: true,
      },
    })

    this.initialized.value = true
    logger.info('[MCP] MCP manager initialized')
    this.emit('initialized')
  }

  /**
   * 创建服务器
   */
  createServer(id: string, config: MCPServerConfig): MCPServer {
    const server = new MCPServer(config)
    this.servers.set(id, server)
    logger.info(`[MCP] Creating server: ${id}`)
    this.emit('serverCreated', { id, server })
    return server
  }

  /**
   * 获取服务器
   */
  getServer(id: string): MCPServer | undefined {
    return this.servers.get(id)
  }

  /**
   * 创建客户端
   */
  createClient(id: string, config: MCPClientConfig): MCPClient {
    const client = new MCPClient(config)
    this.clients.set(id, client)
    logger.info(`[MCP] Creating client: ${id}`)
    this.emit('clientCreated', { id, client })
    return client
  }

  /**
   * 获取客户端
   */
  getClient(id: string): MCPClient | undefined {
    return this.clients.get(id)
  }

  /**
   * 连接到外部 MCP 服务
   */
  async connectToServer(id: string, config: MCPClientConfig): Promise<MCPServerInfo> {
    const client = this.createClient(id, config)
    return client.connect()
  }

  /**
   * 获取所有服务器
   */
  getServers(): MCPServer[] {
    return Array.from(this.servers.values())
  }

  /**
   * 获取所有客户端
   */
  getClients(): MCPClient[] {
    return Array.from(this.clients.values())
  }

  /**
   * 关闭
   */
  shutdown(): void {
    // 断开所有客户端
    for (const client of this.clients.values()) {
      client.disconnect()
    }

    this.servers.clear()
    this.clients.clear()
    this.initialized.value = false

    logger.info('[MCP] MCP manager shut down')
    this.emit('shutdown')
  }
}

// 单例实例
let mcpManagerInstance: MCPManager | null = null

/**
 * 获取 MCP 管理器实例
 */
export function getMCPManager(): MCPManager {
  if (!mcpManagerInstance) {
    mcpManagerInstance = new MCPManager()
  }
  return mcpManagerInstance
}

export default MCPManager
