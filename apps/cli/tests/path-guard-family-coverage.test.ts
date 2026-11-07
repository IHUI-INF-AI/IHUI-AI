// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * A 组 11 处同族路径入口的回归锁。
 *
 * 钉三件事:
 *   - manifest / undo history / 会话文件这类**持久化文件被篡改**后,回滚/对比/写盘不得越界;
 *   - `..`、绝对路径、盘符、符号链接(junction)四类越界形态逐类有用例;
 *   - 正常路径(相对路径、合法 id、中文 plan 名)不误伤。
 *
 * 判据唯一实现:`apps/cli/src/util/path-guard.ts`。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import {
  assertPlainFileName,
  resolvePathInsideRoot,
  resolveWorkspaceRelPath,
  segmentFilePathInside,
} from '../src/util/path-guard.js';
import { CheckpointManager } from '../src/checkpoints/index.js';
import { HunkCheckpointManager } from '../src/checkpoints/hunks.js';
import { UndoRedoManager } from '../src/commands/undo-redo.js';
import {
  getSessionsDir,
  listSessions,
  loadSession,
  saveSession,
  type Session,
} from '../src/commands/session.js';
import { loadCustomCommand, getCustomCommandsDir } from '../src/commands/custom-commands.js';
// 低层原语(显式 withinRoot)与 subagents 层同名,别名区分。
import {
  createWorktree as createWorktreeLowLevel,
  removeWorktree as removeWorktreeLowLevel,
} from '../src/worktree.js';
import { getCompactionTimelineLedgerPath } from '../src/compaction-timeline-resume.js';
import {
  getSubagentStateDir,
  getSubagentStatePath,
  saveSubagentState,
  loadSubagentState,
  type SubagentState,
} from '../src/subagents/state-store.js';
import { createWorktree, reconcileWorktreeArtifacts } from '../src/subagents/worktree.js';
import { WorktreeManager } from '../src/tools/worktree.js';
import { writeRunManifest } from '../src/runs/manifest.js';

let tmpHome: string;
let tmpWorkspace: string;
let tmpStateDir: string;
let savedHome: string | undefined;
let savedProfile: string | undefined;
let savedStateDir: string | undefined;

function makeSession(id: string): Session {
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    workspacePath: tmpWorkspace,
    modelId: 'test-model',
    history: [],
  };
}

function makeSubagent(id: string): SubagentState {
  return {
    id,
    parentId: 'parent',
    persona: 'default',
    capabilityMode: 'default',
    isolation: 'worktree',
    transcript: [],
    status: 'running',
    startedAt: new Date().toISOString(),
  };
}

/** 往检查点 manifest 里写"被篡改"的 files/file 字段。 */
function tamperManifest(manifestPath: string, mutate: (json: Record<string, unknown>) => void): void {
  const json = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
  mutate(json);
  fs.writeFileSync(manifestPath, JSON.stringify(json, null, 2), 'utf-8');
}

function checkpointManifestPath(sessionId: string, checkpointId: string): string {
  return path.join(tmpHome, '.ihui', 'checkpoints', sessionId, checkpointId, 'manifest.json');
}

beforeEach(() => {
  tmpHome = mkScratch('pg-home-');
  tmpWorkspace = mkScratch('pg-ws-');
  tmpStateDir = mkScratch('pg-state-');
  savedHome = process.env.HOME;
  savedProfile = process.env.USERPROFILE;
  savedStateDir = process.env.IHUI_SUBAGENT_STATE_DIR;
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  process.env.IHUI_SUBAGENT_STATE_DIR = tmpStateDir;
});

