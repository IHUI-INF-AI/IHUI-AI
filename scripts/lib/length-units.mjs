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
    const m = /(?:^|[^\w$.])(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(rpx\(\s*[0-9.]+\s*\)|\d+(?:\.\d+)?(?:rpx|px|rem)?|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\s*(?:[,;)\]}]|$)/.exec(
      raw,
    )
    if (m && !map.has(m[1])) map.set(m[1], m[2])
  }
  return map
}

/**
 * 一个**表达式文本** → px(数字字面量、`rpx(N)`、成员档 `rnGeometry.tapBox`、指向这些的标识符)。
 *
 * 半径侧与盒形侧都要问这同一句(`X / 2` 的分子、`width: X` 的 X),所以求值只留这一份:
 * 实测半径认得成员档而盒形不认,结果是一个自洽的假结论 —— 半径算出 18、盒量不到,
 * "半径=边长一半"永不成立,`BottomActionBar.tsx` 那枚按钮就这么停在未判定里(而它其实是胶囊)。
 * 解不到一律返回 null 交调用方报名;限深 4 并排除自引用,不允许把"猜的值"当量到的值。
 */
export function constExprPx(text, consts, depth = 0) {
  const t = String(text ?? '')
    .trim()
    .replace(/\s+/g, '')
  if (!t) return null
  const direct = lengthToPx(t)
  if (direct !== null) return direct
  if (depth >= 4 || !(consts instanceof Map)) return null
  // 成员档按门 128 的表约定挂 `geometry.<键>`(它把 GEOMETRY_PX 的档统一存成这个名字)。
  const member = /^[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)$/.exec(t)
  const key = member ? `geometry.${member[1]}` : /^[A-Za-z_$][\w$]*$/.test(t) ? t : null
  if (!key || !consts.has(key)) return null
  const next = String(consts.get(key)).trim()
  if (next === t) return null
  return constExprPx(next, consts, depth + 1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
