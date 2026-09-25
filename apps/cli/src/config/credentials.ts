// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 凭据语义单一来源(O12)— 区分「机器凭据」与「人凭据」,统一分类 / 脱敏 / 出站头 / 入站校验。
 *
 * 两类凭据:
 *   - 机器凭据 = 服务端 API Key(`ihui_` 前缀):不做本地续期、不写 refreshToken,
 *     出站必须同时携带 `Authorization: Bearer ihui_xxx` + `X-Api-Secret: sk_xxx`
 *     (服务端 `API_KEY_REQUIRE_SECRET` 默认 true,缺失即 401 SECRET_REQUIRED)。
 *   - 人凭据 = JWT(`eyJhbGciOi...`):沿用既有 access/refresh 自动续期链路,行为完全不变。
 *
 * 向后兼容(关键约束):
 *   `ihui login` 历史上把 JWT 复制进 `apiKey` 字段(token-manager/login 均如此),因此
 *   `apiKey` 既可能是 JWT 也可能是 API Key。本模块用 `credentialKind` 显式建模该事实,
 *   缺省值 `'auto'` = 按值前缀推断 ⇒ **旧 settings.json 无需任何迁移即可正确判定**。
 *
 * 安全:secret / token 明文**绝不**出现在返回值、日志或 `--json` 输出中,
 *   统一经 `maskSecret`(前 6 后 2 + 长度)脱敏。
 */

// 注:本模块刻意不静态 import '@ihui/types'(见下方 CapabilityGate 说明)。

// ==================== 1. 凭据类型 ====================

/** 服务端 API Key 的公开标识前缀(与 apps/api utils/api-key-hash.ts 对齐)。 */
export const SERVER_API_KEY_PREFIX = 'ihui_';

/** settings.json / CLI 可声明的凭据种类。缺省 'auto' = 按前缀推断(旧配置零迁移)。 */
export type CredentialKindDeclaration = 'auto' | 'api_key' | 'jwt';

/** 实际判定结果。`opaque` = 既非 ihui_ 也非 JWT(历史随机 token),按人凭据保守处理。 */
export type CredentialKind = 'api_key' | 'jwt' | 'opaque';

/** agent 可判别的鉴权错误码(与 apps/api 侧 errorCode 字面量保持一致)。 */
export type AuthErrorCode =
  /** 未提供任何凭据 */
  | 'CREDENTIAL_MISSING'
  /** 凭据已提供但不被接受(未知 / 不匹配) */
  | 'CREDENTIAL_INVALID'
  /** 机器凭据未携带 X-Api-Secret(服务端 API_KEY_REQUIRE_SECRET 默认要求) */
  | 'SECRET_REQUIRED'
  /** 凭据缺少该端点所需 scope */
  | 'SCOPE_REQUIRED'
  /** 该能力不对机器凭据开放(platform 域 / 未登记) */
  | 'M2M_FORBIDDEN'
  /** 限流后端不可用(服务端 fail-close) */
  | 'RATE_BACKEND_UNAVAILABLE';

const CREDENTIAL_KIND_DECLARATIONS: readonly CredentialKindDeclaration[] = [
  'auto',
  'api_key',
  'jwt',
];

const AUTH_ERROR_CODES: readonly AuthErrorCode[] = [
  'CREDENTIAL_MISSING',
  'CREDENTIAL_INVALID',
  'SECRET_REQUIRED',
  'SCOPE_REQUIRED',
  'M2M_FORBIDDEN',
  'RATE_BACKEND_UNAVAILABLE',
];

/** 归一化任意字符串为已知的 AuthErrorCode(非已知码返回 undefined)。 */
export function asAuthErrorCode(raw: unknown): AuthErrorCode | undefined {
  if (typeof raw !== 'string') return undefined;
  return (AUTH_ERROR_CODES as readonly string[]).includes(raw)
    ? (raw as AuthErrorCode)
    : undefined;
}

/** 归一化 CLI flag / env 字符串为凭据种类声明(非法值回退 'auto',不抛错)。 */
export function asCredentialKindDeclaration(
  raw: unknown,
): CredentialKindDeclaration | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase() as CredentialKindDeclaration;
  return CREDENTIAL_KIND_DECLARATIONS.includes(v) ? v : undefined;
}

