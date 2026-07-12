export interface Certificate {
  id: string
  name: string
  issuedAt: string
  status: number
  certificateNo?: string
  templateName?: string
  nickname?: string
}

export interface CertsData {
  list: Certificate[]
  total: number
}
