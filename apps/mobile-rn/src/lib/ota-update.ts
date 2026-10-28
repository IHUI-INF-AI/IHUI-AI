// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OTA 更新的**单一状态机**(2026-10-27 立)。
 *
 * 为什么要有这一层:此前 OTA 检查逻辑只活在 components/UpdatePrompt.tsx 的 effect 里,
 * 于是设置页的「检查更新」只能假装 —— 它没有可复用的检查入口,只能弹一句"已是最新版本"
 * (用户点什么都得到同一句话,那是假的)。把状态机提成模块级 store 之后:
 *   - 检查/下载/就绪/重启 只有一份实现(expo-updates 全仓唯一消费点);
 *   - 任何界面都能触发检查(checkOtaUpdate),提示卡(UpdatePrompt)自动跟着状态走,
 *     不需要两处各写一遍、也不需要跨屏传参。
 *
 * 状态口径与 web 端 app-version-gate 的六终态对齐(同一套语义,两端看到的文案同源):
 *   idle → checking → downloading → ready → installing
 *   分支:up-to-date(无更新)/ error(检查或下载失败)/ unsupported(环境不支持 OTA)
 *
 * 降级哲学同 web:失败一律不打扰用户(fail-open),只有用户**主动**检查时才如实回话。
 */

import { Platform } from 'react-native'
import * as Updates from 'expo-updates'
import { useSyncExternalStore } from 'react'

export type OtaUpdateState =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'up-to-date'
  | 'error'
  | 'unsupported'

interface OtaStore {
  state: OtaUpdateState
  /** 提示卡是否被用户关掉;新一轮检查就绪时自动复位。 */
  dismissed: boolean
  /** 最近一次失败原因(仅用于排查,不直接展示给用户)。 */
  lastError: string | null
  /** 最近一次真正发起检查的时刻(ms);给"回到前台要不要补查"用。 */
  lastCheckedAt: number | null
  /** 下载进度 0-100,只在本状态机处于 downloading 时采样(提示卡读条的唯一数据源)。 */
  downloadProgress: number
}

let store: OtaStore = {
  state: 'idle',
  dismissed: false,
  lastError: null,
  lastCheckedAt: null,
  downloadProgress: 0,
}
const listeners = new Set<() => void>()
/** 正在飞的那一趟检查(并发去重用;见 checkOtaUpdate 头注)。 */
let inFlight: Promise<OtaUpdateState> | null = null

function patch(next: Partial<OtaStore>): void {
  store = { ...store, ...next }
  for (const listener of listeners) listener()
}

// 下载进度事件(提示卡读条的唯一数据源):原生状态机每次进度变化都会广播;
// 只在本状态机处于 downloading 时采样,免得空闲期的状态事件把读数写脏。
Updates.addUpdatesStateChangeListener((event) => {
  if (store.state !== 'downloading') return
  if (!event.context.isDownloading) return
  patch({ downloadProgress: Math.round(event.context.downloadProgress * 100) })
})

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 当前环境是否真的能走 OTA:dev-client 与 web 没有 OTA 通道。 */
export function isOtaSupported(): boolean {
  if (__DEV__) return false
  if (Platform.OS === 'web') return false
  return Updates.isEnabled !== false
}

/**
 * 当前进程跑的是哪个包(设置页「检查更新」与提示卡的可见身份):
 * isEmbeddedLaunch=true 或拿不到 updateId ⇒ 内置包;否则是热更包。
 * 为什么要有:OTA「点了更新却像没生效」无从对账 —— 身份可见后,用户在
 * 关于/设置里读到的短 id 就是"我到底跑到哪份代码"的机器可查凭据。
 */
export function runningBundle(): { kind: 'embedded' | 'ota'; id: string | null } {
  if (Updates.isEmbeddedLaunch || !Updates.updateId) return { kind: 'embedded', id: null }
  return { kind: 'ota', id: Updates.updateId }
}

/**
 * 检查并下载更新(自动/手动共用一个入口 —— 状态机不区分触发来源,
 * 差别只在调用方要不要把结论说给用户听)。
 *
 * 并发去重(2026-10-27 修):挂载 3 秒后的自动检查与设置页手动检查可能同时打进来。
 * 不去重就会并发跑两次 checkForUpdateAsync + fetchUpdateAsync —— 第二次会在第一次
 * 把 state 推到 ready 之后又推回 downloading,甚至重复下载同一份包。
 * 现在同一时刻只允许一趟在飞,后到的调用直接复用同一趟的结论。
 *
 * @returns 结束时的状态,不抛异常。
 */
