import { t } from '@/utils/i18n'

/**
 * AI 能力文档自动生成系统
 * 自动生成 AI 能力的文档、示例和使用指南
 */

import { AICapabilityType, type AICapabilityRequest } from './unified-ai-orchestrator'
import { getUnifiedAIOrchestrator } from './unified-ai-orchestrator'
// 能力文档
export interface CapabilityDocumentation {
  id: string
  capabilityId: string
  capabilityType: AICapabilityType
  name: string
  description: string
  overview: string
  features: string[]
  useCases: Array<{
    title: string
    description: string
    example: {
      input: Record<string, unknown>
      output: Record<string, unknown>
    }
  }>
  apiReference: {
    request: AICapabilityRequest
    response: {
      success: Record<string, unknown>
      error: Record<string, unknown>
    }
  }
  parameters: Array<{
    name: string
    type: string
    required: boolean
    description: string
    defaultValue?: unknown
    examples?: Array<Record<string, unknown>>
  }>
  examples: Array<{
    title: string
    description: string
    code: string
    language: 'javascript' | 'typescript' | 'python' | 'curl'
  }>
  bestPractices: string[]
  limitations: string[]
  troubleshooting: Array<{
    issue: string
    solution: string
  }>
  relatedCapabilities: string[]
  changelog: Array<{
    version: string
    date: string
    changes: string[]
  }>
  metadata: {
    author?: string
    version?: string
    lastUpdated: number
  }
}

/**
 * AI 能力文档生成器
 */
export class AICapabilityDocumentationGenerator {
  private orchestrator = getUnifiedAIOrchestrator()

  /**
   * 生成能力文档
   */
  async generateDocumentation(
    capabilityId: string,
    capabilityType: AICapabilityType,
    metadata?: {
      name?: string
      description?: string
      examples?: Array<{ input: Record<string, unknown>; output: Record<string, unknown> }>
    }
  ): Promise<CapabilityDocumentation> {
    const capabilities = this.orchestrator.getAvailableCapabilities(capabilityType) as Array<{
      type: AICapabilityType
      name: string
      description?: string
      available: boolean
      metadata?: { id?: string; name?: string; description?: string; [key: string]: unknown }
    }>
    const capability = capabilities.find(
      c => c.metadata?.id === capabilityId || c.name === capabilityId
    ) as
      | {
          type: AICapabilityType
          name: string
          description?: string
          available: boolean
          metadata?: { id?: string; name?: string; description?: string; [key: string]: unknown }
        }
      | undefined

    if (!capability) {
      throw new Error(`能力 ${capabilityId} 不存在`)
    }

    // 生成基础文档结构
    const doc: CapabilityDocumentation = {
      id: `doc-${capabilityId}-${Date.now()}`,
      capabilityId,
      capabilityType,
      name: metadata?.name || capability.name,
      description: metadata?.description || capability.description || '',
      overview: this.generateOverview(capabilityType, capability),
      features: this.generateFeatures(capabilityType, capability),
      useCases: this.generateUseCases(capabilityType, metadata?.examples) as Array<{
        title: string
        description: string
        example: { input: Record<string, unknown>; output: Record<string, unknown> }
      }>,
      apiReference: this.generateAPIReference(capabilityType, capabilityId),
      parameters: this.generateParameters(capabilityType, capability),
      examples: this.generateCodeExamples(capabilityType, capabilityId),
      bestPractices: this.generateBestPractices(capabilityType),
      limitations: this.generateLimitations(capabilityType),
      troubleshooting: this.generateTroubleshooting(capabilityType),
      relatedCapabilities: this.generateRelatedCapabilities(capabilityType),
      changelog: [],
      metadata: {
        lastUpdated: Date.now(),
      },
    }

    return doc
  }

