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
// 由 scripts/check-permission-mode-vocabulary.mjs(guardian 第 67 项,blocking)对账。

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
