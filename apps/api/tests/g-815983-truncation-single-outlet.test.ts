// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-815983 回归:`truncated` 语义在「恰好等于 limit」处不得缺席,且同一论证只许写一遍。
//
// 病灶(票面):多层各自 clamp,探测行 `limit+1` 被中间层截掉 ⇒ 账面在恰满处报
// 「没有更多了」而其实还有,分页永不收敛。本轮可证站点 =
// apps/api/src/services/agent-runtime/session-store.ts 的会话列表出口 ——
// 它此前 `.limit(filter?.limit ?? 200)` 无名 clamp 后直接 `rows.map(toSession)`,
// 整个文件 `truncated` 命中 0 次(开工前现读:`git grep -c -F truncated HEAD -- <该文件>` = 0)。
//
// 修法(按票面上游形状,抄判据不抄实现):
//  - 取数多取 1 条探测行(`appliedLimit + PAGE_PROBE_ROWS`),判定后才剥掉;
//  - 「是否还有下一条」的论证收成唯一出口 resolveTruncation,两条既有规则
//    ('probed' 精确 / 'page-full' 保守)同住一处,由调用方显式声明按哪条判;
//  - 截断位与计数兄弟键(appliedLimit / fetchedCount)同块产出 —— `truncated` 不得裸奔
//    (守门 check-truncation-accounting 的 DTO 面判据)。
//
// 判据有牙:用例①②③是成对边界(恰满必真 / 少于 limit 不误报),⑭⑮ 是源码级锁
// (session-store.ts 内出现第二份手写边界比较、或取数写回无名 clamp ⇒ 当场红),
// ⑯⑰ 是跨面棘轮与唯一出口锁(产品面新增手写站点 ⇒ 红;第二份 resolveTruncation ⇒ 红)。
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(API_ROOT, '..', '..')

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

vi.mock('../src/db/index.js', () => ({
  db: mockDb,
  dbRead: mockDb,
}))

import {
  DEFAULT_SESSION_LIST_LIMIT,
  PAGE_PROBE_ROWS,
  listPersistedSessionPage,
  listPersistedSessions,
  resetSessionStoreDbState,
  resolveTruncation,
} from '../src/services/agent-runtime/session-store.js'

/** 造 n 行 agent_runtime_sessions 的形状(toSession 需要 Date 型时间戳)。 */
function fakeRows(n: number): Array<Record<string, unknown>> {
  return Array.from({ length: n }, (_, i) => ({
    id: `sess_g815983_${i}`,
    botId: 'default',
    userId: 'user_1',
    status: 'active',
    messages: [],
    metadata: {},
    createdAt: new Date(1_700_000_000_000 + i),
    updatedAt: new Date(1_700_000_000_000 + i),
  }))
}

/** select 链:捕获 orderBy 后 .limit() 收到的实参,并按 rows 兑现。 */
function selectChain(rows: Array<Record<string, unknown>>, opts?: { fail?: boolean }) {
  const captured: { limitArg?: unknown } = {}
  const step: Record<string, unknown> = {}
  for (const m of ['from', 'where', 'orderBy']) step[m] = vi.fn(() => step)
  step.limit = vi.fn((arg?: unknown) => {
    captured.limitArg = arg
    if (opts?.fail) return Promise.reject(new Error('boom'))
    return Promise.resolve(rows)
  })
  return { step, captured }
}

