// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话库恢复(⑦第二刀·恢复腿,2026-10-27 立)。
 *
 * 从备份腿(relay-session-backup.ts)产出的快照回填会话库。
 * 红线(docs/RELAY_SESSION_MIGRATION_DESIGN.md §2/§4):
 * - 默认 dry-run:只列差异(目标缺失/sha 不一致/一致跳过),路径+字节,零内容回显;
 * - 真写必须显式 --apply;逐文件先写 `<目标>.restoring-<ts>` 临时名 → sha256 校验 →
 *   原子 rename 覆盖 → 全量对账收工,不留半写状态;
 * - 宁可拒做不静默覆盖:目标存在且 sha 不一致且未显式 --force → 整批拒绝(零写入);
 *   manifest 缺失或条目缺 sha256 字段(旧格式快照)→ 直接报错退出;
 * - 目标根下快照外多余文件一律不动(本工具不是删除工具),只在输出提示计数。
 */

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, sep } from 'node:path'
import {
  relToSourceAbs,
  type BackupFileEntry,
  type BackupManifest,
} from './relay-session-backup.js'

function sha256Of(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

/** 快照内 rel → 快照侧绝对路径(manifest.json 在快照顶层,镜像树与备份腿同形) */
function relToSnapshotAbs(rel: string, snapshotDir: string): string {
  return join(snapshotDir, ...rel.split('/'))
}

/**
 * 加载并校验快照 manifest(旧格式不认)。
 * 缺文件/解析失败/条目缺 rel·bytes·sha256 任一字段 → 抛错(宁可拒做)。
 */
export function loadManifest(snapshotDir: string): BackupManifest {
  const manifestPath = join(snapshotDir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`快照缺少 manifest.json: ${snapshotDir}(旧格式快照不认,拒绝恢复)`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    throw new Error(`manifest.json 解析失败: ${(err as Error).message}`)
  }
  const m = parsed as Partial<BackupManifest>
  if (!m || !Array.isArray(m.files) || !m.source) {
    throw new Error('manifest.json 形状不对(缺 files 数组或 source),拒绝恢复')
  }
  for (const f of m.files) {
    if (
      !f ||
      typeof f.rel !== 'string' ||
      f.rel.length === 0 ||
      typeof f.bytes !== 'number' ||
      typeof f.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(f.sha256)
    ) {
      const relHint = f && typeof f.rel === 'string' ? f.rel : '(无法解析条目)'
      throw new Error(`manifest 条目缺 sha256(或字段不完整): ${relHint}(旧格式快照不认,拒绝恢复)`)
    }
  }
  return m as BackupManifest
}

export interface RestorePlan {
  snapshotDir: string
  destSessions: string
  destProjects: string
  manifest: BackupManifest
}

/** 收集一个目录树下的全部文件(绝对路径);目录不存在返回空 */
function collectFilesUnder(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  const walk = (dir: string): void => {
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch {
      return
    }
    for (const name of names) {
      const p = join(dir, name)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) walk(p)
      else if (st.isFile()) out.push(p)
    }
  }
  walk(root)
  return out
}

/** 目标侧 rel(与备份腿 relToSourceAbs 的前缀约定一致,反向映射到目标根) */
function relToDestAbs(rel: string, destSessions: string, destProjects: string): string {
  return relToSourceAbs(rel, destSessions, destProjects)
}

export type RestoreDiffKind = 'missing' | 'mismatch' | 'match'

export interface RestoreDiffEntry {
  entry: BackupFileEntry
  kind: RestoreDiffKind
  /** mismatch 时目标侧当前 sha256(与快照 sha 对照,零内容) */
  destSha?: string
}

export interface RestoreDiff {
  missing: RestoreDiffEntry[]
  mismatch: RestoreDiffEntry[]
  match: RestoreDiffEntry[]
  /** 目标根下快照外多余文件计数(只提示,绝不动) */
  extraCount: number
}

/**
 * 只读比对:对 manifest 逐文件看目标侧状态(缺失/漂移/一致),
 * 同时统计目标根下快照外多余文件(只计数)。
 */
