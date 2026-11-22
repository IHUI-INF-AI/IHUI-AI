// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * API 桥工具族 —— 让 AI 能操作**全项目**端点,而不是只操作手写工具覆盖的那一小片。
 *
 * 立因(实测):仓库现有 5514 个 HTTP 端点(`scripts/scan-api-routes.mjs` 静态扫出,清单固化在
 * 同目录 `api-endpoints.generated.ts`;322 个域,0 个未解析注册目标)。给每个端点生成一枚独立
 * 工具是**不可行**的:工具 schema 进的是每一次系统提示,五千多枚等于把上下文预算烧干,模型
 * 选工具时也会失焦。真实可用的形状只有"目录 + 通用调用"两层:
 *
 *   ① 目录层 `api_list_endpoints` / `api_describe_endpoint`:离线检索端点(读编译进包的静态
 *      清单,零网络、零权限负担),模型先查再调;
 *   ② 调用层 `api_read` / `api_write` / `api_delete`:按 method + path 直达任意端点,与手写
 *      工具走同一条腿(`route-tools.ts` 的 `invokeApi` → `@ihui/api-client` 的 `fetchApi`),
 *      鉴权仍是"当前登录会话 + 目标端点自己的 RBAC",桥层不复制任何权限判据。
 *
 * 刻意不做的三件事(每一件都会把这套面变坏):
 *   · 不把端点摊成独立工具名 —— 那是把目录重新炸回 schema,原问题原样回来;
 *   · 不在桥层重写参数校验 —— 端点自己有 zod,桥层再编一遍就是第二份真相且必然漂移;
 *   · 不缓存响应 —— 工具结果会被预算层截断,缓存住的是截断后的副本,比没有更误导。
 */

import {
  API_ENDPOINTS_GENERATED_AT,
  API_ENDPOINTS_RAW,
  API_ENDPOINT_LINE_COUNT,
} from './api-endpoints.generated.js'
import { invokeApi, type HttpMethod } from './route-tools.js'
import type { Tool, ToolParameter, ToolResult } from './index.js'

/** 目录里的一条端点记录(字段序与生成器的行格式一致:method / path / domain / source / resolution)。 */
export interface ApiEndpointRecord {
  method: string
  path: string
  /** 路由归属域(由注册前缀推出),如 `hr-attendance` */
  domain: string
  /** 定义该端点的源文件,如 `apps/api/src/routes/hr-attendance/departments.ts` */
  source: string
  /** `exact` = 注册图直连可达;其余值表示扫描期推断(见 scanner 报告) */
  resolution: string
}

/** 惰性解析缓存:5514 行只在首次调用时切一次。 */
let catalogCache: ApiEndpointRecord[] | null = null

/** 端点目录(唯一解析点)。 */
export function endpointCatalog(): ApiEndpointRecord[] {
  if (catalogCache) return catalogCache
  const rows: ApiEndpointRecord[] = []
  for (const line of API_ENDPOINTS_RAW.split('\n')) {
    if (line === '') continue
    const [method, path, domain, source, resolution] = line.split('\t')
    if (!method || !path) continue
    rows.push({
      method,
      path,
      domain: domain ?? '',
      source: source ?? '',
      resolution: resolution ?? '',
    })
  }
  catalogCache = rows
  return rows
}

/** 路径里的 `:param` 占位(调用时必须替换成真实值)。 */
export function pathParamsOf(path: string): string[] {
  const out: string[] = []
  for (const m of path.matchAll(/:([A-Za-z0-9_]+)/g)) {
    const name = m[1]
    if (name !== undefined) out.push(name)
  }
  return out
}

function oneLine(record: ApiEndpointRecord, index: number): string {
  const inferred = record.resolution === 'exact' ? '' : ` (${record.resolution})`
  return `${index + 1}. ${record.method} ${record.path}  [${record.domain}]${inferred}`
}

