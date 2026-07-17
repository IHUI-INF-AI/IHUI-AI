/**
 * 内置工具集 — 文件读取/搜索/命令执行工具。
 *
 * 复用 file-ops.ts 的本地实现(read/ls/grep/glob/bash),
 * 包装为 Tool 接口供 Agent 工具循环调用。
 * 灵感来源:grok-build 的 `xai-grok-tools` crate(terminal/file edit/search)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runSandboxed, runSandboxedAsync } from '../sandbox/index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
import { highlightCode } from '../highlight.js';
import {
  registerTask,
  registerFailedTask,
  getTask,
  listTasks,
  getTaskOutput,
  waitForTask,
  killTask,
} from './background-registry.js';
import type { Tool, ToolContext, ToolResult } from './index.js';
import { todo_write } from './todo-write.js';
import { ask_user_question } from './ask-user.js';
import { matchDangerousCommand, isReadonlyCommand } from './command-safety.js';

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
  description: '读取文件内容(带行号,代码语法高亮)。参数:path(文件路径,相对工作区根目录)。支持文本文件;PDF/PPTX/image 等二进制文件返回类型提示。',
  dangerLevel: 'read',
  parameters: {
    path: { type: 'string', description: '要读取的文件路径' },
  },
  required: ['path'],
  async execute(args, ctx): Promise<ToolResult> {
    const filePath = args.path as string;
    if (!filePath) return { success: false, output: '', error: '缺少 path 参数' };
    const abs = resolvePath(ctx, filePath);
    if (!fs.existsSync(abs)) return { success: false, output: '', error: `文件不存在: ${filePath}` };
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) return { success: false, output: '', error: `是目录,不是文件: ${filePath}` };
    // P0-8 二进制文件检测:PDF/PPTX/image 等不强制解析,返回类型化提示(做减法:不引入重依赖)
    const ext = path.extname(abs).toLowerCase();
    const binaryHint = detectBinaryFile(abs, ext, stat.size);
    if (binaryHint) return { success: true, output: binaryHint };
    const content = fs.readFileSync(abs, 'utf-8');
    const allLines = content.split('\n');
    const showLines = allLines.slice(0, MAX_READ_LINES);
    const highlighted = highlightCode(showLines.join('\n'), filePath);
    const output = highlighted.split('\n').map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join('\n');
    const truncated = allLines.length > MAX_READ_LINES ? `\n...(仅显示前 ${MAX_READ_LINES} 行)` : '';
    return { success: true, output: output + truncated };
  },
};

const BINARY_FILE_KINDS: Record<string, { kind: string; hint: string }> = {
  '.pdf': { kind: 'PDF 文档', hint: '使用 /bash pdftotext "<path>" - 提取文本,或 /bash pdfinfo "<path>" 查看元数据' },
  '.docx': { kind: 'Word 文档', hint: '使用 /bash pandoc -t plain "<path>" 提取文本,或 /bash unzip -p "<path>" word/document.xml 查看 XML' },
  '.doc': { kind: 'Word 文档(旧格式)', hint: '使用 /bash antiword "<path>" 或 /bash catdoc "<path>" 提取文本' },
  '.pptx': { kind: 'PowerPoint 文档', hint: '使用 /bash unzip -p "<path>" ppt/slides/slide*.xml 提取文本' },
  '.ppt': { kind: 'PowerPoint 文档(旧格式)', hint: '使用 /bash catppt "<path>" 提取文本' },
  '.xlsx': { kind: 'Excel 文档', hint: '使用 /bash unzip -p "<path>" xl/sharedStrings.xml 提取文本' },
  '.xls': { kind: 'Excel 文档(旧格式)', hint: '使用 /bash xls2csv "<path>" 提取文本' },
  '.png': { kind: 'PNG 图片', hint: '图片无法在终端直接显示;使用 /bash file "<path>" 查看元数据,或 /bash identify "<path>" (ImageMagick)' },
  '.jpg': { kind: 'JPEG 图片', hint: '图片无法在终端直接显示;使用 /bash file "<path>" 查看元数据' },
  '.jpeg': { kind: 'JPEG 图片', hint: '图片无法在终端直接显示;使用 /bash file "<path>" 查看元数据' },
  '.gif': { kind: 'GIF 图片', hint: '图片无法在终端直接显示;使用 /bash file "<path>" 查看元数据' },
  '.webp': { kind: 'WebP 图片', hint: '图片无法在终端直接显示;使用 /bash file "<path>" 查看元数据' },
  '.bmp': { kind: 'BMP 图片', hint: '图片无法在终端直接显示;使用 /bash file "<path>" 查看元数据' },
  '.svg': { kind: 'SVG 矢量图', hint: 'SVG 是 XML 文本,可改为 .xml 后缀读取;或 /bash rsvg-convert "<path>" 转图片' },
  '.mp3': { kind: 'MP3 音频', hint: '音频无法读取;使用 /bash ffprobe "<path>" 查看元数据' },
  '.mp4': { kind: 'MP4 视频', hint: '视频无法读取;使用 /bash ffprobe "<path>" 查看元数据' },
  '.mov': { kind: 'MOV 视频', hint: '视频无法读取;使用 /bash ffprobe "<path>" 查看元数据' },
  '.zip': { kind: 'ZIP 压缩包', hint: '使用 /bash unzip -l "<path>" 列出内容,或 /bash unzip -p "<path>" <file> 提取单个文件' },
  '.tar': { kind: 'TAR 压缩包', hint: '使用 /bash tar -tvf "<path>" 列出内容' },
  '.gz': { kind: 'GZip 压缩文件', hint: '使用 /bash gunzip -c "<path>" 解压输出' },
  '.rar': { kind: 'RAR 压缩包', hint: '使用 /bash unrar l "<path>" 列出内容' },
  '.7z': { kind: '7Z 压缩包', hint: '使用 /bash 7z l "<path>" 列出内容' },
  '.exe': { kind: '可执行文件', hint: '二进制文件无法读取;使用 /bash file "<path>" 查看类型' },
  '.dll': { kind: '动态链接库', hint: '二进制文件无法读取;使用 /bash file "<path>" 查看类型' },
  '.so': { kind: '共享对象', hint: '二进制文件无法读取;使用 /bash file "<path>" 查看类型' },
  '.dylib': { kind: '动态库', hint: '二进制文件无法读取;使用 /bash file "<path>" 查看类型' },
  '.class': { kind: 'Java 类文件', hint: '使用 /bash javap -p "<path>" 反汇编' },
  '.jar': { kind: 'Java JAR 包', hint: '使用 /bash unzip -l "<path>" 列出内容' },
  '.pyc': { kind: 'Python 字节码', hint: '使用 /bash python -m dis "<path>" 反汇编' },
};

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]; // \x89PNG
const JPG_MAGIC = [0xff, 0xd8, 0xff];
const GIF_MAGIC = [0x47, 0x49, 0x46, 0x38]; // GIF8
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04 (zip/docx/pptx/xlsx/jar)
const RAR_MAGIC = [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]; // Rar!\x1a\x07
const SEVENZ_MAGIC = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]; // 7z\xbc\xaf\x27\x1c

function detectBinaryFile(absPath: string, ext: string, size: number): string | null {
  // 扩展名优先(快速路径)
  const byExt = BINARY_FILE_KINDS[ext];
  if (byExt) {
    return formatBinaryHint(byExt.kind, absPath, size, byExt.hint);
  }
  // Magic number 兜底(无扩展名或扩展名异常)
  if (size < 4) return null;
  let fd: number | undefined;
  try {
    fd = fs.openSync(absPath, 'r');
    const buf = Buffer.alloc(8);
    const bytesRead = fs.readSync(fd, buf, 0, 8, 0);
    if (bytesRead >= 4 && PDF_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('PDF 文档(magic)', absPath, size, BINARY_FILE_KINDS['.pdf']!.hint);
    }
    if (bytesRead >= 4 && PNG_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('PNG 图片(magic)', absPath, size, BINARY_FILE_KINDS['.png']!.hint);
    }
    if (bytesRead >= 3 && JPG_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('JPEG 图片(magic)', absPath, size, BINARY_FILE_KINDS['.jpg']!.hint);
    }
    if (bytesRead >= 4 && GIF_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('GIF 图片(magic)', absPath, size, BINARY_FILE_KINDS['.gif']!.hint);
    }
    if (bytesRead >= 4 && ZIP_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('ZIP/Office 文档(magic)', absPath, size, BINARY_FILE_KINDS['.zip']!.hint);
    }
    if (bytesRead >= 6 && RAR_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('RAR 压缩包(magic)', absPath, size, BINARY_FILE_KINDS['.rar']!.hint);
    }
    if (bytesRead >= 6 && SEVENZ_MAGIC.every((b, i) => buf[i] === b)) {
      return formatBinaryHint('7Z 压缩包(magic)', absPath, size, BINARY_FILE_KINDS['.7z']!.hint);
    }
    // 检测 NULL 字节(通用二进制检测,前 1024 字节内有 NULL 视为二进制)
    if (bytesRead >= 1 && buf.slice(0, bytesRead).includes(0)) {
      return formatBinaryHint('二进制文件(检测到 NULL 字节)', absPath, size, '使用 /bash file "<path>" 查看类型');
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore
      }
    }
  }
}

function formatBinaryHint(kind: string, absPath: string, size: number, hint: string): string {
  const sizeStr = size < 1024 ? `${size}B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)}KB` : `${(size / (1024 * 1024)).toFixed(1)}MB`;
  return `[${kind}] ${path.basename(absPath)} (${sizeStr})\n该文件类型当前不支持直接解析(避免引入重依赖)。\n提示:${hint.replace(/<path>/g, absPath)}`;
}

export const list_dir: Tool = {
  name: 'list_dir',
  description: '列出目录内容。参数:path(目录路径,默认工作区根目录)。',
  parameters: {
    path: { type: 'string', description: '要列出的目录路径(默认 .)' },
  },
  required: [],
  async execute(args, ctx): Promise<ToolResult> {
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
  async execute(args, ctx): Promise<ToolResult> {
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
  async execute(args, ctx): Promise<ToolResult> {
    const pattern = args.pattern as string;
    if (!pattern) return { success: false, output: '', error: '缺少 pattern 参数' };
    // 展开 {a,b,c} 大括号(支持单层嵌套,常见 glob 扩展语法)
    const expandBraces = (p: string): string[] => {
      const match = p.match(/\{([^{}]+)\}/)
      if (!match) return [p]
      const prefix = p.slice(0, match.index)
      const suffix = p.slice(match.index! + match[0].length)
      const options = match[1]!.split(',')
      return options.flatMap((opt) => expandBraces(prefix + opt + suffix))
    }
    const patterns = expandBraces(pattern)
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
        } else if (patterns.some((p) => {
          const regexStr = p
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
          return new RegExp(`^${regexStr}$`).test(entry.name);
        })) {
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
  description:
    '在沙盒中执行 shell 命令(带超时和路径限制)。参数:command(shell 命令),background(可选 true=后台执行立即返回 task_id)。',
  dangerLevel: 'dangerous',
  parameters: {
    command: { type: 'string', description: '要执行的 shell 命令' },
    background: { type: 'boolean', description: '后台执行,立即返回 task_id(用 list_background_tasks/get_command_output/wait_command 查询)' },
  },
  required: ['command'],
  async execute(args, ctx): Promise<ToolResult> {
    const command = args.command as string;
    if (!command) return { success: false, output: '', error: '缺少 command 参数' };
    const background = args.background === true;
    // 危险命令模式检查:即使 allowDangerous=true 也强制拦截,除非 IHUI_YOLO=1
    const dangerousMatch = matchDangerousCommand(command);
    if (dangerousMatch && !process.env.IHUI_YOLO) {
      return {
        success: false,
        output: `⚠ 危险命令被拦截:命令匹配危险模式 ${dangerousMatch.source}\n如确需执行,请设置 IHUI_YOLO=1`,
      };
    }
    // readonly 命令自动批准(trusted profile 默认):免 confirmDangerous 提示
    const readonlyAutoApproved = isReadonlyCommand(command);
    if (!readonlyAutoApproved) {
      // 默认拒绝策略:未提供 confirmDangerous 回调时,dangerous 工具直接拒绝(安全优先)
      if (run_command.dangerLevel === 'dangerous' && !ctx.confirmDangerous) {
        return { success: false, output: '', error: `危险操作被拒绝(需用户确认): ${run_command.name}` };
      }
      if (ctx.confirmDangerous && !(await ctx.confirmDangerous(run_command, args))) {
        return { success: false, output: '', error: `危险操作被拒绝(需用户确认): ${run_command.name}` };
      }
    }
    const preResult = runPreToolCall('bash', { command, cwd: ctx.workspacePath, background });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    if (background) {
      // 后台执行:启动异步沙盒,注册任务,立即返回 task_id
      const handle = runSandboxedAsync(command, {
        cwd: ctx.workspacePath,
        timeoutMs: 600_000, // 后台任务 10 分钟超时
        allowedPaths: [ctx.workspacePath, ...(ctx.sandbox?.allowedPaths ?? [])],
        commandAllowlist: ctx.sandbox?.commandAllowlist,
        blockedEnvVars: ctx.sandbox?.blockedEnvVars,
      });
      if (!handle.process) {
        // 预检失败
        const failedId = registerFailedTask(command, '沙盒预检失败');
        return {
          success: false,
          output: `任务 ${failedId} 注册但启动失败(沙盒拒绝)`,
          error: '沙盒预检失败',
        };
      }
      const taskId = registerTask(handle.process, command);
      // 异步等待结果,完成后触发 post hook
      handle.result.then((result) => {
        runPostToolCall('bash', { exitCode: result.exitCode, timedOut: result.timedOut, background: true, taskId });
      }).catch(() => { /* ignore */ });
      return {
        success: true,
        output: `后台任务已启动\n  task_id: ${taskId}\n  command: ${command}\n  用 list_background_tasks 查看,get_command_output ${taskId} 获取输出,wait_command ${taskId} 等待结束,kill_command ${taskId} 终止`,
      };
    }

    // 同步执行(原有逻辑)
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

