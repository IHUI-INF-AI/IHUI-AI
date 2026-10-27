// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 单会话搬移/隔离(⑦第二刀·搬移腿,2026-10-27 立,最小粒度单会话·逐条可撤)。
 *
 *   pnpm relay:session-move move    --conversation <id> [--apply]
 *   pnpm relay:session-move restore --conversation <id> [--apply]
 *   pnpm relay:session-move undo    --op <n>            [--apply]
 *   pnpm relay:session-move ops
 *
 * 语义:把一个会话(sessions/<conv>/ 整目录 + projects/<ws>/<conv>.* 关联转写)
 * 按台账归属物理隔离到 ~/.wb-switch/buckets/<accountId>/(镜像原目录结构),或移回原位。
 *
 * 红线(docs/RELAY_SESSION_MIGRATION_DESIGN.md §2,违一即停):
 * - 备份先行:动库前校验 ~/.wb-switch/backups/sessions/ 下当日 manifest 存在
 *   (且 source 根与本机会话库一致);没有则要求先跑 pnpm relay:sessions:backup,不自动代跑;
 * - 预览先行:默认 dry-run 列将动文件清单(路径+字节,零内容),真动必须 --apply;
 * - 逐条可撤:每轮写操作追加 ~/.wb-switch/relay/move_ops.jsonl(动前动后路径+sha256,零内容),
 *   undo --op <n> 按日志单条回退;
 * - 校验后收工:逐文件先写临时名 → sha256 校验 → 原子改名 → 全量对账,对不上即停;
 * - 绝不删除文件:搬移=移动(源侧移除是移动语义,undo 可回),undo=移回。
 * - 会话不存在 / 台账未归属(accountId=null)→ 拒绝搬移并明说。
 */

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { computeBackupPlan, type BackupManifest } from './relay-session-backup.js'
import { loadLedger, type SessionLinksLedger } from './relay-session-links.js'

/** 搬移器全部路径面(默认本机真实面;测试注入临时目录,绝不碰真实会话库) */
export interface MovePaths {
  sessionsRoot: string
  projectsRoot: string
  /** 账号桶根 ~/.wb-switch/buckets */
  bucketsRoot: string
  /** 会话库快照库 ~/.wb-switch/backups/sessions */
  backupsSessionsDir: string
  /** 操作日志 ~/.wb-switch/relay/move_ops.jsonl */
  opsLogFile: string
  /** 关联台账 ~/.wb-switch/relay/session_links.json */
  ledgerFile: string
}

export function defaultMovePaths(home = homedir()): MovePaths {
  return {
    sessionsRoot: join(home, '.workbuddy', 'workspace', 'sessions'),
    projectsRoot: join(home, '.workbuddy', 'projects'),
    bucketsRoot: join(home, '.wb-switch', 'buckets'),
    backupsSessionsDir: join(home, '.wb-switch', 'backups', 'sessions'),
    opsLogFile: join(home, '.wb-switch', 'relay', 'move_ops.jsonl'),
    ledgerFile: join(home, '.wb-switch', 'relay', 'session_links.json'),
  }
}

function sha256Of(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function sha256OfPath(p: string): string {
  return sha256Of(readFileSync(p))
}

/** 一个会话在两面的全部落点(只读盘点) */
export interface ConversationFiles {
  conversationId: string
  /** sessions/<conv>/ 目录(可能不存在) */
  sessionDir: string | null
  /** 该目录下全部文件(相对 sessionDir) */
  sessionRelFiles: string[]
  /** sessions/<conv>/ 下子目录(搬移后清空移除,只 rmdir 空目录) */
  sessionSubDirs: string[]
  /** projects/<ws>/ 下 <conv>.* 关联文件(.jsonl/.meta.json/.file-rollback.ndjson)绝对路径 */
  projectFiles: string[]
}

/** 收集一个目录树全部文件与子目录(相对路径,POSIX 斜杠) */
function walkRel(root: string): { files: string[]; dirs: string[] } {
  const files: string[] = []
  const dirs: string[] = []
  const walk = (dir: string, base: string): void => {
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch {
      return
    }
    for (const name of names) {
      const p = join(dir, name)
      const rel = base ? `${base}/${name}` : name
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        dirs.push(rel)
        walk(p, rel)
      } else if (st.isFile()) files.push(rel)
    }
  }
  walk(root, '')
  return { files, dirs }
}

/**
 * 盘点一个会话的物理落点(纯只读)。关联键(2026-10-27 真实数据核实):
 * projects/<ws>/<conversationId>.jsonl 文件名主干 = sessions/<conversationId>/ 目录名;
 * sidecar <conv>.meta.json / <conv>.file-rollback.ndjson 随搬。
 */
