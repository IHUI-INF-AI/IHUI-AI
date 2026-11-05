// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * delete 轴**消费点**接线锁(goal-b49 S5,2026-11-05)。
 *
 * 判据单源在 `src/sandbox/file-access-policy.ts`(纯函数 + 规则表另有 16 例);本件一律 import,
 * 不抄第二份规则表(§0.6)。射程只到消费点这四件事:
 *  ① 合法隔离区照常回收 ⇒ 接线不得把自己变成恒拦门(§12e);
 *  ② 命中拒绝族 ⇒ 拒绝排在**一切删除动作之前**(node:fs 桩计数定"没调用 rm 原语",git 注册表仍在定"没走到注销腿");
 *  ③ advisory(默认档,出声放行)与 strict(`IHUI_FILE_ACL_STRICT=1`,升拦)两档各自行为;
 *  ④ 未判定态 ⇒ 守护面清单读不到时既不冒绿(凭据族照旧拦)也不冒红(合法回收照做)。
 * 另两枚定性锁:⑤ `WorktreeManager.remove` 的裁决必须排在删除动作之前(源码次序);
 *  ⑥ `git.ts` 的临时索引清理是内部 scratch,不得被任何条件化(条件化 ⇒ 失败路径把文件留在 `.git/`)。
 * 探针的**非空洞性**由 ③ 的正向对照保证:同一支 `fs.renameSync` 计数在放行档必须 > 0,否则 ② 的零计数只是没接上。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
// 类型面走 import type(门 99 consistent-type-imports;桩 node:fs 的泛型参数用它)
import type * as FsModule from 'node:fs';
import { WorktreeManager, exitWorktreeTool } from '../src/tools/worktree.js';
import { clearGuardRulesCache, loadGuardFaceRules } from '../src/sandbox/file-access-policy.js';
import { getDeleteTrashDir } from '../src/tools/file-batch-edit.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §15b/§26 唯一落点(禁 os.tmpdir/裸 mkdtemp,不在仓库树内造 git 夹具=门 208),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

// 全文件跑真实 git 子进程(建 worktree 是重动作),与 tests/worktree.test.ts 同一档超时
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * 删除原语的注入式探针。`vi.spyOn(fs, 'rmSync')` 在本机不可用(实测 `Module namespace is not
 * configurable in ESM`),故按本仓既有写法(桩 node:child_process 同法)桩 node:fs:**记账后透传**。
 */
const probe = vi.hoisted(() => ({ rmSyncCalls: 0, renameSyncCalls: 0 }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  return {
    ...actual,
    rmSync: (...args: Parameters<typeof actual.rmSync>): void => {
      probe.rmSyncCalls += 1;
      actual.rmSync(...args);
    },
    renameSync: (...args: Parameters<typeof actual.renameSync>): void => {
      probe.renameSyncCalls += 1;
      actual.renameSync(...args);
    },
  };
});

/** 会话级工具的最小执行面:exit_worktree 只读 workspacePath(与 tests/worktree-session-tools.test.ts 同形) */
type ExecTool = {
  execute: (
    args: Record<string, unknown>,
    ctx: { workspacePath: string },
  ) => Promise<{ success: boolean; output: string; error?: string }>;
};

let repo = '';
let stderrChunks = '';
let origStrict: string | undefined;
let origHooks: string | undefined;

function gitOk(args: string[], dir: string): string {
  const r = spawnSync('git', args, {
    cwd: dir,
    encoding: 'utf-8',
    // 不吃的子进程必须给 stdio(§12g):本机缺省 stdio 报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} 失败: ${r.stderr ?? r.error ?? `status=${r.status}`}`);
  }
  return (r.stdout ?? '').trim();
}

function makeRepo(): string {
  const dir = mkScratch('s5-delete-axis-');
  gitOk(['init', '-q'], dir);
  gitOk(['config', 'user.email', 'test@ihui.local'], dir);
  gitOk(['config', 'user.name', 'Test'], dir);
  gitOk(['config', 'commit.gpgsign', 'false'], dir);
  fs.writeFileSync(path.join(dir, 'seed.txt'), 'seed\n', 'utf-8');
  gitOk(['add', 'seed.txt'], dir);
  gitOk(['commit', '-q', '-m', 'seed'], dir);
  return dir;
}

beforeEach(() => {
  stderrChunks = '';
  repo = makeRepo();
  // 夹具搭建本身可能碰 rename(见 scratch-dir 的 gitfile 边界腿)⇒ 计数只在动作窗口内起算
  probe.rmSyncCalls = 0;
  probe.renameSyncCalls = 0;
  origStrict = process.env.IHUI_FILE_ACL_STRICT;
  origHooks = process.env.IHUI_HOOKS_CONFIG;
  // 钩子面隔离:与 delete-guard 用例同法,把配置指到不存在的文件
  process.env.IHUI_HOOKS_CONFIG = path.join(repo, 'no-hooks.json');
  clearGuardRulesCache();
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
    stderrChunks += String(chunk);
    return true;
  }) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (origStrict === undefined) delete process.env.IHUI_FILE_ACL_STRICT;
  else process.env.IHUI_FILE_ACL_STRICT = origStrict;
  if (origHooks === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origHooks;
  const dir = repo;
  repo = '';
  if (dir !== '') rmScratch(dir);
});

