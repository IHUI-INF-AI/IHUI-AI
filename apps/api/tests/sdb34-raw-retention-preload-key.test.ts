// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-34:原文留存预热必须按 opt-out 键名过滤,且与单键写入路径同一判真口径。
 *
 * 缺陷原状:预热只按 `group='privacy'` 取行,同组的 `analyticsEnabled` / `adTracking`
 * 只要值为 'true' 也会被当成「不留存原文」→ 重启后这些用户的 LLM 调用原文整体不落库。
 *
 * 夹具手法同 src/services/__tests__/sdb31-raw-retention-preload.test.ts:把 where 谓词
 * 渲染成文本再决定返回哪些行 —— 断言的是**查询口径本身**,而不是 mock 的宽松返回。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

interface PrefRow {
  userId: string
  group: string
  key: string
  value: string | null
}

const dbState = vi.hoisted(() => ({
  rows: [] as PrefRow[],
  where: undefined as unknown,
  written: undefined as PrefRow | undefined,
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (w: unknown) => {
          dbState.where = w
          const text = renderSql(w)
          const rows = dbState.rows.filter((r) => {
            // 谓词里没有的条件就不过滤,这样"漏了 key/group"会被用例真实暴露出来。
            if (text.includes("'privacy'") && r.group !== 'privacy') return false
            if (text.includes('llmRawRetentionOptOut') && r.key !== 'llmRawRetentionOptOut') {
              return false
            }
            return true
          })
          // 预热直接 await where() 的结果;单键写入路径还要 .limit(1)。
          return Object.assign(Promise.resolve(rows), {
            limit: (n: number) => Promise.resolve(rows.slice(0, n)),
          })
        },
      }),
    }),
    update: () => ({
      set: (values: { value: string }) => ({
        where: () => {
          if (dbState.written) dbState.written = { ...dbState.written, ...values }
          return Promise.resolve()
        },
      }),
    }),
    insert: () => ({
      values: (values: PrefRow) => {
        dbState.written = values
        return Promise.resolve()
      },
    }),
  },
}))

import {
  preloadRawRetentionOptOuts,
  isRawRetentionOptedOut,
  setRawRetentionOptOut,
  resetRawRetentionOptOutCacheForTests,
} from '../src/services/raw-retention-optout.js'

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

/** 造一条 privacy 组偏好行。 */
function privacyRow(userId: string, key: string, value: string | null): PrefRow {
  return { userId, group: 'privacy', key, value }
}

beforeEach(() => {
  resetRawRetentionOptOutCacheForTests()
  dbState.rows = []
  dbState.where = undefined
  dbState.written = undefined
})

describe('SDB-34 预热只认 opt-out 键,且与单键路径同口径', () => {
  it('① privacy 组的 analyticsEnabled=true 不得把用户加入 optOutCache', async () => {
    dbState.rows = [
      privacyRow('user-optout', 'llmRawRetentionOptOut', 'true'),
      privacyRow('user-analytics', 'analyticsEnabled', 'true'),
      privacyRow('user-ads', 'adTracking', 'true'),
    ]
    await preloadRawRetentionOptOuts()

    expect(isRawRetentionOptedOut('user-optout')).toBe(true)
    expect(isRawRetentionOptedOut('user-analytics')).toBe(false)
    expect(isRawRetentionOptedOut('user-ads')).toBe(false)
  })

  it('② 只有 llmRawRetentionOptOut=true 才加入 optOutCache', async () => {
    dbState.rows = [privacyRow('user-yes', 'llmRawRetentionOptOut', 'true')]
    await preloadRawRetentionOptOuts()

    expect(isRawRetentionOptedOut('user-yes')).toBe(true)
  })

  it('③ llmRawRetentionOptOut=false 不加入 optOutCache', async () => {
    dbState.rows = [privacyRow('user-no', 'llmRawRetentionOptOut', 'false')]
    await preloadRawRetentionOptOuts()

    expect(isRawRetentionOptedOut('user-no')).toBe(false)
  })

  it('④ 其它组的同名键不得误伤', async () => {
    dbState.rows = [
      { userId: 'user-other-group', group: 'preferences', key: 'llmRawRetentionOptOut', value: 'true' },
    ]
    await preloadRawRetentionOptOuts()

    expect(isRawRetentionOptedOut('user-other-group')).toBe(false)
    // 口径守卫:预热 where 必须同时限定 group 与 key,不能只按任一侧过滤。
    const sqlText = renderSql(dbState.where)
    expect(sqlText).toContain("'privacy'")
    expect(sqlText).toContain('llmRawRetentionOptOut')
  })

  it('⑤ 单键写入与预热对同一用户给出同一结论', async () => {
    // 单键路径:显式选择「不留存」→ 内存立即生效,并落库。
    await setRawRetentionOptOut('user-same', true)
    expect(isRawRetentionOptedOut('user-same')).toBe(true)
    const writtenTrue = dbState.written
    expect(writtenTrue?.value).toBe('true')

    // 模拟重启:把写入口真正落库的那一行喂给预热,结论必须仍为「不留存」。
    resetRawRetentionOptOutCacheForTests()
    dbState.rows = writtenTrue ? [writtenTrue] : []
    await preloadRawRetentionOptOuts()
    expect(isRawRetentionOptedOut('user-same')).toBe(true)

    // 反方向同样一致:'false' 在两个入口都表示「仍留存」。
    await setRawRetentionOptOut('user-same', false)
    expect(isRawRetentionOptedOut('user-same')).toBe(false)
    const writtenFalse = dbState.written
    expect(writtenFalse?.value).toBe('false')

    resetRawRetentionOptOutCacheForTests()
    dbState.rows = writtenFalse ? [writtenFalse] : []
    await preloadRawRetentionOptOuts()
    expect(isRawRetentionOptedOut('user-same')).toBe(false)
  })
})
