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
 * - F-269:全部子表删除 + 主行匿名化包进**同一事务**。原实现逐表 try/catch 只 warn，
 *   单表失败被静默跳过却仍返回 userPiiTableCount / userRowAnonymized=true，
 *   注销接口照常回「已删除」—— 用户以为 PII 已清除，实际仍落库。现在任一步失败
 *   抛 PurgeUserPiiError 并整体回滚，接口以 500 如实失败，可重试（操作本身幂等）。
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
  apiKeyShares,
  developerApiKeys,
  userEmails,
  securityLogs,
  devices,
  devicePairCodes,
  deviceTasks,
} from '@ihui/database'
import { revokeAllUserRefreshTokens } from '../db/queries.js'
import type { Database } from '../db/index.js'
import type { AnyPgTable, AnyPgColumn } from 'drizzle-orm/pg-core'

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
  // F-269(2026-11-08):补齐后建表 —— 注销后明文邮箱/安全日志/设备指纹仍会残留。
  { table: userEmails, userCol: userEmails.userId, label: 'user_emails' },
  { table: securityLogs, userCol: securityLogs.userId, label: 'security_logs' },
  // device_tasks 先删(其 target_device_id 级联自 devices),再删配对码与设备。
  { table: deviceTasks, userCol: deviceTasks.createdBy, label: 'device_tasks' },
  { table: devicePairCodes, userCol: devicePairCodes.userId, label: 'device_pair_codes' },
  { table: devices, userCol: devices.userId, label: 'devices' },
  // SDB-29:开发者 API Key 与分享 token 是可直接调用付费接口的凭据,注销必须吊销。
  // 先删 api_key_shares(其 created_by 为 RESTRICT、source_api_key_id 为 CASCADE),
  // 再删 developer_api_keys,避免 RESTRICT 把 Key 留在 active 态。
  { table: apiKeyShares, userCol: apiKeyShares.createdBy, label: 'api_key_shares' },
  { table: developerApiKeys, userCol: developerApiKeys.userId, label: 'developer_api_keys' },
]

interface PurgeResult {
  userPiiTableCount: number
  userRowAnonymized: boolean
}

/** PII 擦除在某一步失败(整体已回滚)。stage 为表名或 refresh_tokens。 */
export class PurgeUserPiiError extends Error {
  readonly stage: string
  constructor(stage: string, cause: unknown) {
    super(`PII purge failed at ${stage}: ${(cause as Error).message}`)
    this.name = 'PurgeUserPiiError'
    this.stage = stage
    this.cause = cause
  }
}

/**
 * 清除指定用户的全部 PII。幂等：可重复调用，返回本次实际清理的子表数量。
 *
 * F-269:子表删除与主行匿名化在同一事务内完成；任一步失败抛出并整体回滚，
 * 不再「单表失败只记 warn、接口仍报已删除」。
 */
export async function purgeUserPii(userId: string, tx?: Database): Promise<PurgeResult> {
  const run = async (t: Database): Promise<PurgeResult> => {
    let cleaned = 0
    for (const { table, userCol, label } of USER_SCOPED_TABLES) {
      try {
        await t.delete(table).where(eq(userCol, userId))
        cleaned++
      } catch (err) {
        throw new PurgeUserPiiError(label, err)
      }
    }

    // 彻底匿名化 users 主行（见文件头设计决策）
    const baseUsername = `erased_${userId}`
    // 2026-09-27 布尔删除 ack 清账(第四型):userRowAnonymized 此前是硬编码 true ——
    // UPDATE 命中 0 行(用户行不存在/并发被删)时旧代码仍报"已匿名化"。
    // 现由 RETURNING 命中集派生;响应侧键名与语义逐字不变,只允许值从常量变成库侧证据。
    let anonymizedRows: Array<{ id: string }>
    try {
      anonymizedRows = await t
        .update(users)
        .set({
          phone: null,
          email: null,
          username: baseUsername.slice(0, 64),
          passwordHash: null,
          nickname: ERASED_NICKNAME,
          avatar: null,
          bio: null,
          gender: 0,
          birthday: null,
          inviteCode: null,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
          twoFactorEnabledAt: null,
          status: 3,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({ id: users.id })
    } catch (err) {
      throw new PurgeUserPiiError('users', err)
    }

    return { userPiiTableCount: cleaned, userRowAnonymized: anonymizedRows.length > 0 }
  }

  const result = tx ? await run(tx) : await db.transaction(async (t) => run(t as unknown as Database))

  // 吊销该用户所有 refresh token（杜绝续期路径，配合 authenticate() 的 status=3 检查）。
  // 放在事务外：token 表独立于 PII 事务；失败必须上抛，不能静默。
  try {
    await revokeAllUserRefreshTokens(userId)
  } catch (err) {
    throw new PurgeUserPiiError('refresh_tokens', err)
  }

  return result
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
