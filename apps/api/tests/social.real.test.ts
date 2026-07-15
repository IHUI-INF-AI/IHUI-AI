import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import {
  followUser,
  unfollowUser,
  isFollowing,
  countFollowing,
  countFollowers,
  isMutualFollowing,
  addFavorite,
  removeFavorite,
  isFavorited,
  countFavorites,
} from '../src/db/social-queries.js'
import { users } from '@ihui/database'

async function createTestUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname }).returning()
  return row
}

describe('social-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM user_favorites`)
    await db.execute(sql`DELETE FROM user_follows`)
    await db.execute(sql`DELETE FROM users`)
  })

  describe('followUser / isFollowing', () => {
    it('关注后 isFollowing 返回 true,反向返回 false', async () => {
      const a = await createTestUser('13900000001', '用户A')
      const b = await createTestUser('13900000002', '用户B')

      await followUser(a.id, b.id)
      expect(await isFollowing(a.id, b.id)).toBe(true)
      expect(await isFollowing(b.id, a.id)).toBe(false)
    })

    it('幂等 — 重复关注不报错且不重复插入', async () => {
      const a = await createTestUser('13900000003', '用户A')
      const b = await createTestUser('13900000004', '用户B')

      await followUser(a.id, b.id)
      await expect(followUser(a.id, b.id)).resolves.toBeUndefined()

      expect(await countFollowing(a.id)).toBe(1)
    })

    it('不能关注自己 — 抛错 statusCode 400', async () => {
      const a = await createTestUser('13900000005', '用户A')

      await expect(followUser(a.id, a.id)).rejects.toMatchObject({
        statusCode: 400,
        message: '不能关注自己',
      })
    })
  })

  describe('unfollowUser', () => {
    it('取消关注后 isFollowing 返回 false', async () => {
      const a = await createTestUser('13900000006', '用户A')
      const b = await createTestUser('13900000007', '用户B')

      await followUser(a.id, b.id)
      expect(await isFollowing(a.id, b.id)).toBe(true)

      await unfollowUser(a.id, b.id)
      expect(await isFollowing(a.id, b.id)).toBe(false)
    })

    it('取消不存在的关注关系 — 不报错', async () => {
      const a = await createTestUser('13900000008', '用户A')
      const b = await createTestUser('13900000009', '用户B')

      await expect(unfollowUser(a.id, b.id)).resolves.toBeUndefined()
    })
  })

  describe('countFollowing / countFollowers', () => {
    it('关注计数正确', async () => {
      const a = await createTestUser('13900000010', '用户A')
      const b = await createTestUser('13900000011', '用户B')
      const c = await createTestUser('13900000012', '用户C')

      await followUser(a.id, b.id)
      await followUser(a.id, c.id)

      expect(await countFollowing(a.id)).toBe(2)
      expect(await countFollowers(b.id)).toBe(1)
      expect(await countFollowers(c.id)).toBe(1)
    })
  })

  describe('isMutualFollowing', () => {
    it('双向关注返回 true,单向关注返回 false', async () => {
      const a = await createTestUser('13900000013', '用户A')
      const b = await createTestUser('13900000014', '用户B')

      await followUser(a.id, b.id)
      expect(await isMutualFollowing(a.id, b.id)).toBe(false)

      await followUser(b.id, a.id)
      expect(await isMutualFollowing(a.id, b.id)).toBe(true)
    })
  })

  describe('favorites', () => {
    it('收藏/查询/取消/计数', async () => {
      const a = await createTestUser('13900000015', '用户A')

      await addFavorite({ userId: a.id, resourceType: 'post', resourceId: 'post-001' })
      expect(
        await isFavorited({ userId: a.id, resourceType: 'post', resourceId: 'post-001' }),
      ).toBe(true)
      expect(
        await isFavorited({ userId: a.id, resourceType: 'post', resourceId: 'post-002' }),
      ).toBe(false)
      expect(await countFavorites(a.id)).toBe(1)

      await removeFavorite({ userId: a.id, resourceType: 'post', resourceId: 'post-001' })
      expect(
        await isFavorited({ userId: a.id, resourceType: 'post', resourceId: 'post-001' }),
      ).toBe(false)
      expect(await countFavorites(a.id)).toBe(0)
    })

    it('幂等 — 重复收藏不报错且不重复插入', async () => {
      const a = await createTestUser('13900000016', '用户A')

      await addFavorite({ userId: a.id, resourceType: 'post', resourceId: 'post-003' })
      await addFavorite({ userId: a.id, resourceType: 'post', resourceId: 'post-003' })

      expect(await countFavorites(a.id)).toBe(1)
    })

    it('不同 resourceType 的同 resourceId 互不影响', async () => {
      const a = await createTestUser('13900000017', '用户A')

      await addFavorite({ userId: a.id, resourceType: 'post', resourceId: 'res-001' })
      await addFavorite({ userId: a.id, resourceType: 'file', resourceId: 'res-001' })

      expect(await countFavorites(a.id)).toBe(2)
    })
  })
})
