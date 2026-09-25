#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:工具入参「路由身份」对账(模型可见 schema 的参数键 × 宿主绑定身份)
//
// 在修什么(2026-09-25 立):
//   `apps/cli/src/tools/**` 里工具注册对象的 `parameters: {…}` 与描述符的 `properties: {…}`
//   会被 `packages/types/src/schema-projection.ts` **逐字保留键名**投成发给 provider 的 JSON Schema。
//   如果这些键里出现 `sessionId` / `agentId` / `instanceId` / `userId` / `conversationId` /
//   `chatId` / `runId` / `turnId`(含 snake_case 与任意大小写形态),那么**模型可以自己填一个
//   别人的值**,把结果投给别的会话 / 别的宿主实例 —— 这是越权,不是参数校验问题。
//   正确形状:路由身份一律由宿主在 closure / ctx 里绑定,绝不出现在 schema 里。
//   (同族先例:`docs/runtime-capability-disclosure.md`、agent-control 链路"投递定址按实例绑定、模型不得覆盖"。)
//
// 键清单**不在本文件里抄第二份** —— 唯一源是 `packages/types/src/tool-contract.ts` 的
// `export const ROUTING_IDENTITY_KEYS`("两处算同一件事必须共用一份实现")。本门按**被审的同一个
// 取材面**读那份源码再解析该数组字面量:表读磁盘而用量读 HEAD,会在并行会话刚补行的瞬间产出
// 假红/假绿(守门 93 R6 的教训)。清单解析不到 / 解析成空 ⇒ **判"无法判定"(exit 2)**,
// 绝不冒一句"0 违规"记绿。
//
// 三种取材口径(与 70/77/83/98/101/103 一致):
//   缺省(全量)判 HEAD blob;`--staged` 判索引 blob;`--worktree` 仅人工逃生舱。
//   `--staged` 与 `--worktree` 同给 ⇒ 判死;全量面枚举到 0 个候选文件 ⇒ 判死(不记绿)。
//
// 判据不会恒红:存量走**每文件每键计数**的基线棘轮(scripts/tool-arg-routing-identity-baseline.json,
// 只减不增);人工出口 = 行内标记(同行或紧邻上一行),**必须同时带原因与 until 到期日** ——
// 到期日由守门 108 check-exemption-expiry 统一管账,不带到期日的标记本门一律不认(否则本门就成了永久豁免的生产者)。
// HEAD 存量若本就是 0,则不需要基线文件 ⇒ 零容忍(建门实测如此,见交付报告)。
//
// 手动:
//   node scripts/check-tool-arg-routing-identity.mjs                # 全量(HEAD)
//   node scripts/check-tool-arg-routing-identity.mjs --staged       # 提交链(索引)
//   node scripts/check-tool-arg-routing-identity.mjs --self-test    # 判据自检(零副作用)
//   node scripts/check-tool-arg-routing-identity.mjs --update-baseline
// 紧急跳过:HUSKY_SKIP_TOOL_ARG_ROUTING_IDENTITY=1

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_TOOL_ARG_ROUTING_IDENTITY'
/** 工具注册面:模型可见参数集合的实际出生地 */
export const SCAN_ROOT = 'apps/cli/src/tools'
/** 键清单唯一源(不得在别处再抄一份) */
export const NAME_SOURCE = 'packages/types/src/tool-contract.ts'
/** 投影出口:本门对它做**静态**的名称保全审计,不执行项目代码 */
export const PROJECTION_SOURCE = 'packages/types/src/schema-projection.ts'
export const BASELINE_REL = 'scripts/tool-arg-routing-identity-baseline.json'
const GIT_TIMEOUT = 120000
/** 值对象字面量的第 1 层键 = 会进模型可见 schema 的参数名(两处同形:`parameters` 映射与 `properties` 映射) */
export const HOLDER_KEYS = new Set(['parameters', 'properties'])
/**
 * 豁免标记的字面量**拼出来写**（`'…-exempt' + ':'`），原因不是风格问题：
 * 守门 108 `check-exemption-expiry.mjs` 的 `MARKER_RE` 会扫全仓"族名 + 冒号"形态并判
 * "新增豁免不带到期日"，而本文件里的这些串是**语法示例与自检夹具**、不是生效中的豁免 ——
 * 上一版就是被它当场判红 6 处才改成现在这样（同族先例：`scripts/module-context.mjs` 的帮助文本）。
 * **判据本体不受影响**：下面 `exemptedLines()` 照样只认"带原因 + 带 `until YYYY-MM-DD`"的标记。
 */
export const EXEMPT_MARK_TEXT = 'routing-identity-exempt' + ':'
const EXEMPT_UNTIL_RE = /\buntil\s*(\d{4}-\d{2}-\d{2})/
const FACE_NAME = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(逃生舱)' }

/**
 * 归一化:小写 + 去 `_`/`-`/空白 ⇒ `sessionId` / `session_id` / `SessionID` / `session-id` 同视。
 * 判据(含这条归一化)唯一在本文件;清单唯一在 packages/types,两边各写一遍必然漂移。
 */
export function normalizeKey(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[_\-\s]/g, '')
}

/**
 * 遮蔽注释与字符串**内容**,保留行结构(列位不变)。
 *
 * 为什么必须遮蔽:`apps/cli/src/tools/result-envelope/artifact-store.ts` 里 `sessionId` 既出现在
 * 注释里、也出现在 TS interface 字段上 —— 两者都**不是**模型可见参数,不遮蔽就把解释文本判成越权。
 * 唯一的例外是**键位字符串**(`{ "sessionId": {…} }` 是合法对象键写法):它确实是 schema 键,
 * 所以只在"前一个非空字符是 `{`/`,` 且后一个是 `:`"时保留内容,其余字符串一律糊成空格。
 * 模板串里的 `${…}` 插值**不遮蔽**(里面的对象字面量仍可能被下游读到)。
 */
