/**
 * AI 学习规划报告 API（PR-D）
 *
 * 后端 LLM 接口契约：用户提交学习快照，后端调用 LLM 生成结构化规划报告。
 * 后端未就绪前走 mock（ai-report-mock.ts），后端就绪后仅需设置 VITE_USE_EDU_MOCK=false。
 *
 * 三种 AI 报告实现方式（composable 层 useAiReportEngine.ts 聚合）：
 *  1. local：前端规则引擎（纯函数 generateLocalSuggestions，无 API 调用）
 *  2. chat：AIChat 深度咨询（调 useGlobalChat.open 传 prompt）
 *  3. api：后端 LLM 报告生成（本文件 aiReportApi.generate）
 */
import request from '@/utils/request'
import type { EduBaseResponse, EduPaginatedResponse } from './index'
import { aiReportApiMock } from '@/api/mock/ai-report-mock'

/** 建议分类（与前端规则引擎共用） */
export type AiSuggestionCategory = 'strength' | 'weakness' | 'plan' | 'risk' | 'tip'

/** 建议优先级 */
export type AiSuggestionPriority = 'high' | 'medium' | 'low'

/** 单条 AI 建议（前端规则引擎与后端 LLM 共用结构） */
export interface AiReportSuggestion {
  id: string
  category: AiSuggestionCategory
  priority: AiSuggestionPriority
  /** i18n key 或纯文本（后端返回时为纯文本） */
  title: string
  /** i18n key 或纯文本 */
  description: string
  /** i18n key 或纯文本，可选 */
  actionable?: string
  /** 关联科目/课程名（用于上下文展示，可选） */
  subject?: string
}

/** 生成报告请求 */
export interface AiReportGenerateRequest {
  user_id: string
  period?: 'week' | 'month' | 'quarter' | 'all'
  context?: {
    profile_summary: Record<string, unknown>
    learning_stats: Record<string, unknown>
    weak_subjects: string[]
  }
}

/** 生成报告响应（后端 LLM 产出） */
export interface AiReportGenerateResponse {
  id: number
  /** markdown 格式报告正文 */
  report_text: string
  /** 结构化建议数组（与前端规则引擎同构） */
  suggestions: AiReportSuggestion[]
  generated_at: string
  /** 使用的模型标识，如 "glm-4" / "gpt-4o" */
  model: string
  tokens_used: number
}

const USE_MOCK = import.meta.env.VITE_USE_EDU_MOCK !== 'false'

export const aiReportApi = {
  generate: (data: AiReportGenerateRequest) =>
    USE_MOCK
      ? aiReportApiMock.generate(data)
      : request.post<EduBaseResponse<AiReportGenerateResponse>>('/api/v1/edu/ai-report/generate', data),

  list: (params?: { page?: number; size?: number }) =>
    USE_MOCK
      ? aiReportApiMock.list(params)
      : request.get<EduBaseResponse<EduPaginatedResponse<AiReportGenerateResponse>>>('/api/v1/edu/ai-report', { params }),

  get: (id: number) =>
    USE_MOCK
      ? aiReportApiMock.get(id)
      : request.get<EduBaseResponse<AiReportGenerateResponse>>(`/api/v1/edu/ai-report/${id}`),
}
