// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Clock,
  ExternalLink,
  FileText,
  Film,
  Images,
  Loader2,
  RefreshCw,
  Subtitles,
  XCircle,
} from 'lucide-react-native'
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createEduAiStyles, EDU_AI_PALETTE, type EduAiTone } from './edu-ai-styles'

/** 步骤名/状态与 packages/api-client/src/endpoints/edu-ai.ts VideoComposeStep* 逐字段同形(结构兼容,薄壳直传)。 */
export type EduAiVideoStepName = 'script' | 'material' | 'compose' | 'subtitle'
export type EduAiVideoStepStatus = 'pending' | 'running' | 'succeeded' | 'failed'

export interface EduAiVideoStepRow {
  name: EduAiVideoStepName
  status: EduAiVideoStepStatus
  result?: unknown
  error?: string
  startedAt?: number
  finishedAt?: number
}

export interface EduAiVideoTaskRow {
  id: string
  prompt: string
  model?: string
  status: EduAiVideoStepStatus
  steps: Record<EduAiVideoStepName, EduAiVideoStepRow>
  createdAt: number
  updatedAt: number
}

export interface EduAiVideoComposeScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  prompt: string
  model: string
  onPromptChange: (value: string) => void
  onModelChange: (value: string) => void
  creating: boolean
  createError: string | null
  onCreate: () => void
  /** 会话任务列表(后端无 GET 列表路由,薄壳自持内存态,web video-compose/page.tsx:208 同口径)。 */
  tasks: EduAiVideoTaskRow[]
  viewingTaskId: string | null
  onViewTask: (id: string) => void
  expanded: Record<string, boolean>
  onToggleStep: (taskId: string, step: EduAiVideoStepName) => void
  regenerating: { taskId: string; step: EduAiVideoStepName } | null
  onRegenerate: (taskId: string, step: EduAiVideoStepName) => void
  regenerateError: string | null
}

const STEP_KEYS: readonly EduAiVideoStepName[] = ['script', 'material', 'compose', 'subtitle']

const STATUS_LABEL_KEY: Record<EduAiVideoStepStatus, string> = {
  pending: 'eduAiPage.videoStatusPending',
  running: 'eduAiPage.videoStatusRunning',
  succeeded: 'eduAiPage.videoStatusSucceeded',
  failed: 'eduAiPage.videoStatusFailed',
}

/** 状态语义色(web STATUS_BADGE/STATUS_NODE 同源:muted/sky/emerald/rose)。 */
const STATUS_TONE: Record<EduAiVideoStepStatus, EduAiTone> = {
  pending: 'slate',
  running: 'sky',
  succeeded: 'emerald',
  failed: 'rose',
}

const STEP_LABEL_KEY: Record<EduAiVideoStepName, string> = {
  script: 'eduAiPage.videoStepScript',
  material: 'eduAiPage.videoStepMaterial',
  compose: 'eduAiPage.videoStepCompose',
  subtitle: 'eduAiPage.videoStepSubtitle',
}

const STEP_RESULT_KEY: Record<EduAiVideoStepName, string> = {
  script: 'eduAiPage.videoScriptResult',
  material: 'eduAiPage.videoMaterialResult',
  compose: 'eduAiPage.videoComposeResult',
  subtitle: 'eduAiPage.videoSubtitleResult',
}

const STEP_ICON: Record<EduAiVideoStepName, typeof FileText> = {
  script: FileText,
  material: Images,
  compose: Film,
  subtitle: Subtitles,
}

const STATUS_ICON: Record<EduAiVideoStepStatus, typeof Clock> = {
  pending: Clock,
  running: Loader2,
  succeeded: CheckCircle2,
  failed: XCircle,
}

type Styles = ReturnType<typeof createEduAiStyles>

function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/.test(value)
}

/** web video-compose/page.tsx:95 extractText 逐函数移植(脚本/字幕 chat 补全结果取文本)。 */
function extractText(result: unknown): string | null {
  if (typeof result === 'string') return result
  if (!result || typeof result !== 'object') return null
  const obj = result as Record<string, unknown>
  if (typeof obj.content === 'string' && obj.content) return obj.content
  const choices = obj.choices
  if (Array.isArray(choices)) {
    const first = choices[0] as Record<string, unknown> | undefined
    const message = first?.message as Record<string, unknown> | undefined
    if (typeof message?.content === 'string' && message.content) return message.content
  }
  return null
}

