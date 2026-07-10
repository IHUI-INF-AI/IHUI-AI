import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from './index.js';
import {
  oauthApps,
  oauthSessions,
  oauthUsers,
  oauthAuditLogs,
  oauthScopeMeta,
  userThirdPartyAccounts,
  userSk,
} from '@ihui/database';

// ============================================================================
// OAuth Apps
// ============================================================================

export async function findOAuthAppByClientId(clientId: string) {
  const rows = await db.select().from(oauthApps).where(eq(oauthApps.clientId, clientId)).limit(1);
  return rows[0];
}

export async function createOAuthApp(input: {
  clientId: string;
  clientSecret: string;
  name: string;
  description?: string;
  redirectUris: string[];
  scopes?: string[];
  icon?: string;
  ownerUuid: string;
}) {
  const [app] = await db
    .insert(oauthApps)
    .values({
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      name: input.name,
      description: input.description,
      redirectUris: input.redirectUris,
      scopes: input.scopes ?? [],
      icon: input.icon,
      ownerUuid: input.ownerUuid,
      isActive: 1,
    })
    .returning();
  return app;
}

export async function listOAuthApps(ownerUuid: string, page: number, limit: number) {
  const where = eq(oauthApps.ownerUuid, ownerUuid);
  const rows = await db
    .select()
    .from(oauthApps)
    .where(where)
    .orderBy(desc(oauthApps.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  const countRows = await db.select({ count: sql<number>`count(*)::int` }).from(oauthApps).where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: rows, total: count };
}

export async function deleteOAuthApp(clientId: string, ownerUuid: string) {
  await db
    .delete(oauthApps)
    .where(and(eq(oauthApps.clientId, clientId), eq(oauthApps.ownerUuid, ownerUuid)));
}

// ============================================================================
// OAuth Sessions (授权码)
// ============================================================================

export async function createOAuthSession(input: {
  code: string;
  clientId: string;
  userId: string;
  state: string;
  scope?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}) {
  const [session] = await db
    .insert(oauthSessions)
    .values({
      code: input.code,
      clientId: input.clientId,
      userId: input.userId,
      state: input.state,
      scope: input.scope,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    })
    .returning();
  return session;
}

export async function findSessionByCode(code: string) {
  const rows = await db.select().from(oauthSessions).where(eq(oauthSessions.code, code)).limit(1);
  return rows[0];
}

export async function markSessionUsed(code: string) {
  await db.update(oauthSessions).set({ isUsed: true }).where(eq(oauthSessions.code, code));
}

export async function listUserSessions(userId: string) {
  return db
    .select()
    .from(oauthSessions)
    .where(and(eq(oauthSessions.userId, userId), eq(oauthSessions.isUsed, false)))
    .orderBy(desc(oauthSessions.createdAt));
}

export async function deleteSession(id: string) {
  await db.delete(oauthSessions).where(eq(oauthSessions.id, id));
}

// ============================================================================
// OAuth Users (provider 映射)
// ============================================================================

export async function findOAuthUser(provider: string, providerUserId: string) {
  const rows = await db
    .select()
    .from(oauthUsers)
    .where(and(eq(oauthUsers.provider, provider), eq(oauthUsers.providerUserId, providerUserId)))
    .limit(1);
  return rows[0];
}

export async function listOAuthUsers(userId: string) {
  return db.select().from(oauthUsers).where(eq(oauthUsers.userId, userId));
}

// ============================================================================
// Scope Meta
// ============================================================================

export async function listActiveScopeMeta() {
  return db
    .select()
    .from(oauthScopeMeta)
    .where(eq(oauthScopeMeta.isActive, 1))
    .orderBy(oauthScopeMeta.sortOrder);
}

// ============================================================================
// Third-party Accounts (绑定)
// ============================================================================

export async function findThirdPartyAccount(platform: string, openId: string) {
  const rows = await db
    .select()
    .from(userThirdPartyAccounts)
    .where(
      and(
        eq(userThirdPartyAccounts.platform, platform),
        eq(userThirdPartyAccounts.openId, openId),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function listUserBindings(userId: string) {
  return db
    .select()
    .from(userThirdPartyAccounts)
    .where(
      and(
        eq(userThirdPartyAccounts.userId, userId),
        sql`${userThirdPartyAccounts.deletedAt} IS NULL`,
      ),
    );
}

export async function createThirdPartyBinding(input: {
  userId: string;
  openId: string;
  unionId?: string;
  platform: string;
  accessToken?: string;
  refreshToken?: string;
}) {
  const [binding] = await db
    .insert(userThirdPartyAccounts)
    .values({
      userId: input.userId,
      openId: input.openId,
      unionId: input.unionId,
      platform: input.platform,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
    })
    .returning();
  return binding;
}

export async function removeBinding(id: string, userId: string) {
  await db
    .update(userThirdPartyAccounts)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(userThirdPartyAccounts.id, id),
        eq(userThirdPartyAccounts.userId, userId),
      ),
    );
}

export async function removeBindingByPlatform(userId: string, platform: string) {
  await db
    .update(userThirdPartyAccounts)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(userThirdPartyAccounts.userId, userId),
        eq(userThirdPartyAccounts.platform, platform),
      ),
    );
}

