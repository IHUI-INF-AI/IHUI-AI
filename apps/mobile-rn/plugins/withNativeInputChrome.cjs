// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Expo config plugin —— 原生输入框"外观 chrome"收口(2026-10-20 立)。
//
// 为什么必须有这个 plugin(实测成因,不是预防性设计):
// `apps/mobile-rn/android/` 被 `apps/mobile-rn/.gitignore:2` 整目录排除(注释自述
// "Expo prebuild 生成的原生目录(EAS Build 时重新生成)")。所以**直接改 android/ 下的 xml
// 不是修复** —— 它不进版本控制,下一次 `expo prebuild` 或换机重建就把改动洗成 RN 模板原件。
// 唯一能落地的出路是把形态写进 prebuild 的生成源,也就是本文件。
//
// 收的是哪三件事:
//  ① `drawable/rn_edit_text_material.xml`:RN 模板那份抄自 AOSP 的 selector 第二条是
//     **无 state 限定的兜底 item**,恒画 `abc_textfield_activated_mtrl_alpha` 那圈 9-patch 描边。
//     于是每个 RN TextInput 自带一圈原生描边,与 JS 层容器描边叠成"框中框"。这里生成恒透明件。
//  ② `AppTheme` 的强调色:模板只写了 colorPrimary,`colorControlActivated` 未钉 ⇒ 回落系统强调色
//     (HyperOS 实测 #E59700 橙)。钉成中性墨档,光标/选中句柄/ripple/文字选中底纹四条腿一起管住。
//  ③ 明暗两档的墨值:暗档必须反转成白(与 JS 层 `brand.DEFAULT` 逐字同值,见
//     packages/app/src/hooks/use-wrap-focus.ts),不能靠系统默认。
//
// 改这里必须同步守门 `scripts/check-no-warm-border.mjs` 的 W2/W3 —— 它判的就是本文件。
const fs = require('fs')
const path = require('path')
const {
  withDangerousMod,
  withAndroidStyles,
  withAndroidColors,
  withAndroidColorsNight,
  AndroidConfig,
} = require('expo/config-plugins')

const APP_THEME = 'AppTheme'
const APP_THEME_PARENT = 'Theme.AppCompat.DayNight.NoActionBar'
const EDIT_TEXT_DRAWABLE = 'rn_edit_text_material'

/** 恒透明的输入框背景件(保留 inset 外壳:RN 模板建它本就是为了躲 EditText 背景 NPE)。 */
const EDIT_TEXT_MATERIAL = `<?xml version="1.0" encoding="utf-8"?>
<!-- 由 apps/mobile-rn/plugins/withNativeInputChrome.cjs 生成,请勿手改本文件
     (android/ 整目录是 prebuild 产物且在 .gitignore 内,改了不进仓、下次 prebuild 即被洗掉)。
     这里必须是恒透明:聚焦描边的唯一合法实现住在 JS 层
     packages/app/src/hooks/use-wrap-focus.ts(墨档),原生再画一圈就是"框中框"。 -->
<inset xmlns:android="http://schemas.android.com/apk/res/android"
       android:insetLeft="@dimen/abc_edit_text_inset_horizontal_material"
       android:insetRight="@dimen/abc_edit_text_inset_horizontal_material"
       android:insetTop="@dimen/abc_edit_text_inset_top_material"
       android:insetBottom="@dimen/abc_edit_text_inset_bottom_material">
    <selector>
        <item android:drawable="@android:color/transparent" />
    </selector>
</inset>
`

/** 中性强调档:亮墨 / 暗白 + 半透明灰 ripple + 半透明灰选中底纹(明暗各反转)。 */
const ACCENT_COLORS = {
  values: { accent_ink: '#000000', ripple_ink: '#1F000000', selection_ink: '#33000000' },
  'values-night': { accent_ink: '#FFFFFF', ripple_ink: '#1FFFFFFF', selection_ink: '#33FFFFFF' },
}

