/**
 * LSP 客户端 — 对标 OpenCode "开箱即用 LSP" 杀手锏。
 *
 * 策略:
 *   - 懒启动 typescript-language-server 子进程(stdio 模式)
 *   - 首次调用 LSP 工具时启动,后续复用(单例 per workspace)
 *   - LSP 启动失败/超时 → 优雅降级(errorType='lsp-unavailable'),提示用 codegraph 兜底
 *   - 与 codegraph(正则解析,离线兜底)互补:LSP 精准(类型系统),codegraph 无需二进制
 */
import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';
import {
  createProtocolConnection,
  InitializeRequest,
  InitializedNotification,
  DefinitionRequest,
  ReferencesRequest,
  HoverRequest,
  DidOpenTextDocumentNotification,
  PublishDiagnosticsNotification,
  type InitializeParams,
  type TextDocumentItem,
  type TextDocumentPositionParams,
  type PublishDiagnosticsParams,
  type Location,
  type Hover,
  type Diagnostic,
} from 'vscode-languageserver-protocol';
import { registerTools, type Tool, type ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';

const LSP_INIT_TIMEOUT_MS = 15_000;
const LSP_REQUEST_TIMEOUT_MS = 10_000;
const DIAGNOSTICS_POLL_MS = 100;
const DIAGNOSTICS_MAX_POLLS = 10;

// ==================== Helpers ====================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

function toUri(filePath: string): string {
  return pathToFileURL(filePath).toString();
}

function toRelPath(uri: string, workspacePath: string): string {
  const abs = fileURLToPath(uri);
  return path.relative(workspacePath, abs).replace(/\\/g, '/');
}

function detectLanguageId(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  switch (ext) {
    case 'ts': return 'typescript';
    case 'tsx': return 'typescriptreact';
    case 'js': return 'javascript';
    case 'jsx': return 'javascriptreact';
    case 'mjs':
    case 'cjs': return 'javascript';
    case 'json': return 'json';
    case 'css': return 'css';
    case 'html': return 'html';
    case 'md': return 'markdown';
    default: return ext || 'plaintext';
  }
}

/** 将 LSP 返回的 Location | Location[] | LocationLink[] | null 统一为 Location[]。 */
function normalizeLocations(result: unknown): Location[] {
  if (!result) return [];
  const items = Array.isArray(result) ? result : [result];
  const locations: Location[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.targetUri === 'string') {
      locations.push({ uri: obj.targetUri, range: obj.targetRange as Location['range'] });
    } else if (typeof obj.uri === 'string') {
      locations.push({ uri: obj.uri, range: obj.range as Location['range'] });
    }
  }
  return locations;
}

function formatLocation(loc: Location, workspacePath: string): string {
  const rel = toRelPath(loc.uri, workspacePath);
  const start = loc.range.start;
  return `  ${rel}:${start.line + 1}:${start.character + 1}`;
}

function formatDiagnostic(diag: Diagnostic): string {
  const start = diag.range.start;
  const severity = diag.severity === 1 ? 'Error'
    : diag.severity === 2 ? 'Warning'
    : diag.severity === 3 ? 'Info'
    : diag.severity === 4 ? 'Hint'
    : 'Unknown';
  const source = diag.source ? `[${diag.source}]` : '';
  const code = diag.code !== undefined ? `(${diag.code})` : '';
  return `  [${severity}] ${start.line + 1}:${start.character + 1} ${source}${code} ${diag.message}`.trim();
}

function formatHover(hover: Hover | null): string {
  if (!hover) return '(无 hover 信息)';
  const contents = hover.contents;
  if (typeof contents === 'string') return contents;
  if (Array.isArray(contents)) {
    return contents
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object' && 'value' in c) return String((c as { value: unknown }).value);
        return String(c);
      })
      .filter((s) => s.trim())
      .join('\n\n');
  }
  if (contents && typeof contents === 'object' && 'value' in contents) {
    return String((contents as { value: unknown }).value);
  }
  return '(无 hover 内容)';
}

function resolveAndCheckFile(file: string, workspacePath: string): { ok: true; filePath: string } | { ok: false; error: string } {
  const filePath = path.resolve(workspacePath, file);
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `文件不存在: ${file}` };
  }
  return { ok: true, filePath };
}

// ==================== LSP Client (singleton per workspace) ====================

type LspConnection = ReturnType<typeof createProtocolConnection>;

