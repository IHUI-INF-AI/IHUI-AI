'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface StudentProfile {
  id: string
  name: string
  avatar?: string
  grade?: string
  level?: string
  totalCourses: number
  completedCourses: number
  totalPoints: number
  streak: number
  joinedAt: string
  tags?: string[]
}

export interface UseStudentProfileReturn {
  profile: StudentProfile | null
  loading: boolean
  error: string | null
  fetchProfile: (studentId: string) => Promise<void>
  updateProfile: (studentId: string, patch: Partial<StudentProfile>) => Promise<boolean>
}

/** 学生档案 Hook，拉取与更新学生资料 */
export function useStudentProfile(): UseStudentProfileReturn {
  const [profile, setProfile] = React.useState<StudentProfile | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchProfile = React.useCallback(async (studentId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<StudentProfile>(`/api/students/${studentId}/profile`)
      if (res.success) {
        setProfile(res.data)
      } else {
        setError(res.error)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const updateProfile = React.useCallback(
    async (studentId: string, patch: Partial<StudentProfile>) => {
      const res = await fetchApi<StudentProfile>(`/api/students/${studentId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      })
      if (res.success) {
        setProfile((prev) => (prev ? { ...prev, ...res.data } : res.data))
        return true
      }
      return false
    },
    [],
  )

  return { profile, loading, error, fetchProfile, updateProfile }
}
