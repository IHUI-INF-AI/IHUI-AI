// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-49 补覆盖:CoW 能力缓存 JSON 走 writeFileAtomicSync。
 * 替换失败被吞掉,但已有正式文件逐字节不变,不留 tmp。符号链接留痕另见 worktree-cow-cache-swallow。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectCowKind, resetCowCache, VALID_COW_KINDS } from '../src/worktree.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import type * as FsModule from 'node:fs';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if ((globalThis as { __ihuiWt49RenameFail?: boolean }).__ihuiWt49RenameFail) {
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
  scratch = mkScratch('worktree-cow-atomic-write-');
});

afterAll(() => {
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[worktree-cow-atomic-write] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

afterEach(() => {
  (globalThis as { __ihuiWt49RenameFail?: boolean }).__ihuiWt49RenameFail = false;
  resetCowCache();
});

function tmpLeftovers(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.includes('.tmp-')) : [];
}

describe('DBG-49 worktree CoW 缓存 JSON 原子写', () => {
  it('正常落盘:缓存是完整 JSON,kind 落在合法档,且不留 tmp', () => {
    const dir = path.join(scratch, 'ok');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'cow-capability.json');
    resetCowCache();
    const kind = detectCowKind(dir, file);
    expect(VALID_COW_KINDS).toContain(kind);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { kind: string; ts: number };
    expect(parsed.kind).toBe(kind);
    expect(typeof parsed.ts).toBe('number');
    expect(tmpLeftovers(dir)).toEqual([]);
  });

  it('替换失败被吞掉:已有正式文件逐字节不变,不留下截断 JSON / tmp', () => {
    const dir = path.join(scratch, 'keep');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'cow-capability.json');
    const seeded = JSON.stringify({ kind: 'bogus', ts: 1 });
    fs.writeFileSync(file, seeded);
    const before = fs.readFileSync(file);

    (globalThis as { __ihuiWt49RenameFail?: boolean }).__ihuiWt49RenameFail = true;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resetCowCache();
    const kind = detectCowKind(dir, file);

    expect(VALID_COW_KINDS).toContain(kind);
    const lines = warnSpy.mock.calls.flat().map(String).join('\n');
    expect(lines).toContain('atomic_replace_failed');
    expect(lines).toContain(file);
    expect(fs.readFileSync(file).equals(before)).toBe(true);
    expect((JSON.parse(before.toString('utf-8')) as { kind: string }).kind).toBe('bogus');
    expect(tmpLeftovers(dir)).toEqual([]);
    warnSpy.mockRestore();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
