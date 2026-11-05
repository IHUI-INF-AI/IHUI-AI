// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 删除保护链测试(goal-b49 W1-①):阈值正反对照 / approve 相缺失零副作用 /
// undetermined 不记绿 / shared 判据层无平台 IO 形状锁 / 回收站搬运+恢复出口。
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_BULK_DELETE_THRESHOLD,
  aggregateGuardVerdict,
  decideLock,
  evaluateBulkDelete,
  evaluateBulkThreshold,
  findTrashEntry,
  flattenTrashName,
  isSafeIdSegment,
  isTrashManifestShape,
  canonicalizeScan,
  type DeleteCandidate,
  type DigestFn,
} from '@ihui/shared/delete-guard';
import {
  createBatchEditTool,
  getDeleteTrashDir,
  restoreTrashEntry,
  stashDirToTrash,
} from '../src/tools/file-batch-edit.js';
import { createDeleteFileTool } from '../src/tools/file-edit.js';
import type { EditToolContext } from '../src/tools/file-edit.js';

const HEX: DigestFn = (s) => `fake$${s.length}$${s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 9973}`;
const NOW = '2026-11-05T00:00:00.000Z';
const CANDIDATES: DeleteCandidate[] = Array.from({ length: 19 }, (_, i) => ({ path: `f${i}.txt`, sizeBytes: i }));

function many(n: number): DeleteCandidate[] {
  return Array.from({ length: n }, (_, i) => ({ path: `d${i}.txt`, sizeBytes: i }));
}

describe('① 阈值判定正反对照', () => {
  it('候选数 = 阈值-1 ⇒ clean(不需 approve)', () => {
    const d = evaluateBulkThreshold(many(DEFAULT_BULK_DELETE_THRESHOLD - 1));
    expect(d.verdict).toBe('clean');
    expect(d.requiresApproval).toBe(false);
  });
  it('候选数 = 阈值 ⇒ blocked 且要求 approve', () => {
    const d = evaluateBulkThreshold(many(DEFAULT_BULK_DELETE_THRESHOLD));
    expect(d.verdict).toBe('blocked');
    expect(d.requiresApproval).toBe(true);
    expect(d.samples.length).toBeLessThanOrEqual(5);
  });
  it('evaluateBulkDelete 未达阈值直接 clean(无需凭据)', () => {
    const d = evaluateBulkDelete({ candidates: CANDIDATES, digest: HEX, scanId: 's1', nowIso: NOW });
    expect(d.verdict).toBe('clean');
  });
});

describe('③ undetermined 不记绿(§0.3)', () => {
  it('候选集取不到(null/非数组)⇒ undetermined', () => {
    expect(evaluateBulkThreshold(null).verdict).toBe('undetermined');
    const d = evaluateBulkDelete({ candidates: undefined, digest: HEX, scanId: 's', nowIso: NOW });
    expect(d.verdict).toBe('undetermined');
  });
  it('枚举数少于调用方声称 ⇒ undetermined(清单与内容不同面)', () => {
    const d = evaluateBulkDelete({
      candidates: many(2),
      digest: HEX,
      scanId: 's',
      nowIso: NOW,
      expectedCount: 3,
    });
    expect(d.verdict).toBe('undetermined');
  });
  it('digest 抛错 ⇒ 签发不了凭据,判 undetermined 而非放行', () => {
    const boom: DigestFn = () => {
      throw new Error('digest unavailable');
    };
    const d = evaluateBulkDelete({ candidates: many(25), digest: boom, scanId: 's', nowIso: NOW });
    expect(d.verdict).toBe('undetermined');
  });
  it('聚合判序:undetermined > blocked > clean;空集不记 clean', () => {
    expect(aggregateGuardVerdict(['clean', 'blocked', 'undetermined'])).toBe('undetermined');
    expect(aggregateGuardVerdict(['clean', 'blocked'])).toBe('blocked');
    expect(aggregateGuardVerdict([])).toBe('undetermined');
  });
  it('锁时序四态 + 时钟回拨不猜生死', () => {
    expect(decideLock({ nowMs: 1000, lockStampMs: null }).decision).toBe('acquired');
    expect(decideLock({ nowMs: 1000, lockStampMs: 500 }).decision).toBe('busy');
    expect(decideLock({ nowMs: 999, lockStampMs: 1000 }).decision).toBe('undetermined');
    expect(decideLock({ nowMs: 301_000, lockStampMs: 0 }).decision).toBe('stale-reclaimed');
  });
});

