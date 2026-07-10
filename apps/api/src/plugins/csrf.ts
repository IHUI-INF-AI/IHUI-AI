import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import { config } from '../config/index.js';

/**
 * CSRF 防护（双提交 Cookie 模式）。
 *
 * 流程：
 *  1. GET /api/csrf-token 签发 token，同时 set-cookie XSRF-TOKEN（httpOnly）
 *  2. 前端写请求（POST/PUT/PATCH/DELETE）需在 header X-CSRF-Token 带相同 token
 *  3. 服务端校验 cookie 值与 header 一致（用 HMAC 签名防伪造，constant-time 比较防计时攻击）
 *
 * 豁免：
 *  - 安全方法（GET/HEAD/OPTIONS）
 *  - Bearer JWT 鉴权请求（JWT 本身即 CSRF 防护）
 *  - 公开白名单（登录/回调/支付通知等无状态端点）
 */

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_TTL = 12 * 3600; // 12 小时（秒）

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** 公开白名单路径前缀（无需 CSRF 校验）。 */
const PUBLIC_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/ai/callback',
  '/api/payment/callback',
  '/api/payments/callback',
  '/api/webhook',
];

function secret(): string {
  return config.JWT_SECRET;
}

/**
 * 生成 CSRF token 与 cookie 值。
 * 格式: token = "<sig>.<expiry>.<nonce>"，cookie = hex(sig|expiry|nonce)
 */
function generateCsrfToken(): { token: string; cookieValue: string } {
  const nonce = randomBytes(16).toString('base64url');
  const expiry = Math.floor(Date.now() / 1000) + CSRF_TOKEN_TTL;
  const msg = `${expiry}|${nonce}`;
  const sig = createHmac('sha256', secret()).update(msg).digest('hex');
  const token = `${sig}.${expiry}.${nonce}`;
  const cookieValue = Buffer.from(`${sig}|${expiry}|${nonce}`, 'utf8').toString('hex');
  return { token, cookieValue };
}

/** 校验 header token 与 cookie 值一致且签名有效。 */
function verifyCsrfToken(token: string | undefined, cookieValue: string | undefined): boolean {
  if (!token || !cookieValue) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [sig, expStr, nonce] = parts as [string, string, string];
  const expiry = Number(expStr);
  if (!Number.isInteger(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;

  let raw: string;
  try {
    raw = Buffer.from(cookieValue, 'hex').toString('utf8');
  } catch {
    return false;
  }
  const cookieParts = raw.split('|');
  if (cookieParts.length !== 3) return false;
  const [sigB, expB, nonceB] = cookieParts as [string, string, string];
  if (expB !== expStr) return false;

  // constant-time 比较 nonce
  const a = Buffer.from(nonce);
  const b = Buffer.from(nonceB);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  // 重算签名并比较
  const expected = createHmac('sha256', secret()).update(`${expiry}|${nonce}`).digest('hex');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf) && timingSafeEqual(Buffer.from(sig), Buffer.from(sigB));
}

export interface CsrfPluginOptions {
  /** 额外的公开白名单路径前缀。 */
  publicPrefixes?: readonly string[];
}

const csrfPlugin: FastifyPluginAsync<CsrfPluginOptions> = async (
  server: FastifyInstance,
  opts: CsrfPluginOptions,
) => {
  // 注册 @fastify/cookie（若已注册则跳过）
  await server.register(cookie);

  const publicPrefixes = [...PUBLIC_PREFIXES, ...(opts.publicPrefixes ?? [])];

  // GET /api/csrf-token：签发 token + cookie
  server.get('/api/csrf-token', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { token, cookieValue } = generateCsrfToken();
    reply.setCookie(CSRF_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: CSRF_TOKEN_TTL,
    });
    return { code: 0, message: 'success', data: { csrfToken: token } };
  });

  // 写请求校验 CSRF
  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase();
    if (SAFE_METHODS.has(method)) return;

    const url = request.url.split('?')[0] ?? '';
    // 公开白名单豁免
    if (publicPrefixes.some((p) => url === p || url.startsWith(p + '/') || url.startsWith(p))) {
      return;
    }
    // Bearer JWT 请求豁免（JWT 本身防 CSRF）
    const auth = request.headers.authorization ?? '';
    if (auth.toLowerCase().startsWith('bearer ')) return;

    const cookieValue = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies?.[
      CSRF_COOKIE_NAME
    ];
    const rawHeader = request.headers[CSRF_HEADER_NAME];
    const headerToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!verifyCsrfToken(headerToken, cookieValue)) {
      return reply.status(403).send({
        code: 403,
        message: 'CSRF token missing or invalid',
      });
    }
  });
};

export default fp(csrfPlugin, {
  name: 'csrf-plugin',
  fastify: '5.x',
});
