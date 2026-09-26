// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * outbound-route-facts.mjs — 守门 `check-declared-outbound-routes.mjs` 的**纯判据层**。
 *
 * 为什么单独成文件:① 判据本体(注释遮噪 / 字面量扫描 / self-base 与出站包装推导 / 两套路由注册面的
 * 挂载图 / 声明抽取 / 匹配与聚合)不碰 git、不碰磁盘,全部能用构造输入证明;② 单文件行数不破守门 11e
 * 的 800 行上限;③ 镜像测试与守门打的是**同一份**实现(§22c 消"两份真相")。
 * 本层**不读任何被审内容** —— 取材在守门侧,一律走 `scripts/lib/face-reader.mjs`(门 118 专判半接线)。
 */



/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */

/** 覆盖面:两个服务端(跨语言互调)。前端→api 那一格由 check-api-routes 守,本门不重复。 */
export const SCAN_DIRS = ['apps/api/src', 'apps/ai-service/app']
export const FASTIFY_ENTRY = 'apps/api/src/server.ts'
export const FASTAPI_ENTRY = 'apps/ai-service/app/main.py'

export const TEST_FILE_RE = /(\.test\.|\.spec\.|conftest\.py$)/
export const TEST_DIR_RE = /(^|\/)(tests?|__tests__|e2e)\//

/**
 * 自家服务在仓内被寻址的方式。刻意**不**列公网域名:那会让"打自家生产域名"与"打第三方"无法区分,
 * 而后者误判成前者就是一片假红。只认回环与容器内部名 —— 依据是 config.py 的 `api_service_url`
 * 默认值、apps/api 的 `AI_SERVICE_URL` 默认值、hub 的降级档三处实测。
 */
