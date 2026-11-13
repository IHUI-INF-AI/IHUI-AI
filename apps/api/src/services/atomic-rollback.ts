// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全栈原子回滚(2026-09-17 立,P3 #42)。
 *
 * 与既有 CheckpointManager(仅哈希清单,rollback 为标记空壳)互补:
 * 本服务做「真实可恢复」的整栈文件快照——代码 + .env(环境变量)+
 * pnpm-lock.yaml(依赖锁)+ 迁移 SQL 文件统一按文件快照,恢复即整栈还原。
 *
 * 安全边界(立项注明:风险最高,dry-run 先行):
 * - 快照:有界采集(单文件 ≤1MB、总数 ≤3000、跳过 node_modules/.git/.next 等
 *   产物目录与 .ihui 自身),超限文件记入 skipped 不阻塞。
 * - 回滚:planRollback 零写入预演(diff 报告);executeRollback 必须显式
 *   confirm=true 才落刀,逐 step 审计(step/path/status/output)。
 * - DB 迁移:只做「快照后新增迁移文件」差异报告,不自动执行降级 SQL
 *   (通用项目无统一 down 语义,自动 DROP 不可接受;降级执行留给 agent/用户)。
 * - 依赖锁:恢复 pnpm-lock.yaml 文件本身;重装依赖(pnpm install)作为
 *   建议后续动作输出,不自动执行(与端口清理的显式授权同思路)。
 */

import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'

function errnoOf(error: unknown): string | undefined {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return undefined
}

/** ENOENT/ENOTDIR 才是真的没有。其它读失败不能拿来覆盖或删除。 */
async function classifyWorkspacePath(
  abs: string,
  statImpl: (path: string) => Promise<unknown> = stat,
): Promise<'absent' | 'present' | 'unreadable'> {
  try {
    await statImpl(abs)
    return 'present'
  } catch (error) {
    const code = errnoOf(error)
    if (code === 'ENOENT' || code === 'ENOTDIR') return 'absent'
    return 'unreadable'
  }
}
import type { Dirent } from 'node:fs'
import { join, relative, resolve, sep, isAbsolute } from 'node:path'
import { agentLoop } from './workspace-ai-service.js'
import { logger } from '../utils/logger.js'

// =============================================================================
// 类型
// =============================================================================

export interface AtomicFileRecord {
  /** 工作区相对路径(POSIX 分隔) */
  path: string
  existed: boolean
  hash: string
  size: number
}

export interface SnapshotSkip {
  path: string
  reason: string
}

export interface AtomicCheckpointMeta {
  id: string
  createdAt: string
  description: string
  tool: string
  files: AtomicFileRecord[]
  skipped: SnapshotSkip[]
  /** 采集存在漏采(深度上限/目录读失败/符号链接/超限)时为 true(F-564) */
  partial?: boolean
}

export interface AtomicRollbackPlan {
  checkpointId: string
  workspacePath: string
  /** 将恢复(内容与快照不同或本地缺失)的快照内文件 */
  restore: { path: string; snapshotHash: string; currentHash: string | null }[]
  /** 快照不存在但本地存在(快照后新增)→ 回滚将删除 */
  remove: { path: string; currentHash: string }[]
  unchanged: number
  /** 快照时被跳过的大文件/目录,回滚无法覆盖(审计提示) */
  uncovered: SnapshotSkip[]
  /** 采集存在漏采 → 本预演不代表完整覆盖(F-564) */
  partial: boolean
  /** 漏采明细(path: 原因)(F-564) */
  reasons: string[]
  /** 快照后新增的迁移类文件(仅报告,不自动降级) */
  newMigrationFiles: string[]
  totals: { restoreBytes: number }
}

export interface AtomicRollbackStep {
  step: string
  path: string
  status: 'ok' | 'fail' | 'skipped'
  output: string
  durationMs: number
}

export interface AtomicRollbackResult {
  checkpointId: string
  workspacePath: string
  confirm: boolean
  ok: boolean
  /** 存在漏采时不得视为成功(ok 恒为 false)(F-564) */
  partial: boolean
  /** 漏采明细(path: 原因)(F-564) */
  reasons: string[]
  steps: AtomicRollbackStep[]
  /** 依赖锁/迁移差异给出的建议后续动作(不自动执行) */
  suggestedFollowUps: string[]
}

