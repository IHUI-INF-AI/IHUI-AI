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
 *  ④ **被自证为长度包裹器的单参调用**(`toUnit(SPEC_X_PX)`)⇒ 解内层再乘该包裹器的倍率
 *     (倍率从哪来的见 `pxWrappersOf`;内层或系数解不到就整体返回 null,**绝不"顺手当恒等"**);
 *  ⑤ 常量指向常量 ⇒ 递归,受 `CONST_EXPR_MAX_DEPTH` 限深。
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
   * ④ 单参长度包裹器。必须排在下面那条标识符分支**之前**:`iden` 对 `toUnit(20)` 这种带括号
   * 的串直接返回 null,排后面等于这一支永远轮不到(而"写了分支却接不上"正是本仓记过的失明型)。
   * 倍率 = 包裹器写的那个系数 / `RPX_PER_PX`;系数或内层解不到 ⇒ 整体 null,不猜。
   */
  const call = WRAPPER_CALL_RE.exec(norm)
  if (call) {
    const w = consts.get(PX_WRAPPERS)
    const spec = w instanceof Map ? w.get(call[1]) : undefined
    if (!spec) return null
    const inner = constExprPx(call[2], consts, depth + 1)
    if (inner === null) return null
    if (spec.kind === 'identity') return inner
    const coef = constExprPx(spec.coef, consts, depth + 1)
    if (coef === null || coef <= 0) return null
    return (inner * coef) / RPX_PER_PX
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
 * 单参长度包裹器表挂在常量表的这个 Symbol 键上(见 `constantMapOf`)。
 * 用 Symbol 而不是字符串键,是因为字符串键本身可能被解析成一个标识符(`__x__` 合法),
 * 而 `constExprPx` 按标识符查表 —— 撞上一次就等于把一张机制表当成一个数值常量读。
 */
export const PX_WRAPPERS = Symbol.for('ihui.length.px-preserving-wrappers')

const IDENT_SRC = '[A-Za-z_$][\\w$]*'
/** 声明行:`const NAME = <右值>`(允许 `export`;右值取到行尾,分号可选)。 */
const WRAPPER_DECL_RE = new RegExp(
  `(?:^|[^\\w$.])(?:export\\s+)?const\\s+(${IDENT_SRC})\\s*=\\s*(.+?)\\s*;?\\s*$`,
)
/** ① 恒等式 `(p[: T]) => p` —— 右值就是形参本身,值原样过去,与单位无关 ⇒ 倍率恒 1。 */
const WRAPPER_IDENTITY_RE = new RegExp(
  `^\\(\\s*(${IDENT_SRC})\\s*(?:\\??\\s*:\\s*[^(),]*)?\\)\\s*=>\\s*(${IDENT_SRC})$`,
)
/** ② 单位重述式 `(p[: T]) => rpx(<p 与一个系数的积>)` —— 折 px 必须按 `系数 / RPX_PER_PX`。 */
const WRAPPER_RPX_RE = new RegExp(
  `^\\(\\s*(${IDENT_SRC})\\s*(?:\\??\\s*:\\s*[^(),]*)?\\)\\s*=>\\s*rpx\\(\\s*(.+?)\\s*\\)$`,
)
/** 一次调用的形状 `名字(实参)` —— 用于把上面那张表拿到查询侧。 */
const WRAPPER_CALL_RE = new RegExp(`^(${IDENT_SRC})\\((.*)\\)$`)
/**
 * 单位比率声明行:`export const TARO_RPX_PER_PX = 2`(住在 `packages/design-tokens/src/geometry.js`)。
 * 只认 `_PER_PX` 收尾的全大写常量 —— 别的数字不许冒充换算系数。
 */
const UNIT_COEF_RE =
  /(?:^|[^\w$.])(?:export\s+)?const\s+([A-Z][A-Z0-9_]*_PER_PX)\s*=\s*(\d+(?:\.\d+)?)\s*;?\s*$/

/**
 * 一份源码里**自证为"把逻辑 px 写成该端长度"**的单参包裹器:`Map<名字, {kind, coef?}>`。
 *
 * 为什么必须从源码里**导**出来,而不是把 `toUnit` 这个名字写死成"可以剥":
 * 名字不携带语义。仓里此刻有两族同名异物 ——
 *  · `apps/miniapp-taro/src/components/*.tsx`(14 个文件,如 `ModelList.tsx:62`)
 *    写 `const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)`,而 `rpx(n)` 的产物是
 *    `${n}rpx`(`apps/miniapp-taro/src/utils/rpx.ts:38`)⇒ 折回逻辑 px 要除 `RPX_PER_PX`;
 *  · `apps/mobile-rn/src/components/*.tsx`(3 个文件,如 `Menu.tsx:98`)写 `const toUnit = (px) => px`,
 *    RN 收 dp ⇒ 数值不动。
 * 两族**都**是"值不变、只换书写单位",但只有第一族需要证明"乘的那个系数就是 rpx-per-px 系数"
 * (`packages/design-tokens/src/geometry.js:78` 的 `TARO_RPX_PER_PX = 2`)。系数取不到或取了别的值,
 * 本函数给的结论分别是"判不出"与"按倍率折算",**没有一条分支是按名字假定恒等** ——
 * 否则有人把系数改成 3,尺子还会替一个坏掉的换算发"这是恒等"的合格证。
 *
 * 刻意**不收**的形态(如实登记为盲区,而不是"顺手都认了"):
 * 模板字面量式 `` const toRpx = (px) => `${px * 2}rpx` ``(`apps/miniapp-taro/src/components/
 * adapters/ColorfulLoader.taro.tsx:48` 等 12 处)与 `function` 声明式。它们是**另一种写法**,
 * 收进射程会让一批从未被量过的半径/盒形同时进入判红口径 —— 那属"先清存量再收紧"的另计一票。
 */
export function pxWrappersOf(src) {
  const out = new Map()
  for (const raw of String(src ?? '').split('\n')) {
    const t = raw.trim()
    if (/^(\/\/|\/\*|\*|\{\/\*|<!--)/.test(t)) continue
    const d = WRAPPER_DECL_RE.exec(raw)
    if (!d) continue
    const name = d[1]
    if (out.has(name) || name === 'rpx') continue
    const rhs = (d[2] || '').trim()
    const id = WRAPPER_IDENTITY_RE.exec(rhs)
    if (id && id[1] === id[2]) {
      out.set(name, { kind: 'identity' })
      continue
    }
    const rp = WRAPPER_RPX_RE.exec(rhs)
    if (!rp) continue
    const p = rp[1]
    const body = (rp[2] || '').replace(/\s+/g, '')
    const mul =
      new RegExp(`^${p}\\*(${IDENT_SRC}|[0-9.]+)$`).exec(body) ||
      new RegExp(`^(${IDENT_SRC}|[0-9.]+)\\*${p}$`).exec(body)
    if (mul && mul[1]) out.set(name, { kind: 'rpx', coef: mul[1] })
  }
  return out
}

/**
 * 从**具名档来源面**(调用方已按自己的来源清单枚举好的 `Record<相对路径, 源码>`)读出
 * "1 逻辑 px 等于几个该端单位"的换算系数(如 `export const TARO_RPX_PER_PX = 2`)。
 *
 * 为什么要有这一口:`pxWrappersOf` 认出的 `rpx(p * K)` 只有拿到 K 的**值**才判得出是不是
 * px 保形,而 K 住在 `packages/design-tokens/src/geometry.js`,被审文件里只有 `import`。
 * 系数因此与具名档走**同一条通道**(同一面、同一轮取),不得在尺子里另抄一个"我记得是 2"。
 * 取不到就是取不到 —— 调用方拿不到系数时,那一格落"未判定",不是落"恒等"。
 * 名字按 `_PER_PX` 收尾(与门 128 `specTiers` 排除的那些比率键同源),避免把比率混进档表。
 */
export function unitCoefficientsOfSources(sources) {
  const out = {}
  for (const src of Object.values(sources || {})) {
    for (const raw of String(src ?? '').split('\n')) {
      const t = raw.trim()
      if (/^(\/\/|\/\*|\*|\{\/\*|<!--)/.test(t)) continue
      const m = UNIT_COEF_RE.exec(raw)
      if (m && out[m[1]] === undefined) out[m[1]] = Number(m[2])
    }
  }
  return out
}

/**
 * 同一份源码里的数字常量表(`const SIZE = 24` / `export const SIZE_PX = 24` / `= rpx(40)`)。
 * 除法形态的尺寸(`SIZE / 2`)与标识符形态的盒边长(`width: SIZE`)都要靠它取值;
 * 跨文件 import 的常量不在这张表里 —— 取不到由调用方按"未判定"报名,不得静默。
 *
 * 同一次扫描还顺手把 `pxWrappersOf` 的结果挂在 `PX_WRAPPERS` 键上。住在这一份里而不是另开
 * 一条出口,是因为这张表被**至少四条链**共用(半径侧 `radius-tokens`、盒形侧 `box-geometry`、
 * 门 150 的合并表、各门的具名档),另开出口的后果就是"半径侧认得包裹器而盒形侧不认"——
 * 那条自洽假结论本仓已经记过一次(见 `constExprPx` 头注)。Symbol 键在
 * `new Map([...a, ...b])` 的合并里逐条目原样保留,所以包装信息跟着表走。
 */
export function constantMapOf(src) {
  const map = new Map()
  for (const raw of (src || '').split('\n')) {
    const t = raw.trim()
    if (/^(\/\/|\/\*|\*|\{\/\*|<!--)/.test(t)) continue
    const m = /(?:^|[^\w$.])(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(rpx\(\s*[0-9.]+\s*\)|\d+(?:\.\d+)?(?:rpx|px|rem)?|[A-Za-z_$][\w$]*)\s*(?:[,;)\]}]|$)/.exec(
      raw,
    )
    if (m && !map.has(m[1])) map.set(m[1], m[2])
  }
  map.set(PX_WRAPPERS, pxWrappersOf(src))
  return map
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
