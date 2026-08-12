/**
 * Spec CLI — 对标 Web 端 /spec 4 页功能的远程 spec 文档管理。
 *
 * 调远程 API(api 8802)的 /api/spec/* 端点,所有端点需 JWT Bearer token。
 * token 自动续期由 token-manager 的 ensureFreshAccessToken 处理。
 *
 * 用法:
 *   ihui spec generate --workspace <path> [--scope-type <t>] [--scope-path <p>] [--include-deps] [--json]
 *   ihui spec templates [--json]
 *   ihui spec history --workspace <path> [--scope-type <t>] [--scope-path <p>] [--json]
 *   ihui spec load --workspace <path> [--scope-type <t>] [--scope-path <p>] [--version <v>] [--json]
 *   ihui spec diff --workspace <path> [--scope-type <t>] [--scope-path <p>] [--json]
 *   ihui spec variables --workspace <path> [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

import { createApiRequest, extractData, handleError, printJson, resolveApiKeyAsync, resolveBaseUrl } from './http-utils.js';

const API_PREFIX = '/api/spec';
const DEFAULT_TIMEOUT_MS = 30_000;
const apiRequest = createApiRequest(API_PREFIX, DEFAULT_TIMEOUT_MS);
const GENERATE_TIMEOUT_MS = 60_000;

// ==================== 类型定义 ====================

type ScopeType = 'file' | 'dir' | 'workspace';

interface SpecScope {
  type: ScopeType;
  path?: string;
}

interface SpecTemplate {
  id: string;
  name: string;
  description?: string;
  sections?: string[];
}

interface SpecHistoryEntry {
  timestamp: string;
  filePath?: string;
  summary?: string;
}

/** generate 响应 data(兼容 spec / markdown 两种字段名) */
interface SpecGenerateData {
  spec?: string;
  markdown?: string;
  sections?: Array<{ title: string; content: string; level: number }>;
  stats?: { filesScanned?: number; durationMs?: number };
  durationMs?: number;
}

/** load 响应 data(兼容 spec / markdown 两种字段名) */
interface SpecLoadData {
  spec?: string;
  markdown?: string;
  filePath?: string;
}

/** diff 响应 data */
interface SpecDiffData {
  diff?: string;
  oldSpec?: string;
  newSpec?: string;
  addedLines?: number;
  removedLines?: number;
  changedFiles?: string[];
}

// ==================== 公共工具(复用 capabilities.ts 模式) ====================

/** 校验 scope-type 参数,undefined 回退 'workspace'。 */
function parseScopeType(raw: unknown): ScopeType {
  if (raw === 'file' || raw === 'dir' || raw === 'workspace') return raw;
  if (raw === undefined) return 'workspace';
  throw new Error(`--scope-type 必须是 file|dir|workspace,收到: ${String(raw)}`);
}

function buildScope(scopeType: ScopeType, scopePath?: string): SpecScope {
  const scope: SpecScope = { type: scopeType };
  if (scopePath) scope.path = scopePath;
  return scope;
}

/** 从 generate/load 响应中提取 markdown 文本(兼容 spec / markdown 两种字段名)。 */
function extractMarkdown(data: { spec?: string; markdown?: string } | undefined): string {
  if (!data) return '';
  return data.spec ?? data.markdown ?? '';
}

/** 时间戳(文件名安全):YYYYMMDD-HHMMSS */
function fileTimestamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** spec 本地存档目录:~/.ihui/specs/ */
function getSpecsDir(): string {
  return join(homedir(), '.ihui', 'specs');
}

/** 解析全局 program opts 中的 apiUrl / apiKey,确保 access token 有效。未登录返回 null。 */
async function resolveAuth(program: Command): Promise<{ baseUrl: string; apiKey: string } | null> {
  const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as { apiUrl?: string; apiKey?: string };
  const baseUrl = resolveBaseUrl(cliApiUrl);
  const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
  if (!apiKey) {
    console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
    process.exitCode = 1;
    return null;
  }
  return { baseUrl, apiKey };
}

