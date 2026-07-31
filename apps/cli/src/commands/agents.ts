/**
 * Agents CLI — 智能体市场管理命令,对标 Web 端 /agents 5 页功能(市场列表/我的/创建/详情/统计)。
 *
 * 对接后端 apps/api/src/routes/agents.ts(挂载于 /api,JWT Bearer 鉴权):
 *  - GET    /api/agents/list?page=&pageSize=&status=&categoryId=&keyword= → { list, total }
 *  - GET    /api/agents/:agentId                                         → Agent
 *  - POST   /api/agents/create  body: { name, description?, categoryId?, status?, price?, isFree? } → Agent
 *  - GET    /api/manage?page=&pageSize=&status=&categoryId=&keyword=     → { list, total } (当前用户)
 *  - GET    /api/agents/stats                                            → { totalAgents, totalCalls, totalUsers, avgRating, publishedCount, pendingCount }
 *
 * 端点契约说明:Web 端 my/page.tsx 调 /api/agents/my、stats/page.tsx 调 /api/agents/stats;
 *   API 实际"我的 agent"端点为 /api/manage(用 request.userId 自动过滤),
 *   CLI `my` 调 /api/manage 保证可用性;`stats` 对标 Web 契约调 /api/agents/stats(API 未实现时 404 友好提示)。
 *
 * 实现模板复用 memory.ts 的 resolveBaseUrl / resolveApiKeyAsync / apiRequest / extractData / handleError。
 * 注:端点分散于 /api/agents/* 与 /api/manage,故 apiRequest 接受完整 path(不使用固定 API_PREFIX)。
 *
 * 用法:
 *   ihui agents list [--category <id>] [--search <kw>] [--page <n>] [--json]
 *   ihui agents my [--json]
 *   ihui agents show <id> [--json]
 *   ihui agents create --name <n> --description <d> [--category <id>] [--json]
 *   ihui agents stats [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { loadSettings } from './settings.js';
import { ensureFreshAccessToken } from './token-manager.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_PAGE_SIZE = 20;
const TEXT_TRUNCATE_LEN = 60;

// === 响应类型(本地定义,与 Web 端 PageClient.tsx / stats/page.tsx 对齐) ===

interface Agent {
  agentId: string;
  name: string;
  description: string | null;
  avatar: string | null;
  cover: string | null;
  categoryId: string | null;
  workspaceId: string | null;
  status: string;
  price: number;
  isFree: boolean;
  sort: number;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AgentListData {
  list: Agent[];
  total: number;
}

interface AgentStats {
  totalAgents?: number;
  totalCalls?: number;
  totalUsers?: number;
  avgRating?: number;
  publishedCount?: number;
  pendingCount?: number;
}

interface AgentCreateInput {
  name: string;
  description?: string;
  categoryId?: string;
  status: string;
  price: number;
  isFree: boolean;
}

// === CLI options 类型 ===

interface ListOptions {
  category?: string;
  search?: string;
  page?: string;
  json?: boolean;
}

interface MyOptions {
  json?: boolean;
}

interface ShowOptions {
  json?: boolean;
}

interface CreateOptions {
  name: string;
  description: string;
  category?: string;
  json?: boolean;
}

interface StatsOptions {
  json?: boolean;
}

// === 解析工具(复用 memory.ts 模式) ===

/** 解析 baseUrl:CLI flag > settings.json > 默认值 http://localhost:8802(api 端口)。 */
function resolveBaseUrl(cliApiUrl: unknown): string {
  if (typeof cliApiUrl === 'string' && cliApiUrl) return cliApiUrl.replace(/\/+$/, '');
  const settings = loadSettings();
  const url = settings.apiUrl || process.env.IHUI_API_URL || 'http://localhost:8802';
  return url.replace(/\/+$/, '');
}

/**
 * 解析 apiKey:CLI flag > 自动 refresh 续期(settings.refreshToken)。
 * 返回 null 表示无 token / refresh 失败,调用方应提示用户 `ihui login`。
 */
async function resolveApiKeyAsync(
  cliApiKey: unknown,
  baseUrl: string,
): Promise<string | null> {
  if (typeof cliApiKey === 'string' && cliApiKey) return cliApiKey;
  return ensureFreshAccessToken(baseUrl);
}

