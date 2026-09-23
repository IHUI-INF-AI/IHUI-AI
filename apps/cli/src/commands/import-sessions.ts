// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ihui import sessions 子命令组 — 外部「历史会话」导入(D28,全端连通补齐 CLI 端)。
 *
 * 用法:
 *   ihui import sessions sources                          列出支持的会话来源 + 可接受后缀 + 常见导出目录
 *   ihui import sessions discover [source] [--path dir]   自动发现本地导出文件候选
 *   ihui import sessions parse <source> [file]            上传解析并预览(不落库)
 *   ihui import sessions commit <source> [file] --all     解析 + 逐会话串行落库
 *   ihui import sessions commit <source> <file> --only 1,3-5
 *   ihui import sessions history                          查询最近导入批次
 *
 * 设计:
 * - 与同族的供应商配置导入(import.ts → /api/user/cli-import/*)语义不同:本组导入的是对话,
 *   落进会话列表,一律走 @ihui/api-client 的 conversation-import 封装,CLI 端不自行拼 multipart。
 * - 预览只打印元信息(序号/标题/消息数/模型/起始时间),消息正文不出终端 —— transcript 属用户隐私。
 * - CLI 相对 Web 端的优势:命令行能直接读 ~/.claude/projects、~/.codex/sessions,
 *   省略 <file>(或传目录)时自动发现候选;非交互环境列完清单即报错,绝不挂起等输入。
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { readdir, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  ConversationImportCommitPayload,
  ConversationImportHistoryItem,
  ConversationImportParseResult,
  ConversationImportSource,
  ParsedImportConversation,
} from '@ihui/api-client';
import {
  commitConversationImport,
  getConversationImportHistory,
  parseConversationImport,
} from '@ihui/api-client';
import { formatTime } from './import.js';
import { t } from '../i18n/index.js';

// =============================================================================
// 来源配置(枚举复用 @ihui/api-client 的 ConversationImportSource,此处只挂 CLI 侧元信息)
// =============================================================================

interface SessionSourceConfig {
  label: string;
  description: string;
  /** 可接受的导出文件后缀(与 Web 端 conversation-import-panel 的 accept 同口径) */
  extensions: readonly string[];
  /** 常见导出目录;不存在的目录在发现阶段静默跳过 */
  roots: () => string[];
}

const SESSION_SOURCE_CONFIG: Record<ConversationImportSource, SessionSourceConfig> = {
  claude_code: {
    label: 'Claude Code',
    description: t('cliImportSessions.sourceClaude'),
    extensions: ['.jsonl', '.json'],
    roots: () => [path.join(os.homedir(), '.claude', 'projects')],
  },
  codex: {
    label: 'Codex CLI',
    description: t('cliImportSessions.sourceCodex'),
    extensions: ['.jsonl', '.json'],
    roots: () => [path.join(os.homedir(), '.codex', 'sessions')],
  },
  cursor: {
    label: 'Cursor',
    description: t('cliImportSessions.sourceCursor'),
    // 与 ai-service 路由白名单一致:三种库后缀同义,agent-transcripts 是 .jsonl
    extensions: ['.json', '.jsonl', '.vscdb', '.db', '.sqlite'],
    roots: () => [path.join(cursorStorageParent(), 'Cursor', 'User', 'globalStorage')],
  },
  aider: {
    label: 'Aider',
    description: t('cliImportSessions.sourceAider'),
    extensions: ['.md', '.json', '.jsonl'],
    roots: () => [process.cwd()],
  },
};

const SESSION_SOURCE_VALUES = Object.keys(SESSION_SOURCE_CONFIG) as ConversationImportSource[];

/** Cursor 用户数据父目录(平台差异只在这里收敛,不写死任何绝对路径) */
function cursorStorageParent(): string {
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support');
  if (process.platform === 'win32') {
    return process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
  }
  return process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
}

/** 上传预校验上限:与 Web 端同口径 20MB(超大导出先本地拦,省一次往返) */
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const DEFAULT_DISCOVER_LIMIT = 20;
/** 目录遍历上限:codex 的 sessions/YYYY/MM/DD 需要 3 层目录 + 文件本体 */
const MAX_WALK_DEPTH = 4;
const MAX_WALK_ENTRIES = 5000;
const SKIP_DIR_NAMES = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'venv', '.venv', '__pycache__']);

