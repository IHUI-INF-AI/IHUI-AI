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
 * 时序纪律:mode 由 mount 后的 query 定位(初值 pending);两条 auto-start 通道都过
 *   pending 闸,避免同一 commit 里 smoothness 通道抢跑占掉 startedRef(2026-10-29 实跑踩过:
 *   lifecycle 永远等不到 __STREAM_DONE)。
 * 生产无关:本路由不参与任何业务,仅 e2e 使用。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { MarkdownStream } from '@/components/ai/markdown-stream'

// 驱动器遇此字符(U+2063,零宽不可见)停在当前拍,等 mermaid 真出图再续揭示 ——
// 事件驱动(100ms 轮询工具条在场,30s 兜底超时):固定 4s/8s 在 dev 首渲
// (chunk 现场编译 + initialize + 布局)前都是赌,⑨ 判别力守卫两次实测被它击穿。
// 出图后由"紧随其后的段落"逼晋升 —— 档⑨的重挂台账路径必须"曾出过图"才有判别力。
const PAUSE_MARK = '\u2063'
const MERMAID_READY_POLL_MS = 100
const MERMAID_READY_TIMEOUT_MS = 30000

/**
 * 帧读数(全读 live DOM,不依赖组件内部结构):
 * h = 在场围栏块(code-block-header 的 frame 壳)高度序列 —— 顺序即 DOM 序;
 * l = 各块显示文本行数 —— 折叠复位的真判据(高度会因 react-syntax-highlighter
 *     懒加载 chunk 与 fallback 的行高差正常跳变,行数不会;2026-10-29 实跑分辨出这两型);
 * a = 代码块"应用到文件"按钮数(完成态外观代理);
 * g = mermaid 缩放工具条在场数(出图成功态独有);
 * p = 渲染中占位在场(animate-pulse 壳,走 DOM 不依赖文案语言);
 * t = 宿主纯文本长度。
 */
interface FrameSample {
  ts: number
  h: number[]
  l: number[]
  a: number
  g: number
  p: boolean
  t: number
  s: string[]
}

