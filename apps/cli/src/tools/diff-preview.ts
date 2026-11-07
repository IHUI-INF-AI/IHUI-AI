// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 编辑工具执行前的 unified diff 预览 —— write_file / edit_file 专用纯模块。
 *
 * 设计理由:
 *   - 现状(file-edit.ts:493)是"先落盘、后 computeUnifiedDiff 打印":执行前只有
 *     file-edit-preview.ts 的"新内容片段",既没有可读 unified diff,也没有确认机会。
 *   - 本模块把"从工具参数 + 磁盘现状算出将要发生的变化"抽成纯函数:不写盘、不改 mtime、
 *     不依赖工具上下文。确认/放弃门控由调用方(file-edit.ts)接线,放弃时零写入。
 *   - diff 算法不重复实现:复用 diff/unified-diff.ts 的 computeHunks + generateHunkPatch,
 *     仅在本模块拼装处修正该模块对"以 \n 结尾文本"多产出一行空变更行的既有行为
 *     (见 normalizeHunkPatch 的注释),不改动 unified-diff.ts 本身。
 *   - 渲染只产生 ANSI 转义(color 关闭时零转义),便于管道消费与测试断言。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeHunks, generateHunkPatch, type Hunk } from '../diff/unified-diff.js';
import { seekSequence } from './seek-sequence.js';

// ==================== 公共类型 ====================

export type EditPreviewKind = 'create' | 'modify' | 'delete' | 'unchanged' | 'unavailable';

export interface EditPreview {
  toolName: string;
  /** 相对工作区路径(展示用) */
  filePath: string;
  /** 绝对路径 */
  absPath: string;
  kind: EditPreviewKind;
  /** 统一 diff 文本;unavailable/unchanged 时为空串 */
  diff: string;
  oldText: string;
  newText: string;
  addedLines: number;
  removedLines: number;
  /** 是否可安全预览(false 时调用方应直接执行原工具,不弹确认) */
  applicable: boolean;
  /** applicable=false 或截断时的原因 */
  reason?: string;
  truncated: boolean;
}

export interface BuildEditPreviewInput {
  toolName: string;
  args: Record<string, unknown>;
  workspacePath: string;
  /** 默认 fs.readFileSync;测试注入假实现 */
  readFile?: (absPath: string) => string | null;
  /** 默认 64KB / 400 行 */
  maxDiffBytes?: number;
  maxDiffLines?: number;
}

// ==================== 常量 ====================

/** 默认 diff 字节预算(64KB) */
const DEFAULT_MAX_DIFF_BYTES = 64 * 1024;

/** 默认 diff 行预算(400 行) */
const DEFAULT_MAX_DIFF_LINES = 400;

/** 只有这两类工具会产生"将要落盘"的预览,其余一律 null */
const EDIT_TOOL_NAMES: ReadonlySet<string> = new Set(['write_file', 'edit_file']);

/** 与 file-edit.ts 逐字同形的 SEARCH/REPLACE 块正则(仅复制正则,不改原文件) */
const SEARCH_REPLACE_SOURCE = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;

// ==================== 路径工具(纯函数) ====================

/** 相对路径按 workspacePath 解析;绝对路径原样归一化。不做真实越界校验(工具层职责) */
function resolveAbsPath(workspacePath: string, filePath: string): string {
  return path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(workspacePath, filePath);
}

/** 展示用相对路径:正斜杠归一(Windows 下 path.relative 会给反斜杠) */
function toDisplayPath(workspacePath: string, absPath: string): string {
  const rel = path.relative(workspacePath, absPath);
  if (rel === '') return path.basename(absPath);
  return rel.split(path.sep).join('/');
}

/** 默认磁盘读取:读不到(不存在/目录/权限)一律 null,由调用方决定语义 */
function readFileFromDisk(absPath: string): string | null {
  try {
    return fs.readFileSync(absPath, 'utf-8');
  } catch {
    return null;
  }
}

// ==================== SEARCH/REPLACE 应用(镜像 file-edit.ts 判据) ====================

interface BlockApplySuccess {
  text: string;
  replacements: number;
  /** 走模糊兜底的命中等级(空数组 = 全部逐字命中) */
  fuzzyLevels: string[];
}

