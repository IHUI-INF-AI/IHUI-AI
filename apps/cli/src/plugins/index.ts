// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plugins 系统主入口 — re-export 类型、加载器、注册表。
 *
 * 用法:
 *   import { loadPlugins, loadPluginsWithDiagnostics, PluginRegistry } from './plugins/index.js';
 *   const defs = loadPlugins({ pluginsDir: './plugins' });
 *   const registry = new PluginRegistry();
 *   registry.registerAll(defs);
 *   await registry.runSetups();
 *   const tools = registry.getToolExtensions();
 *
 * 诊断(G-683/G-684):
 *   const { plugins, diagnostics } = loadPluginsWithDiagnostics({ pluginsDir });
 *   // 每份被跳过的清单恰好一条 diagnostic(stable code + file + severity);
 *   // 同名多份 ⇒ 两份都不装载,各点名对方路径。loadPlugins 仍是旧的数组契约。
 *
 * 贡献审计(goal-b49/S2 立,W2 装车):
 *   const { plugins, diagnostics, contributions } = loadPluginsWithContributionAudit({ pluginsDir });
 *   // 词表消费方对每份清单声明的 `contributes` 逐档裁决:accepted / declined(本宿主无落点
 *   // 或默认拒拿不到数据类)/ unknown-kind(不在词表内)。declined 与 unknown-kind **各占
 *   // diagnostics 里的一行**(warning 档),因此走的是上面那条诊断主通道到人前;
 *   // `contributions` 是同一批裁决的结构化形态(档名/条数/可达数据类/未登记 scope)。
 *   // 纯判定另有出口 classifyContributions(),不读盘、不装载,可单独复用与单测。
 *
 * 集成到 Agent 主循环(留作后续任务):
 *   - 启动时调用 loadPlugins + registerAll + runSetups
 *   - 主循环用 getToolExtensions/getHookExtensions/getCommandExtensions 合并到现有 tools/hooks/slash-registry
 *   - 退出时调用 runTeardowns
 */

export type {
  PluginLogger,
  PluginContext,
  PluginManifest,
  PluginDefinition,
  PluginHookContext,
  TurnContributorContext,
  LoadPluginsOptions,
  PluginDiagnostic,
  PluginDiagnosticCode,
  PluginDiagnosticSeverity,
  PluginLoadResult,
} from './types.js';

export { PLUGIN_DIAGNOSTIC_CODES } from './types.js';

export { loadPlugins, loadPluginsWithDiagnostics, validateManifest } from './loader.js';

/**
 * 贡献审计层公开面(goal-b49/W2)。实现单源 = `./contribution-audit.ts`,本文件只做 re-export
 * (§0.6 单一真相源:出口面不得有第二份判定;`./loader.js` 那边也只中转同一个实现)。
 * `loadPluginsWithContributionAudit` 从这里出去 —— 生产调用点 `commands/agent.ts` 认的是包口,
 * 此前它只在 loader.ts 里定义、包口 0 命中、生产 0 调用方,即 AGENTS §0.9 的「造好没装车」。
 */
export { loadPluginsWithContributionAudit } from './loader.js';
export { classifyContributions, contributionDiagnosticsOf } from './contribution-audit.js';
export type {
  ContributionFinding,
  ContributionInput,
  ContributionSupport,
  ContributionVerdict,
  PluginContributionAudit,
} from './contribution-audit.js';
export type { ScanResult } from './loader.js';

export {
  PluginRegistry,
  type RegisterOptions,
  type UnregisterOptions,
} from './registry.js';

// P1-4 Plugin Marketplace 集成 — re-export paths/cache/marketplace/installer
export * from './paths.js';
export * from './cache.js';
export * from './marketplace.js';
export * from './installer.js';
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
