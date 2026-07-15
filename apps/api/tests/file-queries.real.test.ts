import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, projects, projectMembers, files, tags, tagRelations } from '@ihui/database'
import {
  canAccessFile,
  searchFiles,
  createShare,
  findShareByToken,
  deleteShare,
  findRecentFiles,
} from '../src/db/file-queries.js'

async function createTestUser(phone: string) {
  const [row] = await db.insert(users).values({ phone }).returning()
  return row
}

async function createTestProject(userId: string, name: string) {
  const [row] = await db.insert(projects).values({ userId, name }).returning()
  // 创建者自动写入 project_members(role=owner)
  await db.insert(projectMembers).values({ projectId: row.id, userId, role: 'owner' })
  return row
}

async function createTestFile(
  projectId: string,
  uploadedBy: string | null,
  name: string,
  mimeType = 'text/plain',
) {
  const [row] = await db
    .insert(files)
    .values({ projectId, name, path: `/uploads/${name}`, size: 100, mimeType, uploadedBy })
    .returning()
  return row
}

describe('file-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    // 按外键依赖顺序清空
    await db.execute(sql`DELETE FROM tag_relations`)
    await db.execute(sql`DELETE FROM tags`)
    await db.execute(sql`DELETE FROM file_shares`)
    await db.execute(sql`DELETE FROM files`)
    await db.execute(sql`DELETE FROM project_members`)
    await db.execute(sql`DELETE FROM projects`)
    await db.execute(sql`DELETE FROM users`)
  })

  describe('canAccessFile 权限', () => {
    it('上传者本人 → true', async () => {
      const u = await createTestUser('13800000001')
      const p = await createTestProject(u.id, 'P1')
      const f = await createTestFile(p.id, u.id, 'f1.txt')
      expect(await canAccessFile(u.id, f)).toBe(true)
    })

    it('项目所有者 → true(非上传者)', async () => {
      const owner = await createTestUser('13800000002')
      const uploader = await createTestUser('13800000003')
      const p = await createTestProject(owner.id, 'P2')
      const f = await createTestFile(p.id, uploader.id, 'f2.txt')
      expect(await canAccessFile(owner.id, f)).toBe(true)
    })

    it('项目成员 → true', async () => {
      const owner = await createTestUser('13800000004')
      const member = await createTestUser('13800000005')
      const p = await createTestProject(owner.id, 'P3')
      await db.insert(projectMembers).values({ projectId: p.id, userId: member.id, role: 'member' })
      const f = await createTestFile(p.id, owner.id, 'f3.txt')
      expect(await canAccessFile(member.id, f)).toBe(true)
    })

    it('无关用户 → false', async () => {
      const owner = await createTestUser('13800000006')
      const stranger = await createTestUser('13800000007')
      const p = await createTestProject(owner.id, 'P4')
      const f = await createTestFile(p.id, owner.id, 'f4.txt')
      expect(await canAccessFile(stranger.id, f)).toBe(false)
    })

    it('uploadedBy 为 null 且无关用户 → false', async () => {
      const owner = await createTestUser('13800000008')
      const stranger = await createTestUser('13800000009')
      const p = await createTestProject(owner.id, 'P5')
      const f = await createTestFile(p.id, null, 'f5.txt')
      expect(await canAccessFile(stranger.id, f)).toBe(false)
    })
  })

  describe('searchFiles 搜索', () => {
    it('返回用户上传 + 所在项目的文件', async () => {
      const u1 = await createTestUser('13800000010')
      const u2 = await createTestUser('13800000011')
      const p1 = await createTestProject(u1.id, 'P1')
      const p2 = await createTestProject(u2.id, 'P2')
      // u1 上传到 p1
      await createTestFile(p1.id, u1.id, 'u1file.txt')
      // u2 上传到 p2,u1 不是成员
      await createTestFile(p2.id, u2.id, 'u2file.txt')
      // u1 作为成员加入 p2
      await db.insert(projectMembers).values({ projectId: p2.id, userId: u1.id, role: 'member' })
      // u2 再上传一个到 p2
      await createTestFile(p2.id, u2.id, 'shared.txt')

      const result = await searchFiles({ userId: u1.id })
      // u1 能看到:u1file.txt(u1上传) + shared.txt(p2成员),看不到 u2file.txt?其实 u2file 也在 p2
      // 实际上 u1 是 p2 成员,所以 p2 所有文件都能看到(u2file + shared)
      expect(result.length).toBe(3)
    })

    it('q 模糊搜索 + projectId 过滤 + mimeType 过滤', async () => {
      const u = await createTestUser('13800000012')
      const p1 = await createTestProject(u.id, 'P1')
      const p2 = await createTestProject(u.id, 'P2')
      await createTestFile(p1.id, u.id, 'report.pdf', 'application/pdf')
      await createTestFile(p1.id, u.id, 'notes.txt')
      await createTestFile(p2.id, u.id, 'report2.pdf', 'application/pdf')

      // q 模糊搜索
      const r1 = await searchFiles({ userId: u.id, q: 'report' })
      expect(r1).toHaveLength(2)
      // projectId 过滤
      const r2 = await searchFiles({ userId: u.id, projectId: p1.id })
      expect(r2).toHaveLength(2)
      // mimeType 过滤
      const r3 = await searchFiles({ userId: u.id, mimeType: 'application/pdf' })
      expect(r3).toHaveLength(2)
      // 组合
      const r4 = await searchFiles({ userId: u.id, projectId: p1.id, mimeType: 'application/pdf' })
      expect(r4).toHaveLength(1)
      expect(r4[0].name).toBe('report.pdf')
    })

    it('tag 过滤 — 仅返回带指定标签的文件', async () => {
      const u = await createTestUser('13800000013')
      const p = await createTestProject(u.id, 'P')
      const f1 = await createTestFile(p.id, u.id, 'tagged.txt')
      await createTestFile(p.id, u.id, 'untagged.txt')
      // 创建 tag + tag_relation
      const [tag] = await db
        .insert(tags)
        .values({ name: 'important', slug: 'important' })
        .returning()
      await db.insert(tagRelations).values({
        tagId: tag.id,
        resourceType: 'file',
        resourceId: f1.id,
        createdBy: u.id,
      })
      const r = await searchFiles({ userId: u.id, tag: tag.id })
      expect(r).toHaveLength(1)
      expect(r[0].name).toBe('tagged.txt')
    })
  })

  describe('分享', () => {
    it('createShare + findShareByToken — 默认 permissions=view', async () => {
      const u = await createTestUser('13800000020')
      const p = await createTestProject(u.id, 'P')
      const f = await createTestFile(p.id, u.id, 'share.txt')
      const share = await createShare({ fileId: f.id, sharedBy: u.id })
      expect(share.permissions).toBe('view')
      expect(share.shareToken).toBeTruthy()
      expect(share.sharedBy).toBe(u.id)
      const found = await findShareByToken(share.shareToken)
      expect(found?.id).toBe(share.id)
    })

    it('createShare — 指定 sharedWith + permissions=edit', async () => {
      const u1 = await createTestUser('13800000021')
      const u2 = await createTestUser('13800000022')
      const p = await createTestProject(u1.id, 'P')
      const f = await createTestFile(p.id, u1.id, 'share2.txt')
      const share = await createShare({
        fileId: f.id,
        sharedBy: u1.id,
        sharedWith: u2.id,
        permissions: 'edit',
      })
      expect(share.sharedWith).toBe(u2.id)
      expect(share.permissions).toBe('edit')
    })

    it('findShareByToken — 已过期返回 undefined', async () => {
      const u = await createTestUser('13800000023')
      const p = await createTestProject(u.id, 'P')
      const f = await createTestFile(p.id, u.id, 'expired.txt')
      const share = await createShare({
        fileId: f.id,
        sharedBy: u.id,
        expiresAt: new Date(Date.now() - 1000), // 1 秒前过期
      })
      expect(await findShareByToken(share.shareToken)).toBeUndefined()
    })

    it('findShareByToken — 未过期返回分享', async () => {
      const u = await createTestUser('13800000024')
      const p = await createTestProject(u.id, 'P')
      const f = await createTestFile(p.id, u.id, 'valid.txt')
      const share = await createShare({
        fileId: f.id,
        sharedBy: u.id,
        expiresAt: new Date(Date.now() + 86400000), // 1 天后
      })
      expect((await findShareByToken(share.shareToken))?.id).toBe(share.id)
    })

    it('findShareByToken — 不存在的 token 返回 undefined', async () => {
      expect(await findShareByToken('nonexistent-token-12345')).toBeUndefined()
    })

    it('deleteShare — 仅创建者可删,返回 true', async () => {
      const u1 = await createTestUser('13800000025')
      const u2 = await createTestUser('13800000026')
      const p = await createTestProject(u1.id, 'P')
      const f = await createTestFile(p.id, u1.id, 'del.txt')
      const share = await createShare({ fileId: f.id, sharedBy: u1.id })
      // u2(非创建者)删除失败
      expect(await deleteShare(share.id, u2.id)).toBe(false)
      // u1(创建者)删除成功
      expect(await deleteShare(share.id, u1.id)).toBe(true)
      // 再删一次返回 false
      expect(await deleteShare(share.id, u1.id)).toBe(false)
    })
  })

  describe('findRecentFiles', () => {
    it('返回用户可访问文件 + limit 截断 + 按 createdAt 倒序', async () => {
      const u = await createTestUser('13800000030')
      const p = await createTestProject(u.id, 'P')
      await createTestFile(p.id, u.id, 'f1.txt')
      // 确保 createdAt 不同(等待)
      await new Promise((r) => setTimeout(r, 50))
      await createTestFile(p.id, u.id, 'f2.txt')
      await new Promise((r) => setTimeout(r, 50))
      await createTestFile(p.id, u.id, 'f3.txt')

      const r1 = await findRecentFiles(u.id, 10)
      expect(r1).toHaveLength(3)
      expect(r1[0].name).toBe('f3.txt') // 最新在前
      const r2 = await findRecentFiles(u.id, 2)
      expect(r2).toHaveLength(2)
      expect(r2[0].name).toBe('f3.txt')
      expect(r2[1].name).toBe('f2.txt')
    })

    it('无关用户看不到他人文件', async () => {
      const u1 = await createTestUser('13800000031')
      const u2 = await createTestUser('13800000032')
      const p = await createTestProject(u1.id, 'P')
      await createTestFile(p.id, u1.id, 'private.txt')
      const r = await findRecentFiles(u2.id, 10)
      expect(r).toHaveLength(0)
    })
  })
})
