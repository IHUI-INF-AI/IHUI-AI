import { t } from '@/utils/i18n'

/**
 * AI 能力组合模板
 * 预定义常用的能力组合，方便快速使用
 */

import {
  AICapabilityType,
  type CapabilityComposition,
  type AICapabilityRequest,
} from './unified-ai-orchestrator'

export type { CapabilityComposition }

/**
 * 数据分析和报告生成组合
 */
export const dataAnalysisComposition: CapabilityComposition = {
  id: 'data-analysis',
  name: '数据分析组合',
  description: t('text.ai_capability_templates.使用MCP工具获'),
  steps: [
    {
      capability: {
        type: AICapabilityType.MCP,
        input: '查询数据',
        context: {
          userMessage: '查询数据',
        },
      } as AICapabilityRequest,
    },
    {
      capability: {
        type: AICapabilityType.MODEL,
        input: '分析数据并生成报告',
      } as AICapabilityRequest,
      transform: (prevResult: any) => ({
        data: prevResult,
        task: '分析数据并生成详细报告',
      }),
    },
  ],
  parallel: false,
}

/**
 * 内容生成和优化组合
 */
export const contentGenerationComposition: CapabilityComposition = {
  id: 'content-generation',
  name: '内容生成组合',
  description: t('text.ai_capability_templates.使用模型生成内容1'),
  steps: [
    {
      capability: {
        type: AICapabilityType.MODEL,
        input: '生成内容',
      } as AICapabilityRequest,
    },
    {
      capability: {
        type: AICapabilityType.AGENT,
        input: '优化内容',
      } as AICapabilityRequest,
      transform: (prevResult: any) => ({
        content: prevResult,
        task: '优化内容质量',
      }),
    },
  ],
  parallel: false,
}

/**
 * 多源数据聚合组合
 */
export const dataAggregationComposition: CapabilityComposition = {
  id: 'data-aggregation',
  name: '多源数据聚合',
  description: t('text.ai_capability_templates.并行从多个MCP2'),
  steps: [
    {
      capability: {
        type: AICapabilityType.MCP,
        input: '获取数据源1',
      } as AICapabilityRequest,
    },
    {
      capability: {
        type: AICapabilityType.MCP,
        input: '获取数据源2',
      } as AICapabilityRequest,
    },
    {
      capability: {
        type: AICapabilityType.MODEL,
        input: '聚合和分析数据',
      } as AICapabilityRequest,
      transform: (prevResult: any) => ({
        dataSources: prevResult,
        task: '聚合和分析所有数据源',
      }),
    },
  ],
  parallel: true, // 前两步并行执行
}

/**
 * 智能问答组合
 */
export const intelligentQAComposition: CapabilityComposition = {
  id: 'intelligent-qa',
  name: '智能问答组合',
  description: t('text.ai_capability_templates.使用MCP工具获3'),
  steps: [
    {
      capability: {
        type: AICapabilityType.MCP,
        input: '搜索相关信息',
      } as AICapabilityRequest,
    },
    {
      capability: {
        type: AICapabilityType.MODEL,
        input: '基于信息回答问题',
      } as AICapabilityRequest,
      transform: (prevResult: any) => ({
        context: prevResult,
        question: '用户问题',
      }),
    },
  ],
  parallel: false,
}

/**
 * 代码生成和测试组合
 */
export const codeGenerationComposition: CapabilityComposition = {
  id: 'code-generation',
  name: '代码生成组合',
  description: t('text.ai_capability_templates.使用模型生成代码4'),
  steps: [
    {
      capability: {
        type: AICapabilityType.MODEL,
        input: '生成代码',
      } as AICapabilityRequest,
    },
    {
      capability: {
        type: AICapabilityType.MCP,
        input: '测试代码',
      } as AICapabilityRequest,
      transform: (prevResult: any) => ({
        code: prevResult,
        action: 'test',
      }),
      condition: (prevResult: any) => {
        const result = prevResult as Record<string, unknown>
        return result && (result.code as number) > 0
      },
    },
  ],
  parallel: false,
}

/**
 * 文档生成和格式化组合
 */
export const documentGenerationComposition: CapabilityComposition = {
  id: 'document-generation',
  name: '文档生成组合',
  description: t('text.ai_capability_templates.使用模型生成文档5'),
  steps: [
    {
      capability: {
        type: AICapabilityType.MODEL,
        input: '生成文档内容',
      } as AICapabilityRequest,
    },
    {
      capability: {
        type: AICapabilityType.AGENT,
        input: '格式化文档',
      } as AICapabilityRequest,
      transform: (prevResult: any) => ({
        content: prevResult,
        format: 'markdown',
      }),
    },
  ],
  parallel: false,
}

/**
 * 所有预定义模板
 */
export const capabilityTemplates: CapabilityComposition[] = [
  dataAnalysisComposition,
  contentGenerationComposition,
  dataAggregationComposition,
  intelligentQAComposition,
  codeGenerationComposition,
  documentGenerationComposition,
]

/**
 * 根据 ID 获取模板
 */
export function getCapabilityTemplate(id: string): CapabilityComposition | undefined {
  return capabilityTemplates.find(t => t.id === id)
}

/**
 * 根据名称搜索模板
 */
export function searchCapabilityTemplates(keyword: string): CapabilityComposition[] {
  const lowerKeyword = keyword.toLowerCase()
  return capabilityTemplates.filter(
    t =>
      t.name.toLowerCase().includes(lowerKeyword) ||
      t.description?.toLowerCase().includes(lowerKeyword)
  )
}
