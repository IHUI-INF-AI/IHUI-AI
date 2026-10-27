// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话导出腿测试(⑦只读导出)。fixture 全注入临时目录,绝不碰真实会话库,断言:
 * - 默认 dry-run 零写入;--apply 产出 <id>.json + <id>.html 两份且内容正确;
 * - HTML 转义:消息正文里的 <script>alert(1)</script> 与 &<>" 必须被转义;
 * - 零内容回显:stdout/stderr 全量捕获,绝不出现正文埋雷;
 * - --account 唯一前缀命中、不唯一拒绝;台账缺失/会话不存在 → exit 2;
 * - 源库只读:导出前后 sessions/ 与 projects/ 逐文件 sha256 不变;
 * - 坏行容错:转写夹一行非 JSON 不崩,跳过并计数。
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { applyLedger, planAssign, type SessionLinksLedger } from '../scripts/relay-session-links.js'
import {
  applyExport,
  buildExportPlan,
  escapeHtml,
  exportDirStamp,
  main,
  parseTranscript,
  type ExportPaths,
} from '../scripts/relay-session-export.js'

const CONV = 'c1111111-2222-4333-8444-555566667777'
const CONV_TITLED = 'c9999999-8888-4777-8666-555544443333'
/** 台账有归属但无逐会话转写(实测真账形态:某账号 11 个会话只有 9 份转写) */
const CONV_MISSING = 'c2222222-3333-4444-8555-666677778888'
const ACCT_A = 'acct-alpha-1111'
const ACCT_B = 'acct-alphabet-2222'
const SECRET = 'TOPSECRET-CONVERSATION-BODY-export-7c1d'
const MS_TS = 1_761_530_000_000
const INJECT = '<script>alert(1)</script> &<>"'
const BAD_LINE = 'not-a-json-line-{broken'

const sha256Of = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex')

interface Fixture {
  root: string
  paths: ExportPaths
}

function transcriptOf(rows: unknown[]): string {
  return rows.map((r) => JSON.stringify(r)).join('\n')
}

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'wb-export-test-'))
  const paths: ExportPaths = {
    sessionsRoot: join(root, 'sessions'),
    projectsRoot: join(root, 'projects'),
    ledgerFile: join(root, 'relay', 'session_links.json'),
    exportsRoot: join(root, 'exports'),
  }
  mkdirSync(join(paths.sessionsRoot, CONV), { recursive: true })
  writeFileSync(join(paths.sessionsRoot, CONV, 'snapfile'), '{"v":1}')
  mkdirSync(join(paths.sessionsRoot, CONV_TITLED), { recursive: true })
  writeFileSync(join(paths.sessionsRoot, CONV_TITLED, 'snapfile'), '{"v":1}')
  const ws = join(paths.projectsRoot, 'ws-a')
  mkdirSync(ws, { recursive: true })
  // CONV:无标题 + 注入串 + 分片正文 + 一条坏行(坏行夹在中间,验证跳过不崩)
  writeFileSync(
    join(ws, `${CONV}.jsonl`),
    [
      transcriptOf([
        { type: 'meta', sessionId: CONV, timestamp: '2026-10-27T01:00:00.000Z' },
        {
          type: 'message',
          role: 'user',
          content: `问一句 ${INJECT}`,
          timestamp: '2026-10-27T01:00:05.000Z',
        },
        {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: `答一句 ${SECRET}` },
            { type: 'text', text: '第二段' },
          ],
          timestamp: MS_TS,
        },
      ]),
      BAD_LINE,
      transcriptOf([
        {
          type: 'message',
          role: 'user',
          content: '再来一条',
          timestamp: '2026-10-27T01:02:00.000Z',
        },
      ]),
      '',
    ].join('\n'),
  )
  // CONV_TITLED:标题住 type=ai-title 行的 aiTitle(本机实测形状)
  writeFileSync(
    join(ws, `${CONV_TITLED}.jsonl`),
    `${transcriptOf([
      { type: 'ai-title', aiTitle: '迁移演练标题', sessionId: CONV_TITLED, timestamp: MS_TS },
      {
        type: 'message',
        role: 'user',
        content: 'hi',
        timestamp: '2026-10-27T02:00:00.000Z',
      },
    ])}\n`,
  )
  // 台账:A 名下 CONV、B 名下 CONV_TITLED;两者共享 acct-alpha 前缀(用于唯一/不唯一判定)
  let ledger: SessionLinksLedger = {
    version: 1,
    accounts: [
      { accountId: ACCT_A, label: 'A', since: '2026-10-01T00:00:00.000Z' },
      { accountId: ACCT_B, label: 'B', since: '2026-10-01T00:00:00.000Z' },
    ],
    links: {},
  }
  ledger = planAssign(ledger, CONV, ACCT_A).next
  ledger = planAssign(ledger, CONV_TITLED, ACCT_B).next
  ledger = planAssign(ledger, CONV_MISSING, ACCT_A).next
  applyLedger(paths.ledgerFile, ledger)
  return { root, paths }
}

