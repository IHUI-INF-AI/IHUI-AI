#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-cross-end-tokens.mjs - Guard: RN color tokens (rn-tokens.ts) vs
 * miniapp/web color tokens (design-tokens/tokens.css) drift for
 * semantically-identical pairs.
 *
 * 两端唯一定义处:
 *   RN:        packages/design-tokens/src/rn-tokens.ts (rnTokens/rnLightTokens/rnDarkTokens, HEX)
 *   miniapp/web: packages/design-tokens/src/styles/tokens.css (@theme+:root 亮色 / .dark 暗色)
 *
 * 映射表只收"确定语义相同"的色值对(宁缺毋滥),每条注明取值依据。
 * 任何映射对值不一致 → ❌ + exit 1(阻塞),防止跨端颜色漂移。
 *
 * 比对规则:比对前归一为统一格式 —— HEX 原样保留(小写+去空白);
 * hsl(h s% l%) / hsl(h, s%, l%) 转换为 #rrggbb 后比对;rgba/hsla 保持原样不转换
 * (rn rgba(78,163,245,0.15) 与 css rgba(78, 163, 245, 0.15) 视为相等)。
 * tokens.css .dark 未覆盖的变量按 CSS cascade 回退到亮色值参与暗色比对。
 *
 * Usage:
 *   node scripts/check-cross-end-tokens.mjs           # full check
 *   node scripts/check-cross-end-tokens.mjs --list    # print mapping table only
 *   node scripts/check-cross-end-tokens.mjs --quiet   # errors only
 *   node scripts/check-cross-end-tokens.mjs --self-test  # 三条判据的正反例取证
 *
 * 除"已声明映射逐位对账"外,还有两条**反自立门户**判据(2026-09-24 补,起因见下):
 *   R2 品牌键覆盖 —— rn-tokens 的 `brand` 命名空间里每个键,必须要么被某条已声明映射覆盖,
 *      要么在 RN_ONLY_BRAND_KEYS 里写明"web 无对应变量"的理由;豁免项若已不存在同样算红(防清单腐烂)。
 *   R3 悬空引用 —— 全仓任何 `tokens.brand.<key>` / `tk.brand.<key>` 形态的引用必须命中已声明键集合
 *      (只认 token 袋前缀:业务代码里局部变量也叫 brand 的不少,裸 `brand.x` 会满天假红)。
 *
 * 为什么补这两条:`brand.ctaFill`/`ctaText` 曾以"浅色=web primary、深色=brand-accent"的混血形态
 * 存在一整天,而本门当时**只核 8 条已声明映射** —— "8/8 in sync"与"1 个端内分叉档"同时为真,
 * 判据对最该管的情形完全失明。2026-09-24 该档已删除,CTA 统一走 brand.DEFAULT+foreground。
 *
 * Exit: 0 = all mappings in sync & no undeclared brand key & no dangling ref, 1 = 红
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const RN_TOKENS_PATH = join(root, 'packages/design-tokens/src/rn-tokens.ts')
const TOKENS_CSS_PATH = join(root, 'packages/design-tokens/src/styles/tokens.css')

const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet') || argv.includes('-q')
const listOnly = argv.includes('--list')
const SELF_TEST = argv.includes('--self-test')

