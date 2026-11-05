// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plugins 加载器 — 扫描指定目录下的 plugin.json / plugin.config.json。
 *
 * 简化策略(做减法):
 *   - 只支持 JSON 清单(不动态 import .js/.ts,避免 ESM/CJS 互操作复杂度)
 *   - 扫描目录下每个子目录(默认非递归)的 plugin.json 或 plugin.config.json
 *   - 也支持顶层 plugin.json(目录本身就是一个插件)
 *   - 解析失败 / 缺 name / 缺 version 的清单跳过,**各留一条带稳定判别码的诊断**(G-683:
 *     原先 `catch { return null }` 有隔离但零诊断,用户只看到"插件没生效"而账面无线索)
 *   - 同名多份:**两个都不装载**,各点名一条诊断(G-684)——装载顺序不是任何人声明过的意图
 *   - 单点失败一律 `continue`,装载永不抛穿
 *
 * 需要知道"哪些清单被跳过了、为什么"请调 loadPluginsWithDiagnostics();
 * loadPlugins() 保留返回 PluginDefinition[] 的既有契约(agent.ts 等既有调用方零改动)。
 *
 * G-816034-b49/S2:装载器同时是**贡献词表**的消费方(词表单源 =
 * `@ihui/types` 的 `EXTENSION_CONTRIBUTION_KINDS`,本文件不得另抄一份名单,§0.6)。
 * 每份清单声明的 `contributes` 逐档裁决,三态都必须**出声**:
 *   - `accepted`   :本宿主持有该档、且该插件声明了能在 capability-catalog 落地的权限;
 *   - `declined`   :本宿主没有该档的落点(如 `nativeModules` 要原生二进制),点名原因;
 *   - `unknown-kind`:不在词表内,点名当前词表全量。
 * "识别到但本宿主不支持"与"根本不认识"是两件事,分开编码,免得一种失效形态伪装成另一种。
 * 权限那一维走 capability-catalog 的**默认拒**:未声明权限的插件拿不到任何数据类,
 * 其贡献一律 declined(详见 classifyContributions)。
 *
 * 目录结构示例:
 *   plugins/
 *     my-plugin/
 *       plugin.json
 *     another/
 *       plugin.config.json
 *     top-level-plugin.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  EXTENSION_CONTRIBUTION_KINDS,
  extensionDataClassGrant,
  type CapabilityDataClass,
  type ExtensionContributionKind,
} from '@ihui/types';
import type {
  LoadPluginsOptions,
  PluginDefinition,
  PluginDiagnostic,
  PluginDiagnosticCode,
  PluginDiagnosticSeverity,
  PluginLoadResult,
  PluginManifest,
} from './types.js';

/** 候选清单文件名(按优先级排序,前者在位时后者被忽略并留一条 warning 诊断) */
const MANIFEST_FILES = ['plugin.json', 'plugin.config.json'];

/** 本装载器对某一贡献档的支持结论。 */
export type ContributionSupport = 'wired' | 'no-host';

/**
 * 词表逐档的装载期裁决 —— **贡献词表的消费者就住在这里**。
 *
 * 键型写成 `Record<ExtensionContributionKind, …>` 而不是 `Record<string, …>`:
 * 词表加一档而这里没跟上 ⇒ 编译期即红(门 121「声明必须有消费者」里"编译期那一半";
 * 运行期那一半由 classifyContributions 的用例钉住 —— 只靠注释声称"已接"不算接,§0.9)。
 *
 * `no-host` 不是"不支持所以不写":对侧 catalog 把这 8 档原样声明给宿主,没有任何"本机能不能吃"
 * 的判定;吃不下又不出声 = 静默忽略,用户只看到"插件装了但没东西"。逐档给**可复述的原因**。
 */
