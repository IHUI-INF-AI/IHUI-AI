// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 稳定设备身份派生面(2026-11-18 立)。
 *
 * `GET  /api/admin/relay/device-identity/status`  —— 盐配好了没、能不能派生(不泄漏盐)
 * `POST /api/admin/relay/device-identity/derive`  —— 给 uid(可选区)换一组稳定标识
 *
 * 为什么做成 admin 端点而不是直接改导入链路:派生值要**运营看得见、复制得走**,
 * 而导入链路的规范器是纯判据层(不读 env)。先用只读面把判据装车,运营在入池时
 * 把这三枚粘进 machineId/machineToken 即可;自动补齐的接入点登记在案
 * (relay-account-pool-service 的落库前补齐,待该文件在飞改动收口后接)。
 *
 * 纪律:
 * - 盐只从 env `RELAY_DEVICE_SALT` 取,响应里只说"配了/没配",**绝不回显盐**。
 * - 派生失败 ⇒ 400 + 原因 + 可执行出路(§0.8 不写跑不通的出路)。
 */
import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error } from '../../utils/response.js'
import {
  deriveDeviceIdentity,
  isDeviceIdentityDerivable,
  MIN_DEVICE_SALT_CHARS,
} from '../../services/relay-device-identity.js'

const deriveBodySchema = z.object({
  uid: z.string().min(1).max(128),
  /** cn / global;缺省 = 全区共用一套派生 */
  realm: z.string().max(32).optional(),
})

function envSalt(): string {
  const raw = process.env['RELAY_DEVICE_SALT']
  return typeof raw === 'string' ? raw : ''
}

export const relayDeviceIdentityRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/admin/relay/device-identity/status', async (_request, reply) => {
    const salt = envSalt()
    const configured = salt.length >= MIN_DEVICE_SALT_CHARS
    return reply.send(
      success({
        salt_configured: configured,
        min_salt_chars: MIN_DEVICE_SALT_CHARS,
        /** 用一枚占位 uid 探能否派生(不暴露真实账号) */
        derivable: isDeviceIdentityDerivable({ uid: 'probe', salt }),
        note: configured
          ? '盐已就位:可为一枚账号派生稳定的 machineid / machinetoken / sessionid'
          : `未配置 RELAY_DEVICE_SALT(需 ≥${MIN_DEVICE_SALT_CHARS} 字符):派生一律拒绝,不会退化成可穷举的弱标识`,
      }),
    )
  })

  server.post('/admin/relay/device-identity/derive', async (request, reply) => {
    const parsed = deriveBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send(error(400, 'uid 必填(≤128 字符),realm 可选(≤32 字符)'))
    }

    const salt = envSalt()
    const result = deriveDeviceIdentity({ uid: parsed.data.uid, salt, realm: parsed.data.realm })
    if (!result.ok) {
      // 失败必须给出路:前端据此显示"去配 env 再来",而不是笼统 500
      return reply.code(400).send(error(400, result.reason, result.code))
    }

    return reply.send(
      success({
        machine_id: result.machineId,
        machine_token: result.machineToken,
        session_id: result.sessionId,
        /** 这份值是派生不是真机;双通道:上游若自带 machine_id 优先用上游的 */
        source: 'derived',
        note: '同一 uid 恒等、不同 uid 必不相同;派生值可粘进入池表单的 machineId/machineToken',
      }),
    )
  })
}

export default relayDeviceIdentityRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
