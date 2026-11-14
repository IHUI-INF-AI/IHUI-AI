// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-039 / F-071 的回归钉。
 *
 * F-039(`src/audit.ts`):审计文件住着工具入参与输出 ⇒ 目录 0700、文件 0600;
 *   `mkdir`/`appendFile` 的 mode 只管新建,所以**已存在**的 0755/0644 也必须在写日志时被收紧,
 *   且既有行逐字不动(追加语义不变)。POSIX-only:Windows 上只钉"不抛、照常追加"。
 *
 * F-071(`src/plugins/update-plan.ts`):`stagingRoot/pluginName` 不再靠字符串拼 ——
 *   名字过 F-069 的统一校验(`assertSafePluginName`),落点再按 resolve 后的相对关系断言在根内;
 *   校验失败给出 `plugin-name-unusable` 的明确结论;取源失败/抛错时本次新建的暂存子目录必被清掉。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

// 避免读真实 ~/.ihui/settings.json(审计默认开关以 mock 为准)
vi.mock('../src/commands/settings.js', () => ({
  loadSettings: () => ({ auditEnabled: true }),
}));

import { auditLog } from '../src/audit.js';
import { execGitCapped } from '../src/plugins/git-runner.js';
import type { InstallRecord } from '../src/plugins/installer.js';
import { createStagingRoot, gitCandidateStager, planUpdate } from '../src/plugins/update-plan.js';

const IS_POSIX = process.platform !== 'win32';
const SHA = 'a'.repeat(40);

let scratch = '';
let homeDir = '';
let auditFile = '';

let origUserProfile: string | undefined;
let origHome: string | undefined;
let origIhuiHome: string | undefined;

beforeEach(() => {
  scratch = mkScratch('f-039-071-');
  homeDir = path.join(scratch, 'home');
  fs.mkdirSync(homeDir, { recursive: true });
  auditFile = path.join(homeDir, '.ihui', 'audit.jsonl');

  origUserProfile = process.env.USERPROFILE;
  origHome = process.env.HOME;
  origIhuiHome = process.env.IHUI_HOME;
  process.env.USERPROFILE = homeDir;
  process.env.HOME = homeDir;
  delete process.env.IHUI_PLUGIN_UPDATE_STAGING;
});

afterEach(() => {
  const restore = (key: string, value: string | undefined): void => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  restore('USERPROFILE', origUserProfile);
  restore('HOME', origHome);
  restore('IHUI_HOME', origIhuiHome);
  rmScratch(scratch, { bestEffort: true });
});

function modeOf(target: string): number {
  return fs.statSync(target).mode & 0o777;
}

// ==================== F-039 审计文件/目录权限 ====================

describe('F-039 审计落盘收紧权限', () => {
  it('跨平台:收紧语义不改变追加行为(写入成功且是合法 JSONL)', () => {
    auditLog({ timestamp: '2026-02-02T00:00:00.000Z', tool: 'plain', input: { a: 1 } });
    const lines = fs.readFileSync(auditFile, 'utf-8').split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ tool: 'plain', input: { a: 1 } });
  });

  it.skipIf(!IS_POSIX)('新建目录 0700、新建文件 0600(不受 umask 影响)', () => {
    auditLog({ timestamp: '2026-02-02T00:00:00.000Z', tool: 'fresh', input: {} });
    expect(modeOf(path.dirname(auditFile))).toBe(0o700);
    expect(modeOf(auditFile)).toBe(0o600);
  });

  it.skipIf(!IS_POSIX)('已存在的 0755/0644 被收紧,且既有行逐字不动', () => {
    const dir = path.dirname(auditFile);
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    fs.chmodSync(dir, 0o755);
    const existing = '{"timestamp":"2026-01-01T00:00:00.000Z","tool":"old","input":{}}';
    fs.writeFileSync(auditFile, `${existing}\n`, { encoding: 'utf-8', mode: 0o644 });
    fs.chmodSync(auditFile, 0o644);

    auditLog({ timestamp: '2026-02-02T00:00:00.000Z', tool: 'new', input: {} });

    expect(modeOf(dir)).toBe(0o700);
    expect(modeOf(auditFile)).toBe(0o600);
    const lines = fs.readFileSync(auditFile, 'utf-8').split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(existing);
    expect(JSON.parse(lines[1]!).tool).toBe('new');
  });
});

// ==================== F-071 暂存落点形状校验 / 根内断言 / 清理 ====================

const BAD_NAMES = ['..', '.', '../escape', '../../escape', 'a/b', 'a\\b', '', '   ', '/abs/path', 'C:\\abs'];

