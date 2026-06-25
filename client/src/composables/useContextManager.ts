/**
 * 智能上下文管理器
 * 
 * 功能：
 * 1. 滑动窗口上下文管理
 * 2. 自动摘要压缩长对话
 * 3. 关键信息提取和保留
 * 4. Token估算和成本控制
 * 
 * @module composables/useContextManager
 * @version 1.0.0
 */

import { ref, computed, type Ref } from 'vue'
import { logger } from '@/utils/logger'
import { streamGenerateContent } from '@/api/ai/ai'
import type {
  ChatMessage,
  ContextConfig,
  MessageRole,
} from '@/types/ai-platform.types'

// ============================================================================
// 配置
// ============================================================================

const DEFAULT_CONFIG: ContextConfig = {
  maxTokens: 8000,              // 最大Token数
  windowSize: 10,              // 保留最近N条完整消息
  summarizeThreshold: 5000,    // 超过此Token数触发摘要
  preserveSystemMessages: true, // 保留系统消息
}

// Token估算常量（中文字符约2 token，英文单词约1 token）
const TOKENS_PER_CHAR_CN = 0.5
const TOKENS_PER_WORD_EN = 1.3

// ============================================================================
// 类型定义
// ============================================================================

/** 压缩后的消息 */
interface CompressedMessage {
  role: MessageRole
  content: string
  isSummary?: boolean
  summarizedFrom?: string[] // 被摘要的消息ID
  originalTokens?: number
}

/** 上下文状态 */
interface ContextState {
  messages: ChatMessage[]
  compressedMessages: CompressedMessage[]
  totalTokens: number
  summaryTokens: number
  lastSummaryAt?: string
}

/** 关键信息 */
interface KeyInfo {
  type: 'name' | 'date' | 'number' | 'decision' | 'task' | 'custom'
  value: string
  importance: 'low' | 'medium' | 'high'
  extractedFrom: string
}

// ============================================================================
// 状态
// ============================================================================

const config: Ref<ContextConfig> = ref({ ...DEFAULT_CONFIG })
const contextState: Ref<ContextState> = ref({
  messages: [],
  compressedMessages: [],
  totalTokens: 0,
  summaryTokens: 0,
})
const extractedKeyInfo: Ref<KeyInfo[]> = ref([])
const isSummarizing = ref(false)

// ============================================================================
// Token估算
// ============================================================================

/**
 * 估算文本的Token数量
 */
const estimateTokens = (text: string): number => {
  if (!text) return 0
  
  // 统计中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  // 统计英文单词
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  // 其他字符（标点、数字等）
  const otherChars = text.length - chineseChars - (text.match(/[a-zA-Z]+/g) || []).join('').length
  
  return Math.ceil(
    chineseChars * TOKENS_PER_CHAR_CN * 2 +
    englishWords * TOKENS_PER_WORD_EN +
    otherChars * 0.5
  )
}

/**
 * 估算消息列表的总Token数
 */
const estimateTotalTokens = (messages: ChatMessage[]): number => {
  return messages.reduce((total, msg) => {
    // 消息内容
    let tokens = estimateTokens(msg.content)
    // 角色标记（约3-5 tokens）
    tokens += 4
    // 文件附件描述
    if (msg.files && msg.files.length > 0) {
      tokens += msg.files.length * 10
    }
    return total + tokens
  }, 0)
}

// ============================================================================
// 关键信息提取
// ============================================================================

/**
 * 从消息中提取关键信息
 */
