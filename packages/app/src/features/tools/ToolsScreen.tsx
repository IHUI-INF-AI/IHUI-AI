// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { AlertTriangle, ArrowRight, Code, Wrench, Zap } from 'lucide-react-native'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createToolsStyles } from './tools-styles'

/** 工具分类(与 web /api/tools 的 category 字段同枚举)。 */
export type ToolCategory = 'ai' | 'dev' | 'efficiency'

/** 工具行(形状对齐 @ihui/api-client ToolItem,共享层独立声明不依赖 api-client)。 */
export interface ToolRow {
  id: string
  name: string
  description: string
  url: string
  category: ToolCategory
}

export interface ToolsScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading?: boolean
  error?: string | null
  tools?: ToolRow[]
  onRefresh?: () => void
  /** 点卡片打开工具(web 端 <Link href={tool.url}>;RN 薄壳落 Linking/站内路由)。 */
  onOpenTool: (tool: ToolRow) => void
}

/** 三分类渲染序与图标(逐字对齐 web CATEGORIES:ai/dev/efficiency + Zap/Code/Wrench)。 */
const CATEGORIES: {
  key: ToolCategory
  labelKey: 'toolsPage.categoryAi' | 'toolsPage.categoryDev' | 'toolsPage.categoryEfficiency'
  Icon: typeof Zap
}[] = [
  { key: 'ai', labelKey: 'toolsPage.categoryAi', Icon: Zap },
  { key: 'dev', labelKey: 'toolsPage.categoryDev', Icon: Code },
  { key: 'efficiency', labelKey: 'toolsPage.categoryEfficiency', Icon: Wrench },
]

/**
 * 工具中心共享屏(Wave2 2026-10-26,tools 域;对齐 web apps/web/app/(main)/tools/page.tsx)。
 *
 * 结构:页头(返回 + 标题)+ hero(标题/副题)+ 三分类区块,每区块按 category 过滤渲染
 * 卡片(图标块 + 名称 + 描述 + 右箭头),点卡片经 onOpenTool 打开 tool.url;
 * loading/error/empty 三态与 status 样板屏同构。取数(GET /api/tools)由平台薄壳承担。
 */
export function ToolsScreen({
  t,
  onBack,
  colorScheme = 'light',
  loading = false,
  error = null,
  tools,
  onRefresh,
  onOpenTool,
}: ToolsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createToolsStyles(tk), [tk])

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('toolsPage.title')}</Text>
    </View>
  )

  if (error && !loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={[styles.card, styles.errorBox]}>
          <AlertTriangle size={28} color={tk.danger.DEFAULT} strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
          {onRefresh ? (
            <TouchableOpacity
              style={styles.refreshBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('toolsPage.refresh')}
              onPress={onRefresh}
            >
              <Text style={styles.refreshText}>{t('toolsPage.refresh')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    )
  }

  if (loading && !tools) {
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonRow} />
          <View style={styles.skeletonRow} />
          <View style={styles.skeletonRow} />
        </ScrollView>
      </View>
    )
  }

  const list = tools ?? []

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              tintColor={tk.text.secondary}
            />
          ) : undefined
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('toolsPage.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('toolsPage.subtitle')}</Text>
        </View>

        {CATEGORIES.map(({ key, labelKey, Icon }) => {
          const items = list.filter((item) => item.category === key)
          return (
            <View key={key} style={styles.section}>
              <View style={styles.sectionHead}>
                <Icon size={18} color={tk.brandAccent.deep} strokeWidth={2} />
                <Text style={styles.sectionTitle}>{t(labelKey)}</Text>
              </View>
              {items.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>{t('toolsPage.empty')}</Text>
                </View>
              ) : (
                <View style={styles.cardGrid}>
                  {items.map((tool) => (
                    <TouchableOpacity
                      key={tool.id}
                      style={styles.card}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={tool.name}
                      onPress={() => onOpenTool(tool)}
                    >
                      <View style={styles.iconChip}>
                        <Icon size={18} color={tk.brandAccent.deep} strokeWidth={2} />
                      </View>
                      <View style={styles.cardMain}>
                        <Text style={styles.cardTitle}>{tool.name}</Text>
                        <Text style={styles.cardDesc}>{tool.description}</Text>
                      </View>
                      <ArrowRight size={16} color={tk.text.tertiary} strokeWidth={2} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
