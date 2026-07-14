export interface Schedule {
  id: string
  classId: string
  className: string | null
  title: string
  teacherName: string | null
  startTime: string
  endTime: string
  location: string | null
  status: string
}

export interface SForm {
  classId: string
  title: string
  teacherName: string
  startTime: string
  endTime: string
  location: string
}
