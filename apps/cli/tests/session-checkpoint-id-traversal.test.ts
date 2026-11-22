// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话/检查点 id 路径穿越回归。
 *
 * 钉三件事:
 *   - `--resume`/ACP 的会话 id(`../`、绝对路径、盘符)落点必须仍在 state 目录内;
 *   - `--session` 的检查点根目录不得被 `..` 抬出 `~/.ihui/checkpoints`;
 *   - `delete` 的检查点 id 不得删到根目录外(含符号链接指向根外的场景)。
 * 反向对照:合法 UUID / `cp_...` 照常读写删。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import {
  getSessionStateDir,
  getSessionStatePath,
  saveSession,
  loadSession,
  deleteSession,
  type SessionState,
} from '../src/sessions/index.js';
import { CheckpointManager } from '../src/checkpoints/index.js';
import { HunkCheckpointManager } from '../src/checkpoints/hunks.js';

let tmpHome: string;
let tmpWorkspace: string;
let tmpStateDir: string;
let savedHome: string | undefined;
let savedProfile: string | undefined;

function makeSession(id: string): SessionState {
  const now = new Date().toISOString();
  return {
    id,
    sessionId: 'sess-test',
    createdAt: now,
    updatedAt: now,
    model: 'test-model',
    messages: [],
    status: 'running',
  };
}

beforeEach(() => {
  tmpHome = mkScratch('id-tr-home-');
  tmpWorkspace = mkScratch('id-tr-ws-');
  tmpStateDir = mkScratch('id-tr-state-');
  savedHome = process.env.HOME;
  savedProfile = process.env.USERPROFILE;
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  process.env.IHUI_SESSION_STATE_DIR = tmpStateDir;
});

