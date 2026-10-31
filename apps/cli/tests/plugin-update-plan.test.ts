// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-22 autoUpdate 判据层的镜像用例(2026-11-01,只出计划不落盘的那一半)。
 *
 * 钉住的是**副作用没发生**,不是返回了哪句文案(与本仓"越权用例必须断言副作用没发生"同型):
 *   ① 远端有直接后继且校验通过 ⇒ planned
 *   ② 校验不过(未登记文件混入 / 已登记文件字节被改)⇒ refused **且原装机目录逐字节未变**
 *   ③ 本地已脏 ⇒ 让路并逐条点名,**连取源都不发**(stager 调用次数是量出来的)
 *   ④ 市场未登记 / 远端取不到 ⇒ unjudged 并点名缺的输入,**绝不返回 up-to-date**
 *   ⑤ 拿不到祖先关系 ⇒ unjudged 不猜(跳代另有确定档 refused)
 *   ⑥ 形状锁:判据层与本测试**都没有第二份哈希/比对实现**(摘要 import 写侧采集器,比对 import 门 277)
 *
 * 夹具:本地临时 git 仓当"远端"(`git ls-remote` / `git clone` 对本地路径同样成立 ⇒ 全程零网络);
 * 落点唯一取 `scripts/lib/scratch-dir.mjs` 的 mkScratch(AGENTS §15c/§26:禁工作树内嵌套 git 仓、
 * 禁 os.tmpdir)。装机根经 `IHUI_HOME` 覆盖隔离,绝不碰真 `~/.ihui`。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import { execGitCapped } from '../src/plugins/git-runner.js';
import {
  collectInstallFileDigests,
  saveInstallRegistry,
  type InstallRecord,
} from '../src/plugins/installer.js';
import {
  loadRegisteredMarketplaces,
  explicitMarketplaces,
  resolveMarketplaceEntryForRecord,
  getMarketplaceRegistryPath,
} from '../src/plugins/marketplace.js';
import {
  checkUpdates,
  planUpdate,
  gitCandidateStager,
  gitAncestryJudge,
  gitRemoteHeadReader,
  lsRemoteSha,
  parseLsRemoteOutput,
  locateIntegrityGateFile,
  type CandidateStager,
  type RemoteHeadReader,
  type UpdatePlanReport,
  type CheckUpdatesReport,
} from '../src/plugins/update-plan.js';
import { runPluginUpdatesCli, exitCodeOf } from '../src/commands/plugin-updates.js';

// ==================== 夹具(全部落在 scratch 内) ====================

let scratch = '';
let remote = '';
let installedRoot = '';
let installedDir = '';
let marketRoot = '';
let staging = '';

const gitAt = (cwd: string, args: readonly string[]): string => execGitCapped(['-C', cwd, ...args]);

const COMMIT_CONFIG = ['-c', 'user.email=fixture@invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false'];

function writeTree(repo: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(repo, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf8');
  }
}

/** 真造一次 commit:sha 由 git 给(内容寻址),本测试一律不自算摘要 */
function initAndCommit(repo: string, files: Record<string, string>, message: string): string {
  fs.mkdirSync(repo, { recursive: true });
  execGitCapped(['init', '--initial-branch=main', '--', repo]);
  writeTree(repo, files);
  gitAt(repo, ['add', '--', '.']);
  gitAt(repo, [...COMMIT_CONFIG, 'commit', '-q', '-m', message]);
  return gitAt(repo, ['rev-parse', 'HEAD']).trim().toLowerCase();
}

function commitMore(repo: string, files: Record<string, string>, message: string): string {
  writeTree(repo, files);
  gitAt(repo, ['add', '--', '.']);
  gitAt(repo, [...COMMIT_CONFIG, 'commit', '-q', '-m', message]);
  return gitAt(repo, ['rev-parse', 'HEAD']).trim().toLowerCase();
}

