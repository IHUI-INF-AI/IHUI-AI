// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「按凭据存在性豁免」对账(G-459,2026-09-28 立)。
 *
 * 拦的是这一型:**把"某个凭据类头/cookie 在场"当成安全判定的结论**,而不是把值验真。
 * 立因不是假想 —— `apps/api/src/plugins/csrf.ts` 原先写着 `if (request.headers['x-internal-service-token'])
 * return`,头名在场即整块跳过 CSRF ⇒ 任何进程带这个头(值随意)就拿到免死金牌。#23 把它改成
 * `isVerifiedInternalMachineCall(request)`(唯一出口 `apps/api/src/utils/internal-principal.ts`,
 * 复用 `secretsEqual` 定长散列 + timingSafeEqual)。但**型还在**:下一个内部凭据族照样能写成
 * `if (request.headers['x-anything']) return`,而 typecheck / lint / 其余门全都不响。
 *
 * 三条设计约束(都是本仓反复记过的):
 *  1. **判据必须覆盖门自己认可的写法** —— "条件里带比较/带验真调用"正是 #23 的修法形态,
 *     把它判红等于要求人 `--no-verify`。所以条件里出现 `===`/`!==`/`secretsEqual`/
 *     `timingSafeEqual`/`isVerified…(`/`verify…(`/`startsWith(`/`.has(` 一律放过。
 *  2. **凭据名不写死站点清单** —— 名字按**词元**比对(`x-id-token` 算,`tokenizer`/`hashtags`
 *     不算),站点是否"已裁过"由台账 `scripts/data/credential-presence-exemptions.json` 判定;
 *     条目缺 reason/reviewBy、复核日过期、登记了而被审面没命中(清单腐烂)——三种都是红。
 *     同一件事也有行内出口 `credential-presence-exempt: <原因>`(须带原因,只救本行或紧邻上行)。
 *     该族**同笔登记**进守门 108 的 `FAMILY_LIFETIME_DAYS`(30 天,待偿的裁决债):不登记就走 90 天
 *     默认档,而第一处真被写出的行内豁免还会被 108 的 E4 判成"新引入的未登记豁免族"—— 一道门
 *     自己的合法出口被邻居钉红,就是 AGENTS 反复记过的"两道门互咬"(radius-role / border-ink 同课)。
 *     这把跨文件锁住在镜像测试 T10,不靠人记得。
 *  3. **判不出就报名** —— 括号配平失败、取不出名字、体起始形态跨行算不出 ⇒ 落 `未判定` 并逐条
 *     点名;`--strict` 下有未判定即 exit 2,拒绝出具合格证(本仓最高频失效型是"把没判写成判过了")。
 *
 * 口径同 70/77/83/98/101/103/118/135:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅人工逃生舱、两面旗同给判死、取不到判"无法判定"且**不回落**另一个面、
 * 枚举到 0 个候选判死不记绿;清单与正文**同面同轮**取。遮罩只引 `scripts/lib/code-mask.mjs`
 * 那一份实现(判据看代码面,而豁免标记写在注释里 ⇒ 标记在原文行上判)。
 *
 * 手动:`node scripts/check-credential-presence-bypass.mjs [--staged|--worktree|--json|--strict|--self-test]`
 * 问责:`pnpm check:credential-presence`;紧急跳过 `HUSKY_SKIP_CREDENTIAL_PRESENCE_BYPASS=1`
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitBinary, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskComments, maskCommentsAndStrings } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const LEDGER_FILE = 'scripts/data/credential-presence-exemptions.json'
const GIT_TIMEOUT_MS = 120_000

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' }

/**
 * 射程:只有"安全判定发生的地方"才谈得上豁免。按目录 + 扩展名收,不按文件名清单。
 * 加目录必须同批改本注释与 `isSecuritySurface`,否则会出现"扫到了但没判"的静默失明。
 */
const SCAN_DIRS = ['apps/api/src/plugins', 'apps/api/src/routes', 'apps/api/src/utils', 'apps/api/src/server.ts']
const SCAN_EXTS = /\.(ts|mts|js|mjs)$/
const TESTISH = /(\.test\.|\.spec\.|__tests__|[/\\]tests[/\\])/

/**
 * 什么算一个凭据词元(整词比对,非子串)。
 * `key` 在内是**量出来的**,不是拍脑袋:HEAD 面真实存在的两处豁免之一是
 * `apps/api/src/plugins/csrf.ts` 的 `if (request.headers['x-goog-api-key']) return`
 * —— Gemini SDK 的 API key 头;漏掉 `key` 这个词元,本门对**自己要防的那一型**直接失明
 * (第一版就是这么漏的,由自检的"真仓必须看得见存量"条款抓到)。
 * 误报由"必须在安全面内 + 体必须是裸 return"两道收窄兜住。
 */