afterEach(() => {
  if (savedHome === undefined) delete process.env.HOME;
  else process.env.HOME = savedHome;
  if (savedProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = savedProfile;
  delete process.env.IHUI_SESSION_STATE_DIR;
  rmScratch(tmpHome);
  rmScratch(tmpWorkspace);
  rmScratch(tmpStateDir);
});

describe('会话 id 路径穿越', () => {
  it.each(['../../etc/passwd', '..', '/etc/passwd', 'C:\\Windows\\evil'])(
    'id %s 的落点仍在 state 目录内',
    (id) => {
      const p = getSessionStatePath(id);
      expect(path.dirname(p)).toBe(path.resolve(getSessionStateDir()));
      expect(p.startsWith(path.resolve(getSessionStateDir()) + path.sep)).toBe(true);
    },
  );

  it('恶意 id 存档不会写到目录外,且能按同一 id 读回', () => {
    const outside = path.join(tmpHome, 'escaped.json');
    saveSession(makeSession('../../escaped'));
    expect(fs.existsSync(outside)).toBe(false);
    const loaded = loadSession('../../escaped');
    expect(loaded?.id).toBe('../../escaped');
  });

  it('合法 UUID 读写删不受影响', () => {
    const id = '2f8a1c4e-5b6d-4a3f-9c1e-7d8e9f0a1b2c';
    saveSession(makeSession(id));
    expect(loadSession(id)?.id).toBe(id);
    expect(deleteSession(id)).toBe(true);
    expect(loadSession(id)).toBeNull();
  });
});

describe('检查点 id 路径穿越', () => {
  it('`--session ../` 不会把根目录抬出 checkpoints', () => {
    const mgr = new CheckpointManager({ sessionId: '../../victim', workspacePath: tmpWorkspace });
    const meta = mgr.snapshotSync([], 'traversal');
    const checkpointsRoot = path.resolve(tmpHome, '.ihui', 'checkpoints');
    const baseDir = (mgr as unknown as { baseDir: string }).baseDir;
    expect(baseDir.startsWith(checkpointsRoot + path.sep)).toBe(true);
    expect(path.join(baseDir, meta.id).startsWith(checkpointsRoot + path.sep)).toBe(true);
    expect(fs.existsSync(path.join(tmpHome, '.ihui', 'victim'))).toBe(false);
  });

  it('会话 id 为 `..` 时直接拒绝构造', () => {
    expect(() => new CheckpointManager({ sessionId: '..', workspacePath: tmpWorkspace })).toThrow(
      /拒绝路径段/,
    );
  });

  it('合法会话与检查点照常快照/删除', () => {
    const mgr = new CheckpointManager({ sessionId: 'sess-正常', workspacePath: tmpWorkspace });
    const meta = mgr.snapshotSync([], 'normal');
    expect(mgr.delete(meta.id)).toBe(true);
    expect(mgr.get(meta.id)).toBeNull();
  });

  it('delete 的 `../` 与绝对路径 id 不会删到根外', () => {
    const victimDir = path.join(tmpHome, 'victim');
    fs.mkdirSync(victimDir, { recursive: true });
    const keep = path.join(victimDir, 'keep.txt');
    fs.writeFileSync(keep, 'keep', 'utf-8');

    const mgr = new CheckpointManager({ sessionId: 'sess-正常', workspacePath: tmpWorkspace });
    mgr.snapshotSync([], 'normal');

    expect(mgr.delete('../../victim')).toBe(false);
    expect(mgr.delete(victimDir)).toBe(false);
    expect(fs.existsSync(keep)).toBe(true);
  });

  it('检查点目录为指向根外的符号链接时拒绝递归删除', async (ctx) => {
    const outside = mkScratch('id-tr-link-outside-');
    const keep = path.join(outside, 'keep.txt');
    fs.writeFileSync(keep, 'keep', 'utf-8');

    const mgr = new CheckpointManager({ sessionId: 'sess-正常', workspacePath: tmpWorkspace });
    const baseDir = (mgr as unknown as { baseDir: string }).baseDir;
    const linkId = 'cp_link';
    try {
      fs.mkdirSync(baseDir, { recursive: true });
      fs.symlinkSync(outside, path.join(baseDir, linkId), 'junction');
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      expect(() => mgr.delete(linkId)).toThrow(/符号链接解析后落在.*之外/);
      expect(fs.existsSync(keep)).toBe(true);
    } finally {
      try {
        fs.unlinkSync(path.join(baseDir, linkId));
      } catch {
        /* 链接已不存在 */
      }
      rmScratch(outside);
    }
  });
});

describe('hunk 检查点 id 路径穿越', () => {
  function seedWorkspaceFile(): void {
    fs.writeFileSync(path.join(tmpWorkspace, 'sample.txt'), '第一行\n第二行\n', 'utf-8');
  }

  it('`--session ../` 不会把 hunk 根目录抬出 checkpoints', () => {
    seedWorkspaceFile();
    const mgr = new HunkCheckpointManager({ sessionId: '../../victim', workspacePath: tmpWorkspace });
    const meta = mgr.snapshotHunks('sample.txt', [{ start: 1, end: 1 }], 'traversal');
    const checkpointsRoot = path.resolve(tmpHome, '.ihui', 'checkpoints');
    const baseDir = (mgr as unknown as { baseDir: string }).baseDir;
    expect(baseDir.startsWith(checkpointsRoot + path.sep)).toBe(true);
    expect(fs.existsSync(path.join(tmpHome, '.ihui', 'victim'))).toBe(false);
    expect(mgr.get(meta.id)?.id).toBe(meta.id);
  });

  it('会话 id 为 `..` 时直接拒绝构造', () => {
    expect(
      () => new HunkCheckpointManager({ sessionId: '..', workspacePath: tmpWorkspace }),
    ).toThrow(/拒绝路径段/);
  });

  it('delete 的 `../` 与绝对路径 id 不会删到根外', () => {
    const victimDir = path.join(tmpHome, 'victim');
    fs.mkdirSync(victimDir, { recursive: true });
    const keep = path.join(victimDir, 'keep.txt');
    fs.writeFileSync(keep, 'keep', 'utf-8');

    seedWorkspaceFile();
    const mgr = new HunkCheckpointManager({ sessionId: 'sess-正常', workspacePath: tmpWorkspace });
    mgr.snapshotHunks('sample.txt', [{ start: 1, end: 1 }], 'normal');

    expect(mgr.delete('../../victim')).toBe(false);
    expect(mgr.delete(victimDir)).toBe(false);
    expect(fs.existsSync(keep)).toBe(true);
  });

  it('hunk 目录为指向根外的符号链接时拒绝递归删除', async (ctx) => {
    const outside = mkScratch('id-tr-hunk-link-outside-');
    const keep = path.join(outside, 'keep.txt');
    fs.writeFileSync(keep, 'keep', 'utf-8');

    const mgr = new HunkCheckpointManager({ sessionId: 'sess-正常', workspacePath: tmpWorkspace });
    const baseDir = (mgr as unknown as { baseDir: string }).baseDir;
    const linkId = 'hunk_link';
    try {
      fs.mkdirSync(baseDir, { recursive: true });
      fs.symlinkSync(outside, path.join(baseDir, linkId), 'junction');
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      expect(() => mgr.delete(linkId)).toThrow(/符号链接解析后落在.*之外/);
      expect(fs.existsSync(keep)).toBe(true);
    } finally {
      try {
        fs.unlinkSync(path.join(baseDir, linkId));
      } catch {
        /* 链接已不存在 */
      }
      rmScratch(outside);
    }
  });

  it('合法 hunk 快照/删除照常工作', () => {
    seedWorkspaceFile();
    const mgr = new HunkCheckpointManager({ sessionId: 'sess-正常', workspacePath: tmpWorkspace });
    const meta = mgr.snapshotHunks('sample.txt', [{ start: 1, end: 1 }], 'normal');
    expect(mgr.get(meta.id)?.hunks).toHaveLength(1);
    expect(mgr.delete(meta.id)).toBe(true);
    expect(mgr.get(meta.id)).toBeNull();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
