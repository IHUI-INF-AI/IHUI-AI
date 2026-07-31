/**
 * Models CLI — 模型市场与管理命令,对标 Web 端 /models 10+ 页功能(模型列表/密钥/用量/账单/分组)。
 *
 * 对接后端多模块(因 Web 端 /models 跨多个 API 域):
 *  - GET /api/llm/models              → { models: [{ id, name, provider, context_length, input_price }] }(LLM 网关可用模型,代理 ai-service)
 *  - GET /api/v2/user/llm-providers   → { groups: [{ group, groupLabel, providers: [...] }], total }(用户 LLM 配置中心 v2,含 hasApiKey / usage30d*)
 *  - GET /api/v2/user/llm-groups      → { list: [{ id, label, sort_order, ... }], total }(用户模型分组)
 *  - GET /api/plans                   → { plans: [...] }(公开订阅方案)
 *
 * 类型契约:响应数据形态与 apps/api/src/routes/{llm-models,user-llm-configs-v2,billing}.ts 对齐。
 * 实现模板复用 memory.ts 的 resolveBaseUrl / resolveApiKeyAsync / apiRequest / extractData / handleError。
 *
 * 用法:
 *   ihui models list [--provider <p>] [--json]    可用模型列表(可按厂商过滤)
 *   ihui models keys [--json]                     API 密钥管理(列出已配置的 provider)
 *   ihui models usage [--json]                    用量统计(汇总 30 天 tokens / 费用)
 *   ihui models billing [--json]                  账单(订阅方案列表)
 *   ihui models groups [--json]                   模型分组(用户自定义分组)
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { loadSettings } from './settings.js';
import { ensureFreshAccessToken } from './token-manager.js';

const DEFAULT_TIMEOUT_MS = 30_000;

// === 请求 / 响应类型(与后端路由源码对齐) ===

/** GET /api/llm/models 数据条目 */
interface LlmModel {
  id: string;
  name: string;
  provider: string;
  context_length: number;
  input_price: number;
}

interface LlmModelsData {
  models: LlmModel[];
}

/** GET /api/v2/user/llm-providers 中单个 provider(字段取自 user-llm-configs-v2.ts select) */
interface LlmProvider {
  id: number;
  name: string;
  providerCode: string;
  isBuiltin: boolean;
  baseUrl: string | null;
  apiFormat: string | null;
  enabled: boolean;
  description: string | null;
  providerGroup: string | null;
  groupLabel: string | null;
  usage30dTokens: number | null;
  usage30dCostCents: number | null;
  hasApiKey: boolean;
  lastTestStatus: string | null;
  lastTestedAt: string | null;
  createdAt: string | null;
  models: unknown[];
}

interface LlmProviderGroupEntry {
  group: string;
  groupLabel: string;
  providers: LlmProvider[];
}

interface LlmProvidersData {
  groups: LlmProviderGroupEntry[];
  total: number;
}

/** GET /api/v2/user/llm-groups 条目(原始字段为 snake_case,与后端 raw SQL 一致) */
interface LlmGroup {
  id: number;
  label: string;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

interface LlmGroupsData {
  list: LlmGroup[];
  total: number;
}

/** GET /api/plans 条目(字段宽松,只取展示所需) */
interface BillingPlan {
  id: string;
  name: string;
  price?: number;
  isActive?: boolean;
  sortOrder?: number;
}

interface BillingPlansData {
  plans: BillingPlan[];
}

// === CLI options 类型 ===

interface ListOptions {
  provider?: string;
  json?: boolean;
}

interface CommonOptions {
  json?: boolean;
}

// === 解析工具(复用 memory.ts / capabilities.ts 模式) ===

/**
 * 解析 baseUrl:CLI flag > settings.json > 默认值 http://localhost:8802(api 端口)。
 * 注:多 API 前缀场景(/api/llm / /api/v2/user / /api),不设全局 API_PREFIX,
 *     改为由调用方传完整路径给 apiRequest。
 */
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

/**
 * 远程 HTTP 调用(Node 20+ 内置 fetch)。path 须为完整路径(如 /api/llm/models)。
 * 失败抛错,由调用方 try/catch 输出友好错误。
 */
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

/** 提取标准 API 响应 { code, message, data } 的 data 字段;非标准格式原样返回。 */
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isLlmModel(v: unknown): v is LlmModel {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.provider === 'string' &&
    typeof v.context_length === 'number' &&
    typeof v.input_price === 'number'
  );
}

function isLlmModelsData(v: unknown): v is LlmModelsData {
  return isRecord(v) && Array.isArray(v.models) && v.models.every(isLlmModel);
}

