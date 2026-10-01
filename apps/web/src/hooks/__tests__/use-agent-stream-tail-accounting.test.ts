// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-815939 的装车证明:这条流在 web 端**真的**走带账目的切帧器,而不是自己写 buffer。
//
// 两臂都是行为级(不是只读源码):
//  ① 尾段是完整帧却少一个空行 ⇒ 必须被排空(drained=1)并被派发出去;
//  ② 尾段是半截 JSON ⇒ 必须计成 discarded 且点名(chars/preview),绝不能静默变短;
//  ③ 干净收尾 ⇒ 三态全 0(与 ①② 同判据的另一臂,缺它就能做出"逢收尾都报丢失"的假尺子)。
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentStream } from '@/hooks/use-agent-stream'

vi.mock('@/lib/api', () => ({
  getStreamBaseUrl: () => 'http://127.0.0.1:0',
  getToken: () => null,
}))

const enc = new TextEncoder()

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
}

/** 起一次流并等到它自己收口(hook 在 finally 里结清尾帧账目)。 */
async function runStream(chunks: string[]) {
  const events: unknown[] = []
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(streamOf(chunks), { status: 200 })),
  )
  const { result } = renderHook(() =>
    useAgentStream({ threadId: 't-1', onEvent: (e) => events.push(e) }),
  )
  act(() => result.current.start({ input: 'x' }))
  // 读循环是 microtask 链上的 async IIFE:让宏任务跑一轮,close() 一定已经执行
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
  return { result, events, warn }
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('尾帧账目:三种收尾各落自己那一态', () => {
  it('尾段是完整帧、只差一个空行 ⇒ 排空解析成功并派发,不记成丢弃', async () => {
    const { result, events } = await runStream([
      'event: token\ndata: {"type":"token","data":"a"}\n', // 少一个空行 = 服务端收尾漏发分隔符的真实形态
    ])
    const account = result.current.tailAccount
    expect(account).not.toBeNull()
    expect(account?.drained).toHaveLength(1)
    expect(account?.discarded).toHaveLength(0)
    expect(account?.undetermined).toHaveLength(0)
    // 排空成功那一臂仍要把"完整帧数"记对:drained 是尾段那一格,complete 是已切出来的帧
    expect(account?.completeFrames).toBe(0)
    expect(events).toHaveLength(1)
  })

  it('尾段是半截 JSON ⇒ discarded=1 且点名内容与长度,同时大声报一行', async () => {
    const { result, events, warn } = await runStream([
      'event: token\ndata: {"type":"token","data":"a"}\n\n',
      'event: token\ndata: {"type":"tok',
    ])
    const account = result.current.tailAccount
    expect(account).not.toBeNull()
    expect(account?.discarded).toHaveLength(1)
    expect(account?.discarded[0]?.chars).toBe('event: token\ndata: {"type":"tok'.length)
    expect(account?.discarded[0]?.preview).toContain('data: {"type":"tok')
    // 半截 JSON 不许被硬喂给解析器折成 custom 事件 —— 那等于用错误的方式排空
    expect(events).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('discarded=1')
    expect(String(warn.mock.calls[0]?.[0])).toContain('undetermined=0')
  })

  it('干净收尾(最后一帧带空行)⇒ 三态全 0 且不打扰人', async () => {
    const { result, warn } = await runStream(['event: token\ndata: {"type":"token","data":"a"}\n\n'])
    const account = result.current.tailAccount
    expect(account?.drained).toHaveLength(0)
    expect(account?.discarded).toHaveLength(0)
    expect(account?.undetermined).toHaveLength(0)
    expect(account?.closed).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('源码形状锁:buffer 的收口不许再回到"自己写一遍"', () => {
  it('切帧走共享累加器,且 close 落在 finally(所有出口都结一次账)', async () => {
    // 为什么用 cwd 而不是 import.meta.url:happy-dom 下后者的 scheme 不是 file:
    // (实测 `new URL('../../x.ts', import.meta.url)` 直接 TypeError),
    // 而按名字猜路径又会在搬家时静默失配 —— 这里改为"取不到就红",绝不让读不到文件冒充通过。
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const target = path.resolve(process.cwd(), 'src/hooks/use-agent-stream.ts')
    let source: string
    try {
      source = await fs.readFile(target, 'utf8')
    } catch (e) {
      throw new Error(
        `[形状锁未判定] 取不到被审文件 ${target}(${String(e)})—— 空读不得算判过`,
      )
    }
    expect(source).toContain('createSseFrameAccumulator')
    expect(source).toContain('summarizeSseTailAccount')
    // 反向锁:旧的自己写的 buffer 循环(它就是"尾段永不进账"的那一型)不得回来
    expect(source).not.toMatch(/buffer\.indexOf\('\\n\\n'\)/)
    const finallyBlock = source.slice(source.indexOf('} finally {'))
    expect(finallyBlock.slice(0, 1200)).toContain('accumulator.close()')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
