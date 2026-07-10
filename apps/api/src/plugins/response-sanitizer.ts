import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    /** 数据主体访问自身数据时（如 GDPR 导出）设置为 true，跳过响应脱敏 */
    skipResponseSanitization?: boolean;
  }
}

/**
 * 敏感字段脱敏规则（响应脱敏与日志脱敏共用）。
 * - 字段名匹配大小写不敏感，子串包含即命中（如 passwordHash / refreshToken 均命中）。
 * - 默认覆盖：password / phone / idCard / bankCard / email / token / secret
 */
export const DEFAULT_SENSITIVE_KEYS = [
  'password',
  'phone',
  'idcard',
  'bankcard',
  'email',
  'token',
  'secret',
] as const;

const MASK = '***';

export interface SanitizerOptions {
  /** 额外的敏感字段名（与默认列表合并，全部小写）。 */
  extraKeys?: readonly string[];
}

/** 构建敏感字段名集合（小写）。 */
export function buildSensitiveKeySet(extra?: readonly string[]): Set<string> {
  return new Set([...DEFAULT_SENSITIVE_KEYS, ...(extra ?? [])].map((k) => k.toLowerCase()));
}

/** 判断字段名是否命中敏感规则（包含匹配，大小写不敏感）。 */
export function isSensitiveKey(key: string, keys: Set<string>): boolean {
  const lower = key.toLowerCase();
  for (const k of keys) {
    if (lower.includes(k)) return true;
  }
  return false;
}

/**
 * 按字段类型做差异化脱敏：
 * - phone：保留前 3 后 4
 * - email：保留首字符 + 域名
 * - 其余敏感字段：统一替换为 ***
 */
export function maskValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') return MASK;
  const lower = key.toLowerCase();
  if (lower.includes('phone')) {
    return value.length <= 7 ? MASK : `${value.slice(0, 3)}****${value.slice(-4)}`;
  }
  if (lower.includes('email')) {
    const at = value.indexOf('@');
    if (at < 1) return MASK;
    return `${value[0]}***${value.slice(at)}`;
  }
  return MASK;
}

/**
 * 递归扫描对象/数组，对命中敏感字段名的值做脱敏。返回新对象（不改原对象）。
 */
export function sanitizeData(data: unknown, keys: Set<string>): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, keys));
  }
  if (data && typeof data === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (isSensitiveKey(k, keys)) {
        out[k] = maskValue(k, v);
      } else {
        out[k] = sanitizeData(v, keys);
      }
    }
    return out;
  }
  return data;
}

/**
 * 响应脱敏管线：onSend 钩子，对 JSON 响应体递归脱敏敏感字段。
 * - 仅处理 application/json 且 2xx 响应
 * - SSE / 流式响应跳过（避免缓冲整流）
 * - 脱敏失败 fail-open（不影响正常响应）
 * - 数据主体访问自身数据时（如 GDPR 导出）可设置 request.skipResponseSanitization
 *   跳过脱敏，以保证数据主体合法访问其完整 PII
 */
const responseSanitizerPlugin: FastifyPluginAsync<SanitizerOptions> = async (
  server: FastifyInstance,
  opts: SanitizerOptions,
) => {
  const keys = buildSensitiveKeySet(opts.extraKeys);

  server.addHook(
    'onSend',
    async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
      // 数据主体访问自身数据时跳过脱敏（GDPR 导出等场景）
      if (request.skipResponseSanitization) return payload;
      const contentType = reply.getHeader('content-type');
      if (typeof contentType !== 'string' || !contentType.includes('application/json')) {
        return payload;
      }
      // SSE 不处理
      if (contentType.includes('text/event-stream')) return payload;
      // 仅处理 2xx
      if (reply.statusCode < 200 || reply.statusCode >= 300) return payload;
      if (typeof payload !== 'string' || payload.length === 0) return payload;

      try {
        const data = JSON.parse(payload) as unknown;
        const masked = sanitizeData(data, keys);
        // 未改动则返回原 payload（避免无谓的序列化）
        if (masked === data) return payload;
        const body = JSON.stringify(masked);
        reply.header('content-length', Buffer.byteLength(body));
        return body;
      } catch {
        // 脱敏失败不影响正常响应（fail-open）
        return payload;
      }
    },
  );
};

export default fp(responseSanitizerPlugin, {
  name: 'response-sanitizer-plugin',
  fastify: '5.x',
});
