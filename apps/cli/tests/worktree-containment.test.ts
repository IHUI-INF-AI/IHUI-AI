// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal-b49 W9:worktree 删除出口**容器性断言**装车锁。判据本体单源在
 * `src/sandbox/file-access-policy.ts` 的 `judgeWorktreeContainment`(§0.6/§22c:本件一律走
 * 消费出口,绝不 import 判据再复算第二份尺)。射程钉死五格:
 *  ① **装车证明** —— 断言必须真走到删除出口(`WorktreeManager.remove` / `subagents.removeWorktree` /
 *    `cleanupWorktree` / background 收尾),命拒时桩计数 `rmSync`/`renameSync`/`git worktree`/`rm` 恒 0,
 *    而不是只测那个纯函数(§0.9「造好没装车=没有」)。
 *  ② 三拒型分走三出口:`..` 折叠、绝对越界(同盘)、跨盘 —— 各一拒且一个字节不删。
 *  ③ 正向对照:合法隔离区照常回收(git 注销腿真发生),且不冒出 `[worktree-containment]` 噪声(§12e 不做恒拦门)。
 *  ④ `structuralChild` 那一臂:sourcePath 传歪(照 worker-pool 以 `parentId` 当 sourcePath)而真实目标
 *    仍在 `.worktrees/` 下 ⇒ 不误杀内部收尾腿(严格比根会误杀,几何臂兜住)。
 *  ⑤ W-2:`cleanupWorktree` 改出可传拒返回形态后,命拒 ⇒ 返回 `refused` 且 background 收尾**保留**
 *    `task.worktreePath`(副作用没发生);合法缺失(`absent`)才清账 —— 与「无论成败都清」的老 bug 成对。
 * 探针非空洞性由 ③ 保证:同一 `git worktree` 计数在放行正例里必须 > 0,否则 ② 的零计数只是没接上。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import type * as FsModule from 'node:fs';
import type * as ChildProcessModule from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { WorktreeManager, cleanupWorktree } from '../src/tools/worktree.js';
import { removeWorktree } from '../src/subagents/worktree.js';
import { clearGuardRulesCache } from '../src/sandbox/file-access-policy.js';
import { registerTask, getTask, clearAllTasks, __test__ } from '../src/tools/background-registry.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §15b/§26 唯一落点(禁 os.tmpdir/裸 mkdtemp、不得在仓库树内造 git 夹具=门 208);正解=给"测试支持层"在策略表建档 until 2026-12-28

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// 删除原语探针:桩 node:fs(rmSync/renameSync 记账后透传)+ node:child_process(git worktree / rm 计数)。
const probe = vi.hoisted(() => ({ rmSync: 0, renameSync: 0, gitWorktree: 0, rmCmd: 0 }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  return {
    ...actual,
    rmSync: (...a: Parameters<typeof actual.rmSync>): void => { probe.rmSync += 1; actual.rmSync(...a); },
    renameSync: (...a: Parameters<typeof actual.renameSync>): void => { probe.renameSync += 1; actual.renameSync(...a); },
  };
});
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>();
  return {
    ...actual,
    spawnSync: (...a: Parameters<typeof actual.spawnSync>) => {
      const cmd = String(a[0]);
      const argv = (a[1] as string[] | undefined) ?? [];
      if (cmd === 'git' && argv[0] === 'worktree') probe.gitWorktree += 1;
      if (cmd === 'rm') probe.rmCmd += 1;
      return actual.spawnSync(...a);
    },
  };
});

const fakeChild = (): ChildProcess => new EventEmitter() as unknown as ChildProcess;