const CREDENTIAL_TOKENS = new Set([
  'token',
  'key',
  'apikey',
  'secret',
  'authorization',
  'credential',
  'credentials',
  'password',
  'bearer',
  'signature',
])

/**
 * 引用形态:request.headers['x-a'] / request.headers.xFOO / req.cookies?.auth_token / getHeader('x-a')
 * **以及 `request.query` 这一面**(G-1038449 补):query 与 headers/cookies 同为"客户端可控的凭据入口",
 * Gemini SDK 的 `?key=` 就落在这里。原先只认 headers/cookies/getHeader ⇒ `csrf.ts:250` 那处对门完全隐形。
 * query 分支留了一格**类型断言位**(`as { … } | undefined`),与下面 IDENT 那条(`request as FastifyRequest & {…}`)
 * 同课:断言会把形态打断,不留这格就得为某一行的具体类型写法开特例。
 */
const REF_RE =
  /(?:request|req)\s*\.\s*headers\s*(?:\[[^\]]+\]|\.\s*[A-Za-z_$][\w$]*)|(?:request|req)\s*\.\s*cookies\s*(?:\?\.|\.)\s*[A-Za-z_$][\w$]*|(?:request|req)\s*\.\s*query(?:\s+as\s+[^)]*\))?\s*(?:\?\.|\.)\s*[A-Za-z_$][\w$]*|\bgetHeader\s*\(\s*['"][^'"]+['"]/g
const NAME_PIECES_RE = /['"]([^'"]+)['"]|\.\s*([A-Za-z_$][\w$]*)/g

/**
 * 条件里出现这些 ⇒ 已做值判定/验真,不属"存在性豁免"(设计约束 1)。
 *
 * **G-1038449 收窄**:`===`/`!==`/`==`/`!=` 本身**不再**算验真 —— 只有"值比较**有比较对象**"
 * 才算(右端不是裸字面量/`undefined`/`null`)。原因:`typeof (request.query as {…}|undefined)?.key === 'string'`
 * 这种**裸类型比较**一个值都没比,却被旧口径当成"已验真"放过 ⇒ `csrf.ts:250` 那处存在性豁免
 * 对门隐形(成因②)。收窄方向只有一条:形态/类型判断**不是**验真;`x === process.env.SECRET`
 * 这类真值比较仍放过(见 --self-test CB4)。
 *
 * ⚠ 这一支有两条退路,窄化 `===` 时各踩过一次,都记在这里:
 *  ① 写成 `===\s*(?!…)`,`\s*` 会**零宽回溯**(吃 0 个空白后前瞻看的是空格 ⇒ 前瞻通过)
 *     ⇒ 否定前瞻必须自带 `\s*`。
 *  ② 没有**左侧前瞻**时,`===` 会被退化成 `==` 只吃前两个 `=`,第三个 `=` 成了"比较对象"
 *     ⇒ 前缀失守。必须同时写 `(?<![=!<>])`(不从半个运算符中间起跳)与 `(?!=)`(不吃短的)。
 *  少了任一条,`=== 'string'` 都会重新被当成"有比较对象的值比较",250 原样漏过(已实测)。
 */
const VERIFIED_RE =
  /(?<![=!<>])(?:===|!==|==|!=)(?!=)(?!\s*'[^']*')(?!\s*"[^"]*")(?!\s*undefined\b)(?!\s*null\b)|secretsEqual|timingSafeEqual|isVerified|verifyCsrfToken|isPlausibleBearerCredential|startsWith\s*\(|\bhas\s*\(/

/**
 * **类型守卫**:`typeof (…)?.k === 'string'` / `typeof x === 'number'`。
 * 它是"引用在场且是这一型"的**修饰**,不是"条件里还有别的判定" —— 所以算残余文本时必须整块剥掉,
 * 否则 `csrf.ts:250` 会先被"条件里还有别的东西 ⇒ 已判定"提前放过,永远走不到名字与 enforcement 那一格。
 * 剥掉之后是否仍算豁免,由 `VERIFIED_RE` 判(它已被收窄成"类型比较不算验真")。
 */
const TYPE_GUARD_RE =
  /\btypeof\s*\(\s*[\s\S]{0,200}?\)\s*(?:\?\.|\.)\s*[A-Za-z_$][\w$]*\s*(?:===|!==|==|!=)\s*(?:'[^']*'|"[^"]*"|undefined\b|null\b)|\btypeof\s+[A-Za-z_$][\w$.[\]]*\s*(?:===|!==|==|!=)\s*(?:'[^']*'|"[^"]*"|undefined\b|null\b)/g

const EXEMPT_RE = /credential-presence-exempt:\s*(\S.*)$/

export function credentialTokensOf(name) {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export function isCredentialName(name) {
  return credentialTokensOf(name).some((t) => CREDENTIAL_TOKENS.has(t))
}

export function namesOfRef(ref) {
  const out = []
  for (const m of ref.matchAll(NAME_PIECES_RE)) {
    const v = m[1] ?? m[2]
    // `query` 与 headers/cookies 同级(都是传输面),不是凭据名 —— 不排掉它,
    // `request.query.page` 会被当成"取出了凭据名 page",把非凭据族判成豁免。
    if (v && !['headers', 'cookies', 'query', 'request', 'req'].includes(v)) out.push(v)
  }
  return out
}

/** 从 `openLine/openCol`(指向 '(' 本身)配平取条件文本与闭括号位置;算不出返回 null ⇒ 未判定 */
export function readCondition(lines, openLine, openCol) {
  let depth = 0
  let text = ''
  let first = true
  for (let i = openLine; i < lines.length && i < openLine + 30; i++) {
    const line = lines[i]
    for (let j = i === openLine ? openCol : 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        // 条件文本**不含**最外层括号:留着它,"去掉引用后还剩什么"的判据会把
        // 一个空条件读成"还剩一个 )",于是所有命中都被自己放行(本门第一版即此错)。
        if (depth === 0) return { cond: text, endLine: i, endCol: j }
      }
      if (first && ch === '(') {
        first = false
        continue
      }
      text += ch
    }
    if (depth > 0) text += '\n'
  }
  return null
}

/**
 * 该 `if` 之后、同一函数体内是否还有**执行动作**(抛错 / 4xx / 调验真)。
 * 为什么必须有这一维:光看"凭据头在场就 return"会把 `mapGeminiAuth` 那种**映射短路**
 * (已有 Authorization 就什么都不做)判成豁免,而它后面没有任何防线可跳 —— 假阳指使人
 * 去"修"没坏的东西,还会把判据口径说歪成"很多"。反过来,只有"跳过的是一段 enforcement"
 * 才是 #23 那种"把防线换成一个字符串"。
 * 返回 true/false;算不出(找不到函数收尾)⇒ null ⇒ 落未判定,不猜。
 */
const ENFORCE_RE =
  /\bthrow\b|status\(\s*4\d\d|\bcode\(\s*4\d\d|reply\.send\(\s*\{[^}]*code:\s*4|Forbidden|Unauthorized|\bverify[A-Z]\w*\s*\(|isVerified\w*\s*\(|checkInternalServiceToken|401|403/

export function enforcementFollows(lines, idx) {
  const indent = lines[idx].search(/\S/)
  for (let i = idx + 1; i < lines.length && i <= idx + 80; i++) {
    const line = lines[i]
    if (line.trim() === '') continue
    const cur = line.search(/\S/)
    if (cur >= 0 && cur <= indent && /^\}/.test(line.trim())) {
      return ENFORCE_RE.test(lines.slice(idx + 1, i).join('\n'))
    }
  }
  return null
}

/** 闭括号之后跳过 `{`/空白,判断体是否以裸 `return` 开头;算不出返回 null */

export function bodyIsBareReturn(lines, endLine, endCol) {
  for (let i = endLine; i <= endLine + 2 && i < lines.length; i++) {
    const rest = (lines[i] ?? '').slice(i === endLine ? endCol + 1 : 0).replace(/^[\s{;]+/, '')
    if (rest === '') continue
    return /^return\b/.test(rest)
  }
  return null
}

/**
 * 判一个文件。`rel` 只用于点名。返回 findings(候选红)与 undetermined(判不出)。
 * 代码面用 maskCommentsAndStrings(注释与字符串等长遮罩 ⇒ 行号不变,标记在原文行上判)。
 */
export function scanSource(rel, src) {
  const findings = []
  const undetermined = []
  const rawLines = src.split('\n')
  // 两层遮罩,方向不同,不能用错(本仓在"认导入 vs 认 readFileSync"上记过同一条教训):
  //  · code = **只遮注释、保留字符串** —— 头名/cookie 名住在字符串字面量里,连字符串一起抹
  //    会让本门对"自己要防的那一型"完全失明(第一版就错在这里,CB1 当场不命中);
  //  · noStr = 注释与字符串都遮 —— 用来判"这个 `if (` 是不是写在字符串里的示例文本"。
  const code = maskComments(src).split('\n')
  const noStr = maskCommentsAndStrings(src).split('\n')
  const lines = code
  // 一跳变量:条件是个裸标识符时,回看它的声明。刻意**不**要求"声明与引用同一行" ——
  // 真仓的 cookie 豁免就写成 `const authToken = (request as FastifyRequest & {...}).cookies\n  ?.auth_token`
  // (带类型断言 + 跨行),只判单行的话这一处会静默漏掉,而它恰是本门要裁的形态。
  const refForIdentifier = (idx, name) => {
    const from = Math.max(0, idx - 12)
    const window = lines.slice(from, idx + 1).join('\n')
    const m = window.match(new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\s*=([\\s\\S]{0,300})`))
    if (!m) return null
    const scope = m[1]
    const refs = [...scope.matchAll(REF_RE)].map((x) => x[0])
    if (refs.length === 1) return refs[0]
    // 真仓 csrf.ts 的 cookie 豁免写成 `= (request as FastifyRequest & {…}).cookies` 换行 `?.auth_token`
    // —— 类型断言把 REF_RE 打断。跨行拼回这个名字,否则本门对"最像本型的那一处"直接失明。
    const hop = scope.match(/\b(headers|cookies|query)\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)/)
    if (hop) return `request.${hop[1]}.${hop[2]}`
    return null
  }
  /** 声明窗口里到底有没有出现过 headers/cookies/query —— 没有就不是本型(别把 DB 变量报成未判定) */
  const mentionsTransport = (idx, name) => {
    const from = Math.max(0, idx - 12)
    const window = lines.slice(from, idx + 1).join('\n')
    const m = window.match(new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\s*=([\\s\\S]{0,300})`))
    return m ? /\b(headers|cookies|query)\b/.test(m[1]) : false
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let k = -1
    while ((k = line.indexOf('if (', k + 1)) >= 0) {
      // 该 `if (` 在"连字符串一起遮"的面上是空白 ⇒ 它本来住在字符串字面量里(示例文本/文档),不算代码
      if (!((noStr[i] ?? '').slice(k, k + 4).trim())) continue
      const before = line.slice(0, k).trimEnd()
      if (before !== '' && !/[{};:]$/.test(before) && !/\belse$/.test(before)) continue
      const rc = readCondition(lines, i, k + 3)
      if (!rc) {
        undetermined.push(`${rel}:${i + 1} if 条件括号配平失败 ⇒ 判不出,不猜`)
        continue
      }
      const cond = rc.cond
      let refs = [...cond.matchAll(REF_RE)].map((x) => x[0])
      let condForRest = cond
      if (refs.length === 0) {
        const id = cond.trim().match(/^[A-Za-z_$][\w$]*$/)
        const hop = id ? refForIdentifier(i, id[0]) : null
        if (hop) {
          refs = [hop]
          condForRest = ''
        } else if (id && isCredentialName(id[0]) && mentionsTransport(i, id[0])) {
          // 变量名自带凭据语义、但回溯不到引用(真仓 csrf.ts 的 cookie 豁免就是
          // `const authToken = (request as ... ).cookies` + 换行 `?.auth_token`)。
          // 这一格**必须报名**:静默跳过等于"门看不见 ⇒ 报告一切正常",而它恰是本门立项那一型。
          undetermined.push(
            `${rel}:${i + 1} 条件变量 ${id[0]} 名字属凭据族,但回溯不到引用 ⇒ 判不出是否凭据族`,
          )
          continue
        }
      }
      if (refs.length !== 1) continue // 多引用/无引用不属本型
      // 残余文本判定:`typeof (…)?.k === 'string'` 这类**类型守卫**是"引用在场且是这一型"的修饰,
      // 不是"条件里还有别的判定" ⇒ 先整块剥掉,否则 250 会在这里被提前放过(判据写歪的修法:
      // 若改剥 REF_RE 之外的任何东西,`csrf.ts:222` 的 isPlausibleBearerCredential 形态也会跟着漂)。
      const residual = condForRest.replace(TYPE_GUARD_RE, '').replace(REF_RE, '').trim()
      if (residual !== '') continue // 条件里还有别的东西 ⇒ 已判定
      if (VERIFIED_RE.test(cond)) continue
      const names = namesOfRef(refs[0])
      if (names.length === 0) {
        undetermined.push(`${rel}:${i + 1} 取不出头名/cookie 名 ⇒ 判不出是否凭据族`)
        continue
      }
      if (!names.some(isCredentialName)) continue
      const bare = bodyIsBareReturn(lines, rc.endLine, rc.endCol)
      if (bare === null) {
        undetermined.push(`${rel}:${i + 1} if 体起始形态算不出(跨行)⇒ 判不出`)
        continue
      }
      if (!bare) continue
      const enf = enforcementFollows(lines, i)
      if (enf === null) {
        undetermined.push(`${rel}:${i + 1} 找不到该函数收尾 ⇒ 判不出"跳过的是不是一段执行动作"`)
        continue
      }
      if (!enf) continue // 后面没有 enforcement ⇒ 这是控制流短路,不是"把防线换成一个字符串"
      const marked = EXEMPT_RE.test(rawLines[i] ?? '') || EXEMPT_RE.test((rawLines[i - 1] ?? '').trim())
      if (marked) continue
      findings.push({ file: rel, line: i + 1, ref: refs[0], names })
    }
  }
  return { findings, undetermined }
}

export function readLedger(raw) {
  if (typeof raw !== 'string') return { byKey: new Map(), absent: true, broken: null }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return { byKey: new Map(), absent: false, broken: `台账 JSON 解析失败:${String(e.message).split('\n')[0]}` }
  }
  const byKey = new Map()
  for (const e of parsed.exemptions ?? []) {
    if (!e.file || !e.anchor || !e.reason || !e.reviewBy) {
      return { byKey: new Map(), absent: false, broken: `台账条目字段不齐(${e?.file ?? '?'}):reason 与 reviewBy 都必填` }
    }
    byKey.set(`${e.file}#${e.anchor}`, e)
  }
  return { byKey, absent: false, broken: null }
}

/**
 * 判定核心(纯函数,可用构造面证明"豁免不得静默、腐烂必红、过期必红")。
 * `absent` 时不做腐烂判定 —— 台账不在被审面上是"零豁免",不是"清单腐烂"。
 * `scanned`(G-815985 补):实际被审查的文件集。腐烂只能判"看了却没命中",
 * 不能判"没看" —— 否则 --staged 下任何不带 csrf.ts 的提交都恒红(本门自述
 * "只判本次带进来的路径",恒红门的唯一结局是逼人 --no-verify,§12e)。
 * 传 null = 整面已审(全量/HEAD 档,真腐烂仍必红)。
 */
export function decide({ findings, ledger, today, absent, scanned = null }) {
  const violations = []
  const expired = []
  let exempted = 0
  const hit = new Set()
  for (const f of findings) {
    const key = `${f.file}#${f.ref}`
    const e = ledger.get(key)
    if (e && (!String(e.reason).trim() || !e.reviewBy)) {
      violations.push({ ...f, why: '台账条目缺原因或复核日' })
      continue
    }
    if (e) {
      if (e.reviewBy < today) {
        expired.push(`${key} 复核日 ${e.reviewBy} 已过 ⇒ 必须重新裁一次或改成行内豁免`)
        continue
      }
      hit.add(key)
      exempted++
      continue
    }
    violations.push({ ...f, why: '未裁过:既无台账条目也无行内标记' })
  }
  const stale = []
  if (!absent) {
    for (const [key, e] of ledger)
      if (
        !hit.has(key) &&
        !expired.some((s) => s.startsWith(key)) &&
        (scanned === null || scanned.has(e.file))
      )
        stale.push(key)
  }
  return { violations, exempted, stale, expired }
}

/**
 * `--staged` 档只判本次带进来的路径。
 * 为什么不照全量那样判整张索引面:那正是守门 150 被登记成 G-458 的形状 —— 存量红期间,
 * 任何触及射程的提交都会拿到一道它自己**无法清偿**的红,唯一出路是跳钩子,连带其余全部
 * 守门对该提交作废(§12e/§12f)。清单按"暂存 ∩ 候选"收窄,内容仍取索引 blob。
 */
function stagedPaths() {
  return execFileSync(
    gitBinary(),
    ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'],
    { cwd: ROOT, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, maxBuffer: 1 << 26, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
    .split(/\r?\n/)
    .filter(Boolean)
}

function listFiles(face) {
  const args =
    face === 'staged'
      ? ['ls-files', '--', ...SCAN_DIRS]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCAN_DIRS]
  return execFileSync(gitBinary(), ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 1 << 26,
    windowsHide: true,
    // EBUSY 根治(errno -4082):本机会话里 Node 建子进程 stdin 管道确定性失败。
    // 调用点全为只读 git(ls-files / diff --cached),不喂 stdin。
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split(/\r?\n/)
    .filter((p) => p && (SCAN_EXTS.test(p) || p === 'apps/api/src/server.ts') && !TESTISH.test(p))
}

export function analyze({ face, root = ROOT }) {
  const isWorktree = face === 'worktree'
  let files
  try {
    files = isWorktree
      ? execFileSync(gitBinary(), ['-c', 'safe.directory=*', 'ls-files', '--', ...SCAN_DIRS], {
          cwd: root,
          encoding: 'utf8',
          timeout: GIT_TIMEOUT_MS,
          maxBuffer: 1 << 26,
          windowsHide: true,
        })
          .split(/\r?\n/)
          .filter((p) => p && SCAN_EXTS.test(p) && !TESTISH.test(p))
      : listFiles(face)
    if (face === 'staged') {
      const st = new Set(stagedPaths())
      files = files.filter((p) => st.has(p))
    }
  } catch (e) {
    throw new Error(`文件清单取不到:${String(e.message).split('\n')[0]}`)
  }
  const pre = face === 'staged' ? ':' : 'HEAD:'
  const specs = isWorktree ? [] : files.map((p) => `${pre}${p}`)
  let contents
  try {
    contents = isWorktree ? new Map() : catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT_MS })
  } catch (e) {
    throw new Error(`内容取不到:${String(e.message).split('\n')[0]}`)
  }
  const findings = []
  const undetermined = []
  let unreadable = 0
  for (const rel of files) {
    let src
    if (isWorktree) {
      const r = readWorktreeFile(root, rel)
      src = typeof r === 'string' ? r : null
    } else {
      src = contents.get(`${pre}${rel}`) ?? null
    }
    if (typeof src !== 'string') {
      unreadable++
      undetermined.push(`${rel} 该面取不到内容 ⇒ 未判定(不回落另一个面)`)
      continue
    }
    const r = scanSource(rel, src)
    findings.push(...r.findings)
    undetermined.push(...r.undetermined)
  }
  let ledgerRaw
  if (isWorktree) {
    // 仍走层的读取入口(而不是在本门里 readFileSync)—— 否则"人工逃生舱"这一档
    // 就成了"按磁盘判被审内容"的合法外衣,守门 118 判的正是这一型。
    ledgerRaw = readWorktreeFile(root, LEDGER_FILE)
  } else {
    try {
      const m = catBatch(root, [`${pre}${LEDGER_FILE}`], { maxBuffer: 1 << 27, timeout: GIT_TIMEOUT_MS })
      ledgerRaw = m.get(`${pre}${LEDGER_FILE}`) ?? null
    } catch (e) {
      throw new Error(`台账取不到:${String(e.message).split('\n')[0]}`)
    }
  }
  const ledger = readLedger(ledgerRaw)
  if (ledger.broken) throw new Error(ledger.broken)
  const today = new Date().toISOString().slice(0, 10)
  // --staged 只把"暂存 ∩ 候选"当审查面:台账条目若落在面外,判腐烂就是逼每次提交都带 csrf.ts。
  const res = decide({
    findings,
    ledger: ledger.byKey,
    today,
    absent: ledger.absent,
    scanned: face === 'staged' ? new Set(files) : null,
  })
  return { files, findings, undetermined, unreadable, ledgerLoaded: !ledger.absent, ...res }
}

function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, cond, extra = '') => {
    if (cond) {
      pass++
      console.log(`✅ ${name}`)
    } else {
      fail++
      console.log(`${C.red}❌ ${name}${extra ? ` —— ${extra}` : ''}${C.reset}`)
    }
  }
  const BAD = `async function h(request, reply){
  if (request.headers['x-internal-service-token']) return
  if (!verifyCsrfToken(a, b)) {
    return reply.status(403).send({ code: 403 })
  }
}`
  const MAPPING_ONLY = `async function mapGeminiAuth(request){
  if (request.headers.authorization) return
  const goog = request.headers['x-goog-api-key']
  if (goog) request.headers.authorization = 'Bearer ' + goog
}`
  const IDENT = `async function h(request, reply){
  const authToken = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies
    ?.auth_token
  if (authToken) return
  if (!verifyCsrfToken(a, b)) return reply.status(403).send(1)
}`
  const IN_COMMENT = `async function h(request, reply){
  // 说明:原先写成 if (request.headers['x-internal-service-token']) return 是错的
  return reply.send(1)
}`
  const NONCRED = `async function h(request, reply){
  if (request.headers['x-request-id']) return
}`
  const COMPARE = `async function h(request, reply){
  if (request.headers['x-internal-service-token'] === process.env.SECRET) return
}`
  const VARHOP = `async function h(request, reply){
  const tk = request.headers['x-tenant-token']
  if (tk) return
  if (!verifySession(tk)) return reply.status(401).send(1)
}`
  const MARKED = `async function h(request, reply){
  // credential-presence-exempt: 路由侧 preHandler 已强制该头对应的密钥验真
  if (request.headers['x-goog-api-key']) return
  if (!verifyCsrfToken(a, b)) return reply.status(403).send(1)
}`
  const UNMARKED_NO_REASON = `async function h(request, reply){
  // credential-presence-exempt:
  if (request.headers['x-goog-api-key']) return
  if (!verifyCsrfToken(a, b)) return reply.status(403).send(1)
}`
  const IN_STRING = `async function h(request, reply){
  const doc = "if (request.headers['x-internal-service-token']) return"
  return doc
}`
  const FIXED = `async function h(request, reply){
  if (await isVerifiedInternalMachineCall(request)) return
  if (!verifyCsrfToken(a, b)) return reply.status(403).send(1)
}`
  const s = (src) => scanSource('a.ts', src)
  t('CB1 存在性豁免必须命中(核心阳性)', s(BAD).findings.length === 1, JSON.stringify(s(BAD)))
  t('CB2 #23 修法形态必须放过(判据要覆盖门认可的写法)', s(FIXED).findings.length === 0)
  t('CB3 非凭据族头放过', s(NONCRED).findings.length === 0)
  t('CB4 带值比较放过', s(COMPARE).findings.length === 0)
  t('CB5 一跳变量形态必须命中(提成变量不该让门失明)', s(VARHOP).findings.length === 1, JSON.stringify(s(VARHOP)))
  t('CB6 注释里的该形态不得计入', s(IN_COMMENT).findings.length === 0)
  t('CB7 字符串里的该形态不得计入', s(IN_STRING).findings.length === 0)
  t('CB8 带原因的行内豁免放过', s(MARKED).findings.length === 0)
  t('CB9 裸标记(无原因)不得放过', s(UNMARKED_NO_REASON).findings.length === 1)
  t('CB10 词元匹配非子串', !isCredentialName('hashtag') && !isCredentialName('tokenizer') && isCredentialName('x-id-token'))
  const f0 = s(BAD).findings[0]
  const key = `a.ts#${f0.ref}`
  t('CB11 未裁过 ⇒ 红', decide({ findings: [f0], ledger: new Map(), today: '2026-09-28', absent: false }).violations.length === 1)
  t('CB12 台账齐备 ⇒ 豁免且不销案', decide({ findings: [f0], ledger: new Map([[key, { file: 'a.ts', anchor: f0.ref, reason: '另有验真', reviewBy: '2026-12-31' }]]), today: '2026-09-28', absent: false }).violations.length === 0)
  t('CB13 台账缺原因/复核日 ⇒ 不得放过', decide({ findings: [f0], ledger: new Map([[key, { file: 'a.ts', anchor: f0.ref, reason: '', reviewBy: '' }]]), today: '2026-09-28', absent: false }).violations.length === 1)
  t('CB14 复核日过期 ⇒ 仍判(红或过期,绝不静默放过)', decide({ findings: [f0], ledger: new Map([[key, { file: 'a.ts', anchor: f0.ref, reason: 'x', reviewBy: '2026-01-01' }]]), today: '2026-09-28', absent: false }).expired.length === 1)
  t('CB15 台账腐烂(登记了而面上没命中)必红', decide({ findings: [], ledger: new Map([[key, { file: 'a.ts', anchor: f0.ref, reason: 'x', reviewBy: '2026-12-31' }]]), today: '2026-09-28', absent: false, scanned: new Set(['a.ts']) }).stale.length === 1)
  t('CB15b 台账条目落在审查面外 ⇒ 不判腐烂(否则 --staged 下不带 csrf.ts 的提交恒红)', decide({ findings: [], ledger: new Map([[key, { file: 'a.ts', anchor: f0.ref, reason: 'x', reviewBy: '2026-12-31' }]]), today: '2026-09-28', absent: false, scanned: new Set(['b.ts']) }).stale.length === 0)
  t('CB16 台账缺席按零豁免判,不把腐烂当结论', decide({ findings: [], ledger: new Map([[key, { file: 'a.ts', anchor: f0.ref, reason: 'x', reviewBy: '2026-12-31' }]]), today: '2026-09-28', absent: true }).stale.length === 0)
  t('CB17 坏台账不得被当成空台账放行', readLedger('{ not json').broken !== null)
  t('CB18 条目字段不齐 ⇒  broken(不静默当空表)', readLedger('{"exemptions":[{"file":"a.ts","anchor":"x"}]}').broken !== null)
  t('CB19 遮罩后行号不变(标记按原文行判的前提)', maskCommentsAndStrings('a\n// x\nb').split('\n').length === 3)
  // ↓ 三条新维度:假阳收窄与"看不见必须报名",缺一条本门就要么咬错人、要么对自己立项那一型失明
  t('CB20 映射短路(后面没有执行动作)不得判红', s(MAPPING_ONLY).findings.length === 0, JSON.stringify(s(MAPPING_ONLY)))
  t('CB21 一跳变量带 enforcement 必须命中', s(VARHOP).findings.length === 1, JSON.stringify(s(VARHOP)))
  t('CB22 跨行 + 类型断言的 cookie 豁免必须被命中(第一版对此失明)', s(IDENT).findings.length === 1, JSON.stringify(s(IDENT)))
  const DBVAR = `async function h(request, reply){
  const apiKey = await resolveApiKeyFromDb(id)
  if (apiKey) return
  if (!verifyScope(apiKey)) return reply.status(403).send(1)
}`
  t('CB23 名字像凭据但声明里不含 headers/cookies ⇒ 不属本型,也不得报成未判定(30 条噪声会淹掉信号)', s(DBVAR).findings.length === 0 && s(DBVAR).undetermined.length === 0, JSON.stringify(s(DBVAR)))
  return { pass, fail }
}

function main(argv) {
  if (argv.includes('--self-test')) {
    const { pass, fail } = selfTest()
    console.log(`\n[credential-presence] 自检 ${pass} 通过 / ${fail} 失败`)
    if (fail > 0) return 1
    // 自检跑在被审面上:真仓 HEAD 必须至少看得见已裁过的站点(看不见 = 门空转)
    try {
      const a = analyze({ face: 'head' })
      if (a.exempted === 0 && a.findings.length === 0) {
        console.log(`${C.red}❌ 自检:真仓 HEAD 面既无命中也无豁免 ⇒ 判据可能失明,不记通过${C.reset}`)
        return 1
      }
      console.log(`✅ 自检真仓对照:命中候选 ${a.findings.length} 处 / 台账豁免 ${a.exempted} 处 / 扫 ${a.files.length} 文件`)
    } catch (e) {
      console.log(`${C.red}❌ 自检真仓对照跑不动:${e.message}${C.reset}`)
      return 2
    }
    return 0
  }
  const sel = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (sel.error) {
    console.error(`${C.red}❌ ${sel.error}${C.reset}`)
    return 2
  }
  const face = sel.face
  let a
  try {
    a = analyze({ face })
  } catch (e) {
    console.error(`${C.red}❌ 无法判定(不冒红也不记绿):${e.message}${C.reset}`)
    return 2
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ face, ...a }, null, 2))
  } else {
    if (a.files.length === 0 && face === 'staged') {
      console.log(
        `${C.cyan}[credential-presence] 判定面=staged:本次没有射程内(apps/api 安全面)文件 ⇒ 本门不适用,不是"已判定干净"。${C.reset}`,
      )
      return 0
    }
    if (a.files.length === 0) {
      console.error(`${C.red}❌ 枚举到 0 个候选文件 ⇒ 判据失明,不记通过${C.reset}`)
      return 2
    }
    console.log(
      `${C.cyan}[credential-presence] 判定面=${face === 'worktree' ? '工作树(仅人工)' : face}:扫 ${a.files.length} 个安全面文件;存在性豁免候选 ${a.findings.length} 处(台账豁免 ${a.exempted} 处,行内豁免已不计入候选)${C.reset}`,
    )
    if (!a.ledgerLoaded)
      console.log(`${C.yellow}⚠ 台账 ${LEDGER_FILE} 不在被审面上 ⇒ 按"零豁免"判并大声报出(缺席不等于通过)。${C.reset}`)
    for (const v of a.violations) console.log(`  ${C.red}❌ ${v.file}:${v.line} ${v.ref} —— ${v.why}${C.reset}`)
    for (const s of a.stale) console.log(`  ${C.red}❌ 清单腐烂:台账有 ${s} 而被审面没命中${C.reset}`)
    for (const s of a.expired) console.log(`  ${C.red}❌ 豁免过期:${s}${C.reset}`)
    for (const u of a.undetermined) console.log(`  ${C.yellow}ℹ 未判定:${u}${C.reset}`)
    if (a.violations.length + a.stale.length + a.expired.length === 0)
      console.log(
        a.undetermined.length > 0
          ? `${C.green}✅ 无未裁定的存在性豁免;另有 ${a.undetermined.length} 处未判定(不等于通过)。${C.reset}`
          : `${C.green}✅ 安全面内每一处"凭据存在性豁免"都已带理由裁定。${C.reset}`,
      )
  }
  const bad = a.violations.length + a.stale.length + a.expired.length
  if (bad > 0) return 1
  if (argv.includes('--strict') && a.undetermined.length > 0) return 2
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${String(e?.message ?? e)}`)
    process.exit(2)
  }
}

export const __test__ = {
  scanSource,
  decide,
  readLedger,
  selfTest,
  isCredentialName,
  namesOfRef,
  readCondition,
  bodyIsBareReturn,
  LEDGER_FILE,
  SCAN_DIRS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
