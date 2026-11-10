#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 字体面覆盖与回退链守门(门 313,2026-11-10 立;同日补 T4 书写面臂)。
 *
 * 立因(用户报"界面里字体一个粗一个细,看着不像一个字体"):2026-11-10 逐层现读取证,
 * 病灶四处,而本仓此前没有任何一把门盯着字体这一层(字号/圆角/描边都有门):
 *   T1 字重面断裂 —— 档位表请求 600,而 'HarmonyOS Sans SC' 家族只有 100/300/400/500/700
 *       五面(HarmonyOS Sans 官方只开放 Thin/Light/Regular/Medium/Bold/Black,无 Semibold),
 *       600 全靠浏览器隐式匹配规则代打;隐式规则一旦被改写就静默变脸。
 *   T2 子集覆盖缩水 —— 品牌字体是子集产物,字符集一旦缩水,动态中文立刻落系统字体换脸。
 *       旧值实测 2292 汉字(GB2312 一级缺 2178),业务样本缺字率实测 13.87%。
 *   T3 回退链与假粗卫生 —— --font-sans 缺字时若无确定的中文黑体族,会落到"系统默认
 *       sans-serif"(可能被设成宋体/衬线);单面 display 字体(EDIX)不声明字重区间时,
 *       加粗请求走浏览器合成假粗(笔画涨糊),与同版面真 Bold 并存即"不像一个字体"。
 *   T4 其余书写面同病 —— 排查时发现同一根还散在别的书写面上:营销作用域 Home 窄子集链、
 *       .font-edix 自己的链、小程序 AlimamaFangYuanTi 标题链、扩展注入样式、CLI SSO 过渡页、
 *       CI 邮件 HTML —— 全都"品牌/display 族 + 裸 sans-serif",中间没有任何确定的中文黑体。
 *       T4 把"凡含品牌族的栈必须在裸 sans-serif 之前有中文黑体"变成机器判据,并对
 *       "新出现的品牌族书写面未登记"当场点名(声明集内扫,漏在引入那一刻)。
 *
 * 取不到输入一律 exit 2 显式「未判定」(全局铁律 §0.3),不回落另一个面(守门 118)。
 *
 * 用法:
 *   node scripts/check-typography-face-coverage.mjs --staged   # pre-commit(索引 blob)
 *   node scripts/check-typography-face-coverage.mjs            # 全量审计(HEAD blob)
 *   node scripts/check-typography-face-coverage.mjs --self-test
 *   node scripts/check-typography-face-coverage.mjs --update-baseline   # 唯一写基线出口
 * 应急: HUSKY_SKIP_TYPOGRAPHY_FACE_COVERAGE=1(须人工确认并附定向说明)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  Undetermined,
  catBatch,
  readWorktreeFile,
  selectFace,
  probeFaceSpec,
} from './lib/face-reader.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const GLOBALS_REL = 'apps/web/app/globals.css'
const TOKENS_REL = 'packages/design-tokens/src/styles/tokens.css'
const TYPO_REL = 'packages/design-tokens/src/typography.ts'
const MANIFEST_REL = 'scripts/data/font-subset-manifest.json'
const BASELINE_REL = 'scripts/data/typography-face-baseline.json'

/** T4 射程:已知会渲染中文的字体栈书写面(新增书写面必须同批登记到这里) */
const FONT_STACK_SITES = [
  GLOBALS_REL,
  TOKENS_REL,
  'apps/web/app/(marketing)/marketing-fonts.css',
  'packages/design-tokens/src/styles/base.css',
  'apps/miniapp-taro/src/app.css',
  'apps/miniapp-taro/src/pkg-ai/ai/chat.css',
  'apps/miniapp-taro/src/pages/user/index.css',
  'apps/miniapp-taro/src/pkg-ai/developer/income.css',
  'apps/extension/entrypoints/content.ts',
  'apps/cli/src/lib/sso.ts',
  'apps/api/src/routes/landing.ts',
  '.github/scripts/notify-deploy-failure-ci.mjs',
  'apps/mobile-rn/global.css',
]
const RELS = [
  GLOBALS_REL,
  TOKENS_REL,
  TYPO_REL,
  MANIFEST_REL,
  BASELINE_REL,
  ...FONT_STACK_SITES.slice(2),
]

const BRAND_FAMILY = 'HarmonyOS Sans SC'
/** 中文现代黑体族白名单(衬线/宋体一律不算) */
const CJK_SANS_FAMILIES = [
  'PingFang SC',
  'Microsoft YaHei',
  'Noto Sans SC',
  'Source Han Sans SC',
  'Hiragino Sans GB',
]
/** 排在它们之前即"拉丁优先"的通用族;中文族必须出现在这些之前才不会被截走 */
const LATIN_FIRST_MARKERS = ['ui-sans-serif', 'system-ui']
/** 品牌 / 子集 / display 族:栈里出现它们就必须配中文黑体兜底(T4 触发器) */
const BRAND_STACK_RE = /HarmonyOS Sans SC|AlimamaFangYuanTi|EDIX/
/** 裸泛族:它按用户/系统设置解析,是"缺字换成宋体"的那一格 */
const BARE_GENERIC_RE = /(^|[,(\s])sans-serif(?![\w-])/

const FACE_BLOCK_RE = /@font-face\s*\{([^}]*)\}/g
const DECL_RE = /([\w-]+)\s*:\s*([^;]+);/g
const STACK_DECL_RE = /(?:--font-sans(?:-sc)?|(?<![\w-])font-family)\s*:\s*([^;]+);/g

