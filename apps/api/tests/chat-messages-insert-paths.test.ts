// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D35 第二段(2026-09-26):chat_messages 写入路径必须产出 turn_ordinal —— 静态对账。
 *
 * 立因:第一段把 turn 规则只写进了 `db/chat-queries.ts`,而两处**绕过 service 的直插**
 * (patrol-scheduler 告警注入、conversation-import 落库)写出的行 turn_ordinal 为 NULL,
 * 新分片端点对 NULL 行不可见 —— 全程不报错,只有链路静默缺一块。
 * 本文件把"再加一处直插忘了补"变成机器判据,并顺带证明本票那两个站点确实被扫到。
 *
 * 为什么是静态判据:本机无 PostgreSQL 在跑(AGENTS §5b:8810 无监听),
 * 任何"真实库状态"断言在这里都不可执行(§5 测试隔离铁律),所以判**源码形态**。
 *
 * 已知边界(如实登记,不是"已全覆盖"):
 * - 扫描面 = `apps/api/src/**`(.ts,排除 `__tests__`/`tests`)。
 *   `packages/database/seed/**` 是测试种子数据,不属生产写入路径;
 *   ai-service(Python)侧经实测**不**直插 chat_messages(只通过回调让 api 侧写 metadata)。
 * - 判据是"该 insert 的 values 块里出现 turnOrdinal 标识",不能判"值算得对不对"
 *   —— 后者由 turn-ordinal-backfill.test.ts 的纯函数/SQL 对账负责。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const API_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const INSERT_RE = /\.insert\(\s*chatMessages\s*\)/g
const SKIP_DIR_NAMES = new Set(['__tests__', 'tests'])

/** 一个 insert 站点:相对路径 + 行号 + 其 values(...) 配平块文本 */
interface InsertSite {
  file: string
  line: number
  valuesBlock: string
}

/** 已知未收口的直插站点(清单腐烂 = 判红:修好了就得从这里删掉) */
interface KnownUnboundSite {
  file: string
  reason: string
  unblock: string
}

/**
 * 现值为空 = 服务端所有 chat_messages 直插均已产出 turn_ordinal,任何新增未登记
 * 站点会被"违规站点必须逐条落在已知清单内"当场判红。
 * 历史上唯一一条(routes/message.ts 的 POST /messages/send 直插)已于
 * 2026-09-26 第三段补齐(turnOrdinalForRole(max,'user'))并按规矩从此删除。
 * 结构(KnownUnboundSite / 两条对照判据)刻意保留 —— 它是"带理由暂挂"的唯一通道,
 * 删掉它等于把将来的合法豁免通道也摘线。
 */
const KNOWN_UNBOUND: readonly KnownUnboundSite[] = []

function listTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (SKIP_DIR_NAMES.has(name)) continue
      out.push(...listTsFiles(full))
    } else if (name.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

/**
 * 从命中处取出紧随其后的 `.values( … )` 配平块(原样返回,不加工 —— 变异对照要能
 * 拿它回查原文,剥过注释就对不上文件内容了)。
 * 找不到 `.values` 时返回空串 —— 那本身就是违规(insert 必须有 values)。
 */
function extractValuesBlock(text: string, matchEnd: number): string {
  const valuesIdx = text.indexOf('.values', matchEnd)
  if (valuesIdx === -1 || valuesIdx - matchEnd > 200) return ''
  const open = text.indexOf('(', valuesIdx)
  if (open === -1) return ''
  let depth = 0
  let i = open
  for (; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth += 1
    else if (ch === ')') {
      depth -= 1
      if (depth === 0) break
    }
  }
  return text.slice(open, i + 1)
}

/**
 * 判该 values 块有没有真的产出 turn 序号 —— 判据面是**剥掉行注释后的代码面**,
 * 否则一句 `// D35:补 turnOrdinal` 就能冒充"已接线"(本仓最高频失效型:注释里的提及
 * 被读成实现)。
 */
function declaresTurnOrdinal(valuesBlock: string): boolean {
  return /\bturnOrdinal\b/.test(valuesBlock.replace(/\/\/[^\n]*/g, ''))
}

/** 对一段源码文本扫出全部 chat_messages insert 站点(测试可用它做变异对照)。 */
function scanInsertSites(text: string): Array<{ line: number; valuesBlock: string }> {
  const hits: Array<{ line: number; valuesBlock: string }> = []
  for (const match of text.matchAll(INSERT_RE)) {
    const start = match.index ?? 0
    hits.push({
      line: text.slice(0, start).split('\n').length,
      valuesBlock: extractValuesBlock(text, start + match[0].length),
    })
  }
  return hits
}

function collectSites(root: string): InsertSite[] {
  const sites: InsertSite[] = []
  for (const file of listTsFiles(root)) {
    const text = readFileSync(file, 'utf8')
    if (!text.includes('chatMessages')) continue
    for (const hit of scanInsertSites(text)) {
      sites.push({ file: relative(root, file).replace(/\\/g, '/'), ...hit })
    }
  }
  return sites
}

function violationsOf(sites: readonly InsertSite[]): InsertSite[] {
  return sites.filter((s) => !declaresTurnOrdinal(s.valuesBlock))
}

describe('D35:所有写入 chat_messages 的生产路径必须产出 turn_ordinal', () => {
  const sites = collectSites(API_SRC)

  it('扫描面非空(空扫 = 判据失效,不得当作通过)', () => {
    expect(sites.length).toBeGreaterThanOrEqual(6)
    expect(sites.filter((s) => s.valuesBlock === '')).toHaveLength(0)
  })

  it('本票修掉的两处直插确实被扫到,且 values 块里带 turnOrdinal', () => {
    const patrol = sites.filter((s) => s.file.endsWith('services/patrol-scheduler.ts'))
    const imported = sites.filter((s) => s.file.endsWith('routes/conversation-import.ts'))
    expect(patrol).toHaveLength(1)
    expect(imported).toHaveLength(1)
    expect(violationsOf([...patrol, ...imported])).toHaveLength(0)
  })

  it('第一段的 chat-queries 三个写入点仍带 turnOrdinal(不得被后续改动摘掉)', () => {
    const queries = sites.filter((s) => s.file.endsWith('db/chat-queries.ts'))
    expect(queries.length).toBeGreaterThanOrEqual(3)
    expect(violationsOf(queries)).toHaveLength(0)
  })

  it('违规站点必须逐条落在已知清单内(新增绕过直插即红)', () => {
    const violations = violationsOf(sites)
    const allowed = new Set(KNOWN_UNBOUND.map((k) => k.file))
    const unexpected = violations.filter((v) => !allowed.has(v.file))
    expect(
      unexpected.map((v) => `${v.file}:${v.line}`),
      '出现未登记的 chat_messages 直插站点(不带 turnOrdinal):见上方列表',
    ).toHaveLength(0)
  })

  it('已知清单不得腐烂:每条都必须仍然违规(修好了就从清单删除)', () => {
    const violationFiles = new Set(violationsOf(sites).map((v) => v.file))
    for (const known of KNOWN_UNBOUND) {
      expect(
        violationFiles.has(known.file),
        `${known.file} 已不再违规,请把这条 KNOWN_UNBOUND 删掉(原因:${known.reason})`,
      ).toBe(true)
    }
  })

  it('注释里的字样不得冒充实现:块里只剩一行 `// turnOrdinal` 时必须判违规', () => {
    expect(declaresTurnOrdinal('({ conversationId, role: 1, // turnOrdinal 待补\n})')).toBe(false)
    expect(declaresTurnOrdinal('({ conversationId, turnOrdinal: 1 })')).toBe(true)
  })

  it('判据有牙:把已修站点的 turnOrdinal 从 values 块删掉必须被识别为违规', () => {
    for (const file of ['services/patrol-scheduler.ts', 'routes/conversation-import.ts']) {
      const text = readFileSync(join(API_SRC, file), 'utf8')
      const site = scanInsertSites(text)[0]
      expect(site, `${file} 应至少有一个 insert 站点`).toBeTruthy()
      const mutated = text.replace(
        site!.valuesBlock,
        // 全量替换:块里常同时有 `turnOrdinal:` 与 `m.turnOrdinal` /
        // `turnOrdinalForRole(...)` 两种出现,只改第一处会留下仍然命中的标识符,
        // 变异对照就退化成恒真。
        site!.valuesBlock.replaceAll('turnOrdinal', '_turnOrdinalRemoved'),
      )
      const found = scanInsertSites(mutated)
      expect(found).toHaveLength(1)
      expect(declaresTurnOrdinal(found[0]!.valuesBlock)).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
