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
 *   · 不取 EAS 远端计数器:eas.json appVersionSource=local,EAS 与本函数读同一份号段。
 *
 * 覆盖口 IHUI_VERSION_CODE(CI/手工受控构建):须为正整数且 ∈ [26010100, 2100000000]。
 *   非法值**抛错**而不是静默回落时间戳 —— 静默回落会把"拼错的环境变量"重新变成
 *   vc=1 事故,而那正是本函数存在的理由。
 *
 * 与 EAS 的边界:eas.json appVersionSource=local ⇒ EAS 构建与 prebuild/CI **同读这一份号段**,
 *   不存在"两套号互相降级"的问题(旧注释写的 remote/永不交叠与在册值相反,已按现读更正)。
 *   同一小时内两条腿各出一枚包时号相同 ⇒ `install -r` 覆盖合法,不构成降级。
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

/**
 * OTA 运行时桶(runtimeVersion)—— 必须与"每次构建自动涨的显示版本"解耦(2026-11-02 立)。
 *
 * 病灶是实测出来的,不是预防性的:旧形态是 app.json 里 `runtimeVersion.policy = "appVersion"`,
 * 它读的是 `expo.version`,而 2026-10-17 起 `expo.version` 被下面的 displayVersion 每次构建
 * 注入成 `<base>.<UTC YYYYMMDD>` ⇒ **桶随构建漂移**。取证(2026-11-02 `eas channel:list`):
 * preview 渠道里唯一一条 update 落在 runtime `0.0.8`,而线上登记的安卓最新包是 `0.0.9`
 * ⇒ 那条 OTA 对任何当前装机用户永久不可达。"发了更新但没人收得到"正是本函数的存在理由。
 *
 * 口径:桶 = **原生基座版本**(package.json 的 version),只在真正重打原生包并抬基座时变;
 * 显示版本继续每次涨(用户要能分辨包)。发 OTA 前若原生面已变而基座未抬,由
 * `scripts/release-mobile-rn.mjs` 的 preflight 判 blocked 并点名,不静默发不兼容包。
 * 覆盖口 IHUI_RUNTIME_VERSION 供"同一基座要分桶灰度"这类场景用。
 */
function resolveRuntimeVersion(pkgVersion = pkg.version) {
  const override = process.env.IHUI_RUNTIME_VERSION
  const value = override && override !== '' ? override : pkgVersion
  if (!/^[0-9][0-9A-Za-z._+-]{0,62}$/.test(String(value))) {
    throw new Error(
      `[app.config] runtimeVersion 非法:'${value}'(须以数字开头、长度 ≤63、字符集 [0-9A-Za-z._+-];` +
        '这是 Expo 对 runtimeVersion 的硬约束,构建期报错优于发出去收不到)',
    )
  }
  return String(value)
}

