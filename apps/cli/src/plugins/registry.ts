// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *
 * 分层(goal-b49/Z13 拆档):三枚 runner 的**实现**(`runHook` / `runTurnInputContributors` /
 * `runCommandContributors`)与 hook `event:matcher` 的唯一判据住在 `./plugin-dispatch.ts`;
 * 本文件只留注册面 + 逐字同签名的转接(§0.6 单一真相源,本层不得有第二份派发实现)。
 *
 * 分层(goal-b49/Z30 再拆一档,270 → 现读 <250):五枚汇总口的**键集与取源**住在
 * `./plugin-extensions.ts`(`collectExtensions` 与 `ExtensionDeclarationKey`),本档的
 * `get*Extensions` 只做逐字转接;「键 ↔ 汇总口」双射与「档内不留第二份汇总实现」由
 * `tests/plugin-extension-summary-lock.test.ts` 形状锁钉住。
 *
 * 汇总口现状见 `./index.ts` 的「registry 汇总口现状」(goal-b49/X2,含零生产调用方的复跑口径)。
 */

import type { PluginContext, PluginDefinition, PluginHookContext, TurnContributorContext } from './types.js';
import { runCommandContributions, runPluginHookEvent, runTurnInputContributions } from './plugin-dispatch.js';
import { collectExtensions } from './plugin-extensions.js';

export interface RegisterOptions {
  /** 同名冲突时是否覆盖(默认 false) */
  force?: boolean;
}

export interface UnregisterOptions {
  /** 是否调用 plugin 的 teardown(默认 false,集成方按需触发) */
  callTeardown?: boolean;
}

// 键集单源已迁至 `./plugin-extensions.ts`(goal-b49/Z30):此处只再导出既有引用面 ——
// `declaration-consumers.ts` 的 `DeclarationFamily` 仍从 './registry.js' 取别名,不得断链(§0.6);
// 「与 PluginManifest 字段逐字同名」的口径与键集本身一并由那件单源承担。
export type { ExtensionDeclarationKey } from './plugin-extensions.js';

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
    // G-682:注册前校验依赖闭包 —— 声明的依赖必须已在册,B 未装而 A 声明依赖 B ⇒ A 注册被拒
    // (fail-closed,与同名歧义 G-684 同型:缺依赖时"碰巧装上"不是任何人声明过的意图)。
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) return false;
      }
    }
    this.plugins.set(plugin.name, { ...plugin });
    return true;
  }

  /**
   * 批量注册,返回成功注册的数量(同名冲突按 force 处理)。
   *
   * G-682:依赖闭包在**安装期**一次定型 —— 每轮只注册"依赖全部已满足"的插件,反复迭代直到
   * 无进展;剩余(依赖缺失或成环)全部拒绝。运行期只做"在不在"查询,谁先谁后在这里定完就不再变。
   */
  registerAll(plugins: PluginDefinition[], opts: RegisterOptions = {}): number {
    let count = 0;
    const pending = [...plugins];
    const enrolled = new Set(this.plugins.keys());
    let progressed = true;
    while (pending.length > 0 && progressed) {
      progressed = false;
      for (let i = 0; i < pending.length; ) {
        const p = pending[i]!;
        const deps = p.dependencies ?? [];
        if (!deps.every((d) => enrolled.has(d))) {
          i++;
          continue;
        }
        if (this.register(p, opts)) count++;
        enrolled.add(p.name);
        pending.splice(i, 1);
        progressed = true;
      }
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

  // ---- 五枚汇总口:取源单点 = ./plugin-extensions.ts#collectExtensions(Z30 逐字转接) ----
  // 本档不得再自带汇总循环(§0.6);键 ↔ 汇总口的双射由 tests/plugin-extension-summary-lock.test.ts 钉。

  /** 汇总所有插件声明的工具扩展名(去重) */
  getToolExtensions(): string[] {
    return collectExtensions(this.plugins.values(), 'tools');
  }

  /** 汇总所有插件声明的 Hook 扩展标识(去重;形态 `"<event>"` 或 `"<event>:<matcher>"`) */
  getHookExtensions(): string[] {
    return collectExtensions(this.plugins.values(), 'hooks');
  }

  /** 汇总所有插件声明的 slash command 扩展名(去重) */
  getCommandExtensions(): string[] {
    return collectExtensions(this.plugins.values(), 'commands');
  }

  /** P2-4 汇总所有插件声明的 turnInputContributors 扩展名(去重) */
  getTurnInputContributorExtensions(): string[] {
    return collectExtensions(this.plugins.values(), 'turnInputContributors');
  }

  /** P2-4 汇总所有插件声明的 commandContributors 扩展名(去重) */
  getCommandContributorExtensions(): string[] {
    return collectExtensions(this.plugins.values(), 'commandContributors');
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
   * 调用所有声明了匹配 event 的插件的 onHook 回调,返回**实际被调到 onHook 的插件数**
   * (不含仅声明无回调的插件);返回值语义与 Z13 拆分前逐字一致。
   *
   * 实现与 `event:matcher` 判据的唯一单源 = `./plugin-dispatch.ts#runPluginHookEvent`
   * (`parseHookDeclaration` + `hookMatcherSatisfied`:matcher 真参与派发,空串与缺 toolName 一律不命中)。
   * 这里是转接而不是第二份派发实现(§0.6),规则原文不在本档重抄 —— 同一条判据抄两遍必漂。
   *
   * @param event 钩子事件名(如 'preToolCall' / 'postToolCall')
   * @param context 钩子上下文(工具名 + 参数 + 结果)
   */
  async runHook(event: string, context: PluginHookContext): Promise<number> {
    return runPluginHookEvent(this.plugins.values(), event, context, this.ctx.logger);
  }

  /**
   * P2-4 调用所有声明了 turnInputContributors 的插件的 onTurnInputContribute 回调,
   * 拼接所有非空返回值作为额外输入上下文(供 turnStart 注入 prompt;回调失败不阻塞、无贡献返空串)。
   * 实现住在 `./plugin-dispatch.ts#runTurnInputContributions`(拆档同 runHook,§0.6 转接不复制判据)。
   */
  async runTurnInputContributors(ctx: TurnContributorContext): Promise<string> {
    return runTurnInputContributions(this.plugins.values(), ctx);
  }

  /**
   * P2-4 调用所有声明了 commandContributors 的插件的 onCommandContribute 回调,
   * 返回实际被调用的插件数(回调失败不阻塞主流程)。
   * 实现住在 `./plugin-dispatch.ts#runCommandContributions`(拆档同 runHook)。
   */
  async runCommandContributors(ctx: TurnContributorContext): Promise<number> {
    return runCommandContributions(this.plugins.values(), ctx);
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
