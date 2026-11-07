// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话断点续跑日志(run-journal)单测。
 *
 * 全部落盘用例走 os.tmpdir + mkdtemp 的独立 scratch 目录(结束即删),
 * 不写仓库目录、不碰 ~/.ihui;时间戳用固定常量钉死,断言值不依赖真实时钟。
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  beginTurn,
  completeTurn,
  computeToolFingerprint,
  createRunJournal,
  deleteRunJournal,
  findSettledCall,
  findUnknownCall,
  loadRunJournal,
  markJournalCompleted,
  planResume,
  recordPlanned,
  recordSettled,
  recordStarted,
  recoverInterruptedJournal,
  runJournalPath,
  saveRunJournal,
  type RunJournal,
} from '../src/sessions/run-journal.js';

const SESSION_ID = 'session-run-journal';
const T0 = '2026-11-07T00:00:00.000Z';
const T1 = '2026-11-07T00:01:00.000Z';
const T2 = '2026-11-07T00:02:00.000Z';

let baseDir = '';

beforeEach(() => {
  baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-run-journal-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  if (baseDir !== '') {
    fs.rmSync(baseDir, { recursive: true, force: true });
    baseDir = '';
  }
});

function newJournal(): RunJournal {
  return createRunJournal(SESSION_ID, 'G:\\IHUI-AI\\demo-workspace');
}

describe('run-journal 持久化', () => {
  it('落盘后原样读回,文件名是 <sessionId>.run-journal.json', () => {
    const journal = newJournal();
    beginTurn(journal, 1, T0);
    const planned = recordPlanned(
      journal,
      1,
      { toolCallId: 'call-1', toolName: 'read', args: { path: 'a.txt' } },
      T0,
    );
    expect(planned.seq).toBe(1);
    recordStarted(journal, 1, planned.seq, T0);
    recordSettled(journal, 1, planned.seq, { ok: true, output: 'hello' }, T1);
    completeTurn(journal, 1, T1);

    const target = runJournalPath(SESSION_ID, baseDir);
    expect(target).toBe(path.join(baseDir, `${SESSION_ID}.run-journal.json`));
    saveRunJournal(journal, baseDir);
    expect(fs.existsSync(target)).toBe(true);

    const loaded = loadRunJournal(SESSION_ID, baseDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(1);
    expect(loaded?.sessionId).toBe(SESSION_ID);
    expect(loaded?.status).toBe('running');
    expect(loaded?.turns).toHaveLength(1);
    expect(loaded?.turns[0]?.completedAt).toBe(T1);
    const call = loaded?.turns[0]?.calls[0];
    expect(call?.seq).toBe(1);
    expect(call?.toolCallId).toBe('call-1');
    expect(call?.toolName).toBe('read');
    expect(call?.status).toBe('settled');
    expect(call?.ok).toBe(true);
    expect(call?.outputExcerpt).toBe('hello');
    expect(call?.startedAt).toBe(T0);
    expect(call?.settledAt).toBe(T1);

    // 原子写:落盘后目录里不能残留临时文件
    const leftovers = fs.readdirSync(baseDir).filter((name) => name.endsWith('.tmp'));
    expect(leftovers).toHaveLength(0);
  });

  it('损坏 JSON 返回 null 且给出可观测警告,不抛错', () => {
    fs.writeFileSync(runJournalPath(SESSION_ID, baseDir), '{ not-json', 'utf-8');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => loadRunJournal(SESSION_ID, baseDir)).not.toThrow();
    expect(loadRunJournal(SESSION_ID, baseDir)).toBeNull();
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toContain('损坏');
  });

  it('delete 幂等:文件不存在也不抛错', () => {
    const journal = newJournal();
    saveRunJournal(journal, baseDir);
    expect(fs.existsSync(runJournalPath(SESSION_ID, baseDir))).toBe(true);

    expect(() => deleteRunJournal(SESSION_ID, baseDir)).not.toThrow();
    expect(fs.existsSync(runJournalPath(SESSION_ID, baseDir))).toBe(false);
    expect(() => deleteRunJournal(SESSION_ID, baseDir)).not.toThrow();
    expect(loadRunJournal(SESSION_ID, baseDir)).toBeNull();
  });
});

