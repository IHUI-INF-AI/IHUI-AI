/**
 * Memory CLI — 用户记忆系统读写命令,对标 Web 端 /memory 4 页功能(list / add / delete / clear)。
 *
 * 对接后端 apps/api/src/routes/memory.ts(/api/memory 端点,JWT Bearer 鉴权):
 *  - GET    /api/memory?scope=&sessionId=&projectKey=  → { entries, total }
 *  - POST   /api/memory  body: { scope, type, category, text, source?, sessionId?, projectKey? } → MemoryEntry
 *  - DELETE /api/memory/:id?scope=&sessionId=&projectKey= → { id, deleted }
 *
 * 类型契约:MemoryEntry / MemoryScope / MemoryEntryType 来自 @ihui/types(agent-runtime.ts)。
 * 实现模板复用 capabilities.ts 的 resolveBaseUrl / resolveApiKeyAsync / apiRequest / extractData / handleError。
 *
 * 用法:
 *   ihui memory list [--scope <scope>] [--session <id>] [--project <key>] [--json]
 *   ihui memory add <text> --type <type> --category <cat> [--scope <scope>] [--session <id>] [--project <key>] [--source <src>] [--json]
 *   ihui memory delete <id> [--scope <scope>] [--session <id>] [--project <key>] [--json]
 *   ihui memory clear [--scope <scope>] [--session <id>] [--project <key>] [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import type { MemoryEntry, MemoryScope, MemoryEntryType } from '@ihui/types';

import { createApiRequest, extractData, handleError, printJson, resolveApiKeyAsync, resolveBaseUrl } from './http-utils.js';

const API_PREFIX = '/api/memory';
const DEFAULT_TIMEOUT_MS = 30_000;
const apiRequest = createApiRequest(API_PREFIX, DEFAULT_TIMEOUT_MS);
const TEXT_TRUNCATE_LEN = 60;

const SCOPES: readonly MemoryScope[] = ['global', 'user', 'session', 'project'] as const;
const TYPES: readonly MemoryEntryType[] = [
  'preference',
  'convention',
  'decision',
  'fact',
  'feedback',
  'skill_ref',
] as const;

// === 请求 / 响应类型(本地定义,与 Web 端 memory-api.ts 对齐) ===

interface MemoryListQuery {
  scope?: MemoryScope;
  sessionId?: string;
  projectKey?: string;
}

interface MemoryListData {
  entries: MemoryEntry[];
  total: number;
}

interface MemoryCreateInput {
  scope: MemoryScope;
  type: MemoryEntryType;
  category: string;
  text: string;
  source?: string;
  sessionId?: string;
  projectKey?: string;
}

interface MemoryDeleteData {
  id: string;
  deleted: boolean;
}

// === CLI options 类型 ===

interface ListOptions {
  scope?: string;
  session?: string;
  project?: string;
  json?: boolean;
}

interface AddOptions {
  type?: string;
  category?: string;
  scope?: string;
  session?: string;
  project?: string;
  source?: string;
  json?: boolean;
}

interface DeleteOptions {
  scope?: string;
  session?: string;
  project?: string;
  json?: boolean;
}

interface ClearOptions {
  scope?: string;
  session?: string;
  project?: string;
  json?: boolean;
}

// === 类型守卫 ===

function isMemoryScope(v: unknown): v is MemoryScope {
  return typeof v === 'string' && (SCOPES as readonly string[]).includes(v);
}

function isMemoryEntryType(v: unknown): v is MemoryEntryType {
  return typeof v === 'string' && (TYPES as readonly string[]).includes(v);
}

function isMemoryEntry(v: unknown): v is MemoryEntry {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'scope' in v &&
    'type' in v &&
    'category' in v &&
    'text' in v
  );
}

function isMemoryListData(v: unknown): v is MemoryListData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'entries' in v &&
    Array.isArray((v as { entries: unknown }).entries)
  );
}

function isMemoryDeleteData(v: unknown): v is MemoryDeleteData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'deleted' in v
  );
}

// === 参数校验(非法值抛错,由 action try/catch → handleError 处理) ===

function parseScope(v: string | undefined, fallback: MemoryScope): MemoryScope {
  const value = v ?? fallback;
  if (isMemoryScope(value)) return value;
  throw new Error(`无效的 scope "${v ?? ''}",合法值: ${SCOPES.join(' / ')}`);
}

function parseOptionalScope(v: string | undefined): MemoryScope | undefined {
  if (v === undefined) return undefined;
  if (isMemoryScope(v)) return v;
  throw new Error(`无效的 scope "${v}",合法值: ${SCOPES.join(' / ')}`);
}

function parseType(v: string | undefined, fallback: MemoryEntryType): MemoryEntryType {
  const value = v ?? fallback;
  if (isMemoryEntryType(value)) return value;
  throw new Error(`无效的 type "${v ?? ''}",合法值: ${TYPES.join(' / ')}`);
}

// === 查询参数构建 ===

function buildQuery(scope: MemoryScope | undefined, session?: string, project?: string): MemoryListQuery {
  const q: MemoryListQuery = {};
  if (scope) q.scope = scope;
  if (session) q.sessionId = session;
  if (project) q.projectKey = project;
  return q;
}

function buildQueryString(query: MemoryListQuery): string {
  const params = new URLSearchParams();
  if (query.scope) params.set('scope', query.scope);
  if (query.sessionId) params.set('sessionId', query.sessionId);
  if (query.projectKey) params.set('projectKey', query.projectKey);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ==================== list ====================

async function listMemory(
  baseUrl: string,
  query: MemoryListQuery,
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
  if (!isMemoryListData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 entries 字段'));
    process.exitCode = 1;
    return;
  }

  const entries = data.entries.filter(isMemoryEntry);
  const total = typeof data.total === 'number' ? data.total : entries.length;

  if (entries.length === 0) {
    console.info(chalk.dim('(暂无记忆条目)'));
    return;
  }

  console.info('');
  for (const e of entries) {
    const text = (e.text ?? '').slice(0, TEXT_TRUNCATE_LEN);
    console.info(
      `[${chalk.cyan(e.id.slice(0, 8))}] ${chalk.bold(e.scope)} ${chalk.dim(e.type)} ${chalk.dim(e.category)} ${text}`,
    );
  }
  console.info(chalk.dim(`\n共 ${total} 条记忆`));
}

// ==================== add ====================

async function addMemory(
  baseUrl: string,
  text: string,
  opts: AddOptions,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const scope = parseScope(opts.scope, 'session');
  const type = parseType(opts.type, 'fact');
  const category = opts.category ?? '未分类';
  const source = opts.source ?? 'cli';

  const input: MemoryCreateInput = {
    scope,
    type,
    category,
    text,
    source,
  };
  if (opts.session) input.sessionId = opts.session;
  if (opts.project) input.projectKey = opts.project;

  const resp = await apiRequest(baseUrl, '', {
    method: 'POST',
    body: input,
    apiKey,
  });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isMemoryEntry(data)) {
    console.error(chalk.red('✗ 添加失败:响应格式异常'));
    process.exitCode = 1;
    return;
  }
  console.info(
    chalk.green(`✓ 已添加记忆 [scope=${scope} type=${type}] id=${data.id}`),
  );
}

// ==================== delete ====================

async function deleteMemory(
  baseUrl: string,
  id: string,
  query: MemoryListQuery,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const qs = buildQueryString(query);
  const path = `/${encodeURIComponent(id)}${qs}`;
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
        printJson({ code: 404, message: '记忆条目不存在', data: null });
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
  if (isMemoryDeleteData(data) && data.deleted) {
    console.info(chalk.green(`✓ 已删除记忆 id=${data.id}`));
  } else {
    console.error(chalk.red(`✗ 未找到 id=${id}`));
    process.exitCode = 1;
  }
}

// ==================== clear ====================

async function clearMemory(
  baseUrl: string,
  query: MemoryListQuery,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const qs = buildQueryString(query);
  const listResp = await apiRequest(baseUrl, qs, { apiKey });
  const listData = extractData(listResp);
  const entries: MemoryEntry[] = isMemoryListData(listData)
    ? listData.entries.filter(isMemoryEntry)
    : [];

  let cleared = 0;
  for (const e of entries) {
    const delPath = `/${encodeURIComponent(e.id)}${qs}`;
    try {
      const delResp = await apiRequest(baseUrl, delPath, {
        method: 'DELETE',
        apiKey,
      });
      const delData = extractData(delResp);
      if (isMemoryDeleteData(delData) && delData.deleted) cleared++;
    } catch {
      // 单条删除失败继续,不中断批处理
    }
  }

  if (asJson) {
    printJson({ cleared });
    return;
  }
  console.info(chalk.green(`✓ 已清空 ${cleared} 条记忆`));
}

// ==================== 命令注册 ====================

/**
 * 在根 program 上注册 `memory` 命令组。
 * 使用全局 `--api-url` / `--api-key` 或 settings.json 解析后端地址。
 */
