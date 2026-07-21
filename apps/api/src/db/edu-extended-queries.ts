import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { db } from './index.js';
import {
  eduNotes,
  eduOfflineRecords,
  eduUploadedCerts,
  eduUploadedPapers,
  type EduNote,
  type EduOfflineRecord,
  type EduUploadedCert,
  type EduUploadedPaper,
  type AttachmentItem,
} from '@ihui/database';

// =============================================================================
// Notes - 课程笔记
// =============================================================================

export async function findNotesList(opts: {
  page: number;
  pageSize: number;
  lessonId?: string;
  userId?: string;
  search?: string;
}): Promise<{ list: EduNote[]; total: number; page: number; pageSize: number }> {
  const conds = [];
  if (opts.lessonId) conds.push(eq(eduNotes.lessonId, opts.lessonId));
  if (opts.userId) conds.push(eq(eduNotes.userId, opts.userId));
  if (opts.search) conds.push(ilike(eduNotes.title, `%${opts.search}%`));
  const where = conds.length ? and(...conds) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduNotes)
      .where(where)
      .orderBy(desc(eduNotes.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(eduNotes).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize };
}

export async function findNoteById(id: string): Promise<EduNote | undefined> {
  const rows = await db.select().from(eduNotes).where(eq(eduNotes.id, id)).limit(1);
  return rows[0];
}

export interface CreateNoteInput {
  lessonId?: string | null;
  userId: string;
  title?: string | null;
  content: string;
  isPublic?: boolean;
  attachments?: AttachmentItem[];
}

