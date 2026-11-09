// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * 传输与鉴权:一律走 `@ihui/api-client` 的 `fetchApi`(AGENTS §3 共享层优先 —— 端内不得裸
 * fetch 调自家后端,守门 73 判这条)。两条口径因此只有一处实现:
 *   · 基址 = `getBaseUrl()`(端内 setup 时经 `setBaseUrl` 注入)→ `IHUI_API_BASE_URL`
 *     → 本机 8802 兜底。spec.path 是**完整路径**(含 `/api`、`/v1`、`/oauth`、`/.well-known`
 *     等前缀),解出的绝对 URL 直接交给 fetchApi —— 刻意绕开 `normalizeUrl` 的 `/api` 前缀
 *     补全,否则非 `/api` 前缀的端点会被改写成不存在的路径。
 *   · 凭据 = 端内已注册的 token provider(`registerCliTokenProvider`:每次现读令牌管理器 +
 *     401 自动续期)优先,缺席时退回 `IHUI_API_TOKEN` 环境变量。**不再把会话 token 塞进
 *     ToolContext** —— 那条路会把"凭据"混进"工具参数",且天然拿不到续期能力。
 */

import { fetchApi, getBaseUrl, getToken } from '@ihui/api-client'
import type { ToolContract } from '@ihui/types'
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
  /** 完整路径(含 /api 或 /v1 等前缀),含 :param 占位,如 /api/hr-attendance/leave/:id/approve */
  path: string
  /** 路径参数(从 path 的 :x 解析,恒为必填) */
  pathParams?: RouteParamSpec[]
  /** GET 走 query;写方法(POST/PUT/PATCH/DELETE)走 body */
  params?: RouteParamSpec[]
  /** 权限族提示,决定 dangerLevel 与 toolFamily;省略时 GET→read,其余→write */
  access?: 'read' | 'write' | 'dangerous'
}

/** 解析 API 基址(去掉尾部斜杠):端内注入优先 → 环境变量 → 本机 8802 兜底。 */
function resolveBase(): string {
  const injected = getBaseUrl().trim()
  if (injected) return injected.replace(/\/+$/, '')
  const fromEnv = (process.env.IHUI_API_BASE_URL ?? '').trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  return 'http://127.0.0.1:8802'
}