export function isSessionSource(value: string): value is ConversationImportSource {
  return (SESSION_SOURCE_VALUES as string[]).includes(value);
}

function toSessionSource(value: string): ConversationImportSource | null {
  if (isSessionSource(value)) return value;
  console.error(chalk.red(t('cliImportSessions.invalidSource', { valueValue: value })));
  console.error(chalk.dim(t('cliImportSessions.validValues', { values: SESSION_SOURCE_VALUES.join(', ') })));
  console.error(chalk.dim(t('cliImportSessions.sourcesHint')));
  return null;
}

/** `~` / `~/x` 展开(os.homedir(),不依赖 shell 也不写死盘符) */
export function expandTilde(input: string): string {
  if (input === '~') return os.homedir();
  if (input.startsWith('~/') || input.startsWith('~\\')) return path.join(os.homedir(), input.slice(1));
  return input;
}

// =============================================================================
// 本地导出文件发现
// =============================================================================

export interface SessionFileCandidate {
  file: string;
  mtimeMs: number;
}

async function collectFromDir(
  dir: string,
  extensions: readonly string[],
  depth: number,
  out: SessionFileCandidate[],
  budget: { left: number },
): Promise<void> {
  if (depth < 0 || budget.left <= 0) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
      // 不可读/不存在 → 静默跳过,由调用方统一给出 noFilesFound 提示
      return;
  }
  for (const entry of entries) {
    if (budget.left <= 0) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      await collectFromDir(full, extensions, depth - 1, out, budget);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!extensions.includes(path.extname(entry.name).toLowerCase())) continue;
    budget.left -= 1;
    const st = await stat(full).catch(() => null);
    out.push({ file: full, mtimeMs: st?.mtimeMs ?? 0 });
  }
}

/** 按来源发现候选导出文件(按修改时间倒序,最新的通常是用户想导入的那个) */
export async function discoverSessionCandidates(
  source: ConversationImportSource,
  inputPath: string | undefined,
  limit: number,
): Promise<SessionFileCandidate[]> {
  const cfg = SESSION_SOURCE_CONFIG[source];
  const roots = inputPath ? [path.resolve(expandTilde(inputPath))] : cfg.roots();
  const found: SessionFileCandidate[] = [];
  const budget = { left: MAX_WALK_ENTRIES };
  for (const root of roots) {
    const st = await stat(root).catch(() => null);
    if (!st) continue;
    if (st.isFile()) {
      if (cfg.extensions.includes(path.extname(root).toLowerCase())) {
        found.push({ file: root, mtimeMs: st.mtimeMs });
      }
      continue;
    }
    await collectFromDir(root, cfg.extensions, MAX_WALK_DEPTH, found, budget);
  }
  const seen = new Set<string>();
  const unique: SessionFileCandidate[] = [];
  for (const c of found.sort((a, b) => b.mtimeMs - a.mtimeMs)) {
    if (seen.has(c.file)) continue;
    seen.add(c.file);
    unique.push(c);
  }
  return unique.slice(0, Math.max(1, limit));
}

export async function discoverSessionFiles(
  source: ConversationImportSource,
  inputPath: string | undefined,
  limit: number,
): Promise<string[]> {
  const candidates = await discoverSessionCandidates(source, inputPath, limit);
  return candidates.map((c) => c.file);
}

async function pickCandidate(candidates: string[]): Promise<string | null> {
  if (!process.stdin.isTTY) {
    console.error(chalk.red(t('cliImportSessions.ambiguousNonInteractive', { length: candidates.length })));
    console.error(chalk.dim(t('cliImportSessions.passPathExplicitly')));
    return null;
  }
  const { default: inquirer } = await import('inquirer');
  // inquirer v14 的类型面已不认旧名 'list',用等价的 select(交互行为一致)
  const { file } = await inquirer.prompt([
    {
      type: 'select',
      name: 'file',
      message: t('cliImportSessions.chooseExportFile'),
      choices: candidates.map((c) => ({ name: c, value: c })),
      pageSize: 15,
    },
  ]);
  return typeof file === 'string' ? file : null;
}

