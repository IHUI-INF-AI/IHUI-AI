#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 输出走 process.stdout.write 而非 console.log:后者需一条 lint 抑制注释,
 * 而纳管块内新增裸 lint 抑制会被门 103(DC)与门 108(E5)判红(出口只有"不需要抑制"或
 * "写进策略表例外"两条)。本档不引抑制,故直接写 stdout。
 * (注:此处刻意不写出那条抑制指令的字面量 —— 两道门按字面量计数,连解释它的散文都会被算成一条。)
 */
/**
 * 回归档 —— 原生输入框 chrome 插件(withNativeInputChrome.cjs)的**调用形状**行为锁。
 *
 * 为什么单独一档:这一族的缺陷在 JS 层完全看不出异常 —— RN 的 TextInput 画出来是正常的,
 * 异常发生在原生主题层(Android EditText 背景恒画原生 9-patch;强调色不钉 ⇒ 回落系统橙)。
 * 于是"形状写错"这件事在提交口只能靠**真跑一遍**才暴露,而不能靠读代码:
 *   · `assignStylesValue` 带 parent 双匹配 ⇒ 父档被改时会**另建一个同名 AppTheme**;
 *   · `withAndroidColorsNight` 若整份覆写 ⇒ 模板/别的插件放进 values-night 的条目被吃掉。
 * 这两型都曾在本票实现期间真实发生过,静态读代码看不出来。
 *
 * §22c 纪律:常量与判据一律 import 源(plugin 的 `__test__`、守门的 `__test__`),
 * 本文件**不复制任何常量或判定**。
 *
 * 跑法:node scripts/tests/with-native-input-chrome.test.mjs
 */
import { createRequire } from 'node:module'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { hasWarmColor, auditPluginChromeSet } from '../check-no-warm-border.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const RN = join(ROOT, 'apps', 'mobile-rn')
const PLUGIN_REL = 'apps/mobile-rn/plugins/withNativeInputChrome.cjs'

const cases = []
const t = (name, fn) => cases.push({ name, fn })

/** RN prebuild 出来的原始模板形态(不含本票任何改动)——夹具自带事故原文,不钉 HEAD blob。 */
const RAW_STYLES = `<resources xmlns:tools="http://schemas.android.com/tools">
  <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:editTextBackground">@drawable/rn_edit_text_material</item>
    <item name="colorPrimary">@color/colorPrimary</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
  </style>
  <style name="Theme.App.SplashScreen" parent="AppTheme">
    <item name="android:windowBackground">@drawable/ic_launcher_background</item>
  </style>
</resources>
`
const RAW_COLORS = `<resources>
  <color name="splashscreen_background">#000000</color>
  <color name="colorPrimary">#023c69</color>
</resources>
`
const RAW_NIGHT_COLORS = `<resources>
  <color name="template_night_only">#112233</color>
</resources>
`

/** plugin 与 expo 的 require 句柄:plugin 是 .cjs,须用 createRequire 从 RN 的 package.json 起解析。 */
const rnRequire = createRequire(join(RN, 'package.json'))
let plugin = null
let XML = null
let loadError = null
try {
  plugin = rnRequire('./plugins/withNativeInputChrome.cjs')
  XML = rnRequire('expo/config-plugins').XML
} catch (e) {
  loadError = e?.message ?? String(e)
}

function styleItems(manifest, name) {
  const styles = manifest?.resources?.style || []
  const hits = styles.filter((s) => s.$?.name === name)
  return { groupCount: hits.length, items: (hits[0]?.item || []).map((i) => [i.$?.name, i._]) }
}

function colorMap(manifest) {
  const list = manifest?.resources?.color || []
  return Object.fromEntries(list.map((c) => [c.$?.name, c._]))
}

/**
 * 真跑一遍 plugin 注册的四个 mod。
 * 返回 { styles, colors, night, drawableText, drawablePath, resDir }。
 */
