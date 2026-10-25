// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { probeUndoCheckpoint } from '../src/commands/undo-checkpoint-state.js';
import { UndoRedoManager } from '../src/commands/undo-redo.js';
import { renderUndoClaim } from '../src/commands/undo-claim-copy.js';
import { t as realT } from '../src/i18n/index.js';

/**
 * D22046 通道②验收:撤销**之前**就要知道检查点能不能用,且这件事必须是
 * 结构化字段(结果/事件),不是终端上的一句日志。
 *
 * 钉四件事:
 *   ① 索引缺失 / 读不出来 / JSON 坏 / 条目缺字段 ⇒ 各自有独立的 reasonCode;
 *   ② 不可用时 `/undo` 一个文件都不碰,`attemptedSteps===0` 且 checkpoint 字段可读;
 *   ③ 检查点可用、只是写入失败 ⇒ checkpoint.status 仍是 'available' —— 与 ② 可分辨;
 *   ④ 文案由 ②/③ 的事实选择:不可用说 undoUnavailable,可用但全失败说 undoFailed。
 *
 * 隔离:全程只碰 os.tmpdir() 下自建目录。
 */

let ws: string;
const SESSION = 'd22046-checkpoint-probe';

beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-undo-d22046-cp-'));
});

afterEach(() => {
  // Windows 上 0o444 是真只读,先恢复再删。
  for (const entry of fs.readdirSync(ws, { withFileTypes: true })) {
    if (entry.isFile()) fs.chmodSync(path.join(ws, entry.name), 0o666);
  }
  fs.rmSync(ws, { recursive: true, force: true });
});

function indexFileOf(sessionId: string): string {
  return path.join(ws, '.ihui-agent', 'undo-history', `${sessionId}.json`);
}

function writeIndex(sessionId: string, raw: string): void {
  const file = indexFileOf(sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, raw, 'utf-8');
}

function write(rel: string, content: string): void {
  fs.writeFileSync(path.join(ws, rel), content, 'utf-8');
}

function freeze(rel: string): void {
  fs.chmodSync(path.join(ws, rel), 0o444);
}

function claimOf(res: Awaited<ReturnType<UndoRedoManager['undo']>>): string {
  return renderUndoClaim(
    {
      verdict: res.verdict,
      partial: res.partial,
      undoneSteps: res.undoneSteps,
      attemptedSteps: res.attemptedSteps,
      checkpointStatus: res.checkpoint.status,
    },
    realT,
  );
}

describe('D22046 probeUndoCheckpoint(纯函数,依赖可注入)', () => {
  const valid = (over: Record<string, unknown> = {}) => ({
    toolName: 'edit_file',
    filePath: 'a.txt',
    beforeContent: 'old',
    afterContent: 'new',
    timestamp: 1,
    ...over,
  });

  it('索引不存在 ⇒ missing + ENOENT', () => {
    const p = probeUndoCheckpoint('X:/no/such/file.json', { exists: () => false });
    expect(p.status).toBe('missing');
    expect(p.reasonCode).toBe('ENOENT');
    expect(p.entryCount).toBeNull();
  });

  it('存在但读不出来 ⇒ unreadable + 具体错误码(不许当成"没条目")', () => {
    const err = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    const p = probeUndoCheckpoint('X:/locked.json', {
      exists: () => true,
      readFile: () => {
        throw err;
      },
    });
    expect(p.status).toBe('unreadable');
    expect(p.reasonCode).toBe('EACCES');
    expect(p.entryCount).toBeNull();
  });

  it('JSON 解析失败 ⇒ corrupt + JSON_PARSE', () => {
    const p = probeUndoCheckpoint('X:/bad.json', {
      exists: () => true,
      readFile: () => '{"undoStack":[',
    });
    expect(p.status).toBe('corrupt');
    expect(p.reasonCode).toBe('JSON_PARSE');
  });

  it('顶层形状不对 ⇒ corrupt + SCHEMA', () => {
    const p = probeUndoCheckpoint('X:/shape.json', {
      exists: () => true,
      readFile: () => JSON.stringify({ undoStack: {}, redoStack: [] }),
    });
    expect(p.status).toBe('corrupt');
    expect(p.reasonCode).toBe('SCHEMA');
  });

  it('条目缺字段 ⇒ corrupt + 点名坏条目(索引不完整不许复原)', () => {
    const p = probeUndoCheckpoint('X:/entry.json', {
      exists: () => true,
      readFile: () =>
        JSON.stringify({
          undoStack: [valid(), { toolName: 'edit_file', filePath: 'b.txt' }],
          redoStack: [],
        }),
    });
    expect(p.status).toBe('corrupt');
    expect(p.invalidEntries).toEqual(['undoStack[1]']);
  });

  it('结构完整 ⇒ available 且数出可回滚条目', () => {
    const p = probeUndoCheckpoint('X:/ok.json', {
      exists: () => true,
      readFile: () => JSON.stringify({ undoStack: [valid(), valid()], redoStack: [] }),
    });
    expect(p.status).toBe('available');
    expect(p.entryCount).toBe(2);
    expect(p.invalidEntries).toEqual([]);
  });
});

