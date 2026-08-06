/**
 * 下载入口配置(2026-07-25 抽取,2026-08-06 深度扩展)
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
 * 2026-08-06 深度扩展(用户反馈"所有端下载按钮点击后没有任何下载地址,也没有安装包可下载"):
 *  - 新增 `PLATFORM_META`:8 端完整元数据(版本号 / 发布日期 / 系统要求 / 安装指南 / 资源列表)
 *  - desktop 接入真实 NSIS .exe + MSI 安装包(从 apps/desktop 构建产物复制)
 *  - extension 接入真实 Chrome MV3 .zip 包(从 apps/extension 构建产物打包)
 *  - cli/mobile 走 /download/[platform] 详情页展示 npm 安装命令 / 构建说明
 *  - ios/android-apk/wechat-miniapp 暂未接入,详情页显示"即将上线"+ Web 端使用引导
 *  - 详情页路由 `apps/web/app/(main)/download/[platform]/page.tsx` 渲染 PLATFORM_META
 *
 * 接入流程:
 *  1. iOS 上架后:填 `appStoreId`(纯数字 ID),自动生成 App Store URL + 在 PLATFORM_META.ios.assets 加条目
 *  2. Android 上架 Google Play:填 `hrefs.android` 为 Play Store URL + 在 PLATFORM_META['android-apk'].assets 加条目
 *  3. APK 直链:填 `apkPath` 为 CDN 绝对 URL,`apkFileName` 与 CDN 文件对齐 + 在 PLATFORM_META['android-apk'].assets 加条目
 *  4. 微信小程序:填 `wechatMiniProgramQr` 为扫码落地页 URL 或 scheme + 在 PLATFORM_META['wechat-miniapp'].assets 加条目
 *  5. Desktop/Mobile/Extension/CLI:填 `hrefs.desktop` / `hrefs.mobile` /
 *     `hrefs.extension` / `hrefs.cli` 为 CDN 下载 URL 或 /download/[platform] 详情页路由
 */

/** 项目所有支持的下载端(8 端),与 apps/* 目录一一对应 */
export type DownloadPlatform =
  | 'web'
  | 'desktop'
  | 'ios'
  | 'android-apk'
  | 'mobile'
  | 'wechat-miniapp'
  | 'extension'
  | 'cli'

/** 单个下载资源文件元数据(一个端可能有多种格式/架构,如 desktop 同时提供 .exe 和 .msi) */
export interface DownloadAsset {
  /** 文件下载 URL;http(s):// 开头视为外链,否则视为 /public 下相对路径 */
  href: string
  /** 文件大小(字节),UI 展示 "12.4 MB" */
  sizeBytes: number
  /** 文件 SHA256 校验值(可选,接入后端 API 时填充) */
  sha256?: string
  /** 文件格式标签,如 "Windows NSIS exe" / "Windows MSI" / "Chrome MV3 ZIP" / "Android APK" */
  format: string
  /** 文件架构标签,如 "x64" / "arm64" / "universal"(可选) */
  arch?: string
}

/** 单个端的完整元数据(用于 /download/[platform] 详情页渲染) */
export interface PlatformMeta {
  /** 平台枚举值 */
  platform: DownloadPlatform
  /** 当前已发布版本号(如 "0.1.13");未接入时为 undefined */
  version?: string
  /** 发布日期 YYYY-MM-DD;未接入时为 undefined */
  releaseDate?: string
  /** i18n key:系统要求(nav 命名空间下),如 'downloadDesktopSysReq' */
  systemRequirementsKey?: string
  /** i18n key:安装指南 markdown(nav 命名空间下),如 'downloadDesktopInstallGuide' */
  installGuideKey?: string
  /** i18n key:发布说明(nav 命名空间下,可选) */
  releaseNotesKey?: string
  /** 该端的可下载资源列表(可能多种格式/架构);空数组表示"未接入",UI 显示"即将上线" */
  assets: DownloadAsset[]
  /** GitHub Releases 链接(可选,作为下载备选入口) */
  githubReleasesUrl?: string
  /** 文档链接(可选,如 CLI 的 npm 包页面) */
  docsUrl?: string
}

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
  // TODO(运营):CDN 接入后改为绝对 URL(如 https://cdn.aizhs.top/apk/app-release.apk)
  apkPath: '',
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
    // Desktop 详情页路由(展示 NSIS exe + MSI 双格式下载按钮 + 系统要求 + 安装指南)
    desktop: '/download/desktop',
    // Mobile RN 详情页路由(展示源码构建说明 + GitHub 链接)
    mobile: '/download/mobile',
    // Extension 详情页路由(展示 Chrome MV3 ZIP 下载 + 加载说明)
    extension: '/download/extension',
    // CLI 详情页路由(展示 npm 安装命令 + 使用文档)
    cli: '/download/cli',
  },
}

