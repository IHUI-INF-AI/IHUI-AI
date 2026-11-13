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
 * 分层(AGENTS §3 每页 <250 行;判据一条没动,只是换了住处):
 *   - `manifest-scan.ts` — 单份清单的读取/最小校验/规范化 + 判别码→严重级唯一表
 *   - `contribution-audit.ts` — 贡献词表的运行期消费方(逐档裁决 + 默认拒 + findings→诊断)
 *   - `activation-events.ts` — 激活词表的运行期消费方(装载/延迟/拒绝三态 + findings→诊断)
 *   - `interface-tools.ts` — 清单 `interfaces[]` → 可调用 `Tool` 的编译与拒收判据
 *   - `plugin-scan.ts` — 目录扫描、同名歧义裁决、逐档裁决的汇总(2026-11-13 拆出)
 *   - `scan-result.ts` — 扫描结果的形状(两边共用,避免循环 import)
 *   - 本文件 — **只有**三个装载出口的逐字转接(不加判据,加判据请去 `plugin-scan.ts`)
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

import { isValidManifest } from './manifest-scan.js';
import { scanPlugins } from './plugin-scan.js';
import type { ScanResult } from './scan-result.js';
import type { LoadPluginsOptions, PluginDefinition, PluginLoadResult, PluginManifest } from './types.js';

export type { ScanResult } from './scan-result.js';

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
