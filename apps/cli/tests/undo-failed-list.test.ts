// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { UndoRedoManager } from '../src/commands/undo-redo.js';
import {
  renderUndoReport,
  UNDO_REPORT_LIST_LIMIT,
} from '../src/commands/undo-claim-copy.js';
import { t as realT } from '../src/i18n/index.js';

/**
 * D22046 末格:失败文件必须在终端**逐条点名**,不是只躺在 `failedFiles` 数据面。
 *
 * 钉三件事:
 *   ① 两条失败 ⇒ 两条文件名与原因都印出来,不留"部分失败"这种无主语的话;
 *   ② 十二条失败 ⇒ 只印前 10 条 + "另有 2 条",避免一屏被刷满;
 *   ③ 全部失败 ⇒ 成功清单为空(不许印"✓ 已回滚 0 步")。
 * 数据面仍是完整事实:截断只发生在**呈现**,`failedFiles` 两条也不少。
 *
 * 隔离:全程只碰 os.tmpdir() 下自建目录;结束恢复只读位后递归删除。
 */

let ws: string;
const SESSION = 'd22046-failed-list';

beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-undo-d22046-'));
});

afterEach(() => {
  // 只读位会让 rmSync 失败 ⇒ 先恢复可写(Windows 上 0o444 是真的只读属性)
  for (const entry of fs.readdirSync(ws, { withFileTypes: true })) {
    if (entry.isFile()) fs.chmodSync(path.join(ws, entry.name), 0o666);
  }
  fs.rmSync(ws, { recursive: true, force: true });
});

/** 记录一条"改前 old、改后 new"的改动,并让磁盘上的文件对写入只读。 */
function recordFrozen(mgr: UndoRedoManager, rel: string, ts: number): void {
  fs.writeFileSync(path.join(ws, rel), 'new', 'utf-8');
  fs.chmodSync(path.join(ws, rel), 0o444);
  mgr.recordChange(SESSION, {
    toolName: 'edit_file',
    filePath: rel,
    beforeContent: 'old',
    afterContent: 'new',
    timestamp: ts,
  });
}

describe('D22046 失败文件终端清单', () => {
  it('① 2 个失败文件 ⇒ 输出含两条文件名与各自原因', async () => {
    const mgr = new UndoRedoManager(ws);
    recordFrozen(mgr, 'alpha.ts', 1);
    recordFrozen(mgr, 'beta.ts', 2);

    const res = await mgr.undo(SESSION, 2);
    const report = renderUndoReport(res, realT);
    const text = report.failureLines.join('\n');

    expect(res.failedFiles.length).toBe(2);
    expect(report.failureLines.length).toBe(1 + 2);
    expect(text).toContain('回退失败');
    expect(text).toContain('alpha.ts');
    expect(text).toContain('beta.ts');
    // 每一条原因都要落地到终端,而不是只有"失败了"三个字
    for (const reason of res.failedReasons) {
      expect(reason.length).toBeGreaterThan(0);
      expect(text).toContain(reason);
    }
  });

  it('② 12 个失败文件 ⇒ 前 10 条 + "另有 2 条",数据面仍完整', async () => {
    const mgr = new UndoRedoManager(ws);
    const files = Array.from({ length: 12 }, (_, i) => `f${String(i).padStart(2, '0')}.txt`);
    for (const [i, rel] of files.entries()) recordFrozen(mgr, rel, i + 1);

    const res = await mgr.undo(SESSION, 12);
    const report = renderUndoReport(res, realT);
    const text = report.failureLines.join('\n');

    // 数据面:12 条一条不少(截断只发生在呈现)
    expect(res.failedFiles.length).toBe(12);
    // 呈现:标题 + 10 条明细 + 1 句尾注
    expect(report.failureLines.length).toBe(1 + UNDO_REPORT_LIST_LIMIT + 1);
    expect(report.failureLines.filter((line) => line.includes(' — ')).length).toBe(
      UNDO_REPORT_LIST_LIMIT,
    );
    expect(text).toContain('另有 2 条');

    const shown = res.failedFiles.slice(0, UNDO_REPORT_LIST_LIMIT);
    const omitted = res.failedFiles.slice(UNDO_REPORT_LIST_LIMIT);
    expect(omitted.length).toBe(2);
    for (const file of shown) expect(text).toContain(file);
    for (const file of omitted) expect(text).not.toContain(file);
  });

  it('③ 全部失败 ⇒ 不打印成功清单(不出现"已回滚")', async () => {
    const mgr = new UndoRedoManager(ws);
    recordFrozen(mgr, 'a.txt', 1);
    recordFrozen(mgr, 'b.txt', 2);

    const res = await mgr.undo(SESSION, 2);
    const report = renderUndoReport(res, realT);
    const all = [report.claim, ...report.succeededLines, ...report.failureLines].join('\n');

    expect(res.undoneSteps).toBe(0);
    expect(res.attemptedSteps).toBe(2);
    expect(report.succeededLines).toEqual([]);
    expect(report.claimIsSuccess).toBe(false);
    expect(report.claim).toContain('暂时不可用');
    expect(all).not.toContain('已回滚');
    // 失败清单照旧逐条点名,全失败也要说清是哪两个文件
    expect(report.failureLines.join('\n')).toContain('a.txt');
    expect(report.failureLines.join('\n')).toContain('b.txt');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
