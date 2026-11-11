/**
 * 桌面安装器 / 卸载器品牌色板的唯一读取口。
 *
 * 背景(2026-11-12 收口):scripts/desktop-installer-assets.mjs 原先手写了一份
 * `const C = { bg:'#242424', … }`,文件头却写着「全部映射 tokens.css 暗色块,禁止自造色值」——
 * 注释与实现之间没有任何读取动作,token 改了 5 档 BMP 一张都不会跟着变。同理
 * `const RADIUS = 8` 也是 --global-border-radius 的手抄副本。
 *
 * 本模块每次生成时直接解析 packages/design-tokens/src/styles/tokens.css 的 `.dark` 块,
 * 把 hsl() 归一成 #rrggbb;键缺失 / 值不可解析一律抛错,**绝不回落到硬编码副本**
 * (§0.3:取不到输入就判「未判定」,不能静默用旧值画一版看起来正常的图)。
 *
 * 派生色一律由本模块在运行时合成,不允许再出现第二个手写色值:
 *   - hairline(进度轨道描边)= border-medium 叠加 75% 透明度
 *   - 导轨 todo 步英文副标题 = brand-accent 叠加 34% 透明度
 * 这样 tokens.css 是唯一需要改动的地方。
 */

import { readFileSync } from 'node:fs'

/** `.dark { … }` 块:只取顶格 `}` 收口,块内注释不参与解析。 */
const DARK_BLOCK_RE = /^\.dark\s*\{([\s\S]*?)^\}/m
const DECL_RE = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gim

/** 生成器字段名 → tokens.css 变量名。改映射名必须同时改消费方。 */
export const PALETTE_TOKEN_MAP = Object.freeze({
  bg: '--color-background',
  card: '--color-card',
  rail: '--color-brand-accent-light',
  ink: '--color-foreground',
  inkSoft: '--color-text-medium',
  muted: '--color-text-tertiary',
  primary: '--color-primary',
  primaryInk: '--color-primary-foreground',
  btnStroke: '--color-border-medium',
  accent: '--color-brand-accent',
  accentInk: '--color-brand-accent-foreground',
  gradFrom: '--color-brand-accent-grad-from',
  gradTo: '--color-brand-accent-grad-to',
  tint: '--color-brand-accent-tint',
  tintStrong: '--color-brand-accent-tint-strong',
})

/** hsl(H S% L%) → #rrggbb;非 hsl 值原样返回(hex / rgba() 都是 tokens.css 里的合法形态)。 */
export function normalizeColor(raw) {
  const v = String(raw).trim()
  const m = v.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i)
  if (!m) {
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase()
    if (/^rgba?\(/i.test(v)) return v.replace(/\s+/g, '')
    throw new Error(`无法归一的设计令牌色值: ${v}`)
  }
  const h = Number(m[1]) / 360
  const s = Number(m[2]) / 100
  const l = Number(m[3]) / 100
  if (s === 0) {
    const g = Math.round(l * 255)
      .toString(16)
      .padStart(2, '0')
    return `#${g}${g}${g}`
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t0) => {
    let t = t0
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const toHex = (x) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(hue(h + 1 / 3))}${toHex(hue(h))}${toHex(hue(h - 1 / 3))}`
}

/** 从一份 tokens.css 文本里解析 `.dark` 块的全部自定义属性声明。 */
export function parseDarkDeclarations(src) {
  const block = src.match(DARK_BLOCK_RE)
  if (!block) throw new Error('tokens.css 里找不到 .dark { … } 块,安装器色板未判定')
  const out = {}
  for (const m of block[1].matchAll(DECL_RE)) out[m[1]] = m[2].trim()
  if (Object.keys(out).length === 0) throw new Error('.dark 块里解析到 0 条声明,安装器色板未判定')
  return out
}

/**
 * 读取并返回 { palette, radius, tokenValues }。
 * @param {string} tokensPath packages/design-tokens/src/styles/tokens.css 绝对路径
 */
export function readInstallerPalette(tokensPath) {
  const src = readFileSync(tokensPath, 'utf8')
  const decls = parseDarkDeclarations(src)
  const palette = {}
  const tokenValues = {}
  for (const [key, token] of Object.entries(PALETTE_TOKEN_MAP)) {
    const raw = decls[token]
    if (!raw) throw new Error(`tokens.css .dark 块缺少 ${token}(安装器色板 ${key}),拒绝回落到硬编码`)
    palette[key] = normalizeColor(raw)
    tokenValues[token] = palette[key]
  }
  const radiusM = src.match(/--global-border-radius:\s*(\d+)px/)
  if (!radiusM) throw new Error('tokens.css 缺少 --global-border-radius,安装器圆角未判定')
  const radius = Number(radiusM[1])
  if (!Number.isInteger(radius) || radius <= 0) throw new Error(`圆角档位非法: ${radiusM[1]}`)
  return { palette, radius, tokenValues }
}
