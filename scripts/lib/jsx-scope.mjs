// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// JSX **元素作用域**解析 —— 只回答结构问题:某一行落在哪个元素的**开标签**里、那个元素的祖先链
// 是什么、它自己应用了哪些样式键与类名。语义(哪一类元素该取哪一档)一律留在调用方,
// 本文件不认识"角色",也不做任何设计判断。
//
// 为什么必须存在(不是"更聪明一点",而是同一类缺陷的最后一格):
//  守门 150 原先按**整行**收集类别证据 —— 一行上出现的 `<Card`、`<Button`、`className="bg-card"`
//  全并成一个集合,于是:
//   ① 属性区跨行的开标签(`<select` 在第 119 行、`className=` 在第 122 行)时,承载属性的元素
//      **看不见自己的标签**,判据只能拿别处的证据 ⇒ HEAD 实测 5 处 `role-conflict` 未判定
//      (`z-popover` 这类**层叠档名**与 `bg-card` 这类**色档**被并成两个互斥类别);
//   ② 元素的**容器**完全不在射程里 —— 弹窗本体常命名为 `card:`(实测四个 RN 模态件同形:
//      `<Modal>` → root/center → card),按名字判它就是在要求把模态面收成卡片档。
//  这两格都不是"少读几个数",而是**凭空造出分叉 / 把对的判成错的**(门 128 票⑨ 同一条教训)。
//
// 失效方向(本文件的硬约束):判不出就说判不出,调用方必须回退它原来的判序。
//  - 只登记元素的**开标签区间**(属性写在这一段里),不登记整棵子树 —— 否则父元素会把子元素的
//    行抢走(第一版就是这样:弹窗第 206 行的 `styles.card` 被登记成父级 root);
//  - 同一行的候选按"区间最窄"取胜;并列 ⇒ `ambiguous: true` 交调用方退回旧判序(不猜);
//  - 闭合标签与栈失配 ⇒ 记 `corrupt` 并**不盲目弹栈**(盲弹会让后面整棵树的祖先都错);
//  - 字符串区间由 `lib/code-mask.maskedSpans` 给出(**词法只有一份**):串里的 `<View` 不得建元素,
//    而 JSX 文本里的撇号被词法器当成未闭合串时,后果是**少认一个元素**,不是多认一个(宁漏不误判);
//  - 泛型/比较式里的 `<` 按前一个非空白字符与名字形状排除,排除不掉的一律不建元素并计数报名。

/** 一个开标签的属性区跨这么多行还没闭合,就认定解析不出(不猜)。 */
const MAX_TAG_SPAN_LINES = 40

const ID_RE = /[A-Za-z0-9_$]/

/**
 * 可以**直接接一个表达式**的关键字:`return <div/>`、`yield <Modal/>`、`await <X/>`、
 * `case <` 不算(那是比较),但 `default` 在 JSX 三元里可能接元素。判据只用于"前一词元是不是
 * 关键字而不是普通标识符",所以宁可少列(漏列的形态只是退回 genericSkipped 报名,不会误建元素)。
 */
const EXPR_KEYWORDS = new Set(['return', 'yield', 'await', 'in', 'of', 'else', 'do', 'throw'])

/**
 * 内在标签白名单。刻意**不**放宽成"全小写即标签":`a < divx` 这类比较式会凭空长出幽灵祖先,
 * 而祖先是改判依据 —— 多一个假祖先比少认一个真标签贵得多(假阳比漏报更贵,门 118 记过)。
 * RN / Taro 侧真仓一律是 `<View>` 这类大写组件名,走 `isComponentName` 那一支。
 */
