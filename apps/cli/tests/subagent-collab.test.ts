// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * subagent-collab 真实执行测试 — CollaborationManager 的 executor 注入与降级链路。
 *
 * 覆盖范围:
 *   - 默认 executor 走 SubagentWorkerPool 派发真实子代理任务(mock pool,验证 persona/task/workspacePath 透传)
 *   - 自定义 role → persona 映射(内置 5 角色直通,未知角色回落 general)
 *   - pool 不可用(spawn failed / fork 抛异常)→ 显式降级 stub,结果标注 degraded:true
 *   - 可注入 CollaborationExecutor(注入后不走 pool)
 *   - hierarchical 组员并行分发,结果回流聚合摘要(memberResults 不再静默丢弃)
 *   - 死信队列:目标 peer 不存在的消息可经 getDeadLetters 查询(不再静默丢弃)
 *   - dispose 释放自建 executor 的 pool(注入的外部 executor 不被 manager 释放)
 *   - peer 未注册 manager 时单独使用,回落 stub 且标注 degraded:true
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock SubagentWorkerPool:避免真实 fork 子进程,仅验证派发契约
const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  shutdown: vi.fn(),
}));

vi.mock('../src/subagents/worker-pool.js', () => ({
  SubagentWorkerPool: class MockSubagentWorkerPool {
    spawn = mocks.spawn;
    shutdown = mocks.shutdown;
  },
  defaultWorkerPoolConfig: (overrides: Record<string, unknown> = {}) => ({
    maxWorkers: 4,
    taskTimeoutSeconds: 300,
    maxQueueSize: 100,
    ...overrides,
  }),
}));

import {
  SubagentPeer,
  CollaborationManager,
  type CollaborationExecutor,
} from '../src/commands/subagent-collab.js';

function makePeer(id: string, role: string): SubagentPeer {
  return new SubagentPeer({ id, role, model: 'test-model', workspacePath: '/test-ws' });
}

/** 构造走 mock pool 的 manager(默认 WorkerPoolExecutor) */
function makePoolManager(topology: 'star' | 'mesh' | 'chain' | 'hierarchical' = 'star'): CollaborationManager {
  return new CollaborationManager({ workspacePath: '/test-ws', topology });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('默认 executor 走 SubagentWorkerPool 真实派发', () => {
  it('star 拓扑:dispatchTask 经 pool.spawn 派发,结果为真实子代理输出', async () => {
    mocks.spawn.mockResolvedValue({
      subagentId: 'sa_1',
      pid: 42,
      status: 'completed',
      output: '[pool] coder 重构完成',
      durationMs: 5,
    });

    const mgr = makePoolManager('star');
    mgr.registerPeer(makePeer('p1', 'coder'));

    const result = await mgr.dispatchTask('重构 auth 模块');

    expect(result.status).toBe('completed');
    expect(result.output).toBe('[pool] coder 重构完成');
    expect(result.degraded).toBeUndefined();
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(mocks.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        persona: 'coder',
        task: '重构 auth 模块',
        workspacePath: '/test-ws',
        model: undefined,
      }),
    );
    mgr.dispose();
  });

  it('内置角色直通 persona,未知角色回落 general', async () => {
    mocks.spawn.mockResolvedValue({
      subagentId: 'sa_2',
      pid: 43,
      status: 'completed',
      output: 'ok',
      durationMs: 1,
    });

    const mgr = makePoolManager('mesh');
    mgr.registerPeer(makePeer('reviewer-1', 'reviewer'));
    mgr.registerPeer(makePeer('qa-1', 'qa'));

    await mgr.dispatchTask('审查代码', { preferredRole: 'reviewer' });
    await mgr.dispatchTask('测试任务', { preferredRole: 'qa' });

    expect(mocks.spawn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ persona: 'reviewer' }),
    );
    expect(mocks.spawn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ persona: 'general' }),
    );
    mgr.dispose();
  });

  it('多次 execute 复用同一 pool 实例(不逐任务建池)', async () => {
    mocks.spawn.mockResolvedValue({
      subagentId: 'sa_3',
      pid: 44,
      status: 'completed',
      output: 'ok',
      durationMs: 1,
    });

    const mgr = makePoolManager('star');
    mgr.registerPeer(makePeer('p1', 'coder'));
    await mgr.dispatchTask('任务 A');
    await mgr.dispatchTask('任务 B');

    // spawn 被调 2 次,但 shutdown 只在 dispose 触发一次 → 说明 pool 复用
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
    mgr.dispose();
    expect(mocks.shutdown).toHaveBeenCalledTimes(1);
  });
});

