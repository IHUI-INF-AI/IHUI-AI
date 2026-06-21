import { ref, computed } from 'vue'
import { StorageManager } from '@/utils/storage'

export type ABTestName = 'tour_content' | 'tour_flow' | 'reward_display'

interface ABTestVariant {
  name: string
  weight: number
  config: Record<string, unknown>
}

interface ABTestConfig {
  testName: ABTestName
  variants: ABTestVariant[]
  isActive: boolean
}

interface ABTestResult {
  id: string
  testName: ABTestName
  variant: string
  timestamp: number
  completed: boolean
  impressionTime: number
  completionTime?: number
  duration?: number
  stepData?: {
    stepIndex: number
    stepId: string
    action: 'view' | 'skip' | 'complete'
    timestamp: number
  }[]
  metadata?: Record<string, unknown>
  userId?: string
  sessionId?: string
  deviceInfo?: {
    userAgent: string
    screenWidth: number
    screenHeight: number
    language: string
  }
}

interface ABTestSession {
  sessionId: string
  startTime: number
  testName: ABTestName
  variant: string
  steps: { stepId: string; timestamp: number; action: string }[]
}

const AB_TEST_PREFIX = 'ab_test_'
const AB_TEST_RESULTS_KEY = 'ab_test_results'
const AB_TEST_SESSIONS_KEY = 'ab_test_sessions'

const testConfigs: Record<ABTestName, ABTestConfig> = {
  tour_content: {
    testName: 'tour_content',
    variants: [
      { name: 'control', weight: 50, config: { showAllSteps: true, stepCount: 3 } },
      { name: 'simplified', weight: 50, config: { showAllSteps: false, stepCount: 2 } },
    ],
    isActive: true,
  },
  tour_flow: {
    testName: 'tour_flow',
    variants: [
      { name: 'linear', weight: 33, config: { flowType: 'linear', allowSkip: true } },
      { name: 'branching', weight: 33, config: { flowType: 'branching', allowSkip: false } },
      { name: 'interactive', weight: 34, config: { flowType: 'interactive', allowSkip: true } },
    ],
    isActive: true,
  },
  reward_display: {
    testName: 'reward_display',
    variants: [
      { name: 'immediate', weight: 50, config: { showReward: true, delay: 0 } },
      { name: 'delayed', weight: 50, config: { showReward: true, delay: 2000 } },
    ],
    isActive: true,
  },
}

const testResults = ref<ABTestResult[]>([])
const currentSessions = ref<Record<string, ABTestSession>>({})

const loadResults = () => {
  const stored = StorageManager.getItem<ABTestResult[]>(AB_TEST_RESULTS_KEY)
  if (stored) {
    testResults.value = stored
  }
  const sessions = StorageManager.getItem<Record<string, ABTestSession>>(AB_TEST_SESSIONS_KEY)
  if (sessions) {
    currentSessions.value = sessions
  }
}

const saveResults = () => {
  StorageManager.setItem(AB_TEST_RESULTS_KEY, testResults.value)
  StorageManager.setItem(AB_TEST_SESSIONS_KEY, currentSessions.value)
}

