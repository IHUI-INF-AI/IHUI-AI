/**
 * 6 级 DataScope 数据权限。
 *
 * 设计对齐 legacy `app/security.py` 的 build_data_scope_query (Bug-12):
 *  - 用最小 scope 优先：admin(ALL) > manager(ORGANIZATION) > user(SELF)
 *  - canAccess 单点判定资源可见性，业务层不再重复写权限逻辑
 *  - buildScopeFilter 返回结构化条件对象，由调用方转 Drizzle SQL（解耦 ORM）
 *
 * 与 legacy 的差异（迁移决策）:
 *  - legacy 用字符串 "1".."5" 表示 scope；TS 用数值枚举，类型安全
 *  - legacy 的"自定义部门"（scope=2）需要 SysRoleDept 表，TS 版暂不实现，用 FAMILY/DEPARTMENT 覆盖
 *  - TS 版新增 NONE=0（无任何数据权限，用于被禁用角色）
 *
 * 角色映射（默认策略，可在 apps/api 用 RBAC 表覆盖）:
 *  - roleId === 1  → admin   → ALL
 *  - roleId === 2  → manager → ORGANIZATION
 *  - 其他          → user    → SELF
 */
export enum DataScope {
  /** 无任何数据权限（被禁用角色 / 异常兜底） */
  NONE = 0,
  /** 仅本人数据 */
  SELF = 1,
  /** 同 family 数据（共享账号场景） */
  FAMILY = 2,
  /** 本部门数据 */
  DEPARTMENT = 3,
  /** 本组织数据 */
  ORGANIZATION = 4,
  /** 全部数据 */
  ALL = 5,
}

/** roleId → DataScope 默认映射 */
export const DEFAULT_ROLE_SCOPE_MAP: Record<number, DataScope> = {
  1: DataScope.ALL,
  2: DataScope.ORGANIZATION,
};

/**
 * 根据角色 ID 推断 DataScope。
 * 默认策略: admin=ALL, manager=ORGANIZATION, 其余=SELF。
 * 调用方可用 RBAC 表覆盖此默认值。
 */
export function getDataScopeForRole(roleId: number): DataScope {
  if (roleId === 1) return DataScope.ALL;
  if (roleId === 2) return DataScope.ORGANIZATION;
  return DataScope.SELF;
}

/**
 * buildScopeFilter 返回的结构化 where 条件。
 * 调用方据此构造 Drizzle SQL，例如:
 *   - scope=ALL:           无需 where（全量）
 *   - scope=SELF:          where userId == currentUserId
 *   - scope=FAMILY:        where familyId == currentFamilyId
 *   - scope=NONE:          where false（无任何数据）
 */
export interface ScopeFilter {
  /** 触发的 scope，便于调用方记录审计 / 日志 */
  scope: DataScope;
  /** 当前用户 ID（SELF / DEPARTMENT 时使用） */
  userId?: string;
  /** 当前 family ID（FAMILY 时使用） */
  familyId?: string;
}

/**
 * 构建 where 条件对象。
 * - ALL / ORGANIZATION / DEPARTMENT: 返回空字段，由调用方决定是否加部门过滤
 *   （DEPARTMENT 需要 dept 表，留给 apps/api 层补强；这里只回传 userId 上下文）
 * - FAMILY: 回传 familyId
 * - SELF:   回传 userId
 * - NONE:   scope=NONE，调用方应直接返回空结果集
 */
export function buildScopeFilter(
  scope: DataScope,
  userId: string,
  familyId?: string,
): ScopeFilter {
  switch (scope) {
    case DataScope.ALL:
      return { scope };
    case DataScope.ORGANIZATION:
      // 组织级数据：暂不附加条件（apps/api 可结合 organization 表加 where）
      return { scope, userId };
    case DataScope.DEPARTMENT:
      // 部门级数据：apps/api 结合 dept 表加 where（本包不持有 ORM schema）
      return { scope, userId };
    case DataScope.FAMILY:
      return { scope, familyId };
    case DataScope.SELF:
      return { scope, userId };
    case DataScope.NONE:
      return { scope };
    default:
      return { scope: DataScope.NONE };
  }
}

/**
 * 判断当前用户能否访问指定资源。
 * 规则（与 legacy build_data_scope_query 的优先级一致）:
 *  - ALL:           始终 true
 *  - ORGANIZATION:  始终 true（本包不持有组织表，宽松放行；严格校验留给 apps/api）
 *  - DEPARTMENT:    始终 true（同上）
 *  - FAMILY:        仅当 currentFamilyId 已配置且资源属于本人时放行；
 *                   跨 family 成员的细粒度判定需要资源自身的 familyId，
 *                   应在调用前用 buildScopeFilter 走 DB 查询，canAccess 只兜底本人数据。
 *  - SELF:          资源 ownerId 必须等于 currentUserId
 *  - NONE:          始终 false
 *
 * 注意: canAccess 只做粗粒度判定，业务最终可见性仍受 row-level 条件约束。
 */
export function canAccess(
  scope: DataScope,
  resourceOwnerId: string,
  currentUserId: string,
  currentFamilyId?: string,
): boolean {
  switch (scope) {
    case DataScope.ALL:
    case DataScope.ORGANIZATION:
    case DataScope.DEPARTMENT:
      return true;
    case DataScope.FAMILY:
      // 没有 currentFamilyId 时退化为 SELF；有 familyId 时仍只放行本人数据，
      // 跨成员可见性需结合资源的 familyId 走 buildScopeFilter + DB 查询。
      if (!currentFamilyId) return resourceOwnerId === currentUserId;
      return resourceOwnerId === currentUserId;
    case DataScope.SELF:
      return resourceOwnerId === currentUserId;
    case DataScope.NONE:
      return false;
    default:
      return false;
  }
}