// ==================== generate ====================

interface GenerateOptions {
  workspace: string;
  scopeType?: string;
  scopePath?: string;
  includeDeps?: boolean;
  languages?: string;
  json?: boolean;
}

async function generateSpec(
  baseUrl: string,
  opts: GenerateOptions,
  asJson: boolean,
  apiKey: string,
): Promise<void> {
  const scopeType = parseScopeType(opts.scopeType);
  const scope = buildScope(scopeType, opts.scopePath);
  const body: Record<string, unknown> = {
    scope,
    workspacePath: opts.workspace,
  };
  if (opts.includeDeps) body.includeDependencies = true;
  if (opts.languages) {
    const langs = opts.languages.split(',').map((l) => l.trim()).filter(Boolean);
    if (langs.length > 0) body.languages = langs;
  }

  const resp = await apiRequest(baseUrl, '/generate', {
    method: 'POST',
    body,
    timeoutMs: GENERATE_TIMEOUT_MS,
    apiKey,
  });
  const data = extractData(resp) as SpecGenerateData | undefined;

  if (asJson) {
    printJson(resp);
    return;
  }

  const markdown = extractMarkdown(data);
  if (!markdown) {
    console.error(chalk.red('✗ spec 生成返回空内容'));
    process.exitCode = 1;
    return;
  }

  // 完整内容写入 ~/.ihui/specs/<timestamp>.md
  const specsDir = getSpecsDir();
  const fileName = `${fileTimestamp()}.md`;
  const filePath = join(specsDir, fileName);
  const fileDir = dirname(filePath);
  if (!existsSync(fileDir)) mkdirSync(fileDir, { recursive: true });
  writeFileSync(filePath, markdown, 'utf-8');

  console.info(chalk.green('✓ spec 已生成'));
  console.info(chalk.dim(`  已保存: ${filePath}`));
  if (data?.durationMs) {
    console.info(chalk.dim(`  耗时: ${data.durationMs}ms`));
  }
  const preview = markdown.slice(0, 500);
  console.info('\n' + chalk.cyan('--- 预览(前 500 字符)---'));
  console.info(preview);
  if (markdown.length > 500) {
    console.info(chalk.dim(`... (共 ${markdown.length} 字符,完整内容见文件)`));
  }
}

// ==================== templates ====================

interface TemplatesOptions {
  json?: boolean;
}

async function listTemplates(
  baseUrl: string,
  asJson: boolean,
  apiKey: string,
): Promise<void> {
  const resp = await apiRequest(baseUrl, '/templates', { apiKey });
  const data = extractData(resp) as { templates?: SpecTemplate[] } | undefined;
  const templates = data?.templates ?? [];

  if (asJson) {
    printJson(resp);
    return;
  }

  if (templates.length === 0) {
    console.info(chalk.dim('(暂无模板)'));
    return;
  }

  console.info(chalk.cyan('\nSpec 模板:'));
  for (const t of templates) {
    const desc = (t.description ?? '').slice(0, 60);
    console.info(`  [${chalk.cyan(t.id)}] ${chalk.bold(t.name)} - ${chalk.dim(desc)}`);
  }
  console.info(chalk.dim(`\n共 ${templates.length} 个模板`));
}

// ==================== history ====================

interface HistoryOptions {
  workspace: string;
  scopeType?: string;
  scopePath?: string;
  json?: boolean;
}