const SNAPSHOT_DIR = join('.ihui', 'atomic-checkpoints')
const MAX_FILE_BYTES = 1024 * 1024
const MAX_FILES = 3000
/** 快照保留份数上限:超出后按目录 mtime 从旧到新删除(F-554)。 */
export const MAX_RETAINED_CHECKPOINTS = 5
/** 采集深度上限(工作区根为 0);导出/可注入便于测试(F-564)。 */
export const SNAPSHOT_MAX_DEPTH = 10
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  '.output',
  'coverage',
  '.ihui',
])
/** 迁移类文件判定(回滚时仅报告不自动降级) */
const MIGRATION_HINTS = ['migration', 'migrations', 'drizzle', 'prisma']
const MIGRATION_SUFFIX = ['.sql']

// =============================================================================
// 快照采集
// =============================================================================

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16)
}

function isMigrationFile(relPath: string): boolean {
  const lower = relPath.toLowerCase()
  return (
    MIGRATION_SUFFIX.some((s) => lower.endsWith(s)) &&
    MIGRATION_HINTS.some((h) => lower.includes(h))
  )
}

/**
 * 有界递归采集文件相对路径(跳过产物目录,限流)。
 * F-564:深度上限、目录读失败、符号链接都不得静默丢弃,必须进 skipped 明细(路径+原因)。
 */
async function collectFiles(
  root: string,
  options: { maxDepth?: number } = {},
): Promise<{ files: string[]; skipped: SnapshotSkip[] }> {
  const maxDepth = options.maxDepth ?? SNAPSHOT_MAX_DEPTH
  const files: string[] = []
  const skipped: SnapshotSkip[] = []
  const relOf = (abs: string): string => relative(root, abs).split(sep).join('/') || '.'
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > maxDepth) {
      skipped.push({
        path: relOf(dir),
        reason: `目录深度超过 ${maxDepth} 层上限,其下内容未采集`,
      })
      return
    }
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch (error) {
      skipped.push({
        path: relOf(dir),
        reason: `目录读取失败(${errnoOf(error) ?? 'unknown'}),其下内容未采集`,
      })
      return
    }
    for (const e of entries) {
      if (files.length >= MAX_FILES) return
      const full = join(dir, e.name)
      if (e.isSymbolicLink()) {
        skipped.push({
          path: relOf(full),
          reason: '符号链接,未采集(不跟踪链接目标,避免越出工作区)',
        })
        continue
      }
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue
        await walk(full, depth + 1)
      } else if (e.isFile()) {
        try {
          const st = await stat(full)
          if (st.size > MAX_FILE_BYTES) {
            skipped.push({
              path: relOf(full),
              reason: `文件超过 ${MAX_FILE_BYTES / 1024 / 1024}MB 上限`,
            })
            continue
          }
          files.push(relOf(full))
        } catch (error) {
          skipped.push({
            path: relOf(full),
            reason: `读不到,不能把它说成没有 (${errnoOf(error) ?? 'unknown'})`,
          })
        }
      }
    }
  }
  await walk(root, 0)
  if (files.length >= MAX_FILES) {
    skipped.push({ path: '*', reason: `已达单快照 ${MAX_FILES} 文件上限,超出部分未采集` })
  }
  return { files, skipped }
}

export interface AtomicCheckpoint {
  meta: AtomicCheckpointMeta
  /** 快照目录绝对路径(内部用) */
  dir: string
}

function snapshotRoot(workspacePath: string): string {
  return join(resolve(workspacePath), SNAPSHOT_DIR)
}

/**
 * checkpointId 只允许字母/数字/下划线/连字符(F-27)。
 * 快照目录名由本服务生成(`ac-<秒>-<随机>`),任何 `/`、`\`、`..` 都只能是越界企图。
 */
const CHECKPOINT_ID_PATTERN = /^[A-Za-z0-9_-]+$/

export function isSafeCheckpointId(id: string): boolean {
  return (
    typeof id === 'string' && id.length > 0 && id.length <= 64 && CHECKPOINT_ID_PATTERN.test(id)
  )
}