afterEach(() => {
  if (savedHome === undefined) delete process.env.HOME;
  else process.env.HOME = savedHome;
  if (savedProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = savedProfile;
  if (savedStateDir === undefined) delete process.env.IHUI_SUBAGENT_STATE_DIR;
  else process.env.IHUI_SUBAGENT_STATE_DIR = savedStateDir;
  delete process.env.IHUI_WORKTREE_DIR;
  rmScratch(tmpHome);
  rmScratch(tmpWorkspace);
  rmScratch(tmpStateDir);
});

describe('path-guard 判据本身', () => {
  it('持久化相对路径:拒 ../、绝对路径、盘符、UNC', () => {
    for (const bad of [
      '../victim.txt',
      'a/../../victim.txt',
      '/etc/passwd',
      'C:\\Windows\\evil.txt',
      '\\\\server\\share\\evil.txt',
    ]) {
      expect(() => resolveWorkspaceRelPath(tmpWorkspace, bad, '持久化路径')).toThrow(/拒绝/);
    }
    expect(resolveWorkspaceRelPath(tmpWorkspace, 'sub/a.txt', '持久化路径')).toBe(
      path.join(tmpWorkspace, 'sub', 'a.txt'),
    );
  });

  it('工作区内的符号链接目录:解析后落到根外即拒', (ctx) => {
    const outside = mkScratch('pg-outside-dir-');
    try {
      fs.symlinkSync(outside, path.join(tmpWorkspace, 'linkdir'), 'junction');
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      expect(() =>
        resolveWorkspaceRelPath(tmpWorkspace, 'linkdir/evil.txt', '持久化路径'),
      ).toThrow(/符号链接解析后落在根目录/);
    } finally {
      rmScratch(outside);
    }
  });

  it('plan 名单段判据:拒绝穿越、保留中文/空格/点号原样(行为等价)', () => {
    for (const bad of ['', 'a/b', 'a\\b', 'a..b', 'x\0y']) {
      expect(() => assertPlainFileName(bad, 'plan 名称')).toThrow(/plan 名称/);
    }
    expect(assertPlainFileName('中文 名称.v2', 'plan 名称')).toBe('中文 名称.v2');
  });

  it('单段 id 收敛:恶意 id 的落点仍在根内,合法 id 不误伤', () => {
    const root = path.join(tmpHome, 'seg-root');
    fs.mkdirSync(root, { recursive: true });
    for (const bad of ['../../escaped', '/etc/passwd', 'C:\\evil']) {
      const p = segmentFilePathInside(root, bad, '.json', '测试文件');
      expect(p.startsWith(path.resolve(root) + path.sep)).toBe(true);
    }
    // `..` 收敛后仍是特殊目录段:直接拒,不降级成 `..json` 之类的怪名。
    expect(() => segmentFilePathInside(root, '..', '.json', '测试文件')).toThrow(/拒绝路径段/);
    const normal = segmentFilePathInside(root, 'sess_abc-123', '.json', '测试文件');
    expect(normal).toBe(path.join(root, 'sess_abc-123.json'));
  });
});

describe('checkpoints manifest 被篡改', () => {
  it('restore:files 键为 ../ 时一个文件都不动(含同清单里的合法项)', async () => {
    const aFile = path.join(tmpWorkspace, 'a.txt');
    fs.writeFileSync(aFile, 'v1', 'utf-8');
    const mgr = new CheckpointManager({ sessionId: 'sess_ok', workspacePath: tmpWorkspace });
    const meta = await mgr.snapshotSync(['a.txt'], 'tamper');
    fs.writeFileSync(aFile, 'v2', 'utf-8');

    // 工作区外(仍在 scratch 根内)的受害文件
    const victim = path.join(path.dirname(tmpWorkspace), 'victim.txt');
    fs.writeFileSync(victim, 'safe', 'utf-8');

    tamperManifest(checkpointManifestPath('sess_ok', meta.id), (json) => {
      const files = json.files as Record<string, string>;
      files['../victim.txt'] = 'added';
    });

    await expect(mgr.restore(meta.id)).rejects.toThrow(/含 ".." 目录段/);
    expect(fs.readFileSync(victim, 'utf-8')).toBe('safe');
    // 清单里合法项也必须尚未应用(先整体校验再动手)
    expect(fs.readFileSync(aFile, 'utf-8')).toBe('v2');
  });

  it('restore:files 键为绝对路径时拒绝', async () => {
    fs.writeFileSync(path.join(tmpWorkspace, 'a.txt'), 'v1', 'utf-8');
    const mgr = new CheckpointManager({ sessionId: 'sess_ok', workspacePath: tmpWorkspace });
    const meta = await mgr.snapshotSync(['a.txt'], 'tamper');
    const absoluteKey = path.join(path.dirname(tmpWorkspace), 'victim.txt');
    tamperManifest(checkpointManifestPath('sess_ok', meta.id), (json) => {
      const files = json.files as Record<string, string>;
      files[absoluteKey] = 'added';
    });
    await expect(mgr.restore(meta.id)).rejects.toThrow(/不接受绝对路径/);
  });

  it('diff:同一份 manifest 的越界键也拒绝读取', async () => {
    fs.writeFileSync(path.join(tmpWorkspace, 'a.txt'), 'v1', 'utf-8');
    const mgr = new CheckpointManager({ sessionId: 'sess_ok', workspacePath: tmpWorkspace });
    const meta = await mgr.snapshotSync(['a.txt'], 'tamper');
    tamperManifest(checkpointManifestPath('sess_ok', meta.id), (json) => {
      const files = json.files as Record<string, string>;
      files['../victim.txt'] = 'snap';
    });
    expect(() => mgr.diff(meta.id)).toThrow(/含 ".." 目录段/);
  });

  it('工作区文件是符号链接指向根外时,restore 拒绝穿透写', async (ctx) => {
    const outside = mkScratch('pg-link-file-');
    const victim = path.join(outside, 'victim.txt');
    fs.writeFileSync(victim, 'safe', 'utf-8');
    try {
      fs.symlinkSync(victim, path.join(tmpWorkspace, 'link.txt'));
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      const mgr = new CheckpointManager({ sessionId: 'sess_ok', workspacePath: tmpWorkspace });
      const meta = await mgr.snapshotSync(['link.txt'], 'link');
      fs.writeFileSync(victim, 'ALTERED', 'utf-8');
      await expect(mgr.restore(meta.id)).rejects.toThrow(/符号链接解析后落在根目录/);
      expect(fs.readFileSync(victim, 'utf-8')).toBe('ALTERED');
    } finally {
      rmScratch(outside);
    }
  });

  it('正常路径:快照 → 修改 → 回滚照常工作', async () => {
    const aFile = path.join(tmpWorkspace, 'a.txt');
    fs.writeFileSync(aFile, 'v1', 'utf-8');
    const mgr = new CheckpointManager({ sessionId: 'sess_ok', workspacePath: tmpWorkspace });
    const meta = await mgr.snapshotSync(['a.txt'], 'normal');
    fs.writeFileSync(aFile, 'v2', 'utf-8');
    const result = await mgr.restore(meta.id);
    expect(result.restored).toContain('a.txt');
    expect(fs.readFileSync(aFile, 'utf-8')).toBe('v1');
  });
});

describe('hunk manifest 被篡改', () => {
  function seed(): void {
    fs.writeFileSync(path.join(tmpWorkspace, 'sample.txt'), '第一行\n第二行\n', 'utf-8');
  }

  it('restoreHunk:meta.file 为 ../ 时拒绝,受害文件不动', () => {
    seed();
    const victim = path.join(path.dirname(tmpWorkspace), 'victim.txt');
    fs.writeFileSync(victim, 'safe', 'utf-8');
    const mgr = new HunkCheckpointManager({ sessionId: 'sess_ok', workspacePath: tmpWorkspace });
    const meta = mgr.snapshotHunks('sample.txt', [{ start: 1, end: 1 }], 'tamper');
    tamperManifest(checkpointManifestPath('sess_ok', meta.id), (json) => {
      json.file = '../victim.txt';
    });
    expect(() => mgr.restoreHunk(meta.id, 0)).toThrow(/含 ".." 目录段/);
    expect(fs.readFileSync(victim, 'utf-8')).toBe('safe');
    expect(fs.readFileSync(path.join(tmpWorkspace, 'sample.txt'), 'utf-8')).toBe('第一行\n第二行\n');
  });

  it('diffHunks:同一份 manifest 的越界 file 也拒绝读取', () => {
    seed();
    const mgr = new HunkCheckpointManager({ sessionId: 'sess_ok', workspacePath: tmpWorkspace });
    const meta = mgr.snapshotHunks('sample.txt', [{ start: 1, end: 1 }], 'tamper');
    tamperManifest(checkpointManifestPath('sess_ok', meta.id), (json) => {
      json.file = '../victim.txt';
    });
    expect(() => mgr.diffHunks(meta.id)).toThrow(/含 ".." 目录段/);
  });

  it('list:根内符号链接目录不会读根外 manifest', (ctx) => {
    const outside = mkScratch('pg-hunk-link-');
    fs.writeFileSync(path.join(outside, 'manifest.json'), '{"evil":true}', 'utf-8');
    const mgr = new HunkCheckpointManager({ sessionId: 'sess_ok', workspacePath: tmpWorkspace });
    const baseDir = (mgr as unknown as { baseDir: string }).baseDir;
    try {
      fs.mkdirSync(baseDir, { recursive: true });
      fs.symlinkSync(outside, path.join(baseDir, 'hunk_evil'), 'junction');
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      expect(mgr.list()).toEqual([]);
    } finally {
      rmScratch(outside);
    }
  });

  it('正常路径:快照 → 回滚照常工作', () => {
    seed();
    const mgr = new HunkCheckpointManager({ sessionId: 'sess_ok', workspacePath: tmpWorkspace });
    const meta = mgr.snapshotHunks('sample.txt', [{ start: 2, end: 2 }], 'normal');
    expect(mgr.restoreHunk(meta.id, 0).restored).toBe(true);
  });
});

describe('undo history 被篡改', () => {
  function writeHistory(filePath: string, filePathValue: string, beforeContent: string): void {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          undoStack: [
            {
              toolName: 'write_file',
              filePath: filePathValue,
              beforeContent,
              afterContent: null,
              timestamp: Date.now(),
            },
          ],
          redoStack: [],
        },
        null,
        2,
      ),
      'utf-8',
    );
  }

  it('filePath 为 ../ 时不写工作区外文件', async () => {
    const victim = path.join(path.dirname(tmpWorkspace), 'victim.txt');
    fs.writeFileSync(victim, 'safe', 'utf-8');
    const mgr = new UndoRedoManager(tmpWorkspace);
    writeHistory(
      path.join(tmpWorkspace, '.ihui-agent', 'undo-history', 'sess_tamper.json'),
      '../victim.txt',
      'HACKED',
    );
    const result = await mgr.undo('sess_tamper', 1);
    expect(result.undoneSteps).toBe(0);
    expect(result.failedFiles).toContain('../victim.txt');
    expect(fs.readFileSync(victim, 'utf-8')).toBe('safe');
  });

  it('filePath 为工作区外绝对路径时拒绝', async () => {
    const victim = path.join(path.dirname(tmpWorkspace), 'victim.txt');
    fs.writeFileSync(victim, 'safe', 'utf-8');
    const mgr = new UndoRedoManager(tmpWorkspace);
    writeHistory(
      path.join(tmpWorkspace, '.ihui-agent', 'undo-history', 'sess_abs.json'),
      victim,
      'HACKED',
    );
    const result = await mgr.undo('sess_abs', 1);
    expect(result.undoneSteps).toBe(0);
    expect(fs.readFileSync(victim, 'utf-8')).toBe('safe');
  });

  it('正常相对路径照常回滚;history 文件名按单段 id 收敛', async () => {
    const aFile = path.join(tmpWorkspace, 'a.txt');
    fs.writeFileSync(aFile, 'old', 'utf-8');
    const mgr = new UndoRedoManager(tmpWorkspace);
    writeHistory(
      path.join(tmpWorkspace, '.ihui-agent', 'undo-history', 'sess_normal.json'),
      'a.txt',
      'restored',
    );
    const result = await mgr.undo('sess_normal', 1);
    expect(result.undoneSteps).toBe(1);
    expect(fs.readFileSync(aFile, 'utf-8')).toBe('restored');
  });

  it('恶意 sessionId 的历史文件仍落在历史目录内', () => {
    const mgr = new UndoRedoManager(tmpWorkspace);
    // getHistoryFile 私有:用 recordChange 触发写盘后检查实际落点
    mgr.recordChange('../../escaped', {
      toolName: 'write_file',
      filePath: 'a.txt',
      beforeContent: null,
      afterContent: 'x',
      timestamp: Date.now(),
    });
    const historyDir = path.join(tmpWorkspace, '.ihui-agent', 'undo-history');
    expect(fs.existsSync(path.join(path.dirname(tmpWorkspace), 'escaped.json'))).toBe(false);
    const files = fs.readdirSync(historyDir);
    expect(files).toHaveLength(1);
    expect(path.join(historyDir, files[0]!).startsWith(path.resolve(historyDir))).toBe(true);
  });
});