export const list_background_tasks: Tool = {
  name: 'list_background_tasks',
  description: '列出所有后台任务(running/exited/killed/error 状态)。无参数。',
  dangerLevel: 'read',
  parameters: {},
  required: [],
  async execute(_args, _ctx): Promise<ToolResult> {
    const list = listTasks();
    if (list.length === 0) {
      return { success: true, output: '当前无后台任务' };
    }
    const lines = list.map(
      (t) => `  ${t.id}  [${t.status}]  ${t.command.slice(0, 60)}${t.command.length > 60 ? '...' : ''}  exitCode=${t.exitCode ?? '-'}  started=${t.startedAt}`,
    );
    return {
      success: true,
      output: `后台任务列表(${list.length} 个):\n${lines.join('\n')}`,
    };
  },
};

export const get_command_output: Tool = {
  name: 'get_command_output',
  description: '获取后台任务的累计输出(stdout/stderr + 状态)。参数:task_id,tail(可选,最后 N 行)。',
  dangerLevel: 'read',
  parameters: {
    task_id: { type: 'string', description: '后台任务 ID(bg_xxx)' },
    tail: { type: 'number', description: '仅返回最后 N 行(可选,默认全部)' },
  },
  required: ['task_id'],
  async execute(args, _ctx): Promise<ToolResult> {
    const taskId = args.task_id as string;
    const tail = args.tail as number | undefined;
    if (!taskId) return { success: false, output: '', error: '缺少 task_id 参数' };
    const output = getTaskOutput(taskId, tail);
    if (!output) {
      return { success: false, output: '', error: `任务 ${taskId} 不存在` };
    }
    const parts: string[] = [
      `任务 ${output.id}  状态: ${output.status}  exitCode: ${output.exitCode ?? '-'}`,
    ];
    if (output.stdout.trim()) parts.push(`[stdout]\n${output.stdout.trimEnd()}`);
    if (output.stderr.trim()) parts.push(`[stderr]\n${output.stderr.trimEnd()}`);
    if (output.truncated) parts.push('[输出被截断]');
    return {
      success: output.status !== 'error',
      output: parts.join('\n') || '(无输出)',
      error: output.status === 'error' ? '任务出错' : undefined,
    };
  },
};

