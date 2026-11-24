// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { FileText } from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import { type DocSummary, excerptFromContent } from '@/lib/content'

/**
 * 「已发布文档」板块 —— 文档中心首页唯一读数据库的那一格。
 *
 * 数据源判据(现读,勿凭票面旧文改端点):
 * - `GET /api/docs` = 公开档,`apps/api/src/routes/content.ts:394`(注册前缀见 `routes/index.ts:625`),
 *   handler 内 `findDocs(category)` → `apps/api/src/db/content-queries.ts:327` 的判据是
 *   `where status='published'`,排序 `sortOrder ASC, createdAt DESC`;响应 `{ code:0, message:'success',
 *   data:{ list } }`(`utils/response.ts:22`),`apiOrThrow` 已剥信封,故这里拿到的就是 `{ list }`。
 * - 不用 `content.ts:742`(那是 `/api/admin/docs`,`adminContentRoutes` 的 `requireAdmin` preHandler,
 *   含未发布,游客调它必然 401);不用 `misc-extended.ts:338` 的 `/docs/list`(status 需显式传参、
 *   默认不过滤 published,且按 createdAt 排,与单篇腿 `/api/docs/:slug`(`content.ts:427`)不同源)。
 * - 取数一律走 `@/lib/api` 的 `apiOrThrow`(web 端单源壳,内含 401→登录弹窗与续期语义),
 *   不在端内裸 fetch,故门 `check-direct-backend-calls.mjs` 射程外。
 *
 * 三态严格分离(票面验收:空态不占版面、未判定不得伪装成空态):
 * - pending(还没取到)⇒ 整块不渲染,不留骨架位;
 * - error / 信封形状不对 ⇒ 渲染错误态,**绝不**回落成空列表;
 * - 已取到且 list 为空 ⇒ 整块返回 null(后台尚未发布任何文档时首页不长出空板块)。
 */

/** 首页板块最多展示条数;超出部分不渲染(文档中心首页不是列表页,单篇一律走 /docs/<slug>) */
const MAX_ITEMS = 8

/** 后端 data.list 的形状守卫:不是数组就抛,交给错误态,不当成「没有文档」。 */
function pickList(payload: unknown): DocSummary[] {
  const list = (payload as { list?: unknown } | null | undefined)?.list
  if (!Array.isArray(list)) throw new Error('GET /api/docs 返回的 data.list 不是数组')
  return list as DocSummary[]
}

/** 列表项文案取自 docs 表正文派生摘要(`@/lib/content` 既有出口,不在端内重抄一份剥离算法)。 */
function summaryOf(doc: DocSummary): string {
  return doc.summary?.trim() || excerptFromContent(doc.content)
}

export function PublishedDocsSection() {
  const tc = useTranslations('common')
  const td = useTranslations('docs')
  const { data, isError } = useQuery({
    queryKey: ['docs-published'],
    queryFn: async () => pickList(await apiOrThrow<unknown>('/api/docs')),
    retry: false,
    staleTime: 60_000,
  })

  if (isError) {
    return (
      <div className="col-span-full rounded-lg border border-border bg-card p-3">
        <p className="font-[weight:inherit] py-3 text-center text-body text-muted-foreground">{tc('errorTitle')}</p>
      </div>
    )
  }

  const docs = data ?? []
  if (docs.length === 0) return null

  return (
    <section className="col-span-full rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="font-[weight:inherit] text-display">
          <FileText className="h-6 w-6" />
        </span>
        <h2 className="text-lg font-semibold">{td('shellTitle')}</h2>
      </div>
      <p className="font-[weight:inherit] mt-1 text-label text-muted-foreground">{td('shellSubtitle')}</p>
      <ul className="mt-4 space-y-3">
        {docs.slice(0, MAX_ITEMS).map((doc) => {
          const summary = summaryOf(doc)
          return (
            <li key={doc.slug}>
              <Link
                href={`/docs/${encodeURIComponent(doc.slug)}`}
                className="block rounded-lg border bg-background p-3 transition-colors hover:bg-accent"
              >
                <div className="font-medium text-body">{doc.title}</div>
                {summary && <div className="font-[weight:inherit] text-label text-muted-foreground">{summary}</div>}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
