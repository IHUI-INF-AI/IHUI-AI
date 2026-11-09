/**
 * 路由 → AI 工具 通用工厂(API 路由 → AI 工具 自动暴露模式的核心)。
 *
 * 设计:每枚 API 端点声明成一份 RouteToolSpec(路径/方法/参数/权限),本工厂把它编译成一枚
 * 符合 tools/index.ts 的 `Tool`(name/description/parameters/required/dangerLevel/execute),
 * 运行期经 HTTP 调产品 API。入参与路由对齐,权限复用路由既有 RBAC。
 *
 * HR(hr.ts)是第一个消费者;其余业务域(教育/电商/内容/…)只需补一份 spec 数组,
 * 即可批量接入 AI 对话框,无需手写每枚工具的样板。
 *
 * 鉴权:base URL 取 process.env.IHUI_API_BASE_URL(默认 http://127.0.0.1:8802)再拼 /api;
 * Bearer token 取 process.env.IHUI_API_TOKEN。真实部署应注入当前用户会话 token(见 tasks #11)。
 */

import type { Tool, ToolParameter } from './index.js'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RouteParamSpec {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
  required?: boolean
  enum?: string[]
}

export interface RouteToolSpec {
  /** 工具名,建议域_动作_对象 风格,如 hr_department_list */
  name: string
  description: string
  method: HttpMethod
  /** 相对 /api 的路径,含 :param 占位,如 /hr-attendance/leave/:id/approve */
  path: string
  /** 路径参数(从 path 的 :x 解析,恒为必填) */
  pathParams?: RouteParamSpec[]
  /** GET 走 query;写方法(POST/PUT/PATCH/DELETE)走 body */
  params?: RouteParamSpec[]
  /** 权限族提示,决定 dangerLevel 与 toolFamily;省略时 GET→read,其余→write */
  access?: 'read' | 'write'
}

const API_BASE = (process.env.IHUI_API_BASE_URL ?? 'http://127.0.0.1:8802').replace(/\/+$/, '') + '/api'

function resolveToken(): string | undefined {
  return process.env.IHUI_API_TOKEN
}

function toToolParam(p: RouteParamSpec): ToolParameter {
  const out: ToolParameter = { type: p.type, description: p.description }
  if (p.enum) out.enum = p.enum
  return out
}

function buildParameters(spec: RouteToolSpec): {
  parameters: Record<string, ToolParameter>
  required: string[]
} {
  const parameters: Record<string, ToolParameter> = {}
  const required: string[] = []
  for (const p of spec.pathParams ?? []) {
    parameters[p.name] = toToolParam(p)
    required.push(p.name)
  }
  for (const p of spec.params ?? []) {
    parameters[p.name] = toToolParam(p)
    if (p.required) required.push(p.name)
  }
  return { parameters, required }
}

async function callRoute(spec: RouteToolSpec, args: Record<string, unknown>): Promise<unknown> {
  const pathArgNames = new Set((spec.pathParams ?? []).map((p) => p.name))
  let path = spec.path
  for (const name of pathArgNames) {
    const v = args[name]
    if (v === undefined || v === null) throw new Error(`缺少路径参数 ${name}`)
    path = path.replace(`:${name}`, encodeURIComponent(String(v)))
  }

  const url = new URL(path.startsWith('/') ? path : `/${path}`, API_BASE)
  if (spec.method === 'GET') {
    for (const [k, v] of Object.entries(args)) {
      if (pathArgNames.has(k)) continue
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }

  const headers: Record<string, string> = { accept: 'application/json' }
  const token = resolveToken()
  if (token) headers['authorization'] = `Bearer ${token}`

  let body: string | undefined
  if (spec.method !== 'GET') {
    const b: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(args)) {
      if (pathArgNames.has(k)) continue
      if (v !== undefined) b[k] = v
    }
    if (Object.keys(b).length > 0) {
      body = JSON.stringify(b)
      headers['content-type'] = 'application/json'
    }
  }

  const res = await fetch(url, { method: spec.method, headers, body })
  const text = await res.text()
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  if (!res.ok) {
    const payload = (json as { error?: unknown; message?: unknown }) ?? {}
    const msg = payload.error ?? payload.message ?? text
    throw new Error(`route ${spec.method} ${spec.path} -> ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`)
  }
  const data = (json as { data?: unknown })?.data
  return data !== undefined ? data : json
}

export function createRouteTool(spec: RouteToolSpec): Tool {
  const access = spec.access ?? (spec.method === 'GET' ? 'read' : 'write')
  const { parameters, required } = buildParameters(spec)
  return {
    name: spec.name,
    description: spec.description,
    parameters,
    required,
    dangerLevel: access === 'read' ? 'read' : 'write',
    execute: async (args) => {
      try {
        const data = await callRoute(spec, args)
        return {
          success: true,
          output: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        }
      } catch (e) {
        return { success: false, output: '', error: e instanceof Error ? e.message : String(e) }
      }
    },
  }
}

/** 一批 RouteToolSpec → Tool[]。HR 等域直接 `export const X_TOOLS = createRouteTools(SPECS)`。 */
export function createRouteTools(specs: RouteToolSpec[]): Tool[] {
  return specs.map(createRouteTool)
}
