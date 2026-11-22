// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话操作日志运维腿(⑦第三刀·运维卫生,2026-10-27 立:统计 + 受控轮转)。
 *
 *   relay:session-ops stats [--json]
 *   relay:session-ops rotate --keep-days <N> [--apply]
 *   relay:session-ops prune-snapshots --keep <N> [--apply]
 *
 * 立因(2026-10-27 一手):搬移腿把每次操作追加进 ~/.wb-switch/relay/move_ops.jsonl,
 * 恢复腿把留底放在 <快照目录>/restore-ops/,两者都只增不减 —— 长期无限增长,
 * 且此前没有任何量算仪能回答"日志多大、undo 引用了谁、快照留底占多少"。
 *
 * 铁律:
 * - 只读优先:stats / prune-snapshots 永不写盘;rotate 默认 dry-run,只有 --apply 才写。
 * - 零内容回显:输出只出现计数、时刻、路径(操作日志与留底本身就零内容,正文一律不打印)。
 * - 逐条可撤不被破坏:被 undo 记录(MoveOp.refOp)引用的条目永不归档;undo 记录本身
 *   也不归档 —— 它是引用关系的载体,归档它等于让被引用条目在下一轮失去保护。
 * - 未判定不删:ts 不可解析的条目、JSON 坏行一律留在原文件,只报数。
 * - 校验后收工:rotate 先写临时名,回读校验「剩余条数 + 归档条数 == 原条数」才原子改名;
 *   归档文件先落地(中途失败最多重复、绝不丢条目)。
 * - 本器不做删除:prune-snapshots 只列可人工清理的目录(--apply 也不删)——
 *   会话库快照是回退能力的载体,自动删会破坏红线。
 *
 * 退出码:0 成功 / 1 执行失败(现场保留)/ 2 参数错或输入不可判定。
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readOps, readOpsAll, type MoveOp } from './relay-session-move.js'
import { readRestoreOps } from './relay-session-restore.js'
import { acquireSessionLock } from './relay-session-lock.js'

/** 本器用到的两个路径面(默认本机真实面;测试注入临时目录,绝不碰真实会话库) */
export interface OpsPaths {
  /** 搬移腿操作日志 ~/.wb-switch/relay/move_ops.jsonl */
  opsLogFile: string
  /** 会话库快照根 ~/.wb-switch/backups/sessions */
  backupsSessionsDir: string
}

export function defaultOpsPaths(home = homedir()): OpsPaths {
  return {
    opsLogFile: join(home, '.wb-switch', 'relay', 'move_ops.jsonl'),
    backupsSessionsDir: join(home, '.wb-switch', 'backups', 'sessions'),
  }
}

/** 输入不可判定(取不到 / 口径对不齐):按 §0.3 报「未判定」,exit 2,不猜也不动 */
export class UndeterminedInputError extends Error {}

const DAY_MS = 86_400_000

/** 物理非空行数(rotate 的条数守恒口径,与 readOps 的「空行跳过」同义) */
function countNonEmptyLines(text: string): number {
  return text.split('\n').filter((line) => line.trim() !== '').length
}

/** 目录树里的普通文件数与字节数(不跟随符号链接/junction,§26 递归穿透禁令) */
function walkFileUsage(root: string): { files: number; bytes: number } {
  const out = { files: 0, bytes: 0 }
  const walk = (dir: string): void => {
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch {
      return
    }
    for (const name of names) {
      const abs = join(dir, name)
      let st
      try {
        st = lstatSync(abs)
      } catch {
        continue
      }
      if (st.isSymbolicLink()) continue
      if (st.isDirectory()) walk(abs)
      else if (st.isFile()) {
        out.files += 1
        out.bytes += st.size
      }
    }
  }
  walk(root)
  return out
}

// ── move_ops.jsonl 扫描(统计与轮转共用同一份行级读数)──────────────────────

export interface ScannedOp {
  /** 0 起物理非空行下标(rotate 逐字重建文件用) */
  lineIndex: number
  /** 原文行(逐字,不重排) */
  raw: string
  op: MoveOp
}

export interface OpsLogScan {
  file: string
  present: boolean
  /** 文件字节数(不存在为 0) */
  bytes: number
  /** 全部物理非空行(逐字,保持原序) */
  lines: string[]
  /** 成功解析为 JSON 对象的条目(op 号 = 本数组下标 + 1,与 readOps 同系) */
  entries: ScannedOp[]
  /** 坏行数(解析失败或 JSON 非对象);rotate 一律保留 */
  badLines: number
}

