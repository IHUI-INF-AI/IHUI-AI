// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生成 miniapp-taro 原生 tabBar 亮色图标(lucide 风格,81x81 PNG)
 * 用法: node apps/miniapp-taro/scripts/gen-tabbar-icons.mjs
 * 产物: apps/miniapp-taro/src/assets/tabbar/tab-<name>.png / tab-<name>-active.png
 * 图标色**派生自 tokens.css**(AGENTS §4「色值副本一律是派生态」):PNG 把颜色烤死,
 * 是 theme.json 同级的副本 —— 未选中 --color-text-tertiary / 选中 --color-foreground
 * (2026-10-16 用户定稿「液态玻璃 + 深色中性」,与 mobile-rn/TabBar.tsx、theme.json
 * tabColor/tabSelected 同两档;浅紫/品牌蓝方案均已作废)。
 * 取源走 scripts/lib/design-token-blocks.mjs + check-cross-end-tokens.mjs 的 normalizeColor
 * (与 sync-miniapp-chrome.mjs 同形),**不得在这里写第二份转换器或硬编码 hex**。
 * 注意:这批 PNG 只服务原生 tabBar 的低版本兜底渲染;custom-tab-bar(液态玻璃胶囊)
 * 用 LineIcon 内联 SVG 着色,不消费这批文件。
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { collectVars } from '../../../scripts/lib/design-token-blocks.mjs' // arch-exempt: 构建工具(非运行期 app 代码)读单一色值源 tokens.css 烤 tabBar 双色 PNG,必须派生自 token 不硬编(§4 单一色值源);需把该 lib 提级/建"构建工具层"后收回 until 2027-01-16
import { __test__ as crossEnd } from '../../../scripts/check-cross-end-tokens.mjs' // arch-exempt: 取 normalizeColor 把 HSL token 归一为 #rrggbb 烤进 PNG;正解=把 normalizeColor 抽进共享 lib 供门体与构建工具同源 until 2027-01-16

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const OUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'tabbar')
const SIZE = 81

/** tokens.css 的 light 档取一个 token 并归一为 #rrggbb(缺档/不可表达 ⇒ 大声失败,绝不烤错色)。 */
function tokenHex(name) {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'packages', 'design-tokens', 'src', 'styles', 'tokens.css'), 'utf8')
  const decl = collectVars(css, ['@theme', ':root']).get(name)
  if (!decl) throw new Error(`tokens.css 取不到 ${name}(light 档) —— tabBar 图标色必须派生自 token`)
  const hex = crossEnd.normalizeColor(decl.value)
  if (!/^#[0-9a-f]{6}$/.test(hex)) throw new Error(`${name} 归一后 = "${hex}",不是 #rrggbb,不能烤进 PNG`)
  return hex
}

const INACTIVE = tokenHex('--color-text-tertiary') // 中性灰(未选中)
const ACTIVE = tokenHex('--color-foreground') // 深色中性(选中)

/** lucide 24x24 path 数据(简化自 lucide.dev) */
const ICONS = {
  // 智汇社区 → users
  community:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  // AI agent → bot
  agent:
    '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  // Square(广场) → layout-grid
  square:
    '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  // 我的 → user
  user:
    '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  // 分享星球 → share-2
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
}

function svgBody(paths, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const [name, paths] of Object.entries(ICONS)) {
    for (const [suffix, color] of [
      ['', INACTIVE],
      ['-active', ACTIVE],
    ]) {
      const file = path.join(OUT_DIR, `tab-${name}${suffix}.png`)
      await sharp(Buffer.from(svgBody(paths, color)))
        .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(file)
      console.log('generated', path.basename(file))
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
