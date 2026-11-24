// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-1018245(2026-10-05,用户拍板路 B):折叠终态四档的判据与五语言词表防漂移闸。
//
// 本族三道锁,缺一不可(缺哪一道都会漏掉一种失效形态):
//   ① 键表键集 ≡ `COLLAPSED_TERMINATIONS`(不多不少)——防"加了成员忘了补键表":
//      端上 `TERMINATION_LABEL_KEYS[termination]` 会求值为 undefined,徽章处 `t(undefined)`
//      把 "undefined" 当文案渲染出来,且**不报错**。
//   ② 五语言 × 逐键必须解析得到非空文案、且**不等于键名**(回显形态也算没取到词)
//      —— 防"键写了但某语言漏一条";端上表现是徽章直接回显 `agents.kanban.terminatedFailed`。
//   ③ **四档的键逐字互不相同**——这是本票的靶心:09-28 把 `failed` 排除出册的理由是
//      「把真失败说成被取消,比不标更糟」,拍板路 B 让它入册但该理由仍然成立,
//      所以 `failed` 必须有自己的键。图省事把 `failed` 指到 `terminatedCancelled`
//      会同时过 ①②(键能解析、值非空、只是文案撞了),只有 ③ 能抓到。
//      ⇒ ①②是"有没有词",③ 是"说的是不是同一件事",不能互相替代。
//
// 刻意**不**断言具体译文字面值(文案可改,而"每语言都有值、值不等于键名、四键互不相同"不可改)。
// 本文件同时是 §22c 反向锁:末尾的构造面用例证明 ①②③ 都对"缺一条/撞一条"有牙,
// 而不靠仓库瞬时状态自证。

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  AGENT_TASK_STATUSES,
  ALLOWED_TRANSITIONS,
  COLLAPSED_TERMINATIONS,
  LEGACY_STATUS_MAP,
  TERMINATION_LABEL_KEYS,
  terminationOf,
} from '../src/agent-runtime'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..')
const MESSAGES_DIR = join(REPO_ROOT, 'packages', 'i18n', 'messages', 'web')

/** 五语言与 `check-i18n-keys` 的基准集一致;少一门就是少一门语言,不静默放过 */
const LANGS = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const

type Locale = Record<string, unknown>