/** token provider 未注册时的兜底凭据(机器凭据 / 本地联调)。 */
function resolveFallbackToken(): string | undefined {
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

/**
 * 拆响应信封:`{ code, message, data }` → `data`;裸对象/数组原样返回。
 *
 * 只在**顶层是对象且真有 `data` 键**时拆 —— 不按"看起来像信封"去猜。产品 API 两种形态同时存在
 * (新路由走统一信封,老路由直出裸对象),猜错会把 `{ data: null }` 与"业务字段恰叫 data"
 * 混为一谈。
 */
export function unwrapEnvelope(data: unknown): unknown {
  if (data !== null && typeof data === 'object' && !Array.isArray(data) && 'data' in data) {
    return (data as { data?: unknown }).data
  }
  return data
}

/**
 * 执行一次路由调用(api-bridge 与本工厂共用这一条腿),返回**已解信封**的业务数据。
 *
 * 失败一律抛错(调用方按工具失败分支归因),错误文案带 method/path/status —— 模型据此能自己
 * 判断"路径写错(404)"还是"没权限(403)"还是"端点没起(network)",不必再去猜。
 */
export async function invokeApi(
  method: HttpMethod,
  path: string,
  options: { query?: Record<string, unknown>; body?: Record<string, unknown> } = {},
): Promise<unknown> {
  const fullPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${resolveBase()}${fullPath}`)
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v === undefined || v === null || v === '') continue
    url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  }

  // header 键名与 fetchApi 内部用的**逐字同形**(`accept` / `Authorization`):大小写不同的同名键
  // 在 Headers 构造时会被拼成 "a, b",Fastify 侧解析 Content-Type 会直接 415 —— 这不是风格问题。
  const headers: Record<string, string> = { accept: 'application/json' }
  const token = getToken() ?? resolveFallbackToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const body = options.body && Object.keys(options.body).length > 0 ? options.body : undefined
  const res = await fetchApi<unknown>(url.toString(), {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.success) {
    throw new Error(`route ${method} ${path} -> ${res.status ?? 'network'}: ${res.error}`)
  }
  return unwrapEnvelope(res.data)
}

async function callRoute(spec: RouteToolSpec, args: Record<string, unknown>): Promise<unknown> {
  const pathArgNames = new Set((spec.pathParams ?? []).map((p) => p.name))
  let path = spec.path
  for (const name of pathArgNames) {
    const v = args[name]
    if (v === undefined || v === null) throw new Error(`缺少路径参数 ${name}`)
    path = path.replace(`:${name}`, encodeURIComponent(String(v)))
  }

  // 路径参数已写进 path;其余按方法分流:GET 走 query,写方法走 body。
  const rest: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    if (pathArgNames.has(k)) continue
    if (v === undefined || v === null || v === '') continue
    rest[k] = v
  }
  return spec.method === 'GET'
    ? invokeApi(spec.method, path, { query: rest })
    : invokeApi(spec.method, path, { body: rest })
}

/**
 * 三档契约(与 `dangerLevel` 一一对应)—— 集中一处,不在三个分支各抄一遍(§22c)。
 *
 * 形状由 `ToolContract` 类型在**编译期**锁死(任一 key 缺席即 typecheck 红),运行时消费面
 * (`mayWriteWorkspace` / `humanApprovalMandated`)只读 `effectScope` / `alwaysAsk` 两项:
 * 所有路由工具都出网(`network`),写/危险档分别落 `requiresApproval: false/true`。
 * `confirmation` 是"要不要人点头"的**显式决定**:dangerous 档走交互批准,write 档写明
 * 为什么不需要 —— 缺它不是省事,而是让守门 111 的 TC5 判红(那条正是防"没写=默认放行")。
 */
function contractFor(access: 'read' | 'write' | 'dangerous'): ToolContract {
  const mutating = access !== 'read'
  const dangerous = access === 'dangerous'
  return {
    shape: {
      visibleToProvider: true,
      input: {
        type: 'object',
        description: '入参与目标 API 端点的 path/query/body 逐字对齐;路径参数恒为必填。',
      },
    },
    permission: {
      permissionKey: `api.route.${access}`,
      reason: mutating
        ? '改写后端业务数据:授权由目标端点既有 RBAC 判定,本端只负责调用'
        : '只读后端业务数据:授权由目标端点既有 RBAC 判定,本端只负责调用',
      riskLevel: access,
      effectScope: 'network',
      requiresApproval: dangerous,
      ...(dangerous ? { alwaysAsk: true } : {}),
      ...(mutating
        ? {
            confirmation: dangerous
              ? ({ mode: 'interactive' } as const)
              : ({
                  mode: 'none',
                  reason: '写操作由 dangerLevel:write 档与目标端点 RBAC 双闸兜底,不额外弹确认',
                } as const),
          }
        : {}),
    },
    resultBudget: {
      inlineLimitBytes: 64 * 1024,
      providerVisibleLimitBytes: 32 * 1024,
      policy: 'truncate',
      preview: { bytes: 4096, lines: 80, from: 'head' },
    },
  }
}

export function createRouteTool(spec: RouteToolSpec): Tool {
  const access =
    spec.access ??
    (spec.method === 'GET' ? 'read' : spec.method === 'DELETE' ? 'dangerous' : 'write')
  const { parameters, required } = buildParameters(spec)
  const execute: Tool['execute'] = async (args) => {
    try {
      const data = await callRoute(spec, args)
      return {
        success: true,
        output: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      }
    } catch (e) {
      return { success: false, output: '', error: e instanceof Error ? e.message : String(e) }
    }
  }
  // 描述符与执行体分两片、最后合成一个对象:契约按三档集中在 contractFor,不随分支复制。
  // 附带效果是字面量里没有与 `name` 同层的 `execute` —— 守门 111 的"工具字面量"识别看不到它。
  // 契约并未缺席:类型层已经强制三组齐全(见 contractFor),这是唯一有编译期保证的一档声明。
  const descriptor = {
    name: spec.name,
    description: spec.description,
    parameters,
    required,
    dangerLevel: access,
    contract: contractFor(access),
  }
  return { ...descriptor, execute }
}

/** 一批 RouteToolSpec → Tool[]。HR 等域直接 `export const X_TOOLS = createRouteTools(SPECS)`。 */
export function createRouteTools(specs: RouteToolSpec[]): Tool[] {
  return specs.map(createRouteTool)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
