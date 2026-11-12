// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-138 回归:hunk 撤销/恢复直接覆盖用户源文件,非原子。
 *
 * 判据:
 *   ① restoreHunk 写工作区源文件走「同目录 tmp + rename」:rename 发生时目标仍是旧内容,
 *      且没有以目标路径直接 writeFileSync;
 *   ② hunk manifest 同样原子写;
 *   ③ 两种写入都不留临时件。
 */
// 夹具唯一落点(AGENTS §26):不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as FsModule from 'node:fs';
import { HunkCheckpointManager } from '../src/checkpoints/hunks.js';

const probe = vi.hoisted(() => ({
  renames: [] as Array<{ from: string; to: string; destDuring: string | null }>,
  writeFilePaths: [] as string[],
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const renameSync = ((...args: Parameters<typeof actual.renameSync>) => {
    const from = String(args[0]);
    const to = String(args[1]);
    probe.renames.push({
      from,
      to,
      destDuring: actual.existsSync(to) ? String(actual.readFileSync(to, 'utf-8')) : null,
    });
    return actual.renameSync(...args);
  }) as typeof actual.renameSync;
  const writeFileSync = ((...args: Parameters<typeof actual.writeFileSync>) => {
    probe.writeFilePaths.push(String(args[0]));
    return actual.writeFileSync(...args);
  }) as typeof actual.writeFileSync;
  return { ...actual, renameSync, writeFileSync };
});

let workspaceDir = '';
let homeDir = '';
let origHome: string | undefined;
let origUserProfile: string | undefined;
let sessionId = '';
let mgr: HunkCheckpointManager;

beforeEach(() => {
  workspaceDir = mkScratch('f138-ws-');
  homeDir = mkScratch('f138-home-');
  origHome = process.env.HOME;
  origUserProfile = process.env.USERPROFILE;
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
  sessionId = `f138-${process.pid}-${Date.now()}`;
  mgr = new HunkCheckpointManager({ sessionId, workspacePath: workspaceDir });
  probe.renames = [];
  probe.writeFilePaths = [];
});

afterEach(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (origUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = origUserProfile;
  rmScratch(workspaceDir);
  rmScratch(homeDir);
  workspaceDir = '';
  homeDir = '';
});

describe('F-138 hunk 恢复写盘:同目录 tmp + rename', () => {
  it('restoreHunk 先落同目录临时件再 rename,目标在 rename 时仍是旧内容', () => {
    const abs = path.join(workspaceDir, 'a.txt');
    fs.writeFileSync(abs, 'l1\nl2\nl3\nl4\nl5\n', 'utf-8');
    const meta = mgr.snapshotHunks('a.txt', [{ start: 2, end: 4 }], 'edit 2-4');

    const modified = 'M1\nM2\nM3\nM4\nM5\n';
    fs.writeFileSync(abs, modified, 'utf-8');
    probe.renames = [];
    probe.writeFilePaths = [];

    const result = mgr.restoreHunk(meta.id, 0);

    expect(result.restored).toBe(true);
    // 只替换 hunk 范围(2-4),范围外的行保持被改后的内容
    expect(fs.readFileSync(abs, 'utf-8')).toBe('M1\nl2\nl3\nl4\nM5\n');
    // ② 没有以目标路径直接整份覆盖
    expect(probe.writeFilePaths).not.toContain(abs);
    // ① tmp 与目标同目录,rename 发生时目标仍是被改后的旧内容
    const write = probe.renames.find((r) => r.to === abs);
    expect(write).toBeDefined();
    expect(path.dirname(write!.from)).toBe(path.dirname(abs));
    expect(path.basename(write!.from)).toContain('.a.txt.tmp-');
    expect(write!.destDuring).toBe(modified);
    // ③ 不留临时件
    expect(fs.readdirSync(workspaceDir).filter((n) => n.includes('.tmp-'))).toEqual([]);
  });

  it('manifest 写入同样原子,且不留临时件', () => {
    const abs = path.join(workspaceDir, 'b.txt');
    fs.writeFileSync(abs, 'x\ny\n', 'utf-8');
    probe.renames = [];
    probe.writeFilePaths = [];

    const meta = mgr.snapshotHunks('b.txt', [{ start: 1, end: 2 }], 'manifest');

    const manifestPath = path.join(homeDir, '.ihui', 'checkpoints', sessionId, meta.id, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(probe.writeFilePaths).not.toContain(manifestPath);
    const write = probe.renames.find((r) => r.to === manifestPath);
    expect(write).toBeDefined();
    expect(path.dirname(write!.from)).toBe(path.dirname(manifestPath));
    expect(path.basename(write!.from)).toContain('.manifest.json.tmp-');
    expect(fs.readdirSync(path.dirname(manifestPath)).filter((n) => n.includes('.tmp-'))).toEqual([]);
  });
});