async function listHistory(
  baseUrl: string,
  opts: HistoryOptions,
  asJson: boolean,
  apiKey: string,
): Promise<void> {
  const scopeType = parseScopeType(opts.scopeType);
  const params = new URLSearchParams();
  params.set('workspacePath', opts.workspace);
  params.set('scopeType', scopeType);
  if (opts.scopePath) params.set('scopePath', opts.scopePath);

  const resp = await apiRequest(baseUrl, `/history?${params.toString()}`, { apiKey });
  // 兼容 history / versions 两种字段名(任务契约写 versions,实际服务返回 history)
  const data = extractData(resp) as { history?: SpecHistoryEntry[]; versions?: SpecHistoryEntry[] } | undefined;
  const entries = data?.history ?? data?.versions ?? [];

  if (asJson) {
    printJson(resp);
    return;
  }

  if (entries.length === 0) {
    console.info(chalk.dim('(暂无历史版本)'));
    return;
  }

  console.info(chalk.cyan('\nSpec 历史版本:'));
  for (const e of entries) {
    const summary = (e.summary ?? '').slice(0, 50);
    console.info(`  [${chalk.cyan(e.timestamp)}] ${summary} ${chalk.dim(e.filePath ?? '')}`);
  }
  console.info(chalk.dim(`\n共 ${entries.length} 个版本`));
}

// ==================== load ====================

interface LoadOptions {
  workspace: string;
  scopeType?: string;
  scopePath?: string;
  version?: string;
  json?: boolean;
}

async function loadSpec(
  baseUrl: string,
  opts: LoadOptions,
  asJson: boolean,
  apiKey: string,
): Promise<void> {
  const scopeType = parseScopeType(opts.scopeType);
  const params = new URLSearchParams();
  params.set('workspacePath', opts.workspace);
  params.set('scopeType', scopeType);
  if (opts.scopePath) params.set('scopePath', opts.scopePath);
  params.set('version', opts.version ?? 'latest');

  const resp = await apiRequest(baseUrl, `/load?${params.toString()}`, { apiKey });
  const data = extractData(resp) as SpecLoadData | undefined;

  if (asJson) {
    printJson(resp);
    return;
  }

  const markdown = extractMarkdown(data);
  if (!markdown) {
    console.error(chalk.red('✗ spec 加载返回空内容'));
    process.exitCode = 1;
    return;
  }
  console.info(markdown);
}

// ==================== diff ====================

interface DiffOptions {
  workspace: string;
  scopeType?: string;
  scopePath?: string;
  json?: boolean;
}

async function diffSpec(
  baseUrl: string,
  opts: DiffOptions,
  asJson: boolean,
  apiKey: string,
): Promise<void> {
  const scopeType = parseScopeType(opts.scopeType);
  const scope = buildScope(scopeType, opts.scopePath);
  const resp = await apiRequest(baseUrl, '/diff', {
    method: 'POST',
    body: { scope, workspacePath: opts.workspace },
    timeoutMs: GENERATE_TIMEOUT_MS,
    apiKey,
  });
  const data = extractData(resp) as SpecDiffData | undefined;

  if (asJson) {
    printJson(resp);
    return;
  }

  const diff = data?.diff ?? '';
  if (!diff) {
    console.info(chalk.dim('(无差异)'));
    return;
  }
  console.info(diff);
  if (data) {
    console.info(chalk.dim(`\n+${data.addedLines ?? 0} -${data.removedLines ?? 0}`));
  }
}

// ==================== variables ====================

interface VariablesOptions {
  workspace: string;
  json?: boolean;
}

async function listVariables(
  baseUrl: string,
  opts: VariablesOptions,
  asJson: boolean,
  apiKey: string,
): Promise<void> {
  const params = new URLSearchParams();
  params.set('workspacePath', opts.workspace);

  const resp = await apiRequest(baseUrl, `/variables?${params.toString()}`, { apiKey });
  const data = extractData(resp) as
    | { variables?: Record<string, string> | Array<{ name: string; value: string }> }
    | undefined;

  if (asJson) {
    printJson(resp);
    return;
  }

  const vars = data?.variables;
  if (!vars) {
    console.info(chalk.dim('(暂无模板变量)'));
    return;
  }

  console.info(chalk.cyan('\n模板变量:'));
  if (Array.isArray(vars)) {
    for (const v of vars) {
      console.info(`  [${chalk.cyan(v.name)}] ${v.value}`);
    }
    console.info(chalk.dim(`\n共 ${vars.length} 个变量`));
  } else {
    const entries = Object.entries(vars);
    for (const [name, value] of entries) {
      console.info(`  [${chalk.cyan(name)}] ${value}`);
    }
    console.info(chalk.dim(`\n共 ${entries.length} 个变量`));
  }
}

