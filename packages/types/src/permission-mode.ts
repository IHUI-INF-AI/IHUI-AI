// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 权限模式唯一真源(G-161,2026-09-22 立)。
//
// 立因:同一语义此前并存 4 套拼写 —— agent-runtime.ts 5 值 camelCase、
// workspace.ts 4 值 kebab-case、api-client 3 值 kebab-case、
// ai-service agent_loop_v2 3 值(default/plan/auto,其中 auto 没有任何前端会发),
// 而 docs/developer/api/agents.md 对外承诺的是第 5 套
// (read-only/accept-edits/accept-all/bypass-permissions/plan-only,其中 3 个值代码里不存在)。
// 后果是"发了不等于生效":非法值要么被 Pydantic 静默丢弃,要么在 AgentLoopV2
// 构造期抛 ValueError 打成 500,没人负责把拼写对齐。
//
// 本文件是**跨语言**注册表的 TS 侧;Python 侧镜像在
// apps/ai-service/app/core/permission_mode.py,两侧成员与别名映射必须逐字一致,
// 由 scripts/check-permission-mode-vocabulary.mjs(guardian 第 68 项,blocking)对账。

/** 规范标识(camelCase)。新增成员必须同时补 Python 侧 + 文档,否则守门拦截。 */
export const PERMISSION_MODES = [
  'default',
  'acceptEdits',
  'bypassPermissions',
  'plan',
  'manual',
] as const

export type PermissionModeId = (typeof PERMISSION_MODES)[number]

/**
 * 历史/文档/跨端拼写 → 规范标识。键必须是**归一化键**(见 permissionModeKey)。
 *
 * 三条不成文的映射依据,免得后来人以为是随手起的:
 * - `auto` → `acceptEdits`:agent_loop_v2 的 `auto` 语义就是"只读工具免审批",
 *   与 acceptEdits 同档,从未有任何前端发过 `auto`。
 * - `read-only` / `plan-only` → `plan`:文档里两个只读叫法,实现只有 plan。
 * - `accept-all` → `bypassPermissions`:同一含义的第三种叫法,收敛到 Claude Code 拼写。
 */
export const PERMISSION_MODE_ALIASES: Readonly<Record<string, PermissionModeId>> = {
  default: 'default',
  acceptedits: 'acceptEdits',
  'accept-edits': 'acceptEdits',
  bypasspermissions: 'bypassPermissions',
  'bypass-permissions': 'bypassPermissions',
  plan: 'plan',
  manual: 'manual',
  auto: 'acceptEdits',
  'accept-all': 'bypassPermissions',
  'read-only': 'plan',
  'plan-only': 'plan',
}

/** 归一化键:camelCase → kebab → 全小写,使 `acceptEdits` 与 `accept-edits` 落到同一键。 */
export function permissionModeKey(raw: string): string {
  return raw
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

/** 规范标识集合(判定用,避免 PERMISSION_MODES.some 线性扫描写进热路径)。 */
export const PERMISSION_MODE_SET: ReadonlySet<string> = new Set<string>(PERMISSION_MODES)

/**
 * 任意输入 → 规范标识;认不出来返回 null(**不**回退 'default')。
 *
 * 调用方必须显式处理 null:静默降级到 default 会让用户以为"高危档已生效",
 * 与本次要根治的静默失效是同一类事故。
 */
export function normalizePermissionMode(raw: unknown): PermissionModeId | null {
  if (typeof raw !== 'string') return null
  const key = permissionModeKey(raw)
  if (key === '') return null
  return PERMISSION_MODE_ALIASES[key] ?? null
}

/**
 * workspace 线协议/落库拼写的**唯一清单**(kebab)。
 *
 * 为什么单独把"值数组"也放注册表:`z.enum()` 需要一个字面量元组,如果各路由自己写,
 * 就又长出副本(G-164 实测在 3 个路由文件里找到 4 份互不同步的清单,其中
 * `workspace-permissions.ts` 那份还少 plan,导致读 DB 时把已存的 plan **静默归 null**)。
 * 路由一律 `z.enum(PERMISSION_MODE_WIRE_VALUES)`,新增档位只需改注册表一处。
 */
export const PERMISSION_MODE_WIRE_VALUES = [
  'default',
  'plan',
  'accept-edits',
  'bypass-permissions',
] as const

/** workspace REST / DB 的 wire 拼写(kebab)。`manual` 无落库语义,故不在其中。 */
export type PermissionModeWire = (typeof PERMISSION_MODE_WIRE_VALUES)[number]

/**
 * workspace REST / DB 的既有落库拼写(kebab)。
 *
 * 为什么注册表要带这个:`workspace_permissions` 表与 `PUT /permissions` 历史上只收 kebab,
 * 而 web 的 3 处运行时比较(高风险徽章 / 确认桥 / 自动撤回)也拿 kebab 字面量。
 * 在存值迁移完成之前,**跨界只走 wire、判定只走规范档** ——
 * 两头各比各的拼写,就是 G-164 登记的那次"改一侧、另一侧静默失效"的成因。
 */
export const PERMISSION_MODE_WIRE: Readonly<Partial<Record<PermissionModeId, PermissionModeWire>>> =
  {
    default: 'default',
    acceptEdits: 'accept-edits',
    bypassPermissions: 'bypass-permissions',
    plan: 'plan',
  }

/** 任意拼写 → workspace wire 拼写(认不出返回 null,由调用方拒掉,不静默兜底)。 */
export function permissionModeWire(raw: unknown): PermissionModeWire | null {
  const id = normalizePermissionMode(raw)
  return id ? (PERMISSION_MODE_WIRE[id] ?? null) : null
}

/**
 * 展示档键(D111 移动端/extension 档位行共用)。
 *
 * - `null`/`undefined`(未配置)→ `'default'`:未配置的生效行为就是默认档,如实显示;
 * - 认不出的值 → `'unknown'`:**不得**静默显示成 default —— 用户配置了的高危档被显示成
 *   "默认模式"是授权误导,与 G-163 fail-open 是同一类事故的展示层形态;
 * - 其余(含历史 camel/kebab 拼写)归一到 wire 拼写,与 workspace.permission.mode.* 词表键一致。
 */
export function permissionModeDisplayKey(
  raw: string | null | undefined,
): PermissionModeWire | 'unknown' {
  if (raw === null || raw === undefined) return 'default'
  return permissionModeWire(raw) ?? 'unknown'
}

/** 该模式在审批门上的实际效果 —— 表现层与后端共用同一口径说明用。 */
export type PermissionModePolicy = 'ask' | 'auto-approve-safe' | 'auto-approve-all' | 'readonly'

const POLICY_BY_MODE: Record<PermissionModeId, PermissionModePolicy> = {
  default: 'ask',
  manual: 'ask',
  acceptEdits: 'auto-approve-safe',
  bypassPermissions: 'auto-approve-all',
  plan: 'readonly',
}

export function permissionModePolicy(mode: PermissionModeId): PermissionModePolicy {
  return POLICY_BY_MODE[mode]
}

/** 只读约束档(plan):白名单外工具直接拦截。 */
export function isReadonlyPermissionMode(mode: PermissionModeId): boolean {
  return POLICY_BY_MODE[mode] === 'readonly'
}

/** 免审批档:acceptEdits 只覆盖安全工具,bypassPermissions 覆盖全部。 */
export function skipsApprovalPermissionMode(mode: PermissionModeId): boolean {
  const policy = POLICY_BY_MODE[mode]
  return policy === 'auto-approve-safe' || policy === 'auto-approve-all'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
