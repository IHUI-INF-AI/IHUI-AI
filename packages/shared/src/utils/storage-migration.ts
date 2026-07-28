/**
 * storage key 迁移工具(2026-07-28 立)
 *
 * 用途:一次性迁移历史遗留 storage key 到新 key(下划线 → 连字符等命名规范统一场景)。
 *
 * 使用场景:miniapp-taro invite/vip store 启动时迁移历史 key
 *   (ihui_invite_code → ihui-invite-code / ihui_vip_info → ihui-vip-info),
 *   消除 apps/miniapp-taro/src/stores/invite.ts 与 vip.ts 中重复的 migrateLegacyXxxKey 实现。
 *
 * 设计原则:
 * - 纯函数 + transport 注入:不依赖具体 storage API,transport 由调用方注入
 * - 异常静默:try-catch 包裹,storage 读写失败不抛错,不阻断 store 初始化
 * - 同步语义:函数签名 void,适用于同步 transport(createSyncTransport);
 *   异步 transport(getItem 返回 Promise)会被 typeof 守卫忽略,不产生误写
 *
 * @example
 * ```ts
 * import { migrateLegacyStorageKey } from '@ihui/shared/utils'
 * import { createSyncTransport } from '@ihui/shared/stores'
 *
 * const transport = createSyncTransport({
 *   getItem: (k) => localStorage.getItem(k),
 *   setItem: (k, v) => localStorage.setItem(k, v),
 *   removeItem: (k) => localStorage.removeItem(k),
 * })
 * migrateLegacyStorageKey(transport, 'ihui_invite_code', 'ihui-invite-code')
 * ```
 */

import type { PersistTransport } from '../stores/transport'

/**
 * 迁移历史遗留 storage key 到新 key。
 *
 * 行为:读旧 key → 有值则写新 key + 删旧 key;无值或读取失败时为空操作。
 * 已迁移或旧 key 不存在时为幂等空操作,可重复调用。
 *
 * @param transport 持久化 transport(需同步语义,异步 transport 会被忽略)
 * @param legacyKey 历史遗留 key(如 'ihui_invite_code')
 * @param newKey 新 key(如 'ihui-invite-code')
 */
export function migrateLegacyStorageKey(
  transport: PersistTransport,
  legacyKey: string,
  newKey: string,
): void {
  try {
    const legacy = transport.getItem(legacyKey)
    // typeof 守卫:仅处理同步返回的 string,忽略 Promise(异步 transport 不适用本工具)
    if (typeof legacy === 'string' && legacy) {
      transport.setItem(newKey, legacy)
      transport.removeItem(legacyKey)
    }
  } catch {
    // storage 读取失败忽略,不阻断 store 初始化
  }
}
