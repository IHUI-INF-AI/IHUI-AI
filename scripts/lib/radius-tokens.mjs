// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 圆角取用的**共享判据**(守门 77 与守门 128 共用一份实现)。
 *
 * 为什么要有这个文件:两件事各自被两道门算过一遍,而"两处算同一件事必漂移"是本仓记过最多次
 * 的失败型 ——
 *  1. **档位表取值**:唯一真相源是 `packages/design-tokens/src/radius.js`。门若把 `lg=8` 抄进
 *     自己的判据,档位表一改(2026-09-23 就把 sm 从 2px 改成 4px)门就悄悄在对着旧表打分。
 *     所以这里**解析被审面上的那份表**,而不是 import 磁盘常量 —— 与"清单与内容同面同轮"同一条规矩。
 *  2. **`radius-exempt` 的生效范围**:真圆/装饰点/胶囊按"同行或紧邻上一行有标记"放行。77 与 128
 *     若各写一遍,同一处豁免会一边认、一边判红 —— 那是台必然恒红的尺子。
 */

/** 剥掉块注释与行注释后的等行文本(行号不变 —— 豁免规则按行生效,删字符会错位)。 */
function maskComments(src) {
  const out = []
  let inBlock = false
  for (const line of (src || '').split('\n')) {
    if (inBlock) {
      const end = line.indexOf('*/')
      out.push(end >= 0 ? line.slice(end + 2) : '')
      if (end >= 0) inBlock = false
      continue
    }
    const start = line.indexOf('/*')
    if (start >= 0) {
      const rest = line.slice(start + 2)
      const end = rest.indexOf('*/')
      if (end >= 0) {
        out.push(line.slice(0, start) + rest.slice(end + 2))
      } else {
        out.push(line.slice(0, start))
        inBlock = true
      }
      continue
    }
    const slash = line.indexOf('//')
    out.push(slash >= 0 ? line.slice(0, slash) : line)
  }
  return out.join('\n')
}

