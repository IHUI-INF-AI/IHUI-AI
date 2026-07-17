/**
 * InterjectionBuffer — mid-turn interjection buffer + formatting。
 * 灵感来源:grok-build `xai-interjection-core`(EventQueue + drain_formatted + format_interjection)。
 * TS 重写并扩展:支持优先级(low/normal/high/critical)、maxSize 上限剔除最老、maxAgeMs 过期自动清除。
 */

export type InterjectionPriority = 'low' | 'normal' | 'high' | 'critical'

export interface Interjection {
  id: string
  content: string
  priority: InterjectionPriority
  timestamp: number
  consumed: boolean
}

export interface InterjectionBufferOptions {
  maxSize: number
  maxAgeMs: number
}

const DEFAULT_OPTIONS: InterjectionBufferOptions = {
  maxSize: 10,
  maxAgeMs: 5 * 60 * 1000,
}

const PRIORITY_ORDER: Record<InterjectionPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
}

let idCounter = 0
function generateId(): string {
  idCounter += 1
  return `ij_${idCounter.toString(36)}_${Date.now().toString(36)}`
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export class InterjectionBuffer {
  private items: Interjection[] = []
  private readonly options: InterjectionBufferOptions

  constructor(options?: Partial<InterjectionBufferOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  push(content: string, priority: InterjectionPriority = 'normal'): string {
    this.pruneExpired()
    const id = generateId()
    this.items.push({
      id,
      content,
      priority,
      timestamp: Date.now(),
      consumed: false,
    })
    this.enforceMaxSize()
    return id
  }

  pop(): Interjection | null {
    this.pruneExpired()
    const idx = this.findTopIndex()
    if (idx === -1) return null
    const target = this.items[idx]!
    target.consumed = true
    return { ...target }
  }

  peek(): Interjection | null {
    this.pruneExpired()
    const idx = this.findTopIndex()
    if (idx === -1) return null
    return { ...this.items[idx]! }
  }

  formatForLLM(): string {
    this.pruneExpired()
    const pending = this.items.filter((i) => !i.consumed)
    if (pending.length === 0) return ''
    const sorted = this.sortByPriority(pending)
    const lines = sorted.map((item, idx) => {
      const time = formatTimestamp(item.timestamp)
      return `${idx + 1}. [${item.priority}] ${time} — "${item.content}"`
    })
    return `[用户中途插入指令]\n${lines.join('\n')}\n[/用户中途插入指令]`
  }

  clear(): void {
    this.items = []
  }

  size(): number {
    this.pruneExpired()
    return this.items.filter((i) => !i.consumed).length
  }

  hasPending(): boolean {
    this.pruneExpired()
    return this.items.some((i) => !i.consumed)
  }

  private findTopIndex(): number {
    let topIdx = -1
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i]!
      if (item.consumed) continue
      if (topIdx === -1) {
        topIdx = i
        continue
      }
      const top = this.items[topIdx]!
      const p = PRIORITY_ORDER[item.priority] - PRIORITY_ORDER[top.priority]
      if (p < 0 || (p === 0 && item.timestamp < top.timestamp)) {
        topIdx = i
      }
    }
    return topIdx
  }

  private sortByPriority(arr: Interjection[]): Interjection[] {
    return [...arr].sort((a, b) => {
      const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (p !== 0) return p
      return a.timestamp - b.timestamp
    })
  }

  private pruneExpired(): void {
    if (this.options.maxAgeMs <= 0) return
    const now = Date.now()
    this.items = this.items.filter((i) => now - i.timestamp <= this.options.maxAgeMs)
  }

  private enforceMaxSize(): void {
    const max = this.options.maxSize
    if (max <= 0) return
    while (this.items.length > max) {
      const consumedIdx = this.items.findIndex((i) => i.consumed)
      if (consumedIdx >= 0) {
        this.items.splice(consumedIdx, 1)
      } else {
        let oldestIdx = 0
        for (let i = 1; i < this.items.length; i++) {
          if (this.items[i]!.timestamp < this.items[oldestIdx]!.timestamp) {
            oldestIdx = i
          }
        }
        this.items.splice(oldestIdx, 1)
      }
    }
  }
}