const CONTRIBUTION_SUPPORT: Record<ExtensionContributionKind, { support: ContributionSupport; reason: string }> = {
  tools: { support: 'wired', reason: 'loader forwards tools[] to the plugin registry' },
  commands: { support: 'wired', reason: 'loader forwards commands[] to the plugin registry' },
  views: { support: 'no-host', reason: 'no workbench/settings view host in the CLI: a contributed view has nowhere to mount' },
  filePreviewers: { support: 'no-host', reason: 'no file-preview surface in the CLI: nothing consumes filenameSuffixes routing' },
  qoderAgentSdk: { support: 'no-host', reason: 'no agent-SDK injection channel in this host' },
  configuration: { support: 'no-host', reason: 'no settings host in the plugin loader; configuration keys are owned by apps/cli settings' },
  nativeModules: { support: 'no-host', reason: 'requires a native binary (.node) matched to this host ABI; the CLI loader never loads native code' },
  sidebarNavItems: { support: 'no-host', reason: 'no sidebar surface in the CLI' },
  sessionResources: { support: 'no-host', reason: 'no session-resource panel in the CLI' },
  chatMentionProviders: { support: 'no-host', reason: 'no chat mention provider registry in the CLI' },
};

/** 词表档名 → 裁决表的唯一查表出口(不做第二份名单,也不静默回落成 wired)。 */
function supportOf(kind: string): { support: ContributionSupport; reason: string } | null {
  return (CONTRIBUTION_SUPPORT as Record<string, { support: ContributionSupport; reason: string } | undefined>)[
    kind
  ] ?? null;
}

/** 逐档裁决三态:`accepted` / `declined`(本宿主吃不下或拿不到数据类)/ `unknown-kind`(不在词表内)。 */
export type ContributionVerdict = 'accepted' | 'declined' | 'unknown-kind';

/** 一条贡献裁决(ASCII 文案:要进日志,不得被控制台码页吃掉)。 */
export interface ContributionFinding {
  pluginName: string;
  /** 声明该贡献的清单绝对路径 */
  file: string;
  /** 档名(原样照抄清单里的键,便于用户对着自己的文件改) */
  kind: string;
  verdict: ContributionVerdict;
  /** 清单里该档声明了几条(非数组时为 0,并在 reasons 里点名形态问题) */
  itemCount: number;
  /** 判定依据(accepted 给出"为什么算数";declined/unknown-kind 给出"为什么不算") */
  reasons: string[];
  /** 该插件声明的权限映射出的可达数据类;空数组 = 默认拒(任何数据类都拿不到) */
  dataClasses: readonly CapabilityDataClass[];
  /** 声明了但未在 capability-catalog 登记的 scope(逐条点名,不冒充"没限制") */
  unregisteredPermissions: readonly string[];
}

/** 一次装载/一次判定的贡献汇总。 */
export interface PluginContributionAudit {
  findings: ContributionFinding[];
  acceptedCount: number;
  declinedCount: number;
  unknownKindCount: number;
}

/** classifyContributions 的入参(从清单原始对象取,不依赖 PluginManifest 形态) */
export interface ContributionInput {
  pluginName: string;
  file: string;
  permissions?: unknown;
  contributes?: unknown;
}

/** 读 permissions 为字符串数组:非数组/非字符串一律按"未声明"处理,由默认拒兜住。 */
function permissionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

/**
 * 逐档裁决一份清单的 `contributes`。纯函数:不读盘、不改状态、永不抛穿。
 *
 * 默认拒的两道闸(缺一不算默认拒):
 *  1. 档必须落在词表内,否则 unknown-kind 并点名当前词表全量;
 *  2. 落点了也得有数据面 —— 权限集合经 `extensionDataClassGrant` 求出的可达数据类为空
 *     (未声明权限 / 声明了但未登记)⇒ 一律 declined,即使该档本身是 `wired`。
 */
