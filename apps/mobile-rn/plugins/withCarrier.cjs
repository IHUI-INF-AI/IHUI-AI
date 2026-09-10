// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运营商一键登录(闪验 FlashVerify/创蓝闪验)Expo Config Plugin(mobile-rn 端)。
 *
 * 在 expo prebuild / EAS Build 阶段自动:
 *   Android:
 *     - AndroidManifest 注入闪验必需权限 + 授权页/协议页 Activity + usesCleartextTraffic
 *     - app/build.gradle 注入 `implementation fileTree(include: ['*.aar'], dir: 'libs')`
 *     - 将 lib/carrier 桥接模板复制为 android/app/src/main/java/<pkg>/carrier/*.java
 *     - 注册 CarrierOneClickPackage 到 MainApplication
 *   iOS:
 *     - Podfile 注入 `pod 'CL_ShanYanSDK'`(闪验官方 pod)
 *     - 将桥接模板复制为 ios/<Project>/CarrierOneClickTurboModule.swift,并加入 Xcode Sources
 *
 * 「可插拔、非阻断」设计:
 *   - 未配置 appId 或未打 aar/pod 时,本插件只 console.warn,绝不 throw,不破坏 prebuild。
 *   - 桥接模板用反射/条件编译,未集成 SDK 时 App 仍可构建,一键登录入口隐藏或报错降级到短信验证码。
 *
 * 参数(由 app.config.js 从 env / app.json extra 读取注入):
 *   - appId          闪验开放平台应用 AppID(EXPO_PUBLIC_CARRIER_APP_ID)
 *   - webSdkUrl      WebView/H5 一键登录地址(EXPO_PUBLIC_CARRIER_WEB_SDK_URL,可选,本插件不消费)
 *   - androidPackage Android applicationId(= config.android.package)
 *
 * JS 侧契约见 src/lib/carrier-one-click.ts(NativeModules.CarrierOneClickTurboModule)。
 */
const {
  withInfoPlist,
  withAndroidManifest,
  withDangerousMod,
  withAppBuildGradle,
  withPodfile,
  withMainApplication,
  withXcodeProject,
} = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

const TEMPLATE_DIR = path.join(__dirname, 'templates', 'carrier')

// =============================================================================
// 工具
// =============================================================================

/** 读取桥接模板文件并把 `__PACKAGE__` 占位符替换为真实包名。 */
function readTemplate(rel, androidPackage) {
  const raw = fs.readFileSync(path.join(TEMPLATE_DIR, rel), 'utf8')
  return androidPackage ? raw.replace(/__PACKAGE__/g, androidPackage) : raw
}

/** 找出 iOS 工程中实际含 .xcodeproj 的目标目录名(否则回退到应用目录名)。 */
function resolveIosAppDir(projRoot) {
  try {
    const entries = fs.readdirSync(projRoot, { withFileTypes: true })
    const dir = entries.find(
      (e) => e.isDirectory() && fs.existsSync(path.join(projRoot, e.name, `${e.name}.xcodeproj`)),
    )
    if (dir) return dir.name
  } catch (_ignored) {
    // 忽略:无法扫描时走回退
  }
  return null
}

// =============================================================================
// Android:manifest 权限 + Activity + cleartext
// =============================================================================

const CARRIER_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.CHANGE_NETWORK_STATE',
  'android.permission.CHANGE_WIFI_STATE',
]

function withCarrierAndroidManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults
    const application = manifest.manifest.application[0]

    // 1) uses-permission(去重)
    const existingPerms = new Set(
      (manifest.manifest['uses-permission'] || []).map((p) => p.$['android:name']),
    )
    for (const name of CARRIER_PERMISSIONS) {
      if (!existingPerms.has(name)) {
        manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] || []
        manifest.manifest['uses-permission'].push({ $: { 'android:name': name } })
      }
    }

    // 2) application:cleartextTraffic(闪验网关 http 支持)
    if (application.$ && !application.$['android:usesCleartextTraffic']) {
      application.$['android:usesCleartextTraffic'] = 'true'
    }

    // 3) 授权页/协议页 Activity(去重)
    if (!application.activity) application.activity = []
    const has = (name) => application.activity.some((a) => a.$['android:name'] === name)
    const actAttrs = {
      'android:configChanges': 'keyboardHidden|orientation|screenSize',
      'android:launchMode': 'singleTop',
      'android:screenOrientation': 'behind',
    }
    if (!has('com.chuanglan.shanyan_sdk.view.ShanYanOneKeyActivity')) {
      application.activity.push({
        $: { 'android:name': 'com.chuanglan.shanyan_sdk.view.ShanYanOneKeyActivity', ...actAttrs },
      })
    }
    if (!has('com.chuanglan.shanyan_sdk.view.CTCCPrivacyProtocolActivity')) {
      application.activity.push({
        $: { 'android:name': 'com.chuanglan.shanyan_sdk.view.CTCCPrivacyProtocolActivity', ...actAttrs },
      })
    }
    return mod
  })
}