function unquote(v) {
  return String(v)
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim()
}

/** font-weight 值 → [lo, hi];normal=400 / bold=700 / "600 700"=[600,700];解析不出给 null */
export function parseWeightRange(raw) {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!t) return null
  const kw = { normal: 400, bold: 700, light: 300 }
  const nums = []
  for (const part of t.split(/\s+/)) {
    if (kw[part] !== undefined) nums.push(kw[part])
    else if (/^\d{3}$/.test(part)) nums.push(Number(part))
    else return null
  }
  if (!nums.length) return null
  return [Math.min(...nums), Math.max(...nums)]
}

/** CSS 文本 → [{ family, range, srcs, unicodeRangeRaw, unicodeRange }];@font-face 块 */
export function parseFontFaces(css) {
  const faces = []
  for (const m of css.matchAll(FACE_BLOCK_RE)) {
    const decls = {}
    for (const d of m[1].matchAll(DECL_RE)) {
      const k = d[1].trim()
      if (decls[k] === undefined) decls[k] = d[2].trim()
    }
    const family = decls['font-family'] ? unquote(decls['font-family'].split(',')[0]) : ''
    if (!family) continue
    const unicodeRangeRaw = decls['unicode-range'] ?? ''
    faces.push({
      family,
      range: parseWeightRange(decls['font-weight'] ?? 'normal'),
      srcs: [...String(decls.src ?? '').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(
        (s) => s[1],
      ),
      unicodeRangeRaw,
      unicodeRange: parseUnicodeRange(unicodeRangeRaw),
    })
  }
  return faces
}

/**
 * CSS unicode-range 声明 → 归一化区间([[lo,hi],...],升序、合并相邻与重叠)。
 * 解析不出给 null(空声明 = 未声明;写了但记法不认识 = 解析失败,两者要分开看)。
 * 只支持 `U+XXXX` / `U+XXXX-YYYY`(本仓产出端只写这两种;通配符 `U+4??` 不收)。
 */
export function parseUnicodeRange(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  const parts = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!parts.length) return null
  const intervals = []
  for (const p of parts) {
    const m = /^u\+([0-9a-f]{1,6})(?:-([0-9a-f]{1,6}))?$/i.exec(p)
    if (!m) return null
    const lo = parseInt(m[1], 16)
    const hi = m[2] ? parseInt(m[2], 16) : lo
    if (hi < lo) return null
    intervals.push([lo, hi])
  }
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return mergeIntervals(intervals)
}

/** 区间数组 → 合并相邻与重叠后的区间数组 */
export function mergeIntervals(list) {
  const sorted = list.map((iv) => [iv[0], iv[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const out = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv[0] <= last[1] + 1) {
      if (iv[1] > last[1]) last[1] = iv[1]
      continue
    }
    out.push([iv[0], iv[1]])
  }
  return out
}

/** 码位 → 十六进制串(补零规则与 scripts/subset-fonts.py 的 _fmt_hex 逐字一致) */
function hexCp(cp) {
  return cp.toString(16).toUpperCase().padStart(4, '0')
}

/** 区间数组 → 规范化 range 文本(sha 对账基准,两端必须逐字一致) */
export function canonicalRangeText(intervals) {
  return intervals
    .map(([lo, hi]) => (hi > lo ? `U+${hexCp(lo)}-${hexCp(hi)}` : `U+${hexCp(lo)}`))
    .join(', ')
}

/** 区间数组 → 码位总数 */
export function intervalCodepoints(intervals) {
  if (!Array.isArray(intervals)) return 0
  let n = 0
  for (const [lo, hi] of intervals) n += hi - lo + 1
  return n
}

/** 若干区间数组求并 */
export function unionIntervals(list) {
  return mergeIntervals(list.flat())
}

/** 两个区间数组求交 */
export function intersectIntervals(a, b) {
  const out = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0])
    const hi = Math.min(a[i][1], b[j][1])
    if (lo <= hi) out.push([lo, hi])
    if (a[i][1] < b[j][1]) i += 1
    else j += 1
  }
  return out
}

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** 档位表请求的字重集合 = FONT_WEIGHTS 值 ∪ TYPE_STEPS 的 weight ∪ tokens.css 的 --text-*--font-weight */
export function collectRequestedWeights(typoSrc, tokensCss) {
  const set = new Set()
  const fw = typoSrc.match(/FONT_WEIGHTS\s*=\s*\{([^}]*)\}/)
  if (fw) for (const n of fw[1].matchAll(/:\s*(\d{3})/g)) set.add(Number(n[1]))
  for (const n of typoSrc.matchAll(/\bweight:\s*(\d{3})\b/g)) set.add(Number(n[1]))
  for (const n of tokensCss.matchAll(/--text-[\w-]*--font-weight:\s*(\d{3})/g))
    set.add(Number(n[1]))
  return [...set].sort((a, b) => a - b)
}

