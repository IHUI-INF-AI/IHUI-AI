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
 * 主循环接线现状(goal-b49/Z1,2026-11-05 起这段不再是"留作后续任务"):
 *   - 启动:loadPluginsWithContributionAudit + registerAll + runSetups + 扩展声明对账(全在 setupAgentTools)
 *   - 每轮:turnStart 走 buildPluginTurnInputSection(插件正文只进本轮下发视图)、
 *     工具前后走 runPluginHooks(preToolCall/postToolCall)、turnEnd 走 dispatchPluginCommandContributors
 *   - 退出:runTeardowns(acp/server.ts)
 *   - **未接**:插件声明的 slash 命令没有注册通道(宿主表是静态 switch),声明的工具名没有实现源
 *     —— 这两格由对账逐条出声,不由本层假装接上(见上面「registry 汇总口现状」)。
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
  PluginInterfaceDeclaration,
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

/**
 * 多版本共存通道(#12)。实现单源 = `./multi-version.ts`,本文件只做 re-export。
 * 显式开启(settings.plugins.multiVersion / versionPins / disabledVersions)才走这条;
 * 同名**同版本**仍判歧义,同名不同版本才共存 —— 严格通道(`loadPlugins*`)的判据一条没动。
 */
export {
  comparePluginVersions,
  loadPluginsWithVersionPolicy,
  parsePluginVersion,
  selectActivePluginVersions,
} from './multi-version.js';
export type {
  MultiVersionLoadResult,
  PluginVersionCandidate,
  PluginVersionPolicy,
  PluginVersionSelection,
  ShadowedPluginVersion,
  ShadowedVersionReason,
} from './multi-version.js';
export { classifyContributions, contributionDiagnosticsOf } from './contribution-audit.js';
/**
 * 接口型工具(2026-11-13):清单 `interfaces[]` → 可调用 `Tool` 的编译面。
 * 生产调用点 = `plugin-scan.ts`(经 `loader.ts` 的出口);此处按包口惯例一并公开,
 * 供调用方按判别码读拒收原因,而不必自己解析清单。
 */
export {
  PLUGIN_INTERFACE_PREFIX,
  INTERFACE_REJECT_CODES,
  compileDeclaredInterface,
  compileDeclaredInterfaces,
  compilePluginInterfaces,
} from './interface-tools.js';
export type {
  DeclaredInterface,
  DeclaredParam,
  InterfaceCompileOutcome,
  InterfaceRejectCode,
  CompiledInterfaceTool,
} from './interface-tools.js';
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
 * registry 汇总口现状(goal-b49/X2 定性为「待接线」,Z1 于 2026-11-05 接线;复跑口径
 * `.ihui-agent/tmp/rea-goal-b49/count-prod-callers.mjs`:生产调用 = 按名引用点排除
 * 定义 / 注释 / import-export 行 / 测试文件,阳性对照 `readSkillCatalog` 必须数出 ≥1)。
 *
 *   五枚 `get*Extensions` 与 `runTurnInputContributors` / `runCommandContributors` 的消费方
 *   都在 `./declaration-consumers.ts`(实现单源,本文件只 re-export),调用点逐枚点名:
 *     - 对账腿 `auditDeclarationConsumers` ← `commands/agent.ts` 的 `setupAgentTools`
 *       (五枚汇总口都是它的输入;工具名问 `listTools()`、hook 事件段问 `PLUGIN_HOOK_EVENTS`、
 *       命令族读 `ACTIVATION_POLICY.onCommand`,本层不立第二份裁决);
 *     - 派发腿 `buildPluginTurnInputSection` ← `runToolLoop` 的 turnStart,
 *       `dispatchPluginCommandContributors` ← `runToolLoop` 的 turnEnd。
 *   AGENTS §0.9 的那句话仍然算数,只是主语换了:**插件声明的工具与 slash 命令在本宿主依然不生效**
 *   —— 工具名背后没有实现(装载器从不 import 插件代码),命令族没有注册通道。Z1 接的是
 *   "读到并逐条出声"这一格,不是把空壳接成派发;缺的那格(宿主侧命令注册口)在交主席清单里。
 *   `contribution-audit.ts` 的 tools/commands 裁决理由与本段同批改写(§0.6,两处不许各说各话)。
 */
export {
  PluginRegistry,
  type RegisterOptions,
  type UnregisterOptions,
} from './registry.js';

/**
 * 运行期消费者层(goal-b49/Z1):扩展声明对账 + contributor 两族的派发腿 +
 * 宿主真派发的插件 hook 事件单源(`PLUGIN_HOOK_EVENTS` —— 派发入口的事件型与对账读同一份)。
 * 进提示的包装另放一枚 `./turn-input-framing.ts`,因为只有那一层碰 prompt 注入登记面。
 */
export {
  PLUGIN_HOOK_EVENTS,
  auditDeclarationConsumers,
  buildPluginTurnInputSection,
  declarationDiagnosticsOf,
  dispatchPluginCommandContributors,
  type DeclarationFamily,
  type DeclarationFinding,
  type DeclarationReasonCode,
  type HostNameSurface,
  type PluginHookEvent,
} from './declaration-consumers.js';
export { PLUGIN_TURN_INPUT_SECTION_ID, framePluginTurnInput } from './turn-input-framing.js';

// P1-4 Plugin Marketplace 集成 — re-export paths/cache/marketplace/installer
export * from './paths.js';
export * from './cache.js';
export * from './marketplace.js';
export * from './installer.js';
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
