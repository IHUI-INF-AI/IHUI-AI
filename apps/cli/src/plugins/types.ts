/**
 * Plugins 系统 — 类型定义。
 *
 * 灵感来源:grok-build 的 plugin.json 清单机制(第三方插件注册工具/Hook/Slash command)。
 * 简化策略(做减法):
 *   - 只支持 JSON 清单(plugin.json / plugin.config.json),不实现 .js/.ts 动态 import
 *   - PluginDefinition 描述插件元信息 + 扩展点(tools/hooks/commands 字符串数组声明)
 *   - 可选 setup/teardown 生命周期钩子(由集成方在主循环中调用)
 *   - PluginContext 注入 logger/config/workingDir,供 plugin 运行时使用
 *
 * plugin.json schema(简化版):
 * {
 *   "name": "my-plugin",
 *   "version": "1.0.0",
 *   "description": "示例插件",
 *   "author": "alice",
 *   "tools": ["custom-tool"],
 *   "hooks": ["preToolCall:custom-tool"],
 *   "commands": ["my-slash"]
 * }
 */

/** 简化 logger 接口(对齐 console 的子集,避免依赖具体日志库) */
export interface PluginLogger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

/** 注入给 plugin 的上下文(由集成方在主循环装配) */
export interface PluginContext {
  /** 工作目录(绝对路径) */
  workingDir: string;
  /** 配置对象(透传 settings 的相关子集,任意结构) */
  config: Record<string, unknown>;
  /** 日志器(默认 console) */
  logger: PluginLogger;
}

/** 插件清单 — 从 plugin.json 解析出的扩展声明 */
export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  /** 扩展的工具名(由集成方按名解析为 Tool 实现) */
  tools?: string[];
  /** 扩展的 Hook 标识(格式 "<event>:<matcher>" 或纯事件名) */
  hooks?: string[];
  /** 扩展的 slash command 名 */
  commands?: string[];
}

/** 完整插件定义 — 清单 + 可选生命周期回调 */
export interface PluginDefinition extends PluginManifest {
  /** 来源文件路径(绝对路径,便于调试) */
  source?: string;
  /** 插件装载时调用(可选,可同步可异步) */
  setup?(ctx: PluginContext): void | Promise<void>;
  /** 插件卸载时调用(可选,可同步可异步) */
  teardown?(ctx: PluginContext): void | Promise<void>;
}

/** 加载器选项 */
export interface LoadPluginsOptions {
  /** 待扫描的插件目录(绝对路径) */
  pluginsDir: string;
  /** 是否递归扫描子目录(默认 false,只扫顶层) */
  recursive?: boolean;
}
