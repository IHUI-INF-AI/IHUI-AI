// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 成本审批接线 —— 真实跑 runToolLoop，验证五档判定真的影响执行。
 *
 * 钉三件事:
 *   ① **零回归**:不传 `costApproval` 时行为与引入前逐字相同(到点硬停);
 *   ② 五档真的分流:proceed 放行、其余全部停;
 *   ③ `unjudged` 被拦下 —— 这是最关键的一条:量不到就不放行,
 *      失效方向恒为保守,不得把"不知道"当成"通过"。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stub = vi.hoisted(() => ({
  /** 每次调用返回的 token 用量,用来把累计成本推过阈值 */
  promptTokens: 100,
  completionTokens: 100,
}));

vi.mock('@ihui/api-client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@ihui/api-client')>();
  return {
    ...real,
    streamChat: async (opts: { onDelta?: (d: string) => void; onUsage?: (u: unknown) => void }) => {
      opts.onDelta?.('完成');
      // 模拟 usage 事件:让 totalCostUsd 随迭代累加
      opts.onUsage?.({ promptTokens: stub.promptTokens, completionTokens: stub.completionTokens });
      return { finishReason: 'stop' };
    },
    getModelContextCapacity: () => 100000,
    setBaseUrl: () => {},
    formatSSEError: () => ({ message: '', severity: 'error' }),
  };
});

const { runToolLoop } = await import('../src/commands/agent.js');
const { createSession, saveSession } = await import('../src/commands/session.js');

let dir = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cost-gate-'));
  process.env.IHUI_CLI_SESSIONS_DIR = path.join(dir, 'sessions');
  process.env.IHUI_CLI_TURNS_DIR = path.join(dir, 'turns');
  process.env.IHUI_CLI_GOALS_DIR = path.join(dir, 'goals');
});

afterEach(() => {
  for (const k of ['IHUI_CLI_SESSIONS_DIR', 'IHUI_CLI_TURNS_DIR', 'IHUI_CLI_GOALS_DIR']) delete process.env[k];
  fs.rmSync(dir, { recursive: true, force: true });
});

function seed(): string {
  const s = createSession(dir, 'cost-model');
  s.history = [{ role: 'user', content: '跑一件事' }] as never;
  saveSession(s);
  return s.id;
}

const ctxStub = () => ({ cwd: dir, permissionMode: 'auto', allowDangerous: false }) as never;

/** maxCostUsd 设成 0 ⇒ 第一次迭代后必然触发预算闸。 */
async function runWith(extra: Record<string, unknown>) {
  return runToolLoop({
    modelId: 'cost-model',
    messages: [{ role: 'user', content: 'x' } as never],
    ctx: ctxStub(),
    maxIterations: 5,
    maxCostUsd: 0,
    sessionId: seed(),
    ...extra,
  } as never);
}

describe('成本审批接线', () => {
  it('零回归:不传 costApproval ⇒ 到点硬停,与引入前一致', async () => {
    const res = await runWith({});
    expect(res.stopReason).toBe('budget_limited');
    // 未传审批上下文时不该凭空产出判定
    expect(res.costApproval).toBeUndefined();
  });

  it('proceed(已审批)→ 放行,不停在第一次迭代', async () => {
    const res = await runWith({
      costApproval: {
        mandatory: true,
        failureMode: 'requireApproval',
        category: 'llm',
        balance: 100,
        decision: 'approved',
      },
    });
    // 放行后不会因预算停;maxIterations=5 但它会自己 end_turn
    expect(res.stopReason).not.toBe('budget_limited');
    expect(res.costApproval?.disposition).toBe('proceed');
  });

  it('held(等审批)→ 停,且判定可区分于 refused', async () => {
    const res = await runWith({
      costApproval: {
        mandatory: true,
        failureMode: 'requireApproval',
        category: 'llm',
        balance: 100,
        decision: null,
      },
    });
    expect(res.stopReason).toBe('budget_limited');
    expect(res.costApproval?.disposition).toBe('held');
  });

  it('refused(余额不足)→ 停', async () => {
    // 注意:cost 取的是**累计已花**,balance=0 时若 cost 也是 0 则 0>0 为假 ⇒ 不会 refused。
    // 所以这里用 balance 极小正值并让 stub 的 usage 把 cost 推上去,才是真实场景。
    // 必须用**在价目表里**的模型名,否则 resolveModelPricing 返回 null ⇒ cost 恒 0 ⇒
    // `cost > balance` 永不成立,refused 分支测不到。这是实测踩到的坑。
    stub.promptTokens = 1_000_000
    stub.completionTokens = 1_000_000
    const res = await runToolLoop({
      modelId: 'gpt-4o',
      messages: [{ role: 'user', content: 'x' } as never],
      ctx: ctxStub(),
      maxIterations: 5,
      maxCostUsd: 0, // 第一次迭代后必触发
      sessionId: seed(),
      costApproval: {
        mandatory: true,
        failureMode: 'requireApproval',
        category: 'llm',
        balance: 0,
        decision: 'approved',
      },
    } as never);
    expect(res.stopReason).toBe('budget_limited')
    expect(res.costApproval?.disposition).toBe('refused')
    expect(res.costApproval?.reason).toBe('insufficient-balance')
  })

  it('unjudged(量不到)→ 必须被拦下,不得当成通过', async () => {
    const res = await runWith({
      costApproval: {
        mandatory: true,
        failureMode: 'requireApproval',
        category: 'llm',
        balance: null, // 未测量
        decision: 'approved',
      },
    });
    expect(res.stopReason).toBe('budget_limited');
    expect(res.costApproval?.disposition).toBe('unjudged');
    expect(res.costApproval?.effect).toBe('none');
  })

  it('not-mandatory 时 proceed,不受预算闸影响', async () => {
    const res = await runWith({
      costApproval: {
        mandatory: false,
        failureMode: 'requireApproval',
        category: 'llm',
        balance: 0,
        decision: null,
      },
    });
    expect(res.stopReason).not.toBe('budget_limited');
    expect(res.costApproval?.reason).toBe('not-mandatory');
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
