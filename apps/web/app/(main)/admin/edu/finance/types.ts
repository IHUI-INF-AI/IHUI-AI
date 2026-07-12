export interface PayLog {
  id: string
  userUuid: string
  courseId?: string
  videoId?: string
  outBillOn?: string
  payWay?: string
  amount?: string
  realAmount?: string
  type?: number
  createdAt?: string
}

export interface CForm {
  userUuid: string
  courseId: string
  videoId: string
  outBillOn: string
  payWay: string
  amount: string
  realAmount: string
}
