// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 提示注入登记的运行时记账对账(A12)。
 *
 * 为什么要有这一份:`prompt-injection-registry.ts` 的全部价值是"进提示的段落必须留下
 * 可诊断痕迹"—— 注入要能数、跳过要说原因。这两件事只要有一次静默,台账就又变成
 * "只被读、写入侧可长期零产出"的那一格(§5e「失败必须响」、守门 77「绝不静默成看起来全绿」同族)。
 * 判据故意只看结构(计数、键集合、原因非空),不去解析自然语言正文。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  injectionLedger,
  injectHostSection,
  recordInjectionInjected,
  renderInjectionNotice,
  resetInjectionLedger,
  unregisteredInjectionIds,
} from '../src/utils/prompt-injection-registry.js';

describe('提示注入记账', () => {
  beforeEach(() => {
    resetInjectionLedger();
  });

  it('注入过就要出现在台账里,并带字节数', () => {
    const out = recordInjectionInjected('reminder_context_budget', '上下文窗口已用 90%');
    expect(out).toContain('上下文窗口已用 90%');
    const rec = injectionLedger().find((r) => r.id === 'reminder_context_budget');
    expect(rec?.status).toBe('injected');
    expect(rec?.bytes ?? 0).toBeGreaterThan(0);
  });

  it('正文为空不得记成"已注入"(静默变短等于伪造完整性)', () => {
    recordInjectionInjected('memory_snapshot', '   ');
    const rec = injectionLedger().find((r) => r.id === 'memory_snapshot');
    expect(rec?.status).toBe('skipped');
    expect(rec?.bytes).toBe(0);
    expect(rec?.reason).toBe('正文为空');
    expect(renderInjectionNotice()).toContain('memory_snapshot');
  });

  it('未登记的 id 走宿主出口时要被点名(不静默放行、也不抛错打断会话)', () => {
    injectHostSection('not_in_table', '外部事件 3 条', { kind: 'host_reminder' });
    expect(unregisteredInjectionIds()).toContain('not_in_table');
    expect(renderInjectionNotice()).toContain('not_in_table');
  });

  it('结转到下一轮前台时要清空台账(防跨轮累计成假数)', () => {
    recordInjectionInjected('memory_snapshot', 'a');
    expect(injectionLedger().length).toBe(1);
    resetInjectionLedger();
    expect(injectionLedger()).toEqual([]);
    expect(renderInjectionNotice()).toBe('');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
