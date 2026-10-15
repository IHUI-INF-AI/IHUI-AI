#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 远程图库真图交付生成器(G-45,原 G-977959):把 deploy/server-root 里的空文件与缺失路径
 * 按**登记表 + 全仓代码引用**逐个补齐真图。
 *
 * 取图优先级(2026-10-14 修正后):
 *   ① **本地真图副本优先** —— `apps/miniapp-taro/src/assets/remote/`(登记表头注声明的本地副本,
 *      结构性命中 `remote-images/` ↔ `images/`)。实测登记表 289 条里 106 条在此有真图;
 *      早期版本按"两段路径逐字匹配"判 0 命中、对这些槽位生成了程序化假图,已由本通道纠正。
 *   ② 无真图 ⇒ 程序化生成(SVG 线稿 / 徽章 / 封面 / 渐变 / 二维码 / 厂牌转档)。
 *   ③ 无真图也无 spec(.mp4、`sys-backs/*` 动态备份路径)⇒ 点名"无源",**不造假**。
 *
 * 设计体系(2026-10-14,机主授权 AI 设计):
 *   - 色板对齐 web token:primary #111827 / info #3B82F6 / success #22C55E / warning #F59E0B / destructive #EF4444
 *   - 图标 = 程序化 SVG 线稿(sharp 渲染),统一圆角线稿风格,透明底
 *   - 横幅/插画基图 = AI 生成(tmp/img-design/staging/,机主授权的积分消耗),统一底部 10% 裁切去水印
 *   - 背景 = 程序化渐变 + 装饰形
 *   - 徽章/封面文字 = SVG text(Microsoft YaHei,冒烟测试已验证中文渲染)
 *   - 二维码 = 真码优先(本地副本);无真码的槽位才用 qrcode 库生成(指向 https://aizhs.top)
 *   - 微信/支付宝厂牌 = 仓内既有官方 SVG 资产转 PNG(apps/web/public/footer/zf/),不伪造商标
 *
 * 用法:
 *   node scripts/generate-remote-images.mjs            # 只补缺失/空文件(真图优先)
 *   node scripts/generate-remote-images.mjs --force    # 全量重生成
 *   node scripts/generate-remote-images.mjs --mirror-web  # 同步同名镜像到 apps/web/public(工作树)
 *
 * 铁律(票面原文):不得为了把 175 降到 0 去放宽判据、也不得改代码把 URL 指向别的图。
 *   —— 本脚本只按登记表原名原格式落盘,不动任何代码引用。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, copyFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const sharp = require(resolve(ROOT, 'node_modules/.pnpm/sharp@0.35.5_@types+node@26.1.2/node_modules/sharp'))
const QRCode = require(resolve(ROOT, 'node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode'))
const SERVER_ROOT = join(ROOT, 'deploy/server-root')
const STAGING = join(ROOT, 'tmp/img-design/staging')
const REGISTRY_TS = join(ROOT, 'apps/miniapp-taro/src/constants/remote-icons.ts')
// 本地真图副本:登记表头注声明"本地副本:apps/miniapp-taro/src/assets/remote/(已复制原项目
// src/static/ 全部图标),匹配策略:URL path 精确匹配 → basename 匹配本地副本"。URL 前缀
// `remote-images/` 对应本地 `images/`(原项目 static 目录),`tabbar/` 原样对应。
// 2026-10-14 补:登记表 289 条里有 **106 条**在此副本有真图(结构性命中),真图必须优先于
// 程序化生成 —— 早前按"两段路径逐字匹配"判 0 命中时漏了这条目录别名映射,已修正。
const LOCAL_ASSET_ROOT = join(ROOT, 'apps/miniapp-taro/src/assets/remote')
const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|svg)$/i
const BRAND = {
  wechatSvg: join(ROOT, 'apps/web/public/footer/zf/weixin.svg'),
  alipaySvg: join(ROOT, 'apps/web/public/footer/zf/zfb.svg'),
}

const argv = new Set(process.argv.slice(2))
const FORCE = argv.has('--force')
const MIRROR_WEB = argv.has('--mirror-web')
const WEB_PUBLIC = join(ROOT, 'apps/web/public')

// ── 色板 ────────────────────────────────────────────────────────────────────
const C = {
  navy: '#0F1E3D', navy2: '#16295B', ink: '#111827', blue: '#3B82F6', blue2: '#60A5FA',
  cyan: '#22D3EE', green: '#22C55E', gold: '#F59E0B', gold2: '#FBBF24', red: '#EF4444',
  white: '#FFFFFF', grey: '#9CA3AF', greyL: '#E5E7EB', silver: '#C0C7D1', bronze: '#CD7F32',
}
const FONT = 'Microsoft YaHei'

// ── AI 基图清单(staging,统一底部 10% 裁切去水印)──────────────────────────
const STAGING_FILES = {
  mascot: 'Friendly_cute_AI_robot_mascot__2026-10-14T05-43-52.png',       // 透明底吉祥物,无水印
  avatar: 'Cute_AI_robot_head_avatar_port_2026-10-14T05-43-53.png',
  bannerAgent: 'Wide_horizontal_banner_illustr_2026-10-14T05-44-01.png',
  bannerCourse: 'Wide_horizontal_banner_illustr_2026-10-14T05-43-53.png',
  bannerCommunity: 'Wide_horizontal_banner_illustr_2026-10-14T05-43-58.png',
  bannerService: 'Wide_horizontal_banner_illustr_2026-10-14T05-44-39.png',
  marketing1: 'Wide_horizontal_marketing_bann_2026-10-14T05-44-45.png',
  marketing2: 'Wide_horizontal_marketing_bann_2026-10-14T05-44-41.png',
  introTall: 'Vertical_tall_intro_page_illus_2026-10-14T05-45-02.png',
  recruit: 'Vertical_poster_illustration_f_2026-10-14T05-44-46.png',
  thinking: 'Illustration_of_AI_deep_thinki_2026-10-14T05-44-39.png',
  vipBg: 'Premium_membership_card_backgr_2026-10-14T05-44-43.png',
  welcome: 'Warm_welcome_greeting_illustra_2026-10-14T05-44-41.png',
  empty: 'Empty_state_placeholder_illust_2026-10-14T05-43-51.png',
}
const stage = (key) => join(STAGING, STAGING_FILES[key])

