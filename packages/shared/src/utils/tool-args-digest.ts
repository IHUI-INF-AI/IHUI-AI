// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具入参「两档摘要」的唯一出口(86B)。
 *
 * 它是"证据级可追溯执行流水"(86)的**输入格式层**:每次工具调用落进审计链时,
 * 进链的必须是这里的产物,而不是 `JSON.stringify(args)`。
 *
 * 两档分别回答两个不同的问题,不得互相顶替:
 *   档1 结构摘要 `digestToolArgsStructure(args)` —— 「这次调用和那次是不是同一件事」。
 *       键序归一后 SHA-256,可等值对账,故同一对象换个键序必须得到同一个值。
 *   档2 形态类 `digestToolArgShape(key, value)` —— 「这个参数长什么样」,只给**有限枚举**
 *       的定性结论(path 在 repo 内 / 相对 / 绝对;text 是枚举样 token / 长散文 / 不透明串),
 *       供审计面在不看原文的前提下回答"模型当时被喂了什么形态的入参"。
 *
 * 红线(与 `apps/ai-service/app/core/tool_call_trace.py` 头注「绝不含参数或输出」、
 * `apps/cli/src/tools/argument-validator.ts` 影子台账刻意排除 `expected`/`actual` 原值
 * 是同一条禁令):**本模块的任何返回值都不含入参原值**。档2 的 `bucket` 只能是本文件
 * 列出的枚举字面量,因此 `src/payments/invoice.ts` 只会得到 `repo-source-relative`,
 * 绝不会得到路径本身。长度 `len` 是唯一保留的量化信息;凭据类键上连长度也做粗化。
 *
 * 已知属性(不是缺陷,读的人须带着它看):摘要对**低熵输入可被字典还原**
 * (`digestToolArgsStructure({a:'yes'})` 可被枚举命中)。它是"同一性指纹",不是加密。
 *
 * 平台无关铁律(与 `packages/shared/src/agent/doom-loop-detector.ts` 同一条,由守门
 * "shared 包非 Node 宿主纯度对账"机器判):本文件禁止 import `node:*` / DOM 内建。
 * 因此散列是自带的纯 JS SHA-256 —— 各宿主(web / 小程序 / RN / Node)必须对同一入参
 * 得到**同一个**摘要,注入式 hasher 会让这件事取决于调用方,而跨端等值正是本层的存在理由。
 * 正确性由专测拿 `node:crypto` 逐向量对账(测试面不在共享层可达闭包内)。
 *
 * 与 `apps/cli/src/utils/tool-denial.ts` 的 `digestToolArgs` 的关系(如实登记,不是已收口):
 * 那一处是**拒绝路径的短指纹** —— 直接 `JSON.stringify(args)`(无键序归一)、截 12 位、
 * 只覆盖一层键名。它不是本层的子集而是另一个用途,且它"换键序即换指纹"正是本层要消除的
 * 指纹分裂。两者刻意**不同名**,以免守门"共享层重复实现"把端内那一处判成本层的重复;
 * 把它迁到本层属 CLI 侧改动(本票禁改 `apps/cli/**`),另计一票。
 */

/** 摘要前缀带"用途 + 算法 + 形态版本":改了取哪些字段/怎么编码必须 +1,否则新旧两套字节共用同一份登记表。 */
export const TOOL_ARGS_DIGEST_PREFIX = 'args-sha256-v1-'

/** 归一化序列化的递归深度上限(超出以哨兵计入摘要,不抛异常 —— 审计链不能因入参形态而断)。 */
export const TOOL_ARGS_CANONICAL_MAX_DEPTH = 12
/** 归一化序列化的节点预算上限(超出以哨兵截断;防一次超大入参把哈希打成 DoS)。 */
export const TOOL_ARGS_CANONICAL_MAX_NODES = 2000

/* ------------------------------------------------------------------ *
 * 纯 JS SHA-256(FIPS 180-4)+ 手写 UTF-8 编码
 * ------------------------------------------------------------------ */

const SHA256_K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

const SHA256_H0: readonly number[] = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]

/** 循环右移(入参一律按 uint32 处理)。 */
function rotr32(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0
}