/** T1:被请求字重必须有显式区间覆盖;返回未覆盖清单 */
export function findUncoveredWeights(faces, family, requested) {
  const mine = faces.filter((f) => f.family === family && f.range)
  return requested.filter((w) => !mine.some((f) => f.range[0] <= w && w <= f.range[1]))
}

/** T3a:--font-sans 里中文黑体族必须存在且排在拉丁通用族之前 */
export function checkFallbackChain(tokensCss) {
  const m = tokensCss.match(/--font-sans:\s*([\s\S]*?);/)
  if (!m) return { ok: false, reason: 'tokens.css 找不到 --font-sans 声明' }
  const value = stripComments(m[1])
  const idx = (name) => value.toLowerCase().indexOf(name.toLowerCase())
  const cjkHits = CJK_SANS_FAMILIES.map(idx).filter((i) => i >= 0)
  if (!cjkHits.length) {
    return { ok: false, reason: '--font-sans 不含任何中文现代黑体族(缺字将落系统默认 sans-serif)' }
  }
  const latinIdx = LATIN_FIRST_MARKERS.map(idx).filter((i) => i >= 0)
  if (latinIdx.length && Math.min(...cjkHits) > Math.min(...latinIdx)) {
    return { ok: false, reason: '中文黑体族排在 ui-sans-serif/system-ui 之后,缺字会被拉丁族截走' }
  }
  return { ok: true }
}

/** T3b:单面 display 家族必须声明字重区间,否则加粗请求走合成假粗 */
export function checkDisplaySynthesis(faces) {
  const byFamily = new Map()
  for (const f of faces) {
    if (!byFamily.has(f.family)) byFamily.set(f.family, [])
    byFamily.get(f.family).push(f)
  }
  const bad = []
  for (const [family, list] of byFamily) {
    if (family === BRAND_FAMILY) continue
    if (list.length > 1) continue
    const [f] = list
    if (!f.range) bad.push({ family, why: '无 font-weight 声明' })
    else if (f.range[0] === f.range[1]) bad.push({ family, why: `只声明单点 ${f.range[0]}` })
  }
  return bad
}

/** T2:manifest 各档汉字数对基线做防回退棘轮 + 哨兵必须过 */
export function checkSubsetRatchet(manifest, baseline) {
  const findings = []
  for (const [tier, min] of Object.entries(baseline.minCjk ?? {})) {
    const cur = manifest?.tiers?.[tier]?.cjk
    if (cur === undefined) {
      findings.push(`档 ${tier} 在 manifest 里查不到汉字数(取不到即未判定,不折成 0)`)
      continue
    }
    if (cur < min)
      findings.push(`档 ${tier} 汉字数 ${cur} < 基线 ${min}(子集缩水=动态中文换脸回潮)`)
  }
  if (manifest?.sentinel && manifest.sentinel.ok !== true) {
    findings.push(`缺字哨兵未过: ${JSON.stringify(manifest.sentinel).slice(0, 160)}`)
  }
  return findings
}

/**
 * T5:同族同字重区间内的多面 unicode-range 必须严格互补,且覆盖该档应有码位。
 *
 * 病灶(2026-11-10 真 Chromium 实测):常规面**不**声明 unicode-range ⇒ 它隐式覆盖
 * **全部**码位 ⇒ 罕见字面(带精确 range)永远抢不过它 —— 浏览器在两面都命中时按声明
 * 顺序取先声明的那一面 ⇒ 罕见字落到系统字体(实测「昇啰厏」渲染成 Microsoft YaHei)。
 * 反过来若把常规面的 range 写成整段(如 U+4E00-9FFF)同样会与罕见面重叠 ⇒ 一样的病。
 *
 * 四条判据:
 *   R1 同组内两面都声明了 range ⇒ 交集必须为空(重叠 ⇒ 罕见字被抢走)
 *   R2 同组内不得混用「声明了 range 的面」与「未声明的面」(未声明者隐式覆盖全部码位)
 *   R3 声明的 range 必须与 manifest 里该产物的实测(码位数/段数/sha256)一致
 *   R4 同组内各面 range 的并集码位数必须等于各面产出码位数之和(覆盖不得有洞)
 *
 * 防恒红:只对**声明了 range** 的面提要求;manifest 里取不到实测值时该条不发言
 * (§0.3「没判 ≠ 判过」),不折成 0、不冒红。
 */
