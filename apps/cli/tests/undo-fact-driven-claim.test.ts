// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { UndoRedoManager, type UndoResult } from '../src/commands/undo-redo.js';
import { renderUndoReport } from '../src/commands/undo-claim-copy.js';
import { t as realT } from '../src/i18n/index.js';

/**
 * D22046 通道③验收:那句「工作区未发生变化」必须由**撤销前后两份快照的比对**
 * 决定,而不是由作者写死的措辞决定。
 *
 * 三条钉法,方向相反:
 *   ① 一次部分回滚失败(1 成 1 败)⇒ 工作区确实变了 ⇒ 文案必须说"已发生变化",
 *      且一个字都不许出现"未发生变化";失败清单同时给出文件数与轮次。
 *   ② 一次全部回滚失败(写入一个字节都没落)⇒ 比对证明真没变 ⇒ 才允许说
 *      "工作区未发生变化",并给出受影响文件数(2 个)与轮次(2 轮)。
 *   ③ 变异对照:把注入的比对判据改成**恒返回 unchanged**,同一个 ① 场景立刻
 *      改口成"部分修改…"(不再是"已发生变化")—— 证明 ① 的断言是被判据驱动的,
 *      不是文案恰好如此。变异只改注入的依赖,生产判据一行未动。
 *
 * 隔离:全程只碰 os.tmpdir() 下自建目录。
 */

let ws: string;
const extraDirs: string[] = [];
const SESSION = 'd22046-claim';

beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-undo-d22046-claim-'));
  extraDirs.length = 0;
});

afterEach(() => {
  for (const dir of [ws, ...extraDirs]) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile()) fs.chmodSync(path.join(dir, entry.name), 0o666);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** 另建一个干净工作区(变异体必须与真实判据跑在互不污染的两份状态上)。 */
function freshWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-undo-d22046-mutant-'));
  extraDirs.push(dir);
  return dir;
}

function write(dir: string, rel: string, content: string): void {
  fs.writeFileSync(path.join(dir, rel), content, 'utf-8');
}

function freeze(dir: string, rel: string): void {
  fs.chmodSync(path.join(dir, rel), 0o444);
}

function record(mgr: UndoRedoManager, rel: string, ts: number): void {
  mgr.recordChange(SESSION, {
    toolName: 'edit_file',
    filePath: rel,
    beforeContent: `${rel}-before`,
    afterContent: `${rel}-after`,
    timestamp: ts,
  });
}

/** 一半成功、一半失败:栈顶 b.txt 只读 ⇒ 回滚失败;a.txt 回滚成功。 */
async function runPartialFailure(dir: string, mgr: UndoRedoManager): Promise<UndoResult> {
  write(dir, 'a.txt', 'a.txt-after');
  write(dir, 'b.txt', 'b.txt-after');
  freeze(dir, 'b.txt');
  record(mgr, 'a.txt', 1);
  record(mgr, 'b.txt', 2);
  return mgr.undo(SESSION, 2);
}

/** 两条都失败:两个文件都只读 ⇒ 工作区一个字节没变。 */
async function runAllFailure(dir: string, mgr: UndoRedoManager): Promise<UndoResult> {
  write(dir, 'a.txt', 'a.txt-after');
  write(dir, 'b.txt', 'b.txt-after');
  freeze(dir, 'a.txt');
  freeze(dir, 'b.txt');
  record(mgr, 'a.txt', 1);
  record(mgr, 'b.txt', 2);
  return mgr.undo(SESSION, 2);
}

describe('D22046 失败承诺由比对驱动', () => {
  it('① 部分回滚失败 ⇒ 禁止说"未变化",失败清单给出文件数 + 轮次', async () => {
    const res = await runPartialFailure(ws, new UndoRedoManager(ws));
    const report = renderUndoReport(res, realT);
    const failures = report.failureLines.join('\n');

    // 事实面:确证变了(一个文件已回滚),所以承诺句不成立
    expect(res.checkpoint.status).toBe('available');
    expect(res.attemptedSteps).toBe(2);
    expect(res.undoneSteps).toBe(1);
    expect(res.failedSteps).toBe(1);
    expect(res.verdict).toBe('changed');
    expect(res.workspaceUnchanged).toBe(false);
    expect(res.changedFiles).toEqual([path.join(ws, 'a.txt')]);

    // 文案面:结论必须是"已发生变化",承诺句一个字都不许出现
    expect(report.claimKey).toBe('undoFailedChanged');
    expect(report.claim).toContain('已发生变化');
    expect(report.claim).not.toContain('未发生变化');
    expect(report.claim).toContain('文件清单');

    // 失败清单:具体文件数(1 个)+ 受影响轮次(1 轮)+ 文件名
    expect(failures).toContain('1 个文件');
    expect(failures).toContain('1 轮');
    expect(failures).toContain('b.txt');
    expect(failures).not.toContain('a.txt');
  });

  it('② 全部回滚失败(真没变)⇒ 才允许说"未变化",并给出 2 个文件 / 2 轮', async () => {
    const res = await runAllFailure(ws, new UndoRedoManager(ws));
    const report = renderUndoReport(res, realT);
    const failures = report.failureLines.join('\n');

    expect(res.checkpoint.status).toBe('available');
    expect(res.attemptedSteps).toBe(2);
    expect(res.undoneSteps).toBe(0);
    expect(res.failedSteps).toBe(2);
    expect(res.verdict).toBe('unchanged');
    expect(res.changedFiles).toEqual([]);

    expect(report.claimKey).toBe('undoFailed');
    expect(report.claim).toContain('工作区未发生变化');
    expect(failures).toContain('2 个文件');
    expect(failures).toContain('2 轮');
    expect(failures).toContain('a.txt');
    expect(failures).toContain('b.txt');
  });

  it('③ 变异对照:比对器改成恒 unchanged ⇒ 同一部分失败场景改口(断言有牙)', async () => {
    const real = await runPartialFailure(ws, new UndoRedoManager(ws));
    const realReport = renderUndoReport(real, realT);

    // 变异体:只换注入的判据(恒真)与差异清单(恒空),生产判据未动。
    // 跑在另一份干净工作区上,避免真实判据那次已经把 a.txt 回滚掉。
    const mutantWs = freshWorkspace();
    const mutated = await runPartialFailure(
      mutantWs,
      new UndoRedoManager(mutantWs, {
        classifyUndoVerdict: () => 'unchanged',
        diffWorkspaceSnapshots: () => [],
      }),
    );
    const mutatedReport = renderUndoReport(mutated, realT);

    // 真实判据:已发生变化;恒真变异体:同一份事实被读成"部分修改不在检查点中"
    expect(realReport.claimKey).toBe('undoFailedChanged');
    expect(mutatedReport.claimKey).not.toBe('undoFailedChanged');
    expect(mutatedReport.claimKey).toBe('undoPartialWarning');
    expect(realReport.claim).toContain('已发生变化');
    expect(mutatedReport.claim).not.toContain('已发生变化');
    expect(mutatedReport.claimKey).not.toBe(realReport.claimKey);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
