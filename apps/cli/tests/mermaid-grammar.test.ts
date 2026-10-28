// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-12a 票1 —— 图语法发射/解析侧的「任意文本不可破坏语法」契约测试。
 *
 * 判据口径:输入是**模型/用户派生的任意文本**(agent 名、glob 模式、含引号/反引号/
 * 换行/`#`/`-` 的内容),发射与提取路径必须保证:
 *  ① 标签里的危险字符不破坏图语法(转义 + 双引号包裹),输出仍是一块可渲染文本;
 *  ② 含 `#`/`-` 的节点 id(`gate-89#R9`、`D159-1`)净化后不产生"整图解析失败";
 *  ③ extractMermaidBlocks 不得静默吞掉整块 fence 或后续围栏。
 *
 * 注:apps/cli/tests/mermaid.test.ts 为对照面(只读),本文件是票 1 的配对新测试。
 */
import { describe, expect, it } from 'vitest';
import {
  emitMermaidGraph,
  escapeLabel,
  extractMermaidBlocks,
  safeNodeId,
} from '../src/mermaid/index.js';

/** 判定一行 mermaid 语句的引号是否成对闭合(危险字符逃逸的机械判据)。 */
function quoteCountIsEven(line: string): boolean {
  return (line.match(/"/g) ?? []).length % 2 === 0;
}

describe('b76-12a 票1:发射侧「任意文本不可破坏语法」', () => {
  it('(a) 标签含 `"`、反引号、\\n、`#` ⇒ 输出仍是一块可渲染文本(引号成对、无裸换行)', () => {
    const hostileLabel = '他说 "hi" `rm -rf` \n next line #tag';
    const src = emitMermaidGraph([{ id: 'ask#1', label: hostileLabel }]);
    const lines = src.split('\n');
    expect(lines[0]).toBe('flowchart TD');
    const nodeLine = lines[1];
    expect(quoteCountIsEven(nodeLine)).toBe(true, `引号必须成对:${nodeLine}`);
    expect(nodeLine).not.toContain('\n');
    expect(nodeLine).not.toContain('`');
    expect(nodeLine).toContain('#quot;'); // " 已实体化
    expect(nodeLine).toContain('next line #tag'); // 内容保留(只是转义,不是丢弃)
  });

  it('(b) 含 `#`/`-` 的节点 id ⇒ 净化不产生整图失败,原始 id 保留在人读标签', () => {
    for (const raw of ['gate-89#R9', 'D159-1', 'ask#1', 'a/b\\c d']) {
      const src = emitMermaidGraph([
        { id: raw, label: `节点 ${raw}` },
        { id: 'ok_1', label: '普通节点' },
      ]);
      const lines = src.split('\n');
      // 语法位:净化后的 id 只含词字符(不含裸 # / -)
      const nodeLine = lines.find((l) => l.includes('节点'))!;
      const syntaxId = nodeLine.slice(2, nodeLine.indexOf('['));
      expect(syntaxId).toMatch(/^[A-Za-z0-9_]+$/);
      // 原始 id 保留在人读标签(信息不销毁)
      expect(src).toContain(`节点 ${raw}`);
      // 整图结构完整:三行,首行 flowchart TD,引号成对 —— 不因 id 内容解析失败
      expect(lines[0]).toBe('flowchart TD');
      expect(lines.length).toBe(3);
      for (const l of lines.slice(1)) expect(quoteCountIsEven(l)).toBe(true);
    }
  });

  it('(c) 连线文案同样走转义通道', () => {
    const src = emitMermaidGraph(
      [
        { id: 'a' },
        { id: 'b' },
      ],
      [{ from: 'a', to: 'b', label: '当 "x" 完成后 `and` \n 继续-1' }],
    );
    const edgeLine = src.split('\n').find((l) => l.includes('-->'))!;
    expect(quoteCountIsEven(edgeLine)).toBe(true);
    expect(edgeLine).toContain('#quot;');
    expect(edgeLine).not.toContain('`');
    expect(edgeLine).toContain('继续-1');
  });

  it('(d) escapeLabel 边界:空/纯危险字符 ⇒ 有名有姓的输出,不产生裸引号', () => {
    expect(escapeLabel('')).toBe('');
    expect(escapeLabel('"`"')).toBe('#quot;#quot;');
    expect(escapeLabel('a\nb\rc')).toBe('a b c');
  });
});

describe('b76-12a 票1:提取侧不得吞 fence', () => {
  it('(e) 首块含引号/反引号/换行 ⇒ 两块 fence 都能提取,后续围栏不被吞掉', () => {
    const text = [
      '```mermaid',
      'graph TD; A["he said "hi" `x`"]',
      '```',
      'between',
      '```mermaid',
      'graph TD; B-->C',
      '```',
    ].join('\n');
    const blocks = extractMermaidBlocks(text);
    expect(blocks.length).toBe(2, `不得吞掉后续围栏:${JSON.stringify(blocks)}`);
    expect(blocks[0]).toContain('"hi"');
    expect(blocks[1]).toContain('B-->C');
  });

  it('(f) 未闭合 fence ⇒ 明确地只交出块内文本(不得静默吞掉后续内容为止的全部文本而不报形态)', () => {
    const text = ['```mermaid', 'graph TD; A["x`y"]', 'no-closing-fence-yet'].join('\n');
    const blocks = extractMermaidBlocks(text);
    // 未闭合:非贪婪匹配取不到完整块 ⇒ 空数组(如实"没有完整块",不是吞掉一半)
    expect(blocks).toEqual([]);
  });
});

describe('b76-12a 票1:safeNodeId 净化判据', () => {
  it('(g) 只留词字符;空串回退 n', () => {
    expect(safeNodeId('ask#1')).toBe('ask_1');
    expect(safeNodeId('gate-89#R9')).toBe('gate_89_R9');
    expect(safeNodeId('D159-1')).toBe('D159_1');
    expect(safeNodeId('###')).toBe('___');
    expect(safeNodeId('')).toBe('n');
    expect(safeNodeId(undefined as unknown as string)).toBe('n');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
