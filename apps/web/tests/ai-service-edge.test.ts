// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 公网边缘反代接线的回归测试(O20 · 无网络,纯判据)
//
// 这个文件要守的不是「函数返回值对不对」这一件事,而是三条结构不变量:
//  ① 边缘表必须是 capability-catalog.ts 的**派生态** —— 期望集合在测试里从目录现算,
//     不是抄一份字面量。抄字面量的话,目录里新增/收权时测试会跟着一起沉默。
//  ② 默认拒绝必须**有牙**:只断言「没配置返回 []」是恒真的(一个永远返回 [] 的
//     实现也能过)。所以每条 [] 断言都配一条「配置齐备时确实产出 N 条」的对照,
//     二者共用同一个被测函数。
//  ③ 「凭据透传但不落日志」不是靠人自觉:它成立是因为这一层**根本不接触请求头、
//     也根本不读进程环境**(基址由调用方显式喂进来)。下面用源码级锁把这两件事钉住 ——
//     哪天有人在这里加个 logger 或加个 header 白名单,本测试即红。

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CAPABILITY_CATALOG } from '@ihui/types'
import {
  AI_SERVICE_EDGE_BASE_URL_ENV,
  AI_SERVICE_EDGE_BLOCKED_PATHS,
  AI_SERVICE_EDGE_ENABLED_ENV,
  AI_SERVICE_EDGE_PREFIX,
  AI_SERVICE_EDGE_ROUTES,
  buildAiServiceEdgeRewrites,
  resolveEdgeBaseUrl,
} from '../src/config/ai-service-edge'

const VALID_BASE = 'http://127.0.0.1:8803'
const ENABLED = { [AI_SERVICE_EDGE_ENABLED_ENV]: 'true', [AI_SERVICE_EDGE_BASE_URL_ENV]: VALID_BASE }

// ───────────────────────── 从目录现算期望集合(唯一的判据来源) ─────────────────────────

const ROUTE_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) (\/\S+)$/

interface AiServiceRouteRow {
  scope: string
  eligible: boolean
  method: string
  path: string
}

/** 目录里所有 host:'ai-service' 条目声明的路由,逐条拆成 {method, path}。 */
function aiServiceRows(): AiServiceRouteRow[] {
  const rows: AiServiceRouteRow[] = []
  for (const entry of CAPABILITY_CATALOG) {
    if (entry.host !== 'ai-service') continue
    for (const raw of entry.routes ?? []) {
      const m = ROUTE_RE.exec(raw.trim())
      // 形态不认识(通配 / 参数段 / 拼接串)就不当作候选,交给下面的形态断言处理。
      if (!m) continue
      rows.push({ scope: entry.scope, eligible: entry.thirdPartyEligible === true, method: m[1], path: m[2] })
    }
  }
  return rows
}

/** 含通配或参数段的模式:注册它会静默扩成前缀匹配,一律不得进边缘。 */
function isExactPath(p: string): boolean {
  return !p.includes('*') && !p.includes('{')
}

/** 同一个 path 上既有可公开又有不可公开的方法 ⇒ rewrites 无法分流 ⇒ 整条不放。 */
function collidedPaths(): Set<string> {
  const byPath = new Map<string, AiServiceRouteRow[]>()
  for (const r of aiServiceRows()) {
    const list = byPath.get(r.path) ?? []
    list.push(r)
    byPath.set(r.path, list)
  }
  const out = new Set<string>()
  for (const [path, list] of byPath) {
    if (list.some((r) => r.eligible) && list.some((r) => !r.eligible)) out.add(path)
  }
  return out
}

/** 边缘应放行的上游路径集合(可公开 ∧ 精确 ∧ 无方法冲突)。 */
function expectedEdgePaths(): Set<string> {
  const collisions = collidedPaths()
  const out = new Set<string>()
  for (const r of aiServiceRows()) {
    if (!r.eligible) continue
    if (!isExactPath(r.path)) continue
    if (collisions.has(r.path)) continue
    out.add(r.path)
  }
  return out
}

