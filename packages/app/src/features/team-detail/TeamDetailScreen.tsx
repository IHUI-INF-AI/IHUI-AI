// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TeamDetailScreenProps } from '../../types'

import { rnRadius } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'

/** TeamDetailScreen props re-export(单一来源 @ihui/types) */
export type { TeamDetailScreenProps }

/**
 * 团队成员详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染成员信息卡片 + 贡献统计 + 操作按钮。
 * 平台特定(导航/拨号/跳转)由 wrapper 通过 props 注入。
 * 2026-08-21:支持 loading/error 态(member 为 null 时按加载/失败分支渲染)。
 */
export function TeamDetailScreen({
  t,
  onBack,
  member,
  loading = false,
  error = '',
  onRetry,
  onContact,
  onViewOrders,
  colorScheme = 'light',
}: TeamDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  // 统计卡(空态时不渲染;hooks 必须在所有分支相同顺序调用,故放条件 return 之前,
  // 内部用可选链避免访问空对象)
  const stats = useMemo(
    () =>
      member
        ? [
            {
              label: t('teamDetail.transactionVolume') || '成交额',
              value: '¥' + (member.transactionVolume / 100).toFixed(2),
            },
            {
              label: t('teamDetail.commission') || '获取佣金',
              value: '¥' + (member.commission / 100).toFixed(2),
            },
            { label: t('teamDetail.orderNum') || '成交订单数', value: String(member.orderNum) },
          ]
        : [],
    [member, t],
  )

  const initials = member?.nickname ? member.nickname.slice(0, 1).toUpperCase() : '?'

  // 加载中/失败/空态(不渲染 member 卡片,避免访问空对象字段)
  if (!member) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('teamDetail.title') || '团队成员详情'}</Text>
        </View>
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          ) : (
            <>
              <Text style={styles.emptyText}>
                {error || t('teamDetail.empty') || '暂无成员信息'}
              </Text>
              {onRetry ? (
                // 按压态样式**不得写在 Pressable 的 style 上**(守门 131 那一型):Pressable 注册过
                // cssInterop,函数形态声明被 `{ ...declaration }` 清成 `{}`,整份内联样式静默消失。
                // retryBtn 的 padding/height 自己定义盒子,外层在 center(column,alignItems center)
                // 里 hug 内容 ⇒ 内层承载后盒子尺寸与位置逐像素不变。
                <Pressable onPress={onRetry} accessibilityRole="button">
                  {({ pressed }) => (
                    <View style={[styles.retryBtn, pressed ? styles.pressed : null]}>
                      <Text style={styles.retryText}>{t('common.retry') || '重试'}</Text>
                    </View>
                  )}
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('teamDetail.title') || '团队成员详情'}</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.memberCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.memberMeta}>
            <Text style={styles.nickname}>{member.nickname}</Text>
            <Text style={styles.metaText}>
              {t('teamDetail.phone')}:{member.phone}
            </Text>
            <Text style={styles.metaText}>
              {t('teamDetail.joinedAt')}:{member.joinedAt}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionRow}>
          {/* 同上(守门 131):flex/height 是外层在 actionRow 里占槽位的**布局档**,必须留在外层;
              视觉档(底色/圆角/居中)随 pressed 一起落到撑满的内层 ⇒ 两个按钮各占一半、等高 44 不变。 */}
          <Pressable
            style={styles.actionBtnBox}
            onPress={onContact}
            accessibilityRole="button"
            accessibilityLabel={t('teamDetail.contact') || '联系成员'}
          >
            {({ pressed }) => (
              <View
                style={[styles.actionBtn, styles.actionBtnPrimary, pressed ? styles.pressed : null]}
              >
                <Text style={styles.actionBtnPrimaryText}>{t('teamDetail.contact') || '联系'}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={styles.actionBtnBox}
            onPress={onViewOrders}
            accessibilityRole="button"
            accessibilityLabel={t('teamDetail.viewOrders') || '查看订单'}
          >
            {({ pressed }) => (
              <View style={[styles.actionBtn, pressed ? styles.pressed : null]}>
                <Text style={styles.actionBtnText}>{t('teamDetail.viewOrders') || '查看订单'}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    scroll: { flex: 1 },
    scrollContent: { padding: 14, gap: 12 },
    memberCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      padding: 14,
      gap: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: rnRadius['2xl'],
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 22, fontWeight: '600', color: tk.surface.light },
    memberMeta: { flex: 1, gap: 4 },
    nickname: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    metaText: { fontSize: 14, color: tk.text.secondary },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.xl,
      padding: 14,
      gap: 8,
    },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statValue: { fontSize: 18, fontWeight: '600', color: tk.brand.DEFAULT },
    statLabel: { fontSize: 14, color: tk.text.secondary },
    actionRow: { flexDirection: 'row', gap: 12 },
    // 外层 = 在 actionRow 里占一半 + 定高的布局档;视觉档在下面的 actionBtn(内层面)。
    // 拆两层是为了把按压态从 Pressable 的 style 上摘下来(守门 131 那一型),数值逐字搬移未新增。
    actionBtnBox: {
      flex: 1,
      height: 44,
    },
    actionBtn: {
      width: '100%',
      height: '100%',
      borderRadius: rnRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.card,
    },
    actionBtnPrimary: { backgroundColor: tk.brand.cta },
    actionBtnText: { fontSize: 16, fontWeight: '500', color: tk.text.primary },
    actionBtnPrimaryText: { fontSize: 16, fontWeight: '600', color: tk.surface.light },
    pressed: { opacity: 0.85 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    emptyText: { fontSize: 14, color: tk.text.secondary, textAlign: 'center' },
    retryBtn: {
      paddingHorizontal: 20,
      height: 36,
      borderRadius: rnRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.brand.cta,
    },
    retryText: { fontSize: 14, fontWeight: '500', color: tk.surface.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