export function checkUnicodeRangeExclusivity(faces, family, manifestFaces) {
  const findings = []
  const mine = faces.filter((f) => f.family === family)
  if (!mine.length) return findings
  const manifestByDst = new Map((manifestFaces ?? []).map((m) => [m.dst, m]))
  const dstOf = (f) => f.srcs.map((s) => String(s).split('/').pop()).find((n) => manifestByDst.has(n))

  // ── R3 声明与产出一致 ──
  for (const f of mine) {
    if (!f.unicodeRangeRaw) continue
    if (!f.unicodeRange) {
      findings.push(
        `T5 '${family}' 面的 unicode-range 解析不出(${f.srcs.join(', ')}):只认 U+XXXX / U+XXXX-YYYY 记法`,
      )
      continue
    }
    const dst = dstOf(f)
    if (!dst) {
      findings.push(
        `T5 '${family}' 面 ${f.srcs.join(', ')} 声明了 unicode-range,但 manifest 里查不到该产物(重跑 scripts/subset-fonts.py)`,
      )
      continue
    }
    const entry = manifestByDst.get(dst)
    if (entry.faceCodepoints === undefined || entry.rangeSha === undefined) {
      findings.push(
        `T5 manifest 里 ${dst} 缺 faceCodepoints/rangeSha(旧清单未实测码位)⇒ 本条未判定,重跑 scripts/subset-fonts.py`,
      )
      continue
    }
    const cp = intervalCodepoints(f.unicodeRange)
    const seg = f.unicodeRange.length
    const sha = sha256Hex(canonicalRangeText(f.unicodeRange))
    if (cp !== entry.faceCodepoints)
      findings.push(
        `T5 ${dst} 声明 range 覆盖 ${cp} 码位,产出面实测 ${entry.faceCodepoints} 码位(声明与产出漂移)`,
      )
    if (seg !== entry.rangeSegments)
      findings.push(
        `T5 ${dst} 声明 range ${seg} 段,产出面实测 ${entry.rangeSegments} 段(声明与产出漂移)`,
      )
    if (sha !== entry.rangeSha)
      findings.push(`T5 ${dst} 声明 range 的 sha256 与产出面实测不一致(声明与产出漂移)`)
  }

  // ── 分组:字重区间相交的算同一组(同族同字重才可能互相抢字)──
  const groups = new Map()
  for (const w of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
    const set = mine.filter((f) => f.range && f.range[0] <= w && w <= f.range[1])
    if (set.length < 2) continue
    const key = set
      .map((f) => f.srcs.join('|'))
      .sort()
      .join(' # ')
    if (!groups.has(key)) groups.set(key, set)
  }

  for (const group of groups.values()) {
    const declared = group.filter((f) => f.unicodeRangeRaw)
    const undeclared = group.filter((f) => !f.unicodeRangeRaw)
    const label = group.map((f) => f.srcs.join(',') || '(无 src)').join(' | ')
    if (declared.length && undeclared.length) {
      findings.push(
        `T5 '${family}' 字重组内混用「声明了 unicode-range 的面」与「未声明的面」(${label}):未声明的面隐式覆盖全部码位,会抢走带 range 面的字(罕见字换脸)`,
      )
      continue
    }
    if (declared.length < 2) continue
    // ── R1 两两不得相交 ──
    for (let i = 0; i < declared.length; i += 1) {
      for (let j = i + 1; j < declared.length; j += 1) {
        const ov = intersectIntervals(declared[i].unicodeRange ?? [], declared[j].unicodeRange ?? [])
        if (ov.length) {
          findings.push(
            `T5 '${family}' 同字重两面的 unicode-range 重叠 ${intervalCodepoints(ov)} 码位(${declared[i].srcs.join(',')} ∩ ${declared[j].srcs.join(',')}):浏览器按声明顺序取先声明的那一面 ⇒ 罕见字换脸`,
          )
        }
      }
    }
    // ── R4 并集码位数 == 各面产出码位数之和(覆盖不得有洞)──
    const union = unionIntervals(declared.map((f) => f.unicodeRange ?? []))
    let sum = 0
    let known = true
    for (const f of declared) {
      const dst = dstOf(f)
      const entry = dst ? manifestByDst.get(dst) : null
      if (!entry || entry.faceCodepoints === undefined) {
        known = false
        break
      }
      sum += entry.faceCodepoints
    }
    if (!known) continue
    const unionCp = intervalCodepoints(union)
    if (unionCp !== sum) {
      findings.push(
        `T5 '${family}' 同字重各面的 range 并集覆盖 ${unionCp} 码位,各面产出合计 ${sum} 码位(覆盖有洞或越界)`,
      )
    }
  }
  return findings
}