describe('边缘表 ↔ 能力目录对账(派生态,不是第二份决策)', () => {
  it('前置:期望集合非空 —— 空集会让下面所有对账变成恒真', () => {
    const expected = expectedEdgePaths()
    expect(expected.size).toBeGreaterThan(0)
    expect(AI_SERVICE_EDGE_ROUTES.length).toBeGreaterThan(0)
  })

  it('边缘表 ⊆ 目录可公开集合(拦「手滑多塞一行」)', () => {
    const expected = expectedEdgePaths()
    for (const row of AI_SERVICE_EDGE_ROUTES) {
      expect(expected.has(row.upstreamPath), `${row.upstreamPath} 不在目录可公开集合里`).toBe(true)
    }
  })

  it('目录可公开集合 ⊆ 边缘表(拦「目录放行了而边缘没接线」= 造好没装车)', () => {
    const declared = new Set(AI_SERVICE_EDGE_ROUTES.map((r) => r.upstreamPath))
    for (const p of expectedEdgePaths()) {
      expect(declared.has(p), `目录声明可公开却没人接线:${p}`).toBe(true)
    }
  })

  it('每一行的 scope / method 与目录逐字一致(不许借个名字挂上去)', () => {
    const rows = aiServiceRows()
    for (const row of AI_SERVICE_EDGE_ROUTES) {
      const hit = rows.find(
        (r) => r.path === row.upstreamPath && r.method === row.method && r.scope === row.scope,
      )
      expect(hit, `${row.method} ${row.upstreamPath} 找不到 scope=${row.scope} 的目录声明`).toBeTruthy()
      expect(hit?.eligible).toBe(true)
    }
  })

  it('被排除清单 = 目录现算的方法冲突集合(双向;排除是判据不是遗漏)', () => {
    expect([...AI_SERVICE_EDGE_BLOCKED_PATHS].sort()).toEqual([...collidedPaths()].sort())
  })

  it('对照:确有一条同路径混方法的真实冲突(sandbox/computer-use 之类不在其中)', () => {
    // 这条断言把「排除清单不为空」变成事实而非巧合:目录里 GET 可公开、POST 不可公开
    // 的同路径就是 /api/mcp/external/servers。若哪天目录收权把这条冲突消掉,本断言会
    // 要求同步改掉排除清单,而不是留一张死表。
    expect(collidedPaths().has('/api/mcp/external/servers')).toBe(true)
  })
})

describe('默认拒绝:配置不齐时一条 rewrite 都不注册', () => {
  it('两个环境变量都没设 → 0 条', () => {
    expect(buildAiServiceEdgeRewrites({})).toEqual([])
  })
  it('开了开关但没给上游基址 → 0 条', () => {
    expect(buildAiServiceEdgeRewrites({ [AI_SERVICE_EDGE_ENABLED_ENV]: 'true' })).toEqual([])
  })
  it('给了基址但没开开关 → 0 条(基址存在不等于授权)', () => {
    expect(buildAiServiceEdgeRewrites({ [AI_SERVICE_EDGE_BASE_URL_ENV]: VALID_BASE })).toEqual([])
  })
  it('开关值不是字面量 true 一律视为关(1 / TRUE / yes / 空串 都不放行)', () => {
    for (const v of ['1', 'TRUE', 'yes', 'on', '', ' false']) {
      expect(buildAiServiceEdgeRewrites({ ...ENABLED, [AI_SERVICE_EDGE_ENABLED_ENV]: v }), `值=${v}`).toEqual([])
    }
  })
  it('基址形态不合法一律视为未配置(相对路径 / 非 http(s) / 带 userinfo / 带 query 或 hash)', () => {
    for (const bad of [
      'localhost:8803',
      'not a url',
      'ftp://localhost:8803',
      'http://user:hunter2@localhost:8803',
      'http://localhost:8803?token=abc',
      'http://localhost:8803#frag',
      '  ',
    ]) {
      expect(resolveEdgeBaseUrl(bad).ok, `应当拒绝:${bad}`).toBe(false)
      expect(buildAiServiceEdgeRewrites({ ...ENABLED, [AI_SERVICE_EDGE_BASE_URL_ENV]: bad })).toEqual([])
    }
  })
  it('反例对照(有牙证明):配置齐备时**确实**产出与表等长的规则 ⇒ 上面的 0 条不是恒真', () => {
    const out = buildAiServiceEdgeRewrites(ENABLED)
    expect(out).toHaveLength(AI_SERVICE_EDGE_ROUTES.length)
    expect(out.length).toBeGreaterThan(0)
  })
})

