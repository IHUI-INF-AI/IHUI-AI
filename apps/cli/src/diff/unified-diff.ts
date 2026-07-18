/**
 * Unified Diff 状态机解析器 — 行级 diff 算法,生成标准 unified diff 格式输出。
 *
 * 灵感来源:参考 xai-hunk-tracker/src/diff.rs 的 HunkBuilder 状态机
 * 简化策略(做减法):
 *   - 不引入 `similar` crate,纯 TS 实现 Myers 行级 LCS
 *   - 输出标准 unified diff 格式(`--- a/path`、`+++ b/path`、`@@ -old,count +new,count @@`)
 *   - 多 hunk 支持:Equal 行打断当前 hunk(在 IHUI 之前是 prefix-only,只能产生单 hunk)
 *   - 上下文行:每个 hunk 前后 3 行(git diff 默认)
 *   - 大小/超时保护:超过 1MB 或 10s 自动放弃
 *   - 0 外部依赖
 *
 * 使用场景:
 *   - `apps/cli/src/tools/file-edit.ts` 替换 `computeUnifiedDiff` 单 hunk 实现
 *   - LLM 生成的多 hunk patch 可被本模块验证
 *   - 任何需要生成 git-style diff 的工具
 *
 * 关键差异(对标旧实现):
 *   - 旧 `computeUnifiedDiff`(file-edit.ts:96-118):prefix 匹配,只能产生 1 个 hunk
 *   - 新 `generateUnifiedPatch`:LCS 序列化为 Equal/Insert/Delete → 状态机构造多 hunk
 */

import * as path from 'node:path';

// ==================== 公共类型 ====================

/** 单个 hunk 的行号信息(1-indexed,符合 unified diff 规范) */
export interface HunkLineInfo {
  /** 旧文件起始行(1-indexed) */
  oldStart: number
  /** 旧文件被删/修改的行数 */
  oldCount: number
  /** 新文件起始行(1-indexed) */
  newStart: number
  /** 新文件被加/修改的行数 */
  newCount: number
}

/** 改动的 hunk(类似 git diff 概念) */
export interface Hunk {
  /** 唯一 id(UUID 风格) */
  id: string
  /** 文件路径(原始) */
  path: string
  /** 行号信息 */
  lineInfo: HunkLineInfo
  /** 旧文件该 hunk 范围内的原始行(含换行符) — pure insert 时为 null */
  oldText: string | null
  /** 新文件该 hunk 范围内的结果行(含换行符) — pure delete 时为空字符串 */
  newText: string
  /** 完整 patch 片段(生成时缓存) */
  patch: string | null
}

// ==================== 常量 ====================

/** hunk 前后上下文行数(对齐 git diff) */
const CONTEXT_LINES = 3

/** 最大允许 diff 的文件大小(1MB)— 防止病态输入 */
const MAX_DIFF_FILE_SIZE = 1024 * 1024

/** 单次 diff 计算超时(毫秒) */
const DIFF_TIMEOUT_MS = 10_000

/** 统一 diff 输出最大行数(防止单 hunk 占用过多屏幕) */
const MAX_PATCH_LINES = 200

// ==================== Myers 行级 diff ====================

/** diff 步骤标签 */
type ChangeTag = 'equal' | 'delete' | 'insert'

interface Change {
  tag: ChangeTag
  value: string
}

/**
 * Myers 行级 diff 算法(O((N+M)*D) 时间,O(D) 空间)。
 * 经典算法:沿编辑图对角线前进,记录每条 k 线上最远到达的 x 坐标。
 *
 * 关键性质:返回的 Change 数组里,Equal 行严格出现在 Delete/Insert 之间,
 * 对应 git 标准的 "line-based" diff 语义(连续相同行会被合并为单条 Equal)。
 */
