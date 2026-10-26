// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { BookOpen, FileText, Globe, Shield } from 'lucide-react-native'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { rnRadius } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { LegalDocScreen, type LegalDocSection, type LegalDocTagGroup } from './LegalDocScreen'

/** 法律文档四入口(web /legal/* 四路由,顺序对齐 web layout NAV_ITEMS)。 */
export type LegalDocKind = 'terms' | 'usagePolicy' | 'supportedRegions' | 'serviceSpecificTerms'

export interface LegalDocsHubScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  /** 路由参数指定的初始文档(web 四路由 → 同一路由名 LegalDoc 的 doc 参数)。 */
  initialDoc?: LegalDocKind
}

const DOC_ORDER: readonly LegalDocKind[] = [
  'terms',
  'usagePolicy',
  'supportedRegions',
  'serviceSpecificTerms',
]

const DOC_ICONS: Record<LegalDocKind, typeof FileText> = {
  terms: FileText,
  usagePolicy: Shield,
  supportedRegions: Globe,
  serviceSpecificTerms: BookOpen,
}

/** supported-regions 四组标签键(逐字迁移 web page.tsx 常量数组;payments 按 web 取 3 项)。 */
const SUPPORTED_REGION_KEYS = [
  'regionChinaMainland',
  'regionHongKong',
  'regionMacau',
  'regionTaiwan',
  'regionUS',
  'regionCanada',
  'regionEU',
  'regionUK',
  'regionJapan',
  'regionKorea',
  'regionSEA',
  'regionIndia',
  'regionAustralia',
  'regionBrazil',
  'regionRussia',
] as const

const RESTRICTED_REGION_KEYS = [
  'restrictedKorea',
  'restrictedIran',
  'restrictedSyria',
  'restrictedCuba',
  'restrictedCrimea',
  'restrictedDonetsk',
  'restrictedLuhansk',
] as const

const PAYMENT_KEYS = ['paymentWechat', 'paymentAlipay', 'paymentPaypal'] as const

const LANGUAGE_KEYS = [
  'languageZhCN',
  'languageZhTW',
  'languageEN',
  'languageJA',
  'languageKO',
] as const

function buildSections(t: TFunction, doc: LegalDocKind): LegalDocSection[] {
  if (doc === 'terms') {
    return Array.from({ length: 10 }, (_, i) => ({
      title: t(`legal.terms.ch${i + 1}Title`),
      body: t(`legal.terms.ch${i + 1}Body`),
    }))
  }
  const ns = doc === 'usagePolicy' ? 'legal.usagePolicy' : 'legal.serviceSpecificTerms'
  return Array.from({ length: 5 }, (_, i) => ({
    title: t(`${ns}.s${i + 1}Title`),
    body: t(`${ns}.s${i + 1}Body`),
  }))
}

function buildRegionsGroups(t: TFunction): LegalDocTagGroup[] {
  const ns = 'legal.supportedRegions'
  return [
    {
      title: t(`${ns}.supportedTitle`),
      tags: SUPPORTED_REGION_KEYS.map((k) => t(`${ns}.${k}`)),
    },
    {
      title: t(`${ns}.restrictedTitle`),
      intro: t(`${ns}.restrictedIntro`),
      tags: RESTRICTED_REGION_KEYS.map((k) => t(`${ns}.${k}`)),
      danger: true,
    },
    {
      title: t(`${ns}.paymentTitle`),
      intro: t(`${ns}.paymentIntro`),
      tags: PAYMENT_KEYS.map((k) => t(`${ns}.${k}`)),
    },
    {
      title: t(`${ns}.languageTitle`),
      intro: t(`${ns}.languageIntro`),
      tags: LANGUAGE_KEYS.map((k) => t(`${ns}.${k}`)),
    },
  ]
}

/**
 * 法律文档中心共享屏(Wave1 2026-10-26,legal 域四路由一屏四入口)。
 *
 * 结构对齐 web apps/web/app/(main)/legal:layout 的页头(返回 + legal.title)+ 四入口导航
 * 改为顶部横向胶囊 tabs;内容区逐文档委托扩展后的 LegalDocScreen ——
 * terms(10 章)/ usagePolicy(5 节)/ serviceSpecificTerms(5 节)走 sections,
 * supportedRegions(intro + 4 组标签)走 intro + groups。
 * 全部文案取 shared 消息包 legal.* 五语键(RN i18n 已深合并 shared,零新增键)。
 */
export function LegalDocsHubScreen({
  t,
  colorScheme = 'light',
  onBack,
  initialDoc = 'terms',
}: LegalDocsHubScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createHubStyles(tk), [tk])
  const [doc, setDoc] = useState<LegalDocKind>(initialDoc)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle}>{t('legal.title')}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabStrip}
      >
        {DOC_ORDER.map((kind) => {
          const Icon = DOC_ICONS[kind]
          const active = kind === doc
          return (
            <TouchableOpacity
              key={kind}
              style={[styles.tab, active ? styles.tabActive : null]}
              activeOpacity={0.85}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setDoc(kind)}
            >
              <Icon
                size={13}
                strokeWidth={2}
                color={active ? tk.brand.ctaForeground : tk.text.secondary}
              />
              <Text style={[styles.tabText, active ? styles.tabActiveText : null]}>
                {t(`legal.nav.${kind}`)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      <LegalDocScreen
        t={t}
        colorScheme={colorScheme}
        headerless
        title={t(`legal.${doc}.title`)}
        updatedAtText={t(`legal.${doc}.lastUpdated`)}
        intro={doc === 'supportedRegions' ? t('legal.supportedRegions.intro') : undefined}
        sections={doc === 'supportedRegions' ? [] : buildSections(t, doc)}
        groups={doc === 'supportedRegions' ? buildRegionsGroups(t) : undefined}
        onBack={onBack}
      />
    </View>
  )
}

function createHubStyles(tk: ReturnType<typeof getTokens>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingTop: 12,
      paddingBottom: 4,
      gap: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    tabStrip: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: rnRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    tabActive: {
      backgroundColor: tk.brand.cta,
      borderColor: tk.brand.cta,
    },
    tabText: { fontSize: 12, fontWeight: '600', color: tk.text.secondary },
    tabActiveText: { color: tk.brand.ctaForeground },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