class LspClient {
  private conn: LspConnection | undefined;
  private child: ChildProcess | undefined;
  private workspacePath: string;
  private diagnosticsCache = new Map<string, Diagnostic[]>();
  private openedFiles = new Set<string>();
  private startPromise: Promise<void> | undefined;
  private started = false;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  async ensureStarted(): Promise<void> {
    if (this.started) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.start();
    try {
      await this.startPromise;
    } catch (e) {
      this.startPromise = undefined;
      throw e;
    }
  }

  private async start(): Promise<void> {
    const child = spawn('typescript-language-server', ['--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.workspacePath,
      windowsHide: true,
      shell: true,
    });
    this.child = child;

    if (!child.stdout || !child.stdin) {
      throw new Error('无法获取 typescript-language-server 的 stdio 流');
    }

    // 二进制不存在时 'error' 事件异步触发
    const spawnError = new Promise<never>((_, reject) => {
      child.on('error', (err) => {
        reject(new Error(`typescript-language-server 启动失败(可能未安装): ${err.message}`));
      });
    });

    const reader = new StreamMessageReader(child.stdout);
    const writer = new StreamMessageWriter(child.stdin);
    this.conn = createProtocolConnection(reader, writer);
    this.conn.listen();

    child.on('exit', () => {
      this.conn?.dispose();
      this.conn = undefined;
      this.child = undefined;
      this.started = false;
      this.startPromise = undefined;
      this.openedFiles.clear();
    });

    process.on('exit', () => {
      if (this.child && !this.child.killed) {
        this.child.kill();
      }
    });

    this.conn.onNotification(PublishDiagnosticsNotification.type, (params: PublishDiagnosticsParams) => {
      this.diagnosticsCache.set(params.uri, params.diagnostics);
    });

    const initParams: InitializeParams = {
      processId: process.pid,
      rootUri: toUri(this.workspacePath),
      capabilities: {},
    };

    const initPromise = this.conn.sendRequest(InitializeRequest.type, initParams);
    await withTimeout(
      Promise.race([initPromise, spawnError]),
      LSP_INIT_TIMEOUT_MS,
      'LSP initialize 超时',
    );

    await this.conn.sendNotification(InitializedNotification.type, {});
    this.started = true;
  }

  private async ensureOpen(filePath: string): Promise<string> {
    const uri = toUri(filePath);
    if (this.openedFiles.has(uri)) return uri;
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const doc: TextDocumentItem = {
      uri,
      languageId: detectLanguageId(filePath),
      version: 1,
      text: content,
    };
    await this.conn!.sendNotification(DidOpenTextDocumentNotification.type, { textDocument: doc });
    this.openedFiles.add(uri);
    await sleep(200);
    return uri;
  }

  async gotoDefinition(filePath: string, line: number, col: number): Promise<Location[]> {
    const uri = await this.ensureOpen(filePath);
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position: { line: line - 1, character: col - 1 },
    };
    const result = await withTimeout(
      this.conn!.sendRequest(DefinitionRequest.type, params),
      LSP_REQUEST_TIMEOUT_MS,
      'LSP goto definition 超时',
    );
    return normalizeLocations(result);
  }

  async findReferences(
    filePath: string,
    line: number,
    col: number,
    includeDeclaration: boolean,
  ): Promise<Location[]> {
    const uri = await this.ensureOpen(filePath);
    const params = {
      textDocument: { uri },
      position: { line: line - 1, character: col - 1 },
      context: { includeDeclaration },
    };
    const result = await withTimeout(
      this.conn!.sendRequest(ReferencesRequest.type, params),
      LSP_REQUEST_TIMEOUT_MS,
      'LSP find references 超时',
    );
    return normalizeLocations(result);
  }

  async getDiagnostics(filePath: string): Promise<Diagnostic[]> {
    const uri = await this.ensureOpen(filePath);
    for (let i = 0; i < DIAGNOSTICS_MAX_POLLS; i++) {
      const diags = this.diagnosticsCache.get(uri);
      if (diags !== undefined) return diags;
      await sleep(DIAGNOSTICS_POLL_MS);
    }
    return this.diagnosticsCache.get(uri) ?? [];
  }

  async hover(filePath: string, line: number, col: number): Promise<Hover | null> {
    const uri = await this.ensureOpen(filePath);
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position: { line: line - 1, character: col - 1 },
    };
    return withTimeout(
      this.conn!.sendRequest(HoverRequest.type, params),
      LSP_REQUEST_TIMEOUT_MS,
      'LSP hover 超时',
    );
  }

  dispose(): void {
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
    this.conn?.dispose();
    this.conn = undefined;
    this.child = undefined;
    this.started = false;
    this.startPromise = undefined;
    this.openedFiles.clear();
    this.diagnosticsCache.clear();
  }
}

