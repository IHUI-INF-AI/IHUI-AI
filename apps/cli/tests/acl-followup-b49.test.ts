// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal-b49 S7 三格收尾锁(2026-11-05)。判据单源一律 import `src/sandbox/file-access-policy.ts`,
 * 本件零复算规则表(§0.6/§22c)。三格各自的裁决:
 *  ① `subagents/worktree.ts` 四枚删除点逐点定性:R-1(`removeWorktree`,含 `git worktree remove` 与
 *    `spawnSync('rm','-rf')` 两腿)和 R-4(`createWorktreeWithFallback` 会话提交前清理臂)的目标名都来自
 *    模型可控的 `subagentId`(`dispatch_subagent.resumeFrom`)⇒ **接**;R-2(撤 marker = **解除**删除武装)
 *    和 R-3(目标来自 `readdirSync` 枚举 + 三重归属证明,守护自身启动对账腿)⇒ **不接**,定性钉在 ③。
 *  ② 守护面清单的 `unjudged` 透出到消费点并出声:既不冒绿(凭据族照旧 enforce 拦)也不冒红
 *    (合法操作照做,advisory 默认档语义不动,§12e)。
 *  ③ `.worktrees/**` **不加**进规则表:反证一 = 威胁型(agentId 带 `..` 折出隔离区)落在该 glob 之外,
 *    加了也零命中;反证二 = 它对每一次合法回收都是 advisory-ask,严档下整片升拦 = §12e 恒红门。
 * 探针非空洞性由正向对照保证:同一计数在放行档必须 >0,否则拒绝档的 0 只是没接上。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as FsModule from 'node:fs';
import type * as WorktreeModule from '../src/worktree.js';
import type * as ChildProcessModule from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { removeWorktree, createWorktree, createWorktreeWithFallback, reclaimWorktreeMarker, reconcileWorktreeArtifacts } from '../src/subagents/worktree.js';
import { worktreeMarkerPath } from '../src/worktree.js';
import { checkPathWritePermission } from '../src/tools/index.js';
import { announceGuardUnjudged, buildFileAccessRules, buildGuardUnjudgedNotice, clearGuardRulesCache, decideFileAccess, evaluateFileAccess, isStrictMode, type GuardManifestOutcome } from '../src/sandbox/file-access-policy.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §15b/§26 唯一落点(禁 os.tmpdir/裸 mkdtemp、不得在仓库树内造 git 夹具=门 208);正解=给"测试支持层"在策略表建档 until 2026-12-28

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const probe = vi.hoisted(() => ({ rmSync: 0, gitWorktree: 0, rmCmd: 0 }));
// CoW 落盘出口(`src/worktree.js` 的 `createWorktree`)替换成"落盘后小失败":R-4 那一腿在 catch 臂内,
// 真 CoW 只在 EEXIST+marker 齐备时判 reused ⇒ 拿不到唯一会走清理臂的形态。其余符号一律 actual(§0.6)。
vi.mock('../src/worktree.js', async (importOriginal) => {
  const actual = await importOriginal<typeof WorktreeModule>();
  return { ...actual, createWorktree: async (o: { destination?: string }) => { throw new Error(`夹具:落盘后小失败 ${o?.destination ?? ''}`); } };
});
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>();
  return { ...actual, rmSync: (...a: Parameters<typeof actual.rmSync>): void => { probe.rmSync += 1; actual.rmSync(...a); } };
});
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>();
  return {
    ...actual,
    spawnSync: (...a: Parameters<typeof actual.spawnSync>) => {
      const cmd = String(a[0]); const argv = (a[1] as string[] | undefined) ?? [];
      if (cmd === 'git' && argv[0] === 'worktree') probe.gitWorktree += 1;
      if (cmd === 'rm') probe.rmCmd += 1;
      return actual.spawnSync(...a);
    },
  };
});

