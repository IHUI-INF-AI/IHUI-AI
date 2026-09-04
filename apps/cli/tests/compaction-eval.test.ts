// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​‌‌​​​‌​​​‌​‌‍‍‌​‌​‌​‌‌‌‍‍‌‌​‌​​​‌‍‍‌‌​​‌‌‌​‍‍‌​‌‌​‌​‌‍​⁠

import { describe, it, expect } from 'vitest';
import { computeRetentionMetrics, computeTokensRatio } from '../scripts/compaction-eval.js';
import type { ChatMessage } from '@ihui/context-compaction';

describe('compaction-eval metrics', () => {
  const messages: ChatMessage[] = [
    { role: 'user', content: '读取 /app/src/components/Header.tsx 并运行 pnpm test' },
    { role: 'assistant', content: '', tool_calls: [{ id: '1', type: 'function', function: { name: 'read_file', arguments: '{"path":"/app/src/components/Header.tsx"}' } }] },
    { role: 'tool', tool_call_id: '1', content: '// Header.tsx\nexport default function Header() {}' },
  ];

  it('computeRetentionMetrics 路径/工具保留率与退化判定', () => {
    const summary = '已读取 /app/src/components/Header.tsx，并调用 read_file 工具；未运行 pnpm test。'.padEnd(600, 'x');
    const m = computeRetentionMetrics(summary, messages);
    expect(m.totalChars).toBe(summary.length);
    // 路径命中率 >= 0 且 <= 1
    expect(m.filePathKeepRate).toBeGreaterThanOrEqual(0);
    expect(m.filePathKeepRate).toBeLessThanOrEqual(1);
    expect(m.toolNameKeepRate).toBeCloseTo(1, 1); // 工具名保留
    expect(m.degenerate).toBe(false);
  });

  it('computeRetentionMetrics 空摘要视为退化', () => {
    const m = computeRetentionMetrics('', messages);
    expect(m.totalChars).toBe(0);
    expect(m.degenerate).toBe(true);
    expect(m.filePathKeepRate).toBe(0);
  });

  it('computeTokensRatio 计算压缩比', () => {
    const before: ChatMessage[] = [
      { role: 'user', content: 'a'.repeat(100) },
      { role: 'assistant', content: 'b'.repeat(100) },
    ];
    const after: ChatMessage[] = [
      { role: 'system', content: 's' },
      { role: 'user', content: 'summary' },
      { role: 'assistant', content: 'c'.repeat(100) },
    ];
    const r = computeTokensRatio(before, after);
    expect(r.before).toBeGreaterThan(0);
    expect(r.after).toBeGreaterThan(0);
    expect(r.ratio).toBeGreaterThan(0);
    expect(typeof r.ratio).toBe('number');
  });
});
