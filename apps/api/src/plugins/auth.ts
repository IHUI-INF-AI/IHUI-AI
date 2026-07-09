import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import jwtPlugin from '@fastify/jwt';
import { verifyAccessToken, type JWTPayload } from '@ihui/auth';
import { config } from '../config/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    jwtPayload?: JWTPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
  }
}

/**
 * 从 Authorization header 提取 Bearer token 并验证。
 * 使用 @ihui/auth 的 jose verifyAccessToken，拒绝 refresh token 被当作 access token 使用。
 * 失败时抛出带 statusCode 的错误，由全局错误处理器统一返回 401。
 */
export async function authenticate(request: FastifyRequest): Promise<JWTPayload> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    const err = new Error('Authentication required');
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }

  const token = header.slice('Bearer '.length).trim();
  let payload: JWTPayload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    const err = new Error('Invalid or expired token');
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }

  request.userId = payload.userId;
  request.jwtPayload = payload;
  return payload;
}

/**
 * Fastify 插件：注册 @fastify/jwt（secret 从 config.JWT_SECRET），
 * 并注册 authenticate 相关的 request 装饰器。
 *
 * 注意：authenticate 函数实际调用 @ihui/auth.verifyAccessToken (jose)，
 * 以确保 refresh/access token 类型隔离；@fastify/jwt 在此注册以便后续扩展使用。
 */
const authPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  await server.register(jwtPlugin, {
    secret: config.JWT_SECRET,
    sign: { algorithm: 'HS256' },
  });
  server.decorateRequest('userId', undefined);
  server.decorateRequest('jwtPayload', undefined);
};

export default fp(authPlugin, {
  name: 'auth-plugin',
  fastify: '5.x',
});