interface BlockApplyFailure {
  code: string;
  message: string;
}

/** 逐字计数(镜像 file-edit.ts 的 countOccurrences:非重叠、空串回 0) */
function countOccurrences(content: string, needle: string): number {
  if (needle === '') return 0;
  let count = 0;
  let position = 0;
  while (position < content.length) {
    const index = content.indexOf(needle, position);
    if (index === -1) break;
    count += 1;
    position = index + needle.length;
  }
  return count;
}

/**
 * 按 file-edit.ts 的三态判据算出"将要写入的新内容"(只算不写):
 *   - 逐字命中 >1 且未开 replace_all ⇒ AMBIGUOUS(预览不可靠,交回原工具报错);
 *   - 逐字命中 ⇒ 替换(replace_all 时用 split/join,避免 `$&`/`$$` 被解释成特殊 token);
 *   - 0 命中 ⇒ 走 seekSequence 四级模糊兜底,命中的位置按"最像的那一处"替换并记录等级;
 *   - 模糊也无命中 ⇒ OLD_STRING_NOT_FOUND。
 */
function applyEditBlocks(
  original: string,
  patch: string,
  replaceAll: boolean,
): BlockApplySuccess | BlockApplyFailure {
  let result = original;
  let replacements = 0;
  const fuzzyLevels: string[] = [];
  // 每次调用新建正则实例:避免模块级 global 正则的 lastIndex 在并发/多次调用间串味
  const re = new RegExp(SEARCH_REPLACE_SOURCE.source, SEARCH_REPLACE_SOURCE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(patch)) !== null) {
    const searchText = match[1]!;
    const replaceText = match[2]!;
    const exactCount = countOccurrences(result, searchText);
    if (exactCount > 1 && !replaceAll) {
      return {
        code: 'AMBIGUOUS_REPLACE',
        message:
          `Found ${exactCount} matches of the string to replace, but replace_all is false. ` +
          '请补充上下文使 SEARCH 唯一,或显式 replace_all。',
      };
    }
    if (exactCount > 0) {
      // 空替换删串时优先吞掉行尾换行,与真实工具一致(否则原位置会留空行)
      let needle = searchText;
      if (replaceText === '' && !searchText.endsWith('\n')) {
        const withNewline = `${searchText}\n`;
        if (result.includes(withNewline)) needle = withNewline;
      }
      const needleCount = countOccurrences(result, needle);
      if (replaceAll) {
        result = result.split(needle).join(replaceText);
        replacements += needleCount;
      } else {
        result = result.replace(needle, () => replaceText);
        replacements += 1;
      }
      continue;
    }
    const seek = seekSequence(result, searchText);
    if (!seek) {
      return {
        code: 'OLD_STRING_NOT_FOUND',
        message: `未找到匹配的文本(已尝试 4 级模糊匹配 exact/rstrip/trim/unicode):\n${searchText.slice(0, 100)}...`,
      };
    }
    result = result.slice(0, seek.index) + replaceText + result.slice(seek.index + seek.length);
    replacements++;
    fuzzyLevels.push(seek.level);
  }
  if (replacements === 0 && patch.includes('<<<<<<< SEARCH')) {
    return { code: 'PATCH_FORMAT_INVALID', message: 'patch 格式错误,未执行替换' };
  }
  return { text: result, replacements, fuzzyLevels };
}

// ==================== unified diff 生成 ====================

/**
 * 修正单个 hunk 的 patch 文本:
 *   1. generateHunkPatch 对"以 \n 结尾"的一侧会多输出一行空变更行('-' 或 '+') ——
 *      它按 split('\n') 逐段输出,末尾换行产生的空段被当成了真实行。这里按该侧文本
 *      是否以 \n 结尾,删掉最后一个纯前缀行(真正的空行变更同样只该保留一条)。
 *   2. 顺带用实际 body 重建 @@ 行计数(computeHunks 的行数在 create 场景会多算末尾空段)。
 * 只在本模块做拼装修正,不修改 unified-diff.ts。
 */