/** 一枚"已登记市场"的本地检出根:里面放 `.ihui-plugin/marketplace.json`(远端 = 本地 git 仓) */
function writeMarketplace(url: string, ref = 'main'): void {
  const dir = path.join(marketRoot, '.ihui-plugin');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'marketplace.json'),
    JSON.stringify({
      name: 'fixture-market',
      owner: { name: 'fixture' },
      plugins: [{ name: 'foo', version: '1.0.0', source: { source: 'url', url, ref } }],
    }),
    'utf8',
  );
}

/** 市场远端头的读法:**真发 git ls-remote**,只是把"远端"换成本地仓(零网络;生产档的形状白名单不因此放宽) */
const localRemotes: RemoteHeadReader = async ({ url, ref }) => lsRemoteSha(url, ref);

/**
 * 把 v1 取到装机位置 —— 用**生产取源器**造面(测试不复刻 clone/checkout 的 argv 组合),
 * 然后剥掉 `.git`(装机副本的账本只该覆盖插件内容),台账 = 剥完之后再问写侧采集器。
 */
async function materializeInstalledAt(url: string, sha: string): Promise<InstallRecord> {
  const staged = await gitCandidateStager({
    url,
    candidateSha: sha,
    currentSha: sha,
    pluginName: 'foo',
    stagingRoot: installedRoot,
  });
  if (!staged.ok) throw new Error(`夹具取源失败:${staged.reason} ${staged.detail ?? ''}`);
  installedDir = staged.stagedDir;
  fs.rmSync(path.join(installedDir, '.git'), { recursive: true, force: true });
  const ledger = collectInstallFileDigests(installedDir);
  if (!ledger) throw new Error('夹具:装机副本的逐文件台账采不到(前置不成立,不往下判)');
  return {
    name: 'foo',
    version: '1.0.0',
    sourceType: 'git',
    sourceUrl: url,
    sha,
    installedAt: new Date(0).toISOString(),
    fileDigests: ledger,
  };
}

/** 目录面的"逐字节快照" = 写侧采集器的产出(不另写一份哈希,§0.6) */
const snapshot = (dir: string): string => JSON.stringify(collectInstallFileDigests(dir) ?? null);

beforeEach(() => {
  scratch = mkScratch('plugin-update-');
  process.env.IHUI_HOME = path.join(scratch, 'home');
  fs.mkdirSync(process.env.IHUI_HOME, { recursive: true });
  remote = path.join(scratch, 'remote');
  installedRoot = path.join(scratch, 'installed');
  marketRoot = path.join(scratch, 'market');
  staging = path.join(scratch, 'staging');
  fs.mkdirSync(installedRoot, { recursive: true });
  fs.mkdirSync(marketRoot, { recursive: true });
  fs.mkdirSync(staging, { recursive: true });
});

afterEach(() => {
  rmScratch(scratch);
  delete process.env.IHUI_HOME;
});

// ==================== ① 有直接后继且校验通过 ⇒ planned ====================

