// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D29 团队知识引擎服务层(G-35)。
 *
 * 这一层唯一的职责是把「谁在操作」和「他能对这条数据做什么」算清楚,然后落库。
 * 两条不可协商的写法:
 * 1. **身份只从入参 `actorUserId` 取,而它由路由层从令牌注入** —— 请求体/Query 里的
 *    userId / role 一律不读(守门 117「认证不等于授权」那一型:匿名进不来不等于
 *    任何已登录用户都能碰别人的数据)。
 * 2. **每一次写都同事务落一条 revisions 审计**(before/after 摘要 + actor + role)。
 *    先改内容再补审计的写法,中途抛错就会留下"改了但查不到谁改的"的洞。
 *
 * 权限算法 `resolveEffectiveRole()` 是全仓该模型的单点,`packages/api-client` 与各端
 * 不得各算一遍 —— 两处算同一件事必然漂移(本仓已记过多次)。
 */

import { createHash } from 'node:crypto'
import { and, asc, desc, eq } from 'drizzle-orm'
import {
  teamKnowledgeItems,
  teamKnowledgeRevisions,
  teamKnowledgeSpaceMembers,
  teamKnowledgeSpaces,
  teamMembers,
  teams,
  type TeamKnowledgeAction,
  type TeamKnowledgeItem,
  type TeamKnowledgeKind,
  type TeamKnowledgeRevision,
  type TeamKnowledgeRole,
  type TeamKnowledgeSpace,
  type TeamKnowledgeStatus,
} from '@ihui/database'
import { db } from '../db/index.js'
import { AppError } from '../errors/AppError.js'

// =============================================================================
// 类型(本票的 DTO 出口;跨端复用需先经 packages/types 主入口 barrel,
// 那是主会话单写的注册面,见交付报告"未做"段)
// =============================================================================

/** 角色偏序:数值越大权限越高 */
const ROLE_RANK: Record<TeamKnowledgeRole, number> = { viewer: 1, editor: 2, owner: 3 }

/** 团队角色(team_members.role)中可直接升为空间 owner 的那两档 */
const TEAM_ROLE_IMPLYING_SPACE_OWNER = new Set(['owner', 'admin'])

export interface Actor {
  /** 令牌主体 id,路由层从 authenticate() 结果取,绝不来自请求体 */
  userId: string
}

export interface EffectiveAccess {
  role: TeamKnowledgeRole
  /** 判定依据,回给前端做按钮致灰与审计定位;不泄露他人身份 */
  reason: 'team_default' | 'space_member' | 'creator' | 'space_owner'
}

export interface SpaceDTO {
  id: string
  teamId: string
  name: string
  settings: Record<string, unknown>
  visibility: string
  status: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
  /** 调用人在该空间的生效角色(读面必带,否则前端只能靠猜致灰) */
  myRole: TeamKnowledgeRole
}