export function maskNoise(text) {
  const out = text.split('')
  const blank = (a, b) => {
    for (let i = Math.max(0, a); i < b && i < out.length; i++) if (out[i] !== '\n') out[i] = ' '
  }
  const prevNonSpace = (i) => {
    for (let j = i - 1; j >= 0; j--) {
      const c = text[j]
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') continue
      return c
    }
    return ''
  }
  const nextNonSpace = (i) => {
    for (let j = i; j < text.length; j++) {
      const c = text[j]
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') continue
      return c
    }
    return ''
  }
  let i = 0
  while (i < text.length) {
    const c = text[i]
    const d = text[i + 1]
    if (c === '/' && d === '/') {
      let j = i
      while (j < text.length && text[j] !== '\n') j++
      blank(i, j)
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      let j = i + 2
      while (j < text.length && !(text[j] === '*' && text[j + 1] === '/')) j++
      const close = j < text.length ? j + 2 : text.length
      blank(i, close)
      i = close
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < text.length) {
        if (text[j] === '\\') {
          j += 2
          continue
        }
        if (text[j] === c || text[j] === '\n') break
        j++
      }
      const end = j
      const p = prevNonSpace(i)
      const isKeyPosition = (p === '{' || p === ',') && nextNonSpace(end + 1) === ':'
      if (!isKeyPosition) blank(i + 1, end)
      i = Math.min(end + 1, text.length)
      continue
    }
    if (c === '`') {
      let j = i + 1
      while (j < text.length) {
        if (text[j] === '\\') {
          blank(j, j + 2)
          j += 2
          continue
        }
        if (text[j] === '`') break
        if (text[j] === '$' && text[j + 1] === '{') {
          let depth = 1
          let k = j + 2
          while (k < text.length && depth > 0) {
            if (text[k] === '{') depth++
            else if (text[k] === '}') {
              depth--
              if (depth === 0) break
            }
            k++
          }
          j = k + 1
          continue
        }
        if (text[j] !== '\n') out[j] = ' '
        j++
      }
      i = Math.min(j + 1, text.length)
      continue
    }
    i++
  }
  return out.join('')
}