export function classifyContributions(input: ContributionInput): PluginContributionAudit {
  const permissions = permissionList(input.permissions);
  const grant = extensionDataClassGrant({ permissions });
  const findings: ContributionFinding[] = [];

  if (input.contributes !== undefined) {
    if (
      input.contributes === null ||
      typeof input.contributes !== 'object' ||
      Array.isArray(input.contributes)
    ) {
      findings.push({
        pluginName: input.pluginName,
        file: input.file,
        kind: 'contributes',
        verdict: 'unknown-kind',
        itemCount: 0,
        reasons: ['"contributes" must be a plain object of kind -> contribution[]'],
        dataClasses: grant.allowed,
        unregisteredPermissions: grant.unregistered,
      });
    } else {
      for (const [kind, value] of Object.entries(input.contributes as Record<string, unknown>)) {
        const items = Array.isArray(value) ? value : null;
        const support = supportOf(kind);
        const reasons: string[] = [];
        let verdict: ContributionVerdict;
        if (!support) {
          verdict = 'unknown-kind';
          reasons.push(`"${kind}" is not a known contribution kind`);
          reasons.push(`known kinds: ${EXTENSION_CONTRIBUTION_KINDS.join('/')}`);
        } else if (items === null) {
          verdict = 'declined';
          reasons.push(`"contributes.${kind}" must be an array; got ${typeof value}`);
        } else if (support.support === 'no-host') {
          verdict = 'declined';
          reasons.push(support.reason);
        } else if (grant.allowed.length === 0) {
          verdict = 'declined';
          reasons.push(
            permissions.length === 0
              ? 'no permission declared: default deny, no dataClass reachable'
              : 'declared permissions map to no dataClass in capability-catalog: default deny',
          );
          if (grant.unregistered.length > 0) {
            reasons.push(`unregistered scopes: ${grant.unregistered.join('/')}`);
          }
        } else {
          verdict = 'accepted';
          reasons.push(support.reason);
        }
        findings.push({
          pluginName: input.pluginName,
          file: input.file,
          kind,
          verdict,
          itemCount: items ? items.length : 0,
          reasons,
          dataClasses: grant.allowed,
          unregisteredPermissions: grant.unregistered,
        });
      }
    }
  }

  return summarizeContributions(findings);
}

/** 汇总:计数只按 verdict 算一次,单条判定与聚合共用同一实现(不做两遍判据)。 */
function summarizeContributions(findings: ContributionFinding[]): PluginContributionAudit {
  return {
    findings,
    acceptedCount: findings.filter((f) => f.verdict === 'accepted').length,
    declinedCount: findings.filter((f) => f.verdict === 'declined').length,
    unknownKindCount: findings.filter((f) => f.verdict === 'unknown-kind').length,
  };
}

/**
 * 把清单原始对象摊成 classifyContributions 入参。
 *
 * `PluginManifest`(types.ts 的既有 schema,本席不得改)没有 contributes/permissions 字段,
 * 但 `parseManifestFile` 交回的是 JSON.parse 的完整对象,`normalizeManifest` 才做白名单裁剪 ——
 * 所以这里读的是**裁剪前**的字节。唯一一次加宽集中在这行,不扩散到判定逻辑。
 */
function contributionInputOf(manifest: PluginManifest, pluginName: string, file: string): ContributionInput {
  const raw = manifest as unknown as Record<string, unknown>;
  return { pluginName, file, permissions: raw.permissions, contributes: raw.contributes };
}

/**
 * 判别码 → 严重级的唯一映射。
 * 集中在装载器这一侧而不是每个产出点各挑一档:两处算同一件事必漂移(本仓记过多次)。
 * `Record<PluginDiagnosticCode, …>` 要求键穷尽联合 —— 新增码忘了定档,编译期就红。
 */
const DIAGNOSTIC_SEVERITY: Record<PluginDiagnosticCode, PluginDiagnosticSeverity> = {
  'manifest-unreadable': 'error',
  'manifest-json-invalid': 'error',
  'manifest-not-object': 'error',
  'manifest-name-missing': 'error',
  'manifest-version-missing': 'error',
  'manifest-shadowed-by-priority': 'warning',
  'plugin_ambiguous_name': 'error',
  'manifest-unexpected-error': 'error',
  'plugin-dependency-cycle': 'error',
};

