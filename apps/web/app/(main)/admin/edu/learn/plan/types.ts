export interface Plan {
  id: string
  userId: string
  userName: string | null
  title: string
  startDate: string
  endDate: string
  targetHours: number
  status: string
}

export interface PForm {
  title: string
  userId: string
  startDate: string
  endDate: string
  targetHours: string
  status: string
}
