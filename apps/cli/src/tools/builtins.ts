/**
 * 内置工具集 — 文件读取/搜索/命令执行工具。
 *
 * 复用 file-ops.ts 的本地实现(read/ls/grep/glob/bash),
 * 包装为 Tool 接口供 Agent 工具循环调用。
 * 灵感来源:cli 的 `cli-tools` crate(terminal/file edit/search)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runSandboxed } from '../sandbox/index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
import { highlightCode } from '../highlight.js';
import type { Tool, ToolContext, ToolResult } from './index.js';

const MAX_READ_LINES = 500;
const MAX_GREP_RESULTS = 50;
const MAX_GLOB_RESULTS = 50;
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.output', '.wxt', 'target']);

// ==================== Ripgrep 集成 ====================

let ripgrepChecked = false;
let ripgrepAvailable = false;

function hasRipgrep(): boolean {
  if (ripgrepChecked) return ripgrepAvailable;
  ripgrepChecked = true;
  const result = spawnSync('rg', ['--version'], { encoding: 'utf-8', windowsHide: true, timeout: 5000 });
  ripgrepAvailable = result.status === 0;
  return ripgrepAvailable;
}

interface RgMatch {
  file: string;
  line: number;
  text: string;
}

function execRipgrep(pattern: string, opts: { cwd: string; searchPath: string; type?: string; glob?: string; max: number }): RgMatch[] | null {
  if (!hasRipgrep()) return null;
  const args = ['--json', '--no-heading', '-i', `--max-count=${opts.max}`];
  if (opts.type) args.push('--type', opts.type);
  if (opts.glob) args.push('-g', opts.glob);
  args.push(pattern, opts.searchPath);
  const result = spawnSync('rg', args, {
    cwd: opts.cwd,
    encoding: 'utf-8',
    timeout: 30_000,
    maxBuffer: 5 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status === null) return null;
  const matches: RgMatch[] = [];
  for (const line of ((result.stdout as string) ?? '').split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as { type: string; data?: { path?: { text?: string }; line_number?: number; lines?: { text?: string } } };
      if (obj.type === 'match' && obj.data?.path?.text) {
        matches.push({
          file: path.relative(opts.cwd, obj.data.path.text),
          line: obj.data.line_number ?? 0,
          text: (obj.data.lines?.text ?? '').trimEnd().slice(0, 120),
        });
        if (matches.length >= opts.max) break;
      }
    } catch {
      // skip non-JSON lines
    }
  }
  return matches;
}

function resolvePath(ctx: ToolContext, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(ctx.workspacePath, filePath);
}

function relativePath(ctx: ToolContext, absPath: string): string {
  return path.relative(ctx.workspacePath, absPath);
}

const TYPE_EXT_MAP: Record<string, string[]> = {
  ts: ['.ts', '.tsx'], js: ['.js', '.jsx'], py: ['.py'],
  json: ['.json'], css: ['.css', '.scss'], md: ['.md', '.markdown'],
  go: ['.go'], rs: ['.rs'], java: ['.java'], c: ['.c', '.h'], cpp: ['.cpp', '.hpp'],
};

function matchesType(filename: string, type: string): boolean {
  const exts = TYPE_EXT_MAP[type.toLowerCase()];
  if (!exts) return true;
  return exts.includes(path.extname(filename).toLowerCase());
}

function matchesGlob(filePath: string, rootPath: string, pattern: string): boolean {
  const rel = path.relative(rootPath, filePath).replace(/\\/g, '/');
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`).test(rel);
}

export const read_file: Tool = {
  name: 'read_file',
  description: '读取文件内容(带行号,代码语法高亮)。参数:path(文件路径,相对工作区根目录)。',
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
    const allLines = content.split('\n');
    const showLines = allLines.slice(0, MAX_READ_LINES);
    const highlighted = highlightCode(showLines.join('\n'), filePath);
    const output = highlighted.split('\n').map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join('\n');
    const truncated = allLines.length > MAX_READ_LINES ? `\n...(仅显示前 ${MAX_READ_LINES} 行)` : '';
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
  description: '在文件中递归搜索正则匹配(优先用 ripgrep,遵循 .gitignore;rg 不存在降级 JS walk)。参数:pattern(正则),path(搜索路径,默认工作区根目录),type(文件类型如 ts/py),glob(路径通配如 src/**/*.ts)。',
  parameters: {
    pattern: { type: 'string', description: '正则表达式' },
    path: { type: 'string', description: '搜索路径(默认工作区根目录)' },
    type: { type: 'string', description: '文件类型过滤(如 ts/py/js,传给 rg --type)' },
    glob: { type: 'string', description: '路径通配过滤(如 src/**/*.ts,传给 rg -g)' },
  },
  required: ['pattern'],
  execute(args, ctx): ToolResult {
    const pattern = args.pattern as string;
    if (!pattern) return { success: false, output: '', error: '缺少 pattern 参数' };
    const searchPath = (args.path as string) || '.';
    const abs = resolvePath(ctx, searchPath);
    if (!fs.existsSync(abs)) return { success: false, output: '', error: `路径不存在: ${searchPath}` };

    const typeFilter = args.type as string | undefined;
    const globFilter = args.glob as string | undefined;

    const rgMatches = execRipgrep(pattern, {
      cwd: ctx.workspacePath,
      searchPath: abs,
      type: typeFilter,
      glob: globFilter,
      max: MAX_GREP_RESULTS,
    });
    if (rgMatches !== null) {
      if (rgMatches.length === 0) return { success: true, output: '未找到匹配' };
      const results = rgMatches.map((m) => `${m.file}:${m.line} ${m.text}`);
      const truncated = results.length >= MAX_GREP_RESULTS ? `\n...(仅显示前 ${MAX_GREP_RESULTS} 条,用 rg)` : '';
      return { success: true, output: results.join('\n') + truncated };
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, 'i');
    } catch {
      return { success: false, output: '', error: `无效正则: ${pattern}` };
    }
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
          if (globFilter && !matchesGlob(entryPath, ctx.workspacePath, globFilter)) continue;
          if (typeFilter && !matchesType(entry.name, typeFilter)) continue;
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
  dangerLevel: 'dangerous',
  parameters: {
    command: { type: 'string', description: '要执行的 shell 命令' },
  },
  required: ['command'],
  execute(args, ctx): ToolResult {
    const command = args.command as string;
    if (!command) return { success: false, output: '', error: '缺少 command 参数' };
    const preResult = runPreToolCall('bash', { command, cwd: ctx.workspacePath });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };
    const result = runSandboxed(command, {
      cwd: ctx.workspacePath,
      timeoutMs: 30_000,
      allowedPaths: [ctx.workspacePath, ...(ctx.sandbox?.allowedPaths ?? [])],
      commandAllowlist: ctx.sandbox?.commandAllowlist,
      blockedEnvVars: ctx.sandbox?.blockedEnvVars,
    });
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