function stripComments(text) {
  return String(text ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * T4:凡含品牌/子集/display 族的字体栈,必须在**裸 sans-serif** 之前有确定中文黑体族。
 * 只看声明面文本,不看注释;@font-face 块跳过(那里 font-family 是族名而非栈)。
 * 返回 [{ snippet, why }]。
 */
export function checkBrandStacks(text) {
  const body = stripComments(stripFontFaceBlocks(text))
  const out = []
  for (const m of body.matchAll(STACK_DECL_RE)) {
    const stack = m[1]
    if (!BRAND_STACK_RE.test(stack)) continue
    const bare = stack.search(BARE_GENERIC_RE)
    const cjk = Math.min(
      ...CJK_SANS_FAMILIES.map((f) => {
        const i = stack.toLowerCase().indexOf(f.toLowerCase())
        return i >= 0 ? i : Infinity
      }),
    )
    const snippet = stack.replace(/\s+/g, ' ').trim().slice(0, 90)
    if (!Number.isFinite(cjk)) {
      out.push({
        snippet,
        why: '栈里没有中文现代黑体族,品牌/子集字体缺的字将交给裸 sans-serif(可能被设成宋体)',
      })
      continue
    }
    if (bare >= 0 && cjk > bare) {
      out.push({ snippet, why: '中文黑体族排在裸 sans-serif 之后,缺字先被泛族截走' })
    }
  }
  return out
}

function stripFontFaceBlocks(text) {
  return String(text ?? '').replace(/@font-face\s*\{[^}]*\}/g, '')
}

/** globals.css 引用的本地字体相对路径(去 query) */
export function referencedFontPaths(faces) {
  const out = new Set()
  for (const f of faces) {
    for (const s of f.srcs)
      if (s.startsWith('/fonts/')) out.add('apps/web/public' + s.split('?')[0])
  }
  return [...out].sort()
}

export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

export function readFaceInputs(repoRoot, face) {
  if (face === 'worktree') {
    const out = {}
    for (const rel of RELS) {
      const t = readWorktreeFile(repoRoot, rel)
      if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${rel}`)
      out[rel] = t
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = RELS.map((rel) => prefix + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 26 })
  const out = {}
  for (let i = 0; i < RELS.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined) {
      throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${RELS[i]}`)
    }
    out[RELS[i]] = t
  }
  return out
}

/** 字体二进制只问"本面上存不存在",不读内容 */
export function findMissingFontFiles(repoRoot, face, rels) {
  const missing = []
  for (const rel of rels) {
    if (face === 'worktree') {
      try {
        readFileSync(join(repoRoot, rel))
      } catch {
        missing.push(rel)
      }
      continue
    }
    const probe = probeFaceSpec(repoRoot, (face === 'staged' ? ':' : 'HEAD:') + rel)
    if (!probe.ok) missing.push(rel)
  }
  return missing
}

/**
 * 装配 T4 登记维的取材集:声明集里**不在 RELS 的文件也要取到正文**。
 *
 * 病灶(2026-11-10 实测):旧写法是 `if (RELS.includes(rel)) declaredInputs[rel] = inputs[rel]`,
 * 于是"声明集里新出现的书写面"永远拿不到正文 ⇒ `findUnregisteredStackSites` 的
 * `typeof text !== 'string'` 分支直接跳过它 ⇒ **纯函数有牙、生产调用路径没牙**:
 * 新写了带品牌字体栈的文件这件事永远不会被点名(实测 `income.css` 返回 `[]`)。
 *
 * 修法方向 = 多要一次定向说明(不削判据):声明集里出现的新书写面必须被要求登记进
 * FONT_STACK_SITES。取不到正文 ⇒ 该路径本轮不发言(不记绿也不冒红),保持 §0.3。
 *
 * @param {{declared:string[], inputs:Record<string,string>, readExtra:(rel:string)=>string|null|undefined}} arg
 * @returns {Record<string,string>} 声明集里可读到的正文
 */
export function assembleDeclaredInputs({ declared, inputs, readExtra }) {
  const out = {}
  const list = Array.isArray(declared) ? declared : []
  for (const rel of list) {
    if (RELS.includes(rel)) {
      out[rel] = inputs[rel]
      continue
    }
    if (!/\.(css|ts|tsx|mjs|js)$/.test(rel)) continue
    const t = readExtra(rel)
    if (typeof t === 'string') out[rel] = t
  }
  return out
}

/**
 * T4 登记维:本次声明集里若出现了带品牌族的新书写面(不在 FONT_STACK_SITES),点名要求登记。
 * 只在拿得到声明集时判;拿不到 ⇒ 该维不发言(不把"没判"写成"判过")。
 */
export function findUnregisteredStackSites(declaredPaths, inputs) {
  if (!Array.isArray(declaredPaths) || declaredPaths.length === 0) return []
  const hits = []
  for (const rel of declaredPaths) {
    if (FONT_STACK_SITES.includes(rel)) continue
    if (!/\.css$|\.ts$|\.tsx$|\.mjs$|\.js$/.test(rel)) continue
    const text = inputs[rel]
    if (typeof text !== 'string') continue
    if (BRAND_STACK_RE.test(stripFontFaceBlocks(stripComments(text)))) hits.push(rel)
  }
  return hits
}

