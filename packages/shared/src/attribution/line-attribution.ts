// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 行级归因的纯函数实现(写入标记 / 人工翻转 / 压缩 / 越权查询)。
 *
 * 三条硬规则(与验收反向例一一对应):
 *   1. **只信 diff**:新增/改动行的归属由 `computeDiffHunks` / `parseUnifiedDiff` 的实际结果决定,
 *      不看"调用参数里的整文件内容",更不看"内容是否相同"。
 *   2. **删除即失去归属**:某行被删除后,即便另一处再插入逐字相同的内容,新行也只是 human
 *      (或 ai-then-human),绝不因为"内容一样"被认领回 ai。
 *   3. **未知按 human**:没有记录的行一律视为 human,少报 AI 是安全方向。
 */

import type {
  AttributionOrigin,
  AttributionRange,
  AttributionSource,
  LineAttribution,
} from './types'
import { computeDiffHunks, parseUnifiedDiff, splitLines, type DiffHunk } from './diff'

/** 没有更早记录的行(来源未知)——按 human 处理,origin 的 at 为空串表示"未知时刻"。 */
export const UNKNOWN_ORIGIN: AttributionOrigin = { at: '' }

/** 归因变更的可选入参(时间与版本必须显式可注入,纯函数才能单测)。 */
export interface AttributionApplyOptions {
  at?: string
  revision?: number
  filePath?: string
  /** 变更前文件的真实行数。纯插入 hunk 无法自证"文件尾部还有多少行",调用方知道就必须给。 */
  beforeLineCount?: number
}

interface LineState {
  source: AttributionSource
  origin: AttributionOrigin
}

/**
 * 把记录展开为逐行状态(1-based → 索引 0 起)。越界 / 重叠记录以**后写覆盖**为准,
 * 与 `compressAttribution` 的合并顺序一致。
 */
export function expandLineStates(
  records: readonly LineAttribution[],
  lineCount: number,
): LineState[] {
  const states: LineState[] = new Array(lineCount)
  for (let i = 0; i < lineCount; i += 1) states[i] = { source: 'human', origin: UNKNOWN_ORIGIN }
  for (const record of records) {
    const start = Math.max(1, record.startLine)
    const end = Math.min(lineCount, record.endLine)
    for (let line = start; line <= end; line += 1) {
      states[line - 1] = { source: record.source, origin: record.origin }
    }
  }
  return states
}

/** 记录里出现的最大行号(用于没有 hunk 时保持原长度)。 */
function maxRecordedLine(records: readonly LineAttribution[]): number {
  let max = 0
  for (const record of records) max = Math.max(max, record.endLine)
  return max
}

function sameOrigin(a: AttributionOrigin, b: AttributionOrigin): boolean {
  return (
    a.at === b.at &&
    a.agentId === b.agentId &&
    a.sessionId === b.sessionId &&
    a.toolCallId === b.toolCallId &&
    a.model === b.model
  )
}

/** 逐行状态 → 压缩后的区间记录(相邻且同源同源的合并为一条)。 */
export function compressLineStates(
  states: readonly LineState[],
  filePath: string,
  revision: number,
): AttributionRange[] {
  const ranges: AttributionRange[] = []
  for (let i = 0; i < states.length; i += 1) {
    const state = states[i]!
    const prev = ranges[ranges.length - 1]
    if (
      prev &&
      prev.endLine === i &&
      prev.source === state.source &&
      sameOrigin(prev.origin, state.origin)
    ) {
      prev.endLine = i + 1
      continue
    }
    ranges.push({
      filePath,
      startLine: i + 1,
      endLine: i + 1,
      source: state.source,
      origin: state.origin,
      revision,
    })
  }
  return ranges
}

/**
 * 核心:按 hunk 把旧逐行状态映射到新逐行状态。
 *
 * - context 行:沿用旧状态(行号按 hunk 偏移自然跟随);
 * - add 行:`mode === 'ai'` ⇒ `ai`;人工编辑 ⇒ 该 hunk 旧区间内**曾有 AI 行**时记 `ai-then-human`,
 *   否则记 `human`(纯插入不认领任何 AI 归属);
 * - del 行:直接消失(其归属不转移给任何新行)。
 */
