/**
 * Edu Ask store - Q&A state (edu-unique)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { askApi } from '@/api/edu'
import type { EduAskQuestion, EduAskAnswer } from '@/api/edu'

export const useEduAskStore = defineStore('edu-ask', () => {
  // State
  const questions = ref<EduAskQuestion[]>([])
  const hotQuestions = ref<EduAskQuestion[]>([])
  const currentQuestion = ref<EduAskQuestion | null>(null)
  const currentAnswers = ref<EduAskAnswer[]>([])
  const userStats = ref<Record<string, unknown> | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const unansweredCount = computed(() =>
    questions.value.filter((q) => !q.is_resolved).length
  )

  // Actions
  async function listQuestions(params?: {
    page?: number
    size?: number
    course_id?: number
    is_resolved?: boolean
    keyword?: string
    order_by?: 'latest' | 'hot' | 'unresolved'
  }) {
    loading.value = true
    try {
      const res = await askApi.listQuestions(params)
      questions.value = res.data?.data?.items ?? []
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function loadHotQuestions(limit = 10) {
    try {
      const res = await askApi.hotQuestions(limit)
      hotQuestions.value = res.data?.data ?? []
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function loadQuestion(questionId: number) {
    loading.value = true
    try {
      const [qRes, aRes] = await Promise.all([
        askApi.getQuestion(questionId),
        askApi.listAnswers(questionId),
      ])
      currentQuestion.value = qRes.data?.data ?? null
      currentAnswers.value = aRes.data?.data?.items ?? []
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function createQuestion(data: {
    title: string
    content: string
    course_id?: number
    tags?: string
  }) {
    try {
      const res = await askApi.createQuestion(data)
      return res.data?.data
    } catch (e: unknown) {
      error.value = (e as Error).message
      throw e
    }
  }

  async function postAnswer(questionId: number, content: string) {
    try {
      const res = await askApi.createAnswer(questionId, { content })
      if (res.data?.data) {
        currentAnswers.value.push(res.data.data)
        if (currentQuestion.value) {
          currentQuestion.value.answer_count += 1
        }
      }
      return res.data?.data
    } catch (e: unknown) {
      error.value = (e as Error).message
      throw e
    }
  }

  async function adoptAnswer(answerId: number) {
    try {
      await askApi.adoptAnswer(answerId)
      if (currentQuestion.value) {
        currentQuestion.value.is_resolved = true
        currentQuestion.value.best_answer_id = answerId
      }
      // Update local answer status
      const ans = currentAnswers.value.find((a) => a.id === answerId)
      if (ans) ans.is_best = true
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function likeAnswer(answerId: number) {
    try {
      const res = await askApi.likeAnswer(answerId)
      const ans = currentAnswers.value.find((a) => a.id === answerId)
      if (ans && res.data?.data) {
        ans.like_count = res.data.data.like_count
      }
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function loadUserStats(userId: number) {
    try {
      const res = await askApi.userStats(userId)
      userStats.value = res.data?.data ?? null
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  function reset() {
    questions.value = []
    hotQuestions.value = []
    currentQuestion.value = null
    currentAnswers.value = []
    userStats.value = null
    error.value = null
  }

  return {
    questions,
    hotQuestions,
    currentQuestion,
    currentAnswers,
    userStats,
    loading,
    error,
    unansweredCount,
    listQuestions,
    loadHotQuestions,
    loadQuestion,
    createQuestion,
    postAnswer,
    adoptAnswer,
    likeAnswer,
    loadUserStats,
    reset,
  }
})