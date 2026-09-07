import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 壳配置(2026-09-06 立项)。
 *
 * 核心决策:androidScheme='https' + hostname='aizhs.top'
 * - 本地打包的静态资源(apps/web/out → www)以 https://aizhs.top 为 origin 加载;
 * - api-client 的 baseUrl 默认为空(同源相对路径 /api),请求直达生产后端,
 *   与浏览器里访问 aizhs.top 完全同源 → 零 CORS 改造、cookie 行为一致;
 * - 若后端将来需要区分来源,可在请求头里加自定义标识(后端侧改造,壳不动)。
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
    hostname: 'aizhs.top',
    // 2026-09-06 实测结论:仅设 hostname 时,Android WebView 会把发往 aizhs.top 的
    // API XHR 也拦截进本地资产服务器("Handling local request")→ 404,永远到不了后端。
    // 因此首版采用 server.url 远程加载(App 即线上站的壳,origin=真实域名,API 同源);
    // 本地资产离线模式待后端 CORS 白名单补 https://localhost 后切回(见 .mode-local-assets 备注分支)。
    url: 'https://aizhs.top',
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
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // 启动屏:远程模式首开需加载线上资源,延长到 3s 防白屏闪断;淡出更顺滑
    SplashScreen: {
      launchShowDuration: 3000,
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
