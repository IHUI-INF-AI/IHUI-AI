import { randomUUID } from 'node:crypto';
import { eq, and, desc, sql, asc } from 'drizzle-orm';
import { db } from './index.js';
import {
  customerServiceCategories,
  customerServiceTickets,
  customerServiceComments,
  customerServiceAgents,
  customerServiceSessions,
  customerServiceRatings,
  type CustomerServiceCategory,
  type CustomerServiceTicket,
  type CustomerServiceComment,
  type CustomerServiceAgent,
  type CustomerServiceSession,
  type CustomerServiceRating,
} from '@ihui/database';

// =============================================================================
// 辅助：生成工单号 / 会话号
// =============================================================================

/** 生成工单号: CS + yyyyMMddHHmmss + uuid 前 6 位(大写)。 */
export function genTicketNo(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  return 'CS' + ts + randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
}

/** 生成会话号: SESS + uuid 去横线前 16 位。 */
export function genSessionId(): string {
  return 'SESS' + randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
}

// =============================================================================
// Categories 分类
// =============================================================================

export async function findCategories(): Promise<CustomerServiceCategory[]> {
  return db
    .select()
    .from(customerServiceCategories)
    .orderBy(asc(customerServiceCategories.sortOrder), asc(customerServiceCategories.name));
}

export async function findCategoryBySlug(slug: string): Promise<CustomerServiceCategory | undefined> {
  const rows = await db
    .select()
    .from(customerServiceCategories)
    .where(eq(customerServiceCategories.slug, slug))
    .limit(1);
  return rows[0];
}

export interface CreateCategoryInput {
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number;
}

