// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { useMemo, useState, type ReactNode } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { Bot, ChevronDown, ChevronRight, Play } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import type { TFunction } from '../../types'

export type ShareLandingState = 'loading' | 'error' | 'ready'

export interface ShareLandingVideo {
  url: string
  cover?: string
  /** 平台侧播放器可据此保留原始宽高比 */
  width?: number
  height?: number
}

export interface ShareLandingAudio {
  url: string
  /** 秒 */
  duration?: number
}

export interface ShareLandingListItem {
  type: 'text' | 'image' | 'video' | 'audio'
  content: string
}

export interface ShareLandingAnswer {
  thinking?: string
  text?: string
  images?: string[]
  video?: ShareLandingVideo
  audio?: ShareLandingAudio
  lists?: ShareLandingListItem[]
}

/** 只读分享落地页的全部静态内容（不含端内数据获取与路由） */
export interface ShareLandingContent {
  modelName?: string
  modelIcon?: string
  question: string
  answer?: ShareLandingAnswer
  tokenCost?: number
  createdAt?: string
  userAvatar?: string | null
  userName?: string | null
}

export interface ShareLandingScreenProps {
  /** 沿用 `share.creation.*` / `common.*` 既有 key，小程序端零改文案 */
  t: TFunction
  state: ShareLandingState
  content: ShareLandingContent | null
  errorText?: string
  onBack: () => void
  onRetry: () => void
  onPreviewImage: (images: string[], index: number) => void
  onRegenerate: () => void
  onShareFriend: () => void
  colorScheme?: 'light' | 'dark'
  /** 缺省按 YYYY-MM-DD HH:mm 渲染；平台可注入自己的日期口径 */
  formatTime?: (iso: string) => string
  /** 平台专属插槽：小程序注入 Taro Video/Audio，web 注入 <video>/<audio> */
  renderVideo?: (video: ShareLandingVideo) => ReactNode
  renderAudio?: (audio: ShareLandingAudio) => ReactNode
  /** 平台专属正文渲染（web 走 markdown，小程序走原生 Text） */
  renderText?: (text: string) => ReactNode
  /** 平台专属底部栏；缺省为「再生成 + 分享好友」两操作 */
  footer?: ReactNode
}

