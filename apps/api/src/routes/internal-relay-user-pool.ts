// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 个人号池反向同步内网端点(2026-10-23 立)。
 *
 * 正向(号池→签到助手)走 O64 的 pool-sync;本文件补反向:
 * 用户在签到助手录入/更新/删除自己的第三方账号时,ai-service 回调这里,
 * 把同一归属的账号回填到「该用户的个人号池」(ai_relay_account_pool.owner_user_id)。
 *
 * - POST /api/internal/relay/user-pool/upsert:复用 importAccounts 的映射/加密/
 *   唯一性/credVersion;importAccounts 随后会把行推回签到侧,签到侧写回
 *   device_map.pool_account_id —— 双向链接由此建立(同一身份合并,不建重复行)。
 * - POST /api/internal/relay/user-pool/delete:签到侧删除时清掉对应个人池行。
 *   刻意不推 pool_deleted 回签到侧(账号已经不存在,推了只会原地打转)。
 *
 * 鉴权两层:① X-Internal-Secret = config.AI_CALLBACK_SECRET(机机凭据);
 * ② 承载层主体 = checkInternalServiceToken 验短期票(scope 'ai-callback')后注入的
 *    request.userId(AGENTS §5「认证不等于授权」,形态同 internal-user-broadcast.ts:65)。
 *
 * Y-24 收口(2026-11-06):**归属主体不再取自请求体** —— 原先 body.ownerUserId 直接进归属
 * 谓词与 importAccounts,持机机凭据者可写/删任意用户的个人池行(身份住在客户端可整写字段)。
 * 现在主体只来自承载层;body 那一位降级为兼容窗核对位(判序见 resolveOwnerSubject)。运营池在此
 * 结构上不可达:承载层主体必须是 uuid ∧ 存在 ∧ 活跃的用户(见 internal-service-token 的 injectVerifiedUser)。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { aiRelayAccountPool } from '@ihui/database'
import { config } from '../config/index.js'
import { db, dbRead } from '../db/index.js'
import { error, success } from '../utils/response.js'
import { checkInternalServiceToken, secretsEqual } from '../plugins/internal-service-token.js'
import { importAccounts } from '../services/relay-account-pool-service.js'
import { isRelayProviderCode } from '../services/relay-account-format.js'

/** 运营池主体:不可能是承载层注入的已验证用户(非 uuid) */
const OPERATIONS_POOL_OWNER = 'system:relay-pool'

/** 签到平台 → 号池 provider 同名;minimax 无号池适配器(如实 unsupported) */
const CHECKIN_PLATFORM_TO_PROVIDER = new Set(['trae', 'workbuddy', 'qoder'])

const upsertBodySchema = z.object({
  // 兼容窗核对位(2026-11-06 起不是主体来源;与承载层主体不符即 403)
  ownerUserId: z.string().min(1).max(64).optional(),
  platform: z.string().min(1).max(32),
  checkinAccountId: z.number().int().positive(),
  // 第三方账号 uid(业务数据,由票内主体自己的凭证推导);不参与归属判定
  identityKey: z.string().min(1).max(128),
  name: z.string().max(128).optional(),
  token: z.string().min(1).max(8192),
  refreshToken: z.string().max(8192).nullable().optional(),
  cookies: z.array(z.unknown()).max(200).optional(),
  deviceMap: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
})

const deleteBodySchema = z.object({
  ownerUserId: z.string().min(1).max(64).optional(), // 同上:兼容窗核对位
  poolAccountId: z.string().min(1).max(64),
})

function strField(src: Record<string, unknown>, key: string): string | undefined {
  const v = src[key]
  return typeof v === 'string' && v ? v : undefined
}

/** device_map.cosy 是蛇形键;mapQoderImport 的入参读驼峰(对齐导入 JSON 格式) */
function cosyToImportKeys(deviceMap: Record<string, unknown>): Record<string, string> {
  const cosy = deviceMap.cosy
  if (!cosy || typeof cosy !== 'object' || Array.isArray(cosy)) return {}
  const c = cosy as Record<string, unknown>
  const out: Record<string, string> = {}
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ['machine_token', 'machineToken'],
    ['machine_code', 'machineCode'],
    ['machine_type', 'machineType'],
    ['version', 'version'],
  ]
  for (const [srcKey, dstKey] of pairs) {
    const v = strField(c, srcKey)
    if (v) out[dstKey] = v
  }
  return out
}

/**
 * 设备证明密钥对(2026-10-26 补链):签到侧 device_map 里带 pool_device_key_pem /
 * pool_device_pub_pem 时透进导入器,由 mapTraeImport 收进 secretsEnc。
 * 缺任一键 ⇒ 不带(桌面渠道签发的票将只能等客户端在场时回灌,行为同旧)。
 */
function deviceKeysToImportKeys(deviceMap: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  const priv = strField(deviceMap, 'pool_device_key_pem')
  const pub = strField(deviceMap, 'pool_device_pub_pem')
  if (priv) out.deviceKeyPem = priv
  if (pub) out.devicePubPem = pub
  return out
}

