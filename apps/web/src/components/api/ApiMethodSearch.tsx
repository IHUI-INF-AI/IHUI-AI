// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { SearchInput } from '@ihui/ui-react'
import { PortalPanel } from '@/components/feedback/portal-panel'

export interface ApiMethod {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  group?: string
}

export interface ApiMethodSearchProps {
  methods?: ApiMethod[]
  onSelect?: (m: ApiMethod) => void
  placeholder?: string
  className?: string
}

const METHOD_COLOR: Record<ApiMethod['method'], string> = {
  GET: 'bg-emerald-500/10 text-emerald-600',
  POST: 'bg-blue-500/10 text-blue-600',
  PUT: 'bg-amber-500/10 text-amber-600',
  DELETE: 'bg-destructive/10 text-destructive',
  PATCH: 'bg-purple-500/10 text-purple-600',
}

export default function ApiMethodSearch({
  methods = [],
  onSelect,
  placeholder = '搜索 API 方法...',
  className,
}: ApiMethodSearchProps): React.JSX.Element {
  const [q, setQ] = React.useState('')
  const [focus, setFocus] = React.useState(false)
  const boxRef = React.useRef<HTMLDivElement>(null)
  // PortalPanel 面板与搜索框同宽(原 w-full)需同步锚点宽度
  const [anchorWidth, setAnchorWidth] = React.useState(0)

  const filtered = q
    ? methods.filter(
        (m) =>
          m.name.toLowerCase().includes(q.toLowerCase()) ||
          m.path.toLowerCase().includes(q.toLowerCase()) ||
          m.group?.toLowerCase().includes(q.toLowerCase()),
      )
    : methods

  const showList = focus && filtered.length > 0

  React.useLayoutEffect(() => {
    if (!showList) return
    const el = boxRef.current
    if (!el) return
    const sync = () => setAnchorWidth(el.offsetWidth)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [showList])

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <SearchInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        placeholder={placeholder}
        size="lg"
        clearable
        clearAriaLabel="清空搜索"
        wrapperClassName="w-full"
      />
      {showList && (
        <PortalPanel
          open={showList}
          anchorRef={boxRef}
          onClose={() => setFocus(false)}
          side="bottom"
          align="start"
          gap={4}
          style={anchorWidth ? { width: anchorWidth } : undefined}
          className="max-h-72 overflow-auto rounded-md border bg-popover shadow-lg"
        >
          <ul className="w-full">
            {filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect?.(m)
                    setFocus(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-xs font-medium',
                      METHOD_COLOR[m.method],
                    )}
                  >
                    {m.method}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  {m.group && (
                    <span className="shrink-0 text-xs text-muted-foreground">{m.group}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </PortalPanel>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
