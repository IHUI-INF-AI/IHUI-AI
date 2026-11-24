// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * BUG-0003 回归:/share 存储型 XSS —— 会话正文不得作为可执行标签/属性进入 HTML。
 *
 * 2026-11-07 重钉到当前实现:正文由零依赖受控子集渲染器
 * (apps/cli/src/utils/markdown-to-html.ts)在导出时生成,安全口径钉四道闸:
 *   ① 所有文本节点必经 escapeHtml,原始 HTML 块不解析、只转义;
 *   ② 链接目标白名单 http(s)/mailto/#,伪协议一律回退为字面文本(不产出 href);
 *   ③ 图片不产出 <img src>(降级为文字引用),分享页对外零请求;
 *   ④ 输出保证不含 <script src= 与 <link 。
 * 反向对照:正常 markdown(标题/列表/表格/链接/代码块)观感不变。
 */
import { describe, it, expect } from 'vitest';

import { renderShareHtml } from '../src/commands/share.js';
import { renderMarkdownToHtml } from '../src/utils/markdown-to-html.js';

const HASH = 'a'.repeat(64);

/**
 * 只扫「真实标签」:渲染器保证文本节点必经 escapeHtml(< → &lt;),
 * 因此产物里所有裸 < 开头的标签都是渲染器亲手产出的可信标签。
 * 恶意 payload 作为转义后的可见文本(含 onerror= 字样)不算命中。
 */
function assertNoExecutableTag(html: string): void {
  const realTags = html.match(/<[a-zA-Z/][^>]*>/g) ?? [];
  for (const tag of realTags) {
    expect(tag.toLowerCase()).not.toMatch(
      /^<\/?(script|iframe|object|embed|svg|img|form|meta|base|input|video|audio|source)\b/,
    );
    expect(tag).not.toMatch(/\son[a-z]+\s*=/i); // 无事件属性(on*)
    expect(tag).not.toMatch(/(?:href|src|action)\s*=\s*["']?\s*(?:javascript|vbscript|data):/i);
  }
  expect(html).not.toMatch(/<script\s+src=/i);
  expect(html).not.toMatch(/<link\s/i);
}

describe('BUG-0003 闸①:原始 HTML 不解析、只转义', () => {
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

  it.each(payloads)('payload %s 只能以转义文本出现', (payload) => {
    const out = renderMarkdownToHtml(payload);
    assertNoExecutableTag(out);
    expect(out).toContain('&lt;'); // 原文以实体形态可见(离线可读性不丢)
  });

  it('行内代码内 payload 原样转义,不产出可执行标签', () => {
    const out = renderMarkdownToHtml('示例 `' + '<img src=x onerror=alert(1)>' + '` 结束');
    assertNoExecutableTag(out);
    expect(out).toContain('<code>');
    expect(out).toContain('&lt;img');
  });

  it('围栏代码块内 payload 原样转义', () => {
    const out = renderMarkdownToHtml('```html\n<img src=x onerror=alert(1)>\n```');
    assertNoExecutableTag(out);
    expect(out).toContain('<pre><code');
    expect(out).toContain('&lt;img');
  });
});

describe('BUG-0003 闸②:链接目标白名单', () => {
  it('伪协议 markdown 链接回退为字面文本,不产出 href', () => {
    for (const target of ['javascript:alert(1)', 'JaVaScRiPt&colon;alert(1)', 'data:text/html,x', 'vbscript:x']) {
      const out = renderMarkdownToHtml(`[click](${target})`);
      expect(out).not.toMatch(/<a\b/i);
      expect(out).not.toMatch(/href\s*=/i);
      // 字面回退,信息不丢(& 实体会被二次转义为 &amp;,如 &colon; → &amp;colon;)
      expect(out).toContain(`[click](${target.replace('&', '&amp;')})`);
    }
  });

  it('实体混淆伪协议也被阻断', () => {
    const out = renderMarkdownToHtml('[click](https://example.com/?x=&#106;avascript:alert(1))');
    assertNoExecutableTag(out);
  });

  it('http(s)/mailto/# 锚点保留并带 noopener', () => {
    const out = renderMarkdownToHtml(
      '[https](https://a.example) [mail](mailto:a@b.c) [锚](#section-1)',
    );
    expect(out).toContain('href="https://a.example"');
    expect(out).toContain('href="mailto:a@b.c"');
    expect(out).toContain('href="#section-1"');
    expect(out).toContain('rel="noopener noreferrer"');
  });
});

describe('BUG-0003 闸③:图片零请求', () => {
  it('图片语法降级为文字引用,不产出 <img src>', () => {
    const out = renderMarkdownToHtml('![截图](https://example.com/a.png)');
    assertNoExecutableTag(out);
    expect(out).toContain('md-media-ref');
    expect(out).not.toMatch(/<img\b/i);
  });

  it('data: 图片同样不产出 src', () => {
    const out = renderMarkdownToHtml('![x](data:image/png;base64,AAAA)');
    expect(out).not.toMatch(/<img\b/i);
    assertNoExecutableTag(out);
  });
});

describe('BUG-0003 闸④:输出硬保证', () => {
  it('任意混合 payload 产物无 <script src= 与 <link ', () => {
    const mixed = [
      '<script src="https://evil.example/x.js"></script>',
      '<link rel="stylesheet" href="https://evil.example/x.css">',
      '<img src=x onerror=alert(1)>',
      '[x](javascript:alert(1))',
    ].join('\n\n');
    const out = renderMarkdownToHtml(mixed);
    assertNoExecutableTag(out);
    expect(out).not.toMatch(/<script\s+src=/i);
    expect(out).not.toMatch(/<link\s/i);
  });
});

describe('BUG-0003 生成的分享页(renderShareHtml 终态)', () => {
  it('恶意 payload 不以可执行形式进入页面,转义文本可见', () => {
    const html = renderShareHtml(
      '<script>alert(1)</script><img src=x onerror=alert(1)>\n\n# 正常标题',
      HASH,
      'XSS 回归',
    );
    // 页面自身的完整性校验脚本是可信静态块;payload 只能以转义形态出现
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;alert(1)');
    expect(html).toContain('&lt;img');
    // 正常 markdown 正文仍按 markdown 渲染(未整体转义)
    expect(html).toContain('<h1>正常标题</h1>');
  });

  it('标题与 hash 元数据面转义', () => {
    const html = renderShareHtml('正文', HASH, '<script>alert(1)</script>');
    expect(html).not.toContain('<title><script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain(`data-sha256="${HASH}"`);
  });

  it('正文区(不含量产完整性脚本)无可执行标签', () => {
    const bodyHtml = renderMarkdownToHtml(
      '<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n![y](data:text/html,evil)',
    );
    assertNoExecutableTag(bodyHtml);
  });

  it('正常 markdown 观感不变', () => {
    const md = '# 标题\n\n- 列表项\n- **粗体**\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconst a = 1;\n```\n\n> 引用\n\n`行内码` 与 ~~删除~~ 及 *斜体*';
    const out = renderMarkdownToHtml(md);
    expect(out).toContain('<h1>标题</h1>');
    expect(out).toContain('<strong>粗体</strong>');
    expect(out).toContain('<table class="md-table">');
    expect(out).toContain('<blockquote class="md-quote">');
    expect(out).toContain('<pre><code class="language-js">const a = 1;</code></pre>');
    expect(out).toContain('<code>行内码</code>');
    expect(out).toContain('<del>删除</del>');
    expect(out).toContain('<em>斜体</em>');
    assertNoExecutableTag(out);
  });
});
