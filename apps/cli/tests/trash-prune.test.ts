// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回收站到期清理 adapter(goal-b49 X1)行为钉。判据一律 import 源(shared 判据层 + 本仓 adapter),不复制算式(§22c)。
 * 夹具落点:`scripts/lib/scratch-dir.mjs` 的 `mkScratch`(§15b/§26 —— 不落 `os.tmpdir()`、不在仓库树内造)。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_TRASH_CLEANUP_MAX_ENTRIES,
  DEFAULT_TRASH_RETENTION_MS,
  findTrashEntry,
  isTrashManifestShape,
  type TrashManifest,
  type TrashManifestEntry,
} from '@ihui/shared/delete-guard';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §15b/§26 唯一落点(禁 os.tmpdir/裸 mkdtemp、不得在仓库树内造 git 夹具=门 208);正解=给"测试支持层"在策略表建档 until 2026-12-28
import { getDeleteTrashDir } from '../src/tools/file-batch-edit.js';
import { getExpiryLedgerPath, pruneExpiredTrash } from '../src/tools/trash-prune.js';

const NOW = '2026-11-05T00:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;
const nowMs = Date.parse(NOW);

interface SeedEntry {
  readonly flat: string;
  readonly content?: string;
  /** 条目自带保留期(不填 ⇒ 走清单/策略默认档) */
  readonly retentionMs?: number;
}

let ws: string;
beforeEach(() => (ws = mkScratch('ihui-trash-prune-')));
afterEach(() => rmScratch(ws));

function ledgerFile(): string {
  return getExpiryLedgerPath(ws);
}

/** 造一份本仓真形态的回收站清单:件在 `<trashId>/<flat>`,清单 `sizeBytes` 恒 null(体积靠 adapter 现量) */
function seedTrash(trashId: string, ageMs: number, entries: readonly SeedEntry[]): void {
  const dir = path.join(getDeleteTrashDir(ws), trashId);
  fs.mkdirSync(dir, { recursive: true });
  const list: TrashManifestEntry[] = entries.map((e) => {
    fs.writeFileSync(path.join(dir, e.flat), e.content ?? 'x'.repeat(16), 'utf-8');
    return {
      originalPath: path.join(ws, 'origin', e.flat),
      relativeTrashPath: e.flat,
      sizeBytes: null,
      kind: 'file',
      ...(e.retentionMs === undefined ? {} : { retentionMs: e.retentionMs }),
    };
  });
  const manifest: TrashManifest = {
    kind: 'ihui.delete-guard.trash-manifest',
    trashId,
    createdAtIso: new Date(nowMs - ageMs).toISOString(),
    workspacePath: ws,
    entries: list,
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
}

/** 让某条回收件的件"丢失"(只剩清单)⇒ 体积量不到 */
function loseEntry(trashId: string, flat: string): void {
  fs.rmSync(path.join(getDeleteTrashDir(ws), trashId, flat));
}

describe('① 空账:no-op 且零噪声', () => {
  it('根不存在 ⇒ gate=empty 且零 fs 写;目录在但无清单同档', () => {
    const r = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(r).toMatchObject({ state: 'clean', gate: 'empty', reclaimedBytes: 0, ledger: null, lines: [] });
    expect(r.removed).toEqual([]);
    expect(r.skipped).toEqual([]);
    expect(r.failed).toEqual([]);
    expect(fs.existsSync(path.join(ws, '.ihui'))).toBe(false); // 零写:连 .ihui 都不建

    fs.mkdirSync(getDeleteTrashDir(ws), { recursive: true });
    const second = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(second.gate).toBe('empty');
    expect(second.scanned).toEqual({ manifests: 0, entries: 0 });
    expect(fs.existsSync(ledgerFile())).toBe(false);
  });
});

describe('② 到期条目真删且清单同步更新', () => {
  it('同清单内到期条目被摘、未到期条目仍在册;整份到期的清单连目录一起摘掉', () => {
    seedTrash('t-mixed', 40 * DAY, [
      { flat: '0-old.txt', retentionMs: DAY },
      { flat: '1-keep.txt', retentionMs: 365 * DAY },
    ]);
    seedTrash('t-all', DEFAULT_TRASH_RETENTION_MS + DAY, [{ flat: '0-all.txt' }]);

    const r = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(r.state).toBe('pruned');
    expect(r.gate).toBe('run');  expect(r.failed).toEqual([]);
    expect(r.removed.map((x) => `${x.trashId}/${x.relativeTrashPath}`).sort()).toEqual([
      't-all/0-all.txt',
      't-mixed/0-old.txt',
    ]);
    expect(r.reclaimedBytes).toBe(32); // 两条 × 16B(现量出来的真实体积)

    const mixedDir = path.join(getDeleteTrashDir(ws), 't-mixed');
    expect(fs.existsSync(path.join(mixedDir, '0-old.txt'))).toBe(false);
    expect(fs.existsSync(path.join(mixedDir, '1-keep.txt'))).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(mixedDir, 'manifest.json'), 'utf-8')) as unknown;
    expect(isTrashManifestShape(manifest)).toBe(true);
    expect((manifest as TrashManifest).entries).toHaveLength(1);
    expect(findTrashEntry(manifest as TrashManifest, path.join(ws, 'origin', '0-old.txt'))).toBeNull();
    expect(fs.existsSync(path.join(getDeleteTrashDir(ws), 't-all'))).toBe(false); // 不留空壳
  });

  it('同一时刻再跑一次 ⇒ gate=backoff(器物自带节流),零动作且账目一字不动', () => {
    seedTrash('t-backoff', 40 * DAY, [
      { flat: '0-old.txt', retentionMs: DAY },
      { flat: '1-keep.txt', retentionMs: 365 * DAY },
    ]);
    expect(pruneExpiredTrash(ws, { nowIso: NOW }).state).toBe('pruned');
    const frozen = fs.readFileSync(ledgerFile(), 'utf-8');
    const second = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(second.gate).toBe('backoff');
    expect(second.state).toBe('clean');
    expect(second.removed).toEqual([]);
    expect(second.ledger).toBeNull();
    expect(fs.readFileSync(ledgerFile(), 'utf-8')).toBe(frozen);
  });
});