function normalizeHunkPatch(patch: string, hunk: Hunk): string {
  const lines = patch.split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const header = lines.shift();
  if (!header) return '';
  const body = lines;
  if (hunk.oldText !== null && hunk.oldText.endsWith('\n')) {
    const idx = body.lastIndexOf('-');
    if (idx !== -1) body.splice(idx, 1);
  }
  if (hunk.newText.endsWith('\n')) {
    const idx = body.lastIndexOf('+');
    if (idx !== -1) body.splice(idx, 1);
  }
  const oldCount = body.filter((line) => line.startsWith(' ') || line.startsWith('-')).length;
  const newCount = body.filter((line) => line.startsWith(' ') || line.startsWith('+')).length;
  const headerMatch = /^@@ -(\d+),\d+ \+(\d+),\d+ @@$/.exec(header);
  const fixedHeader = headerMatch
    ? `@@ -${headerMatch[1]},${oldCount} +${headerMatch[2]},${newCount} @@`
    : header;
  return [fixedHeader, ...body].join('\n');
}

/** 去掉文本末尾的全部换行:仅用于 diff 计算的归一化,不影响 kind / newText 等判定 */
function stripTrailingNewlines(text: string): string {
  return text.replace(/\n+$/, '');
}

/**
 * 反向还原 computeHunks 的 hunk 文本:
 * splitLines 产出的行本身已带 \n(最后一行除外),myersDiff 序列化时又追加一个 \n,
 * 于是 hunkText 的行边界都成了 "\n\n"。这里成对折叠回单个换行(真正的空行同样只多出一个)。
 */
function collapseDoubledNewlines(text: string): string {
  return text.replace(/\n\n/g, '\n');
}

/**
 * 拼装多 hunk 标准 unified diff(文件头固定 `--- a/<rel>` / `+++ b/<rel>`)。
 *
 * 为什么要先 stripTrailingNewlines:computeHunks 的 splitLines 会给以 \n 结尾的文本文末
 * 多挂一个空行(split('\n') 的尾段),行数与内容都会多算一行。去掉末尾换行后再 diff,
 * 行数回归真实值;若两份文本仅差末尾空行,diff 为空,调用方会按"diff 不可用"处理而非误报无变化。
 */
function buildUnifiedDiff(relPath: string, oldText: string, newText: string): string {
  const baseline = stripTrailingNewlines(oldText);
  const current = stripTrailingNewlines(newText);
  const hunks = computeHunks(relPath, baseline, current);
  if (hunks.length === 0) return '';
  const parts: string[] = [`--- a/${relPath}`, `+++ b/${relPath}`];
  for (const hunk of hunks) {
    const sanitized: Hunk = {
      ...hunk,
      oldText: hunk.oldText === null ? null : collapseDoubledNewlines(hunk.oldText),
      newText: collapseDoubledNewlines(hunk.newText),
    };
    parts.push(normalizeHunkPatch(generateHunkPatch(baseline, current, sanitized), sanitized));
  }
  return parts.join('\n') + '\n';
}

/** 统计 diff 变更行数(跳过前两行文件头;@@ 行不计) */
function countDiffStats(diff: string): { addedLines: number; removedLines: number } {
  if (diff === '') return { addedLines: 0, removedLines: 0 };
  const lines = diff.split('\n');
  let addedLines = 0;
  let removedLines = 0;
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('+')) addedLines++;
    else if (line.startsWith('-')) removedLines++;
  }
  return { addedLines, removedLines };
}

interface TruncatedDiff {
  diff: string;
  truncated: boolean;
  reason?: string;
}

/** 超行数/字节预算时保留前 N 行并标记(行优先,保证文件头与首个 hunk 头可见) */
function truncateDiff(diff: string, maxLines: number, maxBytes: number): TruncatedDiff {
  if (diff === '') return { diff, truncated: false };
  const raw = diff.endsWith('\n') ? diff.slice(0, -1) : diff;
  const lines = raw.split('\n');
  const kept: string[] = [];
  let bytes = 0;
  let truncated = false;
  for (const line of lines) {
    if (kept.length >= maxLines) {
      truncated = true;
      break;
    }
    const lineBytes = Buffer.byteLength(`${line}\n`, 'utf8');
    if (bytes + lineBytes > maxBytes) {
      truncated = true;
      break;
    }
    kept.push(line);
    bytes += lineBytes;
  }
  if (!truncated) return { diff, truncated: false };
  const note = `... (diff 已截断:超过 ${maxLines} 行或 ${maxBytes} 字节预算)`;
  return {
    diff: `${kept.join('\n')}\n${note}\n`,
    truncated: true,
    reason: `diff 超过 ${maxLines} 行或 ${maxBytes} 字节,已截断保留前 ${kept.length} 行`,
  };
}