/** 远程 HTTP 调用(Node 20+ 内置 fetch)。path 为完整路径(如 /api/agents/list),不拼接固定前缀。 */
async function apiRequest(
  baseUrl: string,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: unknown;
    timeoutMs?: number;
    apiKey?: string;
  } = {},
): Promise<unknown> {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
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
    const text = await resp.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`HTTP ${resp.status} 响应非 JSON: ${text.slice(0, 200)}`);
    }
    if (!resp.ok) {
      const msg =
        (parsed && typeof parsed === 'object' && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : `HTTP ${resp.status} ${resp.statusText}`) || `HTTP ${resp.status}`;
      const err = new Error(msg) as Error & { status?: number };
      err.status = resp.status;
      throw err;
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function printJson(data: unknown): void {
  console.info(JSON.stringify(data, null, 2));
}

/** 提取标准 API 响应的 data 字段;非标准格式原样返回。 */
function extractData(resp: unknown): unknown {
  if (resp && typeof resp === 'object' && 'data' in resp) {
    return (resp as { data: unknown }).data;
  }
  return resp;
}

/** 友好错误输出(不触发 crash handler)。 */
function handleError(scope: string, err: unknown): void {
  const e = err as Error & { status?: number };
  const status = typeof e.status === 'number' ? ` [${e.status}]` : '';
  console.error(chalk.red(`✗ ${scope}${status}: ${e.message || err}`));
  if (e.message?.includes('ECONNREFUSED') || e.message?.includes('fetch failed')) {
    console.error(chalk.dim('  请确认 API 服务已启动:pnpm --filter @ihui/api dev(默认 http://localhost:8802)'));
  }
  process.exitCode = 1;
}

// === 类型守卫 ===

function isAgent(v: unknown): v is Agent {
  return (
    typeof v === 'object' &&
    v !== null &&
    'agentId' in v &&
    typeof (v as { agentId: unknown }).agentId === 'string' &&
    'name' in v &&
    typeof (v as { name: unknown }).name === 'string'
  );
}

function isAgentListData(v: unknown): v is AgentListData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'list' in v &&
    Array.isArray((v as { list: unknown }).list)
  );
}

function isAgentStats(v: unknown): v is AgentStats {
  return typeof v === 'object' && v !== null;
}

// === 工具 ===

function parsePage(v: string | undefined): number {
  const n = v ? parseInt(v, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function formatPrice(agent: Agent): string {
  return agent.isFree ? '免费' : `¥${agent.price}`;
}

function truncate(s: string | null, len: number): string {
  const text = s ?? '';
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 19).replace('T', ' ');
}

// ==================== list ====================

async function listAgents(
  baseUrl: string,
  opts: ListOptions,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const params = new URLSearchParams({
    page: String(parsePage(opts.page)),
    pageSize: String(DEFAULT_PAGE_SIZE),
    status: 'published',
  });
  if (opts.category) params.set('categoryId', opts.category);
  if (opts.search) params.set('keyword', opts.search);

  const resp = await apiRequest(baseUrl, `/api/agents/list?${params.toString()}`, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isAgentListData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 list 字段'));
    process.exitCode = 1;
    return;
  }

  const agents = data.list.filter(isAgent);
  const total = typeof data.total === 'number' ? data.total : agents.length;

  if (agents.length === 0) {
    console.info(chalk.dim('(暂无已发布智能体)'));
    return;
  }

  console.info('');
  for (const a of agents) {
    const desc = truncate(a.description, TEXT_TRUNCATE_LEN);
    console.info(
      `[${chalk.cyan(a.agentId.slice(0, 8))}] ${chalk.bold(a.name)} ${chalk.dim(formatPrice(a))} ${chalk.dim(desc)}`,
    );
  }
  console.info(chalk.dim(`\n共 ${total} 个智能体`));
}

// ==================== my ====================

async function myAgents(
  baseUrl: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '100',
  });
  const resp = await apiRequest(baseUrl, `/api/manage?${params.toString()}`, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isAgentListData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 list 字段'));
    process.exitCode = 1;
    return;
  }

  const agents = data.list.filter(isAgent);
  const total = typeof data.total === 'number' ? data.total : agents.length;

  if (agents.length === 0) {
    console.info(chalk.dim('(暂无智能体,使用 ihui agents create 创建)'));
    return;
  }

  console.info('');
  for (const a of agents) {
    const desc = truncate(a.description, TEXT_TRUNCATE_LEN);
    console.info(
      `[${chalk.cyan(a.agentId.slice(0, 8))}] ${chalk.bold(a.name)} ${chalk.dim(`[${a.status}]`)} ${chalk.dim(formatPrice(a))} ${chalk.dim(desc)}`,
    );
  }
  console.info(chalk.dim(`\n共 ${total} 个智能体`));
}

