/**
 * 历史证书上传 mock 数据（后端未就绪前使用）
 */
import type { EduBaseResponse, EduPaginatedResponse } from '@/api/edu/index'
import type { UploadedCert, UploadedCertCreate, UploadedCertType } from '@/api/edu/uploaded-certs'

let nextId = 4
const mockCerts: UploadedCert[] = [
  {
    id: 1,
    user_id: 'mock-user',
    title: 'PMP 项目管理专业人士认证',
    issuer: 'Project Management Institute',
    issue_date: '2024-03-15',
    expiry_date: '2027-03-15',
    cert_type: 'certificate',
    file_url: 'https://file.aizhs.top/mock/pmp-cert.jpg',
    description: '通过 PMP 考试获得的项目管理专业认证。',
    create_time: '2024-03-20T10:00:00Z',
  },
  {
    id: 2,
    user_id: 'mock-user',
    title: '计算机软件水平考试 - 系统架构设计师',
    issuer: '工业和信息化部教育与考试中心',
    issue_date: '2023-11-30',
    cert_type: 'diploma',
    file_url: 'https://file.aizhs.top/mock/architect-diploma.pdf',
    description: '软考高级 - 系统架构设计师证书。',
    create_time: '2023-12-10T14:00:00Z',
  },
  {
    id: 3,
    user_id: 'mock-user',
    title: '大学英语六级成绩单',
    issuer: '教育部考试中心',
    issue_date: '2022-12-10',
    cert_type: 'transcript',
    file_url: 'https://file.aizhs.top/mock/cet6-transcript.jpg',
    create_time: '2022-12-20T09:00:00Z',
  },
]

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

export const uploadedCertsApiMock = {
  list: (params?: { page?: number; size?: number; cert_type?: UploadedCertType }) => {
    let items = [...mockCerts]
    if (params?.cert_type) {
      items = items.filter((c) => c.cert_type === params.cert_type)
    }
    items.sort((a, b) => b.issue_date.localeCompare(a.issue_date))
    const page = params?.page ?? 1
    const size = params?.size ?? 50
    const start = (page - 1) * size
    const paged = items.slice(start, start + size)
    const result: EduBaseResponse<EduPaginatedResponse<UploadedCert>> = {
      code: 0,
      data: { items: paged, total: items.length, page, size },
    }
    return delay(result)
  },

  create: (data: UploadedCertCreate) => {
    const cert: UploadedCert = {
      ...data,
      id: nextId++,
      user_id: 'mock-user',
      create_time: new Date().toISOString(),
    }
    mockCerts.unshift(cert)
    return delay({ code: 0, data: cert } as EduBaseResponse<UploadedCert>)
  },

  update: (id: number, data: Partial<UploadedCert>) => {
    const idx = mockCerts.findIndex((c) => c.id === id)
    if (idx >= 0) {
      mockCerts[idx] = { ...mockCerts[idx], ...data }
      return delay({ code: 0, data: mockCerts[idx] } as EduBaseResponse<UploadedCert>)
    }
    return delay({ code: 404, msg: '证书不存在' } as EduBaseResponse<UploadedCert>)
  },

  delete: (id: number) => {
    const idx = mockCerts.findIndex((c) => c.id === id)
    if (idx >= 0) {
      mockCerts.splice(idx, 1)
    }
    return delay({ code: 0, data: undefined } as EduBaseResponse<void>)
  },
}
