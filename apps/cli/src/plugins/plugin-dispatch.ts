// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plugins 派发层 — `PluginRegistry` 三枚 runner 的**实现**住在这里(goal-b49/Z13)。
 *
 * 两件事,一件文件:
 *   ① 拆档:`registry.ts` 交票时已 299 行(超 AGENTS §3 的 250 行档),而本票要给 hook 派发加面
 *      —— 按票面纪律「加面先拆档,不得把超档继续往上堆」,三个 runner 整体搬来此处,
 *      `registry.ts` 只留逐字同签名的转接(不是第二份实现,§0.6)。
 *   ② 修 matcher:`event:matcher` 形态自 types.ts 起就是清单文档里的正式写法(`preToolCall:custom-tool`),
 *      但旧实现只做 `hook.startsWith(event + ':')` —— **matcher 那半截被读到、从未参与判定**,
 *      于是「只关心 write_file」的插件在每一次 preToolCall 上都被叫醒(又一格「声明了没人消费」,
 *      goal-b49/Z1 未竟 3)。本层让 matcher 真参与派发,并把它定成**单源判据**。
 *
 * matcher 语义(唯一一份,`declaration-consumers.ts` 与 `registry.ts` 都读它,不另抄):
 *   - `"<event>"`               整档订阅:该事件每次都派发(matcher 缺席 = 不限定)。
 *   - `"<event>:*"`             显式通配:同上,但写明是「看过所有工具」的意图。
 *   - `"<event>:<toolName>"`    只在该次派发的 `context.toolName` 逐字相等时派发。
 *   - `"<event>:"`(matcher 空串) **永不派发**:空串不是「不限定」的写法,拿它当通配等于把
 *     拼错的清单升成全量订阅(§0.10:失效方向必须是更保守,绝不能更宽松)。
 *   - 派发上下文**没有** toolName 时,带具体 matcher 的声明同样**不派发**——不能证明这次调用
 *     就是那个工具,宁可少叫醒一次(与 G-684「扫描顺序不是任何人声明过的意图」同一取向)。
 *
 * 行为变更的影响面(交主席时须逐字知道):旧实现下 `preToolCall:write_file` 对 `read_file` 也触发;
 * 新实现不触发。正反对照用例见 `tests/plugin-hook-matcher.test.ts`。
 */

import type { PluginDefinition, PluginHookContext, PluginLogger, TurnContributorContext } from './types.js';

/** 事件段与 matcher 的分隔符(清单里唯一一种写法;`types.ts` 的 schema 示例同形)。 */
const HOOK_DECLARATION_SEPARATOR = ':';

/** 显式通配 matcher:声明「这个事件的每一次派发都要叫醒我」。 */
const HOOK_MATCHER_WILDCARD = '*';

/** 一条 hook 声明拆成的两段。`matcher === null` 表示清单里**没有**分隔符(整档订阅)。 */
export interface HookDeclarationParts {
  event: string;
  matcher: string | null;
}

/**
 * 拆分一条 hook 声明:只在**第一个**冒号处切一刀(工具名本身不含冒号,但清单里出现
 * `a:b:c` 时不得让第二个冒号把事件段吞掉 —— 旧实现按 `startsWith('a:')` 判,整截后缀都是黑箱)。
 */
export function parseHookDeclaration(declaration: string): HookDeclarationParts {
  const at = declaration.indexOf(HOOK_DECLARATION_SEPARATOR);
  if (at < 0) return { event: declaration, matcher: null };
  return { event: declaration.slice(0, at), matcher: declaration.slice(at + 1) };
}

/**
 * matcher 这一维到底满不满足。判据只看 `context.toolName`——本宿主真派发的两个事件
 * (`PLUGIN_HOOK_EVENTS`)带的就是它;别的扩展字段一律不参与判定,免得多一维就多一处漂移。
 */
export function hookMatcherSatisfied(matcher: string | null, context: PluginHookContext): boolean {
  if (matcher === null) return true;
  if (matcher === HOOK_MATCHER_WILDCARD) return true;
  const toolName = typeof context.toolName === 'string' ? context.toolName : '';
  return toolName.length > 0 && toolName === matcher;
}