export function scanOpsLog(opsLogFile: string): OpsLogScan {
  if (!existsSync(opsLogFile)) {
    return { file: opsLogFile, present: false, bytes: 0, lines: [], entries: [], badLines: 0 }
  }
  let text: string
  try {
    text = readFileSync(opsLogFile, 'utf8')
  } catch (err) {
    throw new UndeterminedInputError(`读不到操作日志 ${opsLogFile}: ${(err as Error).message}`)
  }
  const lines = text.split('\n').filter((line) => line.trim() !== '')
  const entries: ScannedOp[] = []
  let badLines = 0
  lines.forEach((raw, lineIndex) => {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        entries.push({ lineIndex, raw, op: parsed as MoveOp })
      } else {
        badLines += 1
      }
    } catch {
      badLines += 1
    }
  })
  return {
    file: opsLogFile,
    present: true,
    bytes: Buffer.byteLength(text),
    lines,
    entries,
    badLines,
  }
}

// ── stats:量算仪 ────────────────────────────────────────────────────────────

export interface SnapshotOpsStat {
  /** 快照目录名(UTC 时间戳) */
  name: string
  /** 快照目录绝对路径 */
  dir: string
  opsJsonlPresent: boolean
  /** 不同 op id 数(restore 条 + restore-run + undo 各归各 op) */
  opCount: number
  /** ops.jsonl 里 type=restore 的文件条数 */
  restoreEntries: number
  /** type=restore-run 汇总条数(= 恢复轮次) */
  restoreRuns: number
  /** type=undo 回退条数 */
  undoEntries: number
  /** before 留底文件数 */
  beforeFiles: number
  /** before 留底总字节 */
  beforeBytes: number
  /** ops.jsonl 坏行(非空行数 − readRestoreOps 解析条数) */
  badLines: number
}

export interface SessionOpsStats {
  opsLogFile: string
  opsLogPresent: boolean
  opsLogBytes: number
  /** 主日志可解析条目数(opId 是全局号,可大于本数 —— 条目已在归档件里) */
  total: number
  badLines: number
  byType: Record<string, number>
  earliestTs: string | null
  latestTs: string | null
  /** ts 缺失或不可解析的条目数 */
  unparsableTs: number
  /** undo 记录条数(引用载体,rotate 永不归档) */
  undoRecords: number
  /** 被 undo 记录引用过的 op 号(去重升序) */
  undoRefOpNums: number[]
  /** 引用指向全序(归档⊕当前)里没有的 opId(手工裁行/归档件被清理后的悬空引用) */
  danglingRefOpNums: number[]
  backupsSessionsDir: string
  snapshotsPresent: boolean
  snapshots: SnapshotOpsStat[]
}