// ─── 映射表(每条含取值依据,rn 路径 = [常量名, ...嵌套键]) ───
const MAPPINGS = [
  {
    label: 'vip.gold ↔ --color-vip-gold-start',
    rn: { light: ['rnLightTokens', 'vip', 'gold'], dark: ['rnDarkTokens', 'vip', 'gold'] },
    css: { light: '--color-vip-gold-start', dark: '--color-vip-gold-start' },
    basis: 'rn-tokens.ts L52 注释「VIP 会员金色(对齐 --color-vip-gold-start/end,明暗同值)」;tokens.css @theme L136,.dark 无覆盖(cascade 回退亮色)',
  },
  {
    label: 'vip.goldEnd ↔ --color-vip-gold-end',
    rn: { light: ['rnLightTokens', 'vip', 'goldEnd'], dark: ['rnDarkTokens', 'vip', 'goldEnd'] },
    css: { light: '--color-vip-gold-end', dark: '--color-vip-gold-end' },
    basis: '同上(rn-tokens.ts L52 注释);tokens.css @theme L137,.dark 无覆盖',
  },
  // 注(2026-09-17):原「surface.inputBg ↔ --color-link-bg」配对已移除。根因:两边语义均已漂移且
  // 不再同源——rn surface.inputBg 已改为中性输入框底色(light #F5F5F5/dark #262626),
  // tokens.css --color-link-bg 已改为链接背景浅蓝透明(light rgba(143,184,204,0.15)/dark
  // rgba(163,196,214,0.14));「输入框背景」与「链接背景」语义不同,强行配对无意义,
  // 与 2026-09-06 移除「indigo.DEFAULT ↔ --color-brand」同一处置模式。
  // 注(2026-09-06):原「indigo.DEFAULT ↔ --color-brand」配对已移除。根因:品牌"统一黑/白"后,
  // tokens.css --color-brand 已从 #6366f1 改为 #000000/#ffffff(对齐 RN brand.DEFAULT 纯黑纯白),
  // 而 RN indigo(强调色 #6366f1/#818cf8)是 RN 专属的 indigo 强调色,web 无 --color-brand 对应。
  // 二者语义不同(token 不同),故不再强行配对;RN indigo 强调色与 web 强调色的对齐属品牌方向决策,待评审。
  {
    label: 'brand.DEFAULT (light) ↔ --color-primary (:root/@theme)',
    rn: { light: ['rnLightTokens', 'brand', 'DEFAULT'] },
    css: { light: '--color-primary' },
    basis: 'rn-tokens.ts L14/L59/L177 注释「brand.DEFAULT = #000000 对齐 web 亮色 --color-primary」;tokens.css @theme L50 --color-primary: hsl(0 0% 0%)(HSL→HEX 归一后 #000000)',
  },
  {
    label: 'brand.DEFAULT (dark) ↔ --color-primary (.dark)',
    rn: { dark: ['rnDarkTokens', 'brand', 'DEFAULT'] },
    css: { dark: '--color-primary' },
    basis: 'rn-tokens.ts L15/L231 注释「brand.DEFAULT = #FFFFFF 对齐 web 暗色 --color-primary(纯白底)」;tokens.css L354 .dark --color-primary: hsl(0 0% 100%)(有覆盖,HSL→HEX 归一后 #ffffff)',
  },
  // 2026-09-24:补上缺的另一半。此前只声明了 DEFAULT 一对,而"CTA = DEFAULT+foreground 成对"里
  // 的 foreground 从没进过对账 —— 于是 web 改了 --color-primary-foreground 而 RN 不改,本门也不会红。
  {
    label: 'brand.foreground (light) ↔ --color-primary-foreground (:root/@theme)',
    rn: { light: ['rnLightTokens', 'brand', 'foreground'] },
    css: { light: '--color-primary-foreground' },
    basis: 'rn-tokens.ts「品牌底(brand.DEFAULT)之上的前景色」;tokens.css @theme --color-primary-foreground: hsl(0 0% 100%)',
  },
  {
    label: 'brand.foreground (dark) ↔ --color-primary-foreground (.dark)',
    rn: { dark: ['rnDarkTokens', 'brand', 'foreground'] },
    css: { dark: '--color-primary-foreground' },
    basis: 'rn-tokens.ts rnDarkTokens brand.foreground = #000000(深色底翻黑前景);tokens.css .dark --color-primary-foreground: hsl(0 0% 0%)',
  },
  // 2026-09-06:danger/错误红对齐。RN danger.DEFAULT + error.text 与 web --color-danger
  // 统一为同一语义口(亮 #dc2626 / 暗 #ef4444),并纳入守门防漂移。
  {
    label: 'danger.DEFAULT (light) ↔ --color-danger (:root)',
    rn: { light: ['rnLightTokens', 'danger', 'DEFAULT'] },
    css: { light: '--color-danger' },
    basis: 'rn-tokens.ts danger.DEFAULT = #dc2626(2026-09-06 对齐 web --color-danger);tokens.css L175 --color-danger: #dc2626',
  },
  {
    label: 'danger.DEFAULT (dark) ↔ --color-danger (.dark)',
    rn: { dark: ['rnDarkTokens', 'danger', 'DEFAULT'] },
    css: { dark: '--color-danger' },
    basis: 'rn-tokens.ts rnDarkTokens danger.DEFAULT = #ef4444(明暗同义对齐 web .dark);tokens.css L457 .dark --color-danger: #ef4444',
  },
]

// ─── 提取:rn-tokens.ts ───

