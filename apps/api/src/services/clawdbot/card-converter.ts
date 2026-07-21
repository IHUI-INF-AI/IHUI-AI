/** Card 转换器 - 将复杂 Coze 卡片模板转换为简化的客户端友好格式(迁移自 coze_zhs_py/card_converter_final.py) */

/**
 * Card 转换结果。
 * - type: 'text' 纯文本 / 'multimodal' 多模态(图/视频) / 'url' 单链接(视频)
 * - content: 主文本或链接
 * - metadata: 卡片标识
 * - error: 解析失败时填充
 */
export interface CardConversionResult {
  type: 'text' | 'multimodal' | 'url'
  content: string
  metadata: {
    card_id?: string
    card_version?: string
  }
  error?: string
}

/** Card element 单节点;Coze 卡片中 elements 以对象(key 索引)形式存储。 */
interface CardElement {
  type?: string
  props?: {
    content?: { type?: string; value?: string }
    src?: string
  }
}

/** Card variable 单节点;variables 以对象(key 索引)形式存储。 */
interface CardVariable {
  name?: string
  defaultValue?: string
}

interface ParsedCardData {
  msg_type?: string
  data?: string | Record<string, unknown>
  x_properties?: { card_id?: string; card_version_code?: string }
  card_type?: number
  info_in_card?: string
  response_for_model?: string
  elements?: Record<string, CardElement>
  variables?: Record<string, CardVariable>
}

/** 将对象/数组/原始值规范化为可遍历的对象值数组。 */
function valuesOf<T>(v: unknown): T[] {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return Object.values(v as Record<string, T>)
  }
  if (Array.isArray(v)) return v as T[]
  return []
}

/**
 * 将复杂 Coze 卡片(嵌套 tool_output_content)转换为简化客户端友好格式。
 * 输入支持 dict 或 JSON 字符串。
 *
 * 迁移自 Python `convert_card_to_simple_format` (card_converter_final.py)。
 */
export function convertCardToSimpleFormat(
  cardData: Record<string, unknown> | string,
): CardConversionResult {
  // Step 1: 字符串输入 → JSON.parse
  let parsed: ParsedCardData
  if (typeof cardData === 'string') {
    try {
      parsed = JSON.parse(cardData) as ParsedCardData
    } catch {
      return { type: 'text', content: '', metadata: {}, error: 'Failed to parse card data' }
    }
  } else {
    parsed = cardData as unknown as ParsedCardData
  }

  // Step 2: msg_type === 'stream_plugin_finish' 时,从 data 字符串中提取 {"card_type": 起始的 JSON
  if (parsed.msg_type === 'stream_plugin_finish') {
    const dataRaw = typeof parsed.data === 'string' ? parsed.data : ''
    if (dataRaw) {
      const startIdx = dataRaw.indexOf('{"card_type":')
      if (startIdx >= 0) {
        // 找到匹配的右花括号(栈匹配)
        let depth = 0
        let endIdx = -1
        for (let i = startIdx; i < dataRaw.length; i++) {
          const c = dataRaw[i]
          if (c === '{') depth++
          else if (c === '}') {
            depth--
            if (depth === 0) {
              endIdx = i + 1
              break
            }
          }
        }
        if (endIdx > 0) {
          let cardJson = dataRaw.slice(startIdx, endIdx)
          // 处理转义 \" 和 \\\" → "(顺序按 Python 源,保留顺序依赖的副作用)
          cardJson = cardJson.replace(/\\"/g, '"')
          cardJson = cardJson.replace(/\\\\"/g, '"')
          try {
            const inner = JSON.parse(cardJson) as ParsedCardData
            // 合并:inner 优先,保留 x_properties(外层优先)
            parsed = {
              ...parsed,
              ...inner,
              x_properties: parsed.x_properties ?? inner.x_properties,
            }
          } catch {
            // card_type JSON 解析失败,忽略
          }
        }
      }
    }
  }

  // Step 3: 提取 metadata
  const metadata: CardConversionResult['metadata'] = {}
  if (parsed.x_properties?.card_id) metadata.card_id = parsed.x_properties.card_id
  if (parsed.x_properties?.card_version_code) {
    metadata.card_version = parsed.x_properties.card_version_code
  }

  // Step 4: 解析 data 字段(JSON 字符串)为 elements + variables
  const dataField = parsed.data
  if (typeof dataField === 'string' && dataField) {
    let dataInner: ParsedCardData
    try {
      dataInner = JSON.parse(dataField) as ParsedCardData
    } catch {
      return { type: 'text', content: '', metadata: {}, error: 'Failed to parse card data' }
    }

    // Step 5: 提取文本(从 elements 中 @flowpd/cici-components/Text 的 props.content.value)
    const textParts: string[] = []
    for (const el of valuesOf<CardElement>(dataInner.elements)) {
      if (el?.type === '@flowpd/cici-components/Text') {
        const content = el.props?.content
        if (content?.type === 'expression' && content.value) {
          textParts.push(content.value)
        }
      }
    }

    // Step 6: 提取图片 URL(从 elements 中 @flowpd/cici-components/NewImage 的 props.src)
    const imageUrls: string[] = []
    for (const el of valuesOf<CardElement>(dataInner.elements)) {
      if (el?.type === '@flowpd/cici-components/NewImage') {
        const src = el.props?.src
        if (src) imageUrls.push(src)
      }
    }

    // Step 7: 提取 variables 中 name === 'video_url' 的 defaultValue
    let videoUrl = ''
    for (const v of valuesOf<CardVariable>(dataInner.variables)) {
      if (v?.name === 'video_url' && v.defaultValue) {
        videoUrl = v.defaultValue
        break
      }
    }

    // Step 8: 若 variables 中无 video_url,从 info_in_card 按 ", " 分隔取第二部分
    if (!videoUrl && parsed.info_in_card) {
      const parts = parsed.info_in_card.split(', ')
      if (parts.length >= 2) {
        videoUrl = (parts[1] ?? '').trim()
      }
    }

    // Step 9: 构建 content_parts(文本 + 视频 URL + 图片 URL)
    const contentParts: string[] = []
    for (const t of textParts) contentParts.push(t)
    if (videoUrl) contentParts.push(videoUrl)
    for (const u of imageUrls) contentParts.push(u)

    // Step 10: 若无 content_parts,从 response_for_model 按 ", " 分隔提取
    if (contentParts.length === 0 && parsed.response_for_model) {
      const parts = parsed.response_for_model.split(', ')
      if (parts.length >= 2) {
        const p = parts[1]?.trim()
        if (p) contentParts.push(p)
      } else if (parts.length === 1) {
        const p = parts[0]?.trim()
        if (p) contentParts.push(p)
      }
    }

    // Step 11: 决定 type 和 content
    let type: CardConversionResult['type'] = 'text'
    let content = contentParts.join('\n')

    if (parsed.card_type === 3 && videoUrl) {
      type = 'url'
      content = videoUrl
    } else if (videoUrl || imageUrls.length > 0) {
      type = 'multimodal'
    }

    if (!content) {
      content = '卡片内容处理完成'
      type = 'text'
    }

    return { type, content, metadata }
  }

  // data 字段缺失:返回默认消息
  return { type: 'text', content: '卡片内容处理完成', metadata }
}
