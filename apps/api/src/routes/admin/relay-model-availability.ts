// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 未上架/不可用模型清单(2026-11-17 立)。
 *
 * `GET /api/admin/relay/models/unavailable` —— 把 /v1/models **不返回**的那些模型连同原因交出来。
 *
 * 为什么独立成插件:它只读、只服务于「模型不见了去哪了」这一个问题,不该挤进已经在飞的
 * 号池管理文件;独立插件也让端点能被轻量 Fastify 直接钉住。
 *
 * 判据全部在 `model-availability-explain.ts`(纯函数);本文件只做查询与投影。
 * 权限:沿用 `requireAdmin`(与号池管理面同档),清单含内部 provider 名,不对外公开。
 */
import { or, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { aiModelConfig, aiModelConfigModels } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success } from '../../utils/response.js'
import { dbRead } from '../../db/index.js'
import { explainModelAvailability } from '../../services/model-availability-explain.js'

const LIST_LIMIT = 500

export const relayModelAvailabilityRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/admin/relay/models/unavailable', async (_request, reply) => {
    const rows = await dbRead
      .select({
        modelId: aiModelConfigModels.modelId,
        displayName: aiModelConfigModels.displayName,
        enabled: aiModelConfigModels.enabled,
        isRelayPublic: aiModelConfigModels.isRelayPublic,
        lastTestStatus: aiModelConfigModels.lastTestStatus,
        lastTestError: aiModelConfigModels.lastTestError,
        providerCode: aiModelConfig.providerCode,
        configName: aiModelConfig.name,
      })
      .from(aiModelConfigModels)
      .innerJoin(aiModelConfig, eq(aiModelConfig.id, aiModelConfigModels.configId))
      .where(
        or(
          eq(aiModelConfigModels.enabled, false),
          eq(aiModelConfigModels.isRelayPublic, false),
          eq(aiModelConfigModels.lastTestStatus, 'FAIL'),
        ),
      )
      .limit(LIST_LIMIT)

    const items = rows
      .map((row) => {
        const explain = explainModelAvailability(row)
        return {
          model_id: row.modelId,
          display_name: row.displayName ?? row.modelId,
          provider_code: row.providerCode,
          config_name: row.configName,
          visible_in_v1_models: explain.visible,
          category: explain.category,
          disabled_message: explain.reason,
          reason_source: explain.reason_source,
        }
      })
      // 判据说可见的行(例如仅 lastTestStatus 命中但实为 PASS 的误捕)不回传
      .filter((item) => !item.visible_in_v1_models)

    return reply.send(
      success({
        total: items.length,
        limit: LIST_LIMIT,
        items,
        note:
          '这是 /v1/models 的补集:每条都给出「为什么看不到」。disabled_message 取库内原文,' +
          '库内没有原因时标注 reason_source=enabled_flag/not_public_flag 并明说未记录原因。',
      }),
    )
  })
}

export default relayModelAvailabilityRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