export async function createNote(data: CreateNoteInput): Promise<EduNote> {
  const rows = await db
    .insert(eduNotes)
    .values({
      lessonId: data.lessonId,
      userId: data.userId,
      title: data.title,
      content: data.content,
      isPublic: data.isPublic,
      attachments: data.attachments ?? [],
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建笔记失败');
  return row;
}

export interface UpdateNoteInput {
  lessonId?: string | null;
  title?: string | null;
  content?: string;
  isPublic?: boolean;
  attachments?: AttachmentItem[];
}

export async function updateNote(id: string, data: UpdateNoteInput): Promise<EduNote | undefined> {
  const set: Record<string, unknown> = {};
  if (data.lessonId !== undefined) set.lessonId = data.lessonId;
  if (data.title !== undefined) set.title = data.title;
  if (data.content !== undefined) set.content = data.content;
  if (data.isPublic !== undefined) set.isPublic = data.isPublic;
  if (data.attachments !== undefined) set.attachments = data.attachments;
  set.updatedAt = new Date();
  const rows = await db.update(eduNotes).set(set).where(eq(eduNotes.id, id)).returning();
  return rows[0];
}

export async function deleteNote(id: string): Promise<void> {
  await db.delete(eduNotes).where(eq(eduNotes.id, id));
}

// =============================================================================
// OfflineRecords - 线下学习记录
// =============================================================================

export async function findOfflineRecordsList(opts: {
  page: number;
  pageSize: number;
  userId?: string;
  type?: string;
  search?: string;
}): Promise<{ list: EduOfflineRecord[]; total: number; page: number; pageSize: number }> {
  const conds = [];
  if (opts.userId) conds.push(eq(eduOfflineRecords.userId, opts.userId));
  if (opts.type) conds.push(eq(eduOfflineRecords.type, opts.type));
  if (opts.search) conds.push(ilike(eduOfflineRecords.title, `%${opts.search}%`));
  const where = conds.length ? and(...conds) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduOfflineRecords)
      .where(where)
      .orderBy(desc(eduOfflineRecords.occurredAt), desc(eduOfflineRecords.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(eduOfflineRecords).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize };
}

export async function findOfflineRecordById(id: string): Promise<EduOfflineRecord | undefined> {
  const rows = await db.select().from(eduOfflineRecords).where(eq(eduOfflineRecords.id, id)).limit(1);
  return rows[0];
}

export interface CreateOfflineRecordInput {
  userId: string;
  type: string;
  title: string;
  description?: string | null;
  hours?: number;
  occurredAt?: Date | null;
  attachments?: AttachmentItem[];
}

export async function createOfflineRecord(data: CreateOfflineRecordInput): Promise<EduOfflineRecord> {
  const rows = await db
    .insert(eduOfflineRecords)
    .values({
      userId: data.userId,
      type: data.type,
      title: data.title,
      description: data.description,
      hours: data.hours,
      occurredAt: data.occurredAt,
      attachments: data.attachments ?? [],
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建线下记录失败');
  return row;
}

export interface UpdateOfflineRecordInput {
  type?: string;
  title?: string;
  description?: string | null;
  hours?: number;
  occurredAt?: Date | null;
  attachments?: AttachmentItem[];
}

export async function updateOfflineRecord(
  id: string,
  data: UpdateOfflineRecordInput,
): Promise<EduOfflineRecord | undefined> {
  const set: Record<string, unknown> = {};
  if (data.type !== undefined) set.type = data.type;
  if (data.title !== undefined) set.title = data.title;
  if (data.description !== undefined) set.description = data.description;
  if (data.hours !== undefined) set.hours = data.hours;
  if (data.occurredAt !== undefined) set.occurredAt = data.occurredAt;
  if (data.attachments !== undefined) set.attachments = data.attachments;
  set.updatedAt = new Date();
  const rows = await db.update(eduOfflineRecords).set(set).where(eq(eduOfflineRecords.id, id)).returning();
  return rows[0];
}

export async function deleteOfflineRecord(id: string): Promise<void> {
  await db.delete(eduOfflineRecords).where(eq(eduOfflineRecords.id, id));
}

// =============================================================================
// UploadedCerts - 用户上传证书
// =============================================================================

export async function findUploadedCertsList(opts: {
  page: number;
  pageSize: number;
  userId?: string;
  status?: string;
  search?: string;
}): Promise<{ list: EduUploadedCert[]; total: number; page: number; pageSize: number }> {
  const conds = [];
  if (opts.userId) conds.push(eq(eduUploadedCerts.userId, opts.userId));
  if (opts.status) conds.push(eq(eduUploadedCerts.status, opts.status));
  if (opts.search) conds.push(ilike(eduUploadedCerts.certName, `%${opts.search}%`));
  const where = conds.length ? and(...conds) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduUploadedCerts)
      .where(where)
      .orderBy(desc(eduUploadedCerts.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(eduUploadedCerts).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize };
}

export async function findUploadedCertById(id: string): Promise<EduUploadedCert | undefined> {
  const rows = await db.select().from(eduUploadedCerts).where(eq(eduUploadedCerts.id, id)).limit(1);
  return rows[0];
}

export interface CreateUploadedCertInput {
  userId: string;
  certName: string;
  certUrl?: string | null;
  issuer?: string | null;
  issuedAt?: Date | null;
}

export async function createUploadedCert(data: CreateUploadedCertInput): Promise<EduUploadedCert> {
  const rows = await db
    .insert(eduUploadedCerts)
    .values({
      userId: data.userId,
      certName: data.certName,
      certUrl: data.certUrl,
      issuer: data.issuer,
      issuedAt: data.issuedAt,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建证书记录失败');
  return row;
}

export interface UpdateUploadedCertInput {
  certName?: string;
  certUrl?: string | null;
  issuer?: string | null;
  issuedAt?: Date | null;
}

export async function updateUploadedCert(
  id: string,
  data: UpdateUploadedCertInput,
): Promise<EduUploadedCert | undefined> {
  const set: Record<string, unknown> = {};
  if (data.certName !== undefined) set.certName = data.certName;
  if (data.certUrl !== undefined) set.certUrl = data.certUrl;
  if (data.issuer !== undefined) set.issuer = data.issuer;
  if (data.issuedAt !== undefined) set.issuedAt = data.issuedAt;
  set.updatedAt = new Date();
  const rows = await db.update(eduUploadedCerts).set(set).where(eq(eduUploadedCerts.id, id)).returning();
  return rows[0];
}

export async function deleteUploadedCert(id: string): Promise<void> {
  await db.delete(eduUploadedCerts).where(eq(eduUploadedCerts.id, id));
}

export async function verifyUploadedCert(
  id: string,
  status: string,
  reason: string | null,
  reviewerId: string,
): Promise<EduUploadedCert | undefined> {
  const rows = await db
    .update(eduUploadedCerts)
    .set({
      status,
      reason,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(eduUploadedCerts.id, id))
    .returning();
  return rows[0];
}

// =============================================================================
// UploadedPapers - 用户上传论文
// =============================================================================

export async function findUploadedPapersList(opts: {
  page: number;
  pageSize: number;
  userId?: string;
  status?: string;
  search?: string;
}): Promise<{ list: EduUploadedPaper[]; total: number; page: number; pageSize: number }> {
  const conds = [];
  if (opts.userId) conds.push(eq(eduUploadedPapers.userId, opts.userId));
  if (opts.status) conds.push(eq(eduUploadedPapers.status, opts.status));
  if (opts.search) conds.push(ilike(eduUploadedPapers.paperTitle, `%${opts.search}%`));
  const where = conds.length ? and(...conds) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduUploadedPapers)
      .where(where)
      .orderBy(desc(eduUploadedPapers.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(eduUploadedPapers).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize };
}

export async function findUploadedPaperById(id: string): Promise<EduUploadedPaper | undefined> {
  const rows = await db.select().from(eduUploadedPapers).where(eq(eduUploadedPapers.id, id)).limit(1);
  return rows[0];
}

export interface CreateUploadedPaperInput {
  userId: string;
  paperTitle: string;
  paperUrl?: string | null;
  courseId?: string | null;
}

export async function createUploadedPaper(data: CreateUploadedPaperInput): Promise<EduUploadedPaper> {
  const rows = await db
    .insert(eduUploadedPapers)
    .values({
      userId: data.userId,
      paperTitle: data.paperTitle,
      paperUrl: data.paperUrl,
      courseId: data.courseId,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建论文记录失败');
  return row;
}

export interface UpdateUploadedPaperInput {
  paperTitle?: string;
  paperUrl?: string | null;
  courseId?: string | null;
}

export async function updateUploadedPaper(
  id: string,
  data: UpdateUploadedPaperInput,
): Promise<EduUploadedPaper | undefined> {
  const set: Record<string, unknown> = {};
  if (data.paperTitle !== undefined) set.paperTitle = data.paperTitle;
  if (data.paperUrl !== undefined) set.paperUrl = data.paperUrl;
  if (data.courseId !== undefined) set.courseId = data.courseId;
  set.updatedAt = new Date();
  const rows = await db.update(eduUploadedPapers).set(set).where(eq(eduUploadedPapers.id, id)).returning();
  return rows[0];
}

export async function deleteUploadedPaper(id: string): Promise<void> {
  await db.delete(eduUploadedPapers).where(eq(eduUploadedPapers.id, id));
}

export async function verifyUploadedPaper(
  id: string,
  status: string,
  reason: string | null,
  reviewerId: string,
): Promise<EduUploadedPaper | undefined> {
  const rows = await db
    .update(eduUploadedPapers)
    .set({
      status,
      reason,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(eduUploadedPapers.id, id))
    .returning();
  return rows[0];
}