describe('computeToolFingerprint', () => {
  it('与对象键序无关,不同参数或不同工具得到不同指纹', () => {
    const a = computeToolFingerprint('read', { path: 'a.txt', offset: 1 });
    const b = computeToolFingerprint('read', { offset: 1, path: 'a.txt' });
    const nestedA = computeToolFingerprint('read', { a: { x: 1, y: 2 }, z: [1, 2] });
    const nestedB = computeToolFingerprint('read', { z: [1, 2], a: { y: 2, x: 1 } });

    expect(a).toBe(b);
    expect(nestedA).toBe(nestedB);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(computeToolFingerprint('read', { path: 'a.txt', offset: 2 })).not.toBe(a);
    expect(computeToolFingerprint('write', { path: 'a.txt', offset: 1 })).not.toBe(a);
  });
});

describe('调用状态机', () => {
  it('planned → started → settled,输出截断到 2000 字符', () => {
    const journal = newJournal();
    const planned = recordPlanned(
      journal,
      1,
      { toolCallId: 'call-bash', toolName: 'bash', args: { cmd: 'ls' } },
      T0,
    );
    expect(planned.status).toBe('planned');
    expect(planned.fingerprint).toBe(computeToolFingerprint('bash', { cmd: 'ls' }));

    recordStarted(journal, 1, planned.seq, T1);
    const started = journal.turns[0]?.calls[0];
    expect(started?.status).toBe('started');
    expect(started?.startedAt).toBe(T1);

    recordSettled(
      journal,
      1,
      planned.seq,
      { ok: false, output: 'x'.repeat(2500), errorType: 'tool_error' },
      T2,
    );
    const settled = journal.turns[0]?.calls[0];
    expect(settled?.status).toBe('settled');
    expect(settled?.ok).toBe(false);
    expect(settled?.errorType).toBe('tool_error');
    expect(settled?.settledAt).toBe(T2);
    expect(settled?.outputExcerpt).toHaveLength(2000);
    expect(settled?.outputExcerpt).toBe('x'.repeat(2000));

    // 短输出原样保留
    const shortCall = recordPlanned(
      journal,
      1,
      { toolCallId: 'call-short', toolName: 'read', args: { path: 'b.txt' } },
      T2,
    );
    recordSettled(journal, 1, shortCall.seq, { ok: true, output: 'ok' }, T2);
    expect(journal.turns[0]?.calls[1]?.outputExcerpt).toBe('ok');
  });

  it('recoverInterruptedJournal:running→interrupted、started→unknown、settled 保留', () => {
    const journal = newJournal();
    const done = recordPlanned(
      journal,
      1,
      { toolCallId: 'c-done', toolName: 'read', args: { path: 'done.txt' } },
      T0,
    );
    recordStarted(journal, 1, done.seq, T0);
    recordSettled(journal, 1, done.seq, { ok: true, output: 'done' }, T0);

    const hanging = recordPlanned(
      journal,
      1,
      { toolCallId: 'c-hang', toolName: 'write', args: { path: 'hang.txt' } },
      T0,
    );
    recordStarted(journal, 1, hanging.seq, T1);

    const notStarted = recordPlanned(
      journal,
      1,
      { toolCallId: 'c-plan', toolName: 'read', args: { path: 'plan.txt' } },
      T1,
    );

    expect(journal.status).toBe('running');
    const recovered = recoverInterruptedJournal(journal);
    expect(recovered.status).toBe('interrupted');
    expect(recovered.turns[0]?.calls[0]?.status).toBe('settled');
    expect(recovered.turns[0]?.calls[0]?.outputExcerpt).toBe('done');
    expect(recovered.turns[0]?.calls[1]?.status).toBe('unknown');
    expect(recovered.turns[0]?.calls[2]?.status).toBe('planned');
    expect(recovered.turns[0]?.calls[1]?.seq).toBe(hanging.seq);
    expect(recovered.turns[0]?.calls[2]?.seq).toBe(notStarted.seq);

    // 幂等:再收敛一次不再改变结果
    expect(recoverInterruptedJournal(recovered).status).toBe('interrupted');
    expect(recovered.turns[0]?.calls[1]?.status).toBe('unknown');

    // 已完成的日志不会被改成 interrupted
    const completedJournal = newJournal();
    markJournalCompleted(completedJournal, T2);
    expect(recoverInterruptedJournal(completedJournal).status).toBe('completed');
  });
});

