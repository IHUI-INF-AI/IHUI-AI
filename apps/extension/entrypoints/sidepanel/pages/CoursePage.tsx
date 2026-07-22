import { useEffect, useState } from 'react'
import { getCourses, type Course } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { useI18n } from '../../../src/i18n'

export default function CoursePage() {
  const { t } = useI18n()
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
        setError(res.error || t('course.loadFailed'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="empty-state">{t('common.loading')}</div>
  if (error) return <div className="error-banner">{error}</div>

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <h3>{t('course.title')}</h3>
      </div>
      {courses.length === 0 ? (
        <div className="empty-state">{t('course.empty')}</div>
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
                    {c.isFree ? t('course.free') : `¥${c.price.toFixed(2)}`}
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
