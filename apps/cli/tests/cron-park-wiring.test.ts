// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * cron 周期挂起的**接线**验证。
 *
 * `cron.test.ts` 只测「算得对不对」。本文件测「它有没有真的接进挂起唤醒」——
 * 把 `WakeCondition.cron` 删掉或让 `isWakeable` 忽略它，这里的用例必须变红。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyTurnTransition, createTurnRecord, isWakeable } from '../src/acp/turn-lifecycle.js';
import { listWakeableTurns, parkUntil, upsertTurn } from '../src/acp/turn-store.js';

let dir = '';
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cron-park-'));
  for (const k of ['IHUI_CLI_SESSIONS_DIR', 'IHUI_CLI_TURNS_DIR', 'IHUI_CLI_GOALS_DIR']) {
    saved[k] = process.env[k];
  }
  process.env.IHUI_CLI_SESSIONS_DIR = path.join(dir, 'sessions');
  process.env.IHUI_CLI_TURNS_DIR = path.join(dir, 'turns');
  process.env.IHUI_CLI_GOALS_DIR = path.join(dir, 'goals');
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

const d = (y: number, mo: number, day: number, h = 0, mi = 0) =>
  new Date(y, mo - 1, day, h, mi, 0, 0).getTime();

describe('cron 挂起的唤醒判定', () => {
  it('每 30 分钟挂起:未到点不可醒,到点可醒', () => {
    const parked = applyTurnTransition(
      createTurnRecord({ id: 't', sessionId: 's', ordinal: 1, at: d(2026, 11, 12, 10, 5) }),
      {
        type: 'park',
        at: d(2026, 11, 12, 10, 5),
        wake: parkUntil({ reason: 'awaiting-timer', cron: '*/30 * * * *' }),
      },
    );
    expect(parked.ok).toBe(true);
    if (!parked.ok) return;

    // 10:05 挂起 ⇒ 下一次 10:30
    expect(isWakeable(parked.next, d(2026, 11, 12, 10, 20))).toBe(false);
    expect(isWakeable(parked.next, d(2026, 11, 12, 10, 30))).toBe(true);
  });

  it('非法 cron 在**构造时**就报错(不落一个永远醒不来的挂起)', () => {
    expect(() => parkUntil({ reason: 'awaiting-timer', cron: 'not a cron' })).toThrow();
  })

  it('cron 与 notBefore 同给时以 cron 为准', () => {
    const parked = applyTurnTransition(
      createTurnRecord({ id: 't2', sessionId: 's', ordinal: 1, at: d(2026, 11, 12, 10, 0) }),
      {
        type: 'park',
        at: d(2026, 11, 12, 10, 0),
        wake: parkUntil({
          reason: 'awaiting-timer',
          // notBefore 设成很久以后,但 cron 是每分钟 ⇒ 应按 cron 判
          notBefore: d(2030, 1, 1),
          cron: '* * * * *',
        }),
      },
    );
    if (!parked.ok) throw new Error('park failed');
    // 下一分钟就该可醒(cron 优先)
    expect(isWakeable(parked.next, d(2026, 11, 12, 10, 1))).toBe(true);
  })

  it('listWakeableTurns 能捞出 cron 到点的回合', () => {
    const parked = applyTurnTransition(
      createTurnRecord({ id: 't3', sessionId: 'sess-cron', ordinal: 1, at: d(2026, 11, 12, 9, 0) }),
      {
        type: 'park',
        at: d(2026, 11, 12, 9, 0),
        wake: parkUntil({ reason: 'awaiting-timer', cron: '0 * * * *' }),
      },
    );
    if (!parked.ok) throw new Error('park failed');
    upsertTurn('sess-cron', parked.next);

    // 09:30 未到点
    expect(listWakeableTurns(d(2026, 11, 12, 9, 30)).filter((x) => x.sessionId === 'sess-cron')).toHaveLength(0);
    // 10:00 到点
    expect(listWakeableTurns(d(2026, 11, 12, 10, 0)).filter((x) => x.sessionId === 'sess-cron')).toHaveLength(1);
  })

  it('非法 cron 落库后不可唤醒(失效方向=不醒,不误醒)', () => {
    // 绕过 parkUntil 校验,直接构造带坏 cron 的记录
    const rec = {
      ...createTurnRecord({ id: 't4', sessionId: 's', ordinal: 1, at: d(2026, 11, 12, 10, 0) }),
      phase: 'parked' as const,
      wake: { reason: 'awaiting-timer' as const, cron: 'garbage' },
    };
    expect(isWakeable(rec, d(2026, 11, 12, 23, 59))).toBe(false);
  })
})
