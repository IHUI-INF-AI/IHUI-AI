// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件编辑工具集 — write_file / edit_file / delete_file。
 *
 * 灵感来源:参考行业 Agent 框架的 tools crate 设计,融合 openai/codex 的 apply_patch。
 * 简化策略(做减法):
 *   - write_file: 全量写入(创建或覆盖)
 *   - edit_file: search-and-replace 块(对标 codex 的 apply_patch 格式)
 *   - delete_file: 删除文件
 *   - 所有写操作接入 checkpoints(编辑前自动快照)+ hooks(preToolCall/postToolCall)
 *
 * search-and-replace 格式:
 *   <<<<<<< SEARCH
 *   原始文本(精确匹配)
 *   =======
 *   替换文本
 *   >>>>>>> REPLACE
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
import { type Tool, type ToolResult, type ToolContext, checkPathWritePermission } from './index.js';
import { seekSequence, type MatchLevel } from './seek-sequence.js';
import type { CheckpointManager } from '../checkpoints/index.js';
import type { HunkTracker } from '../checkpoints/hunk-tracker.js';
import { createBatchEditTools } from './file-batch-edit.js';
import {
  AtomicReplaceFailedError,
  captureWriteBaseline,
  commitAtomicWrite,
  SymlinkTargetError,
  WriteConflictError,
} from '../util/atomic-write.js';

/**
 * 落盘失败 → ToolResult 的归一出口。
 *
 * 三类失败都必须**报得能被自修**:它们都不是"重试一次就好",而是"你手上那份内容已经不是磁盘上那份了"。
 * `errorType` 用稳定字面量,不依赖错误文本做流程判断(调用方/retry 判据都读它)。
 */
function writeFailure(e: unknown): ToolResult | null {
  if (
    e instanceof WriteConflictError ||
    e instanceof SymlinkTargetError ||
    e instanceof AtomicReplaceFailedError
  ) {
    return { success: false, output: '', error: e.message, errorType: e.code };
  }
  return null;
}

export interface EditToolContext extends ToolContext {
  checkpoints?: CheckpointManager;
  /** HunkTracker(可选,启用后记录每次改动的行范围归属 + 写入前检测冲突) */
  hunkTracker?: HunkTracker;
  /** 发起改动的 agent 标识(默认 'main',subagent 传入 subagentId) */
  agentId?: string;
}

/** 计算改动行范围(1-based, inclusive),用于 hunkTracker 记录与冲突检测 */
function computeChangedRange(original: string, modified: string): { startLine: number; endLine: number } {
  const orig = original.split('\n');
  const mod = modified.split('\n');
  if (orig.length === 0 && mod.length === 0) return { startLine: 1, endLine: 1 };
  if (orig.length === 0) return { startLine: 1, endLine: Math.max(1, mod.length) };
  let start = 0;
  while (start < orig.length && start < mod.length && orig[start] === mod[start]) start++;
  let endO = orig.length - 1;
  let endM = mod.length - 1;
  while (endO >= start && endM >= start && orig[endO] === mod[endM]) {
    endO--;
    endM--;
  }
  const startLine = start + 1;
  const endLine = Math.max(startLine, endM + 1);
  return { startLine, endLine };
}

/** 写入前检测冲突(若 hunkTracker 已注入),有冲突 console.warn 不阻塞 */
function warnConflictIfAny(ctx: EditToolContext, abs: string, startLine: number, endLine: number): void {
  if (!ctx.hunkTracker) return;
  try {
    const conflicts = ctx.hunkTracker.detectConflict(abs, startLine, endLine, ctx.agentId ?? 'main');
    if (conflicts.length > 0) {
      const summary = conflicts
        .map((c) => `[${c.source}${c.agentId ? `:${c.agentId}` : ''}] L${c.startLine}-${c.endLine}`)
        .join(', ');
      console.warn(`[hunk-tracker] 检测到 ${conflicts.length} 处冲突 (${abs}): ${summary}`);
    }
  } catch {
    // 冲突检测失败不阻塞编辑
  }
}

