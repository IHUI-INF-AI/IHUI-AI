export interface OfflineRecord {
  id: string
  type: string
  title: string
  description: string | null
  hours: number | null
  occurredAt: string | null
}

export interface RecordForm {
  type: string
  title: string
  description: string
  hours: string
  occurredAt: string
}
