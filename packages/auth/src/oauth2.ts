/**
 * OAuth2 Server 底层逻辑 + PKCE。
 *
 * 设计对齐 legacy `app/api/v1/auth/oauth.py` 的 Coze 多模式 OAuth2 + PKCE。
 * 本文件只实现可复用的底层逻辑（生成 code / 验证 redirect_uri / PKCE 计算 / 换 token），
 * HTTP 端点（/oauth/authorize、/oauth/token）属于 apps/api 的工作。
 *
 * 关键安全点:
 *  - PKCE verifier: 43-128 字符的 [A-Z0-9-._~] 串（RFC 7636）
 *  - S256 challenge: base64url(sha256(verifier))，去 padding
 *  - authorization code: 32 字节随机串，base64url 编码，默认 10 分钟过期
 *  - code 只能兑换一次（exchangeCodeForToken 消费后从 store 删除）
 *  - clientSecret 比对使用时间恒定比较（防时序攻击）
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type IORedis from 'ioredis';

// ---------------------------------------------------------------------------
// OAuth2Client
// ---------------------------------------------------------------------------

export interface OAuth2Client {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scopes: string[];
  name: string;
}

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

export type PkceMethod = 'S256' | 'plain';

/** RFC 7636: verifier 43-128 字符，字符集 [A-Z]/[a-z]/[0-9]/"-"/"."/"_"/"~" */
const PKCE_VERIFIER_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
const PKCE_VERIFIER_MIN = 43;
const PKCE_VERIFIER_MAX = 128;

/**
 * 生成 PKCE code_verifier（43-128 字符随机串）。
 * 默认生成 64 字符，处于 RFC 推荐区间。
 */
export function generatePkceVerifier(length = 64): string {
  if (length < PKCE_VERIFIER_MIN || length > PKCE_VERIFIER_MAX) {
    throw new Error(`PKCE verifier 长度必须为 ${PKCE_VERIFIER_MIN}-${PKCE_VERIFIER_MAX}, 实际 ${length}`);
  }
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += PKCE_VERIFIER_CHARSET[bytes[i]! % PKCE_VERIFIER_CHARSET.length];
  }
  return out;
}

/** base64url 编码（去 padding），RFC 4648 §5 */
function base64url(input: Buffer): string {
  return input.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * 生成 PKCE code_challenge。
 *  - S256:  base64url(sha256(verifier))
 *  - plain: 直接返回 verifier（不推荐，仅兼容老客户端）
 */
export function generatePkceChallenge(verifier: string, method: PkceMethod = 'S256'): string {
  if (method === 'plain') return verifier;
  if (method === 'S256') {
    const digest = createHash('sha256').update(verifier, 'utf8').digest();
    return base64url(digest);
  }
  throw new Error(`不支持的 PKCE method: ${method}`);
}

/**
 * 校验 PKCE verifier 是否匹配 challenge。
 * 使用时间恒定比较防时序攻击。
 */
export function validatePkce(verifier: string, challenge: string, method: PkceMethod): boolean {
  if (!verifier || !challenge) return false;
  let expected: string;
  try {
    expected = generatePkceChallenge(verifier, method);
  } catch {
    return false;
  }
  if (expected.length !== challenge.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(challenge));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// redirect_uri 校验
// ---------------------------------------------------------------------------

/**
 * 校验 redirect_uri 是否在 client 注册的白名单内。
 *  - 严格完全匹配（OAuth2 安全最佳实践，不支持通配符，防 open redirect）
 *  - 大小写敏感（与 URL 规范一致）
 */
export function validateRedirectUri(client: OAuth2Client, redirectUri: string): boolean {
  if (!redirectUri) return false;
  return client.redirectUris.includes(redirectUri);
}

/** 时间恒定的字符串比较 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// authorization code 生成
// ---------------------------------------------------------------------------

/**
 * 生成 authorization code。
 * 注意: 此函数只负责生成 code 字符串，不负责持久化。
 * 调用方需用 AuthorizationCodeStore 把 (code → 完整记录) 存入 Redis / 内存。
 */
export function generateAuthorizationCode(
  _clientId: string,
  _userId: string,
  _scope: string,
  _redirectUri: string,
  expiresInSeconds = 600,
): string {
  if (expiresInSeconds <= 0) {
    throw new Error('expiresInSeconds 必须为正数');
  }
  // 32 字节随机 → base64url → 约 43 字符，不可猜测
  return base64url(randomBytes(32));
}

// ---------------------------------------------------------------------------
// AuthorizationCodeStore
// ---------------------------------------------------------------------------

export interface StoredAuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge?: string;
  codeChallengeMethod?: PkceMethod;
  expiresAt: Date;
}

/**
 * AuthorizationCode 持久化接口。
 *  - 内存实现: 单实例开发/测试用
 *  - Redis 实现: 生产用，跨进程共享
 */
export interface AuthorizationCodeStore {
  save(code: StoredAuthorizationCode): Promise<void>;
  consume(code: string): Promise<StoredAuthorizationCode | null>;
}

/** 内存实现（开发用）。code 消费后即删除，过期项通过 setTimeout 自动清理。 */
export class InMemoryAuthorizationCodeStore implements AuthorizationCodeStore {
  private readonly store = new Map<string, StoredAuthorizationCode>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  async save(entry: StoredAuthorizationCode): Promise<void> {
    this.store.set(entry.code, entry);
    // 过期自动清理,避免未被 consume 的 code 长期驻留导致内存泄漏
    const ttl = entry.expiresAt.getTime() - Date.now();
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.store.delete(entry.code);
        this.timers.delete(entry.code);
      }, ttl);
      // Node.js 事件循环不持有 ref 的 timer 不会阻止进程退出
      timer.unref?.();
      this.timers.set(entry.code, timer);
    } else {
      this.store.delete(entry.code);
    }
  }

  async consume(code: string): Promise<StoredAuthorizationCode | null> {
    const entry = this.store.get(code);
    if (!entry) return null;
    this.store.delete(code);
    // 清理对应的过期定时器
    const timer = this.timers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(code);
    }
    if (entry.expiresAt.getTime() < Date.now()) return null;
    return entry;
  }
}

