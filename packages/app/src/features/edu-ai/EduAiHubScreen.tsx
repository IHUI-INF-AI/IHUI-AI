// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, type ReactNode } from 'react'
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Landmark,
  ScrollText,
  Search,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react-native'
import {
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createEduAiStyles, EDU_AI_PALETTE, type EduAiTone } from './edu-ai-styles'

/** 与 web /edu-ai 四目录页同构的四个入口(aigc-tools / certification / courses / policy)。 */
export type EduAiTab = 'aigc' | 'cert' | 'courses' | 'policy'

/** 行类型与 packages/api-client/src/endpoints/edu-ai.ts 载荷逐字段同形(结构兼容,薄壳直传)。 */
export interface EduAiAigcToolRow {
  id: string
  name: string
  nameCn?: string
  category: string
  provider?: string
  url?: string
  description?: string
  coreFeatures?: string[] | null
  useCases?: string[] | null
  pricingModel?: string
  pricingDetail?: string
  freeTier?: string
  apiAvailable?: boolean
  pros?: string[] | null
  cons?: string[] | null
  tips?: string[] | null
  alternatives?: string[] | null
  rating?: number
  userCount?: number
}

export interface EduAiCertRow {
  id: string
  certName: string
  issuingAuthority: string
  targetTeachers?: string | null
  level?: string | null
  trainingHours?: number | null
  trainingContent?: string | null
  assessmentMethod?: string | null
  certificationRequirements?: string | null
  validity?: string | null
  benefits?: string | null
}

export interface EduAiCourseRow {
  id: string
  courseName?: string
  stage?: string
  gradeRange?: string
  hoursPerYear?: number
  courseType?: string
  learningObjectives?: string
  contentModules?: string
  keyConcepts?: string
  skillRequirements?: string
  teachingMethods?: string
  assessmentMethods?: string
  toolsResources?: string
  targetMajor?: string
  credits?: number
  hours?: number
  university?: string
  description?: string
  modules?: string
  prerequisites?: string
  textbooks?: string
  teachingTeam?: string
  assessment?: string
  isRequired?: boolean | number | string
}

export interface EduAiPolicyRow {
  id: string
  policyName: string
  issuingAuthority: string
  issueDate?: string | null
  effectiveDate?: string | null
  policyLevel?: string | null
  targetGroup?: string | null
  summary?: string | null
  keyPoints?: string | null
  implementation?: string | null
  goals?: string | null
  sourceUrl?: string | null
}

export interface EduAiListState<T> {
  loading: boolean
  error: string | null
  rows: T[]
  total: number
  page: number
  pageSize: number
  keyword: string
  /** aigc=category,cert/policy=level,courses=k12|university 子页签 */
  filter: string
  detail: T | null
  detailLoading: boolean
  detailError: string | null
}

export interface EduAiHubScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  activeTab: EduAiTab
  tabs: {
    aigc: EduAiListState<EduAiAigcToolRow>
    cert: EduAiListState<EduAiCertRow>
    courses: EduAiListState<EduAiCourseRow>
    policy: EduAiListState<EduAiPolicyRow>
  }
  onTabChange: (tab: EduAiTab) => void
  onKeywordChange: (tab: EduAiTab, value: string) => void
  onFilterChange: (tab: EduAiTab, value: string) => void
  onPageChange: (tab: EduAiTab, page: number) => void
  onOpenDetail: (tab: EduAiTab, id: string) => void
  onCloseDetail: (tab: EduAiTab) => void
  onRefresh: (tab: EduAiTab) => void
}

const TAB_ORDER: readonly EduAiTab[] = ['aigc', 'cert', 'courses', 'policy']

const TAB_ICONS: Record<EduAiTab, typeof Wrench> = {
  aigc: Wrench,
  cert: BadgeCheck,
  courses: BookOpen,
  policy: Landmark,
}

const TAB_LABEL_KEYS: Record<EduAiTab, string> = {
  aigc: 'eduAiPage.tabAigc',
  cert: 'eduAiPage.tabCert',
  courses: 'eduAiPage.tabCourses',
  policy: 'eduAiPage.tabPolicy',
}