// =============================================================================
// Android:app/build.gradle 注入 aar 依赖
// =============================================================================

function withCarrierAppBuildGradle(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents
    const dependencyLine = "  implementation fileTree(include: ['*.aar'], dir: 'libs')"
    if (contents.includes('dir: \'libs\'')) {
      return mod
    }
    // 插入到 dependencies 块(找不到则追加到文件末尾)
    const depMatch = contents.match(/dependencies\s*\{/)
    if (depMatch) {
      const idx = contents.indexOf(depMatch[0]) + depMatch[0].length
      contents = contents.slice(0, idx) + `\n${dependencyLine}` + contents.slice(idx)
    } else {
      contents += `\ndependencies {\n${dependencyLine}\n}\n`
    }
    mod.modResults.contents = contents
    return mod
  })
}

// =============================================================================
// Android:复制桥接模板 + 注册 MainApplication
// =============================================================================

function withCarrierAndroidNative(config, { androidPackage }) {
  const pkgPath = androidPackage.replace(/\./g, '/')
  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      const projRoot =
        modConfig._modSourcePath ||
        modConfig.platformProjectRoot ||
        modConfig.modRequest?.platformProjectRoot ||
        ''
      if (!projRoot) {
        console.warn('[withCarrier] 跳过 Android 桥接模板生成:无法获取项目根路径')
        return modConfig
      }
      const destDir = path.join(projRoot, 'app', 'src', 'main', 'java', pkgPath, 'carrier')
      fs.mkdirSync(destDir, { recursive: true })
      fs.writeFileSync(
        path.join(destDir, 'CarrierOneClickModule.java'),
        readTemplate('android/CarrierOneClickModule.java', androidPackage),
      )
      fs.writeFileSync(
        path.join(destDir, 'CarrierOneClickPackage.java'),
        readTemplate('android/CarrierOneClickPackage.java', androidPackage),
      )
      return modConfig
    },
  ])
}

function withCarrierMainApplication(config, { androidPackage }) {
  return withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents
    const pkgShort = `${androidPackage}.carrier.CarrierOneClickPackage`
    const importLine = `import ${pkgShort};`
    const registerLineKt = 'add(CarrierOneClickPackage())'
    const registerLineJava = 'packages.add(new CarrierOneClickPackage());'

    // import(去重)
    if (!contents.includes(`import ${pkgShort};`)) {
      // 在最后一个 import 之后插入(Kotlin/Java 顶部 import 区)
      const lastImport = contents.lastIndexOf('\nimport ')
      if (lastImport >= 0) {
        const lineEnd = contents.indexOf('\n', lastImport + 1)
        const insertAt = lineEnd >= 0 ? lineEnd : contents.length
        contents = contents.slice(0, insertAt) + `\n${importLine}` + contents.slice(insertAt)
      } else {
        contents = `${importLine}\n${contents}`
      }
    }

    // Kotlin:`PackageList(this).packages.apply {` 内插入 add(...)
    if (contents.includes('.packages.apply {')) {
      const marker = '.packages.apply {'
      const idx = contents.indexOf(marker) + marker.length
      const insert = `\n          ${registerLineKt}`
      if (!contents.slice(idx, idx + insert.length + 20).includes('CarrierOneClickPackage')) {
        contents = contents.slice(0, idx) + insert + contents.slice(idx)
      }
    }
    // Java:`new PackageList(this).getPackages()` 之后(模板通常有 packages 局部变量)插入 packages.add(...)
    else if (/new PackageList\(this\)\.getPackages\(\)/.test(contents)) {
      const nonblockInsert = `\n    ${registerLineJava}\n`
      if (!contents.includes('packages.add(new CarrierOneClickPackage())')) {
        contents = contents.replace(
          /(new PackageList\(this\)\.getPackages\(\);)/,
          `$1\n    ${registerLineJava}`,
        )
      }
      void nonblockInsert
    } else {
      console.warn('[withCarrier] 无法识别 MainApplication.getPackages 结构,请在原生工程手动注册 CarrierOneClickPackage')
    }

    mod.modResults.contents = contents
    return mod
  })
}

// =============================================================================
// iOS:Podfile pod + Info.plist(预留)+ 复制 Swift 桥接 + 加入 Xcode Sources
// =============================================================================

