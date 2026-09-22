// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */

// 覆盖 **JS/TS 与 Python 两套语法**(`apps/` + `packages/` 下 .ts/.tsx/.js/.mjs/.py):
//   序列化认 `JSON.stringify(` 与 `json.dumps(`;整对象插值认 JS 的 `${x}` / `${x.slice(…)}`
//   与 Python f-string 的 `{x}` / `{x[:200]}`(必须同行有 `f"` / `f'`);错误构造上下文认
//   `reply.status(4xx/5xx)` / `throw new XError(...)` / Python `raise XError(...)` 与 `status_code=4xx`;
//   注释豁免同时认 `//` 与 `#`。
// 守门:拦截「上游**凭据/令牌类**响应体被 stringify 后塞进 4xx/5xx 错误 message」的外泄路径。
//
// 为什么需要(实测事实,非推测):
//   1) apps/api/src/plugins/response-sanitizer.ts:496
//      `if (reply.statusCode < 200 || reply.statusCode >= 300) return payload`
//      —— 非 2xx 响应**完全不经脱敏**,所以"拼进 error message"是脱敏体系的真实旁路。
//   2) 真实事故提交 7384c92ed0 之前:proxy-extended-media3.ts 把 Adobe IMS OAuth2 令牌端点
//      整个响应体 `JSON.stringify(tokenData).slice(0, 400)` 拼进 502 message 回传客户端,
//      而该体含 `access_token`。
//
// 判据刻意**窄**(宁漏不误报),命中需同一「错误构造表达式」窗口内满足 A∧B 且 C/D/E/F 至少一条:
//   A. 处于错误构造上下文:4xx/5xx 响应(`reply.status(5xx)` / `error(5xx, …)` / `{ code: 500 }`)
//      **或** `throw new Error(...)` / `throw new XxxError(...)` —— service 层的外泄走的是后者,
//      只认前者会整条漏掉(paypal.ts 即此形状);且
//   B. 窗口里有上游响应体外泄:`JSON.stringify(X)`,或整个对象被插值 `${x}` / `${x.slice(…)}`;且
//   C. 凭据语义成立:X 的名字 / 其声明右侧 / X 是含凭据 key 的对象字面量
//      —— 或 message 字面量里直接出现 access_token / refresh_token / id_token。
//   D. **来源证据**(不认变量名,认响应体出处):`X = (await R.json())` 且 `R = await fetch('<令牌端点>')`
//      落在同一处理器内(以路由注册行为边界、窗口 ≤40 行)→ 即使 X 叫 `json` / `data` 也 BLOCK。
//      加这条是因为 C 只认名字,而真实缺陷恰好藏在"名字最无辜"的变量上:
//      workspace-ai.ts 把 GitHub `POST /login/device/code` 的整个响应体 stringify 进 400 message,
//      `device_code` 按 RFC 8628 §1.5 是 bearer 凭据(拿到即可换 access_token)—— 2026-09-22 实测发现并修。
//   E. 同 D 的来源判据,但传输形态是**裸插值**且响应变量取自 `.text()`(而非 `.json()`):
//      paypal.ts 曾写 `throw new Error(\`PayPal OAuth2 token failed: ${resp.status} ${text.slice(0, 200)}\`)`,
//      text ← `resp.text()` ← `${API_BASE}/v1/oauth2/token`,而该请求自带 Basic(client_id:client_secret)
//      —— 2026-09-22 由 E 咬出并改为只回传状态码 + RFC 6749 error 码。字段投影(`${json.error}`)**不算**,
//      那正是推荐写法(有反例用例钉住,防止把修复判成违规)。
//   F. **关键词 ∧ 整对象 dump**(补 D/E 的结构性盲区):被调方是**SDK 而非 fetch**时
//      URL 字面量根本不在文件里(如阿里云 `client.callApi(params, request, {})` +
//      `endpoint: 'sts.aliyuncs.com'` 在 60 行开外),来源链回溯够不到。此时以
//      「错误消息自带凭据端点关键词(`CRED_CALL_KEYWORD_RE`:AssumeRole / OAuth / device/code /
//      gettoken / tenant_access_token / …)」∧「窗口里把整个响应体倒进 message
//      (`JSON.stringify(response.body)` / `${body}`,目标路径末段须是 body/data/payload/… 类名)」
//      **双条件**命中。真实缺陷 `storage-service.ts` 即此形状:`throw new Error(\`STS AssumeRole 失败:
//      ${JSON.stringify(response.body)}\`)`,而 AssumeRole 的成功体就是临时凭据
//      (AccessKeyId / AccessKeySecret / SecurityToken)。字段投影 `${response.Code}` 不判。
// 仅 A∧B 而 C/D/E/F 皆不成立(`JSON.stringify(errData)` / `(genData)` / `(data)`)→ **不拦**,
// 只进「低置信候选」清单供人审(打印但不计入失败)。现 30 处:8 处为本进程自造的常量错误对象
// (不含任何上游数据),其余为厂商**推理/生成端点**错误体透传 —— 已逐个回溯其 fetch 端点确认非令牌端点,
// 含经 `callVendor` / `cozeRequest` / `callLuyala` 转发的动态 URL 情形(其全部调用点 path 均为推理接口);
// throw 形态新增的 4 处也已逐个看明:STS 为真缺陷(已由 F 拦下并修),
// cli installer(本地插件 source 描述符)、cli browser(CDP exceptionDetails)、
// api-client coze(上游文本进 error 的**字段**而非 message,且为浏览器侧库)三处不含凭据。
// 这类透传属中低危(泄露的是上游错误描述),故本门不对其恒红。
//
// 用法:node scripts/check-credential-leak-in-message.mjs
//       [--staged|--quiet|--self-test|--update-baseline|--help]
// 注意 `--staged` 的语义与仓内其它门一致:**只把文件清单收窄为暂存集,内容一律读工作树**
//   (与 lint-staged 同形态)。因此它校验的是"即将被提交的那份工作树内容";若有人只改了索引
//   而未同步工作树(并发会话的错配态),本门看不到差异 —— 那是 30c 陈旧副本门与 65 整树删除门的职责。
// 退出码:0 通过 / 1 检出高危违规(或基线外新增)/ 2 脚本自身异常。
// 存量豁免:scripts/credential-leak-baseline.json(只减不增;将来一次性整改时可登记)。
//
// 豁免 key 形态(2026-09-22 定稿,不含行号):`<路径>::<kind>|<凭据证据>`,
//   凭据证据 = 命中凭据语义的 JSON.stringify 实参集合(排序去重)/ 经声明外泄的变量名
//   (`via:<名>`)/ message 里出现的令牌字面量(`literal:<名>`)/ D 通道的来源链
//   (`endpoint:<变量>←<响应变量>←<令牌端点 URL>`)。
//   之所以不带行号也不用窗口全文:调用点**上方**任何一行增删都是极常见的日常改动,
//   一旦 key 依赖绝对行号或整段窗口文本,已登记的豁免会**静默失效**且无线索可查。
//   行号仍出现在报错输出里(给人看),只是不进 key。
// 同一物理外泄点只计一次:一条语句常有 `.status(502)` 与 `error(502, …)` 两个 4xx/5xx
//   起点(跨行写法时各自成窗),窗口行区间相互重叠 → 合并为 1 处(`contexts` 记命中数);
//   行区间不相交的同签名写法(不同函数里的重复外泄)仍分别成条,不互相顶掉。

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = resolve(ROOT, 'scripts', 'credential-leak-baseline.json')
const SCAN_ROOTS = ['apps/', 'packages/']
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.py'])
const SKIP_DIR =
  /[\\/](node_modules|dist|build|\.next|\.turbo|coverage|__tests__|tests?|e2e|bench)[\\/]/
