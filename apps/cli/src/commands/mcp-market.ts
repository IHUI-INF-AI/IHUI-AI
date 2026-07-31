/**
 * MCP Market CLI — MCP 市场管理命令,对标 Web 端 /mcp-projects 功能。
 *
 * 对接后端两组端点:
 *  1. 市场目录(apps/api/src/routes/user/mcp-routes.ts,/api/mcp 端点,JWT Bearer 鉴权):
 *     - GET /api/mcp?page=&pageSize=&search= → { list, total, page, pageSize }
 *     - GET /api/mcp/:id                     → { mcp }
 *  2. 用户项目(apps/api/src/routes/mcp-extended.ts,/api/mcp/projects 端点):
 *     - POST   /api/mcp/projects body: { name, description?, endpoint?, status?, tags? } → project
 *     - DELETE /api/mcp/projects/:id → { id, deleted }
 *
 * install 流程:先从市场目录 GET /api/mcp/:id 拉取详情,再 POST /api/mcp/projects 落地为用户项目。
 * remove 流程:DELETE /api/mcp/projects/:id 卸载用户项目。
 *
 * 类型契约:McpServer 字段(id/name/description/endpoint/status/createdAt/updatedAt)对齐
 * packages/database/src/schema/mcp-servers.ts;本地定义,与 memory.ts 模式一致。
 * 实现模板复用 memory.ts 的 resolveBaseUrl / resolveApiKeyAsync / apiRequest / extractData / handleError。
 *
 * 用法:
 *   ihui mcp-market list [--page <n>] [--page-size <n>] [--json]
 *   ihui mcp-market search <keyword> [--page <n>] [--page-size <n>] [--json]
 *   ihui mcp-market show <id> [--json]
 *   ihui mcp-market install <id> [--json]
 *   ihui mcp-market remove <id> [--json]
 *
 * 注:CLI 已有 `ihui mcp` 命令(mcp-config.ts)做本地配置,本命令用 `mcp-market` 避免冲突。
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { loadSettings } from './settings.js';
import { ensureFreshAccessToken } from './token-manager.js';

const API_PREFIX = '/api/mcp';
const DEFAULT_TIMEOUT_MS = 30_000;
const TEXT_TRUNCATE_LEN = 60;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// === 请求 / 响应类型(本地定义,与后端 schema 对齐) ===

/** MCP 市场服务条目(对齐 mcp_servers 表)。 */
interface McpServer {
  id: string;
  name: string;
  description: string | null;
  endpoint: string;
  status: number; // 1=启用 0=禁用
  createdAt: string;
  updatedAt: string;
}

interface McpListData {
  list: McpServer[];
  total: number;
  page: number;
  pageSize: number;
}

interface McpDetailData {
  mcp: McpServer;
}

/** 创建用户项目的请求体(对齐 mcp-extended.ts projectBody)。 */
interface McpProjectCreateInput {
  name: string;
  description?: string;
  endpoint?: string;
  status?: string;
  tags?: string[];
}

interface McpDeleteData {
  id: string;
  deleted: boolean;
}

// === CLI options 类型 ===

interface ListOptions {
  page?: string;
  pageSize?: string;
  json?: boolean;
}

interface SearchOptions {
  page?: string;
  pageSize?: string;
  json?: boolean;
}

interface ShowOptions {
  json?: boolean;
}

interface InstallOptions {
  json?: boolean;
}

interface RemoveOptions {
  json?: boolean;
}

// === 解析工具(复用 capabilities.ts / memory.ts 模式) ===

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

/** 远程 HTTP 调用(Node 20+ 内置 fetch)。失败抛错,由调用方 try/catch 输出友好错误。 */
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

function isMcpServer(v: unknown): v is McpServer {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'name' in v &&
    typeof (v as { name: unknown }).name === 'string' &&
    'endpoint' in v &&
    typeof (v as { endpoint: unknown }).endpoint === 'string'
  );
}

function isMcpListData(v: unknown): v is McpListData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'list' in v &&
    Array.isArray((v as { list: unknown }).list)
  );
}