// ==================== Singleton manager ====================

let currentClient: LspClient | undefined;
let currentWorkspace = '';

function getLspClient(workspacePath: string): LspClient {
  if (currentClient && currentWorkspace === workspacePath) {
    return currentClient;
  }
  currentClient = new LspClient(workspacePath);
  currentWorkspace = workspacePath;
  return currentClient;
}

export function disposeLspClient(): void {
  currentClient?.dispose();
  currentClient = undefined;
  currentWorkspace = '';
}

// ==================== Tools ====================

const FALLBACK_HINT = '建议改用 codegraph/goto_definition 或 codegraph/find_references 作为离线兜底';

function lspUnavailableResult(err: unknown): ToolResult {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    success: false,
    output: '',
    error: `LSP 不可用: ${msg}。${FALLBACK_HINT}`,
    errorType: 'lsp-unavailable',
  };
}

export const lsp_goto_definition: Tool = {
  name: 'lsp_goto_definition',
  description:
    '使用 LSP(typescript-language-server)精确定位符号定义位置。基于完整类型系统,精度远超 codegraph/goto_definition 的正则匹配。输入文件路径 + 1-based 行号/列号,返回所有定义位置(file:line:col)。LSP 不可用时降级提示用 codegraph。',
  dangerLevel: 'read',
  parameters: {
    file: { type: 'string', description: '文件路径(相对于工作区根目录)' },
    line: { type: 'number', description: '行号(1-based,从 1 开始)' },
    column: { type: 'number', description: '列号(1-based,从 1 开始)' },
  },
  required: ['file', 'line', 'column'],
  async execute(args, ctx): Promise<ToolResult> {
    const file = args.file as string | undefined;
    const line = args.line as number | undefined;
    const column = args.column as number | undefined;
    if (!file || typeof line !== 'number' || typeof column !== 'number') {
      return { success: false, output: '', error: '参数错误:需要 file(字符串)、line(数字)、column(数字)' };
    }

    const preResult = runPreToolCall('lsp_goto_definition', { file, line, column });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const fileCheck = resolveAndCheckFile(file, ctx.workspacePath);
    if (!fileCheck.ok) return { success: false, output: '', error: fileCheck.error };

    const client = getLspClient(ctx.workspacePath);
    try {
      await client.ensureStarted();
    } catch (err) {
      return lspUnavailableResult(err);
    }

    let locations: Location[];
    try {
      locations = await client.gotoDefinition(fileCheck.filePath, line, column);
    } catch (err) {
      return lspUnavailableResult(err);
    }

    runPostToolCall('lsp_goto_definition', { file, line, column, hits: locations.length });

    if (locations.length === 0) {
      return { success: true, output: `LSP 未找到定义(file=${file} line=${line} col=${column})` };
    }
    const lines = locations.map((l) => formatLocation(l, ctx.workspacePath));
    return {
      success: true,
      output: `找到 ${locations.length} 处定义(LSP):\n${lines.join('\n')}`,
    };
  },
};

export const lsp_find_references: Tool = {
  name: 'lsp_find_references',
  description:
    '使用 LSP(typescript-language-server)查找符号所有引用位置。基于完整类型系统,精度远超 codegraph/find_references 的正则匹配。输入文件路径 + 1-based 行号/列号,返回所有引用位置(file:line:col)。LSP 不可用时降级提示用 codegraph。',
  dangerLevel: 'read',
  parameters: {
    file: { type: 'string', description: '文件路径(相对于工作区根目录)' },
    line: { type: 'number', description: '行号(1-based,从 1 开始)' },
    column: { type: 'number', description: '列号(1-based,从 1 开始)' },
    includeDeclaration: { type: 'boolean', description: '是否包含定义声明(默认 true)' },
  },
  required: ['file', 'line', 'column'],
  async execute(args, ctx): Promise<ToolResult> {
    const file = args.file as string | undefined;
    const line = args.line as number | undefined;
    const column = args.column as number | undefined;
    const includeDeclaration = args.includeDeclaration !== false;
    if (!file || typeof line !== 'number' || typeof column !== 'number') {
      return { success: false, output: '', error: '参数错误:需要 file(字符串)、line(数字)、column(数字)' };
    }

    const preResult = runPreToolCall('lsp_find_references', { file, line, column, includeDeclaration });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const fileCheck = resolveAndCheckFile(file, ctx.workspacePath);
    if (!fileCheck.ok) return { success: false, output: '', error: fileCheck.error };

    const client = getLspClient(ctx.workspacePath);
    try {
      await client.ensureStarted();
    } catch (err) {
      return lspUnavailableResult(err);
    }

    let locations: Location[];
    try {
      locations = await client.findReferences(fileCheck.filePath, line, column, includeDeclaration);
    } catch (err) {
      return lspUnavailableResult(err);
    }

    runPostToolCall('lsp_find_references', { file, line, column, hits: locations.length });

    if (locations.length === 0) {
      return { success: true, output: `LSP 未找到引用(file=${file} line=${line} col=${column})` };
    }
    const lines = locations.map((l) => formatLocation(l, ctx.workspacePath));
    return {
      success: true,
      output: `找到 ${locations.length} 处引用(LSP):\n${lines.join('\n')}`,
    };
  },
};

