// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * DBG-44 补覆盖:soul 画像原子写落盘夹具(间接走公开 API `SoulMemory.addPreference` → `save` → `writeFileAtomicSync`)。
 *
 * 证明两件事:
 *   1) 正常落盘后 `<workspace>/.ihui-agent/memory/soul.json` 是完整可解析 JSON,且目录里不残留 tmp 文件;
 *   2) 替换环节失败(rename EPERM)时,旧文件逐字节不变,不产生半截 JSON / tmp 残留。
 *
 * 失败注入:局部 mock `node:fs` 的 renameSync(其余 fs 能力保持真实),用全局开关在单个用例内开合。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SoulMemory } from '../src/memory/soul.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if ((globalThis as { __ihuiForceRenameFail?: boolean }).__ihuiForceRenameFail) {
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
  scratch = mkScratch('soul-atomic-write-');
});

afterAll(() => {
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[soul-atomic-write] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

afterEach(() => {
  (globalThis as { __ihuiForceRenameFail?: boolean }).__ihuiForceRenameFail = false;
});

function soulPath(ws: string): string {
  return path.join(ws, '.ihui-agent', 'memory', 'soul.json');
}

function tmpLeftovers(dir: string): string[] {
  return fs.readdirSync(dir).filter((n) => n.includes('.tmp-'));
}

describe('DBG-44 soul.json 原子写落盘', () => {
  it('正常落盘:内容是完整可解析 JSON,且不留 tmp 残留', () => {
    const ws = path.join(scratch, 'ws-normal');
    const soul = new SoulMemory(ws);
    soul.addPreference('偏好A');

    const p = soulPath(ws);
    expect(fs.existsSync(p)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as { preferences: string[] };
    expect(parsed.preferences).toEqual(['偏好A']);

    expect(tmpLeftovers(path.dirname(p))).toEqual([]);
  });

  it('替换失败(rename EPERM):旧文件逐字节不变,不产生半截 JSON / tmp 残留', () => {
    const ws = path.join(scratch, 'ws-fail');
    const soul = new SoulMemory(ws);
    soul.addPreference('基线偏好');

    const p = soulPath(ws);
    const before = fs.readFileSync(p);
    JSON.parse(before.toString('utf-8')); // 基线本身必须是完整 JSON

    (globalThis as { __ihuiForceRenameFail?: boolean }).__ihuiForceRenameFail = true;
    let thrown: unknown = null;
    try {
      soul.addPreference('失败时的新偏好');
    } catch (err) {
      thrown = err;
    }
    (globalThis as { __ihuiForceRenameFail?: boolean }).__ihuiForceRenameFail = false;

    expect(thrown).toBeTruthy();
    expect((thrown as { code?: string })?.code).toBe('atomic_replace_failed');
    expect((thrown as Error)?.name).toBe('AtomicReplaceFailedError');
    expect(fs.readFileSync(p).equals(before)).toBe(true);
    expect(tmpLeftovers(path.dirname(p))).toEqual([]);
  });
});
