// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-22 autoUpdate 的**判据层**(2026-11-01,rea 逆向对照 Qoder CN 插件市场面后的补齐票)。
 *
 * 对照程序的一手事实(取证册 T3 §G-22 / T7 §3,装机实证;本席只取结构与字段名、绝不取值):
 *   Qoder CN 的用户态插件面有 `known_marketplaces.json`(携 `autoUpdate`)+ 同一插件
 *   **多版本目录并存**(`cache/<bundler>/<插件名>/runtime/`),载荷按内容寻址
 *   (`archives/<插件>/<sha256>.zip`,实测文件名 == 该归档自身的 sha256)。
 *   它的"自动更新"只做两件事:取到新版本 + 留下旧版本。
 *
 * 本仓的超越轴(三条都是硬判据,不是流程约定):
 *   1. **验不过就不落** —— 取回的新副本必须逐文件通过门 277 的完整性判定;任何 `drift`
 *      (尤其 `unlisted`:未登记文件混入)⇒ 拒绝落地,装机目录一步不动。对方没有这一环。
 *   2. **本地脏就停** —— 目标目录相对其安装台账只要存在 drift/missing/unlisted 就让路并逐条点名,
 *      **绝不覆盖用户本地改动**。对方留旧版本目录,本仓更进一步:脏就不动新的。
 *   3. **取不到不冒充** —— 远端取不到、市场未登记、本地无台账、祖先关系拿不到,一律 `unjudged`
 *      并点名缺哪一枚输入(AGENTS §0.3),绝不把"没查过"写成"已是最新"。
 *
 * 射程边界(本席刻意不做的,详见交付报告):
 *   - **只出计划,不落盘**:没有 `--apply`。写 registry 要接 `safe-commit` 五步法与 `git-lock`,
 *     派发要接 `git-guardian` tick —— 归后续票。
 *   - **不新增依赖、不自己发 HTTP**:取源只走 `git-runner.ts`(AGENTS §3 复用优先)。
 *   - **不复制判据**:哈希只有写侧那一份(`installer.ts:507 collectInstallFileDigests`),
 *     三态比对只有门 277 那一份(运行时动态 import)。
 *     为什么是动态 import 而不是静态:`apps/cli/tsconfig.json` 写死 `rootDir: "src"`,
 *     src 静态 import `scripts/**` 直接 TS6059,而发布清单 `files:["dist","src"]` 不含 `scripts/`
 *     —— 这条边界在 `cache.ts:301-303` 已写在案。所以"门不在手边"是本档**结构上的合法态**,
 *     它的唯一出口是 `unjudged('integrity-gate-unavailable')`,而不是"自己再算一遍"(§0.6)。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  GIT_NETWORK_TIMEOUT_MS,
  classifyGitFailure,
  execGitCapped,
  type GitSpawnOptions,
} from './git-runner.js';
import {
  collectInstallFileDigests,
  loadInstallRegistry,
  type InstallFileDigest,
  type InstallRecord,
} from './installer.js';
import { assertGitCloneInputs, evaluateGitSha } from './url-shape.js';
import { getIhuiRoot, getInstalledPluginsDir } from './paths.js';
import {
  loadRegisteredMarketplaces,
  resolveMarketplaceEntryForRecord,
  type RegisteredMarketplacesOutcome,
} from './marketplace.js';

// ==================== 门 277 的取材(唯一比对判据持有者) ====================

/** 台账条目形状(与 `InstallFileDigest` 同一契约;这里只是消费侧的**声明**,不含任何算子) */
export interface IntegrityLedgerEntry {
  path: string;
  sha256: string;
  bytes: number;
}

/** 门 277 `judgeRecord` 的结论形状(字段逐字取自门体;声明形状 ≠ 复算判据) */
export interface IntegrityJudgement {
  name: string;
  state: 'ok' | 'drift' | 'unjudged';
  reason?: string;
  pending?: boolean;
  errno?: string;
  missing?: string[];
  mismatch?: Array<{ path: string; expectedSha: string; actualSha: string }>;
  unlisted?: string[];
  linksAtRegisteredPath?: string[];
  counts?: { ledger: number; disk: number; missing: number; mismatch: number; unlisted: number };
}

/** 门 277 暴露给本档的**唯一**判据出口(其余字段一概不声明、不使用) */
export interface PluginIntegrityGate {
  judgeRecord(record: unknown, pluginsRoot: string): IntegrityJudgement;
}

const GATE_SCRIPT = path.join('scripts', 'check-plugin-manifest-integrity.mjs');
/** 门体路径的显式覆盖位(打包态 CLI 拿不到仓内 `scripts/` 时的人工出口,不是第二份判据) */
const GATE_PATH_ENV = 'IHUI_PLUGIN_INTEGRITY_GATE';

export type GateLoadOutcome =
  | { ok: true; gate: PluginIntegrityGate; file: string }
  | { ok: false; reason: 'integrity-gate-unavailable' | 'integrity-gate-unusable'; detail: string };

let gateCache: { key: string; outcome: GateLoadOutcome } | null = null;

