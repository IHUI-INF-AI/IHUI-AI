/**
 * 下载入口配置(2026-07-25 抽取,2026-08-06 深度扩展,2026-08-06 运营数据 env 化)
 *
 * 历史:原本 4 处运营待办(App Store ID / 4 端 href / APK path / 微信小程序 QR)
 *  内联在 `apps/web/src/lib/downloads.tsx` 的 DOWNLOADS 数组里,导致:
 *  1) 运营配置散落在 UI 数据层,缺单一事实源
 *  2) 上线流程需改 .tsx 文件,非运营同学容易误改其他字段
 *  3) 4 处 @doc TODO 与代码 @doc TODO 混杂,守门脚本无法区分运营待办 vs 技术待办
 *
 * 抽取后:
 *  - 所有"运营待接入"字段集中在 `DOWNLOADS_CONFIG`,以 `@doc TODO(运营)` 注释标记
 *  - downloads.tsx 仅做 UI 渲染,无 @doc TODO 注释
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
 * 2026-08-06 运营数据 env 化(本次改造):
 *  - 原先 10 处 `@doc TODO(运营)` 占位全部改为**运行时环境变量**配置,运营无需改代码。
 *  - 所有 env 以 `NEXT_PUBLIC_` 前缀暴露,未配置的 getter 返回 null(归一为空字符串),
 *    前端自动走"即将上线"占位逻辑;配置后自动生成下载入口 + 详情页 assets。
 *  - `DOWNLOADS_CONFIG` / `PLATFORM_META` 保留为模块级常量(由 env 计算)以兼容现有调用方;
 *    推荐新代码使用 `getDownloadsConfig()` / `getPlatformMetaMap()` getter。
 *
 * 环境变量清单(全部可选;未配置 = 未上架):
 *  | 环境变量                                   | 对应配置字段                          | 说明 |
 *  |--------------------------------------------|---------------------------------------|------|
 *  | NEXT_PUBLIC_DOWNLOAD_APPSTORE_ID           | appStoreId                            | iOS App Store 纯数字 ID,如 1234567890 |
 *  | NEXT_PUBLIC_DOWNLOAD_APPSTORE_URL          | hrefs.ios                            | 显式 App Store URL(优先于 ID 自动生成) |
 *  | NEXT_PUBLIC_DOWNLOAD_GOOGLE_PLAY_URL       | hrefs.android                        | Google Play 入口(优先于 APK 直链) |
 *  | NEXT_PUBLIC_DOWNLOAD_CDN_BASE              | —(拼 apkPath 用)                     | CDN 基础地址,如 https://cdn.example.com |
 *  | NEXT_PUBLIC_DOWNLOAD_APK_URL               | apkPath                              | APK 完整下载 URL(优先于 CDN_BASE 拼接) |
 *  | NEXT_PUBLIC_DOWNLOAD_APK_FILE_NAME         | apkFileName                          | APK 文件名(配合 CDN_BASE 拼接;默认 ihui-ai-latest.apk) |
 *  | NEXT_PUBLIC_DOWNLOAD_WECHAT_QR             | wechatMiniProgramQr                  | 微信小程序二维码落地页 URL 或 scheme |
 *  | NEXT_PUBLIC_DOWNLOAD_WECHAT_URL            | hrefs.wechat                         | 微信小程序入口 URL(优先于 QR) |
 *  | NEXT_PUBLIC_DOWNLOAD_IOS_VERSION           | PLATFORM_META.ios.version            | iOS 版本号(需与 APPSTORE_ID 同时配置) |
 *  | NEXT_PUBLIC_DOWNLOAD_IOS_RELEASE_DATE      | PLATFORM_META.ios.releaseDate        | iOS 发布日期 YYYY-MM-DD |
 *  | NEXT_PUBLIC_DOWNLOAD_APK_VERSION           | PLATFORM_META['android-apk'].version | APK 版本号(需与 APK_URL/GOOGLE_PLAY_URL 同时配置) |
 *  | NEXT_PUBLIC_DOWNLOAD_APK_RELEASE_DATE      | PLATFORM_META['android-apk'].releaseDate | APK 发布日期 YYYY-MM-DD |
 *  | NEXT_PUBLIC_DOWNLOAD_WECHAT_VERSION        | PLATFORM_META['wechat-miniapp'].version | 小程序版本号(需与 WECHAT_QR 同时配置) |
 *  | NEXT_PUBLIC_DOWNLOAD_WECHAT_RELEASE_DATE   | PLATFORM_META['wechat-miniapp'].releaseDate | 小程序发布日期 YYYY-MM-DD |
 *
 * 配置方式(apps/web/.env.local 或 .env.production,示例):
 *  # ---- iOS ----
 *  NEXT_PUBLIC_DOWNLOAD_APPSTORE_ID=1234567890
 *  NEXT_PUBLIC_DOWNLOAD_IOS_VERSION=1.0.0
 *  NEXT_PUBLIC_DOWNLOAD_IOS_RELEASE_DATE=2026-09-01
 *  # ---- Android(Google Play 与 APK 直链可二选一)----
 *  NEXT_PUBLIC_DOWNLOAD_GOOGLE_PLAY_URL=https://play.google.com/store/apps/details?id=com.ihui.ai
 *  NEXT_PUBLIC_DOWNLOAD_APK_URL=https://cdn.example.com/apk/ihui-ai-v1.0.0.apk
 *  NEXT_PUBLIC_DOWNLOAD_APK_VERSION=1.0.0
 *  NEXT_PUBLIC_DOWNLOAD_APK_RELEASE_DATE=2026-09-01
 *  # ---- 微信小程序 ----
 *  NEXT_PUBLIC_DOWNLOAD_WECHAT_QR=https://example.com/miniapp/qr
 *  NEXT_PUBLIC_DOWNLOAD_WECHAT_VERSION=1.0.0
 *  NEXT_PUBLIC_DOWNLOAD_WECHAT_RELEASE_DATE=2026-09-01
 *
 * 注意:
 *  - NEXT_PUBLIC_ 前缀变量在 Next.js **构建期**被 webpack DefinePlugin 内联,
 *    修改 env 后必须重新 build 才生效;服务端与浏览器端读取结果一致。
 *  - 保留默认值结构:未配置项 getter 返回 null,`DOWNLOADS_CONFIG`/`PLATFORM_META`
 *    内部归一为空字符串,现有调用方(`href.length > 0` 等真值判断)无需改动。
 *  - Desktop / Mobile / Extension / CLI 4 端走代码内路由(/download/[platform]),不依赖 env。
 *
 * 接入流程(等价于旧版"改常量"流程,现在改 env):
 *  1. iOS 上架后:填 NEXT_PUBLIC_DOWNLOAD_APPSTORE_ID,自动生成 App Store URL + 详情页资源
 *  2. Android 上架 Google Play:填 NEXT_PUBLIC_DOWNLOAD_GOOGLE_PLAY_URL(或 APK 直链)
 *  3. APK 直链:填 NEXT_PUBLIC_DOWNLOAD_APK_URL(或 CDN_BASE + APK_FILE_NAME)
 *  4. 微信小程序:填 NEXT_PUBLIC_DOWNLOAD_WECHAT_QR
 *  5. 各端可选补 version / releaseDate,详情页头部展示版本号与发布日期
 */

