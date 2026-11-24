// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**

/**
 * ai-service 桥工具族(2026-11-13 立)—— 补上 CLI 侧"整个项目所有接口"的最后一半。
 *
 * 立因(实测现读):
 *   `api-bridge.ts` 的 `api_*` 族只覆盖 **apps/api**(Fastify,5539 条端点)。承载 AI 能力本身的
 *   **ai-service**(FastAPI)有 **682 operation / 621 path / 79 个能力域**,而 CLI 侧
 *   `grep ai_read|ai_list_endpoints` **零命中** —— 知识库、RAG、编排、memory、agent-runtime、
 *   computer-use、sandbox 这些能力对模型完全不可见。这与"让 AI 无缝调用整个项目所有接口"
 *   的目标之间,缺的正是这一档。
 *
 * 与 `api-bridge.ts` 的关系(刻意同形,不另创造型):
 *   同样是**两层**结构 —— 目录层(离线检索静态清单,零网络)+ 调用层(按 method+path 直达任意端点)。
 *   这不是"抄第二份实现":两层结构是端点数量(682)决定的唯一可用形状 —— 把 682 枚摊成 682 个
 *   独立工具名会把常驻 schema 预算烧干,模型选工具也会失焦。差异只有三处,**都是被载体逼出来的**:
 *     ① 清单来源 = ai-service 运行时 OpenAPI(`scripts/scan-ai-service-routes.mjs`),不是静态扫源码;
 *     ② 传输腿 = `fetchAiServiceJson`(ai-service 专用基址通道 + 401 静默续期),不是 `fetchApi`;
 *     ③ 工具名前缀 = `ai_`(`api_` 已被 apps/api 占用,同前缀会让 `--disallowed-tools` 无法按服务表达)。
 *
 * 分层(AGENTS §3 拆档,判据一条没动):
 *   - `ai-bridge-catalog.ts` — 目录层:行清单 → 记录、path 占位抽取(零网络)
 *   - `ai-bridge-runner.ts`  — 调用层:`{param}` 填充、path 合法性、query/body 分流、失败归因
 *   - 本文件 — 五枚工具的定义与契约(三档集中一处)
 *
 * 刻意不做的三件事(与 api-bridge 同一条纪律):
 *   · 不把端点摊成独立工具名 —— 那把目录重新炸回 schema,原问题原样回来;
 *   · 不在桥层重写参数校验 —— 端点自己有 Pydantic 模型,桥层再编一遍就是第二份真相且必然漂移;
 *   · 不缓存响应 —— 工具结果会被预算层截断,缓存住的是截断后的副本,比没有更误导。
 */

import {
  AI_ENDPOINT_LINE_COUNT,
  AI_ENDPOINTS_GENERATED_AT,
} from './ai-endpoints.generated.js'
import { aiEndpointCatalog, type AiEndpointRecord } from './ai-bridge-catalog.js'
import { asNumber, asString, normalizeTail, runAiHttp } from './ai-bridge-runner.js'
import type { Tool, ToolParameter } from './index.js'

export { aiEndpointCatalog, aiPathParamsOf, type AiEndpointRecord } from './ai-bridge-catalog.js'
export { resolveAiBase } from './ai-bridge-runner.js'

/**
 * 三档契约(与 `dangerLevel` 一一对应)—— 集中一处,不在三个分支各抄一遍(§22c)。
 *
 * 与 `route-tools.ts#contractFor` 的差别只有 `permissionKey` 前缀(`ai.route.*`)与 reason 文案:
 * 同一份 `ToolContract` 形状,消费面(`mayWriteWorkspace` / `humanApprovalMandated`)零改动。
 */
function contractFor(access: 'read' | 'write' | 'dangerous') {
  const mutating = access !== 'read'
  const dangerous = access === 'dangerous'
  return {
    shape: {
      visibleToProvider: true,
      input: {
        type: 'object' as const,
        description: '入参与目标 ai-service 端点的 path/query/body 逐字对齐;路径参数恒为必填。',
      },
    },
    permission: {
      permissionKey: `ai.route.${access}`,
      reason: mutating
        ? '改写 ai-service 侧状态(知识库/编排/会话/记忆等):授权由目标端点既有鉴权判定,本端只负责调用'
        : '只读 ai-service 侧数据:授权由目标端点既有鉴权判定,本端只负责调用',
      riskLevel: access,
      effectScope: 'network' as const,
      requiresApproval: dangerous,
      ...(dangerous ? { alwaysAsk: true } : {}),
      ...(mutating
        ? {
            confirmation: dangerous
              ? ({ mode: 'interactive' } as const)
              : ({
                  mode: 'none',
                  reason: '写操作由 dangerLevel:write 档与目标端点鉴权双闸兜底,不额外弹确认',
                } as const),
          }
        : {}),
    },
    resultBudget: {
      inlineLimitBytes: 64 * 1024,
      providerVisibleLimitBytes: 32 * 1024,
      policy: 'truncate' as const,
      preview: { bytes: 4096, lines: 80, from: 'head' as const },
    },
  }
}