/** 提取 `export const <name> ... = {` 的平衡花括号对象体。 */
function extractTsObjectBody(src, constName) {
  const re = new RegExp(`export const ${constName}[^=]*=\\s*\\{`)
  const m = re.exec(src)
  if (!m) return null
  let i = m.index + m[0].length
  let depth = 1
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    i++
  }
  return src.slice(m.index + m[0].length, i - 1)
}

/** 在对象体内按嵌套键路径解析叶子字符串字面量(如 ['vip','gold'] → '#FFD700')。 */
function resolveTsPath(body, path) {
  let text = body
  for (let idx = 0; idx < path.length; idx++) {
    const key = path[idx]
    const isLeaf = idx === path.length - 1
    const re = new RegExp(`(?:^|[\\s,{])${key}\\s*:`)
    const m = re.exec(text)
    if (!m) return null
    let i = m.index + m[0].length
    while (i < text.length && /\s/.test(text[i])) i++
    if (text[i] === '{') {
      if (isLeaf) return null
      let depth = 1
      i++
      const start = i
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++
        else if (text[i] === '}') depth--
        i++
      }
      text = text.slice(start, i - 1)
    } else {
      if (!isLeaf) return null
      const sm = /^'([^']*)'|^"([^"]*)"/.exec(text.slice(i))
      return sm ? (sm[1] ?? sm[2]) : null
    }
  }
  return null
}

// ─── 提取:tokens.css(复用 check-rn-global-css-sync.mjs 的块提取模式) ───

/** 提取所有匹配 selector 的块内文本(平衡花括号)。 */
function extractAllBlocks(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped + '\\s*\\{', 'g')
  const blocks = []
  let m
  while ((m = re.exec(css)) !== null) {
    let i = m.index + m[0].length
    let depth = 1
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') depth--
      i++
    }
    blocks.push(css.slice(m.index + m[0].length, i - 1))
    re.lastIndex = i
  }
  return blocks
}

/** 提取块内 CSS 变量,返回 { name: value }。 */
function extractCssVars(text) {
  const vars = {}
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(text)) !== null) vars[m[1]] = m[2].trim()
  return vars
}

/** 合并多个 selector 块的变量(后者覆盖前者)。 */
function mergeCssVars(css, selectors) {
  const merged = {}
  for (const sel of selectors)
    for (const block of extractAllBlocks(css, sel)) Object.assign(merged, extractCssVars(block))
  return merged
}

// ─── 比对 ───

/**
 * 品牌命名空间的"已声明键"之外,只允许这份显式清单里的键(web 侧确无对应 CSS 变量的历史档)。
 * 清单本身受 R2 检查:写了却已不存在的键同样算红(防豁免清单腐烂)。
 */
export const RN_ONLY_BRAND_KEYS = {
  dark: '品牌绿 #34D399 只在 RN 侧使用,web/tokens.css 无对应变量;新增品牌色档必须先落 tokens.css 再登记映射',
}

