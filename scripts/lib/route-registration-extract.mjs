// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * route-registration-extract.mjs — 守门 8 的**后端注册面**唯一提取式(Fastify 挂载图 + FastAPI)。
 *
 * 为什么存在(立门因由,不是假想):旧 `check-api-routes.mjs` 的 `buildCompositePrefixes` 把
 * 「任一 localPath × 任一绝对前缀」笛卡尔拼接(实测 5,146 条路由 × 165 个组合前缀 ⇒ 约 77.7 万条集合),
 * 于是 `apps/api/src/routes/ranking.ts` 挂在 `/api/ranking` 下的 `server.get('/courses')` 凭空
 * 组合出一条结构上不存在的 `GET /api/courses`。前端真打 `/api/courses` 是 404,门却报「新增 0 处死调用」。
 * 本层改判**真实挂载图**:前缀沿 `server.register(fn, { prefix })` 的边逐层累加,只在图里走得到的
 * (文件, 插件函数, 前缀) 节点上产出路径。
 *
 * 但**只换判据不换提取式会造出全仓最大的恒红门**:挂载图初版(照搬守门 127 的
 * `buildFastifyRegistrations`)让 2,675 处前端调用里 2,092 处"消失",因为它只认
 * `server.get('/x')` 与 `.route({url})` 两形态,读不到本仓大量存在的 **helper 工厂注册**
 * (`apps/api/src/routes/admin/_shared.ts` 的 `registerCrud(server, '/courses', lessons, {...})`,
 * 工厂内部再 `server.get(basePath)` / `` server.get(`${basePath}/:id`) ``)。所以本层把提取式补到与判据同宽:
 *   ① 跨行 / 带泛型的动词调用(`server.get(\n  '/x',`)、`.route({ method:[…], url })`;
 *   ② **工厂注册按实参解析路径**,方法集与路径模板从**工厂实现体**推导(不硬编码 get/post/put/delete 名单);
 *   ③ 模板串注册:厂商能力矩阵 for-of 展开、同文件字符串常量、工厂形参代入;
 *   ④ 内联 `server.register(async (child) => { … })` 的别名实例(带/不带 prefix 都按外层作用域算);
 *   ⑤ 同文件多插件函数(`promotions.ts` 同时导出 `promotionRoutes` 与 `adminPromotionRoutes`)
 *      按**各自挂载前缀**归因,不把整文件并集挂到其中一个前缀上。
 *
 * 三态口径与守门 127 对齐(命中 / 未匹配 / **不透明前缀下的未判定**):
 *   - 解析不出的路径模板、解不到的挂载目标、`app.mount` 子应用 ⇒ 一律落 `undetermined` / `opaque`
 *     并**逐条报名**(本仓规矩:报数不报名等于把这一格永久锁死);
 *   - **既不冒红也不记绿** —— 判据看不见不是"没有",也不是"有"。
 *
 * 纯函数层:不读磁盘、不碰 git、不判红 —— 取材在守门侧(`face-reader`),判红也在守门侧。
 * 注释遮噪只有一份实现(`outbound-route-facts.maskComments`,TS/Python 同一份):
 * 注释里写的 `registerCrud(server, '/products', …)` 不得被当成注册(自检有反向锁)。
 */

import { dirname } from 'node:path'
import { joinPrefix, maskComments, normalizePosix } from './outbound-route-facts.mjs'

/** Fastify/FastAPI 动词面;刻意不含 head/options —— 实测 HEAD 面 0 处 `.head(`/`.options(` 注册 */
export const VERBS = ['get', 'post', 'put', 'patch', 'delete']

export const DEFAULT_ENTRY_TS = 'apps/api/src/server.ts'
export const DEFAULT_ENTRY_PY = 'apps/ai-service/app/main.py'
export const MODULE_FN = '(module)'

const IDENT = '[A-Za-z0-9_$]+'
/** 每次新建实例 —— 共享 lastIndex 的正则常量是"第二次调用静默漏扫"的经典成因 */
const g = (source) => new RegExp(source, 'g')

// 动词注册必须认带 TS 泛型的形态(`server.patch<{ Params: { id: string } }>('/x', h)`)——
// 本仓 routes/plugins.ts 的 PATCH /:id/preferences、POST /:id/click 全是这一型;
// 旧式只认 `verb(` 紧邻,泛型档整族漏读 ⇒ 前端真打的在册路由被判死(2026-10-22 O87g 假红实证)。
// `[^()]*` 不吃括号:泛型里带函数类型(`<q: () => void}>`)仍解不出,与旧行为一致(漏读不冒判)。
const VERB_CALL_SRC = `\\b(${IDENT})\\.(${VERBS.join('|')})\\s*(?:<[^()]*>)?\\s*\\(`
const ROUTE_OBJ_SRC = `\\b(${IDENT})\\.route\\s*\\(\\s*\\{`
const REGISTER_SRC = `\\b(${IDENT})\\.register\\s*\\(`
const FN_DECL_SRC =
  `(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s+(${IDENT})?\\s*\\(([^)]*)\\)` +
  `|(?:export\\s+)?(?:const|let|var)\\s+(${IDENT})\\s*(?::[^=]+)?=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*(?::[^={]+)?=>` +
  `|(?:export\\s+)?(?:const|let|var)\\s+(${IDENT})\\s*(?::[^=]+)?=\\s*(?:async\\s*)?function\\s*${IDENT}?\\s*\\(([^)]*)\\)`
const IMPORT_SRC = /\bimport\s+((?:(?!\bfrom\b)[\s\S])*?)\s+from\s*['"](\.[^'"]*)['"]/.source
const PATH_CONST_SRC = /const\s+([A-Za-z0-9_$]+)\s*=\s*'([^']*)'/.source
const MATRIX_DECL_SRC = /const\s+([A-Za-z0-9_$]+)\s*=\s*\[/.source
const MATRIX_LOOP_SRC =
  /for\s*\(\s*(?:const|let|var)\s+([A-Za-z0-9_$]+)\s+of\s+(?:[A-Za-z0-9_$]+\.)?([A-Za-z0-9_$]+)\s*\)\s*\{/.source
const DIRECT_CALL_SRC = `(?:^|[{};\\n])\\s*(?:await\\s+)?([A-Za-z_$][\\w$]*)\\s*\\(\\s*(${IDENT})\\s*[,)]`

const NON_CALLEE_KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'function',
  'typeof',
  'await',
  'yield',
  'new',
  'do',
  'else',
])

/**
 * 「哪些标识符在本文件里是 Fastify 实例」的判据。**必须**有这一层,否则 `db.delete(table)` /
 * `cache.get('/api/x')` / `map.set(id, …)` 这类同动词不同义的对象方法会被当成注册,
 * 实测未过滤时 1,093 条噪声把真未判定淹掉(报数不报名是把这一格锁死,报名报满噪声同理)。
 * 三条来源:① 函数首形参(插件/工厂的实例入参);② 内联箭头别名(在 register 扫描里补);
 * ③ 被当作实例用过(`X.register(` / `X.addHook(` / `X.decorate(` / `X.listen(`)
 *    或 `const X = Fastify(` —— 覆盖 server.ts 里 `const server = Fastify({...})` 这一型。
 */
const INSTANCE_USE_SRC = `\\b(${IDENT})\\.(?:register|addHook|decorateReply|decorate|listen|ready|after|setNotFoundHandler|setErrorHandler)\\s*\\(`
const FASTIFY_FACTORY_SRC =
  `(?:const|let|var)\\s+(${IDENT})\\s*(?::[^=]+)?=\\s*(?:await\\s+)?(?:Fastify|fastify)\\s*\\(`


/* ─────────────────────────── 词法小工具 ─────────────────────────── */

/**
 * 跳过引号/模板串字面量,返回结尾引号下标。
 * 反引号必须认 `${…}` 插值段(2026-10-22 G-962 实证:workspace-ai.ts:445 的
 * `` `git ${…`"…"…}` `` 在插值里套了内层反引号,旧式把内层反引号当闭合 ⇒
 * 模板提前结束 ⇒ 花括号失衡 ⇒ findTopLevelFunctions bodyEnd=-1 ⇒ 整文件 0 条入图,
 * 25 条前端真调用落未判定桶)。插值内的引号/嵌套模板/花括号全部跟踪。
 */
export function skipQuoted(text, i) {
  const q = text[i]
  for (let j = i + 1; j < text.length; j++) {
    const c = text[j]
    if (c === '\\') {
      j++
      continue
    }
    if (q === '`' && c === '$' && text[j + 1] === '{') {
      j = skipTemplateSubstitution(text, j + 1)
      continue
    }
    if (c === q) return j
  }
  return text.length - 1
}

