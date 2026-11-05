// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 插件贡献面的**运行期消费者层**(goal-b49/Z1,2026-11-05)—— X2 定性为「待接线」的那六枚
 * (五枚 `get*Extensions` 汇总口 + 两个 contributor runner)在这里拿到消费方。
 * 两类接法**不许互换**(把只该出声的接成派发 = 空壳派发,红线):
 *
 *   1) 对账消费 `auditDeclarationConsumers` ← `setupAgentTools`:工具名逐个问宿主工具表、
 *      hook 事件段逐个问 `PLUGIN_HOOK_EVENTS`、命令族**读** `ACTIVATION_POLICY.onCommand`
 *      (§0.6 不另立第二份裁决);吃不下的声明逐条一条 warning 到人前 —— "识别到但吃不下"
 *      又不出声,用户只看到"插件装了但没东西"(与 `contribution-audit.ts` 同一取向)。
 *   2) 派发消费 `buildPluginTurnInputSection` ← turnStart / `dispatchPluginCommandContributors`
 *      ← turnEnd:汇总口在这里是前置判据 + 出处标签,runner 是唯一执行体;正文只进本轮下发
 *      视图,并过 reference_data 档包装(第三方内容不得披宿主语气,见 `./turn-input-framing.ts`)。
 *
 * 工具名**不得**接进工具表、命令名**不得**接进 slash 表:装载器只读 JSON、从不 import 插件代码
 * (`types.ts` 头注),声明背后没有实现,接进去就是一张只被测试喂数据的空壳(AGENTS §0.9 反例)。
 */

import type { PluginDiagnostic, PluginManifest, TurnContributorContext } from './types.js';
import { diagnostic } from './manifest-scan.js';
import { ACTIVATION_POLICY } from './activation-events.js';
import type { PluginRegistry } from './registry.js';
import { framePluginTurnInput } from './turn-input-framing.js';

/**
 * 本宿主在运行期真派发的插件 hook 事件 —— **单源**。
 * `commands/agent.ts` 的派发入口(`runPluginHooks`)的事件型由它派生,对账也读它:
 * 两处共用一份名单,才不会一边加了事件、另一边还在判"永不触发"。
 */
export const PLUGIN_HOOK_EVENTS = ['preToolCall', 'postToolCall'] as const;
export type PluginHookEvent = (typeof PLUGIN_HOOK_EVENTS)[number];

/** 五个扩展族(名字与 `PluginManifest` 的字段逐字一致,便于对着清单找)。 */
export type DeclarationFamily = keyof Pick<PluginManifest, 'tools' | 'hooks' | 'commands' | 'turnInputContributors' | 'commandContributors'>;

/** 一条声明为什么算数 / 不算数(两种失效方向分开编码,免得一种伪装成另一种)。 */
export type DeclarationReasonCode =
  | 'host-table-hit'
  | 'no-host-implementation'
  | 'event-never-dispatched'
  | 'no-command-channel'
  | 'command-name-belongs-to-host'
  | 'callback-registered'
  | 'callback-missing';

/** 一条对账结论:某个声明名在这个宿主里到底有没有消费者。 */
export interface DeclarationFinding {
  family: DeclarationFamily;
  /** 清单里原样声明的名字/标识(未识别时照抄,便于用户对着自己的文件改) */
  declaration: string;
  /** 声明了这个名字的插件(去重后的名字可能来自多份清单) */
  pluginNames: string[];
  /** 出处路径(有清单路径就用它,便于点名文件) */
  file: string;
  consumed: boolean;
  reasonCode: DeclarationReasonCode;
  reasons: string[];
}

/** 宿主侧的在册名面,由调用方注入(本层不读盘、不 import 宿主表,保持可单测与分层干净)。 */
export interface HostNameSurface {
  /** `listTools()` 的工具名 */
  toolNames: readonly string[];
  /** 宿主在册 slash 命令名(可带前导斜杠,本层两侧归一后再比) */
  commandNames: readonly string[];
}

