// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 改动后自动复审(auto-review)。
 *
 * 钉五件事:
 *   ① **默认关闭**(打开会让所有编辑变慢,不能让用户莫名背这个成本);
 *   ② 只读工具**绝不触发**(否则一次探索式读取就引发全量诊断);
 *   ③ 写失败不触发(文件没变);
 *   ④ batched 的两条触发路径(攒够数量 / 间隔到点)都要生效;
 *   ⑤ 结论只报**新增**(500 处历史告警的仓库里,全量报告等于没有报告)。
 */
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_REVIEW_POLICY,
  INITIAL_REVIEW_STATE,
  describeVerdict,
  issueKey,
  judgeReview,
  shouldReview,
  type DiagnosticIssue,
  type ReviewPolicy,
} from '../src/tools/auto-review.js';

const enabled = (over: Partial<ReviewPolicy> = {}): ReviewPolicy => ({
  ...DEFAULT_REVIEW_POLICY,
  enabled: true,
  ...over,
});

const NOW = 1_700_000_000_000;

describe('shouldReview 触发策略', () => {
  it('默认策略是关闭的', () => {
    expect(DEFAULT_REVIEW_POLICY.enabled).toBe(false);
  });

  it('关闭时:不触发,且不累积 pendingWrites', () => {
    const r = shouldReview({
      policy: DEFAULT_REVIEW_POLICY,
      state: INITIAL_REVIEW_STATE,
      toolName: 'edit_file',
      succeeded: true,
      now: NOW,
    });
    expect(r.review).toBe(false);
    expect(r.nextState.pendingWrites).toBe(0);
    expect(r.reason).toContain('disabled');
  });

  it('只读工具不触发,也不累积', () => {
    for (const tool of ['read_file', 'grep', 'glob', 'web_search']) {
      const r = shouldReview({
        policy: enabled({ trigger: 'every-write' }),
        state: INITIAL_REVIEW_STATE,
        toolName: tool,
        succeeded: true,
        now: NOW,
      });
      expect(r.review).toBe(false);
      expect(r.nextState.pendingWrites).toBe(0);
    }
  });

  it('写失败不触发(文件没变)', () => {
    const r = shouldReview({
      policy: enabled({ trigger: 'every-write' }),
      state: INITIAL_REVIEW_STATE,
      toolName: 'edit_file',
      succeeded: false,
      now: NOW,
    });
    expect(r.review).toBe(false);
    expect(r.reason).toContain('unchanged');
  });

  it('every-write:每次成功写都触发', () => {
    const r = shouldReview({
      policy: enabled({ trigger: 'every-write' }),
      state: INITIAL_REVIEW_STATE,
      toolName: 'write_file',
      succeeded: true,
      now: NOW,
    });
    expect(r.review).toBe(true);
    expect(r.nextState.pendingWrites).toBe(0);
  });

  it('batched:攒够 batchSize 才触发', () => {
    const policy = enabled({ trigger: 'batched', batchSize: 3, minIntervalMs: 60_000 });
    let state = INITIAL_REVIEW_STATE;
    const reasons: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = shouldReview({
        policy,
        state,
        toolName: 'edit_file',
        succeeded: true,
        now: NOW + i,
      });
      state = r.nextState;
      reasons.push(r.reason ?? '');
    }
    // 前两次不触发,第三次触发
    expect(reasons[0]).toContain('pending 1/3');
    expect(reasons[1]).toContain('pending 2/3');
    expect(reasons[2]).toContain('batch size 3');
  });

  it('batched:间隔到点也会触发(即使数量不够)', () => {
    const policy = enabled({ trigger: 'batched', batchSize: 100, minIntervalMs: 1000 });
    const r = shouldReview({
      policy,
      state: { pendingWrites: 1, lastReviewAt: NOW - 2000 },
      toolName: 'edit_file',
      succeeded: true,
      now: NOW,
    });
    expect(r.review).toBe(true);
    expect(r.reason).toContain('interval');
  });

  it('manual:只有 explicit 才触发', () => {
    const policy = enabled({ trigger: 'manual' });
    const no = shouldReview({
      policy,
      state: INITIAL_REVIEW_STATE,
      toolName: 'edit_file',
      succeeded: true,
      now: NOW,
    });
    expect(no.review).toBe(false);

    const yes = shouldReview({
      policy,
      state: INITIAL_REVIEW_STATE,
      toolName: 'edit_file',
      succeeded: true,
      now: NOW,
      explicit: true,
    });
    expect(yes.review).toBe(true);
  });

  it('explicit 在关闭策略下也不触发(总开关优先)', () => {
    const r = shouldReview({
      policy: DEFAULT_REVIEW_POLICY,
      state: INITIAL_REVIEW_STATE,
      toolName: 'edit_file',
      succeeded: true,
      now: NOW,
      explicit: true,
    });
    expect(r.review).toBe(false);
  });
});