describe('③ 量不到体积 / 清单坏 ⇒ 不删并点名(§0.3)', () => {
  it('件丢了(体积量不到)⇒ undetermined,到期条目也不上手', () => {
    seedTrash('t-lost', 40 * DAY, [{ flat: '0-expired.txt', retentionMs: DAY }]);
    loseEntry('t-lost', '0-expired.txt');
    const r = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(r.state).toBe('undetermined');
    expect(r.gate).toBe('run');
    expect(r.removed).toEqual([]);  expect(r.plan?.verdict).toBe('undetermined');
    expect(r.skipped.some((s) => s.reason.includes('量不到体积'))).toBe(true);
  });

  it('一条量不到就冻结整池:另一份清单里可量的到期条目同样不删(fail-closed)', () => {
    seedTrash('t-ok', 40 * DAY, [{ flat: '0-expired.txt', retentionMs: DAY }]);
    seedTrash('t-lost', 40 * DAY, [{ flat: '0-expired.txt', retentionMs: DAY }]);
    loseEntry('t-lost', '0-expired.txt');
    const r = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(r.state).toBe('undetermined');
    expect(r.removed).toEqual([]);
    expect(fs.existsSync(path.join(getDeleteTrashDir(ws), 't-ok', '0-expired.txt'))).toBe(true);
  });

  it('清单形态坏 ⇒ 逐条点名,不硬试也不当成空账', () => {
    fs.mkdirSync(path.join(getDeleteTrashDir(ws), 't-bad'), { recursive: true });
    fs.writeFileSync(path.join(getDeleteTrashDir(ws), 't-bad', 'manifest.json'), '{ not json', 'utf-8');
    const r = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(r.state).toBe('undetermined');  expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0]?.reason).toContain('清单形态不合法');
    expect(fs.existsSync(path.join(getDeleteTrashDir(ws), 't-bad', 'manifest.json'))).toBe(true);
  });
});

