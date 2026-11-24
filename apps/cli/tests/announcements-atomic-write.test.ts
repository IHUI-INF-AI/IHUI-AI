// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-41 补覆盖:公告缓存与已读名单的原子写。
 *
 * 证明两件事:
 *   1) 正常落盘后目标是完整可解析 JSON,目录里不残留 tmp;
 *   2) 替换环节失败(rename EPERM,当作崩溃发生在正式文件被换上之前)时,
 *      已有正式文件逐字节不变;首次创建则正式路径根本不出现。saveCache / markSeen 吞掉错误。
 *
 * 失败注入:局部 mock `node:fs` 的 renameSync,其余 fs 能力保持真实。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { markSeen, saveCache, type AnnouncementBrief } from '../src/announcements/index.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import type * as FsModule from 'node:fs';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if ((globalThis as { __ihuiAnn41RenameFail?: boolean }).__ihuiAnn41RenameFail) {
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
  scratch = mkScratch('announcements-atomic-write-');
});

afterAll(() => {
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[announcements-atomic-write] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

afterEach(() => {
  (globalThis as { __ihuiAnn41RenameFail?: boolean }).__ihuiAnn41RenameFail = false;
});

const brief: AnnouncementBrief = { id: 'a1', title: '原子写夹具' };

function tmpLeftovers(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.includes('.tmp-')) : [];
}

function armFail(): void {
  (globalThis as { __ihuiAnn41RenameFail?: boolean }).__ihuiAnn41RenameFail = true;
}

describe('DBG-41 announcements JSON 原子写', () => {
  it('正常落盘:缓存与已读都是完整 JSON,且不留 tmp', () => {
    const cachePath = path.join(scratch, 'ok', 'announcements.json');
    const seenPath = path.join(scratch, 'ok', 'seen-announcements.json');
    saveCache(cachePath, [brief]);
    markSeen(seenPath, 'a1');

    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as { list: Array<{ id: string }> };
    expect(cache.list.map((item) => item.id)).toEqual(['a1']);
    const seen = JSON.parse(fs.readFileSync(seenPath, 'utf-8')) as { seenIds: string[] };
    expect(seen.seenIds).toEqual(['a1']);
    expect(tmpLeftovers(path.dirname(cachePath))).toEqual([]);
  });

  it('替换失败:已有正式文件逐字节不变,不留下截断 JSON', () => {
    const cachePath = path.join(scratch, 'keep', 'announcements.json');
    const seenPath = path.join(scratch, 'keep', 'seen-announcements.json');
    saveCache(cachePath, [brief]);
    markSeen(seenPath, 'a1');
    const cacheBefore = fs.readFileSync(cachePath);
    const seenBefore = fs.readFileSync(seenPath);
    JSON.parse(cacheBefore.toString('utf-8'));
    JSON.parse(seenBefore.toString('utf-8'));

    armFail();
    expect(() => saveCache(cachePath, [{ id: 'a2', title: '不该落盘' }])).not.toThrow();
    expect(() => markSeen(seenPath, 'a2')).not.toThrow();

    expect(fs.readFileSync(cachePath).equals(cacheBefore)).toBe(true);
    expect(fs.readFileSync(seenPath).equals(seenBefore)).toBe(true);
    expect(tmpLeftovers(path.dirname(cachePath))).toEqual([]);
  });

  it('首次创建时替换失败:正式路径不出现半截文件', () => {
    const dir = path.join(scratch, 'fresh');
    const cachePath = path.join(dir, 'announcements.json');
    const seenPath = path.join(dir, 'seen-announcements.json');
    armFail();
    saveCache(cachePath, [brief]);
    markSeen(seenPath, 'a1');
    expect(fs.existsSync(cachePath)).toBe(false);
    expect(fs.existsSync(seenPath)).toBe(false);
    expect(tmpLeftovers(dir)).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
