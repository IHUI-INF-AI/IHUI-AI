/**
 * 学习笔记 mock 数据（后端未就绪前使用）
 */
import type { EduBaseResponse, EduPaginatedResponse } from '@/api/edu/index'
import type { LearningNote, LearningNoteCreate } from '@/api/edu/notes'

let nextId = 4
const mockNotes: LearningNote[] = [
  {
    id: 1,
    user_id: 'mock-user',
    course_id: 1,
    section_id: 1,
    title: 'Vue3 响应式原理学习笔记',
    content: '## 响应式核心\n\nVue3 使用 Proxy 实现响应式，相比 Vue2 的 Object.defineProperty 有以下优势：\n\n- 能检测对象属性的新增/删除\n- 能检测数组索引/length 变化\n- 性能更好（惰性响应式）\n\n```js\nconst proxy = new Proxy(target, handler)\n```',
    attachments: [
      { url: 'https://file.aizhs.top/mock/vue3-proxy.png', name: 'proxy-diagram.png', type: 'image' },
    ],
    tags: ['Vue3', '响应式', 'Proxy'],
    is_public: true,
    create_time: '2026-06-25T10:30:00Z',
    update_time: '2026-06-25T10:30:00Z',
  },
  {
    id: 2,
    user_id: 'mock-user',
    course_id: 2,
    section_id: 3,
    title: 'TypeScript 高级类型总结',
    content: '## 条件类型\n\n```ts\ntype IsString<T> = T extends string ? true : false\n```\n\n## 映射类型\n\n```ts\ntype Readonly<T> = { readonly [P in keyof T]: T[P] }\n```',
    tags: ['TypeScript', '类型系统'],
    is_public: false,
    create_time: '2026-06-28T14:20:00Z',
    update_time: '2026-06-28T14:20:00Z',
  },
  {
    id: 3,
    user_id: 'mock-user',
    course_id: 1,
    title: 'Element Plus 表单校验最佳实践',
    content: '## 自定义校验规则\n\n```js\nconst validatePass = (rule, value, callback) => {\n  if (value === "") {\n    callback(new Error("请输入密码"))\n  } else {\n    callback()\n  }\n}\n```',
    tags: ['Element Plus', '表单', '校验'],
    is_public: true,
    create_time: '2026-06-30T09:15:00Z',
    update_time: '2026-06-30T09:15:00Z',
  },
]

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

export const notesApiMock = {
  list: (params?: { page?: number; size?: number; course_id?: number; keyword?: string }) => {
    let items = [...mockNotes]
    if (params?.course_id) {
      items = items.filter((n) => n.course_id === params.course_id)
    }
    if (params?.keyword) {
      const kw = params.keyword.toLowerCase()
      items = items.filter(
        (n) => n.title.toLowerCase().includes(kw) || n.content.toLowerCase().includes(kw)
      )
    }
    const page = params?.page ?? 1
    const size = params?.size ?? 10
    const start = (page - 1) * size
    const paged = items.slice(start, start + size)
    const result: EduBaseResponse<EduPaginatedResponse<LearningNote>> = {
      code: 0,
      data: { items: paged, total: items.length, page, size },
    }
    return delay(result)
  },

  create: (data: LearningNoteCreate) => {
    const now = new Date().toISOString()
    const note: LearningNote = {
      ...data,
      id: nextId++,
      user_id: 'mock-user',
      create_time: now,
      update_time: now,
    }
    mockNotes.unshift(note)
    return delay({ code: 0, data: note } as EduBaseResponse<LearningNote>)
  },

  update: (id: number, data: Partial<LearningNote>) => {
    const idx = mockNotes.findIndex((n) => n.id === id)
    if (idx >= 0) {
      mockNotes[idx] = { ...mockNotes[idx], ...data, update_time: new Date().toISOString() }
      return delay({ code: 0, data: mockNotes[idx] } as EduBaseResponse<LearningNote>)
    }
    return delay({ code: 404, msg: '笔记不存在' } as EduBaseResponse<LearningNote>)
  },

  delete: (id: number) => {
    const idx = mockNotes.findIndex((n) => n.id === id)
    if (idx >= 0) {
      mockNotes.splice(idx, 1)
    }
    return delay({ code: 0, data: undefined } as EduBaseResponse<void>)
  },
}