const TEST_PATH = /(\.test\.|\.spec\.|[\\/](tests?|__tests__|e2e)[\\/])/
const MAX_WINDOW_LINES = 12

/** 凭据语义词表(token/secret/…/access_token),用于「名字或声明右侧」判定 */
export const CRED_SEMANTIC_RE =
  /(access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|apikey|token|secret|credential|password|bearer)/i
/** message 字面量里直接出现的令牌字段名(spec 指定的三个,严格 snake_case) */
export const CRED_LITERAL_RE = /\b(access_token|refresh_token|id_token)\b/
/** 同上带 `g` 标志的一份,用于把命中的令牌名**收全**(只用于生成稳定证据串,不改判据) */
const CRED_LITERAL_ALL_RE = new RegExp(CRED_LITERAL_RE.source, 'g')
/** 4xx/5xx 错误响应构造上下文 */
export const STATUS_CTX_RE = new RegExp(
  [
    String.raw`\.\s*status\s*\(\s*[45]\d{2}\s*\)`,
    String.raw`\berror\s*\(\s*[45]\d{2}\b`,
    String.raw`\b(?:statusCode|status_code|status|code)\s*[:=]+\s*[45]\d{2}\b`,
    String.raw`\bthrow\s+new\s+\w*Error\s*\(\s*[45]\d{2}\b`,
  ].join('|'),
  'g',
)
const IDENT_RE = /^[A-Za-z_$][\w$]*$/

/**
 * 令牌/授权类上游端点:响应体**本身**就是凭据(RFC 6749 access_token / RFC 8628 device_code)。
 * 只列路径形态,不匹配 `application/json` 之类的媒体类型字面量,避免把请求头判成端点。
 */
export const TOKEN_ENDPOINT_RE =
  /(\/login\/oauth|\/oauth2?\/[a-z_]*token|\/v\d+\/token|\/gettoken|\/get_token|\/tenant_access_token|\/device\/code|\/client_?tokens?|\/access_?token|\/api\/auth\/token|\/sts$|\/credentials\/get)/i