const SRC = fs.readFileSync(path.resolve('src/subagents/worktree.ts'), 'utf-8');
/** 取某导出函数的源码切片(次序锁与定性锁共用;次序与"体内有无裁决"都只读源码,不复算判据) */
function fnBody(name: string): string {
  const at = Math.max(SRC.indexOf(`export function ${name}`), SRC.indexOf(`export async function ${name}`));
  expect(at).toBeGreaterThan(-1);
  const next = SRC.indexOf('\nexport ', at + 1);
  return SRC.slice(at, next === -1 ? SRC.length : next);
}
function gitOk(args: string[], dir: string): void {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
}
function installGuardManifest(body: string): void {
  fs.mkdirSync(path.join(repo, 'scripts', 'data'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'scripts', 'data', 'immutable-guard.json'), body, 'utf-8');
  clearGuardRulesCache(repo);
}
const GUARD_OK = JSON.stringify({ entries: [{ path: 'scripts/lib/', kind: 'lib', why: '夹具守护面' }] });

let repo = '';
let stderrText = '';
const saved: Record<string, string | undefined> = {};

/** 造一枚"marker 齐备但根本不是 git 仓"的自有目录(CoW 出口已被 mock,这里只证 own) */
function landFakeOwnDir(id: string): string {
  const dest = path.join(repo, '.worktrees', id);
  fs.mkdirSync(path.join(dest, '.git'), { recursive: true });
  fs.writeFileSync(worktreeMarkerPath(dest), repo, 'utf-8');
  fs.writeFileSync(path.join(dest, 'payload.txt'), 'work\n', 'utf-8');
  return dest;
}

