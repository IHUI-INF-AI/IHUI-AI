// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池「平台自动续期能力」只读端点(2026-10-29 立)。
 *
 * 立因:面板此前不告诉运维"这个平台没有 refreshToken 续期通道,掉线只能重采凭证"。
 * 8 个平台无真 refreshToken(codex/opencode/zcode/lingma/grokbot 无 refreshToken 方法;
 * doubao/loomy 方法存在但 `refreshTokenSupported: false` 空壳),而这条事实只住在
 * 适配器注册表里,读面够不着 ⇒ 运维只能靠记忆或硬编码名单猜。
 *
 * 端点:
 * 1. GET /admin/relay/account-pool/renewal-capability — 逐平台能力位 + 在册账号数
 *
 * 判据纪律:
 * - **前端不写平台名单**。能力位一律现读 `relay-upstream-adapters.ts` 的
 *   `isRefreshableProviderCode`(判据 = 适配器确有 refreshToken 方法 ∧ 未显式 false),
 *   平台全集取 `relay-account-format.ts` 的 `RELAY_PROVIDERS`(两处都是既有唯一源,本文件零复算);
 * - 适配器**未注册**与"注册了但确实不能续期"是两件事:前者回 `adapterRegistered:false`
 *   (读面据此标「未判定」),不得冒充后者判成"无自动续期"(AGENTS.md §0.3);
 * - 可续期平台数为 0 ⇒ 注册表整体没装载,当场点名「未判定」并 500,不交一份"全员都不能续期"的假账;
 * - 只读、零写入、零上游探测;鉴权走该面板既有 `requireAdmin`(roleId>=1),不新开鉴权通道。
 */
import type { FastifyPluginAsync } from 'fastify'
import { sql } from 'drizzle-orm'
import { dbRead } from '../../db/index.js'
import { aiRelayAccountPool } from '@ihui/database'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { RELAY_PROVIDERS } from '../../services/relay-account-format.js'
import {
  getRelayAdapter,
  isRefreshableProviderCode,
} from '../../services/relay-upstream-adapters.js'
import { registerAllRelayAdapters } from '../../services/upstream-adapters/index.js'

/** 单平台能力位读数 */
export interface RenewalCapabilityItem {
  providerCode: string
  /** 适配器是否已注册到上游适配器注册表(false ⇒ 能力位无从判定,读面必须显示「未判定」) */
  adapterRegistered: boolean
  /** 是否存在自动续期通道(仅在 adapterRegistered 为 true 时才是结论) */
  autoRenewalSupported: boolean
  /** 该平台在库账号数(NULL 平台码不计入) */
  accounts: number
}

const relayAccountPoolCapabilityRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/relay/account-pool/renewal-capability — 平台续期能力位 =====
  server.get('/admin/relay/account-pool/renewal-capability', async (request, reply) => {
    // 注册表只由转发链路/worker 首次使用时装载(relay-live-probe / relay-account-pool-worker),
    // api 进程启动时**并不注册** ⇒ 面板若在任何人转发之前打开,读到的是空表。
    // 幂等注册出口只有一个,这里向它要一次,不得另写一份注册兜底。
    registerAllRelayAdapters()

    const capability = RELAY_PROVIDERS.map((providerCode) => ({
      providerCode,
      adapterRegistered: getRelayAdapter(providerCode) !== null,
      autoRenewalSupported: isRefreshableProviderCode(providerCode),
    }))

    // 注册表整体没装载时,每一行的 autoRenewalSupported 都是 false —— 那是一张
    // "全部平台都不能续期"的假账,必须在出接口前点名,而不是让面板把它当真。
    const registered = capability.filter((c) => c.adapterRegistered).length
    if (registered === 0) {
      return reply
        .status(500)
        .send(error(500, '未判定:上游适配器注册表未装载(已注册平台数为 0),续期能力位无法判定'))
    }
    const refreshable = capability.filter((c) => c.autoRenewalSupported).length
    if (refreshable === 0) {
      return reply
        .status(500)
        .send(error(500, '未判定:可自动续期平台数为 0,与已知平台族不符(疑似适配器注册链断裂)'))
    }

    // 在册账号数:一次 group by,给运维"这条标注覆盖多少个号"的体量读数
    let counts: { providerCode: string | null; accounts: number }[]
    try {
      counts = await dbRead
        .select({
          providerCode: aiRelayAccountPool.providerCode,
          accounts: sql<number>`count(*)::int`,
        })
        .from(aiRelayAccountPool)
        .groupBy(aiRelayAccountPool.providerCode)
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询号池平台分布失败'))
    }

    const countByProvider = new Map<string, number>(
      counts
        .filter((c) => c.providerCode !== null)
        .map((c) => [c.providerCode as string, c.accounts]),
    )
    // 枚举完整性自证:库里出现而 RELAY_PROVIDERS 未登记的平台码必须点名,
    // 不得静默丢掉(否则"该面板看不到这个平台"会变成"这个平台不存在")。
    const unlisted = [...countByProvider.keys()].filter(
      (code) => !(RELAY_PROVIDERS as readonly string[]).includes(code),
    )

    const items: RenewalCapabilityItem[] = capability.map((c) => ({
      ...c,
      accounts: countByProvider.get(c.providerCode) ?? 0,
    }))

    return reply.send(
      success({
        items,
        unlistedProviderCodes: unlisted,
        /** 三态计数:面板据此判断"读到了多少",不是拿条数当真值 */
        summary: {
          providers: items.length,
          adaptersRegistered: registered,
          autoRenewable: refreshable,
          accountsTotal: counts.reduce((s, c) => s + c.accounts, 0),
        },
      }),
    )
  })
}

export default relayAccountPoolCapabilityRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
