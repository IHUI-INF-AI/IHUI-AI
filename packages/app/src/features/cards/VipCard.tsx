import { Fragment, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

export interface VipCardProps {
  /** VIP 等级 1-9 */
  level: number
  /** 到期时间(ISO 字符串) */
  expireDate: string
  /** 权益列表 */
  benefits: string[]
  onPress?: () => void
  colorScheme?: 'light' | 'dark'
}

const VIP_BG = '#F59E0B'
const VIP_TEXT = '#FFFFFF'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * VipCard — VIP 会员卡(跨端共享)。
 *
 * 纯展示组件:等级徽章 + 到期时间 + 权益标签,数据由调用方传入。
 * 样式遵循 packages/app 现有模式(StyleSheet + getTokens),暗色模式经 colorScheme 切换。
 */
export function VipCard({ level, expireDate, benefits, onPress, colorScheme = 'light' }: VipCardProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const safeLevel = Math.max(1, Math.min(9, Math.trunc(level) || 1))
  const visibleBenefits = benefits.slice(0, 4)
  const overflow = benefits.length - visibleBenefits.length

  const inner = (
    <Fragment>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View style={styles.vipBadge}>
            <Text style={styles.vipBadgeText}>{`VIP${safeLevel}`}</Text>
          </View>
          <Text style={styles.title}>会员尊享</Text>
        </View>
        <Text style={styles.expireText}>到期 {formatDate(expireDate)}</Text>
      </View>

      {visibleBenefits.length > 0 ? (
        <View style={styles.benefitsWrap}>
          {visibleBenefits.map((b, i) => (
            <View key={`${i}-${b}`} style={styles.benefitTag}>
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
          {overflow > 0 ? (
            <View style={[styles.benefitTag, styles.overflowTag]}>
              <Text style={styles.benefitText}>{`+${overflow}`}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Fragment>
  )

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
        {inner}
      </Pressable>
    )
  }
  return <View style={styles.card}>{inner}</View>
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    card: { backgroundColor: tk.surface.muted, borderRadius: 8, padding: 16, gap: 12 },
    pressed: { opacity: 0.85 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    vipBadge: { backgroundColor: VIP_BG, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    vipBadgeText: { color: VIP_TEXT, fontSize: 12, fontWeight: '700' },
    title: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    expireText: { fontSize: 12, color: tk.text.secondary },
    benefitsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    benefitTag: { backgroundColor: tk.surface.card, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    overflowTag: { backgroundColor: 'transparent', borderWidth: 1, borderColor: tk.border.light },
    benefitText: { fontSize: 11, color: tk.text.secondary },
  })
}
