/**
 * Teacher 跨端共享类型
 *
 * 从 apps/miniapp-taro/src/api/index.ts 下沉,供 web/miniapp-taro/mobile-rn 等端复用。
 * 后端 GET /teacher/list 与 GET /teacher/:id 返回。
 */

export interface Teacher {
  id: string | number
  name: string
  avatar?: string
  title?: string
  intro?: string
  courses?: number
  students?: number
}

export type TeacherList = Teacher[]
