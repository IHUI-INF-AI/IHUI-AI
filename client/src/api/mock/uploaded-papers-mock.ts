/**
 * 考试试卷上传 mock 数据（后端未就绪前使用，PR-E E1）
 */
import type { EduBaseResponse, EduPaginatedResponse } from '@/api/edu/index'
import type {
  UploadedPaper,
  UploadedPaperCreate,
  PaperType,
  PaperSubject,
} from '@/api/edu/uploaded-papers'

let nextId = 4
const mockPapers: UploadedPaper[] = [
  {
    id: 1,
    user_id: 'mock-user',
    title: '2024 春学期高等数学期中考试',
    paper_type: 'midterm',
    subject: 'math',
    exam_date: '2024-04-15',
    score: 88,
    full_score: 100,
    file_url: 'https://file.aizhs.top/mock/math-midterm-2024.pdf',
    description: '期中考试试卷，覆盖微积分与线性代数基础。',
    create_time: '2024-04-20T10:00:00Z',
  },
  {
    id: 2,
    user_id: 'mock-user',
    title: '2024 春学期英语期末考试',
    paper_type: 'final',
    subject: 'english',
    exam_date: '2024-06-20',
    score: 92,
    full_score: 100,
    file_url: 'https://file.aizhs.top/mock/english-final-2024.pdf',
    description: '期末考试试卷，含听力、阅读、写作三部分。',
    create_time: '2024-06-25T14:00:00Z',
  },
  {
    id: 3,
    user_id: 'mock-user',
    title: '2024 物理单元测试 - 力学',
    paper_type: 'unit_test',
    subject: 'physics',
    exam_date: '2024-05-10',
    score: 75,
    full_score: 100,
    file_url: 'https://file.aizhs.top/mock/physics-unit-mechanics.jpg',
    description: '力学单元测试试卷，错题主要集中在动力学部分。',
    create_time: '2024-05-15T09:00:00Z',
  },
]

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

export const uploadedPapersApiMock = {
  list: (params?: {
    page?: number
    size?: number
    paper_type?: PaperType
    subject?: PaperSubject
  }) => {
    let items = [...mockPapers]
    if (params?.paper_type) {
      items = items.filter((p) => p.paper_type === params.paper_type)
    }
    if (params?.subject) {
      items = items.filter((p) => p.subject === params.subject)
    }
    items.sort((a, b) => b.exam_date.localeCompare(a.exam_date))
    const page = params?.page ?? 1
    const size = params?.size ?? 50
    const start = (page - 1) * size
    const paged = items.slice(start, start + size)
    const result: EduBaseResponse<EduPaginatedResponse<UploadedPaper>> = {
      code: 0,
      data: { items: paged, total: items.length, page, size },
    }
    return delay(result)
  },

  create: (data: UploadedPaperCreate) => {
    const paper: UploadedPaper = {
      ...data,
      id: nextId++,
      user_id: 'mock-user',
      create_time: new Date().toISOString(),
    }
    mockPapers.unshift(paper)
    return delay({ code: 0, data: paper } as EduBaseResponse<UploadedPaper>)
  },

  update: (id: number, data: Partial<UploadedPaper>) => {
    const idx = mockPapers.findIndex((p) => p.id === id)
    if (idx >= 0) {
      mockPapers[idx] = { ...mockPapers[idx], ...data }
      return delay({ code: 0, data: mockPapers[idx] } as EduBaseResponse<UploadedPaper>)
    }
    return delay({ code: 404, msg: '试卷不存在' } as EduBaseResponse<UploadedPaper>)
  },

  delete: (id: number) => {
    const idx = mockPapers.findIndex((p) => p.id === id)
    if (idx >= 0) {
      mockPapers.splice(idx, 1)
    }
    return delay({ code: 0, data: undefined } as EduBaseResponse<void>)
  },
}
