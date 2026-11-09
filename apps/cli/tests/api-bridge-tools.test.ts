// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * API 桥工具族(api-bridge)。
 *
 * 钉三件事,每一件都曾经以"工具在册、实际调不通"的形态在别的系统上过线:
 *  ① 目录层:5514 行清单能解析成记录,过滤 / 分页 / 详情都按契约工作,且**零网络**;
 *  ② 调用层:method / path / query / body / Authorization 逐项落到真实请求上(用注入的
 *     transport 抓实参,不打真实后端),信封 `{code,message,data}` 被拆成 data;
 *  ③ 失败归因:403 不被洗成成功、path 没写全当场拒绝、api_write 不被拿来当 DELETE 用。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setBaseUrl, setTokenProvider, setTransport } from '@ihui/api-client'

import { API_BRIDGE_TOOLS, endpointCatalog, pathParamsOf } from '../src/tools/api-bridge.js'
import { API_ENDPOINT_LINE_COUNT } from '../src/tools/api-endpoints.generated.js'
import { HR_TOOLS } from '../src/tools/hr.js'
import type { Tool, ToolContext } from '../src/tools/index.js'

/** 工具执行体只读 ctx 的少数几项;桥工具一项都不读,给空壳即可。 */
const CTX = {} as unknown as ToolContext
const ENDPOINT_LINE_RE = /^\d+\. /

interface Captured {
  url: string
  method: string | undefined
  headers: Record<string, string>
  body: string | undefined
}

let captured: Captured | null = null

function toolNamed(name: string): Tool {
  const found = API_BRIDGE_TOOLS.find((t) => t.name === name)
  if (!found) {
    const names = API_BRIDGE_TOOLS.map((t) => t.name).join('/')
    throw new Error(`桥上没有 ${name};现有:${names}`)
  }
  return found
}

/** 取本次请求的实参;没发请求就抛错(比在断言里写 `?.` 更早暴露"根本没调")。 */
function lastRequest(): Captured {
  if (!captured) throw new Error('本次用例没有发出任何请求')
  return captured
}

function respond(status: number, body: unknown): void {
  setTransport(async (url, init) => {
    captured = {
      url: String(url),
      method: init.method,
      headers: { ...((init.headers ?? {}) as Record<string, string>) },
      body: typeof init.body === 'string' ? init.body : undefined,
    }
    const text = typeof body === 'string' ? body : JSON.stringify(body)
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      text: async () => text,
      json: async () => JSON.parse(text) as unknown,
    }
  })
}

/** 从列表输出里取出端点行(`N. METHOD /path  [domain]`)。 */
function endpointLines(output: string): string[] {
  return output.split('\n').filter((line) => ENDPOINT_LINE_RE.test(line))
}

beforeEach(() => {
  captured = null
  setBaseUrl('http://api.test:8802')
  setTokenProvider({ getToken: () => 'tok-test' })
})

afterEach(() => {
  setBaseUrl('')
  setTokenProvider({ getToken: () => null })
})

describe('目录层(离线,零网络)', () => {
  it('清单解析成记录,条数与生成器声明一致', () => {
    const rows = endpointCatalog()
    expect(rows.length).toBe(API_ENDPOINT_LINE_COUNT)
    expect(rows.length).toBeGreaterThan(5000)
    expect(rows.every((r) => r.method.length > 0 && r.path.startsWith('/'))).toBe(true)
    expect(rows.filter((r) => r.domain === '').length).toBe(0)
  })

  it('路径参数按出现顺序抽出', () => {
    expect(pathParamsOf('/api/hr-attendance/leave/:id/approve')).toEqual(['id'])
    expect(pathParamsOf('/api/a/:x/b/:y')).toEqual(['x', 'y'])
    expect(pathParamsOf('/api/plain')).toEqual([])
  })

  it('列表:按域过滤 + 分页,且不发任何请求', async () => {
    const res = await toolNamed('api_list_endpoints').execute(
      { domain: 'hr-attendance', limit: 5 },
      CTX,
    )
    expect(res.success).toBe(true)
    expect(res.output).toContain('命中')
    const lines = endpointLines(res.output)
    expect(lines.length).toBe(5)
    expect(lines.every((line) => line.includes('/api/hr-attendance/'))).toBe(true)
    expect(captured).toBeNull()
  })

  it('列表:关键字 + 方法过滤', async () => {
    const res = await toolNamed('api_list_endpoints').execute(
      { q: 'departments', method: 'GET', limit: 200 },
      CTX,
    )
    const lines = endpointLines(res.output)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((line) => /\d+\. GET \//.test(line) && line.includes('departments'))).toBe(
      true,
    )
    expect(captured).toBeNull()
  })

  it('详情:命中给出源文件与调用姿势,未命中给近邻线索', async () => {
    const first = endpointCatalog()[0]
    if (!first) throw new Error('目录为空,清单没生成')
    const hit = await toolNamed('api_describe_endpoint').execute(
      { method: first.method, path: first.path },
      CTX,
    )
    expect(hit.success).toBe(true)
    expect(hit.output).toContain('来源:')
    expect(hit.output).toContain(first.path)

    const miss = await toolNamed('api_describe_endpoint').execute(
      { method: 'GET', path: '/api/definitely-not-here-xyz' },
      CTX,
    )
    expect(miss.success).toBe(false)
    expect(miss.error).toContain('目录里没有')
  })
})

