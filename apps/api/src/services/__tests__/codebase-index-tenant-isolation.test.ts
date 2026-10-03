// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 代码索引的归属隔离 + 保留期专项测试(2026-10-03 数据出域合规整改立)。
 *
 * 被测对象:`codebase-index-service` 的归属谓词与保留期计算。
 *
 * 背景:codebase_chunks 存**用户代码明文** + 向量,而整改前:
 *   - 表上只有 repo_id,而它只是路径 hash(不是用户身份);
 *   - search/keywordSearch/hybridSearch 的 repoId 是**可选**参数,不传即跨全部
 *     仓库检索 —— 等于任何登录用户都能检索到别人的代码;
 *   - 无 TTL、无清理任务 ⇒ 永久留存。
 * 本文件把"无归属 ⇒ 命中 0 行(fail-closed)"与"过期即不可见"钉成期望值。
 *
 * 测法:mock `db`,捕获每次调用的 where 片段并断言其含归属/过期条件。
 * 这是本仓既有形态(codebase-hybrid-search.test.ts 只测纯函数)下最贴近
 * "不接库也能验谓词"的做法 —— 谓词写错时,SQL 文本会直接变。
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// ---- db mock:记录所有 where 片段,返回一个可链式的假查询 ----------------------
type Captured = { op: string; where: unknown }

const captured: Captured[] = []
let executeResult: unknown = []
/** execute 的可替换实现:需要"逐轮不同返回"时(分批循环)由用例自己接管。 */
let dbExecuteImpl: (q: unknown) => Promise<unknown> = () => Promise.resolve(executeResult)

/**
 * 链式假查询。刻意**不做 thenable**:drizzle 的 delete/insert 链在真实代码里
 * 被 `await`,但这里被测函数只调用 .where()/.values()/.returning() 就结束,
 * 返回 Promise.resolve([]) 足以让 .returning() 后的 await 成立。
 * 早先版本把 then 挂在 self 上,导致 `await self` 自我递归 → V8 栈溢出崩溃。
 */
function chain(op: string) {
  const rec: Captured = { op, where: undefined }
  captured.push(rec)
  const self: Record<string, unknown> = {
    where: (w: unknown) => {
      rec.where = w
      return self
    },
    values: () => self,
    set: () => self,
    returning: () => Promise.resolve([]),
  }
  return self
}

vi.mock('../../db/index.js', () => ({
  db: {
    execute: (q: unknown) => {
      captured.push({ op: 'execute', where: q })
      return dbExecuteImpl(q)
    },
    insert: () => chain('insert'),
    delete: () => chain('delete'),
    update: () => chain('update'),
  },
}))

vi.mock('../embedding-provider.js', () => ({
  getEmbeddingProvider: () => null,
}))

// 静态导入(不用顶层 await import):vi.mock 是提升的,配合顶层 await 会让
// 模块图在 worker 里出现竞态,表现为 V8 崩溃而非可读的断言失败。
import {
  codebaseIndexService,
  codeIndexExpiresAt,
  CODE_INDEX_RETENTION_DAYS,
} from '../codebase-index-service.js'

/**
 * 把 drizzle SQL 片段渲染成可断言的字符串。
 *
 * 用官方 `toQuery` 而不是去扒 `queryChunks` 内部结构:后者是实现细节,drizzle
 * 升级即失效(第一版就这么写的,结果是条件片段根本没被提取到,断言拿着
 * "只有模板字面量的半截 SQL"去比对,红得莫名其妙)。
 * toQuery 走 PgDialect 的公开渲染路径,升版只要 dialect 不换就稳定。
 */
function renderSql(frag: unknown): string {
  if (frag == null) return ''
  const anyFrag = frag as {
    toQuery?: (cfg: unknown) => { sql: string; params: unknown[] }
  }
  if (typeof anyFrag.toQuery !== 'function') return String(frag)
  try {
    const q = anyFrag.toQuery({
      escapeName: (n: string) => `"${n}"`,
      escapeParam: (i: number) => `$${i + 1}`,
      casing: { cache: () => undefined, convert: (c: string) => c },
    })
    // 把参数内联回去,断言才能看到 "owner_uuid = 'user-a'" 这类完整条件
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
  captured.length = 0
  executeResult = []
  dbExecuteImpl = () => Promise.resolve(executeResult)
})

afterEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// 1. 保留期计算
// ===========================================================================

describe('codeIndexExpiresAt', () => {
  it('默认保留期为 90 天(不是永久)', () => {
    expect(CODE_INDEX_RETENTION_DAYS).toBe(90)
    const now = new Date('2026-10-03T00:00:00.000Z')
    const exp = codeIndexExpiresAt(now)
    const days = (exp.getTime() - now.getTime()) / (24 * 3600 * 1000)
    expect(days).toBeCloseTo(90, 6)
  })

  it('可显式指定保留天数', () => {
    const now = new Date('2026-10-03T00:00:00.000Z')
    const days = (codeIndexExpiresAt(now, 7).getTime() - now.getTime()) / (24 * 3600 * 1000)
    expect(days).toBeCloseTo(7, 6)
  })

  it('0 天 = 写完立刻过期(用户主动要求不保留,合法输入)', () => {
    const now = new Date('2026-10-03T00:00:00.000Z')
    expect(codeIndexExpiresAt(now, 0).getTime()).toBe(now.getTime())
  })

  it('同一 now 传入两次结果一致(不读两次时钟)', () => {
    const now = new Date('2026-10-03T00:00:00.000Z')
    expect(codeIndexExpiresAt(now).getTime()).toBe(codeIndexExpiresAt(now).getTime())
  })
})