/**
 * 依赖注入:能力目录闸(capability gate)。
 *
 * 判据的权威来源是 `@ihui/types` 的能力目录(与服务端 `requireCapability` 同一份数据),
 * 但**不在本模块静态引入**该包:`packages/types/src/*.ts` 内部存在 `from '@ihui/types'`
 * 的自引用桶循环,静态引入会把该环拉进本模块每个引用方的模块图(实测在 vitest 下触发
 * `src/commands/agent.ts` ↔ `./settings.js` 的 TDZ 回归)。故由装配方(`ihui serve` 启动路径)
 * 动态 import 后注入。
 *
 * 未注入时本地只判 `SCOPE_REQUIRED`(凭据自带 scopes 即可判定),`M2M_FORBIDDEN` 交由
 * 服务端权威判定后经 `classifyAuthError` 归一化 —— 不因缺注入而放行越权请求(scope 闸仍生效)。
 */
export interface CapabilityGate {
  /** scope 是否已在能力目录登记 */
  isRegistered(scope: string): boolean;
  /** 该 scope 是否允许机器凭据(API Key)触达 */
  isM2MAllowed(scope: string): boolean;
}

let capabilityGate: CapabilityGate | null = null;

/** 装配能力目录闸(传 null 可卸载,测试隔离用)。 */
export function setCapabilityGate(gate: CapabilityGate | null): void {
  capabilityGate = gate;
}

/** 读取当前注入的能力闸。 */
export function getCapabilityGate(): CapabilityGate | null {
  return capabilityGate;
}

// ==================== 2. 凭据分类 ====================

/** JWT 形态:三段 base64url,header 段固定 `eyJ`(= `{"` 的 base64)。 */
export function looksLikeJwt(value: string): boolean {
  return /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}$/.test(value);
}

/** 服务端 API Key 形态:`ihui_` 前缀。 */
export function isServerApiKey(value: string): boolean {
  return value.startsWith(SERVER_API_KEY_PREFIX);
}

/**
 * JWT 载荷的**未验证**视图。签名不在此校验 ⇒ 只可用于"读自己的 token 里的字段"
 * (本地登录态展示、过期判断、宿主绑定属主),**不得**当作鉴权结论。
 */
export interface JwtClaims {
  /** 签发侧 `setSubject(userId)`(`packages/auth/src/jwt.ts`),故 sub 就是 user id */
  sub?: string;
  exp?: number;
  iat?: number;
  roleId?: number;
  [key: string]: unknown;
}

/**
 * 解析 JWT payload(**不验签**),失败返回 null。
 *
 * 这是全 CLI 唯一的 JWT 解码实现:`token-manager` 的过期判断与记忆工具的属主绑定
 * 都读它。"两处算同一件事必须共用一份实现" —— 曾出现过各写一遍 base64url 补位,
 * 一侧改了 padding 另一侧没改,表现为"本机正常、别人机器上永远判成已过期"。
 */
export function decodeJwtClaims(token: string | undefined | null): JwtClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')) as unknown;
    // JSON 合法但不是对象(如 `"abc"` / `123` / `[]`)时不得当成 claims 返回
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
    return payload as JwtClaims;
  } catch {
    return null;
  }
}

/** 纯按值前缀分类;空值返回 undefined(= 无凭据)。 */
export function classifyCredential(value: string | undefined | null): CredentialKind | undefined {
  if (!value) return undefined;
  if (isServerApiKey(value)) return 'api_key';
  if (looksLikeJwt(value)) return 'jwt';
  return 'opaque';
}

/**
 * 结合显式声明判定凭据种类:声明优先于前缀(允许用户强制覆盖),
 * 声明为 'auto'/缺失时回落前缀推断 ⇒ 旧 settings.json 行为不变。
 */
export function resolveCredentialKind(
  value: string | undefined | null,
  declared: CredentialKindDeclaration = 'auto',
): CredentialKind | undefined {
  if (!value) return undefined;
  if (declared === 'api_key') return 'api_key';
  if (declared === 'jwt') return 'jwt';
  return classifyCredential(value);
}

/** 机器凭据判定:只有 api_key 享受「不续期 + 携带 X-Api-Secret」语义。 */
export function isMachineCredential(
  value: string | undefined | null,
  declared: CredentialKindDeclaration = 'auto',
): boolean {
  return resolveCredentialKind(value, declared) === 'api_key';
}

// ==================== 3. 脱敏 ====================

/**
 * 凭据脱敏:前 6 位 + `***` + 后 2 位 + 长度(AGENTS.md §5d 约定)。
 * 长度 < 9 时前 6 与后 2 会重叠 ⇒ 整体遮蔽,只留长度。
 * 空值返回 undefined(**不**返回空串,避免"有凭据但被误判成空"的歧义)。
 */
