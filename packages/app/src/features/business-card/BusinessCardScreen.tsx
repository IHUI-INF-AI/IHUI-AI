// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { BusinessCardItem, BusinessCardScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 电子名片共享屏 — props 注入式跨端组件 */
export type { BusinessCardItem, BusinessCardScreenProps }

function getInitials(name: string): string {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

export function BusinessCardScreen({
  t,
  card,
  loading,
  error,
  saved,
  onShare,
  onSave,
  onEdit,
  onBack,
  onCustomize,
  onShareWechat,
  onShareMoments,
  colorScheme = 'light',
}: BusinessCardScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const contacts = card
    ? [
        { label: '电话', value: card.phone },
        { label: '微信', value: card.wechat },
        { label: '邮箱', value: card.email },
        { label: '地区', value: card.location },
      ]
    : []

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>电子名片</Text>
      </View>

      {loading ? (
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      ) : error ? (
        <ErrorState message={error} colorScheme={colorScheme} />
      ) : card ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(card.name)}</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{card.name}</Text>
              <Text style={styles.position}>{card.position || '\u2014'}</Text>
              <Text style={styles.company}>{card.company || '\u2014'}</Text>
            </View>
          </View>
          <Text style={styles.bio}>{card.bio || '\u2014'}</Text>

          <View style={styles.contactsBox}>
            {contacts.map((c) => (
              <View key={c.label} style={styles.contactRow}>
                <Text style={styles.contactLabel}>{c.label}</Text>
                <Text style={styles.contactValue}>{c.value || '\u2014'}</Text>
              </View>
            ))}
          </View>

          <View style={styles.qrWrap}>
            <View style={styles.qrBox}>
              <Text style={styles.qrPlaceholder}>QR</Text>
            </View>
            <Text style={styles.qrTip}>扫码添加名片</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
          <Text style={styles.actionBtnText}>发送好友</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onSave}>
          <Text style={styles.actionBtnText}>{saved ? '已保存' : '保存相册'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionPrimary} onPress={onEdit}>
          <Text style={styles.actionPrimaryText}>编辑名片</Text>
        </TouchableOpacity>
      </View>

      {/* 追加按钮区:定制入口 + 微信/朋友圈分享(对齐原项目 business-card/index.vue) */}
      <View style={styles.customActionRow}>
        <TouchableOpacity style={styles.customizeBtn} onPress={onCustomize}>
          <Text style={styles.customizeBtnText}>定制名片</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onShareWechat}>
          <Text style={styles.actionBtnText}>微信好友</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onShareMoments}>
          <Text style={styles.actionBtnText}>朋友圈</Text>
        </TouchableOpacity>
      </View>
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
      paddingBottom: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    card: {
      marginHorizontal: rnSpacing.lg,
      padding: 14,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: rnRadius['2xl'],
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.brand.cta,
    },
    avatarText: { fontSize: rnType.display.size, fontWeight: '700', color: tk.surface.light },
    headerInfo: { marginLeft: rnSpacing.md, flex: 1 },
    name: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    position: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.brand.DEFAULT },
    company: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    bio: {
      marginTop: rnSpacing.md,
      fontSize: rnType.body.size,
      lineHeight: 20,
      color: tk.text.medium,
    },
    contactsBox: {
      marginTop: rnSpacing.md,
      padding: 14,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.muted,
    },
    contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: rnSpacing.xs },
    contactLabel: { width: 40, fontSize: rnType.caption.size, color: tk.text.secondary },
    contactValue: { flex: 1, fontSize: rnType.body.size, color: tk.text.primary },
    qrWrap: { marginTop: rnSpacing.lg, alignItems: 'center' },
    qrBox: {
      width: 140,
      height: 140,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.muted,
    },
    qrPlaceholder: {
      fontSize: rnType.display.size,
      fontWeight: '700',
      letterSpacing: 2,
      color: tk.text.tertiary,
    },
    qrTip: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.secondary },
    actionRow: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.lg,
    },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    actionBtnText: { fontSize: rnType.body.size, color: tk.text.medium },
    actionPrimary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.brand.cta,
    },
    actionPrimaryText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.surface.light },
    customActionRow: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      paddingHorizontal: 10,
      paddingBottom: rnSpacing.lg,
    },
    customizeBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.brandAccent.deep,
      backgroundColor: tk.surface.light,
    },
    customizeBtnText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.brand.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
