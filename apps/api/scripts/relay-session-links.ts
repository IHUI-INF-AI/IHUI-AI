// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号↔会话关联台账(⑦第二刀·搬移/隔离腿·台账面,2026-10-27 立)。
 *
 *   pnpm relay:session-links list
 *   pnpm relay:session-links rebuild --since <ISO> --account <id> [--label <名>] [--apply]
 *   pnpm relay:session-links rebuild --auto [--snapshot-dir <dir>] [--auth-file <p>] [--apply]
 *   pnpm relay:session-links assign  --conversation <id> --account <id> [--apply]
 *   pnpm relay:session-links assign-batch --file <清单路径> --account <id> [--apply]
 *   pnpm relay:session-links unassign --conversation <id> [--apply]
 *
 * assign-batch(⑦第七刀·人工清单批量 assign,2026-10-28 立):
 * 清单每行一个 conversationId(忽略空行与 `#` 注释),`--account` 支持唯一前缀。
 * **它是"人给清单、机器照标",不是机器猜**:逐条 id 必须逐字节来自文件,且必须能在
 * 台账链接集或物理盘点里被验证存在,验证不过一律跳过并点名(绝不写入、绝不阻断其余);
 * 写入的 linkedBy 恒为 manual(这是人的动作),账单一律不新增账号、不触碰清单外的行。
 *
 * 方案 A 语义(docs/RELAY_SESSION_MIGRATION_DESIGN.md §5/§6 定案):
 * - 以切换时刻 since 分桶:会话创建时刻 > since ⇒ 归该账号;≤ since 及时刻不可判 ⇒
 *   显式标 accountId=null(未归属),绝不猜;
 * - rebuild 只改台账,不动任何会话文件;已有 linkedBy=manual 的人工标注原样保留。
 *
 * --auto(2026-10-27 增):账号与切换时刻从登录态快照库
 * (~/.wb-switch/backups/workbuddy-desktop.<ts>.info,每份记录"切换前活跃账号"的 uid)
 * 自动推导成时间线段,用户零手抄。段判定口径:第 i 份快照记录的账号活跃于
 * [上一份快照时刻, 本份快照时刻),当前 auth 文件的账号活跃于 [最后快照时刻, now);
 * 第一段无下界。账号不可判的快照 ⇒ 该段整段标未归属(绝不把邻居账号借给它)。
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
import { maskPhone, resolveAuthFileCandidates } from './relay-account-switch.js'
import { acquireSessionLock, SESSION_LINKS_LOCK_NAME } from './relay-session-lock.js'
import { resolveAccountId } from './relay-session-move.js'

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

/** 快照账号元数据(只带展示字段,绝不带 token) */
export interface SnapshotAccountEntry {
  fileName: string
  /** 快照时刻 ISO(文件名解析;解析不出回落 mtime 并告警) */
  ts: string
  /** null = 该快照账号不可判(坏文件/缺 uid),整段会标未归属 */
  accountId: string | null
  /** 展示标签(昵称/打码手机号/uid 前 8 位),进台账前已脱敏 */
  label: string
}

export interface TimelineSegment {
  /** null = 该段账号不可判 */
  accountId: string | null
  label: string
  /** null = 无下界(最早一段) */
  start: string | null
  /** null = 现在(最后一段) */
  end: string | null
  /** accountId=null 时的原因:早于最早快照的存量 / 快照账号本身不可判 */
  reason?: 'below-earliest' | 'account-unknown'
}

