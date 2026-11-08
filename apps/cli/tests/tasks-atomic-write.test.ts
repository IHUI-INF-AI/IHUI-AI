// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * DBG-45 补覆盖:任务存储原子写落盘夹具(间接走公开 API `addTask` → `saveStore` → `writeFileAtomicSync`)。
 *
 * 证明两件事:
 *   1) 正常落盘后 `~/.ihui/tasks.json` 是完整可解析 JSON,且目录里不残留 tmp 文件;
 *   2) 替换环节失败(rename EPERM)时,旧文件逐字节不变,不产生半截 JSON / tmp 残留。
 *
 * 失败注入:局部 mock `node:fs` 的 renameSync(其余 fs 能力保持真实),用全局开关在单个用例内开合。
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { addTask, getTasksPath } from '../src/commands/tasks.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边

/** 本机能否建**文件**符号链接(Windows 需开发者模式/管理员):不能就如实 skip,不冒充 passed。 */
const CAN_FILE_SYMLINK = (() => {
  const d = mkScratch('tasks-link-cap-');
  try {
    const real = path.join(d, 'real.txt');
    fs.writeFileSync(real, 'x');
    const link = path.join(d, 'link.txt');
    fs.symlinkSync(real, link, 'file');
    return fs.lstatSync(link).isSymbolicLink();
  } catch {
    return false;
  } finally {
    try {
      rmScratch(d);
    } catch {
      // 探针目录清理失败不影响能力判定
    }
  }
})();
const itLink = CAN_FILE_SYMLINK ? it : it.skip;
const LINK_CASE_COUNT = 1;
if (!CAN_FILE_SYMLINK) {
  console.warn(
    `[tasks-atomic-write] 本机不能建文件符号链接 ⇒ 跳过 ${LINK_CASE_COUNT} 条 symlink 用例(skip,不计覆盖);` +
      'lstat-mock 等价用例仍会跑,断言「拒绝写入时旧文件与落点都没被碰」。',
  );
}

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const pathMod = await import('node:path');
  const renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
    if ((globalThis as { __ihuiForceRenameFail?: boolean }).__ihuiForceRenameFail) {
      const err = new Error('EPERM: operation not permitted, rename') as NodeJS.ErrnoException;
      err.code = 'EPERM';
      throw err;
    }
    return actual.renameSync(from, to);
  }) as typeof actual.renameSync;
  // 等价注入:本机建不了文件符号链接时,也能验「拒绝写入时旧文件与落点都没被碰」。
  const lstatSync = ((p: fs.PathLike) => {
    const forced = (globalThis as { __ihuiForceLstatSymlink?: string }).__ihuiForceLstatSymlink;
    if (forced && pathMod.resolve(String(p)) === pathMod.resolve(forced)) {
      return { isSymbolicLink: () => true, isDirectory: () => false } as fs.Stats;
    }
    return actual.lstatSync(p);
  }) as typeof actual.lstatSync;
  return { ...actual, renameSync, lstatSync };
});

let scratch = '';
const prevHome = process.env.HOME;
const prevUserProfile = process.env.USERPROFILE;

beforeAll(() => {
  scratch = mkScratch('tasks-atomic-write-');
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
    console.warn(`[tasks-atomic-write] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

afterEach(() => {
  (globalThis as { __ihuiForceRenameFail?: boolean }).__ihuiForceRenameFail = false;
  delete (globalThis as { __ihuiForceLstatSymlink?: string }).__ihuiForceLstatSymlink;
});

function tmpLeftovers(dir: string): string[] {
  return fs.readdirSync(dir).filter((n) => n.includes('.tmp-'));
}

describe('DBG-45 tasks.json 原子写落盘', () => {
  it('正常落盘:内容是完整可解析 JSON,且不留 tmp 残留', () => {
    const created = addTask('/ws/proj', '原子写夹具任务');
    const p = getTasksPath();
    expect(fs.existsSync(p)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as {
      workspaces: Record<string, { tasks: Array<{ id: string; content: string }> }>;
    };
    const tasks = parsed.workspaces['/ws/proj']?.tasks ?? [];
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.id).toBe(created.id);
    expect(tasks[0]!.content).toBe('原子写夹具任务');

    expect(tmpLeftovers(path.dirname(p))).toEqual([]);
  });

  it('替换失败(rename EPERM):旧文件逐字节不变,不产生半截 JSON / tmp 残留', () => {
    addTask('/ws/proj', '基线任务');
    const p = getTasksPath();
    const before = fs.readFileSync(p);
    JSON.parse(before.toString('utf-8')); // 基线本身必须是完整 JSON

    (globalThis as { __ihuiForceRenameFail?: boolean }).__ihuiForceRenameFail = true;
    let thrown: unknown = null;
    try {
      addTask('/ws/proj', '失败时的新任务');
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

  itLink('目标是文件符号链接 ⇒ SymlinkTargetError,链接与真身均未被改动', () => {
    const p = getTasksPath();
    const dir = path.dirname(p);
    fs.mkdirSync(dir, { recursive: true });
    fs.rmSync(p, { force: true });
    const real = path.join(dir, 'tasks-real.json');
    fs.writeFileSync(real, JSON.stringify({ version: 1, workspaces: {}, nextId: 5 }, null, 2) + '\n');
    const before = fs.readFileSync(real);
    fs.symlinkSync(real, p, 'file');

    let thrown: unknown = null;
    try {
      addTask('/ws/proj', '符号链接目标下的新任务');
    } catch (err) {
      thrown = err;
    }

    expect((thrown as { code?: string })?.code).toBe('symlink_target');
    expect((thrown as Error)?.name).toBe('SymlinkTargetError');
    expect(fs.lstatSync(p).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(real).equals(before)).toBe(true);
    expect(tmpLeftovers(dir)).toEqual([]);
  });

  it('不依赖符号链接权限:lstat 判为 reparse point ⇒ 拒绝,旧文件与落点均未被碰,无 tmp', () => {
    addTask('/ws/proj', '基线任务');
    const p = getTasksPath();
    const before = fs.readFileSync(p);
    (globalThis as { __ihuiForceLstatSymlink?: string }).__ihuiForceLstatSymlink = p;

    let thrown: unknown = null;
    try {
      addTask('/ws/proj', 'lstat 模拟重解析点');
    } catch (err) {
      thrown = err;
    } finally {
      delete (globalThis as { __ihuiForceLstatSymlink?: string }).__ihuiForceLstatSymlink;
    }

    expect((thrown as { code?: string })?.code).toBe('symlink_target');
    expect((thrown as Error)?.name).toBe('SymlinkTargetError');
    expect(fs.lstatSync(p).isSymbolicLink()).toBe(false); // 落点仍是原文件,没有被换成链接或半截
    expect(fs.readFileSync(p).equals(before)).toBe(true);
    expect(tmpLeftovers(path.dirname(p))).toEqual([]);
  });
});