/**
 * 手写 UTF-8 编码:不用 `TextEncoder`(Hermes 与微信小程序引擎均无它),
 * 且必须与 `Buffer.from(s, 'utf8')` 对**合法文本**逐字节一致 —— 这一点由专测拿
 * `node:crypto` 全量对账钉住,不靠注释声明。代理对按码位合并,四字节分支走 0xf0 前缀。
 */
function utf8Bytes(text: string): number[] {
  const out: number[] = []
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i) ?? 0xfffd
    if (cp > 0xffff) i++ // 跳过低代理项,避免把一个码位编成两段
    if (cp < 0x80) {
      out.push(cp)
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      )
    }
  }
  return out
}

function sha256Hex(text: string): string {
  const bytes = utf8Bytes(text)
  const bitLen = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0x00)
  const hi = Math.floor(bitLen / 0x100000000)
  const lo = bitLen >>> 0
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff)
  bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff)

  const h = SHA256_H0.slice()
  const w = new Uint32Array(64)
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const p = offset + i * 4
      w[i] =
        ((bytes[p]! << 24) | (bytes[p + 1]! << 16) | (bytes[p + 2]! << 8) | bytes[p + 3]!) >>> 0
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr32(w[i - 15]!, 7) ^ rotr32(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3)) >>> 0
      const s1 = (rotr32(w[i - 2]!, 17) ^ rotr32(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10)) >>> 0
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0
    }
    let a = h[0]!,
      b = h[1]!,
      c = h[2]!,
      d = h[3]!
    let e = h[4]!,
      f = h[5]!,
      g = h[6]!,
      hh = h[7]!
    for (let i = 0; i < 64; i++) {
      const S1 = (rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25)) >>> 0
      const ch = ((e & f) ^ (~e & g)) >>> 0
      const t1 = (hh + S1 + ch + SHA256_K[i]! + w[i]!) >>> 0
      const S0 = (rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22)) >>> 0
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0
      const t2 = (S0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = (h[0]! + a) >>> 0
    h[1] = (h[1]! + b) >>> 0
    h[2] = (h[2]! + c) >>> 0
    h[3] = (h[3]! + d) >>> 0
    h[4] = (h[4]! + e) >>> 0
    h[5] = (h[5]! + f) >>> 0
    h[6] = (h[6]! + g) >>> 0
    h[7] = (h[7]! + hh) >>> 0
  }
  let hex = ''
  for (const v of h) hex += (v >>> 0).toString(16).padStart(8, '0')
  return hex
}

/* ------------------------------------------------------------------ *
 * 档1:结构摘要
 * ------------------------------------------------------------------ */

/** 哨兵:深度/节点预算/循环引用/不可序列化四种"判不到"的落点,一律进摘要而不是抛异常。 */
const SENTINEL_DEPTH = '"[depth-limit]"'
const SENTINEL_NODES = '"[node-limit]"'
const SENTINEL_CYCLE = '"[cyclic-ref]"'
const SENTINEL_UNSERIALIZABLE = '"[unserializable]"'

interface CanonicalBudget {
  nodes: number
  depth: number
  /**
   * 本次归一是否**没有**把整份入参提交进摘要(命中任一哨兵 / 字节视图只按长度计)。
   * 摘要一旦不覆盖全量,两次不同调用就可能得到同一个值 —— 这是审计链必须知道的,
   * 所以它随摘要一起递出(`summarizeToolArgs().lossy`),而不是留在预映像里没人看得见。
   */
  lossy: boolean
  readonly seen: Set<object>
}

/**
 * 键序归一的稳定序列化 —— 与 `apps/cli/src/stream-tool-ledger.ts` 的 `canonicalizeArgs`
 * **逐字节同形**(标量 `JSON.stringify(v ?? null)`、数组 `[a,b]`、对象按 `Object.keys().sort()`
 * 且键名走 `JSON.stringify`),否则两处实现各产一种字节、跨端指纹必然分裂。
 * 在此之上只做"不会抛"的加固:深度/节点预算、循环引用、`bigint`/`function`/`symbol`。
 */