// ── 登记表提取(与 check-image-placeholders.mjs 同源判据)────────────────────
// 2026-10-14 修:原正则 `\((?:'([^']+)')\)` 要求 `(` 与 `'` 同行,漏掉**多行调用**
// (`aizhsUrl(\n  'sys-backs/...'\n)`,登记表里有 5 条)。改 `\(\s*'([^']+)'\s*,?\s*\)` 跨行匹配。
// 刻意**不按扩展名过滤**:非图片扩展名(.mp4)也要进清单,好让它们被点名"无源"(与尺子
// check-image-placeholders.mjs 的登记面口径一致);生成侧由 IMG_EXT_RE 挡,不会给 .mp4 写 PNG。
function extractRegistry() {
  const src = readFileSync(REGISTRY_TS, 'utf8')
  const urls = new Set()
  const re = /(?:bspappUrl|aizhsUrl)\(\s*'([^']+)'\s*,?\s*\)/g
  let m
  while ((m = re.exec(src))) urls.add(m[1].replace(/^\//, ''))
  return [...urls].sort()
}

/**
 * 全仓源码里 `aizhsUrl()/bspappUrl()` 引用的 URL(整文件扫描,跨行可匹配)。
 * 为什么不能只看登记表:页面直接写 `aizhsUrl('remote-images/qewm.png')` 这类**不经登记表**的
 * 调用(2026-10-14 实测 38 条),登记表看不见它们 ⇒ 源站没有 ⇒ 页面图裂。
 * **必须排除登记表自身**:它也是 `aizhsUrl(...)` 调用,算进来会把"仅登记表死登记项"误报成
 * "被活代码引用"(2026-10-14 实测:排除前 sys-backs 那条 jpg 被误标)。
 */
function extractCodeUrls() {
  const files = []
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'build' || e.name.startsWith('.')) continue
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(ts|tsx|js|jsx|vue)$/.test(e.name)) files.push(p)
    }
  }
  for (const d of ['apps/miniapp-taro/src', 'apps/web/src', 'packages']) walk(join(ROOT, d))
  const urls = new Set()
  const re = /(?:bspappUrl|aizhsUrl)\(\s*'([^']+)'\s*,?\s*\)/g
  for (const f of files) {
    if (f.endsWith('remote-icons.ts')) continue // 登记表自身不是"活代码引用"
    let s
    try { s = readFileSync(f, 'utf8') } catch { continue }
    let m
    while ((m = re.exec(s))) urls.add(m[1].replace(/^\//, '').replace(/\\/g, '/'))
  }
  return [...urls].sort()
}

/**
 * 显式别名:登记表里少数 URL 在原项目 CDN 上是独立文件、本地副本无同名项,但语义同类
 * (都是"扫码加微信/进群"槽位),而仓内唯一真码是 `images/qewm.png`。
 * 2026-10-14 实证:原型 `Ai-WXMiniVue` 的 `pagesA/index` 用 `home/ewm.png`、
 * `pagesA/recruitment`+`pagesA/carte` 用 `recruitment/ewm@2x.png`,旧 CDN 已失联;
 * 原型 `src/static/images/qewm.png` 与仓内副本 sha256 逐字节相同(证明副本即真源)。
 * 用真微信码替合成码:真码永远优于程序化生成的指向首页的占位码。
 */
const LOCAL_ALIASES = {
  'home/ewm.png': 'images/qewm.png',
  'recruitment/ewm@2x.png': 'images/qewm.png',
}

/** URL → 本地真图绝对路径(结构性命中:remote-images/ ↔ images/,tabbar/ 原样);无则 null。 */
function localAssetFor(rel) {
  const alias = LOCAL_ALIASES[rel]
  const candidates = []
  if (alias) candidates.push(join(LOCAL_ASSET_ROOT, alias))
  if (rel.startsWith('remote-images/')) candidates.push(join(LOCAL_ASSET_ROOT, 'images', rel.slice('remote-images/'.length)))
  candidates.push(join(LOCAL_ASSET_ROOT, rel))
  for (const c of candidates) if (existsSync(c) && statSync(c).isFile() && statSync(c).size > 0) return c
  return null
}

// ── SVG 线稿图标库(24×24 viewBox,stroke 风格)──────────────────────────────
const G = {
  'arrow-right': '<path d="M9 5l7 7-7 7"/>',
  'arrow-left': '<path d="M15 5l-7 7 7 7"/>',
  'arrow-down': '<path d="M5 9l7 7 7-7"/>',
  'arrow-up': '<path d="M5 15l7-7 7 7"/>',
  'chevron-right-sm': '<path d="M10 6l6 6-6 6"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  edit: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4 12l6 6L20 6"/>',
  'circle-check': '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
  'radio-off': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>',
  'radio-on': '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" opacity="0.15"/><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>',
  'search-plus': '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5M8 11h6M11 8v6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.4 3-6 7-6s7 2.6 7 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16.5 14.5c3 .3 5.5 2.4 5.5 5.5"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.5 11h-15L3 8z"/>',
  gem: '<path d="M7 3h10l4 6-9 12L3 9l4-6z"/><path d="M3 9h18M12 21L8.5 9l2-6M12 21l3.5-12-2-6"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M15.5 9.5c-.8-1-2-1.5-3.5-1.5-1.9 0-3 1-3 2.2 0 3 6.8 1.6 6.8 4.4 0 1.4-1.4 2.4-3.3 2.4-1.6 0-3-.6-3.8-1.7"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4z"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13"/><path d="M12 8S9.5 3 7 4.5 9 8 12 8s5.5-2 4-3.5S12 8 12 8z"/>',
  'credit-card': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  'arrow-down-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12l4 4 4-4M12 8v8"/>',
  chat: '<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
  headset: '<path d="M4 13a8 8 0 0 1 16 0"/><rect x="2.5" y="13" width="4" height="6" rx="1.6"/><rect x="17.5" y="13" width="4" height="6" rx="1.6"/><path d="M19.5 19a4 4 0 0 1-4 3h-2"/>',
  megaphone: '<path d="M3 10v4a1 1 0 0 0 1 1h3l7 4V5L7 9H4a1 1 0 0 0-1 1z"/><path d="M17.5 9a4 4 0 0 1 0 6M20 6.5a8 8 0 0 1 0 11"/>',
  'play': '<path d="M7 4.5l13 7.5-13 7.5v-15z"/>',
  'pause': '<rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10.5l6-3.5v10l-6-3.5"/>',
  music: '<circle cx="7" cy="18" r="3"/><circle cx="18" cy="15.5" r="3"/><path d="M10 18V6l11-2.5v12"/>',
  audio: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  file: '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z"/><path d="M14 2v5h5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  'text-doc': '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z"/><path d="M9 12h6M9 16h6M9 8h2"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 10h6M9 14h6"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z"/>',
  scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M4 12h16"/>',
  heart: '<path d="M12 21s-7.5-4.6-10-9.3C.5 8 3 4.5 6.5 4.5c2.2 0 4 1.3 5.5 3.2 1.5-1.9 3.3-3.2 5.5-3.2 3.5 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z"/>',
  'heart-fill': '<path d="M12 21s-7.5-4.6-10-9.3C.5 8 3 4.5 6.5 4.5c2.2 0 4 1.3 5.5 3.2 1.5-1.9 3.3-3.2 5.5-3.2 3.5 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z" fill="currentColor" stroke="none"/>',
  bookmark: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
  'bookmark-fill': '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" fill="currentColor" stroke="none"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="5.5" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  'menu-grid': '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pluscircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  location: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  phone: '<path d="M5 3h4l1.5 5-2.5 2a14 14 0 0 0 6 6l2-2.5 5 1.5v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z"/>',
  'graduation-cap': '<path d="M2 9l10-5 10 5-10 5L2 9z"/><path d="M6.5 11.5V16c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.5M21.5 9.5V15"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.4 1 2.3h6c0-.9.3-1.7 1-2.3A7 7 0 0 0 12 2z"/>',
  robot: '<rect x="5" y="8" width="14" height="11" rx="3"/><circle cx="9.5" cy="13" r="1.4" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13" r="1.4" fill="currentColor" stroke="none"/><path d="M12 8V4M12 4a1.6 1.6 0 1 0-.01-3.2A1.6 1.6 0 0 0 12 4zM9 19v2M15 19v2M2.5 12v4M21.5 12v4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  'move': '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
  'undo': '<path d="M3 8v5h5"/><path d="M3.5 12a9 9 0 1 1 3 6.7"/>',
  'history': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/><path d="M3.6 9H8V4.6"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 15 18 9z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>',
  tag: '<path d="M20.6 13.4L12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/>',
  rocket: '<path d="M12 15c-2 0-5-1-5-1s1.5-8.5 5-11c3.5 2.5 5 11 5 11s-3 1-5 1z"/><path d="M7 14l-3 6 6-3M17 14l3 6-6-3"/><circle cx="12" cy="8" r="1.6"/>',
  key: '<circle cx="8" cy="15" r="4.5"/><path d="M11.5 11.5L21 2M16 7l3 3M13.5 9.5l2 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5V12c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5"/><path d="M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>',
  layers: '<path d="M12 2L2 8l10 6 10-6-10-6z"/><path d="M2 13l10 6 10-6M2 17.5L12 23l10-5.5"/>',
  fire: '<path d="M12 22c4.4 0 7.5-2.8 7.5-7 0-3.5-2.5-6-4.5-8.5-.6 2-1.5 3-3 3.5C12.5 7.5 13 4 10 2c.5 3.5-1.5 5-3.5 7.5S4.5 13.5 4.5 15c0 4.2 3.1 7 7.5 7z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
}

function iconSvg(glyph, { size = 96, color = C.ink, stroke = 1.8, bg = 'transparent', bgRadius = 0 } = {}) {
  const body = G[glyph] ?? G.sparkles
  const inner = bg === 'transparent'
    ? ''
    : `<rect width="24" height="24" rx="${bgRadius || 5}" fill="${bg}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${inner}<g fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`
}

// ── 徽章(圆角矩形 + 中文/数字文字)─────────────────────────────────────────
function badgeSvg({ w = 140, h = 56, text = '', from = C.blue, to = C.navy, radius = 12, fontSize = 26 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" rx="${radius}" fill="url(#g)"/>
  <text x="${w / 2}" y="${h / 2 + fontSize * 0.36}" font-family="${FONT}" font-weight="bold" font-size="${fontSize}" fill="#fff" text-anchor="middle">${text}</text>
</svg>`
}

// ── 数字封面(课程星球 1-11)────────────────────────────────────────────────
const COVER_HUES = [210, 25, 160, 265, 340, 45, 190, 120, 285, 10, 230] // 禁紫:265/285 用蓝青替代
const COVER_SAFE_HUES = [210, 25, 160, 205, 340, 45, 190, 120, 195, 10, 230]
function coverSvg(n, i, size = 240) {
  const h = COVER_SAFE_HUES[(i - 1) % COVER_SAFE_HUES.length]
  const h2 = (h + 40) % 360
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},72%,52%)"/><stop offset="1" stop-color="hsl(${h2},70%,38%)"/></linearGradient></defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <circle cx="${size * 0.78}" cy="${size * 0.22}" r="${size * 0.16}" fill="#fff" opacity="0.14"/>
  <circle cx="${size * 0.2}" cy="${size * 0.82}" r="${size * 0.24}" fill="#fff" opacity="0.10"/>
  <circle cx="${size / 2}" cy="${size * 0.42}" r="${size * 0.2}" fill="none" stroke="#fff" stroke-width="${size * 0.02}" opacity="0.85"/>
  <ellipse cx="${size / 2}" cy="${size * 0.46}" rx="${size * 0.3}" ry="${size * 0.07}" fill="none" stroke="#fff" stroke-width="${size * 0.015}" opacity="0.7" transform="rotate(-18 ${size / 2} ${size * 0.46})"/>
  <text x="${size / 2}" y="${size * 0.52}" font-family="${FONT}" font-weight="bold" font-size="${size * 0.22}" fill="#fff" text-anchor="middle">${n}</text>
</svg>`
}

// ── 渐变功能瓦片(plaza_icon 等)─────────────────────────────────────────────
function tileSvg(glyph, i, size = 120) {
  const hues = [210, 160, 25, 195, 340, 45, 120, 205, 10, 230, 190, 90, 35, 215]
  const h = hues[i % hues.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},75%,55%)"/><stop offset="1" stop-color="hsl(${(h + 35) % 360},70%,42%)"/></linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#g)"/>
  <g transform="translate(${size * 0.22} ${size * 0.22}) scale(${size / 24 * 0.56})"><g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${G[glyph] ?? G.sparkles}</g></g>
</svg>`
}

// ── 渐变背景(750 宽系)──────────────────────────────────────────────────────
function bgSvg({ w = 750, h = 400, hue = 214, blobs = 3, radius = 0 } = {}) {
  let deco = ''
  const rand = (n) => ((Math.sin(n * 127.1) * 43758.5453) % 1 + 1) % 1
  for (let i = 0; i < blobs; i++) {
    deco += `<circle cx="${(rand(i + 1) * w).toFixed(0)}" cy="${(rand(i + 9) * h).toFixed(0)}" r="${(h * (0.18 + rand(i + 3) * 0.2)).toFixed(0)}" fill="#fff" opacity="0.07"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="${w * 0.6}" y2="${h}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="hsl(${hue},58%,26%)"/><stop offset="1" stop-color="hsl(${(hue + 25) % 360},52%,13%)"/></linearGradient></defs>
  <rect width="${w}" height="${h}" rx="${radius}" fill="url(#g)"/>${deco}
</svg>`
}

// ── 步骤圆(3_01-3_03)───────────────────────────────────────────────────────
function stepSvg(n, size = 220) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.navy}"/></linearGradient></defs>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.46}" fill="none" stroke="url(#g)" stroke-width="${size * 0.045}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.33}" fill="url(#g)"/>
  <text x="${size / 2}" y="${size * 0.62}" font-family="${FONT}" font-weight="bold" font-size="${size * 0.3}" fill="#fff" text-anchor="middle">${n}</text>
</svg>`
}

// ── 排名徽章 ────────────────────────────────────────────────────────────────
function rankSvg(n, color, size = 120) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${C.navy}"/></linearGradient></defs>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.44}" fill="url(#g)"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.35}" fill="none" stroke="#fff" stroke-width="${size * 0.02}" opacity="0.8"/>
  <text x="${size / 2}" y="${size * 0.64}" font-family="${FONT}" font-weight="bold" font-size="${size * 0.34}" fill="#fff" text-anchor="middle">${n}</text>
</svg>`
}

// ── 按钮(绿确认/灰取消/渐变底)─────────────────────────────────────────────
function buttonSvg({ w = 320, h = 96, text = '', from, to, radius = 48 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" rx="${radius}" fill="url(#g)"/>
  ${text ? `<text x="${w / 2}" y="${h / 2 + 12}" font-family="${FONT}" font-weight="bold" font-size="34" fill="#fff" text-anchor="middle">${text}</text>` : ''}
</svg>`
}

