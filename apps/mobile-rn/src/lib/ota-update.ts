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
import RNRestart from 'react-native-restart'
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
 * 立即重启应用生效(调用前应已 ready)。
 *
 * 2026-10-28 定稿:**只走原生真重启,彻底不走 reloadAsync**。
 *   - 机主连续两轮实拍「点更新 → 灰屏卡死没反应」,根因是 expo-updates 57 的
 *     RelaunchProcedure:先显示原生 reloadScreen,再 reactHost.restart();JS 面被拆掉后
 *     如果新界面没被拉回来,就永远停在那一帧,而 JS 已死 —— 看门狗、兜底按钮全部跟着消失。
 *     这条路只要存在,就总有概率复现,所以直接删掉,不再"失败再退回"。
 *   - 改走 react-native-restart(ProcessPhoenix:杀进程 + AlarmManager 拉起)= 一次真冷启动:
 *     进程重开 → expo-updates 按"最新已下载更新"选包 → 界面一定回来。
 *     (expo-updates 57 没有客户端崩溃回滚,杀进程不会被判成崩溃而退回旧包。)
 *   - 真重启是同步调用、当场换进程,不存在"调了却不动"的中间态;万原生模块缺失(理论不可达,
 *     该模块已随包编进 dex)则回到 ready 让用户再点一次,绝不留一块灰屏。
 *
 * @returns 是否已把重启交出去(成功时进程当场被替换,返回值只在失败路径可观测)。
 */
export async function applyOtaUpdate(): Promise<boolean> {
  patch({ state: 'installing' })
  try {
    RNRestart.restart('ota-apply')
    // 执行成功时进程当场被换掉,这行之后不会再跑;能返回说明原生模块没动手
    return true
  } catch (e) {
    console.warn('[ota] 原生真重启不可用:', e)
    patch({ state: 'ready', lastError: e instanceof Error ? e.message : String(e) })
    return false
  }
}

/**
 * 兜底重启(2026-10-28 机主「点了更新依旧灰屏 卡死 没任何反应」):
 * `Updates.reloadAsync()` 在个别机型上会"拆了当前 JS 面却没把 Activity 拉起来",
 * 此时看门狗也随 JS 一起没了,用户对着一块没有出路的遮罩。这里给 UI 一枚
 * 「立即重启」按钮走原生 `RNRestart`:activity recreate 后 expo-updates 会按最新
 * 已下载的更新重新启动,与点更新同一个落点。失败只可能发生在原生模块缺失,**不抛**。
 */
export function forceRestart(): void {
  try {
    RNRestart.restart('ota-fallback')
  } catch (e) {
    console.warn('[ota] 原生重启失败:', e)
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