const cleanup: string[] = []
afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** 全量捕获两条输出,用于"零内容回显"判据 */
function captureOutput(): { text: () => string } {
  const lines: string[] = []
  const push = (...args: unknown[]): void => {
    lines.push(args.map((a) => String(a)).join(' '))
  }
  vi.spyOn(console, 'log').mockImplementation(push)
  vi.spyOn(console, 'error').mockImplementation(push)
  return { text: () => lines.join('\n') }
}

function snapshotTree(root: string): Map<string, string> {
  const out = new Map<string, string>()
  if (!existsSync(root)) return out
  const walk = (dir: string, base: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      const rel = base ? `${base}/${name}` : name
      if (statSync(p).isDirectory()) walk(p, rel)
      else out.set(rel, sha256Of(readFileSync(p)))
    }
  }
  walk(root, '')
  return out
}

describe('parseTranscript(容错与投影)', () => {
  it('坏行计数跳过;标题取首个非空(含 aiTitle);数字时刻归一为 ISO;分片正文拼接', () => {
    const raw = [
      JSON.stringify({ type: 'meta', sessionId: CONV, timestamp: '2026-10-27T01:00:00.000Z' }),
      BAD_LINE,
      JSON.stringify({ type: 'message', role: 'user', content: INJECT, timestamp: MS_TS }),
      JSON.stringify({ title: '官方字段标题', type: 'message', role: 'assistant', content: 'x' }),
      JSON.stringify({ type: 'ai-title', aiTitle: '不该被采用' }),
      JSON.stringify({
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: SECRET },
          { type: 'text', text: '第二段' },
        ],
        timestamp: '2026-10-27T01:02:00.000Z',
      }),
      '',
    ].join('\n')
    const parsed = parseTranscript(raw)
    expect(parsed.badLines).toBe(1)
    expect(parsed.totalLines).toBe(6)
    expect(parsed.title).toBe('官方字段标题')
    expect(parsed.messages).toHaveLength(3)
    expect(parsed.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'assistant'])
    expect(parsed.messages[0]!.content).toBe(INJECT)
    expect(parsed.messages[0]!.textContent).toBe(INJECT)
    expect(parsed.messages[0]!.timestamp).toBe(new Date(MS_TS).toISOString())
    expect(parsed.messages[2]!.content).toBe(`${SECRET}\n第二段`)
    expect(parsed.messages[2]!.timestamp).toBe('2026-10-27T01:02:00.000Z')
    expect(parsed.messages[1]!.timestamp).toBeNull()
  })

  it('无标题时 title 为空串(不编造),空行不计入坏行', () => {
    const parsed = parseTranscript('\n\n{"type":"meta"}\n\n')
    expect(parsed.title).toBe('')
    expect(parsed.badLines).toBe(0)
    expect(parsed.totalLines).toBe(1)
    expect(parsed.messages).toEqual([])
  })
})

describe('escapeHtml / exportDirStamp', () => {
  it('五个危险字符全部转义', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    )
  })

  it('默认目录戳是 UTC 紧凑形态', () => {
    expect(exportDirStamp(new Date('2026-10-27T02:15:30.123Z'))).toBe('20261027T021530Z')
  })
})

