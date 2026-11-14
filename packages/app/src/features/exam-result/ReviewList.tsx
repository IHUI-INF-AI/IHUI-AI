// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { ExamReviewListProps } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/**
 * 题目回顾列表共享段(原小程序 ./review-list 与 web PageClient 详情列表的单源)。
 * 纯 RN 原语 + tokens;文案、单位、序号格式全部宿主注入,避免两端键族被强行合并。
 * wrongTitle 缺省时不渲染错题计数行(web 详情列表无此段)。
 */
export function ReviewList({
  items,
  title,
  labels,
  wrongTitle,
  emptyText,
  colorScheme = 'light',
}: ExamReviewListProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const wrongCount = items.filter((it) => !it.isCorrect).length

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {wrongTitle && wrongCount > 0 ? (
        <View style={styles.wrongRow}>
          <Text style={styles.wrongLabel}>{wrongTitle}</Text>
          <Text style={styles.wrongCount}>{wrongCount}</Text>
        </View>
      ) : null}
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        items.map((it, idx) => (
          <View key={it.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.index}>{labels.questionIndex(idx + 1)}</Text>
              <Text
                style={[
                  styles.status,
                  { color: it.isCorrect ? tk.success.deepText : tk.danger.DEFAULT },
                ]}
              >
                {it.isCorrect ? labels.correct : labels.wrong}
              </Text>
              <Text style={styles.score}>{labels.score(it.score)}</Text>
            </View>
            <Text style={styles.cardTitle}>{it.title}</Text>
            {it.myAnswer ? (
              <Text
                style={[
                  styles.line,
                  { color: it.isCorrect ? tk.success.deepText : tk.danger.DEFAULT },
                ]}
              >
                {labels.yourAnswer}
                {it.myAnswer}
              </Text>
            ) : null}
            {it.correctAnswer ? (
              <Text style={[styles.line, { color: tk.success.deepText }]}>
                {labels.correctAnswer}
                {it.correctAnswer}
              </Text>
            ) : null}
            {it.analysis ? (
              <Text style={[styles.line, { color: tk.text.secondary }]}>
                {labels.analysis}
                {it.analysis}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { gap: rnSpacing.md },
    title: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    wrongRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    wrongLabel: { fontSize: rnType.body.size, color: tk.text.secondary },
    wrongCount: { fontSize: rnType.body.size, fontWeight: '700', color: tk.danger.DEFAULT },
    empty: {
      paddingVertical: rnSpacing['2xl'],
      alignItems: 'center',
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    emptyText: { fontSize: rnType.body.size, color: tk.text.secondary },
    card: {
      gap: rnSpacing.sm,
      padding: rnSpacing['sm-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    index: { fontSize: rnType.label.size, color: tk.text.tertiary },
    status: { fontSize: rnType.label.size, fontWeight: '600' },
    score: { marginLeft: 'auto', fontSize: rnType.label.size, color: tk.text.secondary },
    cardTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    line: { fontSize: rnType.label.size, lineHeight: 18 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
