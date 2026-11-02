// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 问答分类管理面的**管理员闸存续锁**(2026-11-01 安全强化)。
 *
 * 缺口:POST/PUT/DELETE `/asks/categories` 原先只 `authenticate`,
 * 任意登录用户即可增删改全站共享分类(含插入诱导性名称/图片用于钓鱼)。
 *
 * 判据与变异自证共用同一份实现:闸必须在位,且体内不得再出现裸 authenticate。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const FILE = 'apps/api/src/routes/ask-extended.ts'
const GUARD = 'preHandler: requireAdminRouteGuard'

function src(): string {
  return readFileSync(join(ROOT, FILE), 'utf8')
}

function routeBlock(text: string, marker: string): string | null {
  const start = text.indexOf(marker)
  if (start < 0) return null
  const rest = text.slice(start + marker.length)
  const next = rest.search(/\n\s*server\.(get|post|put|delete|patch)\(/)
  return next < 0 ? rest : rest.slice(0, next)
}

const CATEGORY_WRITE_ROUTES = [
  "server.post('/asks/categories'",
  "server.put('/asks/categories/:id'",
  "server.delete('/asks/categories/:id'",
]

function categoryWriteRoutesGuarded(text: string): boolean {
  return CATEGORY_WRITE_ROUTES.every((marker) => {
    const block = routeBlock(text, marker)
    if (block === null) return false
    return block.includes(GUARD) && !block.includes('await authenticate(request)')
  })
}

describe('问答分类写面:管理员闸 + 去裸鉴权', () => {
  it('三条分类写路由全部挂 requireAdminRouteGuard,且体内无裸 authenticate', () => {
    const s = src()
    for (const marker of CATEGORY_WRITE_ROUTES) {
      const block = routeBlock(s, marker)
      expect(block, `找不到路由 ${marker}`).not.toBeNull()
      expect(block!, `${marker} 缺少 preHandler 管理员闸`).toContain(GUARD)
      expect(block!, `${marker} 体内仍有裸 await authenticate(request)`).not.toContain(
        'await authenticate(request)',
      )
    }
    expect(categoryWriteRoutesGuarded(s)).toBe(true)
  })

  it('强档闸从 require-permission 导入,且四条渠道之外的读路由未被误伤', () => {
    const s = src()
    expect(s).toContain(
      "import { requireAdminRouteGuard } from '../plugins/require-permission.js'",
    )
    // 只读的 GET /asks/categories 仍保持普通登录语义(不是管理面)
    const getBlock = routeBlock(s, "server.get('/asks/categories'")!
    expect(getBlock).toContain('await authenticate(request)')
    expect(getBlock).not.toContain(GUARD)
  })

  it('变异自证:摘掉任一条 preHandler,或塞回裸 authenticate,同一判据必须判否', () => {
    const s = src()
    expect(categoryWriteRoutesGuarded(s)).toBe(true)

    // 变异 1:摘掉 POST 上的闸
    const stripped = s.replace(
      "server.post('/asks/categories', { preHandler: requireAdminRouteGuard },",
      "server.post('/asks/categories',",
    )
    expect(stripped, '摘样本没摘到东西 ⇒ 这一格不成对照').not.toBe(s)
    expect(categoryWriteRoutesGuarded(stripped)).toBe(false)

    // 变异 2:摘掉 PUT 上的闸
    const strippedPut = s.replace(
      "server.put('/asks/categories/:id', { preHandler: requireAdminRouteGuard },",
      "server.put('/asks/categories/:id',",
    )
    expect(strippedPut).not.toBe(s)
    expect(categoryWriteRoutesGuarded(strippedPut)).toBe(false)

    // 变异 3:把裸 authenticate 塞回 DELETE
    const bare = s.replace(
      "server.delete('/asks/categories/:id', { preHandler: requireAdminRouteGuard }, async (request, reply) => {\n    const parsed",
      "server.delete('/asks/categories/:id', { preHandler: requireAdminRouteGuard }, async (request, reply) => {\n    await authenticate(request)\n    const parsed",
    )
    expect(bare, '塞裸鉴权没塞进去 ⇒ 这一格不成对照').not.toBe(s)
    expect(categoryWriteRoutesGuarded(bare)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
