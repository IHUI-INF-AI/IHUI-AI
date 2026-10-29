// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Markdown 终端渲染器(`src/commands/markdown-renderer.ts`)行为测试 — 第 3 波覆盖面补测·簇 3。
 *
 * 该模块此前零测试引用(全仓无一处用例 import `createMarkdownRenderer` / `renderInline`),
 * 而它是 CLI 每条 assistant 消息的**逐行分派器**(围栏 / 标题 / 引用 / 表格 / 列表 / 分隔线 / 段落)。
 *
 * 断言一律先剥 ANSI,再判"分了哪几路、每路产出什么形状"(彩色档与无彩档下同形):
 *  - 围栏是**跨行状态机**:开栏吞行、闭栏才一次性吐整框(语言标签 + 行号 + 底边);
 *  - 未闭栏的残留只能由 `flush()` 吐出,不得被静默丢弃;
 *  - 超长代码行按 innerWidth 截断并留省略号(不得把终端撑破);
 *  - `highlight:false` 时正文原样,不做关键字/注释加工;
 *  - 表格单行不补分隔行(分隔行只在表头之后且行数 >1 时出现)。
 */

import { describe, it, expect } from 'vitest';

import { createMarkdownRenderer, renderInline } from '../src/commands/markdown-renderer.js';

/** 剥掉 SGR 转义序列,只留可见字符。 */
const plain = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, '')
const plainAll = (lines: string[]): string[] => lines.map(plain)

describe('createMarkdownRenderer — 行分派', () => {
  it('一级标题:空行 + 缩进正文 + 下划线 + 空行,四行一组', () => {
    const r = createMarkdownRenderer({ width: 40 });
    expect(plainAll(r.pushLine('# Title'))).toEqual(['', '  Title', '  ' + '═'.repeat(10), '']);
  });

  it('三级标题走第三档颜色但形状一致(分派不随色档改行数)', () => {
    const r = createMarkdownRenderer({ width: 40 });
    expect(plainAll(r.pushLine('### Sub'))).toEqual(['', '  Sub', '  ' + '═'.repeat(6), '']);
  });

  it('分隔线 --- 吐整条横杠(宽度受 width 与 80 双限)', () => {
    const r = createMarkdownRenderer({ width: 40 });
    expect(plainAll(r.pushLine('---'))).toEqual(['─'.repeat(40)]);
    const wide = createMarkdownRenderer({ width: 200 });
    expect(plainAll(wide.pushLine('***'))).toEqual(['─'.repeat(80)]);
  });

  it('引用行渲染成左侧色带 + 原文', () => {
    const r = createMarkdownRenderer({ width: 40 });
    expect(plainAll(r.pushLine('> hello'))).toEqual(['  │ hello']);
  });

  it('无序列表按缩进档展开(两空格缩进 → 四空格)', () => {
    const r = createMarkdownRenderer({ width: 40 });
    expect(plainAll(r.pushLine('- item one'))).toEqual(['- item one']);
    expect(plainAll(r.pushLine('  * deep'))).toEqual(['    * deep']);
    expect(plainAll(r.pushLine('+ plus'))).toEqual(['+ plus']);
  });

  it('有序列表保留原始序号(不得重排成 1.)', () => {
    const r = createMarkdownRenderer({ width: 40 });
    expect(plainAll(r.pushLine('2. second'))).toEqual(['2. second']);
  });

  it('表格行:首列加粗并按列宽补齐,单行不补分隔行', () => {
    const r = createMarkdownRenderer({ width: 40 });
    expect(plainAll(r.pushLine('| a | bb |'))).toEqual(['  a │ bb']);
  });

  it('普通段落原样透传(不吞不换形)', () => {
    const r = createMarkdownRenderer({ width: 40 });
    expect(plainAll(r.pushLine('plain text'))).toEqual(['plain text']);
  });
});