function isMcpDetailData(v: unknown): v is McpDetailData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'mcp' in v &&
    isMcpServer((v as { mcp: unknown }).mcp)
  );
}

function isMcpDeleteData(v: unknown): v is McpDeleteData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'deleted' in v
  );
}

// === 参数 / 查询构建 ===

/** 解析正整数分页参数,非法值抛错(由 action try/catch → handleError 处理)。 */
function parsePositiveInt(v: string | undefined, fallback: number, max: number): number {
  if (v === undefined || v === '') return fallback;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`无效的数值 "${v}",应为正整数`);
  }
  return Math.min(max, n);
}

interface MarketListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

function buildQueryString(query: MarketListQuery): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.search) params.set('search', query.search);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** 日期格式化(AGENTS.md §4 要求用 Intl.DateTimeFormat)。 */
function formatDate(v: unknown): string {
  if (typeof v !== 'string' && typeof v !== 'number' && !(v instanceof Date)) return '-';
  try {
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(v),
    );
  } catch {
    return '-';
  }
}

// ==================== list ====================

async function listMarket(
  baseUrl: string,
  query: MarketListQuery,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const qs = buildQueryString(query);
  const resp = await apiRequest(baseUrl, qs, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isMcpListData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 list 字段'));
    process.exitCode = 1;
    return;
  }

  const list = data.list.filter(isMcpServer);
  const total = typeof data.total === 'number' ? data.total : list.length;

  if (list.length === 0) {
    console.info(chalk.dim('(暂无 MCP 服务)'));
    return;
  }

  console.info('');
  for (const m of list) {
    const status = m.status === 1 ? chalk.green('启用') : chalk.dim('禁用');
    const desc = (m.description ?? '').slice(0, TEXT_TRUNCATE_LEN);
    console.info(
      `[${chalk.cyan(m.id.slice(0, 8))}] ${chalk.bold(m.name)} ${status} ${chalk.dim(desc)}`,
    );
  }
  console.info(chalk.dim(`\n共 ${total} 个 MCP 服务`));
}

// ==================== search ====================

