// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ClipboardList } from 'lucide-react-native'
import { rnHue, rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

/**
 * 我的报名共享屏 —— 承载 web /user/sign-up(课程报名 + 试卷报名两路聚合)。
 *
 * 四档状态语义色与 web STATUS_STYLE 同源(draft=bg-muted、published=bg-green-500/10、
 * rejected=bg-destructive/10、completed=bg-blue-500/10)—— 固定语义色不随主题换档,
 * 先例见 edu-ai-styles.ts 与 status-styles.ts 的 STATUS_PALETTE 同口径注释。
 * 结构色(容器/文字/边框/底)一律走 tk.* token,零硬编码。
 * 平台无关:取数、Intl 日期格式化、状态文案映射全部由薄壳注入,本屏不碰网络与 i18n 加载。
 */
export type SignUpStatusView = 'draft' | 'published' | 'rejected' | 'completed'

export interface SignUpRowView {
  id: string
  targetTitle: string
  /** 后端聚合面给出的 lesson|exam,文案由薄壳按 web 同 ns 取 */
  typeText: string
  status: SignUpStatusView
  statusText: string
  /** 薄壳按 web 同参 Intl 格式化(年/月/日) */
  dateText: string
}

export interface SignUpScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  loading: boolean
  error: string | null
  rows: SignUpRowView[]
}

const STATUS_TONE: Record<SignUpStatusView, 'muted' | 'emerald' | 'rose' | 'sky'> = {
  draft: 'muted',
  published: 'emerald',
  rejected: 'rose',
  completed: 'sky',
}

/**
 * 四档底色/前景取色相族唯一真相源 rnHue(端内不得再手抄 rgba/#hex 字面量);
 * alpha 按本屏原取值选档(0.10→tint、0.12→tintStrong),收编前后运行时字符串逐字节相同。
 * 键名(muted/emerald/rose/sky)是 STATUS_TONE 按名取用的对外标识,一律不动。
 *
 * 实测缺陷登记(收编不替本屏改语义):键名 `sky` 装的其实是 **blue 族** ——
 * 底取 blue-500 通道 + alpha 0.10、前景取 blue-600,而 rnHue.sky 是 sky-500 通道 + sky-600 前景,
 * 两族不同值、不可互换。故这一行的右侧写 `rnHue.blue.*`,键名仍留 `sky`
 * (成因见 hue-tints.js 头注「族名与色相对不上」)。
 */
const SIGN_UP_PALETTE = {
  muted: { bg: rnHue.zinc.tintStrong, fg: rnHue.zinc.fg },
  emerald: { bg: rnHue.emerald.tint, fg: rnHue.emerald.fg },
  rose: { bg: rnHue.rose.tintStrong, fg: rnHue.rose.fg },
  sky: { bg: rnHue.blue.tint, fg: rnHue.blue.fg },
} as const

export function SignUpScreen({ t, colorScheme, onBack, loading, error, rows }: SignUpScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const stateBlock = (node: React.ReactNode) => <View style={styles.centerBlock}>{node}</View>

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle}>{t('signUpPage.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          stateBlock(
            <>
              <ActivityIndicator size="small" color={tk.text.tertiary} />
              <Text style={styles.muted}>{t('signUpPage.loading')}</Text>
            </>,
          )
        ) : error ? (
          stateBlock(<Text style={styles.muted}>{error}</Text>)
        ) : rows.length === 0 ? (
          stateBlock(
            <>
              <ClipboardList size={32} color={tk.text.tertiary} strokeWidth={1.6} />
              <Text style={styles.muted}>{t('signUpPage.empty')}</Text>
            </>,
          )
        ) : (
          <View style={styles.list}>
            {rows.map((row) => {
              const tone = SIGN_UP_PALETTE[STATUS_TONE[row.status] ?? 'draft']
              return (
                <View key={row.id} style={styles.card}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {row.targetTitle}
                  </Text>
                  <View style={styles.metaRow}>
                    {row.typeText ? (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{row.typeText}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.badgeText, { color: tone.fg }]}>{row.statusText}</Text>
                    </View>
                    <Text style={styles.dateText}>{row.dateText}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
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
    headerTitle: { fontSize: rnType.strong.size, fontWeight: '700', color: tk.text.primary },
    scroll: { paddingVertical: rnSpacing.md, gap: rnSpacing.sm },
    list: { gap: rnSpacing.sm },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    card: {
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.md,
      gap: rnSpacing.xs,
    },
    cardTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: rnSpacing.sm },
    chip: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
    },
    chipText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    badge: {
      borderRadius: rnRadius.md,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
    },
    badgeText: { fontSize: rnType.caption.size, fontWeight: '600' },
    dateText: { fontSize: rnType.caption.size, color: tk.text.tertiary, marginLeft: 'auto' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
