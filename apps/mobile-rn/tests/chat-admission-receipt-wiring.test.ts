// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// @vitest-environment node

/**
 * 差距① 发送准入回执(admission)· mobile-rn 接线锁(2026-11-13 立)。
 *
 * 立此锁的因由:本端 `streamChat({...})` 调用体此前**既无 inputId 也无 metadata**,
 * 服务端结构上永远不会发这一帧;而本端确有完整回调表(30+ 档),缺的不是挂点而是上行腿。
 * 台账 `no-admission-receipt-chain` 把它记作「该端缺上行腿」,不是「该端不需要」。
 *
 * 本锁钉四件事,每条都能被"摘掉实现"打红:
 *   ① 上行 `inputId` 由共享 `createInputId()` 生成并真的进 payload;
 *   ② `metadata.conversationId` 只在有会话 id 时补(否则回执恒 accepted = 无信息量);
 *   ③ 真实 `streamChat` 收到 admission 帧字节时,端上注册的 `onSendAdmissionReceipt` 收到
 *      与上游逐字节相同的载荷(运行时派发,不是只看源码有没有那行);
 *   ④ 呈现:queued/rejected/duplicate 走 showToast 上屏,accepted 静默。
 *
 * 与 trace-id 那把锁同型:运行时派发用真帧字节,接线自证用剥注释后的源码。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, afterEach, vi } from 'vitest'

import { setBaseUrl, setStreamBaseUrl, streamChat } from '@ihui/api-client'

const HERE = dirname(fileURLToPath(import.meta.url))
/** 剥行注释与块注释:判的是"这行代码真在位",注释掉不算接上。 */
const strip = (s: string): string =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\/\*[\s\S]*?\*\/\s*$/gm, '')
const SCREEN = strip(readFileSync(join(HERE, '../src/screens/ChatScreen.tsx'), 'utf8'))

function sseResponse(chunks: string[]): Response {
  const enc = new TextEncoder()
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const ch of chunks) c.enqueue(enc.encode(ch))
        c.close()
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  )
}

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  setStreamBaseUrl('')
  setBaseUrl('')
})

