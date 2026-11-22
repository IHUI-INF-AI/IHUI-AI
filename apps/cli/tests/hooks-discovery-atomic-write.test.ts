// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-46 补覆盖:hooks .state.json 走 writeFileAtomicSync。
 * 替换失败时已有正式文件逐字节不变;首次创建失败则正式路径不出现。符号链接拒绝另见 hooks-discovery-symlink。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HooksDiscovery } from '../src/hooks/discovery.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import type * as FsModule from 'node:fs';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if ((globalThis as { __ihuiHook46RenameFail?: boolean }).__ihuiHook46RenameFail) {
      const err = new Error('EPERM: operation not permitted, rename') as NodeJS.ErrnoException;
      err.code = 'EPERM';
      throw err;
    }
    return actual.renameSync(from, to);
  }) as typeof actual.renameSync;
  return { ...actual, renameSync };
});

let scratch = '';
const prevHome = process.env.HOME;
const prevUserProfile = process.env.USERPROFILE;

beforeAll(() => {
  scratch = mkScratch('hooks-discovery-atomic-write-');
  process.env.HOME = scratch;
  process.env.USERPROFILE = scratch;
});

afterAll(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[hooks-discovery-atomic-write] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

afterEach(() => {
  (globalThis as { __ihuiHook46RenameFail?: boolean }).__ihuiHook46RenameFail = false;
});

function plantHook(ws: string): void {
  const dir = path.join(ws, '.ihui-agent', 'hooks');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'demo.mjs'), "---\nname: demo\n---\nconsole.log('demo hook')\n", 'utf-8');
}

function statePath(ws: string): string {
  return path.join(ws, '.ihui-agent', 'hooks', '.state.json');
}

function tmpLeftovers(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.includes('.tmp-')) : [];
}

describe('DBG-46 hooks discovery 状态 JSON 原子写', () => {
  it('正常落盘:.state.json 是完整 JSON,且不留 tmp', () => {
    const ws = path.join(scratch, 'ok');
    plantHook(ws);
    const discovery = new HooksDiscovery(ws);
    expect(discovery.enable('demo')).toBe(true);
    const file = statePath(ws);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { 'cli:demo': { enabled: boolean } };
    expect(parsed['cli:demo'].enabled).toBe(true);
    expect(tmpLeftovers(path.dirname(file))).toEqual([]);
  });

  it('替换失败:已有正式文件逐字节不变,不留下截断 JSON / tmp', () => {
    const ws = path.join(scratch, 'keep');
    plantHook(ws);
    const discovery = new HooksDiscovery(ws);
    expect(discovery.enable('demo')).toBe(true);
    const file = statePath(ws);
    const before = fs.readFileSync(file);
    JSON.parse(before.toString('utf-8'));

    (globalThis as { __ihuiHook46RenameFail?: boolean }).__ihuiHook46RenameFail = true;
    let thrown: unknown = null;
    try {
      discovery.disable('demo');
    } catch (err) {
      thrown = err;
    }

    expect((thrown as { code?: string })?.code).toBe('atomic_replace_failed');
    expect((thrown as Error)?.name).toBe('AtomicReplaceFailedError');
    expect(fs.readFileSync(file).equals(before)).toBe(true);
    expect(tmpLeftovers(path.dirname(file))).toEqual([]);
  });

  it('首次创建时替换失败:正式路径不出现半截文件', () => {
    const ws = path.join(scratch, 'fresh');
    plantHook(ws);
    const file = statePath(ws);
    (globalThis as { __ihuiHook46RenameFail?: boolean }).__ihuiHook46RenameFail = true;
    const discovery = new HooksDiscovery(ws);
    expect(() => discovery.enable('demo')).toThrow(/原子替换失败/);
    expect(fs.existsSync(file)).toBe(false);
    expect(tmpLeftovers(path.dirname(file))).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