export const wait_command: Tool = {
  name: 'wait_command',
  description: '等待后台任务结束,timeout_ms 毫秒后返回当前状态(不杀进程)。参数:task_id,timeout_ms(默认 30000)。',
  dangerLevel: 'read',
  parameters: {
    task_id: { type: 'string', description: '后台任务 ID' },
    timeout_ms: { type: 'number', description: '等待超时(毫秒,默认 30000)' },
  },
  required: ['task_id'],
  async execute(args, _ctx): Promise<ToolResult> {
    const taskId = args.task_id as string;
    const timeoutMs = (args.timeout_ms as number | undefined) ?? 30_000;
    if (!taskId) return { success: false, output: '', error: '缺少 task_id 参数' };
    const task = getTask(taskId);
    if (!task) return { success: false, output: '', error: `任务 ${taskId} 不存在` };

    const result = await waitForTask(taskId, timeoutMs);
    if (!result) return { success: false, output: '', error: `任务 ${taskId} 已被清理` };

    const parts: string[] = [
      `任务 ${result.id}  状态: ${result.status}  exitCode: ${result.exitCode ?? '-'}`,
    ];
    if (result.stdoutBuf.trim()) parts.push(`[stdout]\n${result.stdoutBuf.trimEnd().slice(-2000)}`);
    if (result.stderrBuf.trim()) parts.push(`[stderr]\n${result.stderrBuf.trimEnd().slice(-2000)}`);
    if (result.timedOut) parts.push('[任务超时]');
    return {
      success: result.status === 'exited' && result.exitCode === 0,
      output: parts.join('\n'),
      error: result.status !== 'exited' ? `状态: ${result.status}` : (result.exitCode !== 0 ? `退出码 ${result.exitCode}` : undefined),
    };
  },
};