export function maskSecret(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const len = value.length;
  if (len < 9) return `***(len=${len})`;
  return `${value.slice(0, 6)}***${value.slice(-2)} (len=${len})`;
}

// ==================== 4. 出站凭据 ====================

/** settings.json 中与凭据相关的字段子集(独立定义以免与 Settings 形成循环依赖)。 */
interface CredentialConfigFields {
  apiKey?: string;
  apiSecret?: string;
  credentialKind?: CredentialKindDeclaration;
}

export interface ResolveOutboundCredentialArgs {
  /** CLI flag(最高优先级) */
  cliApiKey?: string;
  cliApiSecret?: string;
  cliCredentialKind?: CredentialKindDeclaration;
  /** settings.json 层 */
  settings?: CredentialConfigFields;
  /** env 层(默认 process.env),键 IHUI_API_KEY / IHUI_API_SECRET / IHUI_CREDENTIAL_KIND */
  env?: NodeJS.ProcessEnv;
}

export interface ResolvedCredential {
  kind: CredentialKind;
  /** 明文 token — 仅用于构造请求头,**禁止**直接写日志 / 输出 */
  token: string;
  /** 机器凭据配套 secret(sk_xxx) */
  secret?: string;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}

/**
 * 解析出站凭据。优先级:CLI flag > settings.json > env(与 resolveEffectiveConfig 一致)。
 * 无凭据返回 null。
 */
export function resolveOutboundCredential(
  args: ResolveOutboundCredentialArgs,
): ResolvedCredential | null {
  const settings = args.settings ?? {};
  const env = args.env ?? process.env;

  const token = firstNonEmpty(args.cliApiKey, settings.apiKey, env.IHUI_API_KEY);
  if (!token) return null;

  const declared =
    args.cliCredentialKind ??
    settings.credentialKind ??
    asCredentialKindDeclaration(env.IHUI_CREDENTIAL_KIND) ??
    'auto';
  const secret = firstNonEmpty(args.cliApiSecret, settings.apiSecret, env.IHUI_API_SECRET);
  const kind = resolveCredentialKind(token, declared) ?? 'opaque';

  return secret ? { kind, token, secret } : { kind, token };
}

/**
 * 构造出站鉴权头:
 *   - 人凭据(JWT/opaque)→ 仅 `Authorization: Bearer <jwt>`(行为与既有一致)
 *   - 机器凭据(api_key)→ `Authorization: Bearer ihui_xxx` + `X-Api-Secret: sk_xxx`
 */
export function buildApiAuthHeaders(
  cred: ResolvedCredential | null | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!cred) return headers;
  headers.Authorization = `Bearer ${cred.token}`;
  if (cred.kind === 'api_key' && cred.secret) headers['X-Api-Secret'] = cred.secret;
  return headers;
}

/** 机器凭据是否需要(但未携带)secret ⇒ 服务端必然回 401 SECRET_REQUIRED。 */
export function needsMissingSecret(
  cred: ResolvedCredential | null | undefined,
  opts?: { requireSecret?: boolean },
): boolean {
  if (opts?.requireSecret === false) return false;
  return cred?.kind === 'api_key' && !cred.secret;
}

export interface CredentialCheckResult {
  ok: boolean;
  kind?: CredentialKind;
  errorCode?: AuthErrorCode;
  message?: string;
  /** 已脱敏,可安全写日志 / NDJSON */
  maskedToken?: string;
  maskedSecret?: string;
}

/**
 * 出站凭据预检(不联网,纯判定)。`ihui serve --check-credential` 据此产出 NDJSON + 退出码。
 * 只报告「本地可判定」的问题;scope 不足 / M2M 受限 / 限流后端不可用由服务端返回后经
 * `classifyAuthError` 归一化。
 */
export function preflightCredentialCheck(
  cred: ResolvedCredential | null,
  opts?: { requireSecret?: boolean },
): CredentialCheckResult {
  if (!cred) {
    return {
      ok: false,
      errorCode: 'CREDENTIAL_MISSING',
      message: '未配置凭据:请 ihui login(人凭据)或设置 IHUI_API_KEY + IHUI_API_SECRET(机器凭据)',
    };
  }
  if (needsMissingSecret(cred, opts)) {
    return {
      ok: false,
      kind: cred.kind,
      errorCode: 'SECRET_REQUIRED',
      message: '机器凭据(ihui_ API Key)缺少 X-Api-Secret:请设置 IHUI_API_SECRET 或 --api-secret',
      maskedToken: maskSecret(cred.token),
    };
  }
  return {
    ok: true,
    kind: cred.kind,
    maskedToken: maskSecret(cred.token),
    maskedSecret: maskSecret(cred.secret),
  };
}

