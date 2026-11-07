// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 反向牙用例 —— /share 导出页必须"零外链"(离线断网可读正文)。
 *
 * 立因(现读事实):旧实现把渲染外包给 `<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js">`,
 * 头注却自称 self-contained ⇒ 离线打开分享页只有一片空白正文。对照程序 WorkBuddy 的两份自包含报告
 * 现读 externalScripts=0 / linkTags=0,零外链才是那一档能力的产品承诺。
 *
 * 本文件的三件事,缺一不可:
 *   ① 断言导出 HTML 里指向 .js/.css 的外部 `<script src>` / `<link href>` 数为 0(反向牙);
 *   ② **阳性对照**:把旧的那枚 CDN 外链原样插回 ⇒ 同一把尺子必须报出它(防①因写法退化而假绿);
 *   ③ 受控子集渲染器的行为锁(含转义、协议白名单、图片降级、折叠块),以及支持/不支持清单的形状锁
 *      —— 清单被悄悄删空就等于用例失去射程,故它本身也被断言。
 *
 * 口径:只数**标签级**外部资源(`<script src>` / `<link href>`)。正文里的 `<a href="https://…js">`
 * 是人点了才会走的链接,不是页面自取资源,不计入(计入即假红)。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { renderShareHtml, ShareManager } from '../src/commands/share.js';
import {
  escapeHtml,
  IMAGE_REF_PREFIX,
  MARKDOWN_SUPPORTED_SYNTAX,
  MARKDOWN_UNSUPPORTED_SYNTAX,
  renderMarkdownToHtml,
} from '../src/utils/markdown-to-html.js';

/** 旧实现走过的那条 CDN —— 阳性对照必须用它,证明这把尺子认得当年那个真实缺陷 */
const LEGACY_CDN = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';

const SAMPLE_MARKDOWN = [
  '# 离线分享样例',
  '',
  '> 这是引用块里的说明文字',
  '',
  '| 属性 | 值 |',
  '| --- | ---: |',
  '| 会话 ID | `sess-b3` |',
  '| 消息数 | user: 1 / assistant: 1 |',
  '',
  '- 顶层一项',
  '  - 嵌套一项',
  '1. 有序一',
  '2. 有序二',
  '',
  '```tool_call',
  '{"tool":"read","args":{"path":"a.ts"}}',
  '```',
  '',
  '行内 `code` 与 **粗** 和 *斜* 以及 ~~删~~。',
  '',
  '[可点链接](https://aizhs.top) 与 [危险链接](javascript:alert(1))',
  '',
  '![配图](https://example.com/pic.png)',
  '',
  '<script>alert("注入")</script>',
  '',
  '---',
  '',
  '结尾段落(行尾两个空格硬换行)  ',
  '第二行',
].join('\n');

