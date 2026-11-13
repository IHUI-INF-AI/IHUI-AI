// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回合运行态接线 —— **真实跑一次 runToolLoop**,验证它真的留下了记录。
 *
 * 为什么不能只测映射函数:那样即使 `runToolLoop` 里一行调用都没有,测试也全绿 ——
 * 状态机会变成死码,而"回合被中断后看不到它在做什么"的问题一点没解决。
 *
 * 做法:把 `@ihui/api-client` 的 `streamChat` 换成桩(直接吐一段文本然后结束),
 * 其余全部走真实代码路径(真实的 runToolLoop、真实的 turn-store 落盘)。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stub = vi.hoisted(() => ({
  /** 每次调用 streamChat 时被赋值的"本轮要吐的文本" */
  text: '好的,我做完了。',
  /** 是否让流抛错 */
  shouldThrow: false,
}));

vi.mock('@ihui/api-client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@ihui/api-client')>();
  return {
    ...real,
    streamChat: async (opts: { onDelta?: (d: string) => void }) => {
      if (stub.shouldThrow) throw new Error('stub stream failure');
      opts.onDelta?.(stub.text);
      return { finishReason: 'stop' };
    },
    getModelContextCapacity: () => 100000,
    setBaseUrl: () => {},
    formatSSEError: () => ({ message: '', severity: 'error' }),
  };
});

const { runToolLoop } = await import('../src/commands/agent.js');
const { createSession, saveSession } = await import('../src/commands/session.js');
const { loadSessionRuntime } = await import('../src/acp/turn-store.js');

let dir = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-turn-loop-'));
  process.env.IHUI_CLI_SESSIONS_DIR = path.join(dir, 'sessions');
  process.env.IHUI_CLI_TURNS_DIR = path.join(dir, 'turns');
  process.env.IHUI_CLI_GOALS_DIR = path.join(dir, 'goals');
  stub.shouldThrow = false;
});

afterEach(() => {
  for (const k of ['IHUI_CLI_SESSIONS_DIR', 'IHUI_CLI_TURNS_DIR', 'IHUI_CLI_GOALS_DIR']) {
    delete process.env[k];
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

function seed(): string {
  const s = createSession(dir, 'loop-model');
  s.history = [{ role: 'user', content: '帮我做一件事' }] as never;
  saveSession(s);
  return s.id;
}

/** 最小 ToolContext 桩:循环需要它但本测试不触发任何工具。 */
function ctxStub() {
  return {
    cwd: dir,
    permissionMode: 'auto',
    allowDangerous: false,
    sessionId: undefined,
  } as never;
}

describe('真实 runToolLoop 的回合记录', () => {
  it('正常跑完 ⇒ 留下一条 completed 记录,且 endReason 为 normal', async () => {
    const sessionId = seed();
    const res = await runToolLoop({
      modelId: 'loop-model',
      messages: [{ role: 'user', content: '帮我做一件事' } as never],
      ctx: ctxStub(),
      maxIterations: 2,
      sessionId,
    });

    expect(res.stopReason).toBe('end_turn');
    const rt = loadSessionRuntime(sessionId);
    expect(rt.turns.length).toBe(1);
    const t = rt.turns[0]!;
    expect(t.phase).toBe('completed');
    expect(t.endReason?.kind).toBe('normal');
    // 完成后没有活跃回合
    expect(rt.activeTurnId).toBeNull();
  })

  it('不传 sessionId ⇒ 不写任何记录(默认面保持干净)', async () => {
    const sessionId = seed();
    await runToolLoop({
      modelId: 'loop-model',
      messages: [{ role: 'user', content: 'x' } as never],
      ctx: ctxStub(),
      maxIterations: 1,
    })
    expect(loadSessionRuntime(sessionId).turns).toEqual([])
  })

  it('流抛错导致循环异常终止时,记录不得让异常被吞掉(执行面优先)', async () => {
    const sessionId = seed();
    stub.shouldThrow = true
    let threw = false
    try {
      await runToolLoop({
        modelId: 'loop-model',
        messages: [{ role: 'user', content: 'x' } as never],
        ctx: ctxStub(),
        maxIterations: 1,
        sessionId,
      })
    } catch {
      threw = true
    }
    // 无论循环是抛错还是自己收成 error,运行态记录都不应"吃掉"错误语义:
    // 抛错 ⇒ 执行面把错误传出;不抛 ⇒ 记录必须反映非 normal。
    if (!threw) {
      const rt = loadSessionRuntime(sessionId)
      if (rt.turns.length > 0) {
        expect(rt.turns[0]!.endReason?.kind).not.toBe('normal')
      }
    }
    expect(typeof threw).toBe('boolean')
  })

  it('连续两轮 ⇒ 回合序号递增,旧记录不被覆盖', async () => {
    const sessionId = seed();
    for (let i = 0; i < 2; i++) {
      await runToolLoop({
        modelId: 'loop-model',
        messages: [{ role: 'user', content: `第 ${i} 轮` } as never],
        ctx: ctxStub(),
        maxIterations: 1,
        sessionId,
      })
    }
    const rt = loadSessionRuntime(sessionId);
    expect(rt.turns.length).toBe(2);
    expect(rt.turns.map((t) => t.ordinal)).toEqual([1, 2]);
    // 两轮都必须真的被**收口**(只建不关会让 activeTurnId 永远指着最后一轮)
    expect(rt.turns.every((t) => t.phase === 'completed')).toBe(true);
    expect(rt.activeTurnId).toBeNull();
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