/** 写入成功后记录 hunk(若 hunkTracker 已注入) */
function recordHunk(ctx: EditToolContext, abs: string, startLine: number, endLine: number, content?: string): void {
  if (!ctx.hunkTracker) return;
  try {
    ctx.hunkTracker.recordAgentChange(abs, startLine, endLine, ctx.agentId ?? 'main', content);
  } catch {
    // 记录失败不阻塞编辑
  }
}

export function resolvePath(ctx: ToolContext, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(ctx.workspacePath, filePath);
}

function snapshotBeforeEdit(ctx: EditToolContext, files: string[], reason: string): void {
  if (!ctx.checkpoints) return;
  try {
    ctx.checkpoints.snapshotSync(files, reason);
  } catch {
    // 快照失败不阻塞编辑
  }
}

/** 计算简化 unified diff(公共前缀/后缀法,零依赖) */
export function computeUnifiedDiff(original: string, modified: string, filePath: string): string {
  const orig = original.split('\n');
  const mod = modified.split('\n');
  let start = 0;
  while (start < orig.length && start < mod.length && orig[start] === mod[start]) start++;
  let endO = orig.length - 1;
  let endM = mod.length - 1;
  while (endO >= start && endM >= start && orig[endO] === mod[endM]) {
    endO--;
    endM--;
  }
  const removed = orig.slice(start, endO + 1);
  const added = mod.slice(start, endM + 1);
  if (removed.length === 0 && added.length === 0) return '';
  const lines: string[] = [`@@ -${start + 1},${removed.length} +${start + 1},${added.length} @@`];
  for (const l of removed) lines.push(`-${l}`);
  for (const l of added) lines.push(`+${l}`);
  const header = `\n--- a/${filePath}\n+++ b/${filePath}\n`;
  if (lines.length > 200) {
    return header + lines.slice(0, 200).join('\n') + '\n...(diff 超过 200 行,截断)';
  }
  return header + lines.join('\n');
}

export function createWriteFileTool(ctx: EditToolContext): Tool {
  return {
    name: 'write_file',
    description: '写入文件(创建或覆盖)。参数:path(文件路径),content(文件内容)。',
    dangerLevel: 'write',
    parameters: {
      path: { type: 'string', description: '文件路径(相对工作区根目录)' },
      content: { type: 'string', description: '文件完整内容' },
    },
    required: ['path', 'content'],
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      const content = args.content as string;
      if (!filePath) return { success: false, output: '', error: '缺少 path 参数' };
      if (content === undefined) return { success: false, output: '', error: '缺少 content 参数' };

      const perm = checkPathWritePermission(filePath, ctx);
      if (!perm.allowed) return { success: false, output: '', error: perm.reason };

      const preResult = runPreToolCall('write_file', { path: filePath, cwd: ctx.workspacePath });
      if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

      const abs = resolvePath(ctx, filePath);
      try {
        // 捕获基线 ⇒ 落盘前逐字节复核:窗口内被人改过就拒绝,绝不静默覆盖(读后写校验)
        const baseline = captureWriteBaseline(abs);
        const existed = baseline.content !== null;
        const original = baseline.content ?? '';
        const { startLine, endLine } = existed
          ? computeChangedRange(original, content)
          : { startLine: 1, endLine: Math.max(1, content.split('\n').length) };
        warnConflictIfAny(ctx, abs, startLine, endLine);
        snapshotBeforeEdit(ctx, [abs], 'auto_pre_write_file');
        commitAtomicWrite(baseline, content);
        recordHunk(ctx, abs, startLine, endLine, content);
        runPostToolCall('write_file', { path: filePath, bytes: content.length });
        const lines = content.split('\n').length;
        const diff = existed ? computeUnifiedDiff(original, content, filePath) : '';
        return { success: true, output: `已写入 ${filePath} (${lines} 行, ${content.length} 字节)${diff}` };
      } catch (e) {
        const mapped = writeFailure(e);
        if (mapped) return mapped;
        throw e;
      }
    },
  };
}

const SEARCH_REPLACE_REGEX = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;

