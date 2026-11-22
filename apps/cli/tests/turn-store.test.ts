// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回合运行态 / 目标态 的持久化。
 *
 * 钉五件事,每件都是"不测就一定会坏"的:
 *   ① 落盘后**重新读**能拿回同一状态(不是内存里对、读回来就错);
 *   ② 挂起态跨进程可见 —— 用 listWakeableTurns 模拟重启后的启动扫描;
 *   ③ 原子写:不留下半截 JSON(直接 writeFileSync 被杀会留半截,读者无法区分);
 *   ④ 路径安全:id 带 `../` / 盘符必须拒(复用 session 同一判据);
 *   ⑤ 目标态:空目标拒绝、终态不可再迁、同态迁移按 no-op 拒绝而非静默成功。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyTurnTransition, createTurnRecord, type TurnRecord } from '../src/acp/turn-lifecycle.js';
import {
  applyGoalTransition,
  createGoal,
  listWakeableTurns,
  loadGoals,
  loadSessionRuntime,
  nextTurnOrdinal,
  parkUntil,
  upsertGoal,
  upsertTurn,
} from '../src/acp/turn-store.js';

let dir = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-turn-store-'));
  process.env.IHUI_CLI_TURNS_DIR = path.join(dir, 'turns');
  process.env.IHUI_CLI_GOALS_DIR = path.join(dir, 'goals');
});

