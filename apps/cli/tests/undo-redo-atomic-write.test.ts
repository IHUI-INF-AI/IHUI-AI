// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-43 补覆盖:撤销历史 JSON 走 commitAtomicWrite。
 * 替换失败时已有正式文件逐字节不变;首次创建失败则正式路径不出现。符号链接拒绝另见 undo-redo-symlink。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { UndoRedoManager, type FileChange } from '../src/commands/undo-redo.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import type * as FsModule from 'node:fs';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if ((globalThis as { __ihuiUndo43RenameFail?: boolean }).__ihuiUndo43RenameFail) {
      const err = new Error('EPERM: operation not permitted, rename') as NodeJS.ErrnoException;
      err.code = 'EPERM';
      throw err;
    }
    return actual.renameSync(from, to);
  }) as typeof actual.renameSync;
  return { ...actual, renameSync };
});

let scratch = '';

beforeAll(() => {
  scratch = mkScratch('undo-redo-atomic-write-');
});

afterAll(() => {
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[undo-redo-atomic-write] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

afterEach(() => {
  (globalThis as { __ihuiUndo43RenameFail?: boolean }).__ihuiUndo43RenameFail = false;
});

function change(filePath: string, afterContent: string): FileChange {
  return {
    toolName: 'write_file',
    filePath,
    beforeContent: '',
    afterContent,
    timestamp: 1,
  };
}

function historyPath(ws: string, sessionId: string): string {
  return path.join(ws, '.ihui-agent', 'undo-history', `${sessionId}.json`);
}

function tmpLeftovers(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.includes('.tmp-')) : [];
}

describe('DBG-43 undo-redo 历史 JSON 原子写', () => {
  it('正常落盘:历史文件是完整 JSON,且不留 tmp', () => {
    const ws = path.join(scratch, 'ok');
    const sessionId = 'sess-ok';
    const manager = new UndoRedoManager(ws);
    manager.recordChange(sessionId, change(path.join(ws, 'note.txt'), 'hello'));
    const file = historyPath(ws, sessionId);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { undoStack: Array<{ afterContent: string }> };
    expect(parsed.undoStack).toHaveLength(1);
    expect(parsed.undoStack[0]!.afterContent).toBe('hello');
    expect(tmpLeftovers(path.dirname(file))).toEqual([]);
  });

  it('替换失败:已有正式文件逐字节不变,不留下截断 JSON / tmp', () => {
    const ws = path.join(scratch, 'keep');
    const sessionId = 'sess-keep';
    const manager = new UndoRedoManager(ws);
    manager.recordChange(sessionId, change(path.join(ws, 'note.txt'), 'baseline'));
    const file = historyPath(ws, sessionId);
    const before = fs.readFileSync(file);
    JSON.parse(before.toString('utf-8'));

    (globalThis as { __ihuiUndo43RenameFail?: boolean }).__ihuiUndo43RenameFail = true;
    let thrown: unknown = null;
    try {
      manager.recordChange(sessionId, change(path.join(ws, 'note.txt'), 'should-not-land'));
    } catch (err) {
      thrown = err;
    }

    expect((thrown as { code?: string })?.code).toBe('atomic_replace_failed');
    expect((thrown as Error)?.name).toBe('AtomicReplaceFailedError');
    expect(fs.readFileSync(file).equals(before)).toBe(true);
    expect(tmpLeftovers(path.dirname(file))).toEqual([]);
  });

  it('首次创建时替换失败:正式路径不出现半截文件', () => {
    const ws = path.join(scratch, 'fresh');
    const sessionId = 'sess-fresh';
    const file = historyPath(ws, sessionId);
    (globalThis as { __ihuiUndo43RenameFail?: boolean }).__ihuiUndo43RenameFail = true;
    const manager = new UndoRedoManager(ws);
    expect(() => manager.recordChange(sessionId, change(path.join(ws, 'note.txt'), 'nope'))).toThrow(
      /原子替换失败/,
    );
    expect(fs.existsSync(file)).toBe(false);
    const dir = path.dirname(file);
    expect(tmpLeftovers(dir)).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
