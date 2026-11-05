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

/**
 * 激活事件裁决公开面(goal-b49/W6)。实现单源 = `./activation-events.ts`,本文件只做 re-export。
 * `ACTIVATION_POLICY` 是消费方那一侧的键集出口 —— 穷尽性判据读它,不得在测试里另抄档名(§22c)。
 */
export {
  ACTIVATION_POLICY,
  activationDiagnosticsOf,
  activationInputOf,
  classifyActivations,
  summarizeActivations,
} from './activation-events.js';
export type {
  ActivationDisposition,
  ActivationFinding,
  ActivationInput,
  ActivationReasonCode,
  PluginActivationAudit,
} from './activation-events.js';

/**
 * 声明式权限名归属层(goal-b49/W6)。归属表 + 唯一取数出口 `permissionGrantOf`;
 * 「能不能拿到数据类」仍只由 capability-catalog 那把尺判定,本层不产出裁决(§0.6)。
 * goal-b49/X2 补:安装通道适配器(`createAliasAwareManifestValidator`)与清单级归一化
 * (`normalizeExtensionManifestPermissions`)同住这一层 —— 同一张归属表在"装载"与"安装"
 * 两条通道都生效,不许出现第二份别名规则。接线点(调用侧一行)见函数头注。
 */
export {
  DECLARED_PERMISSION_NAMES,
  DECLARED_PERMISSION_NAME_LIST,
  UNMAPPED_PERMISSION_NAMES,
  createAliasAwareManifestValidator,
  normalizeExtensionManifestPermissions,
  permissionGrantOf,
  readPermissionList,
  resolveDeclaredPermissionName,
  resolveDeclaredPermissionNames,
} from './permission-names.js';
export type { DeclaredPermissionTarget, ExtensionManifestValidatorContract } from './permission-names.js';

/**
 * registry 汇总口现状(goal-b49/X2 现读 2026-11-05;复跑口径
 * `.ihui-agent/tmp/rea-goal-b49/count-prod-callers.mjs`:生产调用 = 按名引用点排除
 * 定义 / 注释 / import-export 行 / 测试文件,阳性对照 `readSkillCatalog` 必须数出 ≥1)。
 *
 *   五枚 `get*Extensions` 与 `runTurnInputContributors` / `runCommandContributors` 当前
 *   **零生产调用方**(只有 `registry.ts` 定义与用例)。定性 = 待接线,不是死码 ——
 *   承载的声明面仍被 `contribution-audit` / `activation-events` 裁决,缺的只是运行期消费者。
 *   接线点:getToolExtensions → 主循环工具表合并(`agent.ts` setupAgentTools 的 `listTools()` 之后);
 *   getHookExtensions → 插件面诊断/展示(`runHook` 自按 hooks 匹配,不依赖本枚举);
 *   getCommandExtensions → slash-registry(`SLASH_COMMANDS` 是静态表,尚无插件命令注册口);
 *   turn/command 两族 → `runTurnInputContributors` 未挂 turnStart(`agent.ts` 的 turnStart 派发点)。
 *
 *   AGENTS §0.9:接线前不得对外声称"插件工具/命令已生效";接通时把本段与
 *   `contribution-audit.ts` 的 tools/commands 裁决**一起**翻档,别让两处口径漂开(§0.6)。
 */
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
