import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users } from '@ihui/database'
import {
  createNotification,
  findNotificationsByUser,
  findNotificationById,
  countUnread,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  broadcastNotification,
  createMessage,
  findMessagesBetween,
  findConversations,
} from '../src/db/notification-queries.js'

async function createTestUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname }).returning()
  return row
}

describe('notification-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    // 按外键依赖顺序清空:messages → notifications → users
    await db.execute(sql`DELETE FROM messages`)
    await db.execute(sql`DELETE FROM notifications`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  describe('createNotification + findNotificationsByUser', () => {
    it('创建通知并查询 — 默认未读', async () => {
      const user = await createTestUser('13900000001', '用户A')
      const notification = await createNotification({
        userId: user.id,
        type: 'system',
        title: '欢迎使用',
        content: '感谢注册',
        data: { action: 'welcome' },
      })

      expect(notification.id).toBeDefined()
      expect(notification.isRead).toBe(false)
      expect(notification.type).toBe('system')
      expect(notification.data).toEqual({ action: 'welcome' })

      const result = await findNotificationsByUser(user.id, { page: 1, pageSize: 10 })
      expect(result.total).toBe(1)
      expect(result.list[0].title).toBe('欢迎使用')
    })

    it('findNotificationsByUser 按 type 过滤', async () => {
      const user = await createTestUser('13900000002')
      await createNotification({ userId: user.id, type: 'system', title: '系统通知' })
      await createNotification({ userId: user.id, type: 'order', title: '订单通知' })

      const systemOnly = await findNotificationsByUser(user.id, {
        page: 1,
        pageSize: 10,
        type: 'system',
      })
      expect(systemOnly.total).toBe(1)
      expect(systemOnly.list[0].type).toBe('system')

      const all = await findNotificationsByUser(user.id, { page: 1, pageSize: 10 })
      expect(all.total).toBe(2)
    })

    it('findNotificationsByUser 按 unreadOnly 过滤', async () => {
      const user = await createTestUser('13900000003')
      const n1 = await createNotification({ userId: user.id, type: 'system', title: 'n1' })
      await createNotification({ userId: user.id, type: 'system', title: 'n2' })

      await markAsRead(n1.id, user.id)

      const unreadOnly = await findNotificationsByUser(user.id, {
        page: 1,
        pageSize: 10,
        unreadOnly: true,
      })
      expect(unreadOnly.total).toBe(1)
      expect(unreadOnly.list[0].title).toBe('n2')
    })

    it('不同用户的通知互不影响', async () => {
      const user1 = await createTestUser('13900000004')
      const user2 = await createTestUser('13900000005')
      await createNotification({ userId: user1.id, type: 'system', title: 'user1 通知' })
      await createNotification({ userId: user2.id, type: 'system', title: 'user2 通知' })

      const r1 = await findNotificationsByUser(user1.id, { page: 1, pageSize: 10 })
      const r2 = await findNotificationsByUser(user2.id, { page: 1, pageSize: 10 })
      expect(r1.total).toBe(1)
      expect(r2.total).toBe(1)
      expect(r1.list[0].title).toBe('user1 通知')
    })
  })

  describe('countUnread / markAsRead / markAllAsRead', () => {
    it('未读计数正确', async () => {
      const user = await createTestUser('13900000006')
      await createNotification({ userId: user.id, type: 'system', title: 'n1' })
      await createNotification({ userId: user.id, type: 'system', title: 'n2' })

      expect(await countUnread(user.id)).toBe(2)
    })

    it('markAsRead — 单条标记已读', async () => {
      const user = await createTestUser('13900000007')
      const n = await createNotification({ userId: user.id, type: 'system', title: '待读' })

      const updated = await markAsRead(n.id, user.id)
      expect(updated).toBeDefined()
      expect(updated!.isRead).toBe(true)
      expect(await countUnread(user.id)).toBe(0)
    })

    it('markAsRead — 其他用户无法标记我的通知(权限隔离)', async () => {
      const user1 = await createTestUser('13900000008')
      const user2 = await createTestUser('13900000009')
      const n = await createNotification({ userId: user1.id, type: 'system', title: 'user1 通知' })

      // user2 尝试标记 user1 的通知 — 返回 undefined
      const failed = await markAsRead(n.id, user2.id)
      expect(failed).toBeUndefined()

      // 仍是未读
      const found = await findNotificationById(n.id)
      expect(found!.isRead).toBe(false)
    })

    it('markAllAsRead — 批量标记已读', async () => {
      const user = await createTestUser('13900000010')
      await createNotification({ userId: user.id, type: 'system', title: 'n1' })
      await createNotification({ userId: user.id, type: 'system', title: 'n2' })
      await createNotification({ userId: user.id, type: 'system', title: 'n3' })

      const count = await markAllAsRead(user.id)
      expect(count).toBe(3)
      expect(await countUnread(user.id)).toBe(0)
    })
  })

  describe('deleteNotification', () => {
    it('删除自己的通知', async () => {
      const user = await createTestUser('13900000011')
      const n = await createNotification({ userId: user.id, type: 'system', title: '待删除' })

      const deleted = await deleteNotification(n.id, user.id)
      expect(deleted).toBeDefined()

      const afterDelete = await findNotificationById(n.id)
      expect(afterDelete).toBeUndefined()
    })

    it('其他用户无法删除我的通知(权限隔离)', async () => {
      const user1 = await createTestUser('13900000012')
      const user2 = await createTestUser('13900000013')
      const n = await createNotification({ userId: user1.id, type: 'system', title: 'user1 通知' })

      const failed = await deleteNotification(n.id, user2.id)
      expect(failed).toBeUndefined()

      const stillExists = await findNotificationById(n.id)
      expect(stillExists).toBeDefined()
    })
  })

  describe('broadcastNotification', () => {
    it('群发通知给所有用户(含 system admin)', async () => {
      await createTestUser('13900000014')
      await createTestUser('13900000015')
      await createTestUser('13900000016')

      const notifications = await broadcastNotification({
        title: '系统公告',
        content: '维护通知',
        type: 'system',
      })

      // 含 system admin 共 4 人(3 测试用户 + admin)
      expect(notifications.length).toBeGreaterThanOrEqual(3)
      expect(notifications[0].title).toBe('系统公告')
      expect(notifications[0].isRead).toBe(false)
    })

    it('无测试用户时只通知 system admin(1 条)', async () => {
      const notifications = await broadcastNotification({
        title: '空',
        content: '',
        type: 'system',
      })
      // beforeEach 清空了非 system admin 用户,所以只剩 admin 一人
      expect(notifications).toHaveLength(1)
    })
  })

  describe('messages — findMessagesBetween + findConversations', () => {
    it('createMessage + findMessagesBetween — 双向消息查询', async () => {
      const user1 = await createTestUser('13900000017', '用户1')
      const user2 = await createTestUser('13900000018', '用户2')

      await createMessage(user1.id, user2.id, '你好')
      await createMessage(user2.id, user1.id, '你好啊')
      await createMessage(user1.id, user2.id, '今天天气如何?')

      // 从 user1 视角查询与 user2 的消息历史
      const result = await findMessagesBetween(user1.id, user2.id, 1, 10)
      expect(result.total).toBe(3)
      expect(result.list[0].content).toBe('你好')
      expect(result.list[1].content).toBe('你好啊')
      expect(result.list[2].content).toBe('今天天气如何?')
    })

    it('findMessagesBetween — 只返回双方之间的消息,不含第三方的', async () => {
      const user1 = await createTestUser('13900000019')
      const user2 = await createTestUser('13900000020')
      const user3 = await createTestUser('13900000021')

      await createMessage(user1.id, user2.id, '1→2')
      await createMessage(user1.id, user3.id, '1→3')
      await createMessage(user3.id, user2.id, '3→2')

      const result = await findMessagesBetween(user1.id, user2.id, 1, 10)
      expect(result.total).toBe(1)
      expect(result.list[0].content).toBe('1→2')
    })

    it('findConversations — 会话列表取每个对话最近一条', async () => {
      const user1 = await createTestUser('13900000022', '用户1')
      const user2 = await createTestUser('13900000023', '用户2')
      const user3 = await createTestUser('13900000024', '用户3')

      // user1 与 user2 的会话(最近一条)
      await createMessage(user1.id, user2.id, 'msg1')
      await createMessage(user2.id, user1.id, 'msg2(最新)')

      // user1 与 user3 的会话
      await createMessage(user1.id, user3.id, 'msg3')

      const result = await findConversations(user1.id, 1, 10)
      expect(result.total).toBe(2)

      // 两个会话都在结果中(不强制顺序,因同毫秒创建可能导致排序不稳定)
      const otherNicknames = result.list.map((c) => c.otherNickname).sort()
      expect(otherNicknames).toEqual(['用户2', '用户3'])

      // user2 会话的最近一条应为 msg2(最新)
      const user2Conv = result.list.find((c) => c.otherNickname === '用户2')
      expect(user2Conv).toBeDefined()
      expect(user2Conv!.content).toBe('msg2(最新)')
    })
  })
})
