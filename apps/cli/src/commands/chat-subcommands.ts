/**
 * Chat Subcommands CLI — 对话子命令,对标 Web 端 /chat/history /chat/favorites /chat/templates /chat/settings 4 页功能。
 *
 * 对接后端 apps/api/src/routes/chat.ts(/api/chat 端点,JWT Bearer 鉴权):
 *  - GET /api/chat/conversations?page=&pageSize=&search=  → { conversations, page, pageSize, total }
 *  - GET /api/chat/favorites?page=&pageSize=               → { favorites, page, pageSize, total }
 *  - GET /api/chat/templates                                → { list, categories? }
 *  - GET /api/chat/settings                                 → { model, temperature, maxTokens, systemPrompt }
 *
 * 类型契约:Conversation / Template / ChatSettings 本地定义,与 Web 端
 * conversation-list.tsx / templates page / settings page 接口对齐。
 * 实现模板复用 capabilities.ts / memory.ts 的 resolveBaseUrl / resolveApiKeyAsync / apiRequest / extractData / handleError。
 *
 * 用法:
 *   ihui chat history [--page <n>] [--json]
 *   ihui chat favorites [--json]
 *   ihui chat templates [--json]
 *   ihui chat settings [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { loadSettings } from './settings.js';
import { ensureFreshAccessToken } from './token-manager.js';

const API_PREFIX = '/api/chat';
const DEFAULT_TIMEOUT_MS = 30_000;
const TEXT_TRUNCATE_LEN = 60;
const DEFAULT_PAGE_SIZE = 20;

// === 响应类型(本地定义,与 Web 端对齐) ===

/** 对话项(GET /conversations / GET /favorites 共用,对标 conversation-list.tsx Conversation) */
interface Conversation {
  id: string;
  title: string;
  model: string;
  lastMessageAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  messageCount?: number;
  favorite?: boolean;
  archivedAt?: string | null;
}

interface ConversationListData {
  conversations: Conversation[];
  page: number;
  pageSize: number;
  total: number;
}

interface FavoriteListData {
  favorites: Conversation[];
  page: number;
  pageSize: number;
  total: number;
}

/** 对话模板(对标 templates page.tsx Template) */
interface Template {
  id: string;
  title: string;
  description: string | null;
  content: string;
  categoryId: string | null;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
}

interface TemplatesData {
  list: Template[];
  categories?: Category[];
}

/** 对话设置(对标 settings page.tsx ChatSettings) */
interface ChatSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

// === CLI options 类型 ===

interface HistoryOptions {
  page?: string;
  json?: boolean;
}

interface FavoritesOptions {
  json?: boolean;
}

interface TemplatesOptions {
  json?: boolean;
}

interface SettingsOptions {
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
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
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

/** 从子命令向上查找根 program 并取全局 --api-url / --api-key 选项。 */
function getRootOpts(cmd: Command): { apiUrl?: string; apiKey?: string } {
  let root: Command = cmd;
  while (root.parent) root = root.parent;
  return root.opts() as { apiUrl?: string; apiKey?: string };
}

// === 类型守卫 ===

function isConversation(v: unknown): v is Conversation {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'title' in v &&
    typeof (v as { title: unknown }).title === 'string'
  );
}

function isConversationListData(v: unknown): v is ConversationListData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'conversations' in v &&
    Array.isArray((v as { conversations: unknown }).conversations)
  );
}

function isFavoriteListData(v: unknown): v is FavoriteListData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'favorites' in v &&
    Array.isArray((v as { favorites: unknown }).favorites)
  );
}

function isTemplate(v: unknown): v is Template {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'title' in v &&
    'content' in v
  );
}

function isTemplatesData(v: unknown): v is TemplatesData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'list' in v &&
    Array.isArray((v as { list: unknown }).list)
  );
}

function isChatSettings(v: unknown): v is ChatSettings {
  return (
    typeof v === 'object' &&
    v !== null &&
    'model' in v &&
    typeof (v as { model: unknown }).model === 'string'
  );
}

// === 辅助 ===

function parsePage(v: string | undefined): number {
  if (v === undefined) return 1;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`无效的 page "${v}",必须为正整数`);
  }
  return n;
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function fmtDate(v: string | null | undefined): string {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d);
}

function truncate(s: string, len: number): string {
  return s.length > len ? `${s.slice(0, len)}…` : s;
}

// ==================== history ====================

async function listHistory(
  baseUrl: string,
  page: number,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const qs = buildQueryString({ page, pageSize: DEFAULT_PAGE_SIZE });
  const resp = await apiRequest(baseUrl, `/conversations${qs}`, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isConversationListData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 conversations 字段'));
    process.exitCode = 1;
    return;
  }

  const conversations = data.conversations.filter(isConversation);
  const total = typeof data.total === 'number' ? data.total : conversations.length;

  if (conversations.length === 0) {
    console.info(chalk.dim('(暂无历史会话)'));
    return;
  }

  console.info('');
  for (const c of conversations) {
    const star = c.favorite ? chalk.yellow('★') : chalk.dim('☆');
    const archived = c.archivedAt ? chalk.dim('[归档] ') : '';
    const count = typeof c.messageCount === 'number' ? `${c.messageCount}条` : '';
    console.info(
      `${star} ${archived}${chalk.cyan(c.id.slice(0, 8))} ${chalk.bold(truncate(c.title, TEXT_TRUNCATE_LEN))}`,
    );
    console.info(chalk.dim(`    ${c.model}  ${fmtDate(c.lastMessageAt)}  ${count}`));
  }
  console.info(chalk.dim(`\n第 ${data.page} 页  共 ${total} 个会话`));
}