describe('G-815983 ①:resolveTruncation 的 limit 边界(唯一出口本体)', () => {
  it("① 'probed' 规则:取回 limit+1 条(恰满 limit 且探测行在位)⇒ truncated 必为 true", () => {
    const v = resolveTruncation(fakeRows(21), 20, 'probed')
    expect(v.truncated).toBe(true)
    // 探测行必须被剥掉:交付给调用方的恰好是 limit 条
    expect(v.items).toHaveLength(20)
    expect(v.appliedLimit).toBe(20)
    expect(v.fetchedCount).toBe(21)
  })

  it("② 'probed' 规则:库里只剩 limit 条(无第 limit+1 条)⇒ 不误报 truncated", () => {
    const v = resolveTruncation(fakeRows(20), 20, 'probed')
    expect(v.truncated).toBe(false)
    expect(v.items).toHaveLength(20)
    expect(v.fetchedCount).toBe(20)
  })

  it("③ 'probed' 规则:少于 limit 条 ⇒ truncated false(既不缺席也不虚报)", () => {
    const v = resolveTruncation(fakeRows(19), 20, 'probed')
    expect(v.truncated).toBe(false)
    expect(v.items).toHaveLength(19)
  })

  it("④ 'page-full' 规则:没取探测行而恰好取满 ⇒ 必须报 true(票面点名那一型)", () => {
    const v = resolveTruncation(fakeRows(20), 20, 'page-full')
    expect(v.truncated).toBe(true)
    expect(v.items).toHaveLength(20)
  })

  it("⑤ 'page-full' 规则:未取满 ⇒ false", () => {
    expect(resolveTruncation(fakeRows(19), 20, 'page-full').truncated).toBe(false)
  })

  it('⑥ limit=0 的退化形态:仍按探测行判,items 恒为空', () => {
    const v = resolveTruncation(fakeRows(1), 0, 'probed')
    expect(v.items).toHaveLength(0)
    expect(v.truncated).toBe(true)
  })

  it('⑦ 变异对照(证明判据有牙,不是恒真断言)', () => {
    // 把 'page-full' 写成 `>` 会给出错误结论 ⇒ 用例④不是空跑:
    const wrongImpl = (rows: unknown[], limit: number): boolean => rows.length > limit
    expect(wrongImpl(fakeRows(20), 20)).toBe(false)
    expect(resolveTruncation(fakeRows(20), 20, 'page-full').truncated).toBe(true)
  })
})

describe('G-815983 ②:listPersistedSessionPage 装车(取数必须带探测行)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSessionStoreDbState()
  })

  it('⑧ 缺省上限的取数实参是 appliedLimit + PAGE_PROBE_ROWS,不是无名 clamp', async () => {
    const chain = selectChain(fakeRows(2))
    mockDb.select.mockReturnValue(chain.step)
    await listPersistedSessionPage()
    expect(chain.captured.limitArg).toBe(DEFAULT_SESSION_LIST_LIMIT + PAGE_PROBE_ROWS)
  })

  it('⑨ 显式 limit=5 ⇒ 取 6 行、交 5 行,truncated 如实', async () => {
    const chain = selectChain(fakeRows(6))
    mockDb.select.mockReturnValue(chain.step)
    const page = await listPersistedSessionPage({ limit: 5 })
    expect(chain.captured.limitArg).toBe(6)
    expect(page.sessions).toHaveLength(5)
    expect(page.truncated).toBe(true)
    expect(page.appliedLimit).toBe(5)
    expect(page.fetchedCount).toBe(6)
  })

  it('⑩ 恰好取到 limit 行(无探测行)⇒ truncated=false 且交付 limit 行(精确到底)', async () => {
    const chain = selectChain(fakeRows(DEFAULT_SESSION_LIST_LIMIT))
    mockDb.select.mockReturnValue(chain.step)
    const page = await listPersistedSessionPage()
    expect(page.truncated).toBe(false)
    expect(page.sessions).toHaveLength(DEFAULT_SESSION_LIST_LIMIT)
    expect(page.fetchedCount).toBe(DEFAULT_SESSION_LIST_LIMIT)
  })

  it('⑪ 读失败 ⇒ fetchedCount 落 null(判不了)而不是 0(判过且为空);第二跳走库不可用分支同样 null', async () => {
    const failing = selectChain([], { fail: true })
    mockDb.select.mockReturnValue(failing.step)
    const page = await listPersistedSessionPage({ limit: 10 })
    expect(page.fetchedCount).toBeNull()
    expect(page.truncated).toBe(false)
    expect(page.sessions).toHaveLength(0)
    expect(page.appliedLimit).toBe(10)

    // 失败已置 dbDisabled ⇒ 这一跳取不到库(同一个三态出口,不得被写成"没有更多")
    const second = await listPersistedSessionPage({ limit: 10 })
    expect(second.fetchedCount).toBeNull()
    expect(second.sessions).toEqual([])
  })

  it('⑫ 向后兼容:listPersistedSessions 仍是 page 出口的投影,只交 sessions', async () => {
    const chain = selectChain(fakeRows(3))
    mockDb.select.mockReturnValue(chain.step)
    const list = await listPersistedSessions({ limit: 2 })
    expect(Array.isArray(list)).toBe(true)
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ id: 'sess_g815983_0', status: 'active' })
    expect(chain.captured.limitArg).toBe(3)
  })

  it('⑬ 非法 limit(NaN / 负数)归到具名默认上限,不产出 LIMIT -1 这种库里必炸的形状', async () => {
    const chain = selectChain(fakeRows(1))
    mockDb.select.mockReturnValue(chain.step)
    const page = await listPersistedSessionPage({ limit: -5 })
    expect(page.appliedLimit).toBe(DEFAULT_SESSION_LIST_LIMIT)
    expect(chain.captured.limitArg).toBe(DEFAULT_SESSION_LIST_LIMIT + PAGE_PROBE_ROWS)
  })
})


