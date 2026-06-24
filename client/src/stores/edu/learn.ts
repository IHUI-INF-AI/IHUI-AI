/**
 * Edu Learn store - course learning state
 *
 * Manages: enrolled courses, learning progress, certificates, current chapter.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { learnApi } from '@/api/edu'
import type { EduCourse, EduLearnRecord, EduCertificate } from '@/api/edu'

export const useEduLearnStore = defineStore('edu-learn', () => {
  // State
  const enrolledCourses = ref<EduCourse[]>([])
  const currentCourse = ref<EduCourse | null>(null)
  const currentProgress = ref<EduLearnRecord[]>([])
  const certificates = ref<EduCertificate[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const completedCount = computed(() => certificates.value.length)
  const inProgressCourses = computed(() =>
    enrolledCourses.value.filter((c) => {
      const progress = currentProgress.value.filter((p) => p.course_id === c.id)
      return progress.length > 0 && progress.some((p) => !p.is_completed)
    })
  )

  // Actions
  async function loadEnrolledCourses() {
    loading.value = true
    error.value = null
    try {
      const res = await learnApi.listCourses({ is_published: true })
      enrolledCourses.value = res.data?.data?.items ?? []
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function loadCourse(courseId: number) {
    loading.value = true
    try {
      const res = await learnApi.getCourse(courseId)
      currentCourse.value = res.data?.data ?? null
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function loadProgress(courseId: number) {
    try {
      const res = await learnApi.getMyProgress(courseId)
      currentProgress.value = res.data?.data ?? []
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function updateProgress(data: {
    course_id: number
    section_id?: number
    progress_seconds: number
    total_seconds: number
    last_position?: number
  }) {
    try {
      const res = await learnApi.updateProgress(data)
      // Update local cache
      const idx = currentProgress.value.findIndex(
        (p) => p.course_id === data.course_id && p.section_id === data.section_id
      )
      if (idx >= 0 && res.data?.data) {
        currentProgress.value[idx] = res.data.data
      } else if (res.data?.data) {
        currentProgress.value.push(res.data.data)
      }
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function enroll(courseId: number) {
    try {
      await learnApi.enrollCourse(courseId)
      await loadCourse(courseId)
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function loadCertificates() {
    try {
      const res = await learnApi.myCertificates()
      certificates.value = res.data?.data ?? []
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  function reset() {
    enrolledCourses.value = []
    currentCourse.value = null
    currentProgress.value = []
    certificates.value = []
    error.value = null
  }

  return {
    // State
    enrolledCourses,
    currentCourse,
    currentProgress,
    certificates,
    loading,
    error,
    // Getters
    completedCount,
    inProgressCourses,
    // Actions
    loadEnrolledCourses,
    loadCourse,
    loadProgress,
    updateProgress,
    enroll,
    loadCertificates,
    reset,
  }
})