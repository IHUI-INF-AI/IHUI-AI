/**
 * Edu Circle store - Circle/community state (edu-unique)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { circleApi } from '@/api/edu'
import type { EduCircle, EduCirclePost } from '@/api/edu'

export const useEduCircleStore = defineStore('edu-circle', () => {
  const circles = ref<EduCircle[]>([])
  const myCircles = ref<EduCircle[]>([])
  const currentCircle = ref<EduCircle | null>(null)
  const currentPosts = ref<EduCirclePost[]>([])
  const currentMembership = ref<{ role: string } | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const publicCircles = computed(() =>
    circles.value.filter((c) => c.is_public)
  )

  async function listCircles(params?: {
    page?: number
    size?: number
    category?: string
    is_public?: boolean
    keyword?: string
    order_by?: 'latest' | 'hot'
  }) {
    loading.value = true
    try {
      const res = await circleApi.listCircles(params)
      circles.value = res.data?.data?.items ?? []
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function loadMyCircles() {
    try {
      // Need current user_id from auth store; placeholder pattern
      // In real code, use useAuthStore().user.id
      const userId = 0  // Will be replaced with auth.user.id
      const res = await circleApi.userCircles(userId)
      myCircles.value = res.data?.data?.items ?? []
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function loadCircle(circleId: number) {
    loading.value = true
    try {
      const [cRes, pRes] = await Promise.all([
        circleApi.getCircle(circleId),
        circleApi.listPosts(circleId),
      ])
      currentCircle.value = cRes.data?.data ?? null
      currentPosts.value = pRes.data?.data?.items ?? []
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function joinCircle(circleId: number) {
    try {
      const res = await circleApi.joinCircle(circleId)
      currentMembership.value = res.data?.data ?? null
      // Refresh circle member_count
      if (currentCircle.value) {
        await loadCircle(circleId)
      }
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function leaveCircle(circleId: number) {
    try {
      await circleApi.leaveCircle(circleId)
      currentMembership.value = null
      if (currentCircle.value) {
        await loadCircle(circleId)
      }
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function createPost(circleId: number, data: { content: string; images?: string[] }) {
    try {
      const res = await circleApi.createPost(circleId, data)
      if (res.data?.data) {
        currentPosts.value.unshift(res.data.data)
      }
      return res.data?.data
    } catch (e: unknown) {
      error.value = (e as Error).message
      throw e
    }
  }

  async function likePost(postId: number) {
    try {
      const res = await circleApi.likePost(postId)
      const post = currentPosts.value.find((p) => p.id === postId)
      if (post && res.data?.data) {
        post.like_count = res.data.data.like_count
      }
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  function reset() {
    circles.value = []
    myCircles.value = []
    currentCircle.value = null
    currentPosts.value = []
    currentMembership.value = null
    error.value = null
  }

  return {
    circles,
    myCircles,
    currentCircle,
    currentPosts,
    currentMembership,
    loading,
    error,
    publicCircles,
    listCircles,
    loadMyCircles,
    loadCircle,
    joinCircle,
    leaveCircle,
    createPost,
    likePost,
    reset,
  }
})