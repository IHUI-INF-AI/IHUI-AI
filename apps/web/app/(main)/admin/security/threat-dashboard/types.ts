export interface WatchedIp {
  ip: string
  score: number
  reasons: string[]
  lastSeen: number
}

export interface RecentBlock {
  ip: string
  score: number
  duration: string
  timestamp: number
}

export interface ThreatDashboardData {
  totalChecks: number
  totalAutoBlocks: number
  totalWarnings: number
  watchedIps: WatchedIp[]
  recentBlocks: RecentBlock[]
}
