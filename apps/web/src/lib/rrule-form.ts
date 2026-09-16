// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rrule 计划表单互转(2026-09-17 立,与后端 MVP 子集一致:
 * FREQ=HOURLY/DAILY/WEEKLY + BYHOUR/BYMINUTE/BYDAY)。
 * automations 与 patrol 表单弹窗共用,避免两端各写一份拼装逻辑。
 */

export type RruleFrequency = 'hourly' | 'daily' | 'weekly'

/** 表单态的频率部件(与 rrule 无关的纯 UI 表示) */
export interface RruleFormParts {
  frequency: RruleFrequency
  /** HH:MM(仅 daily/weekly 生效) */
  time: string
  /** MO/TU/... (仅 weekly 生效) */
  days: string[]
}

export const DEFAULT_RRULE_PARTS: RruleFormParts = {
  frequency: 'daily',
  time: '09:00',
  days: ['MO', 'TU', 'WE', 'TH', 'FR'],
}

/** 把 UI 表单态拼成 MVP rrule */
export function buildRruleFromParts(parts: RruleFormParts): string {
  const [h, m] = parts.time.split(':')
  const byHour = String(Number(h ?? '0'))
  const byMinute = String(Number(m ?? '0'))
  if (parts.frequency === 'hourly') return 'FREQ=HOURLY'
  if (parts.frequency === 'daily') return `FREQ=DAILY;BYHOUR=${byHour};BYMINUTE=${byMinute}`
  return `FREQ=WEEKLY;BYDAY=${parts.days.join(',')};BYHOUR=${byHour};BYMINUTE=${byMinute}`
}

/** 把 rrule 拆解回 UI 表单态;解析失败返回 null(调用方回默认值) */
export function rruleToParts(rrule: string | null): RruleFormParts | null {
  if (!rrule) return null
  const kv: Record<string, string> = {}
  for (const seg of rrule.split(';')) {
    const idx = seg.indexOf('=')
    if (idx > 0) kv[seg.slice(0, idx).trim().toUpperCase()] = seg.slice(idx + 1).trim()
  }
  const freq = kv.FREQ?.toUpperCase()
  const time =
    kv.BYHOUR !== undefined || kv.BYMINUTE !== undefined
      ? `${String(Number(kv.BYHOUR ?? '0')).padStart(2, '0')}:${String(
          Number(kv.BYMINUTE ?? '0'),
        ).padStart(2, '0')}`
      : DEFAULT_RRULE_PARTS.time
  if (freq === 'HOURLY') return { frequency: 'hourly', time, days: DEFAULT_RRULE_PARTS.days }
  if (freq === 'DAILY') return { frequency: 'daily', time, days: DEFAULT_RRULE_PARTS.days }
  if (freq === 'WEEKLY' && kv.BYDAY) {
    return {
      frequency: 'weekly',
      time,
      days: kv.BYDAY.split(',').map((d) => d.trim().toUpperCase()),
    }
  }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