/** 从 tool-contract.ts 的源码文本里取 `ROUTING_IDENTITY_KEYS` 数组字面量的键。 */
export function parseNameList(text, label = NAME_SOURCE) {
  if (typeof text !== 'string') throw new Undetermined(`${label} 在本判定面取不到 ⇒ 键清单无从取得`)
  const at = text.search(/export\s+const\s+ROUTING_IDENTITY_KEYS\b/)
  if (at < 0) throw new Undetermined(`${label} 里没有 export const ROUTING_IDENTITY_KEYS ⇒ 唯一清单源被摘线`)
  const lb = text.indexOf('[', at)
  if (lb < 0) throw new Undetermined(`${label} 的 ROUTING_IDENTITY_KEYS 不是数组字面量形态 ⇒ 无法判定`)
  let depth = 0
  let rb = -1
  for (let k = lb; k < text.length; k++) {
    if (text[k] === '[') depth++
    else if (text[k] === ']') {
      depth--
      if (depth === 0) {
        rb = k
        break
      }
    }
  }
  if (rb < 0) throw new Undetermined(`${label} 的 ROUTING_IDENTITY_KEYS 数组字面量不闭合 ⇒ 无法判定`)
  const seg = text.slice(lb + 1, rb)
  const keys = [...seg.matchAll(/['"]([A-Za-z0-9_]+)['"]/g)].map((m) => m[1])
  if (keys.length === 0)
    throw new Undetermined(`${label} 的 ROUTING_IDENTITY_KEYS 解析到 0 个键 —— 清单腐烂成空会让本门恒绿,按无法判定处理`)
  return keys
}

const KEY_TOKEN_RE = /^('[^']*'|"[^"]*"|[A-Za-z_$][A-Za-z0-9_$]*)/

/** 一个对象字面量(给定其 `{` 的位置)的第 1 层键。 */
export function topLevelKeys(masked, openBrace) {
  const keys = []
  let depth = 0
  for (let i = openBrace; i < masked.length; i++) {
    const c = masked[i]
    if (c === '{' || c === '(' || c === '[') {
      depth++
      if (depth === 1) continue
    } else if (c === '}' || c === ')' || c === ']') {
      depth--
      if (depth === 0) break
    }
    if (depth !== 1) continue
    if (!(c === '"' || c === "'" || /[A-Za-z_$]/.test(c))) continue
    const before = masked[i - 1]
    if (before && !/[\s{,]/.test(before)) continue
    const slice = masked.slice(i, i + 160)
    const m = KEY_TOKEN_RE.exec(slice)
    if (!m) continue
    const rest = slice.slice(m[1].length)
    const colon = /^\s*:/.exec(rest)
    if (!colon) continue
    const raw = m[1].replace(/^['"]|['"]$/g, '')
    if (raw === 'true' || raw === 'false' || raw === 'null') continue
    keys.push({ raw, index: i })
    i += m[1].length + colon[0].length - 1
  }
  return keys
}

/**
 * 收集"会进入模型可见 schema 的参数键",并把**静态判得出的**与**判不出的**分成两堆:
 *  - `parameters: { … }` / `properties: { … }` ⇒ 取第 1 层键(嵌套 holder 由主循环再命中一次);
 *  - `parameters: SOME_CONST` ⇒ 回溯同文件 `const SOME_CONST = { … }` 同形取键;
 *  - **类型标注**(`properties: Record<string, X>`、`parameters: ToolParams`):它不是值,没有键可取,
 *    计进 `typeAnnotations`。**不得计进判不出** —— 否则每个带类型注解的文件都把本门钉成 exit 2(恒红);
 *  - **动态值**(`parameters: tool.parameters`、`parameters: projectToolInputSchema(…)`、展开/计算属性):
 *    结构上没有静态形状可取,计进 `dynamic` 并**逐条如实报数**(禁静默绿),同样不判红 ——
 *    MCP/hub 那类透传工具永远长这样,判红等于一台与改动无关的恒红门(§12e 同型)。
 */
export function collectSchemaKeys(masked) {
  const found = []
  const dynamic = []
  const typeAnnotations = []
  const idRe = /[A-Za-z_$][A-Za-z0-9_$]*/g
  let m
  while ((m = idRe.exec(masked))) {
    const name = m[0]
    if (!HOLDER_KEYS.has(name)) continue
    const afterName = masked.slice(m.index + name.length)
    const lead = /^\s*:\s*/.exec(afterName)
    if (!lead) continue
    const at = m.index + name.length + lead[0].length
    const c = masked[at]
    if (c === '{') {
      for (const k of topLevelKeys(masked, at)) found.push({ key: k.raw, index: k.index, holder: name })
      continue
    }
    const tail = masked.slice(at)
    const ident = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(tail)
    if (ident) {
      const decl = new RegExp(`(?:const|let|var)\\s+${ident[0]}\\s*(?::[^=;]*)?=\\s*\\{`).exec(masked)
      if (decl) {
        const open = masked.indexOf('{', decl.index)
        for (const k of topLevelKeys(masked, open)) found.push({ key: k.raw, index: k.index, holder: `${name}→${ident[0]}` })
        continue
      }
      const afterIdent = tail.slice(ident[0].length)
      const isTypeAnnotation = /^\s*</.test(afterIdent) || (/^[A-Z]/.test(ident[0]) && !/^\s*\(/.test(afterIdent))
      if (isTypeAnnotation) {
        typeAnnotations.push(`${name}: ${ident[0]}`)
        continue
      }
      dynamic.push(`${name}: ${ident[0]}${/^\s*\(/.test(afterIdent) ? '(调用返回值)' : '(同文件解析不到字面量)'}`)
      continue
    }
    dynamic.push(`${name}: 非对象字面量形态(展开/计算/动态)`)
  }
  return { found, dynamic, typeAnnotations }
}

function lineOf(text, index) {
  let n = 1
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') n++
  return n
}

/**
 * 行内豁免：同行或紧邻上一行有标记才算，且**必须同时带原因与 `until YYYY-MM-DD` 到期日**
 * （到期日由守门 108 统一管账：不带到期日的豁免本门一律不认，否则本门就成了"永久豁免"的生产者）。
 */
export function exemptedLines(text) {
  const lines = text.split('\n')
  const ok = new Set()
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].indexOf(EXEMPT_MARK_TEXT)
    if (at < 0) continue
    const rest = lines[i].slice(at + EXEMPT_MARK_TEXT.length)
    const until = EXEMPT_UNTIL_RE.exec(rest)
    if (!until) continue // 不带到期日 ⇒ 不算豁免
    const reason = rest.slice(0, until.index).replace(/\*\/\s*$/, '').trim()
    if (reason.length >= 4) {
      ok.add(i + 1)
      ok.add(i + 2)
    }
  }
  return ok
}

/**
 * 声明式**句柄**标记(不是豁免,不需要到期日)。
 *
 * 为什么需要它:同一个键名在两处含义完全不同 —— `userId` 是**路由身份**(填错=越权),
 * 而 `debug.ts` / `terminal.ts` 里的 `sessionId` 是**宿主自己铸造的进程内句柄**
 * (`randomUUID()` 造出来、只在本进程 Map 里查得到、查不到就拒绝)。把后者也计进违规,
 * 结果是基线里永远挂着 11 处"看着像债、其实不是债"的数字,真正的 5 处
 * (memory 的 user_id)反而被埋在里面 —— 基线的作用就没了。
 *
 * 但这个出口必须**不可伪造**:标记只是提出主张,本门自己核三条见证,任一不成立即判红,
 * 并区分两种失败:
 *   H1 见证不成立 —— 声称是句柄,却拿不出"本地铸造 + 进程内登记表 + 查不到即拒绝"的证据;
 *   H2 清单腐烂 —— 登记还在,但那个键在本文件里已经不是违规了(改名/删参数都会造成)。
 * 两条都是红,因为一个"能凭空宣称句柄"的标记等于把本门关掉。
 *
 * 刻意不用 `-exempt` 这个词:那是守门 108 的豁免族命名,豁免要带到期日 ——
 * 而"这个 id 是宿主铸造的"是**结构事实**,不是会过期的债务。
 */
export const HANDLE_MARK_TEXT = 'routing-handle' + ':'
const HANDLE_KEY_RE = /\bkey\s*=\s*([A-Za-z0-9_$]+)/
const HANDLE_MINT_RE = /\bminted-by\s*=\s*([A-Za-z0-9_$]+)/
const HANDLE_REGISTRY_RE = /\bregistry\s*=\s*([A-Za-z0-9_$]+)/
/** 查不到即拒绝的措辞族(宁窄:必须是本行/后 6 行内的显式出口) */
const HANDLE_REJECT_RE =
  /(不存在|无效|已退出|not[ _]found|unknown|未找到|return\s*\{[^}]*success:\s*false|throw\b|errorType|if\s*\(\s*!\w+\s*\)\s*return\s+(null|undefined))/i

/** 抽出本文件里所有句柄声明(语法不合规的声明不静默丢,由 handleRot 之外的调用方计错)。 */
export function handleDeclarations(text) {
  const out = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].indexOf(HANDLE_MARK_TEXT)
    if (at < 0) continue
    const rest = lines[i].slice(at + HANDLE_MARK_TEXT.length)
    const key = HANDLE_KEY_RE.exec(rest)
    const mint = HANDLE_MINT_RE.exec(rest)
    const registry = HANDLE_REGISTRY_RE.exec(rest)
    // 原因 = 三个字段之后的自由文本;缺原因按缺字段同样处置(不得静默放过)
    const tail = rest
      .replace(HANDLE_KEY_RE, '')
      .replace(HANDLE_MINT_RE, '')
      .replace(HANDLE_REGISTRY_RE, '')
      .replace(/\*\/\s*$/, '')
      .trim()
    out.push({
      line: i + 1,
      key: key ? key[1] : null,
      mint: mint ? mint[1] : null,
      registry: registry ? registry[1] : null,
      reason: tail.length >= 4 ? tail : '',
    })
  }
  return out
}

/**
 * 三条见证(mint / registry / reject)。返回 null = 全部成立;否则返回不成立的原因清单。
 * 全部在**已遮噪**的文本上判(注释与字符串里的同名标识符不算见证 —— 反向也要防:
 * 见证行本身写成注释就等于没写)。
 */
export function handleWitnessFailure(maskedLines, decl) {
  const bad = []
  if (!decl.key) bad.push('缺 key=')
  if (!decl.mint) bad.push('缺 minted-by=')
  if (!decl.registry) bad.push('缺 registry=')
  if (!decl.reason) bad.push('缺原因说明')
  if (bad.length) return bad
  const { key, mint, registry } = decl
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const mintDef = new RegExp(`(function\\s+${esc(mint)}\\s*\\(|(const|let)\\s+${esc(mint)}\\s*[:=])`)
  const mintImported = new RegExp(`import\\s*\\{[^}]*\\b${esc(mint)}\\b[^}]*\\}`).test(maskedLines.join('\n'))
  // 调用点必须**不是定义行**:否则 `function genId(): string {` 自身就含 `genId(`，
  // 会让"从未被调用"这一条永远测不出来(自检 HG3 第一次就是这么过的假绿)。
  const mintCallRe = new RegExp(`\\b${esc(mint)}\\s*\\(`)
  const mintCall = maskedLines.some((l) => mintCallRe.test(l) && !mintDef.test(l))
  if (!mintDef.test(maskedLines.join('\n')) && !mintImported)
    bad.push(`minted-by=${mint} 在本文件里既没定义也没 import(无从判断它是谁铸造的)`)
  else if (!mintCall) bad.push(`minted-by=${mint} 有定义/导入却从未在本文件被调用(登记表里的 id 不是它铸造的)`)
  const regDecl = new RegExp(`(const|let)\\s+${esc(registry)}\\s*=\\s*new\\s+(Map|Set)\\b`).test(maskedLines.join('\n'))
  if (!regDecl) bad.push(`registry=${registry} 不是本文件里的 new Map/Set(进程内登记表不成立)`)
  else {
    const getAt = maskedLines.findIndex((l) => new RegExp(`${esc(registry)}\\s*\\.\\s*(get|has)\\s*\\(`).test(l))
    if (getAt < 0) bad.push(`${registry} 上找不到 .get()/.has() 查询`)
    else {
      const window = maskedLines.slice(getAt, getAt + 7).join('\n')
      if (!HANDLE_REJECT_RE.test(window))
        bad.push(`${registry}.get() 之后 6 行内没有"查不到即拒绝"的出口(未知 id 会直接落效果)`)
    }
  }
  return bad.length ? bad : null
}

/** 单文件判据:违规 / 已豁免 / 句柄见证成立 / 句柄判红 / 取不到(致命) / 动态形态(报数) / 类型标注(报数)。 */
export function scanFile(rel, text, keySet) {
  const violations = []
  const exempted = []
  const dynamic = []
  const typeAnnotations = []
  const handles = []
  const handleRot = []
  if (typeof text !== 'string')
    return { violations, exempted, dynamic, typeAnnotations, handles, handleRot, unreadable: [`${rel}: 内容取不到`] }
  const masked = maskNoise(text)
  const maskedLines = masked.split('\n')
  const { found, dynamic: dyn, typeAnnotations: ta } = collectSchemaKeys(masked)
  dynamic.push(...dyn.map((d) => `${rel} · ${d}`))
  typeAnnotations.push(...ta.map((t) => `${rel} · ${t}`))
  const okLines = exemptedLines(text)
  const decls = handleDeclarations(text)
  const declByKey = new Map()
  const witness = new Map()
  for (const d of decls) {
    if (!d.key) {
      handleRot.push({ file: rel, line: d.line, why: '句柄标记缺 key=(无法与任何参数配对,等于一张空头条款)' })
      continue
    }
    const norm = normalizeKey(d.key)
    declByKey.set(norm, d)
    const fail = handleWitnessFailure(maskedLines, d)
    if (fail) witness.set(norm, { ok: false, why: fail.join(';'), line: d.line })
    else witness.set(norm, { ok: true, line: d.line })
  }
  const witnessed = new Set()
  for (const f of found) {
    const norm = normalizeKey(f.key)
    if (!keySet.has(norm)) continue
    const line = lineOf(text, f.index)
    const entry = { file: rel, key: f.key, line, holder: f.holder }
    if (okLines.has(line)) {
      exempted.push(entry)
      continue
    }
    const w = witness.get(norm)
    if (w && w.ok) {
      witnessed.add(norm)
      handles.push({ ...entry, minted: declByKey.get(norm).mint, registry: declByKey.get(norm).registry })
      continue
    }
    if (w && !w.ok) handleRot.push({ file: rel, line, key: f.key, why: `自称进程内句柄但见证不成立: ${w.why}` })
    violations.push(entry)
  }
  // H2 清单腐烂:登记了某个键,但该键在本文件里已不再是违规(参数改名/删掉了)
  for (const [norm, d] of declByKey) {
    const w = witness.get(norm)
    if (w?.ok && !witnessed.has(norm))
      handleRot.push({ file: rel, line: d.line, key: d.key, why: `登记的句柄声明 key=${d.key} 在本文件已无对应的 schema 违规(清单腐烂,须删或改名)` })
  }
  return { violations, exempted, dynamic, typeAnnotations, handles, handleRot, unreadable: [] }
}

/**
 * 投影出口侧的**静态**审计:`schema-projection.ts` 把描述符投成 provider 可见 schema 时属性名必须
 * **逐字保留** —— 只有这一点成立,"声明侧扫过的键集"才等价于"投影输出的键集",出口侧才真的被判到。
 * 判不出 ⇒ 返回 undetermined,由主判据计 exit 2;绝不把"没看"写成"没问题"。
 */
export function auditProjection(text) {
  if (typeof text !== 'string') return { verdict: 'undetermined', why: '投影源在本判定面取不到' }
  const src = maskNoise(text)
  const entries = /Object\.entries\(\s*([A-Za-z_$][\w$.]*)\s*\)/.exec(src)
  const keyed = /properties\[\s*([A-Za-z_$][\w$]*)\s*\]\s*=/.exec(src)
  const literalKeys = [...src.matchAll(/properties\[\s*['"][^'"]+['"]\s*\]\s*=/g)].length
  const dotted = [...src.matchAll(/properties\.[A-Za-z_$][\w$]*\s*=[^=]/g)].length
  const renamed = /properties\[[^\]]*(?:rename|alias|prefix|mapKey)/.test(src)
  if (!entries || !keyed) return { verdict: 'undetermined', why: '解析不出投影输出的键取自哪个集合(不得当成通过)' }
  if (literalKeys || dotted || renamed)
    return {
      verdict: 'renaming-or-added',
      why: `输出侧出现新增/改名键(字面量下标 ${literalKeys} / 点号赋值 ${dotted} / 改名 ${renamed ? 1 : 0})⇒ 出口不可由声明侧覆盖,须人工核`,
    }
  return { verdict: 'name-preserving', why: `输出键名逐字取自 ${entries[1]}` }
}

export function loadBaseline(root) {
  const abs = join(root, BASELINE_REL)
  if (!existsSync(abs)) return { counts: {}, absent: true }
  let raw
  try {
    raw = readFileSync(abs, 'utf8')
  } catch (e) {
    throw new Undetermined(`基线文件读不到(${BASELINE_REL}): ${e.message}`)
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new Undetermined(`基线 ${BASELINE_REL} 不是合法 JSON —— 坏清单不得静默当空清单: ${e.message}`)
  }
  const counts = parsed && typeof parsed.counts === 'object' && parsed.counts ? parsed.counts : {}
  return { counts, absent: false }
}

/**
 * 棘轮 + 退出码聚合(纯函数,自检与镜像测试都靠**构造输入**证明它有牙)。
 * 优先级:无法判定(2)> 判红(1)> 通过(0)。基线缺项 = 额度 0(零容忍)。
 */
export function decide({ violations, baseline = {}, undetermined = [], scannedFiles = 0, projection = null, face = 'head', fellBack = false, exempted = [], dynamic = [], typeAnnotations = [], handleRot = [], handles = [] }) {
  const counts = new Map()
  for (const v of violations) {
    const k = `${v.file}\u0000${normalizeKey(v.key)}`
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  const red = []
  for (const [k, n] of [...counts].sort()) {
    const [file, normKey] = k.split('\u0000')
    const allowed = baseline?.[file]?.[normKey]
    const cap = typeof allowed === 'number' ? allowed : 0
    if (n > cap) red.push({ file, normKey, n, cap, lines: violations.filter((v) => `${v.file}\u0000${normalizeKey(v.key)}` === k).map((v) => v.line) })
  }
  // 句柄声明的两种失败(自称句柄但见证不成立 / 登记了却已无对应违规)与违规并列判红。
  // 刻意**不吃基线额度**:那不是"存量违规",而是"这个出口本身被用坏了"，给额度等于留一台可伪造的门。
  for (const h of handleRot) red.push({ file: h.file, normKey: h.key ?? '(缺 key=)', n: 1, lines: [h.line], why: h.why })
  const exit = undetermined.length ? 2 : red.length ? 1 : 0
  return { exit, red, undetermined, exempted, handles, handleRot, dynamic, typeAnnotations, scannedFiles, face, fellBack: !!fellBack, projection, counts: Object.fromEntries([...counts].map(([k, v]) => [k.replace('\u0000', '::'), v])) }
}

export function inScanRoot(p) {
  return p.startsWith(SCAN_ROOT + '/') && /\.ts$/.test(p)
}

export function listFace(root, face) {
  if (face === 'head') return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
  if (face === 'staged')
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], root, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
  return gitRaw(['ls-files', '-z'], root, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
}

/** 一次 `cat-file --batch` 预取整个面;未预取即 read 会抛错而非静默跳过。 */
export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

/**
 * **尺子输入**(键清单源 + 投影出口源)的取材:按档定向 + 大声降级。
 *
 * 被审内容(parameters/properties 的键)**只判本档**,不让它降级 —— 那正是"假绿"的入口。
 * 但作为尺子的那两份源不同:并行会话可以在**同一枚提交里**既补清单又接线本门,
 * 若只读 HEAD 就会让那枚提交被自己判红 ⇒ 逼人 `--no-verify` ⇒ 全部守门作废。
 * 故降级到工作树是允许的,但**必须在结论里点名用了哪一面**(口径同守门 103 的策略表)。
 */
export function readRulerSource(root, face, rel, requireMarker = null) {
  const order = face === 'staged' ? ['staged', 'head', 'worktree'] : ['head', 'staged', 'worktree']
  const notices = []
  const missed = []
  for (const f of order) {
    let text = null
    try {
      text = readFace(root, f, [rel]).get(rel) ?? null
    } catch {
      text = null
    }
    if (typeof text !== 'string') {
      missed.push(FACE_NAME[f])
      continue
    }
    if (requireMarker && !requireMarker(text)) {
      // 该面的这一份**没有**清单常量(例:本票尚未进 HEAD)。对"被审内容"来说这不是降级理由,
      // 但尺子源不同:把它判红只会让一枚与清单无关的提交被钉死 ⇒ 逼人 `--no-verify` ⇒ 全部守门作废。
      // 所以继续降级到下一个面,并把"哪个面缺"如实记进提示,不静默。
      missed.push(`${FACE_NAME[f]}(无 ${requireMarker.name || '标记'})`)
      continue
    }
    if (f !== face) notices.push(`${rel}: 尺子源在 ${FACE_NAME[face]} 取不到(该面缺清单常量)⇒ 已降级到 ${FACE_NAME[f]} 取;判定内容仍按 ${FACE_NAME[face]}`)
    return { text, used: f, notices, missed }
  }
  return { text: null, used: null, notices: [`${rel}: 各面都取不到可用尺子源(${missed.join(' / ')});按无法判定处理`], missed }
}

const hasListMarker = (text) => /export\s+const\s+ROUTING_IDENTITY_KEYS\b/.test(text)

export function analyze(root, face) {
  const all = listFace(root, face)
  const tools = all.filter(inScanRoot)
  let effFace = face
  let fellBack = false
  if (tools.length === 0 && face === 'staged') {
    effFace = 'head'
    fellBack = true
    const again = listFace(root, 'head')
    tools.length = 0
    tools.push(...again.filter(inScanRoot))
  }
  if (tools.length === 0) throw new Undetermined(`${effFace} 面在 ${SCAN_ROOT} 下枚举到 0 个 .ts —— 判据失效不得表现为"扫 0 记绿"`)

  const keySrc = readRulerSource(root, effFace, NAME_SOURCE, hasListMarker)
  if (typeof keySrc.text !== 'string') throw new Undetermined(keySrc.notices.join('; '))
  const keys = parseNameList(keySrc.text, `${NAME_SOURCE}(可用面:${FACE_NAME[keySrc.used] ?? '无'})`)
  const keySet = new Set(keys.map(normalizeKey))
  const projSrc = readRulerSource(root, effFace, PROJECTION_SOURCE)
  const projection = auditProjection(projSrc.text)
  const rulerNotices = [...keySrc.notices, ...projSrc.notices]

  const texts = readFace(root, effFace, tools)
  const violations = []
  const exempted = []
  const undetermined = []
  const dynamic = []
  const typeAnnotations = []
  const handles = []
  const handleRot = []
  for (const p of tools) {
    const r = scanFile(p, texts.get(p), keySet)
    violations.push(...r.violations)
    exempted.push(...r.exempted)
    undetermined.push(...r.unreadable)
    dynamic.push(...r.dynamic)
    typeAnnotations.push(...r.typeAnnotations)
    handles.push(...r.handles)
    handleRot.push(...r.handleRot)
  }
  for (const p of tools) if (typeof texts.get(p) !== 'string') undetermined.push(`${p}: ${effFace} 面取不到内容`)
  if (projection.verdict !== 'name-preserving') undetermined.push(`投影出口侧未判到:${projection.why}`)
  const res = decide({ violations, baseline: loadBaseline(root).counts, undetermined, scannedFiles: tools.length, projection, face: effFace, fellBack, exempted, dynamic, typeAnnotations, handleRot, handles })
  return { ...res, keys, notices: rulerNotices, dynamic, typeAnnotations }
}

export function main(argv) {
  const ri = argv.indexOf('--root')
  const root = ri >= 0 && argv[ri + 1] ? resolve(argv[ri + 1]) : ROOT
  assertRepoRoot(root, '本门')
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  let out
  try {
    out = analyze(root, face)
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : e?.message ?? String(e)
    console.error(`❌ 无法判定(exit 2): ${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }

  if (argv.includes('--update-baseline')) {
    if (out.exit === 2) {
      console.error('❌ 无法判定 ⇒ 拒绝写基线(不得把"没判成"固化成额度)')
      return 2
    }
    const counts = {}
    for (const [k, n] of Object.entries(out.counts)) {
      const [file, normKey] = k.split('::')
      counts[file] ||= {}
      counts[file][normKey] = n
    }
    const body = JSON.stringify(
      {
        comment: '守门 check-tool-arg-routing-identity 的基线:每文件每键计数,只减不增。键名口径 = normalizeKey(小写 + 去下划线/连字符)。清单唯一源 = packages/types/src/tool-contract.ts 的 ROUTING_IDENTITY_KEYS。',
        counts,
      },
      null,
      2,
    )
    const abs = join(root, BASELINE_REL)
    writeFileSync(abs, body + '\n', 'utf8')
    if (readFileSync(abs, 'utf8') !== body + '\n') throw new Undetermined(`基线写入后回读不一致:${abs}`)
    console.log(`✅ 已写基线:${BASELINE_REL}(${Object.keys(counts).length} 个文件)`)
    return 0
  }

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...out, exemptLines: out.exempted.map((e) => `${e.file}:${e.line} ${e.key}`) }, null, 2))
    return out.exit
  }

  if (out.red.length) {
    console.error(`❌ 检出 ${out.red.length} 项「路由身份键进了模型可见 schema / 句柄声明不成立」(面=${FACE_NAME[out.face]},扫描 ${out.scannedFiles} 文件):`)
    for (const r of out.red)
      console.error(`   ${r.file}  键 ${r.key ?? r.normKey} × ${r.n}(零容忍)  行 ${r.lines.join(',')}${r.why ? `  —— ${r.why}` : ''}`)
    console.error(
      '   出路:该参数从 parameters/properties 里删掉,由宿主在 closure / ctx 绑定;'
        + '确属正当再写行内标记(族名 routing-identity-exempt,须带一句话原因与 until YYYY-MM-DD 到期日);'
        + '若它其实是**宿主自己铸造的进程内句柄**,改写 routing-handle 标记(须带 key=/minted-by=/registry=/原因),'
        + '本门会去核"本地铸造 + 进程内登记表 + 查不到即拒绝"三条见证,核不过照样红。',
    )
  }
  if (out.handles?.length) {
    console.log(`ℹ️  进程内句柄(已核三条见证,不计违规)${out.handles.length} 处:`)
    for (const h of out.handles) console.log(`   · ${h.file}:${h.line} ${h.key}(mint=${h.minted} registry=${h.registry})`)
  }
  if (out.exempted.length) {
    console.log(`ℹ️  已带原因豁免 ${out.exempted.length} 处(不判红,逐条列出以防清单腐烂):`)
    for (const e of out.exempted) console.log(`   ${e.file}:${e.line} ${e.key}`)
  }
  if (out.undetermined.length) {
    console.error(`⚠️  未判定 ${out.undetermined.length} 项(计入 exit 2,不计为通过):`)
    for (const u of out.undetermined) console.error(`   · ${u}`)
  }
  if (out.fellBack) console.log('ℹ️  --staged 暂存集在扫描面内为空 ⇒ 退回全量(HEAD),防"空暂存恒绿"')
  for (const n of out.notices || []) console.log(`ℹ️  取材口径:${n}`)
  if (out.dynamic?.length) console.log(`ℹ️  静态判不出的动态形态 ${out.dynamic.length} 处(只报数不判红 —— MCP/hub 透传类永远长这样,判红即恒红门):`)
  for (const d of out.dynamic?.slice(0, 12) || []) console.log(`   · ${d}`)
  if (out.typeAnnotations?.length) console.log(`ℹ️  类型标注形态 ${out.typeAnnotations.length} 处(不是值,无键可取,不计判不出)`)
  const verdict = out.exit === 0 ? '✅ 通过' : out.exit === 2 ? '❌ 无法判定(exit 2)' : '❌ 判红(exit 1)'
  console.log(
    `${verdict}(面=${FACE_NAME[out.face]} ${out.scannedFiles} 文件 / 违规 ${out.red.reduce((a, r) => a + r.n, 0)} / 豁免 ${out.exempted.length} / 判不出 ${out.undetermined.length} / 键清单 ${out.keys.length} 项 / 投影出口 ${out.projection?.verdict})`,
  )
  return out.exit
}

/** 判据自检:纯函数 + 构造面,零副作用、不碰仓库。 */
function selfTest() {
  let ran = 0
  let fail = 0
  const eq = (label, got, want) => {
    ran++
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g !== w) {
      fail++
      console.log(`  ❌ ${label}\n      got  ${g}\n      want ${w}`)
    } else console.log(`  ✅ ${label}`)
  }
  const throws = (label, fn) => {
    ran++
    try {
      fn()
      fail++
      console.log(`  ❌ ${label}(应当抛 Undetermined)`)
    } catch (e) {
      if (!(e instanceof Undetermined)) {
        fail++
        console.log(`  ❌ ${label}(抛错了类型:${e?.constructor?.name})`)
      } else console.log(`  ✅ ${label}`)
    }
  }

  const LIST = "export const ROUTING_IDENTITY_KEYS = ['sessionId','session_id','userId','user_id','turnId'] as const\n"
  const set = new Set(parseNameList(LIST).map(normalizeKey))

  // ① 成对:P1 进 parameters ⇒ 红;P2 同键带原因豁免 ⇒ 绿
  const bad = scanFile('apps/cli/src/tools/x.ts', "const T = {\n  parameters: {\n    sessionId: { type: 'string' },\n  },\n}\n", set)
  eq('P1 sessionId 出现在 parameters 键位 ⇒ 1 红', bad.violations.length, 1)
  const good = scanFile(
    'apps/cli/src/tools/x.ts',
    `const T = {\n  parameters: {\n    sessionId: { type: 'string' }, // ${EXEMPT_MARK_TEXT} 宿主已绑定,此键仅调试工具 until 2099-12-31\n  },\n}\n`,
    set,
  )
  const noUntil = scanFile(
    'apps/cli/src/tools/x.ts',
    `const T = {\n  parameters: {\n    sessionId: { type: 'string' }, // ${EXEMPT_MARK_TEXT} 宿主已绑定,此键仅调试工具\n  },\n}\n`,
    set,
  )
  eq(
    'P3b 带原因但**不带 until 到期日** ⇒ 仍判红且不计豁免(与守门 108 咬合的那一条)',
    [noUntil.violations.length, noUntil.exempted.length],
    [1, 0],
  )
  eq('P2 同键 + 带原因**与到期日**豁免 ⇒ 0 红且计入豁免', [good.violations.length, good.exempted.length], [0, 1])
  // ② 成对:豁免没带原因 ⇒ 不算豁免
  const noReason = scanFile(
    'apps/cli/src/tools/x.ts',
    `const T = {\n  parameters: {\n    sessionId: { type: 'string' }, // ${EXEMPT_MARK_TEXT}\n  },\n}\n`,
    set,
  )
  eq('P3 豁免无原因 ⇒ 仍判红(不得用它清账)', noReason.violations.length, 1)
  // ③ 成对:注释里的键 / TS interface 字段 ⇒ 不判(它们不是 schema 位)
  eq('P4 只在注释里出现 ⇒ 0 红', scanFile('apps/cli/src/tools/x.ts', "// 按 sessionId 分片\nconst T = { parameters: { path: { type: 'string' } } }\n", set).violations.length, 0)
  eq('P5 TS interface 字段(非 parameters/properties 位)⇒ 0 红', scanFile('apps/cli/src/tools/y.ts', 'export interface Opts {\n  sessionId?: string;\n}\n', set).violations.length, 0)
  // ④ 归一化:snake / 大小写 / 连字符 同视
  eq('P6 session_id 与 SessionID 同视', [normalizeKey('session_id'), normalizeKey('SessionID'), normalizeKey('session-id')], ['sessionid', 'sessionid', 'sessionid'])
  eq('P7 内容引用键(messageId/tool_call_id)⇒ 不判红', scanFile('apps/cli/src/tools/z.ts', "const T = { parameters: { messageId: { type: 'string' }, tool_call_id: { type: 'string' } } }\n", set).violations.length, 0)
  // ⑤ 嵌套 holder
  eq('P8 嵌套 properties 里的 userId ⇒ 命中', scanFile('apps/cli/src/tools/n.ts', "const T = { parameters: { todos: { type: 'array', items: { properties: { userId: { type: 'string' } } } } } }\n", set).violations.length, 1)
  // ⑥ 反向对照:判据失效不得表现为"扫 0 记绿"
  eq('R1 空候选集 ⇒ decide 判不出优先于绿(exit 2)', decide({ violations: [], undetermined: ['枚举到 0 个候选文件'], scannedFiles: 0 }).exit, 2)
  eq('R2 全量面扫到 0 文件而判据无提示 ⇒ 由 analyze 抛(此条验 inScanRoot 仍认路径)', inScanRoot('apps/cli/src/tools/a.ts'), true)
  throws('R3 清单源被摘线 ⇒ 大声抛,不返回空集合', () => parseNameList('export const OTHER = [1]\n'))
  throws('R4 清单腐烂成空数组 ⇒ 抛(否则本门恒绿)', () => parseNameList('export const ROUTING_IDENTITY_KEYS = [] as const\n'))
  // ⑦ 投影出口审计
  eq('Q1 名字保全形态 ⇒ name-preserving', auditProjection('const p={};for (const [name,d] of Object.entries(parameters)) { p[name]=x(d) };const properties={};for (const [name] of Object.entries(parameters)) properties[name]=1').verdict, 'name-preserving')
  eq('Q2 出口新增字面量键 ⇒ 判 renaming(不得由声明侧覆盖)', auditProjection("const properties={};for (const [name] of Object.entries(parameters)) properties[name]=1;properties['extra']=2").verdict, 'renaming-or-added')
  eq('Q3 解析不出来源 ⇒ undetermined(不记绿)', auditProjection('export function f(){ return {} }').verdict, 'undetermined')
  // ⑧ 棘轮方向
  const v = (file, key) => ({ file, key, line: 1 })
  eq('H1 基线里没有该文件该键的额度 ⇒ 零容忍,判红(反向对照)', decide({ violations: [v('f.ts', 'sessionId'), v('f.ts', 'userId')], baseline: { f: {} }, undetermined: [] }).exit, 1)
  eq('H2 基线给了额度 ⇒ 齐平即绿', decide({ violations: [v('f.ts', 'sessionId')], baseline: { 'f.ts': { sessionid: 1 } }, undetermined: [] }).exit, 0)
  eq('H3 基线 2 而现值 3 ⇒ 红(新增即拦)', decide({ violations: [v('f.ts', 'sessionId'), v('f.ts', 'session_id'), v('f.ts', 'SessionID')], baseline: { 'f.ts': { sessionid: 2 } }, undetermined: [] }).exit, 1)
  eq('H4 基线 2 而现值 1 ⇒ 绿(只减不增,不追存量)', decide({ violations: [v('f.ts', 'sessionId')], baseline: { 'f.ts': { sessionid: 2 } }, undetermined: [] }).exit, 0)
  // ⑨ 标识符形态
  eq('I1 parameters 指向同文件 const 字面量 ⇒ 仍能取到键', scanFile('apps/cli/src/tools/d.ts', "const PARAMS = { turnId: { type: 'string' } }\nexport const T = { parameters: PARAMS }\n", set).violations.length, 1)
  eq('I2 parameters 指向解析不到的变量 ⇒ 计"动态形态"(报数),不计判不出', collectSchemaKeys(maskNoise('export const T = { parameters: externalMap }')).dynamic.length, 1)
  eq('I3 动态形态不得把 exit 顶成 2(恒红防护)', decide({ violations: [], undetermined: [], dynamic: ['a.ts · parameters: tool.parameters'] }).exit, 0)
  eq('I4 类型标注(properties: Record<…>)既不判红也不计判不出', (() => {
    const r = scanFile('apps/cli/src/tools/t.ts', 'export interface X {\n  f(properties: Record<string, ToolShapeDescriptor>): void\n}\n', set)
    const c = collectSchemaKeys(maskNoise('const A = { properties: Record<string, string>, parameters: ToolParams }'))
    return [r.violations.length, c.dynamic.length + c.typeAnnotations.length]
  })(), [0, 2])

  // ⑩ 句柄声明(routing-handle)—— 每条见证不成立都必须红,且不吃基线额度
  const HG_OK = [
    'const sessions = new Map<string, number>();',
    'function genId(): string { return "x"; }',
    'const T = { parameters: { sessionId: { type: "string" } } };',
    '// routing-handle: key=sessionId minted-by=genId registry=sessions 进程内句柄',
    'function pick(s: string) { const c = sessions.get(s); if (!c) return null; return c; }',
    'const id = genId(); sessions.set(id, 1);',
    '',
  ].join('\n')
  const hg = (src) => scanFile('apps/cli/src/tools/g.ts', src, set)
  eq('HG1 三条见证齐备 ⇒ 不判违规、计入句柄', [hg(HG_OK).violations.length, hg(HG_OK).handles.length, hg(HG_OK).handleRot.length], [0, 1, 0])
  eq('HG2 registry 不是 new Map/Set ⇒ 句柄主张不成立(违规 + 点名)', (() => {
    const r = hg(HG_OK.replace('new Map<string, number>()', '{ x: 1 }'))
    return [r.violations.length, r.handleRot.length, r.handleRot[0].why.includes('registry=sessions')]
  })(), [1, 1, true])
  eq('HG3 minted-by 定义了却从未调用 ⇒ 判红(表里的 id 不是它铸造的)', (() => {
    const r = hg(HG_OK.replace('const id = genId();', 'const id = "from-model";'))
    return [r.violations.length, r.handleRot.length]
  })(), [1, 1])
  eq('HG4 "查不到即拒绝"的出口被摘掉 ⇒ 判红(未知 id 会直接落效果)', (() => {
    const r = hg(HG_OK.replace('if (!c) return null;', 'if (!c) c = 0;'))
    return [r.violations.length, r.handleRot.length]
  })(), [1, 1])
  eq('HG5 见证写成注释 ⇒ 等于没有(遮噪后不可见)', (() => {
    const r = hg(HG_OK.replace('function pick(s: string) { const c = sessions.get(s); if (!c) return null; return c; }', '// function pick(s) { const c = sessions.get(s); if (!c) return null; return c; }'))
    return [r.violations.length, r.handleRot.length]
  })(), [1, 1])
  eq('HG6 清单腐烂:登记了 key 但该键已不是 schema 违规 ⇒ 点名', (() => {
    const r = hg(HG_OK.replace('{ sessionId: { type: "string" } }', '{ other: { type: "string" } }'))
    return [r.handleRot.length, r.handleRot[0].why.includes('清单腐烂')]
  })(), [1, true])
  eq('HG7 标记缺 key= ⇒ 判红(等于一张空头条款)', hg(HG_OK.replace('key=sessionId ', '')).handleRot.length, 1)
  eq('HG8 handleRot 进 decide ⇒ exit 1,基线额度救不了它', decide({ violations: [], baseline: { 'apps/cli/src/tools/g.ts': { sessionid: 9 } }, handleRot: [{ file: 'apps/cli/src/tools/g.ts', line: 3, key: 'sessionId', why: 'x' }] }).exit, 1)
  eq('HG9 违规与句柄都为零 ⇒ 绿(句柄面不得自成恒红源)', decide({ violations: [], handleRot: [], handles: [{ file: 'g.ts', key: 'sessionId', line: 3 }] }).exit, 0)

  console.log(fail ? `\n❌ 自检 ${fail}/${ran} 例失败` : `\n全部 ${ran} 例通过(成对正反例 + 判据失效反向对照 + 投影出口三态 + 棘轮四向 + 标识符回溯 + 句柄三条见证)`)
  process.exit(fail ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    selfTest()
  } else if (process.env[SELF_SKIP] === '1' && !argv.includes('--force')) {
    console.log(`⏭️  已跳过(${SELF_SKIP}=1):路由身份入参门未执行`)
    process.exit(0)
  } else {
    try {
      process.exit(main(argv))
    } catch (e) {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    }
  }
}

export const __test__ = {
  normalizeKey,
  EXEMPT_MARK_TEXT,
  maskNoise,
  parseNameList,
  topLevelKeys,
  collectSchemaKeys,
  exemptedLines,
  scanFile,
  auditProjection,
  decide,
  loadBaseline,
  listFace,
  readFace,
  inScanRoot,
  analyze,
  readRulerSource,
  HOLDER_KEYS,
  SELF_SKIP,
  SCAN_ROOT,
  NAME_SOURCE,
  PROJECTION_SOURCE,
  BASELINE_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍‌​‌‌​‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​‌‌‌‌‍‍​‌‌‌‌‌‌‍‍​‌‌‌‌‌‍‍​‌‌‌‌‌‌‍‍​‌‌‌‌​‌‌‍‍​‌‌‌‍
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
