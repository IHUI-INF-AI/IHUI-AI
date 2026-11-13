// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 插件多版本共存(#12)。
 *
 * 背景:既有装载器把"同一个 name 出现在多份清单里"一律判成歧义、两份都不装(G-684/G-658)。
 * 那条判据防的是"扫描顺序决定谁赢"的掷骰子,但它也把**同一插件的不同版本**连坐枪毙了 ——
 * 升级后旧版本目录仍在盘上是常态(WorkBuddy 的 `plugins/cache/<marketplace>/<name>/<version>/`
 * 就是这么落的,旧版本目录保留、登记表里只留一条生效记录)。
 *
 * 本模块只加一条**显式开启**的共存通道,不改既有严格装载的任何判据:
 *   - 版本身份 = `name@version`;**同名同版本**的两份清单仍然算歧义(拒绝),不放行;
 *   - 同名不同版本 → 允许共存,按 `selectActivePluginVersions` 选出一个 active,其余进 `shadowed`;
 *   - active 选择顺序:显式 pin(`settings.plugins.versionPins`)优先,其次 semver 序最高;
 *   - `policy.disabled` 里点名的版本不参选(仍保留在盘、仍进 shadowed);
 *   - pin 指向盘上不存在的版本 → 报诊断并确定性退回"序最高"的可用版本,不静默、不掷骰子;
 *   - 一个名字下所有版本都被禁用/歧义 → 该名不装载,报诊断。
 *
 * 判据单源:`comparePluginVersions` 是本仓唯一的插件版本序;调用方不得在别处另写一套比较。
 */
import fs from 'node:fs';
import path from 'node:path';
import { isDefinitePathAbsence } from './path-safety.js';
import {
  diagnostic,
  findManifestInDir,
  normalizeManifest,
  parseManifestFile,
  unexpectedDiagnostic,
} from './manifest-scan.js';
import {
  classifyContributions,
  contributionDiagnosticsOf,
  contributionInputOf,
  summarizeContributions,
  type ContributionFinding,
  type PluginContributionAudit,
} from './contribution-audit.js';
import {
  activationDiagnosticsOf,
  activationInputOf,
  classifyActivations,
  summarizeActivations,
  type ActivationFinding,
  type PluginActivationAudit,
} from './activation-events.js';
import {
  compilePluginInterfaces,
  type CompiledInterfaceTool,
  type InterfaceCompileOutcome,
} from './interface-tools.js';
import type { LoadPluginsOptions, PluginDefinition, PluginDiagnostic } from './types.js';

/** 版本策略:两个字段都可缺省,缺省即"全部版本参选、按 semver 序选最高" */
export interface PluginVersionPolicy {
  /** `name` → 期望版本(raw 字符串;与盘上 `version` 逐字符比,仅 build metadata 差异视为同一版本) */
  pins?: Readonly<Record<string, string>>;
  /** 被禁用的版本规格,形如 `name@version`;不含 `@` 的条目按未点名处理(不做模糊匹配) */
  disabled?: readonly string[];
}

/** 一个在盘的候选版本(已通过最小清单校验) */
export interface PluginVersionCandidate {
  name: string;
  version: string;
  /** 声明它的清单绝对路径 */
  file: string;
  definition: PluginDefinition;
}

/** 未生效版本的原因:禁用 / 被 pin 到别的版本 / 序更低 */
export type ShadowedVersionReason = 'disabled' | 'pinned-other-version' | 'higher-version';

export interface ShadowedPluginVersion {
  name: string;
  version: string;
  file: string;
  reason: ShadowedVersionReason;
}

export interface PluginVersionSelection {
  /** 每个名字选出的 active 版本(按名字字典序,确定性) */
  active: PluginVersionCandidate[];
  /** 在盘但未生效的版本(确定性排序:名字,再版本降序) */
  shadowed: ShadowedPluginVersion[];
  diagnostics: PluginDiagnostic[];
}

export interface MultiVersionLoadResult {
  /** 只含 active 版本(既有 registerAll 直接用这一份) */
  plugins: PluginDefinition[];
  shadowed: ShadowedPluginVersion[];
  diagnostics: PluginDiagnostic[];
  /** 逐档贡献裁决(对**每一份在盘好清单**给,与装载裁决互不遮蔽,沿用 loader 的既有口径) */
  contributions: PluginContributionAudit;
  /** 逐档激活裁决(同上) */
  activations: PluginActivationAudit;
  /**
   * 接口型工具(2026-11-13):只取 **active 版本**贡献的那批。
   *
   * 被 shadowed 的版本不贡献工具 —— 与"该版本不装载"同一语义:同一个插件名两个版本各贡献
   * 一枚同名工具,装进去就是两份实现抢一个工具名,而"谁赢"取决于版本目录序(没人声明过的意图)。
   */
  interfaceTools: CompiledInterfaceTool[];
  /** 逐条接口声明裁决(同上,只含 active 版本的) */
  interfaceOutcomes: InterfaceCompileOutcome[];
}