/** 取对象体里某个命名空间(如 brand)的顶层键名列表。 */
export function namespaceKeys(body, ns) {
  const m = new RegExp(`(?:^|[\\s,{])${ns}\\s*:\\s*\\{`).exec(body)
  if (!m) return []
  let i = m.index + m[0].length
  let depth = 1
  const start = i
  while (i < body.length && depth > 0) {
    if (body[i] === '{') depth++
    else if (body[i] === '}') depth--
    i++
  }
  const inner = body.slice(start, i - 1)
  const keys = []
  const re = /(?:^|[,{\n])\s*([A-Za-z_$][\w$]*)\s*:/g
  let mm
  while ((mm = re.exec(inner))) keys.push(mm[1])
  return [...new Set(keys)]
}

/** 映射表里被声明过的 brand 键(path = ['rnLightTokens','brand','DEFAULT'] → 'DEFAULT') */
export function declaredBrandKeys(mappings) {
  const out = new Set()
  for (const mp of mappings)
    for (const mode of ['light', 'dark']) {
      const p = mp.rn[mode]
      if (p && p[1] === 'brand' && p[2]) out.add(p[2])
    }
  return out
}

/** R2:brand 命名空间里出现"既没被映射声明、也不在豁免清单"的键 → 违规(端内自立一档的入口) */
export function checkBrandKeys({ bodies, declared, allowlist }) {
  const bad = []
  const seen = new Set()
  for (const [name, body] of Object.entries(bodies)) {
    for (const key of namespaceKeys(body, 'brand')) {
      seen.add(key)
      if (!declared.has(key) && !(key in allowlist)) bad.push({ where: name, key })
    }
  }
  const stale = Object.keys(allowlist).filter((k) => !seen.has(k))
  return { bad, stale }
}

/**
 * R3:token 袋里引用了不存在的品牌档 → 悬空引用。
 * 编译不一定红(主题袋常被当作宽类型),运行时才是 `undefined` 颜色 —— 与守门 77 的 B6 同一类"两边都不红"。
 *
 * 必须带 token 袋前缀(`tokens.` / `tk.` / `theme.` …):首版只匹配 `brand\.` 就撞上了
 * `BrandMarquee.tsx` 里那个**局部变量也叫 brand**的轮播数据对象(`brand.nameKey` / `brand.src`),
 * 产出成片假红。裸 `brand.x` 在业务代码里语义太多,不收。
 */
export function danglingBrandRefs(text, allowed) {
  const out = []
  const re = /\b(?:tokens|tk|theme|activeTokens|token|t)\s*\.\s*brand\s*\.\s*([A-Za-z_$][\w$]*)\b/g
  let m
  while ((m = re.exec(text))) if (!allowed.has(m[1])) out.push({ key: m[1], at: m[0] })
  return out
}

/** hsl(h s% l%) / hsl(h, s%, l%) → '#rrggbb'。s=0 时 a=0、f(n)=l,灰度边界天然正确。 */
function hslToHex(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = n => {
    const k = (n + h / 30) % 12
    return l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
  }
  const hex = x => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

/**
 * 归一化比对值:HEX 原样保留(小写+去空白);hsl(h s% l%) / hsl(h, s%, l%)
 * 转换为 #rrggbb;rgba/hsla 保持原样不转换(仅小写+去空白)。
 * 注意:必须先提取 hsl 再处理空白 —— 空格分隔格式 `hsl(0 0% 0%)` 一旦
 * 去空白会破坏参数边界,导致无法解析。
 */
function normalizeColor(v) {
  const compact = v.trim().replace(/\s+/g, ' ').toLowerCase()
  const m = /^hsla?\(\s*([\d.]+)\s*(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*\)$/.exec(compact)
  if (m) return hslToHex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]))
  return compact.replace(/\s+/g, '')
}

// ─── Main ───

// §22d 双形态入口:被镜像测试 import 时只拿导出符号,绝不执行 CLI 主流程(读文件 + process.exit)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

export const __test__ = {
  MAPPINGS,
  RN_ONLY_BRAND_KEYS,
  namespaceKeys,
  declaredBrandKeys,
  checkBrandKeys,
  danglingBrandRefs,
  normalizeColor,
  resolveTsPath,
}

if (isDirectRun) process.exit(cli())