/**
 * 把「根内相对路径」归一为绝对路径;越界(含 `..`、绝对路径、跨盘符)返回 null。
 * F-27:checkpointId 与 meta.files[].path 都曾直接 join 后使用,`../` 可越出工作区任意读写。
 */
function resolveInsideRoot(rootAbs: string, rel: string): string | null {
  if (typeof rel !== 'string' || rel.length === 0) return null
  const abs = resolve(rootAbs, rel)
  const back = relative(rootAbs, abs)
  // 空串 = 指向根本身:文件记录/快照 id 都不允许,拒绝以免把目录当文件读写
  if (back === '') return null
  if (isAbsolute(back) || back.startsWith(`..${sep}`) || back === '..') return null
  return abs
}

/**
 * 清理超出保留份数的快照目录(F-554)。
 * - 按目录 mtime 从旧到新删除,保留最近 `retain` 份;
 * - `protectedIds`(刚创建、正在被使用的当前快照)与 mtime 最新的目录永不删除;
 * - 单条删除失败只 warn 不打断,返回实际删除的 id。
 */
export async function pruneAtomicCheckpoints(
  workspacePath: string,
  protectedIds: Iterable<string> = [],
  retain: number = MAX_RETAINED_CHECKPOINTS,
): Promise<string[]> {
  const root = snapshotRoot(workspacePath)
  const keep = new Set(protectedIds)
  let names: string[]
  try {
    names = await readdir(root)
  } catch (error) {
    const code = errnoOf(error)
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      logger.warn('[atomic-rollback] 读取快照根失败,跳过清理', { error: String(error) })
    }
    return []
  }

  const dirs: { name: string; mtimeMs: number }[] = []
  for (const name of names) {
    // 只处理合法快照目录名,目录外的杂项文件不碰
    if (!isSafeCheckpointId(name)) continue
    const abs = resolveInsideRoot(root, name)
    if (!abs) continue
    try {
      const st = await stat(abs)
      if (!st.isDirectory()) continue
      dirs.push({ name, mtimeMs: st.mtimeMs })
    } catch (error) {
      // 读不到状态就不能断定可以删,跳过并留痕
      logger.warn('[atomic-rollback] 读取快照目录状态失败,跳过该项', {
        id: name,
        error: String(error),
      })
    }
  }
  if (dirs.length <= retain) return []

  dirs.sort((a, b) => a.mtimeMs - b.mtimeMs)
  // 最新的一个永远保留:并发创建时它可能就是另一路正在使用的"当前"快照
  const newest = dirs[dirs.length - 1]
  if (newest) keep.add(newest.name)

  const keptCount = dirs.filter((d) => keep.has(d.name)).length
  const excess = dirs.length - Math.max(retain, keptCount)
  if (excess <= 0) return []

  const removed: string[] = []
  for (const victim of dirs.filter((d) => !keep.has(d.name)).slice(0, excess)) {
    const abs = resolveInsideRoot(root, victim.name)
    if (!abs) continue
    try {
      await rm(abs, { recursive: true, force: true })
      removed.push(victim.name)
    } catch (error) {
      logger.warn('[atomic-rollback] 删除过期快照失败,已跳过', {
        id: victim.name,
        error: String(error),
      })
    }
  }
  return removed
}