interface ParsedPluginVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly string[];
  readonly build: readonly string[];
  readonly raw: string;
}

function segmentNumber(text: string | undefined): number {
  const n = Number.parseInt(text ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * 宽松解析插件版本号:接受 `1`、`1.2`、`1.2.3`、`1.2.3-pre.1`、`1.2.3+build` 以及 WorkBuddy 那种
 * `5.9.3-wb.42398134.gd4692421.h480e8d1fee0f`(core 之后的整段按 prerelease 处理)。
 * 解析不出数字的位置按 0 —— 本函数是**排序**用的,不是清单校验用的,坏版本号在这里不报错。
 */
export function parsePluginVersion(raw: string): ParsedPluginVersion {
  const text = raw.trim().replace(/^v/i, '');
  const plusAt = text.indexOf('+');
  const main = plusAt === -1 ? text : text.slice(0, plusAt);
  const buildText = plusAt === -1 ? '' : text.slice(plusAt + 1);
  const dashAt = main.indexOf('-');
  const coreText = dashAt === -1 ? main : main.slice(0, dashAt);
  const preText = dashAt === -1 ? '' : main.slice(dashAt + 1);
  const core = coreText.split('.');
  return {
    major: segmentNumber(core[0]),
    minor: segmentNumber(core[1]),
    patch: segmentNumber(core[2]),
    prerelease: preText.length > 0 ? preText.split('.') : [],
    build: buildText.length > 0 ? buildText.split('.') : [],
    raw,
  };
}

function comparePrereleaseSegment(a: string, b: string): number {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);
  if (aNumeric && bNumeric) {
    const na = Number.parseInt(a, 10);
    const nb = Number.parseInt(b, 10);
    return na === nb ? 0 : na < nb ? -1 : 1;
  }
  // semver:数字段优先级低于字母段
  if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
  return a === b ? 0 : a < b ? -1 : 1;
}

/**
 * 插件版本序(升序语义,返回 -1 / 0 / 1)。
 *
 * 规则:core 数值比 → prerelease 缺席(正式版)高于在场 → 段逐个比(数字段低于字母段)→
 * build metadata **不参与**排序 → 仍相等时按 raw 字符串做最终确定性打破平局。
 * 最后这一步是为了让"同 core 不同 build"的两个版本也有唯一顺序,而不是依赖目录枚举顺序。
 */
export function comparePluginVersions(a: string, b: string): number {
  const pa = parsePluginVersion(a);
  const pb = parsePluginVersion(b);
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  if (pa.prerelease.length === 0 && pb.prerelease.length === 0) return breakTie(pa, pb);
  if (pa.prerelease.length === 0) return 1;
  if (pb.prerelease.length === 0) return -1;
  const len = Math.min(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < len; i += 1) {
    const cmp = comparePrereleaseSegment(pa.prerelease[i]!, pb.prerelease[i]!);
    if (cmp !== 0) return cmp;
  }
  if (pa.prerelease.length !== pb.prerelease.length) {
    return pa.prerelease.length < pb.prerelease.length ? -1 : 1;
  }
  return breakTie(pa, pb);
}

function breakTie(a: ParsedPluginVersion, b: ParsedPluginVersion): number {
  // build 不参与排序:只有 build 不同才需要"唯一顺序",否则同一版本的两种写法(`1.2` 与 `1.2.0`)必须相等。
  if (a.build.join('.') === b.build.join('.')) return 0;
  return a.raw === b.raw ? 0 : a.raw < b.raw ? -1 : 1;
}

/** 只差 build metadata 时算同一版本(pin 兼容 `1.0.0` 与 `1.0.0+build.7`) */
function sameVersionIgnoringBuild(a: string, b: string): boolean {
  if (a === b) return true;
  const pa = parsePluginVersion(a);
  const pb = parsePluginVersion(b);
  if (pa.major !== pb.major || pa.minor !== pb.minor || pa.patch !== pb.patch) return false;
  if (pa.prerelease.length !== pb.prerelease.length) return false;
  return pa.prerelease.every((seg, i) => seg === pb.prerelease[i]);
}

function parseDisabledSpecs(specs: readonly string[] | undefined): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  if (!specs) return out;
  for (const spec of specs) {
    const at = spec.lastIndexOf('@');
    if (at <= 0 || at === spec.length - 1) continue; // 不含 `@` 的条目不是版本规格,按未点名处理
    const name = spec.slice(0, at);
    const version = spec.slice(at + 1);
    const bucket = out.get(name);
    if (bucket) bucket.add(version);
    else out.set(name, new Set([version]));
  }
  return out;
}

