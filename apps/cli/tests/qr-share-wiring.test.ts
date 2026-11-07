// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 分享页二维码那一格:从「恒返回空串的降级」接到真产出(goal-b49 / Z6)。
 *
 * 三件事缺一不可:
 *   ① `ShareResult.qrCode` 是真 data URL(不再是空串),且分享页里那张图与它是**同一枚矩阵**
 *      —— 把页面内联 SVG 的 `d` 行程反解回模块矩阵,与编码器输出逐格等值(渲染层不另画一张)。
 *   ② 反向牙:页面仍然零外链(二维码是内联 SVG,不是 `<img src>` / 不是外部样式),
 *      并带一条**阳性对照**——把旧 CDN 外链插回,同一把尺子必须抓到它。
 *   ③ 失败方向:编码器具名拒绝时,页面这一格整块不出现(不塞「看起来像二维码」的半成品),
 *      且 3 参数老调用形态仍然可用(既有 share-self-contained 用例不因此漂移)。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;同 share-self-contained.test.ts 口径
import { renderShareHtml, ShareManager } from '../src/commands/share.js';
import { encodeQr, renderQrSvg, renderQrSvgDataUrl } from '../src/qr/index.js';

const LEGACY_CDN = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
const SESSION_ID = 'sess-z6-qr-check';
const HOOK_TIMEOUT_MS = 120_000;

const SAMPLE_MARKDOWN = ['# Z6 二维码样例', '', '正文:**粗** 与 `code`。', ''].join('\n');

