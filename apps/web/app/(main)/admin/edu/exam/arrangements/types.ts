export interface Paper {
  id: string
  title: string
}

export interface Arrangement {
  id: string
  paperId: string
  paperTitle?: string
  startTime: string
  endTime: string
  room: string
  invigilator: string
  status: string
}

export interface AForm {
  paperId: string
  startTime: string
  endTime: string
  room: string
  invigilator: string
  status: string
}
