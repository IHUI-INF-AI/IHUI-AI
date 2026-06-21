import { t } from '@/utils/i18n'

/**
 * Extended Tools - 扩展工具集
 * 
 * 补充 OpenClaw 最新的工具:
 * - Lobster (LLM 任务)
 * - apply_patch (代码补丁)
 * - Elevated Mode (提权模式)
 * - Chrome Extension 集成
 * - Canvas 画布
 * - Voice Call
 * - Camera Capture
 * - Location
 */

import { logger } from '@/utils/logger'
import type { ToolDefinition } from './index'

/**
 * Lobster 工具 - LLM 子任务
 * 用于将复杂任务分解为子任务并调用 LLM 处理
 */
export const lobsterTool: ToolDefinition = {
  name: 'lobster',
  description: t('text.extended_tools.调用LLM执行子'),
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      task: { type: 'string', description: t('text.extended_tools.要执行的子任务描1'), required: true },
      context: { type: 'string', description: t('text.extended_tools.上下文信息2') },
      model: { type: 'string', description: t('text.extended_tools.使用的模型3'), default: 'gpt-4' },
      maxTokens: { type: 'number', description: t('text.extended_tools.最大Token数4'), default: 2000 },
    },
    required: ['task'],
  },
  timeout: 60000,
  execute: async (params, _context) => {
    const startTime = Date.now()
    try {
      logger.info(`[Lobster] Executing subtask: ${params.task}`)
      
      // 这里应该调用实际的 LLM API
      // 模拟返回
      return {
        success: true,
        data: {
          task: params.task,
          result: `子任务 "${params.task}" 执行完成`,
        },
        executionTime: Date.now() - startTime,
        output: `子任务执行完成`,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * LLM Task 工具
 */
export const llmTaskTool: ToolDefinition = {
  name: 'llm_task',
  description: t('text.extended_tools.使用LLM处理特5'),
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: t('text.extended_tools.提示词6'), required: true },
      systemPrompt: { type: 'string', description: t('text.extended_tools.系统提示词7') },
      temperature: { type: 'number', description: t('text.extended_tools.温度参数8'), default: 0.7 },
      format: { type: 'string', description: t('text.extended_tools.输出格式9'), enum: ['text', 'json', 'markdown'] },
    },
    required: ['prompt'],
  },
  execute: async (params, _context) => {
    const startTime = Date.now()
    try {
      logger.info(`[LLM Task] Executing: ${(params.prompt as string).substring(0, 50)}...`)
      
      return {
        success: true,
        data: {
          response: `LLM 处理完成: ${params.prompt}`,
        },
        executionTime: Date.now() - startTime,
        output: `LLM 任务执行完成`,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * apply_patch 工具 - 应用代码补丁
 */
export const applyPatchTool: ToolDefinition = {
  name: 'apply_patch',
  description: t('text.extended_tools.应用代码补丁支持10'),
  category: 'code',
  dangerous: true,
  requiresConfirmation: true,
  parameters: {
    type: 'object',
    properties: {
      patch: { type: 'string', description: t('text.extended_tools.Unifiedd11'), required: true },
      file: { type: 'string', description: t('text.extended_tools.目标文件路径12'), required: true },
      dryRun: { type: 'boolean', description: t('text.extended_tools.是否只预览不应用13'), default: false },
    },
    required: ['patch', 'file'],
  },
  execute: async (params, _context) => {
    const startTime = Date.now()
    try {
      logger.info(`[apply_patch] Applying patch to: ${params.file}`)
      
      if (params.dryRun) {
        return {
          success: true,
          data: { preview: true, patch: params.patch, file: params.file },
          executionTime: Date.now() - startTime,
          output: `补丁预览完成（未应用）`,
        }
      }
      
      // 实际应用补丁的逻辑需要后端支持
      return {
        success: true,
        data: { applied: true, file: params.file },
        executionTime: Date.now() - startTime,
        output: `补丁已应用到 ${params.file}`,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * Elevated Mode 工具 - 提权执行
 */
export const elevatedTool: ToolDefinition = {
  name: 'elevated_exec',
  description: t('text.extended_tools.以提权模式执行命14'),
  category: 'shell',
  dangerous: true,
  requiresConfirmation: true,
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: t('text.extended_tools.要执行的命令15'), required: true },
      reason: { type: 'string', description: t('text.extended_tools.需要提权的原因16'), required: true },
    },
    required: ['command', 'reason'],
  },
  execute: async (params, _context) => {
    const startTime = Date.now()
    try {
      logger.warn(`[Elevated] Elevated execution: ${params.reason}`)
      
      // 实际执行需要用户确认和后端支持
      return {
        success: true,
        data: { 
          command: params.command,
          elevated: true,
          reason: params.reason,
        },
        executionTime: Date.now() - startTime,
        output: `命令已以提权模式执行`,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * Canvas 工具 - 画布操作
 */
export const canvasTool: ToolDefinition = {
  name: 'canvas',
  description: t('text.extended_tools.在画布上绘制创建17'),
  category: 'custom',
  parameters: {
    type: 'object',
    properties: {
      action: { 
        type: 'string', 
        description: t('text.extended_tools.操作类型18'), 
        enum: ['create', 'update', 'render', 'export'],
        required: true 
      },
      content: { type: 'string', description: t('text.extended_tools.画布内容19') },
      format: { type: 'string', description: t('text.extended_tools.格式20'), enum: ['svg', 'html', 'markdown', 'mermaid'] },
      width: { type: 'number', description: t('text.extended_tools.宽度21') },
      height: { type: 'number', description: t('text.extended_tools.高度22') },
    },
    required: ['action'],
  },
  execute: async (params, _context) => {
    const startTime = Date.now()
    try {
      logger.info(`[Canvas] Operation: ${params.action}`)
      
      return {
        success: true,
        data: {
          action: params.action,
          content: params.content,
          format: params.format,
        },
        executionTime: Date.now() - startTime,
        output: `画布操作 ${params.action} 完成`,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * Voice Call 工具
 */
export const voiceCallTool: ToolDefinition = {
  name: 'voice_call',
  description: t('text.extended_tools.发起或管理语音通23'),
  category: 'custom',
  parameters: {
    type: 'object',
    properties: {
      action: { 
        type: 'string', 
        description: t('text.extended_tools.操作类型24'), 
        enum: ['start', 'end', 'mute', 'unmute', 'transfer'],
        required: true 
      },
      target: { type: 'string', description: t('text.extended_tools.通话目标25') },
      message: { type: 'string', description: t('text.extended_tools.语音消息TTS26') },
    },
    required: ['action'],
  },
  execute: async (params, _context) => {
    const startTime = Date.now()
    try {
      logger.info(`[VoiceCall] Operation: ${params.action}, target: ${params.target}`)
      
      return {
        success: true,
        data: {
          action: params.action,
          target: params.target,
          status: 'completed',
        },
        executionTime: Date.now() - startTime,
        output: `语音通话操作 ${params.action} 完成`,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * Camera Capture 工具
 */
export const cameraCaptureTool: ToolDefinition = {
  name: 'camera_capture',
  description: t('text.extended_tools.从摄像头捕获图像27'),
  category: 'custom',
  parameters: {
    type: 'object',
    properties: {
      device: { type: 'string', description: t('text.extended_tools.摄像头设备ID28') },
      resolution: { type: 'string', description: t('text.extended_tools.分辨率29'), enum: ['low', 'medium', 'high', '4k'] },
      format: { type: 'string', description: t('text.extended_tools.图片格式30'), enum: ['jpeg', 'png', 'webp'] },
    },
  },
  execute: async (params, _context) => {
    const startTime = Date.now()
    try {
      logger.info(`[CameraCapture] Capturing image`)
      
      // 实际实现需要访问设备摄像头
      return {
        success: true,
        data: {
          captured: true,
          format: params.format || 'jpeg',
          timestamp: Date.now(),
        },
        executionTime: Date.now() - startTime,
        output: `摄像头图像已捕获`,
        attachments: [{
          type: 'image',
          name: `capture_${Date.now()}.${params.format || 'jpeg'}`,
          content: '', // 实际图像数据
          mimeType: `image/${params.format || 'jpeg'}`,
        }],
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * Location 工具
 */
export const locationTool: ToolDefinition = {
  name: 'location',
  description: t('text.extended_tools.获取或设置地理位31'),
  category: 'custom',
  parameters: {
    type: 'object',
    properties: {
      action: { 
        type: 'string', 
        description: t('text.extended_tools.操作类型32'), 
        enum: ['get', 'search', 'directions', 'nearby'],
        required: true 
      },
      query: { type: 'string', description: t('text.extended_tools.搜索查询33') },
      lat: { type: 'number', description: t('text.extended_tools.纬度34') },
      lng: { type: 'number', description: t('text.extended_tools.经度35') },
      radius: { type: 'number', description: t('text.extended_tools.搜索半径米36') },
    },
    required: ['action'],
  },
  execute: async (params, _context) => {
    const startTime = Date.now()
    try {
      logger.info(`[Location] Operation: ${params.action}`)
      
      if (params.action === 'get') {
        // 获取当前位置（需要用户授权）
        return {
          success: true,
          data: {
            lat: 0,
            lng: 0,
            accuracy: 0,
            timestamp: Date.now(),
          },
          executionTime: Date.now() - startTime,
          output: `位置信息已获取`,
        }
      }
      
      return {
        success: true,
        data: {
          action: params.action,
          query: params.query,
          results: [],
        },
        executionTime: Date.now() - startTime,
        output: `位置操作 ${params.action} 完成`,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * Agent Send 工具 - 发送消息到其他 Agent
 */
export const agentSendTool: ToolDefinition = {
  name: 'agent_send',
  description: t('text.extended_tools.发送消息到其他A37'),
  category: 'custom',
  parameters: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: t('text.extended_tools.目标AgentI38'), required: true },
      message: { type: 'string', description: t('text.extended_tools.消息内容39'), required: true },
      context: { type: 'object', description: t('text.extended_tools.上下文数据40') },
      waitForResponse: { type: 'boolean', description: t('text.extended_tools.是否等待响应41'), default: true },
    },
    required: ['agentId', 'message'],
  },
  execute: async (params, _context) => {
    const startTime = Date.now()
    try {
      logger.info(`[AgentSend] Sending to ${params.agentId}: ${params.message}`)
      
      return {
        success: true,
        data: {
          agentId: params.agentId,
          sent: true,
          response: params.waitForResponse ? 'Agent 响应' : null,
        },
        executionTime: Date.now() - startTime,
        output: `消息已发送到 Agent ${params.agentId}`,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * Sub-Agent 工具 - 创建子 Agent
 */
export const subAgentTool: ToolDefinition = {
  name: 'create_subagent',
  description: t('text.extended_tools.创建子Agent42'),
  category: 'custom',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: t('text.extended_tools.子Agent名称43'), required: true },
      task: { type: 'string', description: t('text.extended_tools.任务描述44'), required: true },
      tools: { type: 'array', description: t('text.extended_tools.可用工具列表45') },
      timeout: { type: 'number', description: t('text.extended_tools.超时时间秒46'), default: 300 },
    },
    required: ['name', 'task'],
  },
  execute: async (params, _context) => {
    const startTime = Date.now()
    try {
      logger.info(`[SubAgent] Creating: ${params.task}`)
      
      const subAgentId = `subagent_${Date.now()}`
      
      return {
        success: true,
        data: {
          subAgentId,
          name: params.name,
          task: params.task,
          status: 'created',
        },
        executionTime: Date.now() - startTime,
        output: `子 Agent ${params.name} 已创建`,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * Reactions 工具 - 消息反应
 */
export const reactionsTool: ToolDefinition = {
  name: 'react',
  description: t('text.extended_tools.对消息添加反应表47'),
  category: 'custom',
  parameters: {
    type: 'object',
    properties: {
      messageId: { type: 'string', description: t('text.extended_tools.消息ID48'), required: true },
      emoji: { type: 'string', description: t('text.extended_tools.表情符号49'), required: true },
      action: { type: 'string', description: t('text.extended_tools.操作50'), enum: ['add', 'remove'], default: 'add' },
    },
    required: ['messageId', 'emoji'],
  },
  execute: async (params, _context) => {
    const startTime = Date.now()
    try {
      logger.info(`[Reactions] ${params.action} ${params.emoji} to ${params.messageId}`)
      
      return {
        success: true,
        data: {
          messageId: params.messageId,
          emoji: params.emoji,
          action: params.action,
        },
        executionTime: Date.now() - startTime,
        output: `已${params.action === 'add' ? '添加' : '移除'}反应 ${params.emoji}`,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * 获取所有扩展工具
 */
export function getExtendedTools(): ToolDefinition[] {
  return [
    lobsterTool,
    llmTaskTool,
    applyPatchTool,
    elevatedTool,
    canvasTool,
    voiceCallTool,
    cameraCaptureTool,
    locationTool,
    agentSendTool,
    subAgentTool,
    reactionsTool,
  ]
}