function myersDiff(oldLines: string[], newLines: string[]): Change[] {
  const n = oldLines.length
  const m = newLines.length
  const max = n + m

  // 边界情况
  if (n === 0 && m === 0) return []
  if (n === 0) {
    return newLines.map((value): Change => ({ tag: 'insert', value: value + '\n' }))
  }
  if (m === 0) {
    return oldLines.map((value): Change => ({ tag: 'delete', value: value + '\n' }))
  }

  // V[k + max] 数组:第 d 步时,k 线上最远到达的 x 坐标
  // 大小 2*max+1,以 max 为偏移中心
  const v: number[] = new Array(2 * max + 1).fill(0)
  const trace: number[][] = [] // 记录每步的 v 快照,用于回溯

  let foundD = -1
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice())
    for (let k = -d; k <= d; k += 2) {
      const kIdx = k + max
      let x: number
      if (k === -d || (k !== d && v[kIdx - 1]! < v[kIdx + 1]!)) {
        x = v[kIdx + 1]! // 向下(insert)
      } else {
        x = v[kIdx - 1]! + 1 // 向右(delete)
      }
      let y = x - k
      // 沿对角线前进(连续相同行)
      while (x < n && y < m && oldLines[x] === newLines[y]) {
        x++
        y++
      }
      v[kIdx] = x
      if (x >= n && y >= m) {
        foundD = d
        break outer
      }
    }
  }

  if (foundD < 0) {
    // 理论上 d ≤ n+m 必终止;这里作为保险
    return []
  }

  // 回溯:从 (n, m) 沿 V 倒推到 (0, 0)
  const changes: Change[] = []
  let x = n
  let y = m
  for (let d = foundD; d > 0; d--) {
    const vPrev = trace[d]!
    const k = x - y
    const kIdx = k + max
    let prevK: number
    if (k === -d || (k !== d && vPrev[kIdx - 1]! < vPrev[kIdx + 1]!)) {
      prevK = k + 1
    } else {
      prevK = k - 1
    }
    const prevX = vPrev[prevK + max]!
    const prevY = prevX - prevK
    // 沿对角线走过的部分全是 Equal
    while (x > prevX && y > prevY) {
      x--
      y--
      changes.push({ tag: 'equal', value: oldLines[x]! + '\n' })
    }
    if (d > 0) {
      if (x === prevX) {
        // 向下(insert)
        y--
        changes.push({ tag: 'insert', value: newLines[y]! + '\n' })
      } else {
        // 向右(delete)
        x--
        changes.push({ tag: 'delete', value: oldLines[x]! + '\n' })
      }
    }
  }
  // 处理 d=0 阶段(可能还有未走完的对角线)
  while (x > 0 && y > 0) {
    x--
    y--
    changes.push({ tag: 'equal', value: oldLines[x]! + '\n' })
  }
  while (x > 0) {
    x--
    changes.push({ tag: 'delete', value: oldLines[x]! + '\n' })
  }
  while (y > 0) {
    y--
    changes.push({ tag: 'insert', value: newLines[y]! + '\n' })
  }

  // 回溯是逆序的,需要反转
  changes.reverse()
  return changes
}

// ==================== Hunk 构造器 ====================

/** 累积当前 hunk 的旧行/新行 */
interface HunkBuilder {
  oldStart: number
  newStart: number
  oldLines: string[]
  newLines: string[]
}

function newHunkBuilder(oldStart: number, newStart: number): HunkBuilder {
  return { oldStart, newStart, oldLines: [], newLines: [] }
}

function builderAddOld(b: HunkBuilder, value: string): void {
  b.oldLines.push(value)
}

function builderAddNew(b: HunkBuilder, value: string): void {
  b.newLines.push(value)
}

