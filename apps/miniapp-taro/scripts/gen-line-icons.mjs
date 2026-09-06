// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// 一次性生成脚本:把 static/images/icons/*.svg 提取为 LineIcon 注册表 icons.ts
// 说明:输出 svg 全片段(raw),由 LineIcon 运行期 URL-encode 后用 CSS mask 渲染。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, basename, extname } from 'node:path'

const ICONS_DIR = 'src/static/images/icons'
const OUT = 'src/components/LineIcon/icons.ts'

const svgs = readdirSync(ICONS_DIR).filter((f) => f.endsWith('.svg'))
if (!svgs.length) {
  console.error('未找到 svg')
  process.exit(1)
}

const iconName = (file) => basename(file, extname(file))

function extractSvg(raw) {
  const start = raw.indexOf('<svg')
  const end = raw.indexOf('</svg>')
  if (start === -1 || end === -1) return null
  return raw.slice(start, end + '</svg>'.length)
}

// 归一化描边/填充为中性 #000000:LineIcon 以 CSS mask 渲染(仅取 alpha),
// 最终颜色由调用方 color token 决定 → 注册表内不允许存在语义杂色(根治硬编码色)。
// fill="none"/fill="currentColor" 不受影响(仅替换十六进制色值)。
function normalizeSvgColor(svg) {
  return svg
    .replace(/\bstroke="#[0-9A-Fa-f]+"/g, 'stroke="#000000"')
    .replace(/\bfill="#[0-9A-Fa-f]+"/g, 'fill="#000000"')
}

const entries = []
for (const file of svgs.sort()) {
  const raw = readFileSync(join(ICONS_DIR, file), 'utf8')
  const svg = extractSvg(raw)
  if (!svg) {
    console.warn(`skip(无 svg): ${file}`)
    continue
  }
  entries.push([iconName(file), normalizeSvgColor(svg)])
}

const lines = entries.map(
  ([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`,
)

const header =
`/* eslint-disable */
// 由 scripts/gen-line-icons.mjs 生成,勿手改。键=文件名(不含 .svg),值=完整 <svg> 片段(raw)。
// 供 LineIcon 用 CSS mask 渲染;stroke 已规范为描边路径,颜色由父级 background/token 决定。
export const ICONS = {
${lines.join('\n')}
} as const

export type IconName = keyof typeof ICONS
`

writeFileSync(OUT, header, 'utf8')
console.log(`✅ 已生成 ${OUT} (${entries.length} 个图标)`)