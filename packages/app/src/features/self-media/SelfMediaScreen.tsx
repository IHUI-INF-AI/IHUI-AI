// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '@ihui/types'

/**
 * SelfMediaScreen 自媒体助手(共享层)
 *
 * 2026-09-15 承接 mobile-rn SelfMediaScreen 1:1 迁移(M3 web /self-media 移动端原生入口):
 * - 结构:顶部导航行 → Tab 切换(技能/记录)
 *   → 技能卡(名称/分类徽章/描述,展开后 prompt 输入 + 调用 + 结果卡含耗时/分享)
 *   → 记录卡(标题/状态徽章/分类·关键词·时间)
 * - 平台无关:API(listSelfMediaSkills/invoke/listSelfMediaRecords)、Alert、
 *   Share 分享、导航由 wrapper 注入;tab/展开态/prompt/结果全部受控 props
 * - 样式:getTokens(colorScheme) 语义 token(零 hex),对齐原屏 tailwind 间距(dp)
 * - i18n:全部复用 selfMedia 与 spec.empty 既有 key
 */

export type SelfMediaTab = 'skills' | 'records'

/** 技能展示项(结构对齐 @ihui/api-client SelfMediaSkill,wrapper 直接传入) */
export interface SelfMediaSkillItem {
  id: string
  name: string
  description: string
  category: string
  directory: string
  /** 目录是否存在(可调用) */
  available: boolean
  /** 可调用的脚本名 */
  entryPoints: string[]
  /** 示例调用提示(供输入框 placeholder) */
  examples: string[]
  tags: string[]
}

/** 记录展示项(结构对齐 @ihui/api-client SelfMediaRecord 的展示子集,wrapper 直接传入) */
export interface SelfMediaRecordItem {
  id: string
  title: string
  category: string
  status: string
  topicKeyword: string | null
  createdAt: string
}

/** 技能调用结果(结构对齐 @ihui/api-client SelfMediaInvokeResult) */
export interface SelfMediaResultItem {
  skillId: string
  ok: boolean
  output: string
  duration_ms: number
  error?: string | null
}