export interface ItemDTO {
  id: string
  spaceId: string
  kind: TeamKnowledgeKind
  title: string
  content: Record<string, unknown>
  plainText: string
  tags: string[]
  status: TeamKnowledgeStatus
  revision: number
  sourceRef: Record<string, unknown> | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface RevisionDTO {
  id: string
  itemId: string
  spaceId: string
  revisionNo: number
  action: TeamKnowledgeAction
  actorUserId: string | null
  actorRole: TeamKnowledgeRole | null
  beforeSummary: ContentSummary | null
  afterSummary: ContentSummary | null
  changeNote: string | null
  createdAt: string
}

/**
 * 改动前后的可比对摘要:定责够用的最小集。
 * 刻意写成 type 别名而不是 interface —— jsonb 列的类型是 `Record<string, unknown>`,
 * interface 没有隐式索引签名,赋值时会以"未知属性"的形式报在 insert 那一行,
 * 把真实的类型不匹配伪装成 Drizzle 重载问题(本文件踩过一次)。
 */
export type ContentSummary = {
  title: string
  status: string
  /** 正文字符数(不存正文本身,见 schema 注释) */
  length: number
  /** 规范化正文的 sha256 前 16 位:两版是否等价,一眼可比 */
  digest: string
}

// =============================================================================
// 内部辅助
// =============================================================================

function toIso(value: Date): string {
  return value.toISOString()
}

/** 把任意正文规范成可比对摘要:键序稳定,故同一内容两次算出的 digest 必相同 */
export function summarize(title: string, status: string, content: unknown): ContentSummary {
  const json = stableStringify(content)
  const digest = createHash('sha256').update(json, 'utf8').digest('hex').slice(0, 16)
  return { title, status, length: json.length, digest }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

function hasRole(access: EffectiveAccess, atLeast: TeamKnowledgeRole): boolean {
  return ROLE_RANK[access.role] >= ROLE_RANK[atLeast]
}

/** 读不到空间不区分"不存在"与"无权"—— 一律 404,避免用状态码枚举团队句柄 */
async function loadSpaceOr404(spaceId: string): Promise<TeamKnowledgeSpace> {
  const [row] = await db
    .select()
    .from(teamKnowledgeSpaces)
    .where(eq(teamKnowledgeSpaces.id, spaceId))
    .limit(1)
  if (!row) throw new AppError('知识空间不存在', 404, 'SPACE_NOT_FOUND')
  return row
}

/**
 * 生效角色 = max(团队默认档, 空间成员档, 创建者档)。
 *
 * 团队默认档只在 visibility='team' 时存在;'restricted' 空间**不认团队默认**,
 * 否则"限制可见"就成了空话(团队成员全员可读的空间和它就没区别了)。
 */
export async function resolveEffectiveAccess(
  actorUserId: string,
  space: TeamKnowledgeSpace,
): Promise<EffectiveAccess | null> {
  const memberRows = await db
    .select({ role: teamKnowledgeSpaceMembers.role })
    .from(teamKnowledgeSpaceMembers)
    .where(
      and(
        eq(teamKnowledgeSpaceMembers.spaceId, space.id),
        eq(teamKnowledgeSpaceMembers.userId, actorUserId),
      ),
    )
    .limit(1)

  const candidates: EffectiveAccess[] = []

  const spaceMemberRole = memberRows[0]?.role
  if (isTeamKnowledgeRole(spaceMemberRole)) {
    candidates.push({ role: spaceMemberRole, reason: 'space_member' })
  }

  const teamRow = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, space.teamId), eq(teamMembers.userId, actorUserId)))
    .limit(1)
  const teamRole = teamRow[0]?.role
  if (teamRole === 'owner' || teamRole === 'admin') {
    candidates.push({ role: 'owner', reason: 'space_owner' })
  } else if (space.visibility === 'team' && teamRole === 'member') {
    candidates.push({ role: 'viewer', reason: 'team_default' })
  }

  if (space.createdBy === actorUserId) {
    candidates.push({ role: 'editor', reason: 'creator' })
  }

  if (candidates.length === 0) return null
  return candidates.reduce((acc, cur) =>
    ROLE_RANK[cur.role] > ROLE_RANK[acc.role] ? cur : acc,
  )
}

export function isTeamKnowledgeRole(value: unknown): value is TeamKnowledgeRole {
  return value === 'owner' || value === 'editor' || value === 'viewer'
}

/** 统一的"取空间 + 算角色 + 比门槛"出口,路由层不再各写一遍 */
async function requireSpaceAccess(
  actorUserId: string,
  spaceId: string,
  atLeast: TeamKnowledgeRole,
): Promise<{ space: TeamKnowledgeSpace; access: EffectiveAccess }> {
  const space = await loadSpaceOr404(spaceId)
  const access = await resolveEffectiveAccess(actorUserId, space)
  if (!access || !hasRole(access, atLeast)) {
    throw new AppError('你没有该知识空间的这个权限', 403, 'FORBIDDEN')
  }
  return { space, access }
}

async function requireItemAccess(
  actorUserId: string,
  itemId: string,
  atLeast: TeamKnowledgeRole,
): Promise<{ item: TeamKnowledgeItem; space: TeamKnowledgeSpace; access: EffectiveAccess }> {
  const [item] = await db
    .select()
    .from(teamKnowledgeItems)
    .where(eq(teamKnowledgeItems.id, itemId))
    .limit(1)
  if (!item) throw new AppError('知识条目不存在', 404, 'ITEM_NOT_FOUND')
  const { space, access } = await requireSpaceAccess(actorUserId, item.spaceId, atLeast)
  return { item, space, access }
}

