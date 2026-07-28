/**
 * Study 学习记录跨端共享类型
 *
 * 从 apps/miniapp-taro/src/api/index.ts 下沉,供 web/miniapp-taro/mobile-rn 等端复用。
 * 后端 GET /study/records 返回的学习记录列表项。
 */

export interface StudyRecord {
  id: string
  courseId: string
  courseTitle: string
  progress: number
  duration: number
  time: string
}

export type StudyRecordList = StudyRecord[]
