// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LegalDocSection, LegalDocScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'

/** 法律文档/Props 类型 re-export(单一来源 @ihui/types) */
export type { LegalDocSection, LegalDocScreenProps }

/** 标签组(web legal/supported-regions 的地区/支付/语言 chip 列表承载,Wave1 2026-10-26 扩展)。 */
export interface LegalDocTagGroup {
  title: string
  intro?: string
  tags: string[]
  /** 受限类标签走 danger token 档(对齐 web border-destructive/bg-destructive/5)。 */
  danger?: boolean
}

/**
 * 扩展 props(Wave1 2026-10-26,legal 域四文档承载用;对 privacy/agreement 既有调用零破坏):
 * - subtitle/updatedAt 改可选;新增 updatedAtText(整串直显,web 端 lastUpdated 已含「最后更新:」标签,避免双标签);
 * - intro:正文前导语卡;groups:标签组卡(sections 可为空数组);
 * - headerless:宿主(如 LegalDocsHubScreen)自绘页头时跳过内部 header,标题降级为文首卡标题。
 */
export interface LegalDocScreenPropsEx extends Omit<LegalDocScreenProps, 'subtitle' | 'updatedAt'> {
  subtitle?: string
  updatedAt?: string
  updatedAtText?: string
  intro?: string
  groups?: LegalDocTagGroup[]
  headerless?: boolean
}

/**
 * 法律文档共享屏 — 通用静态页(隐私政策/用户协议/Cookie 政策等)
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 副标题卡片(updatedAt)+ sections 列表。
 * 平台特定(导航)由 wrapper 通过 props 注入。
 */
export function LegalDocScreen({
  t,
  title,
  subtitle,
  updatedAt,
  updatedAtText,
  intro,
  sections,
  groups,
  onBack,
  colorScheme = 'light',
  headerless = false,
}: LegalDocScreenPropsEx) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const hasMetaCard = Boolean(subtitle || updatedAt || updatedAtText || (headerless && title))

  return (
    <View style={styles.container}>
      {!headerless && (
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{title}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.body}>
        {hasMetaCard && (
          <View style={styles.card}>
            {headerless && <Text style={styles.docTitle}>{title}</Text>}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {updatedAtText ? (
              <Text style={styles.updatedAt}>{updatedAtText}</Text>
            ) : updatedAt ? (
              <Text style={styles.updatedAt}>
                {t('legalDoc.updatedAt')}: {updatedAt}
              </Text>
            ) : null}
          </View>
        )}
        {intro ? (
          <View style={styles.card}>
            <Text style={styles.introText}>{intro}</Text>
          </View>
        ) : null}
        {sections.map((section: LegalDocSection) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
        {groups?.map((group: LegalDocTagGroup) => (
          <View key={group.title} style={styles.card}>
            <Text style={styles.sectionTitle}>{group.title}</Text>
            {group.intro ? <Text style={styles.groupIntro}>{group.intro}</Text> : null}
            <View style={styles.chipRow}>
              {group.tags.map((tag) => (
                <View key={tag} style={[styles.chip, group.danger ? styles.chipDanger : null]}>
                  <Text style={[styles.chipText, group.danger ? styles.chipTextDanger : null]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    body: { padding: 14, paddingBottom: 32 },
    card: {
      padding: 14,
      marginBottom: 12,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    subtitle: { fontSize: 14, color: tk.text.secondary },
    updatedAt: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    sectionBody: { marginTop: 8, fontSize: 14, color: tk.text.medium, lineHeight: 18 },
    docTitle: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    introText: { fontSize: 14, color: tk.text.medium, lineHeight: 20 },
    groupIntro: { marginTop: 6, fontSize: 12, color: tk.text.secondary, lineHeight: 17 },
    chipRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: rnRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.inputBg,
    },
    chipText: { fontSize: 13, color: tk.text.primary },
    chipDanger: {
      borderColor: tk.danger.DEFAULT,
      backgroundColor: tk.danger.light,
    },
    chipTextDanger: { color: tk.danger.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
