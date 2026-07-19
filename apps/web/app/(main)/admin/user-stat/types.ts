export interface UserGrowthPoint {
  date: string
  newUsers: number
  activeUsers: number
  retained: number
}

export interface UserRoleStat {
  role: string
  count: number
}

export interface UserStatOverview {
  totalUsers: number
  todayNew: number
  weekNew: number
  monthNew: number
  dau: number
  mau: number
  retention7d: number
  retention30d: number
}

export interface UserStatResponse {
  overview: UserStatOverview
  growth: UserGrowthPoint[]
  byRole: UserRoleStat[]
  byRegion: { region: string; count: number }[]
}
