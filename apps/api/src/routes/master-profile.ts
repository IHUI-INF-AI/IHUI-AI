// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管显示名(2026-11-28 立)。
 *
 * 只改“用户怎么称呼自己的总智能体”，不改 master.md 的固定人格、三工具和审批边界。
 * 落库复用 user_preferences(group='master_profile', key='display_name')，零新表。
 *
 * 端点:
 *   GET    /profile  当前用户的总管名(无则返回默认“总管”)
 *   PUT    /profile  设置/改名
 *   DELETE /profile  恢复默认
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import {
  deleteUserPreference,
  findUserPreferences,
  upsertUserPreference,
  USER_PREFERENCE_GROUPS,
} from '../db/user-preferences-queries.js'

const PROFILE_GROUP = USER_PREFERENCE_GROUPS.masterProfile
const PROFILE_KEY = 'display_name'
const DEFAULT_DISPLAY_NAME = '总管'
const MAX_DISPLAY_NAME = 24

/**
 * 名字允许中文、英文字母、数字、空格、下划线和中间点。
 * 不收标点/换行/引号，避免名字被拼进 system prompt 时形成指令分隔符。
 */
const displayNameSchema = z
  .string()
  .trim()
  .min(1, '名字不能为空')
  .max(MAX_DISPLAY_NAME, `名字最多 ${MAX_DISPLAY_NAME} 个字符`)
  .regex(/^[\u4e00-\u9fffA-Za-z0-9_·\- ]+$/, '名字只能包含中英文、数字、空格、下划线或中间点')

function profileBody(displayName: string, isCustom: boolean) {
  return {
    displayName,
    defaultDisplayName: DEFAULT_DISPLAY_NAME,
    maxLength: MAX_DISPLAY_NAME,
    isCustom,
  }
}

async function readDisplayName(userId: string): Promise<string> {
  const { list } = await findUserPreferences(userId, PROFILE_GROUP)
  const row = list.find((item) => item.key === PROFILE_KEY)
  const value = row?.value?.trim()
  if (!value || !displayNameSchema.safeParse(value).success) return DEFAULT_DISPLAY_NAME
  return value
}

export const masterProfileRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request, reply) => {
    await requireAuth(request, reply)
    // 鉴权失败时 requireAuth 已发 401；这里显式止住，避免无 userId 继续进 handler。
    if (reply.sent) return
  })

  server.get('/profile', async (request, reply) => {
    const displayName = await readDisplayName(request.userId!)
    return reply.send(success(profileBody(displayName, displayName !== DEFAULT_DISPLAY_NAME)))
  })

  server.put('/profile', async (request, reply) => {
    const parsed = z
      .object({ displayName: displayNameSchema })
      .safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '名字不合法'))
    }
    const displayName = parsed.data.displayName
    if (displayName === DEFAULT_DISPLAY_NAME) {
      await deleteUserPreference(request.userId!, PROFILE_GROUP, PROFILE_KEY)
      return reply.send(success(profileBody(DEFAULT_DISPLAY_NAME, false)))
    }
    await upsertUserPreference(request.userId!, PROFILE_GROUP, PROFILE_KEY, displayName)
    return reply.send(success(profileBody(displayName, true)))
  })

  server.delete('/profile', async (request, reply) => {
    await deleteUserPreference(request.userId!, PROFILE_GROUP, PROFILE_KEY)
    return reply.send(success(profileBody(DEFAULT_DISPLAY_NAME, false)))
  })
}
