/**
 * Knowledge & RAG CLI — 知识库管理与 RAG 检索命令,对标 Web 端 /knowledge-base 和 /knowledge-rag。
 *
 * 对接后端:
 *  - 知识库 apps/api/src/routes/other/knowledge-base-routes.ts(注册前缀 /api):
 *    GET    /api/knowledge-base?page=&pageSize=&search=&categoryId= → { list: KBArticle[], total }
 *    GET    /api/knowledge-base/:id                                → { item: KBArticle }
 *    POST   /api/knowledge-base  body: { title, summary?, content?, ... } → { item }
 *    DELETE /api/knowledge-base/:id(RESTful 约定,后端待补则报错提示)
 *  - RAG apps/api/src/routes/knowledge-rag.ts(注册前缀 /api/knowledge):
 *    POST /api/knowledge/search  body: { query, collectionName, topK, scoreThreshold, ownerUuid } → SearchHit[]
 *    POST /api/knowledge/upload  multipart: { file, title?, collectionName? } → { chunkCount, filename, mimeType }
 *
 * 类型契约:KBArticle / SearchHit / DocSummary 与 Web 端 knowledge-base/page.tsx、knowledge-rag/page.tsx 对齐。
 * 实现模板复用 memory.ts 的 resolveBaseUrl / resolveApiKeyAsync / apiRequest / extractData / handleError。
 *
 * 用法:
 *   ihui knowledge list [--json]
 *   ihui knowledge show <id> [--json]
 *   ihui knowledge create --name <n> [--json]
 *   ihui knowledge delete <id> [--json]
 *   ihui rag search <query> [--kb <id>] [--json]
 *   ihui rag index <file> [--kb <id>] [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { loadSettings } from './settings.js';
import { ensureFreshAccessToken } from './token-manager.js';

const DEFAULT_TIMEOUT_MS = 60_000;
const TEXT_TRUNCATE_LEN = 60;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_TOP_K = 10;
const DEFAULT_COLLECTION = 'default';

// === 请求 / 响应类型(与 Web 端 page.tsx 对齐) ===

interface KBArticle {
  id: string;
  title: string;
  summary?: string | null;
  categoryName?: string | null;
  authorName?: string | null;
  viewCount: number;
  updatedAt: string;
}

interface KBListData {
  list: KBArticle[];
  total: number;
}

interface KBItemData {
  item: KBArticle;
}

interface KBCreateBody {
  title: string;
  summary?: string;
  content?: string;
}

interface SearchHit {
  id: number;
  docId: number;
  content: string;
  score: number;
  chunkIndex: number;
}

interface SearchBody {
  query: string;
  collectionName: string;
  topK: number;
  scoreThreshold: number;
  ownerUuid: string;
}

interface UploadResult {
  chunkCount?: number;
  filename?: string;
  mimeType?: string;
  [key: string]: unknown;
}

// === CLI options 类型 ===

interface ListOptions {
  json?: boolean;
}

interface ShowOptions {
  json?: boolean;
}

interface CreateOptions {
  name: string;
  json?: boolean;
}

interface DeleteOptions {
  json?: boolean;
}

interface SearchOptions {
  kb?: string;
  json?: boolean;
}

interface IndexOptions {
  kb?: string;
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

/** 远程 HTTP 调用(Node 20+ 内置 fetch)。失败抛错,由调用方 try/catch 输出友好错误。 */
async function apiRequest(
  baseUrl: string,
  fullPath: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: unknown;
    timeoutMs?: number;
    apiKey?: string;
  } = {},
): Promise<unknown> {
  const url = `${baseUrl.replace(/\/$/, '')}${fullPath}`;
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

/** multipart 文件上传(Node 20+ 内置 FormData / Blob / File)。 */
async function apiUploadFile(
  baseUrl: string,
  fullPath: string,
  formData: FormData,
  options: { timeoutMs?: number; apiKey?: string } = {},
): Promise<unknown> {
  const url = `${baseUrl.replace(/\/$/, '')}${fullPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {};
    if (options.apiKey) {
      headers.Authorization = `Bearer ${options.apiKey}`;
    }
    // 不设 Content-Type,fetch 会自动加 multipart/form-data; boundary=...
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
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

function isKBArticle(v: unknown): v is KBArticle {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    'title' in v &&
    typeof (v as { id: unknown }).id === 'string'
  );
}

function isKBListData(v: unknown): v is KBListData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'list' in v &&
    Array.isArray((v as { list: unknown }).list)
  );
}

function isKBItemData(v: unknown): v is KBItemData {
  return (
    typeof v === 'object' &&
    v !== null &&
    'item' in v &&
    isKBArticle((v as { item: unknown }).item)
  );
}

function isSearchHit(v: unknown): v is SearchHit {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    'docId' in v &&
    'content' in v &&
    'score' in v
  );
}

function isUploadResult(v: unknown): v is UploadResult {
  return typeof v === 'object' && v !== null;
}

// === 工具函数 ===

/** 根据扩展名猜测 MIME(后端 document-parser 支持 PDF/DOCX/MD/Text/HTML)。 */
function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.md':
    case '.markdown':
      return 'text/markdown';
    case '.html':
    case '.htm':
      return 'text/html';
    case '.txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

/** 解析程序全局选项中的 apiUrl / apiKey。 */
function readGlobalOpts(program: Command): { apiUrl?: string; apiKey?: string } {
  return program.opts() as { apiUrl?: string; apiKey?: string };
}

/** 未登录统一提示。 */
function reportNoToken(): void {
  console.error(chalk.red('✗ 未登录或 token 已失效,请运行: ihui login'));
  process.exitCode = 1;
}

// ==================== knowledge list ====================

async function listKnowledge(
  baseUrl: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const qs = `?page=1&pageSize=${DEFAULT_PAGE_SIZE}`;
  const resp = await apiRequest(baseUrl, `/api/knowledge-base${qs}`, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isKBListData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 list 字段'));
    process.exitCode = 1;
    return;
  }

  const items = data.list.filter(isKBArticle);
  const total = typeof data.total === 'number' ? data.total : items.length;

  if (items.length === 0) {
    console.info(chalk.dim('(暂无知识库文章)'));
    return;
  }

  console.info('');
  for (const it of items) {
    const summary = (it.summary ?? '').slice(0, TEXT_TRUNCATE_LEN);
    console.info(
      `[${chalk.cyan(String(it.id).slice(0, 8))}] ${chalk.bold(it.title)} ${chalk.dim(summary)}`,
    );
  }
  console.info(chalk.dim(`\n共 ${total} 篇文章`));
}

// ==================== knowledge show ====================

async function showKnowledge(
  baseUrl: string,
  id: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  let resp: unknown;
  try {
    resp = await apiRequest(baseUrl, `/api/knowledge-base/${encodeURIComponent(id)}`, { apiKey });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      if (asJson) {
        printJson({ code: 404, message: '知识库文章不存在', data: null });
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
  if (!isKBItemData(data)) {
    console.error(chalk.red('✗ 响应格式异常,缺少 item 字段'));
    process.exitCode = 1;
    return;
  }

  const it = data.item;
  console.info(chalk.bold(it.title));
  if (it.summary) console.info(chalk.dim(it.summary));
  const meta: string[] = [];
  if (it.categoryName) meta.push(it.categoryName);
  if (it.authorName) meta.push(it.authorName);
  meta.push(`浏览 ${it.viewCount}`);
  if (it.updatedAt) meta.push(it.updatedAt);
  console.info(chalk.dim(meta.join(' · ')));
}

// ==================== knowledge create ====================

async function createKnowledge(
  baseUrl: string,
  name: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const body: KBCreateBody = { title: name };
  const resp = await apiRequest(baseUrl, '/api/knowledge-base', {
    method: 'POST',
    body,
    apiKey,
  });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isKBItemData(data)) {
    console.error(chalk.red('✗ 创建失败:响应格式异常'));
    process.exitCode = 1;
    return;
  }
  console.info(chalk.green(`✓ 已创建知识库文章 id=${data.item.id} title=${data.item.title}`));
}

// ==================== knowledge delete ====================

async function deleteKnowledge(
  baseUrl: string,
  id: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  let resp: unknown;
  try {
    resp = await apiRequest(baseUrl, `/api/knowledge-base/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      apiKey,
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      if (asJson) {
        printJson({ code: 404, message: '知识库文章不存在', data: null });
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

  console.info(chalk.green(`✓ 已删除知识库文章 id=${id}`));
}

// ==================== rag search ====================

async function ragSearch(
  baseUrl: string,
  query: string,
  kb: string | undefined,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const body: SearchBody = {
    query,
    collectionName: kb ?? DEFAULT_COLLECTION,
    topK: DEFAULT_TOP_K,
    scoreThreshold: 0,
    ownerUuid: '',
  };
  const resp = await apiRequest(baseUrl, '/api/knowledge/search', {
    method: 'POST',
    body,
    apiKey,
  });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  const hits = Array.isArray(data) ? data.filter(isSearchHit) : [];

  if (hits.length === 0) {
    console.info(chalk.dim('(未检索到相关内容)'));
    return;
  }

  console.info('');
  for (const h of hits) {
    const score = `${(h.score * 100).toFixed(1)}%`;
    const content = (h.content ?? '').slice(0, TEXT_TRUNCATE_LEN);
    console.info(
      `[${chalk.cyan(`#${h.id}`)} ${chalk.dim(`doc=${h.docId}`)} ${chalk.green(score)}] ${content}`,
    );
  }
  console.info(chalk.dim(`\n共 ${hits.length} 条命中`));
}

// ==================== rag index ====================

async function ragIndex(
  baseUrl: string,
  file: string,
  kb: string | undefined,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  // 1) 读取本地文件
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(file);
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'ENOENT') {
      console.error(chalk.red(`✗ 文件不存在: ${file}`));
    } else {
      console.error(chalk.red(`✗ 读取文件失败: ${e.message || err}`));
    }
    process.exitCode = 1;
    return;
  }

  // 2) 构建 multipart 表单
  const filename = path.basename(file);
  const mimeType = guessMimeType(filename);
  const title = filename.replace(/\.[^.]+$/, '') || 'untitled';
  const collectionName = kb ?? DEFAULT_COLLECTION;

  const form = new FormData();
  // Node 20+ 全局 File 构造器,携带 filename 与 mime 类型
  const filePart = new File([new Uint8Array(buffer)], filename, { type: mimeType });
  form.append('file', filePart);
  form.append('title', title);
  form.append('collectionName', collectionName);

  // 3) 上传
  const resp = await apiUploadFile(baseUrl, '/api/knowledge/upload', form, { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isUploadResult(data)) {
    console.error(chalk.red('✗ 索引失败:响应格式异常'));
    process.exitCode = 1;
    return;
  }
  const chunkCount = typeof data.chunkCount === 'number' ? data.chunkCount : 0;
  console.info(
    chalk.green(`✓ 已索引文件 ${filename} → ${chunkCount} 个切片 (kb=${collectionName})`),
  );
}

// ==================== 命令注册 ====================

/**
 * 在根 program 上注册 `knowledge` 命令组(对标 Web 端 /knowledge-base)。
 * 使用全局 `--api-url` / `--api-key` 或 settings.json 解析后端地址。
 */
export function registerKnowledgeCommand(program: Command): void {
  const kbCmd = program
    .command('knowledge')
    .description('知识库管理 (对标 Web 端 /knowledge-base)');

  kbCmd
    .command('list')
    .description('列出知识库文章')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: ListOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = readGlobalOpts(program);
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          reportNoToken();
          return;
        }
        await listKnowledge(baseUrl, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('knowledge list', err);
      }
    });

  kbCmd
    .command('show <id>')
    .description('查看知识库文章详情')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (id: string, opts: ShowOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = readGlobalOpts(program);
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          reportNoToken();
          return;
        }
        await showKnowledge(baseUrl, id, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('knowledge show', err);
      }
    });

  kbCmd
    .command('create')
    .description('创建知识库文章')
    .requiredOption('--name <n>', '文章标题')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: CreateOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = readGlobalOpts(program);
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          reportNoToken();
          return;
        }
        await createKnowledge(baseUrl, opts.name, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('knowledge create', err);
      }
    });

  kbCmd
    .command('delete <id>')
    .description('删除知识库文章')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (id: string, opts: DeleteOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = readGlobalOpts(program);
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          reportNoToken();
          return;
        }
        await deleteKnowledge(baseUrl, id, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('knowledge delete', err);
      }
    });
}

/**
 * 在根 program 上注册 `rag` 命令组(对标 Web 端 /knowledge-rag)。
 * 使用全局 `--api-url` / `--api-key` 或 settings.json 解析后端地址。
 */
export function registerRagCommand(program: Command): void {
  const ragCmd = program
    .command('rag')
    .description('RAG 检索与索引 (对标 Web 端 /knowledge-rag)');

  ragCmd
    .command('search <query>')
    .description('语义检索知识库')
    .option('--kb <id>', '知识库集合名 (collectionName,默认 default)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (query: string, opts: SearchOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = readGlobalOpts(program);
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          reportNoToken();
          return;
        }
        await ragSearch(baseUrl, query, opts.kb, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('rag search', err);
      }
    });

  ragCmd
    .command('index <file>')
    .description('索引本地文件到知识库 (PDF/DOCX/MD/Text/HTML)')
    .option('--kb <id>', '知识库集合名 (collectionName,默认 default)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (file: string, opts: IndexOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = readGlobalOpts(program);
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        if (!apiKey) {
          reportNoToken();
          return;
        }
        await ragIndex(baseUrl, file, opts.kb, Boolean(opts.json), apiKey);
      } catch (err) {
        handleError('rag index', err);
      }
    });
}