/** 页面自取资源:零外链承诺的唯一射程(与 share-self-contained 同一口径) */
function externalAssetRefs(html: string): { scripts: string[]; links: string[] } {
  const scripts = [...html.matchAll(/<script\b[^>]*?\bsrc\s*=\s*(['"])([^'"]*)\1/gi)].map((m) => m[2] ?? '');
  const links = [...html.matchAll(/<link\b[^>]*?\bhref\s*=\s*(['"])([^'"]*)\1/gi)].map((m) => m[2] ?? '');
  return { scripts, links };
}

/** 把内联 SVG 的 `d` 行程反解回模块矩阵(与渲染层同一把尺,不 import 渲染层内部实现) */
function matrixFromInlineSvg(svg: string): { size: number; rows: string[] } {
  const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  const extent = viewBox ? Number(viewBox[1]) : 0;
  const grid: number[][] = Array.from({ length: extent }, () => new Array<number>(extent).fill(0));
  for (const match of svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    const width = Number(match[3]);
    for (let dx = 0; dx < width; dx += 1) grid[y]![x + dx] = 1;
  }
  const rows = grid.map((row) => row.join(''));
  // 静区 4 模块:去掉四周后再返回
  const inner = rows.slice(4, extent - 4).map((row) => row.slice(4, extent - 4));
  return { size: inner.length, rows: inner };
}

/** 只取页面里那一枚二维码 SVG(按 aria-label 定位,避免和别的图形混) */
function inlineQrSvg(html: string): string {
  const start = html.indexOf('<svg');
  if (start < 0) return '';
  const end = html.indexOf('</svg>', start);
  return end < 0 ? '' : html.slice(start, end + 6);
}

describe('① 分享页那一格接上真产出', () => {
  it('renderShareHtml 带 qr 块时:内联 SVG 与编码器输出逐格等值,且目标链接以文字同屏可核', () => {
    const target = 'file:///G:/IHUI-AI/.ihui-agent/shared/abcd1234.html';
    const svg = renderQrInlineFor(target);
    const html = renderShareHtml(SAMPLE_MARKDOWN, 'f'.repeat(64), 'Z6 样例', { svg, target });
    expect(html).toContain('<svg');
    expect(html).toContain('share-qr-caption');
    expect(html).toContain(target.replace(/&/g, '&amp;'));

    const parsed = matrixFromInlineSvg(inlineQrSvg(html));
    const encoded = encodeQr(target);
    const expectedRows: string[] = [];
    for (let y = 0; y < encoded.grid.size; y += 1) {
      let row = '';
      for (let x = 0; x < encoded.grid.size; x += 1) row += encoded.grid.modules[y * encoded.grid.size + x] ? '1' : '0';
      expectedRows.push(row);
    }
    expect(parsed.size).toBe(encoded.grid.size);
    expect(parsed.rows).toEqual(expectedRows);
  });

  it('同一枚短链:内联 SVG 与 data URL 两种形态反解回同一张图(渲染层只有一把尺)', () => {
    const url = 'https://aizhs.top/shared/z6-sample';
    const inline = renderQrInlineFor(url);
    const dataUrl = renderQrSvgDataUrl(encodeQr(url).grid);
    const fromData = decodeURIComponent(dataUrl.slice('data:image/svg+xml,'.length));
    expect(matrixFromInlineSvg(fromData).rows).toEqual(matrixFromInlineSvg(inline).rows);
  });
});

describe('② 反向牙:二维码进页后仍然零外链', () => {
  const target = 'file:///G:/IHUI-AI/.ihui-agent/shared/abcd1234.html';
  const html = renderShareHtml(SAMPLE_MARKDOWN, 'a'.repeat(64), 'Z6 样例', {
    svg: renderQrInlineFor(target),
    target,
  });

  it('外部脚本 / 外部样式 / img / link 标签 / url() / @import 全部为 0', () => {
    expect(externalAssetRefs(html)).toEqual({ scripts: [], links: [] });
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain('<link ');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('url(');
    expect(html).not.toContain('@import');
  });

  it('阳性对照:把当年那枚 CDN 外链插回,同一把尺子必须抓到它(防②假绿)', () => {
    const tampered = html.replace('<style>', `<script src="${LEGACY_CDN}"></script>\n<style>`);
    expect(tampered).not.toBe(html);
    expect(externalAssetRefs(tampered).scripts).toEqual([LEGACY_CDN]);
  });

  it('SVG 本体里没有事件属性,也没有可执行的脚本标签', () => {
    const svg = inlineQrSvg(html);
    expect(svg.length).toBeGreaterThan(0);
    for (const banned of ['<script', 'onload', 'onclick', 'href=', '<img']) {
      expect(svg, `SVG 不应含 ${banned}`).not.toContain(banned);
    }
  });
});

describe('③ 失败方向与老调用形态', () => {
  it('svg 为空串时整块不出现(不塞半成品;样式表里的选择器不算图形)', () => {
    const html = renderShareHtml(SAMPLE_MARKDOWN, 'b'.repeat(64), 'Z6 样例', { svg: '', target: 'x' });
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<section class="share-qr"');
    expect(html).not.toContain('<p class="share-qr-caption"');
  });

  it('三参数老调用仍可用(既有零外链用例不因签名变化而漂移)', () => {
    const html = renderShareHtml(SAMPLE_MARKDOWN, 'c'.repeat(64), 'Z6 样例');
    expect(html).toContain('<h1>Z6 二维码样例</h1>');
    expect(html).not.toContain('<svg');
  });
});

describe('④ 端到端:真 share() 落盘', () => {
  let fakeHome = '';
  let workspace = '';
  let prevHome: string | undefined;
  let prevUserProfile: string | undefined;

  beforeAll(() => {
    fakeHome = mkScratch('rea-z6-');
    workspace = path.join(fakeHome, 'workspace');
    fs.mkdirSync(workspace, { recursive: true });
    prevHome = process.env.HOME;
    prevUserProfile = process.env.USERPROFILE;
    process.env.HOME = fakeHome;
    process.env.USERPROFILE = fakeHome;
    const dir = path.join(fakeHome, '.ihui', 'sessions');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${SESSION_ID}.json`),
      JSON.stringify(
        {
          id: SESSION_ID,
          createdAt: '2026-11-05T00:00:00.000Z',
          updatedAt: '2026-11-05T00:00:00.000Z',
          workspacePath: workspace,
          modelId: 'qoder-test',
          history: [
            { role: 'system', content: '系统提示不应出现在分享页' },
            { role: 'user', content: SAMPLE_MARKDOWN },
            { role: 'assistant', content: '二维码已从降级接到真产出。' },
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

  it('result.qrCode 是真 data URL;落盘 HTML 内联同一枚矩阵;完整性基准不受影响', async () => {
    const mgr = new ShareManager(workspace);
    const result = await mgr.share(SESSION_ID, { format: 'markdown' });
    expect(result.qrCode.startsWith('data:image/svg+xml,')).toBe(true);
    expect(result.qrCode.length).toBeGreaterThan(200);

    const htmlPath = path.join(workspace, '.ihui-agent', 'shared', `${result.hash.slice(0, 8)}.html`);
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(externalAssetRefs(html)).toEqual({ scripts: [], links: [] });

    // 页面那张图 == 编码器对 result.url 的输出(不是对别的东西)
    const pageRows = matrixFromInlineSvg(inlineQrSvg(html));
    const encoded = encodeQr(result.url);
    const expected: string[] = [];
    for (let y = 0; y < encoded.grid.size; y += 1) {
      let row = '';
      for (let x = 0; x < encoded.grid.size; x += 1) {
        row += encoded.grid.modules[y * encoded.grid.size + x] ? '1' : '0';
      }
      expected.push(row);
    }
    expect(pageRows.size).toBe(encoded.grid.size);
    expect(pageRows.rows).toEqual(expected);

    // data URL 与内联 SVG 同源:左上定位图形首行(7 模块宽)静区偏移 4 后就是第一条子路径
    expect(decodeURIComponent(result.qrCode.slice('data:image/svg+xml,'.length))).toContain('M4 4h7v1h-7z');

    // 完整性基准仍然只锁原始 Markdown
    const rawBlock = /<pre id="raw-markdown">([\s\S]*?)<\/pre>/.exec(html);
    expect(rawBlock).not.toBeNull();
    expect(html).toContain(`data-sha256="${result.hash}"`);
    expect(html).not.toContain('系统提示不应出现在分享页');
  });
});

/** 走渲染层的公开出口拿一枚内联 SVG(与 share.ts 同一条码路,不在测试里复制判据) */
function renderQrInlineFor(target: string): string {
  return renderQrSvg(encodeQr(target).grid, { label: 'IHUI-AI 会话快照分享短链二维码' });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
