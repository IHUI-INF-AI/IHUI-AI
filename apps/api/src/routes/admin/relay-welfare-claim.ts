// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 权益活动领取**判据预览面**(2026-11-18 立)。
 *
 * `GET  /api/admin/relay/welfare/status` —— 端点是否已实证(只说配了没,不泄漏细节)
 * `POST /api/admin/relay/welfare/plan`   —— 给一份活动快照,算出该领哪些、按什么顺序
 *
 * 关键设计:**`providerVerified` 由服务端 env 决定,请求方不能传**。
 * 若让请求体自带这个布尔,任何人都能把闸拨开 → 判据形同虚设。
 * 唯一开闸方式 = 机主在本机实证后设 `RELAY_WELFARE_ENDPOINT_VERIFIED=1`。
 *
 * 本端点只算不做:真正发起在 ai-service 侧;此处保证"该拨的才拨、不该拨的一枚都不拨"。
 */
import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error } from '../../utils/response.js'
import { planWelfareClaim } from '../../services/relay-welfare-claim.js'

const campaignSchema = z.object({
  id: z.string().max(128),
  title: z.string().max(256).optional(),
  kind: z.string().max(64).nullish(),
  state: z.string().max(64).nullish(),
})

const bodySchema = z.object({
  campaigns: z.array(campaignSchema).max(200),
  alreadyClaimedIds: z.array(z.string().max(128)).max(200).optional(),
})

function endpointVerified(): boolean {
  return process.env['RELAY_WELFARE_ENDPOINT_VERIFIED'] === '1'
}

export const relayWelfareClaimRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/admin/relay/welfare/status', async (_request, reply) => {
    const verified = endpointVerified()
    return reply.send(
      success({
        endpoint_verified: verified,
        note: verified
          ? '端点已由机主声明实证:plan 会给出可执行的领取动作'
          : '端点未实证:plan 一律返回 refused,不产出任何领取动作(要开先补取证,再设 RELAY_WELFARE_ENDPOINT_VERIFIED=1)',
      }),
    )
  })

  server.post('/admin/relay/welfare/plan', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .code(400)
        .send(error(400, 'campaigns 必填(每条需 id,数组 ≤200);alreadyClaimedIds 可选'))
    }

    const plan = planWelfareClaim({
      campaigns: parsed.data.campaigns,
      providerVerified: endpointVerified(),
      alreadyClaimedIds: parsed.data.alreadyClaimedIds ?? [],
    })

    return reply.send(
      success({
        refused: plan.refused,
        refusal: plan.refusal ?? null,
        actions: plan.actions,
        summary: plan.summary,
        note: plan.refused
          ? '本轮不发起任何领取请求;refusal 里点名了原因'
          : '按 actions 逐条执行即可;replayed 视为已领成功,不要记成失败',
      }),
    )
  })
}

export default relayWelfareClaimRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