/** 定位要上传的文件:<file> 直接用,<dir>/省略 则自动发现(多个候选时交互选择) */
export async function resolveExportFile(
  source: ConversationImportSource,
  inputPath: string | undefined,
): Promise<string | null> {
  if (inputPath) {
    const abs = path.resolve(expandTilde(inputPath));
    const st = await stat(abs).catch(() => null);
    if (!st) {
      console.error(chalk.red(t('cliImportSessions.pathNotFound', { abs: abs })));
      return null;
    }
    if (st.isFile()) return abs;
  }
  const candidates = await discoverSessionFiles(source, inputPath, DEFAULT_DISCOVER_LIMIT);
  if (candidates.length === 0) {
    const cfg = SESSION_SOURCE_CONFIG[source];
    const scanned = inputPath ? [path.resolve(expandTilde(inputPath))] : cfg.roots();
    console.error(chalk.red(t('cliImportSessions.noImportableFile')));
    console.error(chalk.dim(t('cliImportSessions.scannedPaths', { scanned: scanned.join(', ') })));
    console.error(chalk.dim(t('cliImportSessions.acceptedExtensions', { extensions: cfg.extensions.join(', ') })));
    console.error(chalk.dim(t('cliImportSessions.alsoSpecifyPath', { source: source })));
    return null;
  }
  const [first] = candidates;
  if (candidates.length === 1 && first) {
    console.info(chalk.dim(t('cliImportSessions.autoDiscovered', { first: first })));
    return first;
  }
  console.info(chalk.dim(t('cliImportSessions.candidatesListed', { length: candidates.length })));
  candidates.forEach((c, i) => console.info(chalk.dim(`  ${i + 1}. ${c}`)));
  return pickCandidate(candidates);
}

// =============================================================================
// 解析 / 落库
// =============================================================================

/** 上传前本地预校验:超限返回错误文案,未超限返回 null */
export function checkUploadSize(sizeInBytes: number): string | null {
  if (sizeInBytes <= MAX_FILE_SIZE) return null;
  const limitMb = MAX_FILE_SIZE / 1024 / 1024;
  return t('cliImportSessions.fileTooLarge', { size: (sizeInBytes / 1024 / 1024).toFixed(1), limitMb: limitMb });
}

async function uploadAndParse(
  source: ConversationImportSource,
  absFile: string,
): Promise<ConversationImportParseResult | null> {
  const st = await stat(absFile).catch(() => null);
  if (!st) {
    console.error(chalk.red(t('cliImportSessions.fileMissing', { absFile: absFile })));
    return null;
  }
  const oversize = checkUploadSize(st.size);
  if (oversize) {
    console.error(chalk.red(oversize));
    return null;
  }
  let buffer: Buffer;
  try {
    buffer = await readFile(absFile);
  } catch (err) {
    console.error(chalk.red(t('cliImportSessions.readFailed', { reason: (err as Error).message })));
    return null;
  }
  const file = new File([new Uint8Array(buffer)], path.basename(absFile));
  const res = await parseConversationImport(file, source);
  if (!res.success) {
    console.error(chalk.red(t('cliImportSessions.parseFailed', { error: res.error })));
    return null;
  }
  return res.data;
}

function describeConversation(index: number, conv: ParsedImportConversation): string {
  const title = conv.title?.trim() || t('cliImportSessions.untitled');
  const model = conv.model?.trim() || '—';
  const startedAt = conv.sourceCreatedAt ?? conv.sourceUpdatedAt;
  return `  ${String(index).padStart(3)}. ${title} ${chalk.dim(t('cliImportSessions.conversationMeta', { count: conv.messages.length, model, started: startedAt ? formatTime(startedAt) : '—' }))}`;
}

function printParsePreview(
  source: ConversationImportSource,
  absFile: string,
  result: ConversationImportParseResult,
): void {
  const cfg = SESSION_SOURCE_CONFIG[source];
  console.info(chalk.cyan(t('cliImportSessions.previewHeader', { label: cfg.label })));
  console.info(chalk.dim(t('cliImportSessions.previewFile', { absFile: absFile })));
  if (result.truncated) {
    console.info(chalk.yellow(t('cliImportSessions.truncatedWarning')));
  }
  if (result.warnings.length > 0) {
    console.info(chalk.yellow(t('cliImportSessions.warningsHeader')));
    for (const w of result.warnings) console.info(chalk.yellow(`    - ${w}`));
  }
  if (result.conversations.length === 0) {
    console.info(chalk.dim(t('cliImportSessions.noSessionsParsed')));
    console.info('');
    return;
  }
  console.info(chalk.cyan(t('cliImportSessions.sessionsCountLine', { length: result.conversations.length })));
  result.conversations.forEach((c, i) => console.info(describeConversation(i + 1, c)));
  console.info('');
}

