// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端 UI 差异账 —— 回答一个问题:"小程序端和 RN 端这同一枚组件,长得一样吗?"
//
//   V1 可见几何档不同:两端各自的数字/类名档全部归一到 px 再比集合 —— 这就是用户看到的那一处不一样。
//   S1 同名组件两端各有一份实现:这才是"改一端、另一端不自动同步"的结构性根因,所以它单独计数报出。
//
// 样式语言(className vs StyleSheet)与 props 命名只随读数打印 —— 它们是 S1 的证据,不是观感本身。
//
// 配对的前置条件(2026-09-26 换判据):一条腿必须**从该端入口可达**(见 SEED_FILES 注)。
// 旧的"被自己以外引用一次"太弱 —— 桶文件顺手再导出就算引用,于是门会对一份根本不在 RN 屏幕上
// 渲染的 DOM 副本判"一致性"。人工核对想退回"同名即配对"用 `--pair-all`(默认档必做可达性剔除)。
//
// 判定面与守门 77/83/93/98/103 同形:全量判 HEAD blob、--staged 判索引 blob、两面旗同给判死、
// 清单与正文**同面同轮**取;任一面取不到 ⇒ exit 2「无法判定」,不回落另一个面(回落就是把"没判"
// 写成"判过了")。刻意不开 --worktree 档:共享工作树常年滞后 HEAD,按磁盘判会在恒红与假绿之间来回跳,
// 并把错数写回棘轮台账(守门 83 的 R3 登记一天内被整文件回退三次即此型)。
//
// 定级:棘轮 blocking(锚点 = 台账里钉住的 HEAD 读数,只拦"把两端差异加大")。
// 为什么不是"当场全红 blocking":立项实测同名配对 19 对、其中 17 对有可见几何差异。与本次改动无关的
// 恒红门,唯一结局是逼人 --no-verify,一次绕过等于当天全部守门作废(§12e 实测型)。
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitBinary, gitRaw, selectFace, Undetermined } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 两端的组件面。RN 侧**两层都扫**:`packages/app`(共享屏层)+ `apps/mobile-rn/src/components`
 * (端内自绘层)。只扫一层会漏判 —— 小程序组件若只与端内层同名,只扫共享层就把它算成"仅小程序",
 * 而那正应当被收进"两端同源"的目标形态。同名多命中时取排序靠前的层(共享层优先)。
 */
const SIDES = {
  miniapp: ['apps/miniapp-taro/src/components'],
  rn: ['packages/app/src/components', 'apps/mobile-rn/src/components'],
}
/** 一个逻辑 px 折成该端单位要乘多少:小程序 750 设计宽 / 375pt ⇒ 2;RN 1:1。反向即除。 */
const TO_PX = { miniapp: 2, rn: 1 }

const BASELINE_REL = 'scripts/cross-end-ui-parity-baseline.json'
/** 落在这些键/标识符上下文里的数字才算"看得见的尺寸"。 */
const GEO_KEY =
  /(size|width|height|box|icon|padding|margin|font|line|gap|radius|top|bottom|left|right|thickness|spacing|edge)/i
/**
 * 必须先过这道否定筛:GEO_KEY 的 `font` 会命中 `fontWeight: 700`、`line` 命中 `lineCount`、
 * `size` 命中 `pageSize`。不排就是拿字重当尺寸判差异 —— 噪音尺与静默尺同样没用。
 * `letter` 是 2026-09-26 补的:`spacing` 一支会命中 `letterSpacing`(字距 0.2 被当尺寸读数),
 * RN 端 BottomActionBar 的头注当时已把这一处如实写成"读数噪音"—— 噪音登记进注释不配当判据,
 * 尺子自己把它喂进集合就是判据错(RN 侧 `LABEL_LETTER_SPACING = 0.2` 即实例)。
 */
const NON_GEO_KEY =
  /(weight|letter|opacity|zindex|z-index|duration|delay|easing|alpha|percent|ratio|count|index|version|iteration|order|priority|limit|timeout|timestamp|revision|level|depth|page)/i
const TW_SPACING_PX = (n) => n * 4
const TW_FONT_PX = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30 }
/** 超过此值的"尺寸"不是组件几何(屏宽 / 动画毫秒 / 密度),不判。 */
const MAX_GEO_PX = 1200

/**
 * 剥注释但**保留字符串内容** —— 方向相反会各错一次:剥字符串会把 `className="w-[72rpx]"` 一起抹掉
 * (判据失明),留注释会把说明性数字喂进判据(假阳)。
 */
export function stripComments(src) {
  let out = ''
  let mode = 'code'
  let quote = ''
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const n = src[i + 1]
    if (mode === 'code') {
      if (c === '/' && n === '/') {
        mode = 'line'
        i++
        continue
      }
      if (c === '/' && n === '*') {
        mode = 'block'
        i++
        continue
      }
      if (c === '"' || c === "'" || c === '`') {
        mode = 'str'
        quote = c
      }
      out += c
      continue
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code'
        out += c
      }
      continue
    }
    if (mode === 'block') {
      if (c === '*' && n === '/') {
        mode = 'code'
        i++
      }
      continue
    }
    if (c === '\\') {
      out += c + (n ?? '')
      i++
      continue
    }
    out += c
    if (c === quote) {
      mode = 'code'
      quote = ''
    }
  }
  return out
}

const round = (n) => Math.round(n * 100) / 100

/** 原始数字 → px。带 rpx 后缀除 2;小程序端裸数字按该端量纲即 rpx,故同样折算。 */
export function toPx(raw, unit, side) {
  const v = Number(raw)
  if (!Number.isFinite(v) || v <= 0) return null
  const isRpx = unit === 'rpx' || (unit === undefined && side === 'miniapp')
  const px = round(isRpx ? v / TO_PX.miniapp : v)
  return px > MAX_GEO_PX ? null : px
}

/** 这些档**不归本门判**:圆角有守门 77 的单一源,在此重复问责会造出两台尺子互相指认。 */
const RADIUS_FORM_RE = /rounded|radius|cornerradius|border-radius/i

/**
 * 一个文件 → 归一后的几何档集合 + 具名常量表。纯函数:自检钉的是它,不是打印。
 */
