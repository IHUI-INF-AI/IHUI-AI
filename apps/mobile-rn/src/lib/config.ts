// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { Platform } from 'react-native'
import { SSO_CLIENT_IDS } from '@ihui/shared/constants'
import { version as PKG_VERSION } from '../../package.json'

/**
 * 应用版本号的唯一消费点。
 *
 * 取值顺序(2026-10-17 起):
 *   1. `EXPO_PUBLIC_IHUI_MOBILE_VERSION` —— CI 每次构建 APK 时内联进 JS bundle 的值,
 *      由 scripts/resolve-mobile-version.mjs 从构建时刻派生(`<base>.<UTC YYYYMMDD>`)
 *      ⇒ **每次发新包界面自动变**,不再要求有人记得改 package.json。
 *   2. 回退 `apps/mobile-rn/package.json` 的 version —— 本地开发 / 未走 CI 时使用。
 *
 * 两个来源必须与原生 versionName 同一次计算(app.config.js 读同一个 env),否则会出现
 * "手机上装的是 A 号、界面显示 B 号"。团结紧密谁改一边都得改另一边 ⇒ 由这两个文件的
 * 同名 env 约束住,不靠人的记忆。
 *
 * 治理史:此前 SettingsScreen 写死 1.0.2、SharedDemoScreen 写死 1.0.0,而真实版本是
 * 0.0.5 —— 三个版本号互相矛盾。收敛到单一真相源解决的是"打架",本条解决的是"不动"。
 */
export const APP_VERSION = process.env.EXPO_PUBLIC_IHUI_MOBILE_VERSION || PKG_VERSION

/**
 * `APP_VERSION` 是否与**设备真实安装的原生 versionName** 同源可信。
 *
 * 构建期由 `app.config.js` 的 `assertMobileVersionParity` 强制
 * `IHUI_MOBILE_VERSION === EXPO_PUBLIC_IHUI_MOBILE_VERSION`(只注入一侧当场抛错),
 * 所以 env 非空 ⇒ 这个值就是本次原生包的名字,可以拿来判 APK 升降级。
 *
 * env 缺失时会回退 `package.json` 的 version(现值 0.0.12),它**不代表设备上装了什么**:
 * 本地开发、旧 OTA bundle、漏注入的那次构建都长这个样。2026-11-12 真机事故即由此而来 ——
 * 设备装 0.0.25、bundle 报 0.0.12,把服务端 0.0.24 判成「新版本」,点下去其实是降级安装。
 *
 * 消费纪律:**凡要判断「该不该装新包」,必须先问这个标记**;不可信一律按「未判定」处理,
 * 宁可漏报升级,绝不把用户带进降级安装(§0.3 取不到输入不记绿不冒红)。
 * 显示用途(设置页、能力上报、User-Agent)不受影响,照旧用 APP_VERSION。
 */
export const APP_VERSION_IS_AUTHORITATIVE = Boolean(
  (process.env.EXPO_PUBLIC_IHUI_MOBILE_VERSION || '').trim(),
)

/**
 * 首方 User-Agent(2026-09-24 立)。RN 的 fetch 由 okhttp 实现,而后端
 * `apps/api/src/utils/bot-detection.ts` 把 `okhttp` 列进 CURL_LIKE_KEYWORDS ——
 * 不设 UA 等于自家 App 的**每个**请求都被判为爬虫:
 *  ① 一旦出口 IP 越过挑战阈值,429 会带 `X-Challenge-Type: bot` 并要求完成一个
 *    RN 端根本无法渲染的 CAPTCHA(`/api/security/challenge` 无任何客户端实现);
 *  ② 每次请求都触发 `recordBadEvent(ip, 'automation-ua')`,持续拉低用户出口 IP 的
 *    信誉,可升级到 403「IP 已被临时封禁 15 分钟」。
 * 手机走运营商 NAT,一个出口 IP 承载大量真实用户,误判代价被成倍放大。
 * 字符串刻意不含任何 curl-like / bot 关键字。
 */
export const APP_USER_AGENT = `IHUIAI-App/${APP_VERSION} (${Platform.OS}/${
  typeof Platform.Version === 'number' ? Platform.Version : (Platform.Version ?? 'unknown')
})`

const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8802'

// 10.0.2.2 是 Android 模拟器访问宿主机的专用 IP,web 平台浏览器无法访问,替换为 localhost。
// 生产环境配置的真实域名(如 https://api.example.com)不受影响。
export const API_BASE_URL =
  Platform.OS === 'web' && ENV_API_BASE_URL.includes('10.0.2.2')
    ? ENV_API_BASE_URL.replace('10.0.2.2', 'localhost')
    : ENV_API_BASE_URL