/** 单条会话 → commit 请求体;无有效消息时返回 null(与 Web 端同样的过滤/截断口径) */
export function buildCommitPayload(
  conv: ParsedImportConversation,
  source: ConversationImportSource,
  fileName: string,
): ConversationImportCommitPayload | null {
  const messages = conv.messages
    .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt }));
  if (messages.length === 0) return null;
  const title = conv.title?.trim();
  // 不透传 conv.model:该列会直接进 LLM 网关(api chat.ts 的 conversation.model),
  // 外部工具的模型 id 未必在用户目录内,写入会让导入会话首次续聊报错。预览仍展示模型。
  return {
    source,
    fileName,
    title: title ? title.slice(0, 255) : undefined,
    createdAt: conv.sourceCreatedAt ?? conv.sourceUpdatedAt ?? undefined,
    messages,
  };
}

interface CommitOutcome {
  imported: number;
  failed: number;
  failures: Array<{ index: number; reason: string }>;
}

/** 逐会话串行落库:单条失败不中断其余,末尾由调用方汇总 */
async function commitSelected(
  source: ConversationImportSource,
  absFile: string,
  conversations: ParsedImportConversation[],
  indices: number[],
): Promise<CommitOutcome> {
  const outcome: CommitOutcome = { imported: 0, failed: 0, failures: [] };
  const fileName = path.basename(absFile);
  for (const index of indices) {
    const conv = conversations[index - 1];
    if (!conv) continue;
    const payload = buildCommitPayload(conv, source, fileName);
    if (!payload) {
      outcome.failed += 1;
      outcome.failures.push({ index, reason: t('cliImportSessions.noValidContent') });
      console.info(chalk.red(t('cliImportSessions.skipNoContent', { index: index })));
      continue;
    }
    try {
      const r = await commitConversationImport(payload);
      if (r.success) {
        outcome.imported += 1;
        console.info(
          chalk.green(t('cliImportSessions.importedLine', { index: index, detail: conv.title?.trim() || t('cliImportSessions.untitled') })) +
            chalk.dim(t('cliImportSessions.importedSuffix', { conversationId: r.data.conversationId, importedMessages: r.data.importedMessages })),
        );
      } else {
        outcome.failed += 1;
        outcome.failures.push({ index, reason: r.error });
        console.info(chalk.red(t('cliImportSessions.importFailed', { index: index, error: r.error })));
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      outcome.failed += 1;
      outcome.failures.push({ index, reason });
      console.info(chalk.red(t('cliImportSessions.importError', { index: index, reason: reason })));
    }
  }
  return outcome;
}

// =============================================================================
// 选项解析
// =============================================================================

/** `1,3-5` → [1,3,4,5](去重升序);非法输入返回 null */
export function parseOnlySpec(spec: string): number[] | null {
  const picked: number[] = [];
  for (const raw of spec.split(',')) {
    const token = raw.trim();
    if (!token) continue;
    const dash = token.indexOf('-');
    if (dash > 0) {
      const fromRaw = token.slice(0, dash).trim();
      const toRaw = token.slice(dash + 1).trim();
      if (!/^\d+$/.test(fromRaw) || !/^\d+$/.test(toRaw)) return null;
      const from = Number(fromRaw);
      const to = Number(toRaw);
      // 区间上限防呆:`1-999999` 属于误输入,序号总数远超此量级
      if (from < 1 || to < from || to - from > 1000) return null;
      for (let n = from; n <= to; n += 1) picked.push(n);
      continue;
    }
    if (!/^\d+$/.test(token)) return null;
    const n = Number(token);
    if (n < 1) return null;
    picked.push(n);
  }
  const unique = [...new Set(picked)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : null;
}

export interface CommitSelection {
  all: boolean;
  indices: number[];
}

/** 解析 --all / --only 的选择意图;返回 null 表示参数本身不合法 */
export function resolveSelection(
  opts: { all?: boolean; only?: string },
  total: number,
): CommitSelection | null {
  if (opts.all) return { all: true, indices: [] };
  if (!opts.only) return null;
  const parsed = parseOnlySpec(opts.only);
  if (!parsed) return null;
  const outOfRange = parsed.filter((n) => n > total);
  if (outOfRange.length > 0) {
    console.error(chalk.red(t('cliImportSessions.indexOutOfRange', { index: outOfRange.join(', '), total: total })));
    return { all: false, indices: parsed.filter((n) => n <= total) };
  }
  return { all: false, indices: parsed };
}

// =============================================================================
// 命令实现(与 commander 解耦,便于单测)
// =============================================================================

export async function runSessionsSources(): Promise<boolean> {
  console.info(chalk.cyan(t('cliImportSessions.supportedSources')));
  for (const source of SESSION_SOURCE_VALUES) {
    const cfg = SESSION_SOURCE_CONFIG[source];
    console.info(`  ${chalk.bold(source)} ${chalk.dim(`- ${cfg.label}:${cfg.description}`)}`);
    console.info(chalk.dim(t('cliImportSessions.sourceExtensions', { extensions: cfg.extensions.join(', ') })));
    console.info(chalk.dim(t('cliImportSessions.sourceDirs', { dirs: cfg.roots().join(', ') })));
  }
  console.info(chalk.dim(t('cliImportSessions.backendDoesParsing')));
  console.info('');
  return true;
}

export async function runSessionsDiscover(
  sourceArg: string | undefined,
  opts: { path?: string; limit?: string },
): Promise<boolean> {
  let targets: ConversationImportSource[] = SESSION_SOURCE_VALUES;
  if (sourceArg) {
    const parsed = toSessionSource(sourceArg);
    if (!parsed) return false;
    targets = [parsed];
  }
  const limitRaw = opts.limit ? Number.parseInt(opts.limit, 10) : DEFAULT_DISCOVER_LIMIT;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : DEFAULT_DISCOVER_LIMIT;

  let totalFound = 0;
  for (const source of targets) {
    const cfg = SESSION_SOURCE_CONFIG[source];
    const candidates = await discoverSessionCandidates(source, opts.path, limit);
    console.info(chalk.cyan(`\n${source} ${chalk.dim(`(${cfg.label})`)}`));
    if (candidates.length === 0) {
      const scanned = opts.path ? [path.resolve(expandTilde(opts.path))] : cfg.roots();
      console.info(chalk.dim(t('cliImportSessions.noneDiscovered', { scanned: scanned.join(', ') })));
      continue;
    }
    totalFound += candidates.length;
    candidates.forEach((c, i) => {
      console.info(`  ${String(i + 1).padStart(3)}. ${c.file} ${chalk.dim(formatTime(new Date(c.mtimeMs).toISOString()))}`);
    });
  }
  if (totalFound > 0) {
    console.info(chalk.dim(t('cliImportSessions.hintParse')));
  }
  console.info('');
  return true;
}

export async function runSessionsParse(
  sourceArg: string,
  fileArg?: string,
): Promise<boolean> {
  const source = toSessionSource(sourceArg);
  if (!source) return false;
  const abs = await resolveExportFile(source, fileArg);
  if (!abs) return false;
  const result = await uploadAndParse(source, abs);
  if (!result) return false;
  printParsePreview(source, abs, result);
  if (result.conversations.length > 0) {
    console.info(
      chalk.dim(t('cliImportSessions.hintCommit', { source: source, abs: abs })),
    );
  }
  return true;
}

export async function runSessionsCommit(
  sourceArg: string,
  fileArg: string | undefined,
  opts: { all?: boolean; only?: string },
): Promise<boolean> {
  const source = toSessionSource(sourceArg);
  if (!source) return false;
  if (!opts.all && !opts.only) {
    console.error(chalk.red(t('cliImportSessions.scopeRequired')));
    console.error(chalk.dim(t('cliImportSessions.exampleAll')));
    console.error(chalk.dim(t('cliImportSessions.exampleOnly')));
    console.error(chalk.dim(t('cliImportSessions.indexesFromPreview')));
    return false;
  }
  if (opts.only && !parseOnlySpec(opts.only)) {
    console.error(chalk.red(t('cliImportSessions.invalidOnly', { only: opts.only })));
    console.error(chalk.dim(t('cliImportSessions.onlyFormat')));
    return false;
  }

  const abs = await resolveExportFile(source, fileArg);
  if (!abs) return false;
  const result = await uploadAndParse(source, abs);
  if (!result) return false;
  printParsePreview(source, abs, result);

  const selection = resolveSelection(opts, result.conversations.length);
  if (!selection) return false;
  const indices = selection.all
    ? result.conversations.map((_, i) => i + 1)
    : selection.indices;
  if (indices.length === 0) {
    console.error(chalk.red(t('cliImportSessions.nothingToImport')));
    return false;
  }

  console.info(chalk.cyan(t('cliImportSessions.startImport', { length: indices.length })));
  const outcome = await commitSelected(source, abs, result.conversations, indices);
  console.info(chalk.green(t('cliImportSessions.importDone')));
  console.info(t('cliImportSessions.importSucceeded', { imported: chalk.bold(outcome.imported) }));
  console.info(t('cliImportSessions.importFailedCount', { failed: chalk.bold(outcome.failed) }));
  if (outcome.failures.length > 0) {
    console.info(chalk.yellow(t('cliImportSessions.failureDetails')));
    for (const f of outcome.failures) console.info(`    #${f.index}: ${f.reason}`);
  }
  console.info('');
  return outcome.failed === 0;
}

export async function runSessionsHistory(): Promise<boolean> {
  const res = await getConversationImportHistory();
  if (!res.success) {
    console.error(chalk.red(res.error));
    return false;
  }
  const list: ConversationImportHistoryItem[] = res.data.list;
  if (list.length === 0) {
    console.info(chalk.dim(t('cliImportSessions.noImportHistory')));
    console.info('');
    return true;
  }
  // 服务端固定 limit 50 且 total=rows.length,报"共 N 条"会等于已显示条数而误导为全量
  console.info(
    chalk.cyan(t('cliImportSessions.importHistoryHeader', { length: list.length, suffix: list.length >= 50 ? t('cliImportSessions.historyCappedSuffix') : '' })),
  );
  for (const h of list) {
    const statusColor =
      h.status === 'success' ? chalk.green : h.status === 'partial' ? chalk.yellow : chalk.red;
    console.info(
      `  ${chalk.bold(h.source)} ${statusColor(`[${h.status}]`)} ${chalk.dim(formatTime(h.importedAt))}`,
    );
    console.info(chalk.dim(`    ${h.fileName ?? '—'}`));
    const error = h.errorMessage ? ` · ${h.errorMessage}` : '';
    console.info(
      chalk.dim(t('cliImportSessions.importHistoryRow', { parsedCount: h.parsedCount, importedCount: h.importedCount, failedCount: h.failedCount, error: error })),
    );
  }
  console.info('');
  return true;
}

// =============================================================================
// 注册(挂到 ihui import 命令族下,与供应商配置导入并列)
// =============================================================================

export function attachSessionImportCommands(importCmd: Command): void {
  const sessions = importCmd
    .command('sessions')
    .description(t('cliImportSessions.cmdDesc'));

  sessions
    .command('sources')
    .description(t('cliImportSessions.sourcesDesc'))
    .action(async () => {
      await runSessionsSources();
    });

  sessions
    .command('discover [source]')
    .description(t('cliImportSessions.discoverDesc'))
    .option('--path <dir>', t('cliImportSessions.scanDirDesc'))
    .option('--limit <n>', t('cliImportSessions.limitDesc', { DEFAULT_DISCOVER_LIMIT: DEFAULT_DISCOVER_LIMIT }))
    .action(async (source: string | undefined, opts: { path?: string; limit?: string }) => {
      if (!(await runSessionsDiscover(source, opts))) process.exitCode = 1;
    });

  sessions
    .command('parse <source> [file]')
    .description(t('cliImportSessions.parseDesc'))
    .action(async (source: string, file: string | undefined) => {
      if (!(await runSessionsParse(source, file))) process.exitCode = 1;
    });

  sessions
    .command('commit <source> [file]')
    .description(t('cliImportSessions.commitDesc'))
    .option('-a, --all', t('cliImportSessions.allDesc'))
    .option('-o, --only <indices>', t('cliImportSessions.onlyDesc'))
    .action(async (source: string, file: string | undefined, opts: { all?: boolean; only?: string }) => {
      if (!(await runSessionsCommit(source, file, opts))) process.exitCode = 1;
    });

  sessions
    .command('history')
    .description(t('cliImportSessions.historyDesc'))
    .action(async () => {
      if (!(await runSessionsHistory())) process.exitCode = 1;
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
