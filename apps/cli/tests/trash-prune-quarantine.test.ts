// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal-b49 Z7(收 X1 未竟 1):回收站**冻结容错**行为钉。
 * 判据一律 import 源(shared 判据层 + 本仓 adapter),本件零复算(§22c)。
 * 夹具落点:`scripts/lib/scratch-dir.mjs` 的 `mkScratch`(§15b/§26);本仓 `.ihui/delete-trash` 现读 0 枚 ⇒
 * 用例绝不碰真实工作树。
 *
 * 射程五格:
 *  ① 隔离轮次**照常写连败账本**(不写账目的封票等于没有封票);
 *  ② 复位出口:定向说明不足 ⇒ 一个字不写;达标 ⇒ streak 归零 + 清 retiredAtIso + 前后账目落留痕;
 *  ③ 复位后下一轮真跑(死胡同被打通,但只能由"多要一次说明"打开,不是自动复活);
 *  ④ 摘壳收窄:清单剔空而目录里还有未登记内容 ⇒ 不摘壳、只写索引并具名(不新增删除面);
 *  ⑤ 空壳目录(在册条目 0)= 空账:零写零账目,不冒充判过也不累加连败。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TrashManifest } from '@ihui/shared/delete-guard';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §15b/§26 唯一落点(禁 os.tmpdir/裸 mkdtemp、不得在仓库树内造 git 夹具=门 208);正解=给"测试支持层"在策略表建档 until 2026-12-28
import { getDeleteTrashDir } from '../src/tools/file-batch-edit.js';
import { getExpiryLedgerPath, pruneExpiredTrash, resetTrashExpiryRun } from '../src/tools/trash-prune.js';

const NOW = '2026-11-05T00:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;

let ws: string;
beforeEach(() => (ws = mkScratch('ihui-trash-quarantine-')));
afterEach(() => rmScratch(ws));

function dirOf(trashId: string): string {
  return path.join(getDeleteTrashDir(ws), trashId);
}