export function registerMemoryCommand(program: Command): void {
  const memCmd = program
    .command('memory')
    .description('用户记忆系统读写 (对标 Web 端 /memory)');

  memCmd
    .command('list')
    .description('列出当前用户记忆')
    .option('--scope <scope>', '按作用域过滤 (global/user/session/project)')
    .option('--session <id>', '会话 ID 筛选')
    .option('--project <key>', '项目 key 筛选')
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
        const scope = parseOptionalScope(opts.scope);
        const query = buildQuery(scope, opts.session, opts.project);
        await listMemory(baseUrl, query, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('memory list', err);
      }
    });

  memCmd
    .command('add <text>')
    .description('添加一条记忆')
    .option('--type <type>', '条目类型 (preference/convention/decision/fact/feedback/skill_ref)', 'fact')
    .option('--category <cat>', '分类', '未分类')
    .option('--scope <scope>', '作用域 (global/user/session/project)', 'session')
    .option('--session <id>', '会话 ID')
    .option('--project <key>', '项目 key')
    .option('--source <src>', '来源端标识', 'cli')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (text: string, opts: AddOptions) => {
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
        await addMemory(baseUrl, text, opts, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('memory add', err);
      }
    });

  memCmd
    .command('delete <id>')
    .description('删除指定记忆条目')
    .option('--scope <scope>', '作用域 (global/user/session/project)')
    .option('--session <id>', '会话 ID')
    .option('--project <key>', '项目 key')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (id: string, opts: DeleteOptions) => {
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
        const scope = parseOptionalScope(opts.scope);
        const query = buildQuery(scope, opts.session, opts.project);
        await deleteMemory(baseUrl, id, query, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('memory delete', err);
      }
    });

  memCmd
    .command('clear')
    .description('清空记忆 (批量 list + 循环 delete)')
    .option('--scope <scope>', '作用域 (global/user/session/project)')
    .option('--session <id>', '会话 ID')
    .option('--project <key>', '项目 key')
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
        const scope = parseOptionalScope(opts.scope);
        const query = buildQuery(scope, opts.session, opts.project);
        await clearMemory(baseUrl, query, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('memory clear', err);
      }
    });
}
