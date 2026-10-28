// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * URL fetch 工具 — 让 Agent 具备联网查询能力。
 *
 * 灵感来源:参考行业 Agent 框架的 URL 抓取能力(Agent 查询最新文档)。
 * 策略:
 *   - 基于 Node 18+ 内置 fetch
 *   - HTML → text 提取:去 script/style/nav/header/footer,保留正文
 *   - 响应体硬上限 10 MiB(流式计数,超限中止并报错,不做静默截断)
 *   - 截断到 10K 字符(避免上下文膨胀)
 *   - dangerLevel='read'(只读,不接 hooks 阻断)
 *   - 超时 15s,仅允许 http/https
 */

import type { Tool, ToolResult } from './index.js';
import { assertSafeFetchUrl, formatSsrfRejection } from '@ihui/shared/utils/ssrf-guard';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
import {
  assertFetchLiteralEgress,
  EGRESS_BLOCKED_ERROR_TYPE,
  formatEgressBlockedMessage,
  isEgressBlockedError,
  isProxyAllowlistBlock,
  proxyAllowlistBlockedMessage,
} from './fetch-url-egress.js';

function egressBlockedResult(error: string): ToolResult {
  return { success: false, output: '', error, errorType: EGRESS_BLOCKED_ERROR_TYPE };
}

const MAX_OUTPUT_CHARS = 10_000;
const FETCH_TIMEOUT_MS = 15_000;
/** 重定向跳数上限。不设上限时"每一跳都复校验"这条防线会被一条自指的 Location 拖成死循环。 */
const MAX_REDIRECT_HOPS = 5;
/**
 * 响应体硬上限(对齐上游 webfetch 的 maxResponseBytes=10 MiB)。
 *
 * 上限量的是**下载下来的字节**,不是转成文本后的字符:压缩炸弹/大文件在
 * `res.text()` 面前一律先进内存,拿到之后才轮到 10K 字符截断 —— 那条路
 * 对进程是 OOM,对模型是"前 10K 字符被当成全文引用"。
 */
export const MAX_FETCH_RESPONSE_BYTES = 10 * 1024 * 1024;

type BodyReadResult =
  | { ok: true; text: string }
  /** source 区分"声明超限(未下载)"与"实读超限(已中止)":报错文案不得把前者写成已读字节 */
  | { ok: false; bytesRead: number; source: 'declared' | 'streamed' };

/**
 * 流式读取响应体并施加字节上限。
 *
 * 超限的结局是**明确失败**(errorType=response_too_large),不是截断:
 * 半截正文返回给模型,它会把没读到的部分当作不存在。
 */
async function readBodyWithLimit(res: Response, limitBytes: number): Promise<BodyReadResult> {
  // Content-Length 可信就先拒(省一次完整下载);它本身可以撒谎,所以下面仍逐块计数。
  const declaredRaw = res.headers.get('content-length');
  const declared = declaredRaw === null ? Number.NaN : Number(declaredRaw);
  if (Number.isFinite(declared) && declared > limitBytes) {
    await res.body?.cancel().catch(() => {});
    return { ok: false, bytesRead: declared, source: 'declared' };
  }
  if (!res.body) return { ok: true, text: '' };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.byteLength === 0) continue;
    total += value.byteLength;
    if (total > limitBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, bytesRead: total, source: 'streamed' };
    }
    chunks.push(value);
  }
  // 分块边界可能切开多字节字符,所以先拼字节再整体解码(逐块 toString 会出乱码)。
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
  return { ok: true, text: buf.toString('utf8') };
}

function htmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  return text.trim();
}