describe('放行形态:只注册精确路径,不注册任何前缀', () => {
  it('source 恰为 /ai-service + 上游路径,destination 恰为 基址 + 上游路径', () => {
    for (const row of AI_SERVICE_EDGE_ROUTES) {
      const hit = buildAiServiceEdgeRewrites(ENABLED).find((r) => r.source === `${AI_SERVICE_EDGE_PREFIX}${row.upstreamPath}`)
      expect(hit, `缺规则:${row.upstreamPath}`).toBeTruthy()
      expect(hit?.destination).toBe(`${VALID_BASE}${row.upstreamPath}`)
    }
  })

  it('产出的 source 里没有通配 / :path* / 参数段(前缀注册会被静默放大)', () => {
    for (const r of buildAiServiceEdgeRewrites(ENABLED)) {
      expect(r.source).not.toContain('*')
      expect(r.source).not.toContain(':path')
      expect(r.source).not.toContain('{')
      expect(r.source.startsWith(`${AI_SERVICE_EDGE_PREFIX}/`)).toBe(true)
    }
  })

  it('不可公开的能力一次都不会被放行(逐条点名,含同路径的写方法)', () => {
    const sources = new Set(buildAiServiceEdgeRewrites(ENABLED).map((r) => r.source))
    for (const forbidden of [
      `${AI_SERVICE_EDGE_PREFIX}/api/sandbox/run`, // sandbox:run —— thirdPartyEligible=false
      `${AI_SERVICE_EDGE_PREFIX}/api/computer-use/keystroke`, // computer:operate
      `${AI_SERVICE_EDGE_PREFIX}/api/agent-control/execute`, // browser:operate
      `${AI_SERVICE_EDGE_PREFIX}/api/mcp/external/servers`, // connectors:write(同路径 GET 才可公开)
      `${AI_SERVICE_EDGE_PREFIX}/api/mcp/store/install`, // 未登记的兄弟路径
      `${AI_SERVICE_EDGE_PREFIX}/api/agents/execute`, // 执行面
    ]) {
      expect(sources.has(forbidden), `不该出现在边缘:${forbidden}`).toBe(false)
    }
  })
})

describe('凭据边界:这一层不接触请求头、也不自行读环境', () => {
  const code = (() => {
    // 只判代码面:注释里出现 Authorization 是在解释「谁负责鉴权」,不是在实现鉴权。
    const raw = readFileSync(resolve(__dirname, '../src/config/ai-service-edge.ts'), 'utf8')
    return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  })()

  it('规则对象只有 source/destination 两个键(没有任何承载 header 的字段)', () => {
    for (const r of buildAiServiceEdgeRewrites(ENABLED)) {
      expect(Object.keys(r).sort()).toEqual(['destination', 'source'])
    }
  })

  it('模块内不打日志:凭据面静默是本仓明令禁止的失效型,而加 logger 就是泄漏入口', () => {
    expect(code).not.toMatch(/console\s*\./)
    expect(code).not.toMatch(/\blogger\b/)
  })

  it('模块不碰请求头,也不出现凭据头字面量(鉴权唯一落点在 ai-service)', () => {
    expect(code).not.toMatch(/authorization/i)
    expect(code).not.toMatch(/x-api-key/i)
    expect(code).not.toMatch(/headers/i)
  })

  it('模块不读 process.env:环境只由调用方显式喂入,否则测试与运行时判的不是同一份配置', () => {
    expect(code).not.toMatch(/process\.env/)
  })

  it('带 userinfo 的基址被拒,凭据不会随 destination 进路由表(与上一条同一条禁令)', () => {
    const out = buildAiServiceEdgeRewrites({
      ...ENABLED,
      [AI_SERVICE_EDGE_BASE_URL_ENV]: 'http://ops:sekret@10.0.0.9:8803',
    })
    expect(out).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