async function runPluginMods(scratch) {
  const { ACCENT_STYLE_ITEMS } = plugin.__test__
  const androidRoot = join(scratch, 'android')
  const resDir = join(androidRoot, 'app', 'src', 'main', 'res')
  mkdirSync(join(resDir, 'values'), { recursive: true })
  mkdirSync(join(resDir, 'values-night'), { recursive: true })
  mkdirSync(join(resDir, 'drawable'), { recursive: true })
  writeFileSync(join(resDir, 'values', 'styles.xml'), RAW_STYLES, 'utf8')
  writeFileSync(join(resDir, 'values', 'colors.xml'), RAW_COLORS, 'utf8')
  writeFileSync(join(resDir, 'values-night', 'colors.xml'), RAW_NIGHT_COLORS, 'utf8')

  const cfg = plugin({ name: 'probe', slug: 'probe', mods: {} })
  const mods = cfg.mods.android
  const modRequest = { projectRoot: scratch, platformProjectRoot: androidRoot, platform: 'android' }
  const runMod = (mod, modResults) => mod({ modResults, modRequest, name: 'probe', slug: 'probe' })

  const stylesResult = await runMod(mods.styles, await XML.parseXMLAsync(RAW_STYLES))
  const colorsResult = await runMod(mods.colors, await XML.parseXMLAsync(RAW_COLORS))
  const nightResult = await runMod(mods.colorsNight, await XML.parseXMLAsync(RAW_NIGHT_COLORS))
  await runMod(mods.dangerous, {})

  const drawablePath = join(resDir, 'drawable', 'rn_edit_text_material.xml')
  return {
    ACCENT_STYLE_ITEMS,
    mods,
    runMod,
    stylesManifest: stylesResult.modResults,
    colorsManifest: colorsResult.modResults,
    nightManifest: nightResult.modResults,
    drawablePath,
    drawableText: existsSync(drawablePath) ? readFileSync(drawablePath, 'utf8') : null,
  }
}

t('P1 plugin 与 expo/config-plugins 均可解析(取不到即未判定,不记绿)', () => {
  if (!plugin || !XML) {
    throw new Error(
      `apps/mobile-rn 的依赖未装齐(expo/config-plugins 或 plugin 取不到)⇒ 未判定,不记绿:${loadError}`,
    )
  }
  if (typeof plugin.__test__?.ACCENT_STYLE_ITEMS !== 'object') {
    throw new Error('plugin 缺 __test__ 出口 ⇒ 本档无从 import 源常量(§22c)')
  }
})