/** 错误文本(unknown 收窄,零 any) */
function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 造一条诊断:severity 由码唯一决定,产出点不得自行挑档 */
function diagnostic(
  code: PluginDiagnosticCode,
  file: string,
  message: string,
  extra?: { pluginName?: string; relatedFiles?: string[] },
): PluginDiagnostic {
  const entry: PluginDiagnostic = { code, severity: DIAGNOSTIC_SEVERITY[code], file, message };
  if (extra?.pluginName !== undefined) entry.pluginName = extra.pluginName;
  if (extra?.relatedFiles && extra.relatedFiles.length > 0) entry.relatedFiles = extra.relatedFiles;
  return entry;
}

/** 兜底诊断:未预期的抛点也编码成数据,绝不让单点失败抛穿整次装载 */
function unexpectedDiagnostic(file: string, err: unknown): PluginDiagnostic {
  return diagnostic(
    'manifest-unexpected-error',
    file,
    `Unexpected error while scanning "${path.basename(file)}": ${errorText(err)}`,
  );
}

/** 校验解析后的对象是否符合 PluginManifest 最小约束(name + version 必填) */
function isValidManifest(obj: unknown): obj is PluginManifest {
  if (!obj || typeof obj !== 'object') return false;
  const m = obj as Record<string, unknown>;
  return typeof m.name === 'string' && m.name.length > 0 && typeof m.version === 'string' && m.version.length > 0;
}

/** 规范化清单 — 仅保留 schema 内字段,数组字段缺失时初始化为 undefined */
function normalizeManifest(raw: PluginManifest, source: string): PluginDefinition {
  const def: PluginDefinition = {
    name: raw.name,
    version: raw.version,
    source,
  };
  if (raw.description !== undefined) def.description = raw.description;
  if (raw.author !== undefined) def.author = raw.author;
  if (Array.isArray(raw.tools)) def.tools = raw.tools.filter((t) => typeof t === 'string');
  if (Array.isArray(raw.hooks)) def.hooks = raw.hooks.filter((h) => typeof h === 'string');
  if (Array.isArray(raw.commands)) def.commands = raw.commands.filter((c) => typeof c === 'string');
  // G-682:dependencies 必须透传,否则 JSON 清单声明的依赖到不了 registry 的注册前闭包校验
  if (Array.isArray(raw.dependencies)) def.dependencies = raw.dependencies.filter((d) => typeof d === 'string');
  return def;
}

/** 单个清单的解析结果:manifest 为 null 表示该清单被跳过,diagnostics 是它留下的诊断 */
interface ManifestParseOutcome {
  manifest: PluginManifest | null;
  diagnostics: PluginDiagnostic[];
}

/**
 * 解析单个清单文件 —— G-683 的核心:把失败编码成数据,不是异常,也不是 null。
 * 每份被跳过的清单**恰好**留一条诊断(首个不成立的条件即返回,不再叠加)。
 */
function parseManifestFile(file: string): ManifestParseOutcome {
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf-8');
  } catch (err) {
    return { manifest: null, diagnostics: [diagnostic('manifest-unreadable', file, `Cannot read manifest file: ${errorText(err)}`)] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    return { manifest: null, diagnostics: [diagnostic('manifest-json-invalid', file, `Manifest is not valid JSON: ${errorText(err)}`)] };
  }

  // 数组/字符串/数字/null 都能 JSON.parse 成功,但都不是清单 —— 旧实现会把它们报成"缺 name",
  // 那是把"形态就不对"和"字段没填"混成一码,排查方向会被指错(同名歧义的教训是同一条)。
  if (Array.isArray(parsed) || !parsed || typeof parsed !== 'object') {
    return { manifest: null, diagnostics: [diagnostic('manifest-not-object', file, 'Manifest JSON must decode to a plain object')] };
  }

  const obj = parsed as Record<string, unknown>;
  if (!isValidManifest(obj)) {
    const code: PluginDiagnosticCode =
      typeof obj.name !== 'string' || obj.name.length === 0 ? 'manifest-name-missing' : 'manifest-version-missing';
    const field = code === 'manifest-name-missing' ? 'name' : 'version';
    return { manifest: null, diagnostics: [diagnostic(code, file, `Manifest is missing the required field "${field}"`)] };
  }

  return { manifest: obj, diagnostics: [] };
}

