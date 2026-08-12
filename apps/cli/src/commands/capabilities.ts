/**
 * Capabilities CLI — 统一能力查询与调用。
 * local 走全局 --api-url(或 settings.json),remote 走 --server 指定的远程服务器。
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
import { createApiRequest, extractData, handleError, printJson, resolveApiKeyAsync, resolveBaseUrl } from './http-utils.js';

const API_PREFIX = '/api/v1/ai/capabilities';
const DEFAULT_REMOTE_SERVER = 'http://localhost:8888';
const DEFAULT_TIMEOUT_MS = 30_000;
const INVOKE_TIMEOUT_MS = 60_000;

/** API 返回的能力项(扁平结构,GET /list 返回) */
interface CapabilityItem {
  id: string;
  name: string;
  type?: string;
  category?: string;
  platform?: string;
  description?: string;
  tags?: string[];
  enabled?: boolean;
  qualityScore?: number;
}

/** invoke 返回(POST /invoke) */
interface InvokeResult {
  success: boolean;
  capability_id?: string;
  result?: string;
  model?: string;
  stub?: boolean;
  error?: string;
}

/** auto-match 返回(POST /auto-match) */
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

// === 解析工具(复用 http-utils.ts 模式) ===

const apiRequest = createApiRequest(API_PREFIX, DEFAULT_TIMEOUT_MS);

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
    code?: number;
    data?: { list?: CapabilityItem[]; categories?: { id: string; name: string; items?: CapabilityItem[] }[]; total?: number };
  };
  const data = resp?.data ?? {};
  const flatList = data.list ?? [];
  const grouped = data.categories;

  if (asJson) {
    printJson(resp);
    return;
  }

  if (grouped && Array.isArray(grouped) && grouped.length > 0) {
    for (const cat of grouped) {
      console.info(`\n=== ${chalk.bold(cat.name)} (${cat.id}) ===`);
      for (const item of cat.items ?? []) {
        const desc = (item.description ?? '').slice(0, 60);
        console.info(`  [${chalk.cyan(item.id)}] ${item.name} - ${chalk.dim(desc)}`);
      }
    }
    console.info(chalk.dim(`\n共 ${grouped.length} 个分类`));
    return;
  }

  if (flatList.length === 0) {
    console.info(chalk.dim('(暂无能力,请先在管理后台启用能力)'));
    return;
  }

  const byCat = new Map<string, CapabilityItem[]>();
  for (const item of flatList) {
    const cat = item.category || '(未分类)';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(item);
  }
  console.info('');
  for (const [cat, items] of byCat) {
    console.info(`=== ${chalk.bold(cat)} (${items.length} 个) ===`);
    for (const item of items) {
      const desc = (item.description ?? '').slice(0, 60);
      console.info(`  [${chalk.cyan(item.id)}] ${item.name} - ${chalk.dim(desc)}`);
    }
  }
  console.info(chalk.dim(`\n共 ${flatList.length} 个能力`));
}

// ==================== categories ====================

async function listCategories(
  baseUrl: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const resp = await apiRequest(baseUrl, '/categories', { apiKey });
  const data = (extractData(resp) as { categories?: unknown; templates?: unknown[] }) ?? {};

  if (asJson) {
    printJson(resp);
    return;
  }

  const cats = data.categories;
  if (Array.isArray(cats) && cats.length > 0) {
    console.info(chalk.cyan('\n能力分类:'));
    if (typeof cats[0] === 'string') {
      for (const c of cats as string[]) {
        console.info(`  - ${chalk.bold(c)}`);
      }
    } else {
      for (const c of cats as { id?: string; name?: string; description?: string }[]) {
        console.info(`  [${chalk.cyan(c.id ?? '?')}] ${chalk.bold(c.name ?? '?')} - ${chalk.dim(c.description ?? '')}`);
      }
    }
  } else {
    console.info(chalk.dim('(无分类数据)'));
  }
  if (Array.isArray(data.templates) && data.templates.length > 0) {
    console.info(chalk.cyan(`\n模板 (${data.templates.length} 个):`));
    for (const t of data.templates.slice(0, 10)) {
      const name = (t as { name?: string }).name ?? '?';
      console.info(`  - ${name}`);
    }
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
  })) as { code?: number; data?: InvokeResult };

  if (asJson) {
    printJson(resp);
    return;
  }
  const result = resp?.data;
  if (result?.success) {
    console.info(chalk.green('✓ 调用成功'));
    if (result.model) console.info(chalk.dim(`  模型: ${result.model}${result.stub ? ' (stub)' : ''}`));
    console.info(`结果: ${result.result ?? '(无输出)'}`);
  } else {
    console.error(chalk.red(`✗ 调用失败: ${result?.error ?? '未知错误'}`));
    process.exitCode = 1;
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
  })) as { code?: number; data?: AutoMatchResult };

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
  const pct = Math.round(result.confidence * 100);
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
  console.info(`置信度: ${bar} ${pct}%`);
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
 * local 子命令使用全局 `--api-url` / `--api-key` 或 settings.json;remote 子命令使用各自的 `--server`。
 */