function readLocale(lang: string): Locale {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${lang}.json`), 'utf8')) as Locale
}

/** 按点分路径取叶子字符串;取不到 / 不是字符串 / 全空白 ⇒ null(绝不猜一个值顶替)。 */
function leafOfString(obj: Locale, dotPath: string): string | null {
  let cur: unknown = obj
  for (const seg of dotPath.split('.')) {
    if (cur === null || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[seg]
  }
  return typeof cur === 'string' && cur.trim() !== '' ? cur : null
}

/** 一张 (终态 → i18n 全键) 表在某份语言包里的未解析清单 —— 本文件唯一的解析判据出口。 */
function unresolvedKeys(table: Record<string, string>, locale: Locale): string[] {
  const out: string[] = []
  for (const [term, fullKey] of Object.entries(table)) {
    const value = leafOfString(locale, fullKey)
    if (value === null || value === fullKey) out.push(`${term}→${fullKey}`)
  }
  return out
}

const termEntries = Object.entries(TERMINATION_LABEL_KEYS)

describe('折叠终态:键表与登记表必须逐字对齐', () => {
  it('键表键集 ≡ COLLAPSED_TERMINATIONS(加成员必须同批补键,漏一个端上渲染 undefined)', () => {
    expect(termEntries.map(([k]) => k).sort()).toEqual([...COLLAPSED_TERMINATIONS].sort())
  })

  it('四档齐(2026-10-05 起 failed 也在册;这是本票相对 09-28 的唯一增量)', () => {
    expect([...COLLAPSED_TERMINATIONS].sort()).toEqual([
      'cancelled',
      'failed',
      'preempted',
      'quota_exceeded',
    ])
  })

  it('四档的键逐字互不相同(靶心:failed 不得复用 cancelled 的键)', () => {
    const keys = termEntries.map(([, fullKey]) => fullKey)
    expect(new Set(keys).size).toBe(keys.length)
    // 逐字点名,免得"去重后数量对"却恰好是 failed 那一条撞了 cancelled
    expect(TERMINATION_LABEL_KEYS.failed).not.toBe(TERMINATION_LABEL_KEYS.cancelled)
  })
})

describe('折叠终态词条:五语言 × 逐键必须解析得到非空文案', () => {
  const table: Record<string, string> = Object.fromEntries(termEntries)
  for (const lang of LANGS) {
    it(`${lang}:0 个未解析(漏键或值等于键名都算)`, () => {
      expect(unresolvedKeys(table, readLocale(lang))).toEqual([])
    })
  }
})

describe('出口函数:四档归自己,其余一律 null', () => {
  it.each([...COLLAPSED_TERMINATIONS])('%s ⇒ terminationOf 返回它自己', (t) => {
    expect(terminationOf(t)).toBe(t)
  })

  it('真的·阻塞与六档值都不得被认领(它们不是"被折叠的终态成因")', () => {
    expect(terminationOf('blocked')).toBeNull()
    expect(terminationOf('in_progress')).toBeNull()
    expect(terminationOf('done')).toBeNull()
  })

  it('空值/非字符串/未登记值 ⇒ null(不替未知值猜一个结论)', () => {
    expect(terminationOf(null)).toBeNull()
    expect(terminationOf(undefined)).toBeNull()
    expect(terminationOf('')).toBeNull()
    expect(terminationOf('weird_status')).toBeNull()
    // 第二域的拼写(单 l `canceled`)刻意不认领 —— 那是另一个域,认领等于把两域并成一张
    expect(terminationOf('canceled')).toBeNull()
  })
})

describe('反向锁:三道判据都必须对"缺一条/撞一条"有牙(构造面,不靠仓库瞬时状态)', () => {
  it('构造一张缺一档的键表 + 只有三条词条的语言包 ⇒ 必须点名缺的那条(①有牙)', () => {
    const locale: Locale = {
      agents: {
        kanban: {
          terminatedCancelled: '已取消',
          terminatedQuotaExceeded: '配额超限',
          terminatedPreempted: '被抢占',
        },
      },
    }
    expect(unresolvedKeys({ failed: 'agents.kanban.terminatedFailed' }, locale)).toEqual([
      'failed→agents.kanban.terminatedFailed',
    ])
  })

  it('值等于键名(回显形态)同样判为未解析(②有牙)', () => {
    const locale: Locale = {
      agents: { kanban: { terminatedFailed: 'agents.kanban.terminatedFailed' } },
    }
    expect(unresolvedKeys({ failed: 'agents.kanban.terminatedFailed' }, locale)).toEqual([
      'failed→agents.kanban.terminatedFailed',
    ])
  })

  it('两档指向同一个键时"去重计数"必须少于档数(③有牙)', () => {
    const collided = { failed: 'X', cancelled: 'X' } as Record<string, string>
    const keys = Object.values(collided)
    expect(new Set(keys).size).toBeLessThan(keys.length)
  })

  it('真表喂真语言包必须 0 条未解析(证明上面几例不是恒真判据)', () => {
    const table: Record<string, string> = Object.fromEntries(termEntries)
    for (const lang of LANGS) {
      expect(unresolvedKeys(table, readLocale(lang))).toEqual([])
    }
  })
})

describe('G-462 拆档(2026-10-07 拍板):塌缩出口退役后的映射矩阵', () => {
  it('LEGACY_STATUS_MAP:四遗留终态各自映射独立新档,不再同落 blocked', () => {
    expect(LEGACY_STATUS_MAP.failed).toBe('execution_failed')
    expect(LEGACY_STATUS_MAP.cancelled).toBe('cancelled')
    expect(LEGACY_STATUS_MAP.quota_exceeded).toBe('quota_exceeded')
    expect(LEGACY_STATUS_MAP.preempted).toBe('preempted')
    // blocked 纯化:映射值集里不得再出现 blocked —— 若有人把四档改回同落 blocked,本行判红
    expect(Object.values(LEGACY_STATUS_MAP)).not.toContain('blocked')
  })

  it('四新终态出边为空(终态无流转;done 同为终态)', () => {
    for (const st of [
      'cancelled',
      'execution_failed',
      'quota_exceeded',
      'preempted',
      'done',
    ] as const) {
      expect(ALLOWED_TRANSITIONS[st]).toEqual([])
    }
  })

  it('映射矩阵封闭:值的都是枚举成员,同名归一键才允许键值同串', () => {
    const statuses = new Set<string>(AGENT_TASK_STATUSES)
    for (const [legacy, modern] of Object.entries(LEGACY_STATUS_MAP)) {
      expect(statuses.has(modern), `${legacy} → ${modern} 必须是枚举成员`).toBe(true)
      expect(statuses.has(legacy)).toBe(modern === legacy)
    }
  })
})
// ⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‍‌‌‌‌‍‍‌‌‍‍‌‍‌‌‌‌‌‌‌‌‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‌‌‌‍‍️‌‌‍‍‌‌‌‌‌‍‍‌‌‍‍️‌‌‌‌‌‌‍‍‍‌‌‍‍‌‌‌‌‌‍‍‍‌‌‍‍‌‍‍‌‌‍‍‍‌‌‌‍‍‍‌‌‌‌‍‍‍‌‌‍‍‌‌‌‍‍‍‌‌‍‍‌‌‍‌‌‌‌‍‍‍‌‌‍‍‌‌‌‌‌‍‍⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
