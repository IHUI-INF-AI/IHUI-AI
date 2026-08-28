'use client'

import type { RefObject } from 'react'

interface PreviewCanvasProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  srcDoc: string
  currentWidth: number
  showFrame: boolean
  deviceRadius: number
}

export function PreviewCanvas({
  iframeRef,
  srcDoc,
  currentWidth,
  showFrame,
  deviceRadius,
}: PreviewCanvasProps) {
  return (
    <section
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        padding: 8,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: currentWidth,
          margin: '0 auto',
          flex: '1 1 auto',
          minHeight: 0,
          border: '1px solid var(--border)',
          borderRadius: showFrame ? deviceRadius : 8,
          overflow: 'hidden',
          background: 'var(--card)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: showFrame ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
          transition: 'max-width 0.2s ease, border-radius 0.2s ease',
        }}
      >
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          title="design-preview"
          style={{
            flex: 1,
            border: 'none',
            background: 'var(--card)',
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    </section>
  )
}
