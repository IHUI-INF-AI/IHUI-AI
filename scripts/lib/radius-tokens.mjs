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
 *  2. **圆角豁免标记**:该族标记曾是"真圆/装饰点/胶囊按同行或紧邻上行放行"的出口。出口已于
 *     O81 票㊵ **整体废除**(项目定档「不允许有任何豁免」),本文件里那道按行放行的判断随之删除;
 *     剩下的"认出哪里写过它"住在 `lib/radius-exempt-marker.mjs`,由门 77(判红)与门 150(报名)
 *     共用那一份 —— 两处各写一遍正则,同一枚标记就会一边被判红、一边被当成不存在。
 */

/** 剥掉块注释与行注释后的等行文本(行号不变 —— 判红要指得回原文行,删字符会错位)。 */
import { RPX_PER_PX, lengthToPx, constantMapOf, constExprPx } from './length-units.mjs'
/**
 * "这条半径相对它自己那个盒是几何真圆/胶囊还是档位取用"的判定**只有一份实现**,住在
 * `lib/box-geometry.mjs`(守门 77 的 B1/C6 用的就是它)。RD 维要排除真圆/胶囊时必须调它,
 * 不得在本文件另写一份 `radius == box/2` 的等式 —— 两处算同一件事必漂移(§22c/守门 135 记过多次)。
 * 无环:box-geometry 只依赖 length-units,本文件也依赖 length-units,半径层引入几何层不成回边。
 */
import { classifyRadiusGeometry } from './box-geometry.mjs'
/**
 * 单位折算与常量归集**住在 `lib/length-units.mjs`**,本文件只再导出(既有调用方的 import 一行都不用改):
 * 半径侧与盒形侧量的是同一个物理量,写两份折算必然漂移;而几何层只需要单位层,不该被拖进本文件的
 * 圆角专属逻辑(radiusLookup / 标记识别)—— 那会让每一个按文件清单搭的几何夹具都得复制圆角层。
 */
