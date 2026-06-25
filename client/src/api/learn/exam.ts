/**
 * 鑰冭瘯绯荤粺 API
 * 瀵规帴鍚庣 /exam/* 绔偣
 */

import http from '@/utils/request'

export interface ExamPaper {
  id: number
  title: string
  description?: string
  category_id: number
  category?: { id: number; name: string } | null
  course_id?: number
  cover?: string
  total_score: number
  pass_score: number
  duration: number
  question_num: number
  attempt_num: number
  avg_score: number
  type: number
  difficulty: number
  is_free: boolean
  price: number
  status: number
  sort_order: number
  create_time: string
}

export interface ExamQuestion {
  id: number
  paper_id: number
  type: 1 | 2 | 3 | 4 | 5
  content: string
  options?: string | string[]
  answer: string
  analysis?: string
  score: number
  sort_order: number
}

export interface ExamRecord {
  id: number
  paper_id: number
  paper_title: string
  user_id: string
  score: number
  total_score: number
  pass_score: number
  is_pass: boolean
  status: number
  correct_num: number
  wrong_num: number
  cost_time: number
  answer_data?: string
  start_time?: string
  submit_time?: string
}

export interface ExamWrong {
  id: number
  question_id: number
  paper_id: number
  paper_title: string
  user_answer: string
  right_answer: string
  wrong_count: number
  is_mastered: boolean
  last_wrong_time?: string
}

export interface ExamCategory {
  id: number
  pid: number
  name: string
  sort_order: number
}

export const examApi = {
  listPapers: (params?: { page?: number; limit?: number; category_id?: number; keyword?: string; difficulty?: number; is_free?: boolean }) =>
    http.get('/exam/paper/list', { params }),

  paperDetail: (id: number) => http.get(`/exam/paper/${id}`),

  startExam: (paper_id: number) =>
    http.post('/exam/record/start', null, { params: { paper_id } }),

  submitExam: (record_id: number, answers: Record<string, any>, duration: number) =>
    http.post('/exam/record/submit', null, { params: { record_id, answers: JSON.stringify(answers), duration } }),

  categories: () => http.get('/exam/category/list'),

  questions: (paperId: number) => http.get('/exam/question/list', { params: { paper_id: paperId } }),

  records: (params?: { page?: number; limit?: number; user_id?: string; paper_id?: number }) =>
    http.get('/exam/record/list', { params }),

  recordDetail: (rid: number) => http.get(`/exam/record/${rid}`),

  wrongList: (params?: { page?: number; limit?: number; is_mastered?: boolean }) =>
    http.get('/exam/wrong/list', { params }),

  markWrongMastered: (id: number) => http.put(`/exam/wrong/${id}/master`),

  removeWrong: (id: number) => http.delete(`/exam/wrong/${id}`),

  submit: (payload: { paper_id: number; answers: Record<string, any>; duration: number }) =>
    http.post('/exam/record/submit', null, { params: { paper_id: payload.paper_id, answers: JSON.stringify(payload.answers), duration: payload.duration } }),
}