const INTRINSIC = new Set([
  'div',
  'span',
  'p',
  'a',
  'ul',
  'li',
  'ol',
  'dl',
  'dt',
  'dd',
  'button',
  'input',
  'select',
  'option',
  'optgroup',
  'textarea',
  'label',
  'fieldset',
  'legend',
  'svg',
  'path',
  'circle',
  'rect',
  'line',
  'g',
  'polyline',
  'polygon',
  'img',
  'br',
  'hr',
  'b',
  'i',
  'u',
  's',
  'em',
  'strong',
  'small',
  'code',
  'pre',
  'kbd',
  'samp',
  'mark',
  'sub',
  'sup',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'section',
  'header',
  'footer',
  'nav',
  'main',
  'article',
  'aside',
  'blockquote',
  'figure',
  'figcaption',
  'details',
  'summary',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
  'form',
  'video',
  'audio',
  'source',
  'canvas',
  'iframe',
])

function isComponentName(name) {
  if (name.length < 2) return false
  return name[0] >= 'A' && name[0] <= 'Z'
}

/** `<Modal.Header>` 取末段(与守门 150 原逐行正则同口径,不另起一套)。 */
export function tagBase(name) {
  const parts = String(name || '').split('.')
  return parts[parts.length - 1] || ''
}

/**
 * 属性区 → 该元素**自己**的样式键与类名(去重,保持出现次序)。
 * 只认 `style=` 与 `class(Name)=`:`contentContainerStyle` / `listHeaderComponentStyle` 那类
 * 是**别的元素**的档,算进本元素就是替别人认领身份。
 */
