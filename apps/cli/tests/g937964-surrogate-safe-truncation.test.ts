// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 G-937964 —— surrogate-safe 截断唯一出口。
// 上游出处 `create-workflow-graph-bounds.boundGraphText`(slice 后末码元是高位代理 0xD800-0xDBFF
// 则丢弃半字符,保证载荷可安全序列化)。我方收敛点:`src/utils/prompt-boundary.ts` 的
// `truncateToCodePoints` / `codePointLength` / `sliceSurrogateSafe`;skills/index.ts 的私有
// `codePointLength` 拷贝已删。本文件刻意只 import prompt-boundary.js(该模块不引任何
// workspace 包,理由同 skill-name-codepoint-truncation.test.ts 的注:断言要住在能真跑的地方)。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  codePointLength,
  sliceSurrogateSafe,
  truncateToCodePoints,
} from '../src/utils/prompt-boundary.js';

/**
 * 孤立代理扫描器(判据的判据):逐 UTF-16 码元走 —— 高位代理必须紧跟低位代理,
 * 且不得出现无前驱的低位代理。刻意不用正则:断言失效的最短路径就是写错一条正则。
 */
function hasLoneSurrogate(s: string): boolean {
  for (let i = 0; i < s.length; i += 1) {
    const unit = s.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i += 1; // 合法代理对:整对跳过
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true; // 无前驱的低位代理
    }
  }
  return false;
}

describe('sliceSurrogateSafe:截断边界不得劈开代理对(上游 boundGraphText 机制)', () => {
  // BMP 字符 + 多个增补平面字符(emoji/数学字母)混排,奇偶长度都覆盖。
  const sample = 'a😀b🀄c𝕏d';

  it('各长度截断都无孤立代理,JSON.stringify 不抛且往返无损', () => {
    for (let n = 0; n <= sample.length; n += 1) {
      const out = sliceSurrogateSafe(sample, n);
      expect(out.length).toBeLessThanOrEqual(n);
      expect(hasLoneSurrogate(out), `n=${n} → ${JSON.stringify(out)}`).toBe(false);
      expect(() => JSON.stringify(out), `n=${n}`).not.toThrow();
      expect(JSON.parse(JSON.stringify(out)), `n=${n}`).toBe(out);
    }
  });

  it('经典边界:恰好切在高低代理中间时丢半字符', () => {
    expect(sliceSurrogateSafe('a😀', 2)).toBe('a'); // 第 2 码元正是高位代理
    expect(sliceSurrogateSafe('😀', 1)).toBe(''); // 只剩半对 → 整个丢弃
    expect(sliceSurrogateSafe('a😀b', 4)).toBe('a😀b'); // 边界落在完整字符之后,原样
  });

  it('ASCII/未越界原样;空串与非法预算返回空串', () => {
    expect(sliceSurrogateSafe('abcdef', 3)).toBe('abc');
    expect(sliceSurrogateSafe('abcdef', 99)).toBe('abcdef');
    expect(sliceSurrogateSafe('', 5)).toBe('');
    expect(sliceSurrogateSafe('abc', 0)).toBe('');
    expect(sliceSurrogateSafe('abc', -1)).toBe('');
    expect(sliceSurrogateSafe('abc', Number.NaN)).toBe('');
  });
});

describe('codePointLength:与 truncateToCodePoints 同一出口的计数投影', () => {
  it('代理对算 1,孤立半代理不计数', () => {
    expect(codePointLength('😀😀')).toBe(2);
    expect(codePointLength('技\u{1F600}b')).toBe(3);
    expect(codePointLength(`技${String.fromCharCode(0xd83d)}`)).toBe(1);
    expect(codePointLength('')).toBe(0);
  });

  it('干净串上与码位迭代(Array.from)一致', () => {
    for (const s of ['hello', '你好世界', '🧪 smoke', 'a😀b🀄c𝕏d']) {
      expect(codePointLength(s)).toBe(Array.from(s).length);
    }
  });

  it('计数与截断互为投影:truncate(n) 的码位数 ≤ n 且不含孤立代理', () => {
    const s = 'a😀b🀄c𝕏d';
    for (let n = 0; n <= 8; n += 1) {
      const out = truncateToCodePoints(s, n);
      expect(codePointLength(out)).toBeLessThanOrEqual(n);
      expect(hasLoneSurrogate(out), `n=${n} → ${JSON.stringify(out)}`).toBe(false);
    }
  });
});

describe('单一出口的结构钉:0xD800-0xDFFF 判断不得再抄第二份', () => {
  const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
  /** 唯一出口所在模块(相对 src,正斜杠口径) */
  const EXIT_MODULE = 'utils/prompt-boundary.ts';

  function listSources(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) listSources(p, acc);
      else if (name.endsWith('.ts')) acc.push(p);
    }
    return acc;
  }

  /** 注释里的历史描述不是第二份实现,判据只看代码 */
  function stripComments(code: string): string {
    return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  }

  it('src 下 surrogate 区段字面量只允许出现在唯一出口', () => {
    const offenders: string[] = [];
    for (const p of listSources(SRC_ROOT)) {
      const rel = relative(SRC_ROOT, p).replace(/\\/g, '/');
      if (rel === EXIT_MODULE) continue;
      if (/0xd[89ab][0-9a-f]{2}/i.test(stripComments(readFileSync(p, 'utf-8')))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
