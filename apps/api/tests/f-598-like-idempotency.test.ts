// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-598 回归锁(2026-11-13)。不连库:mock db 链式模拟唯一键冲突。
 *
 * 病灶:原 `toggleLike` 的插入用 `onConflictDoNothing().returning()`,冲突分支直接
 * `delete` 掉并发请求刚插入的行 ⇒ 双击 / 超时重试两次点赞最终变成「未点赞」。
 *
 * 本文件锁:
 *   ① 并发两次点赞:两次都返回 liked=true,库内只留一行,且全程不触发 delete;
 *   ② 重复 like 幂等:顺序调用两次同样只留一行;
 *   ③ 重复 unlike 幂等:每次返回 liked=false,不抛错、库内保持为空;
 *   ④ 返回值与库内状态一致:like 后存在且为 true,unlike 后不存在且为 false。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    /** 唯一键 → 库中现存行(用 Set 模拟唯一约束)。 */
    rows: new Set<string>(),
    inserts: 0,
    conflicts: 0,
    deletes: 0,
  }
  return { state }
})

vi.mock('../src/db/index.js', () => {
  const state = h.state
  const keyOf = (v: { resourceType: string; resourceId: string; userId: string }): string =>
    `${v.resourceType}:${v.resourceId}:${v.userId}`
  return {
    db: {
      insert: () => ({
        values: (v: { resourceType: string; resourceId: string; userId: string }) => ({
          onConflictDoNothing: () => ({
            returning: () => {
              state.inserts += 1
              const key = keyOf(v)
              // 唯一键冲突:与真实 PG 一样返回空数组,不落新行
              if (state.rows.has(key)) {
                state.conflicts += 1
                return Promise.resolve([])
              }
              state.rows.add(key)
              return Promise.resolve([{ ...v }])
            },
          }),
        }),
      }),
      delete: () => ({
        where: () => {
          state.deletes += 1
          // 本文件每个用例只操作一个唯一键,删除即清空该键
          state.rows.clear()
          return Promise.resolve([])
        },
      }),
    },
    dbRead: {},
  }
})

import { likeResource, unlikeResource } from '../src/db/resource-likes-queries.js'

const RESOURCE = 'article'
const RESOURCE_ID = 'f598-resource'
const USER_ID = 'f598-user'

beforeEach(() => {
  h.state.rows.clear()
  h.state.inserts = 0
  h.state.conflicts = 0
  h.state.deletes = 0
})

describe('F-598 点赞幂等语义', () => {
  it('① 并发两次点赞最终仍为已点赞,且冲突分支不删除', async () => {
    const [first, second] = await Promise.all([
      likeResource(RESOURCE, RESOURCE_ID, USER_ID),
      likeResource(RESOURCE, RESOURCE_ID, USER_ID),
    ])

    expect(first).toEqual({ liked: true })
    expect(second).toEqual({ liked: true })
    // 只留一行,第二次命中唯一键冲突,且从未执行 delete(旧实现会删掉第一行)
    expect(h.state.rows.size).toBe(1)
    expect(h.state.conflicts).toBe(1)
    expect(h.state.deletes).toBe(0)
  })

  it('② 重复 like 幂等', async () => {
    await likeResource(RESOURCE, RESOURCE_ID, USER_ID)
    const again = await likeResource(RESOURCE, RESOURCE_ID, USER_ID)

    expect(again).toEqual({ liked: true })
    expect(h.state.rows.size).toBe(1)
    expect(h.state.deletes).toBe(0)
  })

  it('③ 重复 unlike 幂等', async () => {
    await likeResource(RESOURCE, RESOURCE_ID, USER_ID)

    const first = await unlikeResource(RESOURCE, RESOURCE_ID, USER_ID)
    const second = await unlikeResource(RESOURCE, RESOURCE_ID, USER_ID)

    expect(first).toEqual({ liked: false })
    expect(second).toEqual({ liked: false })
    expect(h.state.rows.size).toBe(0)
  })

  it('④ 返回值与库内状态一致', async () => {
    const liked = await likeResource(RESOURCE, RESOURCE_ID, USER_ID)
    expect(liked.liked).toBe(true)
    expect(h.state.rows.size).toBe(1)

    const unliked = await unlikeResource(RESOURCE, RESOURCE_ID, USER_ID)
    expect(unliked.liked).toBe(false)
    expect(h.state.rows.size).toBe(0)

    // like → unlike → like 往返后,返回值与库内状态仍同步
    const reLiked = await likeResource(RESOURCE, RESOURCE_ID, USER_ID)
    expect(reLiked.liked).toBe(true)
    expect(h.state.rows.size).toBe(1)
  })
})