export function findConversationFiles(
  conversationId: string,
  sessionsRoot: string,
  projectsRoot: string,
): ConversationFiles {
  const sessionDir = join(sessionsRoot, conversationId)
  const hasSessionDir = existsSync(sessionDir) && statSync(sessionDir).isDirectory()
  let sessionRelFiles: string[] = []
  let sessionSubDirs: string[] = []
  if (hasSessionDir) {
    const w = walkRel(sessionDir)
    sessionRelFiles = w.files
    sessionSubDirs = w.dirs.sort((a, b) => b.length - a.length) // 深的先 rmdir
  }
  const projectFiles: string[] = []
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
      let names: string[]
      try {
        names = readdirSync(wsDir)
      } catch {
        continue
      }
      for (const n of names) {
        // <conv>. 前缀带点边界,不会误吞其他 uuid;只扫工作区顶层(subagents 非会话本体现不扫)
        if (n.startsWith(`${conversationId}.`)) {
          const abs = join(wsDir, n)
          try {
            if (statSync(abs).isFile()) projectFiles.push(abs)
          } catch {
            /* 竞态消失跳过 */
          }
        }
      }
    }
  }
  return {
    conversationId,
    sessionDir: hasSessionDir ? sessionDir : null,
    sessionRelFiles,
    sessionSubDirs,
    projectFiles,
  }
}

/** 备份先行:当日(UTC 同日)且 source 根与本机一致的 manifest;没有返回 null */
export function findTodaySnapshot(
  backupsSessionsDir: string,
  sessionsRoot: string,
  projectsRoot: string,
  now: Date,
): { dir: string; manifest: BackupManifest } | null {
  if (!existsSync(backupsSessionsDir)) return null
  const day = now.toISOString().slice(0, 10)
  let best: { dir: string; manifest: BackupManifest } | null = null
  for (const name of readdirSync(backupsSessionsDir)) {
    const dir = join(backupsSessionsDir, name)
    const mf = join(dir, 'manifest.json')
    if (!existsSync(mf)) continue
    let m: Record<string, unknown>
    try {
      m = JSON.parse(readFileSync(mf, 'utf8')) as Record<string, unknown>
    } catch {
      continue
    }
    const createdAt = m['createdAt']
    if (typeof createdAt !== 'string' || createdAt.slice(0, 10) !== day) continue
    const src = (m['source'] ?? {}) as Record<string, unknown>
    if (src['sessionsRoot'] !== sessionsRoot || src['projectsRoot'] !== projectsRoot) continue
    const manifest = m as unknown as BackupManifest
    if (!best || createdAt > best.manifest.createdAt) best = { dir, manifest }
  }
  return best
}

/** ops.jsonl 单条:零内容,只有路径/字节/sha */
export interface MoveOpFileEntry {
  from: string
  to: string
  bytes: number
  sha256: string
}

export interface MoveOp {
  ts: string
  type: 'move' | 'restore' | 'undo'
  conversationId: string | null
  accountId: string | null
  /** undo 时指向被回退的 op 行号(1 起) */
  refOp?: number
  entries: MoveOpFileEntry[]
}

export function appendOps(opsLogFile: string, op: MoveOp): void {
  mkdirSync(dirname(opsLogFile), { recursive: true })
  writeFileSync(opsLogFile, `${JSON.stringify(op)}\n`, { flag: 'a' })
}

export function readOps(opsLogFile: string): MoveOp[] {
  if (!existsSync(opsLogFile)) return []
  const out: MoveOp[] = []
  for (const line of readFileSync(opsLogFile, 'utf8').split('\n')) {
    if (line.trim() === '') continue
    try {
      out.push(JSON.parse(line) as MoveOp)
    } catch {
      /* 坏行跳过(日志只追加,不因半行坏数据卡死) */
    }
  }
  return out
}

export interface MovePlanFile extends MoveOpFileEntry {
  /** workspace/sessions → workspace/ 前缀;projects → 相对根,与备份 manifest rel 同系 */
  backupRel: string
}

export interface MovePlan {
  mode: 'move' | 'restore'
  conversationId: string
  accountId: string
  /** 当日快照目录(备份数据可回退的载体) */
  snapshotDir: string
  files: MovePlanFile[]
  /** 转移后从源侧上溯移除"变空的目录",到此边界为止(move/restore/undo 各自给) */
  stopDirs: string[]
  totalBytes: number
  warnings: string[]
}

