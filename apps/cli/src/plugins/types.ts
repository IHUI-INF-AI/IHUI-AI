/**
 * Plugins 系统 — 类型定义。
 *
 * 灵感来源:参考行业 Agent 框架的 plugin.json 清单机制(第三方插件注册工具/Hook/Slash command)。
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
  // P2-4 agent-lifecycle 扩展点(声明式,实际调度由集成方实现)
  /** turnInputContributors:在 turnStart 时贡献额外输入上下文的扩展名(如注入额外文档/状态) */
  turnInputContributors?: string[];
  /** commandContributors:在 turnEnd 时贡献命令执行的扩展名(如自动 lint/test/notify) */
  commandContributors?: string[];
}

/** 完整插件定义 — 清单 + 可选生命周期回调 */
export interface PluginDefinition extends PluginManifest {
  /** 来源文件路径(绝对路径,便于调试) */
  source?: string;
  /** 插件装载时调用(可选,可同步可异步) */
  setup?(ctx: PluginContext): void | Promise<void>;
  /** 插件卸载时调用(可选,可同步可异步) */
  teardown?(ctx: PluginContext): void | Promise<void>;
  /**
   * Hook 事件回调(程序化注册,JSON 清单无法声明此字段)。
   * 仅当插件通过代码注册时可注入;JSON 加载的插件只声明 hooks 数组,无实际回调。
   * 回调失败不阻塞主流程(由 PluginRegistry.runHook try/catch 包裹)。
   */
  onHook?(event: string, context: PluginHookContext): void | Promise<void>;
  /**
   * P2-4 turnInputContributor 回调(程序化注册):在 turnStart 时被调用,返回值作为额外输入注入。
   * 返回空字符串/null/undefined 表示不注入。回调失败不阻塞主流程。
   */
  onTurnInputContribute?(ctx: TurnContributorContext): string | null | undefined | Promise<string | null | undefined>;
  /**
   * P2-4 commandContributor 回调(程序化注册):在 turnEnd 时被调用,可执行外部命令(lint/test/notify 等)。
   * 回调失败不阻塞主流程。
   */
  onCommandContribute?(ctx: TurnContributorContext): void | Promise<void>;
}

/**
 * P2-4 Turn 贡献者上下文 — 传给 onTurnInputContribute / onCommandContribute 回调。
 * 复用 PluginHookContext 的扩展字段语义([key: string]: unknown)。
 */
export interface TurnContributorContext {
  /** 工作目录 */
  workingDir: string;
  /** 当前 turn 序号(1-based) */
  turnNumber: number;
  /** 最大 turn 数 */
  maxTurns: number;
  /** 会话 ID(可选) */
  sessionId?: string;
  /** 任意扩展字段 */
  [key: string]: unknown;
}

/** Plugin hook 上下文(传给 onHook 回调) */
export interface PluginHookContext {
  /** 触发 hook 的工具名(preToolCall/postToolCall 场景) */
  toolName?: string;
  /** 工具参数 */
  args?: Record<string, unknown>;
  /** 工具结果(postToolCall 场景) */
  result?: unknown;
  /** 任意扩展字段(由集成方按需注入) */
  [key: string]: unknown;
}

/** 加载器选项 */
export interface LoadPluginsOptions {
  /** 待扫描的插件目录(绝对路径) */
  pluginsDir: string;
  /** 是否递归扫描子目录(默认 false,只扫顶层) */
  recursive?: boolean;
}