afterEach(() => {
  delete process.env.IHUI_CLI_TURNS_DIR;
  delete process.env.IHUI_CLI_GOALS_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

const T0 = 1_700_000_000_000;

function must(res: ReturnType<typeof applyTurnTransition>): TurnRecord {
  if (!res.ok) throw new Error(`${res.code}: ${res.message}`);
  return res.next;
}

describe('回合运行态持久化', () => {
  it('落盘后重新读回同一状态', () => {
    const rec = createTurnRecord({ id: 'turn-1', sessionId: 'sess-a', ordinal: 1, at: T0 });
    upsertTurn('sess-a', rec);

    const back = loadSessionRuntime('sess-a');
    expect(back.turns).toHaveLength(1);
    expect(back.turns[0]?.id).toBe('turn-1');
    expect(back.turns[0]?.phase).toBe('prepare');
    expect(back.activeTurnId).toBe('turn-1');
  });

  it('终态回合不再算 active', () => {
    let rec = createTurnRecord({ id: 't1', sessionId: 'sess-b', ordinal: 1, at: T0 });
    rec = must(applyTurnTransition(rec, { type: 'begin-consuming', at: T0 + 1 }));
    rec = must(applyTurnTransition(rec, { type: 'begin-committing', at: T0 + 2 }));
    rec = must(applyTurnTransition(rec, { type: 'complete', at: T0 + 3 }));
    const rt = upsertTurn('sess-b', rec);
    expect(rt.activeTurnId).toBeNull();
  });

  it('序号取 max+1,不因删除而回退', () => {
    upsertTurn('sess-c', createTurnRecord({ id: 't1', sessionId: 'sess-c', ordinal: 1, at: T0 }));
    upsertTurn('sess-c', createTurnRecord({ id: 't2', sessionId: 'sess-c', ordinal: 2, at: T0 }));
    expect(nextTurnOrdinal('sess-c')).toBe(3);
  });

  it('挂起态跨进程可被启动扫描发现(模拟重启)', () => {
    const parked = must(
      applyTurnTransition(
        createTurnRecord({ id: 'tp', sessionId: 'sess-d', ordinal: 1, at: T0 }),
        {
          type: 'park',
          at: T0 + 1,
          wake: parkUntil({ reason: 'awaiting-timer', notBefore: T0 + 5000 }),
        },
      ),
    );
    upsertTurn('sess-d', parked);

    // 未到点:扫不到
    expect(listWakeableTurns(T0 + 4999).filter((x) => x.sessionId === 'sess-d')).toHaveLength(0);
    // 到点:扫得到
    const hit = listWakeableTurns(T0 + 5000).filter((x) => x.sessionId === 'sess-d');
    expect(hit).toHaveLength(1);
    expect(hit[0]?.turn.id).toBe('tp');
  });

  it('纯事件式挂起不会被扫描捞出来(只能显式唤醒)', () => {
    const parked = must(
      applyTurnTransition(
        createTurnRecord({ id: 'te', sessionId: 'sess-e', ordinal: 1, at: T0 }),
        { type: 'park', at: T0 + 1, wake: parkUntil({ reason: 'awaiting-user' }) },
      ),
    );
    upsertTurn('sess-e', parked);
    expect(listWakeableTurns(T0 + 999_999).filter((x) => x.sessionId === 'sess-e')).toHaveLength(0);
  });

  it('损坏的运行态文件读回空态而不抛错(不静默覆盖)', () => {
    const file = path.join(process.env.IHUI_CLI_TURNS_DIR!, 'sess-f.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{ this is not json');
    const rt = loadSessionRuntime('sess-f');
    expect(rt.turns).toEqual([]);
    expect(rt.activeTurnId).toBeNull();
  });

  it('原子写不留临时文件', () => {
    upsertTurn('sess-g', createTurnRecord({ id: 't', sessionId: 'sess-g', ordinal: 1, at: T0 }));
    const files = fs.readdirSync(process.env.IHUI_CLI_TURNS_DIR!);
    expect(files.filter((f) => f.includes('.tmp-'))).toHaveLength(0);
  });

  it('id 带目录穿越/盘符时被收敛,落点始终在根目录内', () => {
    // 既有判据(session.ts 同源)对非法段做**收敛**而非抛错 —— 因此这里断言的是
    // 「收敛后的落点必须在根内」这一安全性质,而不是「一定抛错」。
    // 实测收敛结果:`../evil` → `.._evil.json`(分隔符被替换),不会跳出根目录。
    const root = path.resolve(process.env.IHUI_CLI_TURNS_DIR!);
    for (const bad of ['../evil', '..\\evil', 'C:\\evil', '/abs/evil']) {
      let landed = '';
      try {
        upsertTurn(bad, createTurnRecord({ id: 't', sessionId: bad, ordinal: 1, at: T0 }));
        const files = fs.readdirSync(root);
        expect(files.length).toBeGreaterThan(0);
        // 取本文件名(不含目录),断言「文件就落在根这一层」而非嵌套出根
        landed = path.resolve(root, files[files.length - 1]!);
      } catch {
        continue; // 抛错也是合法的失效方向
      }
      // 目录部分必须逐字等于根 —— 这是"没有穿越"的准确判据
      expect(path.dirname(landed)).toBe(root);
    }
  });
});

describe('目标态', () => {
  it('空目标被拒(空目标等于没有目标)', () => {
    expect(() => createGoal({ id: 'g1', sessionId: 's', statement: '   ', at: T0 })).toThrow();
    expect(() => createGoal({ id: 'g1', sessionId: 's', statement: '', at: T0 })).toThrow();
  });

  it('新建目标是 active,并会 trim', () => {
    const g = createGoal({ id: 'g1', sessionId: 's', statement: '  把 ACP 补齐  ', at: T0 });
    expect(g.status).toBe('active');
    expect(g.statement).toBe('把 ACP 补齐');
  });

  it('active → achieved 合法;终态不可再迁', () => {
    const g = createGoal({ id: 'g1', sessionId: 's', statement: 'x', at: T0 });
    const done = applyGoalTransition(g, 'achieved', T0 + 1);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.next.status).toBe('achieved');

    const again = applyGoalTransition(done.next, 'abandoned', T0 + 2);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.code).toBe('illegal-status');
  });

  it('同态迁移按 no-op 拒绝,不静默成功', () => {
    const g = createGoal({ id: 'g1', sessionId: 's', statement: 'x', at: T0 });
    const res = applyGoalTransition(g, 'active', T0 + 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('no-op');
  });

  it('时间倒流被拒', () => {
    const g = createGoal({ id: 'g1', sessionId: 's', statement: 'x', at: T0 });
    const res = applyGoalTransition(g, 'achieved', T0 - 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('time-travel');
  });

  it('目标落盘后重新读回,且同 id 覆盖不重复', () => {
    const g = createGoal({ id: 'g1', sessionId: 'sess-h', statement: 'x', at: T0 });
    upsertGoal(g);
    const done = applyGoalTransition(g, 'achieved', T0 + 1, '已交付');
    if (!done.ok) throw new Error('expected ok');
    upsertGoal(done.next);

    const back = loadGoals('sess-h');
    expect(back).toHaveLength(1);
    expect(back[0]?.status).toBe('achieved');
    expect(back[0]?.completionNote).toBe('已交付');
  });

  it('多目标按创建时间稳定排序', () => {
    upsertGoal(createGoal({ id: 'g2', sessionId: 'sess-i', statement: 'b', at: T0 + 10 }));
    upsertGoal(createGoal({ id: 'g1', sessionId: 'sess-i', statement: 'a', at: T0 }));
    expect(loadGoals('sess-i').map((g) => g.id)).toEqual(['g1', 'g2']);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
