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

/** 从路由注册标记处截到**下一条** server.xxx( 之前,得到该路由的完整块 */
function routeBlock(text: string, marker: string): string | null {
  const start = text.indexOf(marker)
  if (start < 0) return null
  const rest = text.slice(start + marker.length)
  const next = rest.search(/\n\s*server\.(get|post|put|delete|patch)\(/)
  return next < 0 ? rest : rest.slice(0, next)
}

const MUTATION_ROUTES = [
  "server.post('/subagents/roles/custom'",
  "server.put('/subagents/roles/custom/:id'",
  "server.delete('/subagents/roles/custom/:id'",
  "server.post('/subagents/roles/auto-generate'",
  "server.post('/subagents/agents/:role/evolve'",
  "server.post('/subagents/agents/:role/apply-evolution'",
]

/** 判据:6 个变更路由必须挂强档闸,且体内不得再现裸 authenticate */
function mutationRoutesGuarded(text: string): boolean {
  return MUTATION_ROUTES.every((marker) => {
    const block = routeBlock(text, marker)
    if (block === null) return false
    return block.includes(GUARD) && !block.includes('await authenticate(request)')
  })
}

describe('子智能体全局配置变更面:管理员闸 + 去裸鉴权', () => {
  it('6 个变更路由全部挂 requireAdminRouteGuard,且体内无裸 authenticate', () => {
    const s = src()
    for (const marker of MUTATION_ROUTES) {
      const block = routeBlock(s, marker)
      expect(block, `找不到路由 ${marker}`).not.toBeNull()
      expect(block!, `${marker} 缺少 preHandler 管理员闸`).toContain(GUARD)
      expect(block!, `${marker} 体内仍有裸 await authenticate(request)`).not.toContain(
        'await authenticate(request)',
      )
    }
    expect(mutationRoutesGuarded(s)).toBe(true)
  })

  it('闸从 require-permission 导入,且 6 条都用带 requireActiveUser 的强档', () => {
    const s = src()
    expect(s).toContain(
      "import { requireAdminRouteGuard } from '../plugins/require-permission.js'",
    )
    // 弱档 requireAdmin(无 requireActiveUser)不得出现在这 6 条路由上
    for (const marker of MUTATION_ROUTES) {
      expect(routeBlock(s, marker)!, `${marker} 用了较弱档 requireAdmin`).not.toContain(
        'preHandler: requireAdmin,',
      )
    }
  })

  it('变异自证:摘掉任一条 preHandler,同一判据必须判否', () => {
    const s = src()
    expect(mutationRoutesGuarded(s)).toBe(true)

    // 变异 1:摘掉 POST /roles/custom 上的闸
    const stripped = s.replace(
      "server.post('/subagents/roles/custom', { preHandler: requireAdminRouteGuard },",
      "server.post('/subagents/roles/custom',",
    )
    expect(stripped, '摘样本没摘到东西 ⇒ 这一格不成对照').not.toBe(s)
    expect(mutationRoutesGuarded(stripped)).toBe(false)

    // 变异 2:把裸 authenticate 塞回 DELETE /roles/custom/:id
    const bare = s.replace(
      "server.delete('/subagents/roles/custom/:id', { preHandler: requireAdminRouteGuard }, async (request, reply) => {\n    const { id } = request.params as { id: string }\n    const deleted = customRoles.delete(id)",
      "server.delete('/subagents/roles/custom/:id', { preHandler: requireAdminRouteGuard }, async (request, reply) => {\n    await authenticate(request)\n    if (!request.userId) return\n    const { id } = request.params as { id: string }\n    const deleted = customRoles.delete(id)",
    )
    expect(bare, '塞裸鉴权没塞进去 ⇒ 这一格不成对照').not.toBe(s)
    expect(mutationRoutesGuarded(bare)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