describe('② approve 相缺失 ⇒ 一个文件都没被删(端到端,断言副作用未发生)', () => {
  let workDir: string;
  let ctx: EditToolContext;
  let origHooks: string | undefined;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-delete-guard-'));
    ctx = { workspacePath: workDir };
    origHooks = process.env.IHUI_HOOKS_CONFIG;
    process.env.IHUI_HOOKS_CONFIG = path.join(workDir, 'no-hooks.json');
  });
  afterEach(() => {
    if (origHooks === undefined) delete process.env.IHUI_HOOKS_CONFIG;
    else process.env.IHUI_HOOKS_CONFIG = origHooks;
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  function seedFiles(n: number): void {
    for (let i = 0; i < n; i++) {
      fs.writeFileSync(path.join(workDir, `del-${i}.txt`), `content-${i}`, 'utf-8');
    }
  }
  const deleteOps = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ type: 'delete' as const, filePath: `del-${i}.txt` }));

  it('缺 approve 凭据:blocked + 全部文件原样在位 + 无 checkpoint/回收站副作用', async () => {
    const n = DEFAULT_BULK_DELETE_THRESHOLD;
    seedFiles(n);
    const tool = createBatchEditTool(ctx);
    const r = await tool.execute({ operations: deleteOps(n), confirm: true }, ctx);
    expect(r.success).toBe(false);
    const decision = JSON.parse(r.output) as { verdict: string; ticket?: { scanId: string } };
    expect(decision.verdict).toBe('blocked');
    for (let i = 0; i < n; i++) {
      expect(fs.existsSync(path.join(workDir, `del-${i}.txt`))).toBe(true);
    }
    expect(fs.existsSync(path.join(workDir, '.ihui', 'batch-checkpoints'))).toBe(false);
    expect(r.error).toContain('护栏拒绝');
    // 重放文件已由 check 相落到状态目录(四件分离之"状态目录+重放文件")
    expect(decision.ticket).toBeDefined();
    const replay = path.join(workDir, '.ihui', 'delete-guard', 'state', `pending-${decision.ticket!.scanId}.json`);
    expect(fs.existsSync(replay)).toBe(true);
  });

  it('回传完整凭据:放行删除,文件进回收站,报告腿单独落盘,可按 manifest 恢复', async () => {
    const n = DEFAULT_BULK_DELETE_THRESHOLD;
    seedFiles(n);
    const tool = createBatchEditTool(ctx);
    const blocked = await tool.execute({ operations: deleteOps(n), confirm: true }, ctx);
    const decision = JSON.parse(blocked.output) as { ticket: { fingerprint: string; scanId: string } };
    const r = await tool.execute(
      { operations: deleteOps(n), confirm: true, bulkApproveTicket: JSON.stringify(decision.ticket) },
      ctx,
    );
    expect(r.success).toBe(true);
    for (let i = 0; i < n; i++) {
      expect(fs.existsSync(path.join(workDir, `del-${i}.txt`))).toBe(false);
    }
    // 回收站搬运可逆:manifest 合法且逐条能找回
    const trashRoot = getDeleteTrashDir(workDir);
    const trashIds = fs.readdirSync(trashRoot).filter((name) => isSafeIdSegment(name));
    expect(trashIds.length).toBe(1);
    const manifestRaw = JSON.parse(
      fs.readFileSync(path.join(trashRoot, trashIds[0], 'manifest.json'), 'utf-8'),
    ) as unknown;
    expect(isTrashManifestShape(manifestRaw)).toBe(true);
    const first = path.join(workDir, 'del-0.txt');
    expect(findTrashEntry(manifestRaw as never, first)).not.toBeNull();
    restoreTrashEntry(workDir, trashIds[0], first);
    expect(fs.readFileSync(first, 'utf-8')).toBe('content-0');
    // 报告腿(四件分离之"报告")与状态目录不混写
    const report = path.join(workDir, '.ihui', 'delete-guard', 'report.jsonl');
    expect(fs.existsSync(report)).toBe(true);
    expect(fs.readFileSync(report, 'utf-8')).toContain(decision.ticket.scanId);
  });

  it('按 scanId 重放放行;重放文件被删 ⇒ undetermined 且零删除', async () => {
    const n = DEFAULT_BULK_DELETE_THRESHOLD;
    seedFiles(n);
    const tool = createBatchEditTool(ctx);
    const blocked = await tool.execute({ operations: deleteOps(n), confirm: true }, ctx);
    const { ticket } = JSON.parse(blocked.output) as { ticket: { scanId: string } };
    const replayPath = path.join(workDir, '.ihui', 'delete-guard', 'state', `pending-${ticket.scanId}.json`);
    const r = await tool.execute({ operations: deleteOps(n), confirm: true, bulkApproveTicket: ticket.scanId }, ctx);
    expect(r.success).toBe(true);
    expect(fs.existsSync(path.join(workDir, 'del-1.txt'))).toBe(false);

    // 换一批:凭据文件先被拿走 ⇒ 重放取不到 ⇒ undetermined,不记绿也不删除
    seedFiles(n);
    fs.rmSync(replayPath, { force: true });
    const r2 = await tool.execute({ operations: deleteOps(n), confirm: true, bulkApproveTicket: ticket.scanId }, ctx);
    expect(r2.success).toBe(false);
    expect(JSON.parse(r2.output).verdict).toBe('undetermined');
    for (let i = 0; i < n; i++) {
      expect(fs.existsSync(path.join(workDir, `del-${i}.txt`))).toBe(true);
    }
  });

  it('delete_file 单文件:删除进回收站,恢复出口内容逐字节还原', async () => {
    fs.writeFileSync(path.join(workDir, 'single.txt'), 'solo', 'utf-8');
    const tool = createDeleteFileTool(ctx);
    const r = await tool.execute({ path: 'single.txt', confirm: true }, ctx);
    expect(r.success).toBe(true);
    expect(fs.existsSync(path.join(workDir, 'single.txt'))).toBe(false);
    const trashRoot = getDeleteTrashDir(workDir);
    const trashIds = fs.readdirSync(trashRoot);
    let restored = false;
    for (const id of trashIds) {
      const manifestPath = path.join(trashRoot, id, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as unknown;
      if (!isTrashManifestShape(manifest)) continue;
      const original = path.join(workDir, 'single.txt');
      if (findTrashEntry(manifest, original)) {
        restoreTrashEntry(workDir, id, original);
        restored = true;
      }
    }
    expect(restored).toBe(true);
    expect(fs.readFileSync(path.join(workDir, 'single.txt'), 'utf-8')).toBe('solo');
  });

  it('worktree 兜底腿:目录整搬回收站可恢复;rmSync 兜底仍在源码里未摘除', () => {
    const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const src = fs.readFileSync(path.join(repo, 'apps/cli/src/tools/worktree.ts'), 'utf-8');
    expect(src).toContain('fs.rmSync(wtPath, { recursive: true, force: true })'); // 兜底腿保留
    expect(src).toContain('stashDirToTrash'); // 回收站先试
    const fakeWt = path.join(workDir, '.worktrees', 'agent-x');
    fs.mkdirSync(fakeWt, { recursive: true });
    fs.writeFileSync(path.join(fakeWt, 'kept.txt'), 'x', 'utf-8');
    const stashed = stashDirToTrash(workDir, fakeWt, 'agent-x');
    expect(fs.existsSync(fakeWt)).toBe(false);
    expect(fs.existsSync(stashed)).toBe(true);
  });
});