function isLlmProvider(v: unknown): v is LlmProvider {
  return (
    isRecord(v) &&
    typeof v.id === 'number' &&
    typeof v.name === 'string' &&
    typeof v.providerCode === 'string' &&
    typeof v.enabled === 'boolean' &&
    typeof v.hasApiKey === 'boolean'
  );
}

function isLlmProvidersData(v: unknown): v is LlmProvidersData {
  return (
    isRecord(v) &&
    Array.isArray(v.groups) &&
    v.groups.every(
      (g) =>
        isRecord(g) &&
        typeof g.group === 'string' &&
        typeof g.groupLabel === 'string' &&
        Array.isArray(g.providers) &&
        g.providers.every(isLlmProvider),
    )
  );
}

function isLlmGroup(v: unknown): v is LlmGroup {
  return (
    isRecord(v) &&
    typeof v.id === 'number' &&
    typeof v.label === 'string' &&
    typeof v.sort_order === 'number'
  );
}

function isLlmGroupsData(v: unknown): v is LlmGroupsData {
  return isRecord(v) && Array.isArray(v.list) && v.list.every(isLlmGroup);
}

function isBillingPlan(v: unknown): v is BillingPlan {
  return isRecord(v) && typeof v.id !== 'undefined' && typeof v.name === 'string';
}

function isBillingPlansData(v: unknown): v is BillingPlansData {
  return isRecord(v) && Array.isArray(v.plans) && v.plans.every(isBillingPlan);
}

// === 显示工具 ===

