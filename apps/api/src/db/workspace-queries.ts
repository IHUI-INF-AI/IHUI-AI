import { eq, desc, sql, isNull, isNotNull, and, inArray } from 'drizzle-orm'
import { db } from './index.js'
import {
  projects,
  projectMembers,
  files,
  fileVersions,
  type Project,
  type File,
  type FileVersion,
} from '@ihui/database'

// =============================================================================
// 项目
// =============================================================================

export interface CreateProjectInput {
  name: string
  description?: string
  userId: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  status?: number
}

/**
 * 列出用户参与的所有项目（owner + member）。按最近更新倒序。
 */
export async function listProjectsByUser(userId: string): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))
}

/**
 * 按用户列出项目，并附带每个项目的文件数量。
 */
export async function listProjectsByUserWithFileCount(userId: string) {
  const rows = await db
    .select({
      id: projects.id,
      userId: projects.userId,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      fileCount:
        sql<number>`(SELECT COUNT(*) FROM files WHERE files.project_id = projects.id AND files.deleted_at IS NULL)`.as(
          'file_count',
        ),
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))
  return rows
}

/**
 * 创建项目，同时写入 owner 成员记录。
 */
export async function createProject(data: CreateProjectInput): Promise<Project> {
  const rows = await db
    .insert(projects)
    .values({
      userId: data.userId,
      name: data.name,
      description: data.description,
      status: 1,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建项目失败')

  await db.insert(projectMembers).values({
    projectId: row.id,
    userId: data.userId,
    role: 'owner',
  })

  return row
}

/**
 * 按 id 查询项目。
 */
export async function findProjectById(id: string): Promise<Project | undefined> {
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
  return rows[0]
}

/**
 * 更新项目字段。
 */
export async function updateProject(id: string, data: UpdateProjectInput): Promise<Project> {
  const rows = await db
    .update(projects)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status !== undefined && { status: data.status }),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('更新项目失败')
  return row
}

/**
 * 删除项目（级联删除文件/成员由数据库外键保证）。
 */
export async function deleteProject(id: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, id))
}

// =============================================================================
// 文件
// =============================================================================

export interface CreateFileInput {
  projectId: string
  name: string
  path: string
  size: number
  mimeType: string
  uploadedBy: string
}

/**
 * 列出项目下的文件（不含回收站），按上传时间倒序。
 */
export async function listFilesByProject(projectId: string): Promise<File[]> {
  return db
    .select()
    .from(files)
    .where(and(eq(files.projectId, projectId), isNull(files.deletedAt)))
    .orderBy(desc(files.createdAt))
}

/**
 * 按 id 查询文件（默认排除已删除文件）。
 */
export async function findFileById(id: string): Promise<File | undefined> {
  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), isNull(files.deletedAt)))
    .limit(1)
  return rows[0]
}

/**
 * 按 id 查询文件（含已删除文件，用于回收站恢复/永久删除等操作）。
 */
export async function findFileByIdIncludeTrashed(id: string): Promise<File | undefined> {
  const rows = await db.select().from(files).where(eq(files.id, id)).limit(1)
  return rows[0]
}

/**
 * 创建文件记录。
 */
export async function createFile(data: CreateFileInput): Promise<File> {
  const rows = await db
    .insert(files)
    .values({
      projectId: data.projectId,
      name: data.name,
      path: data.path,
      size: data.size,
      mimeType: data.mimeType,
      uploadedBy: data.uploadedBy,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建文件记录失败')
  return row
}

/**
 * 删除文件记录（硬删除，数据库层面）。
 */
export async function deleteFile(id: string): Promise<void> {
  await db.delete(files).where(eq(files.id, id))
}

/**
 * 统计项目下文件数量（不含回收站）。
 */
export async function countFilesByProject(projectId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(files)
    .where(and(eq(files.projectId, projectId), isNull(files.deletedAt)))
  return Number(rows[0]?.count ?? 0)
}

// =============================================================================
// 回收站（软删除）
// =============================================================================

/**
 * 列出当前用户项目下已软删除的文件（回收站），按删除时间倒序。
 */
export async function findTrashedFiles(userId: string): Promise<File[]> {
  const rows = await db
    .select({ file: files })
    .from(files)
    .innerJoin(projects, eq(files.projectId, projects.id))
    .where(and(eq(projects.userId, userId), isNotNull(files.deletedAt)))
    .orderBy(desc(files.deletedAt))
  return rows.map((r) => r.file)
}

/**
 * 软删除单个文件（移入回收站）。
 */
export async function softDeleteFile(id: string, userId: string): Promise<void> {
  await db.update(files).set({ deletedAt: new Date(), deletedBy: userId }).where(eq(files.id, id))
}

/**
 * 恢复单个文件（移出回收站）。
 */
export async function restoreFile(id: string): Promise<void> {
  await db.update(files).set({ deletedAt: null, deletedBy: null }).where(eq(files.id, id))
}

/**
 * 永久删除文件（从数据库删除并返回记录，磁盘文件由调用方清理）。
 */
export async function hardDeleteFile(id: string): Promise<File | undefined> {
  const rows = await db.delete(files).where(eq(files.id, id)).returning()
  return rows[0]
}

/**
 * 批量软删除文件。
 */
export async function batchSoftDelete(fileIds: string[], userId: string): Promise<void> {
  if (fileIds.length === 0) return
  await db
    .update(files)
    .set({ deletedAt: new Date(), deletedBy: userId })
    .where(inArray(files.id, fileIds))
}

/**
 * 批量恢复文件。
 */
export async function batchRestore(fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return
  await db.update(files).set({ deletedAt: null, deletedBy: null }).where(inArray(files.id, fileIds))
}

// =============================================================================
// 文件版本
// =============================================================================

/** 查询文件版本历史 */
export async function findFileVersions(fileId: string): Promise<FileVersion[]> {
  return db
    .select()
    .from(fileVersions)
    .where(eq(fileVersions.fileId, fileId))
    .orderBy(desc(fileVersions.version))
}

/** 创建文件版本记录 */
export async function createFileVersion(data: {
  fileId: string
  version: number
  size: number
  path: string
  uploadedBy?: string
  changeLog?: string
}): Promise<FileVersion> {
  const rows = await db.insert(fileVersions).values(data).returning()
  const row = rows[0]
  if (!row) throw new Error('创建文件版本失败')
  return row
}

/** 获取文件最新版本号 */
export async function getLatestVersion(fileId: string): Promise<number> {
  const rows = await db
    .select({ version: fileVersions.version })
    .from(fileVersions)
    .where(eq(fileVersions.fileId, fileId))
    .orderBy(desc(fileVersions.version))
    .limit(1)
  return rows[0]?.version ?? 0
}