export function judge({
  globalsCss,
  tokensCss,
  typoSrc,
  manifestText,
  baselineText,
  missingFonts,
  stackSites = [],
  unregisteredSites = [],
}) {
  const findings = []
  const faces = parseFontFaces(globalsCss)
  const requested = collectRequestedWeights(typoSrc, tokensCss)
  const uncovered = findUncoveredWeights(faces, BRAND_FAMILY, requested)
  if (uncovered.length) {
    findings.push(
      `T1 档位表请求的字重 ${uncovered.join('/')} 在 '${BRAND_FAMILY}' 无显式 @font-face 区间覆盖(只能靠浏览器隐式代打,观感随时会漂)`,
    )
  }
  const manifestObj = JSON.parse(manifestText)
  const ratchet = checkSubsetRatchet(manifestObj, JSON.parse(baselineText))
  for (const r of ratchet) findings.push(`T2 ${r}`)
  for (const f of checkUnicodeRangeExclusivity(faces, BRAND_FAMILY, manifestObj.faces ?? [])) {
    findings.push(f)
  }
  if (missingFonts.length) {
    findings.push(`T2 globals.css 引用但本面上不存在的字体文件: ${missingFonts.join(', ')}`)
  }
  const chain = checkFallbackChain(tokensCss)
  if (!chain.ok) findings.push(`T3 --font-sans 回退链: ${chain.reason}`)
  for (const s of checkDisplaySynthesis(faces)) {
    findings.push(
      `T3 display 家族 '${s.family}' ${s.why} ⇒ 加粗请求走浏览器合成假粗(与真 Bold 并存即换脸感)`,
    )
  }
  for (const site of stackSites) {
    for (const bad of checkBrandStacks(site.text)) {
      findings.push(`T4 ${site.rel} 字体栈缺中文黑体兜底(${bad.why}):${bad.snippet}`)
    }
  }
  if (unregisteredSites.length) {
    findings.push(
      `T4 出现品牌/display 族但未登记进 FONT_STACK_SITES 的书写面: ${unregisteredSites.join(', ')}(新增中文书写面必须同批登记,否则该面不受本门覆盖)`,
    )
  }
  return { findings, requested, faceCount: faces.length }
}

