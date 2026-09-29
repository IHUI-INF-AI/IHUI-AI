// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D151(2026-09-29 立):小程序端「命令在等键盘输入」的降级形态装车证明。
 *
 * 三层各证一件事(本仓反复出现"组件写了没人接线而测试仍绿",守门 64/70/81/115/138 同族):
 *  ① 纯归并器:markTerminalWaiting 只标已存在的任务、重复帧幂等、找不到 id 不自建卡;
 *     clearTerminalWaiting 在终态时把标记摘掉(命令都结束了还挂"在等你"是假态);
 *  ② **接线**:chat.tsx 的 streamChat 回调表里必须有 `onTerminalInteraction` **代码行**,
 *     且函数体真的调用 markTerminalWaiting —— 把那一行改名,本用例必红(反向对照);
 *  ③ **解析器认领**:terminal_interaction 必须在 sse-parse 的泛化 sessionId 兜底**之前**
 *     被认领。这一条是实测逼出来的:该帧带一个字符串 sessionId,不认领就会被折成
 *     {type:'meta'} 并把 terminalId/提示原文整块丢掉 ⇒ 端上**结构上看不见**"它在等人"。
 *     判据直接喂解析器函数本身,不读源码文本(读文本只能证明"写了那句话")。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseSSEChunk } from '@ihui/shared/utils/sse-parse'
import { clearTerminalWaiting, markTerminalWaiting, type TerminalTaskView } from '../types'

const HERE = dirname(fileURLToPath(import.meta.url))
const CHAT_SRC = readFileSync(resolve(HERE, '../../chat.tsx'), 'utf8')

function tasks(...items: Array<Partial<TerminalTaskView> & { id: string }>): TerminalTaskView[] {
  return items.map((x) => ({ command: 'npm i', status: 'running', ...x }))
}

describe('D151 ① 归并器:只标已存在的任务,终态必清', () => {
  it('命中 id 才标记;重复帧幂等;找不到 id 不自建卡', () => {
    const base = tasks({ id: 'a' }, { id: 'b', status: 'completed' })
    const once = markTerminalWaiting(base, 'a')
    expect(once.find((x) => x.id === 'a')?.waitingInput).toBe(true)
    expect(once.find((x) => x.id === 'b')?.waitingInput).toBeUndefined()
    // 幂等:第二次标记不产生新数组(挂 setData 的端上,无谓的新引用就是无谓的重渲染)
    expect(markTerminalWaiting(once, 'a')).toBe(once)
    // 帧乱序(start 没来)时不得凭空造一张卡:那会把"我没看见 start"伪装成"有条命令在跑"
    const none = markTerminalWaiting(base, 'ghost')
    expect(none).toHaveLength(2)
    expect(none.some((x) => x.id === 'ghost')).toBe(false)
  })

  it('终态清除等待标记', () => {
    const waiting = markTerminalWaiting(tasks({ id: 'a' }), 'a')
    expect(waiting[0]?.waitingInput).toBe(true)
    const cleared = clearTerminalWaiting(waiting, 'a')
    expect(cleared[0]?.waitingInput).toBe(false)
    // 别的任务不受牵连
    const mixed = clearTerminalWaiting(
      markTerminalWaiting(tasks({ id: 'a' }, { id: 'b' }), 'b'),
      'a',
    )
    expect(mixed.find((x) => x.id === 'b')?.waitingInput).toBe(true)
  })
})