const generateId = () => `result-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const getDeviceInfo = () => ({
  userAgent: navigator.userAgent,
  screenWidth: window.screen.width,
  screenHeight: window.screen.height,
  language: navigator.language,
})

const getVariant = (testName: ABTestName): string => {
  const config = testConfigs[testName]
  if (!config || !config.isActive) return 'control'

  const storedVariant = StorageManager.getItem<string>(`${AB_TEST_PREFIX}${testName}`)
  if (storedVariant) return storedVariant

  const random = Math.random() * 100
  let cumulative = 0
  
  for (const variant of config.variants) {
    cumulative += variant.weight
    if (random <= cumulative) {
      StorageManager.setItem(`${AB_TEST_PREFIX}${testName}`, variant.name)
      return variant.name
    }
  }
  
  return config.variants[0].name
}

const getVariantConfig = (testName: ABTestName): Record<string, unknown> => {
  const config = testConfigs[testName]
  const variantName = getVariant(testName)
  const variant = config.variants.find(v => v.name === variantName)
  return variant?.config || {}
}

const recordImpression = (testName: ABTestName, metadata?: Record<string, unknown>) => {
  const variant = getVariant(testName)
  const sessionId = generateId()
  const now = Date.now()

  const result: ABTestResult = {
    id: generateId(),
    testName,
    variant,
    timestamp: now,
    completed: false,
    impressionTime: now,
    stepData: [],
    metadata,
    sessionId,
    deviceInfo: getDeviceInfo(),
  }
  testResults.value.push(result)

  currentSessions.value[sessionId] = {
    sessionId,
    startTime: now,
    testName,
    variant,
    steps: [],
  }

  saveResults()
  return sessionId
}

const recordStepAction = (
  sessionId: string,
  stepId: string,
  action: 'view' | 'skip' | 'complete'
) => {
  const session = currentSessions.value[sessionId]
  if (!session) return

  session.steps.push({
    stepId,
    timestamp: Date.now(),
    action,
  })

  const result = testResults.value.find(r => r.sessionId === sessionId)
  if (result && result.stepData) {
    result.stepData.push({
      stepIndex: session.steps.length - 1,
      stepId,
      action,
      timestamp: Date.now(),
    })
  }

  saveResults()
}

const recordCompletion = (testName: ABTestName, metadata?: Record<string, unknown>, sessionId?: string) => {
  const now = Date.now()

  let lastResult: ABTestResult | undefined
  if (sessionId) {
    lastResult = testResults.value.find(r => r.sessionId === sessionId)
  } else {
    lastResult = testResults.value
      .filter(r => r.testName === testName && !r.completed)
      .sort((a, b) => b.timestamp - a.timestamp)[0]
  }

  if (lastResult) {
    lastResult.completed = true
    lastResult.completionTime = now
    lastResult.duration = now - lastResult.impressionTime
    lastResult.metadata = { ...lastResult.metadata, ...metadata }
    saveResults()
  }
}

const getTestStats = (testName: ABTestName) => {
  const results = testResults.value.filter(r => r.testName === testName)
  const variants: Record<string, {
    impressions: number
    completions: number
    rate: number
    avgDuration: number
    skipRate: number
    stepStats: Record<string, { views: number; skips: number; completions: number }>
  }> = {}

  for (const result of results) {
    if (!variants[result.variant]) {
      variants[result.variant] = {
        impressions: 0,
        completions: 0,
        rate: 0,
        avgDuration: 0,
        skipRate: 0,
        stepStats: {},
      }
    }
    variants[result.variant].impressions++
    if (result.completed) {
      variants[result.variant].completions++
    }

    if (result.stepData) {
      for (const step of result.stepData) {
        if (!variants[result.variant].stepStats[step.stepId]) {
          variants[result.variant].stepStats[step.stepId] = { views: 0, skips: 0, completions: 0 }
        }
        if (step.action === 'view') {
          variants[result.variant].stepStats[step.stepId].views++
        } else if (step.action === 'skip') {
          variants[result.variant].stepStats[step.stepId].skips++
        } else if (step.action === 'complete') {
          variants[result.variant].stepStats[step.stepId].completions++
        }
      }
    }
  }

  for (const key of Object.keys(variants)) {
    const v = variants[key]
    v.rate = v.impressions > 0 ? (v.completions / v.impressions) * 100 : 0

    const durations = results
      .filter(r => r.variant === key && r.duration)
      .map(r => r.duration as number)
    v.avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0

    const skipped = results.filter(r => r.variant === key && r.stepData?.some(s => s.action === 'skip')).length
    v.skipRate = v.impressions > 0 ? (skipped / v.impressions) * 100 : 0
  }

  return {
    testName,
    totalImpressions: results.length,
    totalCompletions: results.filter(r => r.completed).length,
    avgDuration: results.filter(r => r.duration).reduce((a, b) => a + (b.duration || 0), 0) / results.length || 0,
    variants,
  }
}

const getAllTestStats = () => {
  return Object.keys(testConfigs).map(name => getTestStats(name as ABTestName))
}

const resetTest = (testName: ABTestName) => {
  StorageManager.removeItem(`${AB_TEST_PREFIX}${testName}`)
  testResults.value = testResults.value.filter(r => r.testName !== testName)
  saveResults()
}

const isFeatureEnabled = (testName: ABTestName, feature: string): boolean => {
  const config = getVariantConfig(testName)
  return Boolean(config[feature])
}

const activeTests = computed(() => {
  return Object.values(testConfigs).filter(c => c.isActive).map(c => c.testName)
})

loadResults()

export function useABTest() {
  return {
    getVariant,
    getVariantConfig,
    recordImpression,
    recordStepAction,
    recordCompletion,
    getTestStats,
    getAllTestStats,
    resetTest,
    isFeatureEnabled,
    activeTests,
    testConfigs,
  }
}

export const abTest = {
  getVariant,
  getVariantConfig,
  recordImpression,
  recordStepAction,
  recordCompletion,
  getTestStats,
  resetTest,
}
