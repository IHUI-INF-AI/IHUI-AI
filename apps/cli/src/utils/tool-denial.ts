// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具被拒的「可诊断化」唯一出口(本票)。
 *
 * 立论:此前 `executeToolCall` 的三条拒绝路径(权限规则拒 / 危险工具无确认出口 /
 * 租约摘要漂移)对上层只剩一句短语,操作员与测试都无法回答"是哪一道闸拒的、唯一出路
 * 是什么、这次调用到底长什么样"。本模块把这三问变成**返回体上的结构化字段 + 一条既有
 * 审计流水**,并且:
 *  - **不新增任何放行路径** —— 判"是否放"的分支一行都没动,只改"怎么说"(fail-closed 不变);
 *  - 参数只落**指纹 + 键名**,绝不落值(审计流水与错误串都是明文面,命令原文/凭据不得进 ——
 *    与守门 67、`permission_lease_slot_digest_recorded`"只落指纹"同一条取向);
 *  - 出路文案是**真实存在的出口**(`--tools`/`--disallowed-tools`、交互确认、
 *    `--permission-lease <tool>` / REPL `/lease`、宿主接线 `ctx.confirmDangerous`),
 *    并明写"没有环境变量一键放行"—— 那是设计姿态,不得被读成待修缺陷。
 *
 * 文案用 ASCII 英文技术串:新文件的硬编码中文基线为 0(守门 70),且该串会被拼进
 * 回灌模型/打印终端的错误里,消费方既有操作员也有模型,英文零信息损失(同款理由见
 * `tools/index.ts` 的 execBudgetResult 注释)。
 */
import { createHash } from 'node:crypto'

import { auditLog } from '../audit.js'

/** 是哪一道闸拒的(三态,判据 ①)。 */
export type ToolDenialGate = 'permission-rule' | 'dangerous-gate' | 'lease-digest-drift'

/** 是谁说的"不":静态规则 / 无确认出口(无头) / 真人当面拒绝。 */
export type ToolDenialDecider = 'rule-deny' | 'no-confirmation-channel' | 'user-declined'

/** 本次调用参数的可公开摘要:sha256 短指纹 + 键名列表,**不含任何值**。 */
export interface ToolArgsDigest {
  readonly fingerprint: string
  readonly keys: readonly string[]
}

export interface ToolCallDenial {
  readonly gate: ToolDenialGate
  readonly decider: ToolDenialDecider
  readonly tool: string
  readonly args: ToolArgsDigest
  /** 唯一出路(判据 ②):怎么给、谁能给;无头下的正确做法是改显式授权而不是绕。 */
  readonly guidance: string
}

export interface BuildToolDenialInput {
  readonly gate: ToolDenialGate
  readonly decider: ToolDenialDecider
  readonly tool: string
  readonly args: Record<string, unknown> | undefined
}

/**
 * 参数摘要的唯一实现。指纹的输入序列化与租约摘要维度同一口径(`JSON.stringify(args ?? null)`),
 * 两处各拼一遍必然漂移(本仓"同一 key 共用一份实现"同族教训)。
 */
export function digestToolArgs(args: Record<string, unknown> | undefined): ToolArgsDigest {
  const serialized = JSON.stringify(args ?? null)
  const hash = createHash('sha256').update(serialized, 'utf8').digest('hex').slice(0, 12)
  const keys = Object.keys(args ?? {}).sort()
  return { fingerprint: `sha256:${hash}`, keys }
}

const GUIDANCE_PERMISSION_RULE_DENY =
  'Denied by permission rules (deny-list hit, or the tool is outside a non-empty --tools allow-list). ' +
  'Only way out: change the explicit authorization surface at launch (--tools / --disallowed-tools). ' +
  'A permission lease never relaxes this gate (it can only relax "ask"), dangerous or otherwise; ' +
  'there is NO environment-variable bypass - fail-closed here is the intended posture, not a defect.'

const GUIDANCE_LEASE_DRIFT =
  'A prior approval for this tool EXISTS, but this call\'s arguments no longer match the digest that was approved ' +
  '(lease content drift) => the old approval is void; this is NOT "never approved". ' +
  'Only ways out: re-approve in an interactive session, or grant a fresh scoped lease whose declaration covers the ' +
  'exact new content (--permission-lease <tool> [--permission-lease-digest] / REPL /lease). ' +
  'Silently reusing the stale approval is refused by design.'

const GUIDANCE_DANGEROUS_NO_CHANNEL =
  'Dangerous tools require a user confirmation that this host did not provide (headless / no ctx.confirmDangerous). ' +
  'Only ways out: (a) run in an interactive terminal where the confirmation prompt exists, or (b) have the embedding ' +
  'host wire ctx.confirmDangerous to a real approval channel (operator-side --allow-dangerous flows through that same ' +
  'callback and is never read as a bypass at this layer). A permission lease never relaxes dangerLevel="dangerous", ' +
  'and there is NO environment-variable bypass - this refusal is the intended security posture.'

const GUIDANCE_USER_DECLINED =
  'The user actively declined this call at the confirmation prompt. Only way out: adjust the request or ask again ' +
  'interactively; there is no non-interactive override.'

/** 出路文案的唯一映射(判据 ②)。每个 (gate, decider) 组合都点名至少一条真实出口。 */
export function toolDenialGuidance(gate: ToolDenialGate, decider: ToolDenialDecider): string {
  if (decider === 'user-declined') return GUIDANCE_USER_DECLINED
  if (gate === 'permission-rule') return GUIDANCE_PERMISSION_RULE_DENY
  if (gate === 'lease-digest-drift') return GUIDANCE_LEASE_DRIFT
  return GUIDANCE_DANGEROUS_NO_CHANNEL
}

export function buildToolDenial(input: BuildToolDenialInput): ToolCallDenial {
  return {
    gate: input.gate,
    decider: input.decider,
    tool: input.tool,
    args: digestToolArgs(input.args),
    guidance: toolDenialGuidance(input.gate, input.decider),
  }
}

/**
 * 拼进错误串的 ASCII 后缀(人读面)。结构化字段在 `ToolResult.denial`,这一行保证
 * 只看到文本的消费者(模型 / 日志摘录)也能回答三问;参数只以指纹+键名出现。
 */
export function denialErrorSuffix(denial: ToolCallDenial): string {
  const keys = denial.args.keys.length > 0 ? denial.args.keys.join(',') : '-'
  return (
    `[ihui-denial gate=${denial.gate} decider=${denial.decider} ` +
    `args=${denial.args.fingerprint} keys=${keys}] ${denial.guidance}`
  )
}

/** 审计事件名(落在既有 `auditLog` ⇒ ~/.ihui/audit.jsonl,不另立通道)。 */
export const TOOL_DENIAL_AUDIT_EVENT = 'tool_call_denied'

/**
 * 无头拒绝的审计出口:只记"没人能应答"的两态(rule-deny / no-confirmation-channel);
 * user-declined 时人就在场、提示已完整展示,不再多落一行。记录含闸种类与工具名(判据 ③),
 * 参数面只有指纹与键名。
 */
export function auditToolDenial(denial: ToolCallDenial): void {
  if (denial.decider === 'user-declined') return
  auditLog({
    timestamp: new Date().toISOString(),
    tool: TOOL_DENIAL_AUDIT_EVENT,
    input: {
      gate: denial.gate,
      decider: denial.decider,
      toolName: denial.tool,
      argsFingerprint: denial.args.fingerprint,
      argKeys: [...denial.args.keys],
    },
    success: false,
    error: `tool call denied (${denial.gate}/${denial.decider}); see ToolResult.denial.guidance for the only way out`,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
