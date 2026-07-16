/**
 * Hunk 级 Checkpoints 测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { HunkCheckpointManager, type HunkRange } from '../src/checkpoints/hunks.js';

describe('Hunk 级 Checkpoints', () => {
  let tmpDir: string;
  let workspaceDir: string;
  let origHome: string;
  let origUserProfile: string | undefined;
  let tmpHome: string;
  let mgr: HunkCheckpointManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-hunk-test-'));
    workspaceDir = path.join(tmpDir, 'workspace');
    fs.mkdirSync(workspaceDir, { recursive: true });
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-hunk-home-'));
    origHome = process.env.HOME ?? '';
    origUserProfile = process.env.USERPROFILE;
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    mgr = new HunkCheckpointManager({
      sessionId: 'test-hunk-session',
      workspacePath: workspaceDir,
    });
  });

  afterEach(() => {
    process.env.HOME = origHome;
    if (origUserProfile !== undefined) {
      process.env.USERPROFILE = origUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function writeFile(rel: string, content: string): string {
    const abs = path.join(workspaceDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
    return abs;
  }

  function readFile(rel: string): string {
    return fs.readFileSync(path.join(workspaceDir, rel), 'utf-8');
  }

  describe('snapshotHunks', () => {
    it('快照指定行范围', () => {
      writeFile('a.ts', 'line1\nline2\nline3\nline4\nline5\n');
      const hunks: HunkRange[] = [{ start: 2, end: 4 }];
      const meta = mgr.snapshotHunks('a.ts', hunks, 'edit hunk 2-4');
      expect(meta.id).toMatch(/^hunk_/);
      expect(meta.file).toBe('a.ts');
      expect(meta.hunks).toHaveLength(1);
      expect(meta.hunks[0]!.range).toEqual({ start: 2, end: 4 });
      expect(meta.hunks[0]!.originalLines).toEqual(['line2', 'line3', 'line4']);
    });

    it('多个 hunk 同时快照', () => {
      writeFile('a.ts', 'a\nb\nc\nd\ne\nf\ng\n');
      const hunks: HunkRange[] = [
        { start: 1, end: 2 },
        { start: 5, end: 6 },
      ];
      const meta = mgr.snapshotHunks('a.ts', hunks, 'multi hunk');
      expect(meta.hunks).toHaveLength(2);
      expect(meta.hunks[0]!.originalLines).toEqual(['a', 'b']);
      expect(meta.hunks[1]!.originalLines).toEqual(['e', 'f']);
    });

    it('空 hunks 抛错', () => {
      writeFile('a.ts', 'content\n');
      expect(() => mgr.snapshotHunks('a.ts', [], 'empty')).toThrow('hunks 不能为空');
    });

    it('非法 hunk 范围抛错', () => {
      writeFile('a.ts', 'content\n');
      expect(() => mgr.snapshotHunks('a.ts', [{ start: 0, end: 1 }], 'zero start')).toThrow('非法');
      expect(() => mgr.snapshotHunks('a.ts', [{ start: 5, end: 3 }], 'end<start')).toThrow('非法');
    });

    it('行号超出文件范围时截断', () => {
      writeFile('a.ts', 'only\n');
      const meta = mgr.snapshotHunks('a.ts', [{ start: 1, end: 100 }], 'overflow');
      expect(meta.hunks[0]!.originalLines).toEqual(['only']);
    });

    it('文件不存在时快照空内容', () => {
      const meta = mgr.snapshotHunks('nonexistent.ts', [{ start: 1, end: 5 }], 'missing file');
      expect(meta.hunks[0]!.originalLines).toEqual([]);
    });

    it('绝对路径自动转相对', () => {
      const abs = writeFile('a.ts', 'x\ny\n');
      const meta = mgr.snapshotHunks(abs, [{ start: 1, end: 2 }], 'abs path');
      expect(meta.file).toBe('a.ts');
    });

    it('工作区外文件抛错', () => {
      expect(() =>
        mgr.snapshotHunks(path.join(os.tmpdir(), 'outside.txt'), [{ start: 1, end: 1 }], 'outside'),
      ).toThrow('不在工作区');
    });

    it('Windows 路径分隔符转 POSIX', () => {
      writeFile('sub/a.ts', 'x\ny\n');
      const meta = mgr.snapshotHunks(path.join(workspaceDir, 'sub', 'a.ts'), [{ start: 1, end: 1 }], 'win path');
      expect(meta.file).toBe('sub/a.ts');
    });
  });

  describe('list / get', () => {
    it('空时返回空数组', () => {
      expect(mgr.list()).toEqual([]);
    });

    it('list 返回所有 hunk checkpoints(按创建时间倒序)', () => {
      writeFile('a.ts', 'x\n');
      const cp1 = mgr.snapshotHunks('a.ts', [{ start: 1, end: 1 }], 'first');
      const cp2 = mgr.snapshotHunks('a.ts', [{ start: 1, end: 1 }], 'second');
      const list = mgr.list();
      expect(list).toHaveLength(2);
      expect(list[0]!.id).toBe(cp2.id);
      expect(list[1]!.id).toBe(cp1.id);
    });

    it('get 返回指定 checkpoint', () => {
      writeFile('a.ts', 'x\n');
      const cp = mgr.snapshotHunks('a.ts', [{ start: 1, end: 1 }], 'test');
      const got = mgr.get(cp.id);
      expect(got).not.toBeNull();
      expect(got!.id).toBe(cp.id);
      expect(got!.reason).toBe('test');
    });

    it('get 不存在返回 null', () => {
      expect(mgr.get('nonexistent_id')).toBeNull();
    });

    it('list 只返回 hunk_ 前缀目录(不影响整文件 checkpoints)', () => {
      writeFile('a.ts', 'x\n');
      mgr.snapshotHunks('a.ts', [{ start: 1, end: 1 }], 'hunk cp');
      // 模拟非 hunk_ 前缀的目录(整文件 checkpoint)
      const fakeDir = path.join(os.homedir(), '.ihui', 'checkpoints', 'test-hunk-session', 'cp_123');
      fs.mkdirSync(fakeDir, { recursive: true });
      fs.writeFileSync(path.join(fakeDir, 'manifest.json'), '{}', 'utf-8');
      const list = mgr.list();
      expect(list).toHaveLength(1);
      expect(list[0]!.id.startsWith('hunk_')).toBe(true);
    });
  });

  describe('restoreHunk', () => {
    it('回滚单个 hunk 恢复原始行', () => {
      writeFile('a.ts', 'original1\noriginal2\noriginal3\n');
      const cp = mgr.snapshotHunks('a.ts', [{ start: 2, end: 2 }], 'before edit');
      // 修改第 2 行
      writeFile('a.ts', 'original1\nMODIFIED\noriginal3\n');
      expect(readFile('a.ts')).toBe('original1\nMODIFIED\noriginal3\n');
      // 回滚
      const result = mgr.restoreHunk(cp.id, 0);
      expect(result.restored).toBe(true);
      expect(result.linesAffected).toBe(1);
      expect(readFile('a.ts')).toBe('original1\noriginal2\noriginal3\n');
    });

    it('保留其他 hunk 外的修改', () => {
      writeFile('a.ts', 'line1\nline2\nline3\nline4\n');
      const cp = mgr.snapshotHunks('a.ts', [{ start: 2, end: 3 }], 'before edit');
      // 修改所有行
      writeFile('a.ts', 'NEW1\nNEW2\nNEW3\nNEW4\n');
      // 只回滚 hunk 2-3
      mgr.restoreHunk(cp.id, 0);
      expect(readFile('a.ts')).toBe('NEW1\nline2\nline3\nNEW4\n');
    });

    it('多个 hunks 回滚单个不影响其他', () => {
      writeFile('a.ts', 'a\nb\nc\nd\ne\nf\n');
      const hunks: HunkRange[] = [
        { start: 1, end: 2 },
        { start: 5, end: 6 },
      ];
      const cp = mgr.snapshotHunks('a.ts', hunks, 'multi');
      writeFile('a.ts', 'A\nB\nC\nD\nE\nF\n');
      // 只回滚第一个 hunk
      mgr.restoreHunk(cp.id, 0);
      expect(readFile('a.ts')).toBe('a\nb\nC\nD\nE\nF\n');
      // 再回滚第二个 hunk
      mgr.restoreHunk(cp.id, 1);
      expect(readFile('a.ts')).toBe('a\nb\nC\nD\ne\nf\n');
    });

    it('checkpoint 不存在返回失败', () => {
      const result = mgr.restoreHunk('nonexistent', 0);
      expect(result.restored).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('hunkIdx 越界返回失败', () => {
      writeFile('a.ts', 'x\n');
      const cp = mgr.snapshotHunks('a.ts', [{ start: 1, end: 1 }], 'single');
      const result = mgr.restoreHunk(cp.id, 5);
      expect(result.restored).toBe(false);
      expect(result.reason).toContain('越界');
    });

    it('回滚后文件不存在时自动创建', () => {
      writeFile('a.ts', 'original\n');
      const cp = mgr.snapshotHunks('a.ts', [{ start: 1, end: 1 }], 'before delete');
      // 删除文件
      fs.unlinkSync(path.join(workspaceDir, 'a.ts'));
      expect(fs.existsSync(path.join(workspaceDir, 'a.ts'))).toBe(false);
      // 回滚应恢复文件
      const result = mgr.restoreHunk(cp.id, 0);
      expect(result.restored).toBe(true);
      expect(readFile('a.ts')).toBe('original\n');
    });
  });

  describe('restoreAll', () => {
    it('回滚所有 hunks', () => {
      writeFile('a.ts', 'a\nb\nc\nd\ne\nf\n');
      const hunks: HunkRange[] = [
        { start: 1, end: 2 },
        { start: 5, end: 6 },
      ];
      const cp = mgr.snapshotHunks('a.ts', hunks, 'all');
      writeFile('a.ts', 'A\nB\nC\nD\nE\nF\n');
      const result = mgr.restoreAll(cp.id);
      expect(result.hunksRestored).toBe(2);
      expect(result.linesAffected).toBe(4);
      // 只回滚 hunk 范围内的行(1-2, 5-6),中间 3-4 行保持修改后状态
      expect(readFile('a.ts')).toBe('a\nb\nC\nD\ne\nf\n');
    });

    it('checkpoint 不存在返回 0', () => {
      const result = mgr.restoreAll('nonexistent');
      expect(result.hunksRestored).toBe(0);
      expect(result.reason).toContain('不存在');
    });

    it('倒序回滚避免行号偏移', () => {
      // 这是个关键场景:回滚第一个 hunk 会改变后续 hunk 的行号
      // 倒序回滚(从后往前)避免这个问题
      writeFile('a.ts', '1\n2\n3\n4\n5\n');
      const hunks: HunkRange[] = [
        { start: 1, end: 2 }, // 2 行
        { start: 4, end: 5 }, // 2 行
      ];
      const cp = mgr.snapshotHunks('a.ts', hunks, 'reverse order');
      // 修改文件但不改变行数
      writeFile('a.ts', 'X\nX\n3\nX\nX\n');
      mgr.restoreAll(cp.id);
      expect(readFile('a.ts')).toBe('1\n2\n3\n4\n5\n');
    });
  });

  describe('diffHunks', () => {
    it('返回每个 hunk 的状态', () => {
      writeFile('a.ts', 'a\nb\nc\nd\n');
      const cp = mgr.snapshotHunks('a.ts', [
        { start: 1, end: 1 },
        { start: 3, end: 3 },
      ], 'diff test');
      // 修改第 1 行,保留第 3 行
      writeFile('a.ts', 'X\nb\nc\nd\n');
      const diff = mgr.diffHunks(cp.id);
      expect(diff).toHaveLength(2);
      expect(diff[0]!.status).toBe('modified');
      expect(diff[1]!.status).toBe('unchanged');
    });

    it('文件删除后所有 hunk 标记 gone', () => {
      writeFile('a.ts', 'x\ny\n');
      const cp = mgr.snapshotHunks('a.ts', [{ start: 1, end: 2 }], 'will delete');
      fs.unlinkSync(path.join(workspaceDir, 'a.ts'));
      const diff = mgr.diffHunks(cp.id);
      expect(diff[0]!.status).toBe('gone');
    });

    it('checkpoint 不存在返回空数组', () => {
      expect(mgr.diffHunks('nonexistent')).toEqual([]);
    });
  });

  describe('delete', () => {
    it('删除 checkpoint', () => {
      writeFile('a.ts', 'x\n');
      const cp = mgr.snapshotHunks('a.ts', [{ start: 1, end: 1 }], 'to delete');
      expect(mgr.delete(cp.id)).toBe(true);
      expect(mgr.get(cp.id)).toBeNull();
    });

    it('删除不存在的返回 false', () => {
      expect(mgr.delete('nonexistent')).toBe(false);
    });
  });

  describe('pruneOldCheckpoints', () => {
    it('超过上限时自动删除最旧的', () => {
      const smallMgr = new HunkCheckpointManager({
        sessionId: 'test-prune',
        workspacePath: workspaceDir,
        maxCheckpoints: 3,
      });
      writeFile('a.ts', 'x\n');
      const cps: string[] = [];
      for (let i = 0; i < 5; i++) {
        cps.push(smallMgr.snapshotHunks('a.ts', [{ start: 1, end: 1 }], `cp-${i}`).id);
      }
      const list = smallMgr.list();
      expect(list).toHaveLength(3);
      // 最旧的 2 个应被删除
      expect(list.find((c) => c.id === cps[0])).toBeUndefined();
      expect(list.find((c) => c.id === cps[1])).toBeUndefined();
      // 最新的 3 个保留
      expect(list.find((c) => c.id === cps[2])).toBeDefined();
      expect(list.find((c) => c.id === cps[3])).toBeDefined();
      expect(list.find((c) => c.id === cps[4])).toBeDefined();
    });
  });

  describe('集成场景', () => {
    it('工具修改 → hunk 快照 → 部分回滚', () => {
      // 模拟 Agent 工具修改文件前后
      writeFile('service.ts', [
        'export function foo() {',
        '  return 1;',
        '}',
        '',
        'export function bar() {',
        '  return 2;',
        '}',
      ].join('\n') + '\n');

      // 工具准备修改 bar 函数(第 5-7 行),先快照
      const cp = mgr.snapshotHunks('service.ts', [{ start: 5, end: 7 }], 'before edit bar');

      // 修改 bar 函数
      writeFile('service.ts', [
        'export function foo() {',
        '  return 1;',
        '}',
        '',
        'export function bar() {',
        '  return 999;',
        '}',
      ].join('\n') + '\n');

      // foo 保留,bar 已修改
      const content = readFile('service.ts');
      expect(content).toContain('return 1');
      expect(content).toContain('return 999');

      // 查看差异
      const diff = mgr.diffHunks(cp.id);
      expect(diff[0]!.status).toBe('modified');

      // 回滚 bar 函数
      mgr.restoreHunk(cp.id, 0);
      const restored = readFile('service.ts');
      expect(restored).toContain('return 1');
      expect(restored).toContain('return 2');
      expect(restored).not.toContain('return 999');
    });
  });
});
