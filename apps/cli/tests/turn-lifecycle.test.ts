// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 回合运行态状态机 —— 迁移合法性。
 *
 * 钉的是「哪些迁移允许、哪些必须拒绝」。每条拒绝都对应一个真实的破坏场景:
 *   · 终态再迁移 → 结算重复(已取消的回合又被完成);
 *   · 时间倒流   → 按时间排序的回放把状态拧乱;
 *   · 合成结束缺原因 → 无法与正常结束区分,"连接断了"被伪装成"正常完成";
 *   · 跳过 committing 直接完成 → 落库/产物/结算被整段跳过。
 */
import { describe, expect, it } from 'vitest';

import {
  applyTurnTransition,
  createTurnRecord,
  isTerminalPhase,
  isWakeable,
  needsAttention,
  type TurnRecord,
} from '../src/acp/turn-lifecycle.js';

const T0 = 1_700_000_000_000;

function fresh(): TurnRecord {
  return createTurnRecord({ id: 'turn-1', sessionId: 'sess-1', ordinal: 1, at: T0 });
}

/** 把回合推进到指定阶段(测试用,走合法路径)。 */
function at(phase: 'prepare' | 'consuming' | 'committing' | 'parked'): TurnRecord {
  let r = fresh();
  if (phase === 'prepare') return r;
  r = must(applyTurnTransition(r, { type: 'begin-consuming', at: T0 + 1 }));
  if (phase === 'consuming') return r;
  if (phase === 'parked') {
    return must(
      applyTurnTransition(r, {
        type: 'park',
        at: T0 + 2,
        wake: { reason: 'awaiting-user' },
      }),
    );
  }
  return must(applyTurnTransition(r, { type: 'begin-committing', at: T0 + 2 }));
}

function must(res: ReturnType<typeof applyTurnTransition>): TurnRecord {
  if (!res.ok) throw new Error(`expected ok, got ${res.code}: ${res.message}`);
  return res.next;
}

describe('回合状态机:合法路径', () => {
  it('prepare → consuming → committing → completed', () => {
    let r = fresh();
    expect(r.phase).toBe('prepare');
    r = must(applyTurnTransition(r, { type: 'begin-consuming', at: T0 + 1 }));
    expect(r.phase).toBe('consuming');
    r = must(applyTurnTransition(r, { type: 'begin-committing', at: T0 + 2 }));
    expect(r.phase).toBe('committing');
    r = must(applyTurnTransition(r, { type: 'complete', at: T0 + 3 }));
    expect(r.phase).toBe('completed');
    expect(r.endReason).toEqual({ kind: 'normal' });
  });

  it('挂起再唤醒会累加 reentries 并消费掉 wake 条件', () => {
    const parked = at('parked');
    expect(parked.phase).toBe('parked');
    expect(parked.wake?.reason).toBe('awaiting-user');

    const woken = must(applyTurnTransition(parked, { type: 'wake', at: T0 + 10 }));
    expect(woken.phase).toBe('consuming');
    expect(woken.reentries).toBe(1);
    // wake 已被消费:留着会让"还能再唤醒一次"变成歧义
    expect(woken.wake).toBeUndefined();
  });

  it('prepare 也可直接挂起(还没开始消费就等条件)', () => {
    const r = must(
      applyTurnTransition(fresh(), {
        type: 'park',
        at: T0 + 1,
        wake: { reason: 'awaiting-approval' },
      }),
    );
    expect(r.phase).toBe('parked');
  });

  it('cancel 与 fail 可从任意非终态进入', () => {
    for (const from of ['prepare', 'consuming', 'committing', 'parked'] as const) {
      const r = at(from);
      const cancelled = must(applyTurnTransition(r, { type: 'cancel', at: T0 + 100 }));
      expect(cancelled.phase).toBe('cancelled');

      const failed = must(
        applyTurnTransition(r, { type: 'fail', at: T0 + 100, reason: { kind: 'error', detail: 'x' } }),
      );
      expect(failed.phase).toBe('failed');
    }
  });
});

