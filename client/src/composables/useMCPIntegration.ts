/**
 * MCP 集成到现有功能的 Composable
 * 提供智能工具调用、自动参数提取等功能
 */
 
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getI18nGlobal } from '@/locales'
import { useMCP, type MCPCallResult } from './useMCP'
import type { MCPTool } from '@/api/tools/mcp'

// 工具调用上下文
interface ToolCallContext {
  userMessage: string
  conversationHistory?: Array<{ role: string; content: string }>
  currentData?: any
}

// 智能工具匹配结果
interface ToolMatch {
  tool: { server: { id: string; name: string; [key: string]: any }; tool: MCPTool }
  confidence: number
  extractedParams?: Record<string, unknown>
  reason: string
}

/**
 * MCP 集成 Composable
 */
export function useMCPIntegration() {
  const { allTools, useMCPTool } = useMCP()

  // 工具调用历史（用于上下文理解）
  const toolCallHistory = ref<MCPCallResult[]>([])

  // 收藏的工具
  const favoriteTools = ref<Set<string>>(new Set())

  /**
   * 智能匹配工具
   * 根据用户消息自动匹配最合适的工具
   */
  const matchTools = (userMessage: string, _context?: ToolCallContext): ToolMatch[] => {
    const message = userMessage.toLowerCase()
    const matches: ToolMatch[] = []

    for (const toolItem of allTools.value) {
      const tool = toolItem.tool
      const toolName = tool.name.toLowerCase()
      const description = (tool.description || '').toLowerCase()

      let confidence = 0
      let reason = ''
      const extractedParams: Record<string, unknown> = {}

      // 1. 工具名称匹配
      if (message.includes(toolName) || toolName.includes(message)) {
        confidence += 0.5
        reason = `工具名称匹配: ${tool.name}`
      }

      // 2. 描述关键词匹配
      const keywords = extractKeywords(description)
      const messageWords = message.split(/\s+/)
      const matchedKeywords = keywords.filter(kw => messageWords.some(word => word.includes(kw)))
      if (matchedKeywords.length > 0) {
        confidence += matchedKeywords.length * 0.1
        reason = `关键词匹配: ${matchedKeywords.join(', ')}`
      }

      // 3. 参数提取
      if (tool.inputSchema?.properties) {
        for (const [paramName, paramSchema] of Object.entries(tool.inputSchema.properties)) {
          const paramValue = extractParameter(
            message,
            paramName,
            paramSchema as {
              type?: string
              description?: string
              enum?: any[]
              format?: string
            }
          )
          if (paramValue !== undefined) {
            extractedParams[paramName] = paramValue
            confidence += 0.1
          }
        }
      }

      // 4. 收藏工具加分
      if (favoriteTools.value.has(`${toolItem.server.id}-${tool.name}`)) {
        confidence += 0.2
      }

      if (confidence > 0) {
        matches.push({
          tool: {
            server: toolItem.server as unknown as {
              id: string
              name: string
              [key: string]: any
            },
            tool: toolItem.tool,
          },
          confidence: Math.min(confidence, 1),
          extractedParams: Object.keys(extractedParams).length > 0 ? extractedParams : undefined,
          reason,
        })
      }
    }

    // 按置信度排序
    return matches.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * 智能调用工具
   * 自动匹配并调用最合适的工具
   */
  const smartInvoke = async (
    userMessage: string,
    context?: ToolCallContext
  ): Promise<MCPCallResult | null> => {
    const matches = matchTools(userMessage, context)

    if (matches.length === 0) {
      ElMessage.warning(String(getI18nGlobal().t('messages.toolNotFound')))
      return null
    }

    // 使用置信度最高的工具
    const bestMatch = matches[0]

    if (bestMatch.confidence < 0.3) {
      ElMessage.warning(
        `工具匹配置信度较低 (${(bestMatch.confidence * 100).toFixed(0)}%)，可能不是最佳选择`
      )
    }

    // 合并提取的参数和默认参数
    const params = {
      ...(bestMatch.extractedParams as Record<string, unknown>),
      ...((context?.currentData as Record<string, unknown>) || {}),
    }

    const result = await useMCPTool(bestMatch.tool.tool.name, params, bestMatch.tool.server.id)

    if (result) {
      toolCallHistory.value.unshift(result)
      // 只保留最近 50 条
      if (toolCallHistory.value.length > 50) {
        toolCallHistory.value = toolCallHistory.value.slice(0, 50)
      }
    }

    return result
  }

  /**
   * 批量智能调用
   * 根据消息匹配多个工具并依次调用
   */
  const smartInvokeBatch = async (
    userMessage: string,
    context?: ToolCallContext
  ): Promise<MCPCallResult[]> => {
    const matches = matchTools(userMessage, context)

    if (matches.length === 0) {
      return []
    }

    // 只调用置信度 > 0.5 的工具
    const highConfidenceMatches = matches.filter(m => m.confidence > 0.5)

    const results: MCPCallResult[] = []

    for (const match of highConfidenceMatches.slice(0, 5)) {
      // 最多调用 5 个工具
      const params = {
        ...(match.extractedParams as Record<string, unknown>),
        ...((context?.currentData as Record<string, unknown>) || {}),
      }

      const result = await useMCPTool(match.tool.tool.name, params, match.tool.server.id)

      if (result) {
        results.push(result)
        toolCallHistory.value.unshift(result)
      }
    }

    return results
  }

  /**
   * 收藏/取消收藏工具
   */
  const toggleFavorite = (serverId: string, toolName: string) => {
    const key = `${serverId}-${toolName}`
    if (favoriteTools.value.has(key)) {
      favoriteTools.value.delete(key)
      ElMessage.success(String(getI18nGlobal().t('messages.favoriteRemoved')))
    } else {
      favoriteTools.value.add(key)
      ElMessage.success(String(getI18nGlobal().t('messages.favoriteAdded')))
    }
  }

  /**
   * 检查工具是否已收藏
   */
  const isFavorite = (serverId: string, toolName: string): boolean => {
    return favoriteTools.value.has(`${serverId}-${toolName}`)
  }

  /**
   * 获取收藏的工具列表
   */
  const favoriteToolsList = computed(() => {
    return allTools.value.filter((toolItem: { server: { id: string }; tool: { name: string } }) =>
      isFavorite(toolItem.server.id, toolItem.tool.name)
    )
  })

  return {
    // 状态
    toolCallHistory,
    favoriteTools,
    favoriteToolsList,

    // 方法
    matchTools,
    smartInvoke,
    smartInvokeBatch,
    toggleFavorite,
    isFavorite,
  }
}

/**
 * 提取关键词
 */
function extractKeywords(text: string): string[] {
  // 移除常见停用词
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'should',
    'could',
    'may',
    'might',
    'must',
    'can',
    'this',
    'that',
    'these',
    'those',
  ])

  return text
    .split(/\s+/)
    .map(word => word.toLowerCase().replace(/[^\w]/g, ''))
    .filter(word => word.length > 2 && !stopWords.has(word))
}

