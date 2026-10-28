// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  /**
   * 依赖的其他插件名(G-682):注册前校验依赖闭包 —— 声明的依赖必须在册(或在同一批注册集合内),
   * 否则该插件注册被拒。依赖闭包在安装期一次定型,运行期只做"在不在"查询,不决定谁先谁后。
   */
  dependencies?: string[];
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

/**
 * 插件诊断的判别码 — **封闭联合**(`as const` 数组派生),禁止在产出点散落字符串字面量。
 *
 * 立因(G-683):`loader.ts` 的 `parseManifestFile` 原先 `catch { return null }` ——
 * 有隔离但零诊断,用户只看到"插件没生效",账面没有任何线索说明**为什么**。
 * 把失败编码成数据(稳定 code)而不是异常,才能被日志/CI/上层按码分档处理。
 *
 * `plugin-dependency-cycle` 是 G-684 点名要求的「环依赖专属判别码」:
 * 它与 `plugin_ambiguous_name` **语义不同、文案不得复用** ——
 * 前者是"依赖图成环"(需要拆开环),后者是"两份清单抢同一个名字"(需要改名或删一份)。
 * `dependencies` 字段已由 G-682 引入(见 PluginManifest);注册侧的拒绝行为落在
 * registry(register/registerAll 的依赖闭包校验),该码本身现阶段仍无产出方。
 */
export const PLUGIN_DIAGNOSTIC_CODES = [
  /** 清单文件读不出来(EISDIR / EACCES / 竞态消失等) */
  'manifest-unreadable',
  /** JSON 语法错误 */
  'manifest-json-invalid',
  /** JSON 能解析,但不是普通对象(数组 / 字符串 / 数字 / null) */
  'manifest-not-object',
  /** 缺 `name`(或 name 为空串) */
  'manifest-name-missing',
  /** 缺 `version`(或 version 为空串) */
  'manifest-version-missing',
  /** 同目录内被高优先级清单压掉的那一份(plugin.config.json vs plugin.json) */
  'manifest-shadowed-by-priority',
  /** 同名歧义:多份清单(不同 rootPath)声明同一个 name ⇒ 全部不装载(G-684/G-658) */
  'plugin_ambiguous_name',
  /** 兜底:未预期的抛点,一律编码成诊断而不让单点失败抛穿整次装载 */
  'manifest-unexpected-error',
  /** 依赖环(G-682 的 dependencies 落地后由装载器产出;刻意不复用歧义码) */
  'plugin-dependency-cycle',
] as const;

export type PluginDiagnosticCode = (typeof PLUGIN_DIAGNOSTIC_CODES)[number];

/** 诊断严重级:`error` = 有清单没被装载;`warning` = 装载了但有内容被忽略 */
export type PluginDiagnosticSeverity = 'error' | 'warning';

/**
 * 一条装载诊断 — "这份清单为什么没生效"的可机读记录。
 * 消费方按 `code` 分档(逐条点名 / 汇总计数),不得靠 `message` 文本判流程。
 */
export interface PluginDiagnostic {
  /** 稳定判别码(封闭集,见 PLUGIN_DIAGNOSTIC_CODES) */
  code: PluginDiagnosticCode;
  /** 严重级(由 code 唯一决定,产出点不各写一遍) */
  severity: PluginDiagnosticSeverity;
  /** 触发该诊断的清单/目录绝对路径 */
  file: string;
  /** 能解析出 name 时带上(G-684 的歧义场景必须点名是哪个名字撞了) */
  pluginName?: string;
  /** 相关路径(同名歧义时点名其余各份的清单路径) */
  relatedFiles?: string[];
  /** 人类可读说明(ASCII:诊断要能进日志,不得被控制台码页吃掉) */
  message: string;
}

/** 装载结果:插件集合 + 每一条被跳过清单的诊断(G-683 的返回形态) */
export interface PluginLoadResult {
  /** 成功装载的插件(tools / hooks / commands 等扩展声明都在此) */
  plugins: PluginDefinition[];
  /** 装载过程的诊断:每个被跳过的清单恰好留一条;装载本身永不抛异常 */
  diagnostics: PluginDiagnostic[];
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
