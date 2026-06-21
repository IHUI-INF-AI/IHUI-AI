/**
 * 引导分析统计 Composable
 * @description 提供引导系统的数据追踪和分析功能
 */

import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import { StorageManager } from '@/utils/storage'

export interface TourAnalyticsData {
  tourId: string
  startTime: number
  endTime?: number
  completedSteps: number[]
  skippedSteps: number[]
  totalSteps: number
  completed: boolean
  skipped: boolean
  duration?: number
  stepDurations: Record<number, number>
  stepEnterTimes: Record<number, number>
}

interface TourAnalyticsStorage {
  [tourId: string]: TourAnalyticsData
}

const storageKey = 'tour_analytics'

const analyticsData = ref<TourAnalyticsStorage>({})

const loadAnalytics = () => {
  const data = StorageManager.getItem<TourAnalyticsStorage>(storageKey)
  if (data) {
    analyticsData.value = data
  }
}

const saveAnalytics = () => {
  StorageManager.setItem(storageKey, analyticsData.value)
}

loadAnalytics()

export function useTourAnalytics(tourId: string) {
  const currentTourData = computed(() => analyticsData.value[tourId])

  const startTour = () => {
    analyticsData.value[tourId] = {
      tourId,
      startTime: Date.now(),
      completedSteps: [],
      skippedSteps: [],
      totalSteps: 0,
      completed: false,
      skipped: false,
      stepDurations: {},
      stepEnterTimes: {},
    }
    saveAnalytics()
    logger.debug(`[TourAnalytics] Tour started: ${tourId}`)
  }

  const setTotalSteps = (total: number) => {
    if (analyticsData.value[tourId]) {
      analyticsData.value[tourId].totalSteps = total
      saveAnalytics()
    }
  }

  const enterStep = (stepIndex: number) => {
    if (analyticsData.value[tourId]) {
      analyticsData.value[tourId].stepEnterTimes[stepIndex] = Date.now()
      saveAnalytics()
      logger.debug(`[TourAnalytics] Enter step ${stepIndex}: ${tourId}`)
    }
  }

  const completeStep = (stepIndex: number) => {
    if (analyticsData.value[tourId]) {
      const data = analyticsData.value[tourId]
      if (!data.completedSteps.includes(stepIndex)) {
        data.completedSteps.push(stepIndex)
      }
      if (data.stepEnterTimes[stepIndex]) {
        data.stepDurations[stepIndex] = Date.now() - data.stepEnterTimes[stepIndex]
      }
      saveAnalytics()
      logger.debug(`[TourAnalytics] Step completed ${stepIndex}: ${tourId}`)
    }
  }

  const skipStep = (stepIndex: number) => {
    if (analyticsData.value[tourId]) {
      const data = analyticsData.value[tourId]
      if (!data.skippedSteps.includes(stepIndex)) {
        data.skippedSteps.push(stepIndex)
      }
      if (data.stepEnterTimes[stepIndex]) {
        data.stepDurations[stepIndex] = Date.now() - data.stepEnterTimes[stepIndex]
      }
      saveAnalytics()
      logger.debug(`[TourAnalytics] Step skipped ${stepIndex}: ${tourId}`)
    }
  }

  const completeTour = () => {
    if (analyticsData.value[tourId]) {
      const data = analyticsData.value[tourId]
      data.endTime = Date.now()
      data.completed = true
      data.duration = data.endTime - data.startTime
      saveAnalytics()
      logger.debug(`[TourAnalytics] Tour completed: ${tourId}, duration: ${data.duration}ms`)
    }
  }

  const skipTour = (currentStep: number) => {
    if (analyticsData.value[tourId]) {
      const data = analyticsData.value[tourId]
      data.endTime = Date.now()
      data.skipped = true
      data.duration = data.endTime - data.startTime
      skipStep(currentStep)
      saveAnalytics()
      logger.debug(`[TourAnalytics] Tour skipped: ${tourId}, at step ${currentStep}`)
    }
  }

  const getCompletionRate = computed(() => {
    const data = analyticsData.value[tourId]
    if (!data || data.totalSteps === 0) return 0
    return Math.round((data.completedSteps.length / data.totalSteps) * 100)
  })

  const getAverageStepDuration = computed(() => {
    const data = analyticsData.value[tourId]
    if (!data || Object.keys(data.stepDurations).length === 0) return 0
    const durations = Object.values(data.stepDurations)
    return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
  })

  const getTourStats = () => {
    const data = analyticsData.value[tourId]
    if (!data) return null

    return {
      tourId: data.tourId,
      completed: data.completed,
      skipped: data.skipped,
      completionRate: getCompletionRate.value,
      duration: data.duration,
      averageStepDuration: getAverageStepDuration.value,
      completedSteps: data.completedSteps.length,
      skippedSteps: data.skippedSteps.length,
      totalSteps: data.totalSteps,
    }
  }

  const getAllToursStats = () => {
    return Object.keys(analyticsData.value).map(id => {
      const data = analyticsData.value[id]
      return {
        tourId: data.tourId,
        completed: data.completed,
        skipped: data.skipped,
        completionRate: data.totalSteps > 0 
          ? Math.round((data.completedSteps.length / data.totalSteps) * 100) 
          : 0,
        duration: data.duration,
      }
    })
  }

  const clearAnalytics = () => {
    delete analyticsData.value[tourId]
    saveAnalytics()
    logger.debug(`[TourAnalytics] Clear tour analytics: ${tourId}`)
  }

  return {
    currentTourData,
    startTour,
    setTotalSteps,
    enterStep,
    completeStep,
    skipStep,
    completeTour,
    skipTour,
    getCompletionRate,
    getAverageStepDuration,
    getTourStats,
    getAllToursStats,
    clearAnalytics,
  }
}