function collectSnapshotStats(backupsSessionsDir: string): {
  present: boolean
  snapshots: SnapshotOpsStat[]
} {
  if (!existsSync(backupsSessionsDir)) return { present: false, snapshots: [] }
  let names: string[]
  try {
    names = readdirSync(backupsSessionsDir)
  } catch (err) {
    throw new UndeterminedInputError(
      `读不到快照根 ${backupsSessionsDir}: ${(err as Error).message}`,
    )
  }
  const snapshots: SnapshotOpsStat[] = []
  for (const name of names.sort()) {
    const dir = join(backupsSessionsDir, name)
    let st
    try {
      st = statSync(dir)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    const opsRoot = join(dir, 'restore-ops')
    const opsFile = join(opsRoot, 'ops.jsonl')
    const entries = readRestoreOps(opsRoot)
    let rawLines = 0
    if (existsSync(opsFile)) {
      try {
        rawLines = countNonEmptyLines(readFileSync(opsFile, 'utf8'))
      } catch (err) {
        throw new UndeterminedInputError(`读不到快照恢复日志 ${opsFile}: ${(err as Error).message}`)
      }
    }
    const opIds = new Set<string>()
    let restoreEntries = 0
    let restoreRuns = 0
    let undoEntries = 0
    for (const entry of entries) {
      const opId = (entry as { op?: unknown }).op
      if (typeof opId === 'string' && opId !== '') opIds.add(opId)
      if (entry.type === 'restore') restoreEntries += 1
      else if (entry.type === 'restore-run') restoreRuns += 1
      else if (entry.type === 'undo') undoEntries += 1
    }
    let beforeFiles = 0
    let beforeBytes = 0
    let opDirs: string[] = []
    try {
      opDirs = readdirSync(opsRoot)
    } catch {
      opDirs = []
    }
    for (const opDir of opDirs) {
      const beforeDir = join(opsRoot, opDir, 'before')
      if (!existsSync(beforeDir)) continue
      const usage = walkFileUsage(beforeDir)
      beforeFiles += usage.files
      beforeBytes += usage.bytes
    }
    snapshots.push({
      name,
      dir,
      opsJsonlPresent: existsSync(opsFile),
      opCount: opIds.size,
      restoreEntries,
      restoreRuns,
      undoEntries,
      beforeFiles,
      beforeBytes,
      badLines: Math.max(0, rawLines - entries.length),
    })
  }
  return { present: true, snapshots }
}

export function collectStats(paths: OpsPaths): SessionOpsStats {
  const scan = scanOpsLog(paths.opsLogFile)
  const byType: Record<string, number> = {}
  let earliest: { ms: number; ts: string } | null = null
  let latest: { ms: number; ts: string } | null = null
  let unparsableTs = 0
  let undoRecords = 0
  const refs = new Set<number>()
  for (const { op } of scan.entries) {
    // 日志是外部可改的追加文件:type 按运行时实际值取,缺字段也照实分桶(不冒充已知型)
    const rawType: unknown = op.type
    const type = typeof rawType === 'string' && rawType !== '' ? rawType : '(缺 type)'
    byType[type] = (byType[type] ?? 0) + 1
    if (rawType === 'undo') {
      undoRecords += 1
      if (typeof op.refOp === 'number' && Number.isInteger(op.refOp) && op.refOp >= 1) {
        refs.add(op.refOp)
      }
    }
    const tsText = typeof op.ts === 'string' ? op.ts : ''
    const ms = tsText === '' ? Number.NaN : Date.parse(tsText)
    if (!Number.isFinite(ms)) {
      unparsableTs += 1
      continue
    }
    if (earliest === null) earliest = { ms, ts: tsText }
    else if (ms < earliest.ms) earliest = { ms, ts: tsText }
    if (latest === null) latest = { ms, ts: tsText }
    else if (ms > latest.ms) latest = { ms, ts: tsText }
  }
  const total = scan.entries.length
  // 号空间 = 全序(归档⊕当前)的 opId 集,不是主日志条数:引用的条目被 rotate 移进归档件后
  // 号依然有效(本器按 opId 寻址);拿条数当上界会把合法引用念成悬空,与 undo/rotate 两把尺。
  const knownOpIds = new Set<number>(
    readOpsAll(paths.opsLogFile)
      .ops.map((o) => o.opId)
      .filter((n): n is number => typeof n === 'number'),
  )
  const undoRefOpNums = [...refs].sort((a, b) => a - b)
  const snapshotStats = collectSnapshotStats(paths.backupsSessionsDir)
  return {
    opsLogFile: paths.opsLogFile,
    opsLogPresent: scan.present,
    opsLogBytes: scan.bytes,
    total,
    badLines: scan.badLines,
    byType,
    earliestTs: earliest?.ts ?? null,
    latestTs: latest?.ts ?? null,
    unparsableTs,
    undoRecords,
    undoRefOpNums,
    danglingRefOpNums: undoRefOpNums.filter((n) => !knownOpIds.has(n)),
    backupsSessionsDir: paths.backupsSessionsDir,
    snapshotsPresent: snapshotStats.present,
    snapshots: snapshotStats.snapshots,
  }
}

export function formatStats(stats: SessionOpsStats): string {
  const lines: string[] = []
  lines.push('== 会话操作日志统计(只读;零内容回显:只有计数/时刻/路径)==')
  lines.push(`操作日志: ${stats.opsLogFile}`)
  if (!stats.opsLogPresent) {
    lines.push('  不存在(0 条;搬移腿还没写过任何操作)')
  } else {
    const typeText =
      Object.entries(stats.byType)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, count]) => `${key}=${count}`)
        .join(' ') || '(空)'
    lines.push(
      `  存在 | ${stats.opsLogBytes} 字节 | 总条数 ${stats.total} | 坏行 ${stats.badLines}` +
        ` | ts 不可判定 ${stats.unparsableTs}`,
    )
    lines.push(`  按 type: ${typeText}`)
    lines.push(`  时间: 最早 ${stats.earliestTs ?? '(无)'} | 最晚 ${stats.latestTs ?? '(无)'}`)
    const refs = stats.undoRefOpNums.map((n) => `#${n}`).join(' ')
    lines.push(
      `  被 undo 引用过的 op 号: ${refs || '(无)'}` +
        `(共 ${stats.undoRefOpNums.length} 个;undo 记录 ${stats.undoRecords} 条;` +
        `指向不存在行 ${stats.danglingRefOpNums.length} 个)`,
    )
  }
  lines.push(`快照根: ${stats.backupsSessionsDir}`)
  if (!stats.snapshotsPresent) {
    lines.push('  不存在(0 份快照)')
  } else if (stats.snapshots.length === 0) {
    lines.push('  存在但 0 份快照')
  } else {
    lines.push('  快照(按目录名升序):')
    let opSum = 0
    let restoreSum = 0
    let beforeFilesSum = 0
    let beforeBytesSum = 0
    for (const snap of stats.snapshots) {
      opSum += snap.opCount
      restoreSum += snap.restoreEntries
      beforeFilesSum += snap.beforeFiles
      beforeBytesSum += snap.beforeBytes
      lines.push(
        `  ${snap.name}  op=${snap.opCount} restore条=${snap.restoreEntries}` +
          ` run=${snap.restoreRuns} undo条=${snap.undoEntries}` +
          ` before文件=${snap.beforeFiles} before字节=${snap.beforeBytes}` +
          `${snap.badLines > 0 ? ` 坏行=${snap.badLines}` : ''}`,
      )
    }
    lines.push(
      `  合计: ${stats.snapshots.length} 份 / op ${opSum} / restore 条 ${restoreSum}` +
        ` / before 文件 ${beforeFilesSum} / ${beforeBytesSum} 字节`,
    )
  }
  return lines.join('\n')
}

