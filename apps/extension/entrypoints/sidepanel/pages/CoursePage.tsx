import { useEffect, useState } from 'react'
import { getCourses, type Course } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

export default function CoursePage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getCourses({ page: 1, pageSize: 10 })
      if (cancelled) return
      if (res.success) {
        setCourses(res.data.list)
      } else {
        setError(res.error || '加载失败')
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="empty-state">加载中...</div>
  if (error) return <div className="error-banner">{error}</div>

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <h3>课程</h3>
      </div>
      {courses.length === 0 ? (
        <div className="empty-state">暂无课程</div>
      ) : (
        <div className="sp-course-list">
          {courses.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle>{c.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="sp-course-meta">
                  <span>{c.instructor}</span>
                  <span className="sp-course-price">
                    {c.isFree ? '免费' : `¥${c.price.toFixed(2)}`}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