function detailOf(record: ApiEndpointRecord): string {
  const params = pathParamsOf(record.path)
  const lines = [
    `${record.method} ${record.path}`,
    `  域: ${record.domain || '(未知)'}`,
    `  来源: ${record.source || '(未知)'}`,
    `  解析: ${record.resolution || '(未知)'}`,
    `  路径参数: ${params.length > 0 ? params.join(', ') : '无'}`,
  ]
  if (params.length > 0) {
    lines.push(`  注意: 调用前把 ${params.map((p) => `:${p}`).join(' / ')} 换成真实值(不要原样传)`)
  }
  if (record.method === 'GET') {
    lines.push(`  调用: api_read({ path: '${record.path}', query: { … } })`)
  } else if (record.method === 'DELETE') {
    lines.push(`  调用: api_delete({ path: '${record.path}' })`)
  } else {
    lines.push(`  调用: api_write({ method: '${record.method}', path: '${record.path}', body: { … } })`)
  }
  return lines.join('\n')
}

function asString(args: Record<string, unknown>, key: string): string {
  const v = args[key]
  return typeof v === 'string' ? v.trim() : ''
}

function asNumber(args: Record<string, unknown>, key: string, fallback: number): number {
  const v = args[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function asRecord(args: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const v = args[key]
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
  return v as Record<string, unknown>
}

/** 统一收口:path 必须是目录里的**完整路径**(含 `/api` 等前缀),否则 404 与拼错无从区分。 */
function assertInvocationPath(raw: string): string {
  const path = raw.trim()
  if (!path.startsWith('/')) {
    throw new Error(
      `path 必须是完整路径(以 / 开头、含 /api 等前缀),当前为 ${path === '' ? '(空)' : path};先用 api_list_endpoints 查目录`,
    )
  }
  if (/\s/.test(path)) throw new Error(`path 不得含空白字符: ${path}`)
  return path
}

/** 三个调用层工具共用的执行体:成功回 JSON 文本,失败回可归因的错误串(不抛给上层)。 */
async function runHttp(
  method: HttpMethod,
  args: Record<string, unknown>,
  withBody: boolean,
  queryOnly: boolean,
): Promise<ToolResult> {
  try {
    const path = assertInvocationPath(asString(args, 'path'))
    const query = queryOnly ? asRecord(args, 'query') : undefined
    const body = withBody ? asRecord(args, 'body') : undefined
    const data = await invokeApi(method, path, { query, body })
    return {
      success: true,
      output: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
    }
  } catch (e) {
    return { success: false, output: '', error: e instanceof Error ? e.message : String(e) }
  }
}

/** 声明:目录规模(写进描述,让模型知道检索面有多大,避免"以为只有几十个端点")。 */
const CATALOG_SIZE = API_ENDPOINT_LINE_COUNT
const CATALOG_BUILT_AT = API_ENDPOINTS_GENERATED_AT

const PATH_PARAM: ToolParameter = {
  type: 'string',
  description: '完整路径(含 /api 等前缀),如 /api/hr-attendance/departments;路径参数须替换成真实值',
}

export const API_BRIDGE_TOOLS: Tool[] = [
  {
    name: 'api_list_endpoints',
    description: `检索 **apps/api(Fastify)后端**的端点目录(离线读静态清单,零网络;共 ${CATALOG_SIZE} 个端点,清单生成于 ${CATALOG_BUILT_AT})。返回「序号 METHOD 路径 [域]」。标准用法:本工具定位端点 → api_describe_endpoint 看来源与路径参数 → api_read/api_write/api_delete 调用。

⚠️ 本清单**只覆盖 apps/api**。本仓还有第二套后端 **ai-service**(FastAPI,知识库/RAG/编排/agents/llm/mcp/memory/computer-use/sandbox 等 79 个能力域),它在 ai_* 族里(ai_list_endpoints / ai_read / ai_write / ai_delete)。在本目录里搜不到时,先换 ai_list_endpoints 再搜,不要断言「项目没有这个接口」。`,
    parameters: {
      q: {
        type: 'string',
        description: '关键字:对路径做大小写不敏感的子串匹配,如 attendance、leave、refund',
      },
      domain: {
        type: 'string',
        description: '域过滤:按域名的前缀匹配(如 hr 命中 hr-attendance),空则不限',
      },
      method: {
        type: 'string',
        description: 'HTTP 方法过滤,空则不限',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      },
      limit: { type: 'number', description: '返回条数上限(默认 40,上限 200)' },
      offset: { type: 'number', description: '分页偏移(默认 0)' },
    },
    required: [],
    dangerLevel: 'read',
    contract: {
      shape: { visibleToProvider: true, input: { type: 'object' } },
      permission: {
        permissionKey: 'api.catalog.list',
        reason: '只读编译进包的静态端点清单,不出网、不触达后端',
        riskLevel: 'read',
        effectScope: 'none',
        requiresApproval: false,
      },
      resultBudget: {
        inlineLimitBytes: 32 * 1024,
        providerVisibleLimitBytes: 16 * 1024,
        policy: 'truncate',
        preview: { bytes: 4096, lines: 80, from: 'head' },
      },
    },
    execute: async (args) => {
      const q = asString(args, 'q').toLowerCase()
      const domain = asString(args, 'domain').toLowerCase()
      const method = asString(args, 'method').toUpperCase()
      const limit = Math.min(Math.max(asNumber(args, 'limit', 40), 1), 200)
      const offset = Math.max(asNumber(args, 'offset', 0), 0)
      const hits = endpointCatalog().filter((r) => {
        if (method !== '' && r.method !== method) return false
        if (domain !== '' && !r.domain.toLowerCase().startsWith(domain)) return false
        if (q !== '' && !r.path.toLowerCase().includes(q)) return false
        return true
      })
      const page = hits.slice(offset, offset + limit)
      if (page.length === 0) {
        return {
          success: true,
          output: `无命中(过滤: q=${q || '-'} domain=${domain || '-'} method=${method || '-'},目录共 ${CATALOG_SIZE} 条)。换个更短的关键字,或不带过滤重试。`,
        }
      }
      const head = `命中 ${hits.length} / ${CATALOG_SIZE},本页 ${page.length} 条(offset=${offset}):`
      return { success: true, output: [head, ...page.map(oneLine)].join('\n') }
    },
  },
  {
    name: 'api_describe_endpoint',
    description:
      '查看单个端点的详情(离线,零网络):归属域、定义源文件、解析方式、路径参数,以及该用哪个调用工具、怎么传参。path 省略方法时把该路径的所有方法一并列出。',
    parameters: {
      path: PATH_PARAM,
      method: {
        type: 'string',
        description: 'HTTP 方法(省略则列出该路径的全部方法)',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      },
    },
    required: ['path'],
    dangerLevel: 'read',
    contract: {
      shape: { visibleToProvider: true, input: { type: 'object' } },
      permission: {
        permissionKey: 'api.catalog.describe',
        reason: '只读编译进包的静态端点清单,不出网、不触达后端',
        riskLevel: 'read',
        effectScope: 'none',
        requiresApproval: false,
      },
      resultBudget: {
        inlineLimitBytes: 32 * 1024,
        providerVisibleLimitBytes: 16 * 1024,
        policy: 'truncate',
        preview: { bytes: 4096, lines: 80, from: 'head' },
      },
    },
    execute: async (args) => {
      const raw = asString(args, 'path')
      const method = asString(args, 'method').toUpperCase()
      const all = endpointCatalog()
      let path = raw
      if (!path.startsWith('/')) path = `/${path}`
      const exact = all.filter((r) => r.path === path && (method === '' || r.method === method))
      if (exact.length > 0) {
        return { success: true, output: exact.map(detailOf).join('\n\n') }
      }
      const samePath = all.filter((r) => r.path === path)
      if (samePath.length > 0) {
        return {
          success: true,
          output: `方法 ${method || '(未指定)'} 未在此路径上注册;该路径存在这些方法:\n${samePath.map(detailOf).join('\n\n')}`,
        }
      }
      // 近邻:同域前缀下路径包含末端片段者,给模型一条重新检索的线索(不猜端点,只提示)。
      const tail = path.split('/').filter(Boolean).pop() ?? ''
      const near = tail === '' ? [] : all.filter((r) => r.path.includes(tail)).slice(0, 10)
      const hint =
        near.length > 0
          ? `相近的 ${near.length} 条:\n${near.map((r, i) => oneLine(r, i)).join('\n')}`
          : '换个关键字用 api_list_endpoints 检索。'
      return {
        success: false,
        output: '',
        error: `目录里没有 ${method || ''} ${path}。${hint}`,
      }
    },
  },
  {
    name: 'api_read',
    description:
      '调用任一 GET 端点并返回 JSON(只读)。path 用目录里的完整路径(含 /api 前缀),query 传查询参数对象。非 GET 端点请改用 api_write / api_delete。响应若是 { code, message, data } 信封会自动拆出 data。',
    parameters: {
      path: PATH_PARAM,
      query: {
        type: 'object',
        description: '查询参数(键值均为字符串;省略即不带 query)',
        additionalProperties: { type: 'string', description: '查询参数值(统一按字符串传)' },
      },
    },
    required: ['path'],
    dangerLevel: 'read',
    contract: {
      shape: { visibleToProvider: true, input: { type: 'object' } },
      permission: {
        permissionKey: 'api.invoke.get',
        reason: '只读调用:授权由目标端点既有 RBAC 判定,桥层不复制权限判据',
        riskLevel: 'read',
        effectScope: 'network',
        requiresApproval: false,
      },
      resultBudget: {
        inlineLimitBytes: 64 * 1024,
        providerVisibleLimitBytes: 32 * 1024,
        policy: 'truncate',
        preview: { bytes: 4096, lines: 80, from: 'head' },
      },
    },
    execute: async (args) => runHttp('GET', args, false, true),
  },
  {
    name: 'api_write',
    description:
      '调用变更类端点(POST / PUT / PATCH)并返回 JSON。path 用目录里的完整路径,body 传请求体对象(字段名与端点 zod schema 一致)。删除类端点请改用 api_delete。',
    parameters: {
      method: {
        type: 'string',
        description: 'HTTP 方法(只接受变更类)',
        enum: ['POST', 'PUT', 'PATCH'],
      },
      path: PATH_PARAM,
      body: {
        type: 'object',
        description: '请求体 JSON 对象(省略即空对象;字段名须与端点 schema 一致)',
        additionalProperties: true,
      },
    },
    required: ['method', 'path'],
    dangerLevel: 'write',
    contract: {
      shape: { visibleToProvider: true, input: { type: 'object' } },
      permission: {
        permissionKey: 'api.invoke.write',
        reason: '变更类调用:授权由目标端点既有 RBAC 与 schema 校验判定,桥层不复制权限判据',
        riskLevel: 'write',
        effectScope: 'network',
        requiresApproval: false,
        confirmation: {
          mode: 'none',
          reason: '写操作由 dangerLevel:write 档立即执行、由目标端点 RBAC 判定授权;删除类已单列为 dangerous 档',
        },
      },
      resultBudget: {
        inlineLimitBytes: 64 * 1024,
        providerVisibleLimitBytes: 32 * 1024,
        policy: 'truncate',
        preview: { bytes: 4096, lines: 80, from: 'head' },
      },
    },
    execute: async (args) => {
      const method = asString(args, 'method').toUpperCase()
      if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
        return {
          success: false,
          output: '',
          error: `api_write 只接受 POST/PUT/PATCH,收到 ${method || '(空)'};删除请用 api_delete,读取请用 api_read`,
        }
      }
      return runHttp(method, args, true, false)
    },
  },
  {
    name: 'api_delete',
    description:
      '调用 DELETE 端点删除后端资源(危险档,执行前需用户确认)。path 用目录里的完整路径;资源 ID 写在路径里(如 /api/xxx/:id),个别端点用 body 传删除参数。',
    parameters: {
      path: PATH_PARAM,
      body: {
        type: 'object',
        description: '可选请求体(DELETE 一般不需要;仅端点明确要求时传)',
        additionalProperties: true,
      },
    },
    required: ['path'],
    dangerLevel: 'dangerous',
    contract: {
      shape: { visibleToProvider: true, input: { type: 'object' } },
      permission: {
        permissionKey: 'api.invoke.delete',
        reason: '删除不可逆:即使目标端点 RBAC 放行,也须由人确认后才执行',
        riskLevel: 'dangerous',
        effectScope: 'network',
        requiresApproval: true,
        alwaysAsk: true,
        confirmation: { mode: 'interactive' },
      },
      resultBudget: {
        inlineLimitBytes: 64 * 1024,
        providerVisibleLimitBytes: 32 * 1024,
        policy: 'truncate',
        preview: { bytes: 4096, lines: 80, from: 'head' },
      },
    },
    execute: async (args) => runHttp('DELETE', args, true, false),
  },
]
