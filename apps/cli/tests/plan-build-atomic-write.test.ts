// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-47 补覆盖:plan-build 状态 JSON 走 writeFileAtomicSync。
 * 替换失败时已有正式文件逐字节不变;首次创建失败则正式路径不出现。符号链接拒绝另见 plan-build-symlink。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PlanBuildCoordinator } from '../src/modes/plan-build.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import type * as FsModule from 'node:fs';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if ((globalThis as { __ihuiPlan47RenameFail?: boolean }).__ihuiPlan47RenameFail) {
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
  scratch = mkScratch('plan-build-atomic-write-');
});

afterAll(() => {
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[plan-build-atomic-write] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

afterEach(() => {
  (globalThis as { __ihuiPlan47RenameFail?: boolean }).__ihuiPlan47RenameFail = false;
});

function statePath(ws: string): string {
  return path.join(ws, '.ihui-agent', 'modes', 'plan-build-state.json');
}

function tmpLeftovers(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.includes('.tmp-')) : [];
}

describe('DBG-47 plan-build 状态 JSON 原子写', () => {
  it('正常落盘:状态文件是完整 JSON,且不留 tmp', () => {
    const ws = path.join(scratch, 'ok');
    const coordinator = new PlanBuildCoordinator(ws);
    coordinator.enterPlanning();
    const file = statePath(ws);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { mode: string };
    expect(parsed.mode).toBe('plan');
    expect(tmpLeftovers(path.dirname(file))).toEqual([]);
  });

  it('替换失败:已有正式文件逐字节不变,不留下截断 JSON / tmp', () => {
    const ws = path.join(scratch, 'keep');
    const coordinator = new PlanBuildCoordinator(ws);
    coordinator.enterPlanning();
    const file = statePath(ws);
    const before = fs.readFileSync(file);
    JSON.parse(before.toString('utf-8'));

    (globalThis as { __ihuiPlan47RenameFail?: boolean }).__ihuiPlan47RenameFail = true;
    let thrown: unknown = null;
    try {
      coordinator.enterReviewing();
    } catch (err) {
      thrown = err;
    }

    expect((thrown as { code?: string })?.code).toBe('atomic_replace_failed');
    expect((thrown as Error)?.name).toBe('AtomicReplaceFailedError');
    expect(fs.readFileSync(file).equals(before)).toBe(true);
    expect((JSON.parse(before.toString('utf-8')) as { mode: string }).mode).toBe('plan');
    expect(tmpLeftovers(path.dirname(file))).toEqual([]);
  });

  it('首次创建时替换失败:正式路径不出现半截文件', () => {
    const ws = path.join(scratch, 'fresh');
    const file = statePath(ws);
    (globalThis as { __ihuiPlan47RenameFail?: boolean }).__ihuiPlan47RenameFail = true;
    const coordinator = new PlanBuildCoordinator(ws);
    expect(() => coordinator.enterPlanning()).toThrow(/原子替换失败/);
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(path.dirname(file)) ? tmpLeftovers(path.dirname(file)) : []).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