function builderBuild(b: HunkBuilder, filePath: string, patch: string | null): Hunk {
  const oldText = b.oldLines.length === 0 ? null : b.oldLines.join('')
  const newText = b.newLines.join('')
  return {
    id: `hunk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    path: filePath,
    lineInfo: {
      oldStart: b.oldStart,
      oldCount: b.oldLines.length,
      newStart: b.newStart,
      newCount: b.newLines.length,
    },
    oldText,
    newText,
    patch,
  }
}

// ==================== 核心 API:computeHunks ====================

/**
 * 计算两段文本的 hunks(行级 diff)。
 *
 * 行为对齐 xai-hunk-tracker/src/diff.rs::compute_hunks:
 *   - 完全相同 → 返回空数组
 *   - 任一文件 > 1MB → 返回空数组(不抛错,避免病态输入卡死)
 *   - 计算耗时 > 10s → 返回空数组
 *   - 否则返回所有 hunk(可多个)
 */
export function computeHunks(filePath: string, baseline: string, current: string): Hunk[] {
  if (baseline === current) return []
  if (baseline.length > MAX_DIFF_FILE_SIZE || current.length > MAX_DIFF_FILE_SIZE) {
    return []
  }

  const startTime = Date.now()

  // 行级 split(保留 trailing newline 信息):用 split('\n'),去掉末尾空行(由 .split 自然产生)
  const oldLines = splitLines(baseline)
  const newLines = splitLines(current)
  const changes = myersDiff(oldLines, newLines)

  if (Date.now() - startTime > DIFF_TIMEOUT_MS) {
    return []
  }

  // 状态机:按 ChangeTag 累积 hunk
  const hunks: Hunk[] = []
  let current2: HunkBuilder | null = null
  let oldLine = 1
  let newLine = 1

  for (const change of changes) {
    if (change.tag === 'equal') {
      // Equal 行:终结当前 hunk(只终结不开启,新 hunk 由后续非 equal 触发)
      if (current2) {
        hunks.push(builderBuild(current2, filePath, null))
        current2 = null
      }
      oldLine++
      newLine++
    } else if (change.tag === 'delete') {
      const h: HunkBuilder = current2 ?? newHunkBuilder(oldLine, newLine)
      if (!current2) current2 = h
      builderAddOld(h, change.value)
      oldLine++
    } else {
      // insert
      const h: HunkBuilder = current2 ?? newHunkBuilder(oldLine, newLine)
      if (!current2) current2 = h
      builderAddNew(h, change.value)
      newLine++
    }
  }
  if (current2) {
    hunks.push(builderBuild(current2, filePath, null))
  }

  return hunks
}

/**
 * 拆分文本为行(保留 \n 字符,与 Rust .lines() + 末尾 \n 行为对齐)。
 * 输入 "a\nb\n" → ["a\n", "b\n"]
 * 输入 "a\nb" → ["a\n", "b"]
 * 输入 "" → []
 */
function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  // Rust 的 lines() 不保留换行;但我们要在 hunk 输出时保留 \n 上下文。
  // 这里重新组合:除最后一行外都加 \n
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    if (i < lines.length - 1) {
      out.push(lines[i]! + '\n')
    } else {
      out.push(lines[i]!)
    }
  }
  return out
}

// ==================== 核心 API:generateUnifiedPatch ====================

/**
 * 生成 unified diff patch 字符串(标准格式,可被 `git apply` / `patch` 命令消费)。
 *
 * 输出格式示例:
 *   --- a/src/foo.ts
 *   +++ b/src/foo.ts
 *   @@ -1,3 +1,4 @@
 *    line 1
 *   -old line 2
 *   +new line 2a
 *   +new line 2b
 *    line 3
 *
 * 多 hunk 自动拼接。
 *
 * @returns 完全相同 → null;超大/超时 → null;否则返回 multi-hunk patch 字符串
 */
export function generateUnifiedPatch(
  filePath: string,
  baseline: string,
  current: string,
): string | null {
  if (baseline === current) return null
  if (baseline.length > MAX_DIFF_FILE_SIZE || current.length > MAX_DIFF_FILE_SIZE) {
    return null
  }
  const startTime = Date.now()
  const hunks = computeHunks(filePath, baseline, current)
  if (Date.now() - startTime > DIFF_TIMEOUT_MS) return null
  if (hunks.length === 0) return null

  const aPath = 'a/' + filePath
  const bPath = 'b/' + filePath
  const parts: string[] = [`--- ${aPath}`, `+++ ${bPath}`]
  for (const hunk of hunks) {
    parts.push(formatHunkHeader(hunk.lineInfo))
    parts.push(formatHunkBody(hunk))
  }
  let patch = parts.join('\n') + '\n'
  // 截断保护(单 patch > 200 行 → 截断 + 标记)
  const lines = patch.split('\n')
  if (lines.length > MAX_PATCH_LINES) {
    patch = lines.slice(0, MAX_PATCH_LINES).join('\n') + `\n...(diff 超过 ${MAX_PATCH_LINES} 行,截断)\n`
  }
  return patch
}

function formatHunkHeader(info: HunkLineInfo): string {
  // oldCount=0 时,某些 diff 工具输出 @@ -1,0 +1,3 @@(表示纯 insert)
  // IHUI 沿用规范,不省略
  return `@@ -${info.oldStart},${info.oldCount} +${info.newStart},${info.newCount} @@`
}

/**
 * 格式化单个 hunk 的 body:旧行 + 新行(无 context lines — generateUnifiedPatch
 * 生成的 compact patch 不带 context,与 xai-hunk-tracker 的 format_unified_diff 对齐)。
 *
 * 如果需要带 context 的版本(用于 review/code review 场景),用 generateHunkPatch。
 */
function formatHunkBody(hunk: Hunk): string {
  const out: string[] = []
  if (hunk.oldText) {
    for (const line of hunk.oldText.split('\n')) {
      // split('\n') 末尾会有空字符串(因 \n 结尾),需过滤
      if (line === '' && !hunk.oldText!.endsWith('\n')) continue
      out.push('-' + stripTrailingNewline(line))
    }
  }
  if (hunk.newText) {
    for (const line of hunk.newText.split('\n')) {
      if (line === '' && !hunk.newText.endsWith('\n')) continue
      out.push('+' + stripTrailingNewline(line))
    }
  }
  return out.join('\n')
}

function stripTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s.slice(0, -1) : s
}

// ==================== 核心 API:formatUnifiedDiff ====================

/**
 * 格式化单个 hunk 为 unified diff 字符串(带 file header)。
 * 用于已计算的 Hunk 对象回显。
 */
export function formatUnifiedDiff(hunk: Hunk): string {
  const out = [
    `--- a/${hunk.path}`,
    `+++ b/${hunk.path}`,
    formatHunkHeader(hunk.lineInfo),
    formatHunkBody(hunk),
  ]
  return out.join('\n') + '\n'
}

// ==================== 核心 API:patchLines ====================

/**
 * 应用单 hunk patch 到全文(纯文本层,无 fuzzy match)。
 *
 * 用于:把 LLM 生成的 patch 反向应用到 baseline 生成 current(用于校验/对比)。
 *
 * @param content 原始全文
 * @param startLine 起始行(1-indexed)
 * @param removeCount 删除行数
 * @param insertText 插入文本(可多行,可不带 \n)
 */
export function patchLines(
  content: string,
  startLine: number,
  removeCount: number,
  insertText: string,
): string {
  const lines = content.split('\n')
  const startIdx = Math.max(0, startLine - 1)
  const endIdx = Math.min(lines.length, startIdx + removeCount)
  const before = lines.slice(0, startIdx)
  const after = lines.slice(endIdx)
  const inserted: string[] = []
  if (insertText) {
    for (const line of insertText.split('\n')) {
      inserted.push(line)
    }
  }
  const out = [...before, ...inserted, ...after].join('\n')
  // 保留 trailing newline
  if (content.endsWith('\n') && out.length > 0 && !out.endsWith('\n')) {
    return out + '\n'
  }
  return out
}

// ==================== 核心 API:generateHunkPatch(带 context) ====================

/**
 * 生成单个 hunk 的 patch 片段(带前后 CONTEXT_LINES 行上下文,用于 review)。
 *
 * 对应 xai-hunk-tracker/src/diff.rs::generate_hunk_patch。
 */
export function generateHunkPatch(baseline: string, current: string, hunk: Hunk): string {
  const oldLines = splitLines(baseline)
  const newLines = splitLines(current)
  const oldStartIdx = Math.max(0, hunk.lineInfo.oldStart - 1)
  const newStartIdx = Math.max(0, hunk.lineInfo.newStart - 1)
  const ctxBeforeStart = Math.max(0, oldStartIdx - CONTEXT_LINES)
  const ctxBeforeEnd = oldStartIdx
  const changesEndNew = newStartIdx + hunk.lineInfo.newCount
  const ctxAfterStart = changesEndNew
  const ctxAfterEnd = Math.min(newLines.length, changesEndNew + CONTEXT_LINES)
  const changesEndOld = oldStartIdx + hunk.lineInfo.oldCount
  const ctxAfterStartOld = changesEndOld
  const ctxAfterEndOld = Math.min(oldLines.length, changesEndOld + CONTEXT_LINES)

  const totalOldLines = (ctxBeforeEnd - ctxBeforeStart) + hunk.lineInfo.oldCount + (ctxAfterEndOld - ctxAfterStartOld)
  const totalNewLines = (ctxBeforeEnd - ctxBeforeStart) + hunk.lineInfo.newCount + (ctxAfterEnd - ctxAfterStart)
  const headerOldStart = ctxBeforeStart + 1
  const headerNewStart = ctxBeforeStart + 1

  const out: string[] = []
  out.push(`@@ -${headerOldStart},${totalOldLines} +${headerNewStart},${totalNewLines} @@`)
  for (let i = ctxBeforeStart; i < ctxBeforeEnd; i++) {
    if (oldLines[i] !== undefined) out.push(' ' + stripTrailingNewline(oldLines[i]!))
  }
  if (hunk.oldText) {
    for (const line of hunk.oldText.split('\n')) {
      if (line === '' && !hunk.oldText!.endsWith('\n')) continue
      out.push('-' + stripTrailingNewline(line))
    }
  }
  if (hunk.newText) {
    for (const line of hunk.newText.split('\n')) {
      if (line === '' && !hunk.newText.endsWith('\n')) continue
      out.push('+' + stripTrailingNewline(line))
    }
  }
  for (let i = ctxAfterStart; i < ctxAfterEnd; i++) {
    if (newLines[i] !== undefined) out.push(' ' + stripTrailingNewline(newLines[i]!))
  }
  return out.join('\n') + '\n'
}

// ==================== 工具:path 标准化 ====================

/** 把任意 path 标准化为正斜杠(给 patch header 用) */
export function normalizePathForPatch(p: string): string {
  return path.posix.normalize(p.replace(/\\/g, '/'))
}