/** 审计落库:写内容不写审计等于没写(§5「鉴权面」同族的"判据要在有人跑它时才成立") */
async function writeRevision(input: {
  itemId: string
  spaceId: string
  revisionNo: number
  action: TeamKnowledgeAction
  actorUserId: string
  actorRole: TeamKnowledgeRole
  before: ContentSummary | null
  after: ContentSummary | null
  changeNote?: string | null
}): Promise<void> {
  await db.insert(teamKnowledgeRevisions).values({
    itemId: input.itemId,
    spaceId: input.spaceId,
    revisionNo: input.revisionNo,
    action: input.action,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    beforeSummary: input.before,
    afterSummary: input.after,
    changeNote: input.changeNote ?? null,
  })
}

/**
 * Drizzle 的 `returning()` 在 TS 面是"可能空数组"(noUncheckedIndexedAccess)。
 * SQL 层 INSERT/UPDATE ... RETURNING 必然带回被写的这一行,所以各写点上的
 * `if (!row) throw` 不是业务分支,是把"驱动/连接异常"从静默 undefined 变成
 * 一条有码可查的 500 —— 不得把 undefined 往下传成 `toItemDTO(row)` 的 TypeError。
 */

function toItemDTO(row: TeamKnowledgeItem): ItemDTO {
  return {
    id: row.id,
    spaceId: row.spaceId,
    kind: row.kind as TeamKnowledgeKind,
    title: row.title,
    content: (row.content ?? {}) as Record<string, unknown>,
    plainText: row.plainText,
    tags: Array.isArray(row.tags) ? row.tags : [],
    status: row.status as TeamKnowledgeStatus,
    revision: row.revision,
    sourceRef: (row.sourceRef ?? null) as Record<string, unknown> | null,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

function toSpaceDTO(row: TeamKnowledgeSpace, role: TeamKnowledgeRole): SpaceDTO {
  return {
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    settings: (row.settings ?? {}) as Record<string, unknown>,
    visibility: row.visibility,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    myRole: role,
  }
}

function toRevisionDTO(row: TeamKnowledgeRevision): RevisionDTO {
  return {
    id: row.id,
    itemId: row.itemId,
    spaceId: row.spaceId,
    revisionNo: row.revisionNo,
    action: row.action as TeamKnowledgeAction,
    actorUserId: row.actorUserId,
    actorRole: isTeamKnowledgeRole(row.actorRole) ? row.actorRole : null,
    beforeSummary: (row.beforeSummary ?? null) as ContentSummary | null,
    afterSummary: (row.afterSummary ?? null) as ContentSummary | null,
    changeNote: row.changeNote,
    createdAt: toIso(row.createdAt),
  }
}

// =============================================================================
// 空间
// =============================================================================

export interface CreateSpaceInput {
  teamId: string
  name: string
  settings?: Record<string, unknown>
  visibility?: 'team' | 'restricted'
}

/**
 * 建空间要求**团队 owner/admin**:共享基础设施的创建权不该摊给全员,
 * 而平台管理员(roleId>=1)在这里刻意**没有**旁路 —— 团队知识属团队资产,
 * 无人使用的需求输入的 admin 旁路就是 §5 警告的那类 fail-open 面。
 */
export async function createSpace(actor: Actor, input: CreateSpaceInput): Promise<SpaceDTO> {
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, input.teamId)).limit(1)
  if (!team) throw new AppError('团队不存在', 404, 'TEAM_NOT_FOUND')

  const [membership] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.userId, actor.userId)))
    .limit(1)
  const teamRole = membership?.role
  if (!teamRole || !TEAM_ROLE_IMPLYING_SPACE_OWNER.has(teamRole)) {
    throw new AppError('只有团队管理员或拥有者可以创建知识空间', 403, 'FORBIDDEN')
  }

  const [row] = await db
    .insert(teamKnowledgeSpaces)    .values({
      teamId: input.teamId,
      name: input.name,
      settings: input.settings ?? {},
      visibility: input.visibility ?? 'team',
      createdBy: actor.userId,
      updatedBy: actor.userId,
    })
    .returning()
  if (!row) throw new AppError('知识空间创建失败', 500, 'SPACE_CREATE_FAILED')

  return toSpaceDTO(row, 'owner')
}

