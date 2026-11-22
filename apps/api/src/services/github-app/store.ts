// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { and, desc, eq, lt, or } from 'drizzle-orm'

import { githubAppDeliveries, githubAppInstallations, type Database } from '@ihui/database'

/**
 * 认领结果:
 * - claimed=首次认领,本实例负责执行;
 * - reclaimed=接管 failed / 超时 processing(崩溃遗留),仍由本实例负责执行;
 * - duplicate=已处理或另有实例在执行;
 * - unavailable=持久层不可用(调用方必须 fail-closed)。
 */
export type DeliveryClaimState = 'claimed' | 'reclaimed' | 'duplicate' | 'unavailable'

/** 认领入参:payload 是可恢复载荷(渲染后的触发规则),崩溃后据此重放 */
interface DeliveryClaimInput {
  deliveryId: string
  eventType: string
  payload: Record<string, unknown>
}

/**
 * processing 行超过该时长视为"认领者已崩溃",允许重投接管。
 * GitHub 自身重投窗口通常为分钟级;10 分钟足以避开正常执行的并发重叠。
 */
const DELIVERY_STALE_MS = 10 * 60 * 1000

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
  /**
   * F-346 持久认领:先落库再回 200。
   * 新 delivery → claimed;已 processed 或仍在 processing → duplicate;
   * failed / 超过 DELIVERY_STALE_MS 的 processing(崩溃遗留) → 原子接管后 claimed。
   */
  claimDelivery(input: DeliveryClaimInput): Promise<DeliveryClaimState>
  /** 执行结束后落终态;写失败不影响已发出的 200,由日志告警 */
  settleDelivery(deliveryId: string, status: 'processed' | 'failed'): Promise<void>
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

    async claimDelivery({ deliveryId, eventType, payload }) {
      const now = new Date()
      // 先尝试插入 processing 认领行;唯一索引保证多实例只有一个赢家。
      const inserted = await db
        .insert(githubAppDeliveries)
        .values({ deliveryId, eventType, status: 'processing', payload, processedAt: now })
        .onConflictDoNothing({ target: githubAppDeliveries.deliveryId })
        .returning({ id: githubAppDeliveries.id })
      if (inserted.length > 0) return 'claimed'

      // 冲突:仅 failed 或超时 processing(崩溃遗留)可原子接管;
      // processed 与新鲜 processing 一律判重复,避免并发双执行。
      const staleBefore = new Date(now.getTime() - DELIVERY_STALE_MS)
      const takenOver = await db
        .update(githubAppDeliveries)
        .set({ status: 'processing', payload, processedAt: now })
        .where(
          and(
            eq(githubAppDeliveries.deliveryId, deliveryId),
            or(
              eq(githubAppDeliveries.status, 'failed'),
              and(
                eq(githubAppDeliveries.status, 'processing'),
                lt(githubAppDeliveries.processedAt, staleBefore),
              ),
            ),
          ),
        )
        .returning({ id: githubAppDeliveries.id })
      return takenOver.length > 0 ? 'reclaimed' : 'duplicate'
    },

    async settleDelivery(deliveryId, status) {
      await db
        .update(githubAppDeliveries)
        .set({ status, processedAt: new Date() })
        .where(eq(githubAppDeliveries.deliveryId, deliveryId))
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
    async claimDelivery() {
      // 降级面必须显式不可用:调用方据此 fail-closed(不回 200,避免事件丢失)
      return 'unavailable'
    },
    async settleDelivery() {
      /* 降级:无持久层,状态无处可落 */
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