// ── 写盘工具 ────────────────────────────────────────────────────────────────
async function writeOut(rel, buf) {
  const out = join(SERVER_ROOT, rel)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, buf)
  if (MIRROR_WEB) {
    const webOut = join(WEB_PUBLIC, rel)
    if (existsSync(dirname(webOut))) writeFileSync(webOut, buf)
  }
}

async function renderSvg(svg, rel) {
  const buf = await sharp(Buffer.from(svg), { density: 300 }).png().toBuffer()
  await writeOut(rel, buf)
}

async function renderSvgJpg(svg, rel, quality = 88) {
  const buf = await sharp(Buffer.from(svg), { density: 300 }).flatten({ background: C.navy }).jpeg({ quality }).toBuffer()
  await writeOut(rel, buf)
}

async function aiCrop(key, w, h, out, { jpg = false, cutBottom = 0.10, quality = 88 } = {}) {
  const src = stage(key)
  const meta = await sharp(src).metadata()
  const cutH = STAGING_FILES.mascot === STAGING_FILES[key] ? 0 : Math.round(meta.height * cutBottom)
  let pipe = sharp(src).extract({ left: 0, top: 0, width: meta.width, height: meta.height - cutH })
    .resize(w, h, { fit: 'cover', position: 'centre' })
  const buf = jpg
    ? await pipe.flatten({ background: C.navy }).jpeg({ quality }).toBuffer()
    : await pipe.png().toBuffer()
  await writeOut(out, buf)
}

async function qrPng(text, size) {
  const buf = await QRCode.toBuffer(text, { width: size, margin: 1, color: { dark: C.ink, light: '#FFFFFF' } })
  return buf
}

// ── 规格:路径 → 生成动作 ───────────────────────────────────────────────────
// kind: icon | badge | cover | tile | bg | bgjpg | step | rank | button | qr | brand | ai | derivedIcon
const SPECS = {}
function spec(rel, kind, opts = {}) { SPECS[rel] = { kind, ...opts } }

