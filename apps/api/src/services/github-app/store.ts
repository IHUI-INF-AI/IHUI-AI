// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​​‌‌‌‍‍​‌‌‌‌​‌‌‌​‍‍‌‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌‌‌‌​​​​‍‍‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​​‌‌‌‌​‍‍​‌​​​‌‌‌‌‌‍‍​‌‌‌​‌‌‌​‍‍​‌‌‌‌‌‌‍‍​​‌‌‌‌​‌‍‍​​‌‌‌‌‌‍‍‌‌‌‌‍‍​​‌‌‌‌‌‌‍‍​​‌‌‌‌​‍‍​​‌‌​‌‌​⁠

/**
 * GitHub App 持久层(D15①②):安装映射落库 + 投递幂等落库。
 *
 * 分层取舍:
 * - events.ts 保持纯数据层(不 import db),内存 LRU 去重器留在那里作一级缓存;
 * - 本文件是唯一 import db 的 GitHub App 模块,webhook 路由通过 GithubAppStore
 *   接口消费,单测注入假实现,不触真实连接;
 * - 默认实现走惰性动态 import(与路由里 textModel 的接线方式一致):
 *   db/config 模块链只在第一次真正需要时加载,加载失败降级为 null store,
 *   webhook 面绝不因为存储不可用而 5xx(签名准入语义不变)。
 */
import { desc, eq } from 'drizzle-orm'

import { githubAppDeliveries, githubAppInstallations, type Database } from '@ihui/database'

/** installation 事件落表后的行状态(GitHub 语义:装了/卸了;权限更新不换状态,只刷 updated_at) */
export type GithubAppInstallationStatus = 'active' | 'removed'

/** applyInstallationEvent 的入参:从 webhook installation 事件体映射而来 */
export interface InstallationEventInput {
  installationId: number
  accountLogin: string | null
  targetType: string | null
  /** GitHub 侧操作者 id(sender.id),非平台用户 id;拿不到为 null */
  installedByUserId: number | null
  status: GithubAppInstallationStatus
}

/** admin 查询端点的行 DTO(时间统一 ISO 字符串,绝不带任何凭据字段) */
export interface GithubAppInstallationRow {
  installationId: number
  accountLogin: string | null
  targetType: string | null
  installedByUserId: number | null
  status: string
  createdAt: string
  updatedAt: string
}

/** GitHub App 持久层接口 —— 路由只认这个,单测可整体替换 */
export interface GithubAppStore {
  /** 已处理过的投递返回 true(重启后防重投的持久层判定) */
  hasDelivery(deliveryId: string): Promise<boolean>
  /** 落一条已处理投递;同 delivery 重落静默忽略(onConflictDoNothing) */
  recordDelivery(deliveryId: string, eventType: string): Promise<void>
  /** installation 事件驱动 upsert:同 installation_id 只保留一行最新状态 */
  applyInstallationEvent(input: InstallationEventInput): Promise<void>
  /** admin 列表:按 updated_at 倒序,有上限防全表拖垮 */
  listInstallations(): Promise<GithubAppInstallationRow[]>
}

/** admin 列表读取上限 —— 安装实例是低频小表,500 行足够,防无界查询 */
const LIST_LIMIT = 500

/** drizzle 实现:两张表各自的 upsert/去重语义都收敛在这里 */
export function createDbGithubAppStore(db: Database): GithubAppStore {
  return {
    async hasDelivery(deliveryId) {
      const rows = await db
        .select({ id: githubAppDeliveries.id })
        .from(githubAppDeliveries)
        .where(eq(githubAppDeliveries.deliveryId, deliveryId))
        .limit(1)
      return rows.length > 0
    },

    async recordDelivery(deliveryId, eventType) {
      await db
        .insert(githubAppDeliveries)
        .values({ deliveryId, eventType, status: 'processed' })
        .onConflictDoNothing({ target: githubAppDeliveries.deliveryId })
    },

    async applyInstallationEvent(input) {
      await db
        .insert(githubAppInstallations)
        .values({
          installationId: input.installationId,
          accountLogin: input.accountLogin,
          targetType: input.targetType,
          installedByUserId: input.installedByUserId,
          status: input.status,
        })
        .onConflictDoUpdate({
          target: githubAppInstallations.installationId,
          set: {
            accountLogin: input.accountLogin,
            targetType: input.targetType,
            installedByUserId: input.installedByUserId,
            status: input.status,
            updatedAt: new Date(),
          },
        })
    },

    async listInstallations() {
      const rows = await db
        .select()
        .from(githubAppInstallations)
        .orderBy(desc(githubAppInstallations.updatedAt))
        .limit(LIST_LIMIT)
      return rows.map((row) => ({
        installationId: row.installationId,
        accountLogin: row.accountLogin,
        targetType: row.targetType,
        installedByUserId: row.installedByUserId,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))
    },
  }
}

/** 存储不可用时的降级实现:一切读判为未见、写静默丢弃(webhook 面不因存储 5xx) */
export function createNullGithubAppStore(): GithubAppStore {
  return {
    async hasDelivery() {
      return false
    },
    async recordDelivery() {
      /* 降级:无持久层,写入丢弃 */
    },
    async applyInstallationEvent() {
      /* 降级:无持久层,写入丢弃 */
    },
    async listInstallations() {
      return []
    },
  }
}

/** 解析日志:只依赖 warn 一个方法,避免把 fastify 类型拖进本模块 */
export interface StoreResolveLogger {
  warn(message: string): void
}

let cachedStore: GithubAppStore | null | undefined

/** 测试钩子:清掉惰性解析缓存(跨用例隔离用) */
export function resetGithubAppStoreCache(): void {
  cachedStore = undefined
}

/**
 * 默认 store 解析:动态 import db 模块链,失败降级 null 并告警。
 * 与路由里 resolveDefaultTextModel 的接线方式一致 —— 加载链不拖进 db/config。
 */
export async function resolveGithubAppStore(
  log: StoreResolveLogger,
): Promise<GithubAppStore | null> {
  if (cachedStore !== undefined) return cachedStore
  try {
    const { db } = await import('../../db/index.js')
    cachedStore = createDbGithubAppStore(db)
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    log.warn(`[github-app] 持久层接线失败,投递幂等/安装映射降级为内存态:${message}`)
    cachedStore = null
  }
  return cachedStore
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​​‌‌‌‍‍​‌‌‌‌​‌‌‌​‍‍‌‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌‌‌‌​​​​‍‍‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​​‌‌‌‌​‍‍​‌​​​‌‌‌‌‌‍‍​‌‌‌​‌‌‌​‍‍​‌‌‌‌‌‌‍‍​​‌‌‌‌​‌‍‍​​‌‌‌‌‌‍‍‌‌‌‌‍‍​​‌‌‌‌‌‌‍‍​​‌‌‌‌​‍‍​​‌‌​‌‌​⁠
