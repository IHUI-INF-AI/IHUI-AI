// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 一次性生成脚本:把 static/images/icons/*.svg 提取为 LineIcon 注册表 icons.ts
// 说明:输出 svg 全片段(raw),由 LineIcon 运行期 URL-encode 后用 CSS mask 渲染。
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
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

// lucide 字形里的 rx/ry 是 24 格 viewBox 的**几何单位**,不是 UI 圆角档位(吸附会把图标扭歪)。
// 守门 77 的 B5 看不到这层语义,故由生成器自己吐豁免行 —— 手写 marker 会在下次生成时被抹掉,
// 生成器内置才闭环(2026-09-23 圆角同源收口时实测到该缺口)。
const EXEMPT = '  // radius-exempt: lucide 字形几何,rx/ry 为 24 格 viewBox 单位而非 UI 圆角档位'
const lines = entries.flatMap(([k, v]) => {
  const row = `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`
  return /\br[xy]\s*=/.test(v) ? [EXEMPT, row] : [row]
})

// 质量闸:源 svg 目录早在「图片全量外置 CDN」那轮就被清空(实测 HEAD~400 起就只剩 1 个),
// 而 icons.ts 才是 LineIcon 真正消费的资产(141 条)。不加这道闸,任何人跑一次本生成器
// 就会静默删掉 140 个运行时图标 —— 这正是本仓守门 65 拦的那一类整树删除。
if (existsSync(OUT)) {
  const prevCount = (readFileSync(OUT, 'utf8').match(/^\s{2}(?:"[^"]+"|'[^']+'|[a-z0-9-]+):/gm) || []).length
  if (entries.length < prevCount * 0.5) {
    console.error(
      `❌ 拒绝写入:源目录 ${ICONS_DIR} 只解析到 ${entries.length} 个图标,而已生成的 ${OUT} 有 ${prevCount} 个。\n` +
        `   生成器已与实际资产脱节(图标源已外置 CDN)。要重建请先取回 svg;要微调请改 ${OUT} 本身。`,
    )
    process.exit(1)
  }
}

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
