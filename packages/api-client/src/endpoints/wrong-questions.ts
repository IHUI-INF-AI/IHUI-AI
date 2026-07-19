/**
 * 错题本相关 API(legacy /auth-api/wrong-question 补开发,3 个端点)
 * 对应后端:apps/api/src/routes/wrong-questions.ts(prefix: /api/wrong-questions)
 * 数据表: exam_wrong_question;全部端点需登录,仅本人可见自己的错题
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

// ===================== 类型定义 =====================

/** 错题记录(对应数据表 exam_wrong_question) */
export interface WrongQuestionRecord {
  id: string
  userId: string
  questionId: string
  paperId: string
  paperTitle?: string | null
  userAnswer: string
  rightAnswer: string
  wrongCount?: number
  isMastered?: boolean
  lastWrongAt?: string | null
  createTime?: string | null
  [key: string]: unknown
}

// ===================== 端点封装 =====================

/** 添加错题(幂等:同题同用户只一条,重错时 wrongCount+1) — POST /api/wrong-questions */
export async function createOrUpdateWrongQuestion(input: {
  questionId: string
  paperId: string
  paperTitle?: string
  userAnswer: string
  rightAnswer: string
}): Promise<ApiResult<WrongQuestionRecord>> {
  return fetchApi<WrongQuestionRecord>('/api/wrong-questions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 删除错题(仅本人) — DELETE /api/wrong-questions */
export async function deleteWrongQuestion(
  id: string,
): Promise<ApiResult<{ id: string; deleted: boolean }>> {
  return fetchApi<{ id: string; deleted: boolean }>('/api/wrong-questions', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
}

/** 获取错题列表(支持 paperId / isMastered 筛选) — GET /api/wrong-questions */
export async function getWrongQuestions(
  query: { page?: number; pageSize?: number; paperId?: string; isMastered?: boolean } = {},
): Promise<ApiResult<PageData<WrongQuestionRecord>>> {
  return fetchApi<PageData<WrongQuestionRecord>>(`/api/wrong-questions${buildQs(query)}`)
}
