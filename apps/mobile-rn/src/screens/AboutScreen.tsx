// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { BookOpen, ChevronRight, Rocket, Sparkles } from 'lucide-react-native'
import { rnRadius } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import { WEB_BASE_URL } from '../lib/webview-portal-config'
import { rpx } from '../utils/rpx'
import {
  ABOUT_COMPLIANCE,
  ABOUT_PLATFORMS,
  ABOUT_STATS,
  ABOUT_VALUES,
  type AboutFeature,
} from './aboutPageSections'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * RN 端「关于我们」—— 段落顺序与取词照 web `app/(main)/about/AboutContent.tsx`:
 * Hero → 我们的故事 → 4 项价值观 → 6 项平台能力 → 数字见证 → CTA,再保留 7 条合规入口。
 * 分段数据在 ./aboutPageSections.ts(为把本屏压回 §3 的 250 行上限)。
 *
 * 取词全部走 `about.*`(值逐字取 web 同语种词包,只搬 AboutContent 真消费的 41 键;web 的
 * `about.metaDescription` 是 SEO 出口、本端无消费方 ⇒ 不搬);合规条目复用既有 `menu.*` 键,
 * 不抄第二份中文标签(§0.6)。CTA 落点按本端真实在册出口:注册 → Register 屏;开放平台
 * `/developer` 是一整个 web 门户目录(RN 只有 Developer 信息屏)⇒ 走既有 WebView 承载。
 */

function FeatureCard({ feature, title, desc }: FeatureCardProps) {
  const { Icon } = feature
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.iconBox}>
          <Icon size={rpx(36)} color={tokens.brandAccent.deep} strokeWidth={2} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardDesc}>{desc}</Text>
    </View>
  )
}

interface FeatureCardProps {
  feature: AboutFeature
  title: string
  desc: string
}

export function AboutScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('menu.about')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.chip}>
            <Sparkles size={rpx(24)} color={tokens.brandAccent.deep} strokeWidth={2} />
            <Text style={styles.chipText}>{t('about.heroBadge')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t('about.heroTitle')}</Text>
          <Text style={styles.bodyText}>{t('about.heroSubtitle')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.chip}>
            <BookOpen size={rpx(24)} color={tokens.brandAccent.deep} strokeWidth={2} />
            <Text style={styles.chipText}>{t('about.storyBadge')}</Text>
          </View>
          <Text style={styles.sectionTitle}>{t('about.storyTitle')}</Text>
          <Text style={styles.bodyText}>{t('about.storyP1')}</Text>
          <Text style={styles.bodyText}>{t('about.storyP2')}</Text>
        </View>

        <View style={styles.grid}>
          {ABOUT_VALUES.map((f) => (
            <View key={f.titleKey} style={styles.gridCell}>
              <FeatureCard feature={f} title={t(f.titleKey)} desc={t(f.descKey)} />
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('about.platformTitle')}</Text>
        <View style={styles.grid}>
          {ABOUT_PLATFORMS.map((f) => (
            <View key={f.titleKey} style={styles.gridCell}>
              <FeatureCard feature={f} title={t(f.titleKey)} desc={t(f.descKey)} />
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.statsCard]}>
          <Text style={styles.sectionTitle}>{t('about.numbersTitle')}</Text>
          <View style={styles.statsGrid}>
            {ABOUT_STATS.map((s) => (
              <View key={s.valueKey} style={styles.statCell}>
                <Text style={styles.statValue}>{t(s.valueKey)}</Text>
                <Text style={styles.bodyText}>{t(s.descKey)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, styles.ctaCard]}>
          <Rocket size={rpx(60)} color={tokens.brandAccent.deep} strokeWidth={2} />
          <Text style={styles.sectionTitle}>{t('about.ctaTitle')}</Text>
          <Text style={styles.bodyText}>{t('about.ctaDesc')}</Text>
          <TouchableOpacity
            style={styles.ctaPrimary}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('about.ctaPrimary')}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.ctaPrimaryText}>{t('about.ctaPrimary')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctaSecondary}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('about.ctaSecondary')}
            onPress={() =>
              navigation.navigate('WebView', {
                url: `${WEB_BASE_URL}/developer`,
                title: t('about.ctaSecondary'),
              })
            }
          >
            <Text style={styles.ctaSecondaryText}>{t('about.ctaSecondary')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{t('about.complianceTitle')}</Text>
        <View style={styles.card}>
          {ABOUT_COMPLIANCE.map((item) => (
            <TouchableOpacity
              key={item.target}
              style={styles.complianceRow}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t(item.labelKey)}
              onPress={() => navigation.navigate(item.target)}
            >
              <Text style={styles.itemLabel}>{t(item.labelKey)}</Text>
              <ChevronRight size={rpx(30)} color={tokens.text.tertiary} strokeWidth={2} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  scroll: { padding: rpx(24), paddingBottom: rpx(64), gap: rpx(24) },
  hero: { alignItems: 'center', gap: rpx(16), paddingTop: rpx(16) },
  bodyText: { fontSize: rpx(26), lineHeight: rpx(40), color: tokens.text.secondary },
  itemLabel: { fontSize: rpx(28), color: tokens.text.primary },
  chipText: { fontSize: rpx(22), fontWeight: '500', color: tokens.brandAccent.deep },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: rpx(16) },
  cardTitle: { flex: 1, fontSize: rpx(30), fontWeight: '600', color: tokens.text.primary },
  cardDesc: { fontSize: rpx(24), lineHeight: rpx(38), color: tokens.text.secondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: rpx(20) },
  gridCell: { flexGrow: 1, flexBasis: '46%' },
  statsCard: { gap: rpx(24) },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rpx(20) },
  statCell: { flexGrow: 1, flexBasis: '44%', alignItems: 'center', gap: rpx(8) },
  ctaCard: { alignItems: 'center', paddingVertical: rpx(36) },
  sectionTitle: { fontSize: rpx(36), fontWeight: '700', color: tokens.text.primary },
  statValue: { fontSize: rpx(48), fontWeight: '700', color: tokens.brandAccent.deep },
  ctaPrimaryText: { fontSize: rpx(28), fontWeight: '600', color: tokens.brand.ctaForeground },
  ctaSecondaryText: { fontSize: rpx(28), fontWeight: '600', color: tokens.text.primary },
  heroTitle: {
    fontSize: rpx(56),
    fontWeight: '700',
    textAlign: 'center',
    color: tokens.text.primary,
  },
  card: {
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.lg,
    padding: rpx(24),
    gap: rpx(16),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: rpx(10),
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(8),
    borderRadius: rnRadius.md,
    backgroundColor: tokens.brandAccent.light,
  },
  iconBox: {
    width: rpx(64),
    height: rpx(64),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.brandAccent.light,
  },
  ctaPrimary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: rpx(22),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
  },
  ctaSecondary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: rpx(22),
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
  },
  complianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: rpx(26),
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
