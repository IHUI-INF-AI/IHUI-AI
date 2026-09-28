// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Variable {
  id: string
  botId: string
  variableName: string
  variableValue: string | null
  description: string | null
  dataType: string | null
  createdAt?: string
  updatedAt?: string
}

export interface VariableForm {
  botId: string
  variableName: string
  variableValue: string
  description: string
  dataType: string
}
