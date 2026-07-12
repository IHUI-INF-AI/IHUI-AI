import type * as React from 'react'
import { Star, Coins, TrendingUp, Award } from 'lucide-react'

export interface Transaction {
  id: string
  type: 'earn' | 'spend' | 'sign_in' | 'invite' | 'admin'
  source: string
  amount: number
  balanceAfter: number
  description?: string
  createdAt: string
}
export interface LeaderboardUser {
  userId: string
  nickname: string
  avatar?: string
  points: number
  level: number
  isMe?: boolean
}
export interface PointsData {
  current: number
  totalEarned: number
  totalSpent: number
}
export interface LevelData {
  level: number
  name: string
  currentPoints: number
  nextLevelPoints?: number
  nextLevelName?: string
}

export const TX_ICON: Record<Transaction['type'], React.ComponentType<{ className?: string }>> = {
  earn: TrendingUp,
  spend: Coins,
  sign_in: Star,
  invite: Award,
  admin: Star,
}
