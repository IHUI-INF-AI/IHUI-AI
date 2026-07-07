/**
 * useModelTest — Model connection test state machine composable.
 *
 * Inspired by cc-switch (three-state result) and echobird (sentinel value).
 *
 * States: idle → loading → success | degraded | error
 *
 * Usage:
 *   const { testState, testResult, isTesting, runTest, resetTest } = useModelTest()
 *   await runTest({ baseUrl, apiKey, apiFormat, modelIdForTest, mode, providerId })
 */

import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  testModelAdhoc,
  testSavedModelProvider,
  type ModelTestResult,
  type TestModeType,
  type ApiFormatType,
} from '@/api/models'

export type TestState = 'idle' | 'loading' | 'success' | 'degraded' | 'error'

export interface RunTestParams {
  baseUrl?: string
  apiKey?: string
  apiFormat: ApiFormatType
  modelIdForTest?: string
  mode?: TestModeType
  providerId?: number | string
}

export function useModelTest() {
  const { t } = useI18n()

  const testState = ref<TestState>('idle')
  const testResult = ref<ModelTestResult | null>(null)

  const isTesting = computed(() => testState.value === 'loading')
  const hasResult = computed(() => testResult.value !== null)

  /** Get localized error message based on errorType */
  function getErrorMessage(result: ModelTestResult): string {
    if (!result.errorType) return result.message
    const errorMap: Record<string, string> = {
      auth: t('models.errorAuth'),
      endpoint: t('models.errorEndpoint'),
      network: t('models.errorNetwork'),
      format: t('models.errorFormat'),
      unknown: t('models.errorUnknown'),
    }
    return errorMap[result.errorType] || result.message
  }

  /** Get localized success message with response time */
  function getSuccessMessage(result: ModelTestResult): string {
    if (result.status === 'degraded') {
      return t('models.connectionDegraded', { ms: result.responseMs })
    }
    return t('models.connectionSuccess', { ms: result.responseMs })
  }

  /**
   * Run a connection test.
   * If providerId is provided, tests a saved provider.
   * Otherwise, tests an ad-hoc configuration (before saving).
   */
  async function runTest(params: RunTestParams) {
    testState.value = 'loading'
    testResult.value = null

    try {
      let response

      if (params.providerId) {
        // Test saved provider
        response = await testSavedModelProvider(
          params.providerId,
          params.mode || 'chat'
        )
      } else {
        // Ad-hoc test (before saving)
        if (!params.baseUrl || !params.apiKey) {
          testState.value = 'error'
          testResult.value = {
            status: 'failed',
            success: false,
            responseMs: 0,
            mode: params.mode || 'chat',
            message: t('models.testMissingFields'),
            errorType: 'unknown',
          }
          return
        }
        response = await testModelAdhoc({
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
          apiFormat: params.apiFormat,
          modelIdForTest: params.modelIdForTest,
          mode: params.mode || 'chat',
        })
      }

      const result = response.data
      if (!result) {
        testState.value = 'error'
        return
      }

      testResult.value = result

      if (result.success) {
        testState.value = result.status === 'degraded' ? 'degraded' : 'success'
      } else {
        testState.value = 'error'
      }
    } catch (err) {
      testState.value = 'error'
      testResult.value = {
        status: 'failed',
        success: false,
        responseMs: 0,
        mode: params.mode || 'chat',
        message: err instanceof Error ? err.message : t('models.errorUnknown'),
        errorType: 'unknown',
      }
    }
  }

  function resetTest() {
    testState.value = 'idle'
    testResult.value = null
  }

  return {
    testState,
    testResult,
    isTesting,
    hasResult,
    runTest,
    resetTest,
    getErrorMessage,
    getSuccessMessage,
  }
}
