// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Z36:HTTP/服务侧按 symbolName 取回库内**全部**切片。
 *
 * 钉的是次序,不是文案:过滤位必须落在 SQL 的 WHERE 里(即 `LIMIT` **之前**),
 * 并且该档的取回上限必须脱离 topK —— 否则「先滤后截」只是把截断集换了个数字。
 *
 * 测法沿用本仓既有形态(`src/services/__tests__/codebase-index-tenant-isolation.test.ts`):
 * mock `db`,把 drizzle SQL 片段渲染成可断言文本。零真实 DB / 零网络,因此既不碰生产库
 * PG 8810 也不碰 Redis 8811(AGENTS §5 测试隔离)。渲染走 `SQL#toString` 的 inline 形态:
 * 实测 `toQuery({escapeName, escapeParam, casing})` 需要 dialect 的 `casing.getColumnCasing`,
 * 手工 config 对象给不出来(失败还会被服务层的 catch 吞成"空结果",看着像功能没生效);
 * 而 inline 会把参数原样写回文本 ⇒ 断言能直接看到符号等值条件与 `LIMIT 200`。
 * 渲染器是测试基建(把 SQL 变成字符串),不是生产判据的第二份副本 —— 数字口径一律吃被测
 * 模块自己导出的 `rowBudget`(§22c)。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: {
    execute: (q: unknown) => {
      captured.push(renderSql(q))
      return Promise.resolve(executeRows)
    },
    insert: () => chainStub(),
    delete: () => chainStub(),
    update: () => chainStub(),
    select: () => chainStub(),
  },
}))

vi.mock('../src/services/embedding-provider.js', () => ({
  getEmbeddingProvider: () => null,
}))

const captured: string[] = []
let executeRows: unknown[] = []

function chainStub(): unknown {
  const self: Record<string, unknown> = {
    where: () => self,
    values: () => self,
    returning: () => Promise.resolve([]),
    from: () => self,
    orderBy: () => self,
    then: (resolve: (v: unknown) => void) => resolve([]),
  }
  return self
}

/** drizzle 渲染入口:`toQuery` 需要真正的 CasingCache 实例(手工 {cache,convert} 对象不够)。 */
import { CasingCache } from 'drizzle-orm/casing'

function renderSql(frag: unknown): string {
  const f = frag as {
    toQuery?: (cfg: unknown) => { sql: string }
  }
  if (typeof f.toQuery !== 'function') return String(frag)
  try {
    // inlineParams:把值写回文本,断言才能直接看到 `"symbol_name" = 'x'` 与 `LIMIT 200`
    return f.toQuery({
      casing: new CasingCache(),
      escapeName: (n: string) => `"${n}"`,
      escapeParam: (i: number) => `$${i + 1}`,
      escapeString: (s: string) => `'${s.replace(/'/g, "''")}'`,
      inlineParams: true,
    }).sql
  } catch {
    return ''
  }
}

import {
  codebaseIndexService,
  rowBudget,
  SYMBOL_SCOPED_ROW_CAP,
} from '../src/services/codebase-index-service.js'
import type { SearchResult } from '../src/services/codebase-index-service.js'

const SYM = 'alpha_target_symbol'
const OTHER = 'beta_other_symbol'
const OWNER = 'user-a'

/** 行形状 = 腿真正 SELECT 出来的列(snake_case,DB 返回值,不是判据副本)。 */
function dbRow(id: string, symbolName: string): Record<string, unknown> {
  return {
    id,
    file_path: `src/${symbolName}.ts`,
    line_start: 1,
    line_end: 8,
    content: `function ${symbolName}() {}`,
    language: 'typescript',
    symbol_name: symbolName,
    symbol_type: 'function',
    embedding_provider: 'remote',
    score: 0.7,
  }
}

/** 夹具:同一符号 6 片(> topK)+ 别的符号 3 片。 */
function corpus(): Record<string, unknown>[] {
  return [
    ...Array.from({ length: 6 }, (_, i) => dbRow(`a${i}`, SYM)),
    ...Array.from({ length: 3 }, (_, i) => dbRow(`b${i}`, OTHER)),
  ]
}

/** 让流程走到 SQL:注入假 embedding(替身,与既有测试同一手法)。 */
function withEmbedding(): void {
  const svc = codebaseIndexService as unknown as {
    _getEmbedding: (t: string) => Promise<number[] | null>
  }
  svc._getEmbedding = async () => new Array(1536).fill(0.1)
}

beforeEach(() => {
  captured.length = 0
  executeRows = []
  withEmbedding()
})

describe('rowBudget(取回预算单源)', () => {
  it('缺省符号过滤 ⇒ 与在册形态逐字相同(fetchLimit = topK*2,outCap = topK)', () => {
    expect(rowBudget(undefined, 10)).toEqual({ fetchLimit: 20, outCap: 10 })
    expect(rowBudget(undefined, 3)).toEqual({ fetchLimit: 6, outCap: 3 })
  })

  it('带符号过滤 ⇒ 两个数字都脱离 topK', () => {
    expect(rowBudget(SYM, 3)).toEqual({
      fetchLimit: SYMBOL_SCOPED_ROW_CAP,
      outCap: SYMBOL_SCOPED_ROW_CAP,
    })
  })
})