describe('会话文件 / 账本 / share 共享 loadSession', () => {
  it('恶意会话 id 存档不越界,且能按同一 id 读回', () => {
    saveSession(makeSession('../../escaped'));
    const dir = path.resolve(getSessionsDir());
    expect(fs.existsSync(path.join(tmpHome, '.ihui', 'escaped.json'))).toBe(false);
    const files = fs.readdirSync(dir);
    expect(files.some((f) => path.join(dir, f).startsWith(dir + path.sep))).toBe(true);
    expect(loadSession('../../escaped')?.id).toBe('../../escaped');
  });

  it('恶意 id 的 loadSession 不会读到目录外的同名会话文件', () => {
    const victim = path.join(tmpHome, '.ihui', 'victim.json');
    fs.mkdirSync(path.dirname(victim), { recursive: true });
    fs.writeFileSync(victim, JSON.stringify(makeSession('victim')), 'utf-8');
    expect(loadSession('../victim')).toBeNull();
  });

  it('合法会话 id 读写不受影响', () => {
    const id = 'sess_2f8a1c4e';
    saveSession(makeSession(id));
    expect(loadSession(id)?.id).toBe(id);
  });

  it('压缩时间线账本:恶意 id 落在 sessions 目录内,合法 id 文件名不变', () => {
    const dir = path.resolve(getSessionsDir());
    for (const bad of ['../../escaped', 'C:\\evil']) {
      const p = getCompactionTimelineLedgerPath(bad);
      expect(p.startsWith(dir + path.sep)).toBe(true);
    }
    expect(() => getCompactionTimelineLedgerPath('..')).toThrow(/拒绝路径段/);
    expect(getCompactionTimelineLedgerPath('sess_ok')).toBe(
      path.join(dir, 'sess_ok.compaction-timelines.json'),
    );
  });
});

