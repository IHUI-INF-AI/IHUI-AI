// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话导出(⑦第⑦刀·只读导出腿,2026-10-27 立)。
 *
 *   pnpm relay:session-export --conversation <id> [--out <dir>] [--apply]
 *   pnpm relay:session-export --account <台账账号id 或唯一前缀> [--out <dir>] [--apply]
 *
 * 语义:把一个会话的逐会话转写渲染成两份自包含产物 ——
 *   <conversationId>.json  { conversationId, title, messages: [{role, content, textContent, timestamp}] }
 *   <conversationId>.html  内联样式、零外链、零脚本(标题与每条消息逐字 HTML 转义)
 * 字段形状对齐官方「会话报告」导出(docs/RELAY_SESSION_MIGRATION_EVIDENCE.md §4)。
 *
 * 红线(同族 relay-session-backup / relay-session-move):
 * - 源库只读:只 stat/read,绝不写/删/改名会话库任何路径;
 * - 预览先行:默认 dry-run 只列会话数/文件数/路径/字节,真写必须 --apply;
 * - 零内容回显:输出永不包含消息正文与 token(只有路径、字节、sha256 前缀、会话 id);
 * - 校验后收工:逐文件先写临时名 → sha256 对账 → 原子改名,对不上即报错。
 *
 * 本机实测(2026-10-27,223 份转写/187,975 行):消息行以 role 区分(user/assistant),
 * content 为数组时文本住元素的 text 键;timestamp 恒为 13 位毫秒数;标题不住 title 键,
 * 而住 type=ai-title 行的 aiTitle 键 —— 两条都认(官方字段名 title 优先),都没有则空串,不编造。
 * 坏行(非 JSON)跳过并计数,不因一行坏数据中断整批。
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findConversationFiles, resolveAccountId } from './relay-session-move.js'
import { loadLedger } from './relay-session-links.js'

/** 导出器全部路径面(默认本机真实面;测试注入临时目录,绝不碰真实会话库) */
export interface ExportPaths {
  /** WorkBuddy 助手 workspace/sessions 根 */
  sessionsRoot: string
  /** WorkBuddy 助手 projects 根(每工作区一目录) */
  projectsRoot: string
  /** 会话关联台账 ~/.wb-switch/relay/session_links.json */
  ledgerFile: string
  /** 默认输出根;--out 未给时在其下按 UTC 时间戳建目录 */
  exportsRoot: string
}

export function defaultExportPaths(home = homedir()): ExportPaths {
  return {
    sessionsRoot: join(home, '.workbuddy', 'workspace', 'sessions'),
    projectsRoot: join(home, '.workbuddy', 'projects'),
    ledgerFile: join(home, '.wb-switch', 'relay', 'session_links.json'),
    exportsRoot: join(home, '.wb-switch', 'exports'),
  }
}

/** 默认输出目录名:UTC 紧凑时间戳(与 relay-session-backup 同风格) */
export function exportDirStamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/** 一条消息的导出投影(字段与官方会话报告一致) */
export interface ExportMessage {
  role: string
  content: string
  textContent: string
  timestamp: string | null
}

export interface ParsedTranscript {
  /** 首个非空标题;取不到是空串(不编造) */
  title: string
  messages: ExportMessage[]
  /** 非 JSON / 非对象行数(跳过并计数,不中断) */
  badLines: number
  /** 非空行总数(含坏行),用于对账 */
  totalLines: number
}

/** content 可能是字符串,也可能是 [{type,text}] 分片;只取文本,不猜其它形态 */
function contentTextOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  const parts: string[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      parts.push(item)
      continue
    }
    if (item !== null && typeof item === 'object') {
      const text = (item as Record<string, unknown>)['text']
      if (typeof text === 'string' && text.length > 0) parts.push(text)
    }
  }
  return parts.join('\n')
}

/** 时刻归一:字符串原样保留;数字按毫秒(本机实测恒 13 位),10 位按秒容错;不可判 null */
function timestampOf(value: unknown): string | null {
  if (typeof value === 'string') return value.length > 0 ? value : null
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
}