/** 取 `export const <NAME> = { … }` 块里的 `键: 值` 对(键可带引号,值可为数字或标识符)。 */
function objectEntries(masked, name) {
  const start = masked.indexOf(name)
  if (start < 0) return []
  const brace = masked.indexOf('{', start)
  if (brace < 0) return []
  let depth = 0
  let end = -1
  for (let i = brace; i < masked.length; i++) {
    if (masked[i] === '{') depth++
    else if (masked[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) return []
  const body = masked.slice(brace + 1, end)
  const out = []
  for (const line of body.split('\n')) {
    // 键与值两态都要认:档位**值**是数字(`xs: 2`)、角色**值**是档位名标识符(`card: 'lg'`);
    // 键则可能是数字开头的引号档名(`'2xl': 16`)—— 漏掉它就等于把 16px 这一整档从尺子上抹掉,
    // 实测 FloatBox 小程序侧因此读成空集。"空表/空集"会被下游读成"没有差异",那是台瞎掉的尺子。
    const m =
      /^\s*'?(?:([A-Za-z_$][\w$]*|\d[\w$]*))'?\s*:\s*'?'?([A-Za-z_$][\w$]*|\d+(?:\.\d+)?)'?'?\s*,?\s*$/.exec(
        line,
      )
    if (m) out.push([m[1], m[2]])
  }
  return out
}

/**
 * radius.js 源码 → 一张**扁平查表**:档位名(`lg` → 8)与角色名(`role:card` → 8)同表。
 * 角色档必须也读得出数值 —— 把 `rnRadius.xl` 改成 `rnRadiusFor.panel` 是收敛的正确姿势,
 * 若判据只认裸档位名,这次收敛反而让跨端差异从尺子上消失(守门 128 的 SL 维记过同一型)。
 */
export function radiusLookup(radiusSrc) {
  const masked = maskComments(radiusSrc)
  const steps = objectEntries(masked, 'RADIUS_STEPS')
  if (!steps.length) return null
  const table = {}
  for (const [k, v] of steps) {
    const n = Number(v)
    if (Number.isFinite(n)) table[k] = n
  }
  for (const [role, step] of objectEntries(masked, 'RADIUS_ROLES')) {
    if (table[step] !== undefined) table[`role:${role}`] = table[step]
  }
  return Object.keys(table).length ? table : null
}

/**
 * `radius-exempt` 是否覆盖第 i 行(0 基)。规则与守门 77 原文同形:本行或紧邻上一行。
 * 不得放宽成"整块/整个文件豁免" —— 一个标记救一棵子树,等于没有这条豁免。
 */
export function isRadiusExemptAt(lines, i) {
  if (/radius-exempt/.test(lines[i] || '')) return true
  return i > 0 && /radius-exempt/.test(lines[i - 1] || '')
}

/** 小程序 rpx 是 750 稿半单位(与守门 77 / geometry 同口径)。 */
export const RPX_PER_PX = 2

/**
 * 一行源码里的圆角**取档** → px 数组。逐行调用,好让豁免规则按行生效。
 * 覆盖六种书写形态:Tailwind 档名类、Tailwind 任意值(带 rpx/px)、CSS 变量、
 * `rnRadius.<step>` / `rnRadius['2xl']`、`rnRadiusFor.<role>`、裸 `borderRadius: <数字>`。
 *
 * `rounded-full` / `rounded-none` 不在此列:前者是"胶囊/正圆"那一型(守门 11 与 77 管),
 * 后者是 0,都不是"这个元素该取哪一档"的判断。
 */
export function radiusPxInLine(line, table) {
  const out = []
  const push = (v) => {
    if (Number.isFinite(v) && v > 0) out.push(Math.round(v * 100) / 100)
  }
  for (const m of line.matchAll(/\brounded-(xs|sm|md|lg|xl|2xl)\b/g)) {
    if (table[m[1]] !== undefined) push(table[m[1]])
  }
  for (const m of line.matchAll(/\brounded-\[\s*(\d+(?:\.\d+)?)(rpx|px)?\s*\]/g)) {
    push(m[2] === 'rpx' ? Number(m[1]) / RPX_PER_PX : Number(m[1]))
  }
  for (const m of line.matchAll(/var\(--radius-(xs|sm|md|lg|xl|2xl)\)/g)) {
    if (table[m[1]] !== undefined) push(table[m[1]])
  }
  for (const m of line.matchAll(
    /\brnRadius\s*(?:\.\s*(xs|sm|md|lg|xl|2xl)\b|\[\s*['"](2xl|xs|sm|md|lg|xl)['"]\s*\])/g,
  )) {
    const step = m[1] || m[2]
    if (table[step] !== undefined) push(table[step])
  }
  for (const m of line.matchAll(/\brnRadiusFor\s*(?:\.\s*(\w+)\b|\[\s*['"](\w+)['"]\s*\])/g)) {
    const role = m[1] || m[2]
    if (table[`role:${role}`] !== undefined) push(table[`role:${role}`])
  }
  for (const m of line.matchAll(
    /\bborder(?:Top|Bottom)?(?:Left|Right)?Radius\s*:\s*(\d+(?:\.\d+)?)(?![\w.])/g,
  ))
    push(Number(m[1]))
  /**
   * CSS 声明形态:`border-radius: 8px` / `border-radius: 24rpx` / 四值简写
   * `border-radius: 8px 8px 0 0`。2026-09-27 补 —— 小程序把盒档写进同名 `.css`,只认 RN 驼峰
   * 形态等于"CSS 声明整面隐身"(与守门 83 的 R8、门 128 票⑫的几何漏读样式表同型)。
   * 单位决定换算:`rpx` 是 750 稿半单位要折半,`px` 与无单位按逻辑 px。
   * 百分号形态(`50%`)刻意**不收** —— 那是真圆/胶囊几何,由守门 11 那条维管,收进来会把
   * "正圆"当成一个可选档。
   */
  for (const m of line.matchAll(
    /\bborder(?:-top|bottom)?-(?:left|right)?radius\s*:\s*(\d+(?:\.\d+)?)(rpx|px|%)?(?:\s|;|\/|\*|$)/g,
  )) {
    if (m[2] === '%') continue
    if (m[2] === undefined || m[2] === 'px') push(Number(m[1]))
    else push(Number(m[1]) / RPX_PER_PX)
  }
  // 四值/两值简写:每个长度档都要看见(只取第一个数 = 横向档整族隐身,票⑫同一记实测教训)
  for (const m of line.matchAll(
    /\bborder(?:-top|-bottom)?-(?:left|right)?radius\s*:\s*((?:\d+(?:\.\d+)?(?:rpx|px)?\s+){1,3}\d+(?:\.\d+)?(?:rpx|px)?)/g,
  )) {
    for (const v of m[1].trim().split(/\s+/)) {
      if (/%$/.test(v)) continue
      push(/rpx$/.test(v) ? Number(v.replace('rpx', '')) / RPX_PER_PX : Number(v.replace('px', '')))
    }
  }
  return out
}

/** 整份源码 → 圆角档集合(按行遮豁免)。返回排序后的去重数组。 */
export function radiusSetOf(src, table) {
  const lines = (src || '').split('\n')
  const set = new Set()
  for (let i = 0; i < lines.length; i++) {
    if (isRadiusExemptAt(lines, i)) continue
    const t = lines[i].trim()
    /**
     * 整行注释一律跳过:注释里出现 `rounded-2xl` / `border-radius: 50%` 是在**说明规则或对齐
     * 意图**,不是取用。实测本仓第一例假阳就是 `ModelConfigDialog.css:16` 那句
     * "用规范圆角 rounded-2xl 等价" 被读成 16px 档,把一族的锚点顶高了一格。
     * 刻意只做"整行注释"这一条零风险判断,不上块注释状态机 —— 串内含 `/*` 会让状态机把代码
     * 当注释吃掉(守门 70 的 `'https://x/*'` 假绿同型),那需要一份字符串感知的遮罩,另票做。
     */
    if (/^(\/\/|\/\*|\*|\{\/\*|<!--)/.test(t)) continue
    for (const px of radiusPxInLine(lines[i], table)) set.add(px)
  }
  return [...set].sort((a, b) => a - b)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