beforeEach(() => {
  stderrText = '';
  probe.rmSync = 0; probe.gitWorktree = 0; probe.rmCmd = 0;
  repo = mkScratch('s7-acl-followup-');
  gitOk(['init', '-q'], repo);
  for (const c of [['config', 'user.email', 't@ihui.local'], ['config', 'user.name', 'T'], ['config', 'commit.gpgsign', 'false']]) gitOk(c, repo);
  fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n', 'utf-8');
  gitOk(['add', 'seed.txt'], repo);
  gitOk(['commit', '-q', '-m', 'seed'], repo);
  installGuardManifest(GUARD_OK); // 清单可读 ⇒ 出声账保持安静,正例才判得出"零噪声"
  for (const k of ['IHUI_WORKTREE_DIR', 'IHUI_FILE_ACL_STRICT', 'IHUI_SUBAGENT_STATE_DIR']) saved[k] = process.env[k];
  process.env.IHUI_WORKTREE_DIR = path.join(repo, '.worktrees');
  process.env.IHUI_SUBAGENT_STATE_DIR = path.join(repo, 'no-such-state-dir');
  delete process.env.IHUI_FILE_ACL_STRICT;
  vi.spyOn(process.stderr, 'write').mockImplementation(((c: unknown) => { stderrText += String(c); return true; }) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  const dir = repo; repo = '';
  if (dir !== '') rmScratch(dir);
});

describe('① R-1 subagents/removeWorktree(与 S5 的 W-1 同族 ⇒ 接)', () => {
  it('正例:合法隔离区照常回收,git 注销腿真发生,且不冒出任何 file-acl 声音', () => {
    const wt = createWorktree('parent', 'agent-ok', repo);
    fs.writeFileSync(path.join(wt.path, 'payload.txt'), 'work\n', 'utf-8');
    expect(removeWorktree(wt.path, { sourcePath: repo, force: true })).toBe(true);
    expect(fs.existsSync(wt.path)).toBe(false);
    expect(probe.gitWorktree).toBeGreaterThan(0); // 探针非空洞性:注销腿确实经过了计数
    expect(stderrText).not.toContain('[file-acl');
  });
  it('反例:名字命中凭据族 ⇒ 抛拒,且 git / rm / rmSync 一条都没走(拒绝先于任何 fs 动作)', () => {
    const dest = landFakeOwnDir('.npmrc');
    expect(() => removeWorktree(dest, { sourcePath: repo, force: true })).toThrow(/\[file-acl/);
    expect(probe.gitWorktree).toBe(0);
    expect(probe.rmCmd).toBe(0);
    expect(probe.rmSync).toBe(0);
    expect(fs.existsSync(path.join(dest, 'payload.txt'))).toBe(true);
    expect(stderrText).toContain('[file-acl'); // 调用方 catch 吞掉抛错时,拒绝仍然出声(§0.9/§0.10)
  });
  it('读不到时不说成已经不在,也不回收注册', () => {
    const wt = createWorktree('parent', 'agent-unread', repo);
    const payload = path.join(wt.path, 'payload.txt');
    fs.writeFileSync(payload, 'keep\n', 'utf-8');
    const denied = new Error('denied') as NodeJS.ErrnoException;
    denied.code = 'EACCES';
    const gitBefore = probe.gitWorktree;
    expect(() => removeWorktree(wt.path, {
      sourcePath: repo,
      force: true,
      stat: () => {
        throw denied;
      },
    })).toThrow(/不能把它说成已经不在/);
    expect(fs.readFileSync(payload, 'utf8')).toBe('keep\n');
    expect(probe.gitWorktree).toBe(gitBefore);
    expect(probe.rmCmd).toBe(0);
    expect(probe.rmSync).toBe(0);
  });
  it('次序锁:裁决排在 stat / git worktree remove / spawnSync rm 之前', () => {
    const body = fnBody('removeWorktree');
    const acl = body.indexOf('evaluateFileAccess(');
    expect(acl).toBeGreaterThan(-1);
    for (const later of ['stat(wtPath)', "'worktree', 'remove'", "spawnSync('rm'"]) {
      expect(body.indexOf(later)).toBeGreaterThan(acl);
    }
  });
});

describe('新建时读不到不能当成不存在', () => {
  it('读不到时不说成不存在,也不新建', () => {
    const dest = path.join(repo, '.worktrees', 'agent-blocked');
    fs.mkdirSync(dest, { recursive: true });
    const payload = path.join(dest, 'payload.txt');
    fs.writeFileSync(payload, 'keep\n', 'utf-8');
    const denied = new Error('denied') as NodeJS.ErrnoException;
    denied.code = 'EACCES';
    const gitBefore = probe.gitWorktree;
    expect(() => createWorktree('parent', 'agent-blocked', repo, () => { throw denied; })).toThrow(/读不到/);
    expect(fs.readFileSync(payload, 'utf8')).toBe('keep\n');
    expect(probe.gitWorktree).toBe(gitBefore);
  });
});

describe('② R-4 createWorktreeWithFallback 的会话提交前清理臂(接)', () => {
  it('正例:后置失败 ⇒ 自有目录真被清掉(rmSync 计数 >0,哨兵文件随之消失)', async () => {
    const dest = landFakeOwnDir('plain-own');
    await createWorktreeWithFallback('parent', 'plain-own', repo, true);
    expect(probe.rmSync).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(dest, 'payload.txt'))).toBe(false);
    expect(stderrText).not.toContain('[file-acl');
  });
  it('反例:目标名命中凭据族 ⇒ 一个字节不删,改成向上报错(失效方向 = 多要一次定向说明)', async () => {
    const dest = landFakeOwnDir(path.join('secrets', 'leak'));
    await expect(createWorktreeWithFallback('parent', 'secrets/leak', repo, true)).rejects.toThrow(/已存在|exists/i);
    expect(probe.rmSync).toBe(0);
    expect(fs.existsSync(path.join(dest, 'payload.txt'))).toBe(true);
    expect(stderrText).toContain('[file-acl');
  });
  it('次序锁:裁决排在 existsSync / isWorktreeMarkerComplete / rmSync 之前', () => {
    const body = fnBody('createWorktreeWithFallback');
    const acl = body.indexOf('evaluateFileAccess(');
    expect(acl).toBeGreaterThan(-1);
    expect(body.indexOf('isWorktreeMarkerComplete(destination)')).toBeGreaterThan(acl);
    expect(body.indexOf('fs.rmSync(destination')).toBeGreaterThan(acl);
  });
});