describe('D151 ③ 解析器:该帧必须在 sessionId 泛化兜底之前被认领', () => {
  // 整帧必须在**一条 data: 行**上 —— SSE 的 data 分片要靠多行前缀表达,
  // 把 JSON 拆两行会让第二行没有 data: 前缀而被丢弃,那测的是夹具写错了不是判据。
  const FRAME =
    'data: {"type":"terminal_interaction","terminalId":"t-9","sessionId":"s-9","promptTail":"Password:","waitingSinceMs":1800,"inputMode":"line","maxInputChars":4096}\n\n'

  it('产出 terminal_interaction 与完整载荷(不折成 meta)', () => {
    const { events } = parseSSEChunk(FRAME)
    expect(events).toHaveLength(1)
    const evt = events[0]
    // 越界不是"少一条断言",而是后面每一行都对着 undefined 取值 ⇒ 判据会红得看不懂。
    // 显式抛在这里,红因就是"解析器一帧都没产出"这一件事实。
    if (!evt) throw new Error('parseSSEChunk 未产出事件帧 ⇒ 本用例的判据没有载体')
    // 这一条就是本票的"端上看不看得见":折成 meta 时 type 与 terminalId 双双丢失
    expect(evt.type).toBe('terminal_interaction')
    expect(evt.terminalInteraction).toMatchObject({
      terminalId: 't-9',
      sessionId: 's-9',
      promptTail: 'Password:',
      waitingSinceMs: 1800,
      inputMode: 'line',
      maxInputChars: 4096,
    })
  })

  it('terminalId 不是 string ⇒ 丢弃,绝不回落 chunk/meta', () => {
    expect(
      parseSSEChunk('data: {"type":"terminal_interaction","sessionId":"s-9"}\n\n').events,
    ).toEqual([])
  })
})

describe('D151 ② 接线:chat.tsx 真的把 onTerminalInteraction 接进回调表', () => {
  /** 只取代码面:剥行注释与块注释(状态机,不做行首筛 —— 块注释内部行常不以 * 开头) */
  const codeLines = (src: string): string[] => {
    const out: string[] = []
    let inBlock = false
    for (const raw of src.split('\n')) {
      let line = ''
      let quote: '' | '"' | "'" | '`' = ''
      for (let i = 0; i < raw.length; i += 1) {
        const c = raw[i]!
        const n = raw[i + 1] ?? ''
        if (inBlock) {
          if (c === '*' && n === '/') {
            inBlock = false
            i += 1
          }
          continue
        }
        if (quote !== '') {
          line += c
          if (c === '\\') {
            line += n
            i += 1
          } else if (c === quote) quote = ''
          continue
        }
        if (c === '/' && n === '/') break
        if (c === '/' && n === '*') {
          inBlock = true
          i += 1
          continue
        }
        if (c === '"' || c === "'" || c === '`') quote = c
        line += c
      }
      if (line.trim() !== '') out.push(line.trimEnd())
    }
    return out
  }
  const lines = codeLines(CHAT_SRC)

  it('代码面存在 onTerminalInteraction 属性行(把它改名即红)', () => {
    expect(lines.some((l) => /^\s*onTerminalInteraction:/.test(l))).toBe(true)
  })

  it('回调体内真的调用 markTerminalWaiting(接线不是空壳)', () => {
    const at = lines.findIndex((l) => /^\s*onTerminalInteraction:/.test(l))
    expect(at).toBeGreaterThanOrEqual(0)
    const body = lines.slice(at, at + 12).join('\n')
    expect(body).toContain('markTerminalWaiting(')
  })

  it('terminal_end 归并后过 clearTerminalWaiting(命令结束了还挂"在等你"就是假态)', () => {
    const at = lines.findIndex((l) => /^\s*onTerminalEnd:/.test(l))
    expect(at).toBeGreaterThanOrEqual(0)
    const body = lines.slice(at, at + 26).join('\n')
    expect(body).toContain('clearTerminalWaiting(')
    // 清除只能有一处出口:把 waitingInput 又写进终态对象字面量 = 第二份真相
    expect(body).not.toContain('waitingInput: false')
  })

  it('两个归并器都从 cards/types 引进来(只 import 不用 = 死码,各自都必须在代码面被调用)', () => {
    // import 语句自身不算调用:所以判"出现次数 ≥ 2"(一次在 import、至少一次在调用点)。
    for (const name of ['markTerminalWaiting', 'clearTerminalWaiting']) {
      const inSource = lines.filter((l) => l.includes(`${name}(`)).length
      expect(inSource, `${name} 必须有调用点`).toBeGreaterThanOrEqual(1)
      const total = CHAT_SRC.split(name).length - 1
      expect(total, `${name} 必须既被 import 又被调用`).toBeGreaterThanOrEqual(2)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
