import { t } from '@/utils/i18n'

import request from '@/utils/request'
import { isDemoMode } from '@/utils/envUtils'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { DEVELOPER_PATHS } from '@/config/backend-paths'
import { MCP_CURATED_SERVERS } from '@/data/mcp-curated'

// MCP协议类型
export type MCPProtocol = 'stdio' | 'http' | 'sse' | 'websocket'

// MCP服务器状态
export type MCPServerStatus = 'active' | 'inactive' | 'error'

// MCP 认证类型 (P1 缺口补齐, 对标 Codex OAuth + Claude Code)
export type MCPAuthType = 'none' | 'bearer' | 'oauth'

// MCP OAuth 配置 (授权码流程)
export interface MCPOAuth {
  client_id?: string
  client_secret?: string
  auth_url?: string
  token_url?: string
  scopes?: string[]
  redirect_uri?: string
  access_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
}

// MCP 认证配置
export interface MCPAuth {
  type: MCPAuthType
  token?: string // bearer 静态 token (支持 ${VAR} 环境变量展开)
  oauth?: MCPOAuth
}

// MCP 连接器运行状态 (对标 WorkBuddy 连接器可视化)
export interface MCPConnectorStatus {
  name: string
  transport: MCPProtocol
  online: boolean // 在线/离线
  tool_count: number // 已发现工具数
  url?: string
  error?: string
}

// MCP工具接口
export interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

// MCP资源接口
export interface MCPResource {
  uri: string
  name?: string
  description?: string
  mimeType?: string
}

// MCP提示词接口
export interface MCPPrompt {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

// MCP服务器能力
export interface MCPCapability {
  tools?: MCPTool[]
  resources?: MCPResource[]
  prompts?: MCPPrompt[]
}

// MCP服务器接口
export interface MCPServer {
  id: string
  name: string
  protocol: MCPProtocol
  url: string
  apiKey?: string
  description?: string
  status: MCPServerStatus
  errorMessage?: string
  transport?: {
    command?: string
    args?: string[]
  }
  config?: Record<string, unknown>
  tools?: MCPTool[]
  resources?: MCPResource[]
  prompts?: MCPPrompt[]
  capabilities?: MCPCapability // 添加 capabilities 属性
  // P1 缺口补齐: 认证 + 自定义 headers (对标 Codex OAuth + Claude Code)
  auth?: MCPAuth
  headers?: Record<string, string>
  createTime?: string
  updateTime?: string
}

// 获取MCP服务器列表
export async function getMCPServersList(
  params?: PaginationParams & {
    protocol?: MCPProtocol
    status?: MCPServerStatus
  }
): Promise<ApiResponse<PaginationResponse<MCPServer>>> {
  try {
    if (isDemoMode()) {
      const demoServer: MCPServer = {
        id: 'demo-mcp-1',
        name: 'Demo MCP Server',
        protocol: 'stdio',
        url: 'mcp://localhost',
        status: 'active',
        description: t('text.mcp.演示用本地MCP12'),
        apiKey: 'mock',
        capabilities: {
          tools: [
            {
              name: 'healthCheck',
              description: t('text.mcp.演示工具健康检查13'),
            },
          ],
          resources: [
            {
              uri: 'demo://resource/readme',
              name: '示例资源',
            },
          ],
          prompts: [
            {
              name: 'hello',
              description: t('text.mcp.示例提示词14'),
            },
          ],
        },
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      }
      const list: MCPServer[] = [demoServer, ...MCP_CURATED_SERVERS]
      return {
        code: 200,
        success: true,
        message: t('api.mcp.演示数据'),
        data: {
          list,
          pagination: {
            page: params?.page || 1,
            pageSize: params?.pageSize || 20,
            total: list.length,
            totalPages: Math.ceil(list.length / (params?.pageSize || 20)) || 1,
          },
        },
        timestamp: Date.now(),
      }
    }

    const response = await request.get(DEVELOPER_PATHS.mcp.servers, {
      params,
    })
    const data = response.data || {
      list: [] as MCPServer[],
      pagination: {
        page: params?.page || 1,
        pageSize: params?.pageSize || 20,
        total: 0,
        totalPages: 0,
      },
    }
    const list = Array.isArray(data.list) ? data.list : []
    const backendIds = new Set(list.map((s: MCPServer) => s.id))
    const curatedOnly = MCP_CURATED_SERVERS.filter((s) => !backendIds.has(s.id))
    const mergedList = [...list, ...curatedOnly]
    const total = mergedList.length
    return {
      code: 200,
      success: true,
      message: t('api.mcp.获取成功1'),
      data: {
        list: mergedList,
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total,
          totalPages: Math.ceil(total / (params?.pageSize || 20)) || 1,
        },
      },
      timestamp: Date.now(),
    }
  } catch (_error: unknown) {
    return {
      code: 200,
      success: true,
      message: t('api.mcp.获取成功1'),
      data: {
        list: [...MCP_CURATED_SERVERS],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: MCP_CURATED_SERVERS.length,
          totalPages: 1,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 获取MCP服务器详情
export async function getMCPServerDetail(id: string): Promise<ApiResponse<MCPServer>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.mcp.serverById(id))
    return {
      code: 200,
      success: true,
      message: t('api.mcp.获取成功2'),
      data: response.data || ({} as MCPServer),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取MCP服务器详情失败',
      data: {} as MCPServer,
      timestamp: Date.now(),
    }
  }
}

// 创建MCP服务器
export async function createMCPServer(server: Partial<MCPServer>): Promise<ApiResponse<MCPServer>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.mcp.servers, server)
    return {
      code: 200,
      success: true,
      message: t('api.mcp.创建成功3'),
      data: response.data || ({} as MCPServer),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '创建MCP服务器失败',
      data: {} as MCPServer,
      timestamp: Date.now(),
    }
  }
}

