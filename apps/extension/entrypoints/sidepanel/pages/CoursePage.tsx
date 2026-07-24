import { useEffect, useState } from 'react'
import { getCourses, type Course } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
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
  }, [t])

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">
        {t('common.loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive m-2 text-xs">
        {error}
      </div>
    )
  }

  return (
    <div className="p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('course.title')}</h3>
      </div>
      {courses.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('course.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {courses.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle>{c.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{c.instructor}</span>
                  <span className="text-primary font-semibold">
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
