// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 长任务防休眠:带 owner 引用计数的 wake lock(对齐竞品 startWakelockForOwner)。
 *
 * 病灶:AI 长命令/长流式生成/视频生成期间用户锁屏或休眠,会切断 WS/SSE 与容器通道。
 * 上一轮已修"唤醒后假连接态"的事后重连;这里补事前防线,让长任务期间系统不休眠。
 *
 * 设计三条铁律:
 * 1. **owner 引用计数**:Map<ownerId, handle>,任一 owner release 只放自己那份,
 *    最后一个 owner 离开才真正撤销系统锁 —— A 任务结束不能误放 B 任务的锁。
 * 2. **fail-closed**:桌面 command 失败 / 浏览器权限拒绝 / 非安全上下文,一律降级为
 *    no-op 句柄,绝不抛错打断正在流式输出的主链路,也绝不声称"已持锁"。
 * 3. **通道分流**:Tauri 桌面走 Rust `set_sleep_prevention`(Windows
 *    SetThreadExecutionState,标签页不可见也有效);普通浏览器走 Screen Wake Lock API。
 *
 * 边界:浏览器 Wake Lock 在 document 转 hidden 时会被 UA 自动释放;桌面场景(长任务
 * 主要发生地)走 Rust 通道不受此限。Web 场景切走标签页后本就不能保证持续唤醒,
 * 且已有事后重连兜底,故不在此重建锁。
 */

import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './tauri-bridge'

export type WakeLockSource = 'desktop' | 'web' | 'none'

export interface WakeLockHandle {
  readonly source: WakeLockSource
  release: () => void
}

interface DesktopReport {
  state?: unknown
}

const owners = new Map<string, WakeLockHandle>()
const pendingOwners = new Set<string>()
let activeHandle: WakeLockHandle | null = null
let acquisition: Promise<WakeLockHandle> | null = null

/** 真正向平台申请一次锁;任何失败都返回 no-op 句柄,不抛。 */
async function requestHandle(): Promise<WakeLockHandle> {
  if (isTauri()) {
    try {
      const report = await invoke<DesktopReport>('set_sleep_prevention', { active: true })
      if (report?.state === 'supported') {
        return {
          source: 'desktop',
          release: () => {
            void invoke('set_sleep_prevention', { active: false }).catch(() => {})
          },
        }
      }
    } catch {
      // command 未注册 / 平台不支持 ⇒ 继续尝试 Web API,再不行就降级
    }
  }
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
    try {
      const sentinel = await navigator.wakeLock.request('screen')
      return {
        source: 'web',
        release: () => {
          void sentinel.release().catch(() => {})
        },
      }
    } catch {
      // 非安全上下文 / 权限策略拒绝 ⇒ 降级
    }
  }
  return { source: 'none', release: () => {} }
}

function ensureHandle(): Promise<WakeLockHandle> {
  if (!acquisition) {
    acquisition = requestHandle()
      .then((handle) => {
        activeHandle = handle
        return handle
      })
      .finally(() => {
        acquisition = null
      })
  }
  return acquisition
}

/** 任务开始持有锁。同一 owner 重复 acquire 幂等;并发 acquire 共用一次平台申请。 */
export function acquireWakeLock(ownerId: string): void {
  if (owners.has(ownerId) || pendingOwners.has(ownerId)) return
  pendingOwners.add(ownerId)
  void ensureHandle()
    .then((handle) => {
      // pending 期间被 release 的 owner 不得再登记,否则最后一个 release 后锁泄漏
      if (!pendingOwners.delete(ownerId)) {
        // 该 owner 已放弃且再无其他 owner:刚申请到的句柄必须立即归还,
        // 否则进程内会留一把永远没人 release 的锁(实测反向用例炸出来的)。
        if (owners.size === 0 && pendingOwners.size === 0 && activeHandle === handle) {
          activeHandle = null
          handle.release()
        }
        return
      }
      owners.set(ownerId, handle)
    })
    .catch(() => {
      pendingOwners.delete(ownerId)
    })
}

/** 任务结束释放自己那份;仅当所有 owner 都离开才真正撤销平台锁。 */
export function releaseWakeLock(ownerId: string): void {
  pendingOwners.delete(ownerId)
  owners.delete(ownerId)
  if (owners.size === 0 && pendingOwners.size === 0 && activeHandle) {
    const handle = activeHandle
    activeHandle = null
    handle.release()
  }
}

/** 当前是否有活跃 owner(供诊断/测试断言,不表示平台锁一定成功)。 */
export function isWakeLockOwned(): boolean {
  return owners.size > 0 || pendingOwners.size > 0
}

/** 仅供测试:清空引用计数并释放平台锁,避免用例间互相污染。 */
export function resetWakeLockForTests(): void {
  pendingOwners.clear()
  owners.clear()
  if (activeHandle) {
    const handle = activeHandle
    activeHandle = null
    handle.release()
  }
}