function applyHunks(
  records: readonly LineAttribution[],
  hunks: readonly DiffHunk[],
  mode: 'ai' | 'human',
  newOrigin: AttributionOrigin,
  options: AttributionApplyOptions,
): AttributionRange[] {
  if (hunks.length === 0) {
    return compressAttribution([...records], {
      filePath: options.filePath,
      revision: options.revision,
    })
  }
  const filePath = options.filePath ?? records[0]?.filePath ?? ''
  const revision = options.revision ?? (records[0]?.revision ?? 0) + 1
  const oldLen = Math.max(
    maxRecordedLine(records),
    options.beforeLineCount ?? 0,
    // 只统计 hunk 实际消费到的旧行;纯插入 hunk(oldCount=0)不抬高旧文件长度
    ...hunks.map((h) => h.oldStart + h.oldCount - 1),
  )
  const oldStates = expandLineStates(records, oldLen)
  const out: LineState[] = []

  let cursor = 0 // 旧文件 0-based 游标
  for (const hunk of hunks) {
    // oldCount>0 时旧区间从 oldStart-1 起消费;oldCount===0 时插入点就在「前 oldStart 行之后」
    const hunkOldStart = hunk.oldCount > 0 ? hunk.oldStart - 1 : hunk.oldStart
    // 拷贝 hunk 之前的未变更行(状态原样跟随)
    while (cursor < hunkOldStart && cursor < oldLen) {
      out.push(oldStates[cursor]!)
      cursor += 1
    }
    // 重叠/乱序 hunk 防御:旧指针不得回退(回退会重复拷贝行)
    cursor = Math.max(cursor, hunkOldStart)
    const oldRangeStart = hunkOldStart
    const oldRangeEnd = hunkOldStart + hunk.oldCount - 1 // inclusive, 0-based
    let hadAi = false
    for (let i = Math.max(0, oldRangeStart); i <= oldRangeEnd && i < oldLen; i += 1) {
      const state = oldStates[i]!
      if (state.source === 'ai' || state.source === 'ai-then-human') hadAi = true
    }
    for (const line of hunk.lines) {
      if (line.kind === 'del') {
        cursor += 1
        continue
      }
      if (line.kind === 'context') {
        out.push(oldStates[cursor] ?? { source: 'human', origin: UNKNOWN_ORIGIN })
        cursor += 1
        continue
      }
      const source: AttributionSource = mode === 'ai' ? 'ai' : hadAi ? 'ai-then-human' : 'human'
      out.push({ source, origin: newOrigin })
    }
    // 防御:header 行数与块体不一致时,以块体为准补齐
    if (cursor < oldRangeEnd + 1) cursor = Math.max(cursor, oldRangeEnd + 1)
  }
  while (cursor < oldLen) {
    out.push(oldStates[cursor]!)
    cursor += 1
  }
  return compressLineStates(out, filePath, revision)
}

/** 压缩记录(对外查询口径):空白/非法区间丢弃,相邻同源同源合并。 */
export function compressAttribution(
  records: readonly LineAttribution[],
  options: { filePath?: string; revision?: number } = {},
): AttributionRange[] {
  const filePath = options.filePath ?? records[0]?.filePath ?? ''
  const valid = records.filter(
    (r) =>
      Number.isInteger(r.startLine) &&
      Number.isInteger(r.endLine) &&
      r.startLine >= 1 &&
      r.endLine >= r.startLine,
  )
  if (valid.length === 0) return []
  const len = maxRecordedLine(valid)
  const states = expandLineStates(valid, len)
  const revision = options.revision ?? Math.max(...valid.map((r) => r.revision ?? 0))
  return compressLineStates(states, filePath, revision).map((r) => ({ ...r, filePath }))
}

/**
 * AI 落盘路径的唯一记录入口:给定**落盘前/后的真实内容**,算出实际改动行并标记为 ai。
 * 未改动行沿用旧归属(例如人工改过的行仍是 ai-then-human)。
 */
export function recordAiAttribution(
  old: readonly LineAttribution[],
  before: string,
  after: string,
  origin: AttributionOrigin,
  options: AttributionApplyOptions = {},
): AttributionRange[] {
  const hunks = computeDiffHunks(before, after)
  return applyHunks(old, hunks, 'ai', origin, {
    ...options,
    beforeLineCount: options.beforeLineCount ?? splitLines(before).length,
  })
}