export const fetch_url: Tool = {
  name: 'fetch_url',
  description: '抓取 URL 内容并转为纯文本(去脚本/样式/导航)。参数:url(http/https URL,必填)。',
  dangerLevel: 'read',
  parameters: {
    url: { type: 'string', description: '要抓取的 http/https URL' },
  },
  required: ['url'],
  async execute(args, ctx): Promise<ToolResult> {
    const url = args.url as string;
    if (!url) return { success: false, output: '', error: '缺少 url 参数' };
    if (!/^https?:\/\//i.test(url)) {
      return { success: false, output: '', error: '仅支持 http/https URL' };
    }

    const preResult = await runPreToolCall('fetch_url', { url }, ctx.signal);
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      // 逐跳手动跟随:每一跳都重新过一次 SSRF 守卫。
      // 用 `redirect:'follow'` 时,公网站点的一条 302 就能把我们带进内网,
      // 而那次请求已经在"校验通过"的庇护下发出去了。
      let target = url;
      let hops = 0;
      let res: Response;
      for (;;) {
        // Literal-egress guard first: judges only what the URL itself says (no
        // DNS). A literal private/benchmark/special-use IP must surface as
        // EgressBlocked even when the SSRF guard would also reject it.
        const hopUrl = new URL(target);
        try {
          assertFetchLiteralEgress(hopUrl);
        } catch (err) {
          if (!isEgressBlockedError(err)) throw err;
          runPostToolCall('fetch_url', { error: EGRESS_BLOCKED_ERROR_TYPE }, ctx.signal);
          return egressBlockedResult(err.message);
        }
        const verdict = await assertSafeFetchUrl(target);
        if (!verdict.safe) {
          runPostToolCall('fetch_url', { error: verdict.code ?? 'ssrf-denied' }, ctx.signal);
          return { success: false, output: '', error: formatSsrfRejection(verdict), errorType: 'ssrf_denied' };
        }
        res = await fetch(target, {
          signal: controller.signal,
          redirect: 'manual',
          headers: { 'User-Agent': 'IHUI-CLI-Agent/1.0' },
        });
        // Egress-proxy allowlist rejection arrives as a response header (the
        // proxy owns the connection; there is no body to inspect).
        if (isProxyAllowlistBlock(res.headers)) {
          runPostToolCall('fetch_url', { error: EGRESS_BLOCKED_ERROR_TYPE }, ctx.signal);
          await res.body?.cancel().catch(() => {});
          return egressBlockedResult(proxyAllowlistBlockedMessage(hopUrl.hostname));
        }
        if (res.status < 300 || res.status >= 400) break;
        const loc = res.headers.get('location');
        if (!loc) break;
        if (++hops > MAX_REDIRECT_HOPS) {
          runPostToolCall('fetch_url', { error: 'redirect-limit' }, ctx.signal);
          return { success: false, output: '', error: `重定向超过 ${MAX_REDIRECT_HOPS} 跳,已中止`, errorType: 'redirect_limit' };
        }
        // 相对 Location 也要按当前跳解析后再裁决,不得拿原始字符串猜
        target = new URL(loc, target).toString();
        await res.body?.cancel().catch(() => {});
      }
      const contentType = res.headers.get('content-type') ?? '';
      const finalUrl = res.url;
      const status = res.status;

      if (!res.ok) {
        runPostToolCall('fetch_url', { status, finalUrl }, ctx.signal);
        return {
          success: false,
          output: '',
          error: `HTTP ${status} ${res.statusText}`,
        };
      }

      const body = await readBodyWithLimit(res, MAX_FETCH_RESPONSE_BYTES);
      if (!body.ok) {
        runPostToolCall(
          'fetch_url',
          {
            error: 'response_too_large',
            limitBytes: MAX_FETCH_RESPONSE_BYTES,
            bytes: body.bytesRead,
            source: body.source,
          },
          ctx.signal,
        );
        const detail =
          body.source === 'declared'
            ? `Content-Length 声明 ${body.bytesRead} 字节`
            : `已读取 ${body.bytesRead} 字节即中止`;
        return {
          success: false,
          output: '',
          error:
            `响应体超过 ${MAX_FETCH_RESPONSE_BYTES / 1024 / 1024} MiB 上限(${detail}),` +
            `未返回任何内容: ${finalUrl}。如需完整内容请改用支持落盘的下载方式。`,
          errorType: 'response_too_large',
        };
      }
      const raw = body.text;
      let output: string;

      if (contentType.includes('text/html')) {
        output = htmlToText(raw);
      } else {
        output = raw;
      }

      if (output.length > MAX_OUTPUT_CHARS) {
        output = output.slice(0, MAX_OUTPUT_CHARS) + '\n...(truncated)';
      }

      runPostToolCall('fetch_url', { status, finalUrl, contentType, outputLen: output.length }, ctx.signal);

      const header = `[${status}] ${finalUrl} (${contentType || 'unknown'})\n\n`;
      return { success: true, output: header + output };
    } catch (err) {
      runPostToolCall('fetch_url', { error: String(err) }, ctx.signal);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('aborted')) {
        return { success: false, output: '', error: `请求超时(${FETCH_TIMEOUT_MS / 1000}s)` };
      }
      // Scrub before model context: a lower-layer message that names what a
      // host "resolved to" leaks the resolved private/metadata IP.
      let host = url;
      try {
        host = new URL(url).hostname;
      } catch {
        /* keep raw url as the domain label */
      }
      return { success: false, output: '', error: formatEgressBlockedMessage(msg, host) };
    } finally {
      clearTimeout(timer);
    }
  },
};

export const FETCH_TOOLS: Tool[] = [fetch_url];
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