function takeFrameSample(): FrameSample {
  const host = document.querySelector('[data-testid="markdown-stream"]')
  // 晋升 commit 瞬间同一块会新旧双头并存 —— 按头文本(文件名)去重,保 index 对齐稳定
  const seen = new Set<string>()
  const heads = Array.from(document.querySelectorAll('[data-testid="code-block-header"]')).filter(
    (e) => {
      const k = e.textContent ?? ''
      if (seen.has(k)) return false
      seen.add(k)
      return true
    },
  )
  return {
    ts: performance.now(),
    h: heads.map((e) => Math.round(e.parentElement?.getBoundingClientRect().height ?? 0)),
    // 行数判据必须用 innerText 而非 textContent:高亮版每行是独立 div,
    // textContent 拼行不含换行(plain 7 行 → 高亮 1 行的假塌缩,2026-10-29 实跑分辨);
    // innerText 按块级布局折行,plain/高亮两态行数同真值。
    l: heads.map(
      (e) => (e.parentElement?.innerText ?? '').split('\n').filter((x) => x.trim() !== '').length,
    ),
    a: document.querySelectorAll('[data-testid="apply-to-file-button"]').length,
    g: document.querySelectorAll('[data-testid="mermaid-zoom-toolbar"]').length,
    p: !!host?.querySelector('div.animate-pulse'),
    t: (host?.textContent ?? '').length,
    // 每块 innerText 前 80 字快照(塌缩帧归因直读形态;300 帧 × 3 块量级可忽略)
    s: heads.map((e) => (e.parentElement?.innerText ?? '').slice(0, 80)),
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
    // repeat(20):总长必须越过 1500 切分阈值(MARKDOWN_SPLIT_MIN_LENGTH),否则
    // stable/active 永不启用、"晋升 remount"这条腿空转 —— 2026-10-29 首跑踩实:
    // 样本 ~810 字时守门量到的塌缩根本不是晋升路径,判据形同虚设。
    para.repeat(20) +
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
  const [mode, setMode] = useState<'pending' | 'smoothness' | 'lifecycle'>('pending')
  const [content, setContent] = useState('')
  const [streaming, setStreaming] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const samplerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const iRef = useRef(0)
  const startedRef = useRef(false)

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('mode')
    setMode(m === 'lifecycle' ? 'lifecycle' : 'smoothness')
  }, [])

  const stopAll = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
  }, [])

  const finish = useCallback(
    (label: string, len: number) => {
      stopAll()
      setStreaming(false)
      // eslint-disable-next-line no-console
      console.log(`[harness] ${label}, final md len=`, len)
    },
    [stopAll],
  )

  /** lifecycle 驱动器:几何揭示 + PAUSE_MARK 停幅;停笔置 __STREAM_DONE */
  const startLifecycle = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    setStreaming(true)
    // 预热 mermaid chunk(dev 模式动态 chunk 首次 import 触发现场编译,给真渲染让路)
    void import('mermaid').catch(() => {})
    const stepFn = () => {
      const prev = iRef.current
      const remaining = LIFECYCLE_SAMPLE.length - iRef.current
      const chunk = Math.max(1, Math.ceil(remaining / 24))
      iRef.current = Math.min(LIFECYCLE_SAMPLE.length, iRef.current + chunk)
      setContent(LIFECYCLE_SAMPLE.slice(0, iRef.current))
      if (iRef.current >= LIFECYCLE_SAMPLE.length) {
        finish('done', LIFECYCLE_SAMPLE.length)
        ;(window as unknown as { __STREAM_DONE?: number }).__STREAM_DONE = performance.now()
        return
      }
      // 标记判据 = "本拍推进范围内含 PAUSE"(大 chunk 一拍跨过标记时,只查末位会漏停:
      // 2026-10-29 实跑,漏停 ⇒ B 块先于出图到场,⑨ 判别力守卫当场翻红 —— 守门自证生效)
      const markAt = LIFECYCLE_SAMPLE.indexOf(PAUSE_MARK, prev)
      if (markAt >= 0 && markAt < iRef.current) {
        // 事件驱动停幅:mermaid 出图(缩放工具条在场)才续揭示;30s 兜底防死等
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = null
        const waitStart = performance.now()
        holdTimerRef.current = setInterval(() => {
          const ready = !!document.querySelector('[data-testid="mermaid-zoom-toolbar"]')
          if (!ready && performance.now() - waitStart < MERMAID_READY_TIMEOUT_MS) return
          if (holdTimerRef.current) clearInterval(holdTimerRef.current)
          holdTimerRef.current = null
          // eslint-disable-next-line no-console
          console.log('[harness] mermaid hold released ready=', ready)
          intervalRef.current = setInterval(stepFn, 16)
        }, MERMAID_READY_POLL_MS)
      }
    }
    intervalRef.current = setInterval(stepFn, 16)
  }, [finish])

  /** smoothness 驱动器(与 2026-10-28 立时逐字同) */
  const startSmoothness = useCallback(() => {
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
        // 末尾翻转:模拟流式结束,验证 active→stable 零重排
        finish('done', SAMPLE.length)
      }
    }, 16)
  }, [finish])

  // 时间线采样器只在 lifecycle 腿工作(两腿都从流开始的拍采起)
  useEffect(() => {
    if (mode !== 'lifecycle') return
    if (!startedRef.current) {
      // 采样与驱动同步启动:auto-start effect 先于本 effect? 不赌顺序,自起自停
    }
    samplerRef.current = setInterval(() => {
      if (!startedRef.current) return
      const f = takeFrameSample()
      const w = window as unknown as { __FRAMELOG?: FrameSample[] }
      ;(w.__FRAMELOG ??= []).push(f)
    }, 16)
    return () => {
      if (samplerRef.current) clearInterval(samplerRef.current)
      samplerRef.current = null
    }
  }, [mode])

  // 统一 auto-start:mode 定位后 300ms 起跑(pending 不放行,防 smoothness 抢跑)
  useEffect(() => {
    if (mode === 'pending') return
    const fn = mode === 'lifecycle' ? startLifecycle : startSmoothness
    const t = setTimeout(fn, 300)
    return () => clearTimeout(t)
  }, [mode, startLifecycle, startSmoothness])

  useEffect(() => stopAll, [stopAll])

  const start = () => {
    if (mode === 'lifecycle') startLifecycle()
    else if (mode === 'smoothness') startSmoothness()
  }

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