module.exports = ({ config }) => {
  // 统一从 process.env 读取(单一数据源),fallback 到 app.json extra(向后兼容)
  // eslint 兼容 EAS:WX_APP_APPID 已在 eas.json production env 注入(非 EXPO_PUBLIC_ 前缀,
  // 仅构建机可见,不打包进 bundle)
  const appId =
    process.env.EXPO_PUBLIC_WECHAT_APP_ID || process.env.WX_APP_APPID || config.extra?.WX_APP_APPID
  const universalLink =
    process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK || config.extra?.WX_UNIVERSAL_LINK
  // 2026-11-04:android.package 增加 env 覆盖口(与上面两个值同构)。
  // 立因:静态分析器(如 knip 的 expo 插件)会用一个 **dummy config context** 调用本函数
  // (getDummyConfigContext: staticConfigPath=null、config={plugins:[]}),里面结构上不含
  // android.package ⇒ 下面这道 fail-closed 守卫必然抛错、整个配置加载失败。给一个 env 口
  // 让"只做静态分析"的调用方显式供值,判据方向不变:三个值仍缺一即抛错,只是多了一条
  // 显式供值通路(EAS/真实构建继续读 app.json 的 zh.ai.sq,env 不设时行为与旧版逐字一致)。
  const androidPackage = process.env.WX_ANDROID_PACKAGE || config.android?.package

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
    // OTA 桶与显示版本解耦(见 resolveRuntimeVersion 头注)——policy:"appVersion" 会把
    // 每次自动涨的 displayVersion 当成桶,导致 OTA 对已装用户永久不可达。
    runtimeVersion: resolveRuntimeVersion(),
    // OTA 渠道钉死(2026-11-06):本地 gradlew 构建不经过 EAS CLI,不会把 channel 烤进包;
    // expo-updates 只从请求头 expo-channel-name 取渠道 ⇒ 不带就是空渠道,EAS 侧永远判"无更新"
    // (发了 OTA 没人收得到)。这里显式带上,与自动发版发布用的 --channel production 对齐。
    updates: {
      ...(config.updates ?? {}),
      requestHeaders: {
        ...((config.updates && config.updates.requestHeaders) ?? {}),
        'expo-channel-name': process.env.IHUI_OTA_CHANNEL || 'production',
      },
    },
    android: { ...config.android, versionCode: buildNumber },
    ios: { ...config.ios, buildNumber: String(buildNumber) },
    plugins: [
      'expo-secure-store',
      ...(config.plugins || []),
      ['./plugins/withWechat.cjs', { appId, universalLink, androidPackage }],
      // 运营商一键登录骨架(可选;未配置时 UI 隐藏该入口,走免费自动回填降级)
      [
        './plugins/withCarrier.cjs',
        {
          appId: carrierAppId,
          webSdkUrl: carrierWebSdkUrl,
          androidPackage,
          // 2026-11-01 安全强化:明文例外改成按域名开(旧形态是整 App usesCleartextTraffic=true)。
          // 闪验网关域名住在未入库的 .aar 里,静态拿不到 ⇒ 不猜清单,由部署方供值;
          // 没供值时基础档关死,一键登录失败会按既有设计降级到短信验证码,而不是退回整 App 明文。
          cleartextHosts: process.env.EXPO_PUBLIC_CARRIER_CLEARTEXT_HOSTS || '',
        },
      ],
      './plugins/withExpoImportFix.cjs',
      // Android 开屏图 + 样式:未装 expo-splash-screen 时 prebuild 的 legacy 分支
      // 不会写 drawable 资源,原生目录里留的是模板灰白占位图(详见插件头注释)
      './plugins/withSplash.cjs',
      // 原生输入框 chrome:把 RN 模板那份恒画 9-patch 描边的 EditText 背景换成透明件,并钉死
      // AppTheme 的中性强调色(不钉 ⇒ colorControlActivated 回落系统强调色,HyperOS 实测橙)。
      // 必须走 plugin —— android/ 整目录在 .gitignore 内,直改 xml 不进仓、下次 prebuild 即被洗掉
      './plugins/withNativeInputChrome.cjs',
      // media3 钉版:react-native-video 6.19.2 期望 1.8.0,依赖图会解到 1.9.0 ⇒ 进播放器
      // NoSuchMethodError 闪退(2026-10-20 真机实测;当时全仓无入口到播放器,崩溃从未暴露)
      './plugins/withMedia3Pin.cjs',
      // 签名统一:debug 变体也用正式 keystore(IHUI_RELEASE_* 存在时),让一个应用身份只有一把 key ——
      // 否则 dev client 与 release 各持一把 key,互装不上,每次换包必须先卸载(2026-10-30 实测)
      './plugins/withAndroidSigning.cjs',
      // 危险权限摘除:SYSTEM_ALERT_WINDOW 在 manifest 里而全仓零引用(2026-11-03 实测),
      // 国内商店与工信部通报都按"声明即需说明"处理 ⇒ 摘掉,并以 tools:node=remove 防依赖库再带回
      './plugins/withPermissionPruning.cjs',
      // 应用内整包更新:补 android.permission.REQUEST_INSTALL_PACKAGES(Android 8+ 请求安装
      // 的调用方必须持有,缺了症状是"点了更新什么也不发生")。FileProvider 由 expo-file-system
      // 自带,原生意图由 expo-intent-launcher 提供,只有这条权限需要我们自己声明。
      // 刻意排在 withPermissionPruning 之后:那条只管摘除,本条的"增"要落在最后一步,
      // 万一将来有人误把 REQUEST_INSTALL_PACKAGES 加进摘除集,插件会显式告警而不是静默失效。
      [
        './plugins/withApkInstaller.cjs',
        {
          // 商店材料对账直接读这一键(scripts/prepare-store-bundle.mjs 的 PERMISSION_EVIDENCE_KEYS);
          // 用途事实与插件头注/预构建回执同源,不在这里另写一份不同的说法
          installPackagesPermission: '应用内更新:下载新版本 APK 后拉起系统安装器',
        },
      ],
      // 免点击安装(2026-11-05 立):系统安装器的确认键没有 API 可绕过(除 Device Owner/root/ADB),
      // 唯一合法自动化手段是 AccessibilityService —— 由用户一次性在系统设置启用,之后代点确认。
      // 服务只认安装器包名 + 界面出现本应用名,装别的 App 一律不碰(见插件头注的安全边界)。
      './plugins/withAutoInstaller.cjs',
      // RN 端中文字体:本轮定性为**平台差异,不自托管**(2026-11-10 实测收口)。
      //
      // 这里原先挂 expo-font config plugin 注册自托管族(先阿里妈妈方圆体,后试 HarmonyOS
      // Sans SC 400/500/700 三面),本轮整体撤掉,三条实测原因:
      // ① RN 端**没有全局注入点**:React 19 automatic runtime 不读 defaultProps;
      //    react-native 的 Text 是 getter 且 packages/app 有 317 处直接静态导入;
      //    react-native-css-interop 丢弃 `* { font-family }` 非变量声明;
      //    NativeWind 的 remapProps/className 也覆盖不到未标注 className 的 Text
      //    ⇒ 注册了族名也没有任何 Text 消费(全仓 fontFamily 仅 23 处,均 monospace/Menlo)。
      // ② RN 的 fontFamily 只认**单族名、无回退栈**;可用 TTF 却是 GB2312 子集
      //    (fontTools 实测 Regular 7846 码位/7154 汉字、Medium·Bold 4966/4274、Light
      //    3324/2632),「昇啰厏」等 GBK 扩展字全缺,缺字率约 26% ⇒ 一旦全局启用,
      //    缺字直接落系统默认字体当场换脸,比不启用更糟。web 端能治靠的是
      //    unicode-range 分段面 + 中文兜底栈,RN 两者皆无。
      // ③ 三面码位数互不相同,且 Medium/Light 的 name(1) 是独立族名
      //    ('HarmonyOS Sans SC Medium' / '... Light') ⇒ Android <font-family> 与 iOS
      //    fontNamesForFamilyName 取不到对应字重,粗细混排同字会换脸。
      //
      // 结论:与小程序端同口径走**系统中文黑体栈**,见 global.css 的品牌栈口径留痕与
      // scripts/data/cross-end-allowed-diffs.json(platform:font-stack-cjk / rn)。
      // 若将来确要自托管,前置条件是完整字库(≥8MB/面、三面同族同码位)+ 逐处显式
      // fontFamily 或编译期 Babel 注入 + 真机回归,不是本轮能顺带完成的事。
      // 撤掉运行时字体门同时根治了热更首启「7.4MB 字体远端取用失败 ⇒ 整棵树
      // return null ⇒ 灰屏卡死」(见 App.tsx 启动注释)。
    ],
  }
}

// 号段边界随模块导出:守门 scripts/check-mobile-version-code.mjs 与上面的覆盖口检查
// **同读这两个值**,不写第二份(两处算同一件事必漂移,AGENTS §22c)。 Expo/EAS 只调用
// 上面的函数,附加属性对它们不可见;本仓守门经 createRequire 以 CJS 载入本模块后读取。
module.exports.VERSION_CODE_FLOOR = 26010100 // 2026-01-01 00 时 —— 低于此值即"退回 vc=1 时代"
module.exports.VERSION_CODE_CEILING = 2100000000 // Android/Play 的 versionCode 天花板
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