// —— 横幅 / 插画(AI 基图派生,格式沿用登记表后缀)——
spec('tabbar/home/carousel4-footer1/carousel1.jpg', 'ai', { key: 'bannerCourse', w: 900, h: 360, jpg: true })
spec('tabbar/home/carousel4-footer1/carousel2.jpg', 'ai', { key: 'bannerCommunity', w: 900, h: 360, jpg: true })
spec('tabbar/home/carousel4-footer1/carousel3.jpg', 'ai', { key: 'bannerService', w: 900, h: 360, jpg: true })
spec('tabbar/home/carousel4-footer1/lunbo1.png', 'ai', { key: 'marketing1', w: 900, h: 360 })
spec('tabbar/home/carousel4-footer1/lunbo2.png', 'ai', { key: 'marketing2', w: 900, h: 360 })
spec('tabbar/home/carousel4-footer1/carousel4-footer1-two.png', 'ai', { key: 'bannerAgent', w: 900, h: 360 })
spec('tabbar/home/carousel4-footer1/BottomFigure.png', 'ai', { key: 'mascot', w: 600, h: 600 })
spec('tabbar/ai_agent/lunbo6.jpg', 'ai', { key: 'bannerAgent', w: 900, h: 380, jpg: true })
spec('tabbar/ai_agent/jiqiren-big.png', 'ai', { key: 'mascot', w: 640, h: 640 })
spec('tabbar/home/second/jiqiren-big.png', 'ai', { key: 'mascot', w: 640, h: 640 })
spec('tabbar/home/second/jiqiren.png', 'ai', { key: 'mascot', w: 320, h: 320 })
spec('tabbar/ai_agent/user-avatar.png', 'ai', { key: 'avatar', w: 240, h: 240 })
spec('tabbar/home/second/user-avatar.jpg', 'ai', { key: 'avatar', w: 240, h: 240, jpg: true })
spec('sys-mini/jieshaoye.jpg', 'ai', { key: 'introTall', w: 750, h: 1334, jpg: true })
spec('recruitment/recruit2.png', 'ai', { key: 'recruit', w: 750, h: 480 })
spec('recruitment/recruit3.png', 'ai', { key: 'recruit', w: 750, h: 480, jpg: true, jpgName: 'recruitment/recruit3.png' })
spec('recruitment/bigtp@2x.png', 'ai', { key: 'marketing1', w: 1200, h: 600 })
spec('recruitment/xuancai@2x.png', 'ai', { key: 'recruit', w: 750, h: 400 })
spec('remote-images/empty.png', 'ai', { key: 'empty', w: 480, h: 480 })
spec('sys-mini/Emphty.png', 'ai', { key: 'empty', w: 480, h: 480 })
spec('remote-images/sikao.png', 'ai', { key: 'thinking', w: 480, h: 480 })
spec('remote-images/sikao_active.png', 'ai', { key: 'thinking', w: 480, h: 480 })
spec('remote-images/sikao_icon.png', 'ai', { key: 'thinking', w: 240, h: 240 })
spec('remote-images/vip_back.png', 'ai', { key: 'vipBg', w: 750, h: 500 })
spec('sys-mini/xtk/Welcome.png', 'ai', { key: 'welcome', w: 750, h: 420 })
spec('tabbar/ai_agent/背景和logo.png', 'ai', { key: 'bannerAgent', w: 750, h: 500 })
spec('tabbar/ai_agent/12071746256773_.pic.jpg', 'ai', { key: 'bannerService', w: 750, h: 420, jpg: true })
spec('remote-images/tixian.jpg', 'ai', { key: 'marketing1', w: 750, h: 420, jpg: true })
spec('remote-images/celance.jpg', 'ai', { key: 'bannerCourse', w: 750, h: 420, jpg: true })
spec('remote-images/cps.jpg', 'ai', { key: 'marketing2', w: 750, h: 420, jpg: true })
spec('remote-images/shar.jpg', 'ai', { key: 'bannerCommunity', w: 750, h: 420, jpg: true })
spec('remote-images/fl.pic.jpg', 'ai', { key: 'bannerService', w: 750, h: 420, jpg: true })
spec('remote-images/userIcon.jpg', 'ai', { key: 'avatar', w: 240, h: 240, jpg: true })
spec('remote-images/xiugai.jpg', 'ai', { key: 'welcome', w: 750, h: 400, jpg: true })
spec('remote-images/appenda.png', 'ai', { key: 'bannerCommunity', w: 750, h: 360 })
spec('sys-mini/WechatIMG54.png', 'ai', { key: 'bannerService', w: 600, h: 400 })
spec('sys-backs/2025/09/24/391_42_20250924094836A218.png', 'ai', { key: 'introTall', w: 600, h: 800 })
spec('tabbar/tabbar/_20250418212023.png', 'ai', { key: 'bannerAgent', w: 600, h: 300 })
spec('tabbar/tabbar/_20250418221944.png', 'ai', { key: 'bannerCourse', w: 600, h: 300 })

// —— 程序化背景 ——
spec('card/background.png', 'bg', { w: 750, h: 560, hue: 214 })
spec('sys-mini/dd-bg.png', 'bg', { w: 750, h: 240, hue: 214, radius: 24 })
spec('sys-mini/default/huodongBG.png', 'bg', { w: 750, h: 480, hue: 25 })
spec('yongjin/mxbackground.png', 'bg', { w: 750, h: 460, hue: 45 })
spec('yongjin/juxing5Copy2@2x.png', 'bg', { w: 700, h: 300, hue: 214, radius: 20 })
spec('remote-images/user-bg.png', 'bg', { w: 750, h: 520, hue: 214 })
spec('remote-images/backf2.png', 'bg', { w: 750, h: 400, hue: 205 })
spec('remote-images/tishi_back.png', 'bg', { w: 680, h: 240, hue: 40, radius: 20 })
spec('remote-images/tixian.jpg'.replace('.png', '.jpg'), 'bgjpg', { w: 750, h: 400, hue: 45 })
spec('sys-mini/default/sdh_back.jpg', 'bgjpg', { w: 750, h: 480, hue: 214 })
spec('sys-mini/default/mingpian.jpg', 'bgjpg', { w: 680, h: 400, hue: 214 })
spec('sys-mini/xgzt.jpg', 'bgjpg', { w: 750, h: 400, hue: 205 })
spec('remote-images/default/mingpian.png', 'bg', { w: 680, h: 400, hue: 214, radius: 20 })
spec('remote-images/space_one.png', 'bg', { w: 600, h: 300, hue: 214, radius: 20 })
spec('remote-images/space_two.png', 'bg', { w: 600, h: 300, hue: 160, radius: 20 })
spec('remote-images/xtk/model_card_btn_bg.png', 'bg', { w: 600, h: 160, hue: 214, radius: 20 })
spec('remote-images/yejiao.png', 'bg', { w: 750, h: 200, hue: 214 })
spec('sys-mini/123444456.png', 'bg', { w: 600, h: 400, hue: 214, radius: 20 })

// —— 二维码(真码,统一指向 https://aizhs.top;待真实数据替换,报告注明)——
spec('home/ewm.png', 'qr', { size: 400 })
spec('recruitment/ewm@2x.png', 'qr', { size: 500 })
spec('remote-images/erweima.png', 'qr', { size: 500 })
spec('remote-images/saomaa.jpg', 'qrjpg', { size: 600 })
spec('tabbar/coursePlanet/微信图片_20250419152536.png', 'qr', { size: 500 })
spec('remote-images/sqb_20250816161049A277.png', 'qr', { size: 500 })
spec('remote-images/qqb_20250816161046A276.png', 'qr', { size: 500 })
spec('remote-images/szdy_20250816161421A290.png', 'qr', { size: 500 })
spec('remote-images/qzdy_20250816161419A289.png', 'qr', { size: 500 })
spec('remote-images/erweima-icon.png', 'icon', { glyph: 'qr', size: 96 })

// —— 厂牌(仓内官方 SVG 资产,不伪造)——
spec('sys-mini/default/wechat.png', 'brand', { src: 'wechatSvg', size: 96 })
spec('sys-mini/xtk/wx_icon.png', 'brand', { src: 'wechatSvg', size: 96 })
spec('user/wxfb.png', 'brand', { src: 'wechatSvg', size: 96 })
spec('user/zfb.png', 'brand', { src: 'alipaySvg', size: 96 })
spec('sys-mini/default/wallet.png', 'icon', { glyph: 'wallet' })
spec('sys-mini/wallet-zf.png', 'icon', { glyph: 'wallet', color: C.blue })
spec('sys-mini/xtk/wx_wallet.png', 'icon', { glyph: 'wallet', color: C.green })
spec('remote-images/n8n.png', 'icon', { glyph: 'gear', color: C.green })