/** 调用层三枚工具共用的执行体:成功回 JSON 文本,失败回可归因的错误串(不抛给上层)。 */
/** 目录层两枚工具的参数形态(与 api-bridge 逐字同形,便于模型迁移已有习惯)。 */
const CATALOG_PATH_PARAM: ToolParameter = {
  type: 'string',
  description: '完整路径(含 /api 等前缀),如 /api/knowledge/cards;路径参数须替换成真实值',
}

function oneLine(record: AiEndpointRecord, index: number): string {
  const summary = record.summary ? `  ${record.summary}` : ''
  return `${index + 1}. ${record.method} ${record.path}  [${record.domain}]${summary}`
}

function detailOf(record: AiEndpointRecord): string {
  const lines = [
    `${record.method} ${record.path}`,
    `  域: ${record.domain || '(未知)'}`,
    `  operationId: ${record.operationId || '(无)'}`,
    `  摘要: ${record.summary || '(无)'}`,
    `  路径参数: ${record.pathParams.length > 0 ? record.pathParams.join(', ') : '无'}`,
  ]
  // 占位提示 + **可直接照抄的形态**(2026-11-13 实测补):
  // 原先只写一句"把 {x} 换成真实值",而示例里仍带着 `{x}` —— 模型照抄示例是最常见的行为,
  // 于是 `{plan_id}` 原样发出 → 后端把这一整段当字面量 → 语义不明的 404。
  // 现在把示例里的占位换成一个显眼的占位符,并把"路径参数作为同名字段传入"写成示例的一部分。
  const hasParams = record.pathParams.length > 0
  const paramHint = hasParams
    ? record.pathParams.map((p) => `${p}: '<真实 ${p}>'`).join(', ')
    : ''
  const examplePath = hasParams
    ? record.path.replace(/\{([^}]+)\}/g, (_m, n: string) => `<${n}>`)
    : record.path
  if (hasParams) {
    lines.push(
      `  注意: 调用前把 ${record.pathParams.map((p) => `{${p}}`).join(' / ')} 换成真实值(不要原样传)`,
      `  路径参数作为**同名字段**与 path 一起传:${paramHint}`,
    )
  }
  if (record.method === 'GET') {
    lines.push(`  调用: ai_read({ path: '${examplePath}'${hasParams ? `, ${paramHint}` : ''}, query: { … } })`)
  } else if (record.method === 'DELETE') {
    lines.push(`  调用: ai_delete({ path: '${examplePath}'${hasParams ? `, ${paramHint}` : ''} })`)
  } else {
    lines.push(
      `  调用: ai_write({ method: '${record.method}', path: '${examplePath}'${hasParams ? `, ${paramHint}` : ''}, body: { … } })`,
    )
  }
  return lines.join('\n')
}

