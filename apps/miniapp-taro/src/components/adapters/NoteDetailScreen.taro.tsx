// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 @tarojs/components 的 View/Text/ScrollView/Image 组件,不适合共享层
import { useTt, type TtFn } from '@/i18n'
import { useCallback } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { getRnTokens, type RnThemeTokens, type RnThemeMode } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import type { TFunction, NoteDetailItem, NoteDetailScreenProps } from '@ihui/types'

/** 笔记详情/Props 类型 re-export(单一来源 @ihui/types) */
export type { NoteDetailItem, NoteDetailScreenProps }

/**
 * Taro 适配层:NoteDetailScreen — 跨端共享「笔记详情」页。
 *
 * 复用 packages/app/src/features/note-detail/NoteDetailScreen 的 props 契约 + 状态机逻辑
 * (loading / error / normal 三态)+ 主题 token 注入,仅替换 RN 元素为 @tarojs/components 原语:
 * - View/Text → 对应 Taro View/Text(样式由 StyleSheet.create → CSSProperties 函数)
 * - TouchableOpacity → `View` + `onTap`(hitSlop 用 padding 模拟)
 * - ScrollView(RN vertical)→ Taro `ScrollView scrollY`
 *
 * 配色:由 colorScheme prop 经 getRnTokens 解析为明/暗 token 集(与 packages/app/theme/tokens 同源,
 * mobile-rn 端 1:1 对齐)。
 *
 * i18n 三级降级:prop t(必传,NoteDetailScreenProps.t)→ useTt()(I18nContext)→ FALLBACK_TEXT 硬编码中文。
 * i18n 键来源:@ihui/i18n/messages/shared/{zh-CN,en,ja,ko,zh-TW}.json 的 noteDetail/common 命名空间。
 */

/** 硬编码中文 fallback(i18n 三级降级最末层,应对 prop t 与 I18nContext 均缺失翻译的场景) */
const FALLBACK_TEXT = (tt: TtFn): Record<string, string> => ({
  'common.loading': tt('common.loadingShort', '加载中...'),
  'common.back': tt('common.back', '返回'),
  'noteDetail.loadFailed': tt('noteList.loadFailed', '加载笔记失败'),
  'noteDetail.views': tt('help.viewCount', '{count} 次阅读'),
})

