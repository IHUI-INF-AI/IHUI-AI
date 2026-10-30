// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序页「端内独有能力」探测(薄壳降级的安全判据,2026-10-27 立)。
 *
 * 为什么要有它:小程序端有 99 枚页是端内重写(布局/数据/文案各写一份),而它们声明的共享屏
 * 在 RN 端**全部**有承载壳(现读 100/100)。把这类页改成 `@rn-shells/<壳>` 承载 = 删掉端内重复
 * 开发、样式与功能随 RN 源头同动。但有些页在端内挂了平台专属能力(支付/登录态/选图/分享/下拉刷新),
 * 改壳承载会**静默丢掉**它们 —— 本模块就是把"哪些页不能机械降级"变成可读判据。
 *
 * 判据只收「改壳后一定丢」的能力,不收纯导航(Taro.navigateTo / switchTab 之类 rn-compat
 * 兼容层已覆盖,现读 113 枚壳承载页正常工作)。失效方向:宁可多判"需人工"(多算一份手写),
 * 也不把带端能力的页判成可降级 —— 后者丢的是用户功能,不是账面数字。
 */
export const END_CAPABILITIES = [
  { id: 'payment', label: '支付', re: /Taro\.requestPayment/ },
  { id: 'login', label: '登录态', re: /Taro\.(login|checkSession)/ },
  { id: 'media-pick', label: '选图/选视频', re: /Taro\.choose(Image|Media|Video)/ },
  { id: 'profile', label: '用户资料授权', re: /Taro\.(getUserProfile|getUserInfo)/ },
  { id: 'scan', label: '扫码', re: /Taro\.scanCode/ },
  { id: 'clipboard', label: '剪贴板', re: /Taro\.setClipboardData/ },
  { id: 'media-save', label: '存相册', re: /Taro\.save(Image|Video)ToPhotosAlbum/ },
  { id: 'raw-request', label: '端内直连请求', re: /Taro\.(request|uploadFile|downloadFile)\b/ },
  { id: 'wx-global', label: '微信全局对象', re: /\bwx\./ },
  { id: 'end-api', label: '端内 api 层', re: /from\s*['"](?:@\/api|\.\.?\/[^'"]*api)['"]/ },
  { id: 'end-store', label: '端内 store', re: /from\s*['"](?:@\/stores?|zustand)['"]/ },
  { id: 'webview', label: '端内 webview 跳转', re: /pages\/webview|WebView|web-view/ },
  { id: 'share', label: '小程序分享钩子', re: /onShareAppMessage|useShareAppMessage/ },
  { id: 'pull-down', label: '下拉刷新钩子', re: /usePullDownRefresh|onPullDownRefresh/ },
  { id: 'page-lifecycle', label: '页面显示/隐藏钩子', re: /useDid(Show|Hide)/ },
  // 读路由参数的页面必须证明壳接的是同一参数(小程序 query ↔ RN navigation params 的映射
  // 由 rn-compat 决定),证据不到就按"需人工"处理,不猜。
  { id: 'route-params', label: '路由参数读取', re: /useRouter\(|getCurrentInstance\(|router\.params|\.params\?\./ },
]

/** 这页命中的端内独有能力 id 列表(空数组 = 可机械降级)。 */
export function detectEndCapabilities(text) {
  const t = String(text ?? '')
  return END_CAPABILITIES.filter((c) => c.re.test(t)).map((c) => c.id)
}

export const __test__ = { END_CAPABILITIES, detectEndCapabilities }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
