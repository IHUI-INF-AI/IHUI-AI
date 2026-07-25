'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, ChevronDown, Package, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

// 2026-07-25 P2 治理:resource_products.pid 自引用列 + GET /api/admin/resources/products/tree
// 该页面为产品树形分类只读视图(完整 CRUD 在 /admin/resources/products)
interface ProductTreeNode {
  id: string
  name: string
  price: string
  resourceId: string
  pid: string | null
  sort: number
  status: number
  isPublished: boolean
  children: ProductTreeNode[]
}

interface TreeData {
  tree: ProductTreeNode[]
  total: number
}

async function fetchTree(): Promise<TreeData> {
  const r = await fetchApi<TreeData>('/api/admin/resources/products/tree')
  if (!r.success) throw new Error(r.error)
  return r.data
}

function TreeRow({ node, depth }: { node: ProductTreeNode; depth: number }) {
  const t = useTranslations('admin.resources')
  const [open, setOpen] = React.useState(true)
  const hasChildren = node.children.length > 0
  return (
    <>
      <div
        className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted/40"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted"
            aria-label={open ? 'collapse' : 'expand'}
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="inline-block h-5 w-5" />
        )}
        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-medium">{node.name}</span>
        <span className="text-sm tabular-nums text-muted-foreground">¥{Number(node.price)}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
            node.isPublished
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              node.isPublished ? 'bg-emerald-500' : 'bg-muted-foreground',
            )}
          />
          {node.isPublished ? t('published') : t('unpublished')}
        </span>
        <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
          {node.sort}
        </span>
      </div>
      {hasChildren &&
        open &&
        node.children.map((child) => <TreeRow key={child.id} node={child} depth={depth + 1} />)}
    </>
  )
}

export default function AdminProductCategoriesPage() {
  const t = useTranslations('admin.resources')
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'resources', 'products', 'tree'],
    queryFn: fetchTree,
  })

  const tree = data?.tree ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('productsTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('productsSubtitle')}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/resources">
            <ChevronLeft className="h-4 w-4" />
            {t('backToResources')}
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card px-4 py-2.5 text-sm text-muted-foreground">
        {t('total', { total })}
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="px-4 py-10 text-center text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : error ? (
          <div className="px-4 py-10 text-center text-destructive">{(error as Error).message}</div>
        ) : tree.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
            {t('noData')}
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {tree.map((node) => (
              <TreeRow key={node.id} node={node} depth={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
