import { useMemo } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { VideoPlayerProgress, VideoPlayerScreenProps } from '../../types'

export type { VideoPlayerProgress, VideoPlayerScreenProps }

/**
 * 视频播放器共享屏 — props 注入式跨端组件
 *
 * 平台无关:渲染 header(黑色)+ 播放器 slot + 进度条 + 完成按钮。
 * 平台特定(实际视频播放组件)由 wrapper 通过 playerContent 注入。
 */
export function VideoPlayerScreen({
  t,
  title,
  videoUrl,
  progress,
  completed,
  completing,
  loading,
  error,
  onComplete,
  onBack,
  playerContent,
  colorScheme = 'light',
}: VideoPlayerScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.centerDark}>
        <ActivityIndicator color={tk.surface.light} />
        <Text style={styles.mutedLight}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title ?? ''}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {videoUrl ? (
        playerContent ?? (
          <View style={styles.noUrlBox}>
            <Text style={styles.noUrlText}>{t('player.noUrl')}</Text>
          </View>
        )
      ) : (
        <View style={styles.noUrlBox}>
          <Text style={styles.noUrlText}>{t('player.noUrl')}</Text>
          <Text style={styles.playerHint}>{t('course.player')}</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.progressTitle}>{t('course.progress')}</Text>
        {progress ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round((progress.completedLessons / Math.max(progress.totalLessons, 1)) * 100)}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {t('course.progressLessons', {
                completed: progress.completedLessons,
                total: progress.totalLessons,
              })}
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.completeWrap}>
          {completed ? (
            <View style={styles.completedBox}>
              <Text style={styles.completedText}>✓ {t('course.completed')}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.completeBtn, completing && styles.completeBtnDisabled]}
              onPress={onComplete}
              disabled={completing}
            >
              <Text style={styles.completeBtnText}>
                {completing ? t('common.loading') : t('course.complete')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.gray.black },
    centerDark: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.gray.black,
    },
    mutedLight: { marginTop: 8, fontSize: 13, color: tk.text.tertiary },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 12,
      backgroundColor: tk.gray.black,
    },
    backText: { fontSize: 16, color: tk.surface.light },
    headerTitle: { flex: 1, fontSize: 14, color: tk.surface.light, marginHorizontal: 12 },
    headerSpacer: { width: 40 },
    noUrlBox: {
      aspectRatio: 16 / 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.gray[900],
    },
    noUrlText: { fontSize: 16, color: tk.gray[400] },
    playerHint: { marginTop: 8, fontSize: 12, color: tk.gray[500] },
    body: { flex: 1, backgroundColor: tk.surface.light, padding: 16 },
    progressTitle: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    progressWrap: { marginTop: 8 },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: tk.surface.card,
    },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: tk.success.DEFAULT },
    progressText: { marginTop: 4, fontSize: 12, color: tk.text.tertiary },
    errorText: { marginTop: 8, fontSize: 12, color: tk.danger.DEFAULT },
    completeWrap: { marginTop: 24 },
    completedBox: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: tk.success.light,
    },
    completedText: { fontSize: 14, color: tk.success.deepText },
    completeBtn: {
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
      alignItems: 'center',
    },
    completeBtnDisabled: { backgroundColor: tk.text.tertiary },
    completeBtnText: { color: tk.surface.light, fontSize: 15, fontWeight: '600' },
  })
}
