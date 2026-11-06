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
 * 分层(goal-b49/W2 拆分,AGENTS §3 每页 <250 行;判据一条没动,只是换了住处):
 *   - `manifest-scan.ts` — 单份清单的读取/最小校验/规范化 + 判别码→严重级唯一表
 *   - `contribution-audit.ts` — 贡献词表的运行期消费方(逐档裁决 + 默认拒 + findings→诊断)
 *   - `activation-events.ts` — 激活词表的运行期消费方(装载/延迟/拒绝三态 + findings→诊断)
 *   - `permission-names.ts` — 声明式权限名 → 正牌 scope 的归属表(数据类判定仍只有一把尺)
 *   - 本文件 — 目录扫描、同名歧义裁决、三个装载出口
 *
 * 想知道"哪些清单被跳过了、为什么"调 loadPluginsWithDiagnostics();
 * 想知道"某份清单声明的贡献档本宿主吃不吃得下"调 loadPluginsWithContributionAudit()。
 * `declined` / `unknown-kind` 两档**已经各占 diagnostics 里的一行**(warning),所以走的就是
 * `agent.ts` 那条诊断主通道到人前 —— 不静默、不新增环境变量、不升任何档。
 * loadPlugins() 保留返回 PluginDefinition[] 的既有契约(既有调用方零改动)。
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
import { isDefinitePathAbsence } from './path-safety.js';
import type {
  LoadPluginsOptions,
  PluginDefinition,
  PluginDiagnostic,
  PluginLoadResult,
  PluginManifest,
} from './types.js';
import {
  diagnostic,
  findManifestInDir,
  isValidManifest,
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
import { activationDiagnosticsOf, activationInputOf, classifyActivations, summarizeActivations, type ActivationFinding, type PluginActivationAudit } from './activation-events.js';

/**
 * 拆分前后本文件的**导出集逐字不变**(形状锁 = `tests/plugin-contribution-diagnostic-dispatch.test.ts`)。
 * 审计实现的真身住在 `contribution-audit.ts`,这里只中转名字:既不是第二份实现(§0.6),
 * 也让既有 `import { classifyContributions } from '…/plugins/loader.js'` 的调用方零改动。
 */
export { classifyContributions } from './contribution-audit.js';
export type {
  ContributionFinding,
  ContributionInput,
  ContributionSupport,
  ContributionVerdict,
  PluginContributionAudit,
} from './contribution-audit.js';

/** 已通过最小校验、等待歧义裁决的候选(保留 file 与 definition,歧义时要点名路径) */
interface ManifestCandidate {
  name: string;
  file: string;
  definition: PluginDefinition;
}

/** 内部扫描结果 = 装载结果 + 贡献裁决 + 激活事件裁决(PluginLoadResult 是 types.ts 的既有契约,不扩字段) */
export interface ScanResult extends PluginLoadResult {
  contributions: PluginContributionAudit;
  /** goal-b49/W6:激活事件的三态裁决(装载/延迟/拒绝),判据单源见 `activation-events.ts` */
  activations: PluginActivationAudit;
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
  /** 逐档激活裁决(goal-b49/W6):每份清单声明了几个事件就出几条,未声明零条 */
  const activationFindings: ActivationFinding[] = [];
  /** name → 声明它的候选(长度 >1 即为歧义) */
  const candidates = new Map<string, ManifestCandidate[]>();

  const dir = path.resolve(opts.pluginsDir);

  let isDirectory = false;
  try {
    const stat = opts.stat ?? ((target: string) => fs.statSync(target));
    isDirectory = stat(dir).isDirectory();
  } catch (err) {
    if (!isDefinitePathAbsence(err)) diagnostics.push(unexpectedDiagnostic(dir, err));
  }
  if (!isDirectory) {
    return { plugins, diagnostics, contributions: summarizeContributions(findings), activations: summarizeActivations(activationFindings) };
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
      // 激活事件同批逐档裁决(goal-b49/W6):与贡献一样,管的是"声明了什么、本宿主能不能真触发"
      activationFindings.push(...classifyActivations(activationInputOf(outcome.manifest, definition.name, file)).findings);
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
  // 拒档进主通道(goal-b49/W2):非 accepted 的裁决各摊一条 warning 诊断,与清单级诊断同一条数组、
  // 同一个派发出口(agent.ts 的 reportPluginDiagnostics)——不另开第二条通道,也不升任何档。
  diagnostics.push(...contributionDiagnosticsOf(findings));
  diagnostics.push(...activationDiagnosticsOf(activationFindings));
  return { plugins, diagnostics, contributions: summarizeContributions(findings), activations: summarizeActivations(activationFindings) };
}

/**
 * 既有出口:只回装载结果(PluginLoadResult 的字段形状由 types.ts 定,本席不改它)。
 * `declined` / `unknown-kind` 各占一条诊断**已经在这条 diagnostics 数组里**;想要结构化的逐档依据
 * (档名 / 声明条数 / 可达数据类 / 未登记 scope)请改调 loadPluginsWithContributionAudit()
 * —— 那一份汇总在这里是被**函数签名**丢掉,不是被静默忽略:调用方看得见自己拿了什么。
 */
export function loadPluginsWithDiagnostics(opts: LoadPluginsOptions): PluginLoadResult {
  const { plugins, diagnostics } = scanPlugins(opts);
  return { plugins, diagnostics };
}

/**
 * 装载 + 逐档贡献裁决(词表消费方出口;生产调用点 = `commands/agent.ts`)。
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
