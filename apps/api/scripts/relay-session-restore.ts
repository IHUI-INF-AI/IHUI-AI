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
 * - 目标根下快照外多余文件一律不动(本工具不是删除工具),只在输出提示计数;
 * - 动前留底+逐条记账(2026-10-27 增,逐条可撤,与搬移腿 move_ops.jsonl 同风格):
 *   apply 对真会写(缺失/force 覆盖)的目标文件,凡覆盖已存在者先拷动前内容到
 *   `<快照目录>/restore-ops/<opId>/before/<rel>`(opId=UTC 时间戳);全部动作零内容
 *   记入 `<快照目录>/restore-ops/ops.jsonl`(逐文件 restore 条 + restore-run 汇总);
 * - undo --op <opId> [--apply]:按该 op 日志逐条回退(留底放回/删新增),默认 dry-run;
 *   当前内容与 apply 后 sha 不一致(疑被第三方改动)→ 整批拒绝,宁拒不静默覆盖;
 *   --list-ops 列历史操作(id/时刻/文件数)。
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
 * - 动前留底:目标已存在(即将被覆盖)先拷动前内容到 `<opsRoot>/<opId>/before/<rel>`,
 *   留底不过关即拒写该文件(宁可不写,不丢动前内容);
 * - 逐文件:读快照 → 写 `<目标>.restoring-<ts>` 临时名 → sha256 校验 → 原子 rename;
 *   任一步失败即清掉临时残留,记账失败继续下一个(可重跑补齐);
 * - 逐条记账:成功落地文件零内容记入 `<opsRoot>/ops.jsonl` + restore-run 汇总
 *   (写循环后即记:整批中途失败时,已落地部分仍可按日志逐条回退);
 * - 收工全量对账:已恢复文件逐个回读比对 sha,对不上即抛错。
 */
export interface RestoreApplyOpts {
  force?: boolean
  /** 记账/留底根,默认 `<快照目录>/restore-ops`;测试可注入隔离 */
  opsRoot?: string
}

