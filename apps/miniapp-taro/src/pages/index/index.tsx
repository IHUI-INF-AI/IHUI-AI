// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 首页入口(主包 tab 页)。
 *
 * 微信主包硬上限 2,097,152 B，而 RN 首页壳连同它的运行时闭包约 700 KB。
 * 首页壳已整体落在 pkg-mirror2/home（同一份 HomeScreen 源、同一套 rn-compat），
 * 这里只保留平台硬性要求的主包入口，挂载后立即 redirectTo 到分包页。
 *
 * - 视觉仍是 RN 首页壳本体，不在主包重画一遍；
 * - pkg-mirror2 在 app.config.ts 里对本页 preloadRule 预下载，冷启动不额外等待；
 * - 原生 tabBar 的「智汇社区」落点仍是这里，切回首页同样走这条重定向。
 *
 * H5 不认分包路由（Taro H5 只挂 main pages，分包页注册但不 mount），
 * 因此 H5 构建命中 `h5-home-preview.h5.tsx`，在同一个主包路由上渲染同一份壳，
 * 仅用于真比例实渲验收；weapp 构建解析到空桩，不把壳闭包拉回主包。
 */
import '@/polyfills'
import Taro, { useDidShow } from '@tarojs/taro'
import H5HomePreview from '@h5-home-preview'
import ThemeRoot from '@/components/ThemeRoot'

const IS_H5 = process.env.TARO_ENV === 'h5'

/**
 * 2026-11-26(二次收口):入口 → 镜像首页的重定向不许只挂在一个触发点上。
 *
 * 三段白都实测踩到过,成因各不相同:
 * ① 只挂纯模块级副作用 —— 它只在 JS **首次加载**时执行一次;`reLaunch` 回本页
 *    (点 tabBar「智汇社区」也是这条路径)时模块已缓存、不再执行 ⇒ 第二次进来白。
 * ② 只挂组件函数体 —— Taro 在 `reLaunch` 回同一路由时会复用页面实例、
 *    函数体不再执行 ⇒ 第二次进来一样白。
 * ③ 只挂 useEffect / useDidShow —— 页面若因 chunk 未挂载而根本没跑起来,
 *    hook 自然也不触发 ⇒ 冷启就白。
 *
 * 结论:**三路同源调度**,全部收敛到同一个 `scheduleEntryJump`,互为对方的兜底:
 * - 模块级哨兵:模块加载时装一次、**永不卸载**;JS 上下文不随页面销毁,
 *   所以它跨 `reLaunch` 存活,是"第二次进入也能跳"的唯一可靠触发点;
 * - `useDidShow`:页面每次展示时抢一次,给出比哨兵 tick 更快的响应;
 * - 组件函数体:冷启首帧的第一手,避免等第一个 tick。
 * 三路共用同一枚在飞定时器 + 同一枚时间窗节流,不会重复发起跳转。
 */
const ENTRY_ROUTE = 'pages/index/index'
const MIRROR_HOME_URL = '/pkg-mirror2/home/index'
const SETTLE_MS = 1200 // 等页面栈建立后再判栈顶
const THROTTLE_MS = 800 // 同一实例连续渲染时只排一次
const GUARD_TICK_MS = 1000
const MAX_ATTEMPTS = 6 // 镜像页真不存在时不许无限重试

let lastJumpAt = 0
let pendingTimer: ReturnType<typeof setTimeout> | null = null
let attempts = 0

function topRoute(): string | undefined {
  try {
    const pages = Taro.getCurrentPages()
    const list = Array.isArray(pages) ? pages : []
    const top = list.length > 0 ? (list[list.length - 1] as { route?: string }) : undefined
    return top && typeof top.route === 'string' ? top.route : undefined
  } catch {
    return undefined // 运行时未就绪
  }
}

function jumpToMirrorHome(): void {
  try {
    void Taro.redirectTo({
      url: MIRROR_HOME_URL,
      fail: () => {
        void Taro.navigateTo({ url: MIRROR_HOME_URL })
      },
    })
  } catch {
    /* 运行时未就绪时忽略 */
  }
}

/** 排一次跳转:同时只允许一枚在飞定时器,时间窗内的重复调用直接丢弃。 */
function scheduleEntryJump(): void {
  if (pendingTimer) return
  if (Date.now() - lastJumpAt < THROTTLE_MS) return
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    // 栈还没建立(首帧),或栈顶已不是本页(深链/热启动/已在镜像页)⇒ 不干预,下一 tick 重排
    if (topRoute() !== ENTRY_ROUTE) return
    if (attempts >= MAX_ATTEMPTS) return
    attempts += 1
    lastJumpAt = Date.now()
    jumpToMirrorHome()
  }, SETTLE_MS)
}

/** 模块级哨兵:装一次、永不卸载。故意不 clearInterval——它就是跨 reLaunch 的那根线。 */
function installEntryGuard(): void {
  setInterval(() => {
    const route = topRoute()
    if (route !== ENTRY_ROUTE) {
      // 已经离开本页(正常跳走 / 用户在别的页面)⇒ 重置重试计数,下次回来重新计
      attempts = 0
      return
    }
    scheduleEntryJump()
  }, GUARD_TICK_MS)
}

if (!IS_H5) {
  try {
    Taro.setStorageSync('__boot_index__', String(Date.now()))
  } catch {
    /* 运行时未就绪时忽略 */
  }
  installEntryGuard()
}

export default function HomeEntry() {
  // 三路同源见上方注释:哨兵(跨 reLaunch) + useDidShow(每次展示) + 函数体(冷启首帧)
  useDidShow(() => {
    scheduleEntryJump()
  })
  if (!IS_H5) scheduleEntryJump()

  if (IS_H5) {
    return (
      <ThemeRoot>
        <H5HomePreview />
      </ThemeRoot>
    )
  }

  return <ThemeRoot />
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