/** 解析逐会话转写(纯函数,零 IO):标题取首个非空,消息按 role 归集,坏行计数 */
export function parseTranscript(raw: string): ParsedTranscript {
  let title = ''
  let aiTitle = ''
  const messages: ExportMessage[] = []
  let badLines = 0
  let totalLines = 0
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue
    totalLines += 1
    let row: unknown
    try {
      row = JSON.parse(line)
    } catch {
      badLines += 1
      continue
    }
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      badLines += 1
      continue
    }
    const j = row as Record<string, unknown>
    const rawTitle = j['title']
    if (title === '' && typeof rawTitle === 'string' && rawTitle.trim() !== '') {
      title = rawTitle.trim()
    }
    // 本机实测标题住 type=ai-title 行的 aiTitle;官方字段名 title 优先,两条都认
    const rawAiTitle = j['aiTitle']
    if (aiTitle === '' && typeof rawAiTitle === 'string' && rawAiTitle.trim() !== '') {
      aiTitle = rawAiTitle.trim()
    }
    const role = j['role']
    if (typeof role !== 'string' || role === '') continue
    const content = contentTextOf(j['content'])
    const rawText = j['textContent']
    messages.push({
      role,
      content,
      // textContent 是 content 的文本投影:行内有同名键用行内值,否则同源投影(不另造内容)
      textContent: typeof rawText === 'string' && rawText !== '' ? rawText : content,
      timestamp: timestampOf(j['timestamp']),
    })
  }
  return { title: title !== '' ? title : aiTitle, messages, badLines, totalLines }
}

/** HTML 转义(标题与每条消息都过这一道,防注入) */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

/** 导出形状(与官方会话报告对齐) */
export interface ConversationExport {
  conversationId: string
  title: string
  messages: ExportMessage[]
}