describe('回合状态机:必须拒绝的迁移', () => {
  it('终态不接受任何迁移(防结算重复)', () => {
    const done = must(applyTurnTransition(at('committing'), { type: 'complete', at: T0 + 3 }));
    expect(isTerminalPhase(done.phase)).toBe(true);

    for (const transition of [
      { type: 'begin-consuming', at: T0 + 10 },
      { type: 'begin-committing', at: T0 + 10 },
      { type: 'complete', at: T0 + 10 },
      { type: 'park', at: T0 + 10, wake: { reason: 'awaiting-user' } },
      { type: 'wake', at: T0 + 10 },
      { type: 'fail', at: T0 + 10, reason: { kind: 'error', detail: 'x' } },
      { type: 'cancel', at: T0 + 10 },
      { type: 'synthetic-finish', at: T0 + 10, detail: 'x' },
    ] as const) {
      const res = applyTurnTransition(done, transition);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('terminal');
    }
  });

  it('时间倒流被拒(防回放把状态拧乱)', () => {
    const r = at('consuming');
    const res = applyTurnTransition(r, { type: 'begin-committing', at: T0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('time-travel');
  });

  it('不能跳过 committing 直接完成(防跳过落库/产物/结算)', () => {
    const res = applyTurnTransition(at('consuming'), { type: 'complete', at: T0 + 5 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('illegal-phase');
  });

  it('不能从 prepare 直接进入 committing', () => {
    const res = applyTurnTransition(fresh(), { type: 'begin-committing', at: T0 + 5 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('illegal-phase');
  });

  it('非 parked 不能被唤醒', () => {
    for (const from of ['prepare', 'consuming', 'committing'] as const) {
      const res = applyTurnTransition(at(from), { type: 'wake', at: T0 + 5 });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('illegal-phase');
    }
  });

  it('已挂起不能再挂起(防覆盖已有唤醒条件)', () => {
    const res = applyTurnTransition(at('parked'), {
      type: 'park',
      at: T0 + 5,
      wake: { reason: 'awaiting-timer', notBefore: T0 + 999 },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('illegal-phase');
  });
});

describe('合成结束(synthetic finish)', () => {
  it('必须带原因:空白 detail 被拒', () => {
    for (const detail of ['', '   ', '\n\t']) {
      const res = applyTurnTransition(at('consuming'), {
        type: 'synthetic-finish',
        at: T0 + 5,
        detail,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('missing-synthetic-reason');
    }
  });

  it('带原因时收成 completed,并与 normal 可区分', () => {
    const res = must(
      applyTurnTransition(at('consuming'), {
        type: 'synthetic-finish',
        at: T0 + 5,
        detail: 'stream closed without done frame',
      }),
    );
    expect(res.phase).toBe('completed');
    expect(res.endReason?.kind).toBe('synthetic');
    expect(res.endReason && 'detail' in res.endReason ? res.endReason.detail : '').toBe(
      'stream closed without done frame',
    );
  });
});

describe('可唤醒判定与告警', () => {
  it('到点才可唤醒;纯事件式不算可自动唤醒', () => {
    const timer = must(
      applyTurnTransition(fresh(), {
        type: 'park',
        at: T0 + 1,
        wake: { reason: 'awaiting-timer', notBefore: T0 + 1000 },
      }),
    );
    expect(isWakeable(timer, T0 + 999)).toBe(false);
    expect(isWakeable(timer, T0 + 1000)).toBe(true);

    const eventOnly = must(
      applyTurnTransition(fresh(), {
        type: 'park',
        at: T0 + 1,
        wake: { reason: 'awaiting-user' },
      }),
    );
    // 没有 notBefore ⇒ 不存在"自动可唤醒"的时刻,只能被显式 wake
    expect(isWakeable(eventOnly, T0 + 999_999)).toBe(false);
  });

  it('非 parked 一律不可唤醒', () => {
    expect(isWakeable(fresh(), T0 + 999_999)).toBe(false);
  });

  it('挂起超时与重入过多都会触发告警', () => {
    const parked = at('parked');
    expect(needsAttention(parked, T0 + 1000, { staleMs: 60_000 }).needed).toBe(false);
    const stale = needsAttention(parked, T0 + 120_000, { staleMs: 60_000 });
    expect(stale.needed).toBe(true);
    expect(stale.reason).toContain('未唤醒');

    const reentered = { ...parked, reentries: 5 };
    const res = needsAttention(reentered, T0 + 1000, { maxReentries: 3 });
    expect(res.needed).toBe(true);
    expect(res.reason).toContain('重入');
  });

  it('正常推进的回合不告警', () => {
    expect(needsAttention(at('consuming'), T0 + 999_999).needed).toBe(false);
  });
});