/** web video-compose/page.tsx:110 extractUrls 逐函数移植(深度遍历 result 收集 URL,媒体字段优先)。 */
function extractUrls(result: unknown): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  const push = (value: unknown): void => {
    if (typeof value === 'string' && isUrl(value) && !seen.has(value)) {
      seen.add(value)
      urls.push(value)
    }
  }
  const walk = (node: unknown, depth: number): void => {
    if (depth > 8 || node === null || node === undefined) return
    if (typeof node === 'string') {
      push(node)
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }
    if (typeof node !== 'object') return
    const record = node as Record<string, unknown>
    for (const key of ['video_url', 'url', 'cover_url', 'thumbnail_url']) {
      push(record[key])
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') walk(value, depth + 1)
    }
  }
  walk(result, 0)
  return urls
}

/** 步骤耗时(秒);startedAt/finishedAt 齐全时才返回(web page.tsx:143 同口径)。 */
function stepElapsedSeconds(step: EduAiVideoStepRow): number | null {
  if (typeof step.startedAt === 'number' && typeof step.finishedAt === 'number') {
    return Math.max(0, Math.round((step.finishedAt - step.startedAt) / 1000))
  }
  return null
}

function StatusBadge({
  status,
  t,
  styles,
}: {
  status: EduAiVideoStepStatus
  t: TFunction
  styles: Styles
}) {
  const tone = EDU_AI_PALETTE[STATUS_TONE[status]]
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeText, { color: tone.fg }]}>{t(STATUS_LABEL_KEY[status])}</Text>
    </View>
  )
}

function UrlRow({
  url,
  styles,
  tk,
}: {
  url: string
  styles: Styles
  tk: ReturnType<typeof getTokens>
}) {
  return (
    <TouchableOpacity
      style={styles.linkRow}
      activeOpacity={0.75}
      accessibilityRole="link"
      onPress={() => {
        void Linking.openURL(url)
      }}
    >
      <ExternalLink size={13} color={tk.brandAccent.DEFAULT} strokeWidth={2} />
      <Text style={styles.linkText} numberOfLines={2}>
        {url}
      </Text>
    </TouchableOpacity>
  )
}

/** 步骤结果展开视图(web StepResultView 同口径:material/compose 取 URL 列表,其余取文本,兜底 JSON)。 */
function StepResultView({
  step,
  t,
  styles,
  tk,
}: {
  step: EduAiVideoStepRow
  t: TFunction
  styles: Styles
  tk: ReturnType<typeof getTokens>
}) {
  const title = t(STEP_RESULT_KEY[step.name])
  if (step.name === 'material' || step.name === 'compose') {
    const urls = extractUrls(step.result)
    if (urls.length > 0) {
      return (
        <View style={styles.resultBox}>
          <Text style={styles.fieldLabel}>{title}</Text>
          {urls.map((url, i) => (
            <UrlRow key={`${i}-${url}`} url={url} styles={styles} tk={tk} />
          ))}
        </View>
      )
    }
  }
  const text = extractText(step.result)
  if (text) {
    return (
      <View style={styles.resultBox}>
        <Text style={styles.fieldLabel}>{title}</Text>
        <Text style={styles.resultText}>{text}</Text>
      </View>
    )
  }
  return (
    <View style={styles.resultBox}>
      <Text style={styles.resultText}>
        {typeof step.result === 'string' ? step.result : JSON.stringify(step.result, null, 2)}
      </Text>
    </View>
  )
}

/**
 * edu-ai AI 视频编排共享屏(Wave2 2026-10-26,台账 edu-ai/video-compose 路由)。
 *
 * 结构对齐 web apps/web/app/(main)/edu-ai/video-compose/page.tsx:创建区(prompt/model)+
 * 四步流程时间线(script/material/compose/subtitle)+ 会话历史任务列表;
 * 创建/轮询/regenerate 全部由薄壳驱动(apps/mobile-rn/src/screens/EduAiVideoComposeScreen.tsx),本屏纯展示。
 * web 端 compose 步骤内嵌 <video> 播放器,RN 端以 Linking.openURL 打开合成结果链接替代。
 */