// ==================== 5. 出站 X-Api-Secret 注入(api-client 无法携带自定义头) ====================

/**
 * 纯函数:命中「机器凭据 + 已配 secret + 目标属于本 CLI 的 apiUrl + 调用方未自带该头」时,
 * 返回补齐 `X-Api-Secret` 的新 RequestInit;否则返回 undefined(表示不改写)。
 * 单独导出便于零网络单测。
 */
export function withSecretHeader(
  url: unknown,
  init: RequestInit | undefined,
  cred: ResolvedCredential | null | undefined,
  apiUrl: string,
): RequestInit | undefined {
  if (!cred || cred.kind !== 'api_key' || !cred.secret) return undefined;
  if (typeof url !== 'string' && !(url instanceof URL)) return undefined;
  const target = typeof url === 'string' ? url : url.toString();
  const base = apiUrl.replace(/\/+$/, '');
  if (!base || !target.startsWith(base)) return undefined;

  const headers = new Headers(init?.headers as HeadersInit | undefined);
  // 调用方显式指定时不覆盖(允许运维临时用另一把 secret 做轮换双写)
  if (headers.has('X-Api-Secret')) return undefined;
  headers.set('X-Api-Secret', cred.secret);
  return { ...(init ?? {}), headers };
}

let activeCredential: ResolvedCredential | null = null;
let activeApiUrl = '';
let nativeFetch: typeof globalThis.fetch | null = null;
let patchedFetch: typeof globalThis.fetch | null = null;

/**
 * 安装全局 fetch 薄壳,为出站 API 调用补齐 `X-Api-Secret`。
 * 仅机器凭据生效;人凭据(JWT)完全 passthrough ⇒ 零回归。
 * 幂等:重复调用只更新凭据 / apiUrl,不会层层包裹。返回卸载函数(测试 / 关停用)。
 */
export function installOutboundCredentialHeaders(
  cred: ResolvedCredential | null,
  apiUrl: string,
): () => void {
  activeCredential = cred;
  activeApiUrl = apiUrl;
  if (patchedFetch) return uninstallOutboundCredentialHeaders;
  if (typeof globalThis.fetch !== 'function') return uninstallOutboundCredentialHeaders;

  const native = globalThis.fetch;
  const patched: typeof globalThis.fetch = (input, init) => {
    // 仅改写 (string | URL) + init 形态的请求(api-client 全量走这一形态)。
    // Request 实例自带 body,重建 init 有 body 复位风险 ⇒ 直接 passthrough。
    if (typeof input !== 'string' && !(input instanceof URL)) return native(input, init);
    const nextInit = withSecretHeader(input, init, activeCredential, activeApiUrl);
    return nextInit ? native(input, nextInit) : native(input, init);
  };
  nativeFetch = native;
  patchedFetch = patched;
  globalThis.fetch = patched;
  return uninstallOutboundCredentialHeaders;
}

/**
 * 卸载全局 fetch 薄壳并清空凭据(幂等)。
 * 只有"当前全局 fetch 仍是我装的那一层"才还原 —— 被别人(如测试 mock)套走时
 * 绝不清空对方的实现,只收回自己的状态。
 */
export function uninstallOutboundCredentialHeaders(): void {
  if (patchedFetch && nativeFetch && globalThis.fetch === patchedFetch) {
    globalThis.fetch = nativeFetch;
  }
  patchedFetch = null;
  nativeFetch = null;
  activeCredential = null;
  activeApiUrl = '';
}

/** 诊断用:当前是否已安装出站 secret 注入层。 */
export function isOutboundCredentialHeadersInstalled(): boolean {
  return patchedFetch !== null;
}

// ==================== 6. 入站凭据(ihui serve / WS) ====================

/**
 * 一台 serve 主机放行的机器凭据。
 * 条目格式(env / --machine-key):`ihui_xxx=sk_yyy=chat:write,chat:read`
 * 第二段缺失 ⇒ 无 secret;第三段缺失 ⇒ scopes 空(仅当端点不要求 scope 时可用)。
 * 用 `=` 而非 `:` 分隔,因为 scope 名本身含 `:`。
 */
export interface MachineKeyEntry {
  key: string;
  secret?: string;
  scopes: string[];
}

