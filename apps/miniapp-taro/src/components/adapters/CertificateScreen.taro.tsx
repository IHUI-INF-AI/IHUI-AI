// 平台特有:依赖 @tarojs/components 的 View/Text/ScrollView 组件,不适合共享层
import { View, Text, ScrollView } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import type { TFunction, CertificateScreenProps } from '@ihui/types'
import { useTt } from '@/i18n'

/** 证书状态/列表项/Props 类型 re-export(单一来源 @ihui/types) */
export type { CertificateItem, CertificateScreenProps, CertificateStatus } from '@ihui/types'

/**
 * Taro 适配层:CertificateScreen
 *
 * 平台特有:依赖 @tarojs/components 的 View/Text/ScrollView 组件,不适合共享层。
 *
 * 复用 packages/app/src/features/certificate/CertificateScreen 的 props 契约 +
 * 状态徽章配色状态机 + 下拉刷新逻辑,仅替换平台元素:
 * - `div`/`span`/`TouchableOpacity` → `View`/`Text`
 * - `onPress` → `onTap`
 * - RN `ScrollView refreshControl` → Taro `ScrollView refresherEnabled + refresherTriggered`
 * - RN `StyleSheet.create` → CSSProperties 独立函数(避免 style 联合类型)
 * - px → rpx 单位换算(1px = 2rpx,750 设计稿基准)
 *
 * 颜色通过 `getRnTokens(colorScheme)` 共享注入,保持与 RN 端主题一致。
 *
 * i18n 三级降级:`t` prop → `useTt()` I18nContext → 硬编码中文 fallback。
 * CertificateScreenProps.t 为必填(契约约束),useTt 作防御性兜底,tr() 对 i18n miss 降级到硬编码。
 */
