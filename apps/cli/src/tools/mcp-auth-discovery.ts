// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP 2026-07-28 OAuth 发现与客户端注册。
 *
 * 三件事，缺一件都会把“标准授权”退化成用户手填端点：
 *   1. 授权服务器 metadata 发现（RFC 8414 / OIDC Discovery），并校验 issuer 精确一致；
 *   2. 客户端身份按 MCP 2026 的顺序选择：预注册 > CIMD > DCR > 报错；
 *   3. CIMD URL 形状校验（HTTPS、非根路径、无 query/fragment/userinfo、无点段）。
 *
 * 这里不做网络缓存：metadata 的 ttl 由调用方决定；当前 CLI 每次连接只解析一次。
 */

import { assertSafeFetchUrl, formatSsrfRejection, type SelfHostedTrust } from '@ihui/shared/utils/ssrf-guard';
import { isRecord } from '../util/json.js';

export interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  /** MCP 2026：授权服务器是否接受 CIMD 作为 client_id */
  client_id_metadata_document_supported?: boolean;
  /** RFC 9207：授权响应是否带 iss */
  authorization_response_iss_parameter_supported?: boolean;
}

export type ClientRegistrationMethod = 'pre-registered' | 'cimd' | 'dcr';

export interface ClientRegistration {
  method: ClientRegistrationMethod;
  clientId: string;
  clientSecret?: string;
  /** DCR 返回的 registration_access_token（仅内存，用于后续管理，不落盘） */
  registrationAccessToken?: string;
}

export interface ResolveClientRegistrationOptions {
  metadata: AuthorizationServerMetadata;
  redirectUri: string;
  /** 已预注册的 client_id（最高优先级） */
  preRegisteredClientId?: string;
  preRegisteredClientSecret?: string;
  /** 客户端自己发布的 CIMD 文档 URL（授权服务器声明支持时使用） */
  clientMetadataDocumentUrl?: string;
  clientName?: string;
  /** DCR 请求里显式声明 native/web；缺省按 redirectUri 自动判定 */
  applicationType?: 'native' | 'web';
  fetchImpl?: typeof fetch;
}

function issuerWellKnownCandidates(issuer: string): string[] {
  const url = new URL(issuer);
  const path = url.pathname.replace(/\/+$/, '');
  const base = `${url.origin}`;
  if (path === '') {
    return [
      `${base}/.well-known/oauth-authorization-server`,
      `${base}/.well-known/openid-configuration`,
    ];
  }
  // RFC 8414 §3.1：issuer 带路径时，well-known 段插在 host 与路径之间。
  return [
    `${base}/.well-known/oauth-authorization-server${path}`,
    `${base}/.well-known/openid-configuration${path}`,
  ];
}

/**
 * 发现授权服务器 metadata。
 *
 * 关键拒绝：返回文档的 `issuer` 必须与请求的 issuer 做**精确字符串比较**，
 * 不做尾斜杠/大小写归一化。不一致说明 discovery 被换源（mix-up），必须拒绝。
 */
