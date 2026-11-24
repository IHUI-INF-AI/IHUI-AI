// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D35 第二段·服务端存量回填的离线判据(无 DB)。
 *
 * 本机没有 PostgreSQL 在跑(AGENTS §5b:8810 无监听),所以本文件**不**断言任何真实库状态,
 * 只钉四件结构事实:
 *   A) turn 规则纯函数的取值语义(与第一段 chat-queries 的口径逐字同形);
 *   B) 迁移 SQL 的判据形态(窗口排序键 / FILTER / 下限 / IS NULL 护栏都在位);
 *   C) SQL 语义与纯函数**跨形态对账** —— 用一份按 SQL 规则写的独立模拟器,
 *      而不是调用被测模块(只复读实现的镜像测试等于没有测试,§22c);
 *   D) 记账面(journal ↔ .sql ↔ when 严格递增),并锁"SQL 不在 TS 里再抄一份"。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { turnOrdinalForRole, withTurnOrdinals } from '../src/services/turn-ordinal.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const DRIZZLE_DIR = resolve(HERE, '../../../packages/database/drizzle')
const MIGRATION_FILE = join(DRIZZLE_DIR, '20260926140000_backfill_turn_ordinal.sql')
const JOURNAL_FILE = join(DRIZZLE_DIR, 'meta/_journal.json')

const TAG = '20260926140000_backfill_turn_ordinal'

interface JournalEntry {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints?: boolean
}

function readJournal(): JournalEntry[] {
  const raw = JSON.parse(readFileSync(JOURNAL_FILE, 'utf8')) as { entries?: JournalEntry[] }
  if (!Array.isArray(raw.entries)) {
    throw new Error('journal 结构异常:缺 entries 数组')
  }
  return raw.entries
}

/**
 * 迁移 SQL 那套规则的**独立**实现(刻意不 import 被测模块):
 * 复刻 "PARTITION BY conversation_id ORDER BY created_at, id → 累计 user 数,下限 1",
 * 并且只改写 turn_ordinal IS NULL 的行。
 * 输入是抽象行(id/conversationId/role/createdAt/turnOrdinal),输出为回填后的行,
 * 跑第二次应得到与第一次逐字节相同的结果集(幂等性由本函数直接证明)。
 */
interface BackfillRow {
  id: string
  conversationId: string
  role: string
  createdAt: number
  turnOrdinal: number | null
}

function simulateBackfill(rows: readonly BackfillRow[]): BackfillRow[] {
  // 1) 按 (conversation_id, created_at, id) 排全序 —— id 为主键,故不存在并列
  const sorted = [...rows].sort(
    (a, b) =>
      a.conversationId.localeCompare(b.conversationId) ||
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id),
  )
  // 2) 逐会话累计 user 出现次数(含已带序号的行,否则部分回填的会话会重新从 1 起算)
  const computed = new Map<string, number>()
  let currentConversation: string | null = null
  let userSeen = 0
  for (const row of sorted) {
    if (row.conversationId !== currentConversation) {
      currentConversation = row.conversationId
      userSeen = 0
    }
    if (row.role === 'user') userSeen += 1
    computed.set(row.id, Math.max(1, userSeen))
  }
  // 3) 只改写 turn_ordinal IS NULL 的行(幂等性的全部来源)
  return rows.map((row) =>
    row.turnOrdinal === null ? { ...row, turnOrdinal: computed.get(row.id)! } : row,
  )
}

describe('D35 turn 规则纯函数(services/turn-ordinal)', () => {
  it('turnOrdinalForRole:user 开启新轮 = max+1;其余沿用当前轮 = max(max,1)', () => {
    expect(turnOrdinalForRole(0, 'user')).toBe(1)
    expect(turnOrdinalForRole(4, 'user')).toBe(5)
    expect(turnOrdinalForRole(4, 'assistant')).toBe(4)
    expect(turnOrdinalForRole(4, 'system')).toBe(4)
    // 会话还没有任何轮时,assistant 不得落到 0 或 NULL —— 那正是分片查询看不见的形态
    expect(turnOrdinalForRole(0, 'assistant')).toBe(1)
    expect(turnOrdinalForRole(0, 'system')).toBe(1)
  })

  it('withTurnOrdinals:与第一段 chat-queries.replaceMessages 的重算口径同形', () => {
    const roles = ['user', 'assistant', 'user', 'assistant', 'system', 'assistant']
    expect(withTurnOrdinals(roles.map((role) => ({ role }))).map((r) => r.turnOrdinal)).toEqual([
      1, 1, 2, 2, 2, 2,
    ])
  })

  it('withTurnOrdinals:首条不是 user(纯 assistant/system 会话)整会话归 turn 1', () => {
    const roles = ['assistant', 'system', 'assistant']
    expect(withTurnOrdinals(roles.map((role) => ({ role }))).map((r) => r.turnOrdinal)).toEqual([
      1, 1, 1,
    ])
  })

  it('withTurnOrdinals:保序、等长、原字段不丢', () => {
    const rows = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
    ]
    const out = withTurnOrdinals(rows)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ role: 'user', content: 'a', turnOrdinal: 1 })
    expect(out[1]).toEqual({ role: 'assistant', content: 'b', turnOrdinal: 1 })
  })
})

