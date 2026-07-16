/**
 * URL fetch 工具 — 让 Agent 具备联网查询能力。
 *
 * 灵感来源:grok-build 的 URL 抓取能力(Agent 查询最新文档)。
 * 策略:
 *   - 基于 Node 18+ 内置 fetch
 *   - HTML → text 提取:去 script/style/nav/header/footer,保留正文
 *   - 截断到 10K 字符(避免上下文膨胀)
 *   - dangerLevel='read'(只读,不接 hooks 阻断)
 *   - 超时 15s,仅允许 http/https
 */

import type { Tool, ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';

const MAX_OUTPUT_CHARS = 10_000;
const FETCH_TIMEOUT_MS = 15_000;

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
  async execute(args): Promise<ToolResult> {
    const url = args.url as string;
    if (!url) return { success: false, output: '', error: '缺少 url 参数' };
    if (!/^https?:\/\//i.test(url)) {
      return { success: false, output: '', error: '仅支持 http/https URL' };
    }

    const preResult = runPreToolCall('fetch_url', { url });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'IHUI-CLI-Agent/1.0' },
      });
      const contentType = res.headers.get('content-type') ?? '';
      const finalUrl = res.url;
      const status = res.status;

      if (!res.ok) {
        runPostToolCall('fetch_url', { status, finalUrl });
        return {
          success: false,
          output: '',
          error: `HTTP ${status} ${res.statusText}`,
        };
      }

      const raw = await res.text();
      let output: string;

      if (contentType.includes('text/html')) {
        output = htmlToText(raw);
      } else {
        output = raw;
      }

      if (output.length > MAX_OUTPUT_CHARS) {
        output = output.slice(0, MAX_OUTPUT_CHARS) + '\n...(truncated)';
      }

      runPostToolCall('fetch_url', { status, finalUrl, contentType, outputLen: output.length });

      const header = `[${status}] ${finalUrl} (${contentType || 'unknown'})\n\n`;
      return { success: true, output: header + output };
    } catch (err) {
      runPostToolCall('fetch_url', { error: String(err) });
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('aborted')) {
        return { success: false, output: '', error: `请求超时(${FETCH_TIMEOUT_MS / 1000}s)` };
      }
      return { success: false, output: '', error: msg };
    } finally {
      clearTimeout(timer);
    }
  },
};

export const FETCH_TOOLS: Tool[] = [fetch_url];