describe('planResume', () => {
  it('全部已结算且轮次已完成:指向下一轮 seq=0,可自动续跑', () => {
    const journal = newJournal();
    for (const [index, name] of ['read', 'write'].entries()) {
      const call = recordPlanned(
        journal,
        1,
        { toolCallId: `c-${index}`, toolName: name, args: { path: `${name}.txt` } },
        T0,
      );
      recordStarted(journal, 1, call.seq, T0);
      recordSettled(journal, 1, call.seq, { ok: true, output: name }, T0);
    }
    completeTurn(journal, 1, T1);
    markJournalCompleted(journal, T1);

    const plan = planResume(journal);
    expect(plan.journalStatus).toBe('completed');
    expect(plan.resumeFrom).toEqual({ turn: 2, callSeq: 0 });
    expect(plan.canAutoResume).toBe(true);
    expect(plan.completedCount).toBe(2);
    expect(plan.pendingCount).toBe(0);
    expect(plan.unknownCount).toBe(0);
    expect(plan.completed.map((item) => item.seq)).toEqual([1, 2]);
    expect(plan.summaryLines[0]).toBe('从第 2 轮第 0 步续跑');
  });

  it('首个未结算是 planned:从该步续跑,pending 可安全重放', () => {
    const journal = newJournal();
    const first = recordPlanned(
      journal,
      1,
      { toolCallId: 'c-1', toolName: 'read', args: { path: 'a.txt' } },
      T0,
    );
    recordStarted(journal, 1, first.seq, T0);
    recordSettled(journal, 1, first.seq, { ok: true, output: 'a' }, T0);
    recordPlanned(journal, 1, { toolCallId: 'c-2', toolName: 'write', args: { path: 'b.txt' } }, T1);
    recordPlanned(journal, 1, { toolCallId: 'c-3', toolName: 'write', args: { path: 'c.txt' } }, T1);

    const plan = planResume(journal);
    expect(plan.resumeFrom).toEqual({ turn: 1, callSeq: 2 });
    expect(plan.canAutoResume).toBe(true);
    expect(plan.completedCount).toBe(1);
    expect(plan.pendingCount).toBe(2);
    expect(plan.unknownCount).toBe(0);
    expect(plan.pending.map((item) => item.seq)).toEqual([2, 3]);
    expect(plan.summaryLines[0]).toBe('从第 1 轮第 2 步续跑');
    expect(plan.summaryLines.join('\n')).toContain('待重放 2 步');
  });

  it('首个未结算是 unknown:禁止自动重放,summary 出现明确警告', () => {
    const journal = newJournal();
    const first = recordPlanned(
      journal,
      1,
      { toolCallId: 'c-1', toolName: 'read', args: { path: 'a.txt' } },
      T0,
    );
    recordStarted(journal, 1, first.seq, T0);
    recordSettled(journal, 1, first.seq, { ok: true, output: 'a' }, T0);
    const hanging = recordPlanned(
      journal,
      1,
      { toolCallId: 'c-2', toolName: 'write', args: { path: 'b.txt' } },
      T1,
    );
    recordStarted(journal, 1, hanging.seq, T1);

    const plan = planResume(journal);
    expect(plan.resumeFrom).toEqual({ turn: 1, callSeq: 2 });
    expect(plan.canAutoResume).toBe(false);
    expect(plan.unknownCount).toBe(1);
    expect(plan.unknown.map((item) => item.toolName)).toEqual(['write']);
    const summary = plan.summaryLines.join('\n');
    expect(summary).toContain('状态未知');
    expect(summary).toContain('禁止自动重放');

    // 收敛后仍是 unknown,判据不变
    const recovered = recoverInterruptedJournal(journal);
    const recoveredPlan = planResume(recovered);
    expect(recoveredPlan.canAutoResume).toBe(false);
    expect(recoveredPlan.unknownCount).toBe(1);
  });

  it('调用都结算但该轮 completedAt 缺失:视为已完成,从下一轮开始', () => {
    const journal = newJournal();
    const call = recordPlanned(
      journal,
      1,
      { toolCallId: 'c-1', toolName: 'read', args: { path: 'a.txt' } },
      T0,
    );
    recordStarted(journal, 1, call.seq, T0);
    recordSettled(journal, 1, call.seq, { ok: true, output: 'a' }, T0);

    expect(journal.turns[0]?.completedAt).toBeUndefined();
    const plan = planResume(journal);
    expect(plan.resumeFrom).toEqual({ turn: 2, callSeq: 0 });
    expect(plan.canAutoResume).toBe(true);
    expect(plan.completedCount).toBe(1);
  });

  it('没有日志:从第 1 轮第 0 步开始,可自动续跑', () => {
    const plan = planResume(null);
    expect(plan.resumeFrom).toEqual({ turn: 1, callSeq: 0 });
    expect(plan.canAutoResume).toBe(true);
    expect(plan.completedCount).toBe(0);
    expect(plan.pendingCount).toBe(0);
    expect(plan.unknownCount).toBe(0);
    expect(plan.summaryLines[0]).toContain('从第 1 轮第 0 步续跑');
  });
});

