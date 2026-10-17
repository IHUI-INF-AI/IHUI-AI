// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { UndoRedoManager } from '../src/commands/undo-redo.js';
import {
  diffWorkspaceSnapshots,
  isWorkspaceUnchanged,
  snapshotWorkspace,
  type FileState,
  type WorkspaceSnapshot,
} from '../src/commands/undo-workspace-state.js';

/**
 * D163 回退臂验收:那句「工作区未发生变化」必须是**比出来的**,不是写出来的。
 *
 * 钉的四件事,方向两两相反:
 *   1. 部分文件回滚失败 ⇒ workspaceUnchanged=false 且逐条点名(承诺不成立就是不成立);
 *   2. 两条都失败、一个字节都没写进去 ⇒ workspaceUnchanged=true(这时才说得出口);
 *   3. 全部成功 ⇒ workspaceUnchanged=false —— 撤回本身就是改动,
 *      成功撤回后说"工作区没变"是假话,票面的成功态文案也确实不提"未变化";
 *   4. 失败的那条必须**回到 undo 栈**,否则一次半途失败就把改动历史删了。
 * 另有一条"判据有牙":把比对换成恒真 ⇒ 第 1 条的结论必须翻(证明是它判的)。
 *
 * 隔离:全程只碰 os.tmpdir() 下自建的目录,读写**只**发生在那里;
 * 结束后恢复权限并递归删除,不留在磁盘上。
 */

let ws: string;
const SESSION = 'd163-test-session';

beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-undo-d163-'));
});

afterEach(() => {
  // 只读位会让 rmSync 失败 ⇒ 先一律恢复可写(Windows 上 0o444 是真的只读属性)
  for (const entry of fs.readdirSync(ws, { withFileTypes: true })) {
    const p = path.join(ws, entry.name);
    if (entry.isFile()) fs.chmodSync(p, 0o666);
  }
  fs.rmSync(ws, { recursive: true, force: true });
});

function write(rel: string, content: string): void {
  fs.writeFileSync(path.join(ws, rel), content, 'utf-8');
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ws, rel), 'utf-8');
}

/** 让该文件对写入失败(只留只读位;删除权限不受影响,故删除场景不靠它模拟)。 */
function freeze(rel: string): void {
  fs.chmodSync(path.join(ws, rel), 0o444);
}

function manager(): UndoRedoManager {
  return new UndoRedoManager(ws);
}

function recordModify(mgr: UndoRedoManager, rel: string, before: string, after: string, ts: number): void {
  mgr.recordChange(SESSION, {
    toolName: 'edit_file',
    filePath: rel,
    beforeContent: before,
    afterContent: after,
    timestamp: ts,
  });
}

// =============================================================================
// 一、快照与比对(纯函数层)
// =============================================================================

describe('workspace snapshot / diff', () => {
  it('内容变化 ⇒ 判变化(逐字节,不是逐长度)', () => {
    const f = path.join(ws, 'a.txt');
    fs.writeFileSync(f, 'AAA', 'utf-8');
    const before = snapshotWorkspace(['a.txt'], ws);
    fs.writeFileSync(f, 'AAB', 'utf-8');
    const after = snapshotWorkspace(['a.txt'], ws);
    expect(isWorkspaceUnchanged(before, after)).toBe(false);
    expect(diffWorkspaceSnapshots(before, after)).toEqual([f]);
  });

  it('内容逐字未动 ⇒ 判未变化(不是恒红判据)', () => {
    const f = path.join(ws, 'a.txt');
    fs.writeFileSync(f, 'AAA', 'utf-8');
    const before = snapshotWorkspace(['a.txt'], ws);
    const after = snapshotWorkspace(['a.txt'], ws);
    expect(isWorkspaceUnchanged(before, after)).toBe(true);
    expect(diffWorkspaceSnapshots(before, after)).toEqual([]);
  });

  it('新建(不存在 → 存在)与删除(存在 → 不存在)都算变化', () => {
    const f = path.join(ws, 'a.txt');
    const absent = snapshotWorkspace(['a.txt'], ws);
    fs.writeFileSync(f, 'AAA', 'utf-8');
    const present = snapshotWorkspace(['a.txt'], ws);
    expect(diffWorkspaceSnapshots(absent, present)).toEqual([f]);
    expect(diffWorkspaceSnapshots(present, absent)).toEqual([f]);
  });

  it('读不出来 ⇒ 按"变了"报(fail-closed:拿不到的信息不当"没变"的证据)', () => {
    const unknown = new Map<string, FileState>([
      ['/x', { kind: 'unknown', reason: 'EACCES' }],
    ]);
    const present = new Map<string, FileState>([['/x', { kind: 'present', content: 'AAA' }]]);
    expect(isWorkspaceUnchanged(unknown, present)).toBe(false);
    expect(isWorkspaceUnchanged(unknown, unknown)).toBe(false);
  });

  it('有牙:比对换成恒真 ⇒ 原本"变了"的结论必须被翻过来', () => {
    const f = path.join(ws, 'a.txt');
    fs.writeFileSync(f, 'AAA', 'utf-8');
    const before = snapshotWorkspace(['a.txt'], ws);
    fs.writeFileSync(f, 'BBB', 'utf-8');
    const after = snapshotWorkspace(['a.txt'], ws);
    // 恒真版判据:它说什么都会得到"未变化"
    const alwaysUnchanged = (_a: WorkspaceSnapshot, _b: WorkspaceSnapshot) => true;
    expect(alwaysUnchanged(before, after)).toBe(true);
    // 真判据必须否掉它 —— 否则那句承诺就是写死的措辞
    expect(isWorkspaceUnchanged(before, after)).toBe(false);
  });
});

