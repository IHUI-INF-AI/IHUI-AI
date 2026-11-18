// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 接入套件端点(2026-11-18 立)。
 *
 * `POST /api/admin/relay/access-kit` —— 一次调用完成:
 *   ① 建一枚 Key(复用既有 `generateApiKey`/`hashSecret`,不另造生成器);
 *   ② 拼装接入信息(地址/Key/模型/协议四行);
 *   ③ 给面板直达链接(默认不含 Key);
 *   ④ 若指定客户端,连同该客户端的可粘贴配置一并给出。
 *
 * 为什么放这里而不是让运营去三个页面凑:建 Key、拼地址、找客户端配置是同一件事,
 * 拆成三处就会出现「Key 建好了但地址填错」「配置给了但模型漏了」这类接不通工单。
 *
 * 纪律:Key 明文只在本响应里出现一次(落库只存哈希,与既有表一致);不带 Key 的链接默认。
 */
import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { developerApiKeys } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error } from '../../utils/response.js'
import { generateApiKey, hashSecret } from '../../utils/api-key-hash.js'
import { buildAccessKit } from '../../services/relay-access-kit.js'
import { buildClientConfig } from '../../services/relay-client-config.js'

const bodySchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  baseUrl: z.string().min(1).max(512),
  mode: z.enum(['lan', 'public']),
  model: z.string().max(128).optional(),
  client: z.string().max(64).optional(),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  egressRegion: z.string().max(32).optional(),
  includeKeyInLink: z.boolean().optional(),
  tenantId: z.string().uuid().nullable().optional(),
})

export const relayAccessKitRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.post('/admin/relay/access-kit', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .code(400)
        .send(error(400, parsed.error.issues[0]?.message ?? 'userId/name/baseUrl/mode 必填'))
    }

    const b = parsed.data
    const { key, secret } = generateApiKey()

    // 先拼装(纯函数,失败就不落库 —— 不建一枚用不上的 Key)
    const kit = buildAccessKit({
      baseUrl: b.baseUrl,
      apiKey: secret,
      mode: b.mode,
      model: b.model,
      includeKeyInLink: b.includeKeyInLink,
    })
    if (!kit.ok) {
      return reply.code(400).send(error(400, kit.reason ?? '接入套件拼装失败', kit.code))
    }

    try {
      const [record] = await db
        .insert(developerApiKeys)
        .values({
          userId: b.userId,
          name: b.name,
          key,
          secret: hashSecret(secret),
          permissions: b.permissions ?? [],
          rateLimit: b.rateLimit ?? 60,
          tenantId: b.tenantId ?? null,
          // Key 级出口绑定(与既有表字段同名同义)
          egressRegion: b.egressRegion ?? null,
        })
        .returning({ id: developerApiKeys.id, key: developerApiKeys.key, createdAt: developerApiKeys.createdAt })

      if (!record) return reply.code(500).send(error(500, '创建 API Key 失败'))

      // 指定了客户端才附配置;未知客户端由 buildClientConfig 自带 400 语义,这里不拦(只报原因)
      const clientConfig = b.client
        ? buildClientConfig({
            client: b.client,
            baseUrl: b.baseUrl,
            apiKey: secret,
            model: b.model,
            region: b.egressRegion,
          })
        : null

      return reply.code(201).send(
        success({
          id: record.id,
          key: record.key,
          /** 完整 Key:仅本响应可见一次,落库只存哈希 */
          secret,
          panel_link: kit.panelLink ?? null,
          handoff: kit.handoff ?? '',
          warnings: kit.warnings,
          client_config: clientConfig && clientConfig.ok
            ? {
                client: clientConfig.client,
                client_label: clientConfig.clientLabel,
                format: clientConfig.format,
                body: clientConfig.body,
                warnings: clientConfig.warnings,
              }
            : clientConfig && !clientConfig.ok
              ? { error: clientConfig.reason }
              : null,
          note: '把 handoff 四行发给使用者即可;Key 明文只出现这一次,丢了就吊销重发',
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.code(500).send(error(500, '创建接入套件失败'))
    }
  })
}

export default relayAccessKitRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
