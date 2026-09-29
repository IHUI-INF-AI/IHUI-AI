// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * patch 文本渲染降级守卫(2026-09-30 立,吸收批次 74 W1 票 G-977967)。
 *
 * 纯函数:输入整段 patch 文本 → 结构化判定 { mode, reason, fileCount, truncatedLineCount? }。
 * 判 fallback 的输入统一走轻量文本预览,判 render 才允许进真正的 diff 渲染组件。
 *
 * 机制(吸收自上游 patch 渲染降级链,判据我方重写):
 *  - 自有多文件计数器:无 `diff --git` 头时按 `---/+++` 头对 + hunk 声明行数逐行消费正文;
 *    消费中一旦探测到完整 `---`/`+++` 文件头对立即收束当前 hunk——LLM 常见的 hunk 行数
 *    off-by-one 若不设防,多出的配额会把下一个文件头当删除/新增行"吃掉",多文件被误计成单文件;
 *  - 截断场景(正文提前结束)保守按「一个文件」计数,避免把截断的多文件 patch 少算;
 *  - 降级判据链:无文件头 / 多文件 / 新建删除(/dev/null) / 超大(>1200 行或 180k 字符) /
 *    深 hunk 行号(>1200) / metadata-only(rename-only、mode-only) / lockfile / .gradle(.kts);
 *  - 截断提示只给 marker token(`\ __IHUI_DIFF_TRUNCATED__:n` 形态)与省略行数,
 *    lib 层不拼任何展示文案,具体语言由组件层 i18n 渲染。
 */

export type PatchDiffFallbackReason =
  | 'no-file-diff'
  | 'multiple-files'
  | 'created-or-deleted'
  | 'oversized'
  | 'deep-hunk-line'
  | 'metadata-only'
  | 'lockfile'
  | 'gradle-script'

export interface PatchDiffGuardDecision {
  mode: 'render' | 'fallback'
  /** fallback 时给出首个命中的判据;render 时为 null */
  reason: PatchDiffFallbackReason | null
  /** 按自有计数器判定的文件 diff 数 */
  fileCount: number
  /**
   * 行数超安全预算时被省略的行数(仅行数超限时给出;字符超限无行数语义不设此字段)。
   * 组件层据此渲染截断 marker 文案。
   */
  truncatedLineCount?: number
}

/** 单文件 patch 的安全行数上限,超出后渲染器同步解析会长时间占用主线程 */
const MAX_SAFE_PATCH_LINES = 1_200
/** 单文件 patch 的安全字符上限 */
const MAX_SAFE_PATCH_CHARS = 180_000
/** hunk 行号安全上限:大文件只改尾部一行时 hunk 行号会落在很深的位置,同样易卡渲染 */
const MAX_SAFE_HUNK_LINE_NUMBER = 1_200

/** 截断 marker token 前缀(行形态 `\ __IHUI_DIFF_TRUNCATED__:<省略行数>`) */
export const DIFF_TRUNCATION_MARKER_PREFIX = '\\ __IHUI_DIFF_TRUNCATED__:'

const TRUNCATION_MARKER_RE = /^\\ __IHUI_DIFF_TRUNCATED__:(\d+)$/

/** 生成截断 marker 行(marker token,非用户可读文案;展示文案在组件层 i18n) */
export function buildTruncationMarkerLine(omittedLineCount: number): string {
  return `${DIFF_TRUNCATION_MARKER_PREFIX}${omittedLineCount}`
}

/** 识别截断 marker 行并取出省略行数;非 marker 行返回 null */
export function parseTruncationMarkerOmittedCount(line: string): number | null {
  const match = TRUNCATION_MARKER_RE.exec(line)
  if (!match) {
    return null
  }
  const omitted = Number.parseInt(match[1] ?? '', 10)
  if (!Number.isFinite(omitted) || omitted <= 0) {
    return null
  }
  return omitted
}

/** 常见包管理器 lockfile:全量快照内容,渲染价值低且极易超大,固定降级 */
const LOCKFILE_NAMES = new Set([
  'bun.lock',
  'bun.lockb',
  'npm-shrinkwrap.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
])

/** Gradle 脚本常被按扩展名识别成普通 text,提前降级防同步解析卡住主线程 */
const FORCE_FALLBACK_PATH_SUFFIXES = ['.gradle', '.gradle.kts']

interface HunkRange {
  oldLines: number
  newLines: number
}

/** 解析 `@@ -a[,b] +c[,d] @@`;缺省计数按 1(unified 规范) */
function parseHunkRange(line: string): HunkRange | null {
  const match = line.match(/^@@\s-\d+(?:,(\d+))?\s\+\d+(?:,(\d+))?\s@@/)
  if (!match) {
    return null
  }
  return {
    oldLines: Number(match[1] ?? '1'),
    newLines: Number(match[2] ?? '1'),
  }
}

