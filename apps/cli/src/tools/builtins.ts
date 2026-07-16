/**
 * 内置工具集 — 文件读取/搜索/命令执行工具。
 *
 * 复用 file-ops.ts 的本地实现(read/ls/grep/glob/bash),
 * 包装为 Tool 接口供 Agent 工具循环调用。
 * 灵感来源:grok-build 的 `xai-grok-tools` crate(terminal/file edit/search)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { runSandboxed } from '../sandbox/index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
import type { Tool, ToolContext, ToolResult } from './index.js';

const MAX_READ_LINES = 500;
const MAX_GREP_RESULTS = 50;
const MAX_GLOB_RESULTS = 50;
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.output', '.wxt', 'target']);

function resolvePath(ctx: ToolContext, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(ctx.workspacePath, filePath);
}

function relativePath(ctx: ToolContext, absPath: string): string {
  return path.relative(ctx.workspacePath, absPath);
}

export const read_file: Tool = {
  name: 'read_file',
  description: '读取文件内容(带行号)。参数:path(文件路径,相对工作区根目录)。',
  parameters: {
    path: { type: 'string', description: '要读取的文件路径' },
  },
  required: ['path'],
  execute(args, ctx): ToolResult {
    const filePath = args.path as string;
    if (!filePath) return { success: false, output: '', error: '缺少 path 参数' };
    const abs = resolvePath(ctx, filePath);
    if (!fs.existsSync(abs)) return { success: false, output: '', error: `文件不存在: ${filePath}` };
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) return { success: false, output: '', error: `是目录,不是文件: ${filePath}` };
    const content = fs.readFileSync(abs, 'utf-8');
    const lines = content.split('\n').slice(0, MAX_READ_LINES);
    const output = lines.map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join('\n');
    const truncated = content.split('\n').length > MAX_READ_LINES ? `\n...(仅显示前 ${MAX_READ_LINES} 行)` : '';
    return { success: true, output: output + truncated };
  },
};

export const list_dir: Tool = {
  name: 'list_dir',
  description: '列出目录内容。参数:path(目录路径,默认工作区根目录)。',
  parameters: {
    path: { type: 'string', description: '要列出的目录路径(默认 .)' },
  },
  required: [],
  execute(args, ctx): ToolResult {
    const dirPath = (args.path as string) || '.';
    const abs = resolvePath(ctx, dirPath);
    if (!fs.existsSync(abs)) return { success: false, output: '', error: `路径不存在: ${dirPath}` };
    const stat = fs.statSync(abs);
    if (!stat.isDirectory()) return { success: false, output: '', error: `是文件,不是目录: ${dirPath}` };
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    const files = entries.filter((e) => e.isFile()).sort((a, b) => a.name.localeCompare(b.name));
    const lines: string[] = [];
    for (const d of dirs) lines.push(`${d.name}/`);
    for (const f of files) {
      const fstat = fs.statSync(path.join(abs, f.name));
      const size = fstat.size < 1024 ? `${fstat.size}B` : `${(fstat.size / 1024).toFixed(1)}K`;
      lines.push(`${f.name} (${size})`);
    }
    return { success: true, output: lines.join('\n') };
  },
};

export const grep: Tool = {
  name: 'grep',
  description: '在文件中递归搜索正则匹配。参数:pattern(正则),path(搜索路径,默认工作区根目录)。',
  parameters: {
    pattern: { type: 'string', description: '正则表达式' },
    path: { type: 'string', description: '搜索路径(默认工作区根目录)' },
  },
  required: ['pattern'],
  execute(args, ctx): ToolResult {
    const pattern = args.pattern as string;
    if (!pattern) return { success: false, output: '', error: '缺少 pattern 参数' };
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, 'i');
    } catch {
      return { success: false, output: '', error: `无效正则: ${pattern}` };
    }
    const searchPath = (args.path as string) || '.';
    const abs = resolvePath(ctx, searchPath);
    if (!fs.existsSync(abs)) return { success: false, output: '', error: `路径不存在: ${searchPath}` };
    const results: string[] = [];
    function walk(dir: string): void {
      if (results.length >= MAX_GREP_RESULTS) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (results.length >= MAX_GREP_RESULTS) return;
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name)) continue;
          walk(entryPath);
        } else if (entry.isFile()) {
          try {
            const content = fs.readFileSync(entryPath, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i]!)) {
                const rel = relativePath(ctx, entryPath);
                results.push(`${rel}:${i + 1} ${lines[i]!.trim().slice(0, 120)}`);
                if (results.length >= MAX_GREP_RESULTS) break;
              }
            }
          } catch { /* skip binary */ }
        }
      }
    }
    walk(abs);
    if (results.length === 0) return { success: true, output: '未找到匹配' };
    const truncated = results.length >= MAX_GREP_RESULTS ? `\n...(仅显示前 ${MAX_GREP_RESULTS} 条)` : '';
    return { success: true, output: results.join('\n') + truncated };
  },
};

export const glob: Tool = {
  name: 'glob',
  description: '按文件名通配匹配文件。参数:pattern(如 *.ts, src/**/*.js)。',
  parameters: {
    pattern: { type: 'string', description: '文件名通配符(* 和 ?)' },
  },
  required: ['pattern'],
  execute(args, ctx): ToolResult {
    const pattern = args.pattern as string;
    if (!pattern) return { success: false, output: '', error: '缺少 pattern 参数' };
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexStr}$`);
    const results: string[] = [];
    function walk(dir: string): void {
      if (results.length >= MAX_GLOB_RESULTS) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (results.length >= MAX_GLOB_RESULTS) return;
        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name)) continue;
          walk(path.join(dir, entry.name));
        } else if (regex.test(entry.name)) {
          results.push(relativePath(ctx, path.join(dir, entry.name)));
        }
      }
    }
    walk(ctx.workspacePath);
    if (results.length === 0) return { success: true, output: '未找到匹配文件' };
    results.sort();
    const truncated = results.length >= MAX_GLOB_RESULTS ? `\n...(仅显示前 ${MAX_GLOB_RESULTS} 个)` : '';
    return { success: true, output: results.join('\n') + truncated };
  },
};

export const run_command: Tool = {
  name: 'run_command',
  description: '在沙盒中执行 shell 命令(带超时和路径限制)。参数:command(shell 命令)。',
  parameters: {
    command: { type: 'string', description: '要执行的 shell 命令' },
  },
  required: ['command'],
  execute(args, ctx): ToolResult {
    const command = args.command as string;
    if (!command) return { success: false, output: '', error: '缺少 command 参数' };
    const preResult = runPreToolCall('bash', { command, cwd: ctx.workspacePath });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };
    const result = runSandboxed(command, { cwd: ctx.workspacePath, timeoutMs: 30_000 });
    runPostToolCall('bash', { exitCode: result.exitCode, timedOut: result.timedOut });
    const parts: string[] = [];
    if (result.stdout.trim()) parts.push(result.stdout.trimEnd());
    if (result.stderr.trim()) parts.push(`[stderr] ${result.stderr.trimEnd()}`);
    if (result.timedOut) parts.push('[超时]');
    if (result.exitCode !== null && result.exitCode !== 0) parts.push(`[exit: ${result.exitCode}]`);
    return {
      success: result.exitCode === 0,
      output: parts.join('\n') || '(无输出)',
      error: result.exitCode !== 0 ? `退出码 ${result.exitCode}` : undefined,
    };
  },
};

export const BUILTIN_TOOLS: Tool[] = [read_file, list_dir, grep, glob, run_command];
