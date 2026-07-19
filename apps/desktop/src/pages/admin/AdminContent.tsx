/**
 * AdminContent — 内容运营总览(4 个子模块:AI 生成内容 / 轮播图 / 评论 / 资讯)。
 *
 * 单页内嵌 4 个子区块 + Tab 切换,每个区块独立调一个 admin-content 端点;
 * 复用 Card + Table,变更操作去 web 后台。
 */
import { useEffect, useState } from 'react'
import {
  listAiGc,
  listCarousel,
  listAdminComments,
  listNewsInformation,
  type PageData,
} from '@ihui/api-client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ihui/ui'

type Section = 'ai-gc' | 'carousel' | 'comments' | 'news'

const SECTION_LABEL: Record<Section, string> = {
  'ai-gc': 'AI 生成内容',
  carousel: '轮播图',
  comments: '评论',
  news: '资讯文章',
}

function asRows<T extends { id: string | number }>(data: PageData<T> | undefined): T[] {
  return data?.list ?? []
}

function TableView<T extends { id: string | number; createdAt?: string }>({
  rows,
  empty,
  columns,
}: {
  rows: T[]
  empty: string
  columns: { header: string; render: (row: T) => string }[]
}) {
  if (rows.length === 0) return <div className="empty-state">{empty}</div>
  return (
    <table className="admin-table">
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={i}>{c.header}</th>
          ))}
          <th>创建时间</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r.id)}>
            {columns.map((c, i) => (
              <td key={i}>{c.render(r)}</td>
            ))}
            <td className="admin-muted">
              {r.createdAt
                ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(r.createdAt))
                : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function AdminContent() {
  const [section, setSection] = useState<Section>('ai-gc')
  const [aiGc, setAiGc] = useState<PageData<{ id: string | number; createdAt?: string; [k: string]: unknown }>>()
  const [carousel, setCarousel] = useState<PageData<{ id: string | number; createdAt?: string; [k: string]: unknown }>>()
  const [comments, setComments] = useState<PageData<{ id: string | number; createdAt?: string; [k: string]: unknown }>>()
  const [news, setNews] = useState<PageData<{ id: string | number; createdAt?: string; [k: string]: unknown }>>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    void (async () => {
      const [a, c, m, n] = await Promise.all([
        listAiGc({ page: 1, pageSize: 10 }),
        listCarousel({ page: 1, pageSize: 10 }),
        listAdminComments({ page: 1, pageSize: 10 }),
        listNewsInformation({ page: 1, pageSize: 10 }),
      ])
      if (a.success) setAiGc(a.data)
      if (c.success) setCarousel(c.data)
      if (m.success) setComments(m.data)
      if (n.success) setNews(n.data)
      setLoading(false)
    })()
  }, [])

  return (
    <div className="admin-page" data-testid="admin-content">
      <header className="admin-page-header">
        <h2>内容运营</h2>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>子模块一览</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={section} onValueChange={(v) => setSection(v as Section)}>
            <TabsList>
              {(Object.keys(SECTION_LABEL) as Section[]).map((s) => (
                <TabsTrigger key={s} value={s} data-testid={`admin-content-tab-${s}`}>
                  {SECTION_LABEL[s]}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="ai-gc">
              {loading ? (
                <div className="empty-state">加载中...</div>
              ) : (
                <TableView
                  rows={asRows(aiGc)}
                  empty="暂无 AI 生成内容"
                  columns={[
                    { header: 'ID', render: (r) => String(r.id) },
                    { header: '标题', render: (r) => String((r as { title?: string }).title ?? '—') },
                  ]}
                />
              )}
            </TabsContent>
            <TabsContent value="carousel">
              {loading ? (
                <div className="empty-state">加载中...</div>
              ) : (
                <TableView
                  rows={asRows(carousel)}
                  empty="暂无轮播图"
                  columns={[
                    { header: 'ID', render: (r) => String(r.id) },
                    { header: '标题', render: (r) => String((r as { title?: string }).title ?? '—') },
                  ]}
                />
              )}
            </TabsContent>
            <TabsContent value="comments">
              {loading ? (
                <div className="empty-state">加载中...</div>
              ) : (
                <TableView
                  rows={asRows(comments)}
                  empty="暂无评论"
                  columns={[
                    { header: 'ID', render: (r) => String(r.id) },
                    { header: '内容', render: (r) => String((r as { content?: string }).content ?? '—').slice(0, 60) },
                  ]}
                />
              )}
            </TabsContent>
            <TabsContent value="news">
              {loading ? (
                <div className="empty-state">加载中...</div>
              ) : (
                <TableView
                  rows={asRows(news)}
                  empty="暂无资讯"
                  columns={[
                    { header: 'ID', render: (r) => String(r.id) },
                    { header: '标题', render: (r) => String((r as { title?: string }).title ?? '—') },
                  ]}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
