// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  integer,
  text,
} from 'drizzle-orm/pg-core'
import { teams } from './teams.js'
import { users } from './users.js'

/**
 * D29 团队级知识引擎(G-35)的存储层。
 *
 * 与既有三张表的关系(为什么不复用、也不改动它们):
 * - `team_memories`(2026-09-08)是"扁平共享记忆",隔离维度是自由字符串 `scopeId`,
 *   没有成员角色、没有版本、没有审计面 ⇒ 它承载不了"成员修正 + 过程审计";
 * - `repo_wiki_docs` / `knowledge_cards` 是**个人**资产(userId 归属),
 *   跨成员共享要靠本表这一层,而不是给旧表加 team 列(那会改动别人的既有语义)。
 * 所以本文件只**新增**四张表,通过 `sourceRef` 指回旧表,不反向修改它们。
 *
 * 权限模型(与守门 117「认证不等于授权」同一条禁令):
 * 角色一律由「令牌主体 + 本表成员行」查出来,**从不**采信请求里的 user_id / role。
 * owner 由创建空间的人自动获得(team_members 的 owner/admin 也映射为 owner)。
 */

/** 空间内角色;值域与 `TEAM_KNOWLEDGE_ROLES` 必须同形(服务层与路由都从这一处取) */
export const TEAM_KNOWLEDGE_ROLES = ['owner', 'editor', 'viewer'] as const
export type TeamKnowledgeRole = (typeof TEAM_KNOWLEDGE_ROLES)[number]

/** 知识条目类型:三类都是"团队可共享、可修正、可追溯"的一份正文 */
export const TEAM_KNOWLEDGE_KINDS = ['memory', 'wiki', 'card'] as const
export type TeamKnowledgeKind = (typeof TEAM_KNOWLEDGE_KINDS)[number]

export const TEAM_KNOWLEDGE_STATUSES = ['draft', 'published', 'archived'] as const
export type TeamKnowledgeStatus = (typeof TEAM_KNOWLEDGE_STATUSES)[number]

/**
 * 修订动作;审计流水的动词集,与前端展示词表解耦(前端按 key 取词,不复制枚举)。
 * 只登记**真会发生**的动词:没有物理删除(revisions 随条目级联是库内一致性,
 * 不是用户动作),所以这里刻意没有 'delete';权限变更由成员表的 grantedBy 定责,
 * 不混进条目审计流(那是"谁改了什么内容"的面,两张面混写会让流水读不出因果)。
 */
export const TEAM_KNOWLEDGE_ACTIONS = ['create', 'revise', 'publish', 'archive'] as const
export type TeamKnowledgeAction = (typeof TEAM_KNOWLEDGE_ACTIONS)[number]

/**
 * 团队知识空间:一个团队下多个并列空间(如「后端规范」「踩坑集」「产品 Wiki」)。
 *
 * `visibility`:
 * - 'team'      团队成员默认可读(读权限来自 team_members,不逐人登记)
 * - 'restricted' 只有本空间成员可读(成员表是唯一读凭据)
 * 刻意不做'public':未登录可读会撞上 §5「鉴权面公开化必须显式列举」那一整类风险,
 * 而本票没有任何"公开知识页"的需求输入。
 */
export const teamKnowledgeSpaces = pgTable(
  'team_knowledge_spaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .references(() => teams.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    /** 空间级配置:自动同步开关、审计保留期、默认落地类型等。结构由服务层 zod 收口 */
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
    visibility: varchar('visibility', { length: 20 }).default('team').notNull(),
    /** 归档标记:不物理删除(§7 删除安全),归档后读面默认排除 */
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    teamIdx: index('ix_team_knowledge_spaces_team').on(t.teamId),
    teamStatusIdx: index('ix_team_knowledge_spaces_team_status').on(t.teamId, t.status),
  }),
)

/**
 * 空间成员与角色。
 *
 * 只登记"超出团队默认权限"的那部分:restricted 空间的读凭据、editor/owner 的写凭据。
 * (team_id, user_id) 不同,这里唯一键是 (space_id, user_id) —— 一个用户在一个空间一行。
 */
export const teamKnowledgeSpaceMembers = pgTable(
  'team_knowledge_space_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    spaceId: uuid('space_id')
      .references(() => teamKnowledgeSpaces.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: varchar('role', { length: 20 }).default('viewer').notNull(),
    /** 谁给的权限 —— 审计链的一环,授权动作本身也写 revisions 流水 */
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    spaceUserUx: uniqueIndex('ux_team_knowledge_space_members_space_user').on(
      t.spaceId,
      t.userId,
    ),
    userIdx: index('ix_team_knowledge_space_members_user').on(t.userId),
  }),
)

