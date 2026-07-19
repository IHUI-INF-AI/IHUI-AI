export interface RedisOverview {
  totalKeys: number
  usedMemory: number
  maxMemory: number
  hitRate: number
  missRate: number
  hits: number
  misses: number
  evictions: number
  connectedClients: number
  uptime: number
  opsPerSec: number
}

export interface RedisKey {
  key: string
  type: 'string' | 'list' | 'hash' | 'set' | 'zset' | 'stream'
  size: number
  ttl: number
  hits: number
  lastAccess: string | null
}

export interface RedisByPrefix {
  prefix: string
  count: number
  size: number
}

export interface RedisMonitorResponse {
  overview: RedisOverview
  topKeys: RedisKey[]
  byPrefix: RedisByPrefix[]
}
