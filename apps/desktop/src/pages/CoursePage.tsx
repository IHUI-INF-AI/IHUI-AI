import { useEffect, useState } from 'react'
import { getCourses, type Course } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

export default function CoursePage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 12

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getCourses({ page, pageSize, keyword: keyword || undefined })
      if (cancelled) return
      if (res.success) {
        setCourses(res.data.list)
        setTotal(res.data.total)
      } else {
        setError(res.error || '加载失败')
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [page, keyword])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="page page-courses">
      <header className="page-header">
        <h2>课程</h2>
        <div className="header-actions">
          <input
            type="search"
            placeholder="搜索课程..."
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      {loading ? (
        <div className="empty-state">加载中...</div>
      ) : courses.length === 0 ? (
        <div className="empty-state">暂无课程</div>
      ) : (
        <>
          <div className="course-grid">
            {courses.map((c) => (
              <Card key={c.id} className="course-card">
                <CardHeader>
                  <CardTitle>{c.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="course-meta">
                    <span className="instructor">{c.instructor}</span>
                    <span className="level">{c.level}</span>
                  </div>
                  <p className="course-desc">{c.description}</p>
                  <div className="course-footer">
                    <span className="price">
                      {c.isFree ? '免费' : `¥${c.price.toFixed(2)}`}
                    </span>
                    <span className="students">{c.studentCount} 人学过</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {totalPages > 1 ? (
            <div className="pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                上一页
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
