export interface ApiLog {
  id: string
  time: string
  endpoint: string
  method: string
  statusCode: number
  latency: number
  ip: string
  user: string
}
