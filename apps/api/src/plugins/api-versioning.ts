import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

/**
 * API 版本控制插件。
 * - URL 路径版本：/api/v1/users、/api/v2/users（优先级最高）
 * - Header 版本：Accept-Version: 1（无路径版本时回退）
 * - 默认版本：v1（未显式指定时）
 *
 * 装饰 request.apiVersion（如 "1"）并在响应头回写 X-API-Version。
 * 对已弃用版本设置 Sunset / Deprecation 头，提示客户端迁移。
 */

interface VersioningOptions {
  /** 默认 API 版本（无路径/Header 版本时使用）。 */
  defaultVersion?: string;
  /** 已弃用版本列表，命中时响应 Deprecation/Sunset 头。 */
  deprecatedVersions?: readonly string[];
  /** Sunset 生效日期（HTTP-date），用于 Deprecation 提示。 */
  sunsetDate?: string;
}

const DEFAULT_OPTS: Required<VersioningOptions> = {
  defaultVersion: '1',
  deprecatedVersions: [],
  sunsetDate: '',
};

/** 从 URL 路径解析版本片段，形如 /api/v2/users -> "2"。 */
function parsePathVersion(urlPath: string): string | undefined {
  const segs = urlPath.split('/').filter(Boolean);
  if (segs.length === 0) return undefined;
  const first = segs[0] ?? '';
  if (first === 'api' && segs.length > 1) {
    const second = segs[1] ?? '';
    const m = /^v(\d+)$/i.exec(second);
    if (m) return m[1] ?? undefined;
  }
  return undefined;
}

const apiVersioningPlugin: FastifyPluginAsync<VersioningOptions> = async (
  server: FastifyInstance,
  opts: VersioningOptions,
) => {
  const options: Required<VersioningOptions> = { ...DEFAULT_OPTS, ...opts };

  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split('?')[0] ?? '';
    let version = parsePathVersion(url);

    // 回退到 Accept-Version 头
    if (!version) {
      const headerVersion = request.headers['accept-version'];
      if (typeof headerVersion === 'string' && headerVersion.length > 0) {
        const m = /^v?(\d+)$/i.exec(headerVersion.trim());
        if (m) version = m[1];
      }
    }

    // 默认版本
    if (!version) version = options.defaultVersion;

    request.apiVersion = version;
    reply.header('X-API-Version', version);

    // 弃用提示
    if (options.deprecatedVersions.includes(version)) {
      reply.header('Deprecation', 'true');
      if (options.sunsetDate) {
        reply.header('Sunset', options.sunsetDate);
      }
    }
  });
};

export default fp(apiVersioningPlugin, {
  name: 'api-versioning-plugin',
  fastify: '5.x',
});

declare module 'fastify' {
  interface FastifyRequest {
    /** 当前请求解析出的 API 版本号（如 "1"）。 */
    apiVersion?: string;
  }
}