/** 快照文件名 workbuddy-desktop.<YYYY-MM-DD>T<HH-MM-SS>Z.info → ISO 时刻 */
export function parseSnapshotStamp(fileName: string): string | null {
  const m = /^workbuddy-desktop\.(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.info$/.exec(fileName)
  if (!m) return null
  return `${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`
}

/** 从 auth/快照文件读账号元数据(只取 uid/nickname/phoneNumber,零 token 读取面) */
export function readAccountMeta(filePath: string): { accountId: string | null; label: string } {
  let root: Record<string, unknown>
  try {
    root = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>
  } catch {
    return { accountId: null, label: '' }
  }
  const acc = (root['account'] ?? {}) as Record<string, unknown>
  const uidRaw = acc['uid'] ?? acc['id']
  const accountId = typeof uidRaw === 'string' && uidRaw.length > 0 ? uidRaw : null
  const nick = acc['nickname']
  let label = typeof nick === 'string' && nick.length > 0 ? nick : ''
  if (!label) label = maskPhone(acc['phoneNumber']) ?? ''
  if (!label && accountId) label = accountId.slice(0, 8)
  return { accountId, label }
}

/** 枚举快照库(按时刻升序);坏文件进围栏但不静默跳过——它占的段必须标未归属 */
export function scanSnapshotAccounts(backupsDir: string): {
  entries: SnapshotAccountEntry[]
  warnings: string[]
} {
  if (!existsSync(backupsDir)) {
    throw new Error(
      `登录态快照库不存在: ${backupsDir}。先跑 pnpm relay:switch-account(capture 快照)或 wb-switch 切换一次`,
    )
  }
  const entries: SnapshotAccountEntry[] = []
  const warnings: string[] = []
  for (const n of readdirSync(backupsDir)) {
    if (!/^workbuddy-desktop\..+\.info$/.test(n)) continue
    const abs = join(backupsDir, n)
    let st
    try {
      st = statSync(abs)
    } catch {
      continue
    }
    if (!st.isFile()) continue
    let ts = parseSnapshotStamp(n)
    if (!ts) {
      ts = st.mtime.toISOString()
      warnings.push(`${n}: 文件名解析不出时刻,按 mtime=${ts}(可能错位,建议改用规范命名快照)`)
    }
    const meta = readAccountMeta(abs)
    if (!meta.accountId) warnings.push(`${n}: 账号不可判(解析失败或缺 uid),该时段标未归属`)
    entries.push({ fileName: n, ts, accountId: meta.accountId, label: meta.label })
  }
  entries.sort((a, b) => a.ts.localeCompare(b.ts))
  return { entries, warnings }
}

export interface TimelineOptions {
  /**
   * true = 最早快照之前的存量归最早快照的账号。默认 false:该时段无下界证据,
   * 按方案 A「存量显式未归属不猜」标 null(放宽必须显式给旗)。
   */
  trustEarliest?: boolean
}

/**
 * 快照序列 → 账号时间线段。语义:第 i 份快照记录"ts_i 切换前活跃的账号",
 * 故该账号活跃区间 = [ts_{i-1}, ts_i);当前 auth 文件的账号 = [ts_last, now)。
 * 首段无下界 ⇒ 默认标未归属(快照只能证明"时刻 ts_1 时活跃",不能证明更早)。
 * 相邻同账号段合并(仅合并账号可判的段;null 段保留边界,便于如实展示)。
 */
export function deriveAccountTimeline(
  snapshots: SnapshotAccountEntry[],
  current: { accountId: string; label: string } | null,
  opts: TimelineOptions = {},
): TimelineSegment[] {
  if (snapshots.length === 0) return []
  const segs: TimelineSegment[] = []
  for (let i = 0; i < snapshots.length; i += 1) {
    const s = snapshots[i]!
    const first = i === 0
    const strictFirst = first && !opts.trustEarliest
    segs.push({
      accountId: strictFirst ? null : s.accountId,
      label: s.label,
      start: first ? null : snapshots[i - 1]!.ts,
      end: s.ts,
      ...(strictFirst
        ? { reason: 'below-earliest' as const }
        : s.accountId === null
          ? { reason: 'account-unknown' as const }
          : {}),
    })
  }
  const last = snapshots[snapshots.length - 1]!
  segs.push({
    accountId: current?.accountId ?? null,
    label: current?.label ?? '',
    start: last.ts,
    end: null,
    ...(current ? {} : { reason: 'account-unknown' as const }),
  })
  const merged: TimelineSegment[] = []
  for (const s of segs) {
    const prev = merged[merged.length - 1]
    if (prev && s.accountId !== null && prev.accountId === s.accountId) {
      prev.end = s.end
      if (!prev.label && s.label) prev.label = s.label
      continue
    }
    merged.push({ ...s })
  }
  return merged
}

/** 段判定:会话创建时刻落在哪一段;区间左闭右开,首段无下界、末段无上界 */
export function segmentForTime(segments: TimelineSegment[], iso: string): TimelineSegment | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  for (const s of segments) {
    const startMs = s.start === null ? null : Date.parse(s.start)
    const endMs = s.end === null ? null : Date.parse(s.end)
    if (startMs !== null && !Number.isFinite(startMs)) continue
    if (endMs !== null && !Number.isFinite(endMs)) continue
    if ((startMs === null || ms >= startMs) && (endMs === null || ms < endMs)) return s
  }
  return null
}