function runSelfTest() {
  const fails = []
  const css = [
    "@font-face { font-family: 'HarmonyOS Sans SC'; font-weight: 400; src: url('/fonts/a.woff2'); }",
    "@font-face { font-family: 'HarmonyOS Sans SC'; font-weight: 600 700; src: url('/fonts/b.woff2'); }",
    "@font-face { font-family: 'EDIX'; font-weight: 400 700; src: url('/fonts/c.woff2'); }",
  ].join('\n')
  const faces = parseFontFaces(css)
  if (faces.length !== 3) fails.push(`@font-face 解析数应为 3,实得 ${faces.length}`)
  if (parseWeightRange('600 700')[1] !== 700) fails.push('区间解析失败')
  if (parseWeightRange('normal')[0] !== 400) fails.push('normal 应折成 400')
  if (findUncoveredWeights(faces, BRAND_FAMILY, [400, 700]).length) fails.push('已覆盖字重被误判')
  if (findUncoveredWeights(faces, BRAND_FAMILY, [450]).join() !== '450')
    fails.push('450 应判未覆盖')
  if (checkDisplaySynthesis(faces).length) fails.push('已声明区间的 display 家族被误判')
  const badEdix = parseFontFaces(
    css.replace("'EDIX'; font-weight: 400 700", "'EDIX'; font-weight: normal"),
  )
  if (checkDisplaySynthesis(badEdix).length !== 1) fails.push('单点声明的 EDIX 未被判出')
  const good =
    '@theme { --font-sans: "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif; }'
  if (!checkFallbackChain(good).ok) fails.push('合规回退链被误判')
  const latinFirst =
    '@theme { --font-sans: "HarmonyOS Sans SC", ui-sans-serif, system-ui, "PingFang SC", sans-serif; }'
  if (checkFallbackChain(latinFirst).ok) fails.push('中文族排在 ui-sans-serif 之后未判出')
  const noCjk = '@theme { --font-sans: "HarmonyOS Sans SC", ui-sans-serif, sans-serif; }'
  if (checkFallbackChain(noCjk).ok) fails.push('缺中文黑体族未判出')
  const baseline = { minCjk: { 'gb2312-l12': 7155 } }
  if (
    checkSubsetRatchet({ tiers: { 'gb2312-l12': { cjk: 7155 } }, sentinel: { ok: true } }, baseline)
      .length
  )
    fails.push('等值基线被误判为缩水')
  if (
    !checkSubsetRatchet(
      { tiers: { 'gb2312-l12': { cjk: 2292 } }, sentinel: { ok: true } },
      baseline,
    ).length
  )
    fails.push('子集缩水未被判出')
  if (checkSubsetRatchet({ tiers: {}, sentinel: { ok: false } }, baseline).length < 2)
    fails.push('缺档与哨兵未过应各判一条')
  if (referencedFontPaths(faces).length !== 3) fails.push('字体引用路径解析数应为 3')
  const typo = [
    'export const TYPE_STEPS = { title: { size: 16, lineHeight: 24, weight: 600 } } as const',
    'export const FONT_WEIGHTS = { regular: 400, medium: 500, semibold: 600, bold: 700 } as const',
  ].join('\n')
  const got = collectRequestedWeights(typo, '@theme { --text-strong--font-weight: 500; }')
  if (got.join() !== '400,500,600,700') fails.push(`档位字重集合异常(单行形): ${got.join()}`)
  const typoMulti = [
    'export const TYPE_STEPS = {',
    '  body: { size: 14, lineHeight: 20, weight: 400 },',
    '  title: { size: 16, lineHeight: 24, weight: 600 },',
    '} as const satisfies Record<string, TypeStep>',
    'export const FONT_WEIGHTS = {',
    '  regular: 400,',
    '  medium: 500,',
    '  semibold: 600,',
    '  bold: 700,',
    '} as const',
  ].join('\n')
  const gotMulti = collectRequestedWeights(typoMulti, '')
  if (gotMulti.join() !== '400,500,600,700')
    fails.push(`档位字重集合异常(多行形): ${gotMulti.join()}`)

  // ── T4 正反例 ──
  const okStack =
    ".x { font-family: 'AlimamaFangYuanTi', 'PingFang SC', 'Microsoft YaHei', sans-serif; }"
  if (checkBrandStacks(okStack).length) fails.push('T4 合规栈被误判')
  const badStack = ".x { font-family: 'AlimamaFangYuanTi', -apple-system, sans-serif; }"
  if (checkBrandStacks(badStack).length !== 1) fails.push('T4 缺中文黑体的品牌栈未被判出')
  const lateCjk = ".x { font-family: 'EDIX', sans-serif, 'PingFang SC'; }"
  if (checkBrandStacks(lateCjk).length !== 1) fails.push('T4 中文族排在裸 sans-serif 之后未被判出')
  const latinOnly = '.y { font-family: Menlo, Consolas, monospace; }'
  if (checkBrandStacks(latinOnly).length) fails.push('T4 不应管非品牌栈')
  const faceOnly = "@font-face { font-family: 'HarmonyOS Sans SC'; src: url('/fonts/a.woff2'); }"
  if (checkBrandStacks(faceOnly).length) fails.push('T4 不应把 @font-face 的族名当字体栈判')
  const inComment = "/* 'EDIX', sans-serif */ .z { color: red; }"
  if (checkBrandStacks(inComment).length) fails.push('T4 把注释内容当成了声明')
  const unreg = findUnregisteredStackSites(['apps/web/src/new-place.css'], {
    'apps/web/src/new-place.css': ".a { font-family: 'HarmonyOS Sans SC', sans-serif; }",
  })
  if (unreg.join() !== 'apps/web/src/new-place.css') fails.push('T4 新书写面未登记未被点名')
  if (findUnregisteredStackSites([], { 'x.css': 'EDIX' }).length)
    fails.push('拿不到声明集时不应发言')

  // ── T5 正反例(unicode-range 互补)──
  const t5Css = [
    "@font-face { font-family: 'HarmonyOS Sans SC'; font-weight: 400; src: url('/fonts/reg.woff2'); unicode-range: U+0020-007F, U+4E00-4EFF; }",
    "@font-face { font-family: 'HarmonyOS Sans SC'; font-weight: 400; src: url('/fonts/rare.woff2'); unicode-range: U+5000-9FFF; }",
  ].join('\n')
  const t5ManifestFor = (fs) => ({
    faces: fs.map((f) => ({
      dst: f.srcs[0].split('/').pop(),
      faceCodepoints: intervalCodepoints(f.unicodeRange),
      rangeSegments: f.unicodeRange ? f.unicodeRange.length : 0,
      rangeSha: f.unicodeRange ? sha256Hex(canonicalRangeText(f.unicodeRange)) : '',
    })),
  })
  const t5Faces = parseFontFaces(t5Css)
  if (checkUnicodeRangeExclusivity(t5Faces, BRAND_FAMILY, t5ManifestFor(t5Faces).faces).length)
    fails.push('T5 严格互补的两面被误判')
  const t5Overlap = parseFontFaces(t5Css.replace('U+5000-9FFF', 'U+4E00-9FFF'))
  if (
    !checkUnicodeRangeExclusivity(t5Overlap, BRAND_FAMILY, t5ManifestFor(t5Overlap).faces)
      .some((f) => f.includes('重叠'))
  )
    fails.push('T5 range 重叠未被判出')
  const t5Hole = t5ManifestFor(t5Faces)
  t5Hole.faces[1].faceCodepoints += 100
  if (
    !checkUnicodeRangeExclusivity(t5Faces, BRAND_FAMILY, t5Hole.faces).some((f) =>
      f.includes('覆盖有洞或越界'),
    )
  )
    fails.push('T5 覆盖不全未被判出')
  const t5Mixed = parseFontFaces(
    t5Css.replace(" src: url('/fonts/rare.woff2'); unicode-range: U+5000-9FFF;", " src: url('/fonts/rare.woff2');"),
  )
  if (
    !checkUnicodeRangeExclusivity(t5Mixed, BRAND_FAMILY, t5ManifestFor(t5Mixed).faces).some((f) =>
      f.includes('隐式覆盖全部码位'),
    )
  )
    fails.push('T5 同组混用「声明/未声明 range」未被判出')
  if (parseUnicodeRange('U+4E00-9FFF')[0].join() !== '19968,40959')
    fails.push('unicode-range 解析异常')
  if (parseUnicodeRange('U+4??') !== null) fails.push('通配符 range 应当解析不出')
  if (parseUnicodeRange('') !== null) fails.push('空 range 应当解析不出(未声明 ≠ 解析失败)')

  for (const line of fails.length ? ['SELF-TEST FAIL', ...fails] : ['SELF-TEST PASS'])
    console.log(line)
  return fails.length ? 1 : 0
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return runSelfTest()
  const { face, error } = faceFromArgv(argv)
  if (error) {
    console.log(`❌ 未判定: ${error}`)
    return 2
  }
  if (argv.includes('--update-baseline')) {
    const inputs = readFaceInputs(ROOT, 'worktree')
    const manifest = JSON.parse(inputs[MANIFEST_REL])
    const minCjk = {}
    // 只钉 GB2312 宽档:它们是确定性字表,基线不会因无关提交漂移。
    // 窄档由源码扫描得出,钉它会造出"删一个中文字就红"的恒红门(§12e)。
    for (const [t, v] of Object.entries(manifest.tiers ?? {})) {
      if (t.startsWith('gb2312')) minCjk[t] = v.cjk
    }
    const out = {
      note: '字体子集汉字数防回退基线;唯一写入口 = node scripts/check-typography-face-coverage.mjs --update-baseline(取工作树面)',
      generatedFrom: 'scripts/data/font-subset-manifest.json',
      minCjk,
    }
    writeFileSync(join(ROOT, BASELINE_REL), JSON.stringify(out, null, 2) + '\n', 'utf8')
    console.log(`✅ 基线已刷新: ${JSON.stringify(minCjk)}`)
    return 0
  }
  const inputs = readFaceInputs(ROOT, face)
  const faces = parseFontFaces(inputs[GLOBALS_REL])
  const missingFonts = findMissingFontFiles(ROOT, face, referencedFontPaths(faces))
  const stackSites = FONT_STACK_SITES.map((rel) => ({ rel, text: inputs[rel] ?? '' }))
  const declared = (process.env.IHUI_DECLARED_FILES ?? '')
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const declaredInputs = assembleDeclaredInputs({
    declared,
    inputs,
    readExtra: (rel) => {
      if (face === 'worktree') return readWorktreeFile(ROOT, rel)
      const prefix = face === 'staged' ? ':' : 'HEAD:'
      try {
        const got = catBatch(ROOT, [prefix + rel], { maxBuffer: 1 << 26 })
        const t = got.get(prefix + rel)
        return typeof t === 'string' ? t : null
      } catch {
        return null
      }
    },
  })
  const unregistered = findUnregisteredStackSites(declared, declaredInputs)
  const { findings, requested } = judge({
    globalsCss: inputs[GLOBALS_REL],
    tokensCss: inputs[TOKENS_REL],
    typoSrc: inputs[TYPO_REL],
    manifestText: inputs[MANIFEST_REL],
    baselineText: inputs[BASELINE_REL],
    missingFonts,
    stackSites,
    unregisteredSites: unregistered,
  })
  const label =
    face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(逃生舱)' : 'HEAD blob'
  if (!findings.length) {
    console.log(
      `✅ 字体面覆盖对账通过(${label}):档位字重 ${requested.join('/')} 全部有面,@font-face ${faces.length} 面,引用字体文件齐备,T4 书写面 ${FONT_STACK_SITES.length} 处中文兜底齐备${declared.length ? `(声明集 ${declared.length} 路径已扫登记维)` : '(声明集未给出,登记维不发言)'}`,
    )
    return 0
  }
  console.log(`❌ 字体面覆盖对账(${label})发现 ${findings.length} 处:`)
  for (const f of findings) console.log(`  · ${f}`)
  console.log(
    '  💡 出路:重跑宽子集 `python scripts/subset-fonts.py --src-dir <官方 HarmonyOS_Sans_SC TTF 目录>`' +
      '(含缺字哨兵),再同步 globals.css 的 @font-face;基线只经 --update-baseline 写;' +
      '新增中文书写面请同批登记进本门 FONT_STACK_SITES。',
  )
  return 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      if (e instanceof Undetermined) {
        console.log(`⚠️ 未判定: ${e.message}`)
        process.exitCode = 2
      } else {
        console.log(`❌ 门自身异常: ${e?.message ?? e}\n${e?.stack ?? ''}`)
        process.exitCode = 2
      }
    })
}

export const __test__ = {
  parseWeightRange,
  parseFontFaces,
  parseUnicodeRange,
  mergeIntervals,
  unionIntervals,
  intersectIntervals,
  canonicalRangeText,
  intervalCodepoints,
  sha256Hex,
  collectRequestedWeights,
  findUncoveredWeights,
  checkFallbackChain,
  checkDisplaySynthesis,
  checkSubsetRatchet,
  checkUnicodeRangeExclusivity,
  checkBrandStacks,
  findUnregisteredStackSites,
  assembleDeclaredInputs,
  referencedFontPaths,
  faceFromArgv,
  findMissingFontFiles,
  judge,
  CJK_SANS_FAMILIES,
  BRAND_FAMILY,
  BRAND_STACK_RE,
  FONT_STACK_SITES,
  RELS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
