// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏播放器的「沉浸态」信号 —— 只传一个布尔,不含颜色、不含顶距。
 *
 * 为什么需要它(真机可见缺陷的根因,2026-10-02 定位):
 * `react-native-video` 在 Android 上的全屏不是本树里的布局变化,而是**另一个窗口** ——
 * `FullScreenPlayerView`(`node_modules/react-native-video/android/.../FullScreenPlayerView.kt:27`)
 * 是 `Dialog(context, android.R.style.Theme_Black_NoTitleBar)`,该主题没有
 * `windowFullscreen`,窗口落在状态栏带**之下**;它试图用 `WindowInsetsControllerCompat` 收起状态栏
 * (同文件 `updateNavigationBarVisibility`,受 `hideNotificationBarOnFullScreenMode` 控制,默认 true),
 * 但那是窗口级请求、在部分机型/系统档位上不落地。带位一旦保留,画它的仍是 `App.tsx` 那枚根 View
 * (AGENTS §4「页头返回键/状态栏单点」同一条边界:屏幕内容在屏幕顶边被裁剪,端内任何写法够不到,
 * 已由 PROJECT_PLAN「实测钉死一条边界」那一条的装机像素量反证 —— 负 margin 只动布局盒不动裁剪边界)。
 *
 * 而 `App.tsx` 此前的底色只按**聚焦路由名**取(`focusedRoute === 'VideoPlayer'`,枚 2ef1c2978),
 * 于是同一只播放器从**别的路由**发起全屏时(今天已知的一站是 `ProfileScreen` 的 `VideoPlayerModal`,
 * 它挂的是 `src/components/VideoPlayer.tsx` 而不在 `VideoPlayer` 路由上)带位仍是浅色 ——
 * 即「纯黑画面上方横一条约 34dp 浅灰带」。路由名不是这件事的因,**「有全屏播放器窗口正盖着本窗口」**才是。
 *
 * 三条不许漂的写法:
 * ① 本模块只持有布尔与订阅者,**不得**出现任何色值/`tokens`/insets —— 颜色仍只有 `App.tsx` 那一处
 *    取用点(常驻锁见 `tests/video-immersive-band.test.tsx` 的色源断言);
 * ② 顶距单点(`App.tsx` 的 `<SafeAreaView edges={['top']}>`,守门 97 S1)一字未动,本模块不参与布局;
 * ③ 计数用 holder 集合而非单个布尔:两个播放器实例并存时,任一方退出不得把另一方仍需要的沉浸态
 *    提前关掉(单布尔会让"先退出那一个"顺手替全场做决定,而它并不掌握别人的窗口)。
 */

type ImmersiveListener = (immersive: boolean) => void

/** 当前正在呈现全屏播放器窗口的实例令牌(见 ③) */
const holders = new Set<string>()
const listeners = new Set<ImmersiveListener>()
let tokenSeq = 0

function notify(): void {
  const immersive = holders.size > 0
  // 复制再遍历:订阅者可能在回调里退订(React 卸载路径),直接遍历活集合会跳过后来者
  for (const listener of Array.from(listeners)) listener(immersive)
}

/**
 * 声明「本实例的全屏播放器窗口正在盖着本窗口」,返回释放用的令牌。
 * 幂等由调用方保证(同一实例只 acquire 一次);重复调用会得到两个令牌,须各释放一次。
 */
export function acquireVideoImmersive(): string {
  tokenSeq += 1
  const token = `video-immersive-${tokenSeq}`
  holders.add(token)
  notify()
  return token
}

/** 释放令牌;传入未知令牌(例如已释放过)静默无副作用,不据此判定调用方写错了 */
export function releaseVideoImmersive(token: string): void {
  if (!holders.delete(token)) return
  notify()
}

/** 读取当前沉浸态(供订阅前的初始值,避免首帧漏判) */
export function isVideoImmersive(): boolean {
  return holders.size > 0
}

/** 订阅沉浸态变化,返回退订函数 */
export function subscribeVideoImmersive(listener: ImmersiveListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
