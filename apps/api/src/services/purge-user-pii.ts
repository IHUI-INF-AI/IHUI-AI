// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一 PII 清除服务（account deletion / GDPR erase 共用）。
 *
 * 背景（P0 隐私修复）：原 settings/delete-account 仅把 status 置 0（软禁用），
 * gdpr/erase 仅对 users 单表做匿名化 UPDATE，均不会触发 user_auth_info /
 * user_addresses / chat 会话 / 记忆 / 笔记 等子表的外键级联删除，
 * 导致身份证、地址、对话内容等 PII 仍然落库残留 —— 违反账号注销权 / 删除权。
 *
 * 本服务显式遍历删除/匿名化所有已知的用户 PII 子表（按 user_id 删除，幂等：
 * 无记录时 DELETE 不影响任何行、不报错），最后彻底匿名化 users 主行并吊销 token。
 *
 * 设计决策：
 * - 对 users 主行采用「彻底匿名化」而非硬删除：
 *   据实核对外键图后确认存在 onDelete=restrict 引用（api_key_shares.owner 等），
 *   硬删除 users 会命中 RESTRICT 约束而报错，且大量 set-null 业务外键会突然悬空，
 *   误伤面大。匿名化（清空 phone/email/username/passwordHash/life PII + status=3）
 *   在满足「PII 不可再识别」的同时保持审计/业务引用一致，且 authenticate()
 *   对 status=3 用户立即拒绝（= JWT 实已失效）。
 * - 每个子表单独 try/catch：个别表在特定环境缺失（如最新的 crash_reports /
 *   device_tokens）不影响其余表清理，且重复调用安全。
 */

import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  users,
  userAuthInfo,
  userAddresses,
  userDevices,
  chatConversations,
  agentMemoryEpisodic,
  agentMemorySemantic,
  agentMemoryProcedural,
  userMemories,
  notes,
  behaviorWatchRecords,
  oauthSessions,
  oauthUsers,
  userThirdPartyAccounts,
  userSk,
  userPreferences,
  userPasskeys,
  deviceTokens,
  crashReports,
  visitLogs,
} from '@ihui/database'
import { revokeAllUserRefreshTokens } from '../db/queries.js'
import type { Database } from '../db/index.js'
import type { AnyPgTable, AnyPgColumn } from 'drizzle-orm/pg-core'
import { logger } from '../utils/logger.js'

/** 用户在 users 主行上被彻底匿名化后的落库态。 */
const ERASED_NICKNAME = '已注销用户'

// 需要按 user_id 显式删除的 PII 子表。
// 均为 userId 外键；其中 crash_reports / visit_logs 虽为 onDelete=set null，
// 但删除「该用户的记录」而非置空，更彻底。
const USER_SCOPED_TABLES: Array<{ table: AnyPgTable; userCol: AnyPgColumn; label: string }> = [
  { table: userAuthInfo, userCol: userAuthInfo.userUuid, label: 'user_auth_info' },
  { table: userAddresses, userCol: userAddresses.userId, label: 'user_addresses' },
  { table: userDevices, userCol: userDevices.userId, label: 'user_devices' },
  { table: chatConversations, userCol: chatConversations.userId, label: 'chat_conversations' }, // 级联删除 chat_messages / archives / favorites
  {
    table: agentMemoryEpisodic,
    userCol: agentMemoryEpisodic.userId,
    label: 'agent_memory_episodic',
  },
  {
    table: agentMemorySemantic,
    userCol: agentMemorySemantic.userId,
    label: 'agent_memory_semantic',
  },
  {
    table: agentMemoryProcedural,
    userCol: agentMemoryProcedural.userId,
    label: 'agent_memory_procedural',
  },
  { table: userMemories, userCol: userMemories.userId, label: 'user_memories' },
  { table: notes, userCol: notes.userId, label: 'notes' },
  {
    table: behaviorWatchRecords,
    userCol: behaviorWatchRecords.userId,
    label: 'behavior_watch_records',
  },
  { table: oauthSessions, userCol: oauthSessions.userId, label: 'oauth_sessions' },
  { table: oauthUsers, userCol: oauthUsers.userId, label: 'oauth_users' },
  {
    table: userThirdPartyAccounts,
    userCol: userThirdPartyAccounts.userId,
    label: 'user_third_party_accounts',
  },
  { table: userSk, userCol: userSk.userId, label: 'user_sk' },
  { table: userPreferences, userCol: userPreferences.userId, label: 'user_preferences' },
  { table: userPasskeys, userCol: userPasskeys.userId, label: 'user_passkeys' },
  { table: deviceTokens, userCol: deviceTokens.userId, label: 'device_tokens' },
  { table: crashReports, userCol: crashReports.userId, label: 'crash_reports' },
  { table: visitLogs, userCol: visitLogs.userId, label: 'visit_logs' },
]

interface PurgeResult {
  userPiiTableCount: number
  userRowAnonymized: boolean
}

/**
 * 清除指定用户的全部 PII。幂等：可重复调用，返回本次实际清理的子表数量。
 */
export async function purgeUserPii(userId: string, tx: Database = db): Promise<PurgeResult> {
  let cleaned = 0
  for (const { table, userCol, label } of USER_SCOPED_TABLES) {
    try {
      await (tx as Database).delete(table).where(eq(userCol, userId))
      cleaned++
    } catch (err) {
      // 单表失败不阻断整体清理；记录以便运维跟进（尤其缺失表/权限受限的情况）
      logger.warn(`[purge-user-pii] ${label} 清理失败(已跳过): ${(err as Error).message}`)
    }
  }

  // 吊销该用户所有 refresh token（杜绝续期路径，配合 authenticate() 的 status=3 检查）
  try {
    await revokeAllUserRefreshTokens(userId)
  } catch (err) {
    logger.warn(`[purge-user-pii] refresh token 吊销失败: ${(err as Error).message}`)
  }

  // 彻底匿名化 users 主行（见文件头设计决策）
  const baseUsername = `erased_${userId}`
  await (tx as Database)
    .update(users)
    .set({
      phone: null,
      email: null,
      username: baseUsername.slice(0, 64),
      passwordHash: null,
      nickname: ERASED_NICKNAME,
      avatar: null,
      bio: null,
      inviteCode: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
      twoFactorEnabledAt: null,
      status: 3,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))

  return { userPiiTableCount: cleaned, userRowAnonymized: true }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