const internalRelayUserPoolRoutes: FastifyPluginAsync = async (server) => {
  const requireInternal = (request: { headers: Record<string, unknown> }): string | null => {
    const secret = config.AI_CALLBACK_SECRET
    if (!secret) return '内部密钥未配置(AI_CALLBACK_SECRET)'
    const provided = request.headers['x-internal-secret']
    // 2026-11-01 安全强化:改走 secretsEqual 单源(internal-service-token.ts:130)。
    // 裸 `!==` 是非常数时间比较,而兄弟文件
    // internal-relay-account-pool-credential.ts 早在 2026-10-31 那批已改过 —— 同一枚
    // AI_CALLBACK_SECRET 在两处用两种强度比,漏的那一侧不会响。
    if (typeof provided !== 'string' || !secretsEqual(provided, secret)) return '内部密钥不匹配'
    return null
  }

  /**
   * 归属主体解析的唯一出口(AGENTS §5「认证不等于授权」):只认承载层 —— checkInternalServiceToken
   * 验短期票(scope 'ai-callback';dual 窗内兼容常驻密钥 + X-User-Id)后注入的 request.userId,
   * 该出口已把主体钉在「uuid ∧ 存在 ∧ 活跃」。`declared`(body 那一位)可整写 ⇒ 不作来源:
   * 不符即 403 具名拒(Y-24 那一格),相等也只在日志点名"已忽略"后按主体落库。
   * 返回 null = 已发 4xx,调用方直接 return。
   */
  const resolveOwnerSubject = async (
    request: FastifyRequest,
    reply: FastifyReply,
    declared: string | undefined,
  ): Promise<string | null> => {
    if (declared === OPERATIONS_POOL_OWNER) {
      reply.status(400).send(error(400, '运营池账号不走反向同步端点'))
      return null
    }
    if (!(await checkInternalServiceToken(request, reply, { scope: 'ai-callback' }))) return null
    const subject = request.userId
    if (!subject) {
      request.log.error('[user-pool] 承载层未注入已验证主体,拒写(宁拒不猜)')
      reply.status(401).send(error(401, 'Verified principal required'))
      return null
    }
    if (declared && declared !== subject) {
      request.log.warn(
        { ip: request.ip, endpoint: request.url },
        '[user-pool] 自报的 ownerUserId 与已验证主体不符 ⇒ 拒(不接受客户端自报身份)',
      )
      reply.status(403).send(error(403, 'ownerUserId 不得由客户端自报:与内部票主体不符'))
      return null
    }
    if (declared) request.log.warn('[user-pool] 兼容窗:自报位仅作核对,归属一律取承载层主体')
    return subject
  }

  server.post('/api/internal/relay/user-pool/upsert', async (request, reply) => {
    const authErr = requireInternal(request)
    if (authErr)
      return reply.status(authErr.includes('未配置') ? 503 : 401).send(error(503, authErr))
    const parsed = upsertBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '个人号池同步参数错误'))
    }
    const body = parsed.data
    const ownerUserId = await resolveOwnerSubject(request, reply, body.ownerUserId)
    if (!ownerUserId) return
    if (!CHECKIN_PLATFORM_TO_PROVIDER.has(body.platform) || !isRelayProviderCode(body.platform)) {
      return reply
        .status(200)
        .send(success({ status: 'unsupported', reason: `平台 ${body.platform} 无号池适配器` }))
    }
    const dm = body.deviceMap ?? {}
    try {
      const result = await importAccounts(
        body.platform,
        [
          {
            name: body.name ?? body.identityKey,
            uid: body.identityKey,
            token: body.token,
            refreshToken: body.refreshToken ?? undefined,
            deviceId: strField(dm, 'pool_device_id'),
            machineId: strField(dm, 'pool_machine_id'),
            proxyUrl: strField(dm, 'proxy'),
            cookies: body.cookies,
            enabled: body.enabled,
            ...(body.platform === 'qoder' ? cosyToImportKeys(dm) : {}),
            ...(body.platform === 'trae' ? deviceKeysToImportKeys(dm) : {}),
          },
        ],
        ownerUserId,
      )
      const item = result.items[0]
      if (!item || item.status === 'failed') {
        return reply.status(400).send(error(400, item?.reason ?? '个人号池同步失败'))
      }
      const [row] = await dbRead
        .select({ id: aiRelayAccountPool.id })
        .from(aiRelayAccountPool)
        .where(
          and(
            eq(aiRelayAccountPool.ownerUserId, ownerUserId),
            eq(aiRelayAccountPool.providerCode, body.platform),
            eq(aiRelayAccountPool.uid, item.uid ?? body.identityKey),
          ),
        )
        .limit(1)
      return reply.send(
        success({
          status: item.status,
          poolAccountId: row?.id ?? null,
          checkinAccountId: body.checkinAccountId,
        }),
      )
    } catch (e) {
      request.log.error(e, '[user-pool] 个人号池反向同步失败')
      return reply.status(500).send(error(500, '个人号池反向同步失败'))
    }
  })

  server.post('/api/internal/relay/user-pool/delete', async (request, reply) => {
    const authErr = requireInternal(request)
    if (authErr)
      return reply.status(authErr.includes('未配置') ? 503 : 401).send(error(503, authErr))
    const parsed = deleteBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '个人号池删除参数错误'))
    }
    const { ownerUserId: declared, poolAccountId } = parsed.data
    const ownerUserId = await resolveOwnerSubject(request, reply, declared)
    if (!ownerUserId) return
    try {
      const deleted = await db
        .delete(aiRelayAccountPool)
        .where(
          and(
            eq(aiRelayAccountPool.id, poolAccountId),
            eq(aiRelayAccountPool.ownerUserId, ownerUserId),
          ),
        )
        .returning({ id: aiRelayAccountPool.id })
      return reply.send(success({ deleted: deleted.length }))
    } catch (e) {
      request.log.error(e, '[user-pool] 个人号池删除失败')
      return reply.status(500).send(error(500, '个人号池删除失败'))
    }
  })
}

export default fp(internalRelayUserPoolRoutes, {
  name: 'internal-relay-user-pool',
})

/** 供镜像测试直用生产判据(§22c:禁止在测试里复制第二份映射) */
export const __test__ = { cosyToImportKeys, deviceKeysToImportKeys, strField }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