/** 从给定起点向上找仓根下的门体(不猜盘符、不硬编码绝对路径 —— AGENTS §15) */
export function locateIntegrityGateFile(startDirs: readonly string[]): string | null {
  const override = process.env[GATE_PATH_ENV];
  if (override) return fs.existsSync(override) ? override : null;
  for (const start of startDirs) {
    let dir = path.resolve(start);
    for (let depth = 0; depth < 8; depth += 1) {
      const candidate = path.join(dir, GATE_SCRIPT);
      if (fs.existsSync(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

/**
 * 取门 277 的判据(动态 import,按解析到的路径缓存一次)。
 * 取不到 ⇒ `ok:false` + 点名;**调用方必须把这一刻判成 `unjudged`,不得自己算**(§0.6/§0.3)。
 */
export async function loadIntegrityGate(
  startDirs: readonly string[] = [path.dirname(fileURLToPath(import.meta.url)), process.cwd()],
): Promise<GateLoadOutcome> {
  const file = locateIntegrityGateFile(startDirs);
  if (!file) {
    return {
      ok: false,
      reason: 'integrity-gate-unavailable',
      detail: `仓根向上八层内找不到 ${GATE_SCRIPT}(可用 ${GATE_PATH_ENV} 指定;发布态不含 scripts/ 属预期)`,
    };
  }
  if (gateCache && gateCache.key === file) return gateCache.outcome;
  let outcome: GateLoadOutcome;
  try {
    const mod = (await import(pathToFileURL(file).href)) as unknown as Partial<PluginIntegrityGate>;
    if (typeof mod.judgeRecord !== 'function') {
      outcome = { ok: false, reason: 'integrity-gate-unusable', detail: `${file} 未导出 judgeRecord(门体形状与消费侧声明的契约不符 ⇒ 不判定)` };
    } else {
      outcome = { ok: true, gate: { judgeRecord: mod.judgeRecord }, file };
    }
  } catch (e) {
    outcome = { ok: false, reason: 'integrity-gate-unusable', detail: `${file} 载入失败:${e instanceof Error ? e.message : String(e)}` };
  }
  gateCache = { key: file, outcome };
  return gateCache.outcome;
}

/** 缓存复位(自检与夹具之间隔离用;不是判据,只是模块级 memo 的清洁工) */
export function resetIntegrityGateCache(): void {
  gateCache = null;
}

type DirJudgeOutcome =
  | { ok: true; judgement: IntegrityJudgement }
  | { ok: false; reason: string; detail: string };

/**
 * 用门 277 判一次"某个目录 ↔ 某份逐文件台账"。
 * 门的 join 形态是 `<pluginsRoot>/<record.name>`,所以这里把绝对目录拆成 dirname + basename 递进去,
 * 拿回来的 `name` 换回插件名(结论里点名的对象是插件,不是暂存目录)。
 *
 * `ledger` 允许是 `undefined` —— 那是"接线前写的老记录",门给 `unjudged + pending:true`
 * (既不判 ok 也不判篡改)。刻意不把它包成空数组:空数组会被门的形状判据读成"台账坏",
 * 于是"本来就没有台账"被说成"被篡改"(§0.3 的两头都是假结论)。
 */
async function judgeDirectoryAgainstLedger(
  name: string,
  ledger: readonly IntegrityLedgerEntry[] | undefined,
  dirAbs: string,
): Promise<DirJudgeOutcome> {
  const loaded = await loadIntegrityGate();
  if (!loaded.ok) return { ok: false, reason: loaded.reason, detail: loaded.detail };
  try {
    const record: Record<string, unknown> = {
      name: path.basename(dirAbs),
      sourceType: 'git',
      installedAt: '',
    };
    if (ledger) record.fileDigests = [...ledger];
    const judgement = loaded.gate.judgeRecord(record, path.dirname(dirAbs));
    return { ok: true, judgement: { ...judgement, name } };
  } catch (e) {
    return { ok: false, reason: 'integrity-gate-error', detail: e instanceof Error ? e.message : String(e) };
  }
}

// ==================== 远端头与取源(只走 git-runner) ====================

export type RemoteHeadOutcome = { ok: true; sha: string } | { ok: false; reason: string; detail?: string };

/** 市场远端头的读取出口(注入位:生产 = `gitRemoteHeadReader`;测试 = 本地仓夹具) */
export type RemoteHeadReader = (p: { url: string; ref: string }) => Promise<RemoteHeadOutcome>;

/**
 * 解析 `git ls-remote --refs` 的 stdout。
 * 三条纪律:剥 peel 行(`^{}` 是同一个 ref 的展开形态,不是第二个候选);
 * 命中零条 ⇒ `remote-ref-empty`(绝不等于"没更新");命中多枚**不同 commit** ⇒ `remote-ref-ambiguous`(不猜)。
 */
export function parseLsRemoteOutput(stdout: string, ref: string): RemoteHeadOutcome {
  const hits = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.endsWith('^{}'))
    .map((l) => {
      const parts = l.split(/\s+/);
      return { sha: parts[0] ?? '', name: parts.slice(1).join(' ') };
    })
    .filter((h) => h.name === ref || h.name === `refs/heads/${ref}` || h.name === `refs/tags/${ref}`)
    .map((h) => h.sha.toLowerCase());
  const uniq = [...new Set(hits)];
  if (uniq.length === 0) return { ok: false, reason: 'remote-ref-empty', detail: `远端没有引用 ${ref}` };
  if (uniq.length > 1) {
    return { ok: false, reason: 'remote-ref-ambiguous', detail: `${ref} 命中 ${uniq.length} 枚不同 commit ⇒ 不猜哪一枚是新版本` };
  }
  return { ok: true, sha: uniq[0]! };
}

/** 真发一次 `git ls-remote`(只读,不写任何东西;stdio/windowsHide/超时由 `git-runner` 单点兜,§12g) */
export function lsRemoteSha(url: string, ref: string, opts: GitSpawnOptions = {}): RemoteHeadOutcome {
  try {
    return parseLsRemoteOutput(execGitCapped(['ls-remote', '--refs', '--', url, ref], opts), ref);
  } catch (e) {
    return { ok: false, reason: 'remote-unreachable', detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 生产远端头读取器:先过 **git 入参形状白名单**(与 `cache.ts::performClone` 同一咽喉点判据,
 * §0.6 不复抄),再发 ls-remote。`loopbackTestHook` 刻意不注入:市场下发的 URL 在本档只允许
 * https / ssh 形态,fail-closed 比"测试里方便"重要(`url-shape.ts:24-31` 头注同口径;
 * 测试要拿本地仓当远端,走 `remotes` 注入位,不靠放宽生产档)。
 */
export const gitRemoteHeadReader: RemoteHeadReader = async ({ url, ref }) => {
  try {
    assertGitCloneInputs({ url, ref });
  } catch (e) {
    const code = (e as { reasonCode?: unknown }).reasonCode;
    return { ok: false, reason: 'git-input-rejected', detail: typeof code === 'string' ? code : String(e) };
  }
  return lsRemoteSha(url, ref, { timeoutMs: GIT_NETWORK_TIMEOUT_MS });
};

/** 取回来的新副本:仓库根 + 实际待落目录 + **那一刻采到的逐文件台账** */
export type StageOutcome =
  | { ok: true; repoDir: string; stagedDir: string; ledger: InstallFileDigest[] }
  | { ok: false; reason: string; detail?: string };

export type CandidateStager = (p: {
  url: string;
  candidateSha: string;
  currentSha: string;
  pluginName: string;
  pluginSubdir?: string;
  stagingRoot: string;
}) => Promise<StageOutcome>;

/** 相对子目录能不能当路径用(与门 277 的 usableRecordName 同一条红线:拒 `..`/绝对/空) */
function usableSubdir(subdir: string | undefined): boolean {
  if (subdir === undefined) return true;
  if (typeof subdir !== 'string' || subdir.trim() === '') return false;
  if (path.isAbsolute(subdir)) return false;
  return !subdir.split(/[\\/]/).includes('..');
}

/** 本档取源的落点(在 `~/.ihui` 自家数据根下,**不落 os.tmpdir、不进仓库树**;AGENTS §15b/§26) */
export function getUpdateStagingDir(): string {
  const override = process.env.IHUI_PLUGIN_UPDATE_STAGING;
  return override ? path.resolve(override) : path.join(getIhuiRoot(), 'update-staging');
}

/** 建一枚本次专用的暂存根(本档唯一允许的写盘动作;`disposeStagingRoot` 负责收尾) */
export function createStagingRoot(prefix: string, base?: string): string {
  const root = base ?? getUpdateStagingDir();
  fs.mkdirSync(root, { recursive: true });
  return fs.mkdtempSync(path.join(root, `${prefix.replace(/[^A-Za-z0-9._-]/g, '-')}-`));
}

/** 拆除本次暂存根。**只拆自己建的那一枚**(不在 stagingRoot 之下的一步不动) */
export function disposeStagingRoot(stagingRoot: string, base?: string): void {
  const root = base ?? getUpdateStagingDir();
  const rel = path.relative(path.resolve(root), path.resolve(stagingRoot));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return;
  try {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  } catch {
    /* 清不掉不掀结论:计划已判完,残骸由 §26 的每日 Temp 体检与本档下一次运行兜 */
  }
}

/**
 * 生产取源器:全量 clone(浅克隆拿不到祖先关系 ⇒ 判据就无从证,所以刻意不用 `--depth 1`)
 * → detach 到候选 commit → 用**写侧唯一采集器** `collectInstallFileDigests` 取回新副本台账。
 */
export const gitCandidateStager: CandidateStager = async ({ url, candidateSha, pluginName, pluginSubdir, stagingRoot }) => {
  const shaCheck = evaluateGitSha(candidateSha);
  if (!shaCheck.ok) return { ok: false, reason: 'git-input-rejected', detail: `candidate/${shaCheck.reasonCode}` };
  if (!usableSubdir(pluginSubdir)) {
    return { ok: false, reason: 'plugin-subdir-unusable', detail: `市场条目的子目录形态不可路径化:${String(pluginSubdir)}` };
  }
  const repoDir = path.join(stagingRoot, pluginName);
  try {
    execGitCapped(['clone', '--', url, repoDir], { timeoutMs: GIT_NETWORK_TIMEOUT_MS });
  } catch (e) {
    return { ok: false, reason: 'candidate-staging-failed', detail: e instanceof Error ? e.message : String(e) };
  }
  try {
    execGitCapped(['-c', 'advice.detachedHead=false', '-C', repoDir, 'checkout', '--detach', candidateSha]);
  } catch (e) {
    return { ok: false, reason: 'candidate-checkout-failed', detail: e instanceof Error ? e.message : String(e) };
  }
  const stagedDir = pluginSubdir ? path.join(repoDir, pluginSubdir) : repoDir;
  if (!fs.existsSync(stagedDir) || !fs.statSync(stagedDir).isDirectory()) {
    return { ok: false, reason: 'candidate-subtree-missing', detail: `候选 commit 里没有 ${pluginSubdir || '(整个子树)'}` };
  }
  const ledger = collectInstallFileDigests(stagedDir);
  if (!ledger) {
    // 采不到 = 这一面无从证(符号链接 / 特殊档形 / 超上限 / 枚到 0 个档)。
    // 绝不写一份"登记了零文件"的台账冒充清单(§0.3「枚举到 0 个候选判死不记绿」)。
    return { ok: false, reason: 'candidate-ledger-unprovable', detail: `${stagedDir} 的逐文件摘要采集判不可证` };
  }
  return { ok: true, repoDir, stagedDir, ledger };
};

// ==================== 祖先关系(一次只进一步) ====================

export type AncestryOutcome =
  | { ok: true; relation: 'direct-successor' | 'ahead' | 'not-descendant'; aheadBy: number }
  | { ok: false; reason: string; detail?: string };

export type AncestryJudge = (p: { repoDir: string; currentSha: string; candidateSha: string }) => Promise<AncestryOutcome>;

type GitRun = { ok: true; stdout: string } | { ok: false; detail: string; status: number | null };

function gitIn(repoDir: string, args: readonly string[]): GitRun {
  try {
    return { ok: true, stdout: execGitCapped(['-C', repoDir, ...args]) };
  } catch (e) {
    // 只读结构码(status),不读错误文案(本仓纪律:流程判断不靠文案,守门 67/135 同族)
    const verdict = classifyGitFailure(e);
    return { ok: false, detail: e instanceof Error ? e.message : String(e), status: verdict.status };
  }
}

/** 把任意可解析的 commit 记号归一成 40 位(缩写 sha 与全 sha 是同一枚 commit,不得读成"不同") */
function resolveCommit(repoDir: string, sha: string): string | null {
  if (typeof sha !== 'string' || sha.length === 0) return null;
  const r = gitIn(repoDir, ['rev-parse', '--verify', '--quiet', `${sha}^{commit}`]);
  if (!r.ok) return null;
  const out = r.stdout.trim();
  return /^[0-9a-f]{40}$/i.test(out) ? out.toLowerCase() : null;
}

/**
 * 判"候选 commit 是不是当前 commit 的直接后继"。
 *
 * 三档确定结论 + 一种"没判出来":
 *   - `direct-successor`(候选的第一父 == 当前)⇒ 唯一允许更新的一档;
 *   - `ahead`(当前是祖先但中间还有 N-1 枚)⇒ **确定不是直接后继**(refused,本档不接受跳代);
 *   - `not-descendant`(当前根本不在候选的祖先链上)⇒ 确定结论 refused;
 *   - `ok:false` ⇒ 祖先关系**拿不到**(当前 commit 不在取回的历史里 / git 报 125 这类真错误)⇒ `unjudged`,不猜。
 *
 * `merge-base --is-ancestor` 的退出码是判据的一部分:1 = "不是祖先"(确定结论),
 * 125 = 命令本身出错(无从判)。两者必须分开 —— 把 125 读成"不是祖先"就是把"没判"写成"判过"。
 */
export const gitAncestryJudge: AncestryJudge = async ({ repoDir, currentSha, candidateSha }) => {
  const current = resolveCommit(repoDir, currentSha);
  if (!current) {
    return {
      ok: false,
      reason: 'current-commit-unreachable',
      detail: `装机记录的 commit ${currentSha} 不在取回的历史里(或不可解析)⇒ 祖先关系无从判,不猜`,
    };
  }
  const candidate = resolveCommit(repoDir, candidateSha);
  if (!candidate) return { ok: false, reason: 'candidate-commit-unreachable', detail: `候选 commit ${candidateSha} 解析不到` };

  const ancestor = gitIn(repoDir, ['merge-base', '--is-ancestor', current, candidate]);
  if (!ancestor.ok) {
    if (ancestor.status === 1) return { ok: true, relation: 'not-descendant', aheadBy: 0 };
    return { ok: false, reason: 'ancestry-unavailable', detail: ancestor.detail };
  }

  const parent = gitIn(repoDir, ['rev-parse', `${candidate}^`]);
  const parentSha = parent.ok ? parent.stdout.trim().toLowerCase() : null;
  if (parentSha === current) return { ok: true, relation: 'direct-successor', aheadBy: 1 };

  const count = gitIn(repoDir, ['rev-list', '--count', `${current}..${candidate}`]);
  const aheadBy = count.ok ? Number.parseInt(count.stdout.trim(), 10) : Number.NaN;
  if (!Number.isFinite(aheadBy) || aheadBy <= 0) {
    return {
      ok: false,
      reason: 'ancestry-distance-unjudged',
      detail: `量不出 ${current.slice(0, 12)}… 到 ${candidate.slice(0, 12)}… 的距离 ⇒ 不敢说"进一步"还是"跳代"`,
    };
  }
  return { ok: true, relation: 'ahead', aheadBy };
};

// ==================== 三态判据:有没有更新 ====================

export const PLUGIN_UPDATE_CHECK_STATES = ['up-to-date', 'available', 'unjudged'] as const;
export type PluginUpdateCheckState = (typeof PLUGIN_UPDATE_CHECK_STATES)[number];

export interface PluginUpdateCheck {
  name: string;
  state: PluginUpdateCheckState;
  /** `unjudged` 时必非空:逐条点名缺了哪一枚输入(§0.3) */
  missingInputs: string[];
  reason?: string;
  detail?: string;
  marketplace?: string;
  url?: string;
  ref?: string;
  currentSha?: string;
  remoteSha?: string;
}

export interface CheckUpdatesInput {
  /** 默认 = `loadInstallRegistry()` 的记录面 */
  records?: readonly InstallRecord[];
  /** 默认 = `getInstalledPluginsDir()`(取值序含 `IHUI_HOME`,测试据此隔离装机面) */
  pluginsRoot?: string;
  /** 默认 = `loadRegisteredMarketplaces()`(只读;文件不存在 ⇒ 全部候选 unjudged) */
  marketplaces?: RegisteredMarketplacesOutcome;
  /** 默认 = `gitRemoteHeadReader`(先过形状白名单再 ls-remote) */
  remotes?: RemoteHeadReader;
  /** 只判这些名字(缺省 = 记录面全体) */
  names?: readonly string[];
}

export interface CheckUpdatesReport {
  /** 整面结论:有任一未判定 ⇒ `unjudged`(有候选没判出来,就不能说"全都查过了") */
  verdict: 'up-to-date' | 'available' | 'unjudged';
  checks: PluginUpdateCheck[];
  counts: { upToDate: number; available: number; unjudged: number };
  /** 记录面为空的点名:枚举到 0 条不是"没东西要更新",而是"没有输入" */
  reason?: string;
}

/** git 形态的装机记录才谈得上"从市场更新"(本地路径装的没有远端可查) */
function gitSourceUrlOf(record: InstallRecord): string | null {
  if (record.sourceType !== 'git') return null;
  if (typeof record.sourceUrl !== 'string' || record.sourceUrl.length === 0) return null;
  return record.sourceUrl;
}

function unjudgedCheck(name: string, missingInputs: string[], reason: string, detail?: string): PluginUpdateCheck {
  return { name, state: 'unjudged', missingInputs, reason, detail };
}

/**
 * 判"已登记市场里的每个插件有没有新版本"。三态:`up-to-date` / `available` / `unjudged`。
 *
 * ⚠ `available` 的含义**只是**"远端头与装机 commit 不同",不代表能安全落 ——
 * 安全判定(脏就停 / 一次一步 / 验不过不落)全部在 `planUpdate`,这里不预判、也不放行。
 */
export async function checkUpdates(input: CheckUpdatesInput = {}): Promise<CheckUpdatesReport> {
  const records = input.records ?? loadInstallRegistry().records;
  const marketplaces = input.marketplaces ?? loadRegisteredMarketplaces();
  const remotes = input.remotes ?? gitRemoteHeadReader;
  const wanted = input.names && input.names.length > 0 ? new Set(input.names) : null;
  const checks: PluginUpdateCheck[] = [];

  for (const record of records) {
    if (wanted && !wanted.has(record.name)) continue;
    const sourceUrl = gitSourceUrlOf(record);
    if (!sourceUrl) {
      checks.push(
        unjudgedCheck(record.name, ['git-source-url-missing'], 'not-git-sourced', '本地路径安装的插件没有远端 commit 谱系可查'),
      );
      continue;
    }
    if (typeof record.sha !== 'string' || record.sha.length === 0) {
      checks.push(
        unjudgedCheck(record.name, ['installed-commit-unknown'], 'installed-commit-unknown', '装机记录没有 pin SHA ⇒ 连"从哪一代出发"都不知道'),
      );
      continue;
    }
    const resolution = resolveMarketplaceEntryForRecord(record, marketplaces.marketplaces);
    if (resolution.state !== 'found') {
      const missing = [resolution.missingInput];
      if (resolution.state === 'index-unavailable') missing.push(...resolution.tried.map((t) => `marketplace-index:${t}`));
      if (resolution.state === 'entry-missing') missing.push(...resolution.scanned.map((s) => `scanned-marketplace:${s}`));
      if (resolution.state === 'entry-ambiguous') missing.push(...resolution.candidates.map((c) => `ambiguous:${c}`));
      checks.push(unjudgedCheck(record.name, missing, resolution.state, marketplaces.ok ? undefined : marketplaces.reason));
      continue;
    }
    const entrySource = resolution.entry.source;
    const entryRef = typeof entrySource === 'object' && 'ref' in entrySource ? entrySource.ref : undefined;
    const ref = typeof entryRef === 'string' && entryRef.length > 0 ? entryRef : resolution.marketplace.ref ?? 'HEAD';

    const head = await remotes({ url: sourceUrl, ref });
    const located = {
      marketplace: resolution.marketplace.name,
      url: sourceUrl,
      ref,
      currentSha: record.sha.toLowerCase(),
    };
    if (!head.ok) {
      checks.push({ ...unjudgedCheck(record.name, ['remote-head-unknown'], head.reason, head.detail), ...located });
      continue;
    }
    const remote = head.sha.toLowerCase();
    checks.push({
      ...located,
      name: record.name,
      state: remote === located.currentSha ? 'up-to-date' : 'available',
      missingInputs: [],
      remoteSha: remote,
    });
  }

  const counts = {
    upToDate: checks.filter((c) => c.state === 'up-to-date').length,
    available: checks.filter((c) => c.state === 'available').length,
    unjudged: checks.filter((c) => c.state === 'unjudged').length,
  };
  const verdict: CheckUpdatesReport['verdict'] =
    checks.length === 0 ? 'unjudged' : counts.unjudged > 0 ? 'unjudged' : counts.available > 0 ? 'available' : 'up-to-date';

  return {
    verdict,
    checks,
    counts,
    ...(checks.length === 0 ? { reason: 'no-install-records(枚举到 0 条记录 = 没有输入,不等于"全是最新")' } : {}),
  };
}

// ==================== 只出计划:能不能安全更新 ====================

export const PLUGIN_UPDATE_PLAN_STATUSES = ['planned', 'no-op', 'refused', 'unjudged'] as const;
export type PluginUpdatePlanStatus = (typeof PLUGIN_UPDATE_PLAN_STATUSES)[number];

/** 门 277 的 drift 摊薄后的确定形状(三类都恒为数组;不在这里再判一次"哪个算漂移",§0.6) */
export interface PluginUpdateDrift {
  missing: string[];
  mismatch: Array<{ path: string; expectedSha: string; actualSha: string }>;
  unlisted: string[];
}

export interface PluginUpdatePlanEntry {
  name: string;
  status: PluginUpdatePlanStatus;
  reason?: string;
  /** 点名缺的输入(`unjudged`)或触发的红线(`refused`);两者都不许留空 */
  missingInputs: string[];
  detail?: string;
  from?: { url: string; commit: string; marketplace?: string };
  to?: { commit: string; files: number };
  /** 本地目录相对其安装台账的判定(超越轴②的证据面) */
  localState?: 'clean' | 'drift' | 'unjudged';
  /** 新副本相对其采集台账的判定(超越轴①的证据面) */
  integrity?: 'pass' | 'fail' | 'unjudged';
  localDrift?: PluginUpdateDrift;
  stagedDrift?: PluginUpdateDrift;
  aheadBy?: number;
}

export interface PlanUpdateInput extends CheckUpdatesInput {
  /**
   * 默认 = `checkUpdates` 里除"已是最新"以外的全部(`available` 候选 + `unjudged` 证据):
   * 未判定面必须留在计划里,否则派发腿只看得见"没有计划",看不见"为什么没有"(§0.3)。
   * 已是最新的不进默认集(没有可落的东西 ⇒ 整面读起来是 `nothing-to-plan`)。
   * 显式点名时,`up-to-date` 也各自摊成一行 `no-op`,不静默消失。
   */
  names?: readonly string[];
  /** 默认 = `gitCandidateStager`(全量 clone + detach + 写侧采集器) */
  stager?: CandidateStager;
  /** 默认 = `gitAncestryJudge` */
  ancestry?: AncestryJudge;
  /** 默认 = 在 `getUpdateStagingDir()` 下新建一枚本次专用暂存根,收尾必删 */
  stagingRoot?: string;
}

export interface UpdatePlanReport {
  status: 'planned' | 'nothing-to-plan' | 'blocked' | 'unjudged';
  /**
   * 上游 `checkUpdates` 那一面的整面档位,原样带出(不等条目数)。
   * 立的因:只给 `--plan-update` 时调用方拿不到 checks,而"枚举到 0 条记录"这种**没有输入**
   * 的档位必须还能被下游分辨出来(§0.3),否则退出码只能靠猜。
   */
  preVerdict: CheckUpdatesReport['verdict'];
  entries: PluginUpdatePlanEntry[];
  counts: { planned: number; noop: number; refused: number; unjudged: number };
  reason?: string;
}

/** 门 277 的 drift 摊薄:三类分开取出来即可,不在这里再判一次"哪个算漂移"(§0.6) */
function driftOf(j: IntegrityJudgement): PluginUpdateDrift {
  return { missing: j.missing ?? [], mismatch: j.mismatch ?? [], unlisted: j.unlisted ?? [] };
}

function entryUnjudged(name: string, missingInputs: string[], reason: string, detail?: string): PluginUpdatePlanEntry {
  return { name, status: 'unjudged', missingInputs, reason, detail };
}

/** 把 `checkUpdates` 的未判定项原样摊成计划条目:缺的输入一个字都不改写(点名要能追到源头) */
function entryFromUnjudgedCheck(check: PluginUpdateCheck): PluginUpdatePlanEntry {
  const missing = check.missingInputs.length > 0 ? [...check.missingInputs] : [check.reason ?? 'unknown'];
  return {
    name: check.name,
    status: 'unjudged',
    missingInputs: missing,
    reason: check.reason,
    detail: check.detail,
    ...(check.marketplace ? { from: { url: check.url ?? '', commit: check.currentSha ?? '', marketplace: check.marketplace } } : {}),
  };
}

/**
 * 出更新计划(**零落盘**:本函数不写 registry、不移动目录、不覆盖任何副本)。
 *
 * 判序就是安全设计,一步都不能换:
 *   ① 输入齐不齐(记录 / 市场登记 / commit pin)→ 不齐 ⇒ `unjudged` 点名
 *   ② 远端头取不取到 → 取不到 ⇒ `unjudged`(绝不冒充"已是最新")
 *   ③ **本地脏不脏**(装机目录 ↔ 装机台账,经门 277)→ 脏 ⇒ `refused` 逐条点名,**不碰盘也不发取源**
 *   ④ 取候选到本次暂存根 → 采不到台账 / 取不回内容 ⇒ `unjudged`
 *   ⑤ **一次只进一步**(直接后继)→ 祖先关系拿不到 ⇒ `unjudged`;跳代 / 不同源 ⇒ `refused`
 *   ⑥ **拉取后必须验**(暂存目录 ↔ 采集那一刻的台账,经门 277)→ 任何 drift ⇒ `refused`
 *   ⑦ 全绿才 `planned`(带 from/to 与新台账文件数,供后续 `--apply` 票消费)
 */
export async function planUpdate(input: PlanUpdateInput = {}): Promise<UpdatePlanReport> {
  const records = input.records ?? loadInstallRegistry().records;
  const pluginsRoot = input.pluginsRoot ?? getInstalledPluginsDir();
  const marketplaces = input.marketplaces ?? loadRegisteredMarketplaces();
  const remotes = input.remotes ?? gitRemoteHeadReader;
  const stager = input.stager ?? gitCandidateStager;
  const ancestry = input.ancestry ?? gitAncestryJudge;
  const byName = new Map(records.map((r) => [r.name, r]));

  const pre = await checkUpdates({ records, pluginsRoot, marketplaces, remotes, names: input.names });
  const named = Boolean(input.names && input.names.length > 0);
  // 默认集 = 除"已是最新"以外的全部:`available` 是要判的候选,`unjudged` 是"为什么没计划"的证据本身
  // (只留 available 会把未判定面整块吞掉,派发腿就只剩"没有计划"三个字 —— §0.3 不许这样)。
  const targets = named ? pre.checks : pre.checks.filter((c) => c.state !== 'up-to-date');

  // 暂存根**按需创建**:没有可取的东西就一个目录也不建("默认零副作用"要真成立,
  // 不能靠"建了再删"——崩溃在中间就留下一地空目录)。
  let stagingRoot = input.stagingRoot ?? '';
  let createdRoot = false;
  const ensureStagingRoot = (): string => {
    if (!stagingRoot) {
      stagingRoot = createStagingRoot('ihui-plugin-update');
      createdRoot = true;
    }
    return stagingRoot;
  };
  const entries: PluginUpdatePlanEntry[] = [];

  try {
    for (const check of targets) {
      const record = byName.get(check.name);
      if (!record) {
        entries.push(entryUnjudged(check.name, ['installed-record-missing'], 'installed-record-missing', '台账里没有这条安装记录 ⇒ 没有基准可对'));
        continue;
      }
      if (check.state === 'unjudged') {
        entries.push(entryFromUnjudgedCheck(check));
        continue;
      }
      if (check.state === 'up-to-date') {
        entries.push({
          name: check.name,
          status: 'no-op',
          missingInputs: [],
          reason: 'already-up-to-date',
          from: { url: check.url ?? '', commit: check.currentSha ?? '', marketplace: check.marketplace },
          to: { commit: check.remoteSha ?? '', files: 0 },
        });
        continue;
      }

      const from = { url: check.url ?? '', commit: check.currentSha ?? '', marketplace: check.marketplace };
      const to = { commit: check.remoteSha ?? '', files: 0 };

      // ③ 本地脏就停(判据 = 门 277,本档不复算)
      const localJudge = await judgeDirectoryAgainstLedger(check.name, record.fileDigests, path.join(pluginsRoot, check.name));
      if (!localJudge.ok) {
        entries.push(entryUnjudged(check.name, ['integrity-judgement-unavailable'], localJudge.reason, localJudge.detail));
        continue;
      }
      if (localJudge.judgement.state === 'unjudged') {
        const why = localJudge.judgement.reason ?? 'unknown';
        entries.push({
          ...entryUnjudged(
            check.name,
            [`installed-integrity-${why}`],
            'installed-integrity-unjudged',
            `装机台账这一面拿不到判定(reason=${why}${localJudge.judgement.pending ? ',老记录 pending=true:重装即补上台账' : ''})⇒ 既不说"能更新"也不说"被篡改"`,
          ),
          localState: 'unjudged',
        });
        continue;
      }
      if (localJudge.judgement.state === 'drift') {
        entries.push({
          name: check.name,
          status: 'refused',
          missingInputs: ['local-directory-differs-from-install-ledger'],
          reason: 'local-drift-defers',
          detail: '本地目录相对装机台账已有改动 ⇒ 让路并逐条点名,绝不覆盖用户本地改动(超越轴②)',
          from,
          to,
          localState: 'drift',
          localDrift: driftOf(localJudge.judgement),
        });
        continue;
      }

      // ④ 取候选(只写本次暂存根,装机面一步不动)
      const staged = await stager({
        url: from.url,
        candidateSha: check.remoteSha ?? '',
        currentSha: check.currentSha ?? '',
        pluginName: check.name,
        pluginSubdir: record.pluginSubdir,
        stagingRoot: ensureStagingRoot(),
      });
      if (!staged.ok) {
        entries.push({
          ...entryUnjudged(check.name, ['candidate-content-unavailable'], staged.reason, staged.detail),
          localState: 'clean',
          from,
          to,
        });
        continue;
      }

      // ⑤ 一次只进一步
      const relation = await ancestry({
        repoDir: staged.repoDir,
        currentSha: check.currentSha ?? '',
        candidateSha: check.remoteSha ?? '',
      });
      const candidateTo = { commit: check.remoteSha ?? '', files: staged.ledger.length };
      if (!relation.ok) {
        entries.push({ ...entryUnjudged(check.name, ['commit-ancestry-unavailable'], relation.reason, relation.detail), localState: 'clean', from, to: candidateTo });
        continue;
      }
      if (relation.relation === 'not-descendant') {
        entries.push({ name: check.name, status: 'refused', missingInputs: ['candidate-not-descendant-of-installed'], reason: 'not-descendant', detail: '候选不建立在装机那一代之上 ⇒ 不是"更新",是换源', from, to: candidateTo, localState: 'clean', aheadBy: 0 });
        continue;
      }
      if (relation.relation !== 'direct-successor') {
        entries.push({ name: check.name, status: 'refused', missingInputs: ['candidate-not-direct-successor'], reason: 'not-direct-successor', detail: `领先 ${relation.aheadBy} 枚 ⇒ 本档不接受跳代更新(一次只进一步)`, from, to: candidateTo, localState: 'clean', aheadBy: relation.aheadBy });
        continue;
      }

      // ⑥ 拉取后必须验:暂存目录 ↔ 采集那一刻的台账(判据 = 门 277)
      const stagedJudge = await judgeDirectoryAgainstLedger(check.name, staged.ledger, staged.stagedDir);
      if (!stagedJudge.ok) {
        entries.push({ ...entryUnjudged(check.name, ['integrity-judgement-unavailable'], stagedJudge.reason, stagedJudge.detail), localState: 'clean', from, to: candidateTo });
        continue;
      }
      if (stagedJudge.judgement.state === 'drift') {
        entries.push({
          name: check.name,
          status: 'refused',
          missingInputs: ['staged-content-fails-integrity'],
          reason: 'staged-integrity-fail',
          detail: '取回的候选副本逐文件对账不过 ⇒ 拒绝落地,装机目录一步没动(超越轴①)',
          from,
          to: candidateTo,
          localState: 'clean',
          integrity: 'fail',
          stagedDrift: driftOf(stagedJudge.judgement),
        });
        continue;
      }
      if (stagedJudge.judgement.state === 'unjudged') {
        entries.push({
          ...entryUnjudged(check.name, [`staged-integrity-${stagedJudge.judgement.reason ?? 'unknown'}`], 'staged-integrity-unjudged', '新副本这一面门体判不出 ⇒ 不记绿也不落'),
          localState: 'clean',
          integrity: 'unjudged',
          from,
          to: candidateTo,
        });
        continue;
      }

      // ⑦ 全绿才 planned
      entries.push({
        name: check.name,
        status: 'planned',
        missingInputs: [],
        from,
        to: candidateTo,
        localState: 'clean',
        integrity: 'pass',
        aheadBy: relation.aheadBy,
      });
    }
  } finally {
    if (createdRoot) disposeStagingRoot(stagingRoot);
  }

  const counts = {
    planned: entries.filter((e) => e.status === 'planned').length,
    noop: entries.filter((e) => e.status === 'no-op').length,
    refused: entries.filter((e) => e.status === 'refused').length,
    unjudged: entries.filter((e) => e.status === 'unjudged').length,
  };
  const status: UpdatePlanReport['status'] =
    entries.length === 0
      ? pre.verdict === 'unjudged'
        ? 'unjudged'
        : 'nothing-to-plan'
      : counts.planned > 0
        ? 'planned'
        : counts.unjudged > 0 && counts.refused === 0
          ? 'unjudged'
          : 'blocked';

  return {
    status,
    preVerdict: pre.verdict,
    entries,
    counts,
    ...(entries.length === 0 ? { reason: pre.reason ?? 'no-candidate(没有 available 的候选;未判定项不构成"没有更新")' } : {}),
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