describe('调用层(打真实请求链路)', () => {
  it('api_read:GET + query + Bearer,并拆掉 {code,message,data} 信封', async () => {
    respond(200, { code: 0, message: 'ok', data: { id: 'd1', name: '人事部' } })
    const res = await toolNamed('api_read').execute(
      { path: '/api/hr-attendance/departments', query: { status: 'active', page: '2' } },
      CTX,
    )
    expect(res.success).toBe(true)
    expect(res.output).toContain('"name": "人事部"')
    const req = lastRequest()
    expect(req.method).toBe('GET')
    expect(req.url).toBe('http://api.test:8802/api/hr-attendance/departments?status=active&page=2')
    expect(req.headers['Authorization']).toBe('Bearer tok-test')
    expect(req.body).toBeUndefined()
  })

  it('api_write:POST + JSON body,Content-Type 只出现一份', async () => {
    respond(200, { code: 0, message: 'ok', data: { id: 'new-1' } })
    const res = await toolNamed('api_write').execute(
      { method: 'POST', path: '/api/hr-attendance/departments', body: { name: '研发部' } },
      CTX,
    )
    expect(res.success).toBe(true)
    const req = lastRequest()
    expect(req.method).toBe('POST')
    expect(req.body).toBe('{"name":"研发部"}')
    expect(req.headers['Content-Type']).toBe('application/json')
    // 大小写不同的同名键在 Headers 构造时会被拼成 "a, b"(Fastify 直接 415)—— 值里不得有逗号。
    expect(req.headers['Content-Type']?.includes(',')).toBe(false)
  })

  it('api_write 拒绝读取类方法,且不发请求', async () => {
    const res = await toolNamed('api_write').execute({ method: 'GET', path: '/api/x' }, CTX)
    expect(res.success).toBe(false)
    expect(res.error).toContain('api_write 只接受 POST/PUT/PATCH')
    expect(captured).toBeNull()
  })

  it('api_delete 走 DELETE 且是危险档', async () => {
    respond(200, { code: 0, message: 'ok', data: null })
    const tool = toolNamed('api_delete')
    expect(tool.dangerLevel).toBe('dangerous')
    const res = await tool.execute({ path: '/api/hr-attendance/departments/d1' }, CTX)
    expect(res.success).toBe(true)
    expect(lastRequest().method).toBe('DELETE')
  })

  it('403 不被洗成成功,错误里带 method/path/status', async () => {
    respond(403, { code: 403, message: '缺少 hr:attendance:manage' })
    const res = await toolNamed('api_write').execute(
      { method: 'PATCH', path: '/api/hr-attendance/employees/e1', body: { status: 'left' } },
      CTX,
    )
    expect(res.success).toBe(false)
    expect(res.error).toContain('403')
    expect(res.error).toContain('PATCH /api/hr-attendance/employees/e1')
    expect(res.error).toContain('缺少 hr:attendance:manage')
  })

  it('path 没写全(缺前缀)时当场拒绝,不发请求', async () => {
    const res = await toolNamed('api_read').execute({ path: 'hr-attendance/departments' }, CTX)
    expect(res.success).toBe(false)
    expect(res.error).toContain('path 必须是完整路径')
    expect(captured).toBeNull()
  })
})

describe('契约与注册面', () => {
  it('每枚工具三组契约齐全,写/危险档必须带确认凭据', () => {
    for (const tool of API_BRIDGE_TOOLS) {
      const contract = tool.contract
      if (!contract) throw new Error(`${tool.name} 缺契约`)
      expect(contract.shape.visibleToProvider, tool.name).toBe(true)
      expect(contract.shape.input.type, tool.name).toBe('object')
      expect(contract.permission.effectScope, tool.name).toBeTruthy()
      expect(contract.permission.permissionKey, tool.name).toBeTruthy()
      expect(contract.permission.riskLevel, tool.name).toBe(tool.dangerLevel)
      expect(contract.resultBudget.policy, tool.name).toBe('truncate')
      if (tool.dangerLevel !== 'read') {
        expect(contract.permission.confirmation, tool.name).toBeDefined()
      }
    }
  })

  it('工具名在族内唯一,且不与 HR 族重名(同归属重名会被注册表静默顶掉)', () => {
    const names = API_BRIDGE_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    const hr = new Set(HR_TOOLS.map((t) => t.name))
    expect(names.filter((n) => hr.has(n))).toEqual([])
  })
})