describe('④ 形状锁:shared 判据层不得出现平台 IO', () => {
  it('delete-guard 目录每个 .ts 都不 import node: 内建、不触碰 fs/process', () => {
    const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const dir = path.join(repo, 'packages/shared/src/delete-guard');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const f of files) {
      const text = fs.readFileSync(path.join(dir, f), 'utf-8');
      expect(text, `${f} 不得 import node: 内建`).not.toMatch(/from ['"]node:/);
      expect(text, `${f} 不得 require 平台件`).not.toMatch(/\brequire\s*\(/);
      expect(text, `${f} 不得触碰 process/fs 全局`).not.toMatch(/\b(process|fs)\s*\./);
    }
  });
  it('规范形与命名判据为纯函数:同输入同输出、压平单射防撞名', () => {
    expect(canonicalizeScan(many(3))).toBe(canonicalizeScan(many(3)));
    // 单射:斜杠路径与已含下划线路径压平后必须分家(撞名 = 回收站覆盖事故)
    expect(flattenTrashName('a/b.txt', 1)).not.toBe(flattenTrashName('a__b.txt', 1));
    expect(flattenTrashName('a/b\\c:d.txt', 2)).not.toMatch(/[\\/]/);
    expect(flattenTrashName('a/b\\c:d.txt', 2).startsWith('2-')).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