/** 自包含 HTML:内联 CSS、零外链、零脚本;标题为空时用会话 id 占位并如实标注 */
export function renderHtml(conv: ConversationExport, exportedAt: string): string {
  const escId = escapeHtml(conv.conversationId)
  const escTitle = escapeHtml(conv.title)
  const heading = escTitle !== '' ? escTitle : escId
  const titleNote = escTitle !== '' ? '' : '（转写中无标题）'
  const items = conv.messages.map((m) => {
    const when = m.timestamp === null ? '' : escapeHtml(m.timestamp)
    return (
      '    <section class="msg">\n' +
      `      <div class="head"><span class="role">${escapeHtml(m.role)}</span>` +
      `<span class="time">${when}</span></div>\n` +
      `      <div class="body">${escapeHtml(m.content)}</div>\n` +
      '    </section>'
    )
  })
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${heading}${titleNote}</title>`,
    '<style>',
    '*{box-sizing:border-box}',
    'body{margin:0;padding:2rem 1rem;background:#f6f7f9;color:#1d2129;' +
      'font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;line-height:1.6}',
    'main{max-width:52rem;margin:0 auto}',
    'h1{font-size:1.25rem;margin:0 0 0.25rem}',
    '.meta{color:#6b7280;font-size:0.75rem;margin:0 0 1.25rem}',
    '.msg{background:#fff;border-radius:0.5rem;padding:0.75rem 0.875rem;margin-top:0.625rem}',
    '.head{display:flex;gap:0.5rem;align-items:baseline;font-size:0.75rem;color:#6b7280}',
    '.role{font-weight:600;color:#1d2129}',
    '.body{white-space:pre-wrap;word-break:break-word;margin-top:0.375rem}',
    '@media (prefers-color-scheme:dark){body{background:#111418;color:#e5e7eb}' +
      '.msg{background:#181d23}.role{color:#e5e7eb}.meta,.head{color:#9aa4b2}}',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    `<h1>${heading}${titleNote}</h1>`,
    `<p class="meta">会话 ${escId} · ${conv.messages.length} 条消息 · 导出 ${escapeHtml(exportedAt)}</p>`,
    ...items,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

export interface ExportTarget {
  conversationId: string
  transcriptPath: string
  jsonPath: string
  htmlPath: string
  jsonText: string
  htmlText: string
  jsonBytes: number
  htmlBytes: number
  messages: number
  /** 标题字符数(输出里只报长度,不回显标题本身) */
  titleChars: number
  badLines: number
}

export interface ExportPlan {
  outDir: string
  targets: ExportTarget[]
  /** 缺转写等原因逐条跳过(不阻断其余;单会话模式下等于整批不可判定) */
  skipped: ExportSkip[]
  totalFiles: number
  totalBytes: number
  totalMessages: number
  totalBadLines: number
}

export interface ExportSkip {
  conversationId: string
  reason: string
}

/** 会话 id 会直接做文件名:只许安全字符,挡路径穿越 */
export function assertSafeConversationId(conversationId: string): void {
  if (
    !/^[A-Za-z0-9._-]+$/.test(conversationId) ||
    conversationId === '.' ||
    conversationId === '..'
  ) {
    throw new Error(`会话 id 形态不可用于导出文件名: ${JSON.stringify(conversationId)}`)
  }
}

/** 输出目录不得落进会话库(源库只读红线;手滑 --out 也不能击穿) */
export function assertOutDirOutsideStore(outDir: string, paths: ExportPaths): void {
  const target = resolve(outDir)
  for (const root of [paths.sessionsRoot, paths.projectsRoot]) {
    const base = resolve(root)
    if (target === base || target.startsWith(base + sep)) {
      throw new Error(`--out 落在会话库内,拒绝写入(源库只读): ${outDir}`)
    }
  }
}

/** 定位逐会话转写:projects/<ws>/<conv>.jsonl(本机实测每会话恒一份;多份取字典序第一并点名) */
export function locateTranscript(conversationId: string, paths: ExportPaths): string {
  assertSafeConversationId(conversationId)
  const cf = findConversationFiles(conversationId, paths.sessionsRoot, paths.projectsRoot)
  const candidates = cf.projectFiles.filter((p) => basename(p) === `${conversationId}.jsonl`).sort()
  const first = candidates[0]
  if (first === undefined) {
    const where = cf.sessionDir ?? 'sessions/ 与 projects/ 两面均无落点'
    throw new Error(
      `会话无逐会话转写: ${conversationId}(${where};期待 projects/<工作区>/${conversationId}.jsonl)`,
    )
  }
  return first
}

/** 账号模式:从台账取该账号名下会话(resolveAccountId 复用搬移腿,前缀不唯一即拒绝) */
export function conversationIdsForAccount(raw: string, paths: ExportPaths): string[] {
  const ledger = loadLedger(paths.ledgerFile)
  if (!ledger) {
    throw new Error(`台账不存在: ${paths.ledgerFile}。先跑 pnpm relay:session-links rebuild --auto`)
  }
  const accountId = resolveAccountId(ledger, raw)
  return Object.entries(ledger.links)
    .filter(([, link]) => link.accountId === accountId)
    .map(([conv]) => conv)
    .sort()
}

/**
 * 计算导出计划(纯只读面,内容只在内存):dry-run 与 --apply 共用同一份计算,
 * 预览阶段就能暴露解析失败。逐会话独立:单个取不到转写只跳过并点名,不阻断其余
 * (本机实测真账:某账号名下 11 个会话只有 9 份转写,整批顶死等于导不出其余 9 个)。
 */
export function buildExportPlan(
  conversationIds: string[],
  outDir: string,
  paths: ExportPaths,
  now: Date = new Date(),
): ExportPlan {
  const exportedAt = now.toISOString()
  const targets: ExportTarget[] = []
  const skipped: ExportSkip[] = []
  for (const conversationId of conversationIds) {
    try {
      const transcriptPath = locateTranscript(conversationId, paths)
      const parsed = parseTranscript(readFileSync(transcriptPath, 'utf8'))
      const conv: ConversationExport = {
        conversationId,
        title: parsed.title,
        messages: parsed.messages,
      }
      const jsonText = `${JSON.stringify(conv, null, 2)}\n`
      const htmlText = renderHtml(conv, exportedAt)
      targets.push({
        conversationId,
        transcriptPath,
        jsonPath: join(outDir, `${conversationId}.json`),
        htmlPath: join(outDir, `${conversationId}.html`),
        jsonText,
        htmlText,
        jsonBytes: Buffer.byteLength(jsonText, 'utf8'),
        htmlBytes: Buffer.byteLength(htmlText, 'utf8'),
        messages: parsed.messages.length,
        titleChars: parsed.title.length,
        badLines: parsed.badLines,
      })
    } catch (err) {
      skipped.push({ conversationId, reason: (err as Error).message })
    }
  }
  const totalBytes = targets.reduce((s, t) => s + t.jsonBytes + t.htmlBytes, 0)
  return {
    outDir,
    targets,
    skipped,
    totalFiles: targets.length * 2,
    totalBytes,
    totalMessages: targets.reduce((s, t) => s + t.messages, 0),
    totalBadLines: targets.reduce((s, t) => s + t.badLines, 0),
  }
}

/** 预览文本:路径 + 字节 + 计数,零内容(标题只报字符数) */
export function formatPlan(plan: ExportPlan, dryRun: boolean): string {
  const lines: string[] = []
  lines.push(`会话导出 · ${dryRun ? '预览(dry-run;加 --apply 才写文件)' : '执行'}`)
  lines.push(`输出目录: ${plan.outDir}`)
  lines.push(
    `将导出 ${plan.targets.length} 个会话 / ${plan.totalFiles} 个文件,` +
      `共 ${plan.totalBytes} 字节 / ${plan.totalMessages} 条消息`,
  )
  const shown = plan.targets.slice(0, 15)
  for (const t of shown) {
    lines.push(
      `  ${t.conversationId}  messages=${t.messages}  badLines=${t.badLines}  titleChars=${t.titleChars}`,
    )
    lines.push(`    ${t.jsonPath} (${t.jsonBytes}B)`)
    lines.push(`    ${t.htmlPath} (${t.htmlBytes}B)`)
  }
  if (plan.targets.length > shown.length) {
    lines.push(`  …其余 ${plan.targets.length - shown.length} 个会话同批`)
  }
  if (plan.skipped.length > 0) {
    lines.push(`跳过 ${plan.skipped.length} 个(逐条独立,不影响其余):`)
    for (const s of plan.skipped.slice(0, 10)) lines.push(`  ${s.conversationId}: ${s.reason}`)
    if (plan.skipped.length > 10) lines.push(`  …其余 ${plan.skipped.length - 10} 条`)
  }
  if (plan.totalBadLines > 0) {
    lines.push(`  ⚠ 转写中有 ${plan.totalBadLines} 行非 JSON 已跳过(逐会话计数见上)`)
  }
  return lines.join('\n')
}

export interface AppliedFile {
  path: string
  bytes: number
  sha256: string
}

/**
 * 执行导出(写面,仅 --apply 可达):逐文件写 `<目标>.exporting-<ts>` 临时名 →
 * 读回 sha256 对账 → 原子改名 → 落地后再对一次账。任一环对不上即整批报错,
 * 已成功落地的保留(可重跑补齐),不留"对不上的半写状态"。
 */
export function applyExport(plan: ExportPlan): AppliedFile[] {
  mkdirSync(plan.outDir, { recursive: true })
  const ts = Date.now()
  const placed: AppliedFile[] = []
  const failures: string[] = []
  const writeOne = (target: string, text: string): void => {
    const buf = Buffer.from(text, 'utf8')
    const want = createHash('sha256').update(buf).digest('hex')
    const tmp = `${target}.exporting-${ts}`
    try {
      writeFileSync(tmp, buf)
      if (createHash('sha256').update(readFileSync(tmp)).digest('hex') !== want) {
        failures.push(`${target}: 临时文件 sha256 对不上`)
        return
      }
      renameSync(tmp, target)
      if (createHash('sha256').update(readFileSync(target)).digest('hex') !== want) {
        failures.push(`${target}: 落地后 sha256 对不上`)
        return
      }
      placed.push({ path: target, bytes: buf.length, sha256: want })
    } catch (err) {
      failures.push(`${target}: ${(err as Error).message}`)
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        /* 已改名或无临时件:无需清理 */
      }
    }
  }
  for (const t of plan.targets) {
    writeOne(t.jsonPath, t.jsonText)
    writeOne(t.htmlPath, t.htmlText)
  }
  if (failures.length > 0) {
    throw new Error(
      `导出未完成: ${failures.length} 个文件失败(已落地 ${placed.length} 个保留,可重跑补齐):\n` +
        failures.slice(0, 10).join('\n'),
    )
  }
  return placed
}

const USAGE = [
  '会话导出(只读源库;零内容回显)',
  '用法:',
  '  relay:session-export --conversation <id> [--out <dir>] [--apply]',
  '  relay:session-export --account <台账账号id 或唯一前缀> [--out <dir>] [--apply]',
  '说明:',
  '  --conversation  导出单个会话(sessions/<id>/ 与 projects/<ws>/<id>.jsonl 两面定位)',
  '  --account       导出会话关联台账(~/.wb-switch/relay/session_links.json)里该账号名下全部会话',
  '  --out           输出目录(不得落在会话库内);缺省 ~/.wb-switch/exports/<UTC 时间戳>/',
  '  --apply         真写文件;缺省 dry-run(只列会话数与文件数,零内容)',
  '每个会话产出 <id>.json(conversationId/title/messages)与 <id>.html(自包含、内联样式、无脚本)',
  '批量模式逐会话独立:取不到转写的会话跳过并点名,不阻断其余;全部跳过 ⇒ exit 2',
  '源会话库只读:本器只 stat/read,绝不写/删/改任何会话路径',
  '退出码:0 成功 / 1 业务失败(如账号名下无会话) / 2 参数或输入不可判定',
].join('\n')

function getFlag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

export function main(argv: string[] = process.argv.slice(2), pathsOverride?: ExportPaths): number {
  const paths = pathsOverride ?? defaultExportPaths()
  const apply = argv.includes('--apply')
  const conv = getFlag(argv, '--conversation')
  const account = getFlag(argv, '--account')
  const outFlag = getFlag(argv, '--out')
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    return 0
  }
  if (conv !== undefined && account !== undefined) {
    console.error('--conversation 与 --account 互斥(单会话 or 按账号批量,二选一)')
    return 2
  }
  if (conv === undefined && account === undefined) {
    console.error('需要 --conversation <id>,或 --account <台账账号id|唯一前缀>')
    return 2
  }
  const now = new Date()
  let conversationIds: string[]
  try {
    conversationIds = conv !== undefined ? [conv] : conversationIdsForAccount(account!, paths)
  } catch (err) {
    console.error(`会话导出失败(输入不可判定): ${(err as Error).message}`)
    return 2
  }
  if (conversationIds.length === 0) {
    console.error(`账号 ${account} 名下没有已归属会话(台账 accountId 精确等于该账号的条目为 0)`)
    return 1
  }
  const outDir = outFlag ?? join(paths.exportsRoot, exportDirStamp(now))
  try {
    assertOutDirOutsideStore(outDir, paths)
  } catch (err) {
    console.error(`会话导出失败(参数不可判定): ${(err as Error).message}`)
    return 2
  }
  let plan: ExportPlan
  try {
    plan = buildExportPlan(conversationIds, outDir, paths, now)
  } catch (err) {
    console.error(`会话导出失败(输入不可判定): ${(err as Error).message}`)
    return 2
  }
  if (plan.targets.length === 0) {
    // 全部跳过 = 无可导出内容:不建空目录,也不把"没导出"记成成功
    console.log(formatPlan(plan, !apply))
    console.error(`没有可导出的会话(${conversationIds.length} 个候选全部跳过,见上原因)`)
    return 2
  }
  if (!apply) {
    console.log(formatPlan(plan, true))
    console.log('\n(dry-run;未写入任何路径。确认后加 --apply)')
    return 0
  }
  try {
    const placed = applyExport(plan)
    console.log(formatPlan(plan, false))
    console.log(
      `\n完成: ${plan.targets.length} 个会话 / ${placed.length} 个文件,` +
        `共 ${plan.totalBytes} 字节 → ${plan.outDir}`,
    )
    for (const f of placed.slice(0, 20)) {
      console.log(`  ${f.path} (${f.bytes}B, sha:${f.sha256.slice(0, 12)})`)
    }
    if (placed.length > 20) console.log(`  …其余 ${placed.length - 20} 个文件同批`)
    console.log(`逐文件 sha256 已与落地内容对账(${placed.length}/${plan.totalFiles})`)
    return 0
  } catch (err) {
    console.error(`会话导出失败(写入面): ${(err as Error).message}`)
    return 1
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
