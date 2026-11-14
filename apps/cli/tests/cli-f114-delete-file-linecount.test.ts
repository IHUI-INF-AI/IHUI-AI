// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-114 回归:`delete_file` 为算行数整份读文件。
 *
 * 缺陷形态:`delete_file` 用 `fs.readFileSync(abs, 'utf-8')` 只为拿
 * `split('\n').length` 与 hunk 预览 —— 删除数 GB 日志/二进制时整份进内存,
 * 二进制还会被 utf-8 解码。
 *
 * 判据(两条必须同时成立,否则只证明"行数对了"或只证明"没读大文件"):
 *   ① 大文件行数与 `split('\n').length` 语义逐字一致(经 hunkTracker 的 endLine 观测);
 *   ② 读取是分块进行的:没有以目标路径调用 `readFileSync`,且单次 `readSync` 长度有界。
 */
// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()(活进程的 TEMP 可能仍钉在 C 盘)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as FsModule from 'node:fs';
import { createDeleteFileTool } from '../src/tools/file-edit.js';
import type { EditToolContext } from '../src/tools/file-edit.js';
import { HunkTracker } from '../src/checkpoints/hunk-tracker.js';

/** 分块读取探针(vi.mock 工厂会被提升 ⇒ 状态必须先于模块图存在) */
const probe = vi.hoisted(() => ({
  /** 以目标路径调用 readFileSync 的记录(用于证明"没整份读") */
  readFileSyncPaths: [] as string[],
  /** readSync 调用次数(>1 即分块) */
  readSyncChunks: 0,
  /** 单次 readSync 请求的最大字节数 */
  maxReadLength: 0,
  /** 注入 open 失败的目标路径(null = 不注入) */
  failOpenPath: null as string | null,
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const readFileSync = ((...args: Parameters<typeof actual.readFileSync>) => {
    probe.readFileSyncPaths.push(String(args[0]));
    return actual.readFileSync(...args);
  }) as typeof actual.readFileSync;
  const readSync = ((...args: Parameters<typeof actual.readSync>) => {
    probe.readSyncChunks += 1;
    probe.maxReadLength = Math.max(probe.maxReadLength, args[3]);
    return actual.readSync(...args);
  }) as typeof actual.readSync;
  const openSync = ((...args: Parameters<typeof actual.openSync>) => {
    if (probe.failOpenPath !== null && String(args[0]) === probe.failOpenPath) {
      const err = new Error('EACCES: permission denied, open') as NodeJS.ErrnoException;
      err.code = 'EACCES';
      throw err;
    }
    return actual.openSync(...args);
  }) as typeof actual.openSync;
  return { ...actual, readFileSync, readSync, openSync };
});

const CHUNK_CEILING = 64 * 1024;

let workDir = '';
let origHooksConfig: string | undefined;

beforeEach(() => {
  workDir = mkScratch('cli-f114-');
  origHooksConfig = process.env.IHUI_HOOKS_CONFIG;
  process.env.IHUI_HOOKS_CONFIG = path.join(workDir, 'no-hooks.json');
  probe.readFileSyncPaths = [];
  probe.readSyncChunks = 0;
  probe.maxReadLength = 0;
  probe.failOpenPath = null;
});

afterEach(() => {
  if (origHooksConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origHooksConfig;
  rmScratch(workDir);
  workDir = '';
});

function makeTool(): { tool: ReturnType<typeof createDeleteFileTool>; ctx: EditToolContext; tracker: HunkTracker } {
  const tracker = new HunkTracker({ cooldownMs: 0 });
  const ctx: EditToolContext = { workspacePath: workDir, hunkTracker: tracker };
  return { tool: createDeleteFileTool(ctx), ctx, tracker };
}

describe('F-114 delete_file 行数统计', () => {
  it('大文件:行数正确、删除行为不变,且不整份 readFileSync', async () => {
    const lineCount = 150_000;
    const content = `${Array.from({ length: lineCount }, (_, i) => `line-${i}`).join('\n')}\n`;
    const abs = path.join(workDir, 'big.log');
    fs.writeFileSync(abs, content);
    // 分块读取的前提:文件显著大于单块
    expect(fs.statSync(abs).size).toBeGreaterThan(CHUNK_CEILING * 2);

    const { tool, ctx, tracker } = makeTool();
    probe.readFileSyncPaths = [];
    probe.readSyncChunks = 0;
    probe.maxReadLength = 0;

    const r = await tool.execute({ path: 'big.log' }, ctx);

    expect(r.success).toBe(true);
    expect(r.output).toContain('已删除 big.log');
    expect(fs.existsSync(abs)).toBe(false);
    // ② 分块读取:没有整份读目标文件,单次读取有界
    expect(probe.readFileSyncPaths).not.toContain(abs);
    expect(probe.readSyncChunks).toBeGreaterThanOrEqual(2);
    expect(probe.maxReadLength).toBeLessThanOrEqual(CHUNK_CEILING);
    // ① 行数语义与 split('\n').length 一致
    const hunks = tracker.getHistory(abs);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.startLine).toBe(1);
    expect(hunks[0]?.endLine).toBe(content.split('\n').length);
    // 预览被截断,不随文件增长
    expect(hunks[0]?.content).toBe(content.slice(0, 200));
  });

  it.each([
    ['空文件', ''],
    ['无末尾换行', 'a\nb'],
    ['末尾换行', 'x\n'],
    ['多字节内容', '中文\n行二'],
  ])('%s:行数与 split 语义一致', async (_label, content) => {
    const abs = path.join(workDir, 'small.txt');
    fs.writeFileSync(abs, content);
    const { tool, ctx, tracker } = makeTool();

    const r = await tool.execute({ path: 'small.txt' }, ctx);

    expect(r.success).toBe(true);
    const hunks = tracker.getHistory(abs);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.endLine).toBe(content.split('\n').length);
    expect(hunks[0]?.content).toBe(content);
  });

  it('读取失败:错误语义不变,且原文件不被删除', async () => {
    const abs = path.join(workDir, 'keep.txt');
    fs.writeFileSync(abs, 'keep me');
    const { tool, ctx, tracker } = makeTool();
    probe.failOpenPath = abs;

    const r = await tool.execute({ path: 'keep.txt' }, ctx);

    expect(r.success).toBe(false);
    expect(r.error).toBe('文件读不到,删除没有执行: keep.txt');
    expect(fs.existsSync(abs)).toBe(true);
    expect(tracker.getHistory(abs)).toHaveLength(0);
  });
});
