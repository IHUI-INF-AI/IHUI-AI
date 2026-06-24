/**
 * Edu Live store - Live broadcast state
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { liveApi } from '@/api/edu'
import type { EduLiveRoom } from '@/api/edu'

export const useEduLiveStore = defineStore('edu-live', () => {
  const rooms = ref<EduLiveRoom[]>([])
  const currentRoom = ref<EduLiveRoom | null>(null)
  const currentAttendees = ref<Array<Record<string, unknown>>>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function listRooms(params?: {
    page?: number
    size?: number
    teacher_id?: number
    status?: 'scheduled' | 'live' | 'ended' | 'cancelled'
  }) {
    loading.value = true
    try {
      const res = await liveApi.listRooms(params)
      rooms.value = res.data?.data?.items ?? []
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function loadRoom(roomId: number) {
    loading.value = true
    try {
      const [rRes, aRes] = await Promise.all([
        liveApi.getRoom(roomId),
        liveApi.listAttendees(roomId),
      ])
      currentRoom.value = rRes.data?.data ?? null
      currentAttendees.value = aRes.data?.data?.items ?? []
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function joinLive(roomId: number) {
    try {
      await liveApi.joinLive(roomId)
      // Refresh room to update attendee_count
      await loadRoom(roomId)
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function leaveLive(roomId: number) {
    try {
      await liveApi.leaveLive(roomId)
      await loadRoom(roomId)
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  function reset() {
    rooms.value = []
    currentRoom.value = null
    currentAttendees.value = []
    error.value = null
  }

  return {
    rooms,
    currentRoom,
    currentAttendees,
    loading,
    error,
    listRooms,
    loadRoom,
    joinLive,
    leaveLive,
    reset,
  }
})