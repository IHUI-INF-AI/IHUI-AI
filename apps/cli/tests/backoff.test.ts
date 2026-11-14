// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest';
import { backoffDelayMs, retryBudget, sleep } from '../src/acp/backoff.js';

describe('backoffDelayMs — 对标 Qoder 位移退避 + jitter 超越', () => {
  it('裸退避(jitter=none)按 2^n 增长并封顶 —— 对齐 Qoder base*(1<<n) cap', () => {
    expect(backoffDelayMs(0, { jitter: 'none' })).toBe(5000);
    expect(backoffDelayMs(1, { jitter: 'none' })).toBe(10000);
    expect(backoffDelayMs(2, { jitter: 'none' })).toBe(20000);
    expect(backoffDelayMs(3, { jitter: 'none' })).toBe(30000);
    expect(backoffDelayMs(4, { jitter: 'none' })).toBe(30000);
    expect(backoffDelayMs(10, { jitter: 'none' })).toBe(30000);
  });

  it('full jitter 把退避抖动到 [0, capped) —— 超越点:打散惊群', () => {
    const lo = backoffDelayMs(3, { jitter: 'full', random: () => 0 });
    const hi = backoffDelayMs(3, { jitter: 'full', random: () => 0.9999 });
    expect(lo).toBe(0);
    // floor(0.9999*30000)=29997：逼近 cap 但严格小于 cap（jitter 上界不触及 capped）
    expect(hi).toBe(29997);
    expect(hi).toBeLessThan(30000);
  });

  it('full jitter 恒 ≤ capMs,恒 ≥ 0 —— 不变量', () => {
    for (let a = 0; a <= 40; a++) {
      const d = backoffDelayMs(a, { jitter: 'full', random: () => 0.5 });
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(30000);
    }
  });

  it('非法 attempts(负数/NaN/Infinity) fail-closed 返回 0', () => {
    expect(backoffDelayMs(-1)).toBe(0);
    expect(backoffDelayMs(Number.NaN)).toBe(0);
    expect(backoffDelayMs(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('自定义 base/cap —— 位移钳制防溢出', () => {
    const d = backoffDelayMs(1_000_000, { baseMs: 100, capMs: 60000, jitter: 'none' });
    expect(d).toBe(60000);
    expect(Number.isFinite(d)).toBe(true);
  });
});

describe('retryBudget — fail-closed 恢复预算', () => {
  it('预算内可重试', () => {
    expect(retryBudget(0, 3).retryable).toBe(true);
    expect(retryBudget(2, 3).retryable).toBe(true);
  });
  it('预算耗尽判持久失败', () => {
    const r = retryBudget(3, 3);
    expect(r.retryable).toBe(false);
    expect(r.reason).toContain('耗尽');
  });
  it('非法入参 fail-closed', () => {
    expect(retryBudget(0, -1).retryable).toBe(false);
    expect(retryBudget(-1, 3).retryable).toBe(false);
  });
});

describe('sleep', () => {
  it('负数毫秒不抛错,立即返回', async () => {
    await expect(sleep(-100)).resolves.toBeUndefined();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
