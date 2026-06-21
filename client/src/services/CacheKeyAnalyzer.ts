export interface KeyInfo {
  key: string
  type: 'string' | 'hash' | 'list' | 'set' | 'zset' | 'unknown'
  size: number
  ttl: number
  encoding: string
  accessCount: number
  lastAccess: number | null
  hitRate: number
}

export interface KeyPattern {
  pattern: string
  count: number
  totalSize: number
  avgTTL: number
  sampleKeys: string[]
}

export interface HotKey {
  key: string
  accessCount: number
  accessRate: number
  size: number
  trend: 'increasing' | 'stable' | 'decreasing'
}

export interface KeySpaceAnalysis {
  totalKeys: number
  totalMemory: number
  keyPatterns: KeyPattern[]
  typeDistribution: Record<string, number>
  ttlDistribution: {
    noExpiry: number
    lessThan1h: number
    lessThan1d: number
    lessThan7d: number
    moreThan7d: number
  }
  sizeDistribution: {
    lessThan1KB: number
    lessThan10KB: number
    lessThan100KB: number
    lessThan1MB: number
    moreThan1MB: number
  }
}

export interface KeyAnalysisResult {
  timestamp: number
  keySpace: KeySpaceAnalysis
  hotKeys: HotKey[]
  coldKeys: KeyInfo[]
  recommendations: KeyRecommendation[]
}

export interface KeyRecommendation {
  type: 'expire' | 'delete' | 'optimize' | 'split'
  severity: 'info' | 'warning' | 'critical'
  keys: string[]
  reason: string
  action: string
}

type AnalysisEventHandler = (result: KeyAnalysisResult) => void

class CacheKeyAnalyzer {
  private keys: Map<string, KeyInfo> = new Map()
  private analysisHistory: KeyAnalysisResult[] = []
  private eventHandlers: Set<AnalysisEventHandler> = new Set()
  private maxHistorySize = 100

  async analyzeKeys(keys: string[]): Promise<KeyAnalysisResult> {
    const keyInfos = await this.fetchKeyInfos(keys)
    keyInfos.forEach(info => this.keys.set(info.key, info))

    const keySpace = this.analyzeKeySpace()
    const hotKeys = this.findHotKeys()
    const coldKeys = this.findColdKeys()
    const recommendations = this.generateRecommendations(keySpace, hotKeys, coldKeys)

    const result: KeyAnalysisResult = {
      timestamp: Date.now(),
      keySpace,
      hotKeys,
      coldKeys,
      recommendations
    }

    this.analysisHistory.push(result)
    if (this.analysisHistory.length > this.maxHistorySize) {
      this.analysisHistory.shift()
    }

    this.eventHandlers.forEach(handler => handler(result))
    return result
  }

  private async fetchKeyInfos(keys: string[]): Promise<KeyInfo[]> {
    return keys.map(key => ({
      key,
      type: this.randomType() as KeyInfo['type'],
      size: Math.floor(Math.random() * 10000),
      ttl: Math.floor(Math.random() * 86400 * 7),
      encoding: 'raw',
      accessCount: Math.floor(Math.random() * 1000),
      lastAccess: Date.now() - Math.floor(Math.random() * 86400000),
      hitRate: Math.random() * 100
    }))
  }

  private randomType(): string {
    const types = ['string', 'hash', 'list', 'set', 'zset']
    return types[Math.floor(Math.random() * types.length)]
  }

  private analyzeKeySpace(): KeySpaceAnalysis {
    const keys = Array.from(this.keys.values())
    const patterns = this.groupByPattern(keys)
    const typeDistribution: Record<string, number> = {}
    keys.forEach(k => {
      typeDistribution[k.type] = (typeDistribution[k.type] || 0) + 1
    })

    const ttlDistribution = {
      noExpiry: keys.filter(k => k.ttl === -1).length,
      lessThan1h: keys.filter(k => k.ttl > 0 && k.ttl < 3600).length,
      lessThan1d: keys.filter(k => k.ttl >= 3600 && k.ttl < 86400).length,
      lessThan7d: keys.filter(k => k.ttl >= 86400 && k.ttl < 604800).length,
      moreThan7d: keys.filter(k => k.ttl >= 604800).length
    }

    const sizeDistribution = {
      lessThan1KB: keys.filter(k => k.size < 1024).length,
      lessThan10KB: keys.filter(k => k.size >= 1024 && k.size < 10240).length,
      lessThan100KB: keys.filter(k => k.size >= 10240 && k.size < 102400).length,
      lessThan1MB: keys.filter(k => k.size >= 102400 && k.size < 1048576).length,
      moreThan1MB: keys.filter(k => k.size >= 1048576).length
    }

    return {
      totalKeys: keys.length,
      totalMemory: keys.reduce((sum, k) => sum + k.size, 0),
      keyPatterns: patterns,
      typeDistribution,
      ttlDistribution,
      sizeDistribution
    }
  }