/** rebuild --auto:按时间线段判定归属;manual 保留;不可判段/段外/无时刻证据 ⇒ null */
export function planRebuildFromTimeline(
  ledger: SessionLinksLedger,
  segments: TimelineSegment[],
  conversations: string[],
  times: Record<string, string | null>,
  now = new Date(),
): LinksPlan {
  if (segments.length === 0)
    throw new Error('账号时间线为空:快照库无可用快照,无法自动推导(先产生一份登录态快照)')
  const accounts: LedgerAccount[] = [...ledger.accounts]
  for (const seg of segments) {
    if (!seg.accountId) continue
    const i = accounts.findIndex((a) => a.accountId === seg.accountId)
    if (i === -1) {
      accounts.push({ accountId: seg.accountId, label: seg.label, since: seg.start ?? '' })
    } else {
      const prev = accounts[i]!
      accounts[i] = {
        accountId: prev.accountId,
        label: seg.label || prev.label,
        since: prev.since || seg.start || '',
      }
    }
  }
  const links: Record<string, LinkEntry> = { ...ledger.links }
  const changes: string[] = []
  const warnings: string[] = []
  const nowIso = now.toISOString()
  for (const conv of conversations) {
    const prev = ledger.links[conv]
    if (prev?.linkedBy === 'manual') continue
    const t = times[conv] ?? null
    let accountId: string | null = null
    let segmentDesc = ''
    if (t === null) {
      warnings.push(`${conv}: 创建时刻无证据,标未归属`)
    } else {
      const seg = segmentForTime(segments, t)
      if (seg) {
        accountId = seg.accountId
        segmentDesc = `;段 ${seg.start ?? '-∞'}~${seg.end ?? 'now'}`
        if (seg.accountId === null) {
          warnings.push(
            `${conv}: 落在${seg.reason === 'below-earliest' ? '最早快照之前的存量' : '账号不可判'}段,标未归属`,
          )
        }
      } else {
        warnings.push(`${conv}: 落在快照覆盖之外,标未归属`)
      }
    }
    const beforeDesc = prev ? `${prev.accountId ?? '未归属'}(${prev.linkedBy})` : '无记录'
    changes.push(
      `${conv}: ${beforeDesc} → ${accountId ?? '未归属(null)'}` +
        `${t ? `(创建=${t}${segmentDesc})` : '(创建时刻无证据,不猜)'}`,
    )
    links[conv] = { accountId, linkedAt: nowIso, linkedBy: 'auto-since' }
  }
  return { action: 'rebuild', next: { version: 1, accounts, links }, changes, warnings }
}

/** 时间线段的人类可读清单(零 token、手机号打码) */
export function formatTimeline(segments: TimelineSegment[]): string[] {
  return segments.map((s, i) => {
    const short = s.accountId ? s.accountId.slice(0, 8) : ''
    const who = s.accountId
      ? `${short}…${s.label && s.label !== short ? ` ${s.label}` : ''}`
      : s.reason === 'below-earliest'
        ? '(未归属:早于最早快照的存量)'
        : '(未归属:账号不可判)'
    return `  段${i + 1}: ${s.start ?? '-∞'} ~ ${s.end ?? 'now'}  → ${who}`
  })
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

/**
 * assign-batch 清单解析:每行一个 conversationId;忽略空行与 `#` 注释行;
 * 按首次出现顺序去重(同一 id 写两遍不是两条工作)。判据只认逐字节行内容,
 * 不做任何"看起来像 id"的猜测或补全。
 */
export function parseConversationIdList(text: string): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    if (seen.has(line)) continue
    seen.add(line)
    ids.push(line)
  }
  return ids
}

