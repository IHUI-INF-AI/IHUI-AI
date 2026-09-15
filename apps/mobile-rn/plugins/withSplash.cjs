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
 * 本插件做三件事:
 *   1. 把 assets/splash/drawable-{density}/splashscreen_logo.png 复制进原生 res;
 *   2. 写 res/drawable/ic_launcher_background.xml(layer-list:背景色 + gravity=center 的
 *      bitmap,居中显示不缩放;沿用 Expo 既有文件名,样式只需指向它);
 *   3. 把 Theme.App.SplashScreen 的 windowBackground 指向该 layer-list,
 *      并把 splashscreen_background 定为品牌黑。
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
