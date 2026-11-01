// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 通知渠道管理面的**管理员闸存续锁**(2026-11-01 安全强化)。
 *
 * 缺口:四条 `/notifications/channels` 路由原先只 `await authenticate(request)`,
 * 任意注册用户即可读到全部渠道 config(Webhook URL / SMTP 口令 / 短信 API Key),
 * 并可新增、改写、删除全局渠道。
 *
 * 本锁钉三件事:
 *  1. 四条路由都挂 `preHandler: requireAdminRouteGuard`(含 requireActiveUser 的强档);
 *  2. 这四条 handler 体内不再有裸 `await authenticate(request)`;
 *  3. GET 响应仍走 `maskChannelRow` 脱敏,且 PUT 保留 `mergeMaskedConfig` 的
 *     "`***` = 保持原值"语义 —— 否则脱敏会把管理员配置渠道的功能打断。
 *
 * 每格都带变异自证:改动源字符串后,同一判据必须判否,证明这把尺不是哑的。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ROOT 由本文件自身位置推导(共享工作树里 cwd 不可靠)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const FILE = 'apps/api/src/routes/notification-extended.ts'
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

const CHANNEL_ROUTES = [
  "server.get('/notifications/channels'",
  "server.post('/notifications/channels'",
  "server.put('/notifications/channels/:id'",
  "server.delete('/notifications/channels/:id'",
]

/**
 * 判据:四条渠道管理路由都必须挂强档闸,且体内不得再出现裸 authenticate。
 * 正向用例与变异反证共用这一份实现。
 */
function channelRoutesGuarded(text: string): boolean {
  return CHANNEL_ROUTES.every((marker) => {
    const block = routeBlock(text, marker)
    if (block === null) return false
    return block.includes(GUARD) && !block.includes('await authenticate(request)')
  })
}

describe('通知渠道管理面:管理员闸、去裸鉴权、config 脱敏', () => {
  it('四条渠道路由全部挂 requireAdminRouteGuard,且体内无裸 authenticate', () => {
    const s = src()
    for (const marker of CHANNEL_ROUTES) {
      const block = routeBlock(s, marker)
      expect(block, `找不到路由 ${marker}`).not.toBeNull()
      expect(block!, `${marker} 缺少 preHandler 管理员闸`).toContain(GUARD)
      expect(block!, `${marker} 体内仍有裸 await authenticate(request)`).not.toContain(
        'await authenticate(request)',
      )
    }
    expect(channelRoutesGuarded(s)).toBe(true)
  })

  it('闸用的是带 requireActiveUser 的强档,并从 require-permission 导入', () => {
    const s = src()
    expect(s).toContain(
      "import { requireAdminRouteGuard } from '../plugins/require-permission.js'",
    )
    // 弱档 requireAdmin(无 requireActiveUser)不得出现在这四条路由上
    for (const marker of CHANNEL_ROUTES) {
      expect(routeBlock(s, marker)!, `${marker} 用了较弱档 requireAdmin`).not.toContain(
        'preHandler: requireAdmin,',
      )
    }
  })

  it('GET 返回的 config 走脱敏,响应不含原始敏感字段', () => {
    const s = src()
    expect(s).toContain('MASKED_CONFIG_VALUE')
    expect(s).toContain('maskChannelRow')
    const getBlock = routeBlock(s, CHANNEL_ROUTES[0]!)!
    expect(getBlock, 'GET 列表未调用脱敏函数').toContain('.map(maskChannelRow)')
  })

  it('PUT 保留 "*** = 保持原值" 的更新语义(脱敏不破坏配置能力)', () => {
    const s = src()
    expect(s).toContain('function mergeMaskedConfig')
    const putBlock = routeBlock(s, CHANNEL_ROUTES[2]!)!
    expect(putBlock, 'PUT 未合并掩码值,会把 *** 写进库').toContain('mergeMaskedConfig')
  })

  it('变异自证:摘掉任一条 preHandler,或塞回裸 authenticate,同一判据必须判否', () => {
    const s = src()
    expect(channelRoutesGuarded(s)).toBe(true)

    // 变异 1:摘掉 GET 上的闸
    const stripped = s.replace(
      "server.get('/notifications/channels', { preHandler: requireAdminRouteGuard },",
      "server.get('/notifications/channels',",
    )
    expect(stripped, '摘样本没摘到东西 ⇒ 这一格不成对照').not.toBe(s)
    expect(channelRoutesGuarded(stripped)).toBe(false)

    // 变异 2:把裸 authenticate 塞回 DELETE
    const bare = s.replace(
      "server.delete('/notifications/channels/:id', { preHandler: requireAdminRouteGuard }, async (request, reply) => {\n    const parsed",
      "server.delete('/notifications/channels/:id', { preHandler: requireAdminRouteGuard }, async (request, reply) => {\n    await authenticate(request)\n    const parsed",
    )
    expect(bare, '塞裸鉴权没塞进去 ⇒ 这一格不成对照').not.toBe(s)
    expect(channelRoutesGuarded(bare)).toBe(false)

    // 变异 3:整段删掉脱敏调用 ⇒ 脱敏存续判据必须判否
    const unmasked = s.replace('.map(maskChannelRow)', '.map((row) => row)')
    expect(unmasked).not.toBe(s)
    expect(routeBlock(unmasked, CHANNEL_ROUTES[0]!)!).not.toContain('.map(maskChannelRow)')
  })
})