export async function discoverAuthorizationServer(
  issuer: string,
  options: { trust?: SelfHostedTrust; fetchImpl?: typeof fetch } = {},
): Promise<AuthorizationServerMetadata> {
  if (!/^https:\/\//i.test(issuer) && !/^http:\/\/localhost(?::\d+)?(?:\/|$)/i.test(issuer)) {
    throw new Error(`授权服务器 issuer 必须是 https（本机 localhost 例外）: ${issuer}`);
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const errors: string[] = [];
  for (const candidate of issuerWellKnownCandidates(issuer)) {
    try {
      const verdict = await assertSafeFetchUrl(candidate, { selfHosted: options.trust });
      if (!verdict.safe) {
        errors.push(`${candidate}: ${formatSsrfRejection(verdict)}`);
        continue;
      }
      const resp = await fetchImpl(candidate, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) {
        errors.push(`${candidate}: HTTP ${resp.status}`);
        continue;
      }
      const json: unknown = await resp.json();
      if (!isRecord(json)) {
        errors.push(`${candidate}: 响应不是 JSON 对象`);
        continue;
      }
      const metadata = parseAuthorizationServerMetadata(json);
      if (metadata.issuer !== issuer) {
        throw new Error(
          `授权服务器 metadata 的 issuer 不匹配（拒绝 mix-up）: 期望 ${issuer}，实际 ${metadata.issuer}`,
        );
      }
      return metadata;
    } catch (err) {
      if (err instanceof Error && err.message.includes('issuer 不匹配')) throw err;
      errors.push(`${candidate}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`授权服务器 discovery 失败（issuer=${issuer}）:\n${errors.join('\n')}`);
}

function parseAuthorizationServerMetadata(json: Record<string, unknown>): AuthorizationServerMetadata {
  const issuer = json.issuer;
  const authorizationEndpoint = json.authorization_endpoint;
  const tokenEndpoint = json.token_endpoint;
  if (typeof issuer !== 'string' || issuer === '') throw new Error('metadata 缺少 issuer');
  if (typeof authorizationEndpoint !== 'string' || authorizationEndpoint === '') {
    throw new Error('metadata 缺少 authorization_endpoint');
  }
  if (typeof tokenEndpoint !== 'string' || tokenEndpoint === '') {
    throw new Error('metadata 缺少 token_endpoint');
  }
  return {
    issuer,
    authorization_endpoint: authorizationEndpoint,
    token_endpoint: tokenEndpoint,
    ...(typeof json.registration_endpoint === 'string'
      ? { registration_endpoint: json.registration_endpoint }
      : {}),
    ...(Array.isArray(json.scopes_supported)
      ? { scopes_supported: json.scopes_supported.filter((s): s is string => typeof s === 'string') }
      : {}),
    ...(json.client_id_metadata_document_supported === true
      ? { client_id_metadata_document_supported: true }
      : {}),
    ...(json.authorization_response_iss_parameter_supported === true
      ? { authorization_response_iss_parameter_supported: true }
      : {}),
  };
}

/**
 * 校验 CIMD URL 形状。
 *
 * 规范要求：HTTPS、非根路径、无 fragment、无 userinfo、无 `.`/`..` 段；
 * query 是 SHOULD NOT，本实现按 MUST NOT 处理（client_id 必须稳定）。
 * 本机 localhost 的 http 仅用于本地开发，生产形态仍要求 HTTPS。
 */
export function validateClientMetadataDocumentUrl(raw: string): string {
  // WHATWG URL 会在解析时消掉 `.`/`..` 段；必须先在原始字符串上判，
  // 否则 `https://host/a/../client.json` 会被归一化成合法路径，点段校验形同虚设。
  const rawPath = raw.replace(/[?#].*$/, '').replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');
  if (rawPath.split('/').some((s) => s === '.' || s === '..')) {
    throw new Error(`CIMD URL 不得包含 . 或 .. 路径段: ${raw}`);
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`CIMD URL 不是合法 URL: ${raw}`);
  }
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
    throw new Error(`CIMD URL 必须是 https（本机 localhost 例外）: ${raw}`);
  }
  if (url.username || url.password) throw new Error(`CIMD URL 不得包含 userinfo: ${raw}`);
  if (url.hash) throw new Error(`CIMD URL 不得包含 fragment: ${raw}`);
  if (url.search) throw new Error(`CIMD URL 不得包含 query（client_id 必须稳定）: ${raw}`);
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) throw new Error(`CIMD URL 必须是非根路径: ${raw}`);
  if (segments.some((s) => s === '.' || s === '..')) {
    throw new Error(`CIMD URL 不得包含 . 或 .. 路径段: ${raw}`);
  }
  return raw;
}

/**
 * 按 MCP 2026 的顺序选择客户端身份：预注册 > CIMD > DCR > 报错。
 *
 * 返回的 clientId 是后续 authorization / token 请求要用的身份；
 * CIMD 时它就是客户端自己发布的 HTTPS URL，不发起任何注册请求。
 */
export async function resolveClientRegistration(
  options: ResolveClientRegistrationOptions,
): Promise<ClientRegistration> {
  if (options.preRegisteredClientId) {
    return {
      method: 'pre-registered',
      clientId: options.preRegisteredClientId,
      ...(options.preRegisteredClientSecret ? { clientSecret: options.preRegisteredClientSecret } : {}),
    };
  }
  if (
    options.clientMetadataDocumentUrl &&
    options.metadata.client_id_metadata_document_supported === true
  ) {
    const clientId = validateClientMetadataDocumentUrl(options.clientMetadataDocumentUrl);
    return { method: 'cimd', clientId };
  }
  if (options.metadata.registration_endpoint) {
    return registerClientDynamically(options);
  }
  if (options.clientMetadataDocumentUrl) {
    throw new Error(
      '授权服务器未声明 client_id_metadata_document_supported，且没有 registration_endpoint；' +
        '不能把 CIMD URL 当作 client_id 硬发（服务器不认），请预注册或换支持 CIMD 的授权服务器',
    );
  }
  throw new Error(
    '没有可用的客户端身份：未预注册 clientId、未提供 CIMD URL、授权服务器也没有 registration_endpoint',
  );
}

function applicationTypeFor(redirectUri: string, explicit?: 'native' | 'web'): 'native' | 'web' {
  if (explicit) return explicit;
  const url = new URL(redirectUri);
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  return loopback ? 'native' : 'web';
}

async function registerClientDynamically(
  options: ResolveClientRegistrationOptions,
): Promise<ClientRegistration> {
  if (!options.metadata.registration_endpoint) throw new Error('缺少 registration_endpoint');
  const fetchImpl = options.fetchImpl ?? fetch;
  const verdict = await assertSafeFetchUrl(options.metadata.registration_endpoint);
  if (!verdict.safe) throw new Error(formatSsrfRejection(verdict));
  const body = {
    client_name: options.clientName ?? 'IHUI AI CLI',
    redirect_uris: [options.redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    application_type: applicationTypeFor(options.redirectUri, options.applicationType),
  };
  const resp = await fetchImpl(options.metadata.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`DCR 失败 HTTP ${resp.status}: ${text.slice(0, 300)}`);
  }
  const json: unknown = await resp.json();
  if (!isRecord(json) || typeof json.client_id !== 'string' || json.client_id === '') {
    throw new Error('DCR 响应缺少 client_id');
  }
  return {
    method: 'dcr',
    clientId: json.client_id,
    ...(typeof json.client_secret === 'string' ? { clientSecret: json.client_secret } : {}),
    ...(typeof json.registration_access_token === 'string'
      ? { registrationAccessToken: json.registration_access_token }
      : {}),
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