describe('③ R-2/R-3 定性锁(不接,理由必须由行为兜住)', () => {
  it('R-2 reclaimWorktreeMarker:体内不得出现裁决;撤 marker 无条件发生', () => {
    expect(fnBody('reclaimWorktreeMarker')).not.toContain('evaluateFileAccess');
    const dest = landFakeOwnDir('disarm');
    expect(reclaimWorktreeMarker(dest)).toBe(true);
    expect(fs.existsSync(worktreeMarkerPath(dest))).toBe(false);
    expect(stderrText).not.toContain('[file-acl');
    // 反方向证据:marker 撤下后,对账只能"证明不了⇒保留"——加闸拦住这一步反而更危险
    expect(reconcileWorktreeArtifacts(repo).find((a) => a.subagentId === 'disarm')?.action).toBe('kept-unprovable');
    expect(fs.existsSync(dest)).toBe(true);
  });
  it('R-3 reconcile:目标来自枚举+三重归属证明,体内不得出现裁决', () => {
    expect(fnBody('reconcileWorktreeArtifacts')).not.toContain('evaluateFileAccess');
    const own = landFakeOwnDir('gone-session'); // marker 指向本源 + 无 session 行 ⇒ 唯一可删档
    const half = path.join(repo, '.worktrees', 'half-landed');
    fs.mkdirSync(half, { recursive: true });
    fs.writeFileSync(path.join(half, 'partial.txt'), 'x\n', 'utf-8');
    const actions = reconcileWorktreeArtifacts(repo);
    expect(actions.find((a) => a.subagentId === 'gone-session')?.action).toBe('removed-own');
    expect(fs.existsSync(own)).toBe(false);
    expect(actions.find((a) => a.subagentId === 'half-landed')?.action).toBe('kept-unprovable');
    expect(fs.existsSync(half)).toBe(true);
  });
  it('session 行读不到时不把工作树说成没有会话再删掉', () => {
    const own = landFakeOwnDir('unread-session');
    const denied = () => {
      const err = new Error('denied') as NodeJS.ErrnoException;
      err.code = 'EACCES';
      throw err;
    };
    const actions = reconcileWorktreeArtifacts(repo, { stat: denied });
    expect(actions.find((a) => a.subagentId === 'unread-session')?.action).toBe('kept-unprovable');
    expect(fs.readFileSync(path.join(own, 'payload.txt'), 'utf-8')).toBe('work\n');
  });
});