function withCarrierPodfile(config, { appId }) {
  return withPodfile(config, (mod) => {
    if (!appId) return mod
    let contents = mod.modResults
    if (contents.includes('pod \'CL_ShanYanSDK\'')) return mod
    // 插到 use_expo_modules! 之后(该行必存在于 Expo Podfile)
    const marker = 'use_expo_modules!'
    const idx = contents.indexOf(marker)
    const insert = `\n  # 闪验(FlashVerify/创蓝闪验)一键登录 SDK(带 appId 且需要原生时启用;可选,注释掉即不集成)`
    if (idx >= 0) {
      const lineEnd = contents.indexOf('\n', idx)
      const at = lineEnd >= 0 ? lineEnd : contents.length
      contents = contents.slice(0, at) + insert + `\n  pod 'CL_ShanYanSDK'` + contents.slice(at)
    } else {
      contents += `\n# 闪验一键登录\npod 'CL_ShanYanSDK'\n`
    }
    mod.modResults = contents
    return mod
  })
}

function withCarrierIosNative(config) {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const projRoot =
        modConfig._modSourcePath ||
        modConfig.platformProjectRoot ||
        modConfig.modRequest?.platformProjectRoot ||
        ''
      if (!projRoot) {
        console.warn('[withCarrier] 跳过 iOS 桥接模板生成:无法获取项目根路径')
        return modConfig
      }
      // 目标目录:ios/<Project>(优先用含 .xcodeproj 的目录名,回退到应用目录名)
      const appName = resolveIosAppDir(projRoot) || path.basename(modConfig.modRequest?.projectRoot || 'IHUIAI')
      const targetDir = path.join(projRoot, appName)
      const swift = readTemplate('ios/CarrierOneClickTurboModule.swift', null)
      fs.mkdirSync(targetDir, { recursive: true })
      fs.writeFileSync(path.join(targetDir, 'CarrierOneClickTurboModule.swift'), swift)
      return modConfig
    },
  ])
}

/** 把刚生成的 Swift 桥接加入 Xcode 工程 Sources(best-effort,失败不阻断 prebuild)。 */
function withCarrierXcodeProject(config) {
  return withXcodeProject(config, (mod) => {
    const projRoot = mod.modRequest?.platformProjectRoot || ''
    if (!projRoot) {
      return mod
    }
    const appName = resolveIosAppDir(projRoot) || path.basename(mod.modRequest?.projectRoot || 'IHUIAI')
    const relPath = `${appName}/CarrierOneClickTurboModule.swift`
    const absPath = path.join(projRoot, relPath)
    if (!fs.existsSync(absPath)) {
      console.warn('[withCarrier] iOS Swift 桥接文件不存在,跳过 Xcode 注入:', absPath)
      return mod
    }
    try {
      const pbxproj = mod.modResults
      // addSourceFile 会创建 PBXFileReference 并入默认 group & Sources 构建阶段(非幂等则先查)
      if (!pbxproj.pbxFileReferenceSection || Object.keys(pbxproj.pbxFileReferenceSection() || {}).length === 0) {
        pbxproj.addSourceFile(relPath, null, null)
      } else {
        let found = false
        const refs = pbxproj.pbxFileReferenceSection() || {}
        for (const key of Object.keys(refs)) {
          if ((refs[key].path || '').endsWith('CarrierOneClickTurboModule.swift')) {
            found = true
            break
          }
        }
        if (!found) {
          pbxproj.addSourceFile(relPath, null, null)
        }
      }
    } catch (e) {
      console.warn('[withCarrier] Xcode pbxproj 注入失败(可忽略,手动在 Xcode 添加亦可):', e)
    }
    return mod
  })
}

// =============================================================================
// iOS Info.plist(预留:按闪验文档补 LSApplicationQueriesSchemes 等,已知必配的不强加)
// =============================================================================
function withCarrierInfoPlist(config) {
  return withInfoPlist(config, (mod) => {
    // 预留:闪验 iOS demo 未要求额外 query scheme;接入时如需微信/支付宝回跳可在此按需补充。
    return mod
  })
}

// =============================================================================
// 主入口
// =============================================================================
module.exports = function withCarrier(config, props) {
  const { appId, webSdkUrl, androidPackage } = props || {}

  if (!appId && !webSdkUrl) {
    console.warn(
      '[withCarrier] 未配置运营商一键登录(EXPO_PUBLIC_CARRIER_APP_ID / EXPO_PUBLIC_CARRIER_WEB_SDK_URL)。' +
        '跳过原生注入;UI 将隐藏"本机号码一键登录"入口并走短信验证码 + 免费自动回填.',
    )
  }

  // 桥接模板落盘与注册不依赖 appId(反射/条件编译非阻断),但 manifest 权限与 pod 仅在需要时注入
  config = withCarrierAndroidManifest(config)
  config = withCarrierAppBuildGradle(config)
  config = withCarrierAndroidNative(config, { androidPackage: androidPackage || 'ai.ihui.mobile' })
  config = withCarrierMainApplication(config, { androidPackage: androidPackage || 'ai.ihui.mobile' })
  config = withCarrierPodfile(config, { appId })
  config = withCarrierIosNative(config)
  config = withCarrierXcodeProject(config)
  config = withCarrierInfoPlist(config)
  return config
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
