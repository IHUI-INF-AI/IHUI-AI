/**
 * Developer & Playground CLI — 开发者平台与在线测试命令,对标 Web 端 /developer 与 /playground。
 *
 * developer 命令对接 apps/api/src/routes/developer-relay.ts(/api/developer/relay/*,JWT Bearer 鉴权):
 *  - GET /api/developer/relay/keys  → { list: DeveloperKeyInfo[] }(含余额/安全字段)
 *  - GET /api/developer/relay/logs  → { list: DeveloperLogItem[], total, page, pageSize }
 *  - GET /api/developer/team        → TeamMember[](对标 Web 端 /developer/team,可能为 stub)
 *
 * playground 命令对接 apps/api/src/routes/v1-public.ts(/v1/*,API Key Bearer 鉴权):
 *  - POST /v1/chat/completions  OpenAI 兼容格式,非流式
 *
 * 类型契约:V1ChatCompletionResponse / ApiKeyStatus 来自 @ihui/types(api-key.ts)。
 * 实现模板复用 memory.ts 的 resolveBaseUrl / resolveApiKeyAsync / extractData / handleError。
 *
 * 用法:
 *   ihui developer keys [--json]
 *   ihui developer logs [--page <n>] [--json]
 *   ihui developer team [--json]
 *   ihui playground run --prompt <p> [--model <m>] [--temperature <n>] [--max-tokens <n>] [--api-key <k>] [--json]
 *   ihui playground compare --prompt <p> --models <m1,m2>[,m3...] [--api-key <k>] [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { loadSettings } from './settings.js';
import { ensureFreshAccessToken } from './token-manager.js';
import type { V1ChatCompletionResponse, ApiKeyStatus } from '@ihui/types';

const DEFAULT_TIMEOUT_MS = 60_000; // playground 调用可能较慢,放宽到 60s
const LOGS_PAGE_SIZE = 20;
const TEXT_TRUNCATE_LEN = 80;
const DEFAULT_PLAYGROUND_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;

// === 后端响应类型(本地定义,与 developer-relay.ts / web 端 types.ts 对齐) ===

/** 开发者 API Key 列表项(GET /api/developer/relay/keys 返回的 row)。 */
interface DeveloperKeyInfo {
  id: string;
  name: string;
  /** 公开标识 ihui_xxx。 */
  key: string;
  permissions: string[];
  status: ApiKeyStatus;
  rateLimit: number;
  tokenBalance: number;
  costBalanceCents: number;
  tokenUsedTotal: number;
  costUsedTotalCents: number;
  expiresAt: string | null;
  allowedIps: string[] | null;
  allowedModels: string[] | null;
  maxTokensPerReq: number | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeveloperKeysData {
  list: DeveloperKeyInfo[];
}

/** 调用日志列表项(GET /api/developer/relay/logs 返回的 row)。 */
interface DeveloperLogItem {
  id: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  status: string;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: string;
  apiKeyId: string | null;
  providerCode: string | null;
  clientIp: string | null;
  costCents: number | null;
  httpStatus: number | null;
  ttftMs: number | null;
}

interface DeveloperLogsData {
  list: DeveloperLogItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 团队成员(对标 Web 端 developer/team/types.ts TeamMember)。 */
interface TeamMember {
  id: string;
  nickname: string;
  avatar?: string;
  email: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  joinedAt: string;
}

/** playground compare 单模型结果。 */
interface CompareResult {
  model: string;
  response: V1ChatCompletionResponse | null;
  error: string | null;
  latencyMs: number;
}

// === CLI options 类型 ===

interface KeysOptions {
  json?: boolean;
}

interface LogsOptions {
  page?: string;
  json?: boolean;
}

interface TeamOptions {
  json?: boolean;
}

interface RunOptions {
  prompt: string;
  model?: string;
  temperature?: string;
  maxTokens?: string;
  apiKey?: string;
  json?: boolean;
}

interface CompareOptions {
  apiKey?: string;
  json?: boolean;
}

// === 解析工具(复用 memory.ts / capabilities.ts 模式) ===

/** 解析 baseUrl:CLI flag > settings.json > 默认值 http://localhost:8802(api 端口)。 */
function resolveBaseUrl(cliApiUrl: unknown): string {
  if (typeof cliApiUrl === 'string' && cliApiUrl) return cliApiUrl.replace(/\/+$/, '');
  const settings = loadSettings();
  const url = settings.apiUrl || process.env.IHUI_API_URL || 'http://localhost:8802';
  return url.replace(/\/+$/, '');
}

/**
 * 解析 JWT:CLI flag > 自动 refresh 续期(settings.refreshToken)。
 * 返回 null 表示无 token / refresh 失败,调用方应提示用户 `ihui login`。
 */
async function resolveJwtAsync(
  cliApiKey: unknown,
  baseUrl: string,
): Promise<string | null> {
  if (typeof cliApiKey === 'string' && cliApiKey) return cliApiKey;
  return ensureFreshAccessToken(baseUrl);
}

/** 远程 HTTP 调用(Node 20+ 内置 fetch)。失败抛错,由调用方 try/catch 输出友好错误。 */
async function httpJson(
  baseUrl: string,
  fullPath: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: unknown;
    timeoutMs?: number;
    bearer?: string;
  } = {},
): Promise<unknown> {
  const url = `${baseUrl.replace(/\/$/, '')}${fullPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.bearer) {
      headers.Authorization = `Bearer ${options.bearer}`;
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

/**
 * 提取标准 API 响应 { code, message, data } 的 data 字段;非标准格式原样返回。
 * /v1/* OpenAI 兼容响应(无 code/message 包装)原样返回。
 */
function extractData(resp: unknown): unknown {
  if (
    resp &&
    typeof resp === 'object' &&
    'data' in resp &&
    ('code' in resp || 'message' in resp)
  ) {
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
    console.error(
      chalk.dim('  请确认 API 服务已启动:pnpm --filter @ihui/api dev(默认 http://localhost:8802)'),
    );
  }
  process.exitCode = 1;
}

// === 类型守卫 ===

function isDeveloperKeyInfo(v: unknown): v is DeveloperKeyInfo {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'name' in v &&
    'key' in v
  );
}

function isDeveloperKeysData(v: unknown): v is DeveloperKeysData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'list' in v &&
    Array.isArray((v as { list: unknown }).list)
  );
}

function isDeveloperLogItem(v: unknown): v is DeveloperLogItem {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'model' in v &&
    'createdAt' in v
  );
}

function isDeveloperLogsData(v: unknown): v is DeveloperLogsData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'list' in v &&
    Array.isArray((v as { list: unknown }).list) &&
    'total' in v
  );
}

function isTeamMember(v: unknown): v is TeamMember {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'email' in v &&
    'role' in v
  );
}

function isTeamMemberArray(v: unknown): v is TeamMember[] {
  return Array.isArray(v) && v.every(isTeamMember);
}

function isV1ChatCompletionResponse(v: unknown): v is V1ChatCompletionResponse {
  return (
    typeof v === 'object' &&
    v !== null &&
    'choices' in v &&
    Array.isArray((v as { choices: unknown }).choices) &&
    'usage' in v
  );
}

// === 参数解析工具 ===

/** 解析逗号分隔的模型列表。 */
function parseModelsCsv(modelsCsv: string): string[] {
  return modelsCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 将 commander 字符串选项解析为有限数字,失败抛错。 */
function parseNumber(v: string | undefined, fallback: number, label: string): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`无效的 ${label} "${v}",需为数字`);
  }
  return n;
}

/** 格式化日期(对标 AGENTS.md §4 Intl.DateTimeFormat)。 */
function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** 提取 OpenAI 响应中的 assistant 文本。 */
function extractAssistantContent(resp: V1ChatCompletionResponse): string {
  const choice = resp.choices[0];
  return choice?.message?.content ?? '';
}

// ==================== developer keys ====================

async function listKeys(
  baseUrl: string,
  asJson: boolean,
  jwt: string,
): Promise<void> {
  const resp = await httpJson(baseUrl, '/api/developer/relay/keys', { bearer: jwt });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isDeveloperKeysData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 list 字段'));
    process.exitCode = 1;
    return;
  }

  const keys = data.list.filter(isDeveloperKeyInfo);
  if (keys.length === 0) {
    console.info(chalk.dim('(暂无 API 密钥,请到 Web 端 /developer/keys 创建)'));
    return;
  }

  console.info('');
  for (const k of keys) {
    const statusMark = k.status === 'active' ? chalk.green('●') : chalk.red('●');
    const balance = `${k.tokenBalance} tokens / ${(k.costBalanceCents / 100).toFixed(2)} 元`;
    console.info(
      `${statusMark} [${chalk.cyan(k.id.slice(0, 8))}] ${chalk.bold(k.name)} ${chalk.dim(k.key)}`,
    );
    console.info(
      chalk.dim(`    余额:${balance} · 限流:${k.rateLimit}/min · 创建:${formatDate(k.createdAt)}`),
    );
  }
  console.info(chalk.dim(`\n共 ${keys.length} 个密钥`));
}

// ==================== developer logs ====================

async function listLogs(
  baseUrl: string,
  page: number,
  asJson: boolean,
  jwt: string,
): Promise<void> {
  const qs = `?page=${page}&pageSize=${LOGS_PAGE_SIZE}`;
  const resp = await httpJson(baseUrl, `/api/developer/relay/logs${qs}`, { bearer: jwt });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isDeveloperLogsData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 list 字段'));
    process.exitCode = 1;
    return;
  }

  const logs = data.list.filter(isDeveloperLogItem);
  const total = typeof data.total === 'number' ? data.total : logs.length;

  if (logs.length === 0) {
    console.info(chalk.dim('(暂无调用日志)'));
    return;
  }

  console.info('');
  for (const log of logs) {
    const statusMark =
      log.status === 'success' ? chalk.green('✓') : chalk.red('✗');
    const costStr = log.costCents !== null ? `${(log.costCents / 100).toFixed(4)} 元` : '-';
    console.info(
      `${statusMark} [${chalk.cyan(log.id.slice(0, 8))}] ${chalk.bold(log.model)} ${log.latencyMs}ms · ${log.totalTokens} tokens · ${costStr}`,
    );
    const errSnippet = log.errorMessage
      ? ` ${chalk.red(log.errorMessage.slice(0, TEXT_TRUNCATE_LEN))}`
      : '';
    console.info(
      chalk.dim(`    ${formatDate(log.createdAt)} · ${log.providerCode ?? '-'}${errSnippet}`),
    );
  }
  const totalPages = Math.max(1, Math.ceil(total / LOGS_PAGE_SIZE));
  console.info(chalk.dim(`\n第 ${page}/${totalPages} 页,共 ${total} 条日志`));
}

// ==================== developer team ====================

async function listTeam(
  baseUrl: string,
  asJson: boolean,
  jwt: string,
): Promise<void> {
  let resp: unknown;
  try {
    resp = await httpJson(baseUrl, '/api/developer/team', { bearer: jwt });
  } catch {
    // GET /api/developer/team 可能未实现(stub),对标 Web 端 .catch(() => []) 容错
    if (asJson) {
      printJson({ code: 0, message: 'ok', data: [] });
      return;
    }
    console.info(chalk.dim('(团队接口暂未开放或无成员)'));
    return;
  }

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  const members = isTeamMemberArray(data)
    ? data
    : isDeveloperKeysData(data) && isTeamMemberArray(data.list)
      ? (data.list as unknown as TeamMember[])
      : [];

  if (members.length === 0) {
    console.info(chalk.dim('(暂无团队成员)'));
    return;
  }

  console.info('');
  for (const m of members) {
    const roleLabel: Record<TeamMember['role'], string> = {
      owner: chalk.magenta('所有者'),
      admin: chalk.yellow('管理员'),
      developer: chalk.green('开发者'),
      viewer: chalk.dim('观察者'),
    };
    console.info(
      `[${chalk.cyan(m.id.slice(0, 8))}] ${chalk.bold(m.nickname)} ${roleLabel[m.role] ?? m.role}`,
    );
    console.info(chalk.dim(`    ${m.email} · 加入:${formatDate(m.joinedAt)}`));
  }
  console.info(chalk.dim(`\n共 ${members.length} 名成员`));
}

// ==================== playground 工具 ====================

/**
 * 解析 playground 调用所需的 API Key(ihui_xxx):
 * 1. CLI --api-key 显式指定
 * 2. 自动从 /api/developer/relay/keys 取第一个 active key 的 key 字段
 * 返回 null 表示无可用 Key,调用方应提示用户创建。
 */
async function resolvePlaygroundApiKey(
  cliApiKey: unknown,
  baseUrl: string,
  jwt: string,
): Promise<string | null> {
  if (typeof cliApiKey === 'string' && cliApiKey) return cliApiKey;
  const resp = await httpJson(baseUrl, '/api/developer/relay/keys', { bearer: jwt });
  const data = extractData(resp);
  if (isDeveloperKeysData(data)) {
    const keys = data.list.filter(isDeveloperKeyInfo);
    const active = keys.find((k) => k.status === 'active') ?? keys[0];
    if (active) return active.key;
  }
  return null;
}

/** 调用单次 /v1/chat/completions(非流式),返回 OpenAI 兼容响应。 */
async function callChatCompletions(
  baseUrl: string,
  apiKey: string,
  prompt: string,
  model: string,
  temperature: number,
  maxTokens: number,
): Promise<{ resp: V1ChatCompletionResponse; latencyMs: number }> {
  const startTime = Date.now();
  const body = {
    model,
    messages: [{ role: 'user' as const, content: prompt }],
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };
  const raw = await httpJson(baseUrl, '/v1/chat/completions', {
    method: 'POST',
    body,
    bearer: apiKey,
  });
  const latencyMs = Date.now() - startTime;
  if (!isV1ChatCompletionResponse(raw)) {
    throw new Error('响应格式异常,缺少 choices/usage 字段');
  }
  return { resp: raw, latencyMs };
}

// ==================== playground run ====================

async function runPlayground(
  baseUrl: string,
  prompt: string,
  opts: RunOptions,
  asJson: boolean,
  jwt: string,
): Promise<void> {
  const apiKey = await resolvePlaygroundApiKey(opts.apiKey, baseUrl, jwt);
  if (!apiKey) {
    console.error(
      chalk.red('✗ 未找到可用的 API Key,请先到 Web 端 /developer/keys 创建,或用 --api-key 指定'),
    );
    process.exitCode = 1;
    return;
  }

  const model = opts.model ?? DEFAULT_PLAYGROUND_MODEL;
  const temperature = parseNumber(opts.temperature, DEFAULT_TEMPERATURE, 'temperature');
  const maxTokens = parseNumber(opts.maxTokens, DEFAULT_MAX_TOKENS, 'max-tokens');

  const { resp, latencyMs } = await callChatCompletions(
    baseUrl,
    apiKey,
    prompt,
    model,
    temperature,
    maxTokens,
  );

  if (asJson) {
    printJson(resp);
    return;
  }

  const content = extractAssistantContent(resp);
  const usage = resp.usage;
  console.info(chalk.bold(`\n模型:${resp.model ?? model}`));
  console.info(chalk.dim(`耗时:${latencyMs}ms · tokens:${usage.total_tokens}(prompt ${usage.prompt_tokens} + completion ${usage.completion_tokens})`));
  console.info('');
  console.info(content);
}

// ==================== playground compare ====================

async function comparePlayground(
  baseUrl: string,
  prompt: string,
  models: string[],
  opts: CompareOptions,
  asJson: boolean,
  jwt: string,
): Promise<void> {
  const apiKey = await resolvePlaygroundApiKey(opts.apiKey, baseUrl, jwt);
  if (!apiKey) {
    console.error(
      chalk.red('✗ 未找到可用的 API Key,请先到 Web 端 /developer/keys 创建,或用 --api-key 指定'),
    );
    process.exitCode = 1;
    return;
  }

  // 并行调用所有模型,单个失败不影响其他
  const results = await Promise.allSettled(
    models.map((model) =>
      callChatCompletions(baseUrl, apiKey, prompt, model, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS),
    ),
  );

  // 遍历 results(与 models 等长),逐个映射为 CompareResult
  const compareResults: CompareResult[] = results.map((r, i) => {
    const model = models[i] ?? `model-${i + 1}`;
    if (r.status === 'fulfilled') {
      return { model, response: r.value.resp, error: null, latencyMs: r.value.latencyMs };
    }
    const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
    return { model, response: null, error: errMsg, latencyMs: 0 };
  });

  if (asJson) {
    printJson(compareResults);
    return;
  }

  console.info(chalk.bold(`\n模型对比(${models.length} 个模型)`));
  console.info(chalk.dim('─'.repeat(60)));
  compareResults.forEach((r, i) => {
    const idx = chalk.cyan(`[${i + 1}]`);
    if (r.response) {
      const usage = r.response.usage;
      console.info(
        `${idx} ${chalk.bold(r.response.model ?? r.model)} ${chalk.dim(`(${r.latencyMs}ms, ${usage.total_tokens} tokens)`)}`,
      );
      console.info(extractAssistantContent(r.response));
    } else {
      console.info(`${idx} ${chalk.bold(r.model)} ${chalk.red('✗ 失败')}`);
      console.info(chalk.red(r.error ?? '未知错误'));
    }
    console.info(chalk.dim('─'.repeat(60)));
  });
}

// ==================== 命令注册 ====================

/**
 * 在根 program 上注册 `developer` 命令组(对标 Web 端 /developer)。
 * 使用全局 `--api-url` / `--api-key` 或 settings.json 解析后端地址与 JWT。
 */
export function registerDeveloperCommand(program: Command): void {
  const devCmd = program
    .command('developer')
    .description('开发者平台管理 (对标 Web 端 /developer)');

  devCmd
    .command('keys')
    .description('列出当前用户的 API 密钥(含余额与安全字段)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: KeysOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const jwt = await resolveJwtAsync(cliApiKey, baseUrl);
        if (!jwt) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await listKeys(baseUrl, Boolean(opts.json), jwt);
      } catch (err) {
        handleError('developer keys', err);
      }
    });

  devCmd
    .command('logs')
    .description('查询 API 调用日志(分页)')
    .option('--page <n>', '页码(从 1 开始)', '1')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: LogsOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const jwt = await resolveJwtAsync(cliApiKey, baseUrl);
        if (!jwt) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        const page = parseNumber(opts.page, 1, 'page');
        if (page < 1) {
          throw new Error('页码必须 >= 1');
        }
        await listLogs(baseUrl, Math.floor(page), Boolean(opts.json), jwt);
      } catch (err) {
        handleError('developer logs', err);
      }
    });

  devCmd
    .command('team')
    .description('查看团队成员列表 (对标 Web 端 /developer/team)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: TeamOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const jwt = await resolveJwtAsync(cliApiKey, baseUrl);
        if (!jwt) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await listTeam(baseUrl, Boolean(opts.json), jwt);
      } catch (err) {
        handleError('developer team', err);
      }
    });
}

/**
 * 在根 program 上注册 `playground` 命令组(对标 Web 端 /playground)。
 * 使用用户 API Key(ihui_xxx)调用 /v1/chat/completions,支持 --api-key 显式指定或自动取首个 active Key。
 */
export function registerPlaygroundCommand(program: Command): void {
  const pgCmd = program
    .command('playground')
    .description('在线测试 OpenAI 兼容 API (对标 Web 端 /playground)');

  pgCmd
    .command('run')
    .description('用指定 prompt 调用 /v1/chat/completions(非流式)')
    .requiredOption('--prompt <p>', '用户 prompt 文本')
    .option('--model <m>', `模型名(默认 ${DEFAULT_PLAYGROUND_MODEL})`)
    .option('--temperature <n>', '采样温度 0-2', String(DEFAULT_TEMPERATURE))
    .option('--max-tokens <n>', '最大生成 token 数', String(DEFAULT_MAX_TOKENS))
    .option('--api-key <k>', 'API Key(ihui_xxx,不传则自动取首个 active Key)')
    .option('--json', '以 JSON 格式输出完整 OpenAI 响应')
    .action(async (opts: RunOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const jwt = await resolveJwtAsync(cliApiKey, baseUrl);
        if (!jwt) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        await runPlayground(baseUrl, opts.prompt, opts, Boolean(opts.json), jwt);
      } catch (err) {
        handleError('playground run', err);
      }
    });

  pgCmd
    .command('compare')
    .description('同一 prompt 对比多个模型的输出(并行调用)')
    .requiredOption('--prompt <p>', '用户 prompt 文本')
    .requiredOption('--models <csv>', '模型列表,逗号分隔(如 gpt-4o-mini,deepseek-chat)')
    .option('--api-key <k>', 'API Key(ihui_xxx,不传则自动取首个 active Key)')
    .option('--json', '以 JSON 格式输出对比结果数组')
    .action(async (opts: CompareOptions & { prompt: string; models: string }) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const jwt = await resolveJwtAsync(cliApiKey, baseUrl);
        if (!jwt) {
          console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
          process.exitCode = 1;
          return;
        }
        const models = parseModelsCsv(opts.models);
        if (models.length < 2) {
          throw new Error('compare 至少需要 2 个模型,用逗号分隔');
        }
        await comparePlayground(baseUrl, opts.prompt, models, opts, Boolean(opts.json), jwt);
      } catch (err) {
        handleError('playground compare', err);
      }
    });
}