// ── rotate:受控轮转(undo 引用永不归档)──────────────────────────────────────

export interface RotatePlanOptions {
  keepDays: number
  now: Date
}

export interface RotatePlan {
  opsLogFile: string
  archiveFile: string
  present: boolean
  /** 原文件物理非空行数(条数守恒的基数) */
  totalLines: number
  /** 主日志可解析条目数(opId 是全局号,可大于本数) */
  totalOps: number
  badLines: number
  /** 阈值时刻(ts 严格早于它才可归档) */
  cutoffIso: string
  /** 原文件逐字行序(执行前复核执行面是否被追加/改写) */
  originalLines: string[]
  /** 将移入归档文件的原文行(保持原序) */
  archiveLines: string[]
  /** 将归档的 op 号(1 起) */
  archiveOpNums: number[]
  /** 归档行字节(含 LF,即归档文件本轮新增字节) */
  archivedBytes: number
  /** 原文件保留的原文行(含坏行) */
  keepLines: string[]
  /** 保留的可解析条目数 */
  keepOps: number
  /** 超期但被 undo 引用而保留的 op 号 */
  protectedOpNums: number[]
  /** undo 记录(引用载体,永不归档)的 op 号 */
  undoRecordOpNums: number[]
  /** ts 不可判定而保留的 op 号 */
  unjudgedOpNums: number[]
}

