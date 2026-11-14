// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-139 回归:`rel.startsWith('..')` 把工作区内以两个点开头的合法文件名误判越界。
 *
 * 判据:
 *   ① `..notes.md` / `..env` 这类工作区内文件可以建立并恢复 hunk 检查点;
 *   ② 真正越界的 `../x` 仍被拒绝(判据是「首段恰为 ..」而不是「以 .. 开头」)。
 */
// 夹具唯一落点(AGENTS §26):不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HunkCheckpointManager } from '../src/checkpoints/hunks.js';

let workspaceDir = '';
let homeDir = '';
let origHome: string | undefined;
let origUserProfile: string | undefined;
let mgr: HunkCheckpointManager;

beforeEach(() => {
  workspaceDir = mkScratch('f139-ws-');
  homeDir = mkScratch('f139-home-');
  origHome = process.env.HOME;
  origUserProfile = process.env.USERPROFILE;
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
  mgr = new HunkCheckpointManager({ sessionId: `f139-${process.pid}-${Date.now()}`, workspacePath: workspaceDir });
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

describe('F-139 hunk 越界判据按首段', () => {
  it.each(['..notes.md', '..env', 'sub/..hidden.txt'])('%s:工作区内的点开头文件名可快照并恢复', (rel) => {
    const abs = path.join(workspaceDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, 'keep\nnext\n', 'utf-8');

    const meta = mgr.snapshotHunks(rel, [{ start: 1, end: 2 }], 'dotfile');
    expect(meta.file).toBe(rel.replace(/\\/g, '/'));
    expect(meta.hunks[0]!.originalLines).toEqual(['keep', 'next']);

    fs.writeFileSync(abs, 'changed\n', 'utf-8');
    const result = mgr.restoreHunk(meta.id, 0);
    expect(result.restored).toBe(true);
    expect(fs.readFileSync(abs, 'utf-8')).toBe('keep\nnext\n');
  });

  it('真正越界的 ../ 与绝对路径仍被拒绝', () => {
    // 越界路径不必真实存在:resolveRel 在读取文件之前就该拒绝
    const absoluteOutside = path.join(homeDir, 'f139-outside.txt');
    expect(() => mgr.snapshotHunks(absoluteOutside, [{ start: 1, end: 1 }], 'escape')).toThrow('不在工作区');
    expect(() => mgr.snapshotHunks('../f139-outside.txt', [{ start: 1, end: 1 }], 'escape')).toThrow('不在工作区');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
