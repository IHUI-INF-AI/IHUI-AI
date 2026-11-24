// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


import { describe, expect, it } from 'vitest';

import {
  abandonGoal,
  achieveGoal,
  createGoal,
  describeGoal,
  recordUsage,
  resumeGoal,
  setMode,
  suspendGoal,
  withinBudget,
  type GoalEntity,
} from '../src/acp/goal-state.js';

/** 固定时钟,便于断言 updatedAt。 */
function fixedNow(): () => number {
  let t = 1_000;
  return () => (t += 1);
}

/** 造一个合法 active 目标(测试复用)。 */
function activeGoal(over: Partial<Parameters<typeof createGoal>[0]> = {}): GoalEntity {
  const r = createGoal(
    {
      goalId: 'g1',
      objective: '把 J6 做完',
      budget: { maxRounds: 10, maxTokens: 1000 },
      ...over,
    },
    fixedNow(),
  );
  if (!r.ok) throw new Error(`fixture 创建失败:${r.reason}`);
  return r.goal;
}

describe('J6 目标状态机 · createGoal', () => {
  it('合法创建 → active + 预算锁定 + 计数归零', () => {
    const r = createGoal(
      { goalId: 'g1', objective: '目标', mode: 'plan', budget: { maxRounds: 5 } },
      fixedNow(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.goal.status).toBe('active');
    expect(r.goal.mode).toBe('plan');
    expect(r.goal.roundsUsed).toBe(0);
    expect(r.goal.budget.maxRounds).toBe(5);
  });

  it('缺 budget → 拒(无预算目标不允许)', () => {
    const r = createGoal({ goalId: 'g', objective: 'x', budget: {} }, fixedNow());
    expect(r.ok).toBe(false);
  });

  it('objective 空串 / goalId 空 → 拒', () => {
    expect(createGoal({ goalId: 'g', objective: '  ', budget: { maxRounds: 1 } }).ok).toBe(false);
    expect(createGoal({ goalId: '', objective: 'x', budget: { maxRounds: 1 } }).ok).toBe(false);
  });

  it('budget 非正/非整数 → 拒', () => {
    expect(createGoal({ goalId: 'g', objective: 'x', budget: { maxRounds: 0 } }).ok).toBe(false);
    expect(createGoal({ goalId: 'g', objective: 'x', budget: { maxRounds: 1.5 } }).ok).toBe(false);
  });

  it('mode 缺省 → code', () => {
    const g = activeGoal();
    expect(g.mode).toBe('code');
  });
});

describe('J6 目标状态机 · 挂起/唤醒闭环', () => {
  it('active → suspend(记条件)→ resume(条件满足)→ active', () => {
    const g = activeGoal();
    const s = suspendGoal(
      g,
      { reason: '等用户确认 schema', resumeWhen: '用户回复确认', background: false },
      fixedNow(),
    );
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.goal.status).toBe('suspended');
    expect(s.goal.wakeup?.resumeWhen).toBe('用户回复确认');
    expect(s.goal.wakeup?.background).toBe(false);

    const r = resumeGoal(s.goal, true, fixedNow());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.goal.status).toBe('active');
    expect(r.goal.wakeup).toBeUndefined();
  });

  it('suspend 缺 reason 或 resumeWhen → 拒(不能丢"为什么停/什么条件继续")', () => {
    const g = activeGoal();
    expect(suspendGoal(g, { reason: '', resumeWhen: 'x' }).ok).toBe(false);
    expect(suspendGoal(g, { reason: 'x', resumeWhen: '' }).ok).toBe(false);
  });

  it('resume 条件未满足 → 拒(防误唤醒)', () => {
    const g = activeGoal();
    const s = suspendGoal(g, { reason: 'r', resumeWhen: 'w' });
    if (!s.ok) throw new Error('suspend 失败');
    const r = resumeGoal(s.goal, false, fixedNow());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('唤醒条件未满足');
  });

  it('resume 非 suspended 态 → 拒', () => {
    const g = activeGoal();
    expect(resumeGoal(g, true).ok).toBe(false);
  });

  it('后台唤醒 background=true 透传,不改变状态语义', () => {
    const g = activeGoal();
    const s = suspendGoal(g, { reason: 'r', resumeWhen: '文件出现', background: true });
    if (!s.ok) throw new Error('suspend 失败');
    expect(s.goal.wakeup?.background).toBe(true);
  });
});

