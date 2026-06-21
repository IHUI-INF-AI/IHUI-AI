/**
 * 考试系统 API
 * 对接后端 /exam/* 端点
 */

import http from '@/utils/request'

export interface ExamPaper {
  id: number
  title: string
  description?: string
  category_id: number
  course_id?: number
  cover?: string
  total_score: number
  pass_score: number
  duration: number
  question_num: number
  attempt_num: number
  avg_score: number
  type: string
  difficulty: string
  is_free: boolean
  price: number
  status: number
  sort_order: number
  create_time: string
}

export interface ExamQuestion {
  id: number
  paper_id: number
  type: 'single' | 'multiple' | 'judge' | 'fill' | 'essay'
  content: string
  options?: string[]
  answer: string
  analysis?: string
  score: number
  sort_order: number
}

export interface ExamRecord {
  id: number
  paper_id: number
  user_id: string
  score: number
  total_score: number
  passed: boolean
  duration: number
  answers: Record<string, any>
  create_time: string
}

export const examApi = {
  // 试卷列表
  listPapers: (params?: { page?: number; limit?: number; category_id?: number; keyword?: string; difficulty?: string }) =>
    http.get('/exam/paper/list', { params }),

  // 试卷详情
  paperDetail: (id: number) => http.get('/exam/paper/detail', { params: { id } }),

  // 分类
  categories: () => http.get('/exam/category/list'),

  // 题目列表
  questions: (paperId: number) => http.get('/exam/question/list', { params: { paper_id: paperId } }),

  // 提交答卷
  submit: (data: { paper_id: number; answers: Record<string, any>; duration: number }) =>
    http.post('/exam/record', data),

  // 考试记录
  records: (params?: { page?: number; limit?: number }) => http.get('/exam/record/list', { params }),

  // 错题本
  wrongList: (params?: { page?: number; limit?: number }) => http.get('/exam/wrong/list', { params }),

  // 移除错题
  removeWrong: (id: number) => http.delete('/exam/wrong', { params: { id } }),
}
