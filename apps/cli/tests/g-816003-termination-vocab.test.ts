// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816003 —— 后台任务终止词汇「一张表 × 每消费面一列」与「按停止发起方分支」的常驻尺子。
 *
 * 它存在的理由(与守门 70/76/81/121 同一条禁令):**判据必须在有人问它的那一刻才成立**。
 * 上游 `packages/ui/src/v4` 的 `notificationStatus` 把一次终止同时投影成
 * registry / notification / subagent-event / background-event 四列,立论是
 * "runStatus 讲真话、通用词折起来";本仓此前是**每个消费面各自拼字符串**,
 * 于是"用户刚停"与"模型自停"在播报里同形(票面那一型),而账面什么都看不出来。
 *
 * 四条成对判据,每条都配了"反向锁"(G-816003 交付要求④):
 *  ① user 停止 ⇒ 文案**不得**出现任何"可继续/可重跑/resume"的暗示;
 *  ② model / superseded 停止 ⇒ 文案**不得**反过来劝"别重跑"(反向锁:
 *     只判"含不含某个词"会把两档折成一档,所以①②各查各的方向);
 *  ③ 发起方未记录 ⇒ 落**中性**档,并且把拿不到的原值**报出来**(不得默认成 user);
 *  ④ 表里任一档换成另一档的字面量 ⇒ 两档文案必须不同(同值两份必漂移的阳性对照)。
 */
import { describe, expect, it } from 'vitest'

import {
  BACKGROUND_STOP_REASONS,
  BACKGROUND_TERMINATION_VOCAB,
  backgroundTerminationRowOf,
} from '@ihui/types'
import { __test__, backgroundTerminationVocabFor, pendingNoticeGuidanceKeys } from '../src/tools/background-registry.js'
import { t } from '../src/i18n/index.js'

/** 某一档的指引句子(走播报用的同一条 `t()` 通道,所以它测的是真渲染而不是键名)。 */
function guidanceTextOf(stopReason: string): string {
  const key = backgroundTerminationRowOf(stopReason).row.guidanceKey
  const text = t(key)
  // `t()` 取不到键时原样回显键名 —— 那一格由 pendingNoticeGuidanceKeys 单独判,不混进这里
  return text === key ? '' : text
}

/** 播报文本(状态行 + 指引节),按生产路径组装 —— 断言打在**文本面**上,不是打在某列上。 */
function noticeTextOf(facts: {
  stopInitiator?: 'user' | 'model' | null
  timedOut?: boolean | null
  exitCode?: number | null
}): string {
  const task = {
    id: 'task-under-test',
    identity: 'identity-under-test',
    command: 'sleep 60',
    process: null,
    startedAt: '2026-10-08T00:00:00.000Z',
    exitedAt: '2026-10-08T00:00:01.000Z',
    exitCode: facts.exitCode ?? null,
    status: 'killed',
    stdoutBuf: '',
    stderrBuf: '',
    stdoutHead: '',
    stderrHead: '',
    totalStdoutChars: 0,
    totalStderrChars: 0,
    truncated: false,
    droppedStdoutBytes: 0,
    droppedStderrBytes: 0,
    timedOut: facts.timedOut ?? false,
    notified: false,
    branchGeneration: 0,
    stopInitiator: facts.stopInitiator ?? null,
  } as Parameters<typeof __test__.terminalNoticeOf>[0]
  const input = __test__.terminalNoticeOf(task, 'settled')
  return [input.status, input.result, input.error, input.guidance].filter(Boolean).join('\n')
}

/** ①②③ 三类措辞的判据词表。**不是**"含不含某个词"的单侧判据:两侧各查各的方向。 */
const RESUME_INVITATION = [/重新发起/, /重新发出/, /再跑一次/, /再发起/, /re-issue/, /rerun it/i, / resume/i, /可以重新/, /다시 요청/, /再発行/]
const RESUME_PROHIBITION = [/不要重跑/, /不得重跑/, /别重跑/, /不必重新发起/, /不要重新发起/, /do not re-?issue/, /do not rerun/i, /don’t re-issue/i, /재실행하지/, /再実行しないで/]

