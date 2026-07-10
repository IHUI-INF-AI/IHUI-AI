import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

/**
 * XSS 防护插件。
 * - onRequest：递归净化请求体/查询参数中的字符串，对 HTML 特殊字符做实体编码，
 *   并剥离常见 XSS 向量（<script>、onXxx=、javascript:、data: 等）。
 * - onSend：补充浏览器侧防护头 X-XSS-Protection / X-Content-Type-Options。
 *
 * 设计为防御纵深：Fastify 默认对 JSON 响应已做正确转义，本插件额外处理
 * 被回显到 HTML 上下文（如富文本、邮件模板）的存储型 XSS 风险。
 */

const HTML_ENTITIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&/g, '&amp;'],
  [/</g, '&lt;'],
  [/>/g, '&gt;'],
  [/"/g, '&quot;'],
  [/'/g, '&#x27;'],
];

/** 将字符串中的 HTML 特殊字符转为实体编码。 */
function encodeHtmlEntities(input: string): string {
  let out = input;
  for (const [re, entity] of HTML_ENTITIES) {
    out = out.replace(re, entity);
  }
  return out;
}

/** 危险模式：脚本标签 / 内联事件处理器 / 脚本协议 / data URI 脚本。 */
const DANGEROUS_PATTERNS = [
  /<\s*script/i,
  /<\s*\/\s*script/i,
  /\son\w+\s*=/i, // onclick=, onload= ...
  /javascript:\s*/i,
  /data:\s*text\/html/i,
  /vbscript:\s*/i,
  /<\s*iframe/i,
  /<\s*object/i,
  /<\s*embed/i,
  /expression\s*\(/i,
];

/** 净化单个字符串：先剥离危险向量，再实体编码残余尖括号。 */
function sanitizeString(input: string): string {
  let out = input;
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(out)) {
      out = out.replace(pattern, '');
    }
  }
  return encodeHtmlEntities(out);
}

/** 递归净化对象/数组中的字符串值，返回新对象（不改原对象）。 */
function sanitizeValue(data: unknown): unknown {
  if (typeof data === 'string') return sanitizeString(data);
  if (Array.isArray(data)) return data.map((item) => sanitizeValue(item));
  if (data && typeof data === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      out[k] = sanitizeValue(v);
    }
    return out;
  }
  return data;
}

const xssProtectionPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 净化请求体与查询参数（路由参数由框架管控，通常为路径片段，不在此处理）
  server.addHook('onRequest', async (request: FastifyRequest) => {
    if (request.body !== null && request.body !== undefined) {
      request.body = sanitizeValue(request.body);
    }
    if (request.query !== null && request.query !== undefined) {
      request.query = sanitizeValue(request.query) as Record<string, unknown>;
    }
  });

  // 补充浏览器侧 XSS 防护头
  server.addHook('onSend', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  // 暴露净化工具供路由按需调用（如富文本字段二次校验）
  server.decorate('sanitizeInput', sanitizeValue);
};

export default fp(xssProtectionPlugin, {
  name: 'xss-protection-plugin',
  fastify: '5.x',
});

declare module 'fastify' {
  interface FastifyInstance {
    /** 递归净化对象中的字符串（XSS 防护），供路由按需调用。 */
    sanitizeInput: (data: unknown) => unknown;
  }
}
