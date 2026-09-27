// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LSP 客户端 — 对标 OpenCode "开箱即用 LSP" 杀手锏。
 *
 * 策略(V3 #83 多语言收口,2026-09-27):
 *   - 懒启动 LSP server 子进程(stdio 模式),按文件扩展名自动选择对应 server
 *   - **语言集合只在一张表里**:`apps/cli/src/lsp/language-table.ts`。本文件不再持有
 *     任何"扩展名 → 语言/服务器/languageId"的第二份写法(改前有 `detectLanguageId()` switch
 *     与未登记扩展名静默回退 TypeScript 两处重复,均已删除)
 *   - 启动前先过 `apps/cli/src/lsp/probe.ts` 的候选探测,失败按
 *     `not-installed` / `version-too-low` / `probe-timeout` / `probe-failed` /
 *     `init-timeout` / `unsupported-extension` / `unsupported-request` 分类上报,
 *     **每一类都带原因与出路**;塌成一句"LSP 不可用"就是本票要消灭的形态
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
  WorkspaceSymbolRequest,
  RenameRequest,
  CodeActionRequest,
  type InitializeParams,
  type TextDocumentItem,
  type TextDocumentPositionParams,
  type PublishDiagnosticsParams,
  type Location,
  type Hover,
  type Diagnostic,
  type SymbolInformation,
  type WorkspaceEdit,
  type CodeAction,
  type CodeActionParams,
} from 'vscode-languageserver-protocol';
import { registerTools, type Tool, type ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
import {
  LSP_SERVERS,
  DEFAULT_LSP_LANGUAGE,
  allRegisteredExtensions,
  extensionOf,
  findLspConfigForFile,
  findLspConfigByLanguage,
  languageIdForFile,
  type LspBinaryCandidate,
  type LspRequestKind,
  type LspServerConfig,
} from '../lsp/language-table.js';
import {
  probeAllLspServers,
  resolveLspCandidate,
  checkWorkspaceMarkers,
  formatLspProbeOutcome,
  type LspProbeOutcome,
} from '../lsp/probe.js';

const LSP_INIT_TIMEOUT_MS = 15_000;
const LSP_REQUEST_TIMEOUT_MS = 10_000;
const DIAGNOSTICS_POLL_MS = 100;
const DIAGNOSTICS_MAX_POLLS = 10;

// ==================== Helpers ====================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  kind: LspFailureKind,
  msg: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new LspUnavailableError(kind, msg)), ms)),
  ]);
}

/**
 * 由候选声明的请求集投影出 `initialize` 的 client capabilities。
 *
 * 这张投影表住在 lsp.ts 而不是语言表里,是因为它描述的是**本客户端能消化什么**
 * (dynamicRegistration / prepareSupport 这些是客户端能力位),语言表描述的是
 * **那个 server 实现了什么**。两侧以 `LspRequestKind` 为唯一公共维度 ——
 * 新增一门请求要先扩 `LSP_REQUEST_KINDS`,漏投影会被语言表门 T5 点名。
 */
export function buildClientCapabilities(kinds: readonly LspRequestKind[]): InitializeParams['capabilities'] {
  const has = (k: LspRequestKind): boolean => kinds.includes(k);
  const caps: InitializeParams['capabilities'] = {
    textDocument: {
      publishDiagnostics: { relatedInformation: true },
    },
  };
  const textDocument = caps.textDocument as Record<string, unknown>;
  if (has('definition')) textDocument.definition = { linkSupport: true };
  if (has('references')) textDocument.references = {};
  if (has('hover')) textDocument.hover = { contentFormat: ['markdown', 'plaintext'] };
  if (has('rename')) textDocument.rename = { dynamicRegistration: false, prepareSupport: false };
  if (has('codeAction')) {
    textDocument.codeAction = {
      dynamicRegistration: false,
      codeActionLiteralSupport: {
        codeActionKind: { valueSet: ['quickfix', 'refactor', 'source', 'source.organizeImports'] },
      },
    };
  }
  if (has('workspaceSymbol')) {
    caps.workspace = { symbol: { dynamicRegistration: false } } as NonNullable<
      InitializeParams['capabilities']
    >['workspace'];
  }
  return caps;
}

function toUri(filePath: string): string {
  return pathToFileURL(filePath).toString();
}