/** 桶内镜像落点:workspace/sessions/<conv>/… 与 projects/<ws>/<file> 原样相对结构 */
function bucketDestFor(
  srcAbs: string,
  accountId: string,
  conversationId: string,
  paths: MovePaths,
): string {
  const sessionsPrefix = join(paths.sessionsRoot, conversationId) + sep
  if (srcAbs.startsWith(sessionsPrefix)) {
    return join(
      paths.bucketsRoot,
      accountId,
      'workspace',
      'sessions',
      conversationId,
      relative(sessionsPrefix, srcAbs),
    )
  }
  const relToProjects = relative(paths.projectsRoot, srcAbs)
  return join(paths.bucketsRoot, accountId, 'projects', relToProjects)
}

/** 备份 manifest rel(与 relay-session-backup.ts 同系:workspace/ 前缀归会话库) */
function toBackupRel(srcAbs: string, paths: MovePaths): string {
  if (srcAbs.startsWith(paths.sessionsRoot + sep) || srcAbs.startsWith(paths.sessionsRoot + '/')) {
    return 'workspace/' + relative(paths.sessionsRoot, srcAbs).split(sep).join('/')
  }
  return relative(paths.projectsRoot, srcAbs).split(sep).join('/')
}

/**
 * 批量搬移共享上下文(2026-10-27 增,治批量下每会话重扫全库的 O(n²)):
 * 当日快照与"当前库 rel→sha 表"由调用方算一次;不传则 planMove 自算(单会话老路径零变化)。
 */
export interface MovePlanContext {
  snapshot: { dir: string; manifest: BackupManifest }
  currentRels: Map<string, string>
}

/** 当前会话库 rel→sha 表(快照覆盖核对用;批量时算一次共享) */
function currentRelsOf(paths: MovePaths, now: Date): Map<string, string> {
  const current = computeBackupPlan(paths.sessionsRoot, paths.projectsRoot, now)
  const m = new Map<string, string>()
  for (const f of current.files) m.set(f.rel, f.sha256)
  return m
}

/**
 * move 计划(纯只读)。拒绝场景(都明说,不猜不做):
 * 快照缺失 / 会话不存在 / 台账缺失或无记录 / 未归属(null) / 账号不在 accounts / 桶内同名冲突。
 * 另借 computeBackupPlan 与当日 manifest 比对,给出"快照未覆盖/已漂移"告警(只告警不拒)。
 */
export function planMove(
  conversationId: string,
  paths: MovePaths,
  now: Date,
  shared?: MovePlanContext,
): MovePlan {
  if (!conversationId) throw new Error('缺少 --conversation <id>')
  const snap =
    shared?.snapshot ??
    findTodaySnapshot(paths.backupsSessionsDir, paths.sessionsRoot, paths.projectsRoot, now)
  if (!snap) {
    throw new Error(
      `当日会话库快照缺失(${paths.backupsSessionsDir} 下无 createdAt=${now.toISOString().slice(0, 10)} 且 source 根匹配的 manifest)。` +
        '先跑 pnpm relay:sessions:backup --apply,备份数据是回退能力的载体;本器不自动代跑。',
    )
  }
  const cf = findConversationFiles(conversationId, paths.sessionsRoot, paths.projectsRoot)
  if (cf.sessionRelFiles.length === 0 && cf.projectFiles.length === 0) {
    throw new Error(`会话不存在: ${conversationId}(sessions/ 与 projects/ 两面均无落点)`)
  }
  const stopDirs = [paths.sessionsRoot, paths.projectsRoot, paths.bucketsRoot]
  const ledger = loadLedger(paths.ledgerFile)
  if (!ledger)
    throw new Error(`台账不存在: ${paths.ledgerFile}。先跑 pnpm relay:session-links rebuild`)
  const link = ledger.links[conversationId]
  if (!link) {
    throw new Error(`台账中无此会话记录: ${conversationId}。先跑 pnpm relay:session-links rebuild`)
  }
  if (link.accountId === null) {
    throw new Error(
      `会话未归属(accountId=null,linkedBy=${link.linkedBy}):拒绝搬移。` +
        '存量未归属会话先人工 assign 明确归属,再搬。',
    )
  }
  if (!ledger.accounts.some((a) => a.accountId === link.accountId)) {
    throw new Error(`台账链接指向的账号不在 accounts 里: ${link.accountId}(台账不一致,拒绝)`)
  }
  const accountId = link.accountId
  const warnings: string[] = []
  const files: MovePlanFile[] = []
  const sources = [
    ...cf.sessionRelFiles.map((rel) => join(cf.sessionDir!, ...rel.split('/'))),
    ...cf.projectFiles,
  ]
  for (const src of sources) {
    const to = bucketDestFor(src, accountId, conversationId, paths)
    if (existsSync(to)) {
      throw new Error(`桶内同名落点已存在,拒绝覆盖: ${to}(若为重复搬移请走 restore/undo)`)
    }
    let bytes = 0
    let sha = ''
    try {
      bytes = statSync(src).size
      sha = sha256OfPath(src)
    } catch (err) {
      throw new Error(`源文件不可读: ${src}: ${(err as Error).message}`)
    }
    files.push({ from: src, to, bytes, sha256: sha, backupRel: toBackupRel(src, paths) })
  }
  files.sort((a, b) => a.from.localeCompare(b.from))
  // 快照覆盖核对:借 computeBackupPlan 盘当前源 + 当日 manifest rel→sha 对账(只读)
  const currentMap = shared?.currentRels ?? currentRelsOf(paths, now)
  const manifestMap = new Map<string, string>()
  for (const f of snap.manifest.files) manifestMap.set(f.rel, f.sha256)
  for (const f of files) {
    if (!manifestMap.has(f.backupRel)) {
      warnings.push(`当日快照未覆盖 ${f.backupRel}(快照后新产生,回退口径以 ops 日志为准)`)
    } else if (manifestMap.get(f.backupRel) !== f.sha256) {
      warnings.push(`快照后内容已漂移: ${f.backupRel}(搬移的是当前内容,undo 按 ops 日志回退)`)
    } else if (!currentMap.has(f.backupRel) || currentMap.get(f.backupRel) !== f.sha256) {
      warnings.push(`源在计划后可能变动: ${f.backupRel}`)
    }
  }
  return {
    mode: 'move',
    conversationId,
    accountId,
    snapshotDir: snap.dir,
    files,
    stopDirs,
    totalBytes: files.reduce((s, f) => s + f.bytes, 0),
    warnings,
  }
}