describe('checkUpdates / planUpdate(直接后继)', () => {
  it('① 远端有直接后继 ⇒ available → planned,带 from/to 与新台账的文件数,装机目录逐字节不动', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo","version":"1.0.0"}\n', 'lib/a.js': 'export const a=1;\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    const v2 = commitMore(remote, { 'lib/a.js': 'export const a=2;\n' }, 'v2');
    writeMarketplace(remote);
    const before = snapshot(installedDir);

    const report = await checkUpdates({
      records: [record],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
    });
    expect(report.verdict).toBe('available');
    expect(report.checks[0]?.state).toBe('available');
    expect(report.checks[0]?.remoteSha).toBe(v2);
    expect(report.checks[0]?.marketplace).toBe('market');

    const plan = await planUpdate({
      records: [record],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
      stagingRoot: staging,
    });
    expect(plan.status).toBe('planned');
    expect(plan.entries[0]).toMatchObject({
      status: 'planned',
      localState: 'clean',
      integrity: 'pass',
      aheadBy: 1,
      from: { url: remote, commit: v1, marketplace: 'market' },
      to: { commit: v2 },
    });
    expect(plan.entries[0]?.to?.files).toBeGreaterThan(0);
    expect(snapshot(installedDir)).toBe(before);
  });

  it('①b 已是最新 ⇒ up-to-date;点名时要落一行 no-op(默认集里没有可落的东西 ⇒ nothing-to-plan)', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo","version":"1.0.0"}\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    writeMarketplace(remote);
    const before = snapshot(installedDir);

    const report = await checkUpdates({
      records: [record],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
    });
    expect(report.verdict).toBe('up-to-date');

    const auto = await planUpdate({
      records: [record],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
      stagingRoot: staging,
    });
    expect(auto.status).toBe('nothing-to-plan');

    const named = await planUpdate({
      records: [record],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
      stagingRoot: staging,
      names: ['foo'],
    });
    expect(named.entries[0]?.status).toBe('no-op');
    expect(named.entries[0]?.reason).toBe('already-up-to-date');
    expect(fs.readdirSync(staging)).toEqual([]);
    expect(snapshot(installedDir)).toBe(before);
  });
});

// ==================== ② 校验不过 ⇒ 拒绝落地,原目录逐字节未变 ====================

describe('拉取后必须验(超越轴①)', () => {
  /** 包装生产 stager:在采集台账**之后**动手 —— 正是"取回来以后被改过"这一档要拦的形态 */
  function tamperingStager(tamper: (dir: string) => void): CandidateStager {
    return async (p) => {
      const out = await gitCandidateStager(p);
      if (!out.ok) return out;
      tamper(out.stagedDir);
      return out;
    };
  }

  it('②a 新副本里混入未登记文件 ⇒ refused(staged-integrity-fail),装机目录逐字节未变', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo","version":"1.0.0"}\n', 'lib/a.js': 'export const a=1;\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    const before = snapshot(installedDir);
    commitMore(remote, { 'lib/a.js': 'export const a=2;\n' }, 'v2');
    writeMarketplace(remote);

    const plan = await planUpdate({
      records: [record],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
      stager: tamperingStager((dir) => fs.writeFileSync(path.join(dir, 'INJECTED.txt'), '从市场里混进来的未登记文件\n')),
      stagingRoot: staging,
    });
    const entry = plan.entries[0]!;
    expect(entry.status).toBe('refused');
    expect(entry.reason).toBe('staged-integrity-fail');
    expect(entry.integrity).toBe('fail');
    expect(entry.stagedDrift?.unlisted).toContain('INJECTED.txt');
    // 断言副作用没发生(不是断言返回了错误文案)
    expect(snapshot(installedDir)).toBe(before);
    expect(fs.existsSync(path.join(installedDir, 'INJECTED.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(installedDir, 'lib', 'a.js'), 'utf8')).toContain('export const a=1;');
  });

  it('②b 已登记文件的字节被改 ⇒ refused 并点名 mismatch 的路径', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo","version":"1.0.0"}\n', 'lib/a.js': 'export const a=1;\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    const before = snapshot(installedDir);
    commitMore(remote, { 'plugin.json': '{"name":"foo","version":"2.0.0"}\n' }, 'v2');
    writeMarketplace(remote);

    const plan = await planUpdate({
      records: [record],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
      stager: tamperingStager((dir) => fs.writeFileSync(path.join(dir, 'lib', 'a.js'), 'export const a=999;\n')),
      stagingRoot: staging,
    });
    expect(plan.entries[0]?.status).toBe('refused');
    expect(plan.entries[0]?.stagedDrift?.mismatch.map((m) => m.path)).toContain('lib/a.js');
    expect(snapshot(installedDir)).toBe(before);
  });

  it('②c 门 277 不在手边(发布态不含 scripts/)⇒ unjudged,绝不回落成"自己算一遍"', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo","version":"1.0.0"}\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    commitMore(remote, { 'plugin.json': '{"name":"foo","version":"2.0.0"}\n' }, 'v2');
    writeMarketplace(remote);
    const saved = process.env.IHUI_PLUGIN_INTEGRITY_GATE;
    process.env.IHUI_PLUGIN_INTEGRITY_GATE = path.join(scratch, 'no-such-gate.mjs');
    try {
      const plan = await planUpdate({
        records: [record],
        pluginsRoot: installedRoot,
        marketplaces: explicitMarketplaces([marketRoot]),
        remotes: localRemotes,
        stagingRoot: staging,
      });
      expect(plan.entries[0]?.status).toBe('unjudged');
      expect(plan.entries[0]?.missingInputs).toContain('integrity-judgement-unavailable');
      expect(snapshot(installedDir)).toBe(JSON.stringify(record.fileDigests));
      expect(fs.readdirSync(staging)).toEqual([]);
    } finally {
      if (saved === undefined) delete process.env.IHUI_PLUGIN_INTEGRITY_GATE;
      else process.env.IHUI_PLUGIN_INTEGRITY_GATE = saved;
    }
  });
});

