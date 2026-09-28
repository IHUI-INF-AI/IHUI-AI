// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
