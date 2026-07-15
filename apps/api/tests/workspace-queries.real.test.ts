import { describe, it, expect, beforeEach } from 'vitest'
import { sql, eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, projectMembers } from '@ihui/database'
import {
  listProjectsByUser,
  listProjectsByUserWithFileCount,
  createProject,
  findProjectById,
  updateProject,
  deleteProject,
  listFilesByProject,
  findFileById,
  findFileByIdIncludeTrashed,
  createFile,
  deleteFile,
  countFilesByProject,
  findTrashedFiles,
  softDeleteFile,
  restoreFile,
  hardDeleteFile,
  batchSoftDelete,
  batchRestore,
  findFileVersions,
  createFileVersion,
  getLatestVersion,
} from '../src/db/workspace-queries.js'

async function createTestUser(phone: string) {
  const [row] = await db.insert(users).values({ phone }).returning()
  return row
}

describe('workspace-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM file_versions`)
    await db.execute(sql`DELETE FROM file_shares`)
    await db.execute(sql`DELETE FROM files`)
    await db.execute(sql`DELETE FROM project_members`)
    await db.execute(sql`DELETE FROM projects`)
    await db.execute(sql`DELETE FROM users`)
  })

  describe('项目 CRUD', () => {
    it('createProject — 默认 status=1,同时写入 owner 成员记录', async () => {
      const u = await createTestUser('13800000001')
      const p = await createProject({ name: 'P1', userId: u.id, description: 'desc' })
      expect(p.name).toBe('P1')
      expect(p.status).toBe(1)
      expect(p.userId).toBe(u.id)
      // owner 成员记录
      const [member] = await db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, p.id))
      expect(member.role).toBe('owner')
      expect(member.userId).toBe(u.id)
    })

    it('findProjectById + listProjectsByUser(按 updatedAt 倒序)', async () => {
      const u = await createTestUser('13800000002')
      const p1 = await createProject({ name: 'P1', userId: u.id })
      await new Promise((r) => setTimeout(r, 50))
      const _p2 = await createProject({ name: 'P2', userId: u.id })
      expect((await findProjectById(p1.id))?.name).toBe('P1')
      expect(await findProjectById('00000000-0000-0000-0000-000000000000')).toBeUndefined()
      const list = await listProjectsByUser(u.id)
      expect(list).toHaveLength(2)
      expect(list[0].name).toBe('P2') // 最近更新在前
    })

    it('listProjectsByUserWithFileCount — 附带未删除文件数', async () => {
      const u = await createTestUser('13800000003')
      const p = await createProject({ name: 'P1', userId: u.id })
      await createFile({
        projectId: p.id,
        name: 'f1.txt',
        path: '/f1',
        size: 10,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      await createFile({
        projectId: p.id,
        name: 'f2.txt',
        path: '/f2',
        size: 20,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      // 软删除一个
      const f3 = await createFile({
        projectId: p.id,
        name: 'f3.txt',
        path: '/f3',
        size: 30,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      await softDeleteFile(f3.id, u.id)
      const list = await listProjectsByUserWithFileCount(u.id)
      expect(list).toHaveLength(1)
      expect(Number(list[0].fileCount)).toBe(2) // 排除软删除
    })

    it('updateProject — 部分字段更新 + updatedAt 刷新', async () => {
      const u = await createTestUser('13800000004')
      const p = await createProject({ name: 'Old', userId: u.id })
      const updated = await updateProject(p.id, { name: 'New', status: 0 })
      expect(updated.name).toBe('New')
      expect(updated.status).toBe(0)
      expect(updated.description).toBeNull() // 未更新保留 null
    })

    it('deleteProject — 级联删除成员/文件', async () => {
      const u = await createTestUser('13800000005')
      const p = await createProject({ name: 'Del', userId: u.id })
      await createFile({
        projectId: p.id,
        name: 'f.txt',
        path: '/f',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      await deleteProject(p.id)
      expect(await findProjectById(p.id)).toBeUndefined()
      const members = await db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, p.id))
      expect(members).toHaveLength(0) // 级联
      const fileList = await listFilesByProject(p.id)
      expect(fileList).toHaveLength(0) // 级联
    })
  })

  describe('文件 CRUD', () => {
    it('createFile + findFileById + listFilesByProject(按 createdAt 倒序)', async () => {
      const u = await createTestUser('13800000010')
      const p = await createProject({ name: 'P', userId: u.id })
      const f1 = await createFile({
        projectId: p.id,
        name: 'f1',
        path: '/f1',
        size: 10,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      await new Promise((r) => setTimeout(r, 50))
      const _f2 = await createFile({
        projectId: p.id,
        name: 'f2',
        path: '/f2',
        size: 20,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      expect(f1.uploadedBy).toBe(u.id)
      expect((await findFileById(f1.id))?.name).toBe('f1')
      const list = await listFilesByProject(p.id)
      expect(list).toHaveLength(2)
      expect(list[0].name).toBe('f2') // 最新在前
    })

    it('findFileById vs findFileByIdIncludeTrashed — 软删除后前者查不到', async () => {
      const u = await createTestUser('13800000011')
      const p = await createProject({ name: 'P', userId: u.id })
      const f = await createFile({
        projectId: p.id,
        name: 'f',
        path: '/f',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      await softDeleteFile(f.id, u.id)
      expect(await findFileById(f.id)).toBeUndefined()
      expect((await findFileByIdIncludeTrashed(f.id))?.id).toBe(f.id)
    })

    it('listFilesByProject — 不含回收站文件', async () => {
      const u = await createTestUser('13800000012')
      const p = await createProject({ name: 'P', userId: u.id })
      const f1 = await createFile({
        projectId: p.id,
        name: 'keep',
        path: '/k',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      const f2 = await createFile({
        projectId: p.id,
        name: 'trash',
        path: '/t',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      await softDeleteFile(f2.id, u.id)
      const list = await listFilesByProject(p.id)
      expect(list).toHaveLength(1)
      expect(list[0].id).toBe(f1.id)
    })

    it('countFilesByProject — 仅统计未删除文件', async () => {
      const u = await createTestUser('13800000013')
      const p = await createProject({ name: 'P', userId: u.id })
      await createFile({
        projectId: p.id,
        name: 'f1',
        path: '/1',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      const f2 = await createFile({
        projectId: p.id,
        name: 'f2',
        path: '/2',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      await softDeleteFile(f2.id, u.id)
      expect(await countFilesByProject(p.id)).toBe(1)
    })

    it('deleteFile — 硬删除后查不到', async () => {
      const u = await createTestUser('13800000014')
      const p = await createProject({ name: 'P', userId: u.id })
      const f = await createFile({
        projectId: p.id,
        name: 'f',
        path: '/f',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      await deleteFile(f.id)
      expect(await findFileByIdIncludeTrashed(f.id)).toBeUndefined()
    })
  })

  describe('回收站', () => {
    it('softDeleteFile + findTrashedFiles + restoreFile', async () => {
      const u = await createTestUser('13800000020')
      const p = await createProject({ name: 'P', userId: u.id })
      const f1 = await createFile({
        projectId: p.id,
        name: 't1',
        path: '/t1',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      const f2 = await createFile({
        projectId: p.id,
        name: 't2',
        path: '/t2',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      await softDeleteFile(f1.id, u.id)
      await softDeleteFile(f2.id, u.id)
      const trashed = await findTrashedFiles(u.id)
      expect(trashed).toHaveLength(2)
      // 恢复
      await restoreFile(f1.id)
      const trashed2 = await findTrashedFiles(u.id)
      expect(trashed2).toHaveLength(1)
      expect(trashed2[0].id).toBe(f2.id)
      // 恢复后可正常查到
      expect((await findFileById(f1.id))?.id).toBe(f1.id)
    })

    it('hardDeleteFile — 永久删除并返回记录', async () => {
      const u = await createTestUser('13800000021')
      const p = await createProject({ name: 'P', userId: u.id })
      const f = await createFile({
        projectId: p.id,
        name: 'hd',
        path: '/hd',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      const deleted = await hardDeleteFile(f.id)
      expect(deleted?.id).toBe(f.id)
      expect(await findFileByIdIncludeTrashed(f.id)).toBeUndefined()
    })

    it('batchSoftDelete + batchRestore — 批量操作 + 空数组不报错', async () => {
      const u = await createTestUser('13800000022')
      const p = await createProject({ name: 'P', userId: u.id })
      const f1 = await createFile({
        projectId: p.id,
        name: 'b1',
        path: '/b1',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      const f2 = await createFile({
        projectId: p.id,
        name: 'b2',
        path: '/b2',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      // 空数组
      await batchSoftDelete([], u.id)
      await batchRestore([])
      // 批量软删
      await batchSoftDelete([f1.id, f2.id], u.id)
      expect(await countFilesByProject(p.id)).toBe(0)
      expect(await findTrashedFiles(u.id)).toHaveLength(2)
      // 批量恢复
      await batchRestore([f1.id, f2.id])
      expect(await countFilesByProject(p.id)).toBe(2)
      expect(await findTrashedFiles(u.id)).toHaveLength(0)
    })
  })

  describe('文件版本', () => {
    it('createFileVersion + findFileVersions(按 version 倒序) + getLatestVersion', async () => {
      const u = await createTestUser('13800000030')
      const p = await createProject({ name: 'P', userId: u.id })
      const f = await createFile({
        projectId: p.id,
        name: 'ver',
        path: '/ver',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      expect(await getLatestVersion(f.id)).toBe(0) // 无版本
      const v1 = await createFileVersion({
        fileId: f.id,
        version: 1,
        size: 100,
        path: '/v1',
        uploadedBy: u.id,
        changeLog: 'init',
      })
      await createFileVersion({
        fileId: f.id,
        version: 2,
        size: 200,
        path: '/v2',
        uploadedBy: u.id,
        changeLog: 'update',
      })
      expect(v1.version).toBe(1)
      expect(await getLatestVersion(f.id)).toBe(2)
      const versions = await findFileVersions(f.id)
      expect(versions).toHaveLength(2)
      expect(versions[0].version).toBe(2) // 倒序
      expect(versions[1].version).toBe(1)
    })

    it('getLatestVersion — 无版本返回 0', async () => {
      const u = await createTestUser('13800000031')
      const p = await createProject({ name: 'P', userId: u.id })
      const f = await createFile({
        projectId: p.id,
        name: 'nov',
        path: '/nov',
        size: 1,
        mimeType: 'text/plain',
        uploadedBy: u.id,
      })
      expect(await getLatestVersion(f.id)).toBe(0)
    })
  })
})
