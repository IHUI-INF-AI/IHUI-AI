export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface HistoryItem {
  id: string
  method: Method
  url: string
  status: number
  time: string
}

export interface ResponseState {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  latency: number
}