// ── ③ 源码级锁 ─────────────────────────────────────────────────────────────
// 这把尺子的口径(2026-10-11 现读校准,全源面命中 8 处 / 5 文件):
//   「手写截断判据」= 一行里出现 `.length` 与**上限型标识符**比大小,且这一判据的结果
//   喂给 hasMore / has_more / truncated / more 一族(语句窗 = 上一行 + 本行,覆盖
//   `const hasMore =` 换行再比较的书写形态)。
// 排除面如实登记:测试面/夹具不计(违例形态是夹具要故意写的),`.d.ts` 与 dist 不计(非源面)。
// 校准当日读数:唯一出口 session-store.ts + 4 处存量(见 LEDGER)。

const STORE_REL = 'apps/api/src/services/agent-runtime/session-store.ts'
const BOUNDARY_RE = /\.length\s*(?:>=|>|===|<)\s*([A-Za-z_$][\w$]*)/
const LIMITISH_RE = /limit|pagesize|perpage/i
const SIGNAL_RE = /\b(?:hasMore|has_more|truncated|more)\s*(?::|=|\s*$)/

function stripComment(line: string): string {
  return line.replace(/\/\/.*$/, '')
}

/** 台账键用正斜杠(Windows 上 relative() 给反斜杠,与 LEDGER 里的路径形态不同形 ⇒ 集合永不相交)。 */
function toPosix(p: string): string {
  return p.split(sep).join('/')
}

function boundaryLines(src: string): number[] {
  const lines = src.split('\n').map(stripComment)
  const hits: number[] = []
  lines.forEach((line, i) => {
    const m = BOUNDARY_RE.exec(line)
    if (!m || !LIMITISH_RE.test(m[1] ?? '')) return
    const stmt = `${lines[i - 1] ?? ''} ${line}`
    if (SIGNAL_RE.test(stmt)) hits.push(i + 1)
  })
  return hits
}

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc // 目录不在本机 ⇒ 不扫(调用方负责为"扫到 0"报未判定)
  }
  for (const e of entries) {
    if (['node_modules', 'dist', 'build'].includes(e.name) || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) listSourceFiles(p, acc)
    else if (/\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) acc.push(p)
  }
  return acc
}

/** `export function resolveTruncation` 的函数体行区间(含首尾;括号计数,不看缩进)。 */
function outletLineRange(src: string): { start: number; end: number } {
  const lines = src.split('\n')
  const declIdx = lines.findIndex((l) => /^export function resolveTruncation\b/.test(stripComment(l)))
  if (declIdx < 0) throw new Error('resolveTruncation 声明不在面上')
  let depth = 0
  let started = false
  for (let i = declIdx; i < lines.length; i++) {
    const body = stripComment(lines[i] ?? '')
    for (const ch of body) {
      if (ch === '{') {
        depth++
        started = true
      } else if (ch === '}') depth--
    }
    if (started && depth === 0) return { start: declIdx + 1, end: i + 1 }
  }
  throw new Error('resolveTruncation 函数体括号配不平')
}