// 更新MCP服务器
export async function updateMCPServer(
  id: string,
  server: Partial<MCPServer>
): Promise<ApiResponse<MCPServer>> {
  try {
    const response = await request.put(DEVELOPER_PATHS.mcp.serverById(id), server)
    return {
      code: 200,
      success: true,
      message: t('api.mcp.更新成功4'),
      data: response.data || ({} as MCPServer),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新MCP服务器失败',
      data: {} as MCPServer,
      timestamp: Date.now(),
    }
  }
}

// 删除MCP服务器
export async function deleteMCPServer(id: string): Promise<ApiResponse<void>> {
  try {
    await request.delete(DEVELOPER_PATHS.mcp.serverById(id))
    return {
      code: 200,
      success: true,
      message: t('api.mcp.删除成功5'),
      data: undefined,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '删除MCP服务器失败',
      data: undefined,
      timestamp: Date.now(),
    }
  }
}

// 测试MCP服务器连接
export async function testMCPServer(id: string): Promise<
  ApiResponse<{
    success: boolean
    message?: string
    capabilities?: MCPCapability
  }>
> {
  try {
    const response = await request.post(DEVELOPER_PATHS.mcp.test(id))
    return {
      code: 200,
      success: true,
      message: t('api.mcp.测试成功6'),
      data: response.data || { success: false, message: t('api.mcp.未知错误7') },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '测试MCP服务器失败',
      data: { success: false, message: error instanceof Error ? error.message : String(error) },
      timestamp: Date.now(),
    }
  }
}

// 获取MCP服务器能力
export async function getMCPServerCapabilities(id: string): Promise<ApiResponse<MCPCapability>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.mcp.capabilities(id))
    return {
      code: 200,
      success: true,
      message: t('api.mcp.获取成功8'),
      data: response.data || { tools: [], resources: [], prompts: [] },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取MCP服务器能力失败',
      data: { tools: [], resources: [], prompts: [] },
      timestamp: Date.now(),
    }
  }
}

// 调用MCP工具
export async function callMCPTool(
  serverId: string,
  toolName: string,
  arguments_: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  try {
    const response = await request.post(
      DEVELOPER_PATHS.mcp.tool(serverId, toolName),
      arguments_
    )
    return {
      code: 200,
      success: true,
      message: t('api.mcp.调用成功9'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '调用MCP工具失败',
      data: null,
      timestamp: Date.now(),
    }
  }
}

// 获取MCP资源
export async function getMCPResource(serverId: string, uri: string): Promise<ApiResponse<unknown>> {
  try {
    const response = await request.get(
      DEVELOPER_PATHS.mcp.resource(serverId, uri)
    )
    return {
      code: 200,
      success: true,
      message: t('api.mcp.获取成功10'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取MCP资源失败',
      data: null,
      timestamp: Date.now(),
    }
  }
}

// 调用MCP提示词
export async function callMCPPrompt(
  serverId: string,
  promptName: string,
  arguments_: Record<string, unknown> = {}
): Promise<ApiResponse<string>> {
  try {
    const response = await request.post(
      DEVELOPER_PATHS.mcp.prompt(serverId, promptName),
      arguments_
    )
    return {
      code: 200,
      success: true,
      message: t('api.mcp.调用成功11'),
      data: response.data || '',
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '调用MCP提示词失败',
      data: '',
      timestamp: Date.now(),
    }
  }
}

// MCP协议配置
export const MCP_PROTOCOLS: Record<
  MCPProtocol,
  { name: string; description: string; icon: string }
> = {
  stdio: {
    name: 'STDIO',
    description: t('text.mcp.标准输入输出适用15'),
    icon: '📟',
  },
  http: {
    name: 'HTTP',
    description: 'Streamable HTTP 传输 (单端点 POST JSON-RPC, 推荐远程)',
    icon: '🌐',
  },
  sse: {
    name: 'SSE',
    description: t('text.mcp.服务器发送事件适16'),
    icon: '📡',
  },
  websocket: {
    name: 'WebSocket',
    description: t('text.mcp.WebSocke17'),
    icon: '🔌',
  },
}

// ---------------------------------------------------------------------------
// P1 缺口补齐: 连接器状态查询 (在线/离线/工具数) — 对标 WorkBuddy 连接器可视化
// ---------------------------------------------------------------------------

// 获取所有连接器运行状态
export async function getMCPConnectorStatuses(): Promise<ApiResponse<MCPConnectorStatus[]>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.mcp.statuses)
    return {
      code: 200,
      success: true,
      message: t('api.mcp.获取成功8'),
      data: response.data || [],
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取连接器状态失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 获取单个连接器运行状态
export async function getMCPConnectorStatus(id: string): Promise<ApiResponse<MCPConnectorStatus>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.mcp.status(id))
    return {
      code: 200,
      success: true,
      message: t('api.mcp.获取成功8'),
      data: response.data || ({} as MCPConnectorStatus),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取连接器状态失败',
      data: {} as MCPConnectorStatus,
      timestamp: Date.now(),
    }
  }
}