/**
 * 从 `${` 的 `{` 下标找到配对 `}`。插值内是**代码态**:引号/嵌套模板(递归回 skipQuoted)/
 * 注释/花括号全部跟踪;正则字面量必须认(workspace-ai.ts:445 的 `/"/g` 带裸引号,
 * 不认正则 ⇒ 引号态错位 ⇒ 配平被带偏)。判据与 maskRegexLiterals 同一套上下文集。
 * 未配平返回末位(漏判退回旧行为,不冒判)。
 */
function skipTemplateSubstitution(text, i) {
  let depth = 0
  let prevSig = '{'
  let prevWord = ''
  for (let j = i; j < text.length; j++) {
    const c = text[j]
    if (c === '\\') {
      j++
      prevSig = '@'
      prevWord = ''
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      j = skipQuoted(text, j)
      prevSig = c
      prevWord = ''
      continue
    }
    if (c === '/' && (text[j + 1] === '/' || text[j + 1] === '*')) {
      j = skipComment(text, j)
      continue
    }
    if (c === '/' && (REGEX_KEYWORDS.has(prevWord) || REGEX_ALLOWED_AFTER.has(prevSig))) {
      const end = regexLiteralEnd(text, j)
      if (end !== -1) {
        j = end
        prevSig = '/'
        prevWord = ''
        continue
      }
    }
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v') continue
    if (/[A-Za-z0-9_$]/.test(c)) {
      prevWord += c
      prevSig = '@'
      continue
    }
    prevWord = ''
    prevSig = c
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return j
    }
  }
  return text.length - 1
}

/** `/` 处若是正则字面量,返回结尾 `/` 下标(字符类/转义跟踪,裸换行=未闭合 ⇒ -1 按除法) */
function regexLiteralEnd(s, i) {
  let j = i + 1
  let inClass = false
  for (; j < s.length; j++) {
    const c = s[j]
    if (c === '\n') return -1
    if (c === '\\') {
      j++
      continue
    }
    if (c === '[') inClass = true
    else if (c === ']') inClass = false
    else if (c === '/' && !inClass) return j
  }
  return -1
}

/** 跳过注释,返回结束下标 */
export function skipComment(text, i) {
  if (text[i + 1] === '/') {
    const nl = text.indexOf('\n', i)
    return nl === -1 ? text.length : nl
  }
  const end = text.indexOf('*/', i + 2)
  return end === -1 ? text.length : end + 1
}

/**
 * 把正则字面量的**内容**打码成空格(保留定界符/长度/行号)。必须跑在 maskComments **之前**:
 * maskComments 只认引号与注释、不认正则 —— 正则里的引号会被它当字符串开头(实测 agents.ts
 * 导出 CSV 的 `/[",\n]/`),引号态错位级联扩散 ⇒ 几十行后模板串里的 `https://` 被当行注释遮掉
 * ⇒ 模板闭引号丢失 ⇒ 花括号配平崩 ⇒ 插件函数 bodyEnd=-1 被 findTopLevelFunctions 静默丢弃 ⇒
 * 该文件全部注册落 `(module)` 兜底档、不带挂载前缀(2026-10-22 O87g 实证:agentsRoutes 整族
 * 丢图,`GET /api/categories/list` 在册路由被判死)。本函数自带注释/字符串跳段,可安全跑在原文上。
 * 判别启发(漏判只是退回旧行为,冒判才会咬人,故只在「前一个有效 token 是
 * 运算符/分隔符/关键字」时认定为正则;标识符/数字/`)`/`]`/引号之后的 `/` 是除法,不碰):
 * 正则内遇 `\` 跳一字符、`[`/`]` 跟踪字符类、裸换行即中止(正则不跨行,中止 ⇒ 按除法处理)。
 */
const REGEX_ALLOWED_AFTER = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '+',
  '-',
  '*',
  '%',
  '~',
  '^',
  '<',
  '>',
])
const REGEX_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'do',
  'else',
  'case',
  'yield',
  'await',
])

export function maskRegexLiterals(text) {
  const s = String(text || '')
  if (!s.includes('/')) return s
  const out = s.split('')
  let prevSig = ''
  let prevWord = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuoted(s, i)
      prevSig = ch
      prevWord = ''
      continue
    }
    if (ch === '/' && (s[i + 1] === '/' || s[i + 1] === '*')) {
      i = skipComment(s, i)
      continue
    }
    if (ch === '/') {
      if (REGEX_KEYWORDS.has(prevWord) || REGEX_ALLOWED_AFTER.has(prevSig)) {
        const closed = regexLiteralEnd(s, i)
        if (closed !== -1) {
          for (let k = i + 1; k < closed; k++) out[k] = ' '
          i = closed
          while (i + 1 < s.length && /[gimsuyd]/.test(s[i + 1])) i++
          prevSig = '/'
          prevWord = ''
          continue
        }
      }
      prevSig = '/'
      prevWord = ''
      continue
    }
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v') continue
    if (/[A-Za-z0-9_$]/.test(ch)) {
      // 标识符/数字结尾 ⇒ 后面的 `/` 是除法,不得继承标识符**之前**的运算符上下文
      prevWord += ch
      prevSig = '@'
      continue
    }
    prevWord = ''
    prevSig = ch
  }
  return out.join('')
}

/** 从开括号找到配对闭括号(跳过字符串与注释);-1 = 未配平 */
export function findMatchingBracket(text, openIdx, openChar, closeChar) {
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i]
    if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipComment(text, i)
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuoted(text, i)
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

/** 从 `(` 下标起配平,返回括号**内**文本 */
export function readParenArgs(text, openIdx) {
  const close = findMatchingBracket(text, openIdx, '(', ')')
  return close === -1 ? text.slice(openIdx + 1) : text.slice(openIdx + 1, close)
}

/** 按顶层逗号切分实参(跳过嵌套括号与字符串) */
export function splitTopLevelArgs(argsText) {
  const out = []
  let cur = ''
  let depth = 0
  const s = String(argsText || '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '/' && (s[i + 1] === '/' || s[i + 1] === '*')) {
      const end = skipComment(s, i)
      cur += s.slice(i, end)
      i = end
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const end = skipQuoted(s, i)
      cur += s.slice(i, Math.min(end + 1, s.length))
      i = end
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim() !== '' || out.length > 0) out.push(cur)
  return out.map((x) => x.trim())
}

/**
 * 把一个实参文本解成路径。kind:
 *  literal = 引号里的定值路径;template = 反引号且含 `${…}`;
 *  bare = 标识符(只有工厂形参代入才解得出);opaque = 解不出的其它形态。
 */
