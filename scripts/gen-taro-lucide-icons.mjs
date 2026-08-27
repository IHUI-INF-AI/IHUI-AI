/**
 * 生成 Taro 端 lucide 风格 SVG 图标(与 apps/miniapp-taro/src/static/images/icons/ 现有格式一致)。
 *
 * 数据源:node_modules 中 lucide-react@1.31.0 的 esm/icons/*.mjs(__iconNode)。
 * 输出:apps/miniapp-taro/src/static/images/icons/<name>.svg(stroke 色默认 #6366F1,可覆盖)。
 *
 * 用法:
 *   node scripts/gen-taro-lucide-icons.mjs play pause heart        # 生成指定图标
 *   node scripts/gen-taro-lucide-icons.mjs --color '#FFFFFF' play  # 指定描边颜色
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const LUCIDE_DIR = join(
  root,
  'node_modules/.pnpm/lucide-react@1.31.0_react@19.2.8/node_modules/lucide-react/dist/esm/icons',
)
const OUT_DIR = join(root, 'apps/miniapp-taro/src/static/images/icons')

function parseNode(node) {
  const [tag, attrs] = node
  const { key: _key, ...rest } = attrs
  const attrStr = Object.entries(rest)
    .map(([k, v]) => `${k}="${String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
    .join(' ')
  return `<${tag}${attrStr ? ' ' + attrStr : ''} />`
}

function generate(name, strokeColor) {
  let file = join(LUCIDE_DIR, `${name}.mjs`)
  if (!existsSync(file)) throw new Error(`lucide icon not found: ${name}`)
  let src = readFileSync(file, 'utf8')
  // 解析别名重导出(如 bar-chart-3 -> chart-column)
  const alias = src.match(/export \{ default \} from '\.\/([\w-]+)\.mjs';/)
  if (alias) {
    file = join(LUCIDE_DIR, `${alias[1]}.mjs`)
    if (!existsSync(file)) throw new Error(`lucide alias target not found: ${alias[1]} (for ${name})`)
    src = readFileSync(file, 'utf8')
  }
  const match = src.match(/const __iconNode = (\[[\s\S]*?\]);/m)
  if (!match) throw new Error(`cannot parse __iconNode: ${name}`)
  // eslint-disable-next-line no-eval -- 受控的本地 lucide 数据结构解析
  const iconNode = eval(match[1])
  const body = iconNode.map(parseNode).join('\n  ')
  const svg = `<!-- @license lucide-static v1.31.0 - ISC -->
<svg
  class="lucide lucide-${name}"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="${strokeColor}"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  ${body}
</svg>
`
  return svg
}

const args = process.argv.slice(2)
let color = '#6366F1'
const names = []
for (const a of args) {
  if (a === '--color') continue
  if (a.startsWith('--color=')) {
    color = a.slice(8)
  } else if (args[args.indexOf(a) - 1] === '--color') {
    color = a
  } else {
    names.push(a)
  }
}

if (names.length === 0) {
  console.error('usage: node gen-taro-lucide-icons.mjs [--color #hex] icon1 icon2 ...')
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })
for (const n of names) {
  const svg = generate(n, color)
  const out = join(OUT_DIR, `${n}.svg`)
  writeFileSync(out, svg, 'utf8')
  console.log(`✓ ${n}.svg -> ${out} (stroke ${color})`)
}
