// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 语言服务器探测(V3 #83)—— 把「起不来」从一句话拆成可判、可诊断的四态。
 *
 * 改前的形状(现读 `apps/cli/src/tools/lsp.ts`):任何失败都塌成一个
 * `errorType: 'lsp-unavailable'` + 一句 `LSP 不可用: ${err.message}`,而 message 里
 * 最常见的是 `spawn ... ENOENT`(没装)与 `LSP initialize 超时`(装了但没起来)——
 * 两者处置动作完全不同(装它 vs 查它为什么挂),却长得一模一样。
 * 本文件把这条通道拆成 `not-installed` / `version-too-low` / `probe-timeout` / `probe-failed`
 * 四态,**每一态都带 reason + installHint**;`ready` 也如实说明版本判据有没有真跑过。
 *
 * 与「判据失效的表现永远是安静」同型的那一条禁令在这里的落点:
 * **不允许任何一条返回路径 reason 为空**。
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { LSP_SERVERS, type LspBinaryCandidate, type LspRequestKind, type LspServerConfig } from './language-table.js';

/** 在 PATH 里找一个可执行名的超时。取值依据:纯本地查表,>5s 已经不叫慢而叫挂住。 */
const LOOKUP_TIMEOUT_MS = 5_000;
/** `--version` 一类的版本探针超时。同上:版本探针不该比它要保护的启动更贵。 */
const VERSION_TIMEOUT_MS = 5_000;

export type LspProbeStatus =
  | 'ready'
  | 'not-installed'
  | 'version-too-low'
  | 'probe-timeout'
  | 'probe-failed';

/** 版本判据的三态。把"没判"与"判过且通过"分开写,是这张表唯一的诚实方式。 */
export type LspVersionJudgement =
  | 'checked'
  | 'skipped-no-version-args'
  | 'skipped-no-min-version';

export interface LspProbeOutcome {
  language: string;
  displayName: string;
  /** 被探测的可执行名(来自语言表,不是用户输入) */
  binary: string;
  status: LspProbeStatus;
  /** `where`/`which` 解析到的绝对路径;未安装时为 null */
  resolvedPath: string | null;
  /** 从版本输出里量到的版本号;量不到为 null(与"没量"不同:没量时 judgement 不是 checked) */
  version: string | null;
  versionJudgement: LspVersionJudgement;
  /** 表里声明的下限(undefined = 未声明) */
  minVersion: string | null;
  /** 人类可读诊断,任何状态下都非空 */
  reason: string;
  /** 未安装/版本过低时的出路,来自语言表 */
  installHint: string;
  /** 仅 ready 有值:该候选声明的请求集,用于发请求前预检 */
  capabilities: LspRequestKind[] | null;
}

export type LspCandidateResolution =
  | { ok: true; candidate: LspBinaryCandidate; probed: LspProbeOutcome[] }
  | { ok: false; candidate: null; probed: LspProbeOutcome[] };

function lookupCommandNames(): { cmd: string } {
  return { cmd: os.platform() === 'win32' ? 'where' : 'which' };
}

/**
 * 在 PATH 里解析可执行名。返回绝对路径或 null(未安装)。
 *
 * 不用 shell:where.exe / which 都是真二进制,`shell:true` 只会把参数丢进一次
 * cmd 解析(引号规则随版本变),而这里需要的只是"存在与否"这一个布尔。
 */
