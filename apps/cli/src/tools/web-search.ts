/**
 * WebSearch 工具 — 让 Agent 具备搜索引擎查询能力。
 *
 * 灵感来源:cli 的 WebSearch tool(基于 xai web search API)。
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
 */

import type { Tool, ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';

const SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/';
const SEARCH_TIMEOUT_MS = 15_000;
const MAX_RESULTS = 5;
const MAX_SNIPPET_CHARS = 300;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
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
  async execute(args): Promise<ToolResult> {
    const query = String(args.query ?? '').trim();
    if (!query) {
      return { success: false, output: '', error: '缺少 query 参数' };
    }

    const preResult = runPreToolCall('web_search', { query });
    if (!preResult.proceed) {
      return { success: false, output: '', error: preResult.reason };
    }

    const searchUrl = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      const res = await fetch(searchUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; IHUI-CLI-Agent/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      });

      if (!res.ok) {
        runPostToolCall('web_search', { status: res.status });
        return {
          success: false,
          output: '',
          error: `DuckDuckGo HTTP ${res.status} ${res.statusText}`,
          errorType: 'network',
        };
      }

      const html = await res.text();
      const results = parseDuckDuckGoResults(html, MAX_RESULTS);
      runPostToolCall('web_search', {
        resultCount: results.length,
        htmlLen: html.length,
      });
      return {
        success: true,
        output: formatResults(query, results),
      };
    } catch (err) {
      runPostToolCall('web_search', { error: String(err) });
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
