// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-131 回归钉:`plan init` 必须原子写,`--force` 覆盖前留 `<file>.bak`(旧 .bak 被覆盖)。
 * 替换失败时既有 plan 逐字节不变(修前裸 writeFileSync 会当场截断)。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';

import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import type * as FsModule from 'node:fs';

/** 与既有 plan-build-atomic-write 同一姿势:只替换 renameSync,其余 fs 原样透传。 */
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if ((globalThis as { __f131RenameFail?: boolean }).__f131RenameFail) {
      const err = new Error('EPERM: operation not permitted, rename') as NodeJS.ErrnoException;
      err.code = 'EPERM';
      throw err;
    }
    return actual.renameSync(from, to);
  }) as typeof actual.renameSync;
  return { ...actual, renameSync };
});

import { registerPlanCommand } from '../src/commands/plan.js';

let scratch = '';
let originalCwd = '';
let consoleSpies: Array<{ mockRestore: () => void }> = [];

beforeAll(() => {
  scratch = mkScratch('f-131-plan-atomic-');
  originalCwd = process.cwd();
});

afterAll(() => {
  process.chdir(originalCwd);
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[f-131] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

beforeEach(() => {
  process.exitCode = undefined;
  (globalThis as { __f131RenameFail?: boolean }).__f131RenameFail = false;
  consoleSpies = [
    vi.spyOn(console, 'info').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
    vi.spyOn(console, 'error').mockImplementation(() => {}),
  ];
});

afterEach(() => {
  for (const spy of consoleSpies) spy.mockRestore();
  consoleSpies = [];
  (globalThis as { __f131RenameFail?: boolean }).__f131RenameFail = false;
  process.exitCode = undefined;
});

function runPlan(args: string[]): void {
  const program = new Command();
  registerPlanCommand(program);
  program.parse(['plan', ...args], { from: 'user' });
}

function workspace(name: string): { dir: string; file: string } {
  const dir = path.join(scratch, name);
  fs.mkdirSync(dir, { recursive: true });
  process.chdir(dir);
  return { dir, file: path.join(dir, '.ihui', 'plans', 'demo.md') };
}

function tmpLeftovers(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.includes('.tmp-')) : [];
}

describe('F-131 plan init 原子写 + .bak', () => {
  it('--force 覆盖前把原内容写进 <file>.bak,并覆盖旧 .bak', () => {
    const { file } = workspace('backup');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'OLD-PLAN', 'utf8');
    fs.writeFileSync(`${file}.bak`, 'STALE-BACKUP', 'utf8');

    runPlan(['init', 'demo', '--force']);

    expect(process.exitCode).toBeUndefined();
    expect(fs.readFileSync(`${file}.bak`, 'utf8')).toBe('OLD-PLAN');
    expect(fs.readFileSync(file, 'utf8')).toContain('# Plan: demo');
    expect(tmpLeftovers(path.dirname(file))).toEqual([]);
  });

  it('rename 失败时既有 plan 逐字节不变,且不留 tmp', () => {
    const { file } = workspace('rename-fail');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'KEEP-ME', 'utf8');

    (globalThis as { __f131RenameFail?: boolean }).__f131RenameFail = true;
    runPlan(['init', 'demo', '--force']);

    expect(process.exitCode).toBe(1);
    expect(fs.readFileSync(file, 'utf8')).toBe('KEEP-ME');
    expect(tmpLeftovers(path.dirname(file))).toEqual([]);
  });

  it('未加 --force 时不覆盖、不产出 .bak', () => {
    const { file } = workspace('no-force');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'ORIGINAL', 'utf8');

    runPlan(['init', 'demo']);

    expect(process.exitCode).toBe(1);
    expect(fs.readFileSync(file, 'utf8')).toBe('ORIGINAL');
    expect(fs.existsSync(`${file}.bak`)).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