export function computeRestoreDiff(plan: RestorePlan): RestoreDiff {
  const missing: RestoreDiffEntry[] = []
  const mismatch: RestoreDiffEntry[] = []
  const match: RestoreDiffEntry[] = []
  for (const entry of plan.manifest.files) {
    const destAbs = relToDestAbs(entry.rel, plan.destSessions, plan.destProjects)
    if (!existsSync(destAbs)) {
      missing.push({ entry, kind: 'missing' })
      continue
    }
    let destSha = ''
    try {
      destSha = sha256Of(readFileSync(destAbs))
    } catch {
      missing.push({ entry, kind: 'missing' })
      continue
    }
    if (destSha === entry.sha256) match.push({ entry, kind: 'match' })
    else mismatch.push({ entry, kind: 'mismatch', destSha })
  }
  // 多余文件:目标根下有、快照没有的,只计数,绝不移动/删除
  const manifestRels = new Set(plan.manifest.files.map((f) => f.rel))
  let extraCount = 0
  for (const [root, prefix] of [
    [plan.destSessions, 'workspace/'],
    [plan.destProjects, ''],
  ] as const) {
    for (const abs of collectFilesUnder(root)) {
      const rel = prefix + relative(root, abs).split(sep).join('/')
      if (!manifestRels.has(rel)) extraCount++
    }
  }
  return { missing, mismatch, match, extraCount }
}

/** 预览文本:路径+字节+sha 前 12 位,零内容回显 */
export function formatDiff(plan: RestorePlan, diff: RestoreDiff, dryRun: boolean): string {
  const lines: string[] = []
  lines.push(
    dryRun
      ? `会话库恢复·预览(dry-run;加 --apply 才真回填,漂移文件还需 --force)`
      : `会话库恢复·执行`,
  )
  lines.push(`快照: ${plan.snapshotDir}`)
  lines.push(`目标: sessions=${plan.destSessions} projects=${plan.destProjects}`)
  lines.push(
    `差异: 缺失 ${diff.missing.length} 个,漂移 ${diff.mismatch.length} 个,已一致(跳过) ${diff.match.length} 个`,
  )
  const show = (title: string, list: RestoreDiffEntry[]): void => {
    lines.push(`${title}:`)
    const shown = list.slice(0, 15)
    for (const e of shown) {
      if (e.kind === 'mismatch') {
        lines.push(
          `  [漂移] ${e.entry.rel} (${e.entry.bytes}B, 目标sha:${(e.destSha ?? '').slice(0, 12)} → 快照sha:${e.entry.sha256.slice(0, 12)})`,
        )
      } else {
        lines.push(
          `  [缺失] ${e.entry.rel} (${e.entry.bytes}B, sha:${e.entry.sha256.slice(0, 12)})`,
        )
      }
    }
    if (list.length > shown.length) lines.push(`  …其余 ${list.length - shown.length} 个`)
  }
  if (diff.missing.length > 0) show('将恢复(目标缺失)', diff.missing)
  if (diff.mismatch.length > 0)
    show('将漂移拒绝(目标存在但 sha 不一致;--force 才覆盖)', diff.mismatch)
  if (diff.extraCount > 0)
    lines.push(`目标侧多出 ${diff.extraCount} 个快照外文件:不移动不删除(本工具不是删除工具)`)
  return lines.join('\n')
}

export interface RestoreStats {
  restored: number
  skipped: number
  failed: number
  totalBytes: number
}

/**
 * 执行恢复(写面,仅 --apply 路径可达)。
 * - 漂移文件存在且未 --force → 整批拒绝(零写入,宁可拒做不静默覆盖);
 * - 逐文件:读快照 → 写 `<目标>.restoring-<ts>` 临时名 → sha256 校验 → 原子 rename;
 *   任一步失败即清掉临时残留,记账失败继续下一个(可重跑补齐);
 * - 收工全量对账:已恢复文件逐个回读比对 sha,对不上即抛错。
 */
