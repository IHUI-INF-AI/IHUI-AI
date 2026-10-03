// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


// 权限双轴唯一真源(79 号票第一刀,2026-10-01 立):sandbox_mode × approval_policy + config profiles。
//
// 一手取证(2026-10-01,多源交叉一致,源码级):
// - codex-rs/protocol/src/config_types.rs 的 SandboxMode 枚举:read-only(默认)/workspace-write/danger-full-access;
// - codex-rs/protocol/src/protocol.rs 的 AskForApproval 枚举:untrusted(serde rename,原 UnlessTrusted)/
//   on-request(默认)/never + granular 变体(5 个布尔:sandbox_approval/rules/skill_approval/
//   request_permissions/mcp_elicitations,字段为 false 时自动拒绝而非询问);on-failure 是文档仍承认的
//   旧拼写,故按成员收录而非别名合并;
// - 官方 docs 的 approval_presets 三档:Read Only=(read-only, on-request)、Auto=(workspace-write, on-request)、
//   Full Access=(danger-full-access, never);config.toml 的 [profiles.NAME] 可覆盖 model/approval_policy/
//   sandbox_mode 等顶层键子集,经 --profile 或顶层 profile= 选择。
//
// 本文件是**跨语言**注册表的 TS 侧;Python 侧镜像在
// apps/ai-service/app/core/permission_axis.py,两侧成员/别名/预设/Legacy 映射必须逐字一致,
// 由 scripts/check-permission-mode-vocabulary.mjs 的 R6 条(guardian 第 68 项)对账。
//
// 边界声明(守门 151 同款禁令):本双轴与 permission_mode.py 里既有的
// CHAT_MODE × PERMISSION_MODE 相交策略(ToolClass/ApprovalClass 取更严)是**两个域**,
// 不得互相顶账;与单轴 PERMISSION_MODES 也不得互相替代 —— 单轴是对外 wire 契约,
// 双轴是语义分解,二者经 PERMISSION_MODE_TO_AXIS 显式映射。

// 2026-10-03:内联 `import('./permission-mode.js')` 类型注解违反
// @typescript-eslint/consistent-type-imports(lint CI run 37112485297 实测),
// 提为顶层 type-only import。
import type { PermissionModeId } from './permission-mode.js'

/** 沙箱轴(codex SandboxMode,kebab)。默认 read-only:只能读,写文件/联网被 OS 级沙箱拦。 */
export const SANDBOX_MODES = [
  'read-only',
  'workspace-write',
  'danger-full-access',
] as const

export type SandboxModeId = (typeof SANDBOX_MODES)[number]

export const SANDBOX_MODE_DEFAULT: SandboxModeId = 'read-only'

/** 审批轴(codex AskForApproval)。默认 on-request:由模型决定何时升级询问。 */
export const APPROVAL_POLICIES = [
  'untrusted',
  'on-failure',
  'on-request',
  'never',
] as const

export type ApprovalPolicyId = (typeof APPROVAL_POLICIES)[number]

export const APPROVAL_POLICY_DEFAULT: ApprovalPolicyId = 'on-request'

/** 沙箱轴拼写别名 → 规范标识。只收有依据的拼写,不发明。 */
export const SANDBOX_MODE_ALIASES: Readonly<Record<string, SandboxModeId>> = {
  'read-only': 'read-only',
  'workspace-write': 'workspace-write',
  'danger-full-access': 'danger-full-access',
  readonly: 'read-only',
}

/** 审批轴拼写别名 → 规范标识。unless-trusted 是 Rust 枚举变体 UnlessTrusted 的 kebab 形。 */
export const APPROVAL_POLICY_ALIASES: Readonly<Record<string, ApprovalPolicyId>> = {
  untrusted: 'untrusted',
  'on-failure': 'on-failure',
  'on-request': 'on-request',
  never: 'never',
  'unless-trusted': 'untrusted',
}

/** 双轴取值对(profiles 与预设的载体形态)。 */
export interface AxisPair {
  sandboxMode: SandboxModeId
  approvalPolicy: ApprovalPolicyId
}

/** Codex 官方 approval_presets 三档(2026-10-01 取证)。键用 camelCase,值两轴齐发。 */
export const APPROVAL_PRESETS: Readonly<
  Record<'readOnly' | 'auto' | 'fullAccess', AxisPair>
> = {
  readOnly: { sandboxMode: 'read-only', approvalPolicy: 'on-request' },
  auto: { sandboxMode: 'workspace-write', approvalPolicy: 'on-request' },
  fullAccess: { sandboxMode: 'danger-full-access', approvalPolicy: 'never' },
}

export type ApprovalPresetId = keyof typeof APPROVAL_PRESETS

export const APPROVAL_PRESET_IDS = ['readOnly', 'auto', 'fullAccess'] as const

/**
 * granular 审批策略的 5 个细分开关(codex GranularApprovalConfig,2026-10-01 取证)。
 * **刻意不进 APPROVAL_POLICIES 成员集**:granular 是对象形态策略而非字符串档位,
 * 本期不实现运行时;登记键名单是为了在 Python/TS 两侧共用同一份"字段存在性"契约。
 */
export const GRANULAR_APPROVAL_KEYS = [
  'sandbox_approval',
  'rules',
  'skill_approval',
  'request_permissions',
  'mcp_elicitations',
] as const

export type GranularApprovalKey = (typeof GRANULAR_APPROVAL_KEYS)[number]

/** 归一化:双轴值本身已是 kebab 小写,只需 trim+lower 后查 成员∪别名键。 */
export function normalizeSandboxMode(raw: unknown): SandboxModeId | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toLowerCase()
  if (key === '') return null
  return (SANDBOX_MODE_ALIASES[key] ?? null) as SandboxModeId | null
}

export function normalizeApprovalPolicy(raw: unknown): ApprovalPolicyId | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toLowerCase()
  if (key === '') return null
  return (APPROVAL_POLICY_ALIASES[key] ?? null) as ApprovalPolicyId | null
}

/**
 * 既有单轴规范档 → 双轴分解。**null = 无 Codex 等价,fail-closed 不伪造**:
 * - plan → Read Only 预设(只读 + 需要时询问)——精确;
 * - default → Auto 预设(工作区可写 + 模型决定何时询问)——精确;
 * - bypassPermissions → Full Access 预设——精确;
 * - acceptEdits → null:其语义是"文件编辑免审批、其余仍询问",审批策略的编辑类细分
 *   在 Codex 侧只能用 granular 的布尔组合表达,双轴字符串档位表达不了,伪造映射会
 *   把"编辑免审批"静默放宽成"全部询问"(方向相反的失真);
 * - manual → null:全人工审批在 Codex 侧无对应档(untrusted 也放行 execpolicy 规则)。
 * 消费方拿到 null 必须显式处理,不得回退到任一预设(同一类静默失效正是 G-161 要根治的)。
 */
export const PERMISSION_MODE_TO_AXIS: Readonly<
  Record<PermissionModeId, AxisPair | null>
> = {
  default: { sandboxMode: 'workspace-write', approvalPolicy: 'on-request' },
  plan: { sandboxMode: 'read-only', approvalPolicy: 'on-request' },
  bypassPermissions: { sandboxMode: 'danger-full-access', approvalPolicy: 'never' },
  acceptEdits: null,
  manual: null,
}