export function attrNames(attrText) {
  const keys = []
  const classes = []
  const push = (arr, v) => {
    if (v && !arr.includes(v)) arr.push(v)
  }
  let m
  const styleRe = /\bstyle\s*=\s*\{/g
  while ((m = styleRe.exec(attrText))) {
    let depth = 1
    let i = m.index + m[0].length
    const start = i
    while (i < attrText.length && depth > 0) {
      const c = attrText[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      i++
    }
    const body = attrText.slice(start, i - 1)
    for (const k of body.matchAll(/([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g)) push(keys, k[2])
    // `StyleSheet.absoluteFill` 是"满屏遮罩"这一**几何事实**的名字,不是某个样式键
    if (/StyleSheet\s*\.\s*absoluteFill/.test(body)) push(keys, 'absoluteFill')
  }
  const classRe = /\bclass(?:Name)?\s*=\s*(["'`])([^"'`\n]*)\1/g
  while ((m = classRe.exec(attrText))) for (const c of m[2].trim().split(/\s+/)) push(classes, c)
  // 模板串属性(`className={`a ${x ? 'bg-card' : ''}`}`)只取字面段:动态拼出来的不猜
  const tmplRe = /\bclass(?:Name)?\s*=\s*\{[^{}]*["'`]([^"'`\n]*)["'`]/g
  while ((m = tmplRe.exec(attrText))) for (const c of m[1].trim().split(/\s+/)) push(classes, c)
  return { keys, classes }
}

function makeLineAt(text) {
  const nl = []
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') nl.push(i)
  return (pos) => {
    let lo = 0
    let hi = nl.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (nl[mid] < pos) lo = mid + 1
      else hi = mid
    }
    return lo + 1
  }
}

/**
 * 扫一遍 JSX 面,产出元素清单与**逐开标签区间**的归属。
 *
 * @param {string} src 注释已抹、字符串保留的一面(见 `lib/radius-roles.maskFaces`)
 * @param {{strings?: {start: number, end: number}[]}} [opts] 字符串区间来自
 *        `lib/code-mask.maskedSpans`(词法只有一份);不给就退化成"遇引号按配对处理"
 * @returns {{
 *   elements: {name: string, base: string, line: number, attrEndLine: number,
 *              keys: string[], classes: string[], ancestors: string[]}[],
 *   byLine: Map<number, {self: number, selfName: string, ancestors: string[], keys: string[],
 *                        classes: string[], ambiguous: boolean}>,
 *   corrupt: number, genericSkipped: number, truncated: number,
 * }}
 */
export function scanJsx(src, opts = {}) {
  const text = String(src || '')
  const lineAt = makeLineAt(text)
  const strEnd = new Map()
  for (const s of opts.strings || []) strEnd.set(s.start, s.end)
  const elements = []
  /** @type {number[]} 栈:当前未闭合元素索引(自下而上即祖先链) */
  const stack = []
  /** @type {Map<number, number[]>} 行 → 候选元素索引(开标签覆盖该行) */
  const cands = new Map()
  let corrupt = 0
  let genericSkipped = 0
  let truncated = 0

  const jumpString = (i) => {
    if (strEnd.has(i)) return strEnd.get(i)
    if (opts.strings) return i + 1 // 词法器说这里不是串起手 ⇒ 当普通字符(引号可能是 JSX 文本里的撇号)
    const q = text[i]
    let j = i + 1
    while (j < text.length) {
      if (text[j] === '\\') {
        j += 2
        continue
      }
      if (text[j] === q) return j + 1
      if (text[j] === '\n' && q !== '`') return j
      j++
    }
    return j
  }

  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      i = jumpString(i)
      continue
    }
    if (c !== '<') {
      i++
      continue
    }
    if (text[i + 1] === '/') {
      const m = /^<\/\s*([A-Za-z][\w.]*)/.exec(text.slice(i, i + 80))
      if (!m) {
        i += 2
        continue
      }
      const nm = tagBase(m[1])
      let at = -1
      /**
       * 取**最近的**同名祖先 —— 必须命中即停。第一版没有 `break`,循环走到最后一个同名元素,
       * 于是 `</View>` 把内层 View 连同祖先一起弹光(实测 LoginPopUp 第 241 行的闭合
       * 匹配到第 204 行那个 View,栈深从 5 掉到 1)—— 症状不是报错,而是**后面的元素全部
       * 看不见自己的祖先**:包含关系判据整片失明,而 corrupt 计数一片安静。
       */
      for (let k = stack.length - 1; k >= 0; k--)
        if (elements[stack[k]].base === nm) {
          at = k
          break
        }
      const end = text.indexOf('>', i)
      const to = end < 0 ? text.length : end
      if (at < 0) {
        // 找不到配对的开标签:不猜、不清栈。清栈会把后面所有元素的祖先一起毁掉,
        // 那正是"把判不出写成判过了"。
        corrupt++
        i = to + 1
        continue
      }
      stack.length = at
      i = to + 1
      continue
    }
    const m = /^<([A-Za-z][\w.]*)/.exec(text.slice(i, i + 120))
    if (!m) {
      i++
      continue
    }
    const name = m[1]
    let p = i - 1
    while (p >= 0 && /\s/.test(text[p])) p--
    const prev = p >= 0 ? text[p] : ''
    if (ID_RE.test(prev) || prev === '.') {
      /**
       * 前一个词元是**标识符** ⇒ 这个 `<` 通常是泛型参数或比较运算(`Array<View>` / `a < b`)。
       * 但 `return <div>x</div>`、`await <Modal/>` 这类**表达式关键字后面直接接 JSX**(不套括号)
       * 是真实写法:实测这一型让扫描器在 `function E(){ return <div/> }` 上直接失配,
       * 而失配的表现不是报错,是**这一整个文件的容器维不生效**(C4/C5 双双看不见)。
       * 所以按"前一词元是否为可接表达式的关键字"放行,其余照旧计 genericSkipped。
       */
      let w = p
      while (w >= 0 && ID_RE.test(text[w])) w--
      const word = text.slice(w + 1, p + 1).toLowerCase()
      if (!EXPR_KEYWORDS.has(word) || prev === '.') {
        genericSkipped++ // `Array<View>` / `useState<Foo>()` / `a.b < C`
        i++
        continue
      }
    }
    if (prev === '>') {
      // **必须再往前看一格**:JSX 子元素紧跟在父标签的 `>` 之后,把 `>` 一律当"非标签起始"
      // 会把整棵子树跳掉(第一版就是这么把 LoginPopUp 读成 3 个元素 —— 由自检的真仓对照抓出)。
      // 只有 `=>` 后面那个 `<` 才是泛型参数。
      let q = p - 1
      while (q >= 0 && /\s/.test(text[q])) q--
      if (text[q] === '=') {
        genericSkipped++
        i++
        continue
      }
    }
    const base = tagBase(name)
    if (!isComponentName(base) && !INTRINSIC.has(base)) {
      genericSkipped++ // `<T,>`、`<spanx/>` 之类名字形状不对的,一律不认成元素
      i++
      continue
    }
    let j = i + 1 + name.length
    let brace = 0
    let selfClosed = false
    let endPos = -1
    const startLine = lineAt(i)
    while (j < text.length) {
      const d = text[j]
      if (d === '"' || d === "'" || d === '`') {
        j = jumpString(j)
        continue
      }
      if (d === '{') brace++
      else if (d === '}') brace = Math.max(0, brace - 1)
      else if (d === '>' && brace === 0) {
        selfClosed = text[j - 1] === '/'
        endPos = j
        break
      } else if (d === '\n' && lineAt(j) - startLine > MAX_TAG_SPAN_LINES) break
      j++
    }
    if (endPos < 0) {
      truncated++
      i = j
      continue
    }
    const attrText = text.slice(i + 1 + name.length, endPos)
    const { keys, classes } = attrNames(attrText)
    const idx = elements.length
    const attrEndLine = lineAt(endPos)
    elements.push({
      name,
      base,
      line: startLine,
      attrEndLine,
      keys,
      classes,
      ancestors: stack.map((k) => elements[k].base),
      /**
       * 祖先的**索引**也要留:调用方判"这个元素是不是模态面"时,除标签名之外还得读
       * 祖先自己应用的样式键(`overlay:` / `backdrop:` 这类遮罩名活在键上而不是标签上)。
       * 只给标签名就等于把遮罩族整片判不出来。
       */
      ancestorsIdx: stack.slice(),
    })
    for (let l = startLine; l <= attrEndLine; l++) {
      if (!cands.has(l)) cands.set(l, [])
      cands.get(l).push(idx)
    }
    if (!selfClosed) stack.push(idx)
    i = endPos + 1
  }

  // 行归属:开标签区间最窄的那个元素赢(嵌套元素比祖先窄);并列则 ambiguous 交调用方退回旧判序。
  const byLine = new Map()
  for (const [l, list] of cands) {
    let best = list[0]
    // 并列计数从 1 起(自己就是一个候选),并且**不再把 list[0] 再扫一遍** —— 第一版从 0 起
    // 又把首个候选重数一次,于是"同行两个元素"和"同行一个元素"都算 ties>1 之外的值,
    // 归属歧义被判成明确(该报名的没报)。
    let ties = 1
    let bestW = elements[best].attrEndLine - elements[best].line
    for (const idx of list.slice(1)) {
      const w = elements[idx].attrEndLine - elements[idx].line
      if (w < bestW) {
        bestW = w
        best = idx
        ties = 1
      } else if (w === bestW) ties++
    }
    const el = elements[best]
    byLine.set(l, {
      self: best,
      selfName: el.base,
      ancestors: el.ancestors,
      keys: el.keys,
      classes: el.classes,
      ambiguous: ties > 1,
    })
  }
  return { elements, byLine, corrupt, genericSkipped, truncated }
}

/** 该面里根本没有像样的 JSX(纯 TS / CSS)⇒ 跳过解析,调用方按旧判序走。 */
export function hasJsxShape(src) {
  return /<([A-Z][\w.]*|div|span|button|input|select|textarea|label|svg|p|a|section|header|footer|img|h[1-6])[\s/>]/.test(
    String(src || ''),
  )
}

export const __test__ = { scanJsx, attrNames, hasJsxShape, isComponentName, tagBase, INTRINSIC, makeLineAt }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