const AIGC_FILTERS: ReadonlyArray<{ value: string; labelKey: string }> = [
  { value: 'all', labelKey: 'eduAiPage.aigcAll' },
  { value: 'text', labelKey: 'eduAiPage.aigcText' },
  { value: 'image', labelKey: 'eduAiPage.aigcImage' },
  { value: 'video', labelKey: 'eduAiPage.aigcVideo' },
  { value: 'audio', labelKey: 'eduAiPage.aigcAudio' },
  { value: 'code', labelKey: 'eduAiPage.aigcCode' },
  { value: '3d', labelKey: 'eduAiPage.aigc3d' },
  { value: 'agent', labelKey: 'eduAiPage.aigcAgent' },
]

const CERT_FILTERS: ReadonlyArray<{ value: string; labelKey: string }> = [
  { value: 'all', labelKey: 'eduAiPage.certAllLevels' },
  { value: 'primary', labelKey: 'eduAiPage.certPrimary' },
  { value: 'intermediate', labelKey: 'eduAiPage.certIntermediate' },
  { value: 'advanced', labelKey: 'eduAiPage.certAdvanced' },
]

const POLICY_FILTERS: ReadonlyArray<{ value: string; labelKey: string }> = [
  { value: 'all', labelKey: 'eduAiPage.policyAllLevels' },
  { value: 'national', labelKey: 'eduAiPage.policyNational' },
  { value: 'ministerial', labelKey: 'eduAiPage.policyMinisterial' },
  { value: 'local', labelKey: 'eduAiPage.policyLocal' },
]

const COURSES_FILTERS: ReadonlyArray<{ value: string; labelKey: string }> = [
  { value: 'k12', labelKey: 'eduAiPage.coursesTabK12' },
  { value: 'university', labelKey: 'eduAiPage.coursesTabUniversity' },
]

const AIGC_CATEGORY_TONE: Record<string, EduAiTone> = {
  text: 'sky',
  image: 'violet',
  video: 'rose',
  audio: 'amber',
  code: 'emerald',
  '3d': 'indigo',
  agent: 'fuchsia',
}

const AIGC_CATEGORY_LABEL_KEY: Record<string, string> = {
  text: 'eduAiPage.aigcText',
  image: 'eduAiPage.aigcImage',
  video: 'eduAiPage.aigcVideo',
  audio: 'eduAiPage.aigcAudio',
  code: 'eduAiPage.aigcCode',
  '3d': 'eduAiPage.aigc3d',
  agent: 'eduAiPage.aigcAgent',
}

const CERT_LEVEL_TONE: Record<string, EduAiTone> = {
  primary: 'blue',
  intermediate: 'emerald',
  advanced: 'purple',
}

const POLICY_LEVEL_TONE: Record<string, EduAiTone> = {
  national: 'slate',
  ministerial: 'amber',
  local: 'emerald',
}

const STAGE_TONE: Record<string, EduAiTone> = {
  primary: 'sky',
  junior: 'amber',
  senior: 'violet',
}

/** cert 等级与 policy 级别值域互斥(primary/intermediate/advanced vs national/ministerial/local),共用一张扁平键表。 */
const LEVEL_LABEL_KEY: Record<string, string> = {
  primary: 'eduAiPage.certPrimary',
  intermediate: 'eduAiPage.certIntermediate',
  advanced: 'eduAiPage.certAdvanced',
  national: 'eduAiPage.policyNational',
  ministerial: 'eduAiPage.policyMinisterial',
  local: 'eduAiPage.policyLocal',
}

function levelLabel(t: TFunction, lv?: string | null): string {
  const key = lv ? LEVEL_LABEL_KEY[lv] : undefined
  if (key) return t(key)
  return lv || '-'
}

function stageLabel(t: TFunction, stage?: string): string {
  if (stage === 'primary') return t('eduAiPage.coursesPrimary')
  if (stage === 'junior') return t('eduAiPage.coursesJunior')
  if (stage === 'senior') return t('eduAiPage.coursesSenior')
  return stage || '-'
}

/** web aigc-tools/page.tsx:103 isFreeTool 同口径。 */
function isFreeTool(tool: EduAiAigcToolRow): boolean {
  const p = (tool.pricingModel ?? '').toLowerCase()
  if (p.includes('free') || p.includes('免费')) return true
  return Boolean(tool.freeTier?.trim())
}

/** web courses/page.tsx:89 isTruthy 同口径(DB boolean/0/1 线格式归一)。 */
function isTruthy(v?: boolean | number | string | null): boolean {
  return v === true || v === 1 || v === '1' || v === 'true'
}