export function planRotate(opsLogFile: string, opts: RotatePlanOptions): RotatePlan {
  const scan = scanOpsLog(opsLogFile)
  const canonicalCount = readOps(opsLogFile).length
  if (canonicalCount !== scan.entries.length) {
    throw new UndeterminedInputError(
      `操作日志读取面不一致(解析对象 ${scan.entries.length} 条 / readOps ${canonicalCount} 条:` +
        '含 JSON 非对象行,或两次读取之间被追加),主日志条目无法与全序 opId 逐条对齐 ⇒ 未判定,拒绝轮转',
    )
  }
  // 主日志条目按序对齐到带 opId 的全序视图(readOpsAll 已给旧数据补位置号)
  const all = readOpsAll(opsLogFile)
  const currentWithId = all.ops.slice(all.archivedCount)
  const refs = new Set<number>()
  const undoRecordOpNums: number[] = []
  // undo 记录可能已在归档件里(引用载体永不归档,但保险起见全序扫 refs)
  for (const op of all.ops) {
    if (op.type === 'undo' && typeof op.refOp === 'number' && op.refOp >= 1) refs.add(op.refOp)
  }
  scan.entries.forEach((entry, index) => {
    const opNo = currentWithId[index]?.opId ?? index + 1
    if (entry.op.type === 'undo') {
      undoRecordOpNums.push(opNo)
    }
  })
  const cutoffMs = opts.now.getTime() - opts.keepDays * DAY_MS
  const archiveLines: string[] = []
  const archiveOpNums: number[] = []
  const protectedOpNums: number[] = []
  const unjudgedOpNums: number[] = []
  const archiveLineIndexes = new Set<number>()
  // 落盘固化:rotate 时给每条可解析条目写死不可变 opId —— 旧库(无 opId)一次 rotate 后即升级,
  // 之后 undo 引用不再随归档件挤占位置而漂移。坏行/非对象行不固化(原样保留)。
  const solidByLineIndex = new Map<number, string>()
  scan.entries.forEach((entry, index) => {
    const opId = currentWithId[index]?.opId ?? index + 1
    solidByLineIndex.set(entry.lineIndex, JSON.stringify({ ...entry.op, opId }))
  })
  scan.entries.forEach((entry, index) => {
    const opNo = currentWithId[index]?.opId ?? index + 1
    const solid = solidByLineIndex.get(entry.lineIndex) ?? entry.raw
    const tsText = typeof entry.op.ts === 'string' ? entry.op.ts : ''
    const ms = tsText === '' ? Number.NaN : Date.parse(tsText)
    if (!Number.isFinite(ms)) {
      unjudgedOpNums.push(opNo)
      return
    }
    if (ms >= cutoffMs) return
    // undo 记录是引用关系的载体:归档它等于让被引用条目在下一轮失去保护
    if (entry.op.type === 'undo') return
    if (refs.has(opNo)) {
      protectedOpNums.push(opNo)
      return
    }
    archiveLineIndexes.add(entry.lineIndex)
    archiveLines.push(solid)
    archiveOpNums.push(opNo)
  })
  const keepLines = scan.lines
    .map((raw, i) => solidByLineIndex.get(i) ?? raw)
    .filter((_, index) => !archiveLineIndexes.has(index))
  const baseName = basename(opsLogFile).replace(/\.jsonl$/i, '')
  const utcDay = opts.now.toISOString().slice(0, 10)
  return {
    opsLogFile,
    archiveFile: join(dirname(opsLogFile), `${baseName}.archive-${utcDay}.jsonl`),
    present: scan.present,
    totalLines: scan.lines.length,
    totalOps: scan.entries.length,
    badLines: scan.badLines,
    cutoffIso: new Date(cutoffMs).toISOString(),
    originalLines: scan.lines,
    archiveLines,
    archiveOpNums,
    archivedBytes: archiveLines.reduce((sum, line) => sum + Buffer.byteLength(line) + 1, 0),
    keepLines,
    keepOps: scan.entries.length - archiveLines.length,
    protectedOpNums,
    undoRecordOpNums,
    unjudgedOpNums,
  }
}

function fmtOpNums(nums: number[]): string {
  return nums.length === 0 ? '(无)' : `${nums.map((n) => `#${n}`).join(' ')}(${nums.length} 个)`
}

export function formatRotatePlan(plan: RotatePlan, apply: boolean): string {
  const lines: string[] = []
  lines.push(
    apply ? '== move_ops 轮转·执行 ==' : '== move_ops 轮转·预览(dry-run;加 --apply 才真写)==',
  )
  lines.push(`日志: ${plan.opsLogFile}`)
  if (!plan.present) {
    lines.push('  日志不存在:没有可轮转的条目(未写任何路径)')
    return lines.join('\n')
  }
  lines.push(
    `  条数 ${plan.totalOps}(坏行 ${plan.badLines} 行原样保留)` +
      ` | 阈值: ts 早于 ${plan.cutoffIso}`,
  )
  if (plan.archiveLines.length === 0) {
    lines.push('将归档: 0 条(没有超期且未被 undo 引用的条目)')
  } else {
    lines.push(
      `将归档: ${plan.archiveLines.length} 条 / ${plan.archivedBytes} 字节` +
        ` → ${plan.archiveFile}`,
    )
  }
  lines.push(`  受 undo 引用而保留: ${fmtOpNums(plan.protectedOpNums)}`)
  lines.push(`  undo 记录(引用载体,永不归档): ${fmtOpNums(plan.undoRecordOpNums)}`)
  lines.push(`  ts 不可判定而保留: ${fmtOpNums(plan.unjudgedOpNums)}`)
  lines.push(
    `剩余: ${plan.keepLines.length} 行(解析条 ${plan.keepOps} 条 + 坏行 ${plan.badLines} 行)`,
  )
  lines.push(
    '注意: 每条的 opId 已随本次轮转固化写盘且不可变 ⇒ 剩余条目的号不因归档而前移;' +
      'undo --op 用的号 rotate 前后同一个(旧库无 opId 时按「归档⊕当前」位置补推并写定)。',
  )
  return lines.join('\n')
}