describe('main · dry-run', () => {
  it('只列会话数与文件数,零写入,零内容回显', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const out = join(fx.root, 'out-dry')
    const cap = captureOutput()
    expect(main(['--conversation', CONV, '--out', out], fx.paths)).toBe(0)
    const text = cap.text()
    expect(text).toContain('dry-run')
    expect(text).toContain(CONV)
    expect(text).toContain('2 个文件')
    expect(text).not.toContain(SECRET)
    expect(text).not.toContain('问一句')
    expect(text).not.toContain('alert(1)')
    // 零写入:输出目录压根没建
    expect(existsSync(out)).toBe(false)
  })

  it('缺省落点在 ~/.wb-switch/exports/<UTC 戳>/ 形态(dry-run 不建目录)', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const cap = captureOutput()
    expect(main(['--conversation', CONV], fx.paths)).toBe(0)
    expect(cap.text()).toContain('exports')
    expect(existsSync(fx.paths.exportsRoot)).toBe(false)
  })

  it('无参数打用法 exit 0;给了参数却无 --conversation/--account 则 exit 2', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    captureOutput()
    expect(main([], fx.paths)).toBe(0)
    expect(main(['--apply'], fx.paths)).toBe(2)
    expect(main(['--conversation', CONV, '--account', ACCT_A], fx.paths)).toBe(2)
  })
})

describe('main · --apply', () => {
  it('产出 json+html 两份:消息条数/角色/时间戳与转写一致', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const out = join(fx.root, 'out-apply')
    const cap = captureOutput()
    expect(main(['--conversation', CONV, '--out', out, '--apply'], fx.paths)).toBe(0)
    const jsonPath = join(out, `${CONV}.json`)
    const htmlPath = join(out, `${CONV}.html`)
    expect(existsSync(jsonPath)).toBe(true)
    expect(existsSync(htmlPath)).toBe(true)
    const conv = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
      conversationId: string
      title: string
      messages: { role: string; content: string; textContent: string; timestamp: string | null }[]
    }
    expect(conv.conversationId).toBe(CONV)
    expect(conv.title).toBe('') // 转写无标题 ⇒ 空串,不编造
    expect(conv.messages).toHaveLength(3) // 坏行被跳过,消息 3 条
    expect(conv.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(conv.messages[1]!.content).toBe(`答一句 ${SECRET}\n第二段`)
    expect(conv.messages[1]!.timestamp).toBe(new Date(MS_TS).toISOString())
    expect(conv.messages[2]!.timestamp).toBe('2026-10-27T01:02:00.000Z')
    // 输出只报计数与 sha 前缀,不回显正文
    const printed = cap.text()
    expect(printed).toContain('sha:')
    expect(printed).not.toContain(SECRET)
    expect(printed).not.toContain('问一句')
    // 无残留临时文件
    expect(readdirSync(out).filter((n) => n.includes('.exporting-'))).toEqual([])
  })

  it('HTML 自包含且逐字转义:不含未转义 <script>,零外链零脚本', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const out = join(fx.root, 'out-html')
    captureOutput()
    expect(main(['--conversation', CONV, '--out', out, '--apply'], fx.paths)).toBe(0)
    const html = readFileSync(join(out, `${CONV}.html`), 'utf8')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&amp;&lt;&gt;&quot;')
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<style>')
    expect(html).not.toMatch(/\b(src|href)\s*=/)
    expect(html).toContain(CONV) // 无标题时用会话 id 占位
    expect(html).toContain('（转写中无标题）')
  })

  it('aiTitle 形状的标题进入 json 与 html', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const out = join(fx.root, 'out-title')
    captureOutput()
    expect(main(['--conversation', CONV_TITLED, '--out', out, '--apply'], fx.paths)).toBe(0)
    const conv = JSON.parse(readFileSync(join(out, `${CONV_TITLED}.json`), 'utf8')) as {
      title: string
    }
    expect(conv.title).toBe('迁移演练标题')
    expect(readFileSync(join(out, `${CONV_TITLED}.html`), 'utf8')).toContain('迁移演练标题')
  })

  it('--out 落在会话库内 → exit 2(源库只读红线,手滑参数也不能击穿)', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const out = join(fx.paths.sessionsRoot, CONV, 'export')
    const cap = captureOutput()
    expect(main(['--conversation', CONV, '--out', out, '--apply'], fx.paths)).toBe(2)
    expect(cap.text()).toContain('源库只读')
    expect(existsSync(out)).toBe(false)
  })
})

