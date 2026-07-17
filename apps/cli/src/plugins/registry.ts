/**
 * Plugins 注册表 — 管理已加载插件的注册/卸载/扩展点查询。
 *
 * 灵感来源:cli 的 plugin registry + IHUI-AI tools/registry 模式。
 * 简化策略(做减法):
 *   - 内部 Map<name, PluginDefinition>,按 name 去重
 *   - register 返回 boolean(false = 同名冲突未注册);提供 force 选项覆盖
 *   - unregister 返回 boolean(false = 不存在);可选调用 teardown
 *   - getToolExtensions/getHookExtensions/getCommandExtensions 汇总所有插件的扩展名
 *   - list 返回所有已注册插件的浅拷贝(防止外部修改)
 *   - 不维护工具/Hook 的实现,只维护扩展名声明(实现由集成方按名解析)
 */

import type { PluginContext, PluginDefinition } from './types.js';

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
}