export interface RotateResult {
  archiveFile: string
  archived: number
  archivedBytes: number
  remainingLines: number
  archiveTotalLines: number
}

/**
 * 执行轮转(写面,仅 --apply 路径可达;调用方应已在同一把会话锁内重算出 plan)。
 * 写序:归档临时名 → 回读校验条数 → 原子改名;再原文件临时名 → 校验
 * 「剩余 + 归档 == 原条数」→ 原子改名;收工回读两侧条数。任一校验不过即停,原日志不动。
 */
export function applyRotate(plan: RotatePlan, now = new Date()): RotateResult {
  if (plan.archiveLines.length === 0) {
    return {
      archiveFile: plan.archiveFile,
      archived: 0,
      archivedBytes: 0,
      remainingLines: plan.keepLines.length,
      archiveTotalLines: 0,
    }
  }
  // 执行面复核:读到的原文件必须还是 plan 的那份(防止把别人刚追加的条目吃掉)
  const fresh = scanOpsLog(plan.opsLogFile)
  const same =
    fresh.lines.length === plan.originalLines.length &&
    fresh.lines.every((line, index) => line === plan.originalLines[index])
  if (!same) {
    throw new Error('轮转执行面已变(日志被追加或改写),本次不落(未写任何路径);请重跑')
  }
  const stamp = now.getTime()
  mkdirSync(dirname(plan.archiveFile), { recursive: true })
  const existing = existsSync(plan.archiveFile) ? readFileSync(plan.archiveFile, 'utf8') : ''
  const existingLines = countNonEmptyLines(existing)
  const prefix = existing === '' || existing.endsWith('\n') ? existing : `${existing}\n`
  const archiveText = `${prefix}${plan.archiveLines.join('\n')}\n`
  const archiveTmp = `${plan.archiveFile}.rotating-${stamp}`
  writeFileSync(archiveTmp, archiveText)
  const archiveBack = readFileSync(archiveTmp, 'utf8')
  if (countNonEmptyLines(archiveBack) !== existingLines + plan.archiveLines.length) {
    try {
      unlinkSync(archiveTmp)
    } catch {
      /* 清理尽力而为 */
    }
    throw new Error('归档临时文件校验不过(条数不守恒),未改名,原日志未动')
  }
  // 归档先落地:即便后续原文件改名失败,也只会出现重复副本,绝不丢条目
  renameSync(archiveTmp, plan.archiveFile)

  const keepText = plan.keepLines.length === 0 ? '' : `${plan.keepLines.join('\n')}\n`
  const opsTmp = `${plan.opsLogFile}.rotating-${stamp}`
  writeFileSync(opsTmp, keepText)
  const keepBack = countNonEmptyLines(readFileSync(opsTmp, 'utf8'))
  if (keepBack + plan.archiveLines.length !== plan.totalLines) {
    try {
      unlinkSync(opsTmp)
    } catch {
      /* 清理尽力而为 */
    }
    throw new Error(
      `轮转校验不过(剩余 ${keepBack} + 归档 ${plan.archiveLines.length} ≠ 原 ${plan.totalLines}),` +
        `原日志未动;归档副本已写在 ${plan.archiveFile}(可能重复,无条目丢失)`,
    )
  }
  renameSync(opsTmp, plan.opsLogFile)

  const finalKeep = countNonEmptyLines(readFileSync(plan.opsLogFile, 'utf8'))
  const finalArchive = countNonEmptyLines(readFileSync(plan.archiveFile, 'utf8'))
  if (
    finalKeep !== plan.keepLines.length ||
    finalArchive !== existingLines + plan.archiveLines.length
  ) {
    throw new Error(
      `收工对账失败: 剩余 ${finalKeep}/${plan.keepLines.length},` +
        `归档 ${finalArchive}/${existingLines + plan.archiveLines.length}(归档副本已在,无条目丢失)`,
    )
  }
  return {
    archiveFile: plan.archiveFile,
    archived: plan.archiveLines.length,
    archivedBytes: plan.archivedBytes,
    remainingLines: finalKeep,
    archiveTotalLines: finalArchive,
  }
}