export interface BatchMoveSkip {
  conversationId: string
  reason: string
}

export interface BatchMovePlan {
  accountId: string
  plans: MovePlan[]
  skipped: BatchMoveSkip[]
  totalFiles: number
  totalBytes: number
  warnings: string[]
}

/** 账号前缀解析(完整 id 或唯一前缀;不唯一/不存在都拒绝,不猜) */
export function resolveAccountId(ledger: SessionLinksLedger, raw: string): string {
  const exact = ledger.accounts.find((a) => a.accountId === raw)
  if (exact) return exact.accountId
  const hits = ledger.accounts.filter((a) => a.accountId.startsWith(raw))
  if (hits.length === 1) return hits[0]!.accountId
  if (hits.length > 1)
    throw new Error(
      `账号前缀不唯一: ${raw} → ${hits.map((h) => h.accountId.slice(0, 8)).join(', ')}`,
    )
  throw new Error(`账号不在台账: ${raw}(先跑 pnpm relay:session-links rebuild --auto)`)
}

/**
 * 按账号批量搬移计划(纯只读)。只取台账 accountId 精确等于该账号的会话;
 * 未归属(null)与别的账号一律不碰。逐会话独立:单个被拒(已搬走/桶内冲突)只跳过并点名,
 * 不阻断其余——每条搬移各自记账、各自 undo。
 */
export function planBatchMove(rawAccountId: string, paths: MovePaths, now: Date): BatchMovePlan {
  const ledger = loadLedger(paths.ledgerFile)
  if (!ledger)
    throw new Error(`台账不存在: ${paths.ledgerFile}。先跑 pnpm relay:session-links rebuild --auto`)
  const accountId = resolveAccountId(ledger, rawAccountId)
  const convs = Object.entries(ledger.links)
    .filter(([, l]) => l.accountId === accountId)
    .map(([c]) => c)
    .sort()
  const snap = findTodaySnapshot(
    paths.backupsSessionsDir,
    paths.sessionsRoot,
    paths.projectsRoot,
    now,
  )
  if (!snap) {
    throw new Error(
      `当日会话库快照缺失(${paths.backupsSessionsDir})。先跑 pnpm relay:sessions:backup --apply,备份数据是回退能力的载体;本器不自动代跑。`,
    )
  }
  const shared: MovePlanContext = { snapshot: snap, currentRels: currentRelsOf(paths, now) }
  const plans: MovePlan[] = []
  const skipped: BatchMoveSkip[] = []
  for (const conv of convs) {
    try {
      plans.push(planMove(conv, paths, now, shared))
    } catch (err) {
      skipped.push({ conversationId: conv, reason: (err as Error).message })
    }
  }
  return {
    accountId,
    plans,
    skipped,
    totalFiles: plans.reduce((s, p) => s + p.files.length, 0),
    totalBytes: plans.reduce((s, p) => s + p.totalBytes, 0),
    warnings: plans.flatMap((p) => p.warnings).slice(0, 20),
  }
}

