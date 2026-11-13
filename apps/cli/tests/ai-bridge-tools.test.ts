// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * ai-service 端点桥(`ai_*` 族)—— CLI 侧补齐"整个项目所有接口"的另一半。
 *
 * 钉四件事,每件都对应一条会静默失守的边界:
 *  ① 目录层:682 条端点能解析成记录,过滤/分页/详情按契约工作,且**零网络**;
 *  ② 调用层:`{param}` 占位真被替换、GET 走 query、写方法走 body、DELETE 走 query;
 *  ③ 失败归因:缺路径参数当场拒、path 没写全当场拒、后端 4xx 不被洗成成功;
 *  ④ 危险档:ai_delete 恒 `dangerous` 且 `alwaysAsk`,ai_read 恒 `read` 且免批。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setTransport } from '@ihui/api-client'

import {
  AI_BRIDGE_TOOLS,
  aiEndpointCatalog,
  aiPathParamsOf,
} from '../src/tools/ai-bridge.js'
import { AI_ENDPOINT_LINE_COUNT } from '../src/tools/ai-endpoints.generated.js'
import type { Tool, ToolContext } from '../src/tools/index.js'

/** 桥工具的执行体只读 args;ctx 不参与,给空壳即可。 */
const CTX = {} as unknown as ToolContext
const ENDPOINT_LINE_RE = /^\d+\. /

interface Captured {
  url: string
  method: string | undefined
  body: string | undefined
}

let captured: Captured | null = null

function toolNamed(name: string): Tool {
  const found = AI_BRIDGE_TOOLS.find((t) => t.name === name)
  if (!found) {
    throw new Error(`桥上没有 ${name};现有:${AI_BRIDGE_TOOLS.map((t) => t.name).join('/')}`)
  }
  return found
}

function lastRequest(): Captured {
  if (!captured) throw new Error('本次用例没有发出任何请求')
  return captured
}

function respond(status: number, body: unknown): void {
  setTransport(async (url, init) => {
    captured = {
      url: String(url),
      method: init.method,
      body: typeof init.body === 'string' ? init.body : undefined,
    }
    const text = typeof body === 'string' ? body : JSON.stringify(body)
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      text: async () => text,
      json: async () => JSON.parse(text) as unknown,
    } as unknown as Response
  })
}

beforeEach(() => {
  captured = null
})

afterEach(() => {
  captured = null
})