describe('findSettledCall / findUnknownCall', () => {
  it('occurrence 按 seq 升序 0-based,只命中第 0/1 次出现', () => {
    const journal = newJournal();
    const readFingerprint = computeToolFingerprint('read', { path: 'same.txt' });
    const writeFingerprint = computeToolFingerprint('write', { path: 'x.txt' });

    // seq 1/2:同指纹的两次 settled;seq 3:同指纹但只 started
    for (const toolCallId of ['r-1', 'r-2']) {
      const call = recordPlanned(
        journal,
        1,
        { toolCallId, toolName: 'read', args: { path: 'same.txt' } },
        T0,
      );
      recordStarted(journal, 1, call.seq, T0);
      recordSettled(journal, 1, call.seq, { ok: true, output: toolCallId }, T0);
    }
    const readHang = recordPlanned(
      journal,
      1,
      { toolCallId: 'r-hang', toolName: 'read', args: { path: 'same.txt' } },
      T1,
    );
    recordStarted(journal, 1, readHang.seq, T1);

    // seq 4/5:同指纹的两次 started;seq 6:同指纹但还只是 planned
    for (const toolCallId of ['w-1', 'w-2']) {
      const call = recordPlanned(
        journal,
        1,
        { toolCallId, toolName: 'write', args: { path: 'x.txt' } },
        T1,
      );
      recordStarted(journal, 1, call.seq, T1);
    }
    recordPlanned(journal, 1, { toolCallId: 'w-plan', toolName: 'write', args: { path: 'x.txt' } }, T1);

    expect(findSettledCall(journal, 1, readFingerprint, 0)?.toolCallId).toBe('r-1');
    expect(findSettledCall(journal, 1, readFingerprint, 1)?.toolCallId).toBe('r-2');
    expect(findSettledCall(journal, 1, readFingerprint, 2)).toBeUndefined();
    // read 的第三次是 started,不算 settled
    expect(findSettledCall(journal, 1, readFingerprint, 0)?.seq).toBe(1);

    expect(findUnknownCall(journal, 1, readFingerprint, 0)?.toolCallId).toBe('r-hang');
    expect(findUnknownCall(journal, 1, readFingerprint, 1)).toBeUndefined();
    expect(findUnknownCall(journal, 1, writeFingerprint, 0)?.toolCallId).toBe('w-1');
    expect(findUnknownCall(journal, 1, writeFingerprint, 1)?.toolCallId).toBe('w-2');
    // planned 不进入 unknown 命中序列
    expect(findUnknownCall(journal, 1, writeFingerprint, 2)).toBeUndefined();
    // 不存在的轮次/指纹
    expect(findSettledCall(journal, 2, readFingerprint, 0)).toBeUndefined();
    expect(findSettledCall(journal, 1, 'deadbeef', 0)).toBeUndefined();
  });
});

describe('sessionId 校验', () => {
  it('空串与含路径分隔符/.. 的 sessionId 直接拒绝', () => {
    for (const sessionId of ['', '..', '../escape', 'a/b', 'a\\b']) {
      expect(() => runJournalPath(sessionId, baseDir)).toThrow();
      expect(() => createRunJournal(sessionId, 'ws')).toThrow();
      expect(() => deleteRunJournal(sessionId, baseDir)).toThrow();
    }
  });
});