// ==================== 命令注册 ====================

/**
 * 在根 program 上注册 `spec` 命令组。
 * 子命令使用全局 `--api-url` / `--api-key` 或 settings.json,token 自动续期。
 */
export function registerSpecCommand(program: Command): void {
  const specCmd = program
    .command('spec')
    .description('Spec 文档管理 (对标 Web 端 /spec 4 页功能)');

  specCmd
    .command('generate')
    .description('生成 spec 文档(调 LLM 扫描工作区)')
    .requiredOption('--workspace <path>', '工作区路径')
    .option('--scope-type <type>', '范围类型: file|dir|workspace (默认 workspace)')
    .option('--scope-path <path>', '范围路径(file/dir 时需要)')
    .option('--include-deps', '是否包含依赖分析')
    .option('--languages <langs>', '语言过滤(逗号分隔,如 ts,py)')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: GenerateOptions) => {
      try {
        const auth = await resolveAuth(program);
        if (!auth) return;
        await generateSpec(auth.baseUrl, opts, Boolean(opts.json), auth.apiKey);
      } catch (err) {
        handleError('spec generate', err);
      }
    });

  specCmd
    .command('templates')
    .description('列出预置 spec 模板')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: TemplatesOptions) => {
      try {
        const auth = await resolveAuth(program);
        if (!auth) return;
        await listTemplates(auth.baseUrl, Boolean(opts.json), auth.apiKey);
      } catch (err) {
        handleError('spec templates', err);
      }
    });

  specCmd
    .command('history')
    .description('查看 spec 历史版本')
    .requiredOption('--workspace <path>', '工作区路径')
    .option('--scope-type <type>', '范围类型: file|dir|workspace (默认 workspace)')
    .option('--scope-path <path>', '范围路径')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: HistoryOptions) => {
      try {
        const auth = await resolveAuth(program);
        if (!auth) return;
        await listHistory(auth.baseUrl, opts, Boolean(opts.json), auth.apiKey);
      } catch (err) {
        handleError('spec history', err);
      }
    });

  specCmd
    .command('load')
    .description('加载已持久化的 spec')
    .requiredOption('--workspace <path>', '工作区路径')
    .option('--scope-type <type>', '范围类型: file|dir|workspace (默认 workspace)')
    .option('--scope-path <path>', '范围路径')
    .option('--version <version>', '版本号(默认 latest)')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: LoadOptions) => {
      try {
        const auth = await resolveAuth(program);
        if (!auth) return;
        await loadSpec(auth.baseUrl, opts, Boolean(opts.json), auth.apiKey);
      } catch (err) {
        handleError('spec load', err);
      }
    });

  specCmd
    .command('diff')
    .description('对比当前 spec 与上次持久化版本')
    .requiredOption('--workspace <path>', '工作区路径')
    .option('--scope-type <type>', '范围类型: file|dir|workspace (默认 workspace)')
    .option('--scope-path <path>', '范围路径')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: DiffOptions) => {
      try {
        const auth = await resolveAuth(program);
        if (!auth) return;
        await diffSpec(auth.baseUrl, opts, Boolean(opts.json), auth.apiKey);
      } catch (err) {
        handleError('spec diff', err);
      }
    });

  specCmd
    .command('variables')
    .description('列出可用模板变量 + 当前值')
    .requiredOption('--workspace <path>', '工作区路径')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: VariablesOptions) => {
      try {
        const auth = await resolveAuth(program);
        if (!auth) return;
        await listVariables(auth.baseUrl, opts, Boolean(opts.json), auth.apiKey);
      } catch (err) {
        handleError('spec variables', err);
      }
    });
}
