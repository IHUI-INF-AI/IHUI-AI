// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'
import { deviceTokens } from '@ihui/database'

// =============================================================================
// Zod 校验 schema
// =============================================================================

const registerDeviceTokenSchema = z.object({
  /** 推送令牌(FCM registration token / APNS device token / Web Push 订阅),原样存储 */
  token: z.string().min(1).max(2000),
  /** 平台:ios / android / web */
  platform: z.enum(['ios', 'android', 'web']),
  /** 设备型号/名称,如 "iPhone15,2" */
  deviceType: z.string().max(100).optional(),
  /** 客户端版本号 */
  appVersion: z.string().max(50).optional(),
  /** 客户端语言区域,如 "zh-CN" */
  locale: z.string().max(20).optional(),
})

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>

// =============================================================================
// 设备路由
// =============================================================================

export const devicesRoutes: FastifyPluginAsync = async (server) => {
  // PUT /api/devices/token - 注册/更新当前用户的推送设备令牌
  // 同一 token 在 device_tokens 表中唯一;重复上报时 upsert 刷新元数据并置为 active。
  server.put('/devices/token', async (request, reply) => {
    await authenticate(request)
    const parsed = registerDeviceTokenSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const { token, platform, deviceType, appVersion, locale } = parsed.data

    const now = new Date()
    await db
      .insert(deviceTokens)
      .values({
        userId,
        token,
        platform,
        deviceType,
        appVersion,
        locale,
        isActive: true,
        lastUsedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: {
          userId,
          platform,
          deviceType,
          appVersion,
          locale,
          isActive: true,
          lastUsedAt: now,
          updatedAt: now,
        },
      })

    return reply.send(success({ token, platform, registered: true }))
  })

  // DELETE /api/devices/token - 注销当前用户的某个推送设备令牌(卸载/退出登录时调用)
  // 仅将 isActive 置 false,保留记录以便审计,不物理删除。
  server.delete('/devices/token', async (request, reply) => {
    await authenticate(request)
    const { token } = z.object({ token: z.string().min(1).max(2000) }).parse(request.body)
    const userId = request.userId!
    const result = await db
      .update(deviceTokens)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(deviceTokens.token, token), eq(deviceTokens.userId, userId)))
    void result
    return reply.send(success({ token, unregistered: true }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
