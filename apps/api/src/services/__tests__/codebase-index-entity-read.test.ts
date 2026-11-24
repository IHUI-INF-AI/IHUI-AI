// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P0-8 第四批:实体读面(2026-11-23)。
 *
 * 钉住四件事:
 * ① 无归属 fail-closed **且零 DB 调用**(不是"查一次空集",是"压根不查");
 * ② limit 夹取 [1, 200]、默认 50 —— 三个边界都逐值断言,不给"传了没生效"留口子;
 * ③ 三个过滤位一律等值(不模糊):name/kind/filePath 的写法在源码面钉死;
 * ④ 路由真的挂上了 GET /repo/:repoId/entities,且 limit 非法时显式 400。
 */

import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  selectCalls: 0,
  limits: [] as number[],
  rows: [] as unknown[],
}))

vi.mock('../../db/index.js', () => {
  const selectStub = () => {
    h.selectCalls += 1
    return {
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: (n: number) => {
              h.limits.push(n)
              return Promise.resolve(h.rows)
            },
          }),
        }),
      }),
    }
  }
  return { db: { select: selectStub } }
})

vi.mock('../embedding-provider.js', () => ({ getEmbeddingProvider: () => null }))

import { codebaseIndexService } from '../codebase-index-service.js'

const REPO_ROOT = path.resolve(__dirname, '../../../../..')
const SERVICE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'apps/api/src/services/codebase-index-service.ts'),
  'utf8',
)
const ROUTE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'apps/api/src/routes/v1-codebase-search.ts'),
  'utf8',
)

beforeEach(() => {
  h.selectCalls = 0
  h.limits = []
  h.rows = []
})

describe('P0-8d findEntities 归属与 limit', () => {
  it('无归属 ⇒ 空数组,且一次 DB 都不查', async () => {
    const rows = await codebaseIndexService.findEntities({ repoId: 'repo-1' })
    expect(rows).toEqual([])
    expect(h.selectCalls).toBe(0)
  })

  it('null / 空串归属同样不查', async () => {
    expect(await codebaseIndexService.findEntities({ repoId: 'r', ownerUuid: null })).toEqual([])
    expect(await codebaseIndexService.findEntities({ repoId: 'r', ownerUuid: '' })).toEqual([])
    expect(h.selectCalls).toBe(0)
  })

  it('有归属默认 limit=50', async () => {
    h.rows = [
      { id: 'e1', filePath: 'a.ts', lineStart: 1, lineEnd: 9, kind: 'function', name: 'foo' },
    ]
    const rows = await codebaseIndexService.findEntities({ repoId: 'r', ownerUuid: 'u' })
    expect(rows).toHaveLength(1)
    expect(h.limits).toEqual([50])
  })

  it('limit 下界夹到 1(0 与负数同档)', async () => {
    await codebaseIndexService.findEntities({ repoId: 'r', ownerUuid: 'u', limit: 0 })
    await codebaseIndexService.findEntities({ repoId: 'r', ownerUuid: 'u', limit: -7 })
    expect(h.limits).toEqual([1, 1])
  })

  it('limit 上界夹到 200', async () => {
    await codebaseIndexService.findEntities({ repoId: 'r', ownerUuid: 'u', limit: 999 })
    await codebaseIndexService.findEntities({ repoId: 'r', ownerUuid: 'u', limit: 200 })
    expect(h.limits).toEqual([200, 200])
  })
})

describe('P0-8d 源码面:等值过滤与路由接线', () => {
  it('三个过滤位一律 eq(不 LIKE / 不模糊)', () => {
    expect(SERVICE_SRC).toContain('whereParts.push(eq(codebaseEntities.name, name))')
    expect(SERVICE_SRC).toContain('whereParts.push(eq(codebaseEntities.kind, kind))')
    expect(SERVICE_SRC).toContain('whereParts.push(eq(codebaseEntities.filePath, filePath))')
    // 反证:这三行不得出现任何模糊匹配
    expect(SERVICE_SRC).not.toContain('ilike(codebaseEntities.name')
    expect(SERVICE_SRC).not.toContain('like(codebaseEntities.name')
  })

  it('limit 夹取表达式只在 findEntities 里一份', () => {
    const hits = SERVICE_SRC.split('Math.min(Math.max(1, limit ?? 50), 200)').length - 1
    expect(hits).toBe(1)
  })

  it('路由挂了 GET /repo/:repoId/entities 并透传四个查询位', () => {
    expect(ROUTE_SRC).toContain("server.get('/repo/:repoId/entities'")
    expect(ROUTE_SRC).toContain('codebaseIndexService.findEntities({')
    expect(ROUTE_SRC).toContain('ownerUuid: req.userId')
    expect(ROUTE_SRC).toContain("'limit 必须是正整数'")
  })

  it('路由对 limit 做 Number 解析而非静默折默认', () => {
    expect(ROUTE_SRC).toContain('const limit = q.limit === undefined ? undefined : Number(q.limit)')
    expect(ROUTE_SRC).toContain('!Number.isFinite(limit) || limit <= 0')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