/** 路由注册行:来源链跨越它即视为进入另一个处理器,判定链断开(宁漏不误报)。 */
const ROUTE_REG_RE = /\bserver\s*\.\s*(get|post|put|delete|patch|all|route)\s*\(/

/**
 * E 通道上下文:`throw new Error(...)` / `throw new XxxError(...)`(service 层外泄常走这条,不经 reply.status)。
 * 前缀**必须可选** —— 写成 `[A-Za-z_$][\w$]*Error` 会漏掉最常见的裸 `Error`(实测 paypal.ts 即此形状)。
 */
const THROW_CTX_RE = /(?:\bthrow\s+new|^[ \t]*raise)[ \t]+[\w$.]*(?:Error|Exception)[ \t]*\(/

/**
 * 模板里"整个响应体被插值"的形态:`${text}` / `${text.slice(0, 200)}`。
 * 刻意不含 `${x.field}` —— 字段投影(如 `${json.error}`)正是推荐写法,不得误伤。
 */
const WHOLE_INTERP_RE = /\$\{\s*([A-Za-z_$][\w$]*)\s*(?:\.slice\([^)]*\))?\s*\}/g

/**
 * F 通道的关键词集:窗口文本里点名了"发凭据的那类调用"。
 * 走 SDK(如阿里云 `client.callApi`、AWS SDK)时 URL 字面量不在文件里,D/E 的来源回溯够不到,
 * 只能靠错误消息自带的端点名/动作名。故 F = 关键词 ∧ 整对象 dump 双条件,单条件一律不判。
 */
export const CRED_CALL_KEYWORD_RE =
  /(assumeRole|getsessiontoken|sts\.aliyuncs|tenant_access_token|client[_-]?token|oauth2?[\/.]|\/login\/oauth|device\/code|access[_-]?token|refresh[_-]?token|id_token|gettoken|session[_-]?token|signature[_-]?token|\/credential)/i

/** "整体倒进 message"的目标名:路径末段是响应体类名字才算,避免把 `${body.Code}` 这类字段投影判成违规。 */
const DUMP_TARGET_RE =
  /(?:^|\.)(body|data|json|payload|result|response|resp|output|text|detail|content)$/i

/**
 * F 通道求解:返回"关键词 + 被整体倒出的对象路径"证据数组(无则空)。
 * @param {string} text 错误构造窗口文本
 */
/**
 * Python f-string 里"整个变量被插值":`{x}` / `{x[:200]}` / `{data!r}`。
 * 必须与 `f"` / `f'` 前缀同窗口出现才启用 —— 否则 JS 对象字面量 `{ detail }` 会被误配成整对象外泄。
 */
const PY_INTERP_RE = /\{\s*([A-Za-z_][\w.]*)\s*(?:![ar]|\[[^\]]*\])?\s*\}/g
const FSTRING_RE = /\bf["']/

/**
 * F 通道求解:返回"关键词 + 被整体倒出的对象路径"证据数组(无则空)。
 * @param {string} text 错误构造窗口文本
 * @param {boolean} [py] 是否按 Python 形态识别(json.dumps 与 f-string 插值)
 */
export function credEndpointDumpEvidence(text, py = false) {
  const serRe = py
    ? /\bjson\s*\.\s*dumps\s*\(\s*([A-Za-z_][\w.]*)/g
    : /JSON\s*\.\s*stringify\s*\(\s*([A-Za-z_$][\w$.]*)/g
  const interpRe = py ? PY_INTERP_RE : WHOLE_INTERP_RE
  const dumps = new Set()
  // 关键词与 dump **必须同一行**:整窗配对会被相邻语句的字符串字面量喂进假阳性
  // (实测 cnblogs/oschina/segmentfault 三个 verify 适配器:上一行 return 里写着
  //  "access_token expired or invalid (401)",下一行才倒出平台用户信息响应体)
  for (const line of text.split('\n')) {
    CRED_CALL_KEYWORD_RE.lastIndex = 0
    const kw = line.match(CRED_CALL_KEYWORD_RE)
    if (!kw) continue
    const k = kw[1].toLowerCase()
    serRe.lastIndex = 0
    for (const m of line.matchAll(serRe))
      if (m[1] && DUMP_TARGET_RE.test(m[1])) dumps.add(`${k}:${m[1]}`)
    if (py && !FSTRING_RE.test(line)) continue
    interpRe.lastIndex = 0
    for (const m of line.matchAll(interpRe))
      if (m[1] && DUMP_TARGET_RE.test(m[1])) dumps.add(`${k}:${m[1]}`)
  }
  return uniqueSorted([...dumps].map((d) => `keyword:${d}`))
}

/** 跳过字符串字面量(含模板插值),返回结束下标(引号之后)。 */
export function advanceQuoted(src, i) {
  const quote = src[i]
  let j = i + 1
  while (j < src.length) {
    const ch = src[j]
    if (ch === '\\') {
      j += 2
      continue
    }
    if (quote === '`' && ch === '$' && src[j + 1] === '{') {
      j = advanceTemplateExpr(src, j + 2)
      continue
    }
    if (ch === quote) return j + 1
    j++
  }
  return j
}

/** 从 `${` 之后扫到配对的 `}`(内部再识别字符串)。 */
export function advanceTemplateExpr(src, i) {
  let depth = 1
  let j = i
  while (j < src.length && depth > 0) {
    const ch = src[j]
    if (ch === '"' || ch === "'" || ch === '`') {
      j = advanceQuoted(src, j)
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') depth--
    j++
  }
  return j
}

/** 括号(仅圆括号)净深度:跳过字符串与注释,避免 `${...()}` 干扰。 */
export function parenDepth(text) {
  let depth = 0
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '/' && next === '/') {
      const nl = text.indexOf('\n', i)
      i = nl === -1 ? text.length : nl + 1
      continue
    }
    if (ch === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2)
      i = close === -1 ? text.length : close + 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      i = advanceQuoted(text, i)
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') depth--
    i++
  }
  return depth
}

/** 顶层首个实参(逗号之前),用于取 JSON.stringify 的被序列化对象。 */
export function firstArgOf(inner) {
  let depth = 0
  let i = 0
  while (i < inner.length) {
    const ch = inner[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      i = advanceQuoted(inner, i)
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ',' && depth === 0) break
    i++
  }
  return inner.slice(0, i).trim()
}

/** 收集 text 内所有 `JSON.stringify(X)` 的 X 表达式文本。 */
/**
 * "把对象序列化"的两语言形态:JS `JSON.stringify(` 与 Python `json.dumps(`。
 * 两条通道(D 的来源回溯、C 的实参语义、F 的整对象 dump)都以它为锚,缺一即该语言整条空转。
 */
const SERIALIZE_SRC = String.raw`JSON\s*\.\s*stringify\s*\(|\bjson\s*\.\s*dumps\s*\(`
const SERIALIZE_RE = new RegExp(SERIALIZE_SRC)

export function findStringifyArgs(text) {
  const args = []
  const re = new RegExp(SERIALIZE_SRC, 'g')
  let m
  while ((m = re.exec(text))) {
    const inner = text.slice(m.index + m[0].length)
    let depth = 1
    let i = 0
    while (i < inner.length && depth > 0) {
      const ch = inner[i]
      if (ch === '"' || ch === "'" || ch === '`') {
        i = advanceQuoted(inner, i)
        continue
      }
      if (ch === '(') depth++
      else if (ch === ')') depth--
      i++
    }
    const callInner = inner.slice(0, Math.max(0, i - 1))
    const arg = firstArgOf(callInner)
    if (arg) args.push(arg)
  }
  return args
}

/** 文件内 `const|let|var NAME = RHS` 声明表(名字 → [{ rhs, line }]）。 */
export function collectDeclarations(src) {
  const map = new Map()
  // 第二支是 Python 形态(无 const/let/var 关键字);`(?![=\w])` 排除 `==`/`>=` 等比较与 `x === y`
  const re =
    /^[ \t]*(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)[ \t]*=[ \t]*(.+)$|^[ \t]*([A-Za-z_][\w]*)[ \t]*=(?![=\w])[ \t]*(.+)$/gm
  let m
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length
    const name = m[1] ?? m[3]
    const rhs = (m[2] ?? m[4] ?? '').trim()
    const list = map.get(name) || []
    list.push({ rhs, line })
    map.set(name, list)
  }
  return map
}

/** 取 usageLine 之前最近一次同名声明(含行号;无则 null)。 */
export function resolveDeclaredEntry(decls, name, usageLine) {
  const list = decls.get(name)
  if (!list || !list.length) return null
  let best = null
  for (const d of list) {
    if (d.line <= usageLine && (!best || d.line >= best.line)) best = d
  }
  return best ?? list[0]
}

/** 取 usageLine 之前最近一次同名声明的右侧文本(无则 null)。 */
export function resolveDeclaredRhs(decls, name, usageLine) {
  return resolveDeclaredEntry(decls, name, usageLine)?.rhs ?? null
}

/** 单个 stringify 实参是否命中凭据语义(名字 / 声明右侧 / 对象字面量 key)。 */
export function classifyStringifyArg(arg, decls, usageLine) {
  const text = arg.replace(/\s+/g, ' ').trim()
  if (CRED_SEMANTIC_RE.test(text)) return true
  if (IDENT_RE.test(text)) {
    const rhs = resolveDeclaredRhs(decls, text, usageLine)
    if (rhs && CRED_SEMANTIC_RE.test(rhs)) return true
  }
  return false
}

/**
 * 来源证据(不依赖变量名):被序列化的变量是否取自**令牌端点响应体**。
 * 回溯链 `<var> = await <resp>.json()` → `<resp> = await fetch('<url>')`,
 * url 命中 TOKEN_ENDPOINT_RE 即成立;跨越路由注册行或窗口超 40 行则放弃(宁漏不误报)。
 */
export function tokenEndpointProvenance(decls, lines, arg, usageLine) {
  const name = arg.replace(/\s+/g, ' ').trim()
  if (!IDENT_RE.test(name)) return null
  const jsonEntry = resolveDeclaredEntry(decls, name, usageLine)
  if (!jsonEntry) return null
  const m = jsonEntry.rhs.match(/\b([A-Za-z_$][\w$]*)\s*\.\s*(?:json|text)\s*(?:\(|$|[^\w(])/)
  if (!m) return null
  const respEntry = resolveDeclaredEntry(decls, m[1], jsonEntry.line)
  if (!respEntry) return null
  const from = respEntry.line - 1
  const to = Math.min(lines.length - 1, usageLine - 1)
  if (to <= from || to - from > 40) return null
  // 边界必须整段先查:URL 常与 fetch 同一行(即 from),若边扫边判会在越界前就命中
  for (let i = from + 1; i <= to; i++) if (ROUTE_REG_RE.test(lines[i])) return null
  for (let i = from; i <= to; i++) {
    const u = lines[i].match(/(['"`])([^'"`\s]+)\1/)
    if (u && TOKEN_ENDPOINT_RE.test(u[2])) return `${name}←${m[1]}←${u[2].slice(0, 70)}`
  }
  return null
}

/** 找到所有 4xx/5xx 上下文所在行(排除注释行)。 */
export function findStatusContexts(lines) {
  return findContexts(lines, STATUS_CTX_RE)
}

function findContexts(lines, re) {
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.startsWith('//') || t.startsWith('#') || t.startsWith('*') || t.startsWith('/*')) continue
    re.lastIndex = 0
    if (re.test(lines[i])) hits.push(i)
  }
  return hits
}

/** `throw new XxxError(...)` 所在行:service 层的外泄常走这条而非 reply.status()。 */
export function findThrowContexts(lines) {
  return findContexts(lines, THROW_CTX_RE)
}

/** 错误构造上下文全集(4xx/5xx 响应 + throw),A–E 五个证据通道统一在这些窗口内求解。 */
export function findErrorContexts(lines) {
  return [...findStatusContexts(lines), ...findThrowContexts(lines)].sort((a, b) => a - b)
}

/**
 * E 通道的实参集合:窗口内**整个**被插值的对象(`${x}` / `${x.slice(…)}`),
 * 且其来源是令牌端点响应体。用于没有 `JSON.stringify` 的透传写法
 * (`throw new Error(\`... ${text.slice(0, 200)}\`)`,text 来自 `resp.text()`)。
 */
export function wholeInterpProvenance(decls, lines, text, usageLine, py = false) {
  const re = py ? new RegExp(PY_INTERP_RE.source, 'g') : new RegExp(WHOLE_INTERP_RE.source, 'g')
  if (py && !FSTRING_RE.test(text)) return []
  const ids = [...text.matchAll(re)].map((m) => m[1])
  return uniqueSorted(
    ids
      .map((id) => tokenEndpointProvenance(decls, lines, id, usageLine))
      .filter(Boolean)
      .map((p) => `endpoint:${p}`),
  )
}

/** 从上下文行起向后取「同一错误构造表达式」窗口,直到圆括号配平或语句结束。 */
export function extractWindow(lines, startIndex) {
  const limit = Math.min(lines.length, startIndex + MAX_WINDOW_LINES)
  let text = ''
  for (let i = startIndex; i < limit; i++) {
    text += (i > startIndex ? '\n' : '') + lines[i]
    if (parenDepth(text) > 0) continue
    const closedHere = /\)\s*[,;]?\s*$/.test(text.replace(/\s+$/, ''))
    // 链式调用换行(`reply.status(500)` 换行 `.send(…)`)→ 继续向后收
    const next = lines[i + 1] ? lines[i + 1].replace(/^\s+/, '') : ''
    const chainContinues = next.startsWith('.') || next.startsWith('?.')
    if (closedHere && !chainContinues) return { text, endIndex: i }
  }
  return { text, endIndex: limit - 1 }
}

const norm = (s) => s.replace(/\s+/g, ' ').trim()

/** 归一化 + 去重 + 排序:让证据串与语句内的书写顺序无关(稳定 key 的前提)。 */
function uniqueSorted(items) {
  return [...new Set(items.map(norm).filter(Boolean))].sort()
}

/** 两个窗口行区间是否重叠(同一物理外泄点常有 status + error 两个起点)。 */
function rangesOverlap(a, b) {
  return a[0] <= b[1] && b[0] <= a[1]
}

/**
 * 扫描单个源文件。
 * @param {string} src 文件内容
 * @param {string} file 仓库相对路径
 * @param {Set<string>} [exempt] 基线 key 集合(形态 `<路径>::<kind>|<证据>`,不含行号)
 * @returns {{ violations: Array<object>, candidates: Array<object> }}
 */
export function scanSource(src, file, exempt = new Set()) {
  const lines = src.split('\n')
  const py = file.endsWith('.py')
  const decls = collectDeclarations(src)
  const violations = []
  const candidates = []
  /** key → { recs, ranges }:已报告的同一签名(用于把重叠窗口合并为 1 处) */
  const clusters = new Map()
  for (const start of findErrorContexts(lines)) {
    const { text, endIndex } = extractWindow(lines, start)
    const usageLine = start + 1
    const hasDirectStringify = SERIALIZE_RE.test(text)
    const args = hasDirectStringify ? findStringifyArgs(text) : []
    // A. 被序列化的实参本身具备凭据语义(名字 / 声明右侧 / 对象字面量 key)
    const credArgs = uniqueSorted(args.filter((a) => classifyStringifyArg(a, decls, usageLine)))
    // B. 经一层声明间接外泄:`const detail = JSON.stringify(tokenData)…` + 下游 error(502, `…${detail}`)
    const viaDecl = []
    if (!credArgs.length) {
      for (const id of new Set(text.match(/[A-Za-z_$][\w$]*/g) || [])) {
        const rhs = resolveDeclaredRhs(decls, id, usageLine)
        if (!rhs || !SERIALIZE_RE.test(rhs)) continue
        if (findStringifyArgs(rhs).some((a) => classifyStringifyArg(a, decls, usageLine)))
          viaDecl.push(`via:${id}`)
      }
    }
    viaDecl.sort()
    // C. message 字面量里直接出现令牌字段名
    const literals = hasDirectStringify
      ? uniqueSorted(text.match(CRED_LITERAL_ALL_RE) || []).map((l) => `literal:${l}`)
      : []
    // D. 来源证据:变量名毫无凭据语义,但值取自令牌端点响应体(device_code / access_token 场景)
    const provenance = hasDirectStringify
      ? uniqueSorted(
          args
            .map((a) => tokenEndpointProvenance(decls, lines, a, usageLine))
            .filter(Boolean)
            .map((p) => `endpoint:${p}`),
        )
      : []
    // E. 无 JSON.stringify 的整对象透传:`${text}` / `${text.slice(0, 200)}`,text 取自令牌端点响应
    const interpE = hasDirectStringify
      ? []
      : wholeInterpProvenance(decls, lines, text, usageLine, py)
    // F. 凭据端点关键词 ∧ 整对象 dump:覆盖走 SDK、URL 不在窗口内、变量名/字段名都不像凭据的情形
    const dumpEv = credEndpointDumpEvidence(text, py)
    const evidence = credArgs.length
      ? credArgs
      : viaDecl.length
        ? viaDecl
        : literals.length
          ? literals
          : provenance.length
            ? provenance
            : interpE.length
              ? interpE
              : dumpEv
    if (!evidence.length) {
      for (const arg of args) {
        // 同一文件内同一被序列化变量只记一次(同一条语句常有 status + error 两个上下文命中)
        const k = `${file}::${norm(arg)}`
        if (candidates.some((c) => c.key === k)) continue
        candidates.push({ key: k, file, line: usageLine, arg: norm(arg).slice(0, 60) })
      }
      continue
    }
    const kind = credArgs.length
      ? 'stringify-cred-arg'
      : viaDecl.length
        ? 'stringify-cred-via-declaration'
        : literals.length
          ? 'token-literal-in-message'
          : provenance.length
            ? 'stringify-from-token-endpoint'
            : interpE.length
              ? 'raw-body-from-token-endpoint-in-message'
              : 'cred-endpoint-keyword-with-body-dump'
    /** 稳定 key 后缀:只有 kind + 凭据证据,不含行号、不含整段窗口文本 */
    const snippet = `${kind}|${evidence.join(',')}`
    const key = `${file}::${snippet}`
    if (exempt.has(key)) continue
    const rec = {
      file,
      line: usageLine,
      kind,
      evidence: evidence.join(','),
      snippet,
      key,
      /** 给人看的窗口原文摘录(不进 key) */
      excerpt: norm(text).slice(0, 160),
      /** 该物理点被几个 4xx/5xx 起点命中(跨行写法通常 2 个) */
      contexts: 1,
      lines: [usageLine],
    }
    violations.push(rec)
    const cluster = clusters.get(key) || { recs: [], ranges: [] }
    clusters.set(key, cluster)
    cluster.recs.push(rec)
    cluster.ranges.push([start, endIndex])
    const merged = cluster.ranges.slice(0, -1).findIndex((r) => rangesOverlap(r, [start, endIndex]))
    if (merged >= 0) {
      // 同一物理外泄点的第二个起点 → 撤销刚追加的那条,并入前一条(计数只 +1)
      violations.pop()
      cluster.recs.pop()
      cluster.ranges[merged] = [
        Math.min(cluster.ranges[merged][0], start),
        Math.max(cluster.ranges[merged][1], endIndex),
      ]
      const prev = cluster.recs[merged]
      prev.contexts += 1
      if (!prev.lines.includes(usageLine)) prev.lines.push(usageLine)
    }
  }
  return { violations, candidates }
}

/** 命中项按「生产代码 / 测试代码」分桶:测试代码里的凭据字面量属 mock,降为 warn 不计入失败。 */
export function partitionByTestPath(items) {
  const prod = []
  const test = []
  for (const it of items) (TEST_PATH.test(it.file) ? test : prod).push(it)
  return { prod, test }
}

function gitLines(args) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 待扫文件:--staged 走暂存区,否则走 git ls-files;统一限定源码扩展名与扫描根。 */
export function listCandidatesToScan(staged) {
  const files = staged
    ? gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACM'])
    : gitLines(['ls-files'])
  return files.filter(
    (f) =>
      SCAN_ROOTS.some((r) => f.startsWith(r)) &&
      SOURCE_EXT.has(extname(f).toLowerCase()) &&
      !SKIP_DIR.test(f) &&
      !f.endsWith('.d.ts'),
  )
}

/** 读基线(缺文件/坏 JSON 一律按空基线处理,但由调用方给出提示)。 */
export function readBaselineRaw() {
  if (!existsSync(BASELINE_PATH)) return { ok: true, exempt: [] }
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    const list = Array.isArray(parsed && parsed.exempt) ? parsed.exempt : []
    const keys = list
      .filter((e) => typeof e === 'string')
      .map((e) => e.trim())
      .filter(Boolean)
    return { ok: true, exempt: keys }
  } catch {
    return { ok: false, exempt: [] }
  }
}

export function writeBaseline(keys) {
  const payload = {
    _comment:
      '存量豁免清单:key = "<repo相对路径>::<kind>|<凭据证据>"(证据=凭据类 stringify 实参 / via:<声明名> / literal:<令牌名>,已排序去重)。**刻意不含行号**,故调用点上方增删行不会让豁免失效。只减不增;新增条目须说明理由。',
    exempt: [...new Set(keys)].sort(),
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8')
}

/** 内置判据样例(want: 'violation' | 'candidate' | 'none'),--self-test 与镜像测试共用同一份。 */
export const SELFTEST_CASES = [
  {
    name: '502 + JSON.stringify(tokenData) → 违规',
    src: 'return reply.status(502).send(error(502, `IMS 令牌失败: ${JSON.stringify(tokenData).slice(0, 400)}`))',
    want: 'violation',
  },
  {
    name: '变量名无凭据语义(errData)→ 仅候选',
    src: 'return reply.status(502).send(error(502, `调用失败: ${JSON.stringify(errData).slice(0, 400)}`))',
    want: 'candidate',
  },
  {
    name: '同名无关 token 变量不参与判定(只看被序列化实参)→ 仅候选',
    src: "const tokenResp = await fetch(url)\nreturn reply.status(502).send(error(502, 'x' + JSON.stringify(body)))",
    want: 'candidate',
  },
  {
    name: '对象字面量含 access_token → 违规',
    src: "return reply.status(500).send(error(500, 'e:' + JSON.stringify({ access_token: t })))",
    want: 'violation',
  },
  {
    name: 'message 字面量出现 refresh_token → 违规',
    src: "throw new ApiError(502, 'refresh_token rejected ' + JSON.stringify(payload))",
    want: 'violation',
  },
  {
    name: '跨行拼接(status 在上一行,stringify 在下一行)→ 违规',
    src: 'return reply.status(502).send(\n  error(502, `失败: ${resp.status} ${JSON.stringify(clientSecretPayload).slice(0, 400)}`),\n)',
    want: 'violation',
  },
  {
    name: '非凭据变量跨行 → 仅候选',
    src: 'return reply.status(502).send(\n  error(502, `失败: ${JSON.stringify(genData).slice(0, 400)}`),\n)',
    want: 'candidate',
  },
  {
    name: '经声明间接外泄(const detail = JSON.stringify(authToken))→ 违规',
    src: 'const detail = JSON.stringify(authToken).slice(0, 200)\nreturn reply.status(502).send(error(502, `失败 ${detail}`))',
    want: 'violation',
  },
  {
    name: '2xx 上下文 → 不判(无 4xx/5xx 语义)',
    src: 'return reply.status(200).send(success(200, JSON.stringify(tokenData)))',
    want: 'none',
  },
  {
    name: '注释行 → 忽略',
    src: '// return reply.status(502).send(error(502, JSON.stringify(tokenData)))\nconst a = 1',
    want: 'none',
  },
  {
    name: '401 + bearer 变量 → 违规',
    src: "return reply.status(401).send(error(401, 'bad ' + JSON.stringify(bearerResponse)))",
    want: 'violation',
  },
  // --- D 通道:来源证据(不认变量名,认响应体出处) ---
  {
    name: '来源证据:变量名无凭据语义但值取自设备码端点 → 违规(RFC 8628 device_code)',
    src: "const res = await fetch('https://github.com/login/device/code', { method: 'POST' })\nconst json = (await res.json()) as Record<string, unknown>\nreturn reply.status(400).send(error(400, `设备码获取失败: ${JSON.stringify(json).slice(0, 200)}`))",
    want: 'violation',
  },
  {
    name: '来源证据反例:推理/生成端点响应体 → 仅候选(不含凭据)',
    src: "const resp = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', { method: 'POST' })\nconst data = await resp.json().catch(() => ({}))\nreturn reply.status(502).send(error(502, `失败: ${JSON.stringify(data).slice(0, 400)}`))",
    want: 'candidate',
  },
  {
    name: '来源证据反例:fetch 与外泄点之间跨了路由注册行 → 判定链断开,仅候选',
    src: "const res = await fetch('https://github.com/login/device/code')\nserver.post('/other', async (req, reply) => {\nconst json = await res.json()\nreturn reply.status(400).send(error(400, 'x' + JSON.stringify(json)))\n})",
    want: 'candidate',
  },
  {
    name: '来源证据反例(D 通道):URL 由变量/函数拼出无字面量 → 仅候选(宁漏不误报)',
    src: "const resp = await fetch(authEndpointUrl(), { method: 'POST' })\nconst data = await resp.json()\nreturn reply.status(502).send(error(502, 'e' + JSON.stringify(data)))",
    want: 'candidate',
  },
  // --- E 通道:throw 形态 + 无 JSON.stringify 的整对象透传 ---
  {
    name: 'E 通道:裸 throw new Error 透传令牌端点响应文本 → 违规(paypal.ts 真实形状)',
    src: "const resp = await fetch(`${API_BASE}/v1/oauth2/token`, { method: 'POST' })\nconst text = await resp.text().catch(() => '')\nthrow new Error(`PayPal OAuth2 token failed: ${resp.status} ${text.slice(0, 200)}`)",
    want: 'violation',
  },
  {
    name: 'E 通道反例:只投影 error 字段(${json.error})是推荐写法 → 不判',
    src: "const res = await fetch(`${BASE}/v1/oauth2/token`, { method: 'POST' })\nconst json = (await res.json()) as Record<string, unknown>\nif (!res.ok) throw new Error(`token failed: ${json.error}`)",
    want: 'none',
  },
  {
    name: 'E 通道反例:资源类端点(非令牌)响应文本透传 → 不判(锚在端点性质上)',
    src: "const resp = await fetch(`${BASE}/v1/payments/payment`, { method: 'POST' })\nconst text = await resp.text()\nthrow new Error(`PayPal create failed: ${resp.status} ${text.slice(0, 200)}`)",
    want: 'none',
  },
  // --- F 通道:凭据端点关键词 ∧ 整对象 dump(走 SDK、URL 不在窗口内) ---
  {
    name: 'F 通道:SDK 调 AssumeRole 后整体 dump response.body → 违规(STS 真实形状,D/E 够不到)',
    src: 'const response = await client.callApi(params, request, {})\nif (!creds) throw new Error(`STS AssumeRole 失败: ${JSON.stringify(response.body)}`)',
    want: 'violation',
  },
  {
    name: 'F 通道反例:同关键词但只取 Code 字段(推荐写法)→ 不判',
    src: 'const response = await client.callApi(params, request, {})\nif (!creds) throw new Error(`STS AssumeRole 失败: ${response.Code}`)',
    want: 'none',
  },
  {
    name: 'F 通道反例:整对象 dump 但消息无凭据端点关键词 → 仅候选(不得扩大到厂商代理)',
    src: "const resp = await fetch(url, { method: 'POST' })\nconst data = await resp.json()\nif (!resp.ok) return reply.status(502).send(error(502, `Firefly 调用失败: ${JSON.stringify(data)}`))",
    want: 'candidate',
  },
  // --- Python 形态(ai-service 纳入覆盖;序列化与插值都是另一套语法) ---
  {
    name: 'Python:json.dumps 令牌端点响应 → 违规(D 通道需认 json.dumps)',
    src: 'resp = httpx.post("https://mcp.example.com/oauth2/token", data=p)\ndata = resp.json()\nraise ProviderError(f"令牌获取失败: {json.dumps(data)}")',
    want: 'violation',
    file: 'app/services/mcp_oauth.py',
  },
  {
    name: 'Python:f-string 整对象 + AssumeRole 关键词 → 违规(F 通道)',
    src: 'response = client.call_api(params, request, runtime)\nraise RuntimeError(f"AssumeRole 失败: {json.dumps(response.body)}")',
    want: 'violation',
    file: 'app/services/sts.py',
  },
  {
    name: 'Python 反例:资源端点透传 resp.text 切片 → 不判(与 token6688 现状一致)',
    src: 'resp = httpx.post("https://api.token6688.cn/v1/stt", json=b)\nraise ProviderError(f"Token6688 STT 调用失败: {resp.status_code} {resp.text[:300]}")',
    want: 'none',
    file: 'app/providers/token6688_provider.py',
  },
  {
    name: 'Python 反例:# 注释行不参与判定',
    src: '# raise ProviderError(f"oauth token failed: {json.dumps(body)}")\nx = 1',
    want: 'none',
    file: 'app/services/comment.py',
  },
  {
    name: 'Python 反例:关键词在上一行、dump 在下一行 → 不判(F 须同行配对,系实测假阳性收口)',
    src: 'if resp.status_code == 401:\n    return False, "access_token expired or invalid (401)"\nreturn False, f"verify failed: HTTP {resp.status_code} - {resp.text[:200]}"',
    want: 'none',
    file: 'app/services/publish/adapters/cnblogs.py',
  },
]

/** 对单条样例求解类别(violation / candidate / none),供 --self-test 与镜像测试复用。 */
export function evalCase(src, file = 'selftest.ts') {
  const r = scanSource(src, file)
  return r.violations.length ? 'violation' : r.candidates.length ? 'candidate' : 'none'
}

function selfTest() {
  // 下面每条 src 是故意构造的判据样例(带 cred 语义应被抓住,不带的只做候选/放过)。
  let bad = 0
  for (const c of SELFTEST_CASES) {
    const got = evalCase(c.src, c.file)
    const ok = got === c.want
    if (!ok) bad++
    console.log(`${ok ? '✅' : '❌'} ${c.name}(期望 ${c.want},实得 ${got})`)
  }
  const n = SELFTEST_CASES.length
  console.log(bad === 0 ? `\nself-test 全通过(${n} 例)` : `\nself-test 失败 ${bad}/${n} 例`)
  return bad === 0
}

function printHelp() {
  console.log(
    [
      '用法: node scripts/check-credential-leak-in-message.mjs [选项]',
      '',
      '拦截「上游凭据/令牌类响应体被 JSON.stringify 后塞进 4xx/5xx 错误 message」的外泄路径。',
      '(非 2xx 响应不经 response-sanitizer 脱敏,拼进 message 即绕过脱敏。)',
      '',
      '选项:',
      '  --staged            仅扫描暂存区文件(pre-commit 模式)',
      '  --quiet             只输出结论,不打印低置信候选清单',
      '  --update-baseline   把当前高危违规写入基线(存量豁免,只减不增)',
      '  --self-test         跑内置判据自检',
      '  --help              显示本帮助',
      '',
      '退出码: 0 通过 / 1 检出违规 / 2 脚本自身异常',
    ].join('\n'),
  )
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) {
    printHelp()
    return 0
  }
  if (argv.includes('--self-test')) return selfTest() ? 0 : 1
  const staged = argv.includes('--staged')
  const quiet = argv.includes('--quiet')
  const baseline = readBaselineRaw()
  if (!baseline.ok) {
    console.error(
      '❌ 基线文件 scripts/credential-leak-baseline.json 解析失败(须为 { exempt: string[] })',
    )
    return 2
  }
  const exempt = new Set(baseline.exempt)
  const files = listCandidatesToScan(staged)
  const violations = []
  const candidates = []
  for (const f of files) {
    const abs = resolve(ROOT, f)
    if (!existsSync(abs)) continue
    const found = scanSource(readFileSync(abs, 'utf8'), f, exempt)
    violations.push(...found.violations)
    candidates.push(...found.candidates)
  }
  const mode = staged ? '--staged' : '全量'
  const { prod, test } = partitionByTestPath(violations)
  if (prod.length) {
    console.log(
      `❌ [check-credential-leak-in-message ${mode}] ${prod.length} 处凭据体外泄进错误 message:`,
    )
    for (const v of prod.slice(0, 40)) {
      console.log(
        `   ${v.file}:${v.line} [${v.kind}] 证据 ${v.evidence}` +
          (v.contexts > 1 ? `(同一物理点 ${v.contexts} 个 4xx/5xx 起点,已合并)` : ''),
      )
      console.log(`     ${v.excerpt}`)
    }
    if (prod.length > 40) console.log(`   ... 其余 ${prod.length - 40} 处`)
    console.log(
      '   修复:message 只留厂商/状态码/白名单错误字段,上游响应体不得整体 stringify 回传。',
    )
  } else {
    console.log(
      `✅ [check-credential-leak-in-message ${mode}] 扫描 ${files.length} 文件,凭据外泄高危 0 处`,
    )
  }
  if (test.length) {
    console.log(`⚠️  测试代码 ${test.length} 处命中(warn-only:mock 凭据非真实外泄路径)`)
  }
  if (!quiet && candidates.length) {
    console.log(
      `ℹ️  低置信候选 ${candidates.length} 处(上游错误体透传:变量名无凭据语义 **且** 响应来源非令牌端点 → 不计入失败,仅供人审):`,
    )
    for (const c of candidates.slice(0, 40))
      console.log(`   ${c.file}:${c.line}  整对象序列化入消息: ${c.arg}`)
    if (candidates.length > 40) console.log(`   ... 其余 ${candidates.length - 40} 处`)
  }
  if (argv.includes('--update-baseline')) {
    writeBaseline(prod.map((v) => v.key))
    console.log(`✅ 基线已写入 ${prod.length} 条(只减不增,新增违规仍会被拦)`)
    return 0
  }
  return prod.length ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  Promise.resolve(main())
    .then((code) => process.exit(code ?? 0))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  scanSource,
  findStatusContexts,
  findThrowContexts,
  findErrorContexts,
  extractWindow,
  findStringifyArgs,
  firstArgOf,
  parenDepth,
  advanceQuoted,
  advanceTemplateExpr,
  collectDeclarations,
  resolveDeclaredRhs,
  resolveDeclaredEntry,
  tokenEndpointProvenance,
  wholeInterpProvenance,
  credEndpointDumpEvidence,
  classifyStringifyArg,
  evalCase,
  SELFTEST_CASES,
  listCandidatesToScan,
  partitionByTestPath,
  readBaselineRaw,
  main,
  CRED_SEMANTIC_RE,
  CRED_LITERAL_RE,
  STATUS_CTX_RE,
  TOKEN_ENDPOINT_RE,
  BASELINE_PATH,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
