// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { charWidth, clipToWidth, clusterWidth, graphemes, padCell, visibleWidth } from '../src/util/text-width.js';

/**
 * G-676:单元格宽度收口成唯一实现,并按码点/字素截断。
 *
 * 立票事实(修前实测):共享表 util/text-width.ts 含 U+FE10-U+FE19(记 2 列),而
 * commands/task-status-line.ts 自带私有表不含 ⇒ 同一竖排字符两边一宽一窄;
 * tui/fullscreen/transcript.ts 的 clip 用 String.length(UTF-16 码元数)当显示宽度。
 * 本地唯一的 Unicode 派生尺子 wcwidth@1.0.1 对 U+FE10/U+FE19 现量 2 ⇒ 私有那份是错的,
 * 共享那份的 FE10 档必须保留(删它会让该族落回默认窄档,反而更错)。
 */

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const WIDTH_MODULE = 'util/text-width.ts';
const cp = (n: number): string => String.fromCodePoint(n);

function listSources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listSources(p, acc);
    else if (name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

/** 判「有没有第二份宽度实现」的纯函数:内容作入参 ⇒ 阳性对照可直接喂旧私有表原文 */
function findSecondWidthImpl(rel: string, content: string): string[] {
  if (rel === WIDTH_MODULE) return [];
  // 注释里的历史描述不是第二份实现,判据只看定义与表字面量
  const code = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const hits: string[] = [];
  if (/\bWIDE_CHAR_RE\b/.test(code)) hits.push('私有 WIDE_CHAR_RE');
  if (/function\s+charWidth\s*\(/.test(code)) hits.push('重复定义 charWidth');
  if (/\\u1100-\\u115F/.test(code)) hits.push('第二份宽字符区段表字面量');
  return hits;
}

const hasLoneSurrogate = (s: string): boolean => {
  for (const ch of s) {
    const n = ch.codePointAt(0) ?? 0;
    if (n >= 0xd800 && n <= 0xdfff) return true;
  }
  return false;
};

describe('宽度表:逐档读数(与 wcwidth@1.0.1 现量一致)', () => {
  it('U+FE10-U+FE19 竖排形式 = 2 列(两份实现今天的分叉点)', () => {
    for (let n = 0xfe10; n <= 0xfe19; n += 1) expect(charWidth(cp(n)), `U+${n.toString(16)}`).toBe(2);
  });
  it('兼容形式 / 全角形式 = 2 列;界外不放宽', () => {
    for (const n of [0xfe30, 0xfe4f, 0xfe50, 0xfe6f, 0xff00, 0xff01, 0xff60, 0xffe0, 0xffe6, 0x4e2d, 0x304b, 0xd55c, 0x3000])
      expect(charWidth(cp(n)), `U+${n.toString(16)}`).toBe(2);
    for (const n of [0xff61, 0xffe8, 0x41, 0x20]) expect(charWidth(cp(n)), `U+${n.toString(16)}`).toBe(1);
  });
  it('零宽族 = 0 列(原表缺这一族,此前被算 1 列把整行撑宽)', () => {
    for (const n of [0xfe0f, 0xfe00, 0x200d, 0x0301, 0x2060, 0x200b, 0x202a])
      expect(charWidth(cp(n)), `U+${n.toString(16)}`).toBe(0);
  });
  it('星平面(代理对)整体 2 列,不被数成两个 1 列', () => {
    expect(charWidth(cp(0x1f600))).toBe(2);
    expect(charWidth(cp(0x1f469))).toBe(2);
  });
});

describe('visibleWidth / padCell:按列不按码元', () => {
  it('全角中文按 2 列/字', () => {
    expect(visibleWidth('模型状态：已完成')).toBe(16);
    expect(visibleWidth('ＡＢＣ全角')).toBe(10);
  });
  it('ANSI 转义不占列;代理对只算一个字形的宽', () => {
    expect(visibleWidth('\u001b[31m红色\u001b[0m')).toBe(4);
    expect(visibleWidth('😀😀😀')).toBe(6);
  });
  it('padCell 按可视宽度补齐', () => {
    expect(padCell('中文', 6)).toBe('中文  ');
    expect(padCell('ab', 6, 'right')).toBe('    ab');
  });
});

describe('clipToWidth:按码点/字素截断,不切开', () => {
  it('不超长时逐字返回', () => {
    expect(clipToWidth('模型', 8)).toBe('模型');
  });
  it('中文按列宽截断(旧 clip 按码元数会放过 8 码元 = 16 列的一整句)', () => {
    const out = clipToWidth('模型状态：已完成', 8);
    expect(visibleWidth(out)).toBeLessThanOrEqual(8);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toBe('模型状态：已完成');
  });
  it('绝不产出孤立代理(截断点落在 emoji 中间也不行)', () => {
    for (const max of [1, 2, 3, 5, 7]) {
      const out = clipToWidth('😀😀😀 emoji', max);
      expect(hasLoneSurrogate(out), `max=${max} → ${JSON.stringify(out)}`).toBe(false);
      expect(visibleWidth(out)).toBeLessThanOrEqual(max);
    }
  });
  it('ZWJ 组合序列整簇保留,不被拆成散件', () => {
    const family = '👨‍👩‍👧';
    expect(graphemes(family)).toHaveLength(1);
    expect(clusterWidth(family)).toBe(2);
    const out = clipToWidth(`${family}abc`, 4);
    expect(out.startsWith(family)).toBe(true);
    expect(visibleWidth(out)).toBeLessThanOrEqual(4);
  });
  it('变体选择符跟着基字符走,不被单独切开', () => {
    const heart = '❤️';
    expect(visibleWidth(heart)).toBe(1);
    const out = clipToWidth(`${heart}ab`, 2);
    expect(out.startsWith(heart)).toBe(true);
    expect(out).toContain('\ufe0f');
  });
  it('ANSI 不被切断,截断点之后的转义仍带走(否则颜色状态留在"开着"的一面)', () => {
    const out = clipToWidth('\u001b[31m红色文字\u001b[0m', 5);
    expect(visibleWidth(out)).toBeLessThanOrEqual(5);
    expect(out).toContain('\u001b[31m');
    expect(out).toContain('\u001b[0m');
    // 完整 SGR 的数量必须仍是 2(切断会留下没有 'm' 收尾的半截)
    expect(out.match(/\u001b\[[0-9;]*m/g)).toHaveLength(2);
  });
  it('maxWidth=0 不得产出超宽的一行', () => {
    expect(clipToWidth('中文', 0)).toBe('');
    expect(clipToWidth('中文', 1)).toBe('…');
  });
});

describe('状态行与转录面:两处都改走同一出口', () => {
  it('task-status-line.ts import 共享 clipToWidth,且不再自带 truncate/宽度实现', () => {
    const src = readFileSync(join(SRC_ROOT, 'commands', 'task-status-line.ts'), 'utf8');
    expect(/import\s*\{[^}]*\bclipToWidth\b[^}]*\}\s*from\s*'\.\.\/util\/text-width\.js'/.test(src)).toBe(true);
    expect(/function\s+truncate\s*\(/.test(src)).toBe(false);
    expect(/function\s+visibleWidth\s*\(/.test(src)).toBe(false);
    expect(/\btruncate\(/.test(src)).toBe(false);
  });
  it('同一串文本:逐码位累加 == 按字素簇累加 == visibleWidth(不含 ZWJ 融合序列时)', () => {
    for (const text of ['状态\uFE10已完成 \uFF01 😀', 'ＡＢＣ全角 mix 中文', '👩‍💻'.replace('\u200d', '')]) {
      let byCodePoint = 0;
      for (const ch of text) byCodePoint += charWidth(ch);
      let byCluster = 0;
      for (const g of graphemes(text)) byCluster += clusterWidth(g);
      expect(byCluster, text).toBe(byCodePoint);
      expect(visibleWidth(text), text).toBe(byCluster);
    }
  });
});

describe('反向锁:宽度算法只有一份实现(全源面扫描)', () => {
  const files = listSources(SRC_ROOT);
  it('源面非空(空扫描不算通过)', () => {
    expect(files.length).toBeGreaterThan(50);
  });
  it('除 util/text-width.ts 外没有任何第二份宽度实现', () => {
    const offenders: string[] = [];
    for (const p of files) {
      const rel = relative(SRC_ROOT, p).split('\\').join('/');
      const hits = findSecondWidthImpl(rel, readFileSync(p, 'utf8'));
      if (hits.length) offenders.push(`${rel}: ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
  it('阳性对照:私有那份原文喂判据必须命中(判据有牙,不是恒绿)', () => {
    // 逐字取自 HEAD 面 apps/cli/src/commands/task-status-line.ts:114-116/264 的旧私有实现
    const legacyPrivate = [
      "const ANSI_SEQUENCE_RE = /\\u001b\\[[0-9;]*m/g;",
      "const WIDE_CHAR_RE = /[\\u1100-\\u115F\\u2E80-\\uA4CF\\uAC00-\\uD7A3\\uF900-\\uFAFF\\uFE30-\\uFE6F\\uFF00-\\uFF60\\uFFE0-\\uFFE6]/;",
      'function charWidth(char: string): number {',
      '  return WIDE_CHAR_RE.test(char) ? 2 : 1;',
      '}',
    ].join('\n');
    const hits = findSecondWidthImpl('commands/task-status-line.ts', legacyPrivate);
    expect(hits.length).toBeGreaterThanOrEqual(3);
    // 对照的另一半:同一判据对合规写法(只 import 共享出口)不得命中
    const compliant = "import { charWidth } from '../util/text-width.js';\nconst w = charWidth('中');";
    expect(findSecondWidthImpl('tui/fullscreen/geometry.ts', compliant)).toEqual([]);
  });
  it('transcript 的 clip 不得回到 .length 判据', () => {
    const p = join(SRC_ROOT, 'tui', 'fullscreen', 'transcript.ts');
    const body = readFileSync(p, 'utf8').match(/function clip\([\s\S]*?\n\}/)?.[0] ?? '';
    expect(body).toContain('clipToWidth');
    expect(/t\.length\s*>/.test(body)).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
