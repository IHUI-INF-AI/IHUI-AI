// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plugins 扫描引擎 —— "从目录到插件集合"的全部判据(2026-11-13 自 `loader.ts` 拆出)。
 *
 * 拆因(AGENTS §3 每页 <250 行 +「加面先拆档」):本票要给装载链加**接口型工具**那一面
 * (清单 `interfaces[]` → 编译成真 `Tool`),而 `loader.ts` 当时已 249 行 —— 直接把新面往上堆
 * 就把它推过档。按既有纪律「加面先拆档,不得把超档继续往上堆」,扫描引擎整体搬来此处,
 * `loader.ts` 只留三个装载出口的逐字转接(不是第二份实现,§0.6)。
 *
 * 判据一条没动,只换了住处:
 *   - 目录语义(顶层单插件 / 子目录 / recursive / 非 ENOENT 读失报诊断)
 *   - 同名歧义「两个都不装载」(G-684)—— 扫描顺序不是任何人声明过的意图
 *   - 贡献档 / 激活事件 / 接口声明的逐档裁决(各自判据仍住它们自己的档)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
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
} from './contribution-audit.js';
import {
  activationDiagnosticsOf,
  activationInputOf,
  classifyActivations,
  summarizeActivations,
  type ActivationFinding,
} from './activation-events.js';
import {
  compilePluginInterfaces,
  type CompiledInterfaceTool,
  type InterfaceCompileOutcome,
} from './interface-tools.js';
import type { LoadPluginsOptions, PluginDefinition, PluginDiagnostic } from './types.js';
import type { ScanResult } from './scan-result.js';

/** 已通过最小校验、等待歧义裁决的候选(保留 file 与 definition,歧义时要点名路径) */
interface ManifestCandidate {
  name: string;
  file: string;
  definition: PluginDefinition;
}

/**
 * 扫描 pluginsDir,返回已装载插件 + 每一条被跳过清单的诊断 + 逐档裁决 + 接口型工具。
 *
 * 扫描规则:
 *   - pluginsDir 不存在 / 不是目录 → 返回空集合(不存在是常态,不记诊断)
 *   - pluginsDir 本身含 plugin.json/plugin.config.json → 视为顶层单插件,不再扫子目录
 *   - 否则扫描 pluginsDir 的每个子目录,各子目录内查找清单文件
 *   - recursive=true 时递归扫描没有清单的子目录
 *   - 任一清单解析失败/校验失败 → 跳过并留诊断,不抛异常
 *   - 同名多份 → 全部不装载,各点名一条诊断(G-684)
 */
export function scanPlugins(opts: LoadPluginsOptions): ScanResult {
  const plugins: PluginDefinition[] = [];
  const diagnostics: PluginDiagnostic[] = [];
  /** 逐档贡献裁决(每份在盘的清单恰好贡献 0..N 条,取决于它声明了几档) */
  const findings: ContributionFinding[] = [];
  /** 逐档激活裁决(goal-b49/W6):每份清单声明了几个事件就出几条,未声明零条 */
  const activationFindings: ActivationFinding[] = [];
  /** name → 声明它的候选(长度 >1 即为歧义) */
  const candidates = new Map<string, ManifestCandidate[]>();
  /**
   * 接口型工具的累积面(2026-11-13):编译成功的工具 + 逐条裁决。
   *
   * 跨清单累积而不是每份各管各的:`takenNames` 必须看见**本次已占用的全部名字**,
   * 否则两份清单贡献同名工具时两边都"编译成功",到最后 registerTools 才静默丢一个 ——
   * 那就把"哪条没装上"推给了启动后的运行期,人前看不到。
   */
  const interfaceTools: CompiledInterfaceTool[] = [];
  const interfaceOutcomes: InterfaceCompileOutcome[] = [];
  /** 已占用工具名(先由调用方注入宿主在册工具,再随编译推进增长) */
  const takenNames = new Set<string>(opts.takenToolNames ?? []);

  const dir = path.resolve(opts.pluginsDir);

  let isDirectory = false;
  try {
    const stat = opts.stat ?? ((target: string) => fs.statSync(target));
    isDirectory = stat(dir).isDirectory();
  } catch (err) {
    if (!isDefinitePathAbsence(err)) diagnostics.push(unexpectedDiagnostic(dir, err));
  }
  if (!isDirectory) {
    return {
      plugins,
      diagnostics,
      contributions: summarizeContributions(findings),
      activations: summarizeActivations(activationFindings),
      interfaceTools,
      interfaceOutcomes,
    };
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
      // 接口型工具(2026-11-13):同样对**每一份通过最小校验的清单**编译。
      // 判据与"拒收 → 诊断"的映射都在 interface-tools.ts,本层只累积结果(§0.6 不抄第二份)。
      const compiled = compilePluginInterfaces(definition.interfaces, file, definition.name, takenNames);
      interfaceOutcomes.push(...compiled.outcomes);
      diagnostics.push(...compiled.diagnostics);
      for (const tool of compiled.tools) takenNames.add(tool.name);
      interfaceTools.push(...compiled.tools);
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
  return {
    plugins,
    diagnostics,
    contributions: summarizeContributions(findings),
    activations: summarizeActivations(activationFindings),
    interfaceTools,
    interfaceOutcomes,
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
