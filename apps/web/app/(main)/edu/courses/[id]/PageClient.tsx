'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, Users, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Alert } from '@/components/feedback'
import { Breadcrumb } from '@/components/layout'
import { CourseVideo } from '@/components/course/CourseVideo'
import { CourseInteraction } from '@/components/course/CourseInteraction'
import { CourseChapters, type Chapter, type Section } from '@/components/course/CourseChapters'
import { CourseTabs, type CourseTabData } from '@/components/course/CourseTabs'

interface CourseDetail {
  id: string
  title: string
  instructor: string
  description: string
  duration?: string
  students: number
  cover?: string
  objectives?: string[]
  chapters?: Chapter[]
  progress?: number
  level?: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduCourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [currentSection, setCurrentSection] = React.useState<Section | null>(null)
  const [currentChapterId, setCurrentChapterId] = React.useState<string>()

  const {
    data: course,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['edu', 'course', id],
    queryFn: () => api<CourseDetail>(`/api/edu/courses/${id}`),
  })

  const handleSelectSection = (section: Section) => {
    setCurrentSection(section)
    const chapter = course?.chapters?.find((c) => c.sections.some((s) => s.id === section.id))
    setCurrentChapterId(chapter?.id)
  }

  React.useEffect(() => {
    if (course?.chapters?.length && !currentSection) {
      const firstChapter = course.chapters[0]
      const first = firstChapter?.sections?.[0]
      if (first) {
        setCurrentSection(first)
        setCurrentChapterId(firstChapter?.id)
      }
    }
  }, [course, currentSection])

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )

  if (error || !course) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push('/edu/courses')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回课程列表
        </button>
        <Alert variant="danger" description={(error as Error)?.message ?? '课程不存在'} />
      </div>
    )
  }

  const chapters = course.chapters ?? []
  const tabData: CourseTabData = {
    id: course.id,
    title: course.title,
    description: course.description,
    instructor: course.instructor,
    objectives: course.objectives,
    level: course.level,
  }

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: '首页', href: '/' },
          { label: '课程', href: '/edu/courses' },
          { label: course.title || '详情' },
        ]}
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-3">
          <CourseVideo
            src={currentSection?.videoUrl}
            poster={course.cover}
            title={currentSection?.title}
            courseId={id}
            chapterId={currentChapterId}
          />

          <div className="space-y-2">
            <h1 className="text-lg font-semibold leading-tight">
              {currentSection?.title ?? course.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{course.instructor}</span>
              {course.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {course.duration}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {course.students} 人学习
              </span>
            </div>
          </div>

          <CourseInteraction likeCount={0} favoriteCount={0} />

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">章节目录</h2>
            <CourseChapters
              chapters={chapters}
              currentSectionId={currentSection?.id}
              onSelect={handleSelectSection}
            />
          </div>
        </div>

        <aside className="w-full shrink-0 lg:w-[32%]">
          <div className="sticky top-4">
            <CourseTabs course={tabData} />
          </div>
        </aside>
      </div>
    </div>
  )
}