export function formatBatchPlan(b: BatchMovePlan, dryRun: boolean): string {
  const lines: string[] = []
  lines.push(`按账号批量搬移 · ${dryRun ? '预览(dry-run;加 --apply 才动库)' : '执行'}`)
  lines.push(`归属账号: ${b.accountId}`)
  lines.push(`将搬 ${b.plans.length} 个会话,共 ${b.totalFiles} 个文件 / ${b.totalBytes} 字节`)
  for (const p of b.plans.slice(0, 20)) {
    lines.push(`  ${p.conversationId}  ${p.files.length} 文件 ${p.totalBytes}B`)
  }
  if (b.plans.length > 20) lines.push(`  …其余 ${b.plans.length - 20} 个会话同批`)
  if (b.skipped.length > 0) {
    lines.push(`跳过 ${b.skipped.length} 个(逐条独立,不影响其余):`)
    for (const s of b.skipped.slice(0, 10)) lines.push(`  ${s.conversationId}: ${s.reason}`)
    if (b.skipped.length > 10) lines.push(`  …其余 ${b.skipped.length - 10} 条`)
  }
  for (const w of b.warnings) lines.push(`  ⚠ ${w}`)
  return lines.join('\n')
}

/**
 * restore 计划:桶内镜像 → 原位。归属从台账读;台账无记录则在桶里找唯一持有者。
 * 目标已在位且 sha 一致 ⇒ 跳过拷贝只移除桶内副本;sha 不一致 ⇒ 拒绝(宁可拒做)。
 */
export function planRestore(conversationId: string, paths: MovePaths, now: Date): MovePlan {
  if (!conversationId) throw new Error('缺少 --conversation <id>')
  const snap = findTodaySnapshot(
    paths.backupsSessionsDir,
    paths.sessionsRoot,
    paths.projectsRoot,
    now,
  )
  if (!snap) {
    throw new Error(
      `当日会话库快照缺失,先跑 pnpm relay:sessions:backup --apply(${paths.backupsSessionsDir})`,
    )
  }
  const ledger = loadLedger(paths.ledgerFile)
  const linked = ledger?.links[conversationId]?.accountId ?? null
  let accountId: string | null = linked
  if (!accountId) {
    // 桶里唯一持有者兜底(台账可能已清,桶结构本身携带归属)
    if (!existsSync(paths.bucketsRoot))
      throw new Error(`桶根不存在: ${paths.bucketsRoot};桶内无此会话`)
    for (const acct of readdirSync(paths.bucketsRoot)) {
      const hasSession = existsSync(
        join(paths.bucketsRoot, acct, 'workspace', 'sessions', conversationId),
      )
      let hasTranscript = false
      const bucketProjects = join(paths.bucketsRoot, acct, 'projects')
      if (existsSync(bucketProjects)) {
        for (const ws of readdirSync(bucketProjects)) {
          if (existsSync(join(bucketProjects, ws, `${conversationId}.jsonl`))) {
            hasTranscript = true
            break
          }
        }
      }
      if (hasSession || hasTranscript) {
        if (accountId && accountId !== acct) {
          throw new Error(`多个桶都含此会话(${accountId} / ${acct}),归属不明,拒绝`)
        }
        accountId = acct
      }
    }
  }
  if (!accountId) throw new Error(`桶内找不到会话: ${conversationId},无法回移`)
  const bucketSessions = join(paths.bucketsRoot, accountId, 'workspace', 'sessions', conversationId)
  const bucketProjects = join(paths.bucketsRoot, accountId, 'projects')
  const warnings: string[] = []
  const files: MovePlanFile[] = []
  const addEntry = (from: string, to: string): void => {
    const st = statSync(from)
    files.push({
      from,
      to,
      bytes: st.size,
      sha256: sha256OfPath(from),
      backupRel: toBackupRel(to, paths),
    })
  }
  if (existsSync(bucketSessions)) {
    const w = walkRel(bucketSessions)
    for (const rel of w.files) {
      addEntry(
        join(bucketSessions, ...rel.split('/')),
        join(paths.sessionsRoot, conversationId, ...rel.split('/')),
      )
    }
  }
  if (existsSync(bucketProjects)) {
    for (const ws of readdirSync(bucketProjects)) {
      const wsDir = join(bucketProjects, ws)
      if (!statSync(wsDir).isDirectory()) continue
      for (const n of readdirSync(wsDir)) {
        if (n.startsWith(`${conversationId}.`)) {
          addEntry(join(wsDir, n), join(paths.projectsRoot, ws, n))
        }
      }
    }
  }
  if (files.length === 0)
    throw new Error(`桶内无此会话: ${conversationId}(桶=${join(paths.bucketsRoot, accountId)})`)
  for (const f of files) {
    if (existsSync(f.to) && sha256OfPath(f.to) !== f.sha256) {
      throw new Error(`原位已存在且内容不同,宁可拒做: ${f.to}(先人工确认)`)
    }
    if (existsSync(f.to)) warnings.push(`原位已在且 sha 一致,将只移除桶内副本: ${f.to}`)
  }
  files.sort((a, b) => a.from.localeCompare(b.from))
  return {
    mode: 'restore',
    conversationId,
    accountId,
    snapshotDir: snap.dir,
    files,
    stopDirs: [paths.sessionsRoot, paths.projectsRoot, paths.bucketsRoot],
    totalBytes: files.reduce((s, f) => s + f.bytes, 0),
    warnings,
  }
}