/**
 * 纯选择:给定候选版本与策略,算出每个名字的 active 版本。
 *
 * 前提(由装载通道保证,本函数也重新兜底):同一 `name@version` 只允许出现一次;
 * 同版本多份仍按歧义处理(该版本整桶不参选)。
 */
export function selectActivePluginVersions(
  candidates: readonly PluginVersionCandidate[],
  policy: PluginVersionPolicy = {},
): PluginVersionSelection {
  const byName = new Map<string, PluginVersionCandidate[]>();
  for (const candidate of candidates) {
    const bucket = byName.get(candidate.name);
    if (bucket) bucket.push(candidate);
    else byName.set(candidate.name, [candidate]);
  }

  const disabledByName = parseDisabledSpecs(policy.disabled);
  const active: PluginVersionCandidate[] = [];
  const shadowed: ShadowedPluginVersion[] = [];
  const diagnostics: PluginDiagnostic[] = [];

  for (const name of [...byName.keys()].sort()) {
    const list = byName.get(name) ?? [];
    const disabledSpecs = disabledByName.get(name) ?? new Set<string>();

    // 同版本多份 = 真歧义:整桶不参选,逐份点名(与 G-684 的口径一致,不因共存通道放行)
    const byVersion = new Map<string, PluginVersionCandidate[]>();
    for (const candidate of list) {
      const bucket = byVersion.get(candidate.version);
      if (bucket) bucket.push(candidate);
      else byVersion.set(candidate.version, [candidate]);
    }

    const resolvable: PluginVersionCandidate[] = [];
    for (const [version, bucket] of byVersion) {
      if (bucket.length > 1) {
        for (const candidate of bucket) {
          const relatedFiles = bucket.filter((other) => other.file !== candidate.file).map((other) => other.file);
          diagnostics.push(
            diagnostic(
              'plugin_ambiguous_name',
              candidate.file,
              `Plugin "${name}@${version}" is declared by ${bucket.length} manifests with the same version, so none of them is loaded (scan order is not an intent)`,
              { pluginName: name, relatedFiles },
            ),
          );
        }
        continue;
      }
      const only = bucket[0]!;
      const isDisabled = [...disabledSpecs].some((spec) => sameVersionIgnoringBuild(spec, version));
      if (isDisabled) {
        shadowed.push({ name, version, file: only.file, reason: 'disabled' });
        diagnostics.push(
          diagnostic(
            'plugin-version-shadowed',
            only.file,
            `Plugin "${name}@${version}" is disabled by settings, so it is kept on disk but its contributions are not loaded`,
            { pluginName: name },
          ),
        );
        continue;
      }
      resolvable.push(only);
    }

    if (resolvable.length === 0) {
      diagnostics.push(
        diagnostic(
          'plugin-version-all-disabled',
          path.dirname(list[0]!.file),
          `Plugin "${name}" has no loadable version left (all ${byVersion.size} on-disk version(s) are disabled or ambiguous), so none is loaded`,
          { pluginName: name, relatedFiles: list.map((candidate) => candidate.file).sort() },
        ),
      );
      continue;
    }

    const pinnedRaw = policy.pins?.[name];
    let chosen: PluginVersionCandidate | undefined;
    let chosenByPin = false;
    if (pinnedRaw !== undefined) {
      chosen = resolvable.find((candidate) => sameVersionIgnoringBuild(candidate.version, pinnedRaw));
      if (chosen) chosenByPin = true;
      else {
        diagnostics.push(
          diagnostic(
            'plugin-version-pin-missing',
            path.dirname(resolvable[0]!.file),
            `Pinned version "${pinnedRaw}" of plugin "${name}" is not installed (or is disabled); falling back to the highest loadable version`,
            { pluginName: name, relatedFiles: resolvable.map((candidate) => candidate.file).sort() },
          ),
        );
      }
    }
    if (!chosen) {
      chosen = resolvable.reduce((best, candidate) =>
        comparePluginVersions(candidate.version, best.version) > 0 ? candidate : best,
      );
    }

    active.push(chosen);
    for (const candidate of resolvable) {
      if (candidate.version === chosen.version && candidate.file === chosen.file) continue;
      shadowed.push({
        name,
        version: candidate.version,
        file: candidate.file,
        reason: chosenByPin ? 'pinned-other-version' : 'higher-version',
      });
      diagnostics.push(
        diagnostic(
          'plugin-version-shadowed',
          candidate.file,
          `Plugin "${name}@${candidate.version}" is kept on disk but not loaded; the active version is "${chosen.version}"`,
          { pluginName: name },
        ),
      );
    }
  }

  active.sort((a, b) => (a.name === b.name ? 0 : a.name < b.name ? -1 : 1));
  shadowed.sort((a, b) => {
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return comparePluginVersions(b.version, a.version);
  });
  return { active, shadowed, diagnostics };
}