/** 读人工清单文件(不存在/不可读 ⇒ 抛错,由调用侧落 exit 2,绝不回落成"空清单=没事干") */
export function readConversationIdList(file: string): string[] {
  if (!existsSync(file)) throw new Error(`清单文件不存在: ${file}`)
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (err) {
    throw new Error(`清单文件不可读(${file}): ${(err as Error).message}`)
  }
  return parseConversationIdList(text)
}

export interface BatchAssignPlan extends LinksPlan {
  action: 'assign'
  /** 逐条跳过原因(点名到 id;不阻断其余) */
  skipped: string[]
  /** 清单有效行数(去重后) */
  listedCount: number
}

/**
 * assign-batch 计划(纯函数,不写盘)。
 * 安全点(方案 A 红线·绝不机器猜):
 * - 账号必须已在台账(accounts 原样带出,一个都不新增),前缀不唯一/不存在由
 *   `resolveAccountId` 抛错拒绝对整个批次动手;
 * - 逐条校验会话可验证存在(台账链接集 ∪ 物理盘点集),验证不过 ⇒ 跳过并点名,
 *   **不写入任何一条凭空的归属**;
 * - 写入的 linkedBy 恒为 'manual'(这是人的清单动作,不是机器推断);
 * - 清单外的台账行一律原样保留,既不清空也不改 linkedBy。
 */
