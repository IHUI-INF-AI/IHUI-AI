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
 * 找到**开标签自己**结束的那一行:从 `start` 向后扫,花/方/圆括号深度为 0 时遇到的第一个
 * 裸 `>`(前一字符不是 `= & ( [ < ! | ? : , + - * / % ~ ^`)就是开标签的闭合。
 * 为什么要这些排除:`className="[&>svg]:h-4"` 里的 `>` 在方括号内、`=>` 是箭头函数、
 * `placeholder="a > b"` 在字符串里(字符串这一维本函数**不**处理,故调用方只在 confident 时用)。
 * 扫不到干净闭合 ⇒ 返回 `{end:null}` —— **交调用方退回宽窗或计"判不出",绝不猜。**
 */
function findTagClose(lines, start) {
  let braces = 0
  let flat = 0
  let inString = 0
  for (let i = start; i < Math.min(lines.length, start + 40); i++) {
    const l = String(lines[i] ?? '')
    for (let k = 0; k < l.length; k++) {
      const ch = l[k]
      if (inString) {
        if (ch === inString && l[k - 1] !== '\\') inString = 0
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch
        continue
      }
      if (ch === '{') braces += 1
      else if (ch === '}') braces -= 1
      else if (ch === '[' || ch === '(') flat += 1
      else if (ch === ']' || ch === ')') flat -= 1
      else if (
        ch === '>' &&
        braces <= 0 &&
        flat <= 0 &&
        !/[=>&(<[!|?:,+\-*/%~^]/.test(l[k - 1] || '')
      )
        return { end: i }
    }
    if (inString) inString = 0 // 不跨行猜字符串
  }
  return { end: null }
}

/**
 * **只含该元素自己属性区**的文本,外加一个 `confident` 旗。
 * C6(胶囊判据)用它:宽窗会把子节点的 `h-4 w-4` 算进父盒(HEAD 现读 14 处候选里 9 处就是这么来的),
 * 但"找闭合"这件事没有真 JSX 词法器就会错(字符串里的 `>`、泛型 `<T>`),所以**不确定就不判** ——
 * 一条会喊错的 blocking 尺子比漏报贵得多(§12e:恒红/误红的唯一结局是人人 `--no-verify`)。
 */
export function ownAttributeArea(allLines, idx) {
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
  const start = Math.max(0, idx - back)
  const { end } = findTagClose(allLines, start)
  if (end === null) return { text: '', confident: false }
  return { text: allLines.slice(start, end + 1).join('\n'), confident: true }
}

/** 与 `boxDims` 同形,但只在属性区能确定闭合时才给结论;否则 `{confident:false}`。 */
export function boxDimsOwn(allLines, idx) {
  const area = ownAttributeArea(allLines, idx)
  if (!area.confident) return { w: 0, h: 0, shape: null, sameExpr: false, confident: false }
  return { ...dimsFromText(area.text), confident: true }
}

/**
 * 取**该元素自己的**属性区(宽窗:开标签行起、向后 6 行)。这是门 11 现有判据依赖的口径,
 * **不改** —— 它宁可宽(把子节点尺寸算进来)也不能漏(头像的 `style={{width,height}}` 常在后面几行)。
 * 需要"只算自己属性区"的判据(C6 胶囊)走 `ownAttributeArea`,那条路要求能确定闭合才下结论。
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
  const start = Math.max(0, idx - back)
  return allLines.slice(start, Math.min(allLines.length, idx + 6)).join('\n')
}

/**
 * 量元素的盒子**尺寸与形状** —— 只有一份实现。`boxShape()` 是它的投影,几何硬规则与
 * C2 胶囊判据都从这里取值;两处各算一遍必然漂移(本仓记过最多次的失败型)。
 * 宽度取窗口内最大、高度取最大,因为一个元素常同时带 `w-full h-10` 与 `min-w-8` 一类多个约束,
 * 保守地按"最大者"判形状只会把该拦的拦住、不会把方形误判成胶囊。rpx 按 2:1 折成 px,
 * Tailwind 刻度按 4px 折。返回 `{w,h,shape,sameExpr}`,量不到的一侧为 0。
 */
export function boxDims(allLines, idx) {
  return dimsFromText(elementWindow(allLines, idx))
}

/**
 * 只问形状、不要数值的调用方走这条投影 —— **形状判据仍然只有一份实现**。
 * 返回 'square' / 'wide' / null(量不到 ⇒ 不猜)。
 */
export function boxShape(allLines, idx) {
  return boxDims(allLines, idx).shape
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 找一个声明行**所属的对象作用域**(RN StyleSheet / 内联 style 对象 / CSS 规则块)。
 * 为什么需要它:`boxDims` 的属性区是按 **JSX 起始标签**回溯的,拿它去量 StyleSheet 里的
 * `dot: { width: 8, height: 8, borderRadius: 4 }` 会 blead 到邻行的 `width: 40`,于是
 * 一枚 8×8 圆点被量成 40×8 —— 判据于是把"正方真圆"报成"胶囊"。实测这就是门 11 第一版
 * C2 产出 82 处里的一部分假阳来源。
 *
 * 回溯方式:从命中行往上找**第一条含 `{` 的行**(那就是本对象的开括号),再从那里做括号配平
 * 找到闭括号。配不平(截断 / 语法坏了)⇒ 返回 null,交调用方计入"未判定" —— 不猜作用域,
 * 与 lib/jsx-scope 对截断的处理同一条规矩。
 */
export function objectScope(lines, idx) {
  let open = -1
  for (let i = idx; i >= Math.max(0, idx - 60); i--) {
    const l = String(lines[i] ?? '')
    if (l.includes('{')) {
      open = i
      break
    }
  }
  if (open < 0) return null
  let depth = 0
  for (let i = open; i < Math.min(lines.length, open + 400); i++) {
    const l = String(lines[i] ?? '')
    for (const ch of l) {
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) return { start: open, end: i }
      }
    }
  }
  return null
}

/**
 * 量一个作用域内的盒尺寸(只在本对象内部找 width/height / w-[..] / h-[..])。
 * 返回 `{w,h,shape,sameExpr}`,与 `boxDims` 同形 —— 两个上下文共用一把形状尺,
 * 差别只在"从哪里取属性",不在"怎么算形状"。
 */
export function objectDims(lines, idx) {
  const scope = objectScope(lines, idx)
  if (!scope) return { w: 0, h: 0, shape: null, sameExpr: false }
  const win = lines.slice(scope.start, scope.end + 1).join('\n')
  return dimsFromText(win)
}

/** 从一段文本量出宽高与形状 —— boxDims 与 objectDims 的共同出口(单位折算只此一处)。 */
export function dimsFromText(win) {
  let w = 0
  let h = 0
  for (const m of win.matchAll(/\b([wh])-\[(\d+(?:\.\d+)?)(rpx|px)\]/g)) {
    const v = Number(m[2]) * (m[3] === 'rpx' ? 0.5 : 1)
    if (m[1] === 'w') w = Math.max(w, v)
    else h = Math.max(h, v)
  }
  for (const m of win.matchAll(/\b(?:width|height)\s*[:=]\s*(\d+(?:\.\d+)?)/g)) {
    if (m[0].startsWith('w')) w = Math.max(w, Number(m[1]))
    else h = Math.max(h, Number(m[1]))
  }
  const dims = [...win.matchAll(/\b(width|height)\s*[:=]\s*([^,}\n]+)/g)].map((m) => ({
    axis: m[1] === 'width' ? 'w' : 'h',
    v: m[2].trim().replace(/\s+/g, ''),
  }))
  const wv = new Set(dims.filter((d) => d.axis === 'w').map((d) => d.v))
  const hv = dims.filter((d) => d.axis === 'h').map((d) => d.v)
  const sameExpr = hv.some((v) => wv.has(v))
  for (const m of win.matchAll(/\b([wh])-(\d+(?:\.\d+)?)(?![\w-])/g)) {
    const v = Number(m[2]) * 4
    if (m[1] === 'w') w = Math.max(w, v)
    else h = Math.max(h, v)
  }
  if (!w || !h) {
    if (sameExpr) return { w, h, shape: 'square', sameExpr }
    if (h) {
      let pxMax = 0
      for (const m of win.matchAll(/\bpx-(\d+(?:\.\d+)?)(?![\w-])/g)) pxMax = Math.max(pxMax, Number(m[1]) * 4)
      for (const m of win.matchAll(/\bpx-\[(\d+(?:\.\d+)?)(rpx|px)\]/g))
        pxMax = Math.max(pxMax, Number(m[1]) * (m[2] === 'rpx' ? 0.5 : 1) * 2)
      if (pxMax && pxMax * 2 >= h) return { w, h, shape: 'wide', sameExpr }
    }
    return { w, h, shape: null, sameExpr }
  }
  return { w, h, shape: Math.max(w, h) / Math.min(w, h) <= 1.35 ? 'square' : 'wide', sameExpr }
}