// —— 徽章(中文/ASCII 文字)——
spec('remote-images/vip_label.png', 'badge', { text: 'VIP', from: C.gold, to: '#B45309' })
spec('remote-images/yue_label.png', 'badge', { text: '月卡', from: C.blue, to: C.navy })
spec('remote-images/xian_label.png', 'badge', { text: '限时', from: C.red, to: '#B91C1C' })
spec('remote-images/mian_label.png', 'badge', { text: '免费', from: C.green, to: '#15803D' })
spec('remote-images/yibuy_label.png', 'badge', { text: '已购', from: '#6B7280', to: '#374151' })
spec('remote-images/default/mian_label.png', 'badge', { text: '免费', from: C.green, to: '#15803D' })
spec('remote-images/useNum.png', 'badge', { text: '次卡', from: C.blue, to: C.navy })
spec('remote-images/hot.png', 'badge', { text: 'HOT', from: C.red, to: '#B91C1C', w: 96, h: 44, fontSize: 24 })
spec('remote-images/new.png', 'badge', { text: 'NEW', from: C.green, to: '#15803D', w: 96, h: 44, fontSize: 24 })
spec('remote-images/bjcspNew.png', 'badge', { text: 'NEW', from: C.gold, to: '#B45309', w: 96, h: 44, fontSize: 24 })
spec('remote-images/xtk/new.png', 'badge', { text: 'NEW', from: C.red, to: '#B91C1C', w: 96, h: 44, fontSize: 24 })
spec('remote-images/rankone.png', 'rank', { n: 1, color: C.gold })
spec('remote-images/ranktwo.png', 'rank', { n: 2, color: C.silver })
spec('remote-images/rankthree.png', 'rank', { n: 3, color: C.bronze })
spec('remote-images/default/rankone.png', 'rank', { n: 1, color: C.gold })

// —— 步骤圆 ——
spec('remote-images/3_01.png', 'step', { n: 1 })
spec('remote-images/3_02.png', 'step', { n: 2 })
spec('remote-images/3_03.png', 'step', { n: 3 })

// —— 课程星球封面 ——
for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) spec(`tabbar/coursePlanet/${n}.png`, 'cover', { n, i: n })

// —— 广场功能瓦片 ——
const PLAZA_GLYPHS = ['robot', 'chat', 'music', 'video', 'graduation-cap', 'file', 'image', 'text-doc', 'briefcase', 'chart', 'bulb', 'globe', 'layers', 'sparkles']
for (const k of ['01', '02', '03', '04', '11', '12', '13', '14']) {
  const idx = Number(k) - 1
  spec(`sys-mini/xtk/plaza_icon${k}.png`, 'tile', { glyph: PLAZA_GLYPHS[idx % PLAZA_GLYPHS.length], i: idx })
}

// —— 按钮底 ——
spec('sys-mini/xtk/wx_btn_yes.png', 'button', { text: '确认', from: C.green, to: '#15803D' })
spec('sys-mini/xtk/wx_btn_no.png', 'button', { text: '取消', from: '#9CA3AF', to: '#4B5563' })
spec('remote-images/default/rechargebtn.png', 'button', { from: C.gold, to: '#B45309', text: '充值' })
spec('remote-images/fuyong_btn.png', 'button', { from: C.blue, to: C.navy, text: '复用' })
spec('sys-mini/xtk/userinfo_btn_bg.png', 'button', { from: C.blue, to: C.navy })
spec('sys-mini/xtk/model_income_btn_bg.png', 'button', { from: C.gold, to: '#B45309' })

// —— 表单图标(set_need_*)——
spec('sys-mini/xtk/set_need_addimage.png', 'icon', { glyph: 'image' })
spec('sys-mini/xtk/set_need_image.png', 'icon', { glyph: 'image' })
spec('sys-mini/xtk/set_need_money.png', 'icon', { glyph: 'coin' })
spec('sys-mini/xtk/set_need_select_down.png', 'icon', { glyph: 'arrow-down' })
spec('sys-mini/xtk/set_need_text.png', 'icon', { glyph: 'text-doc' })
spec('sys-mini/xtk/set_need_time.png', 'icon', { glyph: 'clock' })
spec('sys-mini/xtk/set_need_time_end.png', 'icon', { glyph: 'clock', color: C.grey })
spec('sys-mini/xtk/set_need_work.png', 'icon', { glyph: 'briefcase' })

// —— 学习图标(study_*)——
spec('sys-mini/xtk/study_comment_info.png', 'icon', { glyph: 'chat' })
spec('sys-mini/xtk/study_icon_add_grad.png', 'icon', { glyph: 'pluscircle', color: C.blue })
spec('sys-mini/xtk/study_icon_blink.png', 'icon', { glyph: 'sparkles', color: C.gold })
spec('sys-mini/xtk/study_icon_playing.png', 'icon', { glyph: 'play', color: C.blue })
spec('sys-mini/xtk/study_icon_right_end.png', 'icon', { glyph: 'check', color: C.green })
spec('sys-mini/xtk/study_icon_tip.png', 'icon', { glyph: 'bell', color: C.gold })
spec('sys-mini/xtk/study_icon_video.png', 'icon', { glyph: 'video' })
spec('remote-images/study_icon_right.png', 'icon', { glyph: 'arrow-right' })
spec('remote-images/video_icon.png', 'icon', { glyph: 'video' })
spec('remote-images/icon-yinpin.png', 'icon', { glyph: 'audio' })

// —— AI 功能图标(xtk ai*)——
spec('sys-mini/xtk/ai2.png', 'icon', { glyph: 'sparkles', color: C.blue })
spec('sys-mini/xtk/aiBk.png', 'bg', { w: 400, h: 240, hue: 214, radius: 20 })
spec('sys-mini/xtk/aimove.png', 'icon', { glyph: 'move' })
spec('sys-mini/xtk/aimusic.png', 'icon', { glyph: 'music' })
spec('sys-mini/xtk/aiText.png', 'icon', { glyph: 'text-doc' })
spec('sys-mini/xtk/aiWork.png', 'icon', { glyph: 'briefcase' })

// —— 模型图标 ——
spec('remote-images/model.png', 'icon', { glyph: 'layers' })
spec('remote-images/model_active.png', 'icon', { glyph: 'layers', color: C.blue })
spec('sys-mini/xtk/my_model.png', 'icon', { glyph: 'layers' })
spec('sys-mini/xtk/my_model_delete.png', 'icon', { glyph: 'trash', color: C.red })
spec('sys-mini/xtk/model_edit_down.png', 'icon', { glyph: 'arrow-down' })
spec('sys-mini/xtk/model_edit_helf.png', 'icon', { glyph: 'undo' })
spec('sys-mini/xtk/model_edit_yes.png', 'icon', { glyph: 'circle-check', color: C.green })
spec('sys-mini/xtk/model_edit_yuan.png', 'icon', { glyph: 'undo', color: C.blue })
spec('sys-mini/xtk/model_income_icon_form.png', 'icon', { glyph: 'clipboard' })
spec('sys-mini/xtk/model_income_right.png', 'icon', { glyph: 'arrow-right', color: C.blue })
spec('sys-mini/xtk/my_input.png', 'icon', { glyph: 'edit' })
spec('sys-mini/xtk/textareaOpen.png', 'icon', { glyph: 'edit' })
spec('sys-mini/penicon.png', 'icon', { glyph: 'edit' })
spec('sys-mini/xiugai.png', 'icon', { glyph: 'edit' })
spec('sys-mini/xtk/image_or.png', 'icon', { glyph: 'image', color: C.gold })

