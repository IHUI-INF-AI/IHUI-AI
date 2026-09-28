// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 第二域(workspace 进程内 agent 任务态)词汇 × 五语言词表的防漂移闸(G-…/O81 同族票②)。
//
// 立因:守门 151 落地时如实登记的残余 —— `agent-tasks-panel.tsx` / `UnifiedTaskDashboard.tsx`
// 把 `row.status` **原样**渲染进徽章,而那一族值(第二域)在五语言里根本没有词条。
// 词表补齐之后,还要两件事本仓既有尺子都覆盖不到:
//   ① 守门 74(`check-word-table-resolvable`)按"对象字面量词表"发现式扫描,实测对
//      `WORKSPACE_AGENT_TASK_STATUS_LABEL_KEYS` 这张表**零命中**(整份输出里搜不到该形状),
//      所以"键写了但某语言漏一条"这一型无人问责 —— 端上表现是徽章直接回显 `agentTasks.statusFailed`;
//   ② 守门 151 的 SV2 只判**两域成员集合**不相交,不判"每域有没有词条"。
// 本文件把这两格钉住,并按 §22c 的反向锁纪律配构造面反例:只判"现在能解析"的断言,
// 换一种写法就静默失效,所以必须同时证明"漏一条 ⇒ 本文件判红"。
//
// 刻意**不**断言具体译文字面值(除一条拼写不变量):文案可改,而"每语言都有值且不等于键名"不可改。

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  AGENT_TASK_STATUSES,
  WORKSPACE_AGENT_TASK_STATUSES,
  WORKSPACE_AGENT_TASK_STATUS_LABEL_KEYS,
  workspaceAgentTaskStatusLabelKey,
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

/** 一张 (档位 → i18n 全键) 表在某份语言包里的未解析清单 —— 本文件唯一的判据出口。 */
function unresolvedKeys(table: Record<string, string>, locale: Locale): string[] {
  const out: string[] = []
  for (const [status, fullKey] of Object.entries(table)) {
    const value = leafOfString(locale, fullKey)
    // 值等于键名本身 = 回显(端上正是这一脸),同样算没取到词
    if (value === null || value === fullKey) out.push(`${status}→${fullKey}`)
  }
  return out
}

const labelEntries = Object.entries(WORKSPACE_AGENT_TASK_STATUS_LABEL_KEYS)

describe('第二域状态词汇:两域必须继续互不相交', () => {
  it('六档与第二域的交集为空(守门 151 SV2 的运行时镜像)', () => {
    const six = new Set<string>(AGENT_TASK_STATUSES)
    const overlap = WORKSPACE_AGENT_TASK_STATUSES.filter((v) => six.has(v))
    expect(overlap).toEqual([])
  })

  it('词条表的键集逐字等于第二域登记表(不多一档、不少一档)', () => {
    expect(labelEntries.map(([k]) => k).sort()).toEqual([...WORKSPACE_AGENT_TASK_STATUSES].sort())
  })
})

describe('第二域词条:五语言 × 逐键必须解析得到非空文案', () => {
  const table: Record<string, string> = Object.fromEntries(labelEntries)
  for (const lang of LANGS) {
    it(`${lang}:0 个未解析(漏键或值等于键名都算)`, () => {
      expect(unresolvedKeys(table, readLocale(lang))).toEqual([])
    })
  }

  it('en 的 canceled 文案保持单 l(第三域 "Cancelled" 不在本表)', () => {
    const canceled = leafOfString(readLocale('en'), table.canceled ?? '')
    expect(typeof canceled === 'string').toBe(true)
    expect(String(canceled).toLowerCase()).not.toContain('cancelled')
  })
})

describe('反向锁:判据必须对"漏一条"有牙(构造面,不靠仓库瞬时状态)', () => {
  it('构造一张缺一条键的表 + 只有三条词条的语言包 ⇒ 必须点名那一条', () => {
    const locale: Locale = {
      agentTasks: { statusRunning: 'ok', statusCompleted: 'ok', statusFailed: 'ok' },
    }
    expect(unresolvedKeys({ canceled: 'agentTasks.statusCanceled' }, locale)).toEqual([
      'canceled→agentTasks.statusCanceled',
    ])
  })

  it('值等于键名(回显形态)同样判为未解析', () => {
    const locale: Locale = { agentTasks: { statusRunning: 'agentTasks.statusRunning' } }
    expect(unresolvedKeys({ running: 'agentTasks.statusRunning' }, locale)).toEqual([
      'running→agentTasks.statusRunning',
    ])
  })

  it('真表喂真语言包必须 0 条(证明上面两例不是恒真判据)', () => {
    for (const lang of LANGS) {
      expect(unresolvedKeys(tableOfLabels(), readLocale(lang))).toEqual([])
    }
  })
})

describe('出口函数不得替未知值猜一个档', () => {
  it('登记表之外的值 ⇒ null(显示侧必须原样显示并标未判定,不得用翻译表假装覆盖)', () => {
    expect(workspaceAgentTaskStatusLabelKey('running')).toBe('agentTasks.statusRunning')
    expect(workspaceAgentTaskStatusLabelKey('cancelled')).toBeNull()
    expect(workspaceAgentTaskStatusLabelKey('')).toBeNull()
    // 第三域/六档的值都不得被本出口认领 —— 否则两域在端内又被并成一张
    expect(workspaceAgentTaskStatusLabelKey('in_progress')).toBeNull()
    expect(workspaceAgentTaskStatusLabelKey('done')).toBeNull()
  })
})

function tableOfLabels(): Record<string, string> {
  return Object.fromEntries(labelEntries)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