describe('④ unjudged 透出到消费点(cell 2:出声,但不改判据、不升档)', () => {
  it('evaluateFileAccess 透出 guard 三态;ok 态不出声', () => {
    const ok = evaluateFileAccess('read', 'src/a.ts', repo);
    expect(ok.guard.state).toBe('ok');
    expect(announceGuardUnjudged(repo, ok.guard, 'unit')).toBe(false);
    const notice = buildGuardUnjudgedNotice(repo, { state: 'unjudged', rules: [], count: 0, reason: '夹具原因' }, 'unit');
    expect(notice).toContain('[file-acl unjudged');
  });
  it('同一(工作区×原因)只报一次;换工作区另报(不刷屏也不漏报)', () => {
    const g: GuardManifestOutcome = { state: 'unjudged', rules: [], count: 0, reason: 'R' };
    expect(announceGuardUnjudged(repo, g, 'site')).toBe(true);
    expect(announceGuardUnjudged(repo, g, 'site')).toBe(false);
    expect(announceGuardUnjudged(path.join(repo, 'other'), g, 'site')).toBe(true);
    expect(stderrText.match(/\[file-acl unjudged\]/g)?.length).toBe(2);
    clearGuardRulesCache(repo);
    expect(announceGuardUnjudged(repo, g, 'site')).toBe(true); // 复位出口单一
  });
  it('消费点(checkPathWritePermission):清单坏 ⇒ 凭据族照拒(不冒绿)、合法路径照放行(不冒红),并且出声一次', () => {
    installGuardManifest('{这不是合法 JSON');
    const ctx = { workspacePath: repo } as never;
    const denied = checkPathWritePermission('.env', ctx, 'write');
    expect(denied.allowed).toBe(false);
    expect(denied.reason ?? '').toContain('[file-acl deny]');
    const passed = checkPathWritePermission('src/a.ts', ctx, 'write');
    expect(passed.allowed).toBe(true);
    expect(stderrText).toContain('[file-acl unjudged');
    expect(stderrText).toContain('immutable-guard.json'); // 下一步点名到可动手的地方
    expect(stderrText).not.toContain('[file-acl advisory] src/a.ts');
  });
  it('消费点:路径折叠/子目录/越界形态都不能绕过凭据族拒绝;合法文件不误挡(F-074/101/102)', () => {
    clearGuardRulesCache(repo);
    const ctx = { workspacePath: repo } as never;
    for (const p of ['docs/../.env', './.env', 'sub/.env', 'sub/.env.local', 'deep/nested/.env']) {
      const r = checkPathWritePermission(p, ctx, 'write');
      expect(r.allowed, p).toBe(false);
    }
    // 正证:模板样例与普通源码文件照常放行(不是一刀切禁 .env 前缀)
    expect(checkPathWritePermission('.env.example', ctx, 'write').allowed).toBe(true);
    expect(checkPathWritePermission('src/a.ts', ctx, 'write').allowed).toBe(true);
  });
  it('advisory 默认档语义不动(§12e):严档仍由 IHUI_FILE_ACL_STRICT 单独决定', () => {
    expect(isStrictMode({})).toBe(false);
    expect(isStrictMode({ IHUI_FILE_ACL_STRICT: '1' })).toBe(true);
  });
});

describe('⑤ .worktrees/** 裁决:不加(cell 3)', () => {
  const hypothetical = { pattern: '.worktrees/**', ops: { delete: 'ask' } as const, enforcement: 'advisory' as const, source: 'guard-face' as const, why: '假想条目:仅用于反证,不入表' };
  it('现表内确无该族:合法隔离区的 delete 判 allow(零噪声)', () => {
    const { rules, guard } = buildFileAccessRules(repo);
    expect(guard.state).toBe('ok');
    expect(rules.some((r) => r.pattern.startsWith('.worktrees'))).toBe(false);
    expect(decideFileAccess('delete', '.worktrees/agent-ok', rules).decision).toBe('allow');
  });
  it('反证一:agentId 带 .. 折出的目标根本不在 .worktrees/ 之下 ⇒ 加了也零命中', () => {
    const escaped = decideFileAccess('delete', '../evil-dir', [hypothetical]);
    expect(escaped.decision).toBe('allow'); // 威胁型由消费点的裁决+未合并/未提交判据管(见 ①②),不靠这一条
    expect(escaped.path).toBe('../evil-dir');
  });
  it('反证二:该条对每一次合法回收都是 advisory-ask ⇒ 严档下整片升拦 = §12e 恒红门', () => {
    const legit = decideFileAccess('delete', '.worktrees/agent-ok', [hypothetical]);
    expect(legit.decision).toBe('ask');
    expect(legit.enforcement).toBe('advisory'); // 与 isStrictMode 合取即翻拦(翻转本身由 file-access-policy 用例锁)
    expect(isStrictMode({ IHUI_FILE_ACL_STRICT: '1' })).toBe(true);
  });
});

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