describe('judgeReview 只报新增', () => {
  const mk = (file: string, rule: string, symbol: string, sev: 'error' | 'warning' = 'error'): DiagnosticIssue => ({
    file,
    key: issueKey(file, rule, symbol),
    message: `${rule} at ${symbol}`,
    severity: sev,
  });

  it('存量问题不进 introduced,只报数', () => {
    const base = [mk('a.ts', 'no-any', 'x'), mk('b.ts', 'no-unused', 'y')];
    const v = judgeReview(base, base);
    expect(v.introduced).toHaveLength(0);
    expect(v.preexistingCount).toBe(2);
    expect(v.regressed).toBe(false);
  });

  it('新增 error ⇒ regressed', () => {
    const base = [mk('a.ts', 'no-any', 'x')];
    const cur = [...base, mk('c.ts', 'no-any', 'z')];
    const v = judgeReview(base, cur);
    expect(v.introduced).toHaveLength(1);
    expect(v.regressed).toBe(true);
  });

  it('新增 warning 不 regressed(只有 error 阻断)', () => {
    const base: DiagnosticIssue[] = [];
    const cur = [mk('c.ts', 'style', 'z', 'warning')];
    const v = judgeReview(base, cur);
    expect(v.introduced).toHaveLength(1);
    expect(v.regressed).toBe(false);
  });

  it('修好的问题计入 resolvedCount', () => {
    const base = [mk('a.ts', 'no-any', 'x'), mk('b.ts', 'no-unused', 'y')];
    const cur = [mk('a.ts', 'no-any', 'x')];
    const v = judgeReview(base, cur);
    expect(v.resolvedCount).toBe(1);
    expect(v.preexistingCount).toBe(1);
  });

  it('行号漂移不算新问题(key 按文件+规则+符号,不按 message)', () => {
    const base: DiagnosticIssue[] = [
      { file: 'a.ts', key: issueKey('a.ts', 'no-any', 'x'), message: 'error at line 10', severity: 'error' },
    ];
    const cur: DiagnosticIssue[] = [
      { file: 'a.ts', key: issueKey('a.ts', 'no-any', 'x'), message: 'error at line 99', severity: 'error' },
    ];
    const v = judgeReview(base, cur);
    expect(v.introduced).toHaveLength(0);
    expect(v.regressed).toBe(false);
  });

  it('describeVerdict 无新增时明确说"无新增"', () => {
    const s = describeVerdict({ regressed: false, introduced: [], preexistingCount: 3, resolvedCount: 0 });
    expect(s).toContain('无新增问题');
    expect(s).toContain('存量 3');
  });
});

describe('真实接线:写操作触发 reviewDue', () => {
  it('every-write + 一次 write_file ⇒ reviewDue=true', async () => {
    const fs = await import('node:fs')
    const os = await import('node:os')
    const path = await import('node:path')
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-review-e2e-'))
    const saved = {
      IHUI_CLI_SESSIONS_DIR: process.env.IHUI_CLI_SESSIONS_DIR,
      IHUI_CLI_TURNS_DIR: process.env.IHUI_CLI_TURNS_DIR,
      IHUI_CLI_GOALS_DIR: process.env.IHUI_CLI_GOALS_DIR,
    }
    process.env.IHUI_CLI_SESSIONS_DIR = path.join(dir, 'sessions')
    process.env.IHUI_CLI_TURNS_DIR = path.join(dir, 'turns')
    process.env.IHUI_CLI_GOALS_DIR = path.join(dir, 'goals')
    try {
      const ar = await import('../src/tools/auto-review.js')
      // 直接驱动「判据 + 状态机」的真实组合：模拟 runToolLoop 内部那一次调用
      let state = ar.INITIAL_REVIEW_STATE
      const policy = { ...ar.DEFAULT_REVIEW_POLICY, enabled: true, trigger: 'every-write' as const }
      const d = ar.shouldReview({
        policy,
        state,
        toolName: 'write_file',
        succeeded: true,
        now: 1000,
      })
      state = d.nextState
      expect(d.review).toBe(true)

      // 反向：关闭时同一路径必须为 false（证明开关真的起作用）
      const off = ar.shouldReview({
        policy: ar.DEFAULT_REVIEW_POLICY,
        state: ar.INITIAL_REVIEW_STATE,
        toolName: 'write_file',
        succeeded: true,
        now: 1000,
      })
      expect(off.review).toBe(false)
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('runToolLoop 接受 reviewPolicy 且不改变无写场景的行为', async () => {
    const fs = await import('node:fs')
    const os = await import('node:os')
    const path = await import('node:path')
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-review-sig-'))
    const saved = {
      IHUI_CLI_SESSIONS_DIR: process.env.IHUI_CLI_SESSIONS_DIR,
      IHUI_CLI_TURNS_DIR: process.env.IHUI_CLI_TURNS_DIR,
      IHUI_CLI_GOALS_DIR: process.env.IHUI_CLI_GOALS_DIR,
    }
    process.env.IHUI_CLI_SESSIONS_DIR = path.join(dir, 'sessions')
    process.env.IHUI_CLI_TURNS_DIR = path.join(dir, 'turns')
    process.env.IHUI_CLI_GOALS_DIR = path.join(dir, 'goals')
    try {
      const ar = await import('../src/tools/auto-review.js')
      const { createSession, saveSession } = await import('../src/commands/session.js')
      const session = createSession(dir, 'gpt-4o')
      session.history = [{ role: 'user', content: 'x' }] as never
      saveSession(session)

      const { runToolLoop } = await import('../src/commands/agent.js')
      const res = await runToolLoop({
        modelId: 'gpt-4o',
        messages: [{ role: 'user', content: 'x' } as never],
        ctx: { cwd: dir, permissionMode: 'auto', allowDangerous: false } as never,
        maxIterations: 1,
        sessionId: session.id,
        reviewPolicy: { ...ar.DEFAULT_REVIEW_POLICY, enabled: true, trigger: 'every-write' },
      } as never)
      // 无写操作 ⇒ 不带 reviewDue（证明字段语义是"真的到点了"而不是恒 true）
      expect(res.reviewDue).toBeUndefined()
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