describe('J6 目标状态机 · 终态', () => {
  it('achieve → achieved;再改 → 拒', () => {
    const g = activeGoal();
    const a = achieveGoal(g, fixedNow());
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.goal.status).toBe('achieved');
    expect(achieveGoal(a.goal).ok).toBe(false);
    expect(abandonGoal(a.goal, 'x').ok).toBe(false);
    expect(recordUsage(a.goal, { rounds: 1 }).ok).toBe(false);
  });

  it('abandon 缺 reason → 拒;abandoned 与 achieved 区分', () => {
    const g = activeGoal();
    expect(abandonGoal(g, '').ok).toBe(false);
    const a = abandonGoal(g, '决定不做了', fixedNow());
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.goal.status).toBe('abandoned');
    expect(a.goal.status).not.toBe('achieved');
  });

  it('suspended 可直达终态(挂起中放弃)', () => {
    const g = activeGoal();
    const s = suspendGoal(g, { reason: 'r', resumeWhen: 'w' });
    if (!s.ok) throw new Error('suspend 失败');
    const a = achieveGoal(s.goal, fixedNow());
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.goal.status).toBe('achieved');
    expect(a.goal.wakeup).toBeUndefined();
  });
});

describe('J6 目标状态机 · 使用累加与预算', () => {
  it('recordUsage 累加 tokens/time/rounds', () => {
    let g = activeGoal();
    const u1 = recordUsage(g, { tokens: 100, timeMs: 500, rounds: 1 });
    if (!u1.ok) throw new Error('usage 失败');
    const u2 = recordUsage(u1.goal, { tokens: 50, timeMs: 250, rounds: 1 });
    if (!u2.ok) throw new Error('usage 失败');
    g = u2.goal;
    expect(g.tokensUsed).toBe(150);
    expect(g.timeUsedMs).toBe(750);
    expect(g.roundsUsed).toBe(2);
  });

  it('withinBudget:未超 true,任一项超限 false', () => {
    let g = activeGoal({ budget: { maxRounds: 2, maxTokens: 100 } });
    expect(withinBudget(g)).toBe(true);
    const u = recordUsage(g, { rounds: 2, tokens: 50 });
    if (!u.ok) throw new Error('usage 失败');
    g = u.goal;
    // rounds 已到顶(2>=2)⇒ 即使 tokens 未超,预算也视为用尽。
    expect(withinBudget(g)).toBe(false);
    const u2 = recordUsage(g, { tokens: 50 });
    if (!u2.ok) throw new Error('usage 失败');
    expect(withinBudget(u2.goal)).toBe(false); // tokens 也超限
  });

  it('withinBudget:undefined 项视为不限', () => {
    const g = activeGoal({ budget: { maxRounds: 3 } });
    expect(withinBudget({ ...g, tokensUsed: 999_999, timeUsedMs: 999_999 })).toBe(true);
  });
});

describe('J6 目标状态机 · 模式切换', () => {
  it('setMode 切换 + 幂等', () => {
    const g = activeGoal({ mode: 'code' });
    const m1 = setMode(g, 'plan', fixedNow());
    expect(m1.ok).toBe(true);
    if (!m1.ok) return;
    expect(m1.goal.mode).toBe('plan');
    const m2 = setMode(m1.goal, 'plan', fixedNow());
    expect(m2.ok).toBe(true);
    if (!m2.ok) return;
    expect(m2.goal.updatedAt).toBe(m1.goal.updatedAt); // 幂等:原样返回
  });

  it('终态不可切模式', () => {
    const g = activeGoal();
    const a = achieveGoal(g);
    if (!a.ok) throw new Error('achieve 失败');
    expect(setMode(a.goal, 'plan').ok).toBe(false);
  });
});

describe('J6 目标状态机 · describeGoal(不把挂起说成失败)', () => {
  it('各状态摘要可读且区分', () => {
    const g = activeGoal();
    expect(describeGoal(g)).toContain('运行中');
    const s = suspendGoal(g, { reason: '等确认', resumeWhen: '用户回复', background: true });
    if (!s.ok) throw new Error('suspend 失败');
    expect(describeGoal(s.goal)).toContain('挂起');
    expect(describeGoal(s.goal)).toContain('用户回复');
    const a = achieveGoal(s.goal);
    if (!a.ok) throw new Error('achieve 失败');
    expect(describeGoal(a.goal)).toContain('达成');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
