// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * queryNotificationStateIds 的 deletedIds 计算(2026-11-24 删除翻转第二切片)。
 * 纯零连接档:喂假 db 行,钉住「deletedIds = 传入 ids 中本人库里查不到的」。
 * ① 查到的行按 isRead/archivedAt 落 readIds/archivedIds;
 * ② 传入但没查到的 ⇒ deletedIds(断线期被别的设备删了);
 * ③ 变异锁:抹掉 found.add / deletedIds filter 即红。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const state = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; isRead: boolean; archivedAt: Date | null }>,
  wheres: [] as unknown[],
}))

vi.mock('../src/db/index.js', () => {
  const api: Record<string, unknown> = {
    from: () => api,
    where: (w: unknown) => {
      state.wheres.push(w)
      return api
    },
    then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(state.rows).then(res, rej),
  }
  return { db: { select: () => api } }
})

import { queryNotificationStateIds } from '../src/db/notification-queries.js'

const I1 = '11111111-1111-4111-8111-111111111111'
const I2 = '22222222-2222-4222-8222-222222222222'
const I3 = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  state.rows = []
  state.wheres.length = 0
})

describe('queryNotificationStateIds deletedIds 快照', () => {
  it('传空 ids 回三空数组,不查库', async () => {
    expect(await queryNotificationStateIds('u-1', [])).toEqual({
      readIds: [],
      archivedIds: [],
      deletedIds: [],
    })
    expect(state.wheres).toHaveLength(0)
  })

  it('查到的按 isRead/archivedAt 分类,没查到的进 deletedIds', async () => {
    state.rows = [
      { id: I1, isRead: true, archivedAt: null },
      { id: I2, isRead: false, archivedAt: new Date() },
    ]
    const res = await queryNotificationStateIds('u-1', [I1, I2, I3])
    expect(res.readIds).toEqual([I1])
    expect(res.archivedIds).toEqual([I2])
    expect(res.deletedIds).toEqual([I3])
  })

  it('全查到 ⇒ deletedIds 空;全查不到 ⇒ read/archived 空、deletedIds 全集', async () => {
    state.rows = [{ id: I1, isRead: true, archivedAt: null }]
    expect((await queryNotificationStateIds('u-1', [I1])).deletedIds).toEqual([])
    state.rows = []
    expect(await queryNotificationStateIds('u-1', [I1, I2])).toEqual({
      readIds: [],
      archivedIds: [],
      deletedIds: [I1, I2],
    })
  })

  it('where 仍带 userId 谓词(防越权,不因加 deletedIds 而松掉)', async () => {
    await queryNotificationStateIds('u-1', [I1])
    expect(state.wheres).toHaveLength(1)
  })

  it('变异锁:抹掉 deletedIds 计算本文件必红', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/db/notification-queries.ts'),
      'utf8',
    ) as string
    expect(src).toContain('const deletedIds = ids.filter((id) => !found.has(id))')
    expect(src).toContain('found.add(row.id)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