// ==================== ③ 本地脏 ⇒ 让路,不动盘也不发取源 ====================

describe('本地脏就停(超越轴②)', () => {
  it('③ 装机目录相对台账已有改动 ⇒ refused 逐条点名,stager 一次都没被调用', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo","version":"1.0.0"}\n', 'lib/a.js': 'export const a=1;\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    // 用户自己改过本地副本(改一行实现)+ 一枚未登记的调试产物
    fs.writeFileSync(path.join(installedDir, 'lib', 'a.js'), '// 本机手改,不能被更新覆盖\n');
    fs.writeFileSync(path.join(installedDir, 'my-notes.md'), '# 我的笔记\n');
    const before = snapshot(installedDir);
    commitMore(remote, { 'lib/a.js': 'export const a=2;\n' }, 'v2');
    writeMarketplace(remote);

    let stagerCalls = 0;
    const counting: CandidateStager = async (p) => {
      stagerCalls += 1;
      return gitCandidateStager(p);
    };

    const plan = await planUpdate({
      records: [record],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
      stager: counting,
      stagingRoot: staging,
    });
    const entry = plan.entries[0]!;
    expect(entry.status).toBe('refused');
    expect(entry.reason).toBe('local-drift-defers');
    expect(entry.localState).toBe('drift');
    expect(entry.localDrift?.mismatch.map((m) => m.path)).toContain('lib/a.js');
    expect(entry.localDrift?.unlisted).toContain('my-notes.md');
    // 副作用面:没取源、没落盘、本地改动逐字节仍在
    expect(stagerCalls).toBe(0);
    expect(snapshot(installedDir)).toBe(before);
    expect(fs.readFileSync(path.join(installedDir, 'lib', 'a.js'), 'utf8')).toContain('本机手改');
    expect(fs.readdirSync(staging)).toEqual([]);
  });

  it('③b 老记录没有台账(接线前写的存量)⇒ unjudged:既不判"能更新"也不判"被篡改"', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo","version":"1.0.0"}\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    const noLedger: InstallRecord = { ...record };
    delete noLedger.fileDigests;
    commitMore(remote, { 'plugin.json': '{"name":"foo","version":"2.0.0"}\n' }, 'v2');
    writeMarketplace(remote);

    const plan = await planUpdate({
      records: [noLedger],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
      stagingRoot: staging,
    });
    expect(plan.entries[0]?.status).toBe('unjudged');
    expect(plan.entries[0]?.missingInputs).toContain('installed-integrity-ledger-field-absent');
    expect(fs.readdirSync(staging)).toEqual([]);
  });
});

// ==================== ④ 取不到输入 ⇒ unjudged(不冒充 up-to-date) ====================

