'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTagsViewStore, type TagItem } from '@/stores/tags-view'
import { Dropdown } from '@/components/feedback'

function deriveTitle(pathname: string): string {
  if (!pathname || pathname === '/') return '首页'
  const seg = pathname.split('/').filter(Boolean).pop() ?? pathname
  try {
    return decodeURIComponent(seg)
  } catch {
    return seg
  }
}

function buildQuery(search: URLSearchParams | null): Record<string, string> | undefined {
  if (!search) return undefined
  const obj: Record<string, string> = {}
  search.forEach((v, k) => {
    obj[k] = v
  })
  return Object.keys(obj).length ? obj : undefined
}

function buildHref(tag: TagItem): string {
  if (!tag.query) return tag.path
  const sp = new URLSearchParams(tag.query)
  const qs = sp.toString()
  return qs ? `${tag.path}?${qs}` : tag.path
}

export function TagsView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const tags = useTagsViewStore((s) => s.tags)
  const activePath = useTagsViewStore((s) => s.activePath)
  const addTag = useTagsViewStore((s) => s.addTag)
  const removeTag = useTagsViewStore((s) => s.removeTag)
  const closeOther = useTagsViewStore((s) => s.closeOther)
  const closeAll = useTagsViewStore((s) => s.closeAll)

  React.useEffect(() => {
    if (!pathname) return
    addTag({
      path: pathname,
      title: deriveTitle(pathname),
      query: buildQuery(searchParams),
    })
  }, [pathname, searchParams, addTag])

  const handleClose = (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    e.stopPropagation()
    const willNavigate = path === activePath
    removeTag(path)
    if (willNavigate) {
      const next = useTagsViewStore.getState().activePath
      if (next) router.push(next)
      else router.push('/')
    }
  }

  if (tags.length === 0) return null

  return (
    <div className="flex h-9 items-center gap-1 bg-muted/40 px-2">
      <div className="thin_scroll flex flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap">
        {tags.map((tag) => {
          const active = tag.path === activePath
          return (
            <Link
              key={tag.path}
              href={buildHref(tag)}
              className={cn(
                'group inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs transition-colors',
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span>{tag.title}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => handleClose(e, tag.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleClose(e as unknown as React.MouseEvent, tag.path)
                  }
                }}
                className={cn(
                  'inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors',
                  'hover:bg-destructive/10 hover:text-destructive',
                  active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
                aria-label="关闭标签"
              >
                <X className="h-3 w-3" />
              </span>
            </Link>
          )
        })}
      </div>
      {tags.length > 0 && (
        <Dropdown
          align="end"
          items={[
            { key: 'other', label: '关闭其他', onSelect: () => closeOther(activePath ?? '') },
            { key: 'all', label: '关闭全部', onSelect: () => closeAll() },
          ]}
          trigger={
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="更多操作"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          }
        />
      )}
    </div>
  )
}

export default TagsView