/** Taro `rpx` 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

// ============ 样式函数(独立函数返回 CSSProperties,避免联合类型) ============

const containerStyle = (tk: RnThemeTokens): CSSProperties => ({
  flex: 1,
  backgroundColor: tk.surface.bg,
  paddingLeft: toRpx(16),
  paddingRight: toRpx(16),
  paddingTop: toRpx(48),
  paddingBottom: toRpx(32),
})

const centerStyle = (tk: RnThemeTokens): CSSProperties => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: tk.surface.bg,
  padding: toRpx(16),
})

const mutedStyle = (tk: RnThemeTokens): CSSProperties => ({
  marginTop: toRpx(8),
  fontSize: toRpx(13),
  color: tk.text.secondary,
})

const errorStyle = (tk: RnThemeTokens): CSSProperties => ({
  fontSize: toRpx(13),
  color: tk.danger.DEFAULT,
  marginBottom: toRpx(8),
  textAlign: 'center',
})

const backBtnStyle = (): CSSProperties => ({
  paddingLeft: toRpx(8),
  paddingRight: toRpx(8),
  paddingTop: toRpx(8),
  paddingBottom: toRpx(8),
  cursor: 'pointer',
})

const backTextStyle = (tk: RnThemeTokens): CSSProperties => ({
  fontSize: toRpx(14),
  color: tk.text.secondary,
})

const titleStyle = (tk: RnThemeTokens): CSSProperties => ({
  marginTop: toRpx(8),
  fontSize: toRpx(22),
  fontWeight: '600',
  color: tk.text.primary,
})

const metaRowStyle = (): CSSProperties => ({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: toRpx(6),
  marginBottom: toRpx(6),
})

const authorStyle = (tk: RnThemeTokens): CSSProperties => ({
  fontSize: toRpx(13),
  color: tk.success.DEFAULT,
  fontWeight: '500',
})

const metaStyle = (tk: RnThemeTokens): CSSProperties => ({
  fontSize: toRpx(11),
  color: tk.text.tertiary,
})

const tagRowStyle = (): CSSProperties => ({
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: toRpx(6),
  marginBottom: toRpx(12),
})

const tagStyle = (tk: RnThemeTokens): CSSProperties => ({
  fontSize: toRpx(11),
  color: tk.success.DEFAULT,
  backgroundColor: tk.success.light,
  paddingLeft: toRpx(6),
  paddingRight: toRpx(6),
  paddingTop: toRpx(2),
  paddingBottom: toRpx(2),
  borderRadius: toRpx(4),
})

const contentStyle = (tk: RnThemeTokens): CSSProperties => ({
  fontSize: toRpx(14),
  lineHeight: toRpx(22),
  color: tk.text.medium,
})

const statRowStyle = (): CSSProperties => ({
  display: 'flex',
  flexDirection: 'row',
  gap: toRpx(12),
  marginTop: toRpx(16),
})

const statStyle = (tk: RnThemeTokens): CSSProperties => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  fontSize: toRpx(12),
  color: tk.text.medium,
  backgroundColor: tk.surface.card,
  paddingLeft: toRpx(10),
  paddingRight: toRpx(10),
  paddingTop: toRpx(4),
  paddingBottom: toRpx(4),
  borderRadius: toRpx(8),
})

const btnStyle = (tk: RnThemeTokens): CSSProperties => ({
  marginTop: toRpx(12),
  paddingLeft: toRpx(16),
  paddingRight: toRpx(16),
  paddingTop: toRpx(8),
  paddingBottom: toRpx(8),
  borderRadius: toRpx(8),
  backgroundColor: tk.success.DEFAULT,
  cursor: 'pointer',
})

const btnTextStyle = (tk: RnThemeTokens): CSSProperties => ({
  color: tk.surface.light,
  fontSize: toRpx(14),
})

// ============ 组件 ============

export function NoteDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme,
}: NoteDetailScreenProps) {
  const tt = useTt()
  const { resolved: appTheme } = useAppTheme()
  const effectiveScheme: RnThemeMode = colorScheme ?? appTheme
  const tk = getRnTokens(effectiveScheme)

  /** i18n 三级降级:prop t → I18nContext(useTt)→ FALLBACK_TEXT(tt) 硬编码中文 */
  const tr = useCallback<TFunction>(
    (key, options) => {
      const v = t(key, options)
      if (v && v !== key) return v
      return tt(key, FALLBACK_TEXT(tt)[key] ?? key, options)
    },
    [t, tt],
  )

  if (loading) {
    return (
      <View style={centerStyle(tk)}>
        <Text style={mutedStyle(tk)}>{tr('common.loading')}</Text>
      </View>
    )
  }

  if (error || !item) {
    return (
      <View style={centerStyle(tk)}>
        <Text style={errorStyle(tk)}>{error || tr('noteDetail.loadFailed')}</Text>
        <View onTap={onBack} style={btnStyle(tk)}>
          <Text style={btnTextStyle(tk)}>{tr('common.back')}</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView scrollY style={containerStyle(tk)}>
      <View onTap={onBack} style={backBtnStyle()}>
        <Text style={backTextStyle(tk)}>{tr('common.back')}</Text>
      </View>
      <Text style={titleStyle(tk)}>{item.title}</Text>
      <View style={metaRowStyle()}>
        <Text style={authorStyle(tk)}>{item.author}</Text>
        <Text style={metaStyle(tk)}>
          {tr('noteDetail.views', { count: item.views })} · {item.createdAt}
        </Text>
      </View>
      {item.tags.length > 0 ? (
        <View style={tagRowStyle()}>
          {item.tags.map((tag) => (
            <Text key={tag} style={tagStyle(tk)}>
              #{tag}
            </Text>
          ))}
        </View>
      ) : null}
      <Text style={contentStyle(tk)}>{item.content}</Text>
      <View style={statRowStyle()}>
        <View style={statStyle(tk)}>
          <Image
            src="/static/images/icons/heart.svg"
            mode="aspectFit"
            style={{ width: toRpx(12), height: toRpx(12), marginRight: toRpx(4) }}
          />
          <Text style={{ fontSize: toRpx(12), color: tk.text.medium }}>{item.likes}</Text>
        </View>
      </View>
    </ScrollView>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
