// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P0-8 第八批:边读面(2026-11-23)。
 *
 * 钉住四件事:
 * ① 无归属 fail-closed **且零 DB 调用**;
 * ② limit 夹取 [1, 200]、默认 50,边界逐值断言;
 * ③ 四个过滤位一律等值(不模糊) —— 边表存的是名字原文,前缀匹配会把 use 匹到 userState;
 * ④ 路由真的挂上了 GET /repo/:repoId/edges,limit 非法显式 400。
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
  h.limits.length = 0
  h.rows = []
})

describe('P0-8h findEdges 行为面', () => {
  it('无归属 ⇒ 零 DB 调用且返回空集', async () => {
    const out = await codebaseIndexService.findEdges({ repoId: 'r1' })
    expect(out).toEqual([])
    expect(h.selectCalls).toBe(0)
  })

  it('有归属 ⇒ 返回数据库行原样透传(含 fromEntityId 可为 null)', async () => {
    h.rows = [
      {
        id: 'e1',
        filePath: 'src/a.ts',
        line: 3,
        kind: 'import',
        fromName: 'src/a.ts',
        toName: 'react',
        fromEntityId: null,
      },
    ]
    const out = await codebaseIndexService.findEdges({ repoId: 'r1', ownerUuid: 'u1' })
    expect(h.selectCalls).toBe(1)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ toName: 'react', fromEntityId: null })
  })

  it('limit 夹取:500→200、0→1、缺省→50', async () => {
    await codebaseIndexService.findEdges({ repoId: 'r1', ownerUuid: 'u1', limit: 500 })
    await codebaseIndexService.findEdges({ repoId: 'r1', ownerUuid: 'u1', limit: 0 })
    await codebaseIndexService.findEdges({ repoId: 'r1', ownerUuid: 'u1' })
    expect(h.limits).toEqual([200, 1, 50])
  })
})

describe('P0-8h findEdges 判据形态(源码面)', () => {
  it('四个过滤位一律 eq,不做模糊匹配', () => {
    for (const col of ['fromName', 'toName', 'kind', 'filePath']) {
      expect(SERVICE_SRC).toContain(`whereParts.push(eq(codebaseEdges.${col}, ${col}))`)
    }
  })

  it('排序按 (filePath, line, toName) 三元组', () => {
    expect(SERVICE_SRC).toContain(
      'orderBy(codebaseEdges.filePath, codebaseEdges.line, codebaseEdges.toName)',
    )
  })

  it('select 面带 fromEntityId(可空边也要能读出来)', () => {
    expect(SERVICE_SRC).toContain('fromEntityId: codebaseEdges.fromEntityId')
  })
})

describe('P0-8h 路由契约', () => {
  it('端点挂载并调用 findEdges', () => {
    expect(ROUTE_SRC).toContain("server.get('/repo/:repoId/edges'")
    expect(ROUTE_SRC).toContain('codebaseIndexService.findEdges({')
  })

  it('limit 非法显式 400、失败 500 各有独立文案', () => {
    expect(ROUTE_SRC).toContain("'limit 必须是正整数'")
    expect(ROUTE_SRC).toContain("'导入边清单查询失败'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
