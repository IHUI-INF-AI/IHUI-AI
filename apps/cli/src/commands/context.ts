/**
 * Context CLI — 上下文文件管理命令,对标 Web 端 /context 上下文管理功能(list / add / remove / clear)。
 *
 * 对接后端 apps/api/src/routes/resource-context.ts(/api/resource-context 端点,JWT Bearer 鉴权):
 *  - GET    /api/resource-context/list?page=&pageSize=&type=&keyword=  → { list, total, page, pageSize }
 *  - GET    /api/resource-context/session/:sessionId                   → { list }  (资源 + 绑定 join 行)
 *  - POST   /api/resource-context/create   body: { name, type, url?, content?, fileId?, metadata? } → ResourceContext
 *  - POST   /api/resource-context/bind      body: { resourceContextId, sessionId?, agentId? } → { bound, ...binding }
 *  - DELETE /api/resource-context/:id       → { id }  (服务端级联清理 bindings)
 *
 * 类型契约:ResourceContext 字段对齐 @ihui/database schema/resource-context.ts(id/userId/name/type/url/content/fileId/metadata/createdAt/updatedAt)。
 * 实现模板复用 memory.ts 的 resolveBaseUrl / resolveApiKeyAsync / apiRequest / extractData / handleError。
 *
 * 用法:
 *   ihui context list [--session <id>] [--json]
 *   ihui context add <file> [--session <id>] [--json]
 *   ihui context remove <file> [--session <id>] [--json]
 *   ihui context clear [--session <id>] [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { loadSettings } from './settings.js';
import { ensureFreshAccessToken } from './token-manager.js';

const API_PREFIX = '/api/resource-context';
const DEFAULT_TIMEOUT_MS = 30_000;
const NAME_TRUNCATE_LEN = 60;
const LIST_PAGE_SIZE = 100;

// === 请求 / 响应类型(本地定义,与 @ihui/database schema 对齐) ===

/** 资源上下文行(对齐 resourceContexts 表 $inferSelect)。 */
interface ResourceContext {
  id: string;
  userId?: string;
  name: string;
  type: string;
  url?: string | null;
  content?: string | null;
  fileId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ResourceContextCreateInput {
  name: string;
  type: string;
}

interface BindInput {
  resourceContextId: string;
  sessionId?: string;
  agentId?: string;
}

interface ResourceListData {
  list: unknown[];
  total?: number;
  page?: number;
  pageSize?: number;
}

interface ResourceDeleteData {
  id: string;
}

interface BindData {
  bound: boolean;
  resourceContextId?: string;
}

// === CLI options 类型 ===

interface ListOptions {
  session?: string;
  json?: boolean;
}

interface AddOptions {
  session?: string;
  json?: boolean;
}

interface RemoveOptions {
  session?: string;
  json?: boolean;
}

interface ClearOptions {
  session?: string;
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

function isResourceContext(v: unknown): v is ResourceContext {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'name' in v &&
    typeof (v as { name: unknown }).name === 'string' &&
    'type' in v &&
    typeof (v as { type: unknown }).type === 'string'
  );
}

function isResourceListData(v: unknown): v is ResourceListData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'list' in v &&
    Array.isArray((v as { list: unknown }).list)
  );
}

function isResourceDeleteData(v: unknown): v is ResourceDeleteData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string'
  );
}

function isBindData(v: unknown): v is BindData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'bound' in v &&
    typeof (v as { bound: unknown }).bound === 'boolean'
  );
}

/**
 * 从列表行中提取资源对象。
 * list 端点返回扁平行;session 端点返回 join 行 { resourceContexts, resourceContextBindings }。
 */
function normalizeResource(row: unknown): ResourceContext | null {
  if (!row || typeof row !== 'object') return null;
  const obj = row as Record<string, unknown>;
  if ('resourceContexts' in obj && obj.resourceContexts && typeof obj.resourceContexts === 'object') {
    const inner = obj.resourceContexts as unknown;
    return isResourceContext(inner) ? inner : null;
  }
  return isResourceContext(row) ? row : null;
}

// ==================== list ====================

async function listContext(
  baseUrl: string,
  session: string | undefined,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  // 带 session → 查该会话绑定的资源;否则 → 查当前用户全部资源(分页,默认取前 LIST_PAGE_SIZE 条)
  const path = session
    ? `/session/${encodeURIComponent(session)}`
    : `/list?pageSize=${LIST_PAGE_SIZE}`;
  const resp = await apiRequest(baseUrl, path, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isResourceListData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 list 字段'));
    process.exitCode = 1;
    return;
  }

  const items = data.list
    .map(normalizeResource)
    .filter((r): r is ResourceContext => r !== null);
  const total = typeof data.total === 'number' ? data.total : items.length;

  if (items.length === 0) {
    console.info(chalk.dim('(暂无上下文文件)'));
    return;
  }

  console.info('');
  for (const r of items) {
    const name = (r.name ?? '').slice(0, NAME_TRUNCATE_LEN);
    console.info(
      `[${chalk.cyan(r.id.slice(0, 8))}] ${chalk.bold(r.type)} ${chalk.dim(name)}`,
    );
  }
  const scopeLabel = session ? `会话 ${session}` : '全局';
  console.info(chalk.dim(`\n共 ${total} 条上下文 (${scopeLabel})`));
}

// ==================== add ====================

