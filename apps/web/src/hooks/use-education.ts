'use client'

import * as React from 'react'

import { eduApi } from '@/lib/edu'

export interface Course {
  id: string
  title: string
  description?: string
  cover?: string
  lessons?: number
  duration?: number
}

export interface CourseProgress {
  courseId: string
  completedLessons: number
  totalLessons: number
  percentage: number
}

export interface UseEducationReturn {
  courses: Course[]
  currentCourse: Course | null
  progress: CourseProgress | null
  fetchCourses: () => Promise<void>
  fetchProgress: (courseId: string) => Promise<void>
}

/** 教育课程 Hook（本地 state + eduApi） */
export function useEducation(): UseEducationReturn {
  const [courses, setCourses] = React.useState<Course[]>([])
  const [currentCourse, setCurrentCourse] = React.useState<Course | null>(null)
  const [progress, setProgress] = React.useState<CourseProgress | null>(null)

  const fetchCourses = React.useCallback(async () => {
    try {
      const data = await eduApi<{ list: Course[] }>('/api/edu/courses')
      setCourses(data.list)
    } catch {
      /* error handled silently */
    }
  }, [])

  const fetchProgress = React.useCallback(
    async (courseId: string) => {
      setCurrentCourse(courses.find((c) => c.id === courseId) ?? null)
      try {
        const data = await eduApi<CourseProgress>(`/api/edu/courses/${courseId}/progress`)
        setProgress(data)
      } catch {
        /* error handled silently */
      }
    },
    [courses],
  )

  return { courses, currentCourse, progress, fetchCourses, fetchProgress }
}