const extractKeyInfoFromMessage = (message: ChatMessage): KeyInfo[] => {
  const keyInfo: KeyInfo[] = []
  const content = message.content
  
  // 提取人名（简单的中文名字模式）
  const namePattern = /(?:我是|我叫|名字是|称呼我|叫我)[\s]*([\u4e00-\u9fa5]{2,4})/g
  let match
  while ((match = namePattern.exec(content)) !== null) {
    keyInfo.push({
      type: 'name',
      value: match[1],
      importance: 'high',
      extractedFrom: message.id,
    })
  }
  
  // 提取日期
  const datePattern = /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?|\d{1,2}[月/]\d{1,2}[日/号]?)/g
  while ((match = datePattern.exec(content)) !== null) {
    keyInfo.push({
      type: 'date',
      value: match[1],
      importance: 'medium',
      extractedFrom: message.id,
    })
  }
  
  // 提取数字和金额
  const numberPattern = /(\d+(?:\.\d+)?(?:万|亿|元|块|美元|美金|%|个|条|项)?)/g
  while ((match = numberPattern.exec(content)) !== null) {
    if (match[1].length > 1) { // 过滤单个数字
      keyInfo.push({
        type: 'number',
        value: match[1],
        importance: 'medium',
        extractedFrom: message.id,
      })
    }
  }
  
  // 提取任务关键词
  const taskKeywords = ['要做', '需要', '任务是', '目标是', '计划', '待办', '提醒我']
  for (const keyword of taskKeywords) {
    if (content.includes(keyword)) {
      const startIndex = content.indexOf(keyword)
      const taskContent = content.substring(startIndex, Math.min(startIndex + 50, content.length))
      keyInfo.push({
        type: 'task',
        value: taskContent,
        importance: 'high',
        extractedFrom: message.id,
      })
      break
    }
  }
  
  // 提取决策
  const decisionKeywords = ['决定', '确定', '选择', '同意', '不同意', '确认']
  for (const keyword of decisionKeywords) {
    if (content.includes(keyword)) {
      const startIndex = Math.max(0, content.indexOf(keyword) - 10)
      const endIndex = Math.min(content.indexOf(keyword) + 30, content.length)
      keyInfo.push({
        type: 'decision',
        value: content.substring(startIndex, endIndex),
        importance: 'high',
        extractedFrom: message.id,
      })
      break
    }
  }
  
  return keyInfo
}

// ============================================================================
// 摘要生成
// ============================================================================

/**
 * 生成对话摘要
 */
const generateSummary = async (messages: ChatMessage[]): Promise<string> => {
  if (messages.length === 0) return ''
  
  const conversationText = messages.map(msg => {
    const role = msg.role === 'user' ? '用户' : 'AI'
    return `${role}: ${msg.content}`
  }).join('\n\n')
  
  const prompt = `请将以下对话内容压缩成一个简洁的摘要，保留关键信息和重要决定：

${conversationText}

要求：
1. 保留所有重要的事实、数字、日期
2. 保留用户的关键需求和AI的重要回答
3. 摘要长度控制在原文的1/3以内
4. 使用客观的第三人称描述
5. 直接输出摘要内容，不要包含"摘要："等前缀

请输出摘要：`

  return new Promise<string>((resolve, reject) => {
    let summary = ''
    
    void streamGenerateContent(
      {
        prompt,
        modelId: 'gpt-3.5-turbo', // 使用较便宜的模型进行摘要
        type: 'text',
        parameters: {
          temperature: 0.3,
          maxTokens: 500,
        },
      },
      (chunk: string) => {
        summary += chunk
      },
      () => {
        resolve(summary.trim())
      },
      (error) => {
        logger.error('Failed to generate summary:', error)
        reject(error)
      }
    )
  })
}

// ============================================================================
// 核心方法
// ============================================================================

/**
 * 压缩上下文
 */
const compressContext = async (
  messages: ChatMessage[],
  options?: {
    forceCompress?: boolean
    targetTokens?: number
  }
): Promise<CompressedMessage[]> => {
  const { forceCompress = false, targetTokens } = options || {}
  const _maxTokens = targetTokens || config.value.maxTokens
  
  const currentTokens = estimateTotalTokens(messages)
  
  // 如果不需要压缩，直接返回
  if (!forceCompress && currentTokens <= config.value.summarizeThreshold) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }))
  }
  
  isSummarizing.value = true
  
  try {
    const result: CompressedMessage[] = []
    const windowSize = config.value.windowSize
    
    // 分离系统消息
    const systemMessages = config.value.preserveSystemMessages
      ? messages.filter(m => m.role === 'system')
      : []
    const nonSystemMessages = messages.filter(m => m.role !== 'system')
    
    // 保留最近的消息（在窗口内的）
    const recentMessages = nonSystemMessages.slice(-windowSize)
    const olderMessages = nonSystemMessages.slice(0, -windowSize)
    
    // 添加系统消息
    result.push(...systemMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })))
    
    // 对较早的消息生成摘要
    if (olderMessages.length > 0) {
      const summary = await generateSummary(olderMessages)
      
      if (summary) {
        result.push({
          role: 'system' as MessageRole,
          content: `[前文摘要] ${summary}`,
          isSummary: true,
          summarizedFrom: olderMessages.map(m => m.id),
          originalTokens: estimateTotalTokens(olderMessages),
        })
        
        // 更新状态
        contextState.value.lastSummaryAt = new Date().toISOString()
        contextState.value.summaryTokens = estimateTokens(summary)
      }
    }
    
    // 添加关键信息（如果有）
    const highImportanceInfo = extractedKeyInfo.value.filter(info => info.importance === 'high')
    if (highImportanceInfo.length > 0) {
      const keyInfoText = highImportanceInfo.map(info => `- ${info.type}: ${info.value}`).join('\n')
      result.push({
        role: 'system' as MessageRole,
        content: `[关键信息]\n${keyInfoText}`,
      })
    }
    
    // 添加最近的消息
    result.push(...recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })))
    
    // 更新状态
    contextState.value.compressedMessages = result
    contextState.value.totalTokens = estimateTotalTokens(messages)
    
    return result
    
  } catch (error) {
    logger.error('Failed to compress context:', error)
    // 失败时返回简单截断
    return messages.slice(-config.value.windowSize).map(msg => ({
      role: msg.role,
      content: msg.content,
    }))
  } finally {
    isSummarizing.value = false
  }
}