/** 目录内清单查找结果:primary = 实际装载的那份;diagnostics = 被优先级压掉的那份留下的 warning */
interface ManifestLookup {
  primary: string | null;
  diagnostics: PluginDiagnostic[];
}

/**
 * 在目录中查找清单文件(优先 plugin.json,其次 plugin.config.json)。
 * 高优先级文件在位时,另一份不是"不存在"而是"被忽略" —— 留一条 warning,静默会让
 * 用户以为自己写的那份生效了(与 G-683 同型:被跳过的内容必须报名)。
 */
function findManifestInDir(dir: string): ManifestLookup {
  const present: string[] = [];
  for (const name of MANIFEST_FILES) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) present.push(candidate);
  }
  const primary = present[0] ?? null;
  const diagnostics: PluginDiagnostic[] = [];
  if (primary) {
    for (const shadowed of present.slice(1)) {
      diagnostics.push(
        diagnostic(
          'manifest-shadowed-by-priority',
          shadowed,
          `Ignored because "${path.basename(primary)}" in the same directory has higher priority`,
        ),
      );
    }
  }
  return { primary, diagnostics };
}

/** 已通过最小校验、等待歧义裁决的候选(保留 file 与 definition,歧义时要点名路径) */
interface ManifestCandidate {
  name: string;
  file: string;
  definition: PluginDefinition;
}

/** 内部扫描结果 = 装载结果 + 贡献裁决(PluginLoadResult 是 types.ts 的既有契约,不扩字段) */
export interface ScanResult extends PluginLoadResult {
  contributions: PluginContributionAudit;
}

/**
 * 扫描 pluginsDir,返回已装载插件 + 每一条被跳过清单的诊断 + 逐档贡献裁决。
 *
 * 扫描规则:
 *   - pluginsDir 不存在 / 不是目录 → 返回空集合(不存在是常态,不记诊断)
 *   - pluginsDir 本身含 plugin.json/plugin.config.json → 视为顶层单插件,不再扫子目录
 *   - 否则扫描 pluginsDir 的每个子目录,各子目录内查找清单文件
 *   - recursive=true 时递归扫描没有清单的子目录
 *   - 任一清单解析失败/校验失败 → 跳过并留诊断,不抛异常
 *   - 同名多份 → 全部不装载,各点名一条诊断(G-684)
 */