function formatDate(iso?: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

type Styles = ReturnType<typeof createEduAiStyles>

function Badge({ tone, label, styles }: { tone: EduAiTone; label: string; styles: Styles }) {
  const palette = EDU_AI_PALETTE[tone]
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  )
}

function RatingStars({ rating, styles }: { rating?: number; styles: Styles }) {
  const full = Math.max(0, Math.min(5, Math.round(rating ?? 0)))
  return (
    <Text style={[styles.stars, { color: EDU_AI_PALETTE.star.fg }]}>
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)}
    </Text>
  )
}

function MetaRow({
  icon,
  label,
  value,
  styles,
}: {
  icon?: ReactNode
  label: string
  value: string
  styles: Styles
}) {
  return (
    <View style={styles.row}>
      {icon}
      <Text style={styles.rowSub}>{label}</Text>
      <Text style={[styles.cardSub, { flex: 1 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

function StrList({
  title,
  items,
  marker,
  tone,
  styles,
}: {
  title: string
  items?: string[] | null
  marker?: string
  tone?: EduAiTone
  styles: Styles
}) {
  if (!items || items.length === 0) return null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={`${i}-${item}`} style={styles.sectionItem}>
          {marker ? (
            <Text style={[styles.marker, { color: tone ? EDU_AI_PALETTE[tone].fg : undefined }]}>
              {marker}
            </Text>
          ) : null}
          <Text style={styles.sectionItemText}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

function FieldBox({
  label,
  value,
  styles,
}: {
  label: string
  value?: string | number | boolean | null
  styles: Styles
}) {
  if (value === undefined || value === null || value === '') return null
  const display = typeof value === 'boolean' ? String(value) : String(value)
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{display}</Text>
    </View>
  )
}

function LinkText({
  url,
  label,
  styles,
  tk,
}: {
  url: string
  label?: string
  styles: Styles
  tk: AppThemeTokens
}) {
  return (
    <TouchableOpacity
      style={styles.linkRow}
      activeOpacity={0.75}
      accessibilityRole="link"
      onPress={() => {
        void Linking.openURL(url)
      }}
    >
      <ExternalLink size={13} color={tk.brandAccent.DEFAULT} strokeWidth={2} />
      <Text style={styles.linkText} numberOfLines={2}>
        {label ?? url}
      </Text>
    </TouchableOpacity>
  )
}

function ErrorBox({ message, styles }: { message: string; styles: Styles }) {
  return (
    <View style={styles.errorBox}>
      <AlertTriangle size={16} color={EDU_AI_PALETTE.rose.fg} strokeWidth={2} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  )
}

function FilterChips({
  options,
  active,
  onSelect,
  styles,
  t,
}: {
  options: ReadonlyArray<{ value: string; labelKey: string }>
  active: string
  onSelect: (value: string) => void
  styles: Styles
  t: TFunction
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipStrip}
    >
      {options.map((opt) => {
        const isActive = opt.value === active
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, isActive ? styles.chipActive : null]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(opt.value)}
          >
            <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
              {t(opt.labelKey)}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

function Pager({
  t,
  styles,
  total,
  page,
  pageSize,
  onPage,
}: {
  t: TFunction
  styles: Styles
  total: number
  page: number
  pageSize: number
  onPage: (page: number) => void
}) {
  if (total <= pageSize) return null
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <View style={styles.pager}>
      <Text style={styles.pagerText}>{t('eduAiPage.page', { page, total: totalPages })}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.pagerBtn, page <= 1 ? styles.pagerBtnDisabled : null]}
          activeOpacity={0.85}
          accessibilityRole="button"
          disabled={page <= 1}
          onPress={() => onPage(page - 1)}
        >
          <ChevronLeft size={14} strokeWidth={2} color={EDU_AI_PALETTE.slate.fg} />
          <Text style={styles.pagerBtnText}>{t('eduAiPage.prev')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pagerBtn, page >= totalPages ? styles.pagerBtnDisabled : null]}
          activeOpacity={0.85}
          accessibilityRole="button"
          disabled={page >= totalPages}
          onPress={() => onPage(page + 1)}
        >
          <Text style={styles.pagerBtnText}>{t('eduAiPage.next')}</Text>
          <ChevronRight size={14} strokeWidth={2} color={EDU_AI_PALETTE.slate.fg} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

/**
 * edu-ai 教育 AI 目录中心共享屏(Wave2 2026-10-26,edu-ai 域四路由一屏四入口)。
 *
 * 结构对齐 web apps/web/app/(main)/edu-ai/{aigc-tools,certification,courses,policy}:
 * 四页同构(标题+搜索+筛选+分页目录+详情),web 详情 Dialog 在 RN 折叠为屏内下钻视图;
 * 取数/防抖/分页态全部由薄壳驱动(apps/mobile-rn/src/screens/EduAiScreen.tsx),本屏纯展示。
 * video-compose(交互任务域,非同构)由同目录 EduAiVideoComposeScreen 单独承载。
 */
export function EduAiHubScreen({
  t,
  colorScheme = 'light',
  onBack,
  activeTab,
  tabs,
  onTabChange,
  onKeywordChange,
  onFilterChange,
  onPageChange,
  onOpenDetail,
  onCloseDetail,
  onRefresh,
}: EduAiHubScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createEduAiStyles(tk), [tk])

  const searchBox = (tab: EduAiTab, placeholder: string, value: string) => (
    <View style={styles.searchBox}>
      <Search size={15} color={tk.text.tertiary} strokeWidth={2} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={(v) => onKeywordChange(tab, v)}
        placeholder={placeholder}
        placeholderTextColor={tk.text.tertiary}
        accessibilityLabel={placeholder}
        returnKeyType="search"
      />
    </View>
  )

  const listShell = <T extends { id: string }>(
    tab: EduAiTab,
    s: EduAiListState<T>,
    heroTitle: string,
    heroSubtitle: string,
    searchPlaceholder: string,
    filterNode: ReactNode,
    emptyText: string,
    EmptyIcon: typeof Wrench,
    renderCards: (rows: T[]) => ReactNode,
  ) => (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={s.loading}
          onRefresh={() => onRefresh(tab)}
          tintColor={tk.text.secondary}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{heroTitle}</Text>
        <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
      </View>
      {searchBox(tab, searchPlaceholder, s.keyword)}
      {filterNode}
      {s.loading && s.rows.length === 0 ? (
        <View style={styles.card}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonRow} />
          <View style={styles.skeletonRow} />
        </View>
      ) : s.error && s.rows.length === 0 ? (
        <ErrorBox message={s.error} styles={styles} />
      ) : s.rows.length === 0 ? (
        <View style={styles.emptyBox}>
          <EmptyIcon size={28} color={tk.text.tertiary} strokeWidth={1.5} />
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        <>
          {renderCards(s.rows)}
          <Pager
            t={t}
            styles={styles}
            total={s.total}
            page={s.page}
            pageSize={s.pageSize}
            onPage={(p) => onPageChange(tab, p)}
          />
        </>
      )}
    </ScrollView>
  )

  const detailShell = (
    tab: EduAiTab,
    s: { detail: unknown; detailLoading: boolean; detailError: string | null },
    children: ReactNode,
  ) => (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.detailHead}>
        <BackChevron
          onPress={() => onCloseDetail(tab)}
          label={t('common.back')}
          colorScheme={colorScheme}
        />
      </View>
      {s.detailLoading ? (
        <View style={styles.card}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonRow} />
          <View style={styles.skeletonRow} />
        </View>
      ) : s.detailError ? (
        <ErrorBox message={s.detailError} styles={styles} />
      ) : !s.detail ? (
        <Text style={styles.emptyText}>{t('eduAiPage.loadFailed')}</Text>
      ) : (
        children
      )}
    </ScrollView>
  )

  const renderAigc = () => {
    const s = tabs.aigc
    if (s.detail || s.detailLoading || s.detailError) {
      const tool = s.detail
      return detailShell(
        'aigc',
        s,
        tool ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.detailTitle}>{tool.name}</Text>
                <Badge
                  tone={AIGC_CATEGORY_TONE[tool.category] ?? 'slate'}
                  label={t(AIGC_CATEGORY_LABEL_KEY[tool.category] ?? 'eduAiPage.aigcAll')}
                  styles={styles}
                />
              </View>
              {tool.nameCn ? <Text style={styles.cardSub}>{tool.nameCn}</Text> : null}
              {tool.provider ? (
                <MetaRow
                  label={t('eduAiPage.aigcProvider')}
                  value={tool.provider}
                  icon={<Sparkles size={13} color={tk.text.tertiary} strokeWidth={2} />}
                  styles={styles}
                />
              ) : null}
              <View style={styles.row}>
                <RatingStars rating={tool.rating} styles={styles} />
                <Text style={styles.rowSub}>
                  {t('eduAiPage.aigcRating')}: {tool.rating ?? '-'}
                </Text>
                {typeof tool.userCount === 'number' && tool.userCount > 0 ? (
                  <View style={styles.row}>
                    <Users size={13} color={tk.text.tertiary} strokeWidth={2} />
                    <Text style={styles.rowSub}>{tool.userCount}</Text>
                  </View>
                ) : null}
              </View>
              {tool.url ? <LinkText url={tool.url} styles={styles} tk={tk} /> : null}
              {tool.description ? <Text style={styles.cardBody}>{tool.description}</Text> : null}
            </View>
            <StrList
              title={t('eduAiPage.aigcCoreFeatures')}
              items={tool.coreFeatures}
              styles={styles}
            />
            <StrList title={t('eduAiPage.aigcUseCases')} items={tool.useCases} styles={styles} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('eduAiPage.aigcPricing')}</Text>
              {tool.pricingModel ? <Text style={styles.cardBody}>{tool.pricingModel}</Text> : null}
              {tool.pricingDetail ? (
                <Text style={styles.cardBody}>{tool.pricingDetail}</Text>
              ) : null}
              {tool.freeTier ? (
                <Text style={[styles.cardBody, { color: EDU_AI_PALETTE.emerald.fg }]}>
                  {tool.freeTier}
                </Text>
              ) : null}
            </View>
            <StrList
              title={t('eduAiPage.aigcPros')}
              items={tool.pros}
              marker="+"
              tone="emerald"
              styles={styles}
            />
            <StrList
              title={t('eduAiPage.aigcCons')}
              items={tool.cons}
              marker="-"
              tone="rose"
              styles={styles}
            />
            <StrList
              title={t('eduAiPage.aigcAlternatives')}
              items={tool.alternatives}
              styles={styles}
            />
            <StrList title={t('eduAiPage.aigcTips')} items={tool.tips} styles={styles} />
          </>
        ) : null,
      )
    }
    return listShell(
      'aigc',
      s,
      t('eduAiPage.aigcTitle'),
      t('eduAiPage.aigcSubtitle'),
      t('eduAiPage.aigcSearch'),
      <FilterChips
        options={AIGC_FILTERS}
        active={s.filter}
        onSelect={(v) => onFilterChange('aigc', v)}
        styles={styles}
        t={t}
      />,
      t('eduAiPage.aigcEmpty'),
      Sparkles,
      (rows) => (
        <>
          {rows.map((tool) => (
            <TouchableOpacity
              key={tool.id}
              style={styles.card}
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={() => onOpenDetail('aigc', tool.id)}
            >
              <View style={styles.cardHead}>
                <View style={styles.rowMain}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {tool.name}
                  </Text>
                  {tool.nameCn ? (
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {tool.nameCn}
                    </Text>
                  ) : null}
                </View>
                <Badge
                  tone={AIGC_CATEGORY_TONE[tool.category] ?? 'slate'}
                  label={t(AIGC_CATEGORY_LABEL_KEY[tool.category] ?? 'eduAiPage.aigcAll')}
                  styles={styles}
                />
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {tool.provider ?? '-'}
                </Text>
                <RatingStars rating={tool.rating} styles={styles} />
              </View>
              {tool.description ? (
                <Text style={styles.cardBody} numberOfLines={2}>
                  {tool.description}
                </Text>
              ) : null}
              <View style={styles.badgeRow}>
                {isFreeTool(tool) ? (
                  <Badge tone="emerald" label={t('eduAiPage.aigcFree')} styles={styles} />
                ) : null}
                {tool.apiAvailable ? (
                  <Badge tone="sky" label={t('eduAiPage.aigcApi')} styles={styles} />
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
          <Text style={styles.pagerText}>{t('eduAiPage.aigcTotal', { n: s.total })}</Text>
        </>
      ),
    )
  }

  const renderCert = () => {
    const s = tabs.cert
    if (s.detail || s.detailLoading || s.detailError) {
      const cert = s.detail
      return detailShell(
        'cert',
        s,
        cert ? (
          <>
            <View style={styles.card}>
              <Text style={styles.detailTitle}>{cert.certName}</Text>
              <MetaRow
                label={t('eduAiPage.certIssuingAuthority')}
                value={cert.issuingAuthority}
                icon={<Building2 size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
              <MetaRow
                label={t('eduAiPage.certTargetTeachers')}
                value={cert.targetTeachers || '-'}
                icon={<Users size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
              <MetaRow
                label={t('eduAiPage.certLevel')}
                value={levelLabel(t, cert.level)}
                icon={<BadgeCheck size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
              <MetaRow
                label={t('eduAiPage.certTrainingHours')}
                value={
                  cert.trainingHours !== null && cert.trainingHours !== undefined
                    ? `${cert.trainingHours} ${t('eduAiPage.certHoursSuffix')}`
                    : '-'
                }
                icon={<Clock size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
              <MetaRow
                label={t('eduAiPage.certValidity')}
                value={cert.validity || '-'}
                icon={<CalendarDays size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
            </View>
            {(
              [
                [t('eduAiPage.certTrainingContent'), cert.trainingContent],
                [t('eduAiPage.certAssessmentMethod'), cert.assessmentMethod],
                [t('eduAiPage.certRequirements'), cert.certificationRequirements],
                [t('eduAiPage.certBenefits'), cert.benefits],
              ] as const
            )
              .filter(([, value]) => !!value)
              .map(([label, value]) => (
                <View key={label} style={styles.section}>
                  <Text style={styles.sectionTitle}>{label}</Text>
                  <Text style={styles.cardBody}>{value}</Text>
                </View>
              ))}
          </>
        ) : null,
      )
    }
    return listShell(
      'cert',
      s,
      t('eduAiPage.certTitle'),
      t('eduAiPage.certSubtitle'),
      t('eduAiPage.certSearch'),
      <FilterChips
        options={CERT_FILTERS}
        active={s.filter}
        onSelect={(v) => onFilterChange('cert', v)}
        styles={styles}
        t={t}
      />,
      t('eduAiPage.certEmpty'),
      BadgeCheck,
      (rows) => (
        <>
          {rows.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={() => onOpenDetail('cert', item.id)}
            >
              <View style={styles.cardHead}>
                <View style={styles.rowMain}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.certName}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {item.issuingAuthority}
                  </Text>
                </View>
                <Badge
                  tone={CERT_LEVEL_TONE[item.level ?? ''] ?? 'slate'}
                  label={levelLabel(t, item.level)}
                  styles={styles}
                />
              </View>
              <MetaRow
                label={t('eduAiPage.certTargetTeachers')}
                value={item.targetTeachers || '-'}
                icon={<Users size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
              <MetaRow
                label={t('eduAiPage.certTrainingHours')}
                value={
                  item.trainingHours !== null && item.trainingHours !== undefined
                    ? `${item.trainingHours} ${t('eduAiPage.certHoursSuffix')}`
                    : '-'
                }
                icon={<Clock size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
              <MetaRow
                label={t('eduAiPage.certValidity')}
                value={item.validity || '-'}
                icon={<CalendarDays size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
            </TouchableOpacity>
          ))}
          <Pager
            t={t}
            styles={styles}
            total={s.total}
            page={s.page}
            pageSize={s.pageSize}
            onPage={(p) => onPageChange('cert', p)}
          />
        </>
      ),
    )
  }

  const renderCourses = () => {
    const s = tabs.courses
    const isK12 = s.filter !== 'university'
    if (s.detail || s.detailLoading || s.detailError) {
      const course = s.detail
      return detailShell(
        'courses',
        s,
        course ? (
          <>
            <View style={styles.card}>
              <Text style={styles.detailTitle}>{course.courseName ?? '-'}</Text>
              <Text style={styles.detailSub}>
                {isK12 ? t('eduAiPage.coursesTabK12') : t('eduAiPage.coursesTabUniversity')}
              </Text>
            </View>
            {isK12 ? (
              <View style={styles.card}>
                <FieldBox
                  label={t('eduAiPage.coursesStage')}
                  value={course.stage ? stageLabel(t, course.stage) : undefined}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesGradeRange')}
                  value={course.gradeRange}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesCourseName')}
                  value={course.courseName}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesHoursPerYear')}
                  value={course.hoursPerYear}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesCourseType')}
                  value={course.courseType}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesLearningObjectives')}
                  value={course.learningObjectives}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesContentModules')}
                  value={course.contentModules}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesKeyConcepts')}
                  value={course.keyConcepts}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesSkillRequirements')}
                  value={course.skillRequirements}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesTeachingMethods')}
                  value={course.teachingMethods}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesAssessmentMethods')}
                  value={course.assessmentMethods}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesToolsResources')}
                  value={course.toolsResources}
                  styles={styles}
                />
              </View>
            ) : (
              <View style={styles.card}>
                <FieldBox
                  label={t('eduAiPage.coursesCourseName')}
                  value={course.courseName}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesCourseType')}
                  value={course.courseType}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesTargetMajor')}
                  value={course.targetMajor}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesCredits')}
                  value={course.credits}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesHours')}
                  value={course.hours}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesUniversity')}
                  value={course.university}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesDescription')}
                  value={course.description}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesModules')}
                  value={course.modules}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesPrerequisites')}
                  value={course.prerequisites}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesTextbooks')}
                  value={course.textbooks}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesTeachingTeam')}
                  value={course.teachingTeam}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesAssessment')}
                  value={course.assessment}
                  styles={styles}
                />
                <FieldBox
                  label={t('eduAiPage.coursesCourseType')}
                  value={
                    isTruthy(course.isRequired)
                      ? t('eduAiPage.coursesRequired')
                      : t('eduAiPage.coursesElective')
                  }
                  styles={styles}
                />
              </View>
            )}
          </>
        ) : null,
      )
    }
    return listShell(
      'courses',
      s,
      t('eduAiPage.coursesTitle'),
      t('eduAiPage.coursesSubtitle'),
      t('eduAiPage.coursesSearch'),
      <FilterChips
        options={COURSES_FILTERS}
        active={s.filter}
        onSelect={(v) => onFilterChange('courses', v)}
        styles={styles}
        t={t}
      />,
      t('eduAiPage.coursesEmpty'),
      BookOpen,
      (rows) => (
        <>
          {rows.map((item) =>
            isK12 ? (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.85}
                accessibilityRole="button"
                onPress={() => onOpenDetail('courses', item.id)}
              >
                <View style={styles.cardHead}>
                  <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={1}>
                    {item.courseName}
                  </Text>
                  <Badge
                    tone={STAGE_TONE[item.stage ?? ''] ?? 'slate'}
                    label={stageLabel(t, item.stage)}
                    styles={styles}
                  />
                  {item.courseType ? (
                    <Badge tone="slate" label={item.courseType} styles={styles} />
                  ) : null}
                </View>
                <Text style={styles.rowSub}>
                  {t('eduAiPage.coursesGradeRange')}: {item.gradeRange ?? '-'}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.rowSub}>
                    {t('eduAiPage.coursesHoursPerYear')}: {item.hoursPerYear ?? '-'}
                  </Text>
                  <Text style={[styles.rowSub, { color: tk.brandAccent.DEFAULT }]}>
                    {t('eduAiPage.viewDetail')}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.85}
                accessibilityRole="button"
                onPress={() => onOpenDetail('courses', item.id)}
              >
                <View style={styles.cardHead}>
                  <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={1}>
                    {item.courseName}
                  </Text>
                  <Badge
                    tone={isTruthy(item.isRequired) ? 'emerald' : 'amber'}
                    label={
                      isTruthy(item.isRequired)
                        ? t('eduAiPage.coursesRequired')
                        : t('eduAiPage.coursesElective')
                    }
                    styles={styles}
                  />
                </View>
                <MetaRow
                  label={t('eduAiPage.coursesUniversity')}
                  value={item.university ?? '-'}
                  icon={<Building2 size={13} color={tk.text.tertiary} strokeWidth={2} />}
                  styles={styles}
                />
                <View style={styles.metaRow}>
                  <View style={styles.row}>
                    <Award size={13} color={tk.text.tertiary} strokeWidth={2} />
                    <Text style={styles.rowSub}>
                      {item.credits ?? '-'} {t('eduAiPage.coursesCredits')}
                    </Text>
                    <Clock size={13} color={tk.text.tertiary} strokeWidth={2} />
                    <Text style={styles.rowSub}>
                      {item.hours ?? '-'} {t('eduAiPage.coursesHours')}
                    </Text>
                  </View>
                  <Text style={[styles.rowSub, { color: tk.brandAccent.DEFAULT }]}>
                    {t('eduAiPage.viewDetail')}
                  </Text>
                </View>
              </TouchableOpacity>
            ),
          )}
          <Pager
            t={t}
            styles={styles}
            total={s.total}
            page={s.page}
            pageSize={s.pageSize}
            onPage={(p) => onPageChange('courses', p)}
          />
        </>
      ),
    )
  }

  const renderPolicy = () => {
    const s = tabs.policy
    if (s.detail || s.detailLoading || s.detailError) {
      const policy = s.detail
      return detailShell(
        'policy',
        s,
        policy ? (
          <>
            <View style={styles.card}>
              <Text style={styles.detailTitle}>{policy.policyName}</Text>
              <Text style={styles.detailSub}>
                {policy.issuingAuthority} · {formatDate(policy.issueDate)}
              </Text>
              <MetaRow
                label={t('eduAiPage.policyIssuingAuthority')}
                value={policy.issuingAuthority}
                icon={<Building2 size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
              <MetaRow
                label={t('eduAiPage.policyLevelLabel')}
                value={levelLabel(t, policy.policyLevel)}
                icon={<Landmark size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
              <MetaRow
                label={t('eduAiPage.policyIssueDate')}
                value={formatDate(policy.issueDate)}
                icon={<CalendarDays size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
              <MetaRow
                label={t('eduAiPage.policyEffectiveDate')}
                value={formatDate(policy.effectiveDate)}
                icon={<CalendarDays size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
              <MetaRow
                label={t('eduAiPage.policyTargetGroup')}
                value={policy.targetGroup || '-'}
                icon={<Users size={13} color={tk.text.tertiary} strokeWidth={2} />}
                styles={styles}
              />
            </View>
            {(
              [
                [t('eduAiPage.policySummary'), policy.summary],
                [t('eduAiPage.policyKeyPoints'), policy.keyPoints],
                [t('eduAiPage.policyImplementation'), policy.implementation],
                [t('eduAiPage.policyGoals'), policy.goals],
              ] as const
            )
              .filter(([, value]) => !!value)
              .map(([label, value]) => (
                <View key={label} style={styles.section}>
                  <Text style={styles.sectionTitle}>{label}</Text>
                  <Text style={styles.cardBody}>{value}</Text>
                </View>
              ))}
            {policy.sourceUrl ? (
              <LinkText
                url={policy.sourceUrl}
                label={t('eduAiPage.policySourceUrl')}
                styles={styles}
                tk={tk}
              />
            ) : null}
          </>
        ) : null,
      )
    }
    return listShell(
      'policy',
      s,
      t('eduAiPage.policyTitle'),
      t('eduAiPage.policySubtitle'),
      t('eduAiPage.policySearch'),
      <FilterChips
        options={POLICY_FILTERS}
        active={s.filter}
        onSelect={(v) => onFilterChange('policy', v)}
        styles={styles}
        t={t}
      />,
      t('eduAiPage.policyEmpty'),
      ScrollText,
      (rows) => (
        <>
          {rows.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={() => onOpenDetail('policy', item.id)}
            >
              <View style={styles.cardHead}>
                <View style={styles.rowMain}>
                  <Text style={styles.cardTitle}>{item.policyName}</Text>
                </View>
                <Badge
                  tone={POLICY_LEVEL_TONE[item.policyLevel ?? ''] ?? 'slate'}
                  label={levelLabel(t, item.policyLevel)}
                  styles={styles}
                />
              </View>
              <View style={styles.row}>
                <Building2 size={13} color={tk.text.tertiary} strokeWidth={2} />
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.issuingAuthority}
                </Text>
                <CalendarDays size={13} color={tk.text.tertiary} strokeWidth={2} />
                <Text style={styles.rowSub}>{formatDate(item.issueDate)}</Text>
              </View>
              {item.summary ? (
                <Text style={styles.cardBody} numberOfLines={2}>
                  {item.summary}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
          <Pager
            t={t}
            styles={styles}
            total={s.total}
            page={s.page}
            pageSize={s.pageSize}
            onPage={(p) => onPageChange('policy', p)}
          />
        </>
      ),
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle}>{t('eduAiPage.title')}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabStrip}
      >
        {TAB_ORDER.map((kind) => {
          const Icon = TAB_ICONS[kind]
          const active = kind === activeTab
          return (
            <TouchableOpacity
              key={kind}
              style={[styles.tab, active ? styles.tabActive : null]}
              activeOpacity={0.85}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onTabChange(kind)}
            >
              <Icon
                size={13}
                strokeWidth={2}
                color={active ? tk.brand.ctaForeground : tk.text.secondary}
              />
              <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
                {t(TAB_LABEL_KEYS[kind])}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      {activeTab === 'aigc'
        ? renderAigc()
        : activeTab === 'cert'
          ? renderCert()
          : activeTab === 'courses'
            ? renderCourses()
            : renderPolicy()}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
