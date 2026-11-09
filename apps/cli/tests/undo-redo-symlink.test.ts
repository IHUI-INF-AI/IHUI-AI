// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { UndoRedoManager, type FileChange } from '../src/commands/undo-redo.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边

/** 本机能否建**文件**符号链接(Windows 需开发者模式/管理员):不能就如实 skip,不冒充 passed。 */
const CAN_FILE_SYMLINK = (() => {
  const d = mkScratch('undo-link-cap-');
  try {
    const real = path.join(d, 'real.txt');
    fs.writeFileSync(real, 'x');
    const link = path.join(d, 'link.txt');
    fs.symlinkSync(real, link, 'file');
    return fs.lstatSync(link).isSymbolicLink();
  } catch {
    return false;
  } finally {
    try {
      rmScratch(d);
    } catch {
      // 探针目录清理失败不影响能力判定
    }
  }
})();
const itLink = CAN_FILE_SYMLINK ? it : it.skip;
const LINK_CASE_COUNT = 1;
if (!CAN_FILE_SYMLINK) {
  console.warn(
    `[undo-redo-symlink] 本机不能建文件符号链接 ⇒ 跳过 ${LINK_CASE_COUNT} 条 symlink 用例(skip,不计覆盖);` +
      '拒绝语义的同等价路径由 tasks-atomic-write 的 lstat-mock 用例覆盖。',
  );
}

let scratch = '';

beforeAll(() => {
  scratch = mkScratch('undo-redo-symlink-');
});

afterAll(() => {
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[undo-redo-symlink] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

function tmpLeftovers(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.includes('.tmp-')) : [];
}

describe('DBG-43 undo-redo 历史文件目标是符号链接', () => {
  itLink('写入被拒 ⇒ SymlinkTargetError,链接与真身均未被改动,无 tmp 残留', () => {
    const ws = path.join(scratch, 'ws');
    const dir = path.join(ws, '.ihui-agent', 'undo-history');
    fs.mkdirSync(dir, { recursive: true });
    const sessionId = 'sym-session';
    // 真身必须留在历史目录内:path-guard 会先把"链到 root 外的历史文件"当成越界拒掉(普通 Error),
    // 那样测到的是守卫而不是原子写的 reparse 拒绝(probe 实测:放外面时 code=null)。
    const real = path.join(dir, `${sessionId}.real`);
    fs.writeFileSync(real, JSON.stringify({ undoStack: [], redoStack: [] }, null, 2));
    const before = fs.readFileSync(real);
    const link = path.join(dir, `${sessionId}.json`);
    fs.symlinkSync(real, link, 'file');

    const change: FileChange = {
      toolName: 'write_file',
      filePath: path.join(ws, 'note.txt'),
      beforeContent: '',
      afterContent: 'hello',
      timestamp: Date.now(),
    };

    const manager = new UndoRedoManager(ws); // load() 会穿透链接读到空历史
    let thrown: unknown = null;
    try {
      manager.recordChange(sessionId, change);
    } catch (err) {
      thrown = err;
    }

    expect((thrown as { code?: string })?.code).toBe('symlink_target');
    expect((thrown as Error)?.name).toBe('SymlinkTargetError');
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(real).equals(before)).toBe(true);
    expect(tmpLeftovers(dir)).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
