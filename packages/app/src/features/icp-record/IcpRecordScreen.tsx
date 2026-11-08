// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { Linking, View, Text, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { IcpRecordScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { Tappable } from '@ihui/ui-native'
import {
  ICP_APP_FILING_NUMBER,
  ICP_FILING_DATE,
  ICP_MIIT_URL,
  ICP_PUBLIC_SECURITY_NUMBER,
} from '@ihui/shared'

export type { IcpRecordScreenProps }

const ICP_NO = ICP_APP_FILING_NUMBER
/**
 * 标签键与值显式成对,不再用「数组下标 → label${index}」。
 * 62b61b5816 在 label1 后插入公网安备号而没补标签,下标配对让 label1–label5 整体错位;
 * 显式成对后新增行只影响自己。公网安备号与备案时间都是合规要素,不得删。
 * 备案范围(icpRecord.label5)共享源没有对应值,本屏不渲染;web 侧保留该行。
 *
 * href 是行模型的可选字段,不是「只有一端会传的 prop」:
 * 有 href 的行在本屏自己渲染成外链(web 走 react-native-web 的 Linking.openURL,
 * RN/小程序走各自 Linking 实现),两端行为一致,不需要宿主动手补链接。
 */
const ICP_ROWS: { labelKey: string; value: string; href?: string }[] = [
  { labelKey: 'icpRecord.label0', value: ICP_NO },
  { labelKey: 'icpRecord.labelPublicSecurity', value: ICP_PUBLIC_SECURITY_NUMBER },
  { labelKey: 'icpRecord.label1', value: '吉林省爱智汇人工智能科技有限公司' },
  { labelKey: 'icpRecord.label2', value: '企业' },
  { labelKey: 'icpRecord.label3', value: ICP_FILING_DATE },
  { labelKey: 'icpRecord.label4', value: 'aizhs.top', href: ICP_MIIT_URL },
]

export function IcpRecordScreen({
  t,
  onBack,
  onCopy,
  onQuery,
  colorScheme = 'light',
}: IcpRecordScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('icpRecord.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {onCopy ? (
          <View style={styles.card}>
            <Text style={styles.label}>{t('icpRecord.label0')}</Text>
            <Tappable onPress={() => onCopy(ICP_NO)}>
              <Text style={styles.value}>{ICP_NO}</Text>
            </Tappable>
            <Text style={styles.hint}>{t('icpRecord.copyHint')}</Text>
          </View>
        ) : null}

        <View style={[styles.card, styles.tableCard]}>
          {ICP_ROWS.map(({ labelKey, value, href }) => (
            <View key={labelKey} style={styles.row}>
              <Text style={styles.rowLabel}>{t(labelKey)}</Text>
              {href ? (
                <Tappable
                  accessibilityRole="link"
                  onPress={() => {
                    void Linking.openURL(href)
                  }}
                  style={styles.rowLinkWrap}
                >
                  <Text style={[styles.rowValue, styles.rowLink]}>{value}</Text>
                </Tappable>
              ) : (
                <Text style={styles.rowValue}>{value}</Text>
              )}
            </View>
          ))}
        </View>

        {onQuery ? (
          <Tappable onPress={onQuery} style={styles.queryButton}>
            <Text style={styles.queryText}>{t('icpRecord.query')}</Text>
          </Tappable>
        ) : null}

        <Text style={styles.footer}>{t('icpRecord.footer')}</Text>
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
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    body: { padding: rnSpacing['md-loose'], paddingBottom: rnSpacing['3xl'], gap: rnSpacing.md },
    card: {
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    tableCard: { paddingVertical: rnSpacing.sm },
    label: { fontSize: rnType.body.size, color: tk.text.tertiary, marginBottom: rnSpacing.sm },
    value: { fontSize: rnType.subtitle.size, color: tk.text.primary, fontWeight: '500' },
    hint: { fontSize: rnType.caption.size, color: tk.text.tertiary, marginTop: rnSpacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: rnSpacing.md,
      paddingVertical: rnSpacing.md,
    },
    rowLabel: { fontSize: rnType.body.size, color: tk.text.tertiary, flexShrink: 0 },
    rowValue: {
      fontSize: rnType.body.size,
      color: tk.text.primary,
      textAlign: 'right',
      flex: 1,
    },
    rowLinkWrap: { flex: 1, alignItems: 'flex-end' },
    rowLink: { color: tk.brandAccent.DEFAULT, textDecorationLine: 'underline' },
    queryButton: {
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    queryText: {
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    footer: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      lineHeight: rnType.body.lineHeight,
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: rnSpacing.md,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