describe('createMarkdownRenderer — 代码围栏状态机', () => {
  it('开栏与栏内行都不吐内容,闭栏时一次吐出整框', () => {
    const r = createMarkdownRenderer({ width: 40 });
    expect(r.pushLine('```js')).toEqual([]);
    expect(r.pushLine('const a = 1')).toEqual([]);
    const box = plainAll(r.pushLine('```'));
    expect(box[0]).toBe('  ┌─ js ' + '─'.repeat(29) + '┐');
    expect(box[1]).toBe('  │   1 const a = 1');
    expect(box[box.length - 1]).toBe('  └' + '─'.repeat(36) + '┘');
    expect(box).toHaveLength(3);
  });

  it('无语言标签的围栏标签位回落为 code', () => {
    const r = createMarkdownRenderer({ width: 40 });
    r.pushLine('```');
    r.pushLine('x');
    const box = plainAll(r.pushLine('```'));
    expect(box[0]).toContain('─ code ');
  });

  it('行号按栏内序递增,且从 1 起算', () => {
    const r = createMarkdownRenderer({ width: 40 });
    r.pushLine('```');
    r.pushLine('one');
    r.pushLine('two');
    const box = plainAll(r.pushLine('```'));
    expect(box[1]).toBe('  │   1 one');
    expect(box[2]).toBe('  │   2 two');
  });

  it('闭栏后状态复位:同一实例可再次进入围栏', () => {
    const r = createMarkdownRenderer({ width: 40 });
    r.pushLine('```');
    r.pushLine('one');
    expect(plainAll(r.pushLine('```'))).toHaveLength(3);
    expect(r.pushLine('# after')).not.toEqual([]);
    expect(r.pushLine('```ts')).toEqual([]);
  });

  /**
   * 现状钉:`flush()` 只渲染、**不清状态** —— 未闭栏时每次调用都会把同一框再吐一遍。
   * 调用方若复用同一渲染器实例跨消息 flush,会拿到重复框;收尾必须换新实例。
   */
  it('未闭栏的残留由 flush 吐出;空状态 flush 返回空数组;flush 不清状态(重复吐)', () => {
    const idle = createMarkdownRenderer({ width: 40 });
    expect(idle.flush()).toEqual([]);
    const r = createMarkdownRenderer({ width: 40 });
    r.pushLine('```python');
    r.pushLine('print(1)');
    const box = plainAll(r.flush());
    expect(box).toHaveLength(3);
    expect(box[0]).toContain('python');
    expect(box[1]).toBe('  │   1 print(1)');
    expect(plainAll(r.flush())).toEqual(box);
  });

  it('超长代码行按 innerWidth 截断并加省略号(不撑破终端)', () => {
    const r = createMarkdownRenderer({ width: 20 });
    r.pushLine('```');
    r.pushLine('z'.repeat(60));
    const box = plainAll(r.pushLine('```'));
    expect(box[1]).toBe('  │   1 ' + 'z'.repeat(13) + '…');
  });

  it('highlight:false 档正文逐字原样(不做关键字/注释加工)', () => {
    const src = 'const a = "x"; // why';
    const r = createMarkdownRenderer({ width: 40, highlight: false });
    r.pushLine('```js');
    r.pushLine(src);
    expect(plainAll(r.pushLine('```'))[1]).toBe(`  │   1 ${src}`);
  });
});

describe('renderInline — 行内标记', () => {
  it('链接拆成"文案 + 括号 URL",方括号/圆括号被吃掉', () => {
    expect(plain(renderInline('see [doc](https://e.com) now'))).toBe('see doc (https://e.com) now');
  });

  it('行内代码两侧各补一个空格(反引号消失)', () => {
    expect(plain(renderInline('use `code` here'))).toBe('use  code  here');
  });

  it('两种加粗写法都归一到正文', () => {
    expect(plain(renderInline('**bold** and __bold2__'))).toBe('bold and bold2');
  });

  it('两种斜体写法都归一到正文', () => {
    expect(plain(renderInline('*ital* and _ital2_'))).toBe('ital and ital2');
  });

  it('删除线成对剥除', () => {
    expect(plain(renderInline('~~gone~~'))).toBe('gone');
  });

  it('空串返回空串(不得吐 undefined 或空格)', () => {
    expect(renderInline('')).toBe('');
  });

  it('无标记文本原样返回', () => {
    expect(plain(renderInline('plain text'))).toBe('plain text');
  });

  it('成对标记外的下划线不被误当斜体(snake_case 标识符保持完整)', () => {
    expect(plain(renderInline('user_name'))).toBe('user_name');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
