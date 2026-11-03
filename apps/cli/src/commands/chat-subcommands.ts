// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Chat Subcommands CLI — 对话子命令,对标 Web 端 /chat/history /chat/favorites /chat/templates /chat/settings 4 页功能。
 *
 * 对接后端 apps/api/src/routes/chat.ts(/api/chat 端点,JWT Bearer 鉴权):
 *  - GET /api/chat/conversations?page=&pageSize=&search=  → { conversations, page, pageSize, total }
 *  - GET /api/chat/favorites?page=&pageSize=               → { favorites, page, pageSize, total }
 *  - GET /api/chat/templates                                → { list, categories? }
 *  - GET /api/chat/settings                                 → { model, temperature, maxTokens, systemPrompt }
 *  - GET /api/chat/conversations/:id/history?limit=&cursor=&direction=
 *      → turn 分片历史。**这条链本文件不碰 fetch / 不碰投影**:一律经
 *      `./history-read-ops.js`(它再委派 `@ihui/shared/chat` 与 `@ihui/api-client`)。
 *      该模块 2026-09-27 落地后长期零生产 importer(只有测试引用它),
 *      `ihui chat history <conversationId>` 就是它的挂载点(AGENTS §0.9 造好没装车 = 没有)。
 *
 * 类型契约:Conversation / Template / ChatSettings 本地定义,与 Web 端
 * conversation-list.tsx / templates page / settings page 接口对齐。
 * 实现模板复用 capabilities.ts / memory.ts 的 resolveBaseUrl / resolveApiKeyAsync / apiRequest / extractData / handleError。
 *
 * 用法:
 *   ihui chat history [--page <n>] [--json]                        → 会话列表
 *   ihui chat history <conversationId> [--turns-per-page <n>] [--max-pages <n>]
 *                  [--replay-check] [--json]                       → 该会话的 turn 分片历史
 *   ihui chat favorites [--json]
 *   ihui chat templates [--json]
 *   ihui chat settings [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';

// 正文读取这条链的传输与鉴权都归 api-client(history-read-ops 内部用 getConversationHistory);
// 全局注入点在 index.ts 的 preAction,这里再注入一次是为了让子命令级 --api-url / --api-key
// 与 refresh 后的 access token 真正落到发请求的那一层(否则这条链会打到默认端口)。
import { setBaseUrl } from '@ihui/api-client';
import { registerCliTokenProvider } from '../lib/auth-refresh.js';

import { createApiRequest, extractData, handleError, printJson, resolveApiKeyAsync, resolveBaseUrl } from './http-utils.js';
import {
  HISTORY_MAX_PAGES_DEFAULT,
  HISTORY_TURNS_PER_PAGE_MAX,
  addHistoryTally,
  formatHistoryPageLine,
  formatHistoryReplayCheckLine,
  formatHistorySummaryLine,
  formatHistoryTallyLine,
  historyResumeCursor,
  readConversationHistory,
  resumeConversationHistory,
  type HistoryReadOutcome,
} from './history-read-ops.js';
import { missingTokenHint } from './token-manager.js';

const API_PREFIX = '/api/chat';
const DEFAULT_TIMEOUT_MS = 30_000;
const apiRequest = createApiRequest(API_PREFIX, DEFAULT_TIMEOUT_MS);
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
  /** 每页 turn 数;交给 history-read-ops → 共享层 `clampHistoryLimit` 夹取,本文件不自算。 */
  turnsPerPage?: string;
  /** 单次读取最多翻几页(防失控护栏,默认值取模块常量)。 */
  maxPages?: string;
  /** 全量读一遍后再从服务端断点续读,并打印"增量 vs 整段重取"的对账行。 */
  replayCheck?: boolean;
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

/**
 * 正文读取的两枚数值旗标:未给 ⇒ null(交 history-read-ops 的默认档,不在这里替它拍数);
 * 给了但非正整数 ⇒ 当场报错,不把脏值送进共享层的夹取。
 * 报错文案 ASCII:理由与 history-read-ops 头注同档(apps/cli/src 的中文棘轮,§19)。
 */
function parseHistoryFlag(v: string | undefined, flagName: string): number | null {
  if (v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${flagName} must be a positive integer, got "${v}"`);
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

// ==================== history 正文(turn 分片读取)====================

/**
 * `ihui chat history <conversationId>` 的唯一读取出口 —— 也就是
 * `./history-read-ops.ts` 在生产面上的挂载点(2026-10-21 装车)。
 *
 * 立项理由(AGENTS §0.9「判据必须在真跑它的那一刻才成立」):该模块 2026-09-27 落地,
 * 三个投影调用点(:327/:328)都在 HEAD 上,共享层那条"装车锁"41/41 绿 —— 但它只读
 * 文件文本,判不出"模块无人挂载":全 apps/cli 内 `history-read-ops` 的 importer
 * 只有测试与一条注释,`ihui chat history` 走的是 /api/chat/conversations 另一条路径。
 * 能力躺在库里而没有任何入口会走到它,正是那条锁想拦而结构上拦不到的形态。
 *
 * 本函数**不含任何分页算术**:limit 夹取、游标回传、整轮替换、边界推导、断点存续性
 * 全部留在 history-read-ops → `@ihui/shared/chat`(§0.6 单一真相源)。这里只做三件事:
 * 注入 api-client 的基址与 token、排"全量读 → 断点续读"的顺序、原样打印模块自己的计量行。
 */
async function readHistoryForConversation(
  conversationId: string,
  opts: HistoryOptions,
  baseUrl: string,
  apiKey: string,
): Promise<void> {
  setBaseUrl(baseUrl);
  // 凭据续期单点:`ihui chat history` 读长会话正文时 token 可能已经过期
  registerCliTokenProvider({ baseUrl, startupToken: apiKey });

  const turnsPerPage = parseHistoryFlag(opts.turnsPerPage, '--turns-per-page');
  const maxPages = parseHistoryFlag(opts.maxPages, '--max-pages');
  const budget = {
    ...(turnsPerPage !== null ? { turnsPerPage } : {}),
    ...(maxPages !== null ? { maxPages } : {}),
  };

  const initial = await readConversationHistory({ conversationId, ...budget });
  const resumed = opts.replayCheck
    ? await resumeConversationHistory({ conversationId, ...budget, previous: initial })
    : null;

  if (opts.json) {
    printJson({
      conversationId,
      initial: historyOutcomeJson(initial),
      ...(resumed
        ? {
            resumed: historyOutcomeJson(resumed),
            total: addHistoryTally(initial.tally, resumed.tally),
            replayCheck: formatHistoryReplayCheckLine(resumed.tally, initial.tally).line,
          }
        : {}),
    });
  } else {
    printHistoryOutcome(initial, 'initial');
    if (resumed) {
      printHistoryOutcome(resumed, 'resume');
      console.info(chalk.dim(formatHistoryReplayCheckLine(resumed.tally, initial.tally).line));
      console.info(
        chalk.dim(formatHistoryTallyLine('total', addHistoryTally(initial.tally, resumed.tally))),
      );
    }
  }

  if (!initial.ok) {
    process.exitCode = 1;
    return;
  }
  if (resumed && !resumed.ok) {
    process.exitCode = 1;
  }
}

/** 人读档:逐页计量 → 时间线 → 单行汇总。字符串一律来自 history-read-ops 的格式化出口。 */
function printHistoryOutcome(outcome: HistoryReadOutcome, label: string): void {
  for (let i = 0; i < outcome.perPage.length; i += 1) {
    const page = outcome.perPage[i];
    if (page) console.info(chalk.dim(formatHistoryPageLine(i, page)));
  }
  console.info(chalk.dim(formatHistoryTallyLine(label, outcome.tally)));
  for (const turn of outcome.projection.turns) {
    for (const m of turn.messages) {
      console.info(
        `${chalk.cyan(String(turn.turnOrdinal))} ${chalk.dim(`${m.role}:`)} ${truncate(
          m.content.replace(/\s+/g, ' '),
          TEXT_TRUNCATE_LEN,
        )}`,
      );
    }
  }
  console.info(chalk.dim(formatHistorySummaryLine(outcome)));
}

/**
 * `--json` 载荷:投影结果 + 计量 + 服务端断点原样透传。
 * `resumeCursor` 经模块唯一出口 `historyResumeCursor` 取(命令侧不得自己拼 base64url)。
 */
function historyOutcomeJson(outcome: HistoryReadOutcome): Record<string, unknown> {
  return {
    ok: outcome.ok,
    stop: outcome.stop,
    error: outcome.error,
    status: outcome.status,
    tally: outcome.tally,
    perPage: outcome.perPage,
    cursorState: outcome.cursorState,
    boundary: outcome.projection.boundary,
    droppedUnordained: outcome.projection.droppedUnordained,
    replacedTurns: outcome.projection.replacedTurns,
    resumeCursor: historyResumeCursor(outcome.projectionState),
    projectionState: outcome.projectionState,
    turns: outcome.projection.turns,
  };
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
    .command('history [conversationId]')
    .description('历史会话列表 (对标 Web 端 /chat/history); 带 [conversationId] 时读取该会话的 turn 分片历史')
    .option('--page <n>', '页码(从 1 开始)', '1')
    .option(
      '--turns-per-page <n>',
      `Turns per page, clamped by the shared history limit (server max ${HISTORY_TURNS_PER_PAGE_MAX})`,
    )
    .option('--max-pages <n>', `Max pages to walk in one read (default ${HISTORY_MAX_PAGES_DEFAULT})`)
    .option(
      '--replay-check',
      'After the full read, re-read only what follows the server rollout breakpoint and print the byte-saved check',
    )
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (conversationId: string | undefined, opts: HistoryOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = getRootOpts(chatCmd);
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          console.error(chalk.red(missingTokenHint(baseUrl)));
          process.exitCode = 1;
          return;
        }
        // 给了会话 id ⇒ 正文这条链一律走 history-read-ops(投影与分页算术不在本文件,§0.6);
        // 未给 id ⇒ 沿用会话列表与 --page 语义,一个字节都不改。
        if (conversationId) {
          await readHistoryForConversation(conversationId, opts, baseUrl, apiKey);
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
          console.error(chalk.red(missingTokenHint(baseUrl)));
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
          console.error(chalk.red(missingTokenHint(baseUrl)));
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
          console.error(chalk.red(missingTokenHint(baseUrl)));
          process.exitCode = 1;
          return;
        }
        await showSettings(baseUrl, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('chat settings', err);
      }
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