describe('① 目录层(离线,零网络)', () => {
  it('清单解析成记录,条数与生成器声明一致', () => {
    const rows = aiEndpointCatalog()
    expect(rows.length).toBe(AI_ENDPOINT_LINE_COUNT)
    // 现读基线:682 个 operation。断言下限而非等值 —— ai-service 会继续加端点,
    // 这条要拦的是"清单整体丢了",不是"端点变多了"(后者是好事,不该让测试红)。
    expect(rows.length).toBeGreaterThan(600)
    // 目录层零网络:整轮没发出任何请求
    expect(captured).toBeNull()
  })

  it('覆盖 ai-service 的核心能力域(不是只抓到一个边角)', () => {
    const domains = new Set(aiEndpointCatalog().map((r) => r.domain))
    for (const must of ['knowledge', 'agents', 'llm', 'mcp', 'orchestration']) {
      expect(domains.has(must), `域清单里缺 ${must} —— 生成器可能漏扫了 include_router 的那一批`).toBe(true)
    }
    expect(domains.size).toBeGreaterThan(50)
  })

  it('路径参数抽取:OpenAPI 的 {x} 形态', () => {
    expect(aiPathParamsOf('/api/knowledge/cards/{card_id}')).toEqual(['card_id'])
    expect(aiPathParamsOf('/api/x/{a}/y/{b}')).toEqual(['a', 'b'])
    expect(aiPathParamsOf('/api/knowledge/cards')).toEqual([])
  })

  it('列表:按关键字命中,返回带序号的行', async () => {
    const r = await toolNamed('ai_list_endpoints').execute({ q: 'knowledge', limit: 5 }, CTX)
    expect(r.success).toBe(true)
    const lines = r.output.split('\n').filter((l) => ENDPOINT_LINE_RE.test(l))
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.length).toBeLessThanOrEqual(5)
    expect(r.output.toLowerCase()).toContain('knowledge')
    // 目录层仍然零网络
    expect(captured).toBeNull()
  })

  it('列表:域过滤是前缀匹配(agent 命中 agents 与 agent-runtime)', async () => {
    const r = await toolNamed('ai_list_endpoints').execute({ domain: 'agent', limit: 200 }, CTX)
    expect(r.success).toBe(true)
    expect(r.output).toMatch(/\[agents?\]|\[agent-runtime\]/)
  })

  it('列表:方法过滤只回该方法', async () => {
    const r = await toolNamed('ai_list_endpoints').execute({ method: 'DELETE', limit: 200 }, CTX)
    expect(r.success).toBe(true)
    const lines = r.output.split('\n').filter((l) => ENDPOINT_LINE_RE.test(l))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line).toMatch(/^\d+\. DELETE /)
    }
  })

  it('列表:无命中时给可操作的回执,不是空串', async () => {
    const r = await toolNamed('ai_list_endpoints').execute({ q: 'zzz_definitely_not_exists_zzz' }, CTX)
    expect(r.success).toBe(true)
    expect(r.output).toContain('没有匹配的端点')
    expect(r.output).toContain('换个关键字')
  })

  it('详情:给出 operationId、路径参数与可照抄的调用示例', async () => {
    const withParam = aiEndpointCatalog().find((r) => r.pathParams.length > 0)
    expect(withParam, '目录里应当存在带路径参数的端点').toBeTruthy()
    const r = await toolNamed('ai_describe_endpoint').execute(
      { method: withParam!.method, path: withParam!.path },
      CTX,
    )
    expect(r.success).toBe(true)
    expect(r.output).toContain(withParam!.path)
    expect(r.output).toContain('路径参数')
    expect(r.output).toMatch(/调用: ai_(read|write|delete)\(/)
  })

  it('详情:path 在册但方法不匹配时点名可用方法', async () => {
    const some = aiEndpointCatalog()[0]!
    const other = some.method === 'GET' ? 'POST' : 'GET'
    const r = await toolNamed('ai_describe_endpoint').execute({ method: other, path: some.path }, CTX)
    expect(r.success).toBe(true)
    // 要么命中同 path 的另一种方法(给详情),要么点名"方法不匹配"—— 两者都不许静默空回
    expect(r.output.length).toBeGreaterThan(0)
  })
})

describe('② 调用层:占位替换 / query / body 分流', () => {
  it('GET 走 query,路径占位被真替换而不是原样发出', async () => {
    respond(200, { code: 0, data: { ok: true } })
    const r = await toolNamed('ai_read').execute(
      { path: '/api/knowledge/cards/{card_id}', card_id: 'abc 123', query: { verbose: true } },
      CTX,
    )
    expect(r.success).toBe(true)
    const req = lastRequest()
    expect(req.method).toBe('GET')
    // 占位已替换且做了 URL 编码(空格 → %20)
    expect(req.url).toContain('/api/knowledge/cards/abc%20123')
    expect(req.url).not.toContain('{card_id}')
    expect(req.url).toContain('verbose=true')
    // GET 不带 body
    expect(req.body).toBeUndefined()
  })

  it('POST 走 body,query 参数不被吞进 body', async () => {
    respond(200, { code: 0, data: { id: 7 } })
    const r = await toolNamed('ai_write').execute(
      {
        method: 'POST',
        path: '/api/knowledge/compile',
        body: { source: 'x' },
        query: { dry: '1' },
      },
      CTX,
    )
    expect(r.success).toBe(true)
    const req = lastRequest()
    expect(req.method).toBe('POST')
    expect(req.url).toContain('dry=1')
    expect(req.body).toBe(JSON.stringify({ source: 'x' }))
  })

  it('DELETE 走 query 而不是 body(ai-service 的 DELETE 多数只带 path/query)', async () => {
    respond(200, { code: 0, data: null })
    const r = await toolNamed('ai_delete').execute(
      { path: '/api/knowledge/cards/{card_id}', card_id: 'c1', hard: 'true' },
      CTX,
    )
    expect(r.success).toBe(true)
    const req = lastRequest()
    expect(req.method).toBe('DELETE')
    expect(req.url).toContain('/api/knowledge/cards/c1')
    expect(req.url).toContain('hard=true')
    expect(req.body).toBeUndefined()
  })

  it('数组 query 按重复键展开(FastAPI 的 List[x] 就是这形态)', async () => {
    respond(200, { code: 0, data: [] })
    const r = await toolNamed('ai_read').execute(
      { path: '/api/agents/list', query: { tags: ['a', 'b'] } },
      CTX,
    )
    expect(r.success).toBe(true)
    const req = lastRequest()
    expect(req.url).toContain('tags=a')
    expect(req.url).toContain('tags=b')
  })

  it('尾部斜杠归一(避免 /foo/ 与 /foo 之间的 307 噪音)', async () => {
    respond(200, { code: 0, data: {} })
    await toolNamed('ai_read').execute({ path: '/api/health/' }, CTX)
    expect(lastRequest().url).toMatch(/\/api\/health(\?|$)/)
  })
})