/** undo 计划:按日志第 n 条(1 起)原路回退 */
export function planUndo(
  opsLogFile: string,
  opNum: number,
  stopDirs: string[] = [],
): { op: MoveOp; plan: MovePlan } {
  const ops = readOps(opsLogFile)
  const op = ops[opNum - 1]
  if (!op) throw new Error(`ops 日志无第 ${opNum} 条(现存 ${ops.length} 条)`)
  const reverse: MovePlanFile[] = op.entries.map((e) => ({
    from: e.to,
    to: e.from,
    bytes: e.bytes,
    sha256: e.sha256,
    backupRel: '',
  }))
  const plan: MovePlan = {
    mode: op.type === 'move' ? 'restore' : 'move',
    conversationId: op.conversationId ?? '(未知)',
    accountId: op.accountId ?? '(未知)',
    snapshotDir: '(undo 按 ops 日志回退,不另查快照)',
    files: reverse,
    stopDirs,
    totalBytes: reverse.reduce((s, f) => s + f.bytes, 0),
    warnings: [],
  }
  return { op, plan }
}

/**
 * 执行一批文件转移(仅 --apply 路径可达):逐文件
 * 读源 → sha 对账 → (目标已存在且 sha 一致则跳拷) → 写 `<目标>.moving-<ts>` 临时名 →
 * 校验 → 原子改名 → 全量对账 → 对账过后移除源侧(移动语义,undo 可回)→ 清空目录 rmdir。
 * 任一环对不上即整批停,已改名落地的保留并随错误抛出。
 */
export function applyTransfers(plan: MovePlan): { moved: MoveOpFileEntry[]; skipped: string[] } {
  const ts = Date.now()
  const moved: MoveOpFileEntry[] = []
  const skipped: string[] = []
  const failures: string[] = []
  for (const f of plan.files) {
    try {
      const buf = readFileSync(f.from)
      const srcSha = sha256Of(buf)
      if (srcSha !== f.sha256) {
        failures.push(`${f.from}: 源内容与计划不一致(sha256 漂移)`)
        continue
      }
      if (existsSync(f.to)) {
        if (sha256OfPath(f.to) === f.sha256) {
          skipped.push(f.to)
        } else {
          failures.push(`${f.to}: 目标已存在且内容不同,拒绝覆盖`)
          continue
        }
      } else {
        mkdirSync(dirname(f.to), { recursive: true })
        const tmp = `${f.to}.moving-${ts}`
        writeFileSync(tmp, buf)
        if (sha256OfPath(tmp) !== f.sha256) {
          failures.push(`${f.to}: 临时文件校验不过`)
          continue
        }
        renameSync(tmp, f.to)
      }
      moved.push({ from: f.from, to: f.to, bytes: f.bytes, sha256: f.sha256 })
    } catch (err) {
      failures.push(`${f.from}: ${(err as Error).message}`)
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `转移未完成: ${failures.length} 个失败(已落地 ${moved.length} 个保留,可按 ops 日志回退):\n` +
        failures.slice(0, 10).join('\n'),
    )
  }
  // 全量对账:每个 to 在位且 sha 一致
  for (const e of moved) {
    if (!existsSync(e.to) || sha256OfPath(e.to) !== e.sha256) {
      throw new Error(`收工对账失败: ${e.to} 缺失或 sha 不一致;保留现场,按 ops 处理`)
    }
  }
  // 对账过后才移除源侧(移动语义;源内容已在目标校验过,undo 可回)
  for (const e of moved) {
    if (existsSync(e.from)) unlinkSync(e.from)
  }
  // 上溯清理"变空的源侧目录"(只 rmdir 空目录,ENOTEMPTY 保留;到 stopDirs 边界为止)
  for (const e of moved) {
    let dir = dirname(e.from)
    while (!plan.stopDirs.includes(dir)) {
      try {
        rmdirSync(dir)
      } catch {
        break // 非空或不可移除:保留现场
      }
      dir = dirname(dir)
    }
  }
  return { moved, skipped }
}