/** 解析机器凭据清单(多条目用 `;` 或换行分隔)。非法/空条目静默跳过(容错优先)。 */
export function parseMachineKeyList(raw: string | undefined | null): MachineKeyEntry[] {
  if (!raw) return [];
  const entries: MachineKeyEntry[] = [];
  for (const chunk of raw.split(/[;\n]/)) {
    const line = chunk.trim();
    if (!line) continue;
    const [key, secret, scopeList] = line.split('=');
    if (!key || !isServerApiKey(key.trim())) continue;
    const scopes = (scopeList ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    entries.push({
      key: key.trim(),
      ...(secret && secret.trim() ? { secret: secret.trim() } : {}),
      scopes,
    });
  }
  return entries;
}

/** settings.json 里的 serve.machineKeys 形态(结构化管理,避免 env 里堆 secret)。 */
export interface ServeSettingsConfig {
  machineKeys?: Array<{ key?: string; secret?: string; scopes?: string[] }>;
  /** 入站机器凭据是否必须携带 X-Api-Secret(默认 true,对齐服务端 API_KEY_REQUIRE_SECRET) */
  requireApiSecret?: boolean;
}

/** 从 settings.serve 提取合法机器凭据条目(缺 key / 非 ihui_ 前缀的条目丢弃)。 */
export function machineKeysFromSettings(serve: ServeSettingsConfig | undefined): MachineKeyEntry[] {
  const list = serve?.machineKeys;
  if (!Array.isArray(list)) return [];
  const entries: MachineKeyEntry[] = [];
  for (const item of list) {
    if (!item || typeof item.key !== 'string' || !isServerApiKey(item.key)) continue;
    entries.push({
      key: item.key,
      ...(item.secret ? { secret: item.secret } : {}),
      scopes: Array.isArray(item.scopes) ? item.scopes : [],
    });
  }
  return entries;
}

export interface InboundAuthContext {
  /** 既有共享 Bearer(IHUI_AGENT_TOKEN),未配置则该通道关闭 */
  agentToken?: string;
  /** 放行的机器凭据清单 */
  machineKeys?: MachineKeyEntry[];
  /** 机器凭据是否必须携带 X-Api-Secret(默认 true) */
  requireApiSecret?: boolean;
}

export type InboundAuthDecision =
  | { ok: true; subject: 'anonymous' }
  | { ok: true; subject: 'agent-token' }
  | { ok: true; subject: 'machine-key'; scopes: string[] }
  | {
      ok: false;
      status: 401 | 403;
      errorCode: AuthErrorCode;
      message: string;
      requiredScope?: string;
    };

export interface InboundAuthRequest {
  /** `Authorization` 头(支持 `Bearer <token>` 与裸 token) */
  authorization?: string;
  /** `X-Api-Secret` 头 */
  apiSecret?: string;
  /** query `?token=`(WS 握手兼容路径,优先级低于 header) */
  queryToken?: string;
  /** 目标端点要求的 scope(未列 ⇒ 不做 scope 判定) */
  requiredScope?: string;
}

/** 常量时间比较,避免凭据长度/前缀时序侧信道。 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bearerOf(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (!trimmed) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  return (match?.[1] ?? trimmed).trim() || undefined;
}

/** 该主机是否配置了任何入站凭据(全未配置 = 无鉴权模式,保持既有本地开发行为)。 */
export function hasInboundCredentials(ctx: InboundAuthContext): boolean {
  return Boolean(ctx.agentToken) || (ctx.machineKeys?.length ?? 0) > 0;
}

/**
 * 入站请求鉴权:`IHUI_AGENT_TOKEN`(现有通道)**或** 服务端 API Key 透传通道。
 * 决策与错误码对 agent 可判别;scope 判定基于 @ihui/types 能力目录(与服务端同源)。
 */
export function authenticateInbound(
  req: InboundAuthRequest,
  ctx: InboundAuthContext,
): InboundAuthDecision {
  if (!hasInboundCredentials(ctx)) return { ok: true, subject: 'anonymous' };

  const presented = bearerOf(req.authorization) ?? req.queryToken?.trim();
  if (!presented) {
    return {
      ok: false,
      status: 401,
      errorCode: 'CREDENTIAL_MISSING',
      message: 'Missing credential: provide Authorization: Bearer <token>',
    };
  }

  // 通道 1:共享 agent token(人驱动的远程 client,既有行为)
  if (ctx.agentToken && safeEqual(presented, ctx.agentToken)) {
    return { ok: true, subject: 'agent-token' };
  }

  // 通道 2:机器凭据透传
  const entry = ctx.machineKeys?.find((k) => safeEqual(presented, k.key));
  if (!entry) {
    return {
      ok: false,
      status: 401,
      errorCode: 'CREDENTIAL_INVALID',
      message: 'Unauthorized',
    };
  }
  if (ctx.requireApiSecret !== false) {
    if (!req.apiSecret) {
      return {
        ok: false,
        status: 401,
        errorCode: 'SECRET_REQUIRED',
        message: 'X-Api-Secret header is required for machine credentials',
      };
    }
    if (!entry.secret || !safeEqual(req.apiSecret, entry.secret)) {
      return {
        ok: false,
        status: 401,
        errorCode: 'CREDENTIAL_INVALID',
        message: 'Unauthorized',
      };
    }
  }

  const scope = req.requiredScope;
  if (scope) {
    if (!entry.scopes.includes('*') && !entry.scopes.includes(scope)) {
      return {
        ok: false,
        status: 403,
        errorCode: 'SCOPE_REQUIRED',
        message: `Missing capability: ${scope}`,
        requiredScope: scope,
      };
    }
    // 能力闸(判据 = 服务端同一份能力目录,由装配方注入)。未注入时交由服务端权威判定。
    const gate = capabilityGate;
    if (gate) {
      if (!gate.isRegistered(scope)) {
        return {
          ok: false,
          status: 403,
          errorCode: 'M2M_FORBIDDEN',
          message: `No capability registered for ${scope}`,
          requiredScope: scope,
        };
      }
      if (!gate.isM2MAllowed(scope)) {
        return {
          ok: false,
          status: 403,
          errorCode: 'M2M_FORBIDDEN',
          message: 'Capability is not available to API keys',
          requiredScope: scope,
        };
      }
    }
  }

  return { ok: true, subject: 'machine-key', scopes: entry.scopes };
}

// ==================== 7. 服务端错误 → 本地 errorCode ====================

interface ErrorLike {
  message?: unknown;
  status?: unknown;
  statusCode?: unknown;
  errorCode?: unknown;
  code?: unknown;
}

/** 从任意抛出物 / 响应体中提取已存在的 errorCode 字面量。 */
function pickErrorCode(...values: unknown[]): AuthErrorCode | undefined {
  for (const v of values) {
    const code = asAuthErrorCode(typeof v === 'string' ? v : undefined);
    if (code) return code;
  }
  return undefined;
}

/** 上游把 errorCode 揉进消息文本时用于回捞(服务端 requireCapability 的 403 body 常见)。 */
const MESSAGE_CODE_RE =
  /\b(CREDENTIAL_MISSING|CREDENTIAL_INVALID|SECRET_REQUIRED|SCOPE_REQUIRED|M2M_FORBIDDEN|RATE_BACKEND_UNAVAILABLE)\b/;

/** 纯文本兜底:错误消息里直接带着服务端 errorCode 字面量时提取出来。 */
export function extractAuthErrorCodeFromMessage(message: string): AuthErrorCode | undefined {
  const hit = MESSAGE_CODE_RE.exec(message);
  return asAuthErrorCode(hit?.[1]);
}

/**
 * 把上游(api / 网络层)错误归一化为 agent 可判别的 AuthErrorCode。
 * 无鉴权语义的错误返回 undefined ⇒ 调用方保持原始事件形态。
 */
export function classifyAuthError(err: unknown): AuthErrorCode | undefined {
  if (err === null || err === undefined) return undefined;
  const e = err as ErrorLike;
  const direct = pickErrorCode(e.errorCode, e.code);
  if (direct) return direct;

  const status = typeof e.status === 'number' ? e.status : e.statusCode;
  const message = typeof e.message === 'string' ? e.message : String(err);

  if (typeof status === 'number') {
    if (status === 503 && /rate/i.test(message)) return 'RATE_BACKEND_UNAVAILABLE';
    if (status === 403) {
      if (/not available to API keys/i.test(message)) return 'M2M_FORBIDDEN';
      if (/missing (any )?capability|scope/i.test(message)) return 'SCOPE_REQUIRED';
    }
    if (status === 401 && /secret/i.test(message)) return 'SECRET_REQUIRED';
  }

  // 兜底:上游把 errorCode 揉进了消息文本(fetch 非 2xx 时常见)
  return extractAuthErrorCodeFromMessage(message);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
