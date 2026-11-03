// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * - 三态返回(G-645):不再返回 void,回 {completed, changed, skipped} 供调用方观测
 * - 安全清理:removeItem(legacyKey) 仅在写回成功判据(回读新 key 与旧值一致)通过后执行,
 *   写回未确认绝不删源 key,任何失败路径都不丢数据
 * - 跳过集幂等:已完成的 legacyKey 记入模块级跳过集,重跑短路返回 skipped、不再触碰
 *   storage;未完成的 key 不入集,重跑可安全重试
 * - 同步语义:适用于同步 transport(createSyncTransport);异步 transport(getItem 返回
 *   Promise)会被 typeof 守卫忽略,报 completed: false,不产生误写
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
 * const result = migrateLegacyStorageKey(transport, 'ihui_invite_code', 'ihui-invite-code')
 * if (!result.completed) console.warn('storage key 迁移未完成', result)
 * ```
 */

import type { PersistTransport } from '../stores/transport'

/**
 * 迁移结果三态:
 * - completed:迁移达成完成态 —— 本次迁移成功,或无需迁移(旧 key 无值/新旧 key 同名),
 *   或命中跳过集(此前已完成)。源 key 清理只发生在 completed 路径。
 * - changed:本次调用执行了写回动作(setItem 正常返回;不代表已验证落盘,
 *   验证失败时 completed 为 false 且源 key 保留)。
 * - skipped:本次未走完"写回+清理"迁移流程 —— 命中跳过集 / 无需迁移 / 中途失败。
 */
export interface StorageMigrationResult {
  completed: boolean
  changed: boolean
  skipped: boolean
}

/** 跳过集:已完成迁移(写回校验通过且源 key 已清理)的 legacyKey,重跑幂等的锚点 */
const migratedLegacyKeys = new Set<string>()

/**
 * 迁移历史遗留 storage key 到新 key,返回 {completed, changed, skipped} 三态。
 *
 * 行为:读旧 key → 有值则写新 key → 回读校验写回成功 → 才删旧 key;
 * 无值/读取失败/写回未确认为幂等空操作(completed 如三态定义),可重复调用,
 * 已完成的 key 靠跳过集短路,重跑不重写不重删。
 *
 * @param transport 持久化 transport(需同步语义,异步 transport 会被忽略并报未完成)
 * @param legacyKey 历史遗留 key(如 'ihui_invite_code')
 * @param newKey 新 key(如 'ihui-invite-code')
 */
export function migrateLegacyStorageKey(
  transport: PersistTransport,
  legacyKey: string,
  newKey: string,
): StorageMigrationResult {
  // 跳过集命中:此前已完成,重跑幂等短路,不再触碰 storage
  if (migratedLegacyKeys.has(legacyKey)) {
    return { completed: true, changed: false, skipped: true }
  }
  // 新旧 key 同名:值已在目的地,迁移即完成,绝不走"写后删同 key"丢数据
  if (legacyKey === newKey) {
    return { completed: true, changed: false, skipped: true }
  }
  // 写回动作是否已发生(setItem 正常返回),供失败路径如实上报 changed
  let wrote = false
  try {
    const legacy = transport.getItem(legacyKey)
    // typeof 守卫:仅处理同步返回的 string,忽略 Promise(异步 transport 不适用本工具)
    if (typeof legacy !== 'string' || !legacy) {
      // 无需迁移(旧 key 无值):完成态,幂等空操作
      return { completed: true, changed: false, skipped: true }
    }
    transport.setItem(newKey, legacy)
    wrote = true
    // 写回成功判据(G-645):回读新 key 必须与旧值一致,通过才允许清理源 key;
    // 判据失败 ⇒ completed=false,源 key 保留,重跑可重试
    const written = transport.getItem(newKey)
    if (typeof written !== 'string' || written !== legacy) {
      return { completed: false, changed: true, skipped: true }
    }
    transport.removeItem(legacyKey)
    migratedLegacyKeys.add(legacyKey)
    return { completed: true, changed: true, skipped: false }
  } catch {
    // storage 读写失败忽略,不抛错,不阻断 store 初始化;
    // completed=false ⇒ 源 key 未清理、不入跳过集,重跑可重试
    return { completed: false, changed: wrote, skipped: true }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
