// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * custom(freeform)工具 ↔ function 双向桥(2026-11-17 立)。
 *
 * 背景:Codex 系的 `apply_patch` 在 Responses 协议里是 **custom 工具**(自由文本输入,
 * 不是 JSON 参数)。而本仓 `/v1/responses` 背后是 chat-completions 型上游,它只认
 * `type:"function"`;把 `type:"custom"` 原样透传,上游直接 400(未知工具类型)——
 * 于是「Codex 打补丁」整条回路断在第一跳。
 *
 * 本仓此前 `v1-responses.ts` 全文没有 custom/freeform 处理(grep 0 命中)。
 *
 * 两向语义(公开规范,非猜测):
 * - **出站降级**:`{type:"custom", name, description?, format?}` ⇒
 *   `{type:"function", function:{name, description, parameters:{input:string}}}`。
 *   `input` 承载自由文本;把 `format` 的语法类型写进 description,让上游知道"要产什么形状的文本"。
 * - **入站还原**:上游回 `function(name, arguments='{"input":"…"}')` ⇒ 还给客户端
 *   `{type:"custom_tool_call", name, input:"…"}`。若上游没按 `input` 字段包(直接吐了纯文本
 *   arguments),整段当 input —— 不丢内容。
 *
 * 纪律:
 * - **纯判据**:零 IO,不读写任何全局状态;调用方传入的名字集合是唯一事实。
 * - **不是 custom 的工具原样返回**,一条也不改写(降级只碰 `type==="custom"`)。
 * - **可还原性判据住在这里**:`customNames` 由降级时收集,响应侧只认这批名字,
 *   避免把普通 function 的返回值误判成 custom_tool_call。
 */

export interface CustomToolLike {
  type: 'custom'
  name: string
  description?: string
  format?: { type?: string; syntax?: string; definition?: unknown }
  [key: string]: unknown
}

export interface DowngradedTools {
  /** 交给 chat-completions 上游的工具数组(custom 已换成 function) */
  tools: unknown[]
  /** 本次降级过的 custom 工具名(响应侧只认这批) */
  customNames: string[]
}

export interface CustomToolCallOutput {
  type: 'custom_tool_call'
  id: string
  status: 'completed'
  call_id: string
  name: string
  input: string
}

/** 判据:该工具声明是不是 custom(freeform) 工具。 */
export function isCustomTool(tool: unknown): tool is CustomToolLike {
  if (typeof tool !== 'object' || tool === null) return false
  const t = tool as { type?: unknown; name?: unknown }
  return t.type === 'custom' && typeof t.name === 'string' && t.name.length > 0
}

/** 把 `format` 拼进 description,让上游知道要产什么形状的自由文本。 */
function describeFormat(format: CustomToolLike['format']): string {
  if (!format || typeof format !== 'object') return ''
  const kind = typeof format.type === 'string' ? format.type : 'text'
  if (kind === 'grammar') {
    const syntax = typeof format.syntax === 'string' ? format.syntax : 'grammar'
    return `输入必须符合 ${syntax} 语法,原样输出工具输入文本,不要包 JSON。`
  }
  return '输入为该工具的原始文本,原样输出,不要包 JSON。'
}

/**
 * 出站降级(custom ⇒ function)。
 *
 * 非 custom 的工具**逐项原样保留**(不复制、不改写),顺序不变。
 */
export function downgradeCustomTools(tools: unknown[] | undefined): DowngradedTools {
  if (!Array.isArray(tools) || tools.length === 0) return { tools: [], customNames: [] }
  const customNames: string[] = []
  const mapped = tools.map((tool) => {
    if (!isCustomTool(tool)) return tool
    customNames.push(tool.name)
    const extra = describeFormat(tool.format)
    const description = [typeof tool.description === 'string' ? tool.description : '', extra]
      .filter((s) => s.length > 0)
      .join(' ')
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: description || undefined,
        parameters: {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: '该工具的原始输入文本(按工具要求的格式,不是 JSON 对象)',
            },
          },
          required: ['input'],
          additionalProperties: false,
        },
      },
    }
  })
  return { tools: mapped, customNames }
}

/**
 * 入站还原:把一枚 function_call 的 `arguments` 还原成 custom 工具的 input 文本。
 *
 * 取不到 `input` 字段时整段 arguments 当 input(含空串),绝不返回 null 把调用丢掉。
 */
export function extractCustomInput(argumentsJson: string): string {
  const raw = typeof argumentsJson === 'string' ? argumentsJson : ''
  if (raw.trim().length === 0) return ''
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'object' && parsed !== null && 'input' in parsed) {
      const v = (parsed as { input?: unknown }).input
      return typeof v === 'string' ? v : JSON.stringify(v)
    }
    // 上游直接吐了字符串(不是对象):原样当 input
    if (typeof parsed === 'string') return parsed
  } catch {
    /* 不是 JSON ⇒ 按纯文本处理 */
  }
  return raw
}

/** 判据:某个函数名是否是本次降级出来的 custom 工具。 */
export function isDowngradedCustomCall(name: string, customNames: string[]): boolean {
  return Array.isArray(customNames) && customNames.includes(name)
}

/**
 * 把 function_call 输出项批量还原成 custom_tool_call 项。
 * 非 custom 的项原样保留(同一个对象,不改写)。
 */
export function restoreCustomToolCalls(
  outputs: Array<Record<string, unknown>>,
  customNames: string[],
): Array<Record<string, unknown>> {
  if (!Array.isArray(outputs) || customNames.length === 0) return outputs
  return outputs.map((item) => {
    if (item?.type !== 'function_call') return item
    const name = typeof item.name === 'string' ? item.name : ''
    if (!isDowngradedCustomCall(name, customNames)) return item
    const args = typeof item.arguments === 'string' ? item.arguments : ''
    const out: CustomToolCallOutput = {
      type: 'custom_tool_call',
      id: typeof item.id === 'string' ? item.id : '',
      status: 'completed',
      call_id: typeof item.call_id === 'string' ? item.call_id : '',
      name,
      input: extractCustomInput(args),
    }
    return out as unknown as Record<string, unknown>
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
