/**
 * Plugins 注册表 — 管理已加载插件的注册/卸载/扩展点查询。
 *
 * 灵感来源:参考行业 Agent 框架的 plugin registry + IHUI-AI tools/registry 模式。
 * 简化策略(做减法):
 *   - 内部 Map<name, PluginDefinition>,按 name 去重
 *   - register 返回 boolean(false = 同名冲突未注册);提供 force 选项覆盖
 *   - unregister 返回 boolean(false = 不存在);可选调用 teardown
 *   - getToolExtensions/getHookExtensions/getCommandExtensions 汇总所有插件的扩展名
 *   - list 返回所有已注册插件的浅拷贝(防止外部修改)
 *   - 不维护工具/Hook 的实现,只维护扩展名声明(实现由集成方按名解析)
 */

import type { PluginContext, PluginDefinition, PluginHookContext, TurnContributorContext } from './types.js';

export interface RegisterOptions {
  /** 同名冲突时是否覆盖(默认 false) */
  force?: boolean;
}

export interface UnregisterOptions {
  /** 是否调用 plugin 的 teardown(默认 false,集成方按需触发) */
  callTeardown?: boolean;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, PluginDefinition>();
  private readonly ctx: PluginContext;

  constructor(ctx?: Partial<PluginContext>) {
    this.ctx = {
      workingDir: ctx?.workingDir ?? process.cwd(),
      config: ctx?.config ?? {},
      logger: ctx?.logger ?? console,
    };
  }

  /** 注册插件,同名冲突时按 opts.force 决定是否覆盖;返回是否成功 */
  register(plugin: PluginDefinition, opts: RegisterOptions = {}): boolean {
    const existing = this.plugins.get(plugin.name);
    if (existing && !opts.force) return false;
    this.plugins.set(plugin.name, { ...plugin });
    return true;
  }

  /** 批量注册,返回成功注册的数量(同名冲突按 force 处理) */
  registerAll(plugins: PluginDefinition[], opts: RegisterOptions = {}): number {
    let count = 0;
    for (const p of plugins) {
      if (this.register(p, opts)) count++;
    }
    return count;
  }

