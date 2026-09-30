// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-641(2026-09-30):有界缓冲区溢出丢弃必须可见 —— HunkTracker 落点。
 *
 * 钉住的三件事:
 *  1. maxHistoryPerFile 溢出丢最旧后,getDroppedHunks()/getStats().droppedHunks > 0
 *  2. 输出面(日志)必须出现 "(dropped N)" 计数行,不许静默变短
 *  3. clear() 连同丢弃账一并清零;未溢出时零告警零计数
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HunkTracker } from '../src/checkpoints/hunk-tracker.js';

describe('HunkTracker dropped 可见性(G-641)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('溢出丢最旧后 dropped>0 且日志面出现计数行', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = new HunkTracker({ maxHistoryPerFile: 3, cooldownMs: 0 });
    for (let i = 1; i <= 5; i++) t.recordAgentChange('a.ts', i, i, `agent-${i}`, `c${i}`);

    const hist = t.getHistory('a.ts');
    expect(hist).toHaveLength(3);
    expect(hist[0]!.startLine).toBe(3); // 最旧两条被丢
    expect(t.getDroppedHunks('a.ts')).toBe(2);
    expect(t.getStats().droppedHunks).toBe(2);

    // 输出面(日志)必须出现计数行:…(dropped N)
    const lines = warn.mock.calls.map((c) => c.map(String).join(' '));
    expect(lines.filter((l) => /dropped \d+/.test(l))).toHaveLength(2);
    expect(lines.some((l) => l.includes('dropped 2'))).toBe(true);
  });

  it('external 改动溢出同样入账并告警', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = new HunkTracker({ maxHistoryPerFile: 2, cooldownMs: 0 });
    for (let i = 1; i <= 4; i++) t.recordExternalChange('b.ts', i, i, `e${i}`);
    expect(t.getHistory('b.ts')).toHaveLength(2);
    expect(t.getStats().droppedHunks).toBe(2);
    expect(warn.mock.calls.some((c) => c.some((s) => String(s).includes('dropped 2')))).toBe(true);
  });

  it('未溢出时 dropped=0 且零告警', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = new HunkTracker({ maxHistoryPerFile: 3, cooldownMs: 0 });
    t.recordAgentChange('a.ts', 1, 1, 'agent-1');
    t.recordExternalChange('a.ts', 2, 2);
    expect(t.getHistory('a.ts')).toHaveLength(2);
    expect(t.getStats().droppedHunks).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('clear() 连同丢弃账一并清零', () => {
    const t = new HunkTracker({ maxHistoryPerFile: 1, cooldownMs: 0 });
    for (let i = 1; i <= 3; i++) t.recordAgentChange('a.ts', i, i, `agent-${i}`);
    expect(t.getStats().droppedHunks).toBe(2);
    t.clear('a.ts');
    expect(t.getStats().droppedHunks).toBe(0);
    expect(t.getDroppedHunks('a.ts')).toBe(0);
  });
});
