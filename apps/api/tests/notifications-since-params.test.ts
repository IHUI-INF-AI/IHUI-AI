// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listNotificationsQuery } from '../src/routes/notifications.js'

// 通知断点续读的**入口**谓词锁:半截水位必须在 schema 层就被拒,不能靠 z.object
// 默认 strip 把 sinceCreatedAt 丢掉后退回普通分页 —— 那样调用方会误以为"已按水位对齐"。
describe('通知列表查询:断点半参数不得静默退化', () => {
  const at = '2026-11-24T12:00:00.000Z'
  const id = '00000000-0000-4000-8000-000000000001'

  it('成对水位通过解析,落成 Date + uuid 交给 db keyset', () => {
    const parsed = listNotificationsQuery.safeParse({
      page: 1,
      pageSize: 100,
      partition: 'active',
      sinceCreatedAt: at,
      sinceId: id,
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.sinceCreatedAt?.toISOString()).toBe(at)
    expect(parsed.data.sinceId).toBe(id)
  })

  it('只有时间 / 只有 id ⇒ 拒绝(400 档),不 strip 成普通分页', () => {
    expect(listNotificationsQuery.safeParse({ sinceCreatedAt: at }).success).toBe(false)
    expect(listNotificationsQuery.safeParse({ sinceId: id }).success).toBe(false)
  })

  it('空串视为未提供:与老客户端逐字同形,不带水位走普通分页', () => {
    const parsed = listNotificationsQuery.safeParse({
      page: 2,
      pageSize: 20,
      partition: 'active',
      sinceCreatedAt: '',
      sinceId: '',
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.sinceCreatedAt).toBeUndefined()
    expect(parsed.data.sinceId).toBeUndefined()
    expect(parsed.data.page).toBe(2)
  })

  it('变异锁:成对 refine 被抹掉即红', () => {
    const src = readFileSync(resolve(__dirname, '../src/routes/notifications.ts'), 'utf8')
    const marker = 'Boolean(v.sinceCreatedAt) === Boolean(v.sinceId)'
    expect(src).toContain(marker)
    expect(src.split(marker).join('')).not.toContain(marker)
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
