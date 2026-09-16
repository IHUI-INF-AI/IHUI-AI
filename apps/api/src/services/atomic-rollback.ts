// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { join, relative, resolve, sep } from 'node:path'
import { agentLoop } from './workspace-ai-service.js'

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

export interface AtomicCheckpointMeta {
  id: string
  createdAt: string
  description: string
  tool: string
  files: AtomicFileRecord[]
  skipped: { path: string; reason: string }[]
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
  uncovered: { path: string; reason: string }[]
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
  steps: AtomicRollbackStep[]
  /** 依赖锁/迁移差异给出的建议后续动作(不自动执行) */
  suggestedFollowUps: string[]
}

const SNAPSHOT_DIR = join('.ihui', 'atomic-checkpoints')
const MAX_FILE_BYTES = 1024 * 1024
const MAX_FILES = 3000
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

/** 有界递归采集文件相对路径(跳过产物目录,限流) */
async function collectFiles(
  root: string,
): Promise<{ files: string[]; skipped: { path: string; reason: string }[] }> {
  const files: string[] = []
  const skipped: { path: string; reason: string }[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 10) return
    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (files.length >= MAX_FILES) return
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue
        await walk(full, depth + 1)
      } else if (e.isFile()) {
        try {
          const st = await stat(full)
          if (st.size > MAX_FILE_BYTES) {
            skipped.push({
              path: relative(root, full).split(sep).join('/'),
              reason: `文件超过 ${MAX_FILE_BYTES / 1024 / 1024}MB 上限`,
            })
            continue
          }
          files.push(relative(root, full).split(sep).join('/'))
        } catch {
          /* 单文件 stat 失败忽略 */
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

/** 创建原子快照:全量有界文件备份到 .ihui/atomic-checkpoints/<id>/files/ */
export async function createAtomicCheckpoint(
  workspacePath: string,
  params: { description: string; tool?: string },
): Promise<AtomicCheckpoint> {
  const wsAbs = resolve(workspacePath)
  const id = `ac-${Math.floor(Date.now() / 1000)}-${Math.random().toString(36).slice(2, 6)}`
  const dir = join(snapshotRoot(wsAbs), id)
  const filesDir = join(dir, 'files')
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

  const meta: AtomicCheckpointMeta = {
    id,
    createdAt: new Date().toISOString(),
    description: params.description.slice(0, 500),
    tool: params.tool ?? 'atomic-rollback',
    files: records,
    skipped,
  }
  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta), 'utf-8')
  return { meta, dir }
}

async function loadMeta(
  workspacePath: string,
  checkpointId: string,
): Promise<AtomicCheckpointMeta | null> {
  const file = join(snapshotRoot(workspacePath), checkpointId, 'meta.json')
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
  for (const name of (await readdir(root)).sort().reverse()) {
    const meta = await loadMeta(workspacePath, name)
    if (meta) out.push(meta)
  }
  return out
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
  const snapshotPaths = new Set<string>()
  let unchanged = 0
  let restoreBytes = 0

  for (const rec of meta.files) {
    snapshotPaths.add(rec.path)
    const abs = join(wsAbs, rec.path)
    if (!existsSync(abs)) {
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
  const { files: currentFiles } = await collectFiles(wsAbs)
  for (const rel of currentFiles) {
    if (!snapshotPaths.has(rel)) {
      remove.push({ path: rel, currentHash: sha256(await readFile(join(wsAbs, rel))) })
    }
  }

  const uncovered = meta.skipped
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
      steps,
      suggestedFollowUps,
    }
  }

  const plan = await planAtomicRollback(workspacePath, checkpointId)
  if (!plan) return null

  const filesDir = join(snapshotRoot(wsAbs), checkpointId, 'files')

  for (const item of plan.restore) {
    const t0 = Date.now()
    const abs = join(wsAbs, item.path)
    try {
      const content = await readFile(join(filesDir, item.path))
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
    const abs = join(wsAbs, item.path)
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
      `快照时跳过了 ${plan.uncovered.length} 个超限文件,这些文件不在本次回滚覆盖范围内。`,
    )
  }

  return {
    checkpointId,
    workspacePath: wsAbs,
    confirm: true,
    ok: failed === 0,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