export function applyRestore(plan: RestorePlan, opts?: { force?: boolean }): RestoreStats {
  const diff = computeRestoreDiff(plan)
  if (diff.mismatch.length > 0 && !opts?.force) {
    throw new Error(
      `整批拒绝: ${diff.mismatch.length} 个目标文件与快照 sha 不一致,未指定 --force(宁可拒做,不静默覆盖)。` +
        `如确认覆盖请加 --force:\n` +
        diff.mismatch
          .slice(0, 10)
          .map((e) => `  ${e.entry.rel}`)
          .join('\n'),
    )
  }
  const ts = Date.now()
  const todo = [...diff.missing, ...(opts?.force ? diff.mismatch : [])]
  const restored: BackupFileEntry[] = []
  const failures: string[] = []
  for (const { entry } of todo) {
    const destAbs = relToDestAbs(entry.rel, plan.destSessions, plan.destProjects)
    const tmpAbs = `${destAbs}.restoring-${ts}`
    try {
      const buf = readFileSync(relToSnapshotAbs(entry.rel, plan.snapshotDir))
      if (sha256Of(buf) !== entry.sha256) {
        failures.push(`${entry.rel}: 快照侧内容与 manifest 不一致(sha256 漂移)`)
        continue
      }
      mkdirSync(join(destAbs, '..'), { recursive: true })
      writeFileSync(tmpAbs, buf)
      if (sha256Of(readFileSync(tmpAbs)) !== entry.sha256) {
        failures.push(`${entry.rel}: 临时文件校验不过`)
        try {
          unlinkSync(tmpAbs)
        } catch {
          /* 清理尽力而为,失败在对账阶段暴露 */
        }
        continue
      }
      renameSync(tmpAbs, destAbs)
      restored.push(entry)
    } catch (err) {
      failures.push(`${entry.rel}: ${(err as Error).message}`)
      try {
        if (existsSync(tmpAbs)) unlinkSync(tmpAbs)
      } catch {
        /* 清理尽力而为 */
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `恢复未完成: ${failures.length} 个文件失败(已成功 ${restored.length} 个保留,可重跑补齐):\n` +
        failures.slice(0, 10).join('\n'),
    )
  }
  // 收工全量对账:所有已恢复文件回读比对,对不上即报错(不留半写状态)
  for (const entry of restored) {
    const destAbs = relToDestAbs(entry.rel, plan.destSessions, plan.destProjects)
    let got = ''
    try {
      got = sha256Of(readFileSync(destAbs))
    } catch {
      got = '(读不到)'
    }
    if (got !== entry.sha256) {
      throw new Error(`收工对账失败: ${entry.rel} 目标侧 sha256 与快照不一致,拒绝收工`)
    }
  }
  return {
    restored: restored.length,
    skipped: diff.match.length,
    failed: failures.length,
    totalBytes: restored.reduce((s, f) => s + f.bytes, 0),
  }
}

/** main 注入缝:测试/调用方可覆盖 snapshot 与目标根,免碰真实 ~/.workbuddy */
export interface RestorePaths {
  snapshotDir?: string
  destSessions?: string
  destProjects?: string
}

function parseArgs(argv: string[]): {
  snapshot?: string
  apply: boolean
  force: boolean
  destSessions?: string
  destProjects?: string
} {
  const val = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  return {
    snapshot: val('--snapshot'),
    apply: argv.includes('--apply'),
    force: argv.includes('--force'),
    destSessions: val('--dest-sessions'),
    destProjects: val('--dest-projects'),
  }
}

export function main(argv: string[] = process.argv.slice(2), paths?: RestorePaths): number {
  const args = parseArgs(argv)
  const snapshotDir = args.snapshot ?? paths?.snapshotDir
  try {
    if (!snapshotDir) throw new Error('缺少 --snapshot <快照目录>(旧格式无 manifest 的快照不认)')
    const manifest = loadManifest(snapshotDir)
    // 目标根默认回快照记录的原源根;--dest-* / 注入缝可指他处(搬家形态)
    const destSessions = args.destSessions ?? paths?.destSessions ?? manifest.source.sessionsRoot
    const destProjects = args.destProjects ?? paths?.destProjects ?? manifest.source.projectsRoot
    const plan: RestorePlan = { snapshotDir, destSessions, destProjects, manifest }
    if (!args.apply) {
      console.log(formatDiff(plan, computeRestoreDiff(plan), true))
      console.log('\n(dry-run;未写入任何路径。确认后加 --apply 执行)')
      return 0
    }
    const stats = applyRestore(plan, { force: args.force })
    console.log(
      `恢复完成: 恢复 ${stats.restored} 个(${stats.totalBytes}B),跳过 ${stats.skipped} 个(已一致),失败 ${stats.failed} 个`,
    )
    return 0
  } catch (err) {
    console.error(`会话恢复失败: ${(err as Error).message}`)
    return 1
  }
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href
if (isDirectRun) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
