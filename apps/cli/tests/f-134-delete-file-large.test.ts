// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-134 回归:`delete_file` 把整份内容写进撤销历史。
 *
 * 判据:
 *   ① 超过 DELETE_FILE_MAX_UNDO_BYTES 的文件 ⇒ 不拍整文检查点、不记 hunk,
 *      返回文本明确「大文件：未记录撤销内容」并给出流式 sha256;
 *   ② 前 64KB 含 NUL 的二进制 ⇒ 不做文本撤销记录,返回文本明确「二进制文件」;
 *   ③ 小文本文件保持原行为(检查点 + hunk 记录照旧)。
 */
// 夹具唯一落点(AGENTS §26):不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import {
  createDeleteFileTool,
  DELETE_FILE_MAX_UNDO_BYTES,
  type EditToolContext,
} from '../src/tools/file-edit.js';
import { HunkTracker } from '../src/checkpoints/hunk-tracker.js';
import type { CheckpointManager } from '../src/checkpoints/index.js';

let workDir = '';
let origHooksConfig: string | undefined;

beforeEach(() => {
  workDir = mkScratch('cli-f134-');
  origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
  process.env.IHUI_HOOKS_CONFIG = path.join(workDir, 'no-hooks.json');
});

afterEach(() => {
  if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
  rmScratch(workDir);
  workDir = '';
});

function makeTool(): {
  tool: ReturnType<typeof createDeleteFileTool>;
  ctx: EditToolContext;
  tracker: HunkTracker;
  snapshotSync: ReturnType<typeof vi.fn>;
} {
  const tracker = new HunkTracker({ cooldownMs: 0 });
  const snapshotSync = vi.fn();
  const ctx = {
    workspacePath: workDir,
    hunkTracker: tracker,
    checkpoints: { snapshotSync } as unknown as CheckpointManager,
  } satisfies EditToolContext;
  return { tool: createDeleteFileTool(ctx), ctx, tracker, snapshotSync };
}

describe('F-134 delete_file 大文件/二进制撤销', () => {
  it('超过阈值的大文件:删除照常,只记路径/大小/哈希,不拍整文快照、不记 hunk', async () => {
    const abs = path.join(workDir, 'big.bin.log');
    const content = Buffer.alloc(DELETE_FILE_MAX_UNDO_BYTES + 1024, 0x61); // 'a' × (4MB+1KB)
    fs.writeFileSync(abs, content);
    const expectedSha = crypto.createHash('sha256').update(content).digest('hex');

    const { tool, ctx, tracker, snapshotSync } = makeTool();
    const r = await tool.execute({ path: 'big.bin.log' }, ctx);

    expect(r.success).toBe(true);
    expect(fs.existsSync(abs)).toBe(false);
    expect(r.output).toContain('已删除 big.bin.log');
    expect(r.output).toContain('大文件：未记录撤销内容');
    expect(r.output).toContain(`${content.length} 字节`);
    expect(r.output).toContain(`sha256=${expectedSha}`);
    expect(snapshotSync).not.toHaveBeenCalled();
    expect(tracker.getHistory(abs)).toHaveLength(0);
  });

  it('二进制文件(前 64KB 含 NUL):不做文本撤销记录,删除照常', async () => {
    const abs = path.join(workDir, 'blob.dat');
    const content = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(100, 0), Buffer.from('tail')]);
    fs.writeFileSync(abs, content);
    const expectedSha = crypto.createHash('sha256').update(content).digest('hex');

    const { tool, ctx, tracker, snapshotSync } = makeTool();
    const r = await tool.execute({ path: 'blob.dat' }, ctx);

    expect(r.success).toBe(true);
    expect(fs.existsSync(abs)).toBe(false);
    expect(r.output).toContain('二进制文件：未记录文本撤销内容');
    expect(r.output).toContain(`sha256=${expectedSha}`);
    expect(snapshotSync).not.toHaveBeenCalled();
    expect(tracker.getHistory(abs)).toHaveLength(0);
  });

  it('小文本文件保持原行为:拍检查点并记录 hunk', async () => {
    const abs = path.join(workDir, 'small.txt');
    fs.writeFileSync(abs, 'hello\nworld\n');

    const { tool, ctx, tracker, snapshotSync } = makeTool();
    const r = await tool.execute({ path: 'small.txt' }, ctx);

    expect(r.success).toBe(true);
    expect(r.output).toBe('已删除 small.txt');
    expect(snapshotSync).toHaveBeenCalledTimes(1);
    expect(snapshotSync).toHaveBeenCalledWith([abs], 'auto_pre_delete_file');
    const hunks = tracker.getHistory(abs);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.endLine).toBe('hello\nworld\n'.split('\n').length);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