/** context_length → 可读字符串(128000 → "128K") */
function formatContext(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/** input_price(USD / 百万 tokens)→ 可读字符串(0 → "免费",2.5 → "$2.50") */
function formatPrice(n: number): string {
  if (n === 0) return chalk.green('免费');
  return `$${n.toFixed(2)}`;
}

/** 分(cent)→ 元字符串(1250 → "¥12.50") */
function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

/** tokens → 可读字符串(2840000 → "2.84M") */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ==================== list ====================

async function listModels(
  baseUrl: string,
  providerFilter: string | undefined,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const resp = await apiRequest(baseUrl, '/api/llm/models', { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isLlmModelsData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 models 字段'));
    process.exitCode = 1;
    return;
  }

  let models = data.models;
  if (providerFilter) {
    const lower = providerFilter.toLowerCase();
    models = models.filter((m) => m.provider.toLowerCase() === lower);
    if (models.length === 0) {
      console.error(chalk.yellow(`✗ 未找到 provider="${providerFilter}" 的模型`));
      process.exitCode = 1;
      return;
    }
  }

  console.info('');
  for (const m of models) {
    const price = formatPrice(m.input_price);
    const ctx = formatContext(m.context_length);
    console.info(
      `${chalk.cyan(m.id.padEnd(36).slice(0, 36))} ${chalk.bold(m.name)} ${chalk.dim(m.provider)} ${chalk.dim(ctx)} ${price}`,
    );
  }
  console.info(chalk.dim(`\n共 ${models.length} 个模型`));
}

// ==================== keys ====================

async function listKeys(baseUrl: string, asJson: boolean, apiKey?: string): Promise<void> {
  const resp = await apiRequest(baseUrl, '/api/v2/user/llm-providers', { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isLlmProvidersData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 groups 字段'));
    process.exitCode = 1;
    return;
  }

  const allProviders: LlmProvider[] = [];
  for (const g of data.groups) {
    allProviders.push(...g.providers);
  }

  if (allProviders.length === 0) {
    console.info(chalk.dim('(暂未配置任何 LLM provider,请先在 Web 端 /models/keys 添加)'));
    return;
  }

  console.info('');
  for (const p of allProviders) {
    const keyBadge = p.hasApiKey ? chalk.green('✓ 已配置') : chalk.dim('✗ 无 Key');
    const enabledBadge = p.enabled ? chalk.green('启用') : chalk.dim('禁用');
    const testBadge = p.lastTestStatus
      ? p.lastTestStatus === 'success'
        ? chalk.green(`测试通过`)
        : chalk.red(`测试失败`)
      : chalk.dim('未测试');
    console.info(
      `[${chalk.cyan(String(p.id))}] ${chalk.bold(p.name)} ${chalk.dim(p.providerCode)} ${keyBadge} ${enabledBadge} ${testBadge}`,
    );
  }
  const withKey = allProviders.filter((p) => p.hasApiKey).length;
  console.info(chalk.dim(`\n共 ${allProviders.length} 个 provider,其中 ${withKey} 个已配置 API Key`));
}

// ==================== usage ====================

async function listUsage(baseUrl: string, asJson: boolean, apiKey?: string): Promise<void> {
  const resp = await apiRequest(baseUrl, '/api/v2/user/llm-providers', { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isLlmProvidersData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 groups 字段'));
    process.exitCode = 1;
    return;
  }

  const allProviders: LlmProvider[] = [];
  for (const g of data.groups) {
    allProviders.push(...g.providers);
  }

  if (allProviders.length === 0) {
    console.info(chalk.dim('(暂无用量数据,请先配置 LLM provider)'));
    return;
  }

  // 汇总 30 天 tokens / 费用
  let totalTokens = 0;
  let totalCostCents = 0;
  console.info('');
  console.info(chalk.bold('近 30 天用量(按 provider 汇总)'));
  console.info('');
  for (const p of allProviders) {
    const tokens = p.usage30dTokens ?? 0;
    const cost = p.usage30dCostCents ?? 0;
    totalTokens += tokens;
    totalCostCents += cost;
    if (tokens === 0 && cost === 0) continue;
    console.info(
      `${chalk.bold(p.name.padEnd(24).slice(0, 24))} ${chalk.dim(p.providerCode)}  tokens: ${formatTokens(tokens)}  cost: ${formatCents(cost)}`,
    );
  }
  console.info('');
  console.info(
    chalk.dim(`合计: ${formatTokens(totalTokens)} tokens · ${formatCents(totalCostCents)}(30 天)`),
  );
}

// ==================== billing ====================

async function listBilling(baseUrl: string, asJson: boolean, apiKey?: string): Promise<void> {
  // /api/plans 为公开接口,但附带 apiKey 无副作用
  const resp = await apiRequest(baseUrl, '/api/plans', { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isBillingPlansData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 plans 字段'));
    process.exitCode = 1;
    return;
  }

  if (data.plans.length === 0) {
    console.info(chalk.dim('(暂无订阅方案)'));
    return;
  }

  console.info('');
  for (const p of data.plans) {
    const price =
      typeof p.price === 'number'
        ? p.price === 0
          ? chalk.green('免费')
          : `¥${p.price.toFixed(2)}`
        : chalk.dim('-');
    const active = p.isActive === false ? chalk.dim('(已下架)') : '';
    console.info(`[${chalk.cyan(p.id.slice(0, 8))}] ${chalk.bold(p.name)} ${price} ${active}`);
  }
  console.info(chalk.dim(`\n共 ${data.plans.length} 个方案`));
}

// ==================== groups ====================

async function listGroups(baseUrl: string, asJson: boolean, apiKey?: string): Promise<void> {
  const resp = await apiRequest(baseUrl, '/api/v2/user/llm-groups', { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isLlmGroupsData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 list 字段'));
    process.exitCode = 1;
    return;
  }

  if (data.list.length === 0) {
    console.info(chalk.dim('(暂无模型分组,请在 Web 端 /models LLM 配置中心创建)'));
    return;
  }

  console.info('');
  for (const g of data.list) {
    console.info(
      `[${chalk.cyan(String(g.id))}] ${chalk.bold(g.label)} ${chalk.dim(`sort=${g.sort_order}`)}`,
    );
  }
  console.info(chalk.dim(`\n共 ${data.total} 个分组`));
}

// ==================== 命令注册 ====================

/**
 * 在根 program 上注册 `models` 命令组。
 * 使用全局 `--api-url` / `--api-key` 或 settings.json 解析后端地址。
 */
export function registerModelsCommand(program: Command): void {
  const modelsCmd = program
    .command('models')
    .description('模型市场与管理 (对标 Web 端 /models)');

  modelsCmd
    .command('list')
    .description('列出可用模型 (LLM 网关)')
    .option('--provider <p>', '按厂商过滤 (如 openai / anthropic / deepseek)')
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
        await listModels(baseUrl, opts.provider, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('models list', err);
      }
    });

  modelsCmd
    .command('keys')
    .description('API 密钥管理 (列出已配置的 LLM provider)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: CommonOptions) => {
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
        await listKeys(baseUrl, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('models keys', err);
      }
    });

  modelsCmd
    .command('usage')
    .description('用量统计 (近 30 天 tokens / 费用)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: CommonOptions) => {
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
        await listUsage(baseUrl, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('models usage', err);
      }
    });

  modelsCmd
    .command('billing')
    .description('账单 (订阅方案列表)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: CommonOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        // /api/plans 公开接口,apiKey 可选(附上无副作用,未登录也能用)
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        await listBilling(baseUrl, Boolean(opts.json), apiKey ?? undefined);
      } catch (err) {
        handleError('models billing', err);
      }
    });

  modelsCmd
    .command('groups')
    .description('模型分组 (用户自定义分组)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: CommonOptions) => {
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
        await listGroups(baseUrl, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('models groups', err);
      }
    });
}