async function addContext(
  baseUrl: string,
  file: string,
  session: string | undefined,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const input: ResourceContextCreateInput = { name: file, type: 'file' };

  const resp = await apiRequest(baseUrl, '/create', {
    method: 'POST',
    body: input,
    apiKey,
  });

  const data = extractData(resp);
  if (!isResourceContext(data)) {
    console.error(chalk.red('✗ 添加失败:响应格式异常'));
    process.exitCode = 1;
    return;
  }

  // 指定 session 时,把资源绑定到该会话;绑定失败不阻断创建,仅告警
  let bound = false;
  if (session) {
    const bindInput: BindInput = { resourceContextId: data.id, sessionId: session };
    try {
      const bindResp = await apiRequest(baseUrl, '/bind', {
        method: 'POST',
        body: bindInput,
        apiKey,
      });
      const bindData = extractData(bindResp);
      bound = isBindData(bindData) && bindData.bound === true;
    } catch (err) {
      const e = err as Error;
      console.error(chalk.yellow(`⚠ 绑定会话 ${session} 失败: ${e.message || err}`));
    }
  }

  if (asJson) {
    printJson(resp);
    return;
  }

  const bindHint = session ? (bound ? `,已绑定到会话 ${session}` : ',绑定失败见上') : '';
  console.info(
    chalk.green(`✓ 已添加上下文 id=${data.id} name=${file} (type=file${bindHint})`),
  );
}

// ==================== remove ====================

async function removeContext(
  baseUrl: string,
  id: string,
  session: string | undefined,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  // 指定 session 时,先校验该资源确实绑定到此会话,避免误删其他会话引用的资源
  if (session) {
    const sessResp = await apiRequest(baseUrl, `/session/${encodeURIComponent(session)}`, {
      apiKey,
    });
    const sessData = extractData(sessResp);
    const sessList = isResourceListData(sessData) ? sessData.list : [];
    const belongs = sessList.some((row) => normalizeResource(row)?.id === id);
    if (!belongs) {
      if (asJson) {
        printJson({ code: 404, message: `资源 ${id} 未绑定到会话 ${session}`, data: null });
      } else {
        console.error(chalk.red(`✗ 资源 ${id} 未绑定到会话 ${session}`));
        process.exitCode = 1;
      }
      return;
    }
  }

  // 删除资源(服务端级联清理 bindings)
  let resp: unknown;
  try {
    resp = await apiRequest(baseUrl, `/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      apiKey,
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      if (asJson) {
        printJson({ code: 404, message: '上下文资源不存在', data: null });
      } else {
        console.error(chalk.red(`✗ 未找到 id=${id}`));
        process.exitCode = 1;
      }
      return;
    }
    throw err;
  }

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (isResourceDeleteData(data)) {
    console.info(chalk.green(`✓ 已删除上下文 id=${data.id}`));
  } else {
    console.error(chalk.red('✗ 删除失败:响应格式异常'));
    process.exitCode = 1;
  }
}

// ==================== clear ====================

async function clearContext(
  baseUrl: string,
  session: string | undefined,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const path = session
    ? `/session/${encodeURIComponent(session)}`
    : `/list?pageSize=${LIST_PAGE_SIZE}`;
  const resp = await apiRequest(baseUrl, path, { apiKey });
  const data = extractData(resp);
  const list = isResourceListData(data) ? data.list : [];
  const items = list
    .map(normalizeResource)
    .filter((r): r is ResourceContext => r !== null);

  let cleared = 0;
  for (const r of items) {
    try {
      const delResp = await apiRequest(baseUrl, `/${encodeURIComponent(r.id)}`, {
        method: 'DELETE',
        apiKey,
      });
      const delData = extractData(delResp);
      if (isResourceDeleteData(delData)) cleared++;
    } catch {
      // 单条删除失败继续,不中断批处理
    }
  }

  if (asJson) {
    printJson({ cleared });
    return;
  }
  const scopeLabel = session ? `会话 ${session}` : '全局';
  console.info(chalk.green(`✓ 已清空 ${cleared} 条上下文 (${scopeLabel})`));
}

// ==================== 命令注册 ====================

/**
 * 在根 program 上注册 `context` 命令组。
 * 使用全局 `--api-url` / `--api-key` 或 settings.json 解析后端地址。
 */
export function registerContextCommand(program: Command): void {
  const ctxCmd = program
    .command('context')
    .description('上下文文件管理 (对标 Web 端 /context)');

  ctxCmd
    .command('list')
    .description('列出上下文文件 (指定 --session 仅查该会话绑定的资源)')
    .option('--session <id>', '会话 ID 筛选')
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
        await listContext(baseUrl, opts.session, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('context list', err);
      }
    });

  ctxCmd
    .command('add <file>')
    .description('添加一条上下文文件 (type=file,指定 --session 同时绑定到该会话)')
    .option('--session <id>', '绑定到的会话 ID')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (file: string, opts: AddOptions) => {
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
        await addContext(baseUrl, file, opts.session, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('context add', err);
      }
    });

  ctxCmd
    .command('remove <file>')
    .description('删除指定上下文文件 (按资源 ID,服务端级联清理会话绑定)')
    .option('--session <id>', '校验该资源需绑定到此会话后才删除')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (file: string, opts: RemoveOptions) => {
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
        await removeContext(baseUrl, file, opts.session, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('context remove', err);
      }
    });

  ctxCmd
    .command('clear')
    .description('清空上下文 (批量 list + 循环 delete,指定 --session 仅清该会话绑定)')
    .option('--session <id>', '仅清空绑定到此会话的资源')
    .option('--json', '以 JSON 格式输出 { cleared: N }')
    .action(async (opts: ClearOptions) => {
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
        await clearContext(baseUrl, opts.session, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('context clear', err);
      }
    });
}
