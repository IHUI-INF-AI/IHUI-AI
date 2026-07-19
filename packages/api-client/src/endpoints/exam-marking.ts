/**
 * 阅卷评分相关 API(legacy /auth-api/mark/paper 补开发,1 个端点)
 * 对应后端:apps/api/src/routes/exam-marking.ts(prefix: /api/exam-marking)
 * 将答题记录从 submitted 状态置为 graded,记录得分
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

// ===================== 类型定义 =====================

/** 评分请求 */
export interface SubmitExamMarkingInput {
  recordId: string
  score: number
  /** 兼容 Java RecordResponse 扩展字段(当前 gradeExam 仅使用 recordId + score) */
  paperId?: string
  memberId?: string
  answer?: string
  referenceAnswer?: string
}

/** 评分响应(graded 状态的答题记录) */
export interface ExamMarkingResult {
  id: string
  score: number
  status: string
  [key: string]: unknown
}

// ===================== 端点封装 =====================

/** 评分(将答题记录从 submitted 置为 graded) — POST /api/exam-marking */
export async function submitExamMarking(
  input: SubmitExamMarkingInput,
): Promise<ApiResult<ExamMarkingResult>> {
  return fetchApi<ExamMarkingResult>('/api/exam-marking', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
