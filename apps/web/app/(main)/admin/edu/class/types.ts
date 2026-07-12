export interface ClassGroup {
  id: string
  name: string
  courseId: string | null
  courseName: string | null
  teacherName: string | null
  studentCount: number
  startDate: string
  endDate: string
  status: string
}

export interface CForm {
  name: string
  courseId: string
  teacherName: string
  startDate: string
  endDate: string
  status: string
}
