// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Expo 动态配置(mobile-rn 端)。
 * 读取 app.json 的 extra 字段,注入 react-native-wechat-lib config plugin。
 *
 * 运行时(EAS Build / expo prebuild)会执行本文件,生成原生代码:
 *   - iOS Info.plist + AppDelegate 钩子
 *   - Android AndroidManifest + WXEntryActivity / WXPayEntryActivity
 */
const pkg = require('./package.json')

/**
 * 版本号单调递增的单一数据源(2026-10-12 立,立因是装机实测而非预防):
 *
 *   app.json 从未声明 android.versionCode(git 全史 -S 检索零命中)⇒ Expo prebuild
 *   默认 versionCode 恒为 1;iOS 同病(无 ios.buildNumber)⇒ CFBundleVersion 恒为 1。
 *   2026-10-12 实测后果:CI nightly 包(vc=1)覆盖手机上 vc=4 的构建时,Android 16
 *   降级保护连拒 `install -r`、`-r -d`、`uninstall -k` 后的重装(DELETE_KEEP_DATA
 *   残留记录仍记旧 vc),只有全删重装一条路 —— 本地登录态全丢。号段一旦分配出去
 *   就只会单调向上走,这是 Android 更新的硬约束,没有"重新从 1 开始"的选项。
 *
 * 号段策略:UTC 时钟 YYMMDDHH(8 位,2099-12-31 23 时 = 99123123,低于 2.1B 上限)。
 *   · 小时粒度:同一小时多次构建同号;同号更新(install -r)合法,不构成降级;
 *   · 不取 git commit count:本仓主干会被并行会话整谱系重写,计数会缩,缩一次
 *     就等于给全量已装机用户发一个"永远装不上"的版本;
 *   · 不取 EAS 远端计数器:eas.json appVersionSource=remote,EAS 自管(见下)。
 *
 * 覆盖口 IHUI_VERSION_CODE(CI/手工受控构建):须为正整数且 ∈ [26010100, 2100000000]。
 *   非法值**抛错**而不是静默回落时间戳 —— 静默回落会把"拼错的环境变量"重新变成
 *   vc=1 事故,而那正是本函数存在的理由。
 *
 * 与 EAS 的边界:eas.json appVersionSource=remote ⇒ EAS 构建走 Expo 远端计数器,
 *   与本函数的 YYMMDDHH 号段永不交叠 ⇒ prebuild/CI 包可覆盖 EAS 包;反向(EAS 包
 *   覆盖 CI 包)被降级保护拒属预期,内部署手机以 CI nightly 为准。
 */
function resolveBuildNumber() {
  const override = process.env.IHUI_VERSION_CODE
  if (override !== undefined && override !== '') {
    if (!/^\d+$/.test(override)) {
      throw new Error(`[app.config] IHUI_VERSION_CODE 非法:'${override}'(须为十进制正整数)`)
    }
    const n = Number(override)
    if (n < 26010100 || n > 2100000000) {
      throw new Error(
        `[app.config] IHUI_VERSION_CODE 越界:'${override}'(须 ∈ [26010100, 2100000000];` +
          '下限防退回 vc=1 时代,上限是 Android/Play 的 versionCode 天花板)',
      )
    }
    return n
  }
  const now = new Date()
  const yy = String(now.getUTCFullYear() % 100).padStart(2, '0')
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const hh = String(now.getUTCHours()).padStart(2, '0')
  return Number(`${yy}${mm}${dd}${hh}`)
}

