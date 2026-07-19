export type LotteryStatus = 'draft' | 'active' | 'finished' | 'cancelled'

export interface LotteryPrize {
  id: string
  name: string
  level: 'first' | 'second' | 'third' | 'normal'
  total: number
  weight: number
  remaining: number
}

export interface Lottery {
  id: string
  name: string
  cover: string | null
  costPoints: number
  freeQuota: number
  prizes: LotteryPrize[]
  participants: number
  winners: number
  status: LotteryStatus
  startTime: string | null
  endTime: string | null
  createdAt: string | null
}

export interface LotteryListData {
  list: Lottery[]
  total: number
}