function isFileHeaderPair(lines: readonly string[], index: number): boolean {
  return (
    (lines[index]?.startsWith('--- ') ?? false) &&
    (lines[index + 1]?.startsWith('+++ ') ?? false)
  )
}

/**
 * 按 hunk 头声明的行数逐行消费正文,返回消费结束游标;正文非法/提前结束返回 null。
 * 关键防线:消费中探测到完整 `---`/`+++` 文件头对立即收束——声明行数偏大(off-by-one)
 * 时,若继续消费会把下一个文件头当成 `-`/`+` 正文行吃掉,多文件 patch 被误计成单文件。
 */
function consumeHunkBody(
  lines: readonly string[],
  start: number,
  oldLines: number,
  newLines: number,
): number | null {
  let cursor = start
  let remainingOld = oldLines
  let remainingNew = newLines

  while (remainingOld > 0 || remainingNew > 0) {
    const line = lines[cursor]
    if (line === undefined) {
      return null
    }

    if (isFileHeaderPair(lines, cursor)) {
      return cursor
    }

    // `\ No newline at end of file` 不占行数配额
    if (line.startsWith('\\ ')) {
      cursor += 1
      continue
    }

    if (line.startsWith(' ')) {
      remainingOld -= 1
      remainingNew -= 1
    } else if (line.startsWith('-')) {
      remainingOld -= 1
    } else if (line.startsWith('+')) {
      remainingNew -= 1
    } else {
      return null
    }

    if (remainingOld < 0 || remainingNew < 0) {
      return null
    }
    cursor += 1
  }

  while (lines[cursor]?.startsWith('\\ ')) {
    cursor += 1
  }
  return cursor
}

/**
 * 数 patch 里的文件 diff 数:
 *  - 有 `diff --git` 头时直接按头数(最可靠边界);
 *  - 否则按 `---`/`+++` 头对识别文件,逐 hunk 按声明行数消费正文防行数误判;
 *    正文消费失败但出现过 hunk 头时保守按「一个文件」计,防截断的多文件 patch 被少算。
 */
export function countPatchFileDiffs(patch: string): number {
  const lines = patch.split(/\r?\n/)
  const gitHeaderCount = lines.filter((line) => line.startsWith('diff --git ')).length
  if (gitHeaderCount > 0) {
    return gitHeaderCount
  }

  let diffCount = 0
  let cursor = 0

  while (cursor < lines.length) {
    const oldHeader = lines[cursor]
    const newHeader = lines[cursor + 1]
    if (!oldHeader?.startsWith('--- ') || !newHeader?.startsWith('+++ ')) {
      cursor += 1
      continue
    }

    let hunkCursor = cursor + 2
    let hasHunk = false
    let sawHunkHeader = false

    while (hunkCursor < lines.length) {
      const hunkRange = parseHunkRange(lines[hunkCursor] ?? '')
      if (!hunkRange) {
        break
      }
      sawHunkHeader = true

      const nextCursor = consumeHunkBody(
        lines,
        hunkCursor + 1,
        hunkRange.oldLines,
        hunkRange.newLines,
      )
      if (nextCursor === null) {
        break
      }

      hasHunk = true
      hunkCursor = nextCursor
    }

    if (!hasHunk && !sawHunkHeader) {
      cursor += 1
      continue
    }

    diffCount += 1
    cursor = hasHunk ? hunkCursor : cursor + 2
  }

  return diffCount
}

function isHunkHeaderLine(line: string): boolean {
  return line === '@@' || line.startsWith('@@ ')
}

/** hunk 头里出现的最大行号(unified 语义:start + count - 1,缺省 count=1) */
function getMaxHunkLineNumber(lines: readonly string[]): number {
  let maxLineNumber = 0

  for (const line of lines) {
    if (!line.startsWith('@@ ')) {
      continue
    }
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (!match) {
      continue
    }
    const oldStart = Number.parseInt(match[1] ?? '0', 10)
    const oldCount = Number.parseInt(match[2] ?? '1', 10)
    const newStart = Number.parseInt(match[3] ?? '0', 10)
    const newCount = Number.parseInt(match[4] ?? '1', 10)
    const oldEnd = oldStart + Math.max(0, Number.isNaN(oldCount) ? 1 : oldCount) - 1
    const newEnd = newStart + Math.max(0, Number.isNaN(newCount) ? 1 : newCount) - 1
    maxLineNumber = Math.max(maxLineNumber, oldEnd, newEnd)
  }

  return maxLineNumber
}

