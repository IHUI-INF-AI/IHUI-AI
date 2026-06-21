/**
 * Skills-Enhanced AI API
 * 集成Claude官方skills机制的AI调用接口
 * 
 * 实现方式：
 * 1. 自动匹配用户消息到相关技能
 * 2. 加载匹配技能的SKILL.md内容
 * 3. 将技能instructions注入到system prompt
 * 4. 调用AI模型时包含技能上下文
 */

import { getI18nGlobal } from '@/locales'

import { sendChatCompletion, type ChatCompletionRequest } from './fastapi'

const { t } = getI18nGlobal()
import { useSkills } from '@/composables/useSkills'
import { logger } from '@/utils/logger'
import type { ApiResponse } from '@/types/api'

export interface SkillsEnhancedChatRequest extends ChatCompletionRequest {
  userMessage: string
  enableSkills?: boolean
  preferredSkills?: string[]
}

export interface SkillsEnhancedChatResponse {
  content: string
  skillsUsed: Array<{
    name: string
    description: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * 发送带技能增强的AI对话消息
 * 自动匹配并注入相关技能
 */
export async function sendSkillsEnhancedChat(
  request: SkillsEnhancedChatRequest
): Promise<ApiResponse<SkillsEnhancedChatResponse>> {
  const { buildSystemPromptWithSkills, initialize } = useSkills()

  try {
    // 确保技能管理器已初始化
    await initialize()

    // 构建包含技能的system prompt
    let systemPrompt = ''
    const skillsUsed: Array<{ name: string; description: string }> = []

    if (request.enableSkills !== false) {
      // 自动匹配技能并构建system prompt
      systemPrompt = await buildSystemPromptWithSkills(request.userMessage)

      // 如果指定了偏好技能，也加载它们
      if (request.preferredSkills && request.preferredSkills.length > 0) {
        const { activateSkill } = useSkills()
        for (const skillName of request.preferredSkills) {
          const skill = await activateSkill(skillName)
          if (skill) {
            skillsUsed.push({
              name: skill.metadata.name,
              description: skill.metadata.description,
            })
          }
        }
      }
    }

    // 构建消息数组
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

    // 添加system prompt（如果存在）
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      })
    }

    // 添加历史消息（如果存在）
    if (request.messages) {
      // 过滤掉已有的system消息，避免重复
      const nonSystemMessages = request.messages.filter(m => m.role !== 'system')
      messages.push(...nonSystemMessages)
    } else {
      // 如果没有历史消息，添加当前用户消息
      messages.push({
        role: 'user',
        content: request.userMessage,
      })
    }

    // 调用AI API
    const chatRequest: ChatCompletionRequest = {
      ...request,
      messages,
    }

    const response = await sendChatCompletion(chatRequest)

    if (response.success && response.data) {
      const chatResponse = response.data as {
        choices: Array<{
          message: {
            content: string
          }
        }>
        usage?: {
          prompt_tokens: number
          completion_tokens: number
          total_tokens: number
        }
      }

      return {
        success: true,
        data: {
          content: chatResponse.choices[0]?.message?.content || '',
          skillsUsed,
          usage: chatResponse.usage,
        },
        message: 'Success',
        code: 200,
        timestamp: Date.now(),
      }
    }

    return {
      success: false,
      message: response.message || 'AI调用失败',
      code: response.code || 500,
      timestamp: Date.now(),
    }
  } catch (error) {
    logger.error('Skills-enhanced chat failed:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 500,
      timestamp: Date.now(),
    }
  }
}

/**
 * 流式发送带技能增强的AI对话消息
 */
export async function streamSkillsEnhancedChat(
  request: SkillsEnhancedChatRequest,
  onChunk: (chunk: string) => void,
  onComplete?: (response: SkillsEnhancedChatResponse) => void,
  onError?: (error: Error) => void
): Promise<void> {
  const { buildSystemPromptWithSkills, initialize } = useSkills()

  try {
    // 确保技能管理器已初始化
    await initialize()

    // 构建包含技能的system prompt
    let systemPrompt = ''
    const skillsUsed: Array<{ name: string; description: string }> = []

    if (request.enableSkills !== false) {
      systemPrompt = await buildSystemPromptWithSkills(request.userMessage)

      if (request.preferredSkills && request.preferredSkills.length > 0) {
        const { activateSkill } = useSkills()
        for (const skillName of request.preferredSkills) {
          const skill = await activateSkill(skillName)
          if (skill) {
            skillsUsed.push({
              name: skill.metadata.name,
              description: skill.metadata.description,
            })
          }
        }
      }
    }

    // 构建消息数组
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      })
    }

    if (request.messages) {
      const nonSystemMessages = request.messages.filter(m => m.role !== 'system')
      messages.push(...nonSystemMessages)
    } else {
      messages.push({
        role: 'user',
        content: request.userMessage,
      })
    }

    // 使用流式生成（需要适配streamGenerateContent）
    // 注意：streamGenerateContent使用的是AIGenerationRequest格式
    // 这里需要转换为正确的格式或创建新的流式接口
    
    // 临时方案：使用sendChatCompletion的非流式版本
    const chatRequest: ChatCompletionRequest = {
      ...request,
      messages,
      stream: false, // 暂时不支持流式
    }

    const response = await sendChatCompletion(chatRequest)

    if (response.success && response.data) {
      const chatResponse = response.data as {
        choices: Array<{
          message: {
            content: string
          }
        }>
        usage?: {
          prompt_tokens: number
          completion_tokens: number
          total_tokens: number
        }
      }

      const content = chatResponse.choices[0]?.message?.content || ''
      
      // 模拟流式输出
      const chunks = content.split('')
      for (const chunk of chunks) {
        await new Promise(resolve => setTimeout(resolve, 10))
        onChunk(chunk)
      }

      if (onComplete) {
        onComplete({
          content,
          skillsUsed,
          usage: chatResponse.usage,
        })
      }
    } else {
      throw new Error(response.message || t('errors.aiCallFailed'))
    }
  } catch (error) {
    logger.error('Skills-enhanced stream chat failed:', error)
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
  }
}
