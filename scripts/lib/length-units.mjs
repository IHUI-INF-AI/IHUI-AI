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
    const m = /(?:^|[^\w$.])(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(rpx\(\s*[0-9.]+\s*\)|\d+(?:\.\d+)?(?:rpx|px|rem)?|[A-Za-z_$][\w$]*)\s*(?:[,;)\]}]|$)/.exec(
      raw,
    )
    if (m && !map.has(m[1])) map.set(m[1], m[2])
  }
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
