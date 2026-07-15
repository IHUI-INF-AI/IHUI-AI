import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users } from '@ihui/database'
import {
  createComment,
  findComments,
  findCommentById,
  updateComment,
  softDeleteComment,
  likeComment,
  unlikeComment,
  findReplies,
  createFeedback,
  findFeedbacksByUser,
  findFeedbackById,
  updateFeedback,
  deleteFeedback,
} from '../src/db/comment-queries.js'

async function createTestUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname }).returning()
  return row
}

describe('comment-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    // 按外键依赖顺序清空:feedbacks → comment_likes → comments → users
    await db.execute(sql`DELETE FROM feedbacks`)
    await db.execute(sql`DELETE FROM comment_likes`)
    await db.execute(sql`DELETE FROM comments`)
    await db.execute(sql`DELETE FROM users`)
  })

  describe('createComment + findComments', () => {
    it('创建顶级评论并查询 — parentId 为 null', async () => {
      const user = await createTestUser('13900000001', '用户A')
      const comment = await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'post-001',
        content: '测试评论',
      })

      expect(comment.id).toBeDefined()
      expect(comment.parentId).toBeNull()
      expect(comment.content).toBe('测试评论')
      expect(comment.isDeleted).toBe(false)

      const result = await findComments({
        resourceType: 'post',
        resourceId: 'post-001',
        page: 1,
        pageSize: 10,
      })
      expect(result.total).toBe(1)
      expect(result.list[0].content).toBe('测试评论')
      // sql<number>`COUNT(*)` 子查询在 postgres.js 驱动下返回字符串,需 Number() 转换
      expect(Number(result.list[0].repliesCount)).toBe(0)
      expect(Number(result.list[0].likeCount)).toBe(0)
      expect(result.list[0].likedByMe).toBe(false)
    })

    it('findComments 按 resourceType + resourceId 过滤 — 不同资源互不影响', async () => {
      const user = await createTestUser('13900000002')
      await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'r1',
        content: 'c1',
      })
      await createComment({
        userId: user.id,
        resourceType: 'file',
        resourceId: 'r1',
        content: 'c2',
      })

      const postResult = await findComments({
        resourceType: 'post',
        resourceId: 'r1',
        page: 1,
        pageSize: 10,
      })
      const fileResult = await findComments({
        resourceType: 'file',
        resourceId: 'r1',
        page: 1,
        pageSize: 10,
      })
      expect(postResult.total).toBe(1)
      expect(fileResult.total).toBe(1)
      expect(postResult.list[0].content).toBe('c1')
      expect(fileResult.list[0].content).toBe('c2')
    })

    it('创建带 mentions 的评论', async () => {
      const user = await createTestUser('13900000003')
      const comment = await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'r2',
        content: '@某人',
        mentions: ['user-mention-1', 'user-mention-2'],
      })

      expect(comment.mentions).toEqual(['user-mention-1', 'user-mention-2'])
    })
  })

  describe('findCommentById', () => {
    it('按 ID 查询带元数据', async () => {
      const user = await createTestUser('13900000004')
      const created = await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'r3',
        content: '查找测试',
      })

      const found = await findCommentById(created.id)
      expect(found).toBeDefined()
      expect(found!.content).toBe('查找测试')
      expect(found!.likeCount).toBe(0)
      expect(found!.repliesCount).toBe(0)
    })
  })

  describe('updateComment', () => {
    it('仅本人可更新评论内容', async () => {
      const user = await createTestUser('13900000005')
      const other = await createTestUser('13900000006')
      const comment = await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'r4',
        content: '原内容',
      })

      // 非本人更新返回 undefined
      const failed = await updateComment(comment.id, other.id, '恶意修改')
      expect(failed).toBeUndefined()

      // 本人更新成功
      const updated = await updateComment(comment.id, user.id, '新内容')
      expect(updated).toBeDefined()
      expect(updated!.content).toBe('新内容')
    })

    it('软删除后的评论不能更新', async () => {
      const user = await createTestUser('13900000007')
      const comment = await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'r5',
        content: '待删除',
      })

      await softDeleteComment(comment.id)
      const failed = await updateComment(comment.id, user.id, '尝试修改')
      expect(failed).toBeUndefined()
    })
  })

  describe('softDeleteComment', () => {
    it('软删除后 isDeleted=true 且 content 变为"已删除"', async () => {
      const user = await createTestUser('13900000008')
      const comment = await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'r6',
        content: '原始内容',
      })

      const deleted = await softDeleteComment(comment.id)
      expect(deleted).toBeDefined()
      expect(deleted!.isDeleted).toBe(true)
      expect(deleted!.content).toBe('已删除')
    })

    it('已软删除的评论再次软删除返回 undefined', async () => {
      const user = await createTestUser('13900000009')
      const comment = await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'r7',
        content: '内容',
      })

      await softDeleteComment(comment.id)
      const second = await softDeleteComment(comment.id)
      expect(second).toBeUndefined()
    })
  })

  describe('likeComment / unlikeComment', () => {
    it('点赞 → likeCount=1, likedByMe=true;取消点赞 → likeCount=0, likedByMe=false', async () => {
      const user = await createTestUser('13900000010')
      const comment = await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'r8',
        content: '点赞测试',
      })

      await likeComment(comment.id, user.id)
      let found = await findCommentById(comment.id, user.id)
      expect(found!.likeCount).toBe(1)
      expect(found!.likedByMe).toBe(true)

      await unlikeComment(comment.id, user.id)
      found = await findCommentById(comment.id, user.id)
      expect(found!.likeCount).toBe(0)
      expect(found!.likedByMe).toBe(false)
    })

    it('点赞幂等 — 重复点赞不报错且不重复', async () => {
      const user = await createTestUser('13900000011')
      const comment = await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'r9',
        content: '幂等测试',
      })

      await likeComment(comment.id, user.id)
      await expect(likeComment(comment.id, user.id)).resolves.toBeUndefined()

      const found = await findCommentById(comment.id)
      expect(found!.likeCount).toBe(1)
    })

    it('不同用户对同一评论点赞 — likeCount 正确', async () => {
      const user1 = await createTestUser('13900000012')
      const user2 = await createTestUser('13900000013')
      const comment = await createComment({
        userId: user1.id,
        resourceType: 'post',
        resourceId: 'r10',
        content: '多用户点赞',
      })

      await likeComment(comment.id, user1.id)
      await likeComment(comment.id, user2.id)

      const found = await findCommentById(comment.id)
      expect(found!.likeCount).toBe(2)
    })
  })

  describe('findReplies', () => {
    it('查询某父评论的回复列表 — 时间正序', async () => {
      const user = await createTestUser('13900000014')
      const parent = await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'r11',
        content: '父评论',
      })
      await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'r11',
        parentId: parent.id,
        content: '回复1',
      })
      await createComment({
        userId: user.id,
        resourceType: 'post',
        resourceId: 'r11',
        parentId: parent.id,
        content: '回复2',
      })

      const result = await findReplies(parent.id, { page: 1, pageSize: 10 })
      expect(result.total).toBe(2)
      expect(result.list[0].content).toBe('回复1')
      expect(result.list[1].content).toBe('回复2')

      // 父评论的 repliesCount 也应为 2
      const parentFound = await findCommentById(parent.id)
      expect(parentFound!.repliesCount).toBe(2)
    })
  })

  describe('feedbacks', () => {
    it('创建反馈 + 按用户查询', async () => {
      const user = await createTestUser('13900000015')
      const feedback = await createFeedback({
        userId: user.id,
        type: 'bug',
        title: '登录失败',
        content: '点击登录按钮无响应',
        contact: 'user@example.com',
      })

      expect(feedback.id).toBeDefined()
      expect(feedback.status).toBe('pending')
      expect(feedback.priority).toBe('medium')

      const result = await findFeedbacksByUser(user.id, 1, 10)
      expect(result.total).toBe(1)
      expect(result.list[0].title).toBe('登录失败')
    })

    it('findFeedbackById + updateFeedback + deleteFeedback', async () => {
      const user = await createTestUser('13900000016')
      const feedback = await createFeedback({
        userId: user.id,
        type: 'feature',
        title: '新增功能',
        content: '希望增加暗黑模式',
      })

      const found = await findFeedbackById(feedback.id)
      expect(found).toBeDefined()

      const updated = await updateFeedback(feedback.id, {
        status: 'resolved',
        adminReply: '已排期开发',
      })
      expect(updated!.status).toBe('resolved')
      expect(updated!.adminReply).toBe('已排期开发')

      await deleteFeedback(feedback.id)
      const afterDelete = await findFeedbackById(feedback.id)
      expect(afterDelete).toBeUndefined()
    })
  })
})
