// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 长度单位折算 + 同文件数字常量归集。
 *
 * 为什么单独成一层:圆角半径与盒尺寸量的是**同一个物理量**,折算口径只能有一份实现
 * (本仓为"两处算同一件事"开过不止一票:门 128 票⑫ 的 rpx 折半、box-geometry 的单位归一、
 * 以及本轮"除法半径读成被除数")。而它又**刻意不含任何圆角语义**:几何层引这一层,
 * 不去引 radius-tokens —— 后者带 radiusLookup 与豁免判断,把几何层拖进圆角专属依赖,
 * 结果是每一个按文件清单搭起来的几何夹具都得跟着复制圆角层(本轮门 77 的 7 条端到端
 * 正是被这种耦合红掉的:box-geometry 新增一条 import,夹具没这个文件 ⇒ ERR_MODULE_NOT_FOUND)。
 */

/** 小程序 rpx 是 750 稿半单位(与守门 77 / geometry 同口径)。 */
export const RPX_PER_PX = 2

/**
 * px 保形换算器表在"常量表"里的**专用键**(2026-11-23 修:HEAD 上 `lib/radius-tokens.mjs` 从这里
 * import 一个从未定义过的同名符号,整条半径判据在 `import` 阶段就 SyntaxError ⇒ 门 77/128/150 与
 * 全部镜像测试结构性地跑不起来,"判据在、读数对着旧前提")。
 * 用 Symbol 而不是字符串:常量表的键是源码里的常量名,字符串键会与真实常量撞名。
 */
export const PX_WRAPPERS = Symbol.for('ihui.pxWrappers')

/**
 * 一段长度字面量 → px。单位决定换算:`rpx` 折半,`rem` 按 16px,`px` 与无单位按逻辑 px;
 * `calc(...)` 只是包裹,先剥。解不到返回 **null** —— 由调用方报名,绝不返回一个猜测值。
 */
export function lengthToPx(text) {
  const t = String(text ?? '')
    .trim()
    .replace(/^calc\(/, '')
    .replace(/\)$/, '')
    .trim()
  if (!t) return null
  const fn = /^rpx\(\s*([0-9.]+)\s*\)$/.exec(t)
  if (fn) return Number(fn[1]) / RPX_PER_PX
  const lit = /^([0-9.]+)(rpx|px|rem)?$/.exec(t)
  if (!lit) return null
  const n = Number(lit[1])
  if (!Number.isFinite(n)) return null
  if (lit[2] === 'rpx') return n / RPX_PER_PX
  if (lit[2] === 'rem') return n * 16
  return n
}

/** 常量表达式最多再解几层(`A = B`、`B = 44` 两层够;更深一律判"解不到",不猜)。 */
const CONST_EXPR_MAX_DEPTH = Number(process.env.IHUI_CONST_EXPR_MAX_DEPTH || 6)

/**
 * 一个**常量表达式**(标识符 / 成员档 / 指向另一个常量)折成 px。
 *
 * 为什么必须有这一份,而不是让半径侧与盒形侧各写一遍:两侧量的是同一批常量
 * (`SECONDARY_BTN_SIZE / 2` 与 `width: SECONDARY_BTN_SIZE` 是同一个数)。两处各写必然漂开成
 * "半径认得、盒形不认",而那一型产出的是**自洽的假结论**(半径 8 配上量不到的 16×16 盒 ⇒
 * 把一枚写规范了的圆钮判成"control 该取 sm"),比"读不出来"更坏 —— 它会替未判定发合格证。
 *
 * 认的形态(按出处优先级):
 *  ① 字面量(`44` / `24rpx` / `rpx(40)` / `calc(0.5rem)`)⇒ 交 `lengthToPx`,口径与两侧同形;
 *  ② 标识符(`SECONDARY_BTN_SIZE`、`SPEC_X_PX`)⇒ 直接查常量表;
 *  ③ 成员档(`rnGeometry.tapBox` / `taroGeometry.x` / `GEOMETRY_PX.y`)⇒ 先按整串查,再按
 *     `geometry.<成员>` 查(具名档表 `specTiers` 的键就是这一形,对象名换了不改键名);
 *  ④ 常量指向常量 ⇒ 递归,受 `CONST_EXPR_MAX_DEPTH` 限深。
 *
 * **解不到返回 null**,由调用方按"未判定"报名。防自引用是这条的存在理由之一:`const A = A`
 * 曾把整门打成 RangeError(注释承诺"最多再解一层,防环"而实现没有 depth,正是"名字承诺了、
 * 实现没兑现"那一型,见守门 137)。限深而不是访问集,是因为跨文件具名档表可能同时含环与长链,
 * 而超过这个深度的等式本就没有可信答案。
 *
 * @param {string} text 表达式原文
 * @param {Map<string,string|number>} consts 常量表(同文件 `constantMapOf` ∪ 跨文件具名档 `specTiers`)
 * @param {number} [depth] 递归层数,调用方不传
 * @returns {number|null}
 */
