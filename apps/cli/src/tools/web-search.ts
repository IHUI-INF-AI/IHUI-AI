// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WebSearch 工具 — 让 Agent 具备搜索引擎查询能力。
 *
 * 灵感来源:参考行业 Agent 框架的 WebSearch tool 设计(基于 web search API)。
 * 简化策略(做减法,符合 project_memory "用户要求免费,不想花一分钱"硬约束):
 *   - 使用 DuckDuckGo HTML 接口(https://html.duckduckgo.com/html/?q=...)免费无 key
 *   - HTML 解析提取 top N 结果(标题 + URL + 摘要)
 *   - 不引入外部搜索 SDK,只用 Node 18+ 内置 fetch + 正则
 *   - dangerLevel='read',超时 15s,仅返回前 5 条避免上下文膨胀
 *
 * 安全:
 *   - 仅允许 http/https 协议(自身接口固定,无用户可控 URL 跳转)
 *   - 查询关键词经 URL 编码,避免注入
 *   - 不缓存(每次实时查询)
 *   - 重定向逐跳复校验(redirect:'manual'),响应体有字节闸(F-112)
 */

import type { Tool, ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
import { assertSafeFetchUrl, formatSsrfRejection } from '@ihui/shared/utils/ssrf-guard';

const SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/';
const SEARCH_TIMEOUT_MS = 15_000;
const MAX_RESULTS = 5;
const MAX_SNIPPET_CHARS = 300;
/** 重定向跳数上限:自指 Location 不能把"每跳复校验"拖成死循环 */
const MAX_REDIRECT_HOPS = 5;
/**
 * 响应体硬上限(对齐 fetch_url 的 10 MiB)。
 *
 * 量的是下载字节而不是解码后字符:`res.text()` 会把整份 HTML 先吃进内存,
 * 恶意/异常的超大页面足以把进程撑爆,且模型拿到的"前 5 条结果"来自被撑爆前的截断。
 */
export const MAX_SEARCH_RESPONSE_BYTES = 10 * 1024 * 1024;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

type BodyReadResult =
  | { ok: true; text: string }
  /** source 区分"Content-Length 声明超限(未下载)"与"实读超限(已中止)" */
  | { ok: false; bytesRead: number; source: 'declared' | 'streamed' };

/**
 * 流式读取响应体并施加字节上限;超限是明确失败,不做静默截断。
 *
 * 与 fetch_url 同形态(那边是同一条判据的另一处调用点);本文件只读搜索页,
 * 不存在把半截正文当全文返回的正当理由,故一律报错。
 */
async function readBodyWithLimit(res: Response, limitBytes: number): Promise<BodyReadResult> {
  const declaredRaw = res.headers?.get?.('content-length') ?? null;
  const declared = declaredRaw === null ? Number.NaN : Number(declaredRaw);
  if (Number.isFinite(declared) && declared > limitBytes) {
    await res.body?.cancel().catch(() => {});
    return { ok: false, bytesRead: declared, source: 'declared' };
  }
  if (!res.body) {
    // 无流式 body(空响应体)时整份读取,但仍按字节闸判定
    const text = await res.text();
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > limitBytes) return { ok: false, bytesRead: bytes, source: 'streamed' };
    return { ok: true, text };
  }
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
  // 分块边界可能切开多字节字符,先拼字节再整体解码
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
  return { ok: true, text: buf.toString('utf8') };
}

/** HTML 转义还原(只处理搜索结果中常见实体) */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** 从 DuckDuckGo HTML 页面中提取搜索结果(top N) */
function parseDuckDuckGoResults(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = [];
  // DuckDuckGo HTML 结构:
  //   <a rel="nofollow" class="result__a" href="...">Title</a>
  //   <a class="result__snippet" href="...">Snippet</a>
  //   href 通常是 //duckduckgo.com/l/?uddg=<encoded_url>&...
  const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  const links: Array<{ url: string; title: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    const rawUrl = m[1] ?? '';
    const titleHtml = m[2] ?? '';
    // 提取 uddg 参数中的真实 URL
    const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
    const url = uddgMatch ? decodeURIComponent(uddgMatch[1] ?? '') : rawUrl;
    const title = decodeEntities(titleHtml.replace(/<[^>]+>/g, '').trim());
    if (title && url) links.push({ url, title });
  }

  const snippets: string[] = [];
  while ((m = snippetRegex.exec(html)) !== null) {
    const snip = decodeEntities((m[1] ?? '').replace(/<[^>]+>/g, '').trim());
    snippets.push(snip);
  }

  for (let i = 0; i < Math.min(links.length, max); i++) {
    let snippet = snippets[i] ?? '';
    if (snippet.length > MAX_SNIPPET_CHARS) {
      snippet = snippet.slice(0, MAX_SNIPPET_CHARS) + '...';
    }
    results.push({
      title: links[i]!.title,
      url: links[i]!.url,
      snippet,
    });
  }
  return results;
}

function formatResults(query: string, results: SearchResult[]): string {
  if (results.length === 0) {
    return `查询: ${query}\n无结果`;
  }
  const lines = [`查询: ${query}`, `找到 ${results.length} 条结果 (top ${MAX_RESULTS}):`, ''];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    lines.push(`### ${i + 1}. ${r.title}`);
    lines.push(`URL: ${r.url}`);
    if (r.snippet) lines.push(`摘要: ${r.snippet}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

export const web_search: Tool = {
  name: 'web_search',
  description:
    '使用 DuckDuckGo 搜索引擎查询关键词,返回 top 5 结果(标题+URL+摘要)。适合查询最新文档、技术方案、错误信息等。免费无 API key。',
  dangerLevel: 'read',
  parameters: {
    query: {
      type: 'string',
      description: '搜索关键词(将自动 URL 编码)',
    },
  },
  required: ['query'],
  async execute(args, ctx): Promise<ToolResult> {
    const query = String(args.query ?? '').trim();
    if (!query) {
      return { success: false, output: '', error: '缺少 query 参数' };
    }

    const preResult = await runPreToolCall('web_search', { query }, ctx.signal);
    if (!preResult.proceed) {
      return { success: false, output: '', error: preResult.reason };
    }

    const searchUrl = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      // 逐跳手动跟随:每一跳都重新过一次 SSRF 守卫。
      // redirect:'follow' 下,对端一条 302 就能把已校验的公网 URL 变成未校验的内网请求。
      let target = searchUrl;
      let hops = 0;
      let res: Response;
      for (;;) {
        const verdict = await assertSafeFetchUrl(target);
        if (!verdict.safe) {
          const error = formatSsrfRejection(verdict);
          await runPostToolCall('web_search', { error }, ctx.signal);
          return { success: false, output: '', error, errorType: 'ssrf_denied' };
        }
        res = await fetch(target, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; IHUI-CLI-Agent/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
        });
        if (res.status < 300 || res.status >= 400) break;
        const location = res.headers.get('location');
        if (!location) break;
        if (++hops > MAX_REDIRECT_HOPS) {
          await runPostToolCall('web_search', { error: 'redirect-limit' }, ctx.signal);
          await res.body?.cancel().catch(() => {});
          return {
            success: false,
            output: '',
            error: `重定向超过 ${MAX_REDIRECT_HOPS} 跳,已中止`,
            errorType: 'redirect_limit',
          };
        }
        // 相对 Location 按当前跳解析后再裁决,不拿原始字符串猜
        target = new URL(location, target).toString();
        await res.body?.cancel().catch(() => {});
      }

      if (!res.ok) {
        await runPostToolCall('web_search', { status: res.status }, ctx.signal);
        return {
          success: false,
          output: '',
          error: `DuckDuckGo HTTP ${res.status} ${res.statusText}`,
          errorType: 'network',
        };
      }

      const body = await readBodyWithLimit(res, MAX_SEARCH_RESPONSE_BYTES);
      if (!body.ok) {
        await runPostToolCall(
          'web_search',
          {
            error: 'response_too_large',
            limitBytes: MAX_SEARCH_RESPONSE_BYTES,
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
            `搜索页响应体超过 ${MAX_SEARCH_RESPONSE_BYTES / 1024 / 1024} MiB 上限(${detail}),` +
            '已中止,未返回任何结果。',
          errorType: 'response_too_large',
        };
      }
      const html = body.text;
      const results = parseDuckDuckGoResults(html, MAX_RESULTS);
      await runPostToolCall('web_search', {
        resultCount: results.length,
        htmlLen: html.length,
      }, ctx.signal);
      return {
        success: true,
        output: formatResults(query, results),
      };
    } catch (err) {
      await runPostToolCall('web_search', { error: String(err) }, ctx.signal);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('aborted')) {
        return {
          success: false,
          output: '',
          error: `搜索请求超时(${SEARCH_TIMEOUT_MS / 1000}s)`,
          errorType: 'timeout',
        };
      }
      return {
        success: false,
        output: '',
        error: msg,
        errorType: 'network',
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

export const WEB_SEARCH_TOOLS: Tool[] = [web_search];
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
