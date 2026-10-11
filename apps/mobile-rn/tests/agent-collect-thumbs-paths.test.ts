// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 智能体收藏/点赞与分类字典的端内接口路径回归(台账行「RN 与 api-client 三处接口路径多写一段 agents」)
//
// 立票事实(现读,非推断):
//   ①② apps/mobile-rn/src/screens/HomeScreen.tsx 的收藏/点赞曾写 cozeZhsApi 前缀下带 agents 段的
//      collect / thumbs,归一后多一段 agents ⇒ 运行时必 404;后端 apps/api/src/routes/agents.ts
//      注册的是 server.post 直写的 /collect 与 /thumbs,经 routes/index.ts 的
//      register(agentsRoutes, { prefix: /api }) 挂载 ⇒ 实际路径 /api/collect、/api/thumbs。
//      该两处已修入库(提交 f3bf8bd3fc),本测试防回潮。
//   ③ packages/api-client/src/endpoints/agent.ts 的 getAgentCategories 请求
//      cozeZhsApi 前缀下的 cache/agent-category-dict/categories(fetchApi 的 normalizeUrl 归一为
//      /api 前缀),后端由 agent-category-dict.ts 以绝对路径字面量注册(机主拍板新建的公开端点)。
//
// 为什么不只靠守门 8:守门 8 按 §12e 对存量只报数不判红,且其默认面是 HEAD blob
// (要 --worktree 才看工作树读数)。这条测试在提交链上钉住三处调用点的现读事实;
// 两侧路径都从源码现读,不在测试里抄第二份真相。
//
// 注意:本文件不写引号紧邻的错误路径字面量 —— 守门 8 的 pathRe 把引号与反引号同等当引号,
// 写出来会被抽成调用点;反例路径一律用数组 join 现拼。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

const RN_HOME = 'apps/mobile-rn/src/screens/HomeScreen.tsx'
const AGENT_ENDPOINT = 'packages/api-client/src/endpoints/agent.ts'
const API_AGENTS_ROUTE = 'apps/api/src/routes/agents.ts'
const API_ROUTES_INDEX = 'apps/api/src/routes/index.ts'
const API_DICT_ROUTE = 'apps/api/src/routes/agent-category-dict.ts'

/** 通道等价归一档(与 api-client normalizeUrl 的 /cozeZhsApi 规则、守门 8 CE① 同规则) */
const normalize = (p: string): string => p.replace(/^\/cozeZhsApi/, '/api')

/** 多写一段 agents 的错误路径(现拼,不落字面量) */
const wrongPath = (...segs: string[]): string => ['/api', ...segs].join('/')

/** 从源码抽 fetchApi 调用点的路径字面量;引号紧邻才算(注释里的路径不带引号,不会命中) */
function fetchApiPaths(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/fetchApi\s*(?:<[^(]*>)?\s*\(\s*(['"`])([^'"`]+)\1/g)) {
    if (m[2]) out.push(m[2])
  }
  return out
}

describe('端内收藏/点赞路径(①②):不得再多写 agents 段', () => {
  const src = read(RN_HOME)
  const paths = fetchApiPaths(src).map(normalize)

  it('提取尺子先自证非空,且 collect/thumbs 落在后端真实注册面上', () => {
    expect(paths.length, 'fetchApi 调用点读不到了 —— 形态变了,不是没有死调用').toBeGreaterThan(0)
    expect(paths).toContain('/api/collect')
    expect(paths).toContain('/api/thumbs')
  })

  it('死调用不得回来:任何调用点都不是带 agents 段的那两条', () => {
    expect(paths).not.toContain(wrongPath('agents', 'collect'))
    expect(paths).not.toContain(wrongPath('agents', 'thumbs'))
  })

  it('变异有牙:把调用点改回旧路径,同一把尺子必须当场读出违规', () => {
    const violations = (s: string): string[] =>
      fetchApiPaths(s)
        .map(normalize)
        .filter((p) => p === wrongPath('agents', 'collect') || p === wrongPath('agents', 'thumbs'))
    expect(violations(src)).toEqual([])
    // 只替换带引号的调用点字面量(注释里有一处不带引号的同串,替它不算回归复现)
    const regressed = src.replace(`'/api/collect'`, `'${wrongPath('agents', 'collect')}'`)
    expect(regressed, '变异没咬到调用点 —— 提取面已不是本测试认的那个形态').not.toBe(src)
    expect(violations(regressed)).toEqual([wrongPath('agents', 'collect')])
  })

  it('后端注册面确如票面:agentsRoutes 直写注册 /collect 与 /thumbs,挂 prefix /api', () => {
    const agents = read(API_AGENTS_ROUTE)
    const locals = [...agents.matchAll(/server\.post\(\s*(['"`])([^'"`]+)\1/g)].map((m) => m[2])
    expect(locals).toContain('/collect')
    expect(locals).toContain('/thumbs')
    const index = read(API_ROUTES_INDEX)
    expect(index).toMatch(/register\(\s*agentsRoutes\s*,\s*\{\s*prefix:\s*['"]\/api['"]\s*\}/)
  })
})

describe('api-client 分类字典路径(③):客户端现读路径必须等于后端注册字面量', () => {
  /** 从 getAgentCategories 函数体现读第一个路径字面量(真相在两端源码,不在测试里抄) */
  function clientPath(): string {
    const src = read(AGENT_ENDPOINT)
    const start = src.indexOf('export async function getAgentCategories')
    if (start < 0) throw new Error('getAgentCategories 被改名或摘线 —— 提取尺子失效')
    const body = src.slice(start, start + 600)
    const lit = /(['"`])(\/[^'"`]+)\1/.exec(body)
    if (!lit?.[2]) throw new Error('函数体里读不到路径字面量 —— 形态变了')
    return normalize(lit[2])
  }

  /** 后端 agent-category-dict.ts 的 server.get 绝对路径字面量 */
  function serverPath(): string {
    const src = read(API_DICT_ROUTE)
    const lit = /server\.get\(\s*(['"`])(\/[^'"`]+)\1/.exec(src)
    if (!lit?.[2]) throw new Error('后端注册形态变了(不再是 server.get + 绝对字面量)')
    return lit[2]
  }

  it('两端现读路径逐字相等,且落在 /api 归一面上', () => {
    const c = clientPath()
    const s = serverPath()
    expect(c).toMatch(/^\/api\//)
    expect(c, `${c} ≠ 后端注册的 ${s}`).toBe(s)
  })

  it('路由确实被挂进 Fastify(不是只写了没人 register)', () => {
    const index = read(API_ROUTES_INDEX)
    expect(index).toMatch(/register\(\s*agentCategoryDictRoutes\s*\)/)
  })

  it('变异有牙:客户端多写一段就不再等于注册面', () => {
    const s = serverPath()
    const tampered = s.replace('/cache/', '/agents/cache/')
    expect(tampered).not.toBe(s)
    expect(clientPath()).not.toBe(tampered)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