describe('D35 回填迁移 SQL 的判据形态', () => {
  // 判据面 = **剥掉 `--` 注释后的 SQL 代码面**。头注里必然要写"IS NULL / 只回填
  // turn_ordinal"这些词来说明设计,按原文判等于把注释当成了实现(本仓最高频失效型)。
  const sql = readFileSync(MIGRATION_FILE, 'utf8').replace(/--[^\n]*/g, '')

  it('窗口排序键 = (conversation_id 分区, created_at, id) —— id 必须进排序,否则同刻消息不确定', () => {
    expect(sql).toMatch(/PARTITION BY "conversation_id"/)
    expect(sql).toMatch(/ORDER BY "created_at",\s*"id"/)
  })

  it('序号来自 user 累计计数,并带 1 的下限(等价 Math.max(maxTurn, 1))', () => {
    expect(sql).toMatch(/COUNT\(\*\) FILTER \(WHERE "role" = 'user'\)/)
    expect(sql).toMatch(/GREATEST\(\s*1,/)
    expect(sql).toMatch(/ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW/)
  })

  it('幂等护栏:UPDATE 只写 turn_ordinal IS NULL 的行', () => {
    expect(sql).toMatch(/AND "cm"\."turn_ordinal" IS NULL/)
    // 不得出现无护栏的全表写(那会把第一次运行之后新写入的正确值也覆盖掉)
    const updateStatement = sql.slice(sql.indexOf('UPDATE "chat_messages"'))
    expect(updateStatement).toContain('IS NULL')
  })

  it('计数窗口必须扫全表行,不得把 CTE 预先按 IS NULL 过滤(那会让部分回填的会话重新从 1 起算)', () => {
    const cte = sql.slice(0, sql.indexOf('UPDATE "chat_messages"'))
    expect(cte).not.toMatch(/IS NULL/)
  })

  it('目标列只有 turn_ordinal:不越界伪造 history_projection_state 断点', () => {
    expect(sql).toMatch(/SET\s+"turn_ordinal"/)
    expect(sql).not.toMatch(/history_projection_state/)
  })

  it('SQL 里不得出现 role 判断的 TS 形态(第二份真相由纯函数那侧被锁住)', () => {
    expect(sql).not.toContain('turnOrdinalForRole')
  })
})

describe('D35 SQL ↔ 纯函数跨形态对账', () => {
  // 语料刻意覆盖:无 user / 首条非 user / created_at 并列(靠 id 定序) / 多条 user 交替
  const corpus: Array<{ label: string; rows: BackfillRow[] }> = [
    {
      label: '常规交替',
      rows: [
        { id: 'a', conversationId: 'c1', role: 'user', createdAt: 1, turnOrdinal: null },
        { id: 'b', conversationId: 'c1', role: 'assistant', createdAt: 2, turnOrdinal: null },
        { id: 'c', conversationId: 'c1', role: 'user', createdAt: 3, turnOrdinal: null },
        { id: 'd', conversationId: 'c1', role: 'system', createdAt: 4, turnOrdinal: null },
      ],
    },
    {
      label: '整会话无 user',
      rows: [
        { id: 'a', conversationId: 'c2', role: 'assistant', createdAt: 5, turnOrdinal: null },
        { id: 'b', conversationId: 'c2', role: 'assistant', createdAt: 6, turnOrdinal: null },
      ],
    },
    {
      label: 'created_at 并列(导入会话常见:缺省时间戳整体回退)',
      rows: [
        { id: 'x1', conversationId: 'c3', role: 'user', createdAt: 7, turnOrdinal: null },
        { id: 'x2', conversationId: 'c3', role: 'assistant', createdAt: 7, turnOrdinal: null },
        { id: 'x3', conversationId: 'c3', role: 'user', createdAt: 7, turnOrdinal: null },
      ],
    },
    {
      label: '两会话交错(分区必须按 conversation 独立累计)',
      rows: [
        { id: 'p', conversationId: 'cA', role: 'user', createdAt: 9, turnOrdinal: null },
        { id: 'q', conversationId: 'cB', role: 'user', createdAt: 1, turnOrdinal: null },
        { id: 'r', conversationId: 'cA', role: 'assistant', createdAt: 2, turnOrdinal: null },
        { id: 's', conversationId: 'cB', role: 'assistant', createdAt: 3, turnOrdinal: null },
      ],
    },
    {
      label: '部分行已带序号(回填过的会话之后又长出 NULL 行)',
      rows: [
        { id: 'm', conversationId: 'c4', role: 'user', createdAt: 1, turnOrdinal: 1 },
        { id: 'n', conversationId: 'c4', role: 'assistant', createdAt: 2, turnOrdinal: 1 },
        { id: 'o', conversationId: 'c4', role: 'user', createdAt: 3, turnOrdinal: null },
      ],
    },
  ]

  for (const { label, rows } of corpus) {
    it(`SQL 模拟器与 withTurnOrdinals 在同一语料上得到同一组序号:${label}`, () => {
      const backfilled = simulateBackfill(rows)
      // 按 SQL 的排序键取出顺序,再与纯函数逐位对账
      const inSqlOrder = [...backfilled].sort(
        (a, b) =>
          a.conversationId.localeCompare(b.conversationId) ||
          a.createdAt - b.createdAt ||
          a.id.localeCompare(b.id),
      )
      // 两侧喂同一顺序(逐会话按排序键),因此本条只对比**算序规则**是否同形;
      // 排序键本身是否在 SQL 里在位,由上一组 SQL 文本判据钉住。
      const byConv = new Map<string, BackfillRow[]>()
      for (const row of inSqlOrder) {
        const list = byConv.get(row.conversationId) ?? []
        list.push(row)
        byConv.set(row.conversationId, list)
      }
      for (const [conversationId, list] of byConv) {
        const fromTs = withTurnOrdinals(list.map((r) => ({ role: r.role }))).map(
          (r) => r.turnOrdinal,
        )
        expect(
          list.map((r) => r.turnOrdinal),
          `会话 ${conversationId} 的 SQL 结果与 TS 结果不一致`,
        ).toEqual(fromTs)
      }
    })
  }

  it('幂等:同一输入连跑两次,第二次不再改写任何行(已正确的行一字节不动)', () => {
    const rows = corpus[0]!.rows
    const once = simulateBackfill(rows)
    const twice = simulateBackfill(once)
    expect(twice).toEqual(once)
    // 反向对照:第一次确实改写过(否则上面那条等式是恒真)
    expect(once.map((r) => r.turnOrdinal)).not.toEqual(rows.map((r) => r.turnOrdinal))
    expect(rows.every((r) => r.turnOrdinal === null)).toBe(true)
  })

  it('已带序号的行不得被重算覆盖(否则回放会推翻新写入路径的结果)', () => {
    const partial = corpus[4]!.rows
    const out = simulateBackfill(partial)
    expect(out.find((r) => r.id === 'm')?.turnOrdinal).toBe(1)
    expect(out.find((r) => r.id === 'n')?.turnOrdinal).toBe(1)
    // 唯一那条 NULL 行按累计 user 数补成 2
    expect(out.find((r) => r.id === 'o')?.turnOrdinal).toBe(2)
  })
})

describe('D35 迁移记账(journal ↔ sql)', () => {
  const entries = readJournal()

  it(`journal 里确有本次条目 tag=${TAG},且其 .sql 文件在位`, () => {
    const hit = entries.filter((e) => e.tag === TAG)
    expect(hit).toHaveLength(1)
    const body = readFileSync(join(DRIZZLE_DIR, `${TAG}.sql`), 'utf8')
    // 文件名时间戳必须与 tag 前缀同值(drizzle 按 tag↔basename 配对执行)
    expect(body).toContain('20260926140000')
    expect(body).toContain('turn_ordinal')
  })

  it('本次条目 idx = 前一条 +1(按当次 HEAD 实测取号,不照抄文档数字)', () => {
    const mine = entries.find((e) => e.tag === TAG)!
    const earlier = entries.filter((e) => e.idx < mine.idx)
    const prev = earlier.reduce((a, b) => (a.idx >= b.idx ? a : b))
    expect(mine.idx).toBe(prev.idx + 1)
    expect(mine.when).toBeGreaterThan(prev.when)
  })

  it('idx 唯一 / when 严格递增唯一 / tag↔sql 双向双射(守门 49 的 B1–B4 在本票范围内自证)', () => {
    const idxs = entries.map((e) => e.idx)
    expect(new Set(idxs).size).toBe(idxs.length)
    const whens = entries.map((e) => e.when)
    expect(new Set(whens).size).toBe(whens.length)
    const tags = entries.map((e) => e.tag)
    expect(new Set(tags).size).toBe(tags.length)

    const listed = readdirSync(DRIZZLE_DIR)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.replace(/\.sql$/, ''))
      .sort()
    expect([...tags].sort()).toEqual(listed)
    expect(listed.length).toBeGreaterThan(0)
  })

  it('TS 侧不得再抄一份回填 SQL(单一真相源 = 迁移文件)', () => {
    const helper = readFileSync(resolve(HERE, '../src/services/turn-ordinal.ts'), 'utf8')
    expect(helper).not.toMatch(/UPDATE\s+"?chat_messages"?/)
    expect(helper).not.toMatch(/FILTER\s*\(/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