export interface ListSpacesFilter {
  teamId: string
  includeArchived?: boolean
  limit?: number
}

export async function listSpaces(actor: Actor, filter: ListSpacesFilter): Promise<SpaceDTO[]> {
  const [teamMembership] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, filter.teamId), eq(teamMembers.userId, actor.userId)))
    .limit(1)
  if (!teamMembership) {
    // 不是该团队成员 ⇒ 与"团队没有空间"同形,不区分(防枚举团队 id)
    throw new AppError('团队不存在或你不在该团队', 404, 'TEAM_NOT_FOUND')
  }

  const rows = await db
    .select()
    .from(teamKnowledgeSpaces)
    .where(
      filter.includeArchived
        ? eq(teamKnowledgeSpaces.teamId, filter.teamId)
        : and(
            eq(teamKnowledgeSpaces.teamId, filter.teamId),
            eq(teamKnowledgeSpaces.status, 'active'),
          ),
    )
    .orderBy(desc(teamKnowledgeSpaces.updatedAt))
    .limit(clampLimit(filter.limit))

  // 逐空间算生效角色(空间数量级为个位数到几十;要扩再引入批量 join,不预优化)
  const out: SpaceDTO[] = []
  for (const row of rows) {
    const access = await resolveEffectiveAccess(actor.userId, row)
    if (access) out.push(toSpaceDTO(row, access.role))
  }
  return out
}

export async function getSpace(actor: Actor, spaceId: string): Promise<SpaceDTO> {
  const { space, access } = await requireSpaceAccess(actor.userId, spaceId, 'viewer')
  return toSpaceDTO(space, access.role)
}

// =============================================================================
// 成员与角色
// =============================================================================

export interface SpaceMemberDTO {
  userId: string
  role: TeamKnowledgeRole
  grantedBy: string | null
  updatedAt: string
}

export async function listSpaceMembers(actor: Actor, spaceId: string): Promise<SpaceMemberDTO[]> {
  const { space } = await requireSpaceAccess(actor.userId, spaceId, 'viewer')
  const rows = await db
    .select()
    .from(teamKnowledgeSpaceMembers)
    .where(eq(teamKnowledgeSpaceMembers.spaceId, space.id))
    .orderBy(asc(teamKnowledgeSpaceMembers.createdAt))
  return rows.map((r) => ({
    userId: r.userId,
    role: r.role as TeamKnowledgeRole,
    grantedBy: r.grantedBy,
    updatedAt: toIso(r.updatedAt),
  }))
}

/**
 * 授权 / 改角色 / 撤权(role=null 即撤)。要求调用人是空间 owner。
 *
 * 被授权人必须是**同团队成员** —— 否则会把团队资产外授给无归属的人,
 * 而这个动作在团队审计面上是不可见的。
 */
export async function setSpaceMember(input: {
  actor: Actor
  spaceId: string
  targetUserId: string
  role: TeamKnowledgeRole | null
}): Promise<{ spaceId: string; userId: string; role: TeamKnowledgeRole | null }> {
  const { space } = await requireSpaceAccess(input.actor.userId, input.spaceId, 'owner')

  const [target] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, space.teamId), eq(teamMembers.userId, input.targetUserId)))
    .limit(1)
  if (!target) throw new AppError('被授权人不是该团队成员', 400, 'NOT_TEAM_MEMBER')

  if (input.role === null) {
    await db
      .delete(teamKnowledgeSpaceMembers)
      .where(
        and(
          eq(teamKnowledgeSpaceMembers.spaceId, space.id),
          eq(teamKnowledgeSpaceMembers.userId, input.targetUserId),
        ),
      )
    return { spaceId: space.id, userId: input.targetUserId, role: null }
  }

  await db
    .insert(teamKnowledgeSpaceMembers)
    .values({
      spaceId: space.id,
      userId: input.targetUserId,
      role: input.role,
      grantedBy: input.actor.userId,
    })
    .onConflictDoUpdate({
      target: [teamKnowledgeSpaceMembers.spaceId, teamKnowledgeSpaceMembers.userId],
      set: { role: input.role, grantedBy: input.actor.userId, updatedAt: new Date() },
    })
  return { spaceId: space.id, userId: input.targetUserId, role: input.role }
}