function writeManifest(trashId: string, rows: Array<{ flat: string; missing?: boolean; retentionMs?: number }>, ageMs = 40 * DAY): void {
  fs.mkdirSync(dirOf(trashId), { recursive: true });
  const entries = rows.map((r) => {
    if (!r.missing) fs.writeFileSync(path.join(dirOf(trashId), r.flat), 'x'.repeat(16), 'utf-8');
    return {
      originalPath: path.join(ws, 'origin', r.flat),
      relativeTrashPath: r.flat,
      sizeBytes: null,
      kind: 'file',
      ...(r.retentionMs === undefined ? {} : { retentionMs: r.retentionMs }),
    };
  });
  const manifest: TrashManifest = {
    kind: 'ihui.delete-guard.trash-manifest',
    trashId,
    createdAtIso: new Date(Date.parse(NOW) - ageMs).toISOString(),
    workspacePath: ws,
    entries,
  };
  fs.writeFileSync(path.join(dirOf(trashId), 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
}

function readLedger(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(getExpiryLedgerPath(ws), 'utf-8')) as Record<string, unknown>;
}

function seedRetired(): void {
  fs.mkdirSync(path.dirname(getExpiryLedgerPath(ws)), { recursive: true });
  fs.writeFileSync(
    getExpiryLedgerPath(ws),
    JSON.stringify({ streak: 9, lastRunIso: NOW, quarantinedUntilIso: null, retiredAtIso: NOW, retiredReason: '连败 9 次:永久封票' }),
    'utf-8',
  );
}

describe('① 隔离轮次也照常写连败账本', () => {
  it('件丢一行(隔离)+ 到期一行(摘除)⇒ 账本落盘、streak 归零', () => {
    writeManifest('t-mix', [
      { flat: '0-dead.txt', missing: true, retentionMs: DAY },
      { flat: '1-expired.txt', retentionMs: DAY },
    ]);
    const r = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(r.quarantined.map((q) => q.relativeTrashPath)).toEqual(['0-dead.txt']);
    expect(r.removed.map((x) => x.relativeTrashPath)).toEqual(['1-expired.txt']);
    expect(fs.existsSync(getExpiryLedgerPath(ws))).toBe(true);
    expect(readLedger()).toMatchObject({ streak: 0, retiredAtIso: null });
    expect(r.ledger?.streak).toBe(0);
  });
});

describe('②③ 复位出口:先要一次定向说明,再给一条活路', () => {
  it('说明不足 ⇒ 拒绝且账目一字不动(失效方向恒为"多要一次说明")', () => {
    seedRetired();
    const frozen = fs.readFileSync(getExpiryLedgerPath(ws), 'utf-8');
    const refused = resetTrashExpiryRun(ws, '  ', NOW);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.reason).toContain('定向说明不足');
    expect(fs.readFileSync(getExpiryLedgerPath(ws), 'utf-8')).toBe(frozen);
    expect(fs.existsSync(path.join(path.dirname(getExpiryLedgerPath(ws)), 'expiry-run-reset.jsonl'))).toBe(false);
  });

  it('账目取不到 ⇒ 未判定:不猜着写', () => {
    const missing = resetTrashExpiryRun(ws, '已人工确认回收站读取问题修好', NOW);
    expect(missing.ok).toBe(false);
    expect(!missing.ok && missing.reason).toContain('账目读不到');
  });

  it('说明达标 ⇒ streak 归零 + 清 retiredAtIso + 前后账目落留痕;下一轮真跑并真摘到期件', () => {
    seedRetired();
    writeManifest('t-after-reset', [{ flat: '0-expired.txt', retentionMs: DAY }]);
    const why = '已人工确认回收站读取问题修好,放行下一轮';
    const done = resetTrashExpiryRun(ws, why, NOW);
    expect(done.ok).toBe(true);
    expect(!done.ok && done.reason).toBeFalsy();
    expect(readLedger()).toMatchObject({ streak: 0, retiredAtIso: null, quarantinedUntilIso: null });
    const traceFile = path.join(path.dirname(getExpiryLedgerPath(ws)), 'expiry-run-reset.jsonl');
    const trace = JSON.parse(fs.readFileSync(traceFile, 'utf-8').trim()) as Record<string, unknown>;
    expect(trace).toMatchObject({ atIso: NOW, reason: why });
    expect(trace.before).toMatchObject({ streak: 9, retiredAtIso: NOW });
    expect(trace.after).toMatchObject({ streak: 0, retiredAtIso: null });
    const next = pruneExpiredTrash(ws, { nowIso: new Date(Date.parse(NOW) + 60_000).toISOString() });
    expect(next.gate).toBe('run');
    expect(next.removed).toHaveLength(1);
  });
});

describe('④ 摘壳收窄:剔空而目录仍有未登记内容 ⇒ 不摘壳、具名点名', () => {
  it('坏账行被隔离后,那枚没登记的文件一个字节没少', () => {
    writeManifest('t-ghost', [{ flat: '0-dead.txt', missing: true, retentionMs: DAY }]);
    fs.writeFileSync(path.join(dirOf('t-ghost'), 'unlisted.bin'), 'keepme', 'utf-8');
    const r = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(r.ghosts).toEqual(['t-ghost']);
    expect(r.lines.some((l) => l.startsWith('TRASH-PRUNE-GHOST') && l.includes('t-ghost'))).toBe(true);
    expect(fs.existsSync(dirOf('t-ghost'))).toBe(true);
    expect(fs.readFileSync(path.join(dirOf('t-ghost'), 'unlisted.bin'), 'utf-8')).toBe('keepme');
    expect((JSON.parse(fs.readFileSync(path.join(dirOf('t-ghost'), 'manifest.json'), 'utf-8')) as TrashManifest).entries).toEqual([]);
  });
});

describe('⑤ 空壳目录 = 空账(不冒充判过,也不累加连败)', () => {
  it('在册条目 0 ⇒ gate=empty 零写、ledger 不落地', () => {
    writeManifest('t-shell', []);
    const r = pruneExpiredTrash(ws, { nowIso: NOW });
    expect(r).toMatchObject({ state: 'clean', gate: 'empty', ledger: null, quarantined: [], frozen: [] });
    expect(r.scanned).toEqual({ manifests: 1, entries: 0 });
    expect(r.reason).toContain('空壳目录');
    expect(fs.existsSync(getExpiryLedgerPath(ws))).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
