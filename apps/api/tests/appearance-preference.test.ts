// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

/**
 * 外观云同步偏好的服务端判据形状锁(2026-11-15 v3 立)。
 *
 * 为什么不做行为测试:拉起路由会连带 db/服务整条依赖链,而本机没有测试库
 * (与 tests/sidebar-nav-preference.test.ts 同一先例)。
 * 这里钉的是三件容易在后续改动中丢掉的事:
 *   ① 写入必须收在上限(schema max),否则 text 列等于开放无界存储;
 *   ② 读回 updatedAt 必须是毫秒数,前端按它做「新者胜」比较;
 *   ③ group 走 USER_PREFERENCE_GROUPS 常量,不写字面量。
 */

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {}, dbClient: {}, dbScoped: {} }))

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const settingsSrc = readFileSync(
  resolve(repoRoot, 'apps/api/src/routes/user/settings-routes.ts'),
  'utf8',
)
const queriesSrc = readFileSync(
  resolve(repoRoot, 'apps/api/src/db/user-preferences-queries.ts'),
  'utf8',
)

describe('外观云同步偏好', () => {
  it('GET/PUT/DELETE 三条路由都已注册', () => {
    expect(settingsSrc).toContain(`server.get('/settings/appearance'`)
    expect(settingsSrc).toContain(`server.put('/settings/appearance'`)
    expect(settingsSrc).toContain(`server.delete('/settings/appearance'`)
  })

  it('写入上限只收在 schema(512KB)', () => {
    expect(settingsSrc).toContain('APPEARANCE_STATE_MAX = 512_000')
    const schemaStart = settingsSrc.indexOf('const appearanceBodySchema')
    const schemaEnd = settingsSrc.indexOf(`server.get('/settings/appearance'`)
    const schema = settingsSrc.slice(schemaStart, schemaEnd)
    expect(schema).toContain('max(APPEARANCE_STATE_MAX)')
  })

  it('group 走统一常量而不是字面量', () => {
    expect(settingsSrc).toContain('USER_PREFERENCE_GROUPS.appearance')
    expect(queriesSrc).toContain(`appearance: 'appearance'`)
  })

  it('updatedAt 以毫秒时间戳返回(前端按数值比较新者胜)', () => {
    const start = settingsSrc.indexOf(`server.get('/settings/appearance'`)
    const end = settingsSrc.indexOf(`server.put('/settings/appearance'`)
    const handler = settingsSrc.slice(start, end)
    expect(handler).toContain('new Date(row.updatedAt).getTime()')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
