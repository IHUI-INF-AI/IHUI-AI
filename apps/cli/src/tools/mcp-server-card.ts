// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP Server Card（SEP-2127，v1 schema）的解析、校验与预连接探测。
 *
 * 边界刻意很窄：卡片只描述**身份 + 远程连接 + 支持协议版本**，不列 tools/resources/prompts，
 * 也不承载能力协商。它只是连接前的提示，不是安全判定源；运行时仍以 `server/discover` 为准。
 *
 * 为什么单独成文件：
 *   - schema 校验与 fetch 可以脱网测试，不必拉起整条 McpConnection；
 *   - 失败策略由 runtime 决定（`requireServerCard` 才硬失败，缺省只告警），这里只给结构化结论。
 */

import { assertSafeFetchUrl, formatSsrfRejection, type SelfHostedTrust } from '@ihui/shared/utils/ssrf-guard';
import { isRecord } from '../util/json.js';

export const MCP_SERVER_CARD_SCHEMA_URL =
  'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json';
export const MCP_SERVER_CARD_MEDIA_TYPE = 'application/mcp-server-card+json';
export const AI_CATALOG_MEDIA_TYPE = 'application/ai-catalog+json';

const CARD_NAME_RE = /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/;
const REMOTE_URL_RE = /^(https?:\/\/[^\s]+|\{[a-zA-Z_][a-zA-Z0-9_]*\}[^\s]*)$/;

export type McpServerCardTransport = 'sse' | 'streamable-http';

export interface McpServerCardRemote {
  type: McpServerCardTransport;
  url: string;
  supportedProtocolVersions?: string[];
  headers?: Record<string, unknown>[];
  variables?: Record<string, unknown>;
  extensionsInfo?: Record<string, unknown>;
}

export interface McpServerCard {
  $schema: typeof MCP_SERVER_CARD_SCHEMA_URL;
  name: string;
  version: string;
  description: string;
  title?: string;
  websiteUrl?: string;
  repository?: Record<string, unknown>;
  icons?: Record<string, unknown>[];
  remotes?: McpServerCardRemote[];
  _meta?: Record<string, unknown>;
}

export interface McpServerCardValidation {
  ok: boolean;
  errors: string[];
  card?: McpServerCard;
}

function nonEmptyString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/** 版本必须是一个**具体**版本；范围表达式（^、~、>=、1.x、1.*）不是可以连的东西。 */
export function isConcreteServerVersion(version: unknown): version is string {
  if (typeof version !== 'string' || version.length === 0 || version.length > 255) return false;
  if (/^[\s~^<>=]/.test(version)) return false;
  if (/\s/.test(version)) return false;
  if (version.includes('*')) return false;
  if (/(^|[.\-])[xX]([.\-]|$)/.test(version)) return false;
  return true;
}

function validateRemote(raw: unknown, index: number, errors: string[]): McpServerCardRemote | undefined {
  const where = `remotes[${index}]`;
  if (!isRecord(raw)) {
    errors.push(`${where} 必须是对象`);
    return undefined;
  }
  if (raw.type !== 'streamable-http' && raw.type !== 'sse') {
    errors.push(`${where}.type 必须是 streamable-http 或 sse`);
  }
  if (typeof raw.url !== 'string' || !REMOTE_URL_RE.test(raw.url)) {
    errors.push(`${where}.url 必须是 http(s) URL 或 {变量} 开头的 URL 模板`);
  }
  if (
    raw.supportedProtocolVersions !== undefined &&
    (!Array.isArray(raw.supportedProtocolVersions) ||
      raw.supportedProtocolVersions.some((v) => typeof v !== 'string' || !v.trim()))
  ) {
    errors.push(`${where}.supportedProtocolVersions 必须是非空字符串数组`);
  }
  if (raw.variables !== undefined && !isRecord(raw.variables)) {
    errors.push(`${where}.variables 必须是对象`);
  }
  if (raw.extensionsInfo !== undefined && !isRecord(raw.extensionsInfo)) {
    errors.push(`${where}.extensionsInfo 必须是对象`);
  }
  if (raw.headers !== undefined) {
    if (!Array.isArray(raw.headers)) {
      errors.push(`${where}.headers 必须是数组`);
    } else {
      for (const [i, h] of raw.headers.entries()) {
        if (!isRecord(h) || typeof h.name !== 'string' || !h.name.trim()) {
          errors.push(`${where}.headers[${i}] 必须带非空 name`);
        }
      }
    }
  }
  if (errors.some((e) => e.startsWith(where))) return undefined;
  return {
    type: raw.type as McpServerCardTransport,
    url: raw.url as string,
    ...(Array.isArray(raw.supportedProtocolVersions)
      ? { supportedProtocolVersions: raw.supportedProtocolVersions as string[] }
      : {}),
    ...(Array.isArray(raw.headers)
      ? { headers: raw.headers as Record<string, unknown>[] }
      : {}),
    ...(isRecord(raw.variables) ? { variables: raw.variables } : {}),
    ...(isRecord(raw.extensionsInfo) ? { extensionsInfo: raw.extensionsInfo } : {}),
  };
}

