// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 账号↔会话关联台账(⑦第二刀·搬移/隔离腿·台账面,2026-10-27 立)。
 *
 *   pnpm relay:session-links list
 *   pnpm relay:session-links rebuild --since <ISO> --account <id> [--label <名>] [--apply]
 *   pnpm relay:session-links assign  --conversation <id> --account <id> [--apply]
 *   pnpm relay:session-links unassign --conversation <id> [--apply]
 *
 * 方案 A 语义(docs/RELAY_SESSION_MIGRATION_DESIGN.md §5/§6 定案):
 * - 以切换时刻 since 分桶:会话创建时刻 > since ⇒ 归该账号;≤ since 及时刻不可判 ⇒
 *   显式标 accountId=null(未归属),绝不猜;
 * - rebuild 只改台账,不动任何会话文件;已有 linkedBy=manual 的人工标注原样保留。
 *
 * 红线(§2):默认 dry-run,写台账必须 --apply;写前把旧台账备份为
 * session_links.json.bak-<ts>;输出零内容回显(只有 id/计数/时刻,无消息正文无 token)。
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** 台账与被盘点的会话库根(默认本机真实面;测试注入临时目录) */
export interface SessionLinksPaths {
  ledgerFile: string
  sessionsRoot: string
  projectsRoot: string
}

export function defaultLinksPaths(home = homedir()): SessionLinksPaths {
  return {
    ledgerFile: join(home, '.wb-switch', 'relay', 'session_links.json'),
    sessionsRoot: join(home, '.workbuddy', 'workspace', 'sessions'),
    projectsRoot: join(home, '.workbuddy', 'projects'),
  }
}

export interface LedgerAccount {
  accountId: string
  label: string
  /** 切换时刻(ISO):此后新会话归此账号 */
  since: string
}

export interface LinkEntry {
  /** null = 显式未归属(存量/不可判,绝不猜) */
  accountId: string | null
  linkedAt: string
  linkedBy: 'auto-since' | 'manual'
}

export interface SessionLinksLedger {
  version: 1
  accounts: LedgerAccount[]
  links: Record<string, LinkEntry>
}

export function emptyLedger(): SessionLinksLedger {
  return { version: 1, accounts: [], links: {} }
}

/** 读台账;不存在返回 null;存在但解析失败抛错(宁可拒做,不在坏台账上继续写) */
export function loadLedger(ledgerFile: string): SessionLinksLedger | null {
  if (!existsSync(ledgerFile)) return null
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(ledgerFile, 'utf8'))
  } catch (err) {
    throw new Error(`台账存在但不可解析(${ledgerFile}): ${(err as Error).message}`)
  }
  const j = (raw ?? {}) as Record<string, unknown>
  const links: Record<string, LinkEntry> = {}
  const rawLinks = (j['links'] ?? {}) as Record<string, unknown>
  for (const [conv, v] of Object.entries(rawLinks)) {
    const e = (v ?? {}) as Record<string, unknown>
    links[conv] = {
      accountId: typeof e['accountId'] === 'string' ? (e['accountId'] as string) : null,
      linkedAt: typeof e['linkedAt'] === 'string' ? (e['linkedAt'] as string) : '',
      linkedBy: e['linkedBy'] === 'manual' ? 'manual' : 'auto-since',
    }
  }
  const accounts = Array.isArray(j['accounts']) ? (j['accounts'] as Record<string, unknown>[]) : []
  return {
    version: 1,
    accounts: accounts
      .filter((a) => typeof a['accountId'] === 'string')
      .map((a) => ({
        accountId: a['accountId'] as string,
        label: typeof a['label'] === 'string' ? (a['label'] as string) : '',
        since: typeof a['since'] === 'string' ? (a['since'] as string) : '',
      })),
    links,
  }
}