export const SELF_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1', 'host.docker.internal']
export const VERBS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
export const INSTANCE = 'server|app|fastify|instance'
export const GENERIC_CLIENT_RE = new RegExp(
  `(?:\\bfetch\\s*\\(|\\baxios\\s*\\.\\s*(?:${VERBS.join('|')})\\s*\\(|\\b(?:httpx|aiohttp|requests)\\s*\\.\\s*(?:${VERBS.join('|')}|request)\\s*\\(|\\b(?:client|session|self)\\s*\\.\\s*(?:${VERBS.join('|')}|request)\\s*\\(|\\.request\\s*\\()`,
)
export const SELF_URL_RE = new RegExp(`^https?://(?:${SELF_HOSTS.map(escapeRe).join('|')})(?::\\d+)?(?:[/'"\`\\\\]|$)`)
export const ANY_URL_RE = /^https?:\/\//
export const API_PATH_RE = /^\/api\/[^\s'"`]*$/
export const EMPTY_SET = new Set()

export function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
export function countOf(s, re) {
  return (s.match(re) || []).length
}
export function normalizePosix(p) {
  const abs = String(p).startsWith('/')
  const out = []
  for (const seg of String(p).split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return (abs ? '/' : '') + out.join('/')
}
export function lineOf(src, idx) {
  let line = 1
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line += 1
  return line
}

/* --------------------------- 遮噪 --------------------------- */

/**
 * 两套语法各自成对:JS/TS 是 `//` + `/* *​/`,Python 是 `#` + 三引号 docstring。
 * 三引号块只在**行首缩进后直接以三引号开头**时按 docstring 遮(拼字符串用的三引号必须保留)。
 * 这一步决定"注释里写着 /api/x"不会被当成声明(D9 反例)。字符串本身要留 —— 路径就在字符串里。
 */
export function maskComments(src, lang) {
  const text = String(src)
  const out = []
  let i = 0
  const n = text.length
  while (i < n) {
    const two = text.slice(i, i + 2)
    if (lang === 'py') {
      if (text[i] === '#') {
        while (i < n && text[i] !== '\n') {
          out.push(' ')
          i += 1
        }
        continue
      }
      const q = text[i]
      if ((q === '"' || q === "'") && text.slice(i, i + 3) === q.repeat(3)) {
        const ls = text.lastIndexOf('\n', i) + 1
        const isDoc = /^[ \t]*$/.test(text.slice(ls, i))
        let j = i + 3
        while (j < n && text.slice(j, j + 3) !== q.repeat(3)) {
          if (text[j] === '\\') j += 1
          j += 1
        }
        j = Math.min(j + 3, n)
        const body = text.slice(i, j)
        out.push(isDoc ? body.replace(/[^\n]/g, ' ') : body)
        i = j
        continue
      }
    } else if (two === '//') {
      while (i < n && text[i] !== '\n') {
        out.push(' ')
        i += 1
      }
      continue
    } else if (two === '/*') {
      let j = i + 2
      while (j < n && text.slice(j, j + 2) !== '*/') j += 1
      j = Math.min(j + 2, n)
      out.push(text.slice(i, j).replace(/[^\n]/g, ' '))
      i = j
      continue
    }
    const q2 = text[i]
    if (q2 === "'" || q2 === '"' || q2 === '`') {
      let j = i + 1
      while (j < n) {
        if (text[j] === '\\') {
          j += 2
          continue
        }
        if (text[j] === q2) {
          j += 1
          break
        }
        j += 1
      }
      out.push(text.slice(i, j))
      i = j
      continue
    }
    out.push(text[i])
    i += 1
  }
  return out.join('')
}

/**
 * 扫一行的字符串字面量,返回其中"以 /api/ 开头"的路径(含**跨插值**的形态)。
 * Python 的 `f"{base}/api/x"` 是**一个**字面量,正则按引号对切会把它切成两截而漏掉路径,
 * 所以这里先取整串,再剥掉开头的 `{...}` / `${...}` 插值段,剩余部分才是路径。
 */
/**
 * 路径切成段并标出「动态段」:`/api/agents/${ID_A}/transition` 的第 3 段 dyn=true。
 * 注册面的 `:id` / `{id}` 同样算动态段(normSegs 归一成 `*`)。
 * 这个标记是本门的关键判据:**注册面的动态段只允许吃声明面的动态段** —— 否则
 * `GET /api/rules/:id` 的形状会把声明 `/api/rules/orchestrate` 洗成「已注册」,
 * 那条真缺陷就隐身了(实测 hub 6 条因此只报出 4 条,已由自检 R2 钉住)。
 */
export function pathSegs(p) {
  const clean = String(p)
    .split('?')[0]
    .replace(/\/+$/, '')
  const body = clean.startsWith('/') ? clean.slice(1) : clean
  if (body === '') return []
  return body.split('/').map((seg) => {
    const dyn = /\$\{|\{[^}]*\}|^:/.test(seg)
    return { s: dyn ? '*' : seg, dyn }
  })
}

export function scanApiLiterals(line) {
  const found = []
  const n = line.length
  let i = 0
  while (i < n) {
    const c = line[i]
    if (c !== "'" && c !== '"' && c !== '`') {
      i += 1
      continue
    }
    let j = i + 1
    while (j < n) {
      if (line[j] === '\\') {
        j += 2
        continue
      }
      if (line[j] === c) break
      j += 1
    }
    const body = line.slice(i + 1, j)
    const fpre = /[fF]/.test(line[i - 1] || '') || c === '`'
    let rest = body
    while (/^(?:\$\{[^}]*\}|\{[^}]*\})/.test(rest)) rest = rest.replace(/^(?:\$\{[^}]*\}|\{[^}]*\})/, '')
    const interpolated = rest !== body
    const cand = API_PATH_RE.test(rest) ? rest : API_PATH_RE.test(body) && !interpolated ? body : null
    if (cand) {
      found.push({
        path: cand,
        whole: body,
        segs: pathSegs(cand),
        interpolated,
        fPrefixed: fpre,
        at: i,
        before: line.slice(Math.max(0, i - 90), i),
      })
    }
    i = Math.min(j + 1, n)
  }
  return found
}

/* --------------------- self base / 出站包装推导 --------------------- */

/**
 * 文件内「初值是自家 URL」的名字:变量/字段赋值、环境变量默认值、return 这种字面量的函数;
 * 再一跳展开(`base = api_base_url()`、`base_url, src = _resolve()`)。与 external(第三方)同一次扫描分流。
 */
