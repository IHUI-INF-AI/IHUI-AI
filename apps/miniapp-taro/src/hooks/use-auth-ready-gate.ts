// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖端内 store(`@/stores/user` 的冷启动鉴权就绪位)+ Taro 存储面上的
// `isLoggedIn()`(经由 `@/utils/auth`),不下沉共享层 —— 共享层的 `createAuthStore().ready`
// 说的是 persist 水合完成,与"这一次冷启动的鉴权判定落没落定"不是同一件事(见 stores/user.ts 头注)。

import { useCallback, useRef, useSyncExternalStore } from 'react'
import { useUserStore } from '@/stores/user'
import { isLoggedIn } from '@/utils/auth'

/** 就绪后要做的那一次动作(通常是"发首屏那个需要鉴权的请求")。 */
type AuthReadyCallback = () => void

/** 取消注册:页面卸载(useUnload)或不再需要补跑时调用;重复调用无副作用。 */
type AuthReadyCancel = () => void

export interface AuthReadyGate {
  /** 本端这一次冷启动的鉴权判定是否已落定(订阅式读,落定时会触发重渲染)。 */
  readonly ready: boolean
  /** 门控用的准入判据:落定 **且** 手里确有凭据。未落定期间永远是 false。 */
  readonly allow: boolean
  /**
   * 命令式生命周期(Taro 的 `useLoad` / `useDidShow`)用的一次性补跑通道。
   * 返回取消函数(页面卸载时调它);同一枚 cb 在未就绪期间重复注册只执行一次。
   */
  readonly waitUntilReady: (onReady: AuthReadyCallback) => AuthReadyCancel
}

/** 已经落定时返回的取消函数:常量引用,免得每次调用造一个新闭包。 */
const ALREADY_READY: AuthReadyCancel = () => undefined

/**
 * 就绪位读取口:client / server 两个快照走**同一个函数**,都现取当前 state。
 *
 * 为什么不直接写 `useUserStore((s) => s.authReady)`:那枚 hook 工厂
 * (`stores/helpers/create-taro-zustand-hook.ts`)给 `useSyncExternalStore` 交回的
 * server 快照是 `getInitialState()` —— zustand 5 把初始 state 对象冻结在创建时刻,
 * 所以走 server 快照的那条渲染路径**永远读到 false**,落定与否一律看不见。
 * 真机(Taro 小程序 / H5)跑的是 client 快照,不受影响;但用例只能在 node 环境里驱动
 * `renderToStaticMarkup` 观察这一位,若沿用那条路径,"ready 之后 allow 必须翻 true"
 * 这一臂就成了永远不会红的摆设。所以这里自己把 subscribe 交给 useSyncExternalStore,
 * 两个快照同值 = 现取当前 state:订阅式读、落定即重渲染,两条渲染路径同形。
 */
function subscribeAuthReady(onStoreChange: () => void): () => void {
  return useUserStore.subscribe(onStoreChange)
}

function readAuthReady(): boolean {
  return useUserStore.getState().authReady
}

/**
 * 冷启动抢跑门(G-933 小程序腿的批量门控出口,后续 50+ 枚页面只用这一个钩子)。
 *
 * 要根治的事:应用冷启动时静默登录链还在飞(甚至压根不会去取票),页面挂载就照发需要鉴权的
 * 请求 ⇒ 首屏闪一次错误态/空态,并把注定 401 的失败打进日志。web 端对应物是
 * `apps/web/src/hooks/use-auth-gate.ts`,但那一枚的前提是 persist 水合位,语义与本端不同源,
 * 所以本端另立这一枚(共用判据只有"落定 + 有票"这一条)。
 *
 * 三种用法(批量派单时只用这两种形状,不要自创第三种):
 *  1. 声明式渲染期门控:`const { allow } = useAuthReadyGate()` → `if (!allow) return <引导态/>`
 *  2. `useLoad`:回调里 `const cancel = gate.waitUntilReady(() => 拉首屏())`,`useUnload` 调 cancel
 *  3. `useDidShow`:`gate.waitUntilReady(() => 拉首屏())`(落定后每次显示都会补跑,符合"回页刷新")
 *
 * 关键语义(决定游客可见页的行为,改之前先读这三行):
 *  - **未 ready 期间绝不执行 cb** —— 执行了就是抢跑,这一枚钩子存在的唯一理由就是拦它;
 *  - **ready 落定但 `isLoggedIn() === false` 时,cb 仍然执行一次** —— 页面必须能进
 *    "未登录空态/引导",而不是永远白屏:静默登录失败与"压根没登录入口"都是合法落定态
 *    (`allow` 已经把这种局面读成 false,页面自己按 allow 决定渲染什么);
 *  - `ready` 不是登录态的第二份真相,登录与否只看 `isLoggedIn()`(判据本体在 `@/utils/auth`)。
 *
 * 禁止绕开本钩子的写法:自己 `useUserStore((s) => s.authReady) && !!getToken()`、
 * 在页面里置位、用 useEffect 轮询就绪位。就绪位的置位点全端只有 `app.tsx` 冷启动链末尾那一处
 * (由 `src/stores/tests/auth-cold-start-ready.test.ts` 与本目录的落点锁共同钉住)。
 */
export function useAuthReadyGate(): AuthReadyGate {
  const ready = useSyncExternalStore(subscribeAuthReady, readAuthReady, readAuthReady)
  /** 未就绪期间挂着的补跑订阅:键 = cb 引用,重复注册同一枚 cb 时复用同一条订阅。 */
  const pendingRef = useRef<Map<AuthReadyCallback, AuthReadyCancel>>(new Map())

  const waitUntilReady = useCallback((onReady: AuthReadyCallback): AuthReadyCancel => {
    if (readAuthReady()) {
      onReady()
      return ALREADY_READY
    }

    const reused = pendingRef.current.get(onReady)
    if (reused) return reused

    let settled = false
    let detach: (() => void) | null = null

    const cancel: AuthReadyCancel = () => {
      if (settled) return
      settled = true
      pendingRef.current.delete(onReady)
      detach?.()
      detach = null
    }

    detach = useUserStore.subscribe((state) => {
      if (settled || !state.authReady) return
      // 落定即注销:订阅只服务这一次补跑,页面留在树上也不给后面的 set 发第二轮。
      settled = true
      pendingRef.current.delete(onReady)
      detach?.()
      detach = null
      // 语义要点:这里不看 isLoggedIn() —— 落定但未登录时 cb 照样执行,
      // 由页面自己按 allow 渲染"未登录空态/引导",不得让页面永远白屏。
      onReady()
    })

    pendingRef.current.set(onReady, cancel)
    return cancel
  }, [])

  return { ready, allow: ready && isLoggedIn(), waitUntilReady }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
