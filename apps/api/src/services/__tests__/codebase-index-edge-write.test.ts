// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P0-8 第七批:导入边写入通道(2026-11-23)。
 *
 * 钉住四件事:
 * ① 派生是纯函数 —— fromName 取模块路径(filePath)而不是 basename(后者会撞名);
 * ② 非法条目(空名/line<=0/非整数行)一律跳过,不塞 0 号行伪造位置;
 * ③ 清除面 = 切片文件 ∪ 边文件(纯声明文件也要换新,否则留下上一轮的边);
 * ④ 三处删除方法必须同步删边,返回的 chunk 删除数语义不变。
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { deriveEdgesFromImports, type ImportEdgeInput } from '../codebase-index-service.js'

const REPO_ROOT = path.resolve(__dirname, '../../../../..')

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
}

function edge(over: Partial<ImportEdgeInput>): ImportEdgeInput {
  return { filePath: 'src/a.ts', name: 'react', line: 1, ...over }
}

describe('P0-8f deriveEdgesFromImports', () => {
  it('空清单 ⇒ 空边集', () => {
    expect(deriveEdgesFromImports([])).toEqual([])
  })

  it('fromName 取模块路径,不取 basename', () => {
    const out = deriveEdgesFromImports([
      edge({ filePath: 'pkg/a/index.ts', name: 'lodash', line: 3 }),
      edge({ filePath: 'pkg/b/index.ts', name: 'lodash', line: 3 }),
    ])
    expect(out.map((e) => e.fromName)).toEqual(['pkg/a/index.ts', 'pkg/b/index.ts'])
    expect(out.every((e) => e.kind === 'import')).toBe(true)
    expect(out.every((e) => e.toName === 'lodash')).toBe(true)
  })

  it('同一文件同一行同名只留一条', () => {
    const out = deriveEdgesFromImports([
      edge({ name: 'x', line: 2 }),
      edge({ name: 'x', line: 2 }),
      edge({ name: 'x', line: 3 }),
    ])
    expect(out).toHaveLength(2)
  })

  it('空名 / 非正行 / 非整数行 一律跳过', () => {
    const out = deriveEdgesFromImports([
      edge({ name: '   ' }),
      edge({ name: 'y', line: 0 }),
      edge({ name: 'z', line: -4 }),
      edge({ name: 'w', line: 1.5 }),
    ])
    expect(out).toEqual([])
  })

  it('按 (filePath, line, toName) 稳定排序', () => {
    const out = deriveEdgesFromImports([
      edge({ filePath: 'b.ts', name: 'k', line: 5 }),
      edge({ filePath: 'a.ts', name: 'z', line: 9 }),
      edge({ filePath: 'a.ts', name: 'a', line: 9 }),
      edge({ filePath: 'a.ts', name: 'm', line: 2 }),
    ])
    expect(out.map((e) => `${e.filePath}:${e.line}:${e.toName}`)).toEqual([
      'a.ts:2:m',
      'a.ts:9:a',
      'a.ts:9:z',
      'b.ts:5:k',
    ])
  })

  it('不改入参对象', () => {
    const input = [edge({ name: 'react' })]
    const snapshot = JSON.stringify(input)
    deriveEdgesFromImports(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('P0-8f 写入面与清除面(源码面)', () => {
  const src = read('apps/api/src/services/codebase-index-service.ts')

  it('边与切片同事务:先删后插、分批、计数', () => {
    // prettier 会把 `await tx.delete(...)` 折成多行,故按调用片段断言而不按整行字面量
    expect(src.split('.delete(codebaseEdges)').length - 1).toBeGreaterThanOrEqual(4)
    expect(src).toContain('.insert(codebaseEdges).values(batch)')
    expect(src).toContain('edges += batch.length')
  })

  it('清除面是切片文件 ∪ 边文件的并集', () => {
    expect(src).toContain(
      'const clearFilePaths = [...new Set([...filePaths, ...edgeRows.map((r) => r.filePath)])]',
    )
    expect(src).toContain('for (const filePath of clearFilePaths)')
  })

  it('边谓词独立实现,且被多处使用(下界)', () => {
    expect(src).toContain('function _edgeOwnerScope(')
    expect(src).toContain('eq(codebaseEdges.ownerUuid, ownerUuid)')
    // 定义 1 + 写入 1 + 三删除 3 = 5 为下界(读面等后续消费点会让计数增长)
    expect(src.split('_edgeOwnerScope(').length - 1).toBeGreaterThanOrEqual(5)
  })
})

describe('P0-8f 三处删除面同步删边', () => {
  const src = read('apps/api/src/services/codebase-index-service.ts')

  it('deleteByRepo 清边', () => {
    const body = src.split('async deleteByRepo(')[1] ?? ''
    const head = body.split('async deleteByFileScoped(')[0] ?? ''
    expect(head).toContain('delete(codebaseEdges)')
  })

  it('deleteByFileScoped 清边', () => {
    const body = src.split('async deleteByFileScoped(')[1] ?? ''
    const head = body.split('async deleteByFile(')[0] ?? ''
    expect(head).toContain('delete(codebaseEdges)')
  })

  it('deleteByFiles 在同一 in 批次清边', () => {
    const body = src.split('async deleteByFiles(')[1] ?? ''
    const head = body.split('async getStats(')[0] ?? ''
    expect(head).toContain('delete(codebaseEdges)')
    expect(head).toContain('inArray(codebaseEdges.filePath, batch)')
  })
})

describe('P0-8f 路由契约', () => {
  const route = read('apps/api/src/routes/v1-codebase-search.ts')

  it('indexSchema 收 imports 且有上限', () => {
    expect(route).toContain('imports: z')
    expect(route).toContain('.max(20000)')
  })

  it('indexChunks 调用把 imports 放第五位', () => {
    expect(route).toContain('b.imports,')
    expect(route).toContain('// retentionDays 位保持缺省(路由层暂不透传),imports 走第五位')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