/**
 * 校验 v1 Server Card。只认规范里**可离线判定**的字段：
 * required 四件套、name 的 reverse-DNS 形状、version 不是范围、远程 endpoint 形状。
 */
export function validateMcpServerCard(value: unknown): McpServerCardValidation {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ['Server Card 必须是 JSON 对象'] };

  if (value.$schema !== MCP_SERVER_CARD_SCHEMA_URL) {
    errors.push(`$schema 必须精确等于 ${MCP_SERVER_CARD_SCHEMA_URL}`);
  }
  if (
    typeof value.name !== 'string' ||
    value.name.length < 3 ||
    value.name.length > 200 ||
    !CARD_NAME_RE.test(value.name)
  ) {
    errors.push('name 必须是 reverse-DNS（恰好一个斜杠、3–200 字符）');
  }
  if (!isConcreteServerVersion(value.version)) {
    errors.push('version 必须是单个具体版本（不接受 ^、~、>=、1.x、1.* 等范围）');
  }
  if (!nonEmptyString(value.description, 100)) {
    errors.push('description 必须是 1–100 字符的非空字符串');
  }
  if (value.title !== undefined && !nonEmptyString(value.title, 100)) {
    errors.push('title 若存在必须是 1–100 字符');
  }
  if (value.websiteUrl !== undefined && typeof value.websiteUrl !== 'string') {
    errors.push('websiteUrl 若是字符串');
  }
  if (value.repository !== undefined && !isRecord(value.repository)) {
    errors.push('repository 必须是对象');
  }
  if (value.icons !== undefined && !Array.isArray(value.icons)) {
    errors.push('icons 必须是数组');
  }
  if (value._meta !== undefined && !isRecord(value._meta)) {
    errors.push('_meta 必须是对象');
  }

  const remotes: McpServerCardRemote[] = [];
  if (value.remotes !== undefined) {
    if (!Array.isArray(value.remotes)) {
      errors.push('remotes 必须是数组');
    } else {
      for (const [i, raw] of value.remotes.entries()) {
        const remote = validateRemote(raw, i, errors);
        if (remote) remotes.push(remote);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    card: {
      $schema: MCP_SERVER_CARD_SCHEMA_URL,
      name: value.name as string,
      version: value.version as string,
      description: value.description as string,
      ...(typeof value.title === 'string' ? { title: value.title } : {}),
      ...(typeof value.websiteUrl === 'string' ? { websiteUrl: value.websiteUrl } : {}),
      ...(isRecord(value.repository) ? { repository: value.repository } : {}),
      ...(Array.isArray(value.icons) ? { icons: value.icons as Record<string, unknown>[] } : {}),
      ...(remotes.length > 0 ? { remotes } : {}),
      ...(isRecord(value._meta) ? { _meta: value._meta } : {}),
    },
  };
}

/**
 * 在卡片里挑一条与当前 transport / 协议版本兼容的远程端点。
 *
 * 卡片是 advisory：调用方拿到 `undefined` 时该告警还是硬失败，由 `requireServerCard` 决定。
 * `stdio` 不消费 remotes（卡片本来只描述 HTTP-based server）。
 */
export function pickMcpServerCardRemote(
  card: McpServerCard,
  opts: { transport?: 'stdio' | 'http' | 'sse'; protocolVersion?: string },
): McpServerCardRemote | undefined {
  if (opts.transport === 'stdio') return undefined;
  const wantedType: McpServerCardTransport = opts.transport === 'sse' ? 'sse' : 'streamable-http';
  const candidates = card.remotes?.filter((r) => r.type === wantedType) ?? [];
  if (candidates.length === 0) return undefined;
  if (!opts.protocolVersion) return candidates[0];
  return candidates.find(
    (r) =>
      !r.supportedProtocolVersions?.length ||
      r.supportedProtocolVersions.includes(opts.protocolVersion!),
  );
}

async function readLimitedBody(resp: Response, maxBytes: number): Promise<string> {
  if (!resp.body) return '';
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error(`Server Card 超过大小上限 ${maxBytes} 字节`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

export interface FetchMcpServerCardOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  trust?: SelfHostedTrust;
}

/** 与 mcp-runtime 的 assertMcpUrlOutbound 同一裁决源（SSRF 只此一份）。 */
async function assertCardUrlOutbound(url: string, trust?: SelfHostedTrust): Promise<void> {
  const verdict = await assertSafeFetchUrl(url, { selfHosted: trust });
  if (!verdict.safe) throw new Error(formatSsrfRejection(verdict));
}

export interface FetchMcpServerCardResult extends McpServerCardValidation {
  url: string;
}

/**
 * 连接前拉取并校验一张 Server Card。
 *
 * 不猜 `<url>/server-card`：规范把该路径列为“推荐位置”，但客户端应从 AI Catalog / 用户配置
 * 拿到卡片 URL；乱猜会把普通 404 变成连接噪声。调用方显式给 `serverCardUrl` 才走这里。
 */
export async function fetchMcpServerCard(
  url: string,
  opts: FetchMcpServerCardOptions = {},
): Promise<FetchMcpServerCardResult> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 5_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await assertCardUrlOutbound(url, opts.trust);
    const resp = await (opts.fetchImpl ?? fetch)(url, {
      method: 'GET',
      headers: { Accept: `${MCP_SERVER_CARD_MEDIA_TYPE}, application/json` },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!resp.ok) {
      return { ok: false, errors: [`HTTP ${resp.status} ${resp.statusText}`], url };
    }
    const text = await readLimitedBody(resp, opts.maxBytes ?? 256 * 1024);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, errors: ['响应不是合法 JSON'], url };
    }
    return { ...validateMcpServerCard(parsed), url };
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? err.message : String(err)],
      url,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * AI Catalog（SEP-2127 discovery）的最小读取面。
 *
 * 只做三件事：按 `/.well-known/ai-catalog.json` 取目录、挑出
 * `application/mcp-server-card+json` 条目、把条目里的 url/data 交给 Server Card 校验。
 * 不做域名爬取、不自动连接、不把目录声明的身份当安全凭据。
 */