// ==================== 预览构造 ====================

/** unavailable 预览的统一出口(调用方据此直接执行原工具,不弹确认) */
function unavailablePreview(params: {
  toolName: string;
  filePath: string;
  absPath: string;
  reason: string;
  oldText?: string;
  newText?: string;
}): EditPreview {
  return {
    toolName: params.toolName,
    filePath: params.filePath,
    absPath: params.absPath,
    kind: 'unavailable',
    diff: '',
    oldText: params.oldText ?? '',
    newText: params.newText ?? '',
    addedLines: 0,
    removedLines: 0,
    applicable: false,
    reason: params.reason,
    truncated: false,
  };
}

/**
 * 执行前预览入口。非编辑工具(write_file / edit_file 之外)一律 null。
 * 纯函数:只读磁盘(或注入的 readFile),绝不写盘、绝不改 mtime。
 */
export function buildEditPreview(input: BuildEditPreviewInput): EditPreview | null {
  const { toolName, args, workspacePath } = input;
  if (!EDIT_TOOL_NAMES.has(toolName)) return null;

  const readFile = input.readFile ?? readFileFromDisk;
  const maxDiffBytes = Math.max(1, input.maxDiffBytes ?? DEFAULT_MAX_DIFF_BYTES);
  const maxDiffLines = Math.max(1, input.maxDiffLines ?? DEFAULT_MAX_DIFF_LINES);

  const rawPath = typeof args.path === 'string' ? args.path : '';
  const absPath = rawPath === '' ? workspacePath : resolveAbsPath(workspacePath, rawPath);
  const filePath = rawPath === '' ? '' : toDisplayPath(workspacePath, absPath);

  if (rawPath === '') {
    return unavailablePreview({ toolName, filePath, absPath, reason: '缺少 path 参数' });
  }

  let kind: EditPreviewKind;
  let oldText = '';
  let newText = '';
  let reason: string | undefined;

  if (toolName === 'write_file') {
    const content = args.content;
    if (typeof content !== 'string') {
      return unavailablePreview({
        toolName,
        filePath,
        absPath,
        reason: '缺少 content 参数(需要字符串)',
      });
    }
    const disk = readFile(absPath);
    oldText = disk ?? '';
    newText = content;
    if (disk === null) kind = 'create';
    else if (content === disk) kind = 'unchanged';
    else kind = 'modify';
  } else {
    const disk = readFile(absPath);
    if (disk === null) {
      return unavailablePreview({
        toolName,
        filePath,
        absPath,
        reason: `文件不存在: ${filePath}(真实 edit_file 会直接报文件不存在)`,
      });
    }
    oldText = disk;
    const patchArg = typeof args.patch === 'string' && args.patch !== '' ? args.patch : null;
    let patchText: string;
    if (patchArg !== null) {
      patchText = patchArg;
    } else if (typeof args.search === 'string' && typeof args.replace === 'string') {
      // 与 file-edit.ts:477 同一拼装方式
      patchText = `<<<<<<< SEARCH\n${args.search}\n=======\n${args.replace}\n>>>>>>> REPLACE`;
    } else {
      return unavailablePreview({
        toolName,
        filePath,
        absPath,
        reason: '需要 search+replace 或 patch 参数',
        oldText,
      });
    }
    const applied = applyEditBlocks(oldText, patchText, args.replace_all === true);
    if ('code' in applied) {
      return unavailablePreview({
        toolName,
        filePath,
        absPath,
        reason: `${applied.code}: ${applied.message}`,
        oldText,
      });
    }
    newText = applied.text;
    kind = newText === oldText ? 'unchanged' : 'modify';
    if (applied.fuzzyLevels.length > 0) {
      reason =
        `预览按模糊匹配(${applied.fuzzyLevels.join('/')} 级命中),` +
        '落盘位置是"最像的那一处",请核对 diff 是否改在了预期位置';
    }
  }

  let diff = '';
  if (kind === 'create' || kind === 'modify') {
    diff = buildUnifiedDiff(filePath, oldText, newText);
    if (oldText !== newText && diff === '') {
      // 文件过大/计算超时被 unified-diff.ts 的预算拦下:预览不可靠,交回原工具
      return unavailablePreview({
        toolName,
        filePath,
        absPath,
        reason: 'diff 不可用(文件超过 1MB 预算或计算超时)',
        oldText,
        newText,
      });
    }
  }

  const stats = countDiffStats(diff);
  const truncated = truncateDiff(diff, maxDiffLines, maxDiffBytes);
  const reasons: string[] = [];
  if (reason) reasons.push(reason);
  if (truncated.reason) reasons.push(truncated.reason);

  return {
    toolName,
    filePath,
    absPath,
    kind,
    diff: truncated.diff,
    oldText,
    newText,
    addedLines: stats.addedLines,
    removedLines: stats.removedLines,
    applicable: true,
    reason: reasons.length > 0 ? reasons.join('; ') : undefined,
    truncated: truncated.truncated,
  };
}

