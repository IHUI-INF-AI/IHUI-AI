// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 回合编年史(chronicle)。
 *
 * 钉三件事:
 *   ① 时间线**稳定可复现**(同刻按 ordinal 排)—— 不稳定就无法跨次比对;
 *   ② **不伪造未记录的事件**(观测层不知道的中间阶段不许编进历史);
 *   ③ 摘要统计中 `syntheticEnded` 单独可见 —— 这个数高说明上游结束信号不可靠。
 */
import { describe, expect, it } from 'vitest';

import { buildChronicle, summarizeChronicle } from '../src/acp/chronicle.js';
import { createTurnRecord, type TurnRecord } from '../src/acp/turn-lifecycle.js';

const T0 = 1_700_000_000_000;

function rec(over: Partial<TurnRecord> & { id: string; ordinal: number }): TurnRecord {
  return { ...createTurnRecord({ id: over.id, sessionId: 's', ordinal: over.ordinal, at: T0 }), ...over };
}

describe('buildChronicle', () => {
  it('每个回合至少产生一个 created 事件', () => {
    const ev = buildChronicle([rec({ id: 'a', ordinal: 1 })]);
    expect(ev.filter((e) => e.kind === 'turn-created')).toHaveLength(1);
  });

  it('终态回合产出 turn-ended,且带结束原因', () => {
    const t = rec({
      id: 'a',
      ordinal: 1,
      phase: 'completed',
      updatedAt: T0 + 100,
      endReason: { kind: 'synthetic', detail: 'stream closed' },
    });
    const ev = buildChronicle([t]);
    const ended = ev.find((e) => e.kind === 'turn-ended');
    expect(ended).toBeDefined();
    expect(ended!.summary).toContain('合成结束');
    expect(ended!.detail?.endKind).toBe('synthetic');
    expect(ended!.detail?.reason).toBe('stream closed');
  });

  it('挂起回合产出 turn-parked,带原因与到点时刻', () => {
    const t = rec({
      id: 'a',
      ordinal: 1,
      phase: 'parked',
      updatedAt: T0 + 50,
      wake: { reason: 'awaiting-timer', notBefore: T0 + 5000 },
    });
    const ev = buildChronicle([t]);
    const parked = ev.find((e) => e.kind === 'turn-parked');
    expect(parked!.summary).toContain('定时');
    expect(parked!.detail?.notBefore).toBe(T0 + 5000);
  });

  it('运行中回合产出 turn-active', () => {
    const t = rec({ id: 'a', ordinal: 1, phase: 'consuming', updatedAt: T0 + 10 });
    const ev = buildChronicle([t]);
    expect(ev.find((e) => e.kind === 'turn-active')!.detail?.phase).toBe('consuming');
  });

  it('**不伪造中间事件**:prepare 直接到 completed 只出两个点', () => {
    const t = rec({ id: 'a', ordinal: 1, phase: 'completed', updatedAt: T0 + 10, endReason: { kind: 'normal' } });
    const ev = buildChronicle([t]);
    // 没有 consuming / committing 的伪造事件
    expect(ev.filter((e) => e.kind === 'turn-active')).toHaveLength(0);
    expect(ev).toHaveLength(2);
  });

  it('按时间升序;同刻按 ordinal 升序(稳定可复现)', () => {
    const turns = [
      rec({ id: 'b', ordinal: 2, updatedAt: T0 + 100, phase: 'completed', endReason: { kind: 'normal' } }),
      rec({ id: 'a', ordinal: 1, updatedAt: T0 + 100, phase: 'completed', endReason: { kind: 'normal' } }),
    ];
    const ev = buildChronicle(turns);
    const at100 = ev.filter((e) => e.at === T0 + 100);
    expect(at100.map((e) => e.ordinal)).toEqual([1, 2]);
    // 两次调用结果完全一致
    expect(JSON.stringify(buildChronicle(turns))).toBe(JSON.stringify(ev));
  });

  it('空输入返回空数组(不是抛错)', () => {
    expect(buildChronicle([])).toEqual([]);
  });
});

describe('summarizeChronicle', () => {
  it('统计各阶段、挂起、活跃、重入、合成结束', () => {
    const turns = [
      rec({ id: 'a', ordinal: 1, phase: 'completed', endReason: { kind: 'normal' } }),
      rec({ id: 'b', ordinal: 2, phase: 'completed', endReason: { kind: 'synthetic', detail: 'x' } }),
      rec({ id: 'c', ordinal: 3, phase: 'parked', wake: { reason: 'awaiting-user' }, reentries: 2 }),
      rec({ id: 'd', ordinal: 4, phase: 'consuming' }),
    ];
    const st = summarizeChronicle(turns);
    expect(st.totalTurns).toBe(4);
    expect(st.parked).toBe(1);
    expect(st.active).toBe(1);
    expect(st.reentered).toBe(1);
    expect(st.syntheticEnded).toBe(1); // 关键：合成结束单独可见
    expect(st.byPhase.completed).toBe(2);
  });

  it('空输入全零', () => {
    const st = summarizeChronicle([]);
    expect(st.totalTurns).toBe(0);
    expect(st.syntheticEnded).toBe(0);
  });
});
