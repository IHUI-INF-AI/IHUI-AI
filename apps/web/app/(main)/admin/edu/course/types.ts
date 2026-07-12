export interface Course {
  id: string
  title: string
  subtitle?: string
  content?: string
  remark?: string
  remarkFile?: string
  binding?: string
  stage?: number
  label?: string
  auditStatus?: number
  creator?: string
  nickname?: string
}

export interface CForm {
  title: string
  subtitle: string
  content: string
  remark: string
  remarkFile: string
  binding: string
  stage: string
  label: string
  creator: string
}