/** 创建原子快照:全量有界文件备份到 .ihui/atomic-checkpoints/<id>/files/ */
export async function createAtomicCheckpoint(
  workspacePath: string,
  params: { description: string; tool?: string },
): Promise<AtomicCheckpoint> {
  const wsAbs = resolve(workspacePath)
  const id = `ac-${Math.floor(Date.now() / 1000)}-${Math.random().toString(36).slice(2, 6)}`
  const dir = join(snapshotRoot(wsAbs), id)
  const filesDir = join(dir, 'files')
  let meta: AtomicCheckpointMeta
  try {
    await mkdir(filesDir, { recursive: true })

    const { files, skipped } = await collectFiles(wsAbs)
    const records: AtomicFileRecord[] = []
    for (const rel of files) {
      const abs = join(wsAbs, rel)
      try {
        const content = await readFile(abs)
        const target = join(filesDir, rel)
        await mkdir(join(target, '..'), { recursive: true })
        await writeFile(target, content)
        records.push({ path: rel, existed: true, hash: sha256(content), size: content.length })
      } catch (e) {
        skipped.push({ path: rel, reason: `读取失败: ${String(e).slice(0, 120)}` })
      }
    }

    meta = {
      id,
      createdAt: new Date().toISOString(),
      description: params.description.slice(0, 500),
      tool: params.tool ?? 'atomic-rollback',
      files: records,
      skipped,
      partial: skipped.length > 0,
    }
    await writeFile(join(dir, 'meta.json'), JSON.stringify(meta), 'utf-8')
  } catch (error) {
    // 先复制文件、后写 meta:中途失败会留下 listAtomicCheckpoints 看不见的孤儿目录,
    // 必须在这里自己收拾干净,再抛出原错误(保持调用方看到的错误语义不变)。
    try {
      await rm(dir, { recursive: true, force: true })
    } catch (cleanupError) {
      logger.warn('[atomic-rollback] 快照创建失败后清理半成品目录失败', {
        id,
        error: String(cleanupError),
      })
    }
    throw error
  }

  // 成功落盘后才做保留期清理;清理失败只 warn,不影响本次快照可用性
  await pruneAtomicCheckpoints(wsAbs, [id])
  return { meta, dir }
}

async function loadMeta(
  workspacePath: string,
  checkpointId: string,
): Promise<AtomicCheckpointMeta | null> {
  if (!isSafeCheckpointId(checkpointId)) return null
  const dir = resolveInsideRoot(snapshotRoot(workspacePath), checkpointId)
  if (!dir) return null
  const file = join(dir, 'meta.json')
  if (!existsSync(file)) return null
  try {
    return JSON.parse(await readFile(file, 'utf-8')) as AtomicCheckpointMeta
  } catch {
    return null
  }
}