export function readGeometry(src, side, tiers = {}) {
  const code = stripComments(src)
  const named = {}
  const values = new Set()
  const push = (px) => {
    if (px !== null && px !== undefined) values.add(px)
  }
  const keyed = (name) =>
    GEO_KEY.test(name) && !NON_GEO_KEY.test(name) && !RADIUS_FORM_RE.test(name)

  for (const m of code.matchAll(
    /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(\d+(?:\.\d+)?)(?![\w.])/g,
  )) {
    if (!keyed(m[1])) continue
    const px = toPx(m[2], undefined, side)
    named[m[1]] = px
    push(px)
  }
  for (const m of code.matchAll(
    /\b([A-Za-z_$][\w$]*)\s*[:=]\s*(\d+(?:\.\d+)?)(rpx|px)?(?![\w.])/g,
  )) {
    if (!keyed(m[1])) continue
    push(toPx(m[2], m[3], side))
  }
  for (const m of code.matchAll(/\brpx\(\s*(\d+(?:\.\d+)?)\s*\)/g)) push(toPx(m[1], 'rpx', side))
  for (const m of code.matchAll(
    /(?:^|[\s"'`])(?:size|gap|p|m|px|py|mx|my|mt|mb|ml|mr|w|h|top|bottom|left|right|inset)-\[(\d+(?:\.\d+)?)(rpx|px)?\]/g,
  ))
    push(toPx(m[1], m[2], side))
  for (const m of code.matchAll(
    /(?:^|[\s"'`:](?:[a-z-]+:)?)size-(\d+(?:\.\d+)?)(?=$|[\s"'`])/g,
  ))
    push(round(TW_SPACING_PX(Number(m[1]))))
  // 内联盒/留白的**刻度档**(非任意值形态):`px-3`/`py-2`/`gap-4`/`mt-2` … 一律 ×4 折 px。
  // 不收这一档,同一族的两侧就不在同一口径上读数 —— RN 写 `paddingHorizontal: 12` 记进集合,
  // 小程序写 `px-3` 却不进集合,于是"仅 RN 档 12"是一条纯粹的比对噪声(实测 BottomActionBar 就这么错判过)。
  for (const m of code.matchAll(
    /(?:^|[\s"'`:](?:[a-z-]+:)?)(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-(\d+(?:\.\d+)?)(?=$|[\s"'`])/g,
  ))
    push(round(TW_SPACING_PX(Number(m[1]))))
  // 尾视里**不含 `/`**:`w-1/3` 这类分数宽度不是 px 档(旧写法把 `w-1` 折成 4px 喂进集合,
  // 实测 ModelList 的骨架条 `w-1/3` 因此凭空多出一档"仅小程序 4")。
  for (const m of code.matchAll(/(?:^|[\s"'`:](?:[a-z-]+:)?)([hw])-(\d+(?:\.\d+)?)(?=$|[\s"'`])/g))
    push(round(TW_SPACING_PX(Number(m[2]))))
  for (const m of code.matchAll(/(?:^|[\s"'`])text-\[(\d+(?:\.\d+)?)(rpx|px)?\]/g))
    push(toPx(m[1], m[2], side))
  for (const m of code.matchAll(/(?:^|[\s"'`])text-(xs|sm|base|lg|xl|2xl|3xl)(?=$|[\s"'`/:])/g))
    push(TW_FONT_PX[m[1]] ?? null)
  for (const m of code.matchAll(/\bsize=\{(\d+(?:\.\d+)?)\}/g)) push(toPx(m[1], undefined, side))
  /**
   * **具名档必须也进集合**,否则尺子奖励隐藏:把数字收编进 `packages/shared/src/ui/*-spec.ts`
   * 或 `design-tokens/geometry.js` 之后,组件里只剩标识符,前面所有"数字形态"的提取式全部落空
   * —— 于是"两端各取 spec 里不同的一档"读起来比"两端各抄一个裸数字"更加隐身。
   * 这一格是 2026-09-26 用户实拍"两端还是不一样"时定位出来的判据缺陷:几何同值的族能看见,
   * 已经收进单一源的族反而看不见。
   * 口径:`_PX` 结尾的导出档名按逻辑 px 直接计入(**不做 rpx 换算** —— spec 存的就是逻辑 px),
   * `geometry.<键>` 同;本文件的局部别名(`const X = SPEC_Y` / `const X = rnGeometry.tapBox`)
   * 追一跳,别名本身也按名字记进 named 表。
   */
  if (tiers && Object.keys(tiers).length) {
    const alias = {}
    for (const m of code.matchAll(
      /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:(?:rnGeometry|taroGeometry|GEOMETRY_PX)\.([A-Za-z_$][\w$]*)|([A-Z][A-Z0-9_]*))(?![\w.])/g,
    )) {
      const target = m[2] ? `geometry.${m[2]}` : m[3]
      if (tiers[target] !== undefined) alias[m[1]] = tiers[target]
    }
    /**
     * 取标识符全集用**一遍**扫描再与档表求交,而不是"每个档名建一条正则扫全文":
     * 档表现有 600+ 条,×24 个配对文件 = 一万多次全文回溯,一次判据跑成分钟级;
     * 求交是 O(文件长度)。两种写法判的是同一件事,成本差三个数量级。
     */
    const ids = new Set(code.match(/[A-Za-z_$][\w$]*/g) || [])
    const geoMember = new Set(
      [...code.matchAll(/\b(?:rnGeometry|taroGeometry|GEOMETRY_PX)\.([A-Za-z_$][\w$]*)/g)].map(
        (m) => m[1],
      ),
    )
    for (const [name, px] of Object.entries(tiers)) {
      const hit = name.startsWith('geometry.')
        ? geoMember.has(name.slice(9))
        : ids.has(name)
      if (!hit || !(px > 0) || px > MAX_GEO_PX) continue
      push(px)
      if (named[name] === undefined) named[name] = px
    }
    for (const [name, px] of Object.entries(alias)) {
      push(px)
      if (named[name] === undefined) named[name] = px
    }
  }
  return { values, named }
}

/**
 * 同名常量两侧折成 px 后仍不等 ⇒ 手抄档漂移的确证。
 * 立论实例:两份自称"唯一实现"的 BackChevron,图标墨迹小程序 40rpx=20px、RN 写 22 —— 差 2px,
 * 而两端注释里都写着"与 web 同档"。散文承诺挡不住手抄。
 */
export function namedConflicts(a, b) {
  const out = []
  for (const [k, v] of Object.entries(a)) {
    const w = b[k]
    if (w !== undefined && v !== undefined && round(v) !== round(w))
      out.push(`${k}: miniapp=${v} rn=${w}`)
  }
  return out.sort()
}

export function diffValues(mini, rn) {
  const only = (x, y) => [...x].filter((v) => !y.has(v)).sort((p, q) => p - q)
  return { onlyMiniapp: only(mini, rn), onlyRn: only(rn, mini) }
}

const fileName = (f) => f.split('/').pop()
/**
 * 单一源表(共享 spec + design-tokens 几何表)→ 具名档表。
 * 键:`SPEC_…_PX` 原样;`GEOMETRY_PX` 的档挂 `geometry.` 前缀(与消费侧 `rnGeometry.tapBox` 同形)。
 * 排除项按判据面而非按名字猜:带 `PER_` 的是单位换算系数(`TARO_RPX_PER_PX = 2` 不是尺寸档)、
 * 命中 NON_GEO_KEY / 圆角形态的不入表 —— 收了就是把换算系数当几何档喂进集合。
 */
export function specTiers(sources) {
  const tiers = {}
  // 两遍:几何表可能排在 spec 之后,先收表,再解析 `export const X = GEOMETRY_PX.y` 这类投影档。
  const geom = []
  for (const [rel, src] of Object.entries(sources)) {
    if (!/[\\/]geometry\.[jt]s$/.test(rel)) continue
    const table = stripComments(src).match(/GEOMETRY_PX\s*=\s*\{([\s\S]*?)\n\}/)
    if (!table) continue
    for (const m of table[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(\d+(?:\.\d+)?)/g))
      geom.push([m[1], Number(m[2])])
  }
  for (const [k, v] of geom) tiers[`geometry.${k}`] = v
  for (const [rel, src] of Object.entries(sources)) {
    if (/[\\/]geometry\.[jt]s$/.test(rel)) continue
    const code = stripComments(src)
    for (const m of code.matchAll(
      /export const ([A-Z][A-Z0-9_]*_PX)\s*=\s*(?:(\d+(?:\.\d+)?)(?![\w.])|(?:GEOMETRY_PX|rnGeometry|taroGeometry)\.([A-Za-z_$][\w$]*))/g,
    )) {
      const name = m[1]
      if (/PER_/.test(name) || NON_GEO_KEY.test(name) || RADIUS_FORM_RE.test(name)) continue
      const px = m[2] !== undefined ? Number(m[2]) : tiers[`geometry.${m[3]}`]
      if (typeof px === 'number' && px > 0) tiers[name] = px
      // 投影源取不到(表里没这一档 / 改了名)⇒ **不计入档表**:把"解析不出"当成 0 或跳过,
      // 等于让一次改名把整条具名档判据静默关掉 —— 与本门"判不出即点名"的口径同形,这里如实留空。
    }
  }
  return tiers
}

const normKey = (file) =>
  fileName(file)
    .replace(/\.(tsx|jsx|ts|js)$/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
const nameOf = (file) => fileName(file).replace(/\.[^.]+$/, '')

/** 两端清单 → 同名配对 + 计数。纯函数,构造面即可证明后缀与优先级两条判据。 */
export function scan(listMini, listRn) {
  const rnMap = new Map()
  for (const f of listRn) {
    if (!/\.(tsx|jsx)$/i.test(fileName(f))) continue
    const k = normKey(f)
    if (!rnMap.has(k)) rnMap.set(k, f) // 排序靠前的层优先(共享层在前)
  }
  const miniMap = new Map()
  for (const f of listMini) {
    if (!/\.(tsx|jsx)$/i.test(fileName(f))) continue
    if (!miniMap.has(normKey(f))) miniMap.set(normKey(f), f)
  }
  const pairs = []
  for (const [k, f] of miniMap)
    if (rnMap.has(k)) pairs.push({ name: nameOf(f), miniapp: f, rn: rnMap.get(k) })
  const out = {
    pairs: pairs.sort((a, b) => a.name.localeCompare(b.name)),
    onlyMiniapp: [...miniMap.keys()].filter((k) => !rnMap.has(k)).length,
    onlyRn: [...rnMap.keys()].filter((k) => !miniMap.has(k)).length,
    miniappCount: miniMap.size,
    rnCount: rnMap.size,
  }
  // 空扫就是本门要防的那一型故障(判据看不见 ⇒ 一路绿灯)。宁判死,不记通过。
  if (out.miniappCount === 0 || out.rnCount === 0)
    return {
      ...out,
      undetermined: true,
      reason: `组件面枚举为空(小程序 ${out.miniappCount} / RN ${out.rnCount})`,
    }
  return { ...out, undetermined: false, reason: null }
}

export function styleLanguage(src) {
  const code = stripComments(src)
  const sheet = /StyleSheet\.create\(/.test(code)
  const cls = /\bclassName\s*=/.test(code)
  if (sheet && cls) return 'mixed'
  if (sheet) return 'stylesheet'
  if (cls) return 'className'
  return 'none'
}

/** 图标载体:素材源不同则同一枚箭头的墨迹不可能逐位相同(端内 SVG 由 gen-taro-lucide-icons 从 lucide 提取)。 */
export function iconCarriers(src) {
  const out = new Set()
  for (const m of stripComments(src).matchAll(
    /from\s+['"]([^'"]*(?:lucide|LineIcon|icons\/|\.svg)[^'"]*)['"]/gi,
  ))
    out.add(m[1])
  return [...out].sort()
}

/**
 * 字形身份(不是载体模块):RN 取 lucide 导入名(PascalCase → kebab),小程序取 `<LineIcon name="…">`。
 * 两端同名 = 同一份 lucide 路径数据 ⇒ 墨迹才可能逐位相同;模块说明符相同而字形名不同,依旧不是一张脸。
 * 另收 `aizhsUrl('*.png')` 这类 CDN 位图槽 —— 位图不随主题反色、不跟字号缩放,当 UI 图标即分叉源。
 */
export function iconGlyphs(src) {
  const code = stripComments(src)
  const vector = new Set()
  for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*lucide[^'"]*['"]/gi))
    for (const raw of m[1].split(',')) {
      const n = raw.trim().split(/\s+as\s+/)[0]?.trim()
      if (n && /^[A-Z]/.test(n)) vector.add(pascalToKebab(n))
    }
  for (const m of code.matchAll(/<LineIcon\b[^>]*?\bname\s*=\s*["']([a-z0-9-]+)["']/g)) vector.add(m[1])
  /**
   * 字形名也常**当数据传**(配置数组 `{ key, label, icon: 'camera' }` + `<LineIcon name={item.icon}/>`)。
   * 只看 `<LineIcon name="…">` 字面量会把这些槽位判成"小程序未矢量化" —— 判据看不见自己产出的形态,
   * 就是给人发一张假的分叉账单。刻意要求本文件 import 了 LineIcon,免得把别的 `icon:` 业务字段算进来。
   */
  if (/from\s+['"][^'"]*LineIcon['"]/.test(code))
    for (const m of code.matchAll(/\bicon:\s*['"]([a-z0-9-]+)['"]/g)) vector.add(m[1])
  /**
   * 三元/条件传名(`name={mode === 'voice' ? 'keyboard' : 'mic'}`)里的字形名同样要认 ——
   * 判据只吃属性位字面量的话,语音切换这一格会被算成"小程序未矢量化",给用户的是一张假分叉账单。
   * 取 `name={…}` 花括号内的全部字符串字面量;模板拼接/变量传名取不到 ⇒ 不计(宁漏不误报,
   * 且 IC 的这部分只报数不判红)。
   */
  for (const tag of code.matchAll(/<LineIcon\b[\s\S]*?\/>/g)) {
    const expr = /\bname\s*=\s*\{([^}]*)\}/.exec(tag[0])
    if (!expr) continue
    // 只取第一个 `?` 之后的分支字面量 —— 条件操作数(`mode === 'voice'` 里的 'voice')不是字形名,
    // 全量收集会把比较值混进图标集合(自检 ㉛ 第一次跑就抓到这个)。
    const q = expr[1].indexOf('?')
    if (q < 0) continue
    for (const s of expr[1].slice(q).matchAll(/['"]([a-z0-9-]+)['"]/g)) vector.add(s[1])
  }
  const bitmap = []
  for (const m of code.matchAll(/aizhsUrl\(\s*['"]([^'"]*\.(?:png|jpe?g|gif))['"]/gi)) bitmap.push(m[1])
  return { vector: [...vector].sort(), bitmap }
}

const pascalToKebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/**
 * 图标载体对账(IC)。判据与几何判据刻意分开:几何已同值的族,图标仍可能一端矢量一端位图 ——
 * 挂在"有几何差异才看"的分支上,就等于对最干净的那批组件失明。
 * 返回按组件名的 { bitmap, onlyRn, onlyMiniapp };`bitmap` 是待问责计数,`only*` 只报数不判红
 * (平台确有单侧控件,判红必成假阳)。
 */
export function iconAudit(pairs, text) {
  const out = []
  for (const p of pairs.pairs) {
    const a = text[p.miniapp]
    const b = text[p.rn]
    if (a === undefined || b === undefined) continue
    const ga = iconGlyphs(a)
    const gb = iconGlyphs(b)
    const av = new Set(ga.vector)
    const bv = new Set(gb.vector)
    const onlyRn = gb.vector.filter((n) => !av.has(n))
    const onlyMiniapp = ga.vector.filter((n) => !bv.has(n))
    // 豁免标记必须按**原始源码**数:它本身就住在注释里,拿 stripComments 后的面去找等于永远找不到
    // (自检 ㉙ 第一次跑就抓到这个 —— 判据写了豁免却恒不生效,账面还会一路报绿)。
    const exempted = (a.match(/icon-bitmap-exempt:/g) ?? []).length
    const bitmap = Math.max(0, ga.bitmap.length - exempted)
    if (!bitmap && !onlyRn.length && !onlyMiniapp.length) continue
    out.push({ name: p.name, bitmap, onlyRn, onlyMiniapp, exempted })
  }
  return out
}

/**
 * SL —— 一张 spec 档**只被一条腿消费**的清单。
 *
 * 为什么单列一维:具名档解析把"这条腿到底走没走单一源"变成了可读事实,于是出现一类
 * 既不是"同名不同值"、也不是"几何集合差档"的形态 —— `NAVBAR_BACK_BOX_PX` 只有小程序端引用,
 * RN 端仍写自己的数。把它折进 `values` 集合会造出一批"仅 RN 档 / 仅小程序档"的**假分叉读数**
 * (两端各有 3-26 枚单侧档,一次就是 9 族判红),而它真正的含义是"另一条腿还没接线"。
 * 所以这一维**只列名字、不折进几何集合**,并按 IC 同一形状做 HEAD 棘轮:存量只报数,
 * 新增单侧档(或新增一族)才判红 —— 当场判红就是一台与任何提交都无关的恒红门(§12e 同型)。
 * 域取 `tiers` 里 spec 导出的档名(**不含 `geometry.*`**)：通用档天然被很多端很多文件引用,
 * 按配对文件两两求差只会产出噪声。
 */
export function specLegAudit(pairs, text, tiers) {
  const specNames = Object.keys(tiers ?? {}).filter((n) => !n.startsWith('geometry.'))
  if (!specNames.length) return []
  const out = []
  for (const p of pairs.pairs) {
    const a = text[p.miniapp]
    const b = text[p.rn]
    if (a === undefined || b === undefined) continue
    const idsOf = (src) => new Set(src.match(/[A-Za-z_$][\w$]*/g) || [])
    const ia = idsOf(stripComments(a))
    const ib = idsOf(stripComments(b))
    const onlyMiniapp = specNames.filter((n) => ia.has(n) && !ib.has(n))
    const onlyRn = specNames.filter((n) => ib.has(n) && !ia.has(n))
    if (!onlyMiniapp.length && !onlyRn.length) continue
    out.push({ name: p.name, onlyMiniapp, onlyRn })
  }
  return out
}

/* ───────────────── 端入口可达性:什么才算"一条腿" ───────────────── */

/**
 * 种子 = 每端的入口。一条腿必须从这些点沿 import 走到,否则它只是"被执行过、没人用"。
 *
 * 立因(2026-09-26 实测):`packages/app/src/components/NavBar.tsx` 与 `UserInfoCard.tsx` 渲染的是
 * `div`/`span`(web DOM),在 RN 端根本不在屏幕上;旧判据"被自己以外引用一次就算一条腿"却因为
 * `packages/app/src/components/index.ts` 顺手再导出它们而放行。**桶文件在运行时确实会把未被人用的
 * 再导出一起求值,但求值 ≠ 有人在渲染** —— 本门要的是后者,所以再导出按**名字**路由:只有真被上游
 * import 点到的那个名字,才把它指向的源文件带进可达集。这不是完整 resolver,只回答"可达否"。
 */
const SEED_FILES = { miniapp: ['apps/miniapp-taro/src/app.tsx'], rn: ['apps/mobile-rn/App.tsx'] }
const SEED_DIRS = { miniapp: [], rn: ['apps/mobile-rn/src/navigation'] }
/** 小程序的路由表在 `app.config.ts` 的**数据**里(不是 import),必须单独喂进种子。 */
const PAGE_MANIFEST = { miniapp: 'apps/miniapp-taro/src/app.config.ts', rn: null }
/** 遍历面:两端源码 + `packages/`。apps/web·api·cli 不可能被这两端 import,不取。 */
const REACH_ROOTS = ['apps/miniapp-taro', 'apps/mobile-rn', 'packages']
const REACH_SRC_RE = /\.(?:tsx|jsx|ts|js|mjs|cjs)$/
const TEST_PATH_RE = /(^|\/)(?:tests?|__tests__|__mocks__|e2e)\//
const TEST_FILE_RE = /\.(?:test|spec)\.[cm]?[jt]sx?$/
/** `@/` 实测只有两处来源:miniapp 的 tsconfig 声明 `@/* -> ./src/*`,mobile-rn 同构(全仓仅一处)。 */
const SLASH_ALIAS = {
  'apps/miniapp-taro/': 'apps/miniapp-taro/src/',
  'apps/mobile-rn/': 'apps/mobile-rn/src/',
}
const EXT_CANDIDATES = [
  '',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.mjs',
  '.cjs',
  '/index.tsx',
  '/index.ts',
  '/index.jsx',
  '/index.js',
]
/** 非模块导入(样式 / 资产):跟着走没有意义,单独一态,不混进"未判定"。 */
const NON_MODULE_RE =
  /\.(?:css|scss|sass|less|json|svg|png|jpe?g|gif|webp|avif|ttf|woff2?|ico|md|html)$/i

const EDGE_IMPORT = /(?:^|[\s;{}])import\s+(type\s+)?([^'"();]*?)\s*from\s*['"]([^'"]+)['"]/g
const EDGE_SIDE = /(?:^|[\s;{}])import\s*['"]([^'"]+)['"]/g
const EDGE_REEXPORT =
  /(?:^|[\s;{}])export\s+(type\s+)?(\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g
const EDGE_LOCAL_LIST = /(?:^|[\s;{}])export\s*\{([^}]*)\}(?!\s*from)/g
const EDGE_DYNAMIC = /(?:^|[^\w$.])import\s*\(([^)]*)\)/g
const EDGE_REQUIRE = /(?:^|[^\w$.])require\s*\(([^)]*)\)/g
const LOCAL_DEF =
  /(?:^|[\s;{}])export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g
const HAS_DEFAULT = /(?:^|[\s;{}])export\s+default\b/

/** `{ A, B as C }` → `[{original:A,exported:A},{original:B,exported:C}]`;解不出的形态返回 null(交调用方按整模块处理)。 */
function specList(text) {
  const out = []
  for (const raw of String(text).split(',')) {
    const s = raw.trim()
    if (!s || /^type\b/.test(s)) continue
    const m = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(s)
    if (!m) return null
    out.push({ original: m[1], exported: m[2] || m[1] })
  }
  return out
}

/** import 子句 → 需要的原始名集合;`null` = 整模块被用(默认导入 / `* as` / 副作用 / 混用)。 */
export function clauseDemand(clause) {
  const t = String(clause || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return null
  if (/\*\s*as\b/.test(t)) return null
  const b = t.indexOf('{')
  if (b < 0) return null
  if (t.slice(0, b).replace(/,/g, ' ').trim()) return null
  const end = t.lastIndexOf('}')
  if (end < b) return null
  const list = specList(t.slice(b + 1, end))
  if (!list || !list.length) return null
  return list.map((s) => s.original)
}

/**
 * 一个模块 → 它依赖的边。四类:
 *   `use`   真实 import(整模块或按名)—— 无论本文件怎么被用,这些边都会被执行,**总是跟**
 *   `re`    `export { A as B } from 'x'` —— 只在被点名时按名字往下传
 *   `star`  `export * from 'x'` —— 通配,任何被点的名字都可能从这里过
 *   `ns`    `export * as n from 'x'` —— 等价于整模块被用
 * `type` / `export type` 一律不算(类型不进产物),与守门 126 同取向。
 */
export function parseModuleEdges(src) {
  const code = stripComments(src)
  const edges = []
  const undetermined = []
  const localExports = new Set()
  for (const m of code.matchAll(EDGE_IMPORT)) {
    if (m[1]) continue
    edges.push({ kind: 'use', spec: m[3], names: clauseDemand(m[2]) })
  }
  for (const m of code.matchAll(EDGE_SIDE)) edges.push({ kind: 'use', spec: m[1], names: null })
  for (const m of code.matchAll(EDGE_REEXPORT)) {
    if (m[1]) continue
    const body = m[2]
    if (body.startsWith('*')) {
      edges.push({ kind: /\bas\b/.test(body) ? 'ns' : 'star', spec: m[3], names: null })
      continue
    }
    const list = specList(body.slice(1, -1))
    if (!list) {
      edges.push({ kind: 'use', spec: m[3], names: null })
      continue
    }
    edges.push({
      kind: 're',
      spec: m[3],
      names: null,
      map: new Map(list.map((s) => [s.exported, s.original])),
    })
  }
  for (const m of code.matchAll(EDGE_DYNAMIC)) {
    const lit = /^\s*['"]([^'"]+)['"]\s*$/.exec(m[1] || '')
    if (lit) edges.push({ kind: 'use', spec: lit[1], names: null })
    else
      undetermined.push({ spec: (m[1] || '').trim().slice(0, 60), reason: '动态拼接的 import()' })
  }
  for (const m of code.matchAll(EDGE_REQUIRE)) {
    const lit = /^\s*['"]([^'"]+)['"]\s*$/.exec(m[1] || '')
    if (lit) edges.push({ kind: 'use', spec: lit[1], names: null })
    else
      undetermined.push({ spec: (m[1] || '').trim().slice(0, 60), reason: '动态拼接的 require()' })
  }
  for (const m of code.matchAll(LOCAL_DEF)) localExports.add(m[1])
  if (HAS_DEFAULT.test(code)) localExports.add('default')
  // `export { A, B }`(无 from)= 本文件把局部定义对外命名,同样算定义处。
  for (const m of code.matchAll(EDGE_LOCAL_LIST)) {
    const list = specList(m[1])
    if (list) for (const s of list) localExports.add(s.exported)
  }
  return { edges, localExports, undetermined }
}

/** 相对路径拼接:git 面恒为正斜杠,不用 node:path(它在 win32 上会写成反斜杠)。 */
function relJoin(baseDir, spec) {
  const out = []
  for (const s of `${baseDir}/${spec}`.split('/')) {
    if (!s || s === '.') continue
    if (s === '..') out.pop()
    else out.push(s)
  }
  return out.join('/')
}

/**
 * 解析到一个仓内文件。四态必分,尤其:**解析不到 ≠ 不存在**。
 * `{file}` 命中源码 / `{asset}` 样式或资产(不 traverse,也不计未判定)/
 * `{external}` 第三方包 / `{unresolved:原因}` 判不出 —— 交调用方计数并打印。
 */
function resolveSpecifier(spec, fromFile, ctx) {
  if (!spec) return { unresolved: '空说明符' }
  if (NON_MODULE_RE.test(spec)) return { asset: true }
  const tryCandidates = (base) => {
    for (const ext of EXT_CANDIDATES) if (ctx.files.has(base + ext)) return base + ext
    const stripped = base.replace(/\.[cm]?[jt]sx?$/, '')
    if (stripped !== base)
      for (const ext of EXT_CANDIDATES) if (ctx.files.has(stripped + ext)) return stripped + ext
    return null
  }
  let base = null
  if (spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..') {
    base = relJoin(fromFile.split('/').slice(0, -1).join('/'), spec)
  } else if (spec.startsWith('@/')) {
    const owner = Object.keys(SLASH_ALIAS).find((root) => fromFile.startsWith(root))
    if (!owner) return { unresolved: '@/ 别名在该包未声明(不猜目标)' }
    base = SLASH_ALIAS[owner] + spec.slice(2)
  } else if (spec.startsWith('@ihui/')) {
    const m = /^@ihui\/([\w-]+)(?:\/(.*))?$/.exec(spec)
    const name = m ? `@ihui/${m[1]}` : null
    const dir = name && ctx.pkgDir.get(name)
    if (!dir) return { external: true }
    const sub = m[2] || ''
    /**
     * 三个候选基准,不做完整 resolver:清单给的入口(`main` / `exports['.']`,常指向**未构建的
     * dist**)→ 包根直拼 → 包根 `src/` 直拼(本仓多数包源码在 src/,而清单只记产物)。
     * 三个都拼不通才算"未判定",绝不当"这个模块不存在"。
     */
    const entry = sub ? null : ctx.pkgEntry.get(name)
    const bases = [entry, relJoin(dir, sub), relJoin(dir, `src/${sub}`)].filter(Boolean)
    for (const b of bases) {
      const hit = tryCandidates(b)
      if (hit) return { file: hit }
    }
    return { unresolved: `workspace 包入口解析不到:${spec}` }
  } else if (!spec.startsWith('/') && !/^[A-Za-z]:/.test(spec)) {
    return { external: true }
  } else {
    return { unresolved: `无法归类的说明符 ${spec}` }
  }
  const hit = tryCandidates(base)
  if (!hit) return { unresolved: `解析不到文件:${spec}` }
  if (!REACH_SRC_RE.test(hit)) return { asset: true }
  return { file: hit }
}

/**
 * Taro 路由表:`app.config.ts` 的 `pages` / `subPackages[].pages`(数据,不是 import)。
 * `root` 与紧随其后的 `pages` 配对;顶层 `pages` 出现在任何 root 之前,故初值为 ''。
 * 拼出来的 / 引号里带反引号的路径一律回 `unresolved`,交调用方计数 —— 不当"这个页不存在"。
 */
export function readTaroPages(src, pageDir) {
  const code = stripComments(src)
  const pages = []
  const unresolved = []
  let root = ''
  for (const m of code.matchAll(/(?:root|pages)\s*:\s*(\[[\s\S]*?\]|['"][^'"]*['"])/g)) {
    const chunk = m[1]
    if (!chunk.startsWith('[')) {
      const lit = /['"]([^'"]*)['"]/.exec(chunk)
      if (lit) root = lit[1]
      continue
    }
    for (const s of chunk.matchAll(/(['"])([^'"]*)\1|`([^`]*)`/g)) {
      // 反引号那一路(或引号里带 `${`)一律算拼出来的 —— 不得当"这个页不存在"
      const p = s[2] !== undefined ? s[2] : s[3]
      if (s[3] !== undefined || /\$\{/.test(p)) {
        unresolved.push(p)
        continue
      }
      pages.push(root ? `${pageDir}/${root}/${p}` : `${pageDir}/${p}`)
    }
  }
  return { pages, unresolved }
}

/**
 * 从端入口出发的可达集(名字路由见 SEED_FILES 上方注释)。
 * `ctx` = { face, files, pkgDir, pkgEntry, reached, read } —— 取材与解析都从 ctx 走,
 * 所以这一遍是纯图遍历:同一份 ctx 给两次,结论必相同(自检的构造面由此而来)。
 */
export function buildReach(seeds, ctx) {
  const state = new Map()
  const queue = []
  const undetermined = []
  const parsed = new Map()
  const st = (f) => {
    let s = state.get(f)
    if (!s) state.set(f, (s = { full: false, routed: new Set() }))
    return s
  }
  const askFull = (f) => {
    const s = st(f)
    if (s.full) return
    s.full = true
    queue.push({ f, names: null })
  }
  const askNames = (f, names) => {
    const s = st(f)
    if (s.full) return
    const fresh = names.filter((n) => !s.routed.has(n))
    if (!fresh.length) return
    for (const n of fresh) s.routed.add(n)
    queue.push({ f, names: fresh })
  }
  const edgesOf = (f, text) => {
    let p = parsed.get(f)
    if (!p) {
      p = parseModuleEdges(text)
      for (const u of p.undetermined) undetermined.push({ from: f, spec: u.spec, reason: u.reason })
      parsed.set(f, p)
    }
    return p
  }
  const route = (from, e, given) => {
    const r = resolveSpecifier(e.spec, from, ctx)
    if (r.external || r.asset) return
    if (r.unresolved) {
      undetermined.push({ from, spec: e.spec, reason: r.unresolved })
      return
    }
    if (given === null) askFull(r.file)
    else askNames(r.file, given)
  }
  for (const s of seeds) askFull(s)
  let steps = 0
  while (queue.length) {
    if (++steps > 200000) throw new Undetermined('可达性遍历步数超上限 ⇒ 判据失效,不得记为通过')
    const { f, names } = queue.shift()
    ctx.reached.add(f)
    const text = ctx.read(f)
    if (text === null || text === undefined) {
      undetermined.push({ from: null, spec: f, reason: `${FACE_TXT[ctx.face]}取不到内容` })
      continue
    }
    const { edges, localExports } = edgesOf(f, text)
    const served = new Set()
    for (const e of edges) {
      if (e.kind === 'use' || e.kind === 'ns') {
        route(f, e, e.kind === 'use' ? e.names : null)
        continue
      }
      if (names === null) {
        route(f, e, e.kind === 'star' ? null : [...e.map.values()])
        continue
      }
      if (e.kind === 'star') {
        // 通配再导出把需求整个传下去了 —— 名字若真没人接,由更深层自己报未判定,
        // 不在这一层重复喊(否则每个 `export *` 桶都会替它转发的每个名字编一条假"未判定")。
        for (const n of names) served.add(n)
        route(f, e, names)
        continue
      }
      const hit = names.filter((n) => e.map.has(n))
      if (!hit.length) continue
      for (const n of hit) served.add(n)
      route(
        f,
        e,
        hit.map((n) => e.map.get(n)),
      )
    }
    for (const n of names || []) {
      if (served.has(n)) continue
      if (localExports.has(n)) askFull(f)
      // 只有"这文件根本不是桶"(没有任何对外再导出)时,才把它当名字的 definitions 处整模块展开;
      // 是桶却没这个名 ⇒ 判不出,只计数。反过来(桶一律整展开)会把整个桶目录灌进可达集,
      // 那正是本判据要防的那一型 —— 两条分支各由一条自检钉住。
      else if (!edges.some((e) => e.kind === 're' || e.kind === 'star')) askFull(f)
      else undetermined.push({ from: f, spec: n, reason: '被点名的名字既无定义也无可路由的再导出' })
    }
  }
  return { used: ctx.reached, undetermined }
}

/** 整面清单(可达性要能走到任何路径,不随组件目录收窄)。取不到返回 null。 */
function listAllFace(repoRoot, face) {
  const args = face === 'staged' ? ['ls-files'] : ['ls-tree', '-r', '--name-only', 'HEAD']
  let out
  try {
    out = gitRaw(args, repoRoot, { timeout: 120000, maxBuffer: 1 << 26 })
  } catch {
    return null
  }
  if (out === null || out === undefined) return null
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 剔掉不构成一条腿的配对:腿文件必须从**该端入口**可达(旧判据"被引用一次"太弱,见 SEED_FILES 注)。
 * 三态都不静默:剔除逐条点名并带"从端入口不可达";解析不到的边计"未判定"并给总数;
 * 种子 / 路由表 / 清单取不到 ⇒ 整判据"无法判定";全部配对都被剔除 ⇒ 判据失明,同样不记通过。
 */
export function pruneUnreachableLegs(repoRoot, face, scanned) {
  const all = listAllFace(repoRoot, face)
  if (!all || !all.length)
    return {
      pairs: scanned,
      unreachable: [],
      undetermined: [],
      reason: `${FACE_TXT[face]}:取不到整面清单`,
    }
  const files = new Set(all)
  const inScope = (p) => REACH_ROOTS.some((r) => p === r || p.startsWith(`${r}/`))
  const corpus = all.filter(
    (p) => inScope(p) && REACH_SRC_RE.test(p) && !TEST_PATH_RE.test(p) && !TEST_FILE_RE.test(p),
  )
  const manifests = all.filter((p) => /^(?:apps|packages)\/[^/]+\/package\.json$/.test(p))
  const needed = [...new Set([...corpus, ...manifests])]
  const specs = needed.map((rel) => (face === 'staged' ? ':' : 'HEAD:') + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 29, timeout: 180000 })
  const texts = new Map()
  const missing = new Set()
  for (let i = 0; i < needed.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined) missing.add(needed[i])
    else texts.set(needed[i], t)
  }
  const pkgDir = new Map()
  const pkgEntry = new Map()
  for (const rel of manifests) {
    const raw = texts.get(rel)
    if (raw === undefined) continue
    let j
    try {
      j = JSON.parse(raw)
    } catch {
      continue // 坏清单:该包按"解析不到"处理(它的 import 会落进未判定),不猜
    }
    if (typeof j.name !== 'string' || !j.name.startsWith('@ihui/')) continue
    const dir = rel.split('/').slice(0, -1).join('/')
    pkgDir.set(j.name, dir)
    const x = j.exports
    const dot = typeof x === 'string' ? x : x && typeof x === 'object' ? x['.'] : null
    let e = null
    if (typeof dot === 'string') e = dot
    else if (dot && typeof dot === 'object')
      e = dot.import || dot.default || Object.values(dot).find((v) => typeof v === 'string') || null
    if (!e && typeof j.main === 'string') e = j.main
    if (e) pkgEntry.set(j.name, relJoin(dir, e))
  }
  const extraUndet = []
  /**
   * 可达集**按端各跑一遍**。混成一张图会串味:小程序页面只要 import 一次 `@ihui/rn-app`,
   * RN 侧那一份副本就被"另一端"走亮了 —— 而本门问的从来是"在**它自己那一端**的屏幕上有没有人用"。
   */
  const seedsBySide = {}
  for (const side of Object.keys(SEED_FILES)) {
    const seeds = []
    for (const f of SEED_FILES[side]) {
      if (!files.has(f))
        return {
          pairs: scanned,
          unreachable: [],
          undetermined: [],
          reason: `种子入口不在被审面上(${f})`,
        }
      seeds.push(f)
    }
    for (const dir of SEED_DIRS[side]) {
      const hits = all.filter(
        (p) =>
          p.startsWith(`${dir}/`) &&
          REACH_SRC_RE.test(p) &&
          !TEST_PATH_RE.test(p) &&
          !TEST_FILE_RE.test(p),
      )
      if (!hits.length)
        return {
          pairs: scanned,
          unreachable: [],
          undetermined: [],
          reason: `种子目录里没有源码(${dir})`,
        }
      seeds.push(...hits)
    }
    const manifest = PAGE_MANIFEST[side]
    if (manifest) {
      if (!files.has(manifest))
        return {
          pairs: scanned,
          unreachable: [],
          undetermined: [],
          reason: `路由表不在被审面上(${manifest})`,
        }
      const src = texts.get(manifest)
      if (src === undefined)
        return {
          pairs: scanned,
          unreachable: [],
          undetermined: [],
          reason: `${FACE_TXT[face]}取不到路由表 ${manifest}`,
        }
      const pageDir = manifest.split('/').slice(0, -1).join('/')
      const { pages, unresolved } = readTaroPages(src, pageDir)
      if (!pages.length)
        return {
          pairs: scanned,
          unreachable: [],
          undetermined: [],
          reason: `${manifest} 里读不到任何页面 ⇒ 判据失明`,
        }
      for (const p of unresolved)
        extraUndet.push({ from: manifest, spec: p, reason: '路由表里拼出来的页路径' })
      for (const p of pages) {
        const hit = EXT_CANDIDATES.map((x) => p + x).find((x) => files.has(x))
        if (hit) seeds.push(hit)
        else
          extraUndet.push({
            from: manifest,
            spec: p,
            reason: '路由表页路径解析不到文件(不当"不存在")',
          })
      }
      seeds.push(manifest)
    }
    seedsBySide[side] = seeds
  }
  const usedBySide = {}
  const undet = [...extraUndet]
  for (const side of Object.keys(seedsBySide)) {
    const ctx = {
      face,
      files,
      pkgDir,
      pkgEntry,
      reached: new Set(),
      read: (f) => (texts.has(f) ? texts.get(f) : null),
    }
    const { undetermined } = buildReach(seedsBySide[side], ctx)
    undet.push(...undetermined)
    // 一端一个文件都没走到 = 种子/清单本身错了(不是"这份没被用"),必须判死而非把整端剔光。
    if (!ctx.reached.size)
      return {
        pairs: scanned,
        unreachable: [],
        undetermined: undet,
        reason: `${side} 端入口一个文件都没走到 ⇒ 判据失明`,
      }
    usedBySide[side] = ctx.reached
  }
  const unreachable = []
  const kept = []
  const fallbacks = []
  /**
   * 首选层是**死副本**时退回下一层,而不是把整对丢掉(2026-09-26 实测:UserInfoCard / NavBar /
   * Carousel 的 `packages/app` 那份零可达消费者,而 `apps/mobile-rn` 的同名件真在屏幕上)。
   * 旧行为"锁定首选层 → 不可达 → 剔对" ⇒ 这三对**覆盖率为 0 而账面不喊**,读报告的人会以为已同值。
   * 候选顺序仍按 SIDES 目录优先级不变,只是把"不可达"从"剔对"降级为"换腿";
   * 换到的是哪条腿必须留痕(静默换腿等于把判据的输入挪走而没人知道)。
   */
  const altsBySide = {}
  for (const side of Object.keys(SIDES)) {
    const m = new Map()
    for (const dir of SIDES[side]) {
      for (const p of all) {
        if (!p.startsWith(`${dir}/`) || !/\.(tsx|jsx)$/i.test(fileName(p))) continue
        const k = normKey(p)
        if (!m.has(k)) m.set(k, [])
        if (!m.get(k).includes(p)) m.get(k).push(p)
      }
    }
    altsBySide[side] = m
  }
  for (const p of scanned.pairs) {
    const cur = { miniapp: p.miniapp, rn: p.rn }
    const moved = []
    for (const side of ['miniapp', 'rn']) {
      const reach = usedBySide[side]
      if (reach.has(cur[side]) || missing.has(cur[side])) continue
      const alt = (altsBySide[side].get(normKey(cur[side])) ?? []).find(
        (f) => f !== cur[side] && !missing.has(f) && reach.has(f),
      )
      if (alt) {
        moved.push(`${cur[side]} → ${alt}`)
        cur[side] = alt
      }
    }
    // 取不到内容的文件不参与判定(可能是二进制)—— 宁可不剔,也不把"没判"当"不可达"。
    const bad = ['miniapp', 'rn'].filter((s) => !usedBySide[s].has(cur[s]) && !missing.has(cur[s]))
    if (!bad.length) {
      if (moved.length) fallbacks.push({ name: p.name, moved })
      kept.push({ ...p, miniapp: cur.miniapp, rn: cur.rn })
      continue
    }
    unreachable.push({
      name: p.name,
      side: bad[0],
      legs: bad.map((s) => cur[s]),
      reason: bad.map((s) => `${cur[s]} 从端入口不可达`).join(';'),
    })
  }
  // 全被剔除不再是"判据失明"(小夹具本就可能只剩一份死副本),但必须喊出来 —— 覆盖面掉了要看得见。
  const note =
    scanned.pairs.length && !kept.length
      ? `全部 ${scanned.pairs.length} 对的两端都不可达:本门这一轮对空气判定,请核种子`
      : fallbacks.length
        ? `${kept.length} 对中有 ${fallbacks.length} 对换了腿(首选层是不可达的死副本,已退回下一层):${fallbacks
            .map((f) => f.name)
            .join(', ')} —— 覆盖面因此比账面大,不是"存量已同值"`
        : null
  return {
    pairs: { ...scanned, pairs: kept },
    unreachable,
    undetermined: undet,
    reason: null,
    note,
    fallbacks,
  }
}

const FACE_TXT = { head: 'HEAD', staged: '索引' }

/**
 * 清单按面取:`ls-tree` 不认 `--cached`(传进去是 unknown option ⇒ 整面取不到)。索引面只能走
 * `ls-files`;内容仍由 `catBatch(':path')` 取,清单与内容同面同轮。
 */
function listFace(repoRoot, face, dir) {
  const args =
    face === 'staged'
      ? ['ls-files', '--', dir]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', dir]
  const out = gitRaw(args, repoRoot, {})
  if (out === null || out === undefined) return null
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 面 → 两端清单 + 同名配对正文。一次 cat-file --batch 同面同轮读完;任一份取不到即 Undetermined。
 * `pairAll` 是人工核对的逃生舱:退回"只要同名就配对",不做可达性剔除(默认档必做)。
 */
export function collect(repoRoot, face, { pairAll = false } = {}) {
  const lists = {}
  for (const [side, dirs] of Object.entries(SIDES)) {
    const acc = []
    for (const dir of dirs) {
      const out = listFace(repoRoot, face, dir)
      if (out === null) throw new Undetermined(`${FACE_TXT[face]}取不到目录清单 ${dir}`)
      acc.push(...out)
    }
    lists[side] = acc
  }
  let pairs = scan(lists.miniapp, lists.rn)
  if (pairs.undetermined) throw new Undetermined(`${pairs.reason} ⇒ 判据失明,不得记为通过`)
  let unreachable = []
  let undeterminedEdges = []
  let coverageNote = null
  let fallbacks = []
  if (pairAll) pairs = { ...pairs, pairAll: true }
  else {
    const pruned = pruneUnreachableLegs(repoRoot, face, pairs)
    if (pruned.reason) throw new Undetermined(`端入口可达性判据无法成立:${pruned.reason}`)
    pairs = pruned.pairs
    unreachable = pruned.unreachable
    undeterminedEdges = pruned.undetermined
    coverageNote = pruned.note ?? null
    fallbacks = pruned.fallbacks ?? []
  }
  const need = [...new Set(pairs.pairs.flatMap((p) => [p.miniapp, p.rn]))]
  const text = {}
  const specs = need.map((rel) => (face === 'staged' ? ':' : 'HEAD:') + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
  for (let i = 0; i < need.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined) throw new Undetermined(`${FACE_TXT[face]}取不到 ${need[i]}`)
    text[need[i]] = t
  }
  /**
   * 具名档表与组件正文**同面同轮**取:清单来自被审面,内容也来自被审面。
   * 取不到任何一份 ⇒ Undetermined。空表不等于"没有单源档",那是一台瞎了的尺子 ——
   * 正因如此,枚举到 0 个 spec 文件也判死(不得把"表空"读成"两端都没用单源,所以差异为 0")。
   */
  const specDir = 'packages/shared/src/ui'
  const specList = listFace(repoRoot, face, specDir)
  if (specList === null) throw new Undetermined(`${FACE_TXT[face]}取不到目录清单 ${specDir}`)
  const specFiles = specList.filter((p) => /-spec\.ts$/.test(p))
  if (!specFiles.length)
    throw new Undetermined(`${FACE_TXT[face]}在 ${specDir} 枚举到 0 个 *-spec.ts ⇒ 具名档判据失明`)
  /**
   * 几何表(`GEOMETRY_PX`)按**是否真被引用**决定缺件算不算失明:夹具可以没有它,
   * 但只要有一个配对文件写着 `rnGeometry.` / `taroGeometry.` 而表取不到,那就是判据看不见
   * 这一档 —— 与"目录清单为空却记绿"同型,必须喊死。
   */
  const geoPath = 'packages/design-tokens/src/geometry.js'
  const geoList = listFace(repoRoot, face, 'packages/design-tokens/src')
  const hasGeo = geoList === null ? false : geoList.includes(geoPath)
  const tierPaths = hasGeo ? [...specFiles, geoPath] : [...specFiles]
  const tierSpecs = tierPaths.map((rel) => (face === 'staged' ? ':' : 'HEAD:') + rel)
  const tierGot = catBatch(repoRoot, tierSpecs, { maxBuffer: 1 << 26 })
  const specSources = {}
  for (let i = 0; i < tierPaths.length; i++) {
    const t = tierGot.get(tierSpecs[i])
    if (t === null || t === undefined)
      throw new Undetermined(`${FACE_TXT[face]}取不到具名档来源 ${tierPaths[i]}`)
    specSources[tierPaths[i]] = t
  }
  if (!hasGeo && need.some((rel) => /\b(?:rnGeometry|taroGeometry|GEOMETRY_PX)\./.test(text[rel])))
    throw new Undetermined(`${FACE_TXT[face]}取不到 ${geoPath},而配对组件在引用几何表 ⇒ 判据失明`)
  const tiers = specTiers(specSources)
  return {
    pairs,
    text,
    tiers,
    unreachableLegs: unreachable,
    undeterminedEdges,
    coverageNote,
    fallbacks,
  }
}

/** 一处"看得见的差异" = 一个档值(具名常量不同值另计,同一处不双计)。 */
export function diffCount(f) {
  return f.named.length + f.geometry.onlyMiniapp.length + f.geometry.onlyRn.length
}

/** 豁免必须是带理由的声明,不是消红通道;到期由守门 108 单独问责。 */
export function waiverProblem(w) {
  if (!w) return null
  if (typeof w.reason !== 'string' || w.reason.trim().length < 6)
    return '豁免无理由或理由不足以复核'
  return null
}

export function audit(pairs, text, baseline = {}, tiers = {}) {
  const findings = []
  for (const p of pairs.pairs) {
    const a = text[p.miniapp]
    const b = text[p.rn]
    if (a === undefined || b === undefined) continue
    const ga = readGeometry(a, 'miniapp', tiers)
    const gb = readGeometry(b, 'rn', tiers)
    const named = namedConflicts(ga.named, gb.named)
    const geometry = diffValues(ga.values, gb.values)
    if (!named.length && !geometry.onlyMiniapp.length && !geometry.onlyRn.length) continue
    const w = (baseline.waivers ?? {})[p.name]
    findings.push({
      name: p.name,
      named,
      geometry,
      lang: { miniapp: styleLanguage(a), rn: styleLanguage(b) },
      icons: { miniapp: iconCarriers(a), rn: iconCarriers(b) },
      invalidWaiver: waiverProblem(w) ?? undefined,
      waived: !!w && !waiverProblem(w),
    })
  }
  return { findings, ...verdictOf(findings, baseline), pairCount: pairs.pairs.length }
}

/**
 * 棘轮:锚点 = 台账钉住的读数(立项按 HEAD 生成)。只拦"把差异加大";台账没有这个名字 ⇒ 锚点 0,
 * 新增配对直接问责(它没有存量可躲)。变好只提示"可下调",**不自动改账**。
 */
export function verdictOf(findings, baseline) {
  const counts = baseline.counts ?? {}
  const waivers = baseline.waivers ?? {}
  const red = []
  const shrunk = []
  const waived = []
  for (const f of findings) {
    const n = diffCount(f)
    // 豁免判定只在这一处生效(规则本身在 waiverProblem,audit 里的字段只是同一规则的展示视图)。
    // 若两处各判一次,台账改一条就会一边认豁免、一边仍判红 —— 两处算同一件事必漂移,本仓记过多次。
    const w = waivers[f.name]
    if (w && !waiverProblem(w)) {
      waived.push({ name: f.name, diffCount: n })
      continue
    }
    const anchor = counts[f.name] ?? 0
    if (n > anchor)
      red.push({ name: f.name, diffCount: n, anchor, named: f.named, geometry: f.geometry })
    else if (n < anchor) shrunk.push({ name: f.name, diffCount: n, anchor })
  }
  return { red, shrunk, waived }
}

export function emitBaseline(findings) {
  const counts = {}
  for (const f of findings) counts[f.name] = diffCount(f)
  return { counts, waivers: {} }
}

export function parseBaseline(text, where) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Undetermined(`${BASELINE_REL}(${where})不是合法 JSON —— 台账坏了不得当豁免用`)
  }
}

/** 台账缺席 = 空锚点(全判红)。这是"新门先入库台账再接线"的强制顺序,不得靠缺文件蒙绿。 */
export function chooseBaseline(t) {
  return t === null || t === undefined ? {} : parseBaseline(t, 'ledger')
}

export function loadBaseline(repoRoot, face) {
  const spec = (face === 'staged' ? ':' : 'HEAD:') + BASELINE_REL
  const got = catBatch(repoRoot, [spec], { maxBuffer: 1 << 24 })
  return chooseBaseline(got.get(spec))
}

export function faceFromArgv(argv) {
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  // 把 error 当 face 往下传 = --staged 静默按 HEAD 判,账面却读成"审过本次提交的那一份"。
  if (error) throw new Undetermined(error)
  if (face === 'worktree')
    throw new Undetermined('本门不开工作树档:共享工作树滞后 HEAD,按磁盘判会把错数写回台账')
  return face
}

export function main(argv, repoRoot = ROOT) {
  const pairAll = argv.includes('--pair-all')
  let face, collected, baseline
  try {
    face = faceFromArgv(argv)
    baseline = loadBaseline(repoRoot, face)
    collected = collect(repoRoot, face, { pairAll })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.log(`⚠️ 无法判定:${e.message}`)
      return 2
    }
    throw e
  }
  const res = audit(collected.pairs, collected.text, baseline, collected.tiers)
  if (argv.includes('--emit-baseline')) {
    console.log(JSON.stringify(emitBaseline(res.findings), null, 2))
    console.log(
      `模板按 ${FACE_TXT[face]} 面生成;逐条核过再放进 ${BASELINE_REL}(它是存量锚点,不是合格证)`,
    )
    return 0
  }
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify({
        face,
        pairAll,
        pairCount: res.pairCount,
        findings: res.findings.map((f) => ({
          name: f.name,
          diffCount: diffCount(f),
          lang: f.lang,
        })),
        unreachable: (collected.unreachableLegs ?? []).map((u) => ({ name: u.name, legs: u.legs })),
        undeterminedEdges: (collected.undeterminedEdges ?? []).length,
        red: res.red,
        waived: res.waived.length,
      }),
    )
  } else {
    const off = collected.unreachableLegs ?? []
    const undet = collected.undeterminedEdges ?? []
    console.log(
      `判定面 ${FACE_TXT[face]}:同名配对组件 ${res.pairCount} 对(重复实现 = 改一端另一端不跟随)` +
        (pairAll
          ? '【--pair-all 人工档:只要同名就配对,未做端入口可达性剔除】'
          : off.length
            ? `;已剔除 ${off.length} 对(腿文件从端入口不可达:${off.map((o) => o.name).join('/')})—— ` +
              '配一份没在屏幕上渲染的副本,绿灯不算数'
            : '') +
        (undet.length
          ? `;未判定边 ${undet.length} 处(路径解析不到 / 动态拼接,不当"不存在"也不当"不可达")`
          : ''),
    )
    for (const o of off) console.log(`  ⊘ ${o.name} —— ${o.reason}`)
    if (collected.coverageNote) console.log(`  ⚠ ${collected.coverageNote}`)
    for (const u of undet.slice(0, 12))
      console.log(`  ? 未判定:${u.from ?? '(清单)'} → ${u.spec}:${u.reason}`)
    if (undet.length > 12) console.log(`  ? 其余 ${undet.length - 12} 处未判定同上(不静默省略计数)`)
    for (const f of res.findings) {
      const bits = []
      if (f.named.length) bits.push(`同名常量不同值 ${f.named.join(', ')}`)
      if (f.geometry.onlyMiniapp.length) bits.push(`仅小程序档 ${f.geometry.onlyMiniapp.join('/')}`)
      if (f.geometry.onlyRn.length) bits.push(`仅 RN 档 ${f.geometry.onlyRn.join('/')}`)
      const mark = f.waived ? '○' : res.red.some((r) => r.name === f.name) ? '×' : '·'
      console.log(`  ${mark} ${f.name} [${f.lang.miniapp}|${f.lang.rn}] ${bits.join(' | ')}`)
    }
    console.log(
      `可见几何差异 ${res.findings.length} 处 → 超锚点判红 ${res.red.length} / 带理由豁免 ${res.waived.length}` +
        (res.shrunk.length ? ` / 已变好可下调台账 ${res.shrunk.length}` : ''),
    )
    if (res.shrunk.length)
      console.log(
        `  下调:${res.shrunk.map((s) => `${s.name} ${s.anchor}→${s.diffCount}`).join(', ')}`,
      )
    if (res.red.length)
      console.log(
        '  收口姿势 = 一份与平台无关的组件源 + 两端各自注入 primitive adapter;**不得给单端补数字凑平**' +
          '(那只是把第二份真相挪了个位置)。确属平台导致的差异写进台账 waivers 并带 reason。',
      )
  }
  /*
   * ── IC 图标载体对账 ──────────────────────────────────────────────
   * 与几何判据分开跑:几何已同值的族,图标照样可能一端 lucide 矢量、一端 CDN 位图 ——
   * 挂在"有几何差异才看"的分支上,等于对最干净的那批组件失明(用户实拍反馈正是这一型)。
   * 红条件 = 该组件位图槽数 **超过它自己在 HEAD 的存量**(棘轮,只拦新增;存量当场判红就是
   * 与任何提交都无关的恒红门,唯一结局是逼人跳门,§12e 同型)。单侧矢量化只报数 ——
   * 平台确有单侧控件(RN 的 <Switch>、小程序走 chooseMessageFile 无录音界面),判红必成假阳。
   */
  let icRed = []
  const ic = iconAudit(collected.pairs, collected.text)
  if (ic.length) {
    if (face !== 'head') {
      const base = collect(repoRoot, 'head', { pairAll })
      const baseIc = new Map(iconAudit(base.pairs, base.text).map((x) => [x.name, x.bitmap]))
      icRed = ic.filter((x) => x.bitmap > (baseIc.get(x.name) ?? 0))
    }
    if (!argv.includes('--json')) {
      for (const x of ic) {
        const bits = []
        if (x.bitmap) bits.push(`小程序仍用 CDN 位图 ${x.bitmap} 处`)
        if (x.exempted) bits.push(`带理由豁免 ${x.exempted} 处`)
        if (x.onlyRn.length) bits.push(`仅 RN 矢量化 ${x.onlyRn.join('/')}`)
        if (x.onlyMiniapp.length) bits.push(`仅小程序矢量化 ${x.onlyMiniapp.join('/')}`)
        console.log(
          `  ${icRed.some((r) => r.name === x.name) ? '×' : '·'} IC ${x.name} ${bits.join(' | ')}`,
        )
      }
      console.log(
        `图标载体对账 ${ic.length} 族 → 新增位图当图标判红 ${icRed.length} / 只报数 ${ic.length - icRed.length}`,
      )
    }
  }
  if (icRed.length && !argv.includes('--json'))
    console.log(
      '  IC 收口姿势 = 该槽位换成与 RN 同一个 lucide 字形(小程序走 LineIcon,名字照抄 RN 侧),' +
        '确属多色插画才保留位图并写 icon-bitmap-exempt: <原因>',
    )
  /*
   * ── SL 单侧具名档对账 ───────────────────────────────────────────
   * 具名档解析接通后新可读的一维:一张 spec 档只被一条腿引用 = 另一条腿还没走单一源。
   * 与几何集合分开跑(折进 values 会把"没接线"报成"分叉",两者处置动作不同)。
   * 红条件与 IC 同形 = 该族单侧档数**超过它自己在 HEAD 的存量**;存量只报数 ——
   * 首次接通时 9 族全有单侧档,当场判红就是一台恒红门(§12e 同型)。
   */
  const sl = specLegAudit(collected.pairs, collected.text, collected.tiers)
  let slRed = []
  if (sl.length) {
    if (face !== 'head') {
      const base = collect(repoRoot, 'head', { pairAll })
      const baseSl = new Map(
        specLegAudit(base.pairs, base.text, base.tiers).map((x) => [
          x.name,
          x.onlyMiniapp.length + x.onlyRn.length,
        ]),
      )
      slRed = sl.filter(
        (x) => x.onlyMiniapp.length + x.onlyRn.length > (baseSl.get(x.name) ?? 0),
      )
    }
    if (!argv.includes('--json')) {
      for (const x of sl) {
        const n = x.onlyMiniapp.length + x.onlyRn.length
        const bits = []
        if (x.onlyMiniapp.length) bits.push(`仅小程序引用 ${x.onlyMiniapp.join('/')}`)
        if (x.onlyRn.length) bits.push(`仅 RN 引用 ${x.onlyRn.join('/')}`)
        console.log(
          `  ${slRed.some((r) => r.name === x.name) ? '×' : '·'} SL ${x.name}(${n}) ${bits.join(' | ')}`,
        )
      }
      console.log(
        `单侧具名档 ${sl.length} 族 → 新增判红 ${slRed.length} / 只报数 ${sl.length - slRed.length}` +
          '(一档只被一条腿引用 = 另一条腿还没走单一源;不得靠给单端补数字消账)',
      )
    }
  }
  return res.red.length + icRed.length + slRed.length ? 1 : 0
}

/**
 * 可达性判据的成对夹具:一座最小**真** git 仓(判据全程按 git 面取数,夹具不入库就测不到)。
 * 两端各一枚同名 `Foo`;RN 那枚**只被桶文件再导出** —— `packages/app/src/components/index.ts`
 * 带着它,而桶从 `@ihui/rn-app` 只被要求提供 `Bar`。这正是 NavBar / UserInfoCard 在真仓的形态。
 * `rn` 改的就是"导航器到底 import 哪些名字"这一处 ⇒ 传 `{Bar}` 必剔、传 `{Bar,Foo}` 必留,
 * 两条用例互为可逆对照(只有恒红或恒绿两种坏实现会同时错过它们)。
 */
function FIXTURE_BASE({ rn }) {
  return {
    'apps/miniapp-taro/src/app.tsx': 'export default function App() { return null }\n',
    'apps/miniapp-taro/src/app.config.ts':
      "export default defineAppConfig({ pages: ['pages/index/index'] })\n",
    'apps/miniapp-taro/src/pages/index/index.tsx':
      "import { Foo } from '@/components'\nexport default function P() { return <Foo /> }\n",
    'apps/miniapp-taro/src/components/index.ts': "export { Foo } from './Foo'\n",
    'apps/miniapp-taro/src/components/Foo.tsx':
      'export function Foo() { return <div className="w-[72rpx]" /> }\n',
    'apps/mobile-rn/App.tsx':
      "import { RootNavigator } from './src/navigation/RootNavigator'\nexport default function App() { return <RootNavigator /> }\n",
    'apps/mobile-rn/src/navigation/RootNavigator.tsx': `${rn}\n`,
    'packages/app/package.json': '{"name":"@ihui/rn-app","main":"./src/index.ts"}\n',
    'packages/app/src/index.ts': "export { Bar, Foo } from './components'\n",
    'packages/app/src/components/index.ts':
      "export { Bar } from './Bar'\nexport { Foo } from './Foo'\n",
    'packages/app/src/components/Bar.tsx': 'export function Bar() { return null }\n',
    'packages/app/src/components/Foo.tsx':
      'export function Foo() { return <div style={{ width: 36 }} /> }\n',
    // 具名档表与组件同面取,夹具必须自带一份 spec —— 否则 collect() 按"判据失明"判死,
    // 这一组用例红的原因就不是判据,而是夹具缺件。
    'packages/shared/src/ui/foo-spec.ts': 'export const FOO_BOX_PX = 24\n',
  }
}

/** 造夹具仓:写文件 → init → add → commit(--no-verify + 自带身份,不碰任何全局钩子)。 */
function makeFixtureRepo(files) {
  const dir = mkScratch('ui-parity-')
  const run = (args) =>
    execFileSync(gitBinary(), ['-c', 'safe.directory=*', '-C', dir, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 1 << 24,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
  run(['init', '-q'])
  run(['add', '-A'])
  run([
    '-c',
    'user.email=self-test@local',
    '-c',
    'user.name=self-test',
    'commit',
    '-q',
    '--no-verify',
    '-m',
    'fixture',
  ])
  return dir
}

function runSelfTest() {
  let pass = 0
  let fail = 0
  const t = (name, cond, note) => {
    if (cond === true) pass++
    else fail++
    console.log(
      `  ${cond === true ? 'ok  ' : 'FAIL'} ${name}${cond === true ? '' : ` —— 实得:${String(cond)}${note ? ` (${note})` : ''}`}`,
    )
  }
  t(
    'S1 注释里的数字不得被当成几何档',
    readGeometry('// BOX = 99\nconst a = 1\n', 'rn').values.size === 0,
  )
  t(
    'S2 字符串里的块注释开闭序列不得吞掉后续判据',
    stripComments('const s="/*"\nconst BOX=8\n').includes('BOX'),
  )
  t(
    'S3 72rpx 与 36px 归一到同一档(单位不是差异)',
    readGeometry('w-[72rpx]', 'miniapp').values.has(36) &&
      readGeometry('w-[36px]', 'rn').values.has(36),
  )
  t(
    'S4 同名常量两侧不同值必须点名(阳性对照)',
    namedConflicts({ ICON: 20 }, { ICON: 22 }).length === 1,
  )
  t(
    'S5 同名常量两侧同值不得点名(反向对照)',
    namedConflicts({ ICON: 22 }, { ICON: 22 }).length === 0,
  )
  t(
    'S6 非几何键(字重/时长/index)不计入',
    readGeometry('fontWeight: 700\nduration: 300\nrowIndex = 3\n', 'rn').values.size === 0,
  )
  t(
    'S7 配对认 .jsx 与 .tsx 同判(门不得对自己产出的形态失明)',
    scan(['a/Back.jsx'], ['b/Back.tsx']).pairs.length === 1,
  )
  t('S8 两端清单为空 ⇒ 判死而非记绿(空扫不通过)', scan([], []).undetermined === true)
  t('S9 豁免缺理由仍算红', waiverProblem({ until: '2027-01-01' }) !== null)
  t(
    'S10 豁免带理由才算 waived',
    waiverProblem({ reason: '平台 chrome:原生导航栏不参与 CSS' }) === null,
  )
  t(
    'S11 棘轮:不超锚点绿 / 超过锚点红(成对)',
    (() => {
      const f = {
        name: 'X',
        named: [],
        geometry: { onlyMiniapp: [1, 2], onlyRn: [] },
        waived: false,
      }
      return (
        verdictOf([f], { counts: { X: 2 } }).red.length === 0 &&
        verdictOf([f], { counts: { X: 1 } }).red.length === 1
      )
    })(),
  )
  t(
    'S12 台账缺该组件 ⇒ 锚点 0,新配对的任何差异直接红',
    verdictOf(
      [{ name: 'New', named: [], geometry: { onlyMiniapp: [8], onlyRn: [] }, waived: false }],
      {},
    ).red.length === 1,
  )
  t(
    'S13 变好了只提示下调,不自动改账',
    verdictOf(
      [{ name: 'X', named: [], geometry: { onlyMiniapp: [1], onlyRn: [] }, waived: false }],
      {
        counts: { X: 5 },
      },
    ).shrunk.length === 1,
  )
  t(
    'S14 audit 端到端:同档绿 / 差一档红',
    (() => {
      const p = { pairs: [{ name: 'Foo', miniapp: 'a/Foo.tsx', rn: 'b/Foo.tsx' }] }
      const same = audit(p, { 'a/Foo.tsx': 'w-[72rpx]\n', 'b/Foo.tsx': 'w-[36px]\n' }, {})
      const diff = audit(p, { 'a/Foo.tsx': 'w-[72rpx]\n', 'b/Foo.tsx': 'w-[44px]\n' }, {})
      return same.red.length === 0 && diff.red.length === 1
    })(),
  )
  t(
    'S15 两面旗同给 ⇒ 判死',
    (() => {
      try {
        faceFromArgv(['--staged', '--worktree'])
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t(
    'S16 工作树档被拒(本门拒绝按磁盘判,防错数写回台账)',
    (() => {
      try {
        faceFromArgv(['--worktree'])
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t(
    'S17 圆角档不参与本门(守门 77 单一源,不得两台尺子互相指认)',
    readGeometry('rounded-[99px]\nborderRadius: 99\n', 'rn').values.size === 0,
  )
  t(
    'S18 RN 同名多命中 ⇒ 取排序靠前的层(共享层优先)',
    scan(['a/X.tsx'], ['p1/X.tsx', 'p2/X.tsx']).pairs[0].rn === 'p1/X.tsx',
  )
  t(
    'S19 台账坏 JSON ⇒ 判死,不得当"没有豁免"蒙过',
    (() => {
      try {
        parseBaseline('{坏 json', 'ledger')
        return false
      } catch (e) {
        return e instanceof Undetermined
      }
    })(),
  )
  t(
    '㉑ 路由表读页:顶层 pages 不带 root、subPackages 的页必须带自己的 root',
    (() => {
      const { pages, unresolved } = readTaroPages(
        "export default defineAppConfig({\n  pages: ['pages/index/index'],\n  subPackages: [{ root: 'pkg-ai', pages: ['ai/chat', `dyn/${x}`] }]\n})\n",
        'apps/miniapp-taro/src',
      )
      return (
        pages.join('|') ===
          'apps/miniapp-taro/src/pages/index/index|apps/miniapp-taro/src/pkg-ai/ai/chat' &&
        unresolved.length === 1
      )
    })(),
  )
  t(
    '㉒ import 子句:具名导入按名路由,默认/命名空间/混用一律整模块(不得少算可达)',
    (() => {
      const names = clauseDemand('{ A, B as C }')
      return (
        JSON.stringify(names) === '["A","B"]' &&
        clauseDemand('Foo, { A }') === null &&
        clauseDemand('* as ns') === null &&
        clauseDemand('') === null
      )
    })(),
  )
  t(
    '㉓ type-only 边不成腿(import type / export type 都不算)',
    (() => {
      const { edges } = parseModuleEdges(
        "import type { A } from './a'\nexport type { B } from './b'\nexport { C } from './c'\n",
      )
      return edges.length === 1 && edges[0].spec === './c'
    })(),
  )
  t(
    '㉔ 阳性对照:被桶文件再导出、但从端入口不可达的副本必须被剔除(真临时 git 仓端到端)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const r = collect(dir, 'head')
        return (
          r.pairs.pairs.length === 0 &&
          r.unreachableLegs.length === 1 &&
          r.unreachableLegs[0].name === 'Foo' &&
          r.unreachableLegs[0].legs.join('|') === 'packages/app/src/components/Foo.tsx' &&
          /从端入口不可达/.test(r.unreachableLegs[0].reason)
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
    '真仓可达性判据在临时仓上没跑通',
  )
  t(
    '㉕ 反向对照:同一组件改成从端入口链上 import ⇒ 必须留在配对里(证明 ㉔ 的红不是恒红)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const r = collect(dir, 'head')
        return (
          r.unreachableLegs.length === 0 &&
          r.pairs.pairs.length === 1 &&
          r.pairs.pairs[0].rn === 'packages/app/src/components/Foo.tsx'
        )
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉖ 解析不到的路径走"未判定",绝不当"不可达"把组件剔掉(成对:与 ㉕ 唯一差别是多一条坏 import)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar, Foo } from '@ihui/rn-app'\nimport { Gone } from './gen/missing'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        const r = collect(dir, 'head')
        const hit = r.undeterminedEdges.some(
          (u) => /missing/.test(u.spec) && !/不存在/.test(u.reason),
        )
        return r.unreachableLegs.length === 0 && r.pairs.pairs.length === 1 && hit
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉗ 逃生口:--pair-all 档退回"同名即配对"(人工核对用,默认档才是可达性判据)',
    (() => {
      const dir = makeFixtureRepo(
        FIXTURE_BASE({
          rn: "import { Bar } from '@ihui/rn-app'\nexport function RootNavigator() { return null }\n",
        }),
      )
      try {
        return collect(dir, 'head', { pairAll: true }).pairs.pairs.length === 1
      } catch (e) {
        return `抛错:${e?.message ?? e}`
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㉘ IC:字形名解析 —— lucide 导入按 PascalCase→kebab,小程序按 LineIcon name,两者可逐名比',
    (() => {
      const rn = iconGlyphs("import { ChevronLeft, Mic as MicIcon } from 'lucide-react-native'\n")
      const mp = iconGlyphs(
        'import LineIcon from "@/components/LineIcon"\n<LineIcon name="chevron-left" size={24} />\n',
      )
      return rn.vector.join(',') === 'chevron-left,mic' && mp.vector.join(',') === 'chevron-left'
    })(),
  )
  t(
    '㉙ IC:CDN 位图当 UI 图标必须计数;带原因的逐行豁免把它抵消(成对对照,证明豁免不是恒放)',
    (() => {
      const pairs = { pairs: [{ name: 'X', miniapp: 'm', rn: 'r' }] }
      const rnSrc = "import { Send } from 'lucide-react-native'\n"
      const bare = iconAudit(pairs, {
        m: 'const a = aizhsUrl("remote-images/send.png")\n<LineIcon name="send" />\n',
        r: rnSrc,
      })
      const withEx = iconAudit(pairs, {
        m: 'const a = aizhsUrl("remote-images/send.png") // icon-bitmap-exempt: 多色品牌插画\n<LineIcon name="send" />\n',
        r: rnSrc,
      })
      return bare.length === 1 && bare[0].bitmap === 1 && withEx.length === 0
    })(),
  )
  t(
    '㉚ IC 与几何判据分开跑:几何已同值而字形集合不同形的族,必须仍被 IC 看见',
    (() => {
      const r = iconAudit({ pairs: [{ name: 'Y', miniapp: 'm', rn: 'r' }] }, {
        m: '<LineIcon name="plus" />',
        r: "import { Plus, Camera } from 'lucide-react-native'\n",
      })
      return r.length === 1 && r[0].bitmap === 0 && r[0].onlyRn.join(',') === 'camera'
    })(),
  )
  t(
    '㉛ IC:字形名三种传法(属性字面量 / 配置数组 icon: / 三元 name={})都必须算进矢量化面;未 import LineIcon 不得乱认(成对)',
    (() => {
      const withChannel =
        'import LineIcon from "@/components/LineIcon"\n' +
        'const G = [{ icon: "camera" }]\n' +
        "<LineIcon name={mode === 'voice' ? 'keyboard' : 'mic'} size={20} />\n" +
        '<LineIcon name="send" size={20} />\n'
      const noChannel = 'const G = [{ icon: "camera" }]\n'
      return (
        iconGlyphs(withChannel).vector.join(',') === 'camera,keyboard,mic,send' &&
        iconGlyphs(noChannel).vector.join(',') === ''
      )
    })(),
  )
  /* 票⑥(2026-09-26)读数面四条不对称 + 具名档解析。
     这一组存在的理由:用户实拍"两端还是不一样",而本门一路报绿 —— 查下来不是台账数字错,
     是**读数面本身两侧不同形**:字距被当尺寸、`w-1/3` 被折成 4px、小程序的 `px-3` 不进集合而
     RN 的 `paddingHorizontal: 12` 进集合,以及最要命的一条 —— 数字一旦收编进 shared spec,
     组件里只剩标识符,前面所有数字形态的提取式全部落空,于是"收进单一源"= 从尺子上消失。
     每条都配正反对照(阴性结论必须有阳性对照,否则等于没测)。 */
  t(
    '㉙ letterSpacing 不是尺寸(反面对照:同键名换成 width 必须仍被读)',
    readGeometry('letterSpacing: 0.2\nfoo: 3\n', 'rn').values.size === 0 &&
      readGeometry('letterSpacing: 0.2\nwidth: 300\n', 'rn').values.has(300),
  )
  t(
    '㉚ 分数宽度 w-1/3 不得被折成 4px;同串里的真档 w-8 仍要读到',
    (() => {
      const g = readGeometry('className="w-1/3"\n', 'miniapp')
      const h = readGeometry('className="w-8"\n', 'miniapp')
      return !g.values.has(4) && !g.values.has(1) && h.values.has(32)
    })(),
  )
  t(
    '㉛ 刻度档 px-3 / gap-4 在小程序侧同样进集合(与 RN 的 paddingHorizontal: 12 对形)',
    (() => {
      const g = readGeometry('className="px-3 gap-4"\n', 'miniapp')
      const r = readGeometry('paddingHorizontal: 12\ngap: 16\n', 'rn')
      return (
        g.values.has(12) && g.values.has(16) && !diffValues(g.values, r.values).onlyRn.length &&
        !diffValues(g.values, r.values).onlyMiniapp.length
      )
    })(),
  )
  t(
    '㉜ 具名档:一端写字面量、另一端读同一 spec 档 ⇒ 必须判同值(旧尺子在这里报"仅小程序档 32")',
    (() => {
      const tiers = { BOTTOM_ACTION_BAR_CONTROL_BOX_PX: 32 }
      // 裸数字写在 RN 侧(该端量纲即逻辑 px);小程序侧的裸数字按 rpx 折半,不是本例要证的口径
      const a = readGeometry('width: 32\n', 'rn', tiers)
      const b = readGeometry(
        'import { BOTTOM_ACTION_BAR_CONTROL_BOX_PX } from "spec"\nwidth: toUnit(BOTTOM_ACTION_BAR_CONTROL_BOX_PX)\n',
        'rn',
        tiers,
      )
      const d = diffValues(a.values, b.values)
      return a.values.has(32) && b.values.has(32) && !d.onlyMiniapp.length && !d.onlyRn.length
    })(),
  )
  t(
    '㉝ 具名档有真分叉时必须现形(上一条的阳性对照:同一通道不能只会藏)',
    (() => {
      const tiers = { BOTTOM_ACTION_BAR_CONTROL_BOX_PX: 32, BOTTOM_ACTION_BAR_OTHER_PX: 44 }
      const a = readGeometry('width: BOTTOM_ACTION_BAR_CONTROL_BOX_PX\n', 'miniapp', tiers)
      const b = readGeometry('width: BOTTOM_ACTION_BAR_OTHER_PX\n', 'rn', tiers)
      const d = diffValues(a.values, b.values)
      return d.onlyMiniapp.join() === '32' && d.onlyRn.join() === '44'
    })(),
  )
  t(
    '㉞ geometry 表的档经 rnGeometry.tapBox 取用同样入集合;换算系数 TARO_RPX_PER_PX 不得当档',
    (() => {
      const src = {
        'packages/design-tokens/src/geometry.js':
          'export const GEOMETRY_PX = {\n  tapBox: 36,\n}\nexport const TARO_RPX_PER_PX = 2\n',
      }
      const tiers = specTiers(src)
      const g = readGeometry('const VOICE = rnGeometry.tapBox\nheight: VOICE\n', 'rn', tiers)
      return tiers['geometry.tapBox'] === 36 && tiers['TARO_RPX_PER_PX'] === undefined && g.values.has(36)
    })(),
  )
  t(
    '㉟ spec 档表按被审面取;面枚举不到任何 *-spec.ts ⇒ 判"无法判定",不得记绿',
    (() => {
      const files = { ...FIXTURE_BASE({}) }
      // 夹具默认带一份 spec(见 FIXTURE_BASE);本例要证的正是"没有具名档来源时门必须喊瞎"
      delete files['packages/shared/src/ui/foo-spec.ts']
      const dir = makeFixtureRepo(files)
      try {
        collect(dir, 'head')
        return '未抛 Undetermined'
      } catch (e) {
        return /spec|Undetermined|无法判定/.test(String(e?.message ?? e))
      } finally {
        rmScratch(dir)
      }
    })(),
  )
  t(
    '㊱ spec 档写成几何表的投影(`= GEOMETRY_PX.controlBox`)仍必须解出数值 —— 否则改成投影就等于回到隐身',
    (() => {
      const tiers = specTiers({
        'packages/design-tokens/src/geometry.js':
          'export const GEOMETRY_PX = {\n  controlBox: 32,\n  controlGlyph: 14,\n}\n',
        'packages/shared/src/ui/x-spec.ts':
          "import { GEOMETRY_PX } from '@ihui/design-tokens'\n" +
          'export const X_CONTROL_BOX_PX = GEOMETRY_PX.controlBox\n' +
          'export const X_CONTROL_GLYPH_PX = GEOMETRY_PX.controlGlyph\n',
      })
      const g = readGeometry('width: X_CONTROL_BOX_PX\nsize={X_CONTROL_GLYPH_PX}\n', 'rn', tiers)
      return (
        tiers.X_CONTROL_BOX_PX === 32 &&
        tiers.X_CONTROL_GLYPH_PX === 14 &&
        g.values.has(32) &&
        g.values.has(14)
      )
    })(),
  )
  t(
    '㊲ 投影源在表里取不到(改名 / 删档)⇒ 该具名档不入表,不得凭名字造一个数',
    (() => {
      const tiers = specTiers({
        'packages/design-tokens/src/geometry.js': 'export const GEOMETRY_PX = {\n  tapBox: 36,\n}\n',
        'packages/shared/src/ui/y-spec.ts':
          'export const Y_GONE_PX = GEOMETRY_PX.renamedAway\nexport const Y_REAL_PX = 20\n',
      })
      return tiers.Y_GONE_PX === undefined && tiers.Y_REAL_PX === 20
    })(),
  )
  t(
    '㊳ SL:一张 spec 档只被一条腿引用必须点名(正反对照:两侧同引用 ⇒ 不列)',
    (() => {
      const tiers = { Z_BOX_PX: 36, Z_GLYPH_PX: 20, 'geometry.tapBox': 36 }
      const pairs = { pairs: [{ name: 'Z', miniapp: 'a/Z.tsx', rn: 'b/Z.tsx' }] }
      const oneLeg = specLegAudit(
        pairs,
        {
          'a/Z.tsx': 'width: toUnit(Z_BOX_PX)\n',
          'b/Z.tsx': 'width: Z_GLYPH_PX\n',
        },
        tiers,
      )
      const bothLegs = specLegAudit(
        pairs,
        {
          'a/Z.tsx': 'width: toUnit(Z_BOX_PX)\nsize: Z_GLYPH_PX\n',
          'b/Z.tsx': 'width: Z_BOX_PX\nsize: Z_GLYPH_PX\n',
        },
        tiers,
      )
      return (
        oneLeg.length === 1 &&
        oneLeg[0].onlyMiniapp.join(',') === 'Z_BOX_PX' &&
        oneLeg[0].onlyRn.join(',') === 'Z_GLYPH_PX' &&
        bothLegs.length === 0
      )
    })(),
  )
  t(
    '㊴ SL 域不含 `geometry.*` 通用档(两侧都无引用 ⇒ 整族不列;有引用也只列 spec 档)',
    (() => {
      const tiers = { 'geometry.tapBox': 36 }
      const pairs = { pairs: [{ name: 'Z', miniapp: 'a/Z.tsx', rn: 'b/Z.tsx' }] }
      const none = specLegAudit(
        pairs,
        { 'a/Z.tsx': 'const t = rnGeometry.tapBox\n', 'b/Z.tsx': 'padding: 8\n' },
        tiers,
      )
      const emptyTiers = specLegAudit(pairs, { 'a/Z.tsx': 'x\n', 'b/Z.tsx': 'y\n' }, {})
      return none.length === 0 && emptyTiers.length === 0
    })(),
  )
  t(
    '㊵ 装车锁:`main` 必须把 `collected.tiers` 喂进 `audit` —— 算出档表又丢掉,等于判据没接线',
    (() => {
      const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
      return /audit\(\s*collected\.pairs,\s*collected\.text,\s*baseline,\s*collected\.tiers\s*\)/.test(
        src,
      )
    })(),
  )
  console.log(`--self-test:${pass} 通过 / ${fail} 失败`)
  return fail ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const rc = runSelfTest()
    if (rc) console.error('❌ 自检失败')
    process.exit(rc)
  }
  try {
    process.exit(main(argv))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  stripComments,
  toPx,
  readGeometry,
  namedConflicts,
  diffValues,
  diffCount,
  scan,
  styleLanguage,
  iconCarriers,
  clauseDemand,
  parseModuleEdges,
  readTaroPages,
  buildReach,
  pruneUnreachableLegs,
  collect,
  audit,
  verdictOf,
  emitBaseline,
  waiverProblem,
  faceFromArgv,
  chooseBaseline,
  parseBaseline,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