  /**
   * 生成概述
   */
  private generateOverview(type: AICapabilityType, capability: Record<string, unknown>): string {
    const typeNames: Record<AICapabilityType, string> = {
      [AICapabilityType.MODEL]: '大模型',
      [AICapabilityType.AGENT]: '智能体',
      [AICapabilityType.AGENTIC]: 'Agentic AI 系统',
      [AICapabilityType.MCP]: 'MCP 工具',
      [AICapabilityType.HYBRID]: '混合能力',
      [AICapabilityType.AUTO]: '智能模式',
    }

    return `${typeNames[type]} ${capability.name} 提供了强大的 AI 能力，可以用于各种场景。`
  }

  /**
   * 生成特性列表
   */
  private generateFeatures(type: AICapabilityType, _capability: Record<string, unknown>): string[] {
    const baseFeatures = ['高性能和低延迟', '易于集成和使用', '完善的错误处理']

    switch (type) {
      case AICapabilityType.MODEL:
        return [...baseFeatures, '支持多种模型提供商', '流式输出支持', '可配置的温度和最大令牌数']
      case AICapabilityType.AGENT:
        return [...baseFeatures, '智能对话能力', '上下文记忆', '多平台支持']
      case AICapabilityType.MCP:
        return [...baseFeatures, '丰富的工具生态', '实时数据获取', '灵活的配置选项']
      default:
        return baseFeatures
    }
  }

  /**
   * 生成使用案例
   */
  private generateUseCases(
    type: AICapabilityType,
    examples?: Array<{ input: unknown; output: unknown }>
  ): Array<{
    title: string
    description: string
    example: { input: unknown; output: unknown }
  }> {
    const useCases: Array<{
      title: string
      description: string
      example: { input: unknown; output: unknown }
    }> = []

    if (examples && examples.length > 0) {
      examples.forEach((example, index) => {
        useCases.push({
          title: `使用案例 ${index + 1}`,
          description: t('text.ai_capability_documentation.基于实际使用场景'),
          example,
        })
      })
    } else {
      // 默认使用案例
      switch (type) {
        case AICapabilityType.MODEL:
          useCases.push({
            title: t('text.ai_capability_documentation.文本生成1'),
            description: t('text.ai_capability_documentation.使用模型生成各种2'),
            example: {
              input: '请写一篇关于人工智能的短文',
              output: '人工智能（AI）是计算机科学的一个分支...',
            },
          })
          break
        case AICapabilityType.AGENT:
          useCases.push({
            title: t('text.ai_capability_documentation.智能对话3'),
            description: t('text.ai_capability_documentation.与智能体进行自然4'),
            example: {
              input: '你好，请介绍一下你自己',
              output: '你好！我是一个智能助手...',
            },
          })
          break
        case AICapabilityType.MCP:
          useCases.push({
            title: t('text.ai_capability_documentation.数据查询5'),
            description: t('text.ai_capability_documentation.使用MCP工具查6'),
            example: {
              input: { query: '获取用户信息' },
              output: { users: [] },
            },
          })
          break
      }
    }

    return useCases
  }

  /**
   * 生成 API 参考
   */
  private generateAPIReference(
    type: AICapabilityType,
    capabilityId: string
  ): {
    request: AICapabilityRequest
    response: { success: Record<string, unknown>; error: Record<string, unknown> }
  } {
    return {
      request: {
        type,
        capabilityId,
        input: '示例输入',
        options: {},
      },
      response: {
        success: {
          success: true,
          data: '示例输出',
        },
        error: {
          success: false,
          error: '错误信息',
        },
      },
    }
  }

