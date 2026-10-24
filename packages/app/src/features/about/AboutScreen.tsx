// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { BookOpen, ChevronRight, Sparkles } from 'lucide-react-native'
import {
  ABOUT_PLATFORMS,
  ABOUT_STATS,
  ABOUT_VALUES,
  type AboutFeatureEntry,
} from '@ihui/shared/constants'
import type { AboutScreenProps } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { aboutIcon } from './about-icons'
import { createAboutStyles } from './about-styles'

/**
 * 「关于我们」跨端共享屏 —— RN 端与小程序端的唯一渲染真相源。
 *
 * 段落构成与顺序(Hero → 故事 → 价值观 → 平台能力 → 数字见证 → CTA → 合规/帮助入口)
 * 取自分段表 `@ihui/shared/constants/about-sections`(两端同源,不再各抄一份)。
 * 平台侧只注入取词、取色与本端真实在册出口:`t` / `colorScheme` / `onBack` /
 * `onRegister` / `onOpenPortal` / `entries`。
 */
export interface AboutEntry {
  id: string
  label: string
  onPress: () => void
}

export interface SharedAboutScreenProps extends AboutScreenProps {
  colorScheme?: 'light' | 'dark'
  /** 主 CTA(注册);未给则不渲染该按钮(平台未必有注册屏) */
  onRegister?: () => void
  /** 次 CTA(开放平台门户):承载方式属平台侧,由调用方决定 */
  onOpenPortal?: () => void
  /** 合规/帮助入口:各端把 ABOUT_ENTRY_IDS 映射到本端在册出口后传入,顺序即渲染顺序 */
  entries?: readonly AboutEntry[]
}

type Styles = ReturnType<typeof createAboutStyles>

function Chip({
  label,
  tone,
  color,
  styles,
}: {
  label: string
  tone: 'accent' | 'plain'
  color: string
  styles: Styles
}) {
  const Icon = tone === 'accent' ? Sparkles : BookOpen
  return (
    <View style={styles.chip}>
      <Icon size={12} color={color} strokeWidth={2} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  )
}

function FeatureCard({
  feature,
  title,
  desc,
  color,
  styles,
}: {
  feature: AboutFeatureEntry
  title: string
  desc: string
  color: string
  styles: Styles
}) {
  const Icon = aboutIcon(feature.icon)
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.iconBox}>
          <Icon size={18} color={color} strokeWidth={2} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardDesc}>{desc}</Text>
    </View>
  )
}

export function AboutScreen({
  t,
  onBack,
  colorScheme = 'light',
  onRegister,
  onOpenPortal,
  entries = [],
}: SharedAboutScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createAboutStyles(tk), [tk])
  const accent = tk.brandAccent.deep

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle}>{t('menu.about')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Chip label={t('about.heroBadge')} tone="accent" color={accent} styles={styles} />
          <Text style={styles.heroTitle}>{t('about.heroTitle')}</Text>
          <Text style={styles.bodyText}>{t('about.heroSubtitle')}</Text>
        </View>

        <View style={styles.card}>
          <Chip label={t('about.storyBadge')} tone="plain" color={accent} styles={styles} />
          <Text style={styles.sectionTitle}>{t('about.storyTitle')}</Text>
          <Text style={styles.bodyText}>{t('about.storyP1')}</Text>
          <Text style={styles.bodyText}>{t('about.storyP2')}</Text>
        </View>

        <View style={styles.grid}>
          {ABOUT_VALUES.map((f) => (
            <View key={f.titleKey} style={styles.gridCell}>
              <FeatureCard
                feature={f}
                title={t(f.titleKey)}
                desc={t(f.descKey)}
                color={accent}
                styles={styles}
              />
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('about.platformTitle')}</Text>
        <View style={styles.grid}>
          {ABOUT_PLATFORMS.map((f) => (
            <View key={f.titleKey} style={styles.gridCell}>
              <FeatureCard
                feature={f}
                title={t(f.titleKey)}
                desc={t(f.descKey)}
                color={accent}
                styles={styles}
              />
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

        {onRegister || onOpenPortal ? (
          <View style={[styles.card, styles.ctaCard]}>
            <Text style={styles.sectionTitle}>{t('about.ctaTitle')}</Text>
            <Text style={styles.bodyText}>{t('about.ctaDesc')}</Text>
            {onRegister ? (
              <TouchableOpacity
                style={styles.ctaPrimary}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('about.ctaPrimary')}
                onPress={onRegister}
              >
                <Text style={styles.ctaPrimaryText}>{t('about.ctaPrimary')}</Text>
              </TouchableOpacity>
            ) : null}
            {onOpenPortal ? (
              <TouchableOpacity
                style={styles.ctaSecondary}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('about.ctaSecondary')}
                onPress={onOpenPortal}
              >
                <Text style={styles.ctaSecondaryText}>{t('about.ctaSecondary')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t('about.complianceTitle')}</Text>
        <View style={styles.card}>
          {entries.map((entry) => (
            <TouchableOpacity
              key={entry.id}
              style={styles.entryRow}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={entry.label}
              onPress={entry.onPress}
            >
              <Text style={styles.itemLabel}>{entry.label}</Text>
              <ChevronRight size={15} color={tk.text.tertiary} strokeWidth={2} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
