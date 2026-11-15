// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 有界 JSON 序列化原语 — J4(逆向-复现-超越 WorkBuddy agent-harness protocol/bounded-json.js)。
 *
 * 逆向来源(WorkBuddy lib/protocol/bounded-json.js):
 *   - jsonStringBytes(s):按 UTF-8 逐字符精确计字节(多字节/代理对/控制字符转义各计对),
 *     用于"计费先行"判断是否超限,而不是先 stringify 再量。
 *   - boundedStringifyJson(v, maxBytes):**迭代遍历**(显式栈,非递归 ⇒ 防栈溢出),
 *     节点数上限 1e5、depth 上限 128,任一超限或累计字节超 maxBytes ⇒ 抛错拒序列化。
 *   这是防"序列化炸弹"的安全原语:深嵌套/超宽/超大对象在序列化**过程中**被掐断,
 *     不会先 OOM 再说。
 *
 * IHUI 差距:
 *   - canonical-json.ts 是**递归** key 排序规范化(HMAC 链用),无字节/深度上限,循环引用抛错
 *     —— 职责是"稳定规范化",不是"有界安全序列化"。
 *   - acp/server.ts 等用 `JSON.stringify(args).slice(0, 2000)` —— 字符串层截断:
 *     多字节字符会被截半个(产生非法 UTF-8)、且无 depth 防护(深嵌套递归栈溢出)。
 *
 * 复现(IHUI):把迭代式 UTF-8 字节计量 + 硬上限落成共享层原语。
 *
 * 超越(对照 WorkBuddy 缺口):
 *   - WorkBuddy 超限只抛一个笼统 Error;我们返回**结构化结果**
 *     { ok, bytes? , reason?: 'tooLarge'|'tooComplex', limit? },调用方可据此
 *     区分"超字节预算"(可引导用户缩小参数)与"结构太深太宽"(可引导简化),并携带预算值。
 *   - jsonStringBytes 独立导出,供"只计量不序列化"的预算预估场景。
 */

/** 序列化失败原因(超越项:WorkBuddy 只抛笼统 Error) */
export type BoundedJsonFailReason = 'tooLarge' | 'tooComplex'

/** 序列化结果(结构化,超越 WorkBuddy 的笼统 Error) */
export type BoundedJsonResult =
  | { ok: true; bytes: number; json: string }
  | { ok: false; reason: BoundedJsonFailReason; limit: number }

/** 默认上限(对齐 WorkBuddy 实测:MCP_SERVER_MAX_JSON_FIELD_BYTES=256KB,节点 1e5,depth 128) */
export const DEFAULT_MAX_JSON_BYTES = 256 * 1024
export const MAX_JSON_NODES = 100_000
export const MAX_JSON_DEPTH = 128

/**
 * 精确计量字符串的 UTF-8 字节数(对齐 WorkBuddy jsonStringBytes)。
 * 逐字符判断 UTF-8 编码宽度;处理代理对、控制字符转义(\uXXXX = 6 字节)。
 */
export function jsonStringBytes(s: string): number {
  let total = 2 // 头尾引号
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (
      c === 0x22 ||
      c === 0x5c ||
      c === 0x08 ||
      c === 0x09 ||
      c === 0x0a ||
      c === 0x0c ||
      c === 0x0d
    )
      total += 2
    else if (c < 0x20)
      total += 6 // \u00XX
    else if (c <= 0x7f) total += 1
    else if (c <= 0x7ff) total += 2
    else if (c >= 0xd800 && c <= 0xdbff) {
      const lo = s.charCodeAt(i + 1)
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        total += 4
        i++
      } // 代理对合并 4 字节
      else total += 6 // 孤立高代理:JSON.stringify 输出 \ud800 = 6 字节
    } else if (c >= 0xdc00 && c <= 0xdfff)
      total += 6 // 孤立低代理:JSON.stringify 输出 \udc00 = 6 字节
    else total += 3
  }
  return total
}

/** 序列化失败时抛出的错误(携带结构化原因) */
export class BoundedJsonError extends Error {
  readonly result: { ok: false; reason: BoundedJsonFailReason; limit: number }
  constructor(reason: BoundedJsonFailReason, limit: number) {
    super(
      reason === 'tooLarge'
        ? `JSON 超出 ${limit} 字节预算`
        : `JSON 结构过深/过宽(节点或深度上限 ${limit})`,
    )
    this.name = 'BoundedJsonError'
    this.result = { ok: false, reason, limit }
  }
}

type Frame =
  | { kind: 'emit'; text: string }
  | { kind: 'close'; text: string; exit: object }
  | { kind: 'visit'; value: unknown; depth: number }
  | { kind: 'objEntry'; key: string; value: unknown; depth: number }

/**
 * 有界 JSON 序列化(**迭代遍历**,防深嵌套栈溢出;对齐 WorkBuddy boundedStringifyJson)。
 *
 * 三重护栏:
 *   - maxBytes:累计 UTF-8 字节超预算 ⇒ 抛 BoundedJsonError('tooLarge', maxBytes)
 *   - MAX_JSON_NODES:节点数上限(防超宽对象 OOM)
 *   - MAX_JSON_DEPTH:嵌套深度上限(防栈/队列爆)
 *
 * 语义对齐 JSON.stringify:
 *   - undefined / function / symbol 成员 ⇒ 整键丢弃(对象内)或 null(数组内)
 *   - 循环引用 ⇒ 抛 TypeError(与 canonical-json 一致,防无限展开)
 */