  /**
   * 生成参数说明
   */
  private generateParameters(
    type: AICapabilityType,
    _capability: Record<string, unknown>
  ): Array<{
    name: string
    type: string
    required: boolean
    description: string
    defaultValue?: unknown
    examples?: Array<Record<string, unknown>>
  }> {
    const baseParams = [
      {
        name: 'input',
        type: 'unknown',
        required: true,
        description: t('text.ai_capability_documentation.输入数据7'),
      },
    ]

    switch (type) {
      case AICapabilityType.MODEL:
        return [
          ...baseParams,
          {
            name: 'temperature',
            type: 'number',
            required: false,
            description: t('text.ai_capability_documentation.温度参数控制输出8'),
            defaultValue: 0.7,
            examples: [0.5, 0.7, 1.0],
          } as unknown as {
            name: string
            type: string
            required: boolean
            description: string
            defaultValue?: unknown
            examples?: Record<string, unknown>[]
          },
          {
            name: 'maxTokens',
            type: 'number',
            required: false,
            description: t('text.ai_capability_documentation.最大令牌数9'),
            defaultValue: 2000,
            examples: [1000, 2000, 4000],
          } as unknown as {
            name: string
            type: string
            required: boolean
            description: string
            defaultValue?: unknown
            examples?: Record<string, unknown>[]
          },
        ]
      default:
        return baseParams
    }
  }

  /**
   * 生成代码示例
   */
  private generateCodeExamples(
    type: AICapabilityType,
    capabilityId: string
  ): Array<{
    title: string
    description: string
    code: string
    language: 'javascript' | 'typescript' | 'python' | 'curl'
  }> {
    const examples: Array<{
      title: string
      description: string
      code: string
      language: 'javascript' | 'typescript' | 'python' | 'curl'
    }> = []

    // JavaScript/TypeScript 示例
    examples.push({
      title: t('text.ai_capability_documentation.JavaScri10'),
      description: t('text.ai_capability_documentation.在JavaScr11'),
      code: `import { useUnifiedAI } from '@/composables/useUnifiedAI';

const { smartInvoke } = useUnifiedAI();

const result = await smartInvoke('你好', {
  preferredType: '${type}',
  context: {
    userMessage: '你好'
  }
});`,
      language: 'typescript',
    })

    // Python 示例
    examples.push({
      title: t('text.ai_capability_documentation.Python调用12'),
      description: t('text.ai_capability_documentation.在Python中13'),
      code: `import requests

response = requests.post('https://api.example.com/unified-ai/invoke', json={
    'type': '${type}',
    'capabilityId': '${capabilityId}',
    'input': '你好'
})

print(response.json())`,
      language: 'python',
    })

    // cURL 示例
    examples.push({
      title: t('text.ai_capability_documentation.cURL调用示例14'),
      description: t('text.ai_capability_documentation.使用cURL命令15'),
      code: `curl -X POST https://api.example.com/unified-ai/invoke \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "${type}",
    "capabilityId": "${capabilityId}",
    "input": "你好"
  }'`,
      language: 'curl',
    })

    return examples
  }

  /**
   * 生成最佳实践
   */
  private generateBestPractices(type: AICapabilityType): string[] {
    const basePractices = ['始终处理错误情况', '设置合理的超时时间', '监控使用成本和性能']

    switch (type) {
      case AICapabilityType.MODEL:
        return [
          ...basePractices,
          '根据任务选择合适的温度参数',
          '限制最大令牌数以控制成本',
          '使用流式输出处理长文本',
        ]
      case AICapabilityType.AGENT:
        return [...basePractices, '维护对话上下文', '处理多轮对话场景', '实现重试机制']
      case AICapabilityType.MCP:
        return [...basePractices, '验证工具参数', '处理工具返回的错误', '缓存频繁调用的结果']
      default:
        return basePractices
    }
  }

  /**
   * 生成限制说明
   */
  private generateLimitations(type: AICapabilityType): string[] {
    const baseLimitations = ['受限于 API 提供商的限制', '可能存在速率限制']

    switch (type) {
      case AICapabilityType.MODEL:
        return [...baseLimitations, '输出长度受最大令牌数限制', '某些模型可能不支持流式输出']
      case AICapabilityType.AGENT:
        return [...baseLimitations, '上下文长度有限制', '可能需要维护对话状态']
      case AICapabilityType.MCP:
        return [...baseLimitations, '工具可用性取决于服务器状态', '某些工具可能需要认证']
      default:
        return baseLimitations
    }
  }