/**
 * 准备发送给API的消息
 */
const prepareMessagesForAPI = async (
  messages: ChatMessage[],
  options?: {
    maxTokens?: number
    includeKeyInfo?: boolean
  }
): Promise<Array<{ role: MessageRole; content: string }>> => {
  const { maxTokens, includeKeyInfo = true } = options || {}
  
  // 提取关键信息
  if (includeKeyInfo) {
    messages.forEach(msg => {
      if (msg.role === 'user') {
        const keyInfo = extractKeyInfoFromMessage(msg)
        keyInfo.forEach(info => {
          // 避免重复
          if (!extractedKeyInfo.value.find(k => k.value === info.value)) {
            extractedKeyInfo.value.push(info)
          }
        })
      }
    })
    
    // 限制关键信息数量
    if (extractedKeyInfo.value.length > 20) {
      // 保留高重要性的
      const highImportance = extractedKeyInfo.value.filter(k => k.importance === 'high')
      const others = extractedKeyInfo.value.filter(k => k.importance !== 'high').slice(-10)
      extractedKeyInfo.value = [...highImportance, ...others]
    }
  }
  
  // 估算当前Token数
  const currentTokens = estimateTotalTokens(messages)
  const targetMaxTokens = maxTokens || config.value.maxTokens
  
  // 如果超过阈值，进行压缩
  if (currentTokens > config.value.summarizeThreshold) {
    const compressed = await compressContext(messages, {
      targetTokens: targetMaxTokens,
    })
    return compressed.map(m => ({ role: m.role, content: m.content }))
  }
  
  // 否则直接返回
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }))
}

/**
 * 添加消息到上下文
 */
const addMessage = (message: ChatMessage): void => {
  contextState.value.messages.push(message)
  contextState.value.totalTokens = estimateTotalTokens(contextState.value.messages)
  
  // 提取关键信息
  if (message.role === 'user') {
    const keyInfo = extractKeyInfoFromMessage(message)
    extractedKeyInfo.value.push(...keyInfo)
  }
}

/**
 * 清除上下文
 */
const clearContext = (): void => {
  contextState.value = {
    messages: [],
    compressedMessages: [],
    totalTokens: 0,
    summaryTokens: 0,
  }
  extractedKeyInfo.value = []
}

/**
 * 获取上下文统计
 */
const getContextStats = computed(() => ({
  totalMessages: contextState.value.messages.length,
  totalTokens: contextState.value.totalTokens,
  summaryTokens: contextState.value.summaryTokens,
  keyInfoCount: extractedKeyInfo.value.length,
  lastSummaryAt: contextState.value.lastSummaryAt,
  compressionRatio: contextState.value.summaryTokens > 0
    ? (contextState.value.totalTokens / contextState.value.summaryTokens).toFixed(2)
    : 'N/A',
}))

/**
 * 更新配置
 */
const updateConfig = (newConfig: Partial<ContextConfig>): void => {
  config.value = { ...config.value, ...newConfig }
}

// ============================================================================
// Composable 导出
// ============================================================================

/**
 * 使用上下文管理器
 */
export function useContextManager() {
  return {
    // 状态
    config,
    contextState,
    extractedKeyInfo,
    isSummarizing,
    
    // 计算属性
    getContextStats,
    
    // Token估算
    estimateTokens,
    estimateTotalTokens,
    
    // 核心方法
    compressContext,
    prepareMessagesForAPI,
    addMessage,
    clearContext,
    
    // 配置
    updateConfig,
    
    // 关键信息
    extractKeyInfoFromMessage,
  }
}

// 默认导出
export default useContextManager