// 刻意不 export:它就是入参的可逆序列化本身,递出去等于给"不落原值"这条红线开一个合法出口。
// 与 CLI 那份 canonicalizeArgs 的逐字节等值由专测证明,不需要公开原值面。
function canonicalToolArgs(value: unknown): { text: string; lossy: boolean } {
  const budget: CanonicalBudget = { nodes: 0, depth: 0, lossy: false, seen: new Set() }
  const text = canonicalInto(value, budget)
  return { text, lossy: budget.lossy }
}

function canonicalInto(value: unknown, budget: CanonicalBudget): string {
  budget.nodes += 1
  if (budget.nodes > TOOL_ARGS_CANONICAL_MAX_NODES) {
    budget.lossy = true
    return SENTINEL_NODES
  }

  if (value === null || value === undefined) return JSON.stringify(null)
  const t = typeof value
  if (t === 'number' || t === 'boolean' || t === 'string') return JSON.stringify(value) ?? 'null'
  // bigint 是精确整数,JSON.stringify 会抛;按十进制入摘要(与同值的 number 不同字节,
  // 因为 1n 与 1 在工具语义上不是同一件事,不得被归一成同一个指纹)
  if (t === 'bigint') return `"${String(value)}n"`
  // function / symbol 无法按内容比较(同一逻辑的两个闭包也不是同一个值),只留类型标记并记 lossy
  if (t === 'function' || t === 'symbol') {
    budget.lossy = true
    return SENTINEL_UNSERIALIZABLE
  }

  const obj = value as object
  if (budget.seen.has(obj)) {
    budget.lossy = true
    return SENTINEL_CYCLE
  }
  if (budget.depth >= TOOL_ARGS_CANONICAL_MAX_DEPTH) {
    budget.lossy = true
    return SENTINEL_DEPTH
  }
  budget.seen.add(obj)
  budget.depth += 1
  try {
    if (Array.isArray(obj)) {
      return `[${obj.map((v) => canonicalInto(v, budget)).join(',')}]`
    }
    // Date / RegExp 按值入摘要:预映像是私有的、只喂给哈希,忠实一点就少一型指纹碰撞
    if (obj instanceof Date) return `"[date:${obj.getTime()}]"`
    if (obj instanceof RegExp) return `"[regexp:${obj.source}]"`
    if (typeof (obj as { byteLength?: unknown }).byteLength === 'number') {
      // 字节视图(Buffer/TypedArray)只按长度计:把几百 KB 的二进制拼进字符串既慢又可能出
      // 非法码元,而"内容不同、长度相同"这一型必须被 lossy 说出来,不能悄悄当成同一件事
      budget.lossy = true
      return `"[bytes:${(obj as { byteLength: number }).byteLength}]"`
    }
    const record = obj as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalInto(record[k], budget)}`).join(',')}}`
  } finally {
    budget.seen.delete(obj)
    budget.depth -= 1
  }
}

/** 档1 出口:同一对象换键序 ⇒ 同值;改任一取值 ⇒ 换值。返回 `args-sha256-v1-<64hex>`。 */
export function digestToolArgsStructure(args: unknown): string {
  return TOOL_ARGS_DIGEST_PREFIX + sha256Hex(canonicalToolArgs(args).text)
}

/* ------------------------------------------------------------------ *
 * 档2:形态类(有限枚举,不含原值)
 * ------------------------------------------------------------------ */

/** 档2 的形态档(封闭集)。新增一形必须同笔给出消费方,不得先建表再等人用。 */
export const TOOL_ARG_SHAPE_KINDS = [
  'null',
  'boolean',
  'number',
  'bigint',
  'text',
  'path',
  'url',
  'array',
  'object',
  'opaque',
] as const
export type ToolArgShapeKind = (typeof TOOL_ARG_SHAPE_KINDS)[number]

/**
 * 档2 的归类档(封闭集)。**只允许出现下列字面量** —— 任何一项都不得由入参文本派生。
 * 路径类刻意不含目录名:实测需求就是"`src/payments/invoice.ts` 只能得到
 * `repo-source-relative`",写进路径片段等于绕过本层的红线。
 */
