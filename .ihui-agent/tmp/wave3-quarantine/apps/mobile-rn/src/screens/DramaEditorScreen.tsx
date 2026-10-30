// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { enhanceDramaScript, enhanceDramaScriptLine } from '@ihui/api-client'
import { DramaEditorScreen as SharedDramaEditorScreen } from '@ihui/rn-app'
import type { DramaEnhanceViewModel, DramaLineRewriteResult } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 后端 data.consistency 的行形(plot-advisor-service.ts:86-90);只取 message 渲染,与 web 同范围。 */
interface ConsistencyIssueWire {
  message?: unknown
}
/** 后端 data.pacing 的行形(同文件:208-213)。 */
interface PacingWire {
  score?: unknown
  suggestions?: unknown
}

/** 场景/行号必须是正整数字面,否则回落 1 —— web 直接把输入串拼进 URL,清空即 404,此处不留那条死路。 */
function toIndexParam(raw: string): string {
  return /^\d+$/.test(raw.trim()) && Number(raw.trim()) > 0 ? raw.trim() : '1'
}

/**
 * 「短剧编辑器」RN 薄壳 —— 承载 web /drama(POST /api/drama/scripts/:id/enhance 与
 * POST /api/drama/scripts/:id/scenes/:s/lines/:l/enhance)。
 *
 * 渲染全部委托共享屏 packages/app/src/features/drama/DramaEditorScreen.tsx;本文件只管平台侧:
 * 受控表单状态、两条取数、后端 unknown 载荷 → 共享屏视图模型的收窄投影,以及 client 侧必填校验
 * (校验文案与 web page.tsx:52/73 同一条 t('errors.*'))。
 */
export function DramaEditorScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const [scriptId, setScriptId] = useState('')
  const [scriptTitle, setScriptTitle] = useState('')
  const [enhancing, setEnhancing] = useState(false)
  const [enhanceError, setEnhanceError] = useState<string | null>(null)
  const [enhanceResult, setEnhanceResult] = useState<DramaEnhanceViewModel | null>(null)

  const [lineScriptId, setLineScriptId] = useState('')
  const [sceneIndex, setSceneIndex] = useState('1')
  const [lineIndex, setLineIndex] = useState('1')
  const [content, setContent] = useState('')
  const [instruction, setInstruction] = useState('')
  const [rewriting, setRewriting] = useState(false)
  const [rewriteError, setRewriteError] = useState<string | null>(null)
  const [rewriteResult, setRewriteResult] = useState<DramaLineRewriteResult | null>(null)

  const onEnhance = useCallback(async () => {
    if (!scriptId.trim()) {
      setEnhanceError(t('dramaPage.scriptIdRequired'))
      return
    }
    setEnhancing(true)
    setEnhanceError(null)
    try {
      const title = scriptTitle.trim()
      const res = await enhanceDramaScript(scriptId.trim(), title ? { title } : {})
      if (!res.success) {
        setEnhanceResult(null)
        setEnhanceError(res.error)
        return
      }
      const data = res.data
      const consistency = Array.isArray(data.consistency)
        ? data.consistency
            .map((item) => (item as ConsistencyIssueWire).message)
            .filter((m): m is string => typeof m === 'string' && m.length > 0)
        : []
      const pacing = (data.pacing ?? null) as PacingWire | null
      const suggestions = Array.isArray(pacing?.suggestions)
        ? pacing.suggestions.filter((s): s is string => typeof s === 'string' && s.length > 0)
        : []
      setEnhanceResult({
        consistency,
        pacingScore: typeof pacing?.score === 'number' ? pacing.score : null,
        pacingSuggestions: suggestions,
        outline: Array.isArray(data.outline)
          ? data.outline.filter((o): o is string => typeof o === 'string' && o.length > 0)
          : [],
      })
    } catch (e) {
      setEnhanceResult(null)
      setEnhanceError((e as Error).message)
    } finally {
      setEnhancing(false)
    }
  }, [scriptId, scriptTitle, t])

  const onRewrite = useCallback(async () => {
    if (!lineScriptId.trim() || !content.trim()) {
      setRewriteError(t('dramaPage.scriptIdAndContentRequired'))
      return
    }
    setRewriting(true)
    setRewriteError(null)
    try {
      const res = await enhanceDramaScriptLine({
        scriptId: lineScriptId.trim(),
        sceneIndex: Number(toIndexParam(sceneIndex)),
        lineIndex: Number(toIndexParam(lineIndex)),
        content: content.trim(),
        ...(instruction.trim() ? { instruction: instruction.trim() } : {}),
      })
      if (!res.success) {
        setRewriteResult(null)
        setRewriteError(res.error)
        return
      }
      setRewriteResult({
        original: res.data.original,
        rewritten: res.data.rewritten,
      })
    } catch (e) {
      setRewriteResult(null)
      setRewriteError((e as Error).message)
    } finally {
      setRewriting(false)
    }
  }, [lineScriptId, sceneIndex, lineIndex, content, instruction, t])

  return (
    <SharedDramaEditorScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      scriptId={scriptId}
      scriptTitle={scriptTitle}
      onScriptIdChange={setScriptId}
      onScriptTitleChange={setScriptTitle}
      enhancing={enhancing}
      enhanceError={enhanceError}
      enhanceResult={enhanceResult}
      onEnhance={() => void onEnhance()}
      lineScriptId={lineScriptId}
      sceneIndex={sceneIndex}
      lineIndex={lineIndex}
      content={content}
      instruction={instruction}
      onLineScriptIdChange={setLineScriptId}
      onSceneIndexChange={setSceneIndex}
      onLineIndexChange={setLineIndex}
      onContentChange={setContent}
      onInstructionChange={setInstruction}
      rewriting={rewriting}
      rewriteError={rewriteError}
      rewriteResult={rewriteResult}
      onRewrite={() => void onRewrite()}
    />
  )
}

export default DramaEditorScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
