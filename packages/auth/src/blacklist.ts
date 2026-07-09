/**
 * Token 黑名单（Redis 实现）。
 *
 * 设计对齐 legacy `app/core/jwt_blacklist.py`:
 *  - key TTL = token 剩余有效期，过期自动清理（无需手动 GC）
 *  - 失败 fail-open: Redis 抖动不阻塞业务（has 返回 false，由调用方决定）
 *  - 用 set 跟踪单个用户的所有 token，便于"踢下线"场景（revokeUserTokens）
 *  - 不写完整 JWT 进 Redis，仅存 token 摘要（SHA256）减少泄露面
 *
 * key 命名:
 *  - 单 token 黑名单:  bl:<sha256(token)>
 *  - 用户 token 集合:  user_tokens:<userId>
 */
import { createHash } from 'node:crypto';
import type IORedis from 'ioredis';

const BLACKLIST_PREFIX = 'bl:';
const USER_TOKENS_PREFIX = 'user_tokens:';

/** 用户被吊销时的兜底 TTL（当原 token 已过期，仍保留 1 天用于防御重放） */
const REVOKED_USER_TOKEN_TTL_SECONDS = 86400;

function fingerprint(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export class TokenBlacklist {
  constructor(private readonly redis: IORedis) {}

  /**
   * 把单个 token 加入黑名单。
   * TTL 自动取 expiresAt 距现在的秒数；已过期则跳过。
   */
  async add(token: string, expiresAt: Date): Promise<void> {
    if (!token) return;
    const ttl = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    if (ttl <= 0) return;
    await this.redis.setex(`${BLACKLIST_PREFIX}${fingerprint(token)}`, ttl, '1');
  }

  /**
   * 检查 token 是否已吊销。
   * Redis 异常时返回 false（fail-open，由调用方结合签名校验决定是否放行）。
   */
  async has(token: string): Promise<boolean> {
    if (!token) return false;
    try {
      return (await this.redis.exists(`${BLACKLIST_PREFIX}${fingerprint(token)}`)) === 1;
    } catch {
      return false;
    }
  }

  /**
   * 吊销某用户的所有已跟踪 token（"踢下线"场景）。
   * 从 user_tokens:<userId> set 取出全部 token，逐个加入黑名单（兜底 TTL 1 天）。
   * 完成后清理 set。
   */
  async revokeUserTokens(userId: string): Promise<void> {
    if (!userId) return;
    const key = `${USER_TOKENS_PREFIX}${userId}`;
    const tokens = await this.redis.smembers(key);
    for (const t of tokens) {
      await this.redis.setex(`${BLACKLIST_PREFIX}${fingerprint(t)}`, REVOKED_USER_TOKEN_TTL_SECONDS, '1');
    }
    await this.redis.del(key);
  }

  /**
   * 跟踪用户的 token（用于 revokeUserTokens 能找到全部 token）。
   * set 的 TTL 与 token 同步，token 过期后自动清理引用。
   */
  async trackUserToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    if (!userId || !token) return;
    const ttl = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    if (ttl <= 0) return;
    const key = `${USER_TOKENS_PREFIX}${userId}`;
    await this.redis.sadd(key, token);
    await this.redis.expire(key, ttl);
  }
}

export function createBlacklist(redis: IORedis): TokenBlacklist {
  return new TokenBlacklist(redis);
}
