// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P0-8 第三批:实体写入通道(2026-11-23)。
 *
 * 钉住三件事:
 * ① 派生是纯函数 —— 同一符号跨切片合并成**一行**(行区间 min..max),无符号不冒充符号;
 * ② 实体行与切片**同一事务、同一文件粒度**写入 ⇒ 删除面必须同步删实体(否则留幽灵节点);
 * ③ 归属谓词不能复用切片表的 —— 那个谓词绑 `expires_at`,实体表没有该列。
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  calls: [] as string[],
  deletedRows: [{ id: 'c1' }],
}))

vi.mock('../../db/index.js', () => {
  const makeWhere = () => {
    const settled = Promise.resolve(h.deletedRows)
    return {
      returning: () => settled,
      then: (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
        settled.then(onOk, onErr),
    }
  }
  interface DbStub {
    delete: () => { where: typeof makeWhere }
    transaction: (fn: (tx: DbStub) => Promise<void>) => Promise<void>
  }
  const dbStub: DbStub = {
    delete: () => {
      h.calls.push('delete')
      return { where: makeWhere }
    },
    transaction: async (fn) => fn(dbStub),
  }
  return { db: dbStub }
})

vi.mock('../embedding-provider.js', () => ({ getEmbeddingProvider: () => null }))

import type { ChunkInput } from '../codebase-index-service.js'
import { codebaseIndexService, deriveEntitiesFromChunks } from '../codebase-index-service.js'

const REPO_ROOT = path.resolve(__dirname, '../../../../..')

function chunk(over: Partial<ChunkInput>): ChunkInput {
  return {
    filePath: 'apps/api/src/a.ts',
    lineStart: 1,
    lineEnd: 10,
    content: 'x',
    ...over,
  }
}

describe('P0-8c deriveEntitiesFromChunks', () => {
  it('空数组 ⇒ 空实体集', () => {
    expect(deriveEntitiesFromChunks([])).toEqual([])
  })

  it('无 symbolName 的切片不产出实体(不拿文件名冒充符号)', () => {
    expect(deriveEntitiesFromChunks([chunk({}), chunk({ lineStart: 11, lineEnd: 20 })])).toEqual([])
  })

  it('纯空白 symbolName 也不算符号', () => {
    expect(
      deriveEntitiesFromChunks([chunk({ symbolName: '   ', symbolType: 'function' })]),
    ).toEqual([])
  })

  it('单符号 ⇒ 一条,kind 取 symbolType', () => {
    const out = deriveEntitiesFromChunks([
      chunk({ symbolName: 'indexChunks', symbolType: 'method', lineStart: 250, lineEnd: 374 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({
      filePath: 'apps/api/src/a.ts',
      lineStart: 250,
      lineEnd: 374,
      kind: 'method',
      name: 'indexChunks',
    })
  })

  it('symbolType 缺省 ⇒ kind 为 symbol(不猜具体种类)', () => {
    expect(deriveEntitiesFromChunks([chunk({ symbolName: 'foo' })])[0]?.kind).toBe('symbol')
  })

  it('同一符号跨多个切片 ⇒ 合并一行,行区间取 min..max', () => {
    const out = deriveEntitiesFromChunks([
      chunk({ symbolName: 'big', symbolType: 'function', lineStart: 40, lineEnd: 60 }),
      chunk({ symbolName: 'big', symbolType: 'function', lineStart: 20, lineEnd: 39 }),
      chunk({ symbolName: 'big', symbolType: 'function', lineStart: 61, lineEnd: 90 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ lineStart: 20, lineEnd: 90, name: 'big' })
  })

  it('同名不同 kind ⇒ 两条身份(不合并)', () => {
    const out = deriveEntitiesFromChunks([
      chunk({ symbolName: 'Svc', symbolType: 'class' }),
      chunk({ symbolName: 'Svc', symbolType: 'type' }),
    ])
    expect(out.map((e) => e.kind).sort()).toEqual(['class', 'type'])
  })

  it('跨文件同名 ⇒ 两条身份', () => {
    const out = deriveEntitiesFromChunks([
      chunk({ filePath: 'a/x.ts', symbolName: 'dup' }),
      chunk({ filePath: 'b/x.ts', symbolName: 'dup' }),
    ])
    expect(out.map((e) => e.filePath)).toEqual(['a/x.ts', 'b/x.ts'])
  })

  it('输出按 (filePath, lineStart, name) 稳定排序', () => {
    const out = deriveEntitiesFromChunks([
      chunk({ filePath: 'z.ts', symbolName: 'zzz', lineStart: 5 }),
      chunk({ filePath: 'a.ts', symbolName: 'beta', lineStart: 40 }),
      chunk({ filePath: 'a.ts', symbolName: 'alpha', lineStart: 10 }),
      chunk({ filePath: 'a.ts', symbolName: 'alpha2', lineStart: 10 }),
    ])
    expect(out.map((e) => `${e.filePath}:${e.lineStart}:${e.name}`)).toEqual([
      'a.ts:10:alpha',
      'a.ts:10:alpha2',
      'a.ts:40:beta',
      'z.ts:5:zzz',
    ])
  })
})

describe('P0-8c 删除面同步删实体', () => {
  it('deleteByRepo 同时删切片与实体(两次 delete)', async () => {
    h.calls.length = 0
    await codebaseIndexService.deleteByRepo('repo-1', 'owner-1')
    expect(h.calls).toEqual(['delete', 'delete'])
  })

  it('deleteByFiles 单批同样两次 delete', async () => {
    h.calls.length = 0
    await codebaseIndexService.deleteByFiles('repo-1', ['a.ts', 'b.ts'], 'owner-1')
    expect(h.calls).toEqual(['delete', 'delete'])
  })

  it('deleteByFiles 空清单 ⇒ 零 DB 动作', async () => {
    h.calls.length = 0
    await codebaseIndexService.deleteByFiles('repo-1', [], 'owner-1')
    expect(h.calls).toEqual([])
  })
})

describe('P0-8c 接线与契约(源码面)', () => {
  function read(rel: string): string {
    return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
  }

  it('实体谓词独立实现(不复用切片表的 _ownerScope)且被多处使用', () => {
    const src = read('apps/api/src/services/codebase-index-service.ts')
    expect(src).toContain('function _entityOwnerScope(')
    expect(src).toContain('eq(codebaseEntities.ownerUuid, ownerUuid)')
    // 定义 1 + indexChunks 1 + 三个删除方法各 1 = 5 是**下界**:读面(findEntities)等
    // 后续消费点会让计数增长,而上界不设 —— 新增消费点正是我们要的方向。
    expect(src.split('_entityOwnerScope(').length - 1).toBeGreaterThanOrEqual(5)
  })

  it('indexChunks 内派生实体并在同一事务写入,返回值带 entities', () => {
    const src = read('apps/api/src/services/codebase-index-service.ts')
    expect(src).toContain('const entityRows = deriveEntitiesFromChunks(chunks)')
    expect(src).toContain('await tx.insert(codebaseEntities).values(batch)')
    expect(src).toContain('entities: number')
    expect(src).toContain('return { indexed, vectorized, localEmbedded, entities }')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