// =============================================================================
// 二、/undo 的失败面(集成层)
// =============================================================================

describe('/undo 失败面', () => {
  it('两条都回滚失败 ⇒ 工作区真的一个字节没变 ⇒ 承诺成立', async () => {
    const mgr = manager();
    write('a.txt', 'a2');
    write('b.txt', 'b2');
    freeze('a.txt');
    freeze('b.txt');
    recordModify(mgr, 'a.txt', 'a1', 'a2', 1);
    recordModify(mgr, 'b.txt', 'b1', 'b2', 2);

    const res = await mgr.undo(SESSION, 2);

    expect(res.undoneSteps).toBe(0);
    expect(res.partial).toBe(true);
    expect(res.failedFiles.sort()).toEqual(['a.txt', 'b.txt']);
    // 这一条是本票的核心:承诺成立,且是比出来的
    expect(res.workspaceUnchanged).toBe(true);
    expect(res.changedFiles).toEqual([]);
    // 内容确实没被改成
    expect(read('a.txt')).toBe('a2');
    expect(read('b.txt')).toBe('b2');
  });

  it('部分回滚失败 ⇒ 承诺不成立,并逐条点名(不许说"未发生变化")', async () => {
    const mgr = manager();
    write('a.txt', 'a2');
    write('b.txt', 'b2');
    freeze('b.txt'); // 栈顶那条回滚会失败
    recordModify(mgr, 'a.txt', 'a1', 'a2', 1);
    recordModify(mgr, 'b.txt', 'b1', 'b2', 2);

    const res = await mgr.undo(SESSION, 2);

    expect(res.undoneSteps).toBe(1);
    expect(res.partial).toBe(true);
    expect(res.failedFiles).toEqual(['b.txt']);
    expect(res.failedReasons[0]).toBeTruthy();
    expect(res.workspaceUnchanged).toBe(false);
    expect(res.changedFiles).toEqual([path.join(ws, 'a.txt')]);
    // 成功那条确实回滚了,失败那条保持原样
    expect(read('a.txt')).toBe('a1');
    expect(read('b.txt')).toBe('b2');
  });

  it('失败的那条必须回到 undo 栈(否则一次半途失败就删掉了改动历史)', async () => {
    const mgr = manager();
    write('b.txt', 'b2');
    freeze('b.txt');
    recordModify(mgr, 'b.txt', 'b1', 'b2', 1);

    const res = await mgr.undo(SESSION, 1);

    expect(res.undoneSteps).toBe(0);
    // 还在栈里,用户还能再试一次
    expect(res.remaining).toBe(1);
    expect(mgr.listUndoable(SESSION).map((e) => e.filePath)).toEqual(['b.txt']);
  });

  it('全部成功 ⇒ 工作区当然变了(撤回本身就是改动,成功态不提"未变化")', async () => {
    const mgr = manager();
    write('a.txt', 'a2');
    recordModify(mgr, 'a.txt', 'a1', 'a2', 1);

    const res = await mgr.undo(SESSION, 1);

    expect(res.undoneSteps).toBe(1);
    expect(res.partial).toBe(false);
    expect(res.failedFiles).toEqual([]);
    expect(res.workspaceUnchanged).toBe(false);
    expect(read('a.txt')).toBe('a1');
  });

  it('无步可撤 ⇒ 一个字节都没动 ⇒ 承诺成立(不是"不知道")', async () => {
    const mgr = manager();
    const res = await mgr.undo(SESSION, 1);
    expect(res.undoneSteps).toBe(0);
    expect(res.workspaceUnchanged).toBe(true);
    expect(res.partial).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
