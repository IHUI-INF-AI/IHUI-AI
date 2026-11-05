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
 * 汇总口现状见 `./index.ts` 的「registry 汇总口现状」(goal-b49/X2,含零生产调用方的复跑口径)。
 */

import type { PluginContext, PluginDefinition, PluginHookContext, TurnContributorContext } from './types.js';
import { runCommandContributions, runPluginHookEvent, runTurnInputContributions } from './plugin-dispatch.js';

export interface RegisterOptions {
  /** 同名冲突时是否覆盖(默认 false) */
  force?: boolean;
}

export interface UnregisterOptions {
  /** 是否调用 plugin 的 teardown(默认 false,集成方按需触发) */
  callTeardown?: boolean;
}

/**
 * 五枚汇总口对应的清单声明族(与 `PluginManifest` 的字段逐字同名)。
 * 键集只在这里列一次(goal-b49/Z13):`declaration-consumers.ts` 的 `DeclarationFamily` 是它的别名,
 * 两处各抄一遍正是本仓反复记录过的漂移型(§0.6)。
 */
export type ExtensionDeclarationKey = 'tools' | 'hooks' | 'commands' | 'turnInputContributors' | 'commandContributors';

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

  /**
   * 五枚汇总口共用的一把尺:取该扩展族所有声明名并去重。
   *
   * goal-b49/Z13 顺手拆档:原先五段逐字同形的循环(每段 6 行)—— 同一件事写五遍必然漂(§0.6)。
   * `Set` 按插入序去重,故汇总顺序与拆分前**逐字一致**(既有测试钉的就是这个数组)。
   */
  private collectExtensions(key: ExtensionDeclarationKey): string[] {
    const set = new Set<string>();
    for (const p of this.plugins.values()) {
      const declared = p[key];
      if (declared) for (const name of declared) set.add(name);
    }
    return Array.from(set);
  }

  /** 汇总所有插件声明的工具扩展名(去重) */
  getToolExtensions(): string[] {
    return this.collectExtensions('tools');
  }

  /** 汇总所有插件声明的 Hook 扩展标识(去重;形态 `"<event>"` 或 `"<event>:<matcher>"`) */
  getHookExtensions(): string[] {
    return this.collectExtensions('hooks');
  }

  /** 汇总所有插件声明的 slash command 扩展名(去重) */
  getCommandExtensions(): string[] {
    return this.collectExtensions('commands');
  }

  /** P2-4 汇总所有插件声明的 turnInputContributors 扩展名(去重) */
  getTurnInputContributorExtensions(): string[] {
    return this.collectExtensions('turnInputContributors');
  }

  /** P2-4 汇总所有插件声明的 commandContributors 扩展名(去重) */
  getCommandContributorExtensions(): string[] {
    return this.collectExtensions('commandContributors');
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
   * **实现住在 `./plugin-dispatch.ts#runPluginHookEvent`**(goal-b49/Z13:本文件交票时已 299 行、
   * 超 AGENTS §3 的 250 行档,加面先拆档;这里是逐字同签名的转接,不是第二份实现 §0.6)。
   *
   * 匹配规则(单源 = `parseHookDeclaration` + `hookMatcherSatisfied`):
   *   - `"<event>"` / `"<event>:*"` 每次派发都命中;
   *   - `"<event>:<toolName>"` 只在 `context.toolName` 逐字相等时命中 —— **matcher 真参与派发**
   *     (旧实现只判 `startsWith(event + ':')`,matcher 被读到却从不参与判定 = Z1 未竟 3);
   *   - `"<event>:"` 与「上下文没有 toolName」都**不命中**(拼错的清单不得升成全量订阅,§0.10)。
   *
   * @param event 钩子事件名(如 'preToolCall' / 'postToolCall')
   * @param context 钩子上下文(工具名 + 参数 + 结果)
   * @returns 实际调用 onHook 回调的插件数量(不含仅声明无回调的插件)
   */
  async runHook(event: string, context: PluginHookContext): Promise<number> {
    return runPluginHookEvent(this.plugins.values(), event, context, this.ctx.logger);
  }

  /**
   * P2-4 调用所有声明了 turnInputContributors 的插件的 onTurnInputContribute 回调。
   * 拼接所有非空返回值作为额外输入上下文返回(供 turnStart 时注入 prompt)。
   * 回调失败不阻塞主流程,仅忽略其返回值。
   *
   * **实现住在 `./plugin-dispatch.ts#runTurnInputContributions`**(拆档同 `runHook`,§0.6 转接不复制判据)。
   *
   * @param ctx Turn 贡献者上下文(workingDir / turnNumber / maxTurns / sessionId)
   * @returns 拼接后的额外输入字符串(无贡献时返回空字符串)
   */
  async runTurnInputContributors(ctx: TurnContributorContext): Promise<string> {
    return runTurnInputContributions(this.plugins.values(), ctx);
  }

  /**
   * P2-4 调用所有声明了 commandContributors 的插件的 onCommandContribute 回调。
   * 回调失败不阻塞主流程。返回实际调用回调的插件数。
   *
   * **实现住在 `./plugin-dispatch.ts#runCommandContributions`**(拆档同 `runHook`)。
   *
   * @param ctx Turn 贡献者上下文(workingDir / turnNumber / maxTurns / sessionId)
   * @returns 实际调用 onCommandContribute 回调的插件数量
   */
  async runCommandContributors(ctx: TurnContributorContext): Promise<number> {
    return runCommandContributions(this.plugins.values(), ctx);
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