interface RawScan {
  candidates: PluginVersionCandidate[];
  diagnostics: PluginDiagnostic[];
  findings: ContributionFinding[];
  activationFindings: ActivationFinding[];
}

/**
 * 扫盘并把**每一份好清单**都收成候选(不做同名裁决;裁决留给 selectActivePluginVersions)。
 * 目录语义与 loader 严格通道完全一致(顶层单插件 / 子目录扫描 / recursive / 非 ENOENT 读失报诊断),
 * 这样两条通道对"哪些清单算在盘"不会给出两种答案。
 */
function collectCandidates(opts: LoadPluginsOptions): RawScan {
  const candidates: PluginVersionCandidate[] = [];
  const diagnostics: PluginDiagnostic[] = [];
  const findings: ContributionFinding[] = [];
  const activationFindings: ActivationFinding[] = [];
  const dir = path.resolve(opts.pluginsDir);

  let isDirectory = false;
  try {
    const stat = opts.stat ?? ((target: string) => fs.statSync(target));
    isDirectory = stat(dir).isDirectory();
  } catch (err) {
    if (!isDefinitePathAbsence(err)) diagnostics.push(unexpectedDiagnostic(dir, err));
  }
  if (!isDirectory) {
    return { candidates, diagnostics, findings, activationFindings };
  }

  function acceptManifest(file: string): void {
    try {
      const outcome = parseManifestFile(file);
      diagnostics.push(...outcome.diagnostics);
      if (!outcome.manifest) return;
      const definition = normalizeManifest(outcome.manifest, file);
      findings.push(
        ...classifyContributions(contributionInputOf(outcome.manifest, definition.name, file)).findings,
      );
      activationFindings.push(
        ...classifyActivations(activationInputOf(outcome.manifest, definition.name, file)).findings,
      );
      candidates.push({ name: definition.name, version: definition.version, file, definition });
    } catch (err) {
      diagnostics.push(unexpectedDiagnostic(file, err));
    }
  }

  function scanDir(current: string, depth: number): void {
    if (!opts.recursive && depth > 1) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      diagnostics.push(unexpectedDiagnostic(current, err));
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subDir = path.join(current, entry.name);
      try {
        const lookup = findManifestInDir(subDir);
        diagnostics.push(...lookup.diagnostics);
        if (lookup.primary) acceptManifest(lookup.primary);
        else if (opts.recursive) scanDir(subDir, depth + 1);
      } catch (err) {
        diagnostics.push(unexpectedDiagnostic(subDir, err));
      }
    }
  }

  const topLevel = findManifestInDir(dir);
  diagnostics.push(...topLevel.diagnostics);
  if (topLevel.primary) acceptManifest(topLevel.primary);
  else scanDir(dir, 1);

  return { candidates, diagnostics, findings, activationFindings };
}

/**
 * 多版本共存装载出口。不传 `policy` 时等价于"全部版本参选、选 semver 最高",
 * 但仍与严格通道不同(严格通道会把同名不同版本全枪毙)—— 所以本出口只有显式调用才生效。
 */
export function loadPluginsWithVersionPolicy(
  opts: LoadPluginsOptions & { policy?: PluginVersionPolicy },
): MultiVersionLoadResult {
  const scanned = collectCandidates(opts);
  const selection = selectActivePluginVersions(scanned.candidates, opts.policy ?? {});
  const diagnostics = [
    ...scanned.diagnostics,
    ...selection.diagnostics,
    ...contributionDiagnosticsOf(scanned.findings),
    ...activationDiagnosticsOf(scanned.activationFindings),
  ];
  // 接口型工具只对 active 版本编译(与"被 shadowed 的版本不装载"同一语义)。
  // 名字占用面含宿主在册工具 + 本批已编译成功的工具,跨清单累积后才不会两份都"编译成功"。
  const interfaceTools: CompiledInterfaceTool[] = [];
  const interfaceOutcomes: InterfaceCompileOutcome[] = [];
  const taken = new Set<string>(opts.takenToolNames ?? []);
  for (const candidate of selection.active) {
    // 判据与"拒收 → 诊断"的映射单源 = interface-tools.ts;本层只累积(与 loader 同一个出口)。
    const compiled = compilePluginInterfaces(
      candidate.definition.interfaces,
      candidate.file,
      candidate.name,
      taken,
    );
    interfaceOutcomes.push(...compiled.outcomes);
    diagnostics.push(...compiled.diagnostics);
    for (const tool of compiled.tools) taken.add(tool.name);
    interfaceTools.push(...compiled.tools);
  }
  return {
    plugins: selection.active.map((candidate) => candidate.definition),
    shadowed: selection.shadowed,
    diagnostics,
    contributions: summarizeContributions(scanned.findings),
    activations: summarizeActivations(scanned.activationFindings),
    interfaceTools,
    interfaceOutcomes,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
