// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 子智能体「全局配置变更面」的管理员闸存续锁(2026-11-01 安全强化)。
 *
 * 缺口:`/subagents/roles/custom` 的增删改、`/auto-generate`、`/agents/:role/evolve`、
 * `/agents/:role/apply-evolution` 原先只 `await authenticate(request)`(仅登录),
 * 任意注册用户即可创建 / 改写 / 删除平台级自定义智能体角色定义,并触发全局演化与 LLM 调用。
 * `customRoles` 是**全局 Map、无 owner**,这类写操作属于平台配置面,必须强档管理员闸。
 *
 * 本锁钉两件事:
 *  1. 上述 6 个变更端点全部挂 `preHandler: requireAdminRouteGuard`;
 *  2. 这 6 个 handler 体内不再有裸 `await authenticate(request)`(闸已统一处理)。
 *
 * 读类端点(GET /list /evolution-history)保留 `requireAuth` —— 只读平台配置不构成越权写,
 * 故不在此锁范围内。每格都带变异自证:改动源字符串后,同一判据必须判否。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ROOT 由本文件自身位置推导(共享工作树里 cwd 不可靠)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const FILE = 'apps/api/src/routes/subagents-extended-routes.ts'
const GUARD = 'preHandler: requireAdminRouteGuard'

function src(): string {
  return readFileSync(join(ROOT, FILE), 'utf8')
}

type RouteRef = { method: string; path: string }
type RouteDecl = RouteRef & { start: number; end: number }

/**
 * 按 `server.<method>(` 解析路由声明:方法名与路径之间允许换行/缩进 —— 2026-11-02 起
 * 本文件多条变更路由改成多行注册(`server.post(\n  '/path',`),按单行字面量 indexOf
 * 会让 routeBlock 返回 null,整格判据静默失效。路径必须紧随左括号(仅允许空白),
 * 且同一 (method, path) 必须唯一 —— 0 条(缺失)与 ≥2 条(重复注册)都判否,
 * 判定只比旧写法更严,不放宽。
 */
const ROUTE_DECL_RE = /\n\s*server\.(get|post|put|delete|patch)\(\s*(['"])([^'"]*)\2/g

function routeDecls(text: string): RouteDecl[] {
  const heads = [...text.matchAll(ROUTE_DECL_RE)].map((m) => ({
    method: m[1]!,
    path: m[3]!,
    start: m.index ?? -1,
  }))
  return heads.map((h, i) => ({
    ...h,
    end: i + 1 < heads.length ? heads[i + 1]!.start : text.length,
  }))
}

/** 精确按 (method, path) 取唯一注册块(到下一条 server.xxx( 之前)。 */
function routeBlock(text: string, route: RouteRef): string | null {
  const hits = routeDecls(text).filter((d) => d.method === route.method && d.path === route.path)
  return hits.length === 1 ? text.slice(hits[0]!.start, hits[0]!.end) : null
}

const MUTATION_ROUTES: RouteRef[] = [
  { method: 'post', path: '/subagents/roles/custom' },
  { method: 'put', path: '/subagents/roles/custom/:id' },
  { method: 'delete', path: '/subagents/roles/custom/:id' },
  { method: 'post', path: '/subagents/roles/auto-generate' },
  { method: 'post', path: '/subagents/agents/:role/evolve' },
  { method: 'post', path: '/subagents/agents/:role/apply-evolution' },
]

/** 判据:6 个变更路由必须挂强档闸,且体内不得再现裸 authenticate */
function mutationRoutesGuarded(text: string): boolean {
  return MUTATION_ROUTES.every((route) => {
    const block = routeBlock(text, route)
    if (block === null) return false
    return block.includes(GUARD) && !block.includes('await authenticate(request)')
  })
}

const GUARD_OPTION = '{ preHandler: requireAdminRouteGuard },'

/** 对唯一路由块做变异(找不到/重复注册 ⇒ 原样返回,由调用方 not.toBe 断言兜住)。 */
function mutateRoute(text: string, route: RouteRef, mutate: (block: string) => string): string {
  const hits = routeDecls(text).filter((d) => d.method === route.method && d.path === route.path)
  if (hits.length !== 1) return text
  const decl = hits[0]!
  const block = text.slice(decl.start, decl.end)
  return text.slice(0, decl.start) + mutate(block) + text.slice(decl.end)
}

describe('子智能体全局配置变更面:管理员闸 + 去裸鉴权', () => {
  it('6 个变更路由全部挂 requireAdminRouteGuard,且体内无裸 authenticate', () => {
    const s = src()
    for (const route of MUTATION_ROUTES) {
      const block = routeBlock(s, route)
      expect(block, `找不到路由 ${route.method.toUpperCase()} ${route.path}`).not.toBeNull()
      expect(block!, `${route.path} 缺少 preHandler 管理员闸`).toContain(GUARD)
      expect(block!, `${route.path} 体内仍有裸 await authenticate(request)`).not.toContain(
        'await authenticate(request)',
      )
    }
    expect(mutationRoutesGuarded(s)).toBe(true)
  })

  it('闸从 require-permission 导入,且 6 条都用带 requireActiveUser 的强档', () => {
    const s = src()
    expect(s).toContain("import { requireAdminRouteGuard } from '../plugins/require-permission.js'")
    // 弱档 requireAdmin(无 requireActiveUser)不得出现在这 6 条路由上
    for (const route of MUTATION_ROUTES) {
      expect(routeBlock(s, route)!, `${route.path} 用了较弱档 requireAdmin`).not.toContain(
        'preHandler: requireAdmin,',
      )
    }
  })

  it('变异自证:摘掉任一条 preHandler,同一判据必须判否', () => {
    const s = src()
    expect(mutationRoutesGuarded(s)).toBe(true)

    // 变异 1:以结构定位摘掉 POST /roles/custom 上的闸(不再依赖源码单行写法)
    const stripped = mutateRoute(s, MUTATION_ROUTES[0]!, (block) => block.replace(GUARD_OPTION, ''))
    expect(stripped, '摘样本没摘到东西 ⇒ 这一格不成对照').not.toBe(s)
    expect(
      routeBlock(stripped, MUTATION_ROUTES[0]!)!,
      '摘闸后该路由不应再含管理员闸',
    ).not.toContain(GUARD)
    expect(mutationRoutesGuarded(stripped)).toBe(false)

    // 变异 2:把裸 authenticate 塞回 DELETE /roles/custom/:id(按块定位插入,不锚定整行)
    // 2026-11-02 P0-3:DELETE 在 `customRoles.delete(id)` 之前插入归属闸,样本锚点随之前移
    // (闸语义不变:仍是「才是这一条路由、且体内出现裸 authenticate ⇒ 判否」)。
    const bare = mutateRoute(
      s,
      { method: 'delete', path: '/subagents/roles/custom/:id' },
      (block) =>
        block.replace(
          'async (request, reply) => {\n',
          'async (request, reply) => {\n    await authenticate(request)\n',
        ),
    )
    expect(bare, '塞裸鉴权没塞进去 ⇒ 这一格不成对照').not.toBe(s)
    expect(routeBlock(bare, { method: 'delete', path: '/subagents/roles/custom/:id' })!).toContain(
      'await authenticate(request)',
    )
    expect(mutationRoutesGuarded(bare)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