export function EduAiVideoComposeScreen({
  t,
  colorScheme = 'light',
  onBack,
  prompt,
  model,
  onPromptChange,
  onModelChange,
  creating,
  createError,
  onCreate,
  tasks,
  viewingTaskId,
  onViewTask,
  expanded,
  onToggleStep,
  regenerating,
  onRegenerate,
  regenerateError,
}: EduAiVideoComposeScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createEduAiStyles(tk), [tk])

  const viewTask =
    (viewingTaskId ? tasks.find((task) => task.id === viewingTaskId) : undefined) ??
    tasks[0] ??
    null

  const failedStep = viewTask
    ? STEP_KEYS.map((key) => viewTask.steps[key]).find((step) => step.status === 'failed')
    : undefined

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle}>{t('eduAiPage.videoTitle')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.heroSubtitle}>{t('eduAiPage.videoSubtitle')}</Text>
        </View>

        {/* 创建区 */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{t('eduAiPage.videoPromptLabel')}</Text>
          <TextInput
            style={styles.textarea}
            value={prompt}
            onChangeText={onPromptChange}
            placeholder={t('eduAiPage.videoPromptPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            accessibilityLabel={t('eduAiPage.videoPromptLabel')}
            multiline
            maxLength={300}
          />
          <Text style={styles.counter}>{`${prompt.length}/300`}</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              value={model}
              onChangeText={onModelChange}
              placeholder={t('eduAiPage.videoModelPlaceholder')}
              placeholderTextColor={tk.text.tertiary}
              accessibilityLabel={t('eduAiPage.videoModelPlaceholder')}
            />
            <TouchableOpacity
              style={[styles.ctaBtn, !prompt.trim() || creating ? styles.ctaBtnDisabled : null]}
              activeOpacity={0.85}
              accessibilityRole="button"
              disabled={!prompt.trim() || creating}
              onPress={onCreate}
            >
              {creating ? (
                <Loader2 size={15} color={tk.brand.ctaForeground} strokeWidth={2} />
              ) : (
                <Clapperboard size={15} color={tk.brand.ctaForeground} strokeWidth={2} />
              )}
              <Text style={styles.ctaText}>
                {creating ? t('eduAiPage.videoCreating') : t('eduAiPage.videoCreateBtn')}
              </Text>
            </TouchableOpacity>
          </View>
          {createError ? (
            <View style={styles.errorBox}>
              <XCircle size={16} color={EDU_AI_PALETTE.rose.fg} strokeWidth={2} />
              <Text style={styles.errorText}>{`${t('eduAiPage.videoError')}: ${createError}`}</Text>
            </View>
          ) : null}
        </View>

        {/* 流程展示 */}
        {viewTask ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {viewTask.prompt}
              </Text>
              <StatusBadge status={viewTask.status} t={t} styles={styles} />
            </View>
            <Text style={styles.rowSub}>{`${t('eduAiPage.videoTaskId')}: ${viewTask.id}`}</Text>
            {STEP_KEYS.map((stepKey, index) => {
              const step = viewTask.steps[stepKey]
              const isLast = index === STEP_KEYS.length - 1
              const StepIcon = STEP_ICON[stepKey]
              const NodeIcon = STATUS_ICON[step.status]
              const tone = EDU_AI_PALETTE[STATUS_TONE[step.status]]
              const elapsed = stepElapsedSeconds(step)
              const isExpanded = Boolean(expanded[`${viewTask.id}:${stepKey}`])
              const isRegenerating =
                regenerating?.taskId === viewTask.id && regenerating.step === stepKey
              return (
                <View key={stepKey} style={styles.stepRow}>
                  <View style={styles.stepNodeWrap}>
                    <View
                      style={[styles.stepNode, { borderColor: tone.fg, backgroundColor: tone.bg }]}
                    >
                      <NodeIcon size={15} color={tone.fg} strokeWidth={2} />
                    </View>
                    {!isLast ? (
                      <View
                        style={{
                          alignSelf: 'center',
                          flex: 1,
                          width: StyleSheet.hairlineWidth,
                          backgroundColor: tk.border.light,
                        }}
                      />
                    ) : null}
                  </View>
                  <View style={styles.stepMain}>
                    <View style={styles.stepHead}>
                      <View style={styles.row}>
                        <StepIcon size={14} color={tk.text.tertiary} strokeWidth={2} />
                        <Text style={styles.stepLabel}>{t(STEP_LABEL_KEY[stepKey])}</Text>
                      </View>
                      <StatusBadge status={step.status} t={t} styles={styles} />
                      {elapsed !== null ? (
                        <View style={styles.row}>
                          <Clock size={12} color={tk.text.tertiary} strokeWidth={2} />
                          <Text style={styles.rowSub}>
                            {t('eduAiPage.videoElapsed')}: {elapsed}s
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {step.status === 'succeeded' ? (
                      <TouchableOpacity
                        style={styles.row}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        onPress={() => onToggleStep(viewTask.id, stepKey)}
                      >
                        {isExpanded ? (
                          <ChevronDown size={13} color={tk.brandAccent.deep} strokeWidth={2} />
                        ) : (
                          <ChevronRight size={13} color={tk.brandAccent.deep} strokeWidth={2} />
                        )}
                        <Text style={[styles.rowSub, { color: tk.brandAccent.deep }]}>
                          {t('eduAiPage.videoDetail')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {step.status === 'failed' && step.error ? (
                      <Text style={styles.stepError}>{step.error}</Text>
                    ) : null}
                    {step.status === 'failed' ? (
                      <TouchableOpacity
                        style={[styles.outlineBtn, regenerating ? styles.ctaBtnDisabled : null]}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        disabled={Boolean(regenerating)}
                        onPress={() => onRegenerate(viewTask.id, stepKey)}
                      >
                        {isRegenerating ? (
                          <Loader2 size={13} color={tk.text.secondary} strokeWidth={2} />
                        ) : (
                          <RefreshCw size={13} color={tk.text.secondary} strokeWidth={2} />
                        )}
                        <Text style={styles.outlineBtnText}>{t('eduAiPage.videoRegenerate')}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {isExpanded && step.status === 'succeeded' ? (
                      <StepResultView step={step} t={t} styles={styles} tk={tk} />
                    ) : null}
                  </View>
                </View>
              )
            })}
            {regenerateError ? (
              <View style={styles.errorBox}>
                <XCircle size={16} color={EDU_AI_PALETTE.rose.fg} strokeWidth={2} />
                <Text style={styles.errorText}>
                  {`${t('eduAiPage.videoError')}: ${regenerateError}`}
                </Text>
              </View>
            ) : null}
            {viewTask.status === 'failed' && !regenerateError ? (
              <View style={styles.errorBox}>
                <XCircle size={16} color={EDU_AI_PALETTE.rose.fg} strokeWidth={2} />
                <Text style={styles.errorText}>
                  {`${t('eduAiPage.videoError')}: ${failedStep?.error ?? t('eduAiPage.videoError')}`}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 历史任务(会话态) */}
        <View style={styles.card}>
          {tasks.length === 0 ? (
            <View style={styles.emptyBox}>
              <Clapperboard size={28} color={tk.text.tertiary} strokeWidth={1.5} />
              <Text style={styles.emptyText}>{t('eduAiPage.videoNoTasks')}</Text>
            </View>
          ) : (
            tasks.map((task) => {
              const TaskStatusIcon = STATUS_ICON[task.status]
              const tone = EDU_AI_PALETTE[STATUS_TONE[task.status]]
              const isViewing = viewTask?.id === task.id
              return (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.historyRow, isViewing ? styles.historyRowActive : null]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  onPress={() => onViewTask(task.id)}
                >
                  <View
                    style={[
                      styles.stepNode,
                      { width: 28, height: 28, borderColor: tone.fg, backgroundColor: tone.bg },
                    ]}
                  >
                    <TaskStatusIcon size={13} color={tone.fg} strokeWidth={2} />
                  </View>
                  <View style={styles.historyMain}>
                    <Text style={styles.historyPrompt} numberOfLines={1}>
                      {task.prompt}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {`${t('eduAiPage.videoTaskId')}: ${task.id}`}
                    </Text>
                  </View>
                  <StatusBadge status={task.status} t={t} styles={styles} />
                </TouchableOpacity>
              )
            })
          )}
        </View>
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
