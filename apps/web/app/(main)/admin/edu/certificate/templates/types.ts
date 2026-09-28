// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Template {
  id: string
  name: string
  description: string | null
  awardingOrganization: string | null
  awarderName: string | null
  awardConditions: string | null
  validityPolicy: string | null
  backgroundImage: string | null
  templateConfig: Record<string, unknown> | null
  status: number
  createdAt: string
}

export interface TForm {
  name: string
  description: string
  awardingOrganization: string
  awarderName: string
  awardConditions: string
  validityPolicy: string
  validDays: string
  validFrom: string
  validTo: string
  backgroundImage: string
  templateConfig: string
  status: boolean
}
