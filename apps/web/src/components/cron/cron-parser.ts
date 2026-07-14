export interface ParsedCron {
  minute: number[]
  hour: number[]
  day: number[]
  month: number[]
  weekday: number[]
  dayWildcard: boolean
  weekdayWildcard: boolean
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function range(min: number, max: number, step = 1): number[] {
  const out: number[] = []
  for (let i = min; i <= max; i += step) out.push(i)
  return out
}

function parseField(field: string, min: number, max: number): number[] {
  if (field === '*' || field === '') return range(min, max)
  const out: number[] = []
  for (const part of field.split(',')) {
    let base = part
    let step = 1
    const slashIdx = part.indexOf('/')
    if (slashIdx >= 0) {
      base = part.slice(0, slashIdx)
      const s = parseInt(part.slice(slashIdx + 1), 10)
      if (!s || s < 1) return []
      step = s
    }
    if (base === '*') {
      out.push(...range(min, max, step))
    } else if (base.includes('-')) {
      const segs = base.split('-')
      const a = parseInt(segs[0] ?? '', 10)
      const b = parseInt(segs[1] ?? '', 10)
      if (Number.isNaN(a) || Number.isNaN(b) || a > b || a < min || b > max) return []
      out.push(...range(a, b, step))
    } else {
      let n = Number(base)
      if (Number.isNaN(n) || n < min || n > max) {
        if (min === 0 && max === 6 && n === 7) n = 0
        else return []
      }
      if (step === 1) out.push(n)
      else for (let i = n; i <= max; i += step) out.push(i)
    }
  }
  return [...new Set(out)].sort((a, b) => a - b)
}

export function parseCron(expr: string): ParsedCron | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const df = parts[2] ?? ''
  const wf = parts[4] ?? ''
  const minute = parseField(parts[0] ?? '', 0, 59)
  const hour = parseField(parts[1] ?? '', 0, 23)
  const day = parseField(df, 1, 31)
  const month = parseField(parts[3] ?? '', 1, 12)
  const weekday = parseField(wf, 0, 6)
  if (!minute.length || !hour.length || !day.length || !month.length || !weekday.length) return null
  return {
    minute,
    hour,
    day,
    month,
    weekday,
    dayWildcard: df === '*' || df === '',
    weekdayWildcard: wf === '*' || wf === '',
  }
}

function matches(d: Date, c: ParsedCron): boolean {
  if (!c.minute.includes(d.getMinutes())) return false
  if (!c.hour.includes(d.getHours())) return false
  if (!c.month.includes(d.getMonth() + 1)) return false
  const dom = c.day.includes(d.getDate())
  const dow = c.weekday.includes(d.getDay())
  if (c.dayWildcard && c.weekdayWildcard) return true
  if (c.dayWildcard) return dow
  if (c.weekdayWildcard) return dom
  return dom || dow
}

export function getNextRuns(expr: string, count = 5): Date[] {
  const c = parseCron(expr)
  if (!c) return []
  const res: Date[] = []
  const cur = new Date()
  cur.setSeconds(0, 0)
  cur.setMinutes(cur.getMinutes() + 1)
  const maxIter = 532000
  let iter = 0
  while (res.length < count && iter < maxIter) {
    if (matches(cur, c)) res.push(new Date(cur))
    cur.setTime(cur.getTime() + 60000)
    iter++
  }
  return res
}

export function describeCron(expr: string): string {
  const c = parseCron(expr)
  if (!c) return '无效表达式'
  const parts = expr.trim().split(/\s+/)
  const df = parts[2] ?? '*'
  const mof = parts[3] ?? '*'
  const wf = parts[4] ?? '*'
  const m = c.minute
  const h = c.hour
  const time =
    m.length === 1 && h.length === 1 && m[0] === 0
      ? `${h[0]} 点`
      : m.length === 1 && h.length === 1
        ? `${h[0]}:${String(m[0]).padStart(2, '0')}`
        : `${parts[1]}:${parts[0]}`
  if (df === '*' && wf === '*' && mof === '*') return `每天 ${time} 执行`
  if (wf !== '*' && df === '*' && mof === '*') {
    if (wf.includes('-')) {
      const segs = wf.split('-')
      const a = parseInt(segs[0] ?? '', 10)
      const b = parseInt(segs[1] ?? '', 10)
      return `每周${WEEKDAYS[a] ?? a}至周${WEEKDAYS[b] ?? b} ${time} 执行`
    }
    if (c.weekday.length === 1) {
      const w = c.weekday[0] ?? 0
      return `每周${WEEKDAYS[w] ?? w} ${time} 执行`
    }
    return `每周${c.weekday.map((w) => WEEKDAYS[w] ?? w).join('、')} ${time} 执行`
  }
  if (df !== '*' && wf === '*' && mof === '*') return `每月 ${c.day.join('、')} 日 ${time} 执行`
  if (mof !== '*' && df === '*' && wf === '*') return `每年 ${c.month.join('、')} 月 ${time} 执行`
  return `按 ${expr} 执行`
}