/** 项目所有支持的下载端(8 端),与 apps/* 目录一一对应 */
export type DownloadPlatform =
  'web' | 'desktop' | 'ios' | 'android-apk' | 'mobile' | 'wechat-miniapp' | 'extension' | 'cli'

/** 单个下载资源文件元数据(一个端可能有多种格式/架构,如 desktop 同时提供 .exe 和 .msi) */
export interface DownloadAsset {
  /** 文件下载 URL;http(s):// 开头视为外链,否则视为 /public 下相对路径 */
  href: string
  /** 文件大小(字节),UI 展示 "12.4 MB";商店链接/扫码落地页用 0 表示无体积 */
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

/* -------------------------------------------------------------------------- */
/* 环境变量读取(2026-08-06 起,运营配置的唯一入口)                            */
/* -------------------------------------------------------------------------- */

/**
 * 读取单个 NEXT_PUBLIC_ 环境变量。
 * 未配置 / 空白 → 返回 null(表示"未上架");配置 → 返回 trim 后字符串。
 * 注意:参数必须是字面量 `process.env.NEXT_PUBLIC_*` 表达式(非动态变量名),
 * 否则 Next.js 构建期无法用 DefinePlugin 内联,浏览器端将拿不到值。
 */
function readEnv(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** iOS App Store 纯数字 ID;未配置返回 null */
export function getAppStoreId(): string | null {
  return readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_APPSTORE_ID)
}

/** 显式 App Store URL;未配置返回 null */
export function getAppStoreUrl(): string | null {
  return readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_APPSTORE_URL)
}

/** Google Play 商店入口;未配置返回 null */
export function getGooglePlayUrl(): string | null {
  return readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_GOOGLE_PLAY_URL)
}

