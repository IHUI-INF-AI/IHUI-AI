// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 应用上架平台(商店开发者后台)注册表 —— 号池「应用上架平台」分类的单一源。
 *
 * 与 `RELAY_PROVIDERS` 刻意分离:商店账号只用于「一键打开后台并保持登录态」,
 * 不参与 AI 中转转发、刷新、签到与指标。前后端都从这里取平台码/展示名/登录 URL,
 * 不允许各自再抄一份。
 */
export interface StorePlatform {
  /** 号池 provider_code(与 RELAY_PROVIDERS 不重叠) */
  providerCode: string
  /** 展示名 */
  label: string
  /** 开发者后台登录入口 */
  loginUrl: string
  /** 内置账号默认展示名(seed 用) */
  defaultName: string
  /** 内置账号唯一标识/开发者 ID(seed 去重键) */
  defaultUid: string
  /** 账号补充说明(展示用,如"企业认证") */
  note?: string
  /**
   * 掉线判定主机(只登记有实证的登录/SSO 域):当前页 host 命中即视为需要重登。
   * 未登记的平台不做臆测,页面只显示"窗口已打开/未打开",不冒充已登录。
   */
  loggedOutHosts?: readonly string[]
  /**
   * 页面自身会请求的 API 主机(含跨域)。只登记 2026-11-14 在内置浏览器实测到的域,
   * 供账号窗口抓取心跳/会话接口与带 Cookie 重放;不登记分析/埋点域。
   */
  apiHosts?: readonly string[]
  /**
   * 已验证的保活入口:优先用平台自己的会话接口,识别不到心跳时兜底。
   * 相对路径按登录页 origin 解析;跨域接口用绝对 URL。
   */
  keepaliveHint?: string
}

export const STORE_CATEGORY_LABEL = '应用上架平台'

const PLATFORMS = [
  {
    providerCode: 'huawei-agc',
    label: '华为AGC',
    loginUrl: 'https://developer.huawei.com/consumer/cn/',
    defaultName: '吉林省爱智汇人工智能科技有限公司',
    defaultUid: '186******08',
    loggedOutHosts: ['login.huawei.com', 'oauth-login.cloud.huawei.com'],
    apiHosts: ['developer.huawei.com', 'svc-drcn.developer.huawei.com'],
    keepaliveHint: '/consumer/cn/consoleIframe/api/credentials/0',
  },
  {
    providerCode: 'oppo-store',
    label: 'OPPO开放平台',
    loginUrl: 'https://open.oppomobile.com/new/ecological/app',
    defaultName: '智汇AI社区',
    defaultUid: '1267328360',
    apiHosts: ['open.oppomobile.com'],
    keepaliveHint: '/new/ecological/app',
  },
  {
    providerCode: 'vivo-store',
    label: 'vivo开放平台',
    loginUrl: 'https://dev.vivo.com.cn/manageCenter',
    defaultName: 'iHui_Inf',
    defaultUid: 'iHui_Inf',
    apiHosts: ['dev.vivo.com.cn'],
    keepaliveHint: '/webapi/user/info',
  },
  {
    providerCode: 'xiaomi-store',
    label: '小米开放平台',
    loginUrl: 'https://dev.mi.com/xiaomihyperos/console/app-manage/mobile',
    defaultName: '李春川',
    defaultUid: '851635970',
    loggedOutHosts: ['account.xiaomi.com'],
    apiHosts: ['dev.mi.com'],
    keepaliveHint: '/xiaomihyperos',
  },
  {
    providerCode: 'honor-store',
    label: '荣耀开发者平台',
    loginUrl: 'https://developer.honor.com/cn/manageCenter/overview',
    defaultName: '李春川',
    defaultUid: '李春川',
    note: '企业认证',
    apiHosts: ['developer.honor.com', 'auth-drcn.developer.honor.com', 'apigw.yun.hihonor.com'],
    keepaliveHint: 'https://auth-drcn.developer.honor.com/certification/portalWeb/auth/user',
  },
  {
    providerCode: 'yyb-store',
    label: '腾讯应用宝',
    loginUrl: 'https://app.open.qq.com/',
    defaultName: '吉林省爱智汇人工智能科技有限公司',
    defaultUid: '7350840021430848512',
    loggedOutHosts: ['graph.qq.com', 'ptlogin2.qq.com', 'xui.ptlogin2.qq.com'],
    apiHosts: ['app.open.qq.com'],
    keepaliveHint: '/api/org/user/staffs',
  },
  {
    providerCode: 'google-play',
    label: 'Google Play',
    loginUrl: 'https://play.google.com/console',
    defaultName: 'zh.ai.sq',
    defaultUid: 'ok502319984@gmail.com',
    loggedOutHosts: ['accounts.google.com'],
    apiHosts: [
      'play.google.com',
      'playconsoleplatform-pa.clients6.google.com',
      'playconsoleapps-pa.clients6.google.com',
    ],
    keepaliveHint: '/console/developers',
  },
] as const

export type StoreProviderCode = (typeof PLATFORMS)[number]['providerCode']

export const STORE_PLATFORMS: readonly StorePlatform[] = PLATFORMS

export const STORE_PROVIDER_CODES: readonly StoreProviderCode[] = PLATFORMS.map(
  (p) => p.providerCode,
)

export function isStoreProviderCode(v: string): v is StoreProviderCode {
  return (STORE_PROVIDER_CODES as readonly string[]).includes(v)
}

export function storePlatformOf(code: string): StorePlatform | null {
  return STORE_PLATFORMS.find((p) => p.providerCode === code) ?? null
}

/**
 * 当前窗口 URL 是否已落到该平台的登录/SSO 域(⇒ 需要重新登录)。
 * 只认注册表里登记过的实证主机;未登记的平台返回 false(不臆测)。
 */
export function isStoreLoggedOutUrl(url: string, platform: StorePlatform): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return (platform.loggedOutHosts ?? []).some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
