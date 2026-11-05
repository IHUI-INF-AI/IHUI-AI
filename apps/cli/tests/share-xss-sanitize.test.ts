// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BUG-0003 回归:/share 存储型 XSS —— 会话正文不得作为可执行标签/属性进入 HTML。
 *
 * 两道闸都钉:
 *   ① `escapeMarkdownRawHtml`:原文 `<script>` / `<img onerror>` 在嵌入页面前变实体;
 *   ② `sanitizeRenderedHtml`:marked 产物再过标签/属性/URL 三重白名单,`on*` 与
 *      `javascript:` 一律不留。
 * 反向对照:正常 markdown(标题/表格/链接/代码块/行内代码)观感不变。
 */
import { describe, it, expect } from 'vitest';

import {
  ShareManager,
  escapeMarkdownRawHtml,
  sanitizeRenderedHtml,
} from '../src/commands/share.js';

const HASH = 'a'.repeat(64);

function renderPage(markdown: string): string {
  const mgr = new ShareManager(process.cwd());
  return (mgr as unknown as { renderHtml(m: string, h: string, t: string): string }).renderHtml(
    markdown,
    HASH,
    'XSS 回归',
  );
}

describe('BUG-0003 escapeMarkdownRawHtml', () => {
  it('转义 <script> 原始标签', () => {
    const out = escapeMarkdownRawHtml('<script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).toBe('&lt;script>alert(1)&lt;/script>');
  });

  it('转义 <img onerror> 原始标签', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const out = escapeMarkdownRawHtml(payload);
    expect(out).not.toContain('<img');
    expect(out).not.toMatch(/<[^&]/);
    expect(out).toContain('&lt;img');
  });

  it('代码块内原文原样保留(由 marked 负责转义)', () => {
    const md = '```html\n<img src=x onerror=alert(1)>\n```';
    expect(escapeMarkdownRawHtml(md)).toBe(md);
  });

  it('行内代码内原文原样保留', () => {
    const md = '示例 `'+'<img src=x onerror=alert(1)>'+'` 结束';
    expect(escapeMarkdownRawHtml(md)).toBe(md);
  });

  it('正常 markdown 不受影响', () => {
    const md = '# 标题\n\n- 列表项\n- **粗体**\n\n| a | b |\n|---|---|\n| 1 | 2 |';
    expect(escapeMarkdownRawHtml(md)).toBe(md);
  });
});

describe('BUG-0003 sanitizeRenderedHtml', () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<img src="javascript:alert(1)">',
    '<a href="javascript:alert(1)">click</a>',
    '<a href="JaVaScRiPt&colon;alert(1)">click</a>',
    '<svg onload=alert(1)></svg>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<div onclick="alert(1)">x</div>',
  ];

  it.each(payloads)('恶意载荷 %s 被中和', (payload) => {
    const out = sanitizeRenderedHtml(payload);
    expect(out).not.toMatch(/<\s*(script|iframe|svg|object|embed|form|meta|link|base)\b/i);
    expect(out).not.toMatch(/\bon[a-z]+\s*=/i);
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('正常渲染结果原样保留', () => {
    const normal =
      '<h2>标题</h2><p>正文 <strong>粗体</strong> <em>斜体</em> ' +
      '<a href="https://example.com" title="链接">链接</a></p>' +
      '<table><thead><tr><th colspan="2">表头</th></tr></thead>' +
      '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>' +
      '<pre><code class="language-js">const a = 1 &lt; 2;</code></pre>';
    expect(sanitizeRenderedHtml(normal)).toBe(normal);
  });

  it('相对链接与 http(s)/mailto 保留,javascript:/data: 丢弃', () => {
    expect(sanitizeRenderedHtml('<a href="/docs">相对</a>')).toContain('href="/docs"');
    expect(sanitizeRenderedHtml('<a href="https://a.example">https</a>')).toContain('href="https://a.example"');
    expect(sanitizeRenderedHtml('<a href="mailto:a@b.c">mail</a>')).toContain('href="mailto:a@b.c"');
    expect(sanitizeRenderedHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('href=');
    expect(sanitizeRenderedHtml('<img src="data:image/png;base64,AAAA">')).not.toContain('src=');
  });
});

describe('BUG-0003 生成的分享页', () => {
  it('恶意 payload 不以可执行标签形式进入页面', () => {
    const html = renderPage('<script>alert(1)</script><img src=x onerror=alert(1)>\n\n# 正常标题');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;script');
    expect(html).toContain('&lt;img');
    // 正常 markdown 仍在(未整体转义)
    expect(html).toContain('# 正常标题');
  });

  it('innerHTML 前必须经过净化函数', () => {
    const html = renderPage('hello');
    expect(html).toContain('container.innerHTML = sanitizeRenderedHtml(window.marked.parse(raw))');
    // 净化实现与页面同源注入(不是只改调用点)
    expect(html).toContain('function sanitizeRenderedHtml');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