/**
 * 从消息中提取参数
 */
function extractParameter(
  message: string,
  paramName: string,
  paramSchema: { type?: string; description?: string; enum?: any[]; format?: string }
): any {
  const lowerMessage = message.toLowerCase()
  const lowerParamName = paramName.toLowerCase()

  // 1. 直接匹配参数名
  if (lowerMessage.includes(lowerParamName)) {
    // 尝试提取参数值
    const regex = new RegExp(`${lowerParamName}[\\s:：=]+([^\\s,，]+)`, 'i')
    const match = message.match(regex)
    if (match && match[1]) {
      return parseValue(match[1], paramSchema)
    }
  }

  // 2. 根据参数类型推断
  if (paramSchema.type === 'string') {
    // 如果是 URL 类型
    if (paramSchema.format === 'uri' || paramName.includes('url')) {
      const urlMatch = message.match(/https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.[a-z]{2,}/i)
      if (urlMatch) {
        return urlMatch[0]
      }
    }
    // 如果是邮箱类型
    if (paramSchema.format === 'email' || paramName.includes('email')) {
      const emailMatch = message.match(/[^\s]+@[^\s]+\.[^\s]+/i)
      if (emailMatch) {
        return emailMatch[0]
      }
    }
  }

  // 3. 如果是数字类型
  if (paramSchema.type === 'number' || paramSchema.type === 'integer') {
    const numberMatch = message.match(/\d+/)
    if (numberMatch) {
      const num = parseFloat(numberMatch[0])
      return isNaN(num) ? undefined : num
    }
  }

  // 4. 如果是布尔类型
  if (paramSchema.type === 'boolean') {
    if (lowerMessage.includes('是') || lowerMessage.includes('yes')) {
      return true
    }
    if (lowerMessage.includes('否') || lowerMessage.includes('no')) {
      return false
    }
  }

  return undefined
}

/**
 * 解析值
 */
function parseValue(value: string, schema: { type?: string; enum?: any[] }): any {
  if (schema.type === 'number' || schema.type === 'integer') {
    const num = parseFloat(value)
    return isNaN(num) ? undefined : num
  }
  if (schema.type === 'boolean') {
    return value.toLowerCase() === 'true' || value === '1'
  }
  return value
}
