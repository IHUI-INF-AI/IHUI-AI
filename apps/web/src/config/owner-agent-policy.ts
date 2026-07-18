/**
 * Agent 归属策略配置 — 等价自旧架构 client/src/config/owner-agent-policy.ts
 * 定义智能体（Agent）的归属、可见性与协作权限策略
 */

/** Agent 归属类型 */
export type AgentOwnership = 'personal' | 'team' | 'tenant' | 'public'

/** Agent 可见性范围 */
export type AgentVisibility = 'private' | 'team' | 'tenant' | 'public'

/** Agent 协作角色 */
export type AgentCollaborationRole = 'owner' | 'editor' | 'viewer'

export interface AgentPermission {
  /** 是否可查看配置 */
  canView: boolean
  /** 是否可编辑配置 */
  canEdit: boolean
  /** 是否可删除 */
  canDelete: boolean
  /** 是否可分享 */
  canShare: boolean
  /** 是否可发布到市场 */
  canPublish: boolean
  /** 是否可调用执行 */
  canExecute: boolean
}

export interface OwnerAgentPolicyEntry {
  /** 归属类型 */
  ownership: AgentOwnership
  /** 可见性 */
  visibility: AgentVisibility
  /** 默认权限（针对非 owner 的协作者） */
  defaultPermissions: AgentPermission
  /** 最大协作者数量 */
  maxCollaborators: number
  /** 是否允许转让所有权 */
  transferable: boolean
}

/** 默认 owner 权限（全开） */
export const OWNER_PERMISSIONS: AgentPermission = {
  canView: true,
  canEdit: true,
  canDelete: true,
  canShare: true,
  canPublish: true,
  canExecute: true,
}

/** 按归属类型的默认策略 */
export const OWNER_AGENT_POLICY: Record<AgentOwnership, OwnerAgentPolicyEntry> = {
  // 个人 Agent：仅创建者可见，不可协作
  personal: {
    ownership: 'personal',
    visibility: 'private',
    defaultPermissions: {
      canView: false,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canPublish: false,
      canExecute: false,
    },
    maxCollaborators: 0,
    transferable: true,
  },
  // 团队 Agent：团队内可见，支持协作编辑
  team: {
    ownership: 'team',
    visibility: 'team',
    defaultPermissions: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canShare: true,
      canPublish: false,
      canExecute: true,
    },
    maxCollaborators: 20,
    transferable: true,
  },
  // 租户 Agent：租户内公开，仅 owner 可编辑
  tenant: {
    ownership: 'tenant',
    visibility: 'tenant',
    defaultPermissions: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canPublish: false,
      canExecute: true,
    },
    maxCollaborators: 50,
    transferable: false,
  },
  // 公开 Agent：全平台可见，可发布到市场
  public: {
    ownership: 'public',
    visibility: 'public',
    defaultPermissions: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canShare: true,
      canPublish: false,
      canExecute: true,
    },
    maxCollaborators: 100,
    transferable: false,
  },
}

/** 协作角色对应权限覆盖 */
export const COLLABORATION_ROLE_PERMISSIONS: Record<AgentCollaborationRole, AgentPermission> = {
  owner: OWNER_PERMISSIONS,
  editor: {
    canView: true,
    canEdit: true,
    canDelete: false,
    canShare: true,
    canPublish: false,
    canExecute: true,
  },
  viewer: {
    canView: true,
    canEdit: false,
    canDelete: false,
    canShare: false,
    canPublish: false,
    canExecute: true,
  },
}

/**
 * 校验用户对指定 Agent 的权限
 * @param role 用户在 Agent 中的协作角色（owner 时直接返回全权限）
 * @param ownership Agent 归属类型
 */
export function resolveAgentPermission(
  role: AgentCollaborationRole,
  ownership: AgentOwnership,
): AgentPermission {
  if (role === 'owner') return OWNER_PERMISSIONS
  // 协作者先取归属策略的默认权限，再用角色权限向上合并（角色权限更宽松时取角色）
  const base = OWNER_AGENT_POLICY[ownership].defaultPermissions
  const rolePerm = COLLABORATION_ROLE_PERMISSIONS[role]
  return {
    canView: base.canView || rolePerm.canView,
    canEdit: base.canEdit || rolePerm.canEdit,
    canDelete: base.canDelete || rolePerm.canDelete,
    canShare: base.canShare || rolePerm.canShare,
    canPublish: base.canPublish || rolePerm.canPublish,
    canExecute: base.canExecute || rolePerm.canExecute,
  }
}