/** CDN 基础地址(用于拼接 APK 直链);未配置返回 null */
export function getCdnBase(): string | null {
  return readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_CDN_BASE)
}

/** APK 完整下载 URL;未配置返回 null */
export function getApkUrl(): string | null {
  return readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_APK_URL)
}

/** APK 文件名(配合 CDN_BASE 拼接);默认保留历史值 'ihui-ai-latest.apk' */
export function getApkFileName(): string {
  return readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_APK_FILE_NAME) ?? 'ihui-ai-latest.apk'
}

/** 微信小程序二维码落地页 URL 或 scheme;未配置返回 null */
export function getWechatQr(): string | null {
  return readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_WECHAT_QR)
}

/** 微信小程序入口 URL(优先于 QR);未配置返回 null */
export function getWechatEntryUrl(): string | null {
  return readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_WECHAT_URL)
}

/**
 * 解析 APK 直链:
 *  1. NEXT_PUBLIC_DOWNLOAD_APK_URL 直接返回;
 *  2. NEXT_PUBLIC_DOWNLOAD_CDN_BASE 非空 → `${CDN_BASE}/${apkFileName}`(去除尾部 /);
 *  3. 均未配置 → 返回空字符串(未上架)。
 */
export function getApkPath(): string {
  const apkUrl = getApkUrl()
  if (apkUrl) return apkUrl
  const cdnBase = getCdnBase()
  if (cdnBase) return `${cdnBase.replace(/\/+$/, '')}/${getApkFileName()}`
  return ''
}

/* -------------------------------------------------------------------------- */
/* 下载配置单一事实源(DOWNLOADS_CONFIG 兼容常量 + getDownloadsConfig getter)  */
/* -------------------------------------------------------------------------- */

/**
 * 由 env 计算完整下载配置。
 * 推荐新代码使用本 getter;`DOWNLOADS_CONFIG` 常量仅保留兼容现有调用方。
 */
export function getDownloadsConfig(): DownloadsConfig {
  return {
    appStoreId: getAppStoreId() ?? '',
    apkPath: getApkPath(),
    apkFileName: getApkFileName(),
    wechatMiniProgramQr: getWechatQr() ?? '',
    hrefs: {
      ios: getAppStoreUrl() ?? '',
      android: getGooglePlayUrl() ?? '',
      wechat: getWechatEntryUrl() ?? '',
      // 4 端走代码内详情页路由,不依赖 env
      desktop: '/download/desktop',
      mobile: '/download/mobile',
      extension: '/download/extension',
      cli: '/download/cli',
    },
  }
}

/**
 * 下载配置单一事实源(向后兼容常量,2026-08-06 起由 env 计算)。
 *
 * 运营接入时仅需在 .env.local / .env.production 配置 NEXT_PUBLIC_DOWNLOAD_* 变量,
 * 本常量自动适配;所有空字符串值在 UI 中显示为"即将上线"占位。
 * NEXT_PUBLIC_ 变量构建期内联,模块初始化读取与构建时 env 一致。
 */
export const DOWNLOADS_CONFIG: DownloadsConfig = getDownloadsConfig()

/* -------------------------------------------------------------------------- */
/* URL 解析函数(优先显式 URL,其次自动生成,最后空串占位)                     */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* 8 端完整下载元数据(PLATFORM_META 兼容常量 + getPlatformMetaMap getter)    */
/* -------------------------------------------------------------------------- */

/**
 * 由 env 计算 8 端完整元数据。
 *
 * ios / android-apk / wechat-miniapp 三端 assets 由对应 env 配置自动生成:
 *  - 配置了 App Store ID / URL → ios.assets 出现 App Store 下载条目
 *  - 配置了 Google Play / APK 直链 → android-apk.assets 出现 APK 下载条目
 *  - 配置了小程序 QR / 入口 → wechat-miniapp.assets 出现扫码落地页条目
 * 未配置的端 assets 保持空数组 → 详情页显示"即将上线"占位。
 */
