// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-698 评论聚合计数必须是 number。
 * 旧 SQL:COUNT(*) 标量子查询在 pg/drizzle 下以字符串返回,点赞后 likeCount 变 "0"+"1" 拼接。
 * 本夹具冻结生成 SQL 的显式 ::int 转换(旧写法不含 ::int ⇒ 拦截断言翻红);
 * 隔离:mock ../../db/index.js,不连库。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

const state = vi.hoisted(() => ({
  selectArgs: [] as Record<string, unknown>[],
  selectRows: [] as unknown[][],
}))

vi.mock('../../db/index.js', () => {
  function createChain(result: unknown[]) {
    const chain: Record<string, any> = {
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
    }
    return chain
  }
  return {
    db: {
      select: vi.fn((fields: Record<string, unknown>) => {
        state.selectArgs.push(fields)
        return createChain(state.selectRows.shift() ?? [])
      }),
    },
  }
})

import { findComments } from '../../db/comment-queries.js'

/** 把 drizzle SQL/Column/Aliased 节点拼成可断言的文本。 */
function sqlText(node: unknown): string {
  if (!node || typeof node !== 'object') return String(node ?? '')
  const n = node as Record<string, any>
  const parts: string[] = []
  if (typeof n.name === 'string') parts.push(n.name)
  if (typeof n.value === 'string') parts.push(n.value)
  else if (Array.isArray(n.value)) parts.push(n.value.join(''))
  if (Array.isArray(n.queryChunks)) {
    for (const chunk of n.queryChunks) parts.push(sqlText(chunk))
  }
  if (n.sql) parts.push(sqlText(n.sql))
  return parts.join('')
}

describe('F-698 评论列表面 COUNT(*)::int', () => {
  beforeEach(() => {
    state.selectArgs = []
    // 列表页 + 总数页各一次 select
    state.selectRows = [[], [{ total: 0 }]]
    vi.clearAllMocks()
  })

  it('list 面 likeCount / repliesCount 的 SQL 均显式 ::int', async () => {
    await findComments({
      resourceType: 'post',
      resourceId: 'resource-1',
      page: 1,
      pageSize: 20,
    })
    const listFields = state.selectArgs.find((arg) => 'repliesCount' in arg)
    expect(listFields).toBeDefined()
    expect(sqlText(listFields?.repliesCount)).toContain('COUNT(*)::int')
    expect(sqlText(listFields?.likeCount)).toContain('COUNT(*)::int')
    // 旧写法 COUNT(*) 无 ::int ⇒ 上面两条均为红
  })
})