export function resolveBinaryPath(binary: string): string | null {
  const { cmd } = lookupCommandNames();
  const r = spawnSync(cmd, [binary], {
    encoding: 'utf-8',
    windowsHide: true,
    timeout: LOOKUP_TIMEOUT_MS,
  });
  if (r.error || r.status !== 0) return null;
  const first = (r.stdout ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return first ?? null;
}

/** 从 `--version` 的输出里量第一个点分版本号(1-4 段)。量不到返回 null。 */
export function parseVersion(text: string): string | null {
  const m = text.match(/\d+\.\d+(?:\.\d+)?(?:\.\d+)?/);
  return m ? m[0] : null;
}

/**
 * 点分数版本比较:a < b 返回 -1,a > b 返回 1,等值返回 0。
 * 段数不等时短的一侧补 0(`1.2` == `1.2.0`)。非数字段按 0 处理 ——
 * 本仓不做 semver 预发布语义判断,那需要一个真的 semver 依赖(属架构决策,不在本票)。
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((s) => Number.parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => Number.parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

function baseOutcome(config: LspServerConfig, candidate: LspBinaryCandidate): Omit<
  LspProbeOutcome,
  'status' | 'resolvedPath' | 'version' | 'versionJudgement' | 'reason' | 'capabilities'
> {
  return {
    language: config.language,
    displayName: config.displayName,
    binary: candidate.binary,
    minVersion: candidate.minVersion ?? null,
    installHint: candidate.installHint,
  };
}

/**
 * 探测单个候选:在位 → 版本 → 就绪。
 *
 * `shell` 只在 win32 打开:npm/pnpm 全局装的语言服务器在 Windows 上是 `.cmd` 壳,
 * 而 Node ≥ 20 无 shell 启动 `.cmd` 直接 EINVAL(CVE-2024-27980 的收口)。
 * 参数只有来自语言表的字面量,不接受任何用户输入拼接。
 */
export function probeLspCandidate(
  config: LspServerConfig,
  candidate: LspBinaryCandidate,
): LspProbeOutcome {
  const shared = baseOutcome(config, candidate);
  const resolvedPath = resolveBinaryPath(candidate.binary);
  if (!resolvedPath) {
    return {
      ...shared,
      status: 'not-installed',
      resolvedPath: null,
      version: null,
      versionJudgement: 'skipped-no-min-version',
      capabilities: null,
      reason:
        `未在 PATH 找到 ${candidate.binary}(${lookupCommandNames().cmd} 查不到)。` +
        `注意服务身份与交互账户的 PATH 不互通,若这一份跑在计划任务/守护进程下,先确认该身份的 PATH。`,
    };
  }

  if (candidate.versionArgs.length === 0) {
    return {
      ...shared,
      status: 'ready',
      resolvedPath,
      version: null,
      versionJudgement: 'skipped-no-version-args',
      capabilities: [...candidate.capabilities],
      reason: `${candidate.binary} 在位(${resolvedPath});语言表未声明 versionArgs ⇒ 版本判据跳过,不记为"版本已核"。`,
    };
  }

  const r = spawnSync(resolvedPath, candidate.versionArgs, {
    encoding: 'utf-8',
    windowsHide: true,
    timeout: VERSION_TIMEOUT_MS,
    shell: os.platform() === 'win32',
  });

  if (r.error) {
    const code = (r.error as NodeJS.ErrnoException).code ?? '';
    const errText = `${code || r.error.name}: ${r.error.message}`.slice(0, 200);
    if (code === 'ENOENT' || code === 'EPERM') {
      return {
        ...shared,
        status: 'not-installed',
        resolvedPath,
        version: null,
        versionJudgement: 'skipped-no-min-version',
        capabilities: null,
        reason: `${candidate.binary} 被 ${lookupCommandNames().cmd} 报为在位(${resolvedPath}),但取版本时进程起不来 ⇒ ${errText}`,
      };
    }
    if (code === 'ETIMEDOUT' || r.error.name === 'AbortError' || r.signal === 'SIGTERM') {
      return {
        ...shared,
        status: 'probe-timeout',
        resolvedPath,
        version: null,
        versionJudgement: 'skipped-no-min-version',
        capabilities: null,
        reason: `${candidate.binary} ${candidate.versionArgs.join(' ')} 在 ${VERSION_TIMEOUT_MS}ms 内没有返回 ⇒ 探测超时(进程挂住不等于没装)`,
      };
    }
    return {
      ...shared,
      status: 'probe-failed',
      resolvedPath,
      version: null,
      versionJudgement: 'skipped-no-min-version',
      capabilities: null,
      reason: `${candidate.binary} 取版本失败 ⇒ ${errText}`,
    };
  }

  if (r.status !== 0) {
    const tail = `${r.stderr ?? ''}${r.stdout ?? ''}`.replace(/\s+/g, ' ').trim().slice(0, 200);
    return {
      ...shared,
      status: 'probe-failed',
      resolvedPath,
      version: null,
      versionJudgement: 'skipped-no-min-version',
      capabilities: null,
      reason: `${candidate.binary} ${candidate.versionArgs.join(' ')} 退出码 ${r.status ?? '(signal)'}${tail ? `: ${tail}` : ''}`,
    };
  }

  const version = parseVersion(`${r.stdout ?? ''}\n${r.stderr ?? ''}`);
  if (!version) {
    return {
      ...shared,
      status: 'probe-failed',
      resolvedPath,
      version: null,
      versionJudgement: 'skipped-no-min-version',
      capabilities: null,
      reason: `${candidate.binary} 跑通了但输出里量不到版本号 ⇒ 版本判据无法执行(不得当作版本达标放行)`,
    };
  }

  if (candidate.minVersion && compareVersions(version, candidate.minVersion) < 0) {
    return {
      ...shared,
      status: 'version-too-low',
      resolvedPath,
      version,
      versionJudgement: 'checked',
      capabilities: null,
      reason: `${candidate.binary} 实测 ${version},低于语言表要求的 ${candidate.minVersion}`,
    };
  }

  return {
    ...shared,
    status: 'ready',
    resolvedPath,
    version,
    versionJudgement: candidate.minVersion ? 'checked' : 'skipped-no-min-version',
    capabilities: [...candidate.capabilities],
    reason: candidate.minVersion
      ? `${candidate.binary} ${version} ≥ ${candidate.minVersion}`
      : `${candidate.binary} ${version} 在位;语言表未为本候选声明版本下限 ⇒ 版本判据不适用(不是"已核")`,
  };
}

/** 按表内顺序探测一个语言的候选,第一个 ready 的胜出;全失败时把每一份失败都带回去。 */
export function resolveLspCandidate(
  config: LspServerConfig,
  probe: (config: LspServerConfig, candidate: LspBinaryCandidate) => LspProbeOutcome = probeLspCandidate,
): LspCandidateResolution {
  const probed: LspProbeOutcome[] = [];
  for (const candidate of config.candidates) {
    const outcome = probe(config, candidate);
    probed.push(outcome);
    if (outcome.status === 'ready') return { ok: true, candidate, probed };
  }
  return { ok: false, candidate: null, probed };
}

/** 探测全表(供 `lsp_server_status` 用)。一门语言的全部候选都探,便于说明"为什么没有可用的"。 */
export function probeAllLspServers(
  languages: string[] | null = null,
  probe: (config: LspServerConfig, candidate: LspBinaryCandidate) => LspProbeOutcome = probeLspCandidate,
  table: LspServerConfig[] = LSP_SERVERS,
): LspProbeOutcome[] {
  const rows: LspProbeOutcome[] = [];
  const wanted = languages ? new Set(languages) : null;
  for (const config of table) {
    if (wanted && !wanted.has(config.language)) continue;
    for (const candidate of config.candidates) rows.push(probe(config, candidate));
  }
  if (rows.length === 0) {
    // 空枚举 = 判据失明,不是"全部不可用"。喊出来,不得静默返回空表(本仓最高频失效型)。
    throw new Error(
      `probeAllLspServers 探到 0 条候选(languages=${JSON.stringify(languages)});` +
        `要么过滤条件写错,要么语言表被清空 —— 这两种都不是"通过"`,
    );
  }
  return rows;
}

/**
 * 工程根标记检查。**只用于诊断输出**,不参与任何放行判断(理由见语言表字段注释)。
 * `*.ext` 形态按"目录下任一文件以 .ext 结尾"判。
 */
export function checkWorkspaceMarkers(
  config: LspServerConfig,
  workspacePath: string,
): { required: string[]; found: string[] } {
  const required = config.workspaceMarkers ?? [];
  if (required.length === 0) return { required, found: [] };
  const found: string[] = [];
  for (const marker of required) {
    if (marker.startsWith('*.')) {
      const suffix = marker.slice(1);
      try {
        const entries = fs.readdirSync(workspacePath);
        if (entries.some((e) => e.endsWith(suffix))) found.push(marker);
      } catch {
        // 工作区不可读:如实留空(found 为空即"没量到"),不得猜成"有"
      }
      continue;
    }
    if (fs.existsSync(path.join(workspacePath, marker))) found.push(marker);
  }
  return { required, found };
}

/** 把一条探测结果压成一行诊断文本(状态行必须自带原因,不得只给个词)。 */
export function formatLspProbeOutcome(o: LspProbeOutcome): string {
  const head = `${o.language}(${o.binary}): ${o.status}`;
  const version = o.version ? ` version=${o.version}` : '';
  const hint = o.status === 'not-installed' || o.status === 'version-too-low' ? ` | 出路: ${o.installHint}` : '';
  return `${head}${version} | ${o.reason}${hint}`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