export const lsp_diagnostics: Tool = {
  name: 'lsp_diagnostics',
  description:
    '使用 LSP(typescript-language-server)获取文件的类型错误和警告诊断。比正则解析精确得多(能检测类型错误、未使用变量等)。输入文件路径,返回诊断列表(severity + line:col + message)。',
  dangerLevel: 'read',
  parameters: {
    file: { type: 'string', description: '文件路径(相对于工作区根目录)' },
  },
  required: ['file'],
  async execute(args, ctx): Promise<ToolResult> {
    const file = args.file as string | undefined;
    if (!file) {
      return { success: false, output: '', error: '参数错误:需要 file(字符串)' };
    }

    const preResult = runPreToolCall('lsp_diagnostics', { file });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const fileCheck = resolveAndCheckFile(file, ctx.workspacePath);
    if (!fileCheck.ok) return { success: false, output: '', error: fileCheck.error };

    const client = getLspClient(ctx.workspacePath);
    try {
      await client.ensureStarted();
    } catch (err) {
      return lspUnavailableResult(err);
    }

    let diagnostics: Diagnostic[];
    try {
      diagnostics = await client.getDiagnostics(fileCheck.filePath);
    } catch (err) {
      return lspUnavailableResult(err);
    }

    runPostToolCall('lsp_diagnostics', { file, count: diagnostics.length });

    if (diagnostics.length === 0) {
      return { success: true, output: `无诊断问题(file=${file})` };
    }
    const errors = diagnostics.filter((d) => d.severity === 1).length;
    const warnings = diagnostics.filter((d) => d.severity === 2).length;
    const lines = diagnostics.map((d) => formatDiagnostic(d));
    return {
      success: true,
      output: `${diagnostics.length} 个诊断(${errors} errors, ${warnings} warnings):\n${lines.join('\n')}`,
    };
  },
};

export const lsp_hover: Tool = {
  name: 'lsp_hover',
  description:
    '使用 LSP(typescript-language-server)获取符号的 hover 信息(类型签名、文档注释等)。输入文件路径 + 1-based 行号/列号,返回符号的类型信息和文档。',
  dangerLevel: 'read',
  parameters: {
    file: { type: 'string', description: '文件路径(相对于工作区根目录)' },
    line: { type: 'number', description: '行号(1-based,从 1 开始)' },
    column: { type: 'number', description: '列号(1-based,从 1 开始)' },
  },
  required: ['file', 'line', 'column'],
  async execute(args, ctx): Promise<ToolResult> {
    const file = args.file as string | undefined;
    const line = args.line as number | undefined;
    const column = args.column as number | undefined;
    if (!file || typeof line !== 'number' || typeof column !== 'number') {
      return { success: false, output: '', error: '参数错误:需要 file(字符串)、line(数字)、column(数字)' };
    }

    const preResult = runPreToolCall('lsp_hover', { file, line, column });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const fileCheck = resolveAndCheckFile(file, ctx.workspacePath);
    if (!fileCheck.ok) return { success: false, output: '', error: fileCheck.error };

    const client = getLspClient(ctx.workspacePath);
    try {
      await client.ensureStarted();
    } catch (err) {
      return lspUnavailableResult(err);
    }

    let hover: Hover | null;
    try {
      hover = await client.hover(fileCheck.filePath, line, column);
    } catch (err) {
      return lspUnavailableResult(err);
    }

    runPostToolCall('lsp_hover', { file, line, column });

    return {
      success: true,
      output: formatHover(hover),
    };
  },
};

export const LSP_TOOLS: Tool[] = [lsp_goto_definition, lsp_find_references, lsp_diagnostics, lsp_hover];

export function registerLspTools(): void {
  registerTools(LSP_TOOLS);
}