// —— 箭头 / 导航 ——
const ARROWS = {
  'tabbar/home/zhong/right-arrow.png': ['chevron-right-sm', {}],
  'tabbar/home/xia/right-arrow.png': ['chevron-right-sm', {}],
  'tabbar/home/zhongxia/right-arrow.png': ['chevron-right-sm', {}],
  'tabbar/home/second/right.png': ['chevron-right-sm', {}],
  'tabbar/coursePlanet/right.png': ['chevron-right-sm', {}],
  'user/right.png': ['chevron-right-sm', {}],
  'user/左.png': ['arrow-left', {}],
  'tabbar/coursePlanet/下.png': ['arrow-down', {}],
  'remote-images/back.svg': ['arrow-left', {}],
  'remote-images/search-shang.png': ['arrow-up', {}],
  'sys-mini/xiala.png': ['arrow-down', {}],
  'sys-mini/xtk/cancel.png': ['close', {}],
  'remote-images/close_input.png': ['close', {}],
  'remote-images/close_agent.png': ['close', { color: C.grey }],
  'sys-mini/privateback.png': ['arrow-left', {}],
  'remote-images/default/back_hudie.png': ['arrow-left', {}],
  'tabbar/home/zhong/backA.png': ['arrow-left', { color: C.blue }],
  'sys-mini/search-shang.png': ['arrow-up', {}],
}
for (const [p, [glyph, o]] of Object.entries(ARROWS)) spec(p, 'icon', { glyph, size: 64, ...o })
spec('remote-images/search.svg', 'icon', { glyph: 'search', size: 64 })
spec('remote-images/search-add.png', 'icon', { glyph: 'search-plus', size: 64 })
spec('remote-images/add_kf.png', 'icon', { glyph: 'headset', size: 96 })
spec('remote-images/copy.png', 'icon', { glyph: 'copy', size: 64 })
spec('remote-images/download.png', 'icon', { glyph: 'download', size: 64 })
spec('remote-images/play.svg', 'icon', { glyph: 'play', size: 64, color: C.blue })
spec('remote-images/pause.svg', 'icon', { glyph: 'pause', size: 64, color: C.blue })

// —— 会员/权益 ——
spec('remote-images/king.png', 'icon', { glyph: 'crown', color: C.gold })
spec('remote-images/userVip_nor.png', 'icon', { glyph: 'gem', color: C.ink })
spec('remote-images/buymonth_icon.png', 'icon', { glyph: 'calendar', color: C.blue })
spec('remote-images/free_time_icon.png', 'icon', { glyph: 'clock', color: C.green })
spec('remote-images/free_use_icon.png', 'icon', { glyph: 'sparkles', color: C.green })
spec('remote-images/free_vip_icon.png', 'icon', { glyph: 'gem', color: C.gold })
spec('remote-images/hasbuy_icon.png', 'icon', { glyph: 'circle-check', color: C.green })
spec('remote-images/vip_back.png', 'ai', { key: 'vipBg', w: 750, h: 500 })
spec('remote-images/shoucang.png', 'icon', { glyph: 'bookmark' })
spec('remote-images/choucang_active.png', 'icon', { glyph: 'bookmark-fill', color: C.gold })
spec('remote-images/like.png', 'icon', { glyph: 'heart' })
spec('remote-images/like_active.png', 'icon', { glyph: 'heart-fill', color: C.red })

// —— 分销/佣金 ——
spec('remote-images/fenxiao-icon.png', 'icon', { glyph: 'users', color: C.blue })
spec('remote-images/tuandui-icon.png', 'icon', { glyph: 'users', color: C.blue })
spec('remote-images/geren-icon.png', 'icon', { glyph: 'user', color: C.blue })
spec('remote-images/shouru-icon.png', 'icon', { glyph: 'chart', color: C.green })
spec('yongjin/money.png', 'icon', { glyph: 'coin', color: C.gold })
spec('yongjin/date.png', 'icon', { glyph: 'calendar' })
spec('yongjin/qz.png', 'icon', { glyph: 'gem', color: C.gold })
spec('tabbar/home/xia/commission.png', 'icon', { glyph: 'coin', color: C.gold })

// —— 内容/功能 ——
spec('remote-images/knowledge-icon.png', 'icon', { glyph: 'graduation-cap', color: C.blue })
spec('remote-images/course-icon.png', 'icon', { glyph: 'graduation-cap' })
spec('remote-images/ai-icon.png', 'icon', { glyph: 'sparkles', color: C.blue })
spec('remote-images/icon1.png', 'icon', { glyph: 'sparkles', color: C.green })
spec('remote-images/file.png', 'icon', { glyph: 'file' })
spec('remote-images/agentshare.png', 'icon', { glyph: 'share', color: C.blue })
spec('remote-images/new_share.png', 'icon', { glyph: 'share', color: C.green })
spec('remote-images/drawer_menu4.png', 'icon', { glyph: 'menu-grid' })
spec('remote-images/pt-head.png', 'ai', { key: 'avatar', w: 200, h: 200 })
spec('remote-images/tishi_icon.png', 'icon', { glyph: 'bell', color: C.gold })
spec('remote-images/daixaodiming.png', 'icon', { glyph: 'rocket', color: C.blue })
spec('remote-images/danshuzhiq.png', 'icon', { glyph: 'chart', color: C.blue })
spec('remote-images/soamazixun.png', 'icon', { glyph: 'scan', color: C.blue })
spec('sys-mini/caopanshouqy.png', 'icon', { glyph: 'shield', color: C.blue })
spec('sys-mini/privateadvisory.png', 'icon', { glyph: 'headset', color: C.blue })
spec('sys-mini/lingqu.png', 'icon', { glyph: 'gift', color: C.gold })
spec('sys-mini/wenjuan.png', 'icon', { glyph: 'clipboard', color: C.blue })
spec('sys-mini/team1.png', 'icon', { glyph: 'users' })
spec('sys-mini/home-icon.png', 'icon', { glyph: 'home', color: C.blue })
spec('sys-mini/fasong.png', 'icon', { glyph: 'send', color: C.blue })
spec('sys-mini/default/home/send.png', 'icon', { glyph: 'send', color: C.blue })
spec('tabbar/home/xia/Forward.png', 'icon', { glyph: 'share' })
spec('tabbar/home/xia/message.png', 'icon', { glyph: 'chat' })
spec('tabbar/home/xia/KnowledgePlanet.png', 'icon', { glyph: 'graduation-cap', color: C.blue })
spec('tabbar/home/xia/popular-courser.png', 'icon', { glyph: 'fire', color: C.red })
spec('tabbar/home/zhongxia/popular-courser.png', 'icon', { glyph: 'fire', color: C.red })
spec('tabbar/home/zhongxia/popular-courses-nav.png', 'icon', { glyph: 'graduation-cap', color: C.blue })
spec('tabbar/home/zhong/ai-video.png', 'icon', { glyph: 'video', color: C.blue })
spec('tabbar/home/zhong/aizhinengshe.png', 'icon', { glyph: 'robot', color: C.blue })
spec('tabbar/home/zhong/custom-made.png', 'icon', { glyph: 'gear', color: C.blue })
spec('tabbar/course/fufei.png', 'icon', { glyph: 'gem', color: C.gold })
spec('user/act.png', 'icon', { glyph: 'gift', color: C.gold })
spec('user/topup.png', 'icon', { glyph: 'arrow-down-circle', color: C.green })
spec('user/删除.png', 'icon', { glyph: 'trash', color: C.red })
spec('sys-mini/xtk/dev_copy.png', 'icon', { glyph: 'copy' })
spec('sys-mini/xtk/devlogo.png', 'icon', { glyph: 'shield', color: C.blue })
spec('sys-mini/xtk/iHuiInfAI.png', 'icon', { glyph: 'sparkles', color: C.blue })
spec('sys-mini/xtk/enter_page.png', 'icon', { glyph: 'arrow-right', color: C.blue })
spec('sys-mini/xtk/bumen2.png', 'icon', { glyph: 'users', color: C.blue })
spec('sys-mini/default/bumen.png', 'icon', { glyph: 'users', color: C.blue })
spec('sys-mini/default/gold.png', 'icon', { glyph: 'coin', color: C.gold })
spec('sys-mini/default/gold_active.png', 'icon', { glyph: 'coin', color: C.gold })
spec('sys-mini/default/userVip_act.png', 'icon', { glyph: 'gem', color: C.gold })
spec('sys-mini/default/ljkt_icon.png', 'icon', { glyph: 'play', color: C.blue })
spec('sys-mini/default/select.png', 'icon', { glyph: 'radio-off', size: 64 })
spec('sys-mini/default/selected.png', 'icon', { glyph: 'radio-on', size: 64, color: C.blue })
spec('sys-mini/default/xing.png', 'icon', { glyph: 'star', color: C.gold })
spec('sys-mini/default/zuan.png', 'icon', { glyph: 'gem', color: C.blue })
spec('sys-mini/default/zuan_title.png', 'icon', { glyph: 'gem', color: C.blue })
spec('sys-mini/default/aihui.png', 'icon', { glyph: 'sparkles', color: C.blue })
spec('sys-mini/xtk/company.png', 'icon', { glyph: 'briefcase', color: C.blue })
spec('sys-mini/xtk/cash.png', 'icon', { glyph: 'credit-card', color: C.green })
spec('sys-mini/xtk/plaza_win_left.png', 'bg', { w: 120, h: 320, hue: 214, radius: 16 })
spec('sys-mini/xtk/plaza_win_right.png', 'bg', { w: 120, h: 320, hue: 205, radius: 16 })
spec('sys-mini/xtk/dev_pay_boder_nomal.png', 'bg', { w: 320, h: 96, hue: 214, radius: 16 })
spec('sys-mini/xtk/dev_pay_border_color.png', 'bg', { w: 320, h: 96, hue: 25, radius: 16 })
spec('sys-mini/xtk/dev_pay_border_image.png', 'bg', { w: 320, h: 96, hue: 160, radius: 16 })
spec('sys-mini/xtk/dev_pay_icon.png', 'icon', { glyph: 'credit-card', color: C.gold })
spec('sys-mini/xtk/headertitley.png'.replace('xtk/', 'xtk/'), 'badge', { text: 'AI', from: C.blue, to: C.navy, w: 280, h: 90, fontSize: 40, radius: 18 })
spec('remote-images/headertitley.png', 'badge', { text: 'AI', from: C.blue, to: C.navy, w: 280, h: 90, fontSize: 40, radius: 18 })
spec('remote-images/headertitlet.png', 'badge', { text: 'AI', from: C.ink, to: '#374151', w: 280, h: 90, fontSize: 40, radius: 18 })
spec('remote-images/guanlogo.png', 'icon', { glyph: 'shield', color: C.blue })
spec('remote-images/wirelesslogo.png', 'icon', { glyph: 'globe', color: C.blue })
spec('remote-images/xizi-logo.jpg', 'icon', { glyph: 'sparkles', color: C.blue })
spec('remote-images/xtk/logo.png', 'icon', { glyph: 'sparkles', color: C.blue })
spec('remote-images/Vector.png', 'icon', { glyph: 'arrow-right', size: 64, color: C.blue })
spec('remote-images/Ellipse.png', 'icon', { glyph: 'smile', size: 64, color: C.blue })
spec('remote-images/20250530152648.png', 'bg', { w: 600, h: 400, hue: 214, radius: 20 })
spec('remote-images/text-tip.jpg', 'bgjpg', { w: 600, h: 240, hue: 40 })
spec('distribution/图标', 'icon', { glyph: 'users', color: C.blue })
spec('remote-images/empty.png', 'ai', { key: 'empty', w: 480, h: 480 })

