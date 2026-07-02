/**
 * 线下学习记录 mock 数据（后端未就绪前使用）
 */
import type { EduBaseResponse, EduPaginatedResponse } from '@/api/edu/index'
import type { OfflineRecord, OfflineRecordCreate, OfflineActivityType } from '@/api/edu/offline-records'

let nextId = 5
const mockRecords: OfflineRecord[] = [
  {
    id: 1,
    user_id: 'mock-user',
    record_date: '2026-06-28',
    duration_minutes: 120,
    activity_type: 'training',
    title: '前端架构师线下培训',
    description: '参加公司组织的前端架构升级培训，主要内容为微前端方案对比。',
    proof_url: 'https://file.aizhs.top/mock/training-proof.jpg',
    create_time: '2026-06-28T18:00:00Z',
  },
  {
    id: 2,
    user_id: 'mock-user',
    record_date: '2026-06-29',
    duration_minutes: 90,
    activity_type: 'self_study',
    title: '阅读《重构：改善既有代码的设计》',
    description: '学习第 6-8 章，关于长函数和重构手法。',
    create_time: '2026-06-29T22:00:00Z',
  },
  {
    id: 3,
    user_id: 'mock-user',
    record_date: '2026-06-30',
    duration_minutes: 60,
    activity_type: 'practice',
    title: 'Vue3 Composition API 实战练习',
    description: '完成 3 个 composables 的编写和测试。',
    create_time: '2026-06-30T20:00:00Z',
  },
  {
    id: 4,
    user_id: 'mock-user',
    record_date: '2026-07-01',
    duration_minutes: 45,
    activity_type: 'reading',
    title: 'TypeScript 5.0 新特性阅读',
    create_time: '2026-07-01T21:00:00Z',
  },
]

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

export const offlineRecordsApiMock = {
  list: (params?: { page?: number; size?: number; start_date?: string; end_date?: string; activity_type?: OfflineActivityType }) => {
    let items = [...mockRecords]
    if (params?.activity_type) {
      items = items.filter((r) => r.activity_type === params.activity_type)
    }
    if (params?.start_date) {
      items = items.filter((r) => r.record_date >= params.start_date!)
    }
    if (params?.end_date) {
      items = items.filter((r) => r.record_date <= params.end_date!)
    }
    items.sort((a, b) => b.record_date.localeCompare(a.record_date))
    const page = params?.page ?? 1
    const size = params?.size ?? 50
    const start = (page - 1) * size
    const paged = items.slice(start, start + size)
    const result: EduBaseResponse<EduPaginatedResponse<OfflineRecord>> = {
      code: 0,
      data: { items: paged, total: items.length, page, size },
    }
    return delay(result)
  },

  create: (data: OfflineRecordCreate) => {
    const record: OfflineRecord = {
      ...data,
      id: nextId++,
      user_id: 'mock-user',
      create_time: new Date().toISOString(),
    }
    mockRecords.push(record)
    return delay({ code: 0, data: record } as EduBaseResponse<OfflineRecord>)
  },

  update: (id: number, data: Partial<OfflineRecord>) => {
    const idx = mockRecords.findIndex((r) => r.id === id)
    if (idx >= 0) {
      mockRecords[idx] = { ...mockRecords[idx], ...data }
      return delay({ code: 0, data: mockRecords[idx] } as EduBaseResponse<OfflineRecord>)
    }
    return delay({ code: 404, msg: '记录不存在' } as EduBaseResponse<OfflineRecord>)
  },

  delete: (id: number) => {
    const idx = mockRecords.findIndex((r) => r.id === id)
    if (idx >= 0) {
      mockRecords.splice(idx, 1)
    }
    return delay({ code: 0, data: undefined } as EduBaseResponse<void>)
  },
}