function cli() {
if (SELF_TEST) return selfTest()
if (listOnly) {
  console.log('check-cross-end-tokens.mjs 映射表(RN rn-tokens.ts ↔ tokens.css):')
  for (const [i, mp] of MAPPINGS.entries())
    console.log(`  ${i + 1}. ${mp.label}\n     依据: ${mp.basis}`)
  process.exit(0)
}

if (!quiet) console.log('[check-cross-end-tokens] Checking rn-tokens.ts vs tokens.css...')

const rnSrc = readFileSync(RN_TOKENS_PATH, 'utf8')
const cssSrc = readFileSync(TOKENS_CSS_PATH, 'utf8')

const rnBodies = {}
for (const name of ['rnTokens', 'rnLightTokens', 'rnDarkTokens']) {
  rnBodies[name] = extractTsObjectBody(rnSrc, name)
  if (rnBodies[name] === null) {
    console.error(`[check-cross-end-tokens] ❌ 无法在 rn-tokens.ts 中定位 export const ${name}`)
    process.exit(1)
  }
}

// tokens.css: @theme + :root = 亮色;.dark = 暗色(未覆盖变量 cascade 回退亮色)
const cssLight = mergeCssVars(cssSrc, ['@theme', ':root'])
const cssDark = { ...cssLight, ...mergeCssVars(cssSrc, ['.dark']) }

const failures = []
let checked = 0
for (const mp of MAPPINGS) {
  for (const mode of ['light', 'dark']) {
    const rnPath = mp.rn[mode]
    const cssVar = mp.css[mode]
    if (!rnPath || !cssVar) continue
    checked++
    const rnVal = resolveTsPath(rnBodies[rnPath[0]], rnPath.slice(1))
    const table = mode === 'dark' ? cssDark : cssLight
    const cssVal = cssVar in table ? table[cssVar] : null
    const tag = `${mp.label} [${mode}]`
    if (rnVal === null || cssVal === null) {
      failures.push({ tag, detail: `提取失败: rn='${rnVal ?? '<missing>'}' css='${cssVal ?? '<missing>'}'` })
      continue
    }
    if (normalizeColor(rnVal) !== normalizeColor(cssVal))
      failures.push({ tag, detail: `rn='${rnVal}' vs css='${cssVal}'` })
  }
}

// ── R2 品牌键覆盖 + R3 悬空引用(反"端内自立一档",见文件头说明) ──
const declared = declaredBrandKeys(MAPPINGS)
const brand = checkBrandKeys({ bodies: rnBodies, declared, allowlist: RN_ONLY_BRAND_KEYS })
for (const b of brand.bad)
  failures.push({
    tag: `R2 未声明的品牌档 ${b.where}.brand.${b.key}`,
    detail: `web 侧没有对应 CSS 变量、也没登记豁免理由 —— 品牌色必须在 tokens.css 有唯一出口(如 --color-primary)后登记映射;确属 RN 专属则在 RN_ONLY_BRAND_KEYS 写明原因`,
  })
for (const s of brand.stale)
  failures.push({ tag: `R2 豁免清单腐烂`, detail: `RN_ONLY_BRAND_KEYS 里的 '${s}' 在 rn-tokens 已不存在,请删除该条` })

// R3 扫**仓库内容**,不扫共享工作树的未提交缓冲区(并行会话的半截草稿不该钉红别人的提交):
//   缺省 = HEAD;--staged = 只判"索引 ≠ HEAD"的路径的索引 blob(= 这次提交会带走的内容)。
//   注意 `git grep --cached` 扫的是**整个索引**(所有跟踪文件),不是暂存变更集 —— 首跑直接用它
//   把八竿子不着的历史内容判出 81 处,故必须自己取"暂存变更集"再逐个读索引 blob。
// 只扫 apps/ + packages/ 的 ts/tsx:scripts/ 下的守门脚本与文档会在注释里提到已退役的档名(ctaFill 即此),
// 那不是引用,不需要为它们再发明一套豁免语法。
const stagedMode = argv.includes('--staged')
const refs = []
const GREP = ['-c', 'safe.directory=*', 'grep', '-n', '--no-color', '-e', '\\.brand\\.']
try {
  if (!stagedMode) {
    refs.push(...execFileSync('git', [...GREP, 'HEAD', '--', 'apps', 'packages'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout: 60_000 }).split('\n').filter(Boolean))
  } else {
    const staged = execFileSync('git', ['-c', 'safe.directory=*', 'diff', '--name-only', '--cached', '--', 'apps', 'packages'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26, windowsHide: true, timeout: 60_000 })
      .split('\n')
      .filter((f) => /\.(ts|tsx)$/.test(f))
    for (const rel of staged) {
      let blob = null
      try {
        blob = execFileSync('git', ['-c', 'safe.directory=*', 'show', `:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true, timeout: 30_000 })
      } catch {
        continue // 本次删除的路径:索引里已无内容
      }
      blob
        .split('\n')
        .forEach((l, i) => {
          if (/\.brand\./.test(l)) refs.push(`${rel}:${i + 1}:${l}`)
        })
    }
  }
} catch (e) {
  if (e && e.status === 1) {
    /* git grep 无命中 = 退出码 1,属正常 */
  } else {
    failures.push({ tag: 'R3 悬空引用', detail: `git 未能执行(${String((e && e.message) || e).slice(0, 90)}),按失败处理,不静默放行` })
  }
}
const allowedKeys = new Set([...declared, ...Object.keys(RN_ONLY_BRAND_KEYS)])
const dangling = []
for (const line of refs) for (const d of danglingBrandRefs(line, allowedKeys)) dangling.push({ line, ...d })
for (const d of dangling.slice(0, 12))
  failures.push({
    tag: 'R3 悬空 brand 引用',
    detail: `${d.line.slice(0, 120)} —— '${d.key}' 不是已声明的品牌档(可用:${[...allowedKeys].join('/')});CTA 一律 brand.DEFAULT + brand.foreground`,
  })
if (dangling.length > 12) failures.push({ tag: 'R3 悬空 brand 引用', detail: `…另有 ${dangling.length - 12} 处` })

if (failures.length === 0) {
  if (!quiet) console.log(`[check-cross-end-tokens] ✅ ${checked} 条映射逐位同值 + 品牌键全部已声明(${[...allowedKeys].join('/')}) + 无悬空 brand 引用(${stagedMode ? '索引' : 'HEAD'} 口径)`)
  process.exit(0)
}

console.error(`[check-cross-end-tokens] Found ${failures.length} problem(s) (映射对账 ${checked} 条):`)
for (const f of failures) console.error(`  ❌ ${f.tag}: ${f.detail}`)
console.error('  值不一致 = 两端有一侧改了没同步,请人工决策对齐方向;R2/R3 = 品牌色不得在端内自立一档(AGENTS §4 跨端同源)。')
process.exit(1)
}

// ─── 自检(不读真仓,纯判据正反例;--self-test) ───
function selfTest() {
  const bodies = {
    ok: `
  brand: { DEFAULT: '#000000', foreground: '#FFFFFF', dark: '#34D399' },
  surface: { light: '#FFFFFF' },
`,
    forked: `
  brand: { DEFAULT: '#000000', foreground: '#FFFFFF', ctaFill: '#000000', ctaText: '#FFFFFF', dark: '#34D399' },
  surface: { light: '#FFFFFF' },
`,
  }
  const declared = declaredBrandKeys(MAPPINGS)
  const cases = [
    { name: 'brand 键全部已声明 → 绿', got: checkBrandKeys({ bodies: { a: bodies.ok }, declared, allowlist: RN_ONLY_BRAND_KEYS }), wantBad: 0, wantStale: 0 },
    { name: '自立 ctaFill/ctaText → 红并点名两键', got: checkBrandKeys({ bodies: { a: bodies.forked }, declared, allowlist: RN_ONLY_BRAND_KEYS }), wantBad: 2, wantStale: 0 },
    { name: '键集合解析不误伤兄弟命名空间(surface.light 不算 brand 键)', got: { bad: namespaceKeys(bodies.ok, 'surface').map((k) => ({ key: k })), stale: [] }, wantBad: 1, wantStale: 0 },
  ]
  let fail = 0
  for (const c of cases) {
    const badN = c.got.bad ? c.got.bad.length : 0
    const staleN = c.got.stale ? c.got.stale.length : 0
    const ok = badN === c.wantBad && staleN === c.wantStale
    if (!ok) fail++
    console.log(`${ok ? '✅' : '❌'} ${c.name} (bad=${badN}/${c.wantBad} stale=${staleN}/${c.wantStale})`)
  }
  const allowed = new Set([...declared, ...Object.keys(RN_ONLY_BRAND_KEYS)])
  const refCases = [
    { name: 'R3 已声明档 → 不报', text: 'const x = tk.brand.DEFAULT', want: 0 },
    { name: 'R3 退役档必须报(8 个滞后草稿就是这个形态)', text: 'backgroundColor: tokens.brand.ctaFill', want: 1 },
    { name: 'R3 主题袋别名形态(tk./theme./t.)一样要管', text: 'const a = theme.brand.ctaText', want: 1 },
    // 假红防线:业务代码里**局部变量也叫 brand** 很常见(轮播数据、品牌列表),裸 brand.x 不收
    { name: 'R3 正向对照:局部变量 brand 的属性引用不得判红(BrandMarquee 实测踩到)', text: 'const brand = { nameKey: "x", src: "y" }\n<Tooltip key={brand.nameKey}><img src={brand.src}/>', want: 0 },
  ]
  for (const c of refCases) {
    const n = danglingBrandRefs(c.text, allowed).length
    const ok = n === c.want
    if (!ok) fail++
    console.log(`${ok ? '✅' : '❌'} ${c.name} (命中 ${n},期望 ${c.want})`)
  }
  // 豁免清单必须"写了就真存在":真仓里跑一次 stale
  const real = checkBrandKeys({ bodies: { rnLightTokens: extractTsObjectBody(readFileSync(RN_TOKENS_PATH, 'utf8'), 'rnLightTokens') }, declared, allowlist: RN_ONLY_BRAND_KEYS })
  const allowOk = real.stale.length === 0 && real.bad.length === 0
  if (!allowOk) fail++
  console.log(`${allowOk ? '✅' : '❌'} 真仓 rnLightTokens.brand 键全被声明或豁免覆盖(bad=${real.bad.length} stale=${real.stale.length})`)
  const totalCases = cases.length + refCases.length + 1
  console.log(fail ? `❌ self-test 失败 ${fail} 例` : `✅ self-test 全通过(${totalCases} 例)`)
  return fail ? 1 : 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
