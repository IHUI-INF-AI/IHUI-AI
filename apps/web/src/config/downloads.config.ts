/**
 * 下载入口配置(2026-07-25 抽取,与 downloads.tsx 解耦)
 *
 * 历史:原本 4 处运营待办(App Store ID / 4 端 href / APK path / 微信小程序 QR)
 *  内联在 `apps/web/src/lib/downloads.tsx` 的 DOWNLOADS 数组里,导致:
 *  1) 运营配置散落在 UI 数据层,缺单一事实源
 *  2) 上线流程需改 .tsx 文件,非运营同学容易误改其他字段
 *  3) 4 处 TODO 与代码 TODO 混杂,守门脚本无法区分运营待办 vs 技术待办
 *
 * 抽取后:
 *  - 所有"运营待接入"字段集中在 `DOWNLOADS_CONFIG`,以 `TODO(运营)` 注释标记
 *  - downloads.tsx 仅做 UI 渲染,无 TODO 注释
 *  - 空字符串值视为"未接入",downloads.tsx 用占位状态展示"即将上线"
 *
 * 接入流程:
 *  1. iOS 上架后:填 `appStoreId`(纯数字 ID),自动生成 App Store URL
 *  2. Android 上架 Google Play:填 `hrefs.android` 为 Play Store URL
 *  3. APK 直链:填 `apkPath` 为 CDN 绝对 URL,`apkFileName` 与 CDN 文件对齐
 *  4. 微信小程序:填 `wechatMiniProgramQr` 为扫码落地页 URL 或 scheme
 *  5. Desktop/Mobile/Extension/CLI:填 `hrefs.desktop` / `hrefs.mobile` /
 *     `hrefs.extension` / `hrefs.cli` 为 CDN 下载 URL
 */

export interface DownloadsConfig {
  /** iOS App Store 数字 ID(纯数字);空字符串表示未上架,自动用占位 URL */
  appStoreId: string
  /** APK 文件路径;以 http(s):// 开头视为 CDN 绝对 URL,否则视为 /public 下相对路径 */
  apkPath: string
  /** APK 文件名,与 apps/web/public/apk/ 实际文件对齐 */
  apkFileName: string
  /** 微信小程序扫码落地页 URL 或 scheme;空字符串表示未接入 */
  wechatMiniProgramQr: string
  /** 4 端 href 配置;空字符串表示该端未上架,UI 显示"即将上线" */
  hrefs: {
    /** iOS App Store URL;空时若 appStoreId 已填则自动生成,否则占位 */
    ios: string
    /** Android Google Play 或 APK 直链;空时若 apkPath 已填则用 apkPath,否则占位 */
    android: string
    /** 微信小程序入口;空时若 wechatMiniProgramQr 已填则用之,否则占位 */
    wechat: string
    /** Desktop 下载页或直链;空表示未接入 */
    desktop: string
    /** Mobile RN 下载页;空表示未接入 */
    mobile: string
    /** Extension 商店链接;空表示未接入 */
    extension: string
    /** CLI 安装文档;空表示未接入 */
    cli: string
  }
}

/**
 * 下载配置单一事实源。
 *
 * 运营接入时仅需修改本常量,downloads.tsx 自动适配。
 * 所有空字符串值在 UI 中显示为"即将上线"占位。
 */
export const DOWNLOADS_CONFIG: DownloadsConfig = {
  // TODO(运营):iOS App 上架后填入纯数字 App Store ID(如 "1234567890")
  appStoreId: '',
  // TODO(运营):CDN 接入后改为绝对 URL(如 https://cdn.ihui.ai/apk/app-release.apk)
  apkPath: '/apk/ihui-ai-latest.apk',
  // TODO(运营):与 apps/web/public/apk/ 实际文件名对齐
  apkFileName: 'ihui-ai-latest.apk',
  // TODO(运营):微信小程序 QR scheme 或扫码落地页 URL
  wechatMiniProgramQr: '',
  hrefs: {
    // TODO(运营):App Store URL;留空时若 appStoreId 已填会自动生成,否则占位
    ios: '',
    // TODO(运营):Google Play URL 或 APK 直链;留空时回退到 apkPath
    android: '',
    // TODO(运营):微信小程序入口;留空时回退到 wechatMiniProgramQr
    wechat: '',
    // TODO(运营):Desktop 下载 URL(当前用占位路由 /download/desktop)
    desktop: '/download/desktop',
    // TODO(运营):Mobile RN 下载 URL(当前用占位路由 /download/mobile)
    mobile: '/download/mobile',
    // TODO(运营):Extension 商店链接(当前用占位路由 /download/extension)
    extension: '/download/extension',
    // TODO(运营):CLI 安装文档 URL(当前用占位路由 /download/cli)
    cli: '/download/cli',
  },
}

/**
 * 解析 iOS 下载 URL:优先用 hrefs.ios,其次用 appStoreId 自动生成,最后占位。
 * 返回空字符串表示"未接入",调用方用占位状态。
 */
export function resolveIosHref(): string {
  if (DOWNLOADS_CONFIG.hrefs.ios) return DOWNLOADS_CONFIG.hrefs.ios
  if (DOWNLOADS_CONFIG.appStoreId) {
    return `https://apps.apple.com/cn/app/id${DOWNLOADS_CONFIG.appStoreId}`
  }
  return ''
}

/**
 * 解析 Android 下载 URL:优先用 hrefs.android,其次用 apkPath,最后占位。
 */
export function resolveAndroidHref(): string {
  if (DOWNLOADS_CONFIG.hrefs.android) return DOWNLOADS_CONFIG.hrefs.android
  if (DOWNLOADS_CONFIG.apkPath) return DOWNLOADS_CONFIG.apkPath
  return ''
}

/**
 * 解析微信小程序入口:优先用 hrefs.wechat,其次用 wechatMiniProgramQr,最后占位。
 */
export function resolveWechatHref(): string {
  if (DOWNLOADS_CONFIG.hrefs.wechat) return DOWNLOADS_CONFIG.hrefs.wechat
  if (DOWNLOADS_CONFIG.wechatMiniProgramQr) return DOWNLOADS_CONFIG.wechatMiniProgramQr
  return ''
}