/** 单条声明是否该为这次派发出声:事件段逐字相等 ∧ matcher 满足。 */
export function hookDeclarationMatches(declaration: string, event: string, context: PluginHookContext): boolean {
  const parts = parseHookDeclaration(declaration);
  return parts.event === event && hookMatcherSatisfied(parts.matcher, context);
}

/** 插件是否有**至少一条**声明命中本次派发(与旧实现同粒度:一个插件一次事件只出一回)。 */
export function pluginHookMatches(plugin: PluginDefinition, event: string, context: PluginHookContext): boolean {
  if (!plugin.hooks) return false;
  return plugin.hooks.some((declaration) => hookDeclarationMatches(declaration, event, context));
}

/** 命中本次派发的声明原文(进日志用,便于人对着清单看是哪一条被吃下)。 */
function matchedDeclarationsOf(plugin: PluginDefinition, event: string, context: PluginHookContext): string[] {
  if (!plugin.hooks) return [];
  return plugin.hooks.filter((declaration) => hookDeclarationMatches(declaration, event, context));
}

/**
 * 派发一次 hook 事件(原 `PluginRegistry.runHook` 的实现,签名与返回值语义逐字保持):
 * 返回**实际调用到 onHook 回调的插件数**,不含「只声明无回调」的那一份 —— 既有测试钉的就是这个数。
 * 回调抛异常不阻塞主流程、也不计入返回数(旧行为,同 `runSetups`/`runTeardowns` 的口径)。
 */
export async function runPluginHookEvent(
  plugins: Iterable<PluginDefinition>,
  event: string,
  context: PluginHookContext,
  logger: PluginLogger,
): Promise<number> {
  let invoked = 0;
  for (const plugin of plugins) {
    if (!plugin.hooks) continue;
    const matched = matchedDeclarationsOf(plugin, event, context);
    if (matched.length === 0) continue;
    if (typeof plugin.onHook === 'function') {
      try {
        await plugin.onHook(event, context);
        invoked++;
      } catch {
        // onHook 失败不阻塞主流程,仅不计入 invoked
      }
    } else {
      // 仅声明无回调(JSON 清单装载的插件):记录事件,让 registry 真实被使用(不是死代码)
      try {
        logger.info(`[plugin:${plugin.name}] ${event} triggered (declaration-only, matched: ${matched.join('/')})`);
      } catch {
        // logger 失败不阻塞
      }
    }
  }
  return invoked;
}

/**
 * P2-4 turnInputContributors 派发腿(原 `runTurnInputContributors` 的实现):
 * 拼接所有非空返回值;单条贡献失败只丢那一条,不抛穿。
 */
export async function runTurnInputContributions(
  plugins: Iterable<PluginDefinition>,
  ctx: TurnContributorContext,
): Promise<string> {
  const parts: string[] = [];
  for (const plugin of plugins) {
    if (!plugin.turnInputContributors || plugin.turnInputContributors.length === 0) continue;
    if (typeof plugin.onTurnInputContribute !== 'function') continue;
    try {
      const result = await plugin.onTurnInputContribute(ctx);
      if (result && typeof result === 'string' && result.trim().length > 0) parts.push(result);
    } catch {
      // 贡献失败不阻塞主流程
    }
  }
  return parts.join('\n\n');
}

/**
 * P2-4 commandContributors 派发腿(原 `runCommandContributors` 的实现):
 * 返回实际调用到回调的插件数;失败不阻塞主流程。
 */
export async function runCommandContributions(
  plugins: Iterable<PluginDefinition>,
  ctx: TurnContributorContext,
): Promise<number> {
  let invoked = 0;
  for (const plugin of plugins) {
    if (!plugin.commandContributors || plugin.commandContributors.length === 0) continue;
    if (typeof plugin.onCommandContribute !== 'function') continue;
    try {
      await plugin.onCommandContribute(ctx);
      invoked++;
    } catch {
      // 命令贡献失败不阻塞主流程
    }
  }
  return invoked;
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