describe('向量腿 search()', () => {
  it('缺省 ⇒ SQL 不含符号等值条件,且仍按 topK 截(正向对照:零破坏)', async () => {
    executeRows = corpus()
    const out = await codebaseIndexService.search({ query: 'q', topK: 2, ownerUuid: OWNER })
    expect(captured).toHaveLength(1)
    expect(captured[0]).not.toContain(`"symbol_name" = `)
    expect(captured[0]).toContain('LIMIT 4')
    expect(out).toHaveLength(2)
    expect(out[0]?.symbolName).toBe(SYM)
  })

  it('带 symbolName ⇒ 过滤发生在 LIMIT 之前,且取回集不被 topK 削', async () => {
    executeRows = corpus()
    const out = await codebaseIndexService.search({
      query: 'q',
      topK: 2,
      symbolName: SYM,
      ownerUuid: OWNER,
    })
    const sqlText = captured[0] as string
    const filterAt = sqlText.indexOf(`"symbol_name" = '${SYM}'`)
    const limitAt = sqlText.search(/LIMIT/)
    expect(filterAt).toBeGreaterThan(-1)
    expect(limitAt).toBeGreaterThan(-1)
    expect(filterAt).toBeLessThan(limitAt)
    expect(sqlText).toContain(`LIMIT ${SYMBOL_SCOPED_ROW_CAP}`)
    expect(sqlText).not.toContain('LIMIT 4')
    // 替身 DB 不重跑 WHERE(重跑就是测试里复制一份生产判据,§22c):它能证明的是
    // 「谁被摘掉」由 SQL 条件决定(上面三行),而 JS 侧**不再二次截断** —— 9 行进、9 行出;
    // 同一夹具在缺省档只出 2 行(topK),这组差值就是"过滤位在 limit 之前"的落点。
    expect(out).toHaveLength(9)
  })

  it('symbolName 是数据列不是身份:无归属仍 fail-closed(1 = 0 不被过滤位替代)', async () => {
    executeRows = corpus()
    await codebaseIndexService.search({ query: 'q', topK: 2, symbolName: SYM })
    expect(captured[0]).toContain('1 = 0')
    expect(captured[0]).toContain(`"symbol_name" = '${SYM}'`)
    // 有归属时:归属值与符号值同批 AND 在一条 WHERE 里(而不是二选一)
    executeRows = []
    await codebaseIndexService.search({ query: 'q', symbolName: SYM, ownerUuid: OWNER })
    expect(captured[1]).toContain(`owner_uuid`)
    expect(captured[1]?.includes(OWNER)).toBe(true)
    expect(captured[1]).toContain(`"symbol_name" = '${SYM}'`)
  })
})

describe('词法腿 keywordSearch()', () => {
  it('缺省 ⇒ 不新增符号条件(SQL 与在册形态同构)', async () => {
    executeRows = corpus()
    await codebaseIndexService.keywordSearch({ query: 'q', topK: 2, ownerUuid: OWNER })
    expect(captured[0]).not.toContain(`"symbol_name" = `)
    expect(captured[0]).toContain('LIMIT 4')
  })

  it('带 symbolName ⇒ 条件进 WHERE 且在 LIMIT 之前;本腿无 JS 截断,靠上限脱离 topK 拿全量', async () => {
    executeRows = corpus()
    const out = await codebaseIndexService.keywordSearch({
      query: 'q',
      topK: 2,
      symbolName: SYM,
      ownerUuid: OWNER,
    })
    const sqlText = captured[0] as string
    expect(sqlText.indexOf(`"symbol_name" = '${SYM}'`)).toBeLessThan(sqlText.search(/LIMIT/))
    expect(sqlText).toContain(`LIMIT ${SYMBOL_SCOPED_ROW_CAP}`)
    expect(out.filter((r) => r.symbolName === SYM)).toHaveLength(6)
  })
})

describe('混合腿 hybridSearch()', () => {
  it('symbolName 透传给两条腿(漏一条 = 融合出来的仍是截断集)', async () => {
    executeRows = corpus()
    await codebaseIndexService.hybridSearch({
      query: 'q',
      topK: 2,
      symbolName: SYM,
      ownerUuid: OWNER,
    })
    expect(captured.length).toBeGreaterThanOrEqual(2)
    for (const sqlText of captured) {
      expect(sqlText).toContain(`"symbol_name" = '${SYM}'`)
      expect(sqlText).toContain(`LIMIT ${SYMBOL_SCOPED_ROW_CAP}`)
    }
  })

  it('融合后不再被 topK 削:同符号 6 片全在出参里', async () => {
    executeRows = corpus()
    const out = await codebaseIndexService.hybridSearch({
      query: SYM,
      topK: 2,
      symbolName: SYM,
      ownerUuid: OWNER,
    })
    const ids = new Set((out as SearchResult[]).map((r) => r.id))
    expect([...ids].filter((id) => id.startsWith('a'))).toHaveLength(6)
  })

  it('缺省 ⇒ 混合腿仍按 topK 截(正向对照)', async () => {
    executeRows = corpus()
    const out = await codebaseIndexService.hybridSearch({ query: 'q', topK: 2, ownerUuid: OWNER })
    expect(out).toHaveLength(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
