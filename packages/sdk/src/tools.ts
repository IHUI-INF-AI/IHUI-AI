/**
 * MCP 工具 / 技能 / 人格 / 代码搜索 / 截图模块。
 *
 * 端点(16 个):
 * - GET  /v1/tools
 * - POST /v1/tools/call
 * - GET  /v1/resources
 * - GET  /v1/resources/:uri
 * - GET  /v1/prompts
 * - POST /v1/prompts/invoke
 * - GET  /v1/skills
 * - GET  /v1/slash-commands
 * - POST /v1/slash-commands
 * - POST /v1/sampling
 * - GET  /v1/personas
 * - GET  /v1/personas/:name
 * - POST /v1/tools/search-codebase
 * - POST /v1/tools/search-web
 * - POST /v1/tools/analyze-code
 * - POST /v1/screenshot
 */

import type { BaseClient } from './base.js'
import type {
  V1ToolsResponse,
  V1ToolCallRequest,
  V1ToolCallResponse,
  V1ResourcesResponse,
  V1PromptsResponse,
  V1PromptInvokeRequest,
  V1PromptInvokeResponse,
  V1SkillsResponse,
  V1SlashCommandsResponse,
  V1SamplingRequest,
  V1SamplingResponse,
  V1PersonasResponse,
  V1SearchCodebaseRequest,
  V1SearchWebRequest,
  V1ScreenshotRequest,
  V1ScreenshotResponse,
} from '@ihui/types'

/** 资源详情(GET /v1/resources/:uri)。 */
export interface V1ResourceDetail {
  uri: string
  name: string
  description?: string
  mimeType?: string
  content: string
}

/** 调用 slash 命令请求(POST /v1/slash-commands)。 */
export interface V1InvokeSlashCommandRequest {
  command: string
  args?: Record<string, string>
}

/** 调用 slash 命令响应。 */
export interface V1InvokeSlashCommandResponse {
  output: string
}

/** 人格详情(GET /v1/personas/:name)。 */
export interface V1PersonaDetail {
  name: string
  description: string
  systemPrompt: string
  traits: string[]
}

/** 网页搜索响应(POST /v1/tools/search-web)。 */
export interface V1SearchWebResponse {
  results: Array<{
    title: string
    url: string
    snippet: string
  }>
}

/** 代码分析请求(POST /v1/tools/analyze-code)。 */
export interface V1AnalyzeCodeRequest {
  code: string
  language?: string
  analysis?: 'complexity' | 'security' | 'style' | 'all'
}

/** 代码分析响应。 */
export interface V1AnalyzeCodeResponse {
  issues: Array<{
    line: number
    column: number
    severity: 'error' | 'warning' | 'info'
    message: string
    rule?: string
  }>
  metrics?: {
    complexity?: number
    maintainability?: number
  }
}

/** 代码库搜索响应(POST /v1/tools/search-codebase)。 */
export interface V1SearchCodebaseResponse {
  results: Array<{
    file: string
    line: number
    content: string
    score: number
  }>
}

export interface ToolsModule {
  /** GET /v1/tools(MCP 工具列表)。 */
  list(): Promise<V1ToolsResponse>
  /** POST /v1/tools/call(调用 MCP 工具)。 */
  call(req: V1ToolCallRequest): Promise<V1ToolCallResponse>
  /** GET /v1/resources(MCP 资源列表)。 */
  listResources(): Promise<V1ResourcesResponse>
  /** GET /v1/resources/:uri(资源详情)。 */
  getResource(uri: string): Promise<V1ResourceDetail>
  /** GET /v1/prompts(MCP 提示词列表)。 */
  listPrompts(): Promise<V1PromptsResponse>
  /** POST /v1/prompts/invoke(调用提示词)。 */
  invokePrompt(req: V1PromptInvokeRequest): Promise<V1PromptInvokeResponse>
  /** GET /v1/skills(技能列表)。 */
  listSkills(): Promise<V1SkillsResponse>
  /** GET /v1/slash-commands(slash 命令列表)。 */
  listSlashCommands(): Promise<V1SlashCommandsResponse>
  /** POST /v1/slash-commands(调用 slash 命令)。 */
  invokeSlashCommand(req: V1InvokeSlashCommandRequest): Promise<V1InvokeSlashCommandResponse>
  /** POST /v1/sampling(模型采样)。 */
  sampling(req: V1SamplingRequest): Promise<V1SamplingResponse>
  /** GET /v1/personas(人格列表)。 */
  listPersonas(): Promise<V1PersonasResponse>
  /** GET /v1/personas/:name(人格详情)。 */
  getPersona(name: string): Promise<V1PersonaDetail>
  /** POST /v1/tools/search-codebase(代码库搜索)。 */
  searchCodebase(req: V1SearchCodebaseRequest): Promise<V1SearchCodebaseResponse>
  /** POST /v1/tools/search-web(网页搜索)。 */
  searchWeb(req: V1SearchWebRequest): Promise<V1SearchWebResponse>
  /** POST /v1/tools/analyze-code(代码分析)。 */
  analyzeCode(req: V1AnalyzeCodeRequest): Promise<V1AnalyzeCodeResponse>
  /** POST /v1/screenshot(网页截图)。 */
  screenshot(req: V1ScreenshotRequest): Promise<V1ScreenshotResponse>
}

export function createToolsModule(client: BaseClient): ToolsModule {
  return {
    list: () => client.request<V1ToolsResponse>('GET', '/tools'),
    call: (req) => client.request<V1ToolCallResponse>('POST', '/tools/call', req),
    listResources: () => client.request<V1ResourcesResponse>('GET', '/resources'),
    getResource: (uri) =>
      client.request<V1ResourceDetail>('GET', `/resources/${encodeURIComponent(uri)}`),
    listPrompts: () => client.request<V1PromptsResponse>('GET', '/prompts'),
    invokePrompt: (req) => client.request<V1PromptInvokeResponse>('POST', '/prompts/invoke', req),
    listSkills: () => client.request<V1SkillsResponse>('GET', '/skills'),
    listSlashCommands: () => client.request<V1SlashCommandsResponse>('GET', '/slash-commands'),
    invokeSlashCommand: (req) =>
      client.request<V1InvokeSlashCommandResponse>('POST', '/slash-commands', req),
    sampling: (req) => client.request<V1SamplingResponse>('POST', '/sampling', req),
    listPersonas: () => client.request<V1PersonasResponse>('GET', '/personas'),
    getPersona: (name) =>
      client.request<V1PersonaDetail>('GET', `/personas/${encodeURIComponent(name)}`),
    searchCodebase: (req) =>
      client.request<V1SearchCodebaseResponse>('POST', '/tools/search-codebase', req),
    searchWeb: (req) => client.request<V1SearchWebResponse>('POST', '/tools/search-web', req),
    analyzeCode: (req) => client.request<V1AnalyzeCodeResponse>('POST', '/tools/analyze-code', req),
    screenshot: (req) => client.request<V1ScreenshotResponse>('POST', '/screenshot', req),
  }
}