describe('取不到不冒充(§0.3)', () => {
  it('④a 市场未登记(台账文件不存在)⇒ unjudged 并点名缺 marketplaces.json,一条 up-to-date 都不许有', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo","version":"1.0.0"}\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    // 真走默认取值:IHUI_HOME 指向空 home ⇒ 登记台账必然不存在
    expect(fs.existsSync(getMarketplaceRegistryPath())).toBe(false);
    const loaded = loadRegisteredMarketplaces();
    expect(loaded.ok).toBe(false);
    expect(loaded.reason).toBe('marketplace-registry-file-absent');

    const report = await checkUpdates({ records: [record], pluginsRoot: installedRoot, marketplaces: loaded, remotes: localRemotes });
    expect(report.verdict).toBe('unjudged');
    expect(report.counts.upToDate).toBe(0);
    expect(report.counts.available).toBe(0);
    expect(report.checks[0]?.state).toBe('unjudged');
    expect(report.checks[0]?.missingInputs).toContain('marketplace-not-registered');
  });

  it('④b 记录里的源与登记市场的条目对不上 ⇒ unjudged(source-mismatch),不猜哪个是源头', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo"}\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    writeMarketplace(remote);
    const other = path.join(scratch, 'some-other-url.git');
    const report = await checkUpdates({
      records: [{ ...record, sourceUrl: other }],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
    });
    expect(report.verdict).toBe('unjudged');
    expect(report.counts.upToDate).toBe(0);
    expect(report.checks[0]?.missingInputs).toContain('marketplace-url-differs-from-installed-source');
  });

  it('④c 远端取不到(真派生 git 说不)⇒ unjudged 点名 remote-head-unknown', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo"}\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    writeMarketplace(remote);
    const report = await checkUpdates({
      records: [record],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: async () => lsRemoteSha(path.join(scratch, 'definitely-not-a-repo'), 'main'),
    });
    expect(report.verdict).toBe('unjudged');
    expect(report.counts.upToDate).toBe(0);
    expect(report.checks[0]?.state).toBe('unjudged');
    expect(report.checks[0]?.missingInputs).toContain('remote-head-unknown');
    expect(report.checks[0]?.reason).toBe('remote-unreachable');
  });

  it('④d 记录里没有 commit pin ⇒ unjudged(installed-commit-unknown),连"从哪一代出发"都不编', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo"}\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    writeMarketplace(remote);
    const noSha: InstallRecord = { ...record };
    delete noSha.sha;
    const report = await checkUpdates({
      records: [noSha],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
    });
    expect(report.checks[0]?.state).toBe('unjudged');
    expect(report.checks[0]?.missingInputs).toContain('installed-commit-unknown');
  });

  it('④e 生产远端读取器不吃裸路径 / file:// / 前导横杠 ⇒ git-input-rejected(白名单同 cache.ts 咽喉点)', async () => {
    for (const bad of [remote, 'file:///tmp/x.git', '--upload-pack=/bin/sh', 'https://user:tok@host/x.git']) {
      const r = await gitRemoteHeadReader({ url: bad, ref: 'main' });
      expect(`${bad}:${r.ok}`).toBe(`${bad}:false`);
      if (!r.ok) expect(r.reason).toBe('git-input-rejected');
    }
  });

  it('④f ls-remote 输出的三档:命中 / 零命中 / 多枚不同 commit,绝不并桶', () => {
    const sha = 'a'.repeat(40);
    expect(parseLsRemoteOutput(`${sha}\trefs/heads/main\n`, 'main')).toEqual({ ok: true, sha });
    expect(parseLsRemoteOutput(`${sha}\trefs/heads/main^{}\n${sha}\trefs/heads/main\n`, 'main')).toEqual({ ok: true, sha });
    expect(parseLsRemoteOutput('', 'main')).toMatchObject({ ok: false, reason: 'remote-ref-empty' });
    expect(parseLsRemoteOutput(`${sha}\trefs/heads/main\n${'b'.repeat(40)}\trefs/heads/main\n`, 'main'))
      .toMatchObject({ ok: false, reason: 'remote-ref-ambiguous' });
  });
});

// ==================== ⑤ 祖先关系:一次只进一步 ====================

