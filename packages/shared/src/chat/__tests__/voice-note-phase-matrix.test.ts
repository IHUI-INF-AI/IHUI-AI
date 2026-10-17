// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  isVoiceNotePhaseTerminal,
  isVoiceNoteTranscriptPending,
  parseVoiceNotes,
  transitionVoiceNotePhase,
  type VoiceNoteEvent,
  type VoiceNotePhase,
} from '../voice-note'

/**
 * D43 会话内快捷笔记(G-51)子票① —— 12 相语音笔记状态机的 phase 矩阵用例。
 *
 * 票面验收原话:「phase 矩阵用例(权限拒绝/中断/最终化失败/后台回收)各 ≥1 例,
 * 且 phase 转换表在两处消费点同源 —— 不得各写一份 switch」。
 *
 * 取材纪律(AGENTS §22c / 门 191):源文件里那张 `TRANSITIONS` 表是**模块私有、未导出**的,
 * 所以本测试的每一格"落到哪一档"都只能通过生产出口 `transitionVoiceNotePhase` 量出来 ——
 * 结构上抄不成第二份表。本文件写死的只有两样:① 相/事件的**名词表**(不是判定表),它由
 * `Record<VoiceNotePhase, true>` 与 `Record<VoiceNoteEvent, true>` 在编译期兜住,词表增删一档
 * 而本文件未同步即 `tsc --noEmit` 红;② 票面点名的四型语义。最后一例还读本文件自己的正文
 * 反检"确实没有第二份表"。
 *
 * 发现的缺陷一律**只钉现状语义 + 注释点名**,不改生产源文件(本轮禁改),逐条进交付回报。
 */

/** 12 相词表(编译期穷尽:union 增删一档 ⇒ 本处 tsc 即红,不会静默漏扫) */
const PHASE_KEYS: Record<VoiceNotePhase, true> = {
  ready: true,
  requestingPermission: true,
  preparingMedia: true,
  connecting: true,
  recording: true,
  stopping: true,
  waitingTranscript: true,
  completed: true,
  cancelled: true,
  failed: true,
  error: true,
  interrupted: true,
}

/** 13 事件词表(同上,编译期穷尽) */
const EVENT_KEYS: Record<VoiceNoteEvent, true> = {
  start: true,
  permissionGranted: true,
  permissionDenied: true,
  mediaReady: true,
  connected: true,
  stop: true,
  saved: true,
  transcriptReady: true,
  transcriptFailed: true,
  interrupt: true,
  cancel: true,
  retry: true,
  dismiss: true,
}

const PHASES = Object.keys(PHASE_KEYS) as VoiceNotePhase[]
const EVENTS = Object.keys(EVENT_KEYS) as VoiceNoteEvent[]

/** 唯一推进入口:任何一格结论都从这里量,不在测试里复算 */
function t(phase: VoiceNotePhase, event: VoiceNoteEvent): VoiceNotePhase {
  return transitionVoiceNotePhase(phase, event)
}

/** 该相的全部合法出边(事件名 → 目标相),由生产入口反查得到 */
function outgoing(phase: VoiceNotePhase): Array<[VoiceNoteEvent, VoiceNotePhase]> {
  return EVENTS.filter((event) => t(phase, event) !== phase).map((event) => [
    event,
    t(phase, event),
  ])
}

const TERMINALS = PHASES.filter((phase) => isVoiceNotePhaseTerminal(phase))
/** 进行中相 = 非终态且非空闲(即"要么在录、要么在等结果") */
const IN_PROGRESS = PHASES.filter(
  (phase) => !isVoiceNotePhaseTerminal(phase) && phase !== 'ready',
)

/** 仓库根:从本文件位置上溯找 pnpm-workspace.yaml(禁 process.cwd(),共享工作区 cwd 不可靠) */
function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  throw new Error('找不到 pnpm-workspace.yaml ⇒ 消费点正文取不到,不得判为通过(§0.3)')
}

const ROOT = findRepoRoot()

function readSource(relative: string): string {
  try {
    return readFileSync(join(ROOT, relative), 'utf8')
  } catch {
    throw new Error(`消费点正文读取失败:${relative} —— 取不到输入即未判定,绝不回落成"没问题"`)
  }
}

/**
 * 判定表声明式的形状(行首 const TRANSITIONS :/= …)。
 * 用行首锚而不是裸词匹配:本文件多处把这段形状当**模式串**写进检测器自身,
 * 裸词匹配会让"检测器"命中自己的源码,反检假红。被测源文件里那枚表就在行首。
 */