// ==================== 终端渲染 ====================

/** 仅 ANSI 转义序列,不含其他控制字符 */
const ANSI = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  gray: '\u001b[90m',
} as const;

const KIND_LABELS: Readonly<Record<EditPreviewKind, string>> = {
  create: '新建',
  modify: '修改',
  delete: '删除',
  unchanged: '无变化',
  unavailable: '不可预览',
};

const KIND_ICONS: Readonly<Record<EditPreviewKind, string>> = {
  create: '🆕',
  modify: '✏️',
  delete: '🗑️',
  unchanged: '✅',
  unavailable: '⚠️',
};

function paint(text: string, code: string, color: boolean): string {
  return color ? `${code}${text}${ANSI.reset}` : text;
}

/** diff 行着色:hunk 头/@ 行暗色,- 行红,+ 行绿,上下文灰 */
function colorizeDiffLine(line: string, color: boolean): string {
  if (line.startsWith('@@')) return paint(line, ANSI.dim, color);
  if (line.startsWith('---') || line.startsWith('+++')) return paint(line, ANSI.dim, color);
  if (line.startsWith('+')) return paint(line, ANSI.green, color);
  if (line.startsWith('-')) return paint(line, ANSI.red, color);
  return paint(line, ANSI.gray, color);
}

/**
 * 终端可读渲染:标题行 + 路径 + unified diff。color 默认关闭(纯文本,便于管道与测试)。
 * 输出始终以换行结尾;关闭 color 时除换行外不含任何控制字符。
 */
export function renderEditPreview(preview: EditPreview, options?: { color?: boolean }): string {
  const color = options?.color === true;
  const title = `${KIND_ICONS[preview.kind]} ${KIND_LABELS[preview.kind]} ${preview.filePath} (+${preview.addedLines} -${preview.removedLines})`;
  const out: string[] = [title, preview.filePath];
  if (preview.reason) out.push(paint(`原因: ${preview.reason}`, ANSI.gray, color));
  if (preview.diff !== '') {
    const diffLines = preview.diff.endsWith('\n')
      ? preview.diff.slice(0, -1).split('\n')
      : preview.diff.split('\n');
    for (const line of diffLines) out.push(colorizeDiffLine(line, color));
  }
  return out.join('\n') + '\n';
}

/** REPL / 工具门控用的单行摘要,如 `✏️ 修改 src/a.ts +12 -3` */
export function summarizeEditPreview(preview: EditPreview): string {
  const icon = KIND_ICONS[preview.kind];
  const label = KIND_LABELS[preview.kind];
  if (preview.kind === 'unavailable') {
    return `${icon} ${label} ${preview.filePath}${preview.reason ? `: ${preview.reason}` : ''}`;
  }
  if (preview.kind === 'unchanged') {
    return `${icon} ${label} ${preview.filePath}`;
  }
  const suffix = preview.truncated ? ' (已截断)' : '';
  return `${icon} ${label} ${preview.filePath} +${preview.addedLines} -${preview.removedLines}${suffix}`;
}