describe('一次只进一步', () => {
  it('⑤a 装机 commit 不在取回的历史里(无祖先关系)⇒ unjudged 不猜', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo","version":"1.0.0"}\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    const v2 = commitMore(remote, { 'plugin.json': '{"name":"foo","version":"2.0.0"}\n' }, 'v2');
    writeMarketplace(remote);
    // 另一枚**无关历史**的仓(不同根 commit):它的 sha 在取回的历史里必然解析不到
    const unrelated = initAndCommit(path.join(scratch, 'unrelated'), { 'x.txt': 'x\n' }, 'other-lineage');

    const plan = await planUpdate({
      records: [{ ...record, sha: unrelated }],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
      stagingRoot: staging,
    });
    expect(plan.entries[0]?.status).toBe('unjudged');
    expect(plan.entries[0]?.missingInputs).toContain('commit-ancestry-unavailable');
    expect(plan.entries[0]?.reason).toBe('current-commit-unreachable');
    expect(plan.entries[0]?.to?.commit).toBe(v2);
    expect(snapshot(installedDir)).toBe(JSON.stringify(record.fileDigests));
  });

  it('⑤b 领先两枚 ⇒ refused(not-direct-successor):不接受跳代,也不动盘', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo","version":"1.0.0"}\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    commitMore(remote, { 'lib/mid.js': 'export const mid=1;\n' }, 'v1.5');
    const v2 = commitMore(remote, { 'plugin.json': '{"name":"foo","version":"2.0.0"}\n' }, 'v2');
    writeMarketplace(remote);

    const plan = await planUpdate({
      records: [record],
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
      stagingRoot: staging,
    });
    expect(plan.entries[0]?.status).toBe('refused');
    expect(plan.entries[0]?.reason).toBe('not-direct-successor');
    expect(plan.entries[0]?.aheadBy).toBe(2);
    expect(plan.entries[0]?.to?.commit).toBe(v2);
    expect(snapshot(installedDir)).toBe(JSON.stringify(record.fileDigests));
  });

  it('⑤c 祖先判据本身四档可分辨(全用真 git;125 与"不是祖先"不得并桶)', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': 'a\n' }, 'v1');
    const v2 = commitMore(remote, { 'plugin.json': 'b\n' }, 'v2');
    const v3 = commitMore(remote, { 'plugin.json': 'c\n' }, 'v3');
    const staged = await gitCandidateStager({
      url: remote,
      candidateSha: v3,
      currentSha: v3,
      pluginName: 'probe',
      stagingRoot: staging,
    });
    if (!staged.ok) throw new Error(`夹具取源失败:${staged.reason}`);

    expect(await gitAncestryJudge({ repoDir: staged.repoDir, currentSha: v2, candidateSha: v3 }))
      .toEqual({ ok: true, relation: 'direct-successor', aheadBy: 1 });
    expect(await gitAncestryJudge({ repoDir: staged.repoDir, currentSha: v1, candidateSha: v3 }))
      .toMatchObject({ ok: true, relation: 'ahead', aheadBy: 2 });
    // 反向(远端落后于装机代):这是**确定结论** not-descendant,不是"判不出"
    expect(await gitAncestryJudge({ repoDir: staged.repoDir, currentSha: v3, candidateSha: v1 }))
      .toMatchObject({ ok: true, relation: 'not-descendant', aheadBy: 0 });
    expect(await gitAncestryJudge({ repoDir: staged.repoDir, currentSha: 'f'.repeat(40), candidateSha: v3 }))
      .toMatchObject({ ok: false, reason: 'current-commit-unreachable' });
  });
});

// ==================== 市场条目解析(复用既有索引判据) ====================