async function searchMarket(
  baseUrl: string,
  keyword: string,
  opts: SearchOptions,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const query: MarketListQuery = {
    page: parsePositiveInt(opts.page, DEFAULT_PAGE, Number.MAX_SAFE_INTEGER),
    pageSize: parsePositiveInt(opts.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    search: keyword,
  };
  await listMarket(baseUrl, query, asJson, apiKey);
}

// ==================== show ====================

async function showMarket(
  baseUrl: string,
  id: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const path = `/${encodeURIComponent(id)}`;
  let resp: unknown;
  try {
    resp = await apiRequest(baseUrl, path, { apiKey });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      if (asJson) {
        printJson({ code: 404, message: 'MCP 服务不存在', data: null });
        return;
      }
      console.error(chalk.red(`✗ 未找到 id=${id}`));
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
  if (!isMcpDetailData(data)) {
    console.error(chalk.red('✗ 响应格式异常'));
    process.exitCode = 1;
    return;
  }

  const m = data.mcp;
  console.info('');
  console.info(`${chalk.bold(m.name)}  ${chalk.dim(`(${m.id})`)}`);
  if (m.description) console.info(chalk.dim(m.description));
  console.info('');
  console.info(`状态:     ${m.status === 1 ? chalk.green('启用') : chalk.dim('禁用')}`);
  console.info(`端点:     ${m.endpoint}`);
  console.info(`创建时间: ${formatDate(m.createdAt)}`);
  console.info(`更新时间: ${formatDate(m.updatedAt)}`);
}

// ==================== install ====================

/**
 * 安装市场 MCP 到用户项目列表:
 * 1. GET /api/mcp/:id 拉取市场详情
 * 2. POST /api/mcp/projects 落地为用户项目
 */
async function installMarket(
  baseUrl: string,
  id: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const detailPath = `/${encodeURIComponent(id)}`;
  let detailResp: unknown;
  try {
    detailResp = await apiRequest(baseUrl, detailPath, { apiKey });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      if (asJson) {
        printJson({ code: 404, message: 'MCP 服务不存在', data: null });
        return;
      }
      console.error(chalk.red(`✗ 市场未找到 id=${id}`));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const detailData = extractData(detailResp);
  if (!isMcpDetailData(detailData)) {
    console.error(chalk.red('✗ 市场响应格式异常'));
    process.exitCode = 1;
    return;
  }

  const m = detailData.mcp;
  const body: McpProjectCreateInput = {
    name: m.name,
    endpoint: m.endpoint,
    status: m.status === 1 ? 'active' : 'inactive',
  };
  if (m.description) body.description = m.description;

  const createResp = await apiRequest(baseUrl, '/projects', {
    method: 'POST',
    body,
    apiKey,
  });

  if (asJson) {
    printJson(createResp);
    return;
  }

  const created = extractData(createResp);
  const projectId =
    created && typeof created === 'object' && 'id' in created
      ? String((created as { id: unknown }).id)
      : '(未知)';
  console.info(
    chalk.green(`✓ 已安装 MCP "${m.name}" 到项目列表 (project=${projectId})`),
  );
}

// ==================== remove ====================

async function removeMarket(
  baseUrl: string,
  id: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const path = `/projects/${encodeURIComponent(id)}`;
  let resp: unknown;
  try {
    resp = await apiRequest(baseUrl, path, {
      method: 'DELETE',
      apiKey,
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      if (asJson) {
        printJson({ code: 404, message: 'MCP 项目不存在', data: null });
        return;
      }
      console.error(chalk.red(`✗ 未找到项目 id=${id}`));
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
  if (isMcpDeleteData(data) && data.deleted) {
    console.info(chalk.green(`✓ 已卸载 MCP 项目 id=${data.id}`));
  } else {
    console.error(chalk.red(`✗ 未找到项目 id=${id}`));
    process.exitCode = 1;
  }
}

// ==================== 命令注册 ====================

/**
 * 在根 program 上注册 `mcp-market` 命令组。
 * 使用全局 `--api-url` / `--api-key` 或 settings.json 解析后端地址。
 */
export function registerMcpMarketCommand(program: Command): void {
  const cmd = program
    .command('mcp-market')
    .description('MCP 市场管理 (对标 Web 端 /mcp-projects: list/search/show/install/remove)');

  cmd
    .command('list')
    .description('列出市场可用 MCP 服务')
    .option('--page <n>', '页码(从 1 开始)', String(DEFAULT_PAGE))
    .option('--page-size <n>', '每页数量(最大 100)', String(DEFAULT_PAGE_SIZE))
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
        const query: MarketListQuery = {
          page: parsePositiveInt(opts.page, DEFAULT_PAGE, Number.MAX_SAFE_INTEGER),
          pageSize: parsePositiveInt(opts.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
        };
        await listMarket(baseUrl, query, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('mcp-market list', err);
      }
    });

  cmd
    .command('search <keyword>')
    .description('按关键词搜索市场 MCP(匹配名称)')
    .option('--page <n>', '页码(从 1 开始)', String(DEFAULT_PAGE))
    .option('--page-size <n>', '每页数量(最大 100)', String(DEFAULT_PAGE_SIZE))
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (keyword: string, opts: SearchOptions) => {
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
        await searchMarket(baseUrl, keyword, opts, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('mcp-market search', err);
      }
    });

  cmd
    .command('show <id>')
    .description('查看市场 MCP 服务详情')
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
        await showMarket(baseUrl, id, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('mcp-market show', err);
      }
    });

  cmd
    .command('install <id>')
    .description('从市场安装 MCP 到用户项目列表')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (id: string, opts: InstallOptions) => {
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
        await installMarket(baseUrl, id, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('mcp-market install', err);
      }
    });

  cmd
    .command('remove <id>')
    .description('从用户项目列表卸载 MCP')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (id: string, opts: RemoveOptions) => {
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
        await removeMarket(baseUrl, id, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('mcp-market remove', err);
      }
    });
}
