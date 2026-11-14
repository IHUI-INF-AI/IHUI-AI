// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'
import {
  POST_ACTION_ICON,
  POST_ACTION_IDS,
  isPostActionInteractive,
  projectPostActions,
  type PostActionHandlers,
} from '../post-actions'

describe('post-actions 契约', () => {
  it('动作枚举与顺序稳定(赞 → 评 → 藏 → 享)', () => {
    expect([...POST_ACTION_IDS]).toEqual(['like', 'comment', 'favorite', 'share'])
    // 每一项都有图标名,漏登记会让某端渲染不出图标
    for (const id of POST_ACTION_IDS) expect(POST_ACTION_ICON[id]).toBeTruthy()
  })

  it('没有回调的动作一律不可点(防假按钮)', () => {
    for (const id of POST_ACTION_IDS) {
      expect(isPostActionInteractive(id, undefined)).toBe(false)
      expect(isPostActionInteractive(id, {})).toBe(false)
    }
  })

  it('只有给了回调的动作才可点', () => {
    const handlers: PostActionHandlers = { onShare: () => {} }
    expect(isPostActionInteractive('share', handlers)).toBe(true)
    expect(isPostActionInteractive('like', handlers)).toBe(false)
    expect(isPostActionInteractive('comment', handlers)).toBe(false)
    expect(isPostActionInteractive('favorite', handlers)).toBe(false)
  })

  it('投影保留计数,缺项按 0 而不是 undefined', () => {
    const rows = projectPostActions({
      likes: 3,
      comments: 0,
      favorites: 1,
      shares: 0,
    })
    expect(rows.map((r) => r.count)).toEqual([3, 0, 1, 0])
    expect(rows.map((r) => r.id)).toEqual(['like', 'comment', 'favorite', 'share'])
  })

  it('选中态只落在 like / favorite', () => {
    const rows = projectPostActions(
      { likes: 0, comments: 0, favorites: 0, shares: 0 },
      { liked: true, favorited: true },
    )
    expect(rows.find((r) => r.id === 'like')?.active).toBe(true)
    expect(rows.find((r) => r.id === 'comment')?.active).toBe(false)
    expect(rows.find((r) => r.id === 'favorite')?.active).toBe(true)
    expect(rows.find((r) => r.id === 'share')?.active).toBe(false)
  })

  it('only 可把 4 项裁到 2 项(共享屏只读 2 项的场景)', () => {
    const rows = projectPostActions(
      { likes: 1, comments: 2, favorites: 3, shares: 4 },
      {},
      {},
      ['like', 'comment'],
    )
    expect(rows.map((r) => r.id)).toEqual(['like', 'comment'])
    expect(rows.map((r) => r.count)).toEqual([1, 2])
  })

  it('投影结果与可点性判据同源(不会自相矛盾)', () => {
    const handlers: PostActionHandlers = { onLike: () => {} }
    const rows = projectPostActions({ likes: 0, comments: 0, favorites: 0, shares: 0 }, {}, handlers)
    for (const row of rows) {
      expect(row.interactive).toBe(isPostActionInteractive(row.id, handlers))
    }
  })
})