// ── prune-snapshots:刻意只读的清理盘点 ─────────────────────────────────────

export interface SnapshotDirUsage {
  name: string
  dir: string
  files: number
  bytes: number
}

export interface PruneSnapshotsPlan {
  backupsSessionsDir: string
  present: boolean
  total: number
  keep: number
  kept: { name: string; dir: string }[]
  /** 可人工清理的目录(只报数,本器不删) */
  prunable: SnapshotDirUsage[]
}

export function planPruneSnapshots(backupsSessionsDir: string, keep: number): PruneSnapshotsPlan {
  if (!existsSync(backupsSessionsDir)) {
    return { backupsSessionsDir, present: false, total: 0, keep, kept: [], prunable: [] }
  }
  let names: string[]
  try {
    names = readdirSync(backupsSessionsDir)
  } catch (err) {
    throw new UndeterminedInputError(
      `读不到快照根 ${backupsSessionsDir}: ${(err as Error).message}`,
    )
  }
  const dirs: { name: string; dir: string; mtimeMs: number }[] = []
  for (const name of names) {
    const dir = join(backupsSessionsDir, name)
    let st
    try {
      st = statSync(dir)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    dirs.push({ name, dir, mtimeMs: st.mtimeMs })
  }
  // 「最近」按目录 mtime 降序,同毫秒时按名字(UTC 时间戳)降序兜底
  dirs.sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs
    if (a.name === b.name) return 0
    return a.name < b.name ? 1 : -1
  })
  const kept = dirs.slice(0, keep).map(({ name, dir }) => ({ name, dir }))
  const prunable = dirs.slice(keep).map(({ name, dir }) => {
    const usage = walkFileUsage(dir)
    return { name, dir, files: usage.files, bytes: usage.bytes }
  })
  return { backupsSessionsDir, present: true, total: dirs.length, keep, kept, prunable }
}

export function formatPrunePlan(plan: PruneSnapshotsPlan, apply: boolean): string {
  const lines: string[] = []
  lines.push('== 会话库快照清理盘点(刻意只读;本器不删除任何目录)==')
  lines.push(`快照根: ${plan.backupsSessionsDir}`)
  if (!plan.present) {
    lines.push('  不存在(0 份快照)')
    return lines.join('\n')
  }
  lines.push(`  共 ${plan.total} 份;保留最近 ${plan.keep} 份`)
  lines.push('保留:')
  if (plan.kept.length === 0) lines.push('  (无)')
  for (const snap of plan.kept) lines.push(`  ${snap.name}  ${snap.dir}`)
  lines.push(`可人工清理的目录(${plan.prunable.length} 份,只报数):`)
  if (plan.prunable.length === 0) lines.push('  (无)')
  for (const snap of plan.prunable) {
    lines.push(`  ${snap.name}  ${snap.dir}  文件 ${snap.files} / ${snap.bytes} 字节`)
  }
  lines.push(
    apply
      ? '(--apply 对 prune-snapshots 不生效:快照是回退能力的载体,本器刻意只读,请人工确认后自行清理)'
      : '(dry-run;本器任何档位都不删除 —— 确认后请人工清理上述目录)',
  )
  return lines.join('\n')
}

// ── CLI ────────────────────────────────────────────────────────────────────

const USAGE = `用法:
  relay:session-ops stats [--json]                       统计 move_ops 与各快照 restore-ops
  relay:session-ops rotate --keep-days <N> [--apply]      归档 N 天前且未被 undo 引用的条目
  relay:session-ops prune-snapshots --keep <N> [--apply]  只报数:列出可人工清理的快照目录
说明:
  - rotate 默认 dry-run;--apply 先写临时名并校验条数守恒,再原子改名。
  - 被 undo 记录(MoveOp.refOp)引用的条目永不归档;undo 记录本身也不归档(引用载体)。
  - 每条的 opId 在 rotate 时固化写盘且此后不变 —— 剩余条目的号不随归档前移,undo --op 的号 rotate 前后同一个。
  - prune-snapshots 刻意只读:--apply 也不删除任何目录(快照是回退能力的载体)。
退出码: 0 成功 / 1 执行失败 / 2 参数错或输入不可判定`

function readFlagValue(
  argv: string[],
  flag: string,
): { found: boolean; value: string | undefined } {
  const index = argv.indexOf(flag)
  if (index < 0) return { found: false, value: undefined }
  return { found: true, value: argv[index + 1] }
}