describe('main · --account', () => {
  it('唯一前缀命中:只导该账号名下会话,缺转写的跳过点名', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const out = join(fx.root, 'out-acct')
    const cap = captureOutput()
    expect(main(['--account', 'acct-alpha-1', '--out', out], fx.paths)).toBe(0)
    const text = cap.text()
    expect(text).toContain(CONV)
    expect(text).not.toContain(CONV_TITLED)
    // 台账有归属但无转写 ⇒ 单独点名,不阻断其余
    expect(text).toContain('跳过 1 个')
    expect(text).toContain(CONV_MISSING)
    expect(existsSync(out)).toBe(false) // dry-run 零写入
  })

  it('批量部分缺转写:有的照导,缺的不落,exit 0', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const out = join(fx.root, 'out-acct-apply')
    captureOutput()
    expect(main(['--account', 'acct-alpha-1', '--out', out, '--apply'], fx.paths)).toBe(0)
    expect(existsSync(join(out, `${CONV}.json`))).toBe(true)
    expect(existsSync(join(out, `${CONV}.html`))).toBe(true)
    expect(existsSync(join(out, `${CONV_MISSING}.json`))).toBe(false)
  })

  it('批量全部缺转写 → exit 2 且不建输出目录', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    rmSync(join(fx.paths.projectsRoot, 'ws-a', `${CONV}.jsonl`), { force: true })
    const out = join(fx.root, 'out-acct-empty')
    const cap = captureOutput()
    expect(main(['--account', 'acct-alpha-1', '--out', out, '--apply'], fx.paths)).toBe(2)
    expect(cap.text()).toContain('没有可导出的会话')
    expect(existsSync(out)).toBe(false)
  })

  it('前缀不唯一 → exit 2 且零写入', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const out = join(fx.root, 'out-ambiguous')
    const cap = captureOutput()
    expect(main(['--account', 'acct-alpha', '--out', out, '--apply'], fx.paths)).toBe(2)
    expect(cap.text()).toContain('不唯一')
    expect(existsSync(out)).toBe(false)
  })

  it('台账缺失 / 会话不存在 → exit 2,零写入', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const out = join(fx.root, 'out-miss')
    rmSync(fx.paths.ledgerFile, { force: true })
    const cap = captureOutput()
    expect(main(['--account', ACCT_A, '--out', out], fx.paths)).toBe(2)
    expect(cap.text()).toContain('台账不存在')
    const fx2 = makeFixture()
    cleanup.push(fx2.root)
    expect(main(['--conversation', 'no-such-conv', '--out', out, '--apply'], fx2.paths)).toBe(2)
    expect(existsSync(out)).toBe(false)
  })
})

describe('applyExport · 对账与源库只读', () => {
  it('逐文件 sha256 与落地内容一致,源库两面逐字节未变', () => {
    const fx = makeFixture()
    cleanup.push(fx.root)
    const before = {
      sessions: snapshotTree(fx.paths.sessionsRoot),
      projects: snapshotTree(fx.paths.projectsRoot),
    }
    const out = join(fx.root, 'out-verify')
    const plan = buildExportPlan(
      [CONV, CONV_TITLED],
      out,
      fx.paths,
      new Date('2026-10-27T03:00:00Z'),
    )
    expect(plan.targets).toHaveLength(2)
    expect(plan.totalFiles).toBe(4)
    expect(plan.totalBadLines).toBe(1)
    // 缺转写的会话进 skipped(逐条独立),不进 targets
    const mixed = buildExportPlan([CONV, CONV_MISSING], join(fx.root, 'out-mixed'), fx.paths)
    expect(mixed.targets.map((t) => t.conversationId)).toEqual([CONV])
    expect(mixed.skipped.map((s) => s.conversationId)).toEqual([CONV_MISSING])
    expect(mixed.skipped[0]!.reason).toContain('会话无逐会话转写')
    const placed = applyExport(plan)
    expect(placed).toHaveLength(4)
    for (const f of placed) {
      expect(statSync(f.path).size).toBe(f.bytes)
      expect(sha256Of(readFileSync(f.path))).toBe(f.sha256)
    }
    expect(plan.totalBytes).toBe(placed.reduce((s, f) => s + f.bytes, 0))
    // 源库只读:两面快照逐字节相同,且源侧无新增路径
    expect(snapshotTree(fx.paths.sessionsRoot)).toEqual(before.sessions)
    expect(snapshotTree(fx.paths.projectsRoot)).toEqual(before.projects)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