function stderrText(): string {
  return stderrChunks;
}

/** 造一枚在册的隔离 worktree(目录名可控),返回其绝对路径 */
function makeWorktree(agentId: string): string {
  const mgr = new WorktreeManager(repo);
  mgr.create(agentId);
  const wtPath = path.join(repo, '.worktrees', agentId);
  fs.writeFileSync(path.join(wtPath, 'payload.txt'), `work in ${agentId}\n`, 'utf-8');
  return wtPath;
}

/** 守护面清单的夹具写入口(夹具只造输入,判据仍全在 sandbox 层) */
function installGuardManifest(body: string): void {
  fs.mkdirSync(path.join(repo, 'scripts', 'data'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'scripts', 'data', 'immutable-guard.json'), body, 'utf-8');
  clearGuardRulesCache(repo);
}
const GUARD_OK_BODY = JSON.stringify({ entries: [{ path: 'scripts/lib/', kind: 'lib', why: '夹具守护面' }] });

describe('delete 轴消费点:WorktreeManager.remove / exit_worktree', () => {
  it('① 正例:合法隔离区照常回收,动作真发生,且不冒出 file-acl 声音', () => {
    const wtPath = makeWorktree('agent-ok');
    expect(new WorktreeManager(repo).remove('agent-ok', { force: true })).toBe(true);
    expect(fs.existsSync(wtPath)).toBe(false);
    expect(gitOk(['worktree', 'list'], repo)).not.toContain('agent-ok');
    expect(stderrText()).not.toContain('[file-acl');
  });

  it('② 反例:目录名命中凭据族 ⇒ 拒,且拒绝早于任何删除动作(桩计数 + 注册表双重取证)', () => {
    const wtPath = makeWorktree('.npmrc');
    const mgr = new WorktreeManager(repo);
    expect(() => mgr.remove('.npmrc', { force: true })).toThrow(/\[file-acl/);
    // 没走到 fs 删除原语:既没直删,也没搬进回收站
    expect(probe.rmSyncCalls).toBe(0);
    expect(probe.renameSyncCalls).toBe(0);
    expect(fs.existsSync(getDeleteTrashDir(repo))).toBe(false);
    // 现场原样在位(含未提交的工作文件)
    expect(fs.existsSync(path.join(wtPath, 'payload.txt'))).toBe(true);
    // git 注销腿也没跑:注册表里它还在
    expect(gitOk(['worktree', 'list'], repo)).toContain('.npmrc');
  });

  it('②b 拒绝必须是"返回给用户",不是把异常抛穿工具面(exit_worktree)', async () => {
    makeWorktree('.npmrc');
    const tool = exitWorktreeTool as unknown as ExecTool;
    const r = await tool.execute({ name: '.npmrc', force: true }, { workspacePath: repo });
    expect(r.success).toBe(false);
    expect(r.error ?? '').toContain('[file-acl');
    expect(probe.rmSyncCalls).toBe(0);
    expect(fs.existsSync(path.join(repo, '.worktrees', '.npmrc', 'payload.txt'))).toBe(true);
  });

  it('③a 默认档 = advisory(守护面族):出声放行,删除照做(正向对照,证明探针真接上了)', () => {
    installGuardManifest(GUARD_OK_BODY);
    fs.mkdirSync(path.join(repo, 'scripts', 'lib', 'deep'), { recursive: true });
    expect(loadGuardFaceRules(repo).state).toBe('ok');

    expect(() => new WorktreeManager(repo).remove('../scripts/lib/deep', { force: true })).not.toThrow();
    expect(stderrText()).toContain('[file-acl advisory]');
    expect(stderrText()).toContain('delete scripts/lib/deep');
    expect(fs.existsSync(path.join(repo, 'scripts', 'lib', 'deep'))).toBe(false);
    expect(probe.renameSyncCalls).toBeGreaterThan(0);
    expect(probe.rmSyncCalls).toBe(0);
  });

  it('③b 严档(IHUI_FILE_ACL_STRICT=1):同一条守护面族升为拦,动作一点没发生', () => {
    installGuardManifest(GUARD_OK_BODY);
    process.env.IHUI_FILE_ACL_STRICT = '1';
    fs.mkdirSync(path.join(repo, 'scripts', 'lib', 'deep'), { recursive: true });

    expect(() => new WorktreeManager(repo).remove('../scripts/lib/deep', { force: true })).toThrow(
      /scripts\/lib\/\*\*/,
    );
    expect(fs.existsSync(path.join(repo, 'scripts', 'lib', 'deep'))).toBe(true);
    expect(probe.rmSyncCalls).toBe(0);
    expect(probe.renameSyncCalls).toBe(0);
  });

  it('③c enforce 族不吃档位:严档下凭据族与默认档同样被拒(档位只升 advisory)', () => {
    makeWorktree('.npmrc');
    process.env.IHUI_FILE_ACL_STRICT = '1';
    expect(() => new WorktreeManager(repo).remove('.npmrc', { force: true })).toThrow(/\[file-acl ask\]/);
    expect(fs.existsSync(path.join(repo, '.worktrees', '.npmrc'))).toBe(true);
  });

  it('④ 未判定态:守护面清单是坏 JSON ⇒ 记 unjudged;既不冒绿(凭据族照拒)也不冒红(合法照收)', () => {
    installGuardManifest('{坏 JSON');
    const guard = loadGuardFaceRules(repo);
    expect(guard.state).toBe('unjudged');
    if (guard.state !== 'ok') expect(guard.reason).toContain('JSON');

    const wtPath = makeWorktree('.npmrc');
    expect(() => new WorktreeManager(repo).remove('.npmrc', { force: true })).toThrow(/\[file-acl/);
    expect(fs.existsSync(path.join(wtPath, 'payload.txt'))).toBe(true);
    // 不冒红那一臂:同一张坏表下,合法隔离区照常回收(未判定 ≠ 一律拦)
    makeWorktree('agent-ok');
    expect(new WorktreeManager(repo).remove('agent-ok', { force: true })).toBe(true);
    expect(probe.rmSyncCalls).toBe(0);
  });

  it('⑤ 形状锁:裁决排在 remove() 里所有删除动作之前(源码次序)', () => {
    const src = fs.readFileSync(new URL('../src/tools/worktree.ts', import.meta.url), 'utf8');
    const fn = src.slice(
      src.indexOf('remove(agentId: string'),
      src.indexOf('/** 执行 git worktree prune'),
    );
    expect(fn).toBeTruthy();
    const aclAt = fn.indexOf('evaluateFileAccess(');
    expect(aclAt).toBeGreaterThan(-1);
    for (const needle of ["'worktree', 'remove'", 'stashDirToTrash(', 'fs.rmSync(', 'fs.existsSync(wtPath)']) {
      expect(fn.indexOf(needle)).toBeGreaterThan(aclAt);
    }
  });

  it('⑥ 定性锁:git.ts 的临时索引清理是内部 scratch,必须留在 finally 无条件执行', () => {
    const src = fs.readFileSync(new URL('../src/tools/git.ts', import.meta.url), 'utf8');
    const fn = src.slice(src.indexOf('function commitWithTempIndex'), src.indexOf('const git_commit'));
    const cleanupAt = fn.indexOf('const cleanup =');
    const finallyAt = fn.indexOf('} finally {');
    expect(cleanupAt).toBeGreaterThan(-1);
    expect(finallyAt).toBeGreaterThan(cleanupAt);
    expect(fn.slice(finallyAt)).toContain('cleanup();');
    const body = fn.slice(cleanupAt, fn.indexOf('};', cleanupAt));
    expect(body).toContain('rmSync(tmpIndex');
    // 条件化这一腿 = 失败路径把临时索引留在 .git/ 里(比删一个受保护文件更坏)
    expect(body).not.toMatch(/if \(/);
    expect(body).not.toContain('evaluateFileAccess');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
