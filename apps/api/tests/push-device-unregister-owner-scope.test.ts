// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 推送设备注销的**归属作用域锁**(2026-11-01 安全强化)。
 *
 * 缺口:POST `/push/devices/unregister` 的 UPDATE 只按 `device_token` 定位,
 * 无归属条件 —— 知道他人设备 token 即可静默停掉对方推送。
 *
 * 表结构依据(packages/database/src/schema/edu-full.ts:291):
 *   eduNotificationDevice → pgTable('edu_notification_device', { memberId: integer('member_id') ... })
 * 同文件 register 路由也以 member_id 写入,故归属列是 member_id 而非 user_id。
 *
 * 判据:同一个 UPDATE 里必须同时出现 device_token 与 member_id = ${request.userId!},
 * 且按影响行数决定返回(0 行 → 404),不得假装成功。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const FILE = 'apps/api/src/routes/push.ts'
const UNREGISTER = "server.post('/push/devices/unregister'"

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

/** WHERE 必须以 device_token 定位,并紧跟归属条件 member_id = ${request.userId!} */
const OWNER_SCOPE = /WHERE\s+device_token\s*=\s*\$\{deviceToken\}[\s\S]*?AND\s+member_id\s*=\s*\$\{request\.userId!?\}/

function unregisterOwnerScoped(text: string): boolean {
  const block = routeBlock(text, UNREGISTER)
  if (block === null) return false
  return OWNER_SCOPE.test(block) && block.includes('await authenticate(request)')
}

describe('推送设备注销:WHERE 必须带归属列', () => {
  it('注销 UPDATE 同时按 device_token 与 member_id 过滤', () => {
    const block = routeBlock(src(), UNREGISTER)
    expect(block, '找不到注销路由').not.toBeNull()
    expect(block!, 'WHERE 缺少 member_id 归属条件').toMatch(OWNER_SCOPE)
    expect(block!, '注销路由仍需登录').toContain('await authenticate(request)')
  })

  it('按影响行数决定返回:0 行返回 404,不假装成功', () => {
    const block = routeBlock(src(), UNREGISTER)!
    expect(block, '未用 RETURNING 取影响行数').toContain('RETURNING id')
    expect(block, '未按影响行数判定').toContain('removed')
    expect(block, '0 行未返回 404').toMatch(/status\(404\)/)
    expect(block, '成功响应未带回影响行数').toContain('unregistered: true, removed')
  })

  it('归属列选型与 register 路由一致(member_id,不是 user_id)', () => {
    const s = src()
    const registerBlock = routeBlock(s, "server.post('/push/devices/register'")!
    expect(registerBlock).toContain('INSERT INTO edu_notification_device (member_id')
    const unregisterBlock = routeBlock(s, UNREGISTER)!
    expect(unregisterBlock).toContain('member_id')
    expect(unregisterBlock).not.toContain('user_id')
  })

  it('变异自证:摘掉 AND member_id 归属条件,同一判据必须判否', () => {
    const s = src()
    expect(unregisterOwnerScoped(s)).toBe(true)

    const stripped = s.replace(/\n\s*AND member_id = \$\{request\.userId!\}/, '')
    expect(stripped, '摘样本没摘到东西 ⇒ 这一格不成对照').not.toBe(s)
    expect(unregisterOwnerScoped(stripped)).toBe(false)

    // 变异 2:把归属列改回 user_id(看似有归属,实则表里没有该列语义)
    const wrongColumn = s.replace('AND member_id = ${request.userId!}', 'AND user_id = ${request.userId!}')
    expect(wrongColumn).not.toBe(s)
    expect(unregisterOwnerScoped(wrongColumn)).toBe(false)
  })
})