/** 取"声明了某个名字的插件",按 name 排序保证诊断顺序稳定(不随 Map 插入序漂)。 */
function ownersOf(registry: PluginRegistry, family: DeclarationFamily, name: string) {
  const key = family as keyof PluginManifest;
  return registry
    .list()
    .filter((plugin) => Array.isArray(plugin[key]) && (plugin[key] as string[]).includes(name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** 出处:第一份带路径的清单;程序化注册没有文件,用固定 ASCII 兜底,不留空。 */
function sourceOf(plugins: readonly { name: string; source?: string }[]): string {
  return plugins.find((p) => typeof p.source === 'string' && p.source.length > 0)?.source ?? 'programmatically-registered-plugin';
}

/**
 * 命令名的两侧归一:宿主在册面走 `getAllSlashNames()`(带前导斜杠),清单声明可能写 `my-cmd`
 * 也可能写 `/my-cmd` —— 比的是同一件事,不做归一就会把"撞了宿主命令"判成"没有通道"。
 */
function bareCommandName(name: string): string {
  return name.startsWith('/') ? name.slice(1) : name;
}

/**
 * 逐名对账:消费五枚汇总口(它们去重后的名字集就是本函数的输入),
 * 每个名字问一次"这个宿主有没有你的消费者",答案要么算数、要么出声。
 */
export function auditDeclarationConsumers(registry: PluginRegistry, host: HostNameSurface): DeclarationFinding[] {
  const findings: DeclarationFinding[] = [];
  const push = (
    family: DeclarationFamily,
    declaration: string,
    names: readonly string[],
    file: string,
    consumed: boolean,
    reasonCode: DeclarationReasonCode,
    reasons: string[],
  ): void => {
    findings.push({ family, declaration, pluginNames: [...names], file, consumed, reasonCode, reasons });
  };

  for (const name of registry.getToolExtensions()) {
    const owners = ownersOf(registry, 'tools', name);
    if (host.toolNames.includes(name)) {
      push(
        'tools',
        name,
        owners.map((p) => p.name),
        sourceOf(owners),
        true,
        'host-table-hit',
        [`"${name}" is in the host tool table, so hook matchers can address it; the plugin provides no implementation of its own`],
      );
      continue;
    }
    push('tools', name, owners.map((p) => p.name), sourceOf(owners), false, 'no-host-implementation', [
      'this loader reads JSON manifests and never imports plugin code, so a declared tool name has no Tool implementation behind it',
      'fix: declare a name that exists in the host tool table, or drop the declaration',
    ]);
  }

  for (const ident of registry.getHookExtensions()) {
    const owners = ownersOf(registry, 'hooks', ident);
    // registry.runHook 的匹配规则(hook === event 或 hook 以 event + ':' 开头)决定了事件段就是冒号前那截。
    const event = ident.split(':')[0] ?? ident;
    const names = owners.map((p) => p.name);
    if ((PLUGIN_HOOK_EVENTS as readonly string[]).includes(event)) {
      push('hooks', ident, names, sourceOf(owners), true, 'host-table-hit', [`event "${event}" is dispatched by commands/agent.ts#runPluginHooks`]);
      continue;
    }
    push('hooks', ident, names, sourceOf(owners), false, 'event-never-dispatched', [
      `event part "${event}" is never dispatched by this host`,
      `dispatched events: ${PLUGIN_HOOK_EVENTS.join('/')}`,
    ]);
  }

  const commandPolicy = ACTIVATION_POLICY.onCommand;
  const hostCommands = new Set(host.commandNames.map(bareCommandName));
  for (const name of registry.getCommandExtensions()) {
    const owners = ownersOf(registry, 'commands', name);
    const names = owners.map((p) => p.name);
    // 命令族的"能不能派发"只问 ACTIVATION_POLICY(§0.6:本层不得有第二份裁决)。
    if (commandPolicy.disposition === 'reject') {
      if (hostCommands.has(bareCommandName(name))) {
        push('commands', name, names, sourceOf(owners), false, 'command-name-belongs-to-host', [
          `"${bareCommandName(name)}" is a host slash command; a plugin declaration cannot register or shadow it`,
          commandPolicy.reason,
        ]);
        continue;
      }
      push('commands', name, names, sourceOf(owners), false, 'no-command-channel', [
        'this host has no plugin slash-command registration channel',
        commandPolicy.reason,
      ]);
      continue;
    }
    push('commands', name, names, sourceOf(owners), true, 'host-table-hit', [commandPolicy.reason]);
  }

  // contributor 两族:声明名 → 有没有任何一个在册插件把回调注册进了宿主代码
  // (JSON 清单永远给不出回调 ⇒ 读到了但不执行,逐条出声,不静默)。
  const contributors: ReadonlyArray<readonly [DeclarationFamily, readonly string[], (pluginName: string) => boolean]> = [
    ['turnInputContributors', registry.getTurnInputContributorExtensions(), (n) => typeof registry.get(n)?.onTurnInputContribute === 'function'],
    ['commandContributors', registry.getCommandContributorExtensions(), (n) => typeof registry.get(n)?.onCommandContribute === 'function'],
  ];
  for (const [family, names, hasCallback] of contributors) {
    for (const name of names) {
      const owners = ownersOf(registry, family, name);
      const hit = owners.some((p) => hasCallback(p.name));
      push(family, name, owners.map((p) => p.name), sourceOf(owners), hit, hit ? 'callback-registered' : 'callback-missing', [
        hit
          ? 'the plugin registered its callback in host code, so the turn loop dispatches it'
          : 'a JSON manifest cannot carry a callback, so nothing runs: the declaration is read but inert',
      ]);
    }
  }

  return findings;
}

/**
 * 结论 → 装载诊断:只有"没消费者"的那一侧出声(`consumed` 的不是问题,写进日志等于每次启动造噪声)。
 * 判别码的选择只住在这一个函数里,与 `contribution-audit.ts` / `activation-events.ts` 同训。
 */
export function declarationDiagnosticsOf(findings: readonly DeclarationFinding[]): PluginDiagnostic[] {
  const out: PluginDiagnostic[] = [];
  for (const finding of findings) {
    if (finding.consumed) continue;
    out.push(
      diagnostic(
        'plugin-declaration-unconsumed',
        finding.file,
        `Extension declaration "${finding.family}:${finding.declaration}" has no runtime consumer in this host: ${finding.reasons.join('; ')} (declared by: ${finding.pluginNames.join('/') || 'unknown'})`,
        { pluginName: finding.pluginNames[0] },
      ),
    );
  }
  return out;
}

/**
 * turnStart 派发腿:汇总口非空才叫 runner(零声明 ⇒ 零回调、零注入、零记账),
 * 正文按在册声明名贴上出处标签后走 reference_data 档。
 * 返回空串表示本轮没有插件贡献(调用方据此**不进**消息数组)。
 */
export async function buildPluginTurnInputSection(
  registry: PluginRegistry | undefined | null,
  ctx: TurnContributorContext,
): Promise<string> {
  if (!registry) return '';
  const declared = registry.getTurnInputContributorExtensions();
  if (declared.length === 0) return '';
  const text = await registry.runTurnInputContributors(ctx);
  if (text.trim() === '') return '';
  return framePluginTurnInput(declared, text);
}

/** turnEnd 派发腿:同样是"声明非空才派发";返回实际被调用的插件数(与 runCommandContributors 同源,不复算)。 */
export async function dispatchPluginCommandContributors(
  registry: PluginRegistry | undefined | null,
  ctx: TurnContributorContext,
): Promise<number> {
  if (!registry) return 0;
  if (registry.getCommandContributorExtensions().length === 0) return 0;
  return registry.runCommandContributors(ctx);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