function gitOk(args: string[], dir: string): string {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败:${r.stderr ?? r.error}`);
  return (r.stdout ?? '').trim();
}

let repo = '';
let other = '';
let home = '';
let stderrText = '';
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  probe.rmSync = 0; probe.renameSync = 0; probe.gitWorktree = 0; probe.rmCmd = 0;
  stderrText = '';
  repo = mkScratch('w9-repo-');
  gitOk(['init', '-q'], repo);
  for (const c of [['config', 'user.email', 't@ihui.local'], ['config', 'user.name', 'T'], ['config', 'commit.gpgsign', 'false']]) gitOk(c, repo);
  fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n', 'utf-8');
  gitOk(['add', 'seed.txt'], repo);
  gitOk(['commit', '-q', '-m', 'seed'], repo);
  other = mkScratch('w9-other-'); // ④ 用:一个与 repo 无关的合法目录(作被传歪的 sourcePath)
  home = mkScratch('w9-home-');   // ⑤ 用:IHUI_HOME 隔离落点
  for (const k of ['IHUI_WORKTREE_DIR', 'IHUI_FILE_ACL_STRICT', 'IHUI_HOOKS_CONFIG', 'IHUI_HOME', 'IHUI_SUBAGENT_STATE_DIR']) saved[k] = process.env[k];
  delete process.env.IHUI_WORKTREE_DIR;   // 一律走默认 <sourcePath>/.worktrees,让容器性锚点可预测
  delete process.env.IHUI_FILE_ACL_STRICT;
  process.env.IHUI_HOOKS_CONFIG = path.join(repo, 'no-hooks.json');
  process.env.IHUI_HOME = path.join(home, 'home');
  process.env.IHUI_SUBAGENT_STATE_DIR = path.join(repo, 'no-state-dir');
  clearGuardRulesCache();
  clearAllTasks();
  __test__.setTerminalNoticeSink(null);
  vi.spyOn(process.stderr, 'write').mockImplementation(((c: unknown) => { stderrText += String(c); return true; }) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  clearAllTasks();
  __test__.setTerminalNoticeSink(null);
  for (const d of [repo, other, home]) { if (d !== '') rmScratch(d); }
  repo = other = home = '';
});

/** 造一枚在册的合法隔离 worktree,返回绝对路径。 */
function makeRealWorktree(agentId: string): string {
  const mgr = new WorktreeManager(repo);
  const wt = mgr.create(agentId);
  fs.writeFileSync(path.join(wt.path, 'payload.txt'), `work in ${agentId}\n`, 'utf-8');
  return wt.path;
}

describe('W9 容器性:装车证明 + 三拒型 + 正向 + structuralChild + W-2', () => {
  it('①+② 正控/反控同批:合法回收让 git 注销腿真走(>0),越界回收一条删除原语都不碰', () => {
    // 正控(③):先证明探针接得上 —— 合法隔离区真被 git 注销。
    const wtPath = makeRealWorktree('agent-ok');
    expect(new WorktreeManager(repo).remove('agent-ok', { force: true })).toBe(true);
    expect(probe.gitWorktree).toBeGreaterThan(0);
    expect(fs.existsSync(wtPath)).toBe(false);
    expect(stderrText).not.toContain('[worktree-containment]');

    // 反控(②a `..` 折叠,走 WorktreeManager.remove):解析后折出隔离区根 ⇒ 出声 + 抛,零删除。
    probe.rmSync = 0; probe.renameSync = 0; probe.gitWorktree = 0; probe.rmCmd = 0; stderrText = '';
    expect(() => new WorktreeManager(repo).remove(path.join('..', '..', 'escaped-agent'), { force: true })).toThrow(
      /\[worktree-containment\]/,
    );
    expect(stderrText).toContain('[worktree-containment]');
    expect(probe.rmSync + probe.renameSync + probe.gitWorktree + probe.rmCmd).toBe(0);
  });

  it('②b 绝对越界(同盘、越出 .worktrees)走 removeWorktree:抛 + 现场一字节没删', () => {
    // 绝对路径直接进 removeWorktree(不经 path.join)⇒ 容器性在 existsSync/git 之前判越界。
    const outside = path.join(repo, 'outside-wt');
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, 'keep.txt'), 'do-not-delete\n', 'utf-8');
    expect(() => removeWorktree(outside, { sourcePath: repo, force: true })).toThrow(/\[worktree-containment\]/);
    expect(fs.existsSync(path.join(outside, 'keep.txt'))).toBe(true); // 副作用没发生
    expect(probe.rmSync + probe.renameSync + probe.gitWorktree + probe.rmCmd).toBe(0);
  });

  it('读不到时不说成不存在,也不新建', () => {
    const dest = path.join(repo, '.worktrees', 'agent-blocked');
    fs.mkdirSync(dest, { recursive: true });
    const payload = path.join(dest, 'payload.txt');
    fs.writeFileSync(payload, 'keep\n', 'utf-8');
    const denied = new Error('denied') as NodeJS.ErrnoException;
    denied.code = 'EACCES';
    const gitBefore = probe.gitWorktree;
    expect(() => new WorktreeManager(repo).create('agent-blocked', { stat: () => { throw denied; } })).toThrow(/读不到/);
    expect(fs.readFileSync(payload, 'utf8')).toBe('keep\n');
    expect(probe.gitWorktree).toBe(gitBefore);
  });

  it('读不到时不是已经不在,目录和账面都不能当成清掉', () => {
    const wtPath = makeRealWorktree('agent-unread');
    const payload = path.join(wtPath, 'payload.txt');
    const denied = new Error('denied') as NodeJS.ErrnoException;
    denied.code = 'EACCES';
    const out = cleanupWorktree(wtPath, repo, true, () => {
      throw denied;
    });
    expect(out.status).toBe('failed');
    if (out.status === 'failed') expect(out.reason).toContain('读不到');
    expect(fs.readFileSync(payload, 'utf8')).toContain('agent-unread');
    expect(() => new WorktreeManager(repo).remove('agent-unread', { force: true, stat: () => { throw denied; } })).toThrow(/读不到/);
    expect(fs.readFileSync(payload, 'utf8')).toContain('agent-unread');
  });

  it('②c 跨盘越界走 cleanupWorktree:返回可传拒 refused + 零删除', () => {
    // win32 用另一盘符(与 repo 盘不同 ⇒ relative() 返回绝对 ⇒ 严格比根失配、父叶子≠.worktrees);
    // POSIX 下该形态落进无关绝对根,同样被容器性拒。判定是纯路径数学,不需要该目录真存在。
    const driveRoot = process.platform === 'win32' ? 'Z:\\' : '/';
    const crossTarget = path.join(driveRoot, 'ihui-b49-crossdrive-nonexistent', 'agent-x');
    const out = cleanupWorktree(crossTarget, repo, true);
    expect(out.status).toBe('refused');
    expect(probe.rmSync + probe.renameSync + probe.gitWorktree + probe.rmCmd).toBe(0);
    expect(stderrText).toContain('[worktree-containment]');
  });

  it('④ structuralChild 臂:sourcePath 传歪而真实目标仍在 .worktrees 下 ⇒ 不误杀内部收尾腿', () => {
    // 照 worker-pool:removeWorktree(w.worktree.path, { sourcePath: w.worktree.parentId }) ——
    // sourcePath 是个与目标不同树的目录(严格比根会误杀),几何臂(父叶子 == .worktrees)兜住。
    const wtPath = makeRealWorktree('agent-geom');
    let err: unknown = null;
    try {
      removeWorktree(wtPath, { sourcePath: other, force: true });
    } catch (e) {
      err = e;
    }
    // 关键:容器性**没有**拒这一腿(绝不含 worktree-containment),而是放行到删除执行阶段。
    expect(stderrText).not.toContain('[worktree-containment]');
    expect(String(err ?? '')).not.toMatch(/worktree-containment/);
    // 装车证据:已越过闸口、真走到 git worktree 注销腿(而非在 fs 之前被拦回)。
    expect(probe.gitWorktree).toBeGreaterThan(0);
  });

  it('⑤ W-2 拒绝时账面保留:background 收尾遇容器性拒 ⇒ worktreePath 不清 + 现场一字节不删', () => {
    const escape = path.join(repo, 'escape-bookkeeping');
    fs.mkdirSync(escape, { recursive: true });
    fs.writeFileSync(path.join(escape, 'keep.txt'), 'survive\n', 'utf-8');
    const child = fakeChild();
    const id = registerTask(child, 'w9-b49-bg', { worktreePath: escape, worktreeSourcePath: repo });
    child.emit('close', 0, null); // 触发 close 收尾 → cleanupTaskWorktree → cleanupWorktree 判拒
    // 直接取证两件事:① 账面还在(老 bug 是无论成败都清);② 那枚目录一个字节没被删(副作用没发生)。
    // 不用全局探针计数 —— registerTask/台账落盘的原子 rename 与本出口无关,会污染计数。
    expect(getTask(id)?.worktreePath).toBe(escape);
    expect(fs.existsSync(path.join(escape, 'keep.txt'))).toBe(true);
    expect(stderrText).toContain('[worktree-containment]'); // 拒绝必须出声,不得被 catch 洗成静默(§0.10)
  });

  it('⑤b W-2 正向对照:合法缺失(absent)才清账 ⇒ 修好"拒绝不清"没顺手把正常收尾也堵死', () => {
    const ghost = path.join(repo, '.worktrees', 'ghost-agent'); // 容器内、但不存在 ⇒ absent
    const child = fakeChild();
    const id = registerTask(child, 'w9-b49-bg-absent', { worktreePath: ghost, worktreeSourcePath: repo });
    child.emit('close', 0, null);
    expect(getTask(id)?.worktreePath).toBeUndefined(); // absent ⇒ 真没了 ⇒ 清账
    expect(stderrText).not.toContain('[worktree-containment]'); // 容器内路径不出容器性噪声
  });

  it('⑥ 次序锁:createWorktreeWithFallback 清理臂的容器性排在 ACL 与 rmSync 之前(新腿已装车)', () => {
    // 该臂只能经 CoW 落盘小失败到达(acl-followup-b49 已用 mock 占该行为路径);本锁静态证明
    // 本席补的容器性断言确在体内、且排在任何 fs 动作之前(§0.9「造好没装车=没有」)。
    const src = fs.readFileSync(new URL('../src/subagents/worktree.ts', import.meta.url), 'utf8');
    const at = src.indexOf('export async function createWorktreeWithFallback');
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, src.indexOf('\nexport ', at + 1));
    const contain = body.indexOf('judgeWorktreeContainment(root, destination)');
    const acl = body.indexOf('evaluateFileAccess(');
    const marker = body.indexOf('isWorktreeMarkerComplete(destination)');
    const rm = body.indexOf('fs.rmSync(destination');
    expect(contain).toBeGreaterThan(-1);
    expect(contain).toBeLessThan(acl); // 容器性排在 ACL 之前
    expect(acl).toBeGreaterThan(-1);
    expect(acl).toBeLessThan(marker);
    expect(marker).toBeLessThan(rm); // ACL 仍在 existsSync/marker/rmSync 之前
    // W-2:cleanupWorktree 也须把容器性排在 fs 之前(命中即一个字节不删)
    // Z30 拆档:收尾腿已搬进 worktree-cleanup.ts ⇒ 锁随搬运改指新档,判据原样(容器性 < existsSync)
    const tw = fs.readFileSync(new URL('../src/tools/worktree-cleanup.ts', import.meta.url), 'utf8');
    const cu = tw.slice(tw.indexOf('export function cleanupWorktree'));
    expect(cu.indexOf('judgeWorktreeContainment(')).toBeLessThan(cu.indexOf('look(wtPath)'));
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
