/**
 * Capabilities CLI — 迁移自旧架构 server/app/cli/capabilities.py
 * 统一能力查询与调用：local 走已配置后端 (全局 --api-url)，remote 走 --server 指定的远程服务器。
 *
 * 用法:
 *   ihui capabilities local list [--category <c>] [--keyword <k>] [--json]
 *   ihui capabilities local categories [--json]
 *   ihui capabilities local invoke <name> <input> [--options <json>] [--json]
 *   ihui capabilities local auto-match <query> [--json]
 *   ihui capabilities remote list --server <url> [--category <c>] [--keyword <k>] [--json]
 *   ihui capabilities remote categories --server <url> [--json]
 *   ihui capabilities remote invoke <name> <input> --server <url> [--options <json>] [--json]
 *   ihui capabilities remote auto-match <query> --server <url> [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';

const API_PREFIX = '/api/v1/ai/capabilities';
const DEFAULT_REMOTE_SERVER = 'http://localhost:8888';
const DEFAULT_TIMEOUT_MS = 30_000;
const INVOKE_TIMEOUT_MS = 60_000;

interface CapabilityItem {
  id: string;
  name: string;
  type?: string;
  category?: string;
  platform?: string;
  description?: string;
  tags?: string[];
}

interface CategoryItem {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  items?: CapabilityItem[];
}

interface InvokeResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

interface AutoMatchResult {
  capability_id: string;
  capability_name: string;
  capability_type?: string;
  reason: string;
  confidence: number;
}

interface ListFilter {
  category?: string;
  keyword?: string;
}

/** 远程 HTTP 调用（Node 20+ 内置 fetch）。 */
async function apiRequest(
  baseUrl: string,
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: unknown;
    timeoutMs?: number;
    apiKey?: string;
  } = {},
): Promise<unknown> {
  const url = `${baseUrl.replace(/\/$/, '')}${API_PREFIX}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.apiKey) {
      headers.Authorization = `Bearer ${options.apiKey}`;
    }
    const resp = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

function printJson(data: unknown): void {
  console.info(JSON.stringify(data, null, 2));
}

function parseOptions(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error('options 必须是 JSON 对象');
  } catch (err) {
    throw new Error(`--options 不是有效的 JSON: ${(err as Error).message}`);
  }
}

function extractData(resp: unknown): unknown {
  if (resp && typeof resp === 'object' && 'data' in resp) {
    return (resp as { data: unknown }).data;
  }
  return resp;
}

// ==================== list ====================

async function listCapabilities(
  baseUrl: string,
  filter: ListFilter,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const params = new URLSearchParams();
  if (filter.category) params.set('category', filter.category);
  if (filter.keyword) params.set('keyword', filter.keyword);
  const qs = params.toString();
  const resp = (await apiRequest(baseUrl, `/list${qs ? `?${qs}` : ''}`, { apiKey })) as {
    data?: { categories?: CategoryItem[]; total?: number };
  };
  const data = resp?.data ?? {};
  const categories = data.categories ?? [];
  const total = data.total ?? 0;

  if (asJson) {
    printJson(resp);
    return;
  }
  for (const cat of categories) {
    console.info(`\n=== ${chalk.bold(cat.name)} (${cat.id}) ===`);
    for (const item of cat.items ?? []) {
      const desc = (item.description ?? '').slice(0, 60);
      console.info(`  [${chalk.cyan(item.id)}] ${item.name} - ${chalk.dim(desc)}`);
    }
  }
  console.info(chalk.dim(`\n共 ${total} 个能力`));
}

// ==================== categories ====================

async function listCategories(
  baseUrl: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const resp = await apiRequest(baseUrl, '/categories', { apiKey });
  const data = (extractData(resp) as CategoryItem[]) ?? [];

  if (asJson) {
    printJson(resp);
    return;
  }
  if (data.length === 0) {
    console.info(chalk.dim('(无数据)'));
    return;
  }
  for (const cat of data) {
    console.info(`[${chalk.cyan(cat.id)}] ${chalk.bold(cat.name)} - ${chalk.dim(cat.description ?? '')}`);
  }
}

// ==================== invoke ====================

async function invokeCapability(
  baseUrl: string,
  name: string,
  input: string,
  options: Record<string, unknown>,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const resp = (await apiRequest(baseUrl, '/invoke', {
    method: 'POST',
    body: { capability_id: name, input, options },
    timeoutMs: INVOKE_TIMEOUT_MS,
    apiKey,
  })) as { data?: InvokeResult };

  if (asJson) {
    printJson(resp);
    return;
  }
  const result = resp?.data;
  if (result?.success) {
    console.info(chalk.green('✓ 调用成功'));
    console.info(`结果: ${result.result ?? '(无输出)'}`);
  } else {
    console.error(chalk.red(`✗ 调用失败: ${result?.error ?? '未知错误'}`));
    process.exit(1);
  }
}

// ==================== auto-match ====================

async function autoMatch(
  baseUrl: string,
  query: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const resp = (await apiRequest(baseUrl, '/auto-match', {
    method: 'POST',
    body: { input: query },
    apiKey,
  })) as { data?: AutoMatchResult };

  if (asJson) {
    printJson(resp);
    return;
  }
  const result = resp?.data;
  if (!result) {
    console.info(chalk.yellow('未匹配到能力'));
    return;
  }
  console.info(`匹配结果: ${chalk.bold(result.capability_name)} (${result.capability_id})`);
  if (result.capability_type) {
    console.info(`类型: ${result.capability_type}`);
  }
  console.info(`原因: ${result.reason}`);
  console.info(`置信度: ${result.confidence}`);
}

// ==================== 命令注册 ====================

interface RemoteOptions {
  server: string;
  category?: string;
  keyword?: string;
  json?: boolean;
  options?: string;
}

interface LocalOptions {
  category?: string;
  keyword?: string;
  json?: boolean;
  options?: string;
}

/**
 * 在根 program 上注册 `capabilities` 命令组。
 * local 子命令使用全局 `--api-url` / `--api-key`；remote 子命令使用各自的 `--server`。
 */
export function registerCapabilitiesCommand(program: Command): void {
  const capsCmd = program
    .command('capabilities')
    .description('统一能力查询与调用 (local / remote)');

  // ---------- local ----------
  const localCmd = capsCmd.command('local').description('本地后端能力 (使用全局 --api-url)');

  localCmd
    .command('list')
    .description('列出本地能力')
    .option('--category <category>', '按分类过滤')
    .option('--keyword <keyword>', '关键词搜索')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: LocalOptions) => {
      const { apiUrl, apiKey } = program.opts();
      await listCapabilities(apiUrl, opts, Boolean(opts.json), apiKey);
    });

  localCmd
    .command('categories')
    .description('列出本地能力分类')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: LocalOptions) => {
      const { apiUrl, apiKey } = program.opts();
      await listCategories(apiUrl, Boolean(opts.json), apiKey);
    });

  localCmd
    .command('invoke <name> <input>')
    .description('调用本地能力')
    .option('--options <json>', '额外选项 (JSON 格式)')
    .option('--json', '以 JSON 格式输出')
    .action(async (name: string, input: string, opts: LocalOptions) => {
      const { apiUrl, apiKey } = program.opts();
      const extra = parseOptions(opts.options);
      await invokeCapability(apiUrl, name, input, extra, Boolean(opts.json), apiKey);
    });

  localCmd
    .command('auto-match <query>')
    .description('AI 自动匹配本地能力')
    .option('--json', '以 JSON 格式输出')
    .action(async (query: string, opts: LocalOptions) => {
      const { apiUrl, apiKey } = program.opts();
      await autoMatch(apiUrl, query, Boolean(opts.json), apiKey);
    });

  // ---------- remote ----------
  const remoteCmd = capsCmd
    .command('remote')
    .description('远程服务器能力 (使用 --server 指定地址)');

  remoteCmd
    .command('list')
    .description('列出远程能力')
    .requiredOption('--server <url>', '远程服务器地址', DEFAULT_REMOTE_SERVER)
    .option('--category <category>', '按分类过滤')
    .option('--keyword <keyword>', '关键词搜索')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: RemoteOptions) => {
      await listCapabilities(opts.server, opts, Boolean(opts.json));
    });

  remoteCmd
    .command('categories')
    .description('列出远程能力分类')
    .requiredOption('--server <url>', '远程服务器地址', DEFAULT_REMOTE_SERVER)
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: RemoteOptions) => {
      await listCategories(opts.server, Boolean(opts.json));
    });

  remoteCmd
    .command('invoke <name> <input>')
    .description('调用远程能力')
    .requiredOption('--server <url>', '远程服务器地址', DEFAULT_REMOTE_SERVER)
    .option('--options <json>', '额外选项 (JSON 格式)')
    .option('--json', '以 JSON 格式输出')
    .action(async (name: string, input: string, opts: RemoteOptions) => {
      const extra = parseOptions(opts.options);
      await invokeCapability(opts.server, name, input, extra, Boolean(opts.json));
    });

  remoteCmd
    .command('auto-match <query>')
    .description('AI 自动匹配远程能力')
    .requiredOption('--server <url>', '远程服务器地址', DEFAULT_REMOTE_SERVER)
    .option('--json', '以 JSON 格式输出')
    .action(async (query: string, opts: RemoteOptions) => {
      await autoMatch(opts.server, query, Boolean(opts.json));
    });
}