export function constExprPx(text, consts, depth = 0) {
  const t = String(text ?? '').trim()
  if (!t) return null
  const direct = lengthToPx(t)
  if (direct !== null) return direct
  if (!(consts instanceof Map) || consts.size === 0) return null
  if (depth >= CONST_EXPR_MAX_DEPTH) return null
  const norm = t.replace(/\s+/g, '')
  /**
   * ⑤ **px 保形换算器调用式**(`toUnit(BOX_PX)` / `toRpx(SPEC_X_PX)`):只认登记过的名字,
   * 倍率按 `内层 × 系数` 折 —— rpx 族再除 `RPX_PER_PX`(落地是 2rpx/px),px 族(恒等/px 调用)不除。
   * 名字不携带语义:没登记的名字一律不剥(宁漏不误判),系数解不到就整体 null,绝不按名字假定 1。
   */
  const call = /^([A-Za-z_$][\w$]*)\(\s*([^()]*?)\s*\)$/.exec(norm)
  if (call) {
    const table = consts.get(PX_WRAPPERS)
    if (!(table instanceof Map) || !table.has(call[1])) return null
    const inner = constExprPx(call[2], consts, depth + 1)
    if (inner === null) return null
    const spec = table.get(call[1])
    if (!spec || typeof spec !== 'object') return null
    const rawCoef = consts.has(spec.coef) ? consts.get(spec.coef) : spec.coef
    const coef = Number(rawCoef)
    if (!Number.isFinite(coef) || coef <= 0) return null
    return spec.kind === 'rpx' ? (inner * coef) / RPX_PER_PX : inner * coef
  }
  const iden = /^([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*)*)$/.exec(norm)
  if (!iden) return null
  const keys = [norm]
  if (iden[2]) keys.push(`geometry${iden[2]}`)
  for (const k of keys) {
    if (!consts.has(k)) continue
    const v = constExprPx(consts.get(k), consts, depth + 1)
    if (v !== null) return v
  }
  return null
}

/**
 * 同一份源码里的数字常量表(`const SIZE = 24` / `export const SIZE_PX = 24` / `= rpx(40)`)。
 * 除法形态的尺寸(`SIZE / 2`)与标识符形态的盒边长(`width: SIZE`)都要靠它取值;
 * 跨文件 import 的常量不在这张表里 —— 取不到由调用方按"未判定"报名,不得静默。
 */
export function constantMapOf(src) {
  const map = new Map()
  for (const raw of (src || '').split('\n')) {
    const t = raw.trim()
    if (/^(\/\/|\/\*|\*|\{\/\*|<!--)/.test(t)) continue
    const m =
      /(?:^|[^\w$.])(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(rpx\(\s*[0-9.]+\s*\)|\d+(?:\.\d+)?(?:rpx|px|rem)?|[A-Za-z_$][\w$]*)\s*(?:[,;)\]}]|$)/.exec(
        raw,
      )
    if (m && !map.has(m[1])) map.set(m[1], m[2])
  }
  // 包装器表随常量表一起交出去:`constExprPx` 解 `toUnit(X)` 时就靠这张表认"谁是保形换算器"。
  map.set(PX_WRAPPERS, pxWrappersOf(src))
  return map
}

/**
 * 单参**px 保形换算器**的登记表(2026-11-23 补):`const toUnit = (px) => rpx(px * TARO_RPX_PER_PX)`
 * → `{kind:'rpx', coef:'TARO_RPX_PER_PX'}`;RN 端 `const toUnit = (px) => px` → `{kind:'px', coef:'1'}`。
 *
 * 登记判据 = **自证**:函数体必须是 `rpx(...)` / `px(...)` 调用,或裸恒等;`px * 2` 这种"乘完不返回
 * 长度"的不登记(它不是换算器,只是个数),注释行不登记(否则门给自己发合格证),模板字面量形态
 * 刻意不在此支(属另一票,由 `radius-tokens.pxPreservingWrappersOf` 的补集接)。
 *
 * @param {string} src 单份源码
 * @returns {Map<string, {kind:'rpx'|'px', coef:string}>}
 */