export interface McpAiCatalogEntry {
  identifier: string;
  type: string;
  url?: string;
  data?: unknown;
}

export interface McpAiCatalog {
  specVersion: string;
  entries: McpAiCatalogEntry[];
}

export interface McpAiCatalogValidation {
  ok: boolean;
  errors: string[];
  catalog?: McpAiCatalog;
  /** 只含 Server Card 类型且形状合法的条目。 */
  cardEntries?: McpAiCatalogEntry[];
}

const CATALOG_URL_RE = /^https?:\/\/[^\s]+$/i;

/** 把域名/目录 URL 归一成 AI Catalog 的 well-known 地址。 */
export function resolveAiCatalogUrl(input: string): string {
  const raw = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(raw);
  if (url.pathname === '/' || url.pathname === '') {
    url.pathname = '/.well-known/ai-catalog.json';
  }
  return url.toString();
}

export function parseMcpAiCatalog(value: unknown): McpAiCatalogValidation {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ['AI Catalog 必须是 JSON 对象'] };
  let fatal = false;
  if (typeof value.specVersion !== 'string' || !value.specVersion.trim()) {
    errors.push('specVersion 必须是非空字符串');
    fatal = true;
  }
  if (!Array.isArray(value.entries)) {
    return { ok: false, errors: [...errors, 'entries 必须是数组'] };
  }
  const cardEntries: McpAiCatalogEntry[] = [];
  for (const [i, raw] of value.entries.entries()) {
    const where = `entries[${i}]`;
    if (!isRecord(raw)) {
      errors.push(`${where} 必须是对象`);
      continue;
    }
    if (typeof raw.identifier !== 'string' || !raw.identifier.trim()) {
      errors.push(`${where}.identifier 必须是非空字符串`);
      continue;
    }
    if (typeof raw.type !== 'string' || !raw.type.trim()) {
      errors.push(`${where}.type 必须是非空字符串`);
      continue;
    }
    const hasUrl = raw.url !== undefined;
    const hasData = raw.data !== undefined;
    if (hasUrl === hasData) {
      errors.push(`${where} 必须恰好有 url 或 data 之一`);
      continue;
    }
    if (hasUrl && (typeof raw.url !== 'string' || !CATALOG_URL_RE.test(raw.url))) {
      errors.push(`${where}.url 必须是 http(s) URL`);
      continue;
    }
    if (hasData && !isRecord(raw.data)) {
      errors.push(`${where}.data 必须是 Server Card 对象`);
      continue;
    }
    if (raw.type === MCP_SERVER_CARD_MEDIA_TYPE) {
      cardEntries.push({
        identifier: raw.identifier,
        type: raw.type,
        ...(hasUrl ? { url: raw.url as string } : {}),
        ...(hasData ? { data: raw.data } : {}),
      });
    }
  }
  return {
    ok: !fatal,
    errors,
    catalog: {
      specVersion: typeof value.specVersion === 'string' ? value.specVersion : '',
      entries: value.entries as McpAiCatalogEntry[],
    },
    cardEntries,
  };
}

export interface FetchMcpAiCatalogOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  trust?: SelfHostedTrust;
}

export interface FetchMcpAiCatalogResult extends McpAiCatalogValidation {
  url: string;
}

export async function fetchMcpAiCatalog(
  domainOrUrl: string,
  opts: FetchMcpAiCatalogOptions = {},
): Promise<FetchMcpAiCatalogResult> {
  const url = resolveAiCatalogUrl(domainOrUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5_000);
  try {
    await assertCardUrlOutbound(url, opts.trust);
    const resp = await (opts.fetchImpl ?? fetch)(url, {
      method: 'GET',
      headers: { Accept: `${AI_CATALOG_MEDIA_TYPE}, application/json` },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!resp.ok) return { ok: false, errors: [`HTTP ${resp.status} ${resp.statusText}`], url };
    const text = await readLimitedBody(resp, opts.maxBytes ?? 256 * 1024);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, errors: ['AI Catalog 响应不是合法 JSON'], url };
    }
    return { ...parseMcpAiCatalog(parsed), url };
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)], url };
  } finally {
    clearTimeout(timer);
  }
}

export interface DiscoverMcpServerCardsOptions extends FetchMcpAiCatalogOptions {
  /** 目录条目里的卡片 URL 是远端下发，默认不享受自托管信任。 */
  cardTrust?: SelfHostedTrust;
  maxCards?: number;
}

export interface McpServerCardDiscovery {
  identifier: string;
  url?: string;
  ok: boolean;
  errors: string[];
  card?: McpServerCard;
}

export interface DiscoverMcpServerCardsResult {
  catalogUrl: string;
  catalogOk: boolean;
  errors: string[];
  cards: McpServerCardDiscovery[];
}

/**
 * 域名级发现：拉 AI Catalog，逐条取/验 Server Card。
 * 这里只返回候选，不替用户建立连接；连接仍要显式配置或由调用方决定。
 */
export async function discoverMcpServerCards(
  domainOrUrl: string,
  opts: DiscoverMcpServerCardsOptions = {},
): Promise<DiscoverMcpServerCardsResult> {
  const catalog = await fetchMcpAiCatalog(domainOrUrl, opts);
  const cards: McpServerCardDiscovery[] = [];
  if (!catalog.ok || !catalog.cardEntries) {
    return {
      catalogUrl: catalog.url,
      catalogOk: false,
      errors: catalog.errors,
      cards,
    };
  }
  const limit = Math.max(0, opts.maxCards ?? 10);
  for (const entry of catalog.cardEntries.slice(0, limit)) {
    if (entry.url) {
      const fetched = await fetchMcpServerCard(entry.url, {
        fetchImpl: opts.fetchImpl,
        timeoutMs: opts.timeoutMs,
        maxBytes: opts.maxBytes,
        trust: opts.cardTrust,
      });
      cards.push({
        identifier: entry.identifier,
        url: entry.url,
        ok: fetched.ok,
        errors: fetched.errors,
        ...(fetched.card ? { card: fetched.card } : {}),
      });
      continue;
    }
    const checked = validateMcpServerCard(entry.data);
    cards.push({
      identifier: entry.identifier,
      ok: checked.ok,
      errors: checked.errors,
      ...(checked.card ? { card: checked.card } : {}),
    });
  }
  return { catalogUrl: catalog.url, catalogOk: true, errors: catalog.errors, cards };
}