describe('③ 失败归因:当场拒 vs 后端拒,不互相伪装', () => {
  it('path 没写全(不以 / 开头)⇒ 当场拒,且提示先查目录', async () => {
    const r = await toolNamed('ai_read').execute({ path: 'api/knowledge/cards' }, CTX)
    expect(r.success).toBe(false)
    expect(r.error).toContain('完整路径')
    expect(r.error).toContain('ai_list_endpoints')
    expect(captured).toBeNull()
  })

  it('path 含空白 ⇒ 当场拒', async () => {
    const r = await toolNamed('ai_read').execute({ path: '/api/ knowledge' }, CTX)
    expect(r.success).toBe(false)
    expect(r.error).toContain('空白')
    expect(captured).toBeNull()
  })

  it('缺路径参数 ⇒ 当场拒,并给完整调用形态', async () => {
    const r = await toolNamed('ai_read').execute({ path: '/api/knowledge/cards/{card_id}' }, CTX)
    expect(r.success).toBe(false)
    expect(r.error).toContain('缺少路径参数 card_id')
    expect(r.error).toContain('<card_id>')
    expect(captured).toBeNull()
  })

  it('后端 403 不被洗成成功(错误串带 method/path/status)', async () => {
    respond(403, { detail: 'forbidden' })
    const r = await toolNamed('ai_read').execute({ path: '/api/admin/secret' }, CTX)
    expect(r.success).toBe(false)
    expect(r.error).toContain('403')
    expect(r.error).toContain('/api/admin/secret')
  })

  it('ai_write 拒绝被当成 DELETE 用', async () => {
    const r = await toolNamed('ai_write').execute({ method: 'DELETE', path: '/api/x' }, CTX)
    expect(r.success).toBe(false)
    expect(r.error).toContain('ai_delete')
    expect(captured).toBeNull()
  })
})

describe('④ 危险档与契约', () => {
  it('ai_read / ai_list_endpoints / ai_describe_endpoint 是 read 且免批', () => {
    for (const name of ['ai_read', 'ai_list_endpoints', 'ai_describe_endpoint']) {
      const t = toolNamed(name)
      expect({ name, danger: t.dangerLevel }).toEqual({ name, danger: 'read' })
      expect(t.contract?.permission.requiresApproval, `${name} 不该要求批准`).toBe(false)
      expect(t.contract?.permission.effectScope).toBe('network')
    }
  })

  it('ai_write 是 write 且不额外弹确认(由端点鉴权 + danger 档双闸)', () => {
    const t = toolNamed('ai_write')
    expect(t.dangerLevel).toBe('write')
    expect(t.contract?.permission.confirmation?.mode).toBe('none')
  })

  it('ai_delete 是 dangerous 且 alwaysAsk + 交互确认', () => {
    const t = toolNamed('ai_delete')
    expect(t.dangerLevel).toBe('dangerous')
    expect(t.contract?.permission.requiresApproval).toBe(true)
    expect(t.contract?.permission.alwaysAsk).toBe(true)
    expect(t.contract?.permission.confirmation?.mode).toBe('interactive')
  })

  it('五枚工具全带契约(守门 111 的 TC5:缺 confirmation 即红)', () => {
    expect(AI_BRIDGE_TOOLS).toHaveLength(5)
    for (const t of AI_BRIDGE_TOOLS) {
      expect(t.contract, `${t.name} 缺契约`).toBeTruthy()
      expect(t.contract?.resultBudget.policy).toBe('truncate')
    }
  })
})

