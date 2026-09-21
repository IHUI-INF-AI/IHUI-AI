// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Expo Config Plugin:把官方开屏图写进 Android 原生资源,并修正 splash 样式。
 *
 * 为什么必须自己写(均为实测结论,非推测):
 *   mobile-rn 未安装 expo-splash-screen,prebuild 走 @expo/prebuild-config 的 legacy 分支
 *   (createLegacyPlugin 的 fallback)。该分支**不会生成**
 *   res/drawable-* /splashscreen_logo.png —— 原生目录里留的是 Android 模板自带的灰白占位图。
 *   证据:把 assets/splash-icon.png 临时换成品红圆后重跑 prebuild,产物像素纹丝不动。
 *   同时模板 styles.xml 里
 *     <item name="android:windowBackground">@drawable/splashscreen_logo</item>
 *   直接指向那张 png,BitmapDrawable 默认 FILL 会把它拉伸填满整屏,图形会变形。
 *
 * 本插件做四件事:
 *   1. 把 assets/splash/drawable-{density}/splashscreen_logo.png 复制进原生 res;
 *   2. 写 res/drawable/ic_launcher_background.xml(layer-list:背景色 + gravity=center 的
 *      bitmap,居中显示不缩放;沿用 Expo 既有文件名,样式只需指向它);
 *   3. 把 Theme.App.SplashScreen 的 windowBackground 指向该 layer-list,
 *      并把 splashscreen_background 定为品牌黑 —— 这条只对 API ≤ 30 生效;
 *   4. 写 res/values-v31/styles.xml 补齐 Android 12+(API 31+)的**系统 SplashScreen**:
 *      targetSdk ≥ 31 时平台强制接管启动窗口,只认 windowSplashScreenBackground /
 *      windowSplashScreenAnimatedIcon,**完全忽略** legacy 的 android:windowBackground。
 *      不写这段,现代机型冷启动看到的是系统默认底色 + 圆形裁切的 Launcher 图标,
 *      而不是品牌开屏图(实测:prebuild 产物里只有 values/,没有 values-v31/)。
 *      注意:系统会把该图标裁进**直径 192dp 的圆**,源图已按此收紧 —— logo 最大半径
 *      91.8dp,见 scripts/regen-app-icons.py 的 SAFE_RADIUS_DP 反推逻辑。
 *      另:本目录 values-night/ 只有 colors.xml、无 styles.xml,而 night 限定符优先级
 *      **高于** version 限定符,故无需再写 values-night-v31(若将来加了
 *      values-night/styles.xml,必须同步补一份,否则深色模式会退回无品牌开屏)。
 *
 * 源图由 scripts/regen-app-icons.py 生成,换 logo 后重跑脚本 + 重新出包即可。
 */
const fs = require('fs')
const path = require('path')

const {
  withDangerousMod,
  withAndroidStyles,
  withAndroidColors,
  AndroidConfig,
} = require('expo/config-plugins')

const SPLASH_SOURCE_DIR = path.join('assets', 'splash')
const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']
const STYLE_NAME = 'Theme.App.SplashScreen'
const SPLASH_COLOR = '#000000'

const LAYER_LIST = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splashscreen_background" />
    <item>
        <bitmap android:gravity="center" android:src="@drawable/splashscreen_logo" />
    </item>
</layer-list>
`

// API 31+ 的系统 SplashScreen 主题:windowBackground 保留(启动窗口撤下后 Activity
// 先铺这张图,与开屏无缝衔接),另两条才是系统真正读取的品牌色与开屏图标。
const V31_STYLES = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="Theme.App.SplashScreen" parent="AppTheme">
    <item name="android:windowBackground">@drawable/ic_launcher_background</item>
    <item name="android:windowSplashScreenBackground">@color/splashscreen_background</item>
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
  </style>
</resources>
`

const withSplashDrawables = (config) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const resDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res')
      const srcDir = path.join(cfg.modRequest.projectRoot, SPLASH_SOURCE_DIR)
      if (!fs.existsSync(srcDir)) {
        throw new Error(
          `[withSplash] 缺少 ${SPLASH_SOURCE_DIR}/,请先执行 scripts/regen-app-icons.py`,
        )
      }

      for (const density of DENSITIES) {
        const from = path.join(srcDir, `drawable-${density}`, 'splashscreen_logo.png')
        const toDir = path.join(resDir, `drawable-${density}`)
        await fs.promises.mkdir(toDir, { recursive: true })
        await fs.promises.copyFile(from, path.join(toDir, 'splashscreen_logo.png'))
      }

      const drawableDir = path.join(resDir, 'drawable')
      await fs.promises.mkdir(drawableDir, { recursive: true })
      await fs.promises.writeFile(
        path.join(drawableDir, 'ic_launcher_background.xml'),
        LAYER_LIST,
        'utf8',
      )

      const v31Dir = path.join(resDir, 'values-v31')
      await fs.promises.mkdir(v31Dir, { recursive: true })
      await fs.promises.writeFile(path.join(v31Dir, 'styles.xml'), V31_STYLES, 'utf8')
      return cfg
    },
  ])

const withSplashWindowBackground = (config) =>
  withAndroidStyles(config, (cfg) => {
    // 模板里已有 Theme.App.SplashScreen,先摘掉旧 windowBackground 再写,避免重复项
    const styles = cfg.modResults.resources.style || []
    const target = styles.find((style) => style.$?.name === STYLE_NAME)
    if (target) {
      target.item = (target.item || []).filter(
        (item) => item.$?.name !== 'android:windowBackground',
      )
    }
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      parent: { name: STYLE_NAME, parent: 'AppTheme' },
      name: 'android:windowBackground',
      value: '@drawable/ic_launcher_background',
    })
    return cfg
  })

const withSplashBackgroundColor = (config) =>
  withAndroidColors(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: 'splashscreen_background',
      value: SPLASH_COLOR,
    })
    return cfg
  })

module.exports = (config) =>
  withSplashBackgroundColor(withSplashWindowBackground(withSplashDrawables(config)))