// ==================== favorites ====================

async function listFavorites(
  baseUrl: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const qs = buildQueryString({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const resp = await apiRequest(baseUrl, `/favorites${qs}`, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isFavoriteListData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 favorites 字段'));
    process.exitCode = 1;
    return;
  }

  const favorites = data.favorites.filter(isConversation);
  const total = typeof data.total === 'number' ? data.total : favorites.length;

  if (favorites.length === 0) {
    console.info(chalk.dim('(暂无收藏会话)'));
    return;
  }

  console.info('');
  for (const f of favorites) {
    const count = typeof f.messageCount === 'number' ? `${f.messageCount}条` : '';
    console.info(
      `${chalk.yellow('★')} ${chalk.cyan(f.id.slice(0, 8))} ${chalk.bold(truncate(f.title, TEXT_TRUNCATE_LEN))}`,
    );
    console.info(chalk.dim(`    ${f.model}  ${fmtDate(f.lastMessageAt)}  ${count}`));
  }
  console.info(chalk.dim(`\n共 ${total} 个收藏`));
}

// ==================== templates ====================

async function listTemplates(
  baseUrl: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const resp = await apiRequest(baseUrl, '/templates', { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isTemplatesData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 list 字段'));
    process.exitCode = 1;
    return;
  }

  const templates = data.list.filter(isTemplate);
  const categories = Array.isArray(data.categories) ? data.categories : [];

  if (templates.length === 0) {
    console.info(chalk.dim('(暂无对话模板)'));
    return;
  }

  console.info('');
  for (const t of templates) {
    const cat = t.categoryId ? categories.find((c) => c.id === t.categoryId) : undefined;
    const catLabel = cat ? chalk.dim(`[${cat.name}] `) : '';
    console.info(
      `${chalk.cyan(t.id.slice(0, 8))} ${catLabel}${chalk.bold(truncate(t.title, TEXT_TRUNCATE_LEN))}`,
    );
    if (t.description) {
      console.info(chalk.dim(`    ${truncate(t.description, TEXT_TRUNCATE_LEN)}`));
    }
    console.info(chalk.dim(`    内容: ${truncate(t.content, 40)}  ${fmtDate(t.createdAt)}`));
  }
  console.info(chalk.dim(`\n共 ${templates.length} 个模板`));
}

// ==================== settings ====================

async function showSettings(
  baseUrl: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const resp = await apiRequest(baseUrl, '/settings', { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isChatSettings(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 model 字段'));
    process.exitCode = 1;
    return;
  }

  console.info('');
  console.info(`${chalk.bold('模型')}:        ${chalk.cyan(data.model)}`);
  console.info(`${chalk.bold('温度')}:        ${data.temperature}`);
  console.info(`${chalk.bold('最大 tokens')}: ${data.maxTokens}`);
  console.info(
    `${chalk.bold('系统提示')}:    ${data.systemPrompt ? truncate(data.systemPrompt, TEXT_TRUNCATE_LEN) : chalk.dim('(未设置)')}`,
  );
}

// ==================== 命令注册 ====================

/**
 * 在已有的 `chat` 命令上挂载子命令(history / favorites / templates / settings)。
 * 使用根 program 的全局 `--api-url` / `--api-key` 或 settings.json 解析后端地址。
 */
export function attachChatSubcommands(chatCmd: Command): void {
  chatCmd
    .command('history')
    .description('历史会话列表 (对标 Web 端 /chat/history)')
    .option('--page <n>', '页码(从 1 开始)', '1')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: HistoryOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = getRootOpts(chatCmd);
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        const page = parsePage(opts.page);
        await listHistory(baseUrl, page, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('chat history', err);
      }
    });

  chatCmd
    .command('favorites')
    .description('收藏对话列表 (对标 Web 端 /chat/favorites)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: FavoritesOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = getRootOpts(chatCmd);
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await listFavorites(baseUrl, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('chat favorites', err);
      }
    });

  chatCmd
    .command('templates')
    .description('对话模板列表 (对标 Web 端 /chat/templates)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: TemplatesOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = getRootOpts(chatCmd);
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await listTemplates(baseUrl, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('chat templates', err);
      }
    });

  chatCmd
    .command('settings')
    .description('当前对话设置 (对标 Web 端 /chat/settings)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: SettingsOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = getRootOpts(chatCmd);
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await showSettings(baseUrl, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('chat settings', err);
      }
    });
}