export function parsePathArg(argText) {
  const s = String(argText || '').trim()
  if (!s) return { kind: 'opaque', value: '', expr: s }
  const q = s[0]
  if (q === "'" || q === '"') {
    const body = s.slice(1, skipQuoted(s, 0))
    if (/\$\{/.test(body)) return { kind: 'opaque', value: body, expr: s }
    return { kind: 'literal', value: body, expr: s }
  }
  if (q === '`') {
    const body = s.slice(1, skipQuoted(s, 0))
    if (/\$\{/.test(body)) return { kind: 'template', value: body, expr: s }
    return { kind: 'literal', value: body, expr: s }
  }
  return { kind: 'bare', value: '', expr: s }
}

/** 归一拼接后的完整路径:压掉重复斜杠、去掉尾斜杠(保留 `:param` / `*` 原形) */
export function cleanPath(p) {
  const s = String(p || '')
  if (!s) return ''
  const body = s.replace(/\/{2,}/g, '/').replace(/\/+$/, '')
  return (s.startsWith('/') ? '/' : '') + body.replace(/^\//, '')
}

/** localPath 是否已自带完整 `/api/…` 绝对面(此时不再叠加节点前缀) */
export function isAbsoluteApiPath(p) {
  return p === '/api' || p.startsWith('/api/')
}

/**
 * 路由覆盖分类(守门 8「静态字面注册优先」判据,唯一实现;匹配语义与原 `matchSegs` 逐条同构)。
 *
 * 立因(2026-10-23):原 `matchSegs` 对 `:param` 段两侧都 `continue`,「段数相等」于是成了唯一约束 ——
 * `GET /api/asks/my` 被 `GET /api/asks/:id` 吞下、记成「已在册」,而后者是**参数路由**,
 * 并不证明前者那条具体静态路径存在(实证:`packages/api-client/src/endpoints/community.ts`
 * 的 `/asks/my`、`/asks/my/answers`;后端 `apps/api/src/routes/community/asks.ts` 只有
 * `/asks/:id`、`/asks/:id/answers`,静态的只有 `/asks/my/count`、`/asks/my/answers/count`)。
 * 本函数把「命中」拆成两档:
 *   · `literal` —— 逐段字面相等,或后端参数段只对上前端动态段 ⇒ 真在册;
 *   · `param`   —— 段数相等且能匹配,但至少一处**前端具体字面段**被后端 `:param` 吞掉
 *                  (或前端动态段对后端字面段) ⇒ 只是"可能被参数路由接住",**不得记成在册**。
 * 返回 null = 不匹配。等价性:`classifyRouteCoverage(...) !== null` ⇔ 原 `matchSegs` 为真
 * (逐分支同构,改判只多给了一个"命中是哪一档"的答案,没有改变哪些对算命中)。
 * `*` catch-all 不归本函数管(守门侧 `matchStar` 单独判),本函数只判等段路径。
 */
export function classifyRouteCoverage(fParts, bParts) {
  if (fParts.length !== bParts.length) return null
  let paramCovered = false
  for (let i = 0; i < fParts.length; i++) {
    if (bParts[i].startsWith(':')) {
      if (fParts[i].startsWith(':')) continue // 前端动态段 ↔ 后端参数段:同一路由形状
      paramCovered = true // 前端具体字面段被后端参数段吞掉
      continue
    }
    if (fParts[i].startsWith(':')) {
      paramCovered = true // 前端动态段 ↔ 后端字面段:前端不可静态判定
      continue
    }
    if (fParts[i] !== bParts[i]) return null
  }
  return paramCovered ? 'param' : 'literal'
}

export function lineOfIdx(src, idx) {
  let line = 1
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line += 1
  return line
}

/* ─────────────────────── 模板串展开(矩阵 / 常量 / 形参) ─────────────────────── */

/** 收集同文件对象数组常量(厂商能力矩阵) */
export function extractMatrixArrays(text) {
  const matrices = new Map()
  const re = g(MATRIX_DECL_SRC)
  let m
  while ((m = re.exec(text)) !== null) {
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

/** 收集同文件 `const NAME = '/xxx'` 形态的路径前缀常量 */
export function extractPathConsts(text) {
  const consts = new Map()
  const re = g(PATH_CONST_SRC)
  let m
  while ((m = re.exec(text)) !== null) if (m[2].startsWith('/')) consts.set(m[1], m[2])
  return consts
}

/** 找出迭代同文件矩阵的 for-of 循环体区间 + `const VAR = ITEM.列名` 绑定 */
export function findMatrixLoops(text, matrices) {
  const loops = []
  const re = g(MATRIX_LOOP_SRC)
  let m
  while ((m = re.exec(text)) !== null) {
    const rows = matrices.get(m[2])
    if (!rows) continue
    const bodyStart = m.index + m[0].length - 1
    const bodyEnd = findMatchingBracket(text, bodyStart, '{', '}')
    if (bodyEnd === -1) continue
    const bindRe = new RegExp(`const\\s+([A-Za-z0-9_$]+)\\s*=\\s*${m[1]}\\.([A-Za-z0-9_$]+)\\b`, 'g')
    const bindings = new Map()
    let b
    while ((b = bindRe.exec(text.slice(bodyStart, bodyEnd))) !== null) bindings.set(b[1], b[2])
    loops.push({ itemVar: m[1], rows, bindings, bodyStart, bodyEnd })
    re.lastIndex = bodyEnd
  }
  return loops
}

/** 扫 [from, at) 得到 at 处所有未闭合 `{` 的行首文本(外层 → 内层) */
export function openBracePrefixes(text, from, at) {
  const stack = []
  for (let i = from; i < at; i++) {
    const ch = text[i]
    if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipComment(text, i)
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuoted(text, i)
      continue
    }
    if (ch === '{') stack.push(text.slice(text.lastIndexOf('\n', i) + 1, i).trim())
    else if (ch === '}') stack.pop()
  }
  return stack
}

export const GATE_UNKNOWN = '<unresolved-gate>'

/**
 * 注册点的条件包裹判定(与能力矩阵求交)。
 * @returns {string[]|string} 门控列名数组(空 = 无 if 包裹)/ GATE_UNKNOWN = 不可判定
 */
export function resolveGateKeys(text, loop, at) {
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
 * 展开一个模板路径。
 * @param {string} tpl 反引号里的原始模板(`/x/${vendor}/y`)
 * @param {object} ctx {src, idx, pathConsts, loops, factoryBinding?}
 *   factoryBinding = {paramName, value} —— 工厂形参到实参路径的代入
 * @returns {{ok:boolean, values:string[], reason:string}}
 */
export function expandTemplatePath(tpl, ctx) {
  const vars = [...new Set([...String(tpl).matchAll(/\$\{([A-Za-z0-9_$]+)\}/g)].map((v) => v[1]))]
  if (vars.length === 0) return { ok: false, values: [], reason: '模板含表达式插值,静态不可解' }
  const binding = ctx.factoryBinding
  if (binding && vars.every((v) => v === binding.paramName))
    return {
      ok: true,
      values: [tpl.replace(/\$\{([A-Za-z0-9_$]+)\}/g, () => binding.value)],
      reason: '',
    }
  const loop = (ctx.loops || []).find((l) => ctx.idx > l.bodyStart && ctx.idx < l.bodyEnd)
  if (loop) {
    if (!vars.every((v) => loop.bindings.has(v)))
      return { ok: false, values: [], reason: '模板插值不全是矩阵列绑定' }
    const gates = resolveGateKeys(ctx.src, loop, ctx.idx)
    if (gates === GATE_UNKNOWN)
      return { ok: false, values: [], reason: '条件包裹不可判定(else/switch/非矩阵成员条件)' }
    const values = []
    for (const row of loop.rows) {
      if (gates.some((g) => row[g] !== true)) continue
      let ok = true
      const v = tpl.replace(/\$\{([A-Za-z0-9_$]+)\}/g, (_s, name) => {
        const col = row[loop.bindings.get(name)]
        if (typeof col !== 'string' || col === '') {
          ok = false
          return ''
        }
        return col
      })
      if (ok) values.push(v)
    }
    return values.length
      ? { ok: true, values, reason: '' }
      : { ok: false, values: [], reason: '矩阵求交后为空' }
  }
  if (vars.every((v) => (ctx.pathConsts || new Map()).has(v)))
    return {
      ok: true,
      values: [tpl.replace(/\$\{([A-Za-z0-9_$]+)\}/g, (_s, v) => ctx.pathConsts.get(v))],
      reason: '',
    }
  return { ok: false, values: [], reason: '模板插值既非矩阵列也非同文件字符串常量' }
}

/* ─────────────────────────── TS 单文件解析 ─────────────────────────── */

/**
 * 无花括号箭头函数(`const f = (x) => expr`)的表达式体终点:从 `=>` 后首个非空白字符
 * 起,认字符串/注释/嵌套括号,走到**深度 0 的换行**即止。
 * 病根(G-962 实测):旧实现一律 `indexOf('{')` 找体起点,无花括号箭头函数于是把
 * **下一个函数的花括号**当自己的体 ⇒ 作用域虚胖到 L211 之后 ⇒ enclosingFn 把紧随其后的
 * `server.get('/permission-default')` 归给 `readWireMode` 这种辅助箭头函数(图上走不到)
 * ⇒ 注册落 via=fallback 裸路径,前端 GET /api/workspace/permission-default 永判不死不活。
 * 判不出终点(深度不归零)返回 -1,调用方跳过该声明(与旧 bodyEnd===-1 同口径,漏读不冒判)。
 */
function findExpressionEnd(text, from) {
  let depth = 0
  for (let i = from; i < text.length; i++) {
    const ch = text[i]
    if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipComment(text, i)
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipQuoted(text, i)
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--
      if (depth < 0) return i - 1
    } else if (ch === '\n' && depth === 0) return i
  }
  return text.length - 1
}

/** 函数声明表:name → {name, params, start, end} */
export function findTopLevelFunctions(text) {
  const fns = []
  const re = g(FN_DECL_SRC)
  let m
  while ((m = re.exec(text)) !== null) {
    const name = m[1] || m[3] || m[5] || '(default)'
    const paramsRaw = m[1] !== undefined ? m[2] : m[3] !== undefined ? m[4] : m[6]
    // 箭头函数分支(m[3])的体可以是表达式而非块;其余分支必有块。
    if (m[3] !== undefined) {
      let k = m.index + m[0].length
      while (k < text.length && /\s/.test(text[k])) k++
      if (text[k] !== '{') {
        const exprEnd = findExpressionEnd(text, k)
        if (exprEnd === -1) continue
        if (fns.some((f) => f.name === name && f.start <= m.index && m.index < f.end)) continue
        fns.push({
          name,
          params: splitTopLevelArgs(String(paramsRaw || ''))
            .map((p) => p.replace(/\??\s*:\s*[\s\S]*$/, '').trim())
            .filter(Boolean),
          start: m.index,
          end: exprEnd,
        })
        re.lastIndex = exprEnd
        continue
      }
    }
    const braceOpen = text.indexOf('{', m.index + m[0].length - 1)
    if (braceOpen === -1) continue
    const bodyEnd = findMatchingBracket(text, braceOpen, '{', '}')
    if (bodyEnd === -1) continue
    // 已有一份**更外层**同名声明时不覆盖(嵌套同名极少见;这里只留最外层那份当挂载入口)
    if (fns.some((f) => f.name === name && f.start <= m.index && m.index < f.end)) continue
    fns.push({
      name,
      params: splitTopLevelArgs(String(paramsRaw || ''))
        .map((p) => p.replace(/\??\s*:\s*[\s\S]*$/, '').trim())
        .filter(Boolean),
      start: m.index,
      end: bodyEnd,
    })
    re.lastIndex = braceOpen
  }
  return fns
}

export function enclosingFn(fns, idx) {
  let best = null
  for (const f of fns)
    if (idx >= f.start && idx <= f.end && (!best || f.start > best.start)) best = f
  return best
}

/**
 * 解析一个 TS 文件(注释已遮、字符串保留):注册条目 + 挂载边 + 内联别名 + import 图。
 * @param {string} rel 仓库相对 POSIX 路径
 * @param {string} raw 原文
 */
export function analyzeTsFile(rel, raw) {
  // 顺序是牙:先遮正则再遮注释。反过来时 maskComments 会被正则里的引号带偏引号态,
  // 级联错位把模板串里的 `//`(URL)当行注释遮掉 ⇒ 花括号配平崩 ⇒ 插件函数整族丢图。
  const src = maskComments(maskRegexLiterals(raw), 'ts')
  const dir = dirname(rel)
  const fns = findTopLevelFunctions(src)
  const fnByName = new Map()
  for (const f of fns) if (!fnByName.has(f.name)) fnByName.set(f.name, f)

  const imports = new Map()
  const importRe = g(IMPORT_SRC)
  let m
  while ((m = importRe.exec(src)) !== null) {
    const clause = m[1]
    const target = normalizePosix(`${dir}/${m[2].replace(/\.jsx?$/, '')}`)
    const named = /\{([^}]*)\}/.exec(clause)
    if (named) {
      for (const part of named[1].split(',')) {
        const pieces = part.trim().split(/\s+as\s+/)
        const local = (pieces[1] || pieces[0] || '').trim().replace(/^type\s+/, '')
        if (local) imports.set(local, target)
      }
    }
    const head = clause.trim().replace(/^type\s+/, '').replace(/^default\s+/, '')
    if (!head.startsWith('{') && !head.startsWith('*')) {
      const def = /^([A-Za-z_$][\w$]*)/.exec(head)
      if (def) imports.set(def[1], target)
    }
  }

  // 动态 import 的默认导出解构:`const { default: X } = await import('./p.js')` —— 本仓
  // admin-missing-routes.ts 整族(admin/ 子路由 ~30 个)用这一型挂载后 `register(X)`;
  // 不认它,边解不到目标 ⇒ 子路由全落 unreached 兜底档、带前缀调用被假红(2026-10-22 O87g)。
  const dynImportRe = g(
    `\\b(?:const|let|var)\\s*\\{\\s*default\\s*:\\s*([A-Za-z_$][\\w$]*)[^}]*\\}\\s*=\\s*(?:await\\s+)?import\\(\\s*['"](\\.[^'"]*)['"]\\s*\\)`,
  )
  while ((m = dynImportRe.exec(src)) !== null) {
    imports.set(m[1], normalizePosix(`${dir}/${m[2].replace(/\.jsx?$/, '')}`))
  }

  // re-export barrel:`export { X } from './p.js'` / `export { X as Y } from './p.js'`,
  // 以及 `export { X }`(X 是本文件 import 进来的局部绑定,如 ai-vendors.ts)。
  // barrel 自身没有函数声明,挂载符号必须顺着 re-export 追到定义文件,否则整棵子图
  // 停在 barrel(实测:user/、admin-sys/、other/ 三族 ~60 文件全落兜底档 ⇒ /api/vip/benefits 假红)。
  const reexports = new Map() // 局部导出名 → 定义文件(已归一的 posix 相对路径,无扩展名)
  const reExportRe = g(`\\bexport\\s*\\{([^}]*)\\}\\s*(?:from\\s*['"](\\.[^'"]*)['"])?`)
  while ((m = reExportRe.exec(src)) !== null) {
    const target = m[2] ? normalizePosix(`${dir}/${m[2].replace(/\.jsx?$/, '')}`) : null
    for (const part of m[1].split(',')) {
      const pieces = part.trim().split(/\s+as\s+/)
      const orig = (pieces[0] || '').trim().replace(/^type\s+/, '')
      const local = (pieces[1] || pieces[0] || '').trim()
      if (!local || !orig) continue
      if (target) reexports.set(local, target)
      else if (imports.has(orig)) reexports.set(local, imports.get(orig))
    }
  }

  const pathConsts = extractPathConsts(src)
  const matrices = extractMatrixArrays(src)
  const loops = findMatrixLoops(src, matrices)

  /** 内联箭头作用域:`X.register(async (Y) => {…}, {prefix})` ⇒ Y 的前缀挂在 X 之下 */
  const aliases = new Map() // `${fn}\u0000${recv}` → {parentRecv, prefix}
  const regs = [] // {fn, recv, method, arg, idx, line}
  const edges = [] // {fn, recv, symbol, prefix, line}
  const directEdges = [] // {fn, recv, symbol, line}
  const opaqueLocal = [] // {prefix, line}

  /** 本文件里被当 Fastify 实例用过的标识符(见 INSTANCE_USE_SRC 注释) */
  const instanceNames = new Set()
  for (const f of fns) if (f.params[0]) instanceNames.add(f.params[0])
  for (const re of [g(INSTANCE_USE_SRC), g(FASTIFY_FACTORY_SRC)]) {
    let x
    while ((x = re.exec(src)) !== null) instanceNames.add(x[1])
  }

  const pushReg = (recv, method, arg, idx) => {
    const fn = enclosingFn(fns, idx)
    regs.push({
      fn: fn ? fn.name : MODULE_FN,
      recv,
      method,
      arg,
      idx,
      line: lineOfIdx(src, idx),
    })
  }

  // ── ① 挂载边具名符号 / 内联箭头别名(先扫:它决定"谁是实例") ──
  const registerRe = g(REGISTER_SRC)
  while ((m = registerRe.exec(src)) !== null) {
    const recv = m[1]
    const openIdx = m.index + m[0].length - 1
    const argsText = readParenArgs(src, openIdx)
    const args = splitTopLevelArgs(argsText)
    const optObj = args[1] || ''
    const pre = /prefix\s*:\s*['"`]([^'"`]*)['"`]/.exec(optObj)
    const fnName = (enclosingFn(fns, m.index) || { name: MODULE_FN }).name
    const first = (args[0] || '').trim()
    if (/^(?:async\s*)?\(/.test(first)) {
      const paramName = /^\s*(?:async\s*)?\(\s*([A-Za-z_$][\w$]*)/.exec(first)
      const braceInArgs = argsText.indexOf('{')
      const bodyEnd =
        braceInArgs === -1 ? -1 : findMatchingBracket(argsText, braceInArgs, '{', '}')
      if (paramName && bodyEnd !== -1) {
        aliases.set(`${fnName}\u0000${paramName[1]}`, { parentRecv: recv, prefix: pre ? pre[1] : '' })
        instanceNames.add(paramName[1])
      } else if (pre) opaqueLocal.push({ prefix: pre[1], line: lineOfIdx(src, m.index) })
      registerRe.lastIndex = openIdx
      continue
    }
    const sym = /^(?:await\s+)?([A-Za-z_$][\w$]*)/.exec(first)
    if (!sym) {
      if (pre) opaqueLocal.push({ prefix: pre[1], line: lineOfIdx(src, m.index) })
      registerRe.lastIndex = openIdx
      continue
    }
    if (!pre && /prefix\s*:\s*[`{]/.test(optObj))
      opaqueLocal.push({ prefix: '<template-prefix>', line: lineOfIdx(src, m.index) })
    edges.push({
      fn: fnName,
      recv,
      symbol: sym[1],
      prefix: pre ? pre[1] : '',
      line: lineOfIdx(src, m.index),
    })
    registerRe.lastIndex = openIdx
  }

  // ── ② 动词注册(含跨行、带泛型、路径与 handler 分行) ──
  const verbRe = g(VERB_CALL_SRC)
  while ((m = verbRe.exec(src)) !== null) {
    const openIdx = m.index + m[0].length - 1
    const args = splitTopLevelArgs(readParenArgs(src, openIdx))
    const arg = parsePathArg(args[0])
    // 空串 localPath 也是合法注册(挂在节点前缀本身):实测 admin-sys/dict-data-routes.ts 的
    // `s.post('', h)` / `s.put('', h)` ⇒ POST/PUT /api/admin/dict/data —— 旧判据要求 `/` 开头,
    // 整条静默丢弃 ⇒ 前端在册调用被降级(2026-10-22 O87g 收尾实证)。
    const shaped =
      (arg.kind === 'literal' || arg.kind === 'template') &&
      (arg.value.startsWith('/') || arg.value === '')
    // 以插值开头的模板(`server.get(`${basePath}/:id`)`)此前被 shaped 静默丢弃 ⇒
    // registerCrud 那族工厂的 :id 腿(GET/PUT/DELETE 三条)整族隐身(实测 15 调用点×3=45 条)。
    // 它不是"不合法",是"此处不可解、延后解":工厂调用点按实参代入,普通节点交
    // expandTemplatePath,两边都解不出 ⇒ emitRegs 落 undetermined 报名 —— 静默丢=判据看不见
    // 却当没有(§12e 恒红门的镜像:恒漏尺),报名才是三态纪律(2026-10-22 O87g 先决①收尾)。
    const deferredTemplate = arg.kind === 'template' && !arg.value.startsWith('/')
    // 实例过滤:不是 Fastify 实例的接收者(`db.delete(table)` / `cache.get('/api/x')`)不是注册
    if (!instanceNames.has(m[1])) {
      verbRe.lastIndex = openIdx
      continue
    }
    // 注册至少两参(url + handler/schema);单参的 `x.get('/key')` 是取值不是注册
    if ((shaped || deferredTemplate) && args.length < 2) {
      verbRe.lastIndex = openIdx
      continue
    }
    if (shaped || deferredTemplate || arg.kind === 'bare' || arg.kind === 'opaque')
      pushReg(m[1], m[2].toUpperCase(), arg, m.index)
    verbRe.lastIndex = openIdx
  }
  // ── ③ `.route({ method, url })`(method 可为字符串数组) ──
  const routeObjRe = g(ROUTE_OBJ_SRC)
  while ((m = routeObjRe.exec(src)) !== null) {
    const openIdx = m.index + m[0].length - 2
    const body = readParenArgs(src, openIdx)
    const urlM = /url\s*:\s*(['"`])([^'"`]*)\1/.exec(body)
    if (urlM && urlM[2].startsWith('/') && instanceNames.has(m[1])) {
      const methodM = /method\s*:\s*(\[[^\]]*\]|['"][A-Za-z]+['"])/.exec(body)
      const methods = methodM
        ? [...methodM[1].matchAll(/['"]([A-Za-z]+)['"]/g)].map((x) => x[1].toUpperCase())
        : ['ANY']
      for (const mo of methods)
        pushReg(m[1], mo, { kind: 'literal', value: urlM[2], expr: urlM[2] }, m.index)
    }
    routeObjRe.lastIndex = openIdx
  }
  // ── ④ 直接调用形式的挂载(`registerRoutes(server)` / `registerXxxRoutes(server)`)──
  //    同文件函数**或 import 来的符号**都算边 —— 只认同文件函数时,server.ts 的
  //    `registerRoutes(server)`(它住在 routes/index.ts)会让整棵挂载图停在入口,
  //    实测那一次全部路由退到兜底档、`/api/ranking/courses` 反而查不出来。
  const directRe = g(DIRECT_CALL_SRC)
  while ((m = directRe.exec(src)) !== null) {
    const owner = enclosingFn(fns, m.index)
    if (NON_CALLEE_KEYWORDS.has(m[1])) continue
    if (!fnByName.has(m[1]) && !imports.has(m[1])) continue
    if (owner && owner.name === m[1]) continue // 递归自身
    directEdges.push({
      fn: owner ? owner.name : MODULE_FN,
      recv: m[2],
      symbol: m[1],
      line: lineOfIdx(src, m.index),
    })
    directRe.lastIndex = m.index + m[0].length - 1
  }

  return {
    rel,
    dir,
    src,
    fns,
    fnByName,
    imports,
    reexports,
    pathConsts,
    loops,
    matrices,
    instanceNames,
    regs,
    edges,
    directEdges,
    aliases,
    opaqueLocal,
  }
}

/* ───────────────────────── 工厂注册(helper 形态) ───────────────────────── */

/**
 * 从工厂实现体推出「方法集 + 路径模板 + 路径形参」。
 * 判据:**不硬编码** get/post/put/delete 名单 —— 工厂注册哪些方法由它自己体内 `<p0>.verb(...)` 决定。
 * @returns {null|{paramName:string, regs:Array, params:string[]}}
 */
export function describeFactory(info, factoryName) {
  const fn = info.fnByName.get(factoryName)
  if (!fn) return null
  const bodyRegs = info.regs.filter((r) => r.fn === factoryName)
  if (bodyRegs.length === 0) return null
  const instanceParam = fn.params[0]
  if (!instanceParam) return null
  let pathParam = null
  for (const p of fn.params.slice(1)) {
    if (
      bodyRegs.some(
        (r) =>
          (r.arg.kind === 'bare' && r.arg.expr === p) ||
          (r.arg.kind === 'template' && new RegExp(`\\$\\{\\s*${p}\\s*\\}`).test(r.arg.value)),
      )
    ) {
      pathParam = p
      break
    }
  }
  if (!pathParam) return null
  const regs = bodyRegs.filter((r) => r.recv === instanceParam)
  if (regs.length === 0) return null
  return { paramName: pathParam, regs, params: fn.params }
}

/** 把工厂体里的路径模板 / 裸形参代入实参路径值 */
export function instantiateFactoryReg(factoryReg, paramName, basePath) {
  const arg = factoryReg.arg
  if (arg.kind === 'bare' && arg.expr === paramName) return { ok: true, value: basePath }
  if (arg.kind === 'literal' && !arg.value.includes('${')) return { ok: true, value: arg.value }
  if (arg.kind === 'template') {
    const all = [...arg.value.matchAll(/\$\{([A-Za-z0-9_$]+)\}/g)].map((v) => v[1])
    if (!all.length || !all.every((v) => v === paramName))
      return { ok: false, reason: all.length ? '模板还含其它未解插值' : '模板不含该路径形参' }
    return {
      ok: true,
      value: arg.value.replace(new RegExp(`\\$\\{\\s*${paramName}\\s*\\}`, 'g'), basePath),
    }
  }
  return { ok: false, reason: '路径不是该工厂形参的代入结果' }
}

export function pickExisting(map, candidates) {
  for (const c of candidates) if (map.has(c)) return c
  return null
}

/** 全局面收集工厂名(由实现体推导,不写死清单) */
export function collectFactoryNames(tsInfos) {
  const names = new Set()
  for (const [, info] of tsInfos)
    for (const f of info.fns) if (describeFactory(info, f.name)) names.add(f.name)
  return names
}

/** 工厂定义所在文件 + 路径实参下标 */
function findFactoryForCall(tsInfos, info, symbol) {
  const tryFile = (file) => {
    const t = tsInfos.get(file)
    if (!t) return null
    const d = describeFactory(t, symbol)
    if (!d) return null
    return { ...d, defFile: file, pathArgIndex: d.params.indexOf(d.paramName) }
  }
  const local = tryFile(info.rel)
  if (local) return local
  const imported = info.imports.get(symbol)
  if (!imported) return null
  const target = pickExisting(tsInfos, [`${imported}.ts`, `${imported}/index.ts`])
  return target ? tryFile(target) : null
}

/** 找出一个文件里的工厂调用点(名字来自实现体推导,不写死清单) */
export function scanFactoryCalls(info, factoryNames) {
  if (!factoryNames || factoryNames.size === 0) return []
  const names = [...factoryNames].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const re = g(`(?:^|[^.\\w$])(${names})\\s*\\(`)
  const out = []
  let m
  while ((m = re.exec(info.src)) !== null) {
    const openIdx = m.index + m[0].length - 1
    const owner = enclosingFn(info.fns, m.index)
    out.push({
      name: m[1],
      fn: owner ? owner.name : MODULE_FN,
      argsText: readParenArgs(info.src, openIdx),
      idx: m.index,
      line: lineOfIdx(info.src, m.index),
    })
    re.lastIndex = openIdx
  }
  return out
}

/* ───────────────── 挂载图走通(Fastify) ───────────────── */

/** 某 (file, fn, recv) 相对节点前缀的额外前缀(内联箭头别名链) */
export function extraPrefix(info, fnName, recv) {
  let cur = recv
  let acc = ''
  const seen = new Set()
  for (let hop = 0; hop < 8; hop++) {
    const key = `${fnName}\u0000${cur}`
    if (seen.has(key)) break
    seen.add(key)
    const alias = info.aliases.get(key)
    if (!alias) break
    acc = joinPrefix(alias.prefix, acc)
    cur = alias.parentRecv
  }
  return acc
}

/**
 * 顺 re-export barrel 链找符号的定义文件(带环保护);追不到返回 null(不猜)。
 * 2026-10-22 O87g:missing-user-routes.ts / admin-sys.ts / other/_exports.ts 都是纯 barrel,
 * 不追链则整棵子图停在 barrel 文件,~60 个路由文件全落兜底档 ⇒ 在册路由被假红。
 */
function followReexports(tsInfos, file, symbol, seen) {
  const guard = seen || new Set()
  const info = tsInfos.get(file)
  if (!info) return null
  const rp = info.reexports.get(symbol)
  if (!rp || guard.has(rp)) return null
  guard.add(rp)
  const target = pickExisting(tsInfos, [`${rp}.ts`, `${rp}/index.ts`])
  if (!target) return null
  const t = tsInfos.get(target)
  if (t.fnByName.has(symbol)) return [{ file: target, fn: symbol, approx: false }]
  if (t.fnByName.has('(default)')) return [{ file: target, fn: '(default)', approx: false }]
  return followReexports(tsInfos, target, symbol, guard)
}

/** 解析挂载符号 → 目标节点列表;`{missing}` = 目标文件不在面上;`{ambiguous}` = 多解;null = 解不出 */
function resolveSymbol(tsInfos, info, symbol) {
  if (info.fnByName.has(symbol)) return [{ file: info.rel, fn: symbol, approx: false }]
  const imported = info.imports.get(symbol)
  if (imported) {
    const target = pickExisting(tsInfos, [`${imported}.ts`, `${imported}/index.ts`])
    if (!target) return { missing: imported }
    const tInfo = tsInfos.get(target)
    if (tInfo.fnByName.has(symbol)) return [{ file: target, fn: symbol, approx: false }]
    if (tInfo.fnByName.has('(default)')) return [{ file: target, fn: '(default)', approx: false }]
    const re = followReexports(tsInfos, target, symbol)
    if (re) return re
    const cands = tInfo.fns.filter((f) => f.name !== '(default)')
    if (cands.length === 1) return [{ file: target, fn: cands[0].name, approx: true }]
    if (cands.length > 1) return cands.map((f) => ({ file: target, fn: f.name, approx: true }))
    return [{ file: target, fn: MODULE_FN, approx: true }]
  }
  // 无 import 记录:在全局面按**函数名**找 —— 唯一命中才用,多命中交人工(不猜)
  const hits = []
  for (const [rel, t] of tsInfos) {
    if (t.fnByName.has(symbol)) hits.push({ file: rel, fn: symbol, approx: true })
    else if (rel === info.rel && t.fnByName.has('(default)'))
      hits.push({ file: rel, fn: '(default)', approx: true })
  }
  if (hits.length === 1) return hits
  if (hits.length > 1) return { ambiguous: hits.map((h) => `${h.file}#${h.fn}`).join(', ') }
  return null
}

/**
 * 从入口沿挂载图走一遍,产出精确注册集;图走不到的函数按「本文件自身前缀」兜底
 * (兜底**绝不**与全仓绝对前缀笛卡尔拼接 —— 那正是 `/api/courses` 假路径的成因)。
 * @param {Map<string,object>} tsInfos rel → analyzeTsFile 结果
 * @param {object} opts {entry, factoryNames, permissiveFallback}
 */
export function walkFastifyGraph(tsInfos, opts = {}) {
  const entry = opts.entry || DEFAULT_ENTRY_TS
  const factoryNames = opts.factoryNames || collectFactoryNames(tsInfos)
  const entries = []
  const opaque = []
  const undetermined = []
  const queue = []
  const enqueued = new Set() // `${file}\u0000${fn}\u0000${prefix}` —— 同节点同前缀只走一次
  const touchedFns = new Set() // `${file}\u0000${fn}` —— 判"图有没有走到过"
  const isFactoryFn = (file, fnName) => {
    const info = tsInfos.get(file)
    return info ? describeFactory(info, fnName) !== null : false
  }

  const fullPathOf = (base, localPath) =>
    cleanPath(isAbsoluteApiPath(localPath) ? localPath : joinPrefix(base, localPath))

  /** 产出一个节点内的直接动词注册 */
  const emitRegs = (info, fnName, nodePrefix, via) => {
    if (isFactoryFn(info.rel, fnName)) return // 工厂体内的模板由调用点代入,不在此臆造
    for (const r of info.regs) {
      if (r.fn !== fnName) continue
      const base = joinPrefix(nodePrefix, extraPrefix(info, fnName, r.recv))
      if (r.arg.kind === 'literal' || r.arg.kind === 'template') {
        let values = []
        if (r.arg.kind === 'literal') values = [r.arg.value]
        else {
          const ex = expandTemplatePath(r.arg.value, {
            src: info.src,
            idx: r.idx,
            pathConsts: info.pathConsts,
            loops: info.loops,
          })
          if (ex.ok) values = ex.values
          else
            undetermined.push({
              file: info.rel,
              line: r.line,
              kind: 'template-path',
              detail: `${r.recv}.${r.method.toLowerCase()}(\`${r.arg.value}\`) —— ${ex.reason}`,
            })
        }
        for (const v of values) {
          if (v !== '' && !v.startsWith('/')) continue // 空串=挂在节点前缀本身(见 shaped 注释)
          entries.push({ method: r.method, path: fullPathOf(base, v), file: info.rel, line: r.line, via })
        }
        continue
      }
      // bare 标识符注册(`server.get(HEALTH_PATH, …)` —— github-app.ts:266/277/302 三条真挂载链
      // 实证,2026-10-22 G-962):先查同文件路径常量(与模板串展开同一份 pathConsts),解不到再退
      // 工厂调用点同款绑定正则(1113 一线,认双引号/反引号/类型注记)。解到 ⇒ 按 literal 同守卫
      // (1079 一线)产出;解不到 ⇒ 仍落 identifier-path 逐条报名,不静默丢也不冒判 —— 运行时变量
      // (`ws-ai.ts` 的 `server.get(path)`)、成员表达式与带括号实参(`kv.get(indexKey(x))`)、
      // 函数调用取值的 `redis.get(key)` 全走这条报名出口,实测 11 条一条不吞。
      if (r.arg.kind === 'bare' && /^[A-Za-z_$][\w$]*$/.test(r.arg.expr)) {
        let v = info.pathConsts.get(r.arg.expr)
        if (v === undefined) {
          const bound = new RegExp(
            `(?:const|let|var)\\s+${r.arg.expr}\\s*(?::[^=]+)?=\\s*['"\`]([^'"\`]*)['"\`]`,
          ).exec(info.src)
          if (bound && bound[1]) v = bound[1]
        }
        if (v !== undefined && v.startsWith('/')) {
          entries.push({ method: r.method, path: fullPathOf(base, v), file: info.rel, line: r.line, via })
          continue
        }
      }
      undetermined.push({
        file: info.rel,
        line: r.line,
        kind: r.arg.kind === 'bare' ? 'identifier-path' : 'opaque-path',
        detail: `${r.recv}.${r.method.toLowerCase()}(${r.arg.expr}) 路径静态不可解(仅工厂调用点能代入)`,
      })
    }
  }

  /** 产出一个节点内的工厂调用点(按实参解析路径,方法集来自工厂实现体) */
  const emitFactoryCalls = (info, fnName, nodePrefix) => {
    for (const call of scanFactoryCalls(info, factoryNames)) {
      if (call.fn !== fnName) continue
      if (call.name === fnName) continue // 工厂定义体内的自引用
      const factory = findFactoryForCall(tsInfos, info, call.name)
      if (!factory) {
        undetermined.push({
          file: info.rel,
          line: call.line,
          kind: 'factory-unresolved',
          detail: `${call.name}(...) 解不到工厂定义(工厂面按实现体推导,不写死名单)`,
        })
        continue
      }
      const args = splitTopLevelArgs(call.argsText)
      const pathArg = parsePathArg(args[factory.pathArgIndex] || '')
      let basePath = ''
      if (pathArg.kind === 'literal') basePath = pathArg.value
      else if (pathArg.kind === 'bare') {
        const bound = new RegExp(
          `(?:const|let|var)\\s+${pathArg.expr}\\s*(?::[^=]+)?=\\s*['"\`]([^'"\`]*)['"\`]`,
        ).exec(info.src)
        if (bound && bound[1]) basePath = bound[1]
        else {
          undetermined.push({
            file: info.rel,
            line: call.line,
            kind: 'factory-path-identifier',
            detail: `${call.name}() 的路径实参是标识符 ${pathArg.expr},在本文件解不到定值`,
          })
          continue
        }
      } else if (pathArg.kind === 'template') {
        const ex = expandTemplatePath(pathArg.value, {
          src: info.src,
          idx: call.idx,
          pathConsts: info.pathConsts,
          loops: info.loops,
        })
        if (!ex.ok) {
          undetermined.push({
            file: info.rel,
            line: call.line,
            kind: 'factory-path-template',
            detail: `${call.name}() 的路径实参是模板 \`${pathArg.value}\`,${ex.reason}`,
          })
          continue
        }
        basePath = ex.values[0]
      } else {
        undetermined.push({
          file: info.rel,
          line: call.line,
          kind: 'factory-path-opaque',
          detail: `${call.name}() 的路径实参不可静态解析:${pathArg.expr}`,
        })
        continue
      }
      const recvIdent = /^[A-Za-z_$][\w$]*$/.exec(args[0] || '')
      const recv = recvIdent ? recvIdent[0] : 'server'
      const base = joinPrefix(nodePrefix, extraPrefix(info, fnName, recv))
      for (const reg of factory.regs) {
        const inst = instantiateFactoryReg(reg, factory.paramName, basePath)
        if (!inst.ok) {
          undetermined.push({
            file: info.rel,
            line: call.line,
            kind: 'factory-reg-unresolved',
            detail: `${call.name} 工厂内 ${reg.method} 的 ${reg.arg.expr} 代入失败:${inst.reason}`,
          })
          continue
        }
        if (!inst.value.startsWith('/')) continue
        entries.push({
          method: reg.method,
          path: fullPathOf(base, inst.value),
          file: info.rel,
          line: call.line,
          via: `factory:${factory.defFile}`,
        })
      }
    }
  }

  const pushNode = (file, fnName, prefix, note) => {
    const key = `${file}\u0000${fnName}\u0000${prefix}`
    if (enqueued.has(key)) return
    enqueued.add(key)
    queue.push([file, fnName, prefix])
    touchedFns.add(`${file}\u0000${fnName}`)
    if (note) undetermined.push({ file, line: 0, kind: 'symbol-approx', detail: note })
  }

  // 入口档:server.ts 的注册与边都住在 `buildServer()` / `registerPlugins()` 这类函数里,
  // 只从模块作用域起步会让整棵挂载图停在入口(实测 touchedNodes=1、全仓退到兜底档)。
  // 组合根的函数一律按空前缀起算 —— 它们拿到的就是根实例。
  if (tsInfos.has(entry)) {
    pushNode(entry, MODULE_FN, '', null)
    for (const f of tsInfos.get(entry).fns) pushNode(entry, f.name, '', null)
  } else
    undetermined.push({
      file: entry,
      line: 0,
      kind: 'entry-missing',
      detail: 'Fastify 入口不在面上 —— 挂载图无起点,整面按兜底档产出',
    })

  let guard = 0
  while (queue.length && guard++ < 40000) {
    const [file, fnName, prefix] = queue.shift()
    const info = tsInfos.get(file)
    if (!info) continue
    emitRegs(info, fnName, prefix, 'graph')
    emitFactoryCalls(info, fnName, prefix)
    const allEdges = [
      ...info.edges.map((e) => ({ ...e, inline: false })),
      ...info.directEdges.map((e) => ({ ...e, prefix: '', inline: 'direct' })),
    ]
    for (const e of allEdges) {
      if (e.fn !== fnName) continue
      const nodePrefix = joinPrefix(prefix, extraPrefix(info, fnName, e.recv))
      const acc = joinPrefix(nodePrefix, e.prefix)
      const r = resolveSymbol(tsInfos, info, e.symbol)
      if (!r || r.missing !== undefined || r.ambiguous !== undefined) {
        const why = r && r.missing !== undefined ? '目标不在面上' : r && r.ambiguous ? `多解(${r.ambiguous})` : '解析不到文件(第三方插件/动态符号)'
        if (e.prefix)
          opaque.push({ prefix: cleanPath(acc), evidence: `${file}:${e.line} register(${e.symbol}) ${why}` })
        else
          undetermined.push({ file, line: e.line, kind: 'edge-unresolved', detail: `register(${e.symbol}) ${why}` })
        continue
      }
      for (const t of r) pushNode(t.file, t.fn, acc, t.approx ? `符号 ${e.symbol} 未按名匹配,按整文件函数并集挂载` : null)
    }
  }

  // 兜底:图走不到的(文件, 函数)。产出口径只允许「本文件自身声明的前缀」,
  // 且必须逐条报名 —— 未走到 ≠ 没注册,但也 ≠ 走通了。
  const unreached = []
  if (opts.permissiveFallback !== false) {
    for (const [rel, info] of tsInfos) {
      const names = new Set()
      for (const r of info.regs) names.add(r.fn)
      for (const e of info.edges) names.add(e.fn)
      for (const e of info.directEdges) names.add(e.fn)
      for (const c of scanFactoryCalls(info, factoryNames)) names.add(c.fn)
      for (const fnName of names) {
        if (touchedFns.has(`${rel}\u0000${fnName}`)) continue
        unreached.push(`${rel}#${fnName}`)
        const own = [...new Set([...info.edges.filter((e) => e.fn === fnName && e.prefix).map((e) => e.prefix)])]
        for (const base of ['', ...own]) {
          emitRegs(info, fnName, base, 'fallback')
          emitFactoryCalls(info, fnName, base)
        }
      }
    }
  }
  return { entries, opaque, undetermined, touchedFns, unreached, analyzed: tsInfos.size }
}

/* ─────────────────────────── FastAPI 注册面 ─────────────────────────── */

const PY_DECO_SRC = /@([A-Za-z_][\w.]*)\.(get|post|put|patch|delete|options|head|websocket)\(\s*['"]([^'"]*)['"]/.source
const PY_ROUTER_PREFIX_SRC = /APIRouter\(\s*prefix\s*=\s*['"]([^'"]+)['"]/g.source
const PY_MOUNT_SRC = /\.mount\(\s*(['"][^'"]*['"])/g.source
// include 行两种实形:① `NAME(.SUB)*.router, prefix="P"`(NAME 可为模块名或模块别名);
// ② 裸别名 `ALIAS, prefix="P"`(实测 main.py 的 cloud_runs/computer_use/memory 三族)。
// prefix 组可缺省(无参挂载 ⇒ 自有前缀即终形,不得登记)。
const PY_INCLUDE_A_SRC = /app\.include_router\(\s*([\w.]+)\.router\s*(?:,[^)]*?prefix\s*=\s*['"]([^'"]+)['"])?/g.source
const PY_INCLUDE_B_SRC = /app\.include_router\(\s*([A-Za-z0-9_]+)\s*(?:,[^)]*?prefix\s*=\s*['"]([^'"]+)['"])?/g.source
// import 统一解析:括号多行形与单行形一把吃(`[^\n#]` 截注释,括号组允许跨行)
const PY_IMPORT_SRC = /from\s+([.\w]+)\s+import\s*(\(([^)]*)\)|([^\n#]+))/g.source

/**
 * include 前缀 P 与文件自有前缀 Q 的拼接。旧判据的「二选一」是结构性盲区:
 * FastAPI 真实路径 = include 前缀 + 自有前缀 + localPath(实测 connectors.py 自有
 * `/connectors` + main.py include `prefix="/api"` ⇒ 真路径 /api/connectors/*,旧判据
 * 只记 /connectors/* ⇒ 前端三条真调用全落未判定桶 —— G-962 高置信"真死候选"里
 * computer-use/cloud-runs/cost-ledger/model-pricing/longterm-memory/prompts/browser-sessions
 * 七族 28 条全是这一型假死)。
 * 防双 /api:Q 已以 P 为路径段前缀(checkin.py 自有 /api/checkin)⇒ 不叠,直接取 Q。
 */
export function combinePyPrefix(includePrefix, ownPrefix) {
  const P = String(includePrefix || '').replace(/\/+$/, '')
  const Q = String(ownPrefix || '')
  if (!P) return Q
  if (!Q || Q === '/') return P
  if (Q === P || Q.startsWith(P + '/')) return Q
  return joinPrefix(P, Q)
}

/** 相对导入规约:`.x`/`..x` 相对宿主文件的包路径;绝对名原样 */
function resolvePyModule(spec, parentPkg) {
  const dots = /^\.+/.exec(spec)?.[0].length ?? 0
  if (!dots) return spec
  const rest = spec.slice(dots)
  let base = parentPkg
  for (let i = 1; i < dots; i++) base = base.split('.').slice(0, -1).join('.')
  if (!rest) return base
  return base ? `${base}.${rest}` : rest
}

/**
 * 从**面上全部 py 文件**解析 include 挂载面(不只 entry):killer_extras.py 是二级聚合器
 * (main.py 以 `killer_extras.register(app)` 调用),cost-ledger/model-pricing/longterm-memory
 * 三族的 include 行写在该文件里 —— 只读 main.py 对这一族整型失明(G-962 实证)。
 * import 别名四形态统一解到模块路径:
 *   ① from app.x.y import router as A           ⇒ A → app.x.y
 *   ② from app.x import MOD as A                ⇒ A → app.x.MOD(prompts as prompts_router 型)
 *   ③ from app.x import (a, b, c) / a, b, c     ⇒ 各 → app.x.<name>
 *   ④ from . import a, b(相对,killer_extras 型) ⇒ 各 → <parentPkg>.<name>
 * 无别名导入若 `mod.name` 不在面上而 `mod` 在面上 ⇒ 按对象定义解到 mod
 * (`from app.api.v1.router import api_v1_router` 型,api_v1_router 是对象不是模块)。
 * 注释先遮(agent_memory.py:9 的假 include 行是这一锁的真实形态)。
 * 已知边界:`api_v1_router.include_router(chat.router, prefix="/ai")` 这一**二级聚合**
 * (挂载对象非 app)不解析 —— 当前未判定桶里该族(/api/v1/ai/*)零前端调用,补图无裁决需求;
 * 真出现时再按 Fastify 侧 walk 同法扩,并保留未判定出口。
 * @returns {{byModule: Map<string,string>, byFile: Map<string,string>}}
 */
export function buildPyIncludeMaps(pyInfos) {
  const byModule = new Map()
  const byFile = new Map()
  const faceKeys = new Set()
  for (const rel of pyInfos.keys()) faceKeys.add(rel.replace(/\.py$/, '').replaceAll('/', '.'))
  const put = (modKey, prefix) => {
    byModule.set(modKey, prefix)
    const seg = modKey.split('.').pop()
    if (seg && !byFile.has(seg)) byFile.set(seg, prefix)
  }
  for (const [rel, raw] of pyInfos) {
    const src = maskComments(raw, 'py')
    const moduleKey = rel.replace(/\.py$/, '').replaceAll('/', '.')
    const parentPkg = moduleKey.split('.').slice(0, -1).join('.')
    const aliasToModule = new Map()
    let m
    const impRe = g(PY_IMPORT_SRC)
    while ((m = impRe.exec(src)) !== null) {
      const modBase = resolvePyModule(m[1], parentPkg)
      const list = String(m[3] ?? m[4] ?? '')
      for (const pieceRaw of list.split(',')) {
        const piece = pieceRaw.trim()
        if (!piece) continue
        const mm = /^(\w+)(?:\s+as\s+(\w+))?$/.exec(piece)
        if (!mm) continue
        const name = mm[1]
        const alias = mm[2]
        if (name === 'router' && alias) {
          aliasToModule.set(alias, modBase)
          continue
        }
        const target = `${modBase}.${name}`
        if (alias) aliasToModule.set(alias, target)
        else if (faceKeys.has(target)) aliasToModule.set(name, target)
        else if (faceKeys.has(modBase)) aliasToModule.set(name, modBase)
        else aliasToModule.set(name, target)
      }
    }
    const incA = g(PY_INCLUDE_A_SRC)
    while ((m = incA.exec(src)) !== null) {
      if (!m[2]) continue
      const resolved = aliasToModule.get(m[1]) ?? m[1]
      put(resolved, m[2])
    }
    const incB = g(PY_INCLUDE_B_SRC)
    while ((m = incB.exec(src)) !== null) {
      if (!m[2]) continue
      if (aliasToModule.has(m[1]) || /^\w+$/.test(m[1])) {
        const resolved = aliasToModule.get(m[1]) ?? m[1]
        put(resolved, m[2])
      }
    }
  }
  return { byModule, byFile }
}

/**
 * Python(ai-service)注册面。前缀判据 = include 前缀 ⊕ 文件自有前缀拼接(见 combinePyPrefix
 * 头注 —— 旧「二选一」把 G-962 七族 28 条真挂载链判成假死),另把 `.mount('…')` 提成
 * 不透明前缀 —— 旧实现靠一份手写台账,台账会腐烂。
 * @param {Map<string,string>} pyInfos rel → 原文(须含 entry 与各二级聚合器文件)
 */
export function extractFastApiRegistrations(pyInfos) {
  const entries = []
  const opaque = []
  const undetermined = []
  const { byModule, byFile } = buildPyIncludeMaps(pyInfos)
  for (const [rel, raw] of pyInfos) {
    const src = maskComments(raw, 'py')
    let m
    const mountRe = g(PY_MOUNT_SRC)
    while ((m = mountRe.exec(src)) !== null) {
      const lit = /^['"]([^'"]*)['"]$/.exec(m[1])
      if (lit)
        opaque.push({
          prefix: lit[1],
          evidence: `${rel}: app.mount('${lit[1]}', …) 子应用路径结构上不可见`,
        })
    }
    const routerPrefixes = []
    const preRe = g(PY_ROUTER_PREFIX_SRC)
    while ((m = preRe.exec(src)) !== null) routerPrefixes.push(m[1])
    const moduleKey = rel.replace(/\.py$/, '').replaceAll('/', '.')
    const fileName = moduleKey.split('.').pop()
    const mounted = byModule.get(moduleKey) ?? byFile.get(fileName)
    const bases = routerPrefixes.length
      ? mounted
        ? [...new Set(routerPrefixes.map((q) => combinePyPrefix(mounted, q)))]
        : routerPrefixes
      : mounted
        ? [mounted]
        : ['']
    const decoRe = g(PY_DECO_SRC)
    while ((m = decoRe.exec(src)) !== null) {
      const verb = m[2]
      const localPath = m[3]
      const line = lineOfIdx(src, m.index)
      if (!localPath.startsWith('/')) {
        undetermined.push({ file: rel, line, kind: 'py-relative-path', detail: `@router.${verb}('${localPath}') 非绝对路径,挂载点未知` })
        continue
      }
      if (verb === 'websocket') continue
      for (const p of bases)
        entries.push({ method: verb.toUpperCase(), path: cleanPath(joinPrefix(p, localPath)), file: rel, line, via: 'py' })
    }
  }
  return { entries, opaque, undetermined }
}

/* ─────────────────────────── 顶层出口 ─────────────────────────── */

/** 后端注册面唯一出口。@param {Map<string,string>} files rel → 源码 */
export function extractApiRegistrations(files, opts = {}) {
  const entryTs = opts.entryTs || DEFAULT_ENTRY_TS
  const tsInfos = new Map()
  let skippedTestFiles = 0
  for (const [rel, text] of files) {
    if (typeof text !== 'string' || !rel.endsWith('.ts') || rel.endsWith('.d.ts')) continue
    if (/(^|\/)(tests?|__tests__|e2e)\//.test(rel) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel)) {
      skippedTestFiles++
      continue
    }
    tsInfos.set(rel, analyzeTsFile(rel, text))
  }
  const factoryNames = collectFactoryNames(tsInfos)
  const fastify = walkFastifyGraph(tsInfos, {
    entry: entryTs,
    factoryNames,
    permissiveFallback: opts.permissiveFallback,
  })
  const pyFiles = new Map()
  for (const [rel, text] of files)
    if (rel.endsWith('.py') && typeof text === 'string') pyFiles.set(rel, text)
  const fastapi = extractFastApiRegistrations(pyFiles)
  // 本地 inline 不透明前缀(第三方插件挂在字面量前缀下却解不到目标)也进 opaque
  const opaque = [...fastify.opaque, ...fastapi.opaque]
  for (const [, info] of tsInfos)
    for (const o of info.opaqueLocal)
      opaque.push({ prefix: o.prefix, evidence: `${info.rel}:${o.line} register(… { prefix: '${o.prefix}' }) 目标不可静态解析` })
  return {
    entries: [...fastify.entries, ...fastapi.entries],
    opaque,
    undetermined: [...fastify.undetermined, ...fastapi.undetermined],
    unreached: fastify.unreached,
    stats: {
      tsFilesAnalyzed: tsInfos.size,
      pyFilesAnalyzed: pyFiles.size,
      skippedTestFiles,
      factories: factoryNames.size,
      factoryNames: [...factoryNames].sort(),
      touchedNodes: fastify.touchedFns.size,
    },
  }
}

// 供镜像测试直接打判据函数(§22c 消"两份真相")。本文件是纯库、无 CLI 入口,
// 故不需要 §22d 的 isDirectRun 守卫。
export const __test__ = {
  analyzeTsFile,
  classifyRouteCoverage,
  collectFactoryNames,
  describeFactory,
  expandTemplatePath,
  extraPrefix,
  extractFastApiRegistrations,
  findTopLevelFunctions,
  instantiateFactoryReg,
  isAbsoluteApiPath,
  parsePathArg,
  scanFactoryCalls,
  splitTopLevelArgs,
  walkFastifyGraph,
  cleanPath,
  MODULE_FN,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