// ============================================================================
// User SK
// ============================================================================

export async function createUserSk(userId: string, key: string) {
  const [sk] = await db.insert(userSk).values({ userId, key, status: 1 }).returning();
  return sk;
}

export async function listUserSk(userId: string, page: number, limit: number) {
  const where = eq(userSk.userId, userId);
  const rows = await db
    .select()
    .from(userSk)
    .where(where)
    .orderBy(desc(userSk.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  const countRows = await db.select({ count: sql<number>`count(*)::int` }).from(userSk).where(where);
  const count = countRows[0]?.count ?? 0;
  return { items: rows, total: count };
}

export async function updateUserSk(id: string, userId: string, status: number) {
  await db
    .update(userSk)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(userSk.id, id), eq(userSk.userId, userId)));
}

export async function deleteUserSk(id: string, userId: string) {
  await db.delete(userSk).where(and(eq(userSk.id, id), eq(userSk.userId, userId)));
}

// ============================================================================
// OAuth Audit Log
// ============================================================================

export async function createAuditLog(input: {
  event: string;
  clientId?: string;
  userId?: string;
  ip?: string;
  status?: string;
  detail?: string;
}) {
  await db.insert(oauthAuditLogs).values(input);
}

export async function findAuditLogList(params: {
  page?: number;
  limit?: number;
  clientId?: string;
  event?: string;
  status?: string;
  userId?: string;
}): Promise<{ items: typeof oauthAuditLogs.$inferSelect[]; total: number }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const conds = [];
  if (params.clientId) conds.push(eq(oauthAuditLogs.clientId, params.clientId));
  if (params.event) conds.push(eq(oauthAuditLogs.event, params.event));
  if (params.status) conds.push(eq(oauthAuditLogs.status, params.status));
  if (params.userId) conds.push(eq(oauthAuditLogs.userId, params.userId));
  const where = conds.length ? and(...conds) : undefined;
  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(oauthAuditLogs)
      .where(where)
      .orderBy(desc(oauthAuditLogs.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: sql<number>`count(*)::int` }).from(oauthAuditLogs).where(where),
  ]);
  return { items, total: totalRows[0]?.count ?? 0 };
}

export async function findAuditLogStats(): Promise<{
  total: number;
  successCount: number;
  failCount: number;
}> {
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      successCount: sql<number>`count(*) filter (where ${oauthAuditLogs.status} = 'success')::int`,
      failCount: sql<number>`count(*) filter (where ${oauthAuditLogs.status} != 'success')::int`,
    })
    .from(oauthAuditLogs);
  const r = rows[0];
  return {
    total: r?.total ?? 0,
    successCount: r?.successCount ?? 0,
    failCount: r?.failCount ?? 0,
  };
}
