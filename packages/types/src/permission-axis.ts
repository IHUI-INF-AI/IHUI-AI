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
export const SANDBOX_MODES = ['read-only', 'workspace-write', 'danger-full-access'] as const

export type SandboxModeId = (typeof SANDBOX_MODES)[number]

export const SANDBOX_MODE_DEFAULT: SandboxModeId = 'read-only'

/** 审批轴(codex AskForApproval)。默认 on-request:由模型决定何时升级询问。 */
export const APPROVAL_POLICIES = ['untrusted', 'on-failure', 'on-request', 'never'] as const

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
export const APPROVAL_PRESETS: Readonly<Record<'readOnly' | 'auto' | 'fullAccess', AxisPair>> = {
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

/**
 * granular 审批配置的取值形态(2026-10-25 运行时接线补)。
 *
 * 语义按 Codex 取证原文:**字段为 false 时自动拒绝而非询问**,故缺省键一律按
 * `false`(更严一侧)结算 —— 只写 `{ sandbox_approval: true }` 的档案在 rules /
 * skill / permissions / mcp 四类上自动拒绝,这是"没写 = 不许问"的 fail-closed 方向。
 */
export type GranularApprovalConfig = Partial<Record<GranularApprovalKey, boolean>>

/** approval_policy 的完整取值形态:字符串档位,或 granular 对象形态策略(Codex AskForApproval)。 */
export type ApprovalPolicySpec = ApprovalPolicyId | { granular: GranularApprovalConfig }

/**
 * 工具侧的粗粒度类别 —— 判定面的**唯一输入维度**(不含任何具体工具名)。
 *
 * 为什么需要这一层:双轴是跨语言的权限契约,不能认识 `write_file` / `run_command` 这类
 * 端内工具名;端内只做"工具名/危险级 → 类别"的映射,判定本身留在本注册表,
 * 两侧共用一份(§0.6,第二份判定必然漂移)。
 */
export const AXIS_TOOL_KINDS = ['read', 'write', 'command', 'skill', 'mcp'] as const

export type AxisToolKind = (typeof AXIS_TOOL_KINDS)[number]

/**
 * granular 键 → 它管辖的工具类别(granular 语义到运行时的**唯一定义处**)。
 *
 * 映射依据(逐条对齐 Codex GranularApprovalConfig 的键名语义,不发明):
 * - `sandbox_approval`:为"越出沙箱"而发起的审批 ⇒ 命令类;
 * - `rules`:规则面(execpolicy/权限规则)命中的审批 ⇒ 写入类(规则面覆盖文件与命令,
 *   但命令另有 sandbox_approval,写入类没有第二道键,取更严使其也受 rules 约束);
 * - `skill_approval`:技能工具;
 * - `request_permissions`:通用的"请求权限"审批 ⇒ 写入类(没有更细类别的兜底档);
 * - `mcp_elicitations`:MCP 侧的 elicit 交互。
 * 一个类别可被多个键管辖时**取更严**(任一键为 false 即拒绝),不取"任一为 true 即放行"。
 */
export const GRANULAR_APPROVAL_TOOL_KIND: Readonly<Record<GranularApprovalKey, AxisToolKind>> = {
  sandbox_approval: 'command',
  rules: 'write',
  skill_approval: 'skill',
  request_permissions: 'write',
  mcp_elicitations: 'mcp',
}

/** granular 对象归一:键必须在 GRANULAR_APPROVAL_KEYS 内、值必须是 boolean;否则 null(不猜)。 */
export function normalizeGranularApproval(raw: unknown): GranularApprovalConfig | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  const out: GranularApprovalConfig = {}
  for (const [k, v] of Object.entries(rec)) {
    if (!(GRANULAR_APPROVAL_KEYS as readonly string[]).includes(k)) return null
    if (typeof v !== 'boolean') return null
    out[k as GranularApprovalKey] = v
  }
  return out
}

/**
 * approval_policy 全形态归一:字符串走成员∪别名,对象只认 `{ granular: {...} }`。
 * 认不出返回 null —— 调用方必须显式处理(不得静默当默认档)。
 */
export function normalizeApprovalPolicySpec(raw: unknown): ApprovalPolicySpec | null {
  if (typeof raw === 'string') return normalizeApprovalPolicy(raw)
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  const granular = normalizeGranularApproval(rec.granular)
  if (granular === null) return null
  return { granular }
}

/** 轴闸的三态裁决(与 CLI 的 permission_denied 分流:deny 直接拒,ask 进人工确认,allow 放行)。 */
export type AxisGateDecision = 'allow' | 'ask' | 'deny'