/**
 * 从文件头取首个真实路径(跳过 /dev/null)。
 * 标准头允许路径后接 tab 分隔时间戳,先剥掉,防 `x.gradle\t2026-...` 绕过按后缀降级。
 */
function getPatchContentFileName(lines: readonly string[]): string | null {
  for (const line of lines) {
    if (!line.startsWith('--- ') && !line.startsWith('+++ ')) {
      continue
    }
    const fileName = line.slice(4).trim().split('\t', 1)[0]?.trim() ?? ''
    if (!fileName || fileName === '/dev/null') {
      continue
    }
    return fileName
  }
  return null
}

/** 剥 unified 头惯用的 a/ b/ 前缀 */
function normalizePatchFileName(fileName: string): string {
  return fileName.replace(/^[ab]\//, '')
}

function isLockfileFileName(fileName: string | null): boolean {
  if (!fileName) {
    return false
  }
  const leaf = normalizePatchFileName(fileName).split('/').at(-1)?.toLowerCase() ?? ''
  return LOCKFILE_NAMES.has(leaf)
}

function isGradleScriptFileName(fileName: string | null): boolean {
  if (!fileName) {
    return false
  }
  const normalized = normalizePatchFileName(fileName).toLowerCase()
  return FORCE_FALLBACK_PATH_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
}

/**
 * metadata 行:非空且不属于 diff 协议头(`diff --git` / `index` / `---` / `+++`)的行。
 * rename-only / mode-only patch 没有 hunk,但仍有用户需要看的变更信息。
 */
function countMetadataLines(lines: readonly string[]): number {
  return lines.filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      return false
    }
    return (
      !line.startsWith('diff --git ') &&
      !line.startsWith('index ') &&
      !line.startsWith('--- ') &&
      !line.startsWith('+++ ')
    )
  }).length
}

/**
 * 降级判据主入口。判据按确定性优先序评估:
 * 无文件头 → 多文件 → 新建/删除 → 超大 → 深行号 → metadata-only → lockfile → .gradle → render。
 * 任一 fallback 命中且行数超预算时附带 truncatedLineCount(组件层据此出截断 marker)。
 */
export function decidePatchDiffRender(patch: string): PatchDiffGuardDecision {
  const lines = patch.split(/\r?\n/)
  const fileCount = countPatchFileDiffs(patch)

  const buildFallback = (reason: PatchDiffFallbackReason): PatchDiffGuardDecision => ({
    mode: 'fallback',
    reason,
    fileCount,
    ...(lines.length > MAX_SAFE_PATCH_LINES
      ? { truncatedLineCount: lines.length - MAX_SAFE_PATCH_LINES }
      : {}),
  })

  // 无文件头:apply_patch 片段/裸 hunk/纯文本,渲染器要求「恰好一个带头文件 diff」,必须直接降级
  if (fileCount === 0) {
    return buildFallback('no-file-diff')
  }

  // 多文件:渲染器只吃单文件 patch,拼接多文件的输入会在渲染阶段抛错
  if (fileCount > 1) {
    return buildFallback('multiple-files')
  }

  // 新建/删除文件本来就是整文件快照,统一走轻量文本保展开态始终有可读内容
  const isCreatedFile = lines.some((line) => line === '--- /dev/null')
  const isDeletedFile = lines.some((line) => line === '+++ /dev/null')
  if (isCreatedFile || isDeletedFile) {
    return buildFallback('created-or-deleted')
  }

  // 超大:千行级 patch 展开时的同步解析会长时间占用主线程,表现为整页点不动
  if (lines.length > MAX_SAFE_PATCH_LINES || patch.length > MAX_SAFE_PATCH_CHARS) {
    return buildFallback('oversized')
  }

  // 深 hunk 行号:大文件只改 1 行时 hunk 行号落在很深位置(如 1500+),渲染同样可能长时间卡顿
  if (getMaxHunkLineNumber(lines) > MAX_SAFE_HUNK_LINE_NUMBER) {
    return buildFallback('deep-hunk-line')
  }

  // metadata-only:没有 hunk 的 rename-only/mode-only patch 保留元信息走轻量预览
  if (!lines.some(isHunkHeaderLine) && countMetadataLines(lines) > 0) {
    return buildFallback('metadata-only')
  }

  const fileName = getPatchContentFileName(lines)
  if (isLockfileFileName(fileName)) {
    return buildFallback('lockfile')
  }
  if (isGradleScriptFileName(fileName)) {
    return buildFallback('gradle-script')
  }

  return { mode: 'render', reason: null, fileCount }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
