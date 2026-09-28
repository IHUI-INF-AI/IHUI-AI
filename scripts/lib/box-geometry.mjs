// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 盒子几何(元素属性区 + 宽高量算 + 形状判定)—— 与"圆角档位"无关的一层,住在自己的文件里,
 * 因为**两个门要量同一件事**:守门 11 判"纯圆/胶囊",守门 150 判"角色档该不该按容器算"。
 * 判"是不是正方"这件事在两处各写一遍必然漂移(本仓为这一型开过不止一票),所以只留这一份。
 *
 * 单位归一:rpx 按 2:1 折成 px,Tailwind 刻度按 4px 折;窗口只取**该元素自己的属性区**,
 * 因为 ±5 行会 blead 到邻居尺寸,把 6×6 装饰点量成 `h-4 w-7` 的胶囊(实测产过一枚假阳)。
 */

/**
 * 取**该元素自己的**属性区(不是"上下 5 行"):±5 会bleed 到邻居的尺寸,把 6×6 装饰点
 * 量成 `h-4 w-7` 的胶囊(实测就产出一枚假阳)。起始行 = 往上第一条缩进严格更小且开着标签的行;
 * 找不到就只取自身上下各 1 行。
 */
export function elementWindow(allLines, idx) {
  const indentOf = (s) => (s || '').match(/^\s*/)[0].length
  const myIndent = indentOf(allLines[idx])
  let back = 2
  for (let up = 1; up <= 30 && idx - up >= 0; up++) {
    const l = allLines[idx - up] || ''
    if (!l.trim()) continue
    if (indentOf(l) < myIndent && /<[A-Za-z][\w.]*/.test(l)) {
      back = up
      break
    }
  }
  return allLines
    .slice(Math.max(0, idx - back), Math.min(allLines.length, idx + 6))
    .join('\n')
}

/**
 * 量元素的盒子**尺寸与形状** —— 只有一份实现。`boxShape()` 是它的投影,几何硬规则与
 * C2 胶囊判据都从这里取值;两处各算一遍必然漂移(本仓记过最多次的失败型)。
 * 宽度取窗口内最大、高度取最大,因为一个元素常同时带 `w-full h-10` 与 `min-w-8` 一类多个约束,
 * 保守地按"最大者"判形状只会把该拦的拦住、不会把方形误判成胶囊。rpx 按 2:1 折成 px,
 * Tailwind 刻度按 4px 折。返回 `{w,h,shape,sameExpr}`,量不到的一侧为 0。
 */
export function boxDims(allLines, idx) {
  const window = elementWindow(allLines, idx)
  let w = 0
  let h = 0
  for (const m of window.matchAll(/\b([wh])-\[(\d+(?:\.\d+)?)(rpx|px)\]/g)) {
    const v = Number(m[2]) * (m[3] === 'rpx' ? 0.5 : 1)
    if (m[1] === 'w') w = Math.max(w, v)
    else h = Math.max(h, v)
  }
  for (const m of window.matchAll(/\b(?:width|height)\s*[:=]\s*(\d+(?:\.\d+)?)/g)) {
    if (m[0].startsWith('w')) w = Math.max(w, Number(m[1]))
    else h = Math.max(h, Number(m[1]))
  }
  /**
   * **同表达式即同尺寸**:头像/圆点的边长常常来自变量或 `toUnit(CONST)` 这类换算,
   * 量不到数字并不代表不是方形 —— 只要 width 与 height 写的是**同一个值**,几何上必然是正方形。
   * 这不是"看名字猜",是取值相等这条可核验事实;而它替代了标记豁免(用户定档:不允许任何豁免)。
   */
  const dims = [...window.matchAll(/\b(width|height)\s*[:=]\s*([^,}\n]+)/g)].map((m) => ({
    axis: m[1] === 'width' ? 'w' : 'h',
    v: m[2].trim().replace(/\s+/g, ''),
  }))
  const wv = new Set(dims.filter((d) => d.axis === 'w').map((d) => d.v))
  const hv = dims.filter((d) => d.axis === 'h').map((d) => d.v)
  const sameExpr = hv.some((v) => wv.has(v))
  for (const m of window.matchAll(/\b([wh])-(\d+(?:\.\d+)?)(?![\w-])/g)) {
    const v = Number(m[2]) * 4
    if (m[1] === 'w') w = Math.max(w, v)
    else h = Math.max(h, v)
  }
  if (!w || !h) {
    if (sameExpr) return { w, h, shape: 'square', sameExpr }
    /**
     * 只量到一维时的第二把尺:`rounded-full` + **横向内边距明显大于高度**(或带文本的
     * `px-N` 胶囊钮)在几何上必然是胶囊 —— 内容撑开的宽度只会 ≥ 高度,而半径取到"高度一半"
     * 就是两端全圆的药丸形。这一型正是用户点名要根除的"胶囊型",不允许以"量不到宽度"逃逸。
     */
    if (h) {
      let pxMax = 0
      for (const m of window.matchAll(/\bpx-(\d+(?:\.\d+)?)(?![\w-])/g)) pxMax = Math.max(pxMax, Number(m[1]) * 4)
      for (const m of window.matchAll(/\bpx-\[(\d+(?:\.\d+)?)(rpx|px)\]/g))
        pxMax = Math.max(pxMax, Number(m[1]) * (m[2] === 'rpx' ? 0.5 : 1) * 2)
      if (pxMax && pxMax * 2 >= h) return { w, h, shape: 'wide', sameExpr }
    }
    return { w, h, shape: null, sameExpr }
  }
  const shape = Math.max(w, h) / Math.min(w, h) <= 1.35 ? 'square' : 'wide'
  return { w, h, shape, sameExpr }
}

/**
 * 只问形状、不要数值的调用方走这条投影 —— **形状判据仍然只有一份实现**。
 * 返回 'square' / 'wide' / null(量不到 ⇒ 不猜)。
 */
export function boxShape(allLines, idx) {
  return boxDims(allLines, idx).shape
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
