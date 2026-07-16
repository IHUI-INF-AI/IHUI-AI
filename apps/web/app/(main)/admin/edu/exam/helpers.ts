import type { PaperForm } from './types'

export const EMPTY: PaperForm = {
  title: '',
  description: '',
  totalScore: '100',
  passScore: '60',
  duration: '60',
  isPublished: false,
  isRandom: false,
  status: true,
  cidList: [],
  questionIdList: [],
  questionDisordered: false,
  optionDisordered: false,
  difficulty: 2,
  paperType: 'normal',
}

export const PAGE_SIZE = 10
export const API = '/api/admin/exam/papers'