describe('市场条目解析', () => {
  it('未登记 / 条目不是 git 源 / 登记台账形状坏,三档各自点名缺的输入', () => {
    expect(resolveMarketplaceEntryForRecord({ name: 'foo', sourceUrl: 'https://x/y.git' }, []).state).toBe('not-registered');

    fs.mkdirSync(path.join(marketRoot, '.ihui-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(marketRoot, '.ihui-plugin', 'marketplace.json'),
      JSON.stringify({ name: 'm', plugins: [{ name: 'foo', source: { type: 'local', path: './foo' } }] }),
      'utf8',
    );
    const r = resolveMarketplaceEntryForRecord({ name: 'foo', sourceUrl: 'https://x/y.git' }, [{ name: 'market', root: marketRoot }]);
    expect(r.state).toBe('entry-not-git');
    if (r.state === 'entry-not-git') expect(r.marketplace).toBe('market');

    // 登记台账形状坏 ⇒ 整面不判,不静默丢条目(§0.3)
    const bad = path.join(scratch, 'bad-marketplaces.json');
    fs.writeFileSync(bad, JSON.stringify({ version: 1, marketplaces: [{ root: 'x' }] }), 'utf8');
    const loaded = loadRegisteredMarketplaces({ file: bad });
    expect(loaded.ok).toBe(false);
    expect(loaded.reason).toBe('marketplace-registry-malformed');
    expect(loaded.marketplaces).toEqual([]);
  });
});

// ==================== CLI 出口(默认零副作用 + 档位可分辨) ====================

describe('CLI plugin-updates', () => {
  const quiet = () => vi.spyOn(console, 'log').mockImplementation(() => {});

  it('空装机面 ⇒ 退出码 2(枚举到 0 条 = 没有输入),而且一个暂存目录都不建', async () => {
    const spy = quiet();
    try {
      const r = await runPluginUpdatesCli(['--check-updates', '--plan-update', '--marketplace', marketRoot, '--plugins-root', installedRoot]);
      expect(r.exitCode).toBe(2);
      expect(r.checks?.verdict).toBe('unjudged');
      expect(r.plan?.preVerdict).toBe('unjudged');
    } finally {
      spy.mockRestore();
    }
    expect(fs.existsSync(path.join(process.env.IHUI_HOME!, '.ihui', 'update-staging'))).toBe(false);
  });

  it('CLI 走生产远端档时不吃裸路径 ⇒ 未判定顶到退出码,装机目录逐字节未变(不冒充"查过了")', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo","version":"1.0.0"}\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    commitMore(remote, { 'plugin.json': '{"name":"foo","version":"2.0.0"}\n' }, 'v2');
    writeMarketplace(remote);
    saveInstallRegistry({ records: [record] });
    const before = snapshot(installedDir);

    const spy = quiet();
    let exitCode = -1;
    let plan: UpdatePlanReport | undefined;
    try {
      const r = await runPluginUpdatesCli(['--plan-update', '--marketplace', marketRoot, '--plugins-root', installedRoot]);
      exitCode = r.exitCode;
      plan = r.plan;
    } finally {
      spy.mockRestore();
    }
    expect(plan?.entries[0]?.status).toBe('unjudged');
    expect(plan?.entries[0]?.reason).toBe('git-input-rejected');
    expect(exitCode).toBe(2);
    expect(snapshot(installedDir)).toBe(before);
    expect(fs.existsSync(path.join(process.env.IHUI_HOME!, '.ihui', 'update-staging'))).toBe(false);
  });

  it('退出码档位表:0 全绿 / 1 有 refused 或有更新未落 / 2 任何未判定(§0.3 优先级最高)', () => {
    const checks = (verdict: CheckUpdatesReport['verdict'], counts: Partial<CheckUpdatesReport['counts']>): CheckUpdatesReport => ({
      verdict,
      checks: [],
      counts: { upToDate: 0, available: 0, unjudged: 0, ...counts },
    });
    const plan = (over: Partial<UpdatePlanReport>): UpdatePlanReport => ({
      status: 'planned',
      preVerdict: 'available',
      entries: [],
      counts: { planned: 0, noop: 0, refused: 0, unjudged: 0 },
      ...over,
    });
    expect(exitCodeOf(null, checks('up-to-date', { upToDate: 1 }))).toBe(0);
    expect(exitCodeOf(null, checks('available', { available: 1 }))).toBe(1);
    expect(exitCodeOf(plan({ counts: { planned: 1, noop: 0, refused: 0, unjudged: 0 } }), checks('available', { available: 1 }))).toBe(1);
    expect(exitCodeOf(plan({ status: 'blocked', counts: { planned: 0, noop: 0, refused: 1, unjudged: 0 } }), null)).toBe(1);
    // 未判定永远压过"有更新"与"已规划"
    expect(exitCodeOf(plan({}), checks('unjudged', { unjudged: 1 }))).toBe(2);
    expect(exitCodeOf(plan({ status: 'unjudged', counts: { planned: 1, noop: 0, refused: 0, unjudged: 1 } }), null)).toBe(2);
    expect(exitCodeOf(plan({ status: 'nothing-to-plan', preVerdict: 'unjudged' }), null)).toBe(2);
  });
});

