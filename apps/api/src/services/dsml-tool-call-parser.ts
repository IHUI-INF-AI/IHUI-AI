// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DSML 工具调用回退解析(2026-11-17 立,对标 qoder2api-hub 的「DSML 回退解析」)。
 *
 * 背景:部分上游(DeepSeek V3.2/V4 系)在工具调用通道异常时,会把 tool call **当正文吐出来**,
 * 形态是 `<｜DSML｜invoke name="…">` 这类带全角竖线的标记。客户端拿到这种正文既执行不了
 * 也解析不了,整个回合就废了。对照网关在服务端把这段正文还原成标准 tool_call 再交出去。
 *
 * 本仓此前没有任何 `dsml` 处理(全仓 grep 0 命中) ⇒ 这类响应原样透传给客户端。
 *
 * 格式依据(**不是猜的**):
 * - 标记字面量:`｜` 是 U+FF5C 全角竖线。包裹标签 `tool_calls`(V4)与 `function_calls`(V3.2)
 *   都出现过;invoke/parameter 的闭合标签与开标签同名。
 * - `parameter` 的 `string` 属性:`string="true"` ⇒ 体内原样当字符串;`string="false"`
 *   ⇒ 体内是 JSON(number/bool/array/object),要 `JSON.parse`。属性缺失时按字符串处理。
 * - 体内换行极常见(多行 bash),所以匹配必须 DOTALL。
 * - 变体:双杠 `｜｜DSML｜｜`、无前杠 `<DSML｜`、以及被代理转码出的 ASCII 管道
 *   `< | DSML | `。三种都要认,否则同一条上游换个节点就解析不出。
 *
 * 纪律:
 * - **纯判据**:只吃文本,不碰网络/DB,失败一律"没解析出来"(返回 null),绝不抛。
 * - **无标记 ⇒ null**,不是空数组 —— 空数组会让调用方以为"解析成功了但一个都没找到"。
 * - `string="false"` 但 JSON 非法时:**回落为原文字符串**并在 `degraded` 里记一笔,
 *   不丢内容、不伪造结构(丢内容比给错类型更糟)。
 */

export interface ParsedToolCall {
  name: string
  /** 与 OpenAI tool_calls[].function.arguments 同形:JSON 字符串 */
  arguments: string
}

export interface DsmlParseResult {
  calls: ParsedToolCall[]
  /** 哪些参数在 string="false" 下没能 JSON.parse(已回落为原文字符串) */
  degraded: string[]
}

/** 标记的统一形态(归一后只认这一种)。 */
const BAR = '｜DSML｜'

/** 把四种变体归一成标准形态。 */
export function normalizeDsmlMarkers(text: string): string {
  let out = text
  // 双杠:｜｜DSML｜｜ → ｜DSML｜
  out = out.split('｜｜DSML｜｜').join(BAR)
  // 无前杠:<DSML｜ / </DSML｜
  out = out.replace(/<DSML｜/g, `<${BAR}`)
  out = out.replace(/<\/DSML｜/g, `</${BAR}`)
  // ASCII 管道(允许标记内有空格):< | DSML | / </ | DSML |
  out = out.replace(/<\s*\|\s*DSML\s*\|\s*/g, `<${BAR}`)
  out = out.replace(/<\/\s*\|\s*DSML\s*\|\s*/g, `</${BAR}`)
  return out
}

const INOVKE_RE = /<｜DSML｜invoke\s+name="([^"]+)"\s*>(.*?)<\/｜DSML｜invoke>/gs
const PARAM_RE =
  /<｜DSML｜parameter\s+name="([^"]+)"(?:\s+string="(true|false)")?\s*>(.*?)<\/｜DSML｜parameter>/gs

/** 是否含有 DSML 标记(供调用方先做廉价判定,再决定要不要解析)。 */
export function hasDsmlMarkers(text: string): boolean {
  if (typeof text !== 'string' || text.length === 0) return false
  const n = normalizeDsmlMarkers(text)
  return n.includes(BAR)
}

/**
 * 解析一段正文里的全部 DSML tool call。
 *
 * 返回 null = 这段文本里没有可解析的 DSML(调用方应原样透传);
 * 返回 `{calls:[]}` 只在"有标记但没有合法 invoke"时出现,此时调用方通常也应原样透传。
 */
export function parseDsmlToolCalls(text: string): DsmlParseResult | null {
  if (typeof text !== 'string' || !hasDsmlMarkers(text)) return null
  const normalized = normalizeDsmlMarkers(text)
  const degraded: string[] = []
  const calls: ParsedToolCall[] = []

  INOVKE_RE.lastIndex = 0
  for (const invoke of normalized.matchAll(INOVKE_RE)) {
    const name = invoke[1]?.trim()
    if (!name) continue
    const body = invoke[2] ?? ''
    const args: Record<string, unknown> = {}

    PARAM_RE.lastIndex = 0
    for (const p of body.matchAll(PARAM_RE)) {
      const key = p[1]?.trim()
      if (!key) continue
      const asJson = p[2] === 'false'
      const raw = p[3] ?? ''
      if (asJson) {
        try {
          args[key] = JSON.parse(raw)
        } catch {
          // 不丢内容:回落成原文字符串,并记一笔 degraded
          args[key] = raw
          degraded.push(`${name}.${key}`)
        }
      } else {
        args[key] = raw
      }
    }

    // 体内没有 parameter 时,有些实现在 invoke 里直接放一个 JSON 对象
    if (Object.keys(args).length === 0 && body.trim().startsWith('{')) {
      try {
        const direct = JSON.parse(body.trim()) as Record<string, unknown>
        Object.assign(args, direct)
      } catch {
        degraded.push(`${name}.*`)
      }
    }

    calls.push({ name, arguments: JSON.stringify(args) })
  }

  return { calls, degraded }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