// 2026-10-21 立:设备/发布包里 API 基址仍指向本机回环 = 构建配置错误,拒绝启动。
// 设备侧 localhost 不是宿主机(连不上);更严重的是它会把**生产 token** 送到 dev API ——
// 两边 JWT 密钥不同 ⇒ refresh 判 401 ⇒ App 按"服务端明确否定"清会话(实测:机主账号被登出)。
// 开发档豁免:__DEV__ / NODE_ENV≠production 时本机回环正是开发形态。
const IS_DEV_BUILD = typeof __DEV__ === 'boolean' ? __DEV__ : process.env.NODE_ENV !== 'production'
if (
  !IS_DEV_BUILD &&
  /^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|10\.0\.2\.2)(?::\d+)?(?:\/|$)/.test(ENV_API_BASE_URL)
) {
  throw new Error(
    `[ihui-rn] 拒绝启动:EXPO_PUBLIC_API_BASE_URL 指向本机回环(${ENV_API_BASE_URL})。` +
      '设备/发布包必须显式带真实 API 域名(如 https://api.aizhs.top):否则既连不上,还会把生产 token 送到错误 API 导致会话被清。',
  )
}

/**
 * WebSocket 基址(实时通道专用,与 REST **刻意分域**;键名与解析优先级照搬 web 侧
 * `apps/web/src/lib/ws-url.ts` + `deploy/prod-bundle/svc/run-web.ps1`,不新造第二套口径)。
 *
 * 为什么 REST 与 WS 不能是同一个域名(2026-10-21 现测,非推测):
 *   - `wss://api.aizhs.top/ws/notifications` 带 Upgrade 头 3/3 拿到 **101**;
 *   - `wss://www.aizhs.top/ws/notifications` 同构造 3/3 拿到 **404**;
 *   - 决定性对照:www 那枚 404 的响应头带 `x-api-version: 1` / `x-trace-id` / `x-ratelimit-*`
 *     —— 与 `api.aizhs.top/ws/notifications` **不带 Upgrade 头**时的 404 同一副签名 ⇒
 *     请求确实抵达了 api(8802),是**升级语义没跟着走完整条腿**(EdgeOne → web 那一跳)。
 *     哪个具体层剥掉的不判、也不许照猜去改:判据只认"www 臂今天承载不了 WS 握手"这一条实测。
 *   - `/ws/ticket`(REST 换票)与 `/ws/broadcast`、`/ws/live-chat` 同源同域,一起跟着走。
 *
 * 因此:REST 走 www 臂(EdgeOne → 家宽源站,ttfb 现测 0.23~0.29s),WS 钉回 api 臂
 * (Cloudflare Tunnel,跨境慢但能握手)。**两个域名都必须一直活着** ——
 * `EXPO_PUBLIC_*` 是 metro 转换期内联进 JS 的,已经装在用户机上的旧包仍然指向
 * `api.aizhs.top`,撤掉那条臂等于把没升级的用户整体断网。
 *
 * 回退到 `API_BASE_URL`(而不是某个写死的域):开发构建里两者同为本机回环,行为零变化;
 * 生产由 `eas.json` / 两条 release 工作流显式钉住,漏钉即由镜像回归点名。
 */
export const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_BASE_URL || API_BASE_URL

export { TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from '@ihui/shared/constants'

/**
 * SSO 配置(移动端作为 SSO client 接入 web 登录中心)
 *
 * 流程:
 * 1. 用户点"使用网页账号登录" → openAuthSession 打开 web /sso/login?redirect=ihui://sso/callback&client_id=mobile-rn
 * 2. 用户在 web 登录后,web 生成 30s sso_code,跳 ihui://sso/callback?sso_code=xxx
 * 3. 系统拦截 deep link,拿 sso_code 调 /api/auth/sso/exchange 换 token → 自动登录
 */
export const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:8801'
export const SSO_CLIENT_ID = SSO_CLIENT_IDS.MOBILE_RN
export const SSO_REDIRECT_URI = 'ihui://sso/callback'

/**
 * 连通性出口的**旁证**探针地址(台账 G-1113920)。
 *
 * 为什么单列一个常量而不是复用 `API_BASE_URL`:后者在开发构建里默认是 `http://localhost:8802`,
 * 而真机上的 `localhost` 是手机自己 ⇒ 永远拒绝连接。只用它做在线判据,等于把"我这台构建没连上
 * 开发机"渲染成"用户的网络已断开"(票面现场:设备 ping 通、两条 NetworkAgentInfo 均 VALIDATED,
 * 横幅却一路亮红)。取 `eas.json` production profile 的同一域名 ⇒ 与装机配置无关,答了就证明
 * 设备出口是通的。
 */
// 2026-11-12 真机实测更正落点:裸域 `aizhs.top/api/health` 返回 403 且耗时 4.93s,
// 6s 探测窗在移动网络上常态超时 ⇒ 旁证格长期判"没答",登录页跟着挂误导性错误条。
// `www.aizhs.top/api/health` 实测 200/0.33s,正是 eas.json production 的 WEB 域;
// 不取 `api.aizhs.top` 是因为它与 primary(API_BASE_URL)同源,两格重复探同一台机,
// 旁证就失去"换一条出口验证设备连通性"的意义。
export const EGRESS_PROBE_URL =
  process.env.EXPO_PUBLIC_EGRESS_PROBE_URL || 'https://www.aizhs.top/api/health'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
