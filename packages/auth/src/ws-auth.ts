/**
 * WebSocket 鉴权。
 *
 * 设计对齐 legacy `app/ws/auth.py`:
 *  - generateWsToken: 签发短期 WS 专用 JWT（type='ws', 5 分钟过期）
 *  - verifyWsToken:   校验签名 + 过期 + type，拒绝 access/refresh token 被复用为 WS token
 *  - createWsAuthMiddleware: 返回 socket.io 兼容的中间件函数
 *    （从 handshake auth / query 取 token，校验失败调用 next(err)）
 *
 * 与 legacy 的差异（迁移决策）:
 *  - legacy 支持 3 种 token 来源（Authorization / Sec-WebSocket-Protocol / query）；
 *    TS 版 socket.io 中间件从 socket.handshake.auth / socket.handshake.query 取
 *    （socket.io 协议层封装，更标准）
 *  - legacy 用 access token 做 WS 鉴权；TS 版用独立的短期 WS token（5 分钟），
 *    降低 token 暴露面，且与 access token 隔离（access token 被盗不能直接连 WS）
 *  - Origin 白名单校验留给 apps/api 层（依赖 CORS 配置，不属于本包职责）
 *
 * 使用示例（apps/api, socket.io v4）:
 *   const { createWsAuthMiddleware } = require('@ihui/auth');
 *   io.use(createWsAuthMiddleware());
 *   // 通过后: socket.data.userId
 */
import { SignJWT, jwtVerify } from 'jose';
import { getJwtSecret } from './jwt.js';

const ISSUER = 'ihui-ai';
const ALG = 'HS256';

/** WS token 默认 TTL（5 分钟） */
const WS_TOKEN_TTL_SECONDS = 5 * 60;

/** WS token 校验通过后的载荷 */
export interface WsTokenPayload {
  userId: string;
  /** 原始 payload（含 iat / exp / jti 等），调用方可按需读取 */
  claims?: Record<string, unknown>;
}

/**
 * 签发 WS 专用短期 JWT。
 *  - alg: HS256, 与 access/refresh token 共用 JWT_SECRET
 *  - type='ws'，verifyWsToken 拒绝其他 type
 *  - 默认 5 分钟过期（可通过 payload.exp 覆盖，但不建议超过 1 小时）
 *
 * @param userId  用户 UUID
 * @param payload 附加 claims（如 roleId / familyId），可选
 */
export async function generateWsToken(
  userId: string,
  payload?: Record<string, unknown>,
): Promise<string> {
  if (!userId) throw new Error('userId 不能为空');
  const jwt = new SignJWT({ ...payload, type: 'ws' })
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${WS_TOKEN_TTL_SECONDS}s`);
  return jwt.sign(getJwtSecret());
}

/**
 * 校验 WS token。
 *  - 签名 / 过期 / issuer 校验
 *  - 必须为 type='ws'，拒绝 access/refresh token
 *  - 校验失败返回 null（由调用方决定 close code）
 */
export async function verifyWsToken(token: string): Promise<WsTokenPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: ISSUER,
      algorithms: [ALG],
    });
    if (payload.type !== 'ws') return null;
    const userId = payload.sub;
    if (!userId) return null;
    return {
      userId,
      claims: payload as unknown as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// socket.io middleware
// ---------------------------------------------------------------------------

/**
 * socket.io 兼容的最小 Socket 接口。
 * 避免引入 socket.io 类型依赖；运行时由 socket.io 注入实例。
 */
export interface SocketLike {
  handshake: {
    /** socket.io v4: 客户端通过 auth 字段传递凭证（推荐） */
    auth?: Record<string, unknown>;
    /** 也可通过 query 传递（兜底，会写入 access log，不推荐） */
    query?: Record<string, unknown>;
    /** 原始 headers（用于兼容 Authorization header） */
    headers?: Record<string, string | undefined>;
  };
  /** 中间件通过此字段回传 userId 给业务层 */
  data?: Record<string, unknown>;
}

/**
 * 从 socket 握手信息中提取 token。
 * 优先级:
 *  1. socket.handshake.auth.token（socket.io 推荐）
 *  2. socket.handshake.headers.authorization: Bearer <token>
 *  3. socket.handshake.query.token（兜底）
 */
function extractToken(socket: SocketLike): string | null {
  const { auth, headers, query } = socket.handshake;
  // 1) auth.token
  if (auth?.token && typeof auth.token === 'string') {
    return auth.token;
  }
  // 2) Authorization header
  const authHeader = headers?.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  // 3) query.token
  const q = query?.token;
  if (typeof q === 'string' && q.length > 0) {
    return q;
  }
  return null;
}

/** 中间件 next 函数（与 socket.io 兼容） */
export type NextFunction = (err?: Error) => void;

/**
 * 创建 socket.io 鉴权中间件。
 *  - 校验失败调用 next(err)（socket.io 会拒绝连接）
 *  - 校验成功把 userId 写入 socket.data.userId
 *
 * 使用:
 *   io.use(createWsAuthMiddleware());
 */
export function createWsAuthMiddleware(): (socket: SocketLike, next: NextFunction) => Promise<void> {
  return async (socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      return next(new Error('WS 鉴权失败: 缺少 token'));
    }
    const result = await verifyWsToken(token);
    if (!result) {
      return next(new Error('WS 鉴权失败: token 无效或已过期'));
    }
    if (!socket.data) socket.data = {};
    socket.data.userId = result.userId;
    if (result.claims) {
      socket.data.wsClaims = result.claims;
    }
    next();
  };
}