/** 页面自取的外部资源(脚本与样式):这是"零外链"承诺的唯一射程 */
function externalAssetRefs(html: string): { scripts: string[]; links: string[] } {
  const scripts = [...html.matchAll(/<script\b[^>]*?\bsrc\s*=\s*(['"])([^'"]*)\1/gi)].map((m) => m[2] ?? '');
  const links = [...html.matchAll(/<link\b[^>]*?\bhref\s*=\s*(['"])([^'"]*)\1/gi)].map((m) => m[2] ?? '');
  return { scripts, links };
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
}

describe('① 零外链(反向牙 + 阳性对照)', () => {
  const hash = sha256(SAMPLE_MARKDOWN);
  const html = renderShareHtml(SAMPLE_MARKDOWN, hash, '离线分享样例');

  it('导出页的外部脚本与外部样式均为 0 条', () => {
    expect(externalAssetRefs(html)).toEqual({ scripts: [], links: [] });
  });

  it('连写法层面的外链痕迹都不存在(script src / link 标签 / 图片 / CSS @import / url())', () => {
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain('<script\nsrc=');
    expect(html).not.toContain('<link ');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('@import');
    expect(html).not.toContain('url(http');
    expect(html).not.toContain(LEGACY_CDN);
  });

  it('正文非空:静态渲染已在导出时完成,不依赖任何 JS 执行', () => {
    expect(html).toContain('<h1>离线分享样例</h1>');
    expect(html).toContain('<table class="md-table">');
    expect(html).toContain('<pre><code class="language-tool_call">');
    expect(html).toContain('sess-b3');
  });

  it('阳性对照:把当年那枚 CDN 外链插回,同一把尺子必须抓到它(防①假绿)', () => {
    const tampered = html.replace('<style>', `<script src="${LEGACY_CDN}"></script>\n<style>`);
    expect(tampered).not.toBe(html); // 插入点真实存在,否则对照等于空跑
    expect(externalAssetRefs(tampered).scripts).toEqual([LEGACY_CDN]);
    expect(externalAssetRefs(tampered).links).toEqual([]);
    // 写法层面的兜也认得它
    expect(tampered).toContain('<script src=');
  });

  it('阳性对照:外部样式表 <link rel=stylesheet> 同样被抓', () => {
    const cssUrl = 'https://cdn.example.com/theme.css';
    const tampered = html.replace('</head>', `<link rel="stylesheet" href="${cssUrl}"></head>`);
    expect(externalAssetRefs(tampered).links).toEqual([cssUrl]);
    expect(externalAssetRefs(tampered).scripts).toEqual([]);
  });

  it('阳性对照:正文里的可点击外链链接**不**算页面自取资源(尺子不假红)', () => {
    const withAnchor = renderShareHtml('[脚本报错日志](https://example.com/app.js)', hash, '样例');
    expect(externalAssetRefs(withAnchor)).toEqual({ scripts: [], links: [] });
    expect(withAnchor).toContain('href="https://example.com/app.js"');
  });
});

describe('② 受控子集渲染器行为锁', () => {
  it('标题 / 段落 / 列表嵌套 / 分割线', () => {
    const out = renderMarkdownToHtml('# H1\n\n###### H6\n\n- a\n  - b\n\n1. x\n2. y\n\n---\n');
    expect(out).toContain('<h1>H1</h1>');
    expect(out).toContain('<h6>H6</h6>');
    expect(out).toContain('<ul class="md-list"><li>a<ul class="md-list"><li>b</li></ul></li></ul>');
    expect(out).toContain('<ol class="md-list"><li>x</li><li>y</li></ol>');
    expect(out).toContain('<hr>');
  });

  it('表格含对齐;单元格内行内语法照常渲染', () => {
    const out = renderMarkdownToHtml('| 左 | 中 | 右 |\n| :-- | :-: | --: |\n| `a` | **b** | *c* |\n');
    expect(out).toContain('<th class="md-cell-center">中</th>');
    expect(out).toContain('<th class="md-cell-right">右</th>');
    expect(out).toContain('<td><code>a</code></td>');
    expect(out).toContain('<td class="md-cell-center"><strong>b</strong></td>');
    expect(out).toContain('<td class="md-cell-right"><em>c</em></td>');
  });

  it('引用块 / 段内换行 / 未闭合围栏不吞后文', () => {
    expect(renderMarkdownToHtml('> 引用一行\n> 引用二行')).toContain(
      '<blockquote class="md-quote"><p>引用一行<br>引用二行</p></blockquote>',
    );
    expect(renderMarkdownToHtml('甲  \n乙')).toContain('<p>甲<br>乙</p>');
    expect(renderMarkdownToHtml('```\n未闭合的代码')).toContain('<pre><code>未闭合的代码</code></pre>');
    expect(renderMarkdownToHtml('```json\n{"a":1}\n```\n\n之后的段落')).toContain(
      '<pre><code class="language-json">{&quot;a&quot;:1}</code></pre>',
    );
  });

  it('原文里的 HTML 与脚本一律转义(不做 innerHTML 裸注入)', () => {
    const out = renderMarkdownToHtml('<script>alert(1)</script> 与 <img src=x onerror=alert(1)>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
  });

  it('链接协议白名单:http/https/mailto/# 可点,其余(javascript:/data://file:/协议相对/实体混淆)降级为文本', () => {
    const cases: Array<[string, boolean]> = [
      ['https://aizhs.top', true],
      ['http://localhost:8787/x', true],
      ['mailto:me@example.com', true],
      ['#anchor', true],
      ['javascript:alert(1)', false],
      ['JaVaScRiPt:alert(1)', false],
      ['data:text/html;base64,PHN2Zz4=', false],
      ['file:///C:/Windows/win.ini', false],
      ['//evil.example/x', false],
      ['&#106;avascript:alert(1)', false],
      ['/relative/path.md', false],
    ];
    for (const [target, clickable] of cases) {
      const out = renderMarkdownToHtml(`[点我](${target})`);
      expect(out.includes('<a class="md-link"'), `${target} ⇒ 可点=${clickable}`).toBe(clickable);
    }
  });

  it('图片不产出 <img>(离线零请求),降级为带前缀的文字引用', () => {
    const out = renderMarkdownToHtml('![配图](https://example.com/pic.png)');
    expect(out).not.toContain('<img');
    expect(out).toContain(IMAGE_REF_PREFIX);
    expect(out).toContain('class="md-media-ref"');
  });

  it('collapseLanguages 命中的围栏变默认折叠的 <details>(会话里的 tool_call)', () => {
    const collapsed = renderMarkdownToHtml('```tool_call\n{"a":1}\n```', { collapseLanguages: ['tool_call'] });
    expect(collapsed).toContain('<details class="md-collapse">');
    expect(collapsed).toContain('<summary>折叠内容(tool_call)</summary>');
    const plain = renderMarkdownToHtml('```tool_call\n{"a":1}\n```');
    expect(plain).not.toContain('<details');
  });

  it('深嵌套不炸栈、也不丢内容(深度封顶后折回当前层)', () => {
    const deep = Array.from({ length: 400 }, (_, i) => `${'> '.repeat(i + 1)}第 ${i} 层`).join('\n');
    const out = renderMarkdownToHtml(deep);
    expect(out).toContain('第 399 层');
    expect(out).toContain('<blockquote');
  });

  it('支持/不支持清单是活的(形状锁:非空、无重复、关键形态确在射程内)', () => {
    expect(MARKDOWN_SUPPORTED_SYNTAX.length).toBeGreaterThanOrEqual(8);
    expect(MARKDOWN_UNSUPPORTED_SYNTAX.length).toBeGreaterThanOrEqual(8);
    expect(new Set(MARKDOWN_SUPPORTED_SYNTAX).size).toBe(MARKDOWN_SUPPORTED_SYNTAX.length);
    expect(new Set(MARKDOWN_UNSUPPORTED_SYNTAX).size).toBe(MARKDOWN_UNSUPPORTED_SYNTAX.length);
    expect(MARKDOWN_UNSUPPORTED_SYNTAX).toContain('4 空格缩进代码块');
    expect(MARKDOWN_UNSUPPORTED_SYNTAX).toContain('裸 URL 自动链接');
    expect(MARKDOWN_SUPPORTED_SYNTAX.join('|')).toContain('GFM 管道表格');
  });

  it('escapeHtml 是链路上唯一转义出口(& < > " 全覆盖,幂等性由调用侧单次转义保证)', () => {
    expect(escapeHtml(`&<>"`)).toBe('&amp;&lt;&gt;&quot;');
    expect(renderMarkdownToHtml('A & B < C')).toContain('A &amp; B &lt; C');
  });
});

describe('③ 端到端:真写盘的分享文件仍零外链', () => {
  const sessionId = 'sess-b3-offline-check';
  let fakeHome = '';
  let workspace = '';
  let prevHome: string | undefined;
  let prevUserProfile: string | undefined;

  // mkScratch 的嵌套守卫要枚举**共享** scratch 根(别的席的夹具也在里面),单次可达十几秒;
  // 故只开一枚 scratch 目录,工作区取它的子目录,并给足 hook 预算(不是慢,是别人的现场)。
  const HOOK_TIMEOUT_MS = 120_000;

  beforeAll(() => {
    fakeHome = mkScratch('rea-b3-');
    workspace = path.join(fakeHome, 'workspace');
    fs.mkdirSync(workspace, { recursive: true });
    prevHome = process.env.HOME;
    prevUserProfile = process.env.USERPROFILE;
    // os.homedir() 在类 POSIX 走 HOME、Windows 走 USERPROFILE;两把都钉住,session.ts 取的是调用时现值
    process.env.HOME = fakeHome;
    process.env.USERPROFILE = fakeHome;
    const dir = path.join(fakeHome, '.ihui', 'sessions');
    fs.mkdirSync(dir, { recursive: true });
    const markdown = SAMPLE_MARKDOWN.replace('# 离线分享样例', '# 端到端分享样例');
    fs.writeFileSync(
      path.join(dir, `${sessionId}.json`),
      JSON.stringify(
        {
          id: sessionId,
          createdAt: '2026-11-04T00:00:00.000Z',
          updatedAt: '2026-11-04T00:00:00.000Z',
          workspacePath: workspace,
          modelId: 'qoder-test',
          history: [
            { role: 'system', content: '系统提示不应出现在分享页' },
            { role: 'user', content: markdown },
            { role: 'assistant', content: '响应正文里有 CRLF\r\n换行与 <b>标签</b>。' },
          ],
        },
        null,
        2,
      ),
      'utf-8',
    );
  }, HOOK_TIMEOUT_MS);

  afterAll(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUserProfile;
    rmScratch(fakeHome);
  }, HOOK_TIMEOUT_MS);

  it('share() 落到磁盘的 HTML:零外链 + 正文非空 + 系统提示未泄露 + hash 与原始 Markdown 逐字节自证', async () => {
    const mgr = new ShareManager(workspace);
    const result = await mgr.share(sessionId, { format: 'markdown' });
    const htmlPath = path.join(workspace, '.ihui-agent', 'shared', `${result.hash.slice(0, 8)}.html`);
    expect(fs.existsSync(htmlPath)).toBe(true);
    const html = fs.readFileSync(htmlPath, 'utf-8');

    expect(externalAssetRefs(html)).toEqual({ scripts: [], links: [] });
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain('<link ');
    expect(html).not.toContain(LEGACY_CDN);
    expect(html).toContain('<h1>端到端分享样例</h1>');
    expect(html).not.toContain('系统提示不应出现在分享页');

    // 完整性基准自证:<pre id="raw-markdown"> 里的转义原文 = 参与摘要的那份 markdown(换行已归一)
    const rawBlock = /<pre id="raw-markdown">([\s\S]*?)<\/pre>/.exec(html);
    expect(rawBlock, '分享页必须内嵌原始 Markdown 作为校验基准').not.toBeNull();
    const unescaped = (rawBlock?.[1] ?? '')
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
    expect(unescaped).not.toContain('\r');
    expect(sha256(unescaped)).toBe(result.hash);
    expect(html).toContain(`data-sha256="${result.hash}"`);

    // CRLF 归一后 `<b>` 也只剩文本 ⇒ 分享页不因会话内容而发外部请求
    expect(html).toContain('响应正文里有 CRLF');
    expect(html).toContain('&lt;b&gt;标签&lt;/b&gt;');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
