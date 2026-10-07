// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-814409(audit 侧)成对判据:审计日志的截断必须**自报丢了多少** ——
// 对照组 `tools/mcp-runtime.ts` 的 bytesRead/sizeBytes 形态(四个字段全是真实量值,
// `truncated` 由比较得出而非写死)。三条判据:
//   ① 溢出必报数:超限时 bytesRead/sizeBytes 分明、标注带量,量值守恒;
//   ② 未溢出不报:限内零截断、标注缺席;
//   ③ 恒真标注会被咬出:`truncated === (bytesRead > sizeBytes)` 两侧同时钉 ——
//      把 truncated 写死成 true 或 false 任一恒真,两条里必有一条红。
import { describe, expect, it } from 'vitest';

import { truncateWithReading } from '../src/audit.js';

describe('G-814409 audit 截断自报 bytesRead/sizeBytes', () => {
  it('① 溢出必报数:量值守恒,标注点名字数', () => {
    const input = 'x'.repeat(1234);
    const r = truncateWithReading(input);
    expect(r.truncated).toBe(true);
    expect(r.bytesRead).toBe(1234);
    expect(r.sizeBytes).toBe(500);
    // 量值守恒:丢掉的 = 读了 - 留的
    expect(r.bytesRead - r.sizeBytes).toBe(734);
    // 保留体恰为前 500 字符 + 带量标注
    expect(r.text.startsWith('x'.repeat(500))).toBe(true);
    expect(r.text).toContain('...(truncated 1234/500)');
  });

  it('② 未溢出不报:限内零截断、无标注、量值相等', () => {
    const input = 'y'.repeat(300);
    const r = truncateWithReading(input);
    expect(r.truncated).toBe(false);
    expect(r.bytesRead).toBe(300);
    expect(r.sizeBytes).toBe(300);
    expect(r.text).toBe(input);
    expect(r.text).not.toContain('truncated');
  });

  it('③ 恒真标注会被咬出:truncated 与 bytesRead > sizeBytes 同真同假', () => {
    const over = truncateWithReading('z'.repeat(600));
    const under = truncateWithReading('z'.repeat(100));
    // 把 truncated 写死成 true ⇒ under 这条红;写死成 false ⇒ over 这条红。
    expect(over.truncated).toBe(over.bytesRead > over.sizeBytes);
    expect(under.truncated).toBe(under.bytesRead > under.sizeBytes);
    expect(over.truncated).toBe(true);
    expect(under.truncated).toBe(false);
  });

  it('自定义上限同样成立(溢出报数 / 限内不报)', () => {
    const over = truncateWithReading('a'.repeat(41), 40);
    expect(over.truncated).toBe(true);
    expect(over.bytesRead).toBe(41);
    expect(over.sizeBytes).toBe(40);
    expect(over.text).toContain('...(truncated 41/40)');
    const under = truncateWithReading('b'.repeat(39), 40);
    expect(under.truncated).toBe(false);
    expect(under.text).toBe('b'.repeat(39));
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
