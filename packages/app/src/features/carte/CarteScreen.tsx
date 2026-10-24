// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, type ReactNode } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { Users } from 'lucide-react-native'
import { rnRadius } from '@ihui/design-tokens'
import { CARTE_I18N_KEYS, CARTE_SEGMENTS, type CarteSegment } from '@ihui/shared/constants'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import type { CarteScreenProps } from '../../types'

/**
 * 社群宣传卡共享屏(RN 端唯一实现,props 注入式跨端组件)。
 *
 * 语义真相源 = 历史项目 `pagesA/carte/index.vue` 的社群宣传卡(RN 端与 web 端 `/carte`
 * 走的都是这一页);段落构成/顺序/取词键/字形名一律取自
 * `@ihui/shared/constants` 的 `CARTE_SEGMENTS`,小程序端 `pkg-content/carte/index.tsx`
 * 按同一张表出段 ⇒ 三端不会再各自漂成一份(AGENTS §0.6)。
 *
 * 图片资源本体按端注入(RN 是 Metro 的 require() 数字句柄,web/小程序是 URL/分包路径),
 * 因此屏本身零端内私有依赖;页头返回键复用 `BackChevron`(守门 102 的 S0 唯一实现)。
 */
export function CarteScreen({
  t,
  avatarSource,
  qrcodeSource,
  onBack,
  colorScheme = 'light',
}: CarteScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const renderSegment = (seg: CarteSegment): ReactNode => {
    switch (seg.id) {
      case 'hero':
        return (
          <View key={seg.id} style={styles.hero}>
            <Image source={avatarSource} style={styles.heroAvatar} resizeMode="cover" />
            <View style={styles.heroTexts}>
              {seg.textKeys.map((key, row) => (
                <Text key={key} style={row === 0 ? styles.heroLead : styles.heroSub}>
                  {t(key)}
                </Text>
              ))}
            </View>
          </View>
        )
      case 'invite':
        return (
          <View key={seg.id} style={styles.invite}>
            {seg.textKeys.map((key) => (
              <Text key={key} style={styles.inviteText}>
                {t(key)}
              </Text>
            ))}
          </View>
        )
      case 'qrcode':
        return (
          <View key={seg.id} style={styles.qrWrap}>
            <Image source={qrcodeSource} style={styles.qrImage} resizeMode="contain" />
          </View>
        )
      case 'scan':
        return (
          <View key={seg.id} style={styles.scanRow}>
            <Users size={14} color={tk.text.secondary} />
            {seg.textKeys.map((key) => (
              <Text key={key} style={styles.scanText}>
                {t(key)}
              </Text>
            ))}
          </View>
        )
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t(CARTE_I18N_KEYS.title)}</Text>
      </View>

      <View style={styles.card} testID="carte-promo-card">
        {CARTE_SEGMENTS.map((seg) => renderSegment(seg))}
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, padding: 16 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      overflow: 'hidden',
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: tk.brandAccent.DEFAULT,
      borderTopLeftRadius: rnRadius['2xl'],
      borderTopRightRadius: rnRadius['2xl'],
    },
    heroAvatar: { width: 64, height: 64, borderRadius: rnRadius.xl },
    heroTexts: { flex: 1 },
    heroLead: { fontSize: 16, fontWeight: '700', color: tk.brandAccent.foreground },
    heroSub: { marginTop: 4, fontSize: 14, color: tk.brandAccent.foreground },
    invite: { marginTop: 16, paddingHorizontal: 12 },
    inviteText: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      color: tk.text.primary,
    },
    qrWrap: { alignItems: 'center', marginTop: 16 },
    qrImage: { width: 192, height: 192 },
    scanRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
      marginBottom: 16,
    },
    scanText: { fontSize: 12, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
