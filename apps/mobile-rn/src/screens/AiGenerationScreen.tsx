// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useMemo, useState } from 'react'
import { Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  extractMediaUrls,
  extractText,
  generateAi3D,
  generateAiCode,
  generateAiImage,
  generateAiMusic,
  generateAiSpeech,
  generateAiText,
  generateAiVideo,
  getKlingTask,
  submitKlingVideo,
  type AiImageProvider,
} from '@ihui/api-client'
import {
  AiGenerationScreen as SharedAiGenerationScreen,
  type AiGenerationModeOption,
  type AiGenerationResultView,
  type AiGenerationType,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'aiGenerationPage'
/** Kling 轮询上限与间隔,同 web PageClient.tsx:71-72(100 次 × 3s) */
const KLING_MAX_ATTEMPTS = 100
const KLING_POLL_MS = 3000
/** 图像通用档的尺寸,同 web ImageGenerator 默认档位(1024×1024) */
const DEFAULT_IMAGE_SIZE = '1024x1024'
/** 音乐时长(秒),同 web MusicGenerator 默认档 */
const DEFAULT_MUSIC_DURATION = 60
/** 3D 结果格式,同 web Model3DGenerator 默认档 */
const DEFAULT_3D_FORMAT = 'glb'
/** 语音默认音色,同 web AudioGenerator 默认档 */
const DEFAULT_VOICE = 'female'

const MODE_LABEL_KEY: Record<string, string> = {
  text: 'tabText',
  code: 'tabCode',
  generic: 'tabGeneric',
  qwen: 'tabQwen',
  doubao: 'tabDoubao',
  jimeng: 'tabJimeng',
  agnes: 'tabAgnes',
  kling: 'tabKling',
}

/** 各类型已接真腿的子档(未接真腿的厂商档不渲染,避免死按钮) */
const MODE_VALUES: Record<AiGenerationType, string[]> = {
  auto: ['text', 'code'],
  image: ['qwen', 'doubao', 'jimeng', 'agnes'],
  video: ['generic', 'kling'],
  '3d': [],
  audio: [],
  music: [],
}

/** 各类型默认子档 */
const DEFAULT_MODE: Record<AiGenerationType, string> = {
  auto: 'text',
  image: 'qwen',
  video: 'generic',
  '3d': 'generic',
  audio: 'generic',
  music: 'generic',
}

function placeholderKeyFor(type: AiGenerationType, mode: string): string {
  if (type === 'auto') return mode === 'code' ? 'codePromptPlaceholder' : 'textPromptPlaceholder'
  if (type === 'image') return 'imagePromptPlaceholder'
  if (type === 'audio') return 'audioPromptPlaceholder'
  if (type === '3d') return 'model3dPromptPlaceholder'
  return 'defaultPromptPlaceholder'
}

/**
 * RN 端「AI 内容生成」薄壳 —— 承载 web /ai-generation。渲染委托共享屏,本文件只管:
 * 取数(逐条端点证据见 packages/api-client/src/endpoints/ai-generation.ts 头注)、
 * 子档 chips 组装、结果提取(extractText / extractMediaUrls,与 web 同一实现)、
 * Kling 异步轮询(100 次 × 3s,同 web PageClient.tsx:71-83)、媒体地址外部打开。
 * 登录门:生成接口全部需登录(proxy-llm.ts:270-273 等 preHandler),未登录不发注定 401 的请求。
 * 未承载:vision 类型与其余厂商子面板(见共享屏尾注与 manifest ledger),不渲染即不造假入口。
 */
export function AiGenerationScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [type, setType] = useState<AiGenerationType>('auto')
  const [modeMap, setModeMap] = useState<Record<AiGenerationType, string>>(DEFAULT_MODE)
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiGenerationResultView | null>(null)

  const mode = modeMap[type]

  const modes: AiGenerationModeOption[] = useMemo(
    () =>
      MODE_VALUES[type].map((value) => ({
        value,
        label: t(`${NS}.${MODE_LABEL_KEY[value] ?? 'tabGeneric'}`),
      })),
    [type, t],
  )

  const pickText = useCallback((data: unknown): AiGenerationResultView | null => {
    const text = extractText(data)
    return text ? { kind: 'text', value: text } : null
  }, [])

  const pickMedia = useCallback((data: unknown): AiGenerationResultView | null => {
    const url = extractMediaUrls(data)[0]
    return url ? { kind: 'media', value: url } : null
  }, [])

  /** Kling 两步:提交拿 task_id → 轮询至 succeed/fail(web PageClient.tsx:63-84 同口径) */
  const runKling = useCallback(
    async (text: string): Promise<AiGenerationResultView | null> => {
      const submit = await submitKlingVideo(text)
      if (!submit.success) {
        setError(submit.error ?? t('common.loadFailed'))
        return null
      }
      const taskId = submit.data?.task_id
      if (!taskId) {
        setError(t('common.loadFailed'))
        return null
      }
      for (let attempt = 0; attempt < KLING_MAX_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, KLING_POLL_MS))
        const poll = await getKlingTask(taskId)
        if (!poll.success) {
          setError(poll.error ?? t('common.loadFailed'))
          return null
        }
        const status = (poll.data as { task_status?: string } | undefined)?.task_status
        if (status === 'succeed') {
          const media = pickMedia(poll.data)
          if (!media) setError(t('common.loadFailed'))
          return media
        }
        if (status === 'fail') {
          setError(t('common.loadFailed'))
          return null
        }
      }
      setError(t('common.loadFailed'))
      return null
    },
    [pickMedia, t],
  )

  const submit = useCallback(async () => {
    if (!user) return
    if (!prompt.trim()) {
      setError(t(`${NS}.promptRequired`))
      return
    }
    setGenerating(true)
    setError(null)
    setResult(null)
    const text = prompt.trim()
    try {
      let next: AiGenerationResultView | null = null
      if (type === 'auto') {
        const res =
          mode === 'code'
            ? await generateAiCode(text, 'TypeScript')
            : await generateAiText(text)
        if (!res.success || !res.data) setError(res.error ?? t('common.loadFailed'))
        else next = pickText(res.data)
      } else if (type === 'image') {
        const res = await generateAiImage(mode as AiImageProvider, text, DEFAULT_IMAGE_SIZE)
        if (!res.success || !res.data) setError(res.error ?? t('common.loadFailed'))
        else next = pickMedia(res.data)
      } else if (type === 'video') {
        if (mode === 'kling') {
          next = await runKling(text)
        } else {
          const res = await generateAiVideo(text)
          if (!res.success || !res.data) setError(res.error ?? t('common.loadFailed'))
          else next = pickMedia(res.data)
        }
      } else if (type === 'audio') {
        const res = await generateAiSpeech(text, DEFAULT_VOICE)
        if (!res.success || !res.data) setError(res.error ?? t('common.loadFailed'))
        else next = pickMedia(res.data)
      } else if (type === 'music') {
        const res = await generateAiMusic(text, '', DEFAULT_MUSIC_DURATION)
        if (!res.success || !res.data) setError(res.error ?? t('common.loadFailed'))
        else next = pickMedia(res.data)
      } else {
        const res = await generateAi3D(text, DEFAULT_3D_FORMAT)
        if (!res.success || !res.data) setError(res.error ?? t('common.loadFailed'))
        else next = pickMedia(res.data)
      }
      if (next) setResult(next)
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setGenerating(false)
    }
  }, [user, prompt, type, mode, t, pickText, pickMedia, runKling])

  return (
    <SharedAiGenerationScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      type={type}
      onTypeChange={(value) => {
        setType(value)
        setError(null)
        setResult(null)
      }}
      modes={modes}
      mode={mode}
      onModeChange={(value) => {
        setModeMap((prev) => ({ ...prev, [type]: value }))
        setError(null)
        setResult(null)
      }}
      prompt={prompt}
      onPromptChange={setPrompt}
      promptPlaceholderKey={placeholderKeyFor(type, mode)}
      generating={generating}
      error={error}
      result={result}
      onSubmit={() => {
        void submit()
      }}
      onClear={() => {
        setResult(null)
        setError(null)
      }}
      onOpenMedia={(url) => {
        if (url) void Linking.openURL(url).catch(() => undefined)
      }}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