export function toRelPath(uri: string, workspacePath: string): string {
  const abs = fileURLToPath(uri);
  return path.relative(workspacePath, abs).replace(/\\/g, '/');
}

/**
 * 扩展名 → LSP `languageId`。**唯一实现是语言表的 `languageIdForFile()`**。
 *
 * 改前这里是一张 `switch (ext)` 的第二份真相(它把 `.mjs`/`.cjs` 报成 `javascript`,
 * 又把 `.json`/`.css`/`.html`/`.md` 一并纳进来 —— 而那些扩展名在语言表里根本没有服务器,
 * 于是"能算出 languageId"与"有服务器可用"两件事长期不一致)。现在:表里没写 = 没有。
 */
function languageIdOf(config: LspServerConfig, filePath: string): string {
  const id = languageIdForFile(config, filePath);
  if (id) return id;
  // 走到这里说明表内该语言的 fileExtensions 与 languageIds 不同形 —— 语言表门 T3 会在提交链上
  // 先拦住;运行到这仍要显式喊,而不是静默报 'plaintext'(静默会让服务器"接了但什么都不索引")。
  throw new LspUnavailableError(
    'unsupported-extension',
    `语言表缺陷:${config.displayName} 登记了扩展名 ${path.extname(filePath).toLowerCase()} 却没有对应 languageId`,
  );
}

/** LSP 失败分类。每一档对应一个**不同的处置动作**,合并任两档都会让人按错的方向修。 */
export type LspFailureKind =
  | 'unsupported-extension'
  | 'unsupported-language'
  | 'not-installed'
  | 'version-too-low'
  | 'probe-timeout'
  | 'probe-failed'
  | 'init-timeout'
  | 'request-timeout'
  | 'spawn-failed'
  | 'unsupported-request'
  | 'unknown';

/** 带分类的 LSP 失败。`detail` 是人话原因(不得为空),`hint` 是出路。 */
export class LspUnavailableError extends Error {
  readonly kind: LspFailureKind;
  readonly detail: string;
  readonly hint: string;

  constructor(kind: LspFailureKind, detail: string, hint = '') {
    super(detail);
    this.name = 'LspUnavailableError';
    this.kind = kind;
    this.detail = detail;
    this.hint = hint;
  }
}

/** 把多个候选的失败探测归成一个分类。取"最靠近处置动作"的那一档,不取第一个。 */
export function classifyProbeFailures(probed: LspProbeOutcome[]): LspFailureKind {
  if (probed.some((p) => p.status === 'version-too-low')) return 'version-too-low';
  if (probed.length > 0 && probed.every((p) => p.status === 'not-installed')) return 'not-installed';
  if (probed.some((p) => p.status === 'probe-timeout')) return 'probe-timeout';
  if (probed.some((p) => p.status === 'probe-failed')) return 'probe-failed';
  return 'unknown';
}

/** 把候选探测的全部失败压成一句人话(第一个失败 + 失败候选数,不吞掉"试了几个")。 */
export function describeProbeFailures(probed: LspProbeOutcome[]): string {
  const failed = probed.filter((p) => p.status !== 'ready');
  if (failed.length === 0) return '探测未产生失败项(不应发生)';
  const parts = failed.map((f) => `${f.binary}: ${f.reason}`);
  return `${failed.length} 个候选全部失败 —— ${parts.join(' ; ')}`;
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

/** LSP SymbolKind 枚举值 → 可读名称映射(1-26) */
const SYMBOL_KIND_NAMES: Record<number, string> = {
  1: 'File', 2: 'Module', 3: 'Namespace', 4: 'Package', 5: 'Class',
  6: 'Method', 7: 'Property', 8: 'Field', 9: 'Constructor', 10: 'Enum',
  11: 'Interface', 12: 'Function', 13: 'Variable', 14: 'Constant', 15: 'String',
  16: 'Number', 17: 'Boolean', 18: 'Array', 19: 'Object', 20: 'Key',
  21: 'Null', 22: 'EnumMember', 23: 'Struct', 24: 'Event', 25: 'Operator',
  26: 'TypeParameter',
};

function symbolKindName(kind: number): string {
  return SYMBOL_KIND_NAMES[kind] ?? 'Unknown';
}

export { symbolKindName };

export function resolveAndCheckFile(file: string, workspacePath: string): { ok: true; filePath: string } | { ok: false; error: string } {
  const filePath = path.resolve(workspacePath, file);
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `文件不存在: ${file}` };
  }
  return { ok: true, filePath };
}