export interface AxisGateInput {
  /** 沙箱轴;非法/缺失值按更严一侧(read-only)结算并在 reason 点名。 */
  sandboxMode: SandboxModeId | string | null | undefined
  /** 审批轴;非法/缺失值按更严一侧(untrusted)结算并在 reason 点名。 */
  approvalPolicy: ApprovalPolicySpec | string | null | undefined
  toolKind: AxisToolKind
}

export interface AxisGateResult {
  decision: AxisGateDecision
  /** 机器可读的判定依据(ASCII,稳定字面量;测试与审计读它,不读人话)。 */
  reason: string
  /** deny/ask 时给用户与模型的下一步出路(可执行的那一条,不空喊"被拒绝")。 */
  hint?: string
}

/** read-only 档的出路:直接点名配置键与当前唯一默认源,不让人去翻文档。 */
const READ_ONLY_HINT =
  'set sandbox_mode=workspace-write (settings.json sandboxMode) or pick a wider sandbox profile to allow this'

/** approval 闸的出路:按档位给下一步,不空喊"需要批准"。 */
const APPROVAL_HINT =
  'run interactively and approve this call, or set approval_policy=never / a wider granular flag in the user-level settings.json'

/**
 * 双轴 → 单次工具调用的裁决(纯函数,零 IO)。
 *
 * 判序与失效方向:
 *  1. 未知/缺失的沙箱轴按 `read-only`(最严)结算;未知/缺失的审批轴按 `untrusted`(最严)
 *     结算,两条都在 reason 里点名 —— "拿不准"绝不读成"放宽"(§0.10 的同一方向);
 *  2. 沙箱面先于审批面:read-only 下写/命令/技能/MCP 一律 deny(再问一次也没有可批准的事);
 *  3. granular 对象形态按"缺省 false = 自动拒绝"结算,false 即 deny(不问);全 true 时
 *     只能 ask —— granular 是"哪些可以问"的开关,不是"全部免问"的开关;
 *  4. 字符串档位:`never` 放行(结构性禁止在更外层,不由本轴压过);`on-request` 只让
 *     读/写免问、命令/技能/MCP 走询问;`untrusted` 与 `on-failure` 更严(只有读免问)。
 *     为什么 `on-failure` 取 ask 而不是"先跑再问":CLI 没有"失败后以更高权限重试"的通道,
 *     把它读成"免问"就是放宽;多要一次定向说明是唯一安全的失效方向。
 */
export function evaluateAxisGate(input: AxisGateInput): AxisGateResult {
  const sandboxKnown = normalizeSandboxMode(input.sandboxMode)
  const sandbox: SandboxModeId = sandboxKnown ?? 'read-only'
  const sandboxReason =
    sandboxKnown === null && input.sandboxMode !== undefined && input.sandboxMode !== null
      ? `sandbox_mode_unknown:${String(input.sandboxMode)}`
      : ''

  if (sandbox === 'read-only' && input.toolKind !== 'read') {
    return {
      decision: 'deny',
      reason: `${sandboxReason ? `${sandboxReason}|` : ''}sandbox_mode=read-only blocks ${input.toolKind}`,
      hint: READ_ONLY_HINT,
    }
  }

  const spec = normalizeApprovalPolicySpec(input.approvalPolicy)
  const approvalUnknown =
    spec === null && input.approvalPolicy !== undefined && input.approvalPolicy !== null
  const reasonPrefix = `${sandboxReason ? `${sandboxReason}|` : ''}${approvalUnknown ? `approval_policy_unknown:${JSON.stringify(input.approvalPolicy)}|` : ''}`

  // granular 对象形态:缺省 false = 自动拒绝(不问)
  if (spec !== null && typeof spec === 'object') {
    const managedKeys = GRANULAR_APPROVAL_KEYS.filter(
      (k) => GRANULAR_APPROVAL_TOOL_KIND[k] === input.toolKind,
    )
    if (managedKeys.length === 0) {
      return { decision: 'allow', reason: `${reasonPrefix}granular:no-key-for-${input.toolKind}` }
    }
    const deniedKeys = managedKeys.filter((k) => spec.granular[k] !== true)
    if (deniedKeys.length > 0) {
      return {
        decision: 'deny',
        reason: `${reasonPrefix}granular:${deniedKeys.join('+')}=false`,
        // 同类多键取更严 ⇒ 必须把**全部** false 键列出来(只报一个,用户开完发现还是拒)
        hint: `set ${deniedKeys.map((k) => `granular.${k}=true`).join(' and ')} in the user-level settings.json to allow asking for ${input.toolKind}`,
      }
    }
    return {
      decision: 'ask',
      reason: `${reasonPrefix}granular:${managedKeys.join('+')}=true`,
      hint: APPROVAL_HINT,
    }
  }

  // 认不出或缺失 ⇒ untrusted(最严的字符串档:只有读免问)
  const policy: ApprovalPolicyId = spec !== null && typeof spec === 'string' ? spec : 'untrusted'
  if (input.toolKind === 'read') {
    return { decision: 'allow', reason: `${reasonPrefix}approval_policy=${policy}:read-only-op` }
  }
  if (policy === 'never') {
    return { decision: 'allow', reason: `${reasonPrefix}approval_policy=never` }
  }
  if (policy === 'on-request' && input.toolKind === 'write') {
    return { decision: 'allow', reason: `${reasonPrefix}approval_policy=on-request:write` }
  }
  return {
    decision: 'ask',
    reason: `${reasonPrefix}approval_policy=${policy}:${input.toolKind}`,
    hint: APPROVAL_HINT,
  }
}

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
export const PERMISSION_MODE_TO_AXIS: Readonly<Record<PermissionModeId, AxisPair | null>> = {
  default: { sandboxMode: 'workspace-write', approvalPolicy: 'on-request' },
  plan: { sandboxMode: 'read-only', approvalPolicy: 'on-request' },
  bypassPermissions: { sandboxMode: 'danger-full-access', approvalPolicy: 'never' },
  acceptEdits: null,
  manual: null,
}