export function pxWrappersOf(src) {
  const out = new Map()
  for (const raw of String(src ?? '').split('\n')) {
    const t = raw.trim()
    if (/^(\/\/|\/\*|\*|\{\/\*|<!--)/.test(t)) continue
    const m =
      /(?:^|[^\w$.])(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*\(\s*([A-Za-z_$][\w$]*)\s*(?:\??\s*:\s*[^()=]*)?\)\s*(?::[^=]*?)?=>\s*([^,;\n]+)/.exec(
        raw,
      )
    if (!m) continue
    const name = m[1]
    if (name === 'rpx' || name === 'px') continue
    const arg = m[2]
    const body = (m[3] ?? '').replace(/\s+/g, '')
    const spec = wrapperSpecOf(body, arg)
    if (spec && !out.has(name)) out.set(name, spec)
  }
  return out
}

/** 函数体 → 换算器规格;认不出返回 null(不猜)。 */
function wrapperSpecOf(body, arg) {
  const inner = /^(rpx|px)\(([^()]*)\)$/.exec(body)
  if (inner) {
    const kind = inner[1] === 'rpx' ? 'rpx' : 'px'
    const expr = inner[2]
    if (expr === arg) return { kind, coef: '1' }
    const mul =
      new RegExp(`^${arg}\\*([A-Za-z_$][\\w$]*|[0-9.]+)$`).exec(expr) ||
      new RegExp(`^([A-Za-z_$][\\w$]*|[0-9.]+)\\*${arg}$`).exec(expr)
    if (mul && mul[1]) return { kind, coef: mul[1] }
    return null
  }
  // RN 族:裸恒等(`(px) => px`),1:1 到 px
  if (body === arg) return { kind: 'px', coef: '1' }
  return null
}

/**
 * 一条**书写形态**的长度,在指定端构建后等于多少逻辑 px。
 * 折算算术仍只用本文件那一份 `lengthToPx`;这里只回答"落地时它是什么单位"——
 * 那是**构建链事实**,不是后缀语义:
 *  ① 小程序端无单位数字按该端量纲即 rpx;
 *  ② 编译进样式表的 `Npx` 会被 postcss-pxtransform 按 1:1 写成 `Nrpx`
 *     (`config/index.ts` 的 designWidth 750 + deviceRatio {750: 1} + pxtransform.enable),
 *     所以它与 rpx 折出同一物理量,必须一起折半 —— 不折就是拿 2 倍读数去比对面,
 *     "小程序 11 ↔ RN 5.5/22"这类**假分叉**正是这么造出来的;
 *  ③ `where='runtime'`(内联引号串、端内 `px()` 助手)**不过 postcss**,落地仍是真 px,不得折半。
 * 走哪条支路由调用方说:只有取值的书写形态知道自己是样式表声明、Tailwind 任意值,还是运行时串。
 */
export function facePx(text, side, where = 'css') {
  let t = String(text ?? '')
    .trim()
    .replace(/^calc\(/, '')
    .replace(/\)$/, '')
    .trim()
  if (side === 'miniapp' && !/(?:rpx|px|rem)$/.test(t)) t += 'rpx'
  if (side === 'miniapp' && where !== 'runtime') t = t.replace(/(?<!r)px$/, 'rpx')
  return lengthToPx(t)
}

/**
 * 单位换算系数(`*_PER_PX` 一族)按**被审面**现读(2026-11-23 补:此前门 77 从这里 import 它,
 * 而本文件没有这个导出 ⇒ 整条半径判据 `import` 阶段就崩,门与镜像测试全部结构性地跑不起来)。
 *
 * 为什么必须现读而不是写死 2:系数与长度折算是同一个物理量(逻辑 px ↔ 端单位),门 77 的具名档表
 * 要把它喂进 `constExprPx`。写死一次改名(`TARO_RPX_PER_PX` 换成别的名字)就变成"门还按 2 折算、
 * 源码已不认这个系数"的静默失效 —— 判据在,读数却对着旧前提。
 *
 * @param {Record<string, string>|Map<string, string>} sources 已按被审面读满的 {相对路径: 源码}
 * @returns {Record<string, number>} 形如 `{ TARO_RPX_PER_PX: 2 }`;只认 geometry.[jt]s 里的纯数字定义
 */
export function unitCoefficientsOfSources(sources) {
  /** @type {Record<string, number>} */
  const out = {}
  const entries = sources instanceof Map ? [...sources.entries()] : Object.entries(sources || {})
  for (const [rel, text] of entries) {
    // 系数只在 geometry 本体里定义;.d.ts 是声明副本(不取),spec 文件里也不会出现系数定义。
    if (!/(^|[\\/])geometry\.[jt]s$/.test(String(rel))) continue
    if (typeof text !== 'string') continue
    const re =
      /\b(?:export\s+)?const\s+([A-Z][A-Z0-9_]*_PER_[A-Z0-9_]*)\s*(?::\s*number)?\s*=\s*([0-9]+(?:\.[0-9]+)?)\b/g
    for (const m of text.matchAll(re)) {
      if (out[m[1]] === undefined) out[m[1]] = Number(m[2])
    }
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
