import { randomUUID } from 'node:crypto';
import { eq, and, or, desc, ilike, inArray, sql } from 'drizzle-orm';
import { db } from './index.js';
import {
  files,
  fileShares,
  projectMembers,
  tagRelations,
  type File,
  type FileShare,
} from '@ihui/database';
import { findProjectById } from './workspace-queries.js';

// =============================================================================
// 权限
// =============================================================================

/**
 * 判断用户是否可访问文件：
 * - 上传者本人；或
 * - 项目所有者；或
 * - 项目成员（owner 在创建时已写入 project_members）。
 */
export async function canAccessFile(userId: string, file: File): Promise<boolean> {
  if (file.uploadedBy === userId) return true;
  const project = await findProjectById(file.projectId);
  if (!project) return false;
  if (project.userId === userId) return true;
  const member = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, file.projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return member.length > 0;
}

// =============================================================================
// 搜索
// =============================================================================

export interface SearchFilesOpts {
  userId: string;
  q?: string;
  projectId?: string;
  mimeType?: string;
  tag?: string;
}

/**
 * 搜索当前用户可访问的文件。
 * 可访问范围：uploadedBy = userId 或用户所在项目（含 owner）。
 */
export async function searchFiles(opts: SearchFilesOpts): Promise<File[]> {
  const userProjectIds = db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, opts.userId));

  const conds = [
    or(eq(files.uploadedBy, opts.userId), inArray(files.projectId, userProjectIds)),
  ];
  if (opts.q) conds.push(ilike(files.name, `%${opts.q}%`));
  if (opts.projectId) conds.push(eq(files.projectId, opts.projectId));
  if (opts.mimeType) conds.push(eq(files.mimeType, opts.mimeType));
  if (opts.tag) {
    const taggedFileIds = db
      .select({ id: sql`${tagRelations.resourceId}::uuid` })
      .from(tagRelations)
      .where(
        and(
          eq(tagRelations.tagId, opts.tag),
          eq(tagRelations.resourceType, 'file'),
        ),
      );
    conds.push(inArray(files.id, taggedFileIds));
  }

  return db.select().from(files).where(and(...conds)).orderBy(desc(files.createdAt));
}

// =============================================================================
// 分享
// =============================================================================

export interface CreateShareInput {
  fileId: string;
  sharedBy: string;
  sharedWith?: string;
  permissions?: 'view' | 'edit';
  expiresAt?: Date;
}

/**
 * 创建分享记录，自动生成 token。
 */
export async function createShare(input: CreateShareInput): Promise<FileShare> {
  const rows = await db
    .insert(fileShares)
    .values({
      fileId: input.fileId,
      sharedBy: input.sharedBy,
      sharedWith: input.sharedWith,
      shareToken: randomUUID(),
      permissions: input.permissions ?? 'view',
      expiresAt: input.expiresAt,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建分享失败');
  return row;
}

/**
 * 通过 token 查询分享信息；已过期返回 undefined。
 */
export async function findShareByToken(token: string): Promise<FileShare | undefined> {
  const rows = await db
    .select()
    .from(fileShares)
    .where(eq(fileShares.shareToken, token))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return undefined;
  return row;
}

/**
 * 删除分享（仅创建者本人）。返回是否删除成功。
 */
export async function deleteShare(shareId: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(fileShares)
    .where(and(eq(fileShares.id, shareId), eq(fileShares.sharedBy, userId)))
    .returning();
  return rows.length > 0;
}

// =============================================================================
// 最近文件
// =============================================================================

/**
 * 获取当前用户可访问的最近文件（按 createdAt 倒序）。
 */
export async function findRecentFiles(userId: string, limit: number): Promise<File[]> {
  const userProjectIds = db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));

  return db
    .select()
    .from(files)
    .where(or(eq(files.uploadedBy, userId), inArray(files.projectId, userProjectIds)))
    .orderBy(desc(files.createdAt))
    .limit(limit);
}