  private groupByPattern(keys: KeyInfo[]): KeyPattern[] {
    const patternMap = new Map<string, KeyPattern>()
    keys.forEach(key => {
      const pattern = this.extractPattern(key.key)
      const existing = patternMap.get(pattern)
      if (existing) {
        existing.count++
        existing.totalSize += key.size
        existing.avgTTL = (existing.avgTTL + key.ttl) / 2
        if (existing.sampleKeys.length < 5) {
          existing.sampleKeys.push(key.key)
        }
      } else {
        patternMap.set(pattern, {
          pattern,
          count: 1,
          totalSize: key.size,
          avgTTL: key.ttl,
          sampleKeys: [key.key]
        })
      }
    })
    return Array.from(patternMap.values()).sort((a, b) => b.count - a.count)
  }

  private extractPattern(key: string): string {
    const parts = key.split(':')
    return parts.map(p => /^\d+$/.test(p) ? '*' : p).join(':')
  }

  private findHotKeys(): HotKey[] {
    const keys = Array.from(this.keys.values())
    return keys
      .filter(k => k.accessCount > 100)
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 20)
      .map(k => ({
        key: k.key,
        accessCount: k.accessCount,
        accessRate: k.accessCount / 86400,
        size: k.size,
        trend: Math.random() > 0.5 ? 'increasing' : Math.random() > 0.5 ? 'stable' : 'decreasing'
      }))
  }

  private findColdKeys(): KeyInfo[] {
    const keys = Array.from(this.keys.values())
    const oneDayAgo = Date.now() - 86400000
    return keys
      .filter(k => (k.lastAccess || 0) < oneDayAgo && k.accessCount < 10)
      .sort((a, b) => a.accessCount - b.accessCount)
      .slice(0, 20)
  }

  private generateRecommendations(keySpace: KeySpaceAnalysis, hotKeys: HotKey[], coldKeys: KeyInfo[]): KeyRecommendation[] {
    const recommendations: KeyRecommendation[] = []

    if (keySpace.ttlDistribution.noExpiry > keySpace.totalKeys * 0.3) {
      recommendations.push({
        type: 'expire',
        severity: 'warning',
        keys: [],
        reason: '超过30%的键没有设置过期时间',
        action: '建议为这些键设置合理的过期时间'
      })
    }

    if (coldKeys.length > 0) {
      recommendations.push({
        type: 'delete',
        severity: 'info',
        keys: coldKeys.slice(0, 10).map(k => k.key),
        reason: '发现长时间未访问的冷键',
        action: '建议清理这些冷键以释放内存'
      })
    }

    const largeKeys = Array.from(this.keys.values()).filter(k => k.size > 1048576)
    if (largeKeys.length > 0) {
      recommendations.push({
        type: 'split',
        severity: 'warning',
        keys: largeKeys.slice(0, 5).map(k => k.key),
        reason: '发现大键可能影响性能',
        action: '建议拆分大键或使用更合适的数据结构'
      })
    }

    return recommendations
  }

  getKeyInfo(key: string): KeyInfo | undefined {
    return this.keys.get(key)
  }

  getAnalysisHistory(): KeyAnalysisResult[] {
    return [...this.analysisHistory]
  }

  getLatestAnalysis(): KeyAnalysisResult | null {
    return this.analysisHistory[this.analysisHistory.length - 1] || null
  }

  subscribe(handler: AnalysisEventHandler): () => void {
    this.eventHandlers.add(handler)
    return () => this.eventHandlers.delete(handler)
  }

  clearCache(): void {
    this.keys.clear()
  }

  clearHistory(): void {
    this.analysisHistory = []
  }
}

export const cacheKeyAnalyzer = new CacheKeyAnalyzer()
