#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 生成 Android 壳的品牌资源(启动图标 + 自适应前景 + 启动屏)。
 *
 * 源:apps/web/public/favicon.svg(矢量,任意尺寸无损渲染)
 * 输出:覆盖 android/app/src/main/res/ 下模板默认资源(幂等,可重复跑)。
 * 规范:
 *  - 自适应图标(foreground):1.5x 画布,logo 占画布 ~55%(安全圆 = 66.7%)
 *  - 传统图标(ic_launcher/round):白底方形,logo 占 ~78%
 *  - 启动屏:白底,logo 居中占短边 ~30%
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const capRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resDir = path.join(capRoot, 'android', 'app', 'src', 'main', 'res')
const svgPath = path.join(capRoot, '..', 'web', 'public', 'favicon.svg')

if (!existsSync(svgPath)) {
  console.error('[gen-assets] 错误: favicon.svg 不存在:', svgPath)
  process.exit(1)
}
const svgBuf = readFileSync(svgPath)

async function renderLogo(px) {
  return sharp(svgBuf, { density: 72 * Math.ceil(px / 24) })
    .resize(px, px, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

async function composeLogoCanvas(logoBuf, canvas, ratio, bg) {
  const logoPx = Math.round(canvas * ratio)
  return sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: logoBuf, top: Math.round((canvas - logoPx) / 2), left: Math.round((canvas - logoPx) / 2) }])
    .png()
    .toBuffer()
}

// 密度 → 传统启动图标边长(dp 基准 48)
const LAUNCHER_SIZES = { 'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192 }
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

let count = 0
for (const [dir, size] of Object.entries(LAUNCHER_SIZES)) {
  const outDir = path.join(resDir, dir)
  if (!existsSync(outDir)) continue
  const logo = await renderLogo(Math.round(size * 0.78))
  // 传统图标:白底
  writeFileSync(path.join(outDir, 'ic_launcher.png'), await composeLogoCanvas(logo, size, 1, WHITE))
  writeFileSync(path.join(outDir, 'ic_launcher_round.png'), await composeLogoCanvas(logo, size, 1, WHITE))
  // 自适应前景:1.5x 画布,透明底,logo 占画布 55%(落在 66.7% 安全圆内)
  const logoFg = await renderLogo(Math.round(size * 1.5 * 0.55))
  writeFileSync(
    path.join(outDir, 'ic_launcher_foreground.png'),
    await composeLogoCanvas(logoFg, Math.round(size * 1.5), 1, TRANSPARENT),
  )
  count += 3
  console.log(`[gen-assets] ${dir}: ic_launcher/round/foreground @${size}px ✓`)
}

// 启动屏:白底 + 居中 logo(短边 30%),按现有文件尺寸逐一覆盖
async function genSplash(file) {
  const meta = await sharp(file).metadata()
  const w = meta.width
  const h = meta.height
  const short = Math.min(w, h)
  const logoPx = Math.round(short * 0.3)
  const logo = await renderLogo(logoPx)
  await sharp({ create: { width: w, height: h, channels: 4, background: WHITE } })
    .composite([{ input: logo, top: Math.round((h - logoPx) / 2), left: Math.round((w - logoPx) / 2) }])
    .png()
    .toFile(file)
  count++
  console.log(`[gen-assets] ${path.relative(resDir, file)} @${w}x${h} ✓`)
}

const splashFiles = []
for (const name of ['drawable', ...readdirSync(resDir).filter((d) => d.startsWith('drawable-port-') || d.startsWith('drawable-land-'))]) {
  const f = path.join(resDir, name, 'splash.png')
  if (existsSync(f)) splashFiles.push(f)
}
for (const f of splashFiles) await genSplash(f)

// 自适应图标背景色 → 白(与站点品牌一致)
const bgXml = path.join(resDir, 'values', 'ic_launcher_background.xml')
if (existsSync(bgXml)) {
  writeFileSync(bgXml, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n`)
  console.log('[gen-assets] values/ic_launcher_background.xml → #FFFFFF ✓')
}

console.log(`[gen-assets] 完成,共写 ${count + splashFiles.length + 1} 个资源文件`)
