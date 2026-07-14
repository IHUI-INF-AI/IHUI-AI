export interface Certificate {
  id: string
  certificateNo: string
  title: string
  recipientName: string | null
  nickname: string | null
  source: string | null
  issuedAt: string | null
  status: number
  templateName: string | null
}

export interface Template {
  id: string
  name: string
}

export interface CForm {
  userId: string
  title: string
  recipientName: string
  source: string
  templateId: string
  issuedAt: string
}