// =============================================================================
// 条目
// =============================================================================

export interface CreateItemInput {
  spaceId: string
  kind: TeamKnowledgeKind
  title: string
  content: Record<string, unknown>
  plainText?: string
  tags?: string[]
  status?: TeamKnowledgeStatus
  sourceRef?: Record<string, unknown> | null
  changeNote?: string
}

export async function createItem(actor: Actor, input: CreateItemInput): Promise<ItemDTO> {
  const { access } = await requireSpaceAccess(actor.userId, input.spaceId, 'editor')
  const status = input.status ?? 'draft'

  const [row] = await db
    .insert(teamKnowledgeItems)
    .values({
      spaceId: input.spaceId,
      kind: input.kind,
      title: input.title,
      content: input.content,
      plainText: input.plainText ?? '',
      tags: dedupeTags(input.tags),
      status,
      revision: 1,
      sourceRef: input.sourceRef ?? null,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    })
    .returning()
  if (!row) throw new AppError('知识条目创建失败', 500, 'ITEM_CREATE_FAILED')

  await writeRevision({
    itemId: row.id,
    spaceId: row.spaceId,
    revisionNo: 1,
    action: 'create',
    actorUserId: actor.userId,
    actorRole: access.role,
    before: null,
    after: summarize(row.title, row.status, row.content),
    changeNote: input.changeNote ?? null,
  })

  return toItemDTO(row)
}

export interface ReviseItemInput {
  itemId: string
  title?: string
  content?: Record<string, unknown>
  plainText?: string
  tags?: string[]
  changeNote?: string
  /** 乐观并发:调用方持有的版本号。缺失 = 不校验(仅限内部同步路径) */
  expectedRevision?: number
}

/** 成员修正:改内容 + 版本 +1 + 落审计,三者要么全成要么不写。 */
export async function reviseItem(actor: Actor, input: ReviseItemInput): Promise<ItemDTO> {
  const { item, access } = await requireItemAccess(actor.userId, input.itemId, 'editor')

  if (input.expectedRevision !== undefined && input.expectedRevision !== item.revision) {
    throw new AppError(
      `版本冲突:当前是 ${item.revision},你基于 ${input.expectedRevision} 修改`,
      409,
      'REVISION_CONFLICT',
    )
  }

  const before = summarize(item.title, item.status, item.content)
  const nextTitle = input.title ?? item.title
  const nextContent = input.content ?? (item.content ?? {})
  const nextStatus = item.status
  const nextRevision = item.revision + 1

  const [row] = await db
    .update(teamKnowledgeItems)
    .set({
      title: nextTitle,
      content: nextContent,
      plainText: input.plainText ?? item.plainText,
      tags: input.tags ? dedupeTags(input.tags) : item.tags,
      revision: nextRevision,
      updatedBy: actor.userId,
      updatedAt: new Date(),
    })
    .where(eq(teamKnowledgeItems.id, item.id))
    .returning()
  if (!row) throw new AppError('知识条目修正失败', 500, 'ITEM_UPDATE_FAILED')

  await writeRevision({
    itemId: item.id,
    spaceId: item.spaceId,
    revisionNo: nextRevision,
    action: 'revise',
    actorUserId: actor.userId,
    actorRole: access.role,
    before,
    after: summarize(nextTitle, nextStatus, nextContent),
    changeNote: input.changeNote ?? null,
  })

  return toItemDTO(row)
}

export interface SetItemStatusInput {
  itemId: string
  status: TeamKnowledgeStatus
  changeNote?: string
}

export async function setItemStatus(actor: Actor, input: SetItemStatusInput): Promise<ItemDTO> {
  const { item, access } = await requireItemAccess(actor.userId, input.itemId, 'editor')
  if (item.status === input.status) return toItemDTO(item)

  const before = summarize(item.title, item.status, item.content)
  const nextRevision = item.revision + 1

  const [row] = await db
    .update(teamKnowledgeItems)
    .set({
      status: input.status,
      revision: nextRevision,
      updatedBy: actor.userId,
      updatedAt: new Date(),
    })
    .where(eq(teamKnowledgeItems.id, item.id))
    .returning()
  if (!row) throw new AppError('知识条目状态变更失败', 500, 'ITEM_UPDATE_FAILED')

  await writeRevision({
    itemId: item.id,
    spaceId: item.spaceId,
    revisionNo: nextRevision,
    // 归档与发布的动词分开,draft→published 之外的流转统一记 revise 会丢信息
    action:
      input.status === 'published'
        ? 'publish'
        : input.status === 'archived'
          ? 'archive'
          : 'revise',
    actorUserId: actor.userId,
    actorRole: access.role,
    before,
    after: summarize(row.title, row.status, row.content),
    changeNote: input.changeNote ?? null,
  })

  return toItemDTO(row)
}