// —— tabbar(tab 图)——
spec('tabbar/tabbar/home.png', 'icon', { glyph: 'home', size: 96, color: C.blue })
spec('tabbar/tabbar/2.png', 'icon', { glyph: 'graduation-cap', size: 96 })
spec('tabbar/tabbar/3.png', 'icon', { glyph: 'robot', size: 96 })
spec('tabbar/tabbar/4.png', 'icon', { glyph: 'chat', size: 96 })
spec('tabbar/tabbar/5.png', 'icon', { glyph: 'users', size: 96 })
spec('tabbar/tabbar/6.png', 'icon', { glyph: 'gem', size: 96 })
spec('tabbar/tabbar/7.png', 'icon', { glyph: 'user', size: 96 })

// —— 结构性怪路径补丁(2026-10-14 现读实测:无扩展名 / 双斜杠 —— 文件系统与 HTTP 语义下
//    双斜杠折叠为单斜杠,写盘仍有真实价值;尺子按扩展名过滤,这 7 张不计入其判定,
//    `sys-center/default/statis/` 是尾斜杠目录 URL,结构上无法成为文件,跳过)——
spec('distribution/图标', 'icon', { glyph: 'menu-grid', color: C.blue })
spec('distribution/文档', 'icon', { glyph: 'file', color: C.blue })
spec('distribution/矩形', 'bg', { w: 320, h: 160, hue: 214, radius: 16 })
spec('tabbar/tabbar/图片', 'bg', { w: 600, h: 300, hue: 214 })
spec('tabbar/ai_agent/图片', 'ai', { key: 'bannerAgent', w: 600, h: 300 })
spec('sys-mini/Wechat_white@2x.png', 'brandWhite', { src: 'wechatSvg', size: 96 })
spec('sys-mini/save@2x.png', 'icon', { glyph: 'arrow-down-circle', size: 96, color: C.blue })

