// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// Computer Use 浏览器可视化驾驶舱(对标 Claude Computer Use)。
// 通过后端 ai-service 的 /api/computer-use/* 端点族驱动真实 headless Chromium:
// URL 打开 → 交互元素快照 → 点击/输入 → 截图/提取文本/关闭。
// 注意:router 由 master 以 include_router(prefix="/api", tags=["computer-use"]) 挂载。

'use client'

import * as React from 'react'
import {
  Camera,
  CircleX,
  ExternalLink,
  FileText,
  Globe,
  Keyboard,
  Loader2,
  MousePointerClick,
  ScanSearch,
  XCircle,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'

interface SnapshotElement {
  ref: number
  tag: string
  role: string
  name: string
  x?: number
  y?: number
  width?: number
  height?: number
  disabled?: boolean
  checked?: boolean
}

interface OpenInfo {
  url: string
  title: string
  status: string
}

export default function ComputerUsePage() {
  const [url, setUrl] = React.useState('https://www.baidu.com')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [status, setStatus] = React.useState('浏览器未打开')

  const [openInfo, setOpenInfo] = React.useState<OpenInfo | null>(null)
  const [elements, setElements] = React.useState<SnapshotElement[]>([])
  const [screenshot, setScreenshot] = React.useState('')
  const [fullPage, setFullPage] = React.useState(false)
  const [textResult, setTextResult] = React.useState('')

  const [selectedRef, setSelectedRef] = React.useState<number | null>(null)
  const [typeText, setTypeText] = React.useState('')
  const [typeClear, setTypeClear] = React.useState(true)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const body = <T,>(data: T) => ({ body: JSON.stringify(data) })

  const openPage = () =>
    run(async () => {
      const res = await fetchApi<OpenInfo>('/api/computer-use/open', {
        method: 'POST',
        ...body({ url: url.trim() }),
      })
      if (!res.success) {
        setError((res as { message?: string }).message || '打开失败')
        return
      }
      setOpenInfo(res.data)
      setStatus(`已打开:${res.data.title || res.data.url}`)
      setScreenshot('')
      setTextResult('')
      await refreshSnapshot()
    })

  const refreshSnapshot = async () => {
    const res = await fetchApi<{ url: string; count: number; elements: SnapshotElement[] }>(
      '/api/computer-use/snapshot',
    )
    if (res.success && res.data) {
      setElements(res.data.elements || [])
      setStatus(`快照 ${res.data.count} 个可交互元素`)
    }
  }

  const takeScreenshot = () =>
    run(async () => {
      const res = await fetchApi<{ screenshot: string; full_page: boolean }>(
        `/api/computer-use/screenshot${fullPage ? '?full_page=true' : ''}`,
      )
      if (!res.success || !res.data?.screenshot) {
        setError((res as { message?: string }).message || '截图失败')
        return
      }
      setScreenshot(`data:image/png;base64,${res.data.screenshot}`)
      setStatus(fullPage ? '已截图(整页)' : '已截图(视口)')
    })

  const extractText = () =>
    run(async () => {
      const res = await fetchApi<{ text: string; length: number }>('/api/computer-use/extract-text', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (!res.success || !res.data) {
        setError((res as { message?: string }).message || '提取失败')
        return
      }
      setTextResult(res.data.text || '(无可提取文本)')
      setStatus(`已提取文本 ${res.data.length} 字`)
    })

  const closeBrowser = () =>
    run(async () => {
      const res = await fetchApi<{ ok: boolean }>('/api/computer-use/close', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setOpenInfo(null)
      setElements([])
      setScreenshot('')
      setTextResult('')
      setSelectedRef(null)
      setStatus(res.success ? '浏览器已关闭' : '关闭返回失败,请重试')
    })

  const clickElement = (el: SnapshotElement) =>
    run(async () => {
      const res = await fetchApi<{ ok: boolean }>('/api/computer-use/click', {
        method: 'POST',
        ...body({ ref: el.ref }),
      })
      if (!res.success) {
        setError((res as { message?: string }).message || '点击失败')
        return
      }
      setStatus(`已点击 ref=${el.ref}`)
      await refreshSnapshot()
    })

  const typeIntoSelected = () =>
    run(async () => {
      if (selectedRef === null) {
        setError('请先在快照列表中选择一个元素')
        return
      }
      if (!typeText.trim()) return
      const res = await fetchApi<{ ok: boolean }>('/api/computer-use/type', {
        method: 'POST',
        ...body({ ref: selectedRef, text: typeText, clear: typeClear }),
      })
      if (!res.success) {
        setError((res as { message?: string }).message || '输入失败')
        return
      }
      setStatus(`已输入到 ref=${selectedRef}`)
      setTypeText('')
      await refreshSnapshot()
    })

  const selectRef = (ref: number) => {
    setSelectedRef((prev) => (prev === ref ? null : ref))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Globe className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Computer Use 可视化驾驶舱</h1>
      </div>

      {/* 打开区 */}
      <div className="mb-6 rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && openPage()}
            placeholder="输入要打开的 URL,例如 https://www.baidu.com"
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={openPage}
            disabled={busy || !url.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            打开
          </button>
        </div>

        {/* 状态 / 工具行 */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span
              className={
                openInfo
                  ? 'h-2 w-2 rounded-full bg-emerald-500'
                  : 'h-2 w-2 rounded-full bg-muted-foreground'
              }
            />
            {status}
          </span>
          <span className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={takeScreenshot}
              disabled={busy || !openInfo}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-accent disabled:opacity-40"
            >
              <Camera className="h-3.5 w-3.5" /> 截图
            </button>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={fullPage} onChange={(e) => setFullPage(e.target.checked)} />
              整页
            </label>
            <button
              onClick={extractText}
              disabled={busy || !openInfo}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-accent disabled:opacity-40"
            >
              <FileText className="h-3.5 w-3.5" /> 提取文本
            </button>
            <button
              onClick={() => refreshSnapshot()}
              disabled={busy || !openInfo}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-accent disabled:opacity-40"
            >
              <ScanSearch className="h-3.5 w-3.5" /> 刷新快照
            </button>
            <button
              onClick={closeBrowser}
              disabled={busy || !openInfo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
            >
              <CircleX className="h-3.5 w-3.5" /> 关闭
            </button>
          </span>
        </div>
        {openInfo && (
          <p className="mt-2 truncate text-xs text-muted-foreground">
            <code>{openInfo.url}</code>
          </p>
        )}
        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
            <XCircle className="h-4 w-4" /> {error}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 截图预览 */}
        <div className="rounded-xl border p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Camera className="h-4 w-4" /> 页面截图
          </h2>
          {screenshot ? (
            <img src={screenshot} alt="页面截图" className="w-full rounded-lg border bg-muted" />
          ) : (
            <div className="flex h-52 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              点击「截图」查看当前页预览
            </div>
          )}
        </div>

        {/* 输入操作 */}
        <div className="rounded-xl border p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Keyboard className="h-4 w-4" /> 输入文本
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            目标元素:
            {selectedRef === null ? (
              <span className="text-muted-foreground"> 未选择(请在下表点击选中)</span>
            ) : (
              <code className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                ref={selectedRef}
              </code>
            )}
          </p>
          <textarea
            value={typeText}
            onChange={(e) => setTypeText(e.target.value)}
            rows={3}
            placeholder="输入要填入的内容…"
            className="w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={typeClear}
                onChange={(e) => setTypeClear(e.target.checked)}
              />
              输入前清空
            </label>
            <button
              onClick={typeIntoSelected}
              disabled={busy || !openInfo || !typeText.trim()}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              <Keyboard className="h-4 w-4" /> 输入
            </button>
          </div>
        </div>
      </div>

      {/* 快照列表 */}
      <div className="mt-6 rounded-xl border p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <MousePointerClick className="h-4 w-4" /> 可交互元素快照({elements.length})
        </h2>
        {elements.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            {openInfo ? '点击「刷新快照」加载元素' : '先打开一个页面,再刷新快照'}
          </div>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {elements.map((el) => (
              <li
                key={el.ref}
                onClick={() => selectRef(el.ref)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  selectedRef === el.ref
                    ? 'border-primary bg-primary/10'
                    : 'hover:bg-accent/60'
                }`}
              >
                <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">{el.ref}</code>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs uppercase">
                  {el.tag || 'element'}
                </span>
                {el.role && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {el.role}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{el.name || '(无文字)'}</span>
                {el.checked && <span className="shrink-0 text-xs text-emerald-600">✓已勾选</span>}
                {el.disabled && <span className="shrink-0 text-xs text-muted-foreground">禁用</span>}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    clickElement(el)
                  }}
                  disabled={busy || el.disabled}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-medium transition hover:bg-accent/80 disabled:opacity-40"
                >
                  <MousePointerClick className="h-3 w-3" /> 点击
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 提取文本结果 */}
      {textResult && (
        <div className="mt-6 rounded-xl border p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4" /> 提取文本
          </h2>
          <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs leading-relaxed">
            {textResult}
          </pre>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
