// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 激活事件装载裁决层 —— 激活词表的**运行期消费方**(goal-b49/W6 立)。
 *
 * 词表单源 = `@ihui/types` 的 `EXTENSION_ACTIVATION_EVENTS`(本文件不得另抄一份名单,§0.6);
 * 校验器单源 = 同包的 `validateExtensionManifest`;本层是第三处(消费方)。三处键集必须一致,
 * 少一项即红 —— 判据住在 `apps/cli/tests/plugin-activation-events.test.ts`,且只 import 真源。
 *
 * 三态(票面口径「装载 / 延迟 / 拒绝」):
 *   - `load`   :本宿主在**此刻**就有激活点(装载即启动),声明立刻算数;
 *   - `defer`  :本宿主**持有该事件源**,但它在装载之后才触发 ⇒ 记录在册、待激活;
 *   - `reject` :本宿主没有该事件源(或不在词表内 / 形态不对 / 默认拒拿不到数据类)。
 * 每一档的 `source` 写的是**真实调用点**(文件 + 调用名),不是"应该会有":拿不出调用点的档位只能
 * 落 `reject`,否则就是"把没判写成判过"(§0.3)。
 *
 * ## 取证结论:对侧 15 ≠ 15 种档位(这是本票的发现,不是缺功能)
 * 对侧装机件现读(`G:/Qoder CN/resources/extensions/catalog.v1.json`,只取键名、未取源码正文;
 * 计数与取证册 `Q1-qoder-cn-main-bundle.md` §3 #8 的「15 种 activationEvent」对上):15 个**事件
 * 字符串**去重后只有 **3 个事件族** —— `onStartup` ×1、`onView:<viewId>` ×12、`onChatMention:<id>` ×1,
 * 即对侧是"参数化事件名 + 实例枚举",15 是实例计数而非语义档位。我方 6 档全是**无参档**,其中
 * `onViewMount` 已是 `onView:<id>` 的无参对应形态。`onChatMention:<id>` 一族我方没有对位档,且
 * **刻意不在本票补**:该族的宿主落点 = chat mention 注册表,而 `contributes.chatMentionProviders`
 * 在本 CLI 是 `no-host`(见 `contribution-audit.ts` 裁决表,同一事实)—— 词表加一档而宿主无人消费,
 * 正是门 121「声明必须有消费者」的反面。补档要与视图/mention 宿主同批动,且要改 `packages/types`
 * 词表(本席射程外,缺口交主席)。
 *
 * 与默认拒的关系(超越轴):对侧的 activationEvents 与 permissions 之间没有任何可机读的绑定,
 * 事件声明只说"什么时候醒";我方把**事件裁决也接到同一把数据类尺**上 —— 醒过来却拿不到任何
 * 数据面的声明同样 declined,并点名是哪条权限没归属。判定仍只有 `permissionGrantOf` 一处。
 */

import { EXTENSION_ACTIVATION_EVENTS, type CapabilityDataClass, type ExtensionActivationEvent } from '@ihui/types';
import type { PluginDiagnostic, PluginDiagnosticCode, PluginManifest } from './types.js';
import { diagnostic } from './manifest-scan.js';
import { permissionGrantOf, readPermissionList } from './permission-names.js';

/** 三态裁决:装载(此刻有激活点)/ 延迟(有事件源、稍后触发)/ 拒绝(无事件源 / 默认拒 / 不认识)。 */
export type ActivationDisposition = 'load' | 'defer' | 'reject';

/**
 * 拒绝/生效的**具体**原因码。`reject` 有两种截然不同的失效方向(宿主没有这一格 vs 清单拼错),
 * 必须分开编码,免得一种伪装成另一种 —— 与贡献审计的 `declined` / `unknown-kind` 同训。
 */
export type ActivationReasonCode = 'host-activation-point' | 'host-event-source' | 'no-host-source' | 'default-deny' | 'unknown-event' | 'invalid-shape';

/** 一条事件裁决(ASCII 文案:要进日志,不得被控制台码页吃掉)。 */
export interface ActivationFinding {
  pluginName: string;
  file: string;
  /** 清单里原样声明的事件串(未识别时照抄,便于用户对着自己的文件改) */
  event: string;
  disposition: ActivationDisposition;
  reasonCode: ActivationReasonCode;
  /** 本宿主的激活点/事件源(`reject` 为 `none`)—— 写的是真实调用点,不是设想 */
  source: string;
  reasons: string[];
  dataClasses: readonly CapabilityDataClass[];
  unregisteredPermissions: readonly string[];
}

/** 一次装载/一次判定的激活事件汇总。 */
export interface PluginActivationAudit {
  findings: ActivationFinding[];
  loadedCount: number;
  deferredCount: number;
  rejectedCount: number;
}

/** classifyActivations 的入参(从清单原始对象取,不依赖 PluginManifest 形态)。 */
export interface ActivationInput {
  pluginName: string;
  file: string;
  activationEvents?: unknown;
  permissions?: unknown;
}

/**
 * 词表逐档的宿主裁决。键型写成 `Record<ExtensionActivationEvent, …>` 而不是 `Record<string, …>`:
 * 词表加一档而这里没跟上 ⇒ 编译期即红(门 121 的"编译期那一半";运行期那一半由用例钉住)。
 * `source` 只认真实测到的调用点(2026-11-05 现读:`commands/agent.ts` 的 `runSetups()` 与
 * `runPluginHooks(...,'preToolCall'|'postToolCall')`;`getCommandExtensions()` 的消费方是
 * `declaration-consumers.ts` 的对账腿,**它出声但不派发**,所以 `onCommand` 仍是 `reject`/`none`)。
 * 表本身导出,供穷尽性判据读**消费方那一侧的键集**(判据不许另抄一份档名,§22c)。
 */
export const ACTIVATION_POLICY: Record<
  ExtensionActivationEvent,
  { disposition: ActivationDisposition; source: string; reason: string }
> = {
  onStartup: {
    disposition: 'load',
    source: 'PluginRegistry.runSetups() invoked right after registerAll in commands/agent.ts',
    reason: 'this loader run IS the host startup, so the event has already fired',
  },
  onToolCall: {
    disposition: 'defer',
    source: "runPluginHooks(plugins, 'preToolCall' | 'postToolCall') in commands/agent.ts",
    reason: 'host owns the event source but it fires later in the turn loop: recorded as pending activation',
  },
  onSkillInvoke: {
    disposition: 'defer',
    source: 'Skill tool in the tool table (commands/agent.ts), reached through the same preToolCall point',
    reason: 'skill invocation is a tool call in this host: real source, later moment',
  },
  onCommand: {
    disposition: 'reject',
    source: 'none',
    reason: 'this host has no plugin slash-command registration channel (the slash table is a static switch), so the event can never fire; each declared command name is named one by one by the runtime consumer audit in declaration-consumers.ts',
  },
  onViewMount: {
    disposition: 'reject',
    source: 'none',
    reason: 'no view host in the CLI — the same fact that makes contribution kind "views" no-host',
  },
  onSchedule: {
    disposition: 'reject',
    source: 'none',
    reason: 'nothing wakes a plugin by clock in this host: the only runHook call sites are preToolCall/postToolCall',
  },
};

/** 词表档名 → 裁决表(不做第二份名单,也不静默回落)。 */
function policyOf(event: string): { disposition: ActivationDisposition; source: string; reason: string } | null {
  return (ACTIVATION_POLICY as Record<string, { disposition: ActivationDisposition; source: string; reason: string } | undefined>)[
    event
  ] ?? null;
}

/**
 * 逐档裁决一份清单的 `activationEvents`。纯函数:不读盘、不改状态、永不抛穿。
 * 未声明该字段 ⇒ 零条裁决(没写就是没写,不造记录);形态坏/不认识/无宿主源/默认拒 ⇒ 逐条点名。
 */
export function classifyActivations(input: ActivationInput): PluginActivationAudit {
  if (input.activationEvents === undefined) return summarizeActivations([]);

  const permissions = readPermissionList(input.permissions);
  const grant = permissionGrantOf(permissions);
  const findings: ActivationFinding[] = [];

  const push = (event: string, disposition: ActivationDisposition, reasonCode: ActivationReasonCode, source: string, reasons: string[]): void => {
    findings.push({
      pluginName: input.pluginName,
      file: input.file,
      event,
      disposition,
      reasonCode,
      source,
      reasons,
      dataClasses: grant.allowed,
      unregisteredPermissions: grant.unregistered,
    });
  };

  if (!Array.isArray(input.activationEvents)) {
    push(String(input.activationEvents), 'reject', 'invalid-shape', 'none', [
      '"activationEvents" must be an array of event names; got ' + typeof input.activationEvents,
    ]);
    return summarizeActivations(findings);
  }

  for (const raw of input.activationEvents) {
    if (typeof raw !== 'string' || raw.trim() === '') {
      push(String(raw), 'reject', 'invalid-shape', 'none', ['an activation event entry must be a non-empty string']);
      continue;
    }
    const event = raw.trim();
    const policy = policyOf(event);
    if (!policy) {
      push(event, 'reject', 'unknown-event', 'none', [
        `"${event}" is not a known activation event`,
        `known events: ${EXTENSION_ACTIVATION_EVENTS.join('/')}`,
      ]);
      continue;
    }
    if (policy.disposition === 'reject') {
      push(event, 'reject', 'no-host-source', policy.source, [policy.reason]);
      continue;
    }
    if (grant.allowed.length === 0) {
      push(event, 'reject', 'default-deny', policy.source, [
        permissions.length === 0
          ? 'no permission declared: default deny, nothing to activate'
          : 'declared permissions map to no dataClass in capability-catalog: default deny',
        ...(grant.unregistered.length > 0 ? [`unregistered scopes: ${grant.unregistered.join('/')}`] : []),
      ]);
      continue;
    }
    push(event, policy.disposition, policy.disposition === 'load' ? 'host-activation-point' : 'host-event-source', policy.source, [
      policy.reason,
    ]);
  }
  return summarizeActivations(findings);
}

/** 汇总:计数只按 disposition 算一次,单条判定与聚合共用同一实现(不做两遍判据)。 */
export function summarizeActivations(findings: ActivationFinding[]): PluginActivationAudit {
  return {
    findings,
    loadedCount: findings.filter((f) => f.disposition === 'load').length,
    deferredCount: findings.filter((f) => f.disposition === 'defer').length,
    rejectedCount: findings.filter((f) => f.disposition === 'reject').length,
  };
}

/**
 * 把清单原始对象摊成 classifyActivations 入参。
 * `PluginManifest`(types.ts 的既有 schema)没有 activationEvents 字段,这里读的是**裁剪前**的字节
 * —— 加宽只集中在这一行,不扩散到判定逻辑(与 `contributionInputOf` 同型)。
 */
export function activationInputOf(manifest: PluginManifest, pluginName: string, file: string): ActivationInput {
  const raw = manifest as unknown as Record<string, unknown>;
  return { pluginName, file, activationEvents: raw.activationEvents, permissions: raw.permissions };
}

/**
 * findings → 装载诊断。只有"被拒"才需要到人前:`load` / `defer` 都不是问题,写进日志等于每轮造噪声。
 * 判别码的选择只住在这个函数里(不在产出点散落字面量),两条码在 `DIAGNOSTIC_SEVERITY` 里都是
 * `warning` —— 拒事件不代表装载失败,**刻意不升档**(§12e:与本票内容无关的红只会逼人跳门)。
 */
export function activationDiagnosticsOf(findings: readonly ActivationFinding[]): PluginDiagnostic[] {
  const out: PluginDiagnostic[] = [];
  for (const finding of findings) {
    if (finding.disposition !== 'reject') continue;
    const code: PluginDiagnosticCode =
      finding.reasonCode === 'unknown-event' || finding.reasonCode === 'invalid-shape'
        ? 'plugin-activation-unknown-event'
        : 'plugin-activation-rejected';
    const label =
      finding.reasonCode === 'unknown-event'
        ? 'rejected (unknown activation event)'
        : finding.reasonCode === 'invalid-shape'
          ? 'rejected (invalid activationEvents shape)'
          : 'declined by this host';
    out.push(
      diagnostic(
        code,
        finding.file,
        `Activation event "${finding.event}" ${label}: ${finding.reasons.join('; ')} (activation source: ${finding.source})`,
        { pluginName: finding.pluginName },
      ),
    );
  }
  return out;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