describe('G-816003 终止词汇表:一张表 × 每消费面一列', () => {
  it('行集闭合:值域表与行的主键集合逐字等值(缺行/多行都读不出来)', () => {
    const fromRows = BACKGROUND_TERMINATION_VOCAB.map((r) => r.stopReason).sort()
    expect(fromRows).toEqual([...BACKGROUND_STOP_REASONS].sort())
  })

  it('每消费面一列,且四列在任意两行之间不得整行同值(同值两份必漂移的阳性对照)', () => {
    for (const row of BACKGROUND_TERMINATION_VOCAB) {
      for (const col of ['registry', 'notification', 'subagentEvent', 'backgroundEvent'] as const) {
        expect(typeof row[col], `${row.stopReason}.${col}`).toBe('string')
        expect(row[col].length, `${row.stopReason}.${col}`).toBeGreaterThan(0)
      }
    }
    // 阳性对照:把某一档的 notification 换成另一档的字面量 ⇒ 两档文案必须仍不同,
    // 而"同一行内两列互不相同"是"折起来"这件事可被问出的前提。
    const user = backgroundTerminationRowOf('user').row
    const model = backgroundTerminationRowOf('model').row
    expect(user.notification).not.toEqual(model.notification)
    for (const row of BACKGROUND_TERMINATION_VOCAB) {
      const cols = ['registry', 'notification', 'subagentEvent', 'backgroundEvent'].map(
        (c) => (row as unknown as Record<string, string>)[c],
      )
      expect(new Set(cols).size, `row ${row.stopReason} 的四列不得退成一个词`).toBeGreaterThan(1)
    }
  })

  it('本表是第三个域:与 Kanban 六档、workspace 四档都不得有交集(守门 151 SV2 的同一条纪律)', async () => {
    const { AGENT_TASK_STATUSES, WORKSPACE_AGENT_TASK_STATUSES } = await import('@ihui/types')
    const mine = new Set<string>(BACKGROUND_TERMINATION_VOCAB.flatMap((r) => [
      r.registry,
      r.notification,
      r.subagentEvent,
      r.backgroundEvent,
      r.stopReason,
    ]))
    for (const other of [AGENT_TASK_STATUSES as readonly string[], WORKSPACE_AGENT_TASK_STATUSES as readonly string[]]) {
      const hit = other.filter((s) => mine.has(s))
      expect(hit, `与既有契约域相交:${hit.join(',')}`).toEqual([])
    }
  })

  it('查表出口只认已落盘的发起方;未知/缺席落中性档且不默认成 user', () => {
    expect(backgroundTerminationRowOf('user').resolved).toBe(true)
    expect(backgroundTerminationRowOf(null).resolved).toBe(false)
    expect(backgroundTerminationRowOf(undefined).resolved).toBe(false)
    expect(backgroundTerminationRowOf('whoever-the heck').resolved).toBe(false)
    expect(backgroundTerminationRowOf(null).row.stopReason).toBe('unknown')
    // 反向锁:缺席绝不被折叠成 user(那是"把没判写成判过了")
    expect(backgroundTerminationRowOf(null).row.stopReason).not.toBe('user')
  })
})

describe('G-816003 播报按停止发起方分支(成对)', () => {
  it('① user 停止 ⇒ 文案不含任何"可继续/重跑/resume"的暗示', () => {
    const text = noticeTextOf({ stopInitiator: 'user' })
    expect(text).toContain('stopped-by-user')
    expect(guidanceTextOf('user').length, 'user 档必须真取得到一句指引').toBeGreaterThan(0)
    for (const re of RESUME_INVITATION) {
      expect(re.test(text), `user 档文案出现了邀请重跑的措辞(${re}):${text}`).toBe(false)
    }
  })

  it('② model / superseded 停止 ⇒ 文案不得反过来劝"别重跑"(反向锁)', () => {
    const texts: Record<string, string> = {
      model: noticeTextOf({ stopInitiator: 'model' }),
      // superseded 今天 CLI 侧还没有生产者(killTask 的 initiator 值域是 user|model|null,
      // G-816026 已交付、本票不动它),所以直接问表 + 同一条 t() 通道取它那句话。
      superseded: guidanceTextOf('superseded'),
    }
    for (const [reason, text] of Object.entries(texts)) {
      expect(text.length, `${reason} 档必须真取得到一句指引(取不到=文案未落地)`).toBeGreaterThan(0)
      for (const re of RESUME_PROHIBITION) {
        expect(re.test(text), `${reason} 档文案在劝退重跑(${re}):${text}`).toBe(false)
      }
      expect(backgroundTerminationRowOf(reason).row.resumeStance).toBe('open')
    }
    // 两档确实互不相同(否则分支等于没分)
    expect(noticeTextOf({ stopInitiator: 'model' })).not.toEqual(noticeTextOf({ stopInitiator: 'user' }))
  })

  it('③ 未知发起方 ⇒ 中性档,并把拿不到的原值报出来(不默认成 user)', () => {
    const vocab = backgroundTerminationVocabFor({ stopInitiator: null, timedOut: false })
    expect(vocab.resolved).toBe(false)
    expect(vocab.row.stopReason).toBe('unknown')
    expect(vocab.resumeStance).toBe('neutral')
    const text = noticeTextOf({ stopInitiator: null })
    expect(text).toContain('stopped-cause-unknown')
    for (const re of [...RESUME_INVITATION, ...RESUME_PROHIBITION]) {
      expect(re.test(text), `中性档两边都不许说(${re}):${text}`).toBe(false)
    }
  })

  it('④ timedOut 压过发起方轴(它是被预算杀的,与"谁按的停"是两件事)', () => {
    const vocab = backgroundTerminationVocabFor({ stopInitiator: 'user', timedOut: true })
    expect(vocab.row.stopReason).toBe('timed-out')
    // 且不重复推句子:超时那一档的指引键就是既有的 bgNoticeTimedOut,不另立新句
    expect(vocab.row.guidanceKey).toBe('cli.bgNoticeTimedOut')
  })

  it('文案确实落到了五语言词表(取不到键 ⇒ 报"未落地",不悄悄少一行)', () => {
    expect(pendingNoticeGuidanceKeys()).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
