// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 运行时动态编排(workflow-runtime)。
 *
 * 钉四件事:
 *   ① 三种定义错误都在**执行前**报错(重复 id / 未知依赖 / 环)——
 *      不能跑到一半才发现;
 *   ② 分层正确(同层可并行,下层必须等上层);
 *   ③ **失败隔离**:某步失败只取消它的下游,无关分支照常跑完;
 *   ④ optional 失败记 skipped,不阻断下游。
 */
import { describe, expect, it } from 'vitest';

import {
  describeWorkflow,
  planLayers,
  runWorkflow,
  WorkflowDefinitionError,
  type WorkflowStep,
} from '../src/acp/workflow-runtime.js';

const noop = async () => ({ ok: true as const });

describe('planLayers 定义校验(全部在执行前报错)', () => {
  it('重复 id 被拒', () => {
    expect(() => planLayers([{ id: 'a', run: noop }, { id: 'a', run: noop }])).toThrow(
      WorkflowDefinitionError,
    );
  });

  it('未知依赖被拒', () => {
    expect(() => planLayers([{ id: 'a', needs: ['nope'], run: noop }])).toThrow(/不存在的 nope/);
  });

  it('依赖自身被拒', () => {
    expect(() => planLayers([{ id: 'a', needs: ['a'], run: noop }])).toThrow(/依赖自身/);
  });

  it('环被拒,且报错点名环上的步骤', () => {
    const steps: WorkflowStep[] = [
      { id: 'a', needs: ['c'], run: noop },
      { id: 'b', needs: ['a'], run: noop },
      { id: 'c', needs: ['b'], run: noop },
    ];
    expect(() => planLayers(steps)).toThrow(/环/);
  });

  it('线性依赖分三层', () => {
    const { layers } = planLayers([
      { id: 'a', run: noop },
      { id: 'b', needs: ['a'], run: noop },
      { id: 'c', needs: ['b'], run: noop },
    ]);
    expect(layers).toEqual([['a'], ['b'], ['c']]);
  });

  it('无依赖的步骤同层(可并行)', () => {
    const { layers } = planLayers([
      { id: 'a', run: noop },
      { id: 'b', run: noop },
      { id: 'c', needs: ['a', 'b'], run: noop },
    ]);
    expect(layers[0]).toEqual(['a', 'b']);
    expect(layers[1]).toEqual(['c']);
  });

  it('同层内按 id 排序(稳定可复现)', () => {
    const { layers } = planLayers([
      { id: 'z', run: noop },
      { id: 'a', run: noop },
      { id: 'm', run: noop },
    ]);
    expect(layers[0]).toEqual(['a', 'm', 'z']);
  });
});

describe('runWorkflow 执行', () => {
  it('全成功 ⇒ succeeded,按层记录', async () => {
    const r = await runWorkflow([
      { id: 'a', run: async () => ({ ok: true, output: 1 }) },
      { id: 'b', needs: ['a'], run: async () => ({ ok: true, output: 2 }) },
    ]);
    expect(r.succeeded).toBe(true);
    expect(r.outcomes.map((o) => o.id)).toEqual(['a', 'b']);
    expect(r.outcomes.every((o) => o.status === 'ok')).toBe(true);
  });

  it('同层并行执行(不是串行)', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const slow = async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 20));
      concurrent -= 1;
      return { ok: true as const };
    };
    await runWorkflow([
      { id: 'a', run: slow },
      { id: 'b', run: slow },
      { id: 'c', run: slow },
    ]);
    expect(maxConcurrent).toBeGreaterThan(1);
  });

  it('失败隔离:失败步的下游被取消,无关分支照常跑完', async () => {
    const ran: string[] = [];
    const r = await runWorkflow([
      { id: 'root', run: async () => ({ ok: true as const }) },
      { id: 'bad', needs: ['root'], run: async () => ({ ok: false as const, error: 'boom' }) },
      { id: 'downstream', needs: ['bad'], run: async () => { ran.push('downstream'); return { ok: true as const }; } },
      { id: 'unrelated', needs: ['root'], run: async () => { ran.push('unrelated'); return { ok: true as const }; } },
    ]);
    expect(r.succeeded).toBe(false);
    expect(r.failed).toContain('bad');
    expect(r.failed).toContain('downstream');
    // 无关分支真的跑了
    expect(ran).toContain('unrelated');
    // 下游真的没跑
    expect(ran).not.toContain('downstream');
  });

  it('optional 失败 ⇒ skipped,下游照跑', async () => {
    const ran: string[] = [];
    const r = await runWorkflow([
      { id: 'opt', run: async () => ({ ok: false as const, error: 'not critical', optional: true }) },
      { id: 'next', needs: ['opt'], run: async () => { ran.push('next'); return { ok: true as const }; } },
    ]);
    const opt = r.outcomes.find((o) => o.id === 'opt')!;
    expect(opt.status).toBe('skipped');
    expect(r.succeeded).toBe(true); // optional 跳过不算失败
    expect(ran).toContain('next');
  });

  it('执行体抛错 ⇒ 转成 failed,不冒泡', async () => {
    const r = await runWorkflow([
      { id: 'x', run: async () => { throw new Error('kaboom'); } },
    ]);
    expect(r.succeeded).toBe(false);
    expect(r.outcomes[0]!.status).toBe('failed');
    expect(r.outcomes[0]!.error).toContain('kaboom');
  });

  it('传递性下游也被取消(不只直接下游)', async () => {
    const ran: string[] = [];
    const r = await runWorkflow([
      { id: 'a', run: async () => ({ ok: false as const, error: 'fail' }) },
      { id: 'b', needs: ['a'], run: async () => { ran.push('b'); return { ok: true as const }; } },
      { id: 'c', needs: ['b'], run: async () => { ran.push('c'); return { ok: true as const }; } },
    ]);
    expect(r.failed).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect(ran).toEqual([]);
  });

  it('空工作流 ⇒ succeeded(边界不算错)', async () => {
    const r = await runWorkflow([]);
    expect(r.succeeded).toBe(true);
    expect(r.outcomes).toEqual([]);
  });
});

describe('describeWorkflow', () => {
  it('成功时只报成功数', () => {
    const s = describeWorkflow({
      outcomes: [{ id: 'a', status: 'ok', layer: 0, durationMs: 1 }],
      succeeded: true,
      failed: [],
    });
    expect(s).toContain('成功 1');
  });

  it('失败时列明各档,不把失败说成成功', () => {
    const s = describeWorkflow({
      outcomes: [
        { id: 'a', status: 'ok', layer: 0, durationMs: 1 },
        { id: 'b', status: 'failed', layer: 1, durationMs: 1, error: 'x' },
        { id: 'c', status: 'cancelled', layer: 2, durationMs: 0, error: 'y' },
      ],
      succeeded: false,
      failed: ['b', 'c'],
    });
    expect(s).toContain('未全部成功');
    expect(s).toContain('失败 1');
    expect(s).toContain('取消 1');
  });
});
