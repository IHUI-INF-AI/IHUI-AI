// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 记忆切块器(`src/memory/chunker.ts`)分支补测 — 第 3 波覆盖面补测·簇 2 之二。
 *
 * 现有 `memory-hybrid-search.test.ts` 只覆盖了"能切出块 + 两次结果一致"这一档;
 * 本文件补的是**决定检索上下文归属**的那几条分支:
 *  - `ancestors` 父链语义(不含自身、层级回落、跳级、无父时为空);
 *  - `overlap` 尾部行的回填数学(下一块的 startLine 与内容重叠);
 *  - `hash` = sha256 截断 16 位十六进制,且随内容变化;
 *  - 空输入返回空数组(不产出空块)。
 */

import { createHash } from 'node:crypto';

import { describe, it, expect } from 'vitest';

import { chunkMarkdown } from '../src/memory/chunker.js';

describe('chunkMarkdown — 基础形态', () => {
  it('空字符串产出零块(不得产出一个空 chunk 污染索引)', () => {
    expect(chunkMarkdown('')).toEqual([]);
  });

  it('短文本单块:startLine/endLine 为 0-indexed 且 inclusive,正文逐字保留', () => {
    const md = '# A\n## B\nbody';
    const chunks = chunkMarkdown(md);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe(md);
    expect(chunks[0]!.startLine).toBe(0);
    expect(chunks[0]!.endLine).toBe(2);
  });

  it('hash 是 sha256 前 16 位十六进制,且与正文一一对应', () => {
    const md = '# A\n## B\nbody';
    const [chunk] = chunkMarkdown(md);
    expect(chunk!.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(chunk!.hash).toBe(createHash('sha256').update(chunk!.text).digest('hex').slice(0, 16));
    const other = chunkMarkdown('# A\n## B\nbody!');
    expect(other[0]!.hash).not.toBe(chunk!.hash);
  });

  it('同输入两次调用结果逐块相等(索引重建必须幂等)', () => {
    const md = '# A\nline\nline\nline\n# B\nmore';
    expect(chunkMarkdown(md, { maxChunkSize: 8, overlap: 4 })).toEqual(chunkMarkdown(md, { maxChunkSize: 8, overlap: 4 }));
  });
});

describe('chunkMarkdown — ancestors 父链', () => {
  it('三级标题下的块带两级父链,不含自身', () => {
    const md = '# A\n## B\n### C\n正文';
    const chunks = chunkMarkdown(md);
    expect(chunks[chunks.length - 1]!.ancestors).toEqual(['A', 'A/B']);
  });

  it('二级标题只有一级父链', () => {
    const md = '# A\n## B\n正文';
    expect(chunkMarkdown(md)[0]!.ancestors).toEqual(['A']);
  });

  it('回到一级标题时父链清空(层级回落不得留着旧父链)', () => {
    const md = '# A\n## B\n# C\n正文';
    const chunks = chunkMarkdown(md);
    expect(chunks[chunks.length - 1]!.ancestors).toEqual([]);
  });

  /**
   * 现状钉:层级回落只做 `slice(0, level-1)`,所以**同级**标题彼此会当父链用 ——
   * `## 甲` 后接 `## 乙` 时,乙的 ancestors 是 `['甲']`(甲被留在 level-2 槽位上)。
   * 与"父链=更高层标题"的注释语义分叉;改动这段 slice 逻辑的用例必翻红。
   */
  it('同级标题互为父链(现状钉:不是叠加也不是清空)', () => {
    const md = '## 甲\n## 乙\n正文';
    expect(chunkMarkdown(md)[0]!.ancestors).toEqual(['甲']);
  });

  it('跳级(### 直接出现在顶层)时按已见的父链给,不足即为空', () => {
    const md = '### 独苗\n正文';
    expect(chunkMarkdown(md)[0]!.ancestors).toEqual([]);
  });

  it('父链跨块存续:后续块没有新标题时,仍带上一节的路径', () => {
    const long = '第一行内容够长长长长长长长长长';
    const md = ['# 手册', '## 章节', long, long].join('\n');
    const chunks = chunkMarkdown(md, { maxChunkSize: 20, overlap: 5 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.ancestors).toEqual(['手册']);
  });

  it('标题行本身也留在块正文里(切块不吞证据)', () => {
    const md = '# 标题\n内容';
    expect(chunkMarkdown(md)[0]!.text).toContain('# 标题');
  });
});

describe('chunkMarkdown — 分块阈值与 overlap', () => {
  const fourLines = 'line1\nline2\nline3\nline4';

  it('达到 maxChunkSize 才 flush,overlap 把尾行回填给下一块', () => {
    const chunks = chunkMarkdown(fourLines, { maxChunkSize: 13, overlap: 7 });
    expect(chunks.map((c) => c.text)).toEqual(['line1\nline2\nline3', 'line2\nline3\nline4', 'line3\nline4']);
    expect(chunks.map((c) => c.startLine)).toEqual([0, 2, 3]);
    expect(chunks.map((c) => c.endLine)).toEqual([2, 3, 3]);
  });

  it('overlap 为 0 时块与块零重叠(切片边界不重复入索引)', () => {
    const chunks = chunkMarkdown(fourLines, { maxChunkSize: 13, overlap: 0 });
    expect(chunks.map((c) => c.text)).toEqual(['line1\nline2\nline3', 'line4']);
    expect(chunks.map((c) => c.startLine)).toEqual([0, 3]);
  });

  it('缺省档(500/50)下短文档只产出一块', () => {
    expect(chunkMarkdown(fourLines)).toHaveLength(1);
  });

  /**
   * 现状钉:当**最后一行本身**就超过 maxChunkSize 时,flush 会把整行当作 overlap 尾部
   * 回填,循环结束后再 flush 一次 ⇒ 末块内容与上一块重复、且 `startLine > endLine`。
   * 这是缺陷(超长单行会产出越界行号区间),但按"如实登记"钉成可复跑证据:
   * 谁修它,本用例必翻红,届时应把它改成正确断言而不是删除。
   */
  it('超长末行会产出重复块与越界行号区间(缺陷现状钉)', () => {
    const md = 'x'.repeat(100);
    const chunks = chunkMarkdown(md, { maxChunkSize: 10, overlap: 50 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.startLine).toBe(0);
    expect(chunks[1]!.startLine).toBe(1);
    expect(chunks[1]!.endLine).toBe(0);
    expect(chunks[1]!.text).toBe(chunks[0]!.text);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