export function registerCapabilitiesCommand(program: Command): void {
  const capsCmd = program
    .command('capabilities')
    .description('统一能力查询与调用 (local / remote)');

  // ---------- local ----------
  const localCmd = capsCmd.command('local').description('本地后端能力 (使用全局 --api-url 或 settings.json)');

  localCmd
    .command('list')
    .description('列出本地能力')
    .option('--category <category>', '按分类过滤')
    .option('--keyword <keyword>', '关键词搜索')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: LocalOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as { apiUrl?: string; apiKey?: string };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await listCapabilities(baseUrl, opts, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('capabilities local list', err);
      }
    });

  localCmd
    .command('categories')
    .description('列出本地能力分类')
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: LocalOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as { apiUrl?: string; apiKey?: string };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await listCategories(baseUrl, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('capabilities local categories', err);
      }
    });

  localCmd
    .command('invoke <name> <input>')
    .description('调用本地能力')
    .option('--options <json>', '额外选项 (JSON 格式)')
    .option('--json', '以 JSON 格式输出')
    .action(async (name: string, input: string, opts: LocalOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as { apiUrl?: string; apiKey?: string };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        const extra = parseOptions(opts.options);
        await invokeCapability(baseUrl, name, input, extra, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('capabilities local invoke', err);
      }
    });

  localCmd
    .command('auto-match <query>')
    .description('AI 自动匹配本地能力')
    .option('--json', '以 JSON 格式输出')
    .action(async (query: string, opts: LocalOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as { apiUrl?: string; apiKey?: string };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await autoMatch(baseUrl, query, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('capabilities local auto-match', err);
      }
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
      try {
        await listCapabilities(opts.server, opts, Boolean(opts.json));
      } catch (err) {
        handleError('capabilities remote list', err);
      }
    });

  remoteCmd
    .command('categories')
    .description('列出远程能力分类')
    .requiredOption('--server <url>', '远程服务器地址', DEFAULT_REMOTE_SERVER)
    .option('--json', '以 JSON 格式输出')
    .action(async (opts: RemoteOptions) => {
      try {
        await listCategories(opts.server, Boolean(opts.json));
      } catch (err) {
        handleError('capabilities remote categories', err);
      }
    });

  remoteCmd
    .command('invoke <name> <input>')
    .description('调用远程能力')
    .requiredOption('--server <url>', '远程服务器地址', DEFAULT_REMOTE_SERVER)
    .option('--options <json>', '额外选项 (JSON 格式)')
    .option('--json', '以 JSON 格式输出')
    .action(async (name: string, input: string, opts: RemoteOptions) => {
      try {
        const extra = parseOptions(opts.options);
        await invokeCapability(opts.server, name, input, extra, Boolean(opts.json));
      } catch (err) {
        handleError('capabilities remote invoke', err);
      }
    });

  remoteCmd
    .command('auto-match <query>')
    .description('AI 自动匹配远程能力')
    .requiredOption('--server <url>', '远程服务器地址', DEFAULT_REMOTE_SERVER)
    .option('--json', '以 JSON 格式输出')
    .action(async (query: string, opts: RemoteOptions) => {
      try {
        await autoMatch(opts.server, query, Boolean(opts.json));
      } catch (err) {
        handleError('capabilities remote auto-match', err);
      }
    });
}
