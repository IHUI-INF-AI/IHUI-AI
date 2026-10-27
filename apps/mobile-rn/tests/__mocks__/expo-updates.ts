// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * expo-updates 测试替身。
 *
 * 为什么必须有:真包 src/Updates.ts 顶部 import 'expo-modules-core'(原生模块),
 * 其 EventEmitter.ts 在**模块求值期**读 `globalThis.Expo.EventEmitter` —— jsdom 无
 * Expo 全局 ⇒ app-root-background-focused-route / video-immersive-band 经
 * App.tsx → src/lib/ota-update.ts transitively import 它,收集期整体加载失败
 * ("Test Files N failed",一条断言都没跑)。收口在配置层(vitest.config.ts alias),
 * 与 expo-device / expo-file-system 同型。
 *
 * 覆盖面按 src/lib/ota-update.ts 实际用到的成员给(不是全量 API):
 *   isEnabled / checkForUpdateAsync / fetchUpdateAsync / reloadAsync /
 *   isEmbeddedLaunch / updateId / addUpdatesStateChangeListener(进度事件,带测试发射器)
 * isEnabled=false 是"原生通道不可用"的真实取值 —— OTA 状态机在测试态落 unsupported,
 * 不发起任何检查/下载动作;src/lib/__tests__/ota-update.test.ts 的局部 vi.mock 工厂
 * 仍优先生效,本替身只兜"没显式 mock 的宿主"那一层。
 */

/** 测试态恒 false:与"原生模块未就绪"同值,调用方据此走 unsupported 分支。 */
export const isEnabled = false

/** 测试态 = 内置包启动(updateId 恒 null),runningBundle() 落 embedded 分支。 */
export const isEmbeddedLaunch = true
export const updateId: string | null = null

/**
 * 原生状态机进度事件订阅(ota-update 的读条数据源)。测试态没有原生事件流,
 * 登记即返回可 remove 的空订阅;需要驱动进度时由用例自己拿到 emitter 再发。
 */
const stateListeners = new Set<(event: { context: Record<string, unknown> }) => void>()
export function addUpdatesStateChangeListener(
  listener: (event: { context: Record<string, unknown> }) => void,
): { remove: () => void } {
  stateListeners.add(listener)
  return {
    remove: () => {
      stateListeners.delete(listener)
    },
  }
}
/** 测试用:手动派发一条原生状态机事件(进度条用例由此驱动)。 */
export function __emitStateChange(context: Record<string, unknown>): void {
  for (const l of stateListeners) l({ context })
}

export interface CheckUpdateResult {
  isAvailable: boolean
  manifest?: unknown
  manifestString?: string | null
}

export async function checkForUpdateAsync(): Promise<CheckUpdateResult> {
  return { isAvailable: false, manifest: undefined, manifestString: null }
}

export async function fetchUpdateAsync(): Promise<{ isNew: boolean; manifest?: unknown }> {
  return { isNew: false, manifest: undefined }
}

export async function reloadAsync(): Promise<void> {
  /* 测试态无进程可重启 */
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