export function applyRestore(plan: RestorePlan, opts?: RestoreApplyOpts): RestoreStats {
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
  const opsRoot = opts?.opsRoot ?? join(plan.snapshotDir, 'restore-ops')
  const opId = newOpId()
  const opAt = new Date().toISOString()
  const todo = [...diff.missing, ...(opts?.force ? diff.mismatch : [])]
  const restored: BackupFileEntry[] = []
  const opFileEntries: RestoreOpFileEntry[] = []
  const failures: string[] = []
  for (const { entry } of todo) {
    const destAbs = relToDestAbs(entry.rel, plan.destSessions, plan.destProjects)
    const tmpAbs = `${destAbs}.restoring-${ts}`
    let before: { exists: boolean; sha256: string | null } = { exists: false, sha256: null }
    try {
      const buf = readFileSync(relToSnapshotAbs(entry.rel, plan.snapshotDir))
      if (sha256Of(buf) !== entry.sha256) {
        failures.push(`${entry.rel}: 快照侧内容与 manifest 不一致(sha256 漂移)`)
        continue
      }
      // 动前留底:目标已存在(即将被覆盖)先拷动前内容;留底校验不过就拒写
      if (existsSync(destAbs)) {
        const beforeBuf = readFileSync(destAbs)
        const beforeSha = sha256Of(beforeBuf)
        const beforeAbs = join(opsRoot, opId, 'before', ...entry.rel.split('/'))
        mkdirSync(join(beforeAbs, '..'), { recursive: true })
        writeFileSync(beforeAbs, beforeBuf)
        if (sha256Of(readFileSync(beforeAbs)) !== beforeSha) {
          failures.push(`${entry.rel}: 动前留底校验不过,拒绝覆盖`)
          continue
        }
        before = { exists: true, sha256: beforeSha }
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
      opFileEntries.push({
        op: opId,
        type: 'restore',
        file: entry.rel,
        before,
        afterSha: entry.sha256,
        bytes: entry.bytes,
        at: opAt,
      })
    } catch (err) {
      failures.push(`${entry.rel}: ${(err as Error).message}`)
      try {
        if (existsSync(tmpAbs)) unlinkSync(tmpAbs)
      } catch {
        /* 清理尽力而为 */
      }
    }
  }
  // 逐条记账(放在失败判定之前:整批未完成时,已落地部分也可按日志逐条回退)
  const runEntry: RestoreRunEntry = {
    op: opId,
    type: 'restore-run',
    files: todo.length,
    restored: restored.length,
    failed: failures.length,
    at: opAt,
  }
  appendRestoreOps(opsRoot, [...opFileEntries, runEntry])
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

// ── 逐条可撤:记账 / undo / --list-ops(2026-10-27 增,与搬移腿 move_ops.jsonl 同风格)──

/** ops.jsonl 单条(restore):零内容,只有 rel/sha/字节 */
export interface RestoreOpFileEntry {
  op: string
  type: 'restore'
  /** 快照 manifest 同系 rel(POSIX 斜杠) */
  file: string
  /** 动前状态:被覆盖时为留底 sha;原不存在则 exists=false */
  before: { exists: boolean; sha256: string | null }
  /** apply 写入后的 sha(= 快照 manifest sha) */
  afterSha: string
  bytes: number
  at: string
}

/** ops.jsonl 汇总条(restore-run):整轮 apply 收尾追加一行 */
export interface RestoreRunEntry {
  op: string
  type: 'restore-run'
  files: number
  restored: number
  failed: number
  at: string
}

/** ops.jsonl 回退条(undo):undo 动作自身追加,refOp 指向被回退的 restore op */
export interface RestoreUndoOpEntry {
  op: string
  type: 'undo'
  refOp: string
  entries: {
    file: string
    action: 'restore-before' | 'delete' | 'skip-missing' | 'skip-already'
    bytes: number
    sha256: string | null
  }[]
  at: string
}

export type RestoreJournalEntry = RestoreOpFileEntry | RestoreRunEntry | RestoreUndoOpEntry

/** opId:UTC 时间戳(ISO 去分隔符,毫秒精度,如 20261027T081512387Z) */
export function newOpId(now = new Date()): string {
  return now.toISOString().replace(/[-:.]/g, '')
}

function appendRestoreOps(opsRoot: string, entries: RestoreJournalEntry[]): void {
  mkdirSync(opsRoot, { recursive: true })
  writeFileSync(
    join(opsRoot, 'ops.jsonl'),
    entries.map((e) => JSON.stringify(e)).join('\n') + '\n',
    { flag: 'a' },
  )
}

/** 读 ops.jsonl(坏行跳过:日志只追加,不因半行坏数据卡死) */
export function readRestoreOps(opsRoot: string): RestoreJournalEntry[] {
  const f = join(opsRoot, 'ops.jsonl')
  if (!existsSync(f)) return []
  const out: RestoreJournalEntry[] = []
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (line.trim() === '') continue
    try {
      out.push(JSON.parse(line) as RestoreJournalEntry)
    } catch {
      /* 坏行跳过 */
    }
  }
  return out
}

/** 日志 rel 防目录穿越:只认 `/` 分隔,拒绝空段/点段/盘符/反斜杠 */
function assertSafeRel(rel: string): void {
  if (
    rel.includes('\\') ||
    /^[a-zA-Z]:/.test(rel) ||
    rel.split('/').some((p) => p === '' || p === '.' || p === '..')
  ) {
    throw new Error(`ops 日志 rel 不安全,拒绝: ${rel}`)
  }
}

export interface RestoreUndoItem {
  file: string
  action: 'restore-before' | 'delete' | 'skip-missing' | 'skip-already'
  destAbs: string
  /** before.exists=true 时的留底文件绝对路径 */
  beforeAbs: string | null
  bytes: number
  /** restore-before 的目标 sha(=动前留底 sha);delete 为 afterSha;跳过类为 null */
  sha256: string | null
  currentSha: string | null
}

export interface RestoreUndoPlan {
  refOp: string
  items: RestoreUndoItem[]
}

/**
 * undo 计划(纯只读):按 op=<opId> 的 restore 条目逐条反推。
 * - before.exists=true → 用留底放回(留底缺失/sha 不符、或当前内容≠afterSha 即
 *   疑被第三方改动 → 整批拒绝,零写入);当前已在动前状态 → 跳过(幂等);
 * - before.exists=false → 删除 apply 写入的文件(仅当前 sha==afterSha 才删;
 *   已不在 → 跳过;被改过 → 整批拒绝);
 * - 日志中已有 refOp 指向本 op 的 undo 条 → 拒绝重复回退。
 */
export function planUndoRestore(
  opId: string,
  opsRoot: string,
  destSessions: string,
  destProjects: string,
): RestoreUndoPlan {
  const ops = readRestoreOps(opsRoot)
  const fileEntries = ops.filter(
    (e): e is RestoreOpFileEntry => e.type === 'restore' && e.op === opId,
  )
  if (fileEntries.length === 0) {
    throw new Error(
      `restore-ops 日志中无 op=${opId} 的 restore 条目(${join(opsRoot, 'ops.jsonl')})`,
    )
  }
  if (ops.some((e) => e.type === 'undo' && e.refOp === opId)) {
    throw new Error(`op=${opId} 已被回退过(日志中有 refOp 记录),拒绝重复回退`)
  }
  const items: RestoreUndoItem[] = []
  const refused: string[] = []
  for (const e of fileEntries) {
    assertSafeRel(e.file)
    const destAbs = relToDestAbs(e.file, destSessions, destProjects)
    let currentSha: string | null = null
    if (existsSync(destAbs)) {
      try {
        currentSha = sha256Of(readFileSync(destAbs))
      } catch {
        currentSha = '(读不到)'
      }
    }
    if (e.before.exists) {
      const beforeAbs = join(opsRoot, opId, 'before', ...e.file.split('/'))
      let beforeSha: string | null = null
      try {
        beforeSha = sha256Of(readFileSync(beforeAbs))
      } catch {
        /* 读不到按缺失处理 */
      }
      if (beforeSha === null || beforeSha !== e.before.sha256) {
        refused.push(`${e.file}: 动前留底缺失或 sha 不符,拒绝回退`)
        continue
      }
      if (currentSha === e.before.sha256) {
        // 已在动前状态(如重复 dry-run 后补 --apply):幂等跳过
        items.push({
          file: e.file,
          action: 'skip-already',
          destAbs,
          beforeAbs,
          bytes: e.bytes,
          sha256: null,
          currentSha,
        })
        continue
      }
      if (currentSha !== null && currentSha !== e.afterSha) {
        refused.push(`${e.file}: 当前内容 sha 与 apply 后不一致(疑被第三方改动),拒绝回退`)
        continue
      }
      items.push({
        file: e.file,
        action: 'restore-before',
        destAbs,
        beforeAbs,
        bytes: e.bytes,
        sha256: e.before.sha256,
        currentSha,
      })
    } else {
      if (currentSha !== null && currentSha !== e.afterSha) {
        refused.push(`${e.file}: 当前内容 sha 与 apply 写入不一致(疑被第三方改动),拒绝删除`)
        continue
      }
      items.push({
        file: e.file,
        action: currentSha === null ? 'skip-missing' : 'delete',
        destAbs,
        beforeAbs: null,
        bytes: e.bytes,
        sha256: null,
        currentSha,
      })
    }
  }
  if (refused.length > 0) {
    throw new Error(
      `整批拒绝回退: ${refused.length} 个文件状态对不上(未写入任何路径,宁拒不静默覆盖):\n` +
        refused
          .slice(0, 10)
          .map((s) => `  ${s}`)
          .join('\n'),
    )
  }
  return { refOp: opId, items }
}

export function formatUndoPlan(plan: RestoreUndoPlan, dryRun: boolean): string {
  const lines: string[] = []
  lines.push(`会话库恢复·回退 · ${dryRun ? '预览(dry-run;加 --apply 才动)' : '执行'}`)
  lines.push(`回退对象 op: ${plan.refOp}`)
  const count = (a: RestoreUndoItem['action']): number =>
    plan.items.filter((i) => i.action === a).length
  lines.push(
    `将动 ${plan.items.length} 个文件(放回动前 ${count('restore-before')} 个,` +
      `删除新增 ${count('delete')} 个,跳过 ${count('skip-missing') + count('skip-already')} 个)`,
  )
  const shown = plan.items.slice(0, 15)
  for (const i of shown) {
    if (i.action === 'restore-before') {
      lines.push(`  [放回动前] ${i.file} (${i.bytes}B, sha:${(i.sha256 ?? '').slice(0, 12)})`)
    } else if (i.action === 'delete') {
      lines.push(`  [删除新增] ${i.file} (sha:${(i.sha256 ?? '').slice(0, 12)})`)
    } else if (i.action === 'skip-missing') {
      lines.push(`  [跳过·已不在] ${i.file}`)
    } else {
      lines.push(`  [跳过·已是动前] ${i.file}`)
    }
  }
  if (plan.items.length > shown.length) lines.push(`  …其余 ${plan.items.length - shown.length} 个`)
  return lines.join('\n')
}

/**
 * 执行回退(仅 --apply 路径可达):放回走 临时名→sha256 校验→原子改名;删除在计划阶段
 * 已核对当前 sha==afterSha。收尾追加 undo 记账(refOp 指向被回退的 op)。
 * 中途对不上即抛错停手,已落地部分保留现场。
 */
export function applyUndoRestore(
  plan: RestoreUndoPlan,
  opts: { opsRoot: string },
): { restored: number; deleted: number; skipped: number } {
  const ts = Date.now()
  let restored = 0
  let deleted = 0
  let skipped = 0
  const journal: RestoreUndoOpEntry['entries'] = []
  for (const item of plan.items) {
    if (item.action === 'skip-missing' || item.action === 'skip-already') {
      skipped++
      journal.push({ file: item.file, action: item.action, bytes: 0, sha256: null })
      continue
    }
    if (item.action === 'delete') {
      unlinkSync(item.destAbs)
      deleted++
      journal.push({ file: item.file, action: 'delete', bytes: item.bytes, sha256: null })
      continue
    }
    const buf = readFileSync(item.beforeAbs!)
    if (sha256Of(buf) !== item.sha256) {
      throw new Error(
        `回退中止: ${item.file} 留底 sha 校验不过(已落地 ${restored + deleted} 个,现场保留)`,
      )
    }
    mkdirSync(join(item.destAbs, '..'), { recursive: true })
    const tmpAbs = `${item.destAbs}.undoing-${ts}`
    writeFileSync(tmpAbs, buf)
    if (sha256Of(readFileSync(tmpAbs)) !== item.sha256) {
      try {
        unlinkSync(tmpAbs)
      } catch {
        /* 清理尽力而为 */
      }
      throw new Error(
        `回退中止: ${item.file} 临时文件校验不过(已落地 ${restored + deleted} 个,现场保留)`,
      )
    }
    renameSync(tmpAbs, item.destAbs)
    restored++
    journal.push({
      file: item.file,
      action: 'restore-before',
      bytes: buf.length,
      sha256: item.sha256,
    })
  }
  appendRestoreOps(opts.opsRoot, [
    {
      op: newOpId(),
      type: 'undo',
      refOp: plan.refOp,
      entries: journal,
      at: new Date().toISOString(),
    },
  ])
  return { restored, deleted, skipped }
}

/** --list-ops:历史操作(id/时刻/文件数),零内容 */
export function formatOpsList(opsRoot: string): string {
  const ops = readRestoreOps(opsRoot)
  const lines: string[] = []
  lines.push(`restore-ops 日志: ${join(opsRoot, 'ops.jsonl')}`)
  if (ops.length === 0) {
    lines.push('  (空)')
    return lines.join('\n')
  }
  for (const e of ops) {
    if (e.type === 'restore-run') {
      lines.push(
        `  ${e.op}  ${e.at}  restore  files=${e.files} restored=${e.restored} failed=${e.failed}`,
      )
    } else if (e.type === 'undo') {
      lines.push(`  ${e.op}  ${e.at}  undo  refOp=${e.refOp} files=${e.entries.length}`)
    }
  }
  return lines.join('\n')
}

/** main 注入缝:测试/调用方可覆盖 snapshot 与目标根,免碰真实 ~/.workbuddy */
export interface RestorePaths {
  snapshotDir?: string
  destSessions?: string
  destProjects?: string
  /** 记账/留底根,默认 `<snapshotDir>/restore-ops`;测试可注入隔离 */
  opsRoot?: string
}

function parseArgs(argv: string[]): {
  snapshot?: string
  apply: boolean
  force: boolean
  undo?: string
  listOps: boolean
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
    undo: val('--undo'),
    listOps: argv.includes('--list-ops'),
    destSessions: val('--dest-sessions'),
    destProjects: val('--dest-projects'),
  }
}