export interface SelfMediaScreenProps {
  t: TFunction
  tab: SelfMediaTab
  skills: SelfMediaSkillItem[]
  records: SelfMediaRecordItem[]
  loading: boolean
  /** 当前展开的技能 id(null = 全部收起) */
  activeSkillId: string | null
  /** 技能 prompt 输入(受控) */
  prompt: string
  invoking: boolean
  /** 最近一次技能调用结果(展示于展开卡内) */
  result: SelfMediaResultItem | null
  onTabChange: (tab: SelfMediaTab) => void
  /** 展开/收起技能卡(wrapper 侧需联动清空 prompt/result) */
  onSelectSkill: (skillId: string | null) => void
  onPromptChange: (text: string) => void
  /** 调用技能(prompt 校验 + API + Alert 由 wrapper 处理) */
  onInvoke: (skill: SelfMediaSkillItem) => void
  /** 分享结果(RN Share API 由 wrapper 处理) */
  onShare: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** SelfMediaScreen 自媒体助手(props 注入式跨端组件) */
export function SelfMediaScreen({
  t,
  tab,
  skills,
  records,
  loading,
  activeSkillId,
  prompt,
  invoking,
  result,
  onTabChange,
  onSelectSkill,
  onPromptChange,
  onInvoke,
  onShare,
  onBack,
  colorScheme = 'light',
}: SelfMediaScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <Header title={t('selfMedia.title')} onBack={onBack} styles={styles} />

      {/* tab 切换 */}
      <View style={styles.tabRow}>
        {(['skills', 'records'] as const).map((key) => {
          const active = tab === key
          return (
            <Pressable
              key={key}
              onPress={() => onTabChange(key)}
              style={({ pressed }) => [
                styles.tabBtn,
                { backgroundColor: active ? tk.brand.DEFAULT : tk.surface.muted },
                pressed ? styles.pressed : null,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabBtnText, active ? styles.tabBtnTextActive : null]}>
                {t(key === 'skills' ? 'selfMedia.tabSkills' : 'selfMedia.tabRecords')}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={tk.text.secondary} />
          </View>
        ) : tab === 'skills' ? (
          <View style={styles.stackGapLg}>
            {skills.length === 0 ? (
              <Text style={styles.hintCenter}>{t('spec.empty')}</Text>
            ) : (
              skills.map((skill) => {
                const expanded = activeSkillId === skill.id
                const invokeDisabled = invoking || !skill.available
                return (
                  <View key={skill.id} style={styles.card}>
                    <Pressable
                      onPress={() => onSelectSkill(expanded ? null : skill.id)}
                      accessibilityRole="button"
                      accessibilityLabel={skill.name}
                    >
                      <View style={styles.skillHeadRow}>
                        <Text style={styles.skillName}>{skill.name}</Text>
                        <View
                          style={[
                            styles.categoryBadge,
                            {
                              backgroundColor: skill.available
                                ? tk.success.lightest
                                : tk.surface.muted,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.categoryBadgeText,
                              { color: skill.available ? tk.success.deep : tk.text.tertiary },
                            ]}
                          >
                            {skill.category}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.skillDesc} numberOfLines={2}>
                        {skill.description}
                      </Text>
                    </Pressable>

                    {expanded ? (
                      <View style={styles.skillBody}>
                        <TextInput
                          value={prompt}
                          onChangeText={onPromptChange}
                          placeholder={skill.examples[0] || t('selfMedia.promptPlaceholder')}
                          placeholderTextColor={tk.text.tertiary}
                          multiline
                          textAlignVertical="top"
                          style={styles.promptInput}
                        />
                        <Pressable
                          onPress={() => onInvoke(skill)}
                          disabled={invokeDisabled}
                          style={({ pressed }) => [
                            styles.invokeBtn,
                            invokeDisabled ? styles.invokeBtnDisabled : null,
                            pressed && !invokeDisabled ? styles.pressed : null,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={t('selfMedia.invoke')}
                        >
                          <Text style={styles.invokeBtnText}>
                            {invoking ? t('selfMedia.invoking') : t('selfMedia.invoke')}
                          </Text>
                        </Pressable>
                        {result ? (
                          <View style={styles.resultCard}>
                            <View style={styles.resultHeadRow}>
                              <Text style={styles.resultDuration}>
                                {t('selfMedia.duration', { ms: result.duration_ms })}
                              </Text>
                              <Pressable onPress={onShare} hitSlop={6}>
                                <Text style={styles.resultShare}>{t('selfMedia.share')}</Text>
                              </Pressable>
                            </View>
                            <Text selectable style={styles.resultOutput}>
                              {result.output || result.error}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                )
              })
            )}
          </View>
        ) : records.length === 0 ? (
          <Text style={styles.hintCenter}>{t('selfMedia.empty')}</Text>
        ) : (
          <View style={styles.stackGapMd}>
            {records.map((rec) => {
              const published = rec.status === 'published'
              const failed = rec.status === 'failed'
              return (
                <View key={rec.id} style={styles.card}>
                  <View style={styles.recordHeadRow}>
                    <Text style={styles.recordTitle} numberOfLines={1}>
                      {rec.title}
                    </Text>
                    <View
                      style={[
                        styles.categoryBadge,
                        {
                          backgroundColor: published
                            ? tk.success.lightest
                            : failed
                              ? tk.danger.light
                              : tk.surface.muted,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryBadgeText,
                          {
                            color: published
                              ? tk.success.deep
                              : failed
                                ? tk.danger.DEFAULT
                                : tk.text.secondary,
                          },
                        ]}
                      >
                        {rec.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.recordMeta}>
                    {rec.category}
                    {rec.topicKeyword ? ` · ${rec.topicKeyword}` : ''}
                    {` · ${new Date(rec.createdAt).toLocaleString()}`}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ── 私有:顶部导航行(返回箭头 + 标题,对齐共享层 Header 范式) ──

function Header({
  title,
  onBack,
  styles,
}: {
  title: string
  onBack: () => void
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <View style={styles.headerBar}>
      <Pressable
        style={styles.headerBackBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="back"
      >
        <ChevronLeft size={22} color={styles.headerIcon.color} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSidePlaceholder} />
    </View>
  )
}

/**
 * 样式:对齐原屏 tailwind 间距(数值即 dp)。
 * 全部颜色走 AppThemeTokens 语义 token,零 hex。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    pressed: {
      opacity: 0.7,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
      paddingHorizontal: 10,
    },
    headerBackBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIcon: {
      color: tk.brand.DEFAULT,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: tk.brand.DEFAULT,
      textAlign: 'center',
    },
    headerSidePlaceholder: {
      width: 32,
    },
    /* tab 切换 */
    tabRow: {
      flexDirection: 'row',
      gap: 8, // gap-2
      marginHorizontal: 16, // mx-4
    },
    tabBtn: {
      flex: 1,
      borderRadius: rnRadius.md, // rounded-md
      paddingVertical: 8, // py-2
      alignItems: 'center',
    },
    tabBtnText: {
      fontSize: 12, // text-xs
      textAlign: 'center',
      color: tk.text.secondary, // text-gray-600 dark:text-neutral-300
    },
    tabBtnTextActive: {
      fontWeight: '500', // font-medium
      color: tk.surface.light, // text-white
    },
    /* 滚动区 */
    scrollContent: {
      padding: 16,
    },
    loadingWrap: {
      marginTop: 32, // mt-8
      alignItems: 'center',
    },
    stackGapLg: {
      gap: 12, // gap-3
    },
    stackGapMd: {
      gap: 10, // gap-2.5
    },
    hintCenter: {
      marginTop: 32, // mt-8
      textAlign: 'center',
      fontSize: 14, // text-sm
      color: tk.text.tertiary, // text-gray-400
    },
    /* 卡片(技能/记录通用) */
    card: {
      borderRadius: rnRadius.lg, // rounded-lg
      borderWidth: 1,
      borderColor: tk.border.light, // border-gray-200
      padding: 12, // p-3
      backgroundColor: tk.surface.card,
    },
    /* 技能卡 */
    skillHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8, // gap-2
    },
    skillName: {
      fontSize: 14, // text-sm
      fontWeight: '500', // font-medium
      color: tk.text.primary, // dark:text-neutral-100
    },
    categoryBadge: {
      borderRadius: rnRadius.sm, // rounded
      paddingHorizontal: 6, // px-1.5
      paddingVertical: 2, // py-0.5
    },
    categoryBadgeText: {
      fontSize: 10, // text-[10px]
    },
    skillDesc: {
      fontSize: 12, // text-xs
      marginTop: 4, // mt-1
      color: tk.text.secondary, // text-gray-500 dark:text-neutral-400
    },
    skillBody: {
      marginTop: 8, // mt-2
    },
    promptInput: {
      minHeight: 64, // min-h-[64px]
      borderRadius: rnRadius.md, // rounded-md
      borderWidth: 1,
      borderColor: tk.border.light, // border-gray-200
      padding: 10, // p-2.5
      fontSize: 12, // text-xs
      color: tk.text.primary, // dark:text-neutral-100
      textAlignVertical: 'top',
    } satisfies TextStyle & ViewStyle,
    invokeBtn: {
      marginTop: 8, // mt-2
      alignItems: 'center',
      borderRadius: rnRadius.md, // rounded-md
      paddingVertical: 10, // py-2.5
      backgroundColor: tk.brand.DEFAULT, // bg-orange-600 → 共享层品牌主色
    },
    invokeBtnDisabled: {
      opacity: 0.5, // bg-orange-400 降级的等价禁用态
    },
    invokeBtnText: {
      fontSize: 12, // text-xs
      fontWeight: '500', // font-medium
      color: tk.surface.light, // text-white
    },
    /* 结果卡 */
    resultCard: {
      marginTop: 8, // mt-2
      borderRadius: rnRadius.md, // rounded-md
      padding: 10, // p-2.5
      backgroundColor: tk.surface.inputBg, // bg-gray-50 dark:bg-neutral-800
    },
    resultHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    resultDuration: {
      fontSize: 10, // text-[10px]
      color: tk.text.tertiary, // text-gray-400
    },
    resultShare: {
      fontSize: 12, // text-xs
      color: tk.brandAccent.deep, // text-orange-600 dark:text-orange-400 → 共享层强调色
    },
    resultOutput: {
      marginTop: 4, // mt-1
      fontSize: 12, // text-xs
      lineHeight: 16, // leading-4
      color: tk.text.primary, // text-gray-700 dark:text-neutral-200
    },
    /* 记录卡 */
    recordHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    recordTitle: {
      flex: 1,
      fontSize: 14, // text-sm
      fontWeight: '500', // font-medium
      color: tk.text.primary, // dark:text-neutral-100
    },
    recordMeta: {
      fontSize: 10, // text-[10px]
      marginTop: 4, // mt-1
      color: tk.text.tertiary, // text-gray-400
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