// ==================== show ====================

async function showAgent(
  baseUrl: string,
  id: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  let resp: unknown;
  try {
    resp = await apiRequest(baseUrl, `/api/agents/${encodeURIComponent(id)}`, { apiKey });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      if (asJson) {
        printJson({ code: 404, message: '智能体不存在', data: null });
        return;
      }
      console.error(chalk.red(`✗ 未找到智能体 id=${id}`));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isAgent(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 agentId 字段'));
    process.exitCode = 1;
    return;
  }

  console.info('');
  console.info(`${chalk.bold(data.name)} ${chalk.dim(`[${data.status}]`)} ${chalk.cyan(formatPrice(data))}`);
  console.info(chalk.dim(`ID: ${data.agentId}`));
  if (data.description) console.info(`描述: ${data.description}`);
  console.info(`分类: ${data.categoryId ?? '—'}`);
  console.info(`工作区: ${data.workspaceId ?? '—'}`);
  console.info(`排序: ${data.sort}`);
  if (data.remark) console.info(`备注: ${data.remark}`);
  console.info(`创建时间: ${formatDate(data.createdAt)}`);
  console.info(`更新时间: ${formatDate(data.updatedAt)}`);
}

// ==================== create ====================

async function createAgent(
  baseUrl: string,
  opts: CreateOptions,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const input: AgentCreateInput = {
    name: opts.name,
    description: opts.description,
    status: 'pending',
    price: 0,
    isFree: true,
  };
  if (opts.category) input.categoryId = opts.category;

  const resp = await apiRequest(baseUrl, '/api/agents/create', {
    method: 'POST',
    body: input,
    apiKey,
  });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isAgent(data)) {
    console.error(chalk.red('✗ 创建失败:响应格式异常'));
    process.exitCode = 1;
    return;
  }
  console.info(chalk.green(`✓ 已创建智能体 [${data.name}] id=${data.agentId}`));
}

// ==================== stats ====================

async function statsAgent(
  baseUrl: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  let resp: unknown;
  try {
    resp = await apiRequest(baseUrl, '/api/agents/stats', { apiKey });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      console.error(chalk.red('✗ /api/agents/stats 端点未实现(API 暂无此端点,对标 Web 端契约保留)'));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isAgentStats(data)) {
    console.error(chalk.red('✗ 响应格式异常'));
    process.exitCode = 1;
    return;
  }

  console.info('');
  console.info(`${chalk.bold('总智能体数')}: ${data.totalAgents ?? 0}`);
  console.info(`${chalk.bold('已发布')}: ${data.publishedCount ?? 0}`);
  console.info(`${chalk.bold('待审核')}: ${data.pendingCount ?? 0}`);
  console.info(`${chalk.bold('总调用次数')}: ${data.totalCalls ?? 0}`);
  console.info(`${chalk.bold('总用户数')}: ${data.totalUsers ?? 0}`);
  console.info(`${chalk.bold('平均评分')}: ${(data.avgRating ?? 0).toFixed(1)}`);
}

// ==================== 命令注册 ====================

/**
 * 在根 program 上注册 `agents` 命令组。
 * 使用全局 `--api-url` / `--api-key` 或 settings.json 解析后端地址。
 */
export function registerAgentsCommand(program: Command): void {
  const agentsCmd = program
    .command('agents')
    .description('智能体市场管理 (对标 Web 端 /agents)');

  agentsCmd
    .command('list')
    .description('列出市场已发布智能体')
    .option('--category <id>', '按分类 ID 过滤')
    .option('--search <keyword>', '关键词搜索')
    .option('--page <n>', '页码 (默认 1)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: ListOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await listAgents(baseUrl, opts, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('agents list', err);
      }
    });

  agentsCmd
    .command('my')
    .description('列出当前用户的智能体')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: MyOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await myAgents(baseUrl, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('agents my', err);
      }
    });

  agentsCmd
    .command('show <id>')
    .description('查看智能体详情')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (id: string, opts: ShowOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await showAgent(baseUrl, id, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('agents show', err);
      }
    });

  agentsCmd
    .command('create')
    .description('创建智能体')
    .requiredOption('--name <name>', '智能体名称')
    .requiredOption('--description <desc>', '智能体描述')
    .option('--category <id>', '分类 ID')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: CreateOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await createAgent(baseUrl, opts, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('agents create', err);
      }
    });

  agentsCmd
    .command('stats')
    .description('智能体统计')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: StatsOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await statsAgent(baseUrl, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('agents stats', err);
      }
    });
}