describe('④ 超上限只报数不硬删', () => {
  it('条目数上限:20 条全到期 ⇒ 只摘上限条数,余下进 overBudget 且仍在盘上', () => {
    const entries = Array.from({ length: DEFAULT_TRASH_CLEANUP_MAX_ENTRIES + 5 }, (_, i) => ({
      flat: `${i}-old.txt`,
      retentionMs: DAY,
    }));
    seedTrash('t-many', 40 * DAY, entries);
    const r = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(r.state).toBe('pruned');
    expect(r.removed).toHaveLength(DEFAULT_TRASH_CLEANUP_MAX_ENTRIES);
    expect(r.plan?.entryCap).toBe(DEFAULT_TRASH_CLEANUP_MAX_ENTRIES);
    expect(r.overBudget.entries).toBe(5);
    const left = fs.readdirSync(path.join(getDeleteTrashDir(ws), 't-many')).filter((f) => f !== 'manifest.json');
    expect(left).toHaveLength(5);
  });

  it('字节上限:8B×3 条 ∧ maxBytes=10 ⇒ 只放行 1 条,另 2 条只报数', () => {
    const e = (i: number): SeedEntry => ({ flat: `${i}.txt`, content: 'x'.repeat(8), retentionMs: DAY });
    seedTrash('t-bytes', 40 * DAY, [e(0), e(1), e(2)]);
    const r = pruneExpiredTrash(ws, { nowIso: NOW, maxBytes: 10 });
    expect(r.removed).toHaveLength(1);
    expect(r.overBudget.entries).toBe(2);
    expect(r.reclaimedBytes).toBe(8);
  });
});

describe('⑤ 连败封票后不再重试(死亡机制装车证明)', () => {
  function seedUnjudgeable(): void {
    seedTrash('t-lost', 40 * DAY, [{ flat: '0-expired.txt', retentionMs: DAY }]);
    loseEntry('t-lost', '0-expired.txt');
  }

  it('连败 7 ⇒ 第 8 次落 retired;此后 gate=retired 零动作、账目一字不动(不自愈)', () => {
    seedUnjudgeable();
    fs.mkdirSync(path.dirname(ledgerFile()), { recursive: true });
    const sevenStrikes = { streak: 7, lastRunIso: null, quarantinedUntilIso: null, retiredAtIso: null };
    fs.writeFileSync(ledgerFile(), JSON.stringify(sevenStrikes), 'utf-8');
    const eighth = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(eighth.state).toBe('undetermined');
    expect(eighth.ledger?.retiredAtIso).toBe(NOW);
    expect(eighth.ledger?.streak).toBe(8);
    const frozen = fs.readFileSync(ledgerFile(), 'utf-8');
    const after = pruneExpiredTrash(ws, { nowIso: '2026-12-05T00:00:00.000Z' });
    expect(after.gate).toBe('retired');
    expect(after.state).toBe('clean');  expect(after.removed).toEqual([]);
    expect(after.ledger).toBeNull();
    expect(fs.readFileSync(ledgerFile(), 'utf-8')).toBe(frozen);
  });

  it('首次失败即封票 24h:窗内再跑 gate=quarantined,一件不删', () => {
    seedUnjudgeable();
    const first = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(first.ledger?.streak).toBe(1);
    expect(first.ledger?.quarantinedUntilIso).toBe(new Date(nowMs + DAY).toISOString());
    const frozen = fs.readFileSync(ledgerFile(), 'utf-8');
    const inside = pruneExpiredTrash(ws, { nowIso: new Date(nowMs + 60 * 60 * 1000).toISOString() });
    expect(inside.gate).toBe('quarantined');
    expect(inside.removed).toEqual([]);
    expect(fs.readFileSync(ledgerFile(), 'utf-8')).toBe(frozen);
  });
});

describe('⑥ 结论可被上层直读(不反解 summary)', () => {
  it('字段面齐备:state/gate/scanned/removed/overBudget/plan/ledger 全是结构化值', () => {
    seedTrash('t-read', 40 * DAY, [
      { flat: '0-old.txt', retentionMs: DAY },
      { flat: '1-keep.txt', retentionMs: 365 * DAY },
    ]);
    const r = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(r).toMatchObject({
      state: 'pruned',
      gate: 'run',
      scanned: { manifests: 1, entries: 2 },
      overBudget: { entries: 0, bytes: 0 },
    });
    expect(Array.isArray(r.removed)).toBe(true);
    expect(r.removed[0]).toMatchObject({ trashId: 't-read', relativeTrashPath: '0-old.txt', bytes: 16 });
    expect(typeof r.reclaimedBytes).toBe('number');
    expect(r.plan?.verdict).toBe('clean');  expect(r.plan?.notExpired).toHaveLength(1);
    expect(r.ledger).toMatchObject({ streak: 0, retiredAtIso: null, quarantinedUntilIso: null });
    expect(typeof r.ledger?.lastRunIso).toBe('string');
    // summary/lines 只做日志面:存在即够,结论不从字符串里取
    expect(r.summary).toContain('state=pruned');
    expect(r.lines.some((l) => l.startsWith('TRASH-EXPIRY'))).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