describe('subagent 状态行', () => {
  it('恶意 id 落点仍在状态目录内,合法 id 文件名不变', () => {
    const dir = path.resolve(getSubagentStateDir());
    for (const bad of ['../../escaped', '/etc/passwd']) {
      const p = getSubagentStatePath(bad);
      expect(p.startsWith(dir + path.sep)).toBe(true);
    }
    expect(() => getSubagentStatePath('..')).toThrow(/拒绝路径段/);
    expect(getSubagentStatePath('abc-123')).toBe(path.join(dir, 'abc-123.json'));
  });

  it('恶意 id 存档不越界,合法 id 正常读写', () => {
    saveSubagentState(makeSubagent('../../escaped'));
    const dir = path.resolve(getSubagentStateDir());
    expect(fs.existsSync(path.join(path.dirname(dir), 'escaped.json'))).toBe(false);
    saveSubagentState(makeSubagent('abc-123'));
    expect(loadSubagentState('abc-123')?.id).toBe('abc-123');
  });
});

describe('worktree 目录与回收', () => {
  it('createWorktree 的恶意 subagentId 不会把目录拼到根外', () => {
    process.env.IHUI_WORKTREE_DIR = path.join(tmpWorkspace, '.worktrees');
    const victim = path.join(path.dirname(tmpWorkspace), 'victim.txt');
    fs.writeFileSync(victim, 'safe', 'utf-8');
    expect(() => createWorktree('parent', '../../victim', tmpWorkspace)).toThrow(/worktree/);
    expect(fs.existsSync(victim)).toBe(true);
    const root = path.join(tmpWorkspace, '.worktrees');
    if (fs.existsSync(root)) {
      for (const name of fs.readdirSync(root)) {
        expect(path.join(root, name).startsWith(path.resolve(root))).toBe(true);
      }
    }
  });

  it('reconcile:根内符号链接目录指向根外时保留不删', (ctx) => {
    const outside = mkScratch('pg-wt-link-');
    const keep = path.join(outside, 'keep.txt');
    fs.writeFileSync(keep, 'keep', 'utf-8');
    const root = path.join(tmpWorkspace, '.worktrees');
    process.env.IHUI_WORKTREE_DIR = root;
    try {
      fs.mkdirSync(root, { recursive: true });
      fs.symlinkSync(outside, path.join(root, 'evil-agent'), 'junction');
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      const actions = reconcileWorktreeArtifacts(tmpWorkspace);
      const evil = actions.find((a) => a.path === path.join(root, 'evil-agent'));
      expect(evil?.action).toBe('kept-unprovable');
      expect(fs.existsSync(keep)).toBe(true);
    } finally {
      rmScratch(outside);
    }
  });

  it('WorktreeManager.remove:恶意 agentId 不会删到根外', () => {
    const victim = path.join(path.dirname(tmpWorkspace), 'victim.txt');
    fs.writeFileSync(victim, 'safe', 'utf-8');
    const mgr = new WorktreeManager(tmpWorkspace);
    expect(mgr.remove('../victim')).toBe(false);
    expect(mgr.remove('../../victim')).toBe(false);
    expect(fs.readFileSync(victim, 'utf-8')).toBe('safe');
  });

  it('WorktreeManager.remove:根内符号链接指向根外时拒绝递归删除', (ctx) => {
    const outside = mkScratch('pg-wt-manager-link-');
    const keep = path.join(outside, 'keep.txt');
    fs.writeFileSync(keep, 'keep', 'utf-8');
    const root = path.join(tmpWorkspace, '.worktrees');
    fs.mkdirSync(root, { recursive: true });
    try {
      fs.symlinkSync(outside, path.join(root, 'evil-agent'), 'junction');
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      const mgr = new WorktreeManager(tmpWorkspace, root);
      expect(() => mgr.remove('evil-agent')).toThrow(/符号链接解析后落在根目录/);
      expect(fs.existsSync(keep)).toBe(true);
    } finally {
      rmScratch(outside);
    }
  });
});