// ---------------------------------------------------------------------------
// config profiles(79 号票第二刀,2026-10-18 立):[profiles.NAME] 顶层键子集。
//
// 取证(2026-10-01,与上方取证同批):config.toml 的 [profiles.NAME] 可覆盖
// model / approval_policy / sandbox_mode 等顶层键子集,经 --profile 或顶层
// profile= 选择。本模块只收**键名单 + 取值解析**,不复制继承语义。
//
// 边界声明(与 permission-mode.ts 的 CHAT_MODE × PERMISSION_MODE、与 ai-service
// 侧 core/permission_profiles.py 的 PermissionsToml 档案族,三者互不顶账):
// - permission_profiles.py 是"档案声明面 + filesystem/network 的解析语义"
//   (extends 链、normalize_host),是 Codex PermissionsToml 那一族;
// - 本族是"顶层键子集的取值覆盖",没有 extends 链、没有档案继承。
//   两族同源于 Codex 但落点不同,把 [profiles.NAME] 的键塞进 PermissionsToml
//   的档案解析会把"顶层键覆盖"误读成"档案继承",属于跨族顶账。
// ---------------------------------------------------------------------------

export const CONFIG_PROFILE_VALUE_KEYS = ['approval_policy', 'sandbox_mode', 'model'] as const

/** config profile 的顶层键名(与 Python 侧逐字对账)。 */
export type ConfigProfileValueKey = (typeof CONFIG_PROFILE_VALUE_KEYS)[number]

/**
 * config profile 映射 → 双轴取值对;**解析不出返回 null,不回退默认**。
 *
 * 两件事必须分开(2026-10-18 实测订正,起因是外卖那一版把"没给"当成"默认档"):
 * - 某轴**没给** ⇒ 该轴缺席(不出现在结果里),由上层/全局配置决定。
 *   刻意**不**填 SANDBOX_MODE_DEFAULT:只声明 approval_policy 的档案如果被
 *   自动补成 read-only,那么"我只要不弹审批"就被读成"禁止一切写操作" ——
 *   方向相反的失真,且用户看不出来。
 * - 某轴**给了但认不出**(拼错 / 本族不支持的档)⇒ 整段 null。
 *   "认不出"绝不当成"没给":那会把用户明确写的 read-only 静默降级成缺席。
 *
 * model 键按 Codex 只属顶层键子集,不参与双轴判定,故解析时只做存在性放行、
 * **不校验取值**(模型清单另有真源,本模块不抄第二份)。
 */
export function resolveConfigProfileAxis(profile: unknown): Partial<AxisPair> | null {
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) return null
  const rec = profile as Record<string, unknown>
  const rawSandbox = rec.sandbox_mode
  const rawApproval = rec.approval_policy
  const sandbox =
    rawSandbox === undefined ? undefined : (normalizeSandboxMode(rawSandbox) ?? undefined)
  const approval =
    rawApproval === undefined ? undefined : (normalizeApprovalPolicy(rawApproval) ?? undefined)
  // 给了但认不出 ⇒ 整段失败(绝不当成"没给")
  if (
    (rawSandbox !== undefined && sandbox === undefined) ||
    (rawApproval !== undefined && approval === undefined)
  )
    return null
  const out: Partial<AxisPair> = {}
  if (sandbox !== undefined) out.sandboxMode = sandbox
  if (approval !== undefined) out.approvalPolicy = approval
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
