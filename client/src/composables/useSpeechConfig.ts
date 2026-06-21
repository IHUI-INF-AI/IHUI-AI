import { t } from '@/utils/i18n'

/**
 * 语音识别配置 Composable
 * 从环境变量读取配置并初始化语音服务
 */

import { onMounted, ref } from 'vue'
import { 
  configureSpeechService, 
  speechManager,
  SpeechProvider,
  type SpeechServiceConfig,
} from '@/utils/speech'
import { logger } from '@/utils/logger'

/** 语音服务状态 */
export interface SpeechServiceStatus {
  initialized: boolean
  availableProviders: SpeechProvider[]
  currentProvider: string | null
  error: string | null
}

/**
 * 语音配置 Composable
 */
export function useSpeechConfig() {
  const status = ref<SpeechServiceStatus>({
    initialized: false,
    availableProviders: [],
    currentProvider: null,
    error: null,
  })

  /**
   * 从环境变量构建配置
   */
  function buildConfigFromEnv(): SpeechServiceConfig {
    const config: SpeechServiceConfig = {}

    // 百度语音配置
    const baiduAppId = import.meta.env.VITE_BAIDU_SPEECH_APP_ID
    const baiduApiKey = import.meta.env.VITE_BAIDU_SPEECH_API_KEY
    const baiduSecretKey = import.meta.env.VITE_BAIDU_SPEECH_SECRET_KEY

    if (baiduAppId && baiduApiKey && baiduSecretKey) {
      config.baidu = {
        appId: baiduAppId,
        apiKey: baiduApiKey,
        secretKey: baiduSecretKey,
        // 使用代理端点（后端处理）
        endpoint: '/api/speech/baidu/asr',
        tokenEndpoint: '/api/speech/baidu/token',
      }
      logger.info('[SpeechConfig] Baidu speech service configured')
    }

    // 讯飞语音配置
    const iflytekAppId = import.meta.env.VITE_IFLYTEK_SPEECH_APP_ID
    const iflytekApiKey = import.meta.env.VITE_IFLYTEK_SPEECH_API_KEY
    const iflytekApiSecret = import.meta.env.VITE_IFLYTEK_SPEECH_API_SECRET

    if (iflytekAppId && iflytekApiKey && iflytekApiSecret) {
      config.iflytek = {
        appId: iflytekAppId,
        apiKey: iflytekApiKey,
        apiSecret: iflytekApiSecret,
      }
      logger.info('[SpeechConfig] iFlytek speech service configured')
    }

    // 降级顺序
    const fallbackOrder = import.meta.env.VITE_SPEECH_FALLBACK_ORDER
    if (fallbackOrder) {
      config.fallbackOrder = fallbackOrder.split(',').map((s: string) => s.trim()) as SpeechProvider[]
      logger.info('[SpeechConfig] Fallback order:', config.fallbackOrder)
    }

    return config
  }

  /**
   * 初始化语音服务
   */
  async function initSpeechService(): Promise<void> {
    try {
      const config = buildConfigFromEnv()
      configureSpeechService(config)

      // 检测可用的提供商
      const providersStatus = speechManager.getProviderStatus()
      const available: SpeechProvider[] = []

      for (const [provider, info] of Object.entries(providersStatus)) {
        const providerInfo = info as { available: boolean }
        if (providerInfo.available) {
          available.push(provider as SpeechProvider)
        }
      }

      status.value = {
        initialized: true,
        availableProviders: available,
        currentProvider: speechManager.getCurrentProvider(),
        error: null,
      }

      logger.info('[SpeechConfig] Voice service initialization complete', {
        availableProviders: available,
        providersStatus,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('api.use_speech_config.初始化失败')
      status.value = {
        initialized: false,
        availableProviders: [],
        currentProvider: null,
        error: errorMessage,
      }
      logger.error('[SpeechConfig] Voice service initialization failed:', error)
    }
  }

  /**
   * 获取语音服务状态
   */
  async function refreshStatus(): Promise<void> {
    try {
      const providersStatus = speechManager.getProviderStatus()
      const available: SpeechProvider[] = []

      for (const [provider, info] of Object.entries(providersStatus)) {
        const providerInfo = info as { available: boolean }
        if (providerInfo.available) {
          available.push(provider as SpeechProvider)
        }
      }

      status.value.availableProviders = available
      status.value.currentProvider = speechManager.getCurrentProvider()
    } catch (error) {
      logger.error('[SpeechConfig] Failed to refresh status:', error)
    }
  }

  /**
   * 检查是否有可用的语音服务
   */
  function hasAvailableService(): boolean {
    return status.value.availableProviders.length > 0
  }

  /**
   * 获取推荐的提供商
   */
  function getRecommendedProvider(): SpeechProvider | null {
    if (status.value.availableProviders.length === 0) {
      return null
    }
    return status.value.availableProviders[0]
  }

  // 在挂载时初始化
  onMounted(() => {
    void initSpeechService()
  })

  return {
    status,
    initSpeechService,
    refreshStatus,
    hasAvailableService,
    getRecommendedProvider,
  }
}

/** 根据语言/时区推断是否可能在中国大陆，用于避免对 Google 的请求及控制台 ERR_CONNECTION_TIMED_OUT */
function isLikelyMainlandChinaSync(): boolean {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return true
  }
  if (typeof navigator === 'undefined') return false
  const lang = navigator.language?.toLowerCase() ?? ''
  if (lang.startsWith('zh-cn') || lang === 'zh-hans') return true
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
    if (/^Asia\/Shanghai$|^Asia\/Urumqi$/i.test(tz)) return true
  } catch {
    // ignore
  }
  return false
}

/**
 * 检查是否在中国大陆
 * 先根据语言/时区推断；否则通过检测 Google 服务可用性判断；超时或不可达时视为大陆环境，不抛错、不刷控制台
 */
export async function isInMainlandChina(): Promise<boolean> {
  if (isLikelyMainlandChinaSync()) {
    return true
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)

    await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    })

    clearTimeout(timeout)
    return false // Google 可访问，不在大陆
  } catch {
    // 超时或网络不可达时视为大陆，静默返回，不记录日志
    return true
  }
}

/**
 * 获取最佳语音服务推荐
 */
export async function getRecommendedSpeechService(): Promise<{
  provider: SpeechProvider
  reason: string
}> {
  const inChina = await isInMainlandChina()

  if (inChina) {
    // 在中国大陆，优先使用国内服务
    const hasBaidu = !!import.meta.env.VITE_BAIDU_SPEECH_APP_ID
    const hasIflytek = !!import.meta.env.VITE_IFLYTEK_SPEECH_APP_ID

    if (hasBaidu) {
      return {
        provider: SpeechProvider.BAIDU,
        reason: '检测到您在中国大陆，推荐使用百度语音服务',
      }
    } else if (hasIflytek) {
      return {
        provider: SpeechProvider.IFLYTEK,
        reason: '检测到您在中国大陆，推荐使用讯飞语音服务',
      }
    } else {
      return {
        provider: SpeechProvider.WEB_SPEECH,
        reason: '未配置国内语音服务，将尝试使用浏览器原生语音识别（可能不可用）',
      }
    }
  } else {
    return {
      provider: SpeechProvider.WEB_SPEECH,
      reason: 'Web Speech API 可用，使用浏览器原生语音识别',
    }
  }
}