describe('F-071 插件名形状校验(拒绝越界落点)', () => {
  it.each(BAD_NAMES)('拒绝 %j:明确报 plugin-name-unusable,且暂存根内外都不落东西', async (name) => {
    const staging = path.join(scratch, 'staging');
    fs.mkdirSync(staging, { recursive: true });
    const outside = path.resolve(staging, '../../escape');
    fs.rmSync(outside, { recursive: true, force: true });

    const out = await gitCandidateStager({
      url: path.join(scratch, 'no-such-remote'),
      candidateSha: SHA,
      currentSha: SHA,
      pluginName: name,
      stagingRoot: staging,
    });

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('非法插件名不得取源成功');
    expect(out.reason).toBe('plugin-name-unusable');
    // 不得静默:detail 要点名被拒的那个名字
    expect(out.detail).toContain(JSON.stringify(name));
    expect(fs.existsSync(outside)).toBe(false);
    expect(fs.readdirSync(staging)).toEqual([]);
  });
});

/** 本地临时仓当"远端":零网络,只用来钉"合法名字能落、且落点真在根内" */
function initLocalRemote(): { repo: string; sha: string } {
  const repo = path.join(scratch, 'remote');
  fs.mkdirSync(repo, { recursive: true });
  execGitCapped(['init', '--initial-branch=main', '--', repo]);
  fs.writeFileSync(path.join(repo, 'plugin.json'), '{"name":"foo"}\n', 'utf8');
  execGitCapped(['-C', repo, 'add', '--', '.']);
  execGitCapped(['-C', repo, '-c', 'user.email=fixture@invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'v1']);
  return { repo, sha: execGitCapped(['-C', repo, 'rev-parse', 'HEAD']).trim().toLowerCase() };
}

describe('F-071 落点恒在 stagingRoot 内 + 失败清理', () => {
  it('合法名字:落点是 resolve 后根内的一段(正对照,防断言把正常路径也拒掉)', async () => {
    const { repo, sha } = initLocalRemote();
    const staging = createStagingRoot('ihui-f071', scratch);

    const out = await gitCandidateStager({ url: repo, candidateSha: sha, currentSha: sha, pluginName: 'foo', stagingRoot: staging });

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error(`夹具取源失败:${out.reason} ${out.detail ?? ''}`);
    const rel = path.relative(path.resolve(staging), path.resolve(out.repoDir));
    expect(rel).toBe('foo');
    expect(out.ledger.length).toBeGreaterThan(0);
  });

  it('clone 失败:本次新建的暂存子目录被清掉,暂存根里不留残骸', async () => {
    const staging = createStagingRoot('ihui-f071', scratch);

    const out = await gitCandidateStager({
      url: path.join(scratch, 'no-such-remote'),
      candidateSha: SHA,
      currentSha: SHA,
      pluginName: 'foo',
      stagingRoot: staging,
    });

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('不存在的远端不得取源成功');
    expect(out.reason).toBe('candidate-staging-failed');
    expect(fs.existsSync(path.join(staging, 'foo'))).toBe(false);
    expect(fs.readdirSync(staging)).toEqual([]);
  });
});

describe('F-071 planUpdate 对非法 name 先停:不派生落点、不建暂存根', () => {
  it('清单里的 ../../escape 被点名为 plugin-name-unusable', async () => {
    const ihuiHome = path.join(scratch, 'ihui-home');
    fs.mkdirSync(ihuiHome, { recursive: true });
    process.env.IHUI_HOME = ihuiHome;

    const record: InstallRecord = {
      name: '../../escape',
      sourceType: 'git',
      sourceUrl: path.join(scratch, 'no-such-remote'),
      sha: SHA,
      installedAt: '2026-01-01T00:00:00.000Z',
    };
    const plan = await planUpdate({
      records: [record],
      pluginsRoot: path.join(ihuiHome, '.ihui', 'installed-plugins'),
      marketplaces: { ok: true, marketplaces: [{ name: 'fixture' }], source: 'explicit' },
      remotes: async () => ({ ok: false, reason: 'remote-head-unknown', detail: 'fixture' }),
    });

    const entry = plan.entries[0]!;
    expect(entry.status).toBe('unjudged');
    expect(entry.reason).toBe('plugin-name-unusable');
    expect(entry.missingInputs).toContain('plugin-name-unusable');
    expect(entry.detail).toContain('../../escape');
    // 只读命令不得产生根外写副作用:连默认暂存根都没建
    expect(fs.existsSync(path.join(ihuiHome, '.ihui', 'update-staging'))).toBe(false);
    expect(fs.existsSync(path.join(scratch, 'escape'))).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