export const TOOL_ARG_SHAPE_BUCKETS = [
  // null / boolean / number / bigint
  'none',
  'flag',
  'integer',
  'fraction',
  'non-finite',
  'bigint-integer',
  // text(按形态而非内容分档)
  'empty',
  'enum-like-token',
  'numeric-string',
  'dotted-key',
  'multi-word',
  'long-prose',
  'opaque-token',
  'secret-under-key',
  // path
  'repo-source-relative',
  'repo-package-relative',
  'bare-name',
  'relative-other',
  'parent-relative',
  'home-relative',
  'posix-absolute',
  'windows-absolute',
  'unc-path',
  // url
  'secure-web',
  'plain-web',
  'other-scheme',
  // array / object
  'empty-collection',
  'scalar-array',
  'object-array',
  'mixed-array',
  'flat-object',
  'nested-object',
  // opaque(function / symbol / 其它不可序列化宿主对象)
  'opaque-value',
] as const
export type ToolArgShapeBucket = (typeof TOOL_ARG_SHAPE_BUCKETS)[number]

/** 一条参数的定性描述。`len` 语义按 `shape` 分档,见 `summarizeToolArgs` 上方注释。 */
export interface ToolArgShape {
  readonly shape: ToolArgShapeKind
  readonly bucket: ToolArgShapeBucket
  readonly len: number
}

/**
 * 键名提示:path / url / 凭据三族都是**按归一后的键名**判的。
 * 不归一就会漏掉 camelCase —— 实测 `filePath` 在 `(^|_)(file|path)(_|$)` 下**不成立**
 * (`file` 后面接的是大写 P,既不是 `_` 也不是结尾),于是整个"路径键提示"对工具最常见的
 * 命名形态失明。camel→snake 一步就把这类键接回来,且只影响提示、不影响取值判断。
 */
function normalizeArgKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

/** 键名提示:这些键下的字符串按路径归类,即使它没有分隔符(`file: 'index.ts'`)。 */
const PATH_KEY_RE =
  /(^|_)(path|file|filename|filepath|dir|directory|folder|cwd|root|target|source|src|dest|destination|output|glob)(_|$)/
/** 键名提示:这些键下按 URL 归类。 */
const URL_KEY_RE = /(^|_)(url|uri|endpoint|webhook|href|link)(_|$)/
/**
 * 键名提示:这些键是凭据。除不落原值外,**长度也做粗化**(向上取整到 16 的边界)——
 * 密钥长度本身就是攻击面信息,而档2 的存在理由正是"在不泄露内容的前提下可归类"。
 */
const SECRET_KEY_RE =
  /token|secret|password|passwd|credential|api_?key|access_?key|private_?key|bearer/