/**
 * Redis 实现骨架（生产用）。
 *  - key: oauth:code:<code>
 *  - value: JSON 序列化的 StoredAuthorizationCode
 *  - TTL: 与 expiresAt 同步，过期自动清理
 *  - 消费: 用 GETDEL 原子取出并删除，防重放
 */
export class RedisAuthorizationCodeStore implements AuthorizationCodeStore {
  private readonly prefix = 'oauth:code:';

  constructor(private readonly redis: IORedis) {}

  async save(entry: StoredAuthorizationCode): Promise<void> {
    const ttl = Math.max(1, Math.floor((entry.expiresAt.getTime() - Date.now()) / 1000));
    await this.redis.setex(
      `${this.prefix}${entry.code}`,
      ttl,
      JSON.stringify(entry),
    );
  }

  async consume(code: string): Promise<StoredAuthorizationCode | null> {
    const key = `${this.prefix}${code}`;
    // GETDEL 原子取出并删除，防 code 被多次消费（OAuth2 安全要求）
    const raw = await this.redis.getdel(key);
    if (!raw) return null;
    try {
      // JSON.parse 后 expiresAt 是 ISO 字符串(JSON.stringify 把 Date 转字符串),
      // 需 new Date() 还原,否则 .getTime() 抛 TypeError 导致 consume 永远返回 null
      const parsed = JSON.parse(raw) as Omit<StoredAuthorizationCode, 'expiresAt'> & { expiresAt: string };
      const entry: StoredAuthorizationCode = { ...parsed, expiresAt: new Date(parsed.expiresAt) };
      if (entry.expiresAt.getTime() < Date.now()) return null;
      return entry;
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// exchangeCodeForToken
// ---------------------------------------------------------------------------

export interface ExchangeCodeInput {
  code: string;
  codeVerifier?: string;
  clientId: string;
  clientSecret: string;
}

export interface ExchangeCodeResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * 校验 code + client + PKCE，校验通过后消费 code。
 * 注意: 本函数只做校验与 code 消费，不签发 JWT（签发由 apps/api 调用 signAccessToken 完成）。
 *       本函数返回一个占位 token 对（空串），调用方拿到校验结果后自行签发。
 *
 * 为什么这样设计: JWT 签发依赖 familyId / roleId 等业务字段，本包底层不应假设这些字段。
 *                分离校验与签发，让 apps/api 灵活控制 token payload。
 *
 * @returns 校验通过返回 { userId, scopes }，调用方据此签发 JWT。
 *          校验失败抛错（invalid_grant / invalid_client）。
 */
export interface ValidatedCode {
  userId: string;
  scopes: string[];
  clientId: string;
  redirectUri: string;
}

export class OAuth2Error extends Error {
  constructor(
    public readonly code: 'invalid_grant' | 'invalid_client' | 'invalid_request',
    message: string,
  ) {
    super(message);
    this.name = 'OAuth2Error';
  }
}

/**
 * 校验 authorization code 并消费（一次性）。
 * 校验顺序（OAuth2 spec §4.1.3）:
 *  1. code 存在且未过期
 *  2. clientId 匹配
 *  3. clientSecret 匹配（时间恒定比较）
 *  4. codeChallengeMethod + codeVerifier 匹配（PKCE）
 *
 * 校验通过后 code 从 store 删除（防重放）。
 * 校验失败抛 OAuth2Error，调用方据此返回 400 + error code。
 */
export async function validateAuthorizationCode(
  store: AuthorizationCodeStore,
  client: OAuth2Client,
  input: ExchangeCodeInput,
): Promise<ValidatedCode> {
  const entry = await store.consume(input.code);
  if (!entry) {
    throw new OAuth2Error('invalid_grant', 'authorization code 不存在、已过期或已被消费');
  }

  // clientId 必须匹配
  if (entry.clientId !== input.clientId || input.clientId !== client.clientId) {
    throw new OAuth2Error('invalid_client', 'clientId 不匹配');
  }

  // clientSecret 时间恒定比较
  if (!safeEqual(input.clientSecret, client.clientSecret)) {
    throw new OAuth2Error('invalid_client', 'clientSecret 不匹配');
  }

  // PKCE 校验（如果 code 签发时绑定了 challenge）
  if (entry.codeChallenge) {
    const method = entry.codeChallengeMethod ?? 'S256';
    if (!input.codeVerifier) {
      throw new OAuth2Error('invalid_grant', '缺少 code_verifier');
    }
    if (!validatePkce(input.codeVerifier, entry.codeChallenge, method)) {
      throw new OAuth2Error('invalid_grant', 'PKCE 校验失败');
    }
  }

  return {
    userId: entry.userId,
    scopes: entry.scopes,
    clientId: entry.clientId,
    redirectUri: entry.redirectUri,
  };
}

/**
 * 换取 token 的完整流程（校验 + 返回占位 token）。
 *
 * 注意: 返回的 accessToken / refreshToken 为空串。
 * 调用方应在 apps/api 层用 signAccessToken / signRefreshToken 签发真实 JWT。
 * 保留此函数签名是为了与 task 描述对齐：
 *   exchangeCodeForToken(code, codeVerifier, clientId, clientSecret) → { accessToken, refreshToken }
 *
 * 真实使用示例（apps/api 层）:
 *   const result = await validateAuthorizationCode(store, client, { code, codeVerifier, clientId, clientSecret });
 *   const accessToken = await signAccessToken({ userId: result.userId, ... });
 *   const refreshToken = await signRefreshToken({ userId: result.userId, ... });
 */
export async function exchangeCodeForToken(
  store: AuthorizationCodeStore,
  client: OAuth2Client,
  input: ExchangeCodeInput,
): Promise<ExchangeCodeResult> {
  await validateAuthorizationCode(store, client, input);
  // 实际 JWT 签发交给 apps/api（依赖业务 payload），这里返回占位
  return { accessToken: '', refreshToken: '' };
}

// ---------------------------------------------------------------------------
// 便捷: 生成完整的 authorization code 记录并持久化
// ---------------------------------------------------------------------------

export interface CreateAuthorizationCodeInput {
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  pkce?: {
    codeChallenge: string;
    codeChallengeMethod: PkceMethod;
  };
  expiresInSeconds?: number;
}

/**
 * 生成 authorization code 并存入 store。
 * 调用方在 /oauth/authorize 端点收到请求后调用此函数，
 * 然后把 code 通过 redirect_uri 回传给客户端。
 */
export async function createAndStoreAuthorizationCode(
  store: AuthorizationCodeStore,
  input: CreateAuthorizationCodeInput,
): Promise<string> {
  const ttl = input.expiresInSeconds ?? 600;
  const code = generateAuthorizationCode(
    input.clientId,
    input.userId,
    input.scopes.join(' '),
    input.redirectUri,
    ttl,
  );
  const entry: StoredAuthorizationCode = {
    code,
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    scopes: input.scopes,
    codeChallenge: input.pkce?.codeChallenge,
    codeChallengeMethod: input.pkce?.codeChallengeMethod,
    expiresAt: new Date(Date.now() + ttl * 1000),
  };
  await store.save(entry);
  return code;
}

/** 生成一个新的 clientId（用于注册新 OAuth2 应用） */
export function generateClientId(): string {
  return `cli_${randomUUID().replace(/-/g, '')}`;
}

/** 生成一个新的 clientSecret（明文，调用方应自行 bcrypt 哈希后存库） */
export function generateClientSecret(): string {
  return `sec_${base64url(randomBytes(32))}`;
}