export function getPlatformMetaMap(): Record<DownloadPlatform, PlatformMeta> {
  const iosHref = resolveIosHref()
  const androidHref = resolveAndroidHref()
  const wechatHref = resolveWechatHref()

  return {
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
      // 2026-08-06 起由 env 驱动:填 NEXT_PUBLIC_DOWNLOAD_APPSTORE_ID 后自动上架
      version: readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_IOS_VERSION) ?? undefined,
      releaseDate: readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_IOS_RELEASE_DATE) ?? undefined,
      systemRequirementsKey: 'downloadIOSSysReq',
      installGuideKey: 'downloadIOSInstallGuide',
      assets: iosHref ? [{ href: iosHref, sizeBytes: 0, format: 'App Store' }] : [],
    },
    'android-apk': {
      platform: 'android-apk',
      // 2026-08-06 起由 env 驱动:填 NEXT_PUBLIC_DOWNLOAD_APK_URL / GOOGLE_PLAY_URL 后自动上架
      version: readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_APK_VERSION) ?? undefined,
      releaseDate: readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_APK_RELEASE_DATE) ?? undefined,
      systemRequirementsKey: 'downloadAndroidSysReq',
      installGuideKey: 'downloadAndroidInstallGuide',
      assets: androidHref ? [{ href: androidHref, sizeBytes: 0, format: 'Android APK' }] : [],
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
      // 2026-08-06 起由 env 驱动:填 NEXT_PUBLIC_DOWNLOAD_WECHAT_QR 后自动上架
      version: readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_WECHAT_VERSION) ?? undefined,
      releaseDate: readEnv(process.env.NEXT_PUBLIC_DOWNLOAD_WECHAT_RELEASE_DATE) ?? undefined,
      systemRequirementsKey: 'downloadWechatSysReq',
      installGuideKey: 'downloadWechatInstallGuide',
      assets: wechatHref ? [{ href: wechatHref, sizeBytes: 0, format: '微信小程序' }] : [],
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
}

/**
 * 8 端完整下载元数据(向后兼容常量,2026-08-06 起由 env 计算)。
 *
 * 用于 /download/[platform] 详情页渲染:
 *  - assets 非空 → 显示下载按钮(支持多格式/架构)
 *  - assets 为空 + version 未填 → 显示"即将上线"占位
 *  - assets 为空 + installGuideKey 已填 → 显示安装/构建说明(CLI/Mobile)
 *
 * ios / android-apk / wechat-miniapp 三端 assets 由 NEXT_PUBLIC_DOWNLOAD_* env 自动生成,
 * 见 `getPlatformMetaMap()` 注释。
 */
export const PLATFORM_META: Record<DownloadPlatform, PlatformMeta> = getPlatformMetaMap()

/** 获取指定端的元数据(PLATFORM_META 类型安全访问) */
export function getPlatformMeta(platform: DownloadPlatform): PlatformMeta {
  return PLATFORM_META[platform]
}

/** 单端配置状态(运营接入自检用,2026-08-06 新增)。 */
export interface DownloadsStatusItem {
  platform: DownloadPlatform
  /** 该端是否已配置可下载资源(assets 非空 = 可下载) */
  configured: boolean
  /** 未配置时提示需填写的 env(配置后即生效,需重新 build) */
  hint: string
}

/**
 * 下载配置自检:返回 8 端配置状态,运营/运维可直接调用确认「哪些端已上架、缺什么」。
 * 判断口径与详情页一致:platform meta assets 非空 = 已配置;desktop/extension/mobile/cli/web
 * 为代码内资源(不依赖 env),恒为 configured=true。
 */
export function getDownloadsStatus(): DownloadsStatusItem[] {
  const meta = getPlatformMetaMap()
  const hints: Record<DownloadPlatform, string> = {
    web: 'web 为 PWA 入口,无需配置',
    desktop: 'desktop 安装包随 CI 构建同步,无需配置',
    mobile: 'mobile 走源码构建(GitHub 链接),无需配置',
    extension: 'extension 安装包随 CI 构建同步,无需配置',
    cli: 'cli 走 npm install,无需配置',
    ios: 'NEXT_PUBLIC_DOWNLOAD_APPSTORE_ID(或 NEXT_PUBLIC_DOWNLOAD_APPSTORE_URL)',
    'android-apk':
      'NEXT_PUBLIC_DOWNLOAD_APK_URL(或 NEXT_PUBLIC_DOWNLOAD_GOOGLE_PLAY_URL / CDN_BASE)',
    'wechat-miniapp': 'NEXT_PUBLIC_DOWNLOAD_WECHAT_QR(或 NEXT_PUBLIC_DOWNLOAD_WECHAT_URL)',
  }
  return (Object.keys(meta) as DownloadPlatform[]).map((platform) => ({
    platform,
    configured: meta[platform].assets.length > 0,
    hint: hints[platform] ?? '',
  }))
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
  return unitIndex === 0
    ? `${Math.round(value)} ${units[unitIndex]}`
    : `${value.toFixed(1)} ${units[unitIndex]}`
}
