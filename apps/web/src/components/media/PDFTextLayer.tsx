'use client'

import * as React from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyPdfPage = any
type AnyPdfLib = any

interface TextItemShape {
  str: string
  transform: number[]
  width: number
  height: number
  fontName?: string
}

interface PositionedText {
  key: number
  str: string
  left: number
  top: number
  fontSize: number
  expectedWidth: number
  fontFamily: string
}

interface PDFTextLayerProps {
  pdfPage: AnyPdfPage
  pdfjs: AnyPdfLib
  viewportWidth: number
  viewportHeight: number
  viewportTransform: number[]
  scale: number
  visible: boolean
}

export function PDFTextLayer({
  pdfPage,
  pdfjs,
  viewportWidth,
  viewportHeight,
  viewportTransform,
  scale,
  visible,
}: PDFTextLayerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [positioned, setPositioned] = React.useState<PositionedText[]>([])

  React.useEffect(() => {
    if (!visible) {
      setPositioned([])
      return
    }
    let cancelled = false
    pdfPage
      .getTextContent()
      .then((content: any) => {
        if (cancelled) return
        const rawItems = (content?.items ?? []) as TextItemShape[]
        const styles = (content?.styles ?? {}) as Record<string, { fontFamily?: string }>
        const result: PositionedText[] = []
        rawItems.forEach((item, idx) => {
          if (typeof item.str !== 'string' || item.str.length === 0) return
          const tx = pdfjs.Util.transform(viewportTransform, item.transform)
          const fontHeight = Math.hypot(tx[2], tx[3]) || item.height * scale
          const styleEntry = item.fontName ? styles[item.fontName] : undefined
          const fontFamily = styleEntry?.fontFamily || 'sans-serif'
          result.push({
            key: idx,
            str: item.str,
            left: tx[4],
            top: tx[5] - fontHeight,
            fontSize: fontHeight,
            expectedWidth: item.width * scale,
            fontFamily,
          })
        })
        if (!cancelled) setPositioned(result)
      })
      .catch(() => {
        if (!cancelled) setPositioned([])
      })
    return () => {
      cancelled = true
    }
  }, [pdfPage, pdfjs, viewportTransform, scale, visible])

  React.useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const spans = container.querySelectorAll<HTMLElement>('[data-text-span]')
    spans.forEach((span) => {
      const expected = Number(span.dataset.expectedWidth)
      const actual = span.offsetWidth
      if (actual > 0 && expected > 0) {
        span.style.transform = `scaleX(${expected / actual})`
      }
    })
  }, [positioned])

  if (!visible) return null

  return (
    <div
      ref={containerRef}
      className="pdf-text-layer pointer-events-auto absolute left-0 top-0 z-[5] select-text overflow-hidden"
      style={{ width: viewportWidth, height: viewportHeight }}
    >
      {positioned.map((t) => (
        <span
          key={t.key}
          data-text-span
          data-expected-width={t.expectedWidth}
          style={{
            position: 'absolute',
            left: `${t.left}px`,
            top: `${t.top}px`,
            fontSize: `${t.fontSize}px`,
            fontFamily: t.fontFamily,
            color: 'transparent',
            whiteSpace: 'pre',
            lineHeight: 1,
            margin: '0',
            padding: '0',
            transformOrigin: '0 0',
          }}
        >
          {t.str}
        </span>
      ))}
    </div>
  )
}
/* eslint-enable @typescript-eslint/no-explicit-any */