// ==================== LSP Client (singleton per workspace) ====================

type LspConnection = ReturnType<typeof createProtocolConnection>;

/** LSP 客户端单例(export 供 lsp-workspace.ts 复用) */
export class LspClient {
  private conn: LspConnection | undefined;
  private child: ChildProcess | undefined;
  private workspacePath: string;
  private config: LspServerConfig;
  /** 探测胜出的候选(start() 之前为 undefined) */
  private candidate: LspBinaryCandidate | undefined;
  private diagnosticsCache = new Map<string, Diagnostic[]>();
  private openedFiles = new Set<string>();
  private startPromise: Promise<void> | undefined;
  private started = false;

  constructor(workspacePath: string, config: LspServerConfig) {
    this.workspacePath = workspacePath;
    this.config = config;
  }

  /** 当前 client 的语言标识 */
  get language(): string {
    return this.config.language;
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
    // —— 启动前先过候选探测:把"没装 / 版本不够 / 探针挂住"和"装了但 initialize 不回来"
    //    分成不同分类,而不是全部塌成一次 15s 超时后的一句"LSP 不可用"。
    const resolution = resolveLspCandidate(this.config);
    if (!resolution.ok || !resolution.candidate) {
      throw new LspUnavailableError(
        classifyProbeFailures(resolution.probed),
        describeProbeFailures(resolution.probed),
        this.config.candidates.map((c) => c.installHint)[0] ?? '',
      );
    }
    const candidate = resolution.candidate;
    this.candidate = candidate;
    const cmd = candidate.binary;
    const args = candidate.args;
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.workspacePath,
      windowsHide: true,
      shell: true,
    });
    this.child = child;

    if (!child.stdout || !child.stdin) {
      throw new LspUnavailableError(
        'spawn-failed',
        `无法获取 ${candidate.binary} 的 stdio 流(探测时它在位,启动时拿不到管道)`,
      );
    }

    // 二进制不存在时 'error' 事件异步触发
    const spawnError = new Promise<never>((_, reject) => {
      child.on('error', (err) => {
        reject(
          new LspUnavailableError(
            'spawn-failed',
            `${candidate.binary} 启动失败(探测到在位但起不来,通常是 PATH 里有同名残壳或依赖缺失): ${err.message}`,
            candidate.installHint,
          ),
        );
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
      this.candidate = undefined;
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
      // 初始化能力**由语言表的候选声明投影而来**,不在这里另写一份"支持哪些请求"的清单:
      // 表说这个 server 不做 rename,就不要向它声明 rename 能力(也不要在后面发这个请求)。
      capabilities: buildClientCapabilities(candidate.capabilities),
    };
    if (this.config.initializationOptions) {
      initParams.initializationOptions = this.config.initializationOptions;
    }

    const initPromise = this.conn.sendRequest(InitializeRequest.type, initParams);
    await withTimeout(
      Promise.race([initPromise, spawnError]),
      LSP_INIT_TIMEOUT_MS,
      'init-timeout',
      `LSP initialize 超时:${candidate.binary} 在位但 ${LSP_INIT_TIMEOUT_MS}ms 内没有回 initialize —— 这与"没装"是两个不同的处置动作`,
    );

    await this.conn.sendNotification(InitializedNotification.type, {});
    this.started = true;
  }

  /**
   * 请求前预检:该候选在语言表里声明实现过这个请求吗?
   *
   * 没声明就**立刻**给出分类诊断,而不是发一条服务器根本不应答的请求再等 10s 超时,
   * 最后回一句无法定位的"LSP 不可用"(pyright 无 rename 就是这个形状)。
   */
  private requireCapability(kind: LspRequestKind): LspBinaryCandidate {
    const candidate = this.candidate;
    if (!candidate) {
      throw new LspUnavailableError('unknown', '内部错误:请求在候选解析之前发出(start() 未成功)');
    }
    if (!candidate.capabilities.includes(kind)) {
      throw new LspUnavailableError(
        'unsupported-request',
        `${candidate.binary} 在语言表里未声明 ${kind} 能力(该 server 不实现这一请求)`,
        `同一语言的其它候选: ${this.config.candidates
          .filter((c) => c.capabilities.includes(kind))
          .map((c) => c.binary)
          .join(', ') || '无 —— 请改用 codegraph 类工具'}`,
      );
    }
    return candidate;
  }

  private async ensureOpen(filePath: string): Promise<string> {
    const uri = toUri(filePath);
    if (this.openedFiles.has(uri)) return uri;
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const doc: TextDocumentItem = {
      uri,
      languageId: languageIdOf(this.config, filePath),
      version: 1,
      text: content,
    };
    await this.conn!.sendNotification(DidOpenTextDocumentNotification.type, { textDocument: doc });
    this.openedFiles.add(uri);
    await sleep(200);
    return uri;
  }

  async gotoDefinition(filePath: string, line: number, col: number): Promise<Location[]> {
    this.requireCapability('definition');
    const uri = await this.ensureOpen(filePath);
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position: { line: line - 1, character: col - 1 },
    };
    const result = await withTimeout(
      this.conn!.sendRequest(DefinitionRequest.type, params),
      LSP_REQUEST_TIMEOUT_MS,
      'request-timeout',
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
    this.requireCapability('references');
    const uri = await this.ensureOpen(filePath);
    const params = {
      textDocument: { uri },
      position: { line: line - 1, character: col - 1 },
      context: { includeDeclaration },
    };
    const result = await withTimeout(
      this.conn!.sendRequest(ReferencesRequest.type, params),
      LSP_REQUEST_TIMEOUT_MS,
      'request-timeout',
      'LSP find references 超时',
    );
    return normalizeLocations(result);
  }

  async getDiagnostics(filePath: string): Promise<Diagnostic[]> {
    this.requireCapability('diagnostics');
    const uri = await this.ensureOpen(filePath);
    for (let i = 0; i < DIAGNOSTICS_MAX_POLLS; i++) {
      const diags = this.diagnosticsCache.get(uri);
      if (diags !== undefined) return diags;
      await sleep(DIAGNOSTICS_POLL_MS);
    }
    return this.diagnosticsCache.get(uri) ?? [];
  }

  async hover(filePath: string, line: number, col: number): Promise<Hover | null> {
    this.requireCapability('hover');
    const uri = await this.ensureOpen(filePath);
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position: { line: line - 1, character: col - 1 },
    };
    return withTimeout(
      this.conn!.sendRequest(HoverRequest.type, params),
      LSP_REQUEST_TIMEOUT_MS,
      'request-timeout',
      'LSP hover 超时',
    );
  }

  /**
   * workspace/symbol — 全局符号搜索。
   * 返回 SymbolInformation[](name/kind/location/containerName)。
   * 服务器未在语言表声明该能力时 ⇒ `requireCapability` 给出分类诊断(改前是发出去再等超时)。
   * 注意:LSP 3.17+ 可能返回 WorkspaceSymbol(location 可能只有 uri 无 range),
   * 此处统一归一化为 SymbolInformation(LocationUriOnly 补全空 range)。
   */
  async workspaceSymbol(query: string): Promise<SymbolInformation[]> {
    this.requireCapability('workspaceSymbol');
    const result = await withTimeout(
      this.conn!.sendRequest(WorkspaceSymbolRequest.type, { query }),
      LSP_REQUEST_TIMEOUT_MS,
      'request-timeout',
      'LSP workspace/symbol 超时',
    );
    if (!result) return [];
    return result.map((sym): SymbolInformation => {
      const loc = sym.location as { uri: string; range?: Location['range'] };
      if (loc.range) {
        return sym as SymbolInformation;
      }
      // LocationUriOnly:补全空 range 以满足 SymbolInformation 类型
      return {
        name: sym.name,
        kind: sym.kind,
        location: { uri: loc.uri, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } },
        containerName: sym.containerName,
      } as SymbolInformation;
    });
  }

  /**
   * textDocument/rename — 符号重命名。
   * line/character 为 0-based(LSP 标准)。
   * 返回 WorkspaceEdit | null。若 server 不支持 rename 返回 null。
   */
  async renameSymbol(
    filePath: string,
    line: number,
    character: number,
    newName: string,
  ): Promise<WorkspaceEdit | null> {
    this.requireCapability('rename');
    const uri = await this.ensureOpen(filePath);
    const params = {
      textDocument: { uri },
      position: { line, character },
      newName,
    };
    const result = await withTimeout(
      this.conn!.sendRequest(RenameRequest.type, params),
      LSP_REQUEST_TIMEOUT_MS,
      'request-timeout',
      'LSP textDocument/rename 超时',
    );
    return result;
  }

  /**
   * textDocument/codeAction — 快速修复/重构建议。
   * line/character 为 0-based(LSP 标准)。
   * kind 可选,用于过滤(如 'quickfix' / 'refactor' / 'source.organizeImports')。
   * 返回 CodeAction[](title/kind/edit/command/isPreferred)。
   */
  async codeActions(
    filePath: string,
    line: number,
    character: number,
    kind?: string,
  ): Promise<CodeAction[]> {
    this.requireCapability('codeAction');
    const uri = await this.ensureOpen(filePath);
    const params: CodeActionParams = {
      textDocument: { uri },
      range: {
        start: { line, character },
        end: { line, character },
      },
      context: {
        diagnostics: [],
        only: kind ? [kind] : undefined,
      },
    };
    const result = await withTimeout(
      this.conn!.sendRequest(CodeActionRequest.type, params),
      LSP_REQUEST_TIMEOUT_MS,
      'request-timeout',
      'LSP textDocument/codeAction 超时',
    );
    return (result ?? []) as CodeAction[];
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

// ==================== Singleton manager (per workspace+language) ====================

const clientMap = new Map<string, LspClient>();

function clientKey(workspacePath: string, language: string): string {
  return `${workspacePath}::${language}`;
}

/**
 * 按文件扩展名获取 LSP client。
 * 复用同语言的单例 client;**未登记的扩展名不再静默回退 TypeScript**(V3 #83)。
 *
 * 改前的回退会把"这门语言没有服务器"伪装成"服务器说没找到",一次 `.vue` 文件的
 * gotoDefinition 结果是 `找到 0 处定义` —— 用户据此继续信任一个根本没参与的引擎。
 * 现抛 `unsupported-extension`,由 `lspUnavailableResult` 压成分级诊断。
 */
export function getLspClientForFile(workspacePath: string, filePath: string): LspClient {
  const config = findLspConfigForFile(filePath);
  if (!config) {
    throw new LspUnavailableError(
      'unsupported-extension',
      `语言表里没有 ${extensionOf(filePath) || '(无扩展名)'} 这门语言的服务器配置`,
      `已登记扩展名:${allRegisteredExtensions().join(' ')};需要新增请在 apps/cli/src/lsp/language-table.ts 追加一项(有门审)`,
    );
  }
  return clientFor(workspacePath, config);
}

/**
 * 按语言标识获取 LSP client(用于 workspace/symbol 等不依赖文件的场景)。
 * 未登记语言返回 null —— 调用方必须把它变成诊断(见 `lsp_workspace_symbol`)。
 */
export function getLspClientByLanguage(
  workspacePath: string,
  language: string = DEFAULT_LSP_LANGUAGE,
): LspClient | null {
  const config = findLspConfigByLanguage(language);
  if (!config) return null;
  return clientFor(workspacePath, config);
}

function clientFor(workspacePath: string, config: LspServerConfig): LspClient {
  const key = clientKey(workspacePath, config.language);
  let client = clientMap.get(key);
  if (!client) {
    client = new LspClient(workspacePath, config);
    clientMap.set(key, client);
  }
  return client;
}

/**
 * 向后兼容:获取默认语言的 LSP client(原 getLspClient)。
 */
export function getLspClient(workspacePath: string): LspClient {
  return getLspClientByLanguage(workspacePath, DEFAULT_LSP_LANGUAGE)!;
}

export function disposeLspClient(): void {
  for (const client of clientMap.values()) {
    client.dispose();
  }
  clientMap.clear();
}

// ==================== Tools ====================

export const FALLBACK_HINT = '建议改用 codegraph/goto_definition 或 codegraph/find_references 作为离线兜底';

/** 分类 → errorType。`lsp-unavailable` 只留给"真的分不出"那一档,不再是所有失败的统称。 */
const ERROR_TYPE_BY_KIND: Record<LspFailureKind, string> = {
  'unsupported-extension': 'lsp-unsupported-extension',
  'unsupported-language': 'lsp-unsupported-language',
  'not-installed': 'lsp-not-installed',
  'version-too-low': 'lsp-version-too-low',
  'probe-timeout': 'lsp-probe-timeout',
  'probe-failed': 'lsp-probe-failed',
  'init-timeout': 'lsp-init-timeout',
  'request-timeout': 'lsp-request-timeout',
  'spawn-failed': 'lsp-spawn-failed',
  'unsupported-request': 'lsp-unsupported-request',
  unknown: 'lsp-unavailable',
};

/** 分类 → 该分类独有的处置动作。装它 vs 查它为什么挂 vs 换工具,是三件事。 */
const REMEDY_BY_KIND: Record<LspFailureKind, string> = {
  'unsupported-extension': '这门语言没有服务器配置:换 codegraph,或在语言表补一项(见 apps/cli/src/lsp/language-table.ts)',
  'unsupported-language': '换用已登记的语言,或在语言表补一项',
  'not-installed': '按下面给出的安装命令装它;装完重跑一次即可,不需要改代码',
  'version-too-low': '升级该服务器(版本低于语言表声明的下限)',
  'probe-timeout': '进程在位但探针无响应:先手跑一次它的 --version 看是否卡在初始化/联网',
  'probe-failed': '进程在位但退出码非 0:先手跑它取版本的那条命令看 stderr',
  'init-timeout': '服务器起来了但 initialize 不回:查它的工作区索引是否在跑(大仓冷启动常见)',
  'request-timeout': '这一条请求超时:缩小范围或改用 codegraph',
  'spawn-failed': 'PATH 里有同名残壳或依赖缺失:确认哪个身份的 PATH 被用上了',
  'unsupported-request': '该服务器不实现这个请求,改用同一语言的其它服务器或 codegraph',
  unknown: FALLBACK_HINT,
};

/**
 * 把任意失败压成**带分类、带原因、带出路**的工具结果。
 *
 * 三条硬要求(每条都对应改前真实存在的一种"安静"):
 *   1. `errorType` 必须是分类值 ⇒ 上层能按档处置,而不是对一句中文做正则;
 *   2. `error` 里必须同时有人话原因与下一步动作 ⇒ 不得只说"不可用";
 *   3. 兜底 hint(codegraph)在任何一档都不得丢 ⇒ 用户至少有一条能走通的路。
 */
export function lspUnavailableResult(err: unknown): ToolResult {
  const kind: LspFailureKind = err instanceof LspUnavailableError ? err.kind : 'unknown';
  const detail = err instanceof Error ? err.message : String(err);
  const hint = err instanceof LspUnavailableError && err.hint ? ` | 出路: ${err.hint}` : '';
  return {
    success: false,
    output: '',
    error: `LSP ${kind}: ${detail}${hint} | ${REMEDY_BY_KIND[kind]} | ${FALLBACK_HINT}`,
    errorType: ERROR_TYPE_BY_KIND[kind],
  };
}

/** 非 LspUnavailableError 的失败也要分类:请求期超时按档归位,其余落 unknown。 */
function toLspError(err: unknown): LspUnavailableError {
  if (err instanceof LspUnavailableError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const kind: LspFailureKind = /超时/.test(msg) ? 'request-timeout' : 'unknown';
  return new LspUnavailableError(kind, msg);
}

export const lsp_goto_definition: Tool = {
  name: 'lsp_goto_definition',
  description:
    '使用 LSP 精确定位符号定义位置(支持的语言与对应服务器全在 apps/cli/src/lsp/language-table.ts 一张表里,按文件扩展名自动选择;先调 lsp_server_status 可看本机当前哪几门真的可用)。基于完整类型系统,精度远超 codegraph/goto_definition 的正则匹配。输入文件路径 + 1-based 行号/列号,返回所有定义位置(file:line:col)。LSP 不可用时降级提示用 codegraph。',
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

    // getLspClientForFile 现在会因"这门语言没登记"抛错(V3 #83 取消静默回退),
    // 所以取 client 这一步本身也必须在 try 内 —— 否则异常会冒到执行器,丢掉分类。
    let client: LspClient;
    try {
      client = getLspClientForFile(ctx.workspacePath, fileCheck.filePath);
      await client.ensureStarted();
    } catch (err) {
      return lspUnavailableResult(toLspError(err));
    }

    let locations: Location[];
    try {
      locations = await client.gotoDefinition(fileCheck.filePath, line, column);
    } catch (err) {
      return lspUnavailableResult(toLspError(err));
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
    '使用 LSP 查找符号所有引用位置(支持的语言与对应服务器全在 apps/cli/src/lsp/language-table.ts 一张表里,按文件扩展名自动选择;先调 lsp_server_status 可看本机当前哪几门真的可用)。基于完整类型系统,精度远超 codegraph/find_references 的正则匹配。输入文件路径 + 1-based 行号/列号,返回所有引用位置(file:line:col)。LSP 不可用时降级提示用 codegraph。',
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

    // getLspClientForFile 现在会因"这门语言没登记"抛错(V3 #83 取消静默回退),
    // 所以取 client 这一步本身也必须在 try 内 —— 否则异常会冒到执行器,丢掉分类。
    let client: LspClient;
    try {
      client = getLspClientForFile(ctx.workspacePath, fileCheck.filePath);
      await client.ensureStarted();
    } catch (err) {
      return lspUnavailableResult(toLspError(err));
    }

    let locations: Location[];
    try {
      locations = await client.findReferences(fileCheck.filePath, line, column, includeDeclaration);
    } catch (err) {
      return lspUnavailableResult(toLspError(err));
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
    '使用 LSP 获取文件的类型错误和警告诊断(支持的语言与对应服务器全在 apps/cli/src/lsp/language-table.ts 一张表里,按文件扩展名自动选择;先调 lsp_server_status 可看本机当前哪几门真的可用)。比正则解析精确得多(能检测类型错误、未使用变量等)。输入文件路径,返回诊断列表(severity + line:col + message)。',
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

    // getLspClientForFile 现在会因"这门语言没登记"抛错(V3 #83 取消静默回退),
    // 所以取 client 这一步本身也必须在 try 内 —— 否则异常会冒到执行器,丢掉分类。
    let client: LspClient;
    try {
      client = getLspClientForFile(ctx.workspacePath, fileCheck.filePath);
      await client.ensureStarted();
    } catch (err) {
      return lspUnavailableResult(toLspError(err));
    }

    let diagnostics: Diagnostic[];
    try {
      diagnostics = await client.getDiagnostics(fileCheck.filePath);
    } catch (err) {
      return lspUnavailableResult(toLspError(err));
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
    '使用 LSP 获取符号的 hover 信息(类型签名、文档注释等;支持的语言与对应服务器全在 apps/cli/src/lsp/language-table.ts 一张表里,按文件扩展名自动选择;先调 lsp_server_status 可看本机当前哪几门真的可用)。输入文件路径 + 1-based 行号/列号,返回符号的类型信息和文档。',
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

    // getLspClientForFile 现在会因"这门语言没登记"抛错(V3 #83 取消静默回退),
    // 所以取 client 这一步本身也必须在 try 内 —— 否则异常会冒到执行器,丢掉分类。
    let client: LspClient;
    try {
      client = getLspClientForFile(ctx.workspacePath, fileCheck.filePath);
      await client.ensureStarted();
    } catch (err) {
      return lspUnavailableResult(toLspError(err));
    }

    let hover: Hover | null;
    try {
      hover = await client.hover(fileCheck.filePath, line, column);
    } catch (err) {
      return lspUnavailableResult(toLspError(err));
    }

    runPostToolCall('lsp_hover', { file, line, column });

    return {
      success: true,
      output: formatHover(hover),
    };
  },
};

// ==================== 可诊断性出口:本机语言服务器实况 ====================

/**
 * `lsp_server_status` —— 把"这台机器上 LSP 到底能不能用、为什么不能"变成一次可调用的事实。
 *
 * 立票理由(V3 #83):改前失败只有一句 `LSP 不可用: spawn ... ENOENT`,
 * 而"没装 / 版本过低 / 探针挂住 / initialize 不回"四件事的处置动作完全不同;
 * 更糟的是**没有任何入口能一次看清全表状态**,于是每次都是撞一个问一个。
 * 本工具就是那条"探测失败必须可诊断地上报"的落点:逐候选给状态、给实测版本、
 * 给原因、给安装出路,并把"版本判据到底跑没跑"如实写出来(不得把没量写成通过)。
 */
export const lsp_server_status: Tool = {
  name: 'lsp_server_status',
  description:
    '列出本机各语言服务器的真实可用状态(语言表全表 × 逐候选探测)。返回每门语言的状态(ready / not-installed / version-too-low / probe-timeout / probe-failed)、实测版本、不可用的具体原因与安装出路,并对需要工程根标记的语言(如 Cargo.toml / go.mod)提示当前工作区是否具备。其它 lsp_* 工具失败时,先用本工具定位是哪一档问题,不要盲重试。',
  dangerLevel: 'read',
  parameters: {
    language: {
      type: 'string',
      description: '只看某一门语言(缺省看全表)',
    },
    file: {
      type: 'string',
      description: '或按某个文件的扩展名只看它对应的那门语言',
    },
  },
  required: [],
  async execute(args, ctx): Promise<ToolResult> {
    const language = typeof args.language === 'string' ? args.language : undefined;
    const file = typeof args.file === 'string' ? args.file : undefined;
    const preResult = runPreToolCall('lsp_server_status', { language, file });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    let wanted: string[] | null = null;
    if (file) {
      const cfg = findLspConfigForFile(file);
      if (!cfg) {
        return {
          success: false,
          output: '',
          error: `语言表里没有 ${extensionOf(file) || '(无扩展名)'} 这门语言 | 已登记扩展名:${allRegisteredExtensions().join(' ')}`,
          errorType: ERROR_TYPE_BY_KIND['unsupported-extension'],
        };
      }
      wanted = [cfg.language];
    } else if (language) {
      if (!findLspConfigByLanguage(language)) {
        return {
          success: false,
          output: '',
          error: `未登记的语言 '${language}' | 表内语言:${LSP_SERVERS.map((c) => c.language).join(' ')}`,
          errorType: ERROR_TYPE_BY_KIND['unsupported-language'],
        };
      }
      wanted = [language];
    }

    let rows: LspProbeOutcome[];
    try {
      rows = probeAllLspServers(wanted);
    } catch (err) {
      // 空枚举按 probe.ts 抛错:那是判据失明,不是"全部不可用",必须喊出来。
      return lspUnavailableResult(toLspError(err));
    }

    const ready = rows.filter((r) => r.status === 'ready');
    const lines = rows.map(formatLspProbeOutcome);
    // 工程根标记只对"已就绪"的语言有意义,且**只作提示不改判**(理由见语言表字段注释)
    const markerNotes: string[] = [];
    for (const config of LSP_SERVERS) {
      if (wanted && !wanted.includes(config.language)) continue;
      if (!ready.some((r) => r.language === config.language)) continue;
      const markers = checkWorkspaceMarkers(config, ctx.workspacePath);
      if (markers.required.length > 0 && markers.found.length === 0) {
        markerNotes.push(
          `${config.language}: 服务器已就绪,但工作区没有 ${markers.required.join(' / ')} 任一标记 ⇒ 符号索引大概率为空(这是提示,不是错误)`,
        );
      }
    }
    runPostToolCall('lsp_server_status', { language, file, probed: rows.length, ready: ready.length });

    return {
      success: true,
      output: [
        `语言表 ${LSP_SERVERS.length} 门 / 候选 ${rows.length} 个 / 就绪 ${ready.length} 个(工作区 ${ctx.workspacePath})`,
        ...lines,
        ...markerNotes,
      ].join('\n'),
    };
  },
};

// ==================== Workspace 级 LSP 工具(Wave 9,从 lsp-workspace.ts 导入)====================
import { lsp_workspace_symbol, lsp_rename_symbol, lsp_code_actions } from './lsp-workspace.js';
export { lsp_workspace_symbol, lsp_rename_symbol, lsp_code_actions };

export const LSP_TOOLS: Tool[] = [
  lsp_goto_definition,
  lsp_find_references,
  lsp_diagnostics,
  lsp_hover,
  lsp_server_status,
  lsp_workspace_symbol,
  lsp_rename_symbol,
  lsp_code_actions,
];

export function registerLspTools(): void {
  registerTools(LSP_TOOLS);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
