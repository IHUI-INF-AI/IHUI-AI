// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { getTokens } from '../../theme/tokens'
import { createExamIntroStyles } from './exam-intro-styles'

export interface ExamIntroStat {
  label: string
  value: string
}

export interface ExamIntroHistoryRow {
  key: string
  statusText: string
  timeText: string
  scoreText: string
  passed: boolean
}

export interface ExamIntroScreenProps {
  headerTitle: string
  title: string
  description?: string | null
  stats: ExamIntroStat[]
  participants?: { label: string; value: string; passedLabel: string; passedValue: string } | null
  rules?: { title: string; items: string[] } | null
  history?: { title: string; emptyText: string; items: ExamIntroHistoryRow[] } | null
  state: 'loading' | 'ready' | 'error'
  loadingText: string
  errorText: string
  retryText: string
  startText: string
  startingText: string
  starting: boolean
  onStart: () => void
  onRetry: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 「试卷介绍」共享屏:纯 UI,不取数/不导航/不取词;文案与数据全部由端侧传入。 */
export function ExamIntroScreen({
  headerTitle,
  title,
  description,
  stats,
  participants,
  rules,
  history,
  state,
  loadingText,
  errorText,
  retryText,
  startText,
  startingText,
  starting,
  onStart,
  onRetry,
  onBack,
  colorScheme = 'light',
}: ExamIntroScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = createExamIntroStyles(tk)

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <ChevronLeft size={18} color={tk.text.secondary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
      </View>

      {state === 'loading' ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={tk.brand.DEFAULT} />
          <Text style={styles.stateText}>{loadingText}</Text>
        </View>
      ) : state === 'error' ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>{errorText}</Text>
          <Pressable style={styles.retryBtn} onPress={onRetry} accessibilityRole="button">
            <Text style={styles.retryText}>{retryText}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.paperTitle}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
            <View style={styles.statsGrid}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.statCell}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Text style={styles.statValue}>{stat.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {participants ? (
            <View style={styles.sectionCard}>
              <View style={styles.partRow}>
                <Text style={styles.partLabel}>{participants.label}</Text>
                <Text style={styles.partValue}>{participants.value}</Text>
              </View>
              <View style={styles.partRow}>
                <Text style={styles.partLabel}>{participants.passedLabel}</Text>
                <Text style={styles.partValue}>{participants.passedValue}</Text>
              </View>
            </View>
          ) : null}

          {rules ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{rules.title}</Text>
              {rules.items.map((item) => (
                <Text key={item} style={styles.ruleItem}>
                  {item}
                </Text>
              ))}
            </View>
          ) : null}

          {history ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{history.title}</Text>
              {history.items.length > 0 ? (
                history.items.map((row) => (
                  <View key={row.key} style={styles.historyRow}>
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyStatus}>{row.statusText}</Text>
                      <Text style={styles.historyMeta}>{row.timeText}</Text>
                    </View>
                    <Text
                      style={[styles.historyScore, row.passed ? null : styles.historyScoreFailed]}
                    >
                      {row.scoreText}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>{history.emptyText}</Text>
              )}
            </View>
          ) : null}

          <Pressable
            style={[styles.startBtn, starting ? styles.startBtnDisabled : null]}
            onPress={onStart}
            disabled={starting}
            accessibilityRole="button"
          >
            <Text style={styles.startText}>{starting ? startingText : startText}</Text>
          </Pressable>
          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
        </>
      )}
    </ScrollView>
  )
}
