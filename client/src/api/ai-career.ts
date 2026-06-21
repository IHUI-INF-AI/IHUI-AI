import { COZE_PATHS } from '@/config/backend-paths'
import { t } from '@/utils/i18n'

/**
 * AI生涯指导相关API
 * 对应后端路由：/cozeZhsApi/ai-career
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import { logger } from '@/utils/logger'

// AI生涯指导表单数据
export interface AICareerFormData {
  school: string // 孩子目前就读的学校
  classLevel: string // 孩子班级整体水平
  scoreRange: string // 语文和英语考试分数范围
  languageDifficulty: string // 语文和英语学习困难
  scienceCharacteristics?: string // 理科学习特点
  learningObstacle?: string // 学习障碍
  hobbies?: string // 兴趣爱好
  personality?: string // 性格特点
  extraTime?: string // 课外学习余力
  pressureTolerance?: string // 压力承受度
  learningGoal?: string // 学习目标期待
  personalityTest1?: string // 性格测试1
  personalityTest2?: string // 性格测试2
  personalityTest3?: string // 性格测试3
  personalityTest4?: string // 性格测试4
  personalityTest5?: string // 性格测试5
  [key: string]: string | undefined
}

// 提交AI生涯指导表单
export const submitAICareerForm = withApiResponseHandler(
  async (
    formData: AICareerFormData
  ): Promise<ApiResponse<{ message: string; recommendation?: string }>> => {
    try {
      if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
        logger.info('[AICareer] Using mock data in dev environment')
        return {
          code: 200,
          success: true,
          message: 'mock',
          data: {
            message: t('api.ai_career.提交成功我们将尽'),
            recommendation: '根据您提供的信息，我们建议...',
          },
          timestamp: Date.now(),
        }
      }

      logger.info('[AICareer] Submitting AI career guidance form', formData)

      const response = await request.post<{ message: string; recommendation?: string }>(
        COZE_PATHS.aiCareer.submit,
        formData
      )

      logger.info('[AICareer] Form submitted successfully', response.data)

      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[AICareer] Form submission failed:', error)
      throw error
    }
  }
)