/** 快照列表(仅元信息) */
export async function listAtomicCheckpoints(
  workspacePath: string,
): Promise<AtomicCheckpointMeta[]> {
  const root = snapshotRoot(workspacePath)
  if (!existsSync(root)) return []
  const out: AtomicCheckpointMeta[] = []
  for (const name of await readdir(root)) {
    const meta = await loadMeta(workspacePath, name)
    if (meta) out.push(meta)
  }
  // 目录名是 `ac-<秒级时间戳>-<随机后缀>`,同一秒内创建的两个快照无法靠名字定序
  // (随机后缀决定先后,顺序随机翻转)。必须按 meta.createdAt(毫秒)倒序才是真"新到旧"。
  return out.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

// =============================================================================
// 预演(dry-run,零写入)
// =============================================================================

export async function planAtomicRollback(
  workspacePath: string,
  checkpointId: string,
): Promise<AtomicRollbackPlan | null> {
  const meta = await loadMeta(workspacePath, checkpointId)
  if (!meta) return null
  const wsAbs = resolve(workspacePath)

  const restore: AtomicRollbackPlan['restore'] = []
  const remove: AtomicRollbackPlan['remove'] = []
  const unread: AtomicRollbackPlan['uncovered'] = []
  const snapshotPaths = new Set<string>()
  let unchanged = 0
  let restoreBytes = 0

  for (const rec of meta.files) {
    const abs = resolveInsideRoot(wsAbs, rec.path)
    if (!abs) {
      // 越界条目:不改工作区、不按快照覆盖,只在 uncovered 里明示拒绝
      unread.push({ path: rec.path, reason: '路径越出工作区,已拒绝回滚' })
      continue
    }
    snapshotPaths.add(rec.path)
    const presence = await classifyWorkspacePath(abs)
    if (presence === 'unreadable') {
      unread.push({ path: rec.path, reason: '当前文件读不到,不能按快照覆盖' })
      continue
    }
    if (presence === 'absent') {
      restore.push({ path: rec.path, snapshotHash: rec.hash, currentHash: null })
      restoreBytes += rec.size
      continue
    }
    const cur = sha256(await readFile(abs))
    if (cur === rec.hash) {
      unchanged++
    } else {
      restore.push({ path: rec.path, snapshotHash: rec.hash, currentHash: cur })
      restoreBytes += rec.size
    }
  }

  // 本地新增(快照没有的文件)→ 将删除;同样有界扫描
  const { files: currentFiles, skipped: currentSkipped } = await collectFiles(wsAbs)
  const held = new Set((meta.skipped ?? []).map((item) => item.path))
  for (const rel of currentFiles) {
    if (snapshotPaths.has(rel) || held.has(rel)) continue
    const abs = resolveInsideRoot(wsAbs, rel)
    if (!abs) continue
    remove.push({ path: rel, currentHash: sha256(await readFile(abs)) })
  }

  // F-564:两条采集路径的漏采都要计入;存在漏采时 partial=true,不能宣称完整覆盖
  const collectionSkips: SnapshotSkip[] = [...(meta.skipped ?? []), ...currentSkipped]
  const partial = meta.partial === true || collectionSkips.length > 0
  const reasons = collectionSkips.map((s) => `${s.path}: ${s.reason}`)
  const uncovered = [...collectionSkips, ...unread]
  const newMigrationFiles = [...restore.map((r) => r.path), ...remove.map((r) => r.path)].filter(
    (p) => isMigrationFile(p),
  )

  return {
    checkpointId,
    workspacePath: wsAbs,
    restore,
    remove,
    unchanged,
    uncovered,
    partial,
    reasons,
    newMigrationFiles,
    totals: { restoreBytes },
  }
}

// =============================================================================
// 执行(必须 confirm;逐 step 审计)
// =============================================================================

export async function executeAtomicRollback(
  workspacePath: string,
  checkpointId: string,
  params: { confirm: boolean },
): Promise<AtomicRollbackResult | null> {
  const meta = await loadMeta(workspacePath, checkpointId)
  if (!meta) return null
  const wsAbs = resolve(workspacePath)
  const steps: AtomicRollbackStep[] = []
  const suggestedFollowUps: string[] = []
  const snapshotSkips = meta.skipped ?? []
  const snapshotPartial = meta.partial === true || snapshotSkips.length > 0

  if (!params.confirm) {
    steps.push({
      step: '安全确认',
      path: '*',
      status: 'skipped',
      output: 'confirm=false:整栈回滚未执行,请先用 plan 预演并显式 confirm=true。',
      durationMs: 0,
    })
    return {
      checkpointId,
      workspacePath: wsAbs,
      confirm: false,
      ok: false,
      partial: snapshotPartial,
      reasons: snapshotSkips.map((s) => `${s.path}: ${s.reason}`),
      steps,
      suggestedFollowUps,
    }
  }

  const plan = await planAtomicRollback(workspacePath, checkpointId)
  if (!plan) return null

  const checkpointDir = resolveInsideRoot(snapshotRoot(wsAbs), checkpointId)
  if (!checkpointDir) return null
  const filesDir = join(checkpointDir, 'files')

  for (const item of plan.restore) {
    const t0 = Date.now()
    const abs = resolveInsideRoot(wsAbs, item.path)
    const snapshotAbs = resolveInsideRoot(filesDir, item.path)
    if (!abs || !snapshotAbs) {
      steps.push({
        step: '恢复文件',
        path: item.path,
        status: 'skipped',
        output: '路径越出工作区,已拒绝',
        durationMs: Date.now() - t0,
      })
      continue
    }
    try {
      const content = await readFile(snapshotAbs)
      await mkdir(join(abs, '..'), { recursive: true })
      await writeFile(abs, content)
      steps.push({
        step: '恢复文件',
        path: item.path,
        status: 'ok',
        output: `${content.length} 字节已写回`,
        durationMs: Date.now() - t0,
      })
    } catch (e) {
      steps.push({
        step: '恢复文件',
        path: item.path,
        status: 'fail',
        output: String(e).slice(0, 300),
        durationMs: Date.now() - t0,
      })
    }
  }

  for (const item of plan.remove) {
    const t0 = Date.now()
    const abs = resolveInsideRoot(wsAbs, item.path)
    if (!abs) {
      steps.push({
        step: '删除快照后新增文件',
        path: item.path,
        status: 'skipped',
        output: '路径越出工作区,已拒绝',
        durationMs: Date.now() - t0,
      })
      continue
    }
    try {
      await rm(abs, { force: true })
      steps.push({
        step: '删除快照后新增文件',
        path: item.path,
        status: 'ok',
        output: '已删除',
        durationMs: Date.now() - t0,
      })
    } catch (e) {
      steps.push({
        step: '删除快照后新增文件',
        path: item.path,
        status: 'fail',
        output: String(e).slice(0, 300),
        durationMs: Date.now() - t0,
      })
    }
  }

  // F-564:存在漏采时显式打一个失败 step 并强行降级 ok,避免"恢复了一部分"被当成完整回滚
  if (plan.partial) {
    steps.push({
      step: '覆盖范围核对',
      path: '*',
      status: 'fail',
      output: `快照/扫描存在 ${plan.reasons.length} 处漏采,本次回滚不代表完整覆盖:${plan.reasons.slice(0, 5).join('; ')}${plan.reasons.length > 5 ? ' 等' : ''}`,
      durationMs: 0,
    })
  }

  const failed = steps.filter((s) => s.status === 'fail').length

  // 建议后续动作(不自动执行)
  const lockTouched =
    plan.restore.some((r) => r.path.endsWith('pnpm-lock.yaml')) ||
    plan.remove.some((r) => r.path.endsWith('pnpm-lock.yaml'))
  if (lockTouched)
    suggestedFollowUps.push(
      '依赖锁已回滚:如 node_modules 与锁文件不一致,请执行 pnpm install 同步(未自动执行)。',
    )
  if (plan.newMigrationFiles.length > 0) {
    suggestedFollowUps.push(
      `检测到迁移类文件差异(${plan.newMigrationFiles.slice(0, 5).join(', ')}${plan.newMigrationFiles.length > 5 ? ' 等' : ''}):回滚仅还原了文件,数据库降级需按项目迁移机制人工/agent 执行(未自动执行,防不可逆 DROP)。`,
    )
  }
  if (plan.uncovered.length > 0) {
    suggestedFollowUps.push(
      `快照/扫描有 ${plan.uncovered.length} 个路径未被覆盖(超限/深层/不可读/符号链接),不在本次回滚覆盖范围内。`,
    )
  }

  return {
    checkpointId,
    workspacePath: wsAbs,
    confirm: true,
    ok: failed === 0 && !plan.partial,
    partial: plan.partial,
    reasons: plan.reasons,
    steps,
    suggestedFollowUps,
  }
}

// =============================================================================
// agentLoop 工具注册(对话流内 toolCall 可审计)
// =============================================================================

agentLoop.registerTool({
  name: 'atomic_checkpoint',
  description:
    '创建全栈原子快照:有界备份工作区全部源文件(含 .env/pnpm-lock.yaml/迁移 SQL,跳过产物目录)到 .ihui/atomic-checkpoints/,供后续整栈回滚。改动较大操作前建议先建快照。',
  execute: async (args) => {
    const result = await createAtomicCheckpoint(String(args['workspacePath'] ?? process.cwd()), {
      description: String(args['description'] ?? 'agent 快照'),
      tool: 'agent-loop',
    })
    return JSON.stringify({
      id: result.meta.id,
      files: result.meta.files.length,
      skipped: result.meta.skipped.length,
    })
  },
})

agentLoop.registerTool({
  name: 'atomic_rollback_plan',
  description:
    '整栈回滚预演(dry-run 零写入):对比指定快照与当前工作区,返回将恢复/删除的文件清单、迁移类文件差异与未覆盖范围。',
  execute: async (args) => {
    const plan = await planAtomicRollback(
      String(args['workspacePath'] ?? process.cwd()),
      String(args['checkpointId'] ?? ''),
    )
    return JSON.stringify(plan ?? { error: '快照不存在' })
  },
})

agentLoop.registerTool({
  name: 'atomic_rollback_execute',
  description:
    '执行整栈回滚:必须显式传 confirm=true 才落刀(缺省只返回安全提示);逐文件恢复/删除并逐 step 审计。DB 迁移降级与依赖重装只给建议不自动执行。',
  execute: async (args) => {
    const result = await executeAtomicRollback(
      String(args['workspacePath'] ?? process.cwd()),
      String(args['checkpointId'] ?? ''),
      { confirm: Boolean(args['confirm'] ?? false) },
    )
    return JSON.stringify(result ?? { error: '快照不存在' })
  },
})

export const ATOMIC_ROLLBACK_TOOL_NAMES = [
  'atomic_checkpoint',
  'atomic_rollback_plan',
  'atomic_rollback_execute',
] as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