module.exports = ({ config }) => {
  // 统一从 process.env 读取(单一数据源),fallback 到 app.json extra(向后兼容)
  // eslint 兼容 EAS:WX_APP_APPID 已在 eas.json production env 注入(非 EXPO_PUBLIC_ 前缀,
  // 仅构建机可见,不打包进 bundle)
  const appId =
    process.env.EXPO_PUBLIC_WECHAT_APP_ID || process.env.WX_APP_APPID || config.extra?.WX_APP_APPID
  const universalLink =
    process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK || config.extra?.WX_UNIVERSAL_LINK
  const androidPackage = config.android?.package

  if (!appId || !universalLink || !androidPackage) {
    throw new Error(
      '[app.config] 缺少微信支付配置:app.json 需包含 extra.WX_APP_APPID / extra.WX_UNIVERSAL_LINK / android.package',
    )
  }

  // 运营商一键登录(可选增强,未配置不阻断):闪验 appId + WebView/H5 SDK 地址(单一数据源:env)
  const carrierAppId = process.env.EXPO_PUBLIC_CARRIER_APP_ID || config.extra?.CARRIER_APP_ID
  const carrierWebSdkUrl =
    process.env.EXPO_PUBLIC_CARRIER_WEB_SDK_URL || config.extra?.CARRIER_WEB_SDK_URL

  // 版本号:android.versionCode 与 ios.buildNumber 同源(见 resolveBuildNumber 头注)。
  // prebuild 时分别写入 build.gradle 与 Info.plist;EAS(remote 源)不读这两个值。
  const buildNumber = resolveBuildNumber()
  // 显示版本号(2026-10-17 起):CI 每次构建由 scripts/resolve-mobile-version.mjs 派生
  // (形态 `<base>.<UTC YYYYMMDD>`)并通过 IHUI_MOBILE_VERSION 注入 ⇒ **每次发 APK 自动涨**,
  // 无需有人记得改 package.json。本地/未注入时回退 package.json,行为与历史一致。
  // 同名的值还会以 EXPO_PUBLIC_IHUI_MOBILE_VERSION 走进 JS bundle(src/lib/config.ts),
  // 两端读的是**同一串**,不可能出现"原生号 ≠ 界面号"。
  const displayVersion = process.env.IHUI_MOBILE_VERSION || pkg.version

  return {
    ...config,
    version: displayVersion,
    android: { ...config.android, versionCode: buildNumber },
    ios: { ...config.ios, buildNumber: String(buildNumber) },
    plugins: [
      'expo-secure-store',
      ...(config.plugins || []),
      ['./plugins/withWechat.cjs', { appId, universalLink, androidPackage }],
      // 运营商一键登录骨架(可选;未配置时 UI 隐藏该入口,走免费自动回填降级)
      [
        './plugins/withCarrier.cjs',
        { appId: carrierAppId, webSdkUrl: carrierWebSdkUrl, androidPackage },
      ],
      './plugins/withExpoImportFix.cjs',
      // Android 开屏图 + 样式:未装 expo-splash-screen 时 prebuild 的 legacy 分支
      // 不会写 drawable 资源,原生目录里留的是模板灰白占位图(详见插件头注释)
      './plugins/withSplash.cjs',
      // 全局统一字体:对齐历史 Uniapp 项目 AlimamaFangYuanTi(2026-08-13 立,H19)
      // 字体文件:assets/fonts/AlimamaFangYuanTiVF-Thin.ttf
      // build-time linking,font-family 名称取字体内部 PostScript name
      [
        'expo-font',
        {
          fonts: ['./assets/fonts/AlimamaFangYuanTiVF-Thin.ttf'],
        },
      ],
    ],
  }
}

// 号段边界随模块导出:守门 scripts/check-mobile-version-code.mjs 与上面的覆盖口检查
// **同读这两个值**,不写第二份(两处算同一件事必漂移,AGENTS §22c)。 Expo/EAS 只调用
// 上面的函数,附加属性对它们不可见;本仓守门经 createRequire 以 CJS 载入本模块后读取。
module.exports.VERSION_CODE_FLOOR = 26010100 // 2026-01-01 00 时 —— 低于此值即"退回 vc=1 时代"
module.exports.VERSION_CODE_CEILING = 2100000000 // Android/Play 的 versionCode 天花板
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
