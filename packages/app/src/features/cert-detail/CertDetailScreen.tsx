// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

/** 证书详情共享屏 — props 注入式跨端组件 */
import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CertDetailScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/**
 * 证书详情共享屏 — 平台无关 UI 渲染。
 *
 * 负责 loading / error / null 三态 + 正常态 ScrollView 卡片渲染
 * (header 返回 + 标题 + 证书信息卡片 + 验证按钮)。
 * 平台特定(导航 / API 调用 / 跳转验证页)由 wrapper 通过 props 注入。
 */
export function CertDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  onVerify,
  colorScheme = 'light',
}: CertDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error || !item) {
    return (
      <View style={styles.container}>
        {/* 原错误/空态只有「返回」一个动作,这里如实沿用该动作(不新增键) */}
        <ErrorState
          message={error || t('certDetail.loadFailed')}
          onRetry={onBack}
          retryLabel={t('common.back')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('certDetail.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.certTitle}>{item.title}</Text>
          <Text style={styles.certNo}>
            {t('certDetail.certNo')}: {item.certNo}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.label}>{t('certDetail.holder')}</Text>
          <Text style={styles.value}>{item.holder}</Text>
          <Text style={styles.label}>{t('certDetail.issuer')}</Text>
          <Text style={styles.value}>{item.issuer}</Text>
          <Text style={styles.label}>{t('certDetail.score')}</Text>
          <Text style={styles.value}>{item.score}</Text>
          <Text style={styles.label}>{t('certDetail.issuedAt')}</Text>
          <Text style={styles.value}>{item.issuedAt}</Text>
          {item.expiredAt ? (
            <>
              <Text style={styles.label}>{t('certDetail.expiredAt')}</Text>
              <Text style={styles.value}>{item.expiredAt}</Text>
            </>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.verifyBtn}
          onPress={() => onVerify?.(item.certNo)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.verifyText}>{t('certDetail.verify')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    body: { padding: 10 },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    card: {
      borderWidth: 2,
      borderColor: tk.success.DEFAULT,
      backgroundColor: `${tk.success.DEFAULT}1A`,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
    },
    certTitle: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    certNo: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    divider: {
      marginVertical: rnSpacing.md,
      height: 1,
      backgroundColor: tk.success.DEFAULT,
    },
    label: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.tertiary },
    value: { marginTop: rnSpacing.sm, fontSize: rnType.title.size, color: tk.text.primary },
    verifyBtn: {
      marginTop: rnSpacing.lg,
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: tk.success.DEFAULT,
      paddingVertical: rnSpacing.md,
      paddingHorizontal: rnSpacing['2xl'],
      borderRadius: rnRadius.sm,
    },
    verifyText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.success.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