// —— 通用兜底(登记表里存在但上面没点名的,一律 96px 线稿)——
const FALLBACK_GLYPHS = ['sparkles', 'globe', 'layers', 'star', 'chat']
function fallbackSpec(rel, i) {
  spec(rel, 'icon', { glyph: FALLBACK_GLYPHS[i % FALLBACK_GLYPHS.length], size: 96, color: C.grey })
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
// `sys-backs/` 是**动态备份/用户上传内容**的命名空间(照片、视频),不是设计槽位。
// 给它生成一张线稿图标 = 用"看着像图的东西"冒充用户内容,比灰块更糟(票面铁律同款)。
// 这类路径只点名"无源",等真素材。
//
// 2026-10-14 追根:剩余 3 条 `sys-backs/*`(1 图 + 2 mp4)在**原型源码**里也是死引用 ——
//   · `sys-backs/2025/08/30/qwen_image_…jpg` ← `Ai-WXMiniVue/src/mixins/ai_index.js:387` 的
//     **注释行**(`// imgUrlList: [...]`);
//   · `sys-backs/2025/09/05/…/YQdNaZ…mp4` ← `src/pagesA/study/components/add_video.vue:22` 的
//     **注释块**(`<!-- <video …> -->`);
//   · `sys-backs/2025/09/06/…/5ff9Lb…mp4` ← `src/pagesA/study/video_detaila.vue:26` 的 `videoUrl`。
// 登记表是**扫原型源码**建的,连注释一起扫 ⇒ 这 3 条是"注释代码带进来的死登记项"。
// 且本仓代码对这三个登记键**零引用**(grep 0 命中)⇒ 不是任何活界面路径,不构成图裂。
const NO_SOURCE_PREFIXES = ['sys-backs/']
async function main() {
  const registry = extractRegistry()
  const codeUrls = extractCodeUrls()
  const codeSet = new Set(codeUrls)
  const paths = [...new Set([...registry, ...codeUrls])]
  const unspecced = paths.filter((p) => !SPECS[p.replace(/\/{2,}/g, '/')])
  unspecced.forEach((p, i) => {
    const rel = p.replace(/\/{2,}/g, '/')
    if (NO_SOURCE_PREFIXES.some((pre) => rel.startsWith(pre))) return // 留给"无源"分支点名
    if (!IMG_EXT_RE.test(rel)) return // 非图片扩展名(.mp4 等)不生成图片,同样进"无源"点名
    fallbackSpec(rel, i)
  })

  let real = 0, made = 0, skipped = 0, failed = 0
  const noSource = []
  const failures = []
  for (const raw of paths) {
    const rel = raw.replace(/\/{2,}/g, '/') // 文件系统/HTTP 语义下双斜杠折叠;登记表里保留了 2 条 // 形态
    const out = join(SERVER_ROOT, rel)
    // ① 真图优先:本地副本有结构性命中的真图 ⇒ 直接落盘,不生成假图(真图永远优于程序化生成)
    const local = localAssetFor(rel)
    if (local) {
      mkdirSync(dirname(out), { recursive: true })
      copyFileSync(local, out)
      real++
      continue
    }
    // ② 无真图:已有非空文件则不重做(除 --force)
    if (existsSync(out) && !FORCE && statSync(out).size > 0) { skipped++; continue }
    const s = SPECS[rel] ?? {}
    // ③ 无真图也无 spec(.mp4 / sys-backs 动态备份路径)⇒ 点名,不造假
    if (!s.kind) { noSource.push(rel); continue }
    try {
      await generate(rel, s)
      made++
    } catch (e) {
      failed++; failures.push(`${rel} :: ${e.message}`)
    }
  }
  console.log(`登记表 ${registry.length} 条 + 代码引用补充 ${paths.length - registry.length} 条 = ${paths.length} 条`)
  console.log(`真图落盘(本地副本结构性命中) ${real};程序化生成 ${made};跳过(已有真图) ${skipped};无源不造假 ${noSource.length};失败 ${failed}`)
  if (noSource.length) {
    // 分清两件事:被**活代码**引用而缺素材(真债,要盯) vs 只在登记表里(死登记项,不影响界面)。
    const live = noSource.filter((p) => codeSet.has(p))
    const dead = noSource.filter((p) => !codeSet.has(p))
    console.log(`无源清单 ${noSource.length} 条 —— 其中被活代码引用 ${live.length} 条 / 仅登记表死登记项 ${dead.length} 条:`)
    for (const p of live) console.log(`  [活代码引用·需素材] ${p}`)
    for (const p of dead) console.log(`  [死登记项·本仓零引用] ${p}`)
  }
  if (failures.length) {
    console.log('失败清单:')
    for (const f of failures) console.log('  ' + f)
    process.exitCode = 1
  }
  if (MIRROR_WEB) await mirrorWeb()
  await fillMiniappAssets()
}

/**
 * miniapp-taro 本地假图补齐(2026-10-14):src/assets/tabbar/*(14 张 tab 双态图标)与
 * src/static/{default-agent,default-avatar,share}.png 全是 ~300B 空白画布(同一字节复制组,
 * 空白画布审计 286B 组)。护栏同镜像通道:只替 ≤512B 假图,真图一律不动。
 */
const MINIAPP_TAB_GLYPHS = {
  agent: 'robot', ai: 'sparkles', course: 'graduation-cap', home: 'home',
  live: 'video', share: 'share', user: 'user',
}
async function fillMiniappAssets() {
  const base = join(ROOT, 'apps/miniapp-taro/src')
  let n = 0
  for (const [name, glyph] of Object.entries(MINIAPP_TAB_GLYPHS)) {
    for (const suffix of ['', '-active']) {
      const rel = `assets/tabbar/${name}${suffix}.png`
      n += await replaceIfBlank(join(base, rel), iconSvg(glyph, { size: 96, color: suffix ? C.blue : C.grey }))
    }
  }
  n += await replaceIfBlank(join(base, 'static/default-agent.png'), iconSvg('robot', { size: 192, color: C.blue }))
  n += await replaceIfBlank(join(base, 'static/default-avatar.png'), iconSvg('user', { size: 192, color: C.grey }))
  n += await replaceIfBlank(join(base, 'static/share.png'), iconSvg('share', { size: 96 }))
  console.log(`miniapp-taro 本地假图替换 ${n} 张(≤512B 护栏)`)
}

async function replaceIfBlank(out, svg) {
  if (existsSync(out) && statSync(out).size > 512) return 0
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, await sharp(Buffer.from(svg), { density: 300 }).png().toBuffer())
  return 1
}

/**
 * web/public 同名镜像同步:apps/web/public 里有一批与源站**同路径**的"看不见的假图"。
 * 判据(2026-10-14 实证):全部 178 条同路径跟踪文件在 G-107 之前(commit efe936ffcd)都是
 * ≤512B 空白画布 ⇒ "web/public 存在同名跟踪文件"本身就是镜像集合,可稳定复跑。
 * 刻意不用"当前文件 ≤512B"作判据:本脚本跑过一轮后那些文件已写成生成图(>512B),
 * 按当前大小判会把它们当成真图而漏更新(实测)。
 * 安全护栏:跳过 `git status` 显示被本地改动的路径,不覆盖并发会话在飞内容。
 */
async function mirrorWeb() {
  const dirty = new Set()
  try {
    const st = execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '-z', '--', 'apps/web/public'], {
      encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    })
    for (const rec of st.split('\0')) {
      const m = rec.match(/^.{2} (.+)$/)
      if (m) dirty.add(m[1])
    }
  } catch {
    console.log('web/public 镜像跳过:git status 取不到 ⇒ 不冒险覆盖')
    return
  }
  const tracked = new Set()
  try {
    const out = execFileSync('git', ['-C', ROOT, 'ls-files', '-z', '--', 'apps/web/public'], {
      encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    })
    for (const p of out.split('\0')) if (p) tracked.add(p)
  } catch {
    console.log('web/public 镜像跳过:ls-files 取不到')
    return
  }
  const all = walkDir(SERVER_ROOT)
  let n = 0, skippedDirty = 0
  for (const abs of all) {
    if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(abs)) continue
    const rel = abs.slice(SERVER_ROOT.length + 1).replace(/\\/g, '/')
    const webRel = 'apps/web/public/' + rel
    if (!tracked.has(webRel)) continue // 非镜像路径(web 端没有这个文件)⇒ 不新增 diff 面
    const webOut = join(WEB_PUBLIC, rel)
    if (!existsSync(webOut)) continue
    if (dirty.has(webRel)) { skippedDirty++; continue } // 被本地改动 ⇒ 不覆盖
    const a = readFileSync(abs)
    const b = readFileSync(webOut)
    if (a.length === b.length && a.equals(b)) continue // 已一致
    copyFileSync(abs, webOut)
    n++
  }
  console.log(`web/public 镜像替换 ${n} 张(判据:同路径跟踪文件=镜像;跳过本地改动 ${skippedDirty})`)
}

function walkDir(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walkDir(p, out)
    else out.push(p)
  }
  return out
}

async function generate(rel, s) {
  switch (s.kind) {
    case 'icon': return renderSvg(iconSvg(s.glyph, { size: s.size ?? 96, color: s.color ?? C.ink }), rel)
    case 'badge': return renderSvg(badgeSvg(s), rel)
    case 'cover': return renderSvg(coverSvg(s.n, s.i, s.size ?? 240), rel)
    case 'tile': return renderSvg(tileSvg(s.glyph, s.i, s.size ?? 120), rel)
    case 'bg': return renderSvg(bgSvg(s), rel)
    case 'bgjpg': return renderSvgJpg(bgSvg(s), rel)
    case 'step': return renderSvg(stepSvg(s.n, s.size ?? 220), rel)
    case 'rank': return renderSvg(rankSvg(s.n, s.color, s.size ?? 120), rel)
    case 'button': return renderSvg(buttonSvg(s), rel)
    case 'qr': return writeOut(rel, await qrPng('https://aizhs.top', s.size ?? 400))
    case 'qrjpg': {
      const png = await qrPng('https://aizhs.top', s.size ?? 600)
      return writeOut(rel, await sharp(png).flatten({ background: '#FFFFFF' }).jpeg({ quality: 90 }).toBuffer())
    }
    case 'brand': {
      const svg = readFileSync(BRAND[s.src])
      return writeOut(rel, await sharp(svg, { density: 300 }).resize(s.size ?? 96, s.size ?? 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())
    }
    case 'brandWhite': {
      const svg = readFileSync(BRAND[s.src])
      return writeOut(rel, await sharp(svg, { density: 300 }).resize(s.size ?? 96, s.size ?? 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).tint({ r: 255, g: 255, b: 255 }).png().toBuffer())
    }
    case 'ai': {
      if (s.jpgName && s.jpg) return aiCrop(s.key, s.w, s.h, s.jpgName, { jpg: true })
      return aiCrop(s.key, s.w, s.h, rel, { jpg: !!s.jpg })
    }
    default: throw new Error(`未知 kind:${s.kind}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