export const AI_BRIDGE_TOOLS: Tool[] = [
  {
    name: 'ai_list_endpoints',
    description: `检索 **ai-service(FastAPI)后端** 的端点目录(离线读静态清单,零网络;共 ${AI_ENDPOINT_LINE_COUNT} 个端点,清单生成于 ${AI_ENDPOINTS_GENERATED_AT})。覆盖知识库/RAG/编排/agents/llm/mcp/memory/computer-use/sandbox 等 79 个能力域 —— 这是 **apps/api 之外的另一半后端**。返回「序号 METHOD 路径 [域] 摘要」。标准用法:本工具定位端点 → ai_describe_endpoint 看 operationId 与路径参数 → ai_read/ai_write/ai_delete 调用。

⚠️ 本清单**只覆盖 ai-service**。业务域接口(人事/电商/内容/订单/工作区等)在 **apps/api**,属 api_* 族(api_list_endpoints / api_read / api_write / api_delete)。这里搜不到时换 api_list_endpoints 再搜,不要断言「项目没有这个接口」。`,
    parameters: {
      q: {
        type: 'string',
        description: '关键字:对路径、摘要、operationId、tags 做大小写不敏感的子串匹配,如 knowledge、rag、orchestration',
      },
      domain: {
        type: 'string',
        description: '域过滤:按域名的前缀匹配(如 agent 命中 agents/agent-runtime),空则不限',
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
    contract: contractFor('read'),
    async execute(args) {
      try {
        const all = aiEndpointCatalog()
        const q = asString(args, 'q').toLowerCase()
        const domain = asString(args, 'domain').toLowerCase()
        const method = asString(args, 'method').toUpperCase()
        const limit = Math.min(Math.max(asNumber(args, 'limit', 40), 1), 200)
        const offset = Math.max(asNumber(args, 'offset', 0), 0)

        const matched = all.filter((r) => {
          if (method && r.method !== method) return false
          if (domain && !r.domain.toLowerCase().startsWith(domain)) return false
          if (!q) return true
          return (
            r.path.toLowerCase().includes(q) ||
            r.summary.toLowerCase().includes(q) ||
            r.operationId.toLowerCase().includes(q) ||
            r.tags.some((t) => t.toLowerCase().includes(q))
          )
        })

        const page = matched.slice(offset, offset + limit)
        if (page.length === 0) {
          return {
            success: true,
            output: `没有匹配的端点(共 ${all.length} 个在册;已过 q=${q || '(空)'} domain=${domain || '(空)'} method=${method || '(空)'})。换个关键字或去掉过滤条件再试。`,
          }
        }
        const header = `命中 ${matched.length} 个,显示 ${offset + 1}-${offset + page.length}(共 ${all.length} 个在册端点):`
        return { success: true, output: [header, ...page.map((r, i) => oneLine(r, offset + i))].join('\n') }
      } catch (e) {
        return { success: false, output: '', error: e instanceof Error ? e.message : String(e) }
      }
    },
  },
  {
    name: 'ai_describe_endpoint',
    description:
      '查看某个 ai-service 端点的来源域、operationId、摘要、路径参数,并给出可直接照抄的调用示例。先用 ai_list_endpoints 拿到完整 path,再来这里确认调用形态。',
    parameters: {
      method: {
        type: 'string',
        description: 'HTTP 方法(GET/POST/PUT/PATCH/DELETE)',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      },
      path: CATALOG_PATH_PARAM,
    },
    required: ['method', 'path'],
    dangerLevel: 'read',
    contract: contractFor('read'),
    async execute(args) {
      try {
        const method = asString(args, 'method').toUpperCase()
        const path = normalizeTail(asString(args, 'path'))
        const matches = aiEndpointCatalog().filter((r) => r.path === path && (!method || r.method === method))
        if (matches.length === 0) {
          const byPath = aiEndpointCatalog().filter((r) => r.path === path)
          if (byPath.length > 0) {
            return {
              success: true,
              output: `该 path 在册但方法不匹配。可用方法:${byPath.map((r) => r.method).join(' / ')}。`,
            }
          }
          return {
            success: true,
            output: `目录里没有 ${method} ${path}。用 ai_list_endpoints 按关键字重新检索(注意 path 必须含 /api 等前缀)。`,
          }
        }
        return { success: true, output: matches.map(detailOf).join('\n\n') }
      } catch (e) {
        return { success: false, output: '', error: e instanceof Error ? e.message : String(e) }
      }
    },
  },
  {
    name: 'ai_read',
    description:
      '调用任一 ai-service GET 端点并返回 JSON(只读)。path 用目录里的完整路径(含 /api 前缀),query 传查询参数对象。非 GET 端点请改用 ai_write / ai_delete。',
    parameters: {
      path: CATALOG_PATH_PARAM,
      query: { type: 'object', description: '查询参数对象(字段名与端点参数一致);数组按重复键展开' },
    },
    required: ['path'],
    dangerLevel: 'read',
    contract: contractFor('read'),
    async execute(args) {
      return runAiHttp('GET', args)
    },
  },
  {
    name: 'ai_write',
    description:
      '调用 ai-service 变更类端点(POST / PUT / PATCH)并返回 JSON。path 用目录里的完整路径,body 传请求体对象(字段名与端点模型一致)。删除类端点请改用 ai_delete。',
    parameters: {
      method: {
        type: 'string',
        description: '写方法:POST / PUT / PATCH',
        enum: ['POST', 'PUT', 'PATCH'],
      },
      path: CATALOG_PATH_PARAM,
      body: { type: 'object', description: '请求体对象(字段名与端点 Pydantic 模型一致)' },
      query: { type: 'object', description: '可选查询参数对象' },
    },
    required: ['method', 'path'],
    dangerLevel: 'write',
    contract: contractFor('write'),
    async execute(args) {
      const method = asString(args, 'method').toUpperCase()
      if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
        return {
          success: false,
          output: '',
          error: `ai_write 只接受 POST/PUT/PATCH,收到 ${method || '(空)'};删除请用 ai_delete,读取请用 ai_read`,
        }
      }
      return runAiHttp(method, args)
    },
  },
  {
    name: 'ai_delete',
    description:
      '调用 ai-service DELETE 端点(危险动作,需批准)。path 用目录里的完整路径;路径参数直接作为同名字段传入。',
    parameters: {
      path: CATALOG_PATH_PARAM,
      query: { type: 'object', description: '可选查询参数对象(DELETE 多数只带 path/query)' },
    },
    required: ['path'],
    dangerLevel: 'dangerous',
    contract: contractFor('dangerous'),
    async execute(args) {
      return runAiHttp('DELETE', args)
    },
  },
]

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
