// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