  /** 卸载插件,不存在返回 false;opts.callTeardown=true 时调用 teardown */
  async unregister(name: string, opts: UnregisterOptions = {}): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    if (opts.callTeardown && typeof plugin.teardown === 'function') {
      try {
        await plugin.teardown(this.ctx);
      } catch {
        // teardown 失败不阻塞卸载
      }
    }
    this.plugins.delete(name);
    return true;
  }

  /** 同步卸载(不调用 teardown) */
  unregisterSync(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    this.plugins.delete(name);
    return true;
  }

  /** 按 name 获取插件 */
  get(name: string): PluginDefinition | undefined {
    return this.plugins.get(name);
  }

  /** 是否已注册 */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /** 汇总所有插件声明的工具扩展名(去重) */
  getToolExtensions(): string[] {
    const set = new Set<string>();
    for (const p of this.plugins.values()) {
      if (p.tools) for (const t of p.tools) set.add(t);
    }
    return Array.from(set);
  }

  /** 汇总所有插件声明的 Hook 扩展标识(去重) */
  getHookExtensions(): string[] {
    const set = new Set<string>();
    for (const p of this.plugins.values()) {
      if (p.hooks) for (const h of p.hooks) set.add(h);
    }
    return Array.from(set);
  }

  /** 汇总所有插件声明的 slash command 扩展名(去重) */
  getCommandExtensions(): string[] {
    const set = new Set<string>();
    for (const p of this.plugins.values()) {
      if (p.commands) for (const c of p.commands) set.add(c);
    }
    return Array.from(set);
  }

  /** P2-4 汇总所有插件声明的 turnInputContributors 扩展名(去重) */
  getTurnInputContributorExtensions(): string[] {
    const set = new Set<string>();
    for (const p of this.plugins.values()) {
      if (p.turnInputContributors) for (const c of p.turnInputContributors) set.add(c);
    }
    return Array.from(set);
  }

  /** P2-4 汇总所有插件声明的 commandContributors 扩展名(去重) */
  getCommandContributorExtensions(): string[] {
    const set = new Set<string>();
    for (const p of this.plugins.values()) {
      if (p.commandContributors) for (const c of p.commandContributors) set.add(c);
    }
    return Array.from(set);
  }

  /** 列出所有已注册插件(浅拷贝,排序按 name) */
  list(): PluginDefinition[] {
    return Array.from(this.plugins.values())
      .map((p) => ({ ...p }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** 已注册插件数 */
  size(): number {
    return this.plugins.size;
  }

  /** 清空所有插件(不调用 teardown,用于测试) */
  clear(): void {
    this.plugins.clear();
  }

  /** 获取注入上下文(供集成方调用 setup 时使用) */
  getContext(): PluginContext {
    return this.ctx;
  }

  /** 调用所有插件的 setup(忽略异常,返回失败插件名清单) */
  async runSetups(): Promise<string[]> {
    const failed: string[] = [];
    for (const p of this.plugins.values()) {
      if (typeof p.setup !== 'function') continue;
      try {
        await p.setup(this.ctx);
      } catch {
        failed.push(p.name);
      }
    }
    return failed;
  }

  /** 调用所有插件的 teardown(忽略异常,返回失败插件名清单) */
  async runTeardowns(): Promise<string[]> {
    const failed: string[] = [];
    for (const p of this.plugins.values()) {
      if (typeof p.teardown !== 'function') continue;
      try {
        await p.teardown(this.ctx);
      } catch {
        failed.push(p.name);
      }
    }
    return failed;
  }

  /**
   * 调用所有声明了匹配 event 的插件的 onHook 回调。
   *
   * 匹配规则(与 getHookExtensions 一致):hook === event 或 hook 以 `${event}:` 开头。
   * 仅调用 plugin.onHook(程序化注册的回调);JSON 加载的插件无 onHook,只声明 hooks 数组,
   * 此时会通过 ctx.logger.info 记录事件(让 registry 真实被使用,非死代码)。
   *
   * @param event 钩子事件名(如 'preToolCall' / 'postToolCall')
   * @param context 钩子上下文(工具名 + 参数 + 结果)
   * @returns 实际调用 onHook 回调的插件数量(不含仅声明无回调的插件)
   */
  async runHook(event: string, context: PluginHookContext): Promise<number> {
    let invoked = 0;
    for (const p of this.plugins.values()) {
      if (!p.hooks) continue;
      const matched = p.hooks.some((h) => h === event || h.startsWith(`${event}:`));
      if (!matched) continue;
      if (typeof p.onHook === 'function') {
        try {
          await p.onHook(event, context);
          invoked++;
        } catch {
          // onHook 失败不阻塞主流程,仅忽略
        }
      } else {
        // 仅声明无回调(JSON 加载的插件):记录事件,让 registry 真实被使用
        try {
          this.ctx.logger.info(`[plugin:${p.name}] ${event} triggered (declaration-only)`);
        } catch {
          // logger 失败不阻塞
        }
      }
    }
    return invoked;
  }

  /**
   * P2-4 调用所有声明了 turnInputContributors 的插件的 onTurnInputContribute 回调。
   * 拼接所有非空返回值作为额外输入上下文返回(供 turnStart 时注入 prompt)。
   * 回调失败不阻塞主流程,仅忽略其返回值。
   *
   * @param ctx Turn 贡献者上下文(workingDir / turnNumber / maxTurns / sessionId)
   * @returns 拼接后的额外输入字符串(无贡献时返回空字符串)
   */
  async runTurnInputContributors(ctx: TurnContributorContext): Promise<string> {
    const parts: string[] = [];
    for (const p of this.plugins.values()) {
      if (!p.turnInputContributors || p.turnInputContributors.length === 0) continue;
      if (typeof p.onTurnInputContribute !== 'function') continue;
      try {
        const result = await p.onTurnInputContribute(ctx);
        if (result && typeof result === 'string' && result.trim().length > 0) {
          parts.push(result);
        }
      } catch {
        // 贡献失败不阻塞主流程
      }
    }
    return parts.join('\n\n');
  }

  /**
   * P2-4 调用所有声明了 commandContributors 的插件的 onCommandContribute 回调。
   * 回调失败不阻塞主流程。返回实际调用回调的插件数。
   *
   * @param ctx Turn 贡献者上下文(workingDir / turnNumber / maxTurns / sessionId)
   * @returns 实际调用 onCommandContribute 回调的插件数量
   */
  async runCommandContributors(ctx: TurnContributorContext): Promise<number> {
    let invoked = 0;
    for (const p of this.plugins.values()) {
      if (!p.commandContributors || p.commandContributors.length === 0) continue;
      if (typeof p.onCommandContribute !== 'function') continue;
      try {
        await p.onCommandContribute(ctx);
        invoked++;
      } catch {
        // 命令贡献失败不阻塞主流程
      }
    }
    return invoked;
  }
}
