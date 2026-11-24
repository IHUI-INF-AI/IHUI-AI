// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CSRF 豁免形状对账(check-csrf-exemption-shape)。
 *
 * 立因(票 #23 的真实现场,不是假想):`apps/api/src/plugins/csrf.ts` 曾写着
 *   if (request.headers['x-internal-service-token']) return
 * —— **头名在场即整块跳过 CSRF**,等于把防线换成一个字符串:任何进程带这个头(值随意)
 * 就能免检。#23(6fb790eb70a8)把它改成 `isVerifiedInternalMachineCall(request)`
 * (唯一出口 `apps/api/src/utils/internal-principal.ts`,复用 `secretsEqual` 定长散列 +
 * timingSafeEqual,fail-closed)。但**型还在**:下一个内部凭据族照样能写成
 * `if (request.headers['x-anything']) return` / `if (process.env.ANY_SECRET) return`,
 * 而 typecheck / lint / 其余门全都不响。本门把这一型钉成尺子,并补两道同族门
 * (157 按凭据存在性豁免对账、108 凭据在场即豁免对账)都没覆盖的两格:
 *   ② **出口摘线** —— 出口本身被摘(export 不见 / 无人调用)时,①的正当形态全部消失,
 *      "没有出路"本身必须是红(157/108 都只审站点,不问出口死活);
 *   ③ **比较逻辑只许一份** —— `timingSafeEqual` 再出现第二处即红(锚点棘轮,见下),
 *      157 的 VERIFIED_RE 反而把 timingSafeEqual 当"已验真"信号放过,那一维没人看守。
 *
 * 三条判据:
 *   ① CSRF 豁免决策面(见 inCsrfSurface)里 `if (<条件>) <裸放行>` 站点,条件**只**由
 *      header/cookie/query/getHeader/process.env 键的存在性构成(剥掉 typeof 类型守卫后
 *      不剩任何值比较、不剩别的判定),且跳过的是同一函数体内一段 enforcement
 *      (4xx / verify* / throw)⇒ 红。正当形态只有两种:
 *        · 条件里调 isVerified* / hasVerified* / isServerSignedJwt / secretsEqual /
 *          timingSafeEqual / verify* 验真出口(#23 修法形态,判据必须认它,否则按规矩写就红);
 *        · 行内 `csrf-exempt: <原因>`(必须带原因,只救本行或紧邻上一纯注释行;
 *          已同笔登记进守门 108 的 FAMILY_LIFETIME_DAYS 30 天档 —— 不登记就会被 108 的 E4
 *          判成"新引入的未登记豁免族",一道门自己的合法出口被邻居钉红)。
 *      守门 157 的行内出口 `credential-presence-exempt: <原因>` **一并认**(同型已裁,
 *      不认就是两道门互咬,108 表里那一族同笔登记时记的就是这一课)。
 *   ② 验真出口存活:EXIT_DEFS 里每条出口都必须"export 在 + 至少一处调用(定义文件内的
 *      内部调用也算)"。export 不见 / 零调用 / 定义文件不在 ⇒ 判"没有出路"并参与退出码。
 *   ③ `timingSafeEqual` 在 apps/api/src 代码面(注释与字符串已遮)的出现:判据的终点状态是
 *      "只许 secretsEqual 一份",再出现第二处即红。**存量棘轮**:锚点 = 本门在同一判据下的
 *      HEAD 读数(站点键 = 文件::归一化行文本::行内序),HEAD 面存量只报数不判红
 *      (§12f 恒红门禁令:立项现读 HEAD 已有 78 处/23 文件量级存量,当场判红就是一台与任何
 *      提交都无关的恒红门,唯一结局是逼人 --no-verify、连带全部守门作废)。差值棘轮只拦
 *      "本次改动把违规加回来";存量出路只有收敛到 secretsEqual 或行内 csrf-exempt 标记。
 *
 * 口径(照抄本仓 70/77/83/98/101/103/118/135,不得自创):全量判 **HEAD blob**、`--staged`
 * 判**索引 blob**(并回退 HEAD 版本补全非暂存文件,②的调用点搜索要的是"提交后的整树")、
 * `--worktree` 仅人工逃生舱;两面旗同给判死;取不到 ⇒ "无法判定"且**不回落**另一个面;
 * 枚举到 0 个候选判死不记绿。遮罩只引 `scripts/lib/code-mask.mjs` 那一份实现。
 * 判据面保留字符串(头名/env 名住在字符串里),配平用连正则一起遮的结构面 —— 两件事各用各的面,
 * 否则"字符串里的括号把条件撑成永不闭合"会被写成"判不出"(157 的 CP1/CP5 同课)。
 *
 * ①的射程(CSRF 豁免决策面,三取其一,非测试面):
 *   · 文件名含 csrf;
 *   · 代码面引用 CSRF 豁免出口族(isVerified* / isServerSignedJwt / hasVerified*);
 *   · 注册了 preHandler/onRequest 钩子**且**代码面提到 csrf(钩子自己在做 CSRF 相关决策)。
 * 加面必须同批改本注释与 inCsrfSurface,否则会出现"扫到了但没判"的静默失明。
 *
 * 已知不判(宁漏不误报,登记清楚不等于不存在):
 *   1. 头值做 `==`/`===` 字面量/环境量比较(非常数时间比较)⇒ 不判:那一型问的是"比较是否
 *      安全",本门①问的是"有没有比较就放行",修复动作相反(守门 108 已知不判 #2 同一条理由)。
 *   2. `config.X` 存在性不判:config 是特性开关族,不是 header/env 键(守门 108 的 A6 噪声
 *      上界钉的就是这一族;真要按密钥存在性放行,判据落在"密钥验真"而不在"开关在场")。
 *   3. 前导奇数个 `!`(不适用即继续)不判;条件里混有非存在性判定(helper 调用 / 动态属性名)
 *      ⇒ 逐条落"未判定"点名,不猜。
 *   4. 出口的**改名/搬迁**必须同笔改 EXIT_DEFS:门把出口表当契约,改名即红(那是刻意的,
 *      安全出口的改名不该静默发生)。
 *
 * 用法:node scripts/check-csrf-exemption-shape.mjs [--staged|--worktree|--strict|--json|--self-test]
 * 问责:`--strict`(①存量命中 / ③存量站点即 exit 1,有未判定 exit 2);紧急跳过
 * `HUSKY_SKIP_CSRF_EXEMPTION_SHAPE=1`(注册条目 skipEnv 同名,由主会话统一接线时提供)。
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import {
  maskComments,
  maskCommentsAndStrings,
  maskCommentsStringsAndRegex,
} from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT_MS = 120_000
const SCAN_DIRS = ['apps/api/src']
const SCAN_EXTS = /\.(ts|mts|js|mjs)$/
const TESTISH = /(?:\.test\.|\.spec\.|__tests__|[/\\]tests[/\\])/

/* ----------------------------- 判据常量 ----------------------------- */

/** 本门行内出口的族名(镜像测试的跨文件锁从 `const EXEMPT_RE = /…/` 结构读出,不手抄)。 */
export const EXEMPT_FAMILY = 'csrf-exempt'
const EXEMPT_RE = /csrf-exempt:\s*(\S.*)$/
/**
 * 守门 157(check-credential-presence-bypass.mjs)的行内出口。**必须一并认**:那一族裁的
 * 是同一型缺陷,站点带了它的标记 = 已被邻居裁过;本门再判红就是"一道门自己的合法出口被
 * 另一道门钉红"(守门 108 表里 credential-presence-exempt 同笔登记时记下的互咬教训)。
 */
const FOREIGN_EXEMPT_RE = /credential-presence-exempt:\s*(\S.*)$/

/**
 * 存在性引用面(判据①的"键"):request.headers['x-a'] / request.headers.xA /
 * req.cookies?.auth_token / request.query?.key(留类型断言位)/ getHeader('x-a') /
 * **process.env.X 与 process.env['X']**(env 键 —— 守门 157 的 REF_RE 只认
 * headers/cookies/query/getHeader,`if (process.env.SECRET) return` 对那一族完全隐形)。
 */
const PRESENCE_REF_RE =
  /(?:request|req)\s*\.\s*headers\s*(?:\[[^\]]+\]|\.\s*[A-Za-z_$][\w$]*)|(?:request|req)\s*\.\s*cookies\s*(?:\?\.|\.)\s*[A-Za-z_$][\w$]*|(?:request|req)\s*\.\s*query\s*(?:\s+as\s+[^)]*\))?\s*(?:\?\.|\.)\s*[A-Za-z_$][\w$]*|\bgetHeader\s*\(\s*['"][^'"]+['"]|process\s*\.\s*env\s*(?:\[[^\]]+\]|\.\s*[A-Za-z_$][\w$]*)/g
