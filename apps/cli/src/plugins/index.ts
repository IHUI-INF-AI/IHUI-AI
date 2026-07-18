/**
 * Plugins 系统主入口 — re-export 类型、加载器、注册表。
 *
 * 用法:
 *   import { loadPlugins, PluginRegistry } from './plugins/index.js';
 *   const defs = loadPlugins({ pluginsDir: './plugins' });
 *   const registry = new PluginRegistry();
 *   registry.registerAll(defs);
 *   await registry.runSetups();
 *   const tools = registry.getToolExtensions();
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
} from './types.js';

export { loadPlugins, validateManifest } from './loader.js';

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
