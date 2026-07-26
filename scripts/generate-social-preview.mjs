#!/usr/bin/env node
// 生成 GitHub social-preview.png(1280x640)
// 用法:node scripts/generate-social-preview.mjs
// 输出:.github/social-preview.png
// 依赖:sharp(Next.js 15 自带;若未安装:pnpm add -Dw sharp)
// 上传:GitHub repo → Settings → Social preview → Edit → Upload .github/social-preview.png

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, '.github/social-preview.svg')
const pngPath = join(root, '.github/social-preview.png')

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('\n[FAIL] sharp 未安装。两种解决方案:\n')
  console.error('  方案 A(推荐):pnpm add -Dw sharp && node scripts/generate-social-preview.mjs')
  console.error('  方案 B(免安装):用在线工具把 .github/social-preview.svg 转为 PNG,尺寸 1280x640,保存为 .github/social-preview.png')
  console.error('    推荐:https://convertio.co/svg-png/ 或 Figma 导出 PNG\n')
  process.exit(1)
}

const svg = await readFile(svgPath)
await sharp(svg, { density: 144 })
  .resize(1280, 640, { fit: 'fill' })
  .png()
  .toFile(pngPath)

console.log('\n[OK] social-preview.png 已生成:', pngPath)
console.log('上传步骤:GitHub repo → Settings → Social preview → Edit → Upload → Save\n')
