// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-12f 票3 —— 昂贵/不可逆动作前的恢复点复查 + 在飞启动按 key 收敛(mermaid 面)。
 *
 * 上游机制(zcodeAgentProcessManager:859-887):按 workspaceKey 收敛在飞启动 Promise,
 * finally 按 promise identity 清 map —— 本仓的自陈待办(原 index.ts:64-65「异步并发
 * 渲染同一 source 时可能重复 spawn(无 lock)」)就此落账:
 *  · 并发 20 次同 source 渲染 ⇒ 底层 spawn(= engine.render)计数 == 1;
 *  · 不同 source 各自收敛(不串);
 *  · settle 后表项被清 ⇒ 新一轮调用重新渲染(不永久缓存失败/结果);
 *  · 失败路径:并发同 source 的所有调用方拿到同一个 rejection。
 */
import { describe, expect, it, vi } from 'vitest';
import { renderMermaid, type MermaidEngine } from '../src/mermaid/index.js';

function makeEngine(name: string): { engine: MermaidEngine; calls: string[] } {
  const calls: string[] = [];
  const engine: MermaidEngine = {
    name,
    render: vi.fn(async (source: string) => {
      calls.push(source);
      // 让"渲染"真正异步化,给并发调用留出在同一事件循环窗口内到达的余地
      await new Promise((r) => setTimeout(r, 10));
      return Buffer.from(`png-of-${source}`);
    }),
  };
  return { engine, calls };
}

function makeFailingEngine(name: string, failFor: string): MermaidEngine {
  return {
    name,
    render: vi.fn(async (source: string) => {
      await new Promise((r) => setTimeout(r, 5));
      if (source === failFor) throw new Error(`boom:${source}`);
      return Buffer.from(`png-of-${source}`);
    }),
  };
}

describe('b76-12f 票3:mermaid 在飞渲染按 source 指纹收敛', () => {
  it('(a) 并发 20 次同 source 渲染 ⇒ 底层 spawn 计数 == 1', async () => {
    const cache = null; // 禁缓存,专测在飞收敛
    const { engine } = makeEngine('mmdc-cli');
    const source = 'graph TD; A-->B;';
    const results = await Promise.all(
      Array.from({ length: 20 }, () => renderMermaid(source, [engine], cache)),
    );
    expect(engine.render).toHaveBeenCalledTimes(1);
    // 所有调用方拿到同一份结果
    for (const r of results) {
      expect(r.cached).toBe(false);
      expect(r.buffer).toBe(results[0].buffer);
    }
  });

  it('(b) 不同 source 不串:各走各的 spawn', async () => {
    const { engine } = makeEngine('mmdc-cli');
    await Promise.all([
      renderMermaid('graph TD; A-->B;', [engine], null),
      renderMermaid('graph TD; C-->D;', [engine], null),
      renderMermaid('sequenceDiagram; A->>B: hi', [engine], null),
    ]);
    expect(engine.render).toHaveBeenCalledTimes(3);
  });

  it('(c) settle 后表项被清 ⇒ 新一轮调用重新渲染(收敛不变成永久缓存)', async () => {
    const { engine } = makeEngine('mmdc-cli');
    await renderMermaid('graph TD; A-->B;', [engine], null);
    await renderMermaid('graph TD; A-->B;', [engine], null);
    expect(engine.render).toHaveBeenCalledTimes(2);
  });

  it('(d) 失败路径:并发同 source 共享同一个 rejection;settled 后允许重试', async () => {
    const failing = makeFailingEngine('failing', 'graph TD; BAD;');
    const results = await Promise.allSettled([
      renderMermaid('graph TD; BAD;', [failing], null),
      renderMermaid('graph TD; BAD;', [failing], null),
      renderMermaid('graph TD; BAD;', [failing], null),
    ]);
    expect(failing.render).toHaveBeenCalledTimes(1);
    for (const r of results) {
      expect(r.status).toBe('rejected');
      if (r.status === 'rejected') expect((r.reason as Error).message).toContain('boom');
    }
    // settle(失败也清表)后重试 ⇒ 会再 spawn 一次
    await expect(renderMermaid('graph TD; BAD;', [failing], null)).rejects.toThrow('boom');
    expect(failing.render).toHaveBeenCalledTimes(2);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
