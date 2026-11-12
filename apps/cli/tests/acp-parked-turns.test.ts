// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * `x.ai/turn/parked` 接线验证 —— 让 listWakeableTurns 有真实消费方。
 *
 * 钉三件事:
 *   ① 方法真的注册在 ACP method registry 上(不是只有类方法);
 *   ② **跨会话**语义:两个会话各挂一个,一次调用都要捞到;
 *   ③ 只捞「到点可唤醒」的,纯事件式挂起不出现 ——
 *      混在一起会让人以为事件式挂起会自己醒。
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
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-parked-'));
  for (const k of ['IHUI_CLI_SESSIONS_DIR', 'IHUI_CLI_TURNS_DIR', 'IHUI_CLI_GOALS_DIR']) {
    saved[k] = process.env[k];
  }
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
  const s = createSession(tmp, 'park-model');
  s.history = [{ role: 'user', content: '长任务' }] as never;
  saveSession(s);
  return s.id;
}

function connect() {
  const app = buildAcpAgentApp({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never);
  const client = acp.client({ name: 'verify-parked' });
  const c = client.connect(app as never) as unknown as {
    agent: { request: (m: string, p?: unknown) => Promise<unknown> };
    close: () => void;
  };
  conn = c;
  return c;
}

/** 建一条回合并挂起。 */
async function parkOne(
  c: ReturnType<typeof connect>,
  sessionId: string,
  wake: Record<string, unknown>,
  at = 1000,
) {
  const created = (await c.agent.request('x.ai/turn/create', { sessionId, now: at })) as {
    turn: { id: string };
  };
  await c.agent.request('x.ai/turn/transition', {
    sessionId,
    turnId: created.turn.id,
    transition: { type: 'park', at: at + 1, wake },
  });
  return created.turn.id;
}

describe('x.ai/turn/parked 跨会话汇总', () => {
  it('方法可达(不是 -32601),空库返回空数组', async () => {
    const c = connect();
    const res = (await c.agent.request('x.ai/turn/parked', { now: 5000 })) as { parked: unknown[] };
    expect(Array.isArray(res.parked)).toBe(true);
    expect(res.parked).toHaveLength(0);
  });

  it('跨会话:两个会话各挂一个,一次调用都捞到', async () => {
    const s1 = seed();
    const s2 = seed();
    const c = connect();

    await parkOne(c, s1, { reason: 'awaiting-timer', notBefore: 3000 });
    await parkOne(c, s2, { reason: 'awaiting-timer', notBefore: 4000 });

    const res = (await c.agent.request('x.ai/turn/parked', { now: 5000 })) as {
      parked: { sessionId: string; reason: string; notBefore: number }[];
    };
    expect(res.parked).toHaveLength(2);
    expect(new Set(res.parked.map((p) => p.sessionId))).toEqual(new Set([s1, s2]));
    expect(res.parked.every((p) => p.reason === 'awaiting-timer')).toBe(true);
  });

  it('未到点不出现;到点才出现', async () => {
    const s = seed();
    const c = connect();
    await parkOne(c, s, { reason: 'awaiting-timer', notBefore: 10_000 });

    const before = (await c.agent.request('x.ai/turn/parked', { now: 9999 })) as {
      parked: unknown[];
    };
    expect(before.parked).toHaveLength(0);

    const after = (await c.agent.request('x.ai/turn/parked', { now: 10_000 })) as {
      parked: unknown[];
    };
    expect(after.parked).toHaveLength(1);
  });

  it('纯事件式挂起不出现(只能被显式 wake)', async () => {
    const s = seed();
    const c = connect();
    await parkOne(c, s, { reason: 'awaiting-user' });

    const res = (await c.agent.request('x.ai/turn/parked', { now: 999_999_999 })) as {
      parked: unknown[];
    };
    expect(res.parked).toHaveLength(0);
  });

  it('已收口的回合不出现', async () => {
    const s = seed();
    const c = connect();
    const turnId = await parkOne(c, s, { reason: 'awaiting-timer', notBefore: 3000 });
    await c.agent.request('x.ai/turn/transition', {
      sessionId: s,
      turnId,
      transition: { type: 'cancel', at: 4000 },
    });

    const res = (await c.agent.request('x.ai/turn/parked', { now: 9999 })) as {
      parked: unknown[];
    };
    expect(res.parked).toHaveLength(0);
  });
});
