export interface Alert {
  id: string
  level: 'critical' | 'warning' | 'info'
  title: string
  message: string
  source: string
  status: 'active' | 'acknowledged' | 'resolved'
  createdAt: string
  resolvedAt: string | null
}

export interface AlertRule {
  id: string
  name: string
  metric: string
  threshold: number
  operator: '>' | '<' | '>=' | '<='
  enabled: boolean
}
