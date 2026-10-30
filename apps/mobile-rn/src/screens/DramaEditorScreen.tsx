// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { enhanceDramaLine, enhanceDramaScript } from '@ihui/api-client'
import {
  DramaEditorScreen as SharedDramaEditorScreen,
  type DramaEnhanceResultView,
  type DramaLineResultView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'dramaEditorPage'

/** web 同口径:JSON.stringify(value, null, 2)(apps/web/app/(main)/drama/page.tsx:143-155) */
function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? '-'
  } catch {
    return String(value)
  }
}

/** 场次/行号输入按 web 同口径:空串或非法值回落 1(page.tsx:41-42 默认 '1') */
function toIndex(raw: string): number {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

/**
 * RN 端「短剧编辑器」薄壳 —— 承载 web /drama。渲染全部委托共享屏,本文件只管:
 * 表单状态、前置校验(web 同文案同判据 page.tsx:51-53 / 72-74)、
 * 提交 POST /api/drama/scripts/:id/enhance(drama.ts:35-48)与
 * POST /api/drama/scripts/:id/scenes/:sceneIndex/lines/:lineIndex/enhance(drama.ts:50-107)、
 * 结果预格式化(web <pre> JSON.stringify 同口径)。
 * 口径差:web 无登录门、由后端 authenticate 直接回 401,RN 同口径不做前置登录拦截,
 * 401 走错误态显示后端 message,如实登记不谎称有登录引导。
 */
export function DramaEditorScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const [scriptId, setScriptId] = useState('')
  const [title, setTitle] = useState('')
  const [enhanceLoading, setEnhanceLoading] = useState(false)
  const [enhanceError, setEnhanceError] = useState<string | null>(null)
  const [enhanceResult, setEnhanceResult] = useState<DramaEnhanceResultView | null>(null)

  const [lineScriptId, setLineScriptId] = useState('')
  const [sceneIndex, setSceneIndex] = useState('1')
  const [lineIndex, setLineIndex] = useState('1')
  const [content, setContent] = useState('')
  const [instruction, setInstruction] = useState('')
  const [lineLoading, setLineLoading] = useState(false)
  const [lineError, setLineError] = useState<string | null>(null)
  const [lineResult, setLineResult] = useState<DramaLineResultView | null>(null)

  const submitEnhance = useCallback(async () => {
    if (!scriptId.trim()) {
      setEnhanceError(t(`${NS}.errorScriptIdRequired`))
      return
    }
    setEnhanceLoading(true)
    setEnhanceError(null)
    try {
      const res = await enhanceDramaScript(scriptId.trim(), title.trim() ? { title: title.trim() } : {})
      if (!res.success || !res.data) {
        setEnhanceError(res.error ?? t('common.loadFailed'))
        return
      }
      setEnhanceResult({
        consistency: prettyJson(res.data.consistency),
        pacing: prettyJson(res.data.pacing),
        outline: prettyJson(res.data.outline),
      })
    } catch {
      setEnhanceError(t('common.loadFailed'))
    } finally {
      setEnhanceLoading(false)
    }
  }, [scriptId, title, t])

  const submitLine = useCallback(async () => {
    if (!lineScriptId.trim() || !content.trim()) {
      setLineError(t(`${NS}.errorScriptIdAndContentRequired`))
      return
    }
    setLineLoading(true)
    setLineError(null)
    try {
      const res = await enhanceDramaLine(
        lineScriptId.trim(),
        toIndex(sceneIndex),
        toIndex(lineIndex),
        instruction.trim()
          ? { content, instruction: instruction.trim() }
          : { content },
      )
      if (!res.success || !res.data) {
        setLineError(res.error ?? t('common.loadFailed'))
        return
      }
      setLineResult({ original: res.data.original, rewritten: res.data.rewritten })
    } catch {
      setLineError(t('common.loadFailed'))
    } finally {
      setLineLoading(false)
    }
  }, [lineScriptId, sceneIndex, lineIndex, content, instruction, t])

  return (
    <SharedDramaEditorScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      scriptId={scriptId}
      onScriptIdChange={setScriptId}
      title={title}
      onTitleChange={setTitle}
      enhanceLoading={enhanceLoading}
      enhanceError={enhanceError}
      enhanceResult={enhanceResult}
      onSubmitEnhance={() => {
        void submitEnhance()
      }}
      lineScriptId={lineScriptId}
      onLineScriptIdChange={setLineScriptId}
      sceneIndex={sceneIndex}
      onSceneIndexChange={setSceneIndex}
      lineIndex={lineIndex}
      onLineIndexChange={setLineIndex}
      content={content}
      onContentChange={setContent}
      instruction={instruction}
      onInstructionChange={setInstruction}
      lineLoading={lineLoading}
      lineError={lineError}
      lineResult={lineResult}
      onSubmitLine={() => {
        void submitLine()
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
