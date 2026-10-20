#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-mobile-tabbar-icon-data.mjs — 生成底栏图标的内联 data URI 模块(常驻工具,不在提交链)
 *
 * 立因(全是现读,不是推测):
 *  - 真机 release 包上 `<Image source={require('本地 PNG')}>` 恒渲染为空白(布局仍占位),
 *    同屏 react-native-svg 图标全部正常 —— 该结论由 `packages/types/src/app-account.ts`
 *    记录的 8a7926ead7 同格对照实验钉死;登录页的飞书图标即因此在 2026-09-29 改走 SVG。
 *  - 底栏 TabBar 的 5×2 张 tabbar_*.png 是最后一族仍走该通道的图:实测真机与模拟器
 *    (release 与 debug 两包)都不上屏,像素带 0 个彩色像素,Fresco 停在 EmptyDrawable。
 *  - 这族是位图插画(带浅紫渐变),没有等价 SVG 源,不能走登录页那条「改 SVG」的路。
 *    ⇒ 内联为 data URI:绕开本地资源取源链,图一字不改。
 *
 * 用法:node scripts/gen-mobile-tabbar-icon-data.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'apps', 'mobile-rn', 'assets', 'images', 'tabbar')
const OUT = join(ROOT, 'apps', 'mobile-rn', 'src', 'components', 'tabbarIconData.ts')
const SIZE = 72

const ICONS = [
  ['AI_SHOP_INACTIVE', 'tabbar_1.png'],
  ['AI_SHOP_ACTIVE', 'tabbar_1_act.png'],
  ['PLAZA_INACTIVE', 'tabbar_2.png'],
  ['PLAZA_ACTIVE', 'tabbar_2_act.png'],
  ['HOME_INACTIVE', 'tabbar_3.png'],
  ['HOME_ACTIVE', 'tabbar_3_act.png'],
  ['NEWS_INACTIVE', 'tabbar_4.png'],
  ['NEWS_ACTIVE', 'tabbar_4_act.png'],
  ['MINE_INACTIVE', 'tabbar_5.png'],
  ['MINE_ACTIVE', 'tabbar_5_act.png'],
]

async function build() {
  const entries = []
  for (const [key, file] of ICONS) {
    const buf = readFileSync(join(SRC_DIR, file))
    const out = await sharp(buf)
      .resize({ width: SIZE, height: SIZE, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer()
    entries.push([key, `data:image/png;base64,${out.toString('base64')}`])
  }
  // 产物形态按仓库 prettier 档位预先折行(长字符串字面量会被 prettier 拆成「键名独占一行 +
  // 缩进 4 空格的字符串」),否则 lint-staged 一跑 --fix 就与生成器互相打架。
  const lines = entries.map(([k, v]) => `  ${k}:\n    '${v}',`).join('\n')
  return `// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
/**
 * 底栏图标内联数据(由 scripts/gen-mobile-tabbar-icon-data.mjs 生成,勿手改)。
 *
 * 为什么不 require 本地 PNG:真机 release 包上 \`<Image source={require(本地 PNG)}>\` 恒空白
 * (钉死见 packages/types/src/app-account.ts 的 8a7926ead7 对照实验)。这族是位图插画、
 * 无等价 SVG 源,故内联为 data URI 绕开该取源链,图一字未改。
 * 尺寸取 72px(展示 24dp,覆盖 3x 屏足够)。
 */
export const TABBAR_ICON_DATA = {
${lines}
} as const
`
}

async function main() {
  const text = await build()
  writeFileSync(OUT, text)
  console.log(`✅ 已生成 ${OUT}(${Math.round(text.length / 1024)} KB)`)
  // §5c:生成器 writeFileSync 后必须紧随水印注入
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'watermark.mjs'), 'inject', OUT], {
    stdio: 'inherit',
    windowsHide: true,
  })
  if (r.status !== 0) throw new Error(`watermark inject 失败(exit ${r.status})`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