const NAME_PIECES_RE = /['"]([^'"]+)['"]|\.\s*([A-Za-z_$][\w$]*)/g

/**
 * 条件里出现这些 ⇒ 已做值判定/验真,不属"存在性即放行"(设计约束:判据必须覆盖门认可的写法)。
 * `hasVerified*` 是 csrf.ts 自己的两个验真函数(Bearer 族 / API Key 载体族),与
 * `isVerified*`(utils/internal-principal.ts 出口)同级 —— 漏掉它,当前 HEAD 的 csrf.ts
 * 会被自己判红(按规矩写就红 = 逼人跳门)。
 */
const VERIFY_RE =
  /\b(?:secretsEqual|timingSafeEqual|isVerified\w*|isServerSignedJwt|hasVerified\w*|checkInternalServiceToken|verify\w*\s*\()/

/** 值比较 ⇒ 不是"存在性为唯一条件"(是否安全比较属另一维,本门不判,见头注已知不判 1)。 */
const CMP_RE = /===|!==|==|!=|>=|<=|\binstanceof\b/

/**
 * **类型守卫**:`typeof (…)?.k === 'string'` / `typeof x === 'number'`。它是"引用在场且是
 * 这一型"的**修饰**,不是"条件里还有别的判定" ⇒ 算残余文本时必须整块剥掉,否则
 * `csrf.ts` 历史上那处 `typeof (request.query as {…}|undefined)?.key === 'string'`
 * 会先被"条件里还有别的东西 ⇒ 已判定"提前放过(守门 157 的 T12 同课)。
 */
const TYPE_GUARD_RE =
  /\btypeof\s*\(\s*[\s\S]{0,200}?\)\s*(?:\?\.|\.)\s*[A-Za-z_$][\w$]*\s*(?:===|!==|==|!=)\s*(?:'[^']*'|"[^"]*"|undefined\b|null\b)|\btypeof\s+[A-Za-z_$][\w$.[\]]*\s*(?:===|!==|==|!=)\s*(?:'[^']*'|"[^"]*"|undefined\b|null\b)/g

/**
 * 裸放行语句:return / return true / return [await] next() / continue [label]。
 * `continue` 于安全钩子的策略循环里与 return 同义(跳过本条校验),守门 108 的 B 维同一条。
 * 刻意不含 return false(回给框架的语义不是"跳过校验")、break、`return void 0` 表达式形态。
 */
const PASS_STMT_RE =
  /^(?:return(?:\s*(?:true|(?:await\s+)?next\s*\([^()]*\)))?|continue(?:\s+[A-Za-z_$][\w$]*)?)\s*;?$/

/**
 * 该 `if` 之后、同一函数体内是否还有**执行动作**(抛错 / 4xx / 调验真)。
 * 为什么必须有这一维:光看"键在场就 return"会把映射短路(已有 Authorization 就什么都不做)
 * 判成豁免,而它后面没有任何防线可跳 —— 假阳指使人去"修"没坏的东西(守门 157 的 CB20 同课)。
 */
const ENFORCE_RE =
  /\bthrow\b|status\(\s*4\d\d|\bcode\(\s*4\d\d|reply\.send\(\s*\{[^}]*code:\s*4|Forbidden|Unauthorized|\bverify[A-Z]\w*\s*\(|isVerified\w*\s*\(|checkInternalServiceToken|secretsEqual|timingSafeEqual|401|403/

/** CSRF 豁免出口族:代码面出现这些名字 ⇒ 该文件在 CSRF 豁免决策面上(判据①射程第二律)。 */
const CSRF_EXIT_REF_RE =
  /\b(?:isVerifiedInternalMachineCall|isVerifiedInternalServiceCall|isVerifiedAgentControlInternalCall|isServerSignedJwt|hasVerifiedApiKeyCarrier|hasVerifiedBearerCredential)\b/
/** preHandler/onRequest 钩子注册(判据①射程第三律的一半)。 */
const HOOK_RE = /addHook\s*\(\s*['"](?:preHandler|onRequest)['"]/

/** 判据②的出口表:**契约**。改名/搬迁必须同笔改这里(见头注已知不判 4)。 */
export const EXIT_DEFS = [
  {
    file: 'apps/api/src/utils/internal-principal.ts',
    name: 'isVerifiedInternalMachineCall',
    why: 'CSRF 钩子对"内部机器调用"的豁免出口(#23 收口后唯一通道,覆盖两族内部凭据)',
  },
  {
    file: 'apps/api/src/utils/internal-principal.ts',
    name: 'isVerifiedInternalServiceCall',
    why: 'X-Internal-Service-Token 族验真出口(与路由侧 checkInternalServiceToken 同源实现)',
  },
  {
    file: 'apps/api/src/utils/internal-principal.ts',
    name: 'isVerifiedAgentControlInternalCall',
    why: '控制面 Bearer 密钥族验真出口(routes/agent-control.ts 的 /execute)',
  },
  {
    file: 'apps/api/src/utils/csrf-exempt-credential.ts',
    name: 'isServerSignedJwt',
    why: '服务端签发 JWT 验签出口(csrf 的 Bearer 族与 auth_token cookie 族判据)',
  },
]

/* ------------------------------- 阳性对照锚(历史 blob) ------------------------------- */

/** 票 #23 的修复提交;其父版本的 csrf.ts 就是"存在性即豁免"的现场(判据必须点名它)。 */
const PROBE_REV_BEFORE = '6fb790eb70a8^'
const PROBE_REV_AFTER = '6fb790eb70a8'
const PROBE_FILE = 'apps/api/src/plugins/csrf.ts'
const PROBE_TOKEN = 'x-internal-service-token'
const PROBE_IP_FILE = 'apps/api/src/utils/internal-principal.ts'

/* ------------------------------- 纯函数:① ------------------------------- */

export function namesOfRef(ref) {
  const out = []
  for (const m of String(ref).matchAll(NAME_PIECES_RE)) {
    const v = m[1] ?? m[2]
    // headers/cookies/query/request/req 是传输面,不是键名 —— 不排掉 query 会被当成"取出了键名"
    if (v && !['headers', 'cookies', 'query', 'request', 'req', 'env'].includes(v)) out.push(v)
  }
  return out
}

/**
 * 从 `openLine/openCol`(指向 '(' 本身)配平取条件文本与闭括号位置;算不出返回 null ⇒ 未判定。
 * `structure` 是**等长的字符串遮罩面**(连正则一起遮):深度只按语法括号数,字符串/正则里的
 * `(` 不得把条件撑成永不闭合(守门 157 的 CP1/CP5 同一课;本门自带一份是因为分支体还要做
 * 花括号配平,两件事放进一个出口会互相牵拽 —— 配平口径与 157 逐字同形)。
 */
export function readCondition(lines, openLine, openCol, structure = null) {
  let depth = 0
  let text = ''
  let first = true
  for (let i = openLine; i < lines.length && i < openLine + 30; i++) {
    const line = lines[i]
    const sLine = structure ? (structure[i] ?? '') : line
    for (let j = i === openLine ? openCol : 0; j < line.length; j++) {
      const ch = line[j]
      const sCh = sLine[j] ?? ch
      if (sCh === '(') depth++
      else if (sCh === ')') {
        depth--
        // 条件文本**不含**最外层括号:留着它,"去掉引用后还剩什么"的判据会把一个空条件读成
        // "还剩一个 )",于是所有命中都被自己放行(守门 157 第一版即此错)。
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
 * 闭括号之后跳过空白与 `{`,判断分支是不是**整块裸放行**(空块也算:if (presence) {}
 * 同样跳过了后续校验 —— 守门 108 同口径)。两段式:先看**第一条语句**是不是放行语句,
 * 不是即可判 false(不必把块尾配平出来 —— 真仓 auth-extended.ts:2700 那种几十行的
 * fetch 块会把配平窗口撑爆,落成"判不出",而它第一句就不是放行);是,才配平块尾逐句核。
 * 算不出返回 null ⇒ 未判定。
 */
export function bodyIsBarePass(lines, endLine, endCol, structure = null) {
  const maxLine = Math.min(lines.length - 1, endLine + 3)
  let i = endLine
  let j = endCol + 1
  for (;;) {
    const line = lines[i] ?? ''
    while (j < line.length && /[ \t]/.test(line[j])) j++
    if (j < line.length) break
    i += 1
    j = 0
    if (i > maxLine) return null
  }
  const sLine = structure ? (structure[i] ?? '') : (lines[i] ?? '')
  const first = sLine[j] ?? (lines[i] ?? '')[j]
  if (first !== '{') {
    const rest = (lines[i] ?? '').slice(j).split(';')[0]
    return PASS_STMT_RE.test(rest.trim())
  }
  // 第一条语句(到行尾或第一个分号):不是放行语句 ⇒ 整块不是裸放行,立刻判 false
  const headText = (lines[i] ?? '').slice(j + 1)
  const firstStmt = headText.split(/[;\n]/)[0].trim()
  if (firstStmt !== '' && !PASS_STMT_RE.test(firstStmt)) return false
  // 第一条是放行语句(或空)⇒ 配平块尾,逐句核(全放行才算;空块同样算跳过)
  let depth = 0
  let endR = -1
  let endC = -1
  outer: for (let r = i; r < lines.length && r < i + 60; r++) {
    const sl = structure ? (structure[r] ?? '') : (lines[r] ?? '')
    for (let c = r === i ? j : 0; c < sl.length; c++) {
      if (sl[c] === '{') depth++
      else if (sl[c] === '}') {
        depth--
        if (depth === 0) {
          endR = r
          endC = c
          break outer
        }
      }
    }
  }
  if (endR < 0) return null
  let frag
  if (endR === i) frag = (lines[i] ?? '').slice(j + 1, endC)
  else {
    frag = (lines[i] ?? '').slice(j + 1)
    for (let r = i + 1; r < endR; r++) frag += `\n${lines[r] ?? ''}`
    frag += `\n${(lines[endR] ?? '').slice(0, endC)}`
  }
  const stmts = frag
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (stmts.length === 0) return true
  return stmts.every((s) => PASS_STMT_RE.test(s))
}

/**
 * 该 `if` 之后、同一函数体内(缩进回退到函数收尾 `}` 为止)是否还有执行动作。
 * 返回 true/false;算不出 ⇒ null ⇒ 落未判定,不猜。
 */
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

/**
 * 判一个文件(判据①)。`rel` 只用于点名。
 * 代码面用 maskComments(注释遮、字符串留 —— 键名住在字符串里);判"这个 if 是不是写在字符串
 * 里的示例文本"用 maskCommentsAndStrings;配平用 maskCommentsStringsAndRegex。
 * @returns {{findings,passed,exempted,undetermined}}
 */
export function scanSource(rel, src) {
  const findings = []
  const passed = []
  const exempted = []
  const undetermined = []
  if (typeof src !== 'string') return { findings, passed, exempted, undetermined }
  const rawLines = src.split('\n')
  const code = maskComments(src).split('\n')
  const noStr = maskCommentsAndStrings(src).split('\n')
  const struct = maskCommentsStringsAndRegex(src).split('\n')
  const lines = code
  /** 一跳变量:条件是个裸标识符时,回看它的声明(真仓 cookie 豁免就是跨行 + 类型断言的形态)。 */
  const refForIdentifier = (idx, name) => {
    const from = Math.max(0, idx - 12)
    const window = lines.slice(from, idx + 1).join('\n')
    const m = window.match(new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\s*=([\\s\\S]{0,300})`))
    if (!m) return null
    const scope = m[1]
    const refs = [...scope.matchAll(PRESENCE_REF_RE)].map((x) => x[0])
    if (refs.length === 1) return refs[0]
    // 类型断言把引用打断时,跨行拼回这个名字(真仓 csrf.ts 的 cookie 豁免正是这一形:
    // `= (request as FastifyRequest & {…}).cookies` 换行 `?.auth_token`,REF_RE 认不出
    // `request.cookies`,但配平/名字都在)。刻意**不**在 scope 上问 VERIFY_RE —— 300 字窗口
    // 会连后面几行的 enforcement 一起吞进来,那一刻"右值是验真调用"永远判真(第一版即此错)。
    const hop = scope.match(/\b(headers|cookies|query)\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)/)
    if (hop) return `request.${hop[1]}.${hop[2]}`
    return null
  }
  /** 声明窗口里到底有没有出现过传输面/env —— 没有就不是本型(别把 DB 变量报成未判定)。 */
  const mentionsTransport = (idx, name) => {
    const from = Math.max(0, idx - 12)
    const window = lines.slice(from, idx + 1).join('\n')
    const m = window.match(new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\s*=([\\s\\S]{0,300})`))
    return m ? /\b(headers|cookies|query|env)\b/.test(m[1]) : false
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let k = -1
    while ((k = line.indexOf('if (', k + 1)) >= 0) {
      // 该 `if (` 在"连字符串一起遮"的面上是空白 ⇒ 它本来住在字符串字面量里(示例文本),不算代码
      if (!(noStr[i] ?? '').slice(k, k + 4).trim()) continue
      const before = line.slice(0, k).trimEnd()
      if (before !== '' && !/[{};:]$/.test(before) && !/\belse$/.test(before)) continue
      const rc = readCondition(lines, i, k + 3, struct)
      if (!rc) {
        undetermined.push(`${rel}:${i + 1} if 条件括号配平失败 ⇒ 判不出,不猜`)
        continue
      }
      const cond = rc.cond
      // 正当形态一:条件即验真出口调用(#23 修法形态,必须放过)
      if (VERIFY_RE.test(cond)) {
        passed.push({ file: rel, line: i + 1, why: '条件即验真出口调用' })
        continue
      }
      // 类型守卫是"引用在场且是这一型"的修饰,先整块剥掉(typeof 比较不是值验证)
      const condNoGuard = cond.replace(TYPE_GUARD_RE, '')
      // 值比较 ⇒ 不是"存在性为唯一条件"(是否安全比较属另一维)
      if (CMP_RE.test(condNoGuard)) continue
      // 前导奇数个 ! = 不适用即继续,合法(与守门 108 的 absence 档同一条)
      const bangLead = /^!+/.exec(condNoGuard.trim())
      if (bangLead && bangLead[0].length % 2 === 1) continue
      // 引用从**原条件**取(类型守卫里住着引用:typeof (request.query as …)?.key ——
      // 剥过之后再取就什么都剩不下,typeof 包裹的存在性会整型隐形,守门 157 的 T12 同课);
      // 剥守卫只服务"残余文本"那一问。
      let refs = [...cond.matchAll(PRESENCE_REF_RE)].map((x) => x[0])
      let residualSrc = condNoGuard
      if (refs.length === 0) {
        const id = condNoGuard.trim().match(/^[A-Za-z_$][\w$]*$/)
        const hop = id ? refForIdentifier(i, id[0]) : null
        if (hop) {
          refs = [hop]
          residualSrc = hop
        } else if (id && mentionsTransport(i, id[0])) {
          // 变量名声明里含传输面/env 引用但回溯不到具体键:静默跳过等于"门看不见 ⇒ 报告正常",
          // 而它恰可能是本门立项那一型 ⇒ 报名,不猜。
          undetermined.push(
            `${rel}:${i + 1} 条件变量 ${id[0]} 的声明含传输面/env 引用但回溯不到具体键 ⇒ 判不出`,
          )
          continue
        } else {
          continue // 与存在性无关的条件(helper 调用 / 别的局部量)不属本型
        }
      }
      // 残余判定:去掉引用与布尔联结符之后必须什么都不剩 —— "存在性为唯一条件"
      const residual = residualSrc
        .replace(PRESENCE_REF_RE, '')
        .replace(/&&|\|\||\?\?|[()]/g, '')
        .trim()
      if (residual !== '') {
        // 条件里还有别的判定(混项):静态分不开豁免方向 ⇒ 点名,不冒红也不静默放过
        if (/\w/.test(residual))
          undetermined.push(
            `${rel}:${i + 1} 条件除存在性引用外还有别的判定(${residual.slice(0, 60)})⇒ 判不出`,
          )
        continue
      }
      const bare = bodyIsBarePass(lines, rc.endLine, rc.endCol, struct)
      if (bare === null) {
        undetermined.push(`${rel}:${i + 1} if 分支体形态算不出(跨行)⇒ 判不出`)
        continue
      }
      if (!bare) continue // 分支不是裸放行(如 return reply.status(403))⇒ 不属本型
      const enf = enforcementFollows(lines, i)
      if (enf === null) {
        undetermined.push(`${rel}:${i + 1} 找不到该函数收尾 ⇒ 判不出"跳过的是不是一段执行动作"`)
        continue
      }
      if (!enf) continue // 后面没有 enforcement ⇒ 控制流短路,不是"把防线换成一个字符串"
      const prev = i > 0 ? (rawLines[i - 1] ?? '') : ''
      const prevIsPureComment = /^\s*(?:\/\/|\/\*|\*)/.test(prev)
      const marked =
        EXEMPT_RE.test(rawLines[i] ?? '') ||
        FOREIGN_EXEMPT_RE.test(rawLines[i] ?? '') ||
        (prevIsPureComment && (EXEMPT_RE.test(prev) || FOREIGN_EXEMPT_RE.test(prev)))
      if (marked) {
        exempted.push({ file: rel, line: i + 1, ref: refs[0] })
        continue
      }
      findings.push({
        file: rel,
        line: i + 1,
        ref: refs[0],
        refs,
        cond: cond.trim(),
        names: namesOfRef(refs[0]),
      })
    }
  }
  return { findings, passed, exempted, undetermined }
}

/** 判据①的射程:CSRF 豁免决策面(三取其一)。加面必须同批改注释。 */
export function inCsrfSurface(rel, code) {
  if (typeof rel !== 'string' || !rel) return false
  if (/csrf/i.test(rel)) return true
  if (CSRF_EXIT_REF_RE.test(code)) return true
  if (HOOK_RE.test(code) && /csrf/i.test(code)) return true
  return false
}

/* ------------------------------- 纯函数:② ------------------------------- */

/**
 * 出口存活判定。`files` 是 `Map<rel, src>`(整树视图:staged 面 = 索引版本 ⊕ HEAD 版本)。
 * 每条出口四态:alive / export-missing / no-caller / file-missing。
 * "调用"含定义文件**内部**调用(子出口被复合出口调用即在线 —— 否则 HEAD 面的
 * isVerifiedInternalServiceCall 会被误判成摘线,而它正是 #23 的两族凭据之一)。
 */
export function judgeExits(files) {
  const out = []
  const map = files instanceof Map ? files : new Map()
  for (const def of EXIT_DEFS) {
    const src = map.get(def.file)
    if (typeof src !== 'string') {
      out.push({ ...def, state: 'file-missing', exported: false, internalCalls: 0, callers: [] })
      continue
    }
    const code = maskCommentsAndStrings(src)
    const exported =
      new RegExp(`export\\s+(?:async\\s+)?function\\s+${def.name}\\b`).test(code) ||
      new RegExp(`export\\s*\\{[^}]*\\b${def.name}\\b[^}]*\\}`).test(code)
    // 定义行自身不是调用:先剥掉 `(export …) function NAME(` 再数
    const stripped = code.replace(
      new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${def.name}\\s*\\(`, 'g'),
      '',
    )
    const internalCalls = (stripped.match(new RegExp(`\\b${def.name}\\s*\\(`, 'g')) ?? []).length
    const callers = []
    for (const [rel, s] of map) {
      if (rel === def.file || TESTISH.test(rel) || typeof s !== 'string') continue
      if (new RegExp(`\\b${def.name}\\s*\\(`).test(maskCommentsAndStrings(s))) callers.push(rel)
    }
    const alive = exported && internalCalls + callers.length > 0
    out.push({
      ...def,
      state: alive ? 'alive' : exported ? 'no-caller' : 'export-missing',
      exported,
      internalCalls,
      callers,
    })
  }
  return out
}

/* ------------------------------- 纯函数:③ ------------------------------- */

/**
 * apps/api/src 代码面(注释与字符串已遮)的 timingSafeEqual 站点。
 * 站点键 = `文件::归一化行文本::行内序` —— 刻意**不含行号**:Prettier/插入行会让行号整片移位,
 * 按行号做锚点会把"位置移动"读成"新增违规"(假红);按内容键,"同一处改写"才会算新增
 * (保守方向:收敛到 secretsEqual 的动作永远只减不增)。
 */
export function timingSafeEqualSites(files) {
  const sites = []
  const map = files instanceof Map ? files : new Map()
  for (const [rel, src] of map) {
    if (typeof src !== 'string' || !SCAN_EXTS.test(rel) || TESTISH.test(rel)) continue
    const code = maskCommentsAndStrings(src).split('\n')
    for (let i = 0; i < code.length; i++) {
      const re = /\btimingSafeEqual\b/g
      let m
      let n = 0
      while ((m = re.exec(code[i]))) {
        sites.push({
          key: `${rel}::${code[i].trim().replace(/\s+/g, ' ')}::${n}`,
          file: rel,
          line: i + 1,
          text: code[i].trim().slice(0, 120),
        })
        n++
      }
    }
  }
  return sites
}

/** 差值棘轮:当前站点里键不在锚点集里的 ⇒ 新增(本次改动把违规加回来了)。 */
export function newSitesOf(current, anchor) {
  const anchorKeys = new Set((anchor ?? []).map((s) => s.key))
  return (current ?? []).filter((s) => !anchorKeys.has(s.key))
}

/** ①的差值棘轮:当前 findings 里键不在锚点集里的 ⇒ 新增。 */
export function newFindingsOf(current, anchor) {
  const anchorKeys = new Set((anchor ?? []).map((f) => `${f.file}::${f.ref}::${f.cond}`))
  return (current ?? []).filter((f) => !anchorKeys.has(`${f.file}::${f.ref}::${f.cond}`))
}

/* ------------------------------- 取材 ------------------------------- */

function gitOpts() {
  return {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 1 << 26,
    windowsHide: true,
    // EBUSY 根治(errno -4082):本机会话里 Node 建子进程 stdin 管道确定性失败;调用点全为只读 git。
    stdio: ['ignore', 'pipe', 'pipe'],
  }
}

function listFacePaths(face, root = ROOT) {
  const spec = ['--', ...SCAN_DIRS]
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z', ...spec], root, gitOpts())
      .split('\0')
      .filter(Boolean)
  if (face === 'staged')
    return gitRaw(
      ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', ...spec],
      root,
      gitOpts(),
    )
      .split('\0')
      .filter(Boolean)
  return gitRaw(['ls-files', '-z', ...spec], root, gitOpts())
    .split('\0')
    .filter(Boolean)
}

/**
 * 读一个面的内容。staged 面:暂存路径取**索引 blob**(`:path`),其余取 HEAD 版本 ——
 * ② 的调用点搜索要的是"这份提交落地后的整树",只拿暂存文件会把没暂存的出口文件读成不在。
 */
function readFace(paths, face, root = ROOT, stagedSet = null) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const rel of paths) {
      const t = readWorktreeFile(root, rel)
      if (typeof t === 'string') map.set(rel, t)
    }
    return map
  }
  const specs = paths.map((rel) =>
    face === 'staged' && stagedSet && stagedSet.has(rel) ? `:${rel}` : `HEAD:${rel}`,
  )
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT_MS })
  for (let i = 0; i < paths.length; i++) {
    const t = got.get(specs[i])
    if (typeof t === 'string') map.set(paths[i], t)
  }
  return map
}

/** 与守门 108/135 同一条兜底:文档类提交结构上没有射程内文件 ⇒ 回退 HEAD 全量,不判"无法判定"。 */
export function shouldRetreatToHead({ face, stagedInScopeCount }) {
  return face === 'staged' && stagedInScopeCount === 0
}

/* ------------------------------- 汇总判定 ------------------------------- */

export function analyze({ face, root = ROOT, strict = false }) {
  const stagedPaths = face === 'staged' ? new Set(listFacePaths('staged', root)) : null
  if (shouldRetreatToHead({ face, stagedInScopeCount: stagedPaths ? stagedPaths.size : -1 })) {
    return analyze({ face: 'head', root, strict })
  }
  const effFace = face
  // 全量文件面(②的调用点搜索与③的存量都要整树视图)
  let allFiles
  if (effFace === 'staged') {
    // 暂存中**被删**的文件不进整树视图:提交后它不存在,拿它的 HEAD 版本冒充"还在"会让
    // "唯一调用点随文件一起被删"这种摘线读成 alive(②的整树视图必须是提交后的树)。
    const deleted = new Set(
      gitRaw(
        ['diff', '--cached', '--name-only', '--diff-filter=D', '-z', '--', ...SCAN_DIRS],
        root,
        gitOpts(),
      )
        .split('\0')
        .filter(Boolean),
    )
    const set = new Set(listFacePaths('head', root))
    for (const p of stagedPaths) set.add(p)
    for (const p of deleted) set.delete(p)
    allFiles = [...set]
  } else {
    allFiles = listFacePaths(effFace, root)
  }
  const codeFiles = allFiles.filter((p) => SCAN_EXTS.test(p) && !TESTISH.test(p))
  const contents = readFace(codeFiles, effFace, root, stagedPaths)
  const unreadable = codeFiles.filter((p) => !contents.has(p))
  // 锚点面:HEAD 版本的**同一些文件**(head 面就是自己,不重复取)
  const anchorContents = effFace === 'head' ? contents : readFace(codeFiles, 'head', root)

  // ①:CSRF 豁免决策面
  const surface = []
  for (const rel of codeFiles) {
    const code = maskComments(contents.get(rel) ?? '')
    if (inCsrfSurface(rel, code)) surface.push(rel)
  }
  const judgedSurface =
    effFace === 'staged' ? surface.filter((rel) => stagedPaths.has(rel)) : surface
  const findings = []
  const exempted = []
  const undetermined = []
  for (const rel of judgedSurface) {
    const r = scanSource(rel, contents.get(rel) ?? '')
    findings.push(...r.findings)
    exempted.push(...r.exempted)
    undetermined.push(...r.undetermined)
  }
  const anchorFindings = []
  for (const rel of judgedSurface) {
    const src = anchorContents.get(rel)
    if (typeof src === 'string') anchorFindings.push(...scanSource(rel, src).findings)
  }
  const addedFindings = newFindingsOf(findings, anchorFindings)

  // ②:出口存活(整树视图;staged 面 = 提交后的整树)
  const exits = judgeExits(contents)
  const brokenExits = exits.filter((e) => e.state !== 'alive')

  // ③:timingSafeEqual 站点(staged 面只判暂存文件 —— 没暂存的文件其站点全在锚点里,判了也白判)
  const judgedAll = effFace === 'staged' ? codeFiles.filter((p) => stagedPaths.has(p)) : codeFiles
  const sites = timingSafeEqualSites(
    new Map(judgedAll.map((rel) => [rel, contents.get(rel) ?? ''])),
  )
  const anchorSites = timingSafeEqualSites(
    new Map(judgedAll.map((rel) => [rel, anchorContents.get(rel) ?? ''])),
  )
  const addedSites = newSitesOf(sites, anchorSites)
  const siteFiles = new Set(sites.map((s) => s.file))

  const emptyScan = codeFiles.length === 0
  let exit = 0
  if (unreadable.length || emptyScan) exit = 2
  else if (addedFindings.length + brokenExits.length + addedSites.length > 0) exit = 1
  else if (strict && undetermined.length > 0) exit = 2
  else if (strict && findings.length + sites.length > 0) exit = 1

  return {
    face: effFace,
    scannedFiles: codeFiles.length,
    surfaceFiles: surface.length,
    judgedSurface: judgedSurface.length,
    findings,
    addedFindings,
    exempted,
    undetermined,
    exits,
    brokenExits,
    sites,
    addedSites,
    siteFiles: siteFiles.size,
    unreadable,
    emptyScan,
    exit,
  }
}

/* ------------------------------- 阳性对照(历史 blob) ------------------------------- */

/**
 * 拿对象库里那两枚 csrf.ts blob 喂同一把尺子,成对正反(改前必命中 / 改后必不命中)。
 * 不钉 HEAD:账还清那天起 HEAD 上量不到存量是正当结果,把它当"失明"就成了永红自检
 * (守门 157/131/150 的 PROBE_REF 同一条路子)。
 */
export function probeHistorical(root = ROOT) {
  const specs = [`${PROBE_REV_BEFORE}:${PROBE_FILE}`, `${PROBE_REV_AFTER}:${PROBE_FILE}`]
  const m = catBatch(root, specs, { maxBuffer: 1 << 27, timeout: GIT_TIMEOUT_MS })
  const missing = specs.filter((s) => !m.get(s))
  if (missing.length) throw new Error(`出处 blob 取不到(派生失败):${missing.join(' ')}`)
  const before = scanSource(PROBE_FILE, String(m.get(specs[0])))
  const after = scanSource(PROBE_FILE, String(m.get(specs[1])))
  return {
    before: before.findings.map((f) => `${f.file}:${f.line}`),
    beforeDetail: before.findings,
    after: after.findings.map((f) => `${f.file}:${f.line}`),
    afterDetail: after.findings,
    afterPassed: after.passed.length,
  }
}

/**
 * ②的历史阳性对照:#23 之前 internal-principal.ts **不存在** ⇒ 四条出口全部 file-missing
 * ("没有出路"可达的实证);#23 之后文件在、export 在、csrf 钩子调用在 ⇒ alive。
 */
export function probeExitsHistorical(root = ROOT) {
  const specs = [
    `${PROBE_REV_BEFORE}:${PROBE_IP_FILE}`,
    `${PROBE_REV_AFTER}:${PROBE_IP_FILE}`,
    `${PROBE_REV_AFTER}:${PROBE_FILE}`,
  ]
  const m = catBatch(root, specs, { maxBuffer: 1 << 27, timeout: GIT_TIMEOUT_MS })
  const missing = specs.filter((s) => !m.get(s))
  // 父版本的 internal-principal.ts 不存在是**预期**(那正是"没有出路"的现场),不算取材失败
  const expectMissing = [`${PROBE_REV_BEFORE}:${PROBE_IP_FILE}`]
  const fatal = missing.filter((s) => !expectMissing.includes(s))
  if (fatal.length) throw new Error(`出处 blob 取不到(派生失败):${fatal.join(' ')}`)
  const ipDefs = EXIT_DEFS.filter((d) => d.file === PROBE_IP_FILE)
  const beforeMap = new Map()
  const afterMap = new Map()
  const afterIp = m.get(`${PROBE_REV_AFTER}:${PROBE_IP_FILE}`)
  const afterCsrf = m.get(`${PROBE_REV_AFTER}:${PROBE_FILE}`)
  if (typeof afterIp === 'string') afterMap.set(PROBE_IP_FILE, afterIp)
  if (typeof afterCsrf === 'string') afterMap.set(PROBE_FILE, afterCsrf)
  const judge = (map) =>
    judgeExits(map)
      .filter((e) => e.file === PROBE_IP_FILE)
      .map((e) => ({ name: e.name, state: e.state }))
  return { before: judge(beforeMap), after: judge(afterMap), ipDefs }
}

/* ------------------------------- 自检 ------------------------------- */

/**
 * 夹具的"后面还有 enforcement"尾。刻意**不含** verify* 调用:带了它,每个夹具的
 * enforcement 行自己会被判成 passed 站点,把"目标站点落在哪一档"的读数搅乱
 * (自检第一版即此错:valueCompare/typeofGuard 的桶读成 passed)。ENFORCE_RE 认
 * `status(4xx)`,这一行照样是 enforcement。
 */
const ENF = '\n  return reply.status(403).send(1)\n}'

const FIXTURES = {
  headerPresence: `async function h(request, reply){\n  if (request.headers['x-internal-service-token']) return${ENF}`,
  envPresence: `async function h(request, reply){\n  if (process.env.AGENT_DISPATCH_SECRET) return${ENF}`,
  envBracket: `async function h(request, reply){\n  if (process.env['AGENT_DISPATCH_SECRET']) return${ENF}`,
  verifiedCall: `async function h(request, reply){\n  if (await isVerifiedInternalMachineCall(request)) return${ENF}`,
  verifiedHas: `async function h(request, reply){\n  if (await hasVerifiedApiKeyCarrier(request)) return${ENF}`,
  markedPrevLine: `async function h(request, reply){\n  // csrf-exempt: 路由侧 preHandler 已验真(台账 G-x 待偿)\n  if (request.headers['x-goog-api-key']) return${ENF}`,
  markedInline: `async function h(request, reply){\n  if (request.headers['x-goog-api-key']) return // csrf-exempt: 下游查库验真\n${ENF}`,
  markedBare: `async function h(request, reply){\n  // csrf-exempt:\n  if (request.headers['x-goog-api-key']) return${ENF}`,
  foreignMarked: `async function h(request, reply){\n  // credential-presence-exempt: 守门 157 台账已裁\n  if (request.headers['x-goog-api-key']) return${ENF}`,
  valueCompare: `async function h(request, reply){\n  if (request.headers['x-agent-token'] === process.env.AGENT_TOKEN) return${ENF}`,
  inComment: `async function h(request, reply){\n  // 旧写法: if (request.headers['x-internal-service-token']) return\n  return reply.send(1)\n}`,
  inString: `async function h(request, reply){\n  const doc = "if (request.headers['x-internal-service-token']) return"\n  return doc\n}`,
  notPassBody: `async function h(request, reply){\n  if (request.headers['x-internal-service-token']) return reply.status(403).send(1)\n}`,
  noEnforcement: `async function mapX(request){\n  if (request.headers.authorization) return\n  const g = request.headers['x-goog-api-key']\n  if (g) request.headers.authorization = 'Bearer ' + g\n}`,
  hopVariable: `async function h(request, reply){\n  const authToken = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies\n    ?.auth_token\n  if (authToken) return${ENF}`,
  orTwoKeys: `async function h(request, reply){\n  if (request.headers['x-a'] || request.headers['x-b']) return${ENF}`,
  typeofGuard: `async function h(request, reply){\n  if (typeof (request.query as { key?: unknown } | undefined)?.key === 'string') return${ENF}`,
  bangGuard: `async function h(request, reply){\n  if (!request.headers['x-webhook-signature']) return\n  await verifySignature(request)\n}`,
  stringParen: `async function h(request, reply){\n  const end = 1\n  if (sqlText.slice(end, end + 1) === '(') continue\n  if (request.headers['x-internal-service-token']) return${ENF}`,
}

function fixture(name) {
  return scanSource('a.ts', FIXTURES[name])
}

const IP_FILE = 'apps/api/src/utils/internal-principal.ts'
const CRED_FILE = 'apps/api/src/utils/csrf-exempt-credential.ts'
const CS_FILE = 'apps/api/src/plugins/csrf.ts'
const IP_SRC = `export async function isVerifiedInternalMachineCall(request){\n  if (await isVerifiedInternalServiceCall(request)) return true\n  return isVerifiedAgentControlInternalCall(request)\n}\nexport async function isVerifiedInternalServiceCall(request){ return false }\nexport async function isVerifiedAgentControlInternalCall(request){ return false }\n`
const CRED_SRC = `export async function isServerSignedJwt(token){ return true }\n`
const CS_SRC = `import { isVerifiedInternalMachineCall } from '../utils/internal-principal.js'\nimport { isServerSignedJwt } from '../utils/csrf-exempt-credential.js'\nexport async function h(request){\n  if (await isVerifiedInternalMachineCall(request)) return\n  if (await isServerSignedJwt(t)) return\n}\n`

function runSelfTest() {
  let okAll = true
  const t = (name, cond, extra = '') => {
    const pass = typeof cond === 'function' ? cond() : cond
    console.log(`${pass ? '✅' : '❌'} ${name}${!pass && extra ? ` ${extra}` : ''}`)
    if (!pass) okAll = false
  }
  const s = (name) => fixture(name)

  // ── ① 夹具:期望表 + 逐条语义(表钉覆盖面没漏项,逐条钉语义)──
  const EXPECT = {
    headerPresence: 'hit',
    envPresence: 'hit',
    envBracket: 'hit',
    verifiedCall: 'passed',
    verifiedHas: 'passed',
    markedPrevLine: 'exempted',
    markedInline: 'exempted',
    markedBare: 'hit',
    foreignMarked: 'exempted',
    valueCompare: 'neutral',
    inComment: 'neutral',
    inString: 'neutral',
    notPassBody: 'neutral',
    noEnforcement: 'neutral',
    hopVariable: 'hit',
    orTwoKeys: 'hit',
    typeofGuard: 'hit',
    bangGuard: 'neutral',
    stringParen: 'hit',
  }
  const bucketOf = (r) => {
    if (r.findings.length) return 'hit'
    if (r.exempted.length) return 'exempted'
    if (r.undetermined.length) return 'undetermined'
    if (r.passed.length) return 'passed'
    return 'neutral'
  }
  const misses = []
  for (const name of Object.keys(FIXTURES)) {
    if (!(name in EXPECT)) {
      misses.push(`${name}:夹具没进期望表`)
      continue
    }
    const got = bucketOf(s(name))
    if (got !== EXPECT[name]) misses.push(`${name}:期望 ${EXPECT[name]} 实得 ${got}`)
  }
  for (const name of Object.keys(EXPECT))
    if (!(name in FIXTURES)) misses.push(`${name}:期望表引用了不存在的夹具`)
  t('① 夹具期望表自洽(每个夹具都落进预期的档)', misses.length === 0, misses.join(' / '))

  t('① 核心阳性:头存在性唯一条件即放行必须命中', s('headerPresence').findings.length === 1)
  t('① env 键存在性必须命中(守门 157 的射程外格)', s('envPresence').findings.length === 1)
  t('① env 键方括号写法必须命中', s('envBracket').findings.length === 1)
  t(
    '① #23 修法形态必须放过(判据要覆盖门认可的写法)',
    s('verifiedCall').findings.length === 0 && s('verifiedCall').passed.length === 1,
  )
  t('① csrf.ts 自己的 hasVerified* 验真函数必须放过', s('verifiedHas').findings.length === 0)
  t('① 带原因的本门标记 ⇒ 豁免且只报数', s('markedPrevLine').exempted.length === 1)
  t('① 同行尾标记(带原因)同样豁免', s('markedInline').exempted.length === 1)
  t('① 裸标记(无原因)不得放过', s('markedBare').findings.length === 1)
  t('① 守门 157 的行内标记必须一并认(防两道门互咬)', s('foreignMarked').findings.length === 0)
  t('① 值比较不是纯存在性(是否安全比较属另一维,不判)', s('valueCompare').findings.length === 0)
  t('① 注释里的该形态不得计入', s('inComment').findings.length === 0)
  t('① 字符串里的该形态不得计入', s('inString').findings.length === 0)
  t('① 分支是 403 拒绝而不是放行 ⇒ 不属本型', s('notPassBody').findings.length === 0)
  t('① 映射短路(后面没有 enforcement)不得判红', s('noEnforcement').findings.length === 0)
  t('① 一跳变量(跨行 + 类型断言的 cookie 豁免)必须命中', s('hopVariable').findings.length === 1)
  t('① 两个键的存在性 || 组合仍算纯存在性', s('orTwoKeys').findings.length === 1)
  t('① typeof 包裹的存在性必须命中(裸类型比较不是验真)', s('typeofGuard').findings.length === 1)
  t('① 前导取反(不适用即继续)不得判红', s('bangGuard').findings.length === 0)
  t(
    '① 条件里字符串含左括号 ⇒ 必须配平成功,不得落未判定(且同文件的真违例仍命中)',
    s('stringParen').undetermined.length === 0 && s('stringParen').findings.length === 1,
    JSON.stringify(s('stringParen').undetermined),
  )

  // ── ② 出口存活(构造面对,四态成对)──
  const healthy = new Map([
    [IP_FILE, IP_SRC],
    [CRED_FILE, CRED_SRC],
    [CS_FILE, CS_SRC],
  ])
  const exportGone = new Map([
    [
      IP_FILE,
      IP_SRC.replace(
        'export async function isVerifiedAgentControlInternalCall',
        'async function isVerifiedAgentControlInternalCall',
      ),
    ],
    [CRED_FILE, CRED_SRC],
    [CS_FILE, CS_SRC],
  ])
  const callerGone = new Map([
    [IP_FILE, IP_SRC],
    [CRED_FILE, CRED_SRC],
    [CS_FILE, CS_SRC.replace('if (await isVerifiedInternalMachineCall(request)) return\n', '')],
  ])
  const fileGone = new Map([
    [CRED_FILE, CRED_SRC],
    [CS_FILE, CS_SRC],
  ])
  const internalOnly = new Map([
    [IP_FILE, IP_SRC],
    [CRED_FILE, CRED_SRC],
  ])
  const stateOf = (map, name) => judgeExits(map).find((e) => e.name === name)?.state
  t(
    '② 健康面对 ⇒ 全部 alive',
    judgeExits(healthy).every((e) => e.state === 'alive'),
    JSON.stringify(judgeExits(healthy)),
  )
  t(
    '② export 不见 ⇒ export-missing(没有出路)',
    stateOf(exportGone, 'isVerifiedAgentControlInternalCall') === 'export-missing',
  )
  t(
    '② 唯一调用点被摘 ⇒ no-caller(没有出路)',
    stateOf(callerGone, 'isVerifiedInternalMachineCall') === 'no-caller',
  )
  t(
    '② 定义文件不在 ⇒ file-missing(没有出路)',
    stateOf(fileGone, 'isVerifiedInternalMachineCall') === 'file-missing',
  )
  t(
    '② 子出口被复合出口内部调用即在线(否则 HEAD 面的两族凭据会被误判成摘线)',
    stateOf(internalOnly, 'isVerifiedInternalServiceCall') === 'alive' &&
      stateOf(internalOnly, 'isVerifiedInternalMachineCall') === 'no-caller',
    JSON.stringify(judgeExits(internalOnly).map((e) => [e.name, e.state])),
  )

  // ── ③ 差值棘轮(构造面对)──
  const mapA = new Map([
    [
      'apps/api/src/plugins/x.ts',
      `import { timingSafeEqual } from 'node:crypto'\nconst ok = timingSafeEqual(a, b)\n`,
    ],
    ['apps/api/src/utils/y.ts', `const c = timingSafeEqual(p, q)\n`],
  ])
  const mapSame = new Map(mapA)
  const mapAdded = new Map([
    [
      'apps/api/src/plugins/x.ts',
      `import { timingSafeEqual } from 'node:crypto'\nconst ok = timingSafeEqual(a, b)\nconst more = timingSafeEqual(c, d)\n`,
    ],
    ['apps/api/src/utils/y.ts', `const c = timingSafeEqual(p, q)\n`],
  ])
  const mapNewFile = new Map([
    ...mapA,
    ['apps/api/src/utils/z.ts', `const z = timingSafeEqual(m, n)\n`],
  ])
  const anchorSites = timingSafeEqualSites(mapA)
  t(
    '③ 同站点集 ⇒ 0 新增(不恒红)',
    newSitesOf(timingSafeEqualSites(mapSame), anchorSites).length === 0,
  )
  t(
    '③ 同文件多出一处 timingSafeEqual ⇒ 1 新增',
    newSitesOf(timingSafeEqualSites(mapAdded), anchorSites).length === 1,
  )
  t(
    '③ 新文件里的 timingSafeEqual ⇒ 全部新增',
    newSitesOf(timingSafeEqualSites(mapNewFile), anchorSites).length === 1,
  )
  t(
    '③ 只减不增:站点消失不算新增',
    newSitesOf(
      timingSafeEqualSites(new Map([['apps/api/src/plugins/x.ts', 'const ok = 1\n']])),
      anchorSites,
    ).length === 0,
  )
  t(
    '③ 站点键按内容不按行号(同行内容挪位不算新增)',
    newSitesOf(
      timingSafeEqualSites(
        new Map([['apps/api/src/plugins/x.ts', '// lead\nconst ok = timingSafeEqual(a, b)\n']]),
      ),
      timingSafeEqualSites(
        new Map([['apps/api/src/plugins/x.ts', 'const ok = timingSafeEqual(a, b)\n']]),
      ),
    ).length === 0,
  )
  t(
    '③ 注释/字符串里的 timingSafeEqual 不计站点(存量读数问代码面)',
    timingSafeEqualSites(
      new Map([['a.ts', '// 提一句 timingSafeEqual 的实现\nconst s = "timingSafeEqual 字样"\n']]),
    ).length === 0,
  )

  // ── 真仓对照:历史 blob 成对正反 + HEAD 面不恒红 + 存量读数 ──
  let probe = null
  try {
    probe = probeHistorical(ROOT)
  } catch (e) {
    t(`真仓阳性对照跑得动(${e.message})`, false)
  }
  if (probe) {
    t(
      `真仓阳性对照:修复前的「存在性即豁免」被点名(${probe.before.join(' ') || '—'})`,
      probe.before.length >= 2,
    )
    t(
      `真仓阳性对照:修复前的站点里必须含 ${PROBE_TOKEN}`,
      probe.beforeDetail.some((f) => String(f.ref).includes(PROBE_TOKEN)),
    )
    // 反向对照钉**站点**不钉总数:#23(6fb790eb70a8)只修了 x-internal-service-token 那一处,
    // 同文件另两处(auth_token cookie 一跳、x-goog-api-key)是后来 c824c12070(G-1018280/G-373)
    // 才收口的 —— 那一版 blob 上它们仍是存量。钉"总数归零"从 #23 那天起就永红,钉"#23 修掉的
    // 那个站点不再命中"才是判据的牙(与守门 108 自检的反向对照同一条口径)。
    t(
      `真仓反向对照:#23 修法之后同一文件不再含 ${PROBE_TOKEN} 站点(门对自己认可的写法不红)`,
      !probe.afterDetail.some((f) => String(f.ref).includes(PROBE_TOKEN)),
      JSON.stringify(probe.after),
    )
    t(
      '真仓反向对照:#23 修法之后同文件命中数严格下降(修一处少一处)',
      probe.after.length < probe.before.length,
      `before ${probe.before.length} after ${probe.after.length}`,
    )
  }
  let probeExits = null
  try {
    probeExits = probeExitsHistorical(ROOT)
  } catch (e) {
    t(`②真仓对照跑得动(${e.message})`, false)
  }
  if (probeExits) {
    t(
      '②真仓阳性对照:#23 之前出口文件不在 ⇒ file-missing("没有出路"可达)',
      probeExits.before.every((e) => e.state === 'file-missing'),
      JSON.stringify(probeExits.before),
    )
    t(
      '②真仓反向对照:#23 之后出口全部在线',
      probeExits.after.every((e) => e.state === 'alive'),
      JSON.stringify(probeExits.after),
    )
  }
  try {
    const head = analyze({ face: 'head' })
    t(
      `HEAD 全量档不因存量判红(①候选 ${head.findings.length} / ③存量 ${head.sites.length} 处·${head.siteFiles} 文件 / 扫 ${head.scannedFiles} 文件·面 ${head.surfaceFiles})`,
      head.exit === 0,
      `exit=${head.exit}`,
    )
    t(
      'HEAD 面枚举到的文件数必须上百(扫描面失效 = 对着空气打分)',
      head.scannedFiles > 100,
      `实得 ${head.scannedFiles}`,
    )
    t(
      'HEAD 面 CSRF 豁免决策面非空(射程塌了 = ①整族失明)',
      head.surfaceFiles > 0,
      `实得 ${head.surfaceFiles}`,
    )
    t(
      'HEAD 面四条验真出口全部在线',
      head.brokenExits.length === 0,
      JSON.stringify(head.brokenExits),
    )
    t(
      'HEAD 面存量读数必须看得见(③存量 > 0 才谈得上棘轮只拦新增)',
      head.sites.length > 0,
      `实得 ${head.sites.length}`,
    )
    const strictHead = analyze({ face: 'head', strict: true })
    t(
      'strict 档语义:有存量即 1(问责档,不当默认)',
      strictHead.exit === 1 ||
        (strictHead.findings.length === 0 &&
          strictHead.sites.length === 0 &&
          strictHead.exit === 0),
      `exit=${strictHead.exit}`,
    )
  } catch (e) {
    t(`HEAD 面分析跑得动(${e.message})`, false)
  }
  console.log(okAll ? '--self-test: 全部通过' : '--self-test: 有失败')
  return { pass: okAll, fail: okAll ? 0 : 1 }
}

/* ------------------------------- CLI ------------------------------- */

function main(argv) {
  if (argv.includes('--self-test')) {
    const { pass } = runSelfTest()
    return pass ? 0 : 1
  }
  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    return 2
  }
  const strict = argv.includes('--strict')
  let a
  try {
    a = analyze({ face: sel.face, strict })
  } catch (e) {
    console.error(`❌ 无法判定(不冒红也不记绿):${e.message}`)
    return 2
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ face: sel.face, ...a }, null, 2))
    return a.exit
  }
  const C = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
  }
  console.log(
    `${C.cyan}[csrf-exemption-shape] 面:${sel.face}${strict ? '(strict)' : ''} · 扫 ${a.scannedFiles} 个 apps/api/src 文件 · CSRF 豁免决策面 ${a.surfaceFiles} 个${C.reset}`,
  )
  console.log(
    `① 存在性豁免:候选 ${a.findings.length} 处(已裁 ${a.exempted.length} 处 · 新增 ${a.addedFindings.length} 处)`,
  )
  for (const f of a.findings.slice(0, 15))
    console.log(
      `   ${a.addedFindings.includes(f) ? C.red + '❌ 新增' : C.yellow + 'ℹ 存量'} ${f.file}:${f.line} ${f.ref}${C.reset}`,
    )
  for (const e of a.exempted.slice(0, 10))
    console.log(
      `   ${C.yellow}ℹ 已裁 ${e.file}:${e.line} ${e.ref}(行内标记,到期归守门 108)${C.reset}`,
    )
  console.log(
    `② 验真出口:${a.exits.filter((e) => e.state === 'alive').length}/${a.exits.length} 在线` +
      (a.brokenExits.length
        ? ` ${C.red}❌ 没有出路:${a.brokenExits.map((e) => `${e.name}@${e.file}(${e.state})`).join(', ')}${C.reset}`
        : ` ${C.green}✅${C.reset}`),
  )
  console.log(
    `③ timingSafeEqual:存量 ${a.sites.length} 处 / ${a.siteFiles} 文件(棘轮锚点=HEAD) · 新增 ${a.addedSites.length} 处`,
  )
  for (const s of a.addedSites.slice(0, 15))
    console.log(`   ${C.red}❌ 新增 ${s.file}:${s.line} ${s.text}${C.reset}`)
  for (const u of a.undetermined.slice(0, 15)) console.log(`   ${C.yellow}ℹ 未判定:${u}${C.reset}`)
  if (a.unreadable.length)
    console.log(
      `${C.red}❌ 无法判定:${a.unreadable.length} 个候选在本面取不到内容,首个:${a.unreadable[0]}${C.reset}`,
    )
  if (a.emptyScan)
    console.log(`${C.red}❌ 枚举到 0 个射程内候选 —— 判"无法判定",绝不记绿${C.reset}`)
  if (a.exit === 0 && !strict)
    console.log(
      `${C.green}✅ 无新增。存量按 §12f 只报数(①候选 ${a.findings.length} / ③站点 ${a.sites.length});问责用 --strict。${C.reset}`,
    )
  return a.exit
}

export const __test__ = {
  scanSource,
  judgeExits,
  timingSafeEqualSites,
  newSitesOf,
  newFindingsOf,
  inCsrfSurface,
  readCondition,
  bodyIsBarePass,
  enforcementFollows,
  namesOfRef,
  shouldRetreatToHead,
  analyze,
  probeHistorical,
  probeExitsHistorical,
  runSelfTest,
  EXIT_DEFS,
  EXEMPT_FAMILY,
  FIXTURES,
  PROBE_REV_BEFORE,
  PROBE_REV_AFTER,
  PROBE_FILE,
  PROBE_TOKEN,
  PROBE_IP_FILE,
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

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
