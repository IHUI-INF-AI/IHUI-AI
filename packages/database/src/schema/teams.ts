import { pgTable, uuid, varchar, timestamp, text, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 团队表。
 * owner_id 为团队创建者，拥有最高权限（删除团队等）。
 */
export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  description: text('description'),
  ownerId: uuid('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  avatar: varchar('avatar', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 团队成员表。
 * role: 'owner' | 'admin' | 'member'，团队创建者首次写入 owner。
 * (team_id, user_id) 联合唯一：一个用户在同一团队只占一条记录。
 */
export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .references(() => teams.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: varchar('role', { length: 32 }).default('member').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    teamUserUnique: unique().on(t.teamId, t.userId),
  }),
);

/**
 * 团队邀请表。
 * status: 'pending' | 'accepted' | 'rejected' | 'cancelled'。
 * invitee_id 与 email 二选一：invitee_id 用于站内已注册用户，email 用于邮箱邀请。
 */
export const teamInvitations = pgTable('team_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id')
    .references(() => teams.id, { onDelete: 'cascade' })
    .notNull(),
  inviterId: uuid('inviter_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  inviteeId: uuid('invitee_id').references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }),
  token: varchar('token', { length: 128 }).notNull().unique(),
  status: varchar('status', { length: 32 }).default('pending').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type NewTeamInvitation = typeof teamInvitations.$inferInsert;