/** 写台账:写前备份旧文件为 .bak-<ts>,临时名+原子改名,零半写 */
export function applyLedger(ledgerFile: string, next: SessionLinksLedger): string {
  mkdirSync(dirname(ledgerFile), { recursive: true })
  let backupPath: string | null = null
  if (existsSync(ledgerFile)) {
    backupPath = `${ledgerFile}.bak-${Date.now()}`
    writeFileSync(backupPath, readFileSync(ledgerFile))
  }
  const tmp = `${ledgerFile}.writing-${Date.now()}`
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`)
  renameSync(tmp, ledgerFile)
  return backupPath ?? ''
}

/**
 * 盘点全部会话 id 及其"创建时刻"证据(纯只读)。
 * 会话全集 = sessions/ 下目录名 ∪ projects/<ws>/ 顶层 <conv>.jsonl 文件名主干;
 * 创建时刻取可验证证据的最小值:转写首行 timestamp / 转写 birthtime / 会话目录 birthtime,
 * 全无证据则 null(方案 A:null ⇒ 未归属,不猜)。
 */
export function scanConversationIds(
  sessionsRoot: string,
  projectsRoot: string,
): { conversations: string[]; times: Record<string, string | null> } {
  const set = new Set<string>()
  const times: Record<string, string | null> = {}
  const consider = (conv: string, evidenceMs: number | null): void => {
    set.add(conv)
    if (evidenceMs !== null && Number.isFinite(evidenceMs) && evidenceMs > 0) {
      const iso = new Date(evidenceMs).toISOString()
      const cur = times[conv]
      times[conv] = cur !== undefined && cur !== null ? (iso < cur ? iso : cur) : iso
    } else if (!(conv in times)) {
      times[conv] = null
    }
  }
  if (existsSync(sessionsRoot)) {
    for (const name of readdirSync(sessionsRoot)) {
      const dir = join(sessionsRoot, name)
      let st
      try {
        st = statSync(dir)
      } catch {
        continue
      }
      if (!st.isDirectory()) continue
      consider(name, st.birthtimeMs > 0 ? st.birthtimeMs : st.mtimeMs)
    }
  }
  if (existsSync(projectsRoot)) {
    for (const ws of readdirSync(projectsRoot)) {
      const wsDir = join(projectsRoot, ws)
      let st
      try {
        st = statSync(wsDir)
      } catch {
        continue
      }
      if (!st.isDirectory()) continue
      let files: string[]
      try {
        files = readdirSync(wsDir)
      } catch {
        continue
      }
      for (const f of files) {
        if (!f.endsWith('.jsonl')) continue
        const conv = f.slice(0, -'.jsonl'.length)
        if (conv.length === 0) continue
        const abs = join(wsDir, f)
        let fst
        try {
          fst = statSync(abs)
        } catch {
          continue
        }
        consider(conv, fst.birthtimeMs > 0 ? fst.birthtimeMs : fst.mtimeMs)
        // 首行 timestamp 只取键位不回显内容;解析失败不冒判
        try {
          const first = readFileSync(abs, 'utf8')
            .split('\n')
            .find((l) => l.trim() !== '')
          if (first) {
            const j = JSON.parse(first) as Record<string, unknown>
            if (typeof j['timestamp'] === 'string') {
              const ms = Date.parse(j['timestamp'])
              if (Number.isFinite(ms)) consider(conv, ms)
            }
          }
        } catch {
          /* 首行非 JSON ⇒ 不给时间证据 */
        }
      }
    }
  }
  return { conversations: [...set].sort(), times }
}

export interface LinksPlan {
  action: 'rebuild' | 'assign' | 'unassign'
  /** next = 写盘后的完整台账 */
  next: SessionLinksLedger
  /** 人类可读变更清单(零内容,只 id/桶/时刻) */
  changes: string[]
  warnings: string[]
}

/**
 * rebuild(方案 A):since 之后的新会话归 account,存量/不可判显式 null;
 * linkedBy=manual 的人工标注原样保留;账号不存在则按 since/label 登入台账。
 */
export function planRebuild(
  ledger: SessionLinksLedger,
  opts: { since: string; accountId: string; label?: string },
  conversations: string[],
  times: Record<string, string | null>,
): LinksPlan {
  const sinceMs = Date.parse(opts.since)
  if (!Number.isFinite(sinceMs)) throw new Error(`--since 不是合法 ISO 时刻: ${opts.since}`)
  if (!opts.accountId) throw new Error('缺少 --account <id>')
  const accounts = [...ledger.accounts]
  if (!accounts.some((a) => a.accountId === opts.accountId)) {
    accounts.push({ accountId: opts.accountId, label: opts.label ?? '', since: opts.since })
  } else {
    const i = accounts.findIndex((a) => a.accountId === opts.accountId)
    accounts[i] = {
      accountId: opts.accountId,
      label: opts.label ?? accounts[i]!.label,
      since: opts.since,
    }
  }
  const links: Record<string, LinkEntry> = { ...ledger.links }
  const changes: string[] = []
  const warnings: string[] = []
  const now = new Date().toISOString()
  for (const conv of conversations) {
    const prev = ledger.links[conv]
    if (prev?.linkedBy === 'manual') continue // 人工标注不被机器重建覆盖
    const t = times[conv]
    const after = t !== null && Date.parse(t) > sinceMs
    const next: LinkEntry = {
      accountId: after ? opts.accountId : null,
      linkedAt: now,
      linkedBy: 'auto-since',
    }
    const beforeDesc = prev ? `${prev.accountId ?? '未归属'}(${prev.linkedBy})` : '无记录'
    changes.push(
      `${conv}: ${beforeDesc} → ${after ? opts.accountId : '未归属(null)'}` +
        `${t ? `(创建=${t})` : '(创建时刻无证据,不猜)'}`,
    )
    if (t === null) warnings.push(`${conv}: 创建时刻无证据,标未归属`)
    links[conv] = next
  }
  return { action: 'rebuild', next: { version: 1, accounts, links }, changes, warnings }
}

/** assign:人工标注(linkedBy=manual);账号必须在台账 accounts 里 */
export function planAssign(
  ledger: SessionLinksLedger,
  conversationId: string,
  accountId: string,
  now = new Date(),
): LinksPlan {
  if (!conversationId) throw new Error('缺少 --conversation <id>')
  if (!accountId) throw new Error('缺少 --account <id>')
  if (!ledger.accounts.some((a) => a.accountId === accountId)) {
    throw new Error(`账号不在台账 accounts 里: ${accountId}(先 rebuild 登记)`)
  }
  const links = { ...ledger.links }
  links[conversationId] = { accountId, linkedAt: now.toISOString(), linkedBy: 'manual' }
  return {
    action: 'assign',
    next: { version: 1, accounts: ledger.accounts, links },
    changes: [`${conversationId}: → ${accountId}(manual)`],
    warnings: [],
  }
}

/** unassign:显式标 null(linkedBy=manual,是人工动作而非"未知") */
export function planUnassign(
  ledger: SessionLinksLedger,
  conversationId: string,
  now = new Date(),
): LinksPlan {
  if (!conversationId) throw new Error('缺少 --conversation <id>')
  if (!(conversationId in ledger.links)) {
    throw new Error(`台账中无此会话记录: ${conversationId}(先 rebuild 盘点)`)
  }
  const links = { ...ledger.links }
  links[conversationId] = { accountId: null, linkedAt: now.toISOString(), linkedBy: 'manual' }
  return {
    action: 'unassign',
    next: { version: 1, accounts: ledger.accounts, links },
    changes: [`${conversationId}: → 未归属(null)(manual)`],
    warnings: [],
  }
}

/** list 展示:账号、各桶计数、未归属计数;零内容回显 */
export function formatLedgerList(
  ledger: SessionLinksLedger | null,
  paths: SessionLinksPaths,
): string {
  const lines: string[] = []
  lines.push('== 会话关联台账(relay:session-links;只展示 id/计数/时刻,零内容) ==')
  lines.push(`台账: ${paths.ledgerFile}${ledger ? '' : '(不存在,先 rebuild)'}`)
  if (!ledger) return lines.join('\n')
  const counts = new Map<string | null, number>()
  for (const l of Object.values(ledger.links)) {
    counts.set(l.accountId, (counts.get(l.accountId) ?? 0) + 1)
  }
  const manualCount = Object.values(ledger.links).filter((l) => l.linkedBy === 'manual').length
  lines.push(`账号: ${ledger.accounts.length}`)
  for (const a of ledger.accounts) {
    lines.push(
      `  ${a.accountId}  label=${a.label || '-'}  since=${a.since || '?'}  桶内=${counts.get(a.accountId) ?? 0}`,
    )
  }
  lines.push(
    `未归属(null)=${counts.get(null) ?? 0}  台账总记录=${Object.keys(ledger.links).length}(其中 manual=${manualCount})`,
  )
  return lines.join('\n')
}

function getFlag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

export function main(
  argv: string[] = process.argv.slice(2),
  pathsOverride?: SessionLinksPaths,
): number {
  const paths = pathsOverride ?? defaultLinksPaths()
  const apply = argv.includes('--apply')
  const cmd = argv[0]
  try {
    if (cmd === undefined || cmd === 'list') {
      console.log(formatLedgerList(loadLedger(paths.ledgerFile), paths))
      console.log('\n写操作用法: rebuild / assign / unassign(默认 dry-run,加 --apply 才写台账)')
      return 0
    }
    const ledger = loadLedger(paths.ledgerFile) ?? emptyLedger()
    let plan: LinksPlan
    if (cmd === 'rebuild') {
      const since = getFlag(argv, '--since')
      const account = getFlag(argv, '--account')
      const label = getFlag(argv, '--label')
      if (!since || !account) {
        console.error('rebuild 需要 --since <ISO> --account <id>([--label <名>])')
        return 2
      }
      const scan = scanConversationIds(paths.sessionsRoot, paths.projectsRoot)
      plan = planRebuild(
        ledger,
        { since, accountId: account, label },
        scan.conversations,
        scan.times,
      )
    } else if (cmd === 'assign') {
      const conv = getFlag(argv, '--conversation')
      const account = getFlag(argv, '--account')
      if (!conv || !account) {
        console.error('assign 需要 --conversation <id> --account <id>')
        return 2
      }
      plan = planAssign(ledger, conv, account)
    } else if (cmd === 'unassign') {
      const conv = getFlag(argv, '--conversation')
      if (!conv) {
        console.error('unassign 需要 --conversation <id>')
        return 2
      }
      plan = planUnassign(ledger, conv)
    } else {
      console.error(`未知子命令: ${String(cmd)}(可用: list / rebuild / assign / unassign)`)
      return 2
    }
    const head = [
      `${plan.action} · ${apply ? '执行' : '预览(dry-run;加 --apply 才写台账)'}`,
      `将动 ${plan.changes.length} 条台账记录`,
      ...plan.changes.slice(0, 20),
      ...(plan.changes.length > 20 ? [`  …其余 ${plan.changes.length - 20} 条`] : []),
      ...plan.warnings.map((w) => `  ⚠ ${w}`),
    ]
    if (!apply) {
      console.log(head.join('\n'))
      console.log('\n(dry-run;未写入任何路径。rebuild 只动台账,不动会话文件)')
      return 0
    }
    const backup = applyLedger(paths.ledgerFile, plan.next)
    console.log(
      head.join('\n') +
        `\n\n台账已写入: ${paths.ledgerFile}` +
        (backup ? `\n旧台账备份于: ${backup}` : '\n(此前无旧台账,无 .bak)'),
    )
    return 0
  } catch (err) {
    console.error(`会话台账操作失败: ${(err as Error).message}`)
    return 1
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exitCode = main()
}