/**
 * 人工编辑后的归因翻转(验收指定的纯函数形状):入参是**标准 unified diff**。
 * 空 diff 原样返回(只做压缩,不产生新记录)。
 */
export function reconcileAttribution(
  old: readonly LineAttribution[],
  humanDiff: string,
  options: AttributionApplyOptions = {},
): AttributionRange[] {
  const origin: AttributionOrigin = { at: options.at ?? new Date().toISOString() }
  return applyHunks(old, parseUnifiedDiff(humanDiff), 'human', origin, options)
}

/** 人工编辑落盘时,由真实前后内容生成 diff 再翻转(避免手写 diff 造成口径漂移)。 */
export function applyHumanEdit(
  old: readonly LineAttribution[],
  before: string,
  after: string,
  options: AttributionApplyOptions = {},
): AttributionRange[] {
  const origin: AttributionOrigin = { at: options.at ?? new Date().toISOString() }
  return applyHunks(old, computeDiffHunks(before, after), 'human', origin, {
    ...options,
    beforeLineCount: options.beforeLineCount ?? splitLines(before).length,
  })
}

/** 逐行来源(UI 渲染用):索引 i 对应第 i+1 行。 */
export function resolveLineSources(
  records: readonly LineAttribution[],
  lineCount: number,
): AttributionSource[] {
  return expandLineStates(records, lineCount).map((s) => s.source)
}

/** 文本行数(与 splitLines 同口径)。 */
export function countLines(text: string): number {
  return splitLines(text).length
}

// =============================================================================
// 读取面:越权/跨工作区查询的**唯一判据**
// =============================================================================

/** 路径段归一(反斜杠→'/',折叠 '.'/'..',保留大小写)。 */
export function normalizePathSegments(input: string): string {
  const isAbsolute = /^[A-Za-z]:/.test(input) || input.startsWith('/') || input.startsWith('\\')
  const parts: string[] = []
  for (const segment of input.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (parts.length > 0) parts.pop()
      else if (!isAbsolute) parts.push('..')
      continue
    }
    parts.push(segment)
  }
  const joined = parts.join('/')
  return isAbsolute ? `/${joined}` : joined
}

/**
 * 解析目标文件相对工作区根的路径。
 * 越界(绝对路径不在根内、`..` 逃逸、跨盘符)一律返回 `null` —— 调用方据此拒绝(**403/404**),
 * 绝不"回显一个看起来正常的路径"。
 */
export function resolveWorkspaceRelativePath(workspacePath: string, file: string): string | null {
  const root = normalizePathSegments(workspacePath)
  if (!root) return null
  const raw = normalizePathSegments(file)
  if (!raw) return null
  const absolute = normalizePathSegments(raw.startsWith('/') ? raw : `${root}/${raw}`)
  if (!absolute) return null
  const rootLower = root.toLowerCase()
  const absLower = absolute.toLowerCase()
  if (absLower !== rootLower && !absLower.startsWith(`${rootLower}/`)) return null
  return absolute.slice(root.length + 1)
}

export type AttributionQueryOutcome =
  | { ok: true; file: string; ranges: AttributionRange[] }
  | { ok: false; status: 403 | 404; reason: 'outside_workspace' | 'attribution_not_found' }

/**
 * 归属查询(HTTP 路由与本地 UI 共用同一条判据):
 *   - 目标不在本工作区内 ⇒ 403(禁止跨 workspace 回显);
 *   - 在本工作区内但没有该文件的归属 ⇒ 404(不得把别的工作区的记录"顺带"返回)。
 */
export function queryAttribution(input: {
  workspacePath: string
  file: string
  records: readonly LineAttribution[]
}): AttributionQueryOutcome {
  const relative = resolveWorkspaceRelativePath(input.workspacePath, input.file)
  if (relative === null) return { ok: false, status: 403, reason: 'outside_workspace' }
  const target = relative.toLowerCase()
  const matched = input.records.filter(
    (record) => normalizePathSegments(record.filePath).toLowerCase() === target,
  )
  if (matched.length === 0) return { ok: false, status: 404, reason: 'attribution_not_found' }
  return { ok: true, file: relative, ranges: compressAttribution(matched) }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