export function CertificateScreen({
  t: tProp,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: CertificateScreenProps) {
  const tk = getRnTokens(colorScheme)
  const tt = useTt()

  // i18n 三级降级:prop t > I18nContext tt > 硬编码中文(CertificateScreenProps.t 必填,useTt 防御性兜底)
  const tFn: TFunction =
    tProp ?? ((key, options) => tt(key, key, options as Record<string, string | number> | undefined))
  /** t(key) 未命中(返回 key 原值)时降级到硬编码 fallback */
  const tr = (key: string, fallback: string): string => {
    const v = tFn(key)
    return v === key ? fallback : v
  }

  const titleText = tr('certificate.title', '我的证书')
  const backText = tr('common.back', '返回')
  const loadingText = tr('common.loading', '加载中...')
  const emptyText = tr('certificate.empty', '暂无证书')
  const issuedDateLabel = tr('certificate.issuedDate', '发证日期')
  const expiryDateLabel = tr('certificate.expiryDate', '过期日期')
  const statusIssuedText = tr('certificate.status.issued', '已颁发')
  const statusExpiredText = tr('certificate.status.expired', '已过期')
  const statusRevokedText = tr('certificate.status.revoked', '已撤销')

  /** 状态徽章配色(对齐 RN 源端 statusColor 状态机) */
  const statusColor = (status: string): string => {
    switch (status) {
      case 'issued':
        return tk.success.DEFAULT
      case 'expired':
        return tk.warning.amber
      case 'revoked':
        return tk.danger.DEFAULT
      default:
        return tk.gray[400]
    }
  }

  /** 状态徽章文案(对齐 RN 源端 statusLabel) */
  const statusLabel = (status: string): string => {
    switch (status) {
      case 'issued':
        return statusIssuedText
      case 'expired':
        return statusExpiredText
      case 'revoked':
        return statusRevokedText
      default:
        return status
    }
  }

  return (
    <View style={viewStyles.container(tk)}>
      <View style={viewStyles.header(tk)}>
        <View style={viewStyles.backBtn()} onTap={onBack}>
          <Text style={textStyles.backText(tk)}>{backText}</Text>
        </View>
        <Text style={textStyles.title(tk)}>{titleText}</Text>
      </View>

      {error ? <Text style={textStyles.errorText(tk)}>{error}</Text> : null}

      <ScrollView
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
        style={viewStyles.scrollBody(tk)}
      >
        <View style={viewStyles.bodyInner(tk)}>
          {loading && items.length === 0 ? (
            <View style={viewStyles.center()}>
              <Text style={textStyles.muted(tk)}>{loadingText}</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={viewStyles.center()}>
              <Text style={textStyles.muted(tk)}>{emptyText}</Text>
            </View>
          ) : (
            items.map((item) => (
              <View
                key={item.id}
                style={viewStyles.card(tk)}
                onTap={() => onPressItem(item)}
              >
                <View style={viewStyles.titleRow()}>
                  <Text style={textStyles.cardTitle(tk)}>{item.title}</Text>
                  <View
                    style={{
                      ...viewStyles.statusBadge(),
                      backgroundColor: statusColor(item.status),
                    }}
                  >
                    <Text style={textStyles.statusText(tk)}>{statusLabel(item.status)}</Text>
                  </View>
                </View>
                <Text style={textStyles.cardCourse(tk)}>{item.courseName}</Text>
                <Text style={textStyles.cardDate(tk)}>
                  {issuedDateLabel}: {item.issueDate}
                </Text>
                {item.expiryDate ? (
                  <Text style={textStyles.cardDate(tk)}>
                    {expiryDateLabel}: {item.expiryDate}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

// ===== 样式(view/text 分组,独立函数返回 CSSProperties,避免 style 联合类型) =====

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准,与 miniapp-taro 全局风格一致) */
const toRpx = (px: number): string => `${px * 2}rpx`

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: tk.surface.bg,
  }),
  header: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
    backgroundColor: tk.surface.bg,
  }),
  backBtn: (): CSSProperties => ({
    paddingLeft: toRpx(4),
    paddingRight: toRpx(4),
    paddingTop: toRpx(8),
    paddingBottom: toRpx(8),
    marginRight: toRpx(12),
  }),
  scrollBody: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    backgroundColor: tk.surface.bg,
  }),
  bodyInner: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(16),
    paddingBottom: toRpx(16),
    backgroundColor: tk.surface.bg,
  }),
  center: (): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    paddingTop: toRpx(48),
    paddingBottom: toRpx(48),
  }),
  card: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(16),
    paddingBottom: toRpx(16),
    borderRadius: toRpx(8),
    border: `1px solid ${tk.border.light}`,
    marginBottom: toRpx(8),
    backgroundColor: tk.surface.light,
  }),
  titleRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: toRpx(4),
  }),
  statusBadge: (): CSSProperties => ({
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
    paddingTop: toRpx(4),
    paddingBottom: toRpx(4),
    borderRadius: toRpx(6),
    marginLeft: toRpx(8),
    overflow: 'hidden',
    flexShrink: 0,
  }),
}

const textStyles = {
  backText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.medium,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(18),
    fontWeight: 600,
    color: tk.text.primary,
  }),
  errorText: (tk: RnThemeTokens): CSSProperties => ({
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingBottom: toRpx(4),
    fontSize: toRpx(12),
    color: tk.danger.DEFAULT,
  }),
  muted: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.text.secondary,
  }),
  cardTitle: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    fontSize: toRpx(14),
    fontWeight: 600,
    color: tk.text.primary,
    overflow: 'hidden',
  }),
  cardCourse: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(2),
    fontSize: toRpx(12),
    color: tk.text.secondary,
    overflow: 'hidden',
  }),
  cardDate: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(2),
    fontSize: toRpx(11),
    color: tk.text.tertiary,
  }),
  statusText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(11),
    // surface.light = 对比白字(状态色背景上的白字,对齐 RN tokens 语义)
    color: tk.surface.light,
  }),
}
