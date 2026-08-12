/**
 * CLI HTTP 工具共享模块(2026-08-12 抽取)。
 *
 * 背景:13 个 commands/*.ts 此前各自复制了 resolveBaseUrl / resolveApiKeyAsync /
 * apiRequest / printJson / extractData / handleError 六个函数(约 90 行/文件,
 * 仅 API_PREFIX 与超时不同)。本模块收敛为声明式工厂:
 *
 *   const apiRequest = createApiRequest(API_PREFIX, DEFAULT_TIMEOUT_MS);
 *
 * 差异说明:
 * - API_PREFIX 为 '' 时(如 agents/models),调用方传完整 path,行为与旧实现一致。
 * - developer.ts 因使用 bearer 参数名 + 严格 extractData,保留独立实现,不在此列。
 * - extractData 采用宽松语义:仅当响应含 'data' 字段时提取(旧 12 个文件一致行为)。
 */

import chalk from 'chalk';
import { loadSettings } from './settings.js';
import { ensureFreshAccessToken } from './token-manager.js';

/** 解析 baseUrl:CLI flag > settings.json > 默认值 http://localhost:8802(api 端口)。 */
export function resolveBaseUrl(cliApiUrl: unknown): string {
  if (typeof cliApiUrl === 'string' && cliApiUrl) return cliApiUrl.replace(/\/+$/, '');
  const settings = loadSettings();
  const url = settings.apiUrl || process.env.IHUI_API_URL || 'http://localhost:8802';
  return url.replace(/\/+$/, '');
}

/**
 * 解析 apiKey:CLI flag > 自动 refresh 续期(settings.refreshToken)。
 * 返回 null 表示无 token / refresh 失败,调用方应提示用户 `ihui login`。
 */
export async function resolveApiKeyAsync(
  cliApiKey: unknown,
  baseUrl: string,
): Promise<string | null> {
  if (typeof cliApiKey === 'string' && cliApiKey) return cliApiKey;
  return ensureFreshAccessToken(baseUrl);
}

/** apiRequest 选项(与旧 12 个命令文件一致)。 */
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  apiKey?: string;
}

/**
 * 创建绑定 API 前缀与超时的远程 HTTP 调用函数(Node 20+ 内置 fetch)。
 * prefix 为 '' 时 path 应为完整路径(如 /api/agents/list),与旧实现行为一致。
 */
export function createApiRequest(prefix: string, defaultTimeoutMs: number) {
  return async function apiRequest(
    baseUrl: string,
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<unknown> {
    const url = `${baseUrl.replace(/\/$/, '')}${prefix}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? defaultTimeoutMs);
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
  };
}

export function printJson(data: unknown): void {
  console.info(JSON.stringify(data, null, 2));
}

/** 提取标准 API 响应的 data 字段;非标准格式原样返回。 */
export function extractData(resp: unknown): unknown {
  if (resp && typeof resp === 'object' && 'data' in resp) {
    return (resp as { data: unknown }).data;
  }
  return resp;
}

/** 友好错误输出(不触发 crash handler)。 */
export function handleError(scope: string, err: unknown): void {
  const e = err as Error & { status?: number };
  const status = typeof e.status === 'number' ? ` [${e.status}]` : '';
  console.error(chalk.red(`✗ ${scope}${status}: ${e.message || err}`));
  if (e.message?.includes('ECONNREFUSED') || e.message?.includes('fetch failed')) {
    console.error(chalk.dim('  请确认 API 服务已启动:pnpm --filter @ihui/api dev(默认 http://localhost:8802)'));
  }
  process.exitCode = 1;
}