function scanPlugins(opts: LoadPluginsOptions): ScanResult {
  const plugins: PluginDefinition[] = [];
  const diagnostics: PluginDiagnostic[] = [];
  /** 逐档贡献裁决(每份在盘的清单恰好贡献 0..N 条,取决于它声明了几档) */
  const findings: ContributionFinding[] = [];
  /** name → 声明它的候选(长度 >1 即为歧义) */
  const candidates = new Map<string, ManifestCandidate[]>();

  const dir = path.resolve(opts.pluginsDir);

  let isDirectory = false;
  try {
    isDirectory = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch (err) {
    diagnostics.push(unexpectedDiagnostic(dir, err));
  }
  if (!isDirectory) {
    return { plugins, diagnostics, contributions: summarizeContributions(findings) };
  }

  /** 收下一份清单:坏清单只留诊断(恰好一条)并继续,好清单进候选等待歧义裁决 */
  function acceptManifest(file: string): void {
    try {
      const outcome = parseManifestFile(file);
      diagnostics.push(...outcome.diagnostics);
      if (!outcome.manifest) return;
      const definition = normalizeManifest(outcome.manifest, file);
      // 贡献裁决对**每一份通过最小校验的清单**给出,包括后来因同名歧义被丢弃的那份:
      // 歧义裁决管"装不装",本管"声明了什么、本宿主吃不吃得下",两者互不遮蔽。
      findings.push(...classifyContributions(contributionInputOf(outcome.manifest, definition.name, file)).findings);
      const bucket = candidates.get(definition.name);
      if (bucket) bucket.push({ name: definition.name, file, definition });
      else candidates.set(definition.name, [{ name: definition.name, file, definition }]);
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
        // 单点失败 continue:一个坏目录不得让整次装载抛穿
        diagnostics.push(unexpectedDiagnostic(subDir, err));
      }
    }
  }

  /**
   * G-684/G-658:同名多份 ⇒ **两个都不装载**,各留一条点名双方路径的 plugin_ambiguous_name 诊断。
   *
   * 原实现是 `results.set(manifest.name, …)`(后写覆盖前写):谁的凭据/工具生效由
   * 目录枚举顺序决定,而"扫描顺序"不是任何人声明过的意图 —— 歧义被静默裁决等于掷骰子,
   * 所以宁可不玩。宁可一个都不装、把两份路径都喊出来,也不要"碰巧赢的那份"。
   * 刻意不比较正文是否等价:一旦开始比"这两份算不算同一回事",就又要回答"那到底听谁的",
   * 回到同一个洞。
   */
  function adjudicate(): void {
    for (const [name, list] of candidates) {
      if (list.length === 1) {
        const only = list[0];
        if (only) plugins.push(only.definition);
        continue;
      }
      for (const candidate of list) {
        const relatedFiles = list.filter((other) => other.file !== candidate.file).map((other) => other.file);
        diagnostics.push(
          diagnostic(
            'plugin_ambiguous_name',
            candidate.file,
            `Plugin name "${name}" is declared by ${list.length} manifests, so none of them is loaded (scan order is not an intent)`,
            { pluginName: name, relatedFiles },
          ),
        );
      }
    }
  }

  const topLevel = findManifestInDir(dir);
  diagnostics.push(...topLevel.diagnostics);
  if (topLevel.primary) acceptManifest(topLevel.primary);
  else scanDir(dir, 1);

  adjudicate();
  return { plugins, diagnostics, contributions: summarizeContributions(findings) };
}

/**
 * 既有出口:只回装载结果(PluginLoadResult 的字段形状由 types.ts 定,本席不改它)。
 * 想知道"某份清单声明的贡献档本宿主吃不吃得下"请改调 loadPluginsWithContributionAudit()
 * —— 那一份贡献裁决在这里是被**函数签名**丢掉,不是被静默忽略:调用方看得见自己拿了什么。
 */
export function loadPluginsWithDiagnostics(opts: LoadPluginsOptions): PluginLoadResult {
  const { plugins, diagnostics } = scanPlugins(opts);
  return { plugins, diagnostics };
}

/**
 * 装载 + 逐档贡献裁决(词表消费方出口)。
 *
 * 返回形态刻意与 loadPluginsWithDiagnostics 同族并附加 `contributions`,
 * 使既有 `{ plugins, diagnostics }` 的解构继续可用(不破坏任何已装车的调用点)。
 */
export function loadPluginsWithContributionAudit(opts: LoadPluginsOptions): ScanResult {
  return scanPlugins(opts);
}

/**
 * 兼容出口 — 只返回成功装载的插件数组(既有调用方与既有测试钉的就是这个形态)。
 * 想知道"某份清单为什么没生效"请改调 loadPluginsWithDiagnostics()。
 */
export function loadPlugins(opts: LoadPluginsOptions): PluginDefinition[] {
  return loadPluginsWithDiagnostics(opts).plugins;
}

/** 校验单个清单对象(导出供测试与 registry 内部复用) */
export function validateManifest(obj: unknown): obj is PluginManifest {
  return isValidManifest(obj);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