t('P2 AppTheme 有且仅有一份,且 8 条 item 全部落位(带 parent 双匹配 ⇒ 另建同名组的形状)', async () => {
  const scratch = mkScratch('native-input-chrome-')
  try {
    const r = await runPluginMods(scratch)
    const app = styleItems(r.stylesManifest, plugin.__test__.APP_THEME)
    if (app.groupCount !== 1) throw new Error(`AppTheme style 组实得 ${app.groupCount} 份(应为 1)`)
    for (const [name, value] of r.ACCENT_STYLE_ITEMS) {
      const hit = app.items.filter(([n]) => n === name)
      if (hit.length !== 1) throw new Error(`AppTheme 的 ${name} 实得 ${hit.length} 条(应为 1)`)
      if (hit[0][1] !== value) throw new Error(`AppTheme 的 ${name} 值是 ${hit[0][1]},应为 ${value}`)
    }
    const names = app.items.map(([n]) => n)
    if (new Set(names).size !== names.length) throw new Error('AppTheme 出现重复 item')
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
})

t('P3 既有条目不被吃掉、第二个 style 不被牵连', async () => {
  const scratch = mkScratch('native-input-chrome-')
  try {
    const r = await runPluginMods(scratch)
    const app = styleItems(r.stylesManifest, plugin.__test__.APP_THEME)
    if (!app.items.some(([n, v]) => n === 'android:statusBarColor' && v === '@android:color/transparent')) {
      throw new Error('既有条目 android:statusBarColor 被吃掉')
    }
    if (!app.items.some(([n]) => n === 'colorPrimary')) throw new Error('既有条目 colorPrimary 被吃掉')
    const splash = styleItems(r.stylesManifest, 'Theme.App.SplashScreen')
    if (splash.groupCount !== 1 || splash.items.length !== 1) {
      throw new Error('第二个 style(Theme.App.SplashScreen)被牵连')
    }
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
})

t('P4 幂等:prebuild 会反复跑,重跑一遍不得生双份', async () => {
  const scratch = mkScratch('native-input-chrome-')
  try {
    const r = await runPluginMods(scratch)
    const first = styleItems(r.stylesManifest, plugin.__test__.APP_THEME)
    const again = await r.runMod(r.mods.styles, r.stylesManifest)
    const second = styleItems(again.modResults, plugin.__test__.APP_THEME)
    if (second.groupCount !== 1) throw new Error(`重跑一遍 AppTheme 实得 ${second.groupCount} 份`)
    if (second.items.length !== first.items.length) {
      throw new Error(`重跑一遍条目数由 ${first.items.length} 变成 ${second.items.length}`)
    }
    const names = second.items.map(([n]) => n)
    if (new Set(names).size !== names.length) throw new Error('重跑一遍出现重复 item')
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
})

t('P5 既有重复副本被清干净(官方 API 只覆盖第一处命中)', async () => {
  const scratch = mkScratch('native-input-chrome-')
  try {
    const r = await runPluginMods(scratch)
    const dupXml = RAW_STYLES.replace(
      '<item name="colorPrimary">@color/colorPrimary</item>',
      '<item name="colorPrimary">@color/colorPrimary</item>\n    <item name="colorAccent">@color/legacy</item>\n    <item name="colorAccent">@color/legacy2</item>',
    )
    const out = await r.runMod(r.mods.styles, await XML.parseXMLAsync(dupXml))
    const app = styleItems(out.modResults, plugin.__test__.APP_THEME)
    const accents = app.items.filter(([n]) => n === 'colorAccent')
    if (accents.length !== 1) throw new Error(`重复副本残留:colorAccent 剩 ${accents.length} 条`)
    if (accents[0][1] !== '@color/accent_ink') throw new Error(`重复副本取值是 ${accents[0][1]},应为 @color/accent_ink`)
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
})

t('P6 亮档三色落位、既有 color 保留', async () => {
  const scratch = mkScratch('native-input-chrome-')
  try {
    const r = await runPluginMods(scratch)
    const map = colorMap(r.colorsManifest)
    for (const [name, value] of Object.entries(plugin.__test__.ACCENT_COLORS.values)) {
      if (map[name] !== value) throw new Error(`values/colors.xml 的 ${name} 是 ${map[name]},应为 ${value}`)
    }
    if (map.colorPrimary !== '#023c69') throw new Error('既有 colorPrimary 被吃掉')
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
})

t('P7 暗档是"合并"不是"整份覆写"(模板/别的插件的条目必须留下)', async () => {
  const scratch = mkScratch('native-input-chrome-')
  try {
    const r = await runPluginMods(scratch)
    const map = colorMap(r.nightManifest)
    for (const [name, value] of Object.entries(plugin.__test__.ACCENT_COLORS['values-night'])) {
      if (map[name] !== value) throw new Error(`values-night/colors.xml 的 ${name} 是 ${map[name]},应为 ${value}`)
    }
    if (map.template_night_only !== '#112233') throw new Error('暗档既有条目被整份覆写掉')
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
})

t('P8 背景件真落盘、恒透明、不引用原生 textfield 9-patch', async () => {
  const scratch = mkScratch('native-input-chrome-')
  try {
    const r = await runPluginMods(scratch)
    if (r.drawableText === null) throw new Error('dangerous mod 没把背景件写进 drawable/')
    if (r.drawableText !== plugin.__test__.EDIT_TEXT_MATERIAL) {
      throw new Error('落盘内容与生成源不逐字一致(生成源是唯一真相源)')
    }
    if (!/@android:color\/transparent/.test(r.drawableText)) throw new Error('背景件不是恒透明')
    if (/textfield_(activated|default)/.test(r.drawableText)) throw new Error('背景件仍引用原生 textfield 9-patch')
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
})

t('P9 产出的色值无暖色(本票终局条件)', async () => {
  const scratch = mkScratch('native-input-chrome-')
  try {
    const r = await runPluginMods(scratch)
    const all = { ...colorMap(r.colorsManifest), ...colorMap(r.nightManifest) }
    const warm = Object.entries(all).filter(([, v]) => hasWarmColor(String(v)))
    if (warm.length !== 0) throw new Error(`产出含暖色:${JSON.stringify(warm)}`)
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
})

t('P10 plugin 源过守门判据(暖色描边禁令的 plugin 支)', () => {
  const src = readFileSync(join(ROOT, PLUGIN_REL), 'utf8')
  const hits = auditPluginChromeSet([{ rel: PLUGIN_REL, text: src }])
  if (hits.length !== 0) throw new Error(`plugin 源命中守门 ${hits.length} 条:${JSON.stringify(hits)}`)
})

t('P11 装车证明:plugin 在 app.config.js 里注册(造好没装车 = 没有)', () => {
  const cfgSrc = readFileSync(join(RN, 'app.config.js'), 'utf8')
  if (!cfgSrc.includes('withNativeInputChrome.cjs')) {
    throw new Error('apps/mobile-rn/app.config.js 没有引用 withNativeInputChrome.cjs ⇒ 原生修复不会生效')
  }
})

let pass = 0
const fails = []
for (const c of cases) {
  try {
    await c.fn()
    pass++
  } catch (e) {
    fails.push(`${c.name} — ${e && e.message ? e.message : String(e)}`)
  }
}
for (const f of fails) process.stdout.write(`  ❌ ${f}\n`)
process.stdout.write(
  `\n回归 ${pass}/${cases.length} 通过${fails.length ? `,失败 ${fails.length} 条` : ''}(常量与判据 import 源)\n`,
)
process.exit(fails.length ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
