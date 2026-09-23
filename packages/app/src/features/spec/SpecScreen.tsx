// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '@ihui/types'

/**
 * SpecScreen 规范模板库(共享层)
 *
 * 2026-09-15 承接 mobile-rn SpecScreen 1:1 迁移(M3 web /spec 移动端原生入口):
 * - 结构:顶部导航行(返回 + 标题 + 刷新)→ 桌面提示条(可选生成入口)
 *   → 模板卡(名称/id 徽章/描述/章节 tags)
 * - 平台无关:API(listSpecTemplates)、Alert、导航由 wrapper 注入;
 *   生成流程强依赖服务端 workspace 路径,onGenerate 回调由 wrapper 注入
 *   (RN 端跳 WebView 门户,桌面/Web 端可接原生流程)
 * - 样式:getTokens(colorScheme) 语义 token(零 hex),对齐原屏 tailwind 间距(dp)
 * - i18n:复用 spec 与 common 既有 key;生成入口新 key spec.generateEntry
 */

/** 规格模板展示项(结构对齐 @ihui/api-client SpecTemplate,wrapper 直接传入) */
export interface SpecTemplateItem {
  id: string
  name: string
  description: string
  sections: string[]
}

export interface SpecScreenProps {
  t: TFunction
  templates: SpecTemplateItem[]
  loading: boolean
  /** 头部刷新(重新拉取模板列表) */
  onReload: () => void
  /** 生成入口(桌面/Web 场景;RN wrapper 跳 WebView 门户。缺省不显示入口) */
  onGenerate?: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** SpecScreen 规范模板库(props 注入式跨端组件) */
export function SpecScreen({
  t,
  templates,
  loading,
  onReload,
  onGenerate,
  onBack,
  colorScheme = 'light',
}: SpecScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <Header
        title={t('spec.title')}
        onBack={onBack}
        styles={styles}
        right={
          <Pressable
            onPress={onReload}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <Text style={styles.headerAction}>{t('common.retry')}</Text>
          </Pressable>
        }
      />

      {/* 桌面提示条:模板浏览仅作参考;可选生成入口(onGenerate 存在时显示) */}
      <View style={styles.hintBar}>
        <Text style={styles.hintText}>{t('spec.desktopHint')}</Text>
        {onGenerate ? (
          <Pressable
            onPress={onGenerate}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('spec.generateEntry')}
          >
            <Text style={styles.hintAction}>{t('spec.generateEntry')}</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <Text style={styles.hintCenter}>{t('common.loading')}</Text>
        ) : templates.length === 0 ? (
          <Text style={styles.hintCenter}>{t('spec.empty')}</Text>
        ) : (
          <View style={styles.stackGapLg}>
            {templates.map((tpl) => (
              <View key={tpl.id} style={styles.card}>
                <View style={styles.headRow}>
                  <Text style={styles.tplName}>{tpl.name}</Text>
                  <View style={styles.idBadge}>
                    <Text style={styles.idBadgeText}>{tpl.id}</Text>
                  </View>
                </View>
                <Text style={styles.tplDesc}>{tpl.description}</Text>
                {tpl.sections.length > 0 ? (
                  <View style={styles.tagRow}>
                    {tpl.sections.map((sec) => (
                      <View key={sec} style={styles.tag}>
                        <Text style={styles.tagText}>{sec}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ── 私有:顶部导航行(返回箭头 + 标题 + 右侧动作,对齐共享层 Header 范式) ──

function Header({
  title,
  onBack,
  right,
  styles,
}: {
  title: string
  onBack: () => void
  right?: ReactNode
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
      <View style={styles.headerSide}>{right}</View>
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
    headerSide: {
      minWidth: 32,
      alignItems: 'flex-end',
    },
    headerAction: {
      fontSize: 14, // text-sm
      color: tk.brandAccent.deep, // text-orange-600 dark:text-orange-400 → 共享层强调色
    },
    /* 桌面提示条 */
    hintBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16, // mx-4
      borderRadius: rnRadius.md, // rounded-md
      paddingHorizontal: 12, // px-3
      paddingVertical: 8, // py-2
      backgroundColor: tk.warning.orangeLight, // bg-amber-50 dark:bg-amber-900/20
    },
    hintText: {
      flex: 1,
      fontSize: 12, // text-xs
      color: tk.warning.amberText, // text-amber-700 dark:text-amber-300
    },
    hintAction: {
      fontSize: 12, // text-xs
      fontWeight: '600',
      color: tk.brandAccent.deep,
    },
    /* 滚动区 */
    scrollContent: {
      padding: 16,
    },
    stackGapLg: {
      gap: 12, // gap-3
    },
    hintCenter: {
      marginTop: 32, // mt-8
      textAlign: 'center',
      fontSize: 14, // text-sm
      color: tk.text.tertiary, // text-gray-400
    },
    /* 模板卡 */
    card: {
      borderRadius: rnRadius.lg, // rounded-lg
      borderWidth: 1,
      borderColor: tk.border.light, // border-gray-200
      padding: 12, // p-3
      backgroundColor: tk.surface.card,
    },
    headRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8, // gap-2
    },
    tplName: {
      fontSize: 14, // text-sm
      fontWeight: '500', // font-medium
      color: tk.text.primary, // dark:text-neutral-100
    },
    idBadge: {
      borderRadius: rnRadius.sm, // rounded
      paddingHorizontal: 6, // px-1.5
      paddingVertical: 2, // py-0.5
      backgroundColor: tk.surface.muted, // bg-gray-100 dark:bg-neutral-800
    },
    idBadgeText: {
      fontSize: 10, // text-[10px]
      color: tk.text.secondary, // text-gray-500 dark:text-neutral-400
    },
    tplDesc: {
      fontSize: 12, // text-xs
      marginTop: 4, // mt-1
      color: tk.text.secondary, // text-gray-500 dark:text-neutral-400
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8, // mt-2
      gap: 6, // gap-1.5
    },
    tag: {
      borderRadius: rnRadius.sm, // rounded
      paddingHorizontal: 6, // px-1.5
      paddingVertical: 2, // py-0.5
      backgroundColor: tk.brandAccent.light, // bg-orange-50 dark:bg-orange-900/30 → 共享层强调色浅底
    },
    tagText: {
      fontSize: 10, // text-[10px]
      color: tk.brandAccent.deep, // text-orange-600 dark:text-orange-300
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
