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
      const prev = l[k - 1] || ''
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
        /**
         * 前导字符黑名单**原本还含 `/`**,于是跨行书写的自闭合标签(`className` 一行、`style` 一行、
         * `/>` 一行)永远找不到闭合 ⇒ `ownAttributeArea` 恒判"不确定" ⇒ C6/C7 对这一族全部量不到。
         * HEAD 实测 4 处"全圆写法但量不到盒形"里有 2 处正是这个形状 —— 症状不是判错,是**免检**:
         * 一枚 48px 的圆只要把尺寸写在上一行,就永远不出现在上限判据的射程里。
         * 这里只把 `/` 摘出黑名单,其余(`=>` `>=` `->` `|>` 等)一字不改地继续排除;
         * 表达式里的除法 `/` 由 `braces > 0` / `flat > 0` 那两道挡住,不会在这儿伪装成闭合。
         */
        !/[=>&(<[!|?:,+\-*%~^]/.test(prev)
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
  const self = String(allLines[idx] ?? '')
  /**
   * 锚点行**自己就带开标签**时,属性区只取本行 —— 从前这里先向上"猜"祖先标签,猜中谁就把谁的
   * 尺寸当成本盒的:实测把两个全宽内容面板(`UpdatePrompt.tsx` 的 `h-9 flex-1 … rounded-lg` 条、
   * `computer-use/page.tsx` 的提取结果块)量成 16×36 / 16×320 —— 那 16 是**子图标**的 `w-4` ——
   * 于是 8px 半径刚好"等于短边一半",两道都判成胶囊。假阳的代价从来不是"多一条红",
   * 是逼人把一个本来正确的样式改成方的(与本仓"假阳比漏报贵"同条)。
   * 本行开标签闭合不确定(属性区跨行写)⇒ 返回 confident:false,由调用方计"未判定"报名,**不猜**。
   */
  if (/<[A-Za-z][\w.]*/.test(self)) {
    if (findTagClose([self], 0).end === null) return { text: '', confident: false }
    return { text: self, confident: true }
  }
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
export function boxDimsOwn(allLines, idx, consts) {
  const area = ownAttributeArea(allLines, idx)
  if (!area.confident) return { w: 0, h: 0, shape: null, sameExpr: false, confident: false }
  return { ...dimsFromText(area.text, constsForLines(allLines, consts)), confident: true }
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
export function boxDims(allLines, idx, consts) {
  return dimsFromText(elementWindow(allLines, idx), constsForLines(allLines, consts))
}

/**
 * 取"这一行的盒尺寸是**按什么写的**"—— 作用域内所有 `width` / `height` 声明的字面原文。
 *
 * 为什么需要字面而不是折算后的数值:判"半径是不是由这个盒的边长算出来的"时,
 * `width: rpx(96)` 配的半径应写成 `rpx(96) / 2`,而不是拿折算后的数值去比 ——
 * 单位折算现已统一(`lengthToPx` 一份),但**数值相等仍可能是巧合**:字面同形才是作者自己
 * 写下的推导关系(半径由这个盒算出来),而"半径 ≥ 短边一半"这种数值判断会把一个恰好等于
 * 半边长的固定值读成真圆。**跨语义比数值会造出假方形**(假方形=把胶囊读成真圆,比漏报更贵:
 * 它替"已清零"发合格证)。
 * 字面同形则是作者自己写下的证据,与单位折算无关。
 */
export function scopeDimTexts(lines, i, anchor = /border(?:-?[A-Za-z-]*)?[Rr]adius/) {
  const sc = objectScope(lines, i)
  // objectScope 是按"最近的 { 行"找的,而 JSX 一行里就可能有 `{var(...)}` 这类花括号 ——
  // 那会把窗口收成"只有这一行且大括号已闭合",锚点落不到窗口里,depth 全算错(实测小程序的
  // `className="w-[56rpx] h-[56rpx] rounded-[28rpx]"` 就是这样:边长明明写在同一行,却读成"量不到")。
  // 所以:窗口不含该行 ⇒ 退回按**该行自己**取,这也是 Tailwind 形态唯一正确的取材面。
  const usable = sc && sc.start <= i && i <= sc.end ? sc : null
  const win = usable ? lines.slice(usable.start, usable.end + 1).join('\n') : String(lines[i] ?? '')
  const lineStart = usable ? lines.slice(usable.start, i).join('\n').length + 1 : 0
  const at = win.slice(lineStart).search(anchor)
  const anchorIdx = lineStart + (at < 0 ? 0 : at)
  /**
   * 只取**与半径声明同一层**的宽高。
   * 为什么不能取整个作用域:RN 的 StyleSheet 里 `shadowOffset: { width: 0, height: 2 }` 与按钮自己的
   * `width: 34, height: 34` 住在同一个对象里 —— 把阴影偏移当边长读,一条正方声明会因为
   * "四个值不逐字相同"而判不出形状(实测 AgentScreen / CoursePlanetScreen / ProfileScreen 的
   * 返回顶部钮全中这一型,每个都自带 iOS 阴影)。
   * 也不用"行首深度":`const st = { a: { width: 20, borderRadius: 10 } }` 这种整行对象,
   * 行首还在 0 层,声明却在 2 层 —— 锚点必须是那条圆角声明自己所在的位置。
   */
  const depthOf = (pos) => {
    const before = win.slice(0, pos)
    return (before.match(/\{/g) || []).length - (before.match(/\}/g) || []).length
  }
  const want = depthOf(anchorIdx)
  const texts = []
  for (const m of win.matchAll(/\b(?:width|height)\s*[:=]\s*([^,;}\n]+)/g)) {
    if (depthOf(m.index) !== want) continue
    const v = m[1].trim().replace(/\s+/g, '').replace(/^\{/, '').replace(/\}$/, '')
    if (v) texts.push(v)
  }
  // Tailwind 的 `w-[96rpx] h-[96rpx]` / `w-12 h-12` 是**同一件事的第二种书写语言**:小程序与 RN 的
  // className 形态里盒尺寸就长这样。只认 `width:/height:` 的门会把这类正方盒读成"量不到",
  // 于是按规矩写的真圆只能靠挂标记平息(§4 记过的"覆盖面两半必须同改"同型)。
  for (const m of win.matchAll(/\b([wh])-(?:\[(.*?)\]|(\d+(?:\.\d+)?))(?![\w-])/g)) {
    if (depthOf(m.index) !== want) continue
    const v = (m[2] ?? m[3] ?? '').trim()
    // 只推**值**不推轴名:`w-[56rpx] h-[56rpx]` 要能被认成"同一个边长",带轴前缀就永远不相等。
    if (v) texts.push(v)
  }
  return texts
}

/** 一条长度字面量拆成 `{v, unit}`;拆不出返回 null(表达式、百分比、变量名都不算数值长度)。 */
export function lengthLiteral(text) {
  const m = /^(?:rpx\()?(\d+(?:\.\d+)?)(px|rpx|rem|em)?\)?$/.exec(String(text).trim())
  if (!m) return null
  return { v: Number(m[1]), unit: m[2] || '' }
}

/**
 * **胶囊判定的物理下限(px)**:短边小于它的不算胶囊,算"圆头端点"。
 * 住在几何层是因为两把尺子都要用它 —— 门 150 的 C6 判"这个元素是不是胶囊",门 77 判"这个半径
 * 是不是几何而不是档位取用",同一道物理线各写一遍必然漂移(一处改成 12、另一处留 16,同一个
 * 6px 高的骨架条就会一边判红一边进队列)。要挪就只挪这里。
 */
export const CAPSULE_MIN_SHORT_PX = 16

/**
 * 半径写成 `<某串> / <数>` 时的几何结论。§4 明令真圆/胶囊一族"优先 `size / 2` 表达式",
 * 也就是说**这是本项目最规范的圆角写法**;而 `classifyRadiusGeometry` 从前只经 `lengthLiteral`
 * 取半径,那一支只认纯字面量 ⇒ 这一族整族返回 'tier'。后果是门 77 把规范写法当成"绕档位表
 * 写死数字":实测把 `ProfileScreen.tsx` 的 `rnRadius.xl` 改成 `72 / 2` 会当场被 B1 判红 ——
 * **判据不认自己要求的写法,就等于逼人把代码改回旧档**(与本仓"门让你怎么写就得怎么看见"同条)。
 *
 * 正方一侧不依赖任何数值:`分子串 === 边长串` 且除数是 2,就是作者写下的推导关系,
 * 对单位折算完全免疫(`width: AVATAR, borderRadius: AVATAR / 2` 也算)。
 * 非正方一侧才需要把分子折成 px 去比物理下限;折不到(标识符来自跨文件)⇒ 返回 null,
 * 由调用方按"判不出"处理,不猜形状。
 */
export function halvedSideVerdict(lines, i, radiusText, anchor) {
  const t = String(radiusText ?? '')
    .trim()
    .replace(/^\{\s*|\s*\}$/g, '')
    .trim()
  const m = /^(.+?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(t)
  if (!m) return null
  const divisor = Number(m[2])
  if (!Number.isFinite(divisor) || divisor <= 0) return null
  const operand = m[1].trim().replace(/\s+/g, '')
  if (!operand) return null
  const sides = (anchor ? scopeDimTexts(lines, i, anchor) : scopeDimTexts(lines, i))
    .map(s => String(s).trim().replace(/\s+/g, ''))
    .filter(Boolean)
  if (!sides.length || !sides.includes(operand)) return null
  const uniq = new Set(sides)
  if (uniq.size === 1 && sides.length >= 2 && divisor === 2) return 'circle'
  const lit = lengthLiteral(operand)
  if (!lit || lit.v <= 0) return null
  const shortPx = lit.unit === 'rpx' ? lit.v / 2 : lit.unit === 'rem' ? lit.v * 16 : lit.v
  return shortPx >= CAPSULE_MIN_SHORT_PX ? 'capsule' : 'rounded-end'
}

/**
 * 一条半径相对**它自己那个盒**的几何定性(与 `isGeometricCircle` 同取材、同一把尺):
 *  - `circle`       :正方盒 + 半径=边长一半 ⇒ 真圆装饰件,出了档位表射程;
 *  - `capsule`      :非正方(或只量到一条边)+ 半径=那条边一半 + 短边 ≥ 下限 ⇒ 胶囊,项目不允许;
 *  - `rounded-end`  :同样的"半径=边长一半",但那条边细于下限 ⇒ 圆头端点(§4 明令不得方档化);
 *  - `tier`         :以上都不成立 ⇒ 这就是一个普通的圆角取用,必须走档位。
 */
export function classifyRadiusGeometry(lines, i, radiusText, anchor) {
  /**
   * 除法写法(`size / 2`)先问几何 —— 它是 §4 规定的写法,不能因为"取不出纯字面量"就退成 'tier'
   * (那一退,门 77 就把最规范的圆角读成"绕档位表写死数字")。
   */
  const hv = halvedSideVerdict(lines, i, radiusText, anchor)
  if (hv) return hv
  const r = lengthLiteral(String(radiusText).replace(/^\{\s*|\s*\}$/g, ''))
  if (!r || r.v <= 0) return 'tier'
  const sides = (anchor ? scopeDimTexts(lines, i, anchor) : scopeDimTexts(lines, i))
    .map(lengthLiteral)
    .filter((x) => x && x.unit === r.unit && x.v > 0)
    .map((x) => x.v)
  if (!sides.length) return 'tier'
  const hit = sides.find((s) => s === r.v * 2)
  if (hit === undefined) return 'tier'
  const uniq = new Set(sides)
  // "正方"要求**两条边都量到**且同值:只量到一条(如 `h-[12rpx] w-full`)时,另一条可能是 100% 宽,
  // 那它就是胶囊而不是圆 —— 单侧证据永远不足以判"圆"。
  if (uniq.size === 1 && sides.length >= 2) return 'circle'
  const short = Math.min(...sides)
  const px = (v) => (r.unit === 'rpx' ? v / 2 : r.unit === 'rem' ? v * 16 : v)
  return px(short) >= CAPSULE_MIN_SHORT_PX ? 'capsule' : 'rounded-end'
}

/**
 * **几何真圆的字面同形证明**:`radius × 2 === 边长`,且半径与边长写在同一套单位里。
 *
 * 为什么按字面而不按折算后的数值:`dimsFromText` 对不同书写形态的折算口径本来就不同
 * (`w-[96rpx]` 折成 48px、`width: 96rpx` 取原值 96),拿折算值互比会造出**假方形** ——
 * 而假方形=把胶囊读成真圆,它比漏报贵:那等于替"已清零"发合格证。
 * 判定要求作用域里所有宽高写成**同一个值**(正方),否则不算证明。
 */
export function isGeometricCircle(lines, i, radiusText, anchor) {
  if (halvedSideVerdict(lines, i, radiusText, anchor) === 'circle') return true
  const r = lengthLiteral(String(radiusText).replace(/^\{\s*|\s*\}$/g, ''))
  if (!r || r.v <= 0) return false
  const sides = anchor ? scopeDimTexts(lines, i, anchor) : scopeDimTexts(lines, i)
  if (sides.length < 2) return false
  const uniq = new Set(sides)
  if (uniq.size !== 1) return false
  const s = lengthLiteral([...uniq][0])
  if (!s) return false
  if (s.unit !== r.unit) return false
  return s.v === r.v * 2
}

/**
 * `<边长> / 2` 这种**把推导写在源码里**的形态:分子必须与同一作用域的边长逐字同形。
 * 与 `isGeometricCircle` 的区别是它判的是"作者写的是不是同一个量",而不是"两个数是不是二倍关系" ——
 * 前者对单位折算完全免疫(`width: AVATAR, borderRadius: AVATAR / 2` 也算),后者只认数值字面量。
 */
export function isHalfOfDeclaredSide(lines, i, numeratorText) {
  const n = String(numeratorText).trim().replace(/\s+/g, '')
  if (!n) return false
  const sides = scopeDimTexts(lines, i)
  return sides.length >= 2 && new Set(sides).size === 1 && [...sides][0] === n
}

/**
 * 只问形状、不要数值的调用方走这条投影 —— **形状判据仍然只有一份实现**。
 * 返回 'square' / 'wide' / null(量不到 ⇒ 不猜)。
 */
export function boxShape(allLines, idx, consts) {
  return boxDims(allLines, idx, consts).shape
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
export function objectDims(lines, idx, consts) {
  const scope = objectScope(lines, idx)
  if (!scope) return { w: 0, h: 0, shape: null, sameExpr: false }
  const win = lines.slice(scope.start, scope.end + 1).join('\n')
  return dimsFromText(win, constsForLines(lines, consts))
}

/**
 * **只认归属明确的那个盒**:先看这一行自己(单行 JSX 元素的 `className="w-10 h-10"`、
 * 单行 CSS 声明),量不全再退到本对象作用域(StyleSheet 对象 / CSS 规则块里 `width`/`height`
 * 常写在邻行)。量不到 ⇒ `null`,由调用方计"未判定"。
 *
 * 为什么另开一口而不是复用 `boxDims`:后者的窗口向后 6 行、向前 2 行是**刻意放宽**给
 * 门 11 主判据的(头像的 `style={{width,height}}` 常在后面几行,那条判据宁宽不漏)。
 * 但"半径超过上限"是一条判红判据,拿邻居的盒判在自己身上就是假阳 —— 实测同一枚
 * `w-2.5 h-2.5`(10×10,等效半径 5px)的红点,被窗口里邻行的 `w-[88rpx]` 头像顶成 44×44
 * ⇒ 等效 22px 而被判红。假阳的代价不是"多一条红",是逼人把一颗本来正确的圆改方。
 * 两个判半径上限的门(守门 11 的 C7 / 守门 77 的 B9)共用这一口,不得各写一遍。
 */
export function ownShortSidePx(lines, idx, consts) {
  const c = constsForLines(lines, consts)
  let d = dimsFromText(String(lines[idx] ?? ''), c)
  if (!(d.w > 0 && d.h > 0)) d = objectDims(lines, idx, c)
  /**
   * 第三档兜底:**属性区跨行书写**的 JSX 元素 —— 尺寸在 `className`(常在上一两行、还套着 `cn(...)`),
   * 半径在 `style={{ borderRadius: '50%' }}` 这一行。前两档都只看得见"本行"和"本行所属的对象字面量",
   * 于是这一型整族量不到:HEAD 实测 4 处全圆写法里有 2 处是它,而"量不到"在上限判据那里
   * 读起来和"没超标"一模一样 —— 一枚 40px 的圆只要把尺寸写在该行的上面一行,就能永远免检。
   * 只认 `boxDimsOwn` 的**可确定闭合**结论(它自己已经拒绝"猜祖先"):不闭合 ⇒ 继续量不到,不猜。
   */
  if (!(d.w > 0 && d.h > 0)) {
    const own = boxDimsOwn(lines, idx, c)
    if (own.confident) d = own
  }
  if (!(d.w > 0 && d.h > 0)) return null
  return Math.min(d.w, d.h)
}

/**
 * 长度折算与半径侧**共用同一份实现**(`lengthToPx`):半径读的是 px、盒形读的也是 px,两处各写
 * 一遍单位换算必然漂开。本轮"除法半径读成被除数 / `width: 96rpx` 不折半"就是同一笔债的两半,
 * 而只修一半会产出自洽的假阳(半径 8 配上量不到的 16×16 盒 ⇒ 把圆钮判成"该取 sm")。
 */
import { lengthToPx, constantMapOf, constExprPx } from './length-units.mjs'

/**
 * 盒形标识符常量表(`width: IMAGE_REMOVE_SIZE`)—— **默认自取,显式传入优先**。
 *
 * 为什么不把 `consts` 铺成每个调用方必传的参数:`classifyRadiusGeometry` / `isHalfOfDeclaredSide`
 * / `boxShape` / `boxDims` / `objectDims` 是一条链,铺参数要同批改 5 个门 × 3 个 lib 出口,而
 * **漏改一处的表现不是报错,是"那一侧量不到"** —— 本轮"半径认得除法、盒形认不得标识符"就是
 * 只改一半的产出:半径读出 8、盒形量不到 16×16,于是把一枚圆钮判成"control 该取 sm(4)"。
 * 缓存按 `lines` 的数组身份(同一文件逐行调用命中同一份),换文件即重算。
 */
let constsMemo = { key: null, map: null }
export function constsForLines(lines, provided) {
  if (provided instanceof Map) return provided
  if (!Array.isArray(lines)) return new Map()
  if (constsMemo.key === lines) return constsMemo.map
  const map = constantMapOf(lines.join('\n'))
  constsMemo = { key: lines, map }
  return map
}

/** 从一段文本量出宽高与形状 —— boxDims 与 objectDims 的共同出口(单位折算只此一处)。 */
export function dimsFromText(win, consts) {
  let w = 0
  let h = 0
  for (const m of win.matchAll(/\b([wh])-\[(\d+(?:\.\d+)?)(rpx|px)\]/g)) {
    const v = Number(m[2]) * (m[3] === 'rpx' ? 0.5 : 1)
    if (m[1] === 'w') w = Math.max(w, v)
    else h = Math.max(h, v)
  }
  for (const m of win.matchAll(
    /\b(width|height)\s*[:=]\s*(rpx\(\s*[0-9.]+\s*\)|[0-9.]+(?:px|rpx|rem)?)/g,
  )) {
    /**
     * **单位必须折成同一套**。本函数对 Tailwind 形态是折的(`w-[96rpx]` → 48px),而这一支从前
     * 直接取原值(`width: 96rpx` → 96)—— 同一个几何量在两种书写下差 2 倍,于是
     * `width: 96rpx; height: 96rpx; border-radius: 48rpx` 这种**写得最规范的真圆**永远证不出来
     * (96 vs 半径 24 在 px 空间,而盒按 96 在 rpx 空间),HEAD 实测 57 处因此卡在"量不到/不在档"。
     * 折算口径与半径侧**共用 `lengthToPx`** —— 两处各写一遍就必然漂开。
     */
    const v = lengthToPx(m[2])
    if (v === null || v <= 0) continue
    if (m[1] === 'width') w = Math.max(w, v)
    else h = Math.max(h, v)
  }
  /**
   * 标识符尺寸(`width: IMAGE_REMOVE_SIZE`)—— 查同一份文件的常量表。
   * 半径侧已经认得 `IMAGE_REMOVE_SIZE / 2`,盒形侧若不认同一个标识符,"半径 ≥ 短边一半"的等式
   * 就永远差一截:实测 `BottomActionBar.tsx:942` 与 `SearchInput.tsx:275` 两条 16×16 圆钮因此
   * 量不到盒形,被判成"control 该取 sm(4)" —— 那是**尺子的假阳**,照着它改代码就是把圆钮改方。
   * 两半必须同批改,这是本轮记下的一条规矩。
   */
  for (const m of win.matchAll(
    /\b(width|height)\s*[:=]\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\b/g,
  )) {
    /**
     * 求值走 `constExprPx` 那一份:它认标识符、成员档与链式
     * (`const SECONDARY_BTN_SIZE = rnGeometry.tapBox` 这种"常量指向具名档"的写法)。
     * 上一版只查一层 map 再交给 `lengthToPx`,所以这类盒形量不到 —— 半径侧认得、盒形侧不认,
     * 产出的是**自洽的假结论**,比"读不出来"更坏:它会替一个未判定发合格证。
     */
    const v = constExprPx(m[2], consts)
    if (v === null || v <= 0) continue
    if (m[1] === 'width') w = Math.max(w, v)
    else h = Math.max(h, v)
  }
  /**
   * **被单参长度包裹器写住的边长**(`width: toUnit(MODEL_LIST_CHECK_BOX_PX)`)。
   *
   * 上面那条标识符分支只能吃到 `toUnit` 这个名字(它要求右值以 `\b` 收尾且不带括号),所以
   * 整族包裹写法在尺子上等于"量不到":盒是 w=h=0、形状靠 `sameExpr` 判成 square,而短边算不出
   * 数值 ⇒ C6/C7 的 `Number.isFinite` 一判就退出,最后落"未判定/不在档"。HEAD 现读那一格是
   * `apps/miniapp-taro/src/components/ModelList.tsx:271`(20×20 的勾选框配 `X / 2` 半径,
   * 按 §4 属**几何真圆装饰件**,却报成 `off-scale 10px`)。
   * 求值仍交回 `constExprPx` **那一份**:倍率、限深、"解不到就 null"都住在那里,本函数不抄
   * 第二份单位折算(`rpx()` / 数字字面量这些既有形态早就由它认,这里只是把"带括号的调用"多喂一行)。
   * 解不到 ⇒ 与改动前逐字同结论(量不到),所以这一支只可能**增加**判定,不会把已有结论改坏。
   */
  for (const m of win.matchAll(
    /\b(width|height)\s*[:=]\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?\([^()]*\))/g,
  )) {
    const v = constExprPx(m[2], consts)
    if (v === null || v <= 0) continue
    if (m[1] === 'width') w = Math.max(w, v)
    else h = Math.max(h, v)
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
      /**
       * RN 侧的水平内边距与 Tailwind 的 `px-N` 是同一件事的两种书写 —— 只认后者会把
       * `paddingHorizontal: 8` 的按钮整个判成"量不到盒形",于是**半径=短边一半的胶囊从尺子上消失**
       * (2026-09-29 票㊼ 的立因:`BottomActionBar.addFileBtn`、`DevErrorToast.badge` 全是这一型)。
       */
      for (const m of win.matchAll(/\bpaddingHorizontal\s*:\s*([0-9.]+)/g))
        pxMax = Math.max(pxMax, Number(m[1]))
      for (const m of win.matchAll(/\bpadding(?:Left|Right)\s*:\s*([0-9.]+)/g))
        pxMax = Math.max(pxMax, Number(m[1]))
      /**
       * `minWidth` 是**下限**不是定值:渲染宽度只会 ≥ 它。单独出现不足以下结论(没有内边距时
       * 它可以正好等于高度 ⇒ 仍是方盒),但**只要有水平内边距**,宽度就必然超过这个下限 ⇒
       * 不得再按"可证正方盒"声称几何真圆。反过来,把 minWidth 直接当宽度用会把
       * `minWidth 36 + paddingHorizontal 8` 量成 36×36 的方盒 —— 那正是给胶囊发合格证。
       */
      const minW = minWidthPx(win, consts)
      if (minW !== null && pxMax > 0) return { w: Math.max(w, minW), h, shape: 'wide', sameExpr }
      if (pxMax && pxMax * 2 >= h) return { w, h, shape: 'wide', sameExpr }
    }
    return { w, h, shape: null, sameExpr }
  }
  return { w, h, shape: Math.max(w, h) / Math.min(w, h) <= 1.35 ? 'square' : 'wide', sameExpr }
}

/**
 * 量一段文本里的**宽度下限**(`minWidth: X` / `min-w-[24rpx]`),标识符与具名档都按 `constExprPx`
 * 那一份求值 —— 半径侧与盒形侧解的是同一个常量,两边各写一遍就必然出现"半径认得、盒形不认"
 * 那种自洽假结论(票㉟ 同一条)。取不到返回 null,由调用方按"没有下限"处理。
 */
export function minWidthPx(win, consts) {
  for (const m of String(win || '').matchAll(/\bminWidth\s*[:=]\s*([^,;}\n]+)/g)) {
    const v = constExprPx(m[1], consts)
    if (v !== null && v > 0) return v
  }
  for (const m of String(win || '').matchAll(/\bmin-w-\[(\d+(?:\.\d+)?)(rpx|px)\]/g)) {
    const v = lengthToPx(`${m[1]}${m[2]}`)
    if (v !== null && v > 0) return v
  }
  return null
}
