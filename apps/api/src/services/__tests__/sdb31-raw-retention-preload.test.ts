// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-34:原文留存预热忽略偏好键名。
 *
 * 立因(2026-11-08 静态取证):`preloadRawRetentionOptOuts` 只按 `group='privacy'` 过滤,
 * 同组里 `analyticsEnabled` / `adTracking` 等只要值为 'true' 也会被当作用户选择
 * 「不留存原文」→ 重启后这些用户的 LLM 调用原文整体不落库。
 *
 * 夹具:mock db 返回 privacy 组两行(一个真是 opt-out,一个是匿名统计开关),
 * 断言只有 opt-out 用户命中缓存,且预热的 where 必须含 opt-out 键名。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const dbState = vi.hoisted(() => ({
  rows: [] as Array<{ userId: string; key: string; value: string }>,
  where: undefined as unknown,
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (w: unknown) => {
          dbState.where = w
          // 贴近真实 DB:谓词里出现 opt-out 键名才按该键过滤;否则(=修复前的只按 group)
          // 返回整个 privacy 组。这样断言的是「查询口径」本身,而不是 mock 的宽松返回。
          const text = renderSql(w)
          const filtered = text.includes('llmRawRetentionOptOut')
            ? dbState.rows.filter((r) => r.key === 'llmRawRetentionOptOut')
            : dbState.rows
          return Promise.resolve(filtered)
        },
      }),
    }),
  },
}))

import {
  preloadRawRetentionOptOuts,
  isRawRetentionOptedOut,
  resetRawRetentionOptOutCacheForTests,
} from '../raw-retention-optout.js'

/** 把 drizzle SQL 片段渲染成可断言文本(与 codebase-index 测试同一手法)。 */
function renderSql(frag: unknown): string {
  if (frag === null || frag === undefined) return ''
  const anyFrag = frag as { toQuery?: (cfg: unknown) => { sql: string; params: unknown[] } }
  if (typeof anyFrag.toQuery !== 'function') return String(frag)
  try {
    const q = anyFrag.toQuery({
      escapeName: (n: string) => `"${n}"`,
      escapeParam: (i: number) => `$${i + 1}`,
      casing: {
        cache: () => undefined,
        convert: (c: string) => c,
        getColumnCasing: (col: unknown) => (col as { name?: string }).name ?? 'col',
      },
    })
    let out = q.sql
    q.params.forEach((p, i) => {
      out = out.replace(`$${i + 1}`, typeof p === 'string' ? `'${p}'` : String(p))
    })
    return out
  } catch {
    return String(frag)
  }
}

beforeEach(() => {
  resetRawRetentionOptOutCacheForTests()
  dbState.rows = []
  dbState.where = undefined
})

describe('SDB-34 原文留存预热只认 opt-out 键', () => {
  it('privacy 组里 analyticsEnabled=true 的用户不得被判为「不留存原文」', async () => {
    dbState.rows = [
      { userId: 'user-optout', key: 'llmRawRetentionOptOut', value: 'true' },
      { userId: 'user-analytics', key: 'analyticsEnabled', value: 'true' }, // 同组不同键
    ]
    await preloadRawRetentionOptOuts()

    expect(isRawRetentionOptedOut('user-optout')).toBe(true)
    // 关键期望:匿名统计开关 ≠ 不留存原文
    expect(isRawRetentionOptedOut('user-analytics')).toBe(false)
  })

  it('预热查询必须按 opt-out 键名过滤(不能只看 group)', async () => {
    await preloadRawRetentionOptOuts()
    const sqlText = renderSql(dbState.where)
    expect(sqlText).toContain('llmRawRetentionOptOut')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