  /**
   * 生成故障排除
   */
  private generateTroubleshooting(
    _type: AICapabilityType
  ): Array<{ issue: string; solution: string }> {
    return [
      {
        issue: '调用超时',
        solution: '检查网络连接，增加超时时间设置',
      },
      {
        issue: '返回错误',
        solution: '检查输入参数是否正确，查看错误日志',
      },
      {
        issue: '性能不佳',
        solution: '考虑使用缓存，优化请求参数',
      },
    ]
  }

  /**
   * 生成相关能力
   */
  private generateRelatedCapabilities(type: AICapabilityType): string[] {
    const related: Record<AICapabilityType, string[]> = {
      [AICapabilityType.MODEL]: ['agent', 'agentic'],
      [AICapabilityType.AGENT]: ['model', 'mcp'],
      [AICapabilityType.AGENTIC]: ['model', 'agent'],
      [AICapabilityType.MCP]: ['model', 'agent'],
      [AICapabilityType.HYBRID]: ['model', 'agent', 'mcp'],
      [AICapabilityType.AUTO]: ['model', 'agent', 'mcp'],
    }

    return related[type] || []
  }

  /**
   * 导出为 Markdown
   */
  exportToMarkdown(doc: CapabilityDocumentation): string {
    let markdown = `# ${doc.name}\n\n`
    markdown += `${doc.description}\n\n`
    markdown += `## 概述\n\n${doc.overview}\n\n`
    markdown += `## 特性\n\n${doc.features.map(f => `- ${f}`).join('\n')}\n\n`
    markdown += `## 使用案例\n\n`
    doc.useCases.forEach(uc => {
      markdown += `### ${uc.title}\n\n${uc.description}\n\n`
      markdown += `**输入:**\n\`\`\`json\n${JSON.stringify(uc.example.input, null, 2)}\n\`\`\`\n\n`
      markdown += `**输出:**\n\`\`\`json\n${JSON.stringify(uc.example.output, null, 2)}\n\`\`\`\n\n`
    })
    markdown += `## API 参考\n\n`
    markdown += `### 请求\n\n\`\`\`json\n${JSON.stringify(doc.apiReference.request, null, 2)}\n\`\`\`\n\n`
    markdown += `### 响应\n\n\`\`\`json\n${JSON.stringify(doc.apiReference.response, null, 2)}\n\`\`\`\n\n`
    markdown += `## 参数说明\n\n`
    doc.parameters.forEach(param => {
      markdown += `### ${param.name}\n\n`
      markdown += `- **类型:** ${param.type}\n`
      markdown += `- **必需:** ${param.required ? '是' : '否'}\n`
      markdown += `- **描述:** ${param.description}\n`
      if (param.defaultValue !== undefined) {
        markdown += `- **默认值:** ${JSON.stringify(param.defaultValue)}\n`
      }
      markdown += `\n`
    })
    markdown += `## 代码示例\n\n`
    doc.examples.forEach(example => {
      markdown += `### ${example.title}\n\n${example.description}\n\n`
      markdown += `\`\`\`${example.language}\n${example.code}\n\`\`\`\n\n`
    })
    markdown += `## 最佳实践\n\n${doc.bestPractices.map(bp => `- ${bp}`).join('\n')}\n\n`
    markdown += `## 限制\n\n${doc.limitations.map(l => `- ${l}`).join('\n')}\n\n`
    markdown += `## 故障排除\n\n`
    doc.troubleshooting.forEach(ts => {
      markdown += `### ${ts.issue}\n\n${ts.solution}\n\n`
    })

    return markdown
  }
}

// 单例实例
let documentationInstance: AICapabilityDocumentationGenerator | null = null

/**
 * 获取 AI 能力文档生成器实例
 */
export function getAICapabilityDocumentationGenerator(): AICapabilityDocumentationGenerator {
  if (!documentationInstance) {
    documentationInstance = new AICapabilityDocumentationGenerator()
  }
  return documentationInstance
}