describe('G-815983 ③:唯一出口的源码级锁(第二份手写形态出现即红)', () => {
  const storeSrc = readFileSync(join(REPO_ROOT, STORE_REL), 'utf8')

  it('⑭ session-store.ts 内的手写边界比较只许住在 resolveTruncation 体内', () => {
    const hits = boundaryLines(storeSrc)
    expect(hits.length, '出口本体未被扫到 ⇒ 这把锁对着空面自证').toBeGreaterThan(0)
    const range = outletLineRange(storeSrc)
    const outside = hits.filter((n) => n < range.start || n > range.end)
    expect(outside, `出口外出现第二份手写边界比较:${outside.join(', ')}`).toEqual([])
  })

  it('⑮ 会话列表取数必须写成 appliedLimit + PAGE_PROBE_ROWS,不得退回无名 clamp', () => {
    const code = storeSrc.replace(/\/\/.*$/gm, '')
    expect(code).toMatch(/\.limit\(\s*appliedLimit\s*\+\s*PAGE_PROBE_ROWS\s*\)/)
    // 改回 `.limit(filter?.limit ?? 200)` 或任何 `.limit(<字面量>)` 的无名天花板 ⇒ 红
    expect(code).not.toMatch(/\.limit\(\s*filter\?\.limit\s*\?\?\s*\d+\s*\)/)
    expect(code).not.toMatch(/\.limit\(\s*\d{2,}\s*\)/)
  })

  it('⑯ 跨面棘轮:源面新增手写截断判据即红(存量 4 处按站点登记归属,只报数不代裁)', () => {
    // 存量(2026-10-11 现读;各自判据本身正确 —— 'probed' 精确 / 'page-full' 保守 ——
    // 收进唯一出口要动别的路会话正持有的文件,按 §12 归属纪律本轮只登记)。
    const LEDGER = new Set([
      'apps/api/src/db/chat-queries.ts',
      'apps/api/src/routes/message.ts',
      'apps/api/src/routes/task-messages.ts',
      'apps/api/src/utils/cursor-page.ts',
    ])
    const roots = [resolve(API_ROOT, 'src'), resolve(REPO_ROOT, 'packages')]
    const files: string[] = []
    for (const r of roots) listSourceFiles(r, files)
    expect(files.length, '源面枚举到 0 个文件 ⇒ 判据失明,不得记为通过').toBeGreaterThan(0)

    const found = new Set<string>()
    for (const f of files) {
      if (boundaryLines(readFileSync(f, 'utf8')).length > 0) {
        found.add(toPosix(relative(REPO_ROOT, f)))
      }
    }
    // 出口自身必须在扫描结果里(否则"没有新增"只是因为尺子没看见任何东西)
    expect(found.has(STORE_REL), `唯一出口未被扫到 ⇒ ⑯ 空转(面上文件数 ${files.length})`).toBe(true)
    const unexpected = [...found].filter((f) => f !== STORE_REL && !LEDGER.has(f))
    expect(unexpected, `新增手写截断判据:${unexpected.join(', ')}`).toEqual([])
  })

  it('⑰ resolveTruncation 的导出声明全仓只许有一份(第二份出口 = 第二个真相)', () => {
    const files: string[] = []
    for (const r of [resolve(API_ROOT, 'src'), resolve(REPO_ROOT, 'packages')]) listSourceFiles(r, files)
    const decls: string[] = []
    for (const f of files) {
      if (/^export function resolveTruncation\b/m.test(readFileSync(f, 'utf8'))) {
        decls.push(toPosix(relative(REPO_ROOT, f)))
      }
    }
    expect(decls, `出现第二份出口:${decls.join(', ')}`).toEqual([STORE_REL])
  })

  it('⑱ 这把锁有牙:构造一段"第二份手写形态"的源码,尺子必须点名它', () => {
    const clone = `${storeSrc}\nexport function badSecondCopy(rows: unknown[], limit: number): boolean {\n  const hasMore = rows.length > limit\n  return hasMore\n}\n`
    const range = outletLineRange(storeSrc)
    const hits = boundaryLines(clone).filter((n) => n < range.start || n > range.end)
    expect(hits.length, '把第二份手写形态喂进尺子却读不出来 ⇒ 锁无牙').toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