const WORD_SEP_RE = /[\s,;:()[\]{}<>"']/
/** 路径字符集:字母数字与 . _ - + @ 空格,加分隔符本身。出现其它字符即不当路径处理。 */
const PATH_CHARSET_RE = /^[\w.@+\- /\\]*$/
const URL_RE = /^([a-z][a-z0-9+.-]*):\/\/(\S*)$/i
const BARE_NAME_RE = /^[\w.@+\- ]+$/
const OPAQUE_CHARS_RE = /^[A-Za-z0-9_\-+/=]{20,}$/
const DOTTED_KEY_RE = /^[A-Za-z0-9_\-]+(\.[A-Za-z0-9_\-]+){1,}$/

/**
 * "凭据形状"的判据:够长 + 字符集是 base64/hex 一族 + 至少带一类随机性证据
 * (base64 标点,或数字与字母同现)。刻意不加最后一条的话,一个 30 字符的全小写
 * slug(`some_quite_long_branch_name`)会被误报成不透明串,而它其实是枚举样标识。
 */
function looksOpaqueToken(t: string): boolean {
  if (!OPAQUE_CHARS_RE.test(t)) return false
  if (/[+/=]/.test(t)) return true
  return /[0-9]/.test(t) && /[A-Za-z]/.test(t)
}
/** 长文本判定阈值(字符数)。取 160:一句提示语通常远短于此,一段正文通常长于此。 */
const LONG_PROSE_MIN = 160

function countSeparators(s: string): number {
  let n = 0
  for (const ch of s) if (ch === '/' || ch === '\\') n++
  return n
}

/**
 * 归一后按前缀分派。返回 null 表示"不像路径",由上层回落到 text。
 * 刻意**不认裸名**(`index.ts` 这种无分隔符的串):那是 `A.B` / `v1.2` 这类文本的形态,
 * 判成路径会让短文本整族失真。裸名只在键名本身提示路径时才走 `bare-name` 档。
 */
function classifyPathShape(s: string): ToolArgShape | null {
  const t = s.trim()
  if (t.length === 0) return null
  if (/^\\\\[^\\]+[\\/]/.test(t)) return shapeOf('path', 'unc-path', s.length)
  if (/^[A-Za-z]:[\\/]/.test(t)) return shapeOf('path', 'windows-absolute', s.length)
  if (t.startsWith('~/') || t.startsWith('~\\')) return shapeOf('path', 'home-relative', s.length)
  if (t.startsWith('/') || t.startsWith('\\')) return shapeOf('path', 'posix-absolute', s.length)
  if (!PATH_CHARSET_RE.test(t)) return null
  if (t.startsWith('../') || t.startsWith('..\\') || t === '..') {
    return shapeOf('path', 'parent-relative', s.length)
  }
  if (countSeparators(t) === 0) return null
  // 段内含空格即不当相对路径:散文里的 "and/or" 也带斜杠,而真相对路径几乎不带空格
  if (t.split(/[/\\]/).some((seg) => seg.includes(' '))) return null
  // repo 相对:apps/<包>/src/** 与 packages/<包>/** 是本仓两条稳定的源码形态
  if (/^apps\/[^/\\]+\/src([/\\]|$)/.test(t))
    return shapeOf('path', 'repo-source-relative', s.length)
  if (/^packages\//.test(t)) return shapeOf('path', 'repo-package-relative', s.length)
  return shapeOf('path', 'relative-other', s.length)
}

function classifyText(s: string): ToolArgShape {
  const t = s.trim()
  if (t.length === 0) return shapeOf('text', 'empty', s.length)
  if (/^-?\d+(\.\d+)?$/.test(t)) return shapeOf('text', 'numeric-string', s.length)
  if (looksOpaqueToken(t)) return shapeOf('text', 'opaque-token', s.length)
  if (DOTTED_KEY_RE.test(t)) return shapeOf('text', 'dotted-key', s.length)
  if (t.length >= LONG_PROSE_MIN) return shapeOf('text', 'long-prose', s.length)
  if (WORD_SEP_RE.test(t)) return shapeOf('text', 'multi-word', s.length)
  return shapeOf('text', 'enum-like-token', s.length)
}

function shapeOf(shape: ToolArgShapeKind, bucket: ToolArgShapeBucket, len: number): ToolArgShape {
  return { shape, bucket, len }
}

function classifyUrl(rest: string, whole: string): ToolArgShape {
  const scheme = whole.slice(0, whole.indexOf(':')).toLowerCase()
  if (scheme === 'https') return shapeOf('url', 'secure-web', rest.length)
  if (scheme === 'http') return shapeOf('url', 'plain-web', rest.length)
  return shapeOf('url', 'other-scheme', rest.length)
}

function classifyArray(arr: readonly unknown[]): ToolArgShape {
  if (arr.length === 0) return shapeOf('array', 'empty-collection', 0)
  let objectish = 0
  let scalarish = 0
  for (const item of arr) {
    if (item !== null && typeof item === 'object') objectish++
    else scalarish++
  }
  const bucket =
    objectish === arr.length
      ? 'object-array'
      : scalarish === arr.length
        ? 'scalar-array'
        : 'mixed-array'
  return shapeOf('array', bucket, arr.length)
}

function classifyObject(obj: Record<string, unknown>): ToolArgShape {
  const keys = Object.keys(obj)
  if (keys.length === 0) return shapeOf('object', 'empty-collection', 0)
  const nested = keys.some((k) => {
    const v = obj[k]
    return v !== null && typeof v === 'object'
  })
  return shapeOf('object', nested ? 'nested-object' : 'flat-object', keys.length)
}

/**
 * 档2 出口:一条参数的定性描述,**只回封闭枚举 + 长度**。
 *
 * `len` 的语义按 `shape` 分档(刻意不是一句"长度",否则读数会被跨档误比):
 *   text/path/url → 字符数(url 去掉 `<scheme>://` 前缀后计,避免 scheme 本身占位)
 *   array → 元素个数;object → 自身可枚举键个数
 *   number → 十进制表示的字符数;boolean/null → 0
 * 凭据类键(`SECRET_KEY_RE`)下 `len` 向上粗化到 16 的整数倍,见该常量注释。
 */
export function digestToolArgShape(key: string, value: unknown): ToolArgShape {
  const isSecretKey = SECRET_KEY_RE.test(normalizeArgKey(key))
  const shaped = shapeOfRaw(key, value)
  if (!isSecretKey) return shaped
  // 凭据档:形态统一收成 secret-under-key,长度粗化,不给"同长度即可对齐指纹"留口
  return shapeOf(shaped.shape, 'secret-under-key', Math.ceil(shaped.len / 16) * 16)
}

function shapeOfRaw(key: string, value: unknown): ToolArgShape {
  if (value === null || value === undefined) return shapeOf('null', 'none', 0)
  const t = typeof value
  if (t === 'boolean') return shapeOf('boolean', 'flag', 0)
  if (t === 'number') {
    if (!Number.isFinite(value)) return shapeOf('number', 'non-finite', 0)
    return shapeOf('number', Number.isInteger(value) ? 'integer' : 'fraction', String(value).length)
  }
  if (t === 'bigint') return shapeOf('bigint', 'bigint-integer', String(value).length)
  if (t === 'function' || t === 'symbol') return shapeOf('opaque', 'opaque-value', 0)
  if (Array.isArray(value)) return classifyArray(value as unknown[])
  if (t === 'object') return classifyObject(value as Record<string, unknown>)
  if (t === 'string') {
    const s = value as string
    const urlMatch = URL_RE.exec(s)
    if (urlMatch) return classifyUrl(urlMatch[2] ?? '', s)
    const path = classifyPathShape(s)
    if (path) return path
    // 键名提示:path/file 类键下即使没有分隔符也按路径档记(键名先 camel→snake 归一)
    const hintedKey = normalizeArgKey(key)
    if (PATH_KEY_RE.test(hintedKey) && BARE_NAME_RE.test(s.trim())) {
      return shapeOf('path', 'bare-name', s.length)
    }
    if (URL_KEY_RE.test(hintedKey) && BARE_NAME_RE.test(s.trim())) {
      return shapeOf('url', 'other-scheme', s.length)
    }
    return classifyText(s)
  }
  return shapeOf('opaque', 'opaque-value', 0)
}

/* ------------------------------------------------------------------ *
 * 组合出口
 * ------------------------------------------------------------------ */

/** 一次调用的两档摘要:`digest` 用于等值对账,`shape` 用于定性归类。二者都不含原值。 */
export interface ToolArgsSummary {
  readonly digest: string
  /** 键 = 入参名(属工具 schema,已对模型公开,不是用户数据);值 = 该条参数的形态。 */
  readonly shape: Readonly<Record<string, ToolArgShape>>
  /**
   * true = 摘要**没有**覆盖整份入参(命中深度/节点预算、循环引用、函数/符号、字节视图)。
   * 此时两条不同调用可能同摘要,落审计链的读法必须是"未判定是否同一件事",而不是"同一件事"。
   */
  readonly lossy: boolean
}

/**
 * 组合出口(86A 落审计链时只该调这一个函数 —— 单独调 `digestToolArgsStructure` 会丢掉
 * `lossy` 那一维,而那一维正是"指纹能不能当等值结论用"的前提)。
 *
 * 入参不是普通对象时(数组 / 标量 / null),`digest` 仍按整值算,`shape` 给空表 ——
 * 空表读作"没有具名参数可归类",不读作"这些参数没有形态"。
 */
export function summarizeToolArgs(args: unknown): ToolArgsSummary {
  const shape: Record<string, ToolArgShape> = {}
  if (args !== null && typeof args === 'object' && !Array.isArray(args)) {
    const record = args as Record<string, unknown>
    for (const key of Object.keys(record).sort()) {
      shape[key] = digestToolArgShape(key, record[key])
    }
  }
  const canonical = canonicalToolArgs(args)
  return {
    digest: TOOL_ARGS_DIGEST_PREFIX + sha256Hex(canonical.text),
    shape,
    lossy: canonical.lossy,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
