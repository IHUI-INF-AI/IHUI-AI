// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * "带默认值的解构形参 被 `X !== undefined` 当存在性判据"这一型的唯一实现。
 *
 * 为什么住 lib:发现它的是一条一次性量算脚本(扫全仓找同型),而它必须变成常驻判据才不会
 * 被下一次顺手改动复活 —— 判据与测试共用这一份,不得在测试里再抄一份正则(§22c)。
 *
 * 立因(实测,不是假想):`apps/mobile-rn/src/components/LoginPopUp.tsx` 的形参写 `role = 'normal'`,
 * 而 `showProfile` 的 Boolean(...) 里含 `role !== undefined` ⇒ 该项恒真 ⇒ 整支 `showProfile`
 * 恒真 ⇒ 唯一调用点(`ProfileScreen.tsx:639`,只传 title/primary/secondary/agree)本意要渲染的
 * 授权卡**结构上不可达**,屏幕上是一个空白资料表单。typecheck / lint / 其余门全都不响
 * —— 带默认值的形参让 `!== undefined` 在类型层也永远成立。
 *
 * 两条必需的窄口径(各自都有真仓反例,放宽任一条就产出一台会喊错的尺子):
 *  · 只认**裸标识符**:`props.prompt !== undefined` 不判 —— 默认值可能住在另一个函数的解构里,
 *    而判据问的是"这一次调用有没有传",两者不同作用域(真仓 `BottomActionBar.tsx:229` 就是这一形)。
 *  · 只认**同一函数体内**的默认值绑定:跨函数配对会把不相干的同名形参算成恒真。
 */

/** 从 `({... prompt = '' ...})` 形式的参数表里取"带默认值的解构名"。 */
function defaultedBindingsOf(body) {
  const names = new Set()
  for (const m of body.matchAll(/[{,]\s*([A-Za-z_$][\w$]*)\s*=\s*(?:'[^']*'|"[^"]*"|`[^`]*`|\[\]|\{\}|true|false|null|[A-Za-z_$][\w$.]*\s*\(\)|\d+)\s*[,}]/g)) {
    names.add(m[1])
  }
  return names
}

/**
 * 按"函数体"切面:以 `function 名(` / `const 名 = (` / `export function` 为界粗切。
 * 刻意不做完整 AST —— 本判据只要"同一函数体内"这一维,切多了会漏、切少了会误配,
 * 两种都由测试用例钉住(见 apps/mobile-rn/tests/prop-default-presence-tautology.test.ts)。
 */
function functionBodies(src) {
  const out = []
  const re = /(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(([\s\S]{0,4000}?)\)\s*(?::[^{]{0,200})?\{/g
  let m
  while ((m = re.exec(src))) {
    const params = m[1]
    const start = m.index
    const braceEnd = matchBrace(src, src.indexOf('{', m.index + m[0].length - 1))
    out.push({ start, params, body: src.slice(start, braceEnd < 0 ? src.length : braceEnd) })
  }
  const re2 = /(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\(([\s\S]{0,4000}?)\)\s*(?::[^{=>]{0,200})?=>\s*\{/g
  while ((m = re2.exec(src))) {
    const start = m.index
    const braceEnd = matchBrace(src, src.indexOf('{', m.index + m[0].length - 1))
    out.push({ start, params: m[2], body: src.slice(start, braceEnd < 0 ? src.length : braceEnd) })
  }
  return out
}

function matchBrace(src, from) {
  if (from < 0) return -1
  let depth = 0
  for (let i = from; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * 剥注释(等长遮罩,行号不变)。`maskStrings` 那一维**按用途分档**,不得共用一层:
 *  · 认"形参带不带默认值"时必须**保留字符串** —— 默认值本身就是 `'normal'` / `''` 这样的字面量,
 *    连字符串一起抹会让绑定检测失明(本仓守门 134 / 118 记过同一型:两层遮噪方向不同)。
 *  · 认 `X !== undefined` 判据时必须**连字符串也抹** —— 否则注释与字符串里"解释旧写法"的散文
 *    会被当成真判据(守门 70 / 131 记过:门把自己解释自己的散文判成违规)。
 * 只遮单行内闭合的引号对,不做跨行状态机 —— 跨行状态机遇到 JSX 文本里的孤引号(`it's`)会把后面
 * 整段真代码一路遮掉,那是把"看不见"制造成"确信没有"。
 */
export function maskCode(src, { maskStrings = true } = {}) {
  const out = []
  let inBlock = false
  for (const line of (src || '').split('\n')) {
    if (inBlock) {
      const end = line.indexOf('*/')
      out.push(end >= 0 ? ' '.repeat(end + 2) + maskStr(line.slice(end + 2), maskStrings) : ' '.repeat(line.length))
      if (end >= 0) inBlock = false
      continue
    }
    let cur = line
    const bs = cur.indexOf('/*')
    if (bs >= 0) {
      const be = cur.indexOf('*/', bs + 2)
      if (be >= 0) {
        cur = cur.slice(0, bs) + ' '.repeat(be - bs + 2) + cur.slice(be + 2)
      } else {
        cur = cur.slice(0, bs) + ' '.repeat(cur.length - bs)
        inBlock = true
      }
    }
    cur = cur.replace(/^\s*\/\/.*$/, (m) => ' '.repeat(m.length)).replace(/\/\/(?!\s*(https?:|\\\\)).*$/g, (m) => ' '.repeat(m.length))
    out.push(maskStrings ? maskStr(cur, true) : cur)
  }
  return out.join('\n')
}

function maskStr(line, on) {
  if (!on) return line
  return line.replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, (m) => ' '.repeat(m.length))
}

/** 返回该源码里所有"恒真的存在性判据"命中:{line, name, snippet}。 */
export function findDefaultParamTautologies(src) {
  /**
   * **两层遮噪方向不同,不能混用一层**(本仓在守门 134/118 各记过一次):
   *  · 找"带默认值的形参"要**保留字符串** —— 默认值本身常是 `'normal'` / `''` 这类字面量,
   *    连字符串一起抹会让绑定检测失明(第一版就犯了这个:阳性对照直接判不出)。
   *  · 找 `X !== undefined` 判据要**连字符串也抹** —— 否则 `const note = 'role !== undefined'`
   *    这类散文/示例文本会被当成真判据(反向对照 B 钉住)。
   * 两把遮罩都按行等长替换,所以同一偏移可直接对齐。
   */
  const bindingsFace = maskCode(src, { maskStrings: false })
  const predicateFace = maskCode(src, { maskStrings: true })
  const raw = predicateFace.split('\n')
  const hits = []
  for (const fn of functionBodies(bindingsFace)) {
    const names = defaultedBindingsOf(fn.params)
    if (!names.size) continue
    const baseLine = predicateFace.slice(0, fn.start).split('\n').length
    const rel = predicateFace.slice(fn.start)
    for (const m of rel.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*!==\s*undefined\b/g)) {
      if (!names.has(m[2])) continue
      const line = baseLine + rel.slice(0, m.index).split('\n').length - 1
      hits.push({ line, name: m[2], snippet: (raw[line - 1] || '').trim() })
    }
  }
  const seen = new Set()
  return hits.filter((h) => {
    const k = `${h.line}:${h.name}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
