// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 规则管理共享屏 —— 承载 web /rules(GET /api/rules + PATCH /api/rules/:id)。
 *
 * web 页(apps/web/app/(main)/rules/page.tsx:19-31 → 组件 rules-manager.tsx:46-153)
 * 的能力面:列表 / 新建·编辑弹窗 / 启用开关 / 删除 / 测试 / 冲突检测 / 模板库 / 全局统计 /
 * A/B 测试 / 自动生成 / 知识图谱。RN 本次只承载主路径 = 列表 + 启用态切换(同端点同参),
 * 其余弹窗族未承载(见 manifest ledger note),因此**不渲染**这些按钮,避免死按钮。
 *
 * 平台无关:取数 / 登录门 / 时间与数值格式化全部由薄壳注入,本文件只渲染与三态。
 */
import { useMemo } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native'
import { ScrollText } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'rulesPage'

export interface RuleRowView {
  id: string
  name: string
  /** 描述(可空,空则薄壳传空串) */
  description: string
  /** 作用域文案(薄壳按 scope 值注入 t(`${NS}.scopeGlobal`) 等) */
  scopeText: string
  /** 匹配类型文案(薄壳按 matchType 注入) */
  matchTypeText: string
  /** 优先级数值文案(薄壳注入 String(priority)) */
  priorityText: string
  enabled: boolean
}

export interface RulesScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web 登录态同口径) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  rows: RuleRowView[]
  /** 正在切换启用态的规则 id(禁用该行开关) */
  togglingId: string | null
  onToggle: (id: string, enabled: boolean) => void
  onRefresh: () => void
}

export function RulesScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  rows,
  togglingId,
  onToggle,
  onRefresh,
}: RulesScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          <Text style={styles.subtitle}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error || t('common.loadFailed')}</Text>
      ) : rows.length === 0 ? (
        <View style={styles.centerBlock}>
          <ScrollText size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.count}>{t(`${NS}.total`, { n: rows.length })}</Text>
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.name || '-'}
                  </Text>
                  <View style={styles.badge}>
                    <Text
                      style={[styles.badgeText, item.enabled ? styles.badgeTextOn : styles.badgeTextOff]}
                    >
                      {item.enabled ? t(`${NS}.enabled`) : t(`${NS}.disabled`)}
                    </Text>
                  </View>
                </View>
                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    {t(`${NS}.scope`)}: {item.scopeText}
                  </Text>
                  <Text style={styles.metaText}>
                    {t(`${NS}.matchType`)}: {item.matchTypeText}
                  </Text>
                  <Text style={styles.metaText}>
                    {t(`${NS}.priority`)}: {item.priorityText}
                  </Text>
                </View>
                <View style={styles.switchRow}>
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: item.enabled }}
                    disabled={togglingId === item.id}
                    onPress={() => onToggle(item.id, !item.enabled)}
                    hitSlop={8}
                  >
                    <Switch
                      value={item.enabled}
                      disabled={togglingId === item.id}
                      onValueChange={(next) => onToggle(item.id, next)}
                      trackColor={{ false: tk.surface.muted, true: tk.brand.DEFAULT }}
                    />
                  </Pressable>
                </View>
              </View>
            )}
          />
        </>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.caption.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    count: { marginTop: rnSpacing.md, fontSize: rnType.caption.size, color: tk.text.tertiary },
    list: { flex: 1, marginTop: rnSpacing.sm },
    listContent: { paddingBottom: rnSpacing['2xl'] },
    card: {
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    cardTitle: { flex: 1, fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    cardDesc: { fontSize: rnType.label.size, color: tk.text.secondary },
    badge: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
    },
    badgeText: { fontSize: rnType.caption.size },
    badgeTextOn: { color: tk.brand.DEFAULT },
    badgeTextOff: { color: tk.text.tertiary },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.md },
    metaText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    switchRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
