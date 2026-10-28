// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Predictive Edit(V3 #82)输入区接线单测(2026-10-25)。
 *
 * 覆盖:
 *   ② 成功 ⇒ 建议条出现,点「应用」后按后端给的绝对区间落到草稿正确位置;
 *   ③ 失败 ⇒ 建议条不出现、不弹错,且 Enter 发送照常(预测失败绝不阻塞发送)。
 *
 * 只桩 global fetch,不依赖真后端;WebInputCore 是受控组件,Harness 复刻
 * message-input.tsx 的 useState 持有草稿那一条接线(该文件此刻由他席持有,本票禁改)。
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'

import { WebInputCore } from '@/components/chat/web-input-core'

// Tooltip 与本票判据无关,但它来自 @/components/feedback 整桶导出(会牵进 next 运行时依赖);
// 换成透明容器,断言面不受影响(与 web-input-core-enter-key-ordering.test.tsx 同形)。
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode; content?: string }) => <>{children}</>,
}))

function envelope(data: unknown) {
  return { code: 0, message: 'ok', data }
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function Harness({ initial, onSend }: { initial: string; onSend?: () => void }) {
  const [text, setText] = React.useState(initial)
  return (
    <WebInputCore
      text={text}
      placeholder="请输入消息"
      isStreaming={false}
      t={(k) => k}
      onTextChange={setText}
      onSend={onSend ?? (() => {})}
      onStop={() => {}}
      onClear={() => setText('')}
    />
  )
}

const textarea = () => screen.getByRole('textbox') as HTMLTextAreaElement

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Predictive Edit — 成功落到输入区', () => {
  it('建议条出现,应用后按绝对区间改写草稿', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          envelope({
            disposition: 'suggested',
            actions: [
              { kind: 'replace', start: 6, end: 11, text: 'there', anchor: 'world' },
              { kind: 'insert', start: 0, end: 0, text: '>> ' },
            ],
          }),
        ),
      ),
    )

    render(<Harness initial="hello world" />)

    const suggestion = await screen.findByTestId(
      'predictive-edit-suggestion',
      {},
      { timeout: 3000 },
    )
    expect(suggestion).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'predictiveEditApply' }))

    expect(textarea().value).toBe('>> hello there')
    expect(screen.queryByTestId('predictive-edit-suggestion')).toBeNull()
  })
})

describe('Predictive Edit — 失败静默且不阻塞发送', () => {
  it('网络失败 ⇒ 无建议条、无错误文案,Enter 仍照常发送', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      }),
    )
    const onSend = vi.fn()

    render(<Harness initial="hello" onSend={onSend} />)

    // 等这一次预测真的走到失败出口(只留调试痕迹),证明不是"还没请求"。
    await waitFor(() => expect(debugSpy).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(screen.queryByTestId('predictive-edit-suggestion')).toBeNull()

    fireEvent.keyDown(textarea(), { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})
