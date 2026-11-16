// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 新增 3 个 ACP 方法的**协议级**可达性验证。
 *
 * 与纯函数测试的分工:那些测判据,本文件测「方法有没有真的挂到注册表」。
 * ACP 对未注册方法回 `-32601`,与"没实现"对客户端是同一个错误 ——
 * 直接调 `agent.xxx()` 的结构性盲区就在这里。
 *
 * 覆盖:x.ai/goal/iterate、x.ai/turn/chronicle、x.ai/workflow/plan
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ setupAgentTools: vi.fn(), runToolLoop: vi.fn() }));
vi.mock('../src/commands/agent.js', () => ({
  setupAgentTools: mocks.setupAgentTools,
  runToolLoop: mocks.runToolLoop,
}));

const acp = await import('@agentclientprotocol/sdk');
const { buildAcpAgentApp } = await import('../src/acp/server.js');
const { createSession, saveSession } = await import('../src/commands/session.js');

let tmp: string;
let conn: { agent: { request: (m: string, p?: unknown) => Promise<unknown> }; close: () => void } | null;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-newacp-'));
  for (const k of ['IHUI_CLI_SESSIONS_DIR', 'IHUI_CLI_TURNS_DIR', 'IHUI_CLI_GOALS_DIR']) saved[k] = process.env[k];
  process.env.IHUI_CLI_SESSIONS_DIR = path.join(tmp, 'sessions');
  process.env.IHUI_CLI_TURNS_DIR = path.join(tmp, 'turns');
  process.env.IHUI_CLI_GOALS_DIR = path.join(tmp, 'goals');
  conn = null;
});

afterEach(() => {
  try {
    conn?.close();
  } catch {
    /* ignore */
  }
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

function seed(): string {
  const s = createSession(tmp, 'm');
  s.history = [{ role: 'user', content: 'x' }] as never;
  saveSession(s);
  return s.id;
}

function connect() {
  const app = buildAcpAgentApp({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never);
  const client = acp.client({ name: 'verify-new' });
  const c = client.connect(app as never) as unknown as {
    agent: { request: (m: string, p?: unknown) => Promise<unknown> };
    close: () => void;
  };
  conn = c;
  return c;
}

describe('x.ai/goal/iterate 可达', () => {
  it('首轮达成 ⇒ achieved,目标自动迁到 achieved', async () => {
    const sessionId = seed();
    const c = connect();
    const g = (await c.agent.request('x.ai/goal/create', {
      sessionId,
      statement: '把 A 做完',
      now: 1000,
    })) as { goal: { id: string } };

    const res = (await c.agent.request('x.ai/goal/iterate', {
      sessionId,
      goalId: g.goal.id,
      maxIterations: 3,
      now: 2000,
      verdicts: [{ done: false }, { done: true, note: '第三轮成了' }],
    })) as { outcome: { kind: string; iterations: number }; goal: { status: string }; summary: string };

    expect(res.outcome.kind).toBe('achieved');
    expect(res.outcome.iterations).toBe(2);
    expect(res.goal.status).toBe('achieved');
    expect(res.summary).toContain('达成');
  });

  it('跑满未达成 ⇒ exhausted,目标**保持 active**(不标失败)', async () => {
    const sessionId = seed();
    const c = connect();
    const g = (await c.agent.request('x.ai/goal/create', {
      sessionId,
      statement: 'x',
      now: 1000,
    })) as { goal: { id: string } };

    const res = (await c.agent.request('x.ai/goal/iterate', {
      sessionId,
      goalId: g.goal.id,
      maxIterations: 2,
      now: 2000,
      verdicts: [{ done: false }, { done: false }],
    })) as { outcome: { kind: string }; goal: { status: string }; summary: string };

    expect(res.outcome.kind).toBe('exhausted');
    expect(res.goal.status).toBe('active'); // 关键:未达成不是失败
    expect(res.summary).toContain('不算失败');
  })

  it('目标不存在 ⇒ 抛错', async () => {
    const sessionId = seed();
    const c = connect();
    await expect(
      c.agent.request('x.ai/goal/iterate', {
        sessionId,
        goalId: 'goal_nope',
        maxIterations: 1,
        verdicts: [{ done: true }],
      }),
    ).rejects.toThrow();
  })
})

describe('x.ai/turn/chronicle 可达', () => {
  it('空会话 ⇒ 空时间线与全零统计', async () => {
    const sessionId = seed();
    const c = connect();
    const res = (await c.agent.request('x.ai/turn/chronicle', { sessionId })) as {
      events: unknown[];
      stats: { totalTurns: number };
    };
    expect(res.events).toEqual([]);
    expect(res.stats.totalTurns).toBe(0);
  })

  it('有回合后 ⇒ 事件与统计都对得上', async () => {
    const sessionId = seed();
    const c = connect();
    await c.agent.request('x.ai/turn/create', { sessionId, now: 1000 });
    const res = (await c.agent.request('x.ai/turn/chronicle', { sessionId })) as {
      events: { kind: string }[];
      stats: { totalTurns: number; active: number };
    };
    expect(res.events.length).toBeGreaterThan(0);
    expect(res.events[0]!.kind).toBe('turn-created');
    expect(res.stats.totalTurns).toBe(1);
    expect(res.stats.active).toBe(1);
  })
})

describe('x.ai/workflow/plan 可达', () => {
  it('线性依赖分三层', async () => {
    const c = connect();
    const res = (await c.agent.request('x.ai/workflow/plan', {
      steps: [{ id: 'a' }, { id: 'b', needs: ['a'] }, { id: 'c', needs: ['b'] }],
    })) as { layers: string[][]; layerOf: Record<string, number>; stepCount: number };

    expect(res.layers).toEqual([['a'], ['b'], ['c']]);
    expect(res.layerOf.c).toBe(2);
    expect(res.stepCount).toBe(3);
  })

  it('环 ⇒ 抛错并点名', async () => {
    const c = connect();
    await expect(
      c.agent.request('x.ai/workflow/plan', {
        steps: [
          { id: 'a', needs: ['b'] },
          { id: 'b', needs: ['a'] },
        ],
      }),
    ).rejects.toThrow(/环/);
  })

  it('未知依赖 ⇒ 抛错', async () => {
    const c = connect();
    await expect(
      c.agent.request('x.ai/workflow/plan', { steps: [{ id: 'a', needs: ['nope'] }] }),
    ).rejects.toThrow(/不存在/);
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