describe('差距① mobile-rn 上行两把键', () => {
  it('inputId 由共享 createInputId() 生成(端内不造第二源)', () => {
    expect(SCREEN).toContain("import { createInputId } from '@ihui/shared/chat/send-admission'")
    expect(SCREEN).toContain('const roundInputId = createInputId()')
    expect(SCREEN).toContain('inputId: roundInputId,')
    // 反向:端内不得自造 id
    expect(SCREEN).not.toMatch(/const roundInputId = [`'"]/)
  })

  it('metadata.conversationId 仅在已有会话时补(无会话时不补)', () => {
    expect(SCREEN).toContain('...(conversationId ? { metadata: { conversationId } } : {}),')
  })

  it('反向:不得无条件把 conversationId 塞进 metadata', () => {
    const withoutGuarded = SCREEN.replace(
      /\.\.\.\(conversationId \? \{ metadata: \{ conversationId \} \} : \{\}\),/g,
      '',
    )
    expect(withoutGuarded).not.toMatch(/metadata: \{ conversationId \}/)
  })
})

describe('差距① mobile-rn 运行时派发(真帧字节)', () => {
  it('admission 帧到达时 onSendAdmissionReceipt 收到与上游逐字节相同的载荷', async () => {
    const receipt = { type: 'admission', inputId: 'i-rn-1', disposition: 'queued', ahead: 2 }
    globalThis.fetch = vi.fn(async () =>
      sseResponse([
        `data: ${JSON.stringify(receipt)}\n\n`,
        `data: ${JSON.stringify({ type: 'chunk', content: 'hi' })}\n\n`,
        'data: [DONE]\n\n',
      ]),
    ) as unknown as typeof fetch
    setBaseUrl('https://api.test')
    setStreamBaseUrl('https://api.test')

    const got: unknown[] = []
    await streamChat({
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      inputId: 'i-rn-1',
      metadata: { conversationId: 'c-1' },
      onDelta: () => {},
      onSendAdmissionReceipt: (r) => got.push(r),
    })

    expect(got).toHaveLength(1)
    const r = got[0] as typeof receipt
    expect(r.inputId).toBe('i-rn-1')
    expect(r.disposition).toBe('queued')
    expect(r.ahead).toBe(2)
  })

  it('不注册 onSendAdmissionReceipt ⇒ 该帧静默丢弃,不影响主链路(与其余 per-field 同口径)', async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse([
        `data: ${JSON.stringify({ type: 'admission', inputId: 'i-rn-2', disposition: 'rejected' })}\n\n`,
        `data: ${JSON.stringify({ type: 'chunk', content: 'ok' })}\n\n`,
        'data: [DONE]\n\n',
      ]),
    ) as unknown as typeof fetch
    setBaseUrl('https://api.test')
    setStreamBaseUrl('https://api.test')

    const deltas: string[] = []
    await streamChat({
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      inputId: 'i-rn-2',
      onDelta: (d) => deltas.push(d),
    })
    // 主链路照常收到正文
    expect(deltas.join('')).toContain('ok')
  })
})

describe('差距① mobile-rn 呈现腿', () => {
  it('accepted 不产生新排队提示,其余三档走 showToast 上屏', () => {
    expect(SCREEN).toContain('onSendAdmissionReceipt: (receipt) => {')
    expect(SCREEN).toMatch(/if \(receipt\.disposition === 'accepted'\) \{/)
    expect(SCREEN).toMatch(/showToast\(/)
  })

  /**
   * 晋升收束(2026-11-13 立)。本端出口是 FloatBox(会自动消失),所以"永久停留"不成立,
   * 但旧实现下用户看到"已排队"→它自己消失→**再无下文**,不知道到底开始了没有。
   * 修法:晋升时补一条"服务端已收下",给出明确收束;直通场景(没排过队)不补。
   */
  it('晋升:排过队才补"已收下",直通场景不凭空多一条提示', () => {
    expect(SCREEN).toContain('const queuedTurnRef = useRef<string | null>(null)')
    // 只在记过 queuedTurnId 且同值时才更新
    expect(SCREEN).toMatch(/if \(qid && queuedTurnRef\.current === qid\) \{/)
    expect(SCREEN).toMatch(/streamErrors\.admission\.admitted/)
    // 更新后清登记(避免下一轮直通场景被误判成"排过队")
    expect(SCREEN).toMatch(/queuedTurnRef\.current = null/)
  })

  it('词表用共享 streamErrors.admission.*,未命中原样回显处置码', () => {
    expect(SCREEN).toContain('streamErrors.admission.${receipt.disposition}')
    expect(SCREEN).toMatch(/label === key \? receipt\.disposition : label/)
  })

  it('rejected 档用 error 型提示(与 info 区分,不在同一视觉权重)', () => {
    expect(SCREEN).toMatch(/receipt\.disposition === 'rejected' \? 'error' : 'info'/)
  })
})

/**
 * 中间态收回(2026-11-13 立)。
 *
 * queued 缺陷暴露了同一类问题:`onRetryScheduled` 写的是"第 N/M 次重试,X 秒后继续"这种未来时,
 * 而本端的留痕(recordNotice)是**持久**的(NoticeLog 没有 duration,不会自动消失)。
 * 不清就会一直挂在对话里说"X 秒后",而那个 X 秒早就过去了。
 */
describe('中间态提示必须有收回出口', () => {
  it('retryScheduled 的留痕 id 必须被记下(否则无从撤回)', () => {
    expect(SCREEN).toContain('const pendingNoticeIdsRef = useRef<string[]>([])')
    expect(SCREEN).toMatch(/if \(id\) pendingNoticeIdsRef\.current\.push\(id\)/)
  })

  it('showToast 必须回传留痕 id(原来返回 void,撤回就无从下手)', () => {
    // 签名跨行,按片段判而不是整行正则
    expect(SCREEN).toContain(': string | null => {')
    expect(SCREEN).toContain('return recordNotice(type, message)')
    // 反向:不得退回"调用但不返回"的旧形态
    const showToastStart = SCREEN.indexOf('const showToast = useCallback(')
    expect(showToastStart).toBeGreaterThan(0)
    const block = SCREEN.slice(showToastStart, showToastStart + 600)
    expect(block).not.toMatch(/: void => \{/)
  })

  it('正文到达时撤回 pending 留痕,且只撤自己标记过的', () => {
    const deltaIdx = SCREEN.indexOf('contentBatcher.batch(delta)')
    expect(deltaIdx).toBeGreaterThan(0)
    const before = SCREEN.slice(Math.max(0, deltaIdx - 700), deltaIdx)
    expect(before, 'onDelta 内没有撤回 pending 的逻辑').toContain('pendingNoticeIdsRef.current')
    expect(before).toMatch(/prev\.filter\(\(n\) => !stale\.has\(n\.id\)\)/)
  })
})