// ==================== ⑥ 形状锁:零复算(判据只有一份) ====================

describe('形状锁(§0.6/§22c:判据不得有第二份)', () => {
  const srcFile = fileURLToPath(new URL('../src/plugins/update-plan.ts', import.meta.url));
  const selfFile = fileURLToPath(new URL('plugin-update-plan.test.ts', import.meta.url));

  /**
   * 禁语用拼接写:本条锁判的是"这个文件里不得出现第二份哈希/比对实现",
   * 而判据字面量若原样出现在这里就会**判到自己**(门 238 同型的"判据字面量恰是禁语"教训)。
   */
  const join2 = (a: string, b: string) => `${a}${b}`;
  const FORBIDDEN_IN_SRC = [
    join2('create', 'Hash'),
    join2('node:', 'crypto'),
    join2('sha256', 'Hex'),
    'driftKeyOf',
    join2('judge', '('),
  ];
  const FORBIDDEN_IN_SELF = [join2('create', 'Hash'), join2('node:', 'crypto'), join2('sha256', 'Hex')];

  it('判据层里没有第二份哈希/比对实现,而门 277 确实被定位到(不是写了没接线)', () => {
    const src = fs.readFileSync(srcFile, 'utf8');
    expect(src).toContain("from './installer.js'");
    expect(src).toContain('collectInstallFileDigests');
    expect(src).toContain('check-plugin-manifest-integrity.mjs');
    for (const forbidden of FORBIDDEN_IN_SRC) {
      expect(src, `判据层不得出现第二份实现:${forbidden}`).not.toContain(forbidden);
    }
    expect(locateIntegrityGateFile([path.dirname(srcFile)])).toContain('check-plugin-manifest-integrity.mjs');
  });

  it('本测试自己也遵守同一条纪律:摘要只问写侧采集器,不复刻判据', () => {
    const self = fs.readFileSync(selfFile, 'utf8');
    for (const forbidden of FORBIDDEN_IN_SELF) {
      expect(self, `测试里不得出现 ${forbidden}(要 import 那份判据)`).not.toContain(forbidden);
    }
    expect(self).toContain('collectInstallFileDigests');
  });

  it('装机面只经 saveInstallRegistry 落台账;默认取记录面 = loadInstallRegistry()', async () => {
    const v1 = initAndCommit(remote, { 'plugin.json': '{"name":"foo","version":"1.0.0"}\n' }, 'v1');
    const record = await materializeInstalledAt(remote, v1);
    commitMore(remote, { 'plugin.json': '{"name":"foo","version":"2.0.0"}\n' }, 'v2');
    writeMarketplace(remote);
    saveInstallRegistry({ records: [record] });

    const report = await checkUpdates({
      pluginsRoot: installedRoot,
      marketplaces: explicitMarketplaces([marketRoot]),
      remotes: localRemotes,
    });
    expect(report.checks.map((c) => c.name)).toContain('foo');
    expect(report.checks[0]?.state).toBe('available');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
