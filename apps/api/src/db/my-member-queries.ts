import { eq, and, desc } from 'drizzle-orm'
import { db } from './index.js'
import { users, userVips, vipLevels, type User } from '@ihui/database'

export interface MyMemberInfo {
  user: Pick<
    User,
    | 'id'
    | 'phone'
    | 'email'
    | 'username'
    | 'nickname'
    | 'avatar'
    | 'bio'
    | 'gender'
    | 'isVip'
    | 'status'
    | 'createdAt'
  >
  vipLevel: {
    levelValue: number
    levelName: string | null
    endTime: Date | null
    status: number | null
  } | null
}

/**
 * 查询当前用户会员信息：基础资料 + 生效中的 VIP 等级。
 */
export async function findMyMember(userId: string): Promise<MyMemberInfo | undefined> {
  const rows = await db
    .select({
      id: users.id,
      phone: users.phone,
      email: users.email,
      username: users.username,
      nickname: users.nickname,
      avatar: users.avatar,
      bio: users.bio,
      gender: users.gender,
      isVip: users.isVip,
      status: users.status,
      createdAt: users.createdAt,
      vipLevelValue: userVips.levelValue,
      vipLevelName: vipLevels.levelName,
      vipEndTime: userVips.endTime,
      vipStatus: userVips.status,
    })
    .from(users)
    .leftJoin(userVips, and(eq(userVips.userId, users.id), eq(userVips.status, 1)))
    .leftJoin(vipLevels, eq(userVips.vipLevelId, vipLevels.id))
    .where(eq(users.id, userId))
    .orderBy(desc(userVips.endTime))
    .limit(1)

  const row = rows[0]
  if (!row) return undefined

  const hasVip = row.vipEndTime !== null || row.vipLevelValue !== null
  return {
    user: {
      id: row.id,
      phone: row.phone,
      email: row.email,
      username: row.username,
      nickname: row.nickname,
      avatar: row.avatar,
      bio: row.bio,
      gender: row.gender,
      isVip: row.isVip,
      status: row.status,
      createdAt: row.createdAt,
    },
    vipLevel: hasVip
      ? {
          levelValue: row.vipLevelValue ?? 0,
          levelName: row.vipLevelName,
          endTime: row.vipEndTime,
          status: row.vipStatus,
        }
      : null,
  }
}
