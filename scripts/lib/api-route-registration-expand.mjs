// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后端嵌套注册与矩阵展开(从 check-api-routes 抽出，守门 103 C1；行为与原文逐字同形)。
 */
export const GATE_UNKNOWN = '<unresolved-gate>'

/** 将路径归一化为可比较的形式：/api/admin/users/:param */
export function normalizePath(prefix, localPath) {
  if (!prefix) return localPath
  if (localPath === '/' || localPath === '') return prefix
  // 去掉尾部/头部多余斜杠，避免双斜杠
  const cleanPrefix = prefix.replace(/\/+$/, '')
  const cleanLocal = localPath.replace(/^\//, '')
  if (cleanLocal === '') return cleanPrefix
  return `${cleanPrefix}/${cleanLocal}`
}

/** 跳过引号/模板串字面量,返回结尾引号的下标 */
function skipQuotedLiteral(text, i) {
  const q = text[i]
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') j++
    else if (text[j] === q) return j
  }
  return text.length - 1
}

/** 跳过注释(行注释/块注释),返回注释结束处的下标 */
function skipCommentLiteral(text, i) {
  if (text[i + 1] === '/') {
    const nl = text.indexOf('\n', i)
    return nl === -1 ? text.length : nl
  }
  const end = text.indexOf('*/', i + 2)
  return end === -1 ? text.length : end + 1
}

/**
 * 从 `openLine` 行**末尾**那个 `{` 起,按行配对找到该块的闭合行号(0 基)。
 * 找不到(该行末尾不是 `{`,或扫到文件末尾仍未闭合)⇒ 返回 `openLine`(调用方据此"不跳")。
 *
 * 只为 `inferMethodAtLine` 的作用域段服务:跳过**别的** React hook 对象块。
 * 行内字符串/模板串里的花括号必须排除 —— 否则 `` `{` `` 之类字面量会把配平算歪。
 * 复用现成的 `findMatchingBracket`(它已处理字符串与注释):把行数组拼回全文即可。
 */
export function findBraceBlockEnd(lines, openLine) {
  const first = lines[openLine] || ''
  if (!/\{\s*$/.test(first)) return openLine
  let start = 0
  for (let i = 0; i < openLine; i++) start += (lines[i] || '').length + 1
  const text = lines.join('\n')
  const close = findMatchingBracket(text, start + first.length - 1, '{', '}')
  if (close === -1) return openLine
  let line = openLine
  let consumed = start + first.length
  while (line + 1 < lines.length && consumed <= close) {
    consumed += (lines[line] || '').length + 1
    line++
  }
  return line
}

/** 从 openIdx 处的开括号找到配对闭括号下标(跳过字符串与注释);-1 = 未配平 */
export function findMatchingBracket(text, openIdx, openChar, closeChar) {
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i]
    if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipCommentLiteral(text, i)
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuotedLiteral(text, i)
      continue
    }
    if (ch === openChar) depth++
    else if (ch === closeChar) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 收集同文件内 `const NAME = [ { col: 'v', flag: true }, ... ]` 形态的对象数组(能力矩阵) */