export function boundedStringifyJson(
  value: unknown,
  maxBytes: number = DEFAULT_MAX_JSON_BYTES,
): string {
  let bytes = 0
  let nodes = 0
  const seen = new Set<object>()
  const stack: Frame[] = [{ kind: 'visit', value, depth: 0 }]
  let out = ''

  const charge = (n: number): void => {
    bytes += n
    if (bytes > maxBytes) throw new BoundedJsonError('tooLarge', maxBytes)
  }
  const tick = (): void => {
    nodes += 1
    if (nodes > MAX_JSON_NODES) throw new BoundedJsonError('tooComplex', MAX_JSON_NODES)
  }

  while (stack.length > 0) {
    const frame = stack.pop()!
    // 注意:emit/close/objEntry 帧的 text 已是序列化输出片段(含引号/括号),
    // 用 Buffer.byteLength 计 UTF-8 字节,不能再过 jsonStringBytes(会重复套引号)。
    if (frame.kind === 'emit') {
      out += frame.text
      charge(Buffer.byteLength(frame.text, 'utf8'))
      continue
    }
    if (frame.kind === 'close') {
      seen.delete(frame.exit)
      out += frame.text
      charge(Buffer.byteLength(frame.text, 'utf8'))
      continue
    }
    if (frame.kind === 'objEntry') {
      const keyText = JSON.stringify(frame.key) + ':'
      out += keyText
      charge(Buffer.byteLength(keyText, 'utf8'))
      stack.push({ kind: 'visit', value: frame.value, depth: frame.depth })
      continue
    }
    // kind === 'visit'
    tick()
    const v = frame.value
    const depth = frame.depth
    if (depth > MAX_JSON_DEPTH) throw new BoundedJsonError('tooComplex', MAX_JSON_DEPTH)

    if (v === null) {
      out += 'null'
      charge(4)
      continue
    }
    const t = typeof v
    if (t === 'boolean') {
      out += v ? 'true' : 'false'
      charge(v ? 4 : 5)
      continue
    }
    if (t === 'number') {
      const s = Number.isFinite(v as number) ? JSON.stringify(v) : 'null'
      out += s
      charge(Buffer.byteLength(s, 'utf8'))
      continue
    }
    if (t === 'string') {
      const s = JSON.stringify(v)
      out += s
      charge(Buffer.byteLength(s, 'utf8'))
      continue
    }
    if (t === 'undefined' || t === 'function' || t === 'symbol') {
      out += 'null'
      charge(4)
      continue
    }
    if (t === 'bigint') {
      const s = JSON.stringify(String(v))
      out += s
      charge(Buffer.byteLength(s, 'utf8'))
      continue
    }

    // object
    const obj = v as object
    if (seen.has(obj)) throw new TypeError('boundedStringifyJson: 检测到循环引用')
    if (typeof (obj as { toJSON?: unknown }).toJSON === 'function') {
      const json = (obj as { toJSON: () => unknown }).toJSON()
      stack.push({ kind: 'visit', value: json, depth })
      continue
    }
    if (Array.isArray(obj)) {
      seen.add(obj)
      out += '['
      charge(1)
      const close: Frame = { kind: 'close', text: ']', exit: obj }
      // 与 plain-object 分支同构:close 最先入栈(最后 pop);倒序遍历,
      // 每个非首元素前置一个逗号 emit 帧(逗号 pop 在该值 visit 之前)。
      const frames: Frame[] = [close]
      for (let i = obj.length - 1; i >= 0; i--) {
        frames.push({ kind: 'visit', value: obj[i], depth: depth + 1 })
        if (i > 0) frames.push({ kind: 'emit', text: ',' })
      }
      // 栈 LIFO:close 必须最先 push(= 最后 pop);故按 frames 顺序依次推栈。
      for (const fr of frames) stack.push(fr)
      continue
    }
    // plain object(数组分支已 continue,不落入此)
    seen.add(obj)
    out += '{'
    charge(1)
    const record = obj as Record<string, unknown>
    // Object.entries 顺序与 Object.keys 一致;用 entries 避免索引访问(noUncheckedIndexedAccess)
    const entries = Object.entries(record).filter(([, val]) => {
      const tv = typeof val
      return val !== undefined && tv !== 'function' && tv !== 'symbol'
    })
    const close: Frame = { kind: 'close', text: '}', exit: obj }
    const parts: Frame[] = [close]
    for (let i = entries.length - 1; i >= 0; i--) {
      const [k, val] = entries[i]!
      parts.push({ kind: 'objEntry', key: k, value: val, depth: depth + 1 })
      if (i > 0) parts.push({ kind: 'emit', text: ',' })
    }
    // 栈 LIFO:close 必须最先 push(= 最后 pop);故按 parts 顺序依次推栈。
    for (const fr of parts) stack.push(fr)
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
