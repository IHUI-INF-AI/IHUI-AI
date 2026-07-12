export interface CoursePay {
  id: string
  courseId: string
  title?: string
  payType: number
  payCrowd: number
  amount: string
  creator?: string
  nickname?: string
}

export interface CForm {
  courseId: string
  payType: string
  payCrowd: string
  amount: string
}

export interface CoursePaySearch {
  payCrowd: string
  creator: string
}
