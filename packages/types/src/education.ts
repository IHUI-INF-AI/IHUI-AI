/** SM-2 间隔重复算法参数 */
export interface SM2Params {
  easeFactor: number // 初始 2.5,最低 1.3
  interval: number // 天数
  repetition: number // 重复次数
}

/** SM-2 复习请求 */
export interface SRSReviewRequest {
  questionId: string
  quality: number // 0-5(0-2 失败,3-5 成功)
}

/** SM-2 复习响应 */
export interface SRSReviewResponse {
  success: boolean
  nextReviewDate: string
  interval: number
  easeFactor: number
  repetition: number
}

/** SRS 待复习项 */
export interface SRSReviewItem {
  id: string
  userId: string
  questionId: string
  questionText: string
  questionType: string
  dueDate: string
  easeFactor: number
  interval: number
  repetition: number
  lastReviewAt: string | null
}

/** AI 助教请求 */
export interface AITutorRequest {
  subject: string // 学科
  question: string // 学生问题
  context?: {
    chapter?: string
    knowledgePoints?: string[]
    difficulty?: 'easy' | 'medium' | 'hard'
  }
  mode: 'explain' | 'hint' | 'quiz' // 讲解/提示/出题
}

/** AI 助教响应 */
export interface AITutorResponse {
  answer: string
  knowledgePoints: string[]
  followUpQuestions: string[]
  resources: { title: string; url: string }[]
}

/** AI 批改请求 */
export interface AIGradingRequest {
  questionId: string
  studentAnswer: string
  rubric?: Record<string, unknown>
  model?: string
}

/** AI 批改响应 */
export interface AIGradingResponse {
  score: number // 0-100
  feedback: string
  rubricScores: { criterion: string; score: number; comment: string }[]
  status: 'pending' | 'approved' | 'rejected'
}

/** AI 出题请求 */
export interface AIQuestionGenRequest {
  subject: string
  chapter?: string
  questionType: 'choice' | 'fill' | 'subjective'
  difficulty: 'easy' | 'medium' | 'hard'
  knowledgePoints?: string[]
  count?: number // 生成数量,默认 1
}

/** AI 出题响应 */
export interface AIQuestionGenResponse {
  questions: {
    questionText: string
    options?: string[]
    answer: string
    explanation: string
    knowledgePoints: string[]
    difficulty: string
  }[]
}