function extractMatrixArrays(text) {
  const matrices = new Map()
  const declRe = /const\s+([A-Za-z0-9_$]+)\s*=\s*\[/g
  let m
  while ((m = declRe.exec(text)) !== null) {
    const closeIdx = findMatchingBracket(text, m.index + m[0].length - 1, '[', ']')
    if (closeIdx === -1) continue
    const body = text.slice(m.index + m[0].length, closeIdx)
    const rowRe = /\{([^{}]*)\}/g
    const rows = []
    let r
    while ((r = rowRe.exec(body)) !== null) {
      const pairRe = /([A-Za-z0-9_$]+)\s*:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`|(true|false))/g
      const row = {}
      let p
      while ((p = pairRe.exec(r[1])) !== null) {
        const strVal = p[2] ?? p[3] ?? p[4]
        row[p[1]] = strVal === undefined ? p[5] === 'true' : strVal
      }
      if (Object.keys(row).length > 0) rows.push(row)
    }
    if (rows.length > 0) matrices.set(m[1], rows)
  }
  return matrices
}

/** 收集同文件内 `const NAME = '/xxx'` 形态的路径前缀字符串常量 */
function extractPathConsts(text) {
  const consts = new Map()
  const re = /const\s+([A-Za-z0-9_$]+)\s*=\s*'([^']*)'/g
  let m
  while ((m = re.exec(text)) !== null) {
    if (m[2].startsWith('/')) consts.set(m[1], m[2])
  }
  return consts
}

/** 找出迭代"同文件矩阵数组"的 for-of 循环体区间 + `const VAR = ITEM.列名` 绑定 */
function findMatrixLoops(text, matrices) {
  const loops = []
  const re =
    /for\s*\(\s*(?:const|let|var)\s+([A-Za-z0-9_$]+)\s+of\s+(?:[A-Za-z0-9_$]+\.)?([A-Za-z0-9_$]+)\s*\)\s*\{/g
  let m
  while ((m = re.exec(text)) !== null) {
    const rows = matrices.get(m[2])
    if (!rows) continue
    const bodyStart = m.index + m[0].length - 1
    const bodyEnd = findMatchingBracket(text, bodyStart, '{', '}')
    if (bodyEnd === -1) continue
    const bindRe = new RegExp(
      `const\\s+([A-Za-z0-9_$]+)\\s*=\\s*${m[1]}\\.([A-Za-z0-9_$]+)\\b`,
      'g',
    )
    const bindings = new Map()
    let b
    while ((b = bindRe.exec(text.slice(bodyStart, bodyEnd))) !== null) {
      bindings.set(b[1], b[2])
    }
    loops.push({ itemVar: m[1], rows, bindings, bodyStart, bodyEnd })
    re.lastIndex = bodyEnd
  }
  return loops
}

/** 扫描 [from, at) 得到 at 处所有未闭合 `{` 的行首文本(外层 → 内层) */
function openBracePrefixes(text, from, at) {
  const stack = []
  for (let i = from; i < at; i++) {
    const ch = text[i]
    if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipCommentLiteral(text, i)
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuotedLiteral(text, i)
      continue
    }
    if (ch === '{') {
      stack.push(text.slice(text.lastIndexOf('\n', i) + 1, i).trim())
    } else if (ch === '}') {
      stack.pop()
    }
  }
  return stack
}

/**
 * 注册点的条件包裹判定(用于与能力矩阵求交)。
 * @returns {string[]|string} 门控列名数组(空 = 无 if 包裹,对所有行注册);GATE_UNKNOWN = 不可判定
 */
function resolveGateKeys(text, loop, at) {
  const gates = []
  for (const prefix of openBracePrefixes(text, loop.bodyStart, at)) {
    if (/\belse\b|\bswitch\b/.test(prefix)) return GATE_UNKNOWN
    const m = prefix.match(/^if\s*\((.*)\)\s*$/)
    if (!m) continue
    const key = m[1].trim().match(new RegExp(`^${loop.itemVar}\\.([A-Za-z0-9_$]+)$`))
    if (!key) return GATE_UNKNOWN
    gates.push(key[1])
  }
  return gates
}

/**
 * 展开嵌套 `X.register(async (VAR) => { … }, { prefix: '/p' })` 里的注册(2026-10-04,机制④)。
 *
 * ## 缺陷本体
 * `methodRe` 收 `sub.put('/cancel')` 时只拿到 localPath `/cancel`,**丢掉了同一 register 调用的
 * options.prefix**(`/authUser`)。真实注册面是 `/authUser/cancel`,再经外层 `/api/admin` + `/role`
 * 两级 prefix 拼成 `/api/admin/role/authUser/cancel` —— 而 `/cancel` 单独进面,拼出来的候选里
 * 永远没有那条 ⇒ 前端 `packages/api-client/src/endpoints/admin-system.ts:393` 的
 * `PUT /api/admin/role/authUser/cancel` 被判死调用(它现在靠 `.check-api-routes-ignore.json`
 * 的一条豁免挂着,理由就是这个"两级相对前缀链盲区")。
 *
 * ## 面实测(HEAD 面 589 个 `apps/api/src/routes/**.ts`)
 * 嵌套 register 形态 **10 处**,其中尾部带 `{ prefix }` 的 **4 处**,全部是本型:
 *   `admin-sys/role-routes.ts:98` VAR=sub prefix=/authUser(5 个端点)
 *   `admin-sys/alias-routes.ts:24` VAR=s prefix=/login-logs;`:46` prefix=/tasks/logs;`:67` prefix=/posts
 * 另 6 处 `server.register(fn)` 无 prefix ⇒ 本函数对它们不产出任何条目(逐字保持原行为)。
 *
 * ## 判据边界(刻意保守,宁可漏也不臆造)
 *  1. 只认 `register(` 后**紧跟** `async (VAR) =>` 的字面形态;中间夹别的参数一律不认;
 *  2. prefix 取**同一 register 调用尾部**的 `{ prefix: '…' }` —— 括号配对扫到 `register(` 的
 *     闭合括号为止,跨过闭合点就不认(避免把兄弟 register 的 prefix 串到本块上);
 *  3. 块内只认 `VAR.method('…')`(**同一个变量名**),`VAR` 之外的注册不归本 prefix;
 *  4. 块内若还有第二层 `register(`,本函数**不递归** —— 只展开一层,解析不出即不产出。
 *  产出的是**额外**条目(原有 methodRe 那条 `/cancel` 仍原样进面),所以这是纯增益、零删除。
 */
/**
 * 泛型实参组(单一真相源,2026-10-19 立):路由注册与 wrapper 定义都可能带泛型,
 * 而泛型里**还能再套泛型** —— `server.post<{ Params: z.infer<typeof X> }>(…)`。
 * 旧式 `(?:<[^<>()]*>)?` 的字符类把 `<` `>` 一律挡掉 ⇒ 套一层就整型失配 ⇒
 * 那条路由**在册却看不见** ⇒ 它的前端真调用被报成死调用(方向:把正确实现钉红)。
 * 本仓现读:全仓只有 2 处这种嵌套泛型注册(`apps/api/src/routes/points-mall-user.ts:77`
 * 与 `apps/api/src/routes/points-tasks.ts:333`),而它们各自让 1~2 个 RN/小程序调用
 * 被误判成死调用 ⇒ 实测不是理论风险,已由真机侧 RN 代理给出同一条路径的复现。
 * 现式允许外层里再嵌一层(`z.infer<typeof X>` 这类),够吃仓内形态;
 * 再深的嵌套(≥4 层)不在覆盖内 —— 真出现时本门会把那条路由读成"看不见",
 * 即退化成旧行为(判假死调用),而不是静悄悄放过。
 */
export const GENERIC_ARGS_SRC = '(?:<[^<>]*(?:<[^<>]*>[^<>]*)*>)?'

export function expandNestedRegisterRoutes(src, rel) {
  const out = []
  const openRe = /\.register\(\s*(?:async\s*)?\(\s*([A-Za-z0-9_$]+)\s*\)\s*=>/g
  let m
  while ((m = openRe.exec(src)) !== null) {
    const varName = m[1]
    // 从 register( 的开括号起做括号配对,找它的闭合位置(跳过引号/模板串/注释内的括号)
    const openIdx = src.indexOf('(', m.index)
    const closeIdx = matchBracket(src, openIdx)
    if (closeIdx === -1) continue
    const callArgs = src.slice(openIdx + 1, closeIdx)
    // 尾部形如 `…},\n  { prefix: '/authUser' },\n` —— **options 后可以有 trailing comma**
    // (role-routes.ts:196 实测就是 `},\n    { prefix: '/authUser' },\n  )`),故收尾允许 `,?\s*$`。
    const pm = callArgs.match(/\}\s*,\s*\{\s*prefix\s*:\s*['"`]([^'"`]+)['"`]\s*\}\s*,?\s*$/)
    if (!pm) continue // 无 prefix / prefix 不在尾部 ⇒ 不产出(保持原行为)
    const prefix = pm[1]
    // 块体 = 箭头函数体的大括号区间
    const bodyOpen = callArgs.indexOf('{')
    if (bodyOpen === -1) continue
    const bodyClose = matchBracket(callArgs, bodyOpen)
    if (bodyClose === -1) continue
    const body = callArgs.slice(bodyOpen + 1, bodyClose)
    // 第二层 register ⇒ 本函数不递归,整块跳过
    if (/\.\s*register\s*\(/.test(body)) continue
    const innerRe = new RegExp(
      `\\b${varName}\\s*\\.\\s*(get|post|put|patch|delete|options|head)${GENERIC_ARGS_SRC}\\(\\s*['"\`]([^'"\`]*)['"\`]`,
      'g',
    )
    let im
    while ((im = innerRe.exec(body)) !== null) {
      out.push({
        method: im[1].toUpperCase(),
        localPath: normalizePath(prefix, im[2]),
        file: rel,
      })
    }
  }
  return out
}

/** 从 `text[i]`(必须是 `(` 或 `{`)起做括号配对,返回闭合括号下标;引号/模板串/行注释内的括号不计 */
function matchBracket(text, i) {
  const pairs = { '(': ')', '{': '}', '[': ']' }
  const open = text[i]
  const close = pairs[open]
  if (!close) return -1
  let depth = 0
  for (let k = i; k < text.length; k++) {
    const ch = text[k]
    if (ch === '"' || ch === "'" || ch === '`') {
      const e = skipQuotedLiteral(text, k)
      if (e === -1) return -1
      k = e
      continue
    }
    if (ch === '/' && text[k + 1] === '/') {
      const nl = text.indexOf('\n', k)
      if (nl === -1) return -1
      k = nl
      continue
    }
    if (ch === '/' && text[k + 1] === '*') {
      const e = text.indexOf('*/', k + 2)
      if (e === -1) return -1
      k = e + 1
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return k
    }
  }
  return -1
}

/** 展开单个源文件里"模板串注册"的真实路由(无法确定形态一律不产出) */
export function expandTemplatedRoutes(src, rel) {
  const matrices = extractMatrixArrays(src)
  const pathConsts = extractPathConsts(src)
  if (matrices.size === 0 && pathConsts.size === 0) return []
  const loops = findMatrixLoops(src, matrices)
  const tmplRe =
    /\b(?:server|s|child|scope|authed|instance|app|fastify)\.(get|post|put|patch|delete)\(\s*`([^`]*)`/g
  const out = []
  let m
  while ((m = tmplRe.exec(src)) !== null) {
    const method = m[1].toUpperCase()
    const tpl = m[2]
    if (!tpl.includes('${')) continue // 纯字面量模板串:既有 methodRe 已覆盖
    const vars = [...new Set([...tpl.matchAll(/\$\{([A-Za-z0-9_$]+)\}/g)].map((v) => v[1]))]
    if (vars.length === 0) continue // 复杂表达式插值(${a.b} / 三元)不展开
    const loop = loops.find((l) => m.index > l.bodyStart && m.index < l.bodyEnd)
    if (loop) {
      if (!vars.every((v) => loop.bindings.has(v))) continue
      const gates = resolveGateKeys(src, loop, m.index)
      if (gates === GATE_UNKNOWN) continue
      for (const row of loop.rows) {
        if (gates.some((g) => row[g] !== true)) continue // 能力矩阵求交
        let ok = true
        const localPath = tpl.replace(/\$\{([A-Za-z0-9_$]+)\}/g, (_s, v) => {
          const col = row[loop.bindings.get(v)]
          if (typeof col !== 'string' || col === '') {
            ok = false
            return ''
          }
          return col
        })
        if (ok) out.push({ method, localPath, file: rel })
      }
      continue
    }
    if (!vars.every((v) => pathConsts.has(v))) continue
    out.push({
      method,
      localPath: tpl.replace(/\$\{([A-Za-z0-9_$]+)\}/g, (_s, v) => pathConsts.get(v)),
      file: rel,
    })
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