/** 参数白名单校验:只认声明过的旗标;值旗标连值一起跳过(值可能以 - 开头) */
function findUnknownFlag(argv: string[], allowed: string[], valueFlags: string[]): string | null {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === undefined || !arg.startsWith('--')) return `多余的参数: ${arg ?? ''}`
    if (!allowed.includes(arg)) return `未知参数: ${arg}`
    if (valueFlags.includes(arg)) i += 1
  }
  return null
}

function parsePositiveInt(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) && n >= 1 ? n : null
}

function parseNonNegativeInt(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) && n >= 0 ? n : null
}

function runStats(rest: string[], paths: OpsPaths): number {
  const unknown = findUnknownFlag(rest, ['--json'], [])
  if (unknown !== null) {
    console.error(unknown)
    return 2
  }
  const stats = collectStats(paths)
  if (rest.includes('--json')) console.log(JSON.stringify(stats, null, 2))
  else console.log(formatStats(stats))
  return 0
}

function runRotate(rest: string[], paths: OpsPaths, now: Date): number {
  const unknown = findUnknownFlag(rest, ['--keep-days', '--apply'], ['--keep-days'])
  if (unknown !== null) {
    console.error(unknown)
    return 2
  }
  const rawDays = readFlagValue(rest, '--keep-days')
  const keepDays = parsePositiveInt(rawDays.value)
  if (!rawDays.found || keepDays === null) {
    console.error('rotate 需要 --keep-days <N>(≥1 的整数,归档 N 天前的条目)')
    return 2
  }
  const apply = rest.includes('--apply')
  let lock: { release: () => void } | null = null
  try {
    // 写档先取会话锁(与搬移腿同一把),防止读—改—写之间被追加/搬移
    if (apply) {
      lock = acquireSessionLock(
        join(dirname(paths.opsLogFile), 'session-move.lock'),
        'session-ops rotate',
      )
    }
    const plan = planRotate(paths.opsLogFile, { keepDays, now })
    console.log(formatRotatePlan(plan, apply))
    if (!apply) {
      console.log('\n(dry-run;未写入任何路径。确认后加 --apply)')
      return 0
    }
    if (plan.archiveLines.length === 0) {
      console.log('\n完成: 归档 0 条(未写任何路径)')
      return 0
    }
    const result = applyRotate(plan, now)
    console.log(
      `\n完成: 归档 ${result.archived} 条 / ${result.archivedBytes} 字节 → ${result.archiveFile};` +
        `剩余 ${result.remainingLines} 行;归档文件现 ${result.archiveTotalLines} 行;条数守恒校验通过`,
    )
    return 0
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`会话操作日志轮转失败: ${msg}`)
    return err instanceof UndeterminedInputError ? 2 : 1
  } finally {
    lock?.release()
  }
}

function runPruneSnapshots(rest: string[], paths: OpsPaths): number {
  const unknown = findUnknownFlag(rest, ['--keep', '--apply'], ['--keep'])
  if (unknown !== null) {
    console.error(unknown)
    return 2
  }
  const rawKeep = readFlagValue(rest, '--keep')
  const keep = parseNonNegativeInt(rawKeep.value)
  if (!rawKeep.found || keep === null) {
    console.error('prune-snapshots 需要 --keep <N>(≥0 的整数,保留最近 N 份快照目录)')
    return 2
  }
  const plan = planPruneSnapshots(paths.backupsSessionsDir, keep)
  console.log(formatPrunePlan(plan, rest.includes('--apply')))
  return 0
}

export function main(
  argv: string[] = process.argv.slice(2),
  override?: Partial<OpsPaths> & { now?: Date },
): number {
  const paths: OpsPaths = { ...defaultOpsPaths(), ...override }
  const now = override?.now ?? new Date()
  const cmd = argv[0]
  const rest = argv.slice(1)
  if (cmd === undefined || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(USAGE)
    return 0
  }
  try {
    if (cmd === 'stats') return runStats(rest, paths)
    if (cmd === 'rotate') return runRotate(rest, paths, now)
    if (cmd === 'prune-snapshots') return runPruneSnapshots(rest, paths)
    console.error(`未知子命令: ${cmd}(可用: stats / rotate / prune-snapshots / help)\n`)
    console.log(USAGE)
    return 2
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`会话操作日志运维失败: ${msg}`)
    return err instanceof UndeterminedInputError ? 2 : 1
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