describe('D22046 /undo 撤销前的检查点探测(集成)', () => {
  it('① 索引损坏 ⇒ 不动任何文件,结果里 checkpoint 字段可读', async () => {
    write('a.txt', 'a2');
    writeIndex(SESSION, '{"undoStack": [');

    const res = await new UndoRedoManager(ws).undo(SESSION, 1);

    expect(res.checkpoint.status).toBe('corrupt');
    expect(res.checkpoint.reasonCode).toBe('JSON_PARSE');
    expect(res.attemptedSteps).toBe(0);
    expect(res.failedSteps).toBe(0);
    // 一个字节都没碰
    expect(fs.readFileSync(path.join(ws, 'a.txt'), 'utf-8')).toBe('a2');
    expect(claimOf(res)).toContain('文件检查点不可用');
  });

  it('② 索引不存在 ⇒ missing,文案是 undoUnavailable 那一句', async () => {
    const res = await new UndoRedoManager(ws).undo(SESSION, 1);

    expect(res.checkpoint.status).toBe('missing');
    expect(res.checkpoint.indexFile).toBe(indexFileOf(SESSION));
    expect(res.checkpoint.reasonCode).toBe('ENOENT');
    expect(res.partial).toBe(false);
    expect(claimOf(res)).toContain('文件检查点不可用');
    expect(claimOf(res)).toContain('工作区未发生变化');
  });

  it('③ 检查点可用、写入失败 ⇒ 仍是 available(与"不可用"分得开)', async () => {
    const mgr = new UndoRedoManager(ws);
    write('a.txt', 'a2');
    write('b.txt', 'b2');
    freeze('a.txt');
    freeze('b.txt');
    mgr.recordChange(SESSION, {
      toolName: 'edit_file',
      filePath: 'a.txt',
      beforeContent: 'a1',
      afterContent: 'a2',
      timestamp: 1,
    });
    mgr.recordChange(SESSION, {
      toolName: 'edit_file',
      filePath: 'b.txt',
      beforeContent: 'b1',
      afterContent: 'b2',
      timestamp: 2,
    });

    const res = await mgr.undo(SESSION, 2);

    expect(res.checkpoint.status).toBe('available');
    expect(res.checkpoint.entryCount).toBe(2);
    expect(res.attemptedSteps).toBe(2);
    expect(res.undoneSteps).toBe(0);
    expect(res.failedSteps).toBe(2);
    // 可用但执行失败:说的是另一句(undoFailed),不是"检查点不可用"
    expect(claimOf(res)).toContain('暂时不可用');
    expect(claimOf(res)).toContain('工作区未发生变化');

    const missing = await new UndoRedoManager(ws).undo('another-session', 1);
    expect(missing.checkpoint.status).toBe('missing');
    expect(claimOf(missing)).not.toBe(claimOf(res));
  });

  it('④ 成功回退 ⇒ checkpoint 仍是 available,entryCount 是动手前的条目数', async () => {
    const mgr = new UndoRedoManager(ws);
    write('a.txt', 'a2');
    mgr.recordChange(SESSION, {
      toolName: 'edit_file',
      filePath: 'a.txt',
      beforeContent: 'a1',
      afterContent: 'a2',
      timestamp: 1,
    });

    const res = await mgr.undo(SESSION, 1);

    expect(res.checkpoint.status).toBe('available');
    expect(res.checkpoint.entryCount).toBe(1);
    expect(res.undoneSteps).toBe(1);
    expect(res.failedSteps).toBe(0);
    expect(res.checkpoint.reasonCode).toBeNull();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
