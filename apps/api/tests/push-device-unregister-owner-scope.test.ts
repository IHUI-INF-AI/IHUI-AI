// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 推送设备注销的**归属作用域锁**(2026-11-08 随 F-680 迁移到 device_tokens)。
 *
 * 背景:旧实现把 users.id(UUID)写进 `edu_notification_device.member_id`(integer),
 * 注册必然 500;注销 WHERE 也只有 device_token(或写错的 member_id)。
 *
 * 表结构依据(packages/database/src/schema/device-tokens.ts:32):
 *   deviceTokens → pgTable('device_tokens', { userId: uuid('user_id'), token: text('token') ... })
 *   device_tokens_token_unique 唯一索引支撑 ON CONFLICT (token) upsert。
 *
 * 判据:注销 UPDATE 必须用 deviceTokens 表,且 WHERE 同时带 token 与 user_id;
 * 按影响行数决定返回(0 行 → 404),不得假装成功。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const FILE = 'apps/api/src/routes/push.ts'
const UNREGISTER = "server.post('/push/devices/unregister'"
const REGISTER = "server.post('/push/devices/register'"

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

function unregisterOwnerScoped(text: string): boolean {
  const block = routeBlock(text, UNREGISTER)
  if (block === null) return false
  return (
    block.includes('await authenticate(request)') &&
    block.includes('update(deviceTokens)') &&
    block.includes('eq(deviceTokens.token, deviceToken)') &&
    block.includes('eq(deviceTokens.userId, request.userId!)')
  )
}

describe('推送设备注销:WHERE 必须带归属列(device_tokens.user_id)', () => {
  it('注销 UPDATE 同时按 token 与 user_id 过滤', () => {
    const block = routeBlock(src(), UNREGISTER)
    expect(block, '找不到注销路由').not.toBeNull()
    expect(unregisterOwnerScoped(src())).toBe(true)
  })

  it('按影响行数决定返回:0 行返回 404,不假装成功', () => {
    const block = routeBlock(src(), UNREGISTER)!
    expect(block, '未用 RETURNING 取影响行数').toContain('returning({ id: deviceTokens.id })')
    expect(block, '未按影响行数判定').toContain('removed === 0')
    expect(block, '0 行未返回 404').toMatch(/status\(404\)/)
    expect(block, '成功响应未带回影响行数').toContain('unregistered: true, removed')
  })

  it('register/unregister 均落到 device_tokens,不再出现教育表或 member_id=uuid', () => {
    const s = src()
    const registerBlock = routeBlock(s, REGISTER)!
    expect(registerBlock).toContain('insert(deviceTokens)')
    expect(registerBlock).toContain('onConflictDoUpdate')
    expect(s).not.toContain('edu_notification_device')
    expect(s).not.toMatch(/member_id\s*=\s*\$\{request\.userId/)
  })

  it('变异自证:摘掉 user_id 归属条件,同一判据必须判否', () => {
    const s = src()
    expect(unregisterOwnerScoped(s)).toBe(true)

    const stripped = s.replace('eq(deviceTokens.userId, request.userId!)', 'true')
    expect(stripped, '摘样本没摘到东西 ⇒ 这一格不成对照').not.toBe(s)
    expect(unregisterOwnerScoped(stripped)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