/** AppTheme 必须显式声明的条目(缺一条 ⇒ 那一条回落到系统默认)。 */
const ACCENT_STYLE_ITEMS = [
  ['colorAccent', '@color/accent_ink'],
  ['android:colorAccent', '@color/accent_ink'],
  ['colorControlActivated', '@color/accent_ink'],
  ['android:colorControlActivated', '@color/accent_ink'],
  ['colorControlHighlight', '@color/ripple_ink'],
  ['android:colorControlHighlight', '@color/ripple_ink'],
  ['android:textColorHighlight', '@color/selection_ink'],
  ['android:editTextBackground', `@drawable/${EDIT_TEXT_DRAWABLE}`],
]

/** ① 生成透明背景件。 */
const withNativeInputFiles = (config) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const resDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res')

      const drawableDir = path.join(resDir, 'drawable')
      await fs.promises.mkdir(drawableDir, { recursive: true })
      await fs.promises.writeFile(
        path.join(drawableDir, `${EDIT_TEXT_DRAWABLE}.xml`),
        EDIT_TEXT_MATERIAL,
        'utf8',
      )
      return cfg
    },
  ])

/** ③ 亮档强调色写进默认 colors.xml。 */
const withNativeInputColors = (config) =>
  withAndroidColors(config, (cfg) => {
    for (const [name, value] of Object.entries(ACCENT_COLORS.values)) {
      cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, { name, value })
    }
    return cfg
  })

/**
 * ③ 暗档强调色写进 values-night/colors.xml。
 * 走官方 `withAndroidColorsNight`(它读既有文件 → 同名覆盖/异名保留 → 回写),
 * 不整份覆写 —— 整份覆写会把模板/别的插件放进该文件的条目吃掉。
 */
const withNativeInputNightColors = (config) =>
  withAndroidColorsNight(config, (cfg) => {
    for (const [name, value] of Object.entries(ACCENT_COLORS['values-night'])) {
      cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, { name, value })
    }
    return cfg
  })

/**
 * ② AppTheme 钉死强调色与输入框背景。
 *
 * 定位只按 `name`,不看 `parent`:Expo 官方 `getAppThemeLightNoActionBarGroup` 的注释
 * 明写"按 name+parent 双匹配会在 prebuild 出问题(AppTheme 的 parent 可能被改,
 * 例如 edge-to-edge 开启时)" —— 双匹配在父档一变时会**另建一个 AppTheme**,
 * 同名两个 style ⇒ 构建期资源冲突。故这里先摘同名旧项(assignStylesValue 只覆盖
 * 第一处命中,残留副本会叠成重复 item),再按名落位;模板若没有 AppTheme 就按本项目
 * 的 DayNight 父档自己建一个。
 */
const withNativeInputTheme = (config) =>
  withAndroidStyles(config, (cfg) => {
    const names = new Set(ACCENT_STYLE_ITEMS.map(([name]) => name))
    const styles = cfg.modResults.resources.style || []
    const appTheme = styles.find((style) => style.$?.name === APP_THEME)
    if (appTheme) {
      appTheme.item = (appTheme.item || []).filter((item) => !names.has(item.$?.name))
    } else {
      styles.push({ $: { name: APP_THEME, parent: APP_THEME_PARENT }, item: [] })
      cfg.modResults.resources.style = styles
    }
    for (const [name, value] of ACCENT_STYLE_ITEMS) {
      cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
        add: true,
        parent: { name: APP_THEME },
        name,
        value,
      })
    }
    return cfg
  })

module.exports = (config) =>
  withNativeInputColors(
    withNativeInputNightColors(withNativeInputTheme(withNativeInputFiles(config))),
  )

module.exports.__test__ = {
  EDIT_TEXT_MATERIAL,
  ACCENT_COLORS,
  ACCENT_STYLE_ITEMS,
  APP_THEME,
  APP_THEME_PARENT,
  EDIT_TEXT_DRAWABLE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
