// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-42 补覆盖:run manifest 的两份 JSON 都不得在替换失败时留下截断的正式文件。
 *
 * manifest.json 走 writeFileAtomicSync;latest.json 走同目录 `<name>.<pid>.tmp` + rename。
 * 失败注入只改 renameSync:目标是 latest.json 时,或全部 rename 都失败。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeRunManifest } from '../src/runs/manifest.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import type * as FsModule from 'node:fs';

type ManifestFailMode = 'all' | 'latest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  const pathMod = await import('node:path');
  const renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    const mode = (globalThis as { __ihuiMan42RenameFail?: ManifestFailMode }).__ihuiMan42RenameFail;
    const dest = pathMod.basename(String(to));
    if (mode === 'all' || (mode === 'latest' && dest === 'latest.json')) {
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
  scratch = mkScratch('run-manifest-atomic-write-');
});

afterAll(() => {
  try {
    rmScratch(scratch);
  } catch (err) {
    console.warn(`[run-manifest-atomic-write] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

afterEach(() => {
  delete (globalThis as { __ihuiMan42RenameFail?: ManifestFailMode }).__ihuiMan42RenameFail;
});

function makeRepo(root: string): string {
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
  const deep = path.join(root, 'apps', 'cli', 'src');
  fs.mkdirSync(deep, { recursive: true });
  return deep;
}

function runsDir(root: string): string {
  return path.join(root, '.ihui-agent', 'state', 'runs');
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const child = path.join(dir, name);
    if (fs.lstatSync(child).isDirectory()) out.push(...listFiles(child));
    else out.push(child);
  }
  return out;
}

function tmpLeftovers(dir: string): string[] {
  return listFiles(dir).filter((file) => path.basename(file).includes('.tmp-'));
}

describe('DBG-42 run manifest JSON 原子写', () => {
  it('正常落盘:manifest.json 与 latest.json 都可解析,且不留 tmp', () => {
    const root = path.join(scratch, 'ok');
    const deep = makeRepo(root);
    const out = writeRunManifest({ cwd: deep, cliVersion: '1.2.3', argv: ['agent'] });
    expect(out).not.toBeNull();
    const manifestPath = path.join(out!.dir, 'manifest.json');
    const latestPath = path.join(runsDir(root), 'latest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { runId: string };
    const latest = JSON.parse(fs.readFileSync(latestPath, 'utf-8')) as { runId: string };
    expect(manifest.runId).toBe(out!.manifest.runId);
    expect(latest.runId).toBe(out!.manifest.runId);
    expect(tmpLeftovers(runsDir(root))).toEqual([]);
    const pidTmp = fs.readdirSync(runsDir(root)).filter((name) => name.startsWith('latest.json.') && name.endsWith('.tmp'));
    expect(pidTmp).toEqual([]);
  });

  it('latest 的 rename 失败:正式 latest.json 逐字节不变,manifest 仍是完整 JSON', () => {
    const root = path.join(scratch, 'latest-fail');
    const deep = makeRepo(root);
    const dir = runsDir(root);
    fs.mkdirSync(dir, { recursive: true });
    const latestPath = path.join(dir, 'latest.json');
    const seeded = `${JSON.stringify({ runId: 'seed', dir: 'seed-dir', startedAt: '2026-01-01T00:00:00.000Z' }, null, 2)}\n`;
    fs.writeFileSync(latestPath, seeded);
    const before = fs.readFileSync(latestPath);

    (globalThis as { __ihuiMan42RenameFail?: ManifestFailMode }).__ihuiMan42RenameFail = 'latest';
    expect(writeRunManifest({ cwd: deep, cliVersion: '9.9.9' })).toBeNull();

    expect(fs.readFileSync(latestPath).equals(before)).toBe(true);
    expect((JSON.parse(before.toString('utf-8')) as { runId: string }).runId).toBe('seed');
    const manifests = listFiles(dir).filter((file) => path.basename(file) === 'manifest.json');
    expect(manifests).toHaveLength(1);
    const saved = JSON.parse(fs.readFileSync(manifests[0]!, 'utf-8')) as { runId: string; cliVersion: string };
    expect(saved.cliVersion).toBe('9.9.9');
    expect(typeof saved.runId).toBe('string');
    expect(tmpLeftovers(dir)).toEqual([]);
  });

  it('全部 rename 失败:不产生截断的 manifest.json,已有 latest.json 逐字节不变', () => {
    const root = path.join(scratch, 'all-fail');
    const deep = makeRepo(root);
    const dir = runsDir(root);
    fs.mkdirSync(dir, { recursive: true });
    const latestPath = path.join(dir, 'latest.json');
    fs.writeFileSync(latestPath, '{"runId":"kept"}\n');
    const before = fs.readFileSync(latestPath);

    (globalThis as { __ihuiMan42RenameFail?: ManifestFailMode }).__ihuiMan42RenameFail = 'all';
    expect(writeRunManifest({ cwd: deep, cliVersion: '9.9.9' })).toBeNull();

    expect(fs.readFileSync(latestPath).equals(before)).toBe(true);
    const manifests = listFiles(dir).filter((file) => path.basename(file) === 'manifest.json');
    expect(manifests).toEqual([]);
    expect(tmpLeftovers(dir)).toEqual([]);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
