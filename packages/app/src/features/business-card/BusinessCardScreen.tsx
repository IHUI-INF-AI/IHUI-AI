import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { BusinessCardItem, BusinessCardScreenProps } from '../../types'

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
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>电子名片</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{error}</Text>
        </View>
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
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.card },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      paddingTop: 48,
      gap: 12,
    },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    muted: { fontSize: 13, color: tk.text.secondary },
    card: {
      marginHorizontal: 16,
      padding: 16,
      borderRadius: 8,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.purple.light,
    },
    avatarText: { fontSize: 24, fontWeight: '700', color: tk.purple.DEFAULT },
    headerInfo: { marginLeft: 12, flex: 1 },
    name: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    position: { marginTop: 2, fontSize: 12, color: tk.purple.DEFAULT },
    company: { marginTop: 2, fontSize: 12, color: tk.text.secondary },
    bio: { marginTop: 12, fontSize: 13, lineHeight: 20, color: tk.text.medium },
    contactsBox: {
      marginTop: 12,
      padding: 16,
      borderRadius: 6,
      backgroundColor: tk.surface.muted,
    },
    contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    contactLabel: { width: 40, fontSize: 11, color: tk.text.secondary },
    contactValue: { flex: 1, fontSize: 13, color: tk.text.primary },
    qrWrap: { marginTop: 16, alignItems: 'center' },
    qrBox: {
      width: 140,
      height: 140,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      backgroundColor: tk.surface.muted,
    },
    qrPlaceholder: {
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: 2,
      color: tk.text.tertiary,
    },
    qrTip: { marginTop: 8, fontSize: 11, color: tk.text.secondary },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    actionBtnText: { fontSize: 13, color: tk.text.medium },
    actionPrimary: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 6,
      backgroundColor: tk.brand.DEFAULT,
    },
    actionPrimaryText: { fontSize: 13, fontWeight: '600', color: tk.surface.light },
  })
}
