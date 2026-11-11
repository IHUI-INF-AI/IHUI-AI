// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-48 补覆盖:更新检查缓存走 writeFileAtomicSync,写失败被吞掉但正式文件不得被截断。
 * 符号链接留痕另见 updater-cache-swallow。CACHE_FILE 在模块加载时取 homedir,故先改环境再 import。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import type * as FsModule from 'node:fs';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if ((globalThis as { __ihuiUpd48RenameFail?: boolean }).__ihuiUpd48RenameFail) {
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
const prevNoUpdateCheck = process.env.IHUI_NO_UPDATE_CHECK;

beforeEach(() => {
  scratch = mkScratch('updater-atomic-write-');
  process.env.HOME = scratch;
  process.env.USERPROFILE = scratch;
  delete process.env.IHUI_NO_UPDATE_CHECK;
  (globalThis as { __ihuiUpd48RenameFail?: boolean }).__ihuiUpd48RenameFail = false;
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  (globalThis as { __ihuiUpd48RenameFail?: boolean }).__ihuiUpd48RenameFail = false;
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  if (prevNoUpdateCheck === undefined) delete process.env.IHUI_NO_UPDATE_CHECK;
  else process.env.IHUI_NO_UPDATE_CHECK = prevNoUpdateCheck;
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[updater-atomic-write] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

function cachePath(): string {
  return path.join(scratch, '.ihui', '.update-check.json');
}

function tmpLeftovers(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.includes('.tmp-')) : [];
}

function stubRegistry(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ 'dist-tags': { latest: '9.9.9' } }),
    })),
  );
}

describe('DBG-48 updater 缓存 JSON 原子写', () => {
  it('正常落盘:缓存是完整 JSON,且不留 tmp', async () => {
    stubRegistry();
    const updater = await import('../src/updater.js');
    const result = await updater.checkForUpdates('ihui-cli', {
      forceRefresh: true,
      registryUrl: 'https://registry.example.invalid',
    });
    expect(result.latestVersion).toBe('9.9.9');
    const file = cachePath();
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as { latestVersion: string };
    expect(parsed.latestVersion).toBe('9.9.9');
    expect(tmpLeftovers(path.dirname(file))).toEqual([]);
  });

  it('替换失败被吞掉:已有正式文件逐字节不变,不留下截断 JSON / tmp', async () => {
    const dir = path.join(scratch, '.ihui');
    fs.mkdirSync(dir, { recursive: true });
    const file = cachePath();
    fs.writeFileSync(file, JSON.stringify({ checkedAt: 1, latestVersion: '0.0.1' }));
    const before = fs.readFileSync(file);
    JSON.parse(before.toString('utf-8'));

    (globalThis as { __ihuiUpd48RenameFail?: boolean }).__ihuiUpd48RenameFail = true;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubRegistry();
    const updater = await import('../src/updater.js');
    await expect(
      updater.checkForUpdates('ihui-cli', {
        forceRefresh: true,
        registryUrl: 'https://registry.example.invalid',
      }),
    ).resolves.toMatchObject({ latestVersion: '9.9.9' });

    const lines = warnSpy.mock.calls.flat().map(String).join('\n');
    expect(lines).toContain('atomic_replace_failed');
    expect(lines).toContain(file);
    expect(fs.readFileSync(file).equals(before)).toBe(true);
    expect(tmpLeftovers(dir)).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