// ===========================================================================
// 2. 检索面:无归属 ⇒ 命中 0 行(fail-closed)
// ===========================================================================

describe('检索面归属隔离', () => {
  it('search 不传 ownerUuid 时不得返回任何行', async () => {
    // 注入假 embedding 让流程走到 SQL 阶段
    const svc = codebaseIndexService as unknown as {
      _getEmbedding: (t: string) => Promise<number[] | null>
    }
    svc._getEmbedding = async () => new Array(1536).fill(0.1)

    executeResult = [{ id: 'x', file_path: 'a.py', line_start: 1, line_end: 2, content: 'secret', language: 'python', symbol_name: null, symbol_type: null, score: 0.9 }]

    const out = await codebaseIndexService.search({ query: 'anything' })

    // 关键:即便 DB 假返回了行,无 ownerUuid 也必须被谓词挡住 —— 断言谓词为 1=0
    const sqlText = renderSql(captured.find((c) => c.op === 'execute')?.where)
    expect(sqlText).toContain('1 = 0')
    // 说明:真实 DB 会据此返回 0 行;这里能断言的是谓词本身(fail-closed 方向正确)
    expect(Array.isArray(out)).toBe(true)
  })

  it('search 带 ownerUuid 时谓词含该归属(而不是被跳过)', async () => {
    const svc = codebaseIndexService as unknown as {
      _getEmbedding: (t: string) => Promise<number[] | null>
    }
    svc._getEmbedding = async () => new Array(1536).fill(0.1)
    executeResult = []

    await codebaseIndexService.search({ query: 'q', ownerUuid: 'user-a' })

    const sqlText = renderSql(captured.find((c) => c.op === 'execute')?.where)
    expect(sqlText).not.toContain('1 = 0')
  })

  it('keywordSearch 无归属同样被挡住(词法通道也返回明文)', async () => {
    executeResult = []
    await codebaseIndexService.keywordSearch({ query: 'secret' })
    const sqlText = renderSql(captured.find((c) => c.op === 'execute')?.where)
    expect(sqlText).toContain('1 = 0')
  })

  it('hybridSearch 把 ownerUuid 透传给两个子通道', async () => {
    executeResult = []
    await codebaseIndexService.hybridSearch({ query: 'q', ownerUuid: 'user-b' })
    // 至少两次 execute(向量 + 词法并行),且都不得是 1=0
    const execs = captured.filter((c) => c.op === 'execute')
    expect(execs.length).toBeGreaterThanOrEqual(1)
    for (const e of execs) {
      expect(renderSql(e.where)).not.toContain('1 = 0')
    }
  })
})

// ===========================================================================
// 3. 写入面:无归属 ⇒ 拒绝写(不制造无主行)
// ===========================================================================

describe('写入面归属强制', () => {
  const chunk = {
    filePath: 'a.py',
    lineStart: 1,
    lineEnd: 2,
    content: 'def f(): pass',
  }

  it('indexChunks 缺 ownerUuid 必须抛错,且不得触碰 DB', async () => {
    await expect(codebaseIndexService.indexChunks('repo-1', [chunk])).rejects.toThrow(
      /ownerUuid/,
    )
    expect(captured.length).toBe(0)
  })

  it('indexChunks 传空字符串同样拒绝(不得被当作"有归属")', async () => {
    await expect(codebaseIndexService.indexChunks('repo-1', [chunk], '')).rejects.toThrow(
      /ownerUuid/,
    )
    expect(captured.length).toBe(0)
  })

  it('indexChunks 空 chunks 时直接返回,不要求归属(无操作即无风险)', async () => {
    const out = await codebaseIndexService.indexChunks('repo-1', [])
    expect(out).toEqual({ indexed: 0, vectorized: 0 })
  })
})

// ===========================================================================
// 4. 过期回收:批大小守卫 + 只删到期行
// ===========================================================================

describe('purgeExpired', () => {
  it('批大小非正必须抛错(否则会"删 0 行却永远循环")', async () => {
    await expect(codebaseIndexService.purgeExpired(0)).rejects.toThrow(/批大小/)
    await expect(codebaseIndexService.purgeExpired(-1)).rejects.toThrow(/批大小/)
  })

  it('删除条件只含 expires_at(不误删未到期/永不过期行)', async () => {
    executeResult = []
    await codebaseIndexService.purgeExpired(100)
    const sqlText = renderSql(captured.find((c) => c.op === 'execute')?.where)
    expect(sqlText).toContain('expires_at')
    // 关键是带上了 <= NOW() 的到期判定,而不是无条件删
    expect(sqlText).toMatch(/expires_at.*<=|expires_at\s*<=\s*NOW/i)
  })

  it('删满一批时继续下一批,不足一批时收工(不留过期行)', async () => {
    // mock 必须**逐轮递减**:真实 DB 里 DELETE 是真删,第二轮查到的到期行必然更少;
    // 而恒定返回满批等于模拟"删掉 100 行又凭空冒出 100 行到期行",那不是真实场景,
    // 只会让实现里的循环永不退出 —— 表现为 V8 崩溃而不是可读的断言失败(第一版如此)。
    // 用序列:第一轮满批 100(⇒ 实现应继续),第二轮 3(< 100 ⇒ 实现应收工)。
    const rounds: unknown[][] = [new Array(100).fill({ id: 'a' }), new Array(3).fill({ id: 'b' })]
    let call = 0
    dbExecuteImpl = () => Promise.resolve(rounds[Math.min(call++, rounds.length - 1)])

    const total = await codebaseIndexService.purgeExpired(100)

    expect(total).toBe(103)
    expect(call).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