describe('pool 不可用时显式降级 stub', () => {
  it('spawn 返回 failed(队列满/已 shutdown)→ degraded:true + stub 输出', async () => {
    mocks.spawn.mockResolvedValue({
      subagentId: 'rejected_1',
      pid: 0,
      status: 'failed',
      error: '任务队列已满(maxQueueSize=100)',
    });

    const mgr = makePoolManager('star');
    mgr.registerPeer(makePeer('p1', 'coder'));

    const result = await mgr.dispatchTask('重构 auth 模块');

    expect(result.status).toBe('completed'); // 降级非失败,显式标注 degraded
    expect(result.degraded).toBe(true);
    expect(result.output).toContain('[coder] stub execution for: 重构 auth 模块');
    mgr.dispose();
  });

  it('fork 抛异常 → degraded:true + stub 输出', async () => {
    mocks.spawn.mockRejectedValue(new Error('fork: entry not found'));

    const mgr = makePoolManager('star');
    mgr.registerPeer(makePeer('p1', 'coder'));

    const result = await mgr.dispatchTask('任务 X');

    expect(result.degraded).toBe(true);
    expect(result.status).toBe('completed');
    expect(result.output).toContain('stub execution for: 任务 X');
    mgr.dispose();
  });

  it('peer 未注册 manager 单独使用 → stub 且 degraded:true', async () => {
    const peer = makePeer('standalone', 'researcher');
    const result = await peer.executeTask('独立任务');

    expect(result.degraded).toBe(true);
    expect(result.status).toBe('completed');
    expect(result.output).toBe('[researcher] stub execution for: 独立任务');
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});

describe('可注入 CollaborationExecutor', () => {
  it('注入自定义 executor 后不走 pool', async () => {
    const executor: CollaborationExecutor = {
      execute: async (role, task) => ({ output: `[custom:${role}] ${task}` }),
    };

    const mgr = new CollaborationManager({
      workspacePath: '/test-ws',
      topology: 'star',
      executor,
    });
    mgr.registerPeer(makePeer('p1', 'coder'));

    const result = await mgr.dispatchTask('自定义执行');

    expect(result.output).toBe('[custom:coder] 自定义执行');
    expect(result.degraded).toBeUndefined();
    expect(mocks.spawn).not.toHaveBeenCalled();
    mgr.dispose();
    expect(mocks.shutdown).not.toHaveBeenCalled(); // 注入的 executor 由调用方管理
  });

  it('executor 抛异常 → TaskResult 标记 failed', async () => {
    const executor: CollaborationExecutor = {
      execute: async () => {
        throw new Error('LLM 调用失败');
      },
    };

    const mgr = new CollaborationManager({
      workspacePath: '/test-ws',
      topology: 'star',
      executor,
    });
    mgr.registerPeer(makePeer('p1', 'coder'));

    const result = await mgr.dispatchTask('失败任务');

    expect(result.status).toBe('failed');
    expect(result.output).toBe('LLM 调用失败');
    mgr.dispose();
  });

  it('peer 构造时显式传入的 executor 优先于 manager 注入', async () => {
    const explicitExecutor = vi.fn(async (task: string) => ({ output: `[peer-explicit] ${task}` }));
    const mgrExecute = vi.fn(
      async (role: string, task: string) => ({ output: `[mgr] ${role} ${task}` }),
    );
    const mgr = new CollaborationManager({
      workspacePath: '/test-ws',
      topology: 'star',
      executor: { execute: mgrExecute },
    });
    const peer = new SubagentPeer({
      id: 'p1',
      role: 'coder',
      model: 'm',
      workspacePath: '/test-ws',
      executor: explicitExecutor,
    });
    mgr.registerPeer(peer);

    const result = await mgr.dispatchTask('显式优先');

    expect(result.output).toBe('[peer-explicit] 显式优先');
    expect(mgrExecute).not.toHaveBeenCalled();
    mgr.dispose();
  });
});

describe('hierarchical 组员分发与结果回流聚合', () => {
  function makeCountingExecutor(calls: Array<{ role: string; task: string }>): CollaborationExecutor {
    return {
      execute: async (role, task) => {
        calls.push({ role, task });
        return { output: `result-${role}-${calls.length}` };
      },
    };
  }

  it('同角色组长+组员并行执行,结果聚合为摘要并携带 memberResults', async () => {
    const calls: Array<{ role: string; task: string }> = [];
    const mgr = new CollaborationManager({
      workspacePath: '/test-ws',
      topology: 'hierarchical',
      executor: makeCountingExecutor(calls),
    });
    mgr.registerPeer(makePeer('lead', 'coder'));
    mgr.registerPeer(makePeer('m1', 'coder'));
    mgr.registerPeer(makePeer('m2', 'coder'));
    mgr.registerPeer(makePeer('other', 'reviewer')); // 不同角色不参与本次分发

    const result = await mgr.dispatchTask('实现功能', { preferredRole: 'coder' });

    // 组长 + 2 组员共 3 次执行;reviewer 不被分发
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.role === 'coder')).toBe(true);

    // 聚合摘要回流主会话:含组长/组员标识与各自输出
    expect(result.output).toContain('组长+组员聚合摘要');
    expect(result.output).toContain('3 个结果,2 个组员');
    expect(result.output).toContain('[组长 lead]');
    expect(result.output).toContain('[组员1 m1]');
    expect(result.output).toContain('[组员2 m2]');
    expect(result.output).toContain('result-coder-1');

    // memberResults 携带组员原始结果(不静默丢弃)
    expect(result.memberResults).toHaveLength(2);
    expect(result.memberResults!.map((r) => r.assignedPeerId)).toEqual(['m1', 'm2']);
    expect(result.status).toBe('completed');
    expect(result.assignedPeerId).toBe('lead');
    mgr.dispose();
  });

  it('仅组长无组员时直接返回组长结果(无聚合包装)', async () => {
    const mgr = new CollaborationManager({
      workspacePath: '/test-ws',
      topology: 'hierarchical',
      executor: { execute: async (role, task) => ({ output: `solo-${role}-${task}` }) },
    });
    mgr.registerPeer(makePeer('solo', 'planner'));

    const result = await mgr.dispatchTask('规划任务', { preferredRole: 'planner' });

    expect(result.output).toBe('solo-planner-规划任务');
    expect(result.memberResults).toBeUndefined();
    mgr.dispose();
  });

  it('组员结果含 degraded 时聚合结果透传 degraded:true', async () => {
    let call = 0;
    const mgr = new CollaborationManager({
      workspacePath: '/test-ws',
      topology: 'hierarchical',
      executor: {
        execute: async (role, task) => {
          call += 1;
          // 组长正常,组员降级
          return call === 1
            ? { output: 'lead-ok' }
            : { output: `[${role}] stub execution for: ${task}`, degraded: true };
        },
      },
    });
    mgr.registerPeer(makePeer('lead', 'coder'));
    mgr.registerPeer(makePeer('m1', 'coder'));

    const result = await mgr.dispatchTask('任务', { preferredRole: 'coder' });

    expect(result.degraded).toBe(true);
    expect(result.output).toContain('[degraded]');
    expect(result.memberResults![0]!.degraded).toBe(true);
    mgr.dispose();
  });
});

describe('消息路由死信队列', () => {
  it('目标 peer 不存在的消息入死信队列,不再静默丢弃', async () => {
    const mgr = new CollaborationManager({
      workspacePath: '/test-ws',
      topology: 'star',
      executor: { execute: async () => ({ output: 'noop' }) },
    });
    const p1 = makePeer('p1', 'coder');
    mgr.registerPeer(p1);

    expect(mgr.getDeadLetters()).toHaveLength(0);
    await p1.sendMessage('ghost', 'hello');

    // 事件总线异步路由,等一个微任务+宏任务回合
    await new Promise((r) => setTimeout(r, 0));

    const dead = mgr.getDeadLetters();
    expect(dead).toHaveLength(1);
    expect(dead[0]!.fromPeerId).toBe('p1');
    expect(dead[0]!.toPeerId).toBe('ghost');
    expect(dead[0]!.content).toBe('hello');
    mgr.dispose();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