const TABLE_DECL_RE = /^\s*const\s+TRANSITIONS\s*[:=]/gm
/** 端内散写 phase 分支的两种形态:本地 switch、本地判定表 */
const LOCAL_SWITCH_RE = /switch\s*\(\s*(?:\w+\.)?phase\s*\)\s*\{/
const LOCAL_RECORD_TABLE_RE = /Record<\s*VoiceNotePhase\s*,/

describe('票面①型 权限拒绝', () => {
  it('requestingPermission + permissionDenied ⇒ failed:落终态、不留进行中残影', () => {
    const next = t('requestingPermission', 'permissionDenied')
    expect(next).toBe('failed')
    expect(isVoiceNotePhaseTerminal(next)).toBe(true)
    // 副作用面:不得残留"仍在录音/仍在等转写"的任何语义位
    expect(outgoing(next).map(([event]) => event)).toEqual(['retry'])
    expect(IN_PROGRESS.includes(next)).toBe(false)
    expect(isVoiceNoteTranscriptPending(next)).toBe(false)
  })

  it('三个"要权限"的相必须收敛到同一档(端内不得各写一份判断)', () => {
    for (const from of ['requestingPermission', 'preparingMedia', 'connecting'] as const) {
      expect(t(from, 'permissionDenied'), from).toBe('failed')
    }
    // 现状缺陷:录音/收尾/等转写期间权限被撤回,表内无处可去(no-op 原地)
    // ⇒ 端侧只能靠 interrupt 近似表达,语义错位。缺陷登记见交付回报,此处只钉现状。
    for (const from of ['recording', 'stopping', 'waitingTranscript'] as const) {
      expect(t(from, 'permissionDenied'), from).toBe(from)
    }
  })
})

describe('票面②型 中途中断', () => {
  it('interrupt 对每一个进行中相都单步可达 interrupted', () => {
    expect(t('recording', 'interrupt')).toBe('interrupted')
    expect(t('waitingTranscript', 'interrupt')).toBe('interrupted')
    for (const phase of IN_PROGRESS) {
      expect(t(phase, 'interrupt'), phase).toBe('interrupted')
    }
    // 反证:终态/空闲不该被 interrupt 二次改写(idle 收不到该信号即现状缺口)
    expect(t('ready', 'interrupt')).toBe('ready')
    for (const phase of TERMINALS) {
      expect(t(phase, 'interrupt'), phase).toBe(phase)
    }
  })

  it('interrupted 可恢复,且恢复路径唯一 = retry → ready', () => {
    expect(isVoiceNotePhaseTerminal('interrupted')).toBe(true)
    expect(t('interrupted', 'retry')).toBe('ready')
    // start 不能从 interrupted 直接起(必须先 retry),出边集合恰一枚
    expect(t('interrupted', 'start')).toBe('interrupted')
    expect(outgoing('interrupted')).toEqual([['retry', 'ready']])
  })
})

describe('票面③型 最终化失败 / failed 与 error 的分界', () => {
  it('stopping 与 waitingTranscript 上的 transcriptFailed 都落 error(不是 failed)', () => {
    expect(t('stopping', 'transcriptFailed')).toBe('error')
    expect(t('waitingTranscript', 'transcriptFailed')).toBe('error')
    expect(isVoiceNotePhaseTerminal('error')).toBe(true)
    expect(isVoiceNoteTranscriptPending('error')).toBe(false)
  })

  it('分界实测:failed 只由 permissionDenied 产生,error 只由 transcriptFailed 产生', () => {
    // 只数"真把相推进了的"来源(no-op 原地留在本相不算产生该档)
    const producersOf = (target: VoiceNotePhase, event: VoiceNoteEvent) =>
      PHASES.filter((p) => t(p, event) === target && p !== target)
    expect(producersOf('failed', 'permissionDenied')).toEqual([
      'requestingPermission',
      'preparingMedia',
      'connecting',
    ])
    expect(producersOf('error', 'transcriptFailed')).toEqual(['stopping', 'waitingTranscript'])
    // 票面要求"两者若同义就按同一档处理,别假设"—— 现读结论:两档**合法出边集逐字相同**
    // (同为终态,都只有 retry→ready)。no-op 格各自返回本相,不能拿来比对(那比的是档名不是行为)。
    // ⇒ 两档的差别只在"从哪个事件进来",不在"出去能做什么";端侧若给 failed / error 写两套
    // 文案或两套按钮逻辑,那才是各写一份。这一例把同构钉成事实,将来两档真分流即红,须连同票面复核。
    expect(outgoing('failed')).toEqual(outgoing('error'))
    expect(outgoing('failed')).toEqual([['retry', 'ready']])
    expect(TERMINALS.filter((p) => p === 'failed' || p === 'error')).toHaveLength(2)
  })

  it('stop 之前发生落盘/上传失败 ⇒ 表内一步都表达不出来(缺陷只钉现状)', () => {
    const oneStep = new Set(EVENTS.map((event) => t('recording', event)))
    expect(oneStep.has('error')).toBe(false)
    expect(oneStep.has('failed')).toBe(false)
    // waitingTranscript + dismiss ⇒ completed:转写可能一个字都没回来也标"完成"
    // ⇒ completed 的"有结果"语义在这里被稀释。缺陷登记见交付回报。
    expect(t('waitingTranscript', 'dismiss')).toBe('completed')
    expect(isVoiceNoteTranscriptPending('completed')).toBe(false)
  })
})

describe('票面④型 后台回收(当前实现无法表达这一维)', () => {
  it('事件词表里没有任何"回收后复位"的出口:进行中相一步回不到 ready', () => {
    for (const phase of IN_PROGRESS) {
      const targets = EVENTS.map((event) => t(phase, event))
      expect(targets, phase).not.toContain('ready')
    }
    // 结论:进程/页面被回收后"把进行中的相复位"这一维**状态机没有承载**,
    // 端侧唯一可用近似是自己记得派发 interrupt(见下一例)。
    // 这一例故意钉的是"没有",不是"通过":将来补了 restore/reclaim 类事件,
    // 本例必红,改动者必须同批把它换成真正的回收语义,而不是删例消红。
  })

  it('归档原样回灌非终态相 ⇒ 复活一条永不停表的 recording(无归一化出口)', () => {
    const raw = JSON.stringify([
      {
        id: 'note-1',
        conversationId: null,
        createdAt: '2026-10-17T00:00:00.000Z',
        durationMs: 1_200,
        transcript: null,
        phase: 'recording',
      },
    ])
    const restored = parseVoiceNotes(raw)
    expect(restored).toHaveLength(1)
    const phase = restored[0]?.phase
    expect(phase).toBe('recording')
    if (!phase) throw new Error('回灌记录取不到 phase ⇒ 未判定')
    expect(isVoiceNotePhaseTerminal(phase)).toBe(false)
    // 回灌出来的 recording 只剩三条出边,没有一条是"我其实是被回收过的"(不比顺序,只比集合)
    expect(outgoing(phase).map(([event]) => event).sort()).toEqual([
      'cancel',
      'interrupt',
      'stop',
    ])
  })

  it('唯一的近似信号:interrupt 能把 recording 收成终态,而 ready 档连这个信号都收不到', () => {
    expect(t('recording', 'interrupt')).toBe('interrupted')
    expect(t('ready', 'interrupt')).toBe('ready')
  })
})

describe('矩阵全扫 + 结构锁① 终态不得被非法事件再跃迁', () => {
  it('12 × 13 = 156 格逐格过生产入口:不抛错、返回值必在 12 相词表内', () => {
    for (const phase of PHASES) {
      for (const event of EVENTS) {
        const next = t(phase, event)
        expect(PHASE_KEYS[next], `${phase} + ${event} 返回了词表外档名`).toBe(true)
      }
    }
  })

  it('非法组合一律 no-op(原样返回当前相),绝不跳相', () => {
    // 取几组票面关心的非法格:空闲态不接受收尾/转写信号,终态不接受生命周期事件
    const illegal: Array<[VoiceNotePhase, VoiceNoteEvent]> = [
      ['ready', 'stop'],
      ['ready', 'saved'],
      ['ready', 'transcriptReady'],
      ['completed', 'stop'],
      ['cancelled', 'permissionGranted'],
      ['interrupted', 'mediaReady'],
      ['failed', 'connected'],
      ['error', 'dismiss'],
    ]
    for (const [phase, event] of illegal) {
      expect(t(phase, event), `${phase} + ${event}`).toBe(phase)
    }
  })

  it('终态出边恰为 retry → ready;非终态必有自己的合法出边(无死相)', () => {
    expect(TERMINALS).toHaveLength(5)
    for (const phase of TERMINALS) {
      expect(outgoing(phase), phase).toEqual([['retry', 'ready']])
    }
    for (const phase of PHASES.filter((p) => !isVoiceNotePhaseTerminal(p))) {
      expect(outgoing(phase).length, `${phase} 是死相`).toBeGreaterThan(0)
      // retry 不得把非终态洗回 ready(只有终态才允许"重来一次")
      expect(t(phase, 'retry'), phase).toBe(phase)
    }
    // 源文件第 84 行注释写「终态吸收一切事件(no-op)」,与第 96 行「终态仅对 retry 放行」
    // 及本实现互相矛盾(实测五枚终态都有 retry 出边)。文档缺陷,本轮不改源文件,只在此点名。
  })
})

describe('结构锁② 转换表只有一份 · 消费点同源', () => {
  const SHARED_SOURCE = 'packages/shared/src/chat/voice-note.ts'
  const SELF_SOURCE = 'packages/shared/src/chat/__tests__/voice-note-phase-matrix.test.ts'
  /** 已登记的端侧消费点 —— 现读全仓只有 web 这一处真的在推进这台机 */
  const WIRED_CONSUMER = 'apps/web/src/components/chat/voice-note.tsx'
  /**
   * 票面点名的另两处(现读**尚未接线**:既不引 12 相机,也就没有第二份 switch)。
   * 接线那一刻必须把它们搬进上面的 WIRED_CONSUMER,本组用例随即转为要求它引共享出口;
   * 没搬就接线 ⇒ "未接线点名"那例当场红并点名去登记(不是消红,是补登记)。
   */
  const NOT_YET_WIRED = [
    'apps/miniapp-taro/src/pkg-ai/ai/chat.tsx',
    'apps/web/src/components/ai/voice-input.tsx',
    'apps/mobile-rn/src/hooks/use-voice-recorder.ts',
  ]
  /** 抄表必写成的形状:事件名 → 相名字面量(检测器,不是表) */
  const EVENT_TO_PHASE_LITERAL_RE =
    /\b(?:start|permissionGranted|permissionDenied|mediaReady|connected|stop|saved|transcriptReady|transcriptFailed|interrupt|cancel|retry|dismiss)\s*:\s*'/

  function countMatches(src: string, re: RegExp): number {
    return (src.match(re) ?? []).length
  }

  it('判定表全仓恰一枚,且唯一读取位就是 transitionVoiceNotePhase', () => {
    const src = readSource(SHARED_SOURCE)
    // 正向对照:检测器在源文件上必须命中,否则下面所有"零命中"都是尺子空转
    expect(countMatches(src, TABLE_DECL_RE), '共享源文件里那枚 TRANSITIONS 没被检出').toBe(1)
    const body = /function transitionVoiceNotePhase[\s\S]*?\n\}/.exec(src)?.[0]
    if (!body) throw new Error('取不到 transitionVoiceNotePhase 函数体 ⇒ 未判定,不判绿')
    expect(body).toContain('TRANSITIONS[phase]')
  })

  it(`端侧消费点(${WIRED_CONSUMER})只准引共享出口推进:引到入口、不留本地表/switch`, () => {
    const src = readSource(WIRED_CONSUMER)
    expect(/transitionVoiceNotePhase/.test(src), '没有引共享推进入口').toBe(true)
    expect(/from '@ihui\/shared\/chat(?:\/voice-note)?'/.test(src), '引的不是 @ihui/shared/chat 这条唯一出口')
      .toBe(true)
    expect(LOCAL_SWITCH_RE.test(src), '端内自立了 switch (phase)').toBe(false)
    expect(LOCAL_RECORD_TABLE_RE.test(src), '端内自立了 phase 判定表').toBe(false)
    expect(countMatches(src, TABLE_DECL_RE)).toBe(0)
    // 反空转:这个文件确实按 12 相词表起相(初始必须是 ready),不是"根本没用到"
    expect(/useState<VoiceNotePhase>\('ready'\)/.test(src), '初始相不是 ready 或根本没消费词表')
      .toBe(true)
  })

  it('共享层对外只有一条出口:chat barrel 再导出 voice-note 恰一枚', () => {
    expect(countMatches(readSource('packages/shared/src/chat/index.ts'), /export \* from '\.\/voice-note'/g))
      .toBe(1)
  })

  for (const file of NOT_YET_WIRED) {
    it(`未接线点名:${file} 既没引 12 相机,也不许自立第二份表/switch`, () => {
      const src = readSource(file)
      if (/transitionVoiceNotePhase|VoiceNotePhase/.test(src)) {
        throw new Error(
          `${file} 已开始使用共享 12 相机,却不在 WIRED_CONSUMER 登记位 ⇒ 把它登记进去并复核它引的是共享出口,本例即转为正向判据`,
        )
      }
      expect(LOCAL_SWITCH_RE.test(src), `${file} 自立了 switch (phase)`).toBe(false)
      expect(LOCAL_RECORD_TABLE_RE.test(src), `${file} 自立了 phase 判定表`).toBe(false)
      expect(countMatches(src, TABLE_DECL_RE)).toBe(0)
    })
  }

  it('本测试自身反检:没有第二份判定表,结论全部走生产出口(§22c)', () => {
    const self = readSource(SELF_SOURCE)
    expect(countMatches(self, TABLE_DECL_RE)).toBe(0)
    expect(EVENT_TO_PHASE_LITERAL_RE.test(self), '测试里出现了 事件 → 相名 的字面量表').toBe(false)
    expect(countMatches(self, /transitionVoiceNotePhase\(/g), '测试没调用生产入口 ⇒ 全是手抄期望').toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