/**
 * 知识条目:正文用 jsonb 承载(三类各自的富结构),另存一份 plainText 供检索/摘要。
 *
 * `revision` 是**当前**版本号,每次成功修正 +1,与 `team_knowledge_revisions.revision_no`
 * 对得上;历史正文不在这张表里滚存,只在修订表里滚存。
 * `sourceRef` 指回来源资产(repo_wiki_docs.id / knowledge_cards.id / team_memories.id),
 * 用 jsonb 而不是外键,因为它跨三张不同的表 —— 加三个可空外键会让"哪一个是真的"变成运行时问题。
 */
export const teamKnowledgeItems = pgTable(
  'team_knowledge_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    spaceId: uuid('space_id')
      .references(() => teamKnowledgeSpaces.id, { onDelete: 'cascade' })
      .notNull(),
    kind: varchar('kind', { length: 20 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().default({}).notNull(),
    plainText: text('plain_text').notNull().default(''),
    tags: jsonb('tags').$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    revision: integer('revision').default(1).notNull(),
    sourceRef: jsonb('source_ref').$type<Record<string, unknown> | null>(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    spaceIdx: index('ix_team_knowledge_items_space').on(t.spaceId),
    spaceKindIdx: index('ix_team_knowledge_items_space_kind').on(t.spaceId, t.kind),
    spaceStatusIdx: index('ix_team_knowledge_items_space_status').on(t.spaceId, t.status),
    updatedAtIdx: index('ix_team_knowledge_items_updated_at').on(t.updatedAt),
  }),
)

/**
 * 过程审计:谁(who)在什么时候(when)对哪一条做了什么,改动前后的摘要各存一份。
 *
 * 只存**摘要**不存全文:全文滚存会让这张表按条目数×版本数无界增长,而审计要回答的是
 * "谁改的 / 改成了什么样 / 从什么样改的",摘要(标题、字数、内容哈希)已经足够定责与比对。
 * 需要找回旧正文的场景目前没有产品输入;真要找回时也应走备份,而不是让在线表替它兜底。
 */
export const teamKnowledgeRevisions = pgTable(
  'team_knowledge_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    itemId: uuid('item_id')
      .references(() => teamKnowledgeItems.id, { onDelete: 'cascade' })
      .notNull(),
    /** 冗余一份空间维度,使"按空间看审计流"不必 join 条目表 */
    spaceId: uuid('space_id').notNull(),
    revisionNo: integer('revision_no').notNull(),
    action: varchar('action', { length: 20 }).notNull(),
    /** 令牌主体,不接受请求传入;为 null 只可能是账号已注销 */
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** 落库时快照的角色 —— 事后改权限不得改写历史审计 */
    actorRole: varchar('actor_role', { length: 20 }),
    beforeSummary: jsonb('before_summary').$type<Record<string, unknown> | null>(),
    afterSummary: jsonb('after_summary').$type<Record<string, unknown> | null>(),
    changeNote: text('change_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    itemRevisionUx: uniqueIndex('ux_team_knowledge_revisions_item_revision').on(
      t.itemId,
      t.revisionNo,
    ),
    spaceTimeIdx: index('ix_team_knowledge_revisions_space_time').on(t.spaceId, t.createdAt),
    actorIdx: index('ix_team_knowledge_revisions_actor').on(t.actorUserId),
  }),
)

/**
 * 空间成员与团队成员的桥接视图用途:服务层需要"某人在某空间的生效角色",
 * 它由两张表算出(team_members 的 owner/admin ⇒ 空间 owner;restricted 空间 ⇒ 只认成员表)。
 * 这里不放 SQL 视图(迁移面加视图会让 49 号门的空库重放多一个未知量),
 * 计算逻辑单点在 `knowledge-team-service.ts` 的 `resolveEffectiveRole()`。
 */

export type TeamKnowledgeSpace = typeof teamKnowledgeSpaces.$inferSelect
export type NewTeamKnowledgeSpace = typeof teamKnowledgeSpaces.$inferInsert
export type TeamKnowledgeSpaceMember = typeof teamKnowledgeSpaceMembers.$inferSelect
export type NewTeamKnowledgeSpaceMember = typeof teamKnowledgeSpaceMembers.$inferInsert
export type TeamKnowledgeItem = typeof teamKnowledgeItems.$inferSelect
export type NewTeamKnowledgeItem = typeof teamKnowledgeItems.$inferInsert
export type TeamKnowledgeRevision = typeof teamKnowledgeRevisions.$inferSelect
export type NewTeamKnowledgeRevision = typeof teamKnowledgeRevisions.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
