// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * E2E 隔离测试路由(零后端依赖)。
 * 仅用于 Playwright 实跑 MarkdownStream 的流式渲染观感:
 *   - 默认模式(smoothness,2026-10-28 立):自动驱动器模拟 smooth-delta-batcher 的几何
 *     揭示,末尾翻转 isStreaming=false(整坨蹦/完成零重排守门,见 e2e/streaming-smoothness)
 *   - ?mode=lifecycle(2026-10-29 档⑦⑧⑨):双围栏+mermaid 样本,mermaid 闭合后停幅
 *     4s 制造"已出图→被晋升"的确定性窗口;页内每 16ms 采一帧时间线写入
 *     window.__FRAMELOG,驱动停笔置 window.__STREAM_DONE(供 e2e/streaming-lifecycle 量)
 * 生产无关:本路由不参与任何业务,仅 e2e 使用。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { MarkdownStream } from '@/components/ai/markdown-stream'

// 驱动器遇此字符(U+2063,零宽不可见)停在当前拍 4s:给 mermaid 首渲染在 active 头块
// 阶段就完成出图,再由"紧随其后的段落"逼晋升 —— 档⑨的重挂台账路径必须"曾出过图"才有判别力。
const PAUSE_MARK = '\u2063'
const MERMAID_HOLD_MS = 4000

/**
 * 帧读数(全读 live DOM,不依赖组件内部结构):
 * h = 在场围栏块(code-block-header 的 frame 壳)高度序列 —— 顺序即 DOM 序;
 * a = 代码块"应用到文件"按钮数(完成态外观代理);
 * g = mermaid 缩放工具条在场数(出图成功态独有);
 * p = 宿主文本含"渲染中"占位字样;
 * t = 宿主纯文本长度。
 */
interface FrameSample {
  ts: number
  h: number[]
  a: number
  g: number
  p: boolean
  t: number
}

function takeFrameSample(): FrameSample {
  const host = document.querySelector('[data-testid="markdown-stream"]')
  const heads = Array.from(document.querySelectorAll('[data-testid="code-block-header"]'))
  return {
    ts: performance.now(),
    h: heads.map((e) => Math.round(e.parentElement?.getBoundingClientRect().height ?? 0)),
    a: document.querySelectorAll('[data-testid="apply-to-file-button"]').length,
    g: document.querySelectorAll('[data-testid="mermaid-zoom-toolbar"]').length,
    // 占位判据走 DOM 结构(animate-pulse 壳)而非文案:浏览器 locale 是 en-US,
    // 写死"渲染中"会因翻译错位而恒假(测试假绿最隐蔽的一型)
    p: !!host?.querySelector('div.animate-pulse'),
    t: (host?.textContent ?? '').length,
  }
}

/** 生命周期样本:>1500 正文 → 围栏A(ts 12行) → mermaid(闭合+停幅出图) → 尾段(逼晋升) → 围栏B(py 12行) */
const LIFECYCLE_SAMPLE = (() => {
  const para =
    '这是一段用于流式渲染压测的普通正文，包含中文与 english 混合内容，用来验证逐字淌出的平滑度。' +
    '好的流式观感来自稳定的节拍与跟手的光标，而不是一次性把一大坨文字糊在屏幕上。'
  const aLines = Array.from({ length: 12 }, (_, i) => `const a${i} = ${i}`).join('\n')
  const bLines = Array.from({ length: 12 }, (_, i) => `print(b${i} * ${i})`).join('\n')
  return (
    '# 生命周期实测长回答\n\n' +
    para.repeat(3) +
    '\n\n### A 块\n\n```ts\n' +
    aLines +
    '\n```\n\n段落：逼 A 块晋升 stable 前缀，并引出下面的图表。\n\n' +
    '### 图表\n\n```mermaid\ngraph TD\n  W[写完] --> R[渲染出图]\n  R --> P[晋升重挂]\n  P -->|台账命中| S[首帧即图不闪位]\n```\n' +
    PAUSE_MARK +
    '\n\n紧随其后的段落：此刻 mermaid 已在场，本行首字把它晋入 stable 前缀。\n\n' +
    '### B 块\n\n```py\n' +
    bLines +
    '\n```\n\n尾段：双围栏与图表都在位，逐块完成态与台账移交由页内时间线量取。\n'
  )
})()

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
  s +=
    '结尾段落：当思考与正文都逐字淌出、双光标同拍、内联尾随光标咬在字尾、长文不再 400ms 整坨蹦、完成瞬间不再重排——这便是我们要的流式质感。\n'
  return s
})()

export default function MarkdownStreamE2EPage() {
  const [mode, setMode] = useState<'smoothness' | 'lifecycle'>('smoothness')
  const [content, setContent] = useState('')
  const [streaming, setStreaming] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const samplerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const iRef = useRef(0)
  const startedRef = useRef(false)

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('mode')
    if (m === 'lifecycle') setMode('lifecycle')
  }, [])

  const start = useCallback(() => {
    if (startedRef.current || mode === 'smoothness') return
    startedRef.current = true
    // 流式期间必须让 isStreaming=true,否则光标/在写判定全链路失效(读档会按历史折叠)
    setStreaming(true)
    const sampleText = mode === 'lifecycle' ? LIFECYCLE_SAMPLE : SAMPLE
    // 预热 mermaid chunk(dev 模式动态 chunk 首次 import 触发编译,给真渲染让路)
    if (mode === 'lifecycle') void import('mermaid').catch(() => {})
    intervalRef.current = setInterval(() => {
      const remaining = sampleText.length - iRef.current
      const chunk = Math.max(1, Math.ceil(remaining / 24))
      iRef.current = Math.min(sampleText.length, iRef.current + chunk)
      setContent(sampleText.slice(0, iRef.current))
      if (
        iRef.current < sampleText.length &&
        sampleText[iRef.current - 1] === PAUSE_MARK &&
        intervalRef.current
      ) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        holdTimerRef.current = setTimeout(() => {
          holdTimerRef.current = null
          intervalRef.current = setInterval(() => {
            const r = sampleText.length - iRef.current
            iRef.current = Math.min(
              sampleText.length,
              iRef.current + Math.max(1, Math.ceil(r / 24)),
            )
            setContent(sampleText.slice(0, iRef.current))
            if (iRef.current >= sampleText.length) {
              if (intervalRef.current) clearInterval(intervalRef.current)
              intervalRef.current = null
              setStreaming(false)
              ;(window as unknown as { __STREAM_DONE?: number }).__STREAM_DONE = performance.now()
            }
          }, 16)
        }, MERMAID_HOLD_MS)
      } else if (iRef.current >= sampleText.length && intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        setStreaming(false)
        // eslint-disable-next-line no-console
        console.log('[harness] done, final md len=', sampleText.length)
      }
    }, 16)
  }, [mode])

  useEffect(() => {
    if (mode !== 'lifecycle') return
    samplerRef.current = setInterval(() => {
      if (!startedRef.current) return
      const f = takeFrameSample()
      const w = window as unknown as { __FRAMELOG?: FrameSample[] }
      ;(w.__FRAMELOG ??= []).push(f)
    }, 16)
    return () => {
      if (samplerRef.current) clearInterval(samplerRef.current)
    }
  }, [mode])

  useEffect(() => {
    const t = setTimeout(start, 300)
    return () => {
      clearTimeout(t)
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
  }, [start])

  // 默认模式与既有行为逐字一致(自动启动,16ms 推进)
  useEffect(() => {
    if (mode !== 'smoothness') return
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
  }, [mode])

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