export function main(argv: string[] = process.argv.slice(2), paths?: RestorePaths): number {
  const args = parseArgs(argv)
  const snapshotDir = args.snapshot ?? paths?.snapshotDir
  try {
    // --list-ops:列历史操作(只需定位 restore-ops,不读 manifest 不动目标)
    if (args.listOps) {
      const opsRoot = paths?.opsRoot ?? (snapshotDir ? join(snapshotDir, 'restore-ops') : undefined)
      if (!opsRoot)
        throw new Error('--list-ops 需要 --snapshot <快照目录>(历史在其 restore-ops/ 下)')
      console.log(formatOpsList(opsRoot))
      return 0
    }
    if (!snapshotDir) throw new Error('缺少 --snapshot <快照目录>(旧格式无 manifest 的快照不认)')
    const manifest = loadManifest(snapshotDir)
    // 目标根默认回快照记录的原源根;--dest-* / 注入缝可指他处(搬家形态)
    const destSessions = args.destSessions ?? paths?.destSessions ?? manifest.source.sessionsRoot
    const destProjects = args.destProjects ?? paths?.destProjects ?? manifest.source.projectsRoot
    // --undo:回退模式(与恢复 --apply 互斥;--undo 自身默认 dry-run,加 --apply 才动)
    if (args.undo) {
      const opsRoot = paths?.opsRoot ?? join(snapshotDir, 'restore-ops')
      const plan = planUndoRestore(args.undo, opsRoot, destSessions, destProjects)
      const text = formatUndoPlan(plan, !args.apply)
      if (!args.apply) {
        console.log(text)
        console.log('\n(dry-run;未写入任何路径。确认后加 --apply)')
        return 0
      }
      const r = applyUndoRestore(plan, { opsRoot })
      console.log(
        text +
          `\n\n回退完成: 放回 ${r.restored} 个,删除 ${r.deleted} 个,跳过 ${r.skipped} 个;` +
          `记账 ${join(opsRoot, 'ops.jsonl')}`,
      )
      return 0
    }
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
