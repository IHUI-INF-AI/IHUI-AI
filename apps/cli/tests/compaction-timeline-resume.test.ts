// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816014 装配测试:resume 必经点(resolveSession)收敛悬挂压缩时间线。
 *
 * 测试穿过真实入口 apps/cli/src/index.ts 的 resolveSession(--continue / --resume
 * 的公共漏斗),账本落在被 USERPROFILE + HOME 双钉的 scratch 目录(同目录=主会话 store),
 * 收敛时刻用假时钟钉死 ⇒ 追加终态的 atMs 断言值写死,不写"有变化"。
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import { resolveSession } from '../src/index.js';
import { getCompactionTimelineLedgerPath } from '../src/compaction-timeline-resume.js';
import { createSession, saveSession } from '../src/commands/session.js';

/** 假时钟钉死值(2024-10-04T00:00:00Z):追加终态的 atMs 断言写死成它。 */
const PINNED_NOW_MS = 1728000000000;

interface LedgerRecord {
  timelineId: string;
  kind: string;
  atMs: number;
}

let scratch: string | null = null;
let prevUserProfile: string | undefined;
let prevHome: string | undefined;

beforeEach(() => {
  scratch = mkScratch('compaction-timeline-resume');
  prevUserProfile = process.env.USERPROFILE;
  prevHome = process.env.HOME;
  // getSessionsDir() 走 os.homedir():Windows 读 USERPROFILE,POSIX 读 HOME —— 只钉前者
  // 在 Linux runner 上等于没隔离,账本会落进 /home/runner/.ihui/sessions 与别的测试文件
  // 共用(--continue 于是取到别人用真实时钟建的会话)。两个都要钉。
  process.env.USERPROFILE = scratch;
  process.env.HOME = scratch;
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_NOW_MS);
});

afterEach(() => {
  vi.useRealTimers();
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (scratch) {
    rmScratch(scratch);
    scratch = null;
  }
});

function writeSessionFixture(): string {
  const session = createSession(path.join(scratch!, 'ws'), 'test-model');
  session.history = [{ role: 'user', content: 'hello before crash' }];
  saveSession(session);
  return session.id;
}

function writeLedger(sessionId: string, records: unknown[]): void {
  fs.writeFileSync(
    getCompactionTimelineLedgerPath(sessionId),
    JSON.stringify(records, null, 2),
    'utf-8',
  );
}

function readLedger(sessionId: string): LedgerRecord[] {
  return JSON.parse(fs.readFileSync(getCompactionTimelineLedgerPath(sessionId), 'utf-8'));
}

/** 夹具:两条悬挂(一条无 boundary、一条带 boundary)+ 一条已终态组,append-only 原始账面。 */
const HANGING_LEDGER: LedgerRecord[] = [
  { timelineId: 'tl_dead_midway', kind: 'started', atMs: 1000 },
  { timelineId: 'tl_dead_midway', kind: 'retrying', atMs: 2000 },
  { timelineId: 'tl_boundary_only', kind: 'started', atMs: 3000 },
  { timelineId: 'tl_boundary_only', kind: 'boundary', atMs: 4000 },
  { timelineId: 'tl_done_before_kill', kind: 'started', atMs: 5000 },
  { timelineId: 'tl_done_before_kill', kind: 'completed', atMs: 6000 },
];

describe('G-816014 resume 必经点收敛悬挂压缩时间线', () => {
  it('--resume:悬挂组收敛(无 boundary→interrupted / 有 boundary→completed),已终态组一条不动', () => {
    const id = writeSessionFixture();
    writeLedger(id, HANGING_LEDGER);

    const resolved = resolveSession({ resume: id });

    expect(resolved.sessionId).toBe(id);
    expect(resolved.history).toEqual([{ role: 'user', content: 'hello before crash' }]);

    // 断言值写死:原 6 条一字不动在前,追加的 2 条终态在后,atMs = 假时钟钉死值。
    expect(readLedger(id)).toEqual([
      { timelineId: 'tl_dead_midway', kind: 'started', atMs: 1000 },
      { timelineId: 'tl_dead_midway', kind: 'retrying', atMs: 2000 },
      { timelineId: 'tl_boundary_only', kind: 'started', atMs: 3000 },
      { timelineId: 'tl_boundary_only', kind: 'boundary', atMs: 4000 },
      { timelineId: 'tl_done_before_kill', kind: 'started', atMs: 5000 },
      { timelineId: 'tl_done_before_kill', kind: 'completed', atMs: 6000 },
      { timelineId: 'tl_dead_midway', kind: 'interrupted', atMs: PINNED_NOW_MS },
      { timelineId: 'tl_boundary_only', kind: 'completed', atMs: PINNED_NOW_MS },
    ]);
  });

  it('--continue:同一漏斗,同收敛语义', () => {
    const id = writeSessionFixture();
    writeLedger(id, HANGING_LEDGER);

    const resolved = resolveSession({ continue: true });

    expect(resolved.sessionId).toBe(id);
    expect(readLedger(id)).toEqual([
      ...HANGING_LEDGER,
      { timelineId: 'tl_dead_midway', kind: 'interrupted', atMs: PINNED_NOW_MS },
      { timelineId: 'tl_boundary_only', kind: 'completed', atMs: PINNED_NOW_MS },
    ]);
  });

  it('无账本的会话 resume = no-op:不代建账本文件', () => {
    const id = writeSessionFixture();

    const resolved = resolveSession({ resume: id });

    expect(resolved.sessionId).toBe(id);
    expect(fs.existsSync(getCompactionTimelineLedgerPath(id))).toBe(false);
  });

  it('账本损坏(条目 kind 越界)⇒ resume 必须响:resolveSession 抛错,不装成功', () => {
    const id = writeSessionFixture();
    writeLedger(id, [{ timelineId: 'tl_x', kind: 'bogus', atMs: 1 }]);

    expect(() => resolveSession({ resume: id })).toThrow(/malformed/);
    // 保守口径:失败时账本原样,未被半写。
    expect(readLedger(id)).toEqual([{ timelineId: 'tl_x', kind: 'bogus', atMs: 1 }]);
  });

  it('账本损坏(非法 JSON)⇒ 同上,异常沿调用点向上冒', () => {
    const id = writeSessionFixture();
    fs.writeFileSync(getCompactionTimelineLedgerPath(id), '{not json', 'utf-8');

    expect(() => resolveSession({ resume: id })).toThrow();
  });

  it('账本损坏(非数组)⇒ 同上', () => {
    const id = writeSessionFixture();
    fs.writeFileSync(getCompactionTimelineLedgerPath(id), '42', 'utf-8');

    expect(() => resolveSession({ resume: id })).toThrow(/not an array/);
  });
});