describe('run manifest', () => {
  it('恶意 runId 的落点仍在 runs 根内', () => {
    const out = writeRunManifest({
      cwd: tmpWorkspace,
      cliVersion: 'test',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      runId: '../../evil',
      env: {},
    });
    expect(out).not.toBeNull();
    const runsRoot = path.join(tmpHome, '.ihui', 'runs');
    expect(out!.dir.startsWith(path.resolve(runsRoot) + path.sep)).toBe(true);
    expect(fs.existsSync(path.join(tmpHome, '.ihui', 'evil'))).toBe(false);
  });

  it('合法 runId 文件名不变', () => {
    const out = writeRunManifest({
      cwd: tmpWorkspace,
      cliVersion: 'test',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      runId: 'run-1',
      env: {},
    });
    expect(out!.manifest.runId).toBe('run-1');
    expect(out!.dir).toBe(path.join(tmpHome, '.ihui', 'runs', 'run-1'));
  });
});

describe('resolvePathInsideRoot(允许绝对,但必须落在根内)', () => {
  it('工作区内绝对路径放行,根外绝对路径拒绝', () => {
    const inside = path.join(tmpWorkspace, 'a.txt');
    expect(resolvePathInsideRoot(tmpWorkspace, inside, '目标')).toBe(path.resolve(inside));
    expect(() =>
      resolvePathInsideRoot(tmpWorkspace, path.join(path.dirname(tmpWorkspace), 'victim.txt'), '目标'),
    ).toThrow(/不在根目录/);
  });
});

