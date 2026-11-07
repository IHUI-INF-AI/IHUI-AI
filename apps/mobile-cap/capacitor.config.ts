// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 壳配置(2026-09-06 立项;2026-11-06 BUG-94 切回本地资产离线壳)。
 *
 * 核心决策(切回后):androidScheme='https' + hostname='localhost',**不设 server.url**。
 * - 运行时加载 APK 内 www/ 的本地静态资产 ⇒ 无网也能开壳(离线可用),不再远程加载整站;
 * - www 由 scripts/sync-web.mjs 从 ../../apps/web/out 同步,现在是**实际被加载**的资产,
 *   不再是"拷进 APK 却从不读"的白拷 ⇒ 包体不再白白增大;
 * - 本地资产 origin 与线上 API 不同域,API XHR 不再被 WebView 的本地资产服务器拦截成 404
 *   (旧 hostname='aizhs.top' 那次实测的坑);API 需显式指向生产后端,跨域由后端 CORS
 *   白名单放行 https://localhost(配套项见「范围外待转派」:apps/web 构建期 baseUrl + 后端 CORS)。
 *
 * webDir='www' 由 scripts/sync-web.mjs 从 ../../apps/web/out 同步,
 * 禁止直接指向 ../web/out(Capacitor 会把 webDir 拷入 android assets,
 * 跨端路径语义不清晰且构建顺序不可控)。
 */
const config: CapacitorConfig = {
  appId: 'top.aizhs.app',
  appName: '智汇AI',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    // 本地资产专用 origin:不与线上 API 域名同 host,避免 WebView 把 /api/* 请求
    // 拦截进本地资产服务器(2026-09-06 实测 404)。
    hostname: 'localhost',
    // BUG-94:默认本地资产(离线壳)—— 不设置 server.url,WebView 直接加载 APK 内 www/;
    // www 由 scripts/sync-web.mjs 同步,不再远程加载整站,包体不再白白增大,
    // 离线也能开壳。webDir='www' 同步逻辑保留不变。
    // 切回远程的前提:后端 CORS 已放行 https://localhost(配套 apps/web 构建期 baseUrl)。
    // 临时切回远程整站加载(开发/灰度用,生产默认关):设 MOBILE_CAP_USE_REMOTE=1。
    ...(process.env.MOBILE_CAP_USE_REMOTE === '1'
      ? { url: 'https://aizhs.top' }
      : {}),
  },
  // 2026-09-07 真机修复:状态栏遮挡内容。
  // 根因:Android WebView(Chromium<140,本站壳实测 WebView=130)对 env(safe-area-inset-*)
  // 恒报 0px,导致页面里 GlobalShell 的 pt-[env(safe-area-inset-top)] 解析为 0,内容顶到屏幕顶部被状态栏盖住(桌面/浏览器 env()=0 不受影响)。
  // 解法:force 模式下 Capacitor 原生读取真实 WindowInsets,以 margin 让 WebView 避开系统状态栏/导航条,
  // 不依赖页面 CSS 的 env(),对登录/首屏/全页面统一生效;Web 端 / 桌面保持原布局。
  android: {
    adjustMarginsForEdgeToEdge: 'force',
  },
  plugins: {
    // 2026-09-08 移除 @capacitor/push-notifications:项目无 Firebase 配置(无 google-services.json),
    // 登录后 register() 触发 FirebaseApp 未初始化异常,原生线程上抛 Fatal 直接杀掉整个进程(登录即闪退)。
    // JS 侧 use-native-push.ts 已对缺失插件兜底(window.Capacitor.Plugins.PushNotifications 为 undefined 即 no-op),
    // 故移除插件后 App 正常。将来接入真实 Firebase 再重新加回该插件与配置。
    // 启动屏:本地资产已随包,首帧即可渲染;保留短时长仅为淡出观感,不再为远程加载兜底
    SplashScreen: {
      launchShowDuration: 500,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    // 键盘:resize 模式避免输入框被软键盘遮挡(聊天输入框场景关键)
    Keyboard: {
      resize: 'resize',
      resizeOnFullScreen: true,
    },
  },
}

export default config
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
