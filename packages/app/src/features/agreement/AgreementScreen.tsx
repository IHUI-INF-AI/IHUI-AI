// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { Calendar, Tag } from 'lucide-react-native'
import { ScrollView, Text, View } from 'react-native'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { LegalDocScreen } from '../legal-doc/LegalDocScreen'
import type { AgreementScreenProps, LegalDocSection } from '../../types'
import { createAgreementStyles } from './agreement-styles'
import { htmlToBlocks } from './agreement-type'

/** 按类型取当前协议时注入的视图模型(字段对齐 web agreement/[type] 渲染的 Agreement)。 */
export interface AgreementContentView {
  title?: string | null
  content: string
  version?: string | null
  effectiveDate?: string | null
}

/** AgreementScreen 扩展 props — 不传 agreement/loading 时保持原纯静态行为(向后兼容既有薄壳)。 */
export interface AgreementCurrentScreenProps extends AgreementScreenProps {
  /** GET /api/agreements/current?type=… 取到的当前生效协议(null = 未取到,走静态兜底)。 */
  agreement?: AgreementContentView | null
  loading?: boolean
  /** 加载中/未取到时的标题兜底(薄壳按类型 i18n 解析后注入)。 */
  fallbackTitle?: string
}

/**
 * 标题的无障碍语义(层级 + header 角色)。
 * RN 的 TS 类型面未收录 `aria-level`(ViewAccessibility.d.ts 只到 aria-valuetext 等),
 * 直接写字面量会被 JSX 属性检查拒绝;经对象展开则绕过多余属性检查,原生端忽略该属性、
 * RN Web 侧落到 aria-level —— 语义在 web 可取证,不因类型面缺项而丢。
 */
function headingA11y(level: number) {
  return { accessibilityRole: 'header' as const, 'aria-level': level }
}

/** 生效日期格式化:与 web 端 fmt 同口径(YYYY-MM-DD),非法值回退 '-'。 */
function formatEffectiveDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 用户协议共享屏 — 两种形态:
 * 1. 静态配置版(原行为):LegalDocScreen + 内化 sections,无 API 依赖,wrapper 只需注入
 *    t/onBack/colorScheme,保证多端展示一致;
 * 2. 按类型当前版(wave1 扩展,对齐 web agreement/[type]):薄壳经
 *    GET /api/agreements/current?type=… 注入 agreement 后渲染 title/version/effectiveDate/正文;
 *    loading 走取数中,取不到回退静态兜底(与 web error/!data 分支同口径)。
 */
export function AgreementScreen({
  t,
  onBack,
  colorScheme,
  agreement = null,
  loading = false,
  fallbackTitle,
}: AgreementCurrentScreenProps) {
  const scheme = colorScheme ?? 'light'
  const tk = getTokens(scheme)
  const styles = useMemo(() => createAgreementStyles(tk), [tk])
  // hooks 必须在任何 return 之前无条件调用(rules-of-hooks):原先它落在静态兜底分支
  // 之后,agreement/loading 变化时 hook 调用顺序会变,React 会直接抛错。
  const blocks = useMemo(() => (agreement ? htmlToBlocks(agreement.content) : []), [agreement])

  if (!agreement && !loading) {
    const sections: LegalDocSection[] = [
      { title: t('agreementSections.sectionTerms'), body: t('agreementSections.sectionTermsBody') },
      {
        title: t('agreementSections.sectionRights'),
        body: t('agreementSections.sectionRightsBody'),
      },
      {
        title: t('agreementSections.sectionObligations'),
        body: t('agreementSections.sectionObligationsBody'),
      },
    ]

    return (
      <LegalDocScreen
        t={t}
        title={fallbackTitle ?? t('agreement.userAgreement')}
        subtitle={t('agreement.subtitle')}
        updatedAt="2026-07-19"
        sections={sections}
        onBack={onBack}
        colorScheme={scheme}
      />
    )
  }

  const title = agreement?.title || fallbackTitle || t('agreement.userAgreement')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={scheme} />
        <Text style={styles.headerTitle} {...headingA11y(1)}>
          {title}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.subtitle}>{t('agreement.subtitle')}</Text>
        </View>
        {agreement ? (
          <>
            <View style={styles.card}>
              {agreement.version ? (
                <View style={styles.metaItem}>
                  <Tag size={13} color={tk.text.tertiary} strokeWidth={2} />
                  <Text style={styles.metaLabel}>{t('agreement.version')}</Text>
                  <Text style={styles.metaValue}>{agreement.version}</Text>
                </View>
              ) : null}
              {agreement.effectiveDate ? (
                <View style={styles.metaItem}>
                  <Calendar size={13} color={tk.text.tertiary} strokeWidth={2} />
                  <Text style={styles.metaLabel}>{t('agreement.effectiveDate')}</Text>
                  <Text style={styles.metaValue}>
                    {formatEffectiveDate(agreement.effectiveDate)}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.card}>
              {blocks.map((block, index) => {
                if (block.type === 'heading') {
                  const levelStyle =
                    block.level === 1
                      ? styles.headingH1
                      : block.level === 2
                        ? styles.headingH2
                        : styles.headingH3
                  return (
                    <Text key={`heading-${index}`} style={levelStyle} {...headingA11y(block.level)}>
                      {block.text}
                    </Text>
                  )
                }
                if (block.type === 'listItem') {
                  return (
                    <View key={`list-${index}`} style={styles.listRow}>
                      <Text style={styles.bullet}>{block.ordered ? `${block.index}.` : '•'}</Text>
                      <Text style={[styles.paragraph, styles.listText]}>{block.text}</Text>
                    </View>
                  )
                }
                return (
                  <Text key={`paragraph-${index}`} style={styles.paragraph}>
                    {block.text}
                  </Text>
                )
              })}
            </View>
          </>
        ) : (
          <Text style={styles.loadingText}>{t('agreement.loading')}</Text>
        )}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
