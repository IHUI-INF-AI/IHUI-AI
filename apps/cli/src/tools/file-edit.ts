/**
 * 文件编辑工具集 — write_file / edit_file / delete_file。
 *
 * 灵感来源:cli 的 `cli-tools` crate,port 了 openai/codex 的 apply_patch。
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
import type { CheckpointManager } from '../checkpoints/index.js';

interface EditToolContext extends ToolContext {
  checkpoints?: CheckpointManager;
}

function resolvePath(ctx: ToolContext, filePath: string): string {
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
function computeUnifiedDiff(original: string, modified: string, filePath: string): string {
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
      const existed = fs.existsSync(abs);
      const original = existed ? fs.readFileSync(abs, 'utf-8') : '';
      snapshotBeforeEdit(ctx, [abs], 'auto_pre_write_file');
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, 'utf-8');
      runPostToolCall('write_file', { path: filePath, bytes: content.length });
      const lines = content.split('\n').length;
      const diff = existed ? computeUnifiedDiff(original, content, filePath) : '';
      return { success: true, output: `已写入 ${filePath} (${lines} 行, ${content.length} 字节)${diff}` };
    },
  };
}

const SEARCH_REPLACE_REGEX = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;

function applySearchReplace(original: string, patch: string): { result: string; replacements: number } | { error: string } {
  let result = original;
  let replacements = 0;
  let match: RegExpExecArray | null;
  SEARCH_REPLACE_REGEX.lastIndex = 0;
  while ((match = SEARCH_REPLACE_REGEX.exec(patch)) !== null) {
    const searchText = match[1]!;
    const replaceText = match[2]!;
    const idx = result.indexOf(searchText);
    if (idx === -1) {
      return { error: `未找到匹配的文本:\n${searchText.slice(0, 100)}...` };
    }
    result = result.slice(0, idx) + replaceText + result.slice(idx + searchText.length);
    replacements++;
  }
  if (replacements === 0 && patch.includes('<<<<<<< SEARCH')) {
    return { error: 'patch 格式错误,未执行替换' };
  }
  return { result, replacements };
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
      if (!fs.existsSync(abs)) return { success: false, output: '', error: `文件不存在: ${filePath}` };

      const original = fs.readFileSync(abs, 'utf-8');
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

      fs.writeFileSync(abs, applied.result, 'utf-8');
      runPostToolCall('edit_file', { path: filePath, replacements: applied.replacements });
      const diff = computeUnifiedDiff(original, applied.result, filePath);
      return {
        success: true,
        output: `已编辑 ${filePath} (${applied.replacements} 处替换)${diff}`,
      };
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

      snapshotBeforeEdit(ctx, [abs], 'auto_pre_delete_file');
      fs.unlinkSync(abs);
      runPostToolCall('delete_file', { path: filePath });
      return { success: true, output: `已删除 ${filePath}` };
    },
  };
}

export function createFileEditTools(ctx: EditToolContext): Tool[] {
  return [createWriteFileTool(ctx), createEditFileTool(ctx), createDeleteFileTool(ctx)];
}