export function formatPlan(plan: MovePlan, dryRun: boolean): string {
  const lines: string[] = []
  lines.push(
    `会话${plan.mode === 'move' ? '搬移' : '回移'} · ${dryRun ? '预览(dry-run;加 --apply 才动库)' : '执行'}`,
  )
  lines.push(`会话: ${plan.conversationId}  归属桶: ${plan.accountId}`)
  lines.push(`当日快照: ${plan.snapshotDir}`)
  lines.push(`将动 ${plan.files.length} 个文件,共 ${plan.totalBytes} 字节`)
  const shown = plan.files.slice(0, 15)
  for (const f of shown) {
    lines.push(`  ${f.from}\n    → ${f.to} (${f.bytes}B, sha:${f.sha256.slice(0, 12)})`)
  }
  if (plan.files.length > shown.length) {
    lines.push(`  …其余 ${plan.files.length - shown.length} 个文件同批`)
  }
  for (const w of plan.warnings) lines.push(`  ⚠ ${w}`)
  return lines.join('\n')
}

function getFlag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

/**
 * 客户端存续探测(2026-10-27 增):WorkBuddy 运行时会话文件可能被占用或正在写,
 * 搬移会半写/让客户端内存态与磁盘不一致。只读探测,绝不杀进程;探测失败按空返回
 * (不误拦非 Windows 环境,但 --apply 仍会因文件被占用而整批报错留现场)。
 */
export function detectWorkbuddyProcesses(): string[] {
  if (process.platform !== 'win32') {
    try {
      const out = execFileSync('pgrep', ['-fl', '[Ww]ork[Bb]uddy'], {
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
        encoding: 'utf8',
      })
      return out
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    } catch {
      return []
    }
  }
  try {
    const out = execFileSync(
      'tasklist',
      ['/FI', 'IMAGENAME eq WorkBuddy.exe', '/FO', 'CSV', '/NH'],
      { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, encoding: 'utf8' },
    )
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => /^"WorkBuddy\.exe"/i.test(s))
  } catch {
    return []
  }
}

