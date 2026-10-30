// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * E2E 隔离测试路由(零后端依赖)。
 * 仅用于 Playwright 实跑 MarkdownStream 的流式渲染观感:
 *   - 挂载后自动启动驱动器(模拟 smooth-delta-batcher 的几何揭示,每帧追加一小段)
 *   - 末尾翻转 isStreaming=false,验证 active→stable 零重排修复
 * 生产无关:本路由不参与任何业务,仅 e2e 使用。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { MarkdownStream } from '@/components/ai/markdown-stream'

const SAMPLE = (() => {
  const para =
    '这是一段用于流式渲染压测的普通正文，包含中文与 english 混合内容，用来验证逐字淌出的平滑度。' +
    '好的流式观感来自稳定的节拍与跟手的光标，而不是一次性把一大坨文字糊在屏幕上。'
  const body = [
    '## 背景',
    '- 列表项一：说明流式渲染的历史演进与代价',
    '- 列表项二：说明整坨蹦为何带来廉价感',
    '- 列表项三：说明逐帧小步为何顺眼',
    '',
    '> 引用块：当最后一个字落下，光标应咬在字尾，画面不应抖动。',
    '',
  ].join('\n')
  let s = '# 深度思考长回答示例\n\n' + para.repeat(2) + '\n\n'
  for (let i = 0; i < 10; i++) {
    s += `${body}\n`
  }
  s += '### 代码示例\n\n'
  s += '```ts\nfunction greet(name: string) {\n  const msg = `hello, ${name}`\n  return msg\n}\n'
  for (let i = 0; i < 16; i++) {
    s += `const v${i} = ${i}\n`
  }
  s += '```\n\n'
  s += '结尾段落：当思考与正文都逐字淌出、双光标同拍、内联尾随光标咬在字尾、长文不再 400ms 整坨蹦、完成瞬间不再重排——这便是我们要的流式质感。\n'
  return s
})()

export default function MarkdownStreamE2EPage() {
  const [content, setContent] = useState('')
  const [streaming, setStreaming] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const iRef = useRef(0)
  const startedRef = useRef(false)

  const start = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    if (intervalRef.current) clearInterval(intervalRef.current)
    iRef.current = 0
    setContent('')
    setStreaming(true)
    // eslint-disable-next-line no-console
    console.log('[harness] start, SAMPLE len=', SAMPLE.length)
    // 用 setInterval 而非 rAF:headless 浏览器对后台页 rAF 节流到 ~1fps,
    // 会让"流式"看起来像整坨蹦(测试假象)。setInterval + 反节流参数贴近真实逐帧推进。
    intervalRef.current = setInterval(() => {
      const remaining = SAMPLE.length - iRef.current
      const chunk = Math.max(1, Math.ceil(remaining / 24))
      iRef.current = Math.min(SAMPLE.length, iRef.current + chunk)
      setContent(SAMPLE.slice(0, iRef.current))
      if (iRef.current % 120 === 0 || iRef.current >= SAMPLE.length) {
        // eslint-disable-next-line no-console
        console.log('[harness] tick i=', iRef.current, 'md~', SAMPLE.slice(0, iRef.current).length)
      }
      if (iRef.current >= SAMPLE.length) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = null
        // 末尾翻转:模拟流式结束,验证 active→stable 零重排
        setStreaming(false)
        // eslint-disable-next-line no-console
        console.log('[harness] done, final md len=', SAMPLE.length)
      }
    }, 16)
  }, [])

  // 挂载后自动启动(绕过按钮被全局壳层覆盖层拦截导致 onClick 不触发的问题)
  useEffect(() => {
    const t = setTimeout(start, 300)
    return () => clearTimeout(t)
  }, [start])

  return (
    <main style={{ maxWidth: 760, margin: '40px auto', padding: 24 }}>
      <button data-testid="start-stream" onClick={start}>
        开始流式 ({content.length})
      </button>
      <div
        data-testid="stream-host"
        style={{ marginTop: 24, border: '1px solid #ddd', padding: 16, minHeight: 200 }}
      >
        <MarkdownStream content={content} isStreaming={streaming} />
      </div>
    </main>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
