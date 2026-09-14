// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * repo-wiki-context 单元测试(P1-8 2026-09-13)
 *
 * 覆盖:
 * - trimWikiContext 纯函数:短内容不截断 / 超长在最后换行处截断并带提示 / 无换行硬截
 * - loadRepoWikiContext:repoName 为空直接 null;查询异常被吞掉返回 null(不阻塞主链路)
 */

import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/database', () => ({
  repoWikiDocs: {
    kind: 'kind',
    repoName: 'repoName',
    userId: 'userId',
    content: 'content',
    generatedAt: 'generatedAt',
  },
}))
vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [],
          }),
        }),
      }),
    }),
  },
}))
vi.mock('../clawdbot/logger.js', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}))

const { trimWikiContext, loadRepoWikiContext } = await import('../repo-wiki-context.js')
const { db } = await import('../../db/index.js')

const HINT = '\n\n…（项目百科已截断）'

describe('trimWikiContext — 纯函数截断', () => {
  it('短内容原样返回,不截断', () => {
    const out = trimWikiContext('短正文', 100)
    expect(out).toEqual({ content: '短正文', truncated: false })
  })

  it('超长在 limit 之前最后一个换行处截断并带提示', () => {
    const original = 'line1\nline2\nline3\nline4\nline5' // 长度 29
    const out = trimWikiContext(original, 20)
    expect(out.truncated).toBe(true)
    // limit=20 之前最后的换行在 index 17 → head = 'line1\nline2\nline3'
    expect(out.content).toBe(`line1\nline2\nline3${HINT}`)
    expect(out.content.endsWith(HINT)).toBe(true)
  })

  it('无换行的超长内容硬截到 limit', () => {
    const out = trimWikiContext('x'.repeat(100), 10)
    expect(out.truncated).toBe(true)
    expect(out.content).toBe(`${'x'.repeat(10)}${HINT}`)
  })

  it('默认 limit = MAX_WIKI_CONTEXT_CHARS(8000)', () => {
    const short = 'y'.repeat(8000)
    expect(trimWikiContext(short).truncated).toBe(false)
    expect(trimWikiContext(`${short}z`).truncated).toBe(true)
  })
})

describe('loadRepoWikiContext — 取数容错', () => {
  it('repoName 为空/纯空白/null 时直接返回 null', async () => {
    expect(await loadRepoWikiContext('u1', '')).toBeNull()
    expect(await loadRepoWikiContext('u1', '   ')).toBeNull()
    expect(await loadRepoWikiContext('u1', null)).toBeNull()
    expect(await loadRepoWikiContext('u1', undefined)).toBeNull()
  })

  it('未命中(wiki 表无该仓库)返回 null', async () => {
    expect(await loadRepoWikiContext('u1', 'demo')).toBeNull()
  })

  it('查询异常被吞掉并返回 null(绝不抛给聊天主链路)', async () => {
    const spy = vi.spyOn(db, 'select').mockImplementation(() => {
      throw new Error('db down')
    })
    await expect(loadRepoWikiContext('u1', 'demo')).resolves.toBeNull()
    spy.mockRestore()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
