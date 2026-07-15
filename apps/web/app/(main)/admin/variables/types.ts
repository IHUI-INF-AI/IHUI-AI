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