/**
 * 8 端完整下载元数据(2026-08-06 新增)。
 *
 * 用于 /download/[platform] 详情页渲染:
 *  - assets 非空 → 显示下载按钮(支持多格式/架构)
 *  - assets 为空 + version 未填 → 显示"即将上线"占位
 *  - assets 为空 + installGuideKey 已填 → 显示安装/构建说明(CLI/Mobile)
 *
 * 接入新版本时:更新 version + releaseDate + assets[].href/sizeBytes 即可。
 * 文件物理位置:apps/web/public/downloads/<platform>/<filename>
 */
export const PLATFORM_META: Record<DownloadPlatform, PlatformMeta> = {
  web: {
    platform: 'web',
    version: '1.0.0',
    releaseDate: '2026-08-06',
    systemRequirementsKey: 'downloadWebSysReq',
    installGuideKey: 'downloadWebInstallGuide',
    assets: [
      {
        href: '/',
        sizeBytes: 0,
        format: 'PWA / Browser',
      },
    ],
  },
  desktop: {
    platform: 'desktop',
    version: '0.1.13',
    releaseDate: '2026-08-06',
    systemRequirementsKey: 'downloadDesktopSysReq',
    installGuideKey: 'downloadDesktopInstallGuide',
    releaseNotesKey: 'downloadDesktopReleaseNotes',
    githubReleasesUrl: 'https://github.com/IHUI-INF-AI/IHUI-AI/releases',
    // 真实安装包(从 apps/desktop/src-tauri/target/release/bundle/ 复制)
    assets: [
      {
        href: '/downloads/desktop/IHUI-AI-Setup-0.1.13-x64.exe',
        sizeBytes: 75095099,
        format: 'Windows NSIS exe',
        arch: 'x64',
      },
      {
        href: '/downloads/desktop/IHUI-AI-Setup-0.1.13-x64.msi',
        sizeBytes: 81514496,
        format: 'Windows MSI',
        arch: 'x64',
      },
    ],
  },
  ios: {
    platform: 'ios',
    // TODO(运营):App Store 上架后填入 version + releaseDate + assets
    systemRequirementsKey: 'downloadIOSSysReq',
    installGuideKey: 'downloadIOSInstallGuide',
    assets: [],
  },
  'android-apk': {
    platform: 'android-apk',
    // TODO(运营):APK 构建产物部署到 apps/web/public/apk/ 后填入 version + releaseDate + assets
    systemRequirementsKey: 'downloadAndroidSysReq',
    installGuideKey: 'downloadAndroidInstallGuide',
    assets: [],
  },
  mobile: {
    platform: 'mobile',
    version: '1.0.0',
    releaseDate: '2026-08-06',
    systemRequirementsKey: 'downloadMobileSysReq',
    installGuideKey: 'downloadMobileInstallGuide',
    githubReleasesUrl: 'https://github.com/IHUI-INF-AI/IHUI-AI/tree/main/apps/mobile-rn',
    // Mobile RN 走源码构建,无预编译包
    assets: [],
  },
  'wechat-miniapp': {
    platform: 'wechat-miniapp',
    // TODO(运营):微信小程序发布后填入 version + releaseDate + assets(QR 图片)
    systemRequirementsKey: 'downloadWechatSysReq',
    installGuideKey: 'downloadWechatInstallGuide',
    assets: [],
  },
  extension: {
    platform: 'extension',
    version: '1.0.0',
    releaseDate: '2026-08-06',
    systemRequirementsKey: 'downloadExtensionSysReq',
    installGuideKey: 'downloadExtensionInstallGuide',
    githubReleasesUrl: 'https://github.com/IHUI-INF-AI/IHUI-AI/releases',
    // 真实扩展包(从 apps/extension/.output/chrome-mv3/ 打包)
    assets: [
      {
        href: '/downloads/extension/IHUI-AI-Extension-chrome-v1.0.0.zip',
        sizeBytes: 1294181,
        format: 'Chrome MV3 ZIP',
      },
    ],
  },
  cli: {
    platform: 'cli',
    version: '1.0.0',
    releaseDate: '2026-08-06',
    systemRequirementsKey: 'downloadCliSysReq',
    installGuideKey: 'downloadCliInstallGuide',
    docsUrl: 'https://www.npmjs.com/package/@ihui/cli',
    githubReleasesUrl: 'https://github.com/IHUI-INF-AI/IHUI-AI/releases',
    // CLI 走 npm install,无独立安装包
    assets: [],
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

/** 获取指定端的元数据(PLATFORM_META 类型安全访问) */
export function getPlatformMeta(platform: DownloadPlatform): PlatformMeta {
  return PLATFORM_META[platform]
}

/**
 * 格式化文件大小为人类可读字符串。
 * - < 1 KB → "123 B"
 * - < 1 MB → "12.3 KB"
 * - < 1 GB → "12.3 MB"
 * - ≥ 1 GB → "1.2 GB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  // B 整数显示,KB/MB/GB 保留 1 位小数
  return unitIndex === 0 ? `${Math.round(value)} ${units[unitIndex]}` : `${value.toFixed(1)} ${units[unitIndex]}`
}
