export interface ZhsAgent {
  id: string
  name: string | null
  consume: string | null
  image: string | null
  url: string | null
  info: string | null
  remark: string | null
  seqencing: number | null
  price: string | null
  type: string | null
  typeName: string | null
  isHidden: number | null
  heat: string | null
  field1: string | null
}

export interface ListData {
  list: ZhsAgent[]
  total: number
}

export interface ZhsAgentForm {
  name: string
  consume: string
  image: string
  url: string
  info: string
  remark: string
  seqencing: string
  price: string
  heat: string
  field1: string
}