export function planAssignBatch(
  ledger: SessionLinksLedger,
  rawAccountId: string,
  conversationIds: string[],
  existingConversations: ReadonlySet<string>,
  now = new Date(),
): BatchAssignPlan {
  if (!rawAccountId) throw new Error('缺少 --account <id>')
  if (conversationIds.length === 0) throw new Error('清单为空(没有有效的 conversationId 行)')
  const accountId = resolveAccountId(ledger, rawAccountId)
  const links = { ...ledger.links }
  const changes: string[] = []
  const skipped: string[] = []
  const notes: string[] = []
  const nowIso = now.toISOString()
  for (const conv of conversationIds) {
    const inLedger = conv in ledger.links
    const onDisk = existingConversations.has(conv)
    if (!inLedger && !onDisk) {
      skipped.push(
        `${conv}: 台账无此会话记录且物理盘点不到 ⇒ 拒绝写入(不凭空 assign;先 rebuild 盘点或核对清单)`,
      )
      continue
    }
    if (inLedger && !onDisk)
      notes.push(`${conv}: 台账有记录但本次盘点未命中(按人工清单照标,请复核该会话是否已删)`)
    const prev = ledger.links[conv]
    const beforeDesc = prev ? `${prev.accountId ?? '未归属'}(${prev.linkedBy})` : '无记录'
    changes.push(`${conv}: ${beforeDesc} → ${accountId}(manual)`)
    links[conv] = { accountId, linkedAt: nowIso, linkedBy: 'manual' }
  }
  return {
    action: 'assign',
    next: { version: 1, accounts: ledger.accounts, links },
    changes,
    warnings: [...skipped.map((s) => `跳过 ${s}`), ...notes],
    skipped,
    listedCount: conversationIds.length,
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
  const lockPath = join(dirname(paths.ledgerFile), SESSION_LINKS_LOCK_NAME)
  let lock: { release: () => void } | null = null
  try {
    if (apply && cmd !== undefined && cmd !== 'list') {
      lock = acquireSessionLock(lockPath, `session-links ${cmd}`)
    }
    if (cmd === undefined || cmd === 'list') {
      console.log(formatLedgerList(loadLedger(paths.ledgerFile), paths))
      console.log(
        '\n写操作用法: rebuild(--auto 自动推导 / --since+--account 手工)/ assign / assign-batch(--file 人工清单)/ unassign(默认 dry-run,加 --apply 才写台账)',
      )
      return 0
    }
    const ledger = loadLedger(paths.ledgerFile) ?? emptyLedger()
    let plan: LinksPlan
    if (cmd === 'rebuild') {
      const auto = argv.includes('--auto')
      const since = getFlag(argv, '--since')
      const account = getFlag(argv, '--account')
      const label = getFlag(argv, '--label')
      if (auto && (since !== undefined || account !== undefined)) {
        console.error('--auto 与 --since/--account 互斥:自动推导不需要手填时刻/账号')
        return 2
      }
      const scan = scanConversationIds(paths.sessionsRoot, paths.projectsRoot)
      if (auto) {
        const snapshotDir =
          getFlag(argv, '--snapshot-dir') ?? join(homedir(), '.wb-switch', 'backups')
        const authFileFlag = getFlag(argv, '--auth-file')
        const authFile =
          authFileFlag ?? resolveAuthFileCandidates().find((p) => existsSync(p)) ?? null
        const snap = scanSnapshotAccounts(snapshotDir)
        if (snap.entries.length === 0) {
          console.error(
            `快照库无 workbuddy-desktop.*.info: ${snapshotDir};无法推导账号时间线(先产生一份登录态快照)`,
          )
          return 2
        }
        const meta = authFile ? readAccountMeta(authFile) : { accountId: null, label: '' }
        if (!meta.accountId) {
          console.error(
            `当前登录态账号不可判(${authFile ?? '未找到 auth 文件'}),拒绝写出台账;` +
              '可用 --auth-file <路径> 指定当前登录态文件',
          )
          return 2
        }
        const trustEarliest = argv.includes('--trust-earliest')
        const segments = deriveAccountTimeline(
          snap.entries,
          { accountId: meta.accountId, label: meta.label },
          { trustEarliest },
        )
        const earliestAccount = snap.entries.find((e) => e.accountId)?.accountId ?? null
        const hints: string[] = []
        if (!trustEarliest && earliestAccount) {
          hints.push(
            `  提示: 最早快照(${snap.entries[0]!.ts})之前的存量默认标未归属(方案 A 不猜);` +
              `若确认该时段一直使用 ${earliestAccount.slice(0, 8)}…,加 --trust-earliest 归它`,
          )
        }
        console.log('== 账号时间线(从登录态快照库自动推导) ==')
        console.log(
          [...formatTimeline(segments), ...hints, ...snap.warnings.map((w) => `  ⚠ ${w}`)].join(
            '\n',
          ),
        )
        plan = planRebuildFromTimeline(ledger, segments, scan.conversations, scan.times)
      } else {
        if (!since || !account) {
          console.error(
            'rebuild 需要 --since <ISO> --account <id>([--label <名>]),或 --auto 自动推导',
          )
          return 2
        }
        plan = planRebuild(
          ledger,
          { since, accountId: account, label },
          scan.conversations,
          scan.times,
        )
      }
    } else if (cmd === 'assign') {
      const conv = getFlag(argv, '--conversation')
      const account = getFlag(argv, '--account')
      if (!conv || !account) {
        console.error('assign 需要 --conversation <id> --account <id>')
        return 2
      }
      plan = planAssign(ledger, conv, account)
    } else if (cmd === 'assign-batch') {
      const file = getFlag(argv, '--file')
      const account = getFlag(argv, '--account')
      if (!file || !account) {
        console.error(
          'assign-batch 需要 --file <清单路径> --account <id>(清单每行一个 conversationId)',
        )
        return 2
      }
      // 清单读不到 / 账号不在台账(含前缀不唯一)/ 空清单 ⇒ 整批拒绝,退出码 2,不写任何路径
      let batch: BatchAssignPlan
      try {
        const ids = readConversationIdList(file)
        const scan = scanConversationIds(paths.sessionsRoot, paths.projectsRoot)
        batch = planAssignBatch(ledger, account, ids, new Set(scan.conversations))
      } catch (err) {
        console.error(`assign-batch 拒绝执行: ${(err as Error).message}`)
        return 2
      }
      plan = batch
      console.log(
        `清单: ${file}(有效 ${batch.listedCount} 行,逐条来自文件,机器不做任何推断;` +
          `命中 ${batch.changes.length} 条,跳过 ${batch.skipped.length} 条)`,
      )
    } else if (cmd === 'unassign') {
      const conv = getFlag(argv, '--conversation')
      if (!conv) {
        console.error('unassign 需要 --conversation <id>')
        return 2
      }
      plan = planUnassign(ledger, conv)
    } else {
      console.error(
        `未知子命令: ${String(cmd)}(可用: list / rebuild / assign / assign-batch / unassign)`,
      )
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
  } finally {
    lock?.release()
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
