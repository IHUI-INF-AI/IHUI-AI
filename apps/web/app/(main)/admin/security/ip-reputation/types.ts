export interface IpReputation {
  score: number
  reasons: string[]
  source: 'cache' | 'live'
}

export interface BlockIpRequest {
  ip: string
  duration: number // 秒
  reason?: string
}

export interface BlockIpResponse {
  ip: string
  duration: number
  blocked: boolean
}

export interface UnblockIpResponse {
  ip: string
  blocked: false
}