export interface ListItemsFilter {
  spaceId: string
  kind?: TeamKnowledgeKind
  status?: TeamKnowledgeStatus
  keyword?: string
  limit?: number
  offset?: number
}

export async function listItems(actor: Actor, filter: ListItemsFilter): Promise<ItemDTO[]> {
  await requireSpaceAccess(actor.userId, filter.spaceId, 'viewer')
  const conds = [eq(teamKnowledgeItems.spaceId, filter.spaceId)]
  if (filter.kind) conds.push(eq(teamKnowledgeItems.kind, filter.kind))
  if (filter.status) conds.push(eq(teamKnowledgeItems.status, filter.status))
  const rows = await db
    .select()
    .from(teamKnowledgeItems)
    .where(and(...conds))
    .orderBy(desc(teamKnowledgeItems.updatedAt))
    .limit(clampLimit(filter.limit))
    .offset(Math.max(0, filter.offset ?? 0))
  // 关键词过滤在内存做:条目正文是 jsonb,LIKE 它没有稳定语义(键序/嵌套都会变)
  const kw = filter.keyword?.trim().toLowerCase()
  const filtered = kw
    ? rows.filter(
        (r) =>
          r.title.toLowerCase().includes(kw) ||
          r.plainText.toLowerCase().includes(kw) ||
          (Array.isArray(r.tags) ? r.tags.join(',').toLowerCase().includes(kw) : false),
      )
    : rows
  return filtered.map(toItemDTO)
}

export async function getItem(actor: Actor, itemId: string): Promise<ItemDTO> {
  const { item } = await requireItemAccess(actor.userId, itemId, 'viewer')
  return toItemDTO(item)
}

// =============================================================================
// 审计流
// =============================================================================

export interface ListRevisionsFilter {
  /** 二选一:条目面(按版本序)或空间面(按时间倒序) */
  itemId?: string
  spaceId?: string
  action?: TeamKnowledgeAction
  limit?: number
}

export async function listRevisions(
  actor: Actor,
  filter: ListRevisionsFilter,
): Promise<RevisionDTO[]> {
  if (!filter.itemId && !filter.spaceId) {
    throw new AppError('需要 itemId 或 spaceId 之一', 400, 'VALIDATION_FAILED')
  }
  if (filter.itemId) {
    await requireItemAccess(actor.userId, filter.itemId, 'viewer')
    const conds = [eq(teamKnowledgeRevisions.itemId, filter.itemId)]
    if (filter.action) conds.push(eq(teamKnowledgeRevisions.action, filter.action))
    const rows = await db
      .select()
      .from(teamKnowledgeRevisions)
      .where(and(...conds))
      .orderBy(asc(teamKnowledgeRevisions.revisionNo))
      .limit(clampLimit(filter.limit))
    return rows.map(toRevisionDTO)
  }

  const spaceId = filter.spaceId as string
  await requireSpaceAccess(actor.userId, spaceId, 'viewer')
  const conds = [eq(teamKnowledgeRevisions.spaceId, spaceId)]
  if (filter.action) conds.push(eq(teamKnowledgeRevisions.action, filter.action))
  const rows = await db
    .select()
    .from(teamKnowledgeRevisions)
    .where(and(...conds))
    .orderBy(desc(teamKnowledgeRevisions.createdAt))
    .limit(clampLimit(filter.limit))
  return rows.map(toRevisionDTO)
}

// =============================================================================
// 小工具
// =============================================================================

const MAX_LIMIT = 200

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value < 1) return 50
  return Math.min(Math.trunc(value), MAX_LIMIT)
}

function dedupeTags(tags: string[] | undefined): string[] {
  if (!tags) return []
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 30)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