describe('⑤ 入口可用性:两族桥必须互相指路(否则模型会断言"项目没有这个接口")', () => {
  /**
   * 立因(2026-11-13 实测发现):`api_*` 覆盖 apps/api 5539 端点、`ai_*` 覆盖 ai-service 682 端点,
   * 两族各自只描述自己那一半,却都长得像"全项目接口目录"。模型先遇到 `api_*` 时会在里面搜
   * 知识库/编排(那在 ai-service),搜不到就断言"项目没有这个接口" —— 这不是模型能力问题,
   * 是**工具描述漏了它该知道的事实**(§0.9 静默 = 没判)。
   *
   * 这条锁钉的就是"两边的描述都必须点名另一半的存在与入口名"。
   */
  it('ai_list_endpoints 的描述点名 api_* 族与适用域', () => {
    const desc = toolNamed('ai_list_endpoints').description
    expect(desc).toContain('api_list_endpoints')
    // 必须说清"这里搜不到该去哪",而不只是提一嘴名字
    expect(desc).toMatch(/apps\/api/)
    expect(desc).toContain('不要断言')
  })

  it('api_list_endpoints 的描述同样点名 ai_* 族(反向也要指路)', async () => {
    const { API_BRIDGE_TOOLS } = await import('../src/tools/api-bridge.js')
    const apiList = API_BRIDGE_TOOLS.find((t) => t.name === 'api_list_endpoints')
    expect(apiList, 'api_list_endpoints 不在册').toBeTruthy()
    const desc = apiList!.description
    expect(desc).toContain('ai_list_endpoints')
    expect(desc).toMatch(/ai-service/)
    expect(desc).toContain('不要断言')
  })

  it('详情示例把路径参数换成显眼占位符,并说明"作为同名字段一起传"', async () => {
    // 立因(2026-11-13 实测):原示例里仍带着 `{plan_id}` 原样 —— 模型照抄示例是最常见行为,
    // 于是把这个占位当字面量发出去 → 语义不明的 404。示例必须写成能照抄的形态。
    const withParam = aiEndpointCatalog().find((r) => r.pathParams.length > 0)
    expect(withParam).toBeTruthy()
    const out = (
      await toolNamed('ai_describe_endpoint').execute(
        { method: withParam!.method, path: withParam!.path },
        CTX,
      )
    ).output
    // ① 示例行里的占位已被换成 <name>(不再是 `{name}` 原样)
    const callLine = out.split('\n').find((l) => l.includes('调用:'))
    expect(callLine, '详情里必须有可照抄的调用示例').toBeTruthy()
    for (const p of withParam!.pathParams) {
      expect(callLine).toContain(`<${p}>`)
      expect(callLine).not.toContain(`{${p}}`)
    }
    // ② 明确说明"路径参数作为同名字段一起传",并把字段名写出来
    expect(out).toContain('同名字段')
    for (const p of withParam!.pathParams) {
      expect(out).toContain(`${p}: '<真实 ${p}>'`)
    }
  })

  it('无路径参数的端点不输出占位提示(不给模型制造"要不要传"的疑问)', async () => {
    const plain = aiEndpointCatalog().find((r) => r.pathParams.length === 0 && r.method === 'GET')
    expect(plain).toBeTruthy()
    const out = (
      await toolNamed('ai_describe_endpoint').execute({ method: plain!.method, path: plain!.path }, CTX)
    ).output
    expect(out).not.toContain('同名字段')
    expect(out).toContain('路径参数: 无')
  })

  it('两族命名空间不重叠(前缀不同,--disallowed-tools 才能按服务表达)', () => {
    const aiNames = AI_BRIDGE_TOOLS.map((t) => t.name)
    expect(aiNames.every((n) => n.startsWith('ai_'))).toBe(true)
    expect(aiNames.some((n) => n.startsWith('api_'))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
