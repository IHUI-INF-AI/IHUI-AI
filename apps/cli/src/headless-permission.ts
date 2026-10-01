// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-814407 — 无头权限经纪:非交互且没有审批面 ⇒ deny,且拒绝文案只有单一出口。
 *
 * 上游同族机制(`headless-workflow.ts:31-51` 的 `createHeadlessPermissionBroker`)的形态:
 * 只对两个具名工作流工具自动 allow,其余**整条委托同一个 `createDenyPermissionBroker()`**
 * —— 拒绝语义与文案因此只有一份。我方的对应事实(HEAD 现读):
 *  - executor(`tools/index.ts` L920/L966 一带)三条拒绝路径已经走 `utils/tool-denial.ts`
 *    的 `buildToolDenial`/`denialErrorSuffix`(台账 G-816029 前序票收口的"可诊断化唯一出口"),
 *    危险工具在无回调时 `allowed = ctx.confirmDangerous ? ... : false` 也已是 deny 方向;
 *  - 缺的是**委托结构**:没有一个可被任意调用点复用的"审批面缺席 ⇒ deny"判定出口,
 *    于是每个新调用点都可能自己再拼一句中文(本票要钉死的就是这一型)。
 *
 * 本模块只做**判定与委托**,不做副作用:不写审计、不改任何既有闸的语义 ——
 * 审计仍由消费点走 `auditToolDenial`(工具层既有形态),避免同一拒绝落两行台账。
 *
 * 安全方向(任务约束"deny 必须是默认方向;拿不准按更安全且更少静默"):
 *  - 审批面在位 ⇒ 一律 `use-approval-surface`(把判定交回原审批路径,本经纪**不代替人批**);
 *  - 审批面缺席 ⇒ 只认显式 `autoAllowTools` 名单(缺省为空 = 什么都不放),其余 deny;
 *  - "交互但没接审批面"的异常输入同样 deny —— 人在场不等于有人能应答;这正是
 *    上游把整条 headless 面折进同一个 deny broker 的理由。
 *
 * 文案纪律:deny 的 message **必须**逐字等于 `denialErrorSuffix(denial)`,而 denial 由
 * `buildToolDenial` 构造 —— 本文件不书写任何拒绝句子(中文或英文都不行),新增拒绝形态
 * 时只能扩 `utils/tool-denial.ts` 那张 gate×decider 唯一映射,不得在此另拼。
 */

import {
  buildToolDenial,
  denialErrorSuffix,
  type ToolCallDenial,
} from './utils/tool-denial.js'

/** 被判定的工具最小面(与 executor 的 Tool/ToolCall 形状解耦,只要求名字)。 */
export interface HeadlessPermissionSubject {
  readonly name: string
  readonly arguments?: Record<string, unknown>
}

export interface HeadlessPermissionBrokerConfig {
  /** 宿主 stdin/stdout 都是 TTY ⇒ true(判定注入,经纪不裸读 process,测试可全假)。 */
  readonly isInteractive: boolean
  /**
   * 审批面是否在位:调用方把"有没有人能应答这次批准"折算成一个布尔再交进来 ——
   * 例如宿主是否接了 `ctx.confirmDangerous` / plan 审批器 / REPL 弹窗。
   * 缺席即无人能应答 ⇒ 一切"需要批准"的调用只能 deny。
   */
  readonly hasApprovalSurface: boolean
  /**
   * 显式自动放行名单(对应上游只对 CreateWorkflow/AmendWorkflow 两个具名工具放行)。
   * **缺省为空集** —— 默认方向是 deny;放进名单的每一个名字都必须是拍过板的例外。
   */
  readonly autoAllowTools?: readonly string[]
}

export type HeadlessPermissionDecision =
  | { readonly action: 'allow'; readonly reason: 'auto-allow-list'; readonly tool: string }
  | { readonly action: 'use-approval-surface'; readonly tool: string }
  | {
      readonly action: 'deny'
      readonly tool: string
      /** 结构化拒绝(哪道闸/谁说的不/唯一出路/参数指纹),供返回体与审计消费。 */
      readonly denial: ToolCallDenial
      /** 拒绝文案:逐字 = denialErrorSuffix(denial),出自 utils/tool-denial.ts 单一出口。 */
      readonly message: string
    }

export interface HeadlessPermissionBroker {
  /** 对一个"需要批准才能执行"的调用给出路由(纯函数,无副作用)。 */
  evaluate(tool: HeadlessPermissionSubject): HeadlessPermissionDecision
  /** 该配置下经纪是否会代答缺席的审批面(即走 deny 支)——调用点据此决定是否短路。 */
  readonly deniesWhenSurfaceAbsent: boolean
}

/**
 * 判定核心(导出供直接复用/测试,不必先造 broker):
 * 真值表只有三行,每行都有一条用例钉住(见 tests/g-814407-*.test.ts):
 *  ① hasApprovalSurface=true ⇒ use-approval-surface(无论交互与否、无论名单与否 ——
 *     审批面在位时经纪**不抢答**;autoAllow 也不在这里生效,放行决定仍归审批面)。
 *  ② surface 缺席 ∧ 名字在 autoAllowTools ⇒ allow(auto-allow-list)。
 *  ③ surface 缺席 ∧ 其余 ⇒ deny(dangerous-gate / no-confirmation-channel ——
 *     这是"无人能应答"的既有专列档,不复用 rule-deny 那条,免得把"闸拒"与"没人可问"混成一谈)。
 */
export function decideHeadlessPermission(
  config: HeadlessPermissionBrokerConfig,
  tool: HeadlessPermissionSubject,
): HeadlessPermissionDecision {
  if (config.hasApprovalSurface) {
    return { action: 'use-approval-surface', tool: tool.name }
  }
  if (config.autoAllowTools && config.autoAllowTools.includes(tool.name)) {
    return { action: 'allow', reason: 'auto-allow-list', tool: tool.name }
  }
  const denial = buildToolDenial({
    gate: 'dangerous-gate',
    decider: 'no-confirmation-channel',
    tool: tool.name,
    args: tool.arguments,
  })
  return {
    action: 'deny',
    tool: tool.name,
    denial,
    message: denialErrorSuffix(denial),
  }
}

/**
 * 工厂形态(对齐上游 `createHeadlessPermissionBroker` 的委托结构):
 * 调用点构造一次、对每个待批调用 `evaluate` —— 判定与文案出口只有一份。
 */
export function createHeadlessPermissionBroker(
  config: HeadlessPermissionBrokerConfig,
): HeadlessPermissionBroker {
  return {
    evaluate: (tool) => decideHeadlessPermission(config, tool),
    deniesWhenSurfaceAbsent: !config.hasApprovalSurface,
  }
}

/**
 * 便捷判定:审批面是否在场(宿主接线点用)。判据两条都要问 —— 有 TTY **且** 回调已接;
 * 只认 TTY 会把"终端开着但宿主没实现确认通道"的进程判成有面(那就是本票立论的静默形态)。
 * `confirmHandlerPresent` 由调用方传入(通常是 `ctx.confirmDangerous !== undefined`),
 * 本模块不 import tools/**(它属于 executor 层;方向是 executor 来引这里的判定,不是反向)。
 */
export function approvalSurfacePresent(input: {
  ttyInteractive: boolean
  confirmHandlerPresent: boolean
}): boolean {
  return input.ttyInteractive && input.confirmHandlerPresent
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