interface AppliedBlock {
  /** 命中的匹配级别:exact / rstrip / trim / unicode */
  level: MatchLevel;
  /** 命中处在"应用该块当时"的文本里的 1-based 行号(用于人核对是不是改对了地方) */
  line: number;
}

interface ApplyResult {
  result: string;
  replacements: number;
  /** 逐块回传的等级信息 —— 弱级命中必须能被调用方看见,不得只在成功文案里捎一句 */
  blocks: AppliedBlock[];
}

function applySearchReplace(original: string, patch: string): ApplyResult | { error: string } {
  let result = original;
  let replacements = 0;
  const blocks: AppliedBlock[] = [];
  let match: RegExpExecArray | null;
  SEARCH_REPLACE_REGEX.lastIndex = 0;
  while ((match = SEARCH_REPLACE_REGEX.exec(patch)) !== null) {
    const searchText = match[1]!;
    const replaceText = match[2]!;
    // P0-1 4 级模糊匹配:exact → rstrip → trim → unicode
    // 解决 LLM 生成 patch 时 typographic 标点(– '' "" nbsp)或行尾空白差异导致的匹配失败
    const seek = seekSequence(result, searchText);
    if (!seek) {
      return { error: `未找到匹配的文本(已尝试 4 级模糊匹配 exact/rstrip/trim/unicode):\n${searchText.slice(0, 100)}...` };
    }
    blocks.push({
      level: seek.level,
      line: result.slice(0, seek.index).split('\n').length,
    });
    result = result.slice(0, seek.index) + replaceText + result.slice(seek.index + seek.length);
    replacements++;
  }
  if (replacements === 0 && patch.includes('<<<<<<< SEARCH')) {
    return { error: 'patch 格式错误,未执行替换' };
  }
  return { result, replacements, blocks };
}

/**
 * 弱等级命中的告警文案(空串 = 全是 exact,无需告警)。
 *
 * 为什么只告警、不当场拒绝(实测决定的档位,不是偷懒):
 *   既有测试面里 edit_file 的成功用例共 6 枚,落在弱级的恰好 1 枚 —— 而它是
 *   `apps/cli/tests/file-edit.test.ts:136` 显式断言的正当行为("行尾空白差异触发 rstrip 模糊匹配"),
 *   **零枚**"弱级落到了错位置"的案例。全仓也没有任何一处把匹配等级打进遥测,所以"弱级误命中率"
 *   现状根本无法测量。在没有误命中证据前把它翻成拒绝 = 只降低一次改对率、不消除任何已测到的坏状态,
 *   而票面纪律是"量不出来就只加 warning、不改拒绝"。
 *   要翻成拒绝的前置:先把等级打进结果遥测并观察到误命中,再单独立票(行为变更)。
 */
function fuzzyMatchWarning(blocks: AppliedBlock[]): string {
  const weak = blocks.filter((b) => b.level !== 'exact');
  if (weak.length === 0) return '';
  const detail = weak.map((b) => `第 ${b.line} 行按 ${b.level} 级命中`).join(';');
  return (
    `⚠️ 模糊匹配 ${weak.length}/${blocks.length} 处:${detail}。` +
    '落盘的是"最像的那一处",不是逐字命中的那一处 —— 若这不是你要改的位置,' +
    '请 read_file 该路径后按原文逐字重发 patch。\n\n'
  );
}