export function checkOtaUpdate(): Promise<OtaUpdateState> {
  if (inFlight) return inFlight
  inFlight = runCheck()
  void inFlight.finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runCheck(): Promise<OtaUpdateState> {
  if (!isOtaSupported()) {
    patch({ state: 'unsupported', lastError: null })
    return 'unsupported'
  }
  patch({ state: 'checking', lastError: null, lastCheckedAt: Date.now() })
  try {
    const check = await Updates.checkForUpdateAsync()
    if (!check.isAvailable) {
      patch({ state: 'up-to-date' })
      return 'up-to-date'
    }
    patch({ state: 'downloading', downloadProgress: 0 })
    await Updates.fetchUpdateAsync()
    // 就绪即复位 dismissed:这是新一轮更新,旧的一次性关闭不该继续压着它
    patch({ state: 'ready', dismissed: false })
    return 'ready'
  } catch (e) {
    patch({ state: 'error', lastError: e instanceof Error ? e.message : String(e) })
    return 'error'
  }
}

/**
 * reloadAsync 看门狗上限(ms)。
 *
 * 为什么需要(2026-10-27 机主实拍「点完更新直接调到灰屏页,一直不动」的第二道保险):
 * 真重启时进程被整份替换,这个定时器根本走不到;只有「reloadAsync 被调了却始终没重启」
 * (原生通道挂死 / 新包装载卡住)才会落回 ready —— 否则 installing 会把 UpdatePrompt 的
 * 「正在重启…」遮罩永久钉在屏幕上,用户除了杀进程没有任何出路(比原来那块无反馈的
 * 灰屏更糟:连"卡在哪一步"都读不出来)。
 */
const RELOAD_WATCHDOG_MS = 15000

/**
 * 立即重启应用生效(调用前应已 ready)。
 *
 * 失败处理(2026-10-27 修):原来失败后落 error 态,而提示卡只在 ready 渲染 ⇒
 * 卡片直接消失,用户既看不到失败原因、也没有任何重试入口,只能等下次冷启动。
 * 现在失败**回到 ready**:卡片继续在,用户再点一次就是重试;失败原因由调用方弹窗如实告知。
 * 「调了但没重启」同样走失败路径(见 RELOAD_WATCHDOG_MS),不会把 UI 钉在 installing。
 * @returns 是否成功重启(reloadAsync 成功时进程已经重启,返回值实际只在失败路径可观测)。
 */
export async function applyOtaUpdate(): Promise<boolean> {
  patch({ state: 'installing' })
  // 显式标注类型且不给初始值:避免 TS 控制流把"回调里赋的值"当成不存在(见单测注释同款陷阱)
  let watchdog: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Updates.reloadAsync(),
      new Promise<never>((_, reject) => {
        watchdog = setTimeout(
          () => reject(new Error(`reloadAsync 超过 ${RELOAD_WATCHDOG_MS}ms 未重启(看门狗超时)`)),
          RELOAD_WATCHDOG_MS,
        )
      }),
    ])
    return true
  } catch (e) {
    patch({ state: 'ready', lastError: e instanceof Error ? e.message : String(e) })
    return false
  } finally {
    if (watchdog !== undefined) clearTimeout(watchdog)
  }
}

/** 关掉提示卡(仅本次会话;重启或下一轮更新会再出现)。 */
export function dismissOtaPrompt(): void {
  patch({ dismissed: true })
}

/** 当前状态快照(非 React 环境读取用,如"先查再决策"的调用方与单测)。 */
export function otaSnapshot(): OtaStore {
  return store
}

/**
 * 回到前台时该不该补查一次(2026-10-27 补):此前只在冷启动检查一次,
 * 挂着不关的 app 一周都收不到新推送 —— OTA 推了等于没推。
 *
 * 三条排除:
 *   - 已有 ready 在等用户点(或用户已关掉它):再查会把状态推回 checking/downloading,
 *     卡片闪烁;真要重查是用户主动去设置页点;
 *   - 正在 downloading/installing:别打断;
 *   - 距上次检查不足 minIntervalMs:频繁切前后台不该反复打 expo-updates。
 */
export function shouldAutoRecheck(minIntervalMs: number): boolean {
  if (store.state === 'ready' || store.dismissed) return false
  if (store.state === 'downloading' || store.state === 'installing') return false
  if (store.lastCheckedAt === null) return true
  return Date.now() - store.lastCheckedAt >= minIntervalMs
}

/** 订阅状态(useSyncExternalStore:多屏共享同一份,无 context 依赖)。 */
export function useOtaUpdate(): OtaStore {
  return useSyncExternalStore(
    subscribe,
    () => store,
    () => store,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