export async function createCategory(data: CreateCategoryInput): Promise<CustomerServiceCategory> {
  const rows = await db
    .insert(customerServiceCategories)
    .values({
      name: data.name,
      slug: data.slug,
      description: data.description,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建分类失败');
  return row;
}

// =============================================================================
// Tickets 工单
// =============================================================================

export interface CreateTicketInput {
  userId: string;
  categoryId?: string | null;
  title: string;
  description: string;
  priority?: string;
  source?: string;
  attachments?: unknown[];
}

export async function createTicket(data: CreateTicketInput): Promise<CustomerServiceTicket> {
  const rows = await db
    .insert(customerServiceTickets)
    .values({
      ticketNo: genTicketNo(),
      userId: data.userId,
      categoryId: data.categoryId,
      title: data.title,
      description: data.description,
      status: 'pending',
      priority: data.priority ?? 'medium',
      source: data.source ?? 'web',
      attachments: data.attachments ?? [],
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建工单失败');
  return row;
}

export async function findTicketById(id: string): Promise<CustomerServiceTicket | undefined> {
  const rows = await db
    .select()
    .from(customerServiceTickets)
    .where(eq(customerServiceTickets.id, id))
    .limit(1);
  return rows[0];
}

export interface ListTicketsOpts {
  page: number;
  pageSize: number;
  status?: string;
  categoryId?: string;
  userId?: string;
  assigneeId?: string;
  priority?: string;
}

export async function findTickets(
  opts: ListTicketsOpts,
): Promise<{ list: CustomerServiceTicket[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, status, categoryId, userId, assigneeId, priority } = opts;
  const conds = [];
  if (status) conds.push(eq(customerServiceTickets.status, status));
  if (categoryId) conds.push(eq(customerServiceTickets.categoryId, categoryId));
  if (userId) conds.push(eq(customerServiceTickets.userId, userId));
  if (assigneeId) conds.push(eq(customerServiceTickets.assigneeId, assigneeId));
  if (priority) conds.push(eq(customerServiceTickets.priority, priority));

  const list = await db
    .select()
    .from(customerServiceTickets)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(customerServiceTickets.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customerServiceTickets)
    .where(conds.length ? and(...conds) : undefined);
  const total = countRows[0]?.count ?? 0;

  return { list, total, page, pageSize };
}

/** 工单状态流转：校验合法迁移并更新。返回更新后工单或 reason。 */
export async function transitionTicket(
  id: string,
  toStatus: string,
): Promise<{ ticket?: CustomerServiceTicket; reason?: 'not_found' | 'invalid_transition' }> {
  const existing = await findTicketById(id);
  if (!existing) return { reason: 'not_found' };

  const allowed: Record<string, string[]> = {
    pending: ['open', 'rejected', 'closed'],
    open: ['resolved', 'closed', 'rejected'],
    resolved: ['closed', 'open'],
    rejected: ['open', 'closed'],
    closed: ['open'],
  };
  const allowedNext = allowed[existing.status] ?? [];
  if (!allowedNext.includes(toStatus)) return { reason: 'invalid_transition' };

  const update: Partial<CustomerServiceTicket> = { status: toStatus, updatedAt: new Date() };
  if (toStatus === 'resolved') update.resolvedAt = new Date();
  if (toStatus === 'closed' && !existing.closedAt) update.closedAt = new Date();

  const rows = await db
    .update(customerServiceTickets)
    .set(update)
    .where(eq(customerServiceTickets.id, id))
    .returning();
  return { ticket: rows[0] };
}

/** 分配工单给坐席，同时将状态推进到 open（若当前为 pending）。 */
export async function assignTicket(
  id: string,
  agentId: string,
): Promise<{ ticket?: CustomerServiceTicket; reason?: 'not_found' }> {
  const existing = await findTicketById(id);
  if (!existing) return { reason: 'not_found' };

  const nextStatus = existing.status === 'pending' ? 'open' : existing.status;
  const rows = await db
    .update(customerServiceTickets)
    .set({ assigneeId: agentId, status: nextStatus, updatedAt: new Date() })
    .where(eq(customerServiceTickets.id, id))
    .returning();
  return { ticket: rows[0] };
}

export async function updateTicket(
  id: string,
  data: Partial<Pick<CustomerServiceTicket, 'title' | 'description' | 'priority' | 'categoryId' | 'status'>>,
): Promise<CustomerServiceTicket | undefined> {
  const rows = await db
    .update(customerServiceTickets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(customerServiceTickets.id, id))
    .returning();
  return rows[0];
}

export async function deleteTicket(id: string): Promise<void> {
  await db.delete(customerServiceTickets).where(eq(customerServiceTickets.id, id));
}

// =============================================================================
// Comments 评论
// =============================================================================

export interface CreateCommentInput {
  ticketId: string;
  userId: string;
  content: string;
  isAdmin?: boolean;
  attachments?: unknown[];
}

export async function createComment(data: CreateCommentInput): Promise<CustomerServiceComment> {
  const rows = await db
    .insert(customerServiceComments)
    .values({
      ticketId: data.ticketId,
      userId: data.userId,
      content: data.content,
      isAdmin: data.isAdmin ?? false,
      attachments: data.attachments ?? [],
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建评论失败');
  // 更新工单的 updatedAt
  await db
    .update(customerServiceTickets)
    .set({ updatedAt: new Date() })
    .where(eq(customerServiceTickets.id, data.ticketId));
  return row;
}

export async function findCommentsByTicket(ticketId: string): Promise<CustomerServiceComment[]> {
  return db
    .select()
    .from(customerServiceComments)
    .where(eq(customerServiceComments.ticketId, ticketId))
    .orderBy(asc(customerServiceComments.createdAt));
}

// =============================================================================
// Agents 坐席
// =============================================================================

export async function findAgents(status?: string): Promise<CustomerServiceAgent[]> {
  const conds = status ? [eq(customerServiceAgents.status, status)] : [];
  return db
    .select()
    .from(customerServiceAgents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(customerServiceAgents.nickname));
}

export async function findAgentById(id: string): Promise<CustomerServiceAgent | undefined> {
  const rows = await db
    .select()
    .from(customerServiceAgents)
    .where(eq(customerServiceAgents.id, id))
    .limit(1);
  return rows[0];
}

export async function findAgentByUserId(userId: string): Promise<CustomerServiceAgent | undefined> {
  const rows = await db
    .select()
    .from(customerServiceAgents)
    .where(eq(customerServiceAgents.userId, userId))
    .limit(1);
  return rows[0];
}

export interface CreateAgentInput {
  userId: string;
  nickname: string;
  avatar?: string | null;
  maxConcurrent?: number;
  skills?: string[];
}

export async function createAgent(data: CreateAgentInput): Promise<CustomerServiceAgent> {
  const rows = await db
    .insert(customerServiceAgents)
    .values({
      userId: data.userId,
      nickname: data.nickname,
      avatar: data.avatar,
      maxConcurrent: data.maxConcurrent ?? 5,
      skills: data.skills ?? [],
      status: 'offline',
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建坐席失败');
  return row;
}

export async function updateAgentStatus(id: string, status: string): Promise<CustomerServiceAgent | undefined> {
  const rows = await db
    .update(customerServiceAgents)
    .set({ status, updatedAt: new Date() })
    .where(eq(customerServiceAgents.id, id))
    .returning();
  return rows[0];
}

/** 选择一个空闲坐席（在线且未满载，按 currentLoad 升序）。返回 undefined 表示无可用坐席。 */
export async function pickAvailableAgent(): Promise<CustomerServiceAgent | undefined> {
  const rows = await db
    .select()
    .from(customerServiceAgents)
    .where(
      and(
        eq(customerServiceAgents.status, 'online'),
        sql`${customerServiceAgents.currentLoad} < ${customerServiceAgents.maxConcurrent}`,
      ),
    )
    .orderBy(asc(customerServiceAgents.currentLoad))
    .limit(1);
  return rows[0];
}

/** 增减坐席当前负载。 */
export async function adjustAgentLoad(id: string, delta: number): Promise<void> {
  await db
    .update(customerServiceAgents)
    .set({
      currentLoad: sql`GREATEST(${customerServiceAgents.currentLoad} + ${delta}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(customerServiceAgents.id, id));
}

// =============================================================================
// Sessions 会话
// =============================================================================

export async function findSessionBySessionId(sessionId: string): Promise<CustomerServiceSession | undefined> {
  const rows = await db
    .select()
    .from(customerServiceSessions)
    .where(eq(customerServiceSessions.sessionId, sessionId))
    .limit(1);
  return rows[0];
}

export async function findSessionById(id: string): Promise<CustomerServiceSession | undefined> {
  const rows = await db
    .select()
    .from(customerServiceSessions)
    .where(eq(customerServiceSessions.id, id))
    .limit(1);
  return rows[0];
}

export async function findWaitingSessions(): Promise<CustomerServiceSession[]> {
  return db
    .select()
    .from(customerServiceSessions)
    .where(eq(customerServiceSessions.status, 'waiting'))
    .orderBy(asc(customerServiceSessions.queuePosition), asc(customerServiceSessions.createdAt));
}

export async function findActiveSessionsByAgent(agentId: string): Promise<CustomerServiceSession[]> {
  return db
    .select()
    .from(customerServiceSessions)
    .where(and(eq(customerServiceSessions.agentId, agentId), eq(customerServiceSessions.status, 'active')));
}

export interface CreateSessionInput {
  userId: string;
  source?: string;
}

export async function createSession(data: CreateSessionInput): Promise<CustomerServiceSession> {
  // 计算排队位置（当前等待队列长度 + 1）
  const waitingCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customerServiceSessions)
    .where(eq(customerServiceSessions.status, 'waiting'));
  const position = (waitingCount[0]?.count ?? 0) + 1;

  const rows = await db
    .insert(customerServiceSessions)
    .values({
      sessionId: genSessionId(),
      userId: data.userId,
      source: data.source ?? 'web',
      status: 'waiting',
      queuePosition: position,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建会话失败');
  return row;
}

/** 为等待中的会话分配坐席：置 active、记录 startedAt、增加坐席负载。 */
export async function assignSession(
  sessionId: string,
  agentId: string,
): Promise<{ session?: CustomerServiceSession; reason?: 'not_found' | 'not_waiting' }> {
  const existing = await findSessionBySessionId(sessionId);
  if (!existing) return { reason: 'not_found' };
  if (existing.status !== 'waiting') return { reason: 'not_waiting' };

  const rows = await db
    .update(customerServiceSessions)
    .set({
      agentId,
      status: 'active',
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(customerServiceSessions.sessionId, sessionId))
    .returning();
  await adjustAgentLoad(agentId, 1);
  return { session: rows[0] };
}

export async function closeSession(sessionId: string): Promise<CustomerServiceSession | undefined> {
  const existing = await findSessionBySessionId(sessionId);
  const rows = await db
    .update(customerServiceSessions)
    .set({ status: 'closed', endedAt: new Date(), updatedAt: new Date() })
    .where(eq(customerServiceSessions.sessionId, sessionId))
    .returning();
  if (existing?.agentId) await adjustAgentLoad(existing.agentId, -1);
  return rows[0];
}

// =============================================================================
// Ratings 评级
// =============================================================================

export interface CreateRatingInput {
  ticketId?: string | null;
  sessionId?: string | null;
  userId: string;
  agentId?: string | null;
  rating: number;
  comment?: string | null;
}

export async function createRating(data: CreateRatingInput): Promise<CustomerServiceRating> {
  const rows = await db
    .insert(customerServiceRatings)
    .values({
      ticketId: data.ticketId,
      sessionId: data.sessionId,
      userId: data.userId,
      agentId: data.agentId,
      rating: data.rating,
      comment: data.comment,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建评级失败');
  return row;
}

export async function findRatingByTicket(ticketId: string): Promise<CustomerServiceRating | undefined> {
  const rows = await db
    .select()
    .from(customerServiceRatings)
    .where(eq(customerServiceRatings.ticketId, ticketId))
    .limit(1);
  return rows[0];
}
