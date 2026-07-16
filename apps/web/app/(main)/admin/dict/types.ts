export type ListClass = 'default' | 'primary' | 'success' | 'info' | 'warning' | 'danger'

export interface DictItem {
  id: string
  label: string
  value: string
  sort: number
  cssClass: string
  listClass: ListClass
  status: 0 | 1
  remark: string
  dictType: string
}

export interface DictType {
  id: string
  name: string
  code: string
  description: string
  itemCount: number
  items: DictItem[]
}

export interface TypeForm {
  name: string
  code: string
  description: string
}

export interface ItemForm {
  label: string
  value: string
  sort: number
  cssClass: string
  listClass: ListClass
  status: 0 | 1
  remark: string
  dictType: string
}