export function formatShareTime(iso?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function ShareLandingScreen({
  t,
  state,
  content,
  errorText,
  onBack,
  onRetry,
  onPreviewImage,
  onRegenerate,
  onShareFriend,
  colorScheme = 'light',
  formatTime = formatShareTime,
  renderVideo,
  renderAudio,
  renderText,
  footer,
}: ShareLandingScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const answer = content?.answer ?? {}
  const images = answer.images ?? []
  const lists = answer.lists ?? []

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title} numberOfLines={1}>
          {t('share.creation.title')}
        </Text>
      </View>

      {state === 'loading' ? (
        <ScreenSkeleton variant="card" count={1} colorScheme={colorScheme} />
      ) : state === 'error' ? (
        <ErrorState
          message={errorText || t('share.creation.contentNotExist')}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : content === null ? (
        <EmptyState
          title={t('share.creation.contentNotExist')}
          actionLabel={t('common.retry')}
          onAction={onRetry}
          colorScheme={colorScheme}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.modelRow}>
              {content.modelIcon ? (
                <Image source={{ uri: content.modelIcon }} style={styles.modelIcon} />
              ) : (
                <View style={[styles.modelIcon, styles.modelIconFallback]}>
                  <Bot size={18} color={tk.text.tertiary} />
                </View>
              )}
              <View style={styles.modelBody}>
                <Text style={styles.modelName} numberOfLines={1}>
                  {content.modelName || t('share.creation.modelDefault')}
                </Text>
                {content.createdAt ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {formatTime(content.createdAt)}
                  </Text>
                ) : null}
              </View>
              {content.tokenCost ? (
                <Text style={styles.meta}>
                  {t('share.creation.tokenCost', { n: content.tokenCost })}
                </Text>
              ) : null}
            </View>

            {content.userName ? (
              <View style={styles.authorRow}>
                {content.userAvatar ? (
                  <Image source={{ uri: content.userAvatar }} style={styles.avatar} />
                ) : null}
                <Text style={styles.meta} numberOfLines={1}>
                  {content.userName}
                </Text>
              </View>
            ) : null}

            <View style={styles.questionRow}>
              <View style={styles.questionBubble}>
                <Text style={styles.questionText}>{content.question}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            {answer.thinking ? (
              <View style={styles.thinkingBlock}>
                <Pressable
                  style={styles.thinkingHeader}
                  onPress={() => setThinkingOpen((open) => !open)}
                  accessibilityRole="button"
                >
                  <Text style={styles.thinkingLabel}>{t('share.creation.thinkingProcess')}</Text>
                  {thinkingOpen ? (
                    <ChevronDown size={14} color={tk.text.tertiary} />
                  ) : (
                    <ChevronRight size={14} color={tk.text.tertiary} />
                  )}
                </Pressable>
                {thinkingOpen ? <Text style={styles.thinkingText}>{answer.thinking}</Text> : null}
              </View>
            ) : null}

            {answer.text ? (
              renderText ? (
                renderText(answer.text)
              ) : (
                <Text style={styles.answerText}>{answer.text}</Text>
              )
            ) : null}

            {images.length > 0 ? (
              <View style={styles.imageGrid}>
                {images.map((url, index) => (
                  <Pressable
                    key={`${url}-${index}`}
                    style={styles.imageCell}
                    onPress={() => onPreviewImage(images, index)}
                    accessibilityRole="imagebutton"
                  >
                    <Image source={{ uri: url }} style={styles.gridImage} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {answer.video?.url ? (
              <View style={styles.mediaBlock}>
                {renderVideo ? (
                  renderVideo(answer.video)
                ) : (
                  <FallbackVideo video={answer.video} colorScheme={colorScheme} />
                )}
              </View>
            ) : null}

            {answer.audio?.url ? (
              <View style={styles.mediaBlock}>
                {renderAudio ? (
                  renderAudio(answer.audio)
                ) : (
                  <View style={styles.audioRow}>
                    <Text style={styles.audioLabel}>{t('share.creation.voiceAnswer')}</Text>
                    {answer.audio.duration ? (
                      <Text style={styles.meta}>{`${answer.audio.duration}s`}</Text>
                    ) : null}
                  </View>
                )}
              </View>
            ) : null}

            {lists.map((item, index) => (
              <View key={`${item.type}-${index}`} style={styles.listItem}>
                {item.type === 'image' ? (
                  <Image source={{ uri: item.content }} style={styles.listImage} />
                ) : item.type === 'video' ? (
                  renderVideo ? (
                    renderVideo({ url: item.content })
                  ) : (
                    <FallbackVideo video={{ url: item.content }} colorScheme={colorScheme} />
                  )
                ) : item.type === 'audio' ? (
                  renderAudio ? (
                    renderAudio({ url: item.content })
                  ) : (
                    <Text style={styles.answerText}>{item.content}</Text>
                  )
                ) : (
                  <Text style={styles.answerText}>{item.content}</Text>
                )}
              </View>
            ))}
          </View>

          {footer ?? (
            <View style={styles.actions}>
              <Pressable
                style={[styles.actionButton, styles.actionPrimary]}
                onPress={onRegenerate}
                accessibilityRole="button"
              >
                <Text style={styles.actionPrimaryText}>{t('share.creation.regenerate')}</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.actionSecondary]}
                onPress={onShareFriend}
                accessibilityRole="button"
              >
                <Text style={styles.actionSecondaryText}>{t('share.creation.shareFriend')}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}

function FallbackVideo({
  video,
  colorScheme,
}: {
  video: ShareLandingVideo
  colorScheme: 'light' | 'dark'
}) {
  const tk = getTokens(colorScheme)
  return (
    <View style={[fallbackMediaStyles.video, { backgroundColor: tk.surface.muted }]}>
      {video.cover ? (
        <Image source={{ uri: video.cover }} style={fallbackMediaStyles.cover} resizeMode="cover" />
      ) : null}
      <Play size={24} color={tk.text.primary} />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.sm,
      paddingBottom: rnSpacing.sm,
    },
    title: {
      flex: 1,
      fontSize: rnType.heading.size,
      lineHeight: rnType.heading.lineHeight,
      fontWeight: '700',
      color: tk.text.primary,
    },
    content: {
      gap: rnSpacing.md,
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.sm,
      paddingBottom: rnSpacing['3xl'],
    },
    card: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.lg,
      gap: rnSpacing.sm,
    },
    modelRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    modelIcon: { width: 32, height: 32, borderRadius: rnRadius.md },
    modelIconFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    modelBody: { flex: 1, gap: 2 },
    modelName: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    meta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    authorRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    avatar: { width: 24, height: 24, borderRadius: rnRadius.md },
    questionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: rnSpacing.xs },
    questionBubble: {
      maxWidth: '78%',
      borderRadius: rnRadius.lg,
      backgroundColor: tk.brand.cta,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    questionText: {
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.brand.ctaForeground,
    },
    thinkingBlock: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
    },
    thinkingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    thinkingLabel: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    thinkingText: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.caption.size,
      lineHeight: rnType.caption.lineHeight,
      color: tk.text.secondary,
    },
    answerText: {
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.primary,
    },
    imageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.xs,
      marginTop: rnSpacing.xs,
    },
    imageCell: { width: '31.5%', aspectRatio: 1, borderRadius: rnRadius.md, overflow: 'hidden' },
    gridImage: { width: '100%', height: '100%' },
    mediaBlock: { marginTop: rnSpacing.xs, borderRadius: rnRadius.md, overflow: 'hidden' },
    audioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
    },
    audioLabel: { fontSize: rnType.label.size, color: tk.text.primary },
    listItem: { marginTop: rnSpacing.xs },
    listImage: { width: '100%', height: 160, borderRadius: rnRadius.md },
    actions: { flexDirection: 'row', gap: rnSpacing.md, marginTop: rnSpacing.sm },
    actionButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      paddingVertical: rnSpacing.md,
    },
    actionPrimary: { backgroundColor: tk.brand.cta },
    actionPrimaryText: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    actionSecondary: { backgroundColor: tk.surface.muted },
    actionSecondaryText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
  })
}

const fallbackMediaStyles = StyleSheet.create({
  video: {
    height: 180,
    borderRadius: rnRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
})