export function createEditFileTool(ctx: EditToolContext): Tool {
  return {
    name: 'edit_file',
    description: '编辑文件(search-and-replace)。参数:path(文件路径),search(搜索文本),replace(替换文本)。或用 patch 参数传入多个 SEARCH/REPLACE 块。',
    dangerLevel: 'write',
    parameters: {
      path: { type: 'string', description: '文件路径' },
      search: { type: 'string', description: '要搜索的文本(精确匹配)' },
      replace: { type: 'string', description: '替换为的文本' },
      patch: { type: 'string', description: '多个 SEARCH/REPLACE 块(格式: <<<<<<< SEARCH\\n...\\n=======\\n...\\n>>>>>>> REPLACE)' },
    },
    required: ['path'],
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      if (!filePath) return { success: false, output: '', error: '缺少 path 参数' };

      const perm = checkPathWritePermission(filePath, ctx);
      if (!perm.allowed) return { success: false, output: '', error: perm.reason };

      const preResult = runPreToolCall('edit_file', { path: filePath, cwd: ctx.workspacePath });
      if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

      const abs = resolvePath(ctx, filePath);
      // 基线一次捕获两用:① "是否存在"沿用原语义(不存在 ⇒ 报错,不新建),
      // ② 内容作为落盘前的复核锚点 —— 快照/patch 计算这段时间里磁盘被改过就必须失败
      let original: string;
      try {
        const baseline = captureWriteBaseline(abs);
        if (baseline.content === null) {
          return { success: false, output: '', error: `文件不存在: ${filePath}` };
        }
        original = baseline.content;
        snapshotBeforeEdit(ctx, [abs], 'auto_pre_edit_file');

        let patchStr: string;
        if (args.patch) {
          patchStr = args.patch as string;
        } else if (args.search !== undefined && args.replace !== undefined) {
          patchStr = `<<<<<<< SEARCH\n${args.search}\n=======\n${args.replace}\n>>>>>>> REPLACE`;
        } else {
          return { success: false, output: '', error: '需要 search+replace 或 patch 参数' };
        }

        const applied = applySearchReplace(original, patchStr);
        if ('error' in applied) {
          return { success: false, output: '', error: applied.error };
        }

        const { startLine, endLine } = computeChangedRange(original, applied.result);
        warnConflictIfAny(ctx, abs, startLine, endLine);
        commitAtomicWrite(baseline, applied.result);
        recordHunk(ctx, abs, startLine, endLine, applied.result);
        runPostToolCall('edit_file', { path: filePath, replacements: applied.replacements });
        const diff = computeUnifiedDiff(original, applied.result, filePath);
        // 弱等级命中:告警放在**最前面**,不能让它在 diff 之后被划过去看不见
        return {
          success: true,
          output: `${fuzzyMatchWarning(applied.blocks)}已编辑 ${filePath} (${applied.replacements} 处替换)${diff}`,
        };
      } catch (e) {
        const mapped = writeFailure(e);
        if (mapped) return mapped;
        throw e;
      }
    },
  };
}

export function createDeleteFileTool(ctx: EditToolContext): Tool {
  return {
    name: 'delete_file',
    description: '删除文件。参数:path(文件路径)。',
    dangerLevel: 'dangerous',
    parameters: {
      path: { type: 'string', description: '要删除的文件路径' },
    },
    required: ['path'],
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      if (!filePath) return { success: false, output: '', error: '缺少 path 参数' };

      const perm = checkPathWritePermission(filePath, ctx);
      if (!perm.allowed) return { success: false, output: '', error: perm.reason };

      const preResult = runPreToolCall('delete_file', { path: filePath, cwd: ctx.workspacePath });
      if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

      const abs = resolvePath(ctx, filePath);
      if (!fs.existsSync(abs)) return { success: false, output: '', error: `文件不存在: ${filePath}` };
      if (fs.statSync(abs).isDirectory()) return { success: false, output: '', error: `是目录,不是文件: ${filePath}` };

      const original = fs.readFileSync(abs, 'utf-8');
      const { startLine, endLine } = { startLine: 1, endLine: Math.max(1, original.split('\n').length) };
      warnConflictIfAny(ctx, abs, startLine, endLine);
      snapshotBeforeEdit(ctx, [abs], 'auto_pre_delete_file');
      fs.unlinkSync(abs);
      recordHunk(ctx, abs, startLine, endLine, original);
      runPostToolCall('delete_file', { path: filePath });
      return { success: true, output: `已删除 ${filePath}` };
    },
  };
}

export function createFileEditTools(ctx: EditToolContext): Tool[] {
  // Wave 9: batch_edit + batch_undo + batch_preview(多文件原子编辑,对标 OpenClaw)
  return [createWriteFileTool(ctx), createEditFileTool(ctx), createDeleteFileTool(ctx), ...createBatchEditTools(ctx)];
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