export { RPX_PER_PX, lengthToPx, constantMapOf, constExprPx }

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
    // **同一个坑的值侧版本**(2026-09-27 实测):`hero: '2xl'` 的值以数字开头,旧值支只认
    // "字母开头的标识符"或"纯数字"两态 ⇒ 这一行整体不匹配 ⇒ 表里没有 role:hero,
    // 于是守门 150 把三个 hero 站点报成 role-not-in-table(读起来像代码问题,其实是解析器丢项),
    // 而且 hero 这一档从此**永不可判**。值支现在同样认数字开头的档名。
    const m =
      /^\s*'?(?:([A-Za-z_$][\w$]*|\d[\w$]*))'?\s*:\s*'?'?([A-Za-z_$][\w$]*|\d[\w$]*)'?'?\s*,?\s*$/.exec(
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
 * 圆角豁免标记族的识别式住在 `lib/radius-exempt-marker.mjs`(该族的放行语义已由 O81 票㊵ 整体废除,
 * 只剩"认出哪里写过它"这一半,被门 77 判红与门 150 报名共用那一份)。本文件不再转它:
 * 单位折算层与档位表层都不该因为一个禁令正则而多一个依赖面。
 */


/**
 * 一行源码里的圆角**取档** → px 数组。逐行调用,好让豁免规则按行生效。
 * 覆盖六种书写形态:Tailwind 档名类(含**方向与角形态** `rounded-t-xl` / `rounded-tr-sm`)、
 * Tailwind 任意值(带 rpx/px)、CSS 变量、
 * `rnRadius.<step>` / `rnRadius['2xl']`、`rnRadiusFor.<role>`、裸 `borderRadius: <数字>`。
 *
 * 方向形态必须与整格形态同一遍识别,不是"顺手多认一种写法":小程序把底部弹层写成
 * `rounded-t-2xl` 而 RN 写成整格 `rnRadius['2xl']` 时,旧判据只在小程序那一侧读不到 16,
 * 于是产出"仅 RN 16"这种**凭空造出的分叉** —— 尺子漏读一侧的表现不是少几个数,
 * 而是把同一档报成两端不同档。补认之后实测 RD 只降不升(Carousel / LoginPopUp /
 * ModelConfigDialog / ModelList 四族归零,InputArea / DrawerComponent / UserInfoCard 各降),
 * 所以它抬高的是覆盖面,不是债务。
 *
 * `rounded-full` / `rounded-none` 不在此列:前者是"胶囊/正圆"那一型(守门 11 与 77 管),
 * 后者是 0,都不是"这个元素该取哪一档"的判断。
 */



/**
 * 把一个"半径被除数"折成 px。**解不到就返回 null**,由调用方报名 —— 拿被除数当半径是错的
 * 读数,而错的读数比"没读数"更贵(它会替真圆与胶囊两个等式都给出自相矛盾的答案)。
 * 支持:档位(`rnRadius.lg` / `rnRadius['2xl]`)、角色档(`rnRadiusFor.panel`)、`rpx(40)`、
 * 带单位字面量(`60rpx` / `8px` / `0.5rem`)、同文件常量标识符(最多再解一层,防环)。
 */
export function radiusOperandPx(text, table, consts, depth = 0) {
  const t = (text || '')
    // CSS 侧写成 `calc(60rpx / 2)` —— 括号只是包裹,先剥掉再按形态解释。
    .trim()
    .replace(/^calc\(/, '')
    .replace(/\)$/, '')
    .trim()
  if (!t) return null
  const step =
    /\brnRadius\s*(?:\.\s*(xs|sm|md|lg|xl|2xl)\b|\[\s*['"](2xl|xs|sm|md|lg|xl)['"]\s*\])/.exec(t)
  if (step) return table[step[1] ?? step[2]] ?? null
  const role = /\brnRadiusFor\s*(?:\.\s*(\w+)\b|\[\s*['"](\w+)['"]\s*\])/.exec(t)
  if (role) return table[`role:${role[1] ?? role[2]}`] ?? null
  const direct = lengthToPx(t)
  if (direct !== null) return direct
  /**
   * 其余形态(成员档 `rnGeometry.tapBox`、指向它们的标识符)交给 `constExprPx` **那一份**求值 ——
   * 半径侧与盒形侧量的是同一批常量,两边各写一遍必然出现"半径认得、盒形不认"的自洽假结论
   * (限深与防自引用也在那一份里:上一版注释写着"防环"而实现没有 depth,`const A = A` 直接
   * 把整门打成 RangeError —— 承诺了防护却没兑现,正是本仓守门 137 判的那一型)。
   */
  return constExprPx(t, consts, depth)
}

/**
 * 一行源码里的圆角取用 → `[{px, raw}]`。`raw` 是**源码原文**(档名 / 数值 / `<被除数> / <数>`),
 * 供 RD 维按 `classifyRadiusGeometry(lines, i, raw)` 判这条半径是几何真圆/胶囊还是档位取用。
 * 之所以要带原文而不是只回 px:几何判据是**字面同形**比较(`width: 48, borderRadius: 24` 认得出,
 * `width: 96rpx` 与折算后的 48px 不互比 —— 拿折算值比会把胶囊读成真圆,见 box-geometry 头注),
 * 折成 px 再分类就等于把"作者写的是不是同一个量"这一维抹掉。
 * `radiusPxInLine` 现在是它到 px 的投影(既有调用方一字不动)。
 */
export function radiusItemsInLine(line, table, consts) {
  const out = []
  const push = (v, raw) => {
    if (Number.isFinite(v) && v > 0) out.push({ px: Math.round(v * 100) / 100, raw })
  }
  for (const m of line.matchAll(/\brounded-(?:(?:tr|tl|br|bl|[tblr])-)?(xs|sm|md|lg|xl|2xl)\b/g)) {
    if (table[m[1]] !== undefined) push(table[m[1]], m[1])
  }
  for (const m of line.matchAll(/\brounded-\[\s*(\d+(?:\.\d+)?)(rpx|px)?\s*\]/g)) {
    push(m[2] === 'rpx' ? Number(m[1]) / RPX_PER_PX : Number(m[1]), `${m[1]}${m[2] || ''}`)
  }
  for (const m of line.matchAll(/var\(--radius-(xs|sm|md|lg|xl|2xl)\)(?!\s*\/)/g)) {
    if (table[m[1]] !== undefined) push(table[m[1]], m[1])
  }
  for (const m of line.matchAll(
    /\brnRadius\s*(?:\.\s*(xs|sm|md|lg|xl|2xl)\b|\[\s*['"](2xl|xs|sm|md|lg|xl)['"]\s*\])(?!\s*\/)/g,
  )) {
    const step = m[1] || m[2]
    if (table[step] !== undefined) push(table[step], step)
  }
  for (const m of line.matchAll(
    /\brnRadiusFor\s*(?:\.\s*(\w+)\b|\[\s*['"](\w+)['"]\s*\])(?!\s*\/)/g,
  )) {
    const role = m[1] || m[2]
    if (table[`role:${role}`] !== undefined) push(table[`role:${role}`], role)
  }
  /**
   * 裸数字半径 —— **不得把除法的被除数当成半径**。旧实现只看 `(?![\w.])`,而 `borderRadius: 60 / 2`
   * 里的 `60` 后面跟的是空格,于是照收 60 —— 而 §4 明令真圆/胶囊"优先 size / 2 表达式",所以这一支
   * 每认一次被除数,就把一个规范写法读成"半径 = 整个边长":真圆等式(半径=半边)与胶囊等式
   * (半径≥短边一半)同时不成立。HEAD 面实测 37 处该形态整族因此对两台尺子隐身。
   * 除法交给下一支,这一支显式排除 `值 / 数`。
   */
  for (const m of line.matchAll(
    /\bborder(?:Top|Bottom)?(?:Left|Right)?Radius\s*:\s*(\d+(?:\.\d+)?)(?![\w.])(?!\s*\/)/g,
  ))
    push(Number(m[1]), m[1])
  /**
   * 除法形态 `borderRadius: <被除数> / <数>`(`60 / 2`、`rnRadius.lg / 2`、`rpx(40) / 2`、
   * `SIZE_PX / 2`)。被除数经 `radiusOperandPx` 折 px 再除右值;**解不到整条不 push**
   * (跨文件常量),由调用方按未判定报名 —— 宁可"读不出",绝不读成一个错的数。
   */
  for (const m of line.matchAll(
    /\bborder(?:Top|Bottom)?(?:Left|Right)?Radius\s*:\s*([^,;{}\n]+?)\s*\/\s*(\d+(?:\.\d+)?)/g,
  )) {
    const left = radiusOperandPx(m[1], table, consts)
    if (left === null) continue
    push(left / Number(m[2]), `${m[1].trim()} / ${m[2]}`)
  }
  /**
   * CSS 声明形态:`border-radius: 8px` / `border-radius: 24rpx` / 四值简写
   * `border-radius: 8px 8px 0 0`。2026-09-27 补 —— 小程序把盒档写进同名 `.css`,只认 RN 驼峰
   * 形态等于"CSS 声明整面隐身"(与守门 83 的 R8、门 128 票⑫的几何漏读样式表同型)。
   * 单位决定换算:`rpx` 是 750 稿半单位要折半,`px` 与无单位按逻辑 px。
   * 百分号形态(`50%`)刻意**不收** —— 那是真圆/胶囊几何,由守门 11 那条维管,收进来会把
   * "正圆"当成一个可选档。
   */
  for (const m of line.matchAll(
    /\bborder(?:-top|bottom)?-(?:left|right)?radius\s*:\s*(\d+(?:\.\d+)?)(rpx|px|%)?(?!\s*\/)(?:\s|;|\*|$)/g,
  )) {
    if (m[2] === '%') continue
    if (m[2] === undefined || m[2] === 'px') push(Number(m[1]), `${m[1]}${m[2] || ''}`)
    else push(Number(m[1]) / RPX_PER_PX, `${m[1]}${m[2] || ''}`)
  }
  /**
   * CSS 侧除法形态(`border-radius: 60rpx / 2`):与 JS 侧共用 `radiusOperandPx` 那一份算术,
   * 不在这里另写一遍单位换算 —— 两处算同一件事必漂移,是本仓记过最多次的失败型。
   */
  for (const m of line.matchAll(
    /\bborder(?:-top|bottom)?-(?:left|right)?radius\s*:\s*([^;{}\n]+?)\s*\/\s*(\d+(?:\.\d+)?)/g,
  )) {
    const left = radiusOperandPx(m[1], table, consts)
    if (left === null) continue
    push(left / Number(m[2]), `${m[1].trim()} / ${m[2]}`)
  }
  // 四值/两值简写:每个长度档都要看见(只取第一个数 = 横向档整族隐身,票⑫同一记实测教训)
  for (const m of line.matchAll(
    /\bborder(?:-top|-bottom)?-(?:left|right)?radius\s*:\s*((?:\d+(?:\.\d+)?(?:rpx|px)?\s+){1,3}\d+(?:\.\d+)?(?:rpx|px)?)/g,
  )) {
    for (const v of m[1].trim().split(/\s+/)) {
      if (/%$/.test(v)) continue
      push(
        /rpx$/.test(v) ? Number(v.replace('rpx', '')) / RPX_PER_PX : Number(v.replace('px', '')),
        v,
      )
    }
  }
  return out
}

/** 一行源码里的圆角取档 → px 数组(`radiusItemsInLine` 到 px 的投影;既有调用方口径不变)。 */
export function radiusPxInLine(line, table, consts) {
  return radiusItemsInLine(line, table, consts).map((it) => it.px)
}

/**
 * 真圆/胶囊那一型:半径由盒的边长决定(`size / 2` 或字面量 `边长`/2),**不是"这一类元素该取哪一档"
 * 的判断**。守门 77 的 B1/C6 用同一把尺(`classifyRadiusGeometry`)认它,只是那道判据的产物是"放行/判红",
 * RD 维的产物是"别把它当成端上多出来的一档"。两者必须共用那一份几何判定 —— 否则门 128 会替门 77 已
 * 认定为"规范真圆写法"的 `IMAGE_REMOVE_SIZE / 2`(HEAD 实测 37 处该族)凭空记上一档,
 * 而那一档在另一端根本没有对应元素 ⇒ 假分叉。几何档只从 RD 档集里排除,RE 维(按元素名配对)不动。
 */
const GEOMETRY_KINDS = new Set(['circle', 'capsule', 'rounded-end'])
function isGeometricRadius(lines, i, raw) {
  if (raw === undefined || raw === null) return false
  return GEOMETRY_KINDS.has(classifyRadiusGeometry(lines, i, raw))
}

/** 整份源码 → 圆角档集合。返回排序后的去重数组。 */
export function radiusSetOf(src, table) {
  /**
   * RD 维的遮噪**必须与 RE 维同一条口径**,所以走本文件那一份唯一的 `maskComments`
   * (RE 的 `radiusEntriesOf` 与 :107 都在用它),不另派生第二遍状态机。
   * 旧实现这里刻意只做"整行注释"判断,理由是"块注释状态机需要字符串感知遮罩,另票做"。
   * 那句理由当时是对的,但半吊子判断的代价是实测到的两型漏读:
   * ① 行尾注释(`borderRadius: rnRadius.md, // 旧写法 rounded-md`)、
   * ② **跨行块注释的续行** —— 真仓 `apps/miniapp-taro/src/components/LoginPopUp.tsx` 里一段
   *   `{/* … 旧写法 rounded-md … */}` 说明文字,让 RD 凭空记上一档 6,账面就写成
   *   "小程序 6 / RN 无"的**假分叉**;下一个人照它去"修",改的是端上本来正确的代码
   *   —— 假阳比漏报更贵(它指使人去修没坏的东西,还把口径说歪成"问题很多")。
   * 残余如实登记:本 mask 仍不认字符串字面量,所以串内含 `/*` 会连代码一起遮掉;
   * 那一格要换 `code-mask.maskComments`(字符串感知),但它同时是 RE 维的锚点输入,
   * 换它必须按守门 128 的"重锚要中和本次读数改动后的旧口径"另笔做,不在这里顺手改。
   */
  const lines = maskComments(src || '').split('\n')
  const consts = constantMapOf(src)
  const set = new Set()
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === '') continue
    /**
     * RD 维排除真圆/胶囊:逐取用点问 `classifyRadiusGeometry`(那份唯一的几何判定)是几何还是档位。
     * 只按 px 值分不了(UserInfoCard 头像 24 = 48 边 / 2,而 rnRadius.xl 也 = 12 —— 同值两义),
     * 必须带着源码原文与同一作用域的边长量。排除只发生在这里(RD 档集);RE 维按元素名配对另有判据。
     */
    for (const it of radiusItemsInLine(lines[i], table, consts)) {
      if (isGeometricRadius(lines, i, it.raw)) continue
      set.add(it.px)
    }
  }
  return [...set].sort((a, b) => a - b)
}

/**
 * 一行源码里圆角**归属于哪个元素名**:区分 JS 对象键与 CSS 选择器两种书写语言。
 *
 * CSS 选择器必须**按逗号分组、每组取最后一个类名** —— 后代选择器 `.a__item .a__label { … }`
 * 被样式化的是 `.a__label`,把祖先也算进去就是给一个没设圆角的元素凭空记上一档,
 * 而只要另一端恰有同名元素就会造出**假分叉**。逗号分组保留 `.a, .b { … }` 这两个真主体。
 *
 * JS 侧只认**行首的** `name:`(样式键)。不这样收窄会命中 `const styles: Record<…> = {`
 * 这类带类型注解的声明,把 `styles` 当成元素名。
 *
 * @returns {{ names: string[], css: boolean }}
 */
export function blockOwnerOf(prelude) {
  const t = (prelude || '').trim()
  if (!t) return { names: [], css: false }
  const key = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(t)
  if (key) return { names: [key[1]], css: false }
  if (!t.includes('.')) return { names: [], css: false }
  const names = []
  for (const grp of t.split(',')) {
    const all = [...grp.matchAll(/\.([A-Za-z_][\w-]*)/g)]
    if (all.length) names.push(all[all.length - 1][1])
  }
  // 选择器行不会以 `:` 结尾之外的形态混进 JS 档 —— 只收真出现 `.类名` 的情况。
  return names.length ? { names: [...new Set(names)], css: true } : { names: [], css: false }
}

/**
 * 源码 → **按元素名归属**的圆角档表。守门 128 的 RE 维用,与 `radiusSetOf` 并列而非替换。
 *
 * 为什么必须有这一维(`radiusSetOf` 不够用的实测理由):
 * `radiusSetOf` 把一个文件里读到的**所有**圆角值收成集合再求差,于是"一侧空集"会被报成
 * 跨端分叉 —— 而它只说明那一侧的文件里没有圆角声明,**根本不证明同一命名元素两端不同形**
 * (真仓实测:`NavBar` 报「小程序[4] vs RN[]」、`VideoPlayer` 报「小程序[] vs RN[8]」)。
 * 按那种读数去给单端补数字,等于制造视觉回归。RE 只在**键名/类名两侧都在**时才判等不等。
 *
 * 覆盖的书写形态(与 `radiusPxInLine` 同一份判据,不另写解析):
 *  - JS 样式键 `card: { borderRadius: rnRadius.xl }`、`card: (tk) => ({ … })`(含跨行块)
 *  - CSS 规则 `.card { border-radius: var(--radius-lg) }`(含多行选择器、逗号分组)
 *  - `className="card rounded-lg"` —— 同串里存在**本文件样式表真定义过的类名**时才归给它;
 *    纯 utility 串(flex / w-full 那类)没有元素名可归,计入 `unnamed` 如实报数。
 *
 * 已知边界(漏判方向,绝不误判):
 *  - **注释整行/整块不计**:走本文件唯一的 `maskComments`,串内内容保留(否则
 *    `className="rounded-lg"` 会一起被抹掉 —— 判据看不见真取用)。代价是含 `//` 的 URL 字面量
 *    会把该行后半截断 ⇒ 那一处圆角漏读;`radiusSetOf` 为避开这个坑只做了"整行注释"判断,
 *    RE 要判"注释里写的档不得计入",必须比它更进一步,所以这里选的是**宁可漏不误判**的方向。
 *  - 匿名块(函数体、JSX 内联 `style={{ … }}`)拿不到元素名 ⇒ `unnamed`,不猜名字。
 *  - 两端元素**不同名不配对**(kebab 的 `.mcd-upload-btn` 与 camel 的 `uploadBtn` 不并档)——
 *    这是设计而非缺陷:并档就是"猜",而猜出来的配对会产出假分叉。
 *
 * @returns {{ entries: Record<string, number[]>, unnamed: number, cssNames: string[] }}
 */
export function radiusEntriesOf(src, table) {
  const lines = maskComments(src || '').split('\n')
  const entries = {}
  const cssNames = new Set()
  let unnamed = 0
  const add = (name, px) => {
    if (!Number.isFinite(px) || px <= 0) return
    const cur = entries[name] || (entries[name] = [])
    if (!cur.includes(px)) cur.push(px)
  }
  const stack = [] // { names: string[], indent: number }
  // 除法形态半径(`SIZE / 2`)的被除数常量大多定义在同一份源码里,这里归集一次供逐行使用。
  const consts = constantMapOf(src)
  let pending = '' // 多行 CSS 选择器(`.a,` 换行 `.b {`)的预读
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const t = raw.trim()
    if (!t) continue
    const indent = raw.length - raw.trimStart().length
    const isCloser = /^[})\]]/.test(t)
    if (isCloser) {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    }
    const openAt = t.indexOf('{')
    let names = stack.length ? stack[stack.length - 1].names : []
    if (openAt >= 0) {
      const opens = (t.match(/\{/g) || []).length
      const closes = (t.match(/[}\]]/g) || []).length
      const owner = blockOwnerOf(pending + t.slice(0, openAt))
      pending = ''
      names = owner.names
      if (owner.css) for (const n of owner.names) cssNames.add(n)
      // 同行自包含(`card: { … },`)不入栈:入栈会把这个名字一直挂到后面的无关行上。
      if (closes < opens) stack.push({ names, indent })
    } else if (!isCloser && /^\.{1}[A-Za-z_]/.test(t)) {
      pending = (pending + ' ' + t).slice(-400)
      continue
    } else if (!isCloser) {
      pending = ''
    }
    const pxs = radiusPxInLine(raw, table, consts)
    if (!pxs.length) continue
    /**
     * 类名串形态整条交给第二遍(只有它能归到真类名)。第一遍若也记一次,同一处取用会在
     * `unnamed` 与 `entries` 里各长一笔 —— 覆盖面读数虚高,而"有多少圆角无处归属"恰是
     * 下一票要不要扩配对判据的唯一输入,报错的数比不报更坏。
     */
    if (/\bclass(?:Name)?\s*=/.test(raw)) continue
    if (!names.length) {
      unnamed += pxs.length
      continue
    }
    for (const n of names) for (const p of pxs) add(n, p)
  }
  /**
   * 第二遍:`className` 串里的圆角档归给**同串里那个真实存在样式表的类名**。
   * 必须两遍分开 —— 第一遍跑完才知道本文件定义了哪些类名;先跑第一遍再跑这一遍,
   * 顺序本身是判据的一部分(反过来会有一半的类名认不出来)。
   */
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const at = raw.search(/\bclass(?:Name)?\s*=/)
    if (at < 0) continue
    const lits = [...raw.slice(at).matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
    if (!lits.length) continue
    const text = lits.join(' ')
    const pxs = radiusPxInLine(text, table, consts)
    if (!pxs.length) continue
    const toks = new Set(text.split(/[\s{}]+/).filter(Boolean))
    const known = [...toks].filter((k) => cssNames.has(k))
    if (!known.length) {
      unnamed += pxs.length
      continue
    }
    for (const n of known) for (const p of pxs) add(n, p)
  }
  for (const k of Object.keys(entries)) entries[k].sort((a, b) => a - b)
  return { entries, unnamed, cssNames: [...cssNames].sort() }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