export function deriveBaseNames(src, lang) {
  const self = new Set()
  const external = new Set()
  const code = maskComments(src, lang)
  const put = (name, url) => {
    if (!name) return
    if (SELF_URL_RE.test(url)) self.add(name)
    else if (ANY_URL_RE.test(url)) external.add(name)
  }
  let m
  const assignRe =
    /\b([A-Za-z_][\w.]*)\s*(?::\s*[\w[\]|. ]+)?=\s*(?:os\.environ\.get\s*\(\s*["']([A-Za-z0-9_]+)["']\s*,\s*)?["'`](https?:\/\/[^"'`\n]*)["'`]/g
  while ((m = assignRe.exec(code)) !== null) {
    const [, name, envName, url] = m
    put(name && name.split('.').pop(), url)
    if (envName) put(envName, url)
  }
  const fieldRe = /\b([a-z_][\w]*)\s*:\s*[\w[\]|. ]+=\s*["'`](https?:\/\/[^"'`\n]*)["'`]/g
  while ((m = fieldRe.exec(code)) !== null) put(m[1], m[2])
  const fnRe = lang === 'py' ? /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/ : /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/
  let current = null
  for (const line of code.split('\n')) {
    const fm = fnRe.exec(line)
    if (fm) current = fm[1]
    if (!current) continue
    const u = /["'`](https?:\/\/[^"'`]*)["'`]/.exec(line)
    if (u && /(?:return|=>|:|,)\s*[^"']*["'`]/.test(line)) put(current, u[1])
  }
  const hopRe = /^\s*([A-Za-z_]\w*)(?:\s*,\s*[A-Za-z_]\w*)*\s*(?::[^=]+)?=\s*([^\n]+)$/gm
  const known = () => new Set([...self, ...external])
  for (let round = 0; round < 2; round++) {
    const all = known()
    const isSelf = (tok) => self.has(tok)
    hopRe.lastIndex = 0
    while ((m = hopRe.exec(code)) !== null) {
      const [, lhs, rhs] = m
      if (all.has(lhs)) continue
      for (const tok of all) {
        if (!new RegExp(`(?:\\b|[.])${escapeRe(tok)}\\b`).test(rhs)) continue
        if (isSelf(tok)) self.add(lhs)
        else external.add(lhs)
        break
      }
    }
  }
  return { self, external }
}

/** 同行是否出现某 self base 标识符(`settings.api_service_url` / `config.AI_SERVICE_URL` 这类带前缀写法同视) */
export function lineHasSelfBase(line, selfNames) {
  for (const tok of selfNames) if (new RegExp(`(?:\\b|[.])${escapeRe(tok)}\\b`).test(line)) return tok
  return null
}

export function sliceBalanced(src, openIdx) {
  if (openIdx < 0 || src[openIdx] !== '{') return ''
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) return src.slice(openIdx, i + 1)
    }
  }
  return src.slice(openIdx)
}

/** 按缩进取 Python 函数体 */
export function slicePyBlock(src, afterHeaderIdx) {
  const headerStart = src.lastIndexOf('\n', afterHeaderIdx) + 1
  const indent = (/^[\t ]*/.exec(src.slice(headerStart)) || [''])[0].length
  const body = []
  for (const line of src.slice(afterHeaderIdx).split('\n')) {
    if (!line.trim()) {
      body.push(line)
      continue
    }
    if ((/^[\t ]*/.exec(line) || [''])[0].length <= indent) break
    body.push(line)
  }
  return body.join('\n')
}

export function pathParamName(params) {
  const m = /\b(path|url_path|urlPath|endpoint)\b/.exec(String(params))
  return m ? m[1] : null
}

/** 单个候选包装的判据(纯函数,自检直接打) */
export function classifyWrapper(params, body, selfNames) {
  const pp = pathParamName(params)
  if (!pp) return false
  if (!new RegExp(`(?:\\$\\{\\s*${pp}\\s*\\}|\\{\\s*${pp}\\s*\\})`).test(body)) return false
  const selfBase = !!lineHasSelfBase(body, selfNames)
  const clientish = /fetch\s*\(|\.request\s*\(|axios\b|aiohttp|httpx|ClientSession/.test(body)
  return !!(selfBase || clientish)
}

/**
 * 出站包装函数名集合(由代码推导,不写死清单)。第 2 轮把"调用已知包装并透传 path 形参"的函数也算进来
 * (`callAiHooks` 那一型:它自己不发请求,只是转发)。
 */
export function deriveEgressWrappers(files, selfNamesByFile) {
  const wrappers = new Set()
  const bodies = []
  for (const [rel, srcRaw] of files) {
    const lang = rel.endsWith('.py') ? 'py' : 'ts'
    const src = maskComments(srcRaw, lang)
    const selfNames = selfNamesByFile.get(rel) || EMPTY_SET
    if (lang === 'ts') {
      const re = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)[^{]*/g
      let m
      while ((m = re.exec(src)) !== null) {
        const body = sliceBalanced(src, src.indexOf('{', m.index + m[0].length - 1))
        bodies.push({ name: m[1], params: m[2], body })
        if (classifyWrapper(m[2], body, selfNames)) wrappers.add(m[1])
      }
    } else {
      const re = /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([\s\S]*?)\)\s*(?:->[^:]*)?:(?!)/gm
      let m
      while ((m = re.exec(src)) !== null) {
        const body = slicePyBlock(src, m.index + m[0].length)
        bodies.push({ name: m[1], params: m[2], body })
        if (classifyWrapper(m[2], body, selfNames)) wrappers.add(m[1])
      }
    }
  }
  for (let round = 0; round < 2; round++) {
    let grew = false
    for (const { name, params, body } of bodies) {
      if (wrappers.has(name)) continue
      const pp = pathParamName(params)
      if (!pp) continue
      for (const w of wrappers) {
        if (new RegExp(`\\b${escapeRe(w)}\\s*[<(][^\\n]*\\b${escapeRe(pp)}\\b`).test(body)) {
          wrappers.add(name)
          grew = true
          break
        }
      }
    }
    if (!grew) break
  }
  return wrappers
}

/* ----------------------------- 归一与匹配 ----------------------------- */

/**
 * `/api/hooks/${id}` → `api/hooks/*`;剥查询串与尾斜杠。`:id` / `{id}` / `${x}` / 段内混合一律归 `*` ——
 * 刻意偏宽:误伤比漏报贵(恒红门的结局是没人再守门,§12e)。
 */
export function normSegs(p) {
  const clean = String(p).split('?')[0].replace(/\/+$/, '')
  const body = clean.startsWith('/') ? clean.slice(1) : clean
  if (body === '') return []
  return body.split('/').map((seg) => (/\$\{|\{[^}]*\}|^:|^\*$/.test(seg) ? '*' : seg))
}

export function joinPrefix(prefix, path) {
  const p = String(prefix || '').replace(/\/+$/, '')
  const s = String(path || '')
  if (!p) return s.startsWith('/') ? s : `/${s}`
  if (!s || s === '/') return p
  return s.startsWith('/') ? `${p}${s}` : `${p}/${s}`
}

export function segmentsMatch(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '*' || b[i] === '*') continue
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * 声明 ↔ 注册匹配。两条刻意的窄口径:
 *  - 注册的 `*` **只**吃声明里本身就是动态的段(`segsMatchStrict`),免得参数化路由的形状把
 *    "写死的静态路径"洗成已注册(实测:`/api/rules/orchestrate` 会被 `GET /api/rules/:id` 吞掉);
 *  - 未匹配且**末段是插值**(如 `/api/x{path}`、`/api/x${qs}`)⇒ 结构上判不了 ⇒ 未判定,不判红。
 * `opaque` 命中 ⇒ 未判定(不判红也不判绿)。
 */
export function matchDeclared(decl, reg) {
  const segs = decl.segs || pathSegs(decl.path)
  if (!segs.length) return { hit: false, via: 'none' }
  const flat = segs.map((x) => x.s)
  const key = flat.join('/')
  if (reg.paths.has(key)) return { hit: true, via: 'exact' }
  for (const rp of reg.paths) {
    const rsegs = rp.split('/')
    if (rsegs.includes('*') && segsMatchStrict(segs, rsegs)) return { hit: true, via: 'dynamic' }
  }
  for (const op of reg.opaque) {
    const opSegs = normSegs(op)
    if (opSegs.length && opSegs.every((s, i) => s === '*' || s === flat[i] || flat[i] === '*'))
      return { hit: false, via: 'opaque', evidence: op }
  }
  if (segs[segs.length - 1].dyn) return { hit: false, via: 'tail-dynamic' }
  return { hit: false, via: 'none' }
}

/** 严格版段比较:注册侧的 '*' 要求声明侧同段也是动态段 */
export function segsMatchStrict(declSegs, regSegs) {
  if (declSegs.length !== regSegs.length) return false
  for (let i = 0; i < declSegs.length; i++) {
    const d = declSegs[i]
    const r = regSegs[i]
    if (r === '*') {
      if (!d.dyn) return false
      continue
    }
    if (d.s === '*') continue
    if (d.s !== r) return false
  }
  return true
}

/* ------------------------------- 声明面 ------------------------------- */

export const TABLE_NAME_RE = /(_?[A-Z][A-Z0-9_]*(?:PATHS|ENDPOINTS|URLS|ROUTES)|\b[A-Za-z][\w]*(?:Paths|Endpoints|Urls|Routes))\b/
export const REG_LINE_RE = new RegExp(
  `(?:^\\s*@|\\.include_router\\s*\\(|\\.mount\\s*\\(|\\b(?:${INSTANCE})\\.(?:${VERBS.join('|')}|route|all|register)\\s*[<(]|\\bprefix\\s*[:=])`,
)

/** 注册面行不算声明面(否则对侧/本侧的注册语句会被读成"自己打自己") */
export function isRegistrationLine(line) {
  return REG_LINE_RE.test(line)
}

/** 路径表:表名 → 覆盖的行下标(浅解析:声明行到括号配平归零) */
export function collectPathTables(lines) {
  const tables = new Map()
  let current = null
  let depth = 0
  lines.forEach((line, idx) => {
    if (current !== null) {
      depth += countOf(line, /[{[(]/g) - countOf(line, /[}\])]/g)
      if (depth <= 0) current = null
      else tables.get(current).push(idx)
      return
    }
    const m = TABLE_NAME_RE.exec(line)
    if (!m) return
    if (!/[{([]/.test(line.slice(m.index + m[0].length))) return
    current = m[1]
    if (!tables.has(current)) tables.set(current, [])
    depth = countOf(line, /[{[(]/g) - countOf(line, /[}\])]/g)
    tables.get(current).push(idx)
  })
  return tables
}

/** 表是否真被用来拼出站 URL:表名或一跳别名出现在 selfbase 行 / 出站调用行 / `url = f"…{别名}…"` 行 */
export function isTableUsedForEgress(lines, tName, selfNames, wrappers) {
  const aliases = new Set([tName])
  const aliasRe = new RegExp(`\\b([A-Za-z_]\\w*)\\s*(?::[^=]+)?=\\s*${escapeRe(tName)}\\s*(?:\\.get\\s*\\(|\\[|$)`)
  for (const line of lines) {
    const m = aliasRe.exec(line)
    if (m) aliases.add(m[1])
  }
  const joined = [...aliases].map(escapeRe).join('|')
  const useRe = new RegExp(`\\b(?:${joined})\\b`)
  const interpRe = new RegExp(`(?:\\$\\{[^}]*|\\{[^}]*)\\b(?:${joined})\\b`)
  for (const line of lines) {
    if (!useRe.test(line)) continue
    if (lineHasSelfBase(line, selfNames)) return true
    if (hasWrapperCall(line, wrappers) || GENERIC_CLIENT_RE.test(line)) return true
    if (interpRe.test(line) && /\b(?:url|URL|base|endpoint)\b/.test(line)) return true
  }
  return false
}

export function hasWrapperCall(line, wrappers) {
  for (const w of wrappers) if (new RegExp(`\\b${escapeRe(w)}\\s*[<(]`).test(line)) return true
  return false
}

/**
 * 声明抽取(纯函数)。返回 {decls, exempted, ignoredNonEgress, externalBase, skippedRegistration, wrappers}。
 * 三种证据都没有的字面量只计数不判 —— 报告里必须看得见那一步(绝不静默算通过)。
 */
export function extractDeclarations(files, opts = {}) {
  const selfNamesByFile = new Map()
  const externalNamesByFile = new Map()
  for (const [rel, src] of files) {
    const lang = rel.endsWith('.py') ? 'py' : 'ts'
    const names = deriveBaseNames(src, lang)
    selfNamesByFile.set(rel, names.self)
    externalNamesByFile.set(rel, names.external)
  }
  const wrappers = opts.wrappers || deriveEgressWrappers(files, selfNamesByFile)
  const decls = []
  const exempted = []
  let ignoredNonEgress = 0
  let externalBase = 0
  let skippedRegistration = 0
  for (const [rel, srcRaw] of files) {
    const lang = rel.endsWith('.py') ? 'py' : 'ts'
    const src = maskComments(srcRaw, lang)
    const selfNames = selfNamesByFile.get(rel) || EMPTY_SET
    const externalNames = externalNamesByFile.get(rel) || EMPTY_SET
    if (TEST_FILE_RE.test(rel) || TEST_DIR_RE.test(rel)) continue
    const lines = src.split('\n')
    /**
     * 豁免标记**必须从原文取**:声明面走 maskComments 是对的(注释里的路径字面量不算出站点),
     * 但 `route-declare-exempt: <原因>` 按本仓惯例就写在注释里(同行尾或上一行)——
     * 若也去掩码后的面上找,这个豁免出口结构上永远命中不了,等于门只留了一条"禁止豁免"的死路
     * (实测:第三方 Prometheus 查询行带因豁免后,`豁免命中 0` 且仍计未匹配)。
     */
    const rawLines = srcRaw.split('\n')
    const tables = collectPathTables(lines)
    const tableLines = new Map()
    for (const [name, rows] of tables) {
      if (isTableUsedForEgress(lines, name, selfNames, wrappers)) for (const r of rows) tableLines.set(r, name)
    }
    lines.forEach((line, idx) => {
      const lits = scanApiLiterals(line)
      if (!lits.length) return
      if (isRegistrationLine(line)) {
        skippedRegistration += lits.length
        return
      }
      const selfTok = lineHasSelfBase(line, selfNames)
      const egressCall = GENERIC_CLIENT_RE.test(line) || hasWrapperCall(line, wrappers)
      const tableName = tableLines.get(idx)
      lits.forEach((lit) => {
        if (!API_PATH_RE.test(lit.path)) return
        let evidence = null
        if (selfTok && (lit.interpolated || lit.before.includes(selfTok))) evidence = 'selfbase-line'
        else if (egressCall) evidence = 'egress-call'
        else if (tableName) evidence = 'path-table'
        if (!evidence) {
          if (hasExternalInterp(lit.whole, externalNames)) {
            externalBase += 1
            return
          }
          ignoredNonEgress += 1
          return
        }
        decls.push({ path: lit.path, file: rel, line: idx + 1, evidence, segs: lit.segs })
      })
      const mark =
        /route-declare-exempt:\s*(\S[^\r]*)/.exec(rawLines[idx] ?? '') ||
        /route-declare-exempt:\s*(\S[^\r]*)/.exec(rawLines[idx - 1] ?? '')
      // 只救"这一行确有出站点声明"的情形:豁免标记单独占一行不得凭空造免(否则一行标记
      // 可以往上下各救一片,与本仓 radius-exempt / back-label-exempt 同一条宽严口径)
      if (mark && lits.length)
        exempted.push({ file: rel, line: idx + 1, reason: mark[1].trim(), literals: lits.length })
    })
  }
  return { decls, exempted, ignoredNonEgress, externalBase, skippedRegistration, wrappers }
}

/** 插值段里出现"初值是第三方 URL"的名字 ⇒ 这是打外部厂商,不是本仓出站点 */
export function hasExternalInterp(whole, externalNames) {
  const interp = whole.match(/\$\{[^}]*\}|\{[^}]*\}/g) || []
  if (!interp.length) return false
  for (const seg of interp) {
    const inner = seg.replace(/[${}]/g, '')
    for (const tok of String(inner).match(/[A-Za-z_][\w.]*/g) || []) {
      if (externalNames.has(tok) || externalNames.has(tok.split('.').pop())) return true
    }
  }
  return false
}

/* ------------------------------- 聚合 ------------------------------- */

/**
 * 四桶互不串门:未匹配 / 命中 / 未判定(不透明前缀覆盖)/ 豁免命中。
 * `strict` **只**影响退出码,不影响判据覆盖面 —— 否则"默认档好看"就是少扫了一遍。
 */
export function decide({ decls, reg, exempted, strict }) {
  const unmatched = []
  const covered = []
  const opaqueCovered = []
  const exemptHit = []
  const exemptLines = new Set((exempted || []).map((e) => `${e.file}:${e.line}`))
  for (const d of decls) {
    if (exemptLines.has(`${d.file}:${d.line}`)) {
      exemptHit.push(d)
      continue
    }
    const res = matchDeclared(d, reg)
    if (res.hit) covered.push({ ...d, via: res.via })
    else if (res.via === 'opaque') opaqueCovered.push({ ...d, opaque: res.evidence, why: '注册面在该前缀下不透明' })
    else if (res.via === 'tail-dynamic')
      opaqueCovered.push({ ...d, opaque: '(末段是插值)', why: '路径尾部由变量拼出,结构上判不了' })
    else unmatched.push(d)
  }
  return {
    exit: strict && unmatched.length ? 1 : 0,
    unmatched,
    covered,
    opaqueCovered,
    exemptHit,
    counts: {
      declared: decls.length,
      registered: reg.paths.size,
      unmatched: unmatched.length,
      undetermined: opaqueCovered.length,
      covered: covered.length,
      exempt: exemptHit.length,
    },
  }
}


// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