describe('低层 worktree 原语:显式 withinRoot(fail-closed)', () => {
  it('createWorktree 缺 withinRoot ⇒ 抛错且零副作用', async () => {
    const dst = path.join(tmpWorkspace, 'wt-x');
    await expect(
      createWorktreeLowLevel({ source: tmpWorkspace, destination: dst } as unknown as Parameters<typeof createWorktreeLowLevel>[0]),
    ).rejects.toThrow(/withinRoot/);
    expect(fs.existsSync(dst)).toBe(false);
  });

  it('createWorktree destination 含 .. ⇒ 拒绝,不产生目录', async () => {
    const dst = path.join(tmpWorkspace, '..', 'escaped-wt');
    await expect(
      createWorktreeLowLevel({ source: tmpWorkspace, destination: dst, withinRoot: tmpWorkspace }),
    ).rejects.toThrow(/不在根目录/);
    expect(fs.existsSync(dst)).toBe(false);
  });

  it('createWorktree destination 为根外绝对路径 ⇒ 拒绝', async () => {
    const outside = mkScratch('pg-wt-out-');
    try {
      const dst = path.join(outside, 'wt');
      await expect(
        createWorktreeLowLevel({ source: tmpWorkspace, destination: dst, withinRoot: tmpWorkspace }),
      ).rejects.toThrow(/不在根目录/);
      expect(fs.existsSync(dst)).toBe(false);
    } finally {
      rmScratch(outside);
    }
  });

  it('createWorktree 父级符号链接指向根外 ⇒ 拒绝', async (ctx) => {
    const outside = mkScratch('pg-wt-parent-');
    try {
      fs.symlinkSync(outside, path.join(tmpWorkspace, 'linkdir'), 'junction');
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      await expect(
        createWorktreeLowLevel({
          source: tmpWorkspace,
          destination: path.join(tmpWorkspace, 'linkdir', 'wt'),
          withinRoot: tmpWorkspace,
        }),
      ).rejects.toThrow(/符号链接解析后落在根目录/);
    } finally {
      rmScratch(outside);
    }
  });

  it('removeWorktree 缺 withinRoot ⇒ 抛错,目录保留', async () => {
    const dir = path.join(tmpWorkspace, 'wt-keep');
    fs.mkdirSync(dir, { recursive: true });
    await expect(
      removeWorktreeLowLevel(dir, {} as unknown as Parameters<typeof removeWorktreeLowLevel>[1]),
    ).rejects.toThrow(/withinRoot/);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('removeWorktree 目标含 .. / 根外绝对路径 ⇒ 拒绝且不删', async () => {
    const victim = path.join(path.dirname(tmpWorkspace), 'victim-wt');
    fs.mkdirSync(victim, { recursive: true });
    const viaParent = path.join(tmpWorkspace, '..', 'victim-wt');
    await expect(removeWorktreeLowLevel(viaParent, { withinRoot: tmpWorkspace })).rejects.toThrow(/不在根目录/);
    await expect(removeWorktreeLowLevel(victim, { withinRoot: tmpWorkspace })).rejects.toThrow(/不在根目录/);
    expect(fs.existsSync(victim)).toBe(true);
  });

  it('removeWorktree 根内符号链接指向根外 ⇒ 拒绝,外部目录保留', async (ctx) => {
    const outside = mkScratch('pg-wt-rm-link-');
    const keep = path.join(outside, 'keep.txt');
    fs.writeFileSync(keep, 'keep', 'utf-8');
    try {
      fs.symlinkSync(outside, path.join(tmpWorkspace, 'linkdir'), 'junction');
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      await expect(
        removeWorktreeLowLevel(path.join(tmpWorkspace, 'linkdir'), { withinRoot: tmpWorkspace }),
      ).rejects.toThrow(/符号链接解析后落在根目录/);
      expect(fs.existsSync(keep)).toBe(true);
    } finally {
      rmScratch(outside);
    }
  });

  it('正常路径:根内目录照常删除,根内新建 worktree 不误伤', async () => {
    const dir = path.join(tmpWorkspace, 'wt-normal');
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
    await removeWorktreeLowLevel(dir, { withinRoot: tmpWorkspace });
    expect(fs.existsSync(dir)).toBe(false);
  });
});

describe('只读侧:listSessions / 自定义命令文件', () => {
  it('listSessions 跳过根内符号链接指向根外的会话文件', async (ctx) => {
    saveSession(makeSession('sess_ok'));
    const dir = getSessionsDir();
    const outside = mkScratch('pg-sess-link-');
    const victim = path.join(outside, 'evil.json');
    fs.writeFileSync(victim, JSON.stringify(makeSession('evil')), 'utf-8');
    try {
      fs.symlinkSync(victim, path.join(dir, 'evil.json'));
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      const ids = listSessions().map((s) => s.id);
      expect(ids).toContain('sess_ok');
      expect(ids).not.toContain('evil');
    } finally {
      rmScratch(outside);
    }
  });

  it('loadCustomCommand 读根内符号链接指向根外的文件 ⇒ 拒绝', async (ctx) => {
    const dir = getCustomCommandsDir();
    fs.mkdirSync(dir, { recursive: true });
    const outside = mkScratch('pg-cmd-link-');
    const victim = path.join(outside, 'leak.md');
    fs.writeFileSync(victim, '# 越界内容\n', 'utf-8');
    try {
      fs.symlinkSync(victim, path.join(dir, 'leak.md'));
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      expect(() => loadCustomCommand('leak')).toThrow(/符号链接解析后落在根目录/);
    } finally {
      rmScratch(outside);
    }
  });

  it('loadCustomCommand 正常文件照常读取', () => {
    const dir = getCustomCommandsDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ok-command.md'), '# 标题\n\n正文\n', 'utf-8');
    expect(loadCustomCommand('ok-command').body).toContain('正文');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