export function main(
  argv: string[] = process.argv.slice(2),
  pathsOverride?: MovePaths,
  runningProcsOverride?: string[],
): number {
  const paths = pathsOverride ?? defaultMovePaths()
  const apply = argv.includes('--apply')
  const cmd = argv[0]
  const guardClient = (): number | null => {
    const procs = runningProcsOverride ?? detectWorkbuddyProcesses()
    if (procs.length === 0) return null
    const reason = getFlag(argv, '--force-running-reason')?.trim()
    if (reason !== undefined && reason.length >= 10) {
      console.error(
        `⚠ 客户端仍在运行(${procs.length} 个进程),已按定向理由放行: ${reason}` +
          '(放行仅对本次调用生效;请确认目标会话未被客户端正在写入)',
      )
      return null
    }
    console.error(
      `检测到 WorkBuddy 客户端正在运行(${procs.length} 个进程):会话文件可能被占用或正在写入,` +
        '搬移会半写。请先退出客户端再 --apply,或给 --force-running-reason "<≥10字定向理由>" ' +
        '明确"已确认目标会话未在写"后放行(本器不替你杀进程;dry-run 不受影响)。',
    )
    return 2
  }
  try {
    if (cmd === undefined || cmd === 'help') {
      console.log(
        '用法:\n' +
          '  relay:session-move move    --conversation <id> [--apply]\n' +
          '  relay:session-move move    --account <id|唯一前缀> [--apply]   # 按账号批量\n' +
          '  relay:session-move restore --conversation <id> [--apply]\n' +
          '  relay:session-move undo    --op <n> [--apply]\n' +
          '  relay:session-move ops\n' +
          '客户端在跑时 --apply 会被拦;确认目标会话未被写入可加\n' +
          '  --force-running-reason "<≥10字定向理由>" 放行(仅本次调用)\n' +
          '默认 dry-run;所有动库动作要求当日会话库快照在位;操作记账 ~/.wb-switch/relay/move_ops.jsonl',
      )
      return 0
    }
    if (cmd === 'ops') {
      const ops = readOps(paths.opsLogFile)
      console.log(`操作日志: ${paths.opsLogFile}(${ops.length} 条)`)
      ops.forEach((op, i) => {
        console.log(
          `  #${i + 1} ${op.ts} ${op.type} conv=${op.conversationId ?? '?'} acct=${op.accountId ?? '?'} ` +
            `files=${op.entries.length} bytes=${op.entries.reduce((s, e) => s + e.bytes, 0)}` +
            `${op.refOp !== undefined ? ` refOp=#${op.refOp}` : ''}`,
        )
      })
      return 0
    }
    let plan: MovePlan
    let opType: MoveOp['type']
    let refOp: number | undefined
    if (cmd === 'move') {
      const conv = getFlag(argv, '--conversation')
      const acct = getFlag(argv, '--account')
      if (conv !== undefined && acct !== undefined) {
        console.error('--conversation 与 --account 互斥(单会话 or 按账号批量,二选一)')
        return 2
      }
      if (conv === undefined && acct === undefined) {
        console.error('move 需要 --conversation <id>,或 --account <id> 按账号批量')
        return 2
      }
      if (acct !== undefined) {
        const batch = planBatchMove(acct, paths, new Date())
        const batchText = formatBatchPlan(batch, !apply)
        if (!apply) {
          console.log(batchText)
          console.log('\n(dry-run;未写入任何路径。确认后加 --apply)')
          return 0
        }
        if (batch.plans.length === 0) {
          console.log(`${batchText}\n\n没有可搬的会话(可能已全在桶内)`)
          return 0
        }
        const blocked = guardClient()
        if (blocked !== null) return blocked
        const done: string[] = []
        const failed: { conversationId: string; error: string }[] = []
        for (const p of batch.plans) {
          try {
            const r = applyTransfers(p)
            appendOps(paths.opsLogFile, {
              ts: new Date().toISOString(),
              type: 'move',
              conversationId: p.conversationId,
              accountId: p.accountId,
              entries: r.moved,
            })
            done.push(p.conversationId)
          } catch (err) {
            failed.push({ conversationId: p.conversationId, error: (err as Error).message })
          }
        }
        console.log(
          `${batchText}\n\n完成: ${done.length} 个会话;失败 ${failed.length} 个` +
            `(已落地部分按 ops 日志逐条可撤)`,
        )
        for (const f of failed.slice(0, 10)) console.error(`  ${f.conversationId}: ${f.error}`)
        return failed.length === 0 ? 0 : 1
      }
      if (conv === undefined) return 2
      plan = planMove(conv, paths, new Date())
      opType = 'move'
    } else if (cmd === 'restore') {
      const conv = getFlag(argv, '--conversation')
      if (!conv) {
        console.error('restore 需要 --conversation <id>')
        return 2
      }
      plan = planRestore(conv, paths, new Date())
      opType = 'restore'
    } else if (cmd === 'undo') {
      const n = Number(getFlag(argv, '--op'))
      if (!Number.isInteger(n) || n < 1) {
        console.error('undo 需要 --op <n>(ops 日志 1 起行号)')
        return 2
      }
      const r = planUndo(paths.opsLogFile, n, [
        paths.sessionsRoot,
        paths.projectsRoot,
        paths.bucketsRoot,
      ])
      refOp = n
      plan = r.plan
      opType = 'undo'
      plan.warnings.push(`回退对象: #${n} ${r.op.type} ${r.op.ts}`)
    } else {
      console.error(`未知子命令: ${cmd}(可用: move / restore / undo / ops / help)`)
      return 2
    }
    const text = formatPlan(plan, !apply)
    if (!apply) {
      console.log(text)
      console.log('\n(dry-run;未写入任何路径。确认后加 --apply)')
      return 0
    }
    const blockedSingle = guardClient()
    if (blockedSingle !== null) return blockedSingle
    const r = applyTransfers(plan)
    appendOps(paths.opsLogFile, {
      ts: new Date().toISOString(),
      type: opType,
      conversationId: plan.conversationId === '(未知)' ? null : plan.conversationId,
      accountId: plan.accountId === '(未知)' ? null : plan.accountId,
      ...(refOp !== undefined ? { refOp } : {}),
      entries: r.moved,
    })
    console.log(
      text +
        `\n\n完成: 落地 ${r.moved.length} 个,跳过(已在位)${r.skipped.length} 个;` +
        `记账 ${paths.opsLogFile}(单条回退: undo --op <n>)`,
    )
    return 0
  } catch (err) {
    console.error(`会话搬移失败(未动库或已按红线留现场): ${(err as Error).message}`)
    return 1
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