export const kill_command: Tool = {
  name: 'kill_command',
  description: '终止后台任务(SIGTERM,5 秒后强杀 SIGKILL)。参数:task_id。',
  dangerLevel: 'dangerous',
  parameters: {
    task_id: { type: 'string', description: '后台任务 ID' },
  },
  required: ['task_id'],
  async execute(args, ctx): Promise<ToolResult> {
    const taskId = args.task_id as string;
    if (!taskId) return { success: false, output: '', error: '缺少 task_id 参数' };
    if (kill_command.dangerLevel === 'dangerous' && !ctx.confirmDangerous) {
      return { success: false, output: '', error: `危险操作被拒绝(需用户确认): ${kill_command.name}` };
    }
    if (ctx.confirmDangerous && !(await ctx.confirmDangerous(kill_command, args))) {
      return { success: false, output: '', error: `危险操作被拒绝(需用户确认): ${kill_command.name}` };
    }
    const result = await killTask(taskId);
    return {
      success: result.killed,
      output: result.killed ? `任务 ${taskId} 已终止` : `任务 ${taskId} 终止失败: ${result.reason ?? '未知原因'}`,
      error: result.killed ? undefined : result.reason,
    };
  },
};

export const BUILTIN_TOOLS: Tool[] = [
  read_file,
  list_dir,
  grep,
  glob,
  run_command,
  list_background_tasks,
  get_command_output,
  wait_command,
  kill_command,
  todo_write,
  ask_user_question,
];
